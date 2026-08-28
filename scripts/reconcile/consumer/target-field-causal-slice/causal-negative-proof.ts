import {
  canonicalJson,
  normalizeName,
  sha256,
  type JsonValue,
} from "../../../machine-facts/machine-facts-contract.ts";
import {
  buildAssessmentPairSkeleton,
  type CandidateAssessmentPair,
  type CandidateBranch,
  type CandidateUniverse,
} from "./candidate-universe.ts";
import type {
  CausalAssessment,
  CausalAssessmentStatus,
  NegativeAssessmentReason,
} from "./causal-assessment.ts";
import type {
  CausalTraversalGap,
  CausalTraversalPath,
  CausalTraversalPathEdge,
  CausalTraversalResult,
  CausalTraversalRootResult,
} from "./causal-traversal.ts";

export const NEGATIVE_PROOF_MODES = ["SAFE_RULES_ONLY"] as const;
export type NegativeProofMode = (typeof NEGATIVE_PROOF_MODES)[number];

export const NEGATIVE_PROOF_OBLIGATIONS = ["VALUE", "CONTROL", "RELATION"] as const;
export type NegativeProofObligationKind =
  (typeof NEGATIVE_PROOF_OBLIGATIONS)[number];

export type NegativeProofReason =
  | "EXPLICIT_SAFE_RULES_ONLY"
  | "INHERITED_FROM_PROVEN_UNRELATED_CUT";

export interface NegativeProofObligation {
  readonly kind: NegativeProofObligationKind;
  readonly evidenceRefs: readonly string[];
}

export interface NegativeProofRequest {
  readonly mode: NegativeProofMode;
  readonly rootTargetFieldId: string;
  readonly candidateBranchId: string;
  readonly checkedObligations: readonly NegativeProofObligation[];
}

/**
 * A cut is intentionally an explicit list. Descendants are not discovered by
 * this module and an omitted branch is never considered covered by the cut.
 */
export interface KnownUnrelatedCut {
  readonly rootTargetFieldId: string;
  readonly sourceCandidateBranchId: string;
  readonly sourceNegativeProofId: string;
  readonly descendantCandidateBranchIds: readonly string[];
  /** Canonical evidence proving the listed branches are inside this already-enumerated cut subtree. */
  readonly structuralEvidenceRefs: readonly string[];
}

export interface NegativeCausalProof {
  readonly proofId: string;
  readonly rootTargetFieldId: string;
  readonly candidateBranchId: string;
  readonly reasonCode: NegativeProofReason;
  readonly checkedObligations: readonly NegativeProofObligation[];
  readonly evidenceRefs: readonly string[];
  readonly sourceNegativeProofId: string | null;
}

/** CausalAssessment cannot express negative reason codes until the final artifact contract. */
export type NegativeCausalAssessment = Omit<CausalAssessment, "reasonCode"> & {
  readonly reasonCode:
    | CausalAssessment["reasonCode"]
    | NegativeAssessmentReason;
};

export interface NegativeCausalAssessmentInput {
  readonly candidateUniverse: CandidateUniverse;
  readonly traversal: CausalTraversalResult;
  readonly assessments: readonly CausalAssessment[];
  readonly negativeProofRequests?: readonly NegativeProofRequest[];
  readonly knownCuts?: readonly KnownUnrelatedCut[];
  /** Allows a later invocation to use an already emitted, validated cut proof. */
  readonly existingNegativeProofs?: readonly NegativeCausalProof[];
}

export interface NegativeCausalAssessmentResult {
  readonly assessments: readonly NegativeCausalAssessment[];
  readonly negativeProofs: readonly NegativeCausalProof[];
}

export interface NegativeProofValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const OBLIGATION_ORDER: Readonly<Record<NegativeProofObligationKind, number>> = {
  VALUE: 0,
  CONTROL: 1,
  RELATION: 2,
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort(compareText);
}

function canonicalObligations(
  obligations: readonly NegativeProofObligation[],
): readonly NegativeProofObligation[] {
  return obligations
    .map((obligation) => ({
      kind: obligation.kind,
      evidenceRefs: sortedUnique(obligation.evidenceRefs),
    }))
    .sort(
      (left, right) =>
        OBLIGATION_ORDER[left.kind] - OBLIGATION_ORDER[right.kind] ||
        compareText(canonicalJson(left), canonicalJson(right)),
    );
}

function assessmentId(
  pairId: string,
  status: CausalAssessmentStatus,
  reasonCode: string,
  positiveProofIds: readonly string[],
  negativeProofIds: readonly string[],
  gapRefs: readonly string[],
): string {
  return `causal-assessment:${sha256(
    canonicalJson({
      pairId,
      status,
      reasonCode,
      positiveProofIds,
      negativeProofIds,
      gapRefs,
    } as unknown as JsonValue),
  )}`;
}

function proofId(proof: Omit<NegativeCausalProof, "proofId">): string {
  return `negative-proof:${sha256(canonicalJson(proof as unknown as JsonValue))}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasCanonicalRefs(refs: readonly string[]): boolean {
  return (
    refs.length > 0 &&
    refs.every(isNonEmptyString) &&
    sortedUnique(refs).length === refs.length &&
    refs.every((value, index) => index === 0 || refs[index - 1]! < value)
  );
}

function obligationErrors(
  obligations: readonly NegativeProofObligation[],
  prefix: string,
): string[] {
  const errors: string[] = [];
  const counts = new Map<NegativeProofObligationKind, number>();
  for (const obligation of obligations) {
    counts.set(obligation.kind, (counts.get(obligation.kind) ?? 0) + 1);
    if (!hasCanonicalRefs(obligation.evidenceRefs))
      errors.push(`NEGATIVE_OBLIGATION_EVIDENCE_INVALID:${prefix}:${obligation.kind}`);
  }
  for (const kind of NEGATIVE_PROOF_OBLIGATIONS) {
    if ((counts.get(kind) ?? 0) !== 1)
      errors.push(`NEGATIVE_OBLIGATION_REQUIRED:${prefix}:${kind}`);
  }
  if (obligations.length !== NEGATIVE_PROOF_OBLIGATIONS.length)
    errors.push(`NEGATIVE_OBLIGATION_SET_INVALID:${prefix}`);
  return errors;
}

function normalizeObligations(
  obligations: readonly NegativeProofObligation[],
): readonly NegativeProofObligation[] {
  return canonicalObligations(obligations).map((obligation) => ({
    kind: obligation.kind,
    evidenceRefs: [...obligation.evidenceRefs],
  }));
}

function makeProof(
  rootTargetFieldId: string,
  candidateBranchId: string,
  reasonCode: NegativeProofReason,
  checkedObligations: readonly NegativeProofObligation[],
  sourceNegativeProofId: string | null,
  additionalEvidenceRefs: readonly string[] = [],
): NegativeCausalProof {
  const normalizedObligations = normalizeObligations(checkedObligations);
  const input: Omit<NegativeCausalProof, "proofId"> = {
    rootTargetFieldId,
    candidateBranchId,
    reasonCode,
    checkedObligations: normalizedObligations,
    evidenceRefs: sortedUnique([
      ...normalizedObligations.flatMap((obligation) => obligation.evidenceRefs),
      ...additionalEvidenceRefs,
    ]),
    sourceNegativeProofId,
  };
  return { proofId: proofId(input), ...input };
}

function exactPositivePath(
  path: CausalTraversalPath,
  rootTargetFieldId: string,
  branch: CandidateBranch,
): boolean {
  if (
    path.rootTargetFieldId !== rootTargetFieldId ||
    branch.branchKind !== "PHYSICAL_PRODUCER" ||
    branch.consumerTaskId === null ||
    branch.producerTaskId === null ||
    branch.readOccurrence === null ||
    path.edges.length === 0
  )
    return false;
  return path.edges.some((edge) =>
    edge.fromTaskId === branch.producerTaskId &&
    edge.toTaskId === branch.consumerTaskId &&
    edge.readOccurrenceId === branch.readOccurrence!.occurrenceId &&
    (
      (edge.localEdgeKind === "VALUE_FLOW" && tableMatchesPhysicalField(branch, edge)) ||
      (edge.localEdgeKind === "RELATION_CONTEXT" &&
        edge.fromSubject.subjectKind === "RELATION_OCCURRENCE")
    ),
  ) || path.edges.some((edge) => {
    const relationIds = [edge.fromSubject, edge.toSubject]
      .filter((subject) => subject.subjectKind === "RELATION_OCCURRENCE")
      .map((subject) => subject.subjectKind === "RELATION_OCCURRENCE"
        ? subject.relationOccurrenceId
        : "");
    return (
      edge.readOccurrenceId === branch.readOccurrence!.occurrenceId ||
      relationIds.includes(branch.readOccurrence!.readRelationId)
    );
  });
}

function enumeratedCutPathEvidence(
  universe: CandidateUniverse,
  source: CandidateBranch,
  descendant: CandidateBranch,
): ReadonlySet<string> | null {
  const startTaskId = source.producerTaskId;
  if (
    !startTaskId ||
    descendant.consumerTaskId !== startTaskId ||
    source.candidateBranchId === descendant.candidateBranchId
  )
    return null;
  if (!universe.branches.some((branch) =>
    branch.candidateBranchId === descendant.candidateBranchId,
  )) return null;
  return new Set([
    ...source.evidenceRefs.map((ref) => ref.evidenceRefId),
    ...descendant.evidenceRefs.map((ref) => ref.evidenceRefId),
  ]);
}

function cutMembershipIsProven(
  universe: CandidateUniverse,
  cut: KnownUnrelatedCut,
  source: CandidateBranch,
  descendant: CandidateBranch,
): boolean {
  if (!hasCanonicalRefs(cut.structuralEvidenceRefs)) return false;
  const pathEvidence = enumeratedCutPathEvidence(universe, source, descendant);
  return (
    pathEvidence !== null &&
    cut.structuralEvidenceRefs.every((ref) => pathEvidence.has(ref))
  );
}

function tableMatchesPhysicalField(
  branch: CandidateBranch,
  edge: CausalTraversalPathEdge,
): boolean {
  const table = branch.table;
  if (
    !table ||
    table.platform === null ||
    table.dataSource === null ||
    table.qualifiedName === null ||
    table.stableTableId === null ||
    edge.fromSubject.subjectKind !== "PHYSICAL_FIELD"
  )
    return false;
  const parts = edge.fromSubject.physicalFieldId.split("|");
  return (
    parts.length >= 5 &&
    normalizeName(parts[0]!) === normalizeName(table.platform) &&
    normalizeName(parts[1]!) === normalizeName(table.dataSource) &&
    normalizeName(parts[2]!) === normalizeName(table.stableTableId) &&
    normalizeName(parts[3]!) === normalizeName(table.qualifiedName)
  );
}

function traversalRoot(
  traversal: CausalTraversalResult,
  rootTargetFieldId: string,
): CausalTraversalRootResult | null {
  const matches = traversal.roots.filter(
    (root) => root.root.rootTargetFieldId === rootTargetFieldId,
  );
  return matches.length === 1 ? matches[0]! : null;
}

function relevantGaps(
  traversal: CausalTraversalResult,
  root: CausalTraversalRootResult,
): readonly CausalTraversalGap[] {
  const gaps = [
    ...root.gaps,
    ...traversal.gaps.filter(
      (gap) => gap.rootTargetFieldId === root.root.rootTargetFieldId,
    ),
  ];
  const byId = new Map(gaps.map((gap) => [gap.gapId, gap]));
  return [...byId.values()].sort((left, right) => compareText(left.gapId, right.gapId));
}

function requestErrors(
  input: NegativeCausalAssessmentInput,
  request: NegativeProofRequest,
  pair: CausalAssessment | undefined,
  branch: CandidateBranch | undefined,
): readonly string[] {
  const errors: string[] = [];
  const pairKey = `${request.rootTargetFieldId}:${request.candidateBranchId}`;
  if (request.mode !== "SAFE_RULES_ONLY")
    errors.push(`NEGATIVE_PROOF_MODE_INVALID:${pairKey}`);
  if (!pair || pair.rootTargetFieldId !== request.rootTargetFieldId)
    errors.push(`ASSESSMENT_PAIR_NOT_FOUND:${pairKey}`);
  else if (pair.status !== "UNKNOWN")
    errors.push(`ASSESSMENT_NOT_UNKNOWN:${pairKey}`);
  if (!branch) errors.push(`CANDIDATE_BRANCH_NOT_ENUMERATED:${request.candidateBranchId}`);
  if (input.candidateUniverse.status !== "COMPLETE_OBSERVED_EVIDENCE")
    errors.push("CANDIDATE_UNIVERSE_NOT_COMPLETE");
  if (input.candidateUniverse.coverage.sourceCoverageStatus !== "COMPLETE_OBSERVED_EVIDENCE")
    errors.push("CANDIDATE_UNIVERSE_SOURCE_COVERAGE_NOT_COMPLETE");
  if (input.candidateUniverse.boundaryGapRefs.length > 0)
    errors.push("CANDIDATE_UNIVERSE_BOUNDARY_UNRESOLVED");
  if (input.candidateUniverse.coverage.sourceLimitsTruncated)
    errors.push("CANDIDATE_UNIVERSE_LIMIT_TRUNCATED");
  if (branch?.gapRefs.length) errors.push(`CANDIDATE_BRANCH_GAPS:${request.candidateBranchId}`);
  if (branch?.branchKind === "ROOT_WRITE")
    errors.push(`ROOT_WRITE_NEGATIVE_PROOF_FORBIDDEN:${request.candidateBranchId}`);
  errors.push(...obligationErrors(request.checkedObligations, pairKey));
  const knownEvidenceRefs = new Set([
    ...input.candidateUniverse.branches.flatMap((candidate) =>
      candidate.evidenceRefs.map((ref) => ref.evidenceRefId),
    ),
    ...input.traversal.sharedEvidenceRefs,
    ...input.traversal.edges.flatMap((edge) => edge.evidenceRefs),
  ]);
  for (const obligation of request.checkedObligations)
    for (const evidenceRef of obligation.evidenceRefs)
      if (!knownEvidenceRefs.has(evidenceRef))
        errors.push(`NEGATIVE_OBLIGATION_EVIDENCE_UNKNOWN:${pairKey}:${obligation.kind}:${evidenceRef}`);

  const root = traversalRoot(input.traversal, request.rootTargetFieldId);
  if (!root) {
    errors.push(`ROOT_TRAVERSAL_RESULT_MISSING:${request.rootTargetFieldId}`);
    return errors;
  }
  if (!root.decision.valueClosed) errors.push(`VALUE_TRAVERSAL_NOT_CLOSED:${pairKey}`);
  if (!root.decision.controlClosed) errors.push(`CONTROL_TRAVERSAL_NOT_CLOSED:${pairKey}`);
  for (const gap of relevantGaps(input.traversal, root))
    errors.push(`TRAVERSAL_GAP_BLOCKS_NEGATIVE_PROOF:${gap.gapId}`);
  if (branch && root.paths.some((path) => exactPositivePath(path, request.rootTargetFieldId, branch)))
    errors.push(`POSITIVE_PATH_EXISTS:${pairKey}`);
  return errors;
}

function replaceWithNegativeAssessment(
  assessment: CausalAssessment,
  proof: NegativeCausalProof,
): NegativeCausalAssessment {
  const negativeProofIds = [proof.proofId];
  return {
    ...assessment,
    assessmentId: assessmentId(
      assessment.pairId,
      "PROVEN_UNRELATED",
      proof.reasonCode,
      assessment.positiveProofIds,
      negativeProofIds,
      [],
    ),
    status: "PROVEN_UNRELATED",
    reasonCode: proof.reasonCode,
    negativeProofIds,
    gapRefs: [],
  };
}

function pairMap(
  assessments: readonly CausalAssessment[],
): ReadonlyMap<string, CausalAssessment> {
  return new Map(
    assessments.map((assessment) => [
      `${assessment.rootTargetFieldId}\u0000${assessment.candidateBranchId}`,
      assessment,
    ]),
  );
}

export function assessNegativeCausalRelationships(
  input: NegativeCausalAssessmentInput,
): NegativeCausalAssessmentResult {
  const byPair = pairMap(input.assessments);
  const branches = new Map(
    input.candidateUniverse.branches.map((branch) => [branch.candidateBranchId, branch]),
  );
  const proofs = new Map<string, NegativeCausalProof>(
    (input.existingNegativeProofs ?? []).map((proof) => [proof.proofId, proof]),
  );
  const replacements = new Map<string, NegativeCausalAssessment>();

  for (const request of [...(input.negativeProofRequests ?? [])].sort((left, right) =>
    compareText(
      `${left.rootTargetFieldId}\u0000${left.candidateBranchId}`,
      `${right.rootTargetFieldId}\u0000${right.candidateBranchId}`,
    )
  )) {
    const key = `${request.rootTargetFieldId}\u0000${request.candidateBranchId}`;
    const pair = byPair.get(key);
    const branch = branches.get(request.candidateBranchId);
    if (requestErrors(input, request, pair, branch).length > 0 || !pair) continue;
    const proof = makeProof(
      request.rootTargetFieldId,
      request.candidateBranchId,
      "EXPLICIT_SAFE_RULES_ONLY",
      request.checkedObligations,
      null,
    );
    proofs.set(proof.proofId, proof);
    replacements.set(key, replaceWithNegativeAssessment(pair, proof));
  }

  for (const cut of [...(input.knownCuts ?? [])].sort((left, right) =>
    compareText(
      `${left.rootTargetFieldId}\u0000${left.sourceCandidateBranchId}`,
      `${right.rootTargetFieldId}\u0000${right.sourceCandidateBranchId}`,
    )
  )) {
    if (!hasCanonicalRefs(cut.structuralEvidenceRefs)) continue;
    const sourceKey = `${cut.rootTargetFieldId}\u0000${cut.sourceCandidateBranchId}`;
    const sourceAssessment = replacements.get(sourceKey) ?? byPair.get(sourceKey);
    const sourceProof = proofs.get(cut.sourceNegativeProofId);
    const sourceBranch = branches.get(cut.sourceCandidateBranchId);
    if (
      sourceAssessment?.status !== "PROVEN_UNRELATED" ||
      sourceAssessment.reasonCode !== "EXPLICIT_SAFE_RULES_ONLY" ||
      !sourceProof ||
      !sourceBranch ||
      sourceProof.reasonCode !== "EXPLICIT_SAFE_RULES_ONLY" ||
      sourceProof.rootTargetFieldId !== cut.rootTargetFieldId ||
      sourceProof.candidateBranchId !== cut.sourceCandidateBranchId
    )
      continue;
    for (const descendantCandidateBranchId of sortedUnique(cut.descendantCandidateBranchIds)) {
      const key = `${cut.rootTargetFieldId}\u0000${descendantCandidateBranchId}`;
      const pair = byPair.get(key);
      const branch = branches.get(descendantCandidateBranchId);
      if (!pair || pair.status !== "UNKNOWN" || !branch) continue;
      if (!cutMembershipIsProven(input.candidateUniverse, cut, sourceBranch, branch))
        continue;
      const descendantErrors = requestErrors(
        input,
        {
          mode: "SAFE_RULES_ONLY",
          rootTargetFieldId: cut.rootTargetFieldId,
          candidateBranchId: descendantCandidateBranchId,
          checkedObligations: sourceProof.checkedObligations,
        },
        pair,
        branch,
      );
      if (descendantErrors.length > 0) continue;
      const proof = makeProof(
        cut.rootTargetFieldId,
        descendantCandidateBranchId,
        "INHERITED_FROM_PROVEN_UNRELATED_CUT",
        sourceProof.checkedObligations,
        sourceProof.proofId,
        cut.structuralEvidenceRefs,
      );
      proofs.set(proof.proofId, proof);
      replacements.set(key, replaceWithNegativeAssessment(pair, proof));
    }
  }

  return {
    assessments: input.assessments
      .map((assessment) =>
        replacements.get(
          `${assessment.rootTargetFieldId}\u0000${assessment.candidateBranchId}`,
        ) ?? assessment,
      )
      .sort((left, right) => compareText(left.pairId, right.pairId)),
    negativeProofs: [...proofs.values()].sort((left, right) =>
      compareText(left.proofId, right.proofId)
    ),
  };
}

function validateProof(
  proof: NegativeCausalProof,
  input: NegativeCausalAssessmentInput,
  proofById: ReadonlyMap<string, NegativeCausalProof>,
  directRequests: ReadonlyMap<string, NegativeProofRequest>,
): string[] {
  const errors: string[] = [];
  const prefix = `${proof.rootTargetFieldId}:${proof.candidateBranchId}`;
  if (!branchesFor(input.candidateUniverse).has(proof.candidateBranchId))
    errors.push(`NEGATIVE_PROOF_BRANCH_NOT_ENUMERATED:${proof.proofId}`);
  errors.push(...obligationErrors(proof.checkedObligations, proof.proofId));
  if (!hasCanonicalRefs(proof.evidenceRefs))
    errors.push(`NEGATIVE_PROOF_EVIDENCE_INVALID:${proof.proofId}`);
  const expectedId = proofId({
    rootTargetFieldId: proof.rootTargetFieldId,
    candidateBranchId: proof.candidateBranchId,
    reasonCode: proof.reasonCode,
    checkedObligations: proof.checkedObligations,
    evidenceRefs: proof.evidenceRefs,
    sourceNegativeProofId: proof.sourceNegativeProofId,
  });
  if (proof.proofId !== expectedId) errors.push(`NEGATIVE_PROOF_ID_NON_CANONICAL:${proof.proofId}`);
  if (proof.reasonCode === "INHERITED_FROM_PROVEN_UNRELATED_CUT") {
    const source = proof.sourceNegativeProofId === null
      ? undefined
      : proofById.get(proof.sourceNegativeProofId);
    if (!source || source.reasonCode !== "EXPLICIT_SAFE_RULES_ONLY")
      errors.push(`NEGATIVE_PROOF_SOURCE_INVALID:${proof.proofId}`);
    const sourceRequestKey = `${proof.rootTargetFieldId}\u0000${source?.candidateBranchId ?? ""}`;
    const sourceRequest = directRequests.get(sourceRequestKey);
    if (!sourceRequest || !source)
      errors.push(`NEGATIVE_PROOF_SOURCE_REQUEST_MISSING:${proof.proofId}`);
    else
      errors.push(...requestErrors(
        input,
        sourceRequest,
        pairMap(input.assessments).get(sourceRequestKey),
        branchesFor(input.candidateUniverse).get(source.candidateBranchId),
      ));
    const listedByCut = (input.knownCuts ?? []).some(
      (cut) => {
        const sourceBranch = branchesFor(input.candidateUniverse).get(
          cut.sourceCandidateBranchId,
        );
        const descendantBranch = branchesFor(input.candidateUniverse).get(
          proof.candidateBranchId,
        );
        return (
          cut.rootTargetFieldId === proof.rootTargetFieldId &&
          cut.sourceNegativeProofId === proof.sourceNegativeProofId &&
          cut.descendantCandidateBranchIds.includes(proof.candidateBranchId) &&
          sourceBranch !== undefined &&
          descendantBranch !== undefined &&
          cutMembershipIsProven(
            input.candidateUniverse,
            cut,
            sourceBranch,
            descendantBranch,
          ) &&
          cut.structuralEvidenceRefs.every((ref) => proof.evidenceRefs.includes(ref))
        );
      },
    );
    if (!listedByCut)
      errors.push(`NEGATIVE_PROOF_DESCENDANT_NOT_EXPLICIT:${proof.proofId}`);
  } else if (proof.sourceNegativeProofId !== null) {
    errors.push(`NEGATIVE_PROOF_SOURCE_UNEXPECTED:${proof.proofId}`);
  } else {
    const requestKey = `${proof.rootTargetFieldId}\u0000${proof.candidateBranchId}`;
    const request = directRequests.get(requestKey);
    if (!request) {
      errors.push(`NEGATIVE_PROOF_REQUEST_MISSING:${proof.proofId}`);
    } else {
      const pair = pairMap(input.assessments).get(requestKey);
      const branch = branchesFor(input.candidateUniverse).get(proof.candidateBranchId);
      errors.push(...requestErrors(input, request, pair, branch));
    }
  }
  if (prefix.length === 0) errors.push(`NEGATIVE_PROOF_PAIR_INVALID:${proof.proofId}`);
  return errors;
}

function branchesFor(universe: CandidateUniverse): ReadonlyMap<string, CandidateBranch> {
  return new Map(universe.branches.map((branch) => [branch.candidateBranchId, branch]));
}

export function validateNegativeCausalAssessments(
  input: NegativeCausalAssessmentInput,
  result: NegativeCausalAssessmentResult,
): NegativeProofValidation {
  const errors: string[] = [];
  const directRequests = new Map<string, NegativeProofRequest>();
  for (const request of input.negativeProofRequests ?? []) {
    const key = `${request.rootTargetFieldId}\u0000${request.candidateBranchId}`;
    if (directRequests.has(key)) errors.push(`NEGATIVE_PROOF_REQUEST_DUPLICATE:${key}`);
    directRequests.set(key, request);
  }
  const expectedPairs = buildAssessmentPairSkeleton(
    input.assessments.map((assessment) => assessment.rootTargetFieldId),
    input.candidateUniverse.branches,
  );
  const expectedPairIds = new Set(expectedPairs.map((pair) => pair.pairId));
  const expectedPairsById = new Map(expectedPairs.map((pair) => [pair.pairId, pair]));
  const assessmentByPair = new Map<string, NegativeCausalAssessment[]>();
  const assessmentIds = new Set<string>();
  for (const assessment of result.assessments) {
    if (assessmentIds.has(assessment.assessmentId))
      errors.push(`ASSESSMENT_ID_DUPLICATE:${assessment.assessmentId}`);
    assessmentIds.add(assessment.assessmentId);
    if (!expectedPairIds.has(assessment.pairId))
      errors.push(`UNEXPECTED_ASSESSMENT_PAIR:${assessment.pairId}`);
    const expectedPair = expectedPairsById.get(assessment.pairId);
    if (
      expectedPair &&
      (assessment.rootTargetFieldId !== expectedPair.rootTargetFieldId ||
        assessment.candidateBranchId !== expectedPair.candidateBranchId)
    )
      errors.push(`ASSESSMENT_PAIR_IDENTITY_MISMATCH:${assessment.assessmentId}`);
    const list = assessmentByPair.get(assessment.pairId) ?? [];
    list.push(assessment);
    assessmentByPair.set(assessment.pairId, list);
    const expectedAssessmentId = assessmentId(
      assessment.pairId,
      assessment.status,
      assessment.reasonCode,
      assessment.positiveProofIds,
      assessment.negativeProofIds,
      assessment.gapRefs,
    );
    if (assessment.assessmentId !== expectedAssessmentId)
      errors.push(`ASSESSMENT_ID_NON_CANONICAL:${assessment.assessmentId}`);
    if (
      assessment.status === "PROVEN_UNRELATED" &&
      (assessment.negativeProofIds.length !== 1 ||
        assessment.positiveProofIds.length > 0 ||
        assessment.gapRefs.length > 0)
    )
      errors.push(`PROVEN_UNRELATED_PROOF_REFS_INVALID:${assessment.assessmentId}`);
  }
  for (const pairId of expectedPairIds) {
    const matches = assessmentByPair.get(pairId) ?? [];
    if (matches.length !== 1) errors.push(`ASSESSMENT_PAIR_CARDINALITY:${pairId}:${matches.length}`);
  }
  for (let index = 1; index < result.assessments.length; index++)
    if (result.assessments[index - 1]!.pairId > result.assessments[index]!.pairId)
      errors.push("ASSESSMENTS_NOT_SORTED");

  const proofById = new Map<string, NegativeCausalProof>(
    result.negativeProofs.map((proof) => [proof.proofId, proof]),
  );
  const proofIds = new Set<string>();
  for (const proof of result.negativeProofs) {
    if (proofIds.has(proof.proofId))
      errors.push(`NEGATIVE_PROOF_ID_DUPLICATE:${proof.proofId}`);
    proofIds.add(proof.proofId);
    errors.push(...validateProof(proof, input, proofById, directRequests));
  }
  for (let index = 1; index < result.negativeProofs.length; index++)
    if (result.negativeProofs[index - 1]!.proofId > result.negativeProofs[index]!.proofId)
      errors.push("NEGATIVE_PROOFS_NOT_SORTED");

  const originalByPair = pairMap(input.assessments);
  for (const assessment of result.assessments) {
    const original = originalByPair.get(
      `${assessment.rootTargetFieldId}\u0000${assessment.candidateBranchId}`,
    );
    if (!original) continue;
    if (
      original.status !== "UNKNOWN" &&
      (assessment.status !== original.status ||
        assessment.assessmentId !== original.assessmentId ||
        assessment.negativeProofIds.join("\u0000") !== original.negativeProofIds.join("\u0000"))
    )
      errors.push(`NON_UNKNOWN_ASSESSMENT_CHANGED:${assessment.assessmentId}`);
    for (const negativeProofId of assessment.negativeProofIds) {
      const proof = proofById.get(negativeProofId);
      if (!proof) {
        errors.push(`NEGATIVE_PROOF_MISSING:${negativeProofId}`);
        continue;
      }
      if (
        proof.rootTargetFieldId !== assessment.rootTargetFieldId ||
        proof.candidateBranchId !== assessment.candidateBranchId
      )
        errors.push(`NEGATIVE_PROOF_PAIR_MISMATCH:${negativeProofId}`);
      if (assessment.status !== "PROVEN_UNRELATED")
        errors.push(`NEGATIVE_PROOF_ON_NON_UNRELATED:${negativeProofId}`);
    }
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort(compareText) };
}

export const applyNegativeCausalProofs = assessNegativeCausalRelationships;
export const validateNegativeProofResult = validateNegativeCausalAssessments;
