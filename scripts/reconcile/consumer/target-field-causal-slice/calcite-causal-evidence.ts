import type {
  DifferentialObservation,
  DifferentialResponse,
  PlanFactsRelRequest,
} from "../../../calcite-differential/protocol.ts";
import type {
  PlanFactsRelNode,
  RelOutputField,
  RelTypedExpression,
} from "../../../calcite-differential/plan-facts-rel-contract.ts";
import {
  createProofRef,
  type EffectKind,
  type LocalEdgeKind,
  type OperatorKind,
  type ProofRef,
  type RootDependenceKind,
  type SemanticSubject,
} from "./semantic-dependency-contract.ts";

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
  readonly reportKind: "INDEPENDENT_CALCITE_CAUSAL_EVIDENCE";
  readonly reportVersion: 1;
  readonly taskId: string;
  readonly statementId: string;
  readonly responseStatus: DifferentialResponse["status"];
  readonly fingerprint: DifferentialResponse["fingerprint"];
  readonly observations: readonly CalciteOperatorCausalEvidence[];
  readonly gaps: readonly CalciteCausalEvidenceGap[];
  readonly safety: {
    readonly canonicalArtifactsWritten: false;
    readonly causalDecisionsWritten: false;
    readonly negativeConclusionsWritten: false;
  };
}

export interface BuildCalciteCausalEvidenceInput {
  readonly request: PlanFactsRelRequest;
  readonly response: DifferentialResponse;
  /** Compatibility-only; independent evidence has no target edge. */
  readonly rootTargetFieldId?: string;
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
      ...(mapping.nativeOutputOrdinal === undefined
        ? {}
        : { nativeOutputOrdinal: mapping.nativeOutputOrdinal }),
      ...(mapping.nativeFieldId === undefined
        ? {}
        : { nativeFieldId: mapping.nativeFieldId }),
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
    ...(mapping.nativeOutputOrdinal === undefined
      ? {}
      : { nativeOutputOrdinal: mapping.nativeOutputOrdinal }),
    ...(mapping.nativeFieldId === undefined
      ? {}
      : { nativeFieldId: mapping.nativeFieldId }),
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
  const keys = observation.kind === "uniqueKeys"
    ? ["ordinals"]
    : observation.kind === "functionalDependencies"
      ? ["determinantOrdinals", "dependentOrdinals"]
      : [];
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

function subjectsFor(
  request: PlanFactsRelRequest,
  mapping: MappingContext,
  node: PlanFactsRelNode,
  observation: DifferentialObservation,
): readonly SemanticSubject[] {
  if (observation.kind === "uniqueKeys" || observation.kind === "functionalDependencies") {
    if (valuesOf(observation).length === 0) return [relationSubject(mapping)];
    return metadataSubjects(node, observation);
  }
  if (observation.kind === "predicates") {
    return uniqueSubjects(
      nodeExpressions(node).flatMap((expression) =>
        expressionFieldRefs(expression).flatMap((fieldRef) => {
          const subject = physicalSubject(request, fieldRef);
          return subject ? [subject] : [];
        }),
      ),
    );
  }
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
    const operatorKind: OperatorKind = node.kind === "AGGREGATE"
      ? "AGGREGATE"
      : node.kind === "WINDOW"
        ? "WINDOW"
        : "PROJECT";
    return {
      operatorKind,
      operatorVariant: node.kind === "AGGREGATE"
        ? "AGGREGATE_INPUT"
        : node.kind === "WINDOW"
          ? "WINDOW"
          : "COLUMN_EXPRESSION",
      operatorRole: node.kind === "AGGREGATE"
        ? "AGGREGATE_INPUT"
        : node.kind === "WINDOW"
          ? "WINDOW_INPUT"
          : "VALUE",
      effectKind: "VALUE_CONTRIBUTION",
      localEdgeKind: "VALUE_FLOW",
      rootDependenceKind: "VALUE_TO_TARGET",
    };
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
    return {
      operatorKind,
      operatorVariant: node.kind === "JOIN"
        ? node.joinType
        : node.kind === "AGGREGATE"
          ? "GROUP_BY"
          : node.kind,
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
    case "AGGREGATE":
      return {
        operatorKind: "AGGREGATE",
        operatorVariant: "GROUP_BY",
        operatorRole: "GROUPING_AND_CARDINALITY",
        effectKind: "GROUPING",
        localEdgeKind: "ROWSET_CONTROL",
        rootDependenceKind: "CONTROL_TO_TARGET",
      };
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

function baseEvidence(
  request: PlanFactsRelRequest,
  observation: DifferentialObservation,
  status: CalciteCausalEvidenceStatus,
  values: readonly unknown[],
  reasonCode?: string,
  mapping?: MappingContext,
  node?: PlanFactsRelNode,
  descriptor?: OperatorDescriptor,
  proofRefs: readonly ProofRef[] = [],
): CalciteOperatorCausalEvidence {
  return {
    evidenceId: descriptor
      ? evidenceId(observation.observationId, descriptor, requestRootNodeIds(request))
      : observationEvidenceId(request, observation.observationId),
    taskId: request.taskId,
    statementId: request.statementId,
    requestRootNodeIds: requestRootNodeIds(request),
    observationId: observation.observationId,
    observationKind: observation.kind,
    status,
    ...(mapping
      ? {
          mappingId: mapping.mappingId,
          nativeRelationId: mapping.nativeRelationId,
          nativeRelationOccurrenceId: mapping.nativeRelationOccurrenceId,
        }
      : {}),
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
    subjects: [],
    values: sortedUnknown(values),
    evidenceRefs: [...observation.evidenceRefs],
    proofRefs: [...proofRefs],
    ...(reasonCode ? { reasonCode } : {}),
  };
}

function mappedEvidence(
  request: PlanFactsRelRequest,
  observation: DifferentialObservation,
): {
  readonly evidence?: CalciteOperatorCausalEvidence;
  readonly gap?: CalciteCausalEvidenceGap;
} {
  const roots = requestRootNodeIds(request);
  if (observation.status !== "EVALUATED") {
    const mapping = locationForNonEvaluated(request, observation);
    const node = mapping ? nodeFor(request, mapping) : undefined;
    const descriptor = node ? descriptorFor(node, observation) : undefined;
    return {
      evidence: baseEvidence(
        request,
        observation,
        "NOT_EVALUATED",
        [],
        "CALCITE_OBSERVATION_NOT_EVALUATED",
        mapping,
        node,
        descriptor,
      ),
      gap: gap(
        observation,
        "CALCITE_OBSERVATION_NOT_EVALUATED",
        "Calcite did not evaluate this observation; it cannot support a positive or negative causal decision.",
        [],
        undefined,
        roots,
      ),
    };
  }

  const resolved = mappingFor(request, observation);
  if (!resolved.mapping)
    return {
      evidence: baseEvidence(
        request,
        observation,
        "UNMAPPABLE",
        valuesOf(observation),
        resolved.reason,
      ),
      gap: gap(
        observation,
        resolved.reason ?? "CALCITE_MAPPING_INVALID",
        "Calcite observation does not have one exact mapping with bound evidence.",
        [],
        undefined,
        roots,
      ),
    };

  const mapping = resolved.mapping;
  const node = nodeFor(request, mapping);
  if (!node)
    return {
      evidence: baseEvidence(
        request,
        observation,
        "UNMAPPABLE",
        valuesOf(observation),
        "CALCITE_RELATION_MAPPING_NOT_UNIQUE",
        mapping,
      ),
      gap: gap(
        observation,
        "CALCITE_RELATION_MAPPING_NOT_UNIQUE",
        "Calcite observation does not map to exactly one Native relation occurrence.",
        [],
        mapping.nativeRelationId,
        roots,
      ),
    };

  const descriptor = descriptorFor(node, observation);
  if (!descriptor)
    return {
      evidence: baseEvidence(
        request,
        observation,
        "UNMAPPABLE",
        valuesOf(observation),
        "CALCITE_OPERATOR_MAPPING_UNSUPPORTED",
        mapping,
        node,
      ),
      gap: gap(
        observation,
        "CALCITE_OPERATOR_MAPPING_UNSUPPORTED",
        `Calcite observation maps to unsupported Native relation kind ${node.kind}.`,
        [],
        node.nativeRelationId,
        roots,
      ),
    };

  const proofRefs = proofRefsFor(observation, mapping);
  const subjects = subjectsFor(request, mapping, node, observation);
  const effectiveSubjects = subjects.length > 0
    ? subjects
    : observation.kind === "rowCountCardinality" || observation.kind === "tableOccurrences"
      ? [relationSubject(mapping)]
      : [];
  if (effectiveSubjects.length === 0)
    return {
      evidence: baseEvidence(
        request,
        observation,
        "UNMAPPABLE",
        valuesOf(observation),
        "CALCITE_SUBJECT_IDENTITY_MISSING",
        mapping,
        node,
        descriptor,
        proofRefs,
      ),
      gap: gap(
        observation,
        "CALCITE_SUBJECT_IDENTITY_MISSING",
        "Calcite observation is evaluated but no exact physical field or relation subject can be recovered.",
        proofRefs,
        node.nativeRelationId,
        roots,
      ),
    };

  return {
    evidence: {
      ...baseEvidence(
        request,
        observation,
        "MAPPED",
        valuesOf(observation),
        undefined,
        mapping,
        node,
        descriptor,
        proofRefs,
      ),
      subjects: effectiveSubjects,
    },
  };
}

export function buildCalciteCausalEvidence(
  input: BuildCalciteCausalEvidenceInput,
): CalciteCausalEvidenceReport {
  const observations: CalciteOperatorCausalEvidence[] = [];
  const gaps: CalciteCausalEvidenceGap[] = [];
  if (input.response.status !== "SUCCESS") {
    gaps.push(gap(
      undefined,
      "CALCITE_SIDECAR_NOT_EVALUATED",
      `Calcite sidecar status is ${input.response.status}; no semantic dependency is inferred.`,
      [],
      undefined,
      requestRootNodeIds(input.request),
    ));
  } else {
    for (const observation of input.response.observations) {
      const result = mappedEvidence(input.request, observation);
      if (result.evidence) observations.push(result.evidence);
      if (result.gap) gaps.push(result.gap);
    }
  }
  return {
    reportKind: "INDEPENDENT_CALCITE_CAUSAL_EVIDENCE",
    reportVersion: 1,
    taskId: input.request.taskId,
    statementId: input.request.statementId,
    responseStatus: input.response.status,
    fingerprint: input.response.fingerprint,
    observations: observations.sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
    gaps: gaps.sort((left, right) => left.gapId.localeCompare(right.gapId)),
    safety: {
      canonicalArtifactsWritten: false,
      causalDecisionsWritten: false,
      negativeConclusionsWritten: false,
    },
  };
}
