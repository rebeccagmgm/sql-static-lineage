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
  type LocalEdgeKind,
  type PathCertainty,
  type RootDependenceKind,
  type SemanticDependencyEdge,
  type SemanticSubject,
} from "./semantic-dependency-contract.ts";
import type { SemanticDependencyNormalization } from "./semantic-dependency-normalizer.ts";

export const TRAVERSAL_FRONTIER_KINDS = [
  "VALUE",
  "EXPRESSION_CONTROL",
  "ROWSET_CONTROL",
  "WINDOW_CONTEXT",
  "RELATION_CONTEXT",
] as const;
export type TraversalFrontierKind = (typeof TRAVERSAL_FRONTIER_KINDS)[number];

export interface CausalTraversalRoot {
  readonly rootTargetFieldId: string;
  readonly taskId: string;
  readonly subject?: SemanticSubject;
}

export interface PhysicalFieldTraversalRequest {
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
  readonly rootTargetFieldId: string;
  readonly taskId: string;
  readonly relationOccurrenceId: string;
  readonly depth: number;
  readonly maxDepth: number;
  readonly rootDependenceKind: RootDependenceKind;
  readonly pathCertainty: PathCertainty;
}

export interface RelationTraversalExpansion {
  readonly relationOccurrences?: readonly {
    readonly taskId: string;
    readonly relationOccurrenceId: string;
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
    taskId: string,
    subject: SemanticSubject,
  ) => readonly SemanticDependencyNormalization[] | null;
  /** Fast path for large multi-root runs; returns only edges targeting the subject. */
  readonly loadSemanticEdges?: (
    taskId: string,
    subject: SemanticSubject,
  ) => readonly SemanticDependencyEdge[] | null;
  /** The canonical adapter-backed physical expansion callback. */
  readonly expandPhysicalField?: (
    request: PhysicalFieldTraversalRequest,
  ) => PhysicalFieldExpansion;
  /** Resolve a canonical identity; absence is an unresolved boundary. */
  readonly resolvePhysicalField?: (
    physicalFieldId: string,
    taskId: string,
  ) => PhysicalFieldIdentity | null;
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
    | "MAX_CONTROL_PATHS_REACHED";
  readonly message: string;
  readonly evidenceRefs: readonly string[];
  readonly blocksNegativeProof: true;
}

export interface CausalTraversalPathEdge {
  readonly edgeId: string;
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

function frontierKind(localEdgeKind: LocalEdgeKind | null): TraversalFrontierKind {
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
      physicalFieldId: root.rootTargetFieldId,
    }
  );
}

function stateKey(state: TraversalSubject): string {
  return canonicalJson({
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
    taskId: state.taskId,
    subject: state.subject,
    rootDependenceKind: state.rootDependenceKind,
    localEdgeKind: state.localEdgeKind,
    frontierKind: state.frontierKind,
  });
}

function edgeId(input: {
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

function pathId(
  rootTargetFieldId: string,
  edges: readonly CausalTraversalPathEdge[],
): string {
  return `causal-path:${sha256(
    canonicalJson({ rootTargetFieldId, edgeIds: edges.map((edge) => edge.edgeId) }),
  )}`;
}

function makeGap(input: {
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
    gapId: `causal-gap:${sha256(
      canonicalJson({
        rootTargetFieldId: input.rootTargetFieldId,
        taskId: input.taskId,
        subject: input.subject,
        readOccurrenceId: input.readOccurrenceId ?? null,
        rootDependenceKind: input.rootDependenceKind,
        frontierKind: input.frontierKind,
        reasonCode: input.reasonCode,
        message: input.message,
        evidenceRefs,
      }),
    )}`,
    evidenceRefs,
    blocksNegativeProof: true,
  };
}

function normalizationFor(
  input: CausalTraversalInput,
  taskId: string,
  subject: SemanticSubject,
): readonly SemanticDependencyEdge[] | null {
  if (input.loadSemanticEdges) {
    const edges = input.loadSemanticEdges(taskId, subject);
    return edges === null
      ? null
      : [...edges].sort((left, right) => left.edgeId.localeCompare(right.edgeId));
  }
  const normalizations = input.loadSemanticDependencies
    ? input.loadSemanticDependencies(taskId, subject)
    : input.semanticDependencies.get(taskId);
  if (!normalizations || normalizations.length === 0) return null;
  return normalizations
    .flatMap((normalization) => normalization.edges)
    .filter((edge) => sameSubject(edge.toSubject, subject))
    .sort((left, right) => left.edgeId.localeCompare(right.edgeId));
}

function addPath(
  result: MutableRootResult,
  rootTargetFieldId: string,
  edges: readonly CausalTraversalPathEdge[],
  certainty: PathCertainty,
  rootDependenceKind: RootDependenceKind,
): void {
  if (edges.length === 0) return;
  const id = pathId(rootTargetFieldId, edges);
  result.paths.set(id, {
    pathId: id,
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
  if (isValueRootDependence(gap.rootDependenceKind)) result.valueGapIds.add(gap.gapId);
  else result.controlGapIds.add(gap.gapId);
  if (isValueRootDependence(gap.rootDependenceKind)) result.valueTruncated.value ||= gap.reasonCode.startsWith("MAX_");
  else result.controlTruncated.value ||= gap.reasonCode.startsWith("MAX_");
}

function limitFor(
  rootDependenceKind: RootDependenceKind,
  options: CausalTraversalOptions,
): { readonly states: number; readonly paths: number; readonly prefix: "VALUE" | "CONTROL" } {
  return isValueRootDependence(rootDependenceKind)
    ? { states: options.maxValueStates, paths: options.maxValuePaths, prefix: "VALUE" }
    : { states: options.maxControlStates, paths: options.maxControlPaths, prefix: "CONTROL" };
}

function makeLocalEdge(args: {
  readonly root: CausalTraversalRoot;
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
  return {
    edgeId: edgeId({
      rootTargetFieldId: args.root.rootTargetFieldId,
      fromTaskId: args.fromTaskId,
      toTaskId: args.toTaskId,
      fromSubject: args.fromSubject,
      toSubject: args.toSubject,
      rootDependenceKind: args.rootDependenceKind,
      localEdgeKind: args.localEdgeKind,
      dependencyId: args.dependencyId,
      readOccurrenceId: args.readOccurrenceId,
    }),
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
    taskId: root.taskId,
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
      rootTargetFieldId: result.root.rootTargetFieldId,
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
    if (state.localEdgeKind === null || state.subject.subjectKind !== "PHYSICAL_FIELD")
      return "NOT_APPLICABLE";
    const kind = state.frontierKind;
    const active = new Set([...state.active, activeKey(state)]);
    if (state.readOccurrenceId !== undefined)
      active.add(occurrenceAgnosticActiveKey(state));
    const physicalField = input.resolvePhysicalField?.(
      state.subject.physicalFieldId,
      state.taskId,
    ) ?? null;
    if (!input.expandPhysicalField) {
      addGap(result, makeGap({
        rootTargetFieldId: root.rootTargetFieldId,
        taskId: state.taskId,
        subject: state.subject,
        readOccurrenceId: state.readOccurrenceId,
        rootDependenceKind: state.rootDependenceKind,
        frontierKind: kind,
        reasonCode: "PHYSICAL_EXPANSION_UNAVAILABLE",
        message: "canonical physical-field expansion callback is unavailable",
      }));
      return "BLOCKED";
    }
    if (!physicalField) {
      addGap(result, makeGap({
        rootTargetFieldId: root.rootTargetFieldId,
        taskId: state.taskId,
        subject: state.subject,
        readOccurrenceId: state.readOccurrenceId,
        rootDependenceKind: state.rootDependenceKind,
        frontierKind: kind,
        reasonCode: "REQUIRED_EVIDENCE_UNRESOLVED",
        message: `physical identity ${state.subject.physicalFieldId} cannot be resolved for canonical expansion`,
      }));
      return "BLOCKED";
    }
    const expansion = input.expandPhysicalField({
      rootTargetFieldId: root.rootTargetFieldId,
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
      addGap(result, makeGap({
        rootTargetFieldId: root.rootTargetFieldId,
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
      }));
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
      const bridges = producer.bridges.length > 0
        ? producer.bridges
        : producer.bridge
          ? [producer.bridge]
          : [];
      for (const bridge of bridges) {
        const occurrence = bridge.readOccurrence as Record<string, unknown> | undefined;
        const occurrenceId = typeof occurrence?.occurrenceId === "string"
          ? occurrence.occurrenceId
          : undefined;
        const producerSubject: SemanticSubject = {
          subjectKind: "PHYSICAL_FIELD",
          physicalFieldId: physicalFieldKey(producer.producerField),
        };
        const bridgeEdge = makeLocalEdge({
          root,
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
          addGap(result, makeGap({
            rootTargetFieldId: root.rootTargetFieldId,
            taskId: state.taskId,
            subject: producerSubject,
            readOccurrenceId: occurrenceId,
            rootDependenceKind: state.rootDependenceKind,
            frontierKind: "VALUE",
            reasonCode: `${limits.prefix === "VALUE" ? "MAX_VALUE" : "MAX_CONTROL"}_PATHS_REACHED`,
            message: `${limits.prefix.toLowerCase()} path budget ${limits.paths} reached before producer bridge`,
            evidenceRefs: producer.evidenceRefs,
          }));
          continue;
        }
        pathsUsed.value += 1;
        const next: TraversalSubject = {
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
        if (producer.producerTaskId !== state.taskId || !hasMaterializedBridge)
          addPath(
            result,
            root.rootTargetFieldId,
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
          addGap(result, makeGap({
            rootTargetFieldId: root.rootTargetFieldId,
            taskId: producer.producerTaskId,
            subject: producerSubject,
            readOccurrenceId: occurrenceId,
            rootDependenceKind: state.rootDependenceKind,
            frontierKind: "VALUE",
            reasonCode: "CYCLE",
            message: `producer bridge cycle detected for ${occurrenceId ?? "unbound occurrence"}`,
            evidenceRefs: producer.evidenceRefs,
          }));
        } else if (next.depth >= options.maxDepth) {
          addGap(result, makeGap({
            rootTargetFieldId: root.rootTargetFieldId,
            taskId: producer.producerTaskId,
            subject: producerSubject,
            readOccurrenceId: occurrenceId,
            rootDependenceKind: state.rootDependenceKind,
            frontierKind: "VALUE",
            reasonCode: "MAX_DEPTH_REACHED",
            message: `maximum causal traversal depth ${options.maxDepth} reached before producer Task ${producer.producerTaskId}`,
            evidenceRefs: producer.evidenceRefs,
          }));
        } else {
          frontier.push(next);
          expandedProducer = true;
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
            rootTargetFieldId: root.rootTargetFieldId,
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

    const dependencies = normalizationFor(input, state.taskId, state.subject);
    if (dependencies === null) {
      addGap(
        result,
        makeGap({
          rootTargetFieldId: root.rootTargetFieldId,
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
    if (
      dependencies.length === 0 &&
      physicalExpansionState !== "TERMINAL" &&
      state.relationTerminalObserved !== true
    ) {
      addGap(
        result,
        makeGap({
          rootTargetFieldId: root.rootTargetFieldId,
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
      const nextCertainty = worstCertainty(state.pathCertainty, dependency.pathCertainty);
      const localKind = dependency.localEdgeKind;
      const nextKind = frontierKind(localKind);
      const edge = makeLocalEdge({
        root,
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
            rootTargetFieldId: root.rootTargetFieldId,
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
        addPath(
          result,
          root.rootTargetFieldId,
          path,
          nextCertainty,
          nextRootDependenceKind,
        );
      }
      const next: TraversalSubject = {
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
            rootTargetFieldId: root.rootTargetFieldId,
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
            rootTargetFieldId: root.rootTargetFieldId,
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
              rootTargetFieldId: root.rootTargetFieldId,
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
          rootTargetFieldId: root.rootTargetFieldId,
          taskId: state.taskId,
          relationOccurrenceId: dependency.fromSubject.relationOccurrenceId,
          depth: next.depth,
          maxDepth: options.maxDepth,
          rootDependenceKind: nextRootDependenceKind,
          pathCertainty: nextCertainty,
        });
        for (const gap of relationExpansion.gaps ?? []) addGap(result, gap);
        for (const ref of relationExpansion.evidenceRefs ?? []) sharedEvidenceRefs.add(ref);
        for (const occurrence of relationExpansion.relationOccurrences ?? []) {
          const occurrenceCertainty = worstCertainty(
            nextCertainty,
            evidenceCertainty(occurrence.evidenceStatus),
          );
          const nextRelation: TraversalSubject = {
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
          if (!currentActive.has(activeKey(nextRelation))) frontier.push(nextRelation);
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
  const valueCertainty = [...result.valueCertainties].sort(
    (left, right) => certaintyRank(right) - certaintyRank(left),
  )[0] ?? null;
  const controlCertainty = [...result.controlCertainties].sort(
    (left, right) => certaintyRank(right) - certaintyRank(left),
  )[0] ?? null;
  const gaps = [...result.gaps.values()].sort((left, right) => left.gapId.localeCompare(right.gapId));
  const paths = [...result.paths.values()].sort((left, right) => left.pathId.localeCompare(right.pathId));
  return {
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
      valueClosed: result.valueGapIds.size === 0 && !result.valueTruncated.value,
      controlClosed: result.controlGapIds.size === 0 && !result.controlTruncated.value,
      valueGapIds: [...result.valueGapIds].sort(compareText),
      controlGapIds: [...result.controlGapIds].sort(compareText),
    },
  };
}

export function traverseCausalDependencies(
  input: CausalTraversalInput,
): CausalTraversalResult {
  const options = optionsOf(input.options);
  const sharedEvidenceRefs = new Set<string>();
  const mutableRoots = [...input.roots]
    .sort((left, right) =>
      compareText(left.rootTargetFieldId, right.rootTargetFieldId) ||
      compareText(left.taskId, right.taskId),
    )
    .map((root) => processRoot(input, root, options, sharedEvidenceRefs));
  const roots = mutableRoots.map(finalizeRoot);
  const edges = roots
    .flatMap((root) => root.paths.flatMap((path) => path.edges))
    .sort((left, right) => left.edgeId.localeCompare(right.edgeId))
    .filter((edge, index, all) => index === all.findIndex((candidate) => candidate.edgeId === edge.edgeId));
  const gaps = roots
    .flatMap((root) => root.gaps)
    .sort((left, right) => left.gapId.localeCompare(right.gapId))
    .filter((gap, index, all) => index === all.findIndex((candidate) => candidate.gapId === gap.gapId));
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
