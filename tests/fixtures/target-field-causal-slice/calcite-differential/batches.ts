import type {
  CalciteNativeOperatorBatch,
  CalciteSemanticObservation,
  NativeSemanticObservation,
} from "../../../../scripts/calcite-oracle/protocol.ts";
import type {
  CalciteOperatorBatchInput,
} from "../../../../scripts/reconcile/consumer/target-field-causal-slice/calcite-semantic-mapping.ts";

const source = (id: string, text: string, start: number, end: number) => ({
  canonicalSource: text,
  sourceSpan: { start, end },
  sourceEvidenceId: id,
});

function observation(
  observationId: string,
  batch: CalciteNativeOperatorBatch,
  relationOccurrenceId: string,
  operatorKind: string,
  operatorVariant: string,
  operatorRole: string,
  sourceEvidenceId: string,
  canonicalSource: string,
  outputOrdinal: number,
  value: unknown,
  fieldId = "field:demo.source:a",
  fieldOrdinal = 0,
): CalciteSemanticObservation {
  return {
    observationId,
    batch,
    relationOccurrenceId,
    fieldId,
    fieldOrdinal,
    outputOrdinal,
    operatorKind,
    operatorVariant,
    operatorRole,
    sourceEvidence: source(sourceEvidenceId, canonicalSource, 0, canonicalSource.length),
    value,
  };
}

const expression = observation(
  "calcite-expression",
  "EXPRESSION_CONTROLS",
  "read-expression",
  "PROJECT",
  "CASE",
  "BRANCH_VALUE",
  "src-expression",
  "CASE WHEN s THEN a ELSE b END",
  0,
  ["field:demo.source:a"],
);
const ifExpression = observation(
  "calcite-if",
  "EXPRESSION_CONTROLS",
  "read-if",
  "PROJECT",
  "IF",
  "BRANCH_SELECTOR",
  "src-if",
  "IF(enabled, a, b)",
  1,
  ["field:demo.source:enabled"],
  "field:demo.source:enabled",
  1,
);
const coalesceExpression = observation(
  "calcite-coalesce",
  "EXPRESSION_CONTROLS",
  "read-coalesce",
  "PROJECT",
  "COALESCE",
  "BRANCH_VALUE",
  "src-coalesce",
  "COALESCE(a, b)",
  2,
  ["field:demo.source:a", "field:demo.source:b"],
);
const columnExpression = observation(
  "calcite-column-expression",
  "EXPRESSION_CONTROLS",
  "read-column-expression",
  "PROJECT",
  "COLUMN_EXPRESSION",
  "VALUE",
  "src-column-expression",
  "a + 1",
  3,
  ["field:demo.source:a"],
);

const filter = observation(
  "calcite-filter",
  "FILTERS_AND_JOINS",
  "read-filter",
  "FILTER",
  "WHERE",
  "PREDICATE",
  "src-filter",
  "a > 0",
  0,
  ["field:demo.source:a"],
);
const join = observation(
  "calcite-join",
  "FILTERS_AND_JOINS",
  "read-join",
  "JOIN",
  "INNER",
  "JOIN_CONDITION",
  "src-join",
  "l.a = r.a",
  0,
  ["field:demo.source:a"],
);
const having = observation(
  "calcite-having",
  "FILTERS_AND_JOINS",
  "read-having",
  "FILTER",
  "HAVING",
  "PREDICATE",
  "src-having",
  "SUM(a) > 0",
  1,
  ["field:demo.source:a"],
);
const qualify = observation(
  "calcite-qualify",
  "FILTERS_AND_JOINS",
  "read-qualify",
  "FILTER",
  "QUALIFY",
  "PREDICATE",
  "src-qualify",
  "ROW_NUMBER() = 1",
  2,
  ["field:demo.source:a"],
);

const aggregate = observation(
  "calcite-aggregate",
  "AGGREGATE_GROUPING_DISTINCT_SETOP",
  "read-aggregate",
  "AGGREGATE",
  "GROUP_BY",
  "GROUP_KEY",
  "src-aggregate",
  "GROUP BY a",
  0,
  ["field:demo.source:a"],
);
const distinct = observation(
  "calcite-distinct",
  "AGGREGATE_GROUPING_DISTINCT_SETOP",
  "read-distinct",
  "DISTINCT",
  "DISTINCT_KEY",
  "VALUE",
  "src-distinct",
  "DISTINCT a",
  0,
  ["field:demo.source:a"],
);
const setop = observation(
  "calcite-setop",
  "AGGREGATE_GROUPING_DISTINCT_SETOP",
  "read-setop",
  "SETOP",
  "UNION_ALL",
  "SET_MEMBER",
  "src-setop",
  "UNION ALL",
  0,
  ["field:demo.source:a"],
);
const aggregateInput = observation(
  "calcite-aggregate-input",
  "AGGREGATE_GROUPING_DISTINCT_SETOP",
  "read-aggregate-input",
  "AGGREGATE",
  "AGGREGATE_INPUT",
  "AGGREGATE_ARGUMENT",
  "src-aggregate-input",
  "SUM(a)",
  1,
  ["field:demo.source:a"],
);
const intersect = observation(
  "calcite-intersect",
  "AGGREGATE_GROUPING_DISTINCT_SETOP",
  "read-intersect",
  "SETOP",
  "INTERSECT",
  "SET_MEMBER",
  "src-intersect",
  "INTERSECT",
  2,
  ["field:demo.source:a"],
);
const except = observation(
  "calcite-except",
  "AGGREGATE_GROUPING_DISTINCT_SETOP",
  "read-except",
  "SETOP",
  "EXCEPT",
  "SET_MEMBER",
  "src-except",
  "EXCEPT",
  3,
  ["field:demo.source:a"],
);

const window = observation(
  "calcite-window",
  "WINDOW_TOP_N",
  "read-window",
  "WINDOW",
  "WINDOW_ORDER_BY",
  "ORDER_KEY",
  "src-window",
  "ORDER BY a",
  0,
  ["field:demo.source:a"],
);
const topN = observation(
  "calcite-top-n",
  "WINDOW_TOP_N",
  "read-top-n",
  "TOP_N",
  "LIMIT",
  "ORDER_KEY",
  "src-top-n",
  "ORDER BY a LIMIT 10",
  0,
  ["field:demo.source:a"],
);
const windowValue = observation(
  "calcite-window-value",
  "WINDOW_TOP_N",
  "read-window-value",
  "WINDOW",
  "WINDOW_VALUE",
  "WINDOW_INPUT",
  "src-window-value",
  "SUM(a) OVER ()",
  1,
  ["field:demo.source:a"],
);
const windowPartition = observation(
  "calcite-window-partition",
  "WINDOW_TOP_N",
  "read-window-partition",
  "WINDOW",
  "WINDOW_PARTITION_BY",
  "PARTITION_KEY",
  "src-window-partition",
  "PARTITION BY a",
  2,
  ["field:demo.source:a"],
);
const windowFrame = observation(
  "calcite-window-frame",
  "WINDOW_TOP_N",
  "read-window-frame",
  "WINDOW",
  "WINDOW_FRAME",
  "FRAME_BOUND",
  "src-window-frame",
  "ROWS 1 PRECEDING",
  3,
  ["field:demo.source:a"],
);

const countStar = observation(
  "calcite-count-star",
  "RELATION_CONTEXT",
  "read-count",
  "AGGREGATE",
  "COUNT_STAR",
  "RELATION",
  "src-count-star",
  "COUNT(*)",
  0,
  ["relation:read-count"],
  "",
  0,
);
const exists = observation(
  "calcite-exists",
  "RELATION_CONTEXT",
  "read-exists",
  "SUBQUERY",
  "EXISTS",
  "RELATION",
  "src-exists",
  "EXISTS (SELECT 1 FROM r)",
  0,
  ["relation:read-exists"],
  "",
  0,
);
const crossJoin = observation(
  "calcite-cross-join",
  "RELATION_CONTEXT",
  "read-cross",
  "RELATION",
  "CROSS_JOIN",
  "CARDINALITY",
  "src-cross-join",
  "CROSS JOIN",
  0,
  ["relation:read-cross"],
  "",
  0,
);
const literalFromRelation = observation(
  "calcite-literal-from-relation",
  "RELATION_CONTEXT",
  "read-literal",
  "RELATION",
  "LITERAL_FROM_RELATION",
  "RELATION",
  "src-literal-from-relation",
  "SELECT 1 FROM source",
  0,
  ["relation:read-literal"],
  "",
  0,
);

export const nativeBatchFixtures: readonly CalciteOperatorBatchInput[] = [
  {
    batch: "EXPRESSION_CONTROLS",
    observations: [expression, ifExpression, coalesceExpression, columnExpression],
    calcite: [expression, ifExpression, coalesceExpression, columnExpression],
  },
  {
    batch: "FILTERS_AND_JOINS",
    observations: [filter, having, qualify, join],
    calcite: [filter, having, qualify, join],
  },
  {
    batch: "AGGREGATE_GROUPING_DISTINCT_SETOP",
    observations: [aggregate, aggregateInput, distinct, setop, intersect, except],
    calcite: [aggregate, aggregateInput, distinct, setop, intersect, except],
  },
  {
    batch: "WINDOW_TOP_N",
    observations: [window, windowValue, windowPartition, windowFrame, topN],
    calcite: [window, windowValue, windowPartition, windowFrame, topN],
  },
  {
    batch: "RELATION_CONTEXT",
    observations: [countStar, exists, crossJoin, literalFromRelation],
    calcite: [countStar, exists, crossJoin, literalFromRelation],
  },
];

export function cloneBatches(): CalciteOperatorBatchInput[] {
  return nativeBatchFixtures.map((batch) => ({
    ...batch,
    observations: batch.observations.map((observation) => ({ ...observation })),
    calcite: batch.calcite?.map((observation) => ({ ...observation })),
  }));
}

export function asNativeObservations(): readonly NativeSemanticObservation[] {
  return nativeBatchFixtures.flatMap((batch) => batch.observations);
}
