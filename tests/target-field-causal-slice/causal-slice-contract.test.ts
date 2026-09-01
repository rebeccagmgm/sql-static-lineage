import { describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../../scripts/machine-facts/machine-facts-contract.ts";
import {
  globalExpressionId,
  globalRelationId,
} from "../../scripts/machine-facts/plan-occurrence-id.ts";
import {
  TARGET_FIELD_CAUSAL_SLICE_ARTIFACT_TYPE,
  TARGET_FIELD_CAUSAL_SLICE_SCHEMA_VERSION,
  canonicalizeCausalSliceArtifact,
  validateCausalSliceArtifact,
  type CausalSliceArtifact,
  type CausalSliceArtifactInput,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-slice-contract.ts";
import {
  makeSemanticDependencyApplication,
  makeSemanticDependencyDefinition,
  makeSemanticDependencyEdge,
  makeSemanticOccurrenceScope,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/semantic-dependency-contract.ts";
import {
  canonicalCandidateBranchId,
  projectCandidateUniverse,
  buildAssessmentPairSkeleton,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/candidate-universe.ts";
import { generateRerunSets } from "../../scripts/reconcile/consumer/target-field-causal-slice/rerun-sets.ts";
import {
  canonicalRootCriterionId,
  type RootCriterion,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/write-scoped-plan-inputs.ts";
import {
  canonicalTraversalEdgeId,
  canonicalTraversalGapId,
  canonicalTraversalPathId,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-traversal.ts";
import {
  canonicalCausalAssessmentGapId,
  canonicalCausalAssessmentId,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-assessment.ts";

const ROOT = "hive|warehouse|target|demo.target|amount";
const SOURCE = "hive|warehouse|source|demo.source|amount";
const FINGERPRINT = sha256("fixture");

function tableArtifact(): Record<string, unknown> {
  return {
    artifactType: "TABLE_MULTI_HOP_RECONCILIATION",
    rootTaskId: "100",
    coverage: { status: "COMPLETE_OBSERVED_EVIDENCE", semantics: "OBSERVED_EVIDENCE_ONLY" },
    limits: { truncated: false },
    writeEdges: [{ producerTaskId: "100", table: { platform: "hive", dataSource: "warehouse", qualifiedName: "demo.target", stableTableId: "target" }, writes: [{ evidence: [{ source: "sql", locator: "write" }] }] }],
    producerBridges: [{ consumerTaskId: "100", producerTaskId: "200", producerRole: "PRIMARY", table: { platform: "hive", dataSource: "warehouse", qualifiedName: "demo.source", stableTableId: "source" }, readOccurrence: { occurrenceId: "read:100:0", readRelationId: "relation:100:0", statementIndex: 0, relationPath: ["relation:100:0"] } }],
    readEdges: [], scheduleEdges: [{ consumerTaskId: "100", producerTaskId: "300", evidence: [{ source: "HORAE_RELATION", locator: "schedule:100:300" }] }], terminals: [],
  };
}

function criterion(
  taskId: string,
  rootTargetFieldId: string,
  targetFieldName: string,
  writeObservationId: string,
): RootCriterion {
  const parts = rootTargetFieldId.split("|");
  const localRootRelationId = "project:0";
  const localOutputExpressionId = "project:0:expression:0";
  const base: Omit<RootCriterion, "rootCriterionId"> = {
    rootTaskId: taskId,
    targetTableKey: [parts[0], parts[1], parts[3]].join("|"),
    targetFieldName,
    rootTargetFieldId,
    targetFieldBindingId: `field-binding:${taskId}:${targetFieldName}`,
    rootWriteObservationId: writeObservationId,
    writeKind: "INSERT",
    sqlSourceId: `sql:${taskId}:${FINGERPRINT}`,
    sqlSnapshot: `INSERT INTO ${parts[3]} SELECT ${targetFieldName}`,
    sqlSha256: FINGERPRINT,
    writeStatementId: `statement:${taskId}:0`,
    writeStatementIndex: 0,
    statementId: `statement:${taskId}:0`,
    statementIndex: 0,
    queryProducerStatementId: `statement:${taskId}:0`,
    rootRelationId: globalRelationId(taskId, 0, localRootRelationId),
    outputExpressionId: globalExpressionId(taskId, 0, localOutputExpressionId),
    outputBindingId: `output-binding:${taskId}:${targetFieldName}`,
    sourceOrdinal: 0,
    targetOrdinal: 0,
    producerOutputName: targetFieldName,
    expressionRole: "PROJECT_EXPRESSION",
    localRootRelationId,
    localOutputExpressionId,
    evidenceRefs: [
      writeObservationId,
      `output-binding:${taskId}:${targetFieldName}`,
      `field-binding:${taskId}:${targetFieldName}`,
      "negative:control",
      "negative:relation",
      "negative:value",
    ],
  };
  return { rootCriterionId: canonicalRootCriterionId(base), ...base };
}

function baseInput(): CausalSliceArtifactInput {
  const rootCriterion = criterion("100", ROOT, "amount", "write:100:0");
  const producerCriterion = criterion("200", SOURCE, "amount", "write:200:0");
  const rootScope = makeSemanticOccurrenceScope({ rootCriterion });
  const producerScope = makeSemanticOccurrenceScope({ rootCriterion: producerCriterion });
  const universe = projectCandidateUniverse({
    tableArtifact: tableArtifact(),
    rootCriteria: [rootCriterion],
  });
  const branches = universe.branches;
  const pairs = buildAssessmentPairSkeleton([rootCriterion], branches);
  const rootWrite = branches.find((branch) => branch.branchKind === "ROOT_WRITE")!;
  const producer = branches.find((branch) => branch.branchKind === "PHYSICAL_PRODUCER")!;
  const edgeIdentity = {
    rootCriterionId: rootCriterion.rootCriterionId,
    fromSemanticScopeId: producerScope.semanticScopeId,
    toSemanticScopeId: rootScope.semanticScopeId,
    rootTargetFieldId: ROOT,
    fromTaskId: "200",
    toTaskId: "100",
    fromSubject: { subjectKind: "PHYSICAL_FIELD" as const, physicalFieldId: SOURCE },
    toSubject: { subjectKind: "PHYSICAL_FIELD" as const, physicalFieldId: ROOT },
    rootDependenceKind: "VALUE_TO_TARGET" as const,
    localEdgeKind: "VALUE_FLOW" as const,
    dependencyId: null,
    readOccurrenceId: "read:100:0",
  };
  const edge = {
    ...edgeIdentity,
    edgeId: canonicalTraversalEdgeId(edgeIdentity),
    frontierKind: "VALUE" as const,
    pathCertainty: "CONFIRMED" as const,
    evidenceRefs: ["evidence:read"],
  };
  const confirmedPathId = canonicalTraversalPathId(
    rootCriterion.rootCriterionId,
    ROOT,
    [edge],
  );
  const confirmedProof = {
    rootCriterionId: rootCriterion.rootCriterionId, rootTargetFieldId: ROOT, candidateBranchId: producer.candidateBranchId, pathCertainty: "CONFIRMED" as const,
    reasonCode: "CONTINUOUS_CONFIRMED_PATH" as const, pathIds: [confirmedPathId], edgeIds: [edge.edgeId], evidenceRefs: ["evidence:read"],
  };
  const positiveProof = { proofId: `positive-proof:${sha256(canonicalJson(confirmedProof))}`, ...confirmedProof };
  const unknownPair = pairs.find((pair) => pair.candidateBranchId === rootWrite.candidateBranchId)!;
  const unknownGapInput = { rootCriterionId: rootCriterion.rootCriterionId, rootTargetFieldId: ROOT, candidateBranchId: unknownPair.candidateBranchId, reasonCode: "BRANCH_KIND_REQUIRES_SEPARATE_PROOF" as const, evidenceRefs: [] };
  const unknownGap = {
    gapId: canonicalCausalAssessmentGapId(unknownGapInput),
    ...unknownGapInput,
  };
  const unrelated = pairs.find((pair) => pair.candidateBranchId !== producer.candidateBranchId && pair.candidateBranchId !== rootWrite.candidateBranchId)!;
  const negativeBase = { rootCriterionId: rootCriterion.rootCriterionId, rootTargetFieldId: ROOT, candidateBranchId: unrelated.candidateBranchId, reasonCode: "EXPLICIT_SAFE_RULES_ONLY" as const, checkedObligations: [{ kind: "VALUE" as const, evidenceRefs: ["negative:value"] }, { kind: "CONTROL" as const, evidenceRefs: ["negative:control"] }, { kind: "RELATION" as const, evidenceRefs: ["negative:relation"] }], evidenceRefs: ["negative:control", "negative:relation", "negative:value"], sourceNegativeProofId: null };
  const negativeProof = { proofId: `negative-proof:${sha256(canonicalJson(negativeBase))}`, ...negativeBase };
  const assessments = pairs.map((pair) => {
    const input = pair.candidateBranchId === producer.candidateBranchId
      ? { pairId: pair.pairId, rootCriterionId: rootCriterion.rootCriterionId, rootTargetFieldId: ROOT, candidateBranchId: pair.candidateBranchId, status: "CONFIRMED_RELATED" as const, reasonCode: "CONTINUOUS_CONFIRMED_PATH" as const, positiveProofIds: [positiveProof.proofId], negativeProofIds: [], gapRefs: [] }
      : pair.candidateBranchId === unrelated.candidateBranchId
        ? { pairId: pair.pairId, rootCriterionId: rootCriterion.rootCriterionId, rootTargetFieldId: ROOT, candidateBranchId: pair.candidateBranchId, status: "PROVEN_UNRELATED" as const, reasonCode: "EXPLICIT_SAFE_RULES_ONLY" as const, positiveProofIds: [], negativeProofIds: [negativeProof.proofId], gapRefs: [] }
        : { pairId: pair.pairId, rootCriterionId: rootCriterion.rootCriterionId, rootTargetFieldId: ROOT, candidateBranchId: pair.candidateBranchId, status: "UNKNOWN" as const, reasonCode: "BRANCH_KIND_REQUIRES_SEPARATE_PROOF" as const, positiveProofIds: [], negativeProofIds: [], gapRefs: [unknownGap.gapId] };
    return { assessmentId: canonicalCausalAssessmentId(input), ...input };
  });
  const rerunSets = generateRerunSets({ candidateUniverse: universe, rootCriteria: [rootCriterion], assessments });
  const definition = makeSemanticDependencyDefinition({
    subject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: SOURCE },
    effectKind: "VALUE_CONTRIBUTION",
    operatorKind: "PROJECT",
    operatorVariant: "DIRECT_REFERENCE",
    operatorRole: "PROJECTION_VALUE",
    localEdgeKind: "VALUE_FLOW",
  }, "SUPPORTED", [], undefined, rootScope);
  const application = makeSemanticDependencyApplication({
    dependencyId: definition.dependencyId,
    scopeRelationId: rootScope.relationId,
    rootTargetFieldId: ROOT,
    rootDependenceKind: "VALUE_TO_TARGET",
    pathCertainty: "CONFIRMED",
    rootCriterionId: rootCriterion.rootCriterionId,
    semanticScope: rootScope,
  });
  const dependencyEdge = makeSemanticDependencyEdge({
    dependencyId: definition.dependencyId,
    fromSubject: definition.subject,
    toSubject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: ROOT },
    rootDependenceKind: "VALUE_TO_TARGET",
    localEdgeKind: "VALUE_FLOW",
    scopeRelationId: rootScope.relationId,
    pathCertainty: "CONFIRMED",
    rootCriterionId: rootCriterion.rootCriterionId,
    semanticScope: rootScope,
  });
  return {
    artifactType: TARGET_FIELD_CAUSAL_SLICE_ARTIFACT_TYPE, schemaVersion: TARGET_FIELD_CAUSAL_SLICE_SCHEMA_VERSION, generatedAt: "2026-08-27T00:00:00Z",
    request: { rootTaskId: "100", rootTable: "demo.target", rootFields: [ROOT], rootWriteObservationIds: ["write:100:0"], negativeProofMode: "SAFE_RULES_ONLY" },
    rootCriteria: [rootCriterion], semanticScopes: [rootScope, producerScope], scopeGaps: [],
    inputFingerprints: { inputPack: [{ fingerprint: FINGERPRINT, reference: "input-pack" }], machineFacts: [{ fingerprint: FINGERPRINT, reference: "machine-facts" }], producerIndex: [{ fingerprint: FINGERPRINT, reference: "producer-index" }], tableMultiHopArtifact: [{ fingerprint: FINGERPRINT, reference: "table-artifact" }] },
    dependencies: { definitions: [definition], applications: [application], edges: [dependencyEdge], gaps: [] }, candidateUniverse: universe,
    traversal: { options: { maxDepth: 10, maxValueStates: 10, maxValuePaths: 10, maxControlStates: 10, maxControlPaths: 10 }, roots: [{ rootCriterionId: rootCriterion.rootCriterionId, root: { rootCriterion, semanticScope: rootScope }, visitedStateKeys: [], activeCycleChecks: 0, frontiers: { VALUE: 0, EXPRESSION_CONTROL: 0, ROWSET_CONTROL: 0, WINDOW_CONTEXT: 0, RELATION_CONTEXT: 0 }, paths: [{ pathId: confirmedPathId, rootCriterionId: rootCriterion.rootCriterionId, rootTargetFieldId: ROOT, rootDependenceKind: "VALUE_TO_TARGET", pathCertainty: "CONFIRMED", edges: [edge] }], gaps: [], decision: { valuePathCertainty: "CONFIRMED", controlPathCertainty: null, valueClosed: true, controlClosed: true, valueGapIds: [], controlGapIds: [] }}], sharedEvidenceRefs: ["evidence:read", "negative:control", "negative:relation", "negative:value"], edges: [edge], gaps: [] },
    limits: { maxDepth: 10, value: { maxStates: 10, maxPaths: 10, truncated: false, reasons: [] }, control: { maxStates: 10, maxPaths: 10, truncated: false, reasons: [] } }, assessments, positiveProofs: [positiveProof], negativeProofs: [negativeProof], assessmentGaps: [unknownGap], rerunSets, boundaries: { staticSqlOnly: true, runtimeExecution: "NOT_EVALUATED", dataCorrectness: "NOT_EVALUATED", businessAcceptance: "NOT_EVALUATED" },
  };
}

function proofId<T extends { readonly proofId?: string }>(
  prefix: "positive-proof" | "negative-proof",
  value: Omit<T, "proofId">,
): string {
  return `${prefix}:${sha256(canonicalJson(value))}`;
}

function rehashArtifact(artifact: CausalSliceArtifact): CausalSliceArtifact {
  const {
    generatedAt: _generatedAt,
    contentHash: _contentHash,
    ...stable
  } = artifact;
  return {
    ...artifact,
    contentHash: sha256(canonicalJson(stable)),
  };
}

function edgeIdForArtifact(
  edge: CausalSliceArtifact["traversal"]["edges"][number],
  rootTargetFieldId: string,
): string {
  return canonicalTraversalEdgeId({
    rootCriterionId: edge.rootCriterionId,
    fromSemanticScopeId: edge.fromSemanticScopeId,
    toSemanticScopeId: edge.toSemanticScopeId,
    rootTargetFieldId,
    fromTaskId: edge.fromTaskId,
    toTaskId: edge.toTaskId,
    fromSubject: edge.fromSubject,
    toSubject: edge.toSubject,
    rootDependenceKind: edge.rootDependenceKind,
    localEdgeKind: edge.localEdgeKind,
    dependencyId: edge.dependencyId,
    readOccurrenceId: edge.readOccurrenceId,
  });
}

function blockingGap(
  artifact: ReturnType<typeof canonicalizeCausalSliceArtifact>,
  label: string,
) {
  const root = artifact.traversal.roots[0]!;
  const input = {
    rootCriterionId: root.rootCriterionId,
    semanticScopeId: root.root.semanticScope.semanticScopeId,
    rootTargetFieldId: root.root.rootCriterion.rootTargetFieldId,
    taskId: root.root.rootCriterion.rootTaskId,
    subject: {
      subjectKind: "PHYSICAL_FIELD" as const,
      physicalFieldId: root.root.rootCriterion.rootTargetFieldId,
    },
    rootDependenceKind: "VALUE_TO_TARGET" as const,
    frontierKind: "VALUE" as const,
    reasonCode: "REQUIRED_EVIDENCE_UNRESOLVED" as const,
    message: `tampered blocking gap:${label}`,
    evidenceRefs: [`evidence:tampered-gap:${label}`],
  };
  return {
    ...input,
    gapId: canonicalTraversalGapId(input),
    blocksConfirmedCausality: true as const,
    blocksNegativeProof: true as const,
  };
}

describe("causal slice artifact contract", () => {
  it("canonicalizes ordering, excludes generatedAt from the hash, and validates mixed decisions", () => {
    const first = canonicalizeCausalSliceArtifact(baseInput());
    const second = canonicalizeCausalSliceArtifact({ ...baseInput(), generatedAt: "2027-01-01T00:00:00Z", assessments: [...baseInput().assessments].reverse(), inputFingerprints: { ...baseInput().inputFingerprints, inputPack: [...baseInput().inputFingerprints.inputPack].reverse() } });
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.assessments.map((item) => item.status).sort()).toEqual([
      "CONFIRMED_RELATED",
      "PROVEN_UNRELATED",
      "UNKNOWN",
    ]);
    expect(validateCausalSliceArtifact(first)).toEqual([]);
  });

  it.each([
    ["wrong artifact type", (artifact: ReturnType<typeof canonicalizeCausalSliceArtifact>) => ({ ...artifact, artifactType: "FIELD_MULTI_HOP_RECONCILIATION" })],
    ["wrong version", (artifact: ReturnType<typeof canonicalizeCausalSliceArtifact>) => ({ ...artifact, schemaVersion: "1.1.0" })],
    ["hash", (artifact: ReturnType<typeof canonicalizeCausalSliceArtifact>) => ({ ...artifact, contentHash: "0".repeat(64) })],
    ["unknown without gap", (artifact: ReturnType<typeof canonicalizeCausalSliceArtifact>) => ({ ...artifact, assessments: artifact.assessments.map((item) => item.status === "UNKNOWN" ? { ...item, gapRefs: [] } : item) })],
    ["non-NOT_EVALUATED precision", (artifact: ReturnType<typeof canonicalizeCausalSliceArtifact>) => ({ ...artifact, qualityMetrics: { ...artifact.qualityMetrics, precision: "0.5" } })],
  ])("rejects %s", (_name, mutate) => {
    const invalid = mutate(canonicalizeCausalSliceArtifact(baseInput()));
    expect(validateCausalSliceArtifact(invalid)).not.toEqual([]);
  });

  it("rejects a related assessment without a positive proof", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const forged = {
      ...artifact,
      assessments: artifact.assessments.map((assessment) =>
        assessment.status === "CONFIRMED_RELATED"
          ? { ...assessment, positiveProofIds: [] }
          : assessment,
      ),
    };
    expect(validateCausalSliceArtifact(forged).some((error) =>
      error.includes("related assessment has no valid positive proof"),
    )).toBe(true);
  });

  it("does not let aggregate shared evidence prove a root-scoped negative obligation", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const forged = {
      ...artifact,
      rootCriteria: artifact.rootCriteria.map((item) => ({
        ...item,
        evidenceRefs: item.evidenceRefs.filter((ref) =>
          !ref.startsWith("negative:")
        ),
      })),
    };

    expect(validateCausalSliceArtifact(forged).some((error) =>
      error.includes("NEGATIVE_PROOF_OBLIGATION_EVIDENCE_UNKNOWN"),
    )).toBe(true);
  });

  it.each([
    ["VALUE", { valueClosed: false }],
    ["CONTROL", { controlClosed: false }],
  ] as const)("rechecks the %s closure gate for persisted negative proofs", (kind, decision) => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const forged = {
      ...artifact,
      traversal: {
        ...artifact.traversal,
        roots: artifact.traversal.roots.map((root) => ({
          ...root,
          decision: { ...root.decision, ...decision },
        })),
      },
    };

    expect(validateCausalSliceArtifact(forged)).toContain(
      `NEGATIVE_PROOF_${kind}_NOT_CLOSED:${artifact.negativeProofs[0]!.proofId}`,
    );
  });

  it("requires exactly one traversal root for a persisted negative proof", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const forged = {
      ...artifact,
      traversal: { ...artifact.traversal, roots: [] },
    };

    expect(validateCausalSliceArtifact(forged)).toContain(
      `NEGATIVE_PROOF_ROOT_CARDINALITY_INVALID:${artifact.negativeProofs[0]!.proofId}`,
    );
  });

  it("rechecks source coverage rather than trusting the stored negative proof", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const forged = {
      ...artifact,
      candidateUniverse: {
        ...artifact.candidateUniverse,
        coverage: {
          ...artifact.candidateUniverse.coverage,
          sourceCoverageStatus: "PARTIAL",
        },
      },
    };

    expect(validateCausalSliceArtifact(forged)).toContain(
      `NEGATIVE_PROOF_SOURCE_COVERAGE_INCOMPLETE:${artifact.negativeProofs[0]!.proofId}`,
    );
  });

  it("rejects a negative proof when either the root or aggregate traversal has a relevant gap", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const rootGap = blockingGap(artifact, "traversal-gap:root-tamper");
    const aggregateGap = blockingGap(artifact, "traversal-gap:aggregate-tamper");
    const forged = {
      ...artifact,
      traversal: {
        ...artifact.traversal,
        roots: artifact.traversal.roots.map((root) => ({
          ...root,
          gaps: [rootGap],
        })),
        gaps: [aggregateGap],
      },
    };
    const proofId = artifact.negativeProofs[0]!.proofId;
    const errors = validateCausalSliceArtifact(forged);

    expect(errors).toContain(
      `NEGATIVE_PROOF_TRAVERSAL_GAP_PRESENT:${proofId}:${rootGap.gapId}`,
    );
    expect(errors).toContain(
      `NEGATIVE_PROOF_TRAVERSAL_GAP_PRESENT:${proofId}:${aggregateGap.gapId}`,
    );
  });

  it("rejects a forged negative proof when an exact criterion-and-branch path exists", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const producer = artifact.candidateUniverse.branches.find(
      (branch) => branch.branchKind === "PHYSICAL_PRODUCER",
    )!;
    const input = {
      rootCriterionId: artifact.rootCriteria[0]!.rootCriterionId,
      rootTargetFieldId: artifact.rootCriteria[0]!.rootTargetFieldId,
      candidateBranchId: producer.candidateBranchId,
      reasonCode: "EXPLICIT_SAFE_RULES_ONLY" as const,
      checkedObligations: artifact.negativeProofs[0]!.checkedObligations,
      evidenceRefs: artifact.negativeProofs[0]!.evidenceRefs,
      sourceNegativeProofId: null,
    };
    const forgedProof = {
      proofId: proofId("negative-proof", input),
      ...input,
    };
    const forged = {
      ...artifact,
      negativeProofs: [...artifact.negativeProofs, forgedProof],
    };

    expect(validateCausalSliceArtifact(forged)).toContain(
      `NEGATIVE_PROOF_POSITIVE_PATH_EXISTS:${forgedProof.proofId}`,
    );
  });

  it("requires negative proof evidence to equal the obligations plus structural cut evidence", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const original = artifact.negativeProofs[0]!;
    const input = {
      rootCriterionId: original.rootCriterionId,
      rootTargetFieldId: original.rootTargetFieldId,
      candidateBranchId: original.candidateBranchId,
      reasonCode: original.reasonCode,
      checkedObligations: original.checkedObligations,
      evidenceRefs: [...original.evidenceRefs, artifact.rootCriteria[0]!.outputBindingId].sort(),
      sourceNegativeProofId: original.sourceNegativeProofId,
    };
    const forgedProof = { proofId: proofId("negative-proof", input), ...input };
    const forged = {
      ...artifact,
      negativeProofs: [forgedProof],
      assessments: artifact.assessments.map((assessment) =>
        assessment.negativeProofIds.length > 0
          ? { ...assessment, negativeProofIds: [forgedProof.proofId] }
          : assessment,
      ),
    };

    expect(validateCausalSliceArtifact(forged)).toContain(
      `NEGATIVE_PROOF_EVIDENCE_SET_INVALID:${forgedProof.proofId}`,
    );
  });

  it("rejects an inherited cut proof whose direct source assessment is still Unknown", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const sourceProof = artifact.negativeProofs[0]!;
    const sourceBranch = artifact.candidateUniverse.branches.find(
      (branch) => branch.candidateBranchId === sourceProof.candidateBranchId,
    )!;
    const descendant = artifact.candidateUniverse.branches.find(
      (branch) => branch.branchKind === "PHYSICAL_PRODUCER",
    )!;
    const input = {
      rootCriterionId: sourceProof.rootCriterionId,
      rootTargetFieldId: sourceProof.rootTargetFieldId,
      candidateBranchId: descendant.candidateBranchId,
      reasonCode: "INHERITED_FROM_PROVEN_UNRELATED_CUT" as const,
      checkedObligations: sourceProof.checkedObligations,
      evidenceRefs: [...new Set([
        ...sourceProof.checkedObligations.flatMap((item) => item.evidenceRefs),
        ...sourceBranch.evidenceRefs.map((ref) => ref.evidenceRefId),
        ...descendant.evidenceRefs.map((ref) => ref.evidenceRefId),
      ])].sort(),
      sourceNegativeProofId: sourceProof.proofId,
    };
    const inherited = { proofId: proofId("negative-proof", input), ...input };
    const forged = {
      ...artifact,
      negativeProofs: [...artifact.negativeProofs, inherited],
      assessments: artifact.assessments.map((assessment) =>
        assessment.candidateBranchId === sourceProof.candidateBranchId
          ? {
              ...assessment,
              status: "UNKNOWN" as const,
              reasonCode: "EXACT_OCCURRENCE_PATH_NOT_PROVEN" as const,
              negativeProofIds: [],
              gapRefs: [artifact.assessmentGaps[0]!.gapId],
            }
          : assessment,
      ),
    };

    expect(validateCausalSliceArtifact(forged)).toContain(
      `NEGATIVE_PROOF_CUT_SOURCE_ASSESSMENT_INVALID:${inherited.proofId}`,
    );
  });

  it("requires root-write proofs to contain both the write and exact output binding evidence", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const criterion = artifact.rootCriteria[0]!;
    const rootWrite = artifact.candidateUniverse.branches.find(
      (branch) => branch.branchKind === "ROOT_WRITE",
    )!;
    const input = {
      rootCriterionId: criterion.rootCriterionId,
      rootTargetFieldId: criterion.rootTargetFieldId,
      candidateBranchId: rootWrite.candidateBranchId,
      pathCertainty: "CONFIRMED" as const,
      reasonCode: "EXPLICIT_ROOT_WRITE_PROOF" as const,
      pathIds: [],
      edgeIds: [],
      evidenceRefs: [criterion.rootWriteObservationId],
    };
    const forgedProof = { proofId: proofId("positive-proof", input), ...input };
    const forged = {
      ...artifact,
      positiveProofs: [...artifact.positiveProofs, forgedProof],
    };

    expect(validateCausalSliceArtifact(forged)).toContain(
      `ROOT_WRITE_PROOF_REQUIRED_EVIDENCE_MISSING:${forgedProof.proofId}`,
    );
  });

  it("rejects a positive path proof intersected by a path-blocking traversal gap", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const gap = blockingGap(artifact, "traversal-gap:positive-path-tamper");
    const forged = {
      ...artifact,
      traversal: {
        ...artifact.traversal,
        roots: artifact.traversal.roots.map((root) => ({
          ...root,
          gaps: [gap],
        })),
      },
    };

    expect(validateCausalSliceArtifact(forged)).toContain(
      `POSITIVE_PROOF_PATH_BLOCKED:${artifact.positiveProofs[0]!.proofId}:${gap.gapId}`,
    );
  });

  it("binds a positive path proof to the exact candidate read occurrence", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const producer = artifact.candidateUniverse.branches.find(
      (candidate) => candidate.branchKind === "PHYSICAL_PRODUCER",
    )!;
    const siblingIdentity = {
      ...producer,
      readOccurrence: {
        ...producer.readOccurrence!,
        occurrenceId: "read:100:sibling",
        readRelationId: "relation:100:sibling",
      },
    };
    const sibling = {
      ...siblingIdentity,
      candidateBranchId: canonicalCandidateBranchId(siblingIdentity),
    };
    const original = artifact.positiveProofs[0]!;
    const input = {
      rootCriterionId: original.rootCriterionId,
      rootTargetFieldId: original.rootTargetFieldId,
      candidateBranchId: sibling.candidateBranchId,
      pathCertainty: original.pathCertainty,
      reasonCode: original.reasonCode,
      pathIds: original.pathIds,
      edgeIds: original.edgeIds,
      evidenceRefs: original.evidenceRefs,
    };
    const forgedProof = { proofId: proofId("positive-proof", input), ...input };
    const forged = {
      ...artifact,
      candidateUniverse: {
        ...artifact.candidateUniverse,
        branches: [...artifact.candidateUniverse.branches, sibling],
      },
      positiveProofs: [...artifact.positiveProofs, forgedProof],
    };

    expect(validateCausalSliceArtifact(forged)).toContain(
      `POSITIVE_PROOF_EXACT_BRANCH_INVALID:${forgedProof.proofId}`,
    );
  });

  it("does not bind a positive proof across Tasks that reuse the same occurrence ID", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const producer = artifact.candidateUniverse.branches.find(
      (candidate) => candidate.branchKind === "PHYSICAL_PRODUCER",
    )!;
    const siblingIdentity = {
      ...producer,
      consumerTaskId: "998",
      producerTaskId: "999",
    };
    const sibling = {
      ...siblingIdentity,
      candidateBranchId: canonicalCandidateBranchId(siblingIdentity),
    };
    const original = artifact.positiveProofs[0]!;
    const input = {
      rootCriterionId: original.rootCriterionId,
      rootTargetFieldId: original.rootTargetFieldId,
      candidateBranchId: sibling.candidateBranchId,
      pathCertainty: original.pathCertainty,
      reasonCode: original.reasonCode,
      pathIds: original.pathIds,
      edgeIds: original.edgeIds,
      evidenceRefs: original.evidenceRefs,
    };
    const forgedProof = { proofId: proofId("positive-proof", input), ...input };
    const forged = {
      ...artifact,
      candidateUniverse: {
        ...artifact.candidateUniverse,
        branches: [...artifact.candidateUniverse.branches, sibling],
      },
      positiveProofs: [...artifact.positiveProofs, forgedProof],
    };

    expect(validateCausalSliceArtifact(forged)).toContain(
      `POSITIVE_PROOF_EXACT_BRANCH_INVALID:${forgedProof.proofId}`,
    );
  });

  it("recomputes persisted semantic definition, application, and edge IDs", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const definition = artifact.dependencies.definitions[0]!;
    const application = artifact.dependencies.applications[0]!;
    const edge = artifact.dependencies.edges[0]!;

    const definitionErrors = validateCausalSliceArtifact({
      ...artifact,
      dependencies: {
        ...artifact.dependencies,
        definitions: [{ ...definition, operatorRole: "TAMPERED_ROLE" }],
      },
    });
    expect(definitionErrors).toContain(
      `dependency definition id is invalid:${definition.dependencyId}`,
    );

    const applicationErrors = validateCausalSliceArtifact({
      ...artifact,
      dependencies: {
        ...artifact.dependencies,
        applications: [{
          ...application,
          rootDependenceKind: "CONTROL_TO_TARGET",
        }],
      },
    });
    expect(applicationErrors).toContain(
      `dependency application id is invalid:${application.applicationId}`,
    );

    const edgeErrors = validateCausalSliceArtifact({
      ...artifact,
      dependencies: {
        ...artifact.dependencies,
        edges: [{ ...edge, localEdgeKind: "ROWSET_CONTROL" }],
      },
    });
    expect(edgeErrors).toContain(
      `dependency edge id is invalid:${edge.edgeId}`,
    );
  });

  it("rejects rehashed traversal edges whose subject, scope, or read occurrence changed under the old ID", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const root = artifact.traversal.roots[0]!;
    const path = root.paths[0]!;
    const edge = path.edges[0]!;
    const mutations = [
      {
        name: "subject",
        edge: {
          ...edge,
          fromSubject: {
            subjectKind: "PHYSICAL_FIELD" as const,
            physicalFieldId: `${SOURCE}:tampered`,
          },
        },
      },
      {
        name: "scope",
        edge: { ...edge, fromSemanticScopeId: edge.toSemanticScopeId },
      },
      {
        name: "read occurrence",
        edge: { ...edge, readOccurrenceId: "read:100:tampered" },
      },
    ];

    for (const mutation of mutations) {
      const forged = rehashArtifact({
        ...artifact,
        traversal: {
          ...artifact.traversal,
          roots: [{
            ...root,
            paths: [{ ...path, edges: [mutation.edge] }],
          }],
        },
      });
      expect(forged.contentHash, mutation.name).not.toBe(artifact.contentHash);
      expect(validateCausalSliceArtifact(forged), mutation.name).toContain(
        `traversal path edge id is invalid:${edge.edgeId}`,
      );
    }

    const fakeEnumEdge = {
      ...edge,
      localEdgeKind: "FAKE_EDGE_KIND" as typeof edge.localEdgeKind,
    };
    const fakeEnum = rehashArtifact({
      ...artifact,
      traversal: {
        ...artifact.traversal,
        roots: [{
          ...root,
          paths: [{ ...path, edges: [fakeEnumEdge] }],
        }],
      },
    });
    expect(validateCausalSliceArtifact(fakeEnum)).toContain(
      `traversal path edge enum is invalid:${edge.edgeId}`,
    );
  });

  it("rejects a rehashed path when its edge ID changed but its path ID did not", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const root = artifact.traversal.roots[0]!;
    const path = root.paths[0]!;
    const changedEdge = {
      ...path.edges[0]!,
      readOccurrenceId: "read:100:changed-and-rehashed",
    };
    const canonicalEdge = {
      ...changedEdge,
      edgeId: edgeIdForArtifact(changedEdge, path.rootTargetFieldId),
    };
    const forged = rehashArtifact({
      ...artifact,
      traversal: {
        ...artifact.traversal,
        roots: [{
          ...root,
          paths: [{ ...path, edges: [canonicalEdge] }],
        }],
      },
    });

    expect(validateCausalSliceArtifact(forged)).toContain(
      `traversal path id is invalid:${path.pathId}`,
    );
  });

  it("recomputes aggregate traversal edge and root/aggregate gap IDs after rehash", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const aggregateEdge = artifact.traversal.edges[0]!;
    const canonicalGap = blockingGap(artifact, "identity-closure");
    const tamperedGap = {
      ...canonicalGap,
      readOccurrenceId: "read:tampered-after-id",
    };
    const forged = rehashArtifact({
      ...artifact,
      traversal: {
        ...artifact.traversal,
        roots: artifact.traversal.roots.map((root) => ({
          ...root,
          gaps: [tamperedGap],
        })),
        edges: [{
          ...aggregateEdge,
          toSubject: {
            subjectKind: "PHYSICAL_FIELD" as const,
            physicalFieldId: `${ROOT}:tampered`,
          },
        }],
        gaps: [tamperedGap],
      },
    });
    const errors = validateCausalSliceArtifact(forged);

    expect(errors).toContain(
      `traversal aggregate edge id is invalid:${aggregateEdge.edgeId}`,
    );
    expect(errors).toContain(
      `traversal root gap id is invalid:${tamperedGap.gapId}`,
    );
    expect(errors).toContain(
      `traversal aggregate gap id is invalid:${tamperedGap.gapId}`,
    );
  });

  it("requires aggregate traversal projections and decision gap IDs to equal their roots", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const withoutAggregateEdge = rehashArtifact({
      ...artifact,
      traversal: { ...artifact.traversal, edges: [] },
    });
    expect(validateCausalSliceArtifact(withoutAggregateEdge)).toContain(
      "traversal aggregate edges do not equal the root path projection",
    );

    const aggregateOnlyGap = blockingGap(artifact, "aggregate-only");
    const withAggregateOnlyGap = rehashArtifact({
      ...artifact,
      traversal: { ...artifact.traversal, gaps: [aggregateOnlyGap] },
    });
    expect(validateCausalSliceArtifact(withAggregateOnlyGap)).toContain(
      "traversal aggregate gaps do not equal the root gap projection",
    );

    const root = artifact.traversal.roots[0]!;
    const withForgedDecision = rehashArtifact({
      ...artifact,
      traversal: {
        ...artifact.traversal,
        roots: [{
          ...root,
          decision: {
            ...root.decision,
            valueClosed: false,
            valueGapIds: ["causal-gap:forged"],
          },
        }],
      },
    });
    expect(validateCausalSliceArtifact(withForgedDecision)).toContain(
      `traversal value decision gaps are inconsistent:${root.rootCriterionId}`,
    );
  });

  it("rejects rehashed assessment enum, pair, ID, and assessment-gap tampering", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const assessment = artifact.assessments[0]!;
    const other = artifact.assessments.find((item) =>
      item.candidateBranchId !== assessment.candidateBranchId
    )!;
    const fakeStatus = rehashArtifact({
      ...artifact,
      assessments: artifact.assessments.map((item) =>
        item.assessmentId === assessment.assessmentId
          ? { ...item, status: "FAKE" as typeof item.status }
          : item,
      ),
    });
    const fakeStatusErrors = validateCausalSliceArtifact(fakeStatus);
    expect(fakeStatusErrors).toContain(
      `assessment status is invalid:${assessment.assessmentId}`,
    );
    expect(fakeStatusErrors).toContain(
      `assessment id is invalid:${assessment.assessmentId}`,
    );

    const wrongPair = rehashArtifact({
      ...artifact,
      assessments: artifact.assessments.map((item) =>
        item.assessmentId === assessment.assessmentId
          ? { ...item, candidateBranchId: other.candidateBranchId }
          : item,
      ),
    });
    expect(validateCausalSliceArtifact(wrongPair)).toContain(
      `assessment pair identity is invalid:${assessment.assessmentId}`,
    );

    const gap = artifact.assessmentGaps[0]!;
    const changedGap = rehashArtifact({
      ...artifact,
      assessmentGaps: [{ ...gap, evidenceRefs: ["evidence:tampered"] }],
    });
    expect(validateCausalSliceArtifact(changedGap)).toContain(
      `assessment gap id is invalid:${gap.gapId}`,
    );
  });

  it("recomputes a candidate branch ID after occurrence identity tampering", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const branch = artifact.candidateUniverse.branches.find(
      (candidate) => candidate.branchKind === "PHYSICAL_PRODUCER",
    )!;
    const forged = {
      ...artifact,
      candidateUniverse: {
        ...artifact.candidateUniverse,
        branches: artifact.candidateUniverse.branches.map((candidate) =>
          candidate.candidateBranchId === branch.candidateBranchId
            ? {
                ...candidate,
                readOccurrence: {
                  ...candidate.readOccurrence!,
                  occurrenceId: "read:tampered:occurrence",
                },
              }
            : candidate,
        ),
      },
    };

    expect(validateCausalSliceArtifact(forged)).toContain(
      `candidate branch id is invalid:${branch.candidateBranchId}`,
    );
  });
});
