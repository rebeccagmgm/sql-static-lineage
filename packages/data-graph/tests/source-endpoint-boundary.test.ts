import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertSourceEndpointBoundarySnapshot,
  buildSourceEndpointBoundarySnapshot,
  classifySourceEndpointBoundaryRead,
  loadGraphSourceEndpointBoundary,
  sourceEndpointBoundaryConfigHash,
  sourceEndpointBoundaryNodeDetails,
} from "../src/asset-graph/source-endpoint-boundary.ts";
import type { UnionContinuationIndex } from "../src/continuation/continuation-index.ts";

const config = {
  version: "1.0.0",
  roles: {
    TITANS_SOURCE: { qualifiedNamePrefixes: ["titans_dm.", "titans_refdata."] },
    INGEST_SOURCE: { consumerTaskCategorySuffixes: ["2hive"] },
  },
};

const index = {
  contentHash: "index-hash",
  entries: [
    {
      consumerTaskId: "144134",
      readOccurrenceId: "read:titans",
      qualifiedName: "titans_dm.trd_otc_trade",
      identityStatus: "CONFIRMED",
      candidates: [],
      gaps: [
        {
          gapId: "no-writer",
          reasonCode: "NO_KNOWN_WRITE_OBSERVATION",
          message: "",
          details: {},
        },
      ],
    },
    {
      consumerTaskId: "144134",
      readOccurrenceId: "read:ingest",
      qualifiedName: "source_schema.example_table",
      identityStatus: "CONFIRMED",
      candidates: [],
      gaps: [],
    },
    {
      consumerTaskId: "consumer",
      readOccurrenceId: "read:open",
      qualifiedName: "dm.trades",
      identityStatus: "CONFIRMED",
      candidates: [{ taskId: "writer", writeObservationId: "w1" }],
      gaps: [],
    },
    {
      consumerTaskId: "consumer",
      readOccurrenceId: "read:unknown",
      qualifiedName: "titans_dm.ref",
      identityStatus: "UNKNOWN",
      candidates: [],
      gaps: [],
    },
  ],
} as unknown as UnionContinuationIndex;

describe("published source endpoint boundary", () => {
  it("marks titans_dm reads with confirmed identity and no candidates", () => {
    const read = classifySourceEndpointBoundaryRead(
      index.entries[0]!,
      config,
      () => "sparkIndex",
      "cfg",
    );
    expect(read).toMatchObject({
      readOccurrenceId: "read:titans",
      role: "TITANS_SOURCE",
      evidenceRefs: [expect.stringContaining("titans_dm.")],
    });
    expect(
      classifySourceEndpointBoundaryRead(
        index.entries[2]!,
        config,
        () => "sparkIndex",
        "cfg",
      ),
    ).toBeNull();
  });

  it("marks *2hive ingest reads as source endpoints", () => {
    const read = classifySourceEndpointBoundaryRead(
      index.entries[1]!,
      config,
      () => "oracle2hive",
      "cfg",
    );
    expect(read).toMatchObject({
      readOccurrenceId: "read:ingest",
      role: "INGEST_SOURCE",
    });
    expect(
      classifySourceEndpointBoundaryRead(
        index.entries[1]!,
        config,
        () => "sparkIndex",
        "cfg",
      ),
    ).toBeNull();
  });

  it("binds the snapshot to INDEX and frozen config", () => {
    const snapshot = buildSourceEndpointBoundarySnapshot({
      index,
      config,
      taskCategoryFor: (taskId) =>
        taskId === "144134" ? "oracle2hive" : "sparkIndex",
      unionTaskIds: new Set(["consumer"]),
      catalog: null,
    });
    expect(snapshot.reads.map((read) => read.readOccurrenceId)).toEqual([
      "read:ingest",
      "read:titans",
    ]);
    expect(() =>
      assertSourceEndpointBoundarySnapshot(
        snapshot,
        index.contentHash,
        snapshot.contentHash,
      ),
    ).not.toThrow();
    expect(
      sourceEndpointBoundaryConfigHash({ ...config, version: "2" }),
    ).not.toBe(snapshot.configHash);
  });

  it("provides explicit graph terminal metadata", () => {
    expect(
      sourceEndpointBoundaryNodeDetails(
        "titans_dm.trd_otc_trade",
        "sparkIndex",
        config,
      ),
    ).toMatchObject({
      continuationDisposition: "SOURCE_ENDPOINT_BOUNDARY",
      boundaryRole: "TITANS_SOURCE",
      terminalReason: "源端点边界，停止展开",
    });
    expect(
      sourceEndpointBoundaryNodeDetails("dm.trades", "sparkIndex", config),
    ).toBeNull();
    expect(loadGraphSourceEndpointBoundary().roles.TITANS_SOURCE).toBeDefined();
  });
});
