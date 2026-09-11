import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { buildAnalysisIndex, qualifiedNameParts } from "./analysis-index.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "map-analysis-test-"));
  const resources = [];
  t.after(() => {
    for (const resource of resources) resource.close();
    rmSync(root, { recursive: true, force: true });
  });
  const projectionRoot = join(root, "tasks");
  mkdirSync(projectionRoot);
  const hiveCorePath = join(root, "core.jsonl");
  const hiveDefinitionPath = join(root, "definitions.jsonl");
  const outputRoot = join(root, "output");
  writeFileSync(
    hiveCorePath,
    JSON.stringify({
      guid: "core-guid",
      qualifiedname: "DATA.Orders@instance-a",
      name: "Orders",
      type_name: "hive_table",
    }) + "\n",
  );
  writeFileSync(
    hiveDefinitionPath,
    [
      {
        guid: "different-guid-1",
        qualifiedname: "data.orders@instance-a:100",
        querytext: "create table data.orders(id bigint)",
      },
      {
        guid: "different-guid-2",
        qualifiedname: "data.orders@instance-a:200",
        querytext: "create table data.orders(id bigint, value string)",
      },
    ]
      .map(JSON.stringify)
      .join("\n") + "\n",
  );
  return {
    root,
    projectionRoot,
    hiveCorePath,
    hiveDefinitionPath,
    outputRoot,
    resources,
  };
}

function writeProjection(
  root,
  taskId,
  {
    datasetId = "dataset:a",
    dataSource = "instance-a",
    noClosure = false,
  } = {},
) {
  const directory = join(root, taskId);
  mkdirSync(join(directory, "versions"), { recursive: true });
  const cacheKey = "a".repeat(64);
  const writeObservationId = `write-observation:${taskId}:platform-target:0`;
  const projection = {
    taskId,
    coverageStatus: noClosure ? "UNSUPPORTED" : "PROJECTED",
    coverageDisposition: "DATA_LINEAGE",
    generatedAt: "2026-09-07T00:00:00Z",
    nodes: [
      {
        nodeId: `task:${taskId}`,
        nodeType: "TASK",
        properties: { taskName: `Task ${taskId}`, topicName: "Business" },
      },
      {
        nodeId: datasetId,
        nodeType: "PHYSICAL_DATASET",
        properties: {
          qualifiedName: "data.orders",
          platform: "hive",
          dataSource,
          identityStatus: "CONFIRMED",
        },
      },
      {
        nodeId: `read:${taskId}`,
        nodeType: "READ_OCCURRENCE",
        properties: { alias: "a" },
      },
      {
        nodeId: `write:${taskId}`,
        nodeType: "TARGET_WRITE",
        properties: { writeObservationId },
      },
    ],
    edges: [
      {
        edgeId: `read-edge:${taskId}`,
        edgeType: "READS",
        fromNodeId: `read:${taskId}`,
        toNodeId: datasetId,
        properties: {
          readDisposition: "EXTERNAL_READ",
          partitionPredicates: [{ column: "day", values: ["2026-09-07"] }],
        },
      },
      {
        edgeId: `write-edge:${taskId}`,
        edgeType: "WRITES",
        fromNodeId: `write:${taskId}`,
        toNodeId: datasetId,
        properties: { writeObservationId },
      },
    ],
    ...(!noClosure
      ? {
          localClosure: {
            externalReads: [
              {
                datasetNodeId: datasetId,
                qualifiedName: "data.orders",
                readOccurrenceId: `read-occurrence:${taskId}:1`,
                readOccurrenceNodeId: `read:${taskId}`,
                identityStatus: "CONFIRMED",
              },
            ],
            finalWrites: [
              {
                datasetNodeId: datasetId,
                qualifiedName: "data.orders",
                targetWriteNodeId: `write:${taskId}`,
                writeObservationId,
              },
            ],
          },
        }
      : {}),
  };
  writeFileSync(
    join(directory, "task-local-projection.json"),
    JSON.stringify({ cacheKey, projection }),
  );
  writeFileSync(
    join(directory, "versions", `${cacheKey}.evidence-v3.json`),
    JSON.stringify({ version: "3", taskId }),
  );
}

test("physical IDs remain distinct and catalog/definition matches stay candidates", async (t) => {
  const options = fixture(t);
  writeProjection(options.projectionRoot, "101");
  writeProjection(options.projectionRoot, "102", {
    datasetId: "dataset:b",
    dataSource: "instance-b",
  });
  writeProjection(options.projectionRoot, "103", { noClosure: true });
  const built = await buildAnalysisIndex(options);
  const db = new DatabaseSync(built.databasePath, { readOnly: true });
  options.resources.push(db);
  assert.deepEqual(built.counts, {
    tasks: 3,
    missingEvidence: 0,
    tables: 2,
    catalogObjects: 3,
    catalogCoreRows: 1,
    definitions: 2,
    reads: 2,
    writes: 2,
  });
  const names = db
    .prepare(
      "SELECT kind,count(*) AS n FROM objects WHERE qualified_name='data.orders' GROUP BY kind ORDER BY kind",
    )
    .all();
  assert.deepEqual(
    names.map((row) => [row.kind, row.n]),
    [
      ["catalog", 3],
      ["table", 2],
    ],
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM relations WHERE source LIKE 'catalog:%' OR target LIKE 'catalog:%'",
      )
      .get().n,
    0,
  );
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM relations WHERE task_id='103'").get()
      .n,
    0,
  );
  const definitions = db
    .prepare("SELECT properties_json,sql FROM definitions ORDER BY sql")
    .all();
  assert.equal(
    new Set(
      definitions.map(
        (row) => JSON.parse(row.properties_json).instanceQualifier,
      ),
    ).size,
    2,
  );
  assert.ok(
    definitions.every(
      (row) =>
        JSON.parse(row.properties_json).identityRole === "CATALOG_CANDIDATE",
    ),
  );
  const read = JSON.parse(
    db
      .prepare(
        "SELECT properties_json FROM relations WHERE task_id='101' AND kind='READS'",
      )
      .get().properties_json,
  );
  assert.equal(read.originalEdges[0].partitionPredicates[0].column, "day");
  const write = JSON.parse(
    db
      .prepare(
        "SELECT properties_json FROM relations WHERE task_id='101' AND kind='WRITES'",
      )
      .get().properties_json,
  );
  assert.equal(write.writeEvidenceKind, "PLATFORM_TARGET_DECLARATION");
  assert.equal(
    write.writeObservationId,
    "write-observation:101:platform-target:0",
  );
  assert.deepEqual(qualifiedNameParts("DATA.Orders@instance-a:100"), {
    originalQualifiedName: "DATA.Orders@instance-a:100",
    qualifiedName: "data.orders",
    schemaName: "data",
    instanceQualifier: "instance-a:100",
  });
});

test("identical inputs produce the same version; changed definitions produce a new version", async (t) => {
  const options = fixture(t);
  writeProjection(options.projectionRoot, "101");
  const first = await buildAnalysisIndex(options);
  const repeated = await buildAnalysisIndex(options);
  assert.equal(first.version, repeated.version);
  assert.equal(first.databasePath, repeated.databasePath);
  writeFileSync(
    options.hiveDefinitionPath,
    JSON.stringify({
      guid: "v3",
      qualifiedname: "data.orders@instance-a:300",
      querytext: "create table data.orders(id string)",
    }) + "\n",
  );
  const changed = await buildAnalysisIndex(options);
  assert.notEqual(changed.version, first.version);
  assert.ok(readFileSync(first.databasePath).length > 0);
  assert.equal(
    JSON.parse(readFileSync(join(options.outputRoot, "CURRENT.json"), "utf8"))
      .version,
    changed.version,
  );
});

test("invalid source rows fail and leave the prior successful pointer intact", async (t) => {
  const options = fixture(t);
  writeProjection(options.projectionRoot, "101");
  await buildAnalysisIndex(options);
  const pointer = readFileSync(
    join(options.outputRoot, "CURRENT.json"),
    "utf8",
  );
  writeFileSync(options.hiveDefinitionPath, "{bad JSON}\n");
  await assert.rejects(buildAnalysisIndex(options), /INVALID_JSON_LINE/);
  assert.equal(
    readFileSync(join(options.outputRoot, "CURRENT.json"), "utf8"),
    pointer,
  );
});

test("conflicting physical identity fails rather than silently merging sources", async (t) => {
  const options = fixture(t);
  writeProjection(options.projectionRoot, "101");
  writeProjection(options.projectionRoot, "102", { dataSource: "instance-b" });
  await assert.rejects(
    buildAnalysisIndex(options),
    /DATASET_IDENTITY_CONFLICT/,
  );
});
