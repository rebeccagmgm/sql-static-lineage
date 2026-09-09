import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  writeTableInput,
  writeTaskInput,
} from "../../../scripts/input/shared/input-pack.ts";
import { runInputPackMachineFacts } from "../../../scripts/machine-facts/input-pack-machine-facts.ts";
import { projectTaskLocal } from "../../../scripts/project-graph/task-local/project-task-local.ts";
import { buildRelationTreeIndex } from "../../../scripts/project-graph/field-evidence-v1/relation-tree.ts";
import {
  expressionsByRelationAndOrdinal,
  routeNamedOutputContexts,
} from "../../../scripts/project-graph/field-evidence-v1/source-read-occurrence.ts";

describe("scope-binding logical input routes", () => {
  it.each([
    {
      name: "direct",
      extraCtes: [] as string[],
      finalSelect: "x.difference",
      finalFrom: "x",
    },
    {
      name: "renamed through two wrappers",
      extraCtes: [
        "y AS (SELECT q.difference AS renamed_difference FROM x q)",
        "z AS (SELECT wrapped.renamed_difference AS final_difference FROM y wrapped)",
      ],
      finalSelect: "z.final_difference",
      finalFrom: "z",
    },
  ])("preserves both operands through $name", ({ name, extraCtes, finalSelect, finalFrom }) => {
    const parent = mkdtempSync(join(tmpdir(), "scope-binding-logical-paths-"));
    const dataRoot = join(parent, "data");
    const factsRoot = join(parent, "facts");
    const taskId = `same-physical-cte-paths-${name.replaceAll(" ", "-")}`;

    writeTableInput(dataRoot, {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: "demo.trade",
      objectType: "hive_table",
      partitionFields: [],
      ddl: "CREATE TABLE demo.trade (amount DOUBLE);",
      evidenceProvider: "synthetic:test",
      collectedAt: "2026-01-01T00:00:00.000Z",
    });
    writeTableInput(dataRoot, {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: "demo.result",
      objectType: "hive_table",
      partitionFields: [],
      ddl: "CREATE TABLE demo.result (difference DOUBLE);",
      evidenceProvider: "synthetic:test",
      collectedAt: "2026-01-01T00:00:00.000Z",
    });
    writeTaskInput(dataRoot, {
      taskId,
      taskCategory: "hive2hive",
      taskName: "same physical CTE paths",
      target: {
        platform: "hive",
        dataSource: "warehouse",
        qualifiedName: "demo.result",
      },
      targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
      partition: null,
      sql: {
        query: {
          content: [
            "pvs AS (SELECT SUM(t.amount) AS value FROM demo.trade t)",
            "bp AS (SELECT SUM(t.amount) AS value FROM demo.trade t)",
            "x AS (SELECT pvs.value - NVL(bp.value, 0) AS difference FROM pvs CROSS JOIN bp)",
            ...extraCtes,
          ].join(", ").replace(
            /^/,
            "WITH ",
          ) + ` INSERT OVERWRITE TABLE demo.result SELECT ${finalSelect} FROM ${finalFrom}`,
          evidenceProvider: "synthetic:test",
        },
      },
      evidenceProvider: "synthetic:test",
      collectedAt: "2026-01-01T00:00:00.000Z",
    });

    runInputPackMachineFacts({
      dataRoot,
      taskIds: [taskId],
      outputRoot: factsRoot,
    });
    const projection = projectTaskLocal({
      taskId,
      dataRoot,
      factsRoot,
    });
    const edges = projection.edges.filter(
      (edge) =>
        edge.edgeType === "FIELD_DIRECT"
        && edge.properties.outputColumn === "difference",
      );
    expect(edges).toHaveLength(2);
    expect(edges.every(
      (edge) => edge.properties.sourceReadOccurrenceStatus === "RESOLVED",
    )).toBe(true);
    expect(new Set(edges.map(
      (edge) => edge.properties.sourceReadOccurrenceId,
    )).size).toBe(2);
    expect(edges.map((edge) => {
      const path = edge.properties.logicalInputPath;
      return Array.isArray(path)
        ? path.find((item) =>
            typeof item === "string"
            && /:root\.(?:left|right\.args\[0\])$/.test(item),
          )
        : null;
    }).sort()).toEqual([
      expect.stringMatching(/:root\.left$/),
      expect.stringMatching(/:root\.right\.args\[0\]$/),
    ]);
  }, 60_000);

  it("fails closed when one structured operand has duplicate raw bindings", () => {
    const expression = {
      expression_id: "expr:duplicate",
      relation_id: "rel:project",
      ordinal: 0,
      output_name: "value",
      expression_text: "x.value",
      input_fields: [{ table: "demo.trade", column: "amount" }],
    };
    const duplicateInput = {
      name: "value",
      qualifier: "x",
      physical: [{ table: "demo.trade", column: "amount" }],
    };
    const rawExpression = {
      output: "value",
      input_columns: [duplicateInput, { ...duplicateInput }],
      structured_expression: { kind: "COLUMN", name: "value", qualifier: "x" },
    };
    const index = buildRelationTreeIndex([{
      task_id: "duplicate",
      statement_id: "statement:0",
      relation_id: "rel:project",
      relation_type: "project",
      relation: { type: "project", scope_id: "opaque:root", scope_bindings: [] },
    }]);

    expect(routeNamedOutputContexts({
      expression,
      sourceTable: "demo.trade",
      sourceColumn: "amount",
      relationExpressionsByRelationId: new Map([["rel:project", [rawExpression]]]),
      expressionsByRelation: expressionsByRelationAndOrdinal([expression]),
      index,
    })).toEqual([]);
  });

  it("does not choose between unstructured inputs that share one qualifier", () => {
    const expression = {
      expression_id: "expr:unstructured-duplicate",
      relation_id: "rel:project",
      ordinal: 0,
      output_name: "value",
      expression_text: "x.left_value - x.right_value",
      input_fields: [{ table: "demo.trade", column: "amount" }],
    };
    const rawExpression = {
      output: "value",
      input_columns: ["left_value", "right_value"].map((name) => ({
        name,
        qualifier: "x",
        physical: [{ table: "demo.trade", column: "amount" }],
      })),
    };
    const index = buildRelationTreeIndex([{
      task_id: "unstructured-duplicate",
      statement_id: "statement:0",
      relation_id: "rel:project",
      relation_type: "project",
      relation: { type: "project", scope_id: "opaque:root", scope_bindings: [] },
    }]);

    expect(routeNamedOutputContexts({
      expression,
      sourceTable: "demo.trade",
      sourceColumn: "amount",
      relationExpressionsByRelationId: new Map([["rel:project", [rawExpression]]]),
      expressionsByRelation: expressionsByRelationAndOrdinal([expression]),
      index,
      referenceQualifier: "x",
    })).toEqual([]);
  });
});
