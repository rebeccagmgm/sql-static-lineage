import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";

import { runCollector } from "../reconcile/consumer/one-hop/reconcile-one-hop-autofill.ts";
import {
  pinTableProducerIndex,
  type TableProducerIndex,
} from "../reconcile/producer/producer-index.ts";
import { extractSqlReadTableNames } from "../input/shared/sql-table-references.ts";
import { validateTaskDocument, type TaskDocument } from "../input/shared/input-pack.ts";

const SAFE_TASK_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const DEFAULT_MAX_DISCOVERED_TASKS = 5000;

export interface InputPackClosureOptions {
  readonly taskId: string;
  readonly dataRoot: string;
  readonly producerIndexCacheRoot: string;
  readonly maxDepth: number;
  readonly maxTasks: number;
  readonly maxRounds: number;
  readonly maxDiscoveryTables?: number;
  readonly maxDiscoveredTasks?: number;
  readonly discoveryAttempts?: number;
  readonly discoveryMinIntervalMs?: number;
  readonly force?: boolean;
  readonly collectTaskPacks?: (dataRoot: string, taskIds: readonly string[], force: boolean) => void;
}

export interface InputPackClosureResult {
  readonly taskIds: readonly string[];
  readonly discoveredTaskIds: readonly string[];
  readonly collectedTaskIds: readonly string[];
  readonly rounds: number;
  readonly status: "COMPLETE" | "PARTIAL";
  readonly issues: readonly string[];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "zh-Hans", { numeric: true }));
}

function indexTaskPackPaths(dataRoot: string): Map<string, string[]> {
  const root = join(resolve(dataRoot), "tasks");
  const index = new Map<string, string[]>();
  if (!existsSync(root)) return index;
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === "task.json") {
        const taskId = basename(directory);
        const matches = index.get(taskId) ?? [];
        matches.push(path);
        index.set(taskId, matches);
      }
    }
  };
  visit(root);
  return index;
}

function loadTask(dataRoot: string, taskId: string, index: ReadonlyMap<string, readonly string[]>): { path: string; document: TaskDocument } | null {
  const paths = index.get(taskId) ?? [];
  const path = paths.length === 1 ? paths[0]! : null;
  if (!path) return null;
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  validateTaskDocument(parsed);
  return { path, document: parsed as TaskDocument };
}

function taskReads(dataRoot: string, loaded: { path: string; document: TaskDocument }): string[] {
  const taskRoot = dirname(loaded.path);
  const names: string[] = [];
  for (const item of loaded.document.sqlFiles) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const relativePath = text(record.path);
    if (!relativePath) continue;
    const path = resolve(taskRoot, relativePath);
    if (!path.startsWith(`${resolve(taskRoot)}${sep}`)) continue;
    if (existsSync(path)) names.push(...extractSqlReadTableNames(readFileSync(path, "utf8")));
  }
  return unique(names);
}

function indexedProducerIds(index: TableProducerIndex, qualifiedName: string): string[] {
  const normalized = qualifiedName.toLocaleLowerCase("en-US");
  return unique(index.confirmedProducerEdges
    .filter((edge) => edge.table.qualifiedName.toLocaleLowerCase("en-US") === normalized)
    .map((edge) => edge.taskId));
}

function requireLimits(options: InputPackClosureOptions): void {
  for (const [name, value] of [["maxDepth", options.maxDepth], ["maxTasks", options.maxTasks], ["maxRounds", options.maxRounds]] as const)
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name.toUpperCase()}_INVALID`);
}

export function runInputPackClosure(options: InputPackClosureOptions): InputPackClosureResult {
  requireLimits(options);
  if (!SAFE_TASK_ID.test(options.taskId)) throw new Error("INVALID_TASK_ID");
  const dataRoot = resolve(options.dataRoot);
  if (!loadTask(dataRoot, options.taskId, indexTaskPackPaths(dataRoot))) throw new Error(`CURRENT_TASK_INPUT_PACK_MISSING:${options.taskId}`);
  const collect = options.collectTaskPacks ?? runCollector;
  const maxDiscoveredTasks = options.maxDiscoveredTasks ?? DEFAULT_MAX_DISCOVERED_TASKS;
  const discovered = new Set<string>([options.taskId]);
  const discoveredDepth = new Map<string, number>([[options.taskId, 0]]);
  const collected = new Set<string>();
  const visited = new Set<string>();
  const issues: string[] = [];
  const producerCache = new Map<string, string[]>();
  let rounds = 0;
  let stabilized = false;

  while (rounds < options.maxRounds) {
    rounds += 1;
    const taskPathIndex = indexTaskPackPaths(dataRoot);
    const index: TableProducerIndex = pinTableProducerIndex(dataRoot, resolve(options.producerIndexCacheRoot)).index;
    const queue: Array<{ taskId: string; depth: number }> = [...discoveredDepth.entries()]
      .filter(([taskId]) => !visited.has(taskId))
      .map(([taskId, depth]) => ({ taskId, depth }));
    const pending = new Set<string>();
    while (queue.length > 0) {
      queue.sort((left, right) => left.depth - right.depth || left.taskId.localeCompare(right.taskId, "zh-Hans", { numeric: true }));
      const current = queue.shift()!;
      if (visited.has(current.taskId) || current.depth >= options.maxDepth) continue;
      const loaded = loadTask(dataRoot, current.taskId, taskPathIndex);
      if (!loaded) {
        pending.add(current.taskId);
        continue;
      }
      visited.add(current.taskId);
      if (visited.size > options.maxTasks) throw new Error("MAX_TASKS_REACHED");

      for (const qualifiedName of taskReads(dataRoot, loaded)) {
        let producerIds = producerCache.get(qualifiedName);
        if (!producerIds) {
          producerIds = indexedProducerIds(index, qualifiedName);
          producerCache.set(qualifiedName, producerIds);
        }
        for (const producerId of producerIds) {
          discovered.add(producerId);
          const producerDepth = current.depth + 1;
          if (!discoveredDepth.has(producerId) || producerDepth < discoveredDepth.get(producerId)!) discoveredDepth.set(producerId, producerDepth);
          if (!loadTask(dataRoot, producerId, taskPathIndex)) pending.add(producerId);
          else if (producerDepth < options.maxDepth) queue.push({ taskId: producerId, depth: producerDepth });
        }
      }
    }

    const collectIds = unique([...pending]);
    if (collectIds.length === 0) {
      stabilized = true;
      break;
    }
    if (new Set([...discovered, ...collectIds]).size > maxDiscoveredTasks) throw new Error("MAX_DISCOVERED_TASKS_REACHED");
    try {
      collect(dataRoot, collectIds, options.force === true);
    } catch (error) {
      issues.push(`INPUT_PACK_COLLECTION_FAILED:${error instanceof Error ? error.message : String(error)}`);
    }
    const refreshedTaskPathIndex = indexTaskPackPaths(dataRoot);
    for (const taskId of collectIds) if (loadTask(dataRoot, taskId, refreshedTaskPathIndex)) collected.add(taskId);
  }
  if (!stabilized && rounds >= options.maxRounds) issues.push("MAX_AUTOFILL_ROUNDS_REACHED");
  const finalTaskPathIndex = indexTaskPackPaths(dataRoot);
  const taskIds = unique([...visited, options.taskId].filter((taskId) => loadTask(dataRoot, taskId, finalTaskPathIndex) !== null));
  return {
    taskIds,
    discoveredTaskIds: unique([...discovered]),
    collectedTaskIds: unique([...collected]),
    rounds,
    status: issues.length === 0 ? "COMPLETE" : "PARTIAL",
    issues: unique(issues),
  };
}
