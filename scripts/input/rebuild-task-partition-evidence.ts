import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  buildSimpleTaskPartitionMap,
  type TableEvidence,
} from "./task-partition-evidence.ts";
import {
  SQL_SLOTS,
  type JsonValue,
  type SqlSlot,
  type TaskEvidence,
  type TaskDocument,
  writeTaskInput,
} from "./input-pack.ts";
import { extractSqlWrites } from "../reconcile/sql-write-evidence.ts";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredOption(name: string): string {
  const value = option(name);
  if (value === undefined || value.trim() === "")
    throw new Error(`Missing required option ${name}`);
  return value;
}

function walkNamedFiles(root: string, name: string): string[] {
  if (!existsSync(root)) return [];
  const result: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...walkNamedFiles(path, name));
    else if (entry.name === name) result.push(path);
  }
  return result;
}

function normalized(value: string): string {
  return value.replaceAll("`", "").replaceAll('"', "").trim().toLowerCase();
}

function tableKey(
  table: Pick<TableEvidence, "platform" | "qualifiedName" | "dataSource">,
): string {
  return `${normalized(table.platform)}|${normalized(table.qualifiedName)}|${normalized(table.dataSource)}`;
}

function readTablePack(path: string): TableEvidence | undefined {
  try {
    const document = JSON.parse(readFileSync(path, "utf8")) as Record<
      string,
      unknown
    >;
    const ddlFile = document.ddlFile as Record<string, unknown> | undefined;
    if (
      typeof document.platform !== "string" ||
      typeof document.qualifiedName !== "string" ||
      typeof document.dataSource !== "string" ||
      typeof document.objectType !== "string" ||
      typeof ddlFile?.path !== "string"
    )
      return undefined;
    const ddlPath = join(dirname(path), ddlFile.path);
    if (!statSync(ddlPath).isFile()) return undefined;
    return {
      guid: typeof document.guid === "string" ? document.guid : undefined,
      platform: document.platform,
      dataSource: document.dataSource,
      qualifiedName: document.qualifiedName,
      schema: typeof document.schema === "string" ? document.schema : undefined,
      name: typeof document.name === "string" ? document.name : undefined,
      description:
        typeof document.description === "string"
          ? document.description
          : undefined,
      objectType: document.objectType,
      status: typeof document.status === "string" ? document.status : undefined,
      primaryKey: Array.isArray(document.primaryKey)
        ? document.primaryKey.map(String)
        : undefined,
      partitionFields: Array.isArray(document.partitionFields)
        ? document.partitionFields.map(String)
        : undefined,
      ddl: readFileSync(ddlPath, "utf8"),
      evidenceProvider:
        typeof document.evidenceProvider === "string"
          ? document.evidenceProvider
          : typeof ddlFile.evidenceProvider === "string"
            ? ddlFile.evidenceProvider
            : "stored:table-pack",
      collectedAt:
        typeof document.collectedAt === "string"
          ? document.collectedAt
          : undefined,
    };
  } catch {
    return undefined;
  }
}

function readTaskPack(path: string):
  | {
      readonly document: TaskDocument;
      readonly sql: Partial<Record<SqlSlot, string>>;
    }
  | undefined {
  try {
    const document = JSON.parse(readFileSync(path, "utf8")) as TaskDocument;
    const sql: Partial<Record<SqlSlot, string>> = {};
    for (const item of document.sqlFiles) {
      if (
        typeof item !== "object" ||
        item === null ||
        typeof item.slot !== "string" ||
        !(SQL_SLOTS as readonly string[]).includes(item.slot) ||
        typeof item.path !== "string"
      )
        continue;
      const sqlPath = join(dirname(path), item.path);
      if (statSync(sqlPath).isFile())
        sql[item.slot as SqlSlot] = readFileSync(sqlPath, "utf8");
    }
    return { document, sql };
  } catch {
    return undefined;
  }
}

function endpointName(value: JsonValue | undefined): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return undefined;
  return typeof value.qualifiedName === "string"
    ? value.qualifiedName
    : undefined;
}

function tableCatalog(dataRoot: string): Map<string, TableEvidence> {
  const catalog = new Map<string, TableEvidence>();
  for (const path of walkNamedFiles(join(dataRoot, "tables"), "table.json")) {
    const table = readTablePack(path);
    if (table !== undefined) catalog.set(tableKey(table), table);
  }
  return catalog;
}

function tablesForTask(
  document: TaskDocument,
  sql: Partial<Record<SqlSlot, string>>,
  catalog: ReadonlyMap<string, TableEvidence>,
): TableEvidence[] {
  const target = endpointName(document.target as JsonValue | undefined);
  const names = new Set<string>(target === undefined ? [] : [target]);
  for (const content of Object.values(sql))
    if (content !== undefined)
      for (const write of extractSqlWrites(content))
        names.add(write.qualifiedName);
  const taskPlatform =
    typeof document.target === "object" &&
    document.target !== null &&
    !Array.isArray(document.target) &&
    typeof document.target.platform === "string"
      ? document.target.platform
      : undefined;
  const taskDataSource =
    typeof document.target === "object" &&
    document.target !== null &&
    !Array.isArray(document.target) &&
    typeof document.target.dataSource === "string"
      ? document.target.dataSource
      : undefined;
  const result: TableEvidence[] = [];
  for (const name of names) {
    const exact = [...catalog.values()].find(
      (table) =>
        normalized(table.qualifiedName) === normalized(name) &&
        (taskDataSource === undefined ||
          normalized(table.dataSource) === normalized(taskDataSource)) &&
        (taskPlatform === undefined ||
          normalized(table.platform) === normalized(taskPlatform)),
    );
    if (
      exact !== undefined &&
      !result.some((table) => tableKey(table) === tableKey(exact))
    )
      result.push(exact);
  }
  return result;
}

function taskEvidence(
  document: TaskDocument,
  partition: ReturnType<typeof buildSimpleTaskPartitionMap>,
  sql: Partial<Record<SqlSlot, string>>,
): TaskEvidence {
  return {
    taskId: document.taskId,
    taskCategory:
      typeof document.taskCategory === "string"
        ? document.taskCategory
        : undefined,
    taskType:
      typeof document.taskType === "string" ? document.taskType : undefined,
    taskName:
      typeof document.taskName === "string" ? document.taskName : undefined,
    topicName:
      typeof document.topicName === "string" ? document.topicName : undefined,
    scheduleCycle:
      typeof document.scheduleCycle === "string"
        ? document.scheduleCycle
        : undefined,
    scheduleStatus:
      typeof document.scheduleStatus === "string"
        ? document.scheduleStatus
        : undefined,
    source: document.source as JsonValue | undefined,
    target: document.target as JsonValue | undefined,
    targetEvidenceKind:
      document.targetEvidenceKind as TaskEvidence["targetEvidenceKind"],
    writeMode:
      typeof document.writeMode === "string" ? document.writeMode : undefined,
    partition,
    schedulerEvidence:
      document.schedulerEvidence as TaskEvidence["schedulerEvidence"],
    sql,
    evidenceProvider:
      typeof document.evidenceProvider === "string"
        ? document.evidenceProvider
        : "stored:input-pack",
    collectedAt: document.collectedAt,
  };
}

const dataRoot = resolve(requiredOption("--data-root"));
const selectedIds = option("--task-ids")
  ?.split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const selected = selectedIds === undefined ? undefined : new Set(selectedIds);
const dryRun = process.argv.includes("--dry-run");
const catalog = tableCatalog(dataRoot);
const taskPaths = walkNamedFiles(join(dataRoot, "tasks"), "task.json");
const summary = {
  scanned: 0,
  changed: 0,
  unchanged: 0,
  failed: 0,
  statuses: {} as Record<string, number>,
};
for (const path of taskPaths) {
  const loaded = readTaskPack(path);
  if (
    loaded === undefined ||
    (selected !== undefined && !selected.has(loaded.document.taskId))
  )
    continue;
  summary.scanned += 1;
  try {
    const target = endpointName(
      loaded.document.target as JsonValue | undefined,
    );
    const partition = buildSimpleTaskPartitionMap({
      taskTarget: target,
      tables: tablesForTask(loaded.document, loaded.sql, catalog),
      sql: loaded.sql,
      schedulerEvidence: loaded.document
        .schedulerEvidence as TaskEvidence["schedulerEvidence"],
    });
    const status = partition === undefined ? "UNKNOWN" : "COMPLETE";
    summary.statuses[status] = (summary.statuses[status] ?? 0) + 1;
    if (dryRun) continue;
    const result = writeTaskInput(
      dataRoot,
      taskEvidence(loaded.document, partition, loaded.sql),
    );
    if (result.changed) summary.changed += 1;
    else summary.unchanged += 1;
  } catch (error) {
    summary.failed += 1;
    console.error(
      JSON.stringify({
        path,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
console.log(
  JSON.stringify({
    mode: dryRun ? "DRY_RUN" : "REBUILT_FROM_STORED_SQL",
    ...summary,
  }),
);
if (summary.failed > 0) process.exitCode = 1;
