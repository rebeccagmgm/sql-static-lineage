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
const DEFAULT_EDGES = [
  ["1", "2"],
  ["2", "3"],
  ["3", "1"],
  ["2", "4"],
  ["4", "5"],
  ["1", "999"],
];

async function fixture(
  t,
  {
    count = 8,
    edges = DEFAULT_EDGES,
    limits = { maxNodes: 150, maxEdges: 400, maxDepth: 4, maxPageSize: 100 },
  } = {},
) {
  const root = mkdtempSync(join(tmpdir(), "inventory-map-query-test-"));
  const sourcePath = join(root, "source.sqlite");
  const outputRoot = join(root, "output");
  const rulesPath = join(root, "rules.json");
  writeFileSync(
    rulesPath,
    JSON.stringify({
      schemaVersion: 1,
      stages: [
        { id: "source", label: "输入", order: 0, color: "#3388cc" },
        { id: "processing", label: "加工", order: 1, color: "#cc8844" },
        { id: "unclassified", label: "未分类", order: 2, color: "#999999" },
      ],
      defaultStageId: "unclassified",
      topicRules: [
        { exact: "Alpha", stageId: "source" },
        { exact: "Beta", stageId: "processing" },
      ],
      limits,
    }),
  );
  const source = new DatabaseSync(sourcePath);
  source.exec(`
    CREATE TABLE task_inventory(task_id TEXT PRIMARY KEY);
    CREATE TABLE evidence(
      task_id TEXT NOT NULL, evidence_type TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT '', depth INTEGER NOT NULL DEFAULT 0,
      format TEXT NOT NULL CHECK(format IN ('json','sql')),
      observed_at TEXT NOT NULL DEFAULT '', content_sha256 TEXT NOT NULL,
      payload_json TEXT, payload_text TEXT, source_path TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      PRIMARY KEY(task_id,evidence_type,direction,depth)
    );
    CREATE INDEX idx_evidence_type ON evidence(evidence_type);
    BEGIN;
  `);
  const insertTask = source.prepare("INSERT INTO task_inventory VALUES (?)");
  for (let id = 1; id <= count; id += 1) insertTask.run(String(id));
  const insertEvidence = source.prepare(
    `INSERT INTO evidence VALUES (?, ?, ?, ?, 'json', ?, ?, ?, NULL, ?, ?)`,
  );
  const evidence = (id, type, payload, direction = "", depth = 0) => {
    const json = JSON.stringify({
      task_id: id,
      observed_at: OBSERVED_AT,
      ...payload,
    });
    insertEvidence.run(
      id,
      type,
      direction,
      depth,
      OBSERVED_AT,
      createHash("sha256").update(json).digest("hex"),
      json,
      "fixture.json",
      OBSERVED_AT,
    );
  };
  for (const [id, topic, name] of [
    ["1", "Alpha", "交易😀"],
    ["2", "Alpha", "特殊 100%_ ' OR 1=1 --"],
    ["3", "Beta", "加工结果"],
    ["4", "Alpha", "输入汇总"],
    ["5", "Beta", "加工明细"],
  ]) {
    if (Number(id) > count) continue;
    evidence(id, "szdata-schedule-detail", {
      detail: {
        taskId: id,
        taskName: name,
        topicName: topic,
        database: "fixture_schema",
        taskType: "58",
        status: "Y",
      },
    });
  }
  const outgoing = new Map();
  for (const [from, to] of edges) {
    if (!outgoing.has(from)) outgoing.set(from, []);
    outgoing.get(from).push({ task_id: to });
  }
  for (const [id, rows] of outgoing) {
    evidence(
      id,
      "horae-relation-down-depth-1",
      { direction: "down", depth: 1, rows },
      "down",
      1,
    );
  }
  source.exec("COMMIT");
  source.close();
  await buildInventoryMap({ sourcePath, outputRoot, rulesPath });
  const map = openMap(outputRoot);
  t.after(() => {
    map.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { root, sourcePath, outputRoot, map };
}

function ids(items) {
  return items.map((item) => item.id).sort();
}

function rejectsArgument(map, command, params) {
  assert.throws(
    () => queryMap(map, command, params),
    (error) => {
      assert.equal(error.code, "INVALID_ARGUMENT");
      return true;
    },
    `${command} must reject ${JSON.stringify(params)}`,
  );
}

test("tasks and regions paginate independently and filters select actual members", async (t) => {
  const { map } = await fixture(t);
  const first = queryMap(map, "tasks", { limit: 3, offset: 0 });
  const second = queryMap(map, "tasks", { limit: 3, offset: first.nextOffset });
  const last = queryMap(map, "tasks", { limit: 3, offset: second.nextOffset });
  assert.equal(
    first.total,
    8,
    "external references do not inflate inventory pagination",
  );
  assert.equal(first.limit, 3);
  assert.equal(first.offset, 0);
  assert.equal(last.nextOffset, null);
  assert.equal(
    new Set(
      [...first.items, ...second.items, ...last.items].map((task) => task.id),
    ).size,
    8,
  );
  assert.ok(
    [...first.items, ...second.items, ...last.items].every(
      (task) => task.inInventory,
    ),
  );
  assert.deepEqual(
    ids(queryMap(map, "tasks", { region: "topic:Alpha" }).items),
    ["1", "2", "4"],
  );
  assert.deepEqual(ids(queryMap(map, "tasks", { stage: "processing" }).items), [
    "3",
    "5",
  ]);
  assert.equal(
    queryMap(map, "tasks", { region: "topic:Alpha", stage: "processing" })
      .total,
    0,
  );
  assert.equal(queryMap(map, "tasks", { offset: 1000 }).items.length, 0);
  const regionPage = queryMap(map, "regions", { limit: 1, offset: 0 });
  assert.equal(regionPage.items.length, 1);
  assert.equal(regionPage.total, 3);
  assert.equal(regionPage.nextOffset, 1);
});

test("search treats Unicode, SQL punctuation and LIKE wildcards as literal text", async (t) => {
  const { map } = await fixture(t);
  for (const q of ["%", "' OR 1=1 --", "100%_"]) {
    assert.deepEqual(ids(queryMap(map, "tasks", { q }).items), ["2"]);
  }
  assert.deepEqual(
    ids(queryMap(map, "tasks", { q: "_" }).items),
    ["2", "6", "7", "8"],
    "a literal underscore also matches the __unknown topic, without matching every task",
  );
  assert.deepEqual(ids(queryMap(map, "tasks", { q: "😀" }).items), ["1"]);
  assert.equal(queryMap(map, "tasks", { q: "" }).total, 8);
  assert.equal(queryMap(map, "tasks", { q: "not-present" }).total, 0);
});

test("flow members retain direction and respect both region and stage filters", async (t) => {
  const { map } = await fixture(t);
  const flows = queryMap(map, "flows", {
    sourceRegion: "topic:Alpha",
    targetRegion: "topic:Beta",
  });
  assert.equal(flows.total, 2);
  assert.deepEqual(
    flows.items.map((edge) => `${edge.source}>${edge.target}`).sort(),
    ["2>3", "4>5"],
  );
  assert.ok(
    flows.items.every(
      (edge) =>
        edge.sourceRegion === "topic:Alpha" &&
        edge.targetRegion === "topic:Beta",
    ),
  );
  assert.ok(flows.items.every((edge) => edge.seenDown && !edge.seenUp));
  const stageFlows = queryMap(map, "flows", {
    sourceStage: "source",
    targetStage: "processing",
    limit: 1,
  });
  assert.equal(stageFlows.total, 2);
  assert.equal(stageFlows.items.length, 1);
  assert.equal(stageFlows.nextOffset, 1);
});

test("summary and auto-laid-out overviews preserve counts and region edge membership", async (t) => {
  const { map } = await fixture(t);
  assert.deepEqual(queryMap(map, "summary", {}), map.summary);
  const overview = queryMap(map, "overview", {});
  assert.equal(overview.scope, "stages");
  assert.equal(
    overview.nodes.reduce((total, node) => total + node.taskCount, 0),
    8,
  );
  assert.ok(
    overview.nodes.every(
      (node) => Number.isFinite(node.x) && Number.isFinite(node.y),
    ),
  );
  assert.deepEqual(
    queryMap(map, "overview", {}),
    overview,
    "the same snapshot yields deterministic layout",
  );
  const region = queryMap(map, "overview", { region: "topic:Alpha" });
  assert.equal(region.scope, "region");
  assert.equal(region.taskCount, 3);
  assert.equal(region.internalEdges, 2);
  assert.equal(
    region.internalEdges,
    queryMap(map, "flows", {
      sourceRegion: "topic:Alpha",
      targetRegion: "topic:Alpha",
    }).total,
  );
  const nodes = new Set(region.nodes.map((node) => node.id));
  assert.ok(
    region.edges.every(
      (edge) => nodes.has(edge.source) && nodes.has(edge.target),
    ),
  );
  const toBeta = region.edges.find(
    (edge) => edge.source === "topic:Alpha" && edge.target === "topic:Beta",
  );
  assert.equal(
    toBeta.edgeCount,
    queryMap(map, "flows", {
      sourceRegion: "topic:Alpha",
      targetRegion: "topic:Beta",
    }).total,
  );
  assert.throws(
    () => queryMap(map, "overview", { region: "topic:not-present" }),
    (error) => error.code === "NOT_FOUND",
  );
});

test("an empty inventory produces an empty, valid and pageable map", async (t) => {
  const { map } = await fixture(t, { count: 0, edges: [] });
  for (const command of ["tasks", "flows", "regions"]) {
    const page = queryMap(map, command, {});
    assert.equal(page.total, 0);
    assert.deepEqual(page.items, []);
    assert.equal(page.nextOffset, null);
  }
  assert.deepEqual(queryMap(map, "overview", {}).nodes, []);
  assert.throws(
    () => queryMap(map, "neighbors", { id: "1" }),
    (error) => error.code === "NOT_FOUND",
  );
});

test("single-task queries use the published read-only index after source is removed", async (t) => {
  const { sourcePath, map } = await fixture(t);
  rmSync(sourcePath);
  const detail = queryMap(map, "task", { id: "2" });
  assert.equal(detail.task.id, "2");
  assert.ok(Array.isArray(detail.evidence));
  assert.ok(detail.evidence.length > 0);
  assert.equal(queryMap(map, "task", { id: "999" }).task.inInventory, false);
  assert.throws(
    () => map.db.exec("CREATE TABLE should_not_write(value TEXT)"),
    /read.?only/i,
  );
  assert.throws(
    () => queryMap(map, "task", { id: "100000000" }),
    (error) => error.code === "NOT_FOUND",
  );
});

test("neighbors follow requested direction, terminate cycles and distinguish depth truncation", async (t) => {
  const { map } = await fixture(t);
  const down = queryMap(map, "neighbors", {
    id: "1",
    direction: "down",
    depth: 1,
  });
  assert.deepEqual(ids(down.nodes), ["1", "2", "999"]);
  assert.ok(down.edges.every((edge) => edge.source === "1"));
  assert.equal(down.truncated, true);
  assert.ok(down.stoppedBy.length > 0);
  const up = queryMap(map, "neighbors", { id: "1", direction: "up", depth: 1 });
  assert.deepEqual(ids(up.nodes), ["1", "3"]);
  assert.ok(up.edges.every((edge) => edge.target === "1"));
  const complete = queryMap(map, "neighbors", {
    id: "1",
    direction: "both",
    depth: 4,
  });
  assert.deepEqual(ids(complete.nodes), ["1", "2", "3", "4", "5", "999"]);
  assert.equal(complete.edges.length, DEFAULT_EDGES.length);
  assert.equal(
    new Set(complete.nodes.map((task) => task.id)).size,
    complete.nodes.length,
  );
  assert.equal(
    new Set(complete.edges.map((edge) => `${edge.source}>${edge.target}`)).size,
    complete.edges.length,
  );
  assert.equal(complete.truncated, false);
  assert.deepEqual(complete.stoppedBy, []);
  const isolated = queryMap(map, "neighbors", {
    id: "8",
    direction: "both",
    depth: 4,
  });
  assert.deepEqual(ids(isolated.nodes), ["8"]);
  assert.deepEqual(isolated.edges, []);
  assert.equal(isolated.truncated, false);
});

test("depth-one neighborhoods include dependencies between selected frontier tasks", async (t) => {
  const { map } = await fixture(t, {
    count: 3,
    edges: [
      ["1", "2"],
      ["1", "3"],
      ["2", "3"],
    ],
  });
  const view = queryMap(map, "neighbors", {
    id: "1",
    direction: "down",
    depth: 1,
  });
  assert.deepEqual(ids(view.nodes), ["1", "2", "3"]);
  assert.deepEqual(
    view.edges.map((edge) => `${edge.source}>${edge.target}`).sort(),
    ["1>2", "1>3", "2>3"],
  );
  assert.equal(view.edgeScope, "INDUCED_SELECTED_TASKS");
  assert.equal(view.truncated, false);
  assert.deepEqual(view.stoppedBy, []);
});

test("published query limits constrain both defaults and explicit budgets", async (t) => {
  const limits = { maxNodes: 3, maxEdges: 2, maxDepth: 1, maxPageSize: 2 };
  const { map } = await fixture(t, { limits });
  assert.deepEqual(map.summary.limits, limits);
  for (const command of ["tasks", "regions", "flows"]) {
    const page = queryMap(map, command, {});
    assert.equal(page.limit, 2);
    assert.equal(page.items.length, 2);
    assert.equal(queryMap(map, command, { limit: 1 }).items.length, 1);
    rejectsArgument(map, command, { limit: 3 });
  }
  const defaults = queryMap(map, "neighbors", { id: "1", direction: "down" });
  assert.deepEqual(defaults.limits, { nodes: 3, edges: 2 });
  assert.equal(defaults.depth, 1);
  assert.equal(defaults.nodes.length, 3);
  assert.equal(defaults.edges.length, 2);
  assert.equal(defaults.truncated, true);
  const explicit = queryMap(map, "neighbors", {
    id: "1",
    direction: "down",
    depth: 1,
    limit: 3,
    edgeLimit: 2,
  });
  assert.deepEqual(explicit.nodes, defaults.nodes);
  assert.deepEqual(explicit.edges, defaults.edges);
  for (const params of [{ limit: 4 }, { edgeLimit: 3 }, { depth: 2 }]) {
    rejectsArgument(map, "neighbors", { id: "1", ...params });
  }
});

test("node and edge budgets stop expansion with referentially valid results", async (t) => {
  const edges = [];
  for (let source = 1; source <= 30; source += 1) {
    for (let target = 1; target <= 30; target += 1) {
      if (source !== target) edges.push([String(source), String(target)]);
    }
  }
  const { map } = await fixture(t, { count: 30, edges });
  const nodeBound = queryMap(map, "neighbors", {
    id: "1",
    direction: "both",
    depth: 4,
    limit: 5,
    edgeLimit: 400,
  });
  assert.ok(nodeBound.nodes.length <= 5);
  assert.equal(nodeBound.truncated, true);
  assert.ok(nodeBound.stoppedBy.length > 0);
  const nodeIds = new Set(nodeBound.nodes.map((task) => task.id));
  assert.ok(
    nodeBound.edges.every(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
    ),
  );
  const edgeBound = queryMap(map, "neighbors", {
    id: "1",
    direction: "both",
    depth: 4,
    limit: 150,
    edgeLimit: 7,
  });
  assert.ok(edgeBound.edges.length <= 7);
  assert.equal(edgeBound.truncated, true);
  assert.ok(edgeBound.stoppedBy.length > 0);
});

test("10,025 inventory records remain pageable while a high-degree neighborhood is bounded", async (t) => {
  const edges = Array.from({ length: 200 }, (_, index) => [
    "1",
    String(index + 2),
  ]);
  const { map } = await fixture(t, { count: 10025, edges });
  const page = queryMap(map, "tasks", { limit: 100, offset: 10000 });
  assert.equal(page.total, 10025);
  assert.equal(page.items.length, 25);
  assert.equal(page.nextOffset, null);
  const view = queryMap(map, "neighbors", {
    id: "1",
    direction: "down",
    depth: 4,
    limit: 150,
    edgeLimit: 400,
  });
  assert.ok(view.nodes.length <= 150);
  assert.ok(view.edges.length <= 400);
  assert.equal(view.truncated, true);
  assert.ok(view.stoppedBy.length > 0);
});

test("invalid filters and bounds fail explicitly instead of broadening a query", async (t) => {
  const { map } = await fixture(t);
  for (const params of [
    { limit: 0 },
    { limit: 101 },
    { limit: 1.2 },
    { limit: NaN },
    { limit: null },
    { offset: -1 },
    { offset: 0.5 },
    { q: [] },
    { region: {} },
    { stage: null },
  ])
    rejectsArgument(map, "tasks", params);
  for (const params of [
    {},
    { id: null },
    { id: "" },
    { id: [] },
    { id: "' OR 1=1 --" },
    { id: "1", direction: "sideways" },
    { id: "1", depth: 0 },
    { id: "1", depth: 5 },
    { id: "1", depth: 1.5 },
    { id: "1", limit: 151 },
    { id: "1", edgeLimit: 401 },
    { id: "1", edgeLimit: -1 },
  ])
    rejectsArgument(map, "neighbors", params);
  rejectsArgument(map, "task", {});
  rejectsArgument(map, "unknown-command", {});
});

test("snapshot pointers cannot read files outside the published output root", async (t) => {
  const { outputRoot } = await fixture(t);
  const currentPath = join(outputRoot, "CURRENT.json");
  const current = JSON.parse(readFileSync(currentPath, "utf8"));
  writeFileSync(
    currentPath,
    JSON.stringify({ ...current, database: "../source.sqlite" }),
  );
  assert.throws(() => openMap(outputRoot));
});
