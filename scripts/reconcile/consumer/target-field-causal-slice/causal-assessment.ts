import {
  canonicalJson,
  normalizeName,
  sha256,
} from "../../../machine-facts/machine-facts-contract.ts";
import {
  buildAssessmentPairSkeleton,
  type CandidateAssessmentPair,
  type CandidateBranch,
  type CandidatePhysicalTable,
  type CandidateUniverse,
} from "./candidate-universe.ts";
import type {
  CausalTraversalGap,
  CausalTraversalPath,
  CausalTraversalPathEdge,
  CausalTraversalResult,
  CausalTraversalRootResult,
} from "./causal-traversal.ts";
import type { PathCertainty, SemanticSubject } from "./semantic-dependency-contract.ts";
import type { RootCriterion } from "./write-scoped-plan-inputs.ts";

export const CAUSAL_ASSESSMENT_STATUSES = [
  "CONFIRMED_RELATED",
  "CONDITIONAL_RELATED",
  "PROVEN_UNRELATED",
  "UNKNOWN",
] as const;

export type CausalAssessmentStatus =
  (typeof CAUSAL_ASSESSMENT_STATUSES)[number];

export type PositiveAssessmentReason =
  | "CONTINUOUS_CONFIRMED_PATH"
  | "CONTINUOUS_PROVISIONAL_PATH"
  | "EXPLICIT_ROOT_WRITE_PROOF";

export type UnknownAssessmentReason =
  | "ASSESSMENT_PAIR_INPUT_INVALID"
  | "BRANCH_BOUNDARY_UNRESOLVED"
  | "BRANCH_KIND_REQUIRES_SEPARATE_PROOF"
  | "CONTINUOUS_PATH_EVIDENCE_INCOMPLETE"
  | "EXACT_OCCURRENCE_PATH_NOT_PROVEN"
  | "ROOT_TRAVERSAL_RESULT_MISSING"
  | "ROOT_WRITE_PROOF_MISSING"
  | "REQUIRED_PATH_UNKNOWN";

export type NegativeAssessmentReason =
  | "EXPLICIT_SAFE_RULES_ONLY"
  | "INHERITED_FROM_PROVEN_UNRELATED_CUT";

export const CAUSAL_ASSESSMENT_REASON_CODES = [
  "CONTINUOUS_CONFIRMED_PATH",
  "CONTINUOUS_PROVISIONAL_PATH",
  "EXPLICIT_ROOT_WRITE_PROOF",
  "ASSESSMENT_PAIR_INPUT_INVALID",
  "BRANCH_BOUNDARY_UNRESOLVED",
  "BRANCH_KIND_REQUIRES_SEPARATE_PROOF",
  "CONTINUOUS_PATH_EVIDENCE_INCOMPLETE",
  "EXACT_OCCURRENCE_PATH_NOT_PROVEN",
  "ROOT_TRAVERSAL_RESULT_MISSING",
  "ROOT_WRITE_PROOF_MISSING",
  "REQUIRED_PATH_UNKNOWN",
  "EXPLICIT_SAFE_RULES_ONLY",
  "INHERITED_FROM_PROVEN_UNRELATED_CUT",
] as const;

export interface RootWritePositiveProofInput {
  readonly rootCriterionId: string;
  readonly rootTargetFieldId: string;
  readonly candidateBranchId: string;
  readonly pathCertainty: Exclude<PathCertainty, "UNKNOWN">;
  readonly evidenceRefs: readonly string[];
}

export interface PositiveCausalProof {
  readonly proofId: string;
  readonly rootCriterionId: string;
  readonly rootTargetFieldId: string;
  readonly candidateBranchId: string;
  readonly pathCertainty: Exclude<PathCertainty, "UNKNOWN">;
  readonly reasonCode: PositiveAssessmentReason;
  readonly pathIds: readonly string[];
  readonly edgeIds: readonly string[];
  readonly evidenceRefs: readonly string[];
}

export interface CausalAssessmentGap {
  readonly gapId: string;
  readonly rootCriterionId: string;
  readonly rootTargetFieldId: string;
  readonly candidateBranchId: string;
  readonly reasonCode: UnknownAssessmentReason;
  readonly evidenceRefs: readonly string[];
}

export interface CausalAssessment {
  readonly assessmentId: string;
  readonly pairId: string;
  readonly rootCriterionId: string;
  readonly rootTargetFieldId: string;
  readonly candidateBranchId: string;
  readonly status: CausalAssessmentStatus;
  readonly reasonCode:
    | PositiveAssessmentReason
    | UnknownAssessmentReason
    | NegativeAssessmentReason;
  readonly positiveProofIds: readonly string[];
  readonly negativeProofIds: readonly string[];
  readonly gapRefs: readonly string[];
}

export function canonicalCausalAssessmentId(input: Pick<
  CausalAssessment,
  | "rootCriterionId"
  | "pairId"
  | "status"
  | "reasonCode"
  | "positiveProofIds"
  | "negativeProofIds"
  | "gapRefs"
>): string {
  return `causal-assessment:${sha256(canonicalJson({
    rootCriterionId: input.rootCriterionId,
    pairId: input.pairId,
    status: input.status,
    reasonCode: input.reasonCode,
    positiveProofIds: input.positiveProofIds,
    negativeProofIds: input.negativeProofIds,
    gapRefs: input.gapRefs,
  }))}`;
}

export function canonicalCausalAssessmentGapId(input: Omit<
  CausalAssessmentGap,
  "gapId"
>): string {
  return `assessment-gap:${sha256(canonicalJson({
    rootCriterionId: input.rootCriterionId,
    rootTargetFieldId: input.rootTargetFieldId,
    candidateBranchId: input.candidateBranchId,
    reasonCode: input.reasonCode,
    evidenceRefs: sortedUnique(input.evidenceRefs),
  }))}`;
}

export interface PositiveCausalAssessmentInput {
  readonly candidateUniverse: CandidateUniverse;
  readonly traversal: CausalTraversalResult;
  readonly rootCriteria: readonly RootCriterion[];
  readonly assessmentPairs?: readonly CandidateAssessmentPair[];
  readonly rootWriteProofs?: readonly RootWritePositiveProofInput[];
}

export interface PositiveCausalAssessmentResult {
  readonly assessments: readonly CausalAssessment[];
  readonly positiveProofs: readonly PositiveCausalProof[];
  readonly gaps: readonly CausalAssessmentGap[];
}

export interface CausalAssessmentValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

type ExactPath = {
  readonly path: CausalTraversalPath;
  readonly bridgeEdge: CausalTraversalPathEdge;
  readonly effectiveCertainty: PathCertainty;
};

type OccurrenceScopedTraversalRoot = CausalTraversalRootResult & {
  readonly rootCriterionId?: string;
  readonly root: CausalTraversalRootResult["root"] & {
    readonly rootCriterion?: RootCriterion;
  };
};

function traversalRootCriterionId(root: CausalTraversalRootResult): string | null {
  const scoped = root as OccurrenceScopedTraversalRoot;
  return scoped.rootCriterionId ?? scoped.root.rootCriterion?.rootCriterionId ?? null;
}

function traversalPathCriterionId(path: CausalTraversalPath): string | null {
  return (path as CausalTraversalPath & { readonly rootCriterionId?: string })
    .rootCriterionId ?? null;
}

function traversalGapCriterionId(gap: CausalTraversalGap): string | null {
  return (gap as CausalTraversalGap & { readonly rootCriterionId?: string })
    .rootCriterionId ?? null;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(Boolean))].sort(compareText);
}

function subjectKey(subject: SemanticSubject): string {
  return subject.subjectKind === "PHYSICAL_FIELD"
    ? `field:${subject.physicalFieldId}`
    : `relation:${subject.relationOccurrenceId}`;
}

function tableMatchesPhysicalField(
  table: CandidatePhysicalTable | null,
  subject: SemanticSubject,
): boolean {
  if (
    !table ||
    table.platform === null ||
    table.dataSource === null ||
    table.stableTableId === null ||
    table.qualifiedName === null ||
    subject.subjectKind !== "PHYSICAL_FIELD"
  )
    return false;
  const parts = subject.physicalFieldId.split("|");
  if (parts.length < 5) return false;
  const [platform, dataSource, stableTableId, qualifiedName] = parts;
  const expected = [
    table.platform,
    table.dataSource,
    table.stableTableId,
    table.qualifiedName,
  ];
  const actual = [platform, dataSource, stableTableId, qualifiedName];
  return expected.every(
    (value, index) => normalizeName(value ?? "") === normalizeName(actual[index] ?? ""),
  );
}

function tableMatchesRootCriterion(
  table: CandidatePhysicalTable | null,
  criterion: RootCriterion,
): boolean {
  if (
    table === null ||
    table.platform === null ||
    table.dataSource === null ||
    table.stableTableId === null ||
    table.qualifiedName === null
  ) return false;
  const parts = criterion.rootTargetFieldId.split("|");
  if (parts.length < 5) return false;
  const expected = parts.slice(0, 4);
  const actual = [
    table.platform,
    table.dataSource,
    table.stableTableId,
    table.qualifiedName,
  ];
  return expected.every(
    (value, index) => normalizeName(value) === normalizeName(actual[index] ?? ""),
  );
}

function rootWriteProofIsEvidenceBound(
  proof: RootWritePositiveProofInput,
  criterion: RootCriterion,
): boolean {
  const criterionEvidence = new Set(criterion.evidenceRefs);
  const proofEvidence = new Set(proof.evidenceRefs);
  return (
    proof.evidenceRefs.length > 0 &&
    proof.evidenceRefs.every((ref) => criterionEvidence.has(ref)) &&
    [criterion.rootWriteObservationId, criterion.outputBindingId].every((ref) =>
      proofEvidence.has(ref)
    )
  );
}

function certaintyRank(value: PathCertainty): number {
  return value === "UNKNOWN" ? 2 : value === "CONDITIONAL" ? 1 : 0;
}

function effectivePathCertainty(path: CausalTraversalPath): PathCertainty {
  return [path.pathCertainty, ...path.edges.map((edge) => edge.pathCertainty)].reduce(
    (worst, current) =>
      certaintyRank(current) > certaintyRank(worst) ? current : worst,
    "CONFIRMED" as PathCertainty,
  );
}

function exactBridgeForBranch(
  edge: CausalTraversalPathEdge,
  branch: CandidateBranch,
): boolean {
  if (
    branch.branchKind !== "PHYSICAL_PRODUCER" ||
    branch.consumerTaskId === null ||
    branch.producerTaskId === null ||
    branch.readOccurrence === null ||
    edge.fromTaskId !== branch.producerTaskId ||
    edge.toTaskId !== branch.consumerTaskId ||
    edge.readOccurrenceId !== branch.readOccurrence.occurrenceId
  ) return false;
  if (edge.localEdgeKind === "VALUE_FLOW")
    return tableMatchesPhysicalField(branch.table, edge.fromSubject);
  // Relation-level operators such as COUNT(*) and CROSS JOIN deliberately do
  // not have a producer column.  The exact read occurrence is their physical
  // identity at the table-multi-hop boundary.
  return edge.localEdgeKind === "RELATION_CONTEXT" &&
    edge.fromSubject.subjectKind === "RELATION_OCCURRENCE";
}

/**
 * Return the one occurrence-exact physical bridge for a candidate on a path.
 * Zero or multiple matches are deliberately unresolved; callers must not pick
 * an arbitrary edge from an ambiguous persisted path.
 */
export function exactOccurrenceBridgeForCandidatePath(
  path: CausalTraversalPath,
  branch: CandidateBranch,
): CausalTraversalPathEdge | null {
  const matches = path.edges.filter((edge) => exactBridgeForBranch(edge, branch));
  return matches.length === 1 ? matches[0]! : null;
}

function exactPathsForBranch(
  paths: readonly CausalTraversalPath[],
  branch: CandidateBranch,
  rootCriterionId: string,
  rootSemanticScopeId: string,
): readonly ExactPath[] {
  return paths
    .filter(
      (path) =>
        traversalPathCriterionId(path) === rootCriterionId &&
        path.edges.every((edge) => edge.rootCriterionId === rootCriterionId) &&
        path.edges[0]?.toSemanticScopeId === rootSemanticScopeId &&
        path.edges.slice(1).every(
          (edge, index) =>
            edge.toSemanticScopeId === path.edges[index]!.fromSemanticScopeId,
        ),
    )
    .flatMap((path) => {
      const bridgeEdge = exactOccurrenceBridgeForCandidatePath(path, branch);
      return bridgeEdge
        ? [{
            path,
            bridgeEdge,
            effectiveCertainty: effectivePathCertainty(path),
          }]
        : [];
    })
    .sort(
      (left, right) =>
        compareText(left.path.pathId, right.path.pathId) ||
        compareText(left.bridgeEdge.edgeId, right.bridgeEdge.edgeId),
    );
}

function pathTasks(path: CausalTraversalPath): ReadonlySet<string> {
  return new Set(path.edges.flatMap((edge) => [edge.fromTaskId, edge.toTaskId]));
}

function pathSubjects(path: CausalTraversalPath): ReadonlySet<string> {
  return new Set(
    path.edges.flatMap((edge) => [subjectKey(edge.fromSubject), subjectKey(edge.toSubject)]),
  );
}

function gapBeginsBeyondTerminalRelationBridge(
  gap: CausalTraversalGap,
  path: CausalTraversalPath,
): boolean {
  if (gap.reasonCode !== "PRODUCER_RELATION_FRONTIER_UNEXPANDED") return false;
  const terminal = path.edges.at(-1);
  return Boolean(
    terminal &&
      terminal.localEdgeKind === "RELATION_CONTEXT" &&
      terminal.fromTaskId === gap.taskId &&
      terminal.fromSemanticScopeId === gap.semanticScopeId &&
      gap.readOccurrenceId !== undefined &&
      terminal.readOccurrenceId === gap.readOccurrenceId &&
      (gap.subject === null ||
        subjectKey(terminal.fromSubject) === subjectKey(gap.subject)),
  );
}

/**
 * Decide whether a traversal gap invalidates this exact positive path.
 * Pure/read-only so artifact validation can apply the same boundary rule.
 */
export function traversalGapBlocksPositivePath(
  gap: CausalTraversalGap,
  path: CausalTraversalPath,
): boolean {
  const rootCriterionId = traversalPathCriterionId(path);
  if (
    rootCriterionId === null ||
    traversalGapCriterionId(gap) !== rootCriterionId
  ) return false;
  if (gap.rootDependenceKind !== path.rootDependenceKind) return false;
  // This gap starts on the producer side of an exact relation bridge.  It
  // blocks claims about anything further upstream, but the bridge itself is a
  // complete occurrence-exact path to its immediate producer.
  if (gapBeginsBeyondTerminalRelationBridge(gap, path)) return false;
  if (!pathTasks(path).has(gap.taskId)) return false;
  if (
    gap.readOccurrenceId !== undefined &&
    !path.edges.some((edge) => edge.readOccurrenceId === gap.readOccurrenceId)
  )
    return false;
  return gap.subject === null || pathSubjects(path).has(subjectKey(gap.subject));
}

function pathEvidenceComplete(path: CausalTraversalPath): boolean {
  return (
    path.edges.length > 0 &&
    path.edges.every((edge) => edge.evidenceRefs.length > 0)
  );
}

function proofId(input: Omit<PositiveCausalProof, "proofId">): string {
  return `positive-proof:${sha256(canonicalJson(input))}`;
}

function assessmentId(
  rootCriterionId: string,
  pairId: string,
  status: CausalAssessmentStatus,
  reasonCode: CausalAssessment["reasonCode"],
  positiveProofIds: readonly string[],
  gapRefs: readonly string[],
): string {
  return canonicalCausalAssessmentId({
    rootCriterionId,
    pairId,
    status,
    reasonCode,
    positiveProofIds,
    negativeProofIds: [],
    gapRefs,
  });
}

function derivedGap(
  rootCriterionId: string,
  rootTargetFieldId: string,
  candidateBranchId: string,
  reasonCode: UnknownAssessmentReason,
  evidenceRefs: readonly string[] = [],
): CausalAssessmentGap {
  const stableEvidenceRefs = sortedUnique(evidenceRefs);
  const input = {
    rootCriterionId,
    rootTargetFieldId,
    candidateBranchId,
    reasonCode,
    evidenceRefs: stableEvidenceRefs,
  };
  return {
    gapId: canonicalCausalAssessmentGapId(input),
    ...input,
  };
}

function unknownAssessment(
  pair: CandidateAssessmentPair,
  reasonCode: UnknownAssessmentReason,
  gaps: Map<string, CausalAssessmentGap>,
  evidenceRefs: readonly string[] = [],
  inheritedGapRefs: readonly string[] = [],
): CausalAssessment {
  const gap = derivedGap(
    pair.rootCriterionId,
    pair.rootTargetFieldId,
    pair.candidateBranchId,
    reasonCode,
    evidenceRefs,
  );
  gaps.set(gap.gapId, gap);
  const gapRefs = sortedUnique([...inheritedGapRefs, gap.gapId]);
  return {
    assessmentId: assessmentId(
      pair.rootCriterionId,
      pair.pairId,
      "UNKNOWN",
      reasonCode,
      [],
      gapRefs,
    ),
    pairId: pair.pairId,
    rootCriterionId: pair.rootCriterionId,
    rootTargetFieldId: pair.rootTargetFieldId,
    candidateBranchId: pair.candidateBranchId,
    status: "UNKNOWN",
    reasonCode,
    positiveProofIds: [],
    negativeProofIds: [],
    gapRefs,
  };
}

function relatedAssessment(
  pair: CandidateAssessmentPair,
  proof: PositiveCausalProof,
): CausalAssessment {
  const status = proof.pathCertainty === "CONFIRMED"
    ? "CONFIRMED_RELATED"
    : "CONDITIONAL_RELATED";
  return {
    assessmentId: assessmentId(
      pair.rootCriterionId,
      pair.pairId,
      status,
      proof.reasonCode,
      [proof.proofId],
      [],
    ),
    pairId: pair.pairId,
    rootCriterionId: pair.rootCriterionId,
    rootTargetFieldId: pair.rootTargetFieldId,
    candidateBranchId: pair.candidateBranchId,
    status,
    reasonCode: proof.reasonCode,
    positiveProofIds: [proof.proofId],
    negativeProofIds: [],
    gapRefs: [],
  };
}

function createPathProof(
  rootCriterionId: string,
  rootTargetFieldId: string,
  branch: CandidateBranch,
  path: CausalTraversalPath,
  pathCertainty: Exclude<PathCertainty, "UNKNOWN">,
): PositiveCausalProof {
  const input: Omit<PositiveCausalProof, "proofId"> = {
    rootCriterionId,
    rootTargetFieldId,
    candidateBranchId: branch.candidateBranchId,
    pathCertainty,
    reasonCode: pathCertainty === "CONFIRMED"
      ? "CONTINUOUS_CONFIRMED_PATH"
      : "CONTINUOUS_PROVISIONAL_PATH",
    pathIds: [path.pathId],
    edgeIds: path.edges.map((edge) => edge.edgeId),
    evidenceRefs: sortedUnique(path.edges.flatMap((edge) => edge.evidenceRefs)),
  };
  return { proofId: proofId(input), ...input };
}

function createRootWriteProof(
  inputProof: RootWritePositiveProofInput,
): PositiveCausalProof {
  const input: Omit<PositiveCausalProof, "proofId"> = {
    rootCriterionId: inputProof.rootCriterionId,
    rootTargetFieldId: inputProof.rootTargetFieldId,
    candidateBranchId: inputProof.candidateBranchId,
    pathCertainty: inputProof.pathCertainty,
    reasonCode: "EXPLICIT_ROOT_WRITE_PROOF",
    pathIds: [],
    edgeIds: [],
    evidenceRefs: sortedUnique(inputProof.evidenceRefs),
  };
  return { proofId: proofId(input), ...input };
}

function uniqueTraversalRoot(
  traversal: CausalTraversalResult,
  rootCriterionId: string,
): CausalTraversalRootResult | null {
  const matches = traversal.roots.filter(
    (root) => traversalRootCriterionId(root) === rootCriterionId,
  );
  return matches.length === 1 ? matches[0]! : null;
}

function uniqueCriterion(
  rootCriteria: readonly RootCriterion[],
  rootCriterionId: string,
): RootCriterion | null {
  const matches = rootCriteria.filter(
    (criterion) => criterion.rootCriterionId === rootCriterionId,
  );
  return matches.length === 1 ? matches[0]! : null;
}

export function assessPositiveCausalRelationships(
  input: PositiveCausalAssessmentInput,
): PositiveCausalAssessmentResult {
  const pairs = input.assessmentPairs ?? buildAssessmentPairSkeleton(
    input.rootCriteria,
    input.candidateUniverse.branches,
  );
  const branches = new Map(
    input.candidateUniverse.branches.map((branch) => [branch.candidateBranchId, branch]),
  );
  const rootWriteProofs = new Map<string, RootWritePositiveProofInput[]>();
  for (const proof of input.rootWriteProofs ?? []) {
    const key = `${proof.rootCriterionId}\u0000${proof.candidateBranchId}`;
    rootWriteProofs.set(key, [...(rootWriteProofs.get(key) ?? []), proof]);
  }
  const positiveProofs = new Map<string, PositiveCausalProof>();
  const gaps = new Map<string, CausalAssessmentGap>();
  const assessments: CausalAssessment[] = [];

  for (const pair of [...pairs].sort((left, right) => compareText(left.pairId, right.pairId))) {
    const branch = branches.get(pair.candidateBranchId);
    const criterion = uniqueCriterion(input.rootCriteria, pair.rootCriterionId);
    if (
      !branch ||
      !criterion ||
      criterion.rootTargetFieldId !== pair.rootTargetFieldId
    ) {
      assessments.push(unknownAssessment(pair, "ASSESSMENT_PAIR_INPUT_INVALID", gaps));
      continue;
    }
    if (branch.gapRefs.length > 0) {
      assessments.push(
        unknownAssessment(
          pair,
          "BRANCH_BOUNDARY_UNRESOLVED",
          gaps,
          branch.evidenceRefs.map((ref) => ref.evidenceRefId),
          branch.gapRefs,
        ),
      );
      continue;
    }
    if (branch.branchKind === "ROOT_WRITE") {
      if (
        branch.writeObservationId !== criterion.rootWriteObservationId ||
        !tableMatchesRootCriterion(branch.table, criterion)
      ) {
        assessments.push(unknownAssessment(pair, "ASSESSMENT_PAIR_INPUT_INVALID", gaps));
        continue;
      }
      const matchingProofs = rootWriteProofs.get(
        `${pair.rootCriterionId}\u0000${pair.candidateBranchId}`,
      ) ?? [];
      const rootWriteProof = matchingProofs.length === 1
        ? matchingProofs[0]!
        : null;
      if (
        !rootWriteProof ||
        rootWriteProof.rootTargetFieldId !== pair.rootTargetFieldId ||
        !rootWriteProofIsEvidenceBound(rootWriteProof, criterion)
      ) {
        assessments.push(unknownAssessment(pair, "ROOT_WRITE_PROOF_MISSING", gaps));
        continue;
      }
      const proof = createRootWriteProof(rootWriteProof);
      positiveProofs.set(proof.proofId, proof);
      assessments.push(relatedAssessment(pair, proof));
      continue;
    }
    if (branch.branchKind !== "PHYSICAL_PRODUCER") {
      assessments.push(
        unknownAssessment(pair, "BRANCH_KIND_REQUIRES_SEPARATE_PROOF", gaps),
      );
      continue;
    }
    const root = uniqueTraversalRoot(input.traversal, pair.rootCriterionId);
    if (!root) {
      assessments.push(unknownAssessment(pair, "ROOT_TRAVERSAL_RESULT_MISSING", gaps));
      continue;
    }
    const exactPaths = exactPathsForBranch(
      root.paths,
      branch,
      pair.rootCriterionId,
      root.root.semanticScope.semanticScopeId,
    );
    if (exactPaths.length === 0) {
      assessments.push(
        unknownAssessment(pair, "EXACT_OCCURRENCE_PATH_NOT_PROVEN", gaps),
      );
      continue;
    }
    const completePaths = exactPaths.filter(
      ({ path }) =>
        pathEvidenceComplete(path) &&
        !root.gaps.some((gap) =>
          traversalGapBlocksPositivePath(gap, path),
        ),
    );
    const confirmed = completePaths.find(
      ({ effectiveCertainty }) => effectiveCertainty === "CONFIRMED",
    );
    const conditional = completePaths.find(
      ({ effectiveCertainty }) => effectiveCertainty === "CONDITIONAL",
    );
    const selected = confirmed ?? conditional;
    if (selected) {
      const proof = createPathProof(
        pair.rootCriterionId,
        pair.rootTargetFieldId,
        branch,
        selected.path,
        selected.effectiveCertainty as Exclude<PathCertainty, "UNKNOWN">,
      );
      positiveProofs.set(proof.proofId, proof);
      assessments.push(relatedAssessment(pair, proof));
      continue;
    }
    const relevantGapRefs = sortedUnique(
      exactPaths.flatMap(({ path }) =>
        root.gaps
          .filter((gap) => traversalGapBlocksPositivePath(gap, path))
          .map((gap) => gap.gapId),
      ),
    );
    const hasUnknownPath = exactPaths.some(
      ({ effectiveCertainty }) => effectiveCertainty === "UNKNOWN",
    );
    assessments.push(
      unknownAssessment(
        pair,
        hasUnknownPath ? "REQUIRED_PATH_UNKNOWN" : "CONTINUOUS_PATH_EVIDENCE_INCOMPLETE",
        gaps,
        exactPaths.flatMap(({ path }) =>
          path.edges.flatMap((edge) => edge.evidenceRefs),
        ),
        relevantGapRefs,
      ),
    );
  }

  return {
    assessments: assessments.sort((left, right) => compareText(left.pairId, right.pairId)),
    positiveProofs: [...positiveProofs.values()].sort((left, right) =>
      compareText(left.proofId, right.proofId)
    ),
    gaps: [...gaps.values()].sort((left, right) => compareText(left.gapId, right.gapId)),
  };
}

export function validatePositiveCausalAssessments(
  universe: CandidateUniverse,
  rootCriteria: readonly RootCriterion[],
  traversal: CausalTraversalResult,
  result: PositiveCausalAssessmentResult,
): CausalAssessmentValidation {
  const errors: string[] = [];
  const expectedPairs = buildAssessmentPairSkeleton(rootCriteria, universe.branches);
  const expected = new Set(expectedPairs.map((pair) => pair.pairId));
  const expectedByPair = new Map(expectedPairs.map((pair) => [pair.pairId, pair]));
  const assessmentByPair = new Map<string, CausalAssessment[]>();
  const assessmentIds = new Set<string>();
  for (const assessment of result.assessments) {
    if (assessmentIds.has(assessment.assessmentId))
      errors.push(`ASSESSMENT_ID_DUPLICATE:${assessment.assessmentId}`);
    assessmentIds.add(assessment.assessmentId);
    const expectedPair = expectedByPair.get(assessment.pairId);
    if (
      expectedPair &&
      (assessment.rootCriterionId !== expectedPair.rootCriterionId ||
        assessment.rootTargetFieldId !== expectedPair.rootTargetFieldId ||
        assessment.candidateBranchId !== expectedPair.candidateBranchId)
    )
      errors.push(`ASSESSMENT_PAIR_IDENTITY_MISMATCH:${assessment.assessmentId}`);
    const expectedAssessmentId = assessmentId(
      assessment.rootCriterionId,
      assessment.pairId,
      assessment.status,
      assessment.reasonCode,
      assessment.positiveProofIds,
      assessment.gapRefs,
    );
    if (assessment.assessmentId !== expectedAssessmentId)
      errors.push(`ASSESSMENT_ID_NON_CANONICAL:${assessment.assessmentId}`);
    assessmentByPair.set(assessment.pairId, [
      ...(assessmentByPair.get(assessment.pairId) ?? []),
      assessment,
    ]);
    if (assessment.status === "PROVEN_UNRELATED")
      errors.push(`PROVEN_UNRELATED_NOT_ALLOWED_IN_POSITIVE_PHASE:${assessment.assessmentId}`);
    if (assessment.status === "UNKNOWN" && assessment.gapRefs.length === 0)
      errors.push(`UNKNOWN_GAP_REF_MISSING:${assessment.assessmentId}`);
    if (
      ["CONFIRMED_RELATED", "CONDITIONAL_RELATED"].includes(assessment.status) &&
      assessment.positiveProofIds.length === 0
    )
      errors.push(`POSITIVE_PROOF_REF_MISSING:${assessment.assessmentId}`);
  }
  for (const pairId of expected) {
    const matches = assessmentByPair.get(pairId) ?? [];
    if (matches.length !== 1) errors.push(`ASSESSMENT_PAIR_CARDINALITY:${pairId}:${matches.length}`);
  }
  for (const pairId of assessmentByPair.keys())
    if (!expected.has(pairId)) errors.push(`UNEXPECTED_ASSESSMENT_PAIR:${pairId}`);

  const proofs = new Map(result.positiveProofs.map((proof) => [proof.proofId, proof]));
  if (proofs.size !== result.positiveProofs.length)
    errors.push("POSITIVE_PROOF_ID_DUPLICATE");
  const branches = new Map(
    universe.branches.map((branch) => [branch.candidateBranchId, branch]),
  );
  for (const proof of result.positiveProofs) {
    const { proofId: actualProofId, ...proofInput } = proof;
    if (proofId(proofInput) !== actualProofId)
      errors.push(`POSITIVE_PROOF_ID_NON_CANONICAL:${actualProofId}`);
    const criterion = uniqueCriterion(rootCriteria, proof.rootCriterionId);
    if (
      criterion === null ||
      criterion.rootTargetFieldId !== proof.rootTargetFieldId
    )
      errors.push(`POSITIVE_PROOF_ROOT_CRITERION_INVALID:${actualProofId}`);
    const branch = branches.get(proof.candidateBranchId);
    if (!branch) {
      errors.push(`POSITIVE_PROOF_BRANCH_MISSING:${actualProofId}`);
      continue;
    }
    if (proof.reasonCode === "EXPLICIT_ROOT_WRITE_PROOF") {
      if (
        branch.branchKind !== "ROOT_WRITE" ||
        criterion === null ||
        branch.writeObservationId !== criterion.rootWriteObservationId ||
        !tableMatchesRootCriterion(branch.table, criterion) ||
        !rootWriteProofIsEvidenceBound(proof, criterion) ||
        proof.rootTargetFieldId !== criterion.rootTargetFieldId ||
        proof.pathIds.length !== 0 ||
        proof.edgeIds.length !== 0
      )
        errors.push(`ROOT_WRITE_PROOF_SHAPE_INVALID:${actualProofId}`);
      continue;
    }
    if (proof.pathIds.length !== 1) {
      errors.push(`POSITIVE_PROOF_PATH_CARDINALITY:${actualProofId}:${proof.pathIds.length}`);
      continue;
    }
    const root = uniqueTraversalRoot(traversal, proof.rootCriterionId);
    if (!root) {
      errors.push(`POSITIVE_PROOF_TRAVERSAL_ROOT_MISSING:${actualProofId}`);
      continue;
    }
    const path = root.paths.find((candidate) => candidate.pathId === proof.pathIds[0]);
    if (!path) {
      errors.push(`POSITIVE_PROOF_TRAVERSAL_PATH_MISSING:${actualProofId}`);
      continue;
    }
    if (
      exactPathsForBranch(
        [path],
        branch,
        proof.rootCriterionId,
        root.root.semanticScope.semanticScopeId,
      ).length !== 1
    )
      errors.push(`POSITIVE_PROOF_BRANCH_PATH_MISMATCH:${actualProofId}`);
    if (canonicalJson(proof.edgeIds) !== canonicalJson(path.edges.map((edge) => edge.edgeId)))
      errors.push(`POSITIVE_PROOF_EDGE_SEQUENCE_MISMATCH:${actualProofId}`);
    const expectedEvidenceRefs = sortedUnique(path.edges.flatMap((edge) => edge.evidenceRefs));
    if (canonicalJson(proof.evidenceRefs) !== canonicalJson(expectedEvidenceRefs))
      errors.push(`POSITIVE_PROOF_EVIDENCE_MISMATCH:${actualProofId}`);
    if (proof.pathCertainty !== effectivePathCertainty(path))
      errors.push(`POSITIVE_PROOF_PATH_CERTAINTY_MISMATCH:${actualProofId}`);
  }
  for (const assessment of result.assessments) {
    for (const positiveProofId of assessment.positiveProofIds) {
      const proof = proofs.get(positiveProofId);
      if (!proof) {
        errors.push(`POSITIVE_PROOF_MISSING:${positiveProofId}`);
        continue;
      }
      if (proof.evidenceRefs.length === 0)
        errors.push(`POSITIVE_PROOF_EVIDENCE_EMPTY:${positiveProofId}`);
      if (
        proof.rootCriterionId !== assessment.rootCriterionId ||
        proof.rootTargetFieldId !== assessment.rootTargetFieldId ||
        proof.candidateBranchId !== assessment.candidateBranchId
      )
        errors.push(`POSITIVE_PROOF_PAIR_MISMATCH:${positiveProofId}`);
      if (
        proof.reasonCode !== "EXPLICIT_ROOT_WRITE_PROOF" &&
        (proof.pathIds.length === 0 || proof.edgeIds.length === 0)
      )
        errors.push(`POSITIVE_PROOF_PATH_EMPTY:${positiveProofId}`);
      if (
        assessment.status === "CONFIRMED_RELATED" &&
        proof.pathCertainty !== "CONFIRMED"
      )
        errors.push(`CONFIRMED_PROOF_CERTAINTY_INVALID:${positiveProofId}`);
      if (
        assessment.status === "CONDITIONAL_RELATED" &&
        proof.pathCertainty !== "CONDITIONAL"
      )
        errors.push(`CONDITIONAL_PROOF_CERTAINTY_INVALID:${positiveProofId}`);
    }
  }
  const assessmentByCriterionBranch = new Map(
    result.assessments.map((assessment) => [
      `${assessment.rootCriterionId}\u0000${assessment.candidateBranchId}`,
      assessment,
    ]),
  );
  const gapIds = new Set<string>();
  for (const gap of result.gaps) {
    if (gapIds.has(gap.gapId)) errors.push(`ASSESSMENT_GAP_ID_DUPLICATE:${gap.gapId}`);
    gapIds.add(gap.gapId);
    const expectedGap = derivedGap(
      gap.rootCriterionId,
      gap.rootTargetFieldId,
      gap.candidateBranchId,
      gap.reasonCode,
      gap.evidenceRefs,
    );
    if (expectedGap.gapId !== gap.gapId)
      errors.push(`ASSESSMENT_GAP_ID_NON_CANONICAL:${gap.gapId}`);
    const criterion = uniqueCriterion(rootCriteria, gap.rootCriterionId);
    if (
      criterion === null ||
      criterion.rootTargetFieldId !== gap.rootTargetFieldId
    )
      errors.push(`ASSESSMENT_GAP_ROOT_CRITERION_INVALID:${gap.gapId}`);
    const assessment = assessmentByCriterionBranch.get(
      `${gap.rootCriterionId}\u0000${gap.candidateBranchId}`,
    );
    if (!assessment?.gapRefs.includes(gap.gapId))
      errors.push(`ASSESSMENT_GAP_NOT_REFERENCED:${gap.gapId}`);
  }
  return { valid: errors.length === 0, errors: errors.sort(compareText) };
}

export const assessCausalRelationships = assessPositiveCausalRelationships;
