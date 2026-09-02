import { canonicalJson, sha256 } from "../../machine-facts/machine-facts-contract.ts";

export const TASK_LOCAL_PROJECTION_SCHEMA_VERSION = "1.1.0" as const;
export const TASK_LOCAL_PROJECTION_ARTIFACT_TYPE = "TASK_LOCAL_PROJECTION" as const;

export type TaskLocalCoverageStatus =
  | "PROJECTED"
  | "SCHEDULE_ONLY"
  | "COLLECTION_FAILED";

export type TaskLocalFailureReasonCode =
  | "FACTS_UNAVAILABLE"
  | "FACTS_STALE"
  | "FACTS_INVALID"
  | "NO_RESOLVED_WRITE"
  | "SCHEMA_UNRESOLVED"
  | "PROJECTION_FAILED";

export interface TaskLocalBatchSummary {
  readonly total: number;
  readonly projected: number;
  readonly scheduleOnly: number;
  readonly collectionFailed: number;
  readonly byFailureReason: Readonly<Partial<Record<TaskLocalFailureReasonCode, number>>>;
}

export function summarizeTaskLocalBatch(
  projections: readonly TaskLocalProjection[],
): TaskLocalBatchSummary {
  const byFailureReason: Partial<Record<TaskLocalFailureReasonCode, number>> = {};
  let projected = 0;
  let scheduleOnly = 0;
  let collectionFailed = 0;
  for (const projection of projections) {
    if (projection.coverageStatus === "PROJECTED") projected += 1;
    else if (projection.coverageStatus === "SCHEDULE_ONLY") scheduleOnly += 1;
    else {
      collectionFailed += 1;
      const reason = projection.failureReasonCode as TaskLocalFailureReasonCode | null;
      if (reason) byFailureReason[reason] = (byFailureReason[reason] ?? 0) + 1;
    }
  }
  return {
    total: projections.length,
    projected,
    scheduleOnly,
    collectionFailed,
    byFailureReason,
  };
}

export type TaskLocalNodeType =
  | "TASK"
  | "PHYSICAL_DATASET"
  | "PHYSICAL_FIELD"
  | "TARGET_WRITE";

export type TaskLocalEdgeType =
  | "READS"
  | "WRITES"
  | "FIELD_DIRECT"
  | "FIELD_CONDITIONAL"
  | "DATASET_CONTROL";

export type TaskLocalDirectSubtype = "UNKNOWN" | "IDENTITY" | "TRANSFORMATION" | "AGGREGATION";

export type TaskLocalControlSubtype =
  | "JOIN"
  | "FILTER"
  | "GROUP_BY"
  | "SORT"
  | "WINDOW"
  | "CONDITIONAL";

export type TaskLocalGrain = "REDUCE" | "PRESERVE" | "EXPAND_RISK";

export interface TaskLocalNode {
  readonly nodeId: string;
  readonly nodeType: TaskLocalNodeType;
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface TaskLocalEdge {
  readonly edgeId: string;
  readonly edgeType: TaskLocalEdgeType;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface TaskLocalProjection {
  readonly schemaVersion: typeof TASK_LOCAL_PROJECTION_SCHEMA_VERSION;
  readonly artifactType: typeof TASK_LOCAL_PROJECTION_ARTIFACT_TYPE;
  readonly generatedAt: string;
  readonly taskId: string;
  readonly coverageStatus: TaskLocalCoverageStatus;
  readonly failureReasonCode: string | null;
  readonly contentHash: string;
  readonly nodes: readonly TaskLocalNode[];
  readonly edges: readonly TaskLocalEdge[];
}

const DATA_EDGE_TYPES = new Set<TaskLocalEdgeType>([
  "READS",
  "WRITES",
  "FIELD_DIRECT",
  "FIELD_CONDITIONAL",
  "DATASET_CONTROL",
]);

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function taskIdFromNodeId(nodeId: string): string | null {
  return nodeId.startsWith("task:") ? nodeId.slice("task:".length) : null;
}

function assertNoLegacyControlFields(value: Record<string, unknown>, label: string): void {
  if ("affectedRootFields" in value) {
    throw new Error(`${label}_AFFECTED_ROOT_FIELDS_FORBIDDEN`);
  }
  if ("rowsetControls" in value) {
    throw new Error(`${label}_ROWSET_CONTROLS_FORBIDDEN`);
  }
}

export function taskLocalProjectionContentHash(
  projection: TaskLocalProjection,
): string {
  const { generatedAt: _generatedAt, contentHash: _contentHash, ...rest } = projection;
  return sha256(canonicalJson(rest));
}

function scheduleReferenceTaskIds(properties: Readonly<Record<string, unknown>>): string[] {
  const reference = properties.scheduleReference;
  if (typeof reference !== "object" || reference === null || Array.isArray(reference)) {
    return [];
  }
  const record = reference as Record<string, unknown>;
  const ids: string[] = [];
  for (const key of ["upstreamTaskIds", "downstreamTaskIds"] as const) {
    const values = record[key];
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      if (typeof value === "string" && value.trim()) ids.push(value.trim());
    }
  }
  return ids;
}

export function validateTaskLocalProjection(projection: TaskLocalProjection): void {
  if (
    projection.schemaVersion !== TASK_LOCAL_PROJECTION_SCHEMA_VERSION
    || projection.artifactType !== TASK_LOCAL_PROJECTION_ARTIFACT_TYPE
  ) {
    throw new Error("TASK_LOCAL_PROJECTION_CONTRACT_INVALID");
  }
  if (!text(projection.taskId)) throw new Error("TASK_LOCAL_PROJECTION_TASK_ID_INVALID");

  const nodeIds = new Set<string>();
  let taskNodeCount = 0;
  const scheduleNeighborIds = new Set<string>();
  for (const node of projection.nodes) {
    if (nodeIds.has(node.nodeId)) throw new Error("TASK_LOCAL_PROJECTION_NODE_DUPLICATE");
    nodeIds.add(node.nodeId);
    assertNoLegacyControlFields(node.properties, "TASK_LOCAL_NODE");
    if (node.nodeType === "TASK") {
      taskNodeCount += 1;
      if (taskIdFromNodeId(node.nodeId) !== projection.taskId) {
        throw new Error("TASK_LOCAL_PROJECTION_TASK_NODE_MISMATCH");
      }
      for (const neighborId of scheduleReferenceTaskIds(node.properties)) {
        scheduleNeighborIds.add(neighborId);
      }
    }
  }
  if (taskNodeCount !== 1) throw new Error("TASK_LOCAL_PROJECTION_TASK_NODE_COUNT_INVALID");

  const edgeIds = new Set<string>();
  for (const edge of projection.edges) {
    if (edgeIds.has(edge.edgeId)) throw new Error("TASK_LOCAL_PROJECTION_EDGE_DUPLICATE");
    edgeIds.add(edge.edgeId);
    assertNoLegacyControlFields(edge.properties, "TASK_LOCAL_EDGE");
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      throw new Error("TASK_LOCAL_PROJECTION_EDGE_ENDPOINT_MISSING");
    }
    if (!DATA_EDGE_TYPES.has(edge.edgeType)) {
      throw new Error("TASK_LOCAL_PROJECTION_EDGE_TYPE_INVALID");
    }
    for (const endpoint of [edge.fromNodeId, edge.toNodeId]) {
      const foreignTaskId = taskIdFromNodeId(endpoint);
      if (foreignTaskId !== null && foreignTaskId !== projection.taskId) {
        throw new Error("TASK_LOCAL_PROJECTION_CROSS_TASK_DATA_EDGE");
      }
      if (foreignTaskId !== null && scheduleNeighborIds.has(foreignTaskId)) {
        throw new Error("TASK_LOCAL_PROJECTION_SCHEDULE_REFERENCE_ON_DATA_EDGE");
      }
    }
    if (edge.edgeType === "DATASET_CONTROL") {
      const toType = projection.nodes.find((node) => node.nodeId === edge.toNodeId)?.nodeType;
      if (toType !== "TARGET_WRITE") {
        throw new Error("TASK_LOCAL_PROJECTION_DATASET_CONTROL_TARGET_INVALID");
      }
    }
  }

  if (projection.coverageStatus === "SCHEDULE_ONLY" && projection.edges.length > 0) {
    throw new Error("TASK_LOCAL_PROJECTION_SCHEDULE_ONLY_HAS_EDGES");
  }
  if (projection.coverageStatus === "COLLECTION_FAILED" && !text(projection.failureReasonCode)) {
    throw new Error("TASK_LOCAL_PROJECTION_FAILURE_REASON_REQUIRED");
  }

  const expectedHash = taskLocalProjectionContentHash(projection);
  if (expectedHash !== projection.contentHash) {
    throw new Error("TASK_LOCAL_PROJECTION_CONTENT_HASH_INVALID");
  }
}

export function canonicalizeTaskLocalProjection(
  input: Omit<TaskLocalProjection, "contentHash"> & { readonly contentHash?: string },
): TaskLocalProjection {
  const body = {
    schemaVersion: TASK_LOCAL_PROJECTION_SCHEMA_VERSION,
    artifactType: TASK_LOCAL_PROJECTION_ARTIFACT_TYPE,
    generatedAt: input.generatedAt,
    taskId: input.taskId,
    coverageStatus: input.coverageStatus,
    failureReasonCode: input.failureReasonCode,
    nodes: [...input.nodes].sort((left, right) => left.nodeId.localeCompare(right.nodeId)),
    edges: [...input.edges].sort((left, right) => left.edgeId.localeCompare(right.edgeId)),
  };
  const contentHash = text(input.contentHash) ?? taskLocalProjectionContentHash({
    ...body,
    contentHash: "",
  });
  const projection = { ...body, contentHash };
  validateTaskLocalProjection(projection);
  return projection;
}
