import type { ContinuationPorts } from "../ports.ts";
import type { ContinuationPolicy } from "../policy.ts";
import type { ContinuationCandidate } from "../types.ts";
import { withContinuationCandidate } from "../types.ts";

export const SCHEDULE_WHITELIST_RULE_ID = "SCHEDULE_WHITELIST" as const;

export function applyScheduleWhitelist(input: {
  readonly consumerTaskId: string;
  readonly candidates: readonly ContinuationCandidate[];
  readonly ports: ContinuationPorts;
  readonly policy: ContinuationPolicy;
}): readonly ContinuationCandidate[] {
  const scheduleAvailable =
    input.ports.scheduleLookup?.statusFor(input.consumerTaskId) === "AVAILABLE";
  if (!scheduleAvailable) {
    return input.candidates;
  }

  return input.candidates
    .filter((candidate) => {
      const isCrossTask = candidate.index.taskId !== input.consumerTaskId;
      if (!isCrossTask) return true;
      return input.ports.scheduleLookup!.isDirectParent(
        input.consumerTaskId,
        candidate.index.taskId,
      );
    })
    .map((candidate) => withContinuationCandidate(candidate, {
      ruleId: SCHEDULE_WHITELIST_RULE_ID,
    }));
}
