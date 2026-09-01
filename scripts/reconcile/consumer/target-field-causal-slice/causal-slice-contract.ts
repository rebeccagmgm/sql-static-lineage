import {
  canonicalJson,
  sha256,
} from "../../../machine-facts/machine-facts-contract.ts";
import {
  canonicalCandidateBranchId,
  type CandidateBranch,
  type CandidateUniverse,
  buildAssessmentPairSkeleton,
} from "./candidate-universe.ts";
import {
  CAUSAL_ASSESSMENT_REASON_CODES,
  CAUSAL_ASSESSMENT_STATUSES,
  canonicalCausalAssessmentGapId,
  canonicalCausalAssessmentId,
  exactOccurrenceBridgeForCandidatePath,
  traversalGapBlocksPositivePath,
  type CausalAssessment,
  type CausalAssessmentGap,
  type PositiveCausalProof,
} from "./causal-assessment.ts";
import {
  canonicalTraversalEdgeId,
  canonicalTraversalGapId,
  canonicalTraversalPathId,
  TRAVERSAL_FRONTIER_KINDS,
  type CausalTraversalGap,
  type CausalTraversalPath,
  type CausalTraversalPathEdge,
  type CausalTraversalResult,
} from "./causal-traversal.ts";
import type {
  NegativeCausalProof,
  NegativeProofObligation,
  NegativeProofReason,
  NegativeProofMode,
} from "./causal-negative-proof.ts";
import {
  type RerunSet,
  type RerunSetsResult,
  generateRerunSets,
} from "./rerun-sets.ts";
import {
  canonicalSemanticApplicationId,
  canonicalSemanticDependencyId,
  canonicalSemanticEdgeId,
  LOCAL_EDGE_KINDS,
  PATH_CERTAINTIES,
  ROOT_DEPENDENCE_KINDS,
  type SemanticDependencyApplication,
  type SemanticDependencyDefinition,
  type SemanticDependencyEdge,
  type SemanticOccurrenceScope,
  type SemanticSubject,
  isCompleteSemanticOccurrenceScope,
} from "./semantic-dependency-contract.ts";
import type { SemanticDependencyGap } from "./semantic-dependency-normalizer.ts";
import {
  canonicalRootCriterionId,
  type RootCriterion,
  type WriteScopedPlanInputGap,
} from "./write-scoped-plan-inputs.ts";

export const TARGET_FIELD_CAUSAL_SLICE_ARTIFACT_TYPE =
  "TARGET_FIELD_CAUSAL_SLICE" as const;
export const TARGET_FIELD_CAUSAL_SLICE_SCHEMA_VERSION = "2.0.0" as const;
export const LEGACY_FIELD_LINEAGE_ARTIFACT_TYPE =
  "FIELD_MULTI_HOP_RECONCILIATION" as const;

export interface CausalSliceInputReference {
  readonly fingerprint: string;
  readonly reference: string;
  readonly artifactType?: string;
}

export interface CausalSliceInputFingerprints {
  readonly inputPack: readonly CausalSliceInputReference[];
  readonly machineFacts: readonly CausalSliceInputReference[];
  readonly producerIndex: readonly CausalSliceInputReference[];
  readonly tableMultiHopArtifact: readonly CausalSliceInputReference[];
  readonly legacyFieldLineageValueEvidence?: readonly CausalSliceInputReference[];
}

export interface CausalSliceRequest {
  readonly rootTaskId: string;
  readonly rootTable: string;
  readonly rootFields: readonly string[];
  readonly rootWriteObservationIds: readonly string[];
  readonly negativeProofMode: NegativeProofMode;
}

export interface CausalSliceLimit {
  readonly maxStates: number;
  readonly maxPaths: number;
  readonly truncated: boolean;
  readonly reasons: readonly string[];
}

export interface CausalSliceLimits {
  readonly maxDepth: number;
  readonly value: CausalSliceLimit;
  readonly control: CausalSliceLimit;
}

export interface CausalSliceDependencies {
  readonly definitions: readonly SemanticDependencyDefinition[];
  readonly applications: readonly SemanticDependencyApplication[];
  readonly edges: readonly SemanticDependencyEdge[];
  readonly gaps: readonly SemanticDependencyGap[];
}

export interface CausalSliceQualityMetrics {
  readonly confirmedEvidenceClosureRate: number | "NOT_APPLICABLE";
  readonly closedDecisionCoverage: {
    readonly numerator: number;
    readonly denominator: number;
    readonly rate: number;
  };
  readonly precision: "NOT_EVALUATED";
  readonly recall: "NOT_EVALUATED";
}

export interface CausalSliceBoundaries {
  readonly staticSqlOnly: true;
  readonly runtimeExecution: "NOT_EVALUATED";
  readonly dataCorrectness: "NOT_EVALUATED";
  readonly businessAcceptance: "NOT_EVALUATED";
}

export interface CausalSliceArtifact {
  readonly schemaVersion: typeof TARGET_FIELD_CAUSAL_SLICE_SCHEMA_VERSION;
  readonly artifactType: typeof TARGET_FIELD_CAUSAL_SLICE_ARTIFACT_TYPE;
  readonly generatedAt: string;
  readonly request: CausalSliceRequest;
  /** Canonical user-selected write-and-field criteria. */
  readonly rootCriteria: readonly RootCriterion[];
  /** Registry for every local root/operator occurrence referenced by the slice. */
  readonly semanticScopes: readonly SemanticOccurrenceScope[];
  /** Fail-closed write/Plan scope boundaries, including unresolved criteria. */
  readonly scopeGaps: readonly WriteScopedPlanInputGap[];
  readonly inputFingerprints: CausalSliceInputFingerprints;
  readonly dependencies: CausalSliceDependencies;
  readonly candidateUniverse: CandidateUniverse;
  readonly traversal: CausalTraversalResult;
  readonly limits: CausalSliceLimits;
  readonly assessments: readonly CausalAssessment[];
  readonly positiveProofs: readonly PositiveCausalProof[];
  readonly negativeProofs: readonly NegativeCausalProof[];
  readonly assessmentGaps: readonly CausalAssessmentGap[];
  readonly rerunSets: RerunSetsResult;
  readonly qualityMetrics: CausalSliceQualityMetrics;
  readonly boundaries: CausalSliceBoundaries;
  readonly contentHash: string;
}

export type CausalSliceArtifactInput = Omit<
  CausalSliceArtifact,
  "contentHash" | "qualityMetrics"
> & { readonly qualityMetrics?: CausalSliceQualityMetrics };

export interface CausalSliceSchema {
  readonly artifactType: typeof TARGET_FIELD_CAUSAL_SLICE_ARTIFACT_TYPE;
  readonly schemaVersion: typeof TARGET_FIELD_CAUSAL_SLICE_SCHEMA_VERSION;
}

export const TARGET_FIELD_CAUSAL_SLICE_SCHEMA: CausalSliceSchema = {
  artifactType: TARGET_FIELD_CAUSAL_SLICE_ARTIFACT_TYPE,
  schemaVersion: TARGET_FIELD_CAUSAL_SLICE_SCHEMA_VERSION,
};

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort(compare);
}

function sortedUniqueBy<T>(values: readonly T[], key: (value: T) => string): readonly T[] {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const current = groups.get(key(value)) ?? [];
    current.push(value);
    groups.set(key(value), current);
  }
  return [...groups.entries()]
    .map(([itemKey, items]) => {
      const canonicalValues = sortedUnique(items.map((item) => canonicalJson(item)));
      if (canonicalValues.length !== 1)
        throw new Error(`CAUSAL_SLICE_CONFLICTING_DUPLICATE:${itemKey}`);
      return [itemKey, items[0]!] as const;
    })
    .sort((left, right) => compare(left[0], right[0]))
    .map(([, value]) => value);
}

function subject(value: SemanticSubject): SemanticSubject {
  return value.subjectKind === "PHYSICAL_FIELD"
    ? { subjectKind: value.subjectKind, physicalFieldId: value.physicalFieldId }
    : { subjectKind: value.subjectKind, relationOccurrenceId: value.relationOccurrenceId };
}

function refs<T extends { readonly proofRefId: string }>(values: readonly T[]): readonly T[] {
  return sortedUniqueBy(values, (value) => value.proofRefId);
}

function dependencies(value: CausalSliceDependencies): CausalSliceDependencies {
  const scope = (item: SemanticOccurrenceScope): SemanticOccurrenceScope => ({
    ...item,
    evidenceRefs: sortedUnique(item.evidenceRefs),
  });
  return {
    definitions: sortedUniqueBy(value.definitions, (item) => item.dependencyId).map((item) => ({
      ...item,
      subject: subject(item.subject),
      ...(item.semanticScope === undefined
        ? {}
        : { semanticScope: scope(item.semanticScope) }),
      proofRefs: refs(item.proofRefs),
    })),
    applications: sortedUniqueBy(value.applications, (item) => item.applicationId).map((item) => ({
      ...item,
      ...(item.semanticScope === undefined
        ? {}
        : { semanticScope: scope(item.semanticScope) }),
      proofRefs: refs(item.proofRefs),
    })),
    edges: sortedUniqueBy(value.edges, (item) => item.edgeId).map((item) => ({
      ...item,
      fromSubject: subject(item.fromSubject),
      toSubject: subject(item.toSubject),
      ...(item.semanticScope === undefined
        ? {}
        : { semanticScope: scope(item.semanticScope) }),
      proofRefs: refs(item.proofRefs),
    })),
    gaps: sortedUniqueBy(value.gaps, (item) => item.gapId).map((item) => ({
      ...item,
      ...(item.subject ? { subject: subject(item.subject) } : {}),
      semanticScope: item.semanticScope === null
        ? null
        : scope(item.semanticScope),
      proofRefs: refs(item.proofRefs),
      evidenceRefs: sortedUnique(item.evidenceRefs),
    })),
  };
}

function validatedProjectionById<T>(
  values: readonly T[],
  key: (value: T) => string,
  label: string,
  errors: string[],
): readonly T[] {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const itemKey = key(value);
    groups.set(itemKey, [...(groups.get(itemKey) ?? []), value]);
  }
  return [...groups.entries()]
    .sort((left, right) => compare(left[0], right[0]))
    .map(([itemKey, items]) => {
      if (new Set(items.map((item) => canonicalJson(item))).size !== 1)
        errors.push(`${label} has conflicting duplicate:${itemKey}`);
      return items[0]!;
    });
}

function rootCriteria(values: readonly RootCriterion[]): readonly RootCriterion[] {
  return sortedUniqueBy(values, (item) => item.rootCriterionId).map((item) => ({
    ...item,
    evidenceRefs: sortedUnique(item.evidenceRefs),
  }));
}

function semanticScopes(
  values: readonly SemanticOccurrenceScope[],
): readonly SemanticOccurrenceScope[] {
  return sortedUniqueBy(values, (item) => item.semanticScopeId).map((item) => ({
    ...item,
    evidenceRefs: sortedUnique(item.evidenceRefs),
  }));
}

function scopeGaps(
  values: readonly WriteScopedPlanInputGap[],
): readonly WriteScopedPlanInputGap[] {
  return sortedUniqueBy(values, (item) => item.gapId).map((item) => ({
    ...item,
    evidenceRefs: sortedUnique(item.evidenceRefs),
  }));
}

function inputReferences(values: readonly CausalSliceInputReference[]): readonly CausalSliceInputReference[] {
  return sortedUniqueBy(values, (item) => `${item.fingerprint}\u0000${item.reference}`).map((item) => ({ ...item }));
}

function candidateUniverse(value: CandidateUniverse): CandidateUniverse {
  return {
    ...value,
    branches: sortedUniqueBy(value.branches, (item) => item.candidateBranchId).map((item) => ({
      ...item,
      table: item.table ? { ...item.table } : null,
      readOccurrence: item.readOccurrence
        ? { ...item.readOccurrence, relationPath: [...item.readOccurrence.relationPath] }
        : null,
      evidenceRefs: sortedUniqueBy(item.evidenceRefs, (ref) => ref.evidenceRefId).map((ref) => ({ ...ref })),
      gapRefs: sortedUnique(item.gapRefs),
    })),
    boundaryGapRefs: sortedUnique(value.boundaryGapRefs),
    coverage: { ...value.coverage },
  };
}

function traversal(value: CausalTraversalResult): CausalTraversalResult {
  const roots = sortedUniqueBy(value.roots, (item) => item.rootCriterionId).map((item) => ({
    ...item,
    root: {
      ...item.root,
      rootCriterion: {
        ...item.root.rootCriterion,
        evidenceRefs: sortedUnique(item.root.rootCriterion.evidenceRefs),
      },
      semanticScope: {
        ...item.root.semanticScope,
        evidenceRefs: sortedUnique(item.root.semanticScope.evidenceRefs),
      },
      ...(item.root.subject === undefined
        ? {}
        : { subject: subject(item.root.subject) }),
    },
    visitedStateKeys: sortedUnique(item.visitedStateKeys),
    frontiers: { ...item.frontiers },
    paths: sortedUniqueBy(item.paths, (path) => path.pathId).map((path) => ({
      ...path,
      edges: path.edges.map((edge) => ({
        ...edge,
        fromSubject: subject(edge.fromSubject),
        toSubject: subject(edge.toSubject),
        evidenceRefs: sortedUnique(edge.evidenceRefs),
      })),
    })),
    gaps: sortedUniqueBy(item.gaps, (gap) => gap.gapId).map((gap) => ({
      ...gap,
      subject: gap.subject ? subject(gap.subject) : null,
      evidenceRefs: sortedUnique(gap.evidenceRefs),
    })),
    decision: {
      ...item.decision,
      valueGapIds: sortedUnique(item.decision.valueGapIds),
      controlGapIds: sortedUnique(item.decision.controlGapIds),
    },
  }));
  return {
    ...value,
    options: { ...value.options },
    roots,
    sharedEvidenceRefs: sortedUnique(value.sharedEvidenceRefs),
    edges: sortedUniqueBy(value.edges, (edge) => edge.edgeId).map((edge) => ({
      ...edge,
      fromSubject: subject(edge.fromSubject),
      toSubject: subject(edge.toSubject),
      evidenceRefs: sortedUnique(edge.evidenceRefs),
    })),
    gaps: sortedUniqueBy(value.gaps, (gap) => gap.gapId).map((gap) => ({
      ...gap,
      subject: gap.subject ? subject(gap.subject) : null,
      evidenceRefs: sortedUnique(gap.evidenceRefs),
    })),
  };
}

const obligationOrder: Readonly<Record<NegativeProofObligation["kind"], number>> = {
  VALUE: 0,
  CONTROL: 1,
  RELATION: 2,
};

function obligations(values: readonly NegativeProofObligation[]): readonly NegativeProofObligation[] {
  return [...values]
    .map((item) => ({ kind: item.kind, evidenceRefs: sortedUnique(item.evidenceRefs) }))
    .sort((left, right) => obligationOrder[left.kind] - obligationOrder[right.kind]);
}

function assessments(values: readonly CausalAssessment[]): readonly CausalAssessment[] {
  return sortedUniqueBy(values, (item) => item.pairId).map((item) => ({
    ...item,
    positiveProofIds: sortedUnique(item.positiveProofIds),
    negativeProofIds: sortedUnique(item.negativeProofIds),
    gapRefs: sortedUnique(item.gapRefs),
  }));
}

function positiveProofs(values: readonly PositiveCausalProof[]): readonly PositiveCausalProof[] {
  return sortedUniqueBy(values, (item) => item.proofId).map((item) => ({
    ...item,
    pathIds: sortedUnique(item.pathIds),
    evidenceRefs: sortedUnique(item.evidenceRefs),
    edgeIds: [...item.edgeIds],
  }));
}

function negativeProofs(values: readonly NegativeCausalProof[]): readonly NegativeCausalProof[] {
  return sortedUniqueBy(values, (item) => item.proofId).map((item) => ({
    ...item,
    checkedObligations: obligations(item.checkedObligations),
    evidenceRefs: sortedUnique(item.evidenceRefs),
  }));
}

function assessmentGaps(values: readonly CausalAssessmentGap[]): readonly CausalAssessmentGap[] {
  return sortedUniqueBy(values, (item) => item.gapId).map((item) => ({
    ...item,
    evidenceRefs: sortedUnique(item.evidenceRefs),
  }));
}

function rerunSet(value: RerunSet): RerunSet {
  const entry = (item: RerunSet["entries"][number]): RerunSet["entries"][number] => ({
    ...item,
    triggers: sortedUniqueBy(item.triggers, (trigger) => `${trigger.rootCriterionId}\u0000${trigger.rootTargetFieldId}\u0000${trigger.candidateBranchId}\u0000${trigger.assessmentId}`).map((trigger) => ({
      ...trigger,
      positiveProofIds: sortedUnique(trigger.positiveProofIds),
      negativeProofIds: sortedUnique(trigger.negativeProofIds),
      gapRefs: sortedUnique(trigger.gapRefs),
    })),
  });
  const entries = sortedUniqueBy(value.entries, (item) => item.taskId ?? "").map(entry);
  const unresolved = sortedUniqueBy(value.unresolved, (item) => canonicalJson(item)).map(entry);
  return {
    ...value,
    taskIds: sortedUnique(value.taskIds),
    entries,
    unresolved,
  };
}

function canonicalLimits(value: CausalSliceLimits): CausalSliceLimits {
  const limit = (item: CausalSliceLimit): CausalSliceLimit => ({
    ...item,
    reasons: sortedUnique(item.reasons),
  });
  return { ...value, value: limit(value.value), control: limit(value.control) };
}

function quality(assessmentValues: readonly CausalAssessment[]): CausalSliceQualityMetrics {
  const confirmed = assessmentValues.filter((item) => item.status === "CONFIRMED_RELATED").length;
  const closed = assessmentValues.filter(
    (item) =>
      item.status === "CONFIRMED_RELATED" ||
      item.status === "PROVEN_UNRELATED",
  ).length;
  const denominator = assessmentValues.length;
  return {
    confirmedEvidenceClosureRate: confirmed > 0 ? 1 : "NOT_APPLICABLE",
    closedDecisionCoverage: {
      numerator: closed,
      denominator,
      rate: denominator === 0 ? 0 : closed / denominator,
    },
    precision: "NOT_EVALUATED",
    recall: "NOT_EVALUATED",
  };
}

function hashProjection(
  value: Omit<CausalSliceArtifact, "contentHash"> | CausalSliceArtifact,
): string {
  const {
    generatedAt: _generatedAt,
    contentHash: _contentHash,
    ...stable
  } = value as CausalSliceArtifact;
  return sha256(canonicalJson(stable));
}

export function canonicalizeCausalSliceArtifact(input: CausalSliceArtifactInput): CausalSliceArtifact {
  const canonicalAssessments = assessments(input.assessments);
  const withoutHash: Omit<CausalSliceArtifact, "contentHash"> = {
    ...input,
    request: {
      ...input.request,
      rootFields: sortedUnique(input.request.rootFields),
      rootWriteObservationIds: sortedUnique(input.request.rootWriteObservationIds),
    },
    rootCriteria: rootCriteria(input.rootCriteria),
    semanticScopes: semanticScopes(input.semanticScopes),
    scopeGaps: scopeGaps(input.scopeGaps),
    inputFingerprints: {
      inputPack: inputReferences(input.inputFingerprints.inputPack),
      machineFacts: inputReferences(input.inputFingerprints.machineFacts),
      producerIndex: inputReferences(input.inputFingerprints.producerIndex),
      tableMultiHopArtifact: inputReferences(input.inputFingerprints.tableMultiHopArtifact),
      ...(input.inputFingerprints.legacyFieldLineageValueEvidence === undefined
        ? {}
        : { legacyFieldLineageValueEvidence: inputReferences(input.inputFingerprints.legacyFieldLineageValueEvidence) }),
    },
    dependencies: dependencies(input.dependencies),
    candidateUniverse: candidateUniverse(input.candidateUniverse),
    traversal: traversal(input.traversal),
    limits: canonicalLimits(input.limits),
    assessments: canonicalAssessments,
    positiveProofs: positiveProofs(input.positiveProofs),
    negativeProofs: negativeProofs(input.negativeProofs),
    assessmentGaps: assessmentGaps(input.assessmentGaps),
    rerunSets: {
      minimumConfirmed: rerunSet(input.rerunSets.minimumConfirmed),
      conservativeSafety: rerunSet(input.rerunSets.conservativeSafety),
    },
    qualityMetrics: quality(canonicalAssessments),
    boundaries: { ...input.boundaries },
  };
  const artifact: CausalSliceArtifact = {
    ...withoutHash,
    contentHash: hashProjection(withoutHash),
  };
  const errors = validateCausalSliceArtifact(artifact);
  if (errors.length > 0) throw new Error(`CAUSAL_SLICE_ARTIFACT_INVALID: ${errors.join("; ")}`);
  return artifact;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function orderedUnique(values: readonly string[]): boolean {
  return values.every((value, index) => value.length > 0 && (index === 0 || values[index - 1]! < value));
}

function sha256Fingerprint(value: unknown): boolean {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function sameSubject(left: SemanticSubject, right: SemanticSubject): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function persistedTraversalEdgeId(
  edge: CausalTraversalPathEdge,
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

function traversalEdgeEnumsAreValid(edge: CausalTraversalPathEdge): boolean {
  return ROOT_DEPENDENCE_KINDS.includes(edge.rootDependenceKind) &&
    LOCAL_EDGE_KINDS.includes(edge.localEdgeKind) &&
    TRAVERSAL_FRONTIER_KINDS.includes(edge.frontierKind) &&
    PATH_CERTAINTIES.includes(edge.pathCertainty);
}

function traversalGapEnumsAreValid(gap: CausalTraversalGap): boolean {
  return ROOT_DEPENDENCE_KINDS.includes(gap.rootDependenceKind) &&
    TRAVERSAL_FRONTIER_KINDS.includes(gap.frontierKind);
}

function relevantTraversalGaps(
  artifact: CausalSliceArtifact,
  rootCriterionId: string,
): readonly CausalTraversalResult["gaps"][number][] {
  const rootGaps = artifact.traversal.roots
    .filter((root) => root.rootCriterionId === rootCriterionId)
    .flatMap((root) => root.gaps);
  const values = [...rootGaps, ...artifact.traversal.gaps]
    .filter((gap) => gap.rootCriterionId === rootCriterionId)
    .sort((left, right) =>
      compare(left.gapId, right.gapId) ||
      compare(canonicalJson(left), canonicalJson(right))
    );
  return values.filter((gap, index) =>
    index === 0 || canonicalJson(gap) !== canonicalJson(values[index - 1])
  );
}

function pathMatchesOccurrenceScope(
  path: CausalTraversalPath,
  rootCriterionId: string,
  rootSemanticScopeId: string,
): boolean {
  return path.rootCriterionId === rootCriterionId &&
    path.edges.length > 0 &&
    path.edges.every((edge) => edge.rootCriterionId === rootCriterionId) &&
    path.edges[0]!.toSemanticScopeId === rootSemanticScopeId &&
    path.edges.slice(1).every((edge, index) =>
      edge.toSemanticScopeId === path.edges[index]!.fromSemanticScopeId
    );
}

/** Uses the same exact physical bridge rule as positive assessment generation. */
function pathMatchesExactBranchOccurrence(
  root: CausalTraversalResult["roots"][number],
  path: CausalTraversalPath,
  branch: CandidateBranch,
): boolean {
  return pathMatchesOccurrenceScope(
    path,
    root.rootCriterionId,
    root.root.semanticScope.semanticScopeId,
  ) && exactOccurrenceBridgeForCandidatePath(path, branch) !== null;
}

/** The broader check is fail-closed and is used only to reject negative proof. */
function pathCouldReachCandidateBranch(
  root: CausalTraversalResult["roots"][number],
  path: CausalTraversalPath,
  branch: CandidateBranch,
): boolean {
  if (
    branch.branchKind !== "PHYSICAL_PRODUCER" ||
    branch.readOccurrence === null ||
    !pathMatchesOccurrenceScope(
      path,
      root.rootCriterionId,
      root.root.semanticScope.semanticScopeId,
    )
  ) return false;
  return pathMatchesExactBranchOccurrence(root, path, branch) ||
    path.edges.some((edge) => {
    const relationIds = [edge.fromSubject, edge.toSubject]
      .filter((item) => item.subjectKind === "RELATION_OCCURRENCE")
      .map((item) => item.subjectKind === "RELATION_OCCURRENCE"
        ? item.relationOccurrenceId
        : "");
    return edge.readOccurrenceId === branch.readOccurrence!.occurrenceId ||
      relationIds.includes(branch.readOccurrence!.readRelationId);
  });
}

/** Mirrors the negative-proof generation gate for one exact physical branch. */
function exactPositivePathExists(
  root: CausalTraversalResult["roots"][number],
  branch: CandidateBranch,
): boolean {
  return root.paths.some((path) =>
    pathCouldReachCandidateBranch(root, path, branch)
  );
}

function positiveProofHash(proof: PositiveCausalProof): string {
  const { proofId: _proofId, ...input } = proof;
  return `positive-proof:${sha256(canonicalJson(input))}`;
}

function negativeProofHash(proof: NegativeCausalProof): string {
  const { proofId: _proofId, ...input } = proof;
  return `negative-proof:${sha256(canonicalJson(input))}`;
}

function assessmentPairKey(rootCriterionId: string, branch: string): string {
  return `${rootCriterionId}\u0000${branch}`;
}

function validateProofContinuity(
  proof: PositiveCausalProof,
  artifact: CausalSliceArtifact,
  errors: string[],
): void {
  if (proof.proofId !== positiveProofHash(proof)) errors.push(`POSITIVE_PROOF_HASH_INVALID:${proof.proofId}`);
  const proofCriterion = artifact.rootCriteria.find(
    (item) => item.rootCriterionId === proof.rootCriterionId,
  );
  if (!proofCriterion || proofCriterion.rootTargetFieldId !== proof.rootTargetFieldId)
    errors.push(`POSITIVE_PROOF_ROOT_CRITERION_INVALID:${proof.proofId}`);
  if (proof.evidenceRefs.length === 0 || !orderedUnique(proof.evidenceRefs)) errors.push(`POSITIVE_PROOF_EVIDENCE_INVALID:${proof.proofId}`);
  if (proof.reasonCode === "EXPLICIT_ROOT_WRITE_PROOF") {
    if (proof.pathIds.length !== 0 || proof.edgeIds.length !== 0) errors.push(`ROOT_WRITE_PROOF_PATH_INVALID:${proof.proofId}`);
    const branch = artifact.candidateUniverse.branches.find((candidate) =>
      candidate.candidateBranchId === proof.candidateBranchId,
    );
    const criterion = artifact.rootCriteria.find(
      (candidate) => candidate.rootCriterionId === proof.rootCriterionId,
    );
    const rootPhysicalTable = proof.rootTargetFieldId.split("|")[3]?.toLowerCase();
    if (
      !criterion ||
      criterion.rootTargetFieldId !== proof.rootTargetFieldId ||
      branch?.branchKind !== "ROOT_WRITE" ||
      branch.producerTaskId !== artifact.request.rootTaskId ||
      !nonEmpty(branch.writeObservationId) ||
      branch.writeObservationId !== criterion.rootWriteObservationId ||
      proof.evidenceRefs.some((ref) => !criterion.evidenceRefs.includes(ref)) ||
      ![criterion.rootWriteObservationId, criterion.outputBindingId].every(
        (ref) => proof.evidenceRefs.includes(ref),
      ) ||
      (branch.table?.qualifiedName !== null && branch.table?.qualifiedName !== undefined
        ? branch.table.qualifiedName.toLowerCase() !== artifact.request.rootTable.toLowerCase()
        : rootPhysicalTable !== artifact.request.rootTable.toLowerCase())
    ) errors.push(`ROOT_WRITE_PROOF_BRANCH_INVALID:${proof.proofId}`);
    if (
      criterion &&
      ![criterion.rootWriteObservationId, criterion.outputBindingId].every(
        (ref) => proof.evidenceRefs.includes(ref),
      )
    ) errors.push(`ROOT_WRITE_PROOF_REQUIRED_EVIDENCE_MISSING:${proof.proofId}`);
    return;
  }
  if (proof.pathIds.length !== 1) {
    errors.push(`POSITIVE_PROOF_PATH_CARDINALITY:${proof.proofId}`);
    return;
  }
  const root = artifact.traversal.roots.find(
    (item) => item.rootCriterionId === proof.rootCriterionId,
  );
  const path = root?.paths.find((item) => item.pathId === proof.pathIds[0]);
  if (!path || path.rootCriterionId !== proof.rootCriterionId) {
    errors.push(`POSITIVE_PROOF_PATH_MISSING:${proof.proofId}`);
    return;
  }
  const branch = artifact.candidateUniverse.branches.find(
    (candidate) => candidate.candidateBranchId === proof.candidateBranchId,
  );
  if (!branch || !root || !pathMatchesExactBranchOccurrence(root, path, branch))
    errors.push(`POSITIVE_PROOF_EXACT_BRANCH_INVALID:${proof.proofId}`);
  if (path.edges.length === 0 || path.edges.some((edge) => edge.evidenceRefs.length === 0)) errors.push(`POSITIVE_PROOF_EVIDENCE_MISSING:${proof.proofId}`);
  const scopeById = new Map(
    artifact.semanticScopes.map((scope) => [scope.semanticScopeId, scope]),
  );
  if (
    path.edges[0]?.toSemanticScopeId !==
    root?.root.semanticScope.semanticScopeId
  ) errors.push(`POSITIVE_PROOF_ROOT_SCOPE_INVALID:${proof.proofId}`);
  for (const edge of path.edges) {
    const fromScope = scopeById.get(edge.fromSemanticScopeId);
    const toScope = scopeById.get(edge.toSemanticScopeId);
    if (
      edge.rootCriterionId !== proof.rootCriterionId ||
      !fromScope ||
      !toScope ||
      fromScope.taskId !== edge.fromTaskId ||
      toScope.taskId !== edge.toTaskId ||
      (edge.fromTaskId === edge.toTaskId &&
        edge.fromSemanticScopeId !== edge.toSemanticScopeId)
    ) errors.push(`POSITIVE_PROOF_EDGE_SCOPE_INVALID:${proof.proofId}:${edge.edgeId}`);
  }
  if (canonicalJson(proof.edgeIds) !== canonicalJson(path.edges.map((edge) => edge.edgeId))) errors.push(`POSITIVE_PROOF_EDGE_SEQUENCE_INVALID:${proof.proofId}`);
  const expectedRefs = sortedUnique(path.edges.flatMap((edge) => edge.evidenceRefs));
  if (canonicalJson(proof.evidenceRefs) !== canonicalJson(expectedRefs)) errors.push(`POSITIVE_PROOF_EVIDENCE_SEQUENCE_INVALID:${proof.proofId}`);
  for (const gap of relevantTraversalGaps(artifact, proof.rootCriterionId))
    if (traversalGapBlocksPositivePath(gap, path))
      errors.push(`POSITIVE_PROOF_PATH_BLOCKED:${proof.proofId}:${gap.gapId}`);
  for (let index = 1; index < path.edges.length; index++) {
    const previous = path.edges[index - 1]!;
    const current = path.edges[index]!;
    // Traversal starts at the target and walks upstream, while each edge is
    // stored in its canonical producer -> consumer direction.  Therefore the
    // next edge's consumer is the previous edge's producer.
    if (previous.fromTaskId !== current.toTaskId || !sameSubject(previous.fromSubject, current.toSubject)) errors.push(`POSITIVE_PROOF_PATH_NONCONTINUOUS:${proof.proofId}`);
    if (previous.fromSemanticScopeId !== current.toSemanticScopeId)
      errors.push(`POSITIVE_PROOF_SCOPE_NONCONTINUOUS:${proof.proofId}`);
  }
  const expectedCertainty = path.edges.some((edge) => edge.pathCertainty === "UNKNOWN") || path.pathCertainty === "UNKNOWN"
    ? "UNKNOWN"
    : path.edges.some((edge) => edge.pathCertainty === "CONDITIONAL") || path.pathCertainty === "CONDITIONAL"
      ? "CONDITIONAL"
      : "CONFIRMED";
  if (proof.pathCertainty !== expectedCertainty) errors.push(`POSITIVE_PROOF_CERTAINTY_INVALID:${proof.proofId}`);
}

function validateNegativeProof(
  proof: NegativeCausalProof,
  artifact: CausalSliceArtifact,
  proofById: ReadonlyMap<string, NegativeCausalProof>,
  errors: string[],
): void {
  if (proof.proofId !== negativeProofHash(proof)) errors.push(`NEGATIVE_PROOF_HASH_INVALID:${proof.proofId}`);
  const criterion = artifact.rootCriteria.find(
    (item) => item.rootCriterionId === proof.rootCriterionId,
  );
  if (!criterion || criterion.rootTargetFieldId !== proof.rootTargetFieldId)
    errors.push(`NEGATIVE_PROOF_ROOT_CRITERION_INVALID:${proof.proofId}`);
  const matchingRoots = artifact.traversal.roots.filter(
    (item) => item.rootCriterionId === proof.rootCriterionId,
  );
  const root = matchingRoots.length === 1 ? matchingRoots[0]! : undefined;
  if (matchingRoots.length !== 1)
    errors.push(`NEGATIVE_PROOF_ROOT_CARDINALITY_INVALID:${proof.proofId}`);
  if (root?.decision.valueClosed !== true)
    errors.push(`NEGATIVE_PROOF_VALUE_NOT_CLOSED:${proof.proofId}`);
  if (root?.decision.controlClosed !== true)
    errors.push(`NEGATIVE_PROOF_CONTROL_NOT_CLOSED:${proof.proofId}`);
  for (const gap of relevantTraversalGaps(artifact, proof.rootCriterionId))
    errors.push(`NEGATIVE_PROOF_TRAVERSAL_GAP_PRESENT:${proof.proofId}:${gap.gapId}`);
  const branchIds = new Set([proof.candidateBranchId]);
  const sourceProof = proof.sourceNegativeProofId === null
    ? undefined
    : proofById.get(proof.sourceNegativeProofId);
  if (sourceProof) branchIds.add(sourceProof.candidateBranchId);
  const canonicalEvidenceRefs = new Set([
    ...(criterion?.evidenceRefs ?? []),
    ...artifact.candidateUniverse.branches
      .filter((candidate) => branchIds.has(candidate.candidateBranchId))
      .flatMap((candidate) =>
        candidate.evidenceRefs.map((ref) => ref.evidenceRefId)
      ),
    ...(root?.paths ?? [])
      .filter((path) => {
        const edges = path.edges ?? [];
        if (
          path.rootCriterionId !== proof.rootCriterionId ||
          edges.length === 0 ||
          edges[0]!.toSemanticScopeId !==
            root!.root.semanticScope.semanticScopeId ||
          edges.some((edge) => edge.rootCriterionId !== proof.rootCriterionId)
        ) return false;
        return edges.every((edge, index) => {
          if (index === 0) return true;
          const prior = edges[index - 1]!;
          return edge.toSemanticScopeId === prior.fromSemanticScopeId &&
            edge.toTaskId === prior.fromTaskId &&
            sameSubject(edge.toSubject, prior.fromSubject);
        });
      })
      .flatMap((path) => path.edges.flatMap((edge) => edge.evidenceRefs)),
  ]);
  const kinds = proof.checkedObligations.map((item) => item.kind);
  if (kinds.length !== 3 || new Set(kinds).size !== 3 || !["VALUE", "CONTROL", "RELATION"].every((kind) => kinds.includes(kind as NegativeProofObligation["kind"]))) errors.push(`NEGATIVE_PROOF_OBLIGATIONS_INCOMPLETE:${proof.proofId}`);
  for (const obligation of proof.checkedObligations) {
    if (obligation.evidenceRefs.length === 0 || !orderedUnique(obligation.evidenceRefs)) errors.push(`NEGATIVE_PROOF_OBLIGATION_EVIDENCE_INVALID:${proof.proofId}`);
    for (const ref of obligation.evidenceRefs)
      if (!canonicalEvidenceRefs.has(ref)) errors.push(`NEGATIVE_PROOF_OBLIGATION_EVIDENCE_UNKNOWN:${proof.proofId}:${ref}`);
  }
  if (proof.evidenceRefs.length === 0 || !orderedUnique(proof.evidenceRefs)) errors.push(`NEGATIVE_PROOF_EVIDENCE_INVALID:${proof.proofId}`);
  if (proof.reasonCode === "INHERITED_FROM_PROVEN_UNRELATED_CUT" && proof.sourceNegativeProofId === null) errors.push(`NEGATIVE_PROOF_SOURCE_MISSING:${proof.proofId}`);
  if (proof.reasonCode === "EXPLICIT_SAFE_RULES_ONLY" && proof.sourceNegativeProofId !== null) errors.push(`NEGATIVE_PROOF_SOURCE_UNEXPECTED:${proof.proofId}`);
  const branch = artifact.candidateUniverse.branches.find((candidate) => candidate.candidateBranchId === proof.candidateBranchId);
  if (!branch) errors.push(`NEGATIVE_PROOF_BRANCH_MISSING:${proof.proofId}`);
  if (branch?.branchKind === "ROOT_WRITE") errors.push(`NEGATIVE_PROOF_ROOT_WRITE_FORBIDDEN:${proof.proofId}`);
  if ((branch?.gapRefs.length ?? 0) > 0)
    errors.push(`NEGATIVE_PROOF_BRANCH_GAPS_PRESENT:${proof.proofId}`);
  if (root && branch && exactPositivePathExists(root, branch))
    errors.push(`NEGATIVE_PROOF_POSITIVE_PATH_EXISTS:${proof.proofId}`);
  if (proof.reasonCode === "INHERITED_FROM_PROVEN_UNRELATED_CUT") {
    const source = proof.sourceNegativeProofId === null
      ? undefined
      : proofById.get(proof.sourceNegativeProofId);
    const sourceBranch = source
      ? artifact.candidateUniverse.branches.find((candidate) => candidate.candidateBranchId === source.candidateBranchId)
      : undefined;
    const structuralRefs = [
      ...(sourceBranch?.evidenceRefs ?? []).map((ref) => ref.evidenceRefId),
      ...(branch?.evidenceRefs ?? []).map((ref) => ref.evidenceRefId),
    ];
    const sourceAssessments = source
      ? artifact.assessments.filter((assessment) =>
          assessment.rootCriterionId === proof.rootCriterionId &&
          assessment.rootTargetFieldId === proof.rootTargetFieldId &&
          assessment.candidateBranchId === source.candidateBranchId
        )
      : [];
    const sourceAssessment = sourceAssessments.length === 1
      ? sourceAssessments[0]!
      : undefined;
    if (
      !source ||
      source.reasonCode !== "EXPLICIT_SAFE_RULES_ONLY" ||
      source.rootCriterionId !== proof.rootCriterionId ||
      source.rootTargetFieldId !== proof.rootTargetFieldId ||
      sourceBranch?.producerTaskId !== branch?.consumerTaskId ||
      canonicalJson(source.checkedObligations) !== canonicalJson(proof.checkedObligations) ||
      structuralRefs.some((ref) => !proof.evidenceRefs.includes(ref))
    ) errors.push(`NEGATIVE_PROOF_CUT_SOURCE_INVALID:${proof.proofId}`);
    if (
      !sourceAssessment ||
      sourceAssessment.status !== "PROVEN_UNRELATED" ||
      sourceAssessment.reasonCode !== "EXPLICIT_SAFE_RULES_ONLY" ||
      canonicalJson(sourceAssessment.negativeProofIds) !==
        canonicalJson(source ? [source.proofId] : [])
    ) errors.push(`NEGATIVE_PROOF_CUT_SOURCE_ASSESSMENT_INVALID:${proof.proofId}`);
  }
  const obligationRefs = proof.checkedObligations.flatMap(
    (obligation) => obligation.evidenceRefs,
  );
  const sourceBranch = sourceProof
    ? artifact.candidateUniverse.branches.find(
      (candidate) => candidate.candidateBranchId === sourceProof.candidateBranchId,
    )
    : undefined;
  const structuralRefs = proof.reasonCode === "INHERITED_FROM_PROVEN_UNRELATED_CUT"
    ? [sourceBranch, branch]
      .filter((candidate): candidate is CandidateBranch => candidate !== undefined)
      .flatMap((candidate) =>
        candidate.evidenceRefs.map((ref) => ref.evidenceRefId)
      )
    : [];
  const expectedEvidenceRefs = sortedUnique([...obligationRefs, ...structuralRefs]);
  if (canonicalJson(proof.evidenceRefs) !== canonicalJson(expectedEvidenceRefs))
    errors.push(`NEGATIVE_PROOF_EVIDENCE_SET_INVALID:${proof.proofId}`);
  if (artifact.candidateUniverse.status !== "COMPLETE_OBSERVED_EVIDENCE" || artifact.candidateUniverse.boundaryGapRefs.length > 0 || artifact.candidateUniverse.coverage.sourceLimitsTruncated) errors.push(`NEGATIVE_PROOF_UNIVERSE_INCOMPLETE:${proof.proofId}`);
  if (artifact.candidateUniverse.coverage.sourceCoverageStatus !== "COMPLETE_OBSERVED_EVIDENCE")
    errors.push(`NEGATIVE_PROOF_SOURCE_COVERAGE_INCOMPLETE:${proof.proofId}`);
}

export function validateCausalSliceArtifact(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["artifact must be an object"];
  const artifact = value as unknown as CausalSliceArtifact;
  if (artifact.artifactType !== TARGET_FIELD_CAUSAL_SLICE_ARTIFACT_TYPE) errors.push("artifactType must be TARGET_FIELD_CAUSAL_SLICE");
  if (artifact.schemaVersion !== TARGET_FIELD_CAUSAL_SLICE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${TARGET_FIELD_CAUSAL_SLICE_SCHEMA_VERSION}`);
    if (artifact.schemaVersion === "1.0.0")
      errors.push("schemaVersion 1.0.0 is occurrence-unsafe and stale; regenerate the artifact without rewriting the legacy file");
    return [...new Set(errors)].sort(compare);
  }
  if (!nonEmpty(artifact.generatedAt)) errors.push("generatedAt is required");
  if (!isRecord(artifact.request)) errors.push("request is required");
  else {
    if (!nonEmpty(artifact.request.rootTaskId) || !nonEmpty(artifact.request.rootTable)) errors.push("request root identity is incomplete");
    if (!Array.isArray(artifact.request.rootFields) || artifact.request.rootFields.length === 0 || !orderedUnique(artifact.request.rootFields)) errors.push("rootFields must be sorted and non-empty");
    if (!Array.isArray(artifact.request.rootWriteObservationIds) || artifact.request.rootWriteObservationIds.length === 0 || !orderedUnique(artifact.request.rootWriteObservationIds)) errors.push("rootWriteObservationIds must be sorted and non-empty");
    if (artifact.request.negativeProofMode !== "SAFE_RULES_ONLY") errors.push("negativeProofMode is invalid");
  }
  const criteria = Array.isArray(artifact.rootCriteria)
    ? artifact.rootCriteria
    : [];
  if (
    criteria.length > 0 &&
    !orderedUnique(criteria.map((item) => item.rootCriterionId))
  ) errors.push("rootCriteria are not canonical");
  const criterionIds = new Set(criteria.map((item) => item.rootCriterionId));
  for (const criterion of criteria) {
    if (canonicalRootCriterionId(criterion) !== criterion.rootCriterionId)
      errors.push(`root criterion identity is invalid:${criterion.rootCriterionId}`);
    if (
      criterion.rootTaskId !== artifact.request?.rootTaskId ||
      !artifact.request?.rootFields?.includes(criterion.rootTargetFieldId) ||
      !artifact.request?.rootWriteObservationIds?.includes(
        criterion.rootWriteObservationId,
      )
    ) errors.push(`root criterion is outside the request:${criterion.rootCriterionId}`);
  }
  const scopes = Array.isArray(artifact.semanticScopes)
    ? artifact.semanticScopes
    : [];
  if (
    scopes.length > 0 &&
    !orderedUnique(scopes.map((item) => item.semanticScopeId))
  ) errors.push("semanticScopes are not canonical");
  const scopeIds = new Set(scopes.map((item) => item.semanticScopeId));
  const scopeById = new Map(scopes.map((item) => [item.semanticScopeId, item]));
  for (const scope of scopes)
    if (!isCompleteSemanticOccurrenceScope(scope))
      errors.push(`semantic scope identity is invalid:${scope.semanticScopeId}`);
  const writeScopeGaps = Array.isArray(artifact.scopeGaps)
    ? artifact.scopeGaps
    : [];
  if (!orderedUnique(writeScopeGaps.map((item) => item.gapId)))
    errors.push("scopeGaps are not canonical");
  if (criteria.length === 0 && writeScopeGaps.length === 0)
    errors.push("rootCriteria are empty without a blocking scope gap");
  if (criteria.length > 0 && scopes.length === 0)
    errors.push("semanticScopes are required for resolved root criteria");
  for (const gap of writeScopeGaps) {
    if (
      gap.blocksConfirmedCausality !== true ||
      gap.blocksNegativeProof !== true ||
      (gap.rootCriterionId !== null && !criterionIds.has(gap.rootCriterionId))
    ) errors.push(`scope gap is invalid:${gap.gapId}`);
  }
  const fingerprints = artifact.inputFingerprints;
  if (!isRecord(fingerprints)) errors.push("inputFingerprints are required");
  else for (const name of ["inputPack", "machineFacts", "producerIndex", "tableMultiHopArtifact"] as const) {
    const refsValue = fingerprints[name];
    if (!Array.isArray(refsValue) || refsValue.length === 0) errors.push(`inputFingerprints.${name} is required`);
    else for (const ref of refsValue) {
      if (!isRecord(ref) || !sha256Fingerprint(ref.fingerprint) || !nonEmpty(ref.reference)) errors.push(`inputFingerprints.${name} contains an invalid reference`);
    }
  }
  const legacy = fingerprints?.legacyFieldLineageValueEvidence;
  if (legacy !== undefined) for (const ref of legacy) if (!isRecord(ref) || ref.artifactType !== LEGACY_FIELD_LINEAGE_ARTIFACT_TYPE || !sha256Fingerprint(ref.fingerprint) || !nonEmpty(ref.reference)) errors.push("legacy VALUE evidence reference is invalid or collides with causal artifact");
  if (!isRecord(artifact.dependencies)) errors.push("dependencies are required");
  else {
    const definitions = artifact.dependencies.definitions;
    const applications = artifact.dependencies.applications;
    const edges = artifact.dependencies.edges;
    const gaps = artifact.dependencies.gaps;
    if (!Array.isArray(definitions) || !orderedUnique(definitions.map((item) => item.dependencyId))) errors.push("dependency definitions are not canonical");
    if (!Array.isArray(applications) || !orderedUnique(applications.map((item) => item.applicationId))) errors.push("dependency applications are not canonical");
    if (!Array.isArray(edges) || !orderedUnique(edges.map((item) => item.edgeId))) errors.push("dependency edges are not canonical");
    if (!Array.isArray(gaps) || !orderedUnique(gaps.map((item) => item.gapId))) errors.push("dependency gaps are not canonical");
    for (const gap of gaps ?? []) if (gap.blocksNegativeProof !== true) errors.push(`dependency gap does not block negative proof:${gap.gapId}`);
    const dependencyIds = new Set((definitions ?? []).map((item) => item.dependencyId));
    const definitionScopeById = new Map(
      (definitions ?? []).map((item) => [item.dependencyId, item.semanticScopeId]),
    );
    for (const item of definitions ?? []) {
      if (
        !nonEmpty(item.semanticScopeId) ||
        !scopeIds.has(item.semanticScopeId) ||
        !item.semanticScope ||
        item.semanticScope.semanticScopeId !== item.semanticScopeId
      ) errors.push(`dependency definition scope is invalid:${item.dependencyId}`);
      const identity = {
        subject: item.subject,
        effectKind: item.effectKind,
        operatorKind: item.operatorKind,
        operatorVariant: item.operatorVariant,
        operatorRole: item.operatorRole,
        localEdgeKind: item.localEdgeKind,
        ...(item.semanticScopeId === undefined
          ? {}
          : { semanticScopeId: item.semanticScopeId }),
      };
      // Native facts use the default namespace. Calcite supplementary facts
      // historically used the owning Task ID as namespace without persisting
      // that namespace separately, so both content-bound forms are accepted.
      const canonicalIds = new Set([
        canonicalSemanticDependencyId(identity),
        ...(item.semanticScope?.taskId
          ? [canonicalSemanticDependencyId({
              ...identity,
              namespace: item.semanticScope.taskId,
            })]
          : []),
      ]);
      if (!canonicalIds.has(item.dependencyId))
        errors.push(`dependency definition id is invalid:${item.dependencyId}`);
    }
    for (const item of applications ?? []) {
      if (!dependencyIds.has(item.dependencyId)) errors.push(`dependency application references missing definition:${item.applicationId}`);
      const expectedApplicationId = canonicalSemanticApplicationId(
        item.rootTargetFieldId,
        item.dependencyId,
        item.rootDependenceKind,
        item.scopeRelationId,
        item.rootCriterionId && item.semanticScopeId
          ? {
              rootCriterionId: item.rootCriterionId,
              semanticScopeId: item.semanticScopeId,
            }
          : undefined,
      );
      if (item.applicationId !== expectedApplicationId)
        errors.push(`dependency application id is invalid:${item.applicationId}`);
    }
    for (const item of edges ?? []) {
      if (!dependencyIds.has(item.dependencyId)) errors.push(`dependency edge references missing definition:${item.edgeId}`);
      const expectedEdgeId = canonicalSemanticEdgeId({
        dependencyId: item.dependencyId,
        fromSubject: item.fromSubject,
        toSubject: item.toSubject,
        rootDependenceKind: item.rootDependenceKind,
        localEdgeKind: item.localEdgeKind,
        ...(item.scopeRelationId === undefined
          ? {}
          : { scopeRelationId: item.scopeRelationId }),
        ...(item.rootCriterionId === undefined
          ? {}
          : { rootCriterionId: item.rootCriterionId }),
        ...(item.semanticScopeId === undefined
          ? {}
          : { semanticScopeId: item.semanticScopeId }),
      });
      if (item.edgeId !== expectedEdgeId)
        errors.push(`dependency edge id is invalid:${item.edgeId}`);
    }
    for (const item of applications ?? [])
      if (
        !nonEmpty(item.rootCriterionId) ||
        !criterionIds.has(item.rootCriterionId) ||
        !nonEmpty(item.semanticScopeId) ||
        !scopeIds.has(item.semanticScopeId) ||
        item.semanticScope?.semanticScopeId !== item.semanticScopeId ||
        definitionScopeById.get(item.dependencyId) !== item.semanticScopeId
      ) errors.push(`dependency application occurrence chain is invalid:${item.applicationId}`);
    for (const item of edges ?? [])
      if (
        !nonEmpty(item.rootCriterionId) ||
        !criterionIds.has(item.rootCriterionId) ||
        !nonEmpty(item.semanticScopeId) ||
        !scopeIds.has(item.semanticScopeId) ||
        item.semanticScope?.semanticScopeId !== item.semanticScopeId ||
        definitionScopeById.get(item.dependencyId) !== item.semanticScopeId
      ) errors.push(`dependency edge occurrence chain is invalid:${item.edgeId}`);
    for (const gap of gaps ?? []) {
      const incomplete = gap.reasonCode === "SEMANTIC_SCOPE_INCOMPLETE";
      if (
        !nonEmpty(gap.rootCriterionId) ||
        !criterionIds.has(gap.rootCriterionId) ||
        gap.blocksConfirmedCausality !== true ||
        (!incomplete &&
          (!nonEmpty(gap.semanticScopeId) ||
            !scopeIds.has(gap.semanticScopeId) ||
            gap.semanticScope?.semanticScopeId !== gap.semanticScopeId)) ||
        (incomplete &&
          (gap.semanticScopeId !== null || gap.semanticScope !== null))
      ) errors.push(`dependency gap occurrence chain is invalid:${gap.gapId}`);
    }
  }
  const traversalRoots = Array.isArray(artifact.traversal?.roots)
    ? artifact.traversal.roots
    : [];
  if (
    !orderedUnique(
      traversalRoots.map((item) => item.rootCriterionId),
    )
  ) errors.push("traversal roots are not canonical");
  for (const rootResult of traversalRoots) {
    const criterion = criteria.find(
      (item) => item.rootCriterionId === rootResult.rootCriterionId,
    );
    if (
      !criterion ||
      rootResult.root.rootCriterion.rootCriterionId !==
        rootResult.rootCriterionId ||
      rootResult.root.rootCriterion.rootTargetFieldId !==
        criterion.rootTargetFieldId ||
      !scopeIds.has(rootResult.root.semanticScope.semanticScopeId) ||
      !isCompleteSemanticOccurrenceScope(
        rootResult.root.semanticScope,
        criterion,
      ) ||
      rootResult.root.semanticScope.localRelationId !==
        criterion.localRootRelationId ||
      rootResult.root.semanticScope.relationId !== criterion.rootRelationId
    ) errors.push(`traversal root occurrence chain is invalid:${rootResult.rootCriterionId}`);
    if (!orderedUnique((rootResult.paths ?? []).map((path: CausalTraversalPath) => path.pathId)))
      errors.push(`traversal root paths are not canonical:${rootResult.rootCriterionId}`);
    if (!orderedUnique((rootResult.gaps ?? []).map((gap: CausalTraversalGap) => gap.gapId)))
      errors.push(`traversal root gaps are not canonical:${rootResult.rootCriterionId}`);
    for (const path of rootResult.paths ?? []) {
      if (
        path.rootCriterionId !== rootResult.rootCriterionId ||
        path.rootTargetFieldId !== criterion?.rootTargetFieldId
      ) errors.push(`traversal path root is invalid:${path.pathId}`);
      if (
        !ROOT_DEPENDENCE_KINDS.includes(path.rootDependenceKind) ||
        !PATH_CERTAINTIES.includes(path.pathCertainty)
      ) errors.push(`traversal path enum is invalid:${path.pathId}`);
      const pathEdges = path.edges ?? [];
      if (
        canonicalTraversalPathId(
          path.rootCriterionId,
          path.rootTargetFieldId,
          pathEdges,
        ) !== path.pathId
      ) errors.push(`traversal path id is invalid:${path.pathId}`);
      if (
        pathEdges.length > 0 &&
        pathEdges[0]!.toSemanticScopeId !==
          rootResult.root.semanticScope.semanticScopeId
      ) errors.push(`traversal path is not anchored to root scope:${path.pathId}`);
      for (let index = 0; index < pathEdges.length; index += 1) {
        const edge = pathEdges[index]!;
        if (
          persistedTraversalEdgeId(edge, path.rootTargetFieldId) !== edge.edgeId
        ) errors.push(`traversal path edge id is invalid:${edge.edgeId}`);
        if (!traversalEdgeEnumsAreValid(edge))
          errors.push(`traversal path edge enum is invalid:${edge.edgeId}`);
        if (
          edge.rootCriterionId !== rootResult.rootCriterionId ||
          !scopeIds.has(edge.fromSemanticScopeId) ||
          !scopeIds.has(edge.toSemanticScopeId) ||
          scopeById.get(edge.fromSemanticScopeId)?.taskId !== edge.fromTaskId ||
          scopeById.get(edge.toSemanticScopeId)?.taskId !== edge.toTaskId ||
          (edge.fromTaskId === edge.toTaskId &&
            edge.fromSemanticScopeId !== edge.toSemanticScopeId)
        ) errors.push(`traversal path edge scope is invalid:${edge.edgeId}`);
        const prior = index === 0 ? undefined : pathEdges[index - 1];
        if (
          prior &&
          (edge.toSemanticScopeId !== prior.fromSemanticScopeId ||
            canonicalJson(edge.toSubject) !== canonicalJson(prior.fromSubject))
        ) errors.push(`traversal path occurrence chain is discontinuous:${path.pathId}`);
      }
    }
    for (const gap of rootResult.gaps ?? []) {
      if (canonicalTraversalGapId(gap) !== gap.gapId)
        errors.push(`traversal root gap id is invalid:${gap.gapId}`);
      if (!traversalGapEnumsAreValid(gap))
        errors.push(`traversal root gap enum is invalid:${gap.gapId}`);
      if (
        gap.rootCriterionId !== rootResult.rootCriterionId ||
        !scopeIds.has(gap.semanticScopeId) ||
        scopeById.get(gap.semanticScopeId)?.taskId !== gap.taskId ||
        gap.blocksConfirmedCausality !== true ||
        gap.blocksNegativeProof !== true
      ) errors.push(`traversal gap occurrence chain is invalid:${gap.gapId}`);
    }
    const expectedValueGapIds = sortedUnique(
      (rootResult.gaps ?? [])
        .filter((gap: CausalTraversalGap) =>
          gap.rootDependenceKind === "VALUE_TO_TARGET"
        )
        .map((gap: CausalTraversalGap) => gap.gapId),
    );
    const expectedControlGapIds = sortedUnique(
      (rootResult.gaps ?? [])
        .filter((gap: CausalTraversalGap) =>
          gap.rootDependenceKind !== "VALUE_TO_TARGET"
        )
        .map((gap: CausalTraversalGap) => gap.gapId),
    );
    if (
      canonicalJson(rootResult.decision.valueGapIds) !==
      canonicalJson(expectedValueGapIds) ||
      rootResult.decision.valueClosed !== (expectedValueGapIds.length === 0)
    ) errors.push(`traversal value decision gaps are inconsistent:${rootResult.rootCriterionId}`);
    if (
      canonicalJson(rootResult.decision.controlGapIds) !==
      canonicalJson(expectedControlGapIds) ||
      rootResult.decision.controlClosed !== (expectedControlGapIds.length === 0)
    ) errors.push(`traversal control decision gaps are inconsistent:${rootResult.rootCriterionId}`);
  }
  if (!orderedUnique((artifact.traversal?.edges ?? []).map((edge) => edge.edgeId)))
    errors.push("traversal aggregate edges are not canonical");
  if (!orderedUnique((artifact.traversal?.gaps ?? []).map((gap) => gap.gapId)))
    errors.push("traversal aggregate gaps are not canonical");
  for (const edge of artifact.traversal?.edges ?? []) {
    const criterion = criteria.find(
      (item) => item.rootCriterionId === edge.rootCriterionId,
    );
    if (
      criterion &&
      persistedTraversalEdgeId(edge, criterion.rootTargetFieldId) !== edge.edgeId
    ) errors.push(`traversal aggregate edge id is invalid:${edge.edgeId}`);
    if (!traversalEdgeEnumsAreValid(edge))
      errors.push(`traversal aggregate edge enum is invalid:${edge.edgeId}`);
    if (
      !criterionIds.has(edge.rootCriterionId) ||
      !scopeIds.has(edge.fromSemanticScopeId) ||
      !scopeIds.has(edge.toSemanticScopeId) ||
      scopeById.get(edge.fromSemanticScopeId)?.taskId !== edge.fromTaskId ||
      scopeById.get(edge.toSemanticScopeId)?.taskId !== edge.toTaskId ||
      (edge.fromTaskId === edge.toTaskId &&
        edge.fromSemanticScopeId !== edge.toSemanticScopeId)
    ) errors.push(`traversal edge occurrence chain is invalid:${edge.edgeId}`);
  }
  for (const gap of artifact.traversal?.gaps ?? []) {
    if (canonicalTraversalGapId(gap) !== gap.gapId)
      errors.push(`traversal aggregate gap id is invalid:${gap.gapId}`);
    if (!traversalGapEnumsAreValid(gap))
      errors.push(`traversal aggregate gap enum is invalid:${gap.gapId}`);
    if (
      !criterionIds.has(gap.rootCriterionId) ||
      !scopeIds.has(gap.semanticScopeId) ||
      scopeById.get(gap.semanticScopeId)?.taskId !== gap.taskId ||
      gap.blocksConfirmedCausality !== true ||
      gap.blocksNegativeProof !== true
    ) errors.push(`traversal gap occurrence chain is invalid:${gap.gapId}`);
  }
  const projectedEdges = validatedProjectionById(
    traversalRoots.flatMap((root) =>
      (root.paths ?? []).flatMap((path: CausalTraversalPath) => path.edges)
    ),
    (edge) => edge.edgeId,
    "traversal root edge projection",
    errors,
  );
  if (canonicalJson(projectedEdges) !== canonicalJson(artifact.traversal?.edges ?? []))
    errors.push("traversal aggregate edges do not equal the root path projection");
  const projectedGaps = validatedProjectionById(
    traversalRoots.flatMap((root) => root.gaps ?? []),
    (gap) => gap.gapId,
    "traversal root gap projection",
    errors,
  );
  if (canonicalJson(projectedGaps) !== canonicalJson(artifact.traversal?.gaps ?? []))
    errors.push("traversal aggregate gaps do not equal the root gap projection");
  const branches = artifact.candidateUniverse?.branches ?? [];
  if (!Array.isArray(branches) || !orderedUnique(branches.map((item) => item.candidateBranchId))) errors.push("candidate branches are not canonical");
  const requestedWriteIds = new Set(artifact.request?.rootWriteObservationIds ?? []);
  const rootWriteBranches = branches.filter((branch) => branch.branchKind === "ROOT_WRITE");
  for (const branch of branches)
    if (canonicalCandidateBranchId(branch) !== branch.candidateBranchId)
      errors.push(`candidate branch id is invalid:${branch.candidateBranchId}`);
  for (const branch of rootWriteBranches)
    if (!nonEmpty(branch.writeObservationId) || !requestedWriteIds.has(branch.writeObservationId!))
      errors.push(`root write branch observation invalid:${branch.candidateBranchId}`);
  for (const writeObservationId of requestedWriteIds)
    if (!rootWriteBranches.some((branch) => branch.writeObservationId === writeObservationId))
      errors.push(`root write observation branch missing:${writeObservationId}`);
  const expectedPairs = buildAssessmentPairSkeleton(criteria, branches);
  const pairIds = new Set(expectedPairs.map((item) => item.pairId));
  const expectedPairById = new Map(expectedPairs.map((item) => [item.pairId, item]));
  const pairCounts = new Map<string, number>();
  for (const assessment of artifact.assessments ?? []) {
    const key = assessmentPairKey(assessment.rootCriterionId, assessment.candidateBranchId);
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    if (!pairIds.has(assessment.pairId)) errors.push(`assessment pair unexpected:${assessment.pairId}`);
    const expectedPair = expectedPairById.get(assessment.pairId);
    if (
      expectedPair &&
      (assessment.rootCriterionId !== expectedPair.rootCriterionId ||
        assessment.rootTargetFieldId !== expectedPair.rootTargetFieldId ||
        assessment.candidateBranchId !== expectedPair.candidateBranchId)
    ) errors.push(`assessment pair identity is invalid:${assessment.assessmentId}`);
    if (!CAUSAL_ASSESSMENT_STATUSES.includes(assessment.status))
      errors.push(`assessment status is invalid:${assessment.assessmentId}`);
    if (!CAUSAL_ASSESSMENT_REASON_CODES.includes(assessment.reasonCode))
      errors.push(`assessment reason is invalid:${assessment.assessmentId}`);
    if (
      !orderedUnique(assessment.positiveProofIds) ||
      !orderedUnique(assessment.negativeProofIds) ||
      !orderedUnique(assessment.gapRefs)
    ) errors.push(`assessment references are not canonical:${assessment.assessmentId}`);
    if (canonicalCausalAssessmentId(assessment) !== assessment.assessmentId)
      errors.push(`assessment id is invalid:${assessment.assessmentId}`);
    if (assessment.status === "UNKNOWN" && assessment.gapRefs.length === 0) errors.push(`UNKNOWN assessment has no gap:${assessment.assessmentId}`);
    if (
      (assessment.status === "CONFIRMED_RELATED" || assessment.status === "CONDITIONAL_RELATED") &&
      (assessment.positiveProofIds.length === 0 || assessment.negativeProofIds.length > 0)
    ) errors.push(`related assessment has no valid positive proof:${assessment.assessmentId}`);
    if (assessment.status === "PROVEN_UNRELATED" && (assessment.gapRefs.length > 0 || assessment.positiveProofIds.length > 0 || assessment.negativeProofIds.length !== 1)) errors.push(`unrelated assessment has invalid proof/gaps:${assessment.assessmentId}`);
  }
  for (const pair of expectedPairs) if ((pairCounts.get(assessmentPairKey(pair.rootCriterionId, pair.candidateBranchId)) ?? 0) !== 1) errors.push(`assessment pair cardinality:${pair.pairId}`);
  if (!orderedUnique((artifact.assessments ?? []).map((item) => item.pairId))) errors.push("assessments are not canonical");
  if (!orderedUnique((artifact.assessmentGaps ?? []).map((item) => item.gapId)))
    errors.push("assessment gaps are not canonical");
  for (const gap of artifact.assessmentGaps ?? [])
    if (canonicalCausalAssessmentGapId(gap) !== gap.gapId)
      errors.push(`assessment gap id is invalid:${gap.gapId}`);
  const gapIds = new Set([
    ...(artifact.scopeGaps ?? []).map((gap) => gap.gapId),
    ...(artifact.assessmentGaps ?? []).map((gap) => gap.gapId),
    ...(artifact.traversal?.gaps ?? []).map((gap) => gap.gapId),
    ...(artifact.dependencies?.gaps ?? []).map((gap) => gap.gapId),
    ...(artifact.candidateUniverse?.boundaryGapRefs ?? []),
    ...branches.flatMap((branch) => branch.gapRefs),
  ]);
  for (const assessment of artifact.assessments ?? []) {
    if (assessment.status === "UNKNOWN") for (const gapId of assessment.gapRefs) if (!gapIds.has(gapId)) errors.push(`UNKNOWN gap reference missing:${gapId}`);
  }
  const positiveById = new Map((artifact.positiveProofs ?? []).map((proof) => [proof.proofId, proof]));
  if (!orderedUnique((artifact.positiveProofs ?? []).map((item) => item.proofId))) errors.push("positive proofs are not canonical");
  for (const proof of artifact.positiveProofs ?? []) validateProofContinuity(proof, artifact, errors);
  for (const assessment of artifact.assessments ?? []) for (const proofId of assessment.positiveProofIds) {
    const proof = positiveById.get(proofId);
    if (!proof || proof.rootCriterionId !== assessment.rootCriterionId || proof.rootTargetFieldId !== assessment.rootTargetFieldId || proof.candidateBranchId !== assessment.candidateBranchId) errors.push(`positive proof reference invalid:${proofId}`);
    if (assessment.status === "CONFIRMED_RELATED" && proof?.pathCertainty !== "CONFIRMED") errors.push(`confirmed proof is not confirmed:${proofId}`);
  }
  const negativeById = new Map((artifact.negativeProofs ?? []).map((proof) => [proof.proofId, proof]));
  if (!orderedUnique((artifact.negativeProofs ?? []).map((item) => item.proofId))) errors.push("negative proofs are not canonical");
  for (const proof of artifact.negativeProofs ?? [])
    validateNegativeProof(proof, artifact, negativeById, errors);
  for (const assessment of artifact.assessments ?? []) for (const proofId of assessment.negativeProofIds) {
    const proof = negativeById.get(proofId);
    if (!proof || proof.rootCriterionId !== assessment.rootCriterionId || proof.rootTargetFieldId !== assessment.rootTargetFieldId || proof.candidateBranchId !== assessment.candidateBranchId || assessment.status !== "PROVEN_UNRELATED") errors.push(`negative proof reference invalid:${proofId}`);
  }
  const expectedMetrics = quality(artifact.assessments ?? []);
  if (artifact.qualityMetrics?.confirmedEvidenceClosureRate !== expectedMetrics.confirmedEvidenceClosureRate) errors.push("confirmed evidence closure metric is invalid or vacuous");
  if (canonicalJson(artifact.qualityMetrics?.closedDecisionCoverage) !== canonicalJson(expectedMetrics.closedDecisionCoverage)) errors.push("closed decision coverage metric is invalid");
  if (artifact.qualityMetrics?.precision !== "NOT_EVALUATED" || artifact.qualityMetrics?.recall !== "NOT_EVALUATED") errors.push("precision and recall must be NOT_EVALUATED");
  if (artifact.rerunSets && artifact.candidateUniverse && artifact.request) {
    let expectedReruns: RerunSetsResult | null = null;
    try {
      expectedReruns = generateRerunSets({
        candidateUniverse: artifact.candidateUniverse,
        rootCriteria: artifact.rootCriteria,
        assessments: artifact.assessments,
      });
    } catch {
      errors.push("rerun sets could not be recomputed from assessments");
    }
    if (
      expectedReruns &&
      canonicalJson({ minimumConfirmed: rerunSet(artifact.rerunSets.minimumConfirmed), conservativeSafety: rerunSet(artifact.rerunSets.conservativeSafety) }) !== canonicalJson({ minimumConfirmed: rerunSet(expectedReruns.minimumConfirmed), conservativeSafety: rerunSet(expectedReruns.conservativeSafety) })
    ) errors.push("rerun sets are inconsistent with assessments");
  } else errors.push("rerunSets are required");
  if (artifact.boundaries?.staticSqlOnly !== true || artifact.boundaries.runtimeExecution !== "NOT_EVALUATED" || artifact.boundaries.dataCorrectness !== "NOT_EVALUATED" || artifact.boundaries.businessAcceptance !== "NOT_EVALUATED") errors.push("static/runtime/data/business boundaries are invalid");
  if (!nonEmpty(artifact.contentHash)) errors.push("contentHash is required");
  else if (hashProjection(artifact) !== artifact.contentHash) errors.push("contentHash does not match stable canonical content");
  return [...new Set(errors)].sort(compare);
}

export const canonicalizeTargetFieldCausalSliceArtifact = canonicalizeCausalSliceArtifact;
export const validateTargetFieldCausalSliceArtifact = validateCausalSliceArtifact;
