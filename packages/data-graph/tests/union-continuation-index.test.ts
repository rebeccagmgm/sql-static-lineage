import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertUnionContinuationIndex,
  type UnionContinuationIndex,
} from "../src/project-graph/topology/task-local-union/union-continuation-index.ts";
import {
  assertUnionContinuationIndexManifest,
  parseUnionContinuationIndexCli,
  runUnionContinuationIndexCli,
  type UnionContinuationIndexManifest,
} from "../src/project-graph/topology/task-local-union/union-continuation-index-cli.ts";
import type {
  TaskLocalProjectionClosure,
  TaskLocalProjectionEnvelope,
} from "../src/project-graph/topology/task-local-union/task-local-union-contract.ts";

const TABLE_ID = "dataset:fixture-t03-agt-stati-info-h";
const TABLE = "pdata_n.t03_agt_stati_info_h";
const READ_A =
  "task:119044:statement:0:relation:root.a.read.t03_agt_stati_info_h";
const READ_B =
  "task:119044:statement:0:relation:root.b.read.t03_agt_stati_info_h";
const READ_A_NODE = "read-occurrence:119044:a";
const READ_B_NODE = "read-occurrence:119044:b";
const WRITE_A = "write-observation:105387:3";
const WRITE_B = "write-observation:105387:6";

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function envelope(input: {
  readonly taskId: string;
  readonly schemaVersion?: "1.1.0" | "1.2.0";
  readonly coverageStatus?: "PROJECTED" | "SCHEDULE_ONLY" | "COLLECTION_FAILED";
  readonly nodes: readonly Record<string, unknown>[];
  readonly localClosure?: TaskLocalProjectionClosure;
}): TaskLocalProjectionEnvelope {
  const schemaVersion = input.schemaVersion ?? "1.2.0";
  const coverageStatus = input.coverageStatus ?? "PROJECTED";
  const contentHash = sha(
    `${input.taskId}:${schemaVersion}:${coverageStatus}:${JSON.stringify(input.localClosure)}`,
  );
  return {
    cacheKey: sha(`cache:${input.taskId}`),
    cacheKeyParts: {
      taskId: input.taskId,
      packContentHash: sha(`pack:${input.taskId}`),
      factsManifestSha256: sha(`facts:${input.taskId}`),
      schemaVersion,
    },
    projectionContentHash: contentHash,
    projection: {
      schemaVersion,
      artifactType: "TASK_LOCAL_PROJECTION",
      taskId: input.taskId,
      coverageStatus,
      failureReasonCode:
        coverageStatus === "COLLECTION_FAILED" ? "FAILED" : null,
      contentHash,
      nodes: input.nodes,
      edges: [],
      ...(input.localClosure ? { localClosure: input.localClosure } : {}),
    },
  };
}

function writeFixture(
  input: {
    readonly badProjectedSchema?: boolean;
    readonly ambiguousProducerIndex?: boolean;
  } = {},
): { readonly root: string; readonly producerIndexPath: string } {
  const root = mkdtempSync(join(tmpdir(), "data-graph-wp81-index-"));
  const consumer = envelope({
    taskId: "119044",
    schemaVersion: input.badProjectedSchema ? "1.1.0" : "1.2.0",
    nodes: [
      { nodeId: "task:119044", nodeType: "TASK", properties: {} },
      {
        nodeId: READ_A_NODE,
        nodeType: "READ_OCCURRENCE",
        properties: {
          occurrenceId: READ_A,
          datasetNodeId: TABLE_ID,
          physicalDataset: TABLE,
          identityStatus: "CONFIRMED",
          partitionPredicateStatus: "LITERAL",
          partitionPredicates: [{ column: "src_tbl", values: ["A"] }],
        },
      },
      {
        nodeId: READ_B_NODE,
        nodeType: "READ_OCCURRENCE",
        properties: {
          occurrenceId: READ_B,
          datasetNodeId: TABLE_ID,
          physicalDataset: TABLE,
          identityStatus: "CONFIRMED",
          partitionPredicateStatus: "LITERAL",
          partitionPredicates: [{ column: "src_tbl", values: ["B"] }],
        },
      },
    ],
    localClosure: {
      finalWrites: [],
      externalReads: [
        {
          readOccurrenceId: READ_A,
          readOccurrenceNodeId: READ_A_NODE,
          datasetNodeId: TABLE_ID,
          qualifiedName: TABLE,
          identityStatus: "CONFIRMED",
        },
        {
          readOccurrenceId: READ_B,
          readOccurrenceNodeId: READ_B_NODE,
          datasetNodeId: TABLE_ID,
          qualifiedName: TABLE,
          identityStatus: "CONFIRMED",
        },
      ],
    },
  });
  const writer = envelope({
    taskId: "105387",
    nodes: [{ nodeId: "task:105387", nodeType: "TASK", properties: {} }],
    localClosure: {
      finalWrites: [
        {
          writeObservationId: WRITE_A,
          targetWriteNodeId: "target-write:105387:3",
          datasetNodeId: TABLE_ID,
          qualifiedName: TABLE,
        },
        {
          writeObservationId: WRITE_B,
          targetWriteNodeId: "target-write:105387:6",
          datasetNodeId: TABLE_ID,
          qualifiedName: TABLE,
        },
      ],
      externalReads: [],
    },
  });
  const scheduleOnly = envelope({
    taskId: "900001",
    coverageStatus: "SCHEDULE_ONLY",
    nodes: [
      {
        nodeId: "task:900001",
        nodeType: "TASK",
        properties: { scheduleReference: { upstreamTaskIds: ["105387"] } },
      },
    ],
  });
  const collectionFailed = envelope({
    taskId: "900002",
    coverageStatus: "COLLECTION_FAILED",
    nodes: [{ nodeId: "task:900002", nodeType: "TASK", properties: {} }],
  });
  const entries = [
    ["119044", consumer],
    ["105387", writer],
    ["900001", scheduleOnly],
    ["900002", collectionFailed],
  ] as const;
  const tasks = entries.map(([taskId, value]) => {
    const taskDir = join(root, "tasks", taskId);
    const path = join(taskDir, "task-local-projection.json");
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(path, JSON.stringify(value), "utf8");
    return {
      taskId,
      coverageStatus: value.projection.coverageStatus,
      failureReasonCode: value.projection.failureReasonCode,
      contentHash: value.projection.contentHash,
      cacheHit: false,
      cacheKey: value.cacheKey,
      path,
    };
  });
  writeFileSync(
    join(root, "batch-manifest.json"),
    JSON.stringify({
      schemaVersion: "1.0.0",
      artifactType: "TASK_LOCAL_BATCH_MANIFEST",
      taskIds: entries.map(([taskId]) => taskId),
      tasks,
    }),
    "utf8",
  );
  const producerIndexPath = join(root, "producer-index.json");
  writeFileSync(
    producerIndexPath,
    JSON.stringify({
      contentHash: sha("producer-index"),
      inputFingerprint: sha("producer-index-input"),
      confirmedProducerEdges: [
        {
          taskId: "105387",
          table: { qualifiedName: TABLE },
          writes: [
            {
              ...(input.ambiguousProducerIndex
                ? {}
                : { writeObservationId: WRITE_A }),
              partitionStatus: "COMPLETE",
              partition: [
                {
                  field: "src_tbl",
                  valueStatus: "OBSERVED_RENDERED_VALUE",
                  observedValue: "A",
                },
              ],
            },
            {
              ...(input.ambiguousProducerIndex
                ? {}
                : { writeObservationId: WRITE_B }),
              partitionStatus: "COMPLETE",
              partition: [
                {
                  field: "src_tbl",
                  valueStatus: "OBSERVED_RENDERED_VALUE",
                  observedValue: "B",
                },
              ],
            },
          ],
        },
      ],
    }),
    "utf8",
  );
  return { root, producerIndexPath };
}

describe("UNION_CONTINUATION_INDEX (WP-8.1)", () => {
  it("parses the batch command and defaults to every projected consumer", () => {
    expect(
      parseUnionContinuationIndexCli([
        "--batch-dir",
        "tmp/wp8-real-v2-119044",
        "--producer-index",
        "producer-index.json",
        "--output-dir",
        "tmp/wp8-continuation-index",
      ]),
    ).toMatchObject({ command: "run", consumerTaskIds: [] });
  });

  it("writes a hashed index with all projected reads and excludes boundary tasks", () => {
    const fixture = writeFixture();
    const outputDir = join(fixture.root, "index");
    const stdout: string[] = [];
    runUnionContinuationIndexCli(
      [
        "--batch-dir",
        fixture.root,
        "--producer-index",
        fixture.producerIndexPath,
        "--output-dir",
        outputDir,
      ],
      {
        now: () => "2026-09-03T00:00:00.000Z",
        write: (value) => stdout.push(value),
      },
    );

    const result = JSON.parse(stdout[0]!) as {
      index: string;
      manifest: string;
    };
    const index = JSON.parse(
      readFileSync(result.index, "utf8"),
    ) as UnionContinuationIndex;
    assertUnionContinuationIndex(index);
    expect(index.artifactType).toBe("UNION_CONTINUATION_INDEX");
    expect(index.input.taskProjections.map((task) => task.taskId)).toEqual([
      "105387",
      "119044",
    ]);
    expect(index.entries.map((entry) => entry.readOccurrenceId)).toEqual([
      READ_A,
      READ_B,
    ]);
    expect(index.entries[0]?.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: "105387",
          writeObservationId: WRITE_A,
          targetWriteNodeId: "target-write:105387:3",
          partitionMatchStatus: "CONFIRMED",
          l1Eligible: true,
        }),
      ]),
    );
    expect(
      index.entries[0]?.candidates.find(
        (candidate) => candidate.writeObservationId === WRITE_B,
      )?.reasonCode,
    ).toBeUndefined();
    expect(
      index.entries.some((entry) => entry.consumerTaskId === "900001"),
    ).toBe(false);
    expect(
      index.entries.some((entry) => entry.consumerTaskId === "900002"),
    ).toBe(false);

    const manifest = JSON.parse(
      readFileSync(result.manifest, "utf8"),
    ) as UnionContinuationIndexManifest;
    expect(manifest).toMatchObject({
      artifactType: "UNION_CONTINUATION_INDEX_MANIFEST",
      indexContentHash: index.contentHash,
      projectedTaskCount: 2,
      readOccurrenceCount: 2,
    });
    assertUnionContinuationIndexManifest(manifest);
  });

  it("rejects a non-1.2.0 projected input before creating output", () => {
    const fixture = writeFixture({ badProjectedSchema: true });
    const outputDir = join(fixture.root, "should-not-exist");
    expect(() =>
      runUnionContinuationIndexCli([
        "--batch-dir",
        fixture.root,
        "--producer-index",
        fixture.producerIndexPath,
        "--output-dir",
        outputDir,
      ]),
    ).toThrow("UNION_CONTINUATION_INDEX_PROJECTED_SCHEMA_DRIFT:119044");
    expect(existsSync(outputDir)).toBe(false);
  });

  it("keeps ambiguous multi-write alignment unknown without a shared producer id", () => {
    const fixture = writeFixture({ ambiguousProducerIndex: true });
    const outputDir = join(fixture.root, "index");
    runUnionContinuationIndexCli(
      [
        "--batch-dir",
        fixture.root,
        "--producer-index",
        fixture.producerIndexPath,
        "--consumer-task-id",
        "119044",
        "--output-dir",
        outputDir,
      ],
      { write: () => undefined },
    );

    const index = JSON.parse(
      readFileSync(join(outputDir, "union-continuation-index.json"), "utf8"),
    ) as UnionContinuationIndex;
    const candidates = index.entries[0]?.candidates.filter(
      (candidate) => candidate.taskId === "105387",
    );
    expect(
      candidates?.map((candidate) => candidate.writeObservationId),
    ).toEqual([WRITE_A, WRITE_B]);
    expect(
      candidates?.every((candidate) => candidate.l1Eligible === false),
    ).toBe(true);
    expect(
      candidates?.every(
        (candidate) =>
          candidate.alignmentGapCode ===
          "WRITE_OBSERVATION_ALIGNMENT_AMBIGUOUS",
      ),
    ).toBe(true);
    expect(
      candidates?.some((candidate) =>
        candidate.writeObservationId.endsWith(":0"),
      ),
    ).toBe(false);
  });
});
