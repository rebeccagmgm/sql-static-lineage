import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";

import {
  canonicalJson,
  sha256,
} from "../../../machine-facts/machine-facts-contract.ts";

export const DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT =
  "E:\\02_area\\股衍数据-数据cookbook\\sql-static-lineage-cache";
export const SCHEDULE_EVIDENCE_CACHE_SCHEMA_VERSION = "1.0.0" as const;
export const SCHEDULE_EVIDENCE_CACHE_ARTIFACT_TYPE =
  "HORAE_RELATION_SCHEDULE_EVIDENCE" as const;
export const SCHEDULE_EVIDENCE_CACHE_DIRECTION = "up" as const;
export const SCHEDULE_EVIDENCE_CACHE_DEPTH = 1 as const;
export const SCHEDULE_EVIDENCE_CACHE_FILE_NAME =
  "horae-relation-up-depth-1.json" as const;

const SAFE_TASK_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const SHA256 = /^[a-f0-9]{64}$/i;

type JsonRecord = Record<string, unknown>;

export type ScheduleEvidenceCacheStatus =
  | "HIT"
  | "MISS"
  | "INVALID"
  | "DISABLED";

export interface HoraeRelationCacheDocument {
  readonly schema_version: typeof SCHEDULE_EVIDENCE_CACHE_SCHEMA_VERSION;
  readonly artifact_type: typeof SCHEDULE_EVIDENCE_CACHE_ARTIFACT_TYPE;
  readonly task_id: string;
  readonly direction: typeof SCHEDULE_EVIDENCE_CACHE_DIRECTION;
  readonly depth: typeof SCHEDULE_EVIDENCE_CACHE_DEPTH;
  readonly observed_at: string;
  readonly rows: readonly JsonRecord[];
  readonly content_sha256: string;
}
export type HoraeRelationCacheRead =
  | { readonly status: "MISS"; readonly path: string }
  | {
      readonly status: "INVALID";
      readonly path: string;
      readonly reason: string;
    }
  | {
      readonly status: "HIT";
      readonly path: string;
      readonly taskId: string;
      readonly rows: readonly JsonRecord[];
      readonly observedAt: string;
    };

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function safeTaskId(taskId: string): void {
  if (!SAFE_TASK_ID.test(taskId)) throw new Error("INVALID_TASK_ID");
}

function cachePayload(
  taskId: string,
  observedAt: string,
  rows: readonly JsonRecord[],
): Omit<HoraeRelationCacheDocument, "content_sha256"> {
  return {
    schema_version: SCHEDULE_EVIDENCE_CACHE_SCHEMA_VERSION,
    artifact_type: SCHEDULE_EVIDENCE_CACHE_ARTIFACT_TYPE,
    task_id: taskId,
    direction: SCHEDULE_EVIDENCE_CACHE_DIRECTION,
    depth: SCHEDULE_EVIDENCE_CACHE_DEPTH,
    observed_at: observedAt,
    rows,
  };
}

function cacheDocument(
  taskId: string,
  observedAt: string,
  rows: readonly JsonRecord[],
): HoraeRelationCacheDocument {
  const payload = cachePayload(taskId, observedAt, rows);
  return {
    ...payload,
    content_sha256: sha256(canonicalJson(payload)),
  };
}

function cachePathForRoot(cacheRoot: string, taskId: string): string {
  safeTaskId(taskId);
  const root = resolve(cacheRoot);
  return join(
    root,
    "schedule-evidence",
    "tasks",
    taskId,
    SCHEDULE_EVIDENCE_CACHE_FILE_NAME,
  );
}

export function scheduleEvidenceCachePath(
  taskId: string,
  cacheRoot = DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT,
): string {
  return cachePathForRoot(cacheRoot, taskId);
}

function validateRows(value: unknown, taskId: string): JsonRecord[] | null {
  if (!Array.isArray(value)) return null;
  const rows: JsonRecord[] = [];
  for (const item of value) {
    const row = asRecord(item);
    if (!row) return null;
    const rowTaskId = nonEmptyString(row.task_id ?? row.taskId);
    if (!rowTaskId || !SAFE_TASK_ID.test(rowTaskId)) return null;
    rows.push(row);
  }
  return rows;
}

function invalid(path: string, reason: string): HoraeRelationCacheRead {
  return { status: "INVALID", path, reason };
}

export function readHoraeRelationCache(
  taskId: string,
  cacheRoot = DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT,
): HoraeRelationCacheRead {
  const path = cachePathForRoot(cacheRoot, taskId);
  if (!existsSync(path)) return { status: "MISS", path };
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    const record = asRecord(parsed);
    if (!record) return invalid(path, "ENVELOPE_NOT_OBJECT");
    if (record.schema_version !== SCHEDULE_EVIDENCE_CACHE_SCHEMA_VERSION)
      return invalid(path, "SCHEMA_VERSION_MISMATCH");
    if (record.artifact_type !== SCHEDULE_EVIDENCE_CACHE_ARTIFACT_TYPE)
      return invalid(path, "ARTIFACT_TYPE_MISMATCH");
    if (record.task_id !== taskId) return invalid(path, "TASK_ID_MISMATCH");
    if (record.direction !== SCHEDULE_EVIDENCE_CACHE_DIRECTION)
      return invalid(path, "DIRECTION_MISMATCH");
    if (record.depth !== SCHEDULE_EVIDENCE_CACHE_DEPTH)
      return invalid(path, "DEPTH_MISMATCH");
    const observedAt = nonEmptyString(record.observed_at);
    if (!observedAt) return invalid(path, "OBSERVED_AT_MISSING");
    const rows = validateRows(record.rows, taskId);
    if (!rows) return invalid(path, "ROWS_INVALID");
    if (typeof record.content_sha256 !== "string" || !SHA256.test(record.content_sha256))
      return invalid(path, "CONTENT_HASH_INVALID");
    const payload = cachePayload(taskId, observedAt, rows);
    if (sha256(canonicalJson(payload)) !== record.content_sha256)
      return invalid(path, "CONTENT_HASH_MISMATCH");
    return { status: "HIT", path, taskId, rows, observedAt };
  } catch (error) {
    return invalid(
      path,
      error instanceof SyntaxError ? "JSON_INVALID" : "READ_FAILED",
    );
  }
}

export function writeHoraeRelationCache(
  taskId: string,
  observedAt: string,
  rows: readonly JsonRecord[],
  cacheRoot = DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT,
): string {
  safeTaskId(taskId);
  if (!nonEmptyString(observedAt)) throw new Error("OBSERVED_AT_MISSING");
  if (!validateRows(rows, taskId)) throw new Error("ROWS_INVALID");
  const path = cachePathForRoot(cacheRoot, taskId);
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(
      temporaryPath,
      canonicalJson(cacheDocument(taskId, observedAt, rows)),
      { encoding: "utf8", flag: "wx" },
    );
    renameSync(temporaryPath, path);
    return path;
  } finally {
    if (existsSync(temporaryPath)) rmSync(temporaryPath, { force: true });
  }
}
