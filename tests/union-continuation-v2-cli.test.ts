import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { assertUnionContinuationEvidenceEnvelope } from "../src/project-graph/topology/task-local-union/task-local-union-continuation-envelope.ts";
import {
  parseUnionContinuationV2Cli,
  runUnionContinuationV2Cli,
  type UnionContinuationV2EvidenceManifest,
} from "../src/project-graph/topology/task-local-union/union-continuation-v2-cli.ts";
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

function envelope(
  taskId: string,
  nodes: readonly Record<string, unknown>[],
  localClosure: TaskLocalProjectionClosure,
): TaskLocalProjectionEnvelope {
  const contentHash = sha(`${taskId}:${JSON.stringify(localClosure)}`);
  return {
    cacheKey: sha(`cache:${taskId}`),
    cacheKeyParts: {
      taskId,
      packContentHash: sha(`pack:${taskId}`),
      factsManifestSha256: sha(`facts:${taskId}`),
      schemaVersion: "1.2.0",
    },
    projectionContentHash: contentHash,
    projection: {
      schemaVersion: "1.2.0",
      artifactType: "TASK_LOCAL_PROJECTION",
      taskId,
      coverageStatus: "PROJECTED",
      failureReasonCode: null,
      contentHash,
      nodes,
      edges: [],
      localClosure,
    },
  };
}

function writeTaskEnvelope(
  root: string,
  taskId: string,
  value: TaskLocalProjectionEnvelope,
): string {
  const taskDir = join(root, "tasks", taskId);
  mkdirSync(taskDir, { recursive: true });
  const path = join(taskDir, "task-local-projection.json");
  writeFileSync(path, JSON.stringify(value), "utf8");
  return path;
}

function makeFixture(): { root: string; producerIndexPath: string } {
  const root = mkdtempSync(join(tmpdir(), "data-graph-wp8-cli-"));
  const consumerEnvelope = envelope(
    "119044",
    [
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
    {
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
  );
  const writerEnvelope = envelope(
    "105387",
    [{ nodeId: "task:105387", nodeType: "TASK", properties: {} }],
    {
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
  );
  const consumerPath = writeTaskEnvelope(root, "119044", consumerEnvelope);
  const writerPath = writeTaskEnvelope(root, "105387", writerEnvelope);
  const manifest = {
    schemaVersion: "1.0.0",
    artifactType: "TASK_LOCAL_BATCH_MANIFEST",
    taskIds: ["119044", "105387"],
    tasks: [
      {
        taskId: "119044",
        coverageStatus: "PROJECTED",
        failureReasonCode: null,
        contentHash: consumerEnvelope.projection.contentHash,
        cacheHit: false,
        cacheKey: consumerEnvelope.cacheKey,
        path: consumerPath,
      },
      {
        taskId: "105387",
        coverageStatus: "PROJECTED",
        failureReasonCode: null,
        contentHash: writerEnvelope.projection.contentHash,
        cacheHit: false,
        cacheKey: writerEnvelope.cacheKey,
        path: writerPath,
      },
    ],
  };
  writeFileSync(
    join(root, "batch-manifest.json"),
    JSON.stringify(manifest),
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
              writeObservationId: WRITE_A,
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
              writeObservationId: WRITE_B,
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

describe("union-continuation-v2 CLI (WP-8)", () => {
  it("parses the documented command and defaults the consumer to 119044", () => {
    const options = parseUnionContinuationV2Cli([
      "--batch-dir",
      "tmp/wp8-real-v2-119044",
      "--producer-index",
      "../../sql-static-lineage-data.producer-index/producer-index.json",
      "--output-dir",
      "tmp/wp8-continuation-evidence",
    ]);
    expect(options).toMatchObject({
      command: "run",
      consumerTaskIds: ["119044"],
      readOccurrenceIds: [],
    });
  });

  it("writes and revalidates one evidence artifact per 1.2.0 read occurrence", () => {
    const fixture = makeFixture();
    const outputDir = join(fixture.root, "evidence");
    const stdout: string[] = [];
    runUnionContinuationV2Cli(
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
      {
        now: () => "2026-09-03T00:00:00.000Z",
        write: (text) => stdout.push(text),
      },
    );

    const result = JSON.parse(stdout[0]!) as {
      status: string;
      readOccurrenceCount: number;
      manifest: string;
    };
    expect(result).toMatchObject({ status: "SUCCESS", readOccurrenceCount: 2 });
    const manifest = JSON.parse(
      readFileSync(result.manifest, "utf8"),
    ) as UnionContinuationV2EvidenceManifest;
    expect(manifest.artifactType).toBe("UNION_CONTINUATION_EVIDENCE_MANIFEST");
    expect(manifest.readOccurrences).toHaveLength(2);
    expect(
      manifest.readOccurrences.map((entry) => entry.readOccurrenceId),
    ).toEqual([READ_A, READ_B]);
    for (const entry of manifest.readOccurrences) {
      const evidence = JSON.parse(
        readFileSync(join(outputDir, entry.file), "utf8"),
      );
      expect(evidence).toMatchObject({
        artifactType: "UNION_CONTINUATION_EVIDENCE",
        schemaVersion: "1.0.0",
        input: {
          consumerTaskId: "119044",
          projectionSchemaVersion: "1.2.0",
        },
      });
      assertUnionContinuationEvidenceEnvelope(evidence);
      expect(evidence.contentHash).toBe(entry.contentHash);
    }
  });

  it("rejects missing required batch and output inputs", () => {
    expect(() =>
      parseUnionContinuationV2Cli([
        "--batch-dir",
        "batch",
        "--producer-index",
        "producer-index.json",
        "--consumer-task-id",
        "119044",
      ]),
    ).toThrow("UNION_CONTINUATION_V2_OPTION_REQUIRED:--output-dir");
  });
});
