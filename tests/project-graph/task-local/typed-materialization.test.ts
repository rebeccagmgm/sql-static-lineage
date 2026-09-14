import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { writeTableInput, writeTaskInput } from "../../../scripts/input/shared/input-pack.ts";
import { runInputPackMachineFacts } from "../../../scripts/machine-facts/input-pack-machine-facts.ts";
import { projectTaskLocal } from "../../../scripts/project-graph/task-local/project-task-local.ts";
import { loadCurrentTaskBundle, type CurrentBundleLoad } from "../../../scripts/query/current-task-bundle.ts";

function project(create: string, query: string, transform?: (bundle: CurrentBundleLoad) => CurrentBundleLoad, taskName = "demo.typed_materialization") {
  const parent = mkdtempSync(join(tmpdir(), "typed-materialization-"));
  const dataRoot = join(parent, "data");
  const factsRoot = join(parent, "facts");
  for (const [qualifiedName, columns] of [
    ["demo.source", "a STRING, b STRING, c STRING, d STRING, e STRING, f STRING, g STRING"],
    ["demo.other", "a STRING, b STRING, c STRING, d STRING, e STRING, f STRING, g STRING"],
    ["temp.stage_001", "result STRING"],
    ["temp.stage_002", "result STRING"],
    ["demo.result", "result STRING"],
  ]) {
    writeTableInput(dataRoot, {
      platform: "hive", dataSource: "warehouse", qualifiedName: qualifiedName!,
      objectType: "hive_table", partitionFields: [],
      ddl: `CREATE TABLE ${qualifiedName} (${columns});`,
      evidenceProvider: "synthetic:test", collectedAt: "2026-01-01T00:00:00.000Z",
    });
  }
  writeTaskInput(dataRoot, {
    taskId: "typed-materialization", taskCategory: "hiveTask", taskName,
    target: { platform: "hive", dataSource: "warehouse", qualifiedName: "demo.result" },
    targetEvidenceKind: "DIRECT_PLATFORM_TARGET", partition: null,
    sql: {
      create: { content: create, evidenceProvider: "synthetic:test" },
      query: { content: query, evidenceProvider: "synthetic:test" },
    },
    evidenceProvider: "synthetic:test", collectedAt: "2026-01-01T00:00:00.000Z",
  });
  const facts = runInputPackMachineFacts({ dataRoot, outputRoot: factsRoot, taskIds: ["typed-materialization"] });
  expect(facts.tasks[0]?.state).toBe("SUCCESS");
  const projection = projectTaskLocal({
    dataRoot, factsRoot, taskId: "typed-materialization",
    ...(transform ? { currentBundle: transform(loadCurrentTaskBundle(factsRoot, "typed-materialization")) } : {}),
  });
  expect(projection.coverageStatus).toBe("PROJECTED");
  const finalWrite = projection.localClosure!.finalWrites.find((write) => write.qualifiedName === "demo.result")!;
  return { projection, finalEdges: projection.edges.filter((edge) => edge.toNodeId === finalWrite.targetWriteNodeId) };
}

describe("typed materialization", () => {
  it.each(["source", "(SELECT * FROM source)"])("preserves all fourteen selector inputs through %s using proven raw-to-canonical mappings", (sourceSql) => {
    const comparisons = ["a", "b", "c", "d", "e", "f", "g"].map((column) => `x.${column}=y.${column}`).join(" AND ");
    const { projection, finalEdges } = project("SET demo.test=1;",
      `INSERT OVERWRITE TABLE demo.result SELECT CASE WHEN ${comparisons} THEN 'yes' ELSE 'no' END AS result FROM ${sourceSql} x CROSS JOIN demo.other y`);
    const conditional = finalEdges.filter((edge) => edge.edgeType === "FIELD_CONDITIONAL");
    expect(conditional).toHaveLength(14);
    expect(conditional.every((edge) => edge.properties.sourceReadOccurrenceStatus === "RESOLVED")).toBe(true);
    expect(new Set(conditional.map((edge) => projection.nodes.find((node) => node.nodeId === edge.fromNodeId)?.properties.qualifiedName))).toEqual(new Set(["demo.source", "demo.other"]));
  });

  it("reports a rejected catalog-tail match without inventing a default schema", () => {
    const { projection, finalEdges } = project("SET demo.test=1;",
      "INSERT OVERWRITE TABLE demo.result SELECT CASE WHEN a='1' THEN 'yes' ELSE 'no' END AS result FROM source", undefined, "unqualified_task");
    expect(finalEdges.filter((edge) => edge.edgeType === "FIELD_CONDITIONAL")).toEqual([]);
    expect(projection.gaps?.some((gap) => Array.isArray(gap.details.unresolved) && gap.details.unresolved.some((input) => input.table === "source" && input.column === "a" && input.reason === "SOURCE_TABLE_QUALIFICATION_UNPROVEN"))).toBe(true);
  });

  it("preserves bare value inputs through a CTAS using the resolved leaf mapping", () => {
    const { projection, finalEdges } = project(
      "CREATE TABLE temp.stage_001 AS SELECT a AS result FROM source;",
      "INSERT OVERWRITE TABLE demo.result SELECT result FROM temp.stage_001");
    const value = finalEdges.filter((edge) => edge.edgeType === "FIELD_DIRECT");
    expect(value).toHaveLength(1);
    expect(value[0]!.properties.sourceReadOccurrenceStatus).toBe("RESOLVED");
    expect(value[0]!.properties.materializationBridgeIds).toHaveLength(1);
    expect(projection.nodes.find((node) => node.nodeId === value[0]!.fromNodeId)?.properties.qualifiedName).toBe("demo.source");
  });

  it("preserves the separate consumer mapping when reading a CTAS through a bare table name", () => {
    const { projection, finalEdges } = project(
      "CREATE TABLE demo.mid AS SELECT a AS result FROM demo.source;",
      "INSERT OVERWRITE TABLE demo.result SELECT result FROM mid");
    const value = finalEdges.filter((edge) => edge.edgeType === "FIELD_DIRECT");
    expect(value).toHaveLength(1);
    expect(value[0]!.properties.sourceReadOccurrenceStatus).toBe("RESOLVED");
    expect(value[0]!.properties.materializationBridgeIds).toHaveLength(1);
    expect(projection.nodes.find((node) => node.nodeId === value[0]!.fromNodeId)?.properties.qualifiedName).toBe("demo.source");
  });

  it("reports a source that cannot enter any emission context", () => {
    const { projection, finalEdges } = project("SET demo.test=1;",
      "INSERT OVERWRITE TABLE demo.result SELECT a AS result FROM demo.source",
      (bundle) => ({ ...bundle, records: { ...bundle.records,
        "field-expression-nodes.jsonl": (bundle.records["field-expression-nodes.jsonl"] ?? []).map((expression) => ({ ...expression, input_fields: [] })),
      } }));
    expect(finalEdges.filter((edge) => edge.edgeType === "FIELD_DIRECT")).toEqual([]);
    expect(projection.gaps?.some((gap) => gap.reasonCode === "FIELD_DEPENDENCY_UNRESOLVED" && gap.details.reason === "SOURCE_READ_SCOPE_NOT_EMITTED")).toBe(true);
  });

  it("keeps a SQL candidate filter unresolved even when its candidate has a table pack", () => {
    const { projection, finalEdges } = project("SET demo.test=1;",
      "INSERT OVERWRITE TABLE demo.result SELECT 'row' AS result FROM demo.source WHERE a='1'",
      (bundle) => ({ ...bundle, records: { ...bundle.records,
        "relation-nodes.jsonl": (bundle.records["relation-nodes.jsonl"] ?? []).map((relation) => relation.relation_type !== "filter" ? relation : ({
          ...relation, relation: {
            type: "filter", predicate_expr: "a='1'",
            predicate_columns: [{ name: "a", resolution: "SQL_CANDIDATE", physical: null, sql_candidate: [{ table: "demo.source", column: "a" }] }],
          },
        })),
      } }),
    );
    expect(finalEdges.filter((edge) => edge.edgeType === "DATASET_CONTROL")).toEqual([]);
    expect(projection.gaps?.some((gap) => gap.reasonCode === "DATASET_CONTROL_DEPENDENCY_UNRESOLVED" && typeof gap.details.relationId === "string")).toBe(true);
  });

  it("keeps the same physical field in separate UNION value and selector branches", () => {
    const { finalEdges } = project("SET demo.test=1;",
      "INSERT OVERWRITE TABLE demo.result SELECT a AS result FROM demo.source UNION ALL SELECT CASE WHEN a='1' THEN 'yes' ELSE 'no' END AS result FROM demo.source");
    const value = finalEdges.filter((edge) => edge.edgeType === "FIELD_DIRECT");
    const conditional = finalEdges.filter((edge) => edge.edgeType === "FIELD_CONDITIONAL");
    expect(value).toHaveLength(1);
    expect(conditional).toHaveLength(1);
    expect(value[0]!.properties.expressionId).not.toBe(conditional[0]!.properties.expressionId);
    expect(value[0]!.properties.sourceReadOccurrenceId).not.toBe(conditional[0]!.properties.sourceReadOccurrenceId);
  });

  it("preserves alias-specific value and selector occurrences in a self-join", () => {
    const { finalEdges } = project("SET demo.test=1;",
      "INSERT OVERWRITE TABLE demo.result SELECT CASE WHEN p.a='1' THEN q.a ELSE 'no' END AS result FROM demo.source p JOIN demo.source q ON p.b=q.b");
    const value = finalEdges.filter((edge) => edge.edgeType === "FIELD_DIRECT");
    const conditional = finalEdges.filter((edge) => edge.edgeType === "FIELD_CONDITIONAL");
    expect(value).toHaveLength(1);
    expect(conditional).toHaveLength(1);
    expect(value[0]!.properties.sourceReadOccurrenceId).toBeTruthy();
    expect(conditional[0]!.properties.sourceReadOccurrenceId).toBeTruthy();
    expect(value[0]!.properties.sourceReadOccurrenceId).not.toBe(conditional[0]!.properties.sourceReadOccurrenceId);
  });

  it("folds a constant-result CASE condition across two CTAS writes and star expansion", () => {
    const { projection, finalEdges } = project(
      "CREATE TABLE temp.stage_001 AS SELECT CASE WHEN a='1' THEN 'person' ELSE 'other' END AS result FROM demo.source;"
        + "CREATE TABLE temp.stage_002 AS SELECT s.* FROM temp.stage_001 s;",
      "INSERT OVERWRITE TABLE demo.result SELECT result FROM temp.stage_002",
    );
    expect(finalEdges.filter((edge) => edge.edgeType === "FIELD_DIRECT")).toHaveLength(0);
    const conditional = finalEdges.filter((edge) => edge.edgeType === "FIELD_CONDITIONAL");
    expect(conditional).toHaveLength(1);
    expect(conditional[0]!.properties.materializationBridgeIds).toHaveLength(2);
    expect(projection.nodes.find((node) => node.nodeId === conditional[0]!.fromNodeId)?.properties).toMatchObject({
      qualifiedName: "demo.source", column: "a",
    });
    expect((projection.gaps ?? []).filter((gap) => gap.reasonCode === "TASK_LOCAL_MATERIALIZATION_FIELD_BREAK")).toEqual([]);
  });

  it("composes both value and condition through an intermediate CASE and downstream selector", () => {
    const { projection, finalEdges } = project(
      "CREATE TABLE temp.stage_001 AS SELECT CASE WHEN a='1' THEN b ELSE c END AS result FROM demo.source;",
      "INSERT OVERWRITE TABLE demo.result SELECT CASE WHEN result='x' THEN 'yes' ELSE 'no' END AS result FROM temp.stage_001",
    );
    expect(finalEdges.filter((edge) => edge.edgeType === "FIELD_DIRECT")).toEqual([]);
    const conditionalColumns = finalEdges.filter((edge) => edge.edgeType === "FIELD_CONDITIONAL")
      .map((edge) => projection.nodes.find((node) => node.nodeId === edge.fromNodeId)?.properties.column).sort();
    expect(conditionalColumns).toEqual(["a", "b", "c"]);
  });

  it("keeps WHERE-only intermediate conditions on dataset controls", () => {
    const { projection, finalEdges } = project(
      "CREATE TABLE temp.stage_001 AS SELECT CASE WHEN a='1' THEN 'person' ELSE 'other' END AS result FROM demo.source;",
      "INSERT OVERWRITE TABLE demo.result SELECT 'row' AS result FROM temp.stage_001 WHERE result='person'",
    );
    expect(finalEdges.filter((edge) => edge.edgeType === "FIELD_DIRECT" || edge.edgeType === "FIELD_CONDITIONAL")).toEqual([]);
    const folded = finalEdges.filter((edge) => edge.edgeType === "DATASET_CONTROL" && edge.properties.materializationFolded);
    expect(folded).toHaveLength(1);
    expect(folded[0]!.properties).toMatchObject({ subtype: "FILTER", controlInputColumn: "result" });
    expect(folded[0]!.properties.outputColumn).toBeUndefined();
    expect(projection.nodes.find((node) => node.nodeId === folded[0]!.fromNodeId)?.properties.column).toBe("a");
  });

  it("retains an explicit gap when a control read is resolved but its producer is ambiguous", () => {
    const { projection, finalEdges } = project(
      "CREATE TABLE temp.stage_001 AS SELECT CASE WHEN a='1' THEN 'person' ELSE 'other' END AS result FROM demo.source;",
      "INSERT OVERWRITE TABLE demo.result SELECT 'row' AS result FROM temp.stage_001 WHERE result='person'",
      (bundle) => ({ ...bundle, records: { ...bundle.records,
        "task-local-materializations.jsonl": (bundle.records["task-local-materializations.jsonl"] ?? []).map((bridge) => ({
          ...bridge, status: "AMBIGUOUS", output_binding_id: null,
        })),
      } }),
    );
    expect(finalEdges.filter((edge) => edge.properties.materializationFolded)).toEqual([]);
    expect(projection.gaps?.some((gap) => gap.reasonCode === "TASK_LOCAL_CONTROL_MATERIALIZATION_UNRESOLVED"
      && gap.details.reason === "CONTROL_PRODUCER_NOT_PROVABLE")).toBe(true);
  });
});
