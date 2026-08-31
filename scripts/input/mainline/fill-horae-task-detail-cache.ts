import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  HoraeSerialGate,
  runHoraeDetail,
} from "./collect-one-task-input-pack-sparkindex.ts";
import {
  DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT,
  readHoraeTaskTypeCache,
  resolveScheduleEvidenceCacheRoot,
  writeHoraeTaskTypeCache,
} from "../../reconcile/consumer/one-hop/schedule-evidence-cache.ts";

const SAFE_TASK_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const DEFAULT_MAX_ERRORS = 3;

function taskIdsFromCache(cacheRoot: string): string[] {
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

function detailOfHorae(
  value: unknown,
  taskId: string,
): Record<string, unknown> {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object" || Array.isArray(row))
    throw new Error(`HORAE_TASK_DETAIL_INVALID:${taskId}`);
  return row as Record<string, unknown>;
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new Error("MAX_ERRORS_INVALID");
  return parsed;
}

function boundedTaskIds(taskIds: readonly string[]): string[] {
  const rawLimit = option("--limit");
  if (rawLimit === undefined) return [...taskIds];
  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new Error("LIMIT_INVALID");
  return taskIds.slice(0, limit);
}

async function main(): Promise<void> {
  const cacheRoot =
    option("--cache-root") ?? DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT;
  const maxErrors = positiveInteger(option("--max-errors"), DEFAULT_MAX_ERRORS);
  const gate = new HoraeSerialGate({ minIntervalMs: 2_000 });
  const taskIds = boundedTaskIds(taskIdsFromCache(cacheRoot));
  let skipped = 0;
  let cached = 0;
  let errors = 0;
  process.stderr.write(
    `[horae-task-detail-cache] start ${JSON.stringify({ total: taskIds.length, cacheRoot, maxErrors })}\n`,
  );

  for (const [index, taskId] of taskIds.entries()) {
    const existing = readHoraeTaskTypeCache(taskId, cacheRoot);
    if (existing.status === "HIT") {
      skipped += 1;
      continue;
    }
    try {
      gate.beforeCall();
      const response = runHoraeDetail(taskId);
      const detail = detailOfHorae(response, taskId);
      writeHoraeTaskTypeCache(
        taskId,
        new Date().toISOString(),
        detail,
        cacheRoot,
      );
      cached += 1;
    } catch (error) {
      errors += 1;
      process.stderr.write(
        `[horae-task-detail-cache] error ${JSON.stringify({ taskId, errors, message: error instanceof Error ? error.message : String(error) })}\n`,
      );
      if (errors >= maxErrors) {
        process.stderr.write(
          `[horae-task-detail-cache] stopped ${JSON.stringify({ index: index + 1, total: taskIds.length, skipped, cached, errors, maxErrors })}\n`,
        );
        process.exitCode = 1;
        return;
      }
    }
    if ((index + 1) % 25 === 0)
      process.stderr.write(
        `[horae-task-detail-cache] progress ${JSON.stringify({ processed: index + 1, total: taskIds.length, skipped, cached, errors })}\n`,
      );
  }
  process.stdout.write(
    `${JSON.stringify({ total: taskIds.length, skipped, cached, errors, maxErrors })}\n`,
  );
}

if (process.argv[1]?.endsWith("fill-horae-task-detail-cache.ts")) {
  await main();
}
