import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  parseDefinition,
  readTaskAnalysis,
  readTaskSql,
} from "./analysis-evidence.mjs";

const sha = (value) => createHash("sha256").update(value).digest("hex");
function fixture(t, mutate = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), "map-analysis-evidence-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const sql =
    "insert into out.a select src.x from src.t;\ninsert into out.b select src.y from src.t;";
  const projection = {
    taskId: "1",
    nodes: [
      {
        nodeId: "write:a",
        nodeType: "TARGET_WRITE",
        properties: { qualifiedName: "out.a", writeObservationId: "w:a" },
      },
      {
        nodeId: "write:b",
        nodeType: "TARGET_WRITE",
        properties: { qualifiedName: "out.b", writeObservationId: "w:b" },
      },
      {
        nodeId: "field:x",
        nodeType: "PHYSICAL_FIELD",
        properties: {
          qualifiedName: "src.t",
          column: "x",
          identityStatus: "CONFIRMED",
        },
      },
    ],
    edges: [
      {
        edgeType: "FIELD_DIRECT",
        fromNodeId: "field:x",
        toNodeId: "write:a",
        properties: {
          bindingId: "b:a",
          expressionId: "e:a",
          outputColumn: "value",
          subtype: "IDENTITY",
          sourceReadOccurrenceStatus: "RESOLVED",
        },
      },
      {
        edgeType: "DATASET_CONTROL",
        fromNodeId: "field:x",
        toNodeId: "write:a",
        properties: { subtype: "FILTER", writeObservationId: "w:a" },
      },
    ],
    localClosure: { finalWrites: [], externalReads: [] },
  };
  const evidence = {
    taskId: "1",
    sqlSources: [{ slot: "query", content: sql, sha256: sha(sql) }],
    bindings: [
      {
        binding_id: "b:a",
        expression_id: "e:a",
        task_id: "1",
        target_dataset: "out.a",
        target_field: "value",
        write_observation_id: "w:a",
        binding_status: "RESOLVED",
        evidence_kind: "SQL_EXPLICIT_WRITE",
        target_ordinal: 0,
      },
      {
        binding_id: "b:b",
        expression_id: "e:b",
        task_id: "1",
        target_dataset: "out.b",
        target_field: "value",
        write_observation_id: "w:b",
        binding_status: "UNKNOWN",
        evidence_kind: "PLATFORM_TARGET",
        target_ordinal: 0,
      },
      {
        binding_id: "b:wrong",
        expression_id: "e:unbound",
        task_id: "1",
        target_dataset: "out.b",
        target_field: "wrong",
        write_observation_id: "w:a",
        binding_status: "RESOLVED",
      },
    ],
    expressions: [
      {
        expression_id: "e:a",
        expression_text: "src.x",
        input_dependency_status: "PHYSICAL",
        input_fields: [{ table: "src.t", column: "x" }],
        source_span: { start: 25, end: 30 },
        statement_id: "task:1:slot:query:statement:0",
      },
      {
        expression_id: "e:b",
        expression_text: "src.y",
        input_dependency_status: "UNKNOWN",
        input_fields: [],
        statement_id: "task:1:slot:query:statement:1",
      },
      {
        expression_id: "e:unbound",
        expression_text: "must not leak into outputs",
        input_fields: [],
      },
    ],
  };
  const envelope = { cacheKey: "version-a", projection };
  mutate({ envelope, evidence });
  const projectionBytes = JSON.stringify(envelope),
    evidenceBytes = JSON.stringify(evidence);
  const artifact = {
    task_id: "1",
    cache_key: "version-a",
    projection_path: join(dir, "task-local-projection.json"),
    projection_hash: sha(projectionBytes),
    evidence_path: join(dir, "version-a.evidence-v3.json"),
    evidence_hash: sha(evidenceBytes),
    coverage_status: "PROJECTED",
    generated_at: "2026-09-07T00:00:00Z",
  };
  writeFileSync(artifact.projection_path, projectionBytes);
  writeFileSync(artifact.evidence_path, evidenceBytes);
  return { artifact, sql };
}

test("analysis binds each output field to its write and keeps controls separate", (t) => {
  const { artifact } = fixture(t);
  const result = readTaskAnalysis(artifact);
  assert.equal(result.available, true);
  assert.deepEqual(
    result.outputs.map((x) => [x.table, x.fields.map((f) => f.expressionId)]),
    [
      ["out.a", ["e:a"]],
      ["out.b", ["e:b"]],
    ],
  );
  assert.equal(result.outputs[0].fields[0].inputs[0].table, "src.t");
  assert.equal(result.outputs[0].controls[0].scope, "DATASET");
  assert.equal(result.outputs[0].fields[0].controls, undefined);
  assert.equal(result.outputs[1].fields[0].bindingStatus, "UNKNOWN");
  assert.equal(result.outputs[1].fields[0].inputStatus, "UNKNOWN");
  assert.equal(result.outputs[0].fields[0].sourceLine, 1);
  assert.equal(
    readTaskAnalysis(artifact, { outputTable: "out.b", outputColumn: "value" })
      .outputs.length,
    1,
  );
});

test("analysis fails closed for changed bytes, mismatched cache key and task", (t) => {
  const a = fixture(t);
  writeFileSync(a.artifact.evidence_path, "{}");
  assert.equal(readTaskAnalysis(a.artifact).reason, "EVIDENCE_HASH_MISMATCH");
  const b = fixture(t, ({ envelope }) => {
    envelope.cacheKey = "other";
  });
  assert.equal(readTaskAnalysis(b.artifact).reason, "CACHE_KEY_MISMATCH");
  const c = fixture(t, ({ evidence }) => {
    evidence.taskId = "2";
  });
  assert.equal(readTaskAnalysis(c.artifact).reason, "TASK_ID_MISMATCH");
});

test("self-join input occurrences retain ambiguous and resolved evidence independently", (t) => {
  const { artifact } = fixture(t, ({ envelope }) => {
    const edge = envelope.projection.edges[0];
    edge.properties.sourceReadOccurrenceId = "read:resolved";
    envelope.projection.edges.push({
      ...edge,
      edgeId: "edge:ambiguous",
      properties: {
        ...edge.properties,
        sourceReadOccurrenceId: null,
        sourceReadOccurrenceStatus: "AMBIGUOUS",
        sourceReadOccurrenceReason: "SELF_JOIN_NO_QUALIFIER",
      },
    });
  });
  const inputs = readTaskAnalysis(artifact).outputs[0].fields[0].inputs;
  assert.equal(inputs.length, 2);
  assert.deepEqual(inputs.map((x) => x.occurrenceStatus).sort(), [
    "AMBIGUOUS",
    "RESOLVED",
  ]);
  assert.equal(
    inputs.find((x) => x.occurrenceStatus === "AMBIGUOUS").occurrenceReason,
    "SELF_JOIN_NO_QUALIFIER",
  );
});

test("SQL reading validates content hashes and keeps line navigation", (t) => {
  const { artifact, sql } = fixture(t);
  const result = readTaskSql(artifact, { lineCount: 1 });
  assert.equal(result.available, true);
  assert.equal(result.sql, sql.split("\n")[0]);
  assert.equal(result.nextLine, 2);
  assert.equal(readTaskSql(artifact, { lineStart: 2 }).nextLine, null);
  const invalid = fixture(t, ({ evidence }) => {
    evidence.sqlSources[0].sha256 = "0".repeat(64);
  });
  assert.equal(readTaskSql(invalid.artifact).reason, "SQL_HASH_MISMATCH");
  assert.throws(() => readTaskSql(artifact, { lineStart: 0 }), /lineStart/);
});

test("DDL reads quoted names, nested types, comments and partitions", () => {
  const result = parseDefinition(
    "-- create table fake(x int)\nCREATE EXTERNAL TABLE IF NOT EXISTS `pdata_n`.`sample` (`id` bigint COMMENT '标识', `comment` decimal(18, 4) COMMENT '金额,含税', nested struct<a:int,b:array<string>>, CONSTRAINT pk PRIMARY KEY(id)) COMMENT '表''说明' PARTITIONED BY (`busi_date` string COMMENT '业务日期') STORED AS ORC;",
  );
  assert.equal(result.objectType, "TABLE");
  assert.equal(result.qualifiedName, "pdata_n.sample");
  assert.equal(result.parseStatus, "PARSED");
  assert.deepEqual(
    result.fields.map((x) => x.name),
    ["id", "comment", "nested", "busi_date"],
  );
  assert.equal(result.fields[1].type, "decimal(18, 4)");
  assert.equal(result.fields[1].comment, "金额,含税");
  assert.equal(result.description, "表'说明");
  assert.equal(result.fields[3].partition, true);
});

test("CTAS and views never invent columns or field causality", () => {
  const ctas = parseDefinition(
    "CREATE TABLE pdata_n.target AS SELECT a,b FROM src.t",
  );
  assert.equal(ctas.objectType, "TABLE");
  assert.equal(ctas.parseStatus, "UNSUPPORTED");
  assert.deepEqual(ctas.fields, []);
  const view = parseDefinition(
    'CREATE VIEW "s"."v" AS SELECT a AS name FROM t',
  );
  assert.equal(view.objectType, "VIEW");
  assert.equal(view.qualifiedName, "s.v");
  assert.deepEqual(view.fields, []);
  assert.equal(
    parseDefinition("SELECT 'CREATE TABLE fake (x int)' FROM x").objectType,
    "UNKNOWN",
  );
});
