import type {
  PhysicalFieldExpansion,
  PhysicalFieldIdentity,
} from "./canonical-evidence-adapter.ts";
import { physicalFieldKey } from "../field-lineage/field-lineage-contract.ts";
import {
  canonicalJson,
  sha256,
} from "../../../machine-facts/machine-facts-contract.ts";
import {
  isCompleteSemanticOccurrenceScope,
  sameSemanticWriteOccurrence,
  semanticScopeForRelation,
  type LocalEdgeKind,
  type PathCertainty,
  type RootDependenceKind,
  type SemanticDependencyEdge,
  type SemanticOccurrenceScope,
  type SemanticSubject,
} from "./semantic-dependency-contract.ts";
import type {
  SemanticDependencyGap,
  SemanticDependencyNormalization,
} from "./semantic-dependency-normalizer.ts";
import type { RootCriterion } from "./write-scoped-plan-inputs.ts";

export const TRAVERSAL_FRONTIER_KINDS = [
  "VALUE",
  "EXPRESSION_CONTROL",
  "ROWSET_CONTROL",
  "WINDOW_CONTEXT",
  "RELATION_CONTEXT",
] as const;
export type TraversalFrontierKind = (typeof TRAVERSAL_FRONTIER_KINDS)[number];

export interface CausalTraversalRoot {
  readonly rootCriterion: RootCriterion;
  readonly semanticScope: SemanticOccurrenceScope;
  readonly subject?: SemanticSubject;
}

export interface SemanticTraversalLoadRequest {
  /** The original user-selected root; never changes while traversing upstream. */
  readonly rootCriterion: RootCriterion;
  /** The exact local write/output currently being traversed. */
  readonly localRootCriterion: RootCriterion;
  readonly semanticScope: SemanticOccurrenceScope;
  readonly taskId: string;
  readonly subject: SemanticSubject;
}

export interface SemanticTraversalLoadResult {
  readonly edges: readonly SemanticDependencyEdge[];
  readonly gaps: readonly SemanticDependencyGap[];
}

export interface ProducerScopeResolutionRequest {
  readonly rootCriterion: RootCriterion;
  readonly localRootCriterion: RootCriterion;
  readonly semanticScope: SemanticOccurrenceScope;
  readonly producerTaskId: string;
  readonly producerField: PhysicalFieldIdentity;
  readonly producerBindings: readonly Readonly<Record<string, unknown>>[];
  readonly readOccurrenceId?: string;
  readonly evidenceRefs: readonly string[];
}

export interface ResolvedProducerScope {
  readonly localRootCriterion: RootCriterion;
  readonly semanticScope: SemanticOccurrenceScope;
}

export interface PhysicalFieldTraversalRequest {
  readonly rootCriterion: RootCriterion;
  readonly localRootCriterion: RootCriterion;
  readonly semanticScope: SemanticOccurrenceScope;
  /** Convenience projection of rootCriterion.rootTargetFieldId. */
  readonly rootTargetFieldId: string;
  readonly taskId: string;
  readonly field: PhysicalFieldIdentity;
  readonly sourceNodeId: string;
  readonly depth: number;
  readonly maxDepth: number;
  readonly rootDependenceKind: RootDependenceKind;
  readonly localEdgeKind: LocalEdgeKind;
  readonly pathCertainty: PathCertainty;
  readonly readOccurrenceId?: string;
}

export interface RelationTraversalRequest {
  readonly rootCriterion: RootCriterion;
  readonly localRootCriterion: RootCriterion;
  readonly semanticScope: SemanticOccurrenceScope;
  readonly rootTargetFieldId: string;
  readonly taskId: string;
  readonly relationOccurrenceId: string;
  readonly depth: number;
  readonly maxDepth: number;
  readonly rootDependenceKind: RootDependenceKind;
  readonly pathCertainty: PathCertainty;
}

export interface RelationTraversalExpansion {
  /**
   * A relation-level dependency can reach a producer Task without naming a
   * physical column (for example COUNT(*) or a literal projection).  The
   * bridge is occurrence-specific and is kept separate from field expansion.
   */
  readonly relationBridges?: readonly {
    readonly producerTaskId: string;
    readonly readOccurrenceId: string;
    readonly producerRootCriterion?: RootCriterion;
    readonly producerSemanticScope?: SemanticOccurrenceScope;
    readonly evidenceStatus?: "CONFIRMED" | "PROVISIONAL_LEGACY" | "UNRESOLVED";
    readonly evidenceRefs?: readonly string[];
  }[];
  readonly relationOccurrences?: readonly {
    readonly taskId: string;
    readonly relationOccurrenceId: string;
    readonly localRelationId?: string;
    readonly producerRootCriterion?: RootCriterion;
    readonly producerSemanticScope?: SemanticOccurrenceScope;
    readonly evidenceStatus?: "CONFIRMED" | "PROVISIONAL_LEGACY" | "UNRESOLVED";
    readonly evidenceRefs?: readonly string[];
  }[];
  readonly evidenceRefs?: readonly string[];
  readonly gaps?: readonly CausalTraversalGap[];
}

export interface CausalTraversalInput {
  readonly roots: readonly CausalTraversalRoot[];
  /** One or more normalizations per Task. They are selected by target subject. */
  readonly semanticDependencies: ReadonlyMap<
    string,
    readonly SemanticDependencyNormalization[]
  >;
  /** Optional target-directed loader. It may populate/cache only the requested subject. */
  readonly loadSemanticDependencies?: (
    request: SemanticTraversalLoadRequest,
  ) => readonly SemanticDependencyNormalization[] | null;
  /** Fast path for large multi-root runs; returns only edges targeting the subject. */
  readonly loadSemanticEdges?: (
    request: SemanticTraversalLoadRequest,
  ) => SemanticTraversalLoadResult | null;
  /** The canonical adapter-backed physical expansion callback. */
  readonly expandPhysicalField?: (
    request: PhysicalFieldTraversalRequest,
  ) => PhysicalFieldExpansion;
  /** Resolve a canonical identity; absence is an unresolved boundary. */
  readonly resolvePhysicalField?: (
    physicalFieldId: string,
    taskId: string,
  ) => PhysicalFieldIdentity | null;
  /** Resolve exact producer write/output scopes from strict producer bindings. */
  readonly resolveProducerScopes?: (
    request: ProducerScopeResolutionRequest,
  ) => readonly ResolvedProducerScope[];
  /** Optional relation-only expansion. It must not synthesize physical fields. */
  readonly expandRelationOccurrence?: (
    request: RelationTraversalRequest,
  ) => RelationTraversalExpansion;
  readonly options?: Partial<CausalTraversalOptions>;
}

export interface CausalTraversalOptions {
  readonly maxDepth: number;
  readonly maxValueStates: number;
  readonly maxValuePaths: number;
  readonly maxControlStates: number;
  readonly maxControlPaths: number;
}

export const DEFAULT_CAUSAL_TRAVERSAL_OPTIONS: CausalTraversalOptions = {
  maxDepth: 25,
  maxValueStates: 5000,
  maxValuePaths: 10000,
  maxControlStates: 5000,
  maxControlPaths: 10000,
};

export interface CausalTraversalGap {
  readonly gapId: string;
  readonly rootCriterionId: string;
  readonly semanticScopeId: string;
  readonly rootTargetFieldId: string;
  readonly taskId: string;
  readonly subject: SemanticSubject | null;
  /** Absent means global to the subject; present means this exact read occurrence only. */
  readonly readOccurrenceId?: string;
  /** Owns budget, closure, and gap classification independently of local edge semantics. */
  readonly rootDependenceKind: RootDependenceKind;
  readonly frontierKind: TraversalFrontierKind;
  readonly reasonCode:
    | "TASK_SEMANTIC_FACTS_MISSING"
    | "SEMANTIC_SUBJECT_DEPENDENCY_MISSING"
    | "PHYSICAL_EXPANSION_UNAVAILABLE"
    | "RELATION_EXPANSION_UNAVAILABLE"
    | "REQUIRED_EVIDENCE_UNRESOLVED"
    | "CYCLE"
    | "MAX_DEPTH_REACHED"
    | "MAX_VALUE_STATES_REACHED"
    | "MAX_VALUE_PATHS_REACHED"
    | "MAX_CONTROL_STATES_REACHED"
    | "MAX_CONTROL_PATHS_REACHED"
    | "PRODUCER_SCOPE_RESOLVER_UNAVAILABLE"
    | "PRODUCER_SCOPE_UNRESOLVED"
    | "PRODUCER_RELATION_FRONTIER_UNEXPANDED"
    | "SEMANTIC_SCOPE_DISCONTINUITY";
  readonly message: string;
  readonly evidenceRefs: readonly string[];
  readonly blocksConfirmedCausality: true;
  readonly blocksNegativeProof: true;
}

export interface CausalTraversalPathEdge {
  readonly edgeId: string;
  readonly rootCriterionId: string;
  readonly fromSemanticScopeId: string;
  readonly toSemanticScopeId: string;
  readonly fromTaskId: string;
  readonly toTaskId: string;
  readonly fromSubject: SemanticSubject;
  readonly toSubject: SemanticSubject;
  readonly rootDependenceKind: RootDependenceKind;
  readonly localEdgeKind: LocalEdgeKind;
  readonly frontierKind: TraversalFrontierKind;
  readonly pathCertainty: PathCertainty;
  readonly dependencyId: string | null;
  /** Present on cross-Task physical bridges; required for occurrence-exact assessment mapping. */
  readonly readOccurrenceId?: string;
  readonly evidenceRefs: readonly string[];
}

export interface CausalTraversalPath {
  readonly pathId: string;
  readonly rootCriterionId: string;
  readonly rootTargetFieldId: string;
  readonly rootDependenceKind: RootDependenceKind;
  readonly edges: readonly CausalTraversalPathEdge[];
  readonly pathCertainty: PathCertainty;
}

export interface CausalTraversalDecisionState {
  /** This is path state only; it is not a final CausalAssessment. */
  readonly valuePathCertainty: PathCertainty | null;
  readonly controlPathCertainty: PathCertainty | null;
  readonly valueClosed: boolean;
  readonly controlClosed: boolean;
  readonly valueGapIds: readonly string[];
  readonly controlGapIds: readonly string[];
}

export interface CausalTraversalRootResult {
  readonly rootCriterionId: string;
  readonly root: CausalTraversalRoot;
  readonly visitedStateKeys: readonly string[];
  readonly activeCycleChecks: number;
  readonly frontiers: Readonly<Record<TraversalFrontierKind, number>>;
  readonly paths: readonly CausalTraversalPath[];
  readonly gaps: readonly CausalTraversalGap[];
  readonly decision: CausalTraversalDecisionState;
}

export interface CausalTraversalResult {
  readonly options: CausalTraversalOptions;
  readonly roots: readonly CausalTraversalRootResult[];
  /** Canonical evidence refs are deduplicated across roots only. */
  readonly sharedEvidenceRefs: readonly string[];
  readonly edges: readonly CausalTraversalPathEdge[];
  readonly gaps: readonly CausalTraversalGap[];
}

type TraversalSubject = {
  readonly rootCriterion: RootCriterion;
  readonly localRootCriterion: RootCriterion;
  readonly semanticScope: SemanticOccurrenceScope;
  readonly taskId: string;
  readonly subject: SemanticSubject;
  readonly depth: number;
  readonly rootDependenceKind: RootDependenceKind;
  readonly localEdgeKind: LocalEdgeKind | null;
  readonly frontierKind: TraversalFrontierKind;
  readonly pathCertainty: PathCertainty;
  readonly active: ReadonlySet<string>;
  readonly path: readonly CausalTraversalPathEdge[];
  readonly readOccurrenceId?: string;
  readonly relationTerminalObserved?: boolean;
};

type MutableRootResult = {
  readonly root: CausalTraversalRoot;
  readonly visited: Set<string>;
  readonly valueVisited: Set<string>;
  readonly controlVisited: Set<string>;
  readonly activeCycleChecks: { value: number };
  readonly frontiers: Record<TraversalFrontierKind, number>;
  readonly paths: Map<string, CausalTraversalPath>;
  readonly gaps: Map<string, CausalTraversalGap>;
  readonly valueCertainties: Set<PathCertainty>;
  readonly controlCertainties: Set<PathCertainty>;
  readonly valueGapIds: Set<string>;
  readonly controlGapIds: Set<string>;
  readonly valueTruncated: { value: boolean };
  readonly controlTruncated: { value: boolean };
  readonly valuePathsUsed: { value: number };
  readonly controlPathsUsed: { value: number };
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function subjectKey(subject: SemanticSubject): string {
  return subject.subjectKind === "PHYSICAL_FIELD"
    ? `field:${subject.physicalFieldId}`
    : `relation:${subject.relationOccurrenceId}`;
}

function sameSubject(left: SemanticSubject, right: SemanticSubject): boolean {
  return subjectKey(left) === subjectKey(right);
}

function frontierKind(
  localEdgeKind: LocalEdgeKind | null,
): TraversalFrontierKind {
  if (localEdgeKind === "VALUE_FLOW") return "VALUE";
  return localEdgeKind ?? "RELATION_CONTEXT";
}

function isValueRootDependence(kind: RootDependenceKind): boolean {
  return kind === "VALUE_TO_TARGET";
}

function propagatedRootDependenceKind(
  current: RootDependenceKind,
  dependency: RootDependenceKind,
): RootDependenceKind {
  return isValueRootDependence(current) ? dependency : current;
}

function certaintyRank(value: PathCertainty): number {
  return value === "UNKNOWN" ? 2 : value === "CONDITIONAL" ? 1 : 0;
}

function worstCertainty(
  left: PathCertainty,
  right: PathCertainty,
): PathCertainty {
  return certaintyRank(left) >= certaintyRank(right) ? left : right;
}

function evidenceCertainty(
  value: "CONFIRMED" | "PROVISIONAL_LEGACY" | "UNRESOLVED" | undefined,
): PathCertainty {
  if (value === "PROVISIONAL_LEGACY") return "CONDITIONAL";
  if (value === "UNRESOLVED") return "UNKNOWN";
  return "CONFIRMED";
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(Boolean))].sort(compareText);
}

function optionsOf(
  options: Partial<CausalTraversalOptions> | undefined,
): CausalTraversalOptions {
  const merged = {
    ...DEFAULT_CAUSAL_TRAVERSAL_OPTIONS,
    ...(options ?? {}),
  };
  for (const [key, value] of Object.entries(merged)) {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error(`INVALID_CAUSAL_TRAVERSAL_OPTION:${key}`);
  }
  return merged;
}

function rootSubjectOf(root: CausalTraversalRoot): SemanticSubject {
  return (
    root.subject ?? {
      subjectKind: "PHYSICAL_FIELD",
      physicalFieldId: root.rootCriterion.rootTargetFieldId,
    }
  );
}

function stateKey(state: TraversalSubject): string {
  return canonicalJson({
    rootCriterionId: state.rootCriterion.rootCriterionId,
    localRootCriterionId: state.localRootCriterion.rootCriterionId,
    semanticScopeId: state.semanticScope.semanticScopeId,
    taskId: state.taskId,
    subject: state.subject,
    depth: state.depth,
    rootDependenceKind: state.rootDependenceKind,
    localEdgeKind: state.localEdgeKind,
    frontierKind: state.frontierKind,
    readOccurrenceId: state.readOccurrenceId ?? null,
  });
}

function activeKey(state: TraversalSubject): string {
  return canonicalJson({
    rootCriterionId: state.rootCriterion.rootCriterionId,
    localRootCriterionId: state.localRootCriterion.rootCriterionId,
    semanticScopeId: state.semanticScope.semanticScopeId,
    taskId: state.taskId,
    subject: state.subject,
    rootDependenceKind: state.rootDependenceKind,
    localEdgeKind: state.localEdgeKind,
    frontierKind: state.frontierKind,
    readOccurrenceId: state.readOccurrenceId ?? null,
  });
}

function occurrenceAgnosticActiveKey(state: TraversalSubject): string {
  return canonicalJson({
    rootCriterionId: state.rootCriterion.rootCriterionId,
    localRootCriterionId: state.localRootCriterion.rootCriterionId,
    semanticScopeId: state.semanticScope.semanticScopeId,
    taskId: state.taskId,
    subject: state.subject,
    rootDependenceKind: state.rootDependenceKind,
    localEdgeKind: state.localEdgeKind,
    frontierKind: state.frontierKind,
  });
}

export function canonicalTraversalEdgeId(input: {
  readonly rootCriterionId: string;
  readonly fromSemanticScopeId: string;
  readonly toSemanticScopeId: string;
  readonly rootTargetFieldId: string;
  readonly fromTaskId: string;
  readonly toTaskId: string;
  readonly fromSubject: SemanticSubject;
  readonly toSubject: SemanticSubject;
  readonly rootDependenceKind: RootDependenceKind;
  readonly localEdgeKind: LocalEdgeKind;
  readonly dependencyId: string | null;
  readonly readOccurrenceId?: string;
}): string {
  return `causal-edge:${sha256(canonicalJson(input))}`;
}

export function canonicalTraversalPathId(
  rootCriterionId: string,
  rootTargetFieldId: string,
  edges: readonly CausalTraversalPathEdge[],
): string {
  return `causal-path:${sha256(
    canonicalJson({
      rootCriterionId,
      rootTargetFieldId,
      edgeIds: edges.map((edge) => edge.edgeId),
    }),
  )}`;
}

function makeGap(input: {
  readonly rootCriterionId: string;
  readonly semanticScopeId: string;
  readonly rootTargetFieldId: string;
  readonly taskId: string;
  readonly subject: SemanticSubject | null;
  readonly readOccurrenceId?: string;
  readonly rootDependenceKind: RootDependenceKind;
  readonly frontierKind: TraversalFrontierKind;
  readonly reasonCode: CausalTraversalGap["reasonCode"];
  readonly message: string;
  readonly evidenceRefs?: readonly string[];
}): CausalTraversalGap {
  const evidenceRefs = sortedUnique(input.evidenceRefs ?? []);
  return {
    ...input,
    gapId: canonicalTraversalGapId({ ...input, evidenceRefs }),
    evidenceRefs,
    blocksConfirmedCausality: true,
    blocksNegativeProof: true,
  };
}

export function canonicalTraversalGapId(input: {
  readonly rootCriterionId: string;
  readonly semanticScopeId: string;
  readonly rootTargetFieldId: string;
  readonly taskId: string;
  readonly subject: SemanticSubject | null;
  readonly readOccurrenceId?: string;
  readonly rootDependenceKind: RootDependenceKind;
  readonly frontierKind: TraversalFrontierKind;
  readonly reasonCode: CausalTraversalGap["reasonCode"];
  readonly message: string;
  readonly evidenceRefs?: readonly string[];
}): string {
  return `causal-gap:${sha256(
    canonicalJson({
      rootCriterionId: input.rootCriterionId,
      semanticScopeId: input.semanticScopeId,
      rootTargetFieldId: input.rootTargetFieldId,
      taskId: input.taskId,
      subject: input.subject,
      readOccurrenceId: input.readOccurrenceId ?? null,
      rootDependenceKind: input.rootDependenceKind,
      frontierKind: input.frontierKind,
      reasonCode: input.reasonCode,
      message: input.message,
      evidenceRefs: sortedUnique(input.evidenceRefs ?? []),
    }),
  )}`;
}

type LoadedSemanticDependencies = {
  readonly edges: readonly SemanticDependencyEdge[];
  readonly gaps: readonly SemanticDependencyGap[];
  readonly scopeDiscontinuity: boolean;
  readonly scopeDiscontinuityEvidenceRefs: readonly string[];
};

function semanticLoadRequest(
  state: TraversalSubject,
): SemanticTraversalLoadRequest {
  return {
    rootCriterion: state.rootCriterion,
    localRootCriterion: state.localRootCriterion,
    semanticScope: state.semanticScope,
    taskId: state.taskId,
    subject: state.subject,
  };
}

function edgeScopeMatchesState(
  edge: SemanticDependencyEdge,
  state: TraversalSubject,
): boolean {
  return (
    edge.rootCriterionId === state.rootCriterion.rootCriterionId &&
    edge.semanticScopeId === edge.semanticScope?.semanticScopeId &&
    isCompleteSemanticOccurrenceScope(
      edge.semanticScope,
      state.localRootCriterion,
    ) &&
    sameSemanticWriteOccurrence(edge.semanticScope, state.semanticScope)
  );
}

function gapScopeMatchesState(
  gap: SemanticDependencyGap,
  state: TraversalSubject,
): boolean {
  return (
    gap.rootCriterionId === state.rootCriterion.rootCriterionId &&
    gap.semanticScopeId === gap.semanticScope?.semanticScopeId &&
    isCompleteSemanticOccurrenceScope(
      gap.semanticScope,
      state.localRootCriterion,
    ) &&
    sameSemanticWriteOccurrence(gap.semanticScope, state.semanticScope)
  );
}

function loadedSemanticDependencies(
  edges: readonly SemanticDependencyEdge[],
  gaps: readonly SemanticDependencyGap[],
  state: TraversalSubject,
): LoadedSemanticDependencies {
  const scopedEdges = edges.filter((edge) =>
    edgeScopeMatchesState(edge, state),
  );
  const scopedGaps = gaps.filter((gap) => gapScopeMatchesState(gap, state));
  const scopeDiscontinuity =
    scopedEdges.length !== edges.length || scopedGaps.length !== gaps.length;
  return {
    edges: scopedEdges
      .filter((edge) => sameSubject(edge.toSubject, state.subject))
      .sort((left, right) => left.edgeId.localeCompare(right.edgeId)),
    gaps: scopedGaps.sort((left, right) =>
      left.gapId.localeCompare(right.gapId),
    ),
    scopeDiscontinuity,
    scopeDiscontinuityEvidenceRefs: sortedUnique([
      ...edges
        .filter((edge) => !edgeScopeMatchesState(edge, state))
        .flatMap((edge) => edge.proofRefs.map((ref) => ref.refId)),
      ...gaps
        .filter((gap) => !gapScopeMatchesState(gap, state))
        .flatMap((gap) => [
          ...gap.evidenceRefs,
          ...gap.proofRefs.map((ref) => ref.refId),
        ]),
    ]),
  };
}

function normalizationFor(
  input: CausalTraversalInput,
  state: TraversalSubject,
): LoadedSemanticDependencies | null {
  const request = semanticLoadRequest(state);
  if (input.loadSemanticEdges) {
    const loaded = input.loadSemanticEdges(request);
    return loaded === null
      ? null
      : loadedSemanticDependencies(loaded.edges, loaded.gaps, state);
  }
  const loadedNormalizations = input.loadSemanticDependencies
    ? input.loadSemanticDependencies(request)
    : null;
  if (input.loadSemanticDependencies && !loadedNormalizations) return null;
  const normalizations =
    loadedNormalizations ?? input.semanticDependencies.get(state.taskId);
  if (!normalizations) return null;
  const staticTaskMap = !input.loadSemanticDependencies;
  const belongsToSelectedRoot = (
    rootCriterionId: string | null | undefined,
  ): boolean =>
    !staticTaskMap ||
    rootCriterionId === null ||
    rootCriterionId === undefined ||
    rootCriterionId === state.rootCriterion.rootCriterionId;
  return loadedSemanticDependencies(
    normalizations
      .flatMap((normalization) => normalization.edges)
      .filter((edge) => belongsToSelectedRoot(edge.rootCriterionId)),
    normalizations
      .flatMap((normalization) => normalization.gaps)
      .filter((gap) => belongsToSelectedRoot(gap.rootCriterionId)),
    state,
  );
}

function addPath(
  result: MutableRootResult,
  edges: readonly CausalTraversalPathEdge[],
  certainty: PathCertainty,
  rootDependenceKind: RootDependenceKind,
): void {
  if (edges.length === 0) return;
  const rootCriterionId = result.root.rootCriterion.rootCriterionId;
  const rootTargetFieldId = result.root.rootCriterion.rootTargetFieldId;
  const id = canonicalTraversalPathId(rootCriterionId, rootTargetFieldId, edges);
  result.paths.set(id, {
    pathId: id,
    rootCriterionId,
    rootTargetFieldId,
    rootDependenceKind,
    edges: [...edges],
    pathCertainty: certainty,
  });
  if (isValueRootDependence(rootDependenceKind))
    result.valueCertainties.add(certainty);
  else result.controlCertainties.add(certainty);
}

function addGap(result: MutableRootResult, gap: CausalTraversalGap): void {
  result.gaps.set(gap.gapId, gap);
  if (isValueRootDependence(gap.rootDependenceKind))
    result.valueGapIds.add(gap.gapId);
  else result.controlGapIds.add(gap.gapId);
  if (isValueRootDependence(gap.rootDependenceKind))
    result.valueTruncated.value ||= gap.reasonCode.startsWith("MAX_");
  else result.controlTruncated.value ||= gap.reasonCode.startsWith("MAX_");
}

function limitFor(
  rootDependenceKind: RootDependenceKind,
  options: CausalTraversalOptions,
): {
  readonly states: number;
  readonly paths: number;
  readonly prefix: "VALUE" | "CONTROL";
} {
  return isValueRootDependence(rootDependenceKind)
    ? {
        states: options.maxValueStates,
        paths: options.maxValuePaths,
        prefix: "VALUE",
      }
    : {
        states: options.maxControlStates,
        paths: options.maxControlPaths,
        prefix: "CONTROL",
      };
}

function makeLocalEdge(args: {
  readonly root: CausalTraversalRoot;
  readonly fromSemanticScopeId: string;
  readonly toSemanticScopeId: string;
  readonly fromTaskId: string;
  readonly toTaskId: string;
  readonly fromSubject: SemanticSubject;
  readonly toSubject: SemanticSubject;
  readonly rootDependenceKind: RootDependenceKind;
  readonly localEdgeKind: LocalEdgeKind;
  readonly pathCertainty: PathCertainty;
  readonly dependencyId: string | null;
  readonly evidenceRefs: readonly string[];
  readonly readOccurrenceId?: string;
}): CausalTraversalPathEdge {
  const frontier = frontierKind(args.localEdgeKind);
  const rootCriterionId = args.root.rootCriterion.rootCriterionId;
  const rootTargetFieldId = args.root.rootCriterion.rootTargetFieldId;
  return {
    edgeId: canonicalTraversalEdgeId({
      rootCriterionId,
      fromSemanticScopeId: args.fromSemanticScopeId,
      toSemanticScopeId: args.toSemanticScopeId,
      rootTargetFieldId,
      fromTaskId: args.fromTaskId,
      toTaskId: args.toTaskId,
      fromSubject: args.fromSubject,
      toSubject: args.toSubject,
      rootDependenceKind: args.rootDependenceKind,
      localEdgeKind: args.localEdgeKind,
      dependencyId: args.dependencyId,
      readOccurrenceId: args.readOccurrenceId,
    }),
    rootCriterionId,
    fromSemanticScopeId: args.fromSemanticScopeId,
    toSemanticScopeId: args.toSemanticScopeId,
    fromTaskId: args.fromTaskId,
    toTaskId: args.toTaskId,
    fromSubject: args.fromSubject,
    toSubject: args.toSubject,
    rootDependenceKind: args.rootDependenceKind,
    localEdgeKind: args.localEdgeKind,
    frontierKind: frontier,
    pathCertainty: args.pathCertainty,
    dependencyId: args.dependencyId,
    ...(args.readOccurrenceId === undefined
      ? {}
      : { readOccurrenceId: args.readOccurrenceId }),
    evidenceRefs: sortedUnique(args.evidenceRefs),
  };
}

function initialState(root: CausalTraversalRoot): TraversalSubject {
  return {
    rootCriterion: root.rootCriterion,
    localRootCriterion: root.rootCriterion,
    semanticScope: root.semanticScope,
    taskId: root.rootCriterion.rootTaskId,
    subject: rootSubjectOf(root),
    depth: 0,
    rootDependenceKind: "VALUE_TO_TARGET",
    localEdgeKind: null,
    frontierKind: "VALUE",
    pathCertainty: "CONFIRMED",
    active: new Set(),
    path: [],
  };
}

function createMutableRoot(root: CausalTraversalRoot): MutableRootResult {
  return {
    root,
    visited: new Set(),
    valueVisited: new Set(),
    controlVisited: new Set(),
    activeCycleChecks: { value: 0 },
    frontiers: {
      VALUE: 0,
      EXPRESSION_CONTROL: 0,
      ROWSET_CONTROL: 0,
      WINDOW_CONTEXT: 0,
      RELATION_CONTEXT: 0,
    },
    paths: new Map(),
    gaps: new Map(),
    valueCertainties: new Set(),
    controlCertainties: new Set(),
    valueGapIds: new Set(),
    controlGapIds: new Set(),
    valueTruncated: { value: false },
    controlTruncated: { value: false },
    valuePathsUsed: { value: 0 },
    controlPathsUsed: { value: 0 },
  };
}

function addDependencyGap(
  result: MutableRootResult,
  state: TraversalSubject,
  edge: SemanticDependencyEdge,
  rootDependenceKind: RootDependenceKind,
): void {
  if (edge.pathCertainty !== "UNKNOWN") return;
  addGap(
    result,
    makeGap({
      rootCriterionId: result.root.rootCriterion.rootCriterionId,
      semanticScopeId:
        edge.semanticScopeId ?? state.semanticScope.semanticScopeId,
      rootTargetFieldId: result.root.rootCriterion.rootTargetFieldId,
      taskId: state.taskId,
      subject: edge.fromSubject,
      readOccurrenceId: state.readOccurrenceId,
      rootDependenceKind,
      frontierKind: frontierKind(edge.localEdgeKind),
      reasonCode: "REQUIRED_EVIDENCE_UNRESOLVED",
      message: `required semantic evidence for ${edge.edgeId} is unresolved`,
      evidenceRefs: edge.proofRefs.map((ref) => ref.refId),
    }),
  );
}

function gapIdentity(
  root: CausalTraversalRoot,
  state: TraversalSubject,
): Pick<
  CausalTraversalGap,
  "rootCriterionId" | "semanticScopeId" | "rootTargetFieldId"
> {
  return {
    rootCriterionId: root.rootCriterion.rootCriterionId,
    semanticScopeId: state.semanticScope.semanticScopeId,
    rootTargetFieldId: root.rootCriterion.rootTargetFieldId,
  };
}

function addNormalizerGaps(
  result: MutableRootResult,
  state: TraversalSubject,
  gaps: readonly SemanticDependencyGap[],
): void {
  for (const gap of gaps) {
    addGap(
      result,
      makeGap({
        rootCriterionId: result.root.rootCriterion.rootCriterionId,
        semanticScopeId:
          gap.semanticScopeId ?? state.semanticScope.semanticScopeId,
        rootTargetFieldId: result.root.rootCriterion.rootTargetFieldId,
        taskId: state.taskId,
        subject: gap.subject ?? state.subject,
        readOccurrenceId: state.readOccurrenceId,
        rootDependenceKind: state.rootDependenceKind,
        frontierKind: state.frontierKind,
        reasonCode: "REQUIRED_EVIDENCE_UNRESOLVED",
        message: `semantic normalizer gap ${gap.gapId}: ${gap.message}`,
        evidenceRefs: [
          ...gap.evidenceRefs,
          ...gap.proofRefs.map((ref) => ref.refId),
        ],
      }),
    );
  }
}

function processRoot(
  input: CausalTraversalInput,
  root: CausalTraversalRoot,
  options: CausalTraversalOptions,
  sharedEvidenceRefs: Set<string>,
): MutableRootResult {
  const result = createMutableRoot(root);
  const frontier: TraversalSubject[] = [initialState(root)];

  const expandPhysicalState = (
    state: TraversalSubject,
  ): "NOT_APPLICABLE" | "BLOCKED" | "EXPANDED" | "TERMINAL" => {
    if (
      state.localEdgeKind === null ||
      state.subject.subjectKind !== "PHYSICAL_FIELD"
    )
      return "NOT_APPLICABLE";
    const kind = state.frontierKind;
    const active = new Set([...state.active, activeKey(state)]);
    if (state.readOccurrenceId !== undefined)
      active.add(occurrenceAgnosticActiveKey(state));
    const physicalField =
      input.resolvePhysicalField?.(
        state.subject.physicalFieldId,
        state.taskId,
      ) ?? null;
    if (!input.expandPhysicalField) {
      addGap(
        result,
        makeGap({
          ...gapIdentity(root, state),
          taskId: state.taskId,
          subject: state.subject,
          readOccurrenceId: state.readOccurrenceId,
          rootDependenceKind: state.rootDependenceKind,
          frontierKind: kind,
          reasonCode: "PHYSICAL_EXPANSION_UNAVAILABLE",
          message: "canonical physical-field expansion callback is unavailable",
        }),
      );
      return "BLOCKED";
    }
    if (!physicalField) {
      addGap(
        result,
        makeGap({
          ...gapIdentity(root, state),
          taskId: state.taskId,
          subject: state.subject,
          readOccurrenceId: state.readOccurrenceId,
          rootDependenceKind: state.rootDependenceKind,
          frontierKind: kind,
          reasonCode: "REQUIRED_EVIDENCE_UNRESOLVED",
          message: `physical identity ${state.subject.physicalFieldId} cannot be resolved for canonical expansion`,
        }),
      );
      return "BLOCKED";
    }
    const expansion = input.expandPhysicalField({
      rootCriterion: root.rootCriterion,
      localRootCriterion: state.localRootCriterion,
      semanticScope: state.semanticScope,
      rootTargetFieldId: root.rootCriterion.rootTargetFieldId,
      taskId: state.taskId,
      field: physicalField,
      sourceNodeId: state.path.at(-1)?.edgeId ?? subjectKey(state.subject),
      depth: state.depth,
      maxDepth: options.maxDepth,
      rootDependenceKind: state.rootDependenceKind,
      localEdgeKind: state.localEdgeKind,
      pathCertainty: state.pathCertainty,
      readOccurrenceId: state.readOccurrenceId,
    });
    for (const expansionGap of expansion.gaps) {
      addGap(
        result,
        makeGap({
          ...gapIdentity(root, state),
          taskId: expansionGap.taskId,
          subject: state.subject,
          readOccurrenceId: state.readOccurrenceId,
          rootDependenceKind: state.rootDependenceKind,
          frontierKind: kind,
          reasonCode: expansionGap.reasonCode.startsWith("MAX_DEPTH")
            ? "MAX_DEPTH_REACHED"
            : "REQUIRED_EVIDENCE_UNRESOLVED",
          message: expansionGap.message,
          evidenceRefs: expansionGap.evidenceRefs,
        }),
      );
    }
    if (expansion.ambiguous) return "BLOCKED";
    let expandedProducer = false;
    for (const producer of expansion.producers) {
      const producerCertainty = worstCertainty(
        state.pathCertainty,
        evidenceCertainty(producer.evidenceStatus),
      );
      for (const ref of producer.evidenceRefs) sharedEvidenceRefs.add(ref);
      if (!producer.producerField || !producer.shouldRecurse) continue;
      const bridges =
        producer.bridges.length > 0
          ? producer.bridges
          : producer.bridge
            ? [producer.bridge]
            : [];
      for (const bridge of bridges) {
        const occurrence = bridge.readOccurrence as
          Record<string, unknown> | undefined;
        const occurrenceId =
          typeof occurrence?.occurrenceId === "string"
            ? occurrence.occurrenceId
            : undefined;
        const producerSubject: SemanticSubject = {
          subjectKind: "PHYSICAL_FIELD",
          physicalFieldId: physicalFieldKey(producer.producerField),
        };
        if (!input.resolveProducerScopes) {
          addGap(
            result,
            makeGap({
              ...gapIdentity(root, state),
              taskId: state.taskId,
              subject: producerSubject,
              readOccurrenceId: occurrenceId,
              rootDependenceKind: state.rootDependenceKind,
              frontierKind: "VALUE",
              reasonCode: "PRODUCER_SCOPE_RESOLVER_UNAVAILABLE",
              message: `producer write scope resolver is unavailable for Task ${producer.producerTaskId}`,
              evidenceRefs: producer.evidenceRefs,
            }),
          );
          continue;
        }
        if (producer.producerBindings.length === 0) {
          addGap(
            result,
            makeGap({
              ...gapIdentity(root, state),
              taskId: state.taskId,
              subject: producerSubject,
              readOccurrenceId: occurrenceId,
              rootDependenceKind: state.rootDependenceKind,
              frontierKind: "VALUE",
              reasonCode: "PRODUCER_SCOPE_UNRESOLVED",
              message: `producer Task ${producer.producerTaskId} has no exact output binding`,
              evidenceRefs: producer.evidenceRefs,
            }),
          );
          continue;
        }
        let resolvedScopes: readonly ResolvedProducerScope[];
        try {
          resolvedScopes = input.resolveProducerScopes({
            rootCriterion: root.rootCriterion,
            localRootCriterion: state.localRootCriterion,
            semanticScope: state.semanticScope,
            producerTaskId: producer.producerTaskId,
            producerField: producer.producerField,
            producerBindings: producer.producerBindings,
            readOccurrenceId: occurrenceId,
            evidenceRefs: producer.evidenceRefs,
          });
        } catch {
          resolvedScopes = [];
        }
        const completeScopes = [...resolvedScopes]
          .filter(
            (candidate) =>
              candidate.localRootCriterion.rootTaskId ===
                producer.producerTaskId &&
              candidate.localRootCriterion.rootTargetFieldId ===
                producerSubject.physicalFieldId &&
              isCompleteSemanticOccurrenceScope(
                candidate.semanticScope,
                candidate.localRootCriterion,
              ),
          )
          .sort((left, right) =>
            compareText(
              `${left.localRootCriterion.rootCriterionId}\u0000${left.semanticScope.semanticScopeId}`,
              `${right.localRootCriterion.rootCriterionId}\u0000${right.semanticScope.semanticScopeId}`,
            ),
          );
        const uniqueScopes = completeScopes.filter(
          (candidate, index, all) =>
            index ===
            all.findIndex(
              (other) =>
                other.localRootCriterion.rootCriterionId ===
                  candidate.localRootCriterion.rootCriterionId &&
                other.semanticScope.semanticScopeId ===
                  candidate.semanticScope.semanticScopeId,
            ),
        );
        if (
          resolvedScopes.length === 0 ||
          completeScopes.length !== resolvedScopes.length
        ) {
          addGap(
            result,
            makeGap({
              ...gapIdentity(root, state),
              taskId: state.taskId,
              subject: producerSubject,
              readOccurrenceId: occurrenceId,
              rootDependenceKind: state.rootDependenceKind,
              frontierKind: "VALUE",
              reasonCode: "PRODUCER_SCOPE_UNRESOLVED",
              message: `producer Task ${producer.producerTaskId} output binding did not resolve to complete write scopes`,
              evidenceRefs: producer.evidenceRefs,
            }),
          );
          continue;
        }
        for (const producerScope of uniqueScopes) {
          if (producer.evidenceStatus === "UNRESOLVED")
            addGap(
              result,
              makeGap({
                ...gapIdentity(root, {
                  ...state,
                  localRootCriterion: producerScope.localRootCriterion,
                  semanticScope: producerScope.semanticScope,
                }),
                taskId: producer.producerTaskId,
                subject: producerSubject,
                readOccurrenceId: occurrenceId,
                rootDependenceKind: state.rootDependenceKind,
                frontierKind: "VALUE",
                reasonCode: "REQUIRED_EVIDENCE_UNRESOLVED",
                message: `physical producer bridge ${occurrenceId ?? "without read occurrence"} for Task ${producer.producerTaskId} is unresolved`,
                evidenceRefs: producer.evidenceRefs,
              }),
            );
          const bridgeEdge = makeLocalEdge({
            root,
            fromSemanticScopeId: producerScope.semanticScope.semanticScopeId,
            toSemanticScopeId: state.semanticScope.semanticScopeId,
            fromTaskId: producer.producerTaskId,
            toTaskId: state.taskId,
            fromSubject: producerSubject,
            toSubject: state.subject,
            rootDependenceKind: state.rootDependenceKind,
            localEdgeKind: "VALUE_FLOW",
            pathCertainty: producerCertainty,
            dependencyId: null,
            evidenceRefs: producer.evidenceRefs,
            readOccurrenceId: occurrenceId,
          });
          const pathsUsed = isValueRootDependence(state.rootDependenceKind)
            ? result.valuePathsUsed
            : result.controlPathsUsed;
          const limits = limitFor(state.rootDependenceKind, options);
          if (pathsUsed.value >= limits.paths) {
            addGap(
              result,
              makeGap({
                ...gapIdentity(root, state),
                taskId: state.taskId,
                subject: producerSubject,
                readOccurrenceId: occurrenceId,
                rootDependenceKind: state.rootDependenceKind,
                frontierKind: "VALUE",
                reasonCode: `${limits.prefix === "VALUE" ? "MAX_VALUE" : "MAX_CONTROL"}_PATHS_REACHED`,
                message: `${limits.prefix.toLowerCase()} path budget ${limits.paths} reached before producer bridge`,
                evidenceRefs: producer.evidenceRefs,
              }),
            );
            continue;
          }
          pathsUsed.value += 1;
          const next: TraversalSubject = {
            rootCriterion: root.rootCriterion,
            localRootCriterion: producerScope.localRootCriterion,
            semanticScope: producerScope.semanticScope,
            taskId: producer.producerTaskId,
            subject: producerSubject,
            depth: state.depth + 1,
            rootDependenceKind: state.rootDependenceKind,
            localEdgeKind: "VALUE_FLOW",
            frontierKind: "VALUE",
            pathCertainty: producerCertainty,
            active,
            path: [...state.path, bridgeEdge],
            readOccurrenceId: occurrenceId,
          };
          const hasMaterializedBridge = state.path.some(
            (edge) => edge.fromTaskId !== edge.toTaskId,
          );
          if (
            producer.producerTaskId !== state.taskId ||
            !hasMaterializedBridge
          )
            addPath(
              result,
              next.path,
              producerCertainty,
              state.rootDependenceKind,
            );
          if (
            active.has(activeKey(next)) ||
            (next.readOccurrenceId !== undefined &&
              active.has(occurrenceAgnosticActiveKey(next)))
          ) {
            result.activeCycleChecks.value += 1;
            addGap(
              result,
              makeGap({
                ...gapIdentity(root, next),
                taskId: producer.producerTaskId,
                subject: producerSubject,
                readOccurrenceId: occurrenceId,
                rootDependenceKind: state.rootDependenceKind,
                frontierKind: "VALUE",
                reasonCode: "CYCLE",
                message: `producer bridge cycle detected for ${occurrenceId ?? "unbound occurrence"}`,
                evidenceRefs: producer.evidenceRefs,
              }),
            );
          } else if (next.depth >= options.maxDepth) {
            addGap(
              result,
              makeGap({
                ...gapIdentity(root, next),
                taskId: producer.producerTaskId,
                subject: producerSubject,
                readOccurrenceId: occurrenceId,
                rootDependenceKind: state.rootDependenceKind,
                frontierKind: "VALUE",
                reasonCode: "MAX_DEPTH_REACHED",
                message: `maximum causal traversal depth ${options.maxDepth} reached before producer Task ${producer.producerTaskId}`,
                evidenceRefs: producer.evidenceRefs,
              }),
            );
          } else {
            frontier.push(next);
            expandedProducer = true;
          }
        }
      }
    }
    if (expandedProducer) return "EXPANDED";
    return expansion.producers.length === 0 && expansion.gaps.length === 0
      ? "TERMINAL"
      : "BLOCKED";
  };

  while (frontier.length > 0) {
    frontier.sort(
      (left, right) =>
        left.depth - right.depth ||
        compareText(left.taskId, right.taskId) ||
        compareText(subjectKey(left.subject), subjectKey(right.subject)) ||
        compareText(left.frontierKind, right.frontierKind) ||
        compareText(left.readOccurrenceId ?? "", right.readOccurrenceId ?? ""),
    );
    const state = frontier.shift()!;
    const isNeutralCriterionState =
      state.localEdgeKind === null && state.path.length === 0;
    if (!isNeutralCriterionState) result.frontiers[state.frontierKind] += 1;
    const currentActive = new Set([...state.active, activeKey(state)]);
    if (state.readOccurrenceId !== undefined)
      currentActive.add(occurrenceAgnosticActiveKey(state));
    const currentKey = stateKey(state);
    if (result.visited.has(currentKey)) continue;
    if (!isNeutralCriterionState) {
      const limits = limitFor(state.rootDependenceKind, options);
      const categoryVisited = isValueRootDependence(state.rootDependenceKind)
        ? result.valueVisited
        : result.controlVisited;
      if (categoryVisited.size >= limits.states) {
        addGap(
          result,
          makeGap({
            ...gapIdentity(root, state),
            taskId: state.taskId,
            subject: state.subject,
            readOccurrenceId: state.readOccurrenceId,
            rootDependenceKind: state.rootDependenceKind,
            frontierKind: state.frontierKind,
            reasonCode: `MAX_${limits.prefix}_STATES_REACHED`,
            message: `${limits.prefix.toLowerCase()} traversal state budget ${limits.states} reached`,
          }),
        );
        continue;
      }
      categoryVisited.add(currentKey);
    }
    result.visited.add(currentKey);
    const physicalExpansionState = expandPhysicalState(state);

    const loadedDependencies = normalizationFor(input, state);
    if (loadedDependencies === null) {
      addGap(
        result,
        makeGap({
          ...gapIdentity(root, state),
          taskId: state.taskId,
          subject: state.subject,
          readOccurrenceId: state.readOccurrenceId,
          rootDependenceKind: state.rootDependenceKind,
          frontierKind: state.frontierKind,
          reasonCode: "TASK_SEMANTIC_FACTS_MISSING",
          message: `no semantic dependency normalization is available for ${subjectKey(state.subject)}`,
        }),
      );
      continue;
    }
    if (loadedDependencies.scopeDiscontinuity)
      addGap(
        result,
        makeGap({
          ...gapIdentity(root, state),
          taskId: state.taskId,
          subject: state.subject,
          readOccurrenceId: state.readOccurrenceId,
          rootDependenceKind: state.rootDependenceKind,
          frontierKind: state.frontierKind,
          reasonCode: "SEMANTIC_SCOPE_DISCONTINUITY",
          message: `semantic facts cross the selected root/write scope for ${subjectKey(state.subject)}`,
          evidenceRefs: loadedDependencies.scopeDiscontinuityEvidenceRefs,
        }),
      );
    addNormalizerGaps(result, state, loadedDependencies.gaps);
    const dependencies = loadedDependencies.edges;
    if (
      dependencies.length === 0 &&
      loadedDependencies.gaps.length === 0 &&
      !loadedDependencies.scopeDiscontinuity &&
      physicalExpansionState !== "TERMINAL" &&
      state.relationTerminalObserved !== true
    ) {
      addGap(
        result,
        makeGap({
          ...gapIdentity(root, state),
          taskId: state.taskId,
          subject: state.subject,
          readOccurrenceId: state.readOccurrenceId,
          rootDependenceKind: state.rootDependenceKind,
          frontierKind: state.frontierKind,
          reasonCode: "SEMANTIC_SUBJECT_DEPENDENCY_MISSING",
          message: `semantic facts do not contain a dependency targeting ${subjectKey(state.subject)}`,
        }),
      );
      continue;
    }
    for (const dependency of dependencies) {
      for (const ref of dependency.proofRefs.map((proofRef) => proofRef.refId))
        sharedEvidenceRefs.add(ref);
      const nextRootDependenceKind = propagatedRootDependenceKind(
        state.rootDependenceKind,
        dependency.rootDependenceKind,
      );
      addDependencyGap(result, state, dependency, nextRootDependenceKind);
      const nextCertainty = worstCertainty(
        state.pathCertainty,
        dependency.pathCertainty,
      );
      const localKind = dependency.localEdgeKind;
      const nextKind = frontierKind(localKind);
      const dependencyScope = dependency.semanticScope!;
      const edge = makeLocalEdge({
        root,
        fromSemanticScopeId: dependencyScope.semanticScopeId,
        toSemanticScopeId: dependencyScope.semanticScopeId,
        fromTaskId: state.taskId,
        toTaskId: state.taskId,
        fromSubject: dependency.fromSubject,
        toSubject: dependency.toSubject,
        rootDependenceKind: nextRootDependenceKind,
        localEdgeKind: localKind,
        pathCertainty: nextCertainty,
        dependencyId: dependency.dependencyId,
        evidenceRefs: dependency.proofRefs.map((ref) => ref.refId),
        readOccurrenceId: state.readOccurrenceId,
      });
      const path = [...state.path, edge];
      const dependencyLimits = limitFor(nextRootDependenceKind, options);
      const pathsUsed = isValueRootDependence(nextRootDependenceKind)
        ? result.valuePathsUsed
        : result.controlPathsUsed;
      if (pathsUsed.value >= dependencyLimits.paths) {
        addGap(
          result,
          makeGap({
            ...gapIdentity(root, {
              ...state,
              semanticScope: dependencyScope,
            }),
            taskId: state.taskId,
            subject: dependency.fromSubject,
            readOccurrenceId: state.readOccurrenceId,
            rootDependenceKind: nextRootDependenceKind,
            frontierKind: nextKind,
            reasonCode: `MAX_${dependencyLimits.prefix}_PATHS_REACHED`,
            message: `${dependencyLimits.prefix.toLowerCase()} path budget ${dependencyLimits.paths} reached`,
            evidenceRefs: dependency.proofRefs.map((ref) => ref.refId),
          }),
        );
        continue;
      }
      pathsUsed.value += 1;
      for (const ref of dependency.proofRefs.map((proofRef) => proofRef.refId))
        sharedEvidenceRefs.add(ref);
      if (state.path.length === 0) {
        // The direct semantic edge itself is a completed path to the target;
        // keep it even when its source is fieldless relation context.
        addPath(result, path, nextCertainty, nextRootDependenceKind);
      }
      const next: TraversalSubject = {
        rootCriterion: root.rootCriterion,
        localRootCriterion: state.localRootCriterion,
        semanticScope: dependencyScope,
        taskId: state.taskId,
        subject: dependency.fromSubject,
        depth: state.depth,
        rootDependenceKind: nextRootDependenceKind,
        localEdgeKind: localKind,
        frontierKind: nextKind,
        pathCertainty: nextCertainty,
        active: currentActive,
        path,
        readOccurrenceId: state.readOccurrenceId,
      };
      if (
        currentActive.has(activeKey(next)) ||
        (next.readOccurrenceId !== undefined &&
          currentActive.has(occurrenceAgnosticActiveKey(next)))
      ) {
        result.activeCycleChecks.value += 1;
        addGap(
          result,
          makeGap({
            ...gapIdentity(root, next),
            taskId: state.taskId,
            subject: dependency.fromSubject,
            readOccurrenceId: state.readOccurrenceId,
            rootDependenceKind: nextRootDependenceKind,
            frontierKind: nextKind,
            reasonCode: "CYCLE",
            message: `causal traversal cycle detected at ${subjectKey(dependency.fromSubject)}`,
            evidenceRefs: dependency.proofRefs.map((ref) => ref.refId),
          }),
        );
        continue;
      }
      if (next.depth >= options.maxDepth) {
        addGap(
          result,
          makeGap({
            ...gapIdentity(root, next),
            taskId: state.taskId,
            subject: dependency.fromSubject,
            readOccurrenceId: state.readOccurrenceId,
            rootDependenceKind: nextRootDependenceKind,
            frontierKind: nextKind,
            reasonCode: "MAX_DEPTH_REACHED",
            message: `maximum causal traversal depth ${options.maxDepth} reached`,
            evidenceRefs: dependency.proofRefs.map((ref) => ref.refId),
          }),
        );
        continue;
      }
      if (dependency.fromSubject.subjectKind === "RELATION_OCCURRENCE") {
        if (!input.expandRelationOccurrence) {
          addGap(
            result,
            makeGap({
              ...gapIdentity(root, next),
              taskId: state.taskId,
              subject: dependency.fromSubject,
              readOccurrenceId: state.readOccurrenceId,
              rootDependenceKind: nextRootDependenceKind,
              frontierKind: nextKind,
              reasonCode: "RELATION_EXPANSION_UNAVAILABLE",
              message: `canonical relation occurrence expansion is unavailable for ${dependency.fromSubject.relationOccurrenceId}`,
              evidenceRefs: dependency.proofRefs.map((ref) => ref.refId),
            }),
          );
          continue;
        }
        const relationExpansion = input.expandRelationOccurrence({
          rootCriterion: root.rootCriterion,
          localRootCriterion: state.localRootCriterion,
          semanticScope: dependencyScope,
          rootTargetFieldId: root.rootCriterion.rootTargetFieldId,
          taskId: state.taskId,
          relationOccurrenceId: dependency.fromSubject.relationOccurrenceId,
          depth: next.depth,
          maxDepth: options.maxDepth,
          rootDependenceKind: nextRootDependenceKind,
          pathCertainty: nextCertainty,
        });
        for (const gap of relationExpansion.gaps ?? []) {
          if (
            gap.rootCriterionId === root.rootCriterion.rootCriterionId &&
            gap.semanticScopeId === dependencyScope.semanticScopeId
          ) {
            addGap(result, gap);
            continue;
          }
          addGap(
            result,
            makeGap({
              ...gapIdentity(root, next),
              taskId: state.taskId,
              subject: dependency.fromSubject,
              readOccurrenceId: state.readOccurrenceId,
              rootDependenceKind: nextRootDependenceKind,
              frontierKind: "RELATION_CONTEXT",
              reasonCode: "SEMANTIC_SCOPE_DISCONTINUITY",
              message: `relation expansion returned a gap outside root ${root.rootCriterion.rootCriterionId}`,
              evidenceRefs: gap.evidenceRefs,
            }),
          );
        }
        for (const ref of relationExpansion.evidenceRefs ?? [])
          sharedEvidenceRefs.add(ref);
        for (const bridge of relationExpansion.relationBridges ?? []) {
          const bridgeCertainty = worstCertainty(
            nextCertainty,
            evidenceCertainty(bridge.evidenceStatus),
          );
          const bridgeRefs = sortedUnique([
            ...dependency.proofRefs.map((ref) => ref.refId),
            ...(bridge.evidenceRefs ?? []),
            ...(bridge.producerRootCriterion?.evidenceRefs ?? []),
            ...(bridge.producerSemanticScope?.evidenceRefs ?? []),
          ]);
          for (const ref of bridgeRefs) sharedEvidenceRefs.add(ref);
          if (
            !bridge.producerRootCriterion ||
            bridge.producerRootCriterion.rootTaskId !== bridge.producerTaskId ||
            !isCompleteSemanticOccurrenceScope(
              bridge.producerSemanticScope,
              bridge.producerRootCriterion,
            )
          ) {
            addGap(
              result,
              makeGap({
                ...gapIdentity(root, next),
                taskId: state.taskId,
                subject: dependency.fromSubject,
                readOccurrenceId: bridge.readOccurrenceId,
                rootDependenceKind: nextRootDependenceKind,
                frontierKind: "RELATION_CONTEXT",
                reasonCode: "PRODUCER_SCOPE_UNRESOLVED",
                message: `relation producer bridge ${bridge.readOccurrenceId} has no complete producer write scope`,
                evidenceRefs: bridgeRefs,
              }),
            );
            continue;
          }
          const producerSemanticScope = bridge.producerSemanticScope;
          const bridgeEdge = makeLocalEdge({
            root,
            fromSemanticScopeId: producerSemanticScope.semanticScopeId,
            toSemanticScopeId: dependencyScope.semanticScopeId,
            fromTaskId: bridge.producerTaskId,
            toTaskId: state.taskId,
            // A relation-level bridge has no producer-side column identity.
            // The read occurrence and table-multi-hop evidence identify the
            // boundary; retaining the same relation subject on both sides
            // keeps the path continuity check explicit and lossless.
            fromSubject: dependency.fromSubject,
            toSubject: dependency.fromSubject,
            rootDependenceKind: nextRootDependenceKind,
            localEdgeKind: "RELATION_CONTEXT",
            pathCertainty: bridgeCertainty,
            dependencyId: null,
            evidenceRefs: bridgeRefs,
            readOccurrenceId: bridge.readOccurrenceId,
          });
          const pathsUsed = isValueRootDependence(nextRootDependenceKind)
            ? result.valuePathsUsed
            : result.controlPathsUsed;
          const limits = limitFor(nextRootDependenceKind, options);
          if (pathsUsed.value >= limits.paths) {
            addGap(
              result,
              makeGap({
                ...gapIdentity(root, next),
                taskId: state.taskId,
                subject: dependency.fromSubject,
                readOccurrenceId: bridge.readOccurrenceId,
                rootDependenceKind: nextRootDependenceKind,
                frontierKind: "RELATION_CONTEXT",
                reasonCode: `${limits.prefix === "VALUE" ? "MAX_VALUE" : "MAX_CONTROL"}_PATHS_REACHED`,
                message: `${limits.prefix.toLowerCase()} path budget ${limits.paths} reached before relation producer bridge`,
                evidenceRefs: bridgeRefs,
              }),
            );
            continue;
          }
          pathsUsed.value += 1;
          addPath(
            result,
            [...next.path, bridgeEdge],
            bridgeCertainty,
            nextRootDependenceKind,
          );
          addGap(
            result,
            makeGap({
              ...gapIdentity(root, {
                ...next,
                localRootCriterion: bridge.producerRootCriterion,
                semanticScope: producerSemanticScope,
              }),
              taskId: bridge.producerTaskId,
              subject: dependency.fromSubject,
              readOccurrenceId: bridge.readOccurrenceId,
              rootDependenceKind: nextRootDependenceKind,
              frontierKind: "RELATION_CONTEXT",
              reasonCode: "PRODUCER_RELATION_FRONTIER_UNEXPANDED",
              message: `relation producer bridge ${bridge.readOccurrenceId} has no producer-side relation frontier to continue`,
              evidenceRefs: bridgeRefs,
            }),
          );
          if (bridgeCertainty === "UNKNOWN")
            addGap(
              result,
              makeGap({
                ...gapIdentity(root, {
                  ...next,
                  localRootCriterion: bridge.producerRootCriterion,
                  semanticScope: producerSemanticScope,
                }),
                taskId: bridge.producerTaskId,
                subject: dependency.fromSubject,
                readOccurrenceId: bridge.readOccurrenceId,
                rootDependenceKind: nextRootDependenceKind,
                frontierKind: "RELATION_CONTEXT",
                reasonCode: "REQUIRED_EVIDENCE_UNRESOLVED",
                message: `relation producer bridge for ${bridge.readOccurrenceId} is unresolved`,
                evidenceRefs: bridgeRefs,
              }),
            );
        }
        for (const occurrence of relationExpansion.relationOccurrences ?? []) {
          const crossesTask = occurrence.taskId !== state.taskId;
          if (crossesTask) {
            const exactBridge = (relationExpansion.relationBridges ?? []).some(
              (bridge) =>
                bridge.producerTaskId === occurrence.taskId &&
                bridge.readOccurrenceId.length > 0 &&
                bridge.producerRootCriterion?.rootCriterionId ===
                  occurrence.producerRootCriterion?.rootCriterionId &&
                bridge.producerSemanticScope?.semanticScopeId ===
                  occurrence.producerSemanticScope?.semanticScopeId,
            );
            if (!exactBridge)
              addGap(
                result,
                makeGap({
                  ...gapIdentity(root, next),
                  taskId: state.taskId,
                  subject: dependency.fromSubject,
                  readOccurrenceId: state.readOccurrenceId,
                  rootDependenceKind: nextRootDependenceKind,
                  frontierKind: "RELATION_CONTEXT",
                  reasonCode: "PRODUCER_SCOPE_UNRESOLVED",
                  message: `cross-task relation occurrence ${occurrence.relationOccurrenceId} requires an occurrence-exact relation bridge`,
                  evidenceRefs: occurrence.evidenceRefs,
                }),
              );
            // A matching relation bridge was already materialized above.  The
            // occurrence record is only a local relation expansion and must
            // never switch Task/scope without its own dual-scope path edge.
            continue;
          }
          const occurrenceLocalRoot = crossesTask
            ? occurrence.producerRootCriterion
            : state.localRootCriterion;
          const occurrenceScope = crossesTask
            ? occurrence.producerSemanticScope
            : occurrence.localRelationId
              ? semanticScopeForRelation(
                  dependencyScope,
                  occurrence.localRelationId,
                  occurrence.evidenceRefs,
                )
              : undefined;
          if (
            !occurrenceLocalRoot ||
            occurrenceLocalRoot.rootTaskId !== occurrence.taskId ||
            !isCompleteSemanticOccurrenceScope(
              occurrenceScope,
              occurrenceLocalRoot,
            )
          ) {
            addGap(
              result,
              makeGap({
                ...gapIdentity(root, next),
                taskId: state.taskId,
                subject: dependency.fromSubject,
                readOccurrenceId: state.readOccurrenceId,
                rootDependenceKind: nextRootDependenceKind,
                frontierKind: "RELATION_CONTEXT",
                reasonCode: "PRODUCER_SCOPE_UNRESOLVED",
                message: `relation occurrence ${occurrence.relationOccurrenceId} has no complete local write scope`,
                evidenceRefs: occurrence.evidenceRefs,
              }),
            );
            continue;
          }
          const occurrenceCertainty = worstCertainty(
            nextCertainty,
            evidenceCertainty(occurrence.evidenceStatus),
          );
          const nextRelation: TraversalSubject = {
            rootCriterion: root.rootCriterion,
            localRootCriterion: occurrenceLocalRoot,
            semanticScope: occurrenceScope,
            taskId: occurrence.taskId,
            subject: {
              subjectKind: "RELATION_OCCURRENCE",
              relationOccurrenceId: occurrence.relationOccurrenceId,
            },
            depth: next.depth,
            rootDependenceKind: nextRootDependenceKind,
            localEdgeKind: "RELATION_CONTEXT",
            frontierKind: "RELATION_CONTEXT",
            pathCertainty: occurrenceCertainty,
            active: currentActive,
            path: next.path,
            readOccurrenceId: state.readOccurrenceId,
            relationTerminalObserved: true,
          };
          if (!currentActive.has(activeKey(nextRelation)))
            frontier.push(nextRelation);
        }
        if (
          (relationExpansion.relationBridges?.length ?? 0) === 0 &&
          (relationExpansion.relationOccurrences?.length ?? 0) === 0 &&
          (relationExpansion.gaps?.length ?? 0) === 0
        ) {
          addGap(
            result,
            makeGap({
              ...gapIdentity(root, next),
              taskId: state.taskId,
              subject: dependency.fromSubject,
              readOccurrenceId: state.readOccurrenceId,
              rootDependenceKind: nextRootDependenceKind,
              frontierKind: nextKind,
              reasonCode: "RELATION_EXPANSION_UNAVAILABLE",
              message: `relation occurrence ${dependency.fromSubject.relationOccurrenceId} produced no exact upstream bridge`,
              evidenceRefs: dependency.proofRefs.map((ref) => ref.refId),
            }),
          );
        }
        continue;
      }
      // Physical fields are expanded when their state is dequeued. This
      // ensures a producer field is recursively expanded even when its
      // producer Task has no further local semantic edge for this criterion.
      if (dependency.fromSubject.subjectKind === "PHYSICAL_FIELD") {
        frontier.push(next);
        continue;
      }
    }
  }
  return result;
}

function finalizeRoot(result: MutableRootResult): CausalTraversalRootResult {
  const valueCertainty =
    [...result.valueCertainties].sort(
      (left, right) => certaintyRank(right) - certaintyRank(left),
    )[0] ?? null;
  const controlCertainty =
    [...result.controlCertainties].sort(
      (left, right) => certaintyRank(right) - certaintyRank(left),
    )[0] ?? null;
  const gaps = [...result.gaps.values()].sort((left, right) =>
    left.gapId.localeCompare(right.gapId),
  );
  const paths = [...result.paths.values()].sort((left, right) =>
    left.pathId.localeCompare(right.pathId),
  );
  return {
    rootCriterionId: result.root.rootCriterion.rootCriterionId,
    root: result.root,
    visitedStateKeys: [...result.visited].sort(compareText),
    activeCycleChecks: result.activeCycleChecks.value,
    frontiers: result.frontiers,
    paths,
    gaps,
    decision: {
      valuePathCertainty: valueCertainty,
      controlPathCertainty: controlCertainty,
      // A branch is closed only when its frontier drained without a budget
      // truncation. This is path state, not a final unrelated assessment.
      valueClosed:
        result.valueGapIds.size === 0 && !result.valueTruncated.value,
      controlClosed:
        result.controlGapIds.size === 0 && !result.controlTruncated.value,
      valueGapIds: [...result.valueGapIds].sort(compareText),
      controlGapIds: [...result.controlGapIds].sort(compareText),
    },
  };
}

export function traverseCausalDependencies(
  input: CausalTraversalInput,
): CausalTraversalResult {
  const options = optionsOf(input.options);
  for (const root of input.roots)
    if (
      !isCompleteSemanticOccurrenceScope(root.semanticScope, root.rootCriterion)
    )
      throw new Error(
        `INVALID_CAUSAL_TRAVERSAL_ROOT_SCOPE:${root.rootCriterion.rootCriterionId}`,
      );
  const sharedEvidenceRefs = new Set<string>();
  const mutableRoots = [...input.roots]
    .sort((left, right) =>
      compareText(
        left.rootCriterion.rootCriterionId,
        right.rootCriterion.rootCriterionId,
      ),
    )
    .map((root) => processRoot(input, root, options, sharedEvidenceRefs));
  const roots = mutableRoots.map(finalizeRoot);
  const edges = roots
    .flatMap((root) => root.paths.flatMap((path) => path.edges))
    .sort((left, right) => left.edgeId.localeCompare(right.edgeId))
    .filter(
      (edge, index, all) =>
        index ===
        all.findIndex((candidate) => candidate.edgeId === edge.edgeId),
    );
  const gaps = roots
    .flatMap((root) => root.gaps)
    .sort((left, right) => left.gapId.localeCompare(right.gapId))
    .filter(
      (gap, index, all) =>
        index === all.findIndex((candidate) => candidate.gapId === gap.gapId),
    );
  return {
    options,
    roots,
    sharedEvidenceRefs: [...sharedEvidenceRefs].sort(compareText),
    edges,
    gaps,
  };
}

/** Compatibility-friendly alias for callers using the noun first. */
export const runCausalTraversal = traverseCausalDependencies;

/**
 * Keep the canonical adapter's return type visible to integration code while
 * leaving construction of the full physical identity to that integration
 * boundary. This is intentionally not a resolver or a field-name heuristic.
 */
export type CanonicalPhysicalExpansion = PhysicalFieldExpansion;
