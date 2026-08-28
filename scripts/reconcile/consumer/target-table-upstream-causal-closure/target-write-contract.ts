import { canonicalJson, sha256 } from "../../../machine-facts/machine-facts-contract.ts";
import type { CurrentBundleLoad } from "../../../query/current-task-bundle.ts";

export interface TargetWriteIdentity {
  readonly targetWriteId: string;
  readonly taskId: string;
  readonly targetTableKey: string;
  readonly sqlSourceId: string;
  readonly statementOrdinal: number;
  readonly writeOrdinal: number;
  readonly rootRelationId: string;
  readonly writeObservationId: string;
  readonly evidenceRefs: readonly string[];
}

export interface AnalysisSnapshotRef {
  readonly inputPackFingerprint: string;
  readonly machineFactsHash: string;
  readonly producerIndexHash: string;
  readonly tableMultiHopHash: string;
  readonly fieldLineageHash?: string;
  readonly semanticRuleVersion: string;
}

export interface TargetWriteRef {
  readonly identity: TargetWriteIdentity;
  readonly snapshot: AnalysisSnapshotRef;
}

export interface TargetWriteGap {
  readonly gapId: string;
  readonly reasonCode:
    | "TARGET_WRITE_AMBIGUOUS"
    | "TARGET_WRITE_RELATION_UNMAPPED"
    | "TARGET_WRITE_EVIDENCE_MISSING"
    | "TARGET_TABLE_MISMATCH";
  readonly message: string;
  readonly evidenceRefs: readonly string[];
}

export interface ResolveTargetWriteInput {
  readonly taskId: string;
  readonly targetTable: string;
  readonly writeObservationIds: readonly string[];
  readonly load: CurrentBundleLoad;
  readonly snapshot: AnalysisSnapshotRef;
}

export interface TargetWriteResolution {
  readonly ref: TargetWriteRef | null;
  readonly gaps: readonly TargetWriteGap[];
}

type JsonRecord = Readonly<Record<string, unknown>>;

function record(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function records(value: unknown): readonly JsonRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function tableKey(value: string): string {
  return value.trim().toLowerCase();
}

function refsOf(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim()] : refsOf(item)).sort((left, right) => left.localeCompare(right));
  }
  return records(value)
    .flatMap((item) => {
      const ref = text(item.refId) ?? text(item.locator) ?? text(item.source);
      return ref ? [ref] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

function statementOrdinal(value: string): number | null {
  const match = value.match(/(?:^|:)statement:(\d+)(?::|$)/i);
  return match ? Number(match[1]) : null;
}

function relationFromExpression(value: string | null): string | null {
  if (!value) return null;
  const marker = ":expression:";
  const index = value.indexOf(marker);
  return index > 0 ? value.slice(0, index) : null;
}

function gap(
  taskId: string,
  reasonCode: TargetWriteGap["reasonCode"],
  message: string,
  evidenceRefs: readonly string[] = [],
): TargetWriteGap {
  return {
    gapId: `target-write-gap:${taskId}:${reasonCode}:${sha256(message)}`,
    reasonCode,
    message,
    evidenceRefs: [...new Set(evidenceRefs)].sort((left, right) => left.localeCompare(right)),
  };
}

/** Resolve a write only from Machine Facts write/output-binding evidence. */
export function resolveTargetWrite(
  input: ResolveTargetWriteInput,
): TargetWriteResolution {
  const targetTable = tableKey(input.targetTable);
  const bindings = records(input.load.records["output-field-bindings.jsonl"])
    .filter((binding) =>
      text(binding.task_id) === input.taskId &&
      tableKey(text(binding.target_dataset) ?? "") === targetTable &&
      text(binding.binding_status) === "RESOLVED",
    );
  const requested = new Set(input.writeObservationIds.filter(Boolean));
  const observed = [...new Set(
    bindings.map((binding) => text(binding.write_observation_id)).filter((value): value is string => value !== null),
  )];
  const selected = bindings.filter((binding) => {
    const id = text(binding.write_observation_id);
    return id !== null && requested.has(id);
  });
  const evidenceRefs = [...new Set(selected.flatMap((binding) => [
    ...refsOf(binding.evidence_refs),
    ...refsOf(binding.evidence),
    `machine-facts:${input.taskId}:output-field-bindings.jsonl`,
  ]))].sort((left, right) => left.localeCompare(right));
  if (selected.length === 0) {
    return {
      ref: null,
      gaps: [gap(
        input.taskId,
        observed.length > 1 ? "TARGET_WRITE_AMBIGUOUS" : "TARGET_WRITE_EVIDENCE_MISSING",
        observed.length > 1
          ? `requested write observation does not uniquely select one of ${observed.length} target writes`
          : `target write observation is not bound to a resolved output-field binding: ${[...requested].join(",")}`,
        evidenceRefs,
      )],
    };
  }
  const writeIds = new Set(selected.map((binding) => text(binding.write_observation_id)));
  const statementIds = new Set(selected.map((binding) =>
    text(binding.write_statement_id) ?? text(binding.statement_id) ?? text(binding.query_producer_statement_id),
  ).filter((value): value is string => value !== null));
  const relationIds = new Set(selected.map((binding) =>
    relationFromExpression(text(binding.expression_id)),
  ).filter((value): value is string => value !== null));
  const statementOrdinals = new Set([...statementIds].map(statementOrdinal).filter((value): value is number => value !== null));
  if (writeIds.size !== 1 || statementIds.size !== 1 || relationIds.size !== 1 || statementOrdinals.size !== 1) {
    return {
      ref: null,
      gaps: [gap(
        input.taskId,
        relationIds.size === 1 ? "TARGET_WRITE_AMBIGUOUS" : "TARGET_WRITE_RELATION_UNMAPPED",
        relationIds.size === 1
          ? "target write resolves to multiple SQL source or statement identities"
          : "target output bindings do not expose one canonical root relation",
        evidenceRefs,
      )],
    };
  }
  const sqlSourceId = [...statementIds][0]!;
  const writeObservationId = [...writeIds][0]!;
  const rootRelationId = [...relationIds][0]!;
  const ordinal = [...statementOrdinals][0]!;
  const writeOrdinal = Math.min(
    ...selected.map((binding) => Number.isSafeInteger(binding.target_ordinal)
      ? Number(binding.target_ordinal)
      : Number.MAX_SAFE_INTEGER),
  );
  const stableWriteOrdinal = Number.isSafeInteger(writeOrdinal) && writeOrdinal !== Number.MAX_SAFE_INTEGER
    ? writeOrdinal
    : 0;
  const identityInput = {
    taskId: input.taskId,
    targetTableKey: targetTable,
    sqlSourceId,
    statementOrdinal: ordinal,
    writeOrdinal: stableWriteOrdinal,
    rootRelationId,
    writeObservationId,
  };
  const identity: TargetWriteIdentity = {
    ...identityInput,
    targetWriteId: `target-write:${sha256(canonicalJson(identityInput))}`,
    evidenceRefs,
  };
  return { ref: { identity, snapshot: input.snapshot }, gaps: [] };
}
