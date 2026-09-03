import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { HoraeSerialGate } from "./collect-one-task-input-pack-sparkindex.ts";
import {
  taskIdsFromFile,
  taskIdsFromScheduleEvidenceCache,
} from "./fill-horae-relation-cache.ts";
import {
  defaultHiveTaskCodeRoot,
  extractHiveTaskSqlFromScript,
  readHiveTaskSqlCache,
  resolveLocalHiveTaskScriptPath,
  sqlSlotsFromMcpResponse,
  writeHiveTaskSqlCache,
  HIVE_TASK_SQL_LEGACY_CACHE_FILE_NAME,
  type HiveTaskSqlEvidence,
} from "./hive-task-sql-cache.ts";
import {
  DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT,
  readHoraeTaskTypeCache,
} from "../../reconcile/consumer/one-hop/schedule-evidence-cache.ts";

const HIVE_TASK_TYPES = new Set(["hiveTask", "hiveTask-2.0"]);
const SAFE_TASK_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const DEFAULT_MAX_ERRORS = 0;
const DEFAULT_MIN_INTERVAL_MS = 5_000;
const DEFAULT_MCP_TIMEOUT_MS = 30_000;

export type HiveTaskSqlMcpRunner = (taskId: string) => unknown;

export interface FillHiveTaskSqlCacheOptions {
  readonly cacheRoot?: string;
  readonly codeRoot?: string;
  readonly taskIds?: readonly string[];
  readonly startTaskId?: string;
  readonly limit?: number;
  readonly maxErrors?: number;
  readonly minIntervalMs?: number;
  readonly mcpRunner?: HiveTaskSqlMcpRunner;
  readonly gate?: HoraeSerialGate;
  readonly now?: () => Date;
  readonly force?: boolean;
}

export interface HiveTaskSqlFillError {
  readonly taskId: string;
  readonly message: string;
}

export interface FillHiveTaskSqlCacheSummary {
  readonly total: number;
  readonly skipped: number;
  readonly cached: number;
  readonly localCached: number;
  readonly mcpCached: number;
  readonly mcpEmpty: number;
  readonly errors: number;
  readonly maxErrors: number;
  readonly minIntervalMs: number;
  readonly startTaskId: string | null;
  readonly failedTaskIds: readonly string[];
  readonly errorDetails: readonly HiveTaskSqlFillError[];
  readonly stopped: boolean;
}

function hiveTaskScriptPath(detail: Record<string, unknown>): string | null {
  return optionalText(detail.scriptPath) ?? optionalText(detail.fileName);
}

export function hiveTaskIdsFromHoraeTypeCache(cacheRoot: string): string[] {
  return taskIdsFromScheduleEvidenceCache(cacheRoot).filter((taskId) => {
    const cached = readHoraeTaskTypeCache(taskId, cacheRoot);
    if (cached.status !== "HIT") return false;
    const taskType = cached.detail.taskType;
    if (typeof taskType !== "string" || !HIVE_TASK_TYPES.has(taskType))
      return false;
    return hiveTaskScriptPath(cached.detail) !== null;
  });
}

export function hiveTaskSqlMcpCommandArguments(
  taskId: string,
): readonly string[] {
  return [
    "szdata",
    "task-sql",
    "--task-id",
    taskId,
    "--full",
    "true",
    "-f",
    "json",
  ];
}

export function runHiveTaskSqlMcp(taskId: string): unknown {
  if (!SAFE_TASK_ID.test(taskId))
    throw new Error(`HIVE_TASK_SQL_INVALID_TASK:${taskId}`);
  const executable =
    process.platform === "win32"
      ? (process.env.ComSpec ?? "cmd.exe")
      : "opencli";
  const executableArgs =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "opencli.cmd", ...hiveTaskSqlMcpCommandArguments(taskId)]
      : [...hiveTaskSqlMcpCommandArguments(taskId)];
  const timeoutMs = Number.parseInt(
    process.env.INPUT_PACK_HIVE_TASK_SQL_MCP_TIMEOUT_MS ?? "",
    10,
  );
  const effectiveTimeoutMs =
    Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : DEFAULT_MCP_TIMEOUT_MS;
  const output = execFileSync(executable, executableArgs, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    timeout: effectiveTimeoutMs,
  });
  return JSON.parse(output);
}

function nonNegativeInteger(
  value: number | undefined,
  fallback: number,
  code: string,
): number {
  const effective = value ?? fallback;
  if (!Number.isSafeInteger(effective) || effective < 0) throw new Error(code);
  return effective;
}

function fromStartTaskId(
  taskIds: readonly string[],
  startTaskId: string | undefined,
): string[] {
  if (startTaskId === undefined) return [...taskIds];
  if (!SAFE_TASK_ID.test(startTaskId)) throw new Error("START_TASK_ID_INVALID");
  const index = taskIds.findIndex(
    (taskId) =>
      taskId.localeCompare(startTaskId, "en-US", { numeric: true }) >= 0,
  );
  return index < 0 ? [] : taskIds.slice(index);
}

function selectedTaskIds(
  taskIds: readonly string[],
  limit: number | undefined,
): string[] {
  if (limit === undefined) return [...taskIds];
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("LIMIT_INVALID");
  return taskIds.slice(0, limit);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "-" ? null : trimmed;
}

function evidenceFromLocal(
  codeRoot: string,
  scriptPath: string | null,
  hiveDb: string | null,
): HiveTaskSqlEvidence | null {
  const localPath = resolveLocalHiveTaskScriptPath(codeRoot, scriptPath);
  if (localPath === null || !existsSync(localPath)) return null;
  const extracted = extractHiveTaskSqlFromScript(readFileSync(localPath, "utf8"));
  if (extracted.createSql === null && extracted.querySql === null) return null;
  return {
    source: "LOCAL_CODE",
    sqlStatus: "AVAILABLE",
    scriptPath,
    hiveDb,
    createSql: extracted.createSql,
    querySql: extracted.querySql,
  };
}

function shouldStop(errors: number, maxErrors: number): boolean {
  return maxErrors > 0 && errors >= maxErrors;
}

/**
 * Fill hiveTask / hiveTask-2.0 SQL cache files.
 * Only tasks with scriptPath/fileName are selected. Local BigData checkout
 * is written first; MCP is only used for remaining misses, and only MCP
 * calls honor --interval-ms. Empty MCP SQL is recorded as UNAVAILABLE and
 * does not stop the batch. `--force` re-extracts from local code over existing
 * HIT files and retries existing UNAVAILABLE files through MCP when local code
 * is unavailable; AVAILABLE evidence is preserved.
 */
export async function fillHiveTaskSqlCache(
  options: FillHiveTaskSqlCacheOptions = {},
): Promise<FillHiveTaskSqlCacheSummary> {
  const cacheRoot = options.cacheRoot ?? DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT;
  const codeRoot = options.codeRoot ?? defaultHiveTaskCodeRoot(cacheRoot);
  const force = options.force === true;
  const maxErrors = nonNegativeInteger(
    options.maxErrors,
    DEFAULT_MAX_ERRORS,
    "MAX_ERRORS_INVALID",
  );
  const minIntervalMs = nonNegativeInteger(
    options.minIntervalMs,
    DEFAULT_MIN_INTERVAL_MS,
    "HIVE_TASK_SQL_MIN_INTERVAL_INVALID",
  );
  const taskIds = selectedTaskIds(
    fromStartTaskId(
      options.taskIds ?? hiveTaskIdsFromHoraeTypeCache(cacheRoot),
      options.startTaskId,
    ),
    options.limit,
  );
  const gate = options.gate ?? new HoraeSerialGate({ minIntervalMs });
  const mcpRunner = options.mcpRunner ?? runHiveTaskSqlMcp;
  const now = options.now ?? (() => new Date());
  let skipped = 0;
  let localCached = 0;
  let mcpCached = 0;
  let mcpEmpty = 0;
  let errors = 0;
  let stopped = false;
  const failedTaskIds: string[] = [];
  const errorDetails: HiveTaskSqlFillError[] = [];
  const pendingMcp: Array<{
    readonly taskId: string;
    readonly scriptPath: string | null;
    readonly hiveDb: string | null;
    readonly overwrite: boolean;
  }> = [];

  for (const taskId of taskIds) {
    const existing = readHiveTaskSqlCache(taskId, cacheRoot);
    const typeCache = readHoraeTaskTypeCache(taskId, cacheRoot);
    const scriptPath =
      typeCache.status === "HIT" ? hiveTaskScriptPath(typeCache.detail) : null;
    const hiveDb =
      typeCache.status === "HIT" ? optionalText(typeCache.detail.hiveDb) : null;
    if (existing.status === "HIT" && !force) {
      if (existing.path.endsWith(HIVE_TASK_SQL_LEGACY_CACHE_FILE_NAME)) {
        writeHiveTaskSqlCache(
          taskId,
          existing.observedAt,
          existing,
          cacheRoot,
        );
      }
      skipped += 1;
      continue;
    }
    try {
      const local = evidenceFromLocal(codeRoot, scriptPath, hiveDb);
      if (local === null) {
        if (existing.status === "HIT" && existing.sqlStatus === "AVAILABLE") {
          skipped += 1;
          continue;
        }
        pendingMcp.push({
          taskId,
          scriptPath,
          hiveDb,
          overwrite: existing.status === "HIT",
        });
        continue;
      }
      writeHiveTaskSqlCache(
        taskId,
        now().toISOString(),
        local,
        cacheRoot,
        { overwrite: existing.status === "HIT" },
      );
      localCached += 1;
    } catch (error) {
      errors += 1;
      failedTaskIds.push(taskId);
      errorDetails.push({ taskId, message: errorMessage(error) });
      if (shouldStop(errors, maxErrors)) {
        stopped = true;
        break;
      }
    }
  }

  if (!stopped) {
    process.stderr.write(
      `[hive-task-sql-cache] local done ${JSON.stringify({
        localCached,
        skipped,
        pendingMcp: pendingMcp.length,
      })}\n`,
    );
    for (const item of pendingMcp) {
      try {
        gate.beforeCall();
        const slots = sqlSlotsFromMcpResponse(
          await Promise.resolve(mcpRunner(item.taskId)),
          item.taskId,
        );
        const available = slots.createSql !== null || slots.querySql !== null;
        writeHiveTaskSqlCache(
          item.taskId,
          now().toISOString(),
          {
            source: "SQL_MCP",
            sqlStatus: available ? "AVAILABLE" : "UNAVAILABLE",
            scriptPath: item.scriptPath,
            hiveDb: item.hiveDb,
            createSql: slots.createSql,
            querySql: slots.querySql,
          },
          cacheRoot,
          { overwrite: item.overwrite },
        );
        if (available) mcpCached += 1;
        else mcpEmpty += 1;
      } catch (error) {
        errors += 1;
        failedTaskIds.push(item.taskId);
        errorDetails.push({ taskId: item.taskId, message: errorMessage(error) });
        if (shouldStop(errors, maxErrors)) {
          stopped = true;
          break;
        }
      }
    }
  }

  return {
    total: taskIds.length,
    skipped,
    cached: localCached + mcpCached,
    localCached,
    mcpCached,
    mcpEmpty,
    errors,
    maxErrors,
    minIntervalMs,
    startTaskId: options.startTaskId ?? null,
    failedTaskIds,
    errorDetails,
    stopped,
  };
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

function parseIntegerOption(
  name: string,
  fallback: number | undefined,
  allowZero: boolean,
): number | undefined {
  const raw = option(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || (allowZero ? value < 0 : value < 1))
    throw new Error(
      `${name.slice(2).toUpperCase().replaceAll("-", "_")}_INVALID`,
    );
  return value;
}

async function main(): Promise<void> {
  const cacheRoot =
    option("--cache-root") ?? DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT;
  const startTaskId = option("--start-task-id");
  const maxErrors = parseIntegerOption("--max-errors", undefined, true);
  const minIntervalMs = parseIntegerOption("--interval-ms", undefined, true);
  const taskIdsFile = option("--task-ids-file");
  const taskIds = taskIdsFile ? taskIdsFromFile(taskIdsFile) : undefined;
  const force = process.argv.includes("--force");
  process.stderr.write(
    `[hive-task-sql-cache] start ${JSON.stringify({
      cacheRoot,
      codeRoot: option("--code-root") ?? defaultHiveTaskCodeRoot(cacheRoot),
      startTaskId: startTaskId ?? null,
      taskIdsFile: taskIdsFile ?? null,
      taskIds: taskIds?.length ?? null,
      maxErrors: maxErrors ?? DEFAULT_MAX_ERRORS,
      minIntervalMs: minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS,
      force,
    })}\n`,
  );
  const summary = await fillHiveTaskSqlCache({
    cacheRoot,
    codeRoot: option("--code-root"),
    startTaskId,
    taskIds,
    limit: parseIntegerOption("--limit", undefined, false),
    maxErrors,
    minIntervalMs,
    force,
  });
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (summary.errors > 0) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("fill-hive-task-sql-cache.ts")) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = 1;
  }
}
