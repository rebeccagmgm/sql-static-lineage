import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { physicalDatasetNodeId } from "../src/project-graph/contracts/project-topology-contract.ts";
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
  readonly coverageStatus: "PROJECTED" | "SCHEDULE_ONLY" | "COLLECTION_FAILED";
  readonly nodes: readonly Record<string, unknown>[];
  readonly edges?: readonly Record<string, unknown>[];
  readonly failureReasonCode?: string | null;
}): LoadedTaskLocalUnionTask {
  const contentHash = sha(`body:${input.taskId}`);
  const projection: TaskLocalProjectionBody = {
    schemaVersion: "1.1.0",
    artifactType: "TASK_LOCAL_PROJECTION",
    taskId: input.taskId,
    coverageStatus: input.coverageStatus,
    failureReasonCode: input.failureReasonCode ?? null,
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
    coverageStatus: input.coverageStatus,
    failureReasonCode: input.failureReasonCode ?? null,
  };
  return {
    taskSource,
    envelope,
    projection,
    boundaryOnly: input.coverageStatus !== "PROJECTED",
  };
}

describe("mergeTaskLocalUnion (TU-2)", () => {
  it("merges the same physical dataset from two tasks into one node", () => {
    const datasetId = physicalDatasetNodeId({
      platform: "hive",
      dataSource: "warehouse-a",
      qualifiedName: "pdata_n.t98_sb_otc_opt_comp_info",
    });
    const datasetNode = {
      nodeId: datasetId,
      nodeType: "PHYSICAL_DATASET",
      properties: {
        platform: "hive",
        dataSource: "warehouse-a",
        qualifiedName: "pdata_n.t98_sb_otc_opt_comp_info",
      },
    };
    const writer = loadedTask({
      taskId: "119044",
      coverageStatus: "PROJECTED",
      nodes: [
        {
          nodeId: "task:119044",
          nodeType: "TASK",
          properties: {},
        },
        datasetNode,
      ],
      edges: [
        {
          edgeId: sha("writes-119044"),
          edgeType: "WRITES",
          fromNodeId: "task:119044",
          toNodeId: datasetId,
          properties: {},
        },
      ],
    });
    const reader = loadedTask({
      taskId: "176827",
      coverageStatus: "PROJECTED",
      nodes: [
        {
          nodeId: "task:176827",
          nodeType: "TASK",
          properties: {},
        },
        datasetNode,
      ],
      edges: [
        {
          edgeId: sha("reads-176827"),
          edgeType: "READS",
          fromNodeId: "task:176827",
          toNodeId: datasetId,
          properties: {},
        },
      ],
    });

    const merged = mergeLoadedTasksForTest([writer, reader]);
    const datasets = merged.nodes.filter(
      (node) => node.nodeType === "PHYSICAL_DATASET",
    );
    expect(datasets).toHaveLength(1);
    expect(datasets[0]?.sourceTaskIds).toEqual(["119044", "176827"]);
    expect(merged.edges).toHaveLength(2);
    expect(merged.report.gaps).toEqual([]);
  });

  it("reports DATASET_IDENTITY_DIVERGENT without merging different nodeIds", () => {
    const leftId = physicalDatasetNodeId({
      platform: "hive",
      dataSource: "warehouse-a",
      qualifiedName: "dm.shared_source",
    });
    const rightId = physicalDatasetNodeId({
      platform: "hive",
      dataSource: "unknown",
      qualifiedName: "dm.shared_source",
    });
    expect(leftId).not.toBe(rightId);

    const merged = mergeLoadedTasksForTest([
      loadedTask({
        taskId: "t1",
        coverageStatus: "PROJECTED",
        nodes: [
          { nodeId: "task:t1", nodeType: "TASK", properties: {} },
          {
            nodeId: leftId,
            nodeType: "PHYSICAL_DATASET",
            properties: {
              platform: "hive",
              dataSource: "warehouse-a",
              qualifiedName: "dm.shared_source",
            },
          },
        ],
      }),
      loadedTask({
        taskId: "t2",
        coverageStatus: "PROJECTED",
        nodes: [
          { nodeId: "task:t2", nodeType: "TASK", properties: {} },
          {
            nodeId: rightId,
            nodeType: "PHYSICAL_DATASET",
            properties: {
              platform: "hive",
              dataSource: "unknown",
              qualifiedName: "dm.shared_source",
            },
          },
        ],
      }),
    ]);

    expect(
      merged.nodes.filter((node) => node.nodeType === "PHYSICAL_DATASET"),
    ).toHaveLength(2);
    expect(merged.report.gaps.map((gap) => gap.reasonCode)).toContain(
      "DATASET_IDENTITY_DIVERGENT",
    );
  });

  it("keeps SCHEDULE_ONLY / COLLECTION_FAILED as TASK-only with no data edges", () => {
    const datasetId = physicalDatasetNodeId({
      platform: "hive",
      dataSource: "warehouse-a",
      qualifiedName: "dm.only_projected",
    });
    const merged = mergeLoadedTasksForTest([
      loadedTask({
        taskId: "projected",
        coverageStatus: "PROJECTED",
        nodes: [
          { nodeId: "task:projected", nodeType: "TASK", properties: {} },
          {
            nodeId: datasetId,
            nodeType: "PHYSICAL_DATASET",
            properties: {
              platform: "hive",
              dataSource: "warehouse-a",
              qualifiedName: "dm.only_projected",
            },
          },
        ],
        edges: [
          {
            edgeId: sha("read-projected"),
            edgeType: "READS",
            fromNodeId: "task:projected",
            toNodeId: datasetId,
            properties: {},
          },
        ],
      }),
      loadedTask({
        taskId: "schedule",
        coverageStatus: "SCHEDULE_ONLY",
        nodes: [
          {
            nodeId: "task:schedule",
            nodeType: "TASK",
            properties: {
              scheduleReference: {
                role: "SCHEDULE_REFERENCE_ONLY",
                targetTable: "dm.schedule_target",
              },
            },
          },
        ],
      }),
      loadedTask({
        taskId: "failed",
        coverageStatus: "COLLECTION_FAILED",
        failureReasonCode: "FACTS_UNAVAILABLE",
        nodes: [
          {
            nodeId: "task:failed",
            nodeType: "TASK",
            properties: { failureReasonCode: "FACTS_UNAVAILABLE" },
          },
        ],
      }),
    ]);

    expect(merged.nodes.map((node) => node.nodeId).sort()).toEqual(
      [datasetId, "task:failed", "task:projected", "task:schedule"].sort(),
    );
    expect(merged.edges).toHaveLength(1);
    expect(merged.edges[0]?.sourceTaskIds).toEqual(["projected"]);
    expect(merged.report.boundaryOnlyCount).toBe(2);
  });

  it("emits UNION_EDGE_CONFLICT when same edgeId has conflicting properties", () => {
    const edgeId = sha("shared-edge");
    const datasetId = physicalDatasetNodeId({
      platform: "hive",
      dataSource: "warehouse-a",
      qualifiedName: "dm.conflict",
    });
    const merged = mergeLoadedTasksForTest([
      loadedTask({
        taskId: "a",
        coverageStatus: "PROJECTED",
        nodes: [
          { nodeId: "task:a", nodeType: "TASK", properties: {} },
          {
            nodeId: datasetId,
            nodeType: "PHYSICAL_DATASET",
            properties: {
              platform: "hive",
              dataSource: "warehouse-a",
              qualifiedName: "dm.conflict",
            },
          },
        ],
        edges: [
          {
            edgeId,
            edgeType: "READS",
            fromNodeId: "task:a",
            toNodeId: datasetId,
            properties: { partitionPredicateStatus: "NONE" },
          },
        ],
      }),
      loadedTask({
        taskId: "b",
        coverageStatus: "PROJECTED",
        nodes: [
          { nodeId: "task:b", nodeType: "TASK", properties: {} },
          {
            nodeId: datasetId,
            nodeType: "PHYSICAL_DATASET",
            properties: {
              platform: "hive",
              dataSource: "warehouse-a",
              qualifiedName: "dm.conflict",
            },
          },
        ],
        edges: [
          {
            edgeId,
            edgeType: "READS",
            fromNodeId: "task:b",
            toNodeId: datasetId,
            properties: { partitionPredicateStatus: "LITERAL" },
          },
        ],
      }),
    ]);

    expect(merged.report.gaps.map((gap) => gap.reasonCode)).toContain(
      "UNION_EDGE_CONFLICT",
    );
    expect(merged.edges).toHaveLength(1);
  });
});
