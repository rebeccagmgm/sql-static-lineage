import { canonicalJson, sha256 } from "../../../machine-facts/machine-facts-contract.ts";
import {
  type CandidateBranch,
  type CandidateUniverse,
  buildAssessmentPairSkeleton,
} from "./candidate-universe.ts";
import {
  type CausalAssessment,
  type CausalAssessmentGap,
  type PositiveCausalProof,
} from "./causal-assessment.ts";
import type {
  CausalTraversalPath,
  CausalTraversalPathEdge,
  CausalTraversalResult,
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
import type {
  SemanticDependencyApplication,
  SemanticDependencyDefinition,
  SemanticDependencyEdge,
  SemanticSubject,
} from "./semantic-dependency-contract.ts";
import type { SemanticDependencyGap } from "./semantic-dependency-normalizer.ts";

export const TARGET_FIELD_CAUSAL_SLICE_ARTIFACT_TYPE =
  "TARGET_FIELD_CAUSAL_SLICE" as const;
export const TARGET_FIELD_CAUSAL_SLICE_SCHEMA_VERSION = "1.0.0" as const;
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
  return {
    definitions: sortedUniqueBy(value.definitions, (item) => item.dependencyId).map((item) => ({
      ...item,
      subject: subject(item.subject),
      proofRefs: refs(item.proofRefs),
    })),
    applications: sortedUniqueBy(value.applications, (item) => item.applicationId).map((item) => ({
      ...item,
      proofRefs: refs(item.proofRefs),
    })),
    edges: sortedUniqueBy(value.edges, (item) => item.edgeId).map((item) => ({
      ...item,
      fromSubject: subject(item.fromSubject),
      toSubject: subject(item.toSubject),
      proofRefs: refs(item.proofRefs),
    })),
    gaps: sortedUniqueBy(value.gaps, (item) => item.gapId).map((item) => ({
      ...item,
      proofRefs: refs(item.proofRefs),
    })),
  };
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
  const roots = sortedUniqueBy(value.roots, (item) => item.root.rootTargetFieldId).map((item) => ({
    ...item,
    root: { ...item.root },
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
    triggers: sortedUniqueBy(item.triggers, (trigger) => `${trigger.rootTargetFieldId}\u0000${trigger.candidateBranchId}\u0000${trigger.assessmentId}`).map((trigger) => ({
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

function positiveProofHash(proof: PositiveCausalProof): string {
  const { proofId: _proofId, ...input } = proof;
  return `positive-proof:${sha256(canonicalJson(input))}`;
}

function negativeProofHash(proof: NegativeCausalProof): string {
  const { proofId: _proofId, ...input } = proof;
  return `negative-proof:${sha256(canonicalJson(input))}`;
}

function assessmentPairKey(root: string, branch: string): string {
  return `${root}\u0000${branch}`;
}

function validateProofContinuity(
  proof: PositiveCausalProof,
  artifact: CausalSliceArtifact,
  errors: string[],
): void {
  if (proof.proofId !== positiveProofHash(proof)) errors.push(`POSITIVE_PROOF_HASH_INVALID:${proof.proofId}`);
  if (proof.evidenceRefs.length === 0 || !orderedUnique(proof.evidenceRefs)) errors.push(`POSITIVE_PROOF_EVIDENCE_INVALID:${proof.proofId}`);
  if (proof.reasonCode === "EXPLICIT_ROOT_WRITE_PROOF") {
    if (proof.pathIds.length !== 0 || proof.edgeIds.length !== 0) errors.push(`ROOT_WRITE_PROOF_PATH_INVALID:${proof.proofId}`);
    const branch = artifact.candidateUniverse.branches.find((candidate) =>
      candidate.candidateBranchId === proof.candidateBranchId,
    );
    const rootPhysicalTable = proof.rootTargetFieldId.split("|")[3]?.toLowerCase();
    if (
      branch?.branchKind !== "ROOT_WRITE" ||
      branch.producerTaskId !== artifact.request.rootTaskId ||
      !artifact.request.rootFields.includes(proof.rootTargetFieldId) ||
      !nonEmpty(branch.writeObservationId) ||
      !artifact.request.rootWriteObservationIds.includes(branch.writeObservationId) ||
      (branch.table?.qualifiedName !== null && branch.table?.qualifiedName !== undefined
        ? branch.table.qualifiedName.toLowerCase() !== artifact.request.rootTable.toLowerCase()
        : rootPhysicalTable !== artifact.request.rootTable.toLowerCase())
    ) errors.push(`ROOT_WRITE_PROOF_BRANCH_INVALID:${proof.proofId}`);
    return;
  }
  if (proof.pathIds.length !== 1) {
    errors.push(`POSITIVE_PROOF_PATH_CARDINALITY:${proof.proofId}`);
    return;
  }
  const root = artifact.traversal.roots.find((item) => item.root.rootTargetFieldId === proof.rootTargetFieldId);
  const path = root?.paths.find((item) => item.pathId === proof.pathIds[0]);
  if (!path) {
    errors.push(`POSITIVE_PROOF_PATH_MISSING:${proof.proofId}`);
    return;
  }
  if (path.edges.length === 0 || path.edges.some((edge) => edge.evidenceRefs.length === 0)) errors.push(`POSITIVE_PROOF_EVIDENCE_MISSING:${proof.proofId}`);
  if (canonicalJson(proof.edgeIds) !== canonicalJson(path.edges.map((edge) => edge.edgeId))) errors.push(`POSITIVE_PROOF_EDGE_SEQUENCE_INVALID:${proof.proofId}`);
  const expectedRefs = sortedUnique(path.edges.flatMap((edge) => edge.evidenceRefs));
  if (canonicalJson(proof.evidenceRefs) !== canonicalJson(expectedRefs)) errors.push(`POSITIVE_PROOF_EVIDENCE_SEQUENCE_INVALID:${proof.proofId}`);
  for (let index = 1; index < path.edges.length; index++) {
    const previous = path.edges[index - 1]!;
    const current = path.edges[index]!;
    if (previous.toTaskId !== current.fromTaskId || !sameSubject(previous.toSubject, current.fromSubject)) errors.push(`POSITIVE_PROOF_PATH_NONCONTINUOUS:${proof.proofId}`);
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
  canonicalEvidenceRefs: ReadonlySet<string>,
  errors: string[],
): void {
  if (proof.proofId !== negativeProofHash(proof)) errors.push(`NEGATIVE_PROOF_HASH_INVALID:${proof.proofId}`);
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
    if (
      !source ||
      source.reasonCode !== "EXPLICIT_SAFE_RULES_ONLY" ||
      source.rootTargetFieldId !== proof.rootTargetFieldId ||
      sourceBranch?.producerTaskId !== branch?.consumerTaskId ||
      canonicalJson(source.checkedObligations) !== canonicalJson(proof.checkedObligations) ||
      structuralRefs.some((ref) => !proof.evidenceRefs.includes(ref))
    ) errors.push(`NEGATIVE_PROOF_CUT_SOURCE_INVALID:${proof.proofId}`);
  }
  if (artifact.candidateUniverse.status !== "COMPLETE_OBSERVED_EVIDENCE" || artifact.candidateUniverse.boundaryGapRefs.length > 0 || artifact.candidateUniverse.coverage.sourceLimitsTruncated) errors.push(`NEGATIVE_PROOF_UNIVERSE_INCOMPLETE:${proof.proofId}`);
}

export function validateCausalSliceArtifact(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["artifact must be an object"];
  const artifact = value as unknown as CausalSliceArtifact;
  if (artifact.artifactType !== TARGET_FIELD_CAUSAL_SLICE_ARTIFACT_TYPE) errors.push("artifactType must be TARGET_FIELD_CAUSAL_SLICE");
  if (artifact.schemaVersion !== TARGET_FIELD_CAUSAL_SLICE_SCHEMA_VERSION) errors.push("schemaVersion must be 1.0.0");
  if (!nonEmpty(artifact.generatedAt)) errors.push("generatedAt is required");
  if (!isRecord(artifact.request)) errors.push("request is required");
  else {
    if (!nonEmpty(artifact.request.rootTaskId) || !nonEmpty(artifact.request.rootTable)) errors.push("request root identity is incomplete");
    if (!Array.isArray(artifact.request.rootFields) || artifact.request.rootFields.length === 0 || !orderedUnique(artifact.request.rootFields)) errors.push("rootFields must be sorted and non-empty");
    if (!Array.isArray(artifact.request.rootWriteObservationIds) || artifact.request.rootWriteObservationIds.length === 0 || !orderedUnique(artifact.request.rootWriteObservationIds)) errors.push("rootWriteObservationIds must be sorted and non-empty");
    if (artifact.request.negativeProofMode !== "SAFE_RULES_ONLY") errors.push("negativeProofMode is invalid");
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
    for (const item of applications ?? []) if (!dependencyIds.has(item.dependencyId)) errors.push(`dependency application references missing definition:${item.applicationId}`);
    for (const item of edges ?? []) if (!dependencyIds.has(item.dependencyId)) errors.push(`dependency edge references missing definition:${item.edgeId}`);
  }
  const branches = artifact.candidateUniverse?.branches ?? [];
  if (!Array.isArray(branches) || !orderedUnique(branches.map((item) => item.candidateBranchId))) errors.push("candidate branches are not canonical");
  const requestedWriteIds = new Set(artifact.request?.rootWriteObservationIds ?? []);
  const rootWriteBranches = branches.filter((branch) => branch.branchKind === "ROOT_WRITE");
  for (const branch of rootWriteBranches)
    if (!nonEmpty(branch.writeObservationId) || !requestedWriteIds.has(branch.writeObservationId!))
      errors.push(`root write branch observation invalid:${branch.candidateBranchId}`);
  for (const writeObservationId of requestedWriteIds)
    if (!rootWriteBranches.some((branch) => branch.writeObservationId === writeObservationId))
      errors.push(`root write observation branch missing:${writeObservationId}`);
  const expectedPairs = buildAssessmentPairSkeleton(artifact.request?.rootFields ?? [], branches);
  const pairIds = new Set(expectedPairs.map((item) => item.pairId));
  const pairCounts = new Map<string, number>();
  for (const assessment of artifact.assessments ?? []) {
    const key = assessmentPairKey(assessment.rootTargetFieldId, assessment.candidateBranchId);
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    if (!pairIds.has(assessment.pairId)) errors.push(`assessment pair unexpected:${assessment.pairId}`);
    if (assessment.status === "UNKNOWN" && assessment.gapRefs.length === 0) errors.push(`UNKNOWN assessment has no gap:${assessment.assessmentId}`);
    if (
      (assessment.status === "CONFIRMED_RELATED" || assessment.status === "CONDITIONAL_RELATED") &&
      (assessment.positiveProofIds.length === 0 || assessment.negativeProofIds.length > 0)
    ) errors.push(`related assessment has no valid positive proof:${assessment.assessmentId}`);
    if (assessment.status === "PROVEN_UNRELATED" && (assessment.gapRefs.length > 0 || assessment.positiveProofIds.length > 0 || assessment.negativeProofIds.length !== 1)) errors.push(`unrelated assessment has invalid proof/gaps:${assessment.assessmentId}`);
  }
  for (const pair of expectedPairs) if ((pairCounts.get(assessmentPairKey(pair.rootTargetFieldId, pair.candidateBranchId)) ?? 0) !== 1) errors.push(`assessment pair cardinality:${pair.pairId}`);
  if (!orderedUnique((artifact.assessments ?? []).map((item) => item.pairId))) errors.push("assessments are not canonical");
  const gapIds = new Set([
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
    if (!proof || proof.rootTargetFieldId !== assessment.rootTargetFieldId || proof.candidateBranchId !== assessment.candidateBranchId) errors.push(`positive proof reference invalid:${proofId}`);
    if (assessment.status === "CONFIRMED_RELATED" && proof?.pathCertainty !== "CONFIRMED") errors.push(`confirmed proof is not confirmed:${proofId}`);
  }
  const negativeById = new Map((artifact.negativeProofs ?? []).map((proof) => [proof.proofId, proof]));
  const canonicalEvidenceRefs = new Set([
    ...branches.flatMap((branch) => branch.evidenceRefs.map((ref: { readonly evidenceRefId: string }) => ref.evidenceRefId)),
    ...(artifact.traversal?.sharedEvidenceRefs ?? []),
    ...(artifact.traversal?.edges ?? []).flatMap((edge) => edge.evidenceRefs),
    ...(artifact.dependencies?.definitions ?? []).flatMap((item) => item.proofRefs.map((ref: { readonly refId: string }) => ref.refId)),
    ...(artifact.dependencies?.applications ?? []).flatMap((item) => item.proofRefs.map((ref: { readonly refId: string }) => ref.refId)),
    ...(artifact.dependencies?.edges ?? []).flatMap((item) => item.proofRefs.map((ref: { readonly refId: string }) => ref.refId)),
  ]);
  if (!orderedUnique((artifact.negativeProofs ?? []).map((item) => item.proofId))) errors.push("negative proofs are not canonical");
  for (const proof of artifact.negativeProofs ?? [])
    validateNegativeProof(proof, artifact, negativeById, canonicalEvidenceRefs, errors);
  for (const assessment of artifact.assessments ?? []) for (const proofId of assessment.negativeProofIds) {
    const proof = negativeById.get(proofId);
    if (!proof || proof.rootTargetFieldId !== assessment.rootTargetFieldId || proof.candidateBranchId !== assessment.candidateBranchId || assessment.status !== "PROVEN_UNRELATED") errors.push(`negative proof reference invalid:${proofId}`);
  }
  const expectedMetrics = quality(artifact.assessments ?? []);
  if (artifact.qualityMetrics?.confirmedEvidenceClosureRate !== expectedMetrics.confirmedEvidenceClosureRate) errors.push("confirmed evidence closure metric is invalid or vacuous");
  if (canonicalJson(artifact.qualityMetrics?.closedDecisionCoverage) !== canonicalJson(expectedMetrics.closedDecisionCoverage)) errors.push("closed decision coverage metric is invalid");
  if (artifact.qualityMetrics?.precision !== "NOT_EVALUATED" || artifact.qualityMetrics?.recall !== "NOT_EVALUATED") errors.push("precision and recall must be NOT_EVALUATED");
  if (artifact.rerunSets && artifact.candidateUniverse && artifact.request) {
    let expectedReruns: RerunSetsResult;
    try { expectedReruns = generateRerunSets({ candidateUniverse: artifact.candidateUniverse, rootTargetFieldIds: artifact.request.rootFields, assessments: artifact.assessments }); } catch { expectedReruns = artifact.rerunSets; }
    if (canonicalJson({ minimumConfirmed: rerunSet(artifact.rerunSets.minimumConfirmed), conservativeSafety: rerunSet(artifact.rerunSets.conservativeSafety) }) !== canonicalJson({ minimumConfirmed: rerunSet(expectedReruns.minimumConfirmed), conservativeSafety: rerunSet(expectedReruns.conservativeSafety) })) errors.push("rerun sets are inconsistent with assessments");
  } else errors.push("rerunSets are required");
  if (artifact.boundaries?.staticSqlOnly !== true || artifact.boundaries.runtimeExecution !== "NOT_EVALUATED" || artifact.boundaries.dataCorrectness !== "NOT_EVALUATED" || artifact.boundaries.businessAcceptance !== "NOT_EVALUATED") errors.push("static/runtime/data/business boundaries are invalid");
  if (!nonEmpty(artifact.contentHash)) errors.push("contentHash is required");
  else if (hashProjection(artifact) !== artifact.contentHash) errors.push("contentHash does not match stable canonical content");
  return [...new Set(errors)].sort(compare);
}

export const canonicalizeTargetFieldCausalSliceArtifact = canonicalizeCausalSliceArtifact;
export const validateTargetFieldCausalSliceArtifact = validateCausalSliceArtifact;
