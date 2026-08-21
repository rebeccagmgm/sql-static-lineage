import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

export const INPUT_PACK_SCHEMA_VERSION = "1.0.0" as const;
export const SQL_SLOTS = [
  "create",
  "query",
  "prepare",
  "truncate",
  "finish",
] as const;
export type SqlSlot = (typeof SQL_SLOTS)[number];

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

export interface SqlSlotEvidence {
  readonly content: string;
  readonly evidenceProvider?: string;
}

export interface TaskEvidence {
  readonly taskId: string;
  readonly taskCategory?: string | null;
  readonly taskType?: string | null;
  readonly taskName?: string | null;
  readonly topicName?: string | null;
  /** Direct platform endpoint config; table endpoints may include dataSource. */
  readonly source?: JsonValue | null;
  /** Direct platform endpoint config; table endpoints may include dataSource. */
  readonly target?: JsonValue | null;
  /** Explains the evidence level of a populated target endpoint. */
  readonly targetEvidenceKind?:
    | "DIRECT_PLATFORM_TARGET"
    | "TABLE_TASK_RELATION_DIRECTION_UNKNOWN"
    | "SQL_EXACT_TABLE_TARGET"
    | null;
  readonly writeMode?: string | null;
  readonly partition?: Readonly<Record<string, string>> | null;
  readonly sql?: Partial<Record<SqlSlot, SqlSlotEvidence | string | null>>;
  readonly evidenceProvider?: string;
  readonly collectedAt?: string;
}

export interface TableEvidence {
  readonly guid?: string | null;
  readonly platform: string;
  readonly dataSource: string;
  readonly qualifiedName: string;
  readonly schema?: string | null;
  readonly name?: string | null;
  /** Platform-supplied display description; never used for identity. */
  readonly description?: string | null;
  readonly objectType: string;
  readonly status?: string | null;
  readonly primaryKey?: readonly string[] | null;
  readonly partitionFields?: readonly string[] | null;
  readonly ddl: string;
  readonly evidenceProvider: string;
  readonly collectedAt?: string;
}

export interface TaskDocument extends JsonObject {
  readonly schemaVersion: typeof INPUT_PACK_SCHEMA_VERSION;
  readonly taskId: string;
  readonly taskCategory: string;
  readonly sqlFiles: JsonValue[];
  readonly collectedAt: string;
  readonly contentHash: string;
}

export interface TableDocument extends JsonObject {
  readonly schemaVersion: typeof INPUT_PACK_SCHEMA_VERSION;
  readonly stableTableId: string;
  readonly platform: string;
  readonly dataSource: string;
  readonly qualifiedName: string;
  readonly objectType: string;
  readonly ddlFile: JsonObject;
  readonly collectedAt: string;
  readonly contentHash: string;
}

export interface WriteResult {
  readonly changed: boolean;
  readonly directory: string;
  readonly contentHash: string;
  readonly stableTableId?: string;
}

const SHA256 = /^[a-f0-9]{64}$/;
const FORBIDDEN_DERIVED_FIELDS = new Set([
  "inputs",
  "outputs",
  "tableRef",
  "statementRole",
  "statement_role",
  "lineage",
  "fieldLineage",
  "field_lineage",
  "processingRelation",
  "processing_relation",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(`Input Pack validation failed: ${message}`);
}

function requireNonEmpty(
  value: string | null | undefined,
  field: string,
): string {
  if (typeof value !== "string" || value.trim() === "" || value.trim() === "-")
    fail(`${field} must be a non-empty string`);
  return value;
}

function requireOptionalNonEmpty(
  value: string | null | undefined,
  field: string,
): void {
  if (
    value !== undefined &&
    value !== null &&
    (typeof value !== "string" || value.trim() === "" || value.trim() === "-")
  ) {
    fail(`${field} must be omitted, null, or a non-empty string`);
  }
}

function safeSegment(value: string, field: string): string {
  requireNonEmpty(value, field);
  if (
    !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value) ||
    /^(con|prn|aux|nul|clock\$|com[1-9]|lpt[1-9])$/i.test(value)
  ) {
    fail(`${field} is not a safe path segment`);
  }
  return value;
}

function safePlatformToken(value: string, field: string): string {
  requireNonEmpty(value, field);
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value))
    fail(`${field} must be a standard platform token`);
  return value;
}

function safeTableStableId(value: string): string {
  requireNonEmpty(value, "stableTableId");
  if (
    value.length > 240 ||
    value === "." ||
    value === ".." ||
    /[\\/:*?"<>|\u0000-\u001f]/.test(value) ||
    /[. ]$/.test(value)
  )
    fail(
      "stableTableId contains characters that cannot be used as a directory name",
    );
  return value;
}

function validateJson(
  value: unknown,
  path: string,
): asserts value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      fail(`${path} must contain finite JSON numbers`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateJson(item, `${path}[${index}]`));
    return;
  }
  if (isObject(value)) {
    Object.entries(value).forEach(([key, item]) => {
      if (item === undefined) fail(`${path}.${key} cannot be undefined`);
      validateJson(item, `${path}.${key}`);
    });
    return;
  }
  fail(`${path} is not JSON serializable`);
}

function validateNoPlaceholders(value: unknown, path: string): void {
  if (typeof value === "string") {
    if (value.trim() === "" || value.trim() === "-")
      fail(`${path} cannot use an empty string or '-' placeholder`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      validateNoPlaceholders(item, `${path}[${index}]`),
    );
    return;
  }
  if (isObject(value)) {
    Object.entries(value).forEach(([key, item]) =>
      validateNoPlaceholders(item, `${path}.${key}`),
    );
  }
}

export function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      fail("canonical JSON cannot contain non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key]!)}`)
    .join(",")}}`;
}

export function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Text(value: string): string {
  return sha256Bytes(Buffer.from(value, "utf8"));
}

export function sha256File(path: string): string {
  return sha256Bytes(readFileSync(path));
}

export function canonicalHash(
  value: JsonValue,
  excludedFields: readonly string[] = [],
): string {
  if (!isObject(value)) fail("canonicalHash requires a JSON object");
  const excluded = new Set(excludedFields);
  const filtered: JsonObject = {};
  for (const [key, item] of Object.entries(value))
    if (!excluded.has(key)) filtered[key] = item as JsonValue;
  return sha256Text(canonicalJson(filtered));
}

export function stableTableId(
  evidence: Pick<
    TableEvidence,
    "guid" | "platform" | "dataSource" | "qualifiedName"
  >,
): { stableTableId: string; guid?: string } {
  const guid =
    evidence.guid === undefined || evidence.guid === null
      ? undefined
      : requireNonEmpty(evidence.guid, "guid");
  safePlatformToken(evidence.platform, "platform");
  const dataSource = requireNonEmpty(evidence.dataSource, "dataSource");
  const qualifiedName = requireNonEmpty(
    evidence.qualifiedName,
    "qualifiedName",
  );
  return {
    stableTableId: safeTableStableId(`${qualifiedName}__${dataSource}`),
    ...(guid === undefined ? {} : { guid }),
  };
}

function collectAt(value: string | undefined): string {
  return value ?? new Date().toISOString();
}

function validateForbiddenFields(document: Record<string, unknown>): void {
  for (const key of Object.keys(document))
    if (FORBIDDEN_DERIVED_FIELDS.has(key))
      fail(`derived field ${key} is not allowed in Task/Table documents`);
}

function validateHash(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !SHA256.test(value))
    fail(`${field} must be a lowercase SHA-256`);
}

function buildTaskDocument(evidence: TaskEvidence): {
  document: TaskDocument;
  sql: readonly { slot: SqlSlot; content: string; evidenceProvider: string }[];
} {
  const taskId = safeSegment(evidence.taskId, "taskId");
  const document: JsonObject = {
    schemaVersion: INPUT_PACK_SCHEMA_VERSION,
    taskId,
    sqlFiles: [],
    collectedAt: collectAt(evidence.collectedAt),
  };
  for (const [key, value] of Object.entries({
    taskCategory: evidence.taskCategory,
    taskType: evidence.taskType,
    taskName: evidence.taskName,
    topicName: evidence.topicName,
    source: evidence.source,
    target: evidence.target,
    targetEvidenceKind: evidence.targetEvidenceKind,
    writeMode: evidence.writeMode,
    partition: evidence.partition,
    evidenceProvider: evidence.evidenceProvider,
  })) {
    if (value !== undefined) document[key] = value as JsonValue;
  }
  validateJson(document, "task");
  if (document.source !== undefined && document.source !== null)
    validateNoPlaceholders(document.source, "task.source");
  if (document.target !== undefined && document.target !== null)
    validateNoPlaceholders(document.target, "task.target");
  for (const field of [
    "taskCategory",
    "taskType",
    "taskName",
    "topicName",
    "writeMode",
    "evidenceProvider",
  ])
    requireOptionalNonEmpty(
      document[field] as string | null | undefined,
      `task.${field}`,
    );
  if (document.partition !== undefined && document.partition !== null) {
    if (
      !isObject(document.partition) ||
      Object.keys(document.partition).length === 0
    )
      fail("task.partition must be null or a non-empty object");
    for (const [key, value] of Object.entries(document.partition)) {
      requireNonEmpty(key, "partition key");
      requireNonEmpty(String(value), `partition.${key}`);
    }
  }
  const sql: { slot: SqlSlot; content: string; evidenceProvider: string }[] =
    [];
  for (const slot of SQL_SLOTS) {
    const raw = evidence.sql?.[slot];
    if (raw === undefined || raw === null) continue;
    const content = typeof raw === "string" ? raw : raw.content;
    const evidenceProvider =
      typeof raw === "string"
        ? evidence.evidenceProvider
        : (raw.evidenceProvider ?? evidence.evidenceProvider);
    requireNonEmpty(content, `sql.${slot}`);
    const provider = requireNonEmpty(
      evidenceProvider,
      `sql.${slot}.evidenceProvider`,
    );
    sql.push({ slot, content, evidenceProvider: provider });
  }
  return { document: document as TaskDocument, sql };
}

export function createTaskDocument(evidence: TaskEvidence): TaskDocument {
  const built = buildTaskDocument(evidence);
  const sqlFiles = built.sql.map(({ slot, content, evidenceProvider }) => ({
    slot,
    path: `sql/${slot}.sql`,
    sha256: sha256Text(content),
    evidenceProvider,
  }));
  const withoutHash = { ...built.document, sqlFiles } as JsonObject;
  const document = {
    ...withoutHash,
    contentHash: canonicalHash(withoutHash, ["collectedAt", "contentHash"]),
  } as TaskDocument;
  validateTaskDocument(document);
  return document;
}

export function validateTaskDocument(
  document: unknown,
): asserts document is TaskDocument {
  if (!isObject(document)) fail("task document must be an object");
  validateForbiddenFields(document);
  const allowed = new Set([
    "schemaVersion",
    "taskId",
    "taskCategory",
    "taskType",
    "taskName",
    "topicName",
    "source",
    "target",
    "targetEvidenceKind",
    "writeMode",
    "partition",
    "sqlFiles",
    "evidenceProvider",
    "collectedAt",
    "contentHash",
  ]);
  for (const key of Object.keys(document))
    if (!allowed.has(key)) fail(`unknown task field ${key}`);
  if (document.schemaVersion !== INPUT_PACK_SCHEMA_VERSION)
    fail("unsupported task schemaVersion");
  safeSegment(String(document.taskId), "taskId");
  safeSegment(String(document.taskCategory), "taskCategory");
  if (!Array.isArray(document.sqlFiles)) fail("task.sqlFiles must be an array");
  const seen = new Set<string>();
  for (const item of document.sqlFiles) {
    if (!isObject(item)) fail("task.sqlFiles entries must be objects");
    const slot = item.slot;
    if (
      typeof slot !== "string" ||
      !(SQL_SLOTS as readonly string[]).includes(slot) ||
      seen.has(slot)
    )
      fail("task.sqlFiles has an invalid or duplicate slot");
    seen.add(slot);
    if (item.path !== `sql/${slot}.sql`)
      fail(`task.sqlFiles.${slot}.path is invalid`);
    validateHash(item.sha256, `task.sqlFiles.${slot}.sha256`);
    requireNonEmpty(
      String(item.evidenceProvider),
      `task.sqlFiles.${slot}.evidenceProvider`,
    );
  }
  for (const field of [
    "taskCategory",
    "taskType",
    "writeMode",
    "evidenceProvider",
  ])
    requireOptionalNonEmpty(
      document[field] as string | null | undefined,
      `task.${field}`,
    );
  if (
    document.partition !== undefined &&
    document.partition !== null &&
    (!isObject(document.partition) ||
      Object.keys(document.partition).length === 0)
  )
    fail("task.partition must be null or a non-empty object");
  if (
    document.targetEvidenceKind !== undefined &&
    document.targetEvidenceKind !== null &&
    document.targetEvidenceKind !== "DIRECT_PLATFORM_TARGET" &&
    document.targetEvidenceKind !== "TABLE_TASK_RELATION_DIRECTION_UNKNOWN" &&
    document.targetEvidenceKind !== "SQL_EXACT_TABLE_TARGET"
  )
    fail("task.targetEvidenceKind is invalid");
  if (document.targetEvidenceKind === "DIRECT_PLATFORM_TARGET") {
    if (document.target === undefined || document.target === null)
      fail("task.targetEvidenceKind DIRECT_PLATFORM_TARGET requires target");
  }
  if (document.targetEvidenceKind === "TABLE_TASK_RELATION_DIRECTION_UNKNOWN") {
    const target = document.target;
    if (
      !isObject(target) ||
      ["platform", "qualifiedName", "dataSource"].some(
        (field) =>
          typeof target[field] !== "string" || target[field].trim() === "",
      )
    )
      fail(
        "task.targetEvidenceKind TABLE_TASK_RELATION_DIRECTION_UNKNOWN requires a physical target",
      );
    if (
      typeof document.evidenceProvider !== "string" ||
      !document.evidenceProvider.includes("table-task-relation")
    )
      fail(
        "task.targetEvidenceKind TABLE_TASK_RELATION_DIRECTION_UNKNOWN requires table-task-relation evidence",
      );
  }
  if (document.targetEvidenceKind === "SQL_EXACT_TABLE_TARGET") {
    const target = document.target;
    if (
      !isObject(target) ||
      ["platform", "qualifiedName", "dataSource"].some(
        (field) =>
          typeof target[field] !== "string" || target[field].trim() === "",
      )
    )
      fail(
        "task.targetEvidenceKind SQL_EXACT_TABLE_TARGET requires a physical target",
      );
    if (
      typeof document.evidenceProvider !== "string" ||
      !document.evidenceProvider.includes("sql-mcp:explicit-table-target") ||
      !document.evidenceProvider.includes("opencli:szdata.table")
    )
      fail(
        "task.targetEvidenceKind SQL_EXACT_TABLE_TARGET requires SQL target and Table evidence",
      );
  }
  requireNonEmpty(String(document.collectedAt), "task.collectedAt");
  validateHash(document.contentHash, "task.contentHash");
  if (
    canonicalHash(document as JsonObject, ["collectedAt", "contentHash"]) !==
    document.contentHash
  )
    fail("task.contentHash does not match document");
}

function buildTableDocument(evidence: TableEvidence): {
  document: TableDocument;
  ddl: string;
} {
  const platform = safePlatformToken(evidence.platform, "platform");
  const dataSource = requireNonEmpty(evidence.dataSource, "dataSource");
  const qualifiedName = requireNonEmpty(
    evidence.qualifiedName,
    "qualifiedName",
  );
  if (qualifiedName.includes("@") || /\s/.test(qualifiedName))
    fail("qualifiedName must not contain a data-source suffix or whitespace");
  const objectType = requireNonEmpty(evidence.objectType, "objectType");
  const ddl = requireNonEmpty(evidence.ddl, "ddl");
  const identity = stableTableId(evidence);
  const document: JsonObject = {
    schemaVersion: INPUT_PACK_SCHEMA_VERSION,
    stableTableId: identity.stableTableId,
    platform,
    dataSource,
    qualifiedName,
    objectType,
    ddlFile: {
      path: "ddl.sql",
      sha256: sha256Text(ddl),
      evidenceProvider: requireNonEmpty(
        evidence.evidenceProvider,
        "evidenceProvider",
      ),
    },
    collectedAt: collectAt(evidence.collectedAt),
  };
  if (identity.guid !== undefined) document.guid = identity.guid;
  for (const [key, value] of Object.entries({
    schema: evidence.schema,
    name: evidence.name,
    description: evidence.description,
    status: evidence.status,
    primaryKey: evidence.primaryKey,
    partitionFields: evidence.partitionFields,
    evidenceProvider: evidence.evidenceProvider,
  })) {
    if (value !== undefined) document[key] = value as JsonValue;
  }
  validateJson(document, "table");
  for (const field of [
    "schema",
    "name",
    "description",
    "status",
    "evidenceProvider",
  ])
    requireOptionalNonEmpty(
      document[field] as string | null | undefined,
      `table.${field}`,
    );
  if (document.primaryKey !== undefined && document.primaryKey !== null) {
    if (!Array.isArray(document.primaryKey))
      fail("table.primaryKey must be an array or omitted");
    for (const field of document.primaryKey)
      requireNonEmpty(String(field), "primary key field");
  }
  if (
    document.partitionFields !== undefined &&
    document.partitionFields !== null
  ) {
    if (!Array.isArray(document.partitionFields))
      fail("table.partitionFields must be an array or omitted");
    for (const field of document.partitionFields)
      requireNonEmpty(String(field), "partition field");
  }
  return { document: document as TableDocument, ddl };
}

export function createTableDocument(evidence: TableEvidence): TableDocument {
  const built = buildTableDocument(evidence);
  const document = {
    ...built.document,
    contentHash: canonicalHash(built.document, ["collectedAt", "contentHash"]),
  } as TableDocument;
  validateTableDocument(document);
  return document;
}

export function validateTableDocument(
  document: unknown,
): asserts document is TableDocument {
  if (!isObject(document)) fail("table document must be an object");
  validateForbiddenFields(document);
  const allowed = new Set([
    "schemaVersion",
    "stableTableId",
    "platform",
    "guid",
    "dataSource",
    "qualifiedName",
    "schema",
    "name",
    "description",
    "objectType",
    "status",
    "primaryKey",
    "partitionFields",
    "ddlFile",
    "evidenceProvider",
    "collectedAt",
    "contentHash",
  ]);
  for (const key of Object.keys(document))
    if (!allowed.has(key)) fail(`unknown table field ${key}`);
  if (document.schemaVersion !== INPUT_PACK_SCHEMA_VERSION)
    fail("unsupported table schemaVersion");
  safeTableStableId(String(document.stableTableId));
  safePlatformToken(String(document.platform), "table.platform");
  for (const field of ["dataSource", "qualifiedName", "objectType"])
    requireNonEmpty(String(document[field]), `table.${field}`);
  if (
    String(document.qualifiedName).includes("@") ||
    /\s/.test(String(document.qualifiedName))
  )
    fail("table.qualifiedName has a data-source suffix or whitespace");
  if (document.guid !== undefined)
    requireNonEmpty(String(document.guid), "table.guid");
  for (const field of [
    "schema",
    "name",
    "description",
    "status",
    "evidenceProvider",
  ])
    requireOptionalNonEmpty(
      document[field] as string | null | undefined,
      `table.${field}`,
    );
  if (
    document.primaryKey !== undefined &&
    document.primaryKey !== null &&
    (!Array.isArray(document.primaryKey) || document.primaryKey.length === 0)
  )
    fail("table.primaryKey must be a non-empty array or omitted");
  if (document.primaryKey !== undefined && document.primaryKey !== null)
    for (const field of document.primaryKey)
      requireNonEmpty(String(field), "primary key field");
  if (
    document.partitionFields !== undefined &&
    document.partitionFields !== null
  ) {
    if (!Array.isArray(document.partitionFields))
      fail("table.partitionFields must be an array");
    for (const field of document.partitionFields)
      requireNonEmpty(String(field), "partition field");
  }
  if (!isObject(document.ddlFile) || document.ddlFile.path !== "ddl.sql")
    fail("table.ddlFile is invalid");
  validateHash(document.ddlFile.sha256, "table.ddlFile.sha256");
  requireNonEmpty(
    String(document.ddlFile.evidenceProvider),
    "table.ddlFile.evidenceProvider",
  );
  requireNonEmpty(String(document.collectedAt), "table.collectedAt");
  validateHash(document.contentHash, "table.contentHash");
  if (
    canonicalHash(document as JsonObject, ["collectedAt", "contentHash"]) !==
    document.contentHash
  )
    fail("table.contentHash does not match document");
}

export function findMalformedTableDirectories(dataRoot: string): string[] {
  const tablesRoot = join(dataRoot, "tables");
  if (!existsSync(tablesRoot)) return [];
  const malformed: string[] = [];
  for (const entry of readdirSync(tablesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      safePlatformToken(entry.name, "tables.platform");
    } catch {
      malformed.push(join(tablesRoot, entry.name));
    }
  }
  return malformed;
}

export function assertExistingTableLayout(dataRoot: string): void {
  const malformed = findMalformedTableDirectories(dataRoot);
  if (malformed.length > 0)
    throw new Error(
      `Input Pack data root contains malformed Table platform directories: ${malformed.join(
        ", ",
      )}. Use a new empty data root or migrate/quarantine these directories first; no existing files were deleted.`,
    );
}

function filesystemPath(path: string): string {
  if (process.platform !== "win32") return path;
  const absolute = resolve(path);
  return absolute.startsWith("\\\\?\\") ? absolute : `\\\\?\\${absolute}`;
}

export function quarantineMalformedTableDirectories(
  dataRoot: string,
): { quarantineRoot: string; moved: string[] } | undefined {
  const absoluteRoot = resolve(dataRoot);
  const malformed = findMalformedTableDirectories(absoluteRoot);
  if (malformed.length === 0) return undefined;
  const quarantineRoot = mkdtempSync(`${absoluteRoot}.quarantine-`);
  const quarantineTablesRoot = join(quarantineRoot, "tables");
  mkdirSync(quarantineTablesRoot, { recursive: true });
  const destinations = malformed.map((source) =>
    join(quarantineTablesRoot, basename(source)),
  );
  if (destinations.some((destination) => existsSync(destination)))
    throw new Error(
      `Cannot quarantine malformed Table directories because a destination already exists under ${quarantineRoot}`,
    );
  malformed.forEach((source, index) =>
    renameSync(filesystemPath(source), filesystemPath(destinations[index]!)),
  );
  return { quarantineRoot, moved: destinations };
}

function writeJson(path: string, value: JsonValue): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readContentHash(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return isObject(parsed) && typeof parsed.contentHash === "string"
      ? parsed.contentHash
      : undefined;
  } catch {
    return undefined;
  }
}

function replaceDirectory(
  stagedDirectory: string,
  targetDirectory: string,
): void {
  const parent = dirname(targetDirectory);
  mkdirSync(parent, { recursive: true });
  const backup = `${targetDirectory}.previous-${randomUUID()}`;
  const hadTarget = existsSync(targetDirectory);
  if (hadTarget) renameSync(targetDirectory, backup);
  try {
    renameSync(stagedDirectory, targetDirectory);
    if (hadTarget) rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (existsSync(targetDirectory))
      rmSync(targetDirectory, { recursive: true, force: true });
    if (hadTarget && existsSync(backup)) renameSync(backup, targetDirectory);
    throw error;
  }
}

export function writeTaskInput(
  dataRoot: string,
  evidence: TaskEvidence,
): WriteResult {
  mkdirSync(dataRoot, { recursive: true });
  const built = buildTaskDocument(evidence);
  const document = createTaskDocument(evidence);
  const taskId = document.taskId;
  const taskCategory = safeSegment(
    String(document.taskCategory),
    "taskCategory",
  );
  const targetDirectory = join(dataRoot, "tasks", taskCategory, taskId);
  if (
    readContentHash(join(targetDirectory, "task.json")) === document.contentHash
  )
    return {
      changed: false,
      directory: targetDirectory,
      contentHash: document.contentHash,
    };
  const stagingRoot = mkdtempSync(join(dataRoot, ".input-pack-task-"));
  const stagingDirectory = join(stagingRoot, taskCategory, taskId);
  try {
    writeJson(join(stagingDirectory, "task.json"), document);
    for (const item of built.sql) {
      const path = join(stagingDirectory, "sql", `${item.slot}.sql`);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, item.content, "utf8");
      const indexedFile = document.sqlFiles.find(
        (file): file is JsonObject => isObject(file) && file.slot === item.slot,
      );
      const expectedHash =
        indexedFile && typeof indexedFile.sha256 === "string"
          ? indexedFile.sha256
          : undefined;
      if (sha256File(path) !== expectedHash)
        fail(`staged SQL hash mismatch for ${item.slot}`);
    }
    validateTaskDocument(
      JSON.parse(readFileSync(join(stagingDirectory, "task.json"), "utf8")),
    );
    replaceDirectory(stagingDirectory, targetDirectory);
    return {
      changed: true,
      directory: targetDirectory,
      contentHash: document.contentHash,
    };
  } finally {
    if (existsSync(stagingRoot))
      rmSync(stagingRoot, { recursive: true, force: true });
  }
}

export function writeTableInput(
  dataRoot: string,
  evidence: TableEvidence,
): WriteResult {
  mkdirSync(dataRoot, { recursive: true });
  const built = buildTableDocument(evidence);
  const document = createTableDocument(evidence);
  const targetDirectory = join(
    dataRoot,
    "tables",
    document.platform,
    document.stableTableId,
  );
  if (
    readContentHash(join(targetDirectory, "table.json")) ===
    document.contentHash
  )
    return {
      changed: false,
      directory: targetDirectory,
      contentHash: document.contentHash,
      stableTableId: document.stableTableId,
    };
  const stagingRoot = mkdtempSync(join(dataRoot, ".input-pack-table-"));
  const stagingDirectory = join(stagingRoot, document.stableTableId);
  try {
    writeJson(join(stagingDirectory, "table.json"), document);
    writeFileSync(join(stagingDirectory, "ddl.sql"), built.ddl, "utf8");
    if (
      sha256File(join(stagingDirectory, "ddl.sql")) !== document.ddlFile.sha256
    )
      fail("staged DDL hash mismatch");
    validateTableDocument(
      JSON.parse(readFileSync(join(stagingDirectory, "table.json"), "utf8")),
    );
    replaceDirectory(stagingDirectory, targetDirectory);
    return {
      changed: true,
      directory: targetDirectory,
      contentHash: document.contentHash,
      stableTableId: document.stableTableId,
    };
  } finally {
    if (existsSync(stagingRoot))
      rmSync(stagingRoot, { recursive: true, force: true });
  }
}
