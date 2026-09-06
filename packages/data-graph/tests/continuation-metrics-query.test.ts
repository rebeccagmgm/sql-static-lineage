import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readPublishedContinuationMetrics } from "../src/asset-graph/continuation-metrics-query.ts";
import {
  unionContinuationIndexContentHash,
  type UnionContinuationIndexEntry,
} from "../src/project-graph/topology/task-local-union/union-continuation-index.ts";

function snapshot() {
  const root = mkdtempSync(join(tmpdir(), "continuation-metrics-"));
  const published = join(root, "published", "v1");
  mkdirSync(published, { recursive: true });
  const entries: UnionContinuationIndexEntry[] = ["a", "b", "c"].map((id) => ({
    consumerTaskId: "consumer",
    readOccurrenceId: `read:${id}`,
    readOccurrenceNodeId: `node:${id}`,
    datasetNodeId: `dataset:${id}`,
    qualifiedName: `db.${id}`,
    identityStatus: "CONFIRMED",
    partitionPredicateStatus: "NONE",
    candidates: [],
    prunedWriteObservationIds: [],
    gaps: [
      {
        gapId: `gap:${id}`,
        reasonCode: "NO_KNOWN_WRITE_OBSERVATION",
        message: "No known writer",
        details: {},
      },
    ],
  }));
  const body = {
    schemaVersion: "1.0.0" as const,
    artifactType: "UNION_CONTINUATION_INDEX" as const,
    generatedAt: "2026-09-06T00:00:00Z",
    input: {
      batchManifestRef: {
        path: join(root, "batch-manifest.json"),
        contentHash: "batch",
      },
      producerIndex: { contentHash: "writers", inputFingerprint: "facts" },
      taskProjections: [],
    },
    entries,
  };
  const index = {
    ...body,
    contentHash: unionContinuationIndexContentHash(body),
  };
  const publicationPath = join(published, "publication.json");
  const write = (path: string, value: unknown) =>
    writeFileSync(path, JSON.stringify(value));
  write(publicationPath, {
    version: "v1",
    compilerVersion: "1.0.3",
    taskCount: 3,
    confirmedFieldContinuations: 2,
    candidateFieldContinuations: 3,
    continuationIndexContentHash: index.contentHash,
  });
  write(join(root, "current.json"), { version: "v1", publicationPath });
  write(join(published, "union-continuation-index.json"), index);
  // This mutable convenience path must never override the pinned publication.
  write(join(root, "union-continuation-index.json"), { broken: true });
  return { root, published, write, index };
}

describe("published continuation metrics query", () => {
  it("reads the pinned publication and keeps missing writers in the denominator", () => {
    const { root, index } = snapshot();
    const result = readPublishedContinuationMetrics({ graphOutputRoot: root });
    expect(result.indexContentHash).toBe(index.contentHash);
    expect(result.publicationVersion).toBe("v1");
    expect(result.indexBinding).toBe("PUBLICATION_CONTENT_HASH");
    expect(result.metrics.withinUnionReadOccurrences).toBe(3);
    expect(result.metrics.withinUnionConfirmationRate).toBe(0);
    expect(result.metrics.continuationEdgeMetrics).toMatchObject({
      totalContinuationEdges: 5,
      confirmedContinuationEdges: 2,
    });
    expect(result).not.toHaveProperty("items");
  });

  it("returns bounded gap pages without dropping unknown reads", () => {
    const { root } = snapshot();
    const result = readPublishedContinuationMetrics({
      graphOutputRoot: root,
      gapLayer: "unclassified",
      offset: 1,
      limit: 1,
    });
    expect(result.items?.map((entry) => entry.readOccurrenceId)).toEqual([
      "read:b",
    ]);
    expect(result.pagination).toEqual({
      offset: 1,
      limit: 1,
      total: 3,
      nextOffset: 2,
    });
  });

  it("rejects invalid limits and layers before reading artifacts", () => {
    expect(() =>
      readPublishedContinuationMetrics({
        graphOutputRoot: "missing",
        gapLayer: "unknown",
      }),
    ).toThrow("INVALID_ARGUMENT:--gap-layer");
    expect(() =>
      readPublishedContinuationMetrics({
        graphOutputRoot: "missing",
        limit: 101,
      }),
    ).toThrow("INVALID_ARGUMENT:--limit");
  });

  it("rejects corrupted INDEX content and mismatched publication pointers", () => {
    const { root, published, write, index } = snapshot();
    write(join(published, "union-continuation-index.json"), {
      ...index,
      contentHash: "wrong",
    });
    expect(() =>
      readPublishedContinuationMetrics({ graphOutputRoot: root }),
    ).toThrow("UNION_CONTINUATION_INDEX_HASH_MISMATCH");
    write(join(root, "current.json"), {
      version: "v2",
      publicationPath: join(published, "publication.json"),
    });
    expect(() =>
      readPublishedContinuationMetrics({ graphOutputRoot: root }),
    ).toThrow("CONTINUATION_PUBLICATION_VERSION_MISMATCH");
  });

  it("rejects a hash-valid INDEX that belongs to a different publication", () => {
    const { root, published, write, index } = snapshot();
    const { contentHash: _hash, ...body } = index;
    const other = { ...body, entries: body.entries.slice(0, 1) };
    write(join(published, "union-continuation-index.json"), {
      ...other,
      contentHash: unionContinuationIndexContentHash(other),
    });
    expect(() =>
      readPublishedContinuationMetrics({ graphOutputRoot: root }),
    ).toThrow("CONTINUATION_PUBLICATION_INDEX_MISMATCH");
  });

  it("labels legacy directory binding and leaves absent edge counts unknown", () => {
    const { root, published, write } = snapshot();
    write(join(published, "publication.json"), {
      version: "v1",
      compilerVersion: "1.0.2",
      taskCount: 3,
    });
    const result = readPublishedContinuationMetrics({ graphOutputRoot: root });
    expect(result.indexBinding).toBe("LEGACY_PUBLICATION_DIRECTORY");
    expect(result.metrics.continuationEdgeMetrics).toBeNull();
  });
});
