import type { CandidateBranch, CandidateUniverse } from "../target-field-causal-slice/candidate-universe.ts";
import { canonicalAssessment, type TargetTableAssessment, type UpstreamTaskRollup } from "./artifact-contract.ts";
import { buildImpactGraph, type GlobalImpactGraph } from "./impact-graph.ts";
import type { FieldValueEvidenceProvider } from "./field-value-provider.ts";
import { assessBranch, rollupAssessments } from "./static-assessment.ts";
import { summaryForOccurrence, type TaskRelationSummary } from "./task-relation-summary.ts";

export interface ImpactGraph extends GlobalImpactGraph {
  readonly reachableTaskIds: readonly string[];
  readonly reachableBranchIds: readonly string[];
  readonly branchEdges: readonly { readonly branchId: string; readonly consumerTaskId: string; readonly producerTaskId: string | null }[];
}

export interface CausalClosureResult {
  readonly graph: ImpactGraph;
  readonly assessments: readonly TargetTableAssessment[];
  readonly taskRollup: readonly UpstreamTaskRollup[];
  readonly minimumCertainTaskIds: readonly string[];
  readonly conservativeSafetyTaskIds: readonly string[];
  readonly gaps: readonly { readonly gapId: string; readonly reasonCode: string; readonly message: string; readonly evidenceRefs: readonly string[] }[];
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function reachability(input: { readonly rootTaskId: string; readonly branches: readonly CandidateBranch[]; readonly base: GlobalImpactGraph }): ImpactGraph {
  const reachableTasks = new Set<string>([input.rootTaskId]);
  const reachableBranches = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const branch of input.branches) {
      if (branch.branchKind === "ROOT_WRITE") {
        if (!reachableBranches.has(branch.candidateBranchId)) {
          reachableBranches.add(branch.candidateBranchId);
          changed = true;
        }
        continue;
      }
      if (branch.consumerTaskId === null || !reachableTasks.has(branch.consumerTaskId)) continue;
      if (!reachableBranches.has(branch.candidateBranchId)) {
        reachableBranches.add(branch.candidateBranchId);
        changed = true;
      }
      if (branch.producerTaskId !== null && !reachableTasks.has(branch.producerTaskId)) {
        reachableTasks.add(branch.producerTaskId);
        changed = true;
      }
    }
  }
  return {
    ...input.base,
    reachableTaskIds: unique([...reachableTasks]),
    reachableBranchIds: unique([...reachableBranches]),
    branchEdges: input.branches
      .filter((branch) => branch.branchKind !== "ROOT_WRITE" && reachableBranches.has(branch.candidateBranchId) && branch.consumerTaskId !== null)
      .map((branch) => ({ branchId: branch.candidateBranchId, consumerTaskId: branch.consumerTaskId!, producerTaskId: branch.producerTaskId }))
      .sort((left, right) => left.branchId.localeCompare(right.branchId)),
  };
}

/** The CLI's single target-rooted closure entry point. */
export function buildCausalClosure(input: {
  readonly targetWriteId: string;
  readonly rootTaskId: string;
  readonly universe: CandidateUniverse;
  readonly summaries: ReadonlyMap<string, TaskRelationSummary>;
  readonly fieldValueProvider: FieldValueEvidenceProvider;
  readonly baseGraph?: GlobalImpactGraph;
}): CausalClosureResult {
  const graph = reachability({ rootTaskId: input.rootTaskId, branches: input.universe.branches, base: input.baseGraph ?? buildImpactGraph(input.universe.branches, input.summaries) });
  const assessments = input.universe.branches.map((branch) => {
    if (branch.branchKind !== "ROOT_WRITE" && !graph.reachableBranchIds.includes(branch.candidateBranchId)) {
      return canonicalAssessment({
        targetWriteId: input.targetWriteId,
        candidateBranchId: branch.candidateBranchId,
        relationStatus: "UNKNOWN",
        channelAssessments: [],
        evidenceRefs: [],
        gapRefs: [`causal-closure-gap:${branch.candidateBranchId}:NOT_REACHABLE_FROM_ROOT`],
        negativeProofs: [],
      });
    }
    const summary = summaryForOccurrence(input.summaries, branch.consumerTaskId, branch.readOccurrence?.statementIndex ?? null);
    return assessBranch({
      targetWriteId: input.targetWriteId,
      branch,
      universeComplete: input.universe.status === "COMPLETE_OBSERVED_EVIDENCE",
      summary,
      fieldValueProvider: input.fieldValueProvider,
    });
  });
  const rollup = rollupAssessments({ branches: input.universe.branches, assessments });
  const gaps = unique(assessments.flatMap((assessment) => assessment.gapRefs)).map((gapId) => ({
    gapId,
    reasonCode: gapId.includes("causal-closure-gap") ? "CAUSAL_CLOSURE_BOUNDARY" : "CAUSAL_EVIDENCE_INCOMPLETE",
    message: `causal closure could not close ${gapId}`,
    evidenceRefs: assessments.find((assessment) => assessment.gapRefs.includes(gapId))?.evidenceRefs ?? [],
  }));
  return {
    graph,
    assessments,
    taskRollup: rollup.taskRollup,
    minimumCertainTaskIds: rollup.minimumCertainTaskIds,
    conservativeSafetyTaskIds: rollup.conservativeSafetyTaskIds,
    gaps,
  };
}
