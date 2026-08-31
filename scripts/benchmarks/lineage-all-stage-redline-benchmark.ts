import { spawn, type ChildProcess } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  writeSync,
  writeFileSync,
} from "node:fs";
import { performance } from "node:perf_hooks";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseLineageAllArgs,
  runLineageAll,
  type LineageAllOptions,
  type LineageAllResult,
  type LineageAllStageEvent,
  type LineageAllStageId,
  type LineageAllStageReuseStatus,
} from "../pipeline/lineage-all.ts";
import { runInputPackClosure } from "../pipeline/input-pack-closure.ts";
import { pinTableProducerIndex } from "../reconcile/producer/producer-index.ts";

const DATA_ROOT = String.raw`E:\02_area\股衍数据-数据cookbook\sql-static-lineage-data`;
const CACHE_ROOT = String.raw`E:\02_area\股衍数据-数据cookbook\sql-static-lineage-cache`;
const DEFAULT_TASK_IDS = ["181058", "176827", "209119"] as const;
const DEFAULT_RUNS = 2;
const DEFAULT_TIMEOUT_MS = 60_000;
const WORKER_CLOSE_GRACE_MS = 2_000;
const TASKKILL_TIMEOUT_MS = 1_000;
const WORKER_OUTPUT_TAIL_BYTES = 16 * 1024;

export const LINEAGE_ALL_STAGE_IDS: readonly LineageAllStageId[] = [
  "input-pack-closure",
  "input-pack-closure.input-fingerprint",
  "input-pack-closure.producer-index-pin",
  "input-pack-closure.producer-index-load",
  "input-pack-closure.producer-index-build",
  "input-pack-closure.traversal",
  "producer-index",
  "machine-facts",
  "one-hop",
  "multi-hop",
  "field-lineage-reconcile",
  "json-write",
  "html-render",
  "publish",
];

export const WARM_REDLINE_STAGE_IDS: readonly LineageAllStageId[] = [
  "one-hop",
  "multi-hop",
  "field-lineage-reconcile",
  "html-render",
];

export interface LineageAllStageSummary {
  readonly stage: LineageAllStageId;
  readonly callState: "CALLED" | "NOT_CALLED";
  readonly calls: number;
  readonly elapsedMs: number;
  readonly outcomes: readonly LineageAllStageEvent["status"][];
  readonly reuseStatuses: readonly LineageAllStageReuseStatus[];
  readonly events: readonly LineageAllStageEvent[];
}

export interface LineageAllTaskBenchmarkSummary {
  readonly taskId: string;
  readonly status: "SUCCESS" | "FAILED" | "TIMEOUT";
  readonly artifactDir: string;
  readonly files: readonly string[];
  readonly error?: string;
  readonly stages: readonly LineageAllStageSummary[];
}

export interface LineageAllBenchmarkRunSummary {
  readonly runIndex: number;
  readonly mode: "cold" | "rerun";
  readonly status: "SUCCESS" | "PARTIAL_FAILURE" | "TIMEOUT";
  readonly elapsedMs: number;
  readonly tasks: readonly LineageAllTaskBenchmarkSummary[];
  readonly eventLogPath: string;
  readonly lastEvent?: LineageAllStageEvent;
  readonly location?: string;
  readonly error?: string;
  readonly stdoutTail?: string;
  readonly stderrTail?: string;
}

export interface LineageAllRedlineEvaluation {
  readonly status: "GREEN" | "RED";
  readonly violations: readonly string[];
}

interface BenchmarkArgs {
  readonly taskIds: readonly string[];
  readonly runs: number;
  readonly timeoutMs: number;
  readonly worker: boolean;
  readonly runRoot?: string;
  readonly eventLogPath?: string;
  readonly resultPath?: string;
}

export type BenchmarkWorkerCloseListener = (
  exitCode: number | null,
  signal: NodeJS.Signals | null,
) => void;

export type BenchmarkWorkerErrorListener = (error: Error) => void;

export type BenchmarkWorkerOutputListener = (data: Buffer) => void;

export interface BenchmarkWorkerStream {
  on(event: "data", listener: BenchmarkWorkerOutputListener): this;
  removeListener(event: "data", listener: BenchmarkWorkerOutputListener): this;
  destroy(): void;
}

export interface BenchmarkWorkerChild {
  readonly pid?: number;
  readonly stdout?: BenchmarkWorkerStream | null;
  readonly stderr?: BenchmarkWorkerStream | null;
  unref?(): this | void;
  once(event: "close", listener: BenchmarkWorkerCloseListener): this;
  once(event: "error", listener: BenchmarkWorkerErrorListener): this;
  removeListener?(
    event: "close" | "error",
    listener: BenchmarkWorkerCloseListener | BenchmarkWorkerErrorListener,
  ): this;
}

export interface WorkerLifecycleOptions {
  readonly timeoutMs: number;
  readonly closeGraceMs?: number;
  readonly terminateProcessTree?: (pid: number) => void | Promise<unknown>;
  readonly stdoutListener?: BenchmarkWorkerOutputListener;
  readonly stderrListener?: BenchmarkWorkerOutputListener;
}

export interface WorkerLifecycleResult {
  readonly state: "CLOSED" | "ERROR" | "GRACE_EXPIRED";
  readonly timedOut: boolean;
  readonly closed: boolean;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
}

interface WorkerEnvelope {
  readonly result?: LineageAllResult;
  readonly error?: string;
}

type TaskkillChild = Pick<ChildProcess, "once" | "kill" | "unref" | "removeListener">;
export type TaskkillLauncher = (command: string, args: readonly string[]) => TaskkillChild;

export interface ProcessTreeTerminationOptions {
  readonly taskkillTimeoutMs?: number;
  readonly spawnTaskkill?: TaskkillLauncher;
}

function optionValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

function positiveInteger(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name}_INVALID`);
  return value;
}

function parseTaskIds(raw: string | undefined): readonly string[] {
  const values = (raw ?? DEFAULT_TASK_IDS.join(","))
    .split(",")
    .map((taskId) => taskId.trim())
    .filter(Boolean);
  const taskIds = [...new Set(values)];
  if (taskIds.length === 0) throw new Error("TASK_IDS_INVALID");
  return taskIds;
}

export function parseBenchmarkArgs(args: readonly string[]): BenchmarkArgs {
  const known = new Set([
    "--task-ids", "--runs", "--timeout-ms", "--worker", "--run-root", "--event-log", "--result-path",
  ]);
  const valueArgs = new Set(["--task-ids", "--runs", "--timeout-ms", "--run-root", "--event-log", "--result-path"]);
  const unknown = args.find((item, index) =>
    item.startsWith("--") &&
    !known.has(item) &&
    !(index > 0 && valueArgs.has(args[index - 1]!)),
  );
  if (unknown) throw new Error(`UNKNOWN_ARGUMENT:${unknown}`);
  return {
    taskIds: parseTaskIds(optionValue(args, "--task-ids")),
    runs: positiveInteger(optionValue(args, "--runs"), DEFAULT_RUNS, "RUNS"),
    timeoutMs: positiveInteger(optionValue(args, "--timeout-ms"), DEFAULT_TIMEOUT_MS, "TIMEOUT_MS"),
    worker: args.includes("--worker"),
    runRoot: optionValue(args, "--run-root"),
    eventLogPath: optionValue(args, "--event-log"),
    resultPath: optionValue(args, "--result-path"),
  };
}

export function summarizeStageEvents(
  taskId: string,
  events: readonly LineageAllStageEvent[],
): readonly LineageAllStageSummary[] {
  return LINEAGE_ALL_STAGE_IDS.map((stage) => {
    const stageEvents = events.filter((event) => event.taskId === taskId && event.stage === stage);
    const starts = stageEvents.filter((event) => event.phase === "start");
    const ends = stageEvents.filter((event) => event.phase === "end");
    return {
      stage,
      callState: starts.length > 0 ? "CALLED" : "NOT_CALLED",
      calls: starts.length,
      elapsedMs: ends.reduce((total, event) => total + event.elapsedMs, 0),
      outcomes: ends.map((event) => event.status),
      reuseStatuses: ends.map((event) => event.reuseStatus),
      events: stageEvents,
    };
  });
}

export function evaluateWarmRedline(
  rerun: LineageAllBenchmarkRunSummary,
): LineageAllRedlineEvaluation {
  const violations: string[] = [];
  if (rerun.status !== "SUCCESS") violations.push(`rerun_status=${rerun.status}`);
  for (const task of rerun.tasks) {
    if (task.status !== "SUCCESS") violations.push(`task=${task.taskId}:status=${task.status}`);
    for (const stageId of WARM_REDLINE_STAGE_IDS) {
      const stage = task.stages.find((candidate) => candidate.stage === stageId);
      if (!stage || stage.calls === 0) continue;
      violations.push(
        `task=${task.taskId} stage=${stageId} warm_calls=${stage.calls} elapsed_ms=${stage.elapsedMs.toFixed(2)} reuse=${stage.reuseStatuses.join("|")}`,
      );
    }
  }
  return { status: violations.length > 0 ? "RED" : "GREEN", violations };
}

function mainChainOptions(
  taskIds: readonly string[],
  runRoot: string,
  observer: (event: LineageAllStageEvent) => void,
): LineageAllOptions {
  const producerIndexCacheRoot = join(runRoot, "producer-index-cache");
  const parsed = parseLineageAllArgs([
    "--data-root", DATA_ROOT,
    "--task-ids", taskIds.join(","),
    "--artifact-root", join(runRoot, "artifacts"),
    "--facts-root", join(runRoot, "field-facts"),
    "--with-fields",
    "--facts-policy", "current-only",
    "--max-depth", "25",
    "--max-tasks", "1000",
    "--max-edges", "10000",
    "--max-rounds", "28",
  ]);
  return {
    ...parsed,
    stageObserver: observer,
    dependencies: {
      // Keep production closure/index implementations, but contain all cache
      // writes under this benchmark run and fail closed if collection is needed.
      autofill: (options) => runInputPackClosure({
        ...options,
        producerIndexCacheRoot,
        collectTaskPacks: (_dataRoot, missingTaskIds) => {
          throw new Error(`BENCHMARK_INPUT_PACK_COLLECTION_DISALLOWED:${missingTaskIds.join(",")}`);
        },
      }),
      producerIndex: (dataRoot, _cacheRoot, options) =>
        pinTableProducerIndex(dataRoot, producerIndexCacheRoot, options),
    },
  };
}

function writeWorkerEnvelope(path: string, envelope: WorkerEnvelope): void {
  writeFileSync(path, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
}

export function createWorkerStageObserver(
  eventFd: number,
  stdoutWriter: (line: string) => void = (line) => {
    process.stdout.write(line);
  },
): (event: LineageAllStageEvent) => void {
  return (event: LineageAllStageEvent): void => {
    const line = `${JSON.stringify(event)}\n`;
    // Keep event-log durability synchronous while leaving stdout as a normal
    // stream write so the observer does not synchronously write to fd 1.
    writeSync(eventFd, line, undefined, "utf8");
    stdoutWriter(line);
  };
}

function runWorker(args: BenchmarkArgs): void {
  if (!args.runRoot || !args.eventLogPath || !args.resultPath) throw new Error("WORKER_PATHS_REQUIRED");
  mkdirSync(dirname(args.eventLogPath), { recursive: true });
  const eventFd = openSync(args.eventLogPath, "a");
  const observer = createWorkerStageObserver(eventFd);
  try {
    const result = runLineageAll(mainChainOptions(args.taskIds, args.runRoot, observer));
    writeWorkerEnvelope(args.resultPath, { result });
    if (result.status !== "SUCCESS") process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeWorkerEnvelope(args.resultPath, { error: message });
    process.stderr.write(`LINEAGE_ALL_WORKER_ERROR ${message}\n`);
    process.exitCode = 1;
  } finally {
    closeSync(eventFd);
  }
}

function readEvents(path: string): readonly LineageAllStageEvent[] {
  if (!existsSync(path)) return [];
  const events: LineageAllStageEvent[] = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean)) {
    try {
      events.push(JSON.parse(line) as LineageAllStageEvent);
    } catch {
      // A partially written final line cannot hide earlier durable events.
    }
  }
  return events;
}

function lastEventLocation(event: LineageAllStageEvent | undefined): string {
  if (!event) return "before first stage event";
  if (event.phase === "start") return `${event.taskId}/${event.stage}:started_without_end`;
  return `${event.taskId}/${event.stage}:ended_before_next_stage_start`;
}

function taskSummary(
  taskId: string,
  task: LineageAllResult["tasks"][number] | undefined,
  events: readonly LineageAllStageEvent[],
  timeout: boolean,
  timeoutLocation: string,
): LineageAllTaskBenchmarkSummary {
  if (!task) {
    return {
      taskId,
      status: timeout ? "TIMEOUT" : "FAILED",
      artifactDir: "",
      files: [],
      error: timeout ? `TIMEOUT_AT:${timeoutLocation}` : "TASK_RESULT_MISSING",
      stages: summarizeStageEvents(taskId, events),
    };
  }
  return {
    taskId,
    status: task.status,
    artifactDir: task.artifactDir,
    files: task.files,
    error: task.error,
    stages: summarizeStageEvents(taskId, events),
  };
}

function buildRunSummary(
  runIndex: number,
  taskIds: readonly string[],
  eventLogPath: string,
  elapsedMs: number,
  timedOut: boolean,
  envelope: WorkerEnvelope | undefined,
  outputTails: { readonly stdout: string; readonly stderr: string },
): LineageAllBenchmarkRunSummary {
  const events = readEvents(eventLogPath);
  const lastEvent = events.at(-1);
  const location = lastEventLocation(lastEvent);
  const result = envelope?.result;
  const tasks = taskIds.map((taskId) => taskSummary(
    taskId,
    result?.tasks.find((task) => task.taskId === taskId),
    events,
    timedOut,
    location,
  ));
  return {
    runIndex,
    mode: runIndex === 1 ? "cold" : "rerun",
    status: timedOut ? "TIMEOUT" : result?.status ?? "PARTIAL_FAILURE",
    elapsedMs,
    tasks,
    eventLogPath,
    lastEvent,
    location,
    error: envelope?.error,
    stdoutTail: outputTails.stdout,
    stderrTail: outputTails.stderr,
  };
}

function readWorkerEnvelope(path: string): WorkerEnvelope | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as WorkerEnvelope;
  } catch {
    return undefined;
  }
}

function defaultTaskkillLauncher(command: string, args: readonly string[]): TaskkillChild {
  return spawn(command, [...args], {
    windowsHide: true,
    stdio: "ignore",
  });
}

export function terminateWorkerProcessTree(
  pid: number,
  options: ProcessTreeTerminationOptions = {},
): Promise<"SUCCESS" | "FAILED" | "TIMEOUT"> {
  if (process.platform !== "win32") {
    try {
      process.kill(pid, "SIGTERM");
      return Promise.resolve("SUCCESS");
    } catch {
      return Promise.resolve("FAILED");
    }
  }

  const launchTaskkill = options.spawnTaskkill ?? defaultTaskkillLauncher;
  const timeoutMs = options.taskkillTimeoutMs ?? TASKKILL_TIMEOUT_MS;
  return new Promise((resolve) => {
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let taskkill: TaskkillChild | undefined;

    const onClose = (exitCode: number | null): void => {
      finish(exitCode === 0 ? "SUCCESS" : "FAILED");
    };
    const onError = (): void => {
      finish("FAILED");
    };
    const finish = (result: "SUCCESS" | "FAILED" | "TIMEOUT"): void => {
      if (settled) return;
      settled = true;
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      try {
        taskkill?.removeListener("close", onClose);
        taskkill?.removeListener("error", onError);
      } catch {
        // A taskkill helper may have already torn down its event emitter.
      }
      resolve(result);
    };

    try {
      taskkill = launchTaskkill("taskkill", ["/PID", String(pid), "/T", "/F"]);
      taskkill.once("close", onClose);
      taskkill.once("error", onError);
      taskkill.unref();
      timeoutHandle = setTimeout(() => {
        try {
          taskkill?.kill();
        } catch {
          // Failure to stop the helper cannot hold up the benchmark grace path.
        }
        finish("TIMEOUT");
      }, timeoutMs);
    } catch {
      finish("FAILED");
    }
  });
}

export function waitForWorkerLifecycle(
  child: BenchmarkWorkerChild,
  options: WorkerLifecycleOptions,
): Promise<WorkerLifecycleResult> {
  const terminateProcessTree = options.terminateProcessTree ?? terminateWorkerProcessTree;
  const closeGraceMs = options.closeGraceMs ?? WORKER_CLOSE_GRACE_MS;
  return new Promise((resolvePromise) => {
    let settled = false;
    let timedOut = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let graceHandle: ReturnType<typeof setTimeout> | undefined;

    const cleanupTimedOutWorker = (): void => {
      try {
        child.removeListener?.("close", onClose);
        child.removeListener?.("error", onError);
      } catch {
        // Listener cleanup is best effort; the terminal result must still settle.
      }
      try {
        if (child.stdout && options.stdoutListener) {
          child.stdout.removeListener("data", options.stdoutListener);
        }
      } catch {
        // The stream may already be closed.
      }
      try {
        child.stdout?.destroy();
      } catch {
        // The stream may already be closed.
      }
      try {
        if (child.stderr && options.stderrListener) {
          child.stderr.removeListener("data", options.stderrListener);
        }
      } catch {
        // The stream may already be closed.
      }
      try {
        child.stderr?.destroy();
      } catch {
        // The stream may already be closed.
      }
      try {
        child.unref?.();
      } catch {
        // The child may already be gone.
      }
    };

    const settle = (
      state: WorkerLifecycleResult["state"],
      exitCode: number | null,
      signal: NodeJS.Signals | null,
      cleanup = false,
    ): void => {
      if (settled) return;
      if (cleanup) cleanupTimedOutWorker();
      settled = true;
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      if (graceHandle !== undefined) clearTimeout(graceHandle);
      resolvePromise({
        state,
        timedOut,
        closed: state === "CLOSED",
        exitCode,
        signal,
      });
    };

    const onClose = (exitCode: number | null, signal: NodeJS.Signals | null): void => {
      if (timedOut) return;
      settle("CLOSED", exitCode, signal);
    };
    const onError = (): void => {
      if (timedOut) return;
      settle("ERROR", null, null);
    };
    child.once("close", onClose);
    child.once("error", onError);
    timeoutHandle = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      if (child.pid !== undefined) {
        try {
          const termination = terminateProcessTree(child.pid);
          void Promise.resolve(termination).catch(() => undefined);
        } catch {
          // The grace deadline still guarantees a terminal result if the process
          // has already exited or termination itself fails.
        }
      }
      if (!settled) {
        graceHandle = setTimeout(() => settle("GRACE_EXPIRED", null, null, true), closeGraceMs);
      }
    }, options.timeoutMs);
  });
}

async function runBoundedWorker(
  args: BenchmarkArgs,
  runIndex: number,
  runRoot: string,
): Promise<LineageAllBenchmarkRunSummary> {
  const eventLogPath = join(runRoot, "events", `run-${String(runIndex).padStart(2, "0")}.jsonl`);
  const resultPath = join(runRoot, "events", `run-${String(runIndex).padStart(2, "0")}.result.json`);
  mkdirSync(dirname(eventLogPath), { recursive: true });
  const child = spawn(process.execPath, [
    "--max-old-space-size=512",
    "--import", "tsx",
    fileURLToPath(import.meta.url),
    "--worker",
    "--task-ids", args.taskIds.join(","),
    "--run-root", runRoot,
    "--event-log", eventLogPath,
    "--result-path", resultPath,
  ], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const stdoutCapture = createBoundedWorkerOutputCapture();
  const stderrCapture = createBoundedWorkerOutputCapture();
  const stdoutListener = stdoutCapture.listener;
  const stderrListener = stderrCapture.listener;
  child.stdout?.on("data", stdoutListener);
  child.stderr?.on("data", stderrListener);
  const started = performance.now();
  const lifecycle = await waitForWorkerLifecycle(child, {
    timeoutMs: args.timeoutMs,
    stdoutListener,
    stderrListener,
  });
  const elapsedMs = performance.now() - started;
  return buildRunSummary(
    runIndex,
    args.taskIds,
    eventLogPath,
    elapsedMs,
    lifecycle.timedOut,
    readWorkerEnvelope(resultPath),
    { stdout: stdoutCapture.readTail(), stderr: stderrCapture.readTail() },
  );
}

export interface BenchmarkWorkerOutputCapture {
  readonly listener: BenchmarkWorkerOutputListener;
  readonly readTail: () => string;
}

export function createBoundedWorkerOutputCapture(
  maxBytes = WORKER_OUTPUT_TAIL_BYTES,
): BenchmarkWorkerOutputCapture {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("WORKER_OUTPUT_TAIL_BYTES_INVALID");
  }
  let tail = Buffer.alloc(0);
  const listener: BenchmarkWorkerOutputListener = (data) => {
    if (data.length >= maxBytes) {
      tail = Buffer.from(data.subarray(data.length - maxBytes));
      return;
    }
    if (data.length === 0) return;
    const keptTailBytes = Math.min(tail.length, maxBytes - data.length);
    const next = Buffer.allocUnsafe(keptTailBytes + data.length);
    if (keptTailBytes > 0) {
      tail.copy(next, 0, tail.length - keptTailBytes);
    }
    data.copy(next, keptTailBytes);
    tail = next;
  };
  return {
    listener,
    readTail: () => tail.toString("utf8"),
  };
}

function printRunSummary(run: LineageAllBenchmarkRunSummary): void {
  process.stdout.write(`RUN index=${run.runIndex} mode=${run.mode} status=${run.status} elapsed_ms=${run.elapsedMs.toFixed(2)}\n`);
  process.stdout.write(`RUN location=${run.location} event_log=${run.eventLogPath}\n`);
  if (run.error) process.stdout.write(`RUN error=${run.error}\n`);
}

async function runBenchmark(args: BenchmarkArgs): Promise<void> {
  mkdirSync(CACHE_ROOT, { recursive: true });
  const runRoot = mkdtempSync(join(CACHE_ROOT, "lineage-all-stage-redline-"));
  const runs: LineageAllBenchmarkRunSummary[] = [];
  for (let runIndex = 1; runIndex <= args.runs; runIndex += 1) {
    const run = await runBoundedWorker(args, runIndex, runRoot);
    runs.push(run);
    printRunSummary(run);
    if (run.status !== "SUCCESS") break;
  }
  const evaluations = runs.slice(1).map((run) => evaluateWarmRedline(run));
  const violations = evaluations.flatMap((evaluation, index) =>
    evaluation.violations.map((violation) => `run=${index + 2} ${violation}`),
  );
  const redline = runs.length < 2
    ? { status: "NOT_EVALUATED", violations: [] as readonly string[] }
    : { status: violations.length > 0 ? "RED" : "GREEN", violations };
  const reportPath = join(runRoot, "benchmark.json");
  const report = {
    schemaVersion: "lineage-all-stage-redline-v2",
    entrypoint: "package.json scripts.lineage:all -> scripts/pipeline/lineage-all.ts -> runLineageAll",
    dataRoot: DATA_ROOT,
    runRoot,
    artifactRoot: join(runRoot, "artifacts"),
    factsRoot: join(runRoot, "field-facts"),
    producerIndexCacheRoot: join(runRoot, "producer-index-cache"),
    taskIds: args.taskIds,
    requestedRuns: args.runs,
    timeoutMs: args.timeoutMs,
    freshness: {
      factsPolicy: "current-only",
      oneHopVerifyInputFingerprint: true,
      inputPackCollection: "DISALLOWED_IN_BENCHMARK",
    },
    measurementBoundary: "Closure timing includes its traversal and nested Producer Index stages; the formal Producer Index row is the post-closure pin consumed downstream.",
    warmRedlineStages: WARM_REDLINE_STAGE_IDS,
    runs,
    redline,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`REDLINE status=${redline.status}\n`);
  for (const violation of redline.violations) process.stdout.write(`REDLINE violation=${violation}\n`);
  process.stdout.write(`REPORT path=${reportPath}\n`);
  if (runs.some((run) => run.status !== "SUCCESS") || redline.status === "RED") process.exitCode = 1;
}

async function main(): Promise<void> {
  const args = parseBenchmarkArgs(process.argv.slice(2));
  if (args.worker) {
    runWorker(args);
    return;
  }
  await runBenchmark(args);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  void main().catch((error: unknown) => {
    process.stderr.write(`LINEAGE_ALL_STAGE_REDLINE status=FAILED error=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
