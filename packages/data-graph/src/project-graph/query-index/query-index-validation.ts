import { canonicalJson, sha256 } from "../../contracts/runtime.ts";
import type { LoadedQueryIndexSource } from "./query-index-source.ts";
import type { QueryIndexRecordBundle } from "./query-index-records.ts";
import type {
  QueryIndexBuildMetadata,
  QueryIndexRecordCounts,
  QueryIndexStore,
} from "./query-index-store.ts";

export interface QueryIndexValidationResult {
  readonly build: QueryIndexBuildMetadata;
  readonly counts: QueryIndexRecordCounts;
}

export async function validateQueryIndexBuild(input: {
  readonly store: QueryIndexStore;
  readonly source: LoadedQueryIndexSource;
  readonly records: QueryIndexRecordBundle;
}): Promise<QueryIndexValidationResult> {
  const build = await input.store.readBuild(input.source.indexBuildId);
  if (build === null)
    throw new Error(
      `QUERY_INDEX_VALIDATION_BUILD_MISSING:${input.source.indexBuildId}`,
    );
  if (build.state !== "STAGING" && build.state !== "READY")
    throw new Error(
      `QUERY_INDEX_VALIDATION_BUILD_STATE_INVALID:${build.state}`,
    );
  if (
    build.projectKey !== input.source.descriptor.projectKey ||
    build.sourceDescriptorHash !== input.source.descriptorHash ||
    canonicalJson(build.sourceDescriptor) !==
      canonicalJson(input.source.descriptor)
  )
    throw new Error("QUERY_INDEX_VALIDATION_DESCRIPTOR_MISMATCH");
  if (
    canonicalJson(build.projections) !==
      canonicalJson(input.records.projections) ||
    canonicalJson(build.expectedCounts) !==
      canonicalJson(input.records.expectedCounts)
  )
    throw new Error("QUERY_INDEX_VALIDATION_EXPECTATION_MISMATCH");
  for (const projection of build.projections) {
    if (
      sha256(projection.snapshotJson) !== projection.snapshotFileSha256 ||
      !input.source.descriptor.fieldEvidence
        .map((field) => field.files.snapshot.sha256)
        .concat(
          (input.source.descriptor.targetCausalOverlays ?? []).map(
            (causal) => causal.files.snapshot.sha256,
          ),
        )
        .concat(input.source.descriptor.topology.files.snapshot.sha256)
        .includes(projection.snapshotFileSha256)
    )
      throw new Error("QUERY_INDEX_VALIDATION_SNAPSHOT_HASH_MISMATCH");
  }
  const counts = await input.store.readBuildRecordCounts(
    input.source.indexBuildId,
  );
  if (
    counts.nodes !== input.records.expectedCounts.nodes ||
    counts.edges !== input.records.expectedCounts.edges
  )
    throw new Error("QUERY_INDEX_VALIDATION_COUNT_MISMATCH");
  if (
    counts.uniqueNodeKeys !== counts.nodes ||
    counts.uniqueEdgeKeys !== counts.edges
  )
    throw new Error("QUERY_INDEX_VALIDATION_RECORD_KEY_CONFLICT");
  if (counts.unresolvedEdgeEndpoints !== 0)
    throw new Error("QUERY_INDEX_VALIDATION_EDGE_ENDPOINT_MISSING");
  if (
    counts.nodePayloadHash !== input.records.payloadHashes.nodes ||
    counts.edgePayloadHash !== input.records.payloadHashes.edges
  )
    throw new Error("QUERY_INDEX_VALIDATION_PAYLOAD_HASH_MISMATCH");
  return { build, counts };
}
