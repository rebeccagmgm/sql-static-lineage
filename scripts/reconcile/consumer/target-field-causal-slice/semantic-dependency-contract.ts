import {
  canonicalJson,
  sha256,
} from "../../../machine-facts/machine-facts-contract.ts";

export const SUBJECT_KINDS = ["PHYSICAL_FIELD", "RELATION_OCCURRENCE"] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

export const EFFECT_KINDS = [
  "VALUE_CONTRIBUTION",
  "BRANCH_SELECTION",
  "ROW_MEMBERSHIP",
  "MULTIPLICITY",
  "GROUPING",
  "ORDERING",
  "WINDOW_CONTEXT",
  "SET_MEMBERSHIP",
  "RELATION_EXISTENCE",
] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];

export const OPERATOR_KINDS = [
  "PROJECT",
  "FILTER",
  "JOIN",
  "AGGREGATE",
  "DISTINCT",
  "SETOP",
  "WINDOW",
  "TOP_N",
  "SUBQUERY",
  "RELATION",
] as const;
export type OperatorKind = (typeof OPERATOR_KINDS)[number];

export const ROOT_DEPENDENCE_KINDS = [
  "VALUE_TO_TARGET",
  "CONTROL_TO_TARGET",
  "RELATION_TO_TARGET",
] as const;
export type RootDependenceKind = (typeof ROOT_DEPENDENCE_KINDS)[number];

export const LOCAL_EDGE_KINDS = [
  "VALUE_FLOW",
  "EXPRESSION_CONTROL",
  "ROWSET_CONTROL",
  "WINDOW_CONTEXT",
  "RELATION_CONTEXT",
] as const;
export type LocalEdgeKind = (typeof LOCAL_EDGE_KINDS)[number];

export const PATH_CERTAINTIES = [
  "CONFIRMED",
  "CONDITIONAL",
  "UNKNOWN",
] as const;
export type PathCertainty = (typeof PATH_CERTAINTIES)[number];

/** Support describes the semantic rule, not the evidence status of a path. */
export const SUPPORT_STATUSES = [
  "SUPPORTED",
  "UNKNOWN",
  "UNSUPPORTED",
] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const PROOF_REF_KINDS = [
  "CANONICAL_FACT",
  "SOURCE_SPAN",
  "SCHEMA",
  "READ_OCCURRENCE",
  "WRITE_OBSERVATION",
  "PRODUCER_BRIDGE",
  "SUPPORT_MATRIX",
  "GAP",
  "NEGATIVE_PROOF",
] as const;
export type ProofRefKind = (typeof PROOF_REF_KINDS)[number];

export interface PhysicalFieldSubject {
  readonly subjectKind: "PHYSICAL_FIELD";
  readonly physicalFieldId: string;
}

export interface RelationOccurrenceSubject {
  readonly subjectKind: "RELATION_OCCURRENCE";
  readonly relationOccurrenceId: string;
}

export type SemanticSubject = PhysicalFieldSubject | RelationOccurrenceSubject;

export interface ProofRef {
  readonly proofRefId: string;
  readonly kind: ProofRefKind;
  readonly refId: string;
  readonly detail?: string;
}

export interface SemanticDependencyIdentity {
  readonly subject: SemanticSubject;
  readonly effectKind: EffectKind;
  readonly operatorKind: OperatorKind;
  readonly operatorVariant: string;
  readonly operatorRole: string;
  readonly localEdgeKind: LocalEdgeKind;
}

export interface SemanticDependencyDefinition extends SemanticDependencyIdentity {
  readonly dependencyId: string;
  readonly supportStatus: SupportStatus;
  readonly proofRefs: readonly ProofRef[];
}

export interface SemanticDependencyApplication {
  readonly applicationId: string;
  readonly dependencyId: string;
  readonly rootTargetFieldId: string;
  readonly rootDependenceKind: RootDependenceKind;
  readonly pathCertainty: PathCertainty;
  readonly proofRefs: readonly ProofRef[];
}

export interface SemanticDependencyEdge {
  readonly edgeId: string;
  readonly fromSubject: SemanticSubject;
  readonly toSubject: SemanticSubject;
  readonly dependencyId: string;
  readonly rootDependenceKind: RootDependenceKind;
  readonly localEdgeKind: LocalEdgeKind;
  readonly pathCertainty: PathCertainty;
  readonly proofRefs: readonly ProofRef[];
}

export interface SemanticDependencyIdInput extends SemanticDependencyIdentity {
  readonly namespace?: string;
}

function idFor(namespace: string, value: unknown): string {
  return `${namespace}:${sha256(canonicalJson(value))}`;
}

export function canonicalProofRefId(kind: ProofRefKind, refId: string): string {
  return idFor("proof-ref", { kind, refId });
}

export function createProofRef(
  kind: ProofRefKind,
  refId: string,
  detail?: string,
): ProofRef {
  const proofRefId = canonicalProofRefId(kind, refId);
  return detail === undefined
    ? { proofRefId, kind, refId }
    : { proofRefId, kind, refId, detail };
}

export function canonicalSemanticDependencyId(
  input: SemanticDependencyIdInput,
): string {
  const { namespace: _namespace, ...identity } = input;
  return idFor(input.namespace ?? "semantic-dependency", identity);
}

export function canonicalSemanticApplicationId(
  rootTargetFieldId: string,
  dependencyId: string,
  rootDependenceKind: RootDependenceKind,
): string {
  return idFor("semantic-application", {
    rootTargetFieldId,
    dependencyId,
    rootDependenceKind,
  });
}

export function canonicalSemanticEdgeId(input: {
  readonly dependencyId: string;
  readonly fromSubject: SemanticSubject;
  readonly toSubject: SemanticSubject;
  readonly rootDependenceKind: RootDependenceKind;
  readonly localEdgeKind: LocalEdgeKind;
}): string {
  return idFor("semantic-edge", input);
}

export function makeSemanticDependencyDefinition(
  identity: SemanticDependencyIdentity,
  supportStatus: SupportStatus,
  proofRefs: readonly ProofRef[] = [],
): SemanticDependencyDefinition {
  return {
    ...identity,
    dependencyId: canonicalSemanticDependencyId(identity),
    supportStatus,
    proofRefs: [...proofRefs].sort((left, right) =>
      left.proofRefId.localeCompare(right.proofRefId),
    ),
  };
}
export function makeSemanticDependencyApplication(input: {
  readonly dependencyId: string;
  readonly rootTargetFieldId: string;
  readonly rootDependenceKind: RootDependenceKind;
  readonly pathCertainty: PathCertainty;
  readonly proofRefs?: readonly ProofRef[];
}): SemanticDependencyApplication {
  return {
    ...input,
    applicationId: canonicalSemanticApplicationId(
      input.rootTargetFieldId,
      input.dependencyId,
      input.rootDependenceKind,
    ),
    proofRefs: [...(input.proofRefs ?? [])].sort((left, right) =>
      left.proofRefId.localeCompare(right.proofRefId),
    ),
  };
}

export function makeSemanticDependencyEdge(input: {
  readonly dependencyId: string;
  readonly fromSubject: SemanticSubject;
  readonly toSubject: SemanticSubject;
  readonly rootDependenceKind: RootDependenceKind;
  readonly localEdgeKind: LocalEdgeKind;
  readonly pathCertainty: PathCertainty;
  readonly proofRefs?: readonly ProofRef[];
}): SemanticDependencyEdge {
  const identity = {
    dependencyId: input.dependencyId,
    fromSubject: input.fromSubject,
    toSubject: input.toSubject,
    rootDependenceKind: input.rootDependenceKind,
    localEdgeKind: input.localEdgeKind,
  };
  return {
    ...input,
    edgeId: canonicalSemanticEdgeId(identity),
    proofRefs: [...(input.proofRefs ?? [])].sort((left, right) =>
      left.proofRefId.localeCompare(right.proofRefId),
    ),
  };
}

