import type {
  DifferentialObservation,
  PlanFactsRelRequest,
  DifferentialResponse,
} from "../../../calcite-differential/protocol.ts";
import type {
  PlanFactsRelNode,
  RelOutputField,
  RelTypedExpression,
} from "../../../calcite-differential/plan-facts-rel-contract.ts";
import {
  createProofRef,
  makeSemanticDependencyApplication,
  makeSemanticDependencyDefinition,
  makeSemanticDependencyEdge,
  type EffectKind,
  type LocalEdgeKind,
  type OperatorKind,
  type ProofRef,
  type RootDependenceKind,
  type SemanticDependencyApplication,
  type SemanticDependencyDefinition,
  type SemanticDependencyEdge,
  type SemanticSubject,
} from "./semantic-dependency-contract.ts";
import type { SemanticDependencyNormalization } from "./semantic-dependency-normalizer.ts";

/**
 * Calcite observations are converted into evidence objects, not treated as a
 * second canonical lineage graph.  The request remains the Native-owned
 * identity boundary and every emitted object points back to its mapping and
 * source evidence.
 */
export type CalciteCausalEvidenceStatus =
  | "MAPPED"
  | "NOT_EVALUATED"
  | "UNMAPPABLE";

export interface CalciteCausalEvidenceGap {
  readonly gapId: string;
  readonly observationId?: string;
  readonly relationId?: string;
  readonly reasonCode: string;
  readonly message: string;
  readonly proofRefs: readonly ProofRef[];
  readonly blocksNegativeProof: true;
}

export interface CalciteOperatorCausalEvidence {
  readonly evidenceId: string;
  readonly taskId: string;
  readonly statementId: string;
  /** The exact Plan Facts request root that produced this observation. */
  readonly requestRootNodeIds: readonly string[];
  readonly observationId: string;
  readonly observationKind: DifferentialObservation["kind"];
  readonly status: CalciteCausalEvidenceStatus;
  readonly mappingId?: string;
  readonly nativeRelationId?: string;
  readonly nativeRelationOccurrenceId?: string;
  readonly relationNodeKind?: PlanFactsRelNode["kind"];
  readonly operatorKind?: OperatorKind;
  readonly operatorVariant?: string;
  readonly operatorRole?: string;
  readonly effectKind?: EffectKind;
  readonly localEdgeKind?: LocalEdgeKind;
  readonly rootDependenceKind?: RootDependenceKind;
  readonly subjects: readonly SemanticSubject[];
  readonly values: readonly unknown[];
  readonly evidenceRefs: readonly string[];
  readonly proofRefs: readonly ProofRef[];
  readonly reasonCode?: string;
}

export interface CalciteCausalEvidenceReport {
  readonly taskId: string;
  readonly statementId: string;
  readonly responseStatus: DifferentialResponse["status"];
  readonly fingerprint: DifferentialResponse["fingerprint"];
  readonly observations: readonly CalciteOperatorCausalEvidence[];
  readonly gaps: readonly CalciteCausalEvidenceGap[];
  readonly definitions: readonly SemanticDependencyDefinition[];
  readonly applications: readonly SemanticDependencyApplication[];
  readonly edges: readonly SemanticDependencyEdge[];
}

export interface BuildCalciteCausalEvidenceInput {
  readonly request: PlanFactsRelRequest;
  readonly response: DifferentialResponse;
  /** Optional only for an independent operator-evidence report. */
  readonly rootTargetFieldId?: string;
}

export interface CalciteNormalizationAugmentation {
  readonly normalization: SemanticDependencyNormalization;
  readonly matchedObservationIds: readonly string[];
  readonly unmappedObservationIds: readonly string[];
}

export interface CalciteOperatorIntegrationOptions {
  /** Only observations for relations in the target Plan Facts subtree qualify. */
  readonly relevantNativeRelationIds?: ReadonlySet<string>;
  /** Only observations from independently validated Plan Facts roots in the allowed relation universe may be integrated. */
  readonly relevantRequestRootNodeIds?: ReadonlySet<string>;
  /** Canonical physical ids are required before a Calcite field can become a traversal subject. */
  readonly canonicalPhysicalFieldIds?: ReadonlySet<string>;
  /** The target fields represented by this Native normalization. */
  readonly rootTargetFieldIds?: readonly string[];
}

export interface CalciteOperatorIntegrationResult {
  readonly normalization: SemanticDependencyNormalization;
  readonly corroboratedObservationIds: readonly string[];
  readonly integratedObservationIds: readonly string[];
  readonly blockedObservationIds: readonly string[];
}

interface OperatorDescriptor {
  readonly operatorKind: OperatorKind;
  readonly operatorVariant: string;
  readonly operatorRole: string;
  readonly effectKind: EffectKind;
  readonly localEdgeKind: LocalEdgeKind;
  readonly rootDependenceKind: RootDependenceKind;
}

interface MappingContext {
  readonly mappingId: string;
  readonly nativeRelationId: string;
  readonly nativeRelationOccurrenceId: string;
  readonly evidenceRefs: readonly string[];
  readonly nativeOutputOrdinal?: number;
  readonly nativeFieldId?: string;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort(compareText);
}

function sortedUnknown(values: readonly unknown[]): readonly unknown[] {
  return [...values].sort((left, right) =>
    compareText(JSON.stringify(left), JSON.stringify(right)),
  );
}

function valuesOf(observation: DifferentialObservation): readonly unknown[] {
  return observation.values !== undefined
    ? observation.values
    : observation.value === undefined
      ? []
      : [observation.value];
}

function mappingFor(
  request: PlanFactsRelRequest,
  observation: DifferentialObservation,
): { readonly mapping?: MappingContext; readonly reason?: string } {
  if (observation.mappingRefs.length !== 1)
    return { reason: "CALCITE_MAPPING_NOT_UNIQUE" };
  const mappingId = observation.mappingRefs[0]!;
  const mapping = request.mappings.find((item) => item.mappingId === mappingId);
  if (!mapping) return { reason: "CALCITE_MAPPING_UNKNOWN" };
  if (
    observation.evidenceRefs.length === 0 ||
    observation.evidenceRefs.some((ref) => !mapping.evidenceRefs.includes(ref))
  )
    return { reason: "CALCITE_EVIDENCE_MAPPING_MISMATCH" };
  return {
    mapping: {
      mappingId,
      nativeRelationId: mapping.nativeRelationId,
      nativeRelationOccurrenceId: mapping.nativeRelationOccurrenceId,
      evidenceRefs: sortedUnique(mapping.evidenceRefs),
      ...(mapping.nativeOutputOrdinal !== undefined
        ? { nativeOutputOrdinal: mapping.nativeOutputOrdinal }
        : {}),
      ...(mapping.nativeFieldId ? { nativeFieldId: mapping.nativeFieldId } : {}),
    },
  };
}

function requestRootNodeIds(request: PlanFactsRelRequest): readonly string[] {
  return [...new Set(request.roots)].sort(compareText);
}

function requestRootScopeKey(rootIds: readonly string[]): string {
  return JSON.stringify(rootIds);
}

function observationEvidenceId(
  request: PlanFactsRelRequest,
  observationId: string,
): string {
  return `calcite-causal-evidence:${observationId}:roots:${requestRootScopeKey(requestRootNodeIds(request))}`;
}

/** Non-evaluated observations may omit source evidence, but their mapping id
 * is still required to scope the resulting Unknown to one relation. */
function locationForNonEvaluated(
  request: PlanFactsRelRequest,
  observation: DifferentialObservation,
): MappingContext | undefined {
  if (observation.mappingRefs.length !== 1) return undefined;
  const mapping = request.mappings.find(
    (item) => item.mappingId === observation.mappingRefs[0],
  );
  if (!mapping) return undefined;
  return {
    mappingId: mapping.mappingId,
    nativeRelationId: mapping.nativeRelationId,
    nativeRelationOccurrenceId: mapping.nativeRelationOccurrenceId,
    evidenceRefs: sortedUnique(mapping.evidenceRefs),
    ...(mapping.nativeOutputOrdinal !== undefined
      ? { nativeOutputOrdinal: mapping.nativeOutputOrdinal }
      : {}),
    ...(mapping.nativeFieldId ? { nativeFieldId: mapping.nativeFieldId } : {}),
  };
}

function nodeFor(
  request: PlanFactsRelRequest,
  mapping: MappingContext,
): PlanFactsRelNode | undefined {
  const matches = request.relations.filter(
    (node) => node.nativeRelationId === mapping.nativeRelationId,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function expressionChildren(
  expression: RelTypedExpression,
): readonly RelTypedExpression[] {
  switch (expression.kind) {
    case "CALL":
      return expression.operands;
    case "CAST":
      return [expression.operand];
    case "CASE":
      return [
        ...(expression.subject ? [expression.subject] : []),
        ...expression.branches.flatMap((branch) => [branch.selector, branch.result]),
        ...(expression.elseResult ? [expression.elseResult] : []),
      ];
    default:
      return [];
  }
}

function expressionFieldRefs(
  expression: RelTypedExpression,
): readonly Extract<RelTypedExpression, { readonly kind: "FIELD_REF" }>[] {
  const result: Extract<RelTypedExpression, { readonly kind: "FIELD_REF" }>[] = [];
  const visit = (current: RelTypedExpression): void => {
    if (current.kind === "FIELD_REF") result.push(current);
    for (const child of expressionChildren(current)) visit(child);
  };
  visit(expression);
  return result;
}

function nodeExpressions(
  node: PlanFactsRelNode,
): readonly RelTypedExpression[] {
  switch (node.kind) {
    case "PROJECT":
    case "WINDOW":
      return node.expressions;
    case "FILTER":
      return [node.predicate];
    case "JOIN":
      return node.condition ? [node.condition] : [];
    case "AGGREGATE":
      return [...node.groupKeys, ...node.measures];
    case "TOP_N":
      return [
        ...node.orderBy.map((item) => item.expression),
        ...(node.offset ? [node.offset] : []),
        ...(node.fetch ? [node.fetch] : []),
      ];
    default:
      return [];
  }
}

function outputExpression(
  node: PlanFactsRelNode,
  ordinal: number,
): RelTypedExpression | undefined {
  switch (node.kind) {
    case "PROJECT":
    case "WINDOW":
      return node.expressions[ordinal];
    case "AGGREGATE":
      return [...node.groupKeys, ...node.measures][ordinal];
    default:
      return undefined;
  }
}

function fieldForRef(
  request: PlanFactsRelRequest,
  fieldRef: Extract<RelTypedExpression, { readonly kind: "FIELD_REF" }>,
): RelOutputField | undefined {
  return request.relations.find((node) => node.nodeId === fieldRef.inputNodeId)
    ?.outputFields[fieldRef.inputOrdinal];
}

function physicalSubject(
  request: PlanFactsRelRequest,
  fieldRef: Extract<RelTypedExpression, { readonly kind: "FIELD_REF" }>,
): SemanticSubject | undefined {
  const output = fieldForRef(request, fieldRef);
  const physicalFieldId = fieldRef.nativeFieldId ?? output?.nativeFieldId;
  return physicalFieldId
    ? { subjectKind: "PHYSICAL_FIELD", physicalFieldId }
    : undefined;
}

function relationSubject(mapping: MappingContext): SemanticSubject {
  return {
    subjectKind: "RELATION_OCCURRENCE",
    relationOccurrenceId: mapping.nativeRelationOccurrenceId,
  };
}

function uniqueSubjects(values: readonly SemanticSubject[]): readonly SemanticSubject[] {
  const byKey = new Map<string, SemanticSubject>();
  for (const value of values) {
    const key = value.subjectKind === "PHYSICAL_FIELD"
      ? `FIELD:${value.physicalFieldId}`
      : `RELATION:${value.relationOccurrenceId}`;
    byKey.set(key, value);
  }
  return [...byKey.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, value]) => value);
}

function subjectKey(subject: SemanticSubject): string {
  return subject.subjectKind === "PHYSICAL_FIELD"
    ? `FIELD:${subject.physicalFieldId}`
    : `RELATION:${subject.relationOccurrenceId}`;
}

function outputPhysicalSubject(
  node: PlanFactsRelNode,
  ordinal: number,
): SemanticSubject | undefined {
  const field = node.outputFields[ordinal];
  return field?.nativeFieldId
    ? { subjectKind: "PHYSICAL_FIELD", physicalFieldId: field.nativeFieldId }
    : undefined;
}

function metadataOrdinals(
  observation: DifferentialObservation,
  value: unknown,
): readonly number[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  const property = observation.kind === "uniqueKeys"
    ? "ordinals"
    : observation.kind === "functionalDependencies"
      ? ["determinantOrdinals", "dependentOrdinals"]
      : [];
  const keys = typeof property === "string" ? [property] : property;
  const result: number[] = [];
  for (const key of keys) {
    const values = record[key];
    if (!Array.isArray(values)) continue;
    for (const ordinal of values)
      if (Number.isSafeInteger(ordinal) && ordinal >= 0) result.push(ordinal);
  }
  return result;
}

function metadataSubjects(
  node: PlanFactsRelNode,
  observation: DifferentialObservation,
): readonly SemanticSubject[] {
  if (observation.kind !== "uniqueKeys" && observation.kind !== "functionalDependencies")
    return [];
  // Calcite's empty metadata set is a meaningful, evaluated result (the
  // relation has no reported key/FD), not a missing field identity.  Keep it
  // at relation scope.  A non-empty name-only result still has to fail closed
  // below because column names are ambiguous across JOIN/self-join outputs.
  if (valuesOf(observation).length === 0) return [];
  return uniqueSubjects(
    valuesOf(observation).flatMap((value) =>
      metadataOrdinals(observation, value).flatMap((ordinal) => {
        const subject = outputPhysicalSubject(node, ordinal);
        return subject ? [subject] : [];
      }),
    ),
  );
}

function dependencyIdentityKey(value: {
  readonly subject: SemanticSubject;
  readonly operatorKind: OperatorKind;
  readonly operatorVariant: string;
  readonly operatorRole: string;
  readonly effectKind: EffectKind;
  readonly localEdgeKind: LocalEdgeKind;
}): string {
  return JSON.stringify({
    subject: subjectKey(value.subject),
    operatorKind: value.operatorKind,
    operatorVariant: value.operatorVariant,
    operatorRole: value.operatorRole,
    effectKind: value.effectKind,
    localEdgeKind: value.localEdgeKind,
  });
}

function mergeProofRefs(
  left: readonly ProofRef[],
  right: readonly ProofRef[],
): readonly ProofRef[] {
  const values = new Map<string, ProofRef>();
  for (const ref of [...left, ...right]) values.set(ref.proofRefId, ref);
  return [...values.values()].sort((a, b) => a.proofRefId.localeCompare(b.proofRefId));
}

function subjectsFor(
  request: PlanFactsRelRequest,
  mapping: MappingContext,
  node: PlanFactsRelNode,
  observation: DifferentialObservation,
): readonly SemanticSubject[] {
  if (observation.kind === "uniqueKeys" || observation.kind === "functionalDependencies") {
    if (valuesOf(observation).length === 0) return [relationSubject(mapping)];
    const exact = metadataSubjects(node, observation);
    // A metadata result without output ordinals cannot be safely assigned to a
    // physical field.  Returning no subject deliberately makes the observation
    // UNMAPPABLE instead of falling back to a name-based identity.
    return exact;
  }
  if (observation.kind === "predicates")
    return uniqueSubjects(
      nodeExpressions(node).flatMap((expression) =>
        expressionFieldRefs(expression).flatMap((fieldRef) => {
          const subject = physicalSubject(request, fieldRef);
          return subject ? [subject] : [];
        }),
      ),
    );

  if (observation.kind === "expressionLineage") {
    const ordinal = mapping.nativeOutputOrdinal;
    const expression = ordinal === undefined ? undefined : outputExpression(node, ordinal);
    const direct = expression
      ? expressionFieldRefs(expression).flatMap((fieldRef) => {
          const subject = physicalSubject(request, fieldRef);
          return subject ? [subject] : [];
        })
      : [];
    if (direct.length > 0) return uniqueSubjects(direct);
    const output = ordinal === undefined ? undefined : node.outputFields[ordinal];
    const physicalFieldId = mapping.nativeFieldId ?? output?.nativeFieldId;
    return physicalFieldId
      ? [{ subjectKind: "PHYSICAL_FIELD", physicalFieldId }]
      : [];
  }

  return [relationSubject(mapping)];
}

function descriptorFor(
  node: PlanFactsRelNode,
  observation: DifferentialObservation,
): OperatorDescriptor | undefined {
  if (observation.kind === "expressionLineage") {
    switch (node.kind) {
      case "AGGREGATE":
        return {
          operatorKind: "AGGREGATE",
          operatorVariant: "AGGREGATE_INPUT",
          operatorRole: "AGGREGATE_INPUT",
          effectKind: "VALUE_CONTRIBUTION",
          localEdgeKind: "VALUE_FLOW",
          rootDependenceKind: "VALUE_TO_TARGET",
        };
      case "WINDOW":
        return {
          operatorKind: "WINDOW",
          operatorVariant: "WINDOW",
          operatorRole: "WINDOW_INPUT",
          effectKind: "VALUE_CONTRIBUTION",
          localEdgeKind: "VALUE_FLOW",
          rootDependenceKind: "VALUE_TO_TARGET",
        };
      case "JOIN":
      case "FILTER":
      case "SETOP":
      case "TOP_N":
      case "READ":
      case "DERIVED":
        // Expression lineage is value pass-through. Predicate, membership,
        // cardinality, and relation-context observations are emitted
        // separately and must not be conflated with this value edge.
        return {
          operatorKind: "PROJECT",
          operatorVariant: "COLUMN_EXPRESSION",
          operatorRole: "VALUE",
          effectKind: "VALUE_CONTRIBUTION",
          localEdgeKind: "VALUE_FLOW",
          rootDependenceKind: "VALUE_TO_TARGET",
        };
      default:
        return undefined;
    }
  }
  if (
    observation.kind === "uniqueKeys" ||
    observation.kind === "functionalDependencies" ||
    observation.kind === "rowCountCardinality"
  ) {
    const operatorKind: OperatorKind = node.kind === "JOIN"
      ? "JOIN"
      : node.kind === "AGGREGATE"
        ? "AGGREGATE"
        : "RELATION";
    const operatorVariant = node.kind === "JOIN"
      ? node.joinType
      : node.kind === "AGGREGATE"
        ? "GROUP_BY"
        : node.kind;
    return {
      operatorKind,
      operatorVariant,
      operatorRole: observation.kind === "uniqueKeys"
        ? "UNIQUE_KEYS"
        : observation.kind === "functionalDependencies"
          ? "FUNCTIONAL_DEPENDENCY"
          : "ROW_COUNT_CARDINALITY",
      effectKind: "MULTIPLICITY",
      localEdgeKind: "ROWSET_CONTROL",
      rootDependenceKind: "CONTROL_TO_TARGET",
    };
  }
  switch (node.kind) {
    case "FILTER":
      return {
        operatorKind: "FILTER",
        operatorVariant: node.clause,
        operatorRole: "PREDICATE",
        effectKind: "ROW_MEMBERSHIP",
        localEdgeKind: "ROWSET_CONTROL",
        rootDependenceKind: "CONTROL_TO_TARGET",
      };
    case "JOIN":
      return {
        operatorKind: "JOIN",
        operatorVariant: node.joinType,
        operatorRole: "JOIN_CONDITION",
        effectKind: "ROW_MEMBERSHIP",
        localEdgeKind: "ROWSET_CONTROL",
        rootDependenceKind: "CONTROL_TO_TARGET",
      };
    case "PROJECT":
      return {
        operatorKind: "PROJECT",
        operatorVariant: "COLUMN_EXPRESSION",
        operatorRole: "VALUE",
        effectKind: "VALUE_CONTRIBUTION",
        localEdgeKind: "VALUE_FLOW",
        rootDependenceKind: "VALUE_TO_TARGET",
      };
    case "AGGREGATE": {
      return {
        operatorKind: "AGGREGATE",
        operatorVariant: "GROUP_BY",
        operatorRole: "GROUPING_AND_CARDINALITY",
        effectKind: "GROUPING",
        localEdgeKind: "ROWSET_CONTROL",
        rootDependenceKind: "CONTROL_TO_TARGET",
      };
    }
    case "SETOP":
      return {
        operatorKind: "SETOP",
        operatorVariant: `${node.operation}${node.all ? "_ALL" : ""}`,
        operatorRole: "SET_MEMBER",
        effectKind: "SET_MEMBERSHIP",
        localEdgeKind: "ROWSET_CONTROL",
        rootDependenceKind: "CONTROL_TO_TARGET",
      };
    case "WINDOW":
      return {
        operatorKind: "WINDOW",
        operatorVariant: "WINDOW",
        operatorRole: "WINDOW_INPUT",
        effectKind: "WINDOW_CONTEXT",
        localEdgeKind: "WINDOW_CONTEXT",
        rootDependenceKind: "CONTROL_TO_TARGET",
      };
    case "TOP_N":
      return {
        operatorKind: "TOP_N",
        operatorVariant: "TOP_N",
        operatorRole: "RANK_LIMIT",
        effectKind: "ROW_MEMBERSHIP",
        localEdgeKind: "ROWSET_CONTROL",
        rootDependenceKind: "CONTROL_TO_TARGET",
      };
    case "READ":
    case "DERIVED":
      return {
        operatorKind: "RELATION",
        operatorVariant: node.kind,
        operatorRole: "RELATION",
        effectKind: "RELATION_EXISTENCE",
        localEdgeKind: "RELATION_CONTEXT",
        rootDependenceKind: "RELATION_TO_TARGET",
      };
    case "UNSUPPORTED":
      return undefined;
  }
}

function evidenceId(
  observationId: string,
  descriptor: OperatorDescriptor,
  scopedRootNodeIds: readonly string[],
): string {
  return `calcite-causal-evidence:${observationId}:roots:${requestRootScopeKey(scopedRootNodeIds)}:${descriptor.operatorKind}:${descriptor.operatorVariant}`;
}

function proofRefsFor(
  observation: DifferentialObservation,
  mapping: MappingContext,
): readonly ProofRef[] {
  return [
    createProofRef("CALCITE_OBSERVATION", observation.observationId),
    ...mapping.evidenceRefs.map((ref) =>
      createProofRef("CANONICAL_FACT", ref, `Calcite mapping ${mapping.mappingId}`),
    ),
  ].sort((left, right) => left.proofRefId.localeCompare(right.proofRefId));
}

function gap(
  observation: DifferentialObservation | undefined,
  reasonCode: string,
  message: string,
  proofRefs: readonly ProofRef[] = [],
  relationId?: string,
  scopedRootNodeIds: readonly string[] = [],
): CalciteCausalEvidenceGap {
  const observationId = observation?.observationId;
  return {
    gapId: `calcite-causal-gap:${observationId ?? "response"}:${reasonCode}:${relationId ?? ""}:roots:${requestRootScopeKey(scopedRootNodeIds)}`,
    ...(observationId ? { observationId } : {}),
    ...(relationId ? { relationId } : {}),
    reasonCode,
    message,
    proofRefs: [...proofRefs].sort((left, right) => left.proofRefId.localeCompare(right.proofRefId)),
    blocksNegativeProof: true,
  };
}

function buildSemanticObjects(
  evidence: CalciteOperatorCausalEvidence,
  rootTargetFieldId: string | undefined,
  idNamespace?: string,
): {
  readonly definitions: readonly SemanticDependencyDefinition[];
  readonly applications: readonly SemanticDependencyApplication[];
  readonly edges: readonly SemanticDependencyEdge[];
} {
  if (
    evidence.status !== "MAPPED" ||
    evidence.operatorKind === undefined ||
    evidence.operatorVariant === undefined ||
    evidence.operatorRole === undefined ||
    evidence.effectKind === undefined ||
    evidence.localEdgeKind === undefined
  )
    return { definitions: [], applications: [], edges: [] };
  const definitions: SemanticDependencyDefinition[] = [];
  const applications: SemanticDependencyApplication[] = [];
  const edges: SemanticDependencyEdge[] = [];
  for (const subject of evidence.subjects) {
    const definition = makeSemanticDependencyDefinition(
      {
        subject,
        effectKind: evidence.effectKind,
        operatorKind: evidence.operatorKind,
        operatorVariant: evidence.operatorVariant,
        operatorRole: evidence.operatorRole,
        localEdgeKind: evidence.localEdgeKind,
      },
      "SUPPORTED",
      evidence.proofRefs,
      idNamespace,
    );
    definitions.push(definition);
    if (!rootTargetFieldId) continue;
    const application = makeSemanticDependencyApplication({
      dependencyId: definition.dependencyId,
      ...(evidence.nativeRelationId === undefined
        ? {}
        : { scopeRelationId: evidence.nativeRelationId }),
      rootTargetFieldId,
      rootDependenceKind: evidence.rootDependenceKind!,
      pathCertainty: "CONFIRMED",
      proofRefs: evidence.proofRefs,
    });
    applications.push(application);
    edges.push(makeSemanticDependencyEdge({
      dependencyId: definition.dependencyId,
      fromSubject: subject,
      toSubject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: rootTargetFieldId },
      rootDependenceKind: evidence.rootDependenceKind!,
      localEdgeKind: evidence.localEdgeKind,
      ...(evidence.nativeRelationId === undefined
        ? {}
        : { scopeRelationId: evidence.nativeRelationId }),
      pathCertainty: "CONFIRMED",
      proofRefs: evidence.proofRefs,
    }));
  }
  return { definitions, applications, edges };
}

function semanticGapFromCalcite(
  evidence: CalciteOperatorCausalEvidence,
  rootTargetFieldId: string,
  overrideReasonCode?: string,
  overrideMessage?: string,
): SemanticDependencyNormalization["gaps"][number] {
  const operatorKind = evidence.operatorKind ?? "RELATION";
  const operatorVariant = evidence.operatorVariant ?? "CALCITE";
  const operatorRole = evidence.operatorRole ?? "SEMANTIC_METADATA";
  const relationId = evidence.nativeRelationId ?? null;
  const reasonCode = overrideReasonCode ?? evidence.reasonCode ?? "CALCITE_OPERATOR_EVIDENCE_UNAVAILABLE";
  const proofRefs = mergeProofRefs(
    evidence.proofRefs,
    [createProofRef("CALCITE_OBSERVATION", evidence.observationId)],
  );
  return {
    gapId: `semantic-gap:calcite:${rootTargetFieldId}:${evidence.observationId}:${reasonCode}`,
    status: "UNKNOWN",
    reasonCode,
    operatorKind,
    operatorVariant,
    operatorRole,
    relationId,
    rootTargetFieldId,
    message: overrideMessage ?? `Calcite operator evidence ${evidence.observationId} is ${evidence.status} and cannot close the causal branch.`,
    proofRefs,
    blocksNegativeProof: true,
  };
}

function evidenceNeedsIntegration(
  evidence: CalciteOperatorCausalEvidence,
): boolean {
  // An unevaluated/unmappable operator is itself a boundary for negative
  // proof, even when its operator descriptor is incomplete.  Do not filter
  // that boundary out merely because the positive semantic subset is narrow.
  if (evidence.status !== "MAPPED") return evidence.observationKind !== "expressionLineage";
  // Native expression/value lineage is canonical and already owns the exact
  // field bridge.  The first causal-supplement lane is deliberately focused
  // on the operator facts that can change membership or multiplicity.  Other
  // Calcite metadata remains in the independent report until it has an
  // explicit target-relevance mapping.
  if (evidence.observationKind === "predicates")
    return evidence.operatorKind === "FILTER" || evidence.operatorKind === "JOIN";
  if (
    evidence.observationKind === "uniqueKeys" ||
    evidence.observationKind === "functionalDependencies" ||
    evidence.observationKind === "rowCountCardinality"
  )
    return evidence.operatorKind === "JOIN" || evidence.operatorKind === "AGGREGATE";
  return false;
}

function relationAliases(value: string): readonly string[] {
  const aliases = new Set<string>([value]);
  const marker = ":relation:";
  const markerIndex = value.lastIndexOf(marker);
  if (markerIndex >= 0) aliases.add(value.slice(markerIndex + marker.length));
  return [...aliases];
}

function sameRelationId(left: string, right: string): boolean {
  const rightAliases = new Set(relationAliases(right));
  return relationAliases(left).some((value) => rightAliases.has(value));
}

function relationIdsFromDefinition(
  definition: SemanticDependencyDefinition,
): readonly string[] {
  return [...new Set(
    definition.proofRefs
      .filter((ref) => ref.kind === "CANONICAL_FACT" && ref.refId.startsWith("plan:relation:"))
      .map((ref) => ref.refId.slice("plan:relation:".length)),
  )];
}

function mergeCertainty(
  left: "CONFIRMED" | "CONDITIONAL" | "UNKNOWN",
  right: "CONFIRMED" | "CONDITIONAL" | "UNKNOWN",
): "CONFIRMED" | "CONDITIONAL" | "UNKNOWN" {
  if (left === "UNKNOWN" || right === "UNKNOWN") return "UNKNOWN";
  if (left === "CONDITIONAL" || right === "CONDITIONAL") return "CONDITIONAL";
  return "CONFIRMED";
}

function preferredEvidenceByObservation(
  observations: readonly CalciteOperatorCausalEvidence[],
  options: Pick<CalciteOperatorIntegrationOptions, "relevantNativeRelationIds" | "relevantRequestRootNodeIds">,
): readonly CalciteOperatorCausalEvidence[] {
  const candidates = observations.filter((evidence) => {
    if (
      evidence.nativeRelationId !== undefined &&
      options.relevantNativeRelationIds !== undefined &&
      ![...options.relevantNativeRelationIds].some((relationId) =>
        sameRelationId(evidence.nativeRelationId!, relationId),
      )
    ) return false;
    if (
      options.relevantRequestRootNodeIds !== undefined &&
      evidence.requestRootNodeIds.length > 0 &&
      !evidence.requestRootNodeIds.some((root) =>
        [...options.relevantRequestRootNodeIds!].some((allowed) =>
          sameRelationId(root, allowed),
        ),
      )
    ) return false;
    return true;
  });
  const grouped = new Map<string, CalciteOperatorCausalEvidence[]>();
  for (const evidence of candidates) {
    const values = grouped.get(evidence.observationId) ?? [];
    values.push(evidence);
    grouped.set(evidence.observationId, values);
  }
  const selected: CalciteOperatorCausalEvidence[] = [];
  for (const values of grouped.values()) {
    values.sort((left, right) => {
      const leftExact = left.nativeRelationId !== undefined &&
        left.requestRootNodeIds.some((root) => sameRelationId(root, left.nativeRelationId!));
      const rightExact = right.nativeRelationId !== undefined &&
        right.requestRootNodeIds.some((root) => sameRelationId(root, right.nativeRelationId!));
      return Number(!leftExact) - Number(!rightExact) ||
        left.requestRootNodeIds.length - right.requestRootNodeIds.length ||
        compareText(left.evidenceId, right.evidenceId);
    });
    if (values[0]) selected.push(values[0]);
  }
  return selected.sort((left, right) => compareText(left.evidenceId, right.evidenceId));
}

function certaintyForSupplement(
  evidence: CalciteOperatorCausalEvidence,
): "CONFIRMED" | "CONDITIONAL" {
  // A mapped predicate proves a structural row-membership dependency.  Key,
  // FD, and cardinality metadata refine possible multiplicity but do not prove
  // a runtime fan-out, so those branches remain conditional.
  return evidence.observationKind === "predicates" ? "CONFIRMED" : "CONDITIONAL";
}

/**
 * Integrate Calcite operator evidence as a Native-scoped semantic supplement.
 * Native Plan Facts owns target relevance and exact identities; Calcite may
 * add a new operator fact only inside a relation scope that Native already
 * proved can reach one of the target fields.  Exact identity matches merely
 * gain Calcite proof refs, while unmatched JOIN metadata can add a bounded
 * control branch at that already-proven scope.
 */
export function integrateCalciteOperatorEvidence(
  normalization: SemanticDependencyNormalization,
  report: Pick<CalciteCausalEvidenceReport, "observations">,
  options: CalciteOperatorIntegrationOptions = {},
): CalciteOperatorIntegrationResult {
  const selectedObservations = preferredEvidenceByObservation(
    report.observations,
    options,
  );
  const corroborated = augmentSemanticNormalizationWithCalciteEvidence(
    normalization,
    { observations: selectedObservations },
  );
  const definitions = new Map(
    corroborated.normalization.definitions.map((item) => [item.dependencyId, item]),
  );
  const applications = new Map(
    corroborated.normalization.applications.map((item) => [item.applicationId, item]),
  );
  const edges = new Map(
    corroborated.normalization.edges.map((item) => [item.edgeId, item]),
  );
  const gaps = new Map(
    corroborated.normalization.gaps.map((item) => [item.gapId, item]),
  );
  const relevantRelationIds = options.relevantNativeRelationIds;
  const relevantRequestRootNodeIds = options.relevantRequestRootNodeIds;
  const canonicalPhysicalFieldIds = options.canonicalPhysicalFieldIds;
  const integratedObservationIds = new Set(corroborated.matchedObservationIds);
  const blockedObservationIds = new Set<string>();
  const nativeDefinitions = normalization.definitions;
  const nativeApplications = normalization.applications;
  // Unit-level callers may intentionally provide no Native normalization and
  // only an explicit target id to exercise fail-closed Calcite handling.  The
  // production path always has Native applications before it integrates a
  // Calcite observation, so this fallback cannot broaden a real slice.
  const explicitTargetFallback =
    nativeApplications.length === 0 &&
    nativeDefinitions.length === 0 &&
    (options.rootTargetFieldIds?.length ?? 0) > 0;

  for (const evidence of selectedObservations) {
    if (!evidenceNeedsIntegration(evidence)) continue;
    if (relevantRequestRootNodeIds !== undefined) {
      if (evidence.requestRootNodeIds.length === 0) {
        blockedObservationIds.add(evidence.observationId);
        if (explicitTargetFallback) {
          for (const rootTargetFieldId of options.rootTargetFieldIds ?? []) {
            const gap = semanticGapFromCalcite(
              evidence,
              rootTargetFieldId,
              "CALCITE_REQUEST_ROOT_SCOPE_MISSING",
              "Calcite observation has no exact Plan Facts request root; it cannot be scoped to the target relation.",
            );
            gaps.set(gap.gapId, gap);
          }
        }
        continue;
      }
      if (!evidence.requestRootNodeIds.some((root) =>
        [...relevantRequestRootNodeIds].some((allowed) => sameRelationId(root, allowed)),
      ))
        continue;
    }
    if (
      evidence.nativeRelationId !== undefined &&
      relevantRelationIds !== undefined &&
      ![...relevantRelationIds].some((relationId) =>
        sameRelationId(evidence.nativeRelationId!, relationId),
      )
    ) continue;

    if (evidence.nativeRelationId === undefined) {
      // Without an exact relation occurrence there is no safe way to decide
      // that this observation belongs to the current target slice.  Keep it
      // in the independent Calcite report; do not turn an unscoped result
      // into a target-level gap or a fabricated dependency.
      blockedObservationIds.add(evidence.observationId);
      if (explicitTargetFallback) {
        for (const rootTargetFieldId of options.rootTargetFieldIds ?? []) {
          const gap = semanticGapFromCalcite(evidence, rootTargetFieldId);
          gaps.set(gap.gapId, gap);
        }
      }
      continue;
    }

    // An observation is target-relevant only when the Native normalization
    // has an application whose owning relation is this exact occurrence. The
    // fallback handles older in-memory normalizations that predate
    // scopeRelationId by reading the relation proof on their definitions.
    const scopedApplications = nativeApplications.filter((application) =>
      application.scopeRelationId !== undefined &&
      sameRelationId(application.scopeRelationId, evidence.nativeRelationId!),
    );
    const scopedDependencyIds = new Set(
      nativeDefinitions
        .filter((definition) =>
          relationIdsFromDefinition(definition).some((relationId) =>
            sameRelationId(relationId, evidence.nativeRelationId!),
          ),
        )
        .map((definition) => definition.dependencyId),
    );
    const fallbackApplications = scopedApplications.length > 0
      ? scopedApplications
      : nativeApplications.filter((application) =>
          scopedDependencyIds.has(application.dependencyId),
        );
    const targetApplications = fallbackApplications.filter((application) =>
      options.rootTargetFieldIds === undefined ||
      options.rootTargetFieldIds.includes(application.rootTargetFieldId),
    );
    if (targetApplications.length === 0) {
      // The Calcite observation is valid, but it belongs to a relation outside
      // this target slice. Keep it visible in the independent report without
      // fabricating a target edge or a negative-proof gap.
      blockedObservationIds.add(evidence.observationId);
      if (explicitTargetFallback && evidence.status !== "MAPPED") {
        for (const rootTargetFieldId of options.rootTargetFieldIds ?? []) {
          const gap = semanticGapFromCalcite(evidence, rootTargetFieldId);
          gaps.set(gap.gapId, gap);
        }
      }
      continue;
    }

    if (corroborated.matchedObservationIds.includes(evidence.observationId))
      continue;

    const invalidPhysicalSubject = evidence.status === "MAPPED" &&
      canonicalPhysicalFieldIds !== undefined &&
      evidence.subjects.some((subject) =>
        subject.subjectKind === "PHYSICAL_FIELD" &&
        !canonicalPhysicalFieldIds.has(subject.physicalFieldId),
      );
    const usable = evidence.status === "MAPPED" && !invalidPhysicalSubject;
    if (!usable) {
      blockedObservationIds.add(evidence.observationId);
      for (const rootTargetFieldId of new Set(
        targetApplications.map((application) => application.rootTargetFieldId),
      )) {
        const gap = semanticGapFromCalcite(evidence, rootTargetFieldId);
        gaps.set(gap.gapId, gap);
      }
      continue;
    }

    const certainty = certaintyForSupplement(evidence);
    const semantic = buildSemanticObjects(evidence, undefined, evidence.taskId);
    for (const definition of semantic.definitions) {
      const previousDefinition = definitions.get(definition.dependencyId);
      definitions.set(
        definition.dependencyId,
        previousDefinition
          ? {
              ...previousDefinition,
              proofRefs: mergeProofRefs(previousDefinition.proofRefs, definition.proofRefs),
            }
          : definition,
      );
      for (const targetApplication of targetApplications) {
        const scopeRelationId = targetApplication.scopeRelationId ?? evidence.nativeRelationId;
        const application = makeSemanticDependencyApplication({
          dependencyId: definition.dependencyId,
          ...(scopeRelationId === undefined ? {} : { scopeRelationId }),
          rootTargetFieldId: targetApplication.rootTargetFieldId,
          rootDependenceKind: evidence.rootDependenceKind ?? targetApplication.rootDependenceKind,
          pathCertainty: certainty,
          proofRefs: evidence.proofRefs,
        });
        const previousApplication = applications.get(application.applicationId);
        applications.set(
          application.applicationId,
          previousApplication
            ? {
                ...previousApplication,
                pathCertainty: mergeCertainty(previousApplication.pathCertainty, certainty),
                proofRefs: mergeProofRefs(previousApplication.proofRefs, application.proofRefs),
              }
            : application,
        );
        const edge = makeSemanticDependencyEdge({
          dependencyId: definition.dependencyId,
          fromSubject: definition.subject,
          toSubject: {
            subjectKind: "PHYSICAL_FIELD",
            physicalFieldId: targetApplication.rootTargetFieldId,
          },
          rootDependenceKind: evidence.rootDependenceKind ?? targetApplication.rootDependenceKind,
          localEdgeKind: definition.localEdgeKind,
          ...(scopeRelationId === undefined ? {} : { scopeRelationId }),
          pathCertainty: certainty,
          proofRefs: evidence.proofRefs,
        });
        const previousEdge = edges.get(edge.edgeId);
        edges.set(
          edge.edgeId,
          previousEdge
            ? {
                ...previousEdge,
                pathCertainty: mergeCertainty(previousEdge.pathCertainty, certainty),
                proofRefs: mergeProofRefs(previousEdge.proofRefs, edge.proofRefs),
              }
            : edge,
        );
      }
      integratedObservationIds.add(evidence.observationId);
    }
  }
  const resultNormalization: SemanticDependencyNormalization = {
    ...corroborated.normalization,
    definitions: [...definitions.values()].sort((a, b) => compareText(a.dependencyId, b.dependencyId)),
    applications: [...applications.values()].sort((a, b) => compareText(a.applicationId, b.applicationId)),
    edges: [...edges.values()].sort((a, b) => compareText(a.edgeId, b.edgeId)),
    semanticEdges: [...edges.values()].sort((a, b) => compareText(a.edgeId, b.edgeId)),
    gaps: [...gaps.values()].sort((a, b) => compareText(a.gapId, b.gapId)),
  };
  return {
    normalization: resultNormalization,
    corroboratedObservationIds: corroborated.matchedObservationIds,
    integratedObservationIds: [...integratedObservationIds].sort(compareText),
    blockedObservationIds: [...blockedObservationIds].sort(compareText),
  };
}

function mappedEvidence(
  request: PlanFactsRelRequest,
  observation: DifferentialObservation,
): {
  readonly evidence?: CalciteOperatorCausalEvidence;
  readonly gap?: CalciteCausalEvidenceGap;
} {
  if (observation.status !== "EVALUATED") {
    const mapping = locationForNonEvaluated(request, observation);
    const node = mapping ? nodeFor(request, mapping) : undefined;
    const descriptor = node ? descriptorFor(node, observation) : undefined;
    return {
      evidence: {
        evidenceId: observationEvidenceId(request, observation.observationId),
        taskId: request.taskId,
        statementId: request.statementId,
        requestRootNodeIds: requestRootNodeIds(request),
        observationId: observation.observationId,
        observationKind: observation.kind,
        status: "NOT_EVALUATED",
        ...(mapping
          ? {
              mappingId: mapping.mappingId,
              nativeRelationId: mapping.nativeRelationId,
              nativeRelationOccurrenceId: mapping.nativeRelationOccurrenceId,
              ...(node ? { relationNodeKind: node.kind } : {}),
              ...(descriptor
                ? {
                    operatorKind: descriptor.operatorKind,
                    operatorVariant: descriptor.operatorVariant,
                    operatorRole: descriptor.operatorRole,
                    effectKind: descriptor.effectKind,
                    localEdgeKind: descriptor.localEdgeKind,
                    rootDependenceKind: descriptor.rootDependenceKind,
                  }
                : {}),
            }
          : {}),
        subjects: [],
        values: [],
        evidenceRefs: [...observation.evidenceRefs],
        proofRefs: [],
        reasonCode: "CALCITE_OBSERVATION_NOT_EVALUATED",
      },
      gap: gap(
        observation,
        "CALCITE_OBSERVATION_NOT_EVALUATED",
        "Calcite did not evaluate this observation; it cannot support a positive or negative causal decision.",
        [],
        undefined,
        requestRootNodeIds(request),
      ),
    };
  }
  const resolved = mappingFor(request, observation);
  if (!resolved.mapping)
    return {
      evidence: {
        evidenceId: observationEvidenceId(request, observation.observationId),
        taskId: request.taskId,
        statementId: request.statementId,
        requestRootNodeIds: requestRootNodeIds(request),
        observationId: observation.observationId,
        observationKind: observation.kind,
        status: "UNMAPPABLE",
        subjects: [],
        values: sortedUnknown(valuesOf(observation)),
        evidenceRefs: [...observation.evidenceRefs],
        proofRefs: [],
        reasonCode: resolved.reason,
      },
      gap: gap(
        observation,
        resolved.reason ?? "CALCITE_MAPPING_INVALID",
        "Calcite observation does not have one exact mapping with bound evidence.",
        [],
        undefined,
        requestRootNodeIds(request),
      ),
    };
  const node = nodeFor(request, resolved.mapping);
  if (!node)
    return {
      evidence: {
        evidenceId: observationEvidenceId(request, observation.observationId),
        taskId: request.taskId,
        statementId: request.statementId,
        requestRootNodeIds: requestRootNodeIds(request),
        observationId: observation.observationId,
        observationKind: observation.kind,
        status: "UNMAPPABLE",
        mappingId: resolved.mapping.mappingId,
        nativeRelationId: resolved.mapping.nativeRelationId,
        nativeRelationOccurrenceId: resolved.mapping.nativeRelationOccurrenceId,
        subjects: [],
        values: sortedUnknown(valuesOf(observation)),
        evidenceRefs: [...observation.evidenceRefs],
        proofRefs: [],
        reasonCode: "CALCITE_RELATION_MAPPING_NOT_UNIQUE",
      },
      gap: gap(
        observation,
        "CALCITE_RELATION_MAPPING_NOT_UNIQUE",
        "Calcite observation does not map to exactly one Native relation occurrence.",
        [],
        resolved.mapping.nativeRelationId,
        requestRootNodeIds(request),
      ),
    };
  const descriptor = descriptorFor(node, observation);
  if (!descriptor)
    return {
      evidence: {
        evidenceId: observationEvidenceId(request, observation.observationId),
        taskId: request.taskId,
        statementId: request.statementId,
        requestRootNodeIds: requestRootNodeIds(request),
        observationId: observation.observationId,
        observationKind: observation.kind,
        status: "UNMAPPABLE",
        mappingId: resolved.mapping.mappingId,
        nativeRelationId: resolved.mapping.nativeRelationId,
        nativeRelationOccurrenceId: resolved.mapping.nativeRelationOccurrenceId,
        relationNodeKind: node.kind,
        subjects: [],
        values: sortedUnknown(valuesOf(observation)),
        evidenceRefs: [...observation.evidenceRefs],
        proofRefs: [],
        reasonCode: "CALCITE_OPERATOR_MAPPING_UNSUPPORTED",
      },
      gap: gap(
        observation,
        "CALCITE_OPERATOR_MAPPING_UNSUPPORTED",
        `Calcite observation maps to unsupported Native relation kind ${node.kind}.`,
        [],
        node.nativeRelationId,
        requestRootNodeIds(request),
      ),
    };
  const proofRefs = proofRefsFor(observation, resolved.mapping);
  const subjects = subjectsFor(request, resolved.mapping, node, observation);
  const effectiveSubjects = subjects.length > 0
    ? subjects
    : observation.kind === "rowCountCardinality" || observation.kind === "tableOccurrences"
      ? [relationSubject(resolved.mapping)]
      : [];
  if (effectiveSubjects.length === 0)
    return {
      evidence: {
        evidenceId: observationEvidenceId(request, observation.observationId),
        taskId: request.taskId,
        statementId: request.statementId,
        requestRootNodeIds: requestRootNodeIds(request),
        observationId: observation.observationId,
        observationKind: observation.kind,
        status: "UNMAPPABLE",
        mappingId: resolved.mapping.mappingId,
        nativeRelationId: resolved.mapping.nativeRelationId,
        nativeRelationOccurrenceId: resolved.mapping.nativeRelationOccurrenceId,
        relationNodeKind: node.kind,
        operatorKind: descriptor.operatorKind,
        operatorVariant: descriptor.operatorVariant,
        operatorRole: descriptor.operatorRole,
        effectKind: descriptor.effectKind,
        localEdgeKind: descriptor.localEdgeKind,
        rootDependenceKind: descriptor.rootDependenceKind,
        subjects: [],
        values: sortedUnknown(valuesOf(observation)),
        evidenceRefs: [...observation.evidenceRefs],
        proofRefs,
        reasonCode: "CALCITE_SUBJECT_IDENTITY_MISSING",
      },
      gap: gap(
        observation,
        "CALCITE_SUBJECT_IDENTITY_MISSING",
        "Calcite observation is evaluated but no exact physical field or relation subject can be recovered.",
        proofRefs,
        node.nativeRelationId,
        requestRootNodeIds(request),
      ),
    };
  const evidence: CalciteOperatorCausalEvidence = {
    evidenceId: evidenceId(
      observation.observationId,
      descriptor,
      requestRootNodeIds(request),
    ),
    taskId: request.taskId,
    statementId: request.statementId,
    requestRootNodeIds: requestRootNodeIds(request),
    observationId: observation.observationId,
    observationKind: observation.kind,
    status: "MAPPED",
    mappingId: resolved.mapping.mappingId,
    nativeRelationId: resolved.mapping.nativeRelationId,
    nativeRelationOccurrenceId: resolved.mapping.nativeRelationOccurrenceId,
    relationNodeKind: node.kind,
    operatorKind: descriptor.operatorKind,
    operatorVariant: descriptor.operatorVariant,
    operatorRole: descriptor.operatorRole,
    effectKind: descriptor.effectKind,
    localEdgeKind: descriptor.localEdgeKind,
    rootDependenceKind: descriptor.rootDependenceKind,
    subjects: effectiveSubjects,
    values: sortedUnknown(valuesOf(observation)),
    evidenceRefs: [...observation.evidenceRefs],
    proofRefs,
  };
  return { evidence };
}

/** Convert one Calcite response into exact operator evidence. */
export function buildCalciteCausalEvidence(
  input: BuildCalciteCausalEvidenceInput,
): CalciteCausalEvidenceReport {
  const observations: CalciteOperatorCausalEvidence[] = [];
  const gaps: CalciteCausalEvidenceGap[] = [];
  const definitions: SemanticDependencyDefinition[] = [];
  const applications: SemanticDependencyApplication[] = [];
  const edges: SemanticDependencyEdge[] = [];
  if (input.response.status !== "SUCCESS") {
    gaps.push(gap(
      undefined,
      "CALCITE_SIDECAR_NOT_EVALUATED",
      `Calcite sidecar status is ${input.response.status}; no semantic dependency is inferred.`,
    ));
  } else {
    for (const observation of input.response.observations) {
      const result = mappedEvidence(
        input.request,
        observation,
      );
      if (result.evidence) {
        observations.push(result.evidence);
        const semantic = buildSemanticObjects(result.evidence, input.rootTargetFieldId, input.request.taskId);
        definitions.push(...semantic.definitions);
        applications.push(...semantic.applications);
        edges.push(...semantic.edges);
      }
      if (result.gap) gaps.push(result.gap);
    }
  }
  return {
    taskId: input.request.taskId,
    statementId: input.request.statementId,
    responseStatus: input.response.status,
    fingerprint: input.response.fingerprint,
    observations: observations.sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
    gaps: gaps.sort((left, right) => left.gapId.localeCompare(right.gapId)),
    definitions: definitions.sort((left, right) => left.dependencyId.localeCompare(right.dependencyId)),
    applications: applications.sort((left, right) => left.applicationId.localeCompare(right.applicationId)),
    edges: edges.sort((left, right) => left.edgeId.localeCompare(right.edgeId)),
  };
}

/**
 * Add only exact Calcite corroboration refs to an existing Native
 * normalization.  Dependency identities and path certainty remain Native
 * owned; an unmatched Calcite observation is returned explicitly instead of
 * becoming a new canonical dependency.
 */
export function augmentSemanticNormalizationWithCalciteEvidence(
  normalization: SemanticDependencyNormalization,
  report: Pick<CalciteCausalEvidenceReport, "observations">,
): CalciteNormalizationAugmentation {
  const calciteByIdentity = new Map<string, CalciteOperatorCausalEvidence[]>();
  for (const evidence of report.observations) {
    if (
      evidence.status !== "MAPPED" ||
      evidence.operatorKind === undefined ||
      evidence.operatorVariant === undefined ||
      evidence.operatorRole === undefined ||
      evidence.effectKind === undefined ||
      evidence.localEdgeKind === undefined
    )
      continue;
    const keyBase = {
      operatorKind: evidence.operatorKind,
      operatorVariant: evidence.operatorVariant,
      operatorRole: evidence.operatorRole,
      effectKind: evidence.effectKind,
      localEdgeKind: evidence.localEdgeKind,
    };
    for (const subject of evidence.subjects) {
      const key = dependencyIdentityKey({ ...keyBase, subject });
      const values = calciteByIdentity.get(key) ?? [];
      values.push(evidence);
      calciteByIdentity.set(key, values);
    }
  }

  const refsByDependency = new Map<string, ProofRef[]>();
  const matchesByDependency = new Map<string, readonly CalciteOperatorCausalEvidence[]>();
  const matchedObservationIds = new Set<string>();
  const unmappedObservationIds = new Set<string>();
  for (const evidence of report.observations) {
    if (evidence.status === "MAPPED") unmappedObservationIds.add(evidence.observationId);
  }
  for (const definition of normalization.definitions) {
    const matches = calciteByIdentity.get(dependencyIdentityKey(definition)) ?? [];
    if (matches.length !== 1) continue;
    const refs = refsByDependency.get(definition.dependencyId) ?? [];
    refs.push(...matches[0]!.proofRefs);
    refsByDependency.set(definition.dependencyId, refs);
    matchesByDependency.set(definition.dependencyId, matches);
    matchedObservationIds.add(matches[0]!.observationId);
    unmappedObservationIds.delete(matches[0]!.observationId);
  }

  const definitions = normalization.definitions.map((definition) => {
    const calciteRefs = refsByDependency.get(definition.dependencyId) ?? [];
    return calciteRefs.length === 0
      ? definition
      : { ...definition, proofRefs: mergeProofRefs(definition.proofRefs, calciteRefs) };
  });
  const applications = normalization.applications.map((application) => {
    const calciteRefs = (matchesByDependency.get(application.dependencyId) ?? [])
      .filter((evidence) =>
        application.scopeRelationId === undefined ||
        (evidence.nativeRelationId !== undefined &&
          sameRelationId(application.scopeRelationId, evidence.nativeRelationId)),
      )
      .flatMap((evidence) => evidence.proofRefs);
    return calciteRefs.length === 0
      ? application
      : { ...application, proofRefs: mergeProofRefs(application.proofRefs, calciteRefs) };
  });
  const edges = normalization.edges.map((edge) => {
    const calciteRefs = (matchesByDependency.get(edge.dependencyId) ?? [])
      .filter((evidence) =>
        edge.scopeRelationId === undefined ||
        (evidence.nativeRelationId !== undefined &&
          sameRelationId(edge.scopeRelationId, evidence.nativeRelationId)),
      )
      .flatMap((evidence) => evidence.proofRefs);
    return calciteRefs.length === 0
      ? edge
      : { ...edge, proofRefs: mergeProofRefs(edge.proofRefs, calciteRefs) };
  });
  return {
    normalization: {
      ...normalization,
      definitions,
      applications,
      edges,
      semanticEdges: edges,
    },
    matchedObservationIds: [...matchedObservationIds].sort(),
    unmappedObservationIds: [...unmappedObservationIds].sort(),
  };
}
