import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { physicalDatasetNodeId } from "../src/project-graph/contracts/project-topology-contract.ts";
import { traceUnionUpstream } from "../src/project-graph/topology/task-local-union/task-local-union-continuation.ts";
import { mergeLoadedTasksForTest } from "../src/project-graph/topology/task-local-union/task-local-union-merge.ts";
import { exportScheduleDependsOnEdges } from "../src/project-graph/topology/task-local-union/task-local-union-schedule-edges.ts";
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

describe("exportScheduleDependsOnEdges (TU-5)", () => {
  const datasetId = physicalDatasetNodeId({
    platform: "hive",
    dataSource: "warehouse-a",
    qualifiedName: "pdata_n.t98_sb_otc_opt_comp_info",
  });

  function fixtureMerge() {
    const targetWriteId = `target-write:${sha("119044-write")}`;
    return mergeLoadedTasksForTest([
      loadedTask({
        taskId: "119044",
        nodes: [
          {
            nodeId: "task:119044",
            nodeType: "TASK",
            properties: {
              scheduleReference: {
                role: "SCHEDULE_REFERENCE_ONLY",
                upstreamTaskIds: ["105387", "999001"],
                downstreamTaskIds: ["176827"],
              },
            },
          },
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
          {
            nodeId: "task:176827",
            nodeType: "TASK",
            properties: {
              scheduleReference: {
                role: "SCHEDULE_REFERENCE_ONLY",
                upstreamTaskIds: ["119044"],
                downstreamTaskIds: [],
              },
            },
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
            edgeId: sha("read-176827"),
            edgeType: "READS",
            fromNodeId: "task:176827",
            toNodeId: datasetId,
            properties: {},
          },
        ],
      }),
    ]);
  }

  it("exports SCHEDULE_DEPENDS_ON derived edges with SCHEDULE_REFERENCE provenance", () => {
    const merge = fixtureMerge();
    const exported = exportScheduleDependsOnEdges({ merge });
    expect(exported.derivedEdges.length).toBeGreaterThan(0);
    expect(
      exported.derivedEdges.every(
        (edge) =>
          edge.edgeType === "SCHEDULE_DEPENDS_ON" &&
          edge.derived === true &&
          edge.provenance === "SCHEDULE_REFERENCE" &&
          edge.evidenceStatus === "CANDIDATE",
      ),
    ).toBe(true);
    expect(
      exported.derivedEdges.some(
        (edge) =>
          edge.fromNodeId === "task:119044" && edge.toNodeId === "task:105387",
      ),
    ).toBe(true);
    expect(
      exported.derivedEdges.some(
        (edge) =>
          edge.fromNodeId === "task:176827" && edge.toNodeId === "task:119044",
      ),
    ).toBe(true);
    // Neighbor not in union is materialized as display-only TASK.
    expect(
      exported.neighborNodes.some((node) => node.nodeId === "task:999001"),
    ).toBe(true);
  });

  it("TU-4 continuation is invariant under schedule display export", () => {
    const merge = fixtureMerge();
    const before = traceUnionUpstream({
      merge,
      datasetNodeId: datasetId,
      enableDerivedProducerBridge: false,
    });
    const exported = exportScheduleDependsOnEdges({ merge });
    expect(exported.derivedEdges.length).toBeGreaterThan(0);
    const after = traceUnionUpstream({
      merge,
      datasetNodeId: datasetId,
      enableDerivedProducerBridge: false,
    });
    expect(after).toEqual(before);
    expect(after.inUnionWriterTaskIds).toEqual(["119044"]);
    // Schedule edges are not mixed into merge.edges.
    expect(merge.edges.every((edge) => edge.derived === false)).toBe(true);
    expect(
      merge.edges.some((edge) => edge.edgeType === "SCHEDULE_DEPENDS_ON"),
    ).toBe(false);
  });
});
