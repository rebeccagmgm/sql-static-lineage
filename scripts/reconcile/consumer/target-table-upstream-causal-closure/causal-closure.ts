import { canonicalJson, sha256 } from "../../../machine-facts/machine-facts-contract.ts";
import type { CandidateBranch, CandidateUniverse } from "../target-field-causal-slice/candidate-universe.ts";
import type { FieldValueEvidenceProvider, FieldValueImpact } from "./field-value-provider.ts";
import type { ImpactChannel, TaskRelationSummary } from "./task-relation-summary.ts";
import {
  canonicalAssessment,
  channelRank,
  relationRank,
  type ChannelAssessment,
  type RelationStatus,
  type TargetTableAssessment,
  type UpstreamTaskRollup,
} from "./artifact-contract.ts";

export interface ImpactGraph {
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

function unique(values: readonly string[]): readonly string[] { return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)); }
function text(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function occurrenceMatches(branch: CandidateBranch, readOccurrenceId: string): boolean {
  return branch.readOccurrence !== null && [branch.readOccurrence.occurrenceId, branch.readOccurrence.readRelationId].includes(readOccurrenceId);
}
function statusForField(value: FieldValueImpact): ChannelAssessment {
  return {
    channel: "FIELD_VALUE",
    status: value.status,
    proofRefs: value.evidenceRefs,
    witnessRefs: value.evidenceRefs,
    gapRefs: value.gapRefs,
  };
}
function statusForSemantic(
  channel: ImpactChannel,
  summary: TaskRelationSummary | undefined,
  branch: CandidateBranch,
): ChannelAssessment | null {
  if (!summary || !branch.readOccurrence) return null;
  const readIds = [branch.readOccurrence.occurrenceId, branch.readOccurrence.readRelationId];
  const impacts = summary.readImpacts.filter((impact) => readIds.includes(impact.readOccurrenceId));
  if (impacts.length === 0) {
    if (!summary.complete) return { channel, status: "UNKNOWN", proofRefs: [], witnessRefs: [], gapRefs: summary.gaps };
    return { channel, status: "PROVEN_ABSENT", proofRefs: [], witnessRefs: [], gapRefs: [] };
  }
  const matching = impacts.filter((impact) => impact.impactChannels.includes(channel));
  if (matching.length === 0) {
    return summary.complete
      ? { channel, status: "PROVEN_ABSENT", proofRefs: [], witnessRefs: [], gapRefs: [] }
      : { channel, status: "UNKNOWN", proofRefs: [], witnessRefs: [], gapRefs: summary.gaps };
  }
  const refs = unique(matching.flatMap((impact) => impact.evidenceRefs));
  const gaps = unique(matching.flatMap((impact) => impact.gaps));
  return {
    channel,
    status: gaps.length > 0 || !summary.complete ? "UNKNOWN" : "CONFIRMED",
    proofRefs: refs,
    witnessRefs: refs,
    gapRefs: gaps.length > 0 ? gaps : [],
  };
}
function relationStatus(channels: readonly ChannelAssessment[], hasOpenBoundary: boolean): RelationStatus {
  if (channels.some((channel) => channel.status === "CONFIRMED")) return "CONFIRMED_RELATED";
  if (channels.some((channel) => channel.status === "CONDITIONAL")) return "CONDITIONAL_RELATED";
  if (hasOpenBoundary || channels.some((channel) => channel.status === "UNKNOWN")) return "UNKNOWN";
  return "PROVEN_UNRELATED";
}
function allChannels(branch: CandidateBranch): readonly ImpactChannel[] {
  if (branch.branchKind === "ROOT_WRITE") return [];
  return ["FIELD_VALUE", "EXPRESSION_CONTROL", "ROW_MEMBERSHIP", "MULTIPLICITY", "GROUPING", "SET_MEMBERSHIP", "ORDER_SELECTION", "WINDOW_EFFECT", "RELATION_EXISTENCE"];
}

/** Build one deduplicated task graph and evaluate branches without a field matrix. */
export function buildCausalClosure(input: {
  readonly targetWriteId: string;
  readonly rootTaskId: string;
  readonly universe: CandidateUniverse;
  readonly summaries: ReadonlyMap<string, TaskRelationSummary>;
  readonly fieldValueProvider: FieldValueEvidenceProvider;
}): CausalClosureResult {
  const reachableTasks = new Set<string>([input.rootTaskId]);
  const reachableBranches = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const branch of input.universe.branches) {
      if (branch.branchKind === "ROOT_WRITE" || branch.consumerTaskId === null || !reachableTasks.has(branch.consumerTaskId)) continue;
      if (!reachableBranches.has(branch.candidateBranchId)) { reachableBranches.add(branch.candidateBranchId); changed = true; }
      if (branch.producerTaskId !== null && !reachableTasks.has(branch.producerTaskId)) { reachableTasks.add(branch.producerTaskId); changed = true; }
    }
  }
  const graph: ImpactGraph = {
    reachableTaskIds: unique([...reachableTasks]),
    reachableBranchIds: unique([...reachableBranches]),
    branchEdges: input.universe.branches.filter((branch) => reachableBranches.has(branch.candidateBranchId)).map((branch) => ({ branchId: branch.candidateBranchId, consumerTaskId: branch.consumerTaskId!, producerTaskId: branch.producerTaskId })).sort((left, right) => left.branchId.localeCompare(right.branchId)),
  };
  const allGaps = new Map<string, { gapId: string; reasonCode: string; message: string; evidenceRefs: readonly string[] }>();
  const assessments: TargetTableAssessment[] = [];
  for (const branch of input.universe.branches) {
    const channels: ChannelAssessment[] = [];
    const branchGapRefs = new Set(branch.gapRefs);
    const summary = branch.consumerTaskId ? input.summaries.get(branch.consumerTaskId) : undefined;
    if (branch.branchKind === "ROOT_WRITE") {
      const proof = [`target-write:${input.targetWriteId}`];
      assessments.push(canonicalAssessment({
        targetWriteId: input.targetWriteId,
        candidateBranchId: branch.candidateBranchId,
        relationStatus: "CONFIRMED_RELATED",
        channelAssessments: [], evidenceRefs: proof, gapRefs: [], negativeProofRefs: [],
      }));
      continue;
    }
    if (branch.branchKind === "PHYSICAL_PRODUCER") {
      const field = input.fieldValueProvider.lookup(branch);
      channels.push(statusForField(field));
      for (const ref of field.gapRefs) branchGapRefs.add(ref);
      for (const channel of allChannels(branch).filter((value) => value !== "FIELD_VALUE")) {
        const semantic = statusForSemantic(channel, summary, branch);
        if (semantic) channels.push(semantic);
      }
      if (!summary) {
        const ref = `summary-gap:${branch.consumerTaskId ?? "unknown"}`;
        branchGapRefs.add(ref);
        channels.push({ channel: "RELATION_EXISTENCE", status: "UNKNOWN", proofRefs: [], witnessRefs: [], gapRefs: [ref] });
      }
    } else {
      for (const channel of ["FIELD_VALUE", "ROW_MEMBERSHIP", "MULTIPLICITY", "RELATION_EXISTENCE"] as const)
        channels.push({ channel, status: "UNKNOWN", proofRefs: [], witnessRefs: [], gapRefs: [...branchGapRefs] });
      if (branch.boundaryReason) branchGapRefs.add(`candidate-boundary:${branch.candidateBranchId}:${branch.boundaryReason}`);
    }
    const uniqueChannels = new Map<string, ChannelAssessment>();
    for (const channel of channels) {
      const previous = uniqueChannels.get(channel.channel);
      if (!previous || channelRank(channel.status) > channelRank(previous.status)) uniqueChannels.set(channel.channel, channel);
      else if (previous) uniqueChannels.set(channel.channel, { ...previous, gapRefs: unique([...previous.gapRefs, ...channel.gapRefs]), proofRefs: unique([...previous.proofRefs, ...channel.proofRefs]), witnessRefs: unique([...previous.witnessRefs, ...channel.witnessRefs]) });
    }
    const finalChannels = [...uniqueChannels.values()];
    const status = relationStatus(finalChannels, input.universe.status !== "COMPLETE_OBSERVED_EVIDENCE" || branchGapRefs.size > 0);
    const evidenceRefs = unique(finalChannels.flatMap((channel) => [...channel.proofRefs, ...channel.witnessRefs]));
    const gapRefs = unique([...branchGapRefs, ...finalChannels.flatMap((channel) => channel.gapRefs)]);
    const assessment = canonicalAssessment({
      targetWriteId: input.targetWriteId,
      candidateBranchId: branch.candidateBranchId,
      relationStatus: status,
      channelAssessments: finalChannels,
      evidenceRefs,
      gapRefs,
      negativeProofRefs: status === "PROVEN_UNRELATED" ? [`negative-proof:${sha256(canonicalJson({ targetWriteId: input.targetWriteId, branchId: branch.candidateBranchId }))}`] : [],
    });
    assessments.push(assessment);
    if (gapRefs.length > 0) {
      for (const gapRef of gapRefs) allGaps.set(gapRef, { gapId: gapRef, reasonCode: gapRef.includes("summary-gap") ? "TASK_RELATION_SUMMARY_UNKNOWN" : "CAUSAL_EVIDENCE_INCOMPLETE", message: `causal closure could not close ${gapRef}`, evidenceRefs });
    }
  }
  const byTask = new Map<string, TargetTableAssessment[]>();
  for (const assessment of assessments) {
    const branch = input.universe.branches.find((candidate) => candidate.candidateBranchId === assessment.candidateBranchId);
    if (branch?.producerTaskId && branch.branchKind !== "ROOT_WRITE") (byTask.get(branch.producerTaskId) ?? (byTask.set(branch.producerTaskId, []), byTask.get(branch.producerTaskId)!)).push(assessment);
  }
  const taskRollup: UpstreamTaskRollup[] = [...byTask.entries()].map(([producerTaskId, values]) => {
    const best = values.reduce((current, candidate) => relationRank(candidate.relationStatus) > relationRank(current.relationStatus) ? candidate : current, values[0]!);
    return {
      producerTaskId,
      branchIds: unique(values.map((value) => value.candidateBranchId)),
      relationStatus: best.relationStatus,
      impactChannels: [...new Set(values.flatMap((value) => value.channelAssessments.filter((channel) => channel.status === "CONFIRMED" || channel.status === "CONDITIONAL").map((channel) => channel.channel)))].sort(),
      evidenceRefs: unique(values.flatMap((value) => value.evidenceRefs)),
      gapRefs: unique(values.flatMap((value) => value.gapRefs)),
    };
  }).sort((left, right) => left.producerTaskId.localeCompare(right.producerTaskId));
  const minimumCertainTaskIds = unique(taskRollup.filter((item) => item.relationStatus === "CONFIRMED_RELATED").map((item) => item.producerTaskId));
  const conservativeSafetyTaskIds = unique(taskRollup.filter((item) => item.relationStatus !== "PROVEN_UNRELATED").map((item) => item.producerTaskId));
  return { graph, assessments: assessments.sort((left, right) => left.assessmentId.localeCompare(right.assessmentId)), taskRollup, minimumCertainTaskIds, conservativeSafetyTaskIds, gaps: [...allGaps.values()].sort((left, right) => left.gapId.localeCompare(right.gapId)) };
}
