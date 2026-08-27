import { describe, expect, it } from "vitest";

import type {
  PlanFacts,
  PlanRelation,
} from "../../scripts/plans/plan-contract.ts";
import { normalizeSemanticDependencies } from "../../scripts/reconcile/consumer/target-field-causal-slice/semantic-dependency-normalizer.ts";

const span = { start: 0, end: 10 };

function column(
  table: string,
  name: string,
  clause:
    | "projection"
    | "where"
    | "join"
    | "groupBy"
    | "having"
    | "qualify"
    | "orderBy"
    | "limit" = "projection",
) {
  return {
    name,
    qualifier: table,
    clause,
    physical: [{ table, column: name }],
  };
}

function read(id: string, table: string): PlanRelation {
  return {
    id,
    type: "read",
    span,
    provenance: "extracted",
    output_columns: ["a", "b", "g"],
    read_occurrence_id: `${id}:occurrence`,
    read_occurrence: {
      occurrence_id: `${id}:occurrence`,
      relation_id: id,
      scope_id: "root",
      source_span: span,
    },
    table,
    binding: id,
    columns: ["a", "b", "g"],
  };
}

function expression(
  output: string,
  expr_kind: string,
  input_columns: ReturnType<typeof column>[] = [],
  extra: Record<string, unknown> = {},
  expr_text = output,
) {
  return {
    output,
    expr_kind,
    expr_text,
    display_text: expr_text,
    span,
    input_columns,
    ...extra,
  };
}

function plan(relations: PlanRelation[], roots: string[]): PlanFacts {
  return {
    meta: {
      contract_version: "1.4.0",
      adapter_version: "test",
      parser: { engine: "test", version: "1" },
      dialect: "databricks",
      statement_index: 0,
      generated_at: "1970-01-01T00:00:00.000Z",
    },
    roots,
    relations,
    physical_inputs: [],
    unknowns: [],
    lineage_hops: { roots: [], nodes: [], edges: [] },
  };
}

function normalize(
  facts: PlanFacts,
  rootTargetFieldId = "target",
  outputName?: string,
  relationId?: string,
) {
  return normalizeSemanticDependencies({
    plan: facts,
    roots: [{ rootTargetFieldId, outputName, relationId }],
  });
}

function variants(result: ReturnType<typeof normalizeSemanticDependencies>) {
  return result.definitions.map(
    (item) =>
      `${item.operatorKind}:${item.operatorVariant}:${item.operatorRole}`,
  );
}

describe("target-field semantic dependency normalization", () => {
  it("isolates one target expression and selected aggregate/top-n inputs", () => {
    const source = read("read", "db.source");
    const aggregate = {
      id: "aggregate",
      type: "aggregate" as const,
      source: "read",
      span,
      provenance: "extracted" as const,
      output_columns: ["wanted", "unrelated"],
      group_by: [column("db.source", "g", "groupBy")],
      group_by_exprs: ["g"],
      group_by_exprs_display: ["g"],
      measures: [
        expression("wanted", "function", [column("db.source", "a")], {
          aggregate: true,
        }),
        expression("unrelated", "function", [column("db.source", "b")], {
          aggregate: true,
        }),
      ],
    };
    const project = {
      id: "project",
      type: "project" as const,
      source: "aggregate",
      span,
      provenance: "extracted" as const,
      output_columns: ["wanted", "unrelated"],
      expressions: [
        expression("wanted", "column", [column("db.source", "wanted")]),
        expression("unrelated", "column", [column("db.source", "unrelated")]),
      ],
    };
    const result = normalize(
      plan([source, aggregate, project], ["project"]),
      "target",
      "wanted",
    );
    const ids = result.edges.map((edge) =>
      edge.fromSubject.subjectKind === "PHYSICAL_FIELD"
        ? edge.fromSubject.physicalFieldId
        : edge.fromSubject.relationOccurrenceId,
    );
    expect(ids).not.toContain("physical:db.source:b");
    expect(result.gaps).toHaveLength(0);
  });

  it("uses role.operator for IF even when expr_kind is function and keeps results as value", () => {
    const result = normalize(
      plan(
        [
          read("read", "db.source"),
          {
            id: "project",
            type: "project",
            source: "read",
            span,
            provenance: "extracted",
            output_columns: ["wanted"],
            expressions: [
              expression("wanted", "function", [], {
                expression_roles: [
                  {
                    operator: "IF",
                    role: "BRANCH_SELECTOR",
                    effects: ["BRANCH_SELECTION"],
                    path: "root.arg[0]",
                    ordinal: 0,
                    expression_text: "flag",
                    display_text: "flag",
                    span,
                    input_columns: [column("db.source", "a")],
                  },
                  {
                    operator: "IF",
                    role: "RESULT_VALUE",
                    effects: ["VALUE_CONTRIBUTION"],
                    path: "root.arg[1]",
                    branch_ordinal: 0,
                    ordinal: 1,
                    expression_text: "a",
                    display_text: "a",
                    span,
                    input_columns: [column("db.source", "a")],
                  },
                  {
                    operator: "IF",
                    role: "RESULT_VALUE",
                    effects: ["VALUE_CONTRIBUTION"],
                    path: "root.arg[2]",
                    branch_ordinal: 1,
                    ordinal: 2,
                    expression_text: "b",
                    display_text: "b",
                    span,
                    input_columns: [column("db.source", "b")],
                  },
                ],
              }),
            ],
          },
        ],
        ["project"],
      ),
      "target",
      "wanted",
    );
    expect(variants(result)).toContain("PROJECT:IF:BRANCH_SELECTOR");
    expect(variants(result)).toContain("PROJECT:IF:BRANCH_VALUE");
    expect(variants(result)).not.toContain("PROJECT:FUNCTION:BRANCH_VALUE");
    expect(result.gaps).toHaveLength(0);
  });

  it.each([
    ["CASE", "RESULT_VALUE", ["VALUE_CONTRIBUTION"]],
    [
      "COALESCE",
      "COALESCE_ARGUMENT",
      ["VALUE_CONTRIBUTION", "BRANCH_SELECTION"],
    ],
  ] as const)(
    "separates %s selector/value role effects",
    (operator, role, effects) => {
      const result = normalize(
        plan(
          [
            read("read", "db.source"),
            {
              id: "project",
              type: "project",
              source: "read",
              span,
              provenance: "extracted",
              output_columns: ["wanted"],
              expressions: [
                expression(
                  "wanted",
                  operator === "CASE" ? "case" : "function",
                  [],
                  {
                    expression_roles: [
                      ...(operator === "CASE"
                        ? [
                            {
                              operator,
                              role: "BRANCH_SELECTOR",
                              effects: ["BRANCH_SELECTION"],
                              path: "root.when[0]",
                              ordinal: 0,
                              span,
                              expression_text: "flag",
                              display_text: "flag",
                              input_columns: [column("db.source", "a")],
                            },
                          ]
                        : []),
                      {
                        operator,
                        role,
                        effects,
                        path: "root.arg[0]",
                        ordinal: 0,
                        span,
                        expression_text: "a",
                        display_text: "a",
                        input_columns: [column("db.source", "a")],
                      },
                    ],
                  },
                ),
              ],
            },
          ],
          ["project"],
        ),
        "target",
        "wanted",
      );
      expect(variants(result)).toContain(`PROJECT:${operator}:BRANCH_VALUE`);
      if (operator === "CASE")
        expect(variants(result)).toContain("PROJECT:CASE:BRANCH_SELECTOR");
      else
        expect(variants(result)).toContain("PROJECT:COALESCE:BRANCH_SELECTOR");
      expect(result.gaps).toHaveLength(0);
    },
  );

  it.each(["where", "having", "qualify"] as const)(
    "preserves %s as a distinct rowset operator",
    (clause) => {
      const result = normalize(
        plan(
          [
            read("read", "db.source"),
            {
              id: clause,
              type: "filter",
              clause,
              source: "read",
              span,
              provenance: "extracted",
              output_columns: ["a"],
              predicate_expr: "a > 0",
              predicate_display: "a > 0",
              predicate_columns: [column("db.source", "a", clause)],
              predicate_tree: {
                kind: "ATOM",
                operator: "GT",
                operands: [],
                span,
              },
            },
            {
              id: "project",
              type: "project",
              source: clause,
              span,
              provenance: "extracted",
              output_columns: ["a"],
              expressions: [
                expression("a", "column", [column("db.source", "a")]),
              ],
            },
          ],
          ["project"],
        ),
        "target",
        "a",
      );
      expect(variants(result)).toContain(
        `FILTER:${clause.toUpperCase()}:PREDICATE`,
      );
      expect(result.gaps).toHaveLength(0);
    },
  );

  it("treats a physical READ as a boundary and recognizes COUNT(*) without optional functions", () => {
    const result = normalize(
      plan(
        [
          read("read", "db.source"),
          {
            id: "aggregate",
            type: "aggregate",
            source: "read",
            span,
            provenance: "extracted",
            output_columns: ["count_rows"],
            group_by: [],
            group_by_exprs: [],
            group_by_exprs_display: [],
            measures: [
              expression(
                "count_rows",
                "function",
                [],
                { aggregate: true },
                "COUNT(*)",
              ),
            ],
          },
        ],
        ["aggregate"],
      ),
      "target",
      "count_rows",
    );
    expect(variants(result)).toContain("AGGREGATE:COUNT_STAR:RELATION");
    expect(result.gaps).toHaveLength(0);
  });

  it("emits hard gaps for missing relation/branch/subquery IDs instead of fabricating reads", () => {
    const result = normalize(
      plan(
        [
          {
            id: "join",
            type: "join",
            left: "missing-left",
            right: "missing-right",
            join_type: "inner",
            condition_expr: null,
            condition_display: null,
            condition_columns: [],
            span,
            provenance: "extracted",
            output_columns: ["a"],
          },
          {
            id: "project",
            type: "project",
            source: "join",
            span,
            provenance: "extracted",
            output_columns: ["a"],
            expressions: [
              expression("a", "column", [column("db.source", "a")]),
            ],
          },
        ],
        ["project"],
      ),
      "target",
      "a",
    );
    expect(
      result.gaps.some((gap) => gap.message.includes("missing-left")),
    ).toBe(true);
    expect(
      result.gaps.some((gap) => gap.message.includes("missing-right")),
    ).toBe(true);
    expect(result.gaps.every((gap) => gap.blocksNegativeProof)).toBe(true);
    expect(
      result.edges.some(
        (edge) => edge.fromSubject.subjectKind === "RELATION_OCCURRENCE",
      ),
    ).toBe(false);

    const subquery = normalize(
      plan(
        [
          read("outer", "db.outer"),
          {
            id: "filter",
            type: "filter",
            clause: "where",
            source: "outer",
            span,
            provenance: "extracted",
            output_columns: ["a"],
            predicate_expr: "EXISTS (...) ",
            predicate_display: "EXISTS (...) ",
            predicate_columns: [],
            predicate_tree: {
              kind: "ATOM",
              operator: "OTHER",
              operands: [],
              span,
            },
            contains_subquery: true,
            subquery_relation_ids: ["missing-subquery"],
          } as PlanRelation,
        ],
        ["filter"],
      ),
      "target",
      "a",
    );
    expect(
      subquery.gaps.some((gap) => gap.message.includes("missing-subquery")),
    ).toBe(true);
  });

  it("fails closed for unknown expression kinds and incomplete window frames", () => {
    const unknown = normalize(
      plan(
        [
          read("read", "db.source"),
          {
            id: "project",
            type: "project",
            source: "read",
            span,
            provenance: "extracted",
            output_columns: ["wanted"],
            expressions: [
              expression("wanted", "future_operator", [
                column("db.source", "a"),
              ]),
            ],
          },
        ],
        ["project"],
      ),
      "target",
      "wanted",
    );
    expect(
      unknown.gaps.some((gap) => gap.reasonCode === "UNKNOWN_OPERATOR_OR_ROLE"),
    ).toBe(true);
    expect(
      unknown.definitions.some(
        (definition) => definition.operatorVariant === "COLUMN_EXPRESSION",
      ),
    ).toBe(false);

    const window = normalize(
      plan(
        [
          read("read", "db.source"),
          {
            id: "project",
            type: "project",
            source: "read",
            span,
            provenance: "extracted",
            output_columns: ["wanted"],
            expressions: [
              expression("wanted", "function", [], {
                window_spec: {
                  source_span: span,
                  expression_text: "OVER ()",
                  display_text: "OVER ()",
                  input_bindings: [],
                  frame: {
                    status: "EXTRACTED",
                    expression_text: "",
                    display_text: "",
                    span,
                    input_columns: [],
                  },
                },
              }),
            ],
          },
        ],
        ["project"],
      ),
      "target",
      "wanted",
    );
    expect(
      window.gaps.some((gap) => gap.operatorVariant === "WINDOW_FRAME"),
    ).toBe(true);
  });

  it("covers supported joins, grouping/distinct/setop, windows, Top-N and relation context", () => {
    const inner = normalize(
      plan(
        [
          read("left", "db.left"),
          read("right", "db.right"),
          {
            id: "join",
            type: "join",
            left: "left",
            right: "right",
            join_type: "inner",
            condition_expr: "left.a = right.a",
            condition_display: "left.a = right.a",
            condition_columns: [
              column("db.left", "a", "join"),
              column("db.right", "a", "join"),
            ],
            condition_tree: {
              kind: "ATOM",
              operator: "EQ",
              operands: [],
              span,
            },
            span,
            provenance: "extracted",
            output_columns: ["a"],
          },
        ],
        ["join"],
      ),
      "target",
      "a",
      "join",
    );
    expect(variants(inner)).toContain("JOIN:INNER:JOIN_CONDITION");
    expect(inner.gaps).toHaveLength(0);

    const cross = normalize(
      plan(
        [
          read("left", "db.left"),
          read("right", "db.right"),
          {
            id: "cross",
            type: "join",
            left: "left",
            right: "right",
            join_type: "cross",
            condition_expr: null,
            condition_display: null,
            condition_columns: [],
            span,
            provenance: "extracted",
            output_columns: ["a"],
          },
        ],
        ["cross"],
      ),
      "target",
      "a",
      "cross",
    );
    expect(variants(cross)).toContain("RELATION:CROSS_JOIN:CARDINALITY");
    expect(cross.gaps).toHaveLength(0);

    const aggregate = normalize(
      plan(
        [
          read("read", "db.source"),
          {
            id: "aggregate",
            type: "aggregate",
            source: "read",
            span,
            provenance: "extracted",
            output_columns: ["g"],
            group_by: [column("db.source", "g", "groupBy")],
            group_by_exprs: ["g"],
            group_by_exprs_display: ["g"],
            measures: [expression("g", "column", [column("db.source", "g")])],
          },
        ],
        ["aggregate"],
      ),
      "target",
      "g",
    );
    expect(variants(aggregate)).toContain("AGGREGATE:GROUP_BY:GROUP_KEY");
    expect(aggregate.gaps).toHaveLength(0);

    const distinct = normalize(
      plan(
        [
          read("read", "db.source"),
          {
            id: "project",
            type: "project",
            source: "read",
            distinct: true,
            span,
            provenance: "extracted",
            output_columns: ["a"],
            expressions: [
              expression("a", "column", [column("db.source", "a")]),
            ],
          } as PlanRelation,
        ],
        ["project"],
      ),
      "target",
      "a",
    );
    expect(variants(distinct)).toContain("DISTINCT:DISTINCT_KEY:VALUE");

    const setop = normalize(
      plan(
        [
          read("left", "db.left"),
          read("right", "db.right"),
          {
            id: "left-project",
            type: "project",
            source: "left",
            span,
            provenance: "extracted",
            output_columns: ["a"],
            expressions: [expression("a", "column", [column("db.left", "a")])],
          },
          {
            id: "right-project",
            type: "project",
            source: "right",
            span,
            provenance: "extracted",
            output_columns: ["a"],
            expressions: [expression("a", "column", [column("db.right", "a")])],
          },
          {
            id: "setop",
            type: "setop",
            setop: "union",
            branches: ["left-project", "right-project"],
            span,
            provenance: "extracted",
            output_columns: ["a"],
          },
        ],
        ["setop"],
      ),
      "target",
      "a",
    );
    expect(variants(setop)).toContain("SETOP:UNION:SET_MEMBER");
    expect(setop.gaps).toHaveLength(0);

    const window = normalize(
      plan(
        [
          read("read", "db.source"),
          {
            id: "project",
            type: "project",
            source: "read",
            span,
            provenance: "extracted",
            output_columns: ["wanted"],
            expressions: [
              expression("wanted", "function", [], {
                window_spec: {
                  source_span: span,
                  expression_text:
                    "OVER (PARTITION BY g ORDER BY a ROWS BETWEEN n PRECEDING AND CURRENT ROW)",
                  display_text: "window",
                  input_bindings: [
                    {
                      role: "VALUE",
                      ordinal: 0,
                      expression_text: "a",
                      display_text: "a",
                      span,
                      input_columns: [column("db.source", "a")],
                    },
                    {
                      role: "WINDOW_PARTITION",
                      ordinal: 0,
                      expression_text: "g",
                      display_text: "g",
                      span,
                      input_columns: [column("db.source", "g")],
                    },
                    {
                      role: "WINDOW_ORDER",
                      ordinal: 0,
                      expression_text: "a",
                      display_text: "a",
                      span,
                      input_columns: [column("db.source", "a")],
                    },
                  ],
                  frame: {
                    status: "EXTRACTED",
                    expression_text: "n PRECEDING",
                    display_text: "n PRECEDING",
                    span,
                    input_columns: [column("db.source", "g")],
                  },
                },
              }),
            ],
          },
        ],
        ["project"],
      ),
      "target",
      "wanted",
    );
    expect(variants(window)).toContain("WINDOW:WINDOW_VALUE:WINDOW_INPUT");
    expect(variants(window)).toContain(
      "WINDOW:WINDOW_PARTITION_BY:PARTITION_KEY",
    );
    expect(variants(window)).toContain("WINDOW:WINDOW_ORDER_BY:ORDER_KEY");
    expect(variants(window)).toContain("WINDOW:WINDOW_FRAME:FRAME_BOUND");
    expect(window.gaps).toEqual([]);

    const topN = normalize(
      plan(
        [
          read("read", "db.source"),
          {
            id: "project",
            type: "project",
            source: "read",
            span,
            provenance: "extracted",
            output_columns: ["wanted"],
            expressions: [
              expression("wanted", "column", [column("db.source", "a")]),
            ],
          },
          {
            id: "top",
            type: "top_n",
            source: "project",
            order_by: [
              {
                role: "ORDER",
                ordinal: 0,
                expression_text: "a",
                display_text: "a",
                span,
                input_columns: [column("db.source", "a", "orderBy")],
              },
            ],
            limit: {
              kind: "LIMIT",
              fetch: {
                role: "FETCH",
                ordinal: 0,
                expression_text: "10",
                display_text: "10",
                span,
                input_columns: [],
              },
            },
            span_status: "EXTRACTED",
            span,
            provenance: "extracted",
            output_columns: ["wanted"],
          },
        ],
        ["top"],
      ),
      "target",
      "wanted",
    );
    expect(variants(topN)).toContain("TOP_N:LIMIT:ORDER_KEY");
    expect(topN.gaps).toHaveLength(0);

    const literal = normalize(
      plan(
        [
          read("read", "db.source"),
          {
            id: "project",
            type: "project",
            source: "read",
            span,
            provenance: "extracted",
            output_columns: ["wanted"],
            expressions: [expression("wanted", "literal", [], {}, "1")],
          },
        ],
        ["project"],
      ),
      "target",
      "wanted",
    );
    expect(variants(literal)).toContain(
      "RELATION:LITERAL_FROM_RELATION:RELATION",
    );
    expect(literal.gaps).toHaveLength(0);
  });

  it("propagates a COUNT(*) target alias through QUALIFY and HAVING without selecting sibling measures", () => {
    const result = normalize(
      plan(
        [
          read("read", "db.source"),
          {
            id: "aggregate",
            type: "aggregate",
            source: "read",
            span,
            provenance: "extracted",
            output_columns: ["k", "n", "unrelated"],
            group_by: [column("db.source", "g", "groupBy")],
            group_by_exprs: ["k"],
            group_by_exprs_display: ["k"],
            measures: [
              expression("n", "function", [], { aggregate: true }, "COUNT(*)"),
              expression(
                "unrelated",
                "function",
                [column("db.source", "b")],
                { aggregate: true },
                "SUM(b)",
              ),
            ],
          },
          {
            id: "having",
            type: "filter",
            clause: "having",
            source: "aggregate",
            span,
            provenance: "extracted",
            output_columns: ["k", "n", "unrelated"],
            predicate_expr: "COUNT(*) > 0",
            predicate_display: "COUNT(*) > 0",
            predicate_columns: [column("db.source", "g", "having")],
            predicate_tree: {
              kind: "ATOM",
              operator: "GT",
              operands: [],
              span,
            },
          },
          {
            id: "qualify",
            type: "filter",
            clause: "qualify",
            source: "having",
            span,
            provenance: "extracted",
            output_columns: ["k", "n", "unrelated"],
            predicate_expr: "n > 0",
            predicate_display: "n > 0",
            predicate_columns: [column("db.source", "g", "qualify")],
            predicate_tree: {
              kind: "ATOM",
              operator: "GT",
              operands: [],
              span,
            },
          },
          {
            id: "project",
            type: "project",
            source: "qualify",
            span,
            provenance: "extracted",
            output_columns: ["k", "n", "unrelated"],
            expressions: [
              expression("k", "column", [column("db.source", "g")]),
              expression("n", "function", [], { aggregate: true }, "COUNT(*)"),
              expression("unrelated", "column", [column("db.source", "b")]),
            ],
          },
        ],
        ["project"],
      ),
      "target:n",
      "n",
      "project",
    );

    expect(variants(result)).toContain("FILTER:HAVING:PREDICATE");
    expect(variants(result)).toContain("FILTER:QUALIFY:PREDICATE");
    expect(variants(result)).toContain("AGGREGATE:COUNT_STAR:RELATION");
    expect(
      result.gaps.some((gap) =>
        gap.message.includes("no canonical expression binding"),
      ),
    ).toBe(false);
    expect(
      result.edges.some(
        (edge) =>
          edge.fromSubject.subjectKind === "PHYSICAL_FIELD" &&
          edge.fromSubject.physicalFieldId === "physical:db.source:b",
      ),
    ).toBe(false);
  });

  it("retains nested COALESCE roles with enclosing window value and context dependencies", () => {
    const result = normalize(
      plan(
        [
          read("read", "db.source"),
          {
            id: "project",
            type: "project",
            source: "read",
            span,
            provenance: "extracted",
            output_columns: ["rolling_sum"],
            expressions: [
              expression(
                "rolling_sum",
                "function",
                [column("db.source", "a"), column("db.source", "b")],
                {
                  expression_facts: {
                    operators: [],
                    literals: [],
                    functions: ["SUM", "COALESCE"],
                    predicates: [],
                    comparisons: [],
                  },
                  expression_roles: [
                    {
                      operator: "COALESCE",
                      role: "COALESCE_ARGUMENT",
                      effects: ["VALUE_CONTRIBUTION", "BRANCH_SELECTION"],
                      path: "root.arg[0].arg[0]",
                      ordinal: 0,
                      expression_text: "a",
                      display_text: "a",
                      span,
                      input_columns: [column("db.source", "a")],
                    },
                    {
                      operator: "COALESCE",
                      role: "COALESCE_ARGUMENT",
                      effects: ["VALUE_CONTRIBUTION", "BRANCH_SELECTION"],
                      path: "root.arg[0].arg[1]",
                      ordinal: 1,
                      expression_text: "b",
                      display_text: "b",
                      span,
                      input_columns: [column("db.source", "b")],
                    },
                  ],
                  window_spec: {
                    source_span: span,
                    expression_text:
                      "OVER (PARTITION BY k ORDER BY ts ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)",
                    display_text: "window",
                    input_bindings: [
                      {
                        role: "VALUE",
                        ordinal: 0,
                        expression_text: "SUM(COALESCE(a,b))",
                        display_text: "SUM(COALESCE(a,b))",
                        span,
                        input_columns: [
                          column("db.source", "a"),
                          column("db.source", "b"),
                        ],
                      },
                      {
                        role: "WINDOW_PARTITION",
                        ordinal: 0,
                        expression_text: "k",
                        display_text: "k",
                        span,
                        input_columns: [column("db.source", "g")],
                      },
                      {
                        role: "WINDOW_ORDER",
                        ordinal: 0,
                        expression_text: "ts",
                        display_text: "ts",
                        span,
                        input_columns: [column("db.source", "a")],
                      },
                    ],
                    frame: {
                      status: "EXTRACTED",
                      expression_text: "1 PRECEDING",
                      display_text: "1 PRECEDING",
                      span,
                      input_columns: [column("db.source", "g")],
                    },
                  },
                },
                "SUM(COALESCE(a,b)) OVER (...) ",
              ),
            ],
          },
        ],
        ["project"],
      ),
      "target:rolling_sum",
      "rolling_sum",
      "project",
    );

    expect(variants(result)).toContain("PROJECT:COALESCE:BRANCH_SELECTOR");
    expect(variants(result)).toContain("PROJECT:COALESCE:BRANCH_VALUE");
    expect(variants(result)).toContain("WINDOW:WINDOW_VALUE:WINDOW_INPUT");
    expect(variants(result)).toContain(
      "WINDOW:WINDOW_PARTITION_BY:PARTITION_KEY",
    );
    expect(variants(result)).toContain("WINDOW:WINDOW_ORDER_BY:ORDER_KEY");
    expect(variants(result)).toContain("WINDOW:WINDOW_FRAME:FRAME_BOUND");
    expect(result.gaps).toHaveLength(0);
  });
});
