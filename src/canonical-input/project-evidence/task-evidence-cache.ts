import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import { canonicalJson, safeSegment, sha256 } from "../../contracts/runtime.ts";
import type { OneHopReconciliationResult } from "../../contracts/canonical-artifacts.ts";
import {
  stableProjectEvidenceHash,
  validateOneHopArtifact,
} from "./project-evidence-contract.ts";

export interface PrefetchedScheduleEvidence {
  readonly rows: readonly Record<string, unknown>[];
  readonly provider: string;
  readonly locator: string;
  readonly observedAt: string;
  readonly cacheStatus?: string;
  readonly cachePath?: string;
}

export interface ProducerTableIdentity {
  readonly platform: string;
  readonly dataSource: string;
  readonly qualifiedName: string;
}

export interface TableProducerIndex {
  readonly buildStatus: "SUCCESS" | "PARTIAL";
  readonly inputFingerprint: string;
  readonly contentHash: string;
  readonly confirmedProducerEdges: readonly Record<string, unknown>[];
  readonly nonConfirmedRelations: readonly Record<string, unknown>[];
}

function tableMatches(value: unknown, wanted: ProducerTableIdentity): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const table = value as Record<string, unknown>;
  return (
    table.qualifiedName === wanted.qualifiedName &&
    table.platform === wanted.platform &&
    table.dataSource === wanted.dataSource
  );
}

function relationTable(value: Record<string, unknown>): unknown {
  return value.table ?? value.tableRef;
}

function lookupConfirmedProducers(
  index: TableProducerIndex,
  table: ProducerTableIdentity,
): readonly Record<string, unknown>[] {
  return index.confirmedProducerEdges.filter((edge) =>
    tableMatches(edge.table, table),
  );
}

function lookupNonConfirmedRelations(
  index: TableProducerIndex,
  table: ProducerTableIdentity,
): readonly Record<string, unknown>[] {
  return index.nonConfirmedRelations.filter((relation) =>
    tableMatches(relationTable(relation), table),
  );
}

function lookupProducerWritesByTask(
  index: TableProducerIndex,
  taskId: string,
): {
  readonly confirmedWrites: readonly Record<string, unknown>[];
  readonly nonConfirmedRelations: readonly Record<string, unknown>[];
} {
  return {
    confirmedWrites: index.confirmedProducerEdges.filter(
      (edge) => edge.taskId === taskId,
    ),
    nonConfirmedRelations: index.nonConfirmedRelations.filter(
      (relation) => relation.taskId === taskId,
    ),
  };
}

export const DEFAULT_RAW_ONE_HOP_CACHE_ROOT =
  "E:\\02_area\\股衍数据-数据cookbook\\sql-static-lineage-cache\\one-hop";
export const RAW_ONE_HOP_CACHE_SCHEMA_VERSION = "1.1.0" as const;
export const RAW_ONE_HOP_CACHE_ARTIFACT_TYPE = "RAW_ONE_HOP_CACHE" as const;
export const RAW_ONE_HOP_CACHE_ALGORITHM_VERSION =
  "raw-one-hop-task-local-v2" as const;

const SHA256 = /^[a-f0-9]{64}$/i;

export interface RawOneHopCacheLookupIdentity {
  readonly algorithmVersion: typeof RAW_ONE_HOP_CACHE_ALGORITHM_VERSION;
  readonly taskId: string;
  readonly taskInputContentHash: string;
  readonly machineFactsManifestHash: string;
  readonly scheduleEvidenceContentHash: string;
  readonly terminalConfigContentHash: string;
}

export interface RawOneHopCacheIdentity extends RawOneHopCacheLookupIdentity {
  readonly producerEvidenceContentHash: string;
}

export interface BuildRawOneHopCacheLookupIdentityInput {
  readonly taskId: string;
  readonly taskInputContentHash: string;
  readonly machineFactsManifestHash: string;
  readonly scheduleRows: readonly Record<string, unknown>[];
  readonly terminalConfigContentHash: string;
}

export interface RawOneHopCacheDocument {
  readonly schemaVersion: typeof RAW_ONE_HOP_CACHE_SCHEMA_VERSION;
  readonly artifactType: typeof RAW_ONE_HOP_CACHE_ARTIFACT_TYPE;
  readonly identity: RawOneHopCacheIdentity;
  readonly result: OneHopReconciliationResult;
  readonly contentHash: string;
}

export type RawOneHopCacheRead =
  | {
      readonly status: "MISS";
      readonly path: string;
      readonly reason:
        "NOT_FOUND" | "TASK_INPUT_CHANGED" | "PRODUCER_EVIDENCE_CHANGED";
    }
  | {
      readonly status: "INVALID";
      readonly path: string;
      readonly reason: string;
    }
  | {
      readonly status: "HIT";
      readonly path: string;
      readonly identityHash: string;
      readonly contentHash: string;
      readonly result: OneHopReconciliationResult;
    };

export interface RawOneHopCacheWrite {
  readonly status: "CREATED" | "REUSED" | "REPLACED";
  readonly path: string;
  readonly identityHash: string;
  readonly contentHash: string;
}

export function buildRawOneHopCacheLookupIdentity(
  input: BuildRawOneHopCacheLookupIdentityInput,
): RawOneHopCacheLookupIdentity {
  const taskId = safeSegment(input.taskId, "taskId");
  const identity = {
    algorithmVersion: RAW_ONE_HOP_CACHE_ALGORITHM_VERSION,
    taskId,
    taskInputContentHash: normalizedHash(
      input.taskInputContentHash,
      "TASK_INPUT_CONTENT_HASH",
    ),
    machineFactsManifestHash: normalizedHash(
      input.machineFactsManifestHash,
      "MACHINE_FACTS_MANIFEST_HASH",
    ),
    scheduleEvidenceContentHash: stableProjectEvidenceHash({
      taskId,
      rows: input.scheduleRows,
    }),
    terminalConfigContentHash: normalizedHash(
      input.terminalConfigContentHash,
      "TERMINAL_CONFIG_CONTENT_HASH",
    ),
  } as const;
  validateRawOneHopCacheLookupIdentity(identity);
  return identity;
}

export function rawOneHopCachePath(
  cacheRootInput: string,
  taskIdInput: string,
): string {
  const taskId = safeSegment(taskIdInput, "taskId");
  return join(resolve(cacheRootInput), "tasks", taskId, "one-hop.json");
}

export function readRawOneHopCache(
  cacheRootInput: string,
  expectedIdentity: RawOneHopCacheLookupIdentity,
  producerIndex: TableProducerIndex,
): RawOneHopCacheRead {
  validateRawOneHopCacheLookupIdentity(expectedIdentity);
  const path = rawOneHopCachePath(cacheRootInput, expectedIdentity.taskId);
  if (!existsSync(path)) return { status: "MISS", path, reason: "NOT_FOUND" };

  let document: RawOneHopCacheDocument;
  try {
    document = JSON.parse(readFileSync(path, "utf8")) as RawOneHopCacheDocument;
    validateRawOneHopCacheDocument(document);
  } catch (error) {
    return {
      status: "INVALID",
      path,
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  const {
    producerEvidenceContentHash: storedProducerEvidenceContentHash,
    ...storedLookupIdentity
  } = document.identity;
  if (canonicalJson(storedLookupIdentity) !== canonicalJson(expectedIdentity))
    return { status: "MISS", path, reason: "TASK_INPUT_CHANGED" };

  const currentProducerEvidenceContentHash = rawOneHopProducerEvidenceHash(
    document.result,
    producerIndex,
  );
  if (storedProducerEvidenceContentHash !== currentProducerEvidenceContentHash)
    return {
      status: "MISS",
      path,
      reason: "PRODUCER_EVIDENCE_CHANGED",
    };

  return {
    status: "HIT",
    path,
    identityHash: sha256(canonicalJson(document.identity)),
    contentHash: document.contentHash,
    result: document.result,
  };
}

export function writeRawOneHopCache(
  cacheRootInput: string,
  lookupIdentity: RawOneHopCacheLookupIdentity,
  producerIndex: TableProducerIndex,
  result: OneHopReconciliationResult,
): RawOneHopCacheWrite {
  validateRawOneHopCacheLookupIdentity(lookupIdentity);
  validateOneHopArtifact(result, lookupIdentity.taskId);
  assertOneHopMatchesTaskInput(result, lookupIdentity);
  assertOneHopUsesCurrentProducerIndex(result, producerIndex);

  const identity: RawOneHopCacheIdentity = {
    ...lookupIdentity,
    producerEvidenceContentHash: rawOneHopProducerEvidenceHash(
      result,
      producerIndex,
    ),
  };
  const body = {
    schemaVersion: RAW_ONE_HOP_CACHE_SCHEMA_VERSION,
    artifactType: RAW_ONE_HOP_CACHE_ARTIFACT_TYPE,
    identity,
    result,
  } as const;
  const document: RawOneHopCacheDocument = {
    ...body,
    contentHash: sha256(canonicalJson(body)),
  };
  const path = rawOneHopCachePath(cacheRootInput, identity.taskId);
  const current = readRawOneHopCache(
    cacheRootInput,
    lookupIdentity,
    producerIndex,
  );
  const identityHash = sha256(canonicalJson(identity));
  if (current.status === "HIT") {
    if (
      stableRawOneHopResultHash(current.result) !==
      stableRawOneHopResultHash(result)
    )
      throw new Error(`RAW_ONE_HOP_CACHE_CONFLICT:${identity.taskId}`);
    return {
      status: "REUSED",
      path,
      identityHash,
      contentHash: current.contentHash,
    };
  }

  mkdirSync(dirname(path), { recursive: true });
  const staged = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const backup = `${path}.${process.pid}.${randomUUID()}.previous`;
  const hadTarget = existsSync(path);
  writeFileSync(staged, `${JSON.stringify(document)}\n`, "utf8");
  try {
    validateRawOneHopCacheDocument(
      JSON.parse(readFileSync(staged, "utf8")) as unknown,
    );
    if (hadTarget) renameSync(path, backup);
    try {
      renameSync(staged, path);
    } catch (error) {
      if (hadTarget && existsSync(backup)) renameSync(backup, path);
      throw error;
    }
    if (hadTarget && existsSync(backup)) rmSync(backup, { force: true });
  } finally {
    if (existsSync(staged)) rmSync(staged, { force: true });
  }
  return {
    status: hadTarget ? "REPLACED" : "CREATED",
    path,
    identityHash,
    contentHash: document.contentHash,
  };
}

export function rawOneHopProducerEvidenceHash(
  result: OneHopReconciliationResult,
  producerIndex: TableProducerIndex,
): string {
  const tables = resolvedDirectReadTables(result);
  const scheduleParentTaskIds = [
    ...new Set(
      result.schedule.parents
        .map((parent) => parent.taskId)
        .filter((taskId): taskId is string => typeof taskId === "string"),
    ),
  ].sort(compareText);
  return stableProjectEvidenceHash({
    directReadTables: tables.map((table) => ({
      table,
      confirmedProducerEdges: stableRecords(
        lookupConfirmedProducers(producerIndex, table),
      ),
      nonConfirmedRelations: stableRecords(
        lookupNonConfirmedRelations(producerIndex, table),
      ),
    })),
    scheduleParents: scheduleParentTaskIds.map((taskId) => ({
      taskId,
      ...lookupProducerWritesByTask(producerIndex, taskId),
    })),
  });
}

export function rebindOneHopScheduleProvenance(
  result: OneHopReconciliationResult,
  evidence: PrefetchedScheduleEvidence,
): OneHopReconciliationResult {
  return rebindValue(result, evidence) as OneHopReconciliationResult;
}

export function rebindOneHopProducerIndexProvenance(
  result: OneHopReconciliationResult,
  producerIndex: TableProducerIndex,
): OneHopReconciliationResult {
  const status =
    producerIndex.buildStatus === "PARTIAL"
      ? ("VALID_PARTIAL" as const)
      : ("VALID_SUCCESS" as const);
  const coverage = result.coverage as Record<string, unknown>;
  const retrieval = (coverage.retrieval ?? {}) as Record<string, unknown>;
  return {
    ...result,
    producerIndex: {
      status,
      contentHash: producerIndex.contentHash,
      inputFingerprint: producerIndex.inputFingerprint,
    },
    coverage: {
      ...coverage,
      retrieval: {
        ...retrieval,
        producerIndex: status,
      },
    },
  };
}

function resolvedDirectReadTables(
  result: OneHopReconciliationResult,
): ProducerTableIdentity[] {
  const byKey = new Map<string, ProducerTableIdentity>();
  for (const read of result.currentTask.directReads) {
    const readRecord = read as Record<string, unknown>;
    const table = recordValue(readRecord.table, "RAW_ONE_HOP_READ_TABLE");
    const platform = requiredTablePart(table.platform);
    const dataSource = requiredTablePart(table.dataSource);
    const qualifiedName = requiredTablePart(table.qualifiedName);
    if (!platform || !dataSource || !qualifiedName) continue;
    const identity = { platform, dataSource, qualifiedName };
    byKey.set(
      `${platform.toLowerCase()}|${dataSource.toLowerCase()}|${qualifiedName.toLowerCase()}`,
      identity,
    );
  }
  return [...byKey.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, table]) => table);
}

function stableRecords<T>(records: readonly T[]): readonly T[] {
  return [...records].sort((left, right) =>
    compareText(
      stableProjectEvidenceHash(left),
      stableProjectEvidenceHash(right),
    ),
  );
}

function requiredTablePart(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label}_INVALID`);
  return value as Record<string, unknown>;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function rebindValue(
  value: unknown,
  evidence: PrefetchedScheduleEvidence,
): unknown {
  if (Array.isArray(value))
    return value.map((item) => rebindValue(item, evidence));
  if (typeof value !== "object" || value === null) return value;
  const record = value as Record<string, unknown>;
  const output = Object.fromEntries(
    Object.entries(record).map(([key, child]) => [
      key,
      rebindValue(child, evidence),
    ]),
  );
  if (record.source !== "HORAE_RELATION") return output;
  output.provider = evidence.provider;
  output.locator = evidence.locator;
  output.observedAt = evidence.observedAt;
  if (typeof record.detail === "object" && record.detail !== null) {
    const {
      cacheStatus: _cacheStatus,
      cachePath: _cachePath,
      ...semanticDetail
    } = record.detail as Record<string, unknown>;
    if ("rowsProvided" in semanticDetail) {
      semanticDetail.rowsProvided = evidence.rows.length;
      if (evidence.cacheStatus !== undefined)
        semanticDetail.cacheStatus = evidence.cacheStatus;
      if (evidence.cachePath !== undefined)
        semanticDetail.cachePath = evidence.cachePath;
    }
    output.detail = semanticDetail;
  }
  return output;
}

function validateRawOneHopCacheLookupIdentity(
  identity: RawOneHopCacheLookupIdentity,
): void {
  if (identity.algorithmVersion !== RAW_ONE_HOP_CACHE_ALGORITHM_VERSION)
    throw new Error("RAW_ONE_HOP_CACHE_ALGORITHM_INVALID");
  safeSegment(identity.taskId, "taskId");
  for (const [label, value] of [
    ["TASK_INPUT_CONTENT_HASH", identity.taskInputContentHash],
    ["MACHINE_FACTS_MANIFEST_HASH", identity.machineFactsManifestHash],
    ["SCHEDULE_EVIDENCE_CONTENT_HASH", identity.scheduleEvidenceContentHash],
    ["TERMINAL_CONFIG_CONTENT_HASH", identity.terminalConfigContentHash],
  ] as const)
    normalizedHash(value, label);
}

function validateRawOneHopCacheIdentity(
  identity: RawOneHopCacheIdentity,
): void {
  validateRawOneHopCacheLookupIdentity(identity);
  normalizedHash(
    identity.producerEvidenceContentHash,
    "PRODUCER_EVIDENCE_CONTENT_HASH",
  );
}

function validateRawOneHopCacheDocument(
  value: unknown,
): asserts value is RawOneHopCacheDocument {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("RAW_ONE_HOP_CACHE_DOCUMENT_INVALID");
  const document = value as Record<string, unknown>;
  const expectedKeys = [
    "artifactType",
    "contentHash",
    "identity",
    "result",
    "schemaVersion",
  ];
  if (
    Object.keys(document).sort().join("\u0000") !==
    expectedKeys.sort().join("\u0000")
  )
    throw new Error("RAW_ONE_HOP_CACHE_FIELDS_INVALID");
  if (
    document.schemaVersion !== RAW_ONE_HOP_CACHE_SCHEMA_VERSION ||
    document.artifactType !== RAW_ONE_HOP_CACHE_ARTIFACT_TYPE
  )
    throw new Error("RAW_ONE_HOP_CACHE_CONTRACT_INVALID");
  validateRawOneHopCacheIdentity(document.identity as RawOneHopCacheIdentity);
  if (
    typeof document.contentHash !== "string" ||
    !SHA256.test(document.contentHash)
  )
    throw new Error("RAW_ONE_HOP_CACHE_CONTENT_HASH_INVALID");
  const { contentHash: _contentHash, ...body } = document;
  if (document.contentHash !== sha256(canonicalJson(body)))
    throw new Error("RAW_ONE_HOP_CACHE_CONTENT_HASH_MISMATCH");
  const identity = document.identity as RawOneHopCacheIdentity;
  validateOneHopArtifact(document.result, identity.taskId);
  assertOneHopMatchesTaskInput(
    document.result as OneHopReconciliationResult,
    identity,
  );
}

function assertOneHopMatchesTaskInput(
  result: OneHopReconciliationResult,
  identity: RawOneHopCacheLookupIdentity,
): void {
  if (result.currentTask.inputPackContentHash !== identity.taskInputContentHash)
    throw new Error("RAW_ONE_HOP_CACHE_TASK_INPUT_MISMATCH");
}

function assertOneHopUsesCurrentProducerIndex(
  result: OneHopReconciliationResult,
  producerIndex: TableProducerIndex,
): void {
  if (
    result.producerIndex.inputFingerprint !== producerIndex.inputFingerprint ||
    result.producerIndex.contentHash !== producerIndex.contentHash
  )
    throw new Error("RAW_ONE_HOP_CACHE_PRODUCER_INDEX_MISMATCH");
}

function stableRawOneHopResultHash(result: OneHopReconciliationResult): string {
  const coverage = result.coverage as Record<string, unknown>;
  const retrieval = (coverage.retrieval ?? {}) as Record<string, unknown>;
  const normalized = {
    ...result,
    producerIndex: {
      status: "VALID_CURRENT_INDEX",
      contentHash: null,
      inputFingerprint: null,
    },
    coverage: {
      ...coverage,
      retrieval: {
        ...retrieval,
        producerIndex: "VALID_CURRENT_INDEX",
      },
    },
  };
  return stableProjectEvidenceHash(normalized);
}

function normalizedHash(value: string, label: string): string {
  if (!SHA256.test(value))
    throw new Error(`RAW_ONE_HOP_CACHE_${label}_INVALID`);
  return value.toLowerCase();
}
