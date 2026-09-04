import { describe, expect, it } from "vitest";

import {
  type ProducerWriteObservation,
  type TableProducerIndex,
} from "../../../../scripts/reconcile/producer/producer-index.ts";
import { matchProducersByReadScope } from "../../../../scripts/query/producer-index-query.ts";
import { applyPartitionRematch } from "../../../../scripts/project-graph/field-evidence-v1/continuation/rules/partition-rematch.ts";
import { continuationCandidateFromIndex } from "../../../../scripts/project-graph/field-evidence-v1/continuation/types.ts";
import type { UnionContinuationIndexCandidate } from "../../../../scripts/reconcile/consumer/target-table-upstream-causal-closure/union-continuation-candidate-source.ts";

function indexCandidate(
  overrides: Partial<UnionContinuationIndexCandidate> = {},
): UnionContinuationIndexCandidate {
  return {
    taskId: "producer-a",
    writeObservationId: "write-observation:producer-a:0",
    targetWriteNodeId: "target-write:producer-a:0",
    datasetNodeId: "dataset:example",
    qualifiedName: "pdata.example_table",
    source: "IN_UNION_FINAL_WRITE",
    partitionMatchStatus: "UNKNOWN",
    partition: [],
    evidenceLayer: "L2",
    l1Eligible: false,
    ...overrides,
  };
}

function minimalProducerIndex(): TableProducerIndex {
  const write: ProducerWriteObservation = {
    observationKind: "SQL_EXPLICIT_WRITE",
    declaredWriteMode: null,
    sqlWriteKind: "INSERT_OVERWRITE",
    partition: [{
      field: "busi_date",
      expression: "${busi_date}",
      observedValue: null,
      valueStatus: "RUNTIME_EXPRESSION",
    }],
    partitionStatus: "COMPLETE",
    operationClass: "PLATFORM_TRANSFER",
    dataPathRole: "PRODUCER",
    evidence: [],
  };
  return {
    schemaVersion: "1.0.0",
    artifactType: "TABLE_PRODUCER_INDEX",
    generatedAt: "2026-09-04T00:00:00.000Z",
    contentHash: "test-hash",
    inputFingerprint: "test-fingerprint",
    confirmedProducerEdges: [{
      taskId: "producer-a",
      taskCategory: "sparkIndex",
      taskContentHash: "task-hash",
      table: {
        platform: "pdata",
        dataSource: "default",
        qualifiedName: "example_table",
        identityStatus: "RESOLVED",
      },
      writes: [write],
    }],
    nonConfirmedRelations: [],
  } as unknown as TableProducerIndex;
}

describe("partition-rematch rule", () => {
  it("marks runtime template equal overlap as PROVEN_OVERLAP via matchProducersByReadScope", () => {
    const producerIndex = minimalProducerIndex();
    const table = {
      platform: "pdata",
      dataSource: "default",
      qualifiedName: "example_table",
    };
    const readScope = {
      status: "CONSTRAINED" as const,
      partitionFields: ["busi_date"],
      predicate: {
        kind: "ATOM" as const,
        field: "busi_date",
        operator: "EQ" as const,
        values: [{
          kind: "RUNTIME_EXPRESSION" as const,
          expression: "${busi_date}",
          observedValue: null,
        }],
      },
      reasonCodes: [],
      evidence: [],
    };
    const matches = matchProducersByReadScope(producerIndex, table, readScope);
    expect(matches[0]?.status).toBe("PROVEN_OVERLAP");

    const result = applyPartitionRematch({
      consumerTaskId: "consumer-1",
      readOccurrenceId: "read:consumer-1:0",
      column: "amount",
      qualifiedName: "pdata.example_table",
      candidates: [continuationCandidateFromIndex(indexCandidate())],
      ports: {
        scheduleLookup: null,
        producerIndex,
        readScopeFor: () => ({ kind: "OK", scope: readScope }),
        tableIdentityFor: () => table,
        taskCategoryFor: () => "sparkIndex",
      },
    });

    expect(result.gaps).toEqual([]);
    expect(result.candidates[0]?.partitionOverlap).toBe("PROVEN_OVERLAP");
  });

  it("skips rematch without crashing when producer index is missing", () => {
    const result = applyPartitionRematch({
      consumerTaskId: "consumer-1",
      readOccurrenceId: "read:consumer-1:0",
      column: "amount",
      qualifiedName: "pdata.example_table",
      candidates: [continuationCandidateFromIndex(indexCandidate())],
      ports: {
        scheduleLookup: null,
        producerIndex: null,
        readScopeFor: () => ({ kind: "UNAVAILABLE", reasonCode: "READ_SCOPE_UNAVAILABLE" }),
        tableIdentityFor: ({ qualifiedName }) => ({
          platform: "pdata",
          dataSource: "default",
          qualifiedName,
        }),
        taskCategoryFor: () => "sparkIndex",
      },
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.gaps.some((gap) => gap.reasonCode === "PRODUCER_INDEX_UNAVAILABLE")).toBe(true);
  });

  it("surfaces SOURCE_ENDPOINT_BOUNDARY instead of inventing a hive read scope", () => {
    const result = applyPartitionRematch({
      consumerTaskId: "consumer-1",
      readOccurrenceId: "read:consumer-1:0",
      column: "amount",
      qualifiedName: "source_schema.example_table",
      candidates: [continuationCandidateFromIndex(indexCandidate())],
      ports: {
        scheduleLookup: null,
        producerIndex: minimalProducerIndex(),
        readScopeFor: () => ({ kind: "UNAVAILABLE", reasonCode: "SOURCE_ENDPOINT_BOUNDARY" }),
        tableIdentityFor: ({ qualifiedName }) => ({
          platform: "unknown",
          dataSource: "unknown",
          qualifiedName,
        }),
        taskCategoryFor: () => "oracle2hive",
      },
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.partitionOverlap).toBe("UNKNOWN");
    expect(result.gaps.map((gap) => gap.reasonCode)).toEqual(["SOURCE_ENDPOINT_BOUNDARY"]);
  });
});
