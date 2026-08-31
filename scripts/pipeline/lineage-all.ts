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
import { performance } from "node:perf_hooks";
import { dirname, join, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  runInputPackMachineFacts,
  type InputPackMachineFactsRunResult,
} from "../machine-facts/input-pack-machine-facts.ts";
import {
  runInputPackClosure,
  type InputPackClosureOptions,
  type InputPackProducerIndexProvider,
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
import {
  reconcileMultiHopBatch,
  type MultiHopBatchRoot,
  type MultiHopReconciliationResult,
  type ReconcileMultiHopOptions,
} from "../reconcile/consumer/multi-hop/reconcile-multi-hop.ts";
import {
  createInputPackManifestMemo,
  fingerprintTableProducerInputs,
  pinTableProducerIndex,
  type InputPackManifestCapture,
  type InputPackManifestMemo,
  type PinTableProducerIndexResult,
} from "../reconcile/producer/producer-index.ts";
import { validateTaskDocument, type TaskDocument } from "../input/shared/input-pack.ts";

const SAFE_TASK_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const DEFAULT_MAX_DEPTH = 25;
const DEFAULT_MAX_ROUNDS = DEFAULT_MAX_DEPTH + 3;
const DEFAULT_MAX_TASKS = 1000;
const DEFAULT_MAX_EDGES = 10000;
const DEFAULT_MAX_DISCOVERED_TASKS = 5000;

export type LineageAllStageId =
  | "input-pack-closure"
  | "input-pack-closure.input-fingerprint"
  | "input-pack-closure.producer-index-pin"
  | "input-pack-closure.producer-index-load"
  | "input-pack-closure.producer-index-build"
  | "input-pack-closure.traversal"
  | "producer-index"
  | "machine-facts"
  | "one-hop"
  | "multi-hop"
  | "field-lineage-reconcile"
  | "json-write"
  | "html-render"
  | "publish";

export type LineageAllStageReuseStatus =
  | "NOT_REUSED"
  | "REUSED"
  | "MIXED"
  | "INPUT_PACK_PRESENT"
  | "NOT_APPLICABLE";

export interface LineageAllStageEvent {
  readonly taskId: string;
  readonly stage: LineageAllStageId;
  readonly phase: "start" | "end";
  readonly elapsedMs: number;
  readonly status: "STARTED" | "SUCCESS" | "FAILED";
  readonly reuseStatus: LineageAllStageReuseStatus;
  readonly details?: Readonly<Record<string, unknown>>;
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
  /** Test/adapter seam for the main-chain manifest memo. */
  readonly inputPackManifestCapture?: InputPackManifestCapture;
  /** Best-effort observation only; exceptions are swallowed and never affect the build. */
  readonly stageObserver?: (event: LineageAllStageEvent) => void;
  readonly dependencies?: Partial<LineageAllDependencies>;
}

export interface LineageAllDependencies {
  readonly autofill: (options: InputPackClosureOptions) => InputPackClosureResult;
  readonly machineFacts: (options: Parameters<typeof runInputPackMachineFacts>[0]) => InputPackMachineFactsRunResult;
  readonly fieldLineage: (options: ReconcileFieldLineageOptions) => FieldLineageArtifact;
  readonly oneHopBatch: (taskIds: readonly string[], options: ReconcileOneHopOptions) => LineageAllBatchOutput<OneHopReconciliationResult>;
  /** Batch seam; the broad call type keeps older test/adapter stubs source-compatible. */
  readonly multiHop: (...args: any[]) => any;
  readonly producerIndex: typeof pinTableProducerIndex;
  readonly visualizeMultiHop: typeof visualizeMultiHop;
  readonly visualizeFieldLineage: typeof visualizeFieldLineage;
}

export interface LineageAllBatchFailure {
  /** One-hop failures use taskId; multi-hop failures may use rootTaskId. */
  readonly taskId?: string;
  readonly rootTaskId?: string;
  readonly error: string;
}

export interface LineageAllBatchEnvelope<T> {
  readonly results: readonly T[];
  readonly failures?: readonly LineageAllBatchFailure[];
}

export type LineageAllBatchOutput<T> =
  | readonly T[]
  | LineageAllBatchEnvelope<T>;

export type LineageAllMultiHopBatchOptions = Omit<ReconcileMultiHopOptions, "rootOneHop"> & {
  /** Compatibility-only value for legacy single-root adapter stubs. */
  readonly rootOneHop?: OneHopReconciliationResult;
};

export type LineageAllMultiHopBatch = (
  rootTaskIds: readonly string[] | string,
  options: LineageAllMultiHopBatchOptions,
) => readonly MultiHopReconciliationResult[];

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
    multiHop: runDefaultMultiHopBatch,
    producerIndex: pinTableProducerIndex,
    visualizeMultiHop,
    visualizeFieldLineage,
    ...overrides,
  };
}

function runDefaultMultiHopBatch(
  rootTaskIds: readonly string[] | string,
  options: LineageAllMultiHopBatchOptions,
): readonly MultiHopReconciliationResult[] {
  const requestedRootTaskIds = Array.isArray(rootTaskIds) ? rootTaskIds : [rootTaskIds];
  const roots: MultiHopBatchRoot[] = requestedRootTaskIds.map((taskId) => ({
    taskId,
    rootOneHop: options.oneHopSnapshots?.get(taskId),
  }));
  const { rootOneHop: _legacyRootOneHop, ...batchOptions } = options;
  return reconcileMultiHopBatch(roots, batchOptions);
}

interface BatchExecutionContext {
  readonly options: LineageAllOptions;
  readonly dataRoot: string;
  readonly artifactRoot: string;
  readonly deps: LineageAllDependencies;
  readonly factsRoot: string;
  readonly inputPackFingerprint: string;
  readonly producer: PinTableProducerIndexResult;
  readonly rawOneHopSnapshots: ReadonlyMap<string, OneHopReconciliationResult>;
  readonly oneHopSnapshots: ReadonlyMap<string, OneHopReconciliationResult>;
  readonly oneHopErrors: ReadonlyMap<string, string>;
  readonly multiHopByRoot: ReadonlyMap<string, MultiHopReconciliationResult>;
  readonly multiHopErrors: ReadonlyMap<string, string>;
}

function createProducerIndexProvider(
  dataRoot: string,
  producerIndexCacheRoot: string,
  deps: LineageAllDependencies,
  inputPackManifestMemo: InputPackManifestMemo,
): InputPackProducerIndexProvider {
  let pinned: PinTableProducerIndexResult | undefined;
  return (request) => {
    // An Input Pack collection invalidates the memo.  Do not reuse the prior
    // index after that point, even though all callers remain in this process.
    if (pinned !== undefined && inputPackManifestMemo.get() !== undefined) return pinned;
    pinned = undefined;
    inputPackManifestMemo.capture();
    pinned = deps.producerIndex(dataRoot, producerIndexCacheRoot, {
      taskId: request.taskId,
      stageObserver: request.stageObserver,
      inputPackManifestMemo,
    });
    return pinned;
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

function stageErrorDetails(error: unknown): Readonly<Record<string, unknown>> {
  return { error: error instanceof Error ? error.message : String(error) };
}

function emitStage(
  options: LineageAllOptions,
  event: LineageAllStageEvent,
): void {
  try {
    options.stageObserver?.(event);
  } catch {
    // Observation is deliberately best effort and must not change build semantics.
  }
}

function measureStage<T>(
  options: LineageAllOptions,
  taskId: string,
  stage: LineageAllStageId,
  action: () => T,
  reuseStatus: LineageAllStageReuseStatus | ((value: T) => LineageAllStageReuseStatus),
  details?: Readonly<Record<string, unknown>> | ((value: T) => Readonly<Record<string, unknown>>),
): T {
  const started = performance.now();
  if (options.stageObserver) {
    emitStage(options, {
      taskId,
      stage,
      phase: "start",
      elapsedMs: 0,
      status: "STARTED",
      reuseStatus: "NOT_APPLICABLE",
    });
  }
  try {
    const value = action();
    if (options.stageObserver) {
      const elapsedMs = performance.now() - started;
      let resolvedReuseStatus: LineageAllStageReuseStatus = "NOT_APPLICABLE";
      let resolvedDetails: Readonly<Record<string, unknown>> | undefined;
      try {
        resolvedReuseStatus = typeof reuseStatus === "function" ? reuseStatus(value) : reuseStatus;
        resolvedDetails = typeof details === "function" ? details(value) : details;
      } catch (observationError) {
        resolvedDetails = stageErrorDetails(observationError);
      }
      emitStage(options, {
        taskId,
        stage,
        phase: "end",
        elapsedMs,
        status: "SUCCESS",
        reuseStatus: resolvedReuseStatus,
        details: resolvedDetails,
      });
    }
    return value;
  } catch (error) {
    if (options.stageObserver) {
      emitStage(options, {
        taskId,
        stage,
        phase: "end",
        elapsedMs: performance.now() - started,
        status: "FAILED",
        reuseStatus: "NOT_APPLICABLE",
        details: stageErrorDetails(error),
      });
    }
    throw error;
  }
}

function machineFactsReuseStatus(
  result: InputPackMachineFactsRunResult,
): LineageAllStageReuseStatus {
  const reused = result.tasks.filter((task) => task.status === "REUSED").length;
  if (reused === 0) return "NOT_REUSED";
  return reused === result.tasks.length ? "REUSED" : "MIXED";
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

function failedTaskResult(artifactRoot: string, taskId: string, error: unknown): LineageAllTaskResult {
  return {
    taskId,
    status: "FAILED",
    artifactDir: formalArtifactPaths(artifactRoot, taskId).directory,
    files: [],
    error: error instanceof Error ? error.message : String(error),
  };
}

interface NormalizedBatchFailure {
  readonly id: string;
  readonly error: string;
}

interface NormalizedBatchOutput<T> {
  readonly results: readonly T[];
  readonly failures: readonly NormalizedBatchFailure[];
}

interface ValidatedBatchOutput<T> {
  readonly results: ReadonlyMap<string, T>;
  readonly rootErrors: ReadonlyMap<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resultId(value: unknown, field: "taskId" | "rootTaskId"): string | undefined {
  if (!isRecord(value) || typeof value[field] !== "string") return undefined;
  const id = value[field].trim();
  return id === "" ? undefined : id;
}

function batchFailureId(
  value: unknown,
  field: "taskId" | "rootTaskId",
): string | undefined {
  if (!isRecord(value)) return undefined;
  const candidates = [value[field], value.taskId, value.rootTaskId, value.id];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const id = candidate.trim();
    if (id !== "") return id;
  }
  return undefined;
}

function normalizeBatchFailure(
  value: unknown,
  field: "taskId" | "rootTaskId",
  stage: "ONE_HOP" | "MULTI_HOP",
): NormalizedBatchFailure {
  const id = batchFailureId(value, field);
  if (!id) throw new Error(`${stage}_BATCH_FAILURE_ID_INVALID`);
  if (!isRecord(value)) throw new Error(`${stage}_BATCH_FAILURE_INVALID:${id}`);
  const rawError = value.error ?? value.message;
  if (rawError === undefined || String(rawError).trim() === "")
    throw new Error(`${stage}_BATCH_FAILURE_ERROR_REQUIRED:${id}`);
  return { id, error: String(rawError) };
}

function normalizeBatchItems<T>(
  items: readonly unknown[],
  field: "taskId" | "rootTaskId",
  stage: "ONE_HOP" | "MULTI_HOP",
): NormalizedBatchOutput<T> {
  const results: T[] = [];
  const failures: NormalizedBatchFailure[] = [];
  for (const item of items) {
    if (isRecord(item)) {
      const hasNestedResult = "result" in item || "value" in item;
      const isFailure = item.status === "FAILED" || item.ok === false || ("error" in item && !hasNestedResult);
      if (isFailure) {
        failures.push(normalizeBatchFailure(item, field, stage));
        continue;
      }
      if (hasNestedResult) {
        const nestedResult = item.result ?? item.value;
        if (nestedResult === undefined)
          throw new Error(`${stage}_BATCH_RESULT_INVALID`);
        const declaredId = batchFailureId(item, field);
        const nestedId = resultId(nestedResult, field);
        if (declaredId !== undefined && nestedId !== undefined && declaredId !== nestedId)
          throw new Error(`${stage}_BATCH_RESULT_ID_MISMATCH:${declaredId}:${nestedId}`);
        results.push(nestedResult as T);
        continue;
      }
    }
    results.push(item as T);
  }
  return { results, failures };
}

function normalizeBatchOutput<T>(
  value: unknown,
  field: "taskId" | "rootTaskId",
  stage: "ONE_HOP" | "MULTI_HOP",
): NormalizedBatchOutput<T> {
  if (Array.isArray(value)) return normalizeBatchItems(value, field, stage);
  if (isRecord(value) && ("results" in value || "failures" in value || "errors" in value)) {
    const rawResults = value.results;
    if (rawResults !== undefined && !Array.isArray(rawResults))
      throw new Error(`${stage}_BATCH_RESULTS_INVALID`);
    const normalized = normalizeBatchItems<T>(rawResults ?? [], field, stage);
    const rawFailures = value.failures ?? value.errors;
    if (rawFailures !== undefined && !Array.isArray(rawFailures))
      throw new Error(`${stage}_BATCH_FAILURES_INVALID`);
    const failures = [
      ...normalized.failures,
      ...(rawFailures ?? []).map((failure) => normalizeBatchFailure(failure, field, stage)),
    ];
    return { results: normalized.results, failures };
  }
  if (value === undefined || value === null) throw new Error(`${stage}_BATCH_RESULT_INVALID`);
  return normalizeBatchItems([value], field, stage);
}

function validateOneHopBatch(
  expectedTaskIds: readonly string[],
  closureTaskIdsByRoot: ReadonlyMap<string, readonly string[]>,
  value: unknown,
): ValidatedBatchOutput<OneHopReconciliationResult> {
  const normalized = normalizeBatchOutput<OneHopReconciliationResult>(value, "taskId", "ONE_HOP");
  const expected = new Set(expectedTaskIds);
  const results = new Map<string, OneHopReconciliationResult>();
  for (const item of normalized.results) {
    const taskId = resultId(item, "taskId");
    if (!taskId) throw new Error("ONE_HOP_BATCH_RESULT_TASK_ID_REQUIRED");
    if (!expected.has(taskId)) throw new Error(`ONE_HOP_BATCH_UNKNOWN_TASK_ID:${taskId}`);
    if (results.has(taskId)) throw new Error(`ONE_HOP_BATCH_DUPLICATE_TASK_ID:${taskId}`);
    results.set(taskId, item);
  }

  const failuresByTask = new Map<string, string>();
  for (const failure of normalized.failures) {
    if (!expected.has(failure.id)) throw new Error(`ONE_HOP_BATCH_UNKNOWN_TASK_ID:${failure.id}`);
    if (results.has(failure.id) || failuresByTask.has(failure.id))
      throw new Error(`ONE_HOP_BATCH_DUPLICATE_TASK_ID:${failure.id}`);
    failuresByTask.set(failure.id, failure.error);
  }

  const rootErrors = new Map<string, string>();
  for (const [rootTaskId, closureTaskIds] of closureTaskIdsByRoot) {
    const requiredTaskIds = [...new Set([rootTaskId, ...closureTaskIds])];
    const missing = requiredTaskIds.filter((taskId) => !results.has(taskId));
    if (missing.length === 0) continue;
    const localFailures = missing
      .filter((taskId) => failuresByTask.has(taskId))
      .map((taskId) => `${taskId}:${failuresByTask.get(taskId)}`);
    rootErrors.set(
      rootTaskId,
      localFailures.length > 0
        ? `ONE_HOP_ROOT_LOCAL_FAILURE:${rootTaskId}:${localFailures.join(",")}`
        : `ROOT_ONE_HOP_SNAPSHOT_MISSING:${rootTaskId}:${missing.join(",")}`,
    );
  }
  return { results, rootErrors };
}

function validateMultiHopBatch(
  rootTaskIds: readonly string[],
  value: unknown,
): ValidatedBatchOutput<MultiHopReconciliationResult> {
  const normalized = normalizeBatchOutput<MultiHopReconciliationResult>(value, "rootTaskId", "MULTI_HOP");
  const expected = new Set(rootTaskIds);
  const results = new Map<string, MultiHopReconciliationResult>();
  for (const item of normalized.results) {
    const rootTaskId = resultId(item, "rootTaskId");
    if (!rootTaskId) throw new Error("MULTI_HOP_BATCH_RESULT_ROOT_TASK_ID_REQUIRED");
    if (!expected.has(rootTaskId)) throw new Error(`MULTI_HOP_BATCH_UNKNOWN_ROOT_TASK_ID:${rootTaskId}`);
    if (results.has(rootTaskId)) throw new Error(`MULTI_HOP_BATCH_DUPLICATE_ROOT_TASK_ID:${rootTaskId}`);
    results.set(rootTaskId, item);
  }

  const rootErrors = new Map<string, string>();
  for (const failure of normalized.failures) {
    if (!expected.has(failure.id)) throw new Error(`MULTI_HOP_BATCH_UNKNOWN_ROOT_TASK_ID:${failure.id}`);
    if (results.has(failure.id) || rootErrors.has(failure.id))
      throw new Error(`MULTI_HOP_BATCH_DUPLICATE_ROOT_TASK_ID:${failure.id}`);
    rootErrors.set(failure.id, `ROOT_MULTI_HOP_FAILED:${failure.id}:${failure.error}`);
  }
  for (const rootTaskId of rootTaskIds) {
    if (!results.has(rootTaskId) && !rootErrors.has(rootTaskId))
      rootErrors.set(rootTaskId, `ROOT_MULTI_HOP_RESULT_MISSING:${rootTaskId}`);
  }
  return { results, rootErrors };
}

function isGlobalInputStateError(error: unknown): boolean {
  const message = errorMessage(error);
  return (
    /^INPUT_CHANGED_DURING_/i.test(message) ||
    /^PRODUCER_INDEX_(?:STALE|INVALID|INPUT_FINGERPRINT_MISMATCH)/i.test(message) ||
    /^EXPLICIT_INPUT_MANIFEST_CACHE_MISS/i.test(message) ||
    /(?:INPUT_PACK|PRODUCER_INDEX|MANIFEST).*(?:FINGERPRINT|FRESHNESS|STALE|MISMATCH|CHANGED)/i.test(message) ||
    /freshness/i.test(message)
  );
}

/**
 * Recheck the frozen Input Pack identity once after shared multi-hop.  The
 * helper performs strict content hashing and detects changes during the
 * check; mtime/size metadata is intentionally not used as a shortcut.
 */
function assertInputPackFreshAfterMultiHop(
  dataRoot: string,
  expectedInputFingerprint: string,
): void {
  const currentInputFingerprint = fingerprintTableProducerInputs(dataRoot);
  if (currentInputFingerprint !== expectedInputFingerprint)
    throw new Error("INPUT_CHANGED_AFTER_MULTI_HOP");
}

function assertInputPackFreshBeforePublish(
  dataRoot: string,
  expectedInputFingerprint: string,
): void {
  const currentInputFingerprint = fingerprintTableProducerInputs(dataRoot);
  if (currentInputFingerprint !== expectedInputFingerprint)
    throw new Error("INPUT_CHANGED_BEFORE_PUBLISH");
}

interface StagedLineageAllTask {
  readonly status: "STAGED";
  readonly taskId: string;
  readonly artifactDir: string;
  readonly stagedDir: string;
  readonly lock: string;
  readonly files: readonly string[];
}

function discardStagedTask(stagedTask: StagedLineageAllTask): void {
  try {
    if (existsSync(stagedTask.stagedDir)) rmSync(stagedTask.stagedDir, { recursive: true, force: true });
  } finally {
    if (existsSync(stagedTask.lock)) rmSync(stagedTask.lock, { force: true });
  }
}

function stageTask(
  context: BatchExecutionContext,
  taskId: string,
): StagedLineageAllTask | LineageAllTaskResult {
  const { options, dataRoot, artifactRoot, deps, factsRoot } = context;
  const paths = formalArtifactPaths(artifactRoot, taskId);
  const rawRootOneHop = context.rawOneHopSnapshots.get(taskId);
  const rootOneHop = context.oneHopSnapshots.get(taskId);
  const formalMultiHop = context.multiHopByRoot.get(taskId);
  const oneHopError = context.oneHopErrors.get(taskId);
  const multiHopError = context.multiHopErrors.get(taskId);
  if (oneHopError !== undefined) return failedTaskResult(artifactRoot, taskId, oneHopError);
  if (multiHopError !== undefined) return failedTaskResult(artifactRoot, taskId, multiHopError);
  if (!rawRootOneHop || !rootOneHop)
    return failedTaskResult(artifactRoot, taskId, `ROOT_ONE_HOP_SNAPSHOT_MISSING:${taskId}`);
  if (!formalMultiHop)
    return failedTaskResult(artifactRoot, taskId, `ROOT_MULTI_HOP_RESULT_MISSING:${taskId}`);

  let lock: string | undefined;
  let stagedDir: string | undefined;
  let lockTransferred = false;
  try {
    lock = acquireLock(artifactRoot, taskId);
    const stagingRoot = join(resolve(artifactRoot), ".staging");
    mkdirSync(stagingRoot, { recursive: true });
    const currentStagedDir = mkdtempSync(join(stagingRoot, `${taskId}-`));
    stagedDir = currentStagedDir;
    const multiHopPath = join(currentStagedDir, "multi-hop.json");
    const oneHopPath = join(currentStagedDir, "one-hop.json");
    measureStage(
      options,
      taskId,
      "json-write",
      () => {
        writeJson(oneHopPath, rawRootOneHop);
        writeJson(multiHopPath, formalMultiHop);
      },
      "NOT_REUSED",
      { files: ["one-hop.json", "multi-hop.json"] },
    );
    const files = ["one-hop.json", "multi-hop.json"];
    const tableHtml = join(currentStagedDir, "views", "table-lineage.html");
    measureStage(
      options,
      taskId,
      "html-render",
      () => deps.visualizeMultiHop({ taskId, artifactPath: multiHopPath, outputPath: tableHtml, vizModelPath: join(currentStagedDir, "viz-model.json") }),
      "NOT_REUSED",
      { kind: "table", file: "views/table-lineage.html" },
    );
    if (existsSync(join(currentStagedDir, "viz-model.json"))) rmSync(join(currentStagedDir, "viz-model.json"), { force: true });
    files.push("views/table-lineage.html");
    if (options.withFields) {
      const fieldArtifact = measureStage(
        options,
        taskId,
        "field-lineage-reconcile",
        () => deps.fieldLineage({
          dataRoot,
          factsRoot,
          tableLineage: formalMultiHop,
          rootTaskId: taskId,
          rootTable: taskTarget(dataRoot, taskId),
          rootFields: options.fields ?? [],
          factsPolicy: options.factsPolicy ?? "current-only",
          maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
          maxStates: DEFAULT_FIELD_LINEAGE_MAX_STATES,
          maxPaths: DEFAULT_FIELD_LINEAGE_MAX_PATHS,
        }),
        "NOT_REUSED",
        { rootTaskId: taskId, factsPolicy: options.factsPolicy ?? "current-only" },
      );
      const fieldPath = join(currentStagedDir, "field-lineage.json");
      measureStage(
        options,
        taskId,
        "json-write",
        () => writeJson(fieldPath, fieldArtifact),
        "NOT_REUSED",
        { files: ["field-lineage.json"] },
      );
      const fieldHtml = join(currentStagedDir, "views", "field-lineage.html");
      measureStage(
        options,
        taskId,
        "html-render",
        () => deps.visualizeFieldLineage({ artifactPath: fieldPath, outputPath: fieldHtml, factsRoot }),
        "NOT_REUSED",
        { kind: "field", file: "views/field-lineage.html" },
      );
      files.push("field-lineage.json", "views/field-lineage.html");
    }
    const result: StagedLineageAllTask = {
      status: "STAGED",
      taskId,
      artifactDir: paths.directory,
      stagedDir: currentStagedDir,
      lock,
      files,
    };
    lockTransferred = true;
    return result;
  } catch (error) {
    if (stagedDir !== undefined && existsSync(stagedDir)) rmSync(stagedDir, { recursive: true, force: true });
    return failedTaskResult(artifactRoot, taskId, error);
  } finally {
    if (!lockTransferred && lock !== undefined && existsSync(lock)) rmSync(lock, { force: true });
  }
}

function commitStagedTask(
  context: BatchExecutionContext,
  stagedTask: StagedLineageAllTask,
): LineageAllTaskResult {
  const { options, artifactRoot } = context;
  try {
    measureStage(
      options,
      stagedTask.taskId,
      "publish",
      () => publishStagedTask(stagedTask.stagedDir, stagedTask.artifactDir, artifactRoot),
      "NOT_REUSED",
      { artifactDir: stagedTask.artifactDir },
    );
    return {
      taskId: stagedTask.taskId,
      status: "SUCCESS",
      artifactDir: stagedTask.artifactDir,
      files: stagedTask.files,
    };
  } catch (error) {
    if (existsSync(stagedTask.stagedDir)) rmSync(stagedTask.stagedDir, { recursive: true, force: true });
    return failedTaskResult(artifactRoot, stagedTask.taskId, error);
  } finally {
    if (existsSync(stagedTask.lock)) rmSync(stagedTask.lock, { force: true });
  }
}

export function runLineageAll(options: LineageAllOptions): LineageAllResult {
  const dataRoot = resolve(options.dataRoot);
  const artifactRoot = resolve(options.artifactRoot ?? join(dataRoot, "artifacts"));
  const taskIds = [...new Set(options.taskIds.map((item) => item.trim()).filter(Boolean))].sort();
  if (taskIds.length === 0) throw new Error("TASK_IDS_REQUIRED");
  if (!existsSync(join(dataRoot, "tasks")) || !existsSync(join(dataRoot, "tables"))) throw new Error("INPUT_PACK_ROOT_INCOMPLETE");
  const deps = dependencies(options.dependencies);
  for (const taskId of taskIds) if (!SAFE_TASK_ID.test(taskId)) throw new Error(`INVALID_TASK_ID:${taskId}`);
  const inputPackManifestMemo = createInputPackManifestMemo(dataRoot, {
    capture: options.inputPackManifestCapture,
  });
  const producerIndexProvider = createProducerIndexProvider(
    dataRoot,
    `${dataRoot}.producer-index-cache`,
    deps,
    inputPackManifestMemo,
  );
  const closureResults = new Map<string, InputPackClosureResult>();
  const closureErrors = new Map<string, string>();
  let globalStageError: string | undefined;
  for (const taskId of taskIds) {
    if (globalStageError !== undefined) break;
    try {
      const result = measureStage(
        { ...options, dataRoot },
        taskId,
        "input-pack-closure",
        () => {
          const closure = deps.autofill({
            taskId,
            dataRoot,
            producerIndexCacheRoot: `${dataRoot}.producer-index-cache`,
            maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
            maxTasks: options.maxTasks ?? DEFAULT_MAX_TASKS,
            maxRounds: options.maxRounds ?? DEFAULT_MAX_ROUNDS,
            maxDiscoveryTables: 1000,
            maxDiscoveredTasks: DEFAULT_MAX_DISCOVERED_TASKS,
            force: options.force,
            stageObserver: options.stageObserver,
            inputPackManifestMemo,
            producerIndexProvider,
          });
          if (closure.status !== "COMPLETE")
            throw new Error(`INPUT_PACK_CLOSURE_PARTIAL:${closure.issues.join(";")}`);
          return closure;
        },
        "INPUT_PACK_PRESENT",
        (result) => ({
          rounds: result.rounds,
          taskCount: result.taskIds.length,
          discoveredTaskCount: result.discoveredTaskIds.length,
          collectedTaskCount: result.collectedTaskIds.length,
        }),
      );
      closureResults.set(taskId, result);
    } catch (error) {
      const message = errorMessage(error);
      if (isGlobalInputStateError(error)) globalStageError = message;
      else closureErrors.set(taskId, message);
    }
  }

  const successfulRootIds = taskIds.filter((taskId) => closureResults.has(taskId));
  let batchContext: BatchExecutionContext | undefined;
  if (globalStageError === undefined && successfulRootIds.length > 0) {
    const stageTaskId = successfulRootIds[0]!;
    try {
      const producerResult = measureStage(
        { ...options, dataRoot },
        stageTaskId,
        "producer-index",
        () => producerIndexProvider({ taskId: stageTaskId, stageObserver: options.stageObserver, inputPackManifestMemo }),
        (result) => result.reused ? "REUSED" : "NOT_REUSED",
        (result) => ({
          inputFingerprint: result.inputFingerprint,
          reused: result.reused,
          indexPath: result.indexPath,
          manifestPath: result.manifestPath,
        }),
      );
      const closureTaskIdsByRoot = new Map<string, readonly string[]>(
        successfulRootIds.map((taskId) => [
          taskId,
          [...new Set(closureResults.get(taskId)!.taskIds)],
        ]),
      );
      const taskNodeIds = [...new Set(successfulRootIds.flatMap((taskId) => [
        taskId,
        ...closureTaskIdsByRoot.get(taskId)!,
      ]))]
        .sort((left, right) => left.localeCompare(right, "zh-Hans", { numeric: true }));
      const factsRoot = resolve(options.factsRoot ?? join(dataRoot, "field-facts"));
      measureStage(
        { ...options, dataRoot },
        stageTaskId,
        "machine-facts",
        () => {
          const result = deps.machineFacts({ dataRoot, taskIds: taskNodeIds, outputRoot: factsRoot, indexMode: "incremental" });
          const failedFacts = result.tasks.filter((task) => task.status === "FAILED" || task.state === "FAILED");
          if (failedFacts.length > 0) throw new Error(`MACHINE_FACTS_FAILED:${failedFacts.map((task) => task.task_id).join(",")}`);
          return result;
        },
        machineFactsReuseStatus,
        (result) => ({
          indexMode: result.timings.index_mode,
          taskCount: result.tasks.length,
          reusedTaskCount: result.tasks.filter((task) => task.status === "REUSED").length,
          rebuiltTaskCount: result.tasks.filter((task) => task.status !== "REUSED").length,
          taskIds: taskNodeIds,
        }),
      );

      const validatedOneHop = measureStage(
        { ...options, dataRoot },
        stageTaskId,
        "one-hop",
        () => validateOneHopBatch(
          taskNodeIds,
          closureTaskIdsByRoot,
          deps.oneHopBatch(taskNodeIds, {
            dataRoot,
            producerIndex: producerResult.index,
            verifyInputFingerprint: true,
          }),
        ),
        "NOT_REUSED",
        (result) => ({
          taskCount: result.results.size,
          taskIds: [...result.results.keys()],
          expectedTaskIds: taskNodeIds,
          rootFailures: [...result.rootErrors.keys()],
          verifyInputFingerprint: true,
        }),
      );
      const checkDbFlagIds = checkDbFlagTaskIds(dataRoot, [...validatedOneHop.results.values()]);
      const rawOneHopSnapshots = new Map(validatedOneHop.results);
      const oneHopSnapshots = new Map<string, OneHopReconciliationResult>();
      for (const [taskId, result] of validatedOneHop.results) {
        oneHopSnapshots.set(taskId, withoutCheckDbFlagParents(result, checkDbFlagIds));
      }
      const multiHopRootIds = successfulRootIds.filter((taskId) => !validatedOneHop.rootErrors.has(taskId));
      let inputPackFingerprint = producerResult.inputFingerprint;
      let validatedMultiHop: ValidatedBatchOutput<MultiHopReconciliationResult> = {
        results: new Map(),
        rootErrors: new Map(),
      };
      if (multiHopRootIds.length > 0) {
        inputPackFingerprint = (
          inputPackManifestMemo.get() ?? inputPackManifestMemo.capture()
        ).inputFingerprint;
        const multiHopInput = multiHopRootIds.length === 1 ? multiHopRootIds[0]! : multiHopRootIds;
        validatedMultiHop = measureStage(
          { ...options, dataRoot },
          stageTaskId,
          "multi-hop",
          () => validateMultiHopBatch(
            multiHopRootIds,
            deps.multiHop(multiHopInput, {
              dataRoot,
              producerIndex: producerResult.index,
              maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
              maxTasks: options.maxTasks ?? DEFAULT_MAX_TASKS,
              maxEdges: options.maxEdges ?? DEFAULT_MAX_EDGES,
              ...(multiHopRootIds.length === 1
                ? { rootOneHop: oneHopSnapshots.get(multiHopRootIds[0]!) }
                : {}),
              oneHopSnapshots,
            }),
          ),
          "NOT_REUSED",
          (result) => ({
            rootCount: multiHopRootIds.length,
            roots: multiHopRootIds,
            resultCount: result.results.size,
            rootFailures: [...result.rootErrors.keys()],
          }),
        );
        assertInputPackFreshAfterMultiHop(dataRoot, inputPackFingerprint);
      }
      batchContext = {
        options: { ...options, dataRoot },
        dataRoot,
        artifactRoot,
        deps,
        factsRoot,
        inputPackFingerprint,
        producer: producerResult,
        rawOneHopSnapshots,
        oneHopSnapshots,
        oneHopErrors: validatedOneHop.rootErrors,
        multiHopByRoot: validatedMultiHop.results,
        multiHopErrors: validatedMultiHop.rootErrors,
      };
    } catch (error) {
      globalStageError = errorMessage(error);
    }
  }

  const taskResults = new Map<string, LineageAllTaskResult>();
  const stagedTasks: StagedLineageAllTask[] = [];
  for (const taskId of taskIds) {
    if (globalStageError !== undefined) {
      taskResults.set(taskId, failedTaskResult(artifactRoot, taskId, globalStageError));
      continue;
    }
    const closureError = closureErrors.get(taskId);
    if (closureError !== undefined) {
      taskResults.set(taskId, failedTaskResult(artifactRoot, taskId, closureError));
      continue;
    }
    if (!batchContext) {
      taskResults.set(taskId, failedTaskResult(artifactRoot, taskId, "BATCH_CONTEXT_MISSING"));
      continue;
    }
    const stagedTask = stageTask(batchContext, taskId);
    if (stagedTask.status === "STAGED") stagedTasks.push(stagedTask);
    else taskResults.set(taskId, stagedTask);
  }

  if (batchContext && stagedTasks.length > 0) {
    let fenceError: string | undefined;
    try {
      assertInputPackFreshBeforePublish(dataRoot, batchContext.inputPackFingerprint);
    } catch (error) {
      fenceError = errorMessage(error);
    }
    if (fenceError !== undefined) {
      for (const stagedTask of stagedTasks) {
        discardStagedTask(stagedTask);
        taskResults.set(stagedTask.taskId, failedTaskResult(artifactRoot, stagedTask.taskId, fenceError));
      }
    } else {
      for (const stagedTask of stagedTasks)
        taskResults.set(stagedTask.taskId, commitStagedTask(batchContext, stagedTask));
    }
  }

  const tasks = taskIds.map((taskId) => taskResults.get(taskId) ?? failedTaskResult(artifactRoot, taskId, "BATCH_CONTEXT_MISSING"));
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
