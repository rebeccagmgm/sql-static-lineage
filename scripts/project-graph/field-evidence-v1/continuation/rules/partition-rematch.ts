import { matchProducersByReadScope } from "../../../../query/producer-index-query.ts";
import { stableId } from "../../../task-local/ids.ts";
import type { FieldImpactGap } from "../../impact-result-contract.ts";
import type { ContinuationPorts } from "../ports.ts";
import type { ContinuationCandidate } from "../types.ts";
import { withContinuationCandidate } from "../types.ts";

export const PARTITION_REMATCH_RULE_ID = "PARTITION_REMATCH" as const;

export function applyPartitionRematch(input: {
  readonly consumerTaskId: string;
  readonly readOccurrenceId: string;
  readonly column: string;
  readonly qualifiedName: string;
  readonly candidates: readonly ContinuationCandidate[];
  readonly ports: ContinuationPorts;
}): {
  readonly candidates: readonly ContinuationCandidate[];
  readonly gaps: readonly FieldImpactGap[];
} {
  const gaps: FieldImpactGap[] = [];
  if (!input.ports.producerIndex) {
    gaps.push({
      gapId: stableId("gap", {
        reasonCode: "PRODUCER_INDEX_UNAVAILABLE",
        consumerTaskId: input.consumerTaskId,
        readOccurrenceId: input.readOccurrenceId,
        column: input.column,
      }),
      reasonCode: "PRODUCER_INDEX_UNAVAILABLE",
      details: {
        consumerTaskId: input.consumerTaskId,
        readOccurrenceId: input.readOccurrenceId,
        column: input.column,
      },
    });
    return { candidates: input.candidates, gaps };
  }

  const readScopeResult = input.ports.readScopeFor({
    consumerTaskId: input.consumerTaskId,
    readOccurrenceId: input.readOccurrenceId,
    qualifiedName: input.qualifiedName,
  });
  if (readScopeResult.kind === "UNAVAILABLE") {
    gaps.push({
      gapId: stableId("gap", {
        reasonCode: readScopeResult.reasonCode,
        consumerTaskId: input.consumerTaskId,
        readOccurrenceId: input.readOccurrenceId,
        column: input.column,
      }),
      reasonCode: readScopeResult.reasonCode,
      details: {
        consumerTaskId: input.consumerTaskId,
        readOccurrenceId: input.readOccurrenceId,
        column: input.column,
      },
    });
    return { candidates: input.candidates, gaps };
  }

  const table = input.ports.tableIdentityFor(input.qualifiedName);
  const matches = matchProducersByReadScope(
    input.ports.producerIndex,
    table,
    readScopeResult.scope,
  );
  const matchByTaskId = new Map(matches.map((match) => [match.taskId, match]));

  const candidates = input.candidates.map((candidate) => {
    const match = matchByTaskId.get(candidate.index.taskId);
    if (!match) return candidate;
    return withContinuationCandidate(candidate, {
      partitionOverlap: match.status,
      ruleId: PARTITION_REMATCH_RULE_ID,
    });
  });

  return { candidates, gaps };
}
