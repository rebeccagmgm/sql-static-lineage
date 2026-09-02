import { describe, expect, it } from "vitest";

import {
  canonicalizeTaskLocalProjection,
  taskLocalProjectionContentHash,
  validateTaskLocalProjection,
  type TaskLocalProjection,
} from "../../../scripts/project-graph/task-local/contract.ts";
import {
  fieldEvidencePhysicalFieldNodeId,
  physicalDatasetNodeId,
  targetWriteNodeId,
  taskLocalEdgeId,
  taskNodeId,
} from "../../../scripts/project-graph/task-local/ids.ts";

const TASK_ID = "176827";
const TASK_NODE = taskNodeId(TASK_ID);
const DATASET_NODE = physicalDatasetNodeId({
  platform: "hive",
  dataSource: "gfhive",
  qualifiedName: "dm_rsk_n.otc_opt_greek_val_det_h",
});
const TARGET_WRITE_NODE = targetWriteNodeId({
  taskId: TASK_ID,
  datasetNodeId: DATASET_NODE,
  writeObservationId: "write-observation:176827:platform-target:0",
});
const FIELD_NODE = fieldEvidencePhysicalFieldNodeId({
  platform: "hive",
  dataSource: "gfhive",
  stableTableId: "pdata_n.t98_sb_otc_opt_comp_info__gfhive",
  qualifiedName: "pdata_n.t98_sb_otc_opt_comp_info",
  column: "inr_ord_id",
});

function minimalProjected(overrides: Partial<TaskLocalProjection> = {}): TaskLocalProjection {
  const readsEdgeId = taskLocalEdgeId({
    edgeType: "READS",
    fromNodeId: TASK_NODE,
    toNodeId: DATASET_NODE,
    semanticKey: { readOccurrenceId: "occ:0" },
  });
  const base = {
    schemaVersion: "1.1.0" as const,
    artifactType: "TASK_LOCAL_PROJECTION" as const,
    generatedAt: "2026-09-02T00:00:00.000Z",
    taskId: TASK_ID,
    coverageStatus: "PROJECTED" as const,
    failureReasonCode: null,
    contentHash: "",
    nodes: [
      { nodeId: TASK_NODE, nodeType: "TASK" as const, properties: {} },
      {
        nodeId: DATASET_NODE,
        nodeType: "PHYSICAL_DATASET" as const,
        properties: { platform: "hive", qualifiedName: "dm_rsk_n.otc_opt_greek_val_det_h" },
      },
      { nodeId: TARGET_WRITE_NODE, nodeType: "TARGET_WRITE" as const, properties: {} },
      { nodeId: FIELD_NODE, nodeType: "PHYSICAL_FIELD" as const, properties: { column: "inr_ord_id" } },
    ],
    edges: [
      {
        edgeId: readsEdgeId,
        edgeType: "READS" as const,
        fromNodeId: TASK_NODE,
        toNodeId: DATASET_NODE,
        properties: { readOccurrenceId: "occ:0" },
      },
      {
        edgeId: taskLocalEdgeId({
          edgeType: "WRITES",
          fromNodeId: TASK_NODE,
          toNodeId: TARGET_WRITE_NODE,
        }),
        edgeType: "WRITES" as const,
        fromNodeId: TASK_NODE,
        toNodeId: TARGET_WRITE_NODE,
        properties: {},
      },
      {
        edgeId: taskLocalEdgeId({
          edgeType: "FIELD_DIRECT",
          fromNodeId: FIELD_NODE,
          toNodeId: TARGET_WRITE_NODE,
          semanticKey: { outputColumn: "inr_ord_id" },
        }),
        edgeType: "FIELD_DIRECT" as const,
        fromNodeId: FIELD_NODE,
        toNodeId: TARGET_WRITE_NODE,
        properties: { subtype: "UNKNOWN" },
      },
    ],
    ...overrides,
  };
  return canonicalizeTaskLocalProjection(base);
}

function withContentHash(projection: Omit<TaskLocalProjection, "contentHash"> & { contentHash?: string }): TaskLocalProjection {
  const contentHash = taskLocalProjectionContentHash({ ...projection, contentHash: "" } as TaskLocalProjection);
  return { ...projection, contentHash } as TaskLocalProjection;
}

describe("task-local projection contract", () => {
  it("accepts a minimal projected artifact", () => {
    const projection = minimalProjected();
    expect(() => validateTaskLocalProjection(projection)).not.toThrow();
    expect(projection.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects cross-task data edges", () => {
    const foreignTask = taskNodeId("119044");
    const projection = minimalProjected();
    const bad = withContentHash({
      ...projection,
      nodes: [
        ...projection.nodes,
        {
          nodeId: foreignTask,
          nodeType: "PHYSICAL_FIELD",
          properties: { column: "foreign" },
        },
      ],
      edges: [
        ...projection.edges,
        {
          edgeId: taskLocalEdgeId({
            edgeType: "READS",
            fromNodeId: foreignTask,
            toNodeId: DATASET_NODE,
          }),
          edgeType: "READS",
          fromNodeId: foreignTask,
          toNodeId: DATASET_NODE,
          properties: {},
        },
      ],
    });
    expect(() => validateTaskLocalProjection(bad)).toThrow(
      "TASK_LOCAL_PROJECTION_CROSS_TASK_DATA_EDGE",
    );
  });

  it("rejects legacy affectedRootFields on edges", () => {
    const projection = minimalProjected();
    const bad = {
      ...projection,
      edges: projection.edges.map((edge, index) =>
        index === 0 ? { ...edge, properties: { ...edge.properties, affectedRootFields: ["x"] } } : edge,
      ),
    };
    expect(() => validateTaskLocalProjection(bad)).toThrow("TASK_LOCAL_EDGE_AFFECTED_ROOT_FIELDS_FORBIDDEN");
  });

  it("rejects rowsetControls on nodes", () => {
    const projection = minimalProjected();
    const bad = {
      ...projection,
      nodes: projection.nodes.map((node, index) =>
        index === 0 ? { ...node, properties: { rowsetControls: [] } } : node,
      ),
    };
    expect(() => validateTaskLocalProjection(bad)).toThrow("TASK_LOCAL_NODE_ROWSET_CONTROLS_FORBIDDEN");
  });

  it("requires DATASET_CONTROL to target TARGET_WRITE", () => {
    const projection = minimalProjected();
    const bad = withContentHash({
      ...projection,
      edges: [
        ...projection.edges,
        {
          edgeId: taskLocalEdgeId({
            edgeType: "DATASET_CONTROL",
            fromNodeId: FIELD_NODE,
            toNodeId: DATASET_NODE,
          }),
          edgeType: "DATASET_CONTROL",
          fromNodeId: FIELD_NODE,
          toNodeId: DATASET_NODE,
          properties: { subtype: "JOIN", grain: "EXPAND_RISK" },
        },
      ],
    });
    expect(() => validateTaskLocalProjection(bad)).toThrow(
      "TASK_LOCAL_PROJECTION_DATASET_CONTROL_TARGET_INVALID",
    );
  });

  it("allows SCHEDULE_ONLY with task node and no edges", () => {
    const projection = canonicalizeTaskLocalProjection({
      schemaVersion: "1.1.0",
      artifactType: "TASK_LOCAL_PROJECTION",
      generatedAt: "2026-09-02T00:00:00.000Z",
      taskId: TASK_ID,
      coverageStatus: "SCHEDULE_ONLY",
      failureReasonCode: null,
      nodes: [
        {
          nodeId: TASK_NODE,
          nodeType: "TASK",
          properties: {
            scheduleReference: {
              role: "SCHEDULE_REFERENCE_ONLY",
              topicName: "DM_RSK_N",
              taskName: null,
              upstreamTaskIds: ["119044"],
              downstreamTaskIds: [],
              source: "schedule-evidence-cache",
              observedAt: "2026-09-02T00:00:00.000Z",
            },
          },
        },
      ],
      edges: [],
    });
    expect(projection.coverageStatus).toBe("SCHEDULE_ONLY");
  });

  it("rejects scheduleReference task ids used as data-edge endpoints", () => {
    const foreignTask = "task:119044";
    expect(() =>
      canonicalizeTaskLocalProjection({
        schemaVersion: "1.1.0",
        artifactType: "TASK_LOCAL_PROJECTION",
        generatedAt: "2026-09-02T00:00:00.000Z",
        taskId: TASK_ID,
        coverageStatus: "PROJECTED",
        failureReasonCode: null,
        nodes: [
          {
            nodeId: TASK_NODE,
            nodeType: "TASK",
            properties: {
              scheduleReference: {
                role: "SCHEDULE_REFERENCE_ONLY",
                topicName: null,
                taskName: null,
                upstreamTaskIds: ["119044"],
                downstreamTaskIds: [],
                source: "schedule-evidence-cache",
                observedAt: null,
              },
            },
          },
          {
            nodeId: foreignTask,
            nodeType: "PHYSICAL_DATASET",
            properties: { qualifiedName: "spoof.table" },
          },
        ],
        edges: [
          {
            edgeId: "edge:bad",
            edgeType: "READS",
            fromNodeId: TASK_NODE,
            toNodeId: foreignTask,
            properties: {},
          },
        ],
      }),
    ).toThrow(/TASK_LOCAL_PROJECTION_(CROSS_TASK_DATA_EDGE|SCHEDULE_REFERENCE_ON_DATA_EDGE)/);
  });
});
