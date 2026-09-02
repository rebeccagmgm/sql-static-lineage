import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { physicalDatasetNodeId } from "../src/project-graph/contracts/project-topology-contract.ts";
import {
  assertNoScheduleReferenceInPruneInput,
  traceUnionUpstream,
} from "../src/project-graph/topology/task-local-union/task-local-union-continuation.ts";
import { mergeLoadedTasksForTest } from "../src/project-graph/topology/task-local-union/task-local-union-merge.ts";
import type { LoadedTaskLocalUnionTask } from "../src/project-graph/topology/task-local-union/task-local-union-source.ts";
import type {
  TaskLocalProjectionBody,
  TaskLocalProjectionEnvelope,
  TaskLocalUnionTaskSource,
} from "../src/project-graph/topology/task-local-union/task-local-union-contract.ts";

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadedTask(input: {
  readonly taskId: string;
  readonly nodes: readonly Record<string, unknown>[];
  readonly edges?: readonly Record<string, unknown>[];
}): LoadedTaskLocalUnionTask {
  const contentHash = sha(`body:${input.taskId}`);
  const projection: TaskLocalProjectionBody = {
    schemaVersion: "1.1.0",
    artifactType: "TASK_LOCAL_PROJECTION",
    taskId: input.taskId,
    coverageStatus: "PROJECTED",
    failureReasonCode: null,
    contentHash,
    nodes: input.nodes,
    edges: input.edges ?? [],
  };
  const envelope: TaskLocalProjectionEnvelope = {
    cacheKey: sha(`cache:${input.taskId}`),
    cacheKeyParts: {
      taskId: input.taskId,
      packContentHash: sha(`pack:${input.taskId}`),
      factsManifestSha256: sha(`facts:${input.taskId}`),
      schemaVersion: "1.1.0",
    },
    projectionContentHash: contentHash,
    projection,
  };
  const taskSource: TaskLocalUnionTaskSource = {
    taskId: input.taskId,
    contentHash,
    packContentHash: envelope.cacheKeyParts.packContentHash,
    factsManifestSha256: envelope.cacheKeyParts.factsManifestSha256,
    coverageStatus: "PROJECTED",
    failureReasonCode: null,
  };
  return { taskSource, envelope, projection, boundaryOnly: false };
}

describe("traceUnionUpstream (TU-4 fixtures)", () => {
  const datasetId = physicalDatasetNodeId({
    platform: "hive",
    dataSource: "warehouse-a",
    qualifiedName: "pdata_n.t98_sb_otc_opt_comp_info",
  });

  function chain119044to176827() {
    const targetWriteId = `target-write:${sha("119044-write")}`;
    return mergeLoadedTasksForTest([
      loadedTask({
        taskId: "119044",
        nodes: [
          { nodeId: "task:119044", nodeType: "TASK", properties: {} },
          {
            nodeId: targetWriteId,
            nodeType: "TARGET_WRITE",
            properties: { taskId: "119044" },
          },
          {
            nodeId: datasetId,
            nodeType: "PHYSICAL_DATASET",
            properties: {
              platform: "hive",
              dataSource: "warehouse-a",
              qualifiedName: "pdata_n.t98_sb_otc_opt_comp_info",
            },
          },
        ],
        edges: [
          {
            edgeId: sha("task-to-tw"),
            edgeType: "WRITES",
            fromNodeId: "task:119044",
            toNodeId: targetWriteId,
            properties: {},
          },
          {
            edgeId: sha("tw-to-ds"),
            edgeType: "WRITES",
            fromNodeId: targetWriteId,
            toNodeId: datasetId,
            properties: {},
          },
        ],
      }),
      loadedTask({
        taskId: "176827",
        nodes: [
          { nodeId: "task:176827", nodeType: "TASK", properties: {} },
          {
            nodeId: datasetId,
            nodeType: "PHYSICAL_DATASET",
            properties: {
              platform: "hive",
              dataSource: "warehouse-a",
              qualifiedName: "pdata_n.t98_sb_otc_opt_comp_info",
            },
          },
        ],
        edges: [
          {
            edgeId: sha("read-176827"),
            edgeType: "READS",
            fromNodeId: "task:176827",
            toNodeId: datasetId,
            properties: { partitionPredicateStatus: "NONE" },
          },
        ],
      }),
    ]);
  }

  it("§5.1 finds in-union writer via WRITES two-hop without producer-index", () => {
    const merge = chain119044to176827();
    const result = traceUnionUpstream({
      merge,
      datasetNodeId: datasetId,
      enableDerivedProducerBridge: false,
    });
    expect(result.inUnionWriterTaskIds).toEqual(["119044"]);
    expect(result.derivedEdges).toEqual([]);
    expect(result.gaps.map((gap) => gap.reasonCode)).not.toContain(
      "NO_KNOWN_WRITER",
    );
  });

  it("§5.2 surfaces WRITER_NOT_IN_UNION and respects derived kill-switch", () => {
    const merge = chain119044to176827();
    const withDerived = traceUnionUpstream({
      merge,
      datasetNodeId: datasetId,
      producerIndexWriters: [
        { taskId: "119044", datasetNodeId: datasetId },
        { taskId: "555555", datasetNodeId: datasetId },
      ],
      enableDerivedProducerBridge: true,
    });
    expect(withDerived.producerIndexBoundaryTaskIds).toEqual(["555555"]);
    expect(withDerived.derivedEdges).toHaveLength(1);
    expect(withDerived.derivedEdges[0]?.edgeType).toBe("PRODUCER_BRIDGE");

    const withoutDerived = traceUnionUpstream({
      merge,
      datasetNodeId: datasetId,
      producerIndexWriters: [{ taskId: "555555", datasetNodeId: datasetId }],
      enableDerivedProducerBridge: false,
    });
    expect(withoutDerived.derivedEdges).toEqual([]);
    expect(withoutDerived.inUnionWriterTaskIds).toEqual(["119044"]);
    expect(withoutDerived.gaps.map((gap) => gap.reasonCode)).toContain(
      "WRITER_NOT_IN_UNION",
    );
  });

  it("§5.4 NON_LITERAL_PRESENT returns gap and does not invent a unique writer", () => {
    const merge = chain119044to176827();
    const result = traceUnionUpstream({
      merge,
      datasetNodeId: datasetId,
      readPartition: { partitionPredicateStatus: "NON_LITERAL_PRESENT" },
    });
    expect(result.gaps.map((gap) => gap.reasonCode)).toContain(
      "READ_PREDICATE_NON_LITERAL",
    );
    expect(result.inUnionWriterTaskIds).toEqual(["119044"]);
  });

  it("rejects scheduleReference keys in prune input helper", () => {
    expect(() =>
      assertNoScheduleReferenceInPruneInput({
        partitionPredicateStatus: "NONE",
        // @ts-expect-error intentional smuggle
        scheduleReference: { upstreamTaskIds: ["x"] },
      }),
    ).toThrow(/TASK_LOCAL_UNION_SCHEDULE_REFERENCE_IN_PRUNE_INPUT/);
  });

  it("SCHEDULE_ONLY targetTable is CANDIDATE only", () => {
    const merge = chain119044to176827();
    const result = traceUnionUpstream({
      merge,
      datasetNodeId: datasetId,
      scheduleOnlyCandidates: [
        {
          taskId: "999001",
          targetTable: "pdata_n.t98_sb_otc_opt_comp_info",
        },
      ],
    });
    expect(result.candidateScheduleOnlyTaskIds).toEqual(["999001"]);
    expect(
      result.gaps.find(
        (gap) => gap.reasonCode === "CANDIDATE_SCHEDULE_ONLY_WRITER",
      )?.details.evidenceStatus,
    ).toBe("CANDIDATE");
  });
});
