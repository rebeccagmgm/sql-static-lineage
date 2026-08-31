import { describe, expect, it } from "vitest";

import type {
  ColumnRef,
  ExprSpec,
  PlanFacts,
  PlanRelation,
  PredicateTree,
  SourceSpan,
  StructuredExpression,
} from "../../scripts/plans/plan-contract.ts";
import type { DifferentialMappingRef } from "../../scripts/calcite-differential/calcite-rel-boundary.ts";
import {
  projectPlanFactsCore,
  type PlanFactsCoreProjectionResult,
} from "../../scripts/calcite-differential/plan-facts-rel-projector.ts";
import { projectDifferentialSchema } from "../../scripts/calcite-differential/schema-type-projection.ts";
import type {
  RelTypedExpression,
  PlanFactsRelNode,
} from "../../scripts/calcite-differential/calcite-rel-boundary.ts";

const span: SourceSpan = { start: 0, end: 80 };
const taskId = "task-core-projection";
const statementId = "statement-0";

function column(
  name: string,
  table = "pdata_n.orders",
  clause: ColumnRef["clause"] = "projection",
  qualifier = "o",
): ColumnRef {
  return {
    name,
    qualifier,
    clause,
    physical: [{ table, column: name }],
    resolution: "PHYSICAL",
  };
}

function joinRelation(
  id: string,
  left: string,
  right: string,
  conditionTree: PredicateTree,
): Extract<PlanRelation, { type: "join" }> {
  return {
    id,
    type: "join",
    span,
    provenance: "extracted",
    output_columns: ["order_id", "amount", "order_id", "amount"],
    scope_id: "root",
    join_type: "left",
    left,
    right,
    condition_expr: "a.order_id = b.order_id",
    condition_display: "a.order_id = b.order_id",
    condition_columns: [
      column("order_id", "pdata_n.orders", "join", "a"),
      column("order_id", "pdata_n.orders", "join", "b"),
    ],
    condition_tree: conditionTree,
  };
}

function expression(
  output: string,
  exprKind: string,
  inputColumns: readonly ColumnRef[] = [],
  extra: Partial<ExprSpec> = {},
): ExprSpec {
  return {
    output,
    expr_kind: exprKind,
    expr_text: exprKind,
    display_text: exprKind,
    span,
    input_columns: [...inputColumns],
    ...extra,
  };
}

function readRelation(
  id: string,
  table = "orders",
  occurrenceId = `${id}:occurrence`,
  binding = "o",
): Extract<PlanRelation, { type: "read" }> {
  return {
    id,
    type: "read",
    span,
    provenance: "extracted",
    output_columns: ["order_id", "amount"],
    read_occurrence_id: occurrenceId,
    read_occurrence: {
      occurrence_id: occurrenceId,
      relation_id: id,
      scope_id: "root",
      source_span: span,
    },
    table,
    binding,
    columns: ["order_id", "amount"],
    scope_id: "root",
  };
}

function filterRelation(
  id: string,
  source: string,
  predicateTree: PredicateTree,
): Extract<PlanRelation, { type: "filter" }> {
  return {
    id,
    type: "filter",
    span,
    provenance: "extracted",
    output_columns: ["order_id", "amount"],
    source,
    scope_id: "root",
    clause: "where",
    predicate_expr: "o.amount > 0",
    predicate_display: "o.amount > 0",
    predicate_columns: [column("amount", "pdata_n.orders", "where")],
    predicate_tree: predicateTree,
  };
}

function projectRelation(
  id: string,
  source: string,
  expressions: readonly ExprSpec[],
  scopeId = "root",
): Extract<PlanRelation, { type: "project" }> {
  return {
    id,
    type: "project",
    span,
    provenance: "extracted",
    output_columns: expressions.map((item) => item.output),
    source,
    scope_id: scopeId,
    expressions: [...expressions],
  };
}

function plan(
  relations: readonly PlanRelation[],
  roots: readonly string[],
): PlanFacts {
  return {
    meta: {
      contract_version: "1.4.0",
      adapter_version: "core-projection-fixture",
      parser: { engine: "fixture", version: "1" },
      dialect: "hive",
      statement_index: 0,
      generated_at: "2026-08-28T00:00:00.000Z",
    },
    relations: [...relations],
    roots: [...roots],
    physical_inputs: ["orders"],
    unknowns: [],
    lineage_hops: { roots: [], nodes: [], edges: [] },
  };
}

function schemaProjection() {
  return projectDifferentialSchema({
    dialect: "HIVE",
    tables: [
      {
        schema: "pdata_n",
        name: "orders",
        evidenceRefs: ["evidence:schema:orders"],
        columns: [
          {
            name: "order_id",
            type: "BIGINT",
            nullable: false,
            evidenceRefs: ["evidence:schema:orders:order_id"],
          },
          {
            name: "amount",
            type: "DECIMAL(18,2)",
            nullable: true,
            evidenceRefs: ["evidence:schema:orders:amount"],
          },
        ],
      },
    ],
  });
}

function coreInput(
  facts: PlanFacts,
  outputTypes: readonly {
    relationId: string;
    ordinal: number;
    type: {
      status: "CONCRETE";
      name: string;
      nullable: boolean;
      precision?: number;
      scale?: number;
    };
    evidenceRefs: readonly string[];
    nativeFieldId?: string;
  }[] = [],
  projectedSchema = schemaProjection(),
) {
  return {
    taskId,
    statementId,
    planFacts: facts,
    schemaProjection: projectedSchema,
    outputTypes,
    relationEvidenceRefs: {
      "read.orders": ["evidence:relation:read"],
      "filter.orders": ["evidence:relation:filter"],
      "project.orders": ["evidence:relation:project"],
      "project.function": ["evidence:relation:function"],
      "project.binary": ["evidence:relation:binary"],
      "project.case": ["evidence:relation:case"],
      "project.if": ["evidence:relation:if"],
      "project.coalesce": ["evidence:relation:coalesce"],
      "read.left": ["evidence:relation:left"],
      "read.right": ["evidence:relation:right"],
      "read.tot": ["evidence:relation:tot"],
      "read.rood": ["evidence:relation:rood"],
      "join.orders": ["evidence:relation:join"],
      "join.semi": ["evidence:relation:join-semi"],
      "join.anti": ["evidence:relation:join-anti"],
      "join.derived": ["evidence:relation:derived-join"],
      "project.tot": ["evidence:relation:derived-tot"],
      "project.rood": ["evidence:relation:derived-rood"],
      "aggregate.orders": ["evidence:relation:aggregate"],
      "setop.orders": ["evidence:relation:setop"],
    },
    expressionEvidenceRefs: {
      "filter.orders:predicate": ["evidence:predicate:amount"],
      "project.orders:project:0": ["evidence:expression:order_id"],
      "project.orders:project:1": ["evidence:expression:amount"],
      "project.function:project:0": ["evidence:expression:function"],
      "project.binary:project:0": ["evidence:expression:binary"],
      "project.case:project:0": ["evidence:expression:case"],
      "project.if:project:0": ["evidence:expression:if"],
      "project.coalesce:project:0": ["evidence:expression:coalesce"],
      "project.tot:project:0": ["evidence:expression:derived-tot"],
      "project.rood:project:0": ["evidence:expression:derived-rood"],
      "aggregate.orders:aggregate:0": ["evidence:expression:aggregate"],
      "aggregate.orders:aggregate:1": ["evidence:expression:count-star"],
    },
    defaultSchema: "pdata_n",
  };
}

function coreProjection(
  facts: PlanFacts,
  outputTypes: Parameters<typeof coreInput>[1] = [],
): PlanFactsCoreProjectionResult {
  return projectPlanFactsCore(coreInput(facts, outputTypes));
}

function typedOutput(
  relationId: string,
  ordinal: number,
  name: string,
): NonNullable<Parameters<typeof coreInput>[1]>[number] {
  return {
    relationId,
    ordinal,
    type:
      name === "order_id"
        ? { status: "CONCRETE", name: "BIGINT", nullable: false }
        : {
            status: "CONCRETE",
            name: "DECIMAL",
            precision: 18,
            scale: 2,
            nullable: true,
          },
    evidenceRefs: [`evidence:output:${relationId}:${ordinal}`],
    nativeFieldId: `native:${relationId}:${name}`,
  };
}

function collectExpressions(
  expression: RelTypedExpression,
): RelTypedExpression[] {
  switch (expression.kind) {
    case "CALL":
      return [expression, ...expression.operands.flatMap(collectExpressions)];
    case "CAST":
      return [expression, ...collectExpressions(expression.operand)];
    case "CASE":
      return [
        expression,
        ...(expression.subject ? collectExpressions(expression.subject) : []),
        ...expression.branches.flatMap((branch) => [
          ...collectExpressions(branch.selector),
          ...collectExpressions(branch.result),
        ]),
        ...(expression.elseResult
          ? collectExpressions(expression.elseResult)
          : []),
      ];
    default:
      return [expression];
  }
}

function collectMappedObjects(
  nodes: readonly PlanFactsRelNode[],
): Array<{ mappingId: string; evidenceRefs: readonly string[] }> {
  return nodes.flatMap((node) => [
    node,
    ...node.outputFields,
    ...(node.kind === "PROJECT"
      ? node.expressions.flatMap(collectExpressions)
      : node.kind === "FILTER"
        ? collectExpressions(node.predicate)
        : []),
  ]);
}

describe("Plan Facts core relational projection", () => {
  it("projects read/filter/project with the default Hive schema and preserves the request contract", () => {
    const predicateTree: PredicateTree = {
      kind: "ATOM",
      operator: "GT",
      span,
      operands: [
        {
          kind: "COLUMN",
          expression: "o.amount",
          column: column("amount", "pdata_n.orders", "where"),
        },
        { kind: "LITERAL", expression: "0", observedValue: "0" },
      ],
    };
    const facts = plan(
      [
        readRelation("read.orders"),
        filterRelation("filter.orders", "read.orders", predicateTree),
        projectRelation("project.orders", "filter.orders", [
          expression("order_id", "column", [column("order_id")]),
          expression("amount", "column", [column("amount")]),
        ]),
      ],
      ["project.orders"],
    );

    const result = coreProjection(facts, [
      typedOutput("project.orders", 0, "order_id"),
      typedOutput("project.orders", 1, "amount"),
    ]);

    expect(result.status).toBe("SUCCESS");
    expect(result.issues).toEqual([]);
    expect(result.graph?.rootNodeIds).toEqual(["project.orders"]);
    expect(result.graph?.nodes.map((node) => node.kind)).toEqual([
      "READ",
      "FILTER",
      "PROJECT",
    ]);
    const read = result.graph?.nodes.find((node) => node.kind === "READ");
    expect(read?.kind === "READ" ? read.table : undefined).toEqual({
      schema: "pdata_n",
      name: "orders",
    });
    expect(result.request).not.toBeNull();
    expect(result.request?.requestKind).toBe("PLAN_FACTS_REL_V1");
    expect(result.request?.relations).toEqual(result.graph?.nodes);
    expect(result.request?.roots).toEqual(result.graph?.rootNodeIds);
  });

  it("keeps duplicate physical table occurrences isolated across multiple root reads", () => {
    const facts = plan(
      [
        readRelation("read.left", "orders", "occurrence:left"),
        readRelation("read.right", "orders", "occurrence:right"),
      ],
      ["read.left", "read.right"],
    );

    const result = coreProjection(facts);

    expect(result.status).toBe("SUCCESS");
    const reads = (result.graph?.nodes ?? []).filter(
      (node): node is Extract<PlanFactsRelNode, { kind: "READ" }> =>
        node.kind === "READ",
    );
    expect(reads.map((node) => node.nativeRelationOccurrenceId)).toEqual([
      "occurrence:left",
      "occurrence:right",
    ]);
    expect(reads[0]?.table).toEqual(reads[1]?.table);
    expect(reads[0]?.mappingId).not.toBe(reads[1]?.mappingId);
    expect(
      reads.map(
        (node) =>
          result.mappings.find(
            (mapping) => mapping.mappingId === node.outputFields[0]?.mappingId,
          )?.nativeRelationOccurrenceId,
      ),
    ).toEqual(["occurrence:left", "occurrence:right"]);
  });

  it("carries an exact catalog physical identity into read field mappings", () => {
    const projectedSchema = projectDifferentialSchema({
      dialect: "HIVE",
      tables: [
        {
          schema: "pdata_n",
          name: "orders",
          physicalTableIdentity: {
            platform: "hive",
            dataSource: "gfhive",
            stableTableId: "orders-table-id",
            qualifiedName: "pdata_n.orders",
          },
          evidenceRefs: ["evidence:schema:orders"],
          columns: [
            {
              name: "order_id",
              type: "BIGINT",
              nullable: false,
              evidenceRefs: ["evidence:schema:orders:order_id"],
            },
            {
              name: "amount",
              type: "DECIMAL(18,2)",
              nullable: true,
              evidenceRefs: ["evidence:schema:orders:amount"],
            },
          ],
        },
      ],
    });
    const result = projectPlanFactsCore(coreInput(
      plan([readRelation("read.orders", "pdata_n.orders", "occurrence:orders")], ["read.orders"]),
      [],
      projectedSchema,
    ));
    const read = result.graph?.nodes.find((node) => node.kind === "READ");
    expect(result.status).toBe("SUCCESS");
    expect(read?.outputFields[0]?.nativeFieldId).toBe(
      "hive|gfhive|orders-table-id|pdata_n.orders|order_id",
    );
  });

  it("projects a qualified JOIN condition without collapsing the two read occurrences", () => {
    const predicateTree: PredicateTree = {
      kind: "ATOM",
      operator: "EQ",
      span,
      operands: [
        {
          kind: "COLUMN",
          expression: "a.order_id",
          column: column("order_id", "pdata_n.orders", "join", "a"),
        },
        {
          kind: "COLUMN",
          expression: "b.order_id",
          column: column("order_id", "pdata_n.orders", "join", "b"),
        },
      ],
    };
    const facts = plan(
      [
        readRelation("read.left", "orders", "occurrence:left", "a"),
        readRelation("read.right", "orders", "occurrence:right", "b"),
        joinRelation("join.orders", "read.left", "read.right", predicateTree),
      ],
      ["join.orders"],
    );

    const result = coreProjection(facts);

    expect(result.status).toBe("SUCCESS");
    expect(result.issues).toEqual([]);
    const join = result.graph?.nodes.find((node) => node.kind === "JOIN");
    expect(join?.kind).toBe("JOIN");
    expect(join?.kind === "JOIN" ? join.joinType : undefined).toBe("LEFT");
    expect(join?.kind === "JOIN" ? join.condition : undefined).toMatchObject({
      kind: "CALL",
      operator: "EQ",
      operands: [
        { kind: "FIELD_REF", inputOrdinal: 0, sourceBinding: "a" },
        { kind: "FIELD_REF", inputOrdinal: 0, sourceBinding: "b" },
      ],
    });
  });

  it("keeps SEMI and ANTI join output ordinals on the left input", () => {
    const predicateTree: PredicateTree = {
      kind: "ATOM",
      operator: "EQ",
      span,
      operands: [
        {
          kind: "COLUMN",
          expression: "a.order_id",
          column: column("order_id", "pdata_n.orders", "join", "a"),
        },
        {
          kind: "COLUMN",
          expression: "b.order_id",
          column: column("order_id", "pdata_n.orders", "join", "b"),
        },
      ],
    };
    for (const joinType of ["semi", "anti"] as const) {
      const join = joinRelation(
        `join.${joinType}`,
        "read.left",
        "read.right",
        predicateTree,
      );
      join.join_type = joinType;
      const result = coreProjection(plan([
        readRelation("read.left", "orders", `occurrence:${joinType}:left`, "a"),
        readRelation("read.right", "orders", `occurrence:${joinType}:right`, "b"),
        join,
      ], [join.id]));

      expect(result.status).toBe("SUCCESS");
      const projected = result.graph?.nodes.find((node) => node.nodeId === join.id);
      expect(projected?.kind).toBe("JOIN");
      expect(projected?.kind === "JOIN" ? projected.joinType : undefined)
        .toBe(joinType.toUpperCase());
      expect(projected?.outputFields).toHaveLength(2);
      expect(projected?.outputFields.map((field) => field.sourceBinding))
        .toEqual(["a", "a"]);
    }
  });

  it("projects BETWEEN with the column type carried to both bounds", () => {
    const predicateTree: PredicateTree = {
      kind: "ATOM",
      operator: "BETWEEN",
      span,
      operands: [
        {
          kind: "COLUMN",
          expression: "o.amount",
          column: column("amount", "pdata_n.orders", "where", "o"),
        },
        { kind: "LITERAL", expression: "0", observedValue: "0" },
        { kind: "LITERAL", expression: "100", observedValue: "100" },
      ],
    };
    const result = coreProjection(plan([
      readRelation("read.orders"),
      filterRelation("filter.orders", "read.orders", predicateTree),
    ], ["filter.orders"]));

    expect(result.status).toBe("SUCCESS");
    const filter = result.graph?.nodes.find((node) => node.kind === "FILTER");
    expect(filter?.kind).toBe("FILTER");
    expect(filter?.kind === "FILTER" ? filter.predicate : undefined).toMatchObject({
      operator: "BETWEEN",
      operands: [
        { kind: "FIELD_REF", inputOrdinal: 1 },
        { kind: "LITERAL", type: { name: "DECIMAL", precision: 18, scale: 2 } },
        { kind: "LITERAL", type: { name: "DECIMAL", precision: 18, scale: 2 } },
      ],
    });
  });

  it("preserves a derived-scope alias on projected JOIN inputs", () => {
    const predicateTree: PredicateTree = {
      kind: "ATOM",
      operator: "EQ",
      span,
      operands: [
        {
          kind: "COLUMN",
          expression: "tot.order_id",
          column: column("order_id", "pdata_n.orders", "join", "tot"),
        },
        {
          kind: "COLUMN",
          expression: "rood.order_id",
          column: column("order_id", "pdata_n.orders", "join", "rood"),
        },
      ],
    };
    const facts = plan(
      [
        readRelation("read.tot", "orders", "occurrence:tot", "orders"),
        readRelation("read.rood", "orders", "occurrence:rood", "orders"),
        projectRelation("project.tot", "read.tot", [expression("order_id", "column", [column("order_id", "pdata_n.orders", "projection", "orders")])], "root.tot"),
        projectRelation("project.rood", "read.rood", [expression("order_id", "column", [column("order_id", "pdata_n.orders", "projection", "orders")])], "root.rood"),
        joinRelation("join.derived", "project.tot", "project.rood", predicateTree),
      ],
      ["join.derived"],
    );

    const result = coreProjection(facts, [
      typedOutput("project.tot", 0, "order_id"),
      typedOutput("project.rood", 0, "order_id"),
    ]);
    expect(result.status).toBe("SUCCESS");
    const join = result.graph?.nodes.find((node) => node.kind === "JOIN");
    expect(join?.kind === "JOIN" ? join.condition : undefined).toMatchObject({
      kind: "CALL",
      operator: "EQ",
      operands: [
        { kind: "FIELD_REF", sourceBinding: "tot" },
        { kind: "FIELD_REF", sourceBinding: "rood" },
      ],
    });
  });

  it("projects a typed GROUP BY aggregate and COUNT(*) without SQL reconstruction", () => {
    const measure: ExprSpec = {
      output: "total_amount",
      expr_kind: "function",
      aggregate: true,
      expr_text: "SUM(o.amount)",
      display_text: "SUM(o.amount)",
      span,
      input_columns: [column("amount", "pdata_n.orders", "projection", "o")],
      expression_facts: {
        operators: [],
        literals: [],
        functions: ["SUM"],
        predicates: [],
        comparisons: [],
      },
    };
    const countStar: ExprSpec = {
      output: "row_count",
      expr_kind: "function",
      aggregate: true,
      expr_text: "COUNT(*)",
      display_text: "COUNT(*)",
      span,
      input_columns: [],
      expression_facts: {
        operators: [],
        literals: [],
        functions: ["COUNT"],
        predicates: [],
        comparisons: [],
      },
    };
    const facts = plan(
      [
        readRelation("read.orders", "orders", "occurrence:aggregate", "o"),
        {
          id: "aggregate.orders",
          type: "aggregate",
          span,
          provenance: "extracted",
          output_columns: ["order_id", "total_amount", "row_count"],
          source: "read.orders",
          scope_id: "root",
          group_by: [column("order_id", "pdata_n.orders", "groupBy", "o")],
          group_by_exprs: ["o.order_id"],
          group_by_exprs_display: ["o.order_id"],
          measures: [measure, countStar],
        },
      ],
      ["aggregate.orders"],
    );
    const result = coreProjection(facts, [
      typedOutput("aggregate.orders", 0, "order_id"),
      typedOutput("aggregate.orders", 1, "total_amount"),
      typedOutput("aggregate.orders", 2, "row_count"),
    ]);

    expect(result.status).toBe("SUCCESS");
    const aggregate = result.graph?.nodes.find((node) => node.kind === "AGGREGATE");
    expect(aggregate?.kind).toBe("AGGREGATE");
    expect(aggregate?.kind === "AGGREGATE" ? aggregate.groupKeys : undefined).toHaveLength(1);
    expect(aggregate?.kind === "AGGREGATE" ? aggregate.measures : undefined).toMatchObject([
      { kind: "CALL", operator: "SUM", operands: [{ kind: "FIELD_REF", inputOrdinal: 1 }] },
      { kind: "CALL", operator: "COUNT", operands: [] },
    ]);
  });

  it("projects CASE, IF, and COALESCE as typed structured expressions", () => {
    const amount: Extract<StructuredExpression, { kind: "COLUMN" }> = {
      kind: "COLUMN",
      name: "amount",
      qualifier: "o",
    };
    const positive: Extract<StructuredExpression, { kind: "BINARY" }> = {
      kind: "BINARY",
      op: ">",
      left: amount,
      right: { kind: "LITERAL", text: "0" },
    };
    const zero = { kind: "LITERAL", text: "0" } as const;
    const facts = plan(
      [
        readRelation("read.orders"),
        projectRelation(
          "project.case",
          "read.orders",
          [expression("amount_case", "case", [column("amount")], {
            structured_expression: {
              kind: "CASE",
              whens: [{ when: positive, then: amount }],
              elseExpr: zero,
            },
          })],
        ),
        projectRelation(
          "project.if",
          "read.orders",
          [expression("amount_if", "function", [column("amount")], {
            structured_expression: {
              kind: "FUNCTION",
              name: "IF",
              args: [positive, amount, zero],
            },
          })],
        ),
        projectRelation(
          "project.coalesce",
          "read.orders",
          [expression("amount_coalesce", "function", [column("amount")], {
            structured_expression: {
              kind: "FUNCTION",
              name: "COALESCE",
              args: [amount, zero],
            },
          })],
        ),
      ],
      ["project.case", "project.if", "project.coalesce"],
    );
    const result = coreProjection(facts, [
      typedOutput("project.case", 0, "amount_case"),
      typedOutput("project.if", 0, "amount_if"),
      typedOutput("project.coalesce", 0, "amount_coalesce"),
    ]);

    expect(result.status).toBe("SUCCESS");
    expect(result.issues).toEqual([]);
    const nodes = result.graph?.nodes.filter((node) => node.kind === "PROJECT") ?? [];
    expect(nodes.map((node) => node.kind === "PROJECT" ? node.expressions[0]?.kind : undefined))
      .toEqual(["CASE", "CALL", "CALL"]);
    expect(nodes.find((node) => node.nodeId === "project.if")?.kind === "PROJECT"
      ? nodes.find((node) => node.nodeId === "project.if")?.expressions[0]
      : undefined).toMatchObject({ kind: "CALL", operator: "IF" });
    expect(nodes.find((node) => node.nodeId === "project.coalesce")?.kind === "PROJECT"
      ? nodes.find((node) => node.nodeId === "project.coalesce")?.expressions[0]
      : undefined).toMatchObject({ kind: "CALL", operator: "COALESCE" });
  });

  it("projects UNION ALL by exact branch ordinal and preserves branch evidence", () => {
    const facts = plan(
      [
        readRelation("read.left", "orders", "occurrence:setop-left", "a"),
        readRelation("read.right", "orders", "occurrence:setop-right", "b"),
        {
          id: "setop.orders",
          type: "setop",
          span,
          provenance: "extracted",
          output_columns: ["order_id", "amount"],
          scope_id: "root",
          setop: "union",
          all: true,
          by_name: false,
          branches: ["read.left", "read.right"],
        },
      ],
      ["setop.orders"],
    );

    const result = coreProjection(facts);

    expect(result.status).toBe("SUCCESS");
    const setop = result.graph?.nodes.find((node) => node.kind === "SETOP");
    expect(setop?.kind === "SETOP" ? setop.operation : undefined).toBe("UNION");
    expect(setop?.kind === "SETOP" ? setop.all : undefined).toBe(true);
    expect(setop?.outputFields[0]?.evidenceRefs).toEqual(
      expect.arrayContaining(["evidence:relation:setop", "evidence:relation:left"]),
    );
  });

  it("keeps every graph mapping/evidence reference round-trippable to the request", () => {
    const facts = plan([readRelation("read.orders")], ["read.orders"]);
    const result = coreProjection(facts);

    expect(result.status).toBe("SUCCESS");
    const mappings = new Map<string, DifferentialMappingRef>(
      result.request!.mappings.map((mapping) => [mapping.mappingId, mapping]),
    );
    for (const object of collectMappedObjects(result.graph!.nodes)) {
      const mapping = mappings.get(object.mappingId);
      expect(mapping).toBeDefined();
      expect(mapping?.evidenceRefs).toEqual(object.evidenceRefs);
    }
    expect(
      result.request!.mappings.every(
        (mapping) => mapping.evidenceRefs.length > 0,
      ),
    ).toBe(true);
  });

  it("fails closed when a project output has no explicit concrete type", () => {
    const facts = plan(
      [
        readRelation("read.orders"),
        projectRelation("project.orders", "read.orders", [
          expression("order_id", "column", [column("order_id")]),
        ]),
      ],
      ["project.orders"],
    );

    const result = coreProjection(facts);

    expect(result.status).toBe("PARTIAL");
    expect(result.request).toBeNull();
    expect(result.graph?.rootNodeIds).toEqual([]);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "OUTPUT_TYPE_MISSING",
          nativeRelationId: "project.orders",
        }),
      ]),
    );
  });

  it.each([
    ["function", "upper(o.order_id)", "project.function"],
    ["binary", "o.amount + 1", "project.binary"],
  ] as const)(
    "does not reconstruct %s expressions from SQL text",
    (exprKind, exprText, projectId) => {
      const facts = plan(
        [
          readRelation("read.orders"),
          projectRelation(projectId, "read.orders", [
            expression("derived_value", exprKind, [column("order_id")], {
              expr_text: exprText,
              display_text: exprText,
              expression_facts: {
                operators: exprKind === "binary" ? ["+"] : [],
                literals: exprKind === "binary" ? ["1"] : [],
                functions: exprKind === "function" ? ["upper"] : [],
                predicates: [],
                comparisons: [],
              },
            }),
          ]),
        ],
        [projectId],
      );

      const result = projectPlanFactsCore({
        ...coreInput(facts, [
          {
            relationId: projectId,
            ordinal: 0,
            type: { status: "CONCRETE", name: "VARCHAR", nullable: true },
            evidenceRefs: [`evidence:output:${projectId}:0`],
          },
        ]),
      });

      expect(result.status).toBe("PARTIAL");
      expect(result.request).toBeNull();
      expect(result.graph?.nodes.some((node) => node.kind === "PROJECT")).toBe(
        false,
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "PROJECT_EXPRESSION_STRUCTURE_UNSUPPORTED",
            nativeRelationId: projectId,
            expressionId: `${projectId}:project:0`,
            message: expect.stringContaining("SQL text fallback is forbidden"),
          }),
        ]),
      );
    },
  );
});
