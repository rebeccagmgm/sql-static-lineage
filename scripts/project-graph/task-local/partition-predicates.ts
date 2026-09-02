import type { JsonRecord } from "../../query/current-task-bundle.ts";

export interface PartitionPredicate {
  readonly column: string;
  readonly values: readonly string[];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function records(value: unknown): readonly JsonRecord[] {
  return Array.isArray(value)
    ? value.filter(
      (item): item is JsonRecord =>
        typeof item === "object" && item !== null && !Array.isArray(item),
    )
    : [];
}

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function relationIdOf(row: JsonRecord): string | null {
  return text(row.relation_id) ?? text(record(row.relation)?.id);
}

function relationTypeOf(row: JsonRecord): string {
  return (
    text(row.relation_type)
    ?? text(record(row.relation)?.type)
    ?? ""
  ).toLowerCase();
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
    || (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function literalValue(operand: JsonRecord): string | null {
  if (text(operand.kind)?.toUpperCase() !== "LITERAL") return null;
  const observed = text(operand.observedValue);
  if (observed) return observed;
  const expression = text(operand.expression);
  return expression ? stripQuotes(expression) : null;
}

function columnName(operand: JsonRecord): string | null {
  if (text(operand.kind)?.toUpperCase() !== "COLUMN") return null;
  const column = record(operand.column);
  return text(column?.name) ?? text(operand.expression);
}

/** Only EQ / IN literals — value-set shape for producer partition matching. */
function collectLiteralPredicates(
  tree: unknown,
  into: Map<string, { column: string; values: Set<string> }>,
): void {
  const node = record(tree);
  if (!node) return;
  const kind = text(node.kind)?.toUpperCase();
  if (kind === "AND" || kind === "OR") {
    for (const child of records(node.children)) {
      collectLiteralPredicates(child, into);
    }
    return;
  }
  if (kind !== "ATOM") return;
  const operator = text(node.operator)?.toUpperCase();
  if (operator !== "EQ" && operator !== "IN") return;
  const operands = records(node.operands);
  if (operands.length < 2) return;
  const column = columnName(operands[0]!);
  if (!column) return;
  const values: string[] = [];
  for (const operand of operands.slice(1)) {
    const value = literalValue(operand);
    if (value === null) return;
    values.push(value);
  }
  if (values.length === 0) return;
  const key = column.toLowerCase();
  const existing = into.get(key) ?? { column, values: new Set<string>() };
  for (const value of values) existing.values.add(value);
  into.set(key, existing);
}

function predicatesFromFilter(filterRow: JsonRecord): PartitionPredicate[] {
  const relation = record(filterRow.relation) ?? filterRow;
  const collected = new Map<string, { column: string; values: Set<string> }>();
  collectLiteralPredicates(relation.predicate_tree, collected);
  return [...collected.values()]
    .map((entry) => ({
      column: entry.column,
      values: [...entry.values].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.column.localeCompare(right.column));
}

function mergePredicates(
  left: readonly PartitionPredicate[],
  right: readonly PartitionPredicate[],
): PartitionPredicate[] {
  const merged = new Map<string, { column: string; values: Set<string> }>();
  for (const predicate of [...left, ...right]) {
    const key = predicate.column.toLowerCase();
    const existing = merged.get(key) ?? {
      column: predicate.column,
      values: new Set<string>(),
    };
    for (const value of predicate.values) existing.values.add(value);
    merged.set(key, existing);
  }
  return [...merged.values()]
    .map((entry) => ({
      column: entry.column,
      values: [...entry.values].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.column.localeCompare(right.column));
}

/**
 * Map read_occurrence_id → literal FILTER predicates that directly wrap that
 * read relation (RELATION_INPUT from read → filter).
 */
export function partitionPredicatesByReadOccurrence(input: {
  readonly taskId: string;
  readonly relationRecords: readonly JsonRecord[];
  readonly relationEdgeRecords: readonly JsonRecord[];
}): ReadonlyMap<string, readonly PartitionPredicate[]> {
  const filters = new Map<string, PartitionPredicate[]>();
  for (const row of input.relationRecords) {
    if (text(row.task_id) !== null && text(row.task_id) !== input.taskId) continue;
    if (relationTypeOf(row) !== "filter") continue;
    const id = relationIdOf(row);
    if (!id) continue;
    filters.set(id, predicatesFromFilter(row));
  }

  const byOccurrence = new Map<string, PartitionPredicate[]>();
  for (const edge of input.relationEdgeRecords) {
    if (text(edge.task_id) !== null && text(edge.task_id) !== input.taskId) continue;
    const from = text(edge.from_relation_id);
    const to = text(edge.to_relation_id);
    if (!from || !to) continue;
    const predicates = filters.get(to);
    if (!predicates || predicates.length === 0) continue;
    byOccurrence.set(
      from,
      mergePredicates(byOccurrence.get(from) ?? [], predicates),
    );
  }
  return byOccurrence;
}
