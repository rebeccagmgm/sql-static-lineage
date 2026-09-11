import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { buildInventoryMap } from "./build.mjs";
import { openMap, queryMap } from "./query.mjs";

const OBSERVED_AT = "2026-09-07T00:00:00.000Z";

function sourceSchema(db) {
  db.exec(`
    CREATE TABLE task_inventory (task_id TEXT PRIMARY KEY);
    CREATE TABLE evidence (
      task_id TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT '',
      depth INTEGER NOT NULL DEFAULT 0,
      format TEXT NOT NULL CHECK(format IN ('json','sql')),
      observed_at TEXT NOT NULL DEFAULT '',
      content_sha256 TEXT NOT NULL,
      payload_json TEXT,
      payload_text TEXT,
      source_path TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      PRIMARY KEY(task_id, evidence_type, direction, depth)
    );
    CREATE INDEX idx_evidence_type ON evidence(evidence_type);
  `);
}

function addEvidence(db, id, type, body, direction = "", depth = 0) {
  const payload = JSON.stringify({
    schema_version: "1.0",
    artifact_type: "schedule-evidence-cache",
    task_id: id,
    observed_at: OBSERVED_AT,
    ...body,
  });
  db.prepare(
    `INSERT INTO evidence VALUES (?, ?, ?, ?, 'json', ?, ?, ?, NULL, ?, ?)`,
  ).run(
    id,
    type,
    direction,
    depth,
    OBSERVED_AT,
    createHash("sha256").update(payload).digest("hex"),
    payload,
    `fixture/${id}/${type}.json`,
    OBSERVED_AT,
  );
}

function addRelation(db, id, direction, rows) {
  addEvidence(
    db,
    id,
    `horae-relation-${direction}-depth-1`,
    { direction, depth: 1, rows },
    direction,
    1,
  );
}

function rules(stageId = "source") {
  return {
    schemaVersion: 1,
    stages: [
      { id: "source", label: "输入", order: 0, color: "#3388cc" },
      { id: "processing", label: "加工", order: 1, color: "#cc8844" },
      { id: "unclassified", label: "未分类", order: 2, color: "#999999" },
    ],
    defaultStageId: "unclassified",
    topicRules: [
      { exact: "Alpha", stageId },
      { exact: "Beta", stageId: "processing" },
    ],
    limits: { maxNodes: 80, maxEdges: 200, maxDepth: 3, maxPageSize: 100 },
  };
}

function fixture(t, { malformedRows = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "inventory-map-build-test-"));
  const openMaps = [];
  t.after(() => {
    for (const map of openMaps) map.close();
    rmSync(root, { recursive: true, force: true });
  });
  const sourcePath = join(root, "source.sqlite");
  const outputRoot = join(root, "output");
  const rulesPath = join(root, "rules.json");
  writeFileSync(rulesPath, JSON.stringify(rules()));
  const db = new DatabaseSync(sourcePath);
  sourceSchema(db);
  for (const id of ["1", "2", "3", "4", "5"]) {
    db.prepare("INSERT INTO task_inventory VALUES (?)").run(id);
  }
  for (const [id, topic, name] of [
    ["1", "Alpha", "源表_交易😀"],
    ["2", "Beta", "加工'表; SELECT * FROM tasks"],
    ["3", "Beta", "产出"],
    ["4", "Alpha", "独立任务"],
  ]) {
    addEvidence(db, id, "szdata-schedule-detail", {
      detail: {
        taskId: id,
        taskName: name,
        topicName: topic,
        taskType: "58",
        status: "Y",
        database: "fixture_schema",
        cycle: "1",
        cycleUnit: "D",
        password: "must-not-leak",
        jdbc: "jdbc:private-fixture",
        inCharge: "private-fixture-owner",
      },
    });
  }
  // Alpha -> Beta occurs twice in one response and in reciprocal evidence.
  addRelation(
    db,
    "1",
    "down",
    malformedRows
      ? null
      : [
          { task_id: "2", total: 9 },
          { taskId: "2", total: 9 },
          { task_id: "1" },
          { task_id: "" },
          { task_id: null },
        ],
  );
  addRelation(db, "2", "up", [{ task_id: "1" }]);
  addRelation(db, "2", "down", [
    { task_id: "3" },
    { task_id: "999", task_name: "外部任务" },
  ]);
  addRelation(db, "3", "up", [{ task_id: "2" }]);
  addRelation(db, "3", "down", [{ task_id: "1" }]);
  // An explicitly empty cache is different from absent evidence for task 5.
  addRelation(db, "4", "up", []);
  addRelation(db, "4", "down", []);
  const insertSql = db.prepare(
    `INSERT INTO evidence VALUES (?, ?, '', 0, 'sql', ?, ?, NULL, ?, ?, ?)`,
  );
  for (const [id, type, sql] of [
    ["2", "hive-task", "SELECT secret_fixture_value FROM business_table"],
    ["1", "run-script", "SELECT run_script_fixture FROM business_table"],
    ["5", "hive-target-ddl", "CREATE TABLE fixture_table (id STRING)"],
  ]) {
    insertSql.run(
      id,
      type,
      OBSERVED_AT,
      createHash("sha256").update(sql).digest("hex"),
      sql,
      `fixture/${id}/task.sql`,
      OBSERVED_AT,
    );
  }
  db.close();
  return {
    root,
    sourcePath,
    outputRoot,
    rulesPath,
    closeAfterTest: (map) => openMaps.push(map),
  };
}

function fileHash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

test("build preserves inventory, directed pairs, reciprocal evidence and external references", async (t) => {
  const options = fixture(t);
  const originalHash = fileHash(options.sourcePath);
  const result = await buildInventoryMap(options);
  const map = openMap(options.outputRoot);
  options.closeAfterTest(map);

  assert.equal(
    fileHash(options.sourcePath),
    originalHash,
    "source evidence must remain byte-identical",
  );
  assert.equal(typeof result.version, "string");
  const inventory = ["1", "2", "3", "4", "5"].map(
    (id) => queryMap(map, "task", { id }).task,
  );
  assert.equal(inventory.length, 5);
  assert.ok(inventory.every((task) => task.inInventory));
  assert.equal(inventory.find((task) => task.id === "5").hasDetail, false);
  assert.equal(inventory.find((task) => task.id === "4").hasUp, true);
  assert.equal(inventory.find((task) => task.id === "4").hasDown, true);
  assert.equal(inventory.find((task) => task.id === "5").hasUp, false);
  assert.equal(inventory.find((task) => task.id === "5").hasDown, false);
  assert.equal(inventory.find((task) => task.id === "1").hasSql, true);
  assert.equal(inventory.find((task) => task.id === "2").hasSql, true);
  assert.equal(
    inventory.find((task) => task.id === "5").hasSql,
    false,
    "target DDL is SQL text but is not the task execution SQL",
  );

  const flows = queryMap(map, "flows", { limit: 100, offset: 0 });
  assert.equal(
    flows.total,
    5,
    "actual unique pairs, not rows[].total, determine edge counts",
  );
  assert.deepEqual(
    flows.items.map((edge) => `${edge.source}>${edge.target}`).sort(),
    ["1>1", "1>2", "2>3", "2>999", "3>1"],
  );
  const corroborated = flows.items.find(
    (edge) => edge.source === "1" && edge.target === "2",
  );
  assert.equal(corroborated.seenUp, true);
  assert.equal(corroborated.seenDown, true);
  const downOnly = flows.items.find((edge) => edge.target === "999");
  assert.equal(downOnly.seenUp, false);
  assert.equal(downOnly.seenDown, true);
  const external = queryMap(map, "task", { id: "999" }).task;
  assert.equal(external.inInventory, false);
  assert.equal(external.hasDetail, false);
});

test("queryable metadata is a whitelist and preserves business text literally", async (t) => {
  const options = fixture(t);
  await buildInventoryMap(options);
  const map = openMap(options.outputRoot);
  options.closeAfterTest(map);
  const task = queryMap(map, "task", { id: "2" });
  assert.equal(task.task.name, "加工'表; SELECT * FROM tasks");
  assert.equal(task.task.schemaName, "fixture_schema");
  assert.equal(task.task.hasSql, true);
  const serialized = JSON.stringify(task);
  assert.ok(!serialized.includes("must-not-leak"));
  assert.ok(!serialized.includes("jdbc:private-fixture"));
  assert.ok(!serialized.includes("private-fixture-owner"));
  assert.ok(!serialized.includes("secret_fixture_value"));
  assert.equal(queryMap(map, "task", { id: "1" }).task.name, "源表_交易😀");
});

test("changing a topic stage recomputes classification and version without changing source", async (t) => {
  const options = fixture(t);
  const originalHash = fileHash(options.sourcePath);
  const first = await buildInventoryMap(options);
  const before = openMap(options.outputRoot);
  const oldTask = queryMap(before, "task", { id: "1" }).task;
  const oldOverview = queryMap(before, "overview", {});
  before.close();
  assert.equal(oldTask.stageId, "source");

  writeFileSync(options.rulesPath, JSON.stringify(rules("processing")));
  const second = await buildInventoryMap(options);
  const after = openMap(options.outputRoot);
  options.closeAfterTest(after);
  assert.notEqual(second.version, first.version);
  assert.equal(queryMap(after, "task", { id: "1" }).task.stageId, "processing");
  assert.equal(queryMap(after, "task", { id: "4" }).task.stageId, "processing");
  assert.equal(queryMap(after, "tasks", { stage: "source" }).total, 0);
  assert.equal(queryMap(after, "tasks", { stage: "processing" }).total, 4);
  const newOverview = queryMap(after, "overview", {});
  assert.equal(
    oldOverview.nodes.find((node) => node.stageId === "source").taskCount,
    2,
  );
  assert.equal(
    oldOverview.nodes.find((node) => node.stageId === "processing").taskCount,
    2,
  );
  assert.equal(
    newOverview.nodes.find((node) => node.stageId === "processing").taskCount,
    4,
  );
  assert.ok(
    !newOverview.nodes.some(
      (node) => node.stageId === "source" && node.taskCount > 0,
    ),
  );
  assert.notDeepEqual(
    newOverview.nodes,
    oldOverview.nodes,
    "classification must reach layout input rather than only changing a version label",
  );
  assert.equal(fileHash(options.sourcePath), originalHash);
});

test("rerunning unchanged inputs produces the same content version", async (t) => {
  const options = fixture(t);
  const first = await buildInventoryMap(options);
  const second = await buildInventoryMap(options);
  assert.equal(second.version, first.version);
});

test("failed rebuild leaves the previously published CURRENT and queries intact", async (t) => {
  const options = fixture(t);
  await buildInventoryMap(options);
  const currentPath = join(options.outputRoot, "CURRENT.json");
  const published = readFileSync(currentPath, "utf8");
  writeFileSync(
    options.rulesPath,
    JSON.stringify({ ...rules(), defaultStageId: "does-not-exist" }),
  );
  await assert.rejects(async () => buildInventoryMap(options));
  assert.equal(readFileSync(currentPath, "utf8"), published);
  const previous = openMap(options.outputRoot);
  options.closeAfterTest(previous);
  assert.equal(queryMap(previous, "task", { id: "1" }).task.stageId, "source");
  assert.equal(queryMap(previous, "flows", {}).total, 5);
});

test("malformed relation rows preserve inventory and valid reciprocal evidence", async (t) => {
  const options = fixture(t, { malformedRows: true });
  await buildInventoryMap(options);
  const map = openMap(options.outputRoot);
  options.closeAfterTest(map);
  assert.equal(queryMap(map, "tasks", {}).total, 5);
  const flows = queryMap(map, "flows", {});
  assert.equal(flows.total, 4);
  const corroborated = flows.items.find(
    (edge) => edge.source === "1" && edge.target === "2",
  );
  assert.equal(corroborated.seenUp, true);
  assert.equal(
    corroborated.seenDown,
    false,
    "malformed down evidence must not corroborate a valid up observation",
  );
});

test("a detail record with another task identity is not attached to the inventory task", async (t) => {
  const options = fixture(t);
  const source = new DatabaseSync(options.sourcePath);
  source
    .prepare(
      `UPDATE evidence SET payload_json = ?
    WHERE task_id = '2' AND evidence_type = 'szdata-schedule-detail'`,
    )
    .run(
      JSON.stringify({
        task_id: "2",
        detail: {
          taskId: "777",
          taskName: "Incorrect task title",
          topicName: "Alpha",
        },
      }),
    );
  source.close();
  const result = await buildInventoryMap(options);
  const map = openMap(options.outputRoot);
  options.closeAfterTest(map);
  const task = queryMap(map, "task", { id: "2" }).task;
  assert.equal(task.hasDetail, false);
  assert.notEqual(task.name, "Incorrect task title");
  assert.equal(queryMap(map, "tasks", {}).total, 5);
  assert.equal(result.summary.quality.status, "PARTIAL");
  assert.ok(result.summary.quality.invalidRecords >= 1);
});
