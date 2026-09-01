import { describe, expect, it } from "vitest";

import {
  globalExpressionId,
  globalRelationId,
} from "../../scripts/machine-facts/plan-occurrence-id.ts";
import { renderTargetFieldCausalSliceHtml } from "../../scripts/visualize/target-field-causal-slice-visualize.ts";
import type { CausalSliceArtifact } from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-slice-contract.ts";
import { makeSemanticOccurrenceScope } from "../../scripts/reconcile/consumer/target-field-causal-slice/semantic-dependency-contract.ts";
import {
  canonicalRootCriterionId,
  type RootCriterion,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/write-scoped-plan-inputs.ts";

const ROOT_FIELD = "hive|warehouse|target|demo.target|amount";

function rootCriterion(writeOrdinal: number): RootCriterion {
  const localRootRelationId = `root.project.${writeOrdinal}`;
  const localOutputExpressionId = `${localRootRelationId}:expression:project_expression:0`;
  const value: Omit<RootCriterion, "rootCriterionId"> = {
    rootTaskId: "root-task",
    targetTableKey: "hive|warehouse|target|demo.target",
    targetFieldName: "amount",
    rootTargetFieldId: ROOT_FIELD,
    targetFieldBindingId: `target-binding:${writeOrdinal}`,
    rootWriteObservationId: `write:root:${writeOrdinal}`,
    writeKind: "INSERT",
    sqlSourceId: `sql:root:${writeOrdinal}`,
    sqlSnapshot: `snapshots/sql/root-${writeOrdinal}.sql`,
    sqlSha256: `sql-hash-${writeOrdinal}`,
    writeStatementId: `write-statement:${writeOrdinal}`,
    writeStatementIndex: writeOrdinal,
    statementId: `query-statement:${writeOrdinal}`,
    statementIndex: writeOrdinal,
    queryProducerStatementId: `query-statement:${writeOrdinal}`,
    rootRelationId: globalRelationId(
      "root-task",
      writeOrdinal,
      localRootRelationId,
    ),
    outputExpressionId: globalExpressionId(
      "root-task",
      writeOrdinal,
      localOutputExpressionId,
    ),
    outputBindingId: `output-binding:${writeOrdinal}`,
    sourceOrdinal: 0,
    targetOrdinal: 0,
    producerOutputName: "amount",
    expressionRole: "PROJECT_EXPRESSION",
    localRootRelationId,
    localOutputExpressionId,
    evidenceRefs: [`write:root:${writeOrdinal}`],
  };
  return { rootCriterionId: canonicalRootCriterionId(value), ...value };
}

const ROOT_A = rootCriterion(0);
const ROOT_B = rootCriterion(1);
const SCOPE_A = makeSemanticOccurrenceScope({ rootCriterion: ROOT_A });
const SCOPE_B = makeSemanticOccurrenceScope({ rootCriterion: ROOT_B });

function artifact(): CausalSliceArtifact {
  const root = ROOT_FIELD;
  const source = "hive|warehouse|source|demo.source|amount";
  const edge = {
    edgeId: "edge:source",
    rootCriterionId: ROOT_A.rootCriterionId,
    fromSemanticScopeId: SCOPE_A.semanticScopeId,
    toSemanticScopeId: SCOPE_A.semanticScopeId,
    fromTaskId: "source-task",
    toTaskId: "root-task",
    fromSubject: {
      subjectKind: "PHYSICAL_FIELD" as const,
      physicalFieldId: source,
    },
    toSubject: {
      subjectKind: "PHYSICAL_FIELD" as const,
      physicalFieldId: root,
    },
    rootDependenceKind: "VALUE_TO_TARGET" as const,
    localEdgeKind: "VALUE_FLOW" as const,
    frontierKind: "VALUE" as const,
    pathCertainty: "CONFIRMED" as const,
    dependencyId: "dependency:source",
    readOccurrenceId: "read:root:0",
    evidenceRefs: ["evidence:source"],
  };
  return {
    artifactType: "TARGET_FIELD_CAUSAL_SLICE",
    schemaVersion: "2.0.0",
    generatedAt: "2026-08-27T00:00:00Z",
    request: {
      rootTaskId: "root-task",
      rootTable: "demo.target",
      rootFields: [root],
      rootWriteObservationIds: ["write:root:0", "write:root:1"],
      negativeProofMode: "SAFE_RULES_ONLY",
    },
    rootCriteria: [ROOT_A, ROOT_B],
    semanticScopes: [SCOPE_A, SCOPE_B],
    scopeGaps: [],
    inputFingerprints: {
      inputPack: [],
      machineFacts: [],
      producerIndex: [],
      tableMultiHopArtifact: [],
    },
    dependencies: { definitions: [], applications: [], edges: [], gaps: [] },
    candidateUniverse: {
      rootTaskId: "root-task",
      status: "INCOMPLETE",
      branches: [
        {
          candidateBranchId: "branch:source",
          branchKind: "PHYSICAL_PRODUCER",
          rootTaskId: "root-task",
          consumerTaskId: "root-task",
          producerTaskId: "source-task",
          table: {
            platform: "hive",
            dataSource: "warehouse",
            qualifiedName: "demo.source",
            stableTableId: "source",
            identityStatus: "RESOLVED",
          },
          readOccurrence: {
            occurrenceId: "read:root:0",
            readRelationId: "relation:root:0",
            statementIndex: 0,
            relationPath: ["relation:root:0"],
          },
          producerRole: "PRIMARY",
          evidenceRefs: [],
          gapRefs: [],
          boundaryReason: null,
        },
      ],
      boundaryGapRefs: [],
      coverage: {
        sourceArtifactType: "TABLE_MULTI_HOP_RECONCILIATION",
        sourceCoverageStatus: "COMPLETE",
        sourceCoverageSemantics: "OBSERVED",
        sourceLimitsTruncated: false,
      },
    },
    traversal: {
      options: {
        maxDepth: 10,
        maxValueStates: 20,
        maxValuePaths: 20,
        maxControlStates: 20,
        maxControlPaths: 20,
      },
      roots: [
        {
          rootCriterionId: ROOT_A.rootCriterionId,
          root: {
            rootCriterion: ROOT_A,
            semanticScope: SCOPE_A,
            subject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: root },
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
          paths: [
            {
              pathId: "path:source",
              rootCriterionId: ROOT_A.rootCriterionId,
              rootTargetFieldId: root,
              rootDependenceKind: "VALUE_TO_TARGET",
              edges: [edge],
              pathCertainty: "CONFIRMED",
            },
          ],
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
          rootCriterionId: ROOT_B.rootCriterionId,
          root: {
            rootCriterion: ROOT_B,
            semanticScope: SCOPE_B,
            subject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: root },
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
          paths: [],
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
      sharedEvidenceRefs: ["evidence:source"],
      edges: [edge],
      gaps: [],
    },
    limits: {
      maxDepth: 10,
      value: { maxStates: 20, maxPaths: 20, truncated: false, reasons: [] },
      control: { maxStates: 20, maxPaths: 20, truncated: false, reasons: [] },
    },
    assessments: [
      {
        assessmentId: "assessment:unknown",
        pairId: "pair:source",
        rootCriterionId: ROOT_A.rootCriterionId,
        rootTargetFieldId: root,
        candidateBranchId: "branch:source",
        status: "UNKNOWN",
        reasonCode: "REQUIRED_PATH_UNKNOWN",
        positiveProofIds: [],
        negativeProofIds: [],
        gapRefs: ["gap:source"],
      },
    ],
    positiveProofs: [],
    negativeProofs: [],
    assessmentGaps: [
      {
        gapId: "gap:source",
        rootCriterionId: ROOT_A.rootCriterionId,
        rootTargetFieldId: root,
        candidateBranchId: "branch:source",
        reasonCode: "REQUIRED_PATH_UNKNOWN",
        evidenceRefs: [],
      },
    ],
    rerunSets: {
      minimumConfirmed: {
        kind: "MINIMUM_CONFIRMED",
        taskIds: [],
        entries: [],
        unresolved: [],
      },
      conservativeSafety: {
        kind: "CONSERVATIVE_SAFETY",
        taskIds: ["source-task"],
        entries: [
          {
            taskId: "source-task",
            triggers: [
              {
                rootCriterionId: ROOT_A.rootCriterionId,
                rootTargetFieldId: root,
                candidateBranchId: "branch:source",
                assessmentId: "assessment:unknown",
                causalStatus: "UNKNOWN",
                positiveProofIds: [],
                negativeProofIds: [],
                gapRefs: ["gap:source"],
              },
            ],
            unresolvedReason: null,
          },
        ],
        unresolved: [],
      },
    },
    qualityMetrics: {
      confirmedEvidenceClosureRate: "NOT_APPLICABLE",
      closedDecisionCoverage: { numerator: 0, denominator: 1, rate: 0 },
      precision: "NOT_EVALUATED",
      recall: "NOT_EVALUATED",
    },
    boundaries: {
      staticSqlOnly: true,
      runtimeExecution: "NOT_EVALUATED",
      dataCorrectness: "NOT_EVALUATED",
      businessAcceptance: "NOT_EVALUATED",
    },
    contentHash: "hash",
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

describe("target-field causal-slice renderer", () => {
  it("renders only artifact-backed paths, coverage, decisions, evidence, limits, metrics, and reruns deterministically", () => {
    const first = renderTargetFieldCausalSliceHtml(artifact());
    const second = renderTargetFieldCausalSliceHtml(artifact());
    expect(first).toBe(second);
    for (const marker of [
      "因果路径",
      "Candidate Universe 与覆盖",
      "四类 assessment",
      "Proof / gap drill-down",
      "独立 limits 与质量指标",
      "Minimum confirmed rerun set",
      "Conservative safety rerun set",
      "edge:source",
      "gap:source",
    ])
      expect(first).toContain(marker);
    expect(first).toContain(ROOT_A.rootCriterionId);
    expect(first).toContain(ROOT_B.rootCriterionId);
    expect(first).toContain(`write:root:0`);
    expect(first).toContain(`write:root:1`);
    expect(first).toContain(SCOPE_A.semanticScopeId);
    expect(first).toContain(SCOPE_B.semanticScopeId);
    expect(first).toContain("from semantic scope");
    expect(first).toContain("to semantic scope");
    expect(first).not.toContain("field-lineage");
    expect(first).toContain('href="target-field-causal-slice.json"');
    expect(first).not.toContain("window.__TARGET_FIELD_CAUSAL_SLICE__");
  });

  it("renders trusted list markup in table cells while escaping list values", () => {
    const value = artifact();
    const unsafe = '<script>alert("x")</script>';
    const rendered = renderTargetFieldCausalSliceHtml({
      ...value,
      candidateUniverse: {
        ...value.candidateUniverse,
        branches: value.candidateUniverse.branches.map((branch, index) =>
          index === 0 ? { ...branch, gapRefs: [unsafe] } : branch
        ),
      },
    });

    expect(rendered).toContain("<td><ul><li>");
    expect(rendered).toContain(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(rendered).not.toContain(unsafe);
    expect(rendered).not.toContain("&lt;ul&gt;");
  });

  it("bounds large detail arrays and does not embed the canonical artifact", () => {
    const bounded = renderTargetFieldCausalSliceHtml(largeArtifact());
    const baseline = renderTargetFieldCausalSliceHtml({
      ...largeArtifact(),
      assessments: largeArtifact().assessments.slice(0, 200),
      assessmentGaps: largeArtifact().assessmentGaps.slice(0, 200),
    });

    expect(bounded.length).toBeLessThan(baseline.length * 2);
    expect(bounded).toContain("omitted=9800");
    expect(bounded).not.toContain("assessment-large-09999");
    expect(bounded).not.toContain("window.__TARGET_FIELD_CAUSAL_SLICE__");
    expect(bounded).toContain("target-field-causal-slice.json");
    expect(bounded).toContain("hash");
  });
});
