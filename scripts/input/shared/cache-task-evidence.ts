import {
  isFrozenScheduleStatus,
  isManualScheduleCycle,
  type JsonValue,
  type SqlSlot,
  type SqlSlotEvidence,
  type TaskEvidence,
} from "./input-pack.ts";
import {
  buildSparkIndexTaskEvidence,
  mergeSparkIndexEvidence,
} from "../mainline/collect-one-task-input-pack-sparkindex.ts";
import { readHiveTaskSqlCache } from "../mainline/hive-task-sql-cache.ts";
import { parseRunScriptSqlCache } from "../mainline/run-script-sql-cache.ts";
import { readSzdataScheduleDetailCache } from "../mainline/szdata-schedule-detail-cache.ts";
import { readHoraeTaskTypeCache } from "../../reconcile/consumer/one-hop/schedule-evidence-cache.ts";
import { findSqlFinalTargetEvidence } from "./sql-target-evidence.ts";
import taskTypeCodeMap from "./task-type-map.json" with { type: "json" };

export const CACHE_EVIDENCE_HORAE_TASK_TYPE =
  "local:schedule-evidence:horae-task-type" as const;
export const CACHE_EVIDENCE_SCHEDULE_DETAIL =
  "local:schedule-evidence:szdata-schedule-detail" as const;
export const CACHE_EVIDENCE_HIVE_TASK_SQL =
  "local:schedule-evidence:hive-task-sql" as const;
export const CACHE_EVIDENCE_RUN_SCRIPT_SQL =
  "local:schedule-evidence:run-script-sql" as const;

const TASK_TYPE_CODE_MAP: Readonly<Record<string, string>> = taskTypeCodeMap;
const SQL_SLOTS: readonly SqlSlot[] = [
  "create",
  "query",
  "prepare",
  "truncate",
  "finish",
];
const NO_SQL_CATEGORIES = new Set([
  "checkdbflag",
  "checkHdfsFlag",
  "alert",
  "checkAlert",
  "exeSql",
  "qualityTask",
  "hiveEmail",
  "file2hive",
  "hive2file",
]);
const TO_HIVE_EXCLUDED = new Set(["file2hive", "hdfs2hive", "email2hive"]);
const HIVE2_PLATFORMS = new Set([
  "oracle",
  "mysql",
  "starrocks",
  "postgre",
  "postgres",
  "pg",
  "oceanbase",
  "sqlserver",
  "td",
  "mongo",
  "dolphindb",
]);

type JsonRecord = Record<string, unknown>;

export type CacheTaskEvidenceResult =
  | { readonly kind: "NOT_FOUND"; readonly cacheArtifacts: readonly string[] }
  | {
      readonly kind: "MANUAL_OR_FROZEN";
      readonly scheduleCycle?: string;
      readonly scheduleStatus?: string;
      readonly cacheArtifacts: readonly string[];
    }
  | {
      readonly kind: "SKIPPED";
      readonly reason: "NO_SQL_SLOT";
      readonly taskCategory: string;
      readonly cacheArtifacts: readonly string[];
    }
  | {
      readonly kind: "FAILED";
      readonly reason: string;
      readonly cacheArtifacts: readonly string[];
    }
  | {
      readonly kind: "EVIDENCE";
      readonly evidence: TaskEvidence;
      readonly cacheArtifacts: readonly string[];
      readonly missingQuery: boolean;
    };

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "-" ? undefined : trimmed;
}

function firstString(record: JsonRecord | undefined, keys: readonly string[]): string | undefined {
  if (record === undefined) return undefined;
  for (const key of keys) {
    const value = nonEmptyString(record[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string")
    return value.trim() === "" || value.trim() === "-" ? undefined : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const values: JsonValue[] = [];
    for (const item of value) {
      const json = toJsonValue(item);
      if (json === undefined) return undefined;
      values.push(json);
    }
    return values;
  }
  if (typeof value !== "object") return undefined;
  const object: { [key: string]: JsonValue } = {};
  for (const [key, item] of Object.entries(value)) {
    const json = toJsonValue(item);
    if (json === undefined) continue;
    object[key] = json;
  }
  return object;
}

function isSafeTaskCategory(value: string): boolean {
  return (
    /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value) &&
    !/^(con|prn|aux|nul|clock\$|com[1-9]|lpt[1-9])$/i.test(value)
  );
}

export function cacheTaskCategory(
  horaeType: string | undefined,
  scheduleCode: string | undefined,
): string | undefined {
  if (horaeType !== undefined && isSafeTaskCategory(horaeType)) return horaeType;
  if (scheduleCode !== undefined) {
    const mapped = TASK_TYPE_CODE_MAP[scheduleCode];
    if (mapped !== undefined) return mapped;
  }
  return horaeType;
}

function isToHiveSync(category: string): boolean {
  return category.endsWith("2hive") && !TO_HIVE_EXCLUDED.has(category);
}

function isHive2Sync(category: string): boolean {
  return category.startsWith("hive2") && HIVE2_PLATFORMS.has(category.slice(5));
}

function detailTaskId(detail: JsonRecord | undefined): string | undefined {
  return firstString(detail, ["id", "taskId", "task_id"]);
}

function sameTaskId(detail: JsonRecord | undefined, taskId: string): boolean {
  const id = detailTaskId(detail);
  return id === undefined || id === taskId;
}

function joinProviders(values: readonly (string | undefined)[]): string | undefined {
  const unique = [...new Set(values.filter((value): value is string => value !== undefined && value.trim() !== ""))];
  return unique.length === 0 ? undefined : unique.join(",");
}

function remapSparkIndexProviders(evidence: TaskEvidence): TaskEvidence {
  const mapProvider = (value: string | undefined): string | undefined => {
    if (value === undefined) return undefined;
    return [...new Set(
      value
        .split(/[+,]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          if (part === "opencli:szdata.schedule-detail")
            return CACHE_EVIDENCE_SCHEDULE_DETAIL;
          if (part === "opencli:horae.detail") return CACHE_EVIDENCE_HORAE_TASK_TYPE;
          return part;
        }),
    )].join(",");
  };
  const sql: Partial<Record<SqlSlot, SqlSlotEvidence>> = {};
  for (const slot of SQL_SLOTS) {
    const raw = evidence.sql?.[slot];
    if (raw === undefined || raw === null) continue;
    if (typeof raw === "string") {
      const provider = mapProvider(evidence.evidenceProvider);
      if (provider === undefined) continue;
      sql[slot] = { content: raw, evidenceProvider: provider };
      continue;
    }
    sql[slot] = {
      content: raw.content,
      evidenceProvider:
        mapProvider(raw.evidenceProvider) ??
        mapProvider(evidence.evidenceProvider) ??
        CACHE_EVIDENCE_SCHEDULE_DETAIL,
    };
  }
  return {
    ...evidence,
    sql,
    evidenceProvider: mapProvider(evidence.evidenceProvider),
    schedulerEvidence:
      evidence.schedulerEvidence === undefined
        ? undefined
        : {
            ...evidence.schedulerEvidence,
            evidenceProvider:
              mapProvider(evidence.schedulerEvidence.evidenceProvider) ??
              CACHE_EVIDENCE_SCHEDULE_DETAIL,
          },
  };
}

function sqlSlot(
  content: string | undefined,
  evidenceProvider: string,
): SqlSlotEvidence | undefined {
  return content === undefined
    ? undefined
    : { content, evidenceProvider };
}

function pickSql(
  ...candidates: readonly (SqlSlotEvidence | undefined)[]
): SqlSlotEvidence | undefined {
  return candidates.find((item) => item !== undefined);
}

function hiveQualifiedName(
  hiveDb: string | undefined,
  hiveTable: string | undefined,
): string | undefined {
  if (hiveDb === undefined || hiveTable === undefined) return undefined;
  if (hiveTable.includes(".")) return hiveTable;
  return `${hiveDb}.${hiveTable}`;
}

function syncInfoOf(detail: JsonRecord | undefined): JsonRecord | undefined {
  return asRecord(detail?.syncInfo);
}

function buildIdentity(
  taskId: string,
  category: string | undefined,
  horae: JsonRecord | undefined,
  schedule: JsonRecord | undefined,
  providers: readonly (string | undefined)[],
): Omit<TaskEvidence, "sql"> {
  const sync = syncInfoOf(horae);
  return {
    taskId,
    taskCategory: category,
    taskType:
      firstString(schedule, ["taskType", "task_type"]) ??
      firstString(horae, ["taskType", "task_type"]),
    taskName:
      firstString(schedule, ["taskName", "task_name"]) ??
      firstString(horae, ["name", "taskName"]),
    topicName:
      firstString(schedule, ["topicName", "topic_name"]) ??
      firstString(horae, ["topic", "topicName"]),
    scheduleCycle:
      firstString(horae, ["cycle", "scheduleCycle"]) ??
      firstString(schedule, ["cycle", "scheduleCycle"]),
    scheduleStatus:
      firstString(schedule, ["status", "scheduleStatus"]) ??
      firstString(horae, ["status", "scheduleStatus", "taskStatus"]),
    evidenceProvider: joinProviders(providers),
  };
}

function sqlFromScheduleAndHorae(
  schedule: JsonRecord | undefined,
  horae: JsonRecord | undefined,
  sync: JsonRecord | undefined,
): Partial<Record<SqlSlot, SqlSlotEvidence>> {
  const scheduleSlot = (field: string): SqlSlotEvidence | undefined =>
    sqlSlot(nonEmptyString(schedule?.[field]), CACHE_EVIDENCE_SCHEDULE_DETAIL);
  const horaeSlot = (field: string): SqlSlotEvidence | undefined =>
    sqlSlot(nonEmptyString(horae?.[field]), CACHE_EVIDENCE_HORAE_TASK_TYPE);
  const syncSlot = (field: string): SqlSlotEvidence | undefined =>
    sqlSlot(nonEmptyString(sync?.[field]), CACHE_EVIDENCE_HORAE_TASK_TYPE);
  return {
    create: pickSql(scheduleSlot("createSql"), horaeSlot("createSql")),
    query: pickSql(
      scheduleSlot("querySql"),
      horaeSlot("querySql"),
      syncSlot("querySql"),
    ),
    prepare: pickSql(scheduleSlot("prepareSql"), horaeSlot("prepareSql")),
    truncate: pickSql(scheduleSlot("truncateSql"), horaeSlot("truncateSql")),
    finish: pickSql(scheduleSlot("finishSql"), horaeSlot("finishSql")),
  };
}

function compactSql(
  sql: Partial<Record<SqlSlot, SqlSlotEvidence | undefined>>,
): Partial<Record<SqlSlot, SqlSlotEvidence>> {
  const result: Partial<Record<SqlSlot, SqlSlotEvidence>> = {};
  for (const slot of SQL_SLOTS) {
    const value = sql[slot];
    if (value !== undefined) result[slot] = value;
  }
  return result;
}

function targetKind(
  target: JsonValue | null | undefined,
  sql: Partial<Record<SqlSlot, SqlSlotEvidence>>,
  taskName: string | undefined,
): TaskEvidence["targetEvidenceKind"] {
  if (target !== undefined && target !== null) return "DIRECT_PLATFORM_TARGET";
  const inputs = Object.fromEntries(
    Object.entries(sql).map(([slot, evidence]) => [slot, evidence.content]),
  ) as Partial<Record<SqlSlot, string>>;
  return findSqlFinalTargetEvidence(inputs, taskName) === undefined
    ? undefined
    : "SQL_EXACT_TABLE_TARGET";
}

function assembleSparkIndex(
  taskId: string,
  horae: JsonRecord | undefined,
  schedule: JsonRecord | undefined,
): TaskEvidence {
  const parts: TaskEvidence[] = [];
  if (schedule !== undefined)
    parts.push(
      buildSparkIndexTaskEvidence(
        taskId,
        schedule,
        "opencli:szdata.schedule-detail",
      ),
    );
  if (horae !== undefined)
    parts.push(
      buildSparkIndexTaskEvidence(taskId, horae, "opencli:horae.detail"),
    );
  const merged =
    parts.length === 2
      ? mergeSparkIndexEvidence(parts[0]!, parts[1]!)
      : parts[0]!;
  return remapSparkIndexProviders(merged);
}

function assembleHiveTask(
  taskId: string,
  category: string,
  horae: JsonRecord | undefined,
  schedule: JsonRecord | undefined,
  cacheRoot: string,
  artifacts: string[],
): TaskEvidence {
  const identity = buildIdentity(taskId, category, horae, schedule, [
    horae === undefined ? undefined : CACHE_EVIDENCE_HORAE_TASK_TYPE,
    schedule === undefined ? undefined : CACHE_EVIDENCE_SCHEDULE_DETAIL,
    CACHE_EVIDENCE_HIVE_TASK_SQL,
  ]);
  const cached = readHiveTaskSqlCache(taskId, cacheRoot);
  const sql: Partial<Record<SqlSlot, SqlSlotEvidence>> = {};
  if (cached.status === "HIT") {
    artifacts.push("hive-task.sql");
    if (cached.sqlStatus === "AVAILABLE") {
      const create = sqlSlot(cached.createSql ?? undefined, CACHE_EVIDENCE_HIVE_TASK_SQL);
      const query = sqlSlot(cached.querySql ?? undefined, CACHE_EVIDENCE_HIVE_TASK_SQL);
      if (create !== undefined) sql.create = create;
      if (query !== undefined) sql.query = query;
    }
  }
  const target =
    toJsonValue(firstString(schedule, ["targetTable", "target"])) ??
    null;
  return {
    ...identity,
    source: null,
    target,
    writeMode: firstString(schedule, ["insertMode", "loadMode"]),
    sql: compactSql(sql),
    targetEvidenceKind: targetKind(target, sql, identity.taskName ?? undefined),
  };
}

function assembleRunScript(
  taskId: string,
  category: string,
  horae: JsonRecord | undefined,
  schedule: JsonRecord | undefined,
  cacheRoot: string,
  artifacts: string[],
): TaskEvidence {
  const identity = buildIdentity(taskId, category, horae, schedule, [
    horae === undefined ? undefined : CACHE_EVIDENCE_HORAE_TASK_TYPE,
    schedule === undefined ? undefined : CACHE_EVIDENCE_SCHEDULE_DETAIL,
    CACHE_EVIDENCE_RUN_SCRIPT_SQL,
  ]);
  const cached = parseRunScriptSqlCache(taskId, cacheRoot);
  const sql: Partial<Record<SqlSlot, SqlSlotEvidence>> = {};
  if (cached.status === "HIT") {
    artifacts.push("run-script.sql");
    if (cached.sqlStatus === "AVAILABLE") {
      const query = sqlSlot(cached.querySql ?? undefined, CACHE_EVIDENCE_RUN_SCRIPT_SQL);
      if (query !== undefined) sql.query = query;
    }
  }
  return {
    ...identity,
    source: null,
    target: null,
    sql: compactSql(sql),
    targetEvidenceKind: targetKind(null, sql, identity.taskName ?? undefined),
  };
}

function assembleToHive(
  taskId: string,
  category: string,
  horae: JsonRecord | undefined,
  schedule: JsonRecord | undefined,
): TaskEvidence {
  const sync = syncInfoOf(horae);
  const identity = buildIdentity(taskId, category, horae, schedule, [
    horae === undefined ? undefined : CACHE_EVIDENCE_HORAE_TASK_TYPE,
    schedule === undefined ? undefined : CACHE_EVIDENCE_SCHEDULE_DETAIL,
  ]);
  const source =
    toJsonValue(
      firstString(horae, ["source"]) ??
        firstString(sync, ["sourceServer"]),
    ) ?? null;
  const target =
    toJsonValue(
      firstString(sync, ["targetTable"]) ??
        hiveQualifiedName(
          firstString(sync, ["hiveDb"]) ?? firstString(horae, ["hiveDb"]),
          firstString(sync, ["hiveTable"]),
        ) ??
        firstString(schedule, ["targetTable"]),
    ) ?? null;
  const sql = compactSql(
    sqlFromScheduleAndHorae(schedule, horae, sync),
  );
  const query = pickSql(
    sqlSlot(firstString(horae, ["querySql"]), CACHE_EVIDENCE_HORAE_TASK_TYPE),
    sqlSlot(firstString(sync, ["querySql"]), CACHE_EVIDENCE_HORAE_TASK_TYPE),
    sql.query,
  );
  if (query !== undefined) sql.query = query;
  const hivePartition =
    firstString(sync, ["hivePartition"]) ??
    firstString(horae, ["hivePartition"]);
  return {
    ...identity,
    source,
    target,
    writeMode:
      firstString(schedule, ["insertMode"]) ??
      firstString(sync, ["loadMode"]),
    schedulerEvidence:
      hivePartition === undefined
        ? undefined
        : {
            hivePartition,
            evidenceProvider: CACHE_EVIDENCE_HORAE_TASK_TYPE,
          },
    sql,
    targetEvidenceKind: targetKind(target, sql, identity.taskName ?? undefined),
  };
}

function assembleHive2(
  taskId: string,
  category: string,
  horae: JsonRecord | undefined,
  schedule: JsonRecord | undefined,
): TaskEvidence {
  const sync = syncInfoOf(horae);
  const identity = buildIdentity(taskId, category, horae, schedule, [
    horae === undefined ? undefined : CACHE_EVIDENCE_HORAE_TASK_TYPE,
    schedule === undefined ? undefined : CACHE_EVIDENCE_SCHEDULE_DETAIL,
  ]);
  const source =
    toJsonValue(
      hiveQualifiedName(
        firstString(sync, ["hiveDb"]) ?? firstString(horae, ["hiveDb"]),
        firstString(sync, ["hiveTable"]),
      ),
    ) ?? null;
  const target =
    toJsonValue(
      firstString(sync, ["targetTable"]) ??
        firstString(schedule, ["targetTable"]),
    ) ?? null;
  const sql = compactSql(sqlFromScheduleAndHorae(schedule, horae, sync));
  const hivePartition =
    firstString(sync, ["hivePartition"]) ??
    firstString(horae, ["hivePartition"]);
  return {
    ...identity,
    source,
    target,
    writeMode:
      firstString(schedule, ["insertMode"]) ??
      firstString(sync, ["loadMode"]),
    schedulerEvidence:
      hivePartition === undefined
        ? undefined
        : {
            hivePartition,
            evidenceProvider: CACHE_EVIDENCE_HORAE_TASK_TYPE,
          },
    sql,
    targetEvidenceKind: targetKind(target, sql, identity.taskName ?? undefined),
  };
}

function assembleGeneric(
  taskId: string,
  category: string | undefined,
  horae: JsonRecord | undefined,
  schedule: JsonRecord | undefined,
): TaskEvidence {
  const sync = syncInfoOf(horae);
  const identity = buildIdentity(taskId, category, horae, schedule, [
    horae === undefined ? undefined : CACHE_EVIDENCE_HORAE_TASK_TYPE,
    schedule === undefined ? undefined : CACHE_EVIDENCE_SCHEDULE_DETAIL,
  ]);
  const sql = compactSql(sqlFromScheduleAndHorae(schedule, horae, sync));
  const target =
    toJsonValue(
      firstString(schedule, ["targetTable"]) ??
        firstString(sync, ["targetTable"]) ??
        hiveQualifiedName(
          firstString(sync, ["hiveDb"]) ?? firstString(horae, ["hiveDb"]),
          firstString(sync, ["hiveTable"]),
        ),
    ) ?? null;
  return {
    ...identity,
    source: toJsonValue(firstString(horae, ["source"])) ?? null,
    target,
    writeMode:
      firstString(schedule, ["insertMode"]) ?? firstString(sync, ["loadMode"]),
    sql,
    targetEvidenceKind: targetKind(target, sql, identity.taskName ?? undefined),
  };
}

export function sqlSlotCount(evidence: Pick<TaskEvidence, "sql">): number {
  return SQL_SLOTS.filter((slot) => evidence.sql?.[slot] !== undefined).length;
}

export function assembleCacheTaskEvidence(
  taskId: string,
  cacheRoot: string,
): CacheTaskEvidenceResult {
  const artifacts: string[] = [];
  const horaeRead = readHoraeTaskTypeCache(taskId, cacheRoot);
  const scheduleRead = readSzdataScheduleDetailCache(taskId, cacheRoot);
  const horae =
    horaeRead.status === "HIT" && sameTaskId(horaeRead.detail, taskId)
      ? horaeRead.detail
      : undefined;
  const schedule =
    scheduleRead.status === "HIT" && sameTaskId(scheduleRead.detail, taskId)
      ? scheduleRead.detail
      : undefined;
  if (horae !== undefined) artifacts.push("horae-task-type.json");
  if (schedule !== undefined) artifacts.push("szdata-schedule-detail.json");
  if (horae === undefined && schedule === undefined)
    return { kind: "NOT_FOUND", cacheArtifacts: artifacts };
  const cycle =
    firstString(horae, ["cycle", "scheduleCycle"]) ??
    firstString(schedule, ["cycle", "scheduleCycle"]);
  const status =
    firstString(schedule, ["status", "scheduleStatus"]) ??
    firstString(horae, ["status", "scheduleStatus", "taskStatus"]);
  if (isManualScheduleCycle(cycle) || isFrozenScheduleStatus(status))
    return {
      kind: "MANUAL_OR_FROZEN",
      scheduleCycle: cycle,
      scheduleStatus: status,
      cacheArtifacts: artifacts,
    };

  const category = cacheTaskCategory(
    firstString(horae, ["taskType", "task_type"]),
    firstString(schedule, ["taskType", "task_type"]),
  );

  let evidence: TaskEvidence;
  if (category === "sparkIndex")
    evidence = assembleSparkIndex(taskId, horae, schedule);
  else if (category === "hiveTask" || category === "hiveTask-2.0")
    evidence = assembleHiveTask(
      taskId,
      category,
      horae,
      schedule,
      cacheRoot,
      artifacts,
    );
  else if (category === "runScript" || category === "runScript-2.0")
    evidence = assembleRunScript(
      taskId,
      category,
      horae,
      schedule,
      cacheRoot,
      artifacts,
    );
  else if (category !== undefined && isToHiveSync(category))
    evidence = assembleToHive(taskId, category, horae, schedule);
  else if (category !== undefined && isHive2Sync(category))
    evidence = assembleHive2(taskId, category, horae, schedule);
  else evidence = assembleGeneric(taskId, category, horae, schedule);

  const slots = sqlSlotCount(evidence);
  if (category !== undefined && NO_SQL_CATEGORIES.has(category) && slots === 0)
    return {
      kind: "SKIPPED",
      reason: "NO_SQL_SLOT",
      taskCategory: category,
      cacheArtifacts: artifacts,
    };
  if (category === undefined && slots === 0)
    return {
      kind: "FAILED",
      reason: "NO_TASK_CATEGORY_OR_SQL",
      cacheArtifacts: artifacts,
    };

  return {
    kind: "EVIDENCE",
    evidence,
    cacheArtifacts: artifacts,
    missingQuery: evidence.sql?.query === undefined,
  };
}
