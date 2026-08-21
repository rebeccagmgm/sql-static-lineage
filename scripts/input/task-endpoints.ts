import type { JsonValue, TableEvidence } from "./input-pack.ts";

export type TargetEvidenceKind =
  | "DIRECT_PLATFORM_TARGET"
  | "TABLE_TASK_RELATION_DIRECTION_UNKNOWN"
  | "SQL_EXACT_TABLE_TARGET";

export const CONTROLLED_TASK_ENDPOINT_DATA_SOURCES: Readonly<
  Record<string, Readonly<{ source?: string; target?: string }>>
> = {
  mysql2hive: { target: "gfhive" },
  hive2oracle: { source: "gfhive" },
  sparkIndex: { source: "gfhive", target: "gfhive" },
  "hiveTask-2.0": { source: "gfhive", target: "gfhive" },
};

export function controlledTaskEndpointDataSource(
  taskCategory: string | null | undefined,
  side: "source" | "target",
): string | undefined {
  return CONTROLLED_TASK_ENDPOINT_DATA_SOURCES[taskCategory ?? ""]?.[side];
}

export function inputCollectionStatus(
  tableResultCount: number,
  hasUnavailableTable: boolean,
  hasEndpointConflict: boolean,
  hasUnavailableSql = false,
  hasUnavailableReference = false,
): "SUCCESS" | "PARTIAL" {
  return tableResultCount === 0 ||
    hasUnavailableTable ||
    hasEndpointConflict ||
    hasUnavailableSql ||
    hasUnavailableReference
    ? "PARTIAL"
    : "SUCCESS";
}

export function shouldUseTaskRelationFallback(
  source: unknown,
  target: unknown,
): boolean {
  const hasDirectValue = (value: unknown): boolean =>
    value !== undefined &&
    value !== null &&
    !(
      typeof value === "string" &&
      (value.trim() === "" || value.trim() === "-")
    );
  return !hasDirectValue(source) && !hasDirectValue(target);
}

export function targetEvidenceKindFor(
  target: JsonValue | undefined,
  relationTarget: TableEvidence | undefined,
  sqlTarget: TableEvidence | undefined = undefined,
): TargetEvidenceKind | undefined {
  if (relationTarget !== undefined)
    return "TABLE_TASK_RELATION_DIRECTION_UNKNOWN";
  if ((target === undefined || target === null) && sqlTarget !== undefined)
    return "SQL_EXACT_TABLE_TARGET";
  return target !== undefined && target !== null
    ? "DIRECT_PLATFORM_TARGET"
    : undefined;
}

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function qualifiedNameOf(value: JsonValue): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.includes(".") && !trimmed.includes("@")
      ? trimmed
      : undefined;
  }
  if (!isObject(value)) return undefined;
  const qualifiedName = value.qualifiedName;
  if (typeof qualifiedName !== "string") return undefined;
  const trimmed = qualifiedName.trim();
  return trimmed.includes(".") && !trimmed.includes("@") ? trimmed : undefined;
}

function nonEmptyString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

/**
 * Adds physical endpoint identity to direct task source/target configuration.
 * It never turns a non-table value into a table reference.
 */
export function enrichTaskEndpoint(
  value: JsonValue | undefined,
  table: TableEvidence | undefined,
): JsonValue | undefined {
  if (value === null) return null;
  if (value === undefined && table !== undefined)
    return {
      platform: table.platform,
      qualifiedName: table.qualifiedName,
      dataSource: table.dataSource,
    };
  if (value === undefined) return undefined;
  const qualifiedName = qualifiedNameOf(value);
  if (qualifiedName === undefined) return value;

  const existing = isObject(value) ? value : {};
  const dataSource = table?.dataSource ?? nonEmptyString(existing.dataSource);
  if (dataSource === undefined) return value;

  return {
    ...existing,
    ...(table?.platform === undefined ? {} : { platform: table.platform }),
    qualifiedName: table?.qualifiedName ?? qualifiedName,
    dataSource,
  };
}
