import type { ContinuationPorts } from "./ports.ts";
import type { ContinuationPolicy } from "./policy.ts";
import { isRuleEnabled } from "./policy.ts";
import { applyPartitionRematch } from "./rules/partition-rematch.ts";
import { applyPruneDisjoint } from "./rules/prune-disjoint.ts";
import { applyScheduleWhitelist } from "./rules/schedule-whitelist.ts";
import type { FieldImpactGap } from "../impact-result-contract.ts";
import type { ContinuationCandidate, ContinuationStage } from "./types.ts";

export interface ContinuationRuleDescriptor {
  readonly id: string;
  readonly stage: ContinuationStage;
}

export const CONTINUATION_RULE_REGISTRY: readonly ContinuationRuleDescriptor[] = [
  { id: "PRUNE_DISJOINT", stage: "PRUNE" },
  { id: "SCHEDULE_WHITELIST", stage: "PRUNE" },
  { id: "PARTITION_REMATCH", stage: "REMATCH" },
];

export function rulesForStage(
  stage: ContinuationStage,
  policy: ContinuationPolicy,
): readonly ContinuationRuleDescriptor[] {
  return CONTINUATION_RULE_REGISTRY.filter(
    (rule) => rule.stage === stage && isRuleEnabled(policy, rule.id),
  );
}

export function applyRegistryRules(input: {
  readonly stage: ContinuationStage;
  readonly consumerTaskId: string;
  readonly readOccurrenceId: string;
  readonly column: string;
  readonly qualifiedName: string;
  readonly candidates: readonly ContinuationCandidate[];
  readonly ports: ContinuationPorts;
  readonly policy: ContinuationPolicy;
}): {
  readonly candidates: readonly ContinuationCandidate[];
  readonly gaps: readonly FieldImpactGap[];
} {
  let candidates: readonly ContinuationCandidate[] = input.candidates;
  const gaps: FieldImpactGap[] = [];
  for (const rule of rulesForStage(input.stage, input.policy)) {
    if (rule.id === "PRUNE_DISJOINT") {
      candidates = applyPruneDisjoint(candidates);
      continue;
    }
    if (rule.id === "SCHEDULE_WHITELIST") {
      candidates = applyScheduleWhitelist({
        consumerTaskId: input.consumerTaskId,
        candidates,
        ports: input.ports,
        policy: input.policy,
      });
      continue;
    }
    if (rule.id === "PARTITION_REMATCH") {
      const rematch = applyPartitionRematch({
        consumerTaskId: input.consumerTaskId,
        readOccurrenceId: input.readOccurrenceId,
        column: input.column,
        qualifiedName: input.qualifiedName,
        candidates,
        ports: input.ports,
      });
      candidates = rematch.candidates;
      gaps.push(...rematch.gaps);
    }
  }
  return { candidates, gaps };
}
