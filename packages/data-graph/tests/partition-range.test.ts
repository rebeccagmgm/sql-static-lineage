import { describe, expect, it } from "vitest";
import { matchesReadPartitionRange, readPartitionRanges } from "../../../scripts/project-graph/task-local/partition-range.ts";
import { partitionMatchStatus } from "../src/continuation/continuation-v2.ts";

const atom = (column: string, operator: string, ...expressions: string[]) => ({ kind: "ATOM", operator,
  operands: [{ kind: "COLUMN", column: { name: column, physical: [{ table: "renamed.table", column }] } },
    ...expressions.map(expression => ({ kind: "LITERAL", expression }))] });
const scope = (...trees: unknown[]) => ({ version: 1 as const, table: "renamed.table", trees });
const part = (column: string, value: string) => ({ column, values: [value], partitionStatus: "STATIC" });

describe("partition range inclusion", () => {
  it.each(["busi_mon", "period_code"])("proves inclusive month bounds without depending on column name %s", column => {
    expect(matchesReadPartitionRange(scope(atom(column, "BETWEEN", "'${yyyyMM,-2M}'", "'${yyyyMM}'")), [part(column, "${YYYYMM}")])).toBe(true);
    expect(matchesReadPartitionRange(scope(atom(column, "BETWEEN", "'${yyyyMM,-2M}'", "'${yyyyMM}'")), [part(column, "${YYYYMM,1M}")])).toBe(null);
  });
  it("proves month/year start is no later than current day", () => {
    for (const start of ["'${yyyy-MM}-01'", "'${yyyy}-01-01'"]) {
      expect(matchesReadPartitionRange(scope(atom("d", "BETWEEN", start, "'${yyyy-MM-dd}'")), [part("d", "${YYYY-MM-DD}")])).toBe(true);
    }
  });
  it("preserves strict bounds and month offsets", () => {
    expect(matchesReadPartitionRange(scope(atom("n", "LT", "'9'")), [part("n", "100")])).toBe(null);
    expect(matchesReadPartitionRange(scope(atom("m", "LT", "'${yyyyMM}'")), [part("m", "${YYYYMM}")])).toBe(null);
    expect(matchesReadPartitionRange(scope(atom("m", "LTE", "'${yyyyMM,-1M}'")), [part("m", "${YYYYMM}")])).toBe(null);
    expect(matchesReadPartitionRange(scope(atom("m", "GTE", "'${yyyy}01'")), [part("m", "${YYYYMM,-1M}")])).toBe(null);
  });
  it("proves month-end upper bounds without assuming today is month end", () => {
    const a = atom("d", "LTE", "unused");
    a.operands[1] = { kind: "OTHER", structured_expression: { kind: "FUNCTION", name: "last_day", args: [{ kind: "LITERAL", text: "'${yyyy-MM-dd}'" }] } } as any;
    expect(matchesReadPartitionRange(scope(a), [part("d", "${YYYY-MM-DD}")])).toBe(true);
    expect(matchesReadPartitionRange(scope({ ...a, operator: "EQ" }), [part("d", "${YYYY-MM-DD}")])).toBe(null);
    a.operands[1] = { kind: "OTHER", structured_expression: { kind: "FUNCTION", name: "default.last_day", args: [{ kind: "LITERAL", text: "'${yyyy-MM-dd}'" }] } } as any;
    expect(matchesReadPartitionRange(scope(a), [part("d", "${YYYY-MM-DD}")])).toBe(null);
  });
  it("does not discard OR, unknown branches, NULL, or unknown partition values", () => {
    const a = atom("d", "EQ", "'${yyyy-MM-dd}'");
    for (const tree of [{ kind: "OR", children: [a, a] }, { kind: "AND", children: [a, { kind: "UNKNOWN" }] }])
      expect(matchesReadPartitionRange(scope(tree), [part("d", "${YYYY-MM-DD}")])).toBe(null);
    expect(matchesReadPartitionRange(scope(a), [{ ...part("d", "${YYYY-MM-DD}"), mayBeNull: true }])).toBe(null);
    expect(matchesReadPartitionRange(scope(a), [{ ...part("d", "x"), values: [] }])).toBe(null);
  });
  it("checks every partition dimension and respects literal case", () => {
    const s = scope({ kind: "AND", children: [atom("d", "LTE", "'${yyyy-MM-dd}'"), atom("tag", "EQ", "'A'")] });
    expect(matchesReadPartitionRange(s, [part("d", "${YYYY-MM-DD}"), part("tag", "A")])).toBe(true);
    expect(matchesReadPartitionRange(s, [part("d", "${YYYY-MM-DD}"), part("tag", "a")])).toBe(null);
  });
  it("does not equate an opaque UDF or fixed date with the scheduler day", () => {
    const a = atom("d", "EQ", "'2020-01-01'");
    expect(matchesReadPartitionRange(scope(a), [part("d", "${YYYY-MM-DD}")])).toBe(null);
    a.operands[1] = { kind: "OTHER", expression: "pretradedate('${yyyy-MM-dd}',1)" } as any;
    expect(matchesReadPartitionRange(scope(a), [part("d", "${YYYY-MM-DD}")])).toBe(null);
  });
  it("rejects filters across joins and retains a direct filter tree", () => {
    const rows = [{ id: "r", type: "read", table: "renamed.table" }, { id: "f", type: "filter", source: "r", predicate_tree: atom("d", "LTE", "'${yyyy-MM-dd}'") }];
    expect(readPartitionRanges(rows).has("r")).toBe(true);
    expect(readPartitionRanges([...rows, { id: "j", type: "join", left: "f", right: "other" }, { id: "outer", type: "filter", source: "j", predicate_tree: atom("d", "LT", "'${yyyy-MM-dd}'") }]).has("r")).toBe(false);
  });
  it("upgrades a read using its preserved range evidence", () => {
    const range = scope(atom("busi_mon", "BETWEEN", "'${yyyyMM,-2M}'", "'${yyyyMM}'"));
    const read = { readOccurrenceId: "r", readOccurrenceNodeId: "rn", datasetNodeId: "d", qualifiedName: "renamed.table", identityStatus: "CONFIRMED", partitionPredicateStatus: "NON_LITERAL_PRESENT" as const, partitionPredicates: [], partitionRange: range };
    const write = { taskId: "p", writeObservationId: "w", targetWriteNodeId: "wn", datasetNodeId: "d", qualifiedName: "renamed.table", source: "IN_UNION_FINAL_WRITE" as const, partitionStatus: "STATIC", partition: [{ ...part("busi_mon", "${YYYYMM}"), valueStatus: "RUNTIME_EXPRESSION" }] };
    expect(partitionMatchStatus(read, write)).toBe("CONFIRMED");
    expect(partitionMatchStatus({ ...read, partitionRange: { ...range, table: "other.table" } }, write)).toBe("UNKNOWN");
    expect(partitionMatchStatus({ ...read, partitionRange: undefined }, write)).toBe("UNKNOWN");
  });
});
