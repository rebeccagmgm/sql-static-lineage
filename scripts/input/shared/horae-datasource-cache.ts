import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT,
  resolveScheduleEvidenceCacheRoot,
} from "../../reconcile/consumer/one-hop/schedule-evidence-cache.ts";

export const HORAE_DATASOURCE_DIR_NAME = "horae-datasource" as const;
export const HORAE_DATASOURCE_ROWS_FILE = "rows.jsonl" as const;
export const HORAE_DATASOURCE_SNAPSHOT_FILE = "snapshot.json" as const;

export type HoraeDatasourceEntry = {
  readonly serverTag: string;
  readonly serverType: string;
  readonly service: string;
  readonly serverAlias?: string;
  readonly host?: string;
  readonly port?: number;
};

export type HoraeDatasourceIndex = {
  readonly byServerTag: ReadonlyMap<string, HoraeDatasourceEntry>;
};

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "-" ? undefined : trimmed;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function horaeDatasourceDir(
  cacheRoot = DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT,
): string {
  return join(
    resolveScheduleEvidenceCacheRoot(cacheRoot),
    HORAE_DATASOURCE_DIR_NAME,
  );
}

/**
 * Atlas / RDBMS-core dataSource suffix for an Oracle Horae server_tag.
 * Example: service `jyglrac` → `gforacle_jyglrac#jyglrac`
 */
export function oracleAtlasDataSourceFromService(
  service: string,
): string | undefined {
  const trimmed = service.trim();
  if (trimmed === "") return undefined;
  const lower = trimmed.toLowerCase();
  return `gforacle_${lower}#${lower}`;
}

export function parseHoraeDatasourceRow(
  value: unknown,
): HoraeDatasourceEntry | undefined {
  const record = asRecord(value);
  if (record === undefined) return undefined;
  const serverTag = nonEmptyString(record.server_tag);
  const serverType = nonEmptyString(record.server_type);
  const service = nonEmptyString(record.service);
  if (serverTag === undefined || serverType === undefined || service === undefined)
    return undefined;
  return {
    serverTag,
    serverType,
    service,
    serverAlias: nonEmptyString(record.server_alias),
    host: nonEmptyString(record.host),
    port: typeof record.port === "number" ? record.port : undefined,
  };
}

function indexEntries(
  rows: readonly unknown[],
): HoraeDatasourceIndex {
  const byServerTag = new Map<string, HoraeDatasourceEntry>();
  for (const row of rows) {
    const entry = parseHoraeDatasourceRow(row);
    if (entry === undefined) continue;
    byServerTag.set(entry.serverTag, entry);
  }
  return { byServerTag };
}

export function loadHoraeDatasourceIndex(
  cacheRoot = DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT,
): HoraeDatasourceIndex | undefined {
  const dir = horaeDatasourceDir(cacheRoot);
  const rowsPath = join(dir, HORAE_DATASOURCE_ROWS_FILE);
  const snapshotPath = join(dir, HORAE_DATASOURCE_SNAPSHOT_FILE);
  if (existsSync(rowsPath)) {
    const rows: unknown[] = [];
    for (const line of readFileSync(rowsPath, "utf8").split(/\r?\n/)) {
      if (line.trim() === "") continue;
      try {
        rows.push(JSON.parse(line));
      } catch {
        // skip bad lines
      }
    }
    return indexEntries(rows);
  }
  if (existsSync(snapshotPath)) {
    try {
      const parsed = JSON.parse(readFileSync(snapshotPath, "utf8")) as unknown;
      const record = asRecord(parsed);
      const rows = record?.rows;
      if (!Array.isArray(rows)) return undefined;
      return indexEntries(rows);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Map task source label (Horae server_tag) to RDBMS-core `@dataSource` key.
 */
export function preferredRdbmsDataSourceFromTaskSource(
  source: unknown,
  index: HoraeDatasourceIndex | undefined,
): string | undefined {
  if (index === undefined) return undefined;
  const tag =
    typeof source === "string"
      ? nonEmptyString(source)
      : nonEmptyString(asRecord(source)?.qualifiedName) ??
        nonEmptyString(asRecord(source)?.dataSource);
  if (tag === undefined) return undefined;
  const entry = index.byServerTag.get(tag);
  if (entry === undefined) return undefined;
  if (entry.serverType.toLowerCase() !== "oracle") return undefined;
  return oracleAtlasDataSourceFromService(entry.service);
}
