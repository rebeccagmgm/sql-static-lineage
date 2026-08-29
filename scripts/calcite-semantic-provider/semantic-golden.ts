import { canonicalJson } from "../machine-facts/machine-facts-contract.ts";
import type {
  CandidateTaskSemanticFacts,
  DependencyKind,
  ImpactKind,
  OperatorInputRole,
  OperatorKind,
} from "./contract.ts";

export interface SemanticEdgeGolden {
  readonly dependencyKind: DependencyKind;
  readonly impactKind: ImpactKind;
  readonly operatorKind: OperatorKind;
  readonly joinType?: "INNER" | "LEFT" | "RIGHT" | "FULL" | "SEMI" | "ANTI" | "CROSS";
  readonly inputRoles?: readonly OperatorInputRole[];
  readonly from: readonly string[];
  readonly to: readonly string[];
}

export interface SemanticGoldenResult {
  readonly status: "SEMANTIC_EDGE_VERIFIED" | "PARTIAL";
  readonly actualEdges: readonly SemanticEdgeGolden[];
  readonly missingEdges: readonly SemanticEdgeGolden[];
  readonly unexpectedEdges: readonly SemanticEdgeGolden[];
  readonly duplicateEdges: readonly SemanticEdgeGolden[];
}

export function semanticEdges(facts: CandidateTaskSemanticFacts): readonly SemanticEdgeGolden[] {
  const relationLabels = buildRelationLabels(facts);
  const fieldLabels = new Map(facts.fields.map((field) => [
    field.fieldId,
    `${relationLabels.get(field.relationId)}.field:${field.name.toLowerCase()}#${field.slot}`,
  ]));
  const operators = new Map(facts.operators.map((operator) => [operator.operatorId, operator]));
  const refLabel = (ref: string): string => fieldLabels.get(ref) ?? relationLabels.get(ref) ?? ref;
  return facts.dependencies.map((dependency) => {
    const operator = operators.get(dependency.operatorId);
    if (!operator) throw new Error(`operator missing for ${dependency.dependencyId}`);
    return {
      dependencyKind: dependency.dependencyKind,
      impactKind: dependency.impactKind,
      operatorKind: operator.kind,
      ...(operator.joinType ? { joinType: operator.joinType } : {}),
      ...(operator.inputRoles ? { inputRoles: [...operator.inputRoles] } : {}),
      from: dependency.fromRefs.map(refLabel).sort(),
      to: dependency.toRefs.map(refLabel).sort(),
    };
  });
}

export function compareSemanticGolden(
  facts: CandidateTaskSemanticFacts,
  expected: readonly SemanticEdgeGolden[],
): SemanticGoldenResult {
  const actual = semanticEdges(facts);
  const actualByKey = grouped(actual);
  const expectedByKey = grouped(expected);
  const missingEdges = [...expectedByKey]
    .filter(([key]) => !actualByKey.has(key))
    .map(([, values]) => values[0]!);
  const unexpectedEdges = [...actualByKey]
    .filter(([key]) => !expectedByKey.has(key))
    .map(([, values]) => values[0]!);
  const duplicateEdges = [...actualByKey.values()]
    .filter((values) => values.length > 1)
    .map((values) => values[0]!);
  return {
    status: missingEdges.length === 0 && unexpectedEdges.length === 0 && duplicateEdges.length === 0
      ? "SEMANTIC_EDGE_VERIFIED"
      : "PARTIAL",
    actualEdges: [...actual].sort(compareEdges),
    missingEdges: missingEdges.sort(compareEdges),
    unexpectedEdges: unexpectedEdges.sort(compareEdges),
    duplicateEdges: duplicateEdges.sort(compareEdges),
  };
}

function buildRelationLabels(facts: CandidateTaskSemanticFacts): Map<string, string> {
  const counters = new Map<string, number>();
  const labels = new Map<string, string>();
  const ordered = [...facts.relations].sort((left, right) =>
    (left.providerOrdinal ?? Number.MAX_SAFE_INTEGER) -
      (right.providerOrdinal ?? Number.MAX_SAFE_INTEGER) || left.relationId.localeCompare(right.relationId));
  for (const relation of ordered) {
    const base = relation.kind === "TABLE_SCAN" && relation.qualifiedTableName
      ? `table:${relation.qualifiedTableName.toLowerCase()}`
      : `relation:${relation.kind.toLowerCase()}`;
    const occurrence = counters.get(base) ?? 0;
    counters.set(base, occurrence + 1);
    labels.set(relation.relationId, `${base}#${occurrence}`);
  }
  return labels;
}

function grouped(edges: readonly SemanticEdgeGolden[]): Map<string, SemanticEdgeGolden[]> {
  const output = new Map<string, SemanticEdgeGolden[]>();
  for (const edge of edges) {
    const key = canonicalJson(edge);
    output.set(key, [...(output.get(key) ?? []), edge]);
  }
  return output;
}

function compareEdges(left: SemanticEdgeGolden, right: SemanticEdgeGolden): number {
  return canonicalJson(left).localeCompare(canonicalJson(right));
}
