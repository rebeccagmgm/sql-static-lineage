import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

type JsonObject = Record<string, unknown>;

type ChildResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

type CandidateResult = {
  index: number;
  task_id: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "TIMEOUT";
  hard_failure: boolean;
  error?: string;
  rate_limit_signal?: boolean;
  external_infrastructure_signal?: boolean;
  summary_path?: string;
  log_path: string;
};

const repoRoot = resolve(import.meta.dirname, "../..");
const defaultDataRoot = resolve(repoRoot, "../sql-static-lineage-data");
const loopScript = join(repoRoot, "scripts", "plans", "run-task-plan-loop.ts");
const tsxCli = join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positiveInt(name: string, fallback: number): number {
  const value = option(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function fraction(name: string, fallback: number): number {
  const value = option(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1)
    throw new Error(`${name} must be in (0, 1]`);
  return parsed;
}

function readTaskIds(path: string): string[] {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`task id file must be an array: ${path}`);
  return [
    ...new Set(
      parsed
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];
}

function killTree(pid: number | undefined): void {
  if (pid === undefined) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  } else {
    process.kill(pid, "SIGTERM");
  }
}

function runChild(args: readonly string[], timeoutMs: number): Promise<ChildResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [tsxCli, ...args], {
      cwd: repoRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({
        exitCode: code ?? -1,
        stdout,
        stderr,
        timedOut,
      });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolvePromise({
        exitCode: -1,
        stdout,
        stderr: `${stderr}\n${error.message}`,
        timedOut,
      });
    });
  });
}

function lastJsonLine(text: string): JsonObject | undefined {
  for (const line of text.trim().split(/\r?\n/).reverse()) {
    try {
      const parsed: unknown = JSON.parse(line);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        return parsed as JsonObject;
    } catch {}
  }
  return undefined;
}

function lastUsefulErrorLine(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return [...lines]
    .reverse()
    .find(
      (line) =>
        !/^Node\.js v\d/.test(line) &&
        !/^\(node:\d+\)/.test(line) &&
        /(?:^Error:|COMMAND_EXEC|SecurityError|DNS_PROBE_FINISHED_NXDOMAIN|getaddrinfo\s+ENOTFOUND|Pre-navigation|browser navigate command timed out|task input collection failed)/i.test(
          line,
        ),
    );
}

function hasRateLimitSignal(text: string): boolean {
  return /(?:too many requests|rate[ -]?limit(?:ed|ing)?|throttl(?:ed|ing)?|quota exceeded|限流|请求过于频繁|频率过高|\b(?:http|status|status[_ -]?code|response[_ -]?status|error[_ -]?code)[^\r\n]{0,24}\b429\b|\b429\b[^\r\n]{0,24}(?:too many|rate|throttl))/i.test(
    text,
  );
}

function hasExternalInfrastructureSignal(text: string): boolean {
  return /(?:DNS_PROBE_FINISHED_NXDOMAIN|getaddrinfo\s+ENOTFOUND|pre-navigation[^\r\n]{0,120}(?:timed out|timeout)|browser navigate command timed out|failed to read the ['\"]cookie['\"] property|site reachability\/browser extension|metadata MCP:\s*UNAVAILABLE|portalSession:\s*UNKNOWN)/i.test(
    text,
  );
}

async function main(): Promise<void> {
  const taskIdFile = resolve(
    option("--task-ids-file") ??
      join(repoRoot, "tmp", "inspect-results", "batch", "lineage-edge-task-ids.json"),
  );
  const dataRoot = resolve(option("--data-root") ?? defaultDataRoot);
  const offset = Number(option("--offset") ?? "0");
  const limit = option("--limit") === undefined ? undefined : positiveInt("--limit", 1);
  const batchSize = positiveInt("--batch-size", 10);
  const timeoutMs = positiveInt("--task-timeout-ms", 120_000);
  const maxConsecutiveFailures = positiveInt("--max-consecutive-failures", 3);
  const maxFailureRate = fraction("--max-failure-rate", 0.3);

  if (!existsSync(taskIdFile)) throw new Error(`task id file not found: ${taskIdFile}`);
  if (!Number.isInteger(offset) || offset < 0) throw new Error("--offset must be a non-negative integer");

  const allTaskIds = readTaskIds(taskIdFile);
  const taskIds = allTaskIds.slice(offset, limit === undefined ? undefined : offset + limit);
  if (taskIds.length === 0) throw new Error("no task ids selected");

  const outputPath = resolve(
    option("--output") ??
      join(repoRoot, "tmp", "inspect-results", "batch", "lineage-workbook-loop.summary.json"),
  );
  const logRoot = join(repoRoot, "tmp", "inspect-results", "batch", "lineage-workbook-logs");
  mkdirSync(logRoot, { recursive: true });
  const results: CandidateResult[] = [];
  let consecutiveFailures = 0;
  let paused = false;
  let pauseReason: string | undefined;

  const persistSummary = (
    currentPaused: boolean,
    currentPauseReason: string | undefined,
  ): void => {
    const summary = {
      pipeline: "workbook task_id -> task-source/input-pack -> plan-adapter",
      temporary: true,
      task_id_file: taskIdFile,
      data_root: dataRoot,
      selected_offset: offset,
      selected_count: taskIds.length,
      processed_count: results.length,
      remaining_count: allTaskIds.length - offset - results.length,
      batch_size: batchSize,
      task_timeout_ms: timeoutMs,
      max_consecutive_failures: maxConsecutiveFailures,
      max_failure_rate: maxFailureRate,
      paused: currentPaused,
      pause_reason: currentPauseReason,
      counts: {
        success: results.filter((item) => item.status === "SUCCESS").length,
        partial: results.filter((item) => item.status === "PARTIAL").length,
        failed: results.filter((item) => item.status === "FAILED").length,
        timeout: results.filter((item) => item.status === "TIMEOUT").length,
      },
      results,
    };
    mkdirSync(join(repoRoot, "tmp", "inspect-results", "batch"), {
      recursive: true,
    });
    writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  };

  for (let index = 0; index < taskIds.length; index += 1) {
    const taskId = taskIds[index]!;
    const absoluteIndex = offset + index;
    console.error(JSON.stringify({
      progress: "candidate_started",
      index: absoluteIndex + 1,
      total: allTaskIds.length,
      task_id: taskId,
    }));

    const child = await runChild(
      [
        loopScript,
        "--task-ids",
        taskId,
        "--collect-task-input",
        "--fetch-szdata",
      ],
      timeoutMs,
    );
    const logPath = join(logRoot, `${absoluteIndex + 1}-${taskId}.log`);
    writeFileSync(
      logPath,
      `${child.stdout}\n--- STDERR ---\n${child.stderr}`,
      "utf8",
    );

    const summaryEvent = lastJsonLine(child.stdout);
    const summaryPath =
      typeof summaryEvent?.path === "string" ? summaryEvent.path : undefined;
    let status: CandidateResult["status"] = "FAILED";
    let error: string | undefined;
    if (child.timedOut) {
      status = "TIMEOUT";
      error = `task exceeded ${timeoutMs}ms and its process tree was terminated`;
    } else if (child.exitCode === 0 && summaryPath !== undefined) {
      try {
        const batch = JSON.parse(readFileSync(summaryPath, "utf8")) as JsonObject;
        const first = Array.isArray(batch.results) ? batch.results[0] : undefined;
        status = first && typeof first === "object" && first.status === "PARTIAL" ? "PARTIAL" : "SUCCESS";
        if (first && typeof first === "object" && typeof first.error === "string") error = first.error;
      } catch (parseError) {
        status = "FAILED";
        error = `cannot read child summary: ${parseError instanceof Error ? parseError.message : String(parseError)}`;
      }
    } else {
      error =
        lastUsefulErrorLine(`${child.stderr}\n${child.stdout}`) ??
        `child exit code ${child.exitCode}`;
    }

    const rateLimitSignal = hasRateLimitSignal(
      `${child.stdout}\n${child.stderr}\n${error ?? ""}`,
    );
    const externalInfrastructureSignal = hasExternalInfrastructureSignal(
      `${child.stdout}\n${child.stderr}\n${error ?? ""}`,
    );
    const hardFailure = status === "FAILED" || status === "TIMEOUT";
    consecutiveFailures = hardFailure ? consecutiveFailures + 1 : 0;
    const result: CandidateResult = {
      index: absoluteIndex,
      task_id: taskId,
      status,
      hard_failure: hardFailure,
      ...(error ? { error } : {}),
      ...(rateLimitSignal ? { rate_limit_signal: true } : {}),
      ...(externalInfrastructureSignal
        ? { external_infrastructure_signal: true }
        : {}),
      ...(summaryPath ? { summary_path: summaryPath } : {}),
      log_path: logPath,
    };
    results.push(result);
    persistSummary(false, undefined);
    console.error(JSON.stringify({ progress: "candidate_finished", ...result }));

    if (rateLimitSignal) {
      paused = true;
      pauseReason = "explicit rate-limit/throttling signal detected in child output";
      break;
    }

    if (externalInfrastructureSignal) {
      paused = true;
      pauseReason =
        "external SZData/browser/network infrastructure failure detected";
      break;
    }

    const batchResults = results.slice(-batchSize);
    const batchHardFailures = batchResults.filter((item) => item.hard_failure).length;
    if (
      consecutiveFailures >= maxConsecutiveFailures ||
      batchHardFailures / batchResults.length >= maxFailureRate
    ) {
      paused = true;
      pauseReason =
        consecutiveFailures >= maxConsecutiveFailures
          ? `consecutive hard failures reached ${maxConsecutiveFailures}`
          : `hard failure rate reached ${maxFailureRate} in the latest ${batchResults.length} task(s)`;
      break;
    }

    if ((index + 1) % batchSize === 0)
      console.error(JSON.stringify({ progress: "batch_checkpoint", completed: absoluteIndex + 1, total: allTaskIds.length }));
  }

  persistSummary(paused, pauseReason);
  console.log(JSON.stringify({ progress: "guarded_summary_written", path: outputPath, paused, processed: results.length }));
}

await main();
