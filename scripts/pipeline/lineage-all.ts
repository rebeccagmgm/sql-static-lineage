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
import { dirname, join, resolve, relative, sep, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

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
  defaultOpenCliRunner,
  type ReconcileOneHopOptions,
} from "../reconcile/consumer/one-hop/reconcile-one-hop.ts";
import { runCollector } from "../reconcile/consumer/one-hop/reconcile-one-hop-autofill.ts";
import { reconcileMultiHop } from "../reconcile/consumer/multi-hop/reconcile-multi-hop.ts";
import { queryProducerTaskIds } from "../reconcile/consumer/multi-hop/reconcile-multi-hop-autofill.ts";
import { loadTableProducerIndex, pinTableProducerIndex, fingerprintTableProducerInputs } from "../reconcile/producer/producer-index.ts";
import { validateTaskDocument, type TaskDocument } from "../input/shared/input-pack.ts";

const SAFE_TASK_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const DEFAULT_MAX_DEPTH = 25;
const DEFAULT_MAX_ROUNDS = DEFAULT_MAX_DEPTH + 3;
const DEFAULT_MAX_TASKS = 1000;
const DEFAULT_MAX_EDGES = 10000;
const DEFAULT_MAX_DISCOVERED_TASKS = 5000;
const DEFAULT_HORAE_PREFETCH_CONCURRENCY = 4;
const DEFAULT_HORAE_PREFETCH_MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const DEFAULT_FIELD_PRODUCER_DISCOVERY_ATTEMPTS = 3;
const execFileAsync = promisify(execFile);

export interface PrefetchedScheduleEvidence {
  readonly rows: readonly Record<string, unknown>[];
  readonly provider: "opencli:horae.relation";
  readonly locator: string;
  readonly observedAt: string;
}

function defaultSleep(milliseconds: number): void {
  if (milliseconds <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function defaultFieldProducerDiscovery(qualifiedName: string): readonly string[] {
  return queryProducerTaskIds(
    qualifiedName,
    defaultOpenCliRunner,
    DEFAULT_FIELD_PRODUCER_DISCOVERY_ATTEMPTS,
    defaultSleep,
  );
}

function fieldSourceTablesMissingProducerBridge(
  fieldArtifact: FieldLineageArtifact,
  tableLineage: ReturnType<typeof reconcileMultiHop>,
): readonly string[] {
  const bridgedTables = new Set(
    (Array.isArray(tableLineage.producerBridges) ? tableLineage.producerBridges : []).map((bridge) => {
      const table = bridge.table?.qualifiedName?.trim().toLocaleLowerCase("en-US") ?? "";
      return `${bridge.consumerTaskId}\u0000${table}`;
    }),
  );
  return [...new Set(
    (Array.isArray(fieldArtifact.nodes) ? fieldArtifact.nodes : [])
      .filter(
        (node) =>
          node.bindingId === null &&
          node.expressionId === null &&
          node.field.identityStatus === "SCHEMA_BACKED" &&
          node.field.platform.toLocaleLowerCase("en-US") === "hive" &&
          !bridgedTables.has(
            `${node.taskId}\u0000${node.field.qualifiedName.toLocaleLowerCase("en-US")}`,
          ),
      )
      .map((node) => node.field.qualifiedName),
  )].sort((left, right) => left.localeCompare(right, "en-US"));
}

export interface HoraePrefetchOptions {
  readonly concurrency?: number;
  readonly run?: (args: readonly string[]) => Promise<unknown>;
  readonly now?: () => string;
  readonly maxRowsPerTask?: number;
  readonly maxTotalRows?: number;
  readonly maxTotalBytes?: number;
}

function rowsOfHorae(value: unknown, taskId: string): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map((row) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) throw new Error(`HORAE_RELATION_PREFETCH_INVALID_ROWS:${taskId}`);
    const record = row as Record<string, unknown>;
    const rowTask = record.task_id ?? record.taskId;
    if (typeof rowTask !== "string" || !SAFE_TASK_ID.test(rowTask)) throw new Error(`HORAE_RELATION_PREFETCH_INVALID_ROWS:${taskId}`);
    return record;
  });
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`HORAE_RELATION_PREFETCH_INVALID_ENVELOPE:${taskId}`);
  const record = value as Record<string, unknown>;
  if (record.error !== undefined || record.success === false || ["fail", "failed", "failure", "error"].includes(String(record.status ?? "").toLowerCase())) throw new Error(`HORAE_RELATION_PREFETCH_INVALID_ENVELOPE:${taskId}`);
  for (const field of ["records", "rows", "data", "results"]) {
    if (Array.isArray(record[field])) return rowsOfHorae(record[field], taskId);
  }
  throw new Error(`HORAE_RELATION_PREFETCH_INVALID_ENVELOPE:${taskId}`);
}

async function defaultHoraeRunner(args: readonly string[]): Promise<unknown> {
  const appData = process.env.APPDATA;
  const packageRoot = appData ? resolve(appData, "npm", "node_modules", "@jackwener", "opencli") : "";
  const entry = packageRoot ? resolve(packageRoot, "dist", "src", "main.js") : "";
  if (process.platform === "win32" && (!appData || !isAbsolute(entry) || !entry.startsWith(`${packageRoot}${sep}`) || !existsSync(entry))) throw new Error("LAUNCHER_UNAVAILABLE");
  const executable = process.platform === "win32" ? process.execPath : (process.env.OPENCLI_EXECUTABLE ?? "opencli");
  const executableArgs = process.platform === "win32" ? [entry, ...args] : [...args];
  try {
    const { stdout } = await execFileAsync(executable, executableArgs, { cwd: process.cwd(), timeout: 90_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
    try { return JSON.parse(stdout.trim()) as unknown; } catch { throw new Error("INVALID_JSON"); }
  } catch (error) {
    if (error instanceof Error && ["INVALID_JSON", "LAUNCHER_UNAVAILABLE"].includes(error.message)) throw error;
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (code === "ETIMEDOUT") throw new Error("TIMEOUT");
    if (code.includes("MAXBUFFER")) throw new Error("OUTPUT_LIMIT");
    throw new Error("RUNNER_FAILED");
  }
}

export async function prefetchHoraeRelations(taskIds: readonly string[], options: HoraePrefetchOptions = {}): Promise<ReadonlyMap<string, PrefetchedScheduleEvidence>> {
  const concurrency = options.concurrency ?? DEFAULT_HORAE_PREFETCH_CONCURRENCY;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error("HORAE_PREFETCH_CONCURRENCY_INVALID");
  const run = options.run ?? defaultHoraeRunner;
  const now = options.now ?? (() => new Date().toISOString());
  const maxRowsPerTask = options.maxRowsPerTask ?? 10_000;
  const maxTotalRows = options.maxTotalRows ?? 100_000;
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_HORAE_PREFETCH_MAX_TOTAL_BYTES;
  if (![maxRowsPerTask, maxTotalRows, maxTotalBytes].every((value) => Number.isSafeInteger(value) && value > 0)) throw new Error("HORAE_PREFETCH_BUDGET_INVALID");
  const result = new Map<string, PrefetchedScheduleEvidence>();
  let cursor = 0;
  let stopped = false;
  let totalRows = 0;
  let totalBytes = 0;
  const worker = async (): Promise<void> => {
    while (!stopped) {
      const index = cursor++;
      if (index >= taskIds.length) return;
      const taskId = taskIds[index]!;
      if (!SAFE_TASK_ID.test(taskId)) { stopped = true; throw new Error(`HORAE_RELATION_PREFETCH_INVALID_TASK:${taskId}`); }
      const args = ["horae", "relation", taskId, "--direction", "up", "--depth", "1", "-f", "json"];
      const started = now();
      try {
        const parsed = await run(args);
        const rows = rowsOfHorae(parsed, taskId);
        if (rows.length > maxRowsPerTask) throw new Error(`OUTPUT_LIMIT:${taskId}`);
        totalRows += rows.length;
        if (totalRows > maxTotalRows) throw new Error(`OUTPUT_LIMIT:${taskId}`);
        totalBytes += new TextEncoder().encode(JSON.stringify(rows)).byteLength;
        if (totalBytes > maxTotalBytes) throw new Error(`OUTPUT_LIMIT:${taskId}`);
        result.set(taskId, { rows, provider: "opencli:horae.relation", locator: `opencli ${args.join(" ")}`, observedAt: started });
      } catch (error) {
        stopped = true;
        const reason = error instanceof Error && /(?:^|_)(TIMEOUT|LAUNCHER_UNAVAILABLE|INVALID_JSON|INVALID_ENVELOPE|INVALID_ROWS|OUTPUT_LIMIT|RUNNER_FAILED)(?::|$)/.test(error.message) ? error.message.match(/(TIMEOUT|LAUNCHER_UNAVAILABLE|INVALID_JSON|INVALID_ENVELOPE|INVALID_ROWS|OUTPUT_LIMIT|RUNNER_FAILED)/)![1]! : "RUNNER_FAILED";
        throw new Error(`HORAE_RELATION_PREFETCH_${reason}:${taskId}`);
      }
    }
  };
  const settled = await Promise.allSettled(Array.from({ length: Math.min(concurrency, taskIds.length) }, () => worker()));
  const failed = settled.find((item): item is PromiseRejectedResult => item.status === "rejected");
  if (failed) throw failed.reason;
  return result;
}

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
  readonly loadProducerIndex: typeof loadTableProducerIndex;
  readonly fingerprintInput: typeof fingerprintTableProducerInputs;
  readonly collectTaskPacks: (dataRoot: string, taskIds: readonly string[], force: boolean) => void;
  readonly fieldProducerDiscovery: (qualifiedName: string) => readonly string[];
  readonly schedulePrefetch: (taskIds: readonly string[]) => Promise<ReadonlyMap<string, PrefetchedScheduleEvidence>>;
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
    loadProducerIndex: loadTableProducerIndex,
    fingerprintInput: fingerprintTableProducerInputs,
    collectTaskPacks: runCollector,
    fieldProducerDiscovery: defaultFieldProducerDiscovery,
    // Dependency-injected test pipelines must not reach OpenCLI implicitly;
    // production (no overrides) uses the bounded live prefetch.
    schedulePrefetch: prefetchHoraeRelations,
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

function taskPackExists(dataRoot: string, taskId: string): boolean {
  const tasksRoot = join(resolve(dataRoot), "tasks");
  if (!existsSync(tasksRoot)) return false;
  const visit = (directory: string): boolean => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory() && (entry.name === taskId ? existsSync(join(path, "task.json")) : visit(path))) return true;
    }
    return false;
  };
  return visit(tasksRoot);
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

async function runTask(options: LineageAllOptions, taskId: string, artifactRoot: string, deps: LineageAllDependencies): Promise<LineageAllTaskResult> {
  const paths = formalArtifactPaths(artifactRoot, taskId);
  const lock = acquireLock(artifactRoot, taskId);
  const stagingRoot = join(resolve(artifactRoot), ".staging");
  mkdirSync(stagingRoot, { recursive: true });
  const stagedDir = mkdtempSync(join(stagingRoot, `${taskId}-`));
  try {
    const producerCacheRoot = `${resolve(options.dataRoot)}.producer-index-cache`;
    const factsRoot = resolve(options.factsRoot ?? join(options.dataRoot, "field-facts"));
    const queriedFieldTables = new Set<string>();
    let fieldAutofillRounds = 0;
    let finalRawRootOneHop: OneHopReconciliationResult | null = null;
    let finalFormalMultiHop: ReturnType<typeof reconcileMultiHop> | null = null;
    let finalFieldArtifact: FieldLineageArtifact | null = null;
    let finalTrustedInputFingerprint: string | null = null;
    let taskNodeIds: string[] | null = null;
    const multiHopPath = join(stagedDir, "multi-hop.json");
    const oneHopPath = join(stagedDir, "one-hop.json");
    const tableHtml = join(stagedDir, "views", "table-lineage.html");
    let tableHtmlRendered = false;

    while (true) {
      let producer: ReturnType<typeof pinTableProducerIndex>["index"];
      let trustedInputFingerprint: string;
      if (taskNodeIds === null) {
        // The initial closure follows confirmed local Producer Index edges
        // only. Missing table producers are discovered later from the actual
        // field path, so auxiliary joins cannot inflate a field run into a
        // full-table task closure.
        const autofill = deps.autofill({
          taskId,
          dataRoot: resolve(options.dataRoot),
          producerIndexCacheRoot: producerCacheRoot,
          maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
          maxTasks: options.maxTasks ?? DEFAULT_MAX_TASKS,
          maxRounds: options.maxRounds ?? DEFAULT_MAX_ROUNDS,
          maxDiscoveryTables: 1000,
          maxDiscoveredTasks: DEFAULT_MAX_DISCOVERED_TASKS,
          force: options.force,
        });
        if (autofill.status !== "COMPLETE") throw new Error(`INPUT_PACK_CLOSURE_PARTIAL:${autofill.issues.join(";")}`);
        // Closure owns the immutable snapshot. Reuse it rather than pinning
        // and fingerprinting the entire Input Pack a second time.
        const snapshot = autofill.producerSnapshot;
        producer = snapshot
          ? deps.loadProducerIndex(snapshot.indexPath)
          : deps.producerIndex(resolve(options.dataRoot), producerCacheRoot).index;
        trustedInputFingerprint = snapshot?.inputFingerprint ?? producer.inputFingerprint;
        taskNodeIds = [...new Set(autofill.taskIds)];
      } else {
        // A field-driven collection adds only the producer task(s) observed on
        // the missing field path. Re-running the root closure here would
        // recursively expand every read of those tasks, including unrelated
        // JOINs, which is the source of the 200-task fan-out. Re-pin the index
        // against the expanded pack and keep the existing task frontier.
        const repinned = deps.producerIndex(resolve(options.dataRoot), producerCacheRoot);
        producer = repinned.index;
        trustedInputFingerprint = producer.inputFingerprint;
      }
      const facts = deps.machineFacts({ dataRoot: resolve(options.dataRoot), taskIds: taskNodeIds, outputRoot: factsRoot, indexMode: "incremental" });
      const failedFacts = facts.tasks.filter((fact) => fact.status === "FAILED" || fact.state === "FAILED");
      if (failedFacts.length > 0) throw new Error(`MACHINE_FACTS_FAILED:${failedFacts.map((fact) => fact.task_id).join(",")}`);
      const rawOneHopSnapshots = new Map<string, OneHopReconciliationResult>();
      const scheduleEvidenceByTaskId = await deps.schedulePrefetch(taskNodeIds);
      for (const nodeId of taskNodeIds) if (!scheduleEvidenceByTaskId.has(nodeId)) throw new Error(`SCHEDULE_PREFETCH_MISSING:${nodeId}`);
      const oneHopResults = deps.oneHopBatch(taskNodeIds, {
        dataRoot: resolve(options.dataRoot),
        producerIndex: producer,
        verifyInputFingerprint: true,
        trustedInputFingerprint,
        scheduleEvidenceByTaskId,
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
        trustedInputFingerprint,
      });
      if (!tableHtmlRendered) {
        writeJson(oneHopPath, rawRootOneHop);
        writeJson(multiHopPath, formalMultiHop);
        deps.visualizeMultiHop({ taskId, artifactPath: multiHopPath, outputPath: tableHtml, vizModelPath: join(stagedDir, "viz-model.json") });
        if (existsSync(join(stagedDir, "viz-model.json"))) rmSync(join(stagedDir, "viz-model.json"), { force: true });
        tableHtmlRendered = true;
      }
      let fieldArtifact: FieldLineageArtifact | null = null;
      if (options.withFields) {
        fieldArtifact = deps.fieldLineage({
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
        const fieldTables = fieldSourceTablesMissingProducerBridge(fieldArtifact, formalMultiHop);
        const producerTaskIds = new Set<string>();
        for (const qualifiedName of fieldTables) {
          if (queriedFieldTables.has(qualifiedName)) continue;
          queriedFieldTables.add(qualifiedName);
          for (const producerTaskId of deps.fieldProducerDiscovery(qualifiedName))
            if (SAFE_TASK_ID.test(producerTaskId)) producerTaskIds.add(producerTaskId);
        }
        const knownTaskIds: Set<string> = new Set(taskNodeIds ?? []);
        const collectIds: string[] = [...producerTaskIds]
          .filter((producerTaskId) => !knownTaskIds.has(producerTaskId))
          .sort((left, right) => left.localeCompare(right, "zh-Hans", { numeric: true }));
        if (collectIds.length > 0) {
          if (fieldAutofillRounds >= (options.maxRounds ?? DEFAULT_MAX_ROUNDS)) throw new Error("MAX_FIELD_AUTOFILL_ROUNDS_REACHED");
          deps.collectTaskPacks(resolve(options.dataRoot), collectIds, options.force === true);
          const collectedIds = collectIds.filter((candidate) => taskPackExists(options.dataRoot, candidate));
          taskNodeIds = [...new Set([...taskNodeIds, ...collectedIds])];
          fieldAutofillRounds += 1;
          continue;
        }
      }
      finalRawRootOneHop = rawRootOneHop;
      finalFormalMultiHop = formalMultiHop;
      finalFieldArtifact = fieldArtifact;
      finalTrustedInputFingerprint = trustedInputFingerprint;
      break;
    }
    if (!finalRawRootOneHop || !finalFormalMultiHop) throw new Error(`FINAL_LINEAGE_SNAPSHOT_MISSING:${taskId}`);
    writeJson(oneHopPath, finalRawRootOneHop);
    writeJson(multiHopPath, finalFormalMultiHop);
    const files = ["one-hop.json", "multi-hop.json"];
    if (fieldAutofillRounds > 0) {
      deps.visualizeMultiHop({ taskId, artifactPath: multiHopPath, outputPath: tableHtml, vizModelPath: join(stagedDir, "viz-model.json") });
      if (existsSync(join(stagedDir, "viz-model.json"))) rmSync(join(stagedDir, "viz-model.json"), { force: true });
    }
    files.push("views/table-lineage.html");
    if (finalFieldArtifact) {
      const fieldPath = join(stagedDir, "field-lineage.json");
      writeJson(fieldPath, finalFieldArtifact);
      const fieldHtml = join(stagedDir, "views", "field-lineage.html");
      deps.visualizeFieldLineage({ artifactPath: fieldPath, outputPath: fieldHtml, factsRoot });
      files.push("field-lineage.json", "views/field-lineage.html");
    }
    if (typeof finalTrustedInputFingerprint === "string" && deps.fingerprintInput(resolve(options.dataRoot)) !== finalTrustedInputFingerprint)
      throw new Error("INPUT_CHANGED_DURING_LINEAGE_ALL");
    publishStagedTask(stagedDir, paths.directory, artifactRoot);
    return { taskId, status: "SUCCESS", artifactDir: paths.directory, files };
  } catch (error) {
    if (existsSync(stagedDir)) rmSync(stagedDir, { recursive: true, force: true });
    return { taskId, status: "FAILED", artifactDir: paths.directory, files: [], error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (existsSync(lock)) rmSync(lock, { force: true });
  }
}

export async function runLineageAll(options: LineageAllOptions): Promise<LineageAllResult> {
  const dataRoot = resolve(options.dataRoot);
  const artifactRoot = resolve(options.artifactRoot ?? join(dataRoot, "artifacts"));
  if (!existsSync(join(dataRoot, "tasks")) || !existsSync(join(dataRoot, "tables"))) throw new Error("INPUT_PACK_ROOT_INCOMPLETE");
  const deps = dependencies(options.dependencies);
  const taskIds = [...new Set(options.taskIds.map((item) => item.trim()).filter(Boolean))].sort();
  for (const taskId of taskIds) if (!SAFE_TASK_ID.test(taskId)) throw new Error(`INVALID_TASK_ID:${taskId}`);
  const tasks: LineageAllTaskResult[] = [];
  for (const taskId of taskIds) tasks.push(await runTask({ ...options, dataRoot }, taskId, artifactRoot, deps));
  for (const internalDir of [join(artifactRoot, ".staging"), join(artifactRoot, ".locks")]) {
    if (existsSync(internalDir) && readdirSync(internalDir).length === 0) rmSync(internalDir, { recursive: true, force: true });
  }
  return { dataRoot, artifactRoot, taskIds, tasks, status: tasks.every((task) => task.status === "SUCCESS") ? "SUCCESS" : "PARTIAL_FAILURE" };
}

async function main(): Promise<void> {
  try {
    const result = await runLineageAll(parseLineageAllArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status !== "SUCCESS") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) void main();
