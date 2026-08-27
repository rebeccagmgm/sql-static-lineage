import { describe, expect, it } from "vitest";

import {
  assessPositiveCausalRelationships,
  validatePositiveCausalAssessments,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-assessment.ts";
import {
  buildAssessmentPairSkeleton,
  type CandidateBranch,
  type CandidateUniverse,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/candidate-universe.ts";
import type {
  CausalTraversalGap,
  CausalTraversalPath,
  CausalTraversalResult,
  CausalTraversalRootResult,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-traversal.ts";
import type { PathCertainty } from "../../scripts/reconcile/consumer/target-field-causal-slice/semantic-dependency-contract.ts";

const ROOT_FIELD = "hive|warehouse|demo.root__warehouse|demo.root|out_a";
const SOURCE_FIELD = "hive|warehouse|demo.source__warehouse|demo.source|src_a";

function physicalBranch(
  id = "branch:source:r1",
  occurrenceId: string | null = "read:r1",
): CandidateBranch {
  return {
    candidateBranchId: id,
    branchKind: "PHYSICAL_PRODUCER",
    rootTaskId: "100",
    consumerTaskId: "100",
    producerTaskId: "200",
    table: {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: "demo.source",
      stableTableId: "demo.source__warehouse",
      identityStatus: "SCHEMA_BACKED",
    },
    readOccurrence: occurrenceId === null
      ? null
      : {
          occurrenceId,
          readRelationId: `relation:${occurrenceId}`,
          statementIndex: 0,
          relationPath: [`relation:${occurrenceId}`],
        },
    producerRole: "PRIMARY",
    evidenceRefs: [],
    gapRefs: [],
    boundaryReason: null,
  };
}

function rootWriteBranch(): CandidateBranch {
  return {
    candidateBranchId: "branch:root-write",
    branchKind: "ROOT_WRITE",
    rootTaskId: "100",
    consumerTaskId: null,
    producerTaskId: "100",
    table: null,
    readOccurrence: null,
    producerRole: null,
    evidenceRefs: [],
    gapRefs: [],
    boundaryReason: null,
  };
}

function boundaryBranch(): CandidateBranch {
  return {
    candidateBranchId: "branch:unbound",
    branchKind: "UNBOUND_READ",
    rootTaskId: "100",
    consumerTaskId: "100",
    producerTaskId: null,
    table: null,
    readOccurrence: null,
    producerRole: null,
    evidenceRefs: [],
    gapRefs: ["table-gap:unbound"],
    boundaryReason: "PRODUCER_NOT_OBSERVED",
  };
}

function universe(
  branches: readonly CandidateBranch[] = [physicalBranch()],
  status: CandidateUniverse["status"] = "COMPLETE_OBSERVED_EVIDENCE",
): CandidateUniverse {
  return {
    rootTaskId: "100",
    status,
    branches,
    boundaryGapRefs: status === "INCOMPLETE" ? ["universe-gap:coverage"] : [],
    coverage: {
      sourceArtifactType: "TABLE_MULTI_HOP_RECONCILIATION",
      sourceCoverageStatus: status,
      sourceCoverageSemantics: "OBSERVED_EVIDENCE_ONLY",
      sourceLimitsTruncated: false,
    },
  };
}

function path(
  certainty: PathCertainty = "CONFIRMED",
  occurrenceId = "read:r1",
  evidenceRefs: readonly string[] = ["read:100:r1", "write:200:w1"],
): CausalTraversalPath {
  return {
    pathId: `path:${certainty}:${occurrenceId}`,
    rootTargetFieldId: ROOT_FIELD,
    rootDependenceKind: "VALUE_TO_TARGET",
    pathCertainty: certainty,
    edges: [
      {
        edgeId: `edge:${certainty}:${occurrenceId}`,
        fromTaskId: "200",
        toTaskId: "100",
        fromSubject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: SOURCE_FIELD },
        toSubject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: SOURCE_FIELD },
        rootDependenceKind: "VALUE_TO_TARGET",
        localEdgeKind: "VALUE_FLOW",
        frontierKind: "VALUE",
        pathCertainty: certainty,
        dependencyId: null,
        readOccurrenceId: occurrenceId,
        evidenceRefs,
      },
    ],
  };
}

function blockingGap(): CausalTraversalGap {
  return {
    gapId: "traversal-gap:source",
    rootTargetFieldId: ROOT_FIELD,
    taskId: "200",
    subject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: SOURCE_FIELD },
    rootDependenceKind: "VALUE_TO_TARGET",
    frontierKind: "VALUE",
    reasonCode: "REQUIRED_EVIDENCE_UNRESOLVED",
    message: "write evidence is unresolved",
    evidenceRefs: ["write:missing"],
    blocksNegativeProof: true,
  };
}

function rootResult(
  paths: readonly CausalTraversalPath[],
  gaps: readonly CausalTraversalGap[] = [],
): CausalTraversalRootResult {
  return {
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
      valuePathCertainty: paths[0]?.pathCertainty ?? null,
      controlPathCertainty: null,
      valueClosed: gaps.length === 0,
      controlClosed: true,
      valueGapIds: gaps.map((gap) => gap.gapId),
      controlGapIds: [],
    },
  };
}

function traversal(
  paths: readonly CausalTraversalPath[],
  gaps: readonly CausalTraversalGap[] = [],
): CausalTraversalResult {
  const root = rootResult(paths, gaps);
  return {
    options: {
      maxDepth: 25,
      maxValueStates: 5000,
      maxValuePaths: 10000,
      maxControlStates: 5000,
      maxControlPaths: 10000,
    },
    roots: [root],
    sharedEvidenceRefs: [],
    edges: paths.flatMap((item) => item.edges),
    gaps,
  };
}

function assess(
  candidateUniverse: CandidateUniverse,
  causalTraversal: CausalTraversalResult,
  rootWriteProofs: Parameters<typeof assessPositiveCausalRelationships>[0]["rootWriteProofs"] = [],
) {
  return assessPositiveCausalRelationships({
    candidateUniverse,
    traversal: causalTraversal,
    assessmentPairs: buildAssessmentPairSkeleton(
      [ROOT_FIELD],
      candidateUniverse.branches,
    ),
    rootWriteProofs,
  });
}

describe("positive causal assessment", () => {
  it("confirms only an occurrence-exact path with continuous evidence", () => {
    const candidateUniverse = universe();
    const result = assess(candidateUniverse, traversal([path()]));

    expect(result.assessments).toHaveLength(1);
    expect(result.assessments[0]?.status).toBe("CONFIRMED_RELATED");
    expect(result.positiveProofs[0]).toMatchObject({
      pathIds: ["path:CONFIRMED:read:r1"],
      edgeIds: ["edge:CONFIRMED:read:r1"],
      pathCertainty: "CONFIRMED",
    });
    expect(
      validatePositiveCausalAssessments(
        candidateUniverse,
        [ROOT_FIELD],
        traversal([path()]),
        result,
      ),
    ).toEqual({ valid: true, errors: [] });
  });

  it("keeps a real provisional path conditional", () => {
    const result = assess(universe(), traversal([path("CONDITIONAL")]));
    expect(result.assessments[0]).toMatchObject({
      status: "CONDITIONAL_RELATED",
      reasonCode: "CONTINUOUS_PROVISIONAL_PATH",
    });
  });

  it("recomputes worst certainty from every edge before confirming", () => {
    const inconsistent = path("CONFIRMED");
    const downgraded: CausalTraversalPath = {
      ...inconsistent,
      edges: inconsistent.edges.map((edge) => ({
        ...edge,
        pathCertainty: "CONDITIONAL" as const,
      })),
    };
    const result = assess(universe(), traversal([downgraded]));
    expect(result.assessments[0]?.status).toBe("CONDITIONAL_RELATED");
  });

  it("marks an unknown or blocked necessary path Unknown with gap refs", () => {
    const result = assess(
      universe(),
      traversal([path("UNKNOWN")], [blockingGap()]),
    );
    expect(result.assessments[0]?.status).toBe("UNKNOWN");
    expect(result.assessments[0]?.gapRefs).toContain("traversal-gap:source");
    expect(result.gaps).toHaveLength(1);
  });

  it("does not map the same Task pair across a different read occurrence", () => {
    const result = assess(universe(), traversal([path("CONFIRMED", "read:r2")]));
    expect(result.assessments[0]).toMatchObject({
      status: "UNKNOWN",
      reasonCode: "EXACT_OCCURRENCE_PATH_NOT_PROVEN",
    });
  });

  it("rejects Task-pair-only and malformed occurrence matching", () => {
    const result = assess(
      universe([physicalBranch("branch:missing-occurrence", null)]),
      traversal([path()]),
    );
    expect(result.assessments[0]?.status).toBe("UNKNOWN");
  });

  it("rejects a physical branch whose table identity is incomplete", () => {
    const branch = physicalBranch();
    const result = assess(
      universe([{ ...branch, table: { ...branch.table!, qualifiedName: null } }]),
      traversal([path()]),
    );
    expect(result.assessments[0]?.status).toBe("UNKNOWN");
  });

  it("does not treat a missing stable table identity as a wildcard", () => {
    const branch = physicalBranch();
    const result = assess(
      universe([{ ...branch, table: { ...branch.table!, stableTableId: null } }]),
      traversal([path()]),
    );
    expect(result.assessments[0]?.status).toBe("UNKNOWN");
  });

  it("does not let a gap from another read occurrence block an exact path", () => {
    const otherOccurrenceGap = { ...blockingGap(), readOccurrenceId: "read:r2" };
    const result = assess(universe(), traversal([path()], [otherOccurrenceGap]));
    expect(result.assessments[0]?.status).toBe("CONFIRMED_RELATED");
  });

  it("requires explicit proof for the root write", () => {
    const candidateUniverse = universe([rootWriteBranch()]);
    const missing = assess(candidateUniverse, traversal([]));
    expect(missing.assessments[0]).toMatchObject({
      status: "UNKNOWN",
      reasonCode: "ROOT_WRITE_PROOF_MISSING",
    });

    const confirmed = assess(candidateUniverse, traversal([]), [
      {
        rootTargetFieldId: ROOT_FIELD,
        candidateBranchId: "branch:root-write",
        pathCertainty: "CONFIRMED",
        evidenceRefs: ["root-write:w1", "root-binding:b1"],
      },
    ]);
    expect(confirmed.assessments[0]).toMatchObject({
      status: "CONFIRMED_RELATED",
      reasonCode: "EXPLICIT_ROOT_WRITE_PROOF",
    });
  });

  it("keeps incomplete boundary branches Unknown without lowering a closed positive branch", () => {
    const candidateUniverse = universe(
      [physicalBranch(), boundaryBranch()],
      "INCOMPLETE",
    );
    const result = assess(candidateUniverse, traversal([path()]));
    expect(
      result.assessments
        .map((item) => [item.candidateBranchId, item.status])
        .sort(([left], [right]) => String(left).localeCompare(String(right))),
    ).toEqual([
      ["branch:source:r1", "CONFIRMED_RELATED"],
      ["branch:unbound", "UNKNOWN"],
    ].sort(([left], [right]) => String(left).localeCompare(String(right))));
  });

  it("produces exactly one decision for every pair and rejects duplicates", () => {
    const candidateUniverse = universe([physicalBranch(), boundaryBranch()]);
    const result = assess(candidateUniverse, traversal([path()]));
    expect(result.assessments).toHaveLength(2);
    expect(
      validatePositiveCausalAssessments(
        candidateUniverse,
        [ROOT_FIELD],
        traversal([path()]),
        result,
      ).valid,
    ).toBe(true);

    const duplicate = {
      ...result,
      assessments: [...result.assessments, result.assessments[0]!],
    };
    expect(
      validatePositiveCausalAssessments(
        candidateUniverse,
        [ROOT_FIELD],
        traversal([path()]),
        duplicate,
      ).errors,
    ).toContain(
      `ASSESSMENT_PAIR_CARDINALITY:${result.assessments[0]!.pairId}:2`,
    );

    const fabricatedProof = {
      ...result,
      positiveProofs: result.positiveProofs.map((proof) => ({
        ...proof,
        edgeIds: ["edge:fabricated"],
      })),
    };
    expect(
      validatePositiveCausalAssessments(
        candidateUniverse,
        [ROOT_FIELD],
        traversal([path()]),
        fabricatedProof,
      ).errors,
    ).toContain(`POSITIVE_PROOF_ID_NON_CANONICAL:${result.positiveProofs[0]!.proofId}`);
  });

  it("does not confirm a mapped path whose necessary edge has no evidence", () => {
    const result = assess(universe(), traversal([path("CONFIRMED", "read:r1", [])]));
    expect(result.assessments[0]).toMatchObject({
      status: "UNKNOWN",
      reasonCode: "CONTINUOUS_PATH_EVIDENCE_INCOMPLETE",
    });
  });
});
