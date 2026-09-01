import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  sha256,
} from "../../scripts/machine-facts/machine-facts-contract.ts";
import {
  globalExpressionId,
  globalRelationId,
} from "../../scripts/machine-facts/plan-occurrence-id.ts";
import { assessPositiveCausalRelationships } from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-assessment.ts";
import type {
  CandidateAssessmentPair,
  CandidateBranch,
  CandidateUniverse,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/candidate-universe.ts";
import type {
  PhysicalFieldExpansion,
  PhysicalFieldIdentity,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/canonical-evidence-adapter.ts";
import {
  traverseCausalDependencies,
  type CausalTraversalRoot,
  type CausalTraversalInput,
  type CausalTraversalResult,
  type SemanticTraversalLoadRequest,
  type SemanticTraversalLoadResult,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-traversal.ts";
import {
  createProofRef,
  makeSemanticDependencyEdge,
  makeSemanticOccurrenceScope,
  type SemanticDependencyEdge,
  type SemanticOccurrenceScope,
  type SemanticSubject,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/semantic-dependency-contract.ts";
import type { RootCriterion } from "../../scripts/reconcile/consumer/target-field-causal-slice/write-scoped-plan-inputs.ts";
import type { SemanticDependencyGap } from "../../scripts/reconcile/consumer/target-field-causal-slice/semantic-dependency-normalizer.ts";
import type { SemanticDependencyNormalization } from "../../scripts/reconcile/consumer/target-field-causal-slice/semantic-dependency-normalizer.ts";

const TASK_ID = "task-root";
const ROOT_FIELD = "hive|warehouse|target-table|demo.target|amount";
const SOURCE_A_FIELD = "hive|warehouse|source-a|demo.source_a|amount";
const SOURCE_B_FIELD = "hive|warehouse|source-b|demo.source_b|amount";
const TARGET_SUBJECT = fieldSubject(ROOT_FIELD);
const SOURCE_A_SUBJECT = fieldSubject(SOURCE_A_FIELD);
const SOURCE_B_SUBJECT = fieldSubject(SOURCE_B_FIELD);

function fieldSubject(physicalFieldId: string): SemanticSubject {
  return { subjectKind: "PHYSICAL_FIELD", physicalFieldId };
}

function criterion(writeOrdinal: number): RootCriterion {
  const statementIndex = writeOrdinal;
  const writeObservationId = `write-observation:${TASK_ID}:${writeOrdinal}`;
  const statementId = `task:${TASK_ID}:statement:${statementIndex}`;
  const localRootRelationId = `root.write_${writeOrdinal}.project`;
  const localOutputExpressionId = `${localRootRelationId}:expression:project_expression:0`;
  const rootRelationId = globalRelationId(
    TASK_ID,
    statementIndex,
    localRootRelationId,
  );
  const outputExpressionId = globalExpressionId(
    TASK_ID,
    statementIndex,
    localOutputExpressionId,
  );
  return {
    rootCriterionId: `root-criterion:${writeObservationId}:amount`,
    rootTaskId: TASK_ID,
    targetTableKey: "hive|warehouse|target-table|demo.target",
    targetFieldName: "amount",
    rootTargetFieldId: ROOT_FIELD,
    targetFieldBindingId: `target-field-binding:${writeOrdinal}`,
    rootWriteObservationId: writeObservationId,
    writeKind: "INSERT_OVERWRITE",
    sqlSourceId: "sql:task-root:fixture",
    sqlSnapshot: "snapshots/sql/task-root.sql",
    sqlSha256: "fixture",
    writeStatementId: statementId,
    writeStatementIndex: statementIndex,
    statementId,
    statementIndex,
    queryProducerStatementId: statementId,
    rootRelationId,
    outputExpressionId,
    outputBindingId: `output-binding:${writeOrdinal}:0`,
    sourceOrdinal: 0,
    targetOrdinal: 0,
    producerOutputName: "amount",
    expressionRole: "PROJECT_EXPRESSION",
    localRootRelationId,
    localOutputExpressionId,
    evidenceRefs: [
      writeObservationId,
      statementId,
      rootRelationId,
      outputExpressionId,
    ],
  };
}

function scopedEdge(
  rootCriterion: RootCriterion,
  semanticScope: SemanticOccurrenceScope,
  fromSubject: SemanticSubject,
  certainty: "CONFIRMED" | "UNKNOWN",
): SemanticDependencyEdge {
  return makeSemanticDependencyEdge({
    dependencyId: `dependency:${rootCriterion.rootCriterionId}`,
    fromSubject,
    toSubject: TARGET_SUBJECT,
    rootDependenceKind: "VALUE_TO_TARGET",
    localEdgeKind: "VALUE_FLOW",
    scopeRelationId: rootCriterion.localRootRelationId,
    pathCertainty: certainty,
    proofRefs: [
      createProofRef(
        "SOURCE_SPAN",
        `sql-span:${rootCriterion.rootWriteObservationId}`,
      ),
    ],
    rootCriterionId: rootCriterion.rootCriterionId,
    semanticScope,
  });
}

function scopedGap(
  rootCriterion: RootCriterion,
  semanticScope: SemanticOccurrenceScope,
  subject: SemanticSubject,
): SemanticDependencyGap {
  const proofRef = createProofRef(
    "GAP",
    `normalizer-gap:${rootCriterion.rootWriteObservationId}`,
  );
  return {
    gapId: `semantic-gap:${rootCriterion.rootCriterionId}`,
    status: "UNKNOWN",
    reasonCode: "PHYSICAL_REFERENCE_UNRESOLVED",
    operatorKind: "PROJECT",
    operatorVariant: "DIRECT",
    operatorRole: "VALUE",
    relationId: rootCriterion.localRootRelationId,
    rootTargetFieldId: rootCriterion.rootTargetFieldId,
    rootCriterionId: rootCriterion.rootCriterionId,
    semanticScopeId: semanticScope.semanticScopeId,
    semanticScope,
    subject,
    message: "one required source reference is unresolved",
    proofRefs: [proofRef],
    evidenceRefs: [proofRef.refId],
    blocksConfirmedCausality: true,
    blocksNegativeProof: true,
  };
}

function physicalField(physicalFieldId: string): PhysicalFieldIdentity {
  const [platform, dataSource, stableTableId, qualifiedName, column] =
    physicalFieldId.split("|");
  if (!platform || !dataSource || !stableTableId || !qualifiedName || !column)
    throw new Error(`invalid physical field fixture: ${physicalFieldId}`);
  return {
    platform,
    dataSource,
    stableTableId,
    qualifiedName,
    column,
    identityStatus: "SCHEMA_BACKED",
  };
}

function noExpansion(): PhysicalFieldExpansion {
  return {
    classified: true,
    ambiguous: false,
    producers: [],
    candidates: [],
    gaps: [],
  };
}

function sameSubject(left: SemanticSubject, right: SemanticSubject): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function traversalFixture(
  mode: "DEFAULT" | "NORMALIZER_GAP_A" | "WRONG_SCOPE_A" = "DEFAULT",
): {
  readonly rootA: RootCriterion;
  readonly rootB: RootCriterion;
  readonly scopeA: SemanticOccurrenceScope;
  readonly scopeB: SemanticOccurrenceScope;
  readonly loadRequests: SemanticTraversalLoadRequest[];
  readonly result: CausalTraversalResult;
} {
  const rootA = criterion(0);
  const rootB = criterion(1);
  const scopeA = makeSemanticOccurrenceScope({ rootCriterion: rootA });
  const scopeB = makeSemanticOccurrenceScope({ rootCriterion: rootB });
  const edgeA = scopedEdge(rootA, scopeA, SOURCE_A_SUBJECT, "CONFIRMED");
  const edgeB = scopedEdge(rootB, scopeB, SOURCE_B_SUBJECT, "UNKNOWN");
  const gapA = scopedGap(rootA, scopeA, SOURCE_A_SUBJECT);
  const loadRequests: SemanticTraversalLoadRequest[] = [];

  const loadSemanticEdges = (
    request: SemanticTraversalLoadRequest,
  ): SemanticTraversalLoadResult => {
    loadRequests.push(request);
    if (!sameSubject(request.subject, TARGET_SUBJECT))
      return { edges: [], gaps: [] };
    const isRootA =
      request.rootCriterion.rootCriterionId === rootA.rootCriterionId;
    const edges = isRootA
      ? mode === "WRONG_SCOPE_A"
        ? [edgeB]
        : [edgeA]
      : request.rootCriterion.rootCriterionId === rootB.rootCriterionId
        ? [edgeB]
        : [];
    return {
      edges,
      gaps: isRootA && mode === "NORMALIZER_GAP_A" ? [gapA] : [],
    };
  };

  const roots = [
    {
      rootCriterion: rootA,
      semanticScope: scopeA,
      subject: TARGET_SUBJECT,
    },
    {
      rootCriterion: rootB,
      semanticScope: scopeB,
      subject: TARGET_SUBJECT,
    },
  ] satisfies readonly CausalTraversalRoot[];

  const fields = new Map([
    [SOURCE_A_FIELD, physicalField(SOURCE_A_FIELD)],
    [SOURCE_B_FIELD, physicalField(SOURCE_B_FIELD)],
  ]);
  const input = {
    roots,
    semanticDependencies: new Map(),
    loadSemanticEdges,
    resolvePhysicalField: (physicalFieldId: string) =>
      fields.get(physicalFieldId) ?? null,
    expandPhysicalField: () => noExpansion(),
  } satisfies CausalTraversalInput;
  const result = traverseCausalDependencies(input);
  return { rootA, rootB, scopeA, scopeB, loadRequests, result };
}

function resultFor(result: CausalTraversalResult, rootCriterionId: string) {
  return result.roots.find(
    (item) => item.root.rootCriterion.rootCriterionId === rootCriterionId,
  );
}

function visitedRootCriterionId(stateKey: string): string | null {
  const value = JSON.parse(stateKey) as Record<string, unknown>;
  return typeof value.rootCriterionId === "string"
    ? value.rootCriterionId
    : null;
}

function physicalBranch(): CandidateBranch {
  return {
    candidateBranchId: "branch:source-a",
    branchKind: "PHYSICAL_PRODUCER",
    rootTaskId: TASK_ID,
    consumerTaskId: TASK_ID,
    producerTaskId: "task-producer-a",
    table: {
      platform: "hive",
      dataSource: "warehouse",
      stableTableId: "source-a",
      qualifiedName: "demo.source_a",
      identityStatus: "SCHEMA_BACKED",
    },
    readOccurrence: {
      occurrenceId: "read:source-a",
      readRelationId: "root.read.source_a",
      statementIndex: 0,
      relationPath: ["root.read.source_a"],
    },
    producerRole: "PRIMARY",
    evidenceRefs: [],
    gapRefs: [],
    boundaryReason: null,
  };
}

function universe(branch: CandidateBranch): CandidateUniverse {
  return {
    rootTaskId: TASK_ID,
    status: "COMPLETE_OBSERVED_EVIDENCE",
    branches: [branch],
    boundaryGapRefs: [],
    coverage: {
      sourceArtifactType: "TABLE_MULTI_HOP_RECONCILIATION",
      sourceCoverageStatus: "COMPLETE_OBSERVED_EVIDENCE",
      sourceCoverageSemantics: "OBSERVED_EVIDENCE_ONLY",
      sourceLimitsTruncated: false,
    },
  };
}

function assessmentPair(
  rootCriterion: RootCriterion,
  candidateBranchId: string,
): CandidateAssessmentPair & { readonly rootCriterionId: string } {
  return {
    pairId: `assessment-pair:${sha256(
      canonicalJson({
        rootCriterionId: rootCriterion.rootCriterionId,
        candidateBranchId,
      }),
    )}`,
    rootCriterionId: rootCriterion.rootCriterionId,
    rootTargetFieldId: rootCriterion.rootTargetFieldId,
    candidateBranchId,
    assessment: null,
  };
}

function assessmentTraversal(
  rootA: RootCriterion,
  rootB: RootCriterion,
  scopeA: SemanticOccurrenceScope,
  scopeB: SemanticOccurrenceScope,
): CausalTraversalResult {
  const edge = {
    edgeId: `traversal-edge:${rootA.rootCriterionId}`,
    rootCriterionId: rootA.rootCriterionId,
    fromSemanticScopeId: scopeA.semanticScopeId,
    toSemanticScopeId: scopeA.semanticScopeId,
    fromTaskId: "task-producer-a",
    toTaskId: TASK_ID,
    fromSubject: SOURCE_A_SUBJECT,
    toSubject: SOURCE_A_SUBJECT,
    rootDependenceKind: "VALUE_TO_TARGET" as const,
    localEdgeKind: "VALUE_FLOW" as const,
    frontierKind: "VALUE" as const,
    pathCertainty: "CONFIRMED" as const,
    dependencyId: null,
    readOccurrenceId: "read:source-a",
    evidenceRefs: ["read:source-a", "write:producer-a"],
  };
  const path = {
    pathId: `traversal-path:${rootA.rootCriterionId}`,
    rootCriterionId: rootA.rootCriterionId,
    rootTargetFieldId: ROOT_FIELD,
    rootDependenceKind: "VALUE_TO_TARGET" as const,
    edges: [edge],
    pathCertainty: "CONFIRMED" as const,
  };
  const gap = {
    gapId: `traversal-gap:${rootB.rootCriterionId}`,
    rootCriterionId: rootB.rootCriterionId,
    semanticScopeId: scopeB.semanticScopeId,
    rootTargetFieldId: ROOT_FIELD,
    taskId: TASK_ID,
    subject: SOURCE_B_SUBJECT,
    rootDependenceKind: "VALUE_TO_TARGET" as const,
    frontierKind: "VALUE" as const,
    reasonCode: "REQUIRED_EVIDENCE_UNRESOLVED" as const,
    message: "write B has unresolved source evidence",
    evidenceRefs: ["gap:write-b"],
    blocksConfirmedCausality: true as const,
    blocksNegativeProof: true as const,
  };
  const base = {
    activeCycleChecks: 0,
    frontiers: {
      VALUE: 1,
      EXPRESSION_CONTROL: 0,
      ROWSET_CONTROL: 0,
      WINDOW_CONTEXT: 0,
      RELATION_CONTEXT: 0,
    },
  };
  return {
    options: {
      maxDepth: 10,
      maxValueStates: 10,
      maxValuePaths: 10,
      maxControlStates: 10,
      maxControlPaths: 10,
    },
    roots: [
      {
        ...base,
        root: {
          rootCriterion: rootA,
          semanticScope: scopeA,
          subject: TARGET_SUBJECT,
        },
        rootCriterionId: rootA.rootCriterionId,
        visitedStateKeys: [`state:${rootA.rootCriterionId}`],
        paths: [path],
        gaps: [],
        decision: {
          valuePathCertainty: "CONFIRMED",
          controlPathCertainty: null,
          valueClosed: true,
          controlClosed: true,
          valueGapIds: [],
          controlGapIds: [],
        },
      },
      {
        ...base,
        root: {
          rootCriterion: rootB,
          semanticScope: scopeB,
          subject: TARGET_SUBJECT,
        },
        rootCriterionId: rootB.rootCriterionId,
        visitedStateKeys: [`state:${rootB.rootCriterionId}`],
        paths: [],
        gaps: [gap],
        decision: {
          valuePathCertainty: null,
          controlPathCertainty: null,
          valueClosed: false,
          controlClosed: true,
          valueGapIds: [gap.gapId],
          controlGapIds: [],
        },
      },
    ],
    sharedEvidenceRefs: [...edge.evidenceRefs, ...gap.evidenceRefs].sort(),
    edges: [edge],
    gaps: [gap],
  };
}

describe("occurrence-scoped causal traversal", () => {
  it("ignores sibling-write facts co-located in the static task map", () => {
    const rootA = criterion(0);
    const rootB = criterion(1);
    const scopeA = makeSemanticOccurrenceScope({ rootCriterion: rootA });
    const scopeB = makeSemanticOccurrenceScope({ rootCriterion: rootB });
    const edgeA = scopedEdge(rootA, scopeA, SOURCE_A_SUBJECT, "CONFIRMED");
    const edgeB = scopedEdge(rootB, scopeB, SOURCE_B_SUBJECT, "CONFIRMED");
    const normalization = (
      edge: SemanticDependencyEdge,
    ): SemanticDependencyNormalization => ({
      definitions: [],
      applications: [],
      edges: [edge],
      semanticEdges: [edge],
      gaps: [],
      legacyEdges: [],
    });
    const fields = new Map([
      [SOURCE_A_FIELD, physicalField(SOURCE_A_FIELD)],
      [SOURCE_B_FIELD, physicalField(SOURCE_B_FIELD)],
    ]);

    const result = traverseCausalDependencies({
      roots: [
        {
          rootCriterion: rootA,
          semanticScope: scopeA,
          subject: TARGET_SUBJECT,
        },
        {
          rootCriterion: rootB,
          semanticScope: scopeB,
          subject: TARGET_SUBJECT,
        },
      ],
      semanticDependencies: new Map([
        [TASK_ID, [normalization(edgeA), normalization(edgeB)]],
      ]),
      resolvePhysicalField: (physicalFieldId) =>
        fields.get(physicalFieldId) ?? null,
      expandPhysicalField: () => noExpansion(),
    });
    const resultA = resultFor(result, rootA.rootCriterionId);
    const resultB = resultFor(result, rootB.rootCriterionId);

    expect(resultA?.gaps).toEqual([]);
    expect(resultB?.gaps).toEqual([]);
    expect(resultA?.paths.flatMap((path) => path.edges)).toEqual([
      expect.objectContaining({
        rootCriterionId: rootA.rootCriterionId,
        fromSubject: SOURCE_A_SUBJECT,
      }),
    ]);
    expect(resultB?.paths.flatMap((path) => path.edges)).toEqual([
      expect.objectContaining({
        rootCriterionId: rootB.rootCriterionId,
        fromSubject: SOURCE_B_SUBJECT,
      }),
    ]);
    expect(
      result.gaps.some(
        (gap) => gap.reasonCode === "SEMANTIC_SCOPE_DISCONTINUITY",
      ),
    ).toBe(false);
  });

  it("isolates loader requests, visited states, paths, edges, and gaps for sibling writes", () => {
    const { rootA, rootB, scopeA, scopeB, loadRequests, result } =
      traversalFixture();
    const resultA = resultFor(result, rootA.rootCriterionId);
    const resultB = resultFor(result, rootB.rootCriterionId);

    expect(resultA).toBeDefined();
    expect(resultB).toBeDefined();
    expect(
      loadRequests.filter((request) =>
        sameSubject(request.subject, TARGET_SUBJECT),
      ),
    ).toEqual([
      expect.objectContaining({
        rootCriterion: expect.objectContaining({
          rootCriterionId: rootA.rootCriterionId,
        }),
        localRootCriterion: expect.objectContaining({
          rootCriterionId: rootA.rootCriterionId,
        }),
        semanticScope: expect.objectContaining({
          semanticScopeId: scopeA.semanticScopeId,
        }),
      }),
      expect.objectContaining({
        rootCriterion: expect.objectContaining({
          rootCriterionId: rootB.rootCriterionId,
        }),
        localRootCriterion: expect.objectContaining({
          rootCriterionId: rootB.rootCriterionId,
        }),
        semanticScope: expect.objectContaining({
          semanticScopeId: scopeB.semanticScopeId,
        }),
      }),
    ]);

    const visitedA = resultA?.visitedStateKeys ?? [];
    const visitedB = resultB?.visitedStateKeys ?? [];
    expect(visitedA.length).toBeGreaterThan(0);
    expect(visitedB.length).toBeGreaterThan(0);
    expect(visitedA.map(visitedRootCriterionId)).toEqual(
      visitedA.map(() => rootA.rootCriterionId),
    );
    expect(visitedB.map(visitedRootCriterionId)).toEqual(
      visitedB.map(() => rootB.rootCriterionId),
    );
    expect(visitedA.filter((key) => new Set(visitedB).has(key))).toEqual([]);

    expect(resultA?.gaps).toEqual([]);
    expect(resultB?.gaps).toHaveLength(1);
    expect(resultB?.gaps[0]).toMatchObject({
      rootCriterionId: rootB.rootCriterionId,
      semanticScopeId: scopeB.semanticScopeId,
      reasonCode: "REQUIRED_EVIDENCE_UNRESOLVED",
    });
    const pathIdsA = (resultA?.paths ?? []).map((path) => path.pathId);
    const pathIdsB = (resultB?.paths ?? []).map((path) => path.pathId);
    expect(pathIdsA.length).toBeGreaterThan(0);
    expect(pathIdsB.length).toBeGreaterThan(0);
    expect(pathIdsA.filter((pathId) => new Set(pathIdsB).has(pathId))).toEqual(
      [],
    );
    for (const [root, scope, rootResult] of [
      [rootA, scopeA, resultA],
      [rootB, scopeB, resultB],
    ] as const) {
      for (const path of rootResult?.paths ?? []) {
        expect(path).toMatchObject({ rootCriterionId: root.rootCriterionId });
        for (const edge of path.edges)
          expect(edge).toMatchObject({
            rootCriterionId: root.rootCriterionId,
            fromSemanticScopeId: scope.semanticScopeId,
            toSemanticScopeId: scope.semanticScopeId,
          });
      }
    }
  });

  it("turns a scoped normalizer gap into a confirmed-causality blocker", () => {
    const { rootA, scopeA, result } = traversalFixture("NORMALIZER_GAP_A");
    const rootResult = resultFor(result, rootA.rootCriterionId);
    const gap = rootResult?.gaps.find(
      (candidate) => candidate.reasonCode === "REQUIRED_EVIDENCE_UNRESOLVED",
    );

    expect(rootResult?.paths.length).toBeGreaterThan(0);
    expect(gap).toMatchObject({
      rootCriterionId: rootA.rootCriterionId,
      semanticScopeId: scopeA.semanticScopeId,
      blocksConfirmedCausality: true,
      blocksNegativeProof: true,
    });
    expect(rootResult?.decision.valueClosed).toBe(false);
  });

  it("fails closed when a fast-loader result crosses root/write scope", () => {
    const { rootA, scopeA, result } = traversalFixture("WRONG_SCOPE_A");
    const rootResult = resultFor(result, rootA.rootCriterionId);

    expect(rootResult?.paths).toEqual([]);
    expect(rootResult?.gaps).toEqual([
      expect.objectContaining({
        rootCriterionId: rootA.rootCriterionId,
        semanticScopeId: scopeA.semanticScopeId,
        reasonCode: "SEMANTIC_SCOPE_DISCONTINUITY",
        blocksConfirmedCausality: true,
        blocksNegativeProof: true,
      }),
    ]);
    expect(rootResult?.decision.valueClosed).toBe(false);
  });

  it("assesses the same physical field independently by root criterion", () => {
    const rootA = criterion(0);
    const rootB = criterion(1);
    const scopeA = makeSemanticOccurrenceScope({ rootCriterion: rootA });
    const scopeB = makeSemanticOccurrenceScope({ rootCriterion: rootB });
    const branch = physicalBranch();
    const pairs = [
      assessmentPair(rootA, branch.candidateBranchId),
      assessmentPair(rootB, branch.candidateBranchId),
    ];
    const result = assessPositiveCausalRelationships({
      candidateUniverse: universe(branch),
      traversal: assessmentTraversal(rootA, rootB, scopeA, scopeB),
      assessmentPairs: pairs,
      rootCriteria: [rootA, rootB],
    });
    const assessmentA = result.assessments.find(
      (assessment) => assessment.rootCriterionId === rootA.rootCriterionId,
    );
    const assessmentB = result.assessments.find(
      (assessment) => assessment.rootCriterionId === rootB.rootCriterionId,
    );

    expect(result.assessments).toHaveLength(2);
    expect(assessmentA).toMatchObject({
      rootCriterionId: rootA.rootCriterionId,
      rootTargetFieldId: ROOT_FIELD,
      status: "CONFIRMED_RELATED",
      gapRefs: [],
    });
    expect(assessmentB).toMatchObject({
      rootCriterionId: rootB.rootCriterionId,
      rootTargetFieldId: ROOT_FIELD,
      status: "UNKNOWN",
    });
    expect(assessmentB?.gapRefs.length).toBeGreaterThan(0);
    expect(
      result.gaps.every((gap) => gap.rootCriterionId === rootB.rootCriterionId),
    ).toBe(true);
    expect(result.assessments[0]?.assessmentId).not.toBe(
      result.assessments[1]?.assessmentId,
    );
  });
});
