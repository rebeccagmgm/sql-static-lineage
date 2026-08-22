import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  writeTableInput,
  writeTaskInput,
  type JsonValue,
  type SqlSlot,
  type TableEvidence,
  type TaskEvidence,
} from "./input-pack.ts";
import {
  controlledTaskEndpointDataSource,
  enrichTaskEndpoint,
  inputCollectionStatus,
  shouldUseTaskRelationFallback,
  targetEvidenceKindFor,
} from "./task-endpoints.ts";
import { findSqlTargetEvidence } from "./sql-target-evidence.ts";
import taskTypeCodeMap from "./task-type-map.json" with { type: "json" };

const SQL_SLOTS: readonly SqlSlot[] = [
  "create",
  "query",
  "prepare",
  "truncate",
  "finish",
];
const TASK_TYPE_CODE_MAP: Readonly<Record<string, string>> = taskTypeCodeMap;
const DATA_SOURCE_ID_OVERRIDES: Readonly<Record<string, string>> = {
  场外衍生品投资管理系统: "gforacle_gftzdb#gftzdb",
};
const KNOWN_DATA_SOURCE_IDS = new Set(["gfhive", "gforacle_gftzdb#gftzdb"]);
const DEFAULT_DATA_SOURCE_ID = "default";
const OPENCLI_MIN_INTERVAL_MS = 3000;
const OPENCLI_DEFAULT_TIMEOUT_MS = 30000;
let lastOpenCliCallAt = 0;

export type TaskCollectionSummary = {
  taskId: string;
  taskCategory: string;
  taskType?: string | null;
  collectionStatus: "SUCCESS" | "PARTIAL";
  directory: string;
  changed: boolean;
  contentHash: string;
  tablesWritten: number;
  tableAssets: Array<{ directory: string; contentHash: string }>;
  tablesUnavailable: string[];
  tableReferencesUnavailable: string[];
  warnings: string[];
  staleLegacyTaskDirectories: string[];
};

function directValue(value: unknown): JsonValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (
    typeof value === "string" &&
    (value.trim() === "" || value.trim() === "-")
  )
    return undefined;
  return value as JsonValue;
}

function directString(value: unknown): string | undefined {
  const direct = directValue(value);
  return direct === undefined || direct === null ? undefined : String(direct);
}

function directOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return directString(value);
}

function directStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const result = value.map((item) => directString(item));
  return result.every((item): item is string => item !== undefined)
    ? result
    : undefined;
}

function splitSqlList(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let quote: string | undefined;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (quote !== undefined) {
      if (character === quote && value[index - 1] !== "\\") quote = undefined;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (character === ",") {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function targetPartitionFromSql(
  querySql: string | undefined,
): Record<string, string> | undefined {
  if (querySql === undefined) return undefined;
  const match = querySql.match(
    /\binsert\s+(?:overwrite|into)\s+table\s+[`"]?[^\s(`"]+[`"]?\s+partition\s*\(([^)]*)\)/i,
  );
  if (!match) return undefined;
  const partition: Record<string, string> = {};
  for (const assignment of splitSqlList(match[1]!)) {
    const parsed = assignment.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s]+))$/,
    );
    if (!parsed) return undefined;
    const value = parsed[2] ?? parsed[3] ?? parsed[4];
    if (value === undefined || value.trim() === "") return undefined;
    partition[parsed[1]!] = value;
  }
  return Object.keys(partition).length > 0 ? partition : undefined;
}

function tableTaskIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value
    .map((item) =>
      typeof item === "string"
        ? directString(item)
        : item && typeof item === "object" && !Array.isArray(item)
          ? directString((item as Record<string, unknown>).taskId)
          : undefined,
    )
    .filter((item): item is string => item !== undefined);
  return ids.length > 0 ? ids : undefined;
}

function selectTableCandidate(
  candidates: readonly Record<string, unknown>[],
  qualifiedName: string,
  expectedDataSource?: string,
): Record<string, unknown> | undefined {
  const sourceCandidates =
    expectedDataSource === undefined
      ? candidates
      : candidates.filter((item) => {
          const rawQualifiedName =
            typeof item.qualifiedName === "string"
              ? item.qualifiedName
              : undefined;
          return (
            rawQualifiedName !== undefined &&
            dataSourceIdentifier(item, rawQualifiedName) === expectedDataSource
          );
        });
  const exactCase = sourceCandidates.filter(
    (item) =>
      typeof item.qualifiedName === "string" &&
      baseQualifiedName(item.qualifiedName) === qualifiedName,
  );
  if (exactCase.length === 1) return exactCase[0];
  const caseInsensitive = sourceCandidates.filter(
    (item) =>
      typeof item.qualifiedName === "string" &&
      baseQualifiedName(item.qualifiedName).toLowerCase() ===
        qualifiedName.toLowerCase(),
  );
  return caseInsensitive.length === 1 ? caseInsensitive[0] : undefined;
}

export function taskCategory(value: unknown, explicit: unknown): string {
  const code = directString(value);
  const mapped = code === undefined ? undefined : TASK_TYPE_CODE_MAP[code];
  if (mapped !== undefined) return mapped;
  const direct = directString(explicit);
  if (direct !== undefined && isSafeTaskCategory(direct)) return direct;
  return code === undefined ? "unknown" : `taskType-${code}`;
}

function isSafeTaskCategory(value: string): boolean {
  return (
    /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value) &&
    !/^(con|prn|aux|nul|clock\$|com[1-9]|lpt[1-9])$/i.test(value)
  );
}

export function findStaleLegacyTaskDirectories(
  dataRoot: string,
  taskId: string,
  currentCategory: string,
): string[] {
  const tasksRoot = join(dataRoot, "tasks");
  if (!existsSync(tasksRoot) || taskId.includes("\\") || taskId.includes("/"))
    return [];
  return readdirSync(tasksRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== currentCategory &&
        existsSync(join(tasksRoot, entry.name, taskId, "task.json")),
    )
    .map((entry) => join("tasks", entry.name, taskId));
}

function throttleOpenCli(): void {
  const remaining = OPENCLI_MIN_INTERVAL_MS - (Date.now() - lastOpenCliCallAt);
  if (remaining > 0)
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, remaining);
  lastOpenCliCallAt = Date.now();
}

function runOpenCli(
  args: readonly string[],
  environment?: NodeJS.ProcessEnv,
  timeoutMs = OPENCLI_DEFAULT_TIMEOUT_MS,
): string {
  const executable =
    process.platform === "win32"
      ? (process.env.ComSpec ?? "cmd.exe")
      : "opencli";
  const executableArgs =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "opencli.cmd", ...args]
      : [...args];
  return execFileSync(executable, executableArgs, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    env:
      environment === undefined
        ? undefined
        : { ...process.env, ...environment },
    timeout: timeoutMs,
  });
}

function openCliTaskSource(taskId: string): Record<string, unknown> {
  throttleOpenCli();
  const output = runOpenCli([
    "szdata",
    "task-source",
    "--task-id",
    taskId,
    "--full",
    "true",
    "--window",
    "background",
    "--site-session",
    "persistent",
    "-f",
    "json",
  ]);
  const parsed: unknown = JSON.parse(output);
  const row = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!row || typeof row !== "object" || Array.isArray(row))
    throw new Error(`OpenCLI returned no task evidence for ${taskId}`);
  return row as Record<string, unknown>;
}

function openCliHoraeDetail(taskId: string): Record<string, unknown> {
  throttleOpenCli();
  const output = runOpenCli(
    ["horae", "detail", taskId, "-f", "json"],
    { OPENCLI_BROWSER_COMMAND_TIMEOUT: "5" },
    5000,
  );
  const parsed: unknown = JSON.parse(output);
  const row = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!row || typeof row !== "object" || Array.isArray(row)) return {};
  return row as Record<string, unknown>;
}

const HORAE_SQL_FIELDS: Readonly<Record<SqlSlot, readonly string[]>> = {
  create: ["createSql"],
  query: ["querySql"],
  prepare: ["prepareSql"],
  truncate: ["truncateSql"],
  finish: ["finishSql"],
};

function mergeHoraeSqlEvidence(
  row: Record<string, unknown>,
  horae: Record<string, unknown>,
): Record<string, unknown> {
  const sourceSlots =
    row.sqlSlots &&
    typeof row.sqlSlots === "object" &&
    !Array.isArray(row.sqlSlots)
      ? (row.sqlSlots as Record<string, unknown>)
      : {};
  const sqlSlots: Record<string, unknown> = { ...sourceSlots };
  for (const slot of SQL_SLOTS) {
    const current = sqlSlots[slot];
    const currentAvailable =
      current && typeof current === "object" && !Array.isArray(current)
        ? (current as Record<string, unknown>).available === true
        : false;
    if (currentAvailable) continue;
    const content = HORAE_SQL_FIELDS[slot]
      .map((field) => horae[field])
      .find(
        (value): value is string =>
          typeof value === "string" && value.trim() !== "",
      );
    if (content === undefined) continue;
    sqlSlots[slot] = {
      available: true,
      sql: content,
      source: "opencli:horae.detail",
      sources: ["opencli:horae.detail"],
    };
  }
  return { ...row, sqlSlots };
}

function needsHoraeSqlFallback(row: Record<string, unknown>): boolean {
  const status = directString(row.sqlStatus)?.toUpperCase();
  return status === "SQL_UNAVAILABLE" || status === "UNAVAILABLE";
}

function openCliJson(args: readonly string[]): unknown {
  throttleOpenCli();
  const output = runOpenCli([...args, "-f", "json"]);
  return JSON.parse(output);
}

function baseQualifiedName(value: string): string {
  return value.replace(/@[^@]+$/, "");
}

function dataSourceIdentifier(
  table: Record<string, unknown>,
  rawQualifiedName: string,
): string | undefined {
  const direct =
    directString(table.dataSourceId) ?? directString(table.dataSourceCode);
  if (direct !== undefined) return direct;
  const suffix = rawQualifiedName.match(/@([^@]+)$/)?.[1];
  if (suffix !== undefined && suffix !== "-") return suffix;
  const display = directString(table.dataSource);
  if (display === undefined) return DEFAULT_DATA_SOURCE_ID;
  if (KNOWN_DATA_SOURCE_IDS.has(display)) return display;
  if (DATA_SOURCE_ID_OVERRIDES[display] !== undefined)
    return DATA_SOURCE_ID_OVERRIDES[display];
  return display.includes("#") ? display : DEFAULT_DATA_SOURCE_ID;
}

function directTableName(value: unknown): string | undefined {
  const raw =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && !Array.isArray(value)
        ? directString((value as Record<string, unknown>).qualifiedName)
        : undefined;
  if (raw === undefined || raw.trim() === "" || raw === "-") return undefined;
  const qualifiedName = baseQualifiedName(raw.trim());
  return qualifiedName.includes(".") ? qualifiedName : undefined;
}

function tablePlatform(
  typeName: unknown,
  ddlType: unknown,
): string | undefined {
  const directDdlType = directString(ddlType);
  if (directDdlType !== undefined)
    return directDdlType.split("/", 1)[0]!.trim().toLowerCase();
  if (
    typeof typeName !== "string" ||
    typeName.trim() === "" ||
    typeName === "-"
  )
    return undefined;
  const platform = typeName
    .split("/", 1)[0]!
    .trim()
    .replace(/_table$/i, "");
  const normalized = platform.toLowerCase();
  return normalized === "gf_rdbms" ||
    !/^[a-z][a-z0-9_-]{0,63}$/.test(normalized)
    ? undefined
    : normalized;
}

function tableSummaryByName(
  qualifiedName: string,
): Record<string, unknown> | undefined {
  const separator = qualifiedName.indexOf(".");
  if (separator <= 0 || separator === qualifiedName.length - 1)
    return undefined;
  const db = qualifiedName.slice(0, separator);
  const tableName = qualifiedName.slice(separator + 1);
  const result = openCliJson([
    "szdata",
    "table",
    "--db",
    db,
    "--table",
    tableName,
    "--view",
    "full",
  ]);
  const row =
    result && typeof result === "object" && !Array.isArray(result)
      ? result
      : Array.isArray(result)
        ? result[0]
        : undefined;
  if (!row || typeof row !== "object" || Array.isArray(row)) return undefined;
  const table = row.table;
  if (!table || typeof table !== "object" || Array.isArray(table))
    return undefined;
  const structure = row.structure;
  return {
    ...(table as Record<string, unknown>),
    taskIds: tableTaskIds((row as Record<string, unknown>).tasks),
    partitionFields:
      structure && typeof structure === "object" && !Array.isArray(structure)
        ? (structure as Record<string, unknown>).partitionFields
        : undefined,
  };
}

export function tableFromDirectEvidence(
  qualifiedName: string,
  requiredTaskId?: string,
  expectedDataSource?: string,
): TableEvidence | undefined {
  let table: Record<string, unknown> | undefined;
  let tableDiscovery = "table-search";
  if (requiredTaskId === undefined) {
    try {
      const searched = openCliJson([
        "szdata",
        "table-search",
        "--keyword",
        qualifiedName,
        "--type",
        "003000",
        "--size",
        "10",
      ]);
      const candidates = (
        Array.isArray(searched) ? searched : [searched]
      ).filter((item): item is Record<string, unknown> => {
        if (!item || typeof item !== "object" || Array.isArray(item))
          return false;
        return (
          typeof item.qualifiedName === "string" &&
          baseQualifiedName(item.qualifiedName).toLowerCase() ===
            qualifiedName.toLowerCase()
        );
      });
      table = selectTableCandidate(
        candidates,
        qualifiedName,
        expectedDataSource,
      );
    } catch {
      table = undefined;
    }
  }
  if (table === undefined) {
    try {
      table = tableSummaryByName(qualifiedName);
      if (table !== undefined)
        tableDiscovery =
          requiredTaskId === undefined ? "table" : "table-task-relation";
    } catch {
      table = undefined;
    }
  }
  if (table === undefined) return undefined;
  if (directOptionalString(table.description) === undefined) {
    try {
      const summary = tableSummaryByName(qualifiedName);
      const description =
        summary === undefined
          ? undefined
          : directOptionalString(summary.description);
      if (description !== undefined) table = { ...table, description };
    } catch {
      // The Table search result remains valid even when display metadata is unavailable.
    }
  }
  if (
    requiredTaskId !== undefined &&
    !tableTaskIds(table.taskIds)?.includes(requiredTaskId)
  )
    return undefined;
  if (
    typeof table.guid !== "string" ||
    table.guid.trim() === "" ||
    table.guid === "-"
  )
    return undefined;
  const ddlResult = openCliJson(["szdata", "table-ddl", "--guid", table.guid]);
  const ddlRow = (Array.isArray(ddlResult) ? ddlResult : [ddlResult])[0];
  if (
    !ddlRow ||
    typeof ddlRow !== "object" ||
    Array.isArray(ddlRow) ||
    typeof ddlRow.ddl !== "string" ||
    ddlRow.ddl.trim() === ""
  )
    return undefined;
  const partition =
    typeof ddlRow.partition === "string" &&
    ddlRow.partition.trim() !== "" &&
    ddlRow.partition !== "-"
      ? ddlRow.partition
          .split(",")
          .map((field: string) => field.trim())
          .filter(Boolean)
      : (directStringArray(table.partitionFields) ?? []);
  const platform = tablePlatform(table.typeName, ddlRow.type ?? table.dbType);
  const dataSource = dataSourceIdentifier(
    table,
    typeof ddlRow.qualifiedName === "string"
      ? ddlRow.qualifiedName
      : typeof table.qualifiedName === "string"
        ? table.qualifiedName
        : qualifiedName,
  );
  if (platform === undefined || dataSource === undefined) return undefined;
  if (expectedDataSource !== undefined && dataSource !== expectedDataSource)
    return undefined;
  const canonicalQualifiedName = baseQualifiedName(
    typeof ddlRow.qualifiedName === "string"
      ? ddlRow.qualifiedName
      : typeof table.qualifiedName === "string"
        ? table.qualifiedName
        : qualifiedName,
  );
  const canonicalParts = canonicalQualifiedName.split(".");
  return {
    guid: table.guid,
    platform,
    dataSource,
    qualifiedName: canonicalQualifiedName,
    schema:
      canonicalParts.length > 1 ? canonicalParts.slice(0, -1).join(".") : null,
    name: canonicalParts.at(-1) ?? null,
    description: directOptionalString(table.description),
    objectType:
      typeof table.typeName === "string" && table.typeName !== "-"
        ? table.typeName
        : "UNKNOWN",
    status: directOptionalString(table.status),
    primaryKey: directStringArray(ddlRow.primaryKey ?? table.primaryKey),
    partitionFields: partition,
    ddl: ddlRow.ddl,
    evidenceProvider: `opencli:szdata ${tableDiscovery}+table-ddl`,
  };
}

function taskNameTableCandidate(taskName: unknown): string | undefined {
  const value = directString(taskName);
  if (value === undefined) return undefined;
  const separator = value.indexOf(".");
  if (separator <= 0 || separator === value.length - 1) return undefined;
  const schema = value.slice(0, separator);
  const tableName = value
    .slice(separator + 1)
    .replace(/_TIT\d+(?:_h\d+)?$/i, "");
  return tableName === "" ? undefined : `${schema}.${tableName}`;
}

function tableFromTaskRelation(
  taskId: string,
  taskName: unknown,
  expectedDataSource?: string,
): TableEvidence | undefined {
  const candidate = taskNameTableCandidate(taskName);
  return candidate === undefined
    ? undefined
    : tableFromDirectEvidence(candidate, taskId, expectedDataSource);
}

function availableSqlSlots(row: Record<string, unknown>): SqlSlot[] {
  const slots = row.sqlSlots;
  if (!slots || typeof slots !== "object" || Array.isArray(slots)) return [];
  return SQL_SLOTS.filter((slot) => {
    const entry = (slots as Record<string, unknown>)[slot];
    return (
      entry !== null &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      (entry as Record<string, unknown>).available === true &&
      typeof (entry as Record<string, unknown>).sql === "string" &&
      ((entry as Record<string, unknown>).sql as string).length > 0
    );
  });
}

function sqlEvidenceProvider(
  evidence: TaskEvidence,
  slot: SqlSlot,
): string | undefined {
  const slotEvidence = evidence.sql?.[slot];
  if (
    !slotEvidence ||
    typeof slotEvidence === "string" ||
    typeof slotEvidence !== "object"
  )
    return undefined;
  return directString(slotEvidence.evidenceProvider);
}

function toTaskEvidence(
  taskId: string,
  row: Record<string, unknown>,
): TaskEvidence {
  const slots = row.sqlSlots;
  const sql: Partial<
    Record<SqlSlot, { content: string; evidenceProvider: string }>
  > = {};
  if (slots && typeof slots === "object" && !Array.isArray(slots)) {
    for (const slot of SQL_SLOTS) {
      const entry = (slots as Record<string, unknown>)[slot];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const record = entry as Record<string, unknown>;
      if (
        record.available !== true ||
        typeof record.sql !== "string" ||
        record.sql.length === 0
      )
        continue;
      const sources = Array.isArray(record.sources)
        ? record.sources.filter(
            (source): source is string =>
              typeof source === "string" &&
              source.trim() !== "" &&
              source !== "-",
          )
        : [];
      const provider =
        sources.length > 0
          ? sources.join(",")
          : typeof record.source === "string" && record.source !== "-"
            ? record.source
            : "opencli:szdata.task-source";
      sql[slot] = { content: record.sql, evidenceProvider: provider };
    }
  }
  return {
    taskId,
    taskCategory: taskCategory(row.taskType, row.taskTypeName),
    taskType: directString(row.taskType),
    taskName: directOptionalString(row.taskName),
    topicName: directOptionalString(row.topicName),
    source: directValue(row.source),
    target: directValue(row.target),
    writeMode: directString(row.loadMode),
    partition: targetPartitionFromSql(
      sql.query && typeof sql.query.content === "string"
        ? sql.query.content
        : undefined,
    ),
    sql,
    evidenceProvider: "opencli:szdata.task-source",
  };
}

function tableEvidenceFor(
  tableResults: readonly {
    qualifiedName: string;
    evidence: TableEvidence | undefined;
  }[],
  qualifiedName: string | undefined,
): TableEvidence | undefined {
  if (qualifiedName === undefined) return undefined;
  return tableResults.find(
    (item) =>
      item.evidence !== undefined &&
      item.qualifiedName.toLowerCase() === qualifiedName.toLowerCase(),
  )?.evidence;
}

function directEndpointDataSource(
  row: Record<string, unknown>,
  side: "source" | "target",
): string | undefined {
  const endpoint = row[side];
  const fromObject =
    endpoint && typeof endpoint === "object" && !Array.isArray(endpoint)
      ? directString((endpoint as Record<string, unknown>).dataSource)
      : undefined;
  return (
    fromObject ??
    directString(row[`${side}DataSource`]) ??
    directString(row[`${side}Datasource`])
  );
}

function endpointResolution(
  taskCategory: string | null | undefined,
  side: "source" | "target",
  row: Record<string, unknown>,
  tableResults: readonly {
    qualifiedName: string;
    evidence: TableEvidence | undefined;
  }[],
): {
  table: TableEvidence | undefined;
  expectedDataSource?: string;
  conflict: boolean;
} {
  const expectedDataSource =
    directEndpointDataSource(row, side) ??
    controlledTaskEndpointDataSource(taskCategory, side);
  const table = tableEvidenceFor(tableResults, directTableName(row[side]));
  return {
    table,
    expectedDataSource,
    conflict:
      table !== undefined &&
      expectedDataSource !== undefined &&
      table.dataSource !== expectedDataSource,
  };
}

export function collectOneTask(
  dataRoot: string,
  taskId: string,
): TaskCollectionSummary {
  const szdataRow = openCliTaskSource(taskId);
  let horaeFallback: Record<string, unknown> | undefined;
  let horaeFallbackStatus:
    "NOT_NEEDED" | "RECOVERED" | "PARTIAL" | "NO_SQL" | "TIMEOUT" | "FAILED" =
    "NOT_NEEDED";
  if (needsHoraeSqlFallback(szdataRow)) {
    try {
      horaeFallback = openCliHoraeDetail(taskId);
      const unavailableSlots = SQL_SLOTS.filter((slot) => {
        const slots =
          szdataRow.sqlSlots &&
          typeof szdataRow.sqlSlots === "object" &&
          !Array.isArray(szdataRow.sqlSlots)
            ? (szdataRow.sqlSlots as Record<string, unknown>)
            : {};
        const entry = slots[slot];
        return (
          entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          (entry as Record<string, unknown>).available !== true
        );
      });
      const recoveredSlots = unavailableSlots.filter((slot) =>
        HORAE_SQL_FIELDS[slot].some(
          (field) =>
            typeof horaeFallback?.[field] === "string" &&
            horaeFallback[field]!.trim() !== "",
        ),
      );
      horaeFallbackStatus =
        recoveredSlots.length === 0
          ? "NO_SQL"
          : recoveredSlots.length === unavailableSlots.length
            ? "RECOVERED"
            : "PARTIAL";
    } catch (error) {
      horaeFallback = undefined;
      horaeFallbackStatus =
        String(error).includes("TIMEOUT") || String(error).includes("ETIMEDOUT")
          ? "TIMEOUT"
          : "FAILED";
    }
  }
  const row =
    horaeFallback === undefined
      ? szdataRow
      : mergeHoraeSqlEvidence(szdataRow, horaeFallback);
  const taskEvidence = toTaskEvidence(taskId, row);
  const staleLegacyTaskDirectories = findStaleLegacyTaskDirectories(
    dataRoot,
    taskId,
    taskEvidence.taskCategory ?? "unknown",
  );
  const sqlSlots = availableSqlSlots(row);
  const tableRequests = (["source", "target"] as const)
    .map((side) => ({ side, qualifiedName: directTableName(row[side]) }))
    .filter(
      (item): item is { side: "source" | "target"; qualifiedName: string } =>
        item.qualifiedName !== undefined,
    );
  const tableNames = tableRequests.map((item) => item.qualifiedName);
  const tableReferencesUnavailable = [row.source, row.target]
    .map((value) => (typeof value === "string" ? value.trim() : undefined))
    .filter(
      (value): value is string =>
        value !== undefined &&
        value !== "" &&
        value !== "-" &&
        !directTableName(value),
    );
  const tableResults = tableRequests.map(({ side, qualifiedName }) => ({
    side,
    qualifiedName,
    evidence: tableFromDirectEvidence(
      qualifiedName,
      undefined,
      directEndpointDataSource(row, side) ??
        controlledTaskEndpointDataSource(taskEvidence.taskCategory, side),
    ),
  }));
  const sqlTargetInputs = Object.fromEntries(
    Object.entries(taskEvidence.sql ?? {})
      .map(([slot, evidence]) => [
        slot,
        typeof evidence === "string" ? evidence : evidence?.content,
      ])
      .filter((entry): entry is [string, string] => entry[1] !== undefined),
  ) as Partial<Record<SqlSlot, string>>;
  const sqlTarget =
    shouldUseTaskRelationFallback(row.source, row.target) &&
    (taskEvidence.target === undefined || taskEvidence.target === null)
      ? findSqlTargetEvidence(
          sqlTargetInputs,
          directString(taskEvidence.taskName),
        )
      : undefined;
  const sqlRelationTarget =
    sqlTarget ??
    (shouldUseTaskRelationFallback(row.source, row.target) &&
    (taskEvidence.target === undefined || taskEvidence.target === null)
      ? findSqlTargetEvidence(
          sqlTargetInputs,
          directString(taskEvidence.taskName),
          { allowSchemaOnlyQualification: true },
        )
      : undefined);
  const sqlTargetProvider =
    sqlTarget === undefined
      ? undefined
      : sqlEvidenceProvider(taskEvidence, sqlTarget.slot);
  const sqlTargetHasSqlMcpEvidence =
    sqlTargetProvider
      ?.split(",")
      .some((provider) => provider.trim() === "sql-mcp") ?? false;
  if (shouldUseTaskRelationFallback(row.source, row.target)) {
    const taskTable =
      sqlRelationTarget === undefined
        ? tableFromTaskRelation(
            taskId,
            row.taskName,
            controlledTaskEndpointDataSource(
              taskEvidence.taskCategory,
              "target",
            ),
          )
        : tableFromDirectEvidence(
            sqlRelationTarget.qualifiedName,
            taskId,
            controlledTaskEndpointDataSource(
              taskEvidence.taskCategory,
              "target",
            ),
          );
    if (taskTable !== undefined)
      tableResults.push({
        side: "target",
        qualifiedName: taskTable.qualifiedName,
        evidence: taskTable,
      });
  }
  let sqlTargetTable: TableEvidence | undefined;
  if (
    shouldUseTaskRelationFallback(row.source, row.target) &&
    !tableResults.some(
      (item) =>
        item.side === "target" &&
        item.evidence?.evidenceProvider.includes("table-task-relation"),
    ) &&
    (taskEvidence.target === undefined || taskEvidence.target === null) &&
    sqlTargetHasSqlMcpEvidence
  ) {
    if (sqlTarget !== undefined) {
      sqlTargetTable = tableFromDirectEvidence(
        sqlTarget.qualifiedName,
        undefined,
        controlledTaskEndpointDataSource(taskEvidence.taskCategory, "target"),
      );
      tableResults.push({
        side: "target",
        qualifiedName: sqlTarget.qualifiedName,
        evidence: sqlTargetTable,
      });
    }
  }
  const sourceResolution = endpointResolution(
    taskEvidence.taskCategory,
    "source",
    row,
    tableResults,
  );
  const targetResolution = endpointResolution(
    taskEvidence.taskCategory,
    "target",
    row,
    tableResults,
  );
  const taskRelationTarget = tableResults.find(
    (item) =>
      item.side === "target" &&
      item.evidence?.evidenceProvider.includes("table-task-relation"),
  )?.evidence;
  const fallbackTarget = taskRelationTarget ?? sqlTargetTable;
  const targetValueForEvidence =
    taskEvidence.target === null && fallbackTarget !== undefined
      ? undefined
      : taskEvidence.target;
  const taskEvidenceProvider =
    taskRelationTarget !== undefined
      ? `${taskEvidence.evidenceProvider ?? "opencli:szdata.task-source"},opencli:szdata.table-task-relation`
      : sqlTargetTable !== undefined && sqlTargetProvider !== undefined
        ? `${taskEvidence.evidenceProvider ?? "opencli:szdata.task-source"},${sqlTargetProvider},sql-mcp:explicit-table-target,opencli:szdata.table`
        : taskEvidence.evidenceProvider;
  const enrichedTaskEvidence: TaskEvidence = {
    ...taskEvidence,
    source: enrichTaskEndpoint(
      taskEvidence.source,
      sourceResolution.conflict ? undefined : sourceResolution.table,
    ),
    target: enrichTaskEndpoint(
      targetValueForEvidence,
      targetResolution.conflict
        ? undefined
        : (targetResolution.table ?? fallbackTarget),
    ),
    targetEvidenceKind: targetEvidenceKindFor(
      targetValueForEvidence,
      taskRelationTarget,
      sqlTargetTable,
    ),
    evidenceProvider: taskEvidenceProvider,
  };
  const result = writeTaskInput(dataRoot, enrichedTaskEvidence);
  let tableWrites: ReturnType<typeof writeTableInput>[];
  try {
    tableWrites = tableResults
      .filter(
        (
          item,
        ): item is {
          side: "source" | "target";
          qualifiedName: string;
          evidence: TableEvidence;
        } => item.evidence !== undefined,
      )
      .map((item) => writeTableInput(dataRoot, item.evidence));
  } catch (error) {
    const failure = new Error("Table write failed after Task commit", {
      cause: error,
    }) as Error & {
      writePhase: string;
      taskDirectory: string;
      taskChanged: boolean;
    };
    failure.writePhase = "TABLE_AFTER_TASK_COMMITTED";
    failure.taskDirectory = result.directory;
    failure.taskChanged = result.changed;
    throw failure;
  }
  const summary = {
    taskId,
    taskCategory: taskEvidence.taskCategory ?? "unknown",
    taskType: taskEvidence.taskType,
    platformStatus: row.status,
    sqlCollectionStatus:
      horaeFallbackStatus === "NOT_NEEDED" ||
      horaeFallbackStatus === "RECOVERED"
        ? "SUCCESS"
        : "PARTIAL",
    collectionStatus: inputCollectionStatus(
      tableResults.length,
      tableResults.some((item) => item.evidence === undefined),
      sourceResolution.conflict || targetResolution.conflict,
      horaeFallbackStatus !== "NOT_NEEDED" &&
        horaeFallbackStatus !== "RECOVERED",
      tableReferencesUnavailable.length > 0,
    ),
    taskName: directOptionalString(row.taskName),
    topicName: directOptionalString(row.topicName),
    changed: result.changed,
    directory: result.directory,
    contentHash: result.contentHash,
    sqlSlots,
    sqlFallbackByHorae:
      horaeFallback === undefined
        ? []
        : SQL_SLOTS.filter((slot) => {
            const slots =
              row.sqlSlots &&
              typeof row.sqlSlots === "object" &&
              !Array.isArray(row.sqlSlots)
                ? (row.sqlSlots as Record<string, unknown>)
                : {};
            const entry = slots[slot];
            return (
              entry &&
              typeof entry === "object" &&
              !Array.isArray(entry) &&
              (entry as Record<string, unknown>).source ===
                "opencli:horae.detail"
            );
          }),
    horaeFallbackStatus,
    warning:
      horaeFallbackStatus === "TIMEOUT"
        ? "Horae fallback timed out after 5 seconds; unavailable SQL slots were preserved"
        : horaeFallbackStatus === "NO_SQL"
          ? "Horae fallback returned no SQL; unavailable SQL slots were preserved"
          : horaeFallbackStatus === "PARTIAL"
            ? "Horae fallback recovered only some SQL slots; remaining unavailable slots were preserved"
            : horaeFallbackStatus === "FAILED"
              ? "Horae fallback failed; unavailable SQL slots were preserved"
              : undefined,
    tablesWritten: tableWrites.length,
    tableAssets: tableWrites.map((write) => ({
      directory: write.directory,
      contentHash: write.contentHash,
    })),
    tablesFallbackByTaskRelation: tableResults
      .filter((item) =>
        item.evidence?.evidenceProvider.includes("table-task-relation"),
      )
      .map((item) => item.qualifiedName),
    tablesDeleted: tableResults
      .filter((item) => item.evidence?.status === "DELETED")
      .map((item) => item.qualifiedName),
    tablesUnavailable: tableResults
      .filter((item) => item.evidence === undefined)
      .map((item) => item.qualifiedName),
    staleLegacyTaskDirectories,
    warnings: [
      tableReferencesUnavailable.length > 0
        ? "TABLE_REFERENCE_UNAVAILABLE"
        : undefined,
      staleLegacyTaskDirectories.length > 0
        ? "STALE_LEGACY_TASK_DIRECTORY"
        : undefined,
      horaeFallbackStatus === "TIMEOUT"
        ? "HORAE_SQL_FALLBACK_TIMEOUT"
        : undefined,
    ].filter((value): value is string => value !== undefined),
    endpointDataSourceConflicts: [
      sourceResolution.conflict ? directTableName(row.source) : undefined,
      targetResolution.conflict ? directTableName(row.target) : undefined,
    ].filter((value): value is string => value !== undefined),
    tableReferencesUnavailable,
    tableEvidenceGap:
      tableResults.length === 0
        ? shouldUseTaskRelationFallback(row.source, row.target)
          ? "NO_DIRECT_SOURCE_OR_TARGET_OR_TASK_TABLE_RELATION"
          : "NO_TABLE_EVIDENCE_FOR_DIRECT_ENDPOINTS"
        : undefined,
  } satisfies TaskCollectionSummary & Record<string, unknown>;
  console.log(JSON.stringify(summary));
  return summary;
}
