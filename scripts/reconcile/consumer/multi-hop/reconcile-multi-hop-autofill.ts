import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadTableProducerIndex,
  loadTableProducerInputManifest,
  updateTableProducerIndex,
  type TableProducerIndex,
} from "../../producer/producer-index.ts";
import {
  defaultOpenCliRunner,
  prepareOneHopContext,
  reconcileOneHopWithPreparedContext,
  type OneHopReconciliationResult,
  type OpenCliRunner,
} from "../one-hop/reconcile-one-hop.ts";
import { runCollector } from "../one-hop/reconcile-one-hop-autofill.ts";
import {
  reconcileMultiHop,
  type MultiHopReconciliationResult,
} from "./reconcile-multi-hop.ts";
import {
  loadTerminalTableConfig,
  matchingTerminalRole,
  type TerminalTableConfig,
} from "./terminal-table-config.ts";

type JsonRecord = Record<string, unknown>;

export interface MultiHopAutofillOptions {
  readonly taskId: string;
  readonly dataRoot: string;
  readonly producerIndexPath: string;
  readonly outputPath?: string;
  readonly reportPath?: string;
  readonly terminalTableConfigPath: string;
  readonly maxDepth: number;
  readonly maxTasks: number;
  readonly maxEdges: number;
  readonly maxRounds?: number;
  readonly maxDiscoveryTables?: number;
  readonly maxDiscoveredTasks?: number;
  readonly discoveryMinIntervalMs?: number;
  readonly discoveryAttempts?: number;
  readonly force?: boolean;
  readonly trustExistingIndex?: boolean;
  readonly now?: () => string;
  readonly openCliRunner?: OpenCliRunner;
  readonly collectTaskPacks?: (
    dataRoot: string,
    taskIds: readonly string[],
    force: boolean,
  ) => void;
  readonly sleep?: (milliseconds: number) => void;
}

export interface MultiHopAutofillReport {
  readonly schemaVersion: "1.0.0";
  readonly artifactType: "MULTI_HOP_AUTOFILL_REPORT";
  readonly rootTaskId: string;
  readonly generatedAt: string;
  readonly status: "COMPLETE" | "PARTIAL";
  readonly rounds: number;
  readonly queriedTables: readonly string[];
  readonly discoveredTaskIds: readonly string[];
  readonly collectedTaskIds: readonly string[];
  readonly issues: readonly string[];
  readonly producerIndexContentHash: string;
  readonly initialIndexMode: "STRICT_UPDATE" | "TRUSTED_EXISTING_FROZEN_INPUT";
}

export interface MultiHopAutofillResult {
  readonly artifact: MultiHopReconciliationResult;
  readonly report: MultiHopAutofillReport;
}

const SAFE_TASK_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function rowsOf(value: unknown): JsonRecord[] {
  if (Array.isArray(value))
    return value.map(asRecord).filter((item): item is JsonRecord => item !== null);
  const root = asRecord(value);
  if (!root) return [];
  for (const key of ["results", "rows", "data", "items"]) {
    const rows = root[key];
    if (Array.isArray(rows))
      return rows.map(asRecord).filter((item): item is JsonRecord => item !== null);
  }
  return [root];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "zh-Hans", {
    numeric: true,
    sensitivity: "base",
  });
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort(compareText);
}

function tableKey(table: {
  readonly platform?: string | null;
  readonly dataSource?: string | null;
  readonly qualifiedName: string;
}): string {
  return [table.platform ?? "", table.dataSource ?? "", table.qualifiedName]
    .map((item) => item.toLocaleLowerCase("en-US"))
    .join("|");
}

function tableParts(qualifiedName: string): { db: string; table: string } | null {
  const separator = qualifiedName.indexOf(".");
  if (separator <= 0 || separator === qualifiedName.length - 1) return null;
  return {
    db: qualifiedName.slice(0, separator),
    table: qualifiedName.slice(separator + 1),
  };
}

function taskPackExists(dataRoot: string, taskId: string): boolean {
  const tasksRoot = join(dataRoot, "tasks");
  if (!existsSync(tasksRoot)) return false;
  return readdirSync(tasksRoot, { withFileTypes: true }).some(
    (entry) =>
      entry.isDirectory() &&
      existsSync(join(tasksRoot, entry.name, taskId, "task.json")),
  );
}

function confirmedProducerTableKeys(index: TableProducerIndex): Set<string> {
  return new Set(index.confirmedProducerEdges.map((edge) => tableKey(edge.table)));
}

export function producerTaskIdsFromTableResponse(value: unknown): string[] {
  return unique(
    rowsOf(value).flatMap((row) => {
      const tasks = Array.isArray(row.tasks) ? row.tasks : [];
      return tasks
        .map((item) => asRecord(item))
        .map((item) => text(item?.taskId ?? item?.task_id))
        .filter((taskId) => SAFE_TASK_ID.test(taskId));
    }),
  );
}

function defaultSleep(milliseconds: number): void {
  if (milliseconds <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function retryableDiscoveryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /限流|429|timeout|timed out|mcp_tool_error/i.test(message);
}

function writeJson(pathInput: string | undefined, value: unknown): void {
  if (!pathInput) return;
  const path = isAbsolute(pathInput) ? pathInput : resolve(pathInput);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function requirePositiveInteger(value: number, field: string, allowZero = false): void {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1))
    throw new Error(`${field.toUpperCase()}_INVALID`);
}

function scheduleRows(
  taskId: string,
  runner: OpenCliRunner,
): readonly JsonRecord[] {
  return rowsOf(
    runner([
      "horae",
      "relation",
      taskId,
      "--direction",
      "up",
      "--depth",
      "1",
      "--window",
      "background",
      "-f",
      "json",
    ]),
  );
}

function queryProducerTaskIds(
  qualifiedName: string,
  runner: OpenCliRunner,
  attempts: number,
  sleep: (milliseconds: number) => void,
): string[] {
  const parts = tableParts(qualifiedName);
  if (!parts) throw new Error(`TABLE_QUALIFIED_NAME_INVALID:${qualifiedName}`);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return producerTaskIdsFromTableResponse(
        runner([
          "szdata",
          "table",
          "--db",
          parts.db,
          "--table",
          parts.table,
          "--view",
          "full",
          "-f",
          "json",
        ]),
      );
    } catch (error) {
      lastError = error;
      if (!retryableDiscoveryError(error) || attempt === attempts) break;
      sleep(attempt * 2_000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function missingScheduleTaskIds(result: OneHopReconciliationResult): string[] {
  return unique(
    result.issueDetails
      .filter((issue) => issue.code === "TASK_INPUT_PACK_MISSING")
      .map((issue) => issue.taskId ?? ""),
  );
}

function nextPrimaryTaskIds(result: OneHopReconciliationResult): string[] {
  const unknown = new Set(result.partitionAwareNextDataTaskIds.unknown);
  return result.finalUpstreamTaskIds.primary.filter((taskId) => !unknown.has(taskId));
}

export function runMultiHopAutofill(
  options: MultiHopAutofillOptions,
): MultiHopAutofillResult {
  if (!SAFE_TASK_ID.test(options.taskId)) throw new Error("INVALID_TASK_ID");
  requirePositiveInteger(options.maxDepth, "maxDepth");
  requirePositiveInteger(options.maxTasks, "maxTasks");
  requirePositiveInteger(options.maxEdges, "maxEdges");
  const maxRounds = options.maxRounds ?? options.maxDepth + 3;
  const maxDiscoveryTables = options.maxDiscoveryTables ?? 200;
  const maxDiscoveredTasks = options.maxDiscoveredTasks ?? 500;
  const discoveryMinIntervalMs = options.discoveryMinIntervalMs ?? 1_000;
  const discoveryAttempts = options.discoveryAttempts ?? 3;
  requirePositiveInteger(maxRounds, "maxRounds");
  requirePositiveInteger(maxDiscoveryTables, "maxDiscoveryTables");
  requirePositiveInteger(maxDiscoveredTasks, "maxDiscoveredTasks");
  requirePositiveInteger(discoveryMinIntervalMs, "discoveryMinIntervalMs", true);
  requirePositiveInteger(discoveryAttempts, "discoveryAttempts");

  const dataRoot = resolve(options.dataRoot);
  const producerIndexPath = resolve(options.producerIndexPath);
  const manifestPath = `${producerIndexPath}.manifest.json`;
  const terminalConfig: TerminalTableConfig = loadTerminalTableConfig(
    resolve(options.terminalTableConfigPath),
  );
  const runner =
    options.openCliRunner ?? ((args) => defaultOpenCliRunner(args, 30_000));
  const collect = options.collectTaskPacks ?? runCollector;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? (() => new Date().toISOString());
  const queriedTables = new Set<string>();
  const queriedTableNames = new Set<string>();
  const discoveredTaskIds = new Set<string>();
  const collectedTaskIds = new Set<string>();
  const attemptedTaskIds = new Set<string>();
  const issues: string[] = [];
  const scheduleCache = new Map<string, readonly JsonRecord[]>();
  let lastTableQueryAt = 0;
  let rounds = 0;
  let stabilized = false;
  let finalSnapshots = new Map<string, OneHopReconciliationResult>();

  let producerIndex: TableProducerIndex;
  if (options.trustExistingIndex === true) {
    if (!existsSync(producerIndexPath) || !existsSync(manifestPath))
      throw new Error("TRUSTED_EXISTING_INDEX_OR_MANIFEST_MISSING");
    producerIndex = loadTableProducerIndex(producerIndexPath);
    const manifest = loadTableProducerInputManifest(manifestPath);
    if (manifest.inputFingerprint !== producerIndex.inputFingerprint)
      throw new Error("TRUSTED_EXISTING_INDEX_MANIFEST_MISMATCH");
  } else {
    producerIndex = updateTableProducerIndex(
      dataRoot,
      producerIndexPath,
      manifestPath,
      { now },
    ).index;
  }

  while (rounds < maxRounds) {
    rounds += 1;
    const context = prepareOneHopContext(dataRoot, {
      includeFingerprint: false,
      trustedInputFingerprint: producerIndex.inputFingerprint,
      schemaLoading: "TASK_SCOPED",
    });
    const producerTables = confirmedProducerTableKeys(producerIndex);
    const snapshots = new Map<string, OneHopReconciliationResult>();
    const pendingTaskIds = new Set<string>();
    const frontier: Array<{ taskId: string; depth: number }> = [
      { taskId: options.taskId, depth: 0 },
    ];
    const visited = new Set<string>();

    while (frontier.length > 0) {
      frontier.sort(
        (left, right) =>
          left.depth - right.depth || compareText(left.taskId, right.taskId),
      );
      const current = frontier.shift()!;
      if (visited.has(current.taskId) || current.depth >= options.maxDepth) continue;
      if (visited.size >= options.maxTasks) throw new Error("MAX_TASKS_REACHED");
      visited.add(current.taskId);
      const frozenSchedule =
        scheduleCache.get(current.taskId) ?? scheduleRows(current.taskId, runner);
      scheduleCache.set(current.taskId, frozenSchedule);
      const oneHop = reconcileOneHopWithPreparedContext(
        current.taskId,
        {
          dataRoot,
          producerIndex,
          verifyInputFingerprint: true,
          scheduleRows: frozenSchedule,
          now,
        },
        context,
      );
      snapshots.set(current.taskId, oneHop);

      for (const taskId of missingScheduleTaskIds(oneHop)) {
        discoveredTaskIds.add(taskId);
        if (
          !taskPackExists(dataRoot, taskId) &&
          !attemptedTaskIds.has(taskId)
        )
          pendingTaskIds.add(taskId);
      }

      for (const read of oneHop.currentTask.directReads) {
        const qualifiedName = read.table.qualifiedName;
        if (
          read.table.identityStatus !== "RESOLVED" ||
          !read.table.platform ||
          !read.table.dataSource ||
          !qualifiedName ||
          matchingTerminalRole(terminalConfig, qualifiedName)
        )
          continue;
        const key = tableKey({ ...read.table, qualifiedName });
        if (producerTables.has(key) || queriedTables.has(key)) continue;
        if (queriedTables.size >= maxDiscoveryTables)
          throw new Error("MAX_DISCOVERY_TABLES_REACHED");
        const remaining =
          discoveryMinIntervalMs - (Date.now() - lastTableQueryAt);
        if (remaining > 0) sleep(remaining);
        lastTableQueryAt = Date.now();
        queriedTables.add(key);
        queriedTableNames.add(qualifiedName);
        try {
          const taskIds = queryProducerTaskIds(
            qualifiedName,
            runner,
            discoveryAttempts,
            sleep,
          );
          if (taskIds.length === 0)
            issues.push(
              `TABLE_PRODUCER_TASK_NOT_OBSERVED:${qualifiedName}`,
            );
          for (const taskId of taskIds) {
            discoveredTaskIds.add(taskId);
            if (
              !taskPackExists(dataRoot, taskId) &&
              !attemptedTaskIds.has(taskId)
            )
              pendingTaskIds.add(taskId);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          issues.push(`TABLE_PRODUCER_DISCOVERY_FAILED:${qualifiedName}:${message}`);
        }
      }

      for (const nextTaskId of nextPrimaryTaskIds(oneHop))
        frontier.push({ taskId: nextTaskId, depth: current.depth + 1 });
    }

    finalSnapshots = snapshots;
    const collectIds = unique([...pendingTaskIds]);
    if (collectIds.length === 0) {
      stabilized = true;
      break;
    }
    if (new Set([...discoveredTaskIds, ...collectIds]).size > maxDiscoveredTasks)
      throw new Error("MAX_DISCOVERED_TASKS_REACHED");
    collect(dataRoot, collectIds, options.force === true);
    for (const taskId of collectIds) {
      attemptedTaskIds.add(taskId);
      if (taskPackExists(dataRoot, taskId)) collectedTaskIds.add(taskId);
      else issues.push(`DISCOVERED_TASK_PACK_UNAVAILABLE:${taskId}`);
    }
    producerIndex = updateTableProducerIndex(
      dataRoot,
      producerIndexPath,
      manifestPath,
      { now },
    ).index;
  }

  if (!stabilized) throw new Error("MAX_AUTOFILL_ROUNDS_REACHED");
  const rootOneHop = finalSnapshots.get(options.taskId);
  if (!rootOneHop) throw new Error("ROOT_ONE_HOP_SNAPSHOT_MISSING");
  const artifact = reconcileMultiHop(options.taskId, {
    dataRoot,
    producerIndex,
    maxDepth: options.maxDepth,
    maxTasks: options.maxTasks,
    maxEdges: options.maxEdges,
    now,
    rootOneHop,
    oneHopSnapshots: finalSnapshots,
    terminalTableConfig: terminalConfig,
  });
  const report: MultiHopAutofillReport = {
    schemaVersion: "1.0.0",
    artifactType: "MULTI_HOP_AUTOFILL_REPORT",
    rootTaskId: options.taskId,
    generatedAt: now(),
    status: issues.length === 0 ? "COMPLETE" : "PARTIAL",
    rounds,
    queriedTables: unique([...queriedTableNames]),
    discoveredTaskIds: unique([...discoveredTaskIds]),
    collectedTaskIds: unique([...collectedTaskIds]),
    issues: unique(issues),
    producerIndexContentHash: producerIndex.contentHash,
    initialIndexMode:
      options.trustExistingIndex === true
        ? "TRUSTED_EXISTING_FROZEN_INPUT"
        : "STRICT_UPDATE",
  };
  writeJson(options.outputPath, artifact);
  writeJson(options.reportPath, report);
  return { artifact, report };
}

interface CliOptions {
  readonly taskId: string;
  readonly dataRoot: string;
  readonly producerIndexPath: string;
  readonly outputPath?: string;
  readonly reportPath?: string;
  readonly terminalTableConfigPath: string;
  readonly maxDepth: number;
  readonly maxTasks: number;
  readonly maxEdges: number;
  readonly maxRounds: number;
  readonly maxDiscoveryTables: number;
  readonly maxDiscoveredTasks: number;
  readonly force: boolean;
  readonly trustExistingIndex: boolean;
}

function parseCli(args: readonly string[]): CliOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const valueNames = new Set([
    "--task-id",
    "--data-root",
    "--producer-index",
    "--output",
    "--report",
    "--terminal-table-config",
    "--max-depth",
    "--max-tasks",
    "--max-edges",
    "--max-rounds",
    "--max-discovery-tables",
    "--max-discovered-tasks",
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--force" || argument === "--trust-existing-index") {
      flags.add(argument);
      continue;
    }
    if (!valueNames.has(argument)) throw new Error(`UNKNOWN_ARGUMENT:${argument}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`VALUE_REQUIRED:${argument}`);
    values.set(argument, value);
    index += 1;
  }
  const required = (name: string): string => {
    const value = values.get(name);
    if (!value) throw new Error(`${name.slice(2).toUpperCase()}_REQUIRED`);
    return value;
  };
  const integer = (name: string, fallback: number): number => {
    const value = values.get(name);
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed))
      throw new Error(`${name.slice(2).toUpperCase()}_INVALID`);
    return parsed;
  };
  return {
    taskId: required("--task-id"),
    dataRoot: required("--data-root"),
    producerIndexPath: required("--producer-index"),
    outputPath: values.get("--output"),
    reportPath: values.get("--report"),
    terminalTableConfigPath:
      values.get("--terminal-table-config") ??
      "config/multi-hop-terminal-table-rules.json",
    maxDepth: integer("--max-depth", 3),
    maxTasks: integer("--max-tasks", 100),
    maxEdges: integer("--max-edges", 500),
    maxRounds: integer("--max-rounds", 6),
    maxDiscoveryTables: integer("--max-discovery-tables", 200),
    maxDiscoveredTasks: integer("--max-discovered-tasks", 500),
    force: flags.has("--force"),
    trustExistingIndex: flags.has("--trust-existing-index"),
  };
}

function main(): void {
  const cli = parseCli(process.argv.slice(2));
  const result = runMultiHopAutofill(cli);
  process.stdout.write(
    `${JSON.stringify({
      taskId: cli.taskId,
      output: cli.outputPath ? resolve(cli.outputPath) : null,
      report: cli.reportPath ? resolve(cli.reportPath) : null,
      status: result.report.status,
      rounds: result.report.rounds,
      queriedTables: result.report.queriedTables.length,
      discoveredTaskIds: result.report.discoveredTaskIds.length,
      collectedTaskIds: result.report.collectedTaskIds.length,
      counts: result.artifact.counts,
    })}\n`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
)
  main();
