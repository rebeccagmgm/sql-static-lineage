import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  HoraeSerialGate,
} from "./collect-one-task-input-pack-sparkindex.ts";
import {
  DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT,
  readHoraeRelationCache,
  resolveScheduleEvidenceCacheRoot,
  writeHoraeRelationCache,
  type HoraeRelationDirection,
} from "../../reconcile/consumer/one-hop/schedule-evidence-cache.ts";

const SAFE_TASK_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const DEFAULT_MAX_ERRORS = 3;
const DEFAULT_MIN_INTERVAL_MS = 2_000;
const DEFAULT_DIRECTION: HoraeRelationDirection = "down";
const DEFAULT_HORAE_TIMEOUT_MS = 90_000;

export type HoraeRelationRunner = (
  taskId: string,
  direction: HoraeRelationDirection,
) => unknown;

export interface FillHoraeRelationCacheOptions {
  readonly cacheRoot?: string;
  readonly taskIds?: readonly string[];
  readonly startTaskId?: string;
  readonly limit?: number;
  readonly maxErrors?: number;
  readonly minIntervalMs?: number;
  readonly direction?: HoraeRelationDirection;
  readonly runner?: HoraeRelationRunner;
  readonly gate?: HoraeSerialGate;
  readonly now?: () => Date;
}

export interface HoraeRelationFillError {
  readonly taskId: string;
  readonly message: string;
}

export interface FillHoraeRelationCacheSummary {
  readonly total: number;
  readonly skipped: number;
  readonly cached: number;
  readonly errors: number;
  readonly maxErrors: number;
  readonly minIntervalMs: number;
  readonly direction: HoraeRelationDirection;
  readonly startTaskId: string | null;
  readonly failedTaskIds: readonly string[];
  readonly errorDetails: readonly HoraeRelationFillError[];
  readonly stopped: boolean;
}

export function taskIdsFromScheduleEvidenceCache(cacheRoot: string): string[] {
  const tasksRoot = join(resolveScheduleEvidenceCacheRoot(cacheRoot), "tasks");
  if (!existsSync(tasksRoot))
    throw new Error(`CACHE_TASKS_ROOT_MISSING:${tasksRoot}`);
  return readdirSync(tasksRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && SAFE_TASK_ID.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) =>
      left.localeCompare(right, "en-US", { numeric: true }),
    );
}

export function horaeRelationCommandArguments(
  taskId: string,
  direction: HoraeRelationDirection,
): readonly string[] {
  return [
    "horae",
    "relation",
    taskId,
    "--direction",
    direction,
    "--depth",
    "1",
    "-f",
    "json",
  ];
}

export function runHoraeRelation(
  taskId: string,
  direction: HoraeRelationDirection = DEFAULT_DIRECTION,
): unknown {
  if (!SAFE_TASK_ID.test(taskId))
    throw new Error(`HORAE_RELATION_INVALID_TASK:${taskId}`);
  const executable =
    process.platform === "win32"
      ? (process.env.ComSpec ?? "cmd.exe")
      : "opencli";
  const executableArgs =
    process.platform === "win32"
      ? [
          "/d",
          "/s",
          "/c",
          "opencli.cmd",
          ...horaeRelationCommandArguments(taskId, direction),
        ]
      : [...horaeRelationCommandArguments(taskId, direction)];
  const timeoutMs = Number.parseInt(
    process.env.INPUT_PACK_HORAE_RELATION_TIMEOUT_MS ?? "",
    10,
  );
  const effectiveTimeoutMs =
    Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : DEFAULT_HORAE_TIMEOUT_MS;
  const output = execFileSync(executable, executableArgs, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      OPENCLI_BROWSER_COMMAND_TIMEOUT: String(
        Math.ceil(effectiveTimeoutMs / 1000),
      ),
    },
    timeout: effectiveTimeoutMs,
  });
  return JSON.parse(output);
}

export function rowsOfHoraeRelation(
  value: unknown,
  taskId: string,
): Record<string, unknown>[] {
  if (Array.isArray(value))
    return value.map((row) => {
      if (typeof row !== "object" || row === null || Array.isArray(row))
        throw new Error(`HORAE_RELATION_INVALID_ROWS:${taskId}`);
      const record = row as Record<string, unknown>;
      const rowTask = record.task_id ?? record.taskId;
      if (typeof rowTask !== "string" || !SAFE_TASK_ID.test(rowTask))
        throw new Error(`HORAE_RELATION_INVALID_ROWS:${taskId}`);
      return record;
    });
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`HORAE_RELATION_INVALID_ENVELOPE:${taskId}`);
  const record = value as Record<string, unknown>;
  if (
    record.error !== undefined ||
    record.success === false ||
    ["fail", "failed", "failure", "error"].includes(
      String(record.status ?? "").toLowerCase(),
    )
  )
    throw new Error(`HORAE_RELATION_INVALID_ENVELOPE:${taskId}`);
  for (const field of ["records", "rows", "data", "results"]) {
    if (Array.isArray(record[field]))
      return rowsOfHoraeRelation(record[field], taskId);
  }
  throw new Error(`HORAE_RELATION_INVALID_ENVELOPE:${taskId}`);
}

function positiveInteger(
  value: number | undefined,
  fallback: number,
  code: string,
): number {
  const effective = value ?? fallback;
  if (!Number.isSafeInteger(effective) || effective < 1) throw new Error(code);
  return effective;
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

function parseDirection(
  value: string | undefined,
): HoraeRelationDirection {
  if (value === undefined) return DEFAULT_DIRECTION;
  if (value === "up" || value === "down") return value;
  throw new Error("DIRECTION_INVALID");
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

/**
 * Fill one-hop Horae relation cache files serially.
 * Existing HIT artifacts are skipped; resume with --start-task-id.
 */
export async function fillHoraeRelationCache(
  options: FillHoraeRelationCacheOptions = {},
): Promise<FillHoraeRelationCacheSummary> {
  const cacheRoot = options.cacheRoot ?? DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT;
  const direction = options.direction ?? DEFAULT_DIRECTION;
  const maxErrors = positiveInteger(
    options.maxErrors,
    DEFAULT_MAX_ERRORS,
    "MAX_ERRORS_INVALID",
  );
  const minIntervalMs = nonNegativeInteger(
    options.minIntervalMs,
    DEFAULT_MIN_INTERVAL_MS,
    "HORAE_RELATION_MIN_INTERVAL_INVALID",
  );
  const taskIds = selectedTaskIds(
    fromStartTaskId(
      options.taskIds ?? taskIdsFromScheduleEvidenceCache(cacheRoot),
      options.startTaskId,
    ),
    options.limit,
  );
  const gate =
    options.gate ?? new HoraeSerialGate({ minIntervalMs });
  const runner = options.runner ?? runHoraeRelation;
  const now = options.now ?? (() => new Date());
  let skipped = 0;
  let cached = 0;
  let errors = 0;
  let stopped = false;
  const failedTaskIds: string[] = [];
  const errorDetails: HoraeRelationFillError[] = [];

  for (const taskId of taskIds) {
    const existing = readHoraeRelationCache(taskId, cacheRoot, direction);
    if (existing.status === "HIT") {
      skipped += 1;
      continue;
    }
    try {
      gate.beforeCall();
      const response = await Promise.resolve(runner(taskId, direction));
      const rows = rowsOfHoraeRelation(response, taskId);
      writeHoraeRelationCache(
        taskId,
        now().toISOString(),
        rows,
        cacheRoot,
        direction,
      );
      cached += 1;
    } catch (error) {
      errors += 1;
      failedTaskIds.push(taskId);
      errorDetails.push({ taskId, message: errorMessage(error) });
      if (errors >= maxErrors) {
        stopped = true;
        break;
      }
    }
  }

  return {
    total: taskIds.length,
    skipped,
    cached,
    errors,
    maxErrors,
    minIntervalMs,
    direction,
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
  const cacheRoot = option("--cache-root") ?? DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT;
  const direction = parseDirection(option("--direction"));
  const startTaskId = option("--start-task-id");
  const maxErrors = parseIntegerOption("--max-errors", undefined, false);
  const minIntervalMs = parseIntegerOption("--interval-ms", undefined, true);
  process.stderr.write(
    `[horae-relation-cache] start ${JSON.stringify({
      cacheRoot,
      direction,
      startTaskId: startTaskId ?? null,
      maxErrors: maxErrors ?? DEFAULT_MAX_ERRORS,
      minIntervalMs: minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS,
    })}\n`,
  );
  const summary = await fillHoraeRelationCache({
    cacheRoot,
    direction,
    startTaskId,
    limit: parseIntegerOption("--limit", undefined, false),
    maxErrors,
    minIntervalMs,
  });
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (summary.errors > 0) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("fill-horae-relation-cache.ts")) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = 1;
  }
}
