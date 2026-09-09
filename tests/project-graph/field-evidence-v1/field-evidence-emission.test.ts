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
  }).map((emission) => emission.sourceResolution);
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

  it("splits FAST np plus dy physical inputs into their proven reads", () => {
    const resolutions = resolveFastDerivedFixture([
      {
        output: "Dyna_Nom_Prin",
        expr_text: "coalesce(np.amount + dy.amount, '0') as Dyna_Nom_Prin",
        input_columns: [
          { name: "amount", physical: [{ table: "demo.fast_pos", column: "dynamic_notional" }], qualifier: "np" },
          { name: "amount", physical: [{ table: "demo.fast_pos", column: "dynamic_notional" }], qualifier: "dy" },
        ],
      },
    ]);
    expect(resolutions.map((resolution) => resolution.sourceReadOccurrenceStatus)).toEqual(["RESOLVED", "RESOLVED"]);
    expect(resolutions.map((resolution) => resolution.sourceReadOccurrenceId).sort()).toEqual(["occ:dy", "occ:np"]);
  });

  it("keeps a qualified plus unqualified physical input ambiguous", () => {
    const [resolution] = resolveFastDerivedFixture([
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

  it("keeps duplicate raw candidates for one structured operand ambiguous", () => {
    const [resolution] = resolveFastDerivedFixture([
      {
        output: "Dyna_Nom_Prin",
        expr_text: "np.amount as Dyna_Nom_Prin",
        input_columns: [
          { name: "amount", physical: [{ table: "demo.fast_pos", column: "dynamic_notional" }], qualifier: "np" },
          { name: "amount", physical: [{ table: "demo.fast_pos", column: "dynamic_notional" }], qualifier: "np" },
        ],
        structured_expression: { kind: "COLUMN", name: "amount", qualifier: "np" },
      },
    ]);
    expect(resolution.sourceReadOccurrenceStatus).toBe("AMBIGUOUS");
    expect(resolution.sourceReadOccurrenceReason).toBe("SELF_JOIN_NO_QUALIFIER");
  });

  it("uses the materialization leaf expression to verify a folded source", () => {
    const expressions = [
      {
        expression_id: "expr:final",
        relation_id: "rel:final.project",
        ordinal: 0,
        expression_text: "stage.stage_a",
        input_fields: [{ table: "demo.stage", column: "stage_a" }],
      },
      {
        expression_id: "expr:stage-write",
        relation_id: "rel:stage.project",
        ordinal: 0,
        expression_text: "m.mid_a",
        input_fields: [{ table: "demo.mid", column: "mid_a" }],
      },
    ];
    const indexes = buildFieldEvidenceIndexes({
      taskId: "t1",
      expressions,
      relationNodes: [
        { relation_id: "rel:final.project", relation_type: "project", relation: { type: "project" } },
        { relation_id: "rel:stage.project", relation_type: "project", relation: { type: "project" } },
        { relation_id: "rel:stage.read.mid", relation_type: "read", relation: { type: "read", table: "demo.mid", binding: "m" } },
      ],
      relationEdges: [{ from_relation_id: "rel:stage.read.mid", to_relation_id: "rel:stage.project" }],
      datasetIoReads: [{
        direction: "READ",
        read_occurrences: [{ relation_id: "rel:stage.read.mid", occurrence_id: "occ:mid" }],
      }],
    });
    const result = emitFieldEvidenceForInput({
      taskId: "t1",
      expression: expressions[0]!,
      sourceField: field("demo.mid", "mid_a"),
      inputField: { table: "demo.mid", column: "mid_a" },
      expanded: {
        field: field("demo.mid", "mid_a"),
        materializationBridgeIds: ["bridge:stage-a"],
        leafExpressionId: "expr:stage-write",
        leafRelationId: "rel:stage.project",
        pathHadAggregation: false,
        subtypeHops: [],
      },
      indexes,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.expressionContexts[0]?.expressionId).toBe("expr:final");
    expect(result[0]?.sourceResolution).toMatchObject({
      sourceReadOccurrenceStatus: "RESOLVED",
      sourceReadOccurrenceId: "occ:mid",
      sourceRelationId: "rel:stage.read.mid",
    });
  });

  it("keeps duplicate raw output expressions ambiguous", () => {
    const [resolution] = resolveFastDerivedFixture([
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

  it("falls back through a complete routed setop while preserving outer identity and aggregation", () => {
    const outer = {
      expression_id: "expr:outer", relation_id: "rel:root.project", ordinal: 0,
      output_name: "final_amount", expression_text: "x.dyna",
      input_fields: [{ table: "demo.source", column: "amount" }],
      input_dependency_status: "PHYSICAL",
    };
    const branch = (id: string, relationId: string) => ({
      expression_id: id, relation_id: relationId, ordinal: 1, output_name: "dyna",
      expression_text: "a.amount", input_fields: [{ table: "demo.source", column: "amount" }],
      input_dependency_status: "PHYSICAL",
    });
    const branch0 = branch("expr:b0", "rel:setop.b0");
    const branch1 = branch("expr:b1", "rel:setop.b1");
    const expressions = [outer, {
      expression_id: "expr:x", relation_id: "rel:root.x.project", ordinal: 0,
      output_name: "dyna", expression_text: "dyna",
      input_fields: [{ table: "demo.source", column: "amount" }], input_dependency_status: "PHYSICAL",
    }, branch0, branch1];
    const relationNodes = [
      { relation_id: "rel:root.project", relation_type: "project", relation: {
        type: "project", scope_id: "root", expressions: [{ output: "final_amount", input_columns: [{ name: "dyna", qualifier: "x", physical: [{ table: "demo.source", column: "amount" }] }] }],
      } },
      { relation_id: "rel:root.x.project", relation_type: "project", relation: {
        type: "project", scope_id: "root.x", source: "rel:aggregate", expressions: [{ output: "dyna", input_columns: [{ name: "dyna", physical: [{ table: "demo.source", column: "amount" }] }] }],
      } },
      { relation_id: "rel:aggregate", relation_type: "aggregate", relation: { type: "aggregate", source: "rel:setop" } },
      { relation_id: "rel:setop", relation_type: "setop", relation: { type: "setop", output_columns: ["other", "dyna"], branches: ["rel:setop.b0", "rel:setop.b1"] } },
      { relation_id: "rel:setop.b0", relation_type: "project", relation: { type: "project", scope_id: "root.x.b0" } },
      { relation_id: "rel:setop.b1", relation_type: "project", relation: { type: "project", scope_id: "root.x.b1" } },
      { relation_id: "rel:shared.read", relation_type: "read", relation: { type: "read", table: "demo.source", binding: "a", scope_id: "root.x.source" } },
    ];
    const indexes = buildFieldEvidenceIndexes({
      taskId: "route", expressions, relationNodes,
      relationEdges: [
        { from_relation_id: "rel:root.x.project", to_relation_id: "rel:root.project" },
        { from_relation_id: "rel:shared.read", to_relation_id: "rel:setop.b0" },
        { from_relation_id: "rel:shared.read", to_relation_id: "rel:setop.b1" },
      ],
      datasetIoReads: [{ direction: "READ", read_occurrences: [{ relation_id: "rel:shared.read", occurrence_id: "occ:shared" }] }],
    });
    const result = emitFieldEvidenceForInput({
      taskId: "route", expression: outer, sourceField: field("demo.source", "amount"),
      inputField: { table: "demo.source", column: "amount" },
      expanded: { field: field("demo.source", "amount"), materializationBridgeIds: [], leafExpressionId: "expr:outer", leafRelationId: "rel:root.project", pathHadAggregation: false, subtypeHops: [] },
      indexes,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.expressionContexts[0]?.expressionId).toBe("expr:outer");
    expect(result[0]?.sourceResolution.sourceReadOccurrenceId).toBe("occ:shared");
    expect(result[0]?.subtype).toBe("AGGREGATION");
  });

  it("keeps the old unresolved result when routed setop evidence misses a branch", () => {
    const expression = {
      expression_id: "expr:outer", relation_id: "rel:root.project", ordinal: 0,
      output_name: "final", expression_text: "x.amount",
      input_fields: [{ table: "demo.source", column: "amount" }], input_dependency_status: "PHYSICAL",
    };
    const indexes = buildFieldEvidenceIndexes({
      taskId: "missing", expressions: [expression, {
        expression_id: "expr:branch", relation_id: "rel:setop.b0", ordinal: 1,
        output_name: "amount", expression_text: "a.amount",
        input_fields: [{ table: "demo.source", column: "amount" }], input_dependency_status: "PHYSICAL",
      }],
      relationNodes: [
        { relation_id: "rel:root.project", relation_type: "project", relation: { type: "project", scope_id: "root", expressions: [{ output: "final", input_columns: [{ name: "amount", qualifier: "x", physical: [{ table: "demo.source", column: "amount" }] }] }] } },
        { relation_id: "rel:root.x.project", relation_type: "project", relation: { type: "project", scope_id: "root.x", source: "rel:aggregate", expressions: [{ output: "amount", input_columns: [{ name: "amount", physical: [{ table: "demo.source", column: "amount" }] }] }] } },
        { relation_id: "rel:aggregate", relation_type: "aggregate", relation: { type: "aggregate", source: "rel:setop" } },
        { relation_id: "rel:setop", relation_type: "setop", relation: { type: "setop", output_columns: ["amount"], branches: ["rel:setop.b0", "rel:setop.b1"] } },
        { relation_id: "rel:setop.b0", relation_type: "project", relation: { type: "project" } },
        { relation_id: "rel:setop.b1", relation_type: "project", relation: { type: "project" } },
      ],
      relationEdges: [{ from_relation_id: "rel:root.x.project", to_relation_id: "rel:root.project" }], datasetIoReads: [],
    });
    const [result] = emitFieldEvidenceForInput({
      taskId: "missing", expression, sourceField: field("demo.source", "amount"), inputField: { table: "demo.source", column: "amount" },
      expanded: { field: field("demo.source", "amount"), materializationBridgeIds: [], leafExpressionId: "expr:outer", leafRelationId: "rel:root.project", pathHadAggregation: false, subtypeHops: [] }, indexes,
    });
    expect(result?.sourceResolution).toMatchObject({ sourceReadOccurrenceStatus: "UNRESOLVED", sourceReadOccurrenceReason: "CTE_SCOPE_UNRESOLVED" });
  });

  it("does not route an already resolved direct read", () => {
    const expression = { expression_id: "expr:direct", relation_id: "rel:direct.project", ordinal: 0, output_name: "amount", expression_text: "a.amount", input_fields: [{ table: "demo.source", column: "amount" }] };
    const indexes = buildFieldEvidenceIndexes({ taskId: "direct", expressions: [expression], relationNodes: [
      { relation_id: "rel:direct.project", relation_type: "project", relation: { type: "project", scope_id: "root" } },
      { relation_id: "rel:direct.read", relation_type: "read", relation: { type: "read", table: "demo.source", binding: "a", scope_id: "root.a" } },
    ], relationEdges: [{ from_relation_id: "rel:direct.read", to_relation_id: "rel:direct.project" }], datasetIoReads: [{ direction: "READ", read_occurrences: [{ relation_id: "rel:direct.read", occurrence_id: "occ:direct" }] }] });
    const result = emitFieldEvidenceForInput({ taskId: "direct", expression, sourceField: field("demo.source", "amount"), inputField: { table: "demo.source", column: "amount" }, expanded: { field: field("demo.source", "amount"), materializationBridgeIds: [], leafExpressionId: "expr:direct", leafRelationId: "rel:direct.project", pathHadAggregation: false, subtypeHops: [] }, indexes });
    expect(result).toHaveLength(1);
    expect(result[0]?.expressionContexts[0]?.expressionId).toBe("expr:direct");
    expect(result[0]?.sourceResolution.sourceReadOccurrenceId).toBe("occ:direct");
  });

  it("keeps two explicit derived and CTE routes to one physical read distinct", () => {
    const task = "route";
    const statement = "statement:0";
    const physical = { table: "demo.source", column: "amount" };
    const outer = {
      expression_id: "expr:outer",
      relation_id: "rel:outer",
      ordinal: 0,
      output_name: "delta",
      expression_text: "pvs.amount - bp.amount",
      input_fields: [physical],
      input_dependency_status: "PHYSICAL",
    };
    const routed = (name: string) => ({
      expression_id: `expr:${name}`,
      relation_id: `rel:${name}`,
      ordinal: 0,
      output_name: "amount",
      expression_text: "amount",
      input_fields: [physical],
      input_dependency_status: "PHYSICAL",
    });
    const scopeBinding = (name: string) => ({
      scope_id: "scope:outer",
      relation_id: `rel:${name}`,
      binding: name,
      source_kind: "subquery",
      target_scope_id: `scope:${name}`,
      target_relation_id: `rel:${name}`,
    });
    const cteBinding = (name: string) => ({
      scope_id: `scope:${name}`,
      relation_id: `rel:${name}.read.t`,
      binding: "t",
      source_kind: "cte",
      target_scope_id: "scope:t",
      target_relation_id: "rel:t",
    });
    const row = (
      relation_id: string,
      relation_type: string,
      relation: Record<string, unknown>,
    ) => ({
      task_id: task,
      statement_id: statement,
      relation_id,
      relation_type,
      relation,
    });
    const relationNodes = [
      row("rel:outer", "project", {
        type: "project",
        scope_id: "scope:outer",
        scope_bindings: [],
        expressions: [
          {
            output: "delta",
            input_columns: [
              { name: "amount", qualifier: "pvs", physical: [physical] },
              { name: "amount", qualifier: "bp", physical: [physical] },
            ],
          },
        ],
      }),
      ...["pvs", "bp"].flatMap((name) => [
        row(`rel:${name}`, "project", {
          type: "project",
          scope_id: `scope:${name}`,
          source: `rel:${name}.aggregate`,
          scope_bindings: [scopeBinding(name)],
          expressions: [
            {
              output: "amount",
              input_columns: [{ name: "amount", physical: [physical] }],
            },
          ],
        }),
        row(`rel:${name}.aggregate`, "aggregate", {
          type: "aggregate",
          scope_id: `scope:${name}`,
          source: `rel:${name}.read.t`,
          scope_bindings: [],
        }),
        row(`rel:${name}.read.t`, "read", {
          type: "read",
          table: "t",
          binding: "t",
          is_cte: true,
          scope_id: `scope:${name}`,
          source: "rel:t",
          scope_bindings: [cteBinding(name)],
        }),
      ]),
      row("rel:t", "project", {
        type: "project",
        scope_id: "scope:t",
        source: "rel:base.read",
        scope_bindings: [],
        expressions: [
          {
            output: "amount",
            input_columns: [{ name: "amount", physical: [physical] }],
          },
        ],
      }),
      row("rel:base.read", "read", {
        type: "read",
        table: "demo.source",
        binding: "s",
        scope_id: "scope:t.source",
        scope_bindings: [],
      }),
    ];
    const indexes = buildFieldEvidenceIndexes({
      taskId: task,
      expressions: [outer, routed("pvs"), routed("bp")],
      relationNodes,
      relationEdges: [
        { from_relation_id: "rel:pvs", to_relation_id: "rel:outer" },
        { from_relation_id: "rel:bp", to_relation_id: "rel:outer" },
        { from_relation_id: "rel:pvs.aggregate", to_relation_id: "rel:pvs" },
        {
          from_relation_id: "rel:pvs.read.t",
          to_relation_id: "rel:pvs.aggregate",
        },
        { from_relation_id: "rel:bp.aggregate", to_relation_id: "rel:bp" },
        {
          from_relation_id: "rel:bp.read.t",
          to_relation_id: "rel:bp.aggregate",
        },
        { from_relation_id: "rel:base.read", to_relation_id: "rel:t" },
      ],
      datasetIoReads: [
        {
          direction: "READ",
          read_occurrences: [
            { relation_id: "rel:base.read", occurrence_id: "occ:base" },
          ],
        },
      ],
    });
    const result = emitFieldEvidenceForInput({
      taskId: task,
      expression: outer,
      sourceField: field("demo.source", "amount"),
      inputField: physical,
      expanded: {
        field: field("demo.source", "amount"),
        materializationBridgeIds: [],
        leafExpressionId: "expr:outer",
        leafRelationId: "rel:outer",
        pathHadAggregation: false,
        subtypeHops: [],
      },
      indexes,
    });
    expect(result).toHaveLength(2);
    expect(
      result.map((item) => item.sourceResolution.scopeBindingStatus),
    ).toEqual(["EXPLICIT", "EXPLICIT"]);
    expect(
      new Set(
        result.map((item) =>
          item.sourceResolution.scopeBindingPath?.join("->"),
        ),
      ).size,
    ).toBe(2);
    expect(
      result.every(
        (item) => item.sourceResolution.sourceReadOccurrenceId === "occ:base",
      ),
    ).toBe(true);
    expect(
      result.every(
        (item) => item.sourceResolution.sourceRelationId === "rel:base.read",
      ),
    ).toBe(true);
  });
});
