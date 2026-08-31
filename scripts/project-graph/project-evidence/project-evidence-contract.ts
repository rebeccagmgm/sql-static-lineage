import {
  MACHINE_FACTS_ADAPTER_VERSION,
  MACHINE_FACTS_CONTRACT_VERSION,
  canonicalJson,
  safeSegment,
  sha256,
} from "../../machine-facts/machine-facts-contract.ts";
import type { OneHopReconciliationResult } from "../../reconcile/consumer/one-hop/reconcile-one-hop.ts";

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

const SHA256 = /^[a-f0-9]{64}$/i;
const VOLATILE_IDENTITY_FIELDS = new Set([
  "generatedAt",
  "observedAt",
  "cacheStatus",
  "cachePath",
  "inputPackPath",
]);

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

export interface ProjectEvidenceLimits {
  readonly maxRoots: number;
  readonly maxDepth: number;
  readonly maxTasksPerRoot: number;
  readonly maxEdgesPerRoot: number;
  readonly maxUnionTasks: number;
  readonly maxRounds: number;
}

export interface BuildProjectEvidenceSourceInput {
  readonly projectKey: string;
  readonly rootTaskIds: readonly string[];
  readonly inputFingerprint: string;
  readonly producerIndexContentHash: string;
  readonly terminalConfig: {
    readonly version: string;
    readonly contentHash: string;
    readonly stopRoles: readonly string[];
  };
  readonly scheduleEvidenceContentHash: string;
  readonly limits: ProjectEvidenceLimits;
  readonly machineFactsContractVersion?: string;
  readonly machineFactsAdapterVersion?: string;
}

export function buildProjectEvidenceSourceDescriptor(
  input: BuildProjectEvidenceSourceInput,
): ProjectEvidenceSourceDescriptorV1 {
  const projectKey = safeSegment(input.projectKey, "projectKey");
  const rootTaskIds = sortedUnique(
    input.rootTaskIds.map((taskId) => safeSegment(taskId, "rootTaskId")),
  );
  if (
    rootTaskIds.length === 0 ||
    rootTaskIds.length !== input.rootTaskIds.length
  )
    throw new Error("PROJECT_EVIDENCE_ROOTS_INVALID");
  for (const [label, value] of [
    ["INPUT_FINGERPRINT", input.inputFingerprint],
    ["PRODUCER_INDEX_HASH", input.producerIndexContentHash],
    ["TERMINAL_CONFIG_HASH", input.terminalConfig.contentHash],
    ["SCHEDULE_EVIDENCE_HASH", input.scheduleEvidenceContentHash],
  ] as const) {
    if (!SHA256.test(value))
      throw new Error(`PROJECT_EVIDENCE_${label}_INVALID`);
  }
  for (const [label, value] of Object.entries(input.limits)) {
    if (!Number.isSafeInteger(value) || value < 1)
      throw new Error(`PROJECT_EVIDENCE_${label.toUpperCase()}_INVALID`);
  }
  if (rootTaskIds.length > input.limits.maxRoots)
    throw new Error("PROJECT_EVIDENCE_MAX_ROOTS_REACHED");
  const body = {
    schemaVersion: PROJECT_EVIDENCE_SOURCE_SCHEMA_VERSION,
    sourceMode: "DIRECT_PROJECT_EVIDENCE" as const,
    algorithmVersion: PROJECT_EVIDENCE_ALGORITHM_VERSION,
    projectKey,
    rootTaskIds,
    inputFingerprint: input.inputFingerprint.toLowerCase(),
    producerIndexContentHash: input.producerIndexContentHash.toLowerCase(),
    terminalConfig: {
      version: requiredText(
        input.terminalConfig.version,
        "TERMINAL_CONFIG_VERSION",
      ),
      contentHash: input.terminalConfig.contentHash.toLowerCase(),
      stopRoles: sortedUnique([...input.terminalConfig.stopRoles]),
    },
    machineFacts: {
      contractVersion:
        input.machineFactsContractVersion ?? MACHINE_FACTS_CONTRACT_VERSION,
      adapterVersion:
        input.machineFactsAdapterVersion ?? MACHINE_FACTS_ADAPTER_VERSION,
    },
    scheduleEvidenceContentHash:
      input.scheduleEvidenceContentHash.toLowerCase(),
    limits: { ...input.limits },
  };
  const contentHash = projectEvidenceSourceContentHash(body);
  return {
    ...body,
    sourceId: projectEvidenceSourceId(contentHash),
    contentHash,
  };
}

/**
 * Identity hash for in-memory evidence. Acquisition timestamps, cache state and
 * machine-local paths remain in provenance objects but do not churn identity.
 */
export function stableProjectEvidenceHash(value: unknown): string {
  return sha256(canonicalJson(stableIdentityValue(value, true)));
}

export function scheduleEvidenceIdentityHash(
  evidenceByTaskId: ReadonlyMap<
    string,
    { readonly rows: readonly Record<string, unknown>[] }
  >,
): string {
  return stableProjectEvidenceHash(
    [...evidenceByTaskId.entries()]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([taskId, evidence]) => ({ taskId, rows: evidence.rows })),
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
  if (
    !SHA256.test(requireString(producer.contentHash, "ONE_HOP_PRODUCER_HASH"))
  )
    throw new Error("ONE_HOP_PRODUCER_HASH_INVALID");
  if (
    !SHA256.test(
      requireString(producer.inputFingerprint, "ONE_HOP_INPUT_FINGERPRINT"),
    )
  )
    throw new Error("ONE_HOP_INPUT_FINGERPRINT_INVALID");
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

function stableIdentityValue(value: unknown, topLevel: boolean): unknown {
  if (Array.isArray(value))
    return value.map((item) => stableIdentityValue(item, false));
  if (typeof value !== "object" || value === null) return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (VOLATILE_IDENTITY_FIELDS.has(key)) continue;
    if (topLevel && key === "contentHash") continue;
    output[key] = stableIdentityValue(item, false);
  }
  return output;
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`PROJECT_EVIDENCE_${label}_INVALID`);
  return normalized;
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
