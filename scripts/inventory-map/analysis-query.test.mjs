import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { buildAnalysisIndex } from "./analysis-index.mjs";
import { queryAnalysis } from "./analysis-query.mjs";

const sha = (value) => createHash("sha256").update(value).digest("hex");
const dataset = (id, name, dataSource = "instance-a") => ({
  nodeId: id,
  nodeType: "PHYSICAL_DATASET",
  properties: {
    qualifiedName: name,
    platform: "hive",
    dataSource,
    identityStatus: "CONFIRMED",
  },
});
const OUTPUT = dataset("dataset:output", "mart.result");
const INPUT_A = dataset("dataset:input-a", "source.orders", "instance-a");
const INPUT_B = dataset("dataset:input-b", "source.orders", "instance-b");
const INPUT_OTHER = dataset(
  "dataset:input-other",
  "source.orders",
  "instance-other",
);
const fieldId = (tableId, column) =>
  `field:${Buffer.from(JSON.stringify([tableId, column])).toString("base64url")}`;

function projectionFixture(
  root,
  taskId,
  reads,
  write,
  expressionText = "",
  outputColumn = "amount",
) {
  const directory = join(root, taskId);
  mkdirSync(join(directory, "versions"), { recursive: true });
  const cacheKey = sha(`cache:${taskId}`);
  const observation = `write-observation:${taskId}:sql:0`;
  const targetWriteId = `target-write:${taskId}`;
  const query = `SELECT ${expressionText || outputColumn} AS ${outputColumn} FROM ${reads[0]?.properties.qualifiedName || "source.orders"}`;
  const create = `CREATE TABLE ${write.properties.qualifiedName} (${outputColumn} decimal(20,4))`;
  const bindingId = `binding:${taskId}:${outputColumn}`;
  const expressionId = `expression:${taskId}:${outputColumn}`;
  const nodes = [
    {
      nodeId: `task:${taskId}`,
      nodeType: "TASK",
      properties: { taskName: `任务 ${taskId}` },
    },
    ...reads,
    write,
    {
      nodeId: targetWriteId,
      nodeType: "TARGET_WRITE",
      properties: {
        qualifiedName: write.properties.qualifiedName,
        writeObservationId: observation,
      },
    },
    ...reads.map((input, i) => ({
      nodeId: `read:${taskId}:${i}`,
      nodeType: "READ_OCCURRENCE",
      properties: { qualifiedName: input.properties.qualifiedName },
    })),
  ];
  const projection = {
    taskId,
    coverageStatus: "PROJECTED",
    coverageDisposition: "DATA_LINEAGE",
    generatedAt: "2026-09-07T00:00:00Z",
    nodes,
    edges: [
      ...reads.map((input, i) => ({
        edgeId: `reads:${taskId}:${i}`,
        edgeType: "READS",
        fromNodeId: `read:${taskId}:${i}`,
        toNodeId: input.nodeId,
        properties: { readDisposition: "EXTERNAL_READ" },
      })),
      {
        edgeId: `writes:${taskId}`,
        edgeType: "WRITES",
        fromNodeId: targetWriteId,
        toNodeId: write.nodeId,
        properties: { writeObservationId: observation },
      },
    ],
    localClosure: {
      externalReads: reads.map((input, i) => ({
        datasetNodeId: input.nodeId,
        qualifiedName: input.properties.qualifiedName,
        readOccurrenceId: `occurrence:${taskId}:${i}`,
        readOccurrenceNodeId: `read:${taskId}:${i}`,
        identityStatus: "CONFIRMED",
      })),
      finalWrites: [
        {
          datasetNodeId: write.nodeId,
          qualifiedName: write.properties.qualifiedName,
          targetWriteNodeId: targetWriteId,
          writeObservationId: observation,
        },
      ],
    },
  };
  const evidence = {
    taskId,
    sqlSources: [
      { slot: "query", content: query, sha256: sha(query) },
      { slot: "create", content: create, sha256: sha(create) },
    ],
    expressions: [
      {
        expression_id: expressionId,
        statement_id: `task:${taskId}:slot:query:statement:0`,
        source_span: { start: 7, end: 7 + expressionText.length },
        expression_text: expressionText,
        input_dependency_status: "CONFIRMED",
        input_fields: [
          { table: reads[0]?.properties.qualifiedName, column: "amount" },
        ],
      },
    ],
    bindings: [
      {
        binding_id: bindingId,
        task_id: taskId,
        write_observation_id: observation,
        target_dataset: write.properties.qualifiedName,
        target_field: outputColumn,
        target_ordinal: 0,
        expression_id: expressionId,
        binding_status: "BOUND",
        evidence_kind: "SQL_WRITE",
      },
    ],
  };
  writeFileSync(
    join(directory, "task-local-projection.json"),
    JSON.stringify({ cacheKey, projection }),
  );
  writeFileSync(
    join(directory, "versions", `${cacheKey}.evidence-v3.json`),
    JSON.stringify(evidence),
  );
}

async function fixture(t, { ambiguousInput = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "inventory-analysis-query-"));
  let ctx;
  t.after(() => {
    ctx?.close();
    rmSync(root, { recursive: true, force: true });
  });
  const projectionRoot = join(root, "tasks");
  mkdirSync(projectionRoot);
  projectionFixture(
    projectionRoot,
    "901001",
    ambiguousInput ? [INPUT_A, INPUT_B] : [INPUT_A],
    OUTPUT,
    "amount * 2",
  );
  projectionFixture(projectionRoot, "901002", [INPUT_B], OUTPUT, "amount + 10");
  projectionFixture(
    projectionRoot,
    "901003",
    [OUTPUT],
    dataset("dataset:consumer-output", "mart.report"),
    "amount",
  );
  projectionFixture(
    projectionRoot,
    "901004",
    [INPUT_OTHER],
    dataset("dataset:unrelated-output", "mart.other_result"),
    "amount",
  );
  const hiveCorePath = join(root, "core.jsonl");
  const hiveDefinitionPath = join(root, "definition.jsonl");
  writeFileSync(
    hiveCorePath,
    JSON.stringify({
      guid: "core-result",
      qualifiedname: "mart.result@instance-a",
      type_name: "hive_table",
    }) + "\n",
  );
  writeFileSync(
    hiveDefinitionPath,
    [
      {
        guid: "old-result",
        qualifiedname: "mart.result@instance-a:100",
        querytext: "CREATE TABLE mart.result (catalog_only bigint)",
      },
      {
        guid: "new-result",
        qualifiedname: "mart.result@instance-a:200",
        querytext: "CREATE TABLE mart.result (different_catalog_only string)",
      },
      {
        guid: "order-view",
        qualifiedname: "source.order_view@instance-a:300",
        querytext:
          "CREATE VIEW source.order_view AS SELECT amount FROM source.orders",
      },
    ]
      .map(JSON.stringify)
      .join("\n") + "\n",
  );
  const outputRoot = join(root, "output");
  await buildAnalysisIndex({
    projectionRoot,
    hiveCorePath,
    hiveDefinitionPath,
    outputRoot: join(outputRoot, "analysis"),
  });
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE tasks(id TEXT PRIMARY KEY,name TEXT,topic TEXT,schema_name TEXT,in_inventory INTEGER,in_degree INTEGER,out_degree INTEGER); CREATE TABLE evidence_refs(task_id TEXT,evidence_type TEXT,direction TEXT,depth INTEGER,observed_at TEXT,content_sha256 TEXT);",
  );
  for (const id of ["901001", "901002", "901003", "901004", "999999"])
    db.prepare("INSERT INTO tasks VALUES(?,?,?,?,1,0,0)").run(
      id,
      `任务 ${id}`,
      "业务主题",
      "mart",
    );
  ctx = {
    db,
    outputRoot,
    summary: { limits: { maxPageSize: 100 } },
    close: () => db.close(),
  };
  return ctx;
}

test("expanding a writer preserves the table scene, other writer and consumer", async (t) => {
  const ctx = await fixture(t);
  const start = await queryAnalysis(ctx, "analysis-view", {
    id: OUTPUT.nodeId,
  });
  const expected = [OUTPUT.nodeId, "task:901001", "task:901002", "task:901003"];
  assert.ok(expected.every((id) => start.nodes.some((node) => node.id === id)));
  const expanded = await queryAnalysis(ctx, "analysis-view", {
    id: OUTPUT.nodeId,
    focus: "task:901001",
    expanded: JSON.stringify(["task:901001"]),
  });
  assert.equal(expanded.sceneRootId, OUTPUT.nodeId);
  assert.equal(expanded.focus.id, "task:901001");
  assert.ok(
    [...expected, INPUT_A.nodeId].every((id) =>
      expanded.nodes.some((node) => node.id === id),
    ),
  );
  assert.ok(
    expanded.edges.some(
      (edge) =>
        edge.source === INPUT_A.nodeId &&
        edge.target === "task:901001" &&
        edge.kind === "READS",
    ),
  );
  assert.ok(
    expanded.edges.some(
      (edge) => edge.source === "task:901002" && edge.target === OUTPUT.nodeId,
    ),
  );
});

test("field focus keeps writer formulas and same-name physical namespaces separate", async (t) => {
  const ctx = await fixture(t);
  const scene = await queryAnalysis(ctx, "analysis-view", {
    id: OUTPUT.nodeId,
    focus: fieldId(OUTPUT.nodeId, "amount"),
  });
  assert.deepEqual(
    scene.writers.map((writer) => [writer.id, writer.expressions[0].text]),
    [
      ["task:901001", "amount * 2"],
      ["task:901002", "amount + 10"],
    ],
  );
  const sourceEdges = scene.edges.filter((edge) => edge.kind === "FIELD_INPUT");
  assert.ok(
    sourceEdges.some(
      (edge) =>
        edge.source === fieldId(INPUT_A.nodeId, "amount") &&
        edge.target === "task:901001",
    ),
  );
  assert.ok(
    sourceEdges.some(
      (edge) =>
        edge.source === fieldId(INPUT_B.nodeId, "amount") &&
        edge.target === "task:901002",
    ),
  );
  assert.ok(
    !scene.nodes.some(
      (node) => node.id === fieldId(INPUT_OTHER.nodeId, "amount"),
    ),
  );
  assert.ok(
    !sourceEdges.some(
      (edge) =>
        edge.source === fieldId(INPUT_A.nodeId, "amount") &&
        edge.target === "task:901002",
    ),
  );
});

test("ambiguous same-name reads are retained as an identity gap, not guessed", async (t) => {
  const ctx = await fixture(t, { ambiguousInput: true });
  const scene = await queryAnalysis(ctx, "analysis-view", {
    id: OUTPUT.nodeId,
    focus: fieldId(OUTPUT.nodeId, "amount"),
  });
  assert.ok(scene.stoppedBy.includes("INPUT_IDENTITY_UNRESOLVED"));
  assert.ok(
    !scene.edges.some(
      (edge) => edge.kind === "FIELD_INPUT" && edge.target === "task:901001",
    ),
  );
  assert.ok(
    scene.writers
      .find((writer) => writer.id === "task:901001")
      .expressions[0].text.includes("* 2"),
  );
});

test("same-name catalog definitions remain candidates and do not add physical fields", async (t) => {
  const ctx = await fixture(t);
  const scene = await queryAnalysis(ctx, "analysis-view", {
    id: OUTPUT.nodeId,
  });
  assert.equal(scene.definitionCandidates.length, 2);
  assert.ok(
    scene.definitionCandidates.every(
      (candidate) => candidate.match === "NAME_ONLY_CANDIDATE",
    ),
  );
  assert.deepEqual(
    scene.fields.items.map((field) => field.name),
    ["amount"],
  );
  const catalog = (
    await queryAnalysis(ctx, "analysis-search", { q: "mart.result" })
  ).items.filter((item) => item.catalogOnly);
  assert.equal(catalog.length, 3);
  const definitionCatalog = catalog.find(
    (item) => item.objectType === "hive_table_definition",
  );
  const catalogFields = await queryAnalysis(ctx, "analysis-fields", {
    id: definitionCatalog.id,
  });
  assert.equal(catalogFields.items.length, 1);
  assert.match(catalogFields.items[0].name, /catalog_only/);
  const definition = scene.definitionCandidates[0];
  const sql = await queryAnalysis(ctx, "analysis-sql", {
    id: definition.id,
    lineCount: 1,
  });
  assert.equal(sql.available, true);
  assert.equal(sql.source.kind, "CATALOG_DEFINITION");
  assert.match(sql.sql, /create table/i);
  assert.equal(sql.contentSha256, definition.hash);
});

test("an inventory-only task exposes the processing coverage gap without synthetic edges", async (t) => {
  const ctx = await fixture(t);
  const result = await queryAnalysis(ctx, "analysis-view", {
    id: "task:999999",
  });
  assert.equal(result.focus.inventory, true);
  assert.equal(result.writers[0].available, false);
  assert.equal(result.fields.available, false);
  assert.equal(result.edges.length, 0);
  assert.ok(
    result.observations.some((observation) =>
      observation.title.includes("缺口"),
    ),
  );
});

test("schema/view searches use metadata types, and invalid search limits fail", async (t) => {
  const ctx = await fixture(t);
  const schemas = await queryAnalysis(ctx, "analysis-search", {
    kind: "schema",
    q: "source",
  });
  assert.deepEqual(
    schemas.items.map((item) => item.id),
    ["schema:source"],
  );
  const views = await queryAnalysis(ctx, "analysis-search", {
    kind: "view",
    schema: "source",
  });
  assert.equal(views.items.length, 1);
  assert.equal(views.items[0].qualifiedName, "source.order_view");
  assert.equal(views.items[0].catalogOnly, true);
  for (const parameters of [
    { limit: 0 },
    { limit: 61 },
    { offset: -1 },
    { kind: "bogus" },
    { q: null },
  ]) {
    await assert.rejects(
      queryAnalysis(ctx, "analysis-search", parameters),
      (error) => error.code === "INVALID_ARGUMENT",
    );
  }
});

test("combined search includes task names and pages across catalogues without gaps", async (t) => {
  const ctx = await fixture(t);
  const named = await queryAnalysis(ctx, "analysis-search", { q: "任务" });
  assert.equal(named.total, 5);
  assert.ok(named.items.every((item) => item.kind === "task"));
  const complete = await queryAnalysis(ctx, "analysis-search", { limit: 60 });
  const seen = [];
  for (let offset = 0; offset !== null;) {
    const result = await queryAnalysis(ctx, "analysis-search", {
      limit: 3,
      offset,
    });
    seen.push(...result.items.map((item) => item.id));
    offset = result.nextOffset;
  }
  assert.deepEqual(
    seen,
    complete.items.map((item) => item.id),
  );
  assert.equal(new Set(seen).size, seen.length);
  assert.ok(complete.items.slice(0, 4).some((item) => item.kind === "task"));
});
