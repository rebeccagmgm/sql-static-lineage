import type { CandidateBranch } from "../target-field-causal-slice/candidate-universe.ts";
import type { FieldValueEvidenceProvider } from "./field-value-provider.ts";
import type { ImpactChannel, LocalTransferKind, TaskRelationSummary } from "./task-relation-summary.ts";
import {
  canonicalAssessment,
  type ChannelAssessment,
  type RelationStatus,
  type TargetTableAssessment,
} from "./artifact-contract.ts";

export const CAUSAL_IMPACT_CHANNELS: readonly ImpactChannel[] = [
  "FIELD_VALUE",
  "EXPRESSION_CONTROL",
  "ROW_MEMBERSHIP",
  "MULTIPLICITY",
  "GROUPING",
  "SET_MEMBERSHIP",
  "ORDER_SELECTION",
  "WINDOW_EFFECT",
  "RELATION_EXISTENCE",
];

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function canonicalOccurrence(value: string): string {
  return value.trim().toLowerCase();
}

function sameOccurrence(left: string, right: string): boolean {
  return canonicalOccurrence(left) === canonicalOccurrence(right);
}

function emptyChannel(
  channel: ImpactChannel,
  status: ChannelAssessment["status"],
  gapRefs: readonly string[] = [],
): ChannelAssessment {
  return { channel, status, proofRefs: [], witnessRefs: [], gapRefs: unique(gapRefs) };
}

function semantic(
  branch: CandidateBranch,
  summary: TaskRelationSummary | undefined,
  channel: ImpactChannel,
): ChannelAssessment {
  if (!summary || !branch.readOccurrence) {
    return emptyChannel(channel, "UNKNOWN", [`summary-gap:${branch.consumerTaskId ?? "unknown"}`]);
  }
  const ids = [branch.readOccurrence.occurrenceId, branch.readOccurrence.readRelationId];
  const matches = summary.readImpacts.filter((impact) => ids.some((id) => sameOccurrence(id, impact.readOccurrenceId)));
  if (matches.length === 0) {
    return summary.complete
      ? emptyChannel(channel, "NOT_APPLICABLE")
      : emptyChannel(channel, "UNKNOWN", summary.gaps);
  }
  const relevant = matches.filter((impact) => impact.impactChannels.includes(channel));
  if (relevant.length === 0) {
    return summary.complete
      ? emptyChannel(channel, "NOT_APPLICABLE")
      : emptyChannel(channel, "UNKNOWN", summary.gaps);
  }
  const refs = unique(relevant.flatMap((impact) => impact.evidenceRefs));
  const gaps = unique(relevant.flatMap((impact) => impact.gaps));
  const demandedFieldNames = unique(relevant.flatMap((impact) => impact.demandedFieldNames ?? []));
  const localTransferKinds = unique(relevant.flatMap((impact) => impact.localTransferKinds ?? [])) as LocalTransferKind[];
  return {
    channel,
    status: gaps.length > 0 || !summary.complete ? "UNKNOWN" : "CONFIRMED",
    proofRefs: refs,
    witnessRefs: refs,
    gapRefs: gaps,
    ...(localTransferKinds.length > 0 ? { localTransferKinds } : {}),
    ...(demandedFieldNames.length > 0 ? { demandedFieldNames } : {}),
  };
}

/**
 * Compute only the local transfer offered by one consumer read occurrence.
 * This is not a candidate assessment: causal-closure.ts composes these
 * transfers with downstream propagation states.
 */
export function localChannelAssessments(input: {
  readonly branch: CandidateBranch;
  readonly summary?: TaskRelationSummary;
  readonly fieldValueProvider: FieldValueEvidenceProvider;
}): readonly ChannelAssessment[] {
  const branchGaps = unique(input.branch.gapRefs);
  if (input.branch.branchKind === "ROOT_WRITE") return [];
  if (input.branch.branchKind !== "PHYSICAL_PRODUCER") {
    const boundaryChannels: readonly ImpactChannel[] = ["FIELD_VALUE", "ROW_MEMBERSHIP", "MULTIPLICITY", "RELATION_EXISTENCE"];
    return boundaryChannels.map((channel) =>
      emptyChannel(channel, "UNKNOWN", [...branchGaps, `candidate-boundary:${input.branch.candidateBranchId}:${input.branch.branchKind}`]),
    );
  }
  const fieldValue = input.fieldValueProvider.lookup(input.branch);
  const values: ChannelAssessment[] = [{
    channel: "FIELD_VALUE",
    status: fieldValue.status === "PROVEN_ABSENT" ? "NOT_APPLICABLE" : fieldValue.status,
    proofRefs: fieldValue.evidenceRefs,
    witnessRefs: fieldValue.evidenceRefs,
    gapRefs: [...branchGaps, ...fieldValue.gapRefs],
    outputFieldBindingIds: fieldValue.outputFieldBindingIds,
    affectedTargetFields: fieldValue.affectedTargetFields,
    localTransferKinds: ["VALUE_FLOW"],
    demandedFieldNames: fieldValue.affectedTargetFields,
  }];
  for (const channel of CAUSAL_IMPACT_CHANNELS) {
    if (channel === "FIELD_VALUE") continue;
    values.push(semantic(input.branch, input.summary, channel));
  }
  return values.map((value) => value.gapRefs.length === 0 || value.status === "NOT_APPLICABLE"
    ? value
    : { ...value, gapRefs: unique([...value.gapRefs, ...branchGaps]) });
}

/** Backward-compatible local view; the CLI uses fixed-point propagation instead. */
export function assessBranch(input: {
  readonly targetWriteId: string;
  readonly branch: CandidateBranch;
  readonly universeComplete: boolean;
  readonly summary?: TaskRelationSummary;
  readonly fieldValueProvider: FieldValueEvidenceProvider;
}): TargetTableAssessment {
  if (input.branch.branchKind === "ROOT_WRITE") {
    return canonicalAssessment({
      targetWriteId: input.targetWriteId,
      candidateBranchId: input.branch.candidateBranchId,
      relationStatus: "CONFIRMED_RELATED",
      channelAssessments: [],
      evidenceRefs: input.branch.evidenceRefs.map((ref) => ref.evidenceRefId),
      gapRefs: [],
      negativeProofs: [],
    });
  }
  const channels = localChannelAssessments(input);
  const positive = channels.some((channel) => channel.status === "CONFIRMED");
  const conditional = channels.some((channel) => channel.status === "CONDITIONAL");
  const gapRefs = unique([...input.branch.gapRefs, ...channels.flatMap((channel) => channel.gapRefs)]);
  const producerWriteUnresolved = input.branch.branchKind === "PHYSICAL_PRODUCER" && (
    input.branch.writeObservationId === null ||
    input.branch.gapRefs.some((gap) => /PRODUCER_WRITE|WRITE_OBSERVATION/i.test(gap))
  );
  const relationStatus: RelationStatus = producerWriteUnresolved
    ? "UNKNOWN"
    : positive
    ? "CONFIRMED_RELATED"
    : conditional
      ? "CONDITIONAL_RELATED"
      : "UNKNOWN";
  return canonicalAssessment({
    targetWriteId: input.targetWriteId,
    candidateBranchId: input.branch.candidateBranchId,
    relationStatus,
    channelAssessments: channels,
    evidenceRefs: unique(channels.flatMap((channel) => [...channel.proofRefs, ...channel.witnessRefs])),
    gapRefs: gapRefs.length > 0 ? gapRefs : [`causal-gap:${input.branch.candidateBranchId}:NO_CLOSED_PATH`],
    negativeProofs: [],
  });
}

export function rollupAssessments(input: {
  readonly branches: readonly CandidateBranch[];
  readonly assessments: readonly TargetTableAssessment[];
}): {
  readonly taskRollup: readonly {
    readonly producerTaskId: string;
    readonly branchIds: readonly string[];
    readonly relationStatus: RelationStatus;
    readonly impactChannels: readonly ImpactChannel[];
    readonly evidenceRefs: readonly string[];
    readonly gapRefs: readonly string[];
  }[];
  readonly minimumCertainTaskIds: readonly string[];
  readonly conservativeSafetyTaskIds: readonly string[];
} {
  const byTask = new Map<string, TargetTableAssessment[]>();
  for (const assessment of input.assessments) {
    const branch = input.branches.find((candidate) => candidate.candidateBranchId === assessment.candidateBranchId);
    if (!branch?.producerTaskId || branch.branchKind === "ROOT_WRITE") continue;
    const list = byTask.get(branch.producerTaskId) ?? [];
    list.push(assessment);
    byTask.set(branch.producerTaskId, list);
  }
  const taskRollup = [...byTask.entries()].map(([producerTaskId, values]) => {
    const rank = (status: RelationStatus): number => status === "CONFIRMED_RELATED" ? 3 : status === "CONDITIONAL_RELATED" ? 2 : status === "UNKNOWN" ? 1 : 0;
    const best = values.reduce((left, right) => rank(right.relationStatus) > rank(left.relationStatus) ? right : left);
    return {
      producerTaskId,
      branchIds: unique(values.map((value) => value.candidateBranchId)),
      relationStatus: best.relationStatus,
      impactChannels: [...new Set(values.flatMap((value) => value.channelAssessments.filter((channel) => channel.status === "CONFIRMED" || channel.status === "CONDITIONAL").map((channel) => channel.channel)))].sort() as ImpactChannel[],
      evidenceRefs: unique(values.flatMap((value) => value.evidenceRefs)),
      gapRefs: unique(values.flatMap((value) => value.gapRefs)),
    };
  }).sort((left, right) => left.producerTaskId.localeCompare(right.producerTaskId));
  return {
    taskRollup,
    minimumCertainTaskIds: taskRollup.filter((value) => value.relationStatus === "CONFIRMED_RELATED").map((value) => value.producerTaskId),
    conservativeSafetyTaskIds: taskRollup.map((value) => value.producerTaskId),
  };
}
