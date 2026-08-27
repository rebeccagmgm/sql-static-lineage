import { describe, expect, it } from "vitest";

import type { CausalAssessment } from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-assessment.ts";
import type {
  CandidateBranch,
  CandidateUniverse,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/candidate-universe.ts";
import {
  generateRerunSets,
  validateRerunInputs,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/rerun-sets.ts";

const ROOT_ONE = "root.field.one";
const ROOT_TWO = "root.field.two";

function branch(
  candidateBranchId: string,
  branchKind: CandidateBranch["branchKind"],
  overrides: Partial<CandidateBranch> = {},
): CandidateBranch {
  return {
    candidateBranchId,
    branchKind,
    rootTaskId: "root-task",
    consumerTaskId: "consumer-task",
    producerTaskId: "producer-task",
    table: null,
    readOccurrence: null,
    producerRole: null,
    evidenceRefs: [],
    gapRefs: [],
    boundaryReason: null,
    ...overrides,
  };
}

function universe(branches: readonly CandidateBranch[]): CandidateUniverse {
  return {
    rootTaskId: "root-task",
    status: "COMPLETE_OBSERVED_EVIDENCE",
    branches,
    boundaryGapRefs: [],
    coverage: {
      sourceArtifactType: "TABLE_MULTI_HOP_RECONCILIATION",
      sourceCoverageStatus: "COMPLETE_OBSERVED_EVIDENCE",
      sourceCoverageSemantics: "OBSERVED_EVIDENCE_ONLY",
      sourceLimitsTruncated: false,
    },
  };
}

function assessment(
  rootTargetFieldId: string,
  candidateBranchId: string,
  status: CausalAssessment["status"],
  id: string,
  refs: Partial<Pick<CausalAssessment, "positiveProofIds" | "negativeProofIds" | "gapRefs">> = {},
): CausalAssessment {
  return {
    assessmentId: id,
    pairId: `pair:${id}`,
    rootTargetFieldId,
    candidateBranchId,
    status,
    reasonCode: status === "UNKNOWN" ? "BRANCH_BOUNDARY_UNRESOLVED" : "CONTINUOUS_CONFIRMED_PATH",
    positiveProofIds: refs.positiveProofIds ?? [],
    negativeProofIds: refs.negativeProofIds ?? [],
    gapRefs: refs.gapRefs ?? [],
  };
}

describe("rerun sets", () => {
  it("groups one task but preserves multiple root-field/branch reasons", () => {
    const source = branch("branch:source", "PHYSICAL_PRODUCER");
    const result = generateRerunSets({
      candidateUniverse: universe([source]),
      rootTargetFieldIds: [ROOT_ONE, ROOT_TWO],
      assessments: [
        assessment(ROOT_TWO, source.candidateBranchId, "CONFIRMED_RELATED", "assessment:two", {
          positiveProofIds: ["proof:two"],
        }),
        assessment(ROOT_ONE, source.candidateBranchId, "CONFIRMED_RELATED", "assessment:one", {
          positiveProofIds: ["proof:one"],
        }),
      ],
    });

    expect(result.minimumConfirmed.taskIds).toEqual(["producer-task"]);
    expect(result.minimumConfirmed.entries).toHaveLength(1);
    expect(result.minimumConfirmed.entries[0]?.triggers.map((item) => item.rootTargetFieldId)).toEqual([
      ROOT_ONE,
      ROOT_TWO,
    ]);
    expect(result.minimumConfirmed.entries[0]?.triggers[0]?.positiveProofIds).toEqual([
      "proof:one",
    ]);
  });

  it("emits an explicit unresolved entry when a required producer task is absent", () => {
    const source = branch("branch:unresolved", "PHYSICAL_PRODUCER", {
      producerTaskId: null,
    });
    const result = generateRerunSets({
      candidateUniverse: universe([source]),
      rootTargetFieldIds: [ROOT_ONE],
      assessments: [
        assessment(ROOT_ONE, source.candidateBranchId, "UNKNOWN", "assessment:unknown", {
          gapRefs: ["gap:producer-task"],
        }),
      ],
    });

    expect(result.conservativeSafety.taskIds).toEqual([]);
    expect(result.conservativeSafety.unresolved).toEqual([
      {
        taskId: null,
        unresolvedReason: "PHYSICAL_PRODUCER_TASK_ID_UNRESOLVED",
        triggers: [
          {
            rootTargetFieldId: ROOT_ONE,
            candidateBranchId: source.candidateBranchId,
            assessmentId: "assessment:unknown",
            causalStatus: "UNKNOWN",
            positiveProofIds: [],
            negativeProofIds: [],
            gapRefs: ["gap:producer-task"],
          },
        ],
      },
    ]);
  });

  it("never includes PROVEN_UNRELATED and validates status/branch references", () => {
    const unrelated = branch("branch:unrelated", "SCHEDULE_ONLY");
    const confirmed = assessment(ROOT_ONE, unrelated.candidateBranchId, "PROVEN_UNRELATED", "assessment:no");
    const result = generateRerunSets({
      candidateUniverse: universe([unrelated]),
      rootTargetFieldIds: [ROOT_ONE],
      assessments: [confirmed],
    });
    expect(result.minimumConfirmed.entries).toEqual([]);
    expect(result.conservativeSafety.entries).toEqual([]);

    const invalid = validateRerunInputs(
      universe([unrelated]),
      [ROOT_ONE],
      [
        { ...confirmed, status: "NOT_A_STATUS" as CausalAssessment["status"] },
        { ...assessment(ROOT_ONE, "branch:missing", "UNKNOWN", "assessment:missing") },
      ],
    );
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toEqual([
      "ASSESSMENT_STATUS_INVALID:assessment:no:NOT_A_STATUS",
      "CANDIDATE_BRANCH_REFERENCE_DANGLING:assessment:missing:branch:missing",
    ]);
  });

  it("rejects a missing root-field by candidate-branch assessment pair", () => {
    const source = branch("branch:source", "PHYSICAL_PRODUCER");
    expect(() => generateRerunSets({
      candidateUniverse: universe([source]),
      rootTargetFieldIds: [ROOT_ONE, ROOT_TWO],
      assessments: [
        assessment(ROOT_ONE, source.candidateBranchId, "UNKNOWN", "assessment:one", {
          gapRefs: ["gap:one"],
        }),
      ],
    })).toThrow(/ASSESSMENT_PAIR_CARDINALITY/);
  });
});
