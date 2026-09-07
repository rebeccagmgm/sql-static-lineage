import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { TaskLocalProjection } from "../../../scripts/project-graph/task-local/contract.ts";
import { loadUnionContinuationCandidateSource } from "../../../scripts/reconcile/consumer/target-table-upstream-causal-closure/union-continuation-candidate-source.ts";
import { compileTask, digest } from "../src/asset-graph/compile.ts";
import { taskWriters, type Evidence } from "../src/asset-graph/publish.ts";
import {
  unpackTaskLocalProjectionEnvelope,
  type TaskLocalProjectionEnvelope,
} from "../src/project-graph/topology/task-local-union/task-local-union-contract.ts";
import { traceUnionContinuationV2 } from "../src/project-graph/topology/task-local-union/task-local-union-continuation-v2.ts";
import { mergeLoadedTasksForTest } from "../src/project-graph/topology/task-local-union/task-local-union-merge.ts";
import { loadProducerIndex } from "../src/project-graph/topology/task-local-union/task-local-union-producer-index.ts";
import {
  assertUnionContinuationIndex,
  buildUnionContinuationIndex,
  unionContinuationIndexContentHash,
  type UnionContinuationIndex,
} from "../src/project-graph/topology/task-local-union/union-continuation-index.ts";

type Qualification = "PLATFORM_TARGET" | "SQL_UNCONSUMED" | undefined;
const TABLE = "demo.result";
const WRITE_ID = "write-observation:producer:0";
const READ_ID = "read:consumer:0";

function envelope(
  taskId: string,
  qualification?: Qualification,
  scheduleFallback = false,
): TaskLocalProjectionEnvelope {
  const producer = taskId === "producer";
  const datasetNodeId =
    producer && scheduleFallback ? "dataset:producer" : "dataset:result";
  const contentHash = digest([taskId, qualification, scheduleFallback]);
  return {
    cacheKey: digest(["cache", taskId]),
    cacheKeyParts: {
      taskId,
      packContentHash: digest(["pack", taskId]),
      factsManifestSha256: digest(["facts", taskId]),
      schemaVersion: "1.3.0",
    },
    projectionContentHash: contentHash,
    projection: {
      schemaVersion: "1.3.0",
      artifactType: "TASK_LOCAL_PROJECTION",
      taskId,
      coverageStatus: "PROJECTED",
      failureReasonCode: null,
      contentHash,
      nodes: [
        {
          nodeId: `task:${taskId}`,
          nodeType: "TASK",
          properties: producer
            ? {}
            : {
                scheduleReference: {
                  upstreamTableReferences: [
                    { taskId: "producer", qualifiedName: TABLE },
                  ],
                },
              },
        },
        {
          nodeId: datasetNodeId,
          nodeType: "PHYSICAL_DATASET",
          properties: { qualifiedName: TABLE, identityStatus: "CONFIRMED" },
        },
        producer
          ? {
              nodeId: "target-write:producer",
              nodeType: "TARGET_WRITE",
              properties: {
                qualifiedName: TABLE,
                writeObservationId: WRITE_ID,
              },
            }
          : {
              nodeId: "read-occurrence:consumer",
              nodeType: "READ_OCCURRENCE",
              properties: {
                occurrenceId: READ_ID,
                datasetNodeId,
                physicalDataset: TABLE,
                identityStatus: "CONFIRMED",
                partitionPredicateStatus: "NONE",
                partitionPredicates: [],
              },
            },
      ],
      edges: [],
      localClosure: {
        finalWrites: producer
          ? [
              {
                writeObservationId: WRITE_ID,
                targetWriteNodeId: "target-write:producer",
                datasetNodeId,
                qualifiedName: TABLE,
                ...(qualification === undefined
                  ? {}
                  : { outputQualification: qualification }),
              },
            ]
          : [],
        externalReads: producer
          ? []
          : [
              {
                readOccurrenceId: READ_ID,
                readOccurrenceNodeId: "read-occurrence:consumer",
                datasetNodeId,
                qualifiedName: TABLE,
                identityStatus: "CONFIRMED",
              },
            ],
        localFieldPaths: [],
      },
    },
  };
}

function load(env: TaskLocalProjectionEnvelope) {
  return {
    ...unpackTaskLocalProjectionEnvelope({
      envelope: env,
      manifestTaskContentHash: env.projectionContentHash,
    }),
    boundaryOnly: false,
  };
}

const evidence: Evidence = {
  bindings: [],
  statements: [
    {
      statement_id: "statement:producer:0",
      raw_sql: `insert overwrite table ${TABLE} select 1`,
    },
  ],
  datasetIo: [
    {
      write_observation_id: WRITE_ID,
      write_statement_id: "statement:producer:0",
      physical_dataset: TABLE,
      partition_mode: "NONE",
    },
  ],
  expressions: [],
  relations: [],
  packPartition: null,
  packTarget: { qualifiedName: TABLE },
  sqlSources: [],
};

function pipeline(qualification?: Qualification, scheduleFallback = false) {
  const producer = load(envelope("producer", qualification, scheduleFallback));
  const consumer = load(envelope("consumer", undefined, scheduleFallback));
  const projection = producer.projection as TaskLocalProjection;
  const writers = taskWriters(projection, evidence);
  const merge = mergeLoadedTasksForTest([producer, consumer]);
  const result = traceUnionContinuationV2({
    merge,
    readOccurrenceId: READ_ID,
    producerIndexWriters: writers,
  });
  const index = buildUnionContinuationIndex({
    merge,
    producerIndexWriters: writers,
    generatedAt: "2026-09-07T00:00:00.000Z",
  });
  return { producer, projection, writers, merge, result, index };
}

describe("output qualification through the publication loader", () => {
  it.each([
    ["PLATFORM_TARGET", "CONFIRMED", true],
    ["SQL_UNCONSUMED", "CANDIDATE", false],
    [undefined, "OBSERVED", true],
  ] as const)(
    "preserves %s through unpack, compile, writers and continuation",
    (qualification, status, l1Eligible) => {
      const { producer, projection, writers, result, index } =
        pipeline(qualification);
      const write = producer.projection.localClosure!.finalWrites[0]!;
      expect(write).toEqual(
        expect.objectContaining({
          ...(qualification === undefined
            ? {}
            : { outputQualification: qualification }),
        }),
      );
      const edge = compileTask(projection).edges.find(
        (item) => item.kind === "WRITES_TABLE",
      )!;
      expect(edge.status).toBe(status);
      expect(JSON.parse(edge.detail).outputQualification).toBe(qualification);
      expect(writers[0]).toEqual(
        expect.objectContaining({
          partition: [],
          ...(qualification === undefined
            ? {}
            : { outputQualification: qualification }),
        }),
      );
      const candidate = result.tiers.writeObservation.candidates[0]!;
      expect(candidate).toMatchObject({
        partitionMatchStatus: "CONFIRMED",
        evidenceLayer: l1Eligible ? "L1" : "L2",
        l1Eligible,
        writeObservation: {
          ...(qualification === undefined
            ? {}
            : { outputQualification: qualification }),
        },
      });
      expect(index.entries[0]!.candidates[0]).toMatchObject({
        l1Eligible,
        ...(qualification === undefined
          ? {}
          : { outputQualification: qualification }),
      });
      const indexPath = join(
        mkdtempSync(join(tmpdir(), "output-qualification-consumer-")),
        "continuation-index.json",
      );
      writeFileSync(indexPath, JSON.stringify(index));
      const source = loadUnionContinuationCandidateSource(indexPath);
      expect(source.index.contentHash).toBe(index.contentHash);
      expect(source.candidatesForRead("consumer", READ_ID)).toEqual(
        index.entries[0]!.candidates,
      );
      if (qualification === undefined) {
        expect(write).not.toHaveProperty("outputQualification");
        expect(writers[0]).not.toHaveProperty("outputQualification");
      }
    },
  );

  it("keeps SQL-only output candidates bounded in the schedule-table fallback", () => {
    const { result } = pipeline("SQL_UNCONSUMED", true);
    expect(result.tiers.writeObservation.candidates).toEqual([
      expect.objectContaining({
        partitionMatchStatus: "CONFIRMED",
        evidenceLayer: "L2",
        l1Eligible: false,
        writeObservation: expect.objectContaining({
          source: "SCHEDULE_RELATION_TABLE",
          outputQualification: "SQL_UNCONSUMED",
        }),
      }),
    ]);
  });

  it("keeps explicit candidate qualification from an indexed write even with a legacy local projection", () => {
    const { merge, writers } = pipeline();
    const result = traceUnionContinuationV2({
      merge,
      readOccurrenceId: READ_ID,
      producerIndexWriters: writers.map((writer) => ({
        ...writer,
        outputQualification: "SQL_UNCONSUMED" as const,
      })),
    });
    expect(result.tiers.writeObservation.candidates[0]).toMatchObject({
      evidenceLayer: "L2",
      l1Eligible: false,
    });
  });

  it("retains explicit output qualification for a producer outside the union", () => {
    const { writers } = pipeline("SQL_UNCONSUMED");
    const result = traceUnionContinuationV2({
      merge: mergeLoadedTasksForTest([load(envelope("consumer"))]),
      readOccurrenceId: READ_ID,
      producerIndexWriters: writers,
    });
    expect(result.tiers.writeObservation.candidates[0]).toMatchObject({
      evidenceLayer: "L2",
      l1Eligible: false,
      writeObservation: {
        source: "PRODUCER_INDEX_ONLY",
        outputQualification: "SQL_UNCONSUMED",
      },
    });
  });

  it.each([
    ["SQL_UNCONSUMED", "PLATFORM_TARGET"],
    [undefined, "SQL_UNCONSUMED"],
  ] as const)(
    "preserves candidate qualification from producer-index edge %s and write %s",
    (edgeQualification, writeQualification) => {
      const path = join(
        mkdtempSync(join(tmpdir(), "output-qualification-")),
        "producer-index.json",
      );
      writeFileSync(
        path,
        JSON.stringify({
          contentHash: digest("producer-index"),
          inputFingerprint: "fixture",
          confirmedProducerEdges: [
            {
              taskId: "producer",
              table: { qualifiedName: TABLE },
              ...(edgeQualification === undefined
                ? {}
                : { outputQualification: edgeQualification }),
              writes: [
                {
                  writeObservationId: WRITE_ID,
                  outputQualification: writeQualification,
                  partition: [],
                },
              ],
            },
          ],
        }),
      );
      expect(loadProducerIndex(path).writers[0]).toMatchObject({
        outputQualification: "SQL_UNCONSUMED",
      });
    },
  );

  it("rejects a continuation index that promotes a SQL-only output to L1", () => {
    const { index } = pipeline("SQL_UNCONSUMED");
    const invalid = {
      ...index,
      entries: index.entries.map((entry) => ({
        ...entry,
        candidates: entry.candidates.map((candidate) => ({
          ...candidate,
          l1Eligible: true,
          evidenceLayer: "L1" as const,
        })),
      })),
    };
    expect(() => assertUnionContinuationIndex(invalid)).toThrow(
      "UNION_CONTINUATION_INDEX_L1_ELIGIBILITY_INVALID",
    );
  });

  it("rejects an L1 evidence label for a SQL-only output even when l1Eligible is false", () => {
    const { index } = pipeline("SQL_UNCONSUMED");
    const changed = {
      ...index,
      entries: index.entries.map((entry) => ({
        ...entry,
        candidates: entry.candidates.map((candidate) => ({
          ...candidate,
          evidenceLayer: "L1" as const,
        })),
      })),
    };
    const { contentHash: _contentHash, ...body } = changed;
    expect(() =>
      assertUnionContinuationIndex({
        ...body,
        contentHash: unionContinuationIndexContentHash(body),
      }),
    ).toThrow("UNION_CONTINUATION_INDEX_L1_ELIGIBILITY_INVALID");
  });

  it.each([null, "CONFIRMED", "", 1])(
    "rejects invalid output qualification %s in a serialized index",
    (qualification) => {
      const { index } = pipeline();
      const { contentHash: _contentHash, ...body } = {
        ...index,
        entries: index.entries.map((entry) => ({
          ...entry,
          candidates: entry.candidates.map((candidate) => ({
            ...candidate,
            outputQualification: qualification,
          })),
        })),
      } as unknown as UnionContinuationIndex;
      expect(() =>
        assertUnionContinuationIndex({
          ...body,
          contentHash: unionContinuationIndexContentHash(body),
        }),
      ).toThrow("TASK_LOCAL_PROJECTION_OUTPUT_QUALIFICATION_INVALID");
    },
  );

  it.each([null, "CONFIRMED", "", 1])(
    "rejects invalid explicit output qualification %s",
    (qualification) => {
      const env = envelope("producer");
      const invalid = {
        ...env,
        projection: {
          ...env.projection,
          localClosure: {
            ...env.projection.localClosure!,
            finalWrites: env.projection.localClosure!.finalWrites.map(
              (write) => ({ ...write, outputQualification: qualification }),
            ),
          },
        },
      };
      expect(() =>
        unpackTaskLocalProjectionEnvelope({
          envelope: invalid,
          manifestTaskContentHash: env.projectionContentHash,
        }),
      ).toThrow("TASK_LOCAL_PROJECTION_OUTPUT_QUALIFICATION_INVALID");
    },
  );
});
