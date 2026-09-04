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
    const resolution = resolveSourceReadOccurrence({
      taskId: "task-1",
      expressionId: "expr:0",
      sourceTable: "demo.source",
      sourceColumn: "id",
      inputField: { table: "demo.source", column: "id" },
      leafRelationId: "rel:project:0",
      index,
      readOccurrenceByRelationId: new Map([["rel:read:0", "occ:0"]]),
      bindingByReadRelation: new Map([["rel:read:0", "s"]]),
    });
    expect(resolution.sourceReadOccurrenceStatus).toBe("RESOLVED");
    expect(resolution.sourceReadOccurrenceId).toBe("occ:0");
    expect(resolution.sourceRelationId).toBe("rel:read:0");
    expect(resolution.gap).toBeNull();
  });

  it("marks self-join reads without qualifier as ambiguous", () => {
    const relationNodes = [
      {
        relation_id: "rel:read:left",
        relation_type: "read",
        relation: { table: "demo.source", type: "read", binding: "a" },
      },
      {
        relation_id: "rel:read:right",
        relation_type: "read",
        relation: { table: "demo.source", type: "read", binding: "b" },
      },
      {
        relation_id: "rel:join:0",
        relation_type: "join",
        relation: { type: "join" },
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
