import { describe, expect, it } from "vitest";

import { createContinuationPorts } from "../../../../scripts/project-graph/field-evidence-v1/impact-query-harness.ts";
import type { TableProducerIndex } from "../../../../scripts/reconcile/producer/producer-index.ts";
import {
  createHoraeScheduleRelationLookupFromScheduleEdges,
} from "../../../../scripts/project-graph/field-evidence-v1/schedule-preference.ts";

function emptyProducerIndex(): TableProducerIndex {
  return {
    schemaVersion: "1.0.0",
    artifactType: "TABLE_PRODUCER_INDEX",
    generatedAt: "2026-09-04T00:00:00.000Z",
    contentHash: "test-hash",
    inputFingerprint: "test-fingerprint",
    confirmedProducerEdges: [],
    nonConfirmedRelations: [],
  } as unknown as TableProducerIndex;
}

describe("continuation read scope from task category", () => {
  it("emits SOURCE_ENDPOINT_BOUNDARY for *2hive when PI has no writers", () => {
    const ports = createContinuationPorts({
      scheduleRelationLookup: createHoraeScheduleRelationLookupFromScheduleEdges([]),
      producerIndex: emptyProducerIndex(),
      factsBundleForTask: () => ({ relationNodes: [], relationEdges: [] }),
      taskCategoryFor: () => "oracle2hive",
    });
    expect(ports.readScopeFor({
      consumerTaskId: "consumer-sync",
      readOccurrenceId: "read:consumer-sync:0",
      qualifiedName: "source_schema.example_table",
    })).toEqual({
      kind: "UNAVAILABLE",
      reasonCode: "SOURCE_ENDPOINT_BOUNDARY",
    });
  });

  it("keeps READ_SCOPE_UNAVAILABLE for native Hive compute when PI has no writers", () => {
    const ports = createContinuationPorts({
      scheduleRelationLookup: createHoraeScheduleRelationLookupFromScheduleEdges([]),
      producerIndex: emptyProducerIndex(),
      factsBundleForTask: () => ({ relationNodes: [], relationEdges: [] }),
      taskCategoryFor: () => "sparkIndex",
    });
    expect(ports.readScopeFor({
      consumerTaskId: "consumer-hive",
      readOccurrenceId: "read:consumer-hive:0",
      qualifiedName: "schema.example_table",
    })).toEqual({
      kind: "UNAVAILABLE",
      reasonCode: "READ_SCOPE_UNAVAILABLE",
    });
  });
});
