import { describe, expect, it } from "vitest";

import {
  buildRelationTreeIndex,
  controlSideForJoin,
  normalizeJoinType,
  readRelationsInSubtree,
  relationSubtree,
  withIncomingRelations,
} from "../../../scripts/project-graph/task-local/field-evidence/relation-tree.ts";
import {
  expandSetopBranchExpressions,
  expressionsByRelationAndOrdinal,
  routeNamedOutputContexts,
  resolveSourceReadOccurrence,
} from "../../../scripts/project-graph/task-local/field-evidence/source-read-occurrence.ts";

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

  it("resolves repeated CTE reads through one uniquely witnessed body", () => {
    const relationNodes = [
      {
        relation_id: "rel:root.(child).poepm.read.metric",
        relation_type: "read",
        relation: {
          type: "read",
          table: "demo.metric",
          binding: "poepm",
          scope_id: "root.(child).poepm",
        },
      },
      {
        relation_id: "rel:root.(child).project",
        relation_type: "project",
        relation: {
          type: "project",
          scope_id: "root.(child)",
          expressions: [{
            output: "pv",
            input_columns: [{
              name: "pv",
              qualifier: "poepm",
              physical: [{ table: "demo.metric", column: "pv" }],
            }],
          }],
        },
      },
      {
        relation_id: "rel:root.branch.pvs.read.t",
        relation_type: "read",
        relation: {
          type: "read",
          table: "t",
          binding: "t",
          scope_id: "root.branch.pvs",
          source: "rel:root.(child).project",
        },
      },
      {
        relation_id: "rel:root.branch.bp.read.t",
        relation_type: "read",
        relation: {
          type: "read",
          table: "t",
          binding: "t",
          scope_id: "root.branch.bp",
          source: "rel:root.(child).project",
        },
      },
      {
        relation_id: "rel:root.branch.project",
        relation_type: "project",
        relation: { type: "project", scope_id: "root.branch" },
      },
    ];
    const index = withIncomingRelations(
      buildRelationTreeIndex(relationNodes),
      [
        { from_relation_id: "rel:root.(child).poepm.read.metric", to_relation_id: "rel:root.(child).project" },
        { from_relation_id: "rel:root.(child).project", to_relation_id: "rel:root.branch.pvs.read.t" },
        { from_relation_id: "rel:root.(child).project", to_relation_id: "rel:root.branch.bp.read.t" },
        { from_relation_id: "rel:root.branch.pvs.read.t", to_relation_id: "rel:root.branch.project" },
        { from_relation_id: "rel:root.branch.bp.read.t", to_relation_id: "rel:root.branch.project" },
      ],
    );
    const resolution = resolveSourceReadOccurrence({
      taskId: "task-cte-setop",
      expressionId: "expr:pv",
      sourceTable: "demo.metric",
      sourceColumn: "pv",
      inputField: { table: "demo.metric", column: "pv" },
      cteOutputColumn: "pv",
      leafRelationId: "rel:root.branch.project",
      index,
      readOccurrenceByRelationId: new Map([
        ["rel:root.(child).poepm.read.metric", "occ:metric"],
      ]),
      bindingByReadRelation: new Map([
        ["rel:root.(child).poepm.read.metric", "poepm"],
        ["rel:root.branch.pvs.read.t", "t"],
        ["rel:root.branch.bp.read.t", "t"],
      ]),
    });
    expect(resolution).toMatchObject({
      sourceReadOccurrenceStatus: "RESOLVED",
      sourceReadOccurrenceId: "occ:metric",
      sourceRelationId: "rel:root.(child).poepm.read.metric",
    });
  });

  it("fails closed when the CTE output route is absent", () => {
    const relationNodes = [
      {
        relation_id: "rel:root.(child).source.read",
        relation_type: "read",
        relation: { type: "read", table: "demo.source", scope_id: "root.(child).source" },
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
          type: "read",
          table: "cte",
          scope_id: "root.cte",
          source: "rel:root.(child).project",
        },
      },
    ];
    const resolution = resolveSourceReadOccurrence({
      taskId: "task-cte-no-output",
      expressionId: "expr:amount",
      sourceTable: "demo.source",
      sourceColumn: "amount",
      inputField: { table: "demo.source", column: "amount" },
      leafRelationId: "rel:root.cte.read",
      index: withIncomingRelations(buildRelationTreeIndex(relationNodes), [
        { from_relation_id: "rel:root.(child).source.read", to_relation_id: "rel:root.(child).project" },
        { from_relation_id: "rel:root.(child).project", to_relation_id: "rel:root.cte.read" },
      ]),
      readOccurrenceByRelationId: new Map([
        ["rel:root.(child).source.read", "occ:source"],
      ]),
      bindingByReadRelation: new Map(),
    });
    expect(resolution.sourceReadOccurrenceStatus).toBe("UNRESOLVED");
    expect(resolution.sourceReadOccurrenceReason).toBe("CTE_SCOPE_UNRESOLVED");
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

    const mismatchedOutputContexts = routeNamedOutputContexts({
      expression: outer,
      sourceTable: "demo.source",
      sourceColumn: "amount",
      relationExpressionsByRelationId: relationExpressions,
      expressionsByRelation: expressionsByRelationAndOrdinal([
        expressions[0]!, expressions[1]!, branch0, { ...branch1, output_name: "other" },
      ]),
      index,
    });
    expect(mismatchedOutputContexts).toEqual([]);

  });
});

describe("relation-tree", () => {
  it("routes a named CTE output through one binding in its consumer scope", () => {
    const outer = {
      expression_id: "expr:outer", relation_id: "rel:root.casttable.project", ordinal: 0,
      output_name: "final", input_fields: [{ table: "demo.source", column: "amount" }],
    };
    const body = {
      expression_id: "expr:body", relation_id: "rel:root.(child).project", ordinal: 0,
      output_name: "metric", input_fields: [{ table: "demo.source", column: "amount" }],
    };
    const branch = {
      expression_id: "expr:branch", relation_id: "rel:root.(child).setop.b0", ordinal: 0,
      output_name: "amount", input_fields: [{ table: "demo.source", column: "amount" }],
      input_dependency_status: "PHYSICAL",
    };
    const relationExpressions = new Map([
      [outer.relation_id, [{ output: "final", input_columns: [{ name: "metric", qualifier: "it", physical: [{ table: "demo.source", column: "amount" }] }] }]],
      [body.relation_id, [{ output: "metric", input_columns: [{ name: "amount", physical: [{ table: "demo.source", column: "amount" }] }] }]],
    ]);
    const relationNodes = [
      { relation_id: outer.relation_id, relation_type: "project", relation: { type: "project", scope_id: "root.casttable" } },
      { relation_id: "rel:root.casttable.read.it", relation_type: "read", relation: { type: "read", table: "index_table", binding: "it", scope_id: "root.casttable", source: body.relation_id } },
      { relation_id: body.relation_id, relation_type: "project", relation: { type: "project", scope_id: "root.(child)", source: "rel:root.(child).setop", output_columns: ["metric"] } },
      { relation_id: "rel:root.(child).setop", relation_type: "setop", relation: { type: "setop", output_columns: ["amount"], branches: [branch.relation_id] } },
      { relation_id: branch.relation_id, relation_type: "project", relation: { type: "project", scope_id: "root.(child).setop.b0" } },
    ];
    const index = withIncomingRelations(buildRelationTreeIndex(relationNodes), [
      { from_relation_id: "rel:root.casttable.read.it", to_relation_id: outer.relation_id },
      { from_relation_id: body.relation_id, to_relation_id: "rel:root.casttable.read.it" },
    ]);
    const contexts = routeNamedOutputContexts({
      expression: outer, sourceTable: "demo.source", sourceColumn: "amount",
      relationExpressionsByRelationId: relationExpressions,
      expressionsByRelation: expressionsByRelationAndOrdinal([outer, body, branch]), index,
    });
    expect(contexts.map((context) => context.expressionId)).toEqual(["expr:branch"]);
  });

  it("does not route a CTE reader when same-scope binding or source is not unique", () => {
    const outer = {
      expression_id: "expr:outer", relation_id: "rel:root.casttable.project", ordinal: 0,
      output_name: "final", input_fields: [{ table: "demo.source", column: "amount" }],
    };
    const body = (id: string) => ({
      expression_id: `expr:${id}`, relation_id: `rel:root.(child).${id}`, ordinal: 0,
      output_name: "metric", input_fields: [{ table: "demo.source", column: "amount" }],
    });
    const first = body("first");
    const second = body("second");
    const relationExpressions = new Map([
      [outer.relation_id, [{ output: "final", input_columns: [{ name: "metric", qualifier: "it", physical: [{ table: "demo.source", column: "amount" }] }] }]],
      [first.relation_id, [{ output: "metric", input_columns: [] }]],
      [second.relation_id, [{ output: "metric", input_columns: [] }]],
    ]);
    const nodes = [
      { relation_id: outer.relation_id, relation_type: "project", relation: { type: "project", scope_id: "root.casttable" } },
      { relation_id: first.relation_id, relation_type: "project", relation: { type: "project", scope_id: "root.(child).first", output_columns: ["metric"] } },
      { relation_id: second.relation_id, relation_type: "project", relation: { type: "project", scope_id: "root.(child).second", output_columns: ["metric"] } },
      { relation_id: "rel:root.casttable.read.it.1", relation_type: "read", relation: { type: "read", table: "index_table", binding: "it", scope_id: "root.casttable", source: first.relation_id } },
      { relation_id: "rel:root.casttable.read.it.2", relation_type: "read", relation: { type: "read", table: "index_table", binding: "it", scope_id: "root.casttable", source: second.relation_id } },
      // Same binding beneath a child scope must not make the root binding eligible.
      { relation_id: "rel:root.casttable.child.read.it", relation_type: "read", relation: { type: "read", table: "index_table", binding: "it", scope_id: "root.casttable.child", source: first.relation_id } },
    ];
    const index = withIncomingRelations(buildRelationTreeIndex(nodes), [
      { from_relation_id: "rel:root.casttable.read.it.1", to_relation_id: outer.relation_id },
      { from_relation_id: "rel:root.casttable.read.it.2", to_relation_id: outer.relation_id },
      { from_relation_id: "rel:root.casttable.child.read.it", to_relation_id: outer.relation_id },
    ]);
    expect(routeNamedOutputContexts({
      expression: outer, sourceTable: "demo.source", sourceColumn: "amount",
      relationExpressionsByRelationId: relationExpressions,
      expressionsByRelation: expressionsByRelationAndOrdinal([outer, first, second]), index,
    })).toEqual([]);
  });

  it("bridges a pivot CTE only through its unique RESULT_VALUE physical read", () => {
    const pivotMeasure = {
      aggregate: true,
      output: "tag_001",
      expression_facts: { literals: ["'tag_001'"], comparisons: [{ operator: "=" }] },
      expression_roles: [
        { role: "BRANCH_SELECTOR", input_columns: [{ name: "tag_id", physical: [{ table: "demo.same", column: "tag_id" }] }] },
        { role: "RESULT_VALUE", input_columns: [{ name: "index_val", physical: [{ table: "demo.same", column: "index_val" }] }] },
      ],
      input_columns: [
        { name: "tag_id", physical: [{ table: "demo.same", column: "tag_id" }] },
        { name: "index_val", physical: [{ table: "demo.same", column: "index_val" }] },
      ],
    };
    const relationNodes = [
      { relation_id: "rel:body.read", relation_type: "read", relation: { type: "read", table: "demo.same", binding: "s", scope_id: "root.(child).s" } },
      { relation_id: "rel:body.aggregate", relation_type: "aggregate", relation: { type: "aggregate", scope_id: "root.(child)", measures: [pivotMeasure] } },
      { relation_id: "rel:outer.read.t", relation_type: "read", relation: { type: "read", table: "t", binding: "t", scope_id: "root.t", source: "rel:body.aggregate" } },
    ];
    const index = withIncomingRelations(buildRelationTreeIndex(relationNodes), [
      { from_relation_id: "rel:body.read", to_relation_id: "rel:body.aggregate" },
      { from_relation_id: "rel:body.aggregate", to_relation_id: "rel:outer.read.t" },
    ]);
    const base = {
      taskId: "pivot-cte",
      expressionId: "expr:pivot",
      inputField: { table: "demo.same", column: "index_val" },
      cteOutputColumn: "tag_001",
      leafRelationId: "rel:outer.read.t",
      index,
      readOccurrenceByRelationId: new Map([["rel:body.read", "occ:body"]]),
      bindingByReadRelation: new Map([["rel:body.read", "s"], ["rel:outer.read.t", "t"]]),
    };
    expect(resolveSourceReadOccurrence({
      ...base, sourceTable: "demo.same", sourceColumn: "index_val",
    })).toMatchObject({ sourceReadOccurrenceStatus: "RESOLVED", sourceReadOccurrenceId: "occ:body" });
    // `tag_id` is the selector, not the value carried by output tag_001.
    expect(resolveSourceReadOccurrence({
      ...base, sourceTable: "demo.same", sourceColumn: "tag_id",
      inputField: { table: "demo.same", column: "tag_id" },
    })).toMatchObject({ sourceReadOccurrenceStatus: "UNRESOLVED", sourceReadOccurrenceReason: "CTE_SCOPE_UNRESOLVED" });

    const twoPhysicalIndex = withIncomingRelations(buildRelationTreeIndex([
      ...relationNodes.slice(0, 1),
      { ...relationNodes[1]!, relation: { ...relationNodes[1]!.relation, measures: [{
        ...pivotMeasure,
        expression_roles: [pivotMeasure.expression_roles[0]!, {
          role: "RESULT_VALUE",
          input_columns: [{ name: "index_val", physical: [
            { table: "demo.same", column: "index_val" },
            { table: "demo.same", column: "other_index_val" },
          ] }],
        }],
      }] } },
      relationNodes[2]!,
    ]), [
      { from_relation_id: "rel:body.read", to_relation_id: "rel:body.aggregate" },
      { from_relation_id: "rel:body.aggregate", to_relation_id: "rel:outer.read.t" },
    ]);
    expect(resolveSourceReadOccurrence({
      ...base,
      sourceTable: "demo.same",
      sourceColumn: "index_val",
      index: twoPhysicalIndex,
    })).toMatchObject({ sourceReadOccurrenceStatus: "UNRESOLVED", sourceReadOccurrenceReason: "CTE_SCOPE_UNRESOLVED" });
  });

  it("keeps only a uniquely selected pivot value as a named aggregate output witness", () => {
    const pivotMeasure = {
      aggregate: true,
      output: "tag_001",
      expression_facts: {
        literals: ["'tag_001'"],
        comparisons: [{ operator: "=" }],
      },
      expression_roles: [
        {
          role: "BRANCH_SELECTOR",
          input_columns: [{ name: "tag_id", physical: [{ table: "demo.source", column: "tag_id" }] }],
        },
        {
          role: "RESULT_VALUE",
          input_columns: [{ name: "index_val", physical: [{ table: "demo.source", column: "index_val" }] }],
        },
      ],
      input_columns: [
        { name: "tag_id", physical: [{ table: "demo.source", column: "tag_id" }] },
        { name: "index_val", physical: [{ table: "demo.source", column: "index_val" }] },
      ],
    };
    const index = buildRelationTreeIndex([
      { relation_id: "rel:pivot", relation_type: "aggregate", relation: { type: "aggregate", measures: [pivotMeasure] } },
      // Output must match the selector literal; otherwise do not route it.
      { relation_id: "rel:mismatch", relation_type: "aggregate", relation: { type: "aggregate", measures: [{ ...pivotMeasure, output: "different" }] } },
      // A non-literal selector cannot identify one pivot output.
      { relation_id: "rel:nonliteral", relation_type: "aggregate", relation: { type: "aggregate", measures: [{ ...pivotMeasure, expression_facts: { literals: [], comparisons: [{ operator: "=" }] } }] } },
      // Multiple value branches cannot be mapped to one leaf read.
      { relation_id: "rel:multiple-values", relation_type: "aggregate", relation: { type: "aggregate", measures: [{ ...pivotMeasure, expression_roles: [...pivotMeasure.expression_roles, { role: "RESULT_VALUE", input_columns: [{ name: "other", physical: [{ table: "demo.source", column: "other" }] }] }] }] } },
    ]);
    expect(index.relations.get("rel:pivot")?.outputInputColumns).toMatchObject([
      { outputName: "tag_001", physicalDataset: "demo.source", physicalColumn: "index_val" },
    ]);
    expect(index.relations.get("rel:mismatch")?.outputInputColumns).toEqual([]);
    expect(index.relations.get("rel:nonliteral")?.outputInputColumns).toEqual([]);
    expect(index.relations.get("rel:multiple-values")?.outputInputColumns).toEqual([]);
  });

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
