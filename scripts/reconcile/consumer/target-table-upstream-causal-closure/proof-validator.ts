import type { CandidateUniverse } from "../target-field-causal-slice/candidate-universe.ts";
import type { TargetTableAssessment } from "./artifact-contract.ts";

export interface CausalClosureValidation { readonly valid: boolean; readonly errors: readonly string[]; }

export function validateCausalClosure(input: { readonly targetWriteId: string; readonly universe: CandidateUniverse; readonly assessments: readonly TargetTableAssessment[] }): CausalClosureValidation {
  const errors: string[] = [];
  const expected = new Set(input.universe.branches.map((branch) => `${input.targetWriteId}|${branch.candidateBranchId}`));
  const seen = new Set<string>();
  for (const assessment of input.assessments) {
    const key = `${assessment.targetWriteId}|${assessment.candidateBranchId}`;
    if (seen.has(key)) errors.push(`DUPLICATE_ASSESSMENT:${key}`);
    seen.add(key);
    if (!expected.has(key)) errors.push(`UNEXPECTED_ASSESSMENT:${key}`);
    if (assessment.relationStatus === "PROVEN_UNRELATED" && (input.universe.status !== "COMPLETE_OBSERVED_EVIDENCE" || assessment.negativeProofRefs.length === 0 || assessment.gapRefs.length > 0 || assessment.channelAssessments.some((channel) => channel.status === "UNKNOWN"))) errors.push(`UNSAFE_PROVEN_UNRELATED:${assessment.candidateBranchId}`);
    if (assessment.relationStatus === "UNKNOWN" && assessment.gapRefs.length === 0) errors.push(`UNKNOWN_WITHOUT_GAP:${assessment.candidateBranchId}`);
  }
  for (const key of expected) if (!seen.has(key)) errors.push(`MISSING_ASSESSMENT:${key}`);
  return { valid: errors.length === 0, errors: errors.sort() };
}
