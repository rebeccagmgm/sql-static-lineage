import { describe, expect, it } from "vitest";
import { globalExpressionId, globalRelationId } from "../../scripts/machine-facts/plan-occurrence-id.ts";

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
import { makeSemanticOccurrenceScope } from "../../scripts/reconcile/consumer/target-field-causal-slice/semantic-dependency-contract.ts";
import type { RootCriterion } from "../../scripts/reconcile/consumer/target-field-causal-slice/write-scoped-plan-inputs.ts";

const ROOT_FIELD = "hive|warehouse|demo.root__warehouse|demo.root|out_a";
const SOURCE_FIELD = "hive|warehouse|demo.source__warehouse|demo.source|src_a";

function criterion(writeOrdinal = 0): RootCriterion {
  const rootWriteObservationId = `write:100:${writeOrdinal}`;
  return {
    rootCriterionId: `root-criterion:${rootWriteObservationId}:out_a`,
    rootTaskId: "100",
    targetTableKey: "hive|warehouse|demo.root__warehouse",
    targetFieldName: "out_a",
    rootTargetFieldId: ROOT_FIELD,
    targetFieldBindingId: "field:root:out_a",
    rootWriteObservationId,
    writeKind: "INSERT",
    sqlSourceId: "sql:100",
    sqlSnapshot: "task-sql.sql",
    sqlSha256: "sha256",
    writeStatementId: `write-statement:${writeOrdinal}`,
    writeStatementIndex: writeOrdinal,
    statementId: `statement:${writeOrdinal}`,
    statementIndex: writeOrdinal,
    queryProducerStatementId: `query-statement:${writeOrdinal}`,
    rootRelationId: globalRelationId("100", writeOrdinal, "root"),
    outputExpressionId: globalExpressionId(
      "100",
      writeOrdinal,
      "root:expression:project_expression:0",
    ),
    outputBindingId: `binding:${writeOrdinal}:out_a`,
    sourceOrdinal: 0,
    targetOrdinal: 0,
    producerOutputName: "out_a",
    expressionRole: "PROJECT_EXPRESSION",
    localRootRelationId: "root",
    localOutputExpressionId: "root:expression:project_expression:0",
    evidenceRefs: [rootWriteObservationId, `binding:${writeOrdinal}:out_a`],
  };
}

const ROOT_CRITERION = criterion();
const ROOT_SCOPE = makeSemanticOccurrenceScope({ rootCriterion: ROOT_CRITERION });

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

function rootWriteBranch(
  rootCriterion: RootCriterion = ROOT_CRITERION,
  candidateBranchId = "branch:root-write",
): CandidateBranch {
  return {
    candidateBranchId,
    branchKind: "ROOT_WRITE",
    rootTaskId: "100",
    consumerTaskId: null,
    producerTaskId: "100",
    table: {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: "demo.root",
      stableTableId: "demo.root__warehouse",
      identityStatus: "SCHEMA_BACKED",
    },
    readOccurrence: null,
    writeObservationId: rootCriterion.rootWriteObservationId,
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
    rootCriterionId: ROOT_CRITERION.rootCriterionId,
    rootTargetFieldId: ROOT_FIELD,
    rootDependenceKind: "VALUE_TO_TARGET",
    pathCertainty: certainty,
    edges: [
      {
        edgeId: `edge:${certainty}:${occurrenceId}`,
        rootCriterionId: ROOT_CRITERION.rootCriterionId,
        fromSemanticScopeId: ROOT_SCOPE.semanticScopeId,
        toSemanticScopeId: ROOT_SCOPE.semanticScopeId,
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

function relationPath(certainty: PathCertainty = "CONFIRMED"): CausalTraversalPath {
  const relation = { subjectKind: "RELATION_OCCURRENCE" as const, relationOccurrenceId: "relation:read:r1" };
  return {
    pathId: `path:relation:${certainty}`,
    rootCriterionId: ROOT_CRITERION.rootCriterionId,
    rootTargetFieldId: ROOT_FIELD,
    rootDependenceKind: "RELATION_TO_TARGET",
    pathCertainty: certainty,
    edges: [{
      edgeId: `edge:relation:${certainty}`,
      rootCriterionId: ROOT_CRITERION.rootCriterionId,
      fromSemanticScopeId: ROOT_SCOPE.semanticScopeId,
      toSemanticScopeId: ROOT_SCOPE.semanticScopeId,
      fromTaskId: "200",
      toTaskId: "100",
      fromSubject: relation,
      toSubject: relation,
      rootDependenceKind: "RELATION_TO_TARGET",
      localEdgeKind: "RELATION_CONTEXT",
      frontierKind: "RELATION_CONTEXT",
      pathCertainty: certainty,
      dependencyId: null,
      readOccurrenceId: "read:r1",
      evidenceRefs: ["relation:bridge"],
    }],
  };
}

function blockingGap(): CausalTraversalGap {
  return {
    gapId: "traversal-gap:source",
    rootCriterionId: ROOT_CRITERION.rootCriterionId,
    semanticScopeId: ROOT_SCOPE.semanticScopeId,
    rootTargetFieldId: ROOT_FIELD,
    taskId: "200",
    subject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: SOURCE_FIELD },
    rootDependenceKind: "VALUE_TO_TARGET",
    frontierKind: "VALUE",
    reasonCode: "REQUIRED_EVIDENCE_UNRESOLVED",
    message: "write evidence is unresolved",
    evidenceRefs: ["write:missing"],
    blocksConfirmedCausality: true,
    blocksNegativeProof: true,
  };
}

function rootResult(
  paths: readonly CausalTraversalPath[],
  gaps: readonly CausalTraversalGap[] = [],
): CausalTraversalRootResult {
  return {
    rootCriterionId: ROOT_CRITERION.rootCriterionId,
    root: {
      rootCriterion: ROOT_CRITERION,
      semanticScope: ROOT_SCOPE,
    },
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
    rootCriteria: [ROOT_CRITERION],
    assessmentPairs: buildAssessmentPairSkeleton(
      [ROOT_CRITERION],
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
        [ROOT_CRITERION],
        traversal([path()]),
        result,
      ),
    ).toEqual({ valid: true, errors: [] });
  });

  it("confirms a relation-context producer bridge without requiring a producer column", () => {
    const result = assess(universe(), traversal([relationPath()]));
    expect(result.assessments[0]).toMatchObject({
      status: "CONFIRMED_RELATED",
      reasonCode: "CONTINUOUS_CONFIRMED_PATH",
    });
    expect(result.positiveProofs[0]?.evidenceRefs).toEqual(["relation:bridge"]);
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

  it.each([
    ["sibling criterion edge", {
      rootCriterionId: criterion(1).rootCriterionId,
    }],
    ["discontinuous semantic scope", {
      toSemanticScopeId: "semantic-scope:sibling-write",
    }],
  ] as const)("rejects a path containing a %s", (_name, edgeOverride) => {
    const validPath = path();
    const malformed: CausalTraversalPath = {
      ...validPath,
      edges: validPath.edges.map((edge) => ({ ...edge, ...edgeOverride })),
    };
    const result = assess(universe(), traversal([malformed]));
    expect(result.assessments[0]).toMatchObject({
      rootCriterionId: ROOT_CRITERION.rootCriterionId,
      status: "UNKNOWN",
      reasonCode: "EXACT_OCCURRENCE_PATH_NOT_PROVEN",
    });
    expect(result.positiveProofs).toEqual([]);
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
        rootCriterionId: ROOT_CRITERION.rootCriterionId,
        rootTargetFieldId: ROOT_FIELD,
        candidateBranchId: "branch:root-write",
        pathCertainty: "CONFIRMED",
        evidenceRefs: [
          ROOT_CRITERION.rootWriteObservationId,
          ROOT_CRITERION.outputBindingId,
        ],
      },
    ]);
    expect(confirmed.assessments[0]).toMatchObject({
      status: "CONFIRMED_RELATED",
      reasonCode: "EXPLICIT_ROOT_WRITE_PROOF",
    });

    const forged = assess(candidateUniverse, traversal([]), [{
      rootCriterionId: ROOT_CRITERION.rootCriterionId,
      rootTargetFieldId: ROOT_FIELD,
      candidateBranchId: "branch:root-write",
      pathCertainty: "CONFIRMED",
      evidenceRefs: ["forged:write", "forged:binding"],
    }]);
    expect(forged.assessments[0]).toMatchObject({
      status: "UNKNOWN",
      reasonCode: "ROOT_WRITE_PROOF_MISSING",
    });
  });

  it("rejects a ROOT_WRITE branch whose table is outside the criterion", () => {
    const rootBranch = rootWriteBranch();
    const candidateUniverse = universe([{
      ...rootBranch,
      table: {
        ...rootBranch.table!,
        stableTableId: "other-table",
        qualifiedName: "demo.other",
      },
    }]);
    const result = assess(candidateUniverse, traversal([]), [{
      rootCriterionId: ROOT_CRITERION.rootCriterionId,
      rootTargetFieldId: ROOT_FIELD,
      candidateBranchId: rootBranch.candidateBranchId,
      pathCertainty: "CONFIRMED",
      evidenceRefs: [
        ROOT_CRITERION.rootWriteObservationId,
        ROOT_CRITERION.outputBindingId,
      ],
    }]);
    expect(result.assessments[0]).toMatchObject({
      status: "UNKNOWN",
      reasonCode: "ASSESSMENT_PAIR_INPUT_INVALID",
    });
  });

  it("matches ROOT_WRITE proof only to the same write criterion", () => {
    const sibling = criterion(1);
    const firstBranch = rootWriteBranch();
    const siblingBranch = rootWriteBranch(sibling, "branch:root-write:sibling");
    const candidateUniverse = universe([firstBranch, siblingBranch]);
    const rootCriteria = [ROOT_CRITERION, sibling];
    const result = assessPositiveCausalRelationships({
      candidateUniverse,
      traversal: traversal([]),
      rootCriteria,
      assessmentPairs: buildAssessmentPairSkeleton(
        rootCriteria,
        candidateUniverse.branches,
      ),
      rootWriteProofs: [{
        rootCriterionId: ROOT_CRITERION.rootCriterionId,
        rootTargetFieldId: ROOT_FIELD,
        candidateBranchId: firstBranch.candidateBranchId,
        pathCertainty: "CONFIRMED",
        evidenceRefs: [
          ROOT_CRITERION.rootWriteObservationId,
          ROOT_CRITERION.outputBindingId,
        ],
      }],
    });

    expect(result.assessments).toHaveLength(2);
    expect(result.assessments.find((item) =>
      item.rootCriterionId === ROOT_CRITERION.rootCriterionId
    )?.status).toBe("CONFIRMED_RELATED");
    expect(result.assessments.find((item) =>
      item.rootCriterionId === sibling.rootCriterionId
    )?.status).toBe("UNKNOWN");
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
        [ROOT_CRITERION],
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
        [ROOT_CRITERION],
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
        [ROOT_CRITERION],
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
