import { canonicalJson, sha256 } from "../../../machine-facts/machine-facts-contract.ts";

type JsonRecord = Readonly<Record<string, unknown>>;

export const IMPACT_CHANNELS = [
  "FIELD_VALUE",
  "EXPRESSION_CONTROL",
  "ROW_MEMBERSHIP",
  "MULTIPLICITY",
  "GROUPING",
  "SET_MEMBERSHIP",
  "ORDER_SELECTION",
  "WINDOW_EFFECT",
  "RELATION_EXISTENCE",
] as const;
export type ImpactChannel = (typeof IMPACT_CHANNELS)[number];

export interface ReadImpact {
  readonly readOccurrenceId: string;
  readonly impactChannels: readonly ImpactChannel[];
  readonly evidenceRefs: readonly string[];
  readonly gaps: readonly string[];
}

export interface TaskRelationSummary {
  readonly taskId: string;
  readonly statementIndex: number;
  readonly rootRelationId: string | null;
  readonly digest: string;
  readonly complete: boolean;
  readonly readImpacts: readonly ReadImpact[];
  readonly relationCount: number;
  readonly readCount: number;
  readonly edgeCount: number;
  readonly gaps: readonly string[];
}

function record(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function records(value: unknown): readonly JsonRecord[] {
  return Array.isArray(value)
    ? value.map(record)
    : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

export function relationSummaryKey(taskId: string, statementIndex: number): string {
  return `${taskId}|statement:${statementIndex}`;
}

export function summaryForOccurrence(
  summaries: ReadonlyMap<string, TaskRelationSummary>,
  taskId: string | null,
  statementIndex: number | null,
): TaskRelationSummary | undefined {
  if (!taskId || statementIndex === null) return undefined;
  const summary = summaries.get(relationSummaryKey(taskId, statementIndex));
  if (summary?.taskId === taskId && summary.statementIndex === statementIndex) return summary;
  return undefined;
}

function statementIndexFromId(value: string | null): number | null {
  if (!value) return null;
  const statement = value.match(/(?:^|:)statement:(\d+)(?::|$)/i);
  if (statement) return Number(statement[1]);
  const query = value.match(/^query#(\d+)(?::|$)/i);
  return query ? Number(query[1]) : null;
}

function sorted(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function relationOf(row: JsonRecord): JsonRecord {
  return record(row.relation);
}

function relationId(row: JsonRecord): string | null {
  return text(row.relation_id) ?? text(relationOf(row).id);
}

function relationType(row: JsonRecord): string | null {
  return (text(row.relation_type) ?? text(relationOf(row).type))?.toLowerCase() ?? null;
}

function readOccurrenceId(row: JsonRecord): string | null {
  const relation = relationOf(row);
  return text(relation.read_occurrence_id) ?? text(relation.id) ?? relationId(row);
}

function childRelationIds(row: JsonRecord): readonly string[] {
  const relation = relationOf(row);
  const direct = [relation.source, relation.input, relation.left, relation.right]
    .map(text)
    .filter((value): value is string => value !== null);
  const branches = Array.isArray(relation.branches)
    ? relation.branches.filter((value): value is string => typeof value === "string")
    : [];
  return sorted([...direct, ...branches]);
}

function sourceRelationIds(
  row: JsonRecord,
  incoming: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
  const id = relationId(row);
  if (!id) return [];
  const direct = childRelationIds(row);
  const linked = incoming.get(id) ?? [];
  return sorted([...direct, ...linked]);
}

function normalizedTable(value: string): string {
  return value.replaceAll("`", "").replaceAll('"', "").trim().toLowerCase();
}

function tableMatches(left: string, right: string): boolean {
  const a = normalizedTable(left);
  const b = normalizedTable(right);
  return a === b || a.split(".").at(-1) === b.split(".").at(-1);
}

function physicalColumnTables(row: JsonRecord): readonly string[] {
  const relation = relationOf(row);
  const columns = [...records(relation.predicate_columns), ...records(relation.condition_columns)];
  return sorted(columns.flatMap((column) => records(column.physical).map((item) => text(item.table)).filter((value): value is string => value !== null)));
}

function exprText(row: JsonRecord): string {
  const relation = relationOf(row);
  return [
    text(relation.predicate_expr),
    text(relation.condition_expr),
    text(relation.expression),
    text(relation.predicate_display),
    text(relation.condition_display),
    text(row.source_text),
  ].filter((value): value is string => value !== null).join(" ");
}

function hasFunction(row: JsonRecord, names: readonly string[]): boolean {
  const relation = relationOf(row);
  const facts = record(relation.predicate_facts);
  const functionNames = records(facts.functions)
    .map((item) => text(item.name) ?? text(item.function) ?? text(item.text))
    .filter((value): value is string => value !== null)
    .join(" ");
  const haystack = `${exprText(row)} ${functionNames}`.toUpperCase();
  return names.some((name) => new RegExp(`\\b${name}\\s*\\(`, "i").test(haystack));
}

function impactChannels(row: JsonRecord): readonly ImpactChannel[] {
  const type = relationType(row);
  const relation = relationOf(row);
  const expression = exprText(row);
  switch (type) {
    case "filter":
      return ["ROW_MEMBERSHIP", "RELATION_EXISTENCE"];
    case "join": {
      const joinType = (text(relation.join_type) ?? "INNER").toUpperCase();
      const result: ImpactChannel[] = ["ROW_MEMBERSHIP", "MULTIPLICITY", "RELATION_EXISTENCE"];
      if (joinType.includes("CROSS")) return result;
      return result;
    }
    case "aggregate":
      return hasFunction(row, ["COUNT", "SUM", "AVG", "MIN", "MAX", "COLLECT", "ARRAY_AGG"])
        ? ["GROUPING", "MULTIPLICITY", "RELATION_EXISTENCE", "FIELD_VALUE"]
        : ["GROUPING", "RELATION_EXISTENCE"];
    case "setop":
      return ["SET_MEMBERSHIP", "RELATION_EXISTENCE"];
    case "project":
      if (/\b(?:CASE|IF|COALESCE|NVL|DECODE)\b/i.test(expression)) return ["EXPRESSION_CONTROL"];
      if (/\b(?:COUNT\s*\(\s*\*|EXISTS)\b/i.test(expression)) return ["RELATION_EXISTENCE"];
      if (/^\s*(?:[-+]?\d+(?:\.\d+)?|'[^']*'|"[^"]*"|NULL)(?:\s+AS?\s+[A-Za-z_][A-Za-z0-9_]*)?\s*$/i.test(expression)) return ["RELATION_EXISTENCE"];
      return [];
    case "window":
      return ["WINDOW_EFFECT"];
    case "top_n":
      return ["ORDER_SELECTION", "ROW_MEMBERSHIP"];
    case "qualify":
    case "having":
      return ["ROW_MEMBERSHIP", "RELATION_EXISTENCE"];
    case "read":
      return [];
    default:
      return type === null ? [] : ["RELATION_EXISTENCE"];
  }
}

function hasUnsupportedShape(row: JsonRecord): boolean {
  const type = relationType(row);
  const relation = relationOf(row);
  return type === "other" || type === "expand" || Boolean(relation.unsupported) || Boolean(relation.dynamic);
}

/** Normalize relation facts once per task; it never parses raw SQL. */
export function summarizeTaskRelations(input: {
  readonly taskId: string;
  readonly relationRecords: readonly JsonRecord[];
  readonly relationEdgeRecords?: readonly JsonRecord[];
  readonly statementRecords?: readonly JsonRecord[];
  readonly statementIndex?: number;
}): TaskRelationSummary {
  const statementIndexes = new Map<string, number>();
  for (const statement of input.statementRecords ?? []) {
    const id = text(statement.statement_id);
    const index = integer(statement.statement_index) ?? statementIndexFromId(id);
    if (id && index !== null) statementIndexes.set(id, index);
  }
  const rowStatementIndex = (row: JsonRecord): number | null => {
    const relation = relationOf(row);
    const explicit = integer(row.statement_index) ?? integer(relation.statement_index);
    if (explicit !== null) return explicit;
    const ids = [
      text(row.statement_id),
      text(relation.statement_id),
      relationId(row),
      readOccurrenceId(row),
    ].filter((value): value is string => value !== null);
    for (const id of ids) {
      const fromRecord = statementIndexes.get(id);
      if (fromRecord !== undefined) return fromRecord;
      const fromId = statementIndexFromId(id);
      if (fromId !== null) return fromId;
    }
    return null;
  };
  const requestedStatementIndex = input.statementIndex ?? null;
  const rows = input.relationRecords.filter((row) => {
    if (text(row.task_id) !== null && text(row.task_id) !== input.taskId) return false;
    return requestedStatementIndex === null || rowStatementIndex(row) === requestedStatementIndex;
  });
  const rowIds = new Set(rows.map(relationId).filter((value): value is string => value !== null));
  const edges = (input.relationEdgeRecords ?? []).filter((edge) => {
    const from = text(edge.from_relation_id);
    const to = text(edge.to_relation_id);
    return from !== null && to !== null && rowIds.has(from) && rowIds.has(to);
  });
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    const to = text(edge.to_relation_id);
    const from = text(edge.from_relation_id);
    if (!to || !from) continue;
    const values = incoming.get(to) ?? [];
    values.push(from);
    incoming.set(to, values);
  }
  const rowsById = new Map<string, JsonRecord>();
  for (const row of rows) {
    const id = relationId(row);
    if (id) rowsById.set(id, row);
  }
  const descendantReads = (id: string, seen = new Set<string>()): readonly string[] => {
    if (seen.has(id)) return [];
    seen.add(id);
    const row = rowsById.get(id);
    if (row && relationType(row) === "read") return [readOccurrenceId(row) ?? id];
    return sorted((incoming.get(id) ?? []).flatMap((sourceId) => descendantReads(sourceId, seen)));
  };
  const readTables = new Map<string, string>();
  for (const row of rows) {
    if (relationType(row) !== "read") continue;
    const id = readOccurrenceId(row);
    const table = text(relationOf(row).table);
    if (id && table) readTables.set(id, table);
  }
  const readImpacts = new Map<string, { channels: Set<ImpactChannel>; refs: Set<string>; gaps: Set<string> }>();
  const gaps = new Set<string>();
  let rootRelationId: string | null = null;
  let statementIndex = requestedStatementIndex ?? 0;
  for (const row of rows) {
    const id = relationId(row);
    const type = relationType(row);
    if (!id || !type) {
      gaps.add(`relation-summary-gap:${input.taskId}:RELATION_IDENTITY_UNRESOLVED`);
      continue;
    }
    const statementId = text(row.statement_id);
    const match = statementId?.match(/statement:(\d+)/i);
    if (match) statementIndex = Number(match[1]);
    if (rootRelationId === null && /:relation:root(?:[.:]|$)/i.test(id)) rootRelationId = id;
    if (type === "read" || childRelationIds(row).length > 0 || incoming.has(id)) {
      const descendants = type === "read" ? [readOccurrenceId(row) ?? id] : descendantReads(id);
      const columnTables = physicalColumnTables(row);
      const shouldRestrictToColumns = type === "filter" || type === "having" || type === "qualify" || type === "join" || type === "project";
      const readIds = shouldRestrictToColumns && columnTables.length > 0
        ? descendants.filter((readId) => {
            const table = readTables.get(readId);
            return table !== undefined && columnTables.some((columnTable) => tableMatches(table, columnTable));
          })
        : descendants;
      for (const readId of readIds) {
        const current = readImpacts.get(readId) ?? { channels: new Set<ImpactChannel>(), refs: new Set<string>(), gaps: new Set<string>() };
        for (const channel of impactChannels(row)) current.channels.add(channel);
        current.refs.add(`machine-facts:${input.taskId}:relation:${id}`);
        if (hasUnsupportedShape(row)) {
          const gap = `relation-summary-gap:${input.taskId}:${id}:UNSUPPORTED_OPERATOR`;
          current.gaps.add(gap);
          gaps.add(gap);
        }
        for (const sourceId of sourceRelationIds(row, incoming)) current.refs.add(`machine-facts:${input.taskId}:relation:${sourceId}`);
        readImpacts.set(readId, current);
      }
    }
    if (hasUnsupportedShape(row)) gaps.add(`relation-summary-gap:${input.taskId}:${id}:UNSUPPORTED_OPERATOR`);
  }
  const statementRows = (input.statementRecords ?? []).filter((row) => requestedStatementIndex === null || rowStatementIndex(row) === requestedStatementIndex);
  const statementGaps = statementRows.flatMap((row) => {
    const status = text(row.parse_status);
    return status && status !== "SUCCESS"
      ? [`relation-summary-gap:${input.taskId}:PARSE_${status}`]
      : [];
  });
  for (const gap of statementGaps) gaps.add(gap);
  const normalized = [...readImpacts.entries()].map(([readOccurrenceId, value]) => ({
    readOccurrenceId,
    impactChannels: [...value.channels].sort(),
    evidenceRefs: sorted([...value.refs]),
    gaps: sorted([...value.gaps]),
  })).sort((a, b) => a.readOccurrenceId.localeCompare(b.readOccurrenceId));
  const digestInput = { taskId: input.taskId, statementIndex, rootRelationId, normalized, relationCount: rows.length, edgeCount: edges.length };
  return {
    taskId: input.taskId,
    statementIndex,
    rootRelationId,
    digest: sha256(canonicalJson(digestInput)),
    complete: gaps.size === 0,
    readImpacts: normalized,
    relationCount: rows.length,
    readCount: rows.filter((row) => relationType(row) === "read").length,
    edgeCount: edges.length,
    gaps: sorted([...gaps]),
  };
}
