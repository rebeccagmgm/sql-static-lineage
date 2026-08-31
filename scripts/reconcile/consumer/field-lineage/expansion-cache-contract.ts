import {
  canonicalJson,
  sha256,
} from "../../../machine-facts/machine-facts-contract.ts";
import type {
  PhysicalFieldExpansion,
  PhysicalFieldProducerExpansion,
} from "./physical-field-expander.ts";

export const FIELD_EXPANSION_CACHE_SCHEMA_VERSION = "1.0.0" as const;
export const FIELD_EXPANSION_CACHE_CONTRACT_VERSION = "field-expansion-cache-v1" as const;
export const FIELD_EXPANSION_CACHE_ALGORITHM_VERSION = "physical-field-expander-v2" as const;

export type CachedPhysicalFieldProducerExpansion = Omit<
  PhysicalFieldProducerExpansion,
  "producerPack"
>;

export type CachedPhysicalFieldExpansion = Omit<
  PhysicalFieldExpansion,
  "producers"
> & {
  readonly producers: readonly CachedPhysicalFieldProducerExpansion[];
};

export interface FieldExpansionCacheRequest {
  readonly cacheContractVersion: typeof FIELD_EXPANSION_CACHE_CONTRACT_VERSION;
  readonly algorithmVersion: typeof FIELD_EXPANSION_CACHE_ALGORITHM_VERSION;
  readonly factsPolicy: string;
  readonly tableLineageContentHash: string;
  readonly consumerTaskPackContentHash: string | null;
  readonly consumerFactsManifestSha256: string | null;
  readonly consumerFactsState: string;
  readonly consumerTaskId: string;
  readonly sourceNodeId: string;
  readonly physicalFieldKey: string;
  readonly expression: unknown;
}

export interface FieldExpansionCacheDependency {
  readonly taskId: string;
  readonly taskPackPresent: boolean;
  readonly taskPackContentHash: string | null;
  readonly factsPresent: boolean;
  readonly factsManifestSha256: string | null;
  readonly factsState: string;
  readonly producerTargetIdentity: string | null;
}

export type FieldExpansionCacheEntryPayload = Omit<
  FieldExpansionCacheEntry,
  "payloadSha256"
>;

export interface FieldExpansionCacheEntry {
  readonly schemaVersion: typeof FIELD_EXPANSION_CACHE_SCHEMA_VERSION;
  readonly key: string;
  readonly request: FieldExpansionCacheRequest;
  readonly dependencies: readonly FieldExpansionCacheDependency[];
  readonly expansion: CachedPhysicalFieldExpansion;
  readonly payloadSha256: string;
}

export function fieldExpansionCacheKey(
  request: FieldExpansionCacheRequest,
): string {
  return sha256(canonicalJson(request));
}

export function fieldExpansionCachePayloadSha256(
  payload: FieldExpansionCacheEntryPayload,
): string {
  return sha256(canonicalJson(payload));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isLogicalEvidenceRef(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  if (/^[A-Za-z]:[\\/]/.test(value) || /^[\\/]/.test(value)) return false;
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value);
}

function validEvidenceRefs(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((item) => isLogicalEvidenceRef(item))
  );
}

function logicalLocatorFields(value: unknown, key = ""): boolean {
  const normalized = key.toLowerCase();
  if (normalized === "evidencerefs") return validEvidenceRefs(value);
  if (Array.isArray(value)) return value.every((item) => logicalLocatorFields(item, key));
  if (!isRecord(value)) return true;
  for (const [childKey, childValue] of Object.entries(value)) {
    const childNormalized = childKey.toLowerCase();
    if (
      childNormalized === "locator" ||
      childNormalized === "path" ||
      childNormalized.endsWith("filepath") ||
      childNormalized.endsWith("physicalpath") ||
      childNormalized.endsWith("sourcepath") ||
      childNormalized.endsWith("bundlepath") ||
      childNormalized.endsWith("taskpath") ||
      childNormalized.endsWith("tablepath") ||
      childNormalized.endsWith("ddlpath") ||
      childNormalized.endsWith("indexpath") ||
      childNormalized.endsWith("statuspath") ||
      childNormalized.endsWith("bundledir")
    ) {
      if (!isLogicalEvidenceRef(childValue)) return false;
      continue;
    }
    if (!logicalLocatorFields(childValue, childKey)) return false;
  }
  return true;
}

export function hasOnlyLogicalLocators(value: unknown): boolean {
  return logicalLocatorFields(value);
}

function validPhysicalField(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.platform === "string" &&
    typeof value.dataSource === "string" &&
    typeof value.stableTableId === "string" &&
    typeof value.qualifiedName === "string" &&
    typeof value.column === "string" &&
    (value.identityStatus === "SCHEMA_BACKED" ||
      value.identityStatus === "TASK_LOCAL_SCHEMA_BACKED")
  );
}

function validDependency(value: unknown): value is FieldExpansionCacheDependency {
  if (!isRecord(value)) return false;
  const taskPackPresent = value.taskPackPresent;
  const factsPresent = value.factsPresent;
  return (
    typeof value.taskId === "string" &&
    typeof taskPackPresent === "boolean" &&
    (value.taskPackContentHash === null || isSha256(value.taskPackContentHash)) &&
    typeof factsPresent === "boolean" &&
    (value.factsManifestSha256 === null || isSha256(value.factsManifestSha256)) &&
    typeof value.factsState === "string" &&
    (value.producerTargetIdentity === null ||
      typeof value.producerTargetIdentity === "string") &&
    taskPackPresent === (value.taskPackContentHash !== null) &&
    factsPresent === (value.factsManifestSha256 !== null)
  );
}

function validProducer(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    !Object.prototype.hasOwnProperty.call(value, "producerPack") &&
    typeof value.producerTaskId === "string" &&
    (value.producerField === null || validPhysicalField(value.producerField)) &&
    Array.isArray(value.producerBindings) &&
    value.producerBindings.every(isRecord) &&
    (value.bridge === null || isRecord(value.bridge)) &&
    Array.isArray(value.bridges) &&
    value.bridges.every(isRecord) &&
    logicalLocatorFields(value.producerBindings) &&
    logicalLocatorFields(value.bridge) &&
    logicalLocatorFields(value.bridges) &&
    ["PRIMARY", "ADDITIONAL", "UNKNOWN", "CANDIDATE"].includes(
      String(value.producerRole),
    ) &&
    ["CONFIRMED", "PROVISIONAL_LEGACY", "UNRESOLVED"].includes(
      String(value.evidenceStatus),
    ) &&
    validEvidenceRefs(value.evidenceRefs) &&
    typeof value.shouldRecurse === "boolean"
  );
}

function validExpansion(value: unknown): value is CachedPhysicalFieldExpansion {
  if (!isRecord(value)) return false;
  const candidates = value.candidates;
  const gaps = value.gaps;
  return (
    typeof value.classified === "boolean" &&
    typeof value.ambiguous === "boolean" &&
    Array.isArray(value.consultedProducerTaskIds) &&
    value.consultedProducerTaskIds.every((taskId) => typeof taskId === "string") &&
    Array.isArray(value.reachablePrimaryProducerTaskIds) &&
    value.reachablePrimaryProducerTaskIds.every((taskId) => typeof taskId === "string") &&
    Array.isArray(value.producers) &&
    value.producers.every(validProducer) &&
    Array.isArray(candidates) &&
    candidates.every(
      (candidate) =>
        isRecord(candidate) &&
        typeof candidate.candidateId === "string" &&
        typeof candidate.consumerTaskId === "string" &&
        typeof candidate.producerTaskId === "string" &&
        validPhysicalField(candidate.field) &&
        typeof candidate.reasonCode === "string",
    ) &&
    Array.isArray(gaps) &&
    gaps.every(
      (gap) =>
        isRecord(gap) &&
        typeof gap.gapId === "string" &&
        typeof gap.taskId === "string" &&
        typeof gap.nodeId === "string" &&
        (gap.field === null || validPhysicalField(gap.field)) &&
        typeof gap.reasonCode === "string" &&
        typeof gap.message === "string" &&
        ["CONFIRMED", "PROVISIONAL_LEGACY", "UNRESOLVED"].includes(
          String(gap.evidenceStatus),
        ) &&
        validEvidenceRefs(gap.evidenceRefs)
    )
  );
}

export function validateFieldExpansionCacheEntry(
  value: unknown,
  expectedKey?: string,
): asserts value is FieldExpansionCacheEntry {
  if (!isRecord(value)) throw new Error("CACHE_ENTRY_NOT_OBJECT");
  if (value.schemaVersion !== FIELD_EXPANSION_CACHE_SCHEMA_VERSION)
    throw new Error("CACHE_ENTRY_SCHEMA_UNSUPPORTED");
  if (!isSha256(value.key) || (expectedKey !== undefined && value.key !== expectedKey))
    throw new Error("CACHE_ENTRY_KEY_INVALID");
  if (!isRecord(value.request)) throw new Error("CACHE_ENTRY_REQUEST_INVALID");
  const request = value.request as unknown as FieldExpansionCacheRequest;
  if (
    request.cacheContractVersion !== FIELD_EXPANSION_CACHE_CONTRACT_VERSION ||
    request.algorithmVersion !== FIELD_EXPANSION_CACHE_ALGORITHM_VERSION ||
    typeof request.factsPolicy !== "string" ||
    !isSha256(request.tableLineageContentHash) ||
    (request.consumerTaskPackContentHash !== null &&
      !isSha256(request.consumerTaskPackContentHash)) ||
    (request.consumerFactsManifestSha256 !== null &&
      !isSha256(request.consumerFactsManifestSha256)) ||
    typeof request.consumerFactsState !== "string" ||
    typeof request.consumerTaskId !== "string" ||
    typeof request.sourceNodeId !== "string" ||
    typeof request.physicalFieldKey !== "string"
  )
    throw new Error("CACHE_ENTRY_REQUEST_INVALID");
  if (fieldExpansionCacheKey(request) !== value.key)
    throw new Error("CACHE_ENTRY_REQUEST_KEY_MISMATCH");
  if (!Array.isArray(value.dependencies) || !value.dependencies.every(validDependency))
    throw new Error("CACHE_ENTRY_DEPENDENCIES_INVALID");
  if (!validExpansion(value.expansion))
    throw new Error("CACHE_ENTRY_EXPANSION_INVALID");
  if (!isSha256(value.payloadSha256))
    throw new Error("CACHE_ENTRY_PAYLOAD_HASH_INVALID");
  const requiredDependencyIds = new Set([
    ...value.expansion.consultedProducerTaskIds,
    ...value.expansion.reachablePrimaryProducerTaskIds,
    ...value.expansion.producers.map((producer) => producer.producerTaskId),
    ...value.expansion.candidates.map((candidate) => candidate.producerTaskId),
  ]);
  const actualDependencyIds = new Set(
    value.dependencies.map((dependency) => dependency.taskId),
  );
  if ([...requiredDependencyIds].some((taskId) => !actualDependencyIds.has(taskId)))
    throw new Error("CACHE_ENTRY_DEPENDENCIES_INCOMPLETE");
  const { payloadSha256: _payloadSha256, ...payload } = value as unknown as FieldExpansionCacheEntry;
  if (
    fieldExpansionCachePayloadSha256(payload as FieldExpansionCacheEntryPayload) !==
    value.payloadSha256
  )
    throw new Error("CACHE_ENTRY_PAYLOAD_HASH_MISMATCH");
}
