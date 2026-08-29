import type { CandidateTaskSemanticFacts } from "./contract.ts";

export interface SourceSpan { readonly start: number; readonly end: number }
export interface NativeFieldEvidence {
  readonly slot: number;
  readonly nativeFieldOccurrenceId: string;
  readonly physicalFieldId?: string;
  readonly sourceSpan: SourceSpan;
  readonly evidenceRefs: readonly string[];
}
export interface NativeRelationEvidence {
  readonly providerRelationOrdinal: number;
  readonly nativeRelationOccurrenceId: string;
  readonly qualifiedPhysicalTable?: string;
  readonly sourceSpan: SourceSpan;
  readonly evidenceRefs: readonly string[];
  readonly fields: readonly NativeFieldEvidence[];
}
export interface NativeStatementEvidence {
  readonly sqlSourceId: string;
  readonly statementOrdinal: number;
  readonly sqlSha256: string;
  readonly relations: readonly NativeRelationEvidence[];
}

export function assembleNativeEvidence(
  facts: CandidateTaskSemanticFacts,
  native: NativeStatementEvidence,
): CandidateTaskSemanticFacts {
  if (facts.input.sqlSourceId !== native.sqlSourceId ||
      facts.input.statementOrdinal !== native.statementOrdinal ||
      facts.input.sqlSha256 !== native.sqlSha256) {
    return withAssemblyIssue(facts, "NATIVE_STATEMENT_IDENTITY_MISMATCH",
      "Native statement identity does not exactly match the Calcite input.");
  }
  const nativeByOrdinal = groupedIndex(native.relations, (item) => item.providerRelationOrdinal);
  const refEvidence = new Map<string, { nativeRefId: string; sourceSpan: SourceSpan; evidenceRefs: readonly string[] }>();
  const ambiguousRefs = new Set<string>();
  for (const relation of facts.relations) {
    if (relation.providerOrdinal === undefined) continue;
    const candidates = nativeByOrdinal.get(relation.providerOrdinal) ?? [];
    if (candidates.length > 1) {
      ambiguousRefs.add(relation.relationId);
      for (const fieldId of relation.outputFieldIds) ambiguousRefs.add(fieldId);
      continue;
    }
    const candidate = candidates[0];
    if (!candidate || (relation.qualifiedTableName !== undefined &&
        canonicalName(relation.qualifiedTableName) !== canonicalName(candidate.qualifiedPhysicalTable))) continue;
    refEvidence.set(relation.relationId, {
      nativeRefId: candidate.nativeRelationOccurrenceId,
      sourceSpan: candidate.sourceSpan,
      evidenceRefs: sorted(candidate.evidenceRefs),
    });
    const fieldBySlot = groupedIndex(candidate.fields, (item) => item.slot);
    for (const fieldId of relation.outputFieldIds) {
      const field = facts.fields.find((item) => item.fieldId === fieldId);
      const nativeFields = field ? fieldBySlot.get(field.slot) ?? [] : [];
      if (nativeFields.length > 1) {
        ambiguousRefs.add(fieldId);
        continue;
      }
      const nativeField = nativeFields[0];
      if (!field || !nativeField) continue;
      refEvidence.set(field.fieldId, {
        nativeRefId: nativeField.nativeFieldOccurrenceId,
        sourceSpan: nativeField.sourceSpan,
        evidenceRefs: sorted(nativeField.evidenceRefs),
      });
    }
  }
  const assemblyIssues: CandidateTaskSemanticFacts["issues"][number][] = [];
  type ConcreteEvidence = { nativeRefId: string; sourceSpan: SourceSpan; evidenceRefs: readonly string[] };
  type Resolution = { readonly status: "EXACT"; readonly evidence: readonly ConcreteEvidence[] } |
    { readonly status: "AMBIGUOUS" | "UNMAPPABLE"; readonly evidence: readonly [] };
  const dependenciesByTarget = new Map<string, CandidateTaskSemanticFacts["dependencies"]>();
  for (const dependency of facts.dependencies) {
    for (const target of dependency.toRefs) {
      dependenciesByTarget.set(target, [...(dependenciesByTarget.get(target) ?? []), dependency]);
    }
  }
  const resolutionCache = new Map<string, Resolution>();
  const resolveRef = (ref: string, visiting: ReadonlySet<string>): Resolution => {
    const cached = resolutionCache.get(ref);
    if (cached) return cached;
    if (ambiguousRefs.has(ref)) return { status: "AMBIGUOUS", evidence: [] };
    const direct = refEvidence.get(ref);
    if (direct) return { status: "EXACT", evidence: [direct] };
    if (visiting.has(ref)) return { status: "UNMAPPABLE", evidence: [] };
    const producers = dependenciesByTarget.get(ref) ?? [];
    if (producers.length === 0) return { status: "UNMAPPABLE", evidence: [] };
    const nextVisiting = new Set(visiting);
    nextVisiting.add(ref);
    const resolutions = producers.flatMap((dependency) =>
      dependency.fromRefs.map((source) => resolveRef(source, nextVisiting)));
    const failed = resolutions.find((item) => item.status !== "EXACT");
    if (failed) return failed;
    const evidence = uniqueEvidence(resolutions.flatMap((item) => item.evidence));
    const result: Resolution = evidence.length > 0
      ? { status: "EXACT", evidence }
      : { status: "UNMAPPABLE", evidence: [] };
    resolutionCache.set(ref, result);
    return result;
  };
  const evidenceMappings = facts.dependencies.map((dependency) => {
    const refs = [...dependency.fromRefs, ...dependency.toRefs];
    const resolutions = refs.map((ref) => resolveRef(ref, new Set<string>()));
    if (resolutions.some((item) => item.status === "AMBIGUOUS")) {
      assemblyIssues.push({
        issueId: `issue:assembler:ambiguous:${dependency.dependencyId}`,
        code: "NATIVE_OCCURRENCE_AMBIGUOUS",
        message: "Multiple Native occurrences match a Provider-local dependency endpoint.",
        severity: "WARNING",
        subjectRefs: [dependency.dependencyId],
      });
      return {
        mappingId: `mapping:${dependency.dependencyId}`,
        providerRefId: dependency.dependencyId,
        mappingStatus: "AMBIGUOUS" as const,
        evidenceRefs: [] as string[],
      };
    }
    if (resolutions.some((item) => item.status === "UNMAPPABLE")) {
      assemblyIssues.push({
        issueId: `issue:assembler:unmappable:${dependency.dependencyId}`,
        code: "NATIVE_OCCURRENCE_UNMAPPABLE",
        message: "No exact Native occurrence maps every Provider-local dependency endpoint.",
        severity: "WARNING",
        subjectRefs: [dependency.dependencyId],
      });
      return {
        mappingId: `mapping:${dependency.dependencyId}`,
        providerRefId: dependency.dependencyId,
        mappingStatus: "UNMAPPABLE" as const,
        evidenceRefs: [] as string[],
      };
    }
    const concrete = uniqueEvidence(resolutions.flatMap((item) => item.evidence));
    const sourceSpans = uniqueSourceSpans(concrete.map((item) => item.sourceSpan));
    return {
      mappingId: `mapping:${dependency.dependencyId}`,
      providerRefId: dependency.dependencyId,
      nativeRefId: `native-semantic:${dependency.dependencyId}`,
      mappingStatus: "EXACT" as const,
      evidenceRefs: sorted(concrete.flatMap((item) => item.evidenceRefs)),
      ...(sourceSpans.length === 1 ? { sourceSpan: sourceSpans[0] } : {}),
    };
  }).sort((left, right) => left.mappingId.localeCompare(right.mappingId));
  const issues = facts.issues
    .filter((issue) => issue.code !== "NATIVE_EVIDENCE_NOT_ASSEMBLED")
    .concat(assemblyIssues)
    .sort((left, right) => left.issueId.localeCompare(right.issueId));
  const issueIds = new Set(issues.map((issue) => issue.issueId));
  const dependencies = facts.dependencies.map((dependency) => {
    const assemblyIssueRefs = issues
      .filter((issue) => issue.subjectRefs?.includes(dependency.dependencyId))
      .map((issue) => issue.issueId);
    return {
      ...dependency,
      issueRefs: sorted([
        ...dependency.issueRefs.filter((issueRef) => issueIds.has(issueRef)),
        ...assemblyIssueRefs,
      ]),
    };
  });
  return Object.freeze({
    ...facts,
    statementStatus: issues.length === 0 ? "SUCCESS" : "PARTIAL",
    dependencies,
    evidenceMappings,
    issues,
  });
}

function uniqueEvidence<T extends { readonly nativeRefId: string }>(values: readonly T[]): T[] {
  return [...new Map(values.map((value) => [value.nativeRefId, value])).values()]
    .sort((left, right) => left.nativeRefId.localeCompare(right.nativeRefId));
}

function uniqueSourceSpans(values: readonly SourceSpan[]): SourceSpan[] {
  return [...new Map(values.map((value) => [`${value.start}:${value.end}`, value])).values()]
    .sort((left, right) => left.start - right.start || left.end - right.end);
}

function withAssemblyIssue(
  facts: CandidateTaskSemanticFacts,
  code: string,
  message: string,
): CandidateTaskSemanticFacts {
  return {
    ...facts,
    statementStatus: "PARTIAL",
    issues: [...facts.issues, {
      issueId: `issue:assembler:${code.toLowerCase()}`,
      code,
      message,
      severity: "ERROR" as const,
      subjectRefs: [facts.input.sqlSourceId],
    }].sort((left, right) => left.issueId.localeCompare(right.issueId)),
  };
}

function groupedIndex<T>(values: readonly T[], key: (value: T) => number): Map<number, T[]> {
  const output = new Map<number, T[]>();
  for (const value of values) {
    const id = key(value);
    output.set(id, [...(output.get(id) ?? []), value]);
  }
  return output;
}
function canonicalName(value: string | undefined): string | undefined {
  return value?.split(".").map((part) => part.trim().toLowerCase()).join(".");
}
function sorted(values: readonly string[]): string[] { return [...new Set(values)].sort(); }
