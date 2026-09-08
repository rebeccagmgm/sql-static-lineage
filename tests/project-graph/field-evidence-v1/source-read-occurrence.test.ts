import { describe, expect, it } from "vitest";

import {
  buildRelationTreeIndex,
  controlSideForJoin,
  normalizeJoinType,
  readRelationsInSubtree,
  relationSubtree,
  withIncomingRelations,
} from "../../../scripts/project-graph/field-evidence-v1/relation-tree.ts";
import {
  expandSetopBranchExpressions,
  expressionsByRelationAndOrdinal,
  routeNamedOutputContexts,
  resolveSourceReadOccurrence,
} from "../../../scripts/project-graph/field-evidence-v1/source-read-occurrence.ts";

describe("source-read-occurrence", () => {
  it("resolves a single read relation under the leaf expression subtree", () => {
    const relationNodes = [
      {
        relation_id: "rel:read:0",
        relation_type: "read",
        relation: { table: "demo.source", type: "read", binding: "s" },
      },
      {
        relation_id: "rel:project:0",
        relation_type: "project",
        relation: { type: "project" },
      },
    ];
    const relationEdges = [
      {
        from_relation_id: "rel:read:0",
        to_relation_id: "rel:project:0",
      },
    ];
    const index = withIncomingRelations(
      buildRelationTreeIndex(relationNodes),
      relationEdges,
    );
    const input = {
      taskId: "task-1",
      expressionId: "expr:0",
      sourceTable: "demo.source",
      sourceColumn: "id",
      inputField: { table: "demo.source", column: "id" },
      leafRelationId: "rel:project:0",
      index,
      readOccurrenceByRelationId: new Map([["rel:read:0", "occ:0"]]),
      bindingByReadRelation: new Map([["rel:read:0", "s"]]),
    };
    const resolution = resolveSourceReadOccurrence(input);
    expect(resolution.sourceReadOccurrenceStatus).toBe("RESOLVED");
    expect(resolution.sourceReadOccurrenceId).toBe("occ:0");
    expect(resolution.sourceRelationId).toBe("rel:read:0");
    expect(resolution.gap).toBeNull();
    expect(resolveSourceReadOccurrence({
      ...input,
      referenceQualifier: "missing_alias",
    }).sourceReadOccurrenceStatus).toBe("UNRESOLVED");
  });

  it("marks self-join reads without qualifier as ambiguous", () => {
    const relationNodes = [
      {
        relation_id: "rel:read:left",
        relation_type: "read",
        relation: { table: "demo.source", type: "read", binding: "a", scope_id: "root.a" },
      },
      {
        relation_id: "rel:read:right",
        relation_type: "read",
        relation: { table: "demo.source", type: "read", binding: "b", scope_id: "root.b" },
      },
      {
        relation_id: "rel:join:0",
        relation_type: "join",
        relation: { type: "join", scope_id: "root" },
      },
    ];
    const relationEdges = [
      { from_relation_id: "rel:read:left", to_relation_id: "rel:join:0" },
      { from_relation_id: "rel:read:right", to_relation_id: "rel:join:0" },
    ];
    const index = withIncomingRelations(
      buildRelationTreeIndex(relationNodes),
      relationEdges,
    );
    const resolution = resolveSourceReadOccurrence({
      taskId: "task-1",
      expressionId: "expr:0",
      sourceTable: "demo.source",
      sourceColumn: "id",
      inputField: { table: "demo.source", column: "id" },
      leafRelationId: "rel:join:0",
      index,
      readOccurrenceByRelationId: new Map([
        ["rel:read:left", "occ:left"],
        ["rel:read:right", "occ:right"],
      ]),
      bindingByReadRelation: new Map(),
    });
    expect(resolution.sourceReadOccurrenceStatus).toBe("AMBIGUOUS");
    expect(resolution.sourceReadOccurrenceReason).toBe("SELF_JOIN_NO_QUALIFIER");
    expect(resolution.gap?.reasonCode).toBe("FIELD_SOURCE_READ_OCCURRENCE_AMBIGUOUS");
  });

  it("excludes CTE-body reads when the expression is outside that CTE scope", () => {
    const relationNodes = [
      {
        relation_id: "rel:root.a.read.source",
        relation_type: "read",
        relation: {
          table: "demo.source",
          type: "read",
          binding: "source",
          scope_id: "root.a",
        },
      },
      {
        relation_id: "rel:root.(child).t.read.source",
        relation_type: "read",
        relation: {
          table: "demo.source",
          type: "read",
          binding: "source",
          scope_id: "root.(child).t",
        },
      },
      {
        relation_id: "rel:root.read.temp",
        relation_type: "read",
        relation: {
          table: "demo.temp",
          type: "read",
          binding: "temp",
          scope_id: "root",
        },
      },
      {
        relation_id: "rel:root.project",
        relation_type: "project",
        relation: { type: "project", scope_id: "root" },
      },
    ];
    const relationEdges = [
      { from_relation_id: "rel:root.(child).t.read.source", to_relation_id: "rel:root.read.temp" },
      { from_relation_id: "rel:root.read.temp", to_relation_id: "rel:root.project" },
      { from_relation_id: "rel:root.a.read.source", to_relation_id: "rel:root.project" },
    ];
    const index = withIncomingRelations(
      buildRelationTreeIndex(relationNodes),
      relationEdges,
    );
    const resolution = resolveSourceReadOccurrence({
      taskId: "task-1",
      expressionId: "expr:0",
      sourceTable: "demo.source",
      sourceColumn: "amount",
      inputField: { table: "demo.source", column: "amount" },
      leafRelationId: "rel:root.project",
      index,
      readOccurrenceByRelationId: new Map([
        ["rel:root.a.read.source", "occ:main"],
        ["rel:root.(child).t.read.source", "occ:cte"],
      ]),
      bindingByReadRelation: new Map([
        ["rel:root.a.read.source", "source"],
        ["rel:root.(child).t.read.source", "source"],
      ]),
    });
    expect(resolution.sourceReadOccurrenceStatus).toBe("RESOLVED");
    expect(resolution.sourceReadOccurrenceId).toBe("occ:main");
    expect(resolution.sourceRelationId).toBe("rel:root.a.read.source");
  });

  it("resolves a CTE reference through its explicit body source bridge", () => {
    const relationNodes = [
      {
        relation_id: "rel:root.(child).source.read",
        relation_type: "read",
        relation: { table: "demo.source", type: "read", scope_id: "root.(child).source" },
      },
      {
        relation_id: "rel:root.(child).project",
        relation_type: "project",
        relation: {
          type: "project",
          scope_id: "root.(child)",
          expressions: [{
            output: "amount",
            input_columns: [{
              name: "amount",
              qualifier: "source",
              physical: [{ table: "demo.source", column: "amount" }],
            }],
          }],
        },
      },
      {
        relation_id: "rel:root.cte.read",
        relation_type: "read",
        relation: {
          table: "cte",
          type: "read",
          binding: "cte",
          scope_id: "root.cte",
          source: "rel:root.(child).project",
        },
      },
    ];
    const index = withIncomingRelations(
      buildRelationTreeIndex(relationNodes),
      [
        { from_relation_id: "rel:root.(child).source.read", to_relation_id: "rel:root.(child).project" },
        { from_relation_id: "rel:root.(child).project", to_relation_id: "rel:root.cte.read" },
      ],
    );
    const resolution = resolveSourceReadOccurrence({
      taskId: "task-cte",
      expressionId: "expr:cte",
      sourceTable: "demo.source",
      sourceColumn: "amount",
      inputField: { table: "demo.source", column: "amount" },
      cteOutputColumn: "amount",
      leafRelationId: "rel:root.cte.read",
      index,
      readOccurrenceByRelationId: new Map([["rel:root.(child).source.read", "occ:source"]]),
      bindingByReadRelation: new Map(),
    });
    expect(resolution.sourceReadOccurrenceStatus).toBe("RESOLVED");
    expect(resolution.sourceReadOccurrenceId).toBe("occ:source");
    expect(resolution.sourceRelationId).toBe("rel:root.(child).source.read");
  });

  it("fails closed when a CTE reference has no body source bridge", () => {
    const relationNodes = [
      {
        relation_id: "rel:root.cte.read",
        relation_type: "read",
        relation: { table: "cte", type: "read", binding: "cte", scope_id: "root.cte" },
      },
    ];
    const resolution = resolveSourceReadOccurrence({
      taskId: "task-cte",
      expressionId: "expr:cte",
      sourceTable: "demo.source",
      sourceColumn: "amount",
      inputField: { table: "demo.source", column: "amount" },
      leafRelationId: "rel:root.cte.read",
      index: withIncomingRelations(buildRelationTreeIndex(relationNodes), []),
      readOccurrenceByRelationId: new Map(),
      bindingByReadRelation: new Map(),
    });
    expect(resolution.sourceReadOccurrenceStatus).toBe("UNRESOLVED");
    expect(resolution.sourceReadOccurrenceReason).toBe("CTE_SCOPE_UNRESOLVED");
  });

  it("fails closed when a CTE source has no matching named output witness", () => {
    const relationNodes = [
      {
        relation_id: "rel:root.(child).source.read",
        relation_type: "read",
        relation: { table: "demo.source", type: "read", scope_id: "root.(child).source" },
      },
      {
        relation_id: "rel:root.(child).project",
        relation_type: "project",
        relation: {
          type: "project",
          scope_id: "root.(child)",
          expressions: [{
            output: "other_amount",
            input_columns: [{
              name: "amount",
              physical: [{ table: "demo.source", column: "amount" }],
            }],
          }],
        },
      },
      {
        relation_id: "rel:root.cte.read",
        relation_type: "read",
        relation: {
          table: "cte",
          type: "read",
          scope_id: "root.cte",
          source: "rel:root.(child).project",
        },
      },
    ];
    const resolution = resolveSourceReadOccurrence({
      taskId: "task-cte",
      expressionId: "expr:cte",
      sourceTable: "demo.source",
      sourceColumn: "amount",
      inputField: { table: "demo.source", column: "amount" },
      cteOutputColumn: "amount",
      leafRelationId: "rel:root.cte.read",
      index: withIncomingRelations(buildRelationTreeIndex(relationNodes), [
        { from_relation_id: "rel:root.(child).source.read", to_relation_id: "rel:root.(child).project" },
        { from_relation_id: "rel:root.(child).project", to_relation_id: "rel:root.cte.read" },
      ]),
      readOccurrenceByRelationId: new Map([["rel:root.(child).source.read", "occ:source"]]),
      bindingByReadRelation: new Map(),
    });
    expect(resolution.sourceReadOccurrenceStatus).toBe("UNRESOLVED");
    expect(resolution.sourceReadOccurrenceReason).toBe("CTE_SCOPE_UNRESOLVED");
  });

  it("does not cross an unqualified CTE bridge beside a physical sibling", () => {
    const relationNodes = [
      {
        relation_id: "rel:root.(child).source.read",
        relation_type: "read",
        relation: { table: "demo.source", type: "read", scope_id: "root.(child)" },
      },
      {
        relation_id: "rel:root.(child).project",
        relation_type: "project",
        relation: {
          type: "project",
          scope_id: "root.(child)",
          expressions: [{
            output: "amount",
            input_columns: [{
              name: "amount",
              physical: [{ table: "demo.source", column: "amount" }],
            }],
          }],
        },
      },
      {
        relation_id: "rel:root.cte.read",
        relation_type: "read",
        relation: {
          table: "cte",
          type: "read",
          binding: "cte",
          scope_id: "root.cte",
          source: "rel:root.(child).project",
        },
      },
      {
        relation_id: "rel:root.read.other",
        relation_type: "read",
        relation: { table: "demo.other", type: "read", scope_id: "root.other" },
      },
      { relation_id: "rel:root.project", relation_type: "project", relation: { type: "project", scope_id: "root" } },
    ];
    const index = withIncomingRelations(buildRelationTreeIndex(relationNodes), [
      { from_relation_id: "rel:root.(child).source.read", to_relation_id: "rel:root.(child).project" },
      { from_relation_id: "rel:root.(child).project", to_relation_id: "rel:root.cte.read" },
      { from_relation_id: "rel:root.cte.read", to_relation_id: "rel:root.project" },
      { from_relation_id: "rel:root.read.other", to_relation_id: "rel:root.project" },
    ]);
    const resolution = resolveSourceReadOccurrence({
      taskId: "task-cte",
      expressionId: "expr:cte",
      sourceTable: "demo.source",
      sourceColumn: "amount",
      inputField: { table: "demo.source", column: "amount" },
      cteOutputColumn: "amount",
      leafRelationId: "rel:root.project",
      index,
      readOccurrenceByRelationId: new Map([["rel:root.(child).source.read", "occ:source"]]),
      bindingByReadRelation: new Map(),
    });
    expect(resolution.sourceReadOccurrenceStatus).toBe("UNRESOLVED");
    expect(resolution.sourceReadOccurrenceReason).toBe("CTE_SCOPE_UNRESOLVED");
  });

  it("uses the CTE body output qualifier to avoid a same-table self join", () => {
    const relationNodes = [
      {
        relation_id: "rel:root.(child).left.read",
        relation_type: "read",
        relation: { table: "demo.source", type: "read", scope_id: "root.(child).left" },
      },
      {
        relation_id: "rel:root.(child).right.read",
        relation_type: "read",
        relation: { table: "demo.source", type: "read", scope_id: "root.(child).right" },
      },
      {
        relation_id: "rel:root.(child).project",
        relation_type: "project",
        relation: {
          type: "project",
          scope_id: "root.(child)",
          expressions: [{
            output: "amount",
            input_columns: [{
              name: "amount",
              qualifier: "left",
              physical: [{ table: "demo.source", column: "amount" }],
            }],
          }],
        },
      },
      {
        relation_id: "rel:root.cte.read",
        relation_type: "read",
        relation: {
          table: "cte",
          type: "read",
          scope_id: "root.cte",
          source: "rel:root.(child).project",
        },
      },
    ];
    const index = withIncomingRelations(
      buildRelationTreeIndex(relationNodes),
      [
        { from_relation_id: "rel:root.(child).left.read", to_relation_id: "rel:root.(child).project" },
        { from_relation_id: "rel:root.(child).right.read", to_relation_id: "rel:root.(child).project" },
        { from_relation_id: "rel:root.(child).project", to_relation_id: "rel:root.cte.read" },
      ],
    );
    const resolution = resolveSourceReadOccurrence({
      taskId: "task-cte",
      expressionId: "expr:cte",
      sourceTable: "demo.source",
      sourceColumn: "amount",
      inputField: { table: "demo.source", column: "amount" },
      cteOutputColumn: "amount",
      leafRelationId: "rel:root.cte.read",
      index,
      readOccurrenceByRelationId: new Map([
        ["rel:root.(child).left.read", "occ:left"],
        ["rel:root.(child).right.read", "occ:right"],
      ]),
      bindingByReadRelation: new Map([
        ["rel:root.(child).left.read", "left"],
        ["rel:root.(child).right.read", "right"],
      ]),
    });
    expect(resolution.sourceReadOccurrenceStatus).toBe("RESOLVED");
    expect(resolution.sourceReadOccurrenceId).toBe("occ:left");
  });

  it("resolves same-table joins using qualifier from expression text against path/scope", () => {
    const relationNodes = [
      {
        relation_id: "rel:root.b.read.lookup",
        relation_type: "read",
        relation: {
          table: "demo.lookup",
          type: "read",
          binding: "lookup",
          scope_id: "root.b",
        },
      },
      {
        relation_id: "rel:root.c.read.lookup",
        relation_type: "read",
        relation: {
          table: "demo.lookup",
          type: "read",
          binding: "lookup",
          scope_id: "root.c",
        },
      },
      {
        relation_id: "rel:root.project",
        relation_type: "project",
        relation: { type: "project", scope_id: "root" },
      },
    ];
    const relationEdges = [
      { from_relation_id: "rel:root.b.read.lookup", to_relation_id: "rel:root.project" },
      { from_relation_id: "rel:root.c.read.lookup", to_relation_id: "rel:root.project" },
    ];
    const index = withIncomingRelations(
      buildRelationTreeIndex(relationNodes),
      relationEdges,
    );
    const resolution = resolveSourceReadOccurrence({
      taskId: "task-1",
      expressionId: "expr:0",
      sourceTable: "demo.lookup",
      sourceColumn: "code",
      inputField: { table: "demo.lookup", column: "code" },
      expressionText: "NVL(B.CODE, ASSET_TYPE) AS Asset_Type",
      leafRelationId: "rel:root.project",
      index,
      readOccurrenceByRelationId: new Map([
        ["rel:root.b.read.lookup", "occ:b"],
        ["rel:root.c.read.lookup", "occ:c"],
      ]),
      bindingByReadRelation: new Map([
        ["rel:root.b.read.lookup", "lookup"],
        ["rel:root.c.read.lookup", "lookup"],
      ]),
    });
    expect(resolution.sourceReadOccurrenceStatus).toBe("RESOLVED");
    expect(resolution.sourceReadOccurrenceId).toBe("occ:b");
  });

  it("expands setop branches by output ordinal", () => {
    const relationNodes = [
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
    ];
    const expressions = [
      {
        expression_id: "expr:top",
        relation_id: "rel:setop",
        ordinal: 1,
        expression_text: "gamma",
        input_fields: [{ table: "demo.a", column: "gamma" }],
      },
      {
        expression_id: "expr:b0",
        relation_id: "rel:b0.project",
        ordinal: 1,
        expression_text: "gamma",
        input_fields: [{ table: "demo.a", column: "gamma" }],
      },
      {
        expression_id: "expr:b1",
        relation_id: "rel:b1.project",
        ordinal: 1,
        expression_text: "gamma",
        input_fields: [{ table: "demo.b", column: "gamma" }],
      },
    ];
    const index = withIncomingRelations(
      buildRelationTreeIndex(relationNodes),
      [],
    );
    const contexts = expandSetopBranchExpressions({
      expression: expressions[0]!,
      expressionsByRelation: expressionsByRelationAndOrdinal(expressions),
      index,
    });
    expect(contexts.map((context) => context.expressionId).sort()).toEqual([
      "expr:b0",
      "expr:b1",
    ]);
  });

  it("recursively expands nested setop branches to leaf projects", () => {
    const relationNodes = [
      {
        relation_id: "rel:outer.setop",
        relation_type: "setop",
        relation: {
          type: "setop",
          branches: ["rel:inner.setop", "rel:b2.project"],
        },
      },
      {
        relation_id: "rel:inner.setop",
        relation_type: "setop",
        relation: {
          type: "setop",
          branches: ["rel:b0.project", "rel:b1.project"],
        },
      },
      { relation_id: "rel:b0.project", relation_type: "project", relation: { type: "project" } },
      { relation_id: "rel:b1.project", relation_type: "project", relation: { type: "project" } },
      { relation_id: "rel:b2.project", relation_type: "project", relation: { type: "project" } },
    ];
    const expressions = [
      {
        expression_id: "expr:outer",
        relation_id: "rel:outer.setop",
        ordinal: 0,
        expression_text: "UNION_OUTPUT(id)",
        input_fields: [{ table: "demo.t", column: "id" }],
      },
      {
        expression_id: "expr:inner",
        relation_id: "rel:inner.setop",
        ordinal: 0,
        expression_text: "UNION_OUTPUT(id)",
        input_fields: [{ table: "demo.t", column: "id" }],
      },
      {
        expression_id: "expr:b0",
        relation_id: "rel:b0.project",
        ordinal: 0,
        expression_text: "id",
        input_fields: [{ table: "demo.t", column: "id" }],
      },
      {
        expression_id: "expr:b1",
        relation_id: "rel:b1.project",
        ordinal: 0,
        expression_text: "id1 AS id",
        input_fields: [{ table: "demo.t", column: "id" }],
      },
      {
        expression_id: "expr:b2",
        relation_id: "rel:b2.project",
        ordinal: 0,
        expression_text: "id2 AS id",
        input_fields: [{ table: "demo.t", column: "id" }],
      },
    ];
    const contexts = expandSetopBranchExpressions({
      expression: expressions[0]!,
      expressionsByRelation: expressionsByRelationAndOrdinal(expressions),
      index: withIncomingRelations(buildRelationTreeIndex(relationNodes), []),
    });
    expect(contexts.map((context) => context.expressionId).sort()).toEqual([
      "expr:b0",
      "expr:b1",
      "expr:b2",
    ]);
  });

  it("routes a qualified output by its exact scope and setop output-column ordinal", () => {
    const outer = {
      expression_id: "expr:outer",
      relation_id: "rel:root.index.project",
      ordinal: 8,
      output_name: "index_val",
      input_fields: [{ table: "demo.source", column: "amount" }],
    };
    const branch0 = {
      expression_id: "expr:branch0",
      relation_id: "rel:setop.branch0",
      ordinal: 1,
      output_name: "dyna",
      input_fields: [{ table: "demo.source", column: "amount" }],
    };
    const branch1 = {
      expression_id: "expr:branch1",
      relation_id: "rel:setop.branch1",
      ordinal: 1,
      output_name: "dyna",
      input_fields: [{ table: "demo.source", column: "amount" }],
    };
    const expressions = [outer, {
      expression_id: "expr:x",
      relation_id: "rel:root.index.x.project",
      ordinal: 4,
      output_name: "dyna",
      input_fields: [{ table: "demo.source", column: "amount" }],
    }, branch0, branch1];
    const relationNodes = [
      { relation_id: "rel:root.index.project", relation_type: "project", relation: {
        type: "project", scope_id: "root.index.project", expressions: [{
          output: "index_val", input_columns: [{ name: "dyna", qualifier: "x", physical: [{ table: "demo.source", column: "amount" }] }],
        }],
      } },
      { relation_id: "rel:root.index.x.project", relation_type: "project", relation: {
        type: "project", scope_id: "root.index.project.x", source: "rel:aggregate", expressions: [{
          output: "dyna", input_columns: [{ name: "dyna", physical: [{ table: "demo.source", column: "amount" }] }],
        }],
      } },
      // This same-named nested alias must not win the exact lexical scope.
      { relation_id: "rel:root.index.project.x", relation_type: "project", relation: {
        type: "project", scope_id: "root.index.x.project", source: "rel:wrong.setop", expressions: [{
          output: "dyna", input_columns: [{ name: "dyna", physical: [{ table: "demo.source", column: "amount" }] }],
        }],
      } },
      { relation_id: "rel:aggregate", relation_type: "aggregate", relation: { type: "aggregate", source: "rel:setop" } },
      { relation_id: "rel:setop", relation_type: "setop", relation: {
        type: "setop", output_columns: ["other", "dyna"], branches: ["rel:setop.branch0", "rel:setop.branch1"],
      } },
      { relation_id: "rel:setop.branch0", relation_type: "project", relation: { type: "project" } },
      { relation_id: "rel:setop.branch1", relation_type: "project", relation: { type: "project" } },
    ];
    const index = withIncomingRelations(buildRelationTreeIndex(relationNodes), [
      { from_relation_id: "rel:root.index.x.project", to_relation_id: "rel:root.index.project" },
      { from_relation_id: "rel:root.index.project.x", to_relation_id: "rel:root.index.project" },
    ]);
    const relationExpressions = new Map<string, readonly Readonly<Record<string, unknown>>[]>([
      ["rel:root.index.project", [{
        output: "index_val", input_columns: [{ name: "dyna", qualifier: "x", physical: [{ table: "demo.source", column: "amount" }] }],
      }]],
      ["rel:root.index.x.project", [{
        output: "dyna", input_columns: [{ name: "dyna", physical: [{ table: "demo.source", column: "amount" }] }],
      }]],
    ]);
    const contexts = routeNamedOutputContexts({
      expression: outer,
      sourceTable: "demo.source",
      sourceColumn: "amount",
      relationExpressionsByRelationId: relationExpressions,
      expressionsByRelation: expressionsByRelationAndOrdinal(expressions),
      index,
    });
    expect(contexts.map((context) => context.expressionId)).toEqual(["expr:branch0", "expr:branch1"]);

    const knownAbsentBranch = {
      ...branch1,
      input_fields: [],
      input_dependency_status: "NO_PHYSICAL_INPUT",
    };
    const knownAbsentContexts = routeNamedOutputContexts({
      expression: outer,
      sourceTable: "demo.source",
      sourceColumn: "amount",
      relationExpressionsByRelationId: relationExpressions,
      expressionsByRelation: expressionsByRelationAndOrdinal([
        expressions[0]!, expressions[1]!, branch0, knownAbsentBranch,
      ]),
      index,
    });
    expect(knownAbsentContexts.map((context) => context.expressionId)).toEqual(["expr:branch0"]);

    const missingBranchContexts = routeNamedOutputContexts({
      expression: outer,
      sourceTable: "demo.source",
      sourceColumn: "amount",
      relationExpressionsByRelationId: relationExpressions,
      expressionsByRelation: expressionsByRelationAndOrdinal([
        expressions[0]!, expressions[1]!, branch0,
      ]),
      index,
    });
    expect(missingBranchContexts).toEqual([]);

    const partialBranchContexts = routeNamedOutputContexts({
      expression: outer,
      sourceTable: "demo.source",
      sourceColumn: "amount",
      relationExpressionsByRelationId: relationExpressions,
      expressionsByRelation: expressionsByRelationAndOrdinal([
        expressions[0]!, expressions[1]!, branch0, {
          ...branch1,
          input_dependency_status: "PARTIAL",
          unresolved_input_columns: ["unknown_column"],
        },
      ]),
      index,
    });
    expect(partialBranchContexts).toEqual([]);

    const unresolvedEmptyBranchContexts = routeNamedOutputContexts({
      expression: outer,
      sourceTable: "demo.source",
      sourceColumn: "amount",
      relationExpressionsByRelationId: relationExpressions,
      expressionsByRelation: expressionsByRelationAndOrdinal([
        expressions[0]!, expressions[1]!, branch0, {
          ...branch1,
          input_fields: [],
          input_dependency_status: "UNRESOLVED",
        },
      ]),
      index,
    });
    expect(unresolvedEmptyBranchContexts).toEqual([]);
  });
});

describe("relation-tree", () => {
  it("collects read relations in a subtree and normalizes join types", () => {
    const relationNodes = [
      {
        relation_id: "rel:left",
        relation_type: "project",
        relation: { type: "project" },
      },
      {
        relation_id: "rel:read:0",
        relation_type: "read",
        relation: { table: "demo.source", type: "read" },
      },
      {
        relation_id: "rel:join:0",
        relation_type: "join",
        relation: {
          type: "join",
          join_type: "left",
          left: "rel:left",
          right: "rel:right",
        },
      },
    ];
    const relationEdges = [
      { from_relation_id: "rel:read:0", to_relation_id: "rel:left" },
      { from_relation_id: "rel:left", to_relation_id: "rel:join:0" },
    ];
    const index = withIncomingRelations(
      buildRelationTreeIndex(relationNodes),
      relationEdges,
    );
    expect(readRelationsInSubtree(index, "rel:join:0").map((item) => item.relationId)).toEqual([
      "rel:read:0",
    ]);
    expect(relationSubtree(index, "rel:join:0")).toEqual(new Set(["rel:join:0", "rel:left", "rel:read:0"]));
    expect(normalizeJoinType("LEFT OUTER")).toBe("LEFT");
    const joinRelation = index.relations.get("rel:join:0")!;
    expect(
      controlSideForJoin({
        index,
        joinRelation,
        controlReadRelationId: "rel:read:0",
      }),
    ).toBe("LEFT");
  });
});
