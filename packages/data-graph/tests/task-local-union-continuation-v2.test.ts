import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import type { ProducerIndexWriter } from "../src/project-graph/topology/task-local-union/task-local-union-producer-index.ts";
import { mergeLoadedTasksForTest } from "../src/project-graph/topology/task-local-union/task-local-union-merge.ts";
import { loadProducerIndex } from "../src/project-graph/topology/task-local-union/task-local-union-producer-index.ts";
import {
  traceUnionContinuationV2,
  traceUnionTaskContinuationV2,
} from "../src/project-graph/topology/task-local-union/task-local-union-continuation-v2.ts";
import {
  assertUnionContinuationEvidenceEnvelope,
  buildUnionContinuationEvidenceEnvelope,
} from "../src/project-graph/topology/task-local-union/task-local-union-continuation-envelope.ts";
import type { LoadedTaskLocalUnionTask } from "../src/project-graph/topology/task-local-union/task-local-union-source.ts";
import type {
  TaskLocalProjectionBody,
  TaskLocalProjectionClosure,
  TaskLocalProjectionEnvelope,
  TaskLocalUnionTaskSource,
} from "../src/project-graph/topology/task-local-union/task-local-union-contract.ts";
import { unpackTaskLocalProjectionEnvelope } from "../src/project-graph/topology/task-local-union/task-local-union-contract.ts";

const CURRENT_119044_ENVELOPE = resolve(
  "tmp/wp8-real-v2-119044/tasks/119044/task-local-projection.json",
);
const CURRENT_PRODUCER_INDEX = resolve(
  "../../sql-static-lineage-data.producer-index/producer-index.json",
);

const TABLE_ID =
  "dataset:7ac42558fef06b1fd2fb083947bc3874a9851ff1ec7490ab3317346efecd9ccc";
const TABLE = "pdata_n.t03_agt_stati_info_h";
const READ_C =
  "task:119044:statement:0:relation:root.c.read.t03_agt_stati_info_h";
const READ_K =
  "task:119044:statement:0:relation:root.k.read.t03_agt_stati_info_h";
const READ_C_NODE =
  "read-occurrence:9ed51b2f3927ead88617b78f14ac9433a0196878a1b865779e3f8203d5061e39";
const READ_K_NODE =
  "read-occurrence:4ce98deea38286658526f685962c369d424a7744702e02374dec73b2c81e395e";
const WRITE_105387_3 = "write-observation:105387:3";
const WRITE_105387_6 = "write-observation:105387:6";
const WRITE_105387_PRODUCER_INDEX = "write-observation:105387:0";

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadedTask(input: {
  readonly taskId: string;
  readonly schemaVersion?: "1.1.0" | "1.2.0";
  readonly nodes: readonly Record<string, unknown>[];
  readonly localClosure?: TaskLocalProjectionClosure;
  readonly coverageStatus?: "PROJECTED" | "SCHEDULE_ONLY";
}): LoadedTaskLocalUnionTask {
  const coverageStatus = input.coverageStatus ?? "PROJECTED";
  const schemaVersion = input.schemaVersion ?? "1.2.0";
  const contentHash = sha(
    `task-local-projection:${schemaVersion}:${input.taskId}`,
  );
  const projection: TaskLocalProjectionBody = {
    schemaVersion,
    artifactType: "TASK_LOCAL_PROJECTION",
    taskId: input.taskId,
    coverageStatus,
    failureReasonCode: null,
    contentHash,
    nodes: input.nodes,
    edges: [],
    ...(input.localClosure ? { localClosure: input.localClosure } : {}),
  };
  const envelope: TaskLocalProjectionEnvelope = {
    cacheKey: sha(`cache:${input.taskId}`),
    cacheKeyParts: {
      taskId: input.taskId,
      packContentHash: sha(`pack:${input.taskId}`),
      factsManifestSha256: sha(`facts:${input.taskId}`),
      schemaVersion,
    },
    projectionContentHash: contentHash,
    projection,
  };
  const taskSource: TaskLocalUnionTaskSource = {
    taskId: input.taskId,
    contentHash,
    packContentHash: envelope.cacheKeyParts.packContentHash,
    factsManifestSha256: envelope.cacheKeyParts.factsManifestSha256,
    coverageStatus,
    failureReasonCode: null,
  };
  return {
    taskSource,
    envelope,
    projection,
    boundaryOnly: coverageStatus !== "PROJECTED",
  };
}

function readNode(
  occurrenceId: string,
  nodeId: string,
  sourceTable: string,
  typeCode: string,
  partitionPredicateStatus: "LITERAL" | "NON_LITERAL_PRESENT",
  partitionPredicates = [
    { column: "Agt_Stati_Info_Type_Cd", values: [typeCode] },
    { column: "SRC_TBL", values: [sourceTable] },
  ],
) {
  return {
    nodeId,
    nodeType: "READ_OCCURRENCE",
    properties: {
      occurrenceId,
      datasetNodeId: TABLE_ID,
      physicalDataset: TABLE,
      identityStatus: "CONFIRMED",
      partitionPredicateStatus,
      partitionPredicates,
    },
  };
}

function real119044Merge() {
  const consumer = loadedTask({
    taskId: "119044",
    nodes: [
      { nodeId: "task:119044", nodeType: "TASK", properties: {} },
      readNode(
        READ_C,
        READ_C_NODE,
        "ODATA_N_TIT.D_TRD_OTC_TRADE",
        "09",
        "NON_LITERAL_PRESENT",
      ),
      readNode(
        READ_K,
        READ_K_NODE,
        "ODATA_N_TIT.D_REF_BOOK",
        "07",
        "NON_LITERAL_PRESENT",
      ),
    ],
    localClosure: {
      finalWrites: [],
      externalReads: [
        {
          readOccurrenceId: READ_C,
          readOccurrenceNodeId: READ_C_NODE,
          datasetNodeId: TABLE_ID,
          qualifiedName: TABLE,
          identityStatus: "CONFIRMED",
        },
        {
          readOccurrenceId: READ_K,
          readOccurrenceNodeId: READ_K_NODE,
          datasetNodeId: TABLE_ID,
          qualifiedName: TABLE,
          identityStatus: "CONFIRMED",
        },
      ],
    },
  });
  const writer = loadedTask({
    taskId: "105387",
    nodes: [{ nodeId: "task:105387", nodeType: "TASK", properties: {} }],
    localClosure: {
      finalWrites: [
        {
          writeObservationId: WRITE_105387_3,
          targetWriteNodeId: "target-write:105387:3",
          datasetNodeId: TABLE_ID,
          qualifiedName: TABLE,
        },
        {
          writeObservationId: WRITE_105387_6,
          targetWriteNodeId: "target-write:105387:6",
          datasetNodeId: TABLE_ID,
          qualifiedName: TABLE,
        },
      ],
      externalReads: [],
    },
  });
  const scheduleOnly = loadedTask({
    taskId: "999999",
    coverageStatus: "SCHEDULE_ONLY",
    nodes: [
      {
        nodeId: "task:999999",
        nodeType: "TASK",
        properties: {
          scheduleReference: {
            role: "SCHEDULE_REFERENCE_ONLY",
            targetTable: TABLE,
            upstreamTaskIds: ["105387"],
          },
        },
      },
    ],
  });
  return mergeLoadedTasksForTest([consumer, writer, scheduleOnly]);
}

function producerWriter(
  taskId: string,
  writeObservationId: string,
  sourceTable: string,
): ProducerIndexWriter {
  return {
    taskId,
    writeObservationId,
    qualifiedName: TABLE,
    partition: [
      {
        column: "src_tbl",
        values: [sourceTable],
        partitionStatus: "COMPLETE",
        valueStatus: "OBSERVED_RENDERED_VALUE",
        observedValue: sourceTable,
      },
    ],
  };
}

const producers: readonly ProducerIndexWriter[] = [
  producerWriter(
    "103939",
    "write-observation:103939:0",
    "ODATA_N_TIT.D_MARGIN_ACCOUNT",
  ),
  producerWriter(
    "105385",
    "write-observation:105385:0",
    "ODATA_N_TIT.D_REF_BOOK",
  ),
  producerWriter(
    "105387",
    WRITE_105387_PRODUCER_INDEX,
    "ODATA_N_TIT.D_TRD_OTC_TRADE",
  ),
  producerWriter(
    "144289",
    "write-observation:144289:0",
    "ODATA_N_TIT.D_TRD_OTC_TRADE",
  ),
  producerWriter(
    "999999",
    "write-observation:999999:0",
    "ODATA_N_TIT.D_REF_BOOK",
  ),
];

describe("union-continuation-v2 (WP-8)", () => {
  it("uses the two real 119044 read occurrences and keeps table/partition/write tiers distinct", () => {
    const merge = real119044Merge();
    const result = traceUnionTaskContinuationV2({
      merge,
      consumerTaskId: "119044",
      producerIndexWriters: producers,
    });

    expect(
      result.readOccurrences.map(
        (item) => item.readOccurrence.readOccurrenceId,
      ),
    ).toEqual([READ_C, READ_K]);

    const byRead = new Map(
      result.readOccurrences.map((item) => [
        item.readOccurrence.readOccurrenceId,
        item,
      ]),
    );
    const c = byRead.get(READ_C)!;
    expect(c.tiers.table.candidateWriteObservationIds).toEqual([
      "write-observation:103939:0",
      "write-observation:105385:0",
      WRITE_105387_3,
      WRITE_105387_6,
      "write-observation:144289:0",
    ]);
    expect(c.tiers.partition.prunedWriteObservationIds).toEqual([
      "write-observation:103939:0",
      "write-observation:105385:0",
    ]);
    expect(c.tiers.writeObservation.candidateWriteObservationIds).toEqual([
      WRITE_105387_3,
      WRITE_105387_6,
      "write-observation:144289:0",
    ]);
    expect(c.tiers.writeObservation.uniqueWriteObservationId).toBeNull();
    expect(
      c.tiers.partition.candidates.find(
        (item) => item.writeObservation.writeObservationId === WRITE_105387_3,
      ),
    ).toMatchObject({
      partitionMatchStatus: "UNKNOWN",
      evidenceLayer: "L2",
      l1Eligible: false,
    });

    const k = byRead.get(READ_K)!;
    expect(k.tiers.partition.prunedWriteObservationIds).toEqual([
      "write-observation:103939:0",
      "write-observation:144289:0",
    ]);
    expect(k.tiers.writeObservation.uniqueWriteObservationId).toBeNull();
    expect(k.tiers.writeObservation.candidates[0]).toMatchObject({
      partitionMatchStatus: "UNKNOWN",
      evidenceLayer: "L2",
      l1Eligible: false,
    });
    expect(k.gaps.map((gap) => gap.reasonCode)).toContain(
      "WRITER_NOT_IN_UNION",
    );
    expect(
      result.readOccurrences.flatMap((item) =>
        item.tiers.table.candidates.map(
          (candidate) => candidate.writeObservation.taskId,
        ),
      ),
    ).not.toContain("999999");
    expect(c.gaps.map((gap) => gap.reasonCode)).toContain(
      "WRITE_OBSERVATION_ALIGNMENT_AMBIGUOUS",
    );
    expect(k.gaps.map((gap) => gap.reasonCode)).toContain(
      "WRITE_OBSERVATION_ALIGNMENT_AMBIGUOUS",
    );
  });

  it("keeps ASSUMED partition matches out of L1", () => {
    const readId =
      "task:200000:statement:0:relation:root.read.t03_agt_stati_info_h";
    const readNodeId = "read-occurrence:200000:0";
    const merge = mergeLoadedTasksForTest([
      loadedTask({
        taskId: "200000",
        nodes: [
          readNode(
            readId,
            readNodeId,
            "ODATA_N_TIT.D_TRD_OTC_TRADE",
            "09",
            "LITERAL",
            [{ column: "busi_date", values: ["2026-09-03"] }],
          ),
        ],
        localClosure: {
          finalWrites: [],
          externalReads: [
            {
              readOccurrenceId: readId,
              readOccurrenceNodeId: readNodeId,
              datasetNodeId: TABLE_ID,
              qualifiedName: TABLE,
              identityStatus: "CONFIRMED",
            },
          ],
        },
      }),
      loadedTask({
        taskId: "300000",
        nodes: [],
        localClosure: {
          finalWrites: [
            {
              writeObservationId: "write-observation:300000:0",
              targetWriteNodeId: "target-write:300000:0",
              datasetNodeId: TABLE_ID,
              qualifiedName: TABLE,
            },
          ],
          externalReads: [],
        },
      }),
    ]);
    const result = traceUnionContinuationV2({
      merge,
      readOccurrenceId: readId,
      producerIndexWriters: [
        {
          taskId: "300000",
          writeObservationId: "write-observation:300000:0",
          qualifiedName: TABLE,
          partition: [
            {
              column: "busi_date",
              values: ["${YYYY-MM-DD}"],
              partitionStatus: "COMPLETE",
              valueStatus: "RUNTIME_EXPRESSION",
              expression: "${YYYY-MM-DD}",
            },
          ],
        },
      ],
    });
    expect(result.tiers.writeObservation.candidates[0]).toMatchObject({
      partitionMatchStatus: "ASSUMED",
      evidenceLayer: "L2",
      l1Eligible: false,
    });
  });

  it("allows L1 only for a confirmed in-union literal match", () => {
    const readId =
      "task:400000:statement:0:relation:root.read.t03_agt_stati_info_h";
    const readNodeId = "read-occurrence:400000:0";
    const merge = mergeLoadedTasksForTest([
      loadedTask({
        taskId: "400000",
        nodes: [
          readNode(
            readId,
            readNodeId,
            "ODATA_N_TIT.D_TRD_OTC_TRADE",
            "09",
            "LITERAL",
          ),
        ],
        localClosure: {
          finalWrites: [],
          externalReads: [
            {
              readOccurrenceId: readId,
              readOccurrenceNodeId: readNodeId,
              datasetNodeId: TABLE_ID,
              qualifiedName: TABLE,
              identityStatus: "CONFIRMED",
            },
          ],
        },
      }),
      loadedTask({
        taskId: "400001",
        nodes: [],
        localClosure: {
          finalWrites: [
            {
              writeObservationId: "write-observation:400001:0",
              targetWriteNodeId: "target-write:400001:0",
              datasetNodeId: TABLE_ID,
              qualifiedName: TABLE,
            },
          ],
          externalReads: [],
        },
      }),
    ]);
    const result = traceUnionContinuationV2({
      merge,
      readOccurrenceId: readId,
      producerIndexWriters: [
        producerWriter(
          "400001",
          "write-observation:400001:0",
          "ODATA_N_TIT.D_TRD_OTC_TRADE",
        ),
      ],
    });
    expect(result.tiers.writeObservation.candidates[0]).toMatchObject({
      partitionMatchStatus: "CONFIRMED",
      evidenceLayer: "L1",
      l1Eligible: true,
    });
  });

  it("wraps a v2 result in a replayable L0-L3 evidence envelope", () => {
    const merge = real119044Merge();
    const continuation = traceUnionTaskContinuationV2({
      merge,
      consumerTaskId: "119044",
      producerIndexWriters: producers,
    });
    const result = continuation.readOccurrences.find(
      (item) => item.readOccurrence.readOccurrenceId === READ_C,
    )!;
    const envelope = buildUnionContinuationEvidenceEnvelope({
      merge,
      result,
      generatedAt: "2026-09-03T00:00:00.000Z",
    });

    expect(envelope.artifactType).toBe("UNION_CONTINUATION_EVIDENCE");
    expect(envelope.coverage).toMatchObject({
      evidenceLayer: "L0",
      consumerCoverageStatus: "PROJECTED",
      candidateCounts: { table: 5, partition: 5, writeObservation: 3 },
    });
    expect(envelope.l1.candidateWriteObservationIds).toEqual([]);
    expect(envelope.l2.candidateWriteObservationIds).toEqual([
      WRITE_105387_3,
      WRITE_105387_6,
      "write-observation:144289:0",
    ]);
    expect(envelope.l3.gaps.map((gap) => gap.reasonCode)).toContain(
      "WRITE_OBSERVATION_ALIGNMENT_AMBIGUOUS",
    );
    expect(envelope.input.taskProjections.map((item) => item.taskId)).toEqual([
      "105387",
      "119044",
      "999999",
    ]);
    assertUnionContinuationEvidenceEnvelope(envelope);

    const laterEnvelope = buildUnionContinuationEvidenceEnvelope({
      merge,
      result,
      generatedAt: "2026-09-04T00:00:00.000Z",
    });
    expect(laterEnvelope.contentHash).toBe(envelope.contentHash);
  });

  it("rejects a legacy projection as v2 evidence", () => {
    const merge = mergeLoadedTasksForTest([
      loadedTask({
        taskId: "119044",
        schemaVersion: "1.1.0",
        nodes: [readNode(READ_C, READ_C_NODE, "source", "09", "LITERAL")],
        localClosure: {
          finalWrites: [],
          externalReads: [
            {
              readOccurrenceId: READ_C,
              readOccurrenceNodeId: READ_C_NODE,
              datasetNodeId: TABLE_ID,
              qualifiedName: TABLE,
              identityStatus: "CONFIRMED",
            },
          ],
        },
      }),
    ]);
    expect(() =>
      traceUnionContinuationV2({
        merge,
        readOccurrenceId: READ_C,
      }),
    ).toThrow("UNION_CONTINUATION_PROJECTION_SCHEMA_UNSUPPORTED");
  });

  it("rejects a legacy projected producer instead of using it as PI-only evidence", () => {
    const merge = mergeLoadedTasksForTest([
      loadedTask({
        taskId: "500000",
        nodes: [readNode(READ_C, READ_C_NODE, "source", "09", "LITERAL")],
        localClosure: {
          finalWrites: [],
          externalReads: [
            {
              readOccurrenceId: READ_C,
              readOccurrenceNodeId: READ_C_NODE,
              datasetNodeId: TABLE_ID,
              qualifiedName: TABLE,
              identityStatus: "CONFIRMED",
            },
          ],
        },
      }),
      loadedTask({
        taskId: "500001",
        schemaVersion: "1.1.0",
        nodes: [],
        localClosure: undefined,
      }),
    ]);
    expect(() =>
      traceUnionContinuationV2({
        merge,
        readOccurrenceId: READ_C,
        producerIndexWriters: [
          producerWriter(
            "500001",
            "write-observation:500001:0",
            "ODATA_N_TIT.D_TRD_OTC_TRADE",
          ),
        ],
      }),
    ).toThrow("UNION_CONTINUATION_PROJECTION_SCHEMA_UNSUPPORTED:500001");
  });

  it("keeps producer-index writes separate for a same-table multi-write task", () => {
    const root = mkdtempSync(join(tmpdir(), "data-graph-wp8-"));
    const path = join(root, "producer-index.json");
    writeFileSync(
      path,
      JSON.stringify({
        contentHash: sha("producer-index"),
        inputFingerprint: sha("producer-input"),
        confirmedProducerEdges: [
          {
            taskId: "238748",
            table: { qualifiedName: TABLE },
            writes: [
              {
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
    const loaded = loadProducerIndex(path).writers;
    expect(loaded).toHaveLength(2);
    expect(loaded.map((writer) => writer.partition?.[0]?.values[0])).toEqual([
      "A",
      "B",
    ]);
    expect(loaded.map((writer) => writer.writeObservationId)).toEqual([
      "write-observation:238748:0",
      "write-observation:238748:1",
    ]);
  });
});

const describeCurrentArtifact =
  existsSync(CURRENT_119044_ENVELOPE) && existsSync(CURRENT_PRODUCER_INDEX)
    ? describe
    : describe.skip;

describeCurrentArtifact("union-continuation-v2 current 1.2.0 artifact", () => {
  it("reads 119044's current envelope, not the legacy golden projection", () => {
    const envelope = JSON.parse(readFileSync(CURRENT_119044_ENVELOPE, "utf8"));
    const unpacked = unpackTaskLocalProjectionEnvelope({
      envelope,
      manifestTaskContentHash: envelope.projection.contentHash,
    });
    expect(unpacked.projection.schemaVersion).toBe("1.2.0");
    expect(
      unpacked.projection.localClosure?.externalReads.filter(
        (read) => read.qualifiedName === TABLE,
      ),
    ).toHaveLength(2);

    const consumer: LoadedTaskLocalUnionTask = {
      taskSource: unpacked.taskSource,
      envelope: unpacked.envelope,
      projection: unpacked.projection,
      boundaryOnly: false,
    };
    const merge = mergeLoadedTasksForTest([
      consumer,
      loadedTask({
        taskId: "105387",
        nodes: [],
        localClosure: {
          finalWrites: [
            {
              writeObservationId: WRITE_105387_3,
              targetWriteNodeId: "target-write:105387:3",
              datasetNodeId: TABLE_ID,
              qualifiedName: TABLE,
            },
            {
              writeObservationId: WRITE_105387_6,
              targetWriteNodeId: "target-write:105387:6",
              datasetNodeId: TABLE_ID,
              qualifiedName: TABLE,
            },
          ],
          externalReads: [],
        },
      }),
    ]);
    const actualWriters = loadProducerIndex(
      CURRENT_PRODUCER_INDEX,
    ).writers.filter(
      (writer) => writer.qualifiedName?.toLowerCase() === TABLE.toLowerCase(),
    );
    const result = traceUnionTaskContinuationV2({
      merge,
      consumerTaskId: "119044",
      producerIndexWriters: actualWriters,
    });
    const byRead = new Map(
      result.readOccurrences.map((item) => [
        item.readOccurrence.readOccurrenceId,
        item,
      ]),
    );
    expect(byRead.get(READ_C)?.tiers.partition.pruned).toBe(true);
    expect(
      byRead
        .get(READ_C)
        ?.tiers.partition.candidates.filter(
          (candidate) => candidate.partitionMatchStatus === "DISJOINT",
        )
        .map((candidate) => candidate.writeObservation.taskId)
        .sort(),
    ).toEqual(["103939", "105385"]);
    expect(
      byRead
        .get(READ_K)
        ?.tiers.writeObservation.candidates.map(
          (candidate) => candidate.writeObservation.taskId,
        ),
    ).toEqual(["105385", "105387", "105387"]);
    expect(byRead.get(READ_C)?.gaps.map((gap) => gap.reasonCode)).toContain(
      "WRITE_OBSERVATION_ALIGNMENT_AMBIGUOUS",
    );
  });

  it("keeps a bounded sample of twenty current same-table multi-write scopes write-scoped", () => {
    const raw = JSON.parse(readFileSync(CURRENT_PRODUCER_INDEX, "utf8")) as {
      confirmedProducerEdges?: readonly Record<string, unknown>[];
    };
    const scopes = new Map<
      string,
      { taskId: string; qualifiedName: string; writes: unknown[] }
    >();
    for (const edge of raw.confirmedProducerEdges ?? []) {
      const taskId = typeof edge.taskId === "string" ? edge.taskId : null;
      const table =
        typeof edge.table === "object" &&
        edge.table !== null &&
        !Array.isArray(edge.table)
          ? (edge.table as Record<string, unknown>)
          : null;
      const qualifiedName =
        table && typeof table.qualifiedName === "string"
          ? table.qualifiedName
          : null;
      const writes = Array.isArray(edge.writes) ? [...edge.writes] : [];
      if (!taskId || !qualifiedName || writes.length < 2) continue;
      const key = `${taskId}\u0000${qualifiedName.toLowerCase()}`;
      const scope = scopes.get(key) ?? { taskId, qualifiedName, writes: [] };
      scope.writes.push(...writes);
      scopes.set(key, scope);
    }
    const sample = [...scopes.values()]
      .sort((left, right) =>
        `${left.qualifiedName}\u0000${left.taskId}`.localeCompare(
          `${right.qualifiedName}\u0000${right.taskId}`,
        ),
      )
      .slice(0, 20);
    expect(sample).toHaveLength(20);

    const loaded = loadProducerIndex(CURRENT_PRODUCER_INDEX).writers;
    for (const scope of sample) {
      const writers = loaded.filter(
        (writer) =>
          writer.taskId === scope.taskId &&
          writer.qualifiedName?.toLowerCase() ===
            scope.qualifiedName.toLowerCase(),
      );
      expect(writers).toHaveLength(scope.writes.length);
      expect(
        new Set(writers.map((writer) => writer.writeObservationId)).size,
      ).toBe(scope.writes.length);
    }
  });
});
