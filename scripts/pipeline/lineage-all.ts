import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  openSync,
  closeSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  runInputPackMachineFacts,
  type InputPackMachineFactsRunResult,
} from "../machine-facts/input-pack-machine-facts.ts";
import {
  runInputPackClosure,
  type InputPackClosureOptions,
  type InputPackClosureResult,
} from "./input-pack-closure.ts";
import {
  DEFAULT_FIELD_LINEAGE_MAX_PATHS,
  DEFAULT_FIELD_LINEAGE_MAX_STATES,
  reconcileFieldLineage,
  type ReconcileFieldLineageOptions,
} from "../reconcile/consumer/field-lineage/field-lineage.ts";
import type { FactsPolicy, FieldLineageArtifact } from "../reconcile/consumer/field-lineage/field-lineage-contract.ts";
import {
  visualizeFieldLineage,
} from "../visualize/field-lineage-visualize.ts";
import {
  visualizeMultiHop,
} from "../visualize/multi-hop-visualize.ts";
import type { OneHopReconciliationResult } from "../reconcile/consumer/one-hop/reconcile-one-hop.ts";
import {
  reconcileOneHopBatch,
  type ReconcileOneHopOptions,
} from "../reconcile/consumer/one-hop/reconcile-one-hop.ts";
import { reconcileMultiHop } from "../reconcile/consumer/multi-hop/reconcile-multi-hop.ts";
import { pinTableProducerIndex } from "../reconcile/producer/producer-index.ts";
import { validateTaskDocument, type TaskDocument } from "../input/shared/input-pack.ts";

const SAFE_TASK_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const DEFAULT_MAX_DEPTH = 25;
const DEFAULT_MAX_ROUNDS = DEFAULT_MAX_DEPTH + 3;
const DEFAULT_MAX_TASKS = 1000;
const DEFAULT_MAX_EDGES = 10000;
const DEFAULT_MAX_DISCOVERED_TASKS = 5000;

export interface LineageAllOptions {
  readonly dataRoot: string;
  readonly taskIds: readonly string[];
  readonly artifactRoot?: string;
  /** Durable Machine Facts cache. Defaults to <dataRoot>/field-facts. */
  readonly factsRoot?: string;
  readonly withFields?: boolean;
  readonly fields?: readonly string[];
  readonly factsPolicy?: FactsPolicy;
  readonly terminalTableConfigPath?: string;
  readonly maxDepth?: number;
  readonly maxTasks?: number;
  readonly maxEdges?: number;
  readonly maxRounds?: number;
  readonly force?: boolean;
  readonly dependencies?: Partial<LineageAllDependencies>;
}

export interface LineageAllDependencies {
  readonly autofill: (options: InputPackClosureOptions) => InputPackClosureResult;
  readonly machineFacts: (options: Parameters<typeof runInputPackMachineFacts>[0]) => InputPackMachineFactsRunResult;
  readonly fieldLineage: (options: ReconcileFieldLineageOptions) => FieldLineageArtifact;
  readonly oneHopBatch: (taskIds: readonly string[], options: ReconcileOneHopOptions) => readonly OneHopReconciliationResult[];
  readonly multiHop: typeof reconcileMultiHop;
  readonly producerIndex: typeof pinTableProducerIndex;
  readonly visualizeMultiHop: typeof visualizeMultiHop;
  readonly visualizeFieldLineage: typeof visualizeFieldLineage;
}

export interface LineageAllTaskResult {
  readonly taskId: string;
  readonly status: "SUCCESS" | "FAILED";
  readonly artifactDir: string;
  readonly files: readonly string[];
  readonly error?: string;
}

export interface LineageAllResult {
  readonly dataRoot: string;
  readonly artifactRoot: string;
  readonly taskIds: readonly string[];
  readonly tasks: readonly LineageAllTaskResult[];
  readonly status: "SUCCESS" | "PARTIAL_FAILURE";
}

export interface ParsedLineageAllArgs extends LineageAllOptions {}

function dependencies(overrides: Partial<LineageAllDependencies> | undefined): LineageAllDependencies {
  return {
    autofill: runInputPackClosure,
    machineFacts: runInputPackMachineFacts,
    fieldLineage: reconcileFieldLineage,
    oneHopBatch: reconcileOneHopBatch,
    multiHop: reconcileMultiHop,
    producerIndex: pinTableProducerIndex,
    visualizeMultiHop,
    visualizeFieldLineage,
    ...overrides,
  };
}

function value(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  const result = index >= 0 ? args[index + 1] : undefined;
  return result && !result.startsWith("--") ? result : undefined;
}

function integer(args: readonly string[], name: string, fallback: number): number {
  const raw = value(args, name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${name.slice(2).toUpperCase().replaceAll("-", "_")}_INVALID`);
  return parsed;
}

export function parseLineageAllArgs(args: readonly string[]): ParsedLineageAllArgs {
  const dataRoot = value(args, "--data-root");
  const rawIds = [
    ...(value(args, "--task-ids") ?? "").split(","),
    ...args.flatMap((item, index) => item === "--task-id" && args[index + 1] ? args[index + 1]!.split(",") : []),
  ].map((item) => item.trim()).filter(Boolean);
  const taskIds = [...new Set(rawIds)];
  if (!dataRoot || taskIds.length === 0) throw new Error("usage: lineage:all --data-root <input-pack-root> --task-ids <id[,id...]> [--artifact-root <path>] [--with-fields]");
  const unknown = args.filter((item, index) => item.startsWith("--") && ![
    "--data-root", "--task-ids", "--task-id", "--artifact-root", "--facts-root", "--with-fields", "--fields", "--facts-policy",
    "--terminal-table-config", "--max-depth", "--max-tasks", "--max-edges", "--max-rounds", "--force",
  ].includes(item) && !(index > 0 && args[index - 1] === "--task-ids"));
  if (unknown.length > 0) throw new Error(`UNKNOWN_ARGUMENT:${unknown[0]}`);
  const factsPolicy = (value(args, "--facts-policy") ?? "current-only") as FactsPolicy;
  if (factsPolicy !== "current-only" && factsPolicy !== "allow-legacy-partial") throw new Error("FACTS_POLICY_INVALID");
  return {
    dataRoot,
    taskIds,
    artifactRoot: value(args, "--artifact-root"),
    factsRoot: value(args, "--facts-root"),
    withFields: args.includes("--with-fields"),
    fields: (value(args, "--fields") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
    factsPolicy,
    terminalTableConfigPath: value(args, "--terminal-table-config"),
    maxDepth: integer(args, "--max-depth", DEFAULT_MAX_DEPTH),
    maxTasks: integer(args, "--max-tasks", DEFAULT_MAX_TASKS),
    maxEdges: integer(args, "--max-edges", DEFAULT_MAX_EDGES),
    maxRounds: integer(args, "--max-rounds", DEFAULT_MAX_ROUNDS),
    force: args.includes("--force"),
  };
}

function isWithin(root: string, candidate: string): boolean {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`));
}

export function formalArtifactPaths(artifactRootInput: string, taskId: string): {
  readonly directory: string;
  readonly oneHop: string;
  readonly multiHop: string;
  readonly fieldLineage: string;
  readonly views: string;
  readonly tableHtml: string;
  readonly fieldHtml: string;
} {
  if (!SAFE_TASK_ID.test(taskId)) throw new Error("INVALID_TASK_ID");
  const directory = join(resolve(artifactRootInput), "tasks", taskId);
  return {
    directory,
    oneHop: join(directory, "one-hop.json"),
    multiHop: join(directory, "multi-hop.json"),
    fieldLineage: join(directory, "field-lineage.json"),
    views: join(directory, "views"),
    tableHtml: join(directory, "views", "table-lineage.html"),
    fieldHtml: join(directory, "views", "field-lineage.html"),
  };
}

function writeJson(path: string, valueToWrite: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(valueToWrite, null, 2)}\n`, "utf8");
}

function taskTarget(dataRoot: string, taskId: string): string {
  const tasksRoot = join(resolve(dataRoot), "tasks");
  const candidates: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === "task.json" && path.includes(`${sep}${taskId}${sep}`)) candidates.push(path);
    }
  };
  if (existsSync(tasksRoot)) visit(tasksRoot);
  if (candidates.length !== 1) throw new Error(candidates.length === 0 ? `TASK_INPUT_PACK_MISSING:${taskId}` : `TASK_INPUT_PACK_AMBIGUOUS:${taskId}`);
  const parsed: unknown = JSON.parse(readFileSync(candidates[0]!, "utf8"));
  validateTaskDocument(parsed);
  const target = (parsed as TaskDocument).target;
  const qualifiedName = typeof target === "object" && target !== null && !Array.isArray(target)
    ? (target as Record<string, unknown>).qualifiedName
    : undefined;
  if (typeof qualifiedName !== "string" || !qualifiedName.trim()) throw new Error(`TASK_TARGET_UNRESOLVED:${taskId}`);
  return qualifiedName.trim();
}

function taskCategoryIndex(dataRoot: string): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  const tasksRoot = join(resolve(dataRoot), "tasks");
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
        continue;
      }
      if (!entry.isFile() || entry.name !== "task.json") continue;
      try {
        const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
        const taskId = typeof parsed.taskId === "string" ? parsed.taskId : undefined;
        const category = typeof parsed.taskCategory === "string" ? parsed.taskCategory : undefined;
        if (taskId && category) result.set(taskId, category);
      } catch {
        // Invalid packs are handled by the normal Input Pack validation path.
      }
    }
  };
  if (existsSync(tasksRoot)) visit(tasksRoot);
  return result;
}

function checkDbFlagTaskIds(
  dataRoot: string,
  snapshots: readonly OneHopReconciliationResult[],
): ReadonlySet<string> {
  const categories = taskCategoryIndex(dataRoot);
  const result = new Set<string>();
  for (const snapshot of snapshots) {
    for (const parent of snapshot.schedule?.parents ?? []) {
      const category = categories.get(parent.taskId)?.toLowerCase();
      // Missing checkdbflag packs are scheduler-only nodes.  Horae names them
      // with the stable `checker.` prefix, which is the only classification
      // available before a metadata-only pack exists.
      if (category === "checkdbflag" || /^checker\./i.test(parent.taskName ?? ""))
        result.add(parent.taskId);
    }
  }
  return result;
}

function withoutCheckDbFlagParents(
  snapshot: OneHopReconciliationResult,
  checkDbFlagIds: ReadonlySet<string>,
): OneHopReconciliationResult {
  if (checkDbFlagIds.size === 0) return snapshot;
  const keep = (taskId: string): boolean => !checkDbFlagIds.has(taskId);
  return {
    ...snapshot,
    schedule: {
      ...snapshot.schedule,
      parents: snapshot.schedule.parents.filter((parent) => keep(parent.taskId)),
    },
    finalUpstreamTaskIds: {
      ...snapshot.finalUpstreamTaskIds,
      primary: snapshot.finalUpstreamTaskIds.primary.filter(keep),
      additional: snapshot.finalUpstreamTaskIds.additional.filter(keep),
      unknown: snapshot.finalUpstreamTaskIds.unknown.filter(keep),
    },
    dataPath: {
      ...snapshot.dataPath,
      confirmedProducers: snapshot.dataPath.confirmedProducers.filter((producer) => keep(producer.taskId)),
      readOccurrenceDecisions: snapshot.dataPath.readOccurrenceDecisions.map((decision) => ({
        ...decision,
        candidates: decision.candidates.filter((candidate) => keep(candidate.taskId)),
        primary: decision.primary.filter(keep),
        additional: decision.additional.filter(keep),
        unknown: decision.unknown.filter(keep),
      })),
    },
  };
}

function acquireLock(artifactRoot: string, taskId: string): string {
  const lockRoot = join(resolve(artifactRoot), ".locks");
  mkdirSync(lockRoot, { recursive: true });
  const path = join(lockRoot, `${taskId}.lock`);
  let fd: number | undefined;
  try {
    fd = openSync(path, "wx");
    writeFileSync(fd, `${process.pid}\n`, "utf8");
    closeSync(fd);
    return path;
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    throw new Error(`TASK_LOCK_UNAVAILABLE:${taskId}:${error instanceof Error ? error.message : String(error)}`);
  }
}

export function publishStagedTask(stagedDir: string, finalDir: string, artifactRoot: string): void {
  if (!isWithin(artifactRoot, stagedDir) || !isWithin(artifactRoot, finalDir)) throw new Error("ARTIFACT_PATH_OUTSIDE_ROOT");
  mkdirSync(dirname(finalDir), { recursive: true });
  const backup = `${finalDir}.previous-${randomUUID()}`;
  const hadFinal = existsSync(finalDir);
  if (hadFinal) {
    try {
      renameSync(finalDir, backup);
    } catch (error) {
      if (!isWindowsRenameBlocked(error)) throw error;
      publishStagedTaskInPlace(stagedDir, finalDir);
      return;
    }
  }
  try {
    renameSync(stagedDir, finalDir);
    if (hadFinal) rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (existsSync(finalDir)) rmSync(finalDir, { recursive: true, force: true });
    if (hadFinal && existsSync(backup)) renameSync(backup, finalDir);
    throw error;
  }
}

function isWindowsRenameBlocked(error: unknown): boolean {
  if (process.platform !== "win32" || typeof error !== "object" || error === null) return false;
  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
  return code === "EACCES" || code === "EBUSY" || code === "EPERM";
}

function relativeEntries(root: string, prefix = ""): string[] {
  const entries: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const relativePath = join(prefix, entry.name);
    entries.push(relativePath);
    if (entry.isDirectory()) entries.push(...relativeEntries(join(root, entry.name), relativePath));
  }
  return entries;
}

function publishStagedTaskInPlace(stagedDir: string, finalDir: string): void {
  const stagedPaths = relativeEntries(stagedDir);
  const stagedSet = new Set(stagedPaths);
  mkdirSync(finalDir, { recursive: true });

  for (const relativePath of stagedPaths.filter((path) => lstatSync(join(stagedDir, path)).isDirectory())) {
    const target = join(finalDir, relativePath);
    if (existsSync(target) && !lstatSync(target).isDirectory()) rmSync(target, { force: true });
    mkdirSync(target, { recursive: true });
  }
  for (const relativePath of stagedPaths.filter((path) => !lstatSync(join(stagedDir, path)).isDirectory())) {
    const source = join(stagedDir, relativePath);
    const target = join(finalDir, relativePath);
    if (existsSync(target) && lstatSync(target).isDirectory()) rmSync(target, { recursive: true, force: true });
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }

  const stalePaths = relativeEntries(finalDir)
    .filter((path) => !stagedSet.has(path))
    .sort((left, right) => right.split(sep).length - left.split(sep).length);
  for (const relativePath of stalePaths) rmSync(join(finalDir, relativePath), { recursive: true, force: true });
  rmSync(stagedDir, { recursive: true, force: true });
}

function runTask(options: LineageAllOptions, taskId: string, artifactRoot: string, deps: LineageAllDependencies): LineageAllTaskResult {
  const paths = formalArtifactPaths(artifactRoot, taskId);
  const lock = acquireLock(artifactRoot, taskId);
  const stagingRoot = join(resolve(artifactRoot), ".staging");
  mkdirSync(stagingRoot, { recursive: true });
  const stagedDir = mkdtempSync(join(stagingRoot, `${taskId}-`));
  try {
    // Closure is deliberately separate from formal One-hop/Multi-hop stages;
    // it only expands the local Input Pack before the fingerprint is pinned.
    const autofill = deps.autofill({
      taskId,
      dataRoot: resolve(options.dataRoot),
      producerIndexCacheRoot: `${resolve(options.dataRoot)}.producer-index-cache`,
      maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
      maxTasks: options.maxTasks ?? DEFAULT_MAX_TASKS,
      maxRounds: options.maxRounds ?? DEFAULT_MAX_ROUNDS,
      maxDiscoveryTables: 1000,
      maxDiscoveredTasks: DEFAULT_MAX_DISCOVERED_TASKS,
      force: options.force,
    });
    if (autofill.status !== "COMPLETE") throw new Error(`INPUT_PACK_CLOSURE_PARTIAL:${autofill.issues.join(";")}`);
    const producerCacheRoot = `${resolve(options.dataRoot)}.producer-index-cache`;
    // Pin the post-autofill Input Pack fingerprint before any downstream
    // stage. Machine Facts and One-hop must consume this same frozen index.
    const producer = deps.producerIndex(resolve(options.dataRoot), producerCacheRoot).index;
    const factsRoot = resolve(options.factsRoot ?? join(options.dataRoot, "field-facts"));
    const taskNodeIds = [...new Set(autofill.taskIds)];
    const facts = deps.machineFacts({ dataRoot: resolve(options.dataRoot), taskIds: taskNodeIds, outputRoot: factsRoot, indexMode: "incremental" });
    const failedFacts = facts.tasks.filter((task) => task.status === "FAILED" || task.state === "FAILED");
    if (failedFacts.length > 0) throw new Error(`MACHINE_FACTS_FAILED:${failedFacts.map((task) => task.task_id).join(",")}`);
    const rawOneHopSnapshots = new Map<string, OneHopReconciliationResult>();
    const oneHopResults = deps.oneHopBatch(taskNodeIds, {
      dataRoot: resolve(options.dataRoot),
      producerIndex: producer,
      verifyInputFingerprint: true,
    });
    const checkDbFlagIds = checkDbFlagTaskIds(resolve(options.dataRoot), oneHopResults);
    for (const result of oneHopResults) rawOneHopSnapshots.set(result.taskId, result);
    const oneHopSnapshots = new Map<string, OneHopReconciliationResult>();
    for (const result of oneHopResults)
      oneHopSnapshots.set(result.taskId, withoutCheckDbFlagParents(result, checkDbFlagIds));
    const rawRootOneHop = rawOneHopSnapshots.get(taskId);
    const rootOneHop = oneHopSnapshots.get(taskId);
    if (!rawRootOneHop || !rootOneHop) throw new Error(`ROOT_ONE_HOP_SNAPSHOT_MISSING:${taskId}`);
    const formalMultiHop = deps.multiHop(taskId, {
      dataRoot: resolve(options.dataRoot),
      producerIndex: producer,
      maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
      maxTasks: options.maxTasks ?? DEFAULT_MAX_TASKS,
      maxEdges: options.maxEdges ?? DEFAULT_MAX_EDGES,
      rootOneHop,
      oneHopSnapshots,
    });
    const multiHopPath = join(stagedDir, "multi-hop.json");
    const oneHopPath = join(stagedDir, "one-hop.json");
    writeJson(oneHopPath, rawRootOneHop);
    writeJson(multiHopPath, formalMultiHop);
    const files = ["one-hop.json", "multi-hop.json"];
    const tableHtml = join(stagedDir, "views", "table-lineage.html");
    deps.visualizeMultiHop({ taskId, artifactPath: multiHopPath, outputPath: tableHtml, vizModelPath: join(stagedDir, "viz-model.json") });
    if (existsSync(join(stagedDir, "viz-model.json"))) rmSync(join(stagedDir, "viz-model.json"), { force: true });
    files.push("views/table-lineage.html");
    if (options.withFields) {
      const fieldArtifact = deps.fieldLineage({
        dataRoot: resolve(options.dataRoot),
        factsRoot,
        tableLineage: formalMultiHop,
        rootTaskId: taskId,
        rootTable: taskTarget(options.dataRoot, taskId),
        rootFields: options.fields ?? [],
        factsPolicy: options.factsPolicy ?? "current-only",
        maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
        maxStates: DEFAULT_FIELD_LINEAGE_MAX_STATES,
        maxPaths: DEFAULT_FIELD_LINEAGE_MAX_PATHS,
      });
      const fieldPath = join(stagedDir, "field-lineage.json");
      writeJson(fieldPath, fieldArtifact);
      const fieldHtml = join(stagedDir, "views", "field-lineage.html");
      deps.visualizeFieldLineage({ artifactPath: fieldPath, outputPath: fieldHtml, factsRoot });
      files.push("field-lineage.json", "views/field-lineage.html");
    }
    publishStagedTask(stagedDir, paths.directory, artifactRoot);
    return { taskId, status: "SUCCESS", artifactDir: paths.directory, files };
  } catch (error) {
    if (existsSync(stagedDir)) rmSync(stagedDir, { recursive: true, force: true });
    return { taskId, status: "FAILED", artifactDir: paths.directory, files: [], error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (existsSync(lock)) rmSync(lock, { force: true });
  }
}

export function runLineageAll(options: LineageAllOptions): LineageAllResult {
  const dataRoot = resolve(options.dataRoot);
  const artifactRoot = resolve(options.artifactRoot ?? join(dataRoot, "artifacts"));
  if (!existsSync(join(dataRoot, "tasks")) || !existsSync(join(dataRoot, "tables"))) throw new Error("INPUT_PACK_ROOT_INCOMPLETE");
  const deps = dependencies(options.dependencies);
  const taskIds = [...new Set(options.taskIds.map((item) => item.trim()).filter(Boolean))].sort();
  for (const taskId of taskIds) if (!SAFE_TASK_ID.test(taskId)) throw new Error(`INVALID_TASK_ID:${taskId}`);
  const tasks = taskIds.map((taskId) => runTask({ ...options, dataRoot }, taskId, artifactRoot, deps));
  for (const internalDir of [join(artifactRoot, ".staging"), join(artifactRoot, ".locks")]) {
    if (existsSync(internalDir) && readdirSync(internalDir).length === 0) rmSync(internalDir, { recursive: true, force: true });
  }
  return { dataRoot, artifactRoot, taskIds, tasks, status: tasks.every((task) => task.status === "SUCCESS") ? "SUCCESS" : "PARTIAL_FAILURE" };
}

function main(): void {
  try {
    const result = runLineageAll(parseLineageAllArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status !== "SUCCESS") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
