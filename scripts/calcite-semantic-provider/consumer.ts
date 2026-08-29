import type {
  CandidateTaskSemanticFacts,
  DependencyKind,
  ImpactKind,
} from "./contract.ts";

export interface SemanticFactsQuery {
  readonly facts: CandidateTaskSemanticFacts;
  dependencyById(id: string): CandidateTaskSemanticFacts["dependencies"][number] | undefined;
  dependenciesByImpact(impactKind: ImpactKind): readonly CandidateTaskSemanticFacts["dependencies"][number][];
  dependenciesByKind(kind: DependencyKind): readonly CandidateTaskSemanticFacts["dependencies"][number][];
  metadataFor(subjectRef: string): readonly CandidateTaskSemanticFacts["metadata"][number][];
  capabilityStatus(capability: string): CandidateTaskSemanticFacts["capabilities"][number] | undefined;
}

export function semanticFactsQuery(facts: CandidateTaskSemanticFacts): SemanticFactsQuery {
  const dependencyIndex = new Map(facts.dependencies.map((item) => [item.dependencyId, item]));
  const byImpact = group(facts.dependencies, (item) => item.impactKind);
  const byKind = group(facts.dependencies, (item) => item.dependencyKind);
  const metadata = group(facts.metadata, (item) => item.subjectRef);
  const capabilities = new Map(facts.capabilities.map((item) => [item.capability, item]));
  return Object.freeze({
    facts,
    dependencyById: (id: string) => dependencyIndex.get(id),
    dependenciesByImpact: (kind: ImpactKind) => byImpact.get(kind) ?? [],
    dependenciesByKind: (kind: DependencyKind) => byKind.get(kind) ?? [],
    metadataFor: (subjectRef: string) => metadata.get(subjectRef) ?? [],
    capabilityStatus: (capability: string) => capabilities.get(capability),
  });
}

function group<T>(values: readonly T[], key: (value: T) => string): ReadonlyMap<string, readonly T[]> {
  const output = new Map<string, T[]>();
  for (const value of values) output.set(key(value), [...(output.get(key(value)) ?? []), value]);
  return output;
}
