import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SqlSession } from "../../src/session.ts";
import type { Dialect } from "../../src/dialect.ts";
import {
  sha256File,
  validateTableDocument,
  validateTaskDocument,
  type JsonValue,
  type TaskDocument,
  type TableDocument,
} from "../input/input-pack.ts";
import { buildPlanFacts } from "../plans/plan-adapter.ts";
import { taskSqlDialect } from "../plans/task-sql-dialect.ts";

type JsonRecord = Record<string, unknown>;

export type ReconciliationStatus =
  "MATCHED" | "SQL_ONLY" | "SCHEDULE_ONLY" | "UNRESOLVED";

export interface EvidenceObservation {
  readonly source:
    | "HORAE_RELATION"
    | "INPUT_PACK_TASK"
    | "INPUT_PACK_SQL"
    | "TABLE_PACK"
    | "SQL_PARSE"
    | "SZDATA_TASK_SOURCE";
  readonly provider: string;
  readonly locator: string;
  readonly observedAt: string | null;
  readonly sha256?: string;
  readonly contentHash?: string;
  readonly detail?: JsonRecord;
}

export interface PhysicalTableRef {
  readonly platform: string | null;
  readonly dataSource: string | null;
  readonly qualifiedName: string | null;
  readonly identityStatus:
    "RESOLVED" | "QUALIFIED_NAME_ONLY" | "AMBIGUOUS" | "UNKNOWN";
}

export interface PartitionAssignment {
  readonly field: string;
  readonly expression: string;
  readonly valueStatus: "OBSERVED_RENDERED_VALUE" | "RUNTIME_EXPRESSION";
  readonly observedValue: string | null;
}

export interface SqlDirectRead {
  readonly qualifiedName: string;
  readonly statementIndexes: readonly number[];
  readonly syntaxDiagnosticCount: number;
  readonly parserUnknownCount: number;
}

export interface SqlWrite {
  readonly qualifiedName: string;
  readonly writeKind:
    "INSERT_OVERWRITE" | "INSERT_INTO" | "MERGE_INTO" | "CTAS";
  readonly statementSpan: { readonly start: number; readonly end: number };
  readonly partition: readonly PartitionAssignment[];
}

interface TaskSqlFile {
  readonly slot: string;
  readonly path: string;
  readonly absolutePath: string;
  readonly sha256: string;
  readonly evidenceProvider: string;
  readonly content: string;
}

interface LoadedTaskPack {
  readonly status: "AVAILABLE" | "MISSING" | "AMBIGUOUS" | "INVALID";
  readonly taskId: string;
  readonly taskPath: string | null;
  readonly document: (TaskDocument & JsonRecord) | null;
  readonly sqlFiles: readonly TaskSqlFile[];
  readonly issues: readonly string[];
}

interface TableCatalogEntry {
  readonly table: PhysicalTableRef;
  readonly evidence: EvidenceObservation;
}

interface TableCatalog {
  readonly byQualifiedName: ReadonlyMap<string, readonly TableCatalogEntry[]>;
  readonly issues: readonly string[];
}

export interface DirectReadObservation {
  readonly table: PhysicalTableRef;
  readonly sql: SqlDirectRead;
  readonly evidence: readonly EvidenceObservation[];
}

export interface ConfirmedWriteObservation {
  readonly table: PhysicalTableRef;
  readonly writeKind: string | null;
  readonly partition: readonly PartitionAssignment[];
  readonly evidence: readonly EvidenceObservation[];
}

export interface UnconfirmedTargetObservation {
  readonly qualifiedName: string | null;
  readonly reason: string;
  readonly evidence: readonly EvidenceObservation[];
}

export interface ParentObservation {
  readonly taskId: string;
  readonly taskName: string | null;
  readonly scheduleEvidence: readonly EvidenceObservation[];
  readonly inputPackStatus: LoadedTaskPack["status"];
  readonly resolutionStatus: "RESOLVED" | "UNRESOLVED";
  readonly confirmedWrites: readonly ConfirmedWriteObservation[];
  readonly unconfirmedTargets: readonly UnconfirmedTargetObservation[];
  readonly issues: readonly string[];
}

export interface ReconciliationItem {
  readonly status: ReconciliationStatus;
  readonly taskId: string | null;
  readonly table: PhysicalTableRef;
  readonly read: DirectReadObservation | null;
  readonly write: ConfirmedWriteObservation | null;
  readonly evidence: readonly EvidenceObservation[];
  readonly reason: string | null;
}

export interface OneHopReconciliationResult {
  readonly schemaVersion: "1.0.0";
  readonly taskId: string;
  readonly generatedAt: string;
  readonly currentTask: {
    readonly inputPackPath: string;
    readonly inputPackContentHash: string;
    readonly directReads: readonly DirectReadObservation[];
  };
  readonly schedule: {
    readonly direction: "UPSTREAM";
    readonly depth: 1;
    readonly parents: readonly {
      readonly taskId: string;
      readonly taskName: string | null;
      readonly evidence: readonly EvidenceObservation[];
    }[];
    readonly evidence: readonly EvidenceObservation[];
  };
  readonly parents: readonly ParentObservation[];
  readonly reconciliation: readonly ReconciliationItem[];
  readonly counts: {
    readonly sqlDirectReads: number;
    readonly scheduleParents: number;
    readonly matched: number;
    readonly sqlOnly: number;
    readonly scheduleOnly: number;
    readonly unresolved: number;
  };
  readonly nextScheduleTaskIds: readonly string[];
  readonly nextDataTaskIds: readonly string[];
  readonly issues: readonly string[];
  readonly boundaries: {
    readonly staticSqlOnly: true;
    readonly schedulerExecution: "NOT_EVALUATED";
    readonly runtimeDelivery: "NOT_EVALUATED";
    readonly businessCorrectness: "NOT_EVALUATED";
    readonly producerCandidatesAreWrites: false;
    readonly partitionScope: "TASK_TO_TABLE_WRITE";
  };
}

export type OpenCliRunner = (args: readonly string[]) => unknown;

export interface ReconcileOneHopOptions {
  readonly dataRoot: string;
  readonly openCliRunner?: OpenCliRunner;
  readonly now?: () => string;
  readonly taskSourceTimeoutSeconds?: number;
}

const SAFE_TASK_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const OPENCLI_PROCESS_TIMEOUT_MS = 90_000;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "-" ? null : trimmed;
}

function normalizeTable(value: string): string {
  return value.replaceAll("`", "").replaceAll('"', "").trim().toLowerCase();
}

function tableIdentityKey(table: PhysicalTableRef): string | null {
  if (
    table.identityStatus !== "RESOLVED" ||
    !table.platform ||
    !table.dataSource ||
    !table.qualifiedName
  )
    return null;
  return `${table.platform.toLowerCase()}|${table.dataSource.toLowerCase()}|${normalizeTable(table.qualifiedName)}`;
}

function compareText(left: string | null, right: string | null): number {
  return (left ?? "").localeCompare(right ?? "");
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n]+/g, " ").slice(0, 500);
}

function firstResult(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function rowsOf(value: unknown): JsonRecord[] {
  if (Array.isArray(value))
    return value
      .map(asRecord)
      .filter((item): item is JsonRecord => item !== null);
  const record = asRecord(value);
  if (!record) return [];
  for (const field of ["records", "rows", "data", "results"]) {
    const rows = record[field];
    if (Array.isArray(rows))
      return rows
        .map(asRecord)
        .filter((item): item is JsonRecord => item !== null);
  }
  return [];
}

export function defaultOpenCliRunner(args: readonly string[]): unknown {
  const windowsLauncher = join(process.env.APPDATA ?? "", "npm", "opencli.ps1");
  const executable =
    process.platform === "win32" ? "powershell.exe" : "opencli";
  const commandArgs =
    process.platform === "win32"
      ? [
          "-NoLogo",
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          windowsLauncher,
          ...args,
        ]
      : [...args];
  if (process.platform === "win32" && !existsSync(windowsLauncher))
    throw new Error("OPENCLI_LAUNCHER_MISSING");
  const result = spawnSync(executable, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: OPENCLI_PROCESS_TIMEOUT_MS,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `OPENCLI_COMMAND_FAILED:${args.slice(0, 3).join(" ")}:${safeMessage(result.error ?? result.stderr)}`,
    );
  const stdout = result.stdout.trim();
  if (!stdout)
    throw new Error(`OPENCLI_EMPTY_OUTPUT:${args.slice(0, 3).join(" ")}`);
  return JSON.parse(stdout) as unknown;
}

export function extractSqlDirectReads(
  sql: string,
  dialect: Dialect,
): SqlDirectRead[] {
  const session = SqlSession.create(sql, dialect);
  const byTable = new Map<
    string,
    {
      display: string;
      statementIndexes: Set<number>;
      syntaxDiagnosticCount: number;
      parserUnknownCount: number;
    }
  >();
  for (const [statementIndex, cell] of session.doc.statements.entries()) {
    const plan = buildPlanFacts(cell, sql, {
      statement_index: statementIndex,
      dialect,
    });
    for (const qualifiedName of plan.physical_inputs) {
      const key = normalizeTable(qualifiedName);
      const current = byTable.get(key) ?? {
        display: key,
        statementIndexes: new Set<number>(),
        syntaxDiagnosticCount: 0,
        parserUnknownCount: 0,
      };
      current.statementIndexes.add(statementIndex);
      current.syntaxDiagnosticCount += cell.diagnostics.length;
      current.parserUnknownCount += plan.unknowns.length;
      byTable.set(key, current);
    }
  }
  return [...byTable.values()]
    .map((item) => ({
      qualifiedName: item.display,
      statementIndexes: [...item.statementIndexes].sort(
        (left, right) => left - right,
      ),
      syntaxDiagnosticCount: item.syntaxDiagnosticCount,
      parserUnknownCount: item.parserUnknownCount,
    }))
    .sort((left, right) =>
      compareText(left.qualifiedName, right.qualifiedName),
    );
}

function splitTopLevelComma(value: string): string[] {
  const result: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (quote) {
      if (character === quote && value[index - 1] !== "\\") quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    else if (character === "," && depth === 0) {
      result.push(value.slice(start, index));
      start = index + 1;
    }
  }
  result.push(value.slice(start));
  return result.map((item) => item.trim()).filter(Boolean);
}

function partitionAssignments(value: string | null): PartitionAssignment[] {
  if (!value) return [];
  return splitTopLevelComma(value).map((assignment) => {
    const equals = assignment.indexOf("=");
    const field = (equals >= 0 ? assignment.slice(0, equals) : assignment)
      .trim()
      .replaceAll("`", "")
      .toLowerCase();
    const expression = (
      equals >= 0 ? assignment.slice(equals + 1) : "UNKNOWN"
    ).trim();
    const literal = expression.match(/^'(.*)'$/s)?.[1] ?? null;
    return {
      field,
      expression,
      valueStatus:
        literal === null ? "RUNTIME_EXPRESSION" : "OBSERVED_RENDERED_VALUE",
      observedValue: literal,
    };
  });
}

function balancedParenthesized(
  sql: string,
  openingIndex: number,
): { content: string; end: number } | null {
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  for (let index = openingIndex; index < sql.length; index += 1) {
    const character = sql[index]!;
    if (quote) {
      if (character === quote && sql[index - 1] !== "\\") quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "(") depth += 1;
    else if (character === ")") {
      depth -= 1;
      if (depth === 0)
        return { content: sql.slice(openingIndex + 1, index), end: index + 1 };
    }
  }
  return null;
}

function maskSqlCommentsAndStrings(sql: string): string {
  const masked = [...sql];
  let state: "CODE" | "SINGLE_QUOTE" | "LINE_COMMENT" | "BLOCK_COMMENT" =
    "CODE";
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index]!;
    const next = sql[index + 1];
    if (state === "SINGLE_QUOTE") {
      if (character !== "\n" && character !== "\r") masked[index] = " ";
      if (character === "\\" && index + 1 < sql.length) {
        if (next !== "\n" && next !== "\r") masked[index + 1] = " ";
        index += 1;
      } else if (character === "'" && next === "'") {
        masked[index + 1] = " ";
        index += 1;
      } else if (character === "'") state = "CODE";
      continue;
    }
    if (state === "LINE_COMMENT") {
      if (character === "\n" || character === "\r") state = "CODE";
      else masked[index] = " ";
      continue;
    }
    if (state === "BLOCK_COMMENT") {
      if (character === "*" && next === "/") {
        masked[index] = " ";
        masked[index + 1] = " ";
        index += 1;
        state = "CODE";
      } else if (character !== "\n" && character !== "\r") masked[index] = " ";
      continue;
    }
    if (character === "'") {
      masked[index] = " ";
      state = "SINGLE_QUOTE";
    } else if (character === "-" && next === "-") {
      masked[index] = " ";
      masked[index + 1] = " ";
      index += 1;
      state = "LINE_COMMENT";
    } else if (character === "/" && next === "*") {
      masked[index] = " ";
      masked[index + 1] = " ";
      index += 1;
      state = "BLOCK_COMMENT";
    }
  }
  return masked.join("");
}

export function extractSqlWrites(sql: string): SqlWrite[] {
  const maskedSql = maskSqlCommentsAndStrings(sql);
  const pattern =
    /\b(INSERT\s+(OVERWRITE|INTO)\s+(?:TABLE\s+)?(?!DIRECTORY\b)|MERGE\s+INTO\s+)([`"A-Za-z0-9_.-]+)/gi;
  const writes: SqlWrite[] = [];
  for (const match of maskedSql.matchAll(pattern)) {
    const start = match.index ?? 0;
    const qualifiedName = normalizeTable(match[3]!);
    const matchedText = match[1]!.toUpperCase();
    const writeKind = matchedText.startsWith("MERGE")
      ? "MERGE_INTO"
      : match[2]!.toUpperCase() === "OVERWRITE"
        ? "INSERT_OVERWRITE"
        : "INSERT_INTO";
    const afterTarget = start + match[0].length;
    const tail = maskedSql.slice(afterTarget);
    const partitionMatch = tail.match(/^\s*PARTITION\s*\(/i);
    const openingIndex = partitionMatch
      ? afterTarget + partitionMatch[0].lastIndexOf("(")
      : -1;
    const partition =
      openingIndex >= 0 ? balancedParenthesized(sql, openingIndex) : null;
    const statementEnd = maskedSql.indexOf(";", partition?.end ?? afterTarget);
    writes.push({
      qualifiedName,
      writeKind,
      statementSpan: {
        start,
        end: statementEnd >= 0 ? statementEnd : sql.length,
      },
      partition: partitionAssignments(partition?.content ?? null),
    });
  }
  const ctasPattern =
    /\bCREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"A-Za-z0-9_.-]+)\s+AS\s+(?=SELECT\b|WITH\b)/gi;
  for (const match of maskedSql.matchAll(ctasPattern)) {
    const start = match.index ?? 0;
    const statementEnd = maskedSql.indexOf(";", start + match[0].length);
    writes.push({
      qualifiedName: normalizeTable(match[1]!),
      writeKind: "CTAS",
      statementSpan: {
        start,
        end: statementEnd >= 0 ? statementEnd : sql.length,
      },
      partition: [],
    });
  }
  return writes.sort(
    (left, right) => left.statementSpan.start - right.statementSpan.start,
  );
}

function loadTaskPack(dataRoot: string, taskId: string): LoadedTaskPack {
  const tasksRoot = join(dataRoot, "tasks");
  if (!existsSync(tasksRoot))
    return {
      status: "MISSING",
      taskId,
      taskPath: null,
      document: null,
      sqlFiles: [],
      issues: ["TASKS_ROOT_MISSING"],
    };
  const candidates = readdirSync(tasksRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(tasksRoot, entry.name, taskId, "task.json"))
    .filter(existsSync);
  if (candidates.length === 0)
    return {
      status: "MISSING",
      taskId,
      taskPath: null,
      document: null,
      sqlFiles: [],
      issues: ["TASK_INPUT_PACK_MISSING"],
    };
  if (candidates.length > 1)
    return {
      status: "AMBIGUOUS",
      taskId,
      taskPath: null,
      document: null,
      sqlFiles: [],
      issues: candidates.map((path) => `TASK_INPUT_PACK_AMBIGUOUS:${path}`),
    };
  const taskPath = candidates[0]!;
  try {
    const raw = JSON.parse(readFileSync(taskPath, "utf8")) as unknown;
    validateTaskDocument(raw);
    const document = raw as TaskDocument & JsonRecord;
    if (document.taskId !== taskId) throw new Error("TASK_ID_MISMATCH");
    const sqlFiles: TaskSqlFile[] = [];
    for (const rawFile of document.sqlFiles) {
      const file = asRecord(rawFile);
      if (!file) continue;
      const slot = String(file.slot);
      const relativePath = String(file.path);
      const absolutePath = join(dirname(taskPath), relativePath);
      if (!existsSync(absolutePath))
        throw new Error(`SQL_FILE_MISSING:${slot}`);
      const expectedHash = String(file.sha256);
      if (sha256File(absolutePath) !== expectedHash)
        throw new Error(`SQL_FILE_HASH_MISMATCH:${slot}`);
      sqlFiles.push({
        slot,
        path: relativePath,
        absolutePath,
        sha256: expectedHash,
        evidenceProvider: String(file.evidenceProvider),
        content: readFileSync(absolutePath, "utf8"),
      });
    }
    return {
      status: "AVAILABLE",
      taskId,
      taskPath,
      document,
      sqlFiles,
      issues: [],
    };
  } catch (error) {
    return {
      status: "INVALID",
      taskId,
      taskPath,
      document: null,
      sqlFiles: [],
      issues: [`TASK_INPUT_PACK_INVALID:${safeMessage(error)}`],
    };
  }
}

function loadTableCatalog(dataRoot: string): TableCatalog {
  const tablesRoot = join(dataRoot, "tables");
  const byQualifiedName = new Map<string, TableCatalogEntry[]>();
  const issues: string[] = [];
  if (!existsSync(tablesRoot))
    return { byQualifiedName, issues: ["TABLES_ROOT_MISSING"] };
  for (const platform of readdirSync(tablesRoot, {
    withFileTypes: true,
  }).filter((entry) => entry.isDirectory())) {
    const platformRoot = join(tablesRoot, platform.name);
    for (const tableDirectory of readdirSync(platformRoot, {
      withFileTypes: true,
    }).filter((entry) => entry.isDirectory())) {
      const tablePath = join(platformRoot, tableDirectory.name, "table.json");
      if (!existsSync(tablePath)) continue;
      try {
        const raw = JSON.parse(readFileSync(tablePath, "utf8")) as unknown;
        validateTableDocument(raw);
        const document = raw as TableDocument & JsonRecord;
        const qualifiedName = String(document.qualifiedName);
        const key = normalizeTable(qualifiedName);
        const entry: TableCatalogEntry = {
          table: {
            platform: String(document.platform),
            dataSource: String(document.dataSource),
            qualifiedName: key,
            identityStatus: "RESOLVED",
          },
          evidence: {
            source: "TABLE_PACK",
            provider: String(document.evidenceProvider ?? "input-pack:table"),
            locator: tablePath,
            observedAt: String(document.collectedAt),
            contentHash: String(document.contentHash),
          },
        };
        byQualifiedName.set(key, [...(byQualifiedName.get(key) ?? []), entry]);
      } catch (error) {
        issues.push(
          `TABLE_INPUT_PACK_INVALID:${tablePath}:${safeMessage(error)}`,
        );
      }
    }
  }
  return { byQualifiedName, issues };
}

function resolveCatalogTable(
  catalog: TableCatalog,
  qualifiedName: string | null,
): TableCatalogEntry {
  if (!qualifiedName)
    return {
      table: {
        platform: null,
        dataSource: null,
        qualifiedName: null,
        identityStatus: "UNKNOWN",
      },
      evidence: {
        source: "TABLE_PACK",
        provider: "input-pack:table",
        locator: "UNAVAILABLE",
        observedAt: null,
        detail: { reason: "QUALIFIED_NAME_MISSING" },
      },
    };
  const key = normalizeTable(qualifiedName);
  const candidates = catalog.byQualifiedName.get(key) ?? [];
  const identities = new Map<string, TableCatalogEntry>();
  for (const candidate of candidates) {
    const identity = tableIdentityKey(candidate.table);
    if (identity) identities.set(identity, candidate);
  }
  if (identities.size === 1) return [...identities.values()][0]!;
  return {
    table: {
      platform: null,
      dataSource: null,
      qualifiedName: key,
      identityStatus:
        candidates.length > 1 ? "AMBIGUOUS" : "QUALIFIED_NAME_ONLY",
    },
    evidence: {
      source: "TABLE_PACK",
      provider: "input-pack:table",
      locator: "UNRESOLVED",
      observedAt: null,
      detail: { candidateCount: candidates.length },
    },
  };
}

function targetQualifiedName(target: unknown): string | null {
  if (typeof target === "string") return stringValue(target);
  return stringValue(asRecord(target)?.qualifiedName);
}

function targetTable(
  target: unknown,
  catalog: TableCatalog,
): TableCatalogEntry {
  const record = asRecord(target);
  const qualifiedName = targetQualifiedName(target);
  if (record) {
    const platform = stringValue(record.platform);
    const dataSource = stringValue(record.dataSource);
    if (platform && dataSource && qualifiedName)
      return {
        table: {
          platform,
          dataSource,
          qualifiedName: normalizeTable(qualifiedName),
          identityStatus: "RESOLVED",
        },
        evidence: resolveCatalogTable(catalog, qualifiedName).evidence,
      };
  }
  return resolveCatalogTable(catalog, qualifiedName);
}

function inputPackTaskEvidence(pack: LoadedTaskPack): EvidenceObservation {
  return {
    source: "INPUT_PACK_TASK",
    provider: String(pack.document?.evidenceProvider ?? "input-pack:task"),
    locator: pack.taskPath ?? "UNAVAILABLE",
    observedAt: stringValue(pack.document?.collectedAt),
    contentHash: stringValue(pack.document?.contentHash) ?? undefined,
  };
}

function inputPackSqlEvidence(file: TaskSqlFile): EvidenceObservation {
  return {
    source: "INPUT_PACK_SQL",
    provider: file.evidenceProvider,
    locator: file.absolutePath,
    observedAt: null,
    sha256: file.sha256,
    detail: { slot: file.slot, relativePath: file.path },
  };
}

function partitionFromDocument(value: unknown): PartitionAssignment[] {
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record)
    .sort(([left], [right]) => compareText(left, right))
    .map(([field, rawValue]) => {
      const expression = String(rawValue);
      const runtime = /\$\{|\{\{|\{%|<%/u.test(expression);
      return {
        field: field.toLowerCase(),
        expression,
        valueStatus: runtime
          ? ("RUNTIME_EXPRESSION" as const)
          : ("OBSERVED_RENDERED_VALUE" as const),
        observedValue: runtime ? null : expression,
      };
    });
}

function mergeWrites(
  writes: readonly ConfirmedWriteObservation[],
): ConfirmedWriteObservation[] {
  const merged = new Map<string, ConfirmedWriteObservation>();
  for (const write of writes) {
    const key = tableIdentityKey(write.table);
    if (!key) continue;
    const current = merged.get(key);
    merged.set(
      key,
      current
        ? {
            ...current,
            writeKind: current.writeKind ?? write.writeKind,
            partition:
              current.partition.length > 0
                ? current.partition
                : write.partition,
            evidence: [...current.evidence, ...write.evidence],
          }
        : write,
    );
  }
  return [...merged.values()].sort((left, right) =>
    compareText(left.table.qualifiedName, right.table.qualifiedName),
  );
}

function writesFromPack(
  pack: LoadedTaskPack,
  catalog: TableCatalog,
): {
  confirmedWrites: ConfirmedWriteObservation[];
  unconfirmedTargets: UnconfirmedTargetObservation[];
} {
  if (!pack.document) return { confirmedWrites: [], unconfirmedTargets: [] };
  const confirmedWrites: ConfirmedWriteObservation[] = [];
  const unconfirmedTargets: UnconfirmedTargetObservation[] = [];
  const packEvidence = inputPackTaskEvidence(pack);
  const target = targetTable(pack.document.target, catalog);
  const evidenceKind = stringValue(pack.document.targetEvidenceKind);
  if (
    evidenceKind === "DIRECT_PLATFORM_TARGET" ||
    evidenceKind === "SQL_EXACT_TABLE_TARGET"
  ) {
    if (tableIdentityKey(target.table))
      confirmedWrites.push({
        table: target.table,
        writeKind: stringValue(pack.document.writeMode),
        partition: partitionFromDocument(pack.document.partition),
        evidence: [packEvidence, target.evidence],
      });
    else
      unconfirmedTargets.push({
        qualifiedName: target.table.qualifiedName,
        reason: "TARGET_IDENTITY_UNRESOLVED",
        evidence: [packEvidence, target.evidence],
      });
  } else if (target.table.qualifiedName) {
    unconfirmedTargets.push({
      qualifiedName: target.table.qualifiedName,
      reason: evidenceKind ?? "TARGET_DIRECTION_UNAVAILABLE",
      evidence: [packEvidence, target.evidence],
    });
  }
  for (const file of pack.sqlFiles) {
    for (const sqlWrite of extractSqlWrites(file.content)) {
      if (!sqlWrite.qualifiedName.includes(".")) continue;
      const resolved = resolveCatalogTable(catalog, sqlWrite.qualifiedName);
      if (!tableIdentityKey(resolved.table)) continue;
      confirmedWrites.push({
        table: resolved.table,
        writeKind: sqlWrite.writeKind,
        partition: sqlWrite.partition,
        evidence: [
          inputPackSqlEvidence(file),
          {
            source: "SQL_PARSE",
            provider: "sql-static-lineage:write-extractor",
            locator: `${file.absolutePath}#char=${sqlWrite.statementSpan.start}-${sqlWrite.statementSpan.end}`,
            observedAt: null,
            detail: { writeKind: sqlWrite.writeKind },
          },
          resolved.evidence,
        ],
      });
    }
  }
  return { confirmedWrites: mergeWrites(confirmedWrites), unconfirmedTargets };
}

function liveParent(
  taskId: string,
  runner: OpenCliRunner,
  catalog: TableCatalog,
  now: () => string,
  timeoutSeconds: number,
): { confirmedWrites: ConfirmedWriteObservation[]; issues: string[] } {
  const args = [
    "szdata",
    "task-source",
    "--task-id",
    taskId,
    "-f",
    "json",
    "--timeout",
    String(timeoutSeconds),
  ];
  try {
    const response = asRecord(firstResult(runner(args)));
    if (!response)
      return { confirmedWrites: [], issues: ["TASK_SOURCE_INVALID_RESPONSE"] };
    const status = stringValue(response.status);
    const target = stringValue(response.target);
    const evidence: EvidenceObservation = {
      source: "SZDATA_TASK_SOURCE",
      provider:
        stringValue(response.evidenceLevel) ?? "opencli:szdata.task-source",
      locator: `opencli ${args.join(" ")}`,
      observedAt: now(),
      detail: {
        status,
        sqlStatus: stringValue(response.sqlStatus),
        limitations: (response.limitations ?? null) as JsonValue,
      },
    };
    if (status !== "SUCCEEDED" || !target)
      return {
        confirmedWrites: [],
        issues: [`TASK_SOURCE_TARGET_UNAVAILABLE:${status ?? "UNKNOWN"}`],
      };
    const resolved = resolveCatalogTable(catalog, target);
    if (!tableIdentityKey(resolved.table))
      return {
        confirmedWrites: [],
        issues: [`TASK_SOURCE_TARGET_IDENTITY_UNRESOLVED:${target}`],
      };
    return {
      confirmedWrites: [
        {
          table: resolved.table,
          writeKind: stringValue(response.loadMode),
          partition: partitionAssignments(stringValue(response.hivePartition)),
          evidence: [evidence, resolved.evidence],
        },
      ],
      issues: [],
    };
  } catch (error) {
    return {
      confirmedWrites: [],
      issues: [`TASK_SOURCE_FAILED:${safeMessage(error)}`],
    };
  }
}

function currentDirectReads(
  pack: LoadedTaskPack,
  catalog: TableCatalog,
): DirectReadObservation[] {
  if (!pack.document || !pack.taskPath)
    throw new Error("CURRENT_TASK_INPUT_PACK_UNAVAILABLE");
  const dialect = taskSqlDialect(String(pack.document.taskCategory));
  const byTable = new Map<string, DirectReadObservation>();
  for (const file of pack.sqlFiles) {
    for (const read of extractSqlDirectReads(file.content, dialect)) {
      const resolved = resolveCatalogTable(catalog, read.qualifiedName);
      const key = normalizeTable(read.qualifiedName);
      const observation: DirectReadObservation = {
        table: resolved.table,
        sql: read,
        evidence: [
          inputPackSqlEvidence(file),
          {
            source: "SQL_PARSE",
            provider: "sql-static-lineage:plan-adapter",
            locator: `${file.absolutePath}#statements=${read.statementIndexes.join(",")}`,
            observedAt: null,
            detail: {
              dialect,
              syntaxDiagnosticCount: read.syntaxDiagnosticCount,
              parserUnknownCount: read.parserUnknownCount,
            },
          },
          resolved.evidence,
        ],
      };
      const current = byTable.get(key);
      byTable.set(
        key,
        current
          ? {
              ...current,
              sql: {
                ...current.sql,
                statementIndexes: uniqueSorted([
                  ...current.sql.statementIndexes.map(String),
                  ...read.statementIndexes.map(String),
                ]).map(Number),
                syntaxDiagnosticCount:
                  current.sql.syntaxDiagnosticCount +
                  read.syntaxDiagnosticCount,
                parserUnknownCount:
                  current.sql.parserUnknownCount + read.parserUnknownCount,
              },
              evidence: [...current.evidence, ...observation.evidence],
            }
          : observation,
      );
    }
  }
  return [...byTable.values()].sort((left, right) =>
    compareText(left.table.qualifiedName, right.table.qualifiedName),
  );
}

export function reconcileOneHop(
  taskId: string,
  options: ReconcileOneHopOptions,
): OneHopReconciliationResult {
  if (!SAFE_TASK_ID.test(taskId)) throw new Error("INVALID_TASK_ID");
  const dataRoot = resolve(options.dataRoot);
  const runner = options.openCliRunner ?? defaultOpenCliRunner;
  const now = options.now ?? (() => new Date().toISOString());
  const timeoutSeconds = options.taskSourceTimeoutSeconds ?? 20;
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds <= 0)
    throw new Error("INVALID_TASK_SOURCE_TIMEOUT");

  const currentPack = loadTaskPack(dataRoot, taskId);
  if (
    currentPack.status !== "AVAILABLE" ||
    !currentPack.document ||
    !currentPack.taskPath
  )
    throw new Error(
      `CURRENT_TASK_INPUT_PACK_${currentPack.status}:${currentPack.issues.join(";")}`,
    );
  const catalog = loadTableCatalog(dataRoot);
  const directReads = currentDirectReads(currentPack, catalog);

  const horaeArgs = [
    "horae",
    "relation",
    taskId,
    "--direction",
    "up",
    "--depth",
    "1",
    "-f",
    "json",
  ];
  const scheduleObservedAt = now();
  const scheduleEvidence: EvidenceObservation = {
    source: "HORAE_RELATION",
    provider: "opencli:horae.relation",
    locator: `opencli ${horaeArgs.join(" ")}`,
    observedAt: scheduleObservedAt,
    detail: { direction: "up", depth: 1 },
  };
  const scheduleRows = rowsOf(runner(horaeArgs));
  const scheduleParents = new Map<
    string,
    { taskId: string; taskName: string | null; evidence: EvidenceObservation[] }
  >();
  for (const row of scheduleRows) {
    const parentTaskId = stringValue(row.task_id ?? row.taskId);
    if (!parentTaskId || !SAFE_TASK_ID.test(parentTaskId)) continue;
    scheduleParents.set(parentTaskId, {
      taskId: parentTaskId,
      taskName: stringValue(row.task_name ?? row.taskName),
      evidence: [
        {
          ...scheduleEvidence,
          detail: {
            direction: "up",
            depth: 1,
            relationDirection: stringValue(row.direction),
          },
        },
      ],
    });
  }

  const orderedScheduleParents = [...scheduleParents.values()].sort(
    (left, right) => compareText(left.taskId, right.taskId),
  );
  const parents: ParentObservation[] = [];
  for (const scheduleParent of orderedScheduleParents) {
    const pack = loadTaskPack(dataRoot, scheduleParent.taskId);
    const fromPack = writesFromPack(pack, catalog);
    const live =
      pack.status === "AVAILABLE"
        ? {
            confirmedWrites: [] as ConfirmedWriteObservation[],
            issues: [] as string[],
          }
        : liveParent(
            scheduleParent.taskId,
            runner,
            catalog,
            now,
            timeoutSeconds,
          );
    const confirmedWrites = mergeWrites([
      ...fromPack.confirmedWrites,
      ...live.confirmedWrites,
    ]);
    parents.push({
      taskId: scheduleParent.taskId,
      taskName: scheduleParent.taskName,
      scheduleEvidence: scheduleParent.evidence,
      inputPackStatus: pack.status,
      resolutionStatus: confirmedWrites.length > 0 ? "RESOLVED" : "UNRESOLVED",
      confirmedWrites,
      unconfirmedTargets: fromPack.unconfirmedTargets,
      issues: [...pack.issues, ...live.issues],
    });
  }

  const readsByIdentity = new Map<string, DirectReadObservation>();
  for (const read of directReads) {
    const identity = tableIdentityKey(read.table);
    if (identity) readsByIdentity.set(identity, read);
  }
  const matchedReadIdentities = new Set<string>();
  const reconciliation: ReconciliationItem[] = [];
  for (const parent of parents) {
    if (parent.confirmedWrites.length === 0) {
      const unconfirmed = parent.unconfirmedTargets[0];
      const table = resolveCatalogTable(
        catalog,
        unconfirmed?.qualifiedName ?? null,
      ).table;
      reconciliation.push({
        status: "UNRESOLVED",
        taskId: parent.taskId,
        table,
        read: tableIdentityKey(table)
          ? (readsByIdentity.get(tableIdentityKey(table)!) ?? null)
          : null,
        write: null,
        evidence: [
          ...parent.scheduleEvidence,
          ...(unconfirmed?.evidence ?? []),
        ],
        reason:
          unconfirmed?.reason ?? parent.issues[0] ?? "PARENT_WRITE_UNRESOLVED",
      });
      continue;
    }
    for (const write of parent.confirmedWrites) {
      const identity = tableIdentityKey(write.table)!;
      const read = readsByIdentity.get(identity) ?? null;
      if (read) matchedReadIdentities.add(identity);
      reconciliation.push({
        status: read ? "MATCHED" : "SCHEDULE_ONLY",
        taskId: parent.taskId,
        table: write.table,
        read,
        write,
        evidence: [
          ...parent.scheduleEvidence,
          ...write.evidence,
          ...(read?.evidence ?? []),
        ],
        reason: read ? null : "CONFIRMED_PARENT_WRITE_NOT_READ_BY_CURRENT_SQL",
      });
    }
  }
  for (const read of directReads) {
    const identity = tableIdentityKey(read.table);
    if (identity && matchedReadIdentities.has(identity)) continue;
    reconciliation.push({
      status: "SQL_ONLY",
      taskId: null,
      table: read.table,
      read,
      write: null,
      evidence: read.evidence,
      reason: identity
        ? "NO_CONFIRMED_HORAE_PARENT_WRITE"
        : "READ_TABLE_IDENTITY_UNRESOLVED",
    });
  }

  const count = (status: ReconciliationStatus): number =>
    reconciliation.filter((item) => item.status === status).length;
  return {
    schemaVersion: "1.0.0",
    taskId,
    generatedAt: now(),
    currentTask: {
      inputPackPath: currentPack.taskPath,
      inputPackContentHash: String(currentPack.document.contentHash),
      directReads,
    },
    schedule: {
      direction: "UPSTREAM",
      depth: 1,
      parents: orderedScheduleParents,
      evidence: [scheduleEvidence],
    },
    parents,
    reconciliation,
    counts: {
      sqlDirectReads: directReads.length,
      scheduleParents: scheduleParents.size,
      matched: count("MATCHED"),
      sqlOnly: count("SQL_ONLY"),
      scheduleOnly: count("SCHEDULE_ONLY"),
      unresolved: count("UNRESOLVED"),
    },
    nextScheduleTaskIds: uniqueSorted([...scheduleParents.keys()]),
    nextDataTaskIds: uniqueSorted(
      reconciliation
        .filter((item) => item.status === "MATCHED" && item.taskId)
        .map((item) => item.taskId!),
    ),
    issues: [
      ...catalog.issues,
      ...parents.flatMap((parent) => parent.issues),
    ].sort(compareText),
    boundaries: {
      staticSqlOnly: true,
      schedulerExecution: "NOT_EVALUATED",
      runtimeDelivery: "NOT_EVALUATED",
      businessCorrectness: "NOT_EVALUATED",
      producerCandidatesAreWrites: false,
      partitionScope: "TASK_TO_TABLE_WRITE",
    },
  };
}

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function main(): void {
  const args = process.argv.slice(2);
  const taskId =
    option(args, "--task-id") ??
    (args[0] && !args[0].startsWith("--") ? args[0] : undefined);
  const dataRoot =
    option(args, "--data-root") ?? process.env.SQL_LINEAGE_DATA_ROOT;
  const output = option(args, "--output");
  if (!taskId || !dataRoot)
    throw new Error(
      "usage: npm run reconcile-one-hop -- --task-id <id> --data-root <input-pack-root> [--output <json>]",
    );
  const result = reconcileOneHop(taskId, { dataRoot });
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (output) {
    const outputPath = isAbsolute(output) ? output : resolve(output);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, serialized, "utf8");
    process.stdout.write(
      `${JSON.stringify({ output: outputPath, taskId, counts: result.counts, nextScheduleTaskIds: result.nextScheduleTaskIds, nextDataTaskIds: result.nextDataTaskIds })}\n`,
    );
  } else process.stdout.write(serialized);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
)
  main();
