import { describe, expect, it } from "vitest";

import {
  globalExpressionId,
  globalRelationId,
} from "../../scripts/machine-facts/plan-occurrence-id.ts";
import type { CausalSliceArtifact } from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-slice-contract.ts";
import { formatCausalSlice } from "../../scripts/reconcile/consumer/target-field-causal-slice/format-causal-slice.ts";
import { makeSemanticOccurrenceScope } from "../../scripts/reconcile/consumer/target-field-causal-slice/semantic-dependency-contract.ts";
import {
  canonicalRootCriterionId,
  type RootCriterion,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/write-scoped-plan-inputs.ts";

const ROOT = "hive|warehouse|target|demo.target|amount";
const SOURCE = "hive|warehouse|source|demo.source|amount";

function rootCriterion(writeOrdinal: number): RootCriterion {
  const statementIndex = writeOrdinal;
  const localRootRelationId = `root.project.${writeOrdinal}`;
  const localOutputExpressionId = `${localRootRelationId}:expression:project_expression:0`;
  const value: Omit<RootCriterion, "rootCriterionId"> = {
    rootTaskId: "100",
    targetTableKey: "hive|warehouse|target|demo.target",
    targetFieldName: "amount",
    rootTargetFieldId: ROOT,
    targetFieldBindingId: `target-binding:${writeOrdinal}`,
    rootWriteObservationId: `write:100:${writeOrdinal}`,
    writeKind: "INSERT",
    sqlSourceId: `sql:100:${writeOrdinal}`,
    sqlSnapshot: `snapshots/sql/100-${writeOrdinal}.sql`,
    sqlSha256: `sql-hash-${writeOrdinal}`,
    writeStatementId: `write-statement:${writeOrdinal}`,
    writeStatementIndex: statementIndex,
    statementId: `query-statement:${writeOrdinal}`,
    statementIndex,
    queryProducerStatementId: `query-statement:${writeOrdinal}`,
    rootRelationId: globalRelationId(
      "100",
      statementIndex,
      localRootRelationId,
    ),
    outputExpressionId: globalExpressionId(
      "100",
      statementIndex,
      localOutputExpressionId,
    ),
    outputBindingId: `output-binding:${writeOrdinal}`,
    sourceOrdinal: 0,
    targetOrdinal: 0,
    producerOutputName: "amount",
    expressionRole: "PROJECT_EXPRESSION",
    localRootRelationId,
    localOutputExpressionId,
    evidenceRefs: [`write:100:${writeOrdinal}`],
  };
  return { rootCriterionId: canonicalRootCriterionId(value), ...value };
}

const ROOT_CRITERION_A = rootCriterion(0);
const ROOT_CRITERION_B = rootCriterion(1);
const ROOT_SCOPE_A = makeSemanticOccurrenceScope({
  rootCriterion: ROOT_CRITERION_A,
});
const ROOT_SCOPE_B = makeSemanticOccurrenceScope({
  rootCriterion: ROOT_CRITERION_B,
});

function branch(
  id: string,
  producerTaskId: string | null,
): CausalSliceArtifact["candidateUniverse"]["branches"][number] {
  return {
    candidateBranchId: id,
    branchKind: producerTaskId === null ? "UNBOUND_READ" : "PHYSICAL_PRODUCER",
    rootTaskId: "100",
    consumerTaskId: "100",
    producerTaskId,
    table:
      producerTaskId === null
        ? null
        : {
            platform: "hive",
            dataSource: "warehouse",
            qualifiedName: "demo.source",
            stableTableId: "source-id",
            identityStatus: "SCHEMA_BACKED",
          },
    readOccurrence:
      producerTaskId === null
        ? null
        : {
            occurrenceId: "read:100:0",
            readRelationId: "relation:100:0",
            statementIndex: 0,
            relationPath: ["relation:100:0"],
          },
    producerRole: producerTaskId === null ? null : "PRIMARY",
    evidenceRefs: [
      {
        evidenceRefId: `candidate-evidence:${id}`,
        source: "TABLE_ARTIFACT",
        locator: id,
      },
    ],
    gapRefs: producerTaskId === null ? ["gap:unbound"] : [],
    boundaryReason:
      producerTaskId === null ? "producer task is unresolved" : null,
  };
}

function artifact(): CausalSliceArtifact {
  const sourceBranch = branch("branch:source", "200");
  const unknownBranch = branch("branch:unknown", null);
  const positiveProof = {
    proofId: "proof:positive",
    rootCriterionId: ROOT_CRITERION_A.rootCriterionId,
    rootTargetFieldId: ROOT,
    candidateBranchId: sourceBranch.candidateBranchId,
    pathCertainty: "CONFIRMED" as const,
    reasonCode: "CONTINUOUS_CONFIRMED_PATH" as const,
    pathIds: ["path:source"],
    edgeIds: ["edge:source"],
    evidenceRefs: ["evidence:source"],
  };
  const negativeProof = {
    proofId: "proof:negative",
    rootCriterionId: ROOT_CRITERION_A.rootCriterionId,
    rootTargetFieldId: ROOT,
    candidateBranchId: "branch:unrelated",
    reasonCode: "EXPLICIT_SAFE_RULES_ONLY" as const,
    checkedObligations: [
      { kind: "VALUE" as const, evidenceRefs: ["negative:value"] },
      { kind: "CONTROL" as const, evidenceRefs: ["negative:control"] },
      { kind: "RELATION" as const, evidenceRefs: ["negative:relation"] },
    ],
    evidenceRefs: ["negative:value", "negative:control", "negative:relation"],
    sourceNegativeProofId: null,
  };
  const traversalEdge = {
    edgeId: "edge:source",
    rootCriterionId: ROOT_CRITERION_A.rootCriterionId,
    fromSemanticScopeId: ROOT_SCOPE_A.semanticScopeId,
    toSemanticScopeId: ROOT_SCOPE_A.semanticScopeId,
    fromTaskId: "100",
    toTaskId: "100",
    fromSubject: {
      subjectKind: "PHYSICAL_FIELD" as const,
      physicalFieldId: SOURCE,
    },
    toSubject: {
      subjectKind: "PHYSICAL_FIELD" as const,
      physicalFieldId: ROOT,
    },
    rootDependenceKind: "VALUE_TO_TARGET" as const,
    localEdgeKind: "VALUE_FLOW" as const,
    frontierKind: "VALUE" as const,
    pathCertainty: "CONFIRMED" as const,
    dependencyId: "dependency:value",
    evidenceRefs: ["evidence:source"],
  };
  return {
    schemaVersion: "2.0.0",
    artifactType: "TARGET_FIELD_CAUSAL_SLICE",
    generatedAt: "2026-08-27T00:00:00Z",
    request: {
      rootTaskId: "100",
      rootTable: "demo.target",
      rootFields: [ROOT],
      rootWriteObservationIds: ["write:100:0", "write:100:1"],
      negativeProofMode: "SAFE_RULES_ONLY",
    },
    rootCriteria: [ROOT_CRITERION_A, ROOT_CRITERION_B],
    semanticScopes: [ROOT_SCOPE_A, ROOT_SCOPE_B],
    scopeGaps: [],
    inputFingerprints: {
      inputPack: [
        { fingerprint: "input-fingerprint", reference: "input-pack" },
      ],
      machineFacts: [
        { fingerprint: "facts-fingerprint", reference: "machine-facts" },
      ],
      producerIndex: [
        { fingerprint: "producer-fingerprint", reference: "producer-index" },
      ],
      tableMultiHopArtifact: [
        { fingerprint: "table-fingerprint", reference: "table-artifact" },
      ],
    },
    dependencies: {
      definitions: [
        {
          dependencyId: "dependency:value",
          semanticScopeId: ROOT_SCOPE_A.semanticScopeId,
          semanticScope: ROOT_SCOPE_A,
          subject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: SOURCE },
          effectKind: "VALUE_CONTRIBUTION",
          operatorKind: "PROJECT",
          operatorVariant: "COLUMN_EXPRESSION",
          operatorRole: "VALUE",
          localEdgeKind: "VALUE_FLOW",
          supportStatus: "SUPPORTED",
          proofRefs: [
            {
              proofRefId: "proof-ref:expression",
              kind: "SOURCE_SPAN",
              refId: "expr:1",
            },
          ],
        },
        {
          dependencyId: "dependency:control",
          semanticScopeId: ROOT_SCOPE_A.semanticScopeId,
          semanticScope: ROOT_SCOPE_A,
          subject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: SOURCE },
          effectKind: "ROW_MEMBERSHIP",
          operatorKind: "FILTER",
          operatorVariant: "WHERE",
          operatorRole: "PREDICATE",
          localEdgeKind: "ROWSET_CONTROL",
          supportStatus: "UNKNOWN",
          proofRefs: [
            {
              proofRefId: "proof-ref:predicate",
              kind: "GAP",
              refId: "gap:predicate",
            },
          ],
        },
      ],
      applications: [
        {
          applicationId: "application:control",
          dependencyId: "dependency:control",
          rootCriterionId: ROOT_CRITERION_A.rootCriterionId,
          semanticScopeId: ROOT_SCOPE_A.semanticScopeId,
          semanticScope: ROOT_SCOPE_A,
          rootTargetFieldId: ROOT,
          rootDependenceKind: "CONTROL_TO_TARGET",
          pathCertainty: "UNKNOWN",
          proofRefs: [],
        },
      ],
      edges: [
        {
          edgeId: "semantic-edge:control",
          fromSubject: {
            subjectKind: "PHYSICAL_FIELD",
            physicalFieldId: SOURCE,
          },
          toSubject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: ROOT },
          dependencyId: "dependency:control",
          rootCriterionId: ROOT_CRITERION_A.rootCriterionId,
          semanticScopeId: ROOT_SCOPE_A.semanticScopeId,
          semanticScope: ROOT_SCOPE_A,
          rootDependenceKind: "CONTROL_TO_TARGET",
          localEdgeKind: "ROWSET_CONTROL",
          pathCertainty: "UNKNOWN",
          proofRefs: [],
        },
      ],
      gaps: [],
    },
    candidateUniverse: {
      rootTaskId: "100",
      status: "INCOMPLETE",
      branches: [
        sourceBranch,
        unknownBranch,
        branch("branch:unrelated", "300"),
      ],
      boundaryGapRefs: ["gap:boundary"],
      coverage: {
        sourceArtifactType: "TABLE_MULTI_HOP_RECONCILIATION",
        sourceCoverageStatus: "INCOMPLETE",
        sourceCoverageSemantics: "OBSERVED_EVIDENCE_ONLY",
        sourceLimitsTruncated: true,
      },
    },
    traversal: {
      options: {
        maxDepth: 10,
        maxValueStates: 20,
        maxValuePaths: 30,
        maxControlStates: 40,
        maxControlPaths: 50,
      },
      roots: [
        {
          rootCriterionId: ROOT_CRITERION_A.rootCriterionId,
          root: {
            rootCriterion: ROOT_CRITERION_A,
            semanticScope: ROOT_SCOPE_A,
            subject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: ROOT },
          },
          visitedStateKeys: [],
          activeCycleChecks: 0,
          frontiers: {
            VALUE: 1,
            EXPRESSION_CONTROL: 0,
            ROWSET_CONTROL: 1,
            WINDOW_CONTEXT: 0,
            RELATION_CONTEXT: 0,
          },
          paths: [],
          gaps: [],
          decision: {
            valuePathCertainty: "CONFIRMED",
            controlPathCertainty: "UNKNOWN",
            valueClosed: true,
            controlClosed: false,
            valueGapIds: [],
            controlGapIds: ["traversal-gap:control"],
          },
        },
        {
          rootCriterionId: ROOT_CRITERION_B.rootCriterionId,
          root: {
            rootCriterion: ROOT_CRITERION_B,
            semanticScope: ROOT_SCOPE_B,
            subject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: ROOT },
          },
          visitedStateKeys: [],
          activeCycleChecks: 0,
          frontiers: {
            VALUE: 0,
            EXPRESSION_CONTROL: 0,
            ROWSET_CONTROL: 0,
            WINDOW_CONTEXT: 0,
            RELATION_CONTEXT: 0,
          },
          paths: [
            {
              pathId: "path:source",
              rootCriterionId: ROOT_CRITERION_A.rootCriterionId,
              rootTargetFieldId: ROOT,
              rootDependenceKind: "VALUE_TO_TARGET",
              edges: [traversalEdge],
              pathCertainty: "CONFIRMED",
            },
          ],
          gaps: [],
          decision: {
            valuePathCertainty: null,
            controlPathCertainty: null,
            valueClosed: false,
            controlClosed: false,
            valueGapIds: [],
            controlGapIds: [],
          },
        },
      ],
      sharedEvidenceRefs: [],
      edges: [traversalEdge],
      gaps: [
        {
          gapId: "traversal-gap:control",
          rootCriterionId: ROOT_CRITERION_A.rootCriterionId,
          semanticScopeId: ROOT_SCOPE_A.semanticScopeId,
          rootTargetFieldId: ROOT,
          taskId: "100",
          subject: null,
          rootDependenceKind: "CONTROL_TO_TARGET",
          frontierKind: "ROWSET_CONTROL",
          reasonCode: "MAX_CONTROL_PATHS_REACHED",
          message: "control path budget reached",
          evidenceRefs: ["evidence:limit"],
          blocksConfirmedCausality: true,
          blocksNegativeProof: true,
        },
      ],
    },
    limits: {
      maxDepth: 10,
      value: { maxStates: 20, maxPaths: 30, truncated: false, reasons: [] },
      control: {
        maxStates: 40,
        maxPaths: 50,
        truncated: true,
        reasons: ["MAX_CONTROL_PATHS_REACHED"],
      },
    },
    assessments: [
      {
        assessmentId: "assessment:confirmed",
        pairId: "pair:confirmed",
        rootCriterionId: ROOT_CRITERION_A.rootCriterionId,
        rootTargetFieldId: ROOT,
        candidateBranchId: sourceBranch.candidateBranchId,
        status: "CONFIRMED_RELATED",
        reasonCode: "CONTINUOUS_CONFIRMED_PATH",
        positiveProofIds: [positiveProof.proofId],
        negativeProofIds: [],
        gapRefs: [],
      },
      {
        assessmentId: "assessment:conditional",
        pairId: "pair:conditional",
        rootCriterionId: ROOT_CRITERION_A.rootCriterionId,
        rootTargetFieldId: ROOT,
        candidateBranchId: "branch:unrelated",
        status: "CONDITIONAL_RELATED",
        reasonCode: "CONTINUOUS_PROVISIONAL_PATH",
        positiveProofIds: [],
        negativeProofIds: [],
        gapRefs: [],
      },
      {
        assessmentId: "assessment:unrelated",
        pairId: "pair:unrelated",
        rootCriterionId: ROOT_CRITERION_A.rootCriterionId,
        rootTargetFieldId: ROOT,
        candidateBranchId: "branch:unrelated",
        status: "PROVEN_UNRELATED",
        reasonCode: "EXPLICIT_SAFE_RULES_ONLY",
        positiveProofIds: [],
        negativeProofIds: [negativeProof.proofId],
        gapRefs: [],
      },
      {
        assessmentId: "assessment:unknown",
        pairId: "pair:unknown",
        rootCriterionId: ROOT_CRITERION_A.rootCriterionId,
        rootTargetFieldId: ROOT,
        candidateBranchId: unknownBranch.candidateBranchId,
        status: "UNKNOWN",
        reasonCode: "BRANCH_BOUNDARY_UNRESOLVED",
        positiveProofIds: [],
        negativeProofIds: [],
        gapRefs: ["gap:unbound"],
      },
    ],
    positiveProofs: [positiveProof],
    negativeProofs: [negativeProof],
    assessmentGaps: [
      {
        gapId: "gap:unbound",
        rootCriterionId: ROOT_CRITERION_A.rootCriterionId,
        rootTargetFieldId: ROOT,
        candidateBranchId: unknownBranch.candidateBranchId,
        reasonCode: "BRANCH_BOUNDARY_UNRESOLVED",
        evidenceRefs: ["evidence:unbound"],
      },
    ],
    rerunSets: {
      minimumConfirmed: {
        kind: "MINIMUM_CONFIRMED",
        taskIds: ["200"],
        entries: [
          {
            taskId: "200",
            unresolvedReason: null,
            triggers: [
              {
                rootCriterionId: ROOT_CRITERION_A.rootCriterionId,
                rootTargetFieldId: ROOT,
                candidateBranchId: sourceBranch.candidateBranchId,
                assessmentId: "assessment:confirmed",
                causalStatus: "CONFIRMED_RELATED",
                positiveProofIds: [positiveProof.proofId],
                negativeProofIds: [],
                gapRefs: [],
              },
            ],
          },
        ],
        unresolved: [],
      },
      conservativeSafety: {
        kind: "CONSERVATIVE_SAFETY",
        taskIds: ["200"],
        entries: [],
        unresolved: [
          {
            taskId: null,
            unresolvedReason: "UNBOUND_READ_TASK_ID_UNRESOLVED",
            triggers: [
              {
                rootCriterionId: ROOT_CRITERION_A.rootCriterionId,
                rootTargetFieldId: ROOT,
                candidateBranchId: unknownBranch.candidateBranchId,
                assessmentId: "assessment:unknown",
                causalStatus: "UNKNOWN",
                positiveProofIds: [],
                negativeProofIds: [],
                gapRefs: ["gap:unbound"],
              },
            ],
          },
        ],
      },
    },
    qualityMetrics: {
      confirmedEvidenceClosureRate: 1,
      closedDecisionCoverage: { numerator: 2, denominator: 4, rate: 0.5 },
      precision: "NOT_EVALUATED",
      recall: "NOT_EVALUATED",
    },
    boundaries: {
      staticSqlOnly: true,
      runtimeExecution: "NOT_EVALUATED",
      dataCorrectness: "NOT_EVALUATED",
      businessAcceptance: "NOT_EVALUATED",
    },
    contentHash: "artifact-hash",
  };
}

function largeArtifact(): CausalSliceArtifact {
  const base = artifact();
  const assessment = base.assessments[0]!;
  const gap = base.assessmentGaps[0]!;
  const assessments = Array.from({ length: 10_000 }, (_, index) => ({
    ...assessment,
    assessmentId: `assessment-large-${String(index).padStart(5, "0")}`,
    pairId: `pair-large-${String(index).padStart(5, "0")}`,
  }));
  const assessmentGaps = Array.from({ length: 10_000 }, (_, index) => ({
    ...gap,
    gapId: `gap-large-${String(index).padStart(5, "0")}`,
  }));
  const entries = Array.from({ length: 10_000 }, (_, index) => ({
    taskId: `task-large-${String(index).padStart(5, "0")}`,
    unresolvedReason: null,
    triggers: [],
  }));
  return {
    ...base,
    assessments,
    assessmentGaps,
    rerunSets: {
      ...base.rerunSets,
      minimumConfirmed: {
        ...base.rerunSets.minimumConfirmed,
        taskIds: entries.map((entry) => entry.taskId),
        entries,
      },
    },
  };
}

describe("causal-slice text formatter", () => {
  it("renders all required independent artifact sections and rerun safety information", () => {
    const output = formatCausalSlice(artifact());

    expect(output).toContain("ASSESSMENTS_BY_ROOT_CRITERION");
    expect(output).toContain(
      `ROOT_CRITERION ${ROOT_CRITERION_A.rootCriterionId}`,
    );
    expect(output).toContain(
      `ROOT_CRITERION ${ROOT_CRITERION_B.rootCriterionId}`,
    );
    expect(output.match(/^  ROOT_CRITERION /gm)).toHaveLength(2);
    expect(output).toContain(`targetField=${ROOT}`);
    expect(output).toContain(
      `writeObservation=${ROOT_CRITERION_A.rootWriteObservationId}`,
    );
    expect(output).toContain(
      `writeObservation=${ROOT_CRITERION_B.rootWriteObservationId}`,
    );
    expect(output).toContain(`semanticScope=${ROOT_SCOPE_A.semanticScopeId}`);
    for (const status of [
      "CONFIRMED_RELATED",
      "CONDITIONAL_RELATED",
      "PROVEN_UNRELATED",
      "UNKNOWN",
    ])
      expect(output).toContain(status);
    expect(output).toContain("candidate=branch:source");
    expect(output).toContain("producerTask=200");
    expect(output).toContain(
      "table=hive/warehouse/demo.source/source-id/SCHEMA_BACKED",
    );
    expect(output).toContain(
      "occurrence=read:100:0;relation:100:0;statement=0;path=relation:100:0",
    );
    expect(output).toContain("positiveProofRefs=proof:positive");
    expect(output).toContain("negativeProofRefs=proof:negative");
    expect(output).toContain("unknownGaps=gap:unbound");
    expect(output).toContain("OPERATOR_SUPPORT_AND_DEPENDENCY_SUMMARY");
    expect(output).toContain("definitions=2 applications=1 edges=1");
    expect(output).toContain(
      `rootCriterion=${ROOT_CRITERION_A.rootCriterionId}`,
    );
    expect(output).toContain(`semanticScope=${ROOT_SCOPE_A.semanticScopeId}`);
    expect(output).toContain(
      `fromScope=${ROOT_SCOPE_A.semanticScopeId} toScope=${ROOT_SCOPE_A.semanticScopeId}`,
    );
    expect(output).toContain("VALUE maxStates=20 maxPaths=30 truncated=false");
    expect(output).toContain("CONTROL maxStates=40 maxPaths=50 truncated=true");
    expect(output).toContain("precision=NOT_EVALUATED recall=NOT_EVALUATED");
    expect(output).toContain("MINIMUM_CONFIRMED_RERUN_SET");
    expect(output).toContain("CONSERVATIVE_SAFETY_RERUN_SET");
    expect(output).toContain(
      "UNRESOLVED_TASK_MAPPING task=- reason=UNBOUND_READ_TASK_ID_UNRESOLVED",
    );
  });

  it("is deterministic and changes only when the supplied artifact changes", () => {
    const first = artifact();
    const second = artifact();
    expect(formatCausalSlice(first)).toBe(formatCausalSlice(second));
    expect(
      formatCausalSlice({ ...first, contentHash: "different-hash" }),
    ).not.toBe(formatCausalSlice(first));
    expect(formatCausalSlice(first)).not.toContain("Date.now");
  });

  it("bounds large detail arrays instead of expanding output linearly", () => {
    const bounded = formatCausalSlice(largeArtifact());
    const baseline = formatCausalSlice({
      ...largeArtifact(),
      assessments: largeArtifact().assessments.slice(0, 200),
      assessmentGaps: largeArtifact().assessmentGaps.slice(0, 200),
    });

    expect(bounded.length).toBeLessThan(baseline.length * 2);
    expect(bounded).toContain("omitted=9800");
    expect(bounded).not.toContain("assessment-large-09999");
    expect(bounded).toContain("contentHash=artifact-hash");
  });
});
