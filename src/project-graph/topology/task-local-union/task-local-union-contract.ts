import { canonicalJson, sha256 } from "../../../contracts/runtime.ts";
import {
  PROJECT_TOPOLOGY_PROJECTION_VERSION,
  PROJECT_TOPOLOGY_SCHEMA_VERSION,
  PROJECT_TOPOLOGY_SNAPSHOT_TYPE,
  compareText,
  projectKeySegment,
  sortedUnique,
  type ProjectTopologyCoverageStatus,
  type ProjectTopologySourceMode,
} from "../../contracts/project-topology-contract.ts";

/** WP-3 projection schema versions accepted by the TASK_LOCAL_UNION loader. */
export const TASK_LOCAL_UNION_SUPPORTED_PROJECTION_SCHEMAS = ["1.1.0"] as const;

export type TaskLocalUnionSupportedProjectionSchema =
  (typeof TASK_LOCAL_UNION_SUPPORTED_PROJECTION_SCHEMAS)[number];

export type TaskLocalUnionCoverageStatus =
  "PROJECTED" | "SCHEDULE_ONLY" | "COLLECTION_FAILED";

export interface TaskLocalUnionTaskSource {
  readonly taskId: string;
  readonly contentHash: string;
  readonly packContentHash: string;
  readonly factsManifestSha256: string;
  readonly coverageStatus: TaskLocalUnionCoverageStatus;
  readonly failureReasonCode: string | null;
}

export interface TaskLocalUnionProducerIndexRef {
  readonly contentHash: string;
  readonly inputFingerprint: string;
}

export interface TaskLocalUnionBatchManifestRef {
  readonly path: string;
  readonly contentHash: string;
}

/**
 * Mode-gated snapshot body for TASK_LOCAL_UNION.
 * No rootTaskIds — union graphs have no root semantics.
 */
export interface TaskLocalUnionSnapshotV1 {
  readonly schemaVersion: typeof PROJECT_TOPOLOGY_SCHEMA_VERSION;
  readonly artifactType: typeof PROJECT_TOPOLOGY_SNAPSHOT_TYPE;
  readonly projectionVersion: typeof PROJECT_TOPOLOGY_PROJECTION_VERSION;
  readonly snapshotId: string;
  readonly projectKey: string;
  readonly sourceMode: "TASK_LOCAL_UNION";
  readonly taskSources: readonly TaskLocalUnionTaskSource[];
  readonly producerIndex: TaskLocalUnionProducerIndexRef;
  readonly batchManifestRef: TaskLocalUnionBatchManifestRef;
  readonly coverageStatus: ProjectTopologyCoverageStatus;
  readonly contentHash: string;
}

export interface TaskLocalProjectionEnvelopeCacheKeyParts {
  readonly taskId: string;
  readonly packContentHash: string;
  readonly factsManifestSha256: string;
  readonly schemaVersion: string;
}

export interface TaskLocalProjectionBody {
  readonly schemaVersion: string;
  readonly artifactType: "TASK_LOCAL_PROJECTION";
  readonly generatedAt?: string;
  readonly taskId: string;
  readonly coverageStatus: TaskLocalUnionCoverageStatus;
  readonly failureReasonCode: string | null;
  readonly contentHash: string;
  readonly nodes: readonly unknown[];
  readonly edges: readonly unknown[];
}

export interface TaskLocalProjectionEnvelope {
  readonly cacheKey: string;
  readonly cacheKeyParts: TaskLocalProjectionEnvelopeCacheKeyParts;
  readonly projectionContentHash: string;
  readonly projection: TaskLocalProjectionBody;
}

export interface UnpackedTaskLocalProjection {
  readonly envelope: TaskLocalProjectionEnvelope;
  readonly projection: TaskLocalProjectionBody;
  readonly taskSource: TaskLocalUnionTaskSource;
}

const SHA256 = /^[a-f0-9]{64}$/i;
const COVERAGE = new Set<TaskLocalUnionCoverageStatus>([
  "PROJECTED",
  "SCHEDULE_ONLY",
  "COLLECTION_FAILED",
]);

export function isSupportedTaskLocalProjectionSchema(
  schemaVersion: string,
): schemaVersion is TaskLocalUnionSupportedProjectionSchema {
  return (
    TASK_LOCAL_UNION_SUPPORTED_PROJECTION_SCHEMAS as readonly string[]
  ).includes(schemaVersion);
}

/**
 * Reject mixing topology source modes in one snapshot / build.
 * Legacy and union never share a snapshot.
 */
export function assertExclusiveSourceModes(
  modes: readonly ProjectTopologySourceMode[],
): void {
  const unique = new Set(modes);
  if (unique.size !== 1) {
    throw new Error("PROJECT_TOPOLOGY_SOURCE_MODE_MIXED");
  }
}

export function taskLocalUnionSnapshotId(input: {
  readonly projectKey: string;
  readonly taskSources: readonly TaskLocalUnionTaskSource[];
  readonly producerIndex: TaskLocalUnionProducerIndexRef;
  readonly batchManifestRef: TaskLocalUnionBatchManifestRef;
}): string {
  projectKeySegment(input.projectKey);
  const contentHash = sha256(
    canonicalJson({
      projectKey: input.projectKey,
      projectionVersion: PROJECT_TOPOLOGY_PROJECTION_VERSION,
      sourceMode: "TASK_LOCAL_UNION",
      taskSources: [...input.taskSources]
        .sort((left, right) => compareText(left.taskId, right.taskId))
        .map((source) => ({
          taskId: source.taskId,
          contentHash: source.contentHash,
          packContentHash: source.packContentHash,
          factsManifestSha256: source.factsManifestSha256,
          coverageStatus: source.coverageStatus,
          failureReasonCode: source.failureReasonCode,
        })),
      producerIndex: input.producerIndex,
      batchManifestContentHash: input.batchManifestRef.contentHash,
    }),
  );
  return `project-snapshot-${contentHash}`;
}

export function taskLocalUnionSnapshotContentHash(
  snapshot: Omit<TaskLocalUnionSnapshotV1, "contentHash">,
): string {
  return sha256(canonicalJson(snapshot));
}

/**
 * Unpack a WP-3 disk envelope and enforce triple contentHash agreement:
 * projectionContentHash === projection.contentHash === manifest.tasks[].contentHash
 */
export function unpackTaskLocalProjectionEnvelope(input: {
  readonly envelope: unknown;
  readonly manifestTaskContentHash: string;
}): UnpackedTaskLocalProjection {
  const envelope = parseEnvelope(input.envelope);
  const { projection } = envelope;

  if (!isSupportedTaskLocalProjectionSchema(projection.schemaVersion)) {
    throw new Error(
      `TASK_LOCAL_PROJECTION_SCHEMA_UNSUPPORTED:${projection.schemaVersion}`,
    );
  }
  if (projection.artifactType !== "TASK_LOCAL_PROJECTION") {
    throw new Error("TASK_LOCAL_PROJECTION_ARTIFACT_TYPE_INVALID");
  }
  if (
    !SHA256.test(envelope.projectionContentHash) ||
    !SHA256.test(projection.contentHash) ||
    !SHA256.test(input.manifestTaskContentHash)
  ) {
    throw new Error("TASK_LOCAL_ENVELOPE_HASH_FORMAT_INVALID");
  }
  if (
    envelope.projectionContentHash !== projection.contentHash ||
    envelope.projectionContentHash !== input.manifestTaskContentHash
  ) {
    throw new Error("TASK_LOCAL_ENVELOPE_HASH_MISMATCH");
  }
  if (envelope.cacheKeyParts.taskId !== projection.taskId) {
    throw new Error("TASK_LOCAL_ENVELOPE_TASK_ID_MISMATCH");
  }
  if (!COVERAGE.has(projection.coverageStatus)) {
    throw new Error("TASK_LOCAL_PROJECTION_COVERAGE_INVALID");
  }

  const taskSource: TaskLocalUnionTaskSource = {
    taskId: projection.taskId,
    contentHash: projection.contentHash,
    packContentHash: envelope.cacheKeyParts.packContentHash,
    factsManifestSha256: envelope.cacheKeyParts.factsManifestSha256,
    coverageStatus: projection.coverageStatus,
    failureReasonCode: projection.failureReasonCode,
  };

  return { envelope, projection, taskSource };
}

export function validateTaskLocalUnionSnapshot(
  snapshot: TaskLocalUnionSnapshotV1,
): void {
  if (
    snapshot.schemaVersion !== PROJECT_TOPOLOGY_SCHEMA_VERSION ||
    snapshot.artifactType !== PROJECT_TOPOLOGY_SNAPSHOT_TYPE ||
    snapshot.projectionVersion !== PROJECT_TOPOLOGY_PROJECTION_VERSION
  ) {
    throw new Error("TASK_LOCAL_UNION_SNAPSHOT_CONTRACT_INVALID");
  }
  if (snapshot.sourceMode !== "TASK_LOCAL_UNION") {
    throw new Error("TASK_LOCAL_UNION_SOURCE_MODE_INVALID");
  }
  assertExclusiveSourceModes([snapshot.sourceMode]);
  projectKeySegment(snapshot.projectKey);

  if (snapshot.taskSources.length === 0) {
    throw new Error("TASK_LOCAL_UNION_TASK_SOURCES_EMPTY");
  }
  const taskIds = snapshot.taskSources.map((source) => source.taskId);
  if (JSON.stringify(taskIds) !== JSON.stringify(sortedUnique(taskIds))) {
    throw new Error("TASK_LOCAL_UNION_TASK_SOURCES_ORDER_OR_DUPLICATE");
  }
  for (const source of snapshot.taskSources) {
    if (!source.taskId.trim()) {
      throw new Error("TASK_LOCAL_UNION_TASK_ID_INVALID");
    }
    if (!SHA256.test(source.contentHash)) {
      throw new Error(`TASK_LOCAL_UNION_TASK_HASH_INVALID:${source.taskId}`);
    }
    if (!COVERAGE.has(source.coverageStatus)) {
      throw new Error(`TASK_LOCAL_UNION_COVERAGE_INVALID:${source.taskId}`);
    }
  }

  if (
    !SHA256.test(snapshot.producerIndex.contentHash) ||
    !snapshot.producerIndex.inputFingerprint.trim()
  ) {
    throw new Error("TASK_LOCAL_UNION_PRODUCER_INDEX_INVALID");
  }
  if (
    !snapshot.batchManifestRef.path.trim() ||
    !SHA256.test(snapshot.batchManifestRef.contentHash)
  ) {
    throw new Error("TASK_LOCAL_UNION_BATCH_MANIFEST_REF_INVALID");
  }

  if (
    taskLocalUnionSnapshotId({
      projectKey: snapshot.projectKey,
      taskSources: snapshot.taskSources,
      producerIndex: snapshot.producerIndex,
      batchManifestRef: snapshot.batchManifestRef,
    }) !== snapshot.snapshotId
  ) {
    throw new Error("TASK_LOCAL_UNION_SNAPSHOT_ID_INVALID");
  }

  const { contentHash: _contentHash, ...body } = snapshot;
  if (taskLocalUnionSnapshotContentHash(body) !== snapshot.contentHash) {
    throw new Error("TASK_LOCAL_UNION_SNAPSHOT_HASH_INVALID");
  }
}

function parseEnvelope(value: unknown): TaskLocalProjectionEnvelope {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("TASK_LOCAL_ENVELOPE_INVALID");
  }
  const record = value as Record<string, unknown>;
  const cacheKey = text(record.cacheKey);
  const projectionContentHash = text(record.projectionContentHash);
  const cacheKeyPartsRaw = record.cacheKeyParts;
  const projectionRaw = record.projection;
  if (
    !cacheKey ||
    !projectionContentHash ||
    typeof cacheKeyPartsRaw !== "object" ||
    cacheKeyPartsRaw === null ||
    Array.isArray(cacheKeyPartsRaw) ||
    typeof projectionRaw !== "object" ||
    projectionRaw === null ||
    Array.isArray(projectionRaw)
  ) {
    throw new Error("TASK_LOCAL_ENVELOPE_INVALID");
  }
  const parts = cacheKeyPartsRaw as Record<string, unknown>;
  const projection = projectionRaw as Record<string, unknown>;
  const taskId = text(parts.taskId);
  const packContentHash = text(parts.packContentHash);
  const factsManifestSha256 = text(parts.factsManifestSha256);
  const partsSchema = text(parts.schemaVersion);
  const schemaVersion = text(projection.schemaVersion);
  const artifactType = text(projection.artifactType);
  const projectionTaskId = text(projection.taskId);
  const coverageStatus = text(projection.coverageStatus);
  const contentHash = text(projection.contentHash);
  if (
    !taskId ||
    !packContentHash ||
    !factsManifestSha256 ||
    !partsSchema ||
    !schemaVersion ||
    artifactType !== "TASK_LOCAL_PROJECTION" ||
    !projectionTaskId ||
    !coverageStatus ||
    !contentHash ||
    !Array.isArray(projection.nodes) ||
    !Array.isArray(projection.edges)
  ) {
    throw new Error("TASK_LOCAL_ENVELOPE_INVALID");
  }
  const failureReasonCode =
    projection.failureReasonCode === null ||
    projection.failureReasonCode === undefined
      ? null
      : text(projection.failureReasonCode);

  return {
    cacheKey,
    cacheKeyParts: {
      taskId,
      packContentHash,
      factsManifestSha256,
      schemaVersion: partsSchema,
    },
    projectionContentHash,
    projection: {
      schemaVersion,
      artifactType: "TASK_LOCAL_PROJECTION",
      ...(typeof projection.generatedAt === "string"
        ? { generatedAt: projection.generatedAt }
        : {}),
      taskId: projectionTaskId,
      coverageStatus: coverageStatus as TaskLocalUnionCoverageStatus,
      failureReasonCode,
      contentHash,
      nodes: projection.nodes,
      edges: projection.edges,
    },
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
