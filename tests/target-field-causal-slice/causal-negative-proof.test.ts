import { describe, expect, it } from "vitest";

import {
  assessNegativeCausalRelationships,
  validateNegativeCausalAssessments,
  type NegativeProofRequest,
  type NegativeProofObligation,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-negative-proof.ts";
import {
  buildAssessmentPairSkeleton,
  type CandidateBranch,
  type CandidateUniverse,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/candidate-universe.ts";
import { assessPositiveCausalRelationships } from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-assessment.ts";
import type {
  CausalTraversalPath,
  CausalTraversalResult,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-traversal.ts";

const ROOT_FIELD = "hive|warehouse|demo.root__warehouse|demo.root|out_a";
const SOURCE_FIELD = "hive|warehouse|demo.source__warehouse|demo.source|src_a";

const obligations: readonly NegativeProofObligation[] = [
  { kind: "VALUE", evidenceRefs: ["e:value"] },
  { kind: "CONTROL", evidenceRefs: ["e:control"] },
  { kind: "RELATION", evidenceRefs: ["e:relation"] },
];

function branch(
  id: string,
  consumerTaskId = "100",
  producerTaskId = "200",
): CandidateBranch {
  return {
    candidateBranchId: id,
    branchKind: "PHYSICAL_PRODUCER",
    rootTaskId: "100",
    consumerTaskId,
    producerTaskId,
    table: {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: "demo.source",
      stableTableId: "demo.source__warehouse",
      identityStatus: "SCHEMA_BACKED",
    },
    readOccurrence: {
      occurrenceId: `read:${id}`,
      readRelationId: `relation:${id}`,
      statementIndex: 0,
      relationPath: [`relation:${id}`],
    },
    producerRole: "PRIMARY",
    evidenceRefs: [{
      evidenceRefId: `table:${id}`,
      source: "TABLE_MULTI_HOP_RECONCILIATION",
      locator: id,
    }],
    gapRefs: [],
    boundaryReason: null,
  };
}

function universe(
  branches: readonly CandidateBranch[] = [branch("branch:a")],
  status: CandidateUniverse["status"] = "COMPLETE_OBSERVED_EVIDENCE",
): CandidateUniverse {
  return {
    rootTaskId: "100",
    status,
    branches,
    boundaryGapRefs: status === "INCOMPLETE" ? ["universe-gap"] : [],
    coverage: {
      sourceArtifactType: "TABLE_MULTI_HOP_RECONCILIATION",
      sourceCoverageStatus: status,
      sourceCoverageSemantics: "OBSERVED_EVIDENCE_ONLY",
      sourceLimitsTruncated: false,
    },
  };
}

function pathFor(candidate: CandidateBranch): CausalTraversalPath {
  return {
    pathId: `path:${candidate.candidateBranchId}`,
    rootTargetFieldId: ROOT_FIELD,
    rootDependenceKind: "VALUE_TO_TARGET",
    pathCertainty: "CONFIRMED",
    edges: [
      {
        edgeId: `edge:${candidate.candidateBranchId}`,
        fromTaskId: "200",
        toTaskId: "100",
        fromSubject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: SOURCE_FIELD },
        toSubject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: SOURCE_FIELD },
        rootDependenceKind: "VALUE_TO_TARGET",
        localEdgeKind: "VALUE_FLOW",
        frontierKind: "VALUE",
        pathCertainty: "CONFIRMED",
        dependencyId: null,
        readOccurrenceId: candidate.readOccurrence!.occurrenceId,
        evidenceRefs: ["e:path"],
      },
    ],
  };
}

function traversal(
  candidate?: CandidateBranch,
  gaps: CausalTraversalResult["gaps"] = [],
  closed = true,
): CausalTraversalResult {
  const paths = candidate ? [pathFor(candidate)] : [];
  const root = {
    root: { rootTargetFieldId: ROOT_FIELD, taskId: "100" },
    visitedStateKeys: [],
    activeCycleChecks: 0,
    frontiers: {
      VALUE: 1,
      EXPRESSION_CONTROL: 0,
      ROWSET_CONTROL: 0,
      WINDOW_CONTEXT: 0,
      RELATION_CONTEXT: 0,
    },
    paths,
    gaps,
    decision: {
      valuePathCertainty: paths.length ? "CONFIRMED" as const : null,
      controlPathCertainty: null,
      valueClosed: closed,
      controlClosed: closed,
      valueGapIds: gaps.map((gap) => gap.gapId),
      controlGapIds: [],
    },
  };
  return {
    options: {
      maxDepth: 25,
      maxValueStates: 5000,
      maxValuePaths: 10000,
      maxControlStates: 5000,
      maxControlPaths: 10000,
    },
    roots: [root],
    sharedEvidenceRefs: obligations.flatMap((obligation) => obligation.evidenceRefs),
    edges: paths.flatMap((path) => path.edges),
    gaps,
  };
}

function assessments(candidateUniverse: CandidateUniverse, causalTraversal: CausalTraversalResult) {
  return assessPositiveCausalRelationships({
    candidateUniverse,
    traversal: causalTraversal,
    assessmentPairs: buildAssessmentPairSkeleton([ROOT_FIELD], candidateUniverse.branches),
  });
}

function negative(
  candidateUniverse: CandidateUniverse,
  causalTraversal: CausalTraversalResult,
  requestOverrides: Partial<NegativeProofRequest> = {},
  knownCuts: NonNullable<Parameters<typeof assessNegativeCausalRelationships>[0]["knownCuts"]> = [],
) {
  const positive = assessments(candidateUniverse, causalTraversal);
  return assessNegativeCausalRelationships({
    candidateUniverse,
    traversal: causalTraversal,
    assessments: positive.assessments,
    negativeProofRequests: [{
      mode: "SAFE_RULES_ONLY",
      rootTargetFieldId: ROOT_FIELD,
      candidateBranchId: candidateUniverse.branches[0]!.candidateBranchId,
      checkedObligations: obligations,
      ...requestOverrides,
    }],
    knownCuts,
  });
}

describe("causal negative proof", () => {
  it("upgrades only an explicitly requested, fully closed UNKNOWN pair", () => {
    const candidateUniverse = universe();
    const result = negative(candidateUniverse, traversal());
    expect(result.assessments[0]?.status).toBe("PROVEN_UNRELATED");
    expect(result.negativeProofs[0]?.checkedObligations.map((item) => item.kind)).toEqual([
      "VALUE",
      "CONTROL",
      "RELATION",
    ]);
    expect(validateNegativeCausalAssessments(
      {
        candidateUniverse,
        traversal: traversal(),
        assessments: assessments(candidateUniverse, traversal()).assessments,
        negativeProofRequests: [{
          mode: "SAFE_RULES_ONLY",
          rootTargetFieldId: ROOT_FIELD,
          candidateBranchId: "branch:a",
          checkedObligations: obligations,
        }],
      },
      result,
    )).toEqual({ valid: true, errors: [] });
  });

  it.each([
    ["incomplete universe", universe([branch("branch:a")], "INCOMPLETE"), traversal()],
    ["traversal gap", universe(), traversal(undefined, [{
      gapId: "gap:value",
      rootTargetFieldId: ROOT_FIELD,
      taskId: "100",
      subject: null,
      rootDependenceKind: "VALUE_TO_TARGET",
      frontierKind: "VALUE",
      reasonCode: "MAX_VALUE_PATHS_REACHED",
      message: "limit",
      evidenceRefs: ["e:gap"],
      blocksNegativeProof: true,
    }])],
    ["traversal limit closure", universe(), traversal(undefined, [], false)],
  ] as const)("keeps %s UNKNOWN", (_name, candidateUniverse, causalTraversal) => {
    const request = {
      mode: "SAFE_RULES_ONLY" as const,
      rootTargetFieldId: ROOT_FIELD,
      candidateBranchId: "branch:a",
      checkedObligations: obligations,
    };
    const input = {
      candidateUniverse,
      traversal: causalTraversal,
      assessments: assessments(candidateUniverse, causalTraversal).assessments,
      negativeProofRequests: [request],
    };
    const result = assessNegativeCausalRelationships(input);
    expect(result.assessments[0]?.status).toBe("UNKNOWN");
    expect(request).toBeTruthy();
  });

  it("rejects missing obligations/evidence and never treats path absence alone as proof", () => {
    const candidateUniverse = universe();
    const input = {
      candidateUniverse,
      traversal: traversal(),
      assessments: assessments(candidateUniverse, traversal()).assessments,
      negativeProofRequests: [{
        mode: "SAFE_RULES_ONLY" as const,
        rootTargetFieldId: ROOT_FIELD,
        candidateBranchId: "branch:a",
        checkedObligations: [{ kind: "VALUE" as const, evidenceRefs: [] }],
      }],
    };
    const result = assessNegativeCausalRelationships(input);
    expect(result.negativeProofs).toHaveLength(0);
    expect(result.assessments[0]?.status).toBe("UNKNOWN");
  });

  it("does not replace a positive path or a non-UNKNOWN assessment", () => {
    const candidateUniverse = universe();
    const positiveTraversal = traversal(candidateUniverse.branches[0]);
    const positive = assessments(candidateUniverse, positiveTraversal);
    const result = assessNegativeCausalRelationships({
      candidateUniverse,
      traversal: positiveTraversal,
      assessments: positive.assessments,
      negativeProofRequests: [{
        mode: "SAFE_RULES_ONLY",
        rootTargetFieldId: ROOT_FIELD,
        candidateBranchId: "branch:a",
        checkedObligations: obligations,
      }],
    });
    expect(result.assessments[0]?.status).toBe("CONFIRMED_RELATED");
    expect(result.negativeProofs).toHaveLength(0);
  });

  it("rejects obligation references that do not exist in canonical evidence", () => {
    const candidateUniverse = universe();
    const result = negative(candidateUniverse, traversal(), {
      checkedObligations: obligations.map((obligation) => ({
        ...obligation,
        evidenceRefs: [`forged:${obligation.kind}`],
      })),
    });
    expect(result.assessments[0]?.status).toBe("UNKNOWN");
    expect(result.negativeProofs).toHaveLength(0);
  });

  it("propagates a known cut only to explicitly enumerated descendants", () => {
    const candidateUniverse = universe([
      branch("branch:a", "100", "200"),
      branch("branch:b", "200", "300"),
      branch("branch:c", "100", "400"),
    ]);
    const causalTraversal = traversal();
    const base = assessments(candidateUniverse, causalTraversal).assessments;
    const sourceRequest = {
      mode: "SAFE_RULES_ONLY" as const,
      rootTargetFieldId: ROOT_FIELD,
      candidateBranchId: "branch:a",
      checkedObligations: obligations,
    };
    const direct = assessNegativeCausalRelationships({
      candidateUniverse,
      traversal: causalTraversal,
      assessments: base,
      negativeProofRequests: [sourceRequest],
    });
    const sourceProofId = direct.negativeProofs[0]!.proofId;
    const result = assessNegativeCausalRelationships({
      candidateUniverse,
      traversal: causalTraversal,
      assessments: base,
      negativeProofRequests: [sourceRequest],
      knownCuts: [{
        rootTargetFieldId: ROOT_FIELD,
        sourceCandidateBranchId: "branch:a",
        sourceNegativeProofId: sourceProofId,
        descendantCandidateBranchIds: ["branch:b", "branch:not-enumerated"],
        structuralEvidenceRefs: ["table:branch:a", "table:branch:b"],
      }],
      existingNegativeProofs: direct.negativeProofs,
    });
    expect(result.assessments.filter((item) => item.status === "PROVEN_UNRELATED")).toHaveLength(2);
    expect(result.assessments.find((item) => item.candidateBranchId === "branch:c")?.status).toBe("UNKNOWN");
    expect(result.negativeProofs.some((proof) =>
      proof.reasonCode === "INHERITED_FROM_PROVEN_UNRELATED_CUT" &&
      proof.candidateBranchId === "branch:b",
    )).toBe(true);
  });

  it("reports malformed negative proof IDs and references", () => {
    const candidateUniverse = universe();
    const causalTraversal = traversal();
    const originalAssessments = assessments(candidateUniverse, causalTraversal).assessments;
    const input = {
      candidateUniverse,
      traversal: causalTraversal,
      assessments: originalAssessments,
      negativeProofRequests: [{
        mode: "SAFE_RULES_ONLY" as const,
        rootTargetFieldId: ROOT_FIELD,
        candidateBranchId: "branch:a",
        checkedObligations: obligations,
      }],
    };
    const valid = assessNegativeCausalRelationships(input);
    const malformed = {
      ...valid,
      negativeProofs: valid.negativeProofs.map((proof) => ({
        ...proof,
        proofId: "negative-proof:forged",
      })),
    };
    const validation = validateNegativeCausalAssessments(input, malformed);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain(
      "NEGATIVE_PROOF_ID_NON_CANONICAL:negative-proof:forged",
    );
    expect(validation.errors).toContain(
      `NEGATIVE_PROOF_MISSING:${valid.negativeProofs[0]!.proofId}`,
    );
  });
});
