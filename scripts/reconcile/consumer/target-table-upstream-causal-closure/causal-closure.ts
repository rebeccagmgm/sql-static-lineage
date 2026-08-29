import type { CandidateBranch, CandidateUniverse } from "../target-field-causal-slice/candidate-universe.ts";
import {
  canonicalAssessment,
  type ChannelAssessment,
  type TargetTableAssessment,
  type UpstreamTaskRollup,
} from "./artifact-contract.ts";
import { buildImpactGraph, type GlobalImpactGraph } from "./impact-graph.ts";
import type { FieldValueEvidenceProvider } from "./field-value-provider.ts";
import {
  CAUSAL_IMPACT_CHANNELS,
  localChannelAssessments,
  rollupAssessments,
} from "./static-assessment.ts";
import {
  canonicalSqlSourceId,
  summaryForOccurrence,
  type ImpactChannel,
  type TaskRelationSummary,
} from "./task-relation-summary.ts";

export type PathCertainty = "CONFIRMED" | "CONDITIONAL" | "UNKNOWN";

/** State carried from one exact producer write to its upstream inputs. */
export interface PropagationState {
  readonly writeObservationId: string;
  readonly channel: ImpactChannel;
  readonly certainty: PathCertainty;
  readonly evidenceRefs: readonly string[];
  readonly gapRefs: readonly string[];
  readonly witnessPredecessor: string | null;
  readonly outputFieldBindingIds?: readonly string[];
  readonly affectedTargetFields?: readonly string[];
}

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

function certaintyRank(value: PathCertainty): number {
  return value === "CONFIRMED" ? 3 : value === "CONDITIONAL" ? 2 : 1;
}

/** Compose certainty along one path: an unknown required hop cannot be hidden. */
export function composePath(left: PathCertainty, right: PathCertainty): PathCertainty {
  if (left === "UNKNOWN" || right === "UNKNOWN") return "UNKNOWN";
  if (left === "CONDITIONAL" || right === "CONDITIONAL") return "CONDITIONAL";
  return "CONFIRMED";
}

/** Merge alternatives in one channel: the strongest witness wins, gaps remain visible. */
export function mergeAlternative(left: PathCertainty, right: PathCertainty): PathCertainty {
  return certaintyRank(left) >= certaintyRank(right) ? left : right;
}

function stateKey(taskId: string, writeObservationId: string, channel: ImpactChannel): string {
  return `${taskId}|write:${writeObservationId}|channel:${channel}`;
}

function nodeKey(taskId: string, writeObservationId: string): string {
  return `${taskId}|write:${writeObservationId}`;
}

function parseNodeKey(value: string, fallbackWriteObservationId: string): {
  readonly taskId: string;
  readonly writeObservationId: string;
} {
  const separator = value.indexOf("|write:");
  return separator >= 0
    ? { taskId: value.slice(0, separator), writeObservationId: value.slice(separator + "|write:".length) }
    : { taskId: value, writeObservationId: fallbackWriteObservationId };
}

function branchEvidenceRefs(branch: CandidateBranch): readonly string[] {
  return branch.evidenceRefs.map((ref) => ref.evidenceRefId);
}

function mergeState(left: PropagationState, right: PropagationState): PropagationState {
  const certainty = mergeAlternative(left.certainty, right.certainty);
  const preferred = certaintyRank(left.certainty) >= certaintyRank(right.certainty) ? left : right;
  return {
    ...preferred,
    certainty,
    evidenceRefs: unique([...left.evidenceRefs, ...right.evidenceRefs]),
    gapRefs: unique([...left.gapRefs, ...right.gapRefs]),
    outputFieldBindingIds: unique([...(left.outputFieldBindingIds ?? []), ...(right.outputFieldBindingIds ?? [])]),
    affectedTargetFields: unique([...(left.affectedTargetFields ?? []), ...(right.affectedTargetFields ?? [])]),
  };
}

function sameState(left: PropagationState, right: PropagationState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function summaryForBranch(
  summaries: ReadonlyMap<string, TaskRelationSummary>,
  branch: CandidateBranch,
): TaskRelationSummary | undefined {
  const occurrence = branch.readOccurrence;
  if (!occurrence || !branch.consumerTaskId) return undefined;
  const source = occurrence.sqlSourceId
    ? canonicalSqlSourceId(occurrence.sqlSourceId)
    : canonicalSqlSourceId(occurrence.occurrenceId);
  return summaryForOccurrence(summaries, branch.consumerTaskId, source, occurrence.statementIndex);
}

function channelMap(values: readonly ChannelAssessment[]): ReadonlyMap<ImpactChannel, ChannelAssessment> {
  return new Map(values.map((value) => [value.channel, value]));
}

function propagatedChannelAssessment(state: PropagationState): ChannelAssessment {
  return {
    channel: state.channel,
    status: state.certainty,
    proofRefs: state.evidenceRefs,
    witnessRefs: state.evidenceRefs,
    gapRefs: state.gapRefs,
    ...(state.outputFieldBindingIds && state.outputFieldBindingIds.length > 0
      ? { outputFieldBindingIds: state.outputFieldBindingIds }
      : {}),
    ...(state.affectedTargetFields && state.affectedTargetFields.length > 0
      ? { affectedTargetFields: state.affectedTargetFields }
      : {}),
  };
}

function finalRelationStatus(channels: readonly ChannelAssessment[]): "CONFIRMED_RELATED" | "CONDITIONAL_RELATED" | "UNKNOWN" {
  if (channels.some((channel) => channel.status === "CONFIRMED")) return "CONFIRMED_RELATED";
  if (channels.some((channel) => channel.status === "CONDITIONAL")) return "CONDITIONAL_RELATED";
  return "UNKNOWN";
}

function finalAssessment(input: {
  readonly targetWriteId: string;
  readonly branch: CandidateBranch;
  readonly local: readonly ChannelAssessment[];
  readonly propagated: ReadonlyMap<ImpactChannel, PropagationState>;
  readonly reached: boolean;
}): TargetTableAssessment {
  if (input.branch.branchKind === "ROOT_WRITE") {
    return canonicalAssessment({
      targetWriteId: input.targetWriteId,
      candidateBranchId: input.branch.candidateBranchId,
      relationStatus: "CONFIRMED_RELATED",
      channelAssessments: [],
      evidenceRefs: branchEvidenceRefs(input.branch),
      gapRefs: [],
      negativeProofs: [],
    });
  }
  const channels = new Map<ImpactChannel, ChannelAssessment>();
  for (const [channel, state] of input.propagated) channels.set(channel, propagatedChannelAssessment(state));
  for (const local of input.local) {
    if (channels.has(local.channel)) continue;
    if (local.status === "NOT_APPLICABLE" && input.reached) {
      channels.set(local.channel, local);
      continue;
    }
    const gap = `causal-closure-gap:${input.branch.candidateBranchId}:${input.reached ? "NO_CLOSED_PATH" : "NOT_REACHED_FROM_ROOT"}`;
    channels.set(local.channel, {
      ...local,
      status: "UNKNOWN",
      gapRefs: unique([...local.gapRefs, gap]),
    });
  }
  if (channels.size === 0 || [...channels.values()].every((channel) => channel.status === "NOT_APPLICABLE")) {
    const gap = `causal-closure-gap:${input.branch.candidateBranchId}:${input.reached ? "NO_CLOSED_CHANNEL" : "NOT_REACHED_FROM_ROOT"}`;
    channels.set("RELATION_EXISTENCE", {
      channel: "RELATION_EXISTENCE",
      status: "UNKNOWN",
      proofRefs: [],
      witnessRefs: [],
      gapRefs: [gap],
    });
  }
  const channelAssessments = [...channels.values()];
  const gapRefs = unique([
    ...input.branch.gapRefs,
    ...channelAssessments.flatMap((channel) => channel.gapRefs),
  ]);
  const evidenceRefs = unique([
    ...branchEvidenceRefs(input.branch),
    ...channelAssessments.flatMap((channel) => [...channel.proofRefs, ...channel.witnessRefs]),
  ]);
  return canonicalAssessment({
    targetWriteId: input.targetWriteId,
    candidateBranchId: input.branch.candidateBranchId,
    relationStatus: finalRelationStatus(channelAssessments),
    channelAssessments,
    evidenceRefs,
    gapRefs,
    negativeProofs: [],
  });
}

interface PropagationRun {
  readonly statesByBranch: ReadonlyMap<string, ReadonlyMap<ImpactChannel, PropagationState>>;
  readonly reachableTaskIds: readonly string[];
  readonly reachableBranchIds: readonly string[];
}

function propagate(input: {
  readonly targetWriteId: string;
  readonly rootTaskId: string;
  readonly universe: CandidateUniverse;
  readonly summaries: ReadonlyMap<string, TaskRelationSummary>;
  readonly fieldValueProvider: FieldValueEvidenceProvider;
}): PropagationRun {
  const root = input.universe.branches.find((branch) => branch.branchKind === "ROOT_WRITE");
  const rootWriteObservationId = root?.writeObservationId ?? `target-write:${input.targetWriteId}`;
  const seedCertainty: PathCertainty = root && root.gapRefs.length > 0 ? "UNKNOWN" : "CONFIRMED";
  const seedEvidence = root ? branchEvidenceRefs(root) : [];
  const nodeStates = new Map<string, Map<ImpactChannel, PropagationState>>();
  const pending: string[] = [];
  const rootStates = new Map<ImpactChannel, PropagationState>();
  for (const channel of CAUSAL_IMPACT_CHANNELS) {
    rootStates.set(channel, {
      writeObservationId: rootWriteObservationId,
      channel,
      certainty: seedCertainty,
      evidenceRefs: seedEvidence,
      gapRefs: root?.gapRefs ?? [],
      witnessPredecessor: null,
    });
  }
  const rootNodeKey = nodeKey(input.rootTaskId, rootWriteObservationId);
  nodeStates.set(rootNodeKey, rootStates);
  pending.push(rootNodeKey);

  const localByBranch = new Map<string, readonly ChannelAssessment[]>();
  for (const branch of input.universe.branches) {
    if (branch.branchKind === "ROOT_WRITE") continue;
    localByBranch.set(branch.candidateBranchId, localChannelAssessments({
      branch,
      summary: summaryForBranch(input.summaries, branch),
      fieldValueProvider: input.fieldValueProvider,
    }));
  }
  const statesByBranch = new Map<string, Map<ImpactChannel, PropagationState>>();
  const branchesByConsumer = new Map<string, CandidateBranch[]>();
  for (const branch of input.universe.branches) {
    if (branch.branchKind === "ROOT_WRITE" || !branch.consumerTaskId) continue;
    const values = branchesByConsumer.get(branch.consumerTaskId) ?? [];
    values.push(branch);
    branchesByConsumer.set(branch.consumerTaskId, values);
  }
  const reachableTasks = new Set<string>([input.rootTaskId]);
  const reachableBranches = new Set<string>(root ? [root.candidateBranchId] : []);
  while (pending.length > 0) {
    const currentKey = pending.shift()!;
    const currentNode = parseNodeKey(currentKey, rootWriteObservationId);
    const currentTaskId = currentNode.taskId;
    const currentWriteObservationId = currentNode.writeObservationId;
    const currentStates = nodeStates.get(currentKey);
    if (!currentStates) continue;
    for (const branch of branchesByConsumer.get(currentTaskId) ?? []) {
      const local = channelMap(localByBranch.get(branch.candidateBranchId) ?? []);
      for (const channel of CAUSAL_IMPACT_CHANNELS) {
        const localValue = local.get(channel);
        if (!localValue || localValue.status === "NOT_APPLICABLE") continue;
        const downstream = currentStates.get(channel);
        if (!downstream) continue;
        const producerWriteObservationId = typeof branch.writeObservationId === "string"
          ? branch.writeObservationId
          : `unresolved:${branch.candidateBranchId}`;
        const missingWrite = typeof branch.writeObservationId !== "string" || branch.gapRefs.some((gap) => /PRODUCER_WRITE|WRITE_OBSERVATION/i.test(gap));
        const certainty = missingWrite
          ? "UNKNOWN"
          : composePath(downstream.certainty, localValue.status as PathCertainty);
        const next: PropagationState = {
          writeObservationId: producerWriteObservationId,
          channel,
          certainty,
          evidenceRefs: unique([
            ...downstream.evidenceRefs,
            ...localValue.proofRefs,
            ...localValue.witnessRefs,
            ...branchEvidenceRefs(branch),
          ]),
          gapRefs: unique([
            ...downstream.gapRefs,
            ...localValue.gapRefs,
            ...branch.gapRefs,
            ...(missingWrite ? [`bridge-gap:${branch.candidateBranchId}:PRODUCER_WRITE_OBSERVATION_UNRESOLVED`] : []),
          ]),
          witnessPredecessor: stateKey(currentTaskId, currentWriteObservationId, channel),
          outputFieldBindingIds: localValue.outputFieldBindingIds,
          affectedTargetFields: localValue.affectedTargetFields,
        };
        const branchStates = statesByBranch.get(branch.candidateBranchId) ?? new Map<ImpactChannel, PropagationState>();
        const priorBranchState = branchStates.get(channel);
        branchStates.set(channel, priorBranchState ? mergeState(priorBranchState, next) : next);
        statesByBranch.set(branch.candidateBranchId, branchStates);
        reachableBranches.add(branch.candidateBranchId);
        if (!branch.producerTaskId || missingWrite) continue;
        reachableTasks.add(branch.producerTaskId);
        const producerKey = nodeKey(branch.producerTaskId, producerWriteObservationId);
        const producerStates = nodeStates.get(producerKey) ?? new Map<ImpactChannel, PropagationState>();
        const prior = producerStates.get(channel);
        const merged = prior ? mergeState(prior, next) : next;
        producerStates.set(channel, merged);
        nodeStates.set(producerKey, producerStates);
        if (!prior || !sameState(prior, merged)) pending.push(producerKey);
      }
    }
  }
  return {
    statesByBranch,
    reachableTaskIds: unique([...reachableTasks]),
    reachableBranchIds: unique([...reachableBranches]),
  };
}

/** Build the target-rooted multi-hop closure using monotone channel states. */
export function buildCausalClosure(input: {
  readonly targetWriteId: string;
  readonly rootTaskId: string;
  readonly universe: CandidateUniverse;
  readonly summaries: ReadonlyMap<string, TaskRelationSummary>;
  readonly fieldValueProvider: FieldValueEvidenceProvider;
  readonly baseGraph?: GlobalImpactGraph;
}): CausalClosureResult {
  const base = input.baseGraph ?? buildImpactGraph(input.universe.branches, input.summaries);
  const propagated = propagate(input);
  const graph: ImpactGraph = {
    ...base,
    reachableTaskIds: propagated.reachableTaskIds,
    reachableBranchIds: propagated.reachableBranchIds,
    branchEdges: input.universe.branches
      .filter((branch) => branch.branchKind !== "ROOT_WRITE" && propagated.reachableBranchIds.includes(branch.candidateBranchId) && branch.consumerTaskId !== null)
      .map((branch) => ({ branchId: branch.candidateBranchId, consumerTaskId: branch.consumerTaskId!, producerTaskId: branch.producerTaskId }))
      .sort((left, right) => left.branchId.localeCompare(right.branchId)),
  };
  const assessments = input.universe.branches.map((branch) => {
    const local = branch.branchKind === "ROOT_WRITE" ? [] : localChannelAssessments({
      branch,
      summary: summaryForBranch(input.summaries, branch),
      fieldValueProvider: input.fieldValueProvider,
    });
    const states = propagated.statesByBranch.get(branch.candidateBranchId) ?? new Map<ImpactChannel, PropagationState>();
    return finalAssessment({
      targetWriteId: input.targetWriteId,
      branch,
      local,
      propagated: states,
      reached: propagated.reachableBranchIds.includes(branch.candidateBranchId),
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
