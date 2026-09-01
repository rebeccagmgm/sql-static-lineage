import { describe, expect, it } from "vitest";

import {
  globalExpressionId,
  globalRelationId,
} from "../../scripts/machine-facts/plan-occurrence-id.ts";
import type {
  PhysicalFieldExpansion,
  PhysicalFieldIdentity,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/canonical-evidence-adapter.ts";
import {
  traverseCausalDependencies,
  type CausalTraversalInput,
  type CausalTraversalRoot,
  type SemanticTraversalLoadRequest,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-traversal.ts";
import { assessPositiveCausalRelationships } from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-assessment.ts";
import { assessNegativeCausalRelationships } from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-negative-proof.ts";
import {
  buildAssessmentPairSkeleton,
  type CandidateBranch,
  type CandidateUniverse,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/candidate-universe.ts";
import {
  createProofRef,
  makeSemanticDependencyEdge,
  makeSemanticOccurrenceScope,
  type LocalEdgeKind,
  type ProofRef,
  type RootDependenceKind,
  type SemanticDependencyEdge,
  type PhysicalFieldSubject,
  type SemanticSubject,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/semantic-dependency-contract.ts";
import type { RootCriterion } from "../../scripts/reconcile/consumer/target-field-causal-slice/write-scoped-plan-inputs.ts";

const target = (name: string): PhysicalFieldIdentity => ({
  platform: "hive",
  dataSource: "horae",
  stableTableId: "table-1",
  qualifiedName: "db.target",
  column: name,
  identityStatus: "SCHEMA_BACKED",
});

const upstream = (
  name: string,
  table = "db.source",
): PhysicalFieldIdentity => ({
  platform: "hive",
  dataSource: "horae",
  stableTableId: table === "db.source" ? "table-2" : "table-3",
  qualifiedName: table,
  column: name,
  identityStatus: "SCHEMA_BACKED",
});

function fieldSubject(field: PhysicalFieldIdentity): PhysicalFieldSubject {
  return {
    subjectKind: "PHYSICAL_FIELD",
    physicalFieldId: [
      field.platform,
      field.dataSource,
      field.stableTableId,
      field.qualifiedName,
      field.column,
    ]
      .map((part) => part.toLowerCase())
      .join("|"),
  };
}

function relationSubject(id: string): SemanticSubject {
  return { subjectKind: "RELATION_OCCURRENCE", relationOccurrenceId: id };
}

function physicalId(subject: SemanticSubject): string {
  if (subject.subjectKind !== "PHYSICAL_FIELD")
    throw new Error("expected physical field");
  return subject.physicalFieldId;
}

interface TestTraversalRoot {
  readonly rootTargetFieldId: string;
  readonly taskId: string;
  readonly subject?: SemanticSubject;
}

interface TestSemanticDependency {
  readonly dependencyId: string;
  readonly fromSubject: SemanticSubject;
  readonly toSubject: SemanticSubject;
  readonly rootDependenceKind: RootDependenceKind;
  readonly localEdgeKind: LocalEdgeKind;
  readonly pathCertainty: "CONFIRMED" | "CONDITIONAL" | "UNKNOWN";
  readonly proofRefs: readonly ProofRef[];
}

function rootCriterion(
  taskId: string,
  rootTargetFieldId: string,
  writeTag: string,
): RootCriterion {
  const statementIndex = 0;
  const safeTag = writeTag.replace(/[^a-z0-9_-]/gi, "_");
  const statementId = `task:${taskId}:statement:0`;
  const localRootRelationId = `root.${safeTag}.project`;
  const localOutputExpressionId = `${localRootRelationId}:expression:project_expression:0`;
  const rootRelationId = globalRelationId(
    taskId,
    statementIndex,
    localRootRelationId,
  );
  const outputExpressionId = globalExpressionId(
    taskId,
    statementIndex,
    localOutputExpressionId,
  );
  const column = rootTargetFieldId.split("|").at(-1) ?? "field";
  const writeObservationId = `write-observation:${taskId}:${safeTag}`;
  return {
    rootCriterionId: `root-criterion:${writeObservationId}:${rootTargetFieldId}`,
    rootTaskId: taskId,
    targetTableKey: rootTargetFieldId.split("|").slice(0, 4).join("|"),
    targetFieldName: column,
    rootTargetFieldId,
    targetFieldBindingId: `target-field-binding:${taskId}:${safeTag}`,
    rootWriteObservationId: writeObservationId,
    writeKind: "TEST",
    sqlSourceId: `sql:${taskId}:fixture`,
    sqlSnapshot: `snapshots/sql/${taskId}.sql`,
    sqlSha256: "fixture",
    writeStatementId: statementId,
    writeStatementIndex: statementIndex,
    statementId,
    statementIndex,
    queryProducerStatementId: statementId,
    rootRelationId,
    outputExpressionId,
    outputBindingId: `output-binding:${taskId}:${safeTag}`,
    sourceOrdinal: 0,
    targetOrdinal: 0,
    producerOutputName: column,
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

function scopedRoot(
  root: TestTraversalRoot,
  ordinal: number,
): CausalTraversalRoot {
  const criterion = rootCriterion(
    root.taskId,
    root.rootTargetFieldId,
    `root-${ordinal}-${root.rootTargetFieldId}`,
  );
  return {
    rootCriterion: criterion,
    semanticScope: makeSemanticOccurrenceScope({ rootCriterion: criterion }),
    ...(root.subject === undefined ? {} : { subject: root.subject }),
  };
}

function producerScope(
  taskId: string,
  physicalFieldId: string,
  writeTag: string,
) {
  const producerRootCriterion = rootCriterion(
    taskId,
    physicalFieldId,
    writeTag,
  );
  return {
    producerRootCriterion,
    producerSemanticScope: makeSemanticOccurrenceScope({
      rootCriterion: producerRootCriterion,
    }),
  };
}

function normalization(
  root: SemanticSubject,
  from: SemanticSubject,
  localEdgeKind: LocalEdgeKind,
  rootDependenceKind: RootDependenceKind = localEdgeKind === "VALUE_FLOW"
    ? "VALUE_TO_TARGET"
    : "CONTROL_TO_TARGET",
  certainty: "CONFIRMED" | "CONDITIONAL" | "UNKNOWN" = "CONFIRMED",
  dependencyId = `${localEdgeKind}:${JSON.stringify(from)}`,
  proofRefs: readonly ProofRef[] = [],
): TestSemanticDependency {
  return {
    dependencyId,
    fromSubject: from,
    toSubject: root,
    rootDependenceKind,
    localEdgeKind,
    pathCertainty: certainty,
    proofRefs,
  };
}

function input(
  roots: readonly TestTraversalRoot[],
  slices: readonly [string, readonly TestSemanticDependency[]][],
  expandPhysicalField: CausalTraversalInput["expandPhysicalField"],
  options?: CausalTraversalInput["options"],
): CausalTraversalInput {
  const scopedRoots = roots.map(scopedRoot);
  const dependenciesByTask = new Map(slices);
  const identities = new Map<string, PhysicalFieldIdentity>();
  for (const field of [
    target("amount"),
    target("price"),
    upstream("status"),
    upstream("amount"),
  ]) {
    identities.set(physicalId(fieldSubject(field)), field);
  }
  return {
    roots: scopedRoots,
    semanticDependencies: new Map(),
    loadSemanticEdges: (request: SemanticTraversalLoadRequest) => ({
      edges: (dependenciesByTask.get(request.taskId) ?? [])
        .filter(
          (dependency) =>
            JSON.stringify(dependency.toSubject) ===
            JSON.stringify(request.subject),
        )
        .map((dependency) =>
          makeSemanticDependencyEdge({
            ...dependency,
            rootCriterionId: request.rootCriterion.rootCriterionId,
            semanticScope: request.semanticScope,
          }),
        ),
      gaps: [],
    }),
    resolvePhysicalField: (physicalFieldId) =>
      identities.get(physicalFieldId) ?? null,
    expandPhysicalField,
    resolveProducerScopes: (request) => {
      const producerRoot = rootCriterion(
        request.producerTaskId,
        physicalId(fieldSubject(request.producerField)),
        request.readOccurrenceId ?? "producer",
      );
      return [
        {
          localRootCriterion: producerRoot,
          semanticScope: makeSemanticOccurrenceScope({
            rootCriterion: producerRoot,
          }),
        },
      ];
    },
    options,
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

function producerExpansion(
  producerTaskId: string,
  producerField: PhysicalFieldIdentity,
  readOccurrenceIds = ["read-1"],
  evidenceStatus:
    "CONFIRMED" | "PROVISIONAL_LEGACY" | "UNRESOLVED" = "CONFIRMED",
): PhysicalFieldExpansion {
  return {
    classified: true,
    ambiguous: false,
    candidates: [],
    gaps: [],
    producers: [
      {
        producerTaskId,
        producerPack: null,
        producerField,
        producerBindings: [{ binding_id: `binding:${producerTaskId}` }],
        bridge: { readOccurrence: { occurrenceId: readOccurrenceIds[0] } },
        bridges: readOccurrenceIds.map((occurrenceId) => ({
          readOccurrence: { occurrenceId },
        })),
        producerRole: "PRIMARY",
        evidenceStatus,
        evidenceRefs: [`bridge:${producerTaskId}`],
        shouldRecurse: true,
      },
    ],
  };
}

describe("causal traversal", () => {
  it("keeps each root target field's visited and decision state independent", () => {
    const amount = fieldSubject(target("amount"));
    const price = fieldSubject(target("price"));
    const sourceAmount = fieldSubject(upstream("amount"));
    const sourceStatus = fieldSubject(upstream("status"));
    const result = traverseCausalDependencies(
      input(
        [
          {
            rootTargetFieldId: physicalId(amount),
            taskId: "task-root",
            subject: amount,
          },
          {
            rootTargetFieldId: physicalId(price),
            taskId: "task-root",
            subject: price,
          },
        ],
        [
          [
            "task-root",
            [
              normalization(amount, sourceAmount, "VALUE_FLOW"),
              normalization(
                price,
                sourceStatus,
                "ROWSET_CONTROL",
                "CONTROL_TO_TARGET",
                "UNKNOWN",
              ),
            ],
          ],
          ["task-source", []],
        ],
        () => noExpansion(),
      ),
    );
    const amountResult = result.roots.find(
      (root) =>
        root.root.rootCriterion.rootTargetFieldId === physicalId(amount),
    )!;
    const priceResult = result.roots.find(
      (root) => root.root.rootCriterion.rootTargetFieldId === physicalId(price),
    )!;
    expect(amountResult.decision.valuePathCertainty).toBe("CONFIRMED");
    expect(amountResult.decision.controlPathCertainty).toBeNull();
    expect(priceResult.decision.controlPathCertainty).toBe("UNKNOWN");
    expect(priceResult.decision.controlGapIds.length).toBeGreaterThan(0);
    expect(amountResult.visitedStateKeys).not.toEqual(
      priceResult.visitedStateKeys,
    );
  });

  it("preserves control root reason while recording VALUE_FLOW across a producer bridge", () => {
    const root = fieldSubject(target("amount"));
    const control = fieldSubject(upstream("status"));
    const producer = upstream("status", "db.control");
    const producerSubject = fieldSubject(producer);
    const result = traverseCausalDependencies(
      input(
        [
          {
            rootTargetFieldId: physicalId(root),
            taskId: "task-root",
            subject: root,
          },
        ],
        [
          [
            "task-root",
            [
              normalization(
                root,
                control,
                "ROWSET_CONTROL",
                "CONTROL_TO_TARGET",
              ),
            ],
          ],
          [
            "task-control",
            [
              normalization(
                control,
                producerSubject,
                "VALUE_FLOW",
                "CONTROL_TO_TARGET",
              ),
            ],
          ],
        ],
        (request) =>
          request.taskId === "task-root"
            ? producerExpansion("task-control", producer)
            : noExpansion(),
      ),
    );
    const edges = result.roots[0]!.paths.flatMap((path) => path.edges);
    expect(edges.some((edge) => edge.localEdgeKind === "ROWSET_CONTROL")).toBe(
      true,
    );
    expect(
      edges.some(
        (edge) =>
          edge.localEdgeKind === "VALUE_FLOW" &&
          edge.rootDependenceKind === "CONTROL_TO_TARGET",
      ),
    ).toBe(true);
  });

  it("isolates repeated read occurrences into separate states and deterministic paths", () => {
    const root = fieldSubject(target("amount"));
    const source = fieldSubject(upstream("amount"));
    const result = traverseCausalDependencies(
      input(
        [
          {
            rootTargetFieldId: physicalId(root),
            taskId: "task-root",
            subject: root,
          },
        ],
        [["task-root", [normalization(root, source, "VALUE_FLOW")]]],
        (request) =>
          request.taskId === "task-root"
            ? producerExpansion("task-producer", upstream("amount"), [
                "read-a",
                "read-b",
              ])
            : noExpansion(),
      ),
    );
    const rootResult = result.roots[0]!;
    expect(
      rootResult.visitedStateKeys.filter((key) =>
        key.includes('"readOccurrenceId":"read-a"'),
      ).length,
    ).toBe(1);
    expect(
      rootResult.visitedStateKeys.filter((key) =>
        key.includes('"readOccurrenceId":"read-b"'),
      ).length,
    ).toBe(1);
    expect(rootResult.paths.map((path) => path.pathId)).toEqual(
      [...rootResult.paths.map((path) => path.pathId)].sort(),
    );
    expect(
      rootResult.paths
        .flatMap((path) => path.edges)
        .filter((edge) => edge.fromTaskId !== edge.toTaskId)
        .map((edge) => edge.readOccurrenceId)
        .filter((value): value is string => value !== undefined)
        .sort(),
    ).toEqual(["read-a", "read-b"]);
  });

  it("blocks a producer bridge whose strict output binding scope is missing", () => {
    const root = fieldSubject(target("amount"));
    const source = fieldSubject(upstream("amount"));
    const unresolved = producerExpansion("task-producer", upstream("amount"));
    const result = traverseCausalDependencies(
      input(
        [
          {
            rootTargetFieldId: physicalId(root),
            taskId: "task-root",
            subject: root,
          },
        ],
        [["task-root", [normalization(root, source, "VALUE_FLOW")]]],
        () => ({
          ...unresolved,
          producers: unresolved.producers.map((producer) => ({
            ...producer,
            producerBindings: [],
          })),
        }),
      ),
    );

    expect(
      result.roots[0]!.gaps.find(
        (gap) => gap.reasonCode === "PRODUCER_SCOPE_UNRESOLVED",
      ),
    ).toMatchObject({
      rootCriterionId: result.roots[0]!.rootCriterionId,
      blocksConfirmedCausality: true,
      blocksNegativeProof: true,
    });
    expect(
      result.roots[0]!.paths.flatMap((path) => path.edges).some(
        (edge) => edge.fromTaskId === "task-producer",
      ),
    ).toBe(false);
    expect(result.roots[0]!.decision.valueClosed).toBe(false);
  });

  it("emits a dual-blocking gap for an unresolved physical producer bridge", () => {
    const root = fieldSubject(target("amount"));
    const source = fieldSubject(upstream("amount"));
    const result = traverseCausalDependencies(
      input(
        [
          {
            rootTargetFieldId: physicalId(root),
            taskId: "task-root",
            subject: root,
          },
        ],
        [["task-root", [normalization(root, source, "VALUE_FLOW")]]],
        (request) =>
          request.taskId === "task-root"
            ? producerExpansion(
                "task-producer",
                upstream("amount"),
                ["read-unresolved"],
                "UNRESOLVED",
              )
            : noExpansion(),
      ),
    );
    const rootResult = result.roots[0]!;
    const unresolvedBridgeGap = rootResult.gaps.find(
      (gap) =>
        gap.reasonCode === "REQUIRED_EVIDENCE_UNRESOLVED" &&
        gap.readOccurrenceId === "read-unresolved",
    );

    expect(
      rootResult.paths.some((path) => path.pathCertainty === "UNKNOWN"),
    ).toBe(true);
    expect(unresolvedBridgeGap).toMatchObject({
      rootCriterionId: rootResult.rootCriterionId,
      taskId: "task-producer",
      reasonCode: "REQUIRED_EVIDENCE_UNRESOLVED",
      blocksConfirmedCausality: true,
      blocksNegativeProof: true,
    });
    expect(unresolvedBridgeGap?.semanticScopeId).toBeTruthy();
    expect(rootResult.decision.valueClosed).toBe(false);
  });

  it("keeps fieldless relation dependencies and blocks closure without a relation expander", () => {
    const root = fieldSubject(target("amount"));
    const relation = relationSubject("relation:0:read-b");
    const sourceRef = createProofRef(
      "SOURCE_SPAN",
      "plan:relation:read-b:10:20",
    );
    const result = traverseCausalDependencies(
      input(
        [
          {
            rootTargetFieldId: physicalId(root),
            taskId: "task-root",
            subject: root,
          },
        ],
        [
          [
            "task-root",
            [
              normalization(
                root,
                relation,
                "RELATION_CONTEXT",
                "RELATION_TO_TARGET",
                "CONFIRMED",
                "relation:read-b",
                [sourceRef],
              ),
            ],
          ],
        ],
        undefined,
      ),
    );
    const path = result.roots[0]!.paths[0]!;
    expect(path.edges[0]!.fromSubject).toEqual(relation);
    expect(
      result.roots[0]!.gaps.some(
        (gap) => gap.reasonCode === "PHYSICAL_EXPANSION_UNAVAILABLE",
      ),
    ).toBe(false);
    const gap = result.roots[0]!.gaps.find(
      (candidate) => candidate.reasonCode === "RELATION_EXPANSION_UNAVAILABLE",
    );
    expect(gap?.subject).toEqual(relation);
    expect(gap?.rootDependenceKind).toBe("RELATION_TO_TARGET");
    expect(gap?.evidenceRefs).toContain(sourceRef.refId);
    expect(gap?.blocksNegativeProof).toBe(true);
    expect(result.roots[0]!.decision.controlClosed).toBe(false);
  });

  it("bridges a fieldless relation dependency to an exact producer occurrence", () => {
    const root = fieldSubject(target("amount"));
    const relation = relationSubject("relation:0:read-b");
    const producer = producerScope(
      "task-producer",
      physicalId(root),
      "relation-read-b",
    );
    const result = traverseCausalDependencies({
      ...input(
        [
          {
            rootTargetFieldId: physicalId(root),
            taskId: "task-root",
            subject: root,
          },
        ],
        [
          [
            "task-root",
            [
              normalization(
                root,
                relation,
                "RELATION_CONTEXT",
                "RELATION_TO_TARGET",
              ),
            ],
          ],
        ],
        undefined,
        { maxValueStates: 0, maxControlStates: 10, maxControlPaths: 10 },
      ),
      expandRelationOccurrence: () => ({
        relationBridges: [
          {
            producerTaskId: "task-producer",
            readOccurrenceId: "read-b",
            ...producer,
            evidenceStatus: "CONFIRMED",
            evidenceRefs: ["table-bridge:read-b"],
          },
        ],
      }),
    });
    const paths = result.roots[0]!.paths;
    const path = paths.find((candidate) =>
      candidate.edges.some(
        (edge) =>
          edge.localEdgeKind === "RELATION_CONTEXT" &&
          edge.fromTaskId === "task-producer" &&
          edge.readOccurrenceId === "read-b",
      ),
    );
    expect(path).toBeDefined();
    expect(path!.edges.at(-1)).toMatchObject({
      fromTaskId: "task-producer",
      toTaskId: "task-root",
      fromSubject: relation,
      toSubject: relation,
      localEdgeKind: "RELATION_CONTEXT",
      readOccurrenceId: "read-b",
    });
    expect(path!.edges.at(-1)!.evidenceRefs).toContain("table-bridge:read-b");
    expect(
      result.roots[0]!.gaps.some(
        (gap) =>
          gap.reasonCode === "PRODUCER_RELATION_FRONTIER_UNEXPANDED" &&
          gap.taskId === "task-producer" &&
          gap.readOccurrenceId === "read-b",
      ),
    ).toBe(true);
    expect(result.roots[0]!.decision.controlClosed).toBe(false);
    expect(result.roots[0]!.decision.valueClosed).toBe(true);
  });

  it("blocks a negative claim for a grandparent behind an unexpanded relation producer frontier", () => {
    const root = fieldSubject(target("amount"));
    const relation = relationSubject("relation:0:read-mid");
    const base = input(
      [
        {
          rootTargetFieldId: physicalId(root),
          taskId: "task-root",
          subject: root,
        },
      ],
      [
        [
          "task-root",
          [
            normalization(
              root,
              relation,
              "RELATION_CONTEXT",
              "RELATION_TO_TARGET",
              "CONFIRMED",
              "relation-context:root-to-mid",
              [createProofRef("SOURCE_SPAN", "source:root-relation")],
            ),
          ],
        ],
      ],
      undefined,
    );
    const midScope = producerScope(
      "task-mid",
      physicalId(root),
      "relation-read-mid",
    );
    const traversal = traverseCausalDependencies({
      ...base,
      expandRelationOccurrence: () => ({
        relationBridges: [
          {
            producerTaskId: "task-mid",
            readOccurrenceId: "read-mid",
            ...midScope,
            evidenceStatus: "CONFIRMED",
            evidenceRefs: ["bridge:root-to-mid", "source:relation-read-mid"],
          },
        ],
        relationOccurrences: [],
      }),
    });
    const criterion = base.roots[0]!.rootCriterion;
    const obligations = [
      { kind: "VALUE" as const, evidenceRefs: ["grand:value-checked"] },
      { kind: "CONTROL" as const, evidenceRefs: ["grand:control-checked"] },
      { kind: "RELATION" as const, evidenceRefs: ["grand:relation-checked"] },
    ];
    const branch = (
      candidateBranchId: string,
      consumerTaskId: string,
      producerTaskId: string,
      occurrenceId: string,
      qualifiedName: string,
      evidenceRefIds: readonly string[],
    ): CandidateBranch => ({
      candidateBranchId,
      branchKind: "PHYSICAL_PRODUCER",
      rootTaskId: "task-root",
      consumerTaskId,
      producerTaskId,
      table: {
        platform: "hive",
        dataSource: "horae",
        qualifiedName,
        stableTableId: `${qualifiedName}__horae`,
        identityStatus: "SCHEMA_BACKED",
      },
      readOccurrence: {
        occurrenceId,
        readRelationId: `relation:${occurrenceId}`,
        statementIndex: 0,
        relationPath: [`relation:${occurrenceId}`],
      },
      producerRole: "PRIMARY",
      evidenceRefs: evidenceRefIds.map((evidenceRefId) => ({
        evidenceRefId,
        source: "OCCURRENCE_SCOPED_NEGATIVE_OBLIGATION",
        locator: `${candidateBranchId}:${evidenceRefId}`,
      })),
      gapRefs: [],
      boundaryReason: null,
    });
    const immediate = branch(
      "branch:mid",
      "task-root",
      "task-mid",
      "read-mid",
      "db.mid",
      ["branch:mid"],
    );
    const grandparent = branch(
      "branch:grand",
      "task-mid",
      "task-grand",
      "read-grand",
      "db.grand",
      obligations.flatMap((obligation) => obligation.evidenceRefs),
    );
    const candidateUniverse: CandidateUniverse = {
      rootTaskId: "task-root",
      status: "COMPLETE_OBSERVED_EVIDENCE",
      branches: [immediate, grandparent],
      boundaryGapRefs: [],
      coverage: {
        sourceArtifactType: "TABLE_MULTI_HOP_RECONCILIATION",
        sourceCoverageStatus: "COMPLETE_OBSERVED_EVIDENCE",
        sourceCoverageSemantics: "OBSERVED_EVIDENCE_ONLY",
        sourceLimitsTruncated: false,
      },
    };
    const assessmentPairs = buildAssessmentPairSkeleton(
      [criterion],
      candidateUniverse.branches,
    );
    const positive = assessPositiveCausalRelationships({
      candidateUniverse,
      traversal,
      rootCriteria: [criterion],
      assessmentPairs,
    });
    const negative = assessNegativeCausalRelationships({
      candidateUniverse,
      traversal,
      rootCriteria: [criterion],
      assessments: positive.assessments,
      negativeProofRequests: [
        {
          mode: "SAFE_RULES_ONLY",
          rootCriterionId: criterion.rootCriterionId,
          rootTargetFieldId: criterion.rootTargetFieldId,
          candidateBranchId: grandparent.candidateBranchId,
          checkedObligations: obligations,
        },
      ],
    });

    expect(
      positive.assessments.find(
        (assessment) =>
          assessment.candidateBranchId === immediate.candidateBranchId,
      )?.status,
    ).toBe("CONFIRMED_RELATED");
    expect(
      traversal.gaps.find(
        (gap) =>
          gap.reasonCode === "PRODUCER_RELATION_FRONTIER_UNEXPANDED" &&
          gap.taskId === "task-mid" &&
          gap.readOccurrenceId === "read-mid",
      ),
    ).toMatchObject({
      rootCriterionId: criterion.rootCriterionId,
      semanticScopeId: midScope.producerSemanticScope.semanticScopeId,
      rootDependenceKind: "RELATION_TO_TARGET",
      frontierKind: "RELATION_CONTEXT",
      blocksConfirmedCausality: true,
      blocksNegativeProof: true,
    });
    expect(traversal.roots[0]!.decision.controlClosed).toBe(false);
    expect(
      negative.assessments.find(
        (assessment) =>
          assessment.candidateBranchId === grandparent.candidateBranchId,
      )?.status,
    ).toBe("UNKNOWN");
    expect(
      negative.assessments.some(
        (assessment) => assessment.status === "PROVEN_UNRELATED",
      ),
    ).toBe(false);
  });

  it("keeps upstream VALUE_FLOW on the control path budget", () => {
    const root = fieldSubject(target("amount"));
    const control = fieldSubject(upstream("status"));
    const value = fieldSubject(upstream("amount"));
    const result = traverseCausalDependencies(
      input(
        [
          {
            rootTargetFieldId: physicalId(root),
            taskId: "task-root",
            subject: root,
          },
        ],
        [
          [
            "task-root",
            [
              normalization(
                root,
                control,
                "ROWSET_CONTROL",
                "CONTROL_TO_TARGET",
              ),
              normalization(control, value, "VALUE_FLOW"),
            ],
          ],
        ],
        () => noExpansion(),
        { maxValuePaths: 0, maxControlPaths: 1 },
      ),
    );

    const gap = result.gaps.find(
      (candidate) => candidate.reasonCode === "MAX_CONTROL_PATHS_REACHED",
    );
    expect(gap?.rootDependenceKind).toBe("CONTROL_TO_TARGET");
    expect(gap?.frontierKind).toBe("VALUE");
    expect(
      result.edges.some(
        (edge) =>
          edge.localEdgeKind === "VALUE_FLOW" &&
          edge.rootDependenceKind === "CONTROL_TO_TARGET",
      ),
    ).toBe(false);
    expect(
      result.gaps.some(
        (candidate) => candidate.reasonCode === "MAX_VALUE_PATHS_REACHED",
      ),
    ).toBe(false);
    expect(result.roots[0]!.decision.valueClosed).toBe(true);
    expect(result.roots[0]!.decision.controlClosed).toBe(false);
  });

  it("keeps an upstream VALUE frontier on the control state budget", () => {
    const root = fieldSubject(target("amount"));
    const control = fieldSubject(upstream("status"));
    const value = fieldSubject(upstream("amount"));
    const result = traverseCausalDependencies(
      input(
        [
          {
            rootTargetFieldId: physicalId(root),
            taskId: "task-root",
            subject: root,
          },
        ],
        [
          [
            "task-root",
            [
              normalization(
                root,
                control,
                "ROWSET_CONTROL",
                "CONTROL_TO_TARGET",
              ),
              normalization(control, value, "VALUE_FLOW"),
            ],
          ],
        ],
        () => noExpansion(),
        {
          maxValueStates: 10,
          maxControlStates: 1,
          maxValuePaths: 10,
          maxControlPaths: 10,
        },
      ),
    );

    const gap = result.gaps.find(
      (candidate) => candidate.reasonCode === "MAX_CONTROL_STATES_REACHED",
    );
    expect(gap?.rootDependenceKind).toBe("CONTROL_TO_TARGET");
    expect(gap?.frontierKind).toBe("VALUE");
    expect(
      result.gaps.some(
        (candidate) => candidate.reasonCode === "MAX_VALUE_STATES_REACHED",
      ),
    ).toBe(false);
    expect(result.roots[0]!.frontiers.VALUE).toBe(1);
    expect(result.roots[0]!.decision.valueClosed).toBe(true);
    expect(result.roots[0]!.decision.controlClosed).toBe(false);
  });

  it("charges a producer VALUE_FLOW bridge on a control path to control", () => {
    const root = fieldSubject(target("amount"));
    const control = fieldSubject(upstream("status"));
    const result = traverseCausalDependencies(
      input(
        [
          {
            rootTargetFieldId: physicalId(root),
            taskId: "task-root",
            subject: root,
          },
        ],
        [
          [
            "task-root",
            [
              normalization(
                root,
                control,
                "ROWSET_CONTROL",
                "CONTROL_TO_TARGET",
              ),
            ],
          ],
        ],
        () => producerExpansion("task-control", upstream("status")),
        { maxValuePaths: 0, maxControlPaths: 1 },
      ),
    );

    const gap = result.gaps.find(
      (candidate) => candidate.reasonCode === "MAX_CONTROL_PATHS_REACHED",
    );
    expect(gap?.rootDependenceKind).toBe("CONTROL_TO_TARGET");
    expect(gap?.frontierKind).toBe("VALUE");
    expect(
      result.gaps.some(
        (candidate) => candidate.reasonCode === "MAX_VALUE_PATHS_REACHED",
      ),
    ).toBe(false);
    expect(result.roots[0]!.decision.valueClosed).toBe(true);
    expect(result.roots[0]!.decision.controlClosed).toBe(false);
  });

  it("charges an ordinary value path to the value budget", () => {
    const root = fieldSubject(target("amount"));
    const value = fieldSubject(upstream("amount"));
    const result = traverseCausalDependencies(
      input(
        [
          {
            rootTargetFieldId: physicalId(root),
            taskId: "task-root",
            subject: root,
          },
        ],
        [["task-root", [normalization(root, value, "VALUE_FLOW")]]],
        () => noExpansion(),
        { maxValuePaths: 0, maxControlPaths: 10 },
      ),
    );

    const gap = result.gaps.find(
      (candidate) => candidate.reasonCode === "MAX_VALUE_PATHS_REACHED",
    );
    expect(gap?.rootDependenceKind).toBe("VALUE_TO_TARGET");
    expect(gap?.frontierKind).toBe("VALUE");
    expect(
      result.gaps.some(
        (candidate) => candidate.reasonCode === "MAX_CONTROL_PATHS_REACHED",
      ),
    ).toBe(false);
    expect(result.roots[0]!.decision.valueClosed).toBe(false);
    expect(result.roots[0]!.decision.controlClosed).toBe(true);
  });

  it("does not charge a control-first criterion to the value state budget", () => {
    const root = fieldSubject(target("amount"));
    const control = fieldSubject(upstream("status"));
    const result = traverseCausalDependencies(
      input(
        [
          {
            rootTargetFieldId: physicalId(root),
            taskId: "task-root",
            subject: root,
          },
        ],
        [
          [
            "task-root",
            [
              normalization(
                root,
                control,
                "ROWSET_CONTROL",
                "CONTROL_TO_TARGET",
              ),
            ],
          ],
        ],
        () => noExpansion(),
        { maxValueStates: 0, maxControlStates: 1 },
      ),
    );

    expect(
      result.gaps.some((gap) => gap.reasonCode === "MAX_VALUE_STATES_REACHED"),
    ).toBe(false);
    expect(
      result.gaps.some(
        (gap) => gap.reasonCode === "MAX_CONTROL_STATES_REACHED",
      ),
    ).toBe(false);
    expect(result.roots[0]!.frontiers.VALUE).toBe(0);
    expect(result.roots[0]!.frontiers.ROWSET_CONTROL).toBe(1);
    expect(result.roots[0]!.decision.valueClosed).toBe(true);
    expect(result.roots[0]!.decision.controlClosed).toBe(true);
  });

  it("does not charge a relation-first criterion to the value state budget", () => {
    const root = fieldSubject(target("amount"));
    const relation = relationSubject("relation:0:read-b");
    const base = input(
      [
        {
          rootTargetFieldId: physicalId(root),
          taskId: "task-root",
          subject: root,
        },
      ],
      [
        [
          "task-root",
          [
            normalization(
              root,
              relation,
              "RELATION_CONTEXT",
              "RELATION_TO_TARGET",
            ),
          ],
        ],
      ],
      undefined,
      { maxValueStates: 0, maxControlStates: 1 },
    );
    const result = traverseCausalDependencies({
      ...base,
      expandRelationOccurrence: () => ({
        relationOccurrences: [
          {
            taskId: "task-root",
            relationOccurrenceId: "relation:0:read-child",
            localRelationId: "relation:0:read-child",
            evidenceStatus: "CONFIRMED",
          },
        ],
      }),
    });

    expect(
      result.gaps.some((gap) => gap.reasonCode === "MAX_VALUE_STATES_REACHED"),
    ).toBe(false);
    expect(
      result.gaps.some(
        (gap) => gap.reasonCode === "MAX_CONTROL_STATES_REACHED",
      ),
    ).toBe(false);
    expect(result.roots[0]!.frontiers.VALUE).toBe(0);
    expect(result.roots[0]!.frontiers.RELATION_CONTEXT).toBe(1);
    expect(result.roots[0]!.decision.valueClosed).toBe(true);
    expect(result.roots[0]!.decision.controlClosed).toBe(true);
  });

  it("fails closed for a cross-task relation occurrence without an exact relation bridge", () => {
    const root = fieldSubject(target("amount"));
    const relation = relationSubject("relation:0:read-b");
    const base = input(
      [
        {
          rootTargetFieldId: physicalId(root),
          taskId: "task-root",
          subject: root,
        },
      ],
      [
        [
          "task-root",
          [
            normalization(
              root,
              relation,
              "RELATION_CONTEXT",
              "RELATION_TO_TARGET",
            ),
          ],
        ],
      ],
      undefined,
    );
    const producer = producerScope(
      "task-producer",
      physicalId(fieldSubject(upstream("amount"))),
      "relation-occurrence-without-bridge",
    );

    const result = traverseCausalDependencies({
      ...base,
      expandRelationOccurrence: () => ({
        relationOccurrences: [
          {
            taskId: "task-producer",
            relationOccurrenceId: "relation:producer:root",
            producerRootCriterion: producer.producerRootCriterion,
            producerSemanticScope: producer.producerSemanticScope,
            evidenceStatus: "CONFIRMED",
            evidenceRefs: ["relation-occurrence:unbridged"],
          },
        ],
      }),
    });

    expect(result.gaps).toEqual([
      expect.objectContaining({
        rootCriterionId: base.roots[0]!.rootCriterion.rootCriterionId,
        semanticScopeId: base.roots[0]!.semanticScope.semanticScopeId,
        reasonCode: "PRODUCER_SCOPE_UNRESOLVED",
        blocksConfirmedCausality: true,
        blocksNegativeProof: true,
      }),
    ]);
    expect(
      result.edges.some(
        (edge) =>
          edge.fromTaskId === "task-producer" ||
          edge.toTaskId === "task-producer",
      ),
    ).toBe(false);
    expect(
      result.roots[0]!.visitedStateKeys.some(
        (key) =>
          (JSON.parse(key) as { readonly taskId?: string }).taskId ===
          "task-producer",
      ),
    ).toBe(false);
    expect(result.roots[0]!.decision.controlClosed).toBe(false);
  });

  it("charges the first actual value branch state to the value state budget", () => {
    const root = fieldSubject(target("amount"));
    const value = fieldSubject(upstream("amount"));
    const result = traverseCausalDependencies(
      input(
        [
          {
            rootTargetFieldId: physicalId(root),
            taskId: "task-root",
            subject: root,
          },
        ],
        [["task-root", [normalization(root, value, "VALUE_FLOW")]]],
        () => noExpansion(),
        { maxValueStates: 0, maxControlStates: 10, maxValuePaths: 10 },
      ),
    );

    const gap = result.gaps.find(
      (candidate) => candidate.reasonCode === "MAX_VALUE_STATES_REACHED",
    );
    expect(gap?.rootDependenceKind).toBe("VALUE_TO_TARGET");
    expect(gap?.frontierKind).toBe("VALUE");
    expect(result.roots[0]!.frontiers.VALUE).toBe(1);
    expect(result.roots[0]!.decision.valueClosed).toBe(false);
    expect(result.roots[0]!.decision.controlClosed).toBe(true);
  });

  it("uses independent budgets and emits source-bearing limit gaps", () => {
    const root = fieldSubject(target("amount"));
    const value = fieldSubject(upstream("amount"));
    const control = fieldSubject(upstream("status"));
    const result = traverseCausalDependencies(
      input(
        [
          {
            rootTargetFieldId: physicalId(root),
            taskId: "task-root",
            subject: root,
          },
        ],
        [
          [
            "task-root",
            [
              normalization(root, value, "VALUE_FLOW"),
              normalization(
                root,
                control,
                "ROWSET_CONTROL",
                "CONTROL_TO_TARGET",
              ),
            ],
          ],
        ],
        () => noExpansion(),
        {
          maxValueStates: 10,
          maxValuePaths: 10,
          maxControlStates: 0,
          maxControlPaths: 10,
        },
      ),
    );
    const decision = result.roots[0]!.decision;
    expect(decision.valuePathCertainty).toBe("CONFIRMED");
    expect(decision.valueClosed).toBe(true);
    expect(decision.controlClosed).toBe(false);
    expect(
      result.gaps.some(
        (gap) =>
          gap.reasonCode === "MAX_CONTROL_STATES_REACHED" &&
          gap.frontierKind === "ROWSET_CONTROL",
      ),
    ).toBe(true);
  });

  it("terminates producer cycles and lowers provisional evidence to conditional", () => {
    const root = fieldSubject(target("amount"));
    const source = fieldSubject(upstream("amount"));
    const result = traverseCausalDependencies(
      input(
        [
          {
            rootTargetFieldId: physicalId(root),
            taskId: "task-root",
            subject: root,
          },
        ],
        [["task-root", [normalization(root, source, "VALUE_FLOW")]]],
        (request) =>
          producerExpansion(
            request.taskId,
            upstream("amount"),
            ["cycle"],
            "PROVISIONAL_LEGACY",
          ),
      ),
    );
    expect(
      result.roots[0]!.paths.some(
        (path) => path.pathCertainty === "CONDITIONAL",
      ),
    ).toBe(true);
    expect(
      result.roots[0]!.gaps.some((gap) => gap.reasonCode === "CYCLE"),
    ).toBe(true);
  });
});
