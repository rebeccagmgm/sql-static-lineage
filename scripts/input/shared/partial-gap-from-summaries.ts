import { readFileSync } from "node:fs";

export type PartialGapBucket =
  | "ONLY_HIVE_TARGET_GAP"
  | "HAS_AMBIGUOUS"
  | "HAS_RDBMS_DDL_GAP"
  | "OTHER_PARTIAL"
  | "SUCCESS"
  | "FAILED"
  | "SKIPPED"
  | "EXCLUDED";

export interface CollectSummaryRow {
  readonly taskId: string;
  readonly collectionStatus: string;
  readonly taskCategory?: string;
  readonly warnings: readonly string[];
  readonly tablesWritten?: number;
}

export interface PartialGapInventory {
  readonly byBucket: ReadonlyMap<PartialGapBucket, readonly string[]>;
  readonly rows: readonly CollectSummaryRow[];
}

const AMB_RE = /RDBMS_CORE_AMBIGUOUS/;
const DDL_RE = /RDBMS_DDL_/;
const HIVE_RE = /HIVE_DDL_MISS|TABLE_JSONL_MISS|HIVE_METADATA/;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function parseCollectSummaryLine(line: string): CollectSummaryRow | undefined {
  const trimmed = line.trim();
  if (trimmed === "") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return undefined;
  }
  const record = asRecord(parsed);
  if (record === undefined) return undefined;
  const taskId =
    typeof record.taskId === "string"
      ? record.taskId.trim()
      : typeof record.task_id === "string"
        ? record.task_id.trim()
        : "";
  if (taskId === "") return undefined;
  const collectionStatus =
    typeof record.collectionStatus === "string"
      ? record.collectionStatus
      : typeof record.status === "string"
        ? record.status
        : "UNKNOWN";
  const warnings = Array.isArray(record.warnings)
    ? record.warnings.filter((item): item is string => typeof item === "string")
    : [];
  return {
    taskId,
    collectionStatus,
    taskCategory:
      typeof record.taskCategory === "string" ? record.taskCategory : undefined,
    warnings,
    tablesWritten:
      typeof record.tablesWritten === "number" ? record.tablesWritten : undefined,
  };
}

export function bucketCollectSummary(row: CollectSummaryRow): PartialGapBucket {
  const status = row.collectionStatus.toUpperCase();
  if (status === "SUCCESS") return "SUCCESS";
  if (status === "FAILED") return "FAILED";
  if (status === "SKIPPED") return "SKIPPED";
  if (status === "EXCLUDED") return "EXCLUDED";
  if (status !== "PARTIAL") return "OTHER_PARTIAL";
  const joined = row.warnings.join("|");
  if (AMB_RE.test(joined)) return "HAS_AMBIGUOUS";
  if (DDL_RE.test(joined)) return "HAS_RDBMS_DDL_GAP";
  if (HIVE_RE.test(joined)) return "ONLY_HIVE_TARGET_GAP";
  return "OTHER_PARTIAL";
}

/**
 * Inventory Input Pack collect `summaries.jsonl` into gap buckets.
 * Later fill scripts should take IDs from these buckets instead of ad-hoc greps.
 */
export function inventoryPartialGapsFromSummaries(
  summariesPath: string,
): PartialGapInventory {
  const lines = readFileSync(summariesPath, "utf8").split(/\r?\n/u);
  const latest = new Map<string, CollectSummaryRow>();
  for (const line of lines) {
    const row = parseCollectSummaryLine(line);
    if (row === undefined) continue;
    latest.set(row.taskId, row);
  }
  const rows = [...latest.values()];
  const buckets = new Map<PartialGapBucket, string[]>();
  for (const row of rows) {
    const bucket = bucketCollectSummary(row);
    const list = buckets.get(bucket) ?? [];
    list.push(row.taskId);
    buckets.set(bucket, list);
  }
  for (const [bucket, ids] of buckets) {
    ids.sort((a, b) => a.localeCompare(b, "en-US", { numeric: true }));
    buckets.set(bucket, ids);
  }
  return { byBucket: buckets, rows };
}

export function hiveTargetNamesFromWarnings(
  warnings: readonly string[],
): string[] {
  const names = new Set<string>();
  for (const warning of warnings) {
    const match =
      /^([^:]+):(HIVE_DDL_MISS|TABLE_JSONL_MISS|HIVE_METADATA(?:_AMBIGUOUS_ACTIVE)?)$/u.exec(
        warning.trim(),
      );
    if (!match) continue;
    const name = match[1]!.trim().toLowerCase();
    if (name.includes(".")) names.add(name);
  }
  return [...names].sort();
}
