import { compareText } from "../../contracts/project-topology-contract.ts";
import type { TaskLocalProjectionClosure } from "./task-local-union-contract.ts";
import type { ProducerIndexWriter } from "./task-local-union-continuation.ts";
import {
  normalizeName,
  type TaskLocalUnionMergeResult,
  type TaskLocalUnionTaskEvidence,
} from "./task-local-union-merge.ts";

export type PartitionMatchStatus =
  "CONFIRMED" | "ASSUMED" | "UNKNOWN" | "DISJOINT";

export type UnionContinuationEvidenceLayer = "L1" | "L2";

export type UnionContinuationGapCode =
  | "READ_OCCURRENCE_NOT_FOUND"
  | "READ_IDENTITY_NOT_CONFIRMED"
  | "NO_KNOWN_WRITE_OBSERVATION"
  | "WRITER_NOT_IN_UNION"
  | "WRITE_OBSERVATION_ALIGNMENT_AMBIGUOUS"
  | "PARTITION_NON_LITERAL"
  | "WRITER_PARTITION_UNKNOWN"
  | "PARTITION_NO_MATCH";

export interface UnionContinuationReadOccurrence {
  readonly readOccurrenceId: string;
  readonly readOccurrenceNodeId: string;
  readonly datasetNodeId: string;
  readonly qualifiedName: string;
  readonly identityStatus: string;
  readonly partitionPredicateStatus: "NONE" | "LITERAL" | "NON_LITERAL_PRESENT";
  readonly partitionPredicates: readonly PartitionPredicate[];
}

export interface PartitionPredicate {
  readonly column: string;
  readonly values: readonly string[];
}

export interface UnionContinuationWriteObservation {
  readonly taskId: string;
  readonly writeObservationId: string;
  readonly targetWriteNodeId: string | null;
  readonly datasetNodeId: string | null;
  readonly qualifiedName: string;
  readonly source: "IN_UNION_FINAL_WRITE" | "PRODUCER_INDEX_ONLY";
  readonly partition: readonly ProducerPartition[];
  readonly partitionStatus: string | null;
}

export interface ProducerPartition {
  readonly column: string;
  readonly values: readonly string[];
  readonly partitionStatus?: string;
  readonly valueStatus?: string;
  readonly observedValue?: string | null;
  readonly expression?: string;
}

export interface UnionContinuationCandidate {
  readonly writeObservation: UnionContinuationWriteObservation;
  readonly partitionMatchStatus: PartitionMatchStatus;
  /** A write observation is L1 only when it is in-union and exactly matched. */
  readonly evidenceLayer: UnionContinuationEvidenceLayer;
  readonly l1Eligible: boolean;
}

export interface UnionContinuationGap {
  readonly gapId: string;
  readonly reasonCode: UnionContinuationGapCode;
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface TraceUnionContinuationV2Options {
  readonly merge: TaskLocalUnionMergeResult;
  readonly readOccurrenceId: string;
  readonly consumerTaskId?: string;
  /** Confirmed producer-index write observations. Schedule data is not accepted. */
  readonly producerIndexWriters?: readonly ProducerIndexWriter[];
}

export interface TraceUnionContinuationV2Result {
  readonly readOccurrence: UnionContinuationReadOccurrence;
  readonly tiers: {
    /** Same physical table, before partition pruning. */
    readonly table: {
      readonly evidenceLayer: UnionContinuationEvidenceLayer;
      readonly candidateWriteObservationIds: readonly string[];
      readonly candidates: readonly UnionContinuationCandidate[];
    };
    /** Per-write partition decisions. DISJOINT candidates are pruned here. */
    readonly partition: {
      readonly candidateWriteObservationIds: readonly string[];
      readonly prunedWriteObservationIds: readonly string[];
      readonly candidates: readonly UnionContinuationCandidate[];
      readonly pruned: boolean;
    };
    /** Never collapses multiple matching writes back to taskId. */
    readonly writeObservation: {
      readonly candidateWriteObservationIds: readonly string[];
      readonly candidates: readonly UnionContinuationCandidate[];
      readonly uniqueWriteObservationId: string | null;
    };
  };
  readonly gaps: readonly UnionContinuationGap[];
}

export interface TraceUnionTaskContinuationV2Options {
  readonly merge: TaskLocalUnionMergeResult;
  readonly consumerTaskId: string;
  readonly producerIndexWriters?: readonly ProducerIndexWriter[];
}

export interface TraceUnionTaskContinuationV2Result {
  readonly consumerTaskId: string;
  readonly readOccurrences: readonly TraceUnionContinuationV2Result[];
}

/**
 * WP-8: table -> partition -> write-observation continuation.
 *
 * The only cross-task inputs are WP-7 finalWrites/externalReads and confirmed
 * producer-index writes. scheduleReference/SCHEDULE_DEPENDS_ON is deliberately
 * absent from this API, so it cannot enter any tier by construction.
 */
export function traceUnionContinuationV2(
  options: TraceUnionContinuationV2Options,
): TraceUnionContinuationV2Result {
  assertV2ProjectionEvidence(options);
  const read = findReadOccurrence(options);
  if (!read) {
    throw new Error(
      `UNION_CONTINUATION_READ_OCCURRENCE_NOT_FOUND:${options.readOccurrenceId}`,
    );
  }

  const gaps: UnionContinuationGap[] = [];
  if (read.identityStatus !== "CONFIRMED") {
    gaps.push({
      gapId: `read-identity-not-confirmed:${read.readOccurrenceId}`,
      reasonCode: "READ_IDENTITY_NOT_CONFIRMED",
      message: "Read occurrence physical identity is not confirmed",
      details: {
        readOccurrenceId: read.readOccurrenceId,
        identityStatus: read.identityStatus,
      },
    });
  }

  const collected = collectWriteObservations(
    options.merge,
    read,
    options.producerIndexWriters ?? [],
  );
  const tableCandidates = collected.candidates;
  gaps.push(...collected.alignmentGaps);
  if (tableCandidates.length === 0) {
    gaps.push({
      gapId: `no-known-write-observation:${read.datasetNodeId}`,
      reasonCode: "NO_KNOWN_WRITE_OBSERVATION",
      message: `No known write observation for ${read.qualifiedName}`,
      details: {
        datasetNodeId: read.datasetNodeId,
        qualifiedName: read.qualifiedName,
      },
    });
  }

  for (const candidate of tableCandidates) {
    if (candidate.writeObservation.source === "PRODUCER_INDEX_ONLY") {
      gaps.push({
        gapId: `writer-not-in-union:${read.datasetNodeId}:${candidate.writeObservation.writeObservationId}`,
        reasonCode: "WRITER_NOT_IN_UNION",
        message: `Write observation ${candidate.writeObservation.writeObservationId} is outside the union`,
        details: {
          datasetNodeId: read.datasetNodeId,
          taskId: candidate.writeObservation.taskId,
          writeObservationId: candidate.writeObservation.writeObservationId,
        },
      });
    }
  }

  const partitionCandidates = tableCandidates.map((candidate) => {
    const status = partitionMatchStatus(read, candidate.writeObservation);
    return {
      ...candidate,
      partitionMatchStatus: status,
      evidenceLayer: evidenceLayerFor(read, candidate.writeObservation, status),
      l1Eligible: isL1Eligible(read, candidate.writeObservation, status),
    } satisfies UnionContinuationCandidate;
  });

  if (read.partitionPredicateStatus === "NON_LITERAL_PRESENT") {
    gaps.push({
      gapId: `partition-non-literal:${read.readOccurrenceId}`,
      reasonCode: "PARTITION_NON_LITERAL",
      message:
        "Read occurrence has at least one non-literal partition predicate",
      details: { readOccurrenceId: read.readOccurrenceId },
    });
  }
  for (const candidate of partitionCandidates) {
    if (candidate.partitionMatchStatus === "UNKNOWN") {
      gaps.push({
        gapId: `writer-partition-unknown:${read.readOccurrenceId}:${candidate.writeObservation.writeObservationId}`,
        reasonCode: "WRITER_PARTITION_UNKNOWN",
        message: `Partition match is unknown for ${candidate.writeObservation.writeObservationId}`,
        details: {
          readOccurrenceId: read.readOccurrenceId,
          writeObservationId: candidate.writeObservation.writeObservationId,
        },
      });
    }
  }

  const retained = partitionCandidates.filter(
    (candidate) => candidate.partitionMatchStatus !== "DISJOINT",
  );
  const pruned = partitionCandidates.filter(
    (candidate) => candidate.partitionMatchStatus === "DISJOINT",
  );
  if (tableCandidates.length > 0 && retained.length === 0) {
    gaps.push({
      gapId: `partition-no-match:${read.readOccurrenceId}`,
      reasonCode: "PARTITION_NO_MATCH",
      message: "All table-level write observations are disjoint by partition",
      details: { readOccurrenceId: read.readOccurrenceId },
    });
  }

  const sortedTable = sortCandidates(tableCandidates);
  const sortedPartition = sortCandidates(partitionCandidates);
  const sortedRetained = sortCandidates(retained);
  return {
    readOccurrence: read,
    tiers: {
      table: {
        evidenceLayer: read.identityStatus === "CONFIRMED" ? "L1" : "L2",
        candidateWriteObservationIds: sortedTable.map(
          (candidate) => candidate.writeObservation.writeObservationId,
        ),
        candidates: sortedTable,
      },
      partition: {
        candidateWriteObservationIds: sortedRetained.map(
          (candidate) => candidate.writeObservation.writeObservationId,
        ),
        prunedWriteObservationIds: sortCandidates(pruned).map(
          (candidate) => candidate.writeObservation.writeObservationId,
        ),
        candidates: sortedPartition,
        pruned: pruned.length > 0,
      },
      writeObservation: {
        candidateWriteObservationIds: sortedRetained.map(
          (candidate) => candidate.writeObservation.writeObservationId,
        ),
        candidates: sortedRetained,
        uniqueWriteObservationId:
          sortedRetained.length === 1
            ? sortedRetained[0]!.writeObservation.writeObservationId
            : null,
      },
    },
    gaps: dedupeGaps(gaps),
  };
}

/** Alias named after the existing v1 kernel for callers migrating incrementally. */
export const traceUnionUpstreamV2 = traceUnionContinuationV2;

export function traceUnionTaskContinuationV2(
  options: TraceUnionTaskContinuationV2Options,
): TraceUnionTaskContinuationV2Result {
  const evidence = options.merge.taskEvidence.find(
    (item) => item.taskId === options.consumerTaskId,
  );
  if (!evidence || evidence.projectionSchemaVersion !== "1.2.0") {
    throw new Error(
      `UNION_CONTINUATION_PROJECTION_SCHEMA_UNSUPPORTED:${options.consumerTaskId}`,
    );
  }
  const readIds =
    evidence?.localClosure?.externalReads.map(
      (read) => read.readOccurrenceId,
    ) ?? [];
  return {
    consumerTaskId: options.consumerTaskId,
    readOccurrences: readIds.sort(compareText).map((readOccurrenceId) =>
      traceUnionContinuationV2({
        merge: options.merge,
        consumerTaskId: options.consumerTaskId,
        readOccurrenceId,
        producerIndexWriters: options.producerIndexWriters,
      }),
    ),
  };
}

function findReadOccurrence(
  options: TraceUnionContinuationV2Options,
): UnionContinuationReadOccurrence | null {
  const summaries = options.merge.taskEvidence.flatMap(
    (item) => item.localClosure?.externalReads ?? [],
  );
  const summary = summaries.find(
    (item) =>
      item.readOccurrenceId === options.readOccurrenceId &&
      (!options.consumerTaskId ||
        item.readOccurrenceId.startsWith(`task:${options.consumerTaskId}:`)),
  );
  if (!summary) return null;
  const node = options.merge.nodes.find(
    (item) =>
      item.nodeType === "READ_OCCURRENCE" &&
      item.nodeId === summary.readOccurrenceNodeId,
  );
  if (!node) return null;
  const properties = node?.properties ?? {};
  const datasetNodeId =
    summary?.datasetNodeId ?? text(properties.datasetNodeId) ?? "";
  const qualifiedName =
    summary?.qualifiedName ?? text(properties.physicalDataset) ?? "";
  if (!datasetNodeId || !qualifiedName) return null;
  if (
    (text(properties.datasetNodeId) !== null &&
      text(properties.datasetNodeId) !== datasetNodeId) ||
    (text(properties.physicalDataset) !== null &&
      normalizeName(text(properties.physicalDataset)!) !==
        normalizeName(qualifiedName))
  ) {
    return null;
  }
  const partitionPredicateStatus = readPartitionStatus(
    properties.partitionPredicateStatus,
  );
  return {
    readOccurrenceId: options.readOccurrenceId,
    readOccurrenceNodeId: summary.readOccurrenceNodeId,
    datasetNodeId,
    qualifiedName,
    identityStatus: summary.identityStatus,
    partitionPredicateStatus,
    partitionPredicates: readPartitionPredicates(
      properties.partitionPredicates,
    ),
  };
}

function collectWriteObservations(
  merge: TaskLocalUnionMergeResult,
  read: UnionContinuationReadOccurrence,
  producerIndexWriters: readonly ProducerIndexWriter[],
): {
  readonly candidates: readonly UnionContinuationCandidate[];
  readonly alignmentGaps: readonly UnionContinuationGap[];
} {
  const finalWrites: Array<{
    readonly evidence: TaskLocalUnionTaskEvidence;
    readonly write: TaskLocalProjectionClosure["finalWrites"][number];
  }> = [];
  for (const evidence of merge.taskEvidence) {
    if (evidence.coverageStatus !== "PROJECTED") continue;
    for (const write of evidence.localClosure?.finalWrites ?? []) {
      if (!sameDataset(write.datasetNodeId, write.qualifiedName, read))
        continue;
      finalWrites.push({ evidence, write });
    }
  }

  const candidates: UnionContinuationCandidate[] = [];
  const alignmentGaps: UnionContinuationGap[] = [];
  const usedProducerKeys = new Set<string>();
  const ambiguousProducerKeys = new Set<string>();
  const nonProjectedTaskIds = new Set(
    merge.taskEvidence
      .filter((evidence) => evidence.coverageStatus !== "PROJECTED")
      .map((evidence) => evidence.taskId),
  );
  for (const item of finalWrites) {
    const matches = producerIndexWriters.filter(
      (writer) =>
        writer.taskId === item.evidence.taskId &&
        sameWriterDataset(
          writer,
          item.write.datasetNodeId,
          item.write.qualifiedName,
          read,
        ),
    );
    const exact = matches.find(
      (writer) => writer.writeObservationId === item.write.writeObservationId,
    );
    const scopeFinalWrites = finalWrites.filter(
      (candidate) =>
        writeScopeKey(
          candidate.evidence.taskId,
          candidate.write.datasetNodeId,
          candidate.write.qualifiedName,
        ) ===
        writeScopeKey(
          item.evidence.taskId,
          item.write.datasetNodeId,
          item.write.qualifiedName,
        ),
    );
    const producer =
      exact ??
      (scopeFinalWrites.length === 1 && matches.length === 1
        ? matches[0]
        : undefined);
    if (!exact && scopeFinalWrites.length > 1 && matches.length > 0) {
      for (const writer of matches) {
        ambiguousProducerKeys.add(producerKey(writer, producerIndexWriters));
      }
      alignmentGaps.push({
        gapId: `write-observation-alignment-ambiguous:${item.evidence.taskId}:${item.write.datasetNodeId}`,
        reasonCode: "WRITE_OBSERVATION_ALIGNMENT_AMBIGUOUS",
        message:
          "Producer-index partition evidence cannot be aligned to multiple final write observations without an exact writeObservationId",
        details: {
          taskId: item.evidence.taskId,
          datasetNodeId: item.write.datasetNodeId,
          qualifiedName: item.write.qualifiedName,
          finalWriteObservationIds: scopeFinalWrites.map(
            (candidate) => candidate.write.writeObservationId,
          ),
          producerIndexWriteObservationIds: matches.map(
            (writer) => writer.writeObservationId ?? null,
          ),
        },
      });
    }
    if (producer)
      usedProducerKeys.add(producerKey(producer, producerIndexWriters));
    const writeObservation: UnionContinuationWriteObservation = {
      taskId: item.evidence.taskId,
      writeObservationId: item.write.writeObservationId,
      targetWriteNodeId: item.write.targetWriteNodeId,
      datasetNodeId: item.write.datasetNodeId,
      qualifiedName: item.write.qualifiedName,
      source: "IN_UNION_FINAL_WRITE",
      partition: producer?.partition ?? [],
      partitionStatus: partitionStatusOf(producer),
    };
    candidates.push({
      writeObservation,
      partitionMatchStatus: "UNKNOWN",
      evidenceLayer: "L2",
      l1Eligible: false,
    });
  }

  producerIndexWriters.forEach((writer, index) => {
    if (nonProjectedTaskIds.has(writer.taskId)) return;
    if (
      !sameWriterDataset(writer, read.datasetNodeId, read.qualifiedName, read)
    )
      return;
    const key = producerKey(writer, producerIndexWriters, index);
    if (usedProducerKeys.has(key) || ambiguousProducerKeys.has(key)) return;
    const writeObservationId =
      writer.writeObservationId ??
      `write-observation:${writer.taskId}:producer-index:${index}`;
    candidates.push({
      writeObservation: {
        taskId: writer.taskId,
        writeObservationId,
        targetWriteNodeId: null,
        datasetNodeId: writer.datasetNodeId ?? null,
        qualifiedName: writer.qualifiedName ?? read.qualifiedName,
        source: "PRODUCER_INDEX_ONLY",
        partition: writer.partition ?? [],
        partitionStatus: partitionStatusOf(writer),
      },
      partitionMatchStatus: "UNKNOWN",
      evidenceLayer: "L2",
      l1Eligible: false,
    });
  });

  const byObservation = new Map<string, UnionContinuationCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.writeObservation.taskId}\u0000${candidate.writeObservation.writeObservationId}`;
    const existing = byObservation.get(key);
    if (
      !existing ||
      existing.writeObservation.source === "PRODUCER_INDEX_ONLY"
    ) {
      byObservation.set(key, candidate);
    }
  }
  return {
    candidates: [...byObservation.values()],
    alignmentGaps,
  };
}

function writeScopeKey(
  taskId: string,
  datasetNodeId: string,
  qualifiedName: string,
): string {
  return `${taskId}\u0000${datasetNodeId}\u0000${normalizeName(qualifiedName)}`;
}

export function partitionMatchStatus(
  read: UnionContinuationReadOccurrence,
  write: UnionContinuationWriteObservation,
): PartitionMatchStatus {
  const predicates = new Map(
    read.partitionPredicates.map((predicate) => [
      normalizeName(predicate.column),
      predicate,
    ]),
  );
  const parts = write.partition;
  if (read.partitionPredicateStatus === "NONE") {
    return parts.length === 0 && !isUnknownPartition(write)
      ? "CONFIRMED"
      : "UNKNOWN";
  }
  if (parts.length === 0 || isUnknownPartition(write)) return "UNKNOWN";

  let assumed = false;
  let unknown = false;
  let compared = false;
  for (const part of parts) {
    const predicate = predicates.get(normalizeName(part.column));
    if (!predicate || predicate.values.length === 0) {
      unknown = true;
      continue;
    }
    compared = true;
    const kind = partitionValueKind(part, write.partitionStatus);
    if (kind === "UNKNOWN") {
      unknown = true;
      continue;
    }
    if (kind === "ASSUMED") {
      assumed = true;
      continue;
    }
    const values = new Set(part.values.map(normalizeName));
    if (!predicate.values.some((value) => values.has(normalizeName(value)))) {
      return "DISJOINT";
    }
  }
  if (read.partitionPredicateStatus === "NON_LITERAL_PRESENT") unknown = true;
  if (!compared) unknown = true;
  if (unknown) return "UNKNOWN";
  if (assumed) return "ASSUMED";
  return "CONFIRMED";
}

function partitionValueKind(
  part: ProducerPartition,
  overallStatus: string | null,
): "LITERAL" | "ASSUMED" | "UNKNOWN" {
  const valueStatus = (part.valueStatus ?? "").toUpperCase();
  const partitionStatus = (
    part.partitionStatus ??
    overallStatus ??
    ""
  ).toUpperCase();
  if (valueStatus.includes("DYNAMIC") || valueStatus.includes("UNKNOWN"))
    return "UNKNOWN";
  if (partitionStatus === "DYNAMIC" || partitionStatus === "LEGACY_UNKNOWN")
    return "UNKNOWN";
  if (
    valueStatus.includes("RUNTIME") ||
    valueStatus.includes("TEMPLATE") ||
    valueStatus.includes("DEFAULT") ||
    partitionStatus.includes("DATE_PARTITION_DEFAULTED") ||
    partitionStatus.includes("POSSIBLE_OVERLAP") ||
    /\$\{|current_(date|timestamp)|sysdate/i.test(part.expression ?? "")
  ) {
    return "ASSUMED";
  }
  if (part.values.length === 0) return "UNKNOWN";
  return "LITERAL";
}

function isUnknownPartition(write: UnionContinuationWriteObservation): boolean {
  const status = (write.partitionStatus ?? "").toUpperCase();
  return (
    status === "DYNAMIC" || status === "LEGACY_UNKNOWN" || status === "UNKNOWN"
  );
}

function evidenceLayerFor(
  read: UnionContinuationReadOccurrence,
  write: UnionContinuationWriteObservation,
  status: PartitionMatchStatus,
): UnionContinuationEvidenceLayer {
  return isL1Eligible(read, write, status) ? "L1" : "L2";
}

function isL1Eligible(
  read: UnionContinuationReadOccurrence,
  write: UnionContinuationWriteObservation,
  status: PartitionMatchStatus,
): boolean {
  return (
    read.identityStatus === "CONFIRMED" &&
    write.source === "IN_UNION_FINAL_WRITE" &&
    status === "CONFIRMED"
  );
}

function sameDataset(
  datasetNodeId: string,
  qualifiedName: string,
  read: UnionContinuationReadOccurrence,
): boolean {
  return (
    datasetNodeId === read.datasetNodeId &&
    normalizeName(qualifiedName) === normalizeName(read.qualifiedName)
  );
}

function sameWriterDataset(
  writer: ProducerIndexWriter,
  datasetNodeId: string,
  qualifiedName: string,
  read: UnionContinuationReadOccurrence,
): boolean {
  if (writer.datasetNodeId) {
    return (
      writer.datasetNodeId === datasetNodeId &&
      writer.datasetNodeId === read.datasetNodeId &&
      normalizeName(writer.qualifiedName ?? qualifiedName) ===
        normalizeName(read.qualifiedName)
    );
  }
  return (
    writer.qualifiedName !== undefined &&
    normalizeName(writer.qualifiedName) === normalizeName(read.qualifiedName)
  );
}

function sortCandidates(
  candidates: readonly UnionContinuationCandidate[],
): UnionContinuationCandidate[] {
  return [...candidates].sort((left, right) =>
    compareText(
      `${left.writeObservation.taskId}\u0000${left.writeObservation.writeObservationId}`,
      `${right.writeObservation.taskId}\u0000${right.writeObservation.writeObservationId}`,
    ),
  );
}

function dedupeGaps(
  gaps: readonly UnionContinuationGap[],
): UnionContinuationGap[] {
  const byId = new Map<string, UnionContinuationGap>();
  for (const gap of gaps) byId.set(gap.gapId, gap);
  return [...byId.values()].sort((left, right) =>
    compareText(left.gapId, right.gapId),
  );
}

function producerKey(
  writer: ProducerIndexWriter,
  all: readonly ProducerIndexWriter[],
  index?: number,
): string {
  if (writer.writeObservationId)
    return `${writer.taskId}\u0000${writer.writeObservationId}`;
  const occurrence = index ?? all.indexOf(writer);
  return `${writer.taskId}\u0000producer-index:${occurrence}`;
}

function partitionStatusOf(
  writer: ProducerIndexWriter | undefined,
): string | null {
  const value = writer?.partition?.find(
    (part) => part.partitionStatus,
  )?.partitionStatus;
  return value ?? null;
}

function readPartitionStatus(
  value: unknown,
): "NONE" | "LITERAL" | "NON_LITERAL_PRESENT" {
  return value === "LITERAL" || value === "NON_LITERAL_PRESENT"
    ? value
    : "NONE";
}

function readPartitionPredicates(value: unknown): PartitionPredicate[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item))
      return [];
    const record = item as Record<string, unknown>;
    const column = text(record.column);
    const values = Array.isArray(record.values)
      ? record.values
          .map(text)
          .filter((value): value is string => value !== null)
      : [];
    return column && values.length > 0 ? [{ column, values }] : [];
  });
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function assertV2ProjectionEvidence(
  options: TraceUnionContinuationV2Options,
): void {
  const legacyProjectedTask = options.merge.taskEvidence.find(
    (evidence) =>
      evidence.coverageStatus === "PROJECTED" &&
      evidence.projectionSchemaVersion !== "1.2.0",
  );
  if (legacyProjectedTask) {
    throw new Error(
      `UNION_CONTINUATION_PROJECTION_SCHEMA_UNSUPPORTED:${legacyProjectedTask.taskId}`,
    );
  }
  const owner = options.merge.taskEvidence.find((evidence) =>
    evidence.localClosure?.externalReads.some(
      (read) => read.readOccurrenceId === options.readOccurrenceId,
    ),
  );
  if (!owner || owner.projectionSchemaVersion !== "1.2.0") {
    throw new Error(
      `UNION_CONTINUATION_PROJECTION_SCHEMA_UNSUPPORTED:${options.readOccurrenceId}`,
    );
  }
}
