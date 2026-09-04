import { describe, expect, it } from "vitest";

import type { UnionContinuationIndexCandidate } from "../../../../scripts/reconcile/consumer/target-table-upstream-causal-closure/union-continuation-candidate-source.ts";
import { applyScheduleWhitelist } from "../../../../scripts/project-graph/field-evidence-v1/continuation/rules/schedule-whitelist.ts";
import { continuationCandidateFromIndex } from "../../../../scripts/project-graph/field-evidence-v1/continuation/types.ts";
import { DEFAULT_CONTINUATION_POLICY } from "../../../../scripts/project-graph/field-evidence-v1/continuation/policy.ts";
import {
  createHoraeScheduleRelationLookupFromScheduleEdges,
} from "../../../../scripts/project-graph/field-evidence-v1/schedule-preference.ts";

function indexCandidate(
  overrides: Partial<UnionContinuationIndexCandidate> = {},
): UnionContinuationIndexCandidate {
  return {
    taskId: "producer-a",
    writeObservationId: "write-observation:producer-a:0",
    targetWriteNodeId: "target-write:producer-a:0",
    datasetNodeId: "dataset:example",
    qualifiedName: "warehouse.example_table",
    source: "IN_UNION_FINAL_WRITE",
    partitionMatchStatus: "UNKNOWN",
    partition: [],
    evidenceLayer: "L2",
    l1Eligible: false,
    ...overrides,
  };
}

describe("schedule-whitelist rule", () => {
  it("prunes cross-task candidates outside the Horae whitelist", () => {
    const lookup = createHoraeScheduleRelationLookupFromScheduleEdges([
      { consumerTaskId: "176827", producerTaskId: "121574" },
    ]);
    const candidates = [
      indexCandidate({ taskId: "121574", writeObservationId: "write-observation:121574:0" }),
      indexCandidate({ taskId: "121573", writeObservationId: "write-observation:121573:0" }),
    ].map(continuationCandidateFromIndex);

    const result = applyScheduleWhitelist({
      consumerTaskId: "176827",
      candidates,
      ports: {
        scheduleLookup: lookup,
        producerIndex: null,
        readScopeFor: () => ({ kind: "UNAVAILABLE", reasonCode: "READ_SCOPE_UNAVAILABLE" }),
        tableIdentityFor: (qualifiedName) => ({
          platform: "warehouse",
          dataSource: "default",
          qualifiedName,
        }),
      },
      policy: DEFAULT_CONTINUATION_POLICY,
    });

    expect(result.map((candidate) => candidate.index.taskId)).toEqual(["121574"]);
    expect(result.every((candidate) => candidate.continuationEligible === false)).toBe(true);
  });

  it("does not prune when Horae lookup is unavailable", () => {
    const candidates = [
      indexCandidate({ taskId: "121574" }),
      indexCandidate({ taskId: "121573", writeObservationId: "write-observation:121573:0" }),
    ].map(continuationCandidateFromIndex);

    const result = applyScheduleWhitelist({
      consumerTaskId: "176827",
      candidates,
      ports: {
        scheduleLookup: null,
        producerIndex: null,
        readScopeFor: () => ({ kind: "UNAVAILABLE", reasonCode: "READ_SCOPE_UNAVAILABLE" }),
        tableIdentityFor: (qualifiedName) => ({
          platform: "warehouse",
          dataSource: "default",
          qualifiedName,
        }),
      },
      policy: DEFAULT_CONTINUATION_POLICY,
    });

    expect(result).toHaveLength(2);
  });
});
