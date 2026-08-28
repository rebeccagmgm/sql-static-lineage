import type { CandidateBranch } from "../target-field-causal-slice/candidate-universe.ts";
import type { FieldValueEvidenceProvider } from "./field-value-provider.ts";
import type { ImpactChannel, TaskRelationSummary } from "./task-relation-summary.ts";
import { canonicalAssessment, channelRank, createNegativeProof, relationRank, type ChannelAssessment, type RelationStatus, type TargetTableAssessment } from "./artifact-contract.ts";

function unique(values: readonly string[]): readonly string[] { return [...new Set(values.filter(Boolean))].sort(); }
const channels: readonly ImpactChannel[] = ["FIELD_VALUE", "EXPRESSION_CONTROL", "ROW_MEMBERSHIP", "MULTIPLICITY", "GROUPING", "SET_MEMBERSHIP", "ORDER_SELECTION", "WINDOW_EFFECT", "RELATION_EXISTENCE"];

function occurrenceKey(value: string): string {
  return value.toLowerCase().replace(/^query#\d+:/, "").replace(/^task:[^:]+:statement:\d+:relation:/, "");
}

function sameOccurrence(left: string, right: string): boolean {
  return left === right || occurrenceKey(left) === occurrenceKey(right);
}

function semantic(branch: CandidateBranch, summary: TaskRelationSummary | undefined, channel: ImpactChannel): ChannelAssessment {
  if (!summary || !branch.readOccurrence) return { channel, status: "UNKNOWN", proofRefs: [], witnessRefs: [], gapRefs: [`summary-gap:${branch.consumerTaskId ?? "unknown"}`] };
  const ids = [branch.readOccurrence.occurrenceId, branch.readOccurrence.readRelationId];
  const matches = summary.readImpacts.filter((impact) => ids.some((id) => sameOccurrence(id, impact.readOccurrenceId)));
  if (matches.length === 0) return summary.complete
    ? { channel, status: "PROVEN_ABSENT", proofRefs: [], witnessRefs: [], gapRefs: [] }
    : { channel, status: "UNKNOWN", proofRefs: [], witnessRefs: [], gapRefs: summary.gaps };
  const relevant = matches.filter((impact) => impact.impactChannels.includes(channel));
  if (relevant.length === 0) return summary.complete
    ? { channel, status: "PROVEN_ABSENT", proofRefs: [], witnessRefs: [], gapRefs: [] }
    : { channel, status: "UNKNOWN", proofRefs: [], witnessRefs: [], gapRefs: summary.gaps };
  const refs = unique(relevant.flatMap((impact) => impact.evidenceRefs));
  const gaps = unique(relevant.flatMap((impact) => impact.gaps));
  return { channel, status: gaps.length || !summary.complete ? "UNKNOWN" : "CONFIRMED", proofRefs: refs, witnessRefs: refs, gapRefs: gaps };
}

function overall(assessments: readonly ChannelAssessment[], universeComplete: boolean, branchGaps: readonly string[]): RelationStatus {
  if (assessments.some((item) => item.status === "CONFIRMED")) return "CONFIRMED_RELATED";
  if (assessments.some((item) => item.status === "CONDITIONAL")) return "CONDITIONAL_RELATED";
  if (!universeComplete || branchGaps.length || assessments.some((item) => item.status === "UNKNOWN")) return "UNKNOWN";
  return "PROVEN_UNRELATED";
}

function hasBlockingGap(gaps: readonly string[]): boolean {
  return gaps.some((gap) => /(?:BRIDGE|IDENTITY|PRODUCER_WRITE|NOT_REACHABLE|UNSUPPORTED)/i.test(gap));
}

function negativeProofFor(input: {
  readonly targetWriteId: string;
  readonly branch: CandidateBranch;
  readonly channelAssessments: readonly ChannelAssessment[];
}): ReturnType<typeof createNegativeProof> | null {
  const closedChannels = input.channelAssessments.flatMap((channel) => {
    if (channel.status !== "PROVEN_ABSENT" && channel.status !== "NOT_APPLICABLE") return [];
    return [{ channel: channel.channel, status: channel.status, proofRefs: channel.proofRefs }];
  });
  const premiseRefs = unique([
    ...input.branch.evidenceRefs.map((ref) => ref.evidenceRefId),
    ...closedChannels.flatMap((channel) => channel.proofRefs),
  ]);
  if (closedChannels.length === 0 || premiseRefs.length === 0) return null;
  return createNegativeProof({
    kind: "COMPLETE_UNIVERSE_NO_CAUSAL_PATH",
    targetWriteId: input.targetWriteId,
    candidateBranchId: input.branch.candidateBranchId,
    universeStatus: "COMPLETE_OBSERVED_EVIDENCE",
    closedChannels,
    premiseRefs,
    cut: {
      kind: "CANDIDATE_BRANCH_NO_REACHABLE_CAUSAL_EDGE",
      rootTaskId: input.branch.rootTaskId,
      consumerTaskId: input.branch.consumerTaskId,
      producerTaskId: input.branch.producerTaskId,
      readOccurrenceId: input.branch.readOccurrence?.readRelationId ?? input.branch.readOccurrence?.occurrenceId ?? null,
    },
  });
}

export function assessBranch(input: {
  readonly targetWriteId: string;
  readonly branch: CandidateBranch;
  readonly universeComplete: boolean;
  readonly summary?: TaskRelationSummary;
  readonly fieldValueProvider: FieldValueEvidenceProvider;
}): TargetTableAssessment {
  if (input.branch.branchKind === "ROOT_WRITE") return canonicalAssessment({ targetWriteId: input.targetWriteId, candidateBranchId: input.branch.candidateBranchId, relationStatus: "CONFIRMED_RELATED", channelAssessments: [], evidenceRefs: input.branch.evidenceRefs.map((ref) => ref.evidenceRefId), gapRefs: [], negativeProofs: [] });
  const branchGaps = [...unique(input.branch.gapRefs)];
  const values: ChannelAssessment[] = [];
  if (input.branch.branchKind === "PHYSICAL_PRODUCER") {
    const value = input.fieldValueProvider.lookup(input.branch);
    values.push({ channel: "FIELD_VALUE", status: value.status, proofRefs: value.evidenceRefs, witnessRefs: value.evidenceRefs, gapRefs: value.gapRefs });
    for (const channel of channels.filter((item) => item !== "FIELD_VALUE")) values.push(semantic(input.branch, input.summary, channel));
  } else {
    const boundaryGap = `candidate-boundary:${input.branch.candidateBranchId}:${input.branch.branchKind}`;
    branchGaps.push(boundaryGap);
    for (const channel of ["FIELD_VALUE", "ROW_MEMBERSHIP", "MULTIPLICITY", "RELATION_EXISTENCE"] as const) values.push({ channel, status: "UNKNOWN", proofRefs: [], witnessRefs: [], gapRefs: [...branchGaps] });
  }
  const byChannel = new Map<ImpactChannel, ChannelAssessment>();
  for (const value of values) {
    const previous = byChannel.get(value.channel);
    if (!previous || channelRank(value.status) > channelRank(previous.status)) byChannel.set(value.channel, value);
    else if (previous) byChannel.set(value.channel, { ...previous, proofRefs: unique([...previous.proofRefs, ...value.proofRefs]), witnessRefs: unique([...previous.witnessRefs, ...value.witnessRefs]), gapRefs: unique([...previous.gapRefs, ...value.gapRefs]) });
  }
  const finalChannels = [...byChannel.values()];
  let relationStatus = hasBlockingGap(branchGaps) ? "UNKNOWN" : overall(finalChannels, input.universeComplete, branchGaps);
  let negativeProofs = [] as ReturnType<typeof createNegativeProof>[];
  if (relationStatus === "PROVEN_UNRELATED") {
    const proof = negativeProofFor({ targetWriteId: input.targetWriteId, branch: input.branch, channelAssessments: finalChannels });
    if (proof) negativeProofs = [proof];
    else {
      relationStatus = "UNKNOWN";
      branchGaps.push(`negative-proof-gap:${input.branch.candidateBranchId}:PREMISE_EVIDENCE_MISSING`);
    }
  }
  const gapRefs = unique([...branchGaps, ...finalChannels.flatMap((value) => value.gapRefs)]);
  const evidenceRefs = unique([...finalChannels.flatMap((value) => [...value.proofRefs, ...value.witnessRefs]), ...negativeProofs.flatMap((proof) => proof.premiseRefs)]);
  return canonicalAssessment({ targetWriteId: input.targetWriteId, candidateBranchId: input.branch.candidateBranchId, relationStatus, channelAssessments: finalChannels, evidenceRefs, gapRefs, negativeProofs });
}

export function rollupAssessments(input: {
  readonly branches: readonly CandidateBranch[];
  readonly assessments: readonly TargetTableAssessment[];
}): { readonly taskRollup: readonly { readonly producerTaskId: string; readonly branchIds: readonly string[]; readonly relationStatus: RelationStatus; readonly impactChannels: readonly ImpactChannel[]; readonly evidenceRefs: readonly string[]; readonly gapRefs: readonly string[] }[]; readonly minimumCertainTaskIds: readonly string[]; readonly conservativeSafetyTaskIds: readonly string[] } {
  const byTask = new Map<string, TargetTableAssessment[]>();
  for (const assessment of input.assessments) {
    const branch = input.branches.find((candidate) => candidate.candidateBranchId === assessment.candidateBranchId);
    if (!branch?.producerTaskId || branch.branchKind === "ROOT_WRITE") continue;
    const list = byTask.get(branch.producerTaskId) ?? [];
    list.push(assessment);
    byTask.set(branch.producerTaskId, list);
  }
  const taskRollup = [...byTask.entries()].map(([producerTaskId, values]) => {
    const best = values.reduce((left, right) => relationRank(right.relationStatus) > relationRank(left.relationStatus) ? right : left);
    return {
      producerTaskId,
      branchIds: unique(values.map((value) => value.candidateBranchId)),
      relationStatus: best.relationStatus,
      impactChannels: [...new Set(values.flatMap((value) => value.channelAssessments.filter((channel) => channel.status === "CONFIRMED" || channel.status === "CONDITIONAL").map((channel) => channel.channel)))].sort() as ImpactChannel[],
      evidenceRefs: unique(values.flatMap((value) => value.evidenceRefs)),
      gapRefs: unique(values.flatMap((value) => value.gapRefs)),
    };
  }).sort((a, b) => a.producerTaskId.localeCompare(b.producerTaskId));
  return {
    taskRollup,
    minimumCertainTaskIds: taskRollup.filter((value) => value.relationStatus === "CONFIRMED_RELATED").map((value) => value.producerTaskId),
    conservativeSafetyTaskIds: taskRollup.filter((value) => value.relationStatus !== "PROVEN_UNRELATED").map((value) => value.producerTaskId),
  };
}
