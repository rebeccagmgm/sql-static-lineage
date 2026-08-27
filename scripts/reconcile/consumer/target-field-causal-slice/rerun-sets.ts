import {
  CAUSAL_ASSESSMENT_STATUSES,
  type CausalAssessment,
} from "./causal-assessment.ts";
import type {
  CandidateBranch,
  CandidateUniverse,
} from "./candidate-universe.ts";

export type RerunSetKind = "MINIMUM_CONFIRMED" | "CONSERVATIVE_SAFETY";

export interface RerunTrigger {
  readonly rootTargetFieldId: string;
  readonly candidateBranchId: string;
  readonly assessmentId: string;
  readonly causalStatus: CausalAssessment["status"];
  readonly positiveProofIds: readonly string[];
  readonly negativeProofIds: readonly string[];
  readonly gapRefs: readonly string[];
}

export interface RerunTaskEntry {
  /** Null means that the included assessment could not be mapped to a task. */
  readonly taskId: string | null;
  readonly triggers: readonly RerunTrigger[];
  readonly unresolvedReason: string | null;
}

export interface RerunSet {
  readonly kind: RerunSetKind;
  readonly taskIds: readonly string[];
  readonly entries: readonly RerunTaskEntry[];
  readonly unresolved: readonly RerunTaskEntry[];
}

export interface RerunSetsInput {
  readonly candidateUniverse: CandidateUniverse;
  readonly rootTargetFieldIds: readonly string[];
  readonly assessments: readonly CausalAssessment[];
}

export interface RerunSetsResult {
  readonly minimumConfirmed: RerunSet;
  readonly conservativeSafety: RerunSet;
}

export interface RerunSetValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const MINIMUM_STATUSES = new Set<CausalAssessment["status"]>([
  "CONFIRMED_RELATED",
]);
const SAFETY_STATUSES = new Set<CausalAssessment["status"]>([
  "CONFIRMED_RELATED",
  "CONDITIONAL_RELATED",
  "UNKNOWN",
]);

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort(compareText);
}

function isAssessmentStatus(value: unknown): value is CausalAssessment["status"] {
  return (
    typeof value === "string" &&
    (CAUSAL_ASSESSMENT_STATUSES as readonly string[]).includes(value)
  );
}

function triggerFor(assessment: CausalAssessment): RerunTrigger {
  return {
    rootTargetFieldId: assessment.rootTargetFieldId,
    candidateBranchId: assessment.candidateBranchId,
    assessmentId: assessment.assessmentId,
    causalStatus: assessment.status,
    positiveProofIds: sortedUnique(assessment.positiveProofIds),
    negativeProofIds: sortedUnique(assessment.negativeProofIds),
    gapRefs: sortedUnique(assessment.gapRefs),
  };
}

function triggerKey(trigger: RerunTrigger): string {
  return [
    trigger.rootTargetFieldId,
    trigger.candidateBranchId,
    trigger.assessmentId,
  ].join("\u0000");
}

function compareTriggers(left: RerunTrigger, right: RerunTrigger): number {
  return (
    compareText(left.rootTargetFieldId, right.rootTargetFieldId) ||
    compareText(left.candidateBranchId, right.candidateBranchId) ||
    compareText(left.assessmentId, right.assessmentId)
  );
}

function mapBranchToTask(
  branch: CandidateBranch,
): { readonly taskId: string | null; readonly reason: string | null } {
  const producerTaskId = branch.producerTaskId?.trim() || null;
  const consumerTaskId = branch.consumerTaskId?.trim() || null;
  const rootTaskId = branch.rootTaskId?.trim() || null;

  switch (branch.branchKind) {
    case "PHYSICAL_PRODUCER":
      return producerTaskId
        ? { taskId: producerTaskId, reason: null }
        : { taskId: null, reason: "PHYSICAL_PRODUCER_TASK_ID_UNRESOLVED" };
    case "SCHEDULE_ONLY":
      return producerTaskId
        ? { taskId: producerTaskId, reason: null }
        : { taskId: null, reason: "SCHEDULE_ONLY_PRODUCER_TASK_ID_UNRESOLVED" };
    case "ROOT_WRITE":
      return rootTaskId
        ? { taskId: rootTaskId, reason: null }
        : { taskId: null, reason: "ROOT_WRITE_TASK_ID_UNRESOLVED" };
    case "UNBOUND_READ":
    case "BLOCKED_READ":
    case "COVERAGE_BOUNDARY": {
      const taskId = producerTaskId ?? consumerTaskId ?? rootTaskId;
      return taskId
        ? { taskId, reason: null }
        : { taskId: null, reason: `${branch.branchKind}_TASK_ID_UNRESOLVED` };
    }
    default:
      return {
        taskId: null,
        reason: "CANDIDATE_BRANCH_KIND_UNSUPPORTED",
      };
  }
}

function unresolvedTrigger(
  assessment: CausalAssessment,
  reason: string,
): RerunTaskEntry {
  return {
    taskId: null,
    triggers: [triggerFor(assessment)],
    unresolvedReason: reason,
  };
}

function makeSet(
  kind: RerunSetKind,
  statuses: ReadonlySet<CausalAssessment["status"]>,
  universe: CandidateUniverse,
  assessments: readonly CausalAssessment[],
): RerunSet {
  const branches = new Map(
    universe.branches.map((branch) => [branch.candidateBranchId, branch]),
  );
  const grouped = new Map<string, RerunTrigger[]>();
  const unresolved: RerunTaskEntry[] = [];

  for (const assessment of [...assessments].sort((left, right) =>
    compareText(left.assessmentId, right.assessmentId),
  )) {
    if (!isAssessmentStatus(assessment.status) || !statuses.has(assessment.status))
      continue;

    const trigger = triggerFor(assessment);
    const branch = branches.get(assessment.candidateBranchId);
    if (!branch) {
      unresolved.push(unresolvedTrigger(assessment, "CANDIDATE_BRANCH_REFERENCE_DANGLING"));
      continue;
    }

    const mapping = mapBranchToTask(branch);
    if (mapping.taskId === null) {
      unresolved.push(unresolvedTrigger(assessment, mapping.reason ?? "TASK_ID_UNRESOLVED"));
      continue;
    }

    const triggers = grouped.get(mapping.taskId) ?? [];
    if (!triggers.some((item) => triggerKey(item) === triggerKey(trigger)))
      triggers.push(trigger);
    grouped.set(mapping.taskId, triggers);
  }

  const entries = [...grouped.entries()]
    .map(([taskId, triggers]) => ({
      taskId,
      triggers: [...triggers].sort(compareTriggers),
      unresolvedReason: null,
    }))
    .sort((left, right) => compareText(left.taskId ?? "", right.taskId ?? ""));
  const orderedUnresolved = unresolved
    .sort((left, right) =>
      compareTriggers(left.triggers[0]!, right.triggers[0]!) ||
      compareText(left.unresolvedReason ?? "", right.unresolvedReason ?? ""),
    );

  return {
    kind,
    taskIds: entries.map((entry) => entry.taskId).filter((taskId): taskId is string =>
      taskId !== null,
    ),
    entries,
    unresolved: orderedUnresolved,
  };
}

/**
 * Build both rerun views from the same assessment snapshot. A task is grouped
 * once, while every distinct root-field/branch/assessment trigger is retained.
 */
export function generateRerunSets(input: RerunSetsInput): RerunSetsResult {
  const validation = validateRerunInputs(
    input.candidateUniverse,
    input.rootTargetFieldIds,
    input.assessments,
  );
  if (!validation.valid)
    throw new Error(`RERUN_SET_INPUT_INVALID: ${validation.errors.join("; ")}`);
  return {
    minimumConfirmed: makeSet(
      "MINIMUM_CONFIRMED",
      MINIMUM_STATUSES,
      input.candidateUniverse,
      input.assessments,
    ),
    conservativeSafety: makeSet(
      "CONSERVATIVE_SAFETY",
      SAFETY_STATUSES,
      input.candidateUniverse,
      input.assessments,
    ),
  };
}

export const buildRerunSets = generateRerunSets;
export const generateCausalRerunSets = generateRerunSets;

/** Validate assessment statuses and branch references before rerun projection. */
export function validateRerunInputs(
  candidateUniverse: CandidateUniverse,
  rootTargetFieldIds: readonly string[],
  assessments: readonly CausalAssessment[],
): RerunSetValidation {
  const errors: string[] = [];
  const branchIds = new Set(candidateUniverse.branches.map((branch) => branch.candidateBranchId));
  const assessmentIds = new Set<string>();
  const roots = [...new Set(rootTargetFieldIds.filter((value) => value.length > 0))];
  const pairCounts = new Map<string, number>();

  for (const assessment of assessments) {
    if (!isAssessmentStatus(assessment.status))
      errors.push(`ASSESSMENT_STATUS_INVALID:${assessment.assessmentId}:${String(assessment.status)}`);
    if (assessmentIds.has(assessment.assessmentId))
      errors.push(`ASSESSMENT_ID_DUPLICATE:${assessment.assessmentId}`);
    assessmentIds.add(assessment.assessmentId);
    if (!branchIds.has(assessment.candidateBranchId))
      errors.push(`CANDIDATE_BRANCH_REFERENCE_DANGLING:${assessment.assessmentId}:${assessment.candidateBranchId}`);
    if (!roots.includes(assessment.rootTargetFieldId))
      errors.push(`ROOT_TARGET_FIELD_UNEXPECTED:${assessment.assessmentId}:${assessment.rootTargetFieldId}`);
    const pairKey = `${assessment.rootTargetFieldId}\u0000${assessment.candidateBranchId}`;
    pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
  }

  for (const rootTargetFieldId of roots)
    for (const candidateBranchId of branchIds) {
      const pairKey = `${rootTargetFieldId}\u0000${candidateBranchId}`;
      const count = pairCounts.get(pairKey) ?? 0;
      if (count !== 1) errors.push(`ASSESSMENT_PAIR_CARDINALITY:${pairKey}:${count}`);
    }

  return { valid: errors.length === 0, errors: [...new Set(errors)].sort(compareText) };
}

export const validateRerunSetInputs = validateRerunInputs;
