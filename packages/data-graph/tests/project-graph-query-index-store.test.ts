import { describe, expect, it } from "vitest";

import { canonicalJson, sha256 } from "../src/contracts/runtime.ts";
import {
  QUERY_INDEX_ALGORITHM_VERSION,
  QUERY_INDEX_LEGACY_ALGORITHM_VERSION,
  QUERY_INDEX_LEGACY_SCHEMA_VERSION,
  QUERY_INDEX_SCHEMA_VERSION,
  queryIndexBuildId,
  queryIndexSourceDescriptorHash,
  validateQueryIndexSourceDescriptor,
  type QueryIndexSourceDescriptorV1,
} from "../src/project-graph/query-index/query-index-contract.ts";
import { InMemoryQueryIndexStore } from "../src/project-graph/query-index/in-memory-query-index-store.ts";
import type {
  QueryIndexIndexedEdge,
  QueryIndexIndexedNode,
  QueryIndexStagedBuildInput,
} from "../src/project-graph/query-index/query-index-store.ts";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const PARITY_HASH = "c".repeat(64);

function descriptor(
  projectKey: string,
  marker = HASH_A,
): QueryIndexSourceDescriptorV1 {
  const file = (fileName: string, recordCount: number | null) => ({
    fileName,
    sha256: marker,
    byteLength: 1,
    recordCount,
  });
  return {
    schemaVersion: QUERY_INDEX_SCHEMA_VERSION,
    algorithmVersion: QUERY_INDEX_ALGORITHM_VERSION,
    projectKey,
    topology: {
      projectionKind: "PROJECT_TOPOLOGY",
      schemaVersion: "1.0.0",
      projectionVersion: "1.0.0",
      snapshotId: `topology-${marker.slice(0, 4)}`,
      snapshotContentHash: marker,
      manifestContentHash: marker,
      counts: { nodes: 2, edges: 1, boundaries: 0 },
      files: {
        manifest: file("projection-manifest.json", null),
        snapshot: file("snapshot.json", null),
        nodes: file("topology.nodes.jsonl", 2),
        edges: file("topology.edges.jsonl", 1),
      },
    },
    fieldEvidence: [],
    targetCausalOverlays: [],
  };
}

function stagedInput(
  projectKey: string,
  marker = HASH_A,
): QueryIndexStagedBuildInput {
  const source = descriptor(projectKey, marker);
  return {
    indexBuildId: queryIndexBuildId(source),
    projectKey,
    sourceDescriptorHash: queryIndexSourceDescriptorHash(source),
    sourceDescriptor: source,
    projections: [
      {
        projectionKind: "PROJECT_TOPOLOGY",
        projectionSnapshotId: source.topology.snapshotId,
        snapshotJson: canonicalJson({
          snapshotId: source.topology.snapshotId,
        }),
        snapshotFileSha256: source.topology.files.snapshot.sha256,
        counts: source.topology.counts,
      },
    ],
    expectedCounts: { nodes: 2, edges: 1 },
  };
}

function records(input: QueryIndexStagedBuildInput): {
  readonly nodes: readonly QueryIndexIndexedNode[];
  readonly edge: QueryIndexIndexedEdge;
} {
  const node = (canonicalNodeId: string): QueryIndexIndexedNode => {
    const recordJson = canonicalJson({ nodeId: canonicalNodeId });
    return {
      key: {
        indexBuildId: input.indexBuildId,
        projectionKind: "PROJECT_TOPOLOGY",
        projectionSnapshotId: input.sourceDescriptor.topology.snapshotId,
        recordType: "NODE",
        canonicalRecordId: canonicalNodeId,
      },
      canonicalNodeId,
      nodeType: "TASK",
      recordJson,
      recordHash: sha256(recordJson),
    };
  };
  const recordJson = canonicalJson({
    edgeId: "edge-a-b",
    fromNodeId: "node-a",
    toNodeId: "node-b",
  });
  return {
    nodes: [node("node-a"), node("node-b")],
    edge: {
      key: {
        indexBuildId: input.indexBuildId,
        projectionKind: "PROJECT_TOPOLOGY",
        projectionSnapshotId: input.sourceDescriptor.topology.snapshotId,
        recordType: "EDGE",
        canonicalRecordId: "edge-a-b",
      },
      canonicalEdgeId: "edge-a-b",
      edgeType: "PRODUCER_BRIDGE",
      relationLayer: "DATA_PRODUCTION",
      fromCanonicalNodeId: "node-a",
      toCanonicalNodeId: "node-b",
      recordJson,
      recordHash: sha256(recordJson),
    },
  };
}

async function importAndActivate(
  store: InMemoryQueryIndexStore,
  input: QueryIndexStagedBuildInput,
): Promise<void> {
  const data = records(input);
  await store.beginStagedBuild(input);
  await store.writeNodes(input.indexBuildId, data.nodes);
  await store.writeEdges(input.indexBuildId, [data.edge]);
  await store.recordValidation(input.indexBuildId, "PASSED");
  await store.recordParity(input.indexBuildId, "PASSED", PARITY_HASH);
  await store.activateReadyBuild(input);
}

describe("query-index store contract", () => {
  it("keeps immutable Phase 3 source descriptors readable for rollback", () => {
    const { targetCausalOverlays: _causal, ...current } = descriptor("legacy");
    const legacy: QueryIndexSourceDescriptorV1 = {
      ...current,
      schemaVersion: QUERY_INDEX_LEGACY_SCHEMA_VERSION,
      algorithmVersion: QUERY_INDEX_LEGACY_ALGORITHM_VERSION,
    };
    expect(() => validateQueryIndexSourceDescriptor(legacy)).not.toThrow();
    expect(queryIndexBuildId(legacy)).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("keeps staging invisible and preserves the previous current build", async () => {
    const store = new InMemoryQueryIndexStore();
    const first = stagedInput("project-a", HASH_A);
    await importAndActivate(store, first);
    const second = stagedInput("project-a", HASH_B);
    await store.beginStagedBuild(second);

    expect((await store.resolveCurrentBuild("project-a"))?.indexBuildId).toBe(
      first.indexBuildId,
    );
    store.failNext("ACTIVATE");
    await store.recordValidation(second.indexBuildId, "PASSED");
    await store.recordParity(second.indexBuildId, "PASSED", PARITY_HASH);
    await expect(store.activateReadyBuild(second)).rejects.toThrow(
      "QUERY_INDEX_SIMULATED_ACTIVATE_FAILURE",
    );
    expect((await store.resolveCurrentBuild("project-a"))?.indexBuildId).toBe(
      first.indexBuildId,
    );
  });

  it("reuses one exact build and rejects the same ID with different metadata", async () => {
    const store = new InMemoryQueryIndexStore();
    const input = stagedInput("project-a");
    expect((await store.beginStagedBuild(input)).status).toBe("CREATED");
    expect((await store.beginStagedBuild(input)).status).toBe("REUSED");

    await expect(
      store.beginStagedBuild({
        ...input,
        expectedCounts: { nodes: 99, edges: 1 },
      }),
    ).rejects.toThrow("QUERY_INDEX_BUILD_IDENTITY_CONFLICT");
  });

  it("keeps projection identities lossless and checks edge endpoints", async () => {
    const store = new InMemoryQueryIndexStore();
    const input = stagedInput("project-a");
    const data = records(input);
    await store.beginStagedBuild(input);
    await expect(
      store.writeEdges(input.indexBuildId, [data.edge]),
    ).rejects.toThrow("QUERY_INDEX_EDGE_ENDPOINT_MISSING");
    await store.writeNodes(input.indexBuildId, data.nodes);
    await store.writeNodes(input.indexBuildId, data.nodes);
    await store.writeEdges(input.indexBuildId, [data.edge]);
    await store.writeEdges(input.indexBuildId, [data.edge]);

    expect(await store.readBuildRecordCounts(input.indexBuildId)).toMatchObject(
      {
        nodes: 2,
        edges: 1,
        uniqueNodeKeys: 2,
        uniqueEdgeKeys: 1,
        unresolvedEdgeEndpoints: 0,
      },
    );
  });

  it("isolates projects and cleanup to one exact non-current build", async () => {
    const store = new InMemoryQueryIndexStore();
    const first = stagedInput("project-a", HASH_A);
    const second = stagedInput("project-a", HASH_B);
    const unrelated = stagedInput("project-b", HASH_A);
    await importAndActivate(store, first);
    await store.beginStagedBuild(second);
    await importAndActivate(store, unrelated);

    await expect(
      store.cleanupBuild({
        projectKey: "project-a",
        indexBuildId: first.indexBuildId,
      }),
    ).rejects.toThrow("QUERY_INDEX_CLEANUP_CURRENT_FORBIDDEN");
    await expect(
      store.cleanupBuild({
        projectKey: "project-b",
        indexBuildId: second.indexBuildId,
      }),
    ).rejects.toThrow("QUERY_INDEX_CLEANUP_PROJECT_MISMATCH");
    expect(
      await store.cleanupBuild({
        projectKey: "project-a",
        indexBuildId: second.indexBuildId,
      }),
    ).toBe(true);
    expect((await store.resolveCurrentBuild("project-b"))?.indexBuildId).toBe(
      unrelated.indexBuildId,
    );
  });

  it("simulates interrupted writes, count conflicts and dangling pointers", async () => {
    const store = new InMemoryQueryIndexStore();
    const input = stagedInput("project-a");
    const data = records(input);
    await store.beginStagedBuild(input);
    store.failNext("WRITE_NODES");
    await expect(
      store.writeNodes(input.indexBuildId, data.nodes),
    ).rejects.toThrow("QUERY_INDEX_SIMULATED_WRITE_NODES_FAILURE");
    expect((await store.readBuildRecordCounts(input.indexBuildId)).nodes).toBe(
      0,
    );
    await store.writeNodes(input.indexBuildId, data.nodes.slice(0, 1));
    expect(
      (await store.readBuildRecordCounts(input.indexBuildId)).nodes,
    ).not.toBe(input.expectedCounts.nodes);
    store.setDanglingCurrentPointer("missing-project", "missing-build");
    expect(await store.resolveCurrentBuild("missing-project")).toBeNull();
  });
});
