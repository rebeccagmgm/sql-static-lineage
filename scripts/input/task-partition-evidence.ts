import {
  extractSqlWrites,
  type SqlWrite,
} from "../reconcile/sql-write-evidence.ts";
import type {
  SqlSlot,
  TableEvidence,
  TaskPartitionAssignment,
  TaskPartitionEvidence,
  TaskPartitionEvidenceRef,
  TaskPartitionStatus,
  TaskPartitionTarget,
  TaskPartitionWrite,
  TaskCodeEvidence,
  TaskSchedulerEvidence,
} from "./input-pack.ts";

type SqlBySlot = Partial<Record<SqlSlot, string>>;

const DATABASE_SOURCE_TO_HIVE_CATEGORIES = new Set([
  "mysql2hive",
  "oracle2hive",
  "td2hive",
  "mongo2hive",
  "postgre2hive",
  "pg2hive",
  "postgres2hive",
  "sqlserver2hive",
  "oceanbase2hive",
  "dolphindb2hive",
]);

export function isDatabaseSourceToHiveTask(
  taskCategory: string | null | undefined,
): boolean {
  return DATABASE_SOURCE_TO_HIVE_CATEGORIES.has(
    taskCategory?.trim().toLowerCase() ?? "",
  );
}

export interface TaskPartitionBuildInput {
  readonly taskTarget?: string;
  readonly tables: readonly TableEvidence[];
  readonly sql: SqlBySlot;
  readonly schedulerEvidence?: TaskSchedulerEvidence;
  readonly codeEvidence?: TaskCodeEvidence;
  /**
   * Whether a target without an explicit SQL WRITE may bind its partition
   * fields to the trailing SELECT projection. Source-extraction tasks such
   * as oracle2hive provide source SQL here, not target-write SQL.
   */
  readonly allowImplicitQueryOutput?: boolean;
}

export interface SimpleTaskPartitionMapInput {
  readonly taskTarget?: string;
  readonly tables: readonly TableEvidence[];
  readonly sql: SqlBySlot;
  readonly schedulerEvidence?: TaskSchedulerEvidence;
  readonly allowImplicitQueryOutput?: boolean;
}

function normalize(value: string): string {
  return value.replaceAll("`", "").replaceAll('"', "").trim().toLowerCase();
}

function sameTable(left: string, right: string): boolean {
  return normalize(left) === normalize(right);
}

function sameTableName(left: string, right: string): boolean {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.split(".").at(-1) === normalizedRight.split(".").at(-1)
  );
}

function staticPartitionValue(expression: string): string | undefined {
  const value = literalValue(expression);
  return value === null || isRuntimeExpression(expression) ? undefined : value;
}

export function collectStaticPartitionValues(
  field: string,
  sql: string,
): ReadonlySet<string> {
  const content = stripSqlComments(sql);
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const identifier = `\\b${escapedField}\\b`;
  const valuePattern =
    "(?:'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\"|[-+]?\\d+(?:\\.\\d+)?)";
  const values = new Set<string>();
  const add = (expression: string): void => {
    const value = staticPartitionValue(expression.trim());
    if (value !== undefined) values.add(value);
  };
  const equalityPattern = new RegExp(
    `(?:[A-Za-z_][A-Za-z0-9_$]*\\.)?${identifier}\\s*=\\s*(${valuePattern})`,
    "giu",
  );
  for (const match of content.matchAll(equalityPattern)) {
    if (match[1] !== undefined) add(match[1]);
  }
  const inPattern = new RegExp(
    `(?:[A-Za-z_][A-Za-z0-9_$]*\\.)?${identifier}\\s+IN\\s*\\(([^)]*)\\)`,
    "giu",
  );
  for (const match of content.matchAll(inPattern)) {
    for (const item of splitTopLevelComma(match[1] ?? "")) add(item);
  }
  const quotedValuePattern = "(?:'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\")";
  const aliasPattern = new RegExp(
    `(${quotedValuePattern})\\s+AS\\s+${identifier}(?![A-Za-z0-9_$])`,
    "giu",
  );
  for (const match of content.matchAll(aliasPattern)) {
    if (match[1] !== undefined) add(match[1]);
  }
  return values;
}

/**
 * Emits only the target table's physical partition map. Source predicates,
 * such as a source table's BUSI_DATE, are intentionally outside this map.
 * A value is emitted only when every observed write context yields one unique
 * static value for the target partition field.
 */
export function buildSimpleTaskPartitionMap(
  input: SimpleTaskPartitionMapInput,
): Readonly<Record<string, string>> | undefined {
  const evidence = buildTaskPartitionEvidence(input);
  const targets = evidence.targets.filter(
    (target) =>
      input.taskTarget === undefined ||
      sameTable(target.target, input.taskTarget),
  );
  const result: Record<string, string> = {};
  for (const target of targets) {
    for (const write of target.writes) {
      for (const assignment of write.assignments) {
        const value = simplePartitionValue(assignment);
        if (value === undefined) continue;
        const previous = result[assignment.field];
        if (previous !== undefined && previous !== value) return undefined;
        result[assignment.field] = value;
      }
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function simplePartitionValue(
  assignment: TaskPartitionAssignment,
): string | undefined {
  if (assignment.status === "CONFIRMED" && assignment.value !== null)
    return assignment.value;
  if (
    assignment.status === "RUNTIME_EXPRESSION" &&
    assignment.expression !== null
  ) {
    const expression = assignment.expression.trim();
    const quoted = expression.match(/^(['"])(.*)\1$/s);
    return quoted?.[2] ?? expression;
  }
  return undefined;
}

function resolveWriteTarget(
  taskTarget: string | undefined,
  writeTarget: string,
): string {
  if (taskTarget === undefined || writeTarget.includes(".")) return writeTarget;
  const targetParts = normalize(taskTarget).split(".");
  return targetParts.at(-1) === normalize(writeTarget)
    ? taskTarget
    : writeTarget;
}

function splitTopLevelComma(value: string): string[] {
  const result: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (quote !== null) {
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
      result.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(value.slice(start).trim());
  return result.filter(Boolean);
}

function topLevelKeyword(value: string, keyword: string, start = 0): number {
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  const upperKeyword = keyword.toUpperCase();
  for (let index = start; index < value.length; index += 1) {
    const character = value[index]!;
    const next = value[index + 1];
    if (quote !== null) {
      if (character === quote && value[index - 1] !== "\\") {
        if (value[index + 1] === quote) index += 1;
        else quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "-" && next === "-") {
      index += 2;
      while (index < value.length && value[index] !== "\n") index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      index += 2;
      while (
        index + 1 < value.length &&
        !(value[index] === "*" && value[index + 1] === "/")
      )
        index += 1;
      index += 1;
      continue;
    }
    if (character === "(") {
      depth += 1;
      continue;
    }
    if (character === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (
      depth !== 0 ||
      value.slice(index, index + keyword.length).toUpperCase() !== upperKeyword
    )
      continue;
    const before = value[index - 1];
    const after = value[index + keyword.length];
    if (
      (before === undefined || !/[A-Za-z0-9_]/u.test(before)) &&
      (after === undefined || !/[A-Za-z0-9_]/u.test(after))
    )
      return index;
  }
  return -1;
}

function stripSqlComments(value: string): string {
  let result = "";
  let quote: "'" | '"' | "`" | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    const next = value[index + 1];
    if (quote !== null) {
      result += character;
      if (character === quote) {
        if (next === quote) {
          result += next;
          index += 1;
        } else if (value[index - 1] !== "\\") quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      result += character;
      continue;
    }
    if (character === "-" && next === "-") {
      index += 2;
      while (index < value.length && value[index] !== "\n") index += 1;
      if (index < value.length) result += "\n";
      continue;
    }
    if (character === "/" && next === "*") {
      index += 2;
      while (
        index + 1 < value.length &&
        !(value[index] === "*" && value[index + 1] === "/")
      )
        index += 1;
      index += 1;
      continue;
    }
    result += character;
  }
  return result;
}

type ProjectionBranch = {
  readonly sql: string;
  readonly items: readonly string[];
};

type ProjectionResult =
  | {
      readonly items: readonly string[];
      readonly branches: readonly ProjectionBranch[];
    }
  | { readonly reason: string };

function splitTopLevelUnion(value: string): string[] {
  const result: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    const next = value[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote !== null) {
      if (character === quote) {
        if (next === quote) index += 1;
        else if (value[index - 1] !== "\\") quote = null;
      }
      continue;
    }
    if (character === "-" && next === "-") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "(") {
      depth += 1;
      continue;
    }
    if (character === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (
      depth !== 0 ||
      value.slice(index, index + 5).toUpperCase() !== "UNION" ||
      (index > 0 && /[A-Za-z0-9_]/u.test(value[index - 1]!)) ||
      (index + 5 < value.length && /[A-Za-z0-9_]/u.test(value[index + 5]!))
    )
      continue;
    result.push(value.slice(start, index).trim());
    index += 5;
    while (index < value.length && /\s/u.test(value[index]!)) index += 1;
    const qualifier = value.slice(index, index + 8).toUpperCase();
    if (
      qualifier.startsWith("ALL") &&
      !/[A-Za-z0-9_]/u.test(value[index + 3] ?? "")
    )
      index += 3;
    else if (
      qualifier.startsWith("DISTINCT") &&
      !/[A-Za-z0-9_]/u.test(value[index + 8] ?? "")
    )
      index += 8;
    start = index;
    index -= 1;
  }
  result.push(value.slice(start).trim());
  return result.filter(Boolean);
}

function projectionItemsFromStatement(
  statement: string,
): { readonly items: readonly string[] } | { readonly reason: string } {
  const selectAt = topLevelKeyword(statement, "SELECT");
  if (selectAt < 0) return { reason: "DYNAMIC_PARTITION_SELECT_NOT_FOUND" };
  const fromAt = topLevelKeyword(statement, "FROM", selectAt + 6);
  const projection = stripSqlComments(
    statement.slice(selectAt + 6, fromAt >= 0 ? fromAt : undefined),
  ).trim();
  if (projection === "") return { reason: "DYNAMIC_PARTITION_OUTPUT_EMPTY" };
  const items = splitTopLevelComma(projection);
  if (items.some((item) => item === "*" || /\.\s*\*$/u.test(item)))
    return { reason: "DYNAMIC_PARTITION_WILDCARD_OUTPUT" };
  return { items };
}

function projectionItems(sql: string, write: SqlWrite): ProjectionResult {
  const statement = sql.slice(
    write.statementSpan.start,
    write.statementSpan.end,
  );
  const branches: ProjectionBranch[] = [];
  for (const branchSql of splitTopLevelUnion(statement)) {
    const projection = projectionItemsFromStatement(branchSql);
    if ("reason" in projection) return projection;
    branches.push({ sql: branchSql, items: projection.items });
  }
  return {
    items: branches[0]?.items ?? [],
    branches,
  };
}

function expressionAndAlias(item: string): {
  readonly expression: string;
  readonly alias?: string;
} {
  const asMatch = item.match(
    /^(.*?)[ \t]+AS[ \t]+[`"]?([A-Za-z_][A-Za-z0-9_]*)[`"]?$/iu,
  );
  if (asMatch)
    return { expression: asMatch[1]!.trim(), alias: asMatch[2]!.toLowerCase() };
  const bareMatch = item.match(
    /^(.*?)[ \t]+[`"]?([A-Za-z_][A-Za-z0-9_]*)[`"]?$/u,
  );
  if (bareMatch) {
    const expression = bareMatch[1]!.trim();
    if (!/[+\-*/%<>=|&^~,]$/u.test(expression))
      return { expression, alias: bareMatch[2]!.toLowerCase() };
  }
  return { expression: item.trim() };
}

function literalValue(expression: string): string | null {
  const trimmed = expression.trim();
  const quoted =
    trimmed.match(/^'(.*)'$/s)?.[1] ?? trimmed.match(/^"(.*)"$/s)?.[1];
  if (quoted !== undefined) return quoted;
  return /^(?:[-+]?\d+(?:\.\d+)?|true|false|null)$/iu.test(trimmed)
    ? trimmed
    : null;
}

function sqlRef(slot: SqlSlot, write: SqlWrite): TaskPartitionEvidenceRef {
  return {
    source: "INPUT_PACK_SQL",
    locator: `sql/${slot}.sql#char=${write.statementSpan.start}-${write.statementSpan.end}`,
    detail: `statementOrdinal=${write.statementOrdinal}`,
  };
}

function tableRef(table: TableEvidence): TaskPartitionEvidenceRef {
  return {
    source: "TABLE_PACK",
    locator: `table-pack:${table.platform}/${table.qualifiedName}@@${table.dataSource}`,
    detail: `partitionFields=${(table.partitionFields ?? []).join(",")};logical locator;path is resolved by Input Pack table identity`,
  };
}

function schedulerRefs(
  schedulerEvidence?: TaskSchedulerEvidence,
): TaskPartitionEvidenceRef[] {
  return schedulerEvidence === undefined
    ? []
    : [{ source: "SCHEDULER_CONFIG", locator: "task-source.hivePartition" }];
}

function codeRefs(codeEvidence?: TaskCodeEvidence): TaskPartitionEvidenceRef[] {
  return codeEvidence?.scriptParams === undefined
    ? []
    : [{ source: "CODE_EVIDENCE", locator: "task.codeEvidence.scriptParams" }];
}

function explicitFieldValues(
  value: string | undefined,
): ReadonlyMap<string, string> {
  if (value === undefined) return new Map();
  const result = new Map<string, string>();
  const pattern =
    /(?:^|[,;\s])([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:'([^']*)'|"([^"]*)"|([^,;\s]+))/gu;
  for (const match of value.matchAll(pattern)) {
    const field = match[1]?.toLowerCase();
    const raw = match[2] ?? match[3] ?? match[4];
    if (field !== undefined && raw !== undefined) result.set(field, raw);
  }
  return result;
}

function unknownAssignment(
  field: string,
  evidence: readonly TaskPartitionEvidenceRef[],
  reason: string,
  status: "UNKNOWN" | "CONFLICT" = "UNKNOWN",
): TaskPartitionAssignment {
  return {
    field,
    expression: null,
    value: null,
    status,
    mappingMethod: status === "CONFLICT" ? "CONFLICT" : "UNKNOWN",
    evidence,
    reason,
  };
}

function assignmentFromExpression(
  field: string,
  expression: string,
  mappingMethod: TaskPartitionAssignment["mappingMethod"],
  evidence: readonly TaskPartitionEvidenceRef[],
): TaskPartitionAssignment {
  const value = literalValue(expression);
  const runtime = isRuntimeExpression(expression);
  return {
    field,
    expression,
    value: runtime ? null : value,
    status: runtime || value === null ? "RUNTIME_EXPRESSION" : "CONFIRMED",
    mappingMethod,
    evidence,
  };
}

function assignmentFromExplicitConfig(
  field: string,
  value: string,
  mappingMethod: "SCHEDULER_EXPLICIT_FIELD_VALUE",
  evidence: readonly TaskPartitionEvidenceRef[],
): TaskPartitionAssignment {
  const runtime = /\$\{|\{\{|\{%|<%/u.test(value);
  return {
    field,
    expression: value,
    value: runtime ? null : value,
    status: runtime ? "RUNTIME_EXPRESSION" : "CONFIRMED",
    mappingMethod,
    evidence,
  };
}

function isRuntimeExpression(value: string): boolean {
  return /\$\{|\{\{|\{%|<%/u.test(value);
}

function dynamicAssignments(
  fieldNames: readonly string[],
  sql: string,
  write: SqlWrite,
  evidence: readonly TaskPartitionEvidenceRef[],
): {
  readonly assignments: readonly TaskPartitionAssignment[];
  readonly reason: string | undefined;
} {
  const projection = projectionItems(sql, write);
  if ("reason" in projection)
    return {
      assignments: fieldNames.map((field) =>
        unknownAssignment(field, evidence, projection.reason),
      ),
      reason: projection.reason,
    };
  if (projection.items.length < fieldNames.length)
    return {
      assignments: fieldNames.map((field) =>
        unknownAssignment(
          field,
          evidence,
          "DYNAMIC_PARTITION_OUTPUT_TOO_SHORT",
        ),
      ),
      reason: "DYNAMIC_PARTITION_OUTPUT_TOO_SHORT",
    };
  const start = projection.items.length - fieldNames.length;
  const assignments: TaskPartitionAssignment[] = [];
  let aliasMismatch = false;
  fieldNames.forEach((field, index) => {
    const parsed = expressionAndAlias(projection.items[start + index]!);
    if (parsed.alias !== undefined && parsed.alias !== field.toLowerCase()) {
      aliasMismatch = true;
      assignments.push(
        assignmentFromExpression(
          field,
          parsed.expression,
          "DYNAMIC_PARTITION_OUTPUT_ORDINAL",
          [
            ...evidence,
            {
              source: "INPUT_PACK_SQL",
              locator: "dynamic-output-ordinal",
              detail: `alias=${parsed.alias};alias is not used as the binding key`,
            },
          ],
        ),
      );
      return;
    }
    assignments.push(
      assignmentFromExpression(
        field,
        parsed.expression,
        "DYNAMIC_PARTITION_OUTPUT_ORDINAL",
        evidence,
      ),
    );
  });
  return {
    assignments,
    reason: aliasMismatch ? "DYNAMIC_PARTITION_ALIAS_NOT_USED" : undefined,
  };
}

function partitionFieldsFromCreateSql(sql: string | undefined): string[] {
  if (sql === undefined) return [];
  const match = sql.match(/\bPARTITIONED\s+BY\s*\(([^)]*)\)/iu);
  if (!match) return [];
  return splitTopLevelComma(match[1]!)
    .map((definition) =>
      definition
        .match(/^[`"]?([A-Za-z_][A-Za-z0-9_$]*)[`"]?/u)?.[1]
        ?.toLowerCase(),
    )
    .filter((field): field is string => field !== undefined);
}

function partitionFieldsFor(
  table: TableEvidence | undefined,
  createSql: string | undefined,
): {
  readonly fields: readonly string[];
  readonly usedCreateFallback: boolean;
} {
  if (Array.isArray(table?.partitionFields))
    return { fields: table.partitionFields, usedCreateFallback: false };
  const fields = partitionFieldsFromCreateSql(createSql);
  return { fields, usedCreateFallback: fields.length > 0 };
}

function resolveOutputReference(
  expression: string,
  field: string,
  sql: string,
): { readonly expression: string | undefined; readonly reason?: string } {
  const reference = expression.match(
    /^(?:[`"]?[A-Za-z_][A-Za-z0-9_$]*[`"]?\.)?[`"]?([A-Za-z_][A-Za-z0-9_$]*)[`"]?$/u,
  );
  if (reference?.[1]?.toLowerCase() !== field.toLowerCase())
    return { expression };
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const valuePattern =
    "(?:'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\"|\\$\\{[^}]+\\}|[-+]?\\d+(?:\\.\\d+)?)";
  const identifierQuote = "[" + String.fromCharCode(34, 96) + "]?";
  const matches = [
    ...sql.matchAll(
      new RegExp(
        `(${valuePattern})\\s+(?:AS\\s+)?${identifierQuote}${escapedField}${identifierQuote}(?![A-Za-z0-9_$])`,
        "giu",
      ),
    ),
  ];
  if (matches.length === 1) return { expression: matches[0]![1] };
  return {
    expression: undefined,
    reason:
      matches.length === 0
        ? "DYNAMIC_PARTITION_OUTPUT_REFERENCE_UNRESOLVED"
        : "DYNAMIC_PARTITION_OUTPUT_REFERENCE_NOT_UNIQUE",
  };
}

function directQueryProjection(
  fields: readonly string[],
  sql: string,
  evidence: readonly TaskPartitionEvidenceRef[],
): {
  readonly assignments: readonly TaskPartitionAssignment[];
  readonly reason?: string;
} {
  const projection = projectionItems(sql, {
    qualifiedName: "__implicit_task_target__",
    writeKind: "INSERT_INTO",
    statementSpan: { start: 0, end: sql.length },
    statementOrdinal: 1,
    partitionMode: "DYNAMIC",
    partitionFields: [...fields],
    partition: [],
  });
  if ("reason" in projection)
    return {
      assignments: fields.map((field) =>
        unknownAssignment(field, evidence, projection.reason),
      ),
      reason: projection.reason,
    };
  if (projection.items.length < fields.length)
    return {
      assignments: fields.map((field) =>
        unknownAssignment(
          field,
          evidence,
          "DYNAMIC_PARTITION_OUTPUT_TOO_SHORT",
        ),
      ),
      reason: "DYNAMIC_PARTITION_OUTPUT_TOO_SHORT",
    };

  const start = projection.items.length - fields.length;
  const assignments = fields.map((field, index) => {
    const parsed = expressionAndAlias(projection.items[start + index]!);
    const resolved = resolveOutputReference(parsed.expression, field, sql);
    if (resolved.expression === undefined)
      return unknownAssignment(
        field,
        evidence,
        resolved.reason ?? "DYNAMIC_PARTITION_OUTPUT_REFERENCE_UNRESOLVED",
      );
    return assignmentFromExpression(
      field,
      resolved.expression,
      "DYNAMIC_PARTITION_OUTPUT_ORDINAL",
      [
        ...evidence,
        {
          source: "INPUT_PACK_SQL",
          locator: "sql/query.sql#implicit-target-output",
          detail: `ordinal=${start + index + 1};alias=${parsed.alias ?? "-"}`,
        },
      ],
    );
  });
  return {
    assignments,
    reason: assignments.find((item) => item.status === "UNKNOWN")?.reason,
  };
}

function addPartitionFromSql(
  fields: readonly string[],
  target: string,
  sql: Partial<Record<SqlSlot, string>>,
):
  | {
      readonly assignments: readonly TaskPartitionAssignment[];
      readonly sqlSlot: SqlSlot;
      readonly evidence: readonly TaskPartitionEvidenceRef[];
    }
  | undefined {
  for (const [rawSlot, content] of Object.entries(sql)) {
    if (content === undefined) continue;
    const slot = rawSlot as SqlSlot;
    const pattern =
      /\bALTER\s+TABLE\s+[`"]?([^\s(`"]+)[`"]?\s+ADD\s+(?:IF\s+NOT\s+EXISTS\s+)?PARTITION\s*\(([^)]*)\)/giu;
    for (const match of content.matchAll(pattern)) {
      if (!sameTable(match[1]!, target)) continue;
      const clause = new Map<string, string>();
      for (const item of splitTopLevelComma(match[2]!)) {
        const equals = item.indexOf("=");
        if (equals < 0) continue;
        const field = item
          .slice(0, equals)
          .trim()
          .replaceAll("`", "")
          .replaceAll('"', "")
          .toLowerCase();
        clause.set(field, item.slice(equals + 1).trim());
      }
      const evidence: TaskPartitionEvidenceRef[] = [
        {
          source: "INPUT_PACK_SQL",
          locator: `sql/${slot}.sql#ALTER-ADD-PARTITION`,
          detail: `target=${target};partition maintenance scope`,
        },
      ];
      return {
        sqlSlot: slot,
        evidence,
        assignments: fields.map((field) => {
          const expression = clause.get(field.toLowerCase());
          return expression === undefined
            ? unknownAssignment(
                field,
                evidence,
                "ADD_PARTITION_FIELD_NOT_PRESENT",
              )
            : assignmentFromExpression(
                field,
                expression,
                "STATIC_SQL_ASSIGNMENT",
                evidence,
              );
        }),
      };
    }
  }
  return undefined;
}

function buildSqlWrite(
  table: TableEvidence | undefined,
  target: string,
  sqlSlot: SqlSlot,
  sql: string,
  write: SqlWrite,
  createSql: string | undefined,
  schedulerEvidence?: TaskSchedulerEvidence,
  codeEvidence?: TaskCodeEvidence,
): TaskPartitionWrite {
  const partitionFields = partitionFieldsFor(table, createSql);
  const tableFields = partitionFields.fields;
  const mappingEvidence = [
    ...(table === undefined ? [] : [tableRef(table)]),
    sqlRef(sqlSlot, write),
    ...(partitionFields.usedCreateFallback
      ? [
          {
            source: "INPUT_PACK_SQL" as const,
            locator: "sql/create.sql#PARTITIONED-BY",
            detail:
              "fallback partition-field discovery; existing table metadata did not provide partitionFields",
          },
        ]
      : []),
  ];
  const writeEvidence = [
    ...mappingEvidence,
    ...schedulerRefs(schedulerEvidence),
    ...codeRefs(codeEvidence),
  ];
  if (table === undefined)
    return {
      target,
      sqlSlot,
      statementOrdinal: write.statementOrdinal,
      mode: write.partitionMode,
      status: "UNKNOWN",
      assignments: [],
      evidence: writeEvidence,
      reasonCodes: ["TABLE_PACK_PARTITION_FIELDS_UNAVAILABLE"],
    };
  if (tableFields.length === 0)
    return {
      target,
      sqlSlot,
      statementOrdinal: write.statementOrdinal,
      mode: "NONE",
      status: "NOT_PARTITIONED",
      assignments: [],
      evidence: writeEvidence,
      reasonCodes: ["TABLE_NOT_PARTITIONED"],
    };
  const staticAssignments = new Map(
    write.partition
      .filter((item) => item.expression !== "UNKNOWN")
      .map((item) => [item.field.toLowerCase(), item]),
  );
  const dynamicFields = write.partitionFields.filter(
    (field) => !staticAssignments.has(field.toLowerCase()),
  );
  let dynamic: {
    readonly assignments: readonly TaskPartitionAssignment[];
    readonly reason: string | undefined;
  } = { assignments: [], reason: undefined };
  if (dynamicFields.length > 0)
    dynamic = dynamicAssignments(dynamicFields, sql, write, mappingEvidence);
  const schedulerValues = explicitFieldValues(schedulerEvidence?.hivePartition);
  const assignments = tableFields.map((field) => {
    const key = field.toLowerCase();
    const staticAssignment = staticAssignments.get(key);
    const dynamicAssignment = dynamic.assignments.find(
      (item) => item.field.toLowerCase() === key,
    );
    const assignment =
      staticAssignment !== undefined
        ? assignmentFromExpression(
            field,
            staticAssignment.expression,
            "STATIC_SQL_ASSIGNMENT",
            mappingEvidence,
          )
        : (dynamicAssignment ??
          unknownAssignment(
            field,
            mappingEvidence,
            "PARTITION_FIELD_NOT_PRESENT_IN_WRITE",
          ));
    const schedulerValue = schedulerValues.get(key);
    if (
      assignment.status === "CONFIRMED" &&
      assignment.value !== null &&
      schedulerValue !== undefined &&
      !isRuntimeExpression(schedulerValue) &&
      assignment.value !== schedulerValue
    )
      return {
        ...assignment,
        value: null,
        status: "CONFLICT" as const,
        mappingMethod: "CONFLICT" as const,
        evidence: [...mappingEvidence, ...schedulerRefs(schedulerEvidence)],
        reason: `SQL_SCHEDULER_PARTITION_CONFLICT:sql=${assignment.value};scheduler=${schedulerValue}`,
      };
    return assignment;
  });
  const statuses = assignments.map((item) => item.status);
  const status: TaskPartitionStatus = statuses.includes("CONFLICT")
    ? "CONFLICT"
    : statuses.includes("UNKNOWN")
      ? "INCOMPLETE"
      : "COMPLETE";
  const reasonCodes =
    status === "CONFLICT"
      ? ["SQL_SCHEDULER_PARTITION_CONFLICT"]
      : [
          ...(dynamic.reason === undefined ? [] : [dynamic.reason]),
          status === "COMPLETE"
            ? "PARTITION_EVIDENCE_COMPLETE"
            : (dynamic.reason ?? "PARTITION_FIELD_VALUE_NOT_PROVABLE"),
        ];
  return {
    target,
    sqlSlot,
    statementOrdinal: write.statementOrdinal,
    mode: write.partitionMode,
    status,
    assignments,
    evidence: writeEvidence,
    reasonCodes: [...new Set(reasonCodes)],
  };
}

function buildDirectWrite(
  table: TableEvidence | undefined,
  target: string,
  querySql: string | undefined,
  createSql: string | undefined,
  addPartition:
    | {
        readonly assignments: readonly TaskPartitionAssignment[];
        readonly sqlSlot: SqlSlot;
        readonly evidence: readonly TaskPartitionEvidenceRef[];
      }
    | undefined,
  schedulerEvidence?: TaskSchedulerEvidence,
  codeEvidence?: TaskCodeEvidence,
  allowImplicitQueryOutput = true,
): TaskPartitionWrite {
  const partitionFields = partitionFieldsFor(table, createSql);
  const evidence: TaskPartitionEvidenceRef[] = [
    ...(table === undefined ? [] : [tableRef(table)]),
    ...(partitionFields.usedCreateFallback
      ? [
          {
            source: "INPUT_PACK_SQL" as const,
            locator: "sql/create.sql#PARTITIONED-BY",
            detail:
              "fallback partition-field discovery; existing table metadata did not provide partitionFields",
          },
        ]
      : []),
    ...schedulerRefs(schedulerEvidence),
    ...codeRefs(codeEvidence),
  ];
  if (partitionFields.fields.length === 0 && table !== undefined)
    return {
      target,
      sqlSlot: null,
      statementOrdinal: null,
      mode: "NONE",
      status: "NOT_PARTITIONED",
      assignments: [],
      evidence:
        evidence.length > 0
          ? evidence
          : [{ source: "SCHEDULER_CONFIG", locator: "task.target" }],
      reasonCodes: ["TABLE_NOT_PARTITIONED"],
    };
  const fields = partitionFields.fields;
  const writeEvidence: TaskPartitionEvidenceRef[] =
    evidence.length > 0
      ? evidence
      : [{ source: "SCHEDULER_CONFIG", locator: "task.target" }];
  const schedulerAssignmentEvidence = [
    ...(table === undefined ? [] : [tableRef(table)]),
    ...schedulerRefs(schedulerEvidence),
  ];
  const queryEvidence =
    querySql === undefined || !allowImplicitQueryOutput
      ? []
      : [
          {
            source: "INPUT_PACK_SQL" as const,
            locator: "sql/query.sql#implicit-target-output",
            detail:
              "fallback partition binding for a task with no explicit INSERT target",
          },
        ];
  const queryAssignments =
    querySql === undefined || !allowImplicitQueryOutput
      ? undefined
      : directQueryProjection(fields, querySql, [
          ...writeEvidence,
          ...queryEvidence,
        ]);
  const addEvidence = addPartition?.evidence ?? [];
  const unknownAssignmentEvidence = [
    ...(table === undefined ? [] : [tableRef(table)]),
    ...schedulerRefs(schedulerEvidence),
    ...codeRefs(codeEvidence),
    ...queryEvidence,
  ];
  const schedulerValues = explicitFieldValues(schedulerEvidence?.hivePartition);
  const assignments = fields.map((field) => {
    const key = field.toLowerCase();
    const schedulerValue = schedulerValues.get(key);
    const queryAssignment = queryAssignments?.assignments.find(
      (item) => item.field.toLowerCase() === key,
    );
    const addAssignment = addPartition?.assignments.find(
      (item) => item.field.toLowerCase() === key,
    );
    if (schedulerValue !== undefined) {
      const schedulerAssignment = assignmentFromExplicitConfig(
        field,
        schedulerValue,
        "SCHEDULER_EXPLICIT_FIELD_VALUE",
        schedulerAssignmentEvidence,
      );
      if (
        queryAssignment?.status === "CONFIRMED" &&
        schedulerAssignment.status === "CONFIRMED" &&
        queryAssignment.value !== schedulerAssignment.value
      )
        return {
          ...unknownAssignment(
            field,
            [...schedulerAssignment.evidence, ...queryAssignment.evidence],
            "SQL_SCHEDULER_PARTITION_CONFLICT",
            "CONFLICT",
          ),
          mappingMethod: "CONFLICT" as const,
        };
      return schedulerAssignment;
    }
    if (addAssignment !== undefined && addAssignment.status !== "UNKNOWN")
      return addAssignment;
    if (queryAssignment !== undefined && queryAssignment.status !== "UNKNOWN")
      return queryAssignment;
    return unknownAssignment(
      field,
      unknownAssignmentEvidence.length > 0
        ? unknownAssignmentEvidence
        : writeEvidence,
      queryAssignments?.reason ??
        (!allowImplicitQueryOutput
          ? "SOURCE_SQL_NOT_TARGET_WRITE"
          : codeEvidence?.scriptParams === undefined
            ? "EXPLICIT_PARTITION_VALUE_NOT_FOUND"
            : "SCRIPT_PARAMS_NOT_PARTITION_MAPPING"),
    );
  });
  const status: TaskPartitionStatus = assignments.some(
    (item) => item.status === "CONFLICT",
  )
    ? "CONFLICT"
    : assignments.some((item) => item.status === "UNKNOWN")
      ? "INCOMPLETE"
      : "COMPLETE";
  return {
    target,
    sqlSlot:
      addPartition?.sqlSlot ??
      (querySql !== undefined && allowImplicitQueryOutput ? "query" : null),
    statementOrdinal: null,
    mode:
      addPartition !== undefined
        ? "STATIC"
        : querySql !== undefined && allowImplicitQueryOutput
          ? "DYNAMIC"
          : "UNKNOWN",
    status,
    assignments,
    evidence: [...writeEvidence, ...queryEvidence, ...addEvidence],
    reasonCodes: [
      ...(status === "CONFLICT" ? ["SQL_SCHEDULER_PARTITION_CONFLICT"] : []),
      ...(status === "COMPLETE"
        ? ["PARTITION_EVIDENCE_COMPLETE"]
        : [
            queryAssignments?.reason ??
              (!allowImplicitQueryOutput
                ? "SOURCE_SQL_NOT_TARGET_WRITE"
                : "EXPLICIT_PARTITION_VALUE_NOT_FOUND"),
          ]),
    ],
  };
}

function targetStatus(
  table: TableEvidence | undefined,
  partitionFields: readonly string[],
  writes: readonly TaskPartitionWrite[],
): {
  readonly status: TaskPartitionStatus;
  readonly reasonCodes: readonly string[];
} {
  if (table === undefined && partitionFields.length === 0)
    return {
      status: "UNKNOWN",
      reasonCodes: ["TABLE_PACK_PARTITION_FIELDS_UNAVAILABLE"],
    };
  if (partitionFields.length === 0)
    return {
      status: "NOT_PARTITIONED",
      reasonCodes: ["TABLE_NOT_PARTITIONED"],
    };
  if (writes.length === 0)
    return {
      status: "UNKNOWN",
      reasonCodes: ["SQL_WRITE_EVIDENCE_UNAVAILABLE"],
    };
  if (writes.some((write) => write.status === "CONFLICT"))
    return { status: "CONFLICT", reasonCodes: ["PARTITION_WRITE_CONFLICT"] };
  if (
    writes.some(
      (write) => write.status === "INCOMPLETE" || write.status === "UNKNOWN",
    )
  )
    return {
      status: "INCOMPLETE",
      reasonCodes: ["PARTITION_WRITE_VALUE_INCOMPLETE"],
    };
  return { status: "COMPLETE", reasonCodes: ["PARTITION_EVIDENCE_COMPLETE"] };
}

export function buildTaskPartitionEvidence(
  input: TaskPartitionBuildInput,
): TaskPartitionEvidence {
  const sqlWrites = Object.entries(input.sql).flatMap(([slot, content]) =>
    content === undefined
      ? []
      : extractSqlWrites(content).map((write) => ({
          slot: slot as SqlSlot,
          content,
          write,
          target: resolveWriteTarget(input.taskTarget, write.qualifiedName),
        })),
  );
  const targetNames = [
    ...(input.taskTarget === undefined ? [] : [input.taskTarget]),
    ...sqlWrites.map((item) => item.target),
  ].filter(
    (value, index, values) =>
      values.findIndex((candidate) => sameTable(candidate, value)) === index,
  );
  const targets: TaskPartitionTarget[] = targetNames.map((target) => {
    const table = input.tables.find((candidate) =>
      sameTable(candidate.qualifiedName, target),
    );
    const createSql = input.sql.create;
    const partitionFields = partitionFieldsFor(table, createSql).fields;
    const addPartition = addPartitionFromSql(
      partitionFields,
      target,
      input.sql,
    );
    const writes = sqlWrites
      .filter((item) => sameTable(item.target, target))
      .map((item) =>
        buildSqlWrite(
          table,
          target,
          item.slot,
          item.content,
          item.write,
          createSql,
          input.schedulerEvidence,
          input.codeEvidence,
        ),
      );
    const effectiveWrites =
      writes.length > 0
        ? writes
        : input.taskTarget !== undefined && sameTable(input.taskTarget, target)
          ? [
              buildDirectWrite(
                table,
                target,
                input.sql.query,
                createSql,
                addPartition,
                input.schedulerEvidence,
                input.codeEvidence,
                input.allowImplicitQueryOutput,
              ),
            ]
          : [];
    const state = targetStatus(table, partitionFields, effectiveWrites);
    return {
      target,
      tableStatus:
        table === undefined
          ? partitionFields.length > 0
            ? "PARTITIONED"
            : "UNKNOWN"
          : partitionFields.length === 0
            ? "NOT_PARTITIONED"
            : "PARTITIONED",
      fields: partitionFields,
      status: state.status,
      writes: effectiveWrites,
      reasonCodes: state.reasonCodes,
    };
  });
  const statuses = targets.map((target) => target.status);
  const status: TaskPartitionStatus =
    targets.length === 0
      ? "UNKNOWN"
      : statuses.every((item) => item === "NOT_PARTITIONED")
        ? "NOT_PARTITIONED"
        : statuses.includes("CONFLICT")
          ? "CONFLICT"
          : statuses.includes("UNKNOWN")
            ? "UNKNOWN"
            : statuses.includes("INCOMPLETE")
              ? "INCOMPLETE"
              : "COMPLETE";
  const reasonCodes = [
    ...new Set(targets.flatMap((target) => target.reasonCodes)),
  ];
  return {
    status,
    targets,
    reasonCodes:
      reasonCodes.length > 0 ? reasonCodes : ["PARTITION_EVIDENCE_COMPLETE"],
  };
}
