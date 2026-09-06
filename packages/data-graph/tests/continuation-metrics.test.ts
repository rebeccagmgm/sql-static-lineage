import { describe, expect, it } from "vitest";
import {
  calculateContinuationMetrics,
  classifyContinuationGaps,
  classifyContinuationRead,
} from "../src/asset-graph/continuation-metrics.ts";
import type {
  UnionContinuationIndex,
  UnionContinuationIndexEntry,
} from "../src/project-graph/topology/task-local-union/union-continuation-index.ts";

function entry(
  id: string,
  candidates: UnionContinuationIndexEntry["candidates"] = [],
  gaps: UnionContinuationIndexEntry["gaps"] = [],
): UnionContinuationIndexEntry {
  return {
    consumerTaskId: "consumer",
    readOccurrenceId: id,
    readOccurrenceNodeId: `read:${id}`,
    datasetNodeId: `dataset:${id}`,
    qualifiedName: `db.table_${id}`,
    identityStatus: "CONFIRMED",
    partitionPredicateStatus: "NONE",
    candidates,
    prunedWriteObservationIds: [],
    gaps,
  };
}

function candidate(
  id: string,
  status: "CONFIRMED" | "ASSUMED" | "UNKNOWN" | "DISJOINT",
  source:
    "IN_UNION_FINAL_WRITE" | "PRODUCER_INDEX_ONLY" = "IN_UNION_FINAL_WRITE",
  l1Eligible = status === "CONFIRMED" && source === "IN_UNION_FINAL_WRITE",
) {
  return {
    taskId: "writer",
    writeObservationId: id,
    targetWriteNodeId: `target:${id}`,
    datasetNodeId: "dataset",
    qualifiedName: "db.table",
    source,
    partitionMatchStatus: status,
    partition: [],
    evidenceLayer: l1Eligible ? ("L1" as const) : ("L2" as const),
    l1Eligible,
  };
}

function index(
  entries: readonly UnionContinuationIndexEntry[],
): UnionContinuationIndex {
  return {
    schemaVersion: "1.0.0",
    artifactType: "UNION_CONTINUATION_INDEX",
    generatedAt: "now",
    input: {
      batchManifestRef: { path: "x", contentHash: "x" },
      producerIndex: { contentHash: "x", inputFingerprint: "x" },
      taskProjections: [],
    },
    entries,
    contentHash: "x",
  };
}

describe("calculateContinuationMetrics", () => {
  const policy = (id: string, task = "consumer") => ({
    consumerTaskId: task,
    readOccurrenceId: id,
    qualifiedName: "db.table",
    role: "REFERENCE_CONFIG",
    ruleRef: "config#roles.REFERENCE_CONFIG",
  });

  it("keeps INDEX total reads while excluding policy terminals from continuation metrics", () => {
    const terminal = entry("terminal", [], [{ gapId: "p", reasonCode: "PARTITION_NO_MATCH", message: "", details: {} }]);
    const result = calculateContinuationMetrics({ index: index([terminal, entry("open", [candidate("w", "CONFIRMED")])]), policyTerminals: [policy("terminal")] });
    expect(result.totalReadOccurrences).toBe(2);
    expect(result.policyTerminalReadOccurrences).toBe(1);
    expect(result.withinUnionReadOccurrences).toBe(1);
    expect(result.gapGroups.actionable.gapCount).toBe(0);
  });

  it("retains independent material gaps and does not apply policy to unknown identity", () => {
    const material = entry("material", [], [{ gapId: "m", reasonCode: "READ_IDENTITY_NOT_CONFIRMED", message: "", details: {} }]);
    const unknown = { ...entry("unknown"), identityStatus: "UNKNOWN" } as UnionContinuationIndexEntry;
    const result = calculateContinuationMetrics({ index: index([material, unknown]), policyTerminals: [policy("material"), policy("unknown")] });
    expect(result.policyTerminalReadOccurrences).toBe(1);
    expect(result.gapGroups.material.reasonCodeCounts.READ_IDENTITY_NOT_CONFIRMED).toBe(1);
    expect(result.withinUnionReadOccurrences).toBe(1);
  });

  it("keeps no-catalog reads unclassified and explicit boundary only excludes that read", () => {
    const result = calculateContinuationMetrics({
      index: index([entry("boundary"), entry("unknown")]),
      boundaryEvidence: {
        sourceEndpointBoundaryReadOccurrenceIds: ["boundary"],
      },
    });
    expect(result.confirmedSourceBoundaryReadOccurrences).toBe(1);
    expect(result.unclassifiedNoWriterReadOccurrences).toBe(1);
    expect(result.totalReadOccurrences).toBe(2);
  });

  it("counts expected writer missing but retains it in the denominator", () => {
    const result = calculateContinuationMetrics({
      index: index([
        entry("missing"),
        entry("l1", [candidate("w", "CONFIRMED")]),
      ]),
      boundaryEvidence: { expectedWriterMissingReadOccurrenceIds: ["missing"] },
    });
    expect(result.noKnownWriterReadOccurrences).toBe(1);
    expect(result.withinUnionReadOccurrences).toBe(2);
    expect(result.withinUnionConfirmationRate).toBe(0.5);
  });

  it("handles mixed candidates, all disjoint, duplicate gaps, and zero denominator", () => {
    const mixed = entry(
      "mixed",
      [
        candidate("a", "CONFIRMED"),
        candidate("b", "ASSUMED"),
        candidate("c", "DISJOINT"),
      ],
      [
        {
          gapId: "g1",
          reasonCode: "WRITER_PARTITION_UNKNOWN",
          message: "",
          details: {},
        },
        {
          gapId: "g2",
          reasonCode: "WRITER_PARTITION_UNKNOWN",
          message: "",
          details: {},
        },
      ],
    );
    const result = calculateContinuationMetrics({
      index: index([mixed, entry("disjoint", [candidate("d", "DISJOINT")])]),
    });
    expect(result.withinUnionReadOccurrences).toBe(2);
    expect(result.anyL1ReadOccurrences).toBe(1);
    expect(result.fullyL1ReadOccurrences).toBe(0);
    expect(result.gapGroups.actionable.readOccurrenceCount).toBe(1);
    expect(result.gapGroups.actionable.gapCount).toBe(2);
    expect(
      result.gapGroups.actionable.reasonCodeCounts.WRITER_PARTITION_UNKNOWN,
    ).toBe(2);
    expect(
      calculateContinuationMetrics({
        index: index([entry("x", [candidate("d", "DISJOINT")])]),
      }).withinUnionConfirmationRate,
    ).toBe(0);
  });

  it("counts a reliable source boundary gap before excluding it from the denominator", () => {
    const boundary = entry(
      "boundary",
      [],
      [
        {
          gapId: "no-writer",
          reasonCode: "NO_KNOWN_WRITE_OBSERVATION",
          message: "",
          details: {},
        },
      ],
    );
    const result = calculateContinuationMetrics({
      index: index([boundary]),
      boundaryEvidence: {
        sourceEndpointBoundaryReadOccurrenceIds: ["boundary"],
      },
    });
    expect(result.withinUnionReadOccurrences).toBe(0);
    expect(result.withinUnionConfirmationRate).toBeNull();
    expect(result.gapGroups.boundary).toEqual({
      gapCount: 1,
      readOccurrenceCount: 1,
      reasonCodeCounts: { SOURCE_ENDPOINT_BOUNDARY: 1 },
    });
  });

  it("retains identity-unknown and conflicting boundary evidence in the denominator", () => {
    const identityUnknown = {
      ...entry(
        "identity-unknown",
        [],
        [
          {
            gapId: "identity",
            reasonCode: "READ_IDENTITY_NOT_CONFIRMED",
            message: "",
            details: {},
          },
        ],
      ),
      identityStatus: "UNKNOWN",
    } as UnionContinuationIndexEntry;
    const conflicting = entry("conflicting");
    const result = calculateContinuationMetrics({
      index: index([identityUnknown, conflicting]),
      boundaryEvidence: {
        sourceEndpointBoundaryReadOccurrenceIds: [
          "identity-unknown",
          "conflicting",
        ],
        expectedWriterMissingReadOccurrenceIds: ["conflicting"],
      },
    });
    expect(
      classifyContinuationRead(identityUnknown, {
        sourceEndpointBoundaryReadOccurrenceIds: ["identity-unknown"],
      }),
    ).toBeNull();
    expect(
      classifyContinuationRead(conflicting, {
        sourceEndpointBoundaryReadOccurrenceIds: ["conflicting"],
        expectedWriterMissingReadOccurrenceIds: ["conflicting"],
      }),
    ).toBeNull();
    expect(result.confirmedSourceBoundaryReadOccurrences).toBe(0);
    expect(result.withinUnionReadOccurrences).toBe(2);
    expect(
      result.gapGroups.material.reasonCodeCounts.READ_IDENTITY_NOT_CONFIRMED,
    ).toBe(1);
  });

  it("requires the complete L1 contract and retains untrusted boundary gaps as unclassified", () => {
    const invalid = entry("invalid", [
      {
        ...candidate("w", "CONFIRMED", "IN_UNION_FINAL_WRITE", true),
        targetWriteNodeId: null,
      },
    ]);
    expect(classifyContinuationRead(invalid)).toBeNull();
    const result = calculateContinuationMetrics({ index: index([invalid]) });
    expect(result.anyL1ReadOccurrences).toBe(0);
    expect(result.fullyL1ReadOccurrences).toBe(0);
    const blankTarget = entry("blank-target", [
      { ...candidate("blank", "CONFIRMED"), targetWriteNodeId: "   " },
    ]);
    expect(
      calculateContinuationMetrics({ index: index([blankTarget]) })
        .fullyL1ReadOccurrences,
    ).toBe(0);
    const untrusted = entry(
      "u",
      [],
      [
        {
          gapId: "g",
          reasonCode: "SOURCE_ENDPOINT_BOUNDARY" as never,
          message: "",
          details: {},
        },
      ],
    );
    expect(classifyContinuationGaps(untrusted)).toEqual([
      { reasonCode: "SOURCE_ENDPOINT_BOUNDARY", group: "unclassified" },
    ]);
    expect(
      calculateContinuationMetrics({
        index: index([untrusted]),
        boundaryEvidence: { sourceEndpointBoundaryReadOccurrenceIds: ["u"] },
      }).withinUnionConfirmationRate,
    ).toBeNull();
    expect(
      calculateContinuationMetrics({ index: index([]) })
        .continuationEdgeMetrics,
    ).toBeNull();
  });
});
