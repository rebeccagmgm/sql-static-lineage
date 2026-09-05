import {
  explainFieldEvidenceRecordFromProjection,
  getFieldEvidenceFromProjection,
  traceFieldValuePathFromProjection,
  type GetFieldEvidenceOptions,
  type TraceFieldValuePathOptions,
} from "../field-evidence/field-evidence-query.ts";
import {
  loadIndexedFieldEvidence,
  type QueryIndexExpectedSource,
} from "./query-index-query-source.ts";

export interface IndexedFieldEvidenceSource extends QueryIndexExpectedSource {
  readonly fieldEvidenceSnapshotId: string;
}

export async function getIndexedFieldEvidence(
  input: IndexedFieldEvidenceSource,
  options: GetFieldEvidenceOptions = {},
): Promise<ReturnType<typeof getFieldEvidenceFromProjection>> {
  return getFieldEvidenceFromProjection(
    await loadIndexedFieldEvidence(input),
    options,
  );
}

export async function traceIndexedFieldValuePath(
  input: IndexedFieldEvidenceSource,
  options: TraceFieldValuePathOptions,
): Promise<ReturnType<typeof traceFieldValuePathFromProjection>> {
  return traceFieldValuePathFromProjection(
    await loadIndexedFieldEvidence(input),
    options,
  );
}

export async function explainIndexedFieldEvidenceRecord(
  input: IndexedFieldEvidenceSource,
  recordId: string,
  options: { readonly maxAttachments?: number } = {},
): Promise<ReturnType<typeof explainFieldEvidenceRecordFromProjection>> {
  return explainFieldEvidenceRecordFromProjection(
    await loadIndexedFieldEvidence(input),
    recordId,
    options,
  );
}
