import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readPublishedContinuationMetrics } from "../src/asset-graph/continuation-metrics-query.ts";
import { readPublishedContinuationCandidates } from "../src/asset-graph/continuation-candidates-query.ts";
import {
  buildTerminalPolicySnapshot,
  loadGraphTerminalPolicy,
} from "../src/asset-graph/terminal-policy.ts";
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

  it("filters only gap items by exact reason code while preserving global metrics", () => {
    const { root, published, write, index } = snapshot();
    const entries = index.entries.map((entry, position) =>
      position === 1
        ? {
            ...entry,
            gaps: [
              ...entry.gaps,
              {
                gapId: "gap:partition",
                reasonCode: "PARTITION_NO_MATCH" as const,
                message: "Partition values do not overlap",
                details: {},
              },
            ],
          }
        : entry,
    );
    const { contentHash: _hash, ...body } = index;
    const changed = {
      ...body,
      entries,
      contentHash: unionContinuationIndexContentHash({ ...body, entries }),
    };
    write(join(published, "union-continuation-index.json"), changed);
    write(join(published, "publication.json"), {
      version: "v1",
      compilerVersion: "1.0.3",
      taskCount: 3,
      confirmedFieldContinuations: 2,
      candidateFieldContinuations: 3,
      continuationIndexContentHash: changed.contentHash,
    });

    const result = readPublishedContinuationMetrics({
      graphOutputRoot: root,
      gapLayer: "actionable",
      reasonCode: "PARTITION_NO_MATCH",
    });
    expect(result.metrics.withinUnionReadOccurrences).toBe(3);
    expect(result.items).toEqual([
      {
        consumerTaskId: "consumer",
        readOccurrenceId: "read:b",
        qualifiedName: "db.b",
        reasonCodes: ["PARTITION_NO_MATCH"],
      },
    ]);
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
    expect(() =>
      readPublishedContinuationMetrics({
        graphOutputRoot: "missing",
        reasonCode: "",
      }),
    ).toThrow("INVALID_ARGUMENT:--reason-code");
    const { root } = snapshot();
    expect(() =>
      readPublishedContinuationMetrics({
        graphOutputRoot: root,
        publicationVersion: "v2",
      }),
    ).toThrow("CONTINUATION_PUBLICATION_VERSION_CHANGED");
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

describe("published continuation candidate query", () => {
  it("returns bounded writer candidates from the pinned immutable INDEX", () => {
    const { root, published, write, index } = snapshot();
    const entry = index.entries[0]!;
    const entries = [
      {
        ...entry,
        partitionPredicateStatus: "LITERAL" as const,
        candidates: [
          {
            taskId: "writer",
            writeObservationId: "write:1",
            targetWriteNodeId: "target:1",
            datasetNodeId: "dataset:writer",
            qualifiedName: "db.a",
            source: "IN_UNION_FINAL_WRITE" as const,
            partitionMatchStatus: "CONFIRMED" as const,
            partition: [
              {
                column: "dt",
                values: ["2026-09-06"],
                partitionStatus: "CONFIRMED",
              },
            ],
            evidenceLayer: "L1" as const,
            l1Eligible: true,
          },
          {
            taskId: "writer-b",
            writeObservationId: "write:2",
            targetWriteNodeId: "target:2",
            datasetNodeId: "dataset:writer-b",
            qualifiedName: "db.a",
            source: "IN_UNION_FINAL_WRITE" as const,
            partitionMatchStatus: "UNKNOWN" as const,
            partition: [],
            evidenceLayer: "L2" as const,
            l1Eligible: false,
          },
        ],
        gaps: [
          {
            gapId: "gap:read",
            reasonCode: "PARTITION_NON_LITERAL" as const,
            message: "Read partition is non-literal",
            details: { evidenceRefs: ["read-ref"] },
          },
          {
            gapId: "gap:writer",
            reasonCode: "WRITER_PARTITION_UNKNOWN" as const,
            message: "Writer partition is unknown",
            details: {
              writeObservationId: "write:1",
              evidenceRefs: ["writer-ref"],
            },
          },
        ],
      },
      ...index.entries.slice(1),
    ];
    const { contentHash: _hash, ...body } = index;
    const changed = {
      ...body,
      entries,
      contentHash: unionContinuationIndexContentHash({ ...body, entries }),
    };
    write(join(published, "union-continuation-index.json"), changed);
    write(join(published, "publication.json"), {
      version: "v1",
      compilerVersion: "1.0.3",
      taskCount: 3,
      continuationIndexContentHash: changed.contentHash,
    });

    const result = readPublishedContinuationCandidates({
      graphOutputRoot: root,
      readOccurrenceId: "read:a",
      publicationVersion: "v1",
      limit: 2,
    });
    const { items, ...metadata } = result;
    expect(metadata).toMatchObject({
      snapshotKind: "PUBLISHED_INDEX",
      publicationVersion: "v1",
      indexContentHash: changed.contentHash,
      read: {
        consumerTaskId: "consumer",
        readOccurrenceId: "read:a",
        partitionPredicateStatus: "LITERAL",
        evidenceRefs: ["read-ref"],
      },
      pagination: { offset: 0, limit: 2, total: 2, nextOffset: null },
    });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      writerTaskId: "writer",
      writeObservationId: "write:1",
      matching: {
        partitionMatchStatus: "CONFIRMED",
        evidenceLayer: "L1",
        l1Eligible: true,
      },
      writePartitionEvidence: [
        { column: "dt", values: ["2026-09-06"], partitionStatus: "CONFIRMED" },
      ],
    });
    expect(items[0]).not.toHaveProperty("evidenceRefs");
    expect(items[1]).not.toHaveProperty("evidenceRefs");
    write(join(root, "union-continuation-index.json"), { broken: true });
    expect(result.items).toHaveLength(2);
  });

  it("fails closed when a later page names a different publication", () => {
    const { root } = snapshot();
    expect(() =>
      readPublishedContinuationCandidates({
        graphOutputRoot: root,
        readOccurrenceId: "read:a",
        publicationVersion: "v2",
      }),
    ).toThrow("CONTINUATION_PUBLICATION_VERSION_CHANGED");
  });

  it("validates the published terminal-policy snapshot before querying candidates", () => {
    const { root, published, write, index } = snapshot();
    const policy = buildTerminalPolicySnapshot(index, loadGraphTerminalPolicy());
    write(join(published, "terminal-policy.json"), {
      ...policy,
      contentHash: "corrupted",
    });
    write(join(published, "publication.json"), {
      version: "v1",
      compilerVersion: "1.0.3",
      taskCount: 3,
      continuationIndexContentHash: index.contentHash,
      terminalPolicyContentHash: policy.contentHash,
    });
    expect(() =>
      readPublishedContinuationCandidates({
        graphOutputRoot: root,
        readOccurrenceId: "read:a",
      }),
    ).toThrow("TERMINAL_POLICY_SNAPSHOT_MISMATCH");
  });
});
