import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  sha256File,
  sha256Text,
  validateTableDocument,
  type SqlSlot,
  type TableDocument,
  type TableEvidence,
  type TaskEvidence,
} from "./input-pack.ts";
import {
  assertJsonlCatalogPath,
  loadJsonlOffsetIndex,
  lookupJsonlByKey,
  type JsonlKeyLookup,
  type JsonlOffsetIndex,
} from "./jsonl-offset-index.ts";
import { uniqueTaskSqlCreateStatement } from "./sparkindex-table-evidence.ts";
import { extractSqlWriteTableNames } from "./sql-target-evidence.ts";
import { extractSqlReadTableNames } from "./sql-table-references.ts";

export const DEFAULT_HIVE_METADATA_JSONL_PATH =
  "E:\\02_area\\股衍数据-数据cookbook\\数综基础信息\\原信息\\hive元信息-20260831快照\\hive_table_restored.jsonl";
export const DEFAULT_HIVE_DDL_JSONL_PATH =
  "E:\\02_area\\股衍数据-数据cookbook\\数综基础信息\\原信息\\20260830211426ddl\\hive_table_ddl_restored.jsonl";
export const DEFAULT_RDBMS_CORE_JSONL_PATH =
  "E:\\02_area\\股衍数据-数据cookbook\\数综基础信息\\原信息\\RDBMS核心信息\\gf_rdbms_table_core_restored.jsonl";
export const DEFAULT_RDBMS_DDL_JSONL_PATH =
  "E:\\02_area\\股衍数据-数据cookbook\\数综基础信息\\原信息\\关系ddl-实际\\gf_rdbms_table_ddl_restored.jsonl";

const SQL_SLOTS: readonly SqlSlot[] = [
  "create",
  "query",
  "prepare",
  "truncate",
  "finish",
];
const HIVE_DATA_SOURCE = "gfhive";

type JsonRecord = Record<string, unknown>;

export interface OfflineTableCatalogPaths {
  readonly hiveMetadataPath?: string;
  readonly hiveDdlPath?: string;
  readonly rdbmsCorePath?: string;
  readonly rdbmsDdlPath?: string;
  readonly indexDir?: string;
}

export interface OfflineTableCatalog {
  readonly hiveMetadata?: JsonlOffsetIndex;
  readonly hiveDdl?: JsonlOffsetIndex;
  readonly rdbmsCore?: JsonlOffsetIndex;
  readonly rdbmsDdl?: JsonlOffsetIndex;
}

export interface OfflineTableCandidate {
  readonly qualifiedName: string;
  readonly dataSource?: string;
}

export interface OfflineTableResolution {
  readonly candidates: readonly OfflineTableCandidate[];
  readonly resolved: readonly TableEvidence[];
  readonly unavailable: readonly {
    readonly qualifiedName: string;
    readonly reason: string;
  }[];
}

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "-" ? undefined : trimmed;
}

function normalizeIdentifierPart(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === "`" && last === "`") || (first === '"' && last === '"'))
      return trimmed.slice(1, -1).trim();
  }
  if (trimmed.includes("`") || trimmed.includes('"')) return undefined;
  return trimmed;
}

export function parsePhysicalTableName(
  value: unknown,
): OfflineTableCandidate | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "-") return undefined;
    const separator = trimmed.lastIndexOf("@");
    const base = separator > 0 ? trimmed.slice(0, separator) : trimmed;
    const rawDataSource =
      separator > 0 ? nonEmptyString(trimmed.slice(separator + 1)) : undefined;
    const dataSource = rawDataSource?.replace(/:\d+$/, "");
    const parts = base.split(/\s*\.\s*/).map(normalizeIdentifierPart);
    if (
      parts.length !== 2 ||
      parts.some(
        (part) =>
          part === undefined ||
          part === "" ||
          /\s/.test(part) ||
          !/^[A-Za-z0-9_$#-]+$/.test(part),
      )
    )
      return undefined;
    return {
      qualifiedName: `${parts[0]}.${parts[1]}`,
      dataSource,
    };
  }
  const record = asRecord(value);
  if (record === undefined) return undefined;
  const nested =
    parsePhysicalTableName(
      record.qualifiedName ??
        record.qualifiedname ??
        record.qualified_name ??
        record.targetTable ??
        record.target_table ??
        record.tableName ??
        record.table_name,
    ) ??
    parsePhysicalTableName(record.table) ??
    parsePhysicalTableName(record.target) ??
    parsePhysicalTableName(record.physicalTable);
  if (nested === undefined) return undefined;
  const dataSource =
    nested.dataSource ??
    nonEmptyString(
      record.dataSource ??
        record.datasource ??
        record.data_source ??
        record.dataSourceId,
    );
  return { qualifiedName: nested.qualifiedName, dataSource };
}

export function platformFromDataSource(
  dataSource: string,
): string | undefined {
  const ds = dataSource.trim().toLowerCase();
  if (ds === HIVE_DATA_SOURCE || ds.startsWith("gfhive")) return "hive";
  if (ds.startsWith("gforacle_")) return "oracle";
  if (ds.startsWith("gfmysql_")) return "mysql";
  if (ds.startsWith("gfpostgre_") || ds.startsWith("gfpg_")) return "postgre";
  if (ds.startsWith("gfstarrocks_")) return "starrocks";
  if (ds.includes("oceanbase")) return "oceanbase";
  if (ds.includes("tidb")) return "tidb";
  if (ds.startsWith("gfgoldendb_")) return "goldendb";
  if (ds.startsWith("gfsqlserver_")) return "sqlserver";
  return undefined;
}

function hiveMetadataKeys(record: JsonRecord): string | undefined {
  if (nonEmptyString(record.status)?.toUpperCase() !== "ACTIVE")
    return undefined;
  const parsed = parsePhysicalTableName(
    nonEmptyString(record.qualifiedname_clean) ??
      nonEmptyString(record.qualifiedname),
  );
  return parsed?.qualifiedName.toLowerCase();
}

function hiveDdlKeys(record: JsonRecord): readonly string[] | undefined {
  const parsed = parsePhysicalTableName(record.qualifiedname);
  if (parsed === undefined) return undefined;
  const qn = parsed.qualifiedName.toLowerCase();
  const dataSource = (parsed.dataSource ?? HIVE_DATA_SOURCE).toLowerCase();
  return [`${qn}@${dataSource}`, qn];
}

function rdbmsKeys(record: JsonRecord): readonly string[] | undefined {
  const parsed = parsePhysicalTableName(record.qualifiedname);
  if (parsed === undefined) return undefined;
  const qn = parsed.qualifiedName.toLowerCase();
  if (parsed.dataSource === undefined) return [qn];
  return [`${qn}@${parsed.dataSource.toLowerCase()}`, qn];
}

function optionalIndex(
  path: string | undefined,
  keyOf: (record: JsonRecord) => string | readonly string[] | undefined,
  indexDir?: string,
): JsonlOffsetIndex | undefined {
  if (path === undefined || !existsSync(path)) return undefined;
  assertJsonlCatalogPath(path);
  return loadJsonlOffsetIndex(path, {
    keyOf,
    persistPath:
      indexDir === undefined
        ? undefined
        : join(indexDir, `${basenameSafe(path)}.offset-index.json`),
  });
}

function basenameSafe(path: string): string {
  return path.replace(/^.*[\\/]/, "");
}

export function loadOfflineTableCatalog(
  options: OfflineTableCatalogPaths = {},
): OfflineTableCatalog {
  const hiveMetadataPath =
    options.hiveMetadataPath ?? DEFAULT_HIVE_METADATA_JSONL_PATH;
  const hiveDdlPath = options.hiveDdlPath ?? DEFAULT_HIVE_DDL_JSONL_PATH;
  const rdbmsCorePath = options.rdbmsCorePath ?? DEFAULT_RDBMS_CORE_JSONL_PATH;
  const rdbmsDdlPath = options.rdbmsDdlPath ?? DEFAULT_RDBMS_DDL_JSONL_PATH;
  return {
    hiveMetadata: optionalIndex(
      hiveMetadataPath,
      hiveMetadataKeys,
      options.indexDir,
    ),
    hiveDdl: optionalIndex(hiveDdlPath, hiveDdlKeys, options.indexDir),
    rdbmsCore: optionalIndex(rdbmsCorePath, rdbmsKeys, options.indexDir),
    rdbmsDdl: optionalIndex(rdbmsDdlPath, rdbmsKeys, options.indexDir),
  };
}

function sqlInputs(
  taskEvidence: TaskEvidence,
): Partial<Record<SqlSlot, string>> {
  const result: Partial<Record<SqlSlot, string>> = {};
  for (const slot of SQL_SLOTS) {
    const raw = taskEvidence.sql?.[slot];
    const content =
      typeof raw === "string"
        ? raw
        : raw && typeof raw === "object"
          ? raw.content
          : undefined;
    if (typeof content === "string" && nonEmptyString(content) !== undefined)
      result[slot] = content;
  }
  return result;
}

export function extractOfflineTableCandidates(
  taskEvidence: TaskEvidence,
): readonly OfflineTableCandidate[] {
  const byKey = new Map<string, OfflineTableCandidate>();
  const add = (value: unknown): void => {
    const parsed = parsePhysicalTableName(value);
    if (parsed === undefined) return;
    const key = `${parsed.qualifiedName.toLowerCase()}@${(parsed.dataSource ?? "").toLowerCase()}`;
    const existing = byKey.get(key);
    if (existing === undefined) byKey.set(key, parsed);
    else if (existing.dataSource === undefined && parsed.dataSource !== undefined)
      byKey.set(key, parsed);
  };
  add(taskEvidence.target);
  add(taskEvidence.source);
  const sql = sqlInputs(taskEvidence);
  for (const name of Object.values(sql).flatMap((content) =>
    extractSqlReadTableNames(content ?? ""),
  ))
    add(name);
  for (const name of extractSqlWriteTableNames(sql)) add(name);
  return [...byKey.values()].sort((left, right) =>
    left.qualifiedName.localeCompare(right.qualifiedName),
  );
}

interface LocalTablePack {
  readonly evidence: TableEvidence;
  readonly contentHash: string;
}

function localTableEvidence(
  document: TableDocument,
  ddl: string,
): TableEvidence {
  const ddlFile = document.ddlFile as JsonRecord;
  const value = (key: string): unknown => document[key];
  const arrayValue = (key: string): readonly string[] | undefined => {
    const raw = value(key);
    return Array.isArray(raw) ? raw.map(String) : undefined;
  };
  return {
    guid: nonEmptyString(value("guid")),
    platform: document.platform,
    dataSource: document.dataSource,
    qualifiedName: document.qualifiedName,
    schema: nonEmptyString(value("schema")),
    name: nonEmptyString(value("name")),
    description: nonEmptyString(value("description")),
    objectType: document.objectType,
    status: nonEmptyString(value("status")),
    primaryKey: arrayValue("primaryKey"),
    partitionFields: arrayValue("partitionFields"),
    ddl,
    evidenceProvider:
      nonEmptyString(value("evidenceProvider")) ??
      nonEmptyString(ddlFile.evidenceProvider) ??
      "local:table-pack",
    collectedAt: nonEmptyString(value("collectedAt")),
  };
}

function rememberLocalPack(
  index: Map<string, LocalTablePack[]>,
  pack: LocalTablePack,
): void {
  const keys = [
    `${pack.evidence.qualifiedName.toLowerCase()}@${pack.evidence.dataSource.toLowerCase()}`,
    pack.evidence.qualifiedName.toLowerCase(),
  ];
  for (const key of keys) {
    const entries = index.get(key) ?? [];
    entries.push(pack);
    index.set(key, entries);
  }
}

export interface OfflineTablePackStore {
  readonly remember: (evidence: TableEvidence, contentHash: string) => void;
}

interface OfflineTablePackLookup extends OfflineTablePackStore {
  readonly get: (key: string) => readonly LocalTablePack[] | undefined;
}

export function openOfflineTablePackStore(
  dataRoot: string,
): OfflineTablePackLookup {
  const index = loadExistingTablePacks(dataRoot);
  return {
    get: (key) => index.get(key),
    remember: (evidence, contentHash) => {
      rememberLocalPack(index, { evidence, contentHash });
    },
  };
}

function loadExistingTablePacks(
  dataRoot: string,
): Map<string, LocalTablePack[]> {
  const result = new Map<string, LocalTablePack[]>();
  const tablesRoot = join(resolve(dataRoot), "tables");
  if (!existsSync(tablesRoot)) return result;
  for (const platformEntry of readdirSync(tablesRoot, { withFileTypes: true })) {
    if (!platformEntry.isDirectory()) continue;
    const platformRoot = join(tablesRoot, platformEntry.name);
    for (const tableEntry of readdirSync(platformRoot, { withFileTypes: true })) {
      if (!tableEntry.isDirectory()) continue;
      const tableRoot = join(platformRoot, tableEntry.name);
      try {
        const documentValue: unknown = JSON.parse(
          readFileSync(join(tableRoot, "table.json"), "utf8"),
        );
        validateTableDocument(documentValue);
        const document = documentValue as TableDocument;
        const ddlPath = join(tableRoot, "ddl.sql");
        const ddl = readFileSync(ddlPath, "utf8");
        const ddlHash = (document.ddlFile as JsonRecord).sha256;
        if (typeof ddlHash !== "string" || sha256File(ddlPath) !== ddlHash)
          continue;
        rememberLocalPack(result, {
          evidence: localTableEvidence(document, ddl),
          contentHash: document.contentHash,
        });
      } catch {
        // Invalid packs are cache misses.
      }
    }
  }
  return result;
}

function uniqueLocalPack(
  packs: readonly LocalTablePack[] | undefined,
): LocalTablePack | undefined {
  if (packs === undefined || packs.length === 0) return undefined;
  const unique = new Map<string, LocalTablePack>();
  for (const pack of packs) {
    unique.set(`${pack.contentHash}:${sha256Text(pack.evidence.ddl)}`, pack);
  }
  return unique.size === 1 ? [...unique.values()][0] : undefined;
}

function stringArray(value: unknown): readonly string[] | undefined {
  if (Array.isArray(value)) {
    const values = value
      .map(nonEmptyString)
      .filter((item): item is string => item !== undefined);
    return values.length === 0 ? undefined : values;
  }
  const text = nonEmptyString(value);
  if (text === undefined) return undefined;
  const values = text
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "" && item !== "-");
  return values.length === 0 ? undefined : values;
}

function hiveFromMetadata(
  record: JsonRecord,
  ddl: string,
  evidenceProvider: string,
  collectedAt: string,
): TableEvidence | undefined {
  const parsed = parsePhysicalTableName(
    nonEmptyString(record.qualifiedname_clean) ??
      nonEmptyString(record.qualifiedname),
  );
  const dataSource = (
    parsed?.dataSource ??
    nonEmptyString(record.datasource) ??
    HIVE_DATA_SOURCE
  ).toLowerCase();
  if (parsed === undefined) return undefined;
  const platform = platformFromDataSource(dataSource);
  if (platform === undefined) return undefined;
  const parts = parsed.qualifiedName.split(".");
  return {
    guid: nonEmptyString(record.guid),
    platform,
    dataSource,
    qualifiedName: parsed.qualifiedName,
    schema: parts[0],
    name: parts[1],
    objectType: nonEmptyString(record.type_name) ?? "hive_table",
    status: nonEmptyString(record.status),
    ddl,
    evidenceProvider,
    collectedAt,
  };
}

function hiveFromDdl(
  record: JsonRecord,
  collectedAt: string,
): TableEvidence | undefined {
  const parsed = parsePhysicalTableName(record.qualifiedname);
  const querytext = nonEmptyString(record.querytext);
  if (parsed === undefined || querytext === undefined) return undefined;
  const dataSource = (parsed.dataSource ?? HIVE_DATA_SOURCE).toLowerCase();
  const platform = platformFromDataSource(dataSource);
  if (platform === undefined) return undefined;
  const parts = parsed.qualifiedName.split(".");
  return {
    guid: nonEmptyString(record.guid),
    platform,
    dataSource,
    qualifiedName: parsed.qualifiedName,
    schema: parts[0],
    name: parts[1],
    objectType: "hive_table",
    ddl: querytext,
    evidenceProvider: "local:hive-ddl-jsonl",
    collectedAt,
  };
}

function rdbmsFromCore(
  record: JsonRecord,
  ddl: string,
  evidenceProvider: string,
  collectedAt: string,
): TableEvidence | undefined {
  const parsed = parsePhysicalTableName(record.qualifiedname);
  if (parsed?.dataSource === undefined) return undefined;
  const platform = platformFromDataSource(parsed.dataSource);
  if (platform === undefined) return undefined;
  const parts = parsed.qualifiedName.split(".");
  return {
    guid: nonEmptyString(record.guid),
    platform,
    dataSource: parsed.dataSource,
    qualifiedName: parsed.qualifiedName,
    schema: parts.length > 1 ? parts.slice(0, -1).join(".") : undefined,
    name: parts.at(-1),
    description: nonEmptyString(record.comment),
    objectType: nonEmptyString(record.type_name) ?? "gf_rdbms_table",
    status: undefined,
    primaryKey: stringArray(record.primarykeys),
    ddl,
    evidenceProvider,
    collectedAt,
  };
}

function candidateKeys(candidate: OfflineTableCandidate): readonly string[] {
  const qn = candidate.qualifiedName.toLowerCase();
  if (candidate.dataSource !== undefined)
    return [`${qn}@${candidate.dataSource.toLowerCase()}`, qn];
  return [`${qn}@${HIVE_DATA_SOURCE}`, qn];
}

function lookupFirst(
  index: JsonlOffsetIndex | undefined,
  keys: readonly string[],
): JsonlKeyLookup {
  if (index === undefined) return { status: "MISS" };
  let ambiguous = false;
  for (const key of keys) {
    const hit = lookupJsonlByKey(index, key);
    if (hit.status === "HIT") return hit;
    if (hit.status === "AMBIGUOUS") ambiguous = true;
  }
  return ambiguous ? { status: "AMBIGUOUS" } : { status: "MISS" };
}

function resolveOne(
  candidate: OfflineTableCandidate,
  localPacks: OfflineTablePackLookup,
  catalog: OfflineTableCatalog,
  sql: Partial<Record<SqlSlot, string>>,
  collectedAt: string,
):
  | { readonly evidence: TableEvidence }
  | { readonly reason: string } {
  for (const key of candidateKeys(candidate)) {
    const pack = uniqueLocalPack(localPacks.get(key));
    if (pack !== undefined) return { evidence: pack.evidence };
    if ((localPacks.get(key)?.length ?? 0) > 1)
      return { reason: "LOCAL_TABLE_PACK_CONFLICT" };
  }

  const hiveDdl = lookupFirst(catalog.hiveDdl, candidateKeys(candidate));
  if (hiveDdl.status === "AMBIGUOUS") return { reason: "HIVE_DDL_AMBIGUOUS" };
  const hiveIdentity =
    catalog.hiveMetadata === undefined
      ? { status: "MISS" as const }
      : lookupJsonlByKey(
          catalog.hiveMetadata,
          candidate.qualifiedName.toLowerCase(),
        );
  if (hiveIdentity.status === "AMBIGUOUS" && hiveDdl.status !== "HIT")
    return { reason: "HIVE_METADATA_AMBIGUOUS_ACTIVE" };
  if (hiveDdl.status === "HIT") {
    const querytext = nonEmptyString(hiveDdl.record.querytext);
    if (querytext === undefined) return { reason: "HIVE_DDL_QUERYTEXT_MISSING" };
    if (hiveIdentity.status === "HIT") {
      const evidence = hiveFromMetadata(
        hiveIdentity.record,
        querytext,
        "local:hive-metadata-snapshot,local:hive-ddl-jsonl",
        collectedAt,
      );
      if (evidence === undefined) return { reason: "HIVE_PLATFORM_UNMAPPED" };
      return { evidence };
    }
    const evidence = hiveFromDdl(hiveDdl.record, collectedAt);
    if (evidence === undefined) return { reason: "HIVE_PLATFORM_UNMAPPED" };
    return { evidence };
  }
  if (hiveIdentity.status === "HIT") {
    const created = uniqueTaskSqlCreateStatement(sql, candidate.qualifiedName);
    if (created.conflict) return { reason: "SQL_CREATE_CONFLICT" };
    if (created.ddl !== undefined) {
      const evidence = hiveFromMetadata(
        hiveIdentity.record,
        created.ddl,
        "input-pack:task-sql-create",
        collectedAt,
      );
      if (evidence === undefined) return { reason: "HIVE_PLATFORM_UNMAPPED" };
      return { evidence };
    }
    return { reason: "HIVE_DDL_MISS" };
  }

  if (catalog.rdbmsCore !== undefined) {
    const keys = candidateKeys(candidate);
    const coreLookup = lookupFirst(catalog.rdbmsCore, keys);
    if (coreLookup.status === "AMBIGUOUS")
      return { reason: "RDBMS_CORE_AMBIGUOUS" };
    if (coreLookup.status === "HIT") {
      const ddlLookup = lookupFirst(catalog.rdbmsDdl, keys);
      if (ddlLookup.status === "AMBIGUOUS")
        return { reason: "RDBMS_DDL_AMBIGUOUS" };
      if (ddlLookup.status === "MISS") return { reason: "RDBMS_DDL_MISS" };
      const ddl = nonEmptyString(ddlLookup.record.ddl);
      if (ddl === undefined) return { reason: "RDBMS_DDL_MISSING" };
      const evidence = rdbmsFromCore(
        coreLookup.record,
        ddl,
        "local:rdbms-core-jsonl,local:rdbms-ddl-jsonl",
        collectedAt,
      );
      if (evidence === undefined) return { reason: "RDBMS_PLATFORM_UNMAPPED" };
      return { evidence };
    }
  }

  return { reason: "TABLE_JSONL_MISS" };
}

export function resolveOfflineTables(
  dataRoot: string,
  taskEvidence: TaskEvidence,
  catalog: OfflineTableCatalog,
  now: () => Date = () => new Date(),
  packStore?: ReturnType<typeof openOfflineTablePackStore>,
): OfflineTableResolution {
  const candidates = extractOfflineTableCandidates(taskEvidence);
  const localPacks = packStore ?? openOfflineTablePackStore(dataRoot);
  const sql = sqlInputs(taskEvidence);
  const collectedAt = now().toISOString();
  const resolved: TableEvidence[] = [];
  const unavailable: { qualifiedName: string; reason: string }[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const dedupe = candidate.qualifiedName.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const result = resolveOne(candidate, localPacks, catalog, sql, collectedAt);
    if ("evidence" in result) resolved.push(result.evidence);
    else unavailable.push({ qualifiedName: candidate.qualifiedName, reason: result.reason });
  }
  return { candidates, resolved, unavailable };
}
