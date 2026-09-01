import { describe, expect, it } from "vitest";

import type { CausalAssessment } from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-assessment.ts";
import type {
  CandidateBranch,
  CandidateUniverse,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/candidate-universe.ts";
import { buildAssessmentPairSkeleton } from "../../scripts/reconcile/consumer/target-field-causal-slice/candidate-universe.ts";
import {
  generateRerunSets,
  validateRerunInputs,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/rerun-sets.ts";
import type { RootCriterion } from "../../scripts/reconcile/consumer/target-field-causal-slice/write-scoped-plan-inputs.ts";

const ROOT_ONE = "root.field.one";
const ROOT_TWO = "root.field.two";

function criterion(
  rootTargetFieldId: string,
  writeOrdinal: number,
): RootCriterion {
  const rootWriteObservationId = `write:root:${writeOrdinal}`;
  return {
    rootCriterionId: `root-criterion:${rootWriteObservationId}:${rootTargetFieldId}`,
    rootTaskId: "root-task",
    targetTableKey: "hive|warehouse|demo.root",
    targetFieldName: rootTargetFieldId,
    rootTargetFieldId,
    targetFieldBindingId: `field:${rootTargetFieldId}`,
    rootWriteObservationId,
    writeKind: "INSERT",
    sqlSourceId: "sql:root",
    sqlSnapshot: "task-sql.sql",
    sqlSha256: "sha256",
    writeStatementId: `write-statement:${writeOrdinal}`,
    writeStatementIndex: writeOrdinal,
    statementId: `statement:${writeOrdinal}`,
    statementIndex: writeOrdinal,
    queryProducerStatementId: `query-statement:${writeOrdinal}`,
    rootRelationId: `relation:${writeOrdinal}`,
    outputExpressionId: `expression:${writeOrdinal}`,
    outputBindingId: `binding:${writeOrdinal}`,
    sourceOrdinal: 0,
    targetOrdinal: 0,
    producerOutputName: rootTargetFieldId,
    expressionRole: "PROJECT_EXPRESSION",
    localRootRelationId: "root",
    localOutputExpressionId: "root:expression:project_expression:0",
    evidenceRefs: [rootWriteObservationId],
  };
}

const CRITERION_ONE = criterion(ROOT_ONE, 0);
const CRITERION_TWO = criterion(ROOT_TWO, 1);

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
  rootCriterion: RootCriterion,
  candidate: CandidateBranch,
  status: CausalAssessment["status"],
  id: string,
  refs: Partial<Pick<CausalAssessment, "positiveProofIds" | "negativeProofIds" | "gapRefs">> = {},
): CausalAssessment {
  const pair = buildAssessmentPairSkeleton([rootCriterion], [candidate])[0]!;
  return {
    assessmentId: id,
    pairId: pair.pairId,
    rootCriterionId: rootCriterion.rootCriterionId,
    rootTargetFieldId: rootCriterion.rootTargetFieldId,
    candidateBranchId: candidate.candidateBranchId,
    status,
    reasonCode: status === "UNKNOWN" ? "BRANCH_BOUNDARY_UNRESOLVED" : "CONTINUOUS_CONFIRMED_PATH",
    positiveProofIds: refs.positiveProofIds ?? [],
    negativeProofIds: refs.negativeProofIds ?? [],
    gapRefs: refs.gapRefs ?? [],
  };
}

describe("rerun sets", () => {
  it("groups one task but preserves multiple root-criterion/branch reasons", () => {
    const source = branch("branch:source", "PHYSICAL_PRODUCER");
    const result = generateRerunSets({
      candidateUniverse: universe([source]),
      rootCriteria: [CRITERION_ONE, CRITERION_TWO],
      assessments: [
        assessment(CRITERION_TWO, source, "CONFIRMED_RELATED", "assessment:two", {
          positiveProofIds: ["proof:two"],
        }),
        assessment(CRITERION_ONE, source, "CONFIRMED_RELATED", "assessment:one", {
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
    expect(result.minimumConfirmed.entries[0]?.triggers.map((item) => item.rootCriterionId)).toEqual([
      CRITERION_ONE.rootCriterionId,
      CRITERION_TWO.rootCriterionId,
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
      rootCriteria: [CRITERION_ONE],
      assessments: [
        assessment(CRITERION_ONE, source, "UNKNOWN", "assessment:unknown", {
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
            rootCriterionId: CRITERION_ONE.rootCriterionId,
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

  it("retains sibling write triggers when the physical target field is identical", () => {
    const source = branch("branch:source", "PHYSICAL_PRODUCER");
    const sibling = criterion(ROOT_ONE, 2);
    const result = generateRerunSets({
      candidateUniverse: universe([source]),
      rootCriteria: [CRITERION_ONE, sibling],
      assessments: [
        assessment(CRITERION_ONE, source, "CONFIRMED_RELATED", "assessment:first"),
        assessment(sibling, source, "CONFIRMED_RELATED", "assessment:sibling"),
      ],
    });

    const triggers = result.minimumConfirmed.entries[0]?.triggers ?? [];
    expect(triggers).toHaveLength(2);
    expect(new Set(triggers.map((trigger) => trigger.rootTargetFieldId))).toEqual(
      new Set([ROOT_ONE]),
    );
    expect(new Set(triggers.map((trigger) => trigger.rootCriterionId))).toEqual(
      new Set([CRITERION_ONE.rootCriterionId, sibling.rootCriterionId]),
    );
  });

  it("never includes PROVEN_UNRELATED and validates status/branch references", () => {
    const unrelated = branch("branch:unrelated", "SCHEDULE_ONLY");
    const confirmed = assessment(CRITERION_ONE, unrelated, "PROVEN_UNRELATED", "assessment:no");
    const result = generateRerunSets({
      candidateUniverse: universe([unrelated]),
      rootCriteria: [CRITERION_ONE],
      assessments: [confirmed],
    });
    expect(result.minimumConfirmed.entries).toEqual([]);
    expect(result.conservativeSafety.entries).toEqual([]);

    const invalid = validateRerunInputs(
      universe([unrelated]),
      [CRITERION_ONE],
      [
        { ...confirmed, status: "NOT_A_STATUS" as CausalAssessment["status"] },
        { ...assessment(CRITERION_ONE, branch("branch:missing", "PHYSICAL_PRODUCER"), "UNKNOWN", "assessment:missing") },
      ],
    );
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toEqual(expect.arrayContaining([
      "ASSESSMENT_STATUS_INVALID:assessment:no:NOT_A_STATUS",
      "CANDIDATE_BRANCH_REFERENCE_DANGLING:assessment:missing:branch:missing",
      expect.stringContaining("ASSESSMENT_PAIR_UNEXPECTED:assessment:missing:"),
    ]));
  });

  it("rejects a missing root-field by candidate-branch assessment pair", () => {
    const source = branch("branch:source", "PHYSICAL_PRODUCER");
    expect(() => generateRerunSets({
      candidateUniverse: universe([source]),
      rootCriteria: [CRITERION_ONE, CRITERION_TWO],
      assessments: [
        assessment(CRITERION_ONE, source, "UNKNOWN", "assessment:one", {
          gapRefs: ["gap:one"],
        }),
      ],
    })).toThrow(/ASSESSMENT_PAIR_CARDINALITY/);
  });
});
