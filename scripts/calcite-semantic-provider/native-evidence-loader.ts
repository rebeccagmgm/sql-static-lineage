import { readFileSync } from "node:fs";
import type { CandidateTaskSemanticFacts } from "./contract.ts";
import type {
  NativeRelationEvidence,
  NativeStatementEvidence,
  SourceSpan,
} from "./evidence-adapter.ts";

interface DialectTransform {
  readonly beforeSpan: SourceSpan;
  readonly afterSpan: SourceSpan;
}

interface RealInputManifest {
  readonly dialectTransform: {
    readonly sql: string;
    readonly transforms: readonly DialectTransform[];
  };
  readonly evidence: {
    readonly relationNodesPath: string;
    readonly sqlPath: string;
  };
}

interface NativeReadRecord {
  readonly relation_id: string;
  readonly relation_type: string;
  readonly source_span?: SourceSpan;
  readonly relation?: {
    readonly table?: string;
    readonly read_occurrence_id?: string;
  };
}

export interface NativeLeafEvidenceLoadResult {
  readonly statement: NativeStatementEvidence;
  readonly metrics: {
    readonly tableScanCount: number;
    readonly sourceAnchoredTableScanCount: number;
    readonly exactNativeReadCount: number;
    readonly fullSpanExactReadCount: number;
    readonly identifierAnchorExactReadCount: number;
    readonly ambiguousNativeReadCount: number;
    readonly unmappableNativeReadCount: number;
  };
  readonly issues: readonly {
    readonly relationId: string;
    readonly code: "SOURCE_OCCURRENCE_MISSING" | "SOURCE_SPAN_TRANSFORM_OVERLAP" |
      "NATIVE_READ_AMBIGUOUS" | "NATIVE_READ_UNMAPPABLE";
    readonly qualifiedTableName?: string;
    readonly originalSpan?: SourceSpan;
    readonly sameSpanCandidateCount?: number;
    readonly sameTableCandidateCount?: number;
  }[];
}

export function loadNativeLeafEvidence(
  facts: CandidateTaskSemanticFacts,
  manifestPath: string,
): NativeLeafEvidenceLoadResult {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as RealInputManifest;
  const reads = readJsonl<NativeReadRecord>(manifest.evidence.relationNodesPath)
    .filter((item) => item.relation_type === "read" && item.source_span && item.relation?.table);
  const originalSql = readFileSync(manifest.evidence.sqlPath, "utf8");
  const relations: NativeRelationEvidence[] = [];
  const issues: NativeLeafEvidenceLoadResult["issues"][number][] = [];
  let sourceAnchored = 0;
  let ambiguous = 0;
  let unmappable = 0;
  let fullSpanExact = 0;
  let identifierAnchorExact = 0;
  const tableScans = facts.relations.filter((relation) => relation.kind === "TABLE_SCAN");
  for (const relation of tableScans) {
    if (relation.sourceOccurrences?.length !== 1) {
      issues.push({ relationId: relation.relationId, code: "SOURCE_OCCURRENCE_MISSING" });
      unmappable++;
      continue;
    }
    sourceAnchored++;
    const transformedSpan = lineColumnSpanToOffsets(
      manifest.dialectTransform.sql,
      relation.sourceOccurrences[0]!.sourceSpan,
    );
    const originalSpan = reverseDialectSpan(
      transformedSpan,
      manifest.dialectTransform.transforms,
    );
    if (!originalSpan) {
      issues.push({ relationId: relation.relationId, code: "SOURCE_SPAN_TRANSFORM_OVERLAP" });
      unmappable++;
      continue;
    }
    const fullSpanCandidates = reads.filter((read) =>
      read.source_span!.start === originalSpan.start &&
      read.source_span!.end === originalSpan.end &&
      canonicalPhysicalName(read.relation!.table!) === canonicalPhysicalName(relation.qualifiedTableName));
    const identifierText = originalSql.slice(originalSpan.start, originalSpan.end);
    const identifierAnchorCandidates = reads.filter((read) =>
      read.source_span!.start === originalSpan.start &&
      read.source_span!.end >= originalSpan.end &&
      canonicalSqlIdentifier(identifierText) === canonicalPhysicalName(relation.qualifiedTableName) &&
      canonicalPhysicalName(read.relation!.table!) === canonicalPhysicalName(relation.qualifiedTableName));
    const candidates = fullSpanCandidates.length > 0 ? fullSpanCandidates : identifierAnchorCandidates;
    if (candidates.length > 1) {
      issues.push({ relationId: relation.relationId, code: "NATIVE_READ_AMBIGUOUS" });
      ambiguous++;
      continue;
    }
    const candidate = candidates[0];
    if (!candidate) {
      issues.push({
        relationId: relation.relationId,
        code: "NATIVE_READ_UNMAPPABLE",
        ...(relation.qualifiedTableName ? { qualifiedTableName: relation.qualifiedTableName } : {}),
        originalSpan,
        sameSpanCandidateCount: reads.filter((read) =>
          read.source_span!.start === originalSpan.start && read.source_span!.end === originalSpan.end).length,
        sameTableCandidateCount: reads.filter((read) =>
          canonicalPhysicalName(read.relation!.table!) === canonicalPhysicalName(relation.qualifiedTableName)).length,
      });
      unmappable++;
      continue;
    }
    if (fullSpanCandidates.length === 1) fullSpanExact++;
    else identifierAnchorExact++;
    const occurrenceId = candidate.relation?.read_occurrence_id ?? candidate.relation_id;
    const nativeSourceSpan = candidate.source_span!;
    const fields = facts.fields
      .filter((field) => field.relationId === relation.relationId)
      .sort((left, right) => left.slot - right.slot)
      .map((field) => ({
        slot: field.slot,
        nativeFieldOccurrenceId: `${occurrenceId}:field:${field.slot}`,
        ...(relation.qualifiedTableName
          ? { physicalFieldId: `${canonicalPhysicalName(relation.qualifiedTableName)}.${field.name.toLowerCase()}` }
          : {}),
        sourceSpan: nativeSourceSpan,
        evidenceRefs: [nativeRelationEvidenceRef(candidate.relation_id)],
      }));
    relations.push({
      providerRelationOrdinal: relation.providerOrdinal!,
      nativeRelationOccurrenceId: occurrenceId,
      ...(relation.qualifiedTableName ? { qualifiedPhysicalTable: relation.qualifiedTableName } : {}),
      sourceSpan: nativeSourceSpan,
      evidenceRefs: [nativeRelationEvidenceRef(candidate.relation_id)],
      fields,
    });
  }
  return {
    statement: {
      sqlSourceId: facts.input.sqlSourceId,
      statementOrdinal: facts.input.statementOrdinal,
      sqlSha256: facts.input.sqlSha256,
      relations,
    },
    metrics: {
      tableScanCount: tableScans.length,
      sourceAnchoredTableScanCount: sourceAnchored,
      exactNativeReadCount: relations.length,
      fullSpanExactReadCount: fullSpanExact,
      identifierAnchorExactReadCount: identifierAnchorExact,
      ambiguousNativeReadCount: ambiguous,
      unmappableNativeReadCount: unmappable,
    },
    issues,
  };
}

export function lineColumnSpanToOffsets(
  sql: string,
  span: { readonly startLine: number; readonly startColumn: number; readonly endLine: number; readonly endColumn: number },
): SourceSpan {
  const lineStarts = [0];
  for (let index = 0; index < sql.length; index++) if (sql[index] === "\n") lineStarts.push(index + 1);
  const startLine = lineStarts[span.startLine - 1];
  const endLine = lineStarts[span.endLine - 1];
  if (startLine === undefined || endLine === undefined) throw new Error("source occurrence line is outside transformed SQL");
  return {
    start: startLine + span.startColumn - 1,
    // Calcite parser positions use an inclusive end column; canonical spans use an exclusive end offset.
    end: endLine + span.endColumn,
  };
}

export function reverseDialectSpan(
  span: SourceSpan,
  transforms: readonly DialectTransform[],
): SourceSpan | undefined {
  const start = reverseDialectOffset(span.start, transforms);
  const end = reverseDialectOffset(span.end, transforms);
  return start === undefined || end === undefined ? undefined : { start, end };
}

function reverseDialectOffset(
  offset: number,
  transforms: readonly DialectTransform[],
): number | undefined {
  let inserted = 0;
  for (const transform of [...transforms].sort((left, right) => left.afterSpan.start - right.afterSpan.start)) {
    if (offset <= transform.afterSpan.start) break;
    if (offset < transform.afterSpan.end) return undefined;
    inserted += (transform.afterSpan.end - transform.afterSpan.start) -
      (transform.beforeSpan.end - transform.beforeSpan.start);
  }
  return offset - inserted;
}

function canonicalPhysicalName(value: string | undefined): string | undefined {
  return value?.split(".").map((part) => part.trim().toLowerCase()).join(".");
}

function canonicalSqlIdentifier(value: string): string {
  return value.split(".")
    .map((part) => part.trim().replace(/^[`"]|[`"]$/gu, "").toLowerCase())
    .join(".");
}

export function nativeRelationEvidenceRef(relationId: string): string {
  return `machine-facts:relation-b64:${Buffer.from(relationId, "utf8").toString("base64url")}`;
}

function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8").split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}
