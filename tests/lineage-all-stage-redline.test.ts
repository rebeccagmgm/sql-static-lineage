import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type BenchmarkWorkerChild,
  type BenchmarkWorkerCloseListener,
  type BenchmarkWorkerErrorListener,
  type BenchmarkWorkerOutputListener,
  type BenchmarkWorkerStream,
  createBoundedWorkerOutputCapture,
  createWorkerStageObserver,
  evaluateWarmRedline,
  parseBenchmarkArgs,
  summarizeStageEvents,
  type LineageAllBenchmarkRunSummary,
  type TaskkillLauncher,
  terminateWorkerProcessTree,
  waitForWorkerLifecycle,
} from "../scripts/benchmarks/lineage-all-stage-redline-benchmark.ts";
import type {
  LineageAllStageEvent,
  LineageAllStageId,
  LineageAllStageReuseStatus,
} from "../scripts/pipeline/lineage-all.ts";
import { runLineageAll } from "../scripts/pipeline/lineage-all.ts";

function event(
  taskId: string,
  stage: LineageAllStageId,
  phase: "start" | "end",
  elapsedMs: number,
  status: "STARTED" | "SUCCESS" | "FAILED",
  reuseStatus: LineageAllStageReuseStatus,
): LineageAllStageEvent {
  return { taskId, stage, phase, elapsedMs, status, reuseStatus };
}

function rerunWithEvents(events: readonly LineageAllStageEvent[]): LineageAllBenchmarkRunSummary {
  return {
    runIndex: 2,
    mode: "rerun",
    status: "SUCCESS",
    elapsedMs: 100,
    eventLogPath: "events/run-02.jsonl",
    tasks: [{
      taskId: "181058",
      status: "SUCCESS",
      artifactDir: "artifact/tasks/181058",
      files: [],
      stages: summarizeStageEvents("181058", events),
    }],
  };
}

class FakeWorkerChild implements BenchmarkWorkerChild {
  private closeListener: BenchmarkWorkerCloseListener | undefined;
  private errorListener: BenchmarkWorkerErrorListener | undefined;
  readonly removedLifecycleListeners: string[] = [];
  unrefCalls = 0;

  constructor(
    readonly pid: number,
    readonly stdout?: BenchmarkWorkerStream,
    readonly stderr?: BenchmarkWorkerStream,
  ) {}

  once(event: "close", listener: BenchmarkWorkerCloseListener): this;
  once(event: "error", listener: BenchmarkWorkerErrorListener): this;
  once(
    event: "close" | "error",
    listener: BenchmarkWorkerCloseListener | BenchmarkWorkerErrorListener,
  ): this {
    if (event === "close") {
      this.closeListener = listener as BenchmarkWorkerCloseListener;
    } else {
      this.errorListener = listener as BenchmarkWorkerErrorListener;
    }
    return this;
  }

  removeListener(
    event: "close" | "error",
    listener: BenchmarkWorkerCloseListener | BenchmarkWorkerErrorListener,
  ): this {
    this.removedLifecycleListeners.push(event);
    if (event === "close" && listener === this.closeListener) this.closeListener = undefined;
    if (event === "error" && listener === this.errorListener) this.errorListener = undefined;
    return this;
  }

  unref(): this {
    this.unrefCalls += 1;
    return this;
  }

  emitClose(exitCode: number | null, signal: NodeJS.Signals | null = null): void {
    const listener = this.closeListener;
    this.closeListener = undefined;
    listener?.(exitCode, signal);
  }

  emitError(error: Error): void {
    const listener = this.errorListener;
    this.errorListener = undefined;
    listener?.(error);
  }
}

class FakeWorkerStream implements BenchmarkWorkerStream {
  readonly removedListeners: BenchmarkWorkerOutputListener[] = [];
  destroyed = false;
  private dataListener: BenchmarkWorkerOutputListener | undefined;

  on(_event: "data", listener: BenchmarkWorkerOutputListener): this {
    this.dataListener = listener;
    return this;
  }

  removeListener(_event: "data", listener: BenchmarkWorkerOutputListener): this {
    this.removedListeners.push(listener);
    if (listener === this.dataListener) this.dataListener = undefined;
    return this;
  }

  destroy(): void {
    this.destroyed = true;
  }

  emitData(data: Buffer): void {
    this.dataListener?.(data);
  }
}

class FakeTaskkillProcess extends ChildProcess {
  killed = false;
  unrefCalls = 0;

  kill(_signal?: NodeJS.Signals | number): boolean {
    this.killed = true;
    return true;
  }

  unref(): void {
    this.unrefCalls += 1;
  }

  emitClose(exitCode: number | null, signal: NodeJS.Signals | null = null): void {
    this.emit("close", exitCode, signal);
  }

  emitError(error = new Error("taskkill failed")): void {
    this.emit("error", error);
  }
}

function createTaskkillLauncher(
  taskkill: FakeTaskkillProcess,
  onLaunch?: (command: string, args: readonly string[]) => void,
): TaskkillLauncher {
  return (command, args) => {
    onLaunch?.(command, args);
    return taskkill;
  };
}

describe("lineage:all stage redline", () => {
  afterEach(() => vi.useRealTimers());

  it("normalizes a taskkill failure and keeps the exact process-tree target", async () => {
    vi.useFakeTimers();
    const taskkill = new FakeTaskkillProcess();
    let command = "";
    let args: readonly string[] = [];
    const pending = terminateWorkerProcessTree(4104, {
      taskkillTimeoutMs: 25,
      spawnTaskkill: createTaskkillLauncher(taskkill, (startedCommand, startedArgs) => {
        command = startedCommand;
        args = startedArgs;
      }),
    });

    taskkill.emitError();

    await expect(pending).resolves.toBe("FAILED");
    expect(command).toBe("taskkill");
    expect(args).toEqual(["/PID", "4104", "/T", "/F"]);
    expect(taskkill.unrefCalls).toBe(1);
  });

  it("normalizes a taskkill timeout without waiting for the helper", async () => {
    vi.useFakeTimers();
    const taskkill = new FakeTaskkillProcess();
    const pending = terminateWorkerProcessTree(4105, {
      taskkillTimeoutMs: 10,
      spawnTaskkill: createTaskkillLauncher(taskkill),
    });

    await vi.advanceTimersByTimeAsync(10);

    await expect(pending).resolves.toBe("TIMEOUT");
    expect(taskkill.killed).toBe(true);
  });

  it("settles a normally closed worker with its exit code", async () => {
    vi.useFakeTimers();
    const child = new FakeWorkerChild(4101);
    const terminateProcessTree = vi.fn();
    const pending = waitForWorkerLifecycle(child, {
      timeoutMs: 100,
      closeGraceMs: 25,
      terminateProcessTree,
    });

    child.emitClose(0);

    await expect(pending).resolves.toMatchObject({
      state: "CLOSED",
      timedOut: false,
      closed: true,
      exitCode: 0,
    });
    expect(terminateProcessTree).not.toHaveBeenCalled();
  });

  it("settles a non-zero worker exit without classifying it as a timeout", async () => {
    vi.useFakeTimers();
    const child = new FakeWorkerChild(4102);
    const pending = waitForWorkerLifecycle(child, {
      timeoutMs: 100,
      closeGraceMs: 25,
      terminateProcessTree: vi.fn(),
    });

    child.emitClose(17);

    await expect(pending).resolves.toMatchObject({
      state: "CLOSED",
      timedOut: false,
      closed: true,
      exitCode: 17,
    });
  });

  it("terminates the exact worker PID and settles after the timeout grace", async () => {
    vi.useFakeTimers();
    const stdout = new FakeWorkerStream();
    const stderr = new FakeWorkerStream();
    const taskkill = new FakeTaskkillProcess();
    const child = new FakeWorkerChild(4103, stdout, stderr);
    const terminateProcessTree = vi.fn((pid: number) => terminateWorkerProcessTree(pid, {
      taskkillTimeoutMs: 5,
      spawnTaskkill: createTaskkillLauncher(taskkill),
    }));
    const stdoutListener: BenchmarkWorkerOutputListener = () => undefined;
    const stderrListener: BenchmarkWorkerOutputListener = () => undefined;
    const pending = waitForWorkerLifecycle(child, {
      timeoutMs: 10,
      closeGraceMs: 25,
      terminateProcessTree,
      stdoutListener,
      stderrListener,
    });
    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(terminateProcessTree).toHaveBeenCalledTimes(1);
    expect(terminateProcessTree).toHaveBeenCalledWith(4103);
    expect(taskkill.killed).toBe(false);
    await vi.advanceTimersByTimeAsync(5);
    expect(taskkill.killed).toBe(true);
    expect(settled).toBe(false);

    child.emitClose(0);
    expect(settled).toBe(false);

    // The taskkill timeout advanced the clock by 5ms while the grace timer was already running.
    await vi.advanceTimersByTimeAsync(19);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expect(pending).resolves.toEqual({
      state: "GRACE_EXPIRED",
      timedOut: true,
      closed: false,
      exitCode: null,
      signal: null,
    });
    expect(stdout.removedListeners).toEqual([stdoutListener]);
    expect(stderr.removedListeners).toEqual([stderrListener]);
    expect(stdout.destroyed).toBe(true);
    expect(stderr.destroyed).toBe(true);
    expect(child.removedLifecycleListeners).toEqual(["close", "error"]);
    expect(child.unrefCalls).toBe(1);
  });

  it("keeps the outer timeout live under sustained bounded stdout/stderr pressure", async () => {
    vi.useFakeTimers();
    const stdout = new FakeWorkerStream();
    const stderr = new FakeWorkerStream();
    const child = new FakeWorkerChild(4110, stdout, stderr);
    const terminateProcessTree = vi.fn();
    const stdoutCapture = createBoundedWorkerOutputCapture(32);
    const stderrCapture = createBoundedWorkerOutputCapture(32);
    stdout.on("data", stdoutCapture.listener);
    stderr.on("data", stderrCapture.listener);
    const pending = waitForWorkerLifecycle(child, {
      timeoutMs: 10,
      closeGraceMs: 10,
      terminateProcessTree,
      stdoutListener: stdoutCapture.listener,
      stderrListener: stderrCapture.listener,
    });
    const pressure = setInterval(() => {
      const chunk = Buffer.alloc(128, "x");
      stdout.emitData(chunk);
      stderr.emitData(chunk);
    }, 1);

    await vi.advanceTimersByTimeAsync(10);
    expect(terminateProcessTree).toHaveBeenCalledWith(4110);
    await vi.advanceTimersByTimeAsync(10);
    clearInterval(pressure);

    await expect(pending).resolves.toMatchObject({
      state: "GRACE_EXPIRED",
      timedOut: true,
      closed: false,
    });
    expect(Buffer.byteLength(stdoutCapture.readTail(), "utf8")).toBeLessThanOrEqual(32);
    expect(Buffer.byteLength(stderrCapture.readTail(), "utf8")).toBeLessThanOrEqual(32);
    expect(stdout.destroyed).toBe(true);
    expect(stderr.destroyed).toBe(true);
  });

  it("emits each real stage start before its end in pipeline order", () => {
    const root = mkdtempSync(join(tmpdir(), "lineage-stage-events-"));
    mkdirSync(join(root, "tasks"), { recursive: true });
    mkdirSync(join(root, "tables"), { recursive: true });
    const events: LineageAllStageEvent[] = [];
    const result = runLineageAll({
      dataRoot: root,
      taskIds: ["181058"],
      stageObserver: (observed) => events.push(observed),
      dependencies: {
        autofill: ({ taskId }) => ({
          taskIds: [taskId],
          discoveredTaskIds: [taskId],
          collectedTaskIds: [],
          rounds: 1,
          status: "COMPLETE",
          issues: [],
        }),
        producerIndex: () => ({
          index: {} as any,
          manifest: {} as any,
          inputFingerprint: "fingerprint",
          indexPath: "index",
          manifestPath: "manifest",
          reused: true,
        }),
        machineFacts: () => ({
          tasks: [],
          timings: { index_mode: "incremental" },
        }) as any,
        oneHopBatch: (taskIds) => taskIds.map((taskId) => ({ schemaVersion: "1.1.0", taskId, generatedAt: "now" }) as any),
        multiHop: (taskId) => ({ schemaVersion: "1.1.0", rootTaskId: taskId }) as any,
        visualizeMultiHop: ({ outputPath }) => {
          mkdirSync(dirname(outputPath!), { recursive: true });
          writeFileSync(outputPath!, "<html></html>\n");
          return outputPath!;
        },
      },
    });

    expect(result.status).toBe("SUCCESS");
    expect(events.map((observed) => `${observed.stage}:${observed.phase}`)).toEqual([
      "input-pack-closure:start",
      "input-pack-closure:end",
      "producer-index:start",
      "producer-index:end",
      "machine-facts:start",
      "machine-facts:end",
      "one-hop:start",
      "one-hop:end",
      "multi-hop:start",
      "multi-hop:end",
      "json-write:start",
      "json-write:end",
      "html-render:start",
      "html-render:end",
      "publish:start",
      "publish:end",
    ]);
    expect(events.every((observed) => observed.elapsedMs >= 0)).toBe(true);
  });

  it("writes a worker stage event to the requested event log without synchronous stdout writes", () => {
    const root = mkdtempSync(join(tmpdir(), "lineage-worker-event-log-"));
    const eventLogPath = join(root, "events", "run-01.jsonl");
    mkdirSync(dirname(eventLogPath), { recursive: true });
    const eventFd = openSync(eventLogPath, "a");
    const stdoutWriter = vi.fn();
    const observed = event("181058", "input-pack-closure", "start", 0, "STARTED", "NOT_APPLICABLE");

    try {
      createWorkerStageObserver(eventFd, stdoutWriter)(observed);
    } finally {
      closeSync(eventFd);
    }

    expect(readFileSync(eventLogPath, "utf8")).toBe(`${JSON.stringify(observed)}\n`);
    expect(stdoutWriter).toHaveBeenCalledWith(`${JSON.stringify(observed)}\n`);
  });

  it("parses task ids, run count, and bounded timeout", () => {
    expect(parseBenchmarkArgs(["--task-ids", "176827", "--runs", "1", "--timeout-ms", "30000"]))
      .toMatchObject({ taskIds: ["176827"], runs: 1, timeoutMs: 30000, worker: false });
  });

  it("preserves start/end event order and aggregates only completed elapsed time", () => {
    const summaries = summarizeStageEvents("181058", [
      event("181058", "producer-index", "start", 0, "STARTED", "NOT_APPLICABLE"),
      event("181058", "producer-index", "end", 12, "SUCCESS", "REUSED"),
      event("181058", "json-write", "start", 0, "STARTED", "NOT_APPLICABLE"),
      event("181058", "json-write", "end", 3, "SUCCESS", "NOT_REUSED"),
      event("181058", "json-write", "start", 0, "STARTED", "NOT_APPLICABLE"),
    ]);

    expect(summaries.find((stage) => stage.stage === "producer-index")).toMatchObject({
      callState: "CALLED",
      calls: 1,
      elapsedMs: 12,
      reuseStatuses: ["REUSED"],
    });
    expect(summaries.find((stage) => stage.stage === "json-write")).toMatchObject({
      callState: "CALLED",
      calls: 2,
      elapsedMs: 3,
    });
    expect(summaries.find((stage) => stage.stage === "json-write")?.events.map((item) => item.phase))
      .toEqual(["start", "end", "start"]);
  });

  it("marks a rerun red when any forbidden main-chain stage is called", () => {
    const result = evaluateWarmRedline(rerunWithEvents([
      event("181058", "one-hop", "start", 0, "STARTED", "NOT_APPLICABLE"),
      event("181058", "one-hop", "end", 11, "SUCCESS", "NOT_REUSED"),
      event("181058", "multi-hop", "start", 0, "STARTED", "NOT_APPLICABLE"),
      event("181058", "multi-hop", "end", 22, "SUCCESS", "NOT_REUSED"),
      event("181058", "field-lineage-reconcile", "start", 0, "STARTED", "NOT_APPLICABLE"),
      event("181058", "field-lineage-reconcile", "end", 33, "SUCCESS", "NOT_REUSED"),
      event("181058", "html-render", "start", 0, "STARTED", "NOT_APPLICABLE"),
      event("181058", "html-render", "end", 44, "SUCCESS", "NOT_REUSED"),
    ]));

    expect(result.status).toBe("RED");
    expect(result.violations).toHaveLength(4);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.stringContaining("stage=one-hop"),
      expect.stringContaining("stage=multi-hop"),
      expect.stringContaining("stage=field-lineage-reconcile"),
      expect.stringContaining("stage=html-render"),
    ]));
  });

  it("does not mark persistence-only stages red", () => {
    const result = evaluateWarmRedline(rerunWithEvents([
      event("181058", "input-pack-closure", "start", 0, "STARTED", "NOT_APPLICABLE"),
      event("181058", "input-pack-closure", "end", 10, "SUCCESS", "INPUT_PACK_PRESENT"),
      event("181058", "producer-index", "start", 0, "STARTED", "NOT_APPLICABLE"),
      event("181058", "producer-index", "end", 2, "SUCCESS", "REUSED"),
      event("181058", "machine-facts", "start", 0, "STARTED", "NOT_APPLICABLE"),
      event("181058", "machine-facts", "end", 4, "SUCCESS", "REUSED"),
    ]));

    expect(result).toEqual({ status: "GREEN", violations: [] });
  });
});
