import { describe, expect, it } from "vitest";
import { explainTaskField } from "../src/asset-graph/task-field-explanation.ts";
import type { Evidence } from "../src/asset-graph/evidence-json.ts";
import { queryTaskFieldExplanation } from "../src/asset-graph/task-field-explanation-query.ts";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function fixture(): Evidence {
  const expressions = [
    { expression_id: "e1", statement_id: "task:1:slot:create:statement:0", relation_id: "p1", ordinal: 0, output_name: "label", expression_text: "CASE WHEN s.code='1' THEN 'yes' ELSE 'no' END", input_dependency_status: "PHYSICAL", input_fields: [{ table: "db.source", column: "code" }], expression_roles: [
      { role: "BRANCH_SELECTOR", path: "root.when[0]", effects: ["BRANCH_SELECTION"], input_fields: [{ table: "db.source", column: "code" }] },
      { role: "RESULT_VALUE", path: "root.then[0]", effects: ["VALUE_CONTRIBUTION"], input_fields: [] },
      { role: "RESULT_VALUE", path: "root.else", effects: ["VALUE_CONTRIBUTION"], input_fields: [] },
    ] },
    { expression_id: "e2", statement_id: "task:1:slot:create:statement:1", relation_id: "p2", ordinal: 0, output_name: "label", expression_text: "a.label", input_dependency_status: "PHYSICAL", input_fields: [{ table: "temp.first", column: "label" }] },
    { expression_id: "e3", statement_id: "task:1:slot:query:statement:0", relation_id: "p3", ordinal: 0, output_name: "label", expression_text: "b.label", input_dependency_status: "PHYSICAL", input_fields: [{ table: "temp.second", column: "label" }] },
  ];
  return {
    expressions,
    bindings: expressions.map((e, i) => ({ binding_id: `b${i + 1}`, write_observation_id: `w${i + 1}`, expression_id: e.expression_id, statement_id: e.statement_id, write_statement_id: e.statement_id, target_dataset: ["temp.first", "temp.second", "db.target"][i], target_field: "label", binding_status: "RESOLVED" })),
    statements: expressions.map((e, i) => ({ statement_id: e.statement_id, statement_index: i })),
    relations: expressions.flatMap((e, i) => [
      { relation_id: `p${i + 1}`, statement_id: e.statement_id, relation_type: "project", relation: { source: `r${i + 1}` } },
      { relation_id: `r${i + 1}`, statement_id: e.statement_id, relation_type: "read", physical_dataset: ["db.source", "temp.first", "temp.second"][i], relation: { binding: ["s", "a", "b"][i] } },
    ]),
    datasetIo: expressions.map((e, i) => ({ direction: "READ", statement_id: e.statement_id, physical_dataset: ["db.source", "temp.first", "temp.second"][i], resolution_status: "RESOLVED", read_occurrences: [{ occurrence_id: `r${i + 1}`, relation_id: `r${i + 1}` }] })),
    materializations: [1, 2].map(i => ({ bridge_id: `m${i}`, status: "RESOLVED", physical_dataset: ["temp.first", "temp.second"][i - 1], column: "label", read_statement_id: expressions[i]!.statement_id, read_expression_ids: [`e${i + 1}`], output_binding_id: `b${i}`, write_observation_id: `w${i}` })),
    packPartition: null, packTarget: null, sqlSources: [],
  };
}

describe("task field processing explanation", () => {
  const anchor = { taskId: "1", writeId: "w3", column: "label", version: "fixed" };
  it("preserves both temporary write stages and conditional rather than counterfeit value origins", () => {
    const result = explainTaskField(fixture(), anchor);
    expect(result.status).toBe("COMPLETE");
    expect(result.version).toBe("fixed");
    expect(result.stages.map(s => s.table).sort()).toEqual(["db.source", "db.target", "temp.first", "temp.second"].sort());
    expect(result.edges.filter(e => e.kind === "CONDITION")).toHaveLength(1);
    const source = result.stages.find(s => s.table === "db.source")!;
    expect(result.edges.filter(e => e.from === source.id).every(e => e.kind === "CONDITION")).toBe(true);
    expect(result.stages.find(s => s.table === "temp.first")?.expressions[0]?.text).toContain("CASE");
  });
  it("never chooses another write of the same table and column", () => {
    const e = fixture();
    e.bindings.push({ ...e.bindings[2], binding_id: "different", write_observation_id: "w4" });
    const result = explainTaskField(e, anchor);
    expect(result.stages.some(s => s.writeId === "w4")).toBe(false);
    expect(() => explainTaskField(e, { ...anchor, writeId: "" })).toThrow("WRITE_ID_REQUIRED");
  });
  it("matches a bare intermediate through its exact published read identity", () => {
    const e = fixture();
    e.expressions[2]!.input_fields = [{ table: "second", column: "label" }];
    e.relations[5]!.physical_dataset = "second";
    e.datasetIo[2]!.physical_dataset = "second";
    const result = explainTaskField(e, anchor, {}, [], new Map([["r3", "temp.second"]]));
    expect(result.status).toBe("COMPLETE");
    expect(result.stages.filter(s => s.kind === "WRITE").map(s => s.writeId).sort()).toEqual(["w1", "w2", "w3"]);
    expect(result.stages.some(s => s.kind === "SOURCE" && s.table === "second")).toBe(false);
    e.materializations = e.materializations!.slice(0, 1);
    const missing = explainTaskField(e, anchor, {}, [], new Map([["r3", "temp.second"]]));
    expect(missing.status).toBe("PARTIAL");
    expect(missing.gaps.some(g => g.code === "MATERIALIZATION_MISSING")).toBe(true);
  });
  it("keeps unresolved bridges and empty unknown expressions as gaps", () => {
    const e = fixture();
    e.materializations![1]!.status = "AMBIGUOUS";
    const result = explainTaskField(e, anchor);
    expect(result.status).toBe("PARTIAL");
    expect(result.gaps.some(g => g.code.includes("AMBIGUOUS"))).toBe(true);
    const unknown = fixture();
    unknown.expressions[0] = { ...unknown.expressions[0], input_fields: [], expression_roles: [], input_dependency_status: "UNRESOLVED" };
    expect(explainTaskField(unknown, anchor).status).toBe("PARTIAL");
  });
  it("reports finite budgets without declaring frontier nodes to be sources", () => {
    const result = explainTaskField(fixture(), anchor, { maxDepth: 1, maxNodes: 500, maxEdges: 1000 });
    expect(result.status).toBe("TRUNCATED");
    expect(result.stoppedBy).toContain("MAX_DEPTH");
    expect(result.frontierStageIds.length).toBeGreaterThan(0);
    expect(result.stages.every(s => s.kind !== "SOURCE")).toBe(true);
  });
  it("follows control-only materializations while preserving literal result values", () => {
    const e = fixture();
    e.expressions[2] = { ...e.expressions[2], expression_text: "'fixed'", input_fields: [], input_dependency_status: "NO_PHYSICAL_INPUT" };
    const filter = { relation_id: "f3", statement_id: e.expressions[2]!.statement_id, relation_type: "filter", source_text: "b.label='yes'", relation: { source: "r3", predicate_columns: [{ name: "label", qualifier: "b", resolution: "PHYSICAL", physical: [{ table: "temp.second", column: "label" }] }] } };
    (e.relations[4]!.relation as Record<string, unknown>).source = "f3";
    e.relations.push(filter);
    e.materializations![1]!.read_expression_ids = [];
    e.materializations![1]!.read_control_refs = [{ relation_id: "f3", read_relation_id: "r3", read_occurrence_id: "r3", resolution_status: "RESOLVED" }];
    const result = explainTaskField(e, anchor);
    expect(result.status).toBe("COMPLETE");
    expect(result.stages.find(s => s.role === "FINAL")?.controls[0]?.text).toBe("b.label='yes'");
    expect(result.edges.filter(edge => edge.to === result.stages[0]!.id).map(edge => edge.kind)).toEqual(["CONTROL"]);
    expect(result.stages.some(s => s.table === "temp.first")).toBe(true);
    const ref = (e.materializations![1]!.read_control_refs as Record<string, unknown>[])[0]!;
    ref.read_occurrence_id = "another-read";
    expect(explainTaskField(e, anchor).status).toBe("PARTIAL");
  });
  it("retains a missing relation as an evidence gap even for literal outputs", () => {
    const e = fixture();
    e.expressions[2] = { ...e.expressions[2], expression_text: "'fixed'", input_fields: [], input_dependency_status: "NO_PHYSICAL_INPUT" };
    (e.relations[4]!.relation as Record<string, unknown>).source = "missing";
    const result = explainTaskField(e, anchor);
    expect(result.gaps.some(g => g.code === "RELATION_EVIDENCE_MISSING")).toBe(true);
  });
  it("never upgrades unresolved predicate fields to confirmed control edges", () => {
    const e = fixture();
    e.expressions[2] = { ...e.expressions[2], expression_text: "'fixed'", input_fields: [], input_dependency_status: "NO_PHYSICAL_INPUT" };
    (e.relations[4]!.relation as Record<string, unknown>).source = "f3";
    e.relations.push({ relation_id: "f3", statement_id: e.expressions[2]!.statement_id, relation_type: "filter", relation: { source: "r3", predicate_columns: [{ name: "label", qualifier: "b", resolution: "UNRESOLVED", physical: [{ table: "temp.second", column: "label" }] }] } });
    const result = explainTaskField(e, anchor);
    expect(result.status).toBe("PARTIAL");
    expect(result.edges).toEqual([]);
  });
  it("retains resolved rowset sources for COUNT without inventing value columns", () => {
    const e = fixture();
    e.bindings = [e.bindings[0]!];
    e.expressions[0] = { ...e.expressions[0], expression_text: "COUNT(*)", expression_roles: [], input_fields: [], input_dependency_status: "NO_PHYSICAL_INPUT", structured_expression: { kind: "FUNCTION", name: "count", args: [{ kind: "UNSUPPORTED", sourceKind: "star" }] } };
    const result = explainTaskField(e, { ...anchor, writeId: "w1" });
    expect(result.status).toBe("COMPLETE");
    expect(result.stages.some(s => s.table === "db.source")).toBe(true);
    expect(result.edges.map(edge => ({ kind: edge.kind, columns: edge.columns }))).toEqual([{ kind: "CONTROL", columns: [] }]);
  });
  it("retains the other CROSS JOIN input as a rowset source", () => {
    const e = fixture();
    e.bindings = [e.bindings[0]!];
    e.expressions[0] = { ...e.expressions[0], expression_text: "s.code", expression_roles: [] };
    (e.relations[0]!.relation as Record<string, unknown>).source = "cross";
    e.relations.push({ relation_id: "cross", relation_type: "join", statement_id: e.expressions[0]!.statement_id, relation: { left: "r1", right: "other", join_type: "cross", condition_columns: [] } });
    e.relations.push({ relation_id: "other", relation_type: "read", statement_id: e.expressions[0]!.statement_id, physical_dataset: "db.other", relation: {} });
    e.datasetIo.push({ direction: "READ", statement_id: e.expressions[0]!.statement_id, physical_dataset: "db.other", resolution_status: "RESOLVED", read_occurrences: [{ occurrence_id: "other", relation_id: "other" }] });
    const result = explainTaskField(e, { ...anchor, writeId: "w1" });
    expect(result.status).toBe("COMPLETE");
    const other = result.stages.find(s => s.table === "db.other")!;
    expect(result.edges.filter(edge => edge.from === other.id).map(edge => edge.kind)).toEqual(["CONTROL"]);
  });
  it("retains every proven accumulated write to the same intermediate table", () => {
    const e = fixture();
    const extra = { ...e.bindings[1], binding_id: "b2extra", write_observation_id: "w2extra", expression_id: "literal" };
    e.bindings.push(extra);
    e.expressions.push({ ...e.expressions[1], expression_id: "literal", relation_id: "pExtra", input_fields: [], expression_text: "'appended'", input_dependency_status: "NO_PHYSICAL_INPUT" });
    e.relations.push({ relation_id: "pExtra", statement_id: e.expressions[1]!.statement_id, relation_type: "project", relation: {} });
    e.materializations![1] = { ...e.materializations![1], output_binding_id: null, write_observation_id: null, output_binding_ids: ["b2", "b2extra"], write_observation_ids: ["w2", "w2extra"] };
    const result = explainTaskField(e, anchor);
    expect(result.status).toBe("COMPLETE");
    expect(result.stages.filter(s => s.table === "temp.second")).toHaveLength(2);
    expect(result.edges.filter(edge => edge.to === result.stages[0]!.id)).toHaveLength(2);
  });
  it("does not mislabel INTERSECT or mixed set operations as UNION", () => {
    const e = fixture();
    e.expressions[2] = { ...e.expressions[2], role: "SETOP_OUTPUT" };
    e.relations[4] = { ...e.relations[4], relation_type: "setop", relation: { setop: "intersect", all: false, branches: ["p2"] } };
    const result = explainTaskField(e, anchor);
    expect(result.gaps.some(g => g.code === "SETOP_PROCESSING_UNSUPPORTED")).toBe(true);
    expect(result.edges.some(edge => edge.label?.includes("UNION"))).toBe(false);
  });
  it("validates node and edge budgets and names the stopped frontier", () => {
    expect(() => explainTaskField(fixture(), anchor, { maxNodes: NaN })).toThrow("INVALID_EXPLANATION_LIMIT");
    for (const option of [{ maxNodes: 1 }, { maxEdges: 1 }]) {
      const result = explainTaskField(fixture(), anchor, option);
      expect(result.status).toBe("TRUNCATED");
      expect(result.frontierStageIds.length).toBeGreaterThan(0);
    }
  });
  it("loads only the pinned published evidence and rejects a stale UI version", async () => {
    const directory = mkdtempSync(join(tmpdir(), "task-explain-"));
    const evidencePath = join(directory, "evidence.json"), manifestPath = join(directory, "manifest.json");
    writeFileSync(evidencePath, JSON.stringify(fixture()));
    const projectionPath = join(directory, "projection.json"), contentHash = "a".repeat(64);
    writeFileSync(projectionPath, JSON.stringify({ cacheKey: "b".repeat(64), cacheKeyParts: { taskId: "1", packContentHash: contentHash, factsManifestSha256: contentHash, schemaVersion: "1.3.0" }, projectionContentHash: contentHash,
      projection: { artifactType: "TASK_LOCAL_PROJECTION", taskId: "1", schemaVersion: "1.3.0", coverageStatus: "PROJECTED", failureReasonCode: null, contentHash, nodes: [], edges: [] } }));
    writeFileSync(manifestPath, JSON.stringify({ tasks: [{ taskId: "1", evidencePath, path: projectionPath, contentHash }] }));
    const store = { ready: async () => ({ version: "fixed", manifestPath }) } as Parameters<typeof queryTaskFieldExplanation>[0];
    const input = { taskId: "1", writeId: "w3", column: "label", publicationVersion: "fixed" };
    expect(await queryTaskFieldExplanation(store, input)).toEqual(explainTaskField(fixture(), anchor));
    const envelope = JSON.parse(readFileSync(projectionPath, "utf8"));
    envelope.projection.gaps = [{ reasonCode: "FIELD_DEPENDENCY_UNRESOLVED", details: { expressionId: "e1", unresolved: [{ table: "db.source", column: "code", reason: "SOURCE_TABLE_IDENTITY_AMBIGUOUS" }] } }];
    writeFileSync(projectionPath, JSON.stringify(envelope));
    expect((await queryTaskFieldExplanation(store, input)).status).toBe("PARTIAL");
    await expect(queryTaskFieldExplanation(store, { ...input, publicationVersion: "older" })).rejects.toThrow("PUBLICATION_VERSION_MISMATCH");
    const bare = fixture();
    bare.expressions[2]!.input_fields = [{ table: "second", column: "label" }];
    bare.relations[5]!.physical_dataset = "second";
    bare.datasetIo[2]!.physical_dataset = "second";
    writeFileSync(evidencePath, JSON.stringify(bare));
    envelope.projection.gaps = [];
    envelope.projection.nodes = [{ nodeType: "READ_OCCURRENCE", properties: { occurrenceId: "r3", identityStatus: "CONFIRMED", physicalDataset: "temp.second" } }];
    writeFileSync(projectionPath, JSON.stringify(envelope));
    expect((await queryTaskFieldExplanation(store, input)).stages.filter(s => s.kind === "WRITE")).toHaveLength(3);
    // A same-named occurrence that is ambiguous is never used as a bridge key.
    envelope.projection.nodes[0].properties.identityStatus = "AMBIGUOUS";
    envelope.projection.gaps = [{ reasonCode: "FIELD_DEPENDENCY_UNRESOLVED", details: { expressionId: "e3", unresolved: [{ table: "second", column: "label", reason: "SOURCE_TABLE_IDENTITY_AMBIGUOUS" }] } }];
    writeFileSync(projectionPath, JSON.stringify(envelope));
    const unresolved = await queryTaskFieldExplanation(store, input);
    expect(unresolved.status).toBe("PARTIAL");
    expect(unresolved.stages.filter(s => s.kind === "WRITE")).toHaveLength(1);
    expect(unresolved.edges.find(edge => edge.kind === "VALUE")?.status).toBe("UNRESOLVED");
  });
  it("carries only relevant published identity gaps into the displayed path", () => {
    const gaps = [{ reasonCode: "FIELD_DEPENDENCY_UNRESOLVED", details: { expressionId: "e1", unresolved: [{ table: "db.source", column: "code", reason: "SOURCE_TABLE_IDENTITY_AMBIGUOUS" }] } },
      { reasonCode: "UNRELATED", details: { expressionId: "another-field" } }];
    const result = explainTaskField(fixture(), anchor, {}, gaps);
    expect(result.status).toBe("PARTIAL");
    expect(result.gaps.map(g => g.code)).toEqual(["FIELD_DEPENDENCY_UNRESOLVED"]);
    expect(result.edges.filter(edge => edge.kind === "CONDITION").map(edge => edge.status)).toEqual(["UNRESOLVED"]);
    expect(result.edges.filter(edge => edge.kind === "VALUE").every(edge => edge.status === "RESOLVED")).toBe(true);
  });
});
