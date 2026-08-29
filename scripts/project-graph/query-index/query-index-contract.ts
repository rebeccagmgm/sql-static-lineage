import {
  canonicalJson,
  sha256,
} from "../../machine-facts/machine-facts-contract.ts";
import { compareText } from "../contracts/project-topology-contract.ts";

export const QUERY_INDEX_SCHEMA_VERSION = "1.1.0" as const;
export const QUERY_INDEX_ALGORITHM_VERSION = "1.1.0" as const;
export const QUERY_INDEX_LEGACY_SCHEMA_VERSION = "1.0.0" as const;
export const QUERY_INDEX_LEGACY_ALGORITHM_VERSION = "1.0.0" as const;
export const QUERY_INDEX_MANIFEST_TYPE =
  "PROJECT_GRAPH_QUERY_INDEX_MANIFEST" as const;
export const QUERY_INDEX_PARITY_REPORT_TYPE =
  "PROJECT_GRAPH_QUERY_INDEX_PARITY_REPORT" as const;

export type QueryIndexProjectionKind =
  | "PROJECT_TOPOLOGY"
  | "FIELD_EVIDENCE"
  | "TARGET_CAUSAL_OVERLAY";
export type QueryIndexRecordType = "NODE" | "EDGE";
export type QueryIndexBuildState = "STAGING" | "READY" | "FAILED";
export type QueryIndexActivationState = "NOT_CURRENT" | "CURRENT";
export type QueryIndexBuildOutcome = "CREATED" | "REUSED" | "FAILED";

export interface QueryIndexSourceFileIdentity {
  readonly fileName: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly recordCount: number | null;
}

export interface QueryIndexSourceFileSet {
  readonly manifest: QueryIndexSourceFileIdentity;
  readonly snapshot: QueryIndexSourceFileIdentity;
  readonly nodes: QueryIndexSourceFileIdentity;
  readonly edges: QueryIndexSourceFileIdentity;
}

export interface QueryIndexProjectionSourceIdentity {
  readonly projectionKind: QueryIndexProjectionKind;
  readonly schemaVersion: string;
  readonly projectionVersion: string;
  readonly snapshotId: string;
  readonly snapshotContentHash: string;
  readonly manifestContentHash: string;
  readonly counts: {
    readonly nodes: number;
    readonly edges: number;
    readonly boundaries: number;
  };
  readonly files: QueryIndexSourceFileSet;
}

export interface QueryIndexTopologySourceIdentity extends QueryIndexProjectionSourceIdentity {
  readonly projectionKind: "PROJECT_TOPOLOGY";
}

export interface QueryIndexFieldSourceIdentity extends QueryIndexProjectionSourceIdentity {
  readonly projectionKind: "FIELD_EVIDENCE";
}

export interface QueryIndexTargetCausalSourceIdentity extends QueryIndexProjectionSourceIdentity {
  readonly projectionKind: "TARGET_CAUSAL_OVERLAY";
}

/**
 * Canonical source identity. Runtime paths and database connection details are
 * deliberately absent so the same immutable bytes derive the same build ID on
 * every machine.
 */
export interface QueryIndexSourceDescriptorV1 {
  readonly schemaVersion:
    | typeof QUERY_INDEX_SCHEMA_VERSION
    | typeof QUERY_INDEX_LEGACY_SCHEMA_VERSION;
  readonly algorithmVersion:
    | typeof QUERY_INDEX_ALGORITHM_VERSION
    | typeof QUERY_INDEX_LEGACY_ALGORITHM_VERSION;
  readonly projectKey: string;
  readonly topology: QueryIndexTopologySourceIdentity;
  readonly fieldEvidence: readonly QueryIndexFieldSourceIdentity[];
  /** Absent only on immutable Phase 3 descriptors published before Phase 4. */
  readonly targetCausalOverlays?: readonly QueryIndexTargetCausalSourceIdentity[];
}

export interface QueryIndexProjectionRecordKey {
  readonly indexBuildId: string;
  readonly projectionKind: QueryIndexProjectionKind;
  readonly projectionSnapshotId: string;
  readonly recordType: QueryIndexRecordType;
  readonly canonicalRecordId: string;
}

export interface QueryIndexNodeRecordKey extends QueryIndexProjectionRecordKey {
  readonly recordType: "NODE";
}

export interface QueryIndexEdgeRecordKey extends QueryIndexProjectionRecordKey {
  readonly recordType: "EDGE";
}

export interface QueryIndexProjectionCounts {
  readonly nodes: number;
  readonly edges: number;
  readonly boundaries: number;
}

export interface QueryIndexParityCaseResultV1 {
  readonly caseId: string;
  readonly query:
    | "get_project_topology"
    | "trace_project_upstream"
    | "explain_topology_edge"
      | "get_field_evidence"
      | "trace_field_value_path"
      | "explain_field_evidence_record"
      | "get_target_causal_overlay"
      | "get_target_causal_task_rollup"
      | "explain_target_causal_assessment";
  readonly required: boolean;
  readonly status: "PASSED" | "FAILED";
  readonly referenceResultHash: string;
  readonly indexedResultHash: string;
  readonly difference: QueryIndexBoundedDifference | null;
}

export interface QueryIndexBoundedDifference {
  readonly path: string;
  readonly kind: "MISSING" | "EXTRA" | "VALUE" | "TYPE" | "LIMIT";
  readonly referenceSummary: string;
  readonly indexedSummary: string;
}

export interface QueryIndexParityReportV1 {
  readonly schemaVersion: typeof QUERY_INDEX_SCHEMA_VERSION;
  readonly artifactType: typeof QUERY_INDEX_PARITY_REPORT_TYPE;
  readonly algorithmVersion: typeof QUERY_INDEX_ALGORITHM_VERSION;
  readonly indexBuildId: string;
  readonly sourceDescriptorHash: string;
  readonly status: "PASSED" | "FAILED";
  readonly cases: readonly QueryIndexParityCaseResultV1[];
  readonly contentHash: string;
}

export interface QueryIndexAuditManifestV1 {
  readonly schemaVersion: typeof QUERY_INDEX_SCHEMA_VERSION;
  readonly artifactType: typeof QUERY_INDEX_MANIFEST_TYPE;
  readonly algorithmVersion: typeof QUERY_INDEX_ALGORITHM_VERSION;
  readonly indexBuildId: string;
  readonly projectKey: string;
  readonly sourceDescriptorHash: string;
  readonly sourceDescriptor: QueryIndexSourceDescriptorV1;
  readonly sourceCounts: {
    readonly topology: QueryIndexProjectionCounts;
    readonly fieldEvidence: readonly {
      readonly snapshotId: string;
      readonly counts: QueryIndexProjectionCounts;
    }[];
    readonly targetCausalOverlays: readonly {
      readonly snapshotId: string;
      readonly counts: QueryIndexProjectionCounts;
    }[];
  };
  readonly indexedCounts: {
    readonly nodes: number;
    readonly edges: number;
    readonly projections: number;
  };
  readonly publication: {
    readonly buildState: QueryIndexBuildState;
    readonly activationState: QueryIndexActivationState;
    readonly outcome: QueryIndexBuildOutcome;
    readonly previousCurrentBuildId: string | null;
  };
  readonly parityReportContentHash: string;
  readonly contentHash: string;
}

export type QueryIndexAvailabilityCode =
  | "QUERY_INDEX_UNAVAILABLE"
  | "QUERY_INDEX_STALE"
  | "QUERY_INDEX_FIELD_SNAPSHOT_UNAVAILABLE"
  | "QUERY_INDEX_CAUSAL_SNAPSHOT_UNAVAILABLE";

export type QueryIndexAvailabilityReason =
  | "CURRENT_POINTER_MISSING"
  | "BUILD_MISSING"
  | "BUILD_STAGING"
  | "BUILD_FAILED"
  | "BUILD_NOT_CURRENT"
  | "SOURCE_DESCRIPTOR_MISMATCH"
  | "FIELD_SNAPSHOT_MISSING"
  | "CAUSAL_SNAPSHOT_MISSING";

export class QueryIndexAvailabilityError extends Error {
  readonly code: QueryIndexAvailabilityCode;
  readonly reason: QueryIndexAvailabilityReason;
  readonly projectKey: string;
  readonly expectedSourceDescriptorHash: string | null;
  readonly actualIndexBuildId: string | null;

  constructor(input: {
    readonly code: QueryIndexAvailabilityCode;
    readonly reason: QueryIndexAvailabilityReason;
    readonly projectKey: string;
    readonly expectedSourceDescriptorHash?: string | null;
    readonly actualIndexBuildId?: string | null;
  }) {
    super(`${input.code}:${input.reason}:${input.projectKey}`);
    this.name = "QueryIndexAvailabilityError";
    this.code = input.code;
    this.reason = input.reason;
    this.projectKey = input.projectKey;
    this.expectedSourceDescriptorHash =
      input.expectedSourceDescriptorHash ?? null;
    this.actualIndexBuildId = input.actualIndexBuildId ?? null;
  }
}

export function queryIndexSourceDescriptorHash(
  descriptor: QueryIndexSourceDescriptorV1,
): string {
  validateQueryIndexSourceDescriptor(descriptor);
  return sha256(canonicalJson(descriptor));
}

export function queryIndexBuildId(
  descriptor: QueryIndexSourceDescriptorV1,
): string {
  return queryIndexSourceDescriptorHash(descriptor);
}

export function queryIndexProjectionRecordKeyHash(
  key: QueryIndexProjectionRecordKey,
): string {
  return sha256(canonicalJson(key));
}

export function queryIndexParityReportContentHash(
  report: Omit<QueryIndexParityReportV1, "contentHash">,
): string {
  return sha256(canonicalJson(report));
}

export function queryIndexAuditManifestContentHash(
  manifest: Omit<QueryIndexAuditManifestV1, "contentHash">,
): string {
  return sha256(canonicalJson(manifest));
}

export function validateQueryIndexSourceDescriptor(
  descriptor: QueryIndexSourceDescriptorV1,
): void {
  const current =
    descriptor.schemaVersion === QUERY_INDEX_SCHEMA_VERSION &&
    descriptor.algorithmVersion === QUERY_INDEX_ALGORITHM_VERSION;
  const legacy =
    descriptor.schemaVersion === QUERY_INDEX_LEGACY_SCHEMA_VERSION &&
    descriptor.algorithmVersion === QUERY_INDEX_LEGACY_ALGORITHM_VERSION;
  if (!current && !legacy)
    throw new Error("QUERY_INDEX_SOURCE_DESCRIPTOR_CONTRACT_INVALID");
  if (descriptor.projectKey.trim() !== descriptor.projectKey)
    throw new Error("QUERY_INDEX_PROJECT_KEY_INVALID");
  if (
    descriptor.projectKey.length === 0 ||
    descriptor.topology.projectionKind !== "PROJECT_TOPOLOGY"
  )
    throw new Error("QUERY_INDEX_TOPOLOGY_SOURCE_INVALID");
  validateProjectionSource(descriptor.topology);
  const sorted = [...descriptor.fieldEvidence].sort(compareProjectionSource);
  if (canonicalJson(sorted) !== canonicalJson(descriptor.fieldEvidence))
    throw new Error("QUERY_INDEX_FIELD_SOURCE_ORDER_INVALID");
  const snapshots = new Set<string>();
  for (const field of descriptor.fieldEvidence) {
    if (field.projectionKind !== "FIELD_EVIDENCE")
      throw new Error("QUERY_INDEX_FIELD_SOURCE_INVALID");
    validateProjectionSource(field);
    if (snapshots.has(field.snapshotId))
      throw new Error(`QUERY_INDEX_FIELD_SOURCE_DUPLICATE:${field.snapshotId}`);
    snapshots.add(field.snapshotId);
  }
  const causalSources = descriptor.targetCausalOverlays ?? [];
  const sortedCausal = [...causalSources].sort(
    compareProjectionSource,
  );
  if (canonicalJson(sortedCausal) !== canonicalJson(causalSources))
    throw new Error("QUERY_INDEX_CAUSAL_SOURCE_ORDER_INVALID");
  if (legacy && causalSources.length > 0)
    throw new Error("QUERY_INDEX_LEGACY_CAUSAL_SOURCE_INVALID");
  for (const causal of causalSources) {
    if (causal.projectionKind !== "TARGET_CAUSAL_OVERLAY")
      throw new Error("QUERY_INDEX_CAUSAL_SOURCE_INVALID");
    validateProjectionSource(causal);
    if (snapshots.has(causal.snapshotId))
      throw new Error(`QUERY_INDEX_CAUSAL_SOURCE_DUPLICATE:${causal.snapshotId}`);
    snapshots.add(causal.snapshotId);
  }
}

export function compareProjectionSource(
  left: QueryIndexProjectionSourceIdentity,
  right: QueryIndexProjectionSourceIdentity,
): number {
  return (
    compareText(left.snapshotId, right.snapshotId) ||
    compareText(left.manifestContentHash, right.manifestContentHash) ||
    compareText(left.files.manifest.sha256, right.files.manifest.sha256)
  );
}

function validateProjectionSource(
  source: QueryIndexProjectionSourceIdentity,
): void {
  if (
    source.snapshotId.length === 0 ||
    source.schemaVersion.length === 0 ||
    source.projectionVersion.length === 0 ||
    !isSha256(source.snapshotContentHash) ||
    !isSha256(source.manifestContentHash)
  )
    throw new Error("QUERY_INDEX_PROJECTION_SOURCE_INVALID");
  if (
    !Number.isSafeInteger(source.counts.nodes) ||
    !Number.isSafeInteger(source.counts.edges) ||
    !Number.isSafeInteger(source.counts.boundaries) ||
    source.counts.nodes < 0 ||
    source.counts.edges < 0 ||
    source.counts.boundaries < 0
  )
    throw new Error("QUERY_INDEX_SOURCE_COUNTS_INVALID");
  for (const file of Object.values(source.files)) validateFileIdentity(file);
  if (
    source.files.manifest.recordCount !== null ||
    source.files.snapshot.recordCount !== null ||
    source.files.nodes.recordCount !== source.counts.nodes ||
    source.files.edges.recordCount !== source.counts.edges
  )
    throw new Error("QUERY_INDEX_SOURCE_FILE_COUNTS_INVALID");
}

function validateFileIdentity(file: QueryIndexSourceFileIdentity): void {
  if (
    file.fileName.length === 0 ||
    file.fileName.includes("/") ||
    file.fileName.includes("\\") ||
    !isSha256(file.sha256) ||
    !Number.isSafeInteger(file.byteLength) ||
    file.byteLength < 0 ||
    (file.recordCount !== null &&
      (!Number.isSafeInteger(file.recordCount) || file.recordCount < 0))
  )
    throw new Error("QUERY_INDEX_SOURCE_FILE_IDENTITY_INVALID");
}

function isSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/u.test(value);
}
