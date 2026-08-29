import {
  MACHINE_FACTS_ADAPTER_VERSION,
  MACHINE_FACTS_CONTRACT_VERSION,
  canonicalJson,
  safeSegment,
  sha256,
} from "../../machine-facts/machine-facts-contract.ts";
import {
  PROJECT_EVIDENCE_ALGORITHM_VERSION,
  PROJECT_EVIDENCE_SOURCE_SCHEMA_VERSION,
  projectEvidenceSourceContentHash,
  projectEvidenceSourceId,
  sortedUnique,
  type ProjectEvidenceSourceDescriptorV1,
} from "../contracts/project-topology-contract.ts";

const SHA256 = /^[a-f0-9]{64}$/i;
const VOLATILE_IDENTITY_FIELDS = new Set([
  "generatedAt",
  "observedAt",
  "cacheStatus",
  "cachePath",
  "inputPackPath",
]);

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
  if (rootTaskIds.length === 0 || rootTaskIds.length !== input.rootTaskIds.length)
    throw new Error("PROJECT_EVIDENCE_ROOTS_INVALID");
  for (const [label, value] of [
    ["INPUT_FINGERPRINT", input.inputFingerprint],
    ["PRODUCER_INDEX_HASH", input.producerIndexContentHash],
    ["TERMINAL_CONFIG_HASH", input.terminalConfig.contentHash],
    ["SCHEDULE_EVIDENCE_HASH", input.scheduleEvidenceContentHash],
  ] as const) {
    if (!SHA256.test(value)) throw new Error(`PROJECT_EVIDENCE_${label}_INVALID`);
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
      version: requiredText(input.terminalConfig.version, "TERMINAL_CONFIG_VERSION"),
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
