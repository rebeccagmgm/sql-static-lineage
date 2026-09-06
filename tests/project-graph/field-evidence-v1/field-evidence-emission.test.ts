import { describe, expect, it } from "vitest";

import {
  buildFieldEvidenceIndexes,
  emitFieldEvidenceForInput,
  expressionAcceptsSourceField,
} from "../../../scripts/project-graph/field-evidence-v1/field-evidence-emission.ts";
import type { PhysicalFieldIdentity } from "../../../scripts/reconcile/consumer/field-lineage/field-lineage-contract.ts";

function field(qualifiedName: string, column: string): PhysicalFieldIdentity {
  return {
    platform: "hive",
    dataSource: "gfhive",
    stableTableId: `table:${qualifiedName}`,
    qualifiedName,
    column,
    identityStatus: "SCHEMA_BACKED",
  };
}

function resolveFastDerivedFixture(
  rawExpressions: readonly Readonly<Record<string, unknown>>[],
) {
  const relationNodes = [
    {
      relation_id: "rel:root.project",
      relation_type: "project",
      relation: { type: "project", scope_id: "root", expressions: rawExpressions },
    },
    { relation_id: "rel:root.join", relation_type: "join", relation: { type: "join", scope_id: "root" } },
    { relation_id: "rel:root.np.project", relation_type: "project", relation: { type: "project", scope_id: "root.np" } },
    { relation_id: "rel:root.np.read.pos", relation_type: "read", relation: { type: "read", table: "demo.fast_pos", binding: "pos", scope_id: "root.np" } },
    { relation_id: "rel:root.dy.project", relation_type: "project", relation: { type: "project", scope_id: "root.dy" } },
    { relation_id: "rel:root.dy.dy.project", relation_type: "project", relation: { type: "project", scope_id: "root.dy.dy" } },
    { relation_id: "rel:root.dy.dy.read.pos", relation_type: "read", relation: { type: "read", table: "demo.fast_pos", binding: "pos", scope_id: "root.dy.dy" } },
  ];
  const expression = {
    expression_id: "expr:fast-dyna-negative",
    relation_id: "rel:root.project",
    ordinal: 26,
    output_name: "Dyna_Nom_Prin",
    expression_text: "coalesce(np.Dyna_Nom_Prin, '0') as Dyna_Nom_Prin",
    input_fields: [{ table: "demo.fast_pos", column: "dynamic_notional" }],
  };
  const indexes = buildFieldEvidenceIndexes({
    taskId: "220650",
    expressions: [expression],
    relationNodes,
    relationEdges: [
      { from_relation_id: "rel:root.join", to_relation_id: "rel:root.project" },
      { from_relation_id: "rel:root.np.project", to_relation_id: "rel:root.join" },
      { from_relation_id: "rel:root.dy.project", to_relation_id: "rel:root.join" },
      { from_relation_id: "rel:root.dy.dy.project", to_relation_id: "rel:root.dy.project" },
      { from_relation_id: "rel:root.np.read.pos", to_relation_id: "rel:root.np.project" },
      { from_relation_id: "rel:root.dy.dy.read.pos", to_relation_id: "rel:root.dy.dy.project" },
    ],
    datasetIoReads: [{
      direction: "READ",
      read_occurrences: [
        { relation_id: "rel:root.np.read.pos", occurrence_id: "occ:np" },
        { relation_id: "rel:root.dy.dy.read.pos", occurrence_id: "occ:dy" },
      ],
    }],
  });
  return emitFieldEvidenceForInput({
    taskId: "220650",
    expression,
    sourceField: field("demo.fast_pos", "dynamic_notional"),
    inputField: { table: "demo.fast_pos", column: "dynamic_notional" },
    expanded: {
      field: field("demo.fast_pos", "dynamic_notional"),
      materializationBridgeIds: [],
      leafExpressionId: expression.expression_id,
      leafRelationId: "rel:root.project",
      pathHadAggregation: false,
      subtypeHops: [],
    },
    indexes,
  })[0]!.sourceResolution;
}

describe("field-evidence emission branch scoping", () => {
  it("rejects sources absent from the branch expression input_fields", () => {
    const branch = {
      expression_id: "expr:b1",
      relation_id: "rel:b1.project",
      ordinal: 0,
      expression_text: "m.vega as vega",
      input_fields: [{ table: "demo.hold", column: "vega" }],
    };
    expect(expressionAcceptsSourceField(branch, field("demo.hold", "vega"))).toBe(true);
    expect(expressionAcceptsSourceField(branch, field("demo.opt", "vega"))).toBe(false);
    expect(expressionAcceptsSourceField({
      ...branch,
      input_fields: [],
    }, field("demo.hold", "vega"))).toBe(false);
  });

  it("emits only branch-local sources after setop ordinal sink", () => {
    const relationNodes = [
      {
        relation_id: "rel:root.project",
        relation_type: "project",
        relation: { type: "project" },
      },
      {
        relation_id: "rel:setop",
        relation_type: "setop",
        relation: {
          type: "setop",
          branches: ["rel:b0.project", "rel:b1.project"],
        },
      },
      { relation_id: "rel:b0.project", relation_type: "project", relation: { type: "project" } },
      { relation_id: "rel:b1.project", relation_type: "project", relation: { type: "project" } },
      {
        relation_id: "rel:b0.read.opt",
        relation_type: "read",
        relation: { type: "read", table: "demo.opt", binding: "opt" },
      },
      {
        relation_id: "rel:b1.read.hold",
        relation_type: "read",
        relation: { type: "read", table: "demo.hold", binding: "m" },
      },
    ];
    const relationEdges = [
      { from_relation_id: "rel:setop", to_relation_id: "rel:root.project" },
      { from_relation_id: "rel:b0.project", to_relation_id: "rel:setop" },
      { from_relation_id: "rel:b1.project", to_relation_id: "rel:setop" },
      { from_relation_id: "rel:b0.read.opt", to_relation_id: "rel:b0.project" },
      { from_relation_id: "rel:b1.read.hold", to_relation_id: "rel:b1.project" },
    ];
    const expressions = [
      {
        expression_id: "expr:root",
        relation_id: "rel:root.project",
        ordinal: 0,
        expression_text: "vega",
        input_fields: [
          { table: "demo.opt", column: "vega" },
          { table: "demo.hold", column: "vega" },
        ],
      },
      {
        expression_id: "expr:b0",
        relation_id: "rel:b0.project",
        ordinal: 0,
        expression_text: "opt.vega",
        input_fields: [{ table: "demo.opt", column: "vega" }],
      },
      {
        expression_id: "expr:b1",
        relation_id: "rel:b1.project",
        ordinal: 0,
        expression_text: "m.vega",
        input_fields: [{ table: "demo.hold", column: "vega" }],
      },
    ];
    const indexes = buildFieldEvidenceIndexes({
      taskId: "t1",
      expressions,
      relationNodes,
      relationEdges,
      datasetIoReads: [
        {
          direction: "READ",
          read_occurrences: [
            { relation_id: "rel:b0.read.opt", occurrence_id: "occ:opt" },
            { relation_id: "rel:b1.read.hold", occurrence_id: "occ:hold" },
          ],
        },
      ],
    });

    const foreignOnB1 = emitFieldEvidenceForInput({
      taskId: "t1",
      expression: expressions[0]!,
      sourceField: field("demo.opt", "vega"),
      inputField: { table: "demo.opt", column: "vega" },
      expanded: {
        field: field("demo.opt", "vega"),
        materializationBridgeIds: [],
        leafExpressionId: "expr:root",
        leafRelationId: "rel:root.project",
        pathHadAggregation: false,
        subtypeHops: [],
      },
      indexes,
    });
    expect(foreignOnB1.map((item) => item.expressionContexts[0]?.expressionId)).toEqual([
      "expr:b0",
    ]);
    expect(foreignOnB1[0]?.sourceResolution.sourceReadOccurrenceStatus).toBe("RESOLVED");
    expect(foreignOnB1[0]?.sourceResolution.sourceRelationId).toBe("rel:b0.read.opt");

    const holdOnBranches = emitFieldEvidenceForInput({
      taskId: "t1",
      expression: expressions[0]!,
      sourceField: field("demo.hold", "vega"),
      inputField: { table: "demo.hold", column: "vega" },
      expanded: {
        field: field("demo.hold", "vega"),
        materializationBridgeIds: [],
        leafExpressionId: "expr:root",
        leafRelationId: "rel:root.project",
        pathHadAggregation: false,
        subtypeHops: [],
      },
      indexes,
    });
    expect(holdOnBranches.map((item) => item.expressionContexts[0]?.expressionId)).toEqual([
      "expr:b1",
    ]);
    expect(holdOnBranches[0]?.sourceResolution.sourceReadOccurrenceStatus).toBe("RESOLVED");
  });

  it("sinks a qualified setop output through an intervening join", () => {
    const relationNodes = [
      { relation_id: "rel:root.project", relation_type: "project", relation: { type: "project", scope_id: "root" } },
      {
        relation_id: "rel:root.join",
        relation_type: "join",
        relation: { type: "join", scope_id: "root" },
      },
      {
        relation_id: "rel:root.index.setop",
        relation_type: "setop",
        relation: {
          type: "setop",
          scope_id: "root.index",
          branches: ["rel:root.index.b0", "rel:root.index.b1"],
        },
      },
      { relation_id: "rel:root.grp", relation_type: "project", relation: { type: "project" } },
      { relation_id: "rel:root.index.b0", relation_type: "project", relation: { type: "project" } },
      { relation_id: "rel:root.index.b1", relation_type: "project", relation: { type: "project" } },
      {
        relation_id: "rel:root.index.b0.read.t98",
        relation_type: "read",
        relation: { type: "read", table: "demo.t98", binding: "a" },
      },
      {
        relation_id: "rel:root.index.b1.read.t98",
        relation_type: "read",
        relation: { type: "read", table: "demo.t98", binding: "a" },
      },
    ];
    const relationEdges = [
      { from_relation_id: "rel:root.join", to_relation_id: "rel:root.project" },
      { from_relation_id: "rel:root.index.setop", to_relation_id: "rel:root.join" },
      { from_relation_id: "rel:root.grp", to_relation_id: "rel:root.join" },
      { from_relation_id: "rel:root.index.b0", to_relation_id: "rel:root.index.setop" },
      { from_relation_id: "rel:root.index.b1", to_relation_id: "rel:root.index.setop" },
      { from_relation_id: "rel:root.index.b0.read.t98", to_relation_id: "rel:root.index.b0" },
      { from_relation_id: "rel:root.index.b1.read.t98", to_relation_id: "rel:root.index.b1" },
    ];
    const expressions = [
      {
        expression_id: "expr:root",
        relation_id: "rel:root.project",
        ordinal: 1,
        output_name: "index_val",
        expression_text: "index.index_val",
        input_fields: [{ table: "demo.t98", column: "dyna_nom_prin", qualifier: "index" }],
      },
      {
        expression_id: "expr:b0",
        relation_id: "rel:root.index.b0",
        ordinal: 2,
        output_name: "index_val",
        expression_text: "sum(a.dyna_nom_prin) as index_val",
        input_fields: [{ table: "demo.t98", column: "dyna_nom_prin", qualifier: "a" }],
      },
      {
        expression_id: "expr:b1",
        relation_id: "rel:root.index.b1",
        ordinal: 2,
        output_name: "index_val",
        expression_text: "sum(a.dyna_nom_prin) as index_val",
        input_fields: [{ table: "demo.t98", column: "dyna_nom_prin", qualifier: "a" }],
      },
    ];
    const indexes = buildFieldEvidenceIndexes({
      taskId: "t1",
      expressions,
      relationNodes,
      relationEdges,
      datasetIoReads: [{
        direction: "READ",
        read_occurrences: [
          { relation_id: "rel:root.index.b0.read.t98", occurrence_id: "occ:b0" },
          { relation_id: "rel:root.index.b1.read.t98", occurrence_id: "occ:b1" },
        ],
      }],
    });

    const emissions = emitFieldEvidenceForInput({
      taskId: "t1",
      expression: expressions[0]!,
      sourceField: field("demo.t98", "dyna_nom_prin"),
      inputField: { table: "demo.t98", column: "dyna_nom_prin", qualifier: "index" },
      expanded: {
        field: field("demo.t98", "dyna_nom_prin"),
        materializationBridgeIds: [],
        leafExpressionId: "expr:root",
        leafRelationId: "rel:root.project",
        pathHadAggregation: false,
        subtypeHops: [],
      },
      indexes,
    });

    expect(emissions.map((item) => item.expressionContexts[0]?.expressionId)).toEqual([
      "expr:b0",
      "expr:b1",
    ]);
    expect(emissions.map((item) => item.sourceResolution.sourceReadOccurrenceId)).toEqual([
      "occ:b0",
      "occ:b1",
    ]);
  });

  it("uses raw relation qualifier for TRS derived output inputs", () => {
    const relationNodes = [
      { relation_id: "rel:root.project", relation_type: "project", relation: {
        type: "project",
        scope_id: "root",
        expressions: [{
          output: "Dyna_Nom_Prin",
          expr_text: "coalesce(his_dy.Nom_Prin, 0) as Dyna_Nom_Prin",
          input_columns: [
            {
              name: "Dyna_Nom_Prin",
              physical: [{ table: "demo.pos", column: "init_price" }],
              qualifier: "his_dy",
              resolution: "PHYSICAL",
            },
            {
              name: "Dyna_Nom_Prin",
              physical: [{ table: "demo.pos", column: "quantity" }],
              qualifier: "his_dy",
              resolution: "PHYSICAL",
            },
          ],
        }],
      } },
      { relation_id: "rel:root.join", relation_type: "join", relation: { type: "join", scope_id: "root" } },
      { relation_id: "rel:root.his_ini.project", relation_type: "project", relation: { type: "project", scope_id: "root.his_ini" } },
      { relation_id: "rel:root.his_ini.read.pos", relation_type: "read", relation: { type: "read", table: "demo.pos", binding: "pos", scope_id: "root.his_ini" } },
      { relation_id: "rel:root.his_dy.project", relation_type: "project", relation: { type: "project", scope_id: "root.his_dy" } },
      { relation_id: "rel:root.his_dy.read.pos", relation_type: "read", relation: { type: "read", table: "demo.pos", binding: "pos", scope_id: "root.his_dy" } },
    ];
    const expression = {
      expression_id: "expr:trs-dyna",
      relation_id: "rel:root.project",
      ordinal: 26,
      output_name: "Dyna_Nom_Prin",
      expression_text: "coalesce(his_dy.Nom_Prin, 0) as Dyna_Nom_Prin",
      input_fields: [
        { table: "demo.pos", column: "init_price" },
        { table: "demo.pos", column: "quantity" },
      ],
    };
    const indexes = buildFieldEvidenceIndexes({
      taskId: "86841",
      expressions: [expression],
      relationNodes,
      relationEdges: [
        { from_relation_id: "rel:root.join", to_relation_id: "rel:root.project" },
        { from_relation_id: "rel:root.his_ini.project", to_relation_id: "rel:root.join" },
        { from_relation_id: "rel:root.his_dy.project", to_relation_id: "rel:root.join" },
        { from_relation_id: "rel:root.his_ini.read.pos", to_relation_id: "rel:root.his_ini.project" },
        { from_relation_id: "rel:root.his_dy.read.pos", to_relation_id: "rel:root.his_dy.project" },
      ],
      datasetIoReads: [{
        direction: "READ",
        read_occurrences: [
          { relation_id: "rel:root.his_ini.read.pos", occurrence_id: "occ:his-ini" },
          { relation_id: "rel:root.his_dy.read.pos", occurrence_id: "occ:his-dy" },
        ],
      }],
    });
    const emit = (column: string) => emitFieldEvidenceForInput({
      taskId: "86841",
      expression,
      sourceField: field("demo.pos", column),
      inputField: { table: "demo.pos", column },
      expanded: {
        field: field("demo.pos", column),
        materializationBridgeIds: [],
        leafExpressionId: expression.expression_id,
        leafRelationId: "rel:root.project",
        pathHadAggregation: false,
        subtypeHops: [],
      },
      indexes,
    });
    expect(emit("init_price")[0]?.sourceResolution.sourceReadOccurrenceId).toBe("occ:his-dy");
    expect(emit("quantity")[0]?.sourceResolution.sourceReadOccurrenceId).toBe("occ:his-dy");
  });

  it("keeps FAST np and dy derived outputs on separate reads", () => {
    const relationNodes = [
      { relation_id: "rel:root.project", relation_type: "project", relation: {
        type: "project",
        scope_id: "root",
        expressions: [
          {
            output: "Init_Nom_Prin",
            expr_text: "dy.Init_Nom_Prin",
            input_columns: [{
              name: "Init_Nom_Prin",
              physical: [{ table: "demo.fast_pos", column: "dynamic_notional" }],
              qualifier: "dy",
              resolution: "PHYSICAL",
            }],
          },
          {
            output: "Dyna_Nom_Prin",
            expr_text: "coalesce(np.Dyna_Nom_Prin, '0') as Dyna_Nom_Prin",
            input_columns: [{
              name: "Dyna_Nom_Prin",
              physical: [{ table: "demo.fast_pos", column: "dynamic_notional" }],
              qualifier: "np",
              resolution: "PHYSICAL",
            }],
          },
        ],
      } },
      { relation_id: "rel:root.join", relation_type: "join", relation: { type: "join", scope_id: "root" } },
      { relation_id: "rel:root.np.project", relation_type: "project", relation: { type: "project", scope_id: "root.np" } },
      { relation_id: "rel:root.np.read.pos", relation_type: "read", relation: { type: "read", table: "demo.fast_pos", binding: "pos", scope_id: "root.np" } },
      { relation_id: "rel:root.dy.project", relation_type: "project", relation: { type: "project", scope_id: "root.dy" } },
      { relation_id: "rel:root.dy.dy.project", relation_type: "project", relation: { type: "project", scope_id: "root.dy.dy" } },
      { relation_id: "rel:root.dy.dy.read.pos", relation_type: "read", relation: { type: "read", table: "demo.fast_pos", binding: "pos", scope_id: "root.dy.dy" } },
    ];
    const relationEdges = [
      { from_relation_id: "rel:root.join", to_relation_id: "rel:root.project" },
      { from_relation_id: "rel:root.np.project", to_relation_id: "rel:root.join" },
      { from_relation_id: "rel:root.dy.project", to_relation_id: "rel:root.join" },
      { from_relation_id: "rel:root.dy.dy.project", to_relation_id: "rel:root.dy.project" },
      { from_relation_id: "rel:root.np.read.pos", to_relation_id: "rel:root.np.project" },
      { from_relation_id: "rel:root.dy.dy.read.pos", to_relation_id: "rel:root.dy.dy.project" },
    ];
    const expressions = [
      {
        expression_id: "expr:fast-init",
        relation_id: "rel:root.project",
        ordinal: 25,
        output_name: "Init_Nom_Prin",
        expression_text: "dy.Init_Nom_Prin",
        input_fields: [{ table: "demo.fast_pos", column: "dynamic_notional" }],
      },
      {
        expression_id: "expr:fast-dyna",
        relation_id: "rel:root.project",
        ordinal: 26,
        output_name: "Dyna_Nom_Prin",
        expression_text: "coalesce(np.Dyna_Nom_Prin, '0') as Dyna_Nom_Prin",
        input_fields: [{ table: "demo.fast_pos", column: "dynamic_notional" }],
      },
    ];
    const indexes = buildFieldEvidenceIndexes({
      taskId: "220650",
      expressions,
      relationNodes,
      relationEdges,
      datasetIoReads: [{
        direction: "READ",
        read_occurrences: [
          { relation_id: "rel:root.np.read.pos", occurrence_id: "occ:np" },
          { relation_id: "rel:root.dy.dy.read.pos", occurrence_id: "occ:dy" },
        ],
      }],
    });
    const emit = (expression: typeof expressions[number]) => emitFieldEvidenceForInput({
      taskId: "220650",
      expression,
      sourceField: field("demo.fast_pos", "dynamic_notional"),
      inputField: { table: "demo.fast_pos", column: "dynamic_notional" },
      expanded: {
        field: field("demo.fast_pos", "dynamic_notional"),
        materializationBridgeIds: [],
        leafExpressionId: expression.expression_id,
        leafRelationId: "rel:root.project",
        pathHadAggregation: false,
        subtypeHops: [],
      },
      indexes,
    });
    expect(emit(expressions[0]!)[0]?.sourceResolution.sourceReadOccurrenceId).toBe("occ:dy");
    expect(emit(expressions[1]!)[0]?.sourceResolution.sourceReadOccurrenceId).toBe("occ:np");
  });

  it("keeps FAST np plus dy physical inputs ambiguous", () => {
    const resolution = resolveFastDerivedFixture([
      {
        output: "Dyna_Nom_Prin",
        expr_text: "coalesce(np.amount + dy.amount, '0') as Dyna_Nom_Prin",
        input_columns: [
          { name: "amount", physical: [{ table: "demo.fast_pos", column: "dynamic_notional" }], qualifier: "np" },
          { name: "amount", physical: [{ table: "demo.fast_pos", column: "dynamic_notional" }], qualifier: "dy" },
        ],
      },
    ]);
    expect(resolution.sourceReadOccurrenceStatus).toBe("AMBIGUOUS");
    expect(resolution.sourceReadOccurrenceReason).toBe("SELF_JOIN_NO_QUALIFIER");
  });

  it("keeps a qualified plus unqualified physical input ambiguous", () => {
    const resolution = resolveFastDerivedFixture([
      {
        output: "Dyna_Nom_Prin",
        expr_text: "coalesce(np.amount + amount, '0') as Dyna_Nom_Prin",
        input_columns: [
          { name: "amount", physical: [{ table: "demo.fast_pos", column: "dynamic_notional" }], qualifier: "np" },
          { name: "amount", physical: [{ table: "demo.fast_pos", column: "dynamic_notional" }] },
        ],
      },
    ]);
    expect(resolution.sourceReadOccurrenceStatus).toBe("AMBIGUOUS");
    expect(resolution.sourceReadOccurrenceReason).toBe("SELF_JOIN_NO_QUALIFIER");
  });

  it("keeps duplicate raw output expressions ambiguous", () => {
    const resolution = resolveFastDerivedFixture([
      {
        output: "Dyna_Nom_Prin",
        expr_text: "np.amount as Dyna_Nom_Prin",
        input_columns: [
          { name: "amount", physical: [{ table: "demo.fast_pos", column: "dynamic_notional" }], qualifier: "np" },
        ],
      },
      {
        output: "Dyna_Nom_Prin",
        expr_text: "dy.amount as Dyna_Nom_Prin",
        input_columns: [
          { name: "amount", physical: [{ table: "demo.fast_pos", column: "dynamic_notional" }], qualifier: "dy" },
        ],
      },
    ]);
    expect(resolution.sourceReadOccurrenceStatus).toBe("AMBIGUOUS");
    expect(resolution.sourceReadOccurrenceReason).toBe("SELF_JOIN_NO_QUALIFIER");
  });

});
