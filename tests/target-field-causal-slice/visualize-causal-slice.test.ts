import { describe, expect, it } from "vitest";

import { renderTargetFieldCausalSliceHtml } from "../../scripts/visualize/target-field-causal-slice-visualize.ts";
import type { CausalSliceArtifact } from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-slice-contract.ts";

function artifact(): CausalSliceArtifact {
  const root = "hive|warehouse|target|demo.target|amount";
  const source = "hive|warehouse|source|demo.source|amount";
  const edge = {
    edgeId: "edge:source",
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
    schemaVersion: "1.0.0",
    generatedAt: "2026-08-27T00:00:00Z",
    request: {
      rootTaskId: "root-task",
      rootTable: "demo.target",
      rootFields: [root],
      rootWriteObservationIds: ["write:root:0"],
      negativeProofMode: "SAFE_RULES_ONLY",
    },
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
          root: { rootTargetFieldId: root, taskId: "root-task" },
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
    expect(first).not.toContain("field-lineage");
    expect(first).toContain('href="target-field-causal-slice.json"');
    expect(first).not.toContain("window.__TARGET_FIELD_CAUSAL_SLICE__");
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
