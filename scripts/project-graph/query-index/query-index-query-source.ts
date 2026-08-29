import { sha256 } from "../../machine-facts/machine-facts-contract.ts";
import {
  validateProjectTopologyProjection,
  type ProjectTopologyEdgeRecord,
  type ProjectTopologyNodeRecord,
  type ProjectTopologyProjectionV1,
  type ProjectTopologySnapshotV1,
} from "../contracts/project-topology-contract.ts";
import {
  validateFieldEvidenceProjection,
  type FieldEvidenceEdgeRecord,
  type FieldEvidenceNodeRecord,
  type FieldEvidenceProjectionV1,
  type FieldEvidenceSnapshotV1,
} from "../field-evidence/field-evidence-contract.ts";
import {
  validateTargetCausalOverlayProjection,
  type TargetCausalOverlayEdgeRecord,
  type TargetCausalOverlayNodeRecord,
  type TargetCausalOverlayProjectionV1,
  type TargetCausalOverlaySnapshotV1,
} from "../target-causal-overlay/target-causal-overlay-contract.ts";
import {
  QueryIndexAvailabilityError,
  type QueryIndexProjectionKind,
} from "./query-index-contract.ts";
import type {
  QueryIndexBuildMetadata,
  QueryIndexBuildProjection,
  QueryIndexIndexedEdge,
  QueryIndexIndexedNode,
  QueryIndexStore,
} from "./query-index-store.ts";

export interface QueryIndexExpectedSource {
  readonly store: QueryIndexStore;
  readonly projectKey: string;
  readonly expectedSourceDescriptorHash: string;
}

export interface QueryIndexExplicitBuildSource {
  readonly store: QueryIndexStore;
  readonly indexBuildId: string;
  readonly expectedSourceDescriptorHash: string;
}

export async function resolveCurrentQueryIndex(
  input: QueryIndexExpectedSource,
): Promise<QueryIndexBuildMetadata> {
  if (!/^[0-9a-f]{64}$/u.test(input.expectedSourceDescriptorHash))
    throw new Error("QUERY_INDEX_EXPECTED_DESCRIPTOR_HASH_INVALID");
  const current = await input.store.resolveCurrentBuild(input.projectKey);
  if (current !== null) {
    if (current.sourceDescriptorHash !== input.expectedSourceDescriptorHash)
      throw availability(
        input,
        "QUERY_INDEX_STALE",
        "SOURCE_DESCRIPTOR_MISMATCH",
        current.indexBuildId,
      );
    return current;
  }
  const expected = await input.store.readBuild(
    input.expectedSourceDescriptorHash,
  );
  if (expected === null)
    throw availability(input, "QUERY_INDEX_UNAVAILABLE", "BUILD_MISSING", null);
  if (expected.projectKey !== input.projectKey)
    throw availability(input, "QUERY_INDEX_UNAVAILABLE", "BUILD_MISSING", null);
  const reason =
    expected.state === "STAGING"
      ? "BUILD_STAGING"
      : expected.state === "FAILED"
        ? "BUILD_FAILED"
        : "BUILD_NOT_CURRENT";
  throw availability(
    input,
    "QUERY_INDEX_UNAVAILABLE",
    reason,
    expected.indexBuildId,
  );
}

export async function loadIndexedProjectTopology(
  input: QueryIndexExpectedSource,
): Promise<{ readonly projection: ProjectTopologyProjectionV1 }> {
  const build = await resolveCurrentQueryIndex(input);
  return loadProjectTopologyFromBuild(input.store, build);
}

export async function loadIndexedProjectTopologyForBuild(
  input: QueryIndexExplicitBuildSource,
): Promise<{ readonly projection: ProjectTopologyProjectionV1 }> {
  const build = await resolveExplicitQueryIndexBuild(input);
  return loadProjectTopologyFromBuild(input.store, build);
}

async function loadProjectTopologyFromBuild(
  store: QueryIndexStore,
  build: QueryIndexBuildMetadata,
): Promise<{ readonly projection: ProjectTopologyProjectionV1 }> {
  const descriptor = build.sourceDescriptor.topology;
  const projectionMetadata = requireProjection(
    build,
    "PROJECT_TOPOLOGY",
    descriptor.snapshotId,
  );
  const [indexedNodes, indexedEdges] = await Promise.all([
    store.readNodes({
      indexBuildId: build.indexBuildId,
      projectionKind: "PROJECT_TOPOLOGY",
      projectionSnapshotId: descriptor.snapshotId,
      limit: descriptor.counts.nodes + 1,
    }),
    store.readEdges({
      indexBuildId: build.indexBuildId,
      projectionKind: "PROJECT_TOPOLOGY",
      projectionSnapshotId: descriptor.snapshotId,
      limit: descriptor.counts.edges + 1,
    }),
  ]);
  assertIndexedCounts(indexedNodes, indexedEdges, descriptor.counts);
  const projection: ProjectTopologyProjectionV1 = {
    snapshot: parseSnapshot<ProjectTopologySnapshotV1>(
      projectionMetadata,
      descriptor.files.snapshot.sha256,
    ),
    nodes: indexedNodes.map((record) =>
      parseNode<ProjectTopologyNodeRecord>(record),
    ),
    edges: indexedEdges.map((record) =>
      parseEdge<ProjectTopologyEdgeRecord>(record),
    ),
  };
  validateProjectTopologyProjection(projection);
  return { projection };
}

export async function loadIndexedFieldEvidence(
  input: QueryIndexExpectedSource & {
    readonly fieldEvidenceSnapshotId: string;
  },
): Promise<{ readonly projection: FieldEvidenceProjectionV1 }> {
  const build = await resolveCurrentQueryIndex(input);
  return loadFieldEvidenceFromBuild(
    input.store,
    build,
    input.fieldEvidenceSnapshotId,
    input,
  );
}

export async function loadIndexedFieldEvidenceForBuild(
  input: QueryIndexExplicitBuildSource & {
    readonly fieldEvidenceSnapshotId: string;
  },
): Promise<{ readonly projection: FieldEvidenceProjectionV1 }> {
  const build = await resolveExplicitQueryIndexBuild(input);
  return loadFieldEvidenceFromBuild(
    input.store,
    build,
    input.fieldEvidenceSnapshotId,
    {
      store: input.store,
      projectKey: build.projectKey,
      expectedSourceDescriptorHash: input.expectedSourceDescriptorHash,
    },
  );
}

async function loadFieldEvidenceFromBuild(
  store: QueryIndexStore,
  build: QueryIndexBuildMetadata,
  fieldEvidenceSnapshotId: string,
  availabilityInput: QueryIndexExpectedSource,
): Promise<{ readonly projection: FieldEvidenceProjectionV1 }> {
  const descriptor = build.sourceDescriptor.fieldEvidence.find(
    ({ snapshotId }) => snapshotId === fieldEvidenceSnapshotId,
  );
  if (descriptor === undefined)
    throw availability(
      availabilityInput,
      "QUERY_INDEX_FIELD_SNAPSHOT_UNAVAILABLE",
      "FIELD_SNAPSHOT_MISSING",
      build.indexBuildId,
    );
  const projectionMetadata = requireProjection(
    build,
    "FIELD_EVIDENCE",
    descriptor.snapshotId,
  );
  const [indexedNodes, indexedEdges] = await Promise.all([
    store.readNodes({
      indexBuildId: build.indexBuildId,
      projectionKind: "FIELD_EVIDENCE",
      projectionSnapshotId: descriptor.snapshotId,
      limit: descriptor.counts.nodes + 1,
    }),
    store.readEdges({
      indexBuildId: build.indexBuildId,
      projectionKind: "FIELD_EVIDENCE",
      projectionSnapshotId: descriptor.snapshotId,
      limit: descriptor.counts.edges + 1,
    }),
  ]);
  assertIndexedCounts(indexedNodes, indexedEdges, descriptor.counts);
  const projection: FieldEvidenceProjectionV1 = {
    snapshot: parseSnapshot<FieldEvidenceSnapshotV1>(
      projectionMetadata,
      descriptor.files.snapshot.sha256,
    ),
    nodes: indexedNodes.map((record) =>
      parseNode<FieldEvidenceNodeRecord>(record),
    ),
    edges: indexedEdges.map((record) =>
      parseEdge<FieldEvidenceEdgeRecord>(record),
    ),
  };
  validateFieldEvidenceProjection(projection);
  return { projection };
}

export async function loadIndexedTargetCausalOverlay(
  input: QueryIndexExpectedSource & {
    readonly targetCausalOverlaySnapshotId: string;
  },
): Promise<{ readonly projection: TargetCausalOverlayProjectionV1 }> {
  const build = await resolveCurrentQueryIndex(input);
  return loadTargetCausalOverlayFromBuild(
    input.store,
    build,
    input.targetCausalOverlaySnapshotId,
    input,
  );
}

export async function loadIndexedTargetCausalOverlayForBuild(
  input: QueryIndexExplicitBuildSource & {
    readonly targetCausalOverlaySnapshotId: string;
  },
): Promise<{ readonly projection: TargetCausalOverlayProjectionV1 }> {
  const build = await resolveExplicitQueryIndexBuild(input);
  return loadTargetCausalOverlayFromBuild(
    input.store,
    build,
    input.targetCausalOverlaySnapshotId,
    {
      store: input.store,
      projectKey: build.projectKey,
      expectedSourceDescriptorHash: input.expectedSourceDescriptorHash,
    },
  );
}

async function loadTargetCausalOverlayFromBuild(
  store: QueryIndexStore,
  build: QueryIndexBuildMetadata,
  snapshotId: string,
  availabilityInput: QueryIndexExpectedSource,
): Promise<{ readonly projection: TargetCausalOverlayProjectionV1 }> {
  const descriptor = (build.sourceDescriptor.targetCausalOverlays ?? []).find(
    (candidate) => candidate.snapshotId === snapshotId,
  );
  if (descriptor === undefined)
    throw availability(
      availabilityInput,
      "QUERY_INDEX_CAUSAL_SNAPSHOT_UNAVAILABLE",
      "CAUSAL_SNAPSHOT_MISSING",
      build.indexBuildId,
    );
  const projectionMetadata = requireProjection(
    build,
    "TARGET_CAUSAL_OVERLAY",
    descriptor.snapshotId,
  );
  const [indexedNodes, indexedEdges] = await Promise.all([
    store.readNodes({
      indexBuildId: build.indexBuildId,
      projectionKind: "TARGET_CAUSAL_OVERLAY",
      projectionSnapshotId: descriptor.snapshotId,
      limit: descriptor.counts.nodes + 1,
    }),
    store.readEdges({
      indexBuildId: build.indexBuildId,
      projectionKind: "TARGET_CAUSAL_OVERLAY",
      projectionSnapshotId: descriptor.snapshotId,
      limit: descriptor.counts.edges + 1,
    }),
  ]);
  assertIndexedCounts(indexedNodes, indexedEdges, descriptor.counts);
  const projection: TargetCausalOverlayProjectionV1 = {
    snapshot: parseSnapshot<TargetCausalOverlaySnapshotV1>(
      projectionMetadata,
      descriptor.files.snapshot.sha256,
    ),
    nodes: indexedNodes.map((record) =>
      parseNode<TargetCausalOverlayNodeRecord>(record),
    ),
    edges: indexedEdges.map((record) =>
      parseEdge<TargetCausalOverlayEdgeRecord>(record),
    ),
  };
  validateTargetCausalOverlayProjection(projection);
  return { projection };
}

async function resolveExplicitQueryIndexBuild(
  input: QueryIndexExplicitBuildSource,
): Promise<QueryIndexBuildMetadata> {
  const build = await input.store.readBuild(input.indexBuildId);
  if (build === null)
    throw new Error(`QUERY_INDEX_PARITY_BUILD_MISSING:${input.indexBuildId}`);
  if (
    build.sourceDescriptorHash !== input.expectedSourceDescriptorHash ||
    build.indexBuildId !== input.indexBuildId
  )
    throw new Error("QUERY_INDEX_PARITY_BUILD_SOURCE_MISMATCH");
  if (build.state !== "STAGING" && build.state !== "READY")
    throw new Error(`QUERY_INDEX_PARITY_BUILD_STATE_INVALID:${build.state}`);
  return build;
}

function requireProjection(
  build: QueryIndexBuildMetadata,
  projectionKind: QueryIndexProjectionKind,
  projectionSnapshotId: string,
): QueryIndexBuildProjection {
  const matches = build.projections.filter(
    (projection) =>
      projection.projectionKind === projectionKind &&
      projection.projectionSnapshotId === projectionSnapshotId,
  );
  if (matches.length !== 1)
    throw new Error(
      `QUERY_INDEX_STORED_PROJECTION_MEMBERSHIP_INVALID:${projectionKind}:${projectionSnapshotId}`,
    );
  return matches[0]!;
}

function parseSnapshot<T>(
  projection: QueryIndexBuildProjection,
  expectedFileSha256: string,
): T {
  if (
    projection.snapshotFileSha256 !== expectedFileSha256 ||
    sha256(projection.snapshotJson) !== expectedFileSha256
  )
    throw new Error("QUERY_INDEX_STORED_SNAPSHOT_HASH_INVALID");
  return parseJson<T>(projection.snapshotJson, "SNAPSHOT");
}

function parseNode<T>(record: QueryIndexIndexedNode): T {
  if (
    record.key.recordType !== "NODE" ||
    record.key.canonicalRecordId !== record.canonicalNodeId ||
    sha256(record.recordJson) !== record.recordHash
  )
    throw new Error("QUERY_INDEX_STORED_NODE_RECORD_INVALID");
  return parseJson<T>(record.recordJson, "NODE");
}

function parseEdge<T>(record: QueryIndexIndexedEdge): T {
  if (
    record.key.recordType !== "EDGE" ||
    record.key.canonicalRecordId !== record.canonicalEdgeId ||
    sha256(record.recordJson) !== record.recordHash
  )
    throw new Error("QUERY_INDEX_STORED_EDGE_RECORD_INVALID");
  return parseJson<T>(record.recordJson, "EDGE");
}

function parseJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`QUERY_INDEX_STORED_${label}_JSON_INVALID`);
  }
}

function assertIndexedCounts(
  nodes: readonly QueryIndexIndexedNode[],
  edges: readonly QueryIndexIndexedEdge[],
  expected: { readonly nodes: number; readonly edges: number },
): void {
  if (nodes.length !== expected.nodes || edges.length !== expected.edges)
    throw new Error("QUERY_INDEX_STORED_PROJECTION_COUNT_MISMATCH");
}

function availability(
  input: QueryIndexExpectedSource,
  code:
    | "QUERY_INDEX_UNAVAILABLE"
    | "QUERY_INDEX_STALE"
    | "QUERY_INDEX_FIELD_SNAPSHOT_UNAVAILABLE"
    | "QUERY_INDEX_CAUSAL_SNAPSHOT_UNAVAILABLE",
  reason:
    | "BUILD_MISSING"
    | "BUILD_STAGING"
    | "BUILD_FAILED"
    | "BUILD_NOT_CURRENT"
    | "SOURCE_DESCRIPTOR_MISMATCH"
    | "FIELD_SNAPSHOT_MISSING"
    | "CAUSAL_SNAPSHOT_MISSING",
  actualIndexBuildId: string | null,
): QueryIndexAvailabilityError {
  return new QueryIndexAvailabilityError({
    code,
    reason,
    projectKey: input.projectKey,
    expectedSourceDescriptorHash: input.expectedSourceDescriptorHash,
    actualIndexBuildId,
  });
}
