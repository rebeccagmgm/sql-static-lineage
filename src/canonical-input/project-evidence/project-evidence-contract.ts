import {
  MACHINE_FACTS_CONTRACT_VERSION,
  canonicalJson,
  safeSegment,
  sha256,
} from "../../contracts/runtime.ts";
import {
  stableProjectEvidenceHash,
  type MultiHopReconciliationResult,
  type OneHopReconciliationResult,
} from "../../contracts/canonical-artifacts.ts";

export { stableProjectEvidenceHash };

export const PROJECT_EVIDENCE_SOURCE_SCHEMA_VERSION = "1.0.0" as const;
export const PROJECT_EVIDENCE_ALGORITHM_VERSION = "1.0.0" as const;

export interface ProjectEvidenceSourceDescriptorV1 {
  readonly schemaVersion: typeof PROJECT_EVIDENCE_SOURCE_SCHEMA_VERSION;
  readonly sourceMode: "DIRECT_PROJECT_EVIDENCE";
  readonly algorithmVersion: typeof PROJECT_EVIDENCE_ALGORITHM_VERSION;
  readonly projectKey: string;
  readonly rootTaskIds: readonly string[];
  readonly inputFingerprint: string;
  readonly producerIndexContentHash: string;
  readonly terminalConfig: {
    readonly version: string;
    readonly contentHash: string;
    readonly stopRoles: readonly string[];
  };
  readonly machineFacts: {
    readonly contractVersion: string;
    readonly adapterVersion: string;
  };
  readonly scheduleEvidenceContentHash: string;
  readonly limits: ProjectEvidenceLimits;
  readonly sourceId: string;
  readonly contentHash: string;
}

export interface ProjectEvidenceLimits {
  readonly maxRoots: number;
  readonly maxDepth: number;
  readonly maxTasksPerRoot: number;
  readonly maxEdgesPerRoot: number;
  readonly maxUnionTasks: number;
  readonly maxRounds: number;
}

export interface ProjectEvidenceRootInput {
  readonly rootTaskId: string;
  readonly oneHop: OneHopReconciliationResult;
  readonly traversal: MultiHopReconciliationResult;
}

export interface BuildProjectEvidenceSourceInput {
  readonly projectKey: string;
  readonly roots: readonly ProjectEvidenceRootInput[];
  readonly limits: ProjectEvidenceLimits;
}

export function projectEvidenceSourceContentHash(
  source: Omit<ProjectEvidenceSourceDescriptorV1, "sourceId" | "contentHash">,
): string {
  return sha256(canonicalJson(source));
}

export function projectEvidenceSourceId(contentHash: string): string {
  if (!SHA256.test(contentHash))
    throw new Error("PROJECT_EVIDENCE_SOURCE_HASH_INVALID");
  return `project-evidence-${contentHash.toLowerCase()}`;
}

export function buildProjectEvidenceSourceDescriptor(
  input: BuildProjectEvidenceSourceInput,
): ProjectEvidenceSourceDescriptorV1 {
  const projectKey = safeSegment(input.projectKey, "projectKey");
  const roots = [...input.roots].sort((left, right) =>
    left.rootTaskId < right.rootTaskId
      ? -1
      : left.rootTaskId > right.rootTaskId
        ? 1
        : 0,
  );
  const rootTaskIds = roots.map((root) =>
    safeSegment(root.rootTaskId, "rootTaskId"),
  );
  if (
    roots.length === 0 ||
    new Set(rootTaskIds).size !== rootTaskIds.length ||
    rootTaskIds.length > input.limits.maxRoots
  )
    throw new Error("PROJECT_EVIDENCE_ROOTS_INVALID");
  for (const [label, value] of Object.entries(input.limits))
    if (!Number.isSafeInteger(value) || value < 1)
      throw new Error(`PROJECT_EVIDENCE_${label.toUpperCase()}_INVALID`);

  const producerIdentities = new Set(
    roots.map(
      (root) =>
        `${root.traversal.producerIndex.inputFingerprint}\u0000${root.traversal.producerIndex.contentHash}`,
    ),
  );
  if (producerIdentities.size !== 1)
    throw new Error("PROJECT_EVIDENCE_SOURCE_IDENTITY_MIXED");
  const producerIdentity = producerIdentities.values().next().value as string;
  const [inputFingerprint, producerIndexContentHash] =
    producerIdentity.split("\u0000");
  assertHash(inputFingerprint, "INPUT_FINGERPRINT");
  assertHash(producerIndexContentHash, "PRODUCER_INDEX_HASH");

  const terminalConfigs = new Map(
    roots.map((root) => [
      canonicalJson({
        version: root.traversal.terminalTableConfig.version,
        stopRoles: [...root.traversal.terminalTableConfig.stopRoles].sort(),
      }),
      root.traversal.terminalTableConfig,
    ]),
  );
  if (terminalConfigs.size !== 1)
    throw new Error("PROJECT_EVIDENCE_TERMINAL_CONFIG_MIXED");
  const terminalConfig = roots[0]!.traversal.terminalTableConfig;
  const terminalConfigBody = {
    version: terminalConfig.version,
    stopRoles: [...terminalConfig.stopRoles].sort(),
  };
  const terminalConfigContentHash =
    stableProjectEvidenceHash(terminalConfigBody);
  const scheduleEvidenceContentHash = scheduleEvidenceIdentityHash(roots);
  const body = {
    schemaVersion: PROJECT_EVIDENCE_SOURCE_SCHEMA_VERSION,
    sourceMode: "DIRECT_PROJECT_EVIDENCE" as const,
    algorithmVersion: PROJECT_EVIDENCE_ALGORITHM_VERSION,
    projectKey,
    rootTaskIds,
    inputFingerprint: inputFingerprint.toLowerCase(),
    producerIndexContentHash: producerIndexContentHash.toLowerCase(),
    terminalConfig: {
      version: terminalConfig.version.trim(),
      contentHash: terminalConfigContentHash,
      stopRoles: [...terminalConfig.stopRoles].sort(),
    },
    machineFacts: {
      contractVersion: MACHINE_FACTS_CONTRACT_VERSION,
      adapterVersion: "CANONICAL_ARTIFACT_BOUNDARY",
    },
    scheduleEvidenceContentHash,
    limits: { ...input.limits },
  } as const;
  const contentHash = projectEvidenceSourceContentHash(body);
  return {
    ...body,
    sourceId: projectEvidenceSourceId(contentHash),
    contentHash,
  };
}

export function scheduleEvidenceIdentityHash(
  roots: readonly ProjectEvidenceRootInput[],
): string {
  return stableProjectEvidenceHash(
    [...roots]
      .sort((left, right) => left.rootTaskId.localeCompare(right.rootTaskId))
      .map((root) => ({
        taskId: root.rootTaskId,
        rows: root.oneHop.schedule.evidence,
      })),
  );
}

export function validateOneHopArtifact(
  value: unknown,
  taskId: string,
): asserts value is OneHopReconciliationResult {
  const artifact = record(value, "ONE_HOP_ARTIFACT");
  if (artifact.schemaVersion !== "1.1.0" || artifact.taskId !== taskId)
    throw new Error(
      `PROJECT_EVIDENCE_ONE_HOP_ROOT_OR_SCHEMA_INVALID:${taskId}`,
    );
  const currentTask = record(artifact.currentTask, "ONE_HOP_CURRENT_TASK");
  requireString(currentTask.inputPackPath, "ONE_HOP_INPUT_PACK_PATH");
  requireString(currentTask.inputPackContentHash, "ONE_HOP_INPUT_PACK_HASH");
  requireArray(currentTask.directReads, "ONE_HOP_DIRECT_READS");
  const schedule = record(artifact.schedule, "ONE_HOP_SCHEDULE");
  if (schedule.direction !== "UPSTREAM" || schedule.depth !== 1)
    throw new Error("ONE_HOP_SCHEDULE_INVALID");
  requireArray(schedule.parents, "ONE_HOP_SCHEDULE_PARENTS");
  requireArray(schedule.evidence, "ONE_HOP_SCHEDULE_EVIDENCE");
  requireArray(artifact.parents, "ONE_HOP_PARENTS");
  requireArray(artifact.reconciliation, "ONE_HOP_RECONCILIATION");
  record(artifact.counts, "ONE_HOP_COUNTS");
  record(artifact.countSemantics, "ONE_HOP_COUNT_SEMANTICS");
  const producer = record(artifact.producerIndex, "ONE_HOP_PRODUCER_INDEX");
  assertHash(
    requireString(producer.contentHash, "ONE_HOP_PRODUCER_HASH"),
    "ONE_HOP_PRODUCER_HASH",
  );
  assertHash(
    requireString(producer.inputFingerprint, "ONE_HOP_INPUT_FINGERPRINT"),
    "ONE_HOP_INPUT_FINGERPRINT",
  );
  record(artifact.dataPath, "ONE_HOP_DATA_PATH");
  record(artifact.coverage, "ONE_HOP_COVERAGE");
  requireArray(artifact.nextScheduleTaskIds, "ONE_HOP_NEXT_SCHEDULE_TASKS");
  requireArray(artifact.nextDataTaskIds, "ONE_HOP_NEXT_DATA_TASKS");
  record(
    artifact.partitionAwareNextDataTaskIds,
    "ONE_HOP_PARTITION_AWARE_TASKS",
  );
  const final = record(artifact.finalUpstreamTaskIds, "ONE_HOP_FINAL_UPSTREAM");
  requireArray(final.primary, "ONE_HOP_FINAL_PRIMARY");
  requireArray(final.additional, "ONE_HOP_FINAL_ADDITIONAL");
  requireArray(final.unknown, "ONE_HOP_FINAL_UNKNOWN");
  if (
    ![
      "SCHEDULE_DATA_INTERSECTION",
      "DATA_FALLBACK",
      "SCHEDULE_FALLBACK",
      "MULTIPLE_OVERLAPPING_PRODUCERS",
    ].includes(String(final.decision))
  )
    throw new Error("ONE_HOP_FINAL_DECISION_INVALID");
  requireArray(artifact.issues, "ONE_HOP_ISSUES");
  requireArray(artifact.issueDetails, "ONE_HOP_ISSUE_DETAILS");
  record(artifact.boundaries, "ONE_HOP_BOUNDARIES");
}

function assertHash(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SHA256.test(value))
    throw new Error(`PROJECT_EVIDENCE_${label}_INVALID`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label}_INVALID`);
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`${label}_INVALID`);
  return value;
}

function requireArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label}_INVALID`);
  return value;
}

const SHA256 = /^[a-f0-9]{64}$/i;
