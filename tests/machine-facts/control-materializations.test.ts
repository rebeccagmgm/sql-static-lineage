import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { deriveTaskLocalMaterializations, runTask, validateBundle } from "../../scripts/machine-facts/machine-facts.ts";
import { canonicalJson, canonicalJsonl, sha256 } from "../../scripts/machine-facts/machine-facts-contract.ts";
import { gzipCanonicalBytes, readJsonlRecords } from "../../scripts/machine-facts/jsonl-store.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    const child = relative(resolve(tmpdir()), resolve(root));
    if (isAbsolute(child) || child.startsWith("..") || !child.startsWith("control-materializations-")) throw new Error("unsafe fixture cleanup");
    rmSync(root, { recursive: true, force: true });
  }
});

function facts(query: string) {
  const root = mkdtempSync(join(tmpdir(), "control-materializations-"));
  roots.push(root);
  const sqlFile = join(root, "query.sql");
  writeFileSync(sqlFile, `CREATE TABLE demo.mid AS SELECT id, flag FROM demo.source;\n${query};`);
  const schema = { records: ["source", "mid", "target"].map(name => ({
    qualified_name: `demo.${name}`, status: "SUCCESS", columns: [{ name: "id" }, { name: "flag" }],
  })) };
  const task = { task_id: "control-proof", sql_snapshot: sqlFile };
  const run = runTask(task, { schema_version: "test", dialect: "databricks", tasks: [task] },
    "test", root, schema, sha256(canonicalJson(schema)));
  expect(run.state, JSON.stringify(run)).toBe("SUCCESS");
  const bundle = join(root, "registry/tasks/control-proof/bundle");
  return {
    bundle,
    bridges: readJsonlRecords(join(bundle, "task-local-materializations.jsonl")) as any[],
    relations: readJsonlRecords(join(bundle, "relation-nodes.jsonl")) as any[],
    reads: readJsonlRecords(join(bundle, "dataset-io.jsonl")) as any[],
    statements: readJsonlRecords(join(bundle, "statements.jsonl")) as any[],
    expressions: readJsonlRecords(join(bundle, "field-expression-nodes.jsonl")) as any[],
    bindings: readJsonlRecords(join(bundle, "output-field-bindings.jsonl")) as any[],
    schemas: readJsonlRecords(join(bundle, "schema-refs.jsonl")) as any[],
  };
}

function rederive(result: ReturnType<typeof facts>) {
  return deriveTaskLocalMaterializations("control-proof", "test", undefined, result.statements,
    result.reads, result.expressions, result.bindings, result.schemas, result.relations);
}

describe("control consumer materializations", () => {
  it("shares one producer bridge while preserving four UNION filter read occurrences", () => {
    const result = facts(["I", "U", "S", "D"].map(flag =>
      `SELECT id FROM demo.mid WHERE flag = '${flag}'`).join(" UNION ALL "));
    const flag = result.bridges.filter(bridge => bridge.column === "flag");
    expect(flag).toHaveLength(1);
    expect(flag[0]).toMatchObject({ status: "RESOLVED", read_expression_ids: [] });
    expect(flag[0].read_control_refs).toHaveLength(4);
    expect(new Set(flag[0].read_control_refs.map((ref: any) => ref.relation_id)).size).toBe(4);
    expect(new Set(flag[0].read_control_refs.map((ref: any) => ref.read_occurrence_id)).size).toBe(4);
    for (const ref of flag[0].read_control_refs) {
      expect(ref.resolution_status).toBe("RESOLVED");
      const filter = result.relations.find(relation => relation.relation_id === ref.relation_id);
      const read = result.relations.find(relation => relation.relation_id === ref.read_relation_id);
      expect(filter.relation_type).toBe("filter");
      expect(filter.relation.source).toBe(read.relation_id);
      expect(read.relation.read_occurrence_id).toBe(ref.read_occurrence_id);
    }
  });

  it("adds control uses without changing value bridge identity or expression consumption", () => {
    const plain = facts("SELECT id, flag FROM demo.mid");
    const filtered = facts("SELECT id, flag FROM demo.mid WHERE flag = 'I'");
    for (const bridge of plain.bridges) {
      const counterpart = filtered.bridges.find(item => item.bridge_id === bridge.bridge_id);
      expect(counterpart).toBeDefined();
      expect(counterpart.read_expression_ids).toEqual(bridge.read_expression_ids);
      expect(counterpart.write_observation_id).toBe(bridge.write_observation_id);
      expect(counterpart.output_binding_id).toBe(bridge.output_binding_id);
    }
    expect(filtered.bridges.find(item => item.column === "flag").read_control_refs).toHaveLength(1);
    expect(filtered.bridges.find(item => item.column === "id").read_control_refs).toBeUndefined();
  });

  it("uses alias evidence to separate self-join sides and retains each JOIN consumption", () => {
    const result = facts("SELECT a.id FROM demo.mid a JOIN demo.mid b ON a.flag = b.flag WHERE a.flag = 'I'");
    const bridge = result.bridges.find(item => item.column === "flag");
    expect(bridge.read_expression_ids).toEqual([]);
    expect(bridge.read_control_refs).toHaveLength(3);
    for (const ref of bridge.read_control_refs) expect(ref.resolution_status).toBe("RESOLVED");
    const joinRefs = bridge.read_control_refs.filter((ref: any) => result.relations.find(
      relation => relation.relation_id === ref.relation_id).relation_type === "join");
    expect(new Set(joinRefs.map((ref: any) => ref.read_relation_id)).size).toBe(2);
  });

  it("does not invent physical identity for an unresolved unqualified self-join control", () => {
    const result = facts("SELECT a.id FROM demo.mid a JOIN demo.mid b ON a.id = b.id WHERE flag = 'I'");
    expect(result.bridges.find(item => item.column === "flag")).toBeUndefined();
    const filter = result.relations.find(item => item.relation_type === "filter");
    expect(filter.relation.predicate_columns[0]).toMatchObject({ resolution: "UNRESOLVED", physical: null });
  });

  it("retains ambiguity when the field is physical but its repeated read cannot be distinguished", () => {
    const result = facts("SELECT a.id FROM demo.mid a JOIN demo.mid b ON a.id = b.id WHERE a.flag = 'I'");
    const filter = result.relations.find(item => item.relation_type === "filter");
    delete filter.relation.predicate_columns[0].qualifier;
    const bridge = rederive(result).find(item => item.column === "flag")!;
    expect(bridge.read_expression_ids).toEqual([]);
    expect(bridge.read_control_refs).toEqual([expect.objectContaining({
      resolution_status: "AMBIGUOUS", read_relation_id: null, read_occurrence_id: null,
      reason_code: "CONTROL_READ_OCCURRENCE_AMBIGUOUS",
    })]);
  });

  it("retains missing occurrence proof and never promotes an unresolved producer binding", () => {
    const result = facts("SELECT id FROM demo.mid WHERE flag = 'I'");
    const input = result.reads.find(item => item.direction === "READ" && item.physical_dataset === "demo.mid");
    input.read_occurrences = [];
    let bridge = rederive(result).find(item => item.column === "flag")!;
    expect(bridge.read_control_refs).toEqual([expect.objectContaining({
      resolution_status: "UNRESOLVED", read_relation_id: null, read_occurrence_id: null,
      reason_code: "CONTROL_READ_OCCURRENCE_NOT_PROVEN",
    })]);
    result.bindings.find(item => item.target_field === "flag").binding_status = "UNRESOLVED";
    bridge = rederive(result).find(item => item.column === "flag")!;
    expect(bridge.status).toBe("UNRESOLVED");
    expect(bridge.output_binding_id).toBeNull();
  });

  it("validates generated control reference schema and endpoints", () => {
    const result = facts("SELECT id FROM demo.mid WHERE flag = 'I'");
    expect(validateBundle(result.bundle)).toEqual([]);
  });

  it("rejects a control reference pointing into another UNION branch and invalid unknown claims", () => {
    const result = facts("SELECT id FROM demo.mid WHERE flag = 'I' UNION ALL SELECT id FROM demo.mid WHERE flag = 'U'");
    const bridge = result.bridges.find(item => item.column === "flag");
    const [first, second] = bridge.read_control_refs;
    first.read_relation_id = second.read_relation_id;
    first.read_occurrence_id = second.read_occurrence_id;
    const persist = () => writeFileSync(join(result.bundle, "task-local-materializations.jsonl.gz"),
      gzipCanonicalBytes(canonicalJsonl(result.bridges)));
    persist();
    expect(validateBundle(result.bundle)).toEqual(expect.arrayContaining([
      expect.stringContaining("materialization control read occurrence not proven"),
    ]));
    first.resolution_status = "UNRESOLVED";
    persist();
    expect(validateBundle(result.bundle)).toEqual(expect.arrayContaining([
      expect.stringContaining("unresolved materialization control must retain reason and null endpoints"),
    ]));
    first.resolution_status = "GUESS";
    persist();
    expect(validateBundle(result.bundle)).toEqual(expect.arrayContaining([
      expect.stringContaining("read_control_refs[0].resolution_status: pattern mismatch"),
    ]));
  });
});
