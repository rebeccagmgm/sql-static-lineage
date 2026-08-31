import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sha256 } from "../../contracts/runtime.ts";
import {
  FIELD_EVIDENCE_MANIFEST_FILE,
  loadFieldEvidenceDirectory,
  type LoadedFieldEvidenceDirectory,
} from "../field-evidence/field-evidence-publication.ts";
import {
  PROJECT_TOPOLOGY_MANIFEST_FILE,
  loadProjectTopologyDirectory,
  type LoadedProjectTopologyDirectory,
} from "../topology/project-topology-publication.ts";
import {
  TARGET_CAUSAL_OVERLAY_MANIFEST_FILE,
  loadTargetCausalOverlayDirectory,
  type LoadedTargetCausalOverlayDirectory,
} from "../target-causal-overlay/target-causal-overlay-publication.ts";
import {
  QUERY_INDEX_ALGORITHM_VERSION,
  QUERY_INDEX_SCHEMA_VERSION,
  compareProjectionSource,
  queryIndexBuildId,
  queryIndexSourceDescriptorHash,
  type QueryIndexFieldSourceIdentity,
  type QueryIndexSourceDescriptorV1,
  type QueryIndexSourceFileIdentity,
  type QueryIndexTargetCausalSourceIdentity,
  type QueryIndexTopologySourceIdentity,
} from "./query-index-contract.ts";

export interface LoadQueryIndexSourceInput {
  readonly topologyDirectory: string;
  readonly fieldEvidenceDirectories?: readonly string[];
  readonly targetCausalOverlayDirectories?: readonly string[];
  readonly limits?: {
    readonly maxFileBytes?: number;
  };
}

export interface LoadedQueryIndexSource {
  readonly topology: LoadedProjectTopologyDirectory;
  readonly fieldEvidence: readonly LoadedFieldEvidenceDirectory[];
  readonly targetCausalOverlays: readonly LoadedTargetCausalOverlayDirectory[];
  readonly descriptor: QueryIndexSourceDescriptorV1;
  readonly descriptorHash: string;
  readonly indexBuildId: string;
}

export function loadQueryIndexSource(
  input: LoadQueryIndexSourceInput,
): LoadedQueryIndexSource {
  const topology = loadProjectTopologyDirectory(
    input.topologyDirectory,
    input.limits,
  );
  const topologyIdentity = topologySourceIdentity(topology);
  const fields = (input.fieldEvidenceDirectories ?? []).map((directory) => {
    const loaded = loadFieldEvidenceDirectory(directory, input.limits);
    assertFieldReferencesTopology(loaded, topology, topologyIdentity);
    return {
      loaded,
      identity: fieldSourceIdentity(loaded),
    };
  });
  assertNoDuplicateOrConflictingFields(fields);
  fields.sort((left, right) =>
    compareProjectionSource(left.identity, right.identity),
  );
  const causals = (input.targetCausalOverlayDirectories ?? []).map(
    (directory) => {
      const loaded = loadTargetCausalOverlayDirectory(directory, input.limits);
      assertCausalReferencesSources(loaded, topology, topologyIdentity, fields);
      return { loaded, identity: causalSourceIdentity(loaded) };
    },
  );
  assertNoDuplicateOrConflictingCausals(causals);
  causals.sort((left, right) =>
    compareProjectionSource(left.identity, right.identity),
  );
  const descriptor: QueryIndexSourceDescriptorV1 = {
    schemaVersion: QUERY_INDEX_SCHEMA_VERSION,
    algorithmVersion: QUERY_INDEX_ALGORITHM_VERSION,
    projectKey: topology.projection.snapshot.projectKey,
    topology: topologyIdentity,
    fieldEvidence: fields.map(({ identity }) => identity),
    targetCausalOverlays: causals.map(({ identity }) => identity),
  };
  const descriptorHash = queryIndexSourceDescriptorHash(descriptor);
  return {
    topology,
    fieldEvidence: fields.map(({ loaded }) => loaded),
    targetCausalOverlays: causals.map(({ loaded }) => loaded),
    descriptor,
    descriptorHash,
    indexBuildId: queryIndexBuildId(descriptor),
  };
}

function causalSourceIdentity(
  source: LoadedTargetCausalOverlayDirectory,
): QueryIndexTargetCausalSourceIdentity {
  return {
    projectionKind: "TARGET_CAUSAL_OVERLAY",
    schemaVersion: source.manifest.schemaVersion,
    projectionVersion: source.manifest.projectionVersion,
    snapshotId: source.manifest.snapshotId,
    snapshotContentHash: source.manifest.snapshotContentHash,
    manifestContentHash: source.manifest.contentHash,
    counts: source.manifest.counts,
    files: {
      manifest: manifestFileIdentity(
        source.directory,
        TARGET_CAUSAL_OVERLAY_MANIFEST_FILE,
      ),
      snapshot: source.manifest.files.snapshot,
      nodes: source.manifest.files.nodes,
      edges: source.manifest.files.edges,
    },
  };
}

function topologySourceIdentity(
  source: LoadedProjectTopologyDirectory,
): QueryIndexTopologySourceIdentity {
  return {
    projectionKind: "PROJECT_TOPOLOGY",
    schemaVersion: source.manifest.schemaVersion,
    projectionVersion: source.manifest.projectionVersion,
    snapshotId: source.manifest.snapshotId,
    snapshotContentHash: source.manifest.snapshotContentHash,
    manifestContentHash: source.manifest.contentHash,
    counts: source.manifest.counts,
    files: {
      manifest: manifestFileIdentity(
        source.directory,
        PROJECT_TOPOLOGY_MANIFEST_FILE,
      ),
      snapshot: source.manifest.files.snapshot,
      nodes: source.manifest.files.nodes,
      edges: source.manifest.files.edges,
    },
  };
}

function fieldSourceIdentity(
  source: LoadedFieldEvidenceDirectory,
): QueryIndexFieldSourceIdentity {
  return {
    projectionKind: "FIELD_EVIDENCE",
    schemaVersion: source.manifest.schemaVersion,
    projectionVersion: source.manifest.projectionVersion,
    snapshotId: source.manifest.snapshotId,
    snapshotContentHash: source.manifest.snapshotContentHash,
    manifestContentHash: source.manifest.contentHash,
    counts: source.manifest.counts,
    files: {
      manifest: manifestFileIdentity(
        source.directory,
        FIELD_EVIDENCE_MANIFEST_FILE,
      ),
      snapshot: source.manifest.files.snapshot,
      nodes: source.manifest.files.nodes,
      edges: source.manifest.files.edges,
    },
  };
}

function manifestFileIdentity(
  directory: string,
  fileName: string,
): QueryIndexSourceFileIdentity {
  const bytes = readFileSync(join(directory, fileName));
  return {
    fileName,
    sha256: sha256(bytes),
    byteLength: bytes.byteLength,
    recordCount: null,
  };
}

function assertFieldReferencesTopology(
  field: LoadedFieldEvidenceDirectory,
  topology: LoadedProjectTopologyDirectory,
  topologyIdentity: QueryIndexTopologySourceIdentity,
): void {
  const reference = field.projection.snapshot.projectSource;
  if (
    field.projection.snapshot.projectKey !== topology.manifest.projectKey ||
    reference.projectKey !== topology.manifest.projectKey
  )
    throw new Error(
      `QUERY_INDEX_FIELD_PROJECT_MISMATCH:${field.manifest.snapshotId}`,
    );
  if (reference.snapshotId !== topology.manifest.snapshotId)
    throw new Error(
      `QUERY_INDEX_FIELD_TOPOLOGY_MISMATCH:${field.manifest.snapshotId}`,
    );
  if (
    reference.manifestContentHash !== topology.manifest.contentHash ||
    reference.manifestSha256 !== topologyIdentity.files.manifest.sha256 ||
    reference.snapshotSha256 !== topologyIdentity.files.snapshot.sha256 ||
    reference.nodesSha256 !== topologyIdentity.files.nodes.sha256 ||
    reference.edgesSha256 !== topologyIdentity.files.edges.sha256
  )
    throw new Error(
      `QUERY_INDEX_FIELD_TOPOLOGY_HASH_MISMATCH:${field.manifest.snapshotId}`,
    );
}

function assertNoDuplicateOrConflictingFields(
  fields: readonly {
    readonly loaded: LoadedFieldEvidenceDirectory;
    readonly identity: QueryIndexFieldSourceIdentity;
  }[],
): void {
  const bySnapshot = new Map<string, QueryIndexFieldSourceIdentity>();
  for (const field of fields) {
    const previous = bySnapshot.get(field.identity.snapshotId);
    if (previous === undefined) {
      bySnapshot.set(field.identity.snapshotId, field.identity);
      continue;
    }
    const code =
      previous.files.manifest.sha256 === field.identity.files.manifest.sha256
        ? "QUERY_INDEX_FIELD_SOURCE_DUPLICATE"
        : "QUERY_INDEX_FIELD_SOURCE_CONFLICT";
    throw new Error(`${code}:${field.identity.snapshotId}`);
  }
}

function assertCausalReferencesSources(
  causal: LoadedTargetCausalOverlayDirectory,
  topology: LoadedProjectTopologyDirectory,
  topologyIdentity: QueryIndexTopologySourceIdentity,
  fields: readonly {
    readonly loaded: LoadedFieldEvidenceDirectory;
    readonly identity: QueryIndexFieldSourceIdentity;
  }[],
): void {
  const snapshot = causal.projection.snapshot;
  if (
    snapshot.projectKey !== topology.manifest.projectKey ||
    snapshot.projectSource.projectKey !== topology.manifest.projectKey ||
    snapshot.projectSource.snapshotId !== topology.manifest.snapshotId ||
    snapshot.projectSource.manifestContentHash !==
      topology.manifest.contentHash ||
    snapshot.projectSource.manifestSha256 !==
      topologyIdentity.files.manifest.sha256 ||
    snapshot.projectSource.snapshotSha256 !==
      topologyIdentity.files.snapshot.sha256 ||
    snapshot.projectSource.nodesSha256 !==
      topologyIdentity.files.nodes.sha256 ||
    snapshot.projectSource.edgesSha256 !== topologyIdentity.files.edges.sha256
  )
    throw new Error(
      `QUERY_INDEX_CAUSAL_TOPOLOGY_MISMATCH:${causal.manifest.snapshotId}`,
    );
  const field = fields.find(
    ({ identity }) =>
      identity.snapshotId === snapshot.fieldEvidenceSource.snapshotId,
  );
  if (
    field === undefined ||
    snapshot.fieldEvidenceSource.manifestContentHash !==
      field.identity.manifestContentHash ||
    snapshot.fieldEvidenceSource.manifestSha256 !==
      field.identity.files.manifest.sha256 ||
    snapshot.fieldEvidenceSource.snapshotSha256 !==
      field.identity.files.snapshot.sha256 ||
    snapshot.fieldEvidenceSource.nodesSha256 !==
      field.identity.files.nodes.sha256 ||
    snapshot.fieldEvidenceSource.edgesSha256 !==
      field.identity.files.edges.sha256
  )
    throw new Error(
      `QUERY_INDEX_CAUSAL_FIELD_MISMATCH:${causal.manifest.snapshotId}`,
    );
}

function assertNoDuplicateOrConflictingCausals(
  causals: readonly {
    readonly loaded: LoadedTargetCausalOverlayDirectory;
    readonly identity: QueryIndexTargetCausalSourceIdentity;
  }[],
): void {
  const bySnapshot = new Map<string, QueryIndexTargetCausalSourceIdentity>();
  for (const causal of causals) {
    const previous = bySnapshot.get(causal.identity.snapshotId);
    if (previous === undefined) {
      bySnapshot.set(causal.identity.snapshotId, causal.identity);
      continue;
    }
    const code =
      previous.files.manifest.sha256 === causal.identity.files.manifest.sha256
        ? "QUERY_INDEX_CAUSAL_SOURCE_DUPLICATE"
        : "QUERY_INDEX_CAUSAL_SOURCE_CONFLICT";
    throw new Error(`${code}:${causal.identity.snapshotId}`);
  }
}
