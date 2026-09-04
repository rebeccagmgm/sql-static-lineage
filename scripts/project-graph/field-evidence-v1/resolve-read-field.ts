import type {
  UnionContinuationIndexCandidate,
  UnionContinuationCandidateSource,
} from "../../reconcile/consumer/target-table-upstream-causal-closure/union-continuation-candidate-source.ts";
import type { FieldEdgeIndex, IndexedFieldEdge } from "./field-edge-index.ts";

export type ResolveReadFieldConfirmed = {
  readonly kind: "CONFIRMED";
  readonly candidate: UnionContinuationIndexCandidate;
  readonly producerEdges: readonly IndexedFieldEdge[];
};

export type ResolveReadFieldFrontier = {
  readonly kind: "FRONTIER";
  readonly readOccurrenceId: string;
  readonly column: string;
  readonly candidates: readonly UnionContinuationIndexCandidate[];
  readonly reasonCode: "MULTI_WRITER_CANDIDATE_FRONTIER";
};

export type ResolveReadFieldNoIndexEntry = {
  readonly kind: "NO_INDEX_ENTRY";
  readonly readOccurrenceId: string;
  readonly column: string;
};

export type ResolveReadFieldNoBinding = {
  readonly kind: "NO_BINDING";
  readonly candidate: UnionContinuationIndexCandidate;
  readonly readOccurrenceId: string;
  readonly column: string;
};

export type ResolveReadFieldResult =
  | ResolveReadFieldConfirmed
  | ResolveReadFieldFrontier
  | ResolveReadFieldNoIndexEntry
  | ResolveReadFieldNoBinding;

function normalizeColumn(column: string): string {
  return column.trim().toLowerCase();
}

function isL1Eligible(candidate: UnionContinuationIndexCandidate): boolean {
  return candidate.l1Eligible === true;
}

export function resolveReadField(input: {
  readonly consumerTaskId: string;
  readonly readOccurrenceId: string;
  readonly column: string;
  readonly index: UnionContinuationCandidateSource;
  readonly producerIndexForTask: (taskId: string) => FieldEdgeIndex | null;
}): ResolveReadFieldResult {
  const column = normalizeColumn(input.column);
  const entry = input.index.entryForRead(
    input.consumerTaskId,
    input.readOccurrenceId,
  );
  if (!entry) {
    return {
      kind: "NO_INDEX_ENTRY",
      readOccurrenceId: input.readOccurrenceId,
      column,
    };
  }

  const candidates = entry.candidates;
  if (candidates.length !== 1 || !isL1Eligible(candidates[0]!)) {
    return {
      kind: "FRONTIER",
      readOccurrenceId: input.readOccurrenceId,
      column,
      candidates,
      reasonCode: "MULTI_WRITER_CANDIDATE_FRONTIER",
    };
  }

  const candidate = candidates[0]!;
  const producerIndex = input.producerIndexForTask(candidate.taskId);
  if (!producerIndex) {
    return {
      kind: "NO_BINDING",
      candidate,
      readOccurrenceId: input.readOccurrenceId,
      column,
    };
  }
  const producerEdges = producerIndex.edgesForBinding(
    candidate.writeObservationId,
    column,
  );
  if (producerEdges.length === 0) {
    return {
      kind: "NO_BINDING",
      candidate,
      readOccurrenceId: input.readOccurrenceId,
      column,
    };
  }

  return {
    kind: "CONFIRMED",
    candidate,
    producerEdges,
  };
}
