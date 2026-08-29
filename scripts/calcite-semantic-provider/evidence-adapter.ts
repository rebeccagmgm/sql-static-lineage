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
  const nativeByOrdinal = uniqueIndex(native.relations, (item) => item.providerRelationOrdinal);
  const refEvidence = new Map<string, { nativeRefId: string; sourceSpan: SourceSpan; evidenceRefs: readonly string[] }>();
  for (const relation of facts.relations) {
    if (relation.providerOrdinal === undefined || !nativeByOrdinal.has(relation.providerOrdinal)) continue;
    const candidate = nativeByOrdinal.get(relation.providerOrdinal);
    if (!candidate || (relation.qualifiedTableName !== undefined &&
        canonicalName(relation.qualifiedTableName) !== canonicalName(candidate.qualifiedPhysicalTable))) continue;
    refEvidence.set(relation.relationId, {
      nativeRefId: candidate.nativeRelationOccurrenceId,
      sourceSpan: candidate.sourceSpan,
      evidenceRefs: sorted(candidate.evidenceRefs),
    });
    const fieldBySlot = uniqueIndex(candidate.fields, (item) => item.slot);
    for (const fieldId of relation.outputFieldIds) {
      const field = facts.fields.find((item) => item.fieldId === fieldId);
      const nativeField = field && fieldBySlot.get(field.slot);
      if (!field || !nativeField) continue;
      refEvidence.set(field.fieldId, {
        nativeRefId: nativeField.nativeFieldOccurrenceId,
        sourceSpan: nativeField.sourceSpan,
        evidenceRefs: sorted(nativeField.evidenceRefs),
      });
    }
  }
  const mappedIds = new Set<string>();
  const evidenceMappings = facts.dependencies.map((dependency) => {
    const refs = [...dependency.fromRefs, ...dependency.toRefs];
    const mapped = refs.map((ref) => refEvidence.get(ref));
    if (mapped.some((item) => item === undefined)) {
      return {
        mappingId: `mapping:${dependency.dependencyId}`,
        providerRefId: dependency.dependencyId,
        mappingStatus: "UNMAPPABLE" as const,
        evidenceRefs: [] as string[],
      };
    }
    mappedIds.add(dependency.dependencyId);
    const concrete = mapped.filter((item): item is NonNullable<typeof item> => item !== undefined);
    return {
      mappingId: `mapping:${dependency.dependencyId}`,
      providerRefId: dependency.dependencyId,
      nativeRefId: `native-semantic:${dependency.dependencyId}`,
      mappingStatus: "EXACT" as const,
      evidenceRefs: sorted(concrete.flatMap((item) => item.evidenceRefs)),
      sourceSpan: {
        start: Math.min(...concrete.map((item) => item.sourceSpan.start)),
        end: Math.max(...concrete.map((item) => item.sourceSpan.end)),
      },
    };
  }).sort((left, right) => left.mappingId.localeCompare(right.mappingId));
  const issues = facts.issues
    .filter((issue) => issue.code !== "NATIVE_EVIDENCE_NOT_ASSEMBLED" ||
      !issue.subjectRefs?.some((ref) => mappedIds.has(ref)))
    .sort((left, right) => left.issueId.localeCompare(right.issueId));
  const issueIds = new Set(issues.map((issue) => issue.issueId));
  const dependencies = facts.dependencies.map((dependency) => ({
    ...dependency,
    issueRefs: dependency.issueRefs.filter((issueRef) => issueIds.has(issueRef)),
  }));
  return Object.freeze({
    ...facts,
    statementStatus: issues.length === 0 ? "SUCCESS" : "PARTIAL",
    dependencies,
    evidenceMappings,
    issues,
  });
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

function uniqueIndex<T>(values: readonly T[], key: (value: T) => number): Map<number, T | undefined> {
  const output = new Map<number, T | undefined>();
  for (const value of values) {
    const id = key(value);
    output.set(id, output.has(id) ? undefined : value);
  }
  return output;
}
function canonicalName(value: string | undefined): string | undefined {
  return value?.split(".").map((part) => part.trim().toLowerCase()).join(".");
}
function sorted(values: readonly string[]): string[] { return [...new Set(values)].sort(); }
