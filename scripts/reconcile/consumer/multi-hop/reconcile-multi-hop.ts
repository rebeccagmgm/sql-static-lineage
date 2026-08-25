import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalHash, type JsonValue } from "../../../input/shared/input-pack.ts";
import type { OneHopReconciliationResult } from "../one-hop/reconcile-one-hop.ts";
import {
  fingerprintTableProducerInputs,
  loadTableProducerIndex,
  validateTableProducerIndex,
  type ProducerTableIdentity,
  type ProducerWriteObservation,
  type TableProducerIndex,
} from "../../producer/producer-index.ts";
import { lookupConfirmedProducers } from "../../../query/producer-index-query.ts";
import {
  buildTaskReadEvidenceRepository,
  type TaskReadEvidenceRepository,
  type TaskDirectReadObservation,
  type TaskInputPackStatus,
  type TaskReadBlockReason,
  type TaskReadEvidence,
  type TaskReadTableRef,
} from "./task-read-evidence.ts";
import {
  loadTerminalTableConfig,
  matchingTerminalRole,
  type TerminalTableConfig,
} from "./terminal-table-config.ts";

type ExpansionStatus = "EXPANDED" | "TERMINAL" | "TRUNCATED";

export type MultiHopTerminalReason =
  | Exclude<TaskInputPackStatus, "TASK_INPUT_PACK_AVAILABLE">
  | TaskReadBlockReason
  | "NO_DIRECT_READS"
  | "NO_CONFIRMED_PRODUCER_OBSERVED"
  | "MAX_DEPTH_REACHED"
  | "MAX_TASKS_REACHED"
  | "MAX_EDGES_REACHED"
  | "CYCLE"
  | "ALREADY_DISCOVERED"
  | "REFERENCE_CONFIG";

export interface MultiHopTaskNode {
  readonly taskId: string;
  readonly minDepth: number;
  readonly expansionStatus: ExpansionStatus;
  readonly taskInputPackStatus: TaskInputPackStatus | null;
  readonly taskContentHash: string | null;
  readonly evidence: readonly TaskReadEvidence[];
}

export interface MultiHopTableNode {
  readonly platform: string | null;
  readonly dataSource: string | null;
  readonly qualifiedName: string;
  readonly identityStatus: TaskReadTableRef["identityStatus"];
}

export interface MultiHopReadEdge {
  readonly consumerTaskId: string;
  readonly table: TaskReadTableRef;
  readonly statementIndexes: readonly number[];
  readonly eligibleStatementIndexes: readonly number[];
  readonly blockedStatementIndexes: readonly number[];
  readonly recursionStatus: TaskDirectReadObservation["recursionStatus"];
  readonly blockReasons: readonly TaskReadBlockReason[];
  readonly evidence: readonly TaskReadEvidence[];
}

export interface MultiHopWriteEdge {
  readonly producerTaskId: string;
  readonly table: ProducerTableIdentity;
  readonly writes: readonly ProducerWriteObservation[];
  readonly producerIndexContentHash: string;
}

export interface MultiHopProducerBridge {
  readonly consumerTaskId: string;
  readonly table: ProducerTableIdentity;
  readonly producerTaskId: string;
  readonly producerDepth: number;
}

export interface MultiHopTerminal {
  readonly taskId: string;
  readonly depth: number;
  readonly reason: MultiHopTerminalReason;
  readonly table?: TaskReadTableRef | ProducerTableIdentity;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface MultiHopReconciliationResult {
  readonly schemaVersion: "1.0.0";
  readonly artifactType: "TABLE_MULTI_HOP_RECONCILIATION";
  readonly rootTaskId: string;
  readonly generatedAt: string;
  readonly producerIndex: {
    readonly contentHash: string;
    readonly inputFingerprint: string;
    readonly status: "VALID_SUCCESS" | "VALID_PARTIAL";
  };
  readonly terminalTableConfig: {
    readonly version: string;
    readonly stopRoles: readonly string[];
  };
  readonly taskNodes: readonly MultiHopTaskNode[];
  readonly tableNodes: readonly MultiHopTableNode[];
  readonly readEdges: readonly MultiHopReadEdge[];
  readonly writeEdges: readonly MultiHopWriteEdge[];
  readonly producerBridges: readonly MultiHopProducerBridge[];
  readonly terminals: readonly MultiHopTerminal[];
  readonly scheduleSkeleton: {
    readonly boundary: "ROOT_DEPTH_1_ONLY";
    readonly parents: readonly {
      readonly taskId: string;
      readonly taskName: string | null;
      readonly evidence: readonly unknown[];
    }[];
  };
  readonly coverage: {
    readonly semantics: "OBSERVED_EVIDENCE_ONLY";
    readonly status: "COMPLETE_OBSERVED_EVIDENCE" | "PARTIAL_EVIDENCE";
    readonly producerIndexStatus: "VALID_SUCCESS" | "VALID_PARTIAL";
    readonly taskPacksDiscovered: number;
    readonly taskPacksInvalid: number;
    readonly tablePacksDiscovered: number;
    readonly tablePacksInvalid: number;
    readonly eligibleReadEdges: number;
    readonly blockedReadEdges: number;
    readonly readsWithConfirmedProducer: number;
    readonly readsWithoutConfirmedProducer: number;
  };
  readonly limits: {
    readonly maxDepth: number;
    readonly maxTasks: number;
    readonly maxEdges: number;
    readonly truncated: boolean;
    readonly truncationReason: Extract<
      MultiHopTerminalReason,
      "MAX_DEPTH_REACHED" | "MAX_TASKS_REACHED" | "MAX_EDGES_REACHED"
    > | null;
    readonly remainingFrontierTasks: number;
  };
  readonly counts: {
    readonly taskNodes: number;
    readonly tableNodes: number;
    readonly readEdges: number;
    readonly writeEdges: number;
    readonly producerBridges: number;
    readonly terminals: number;
  };
  readonly countSemantics: "NODE_AND_UNIQUE_EDGE_COUNTS";
  readonly issues: readonly string[];
  readonly boundaries: {
    readonly staticSqlOnly: true;
    readonly openCli: "NOT_USED";
    readonly producerCandidatesAreWrites: false;
    readonly partitionScope: "TASK_TO_TABLE_WRITE";
    readonly schedulerExecution: "NOT_EVALUATED";
    readonly runtimeDelivery: "NOT_EVALUATED";
    readonly businessCorrectness: "NOT_EVALUATED";
  };
  readonly contentHash: string;
}

export interface ReconcileMultiHopOptions {
  readonly dataRoot: string;
  readonly producerIndex: TableProducerIndex;
  readonly maxDepth: number;
  readonly maxTasks: number;
  readonly maxEdges: number;
  readonly now?: () => string;
  readonly rootOneHop?: OneHopReconciliationResult;
  readonly terminalTableConfig?: TerminalTableConfig;
}

interface MultiHopPreparedContext {
  readonly dataRoot: string;
  readonly repository: TaskReadEvidenceRepository;
  readonly inputFingerprint: string;
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  const record = asRecord(value);
  if (!record) throw new Error(`${field.toUpperCase()}_INVALID`);
  return record;
}

function requireArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${field.toUpperCase()}_INVALID`);
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`${field.toUpperCase()}_INVALID`);
  return value;
}

function validateArtifactTable(
  value: unknown,
  field: string,
  requireResolved: boolean,
): ProducerTableIdentity | TaskReadTableRef {
  const table = requireRecord(value, field);
  const qualifiedName = requireString(
    table.qualifiedName,
    `${field}.qualifiedName`,
  );
  const platform = table.platform;
  const dataSource = table.dataSource;
  const identityStatus = table.identityStatus;
  if (requireResolved) {
    const identity = {
      platform: requireString(platform, `${field}.platform`).toLowerCase(),
      dataSource: requireString(
        dataSource,
        `${field}.dataSource`,
      ).toLowerCase(),
      qualifiedName,
    };
    if (identity.dataSource === "default")
      throw new Error(`${field.toUpperCase()}_DEFAULT_IDENTITY_INVALID`);
    return identity;
  }
  if (
    !["RESOLVED", "QUALIFIED_NAME_ONLY", "AMBIGUOUS"].includes(
      String(identityStatus),
    )
  )
    throw new Error(`${field.toUpperCase()}_IDENTITY_STATUS_INVALID`);
  if (
    identityStatus === "RESOLVED" &&
    (typeof platform !== "string" ||
      platform.trim() === "" ||
      typeof dataSource !== "string" ||
      dataSource.trim() === "" ||
      dataSource.trim().toLowerCase() === "default")
  )
    throw new Error(`${field.toUpperCase()}_RESOLVED_IDENTITY_INVALID`);
  return {
    platform: typeof platform === "string" ? platform : null,
    dataSource: typeof dataSource === "string" ? dataSource : null,
    qualifiedName,
    identityStatus: identityStatus as TaskReadTableRef["identityStatus"],
  };
}

function validateArtifactEvidence(
  value: unknown,
  field: string,
  options: {
    readonly allowedSources?: readonly string[];
    readonly requireNonEmpty?: boolean;
  } = {},
): void {
  const items = requireArray(value, field);
  if (options.requireNonEmpty && items.length === 0)
    throw new Error(`${field.toUpperCase()}_EMPTY`);
  for (const [index, item] of items.entries()) {
    const evidence = requireRecord(item, `${field}[${index}]`);
    const source = requireString(evidence.source, `${field}[${index}].source`);
    if (options.allowedSources && !options.allowedSources.includes(source))
      throw new Error(`${field.toUpperCase()}_SOURCE_INVALID`);
    requireString(evidence.provider, `${field}[${index}].provider`);
    requireString(evidence.locator, `${field}[${index}].locator`);
    if (!("observedAt" in evidence))
      throw new Error(`${field.toUpperCase()}_OBSERVED_AT_MISSING`);
    if (evidence.observedAt !== null && typeof evidence.observedAt !== "string")
      throw new Error(`${field.toUpperCase()}_OBSERVED_AT_INVALID`);
  }
}

export function validateMultiHopReconciliation(
  value: unknown,
): asserts value is MultiHopReconciliationResult {
  const artifact = requireRecord(value, "artifact");
  if (
    artifact.schemaVersion !== "1.0.0" ||
    artifact.artifactType !== "TABLE_MULTI_HOP_RECONCILIATION" ||
    artifact.countSemantics !== "NODE_AND_UNIQUE_EDGE_COUNTS"
  )
    throw new Error("MULTI_HOP_CONTRACT_INVALID");
  const rootTaskId = requireString(artifact.rootTaskId, "rootTaskId");
  const producerIndex = requireRecord(artifact.producerIndex, "producerIndex");
  const producerIndexContentHash = requireString(
    producerIndex.contentHash,
    "producerIndex.contentHash",
  );
  requireString(
    producerIndex.inputFingerprint,
    "producerIndex.inputFingerprint",
  );
  if (
    !["VALID_SUCCESS", "VALID_PARTIAL"].includes(String(producerIndex.status))
  )
    throw new Error("PRODUCER_INDEX_STATUS_INVALID");
  const taskNodes = requireArray(artifact.taskNodes, "taskNodes");
  const taskIds = new Set<string>();
  for (const [index, item] of taskNodes.entries()) {
    const node = requireRecord(item, `taskNodes[${index}]`);
    const taskId = requireString(node.taskId, `taskNodes[${index}].taskId`);
    if (taskIds.has(taskId)) throw new Error("TASK_NODE_DUPLICATE");
    taskIds.add(taskId);
    if (!Number.isSafeInteger(node.minDepth) || Number(node.minDepth) < 0)
      throw new Error("TASK_NODE_DEPTH_INVALID");
    if (
      !["EXPANDED", "TERMINAL", "TRUNCATED"].includes(
        String(node.expansionStatus),
      )
    )
      throw new Error("TASK_NODE_STATUS_INVALID");
    validateArtifactEvidence(node.evidence, `taskNodes[${index}].evidence`);
  }
  if (!taskIds.has(rootTaskId)) throw new Error("ROOT_TASK_NODE_MISSING");
  const tableNodes = requireArray(artifact.tableNodes, "tableNodes");
  const tableKeys = new Set<string>();
  for (const [index, item] of tableNodes.entries()) {
    const table = validateArtifactTable(item, `tableNodes[${index}]`, false);
    const key = tableKey(table);
    if (tableKeys.has(key)) throw new Error("TABLE_NODE_DUPLICATE");
    tableKeys.add(key);
  }
  const readEdges = requireArray(artifact.readEdges, "readEdges");
  const readKeys = new Set<string>();
  for (const [index, item] of readEdges.entries()) {
    const edge = requireRecord(item, `readEdges[${index}]`);
    const consumer = requireString(
      edge.consumerTaskId,
      `readEdges[${index}].consumerTaskId`,
    );
    if (!taskIds.has(consumer)) throw new Error("READ_EDGE_TASK_MISSING");
    const table = validateArtifactTable(
      edge.table,
      `readEdges[${index}].table`,
      false,
    ) as TaskReadTableRef;
    const key = readKey(consumer, table);
    if (readKeys.has(key)) throw new Error("READ_EDGE_DUPLICATE");
    if (!tableKeys.has(tableKey(table)))
      throw new Error("READ_EDGE_TABLE_MISSING");
    readKeys.add(key);
    requireArray(edge.statementIndexes, `readEdges[${index}].statementIndexes`);
    requireArray(
      edge.eligibleStatementIndexes,
      `readEdges[${index}].eligibleStatementIndexes`,
    );
    requireArray(
      edge.blockedStatementIndexes,
      `readEdges[${index}].blockedStatementIndexes`,
    );
    if (!["ELIGIBLE", "BLOCKED"].includes(String(edge.recursionStatus)))
      throw new Error("READ_EDGE_STATUS_INVALID");
    requireArray(edge.blockReasons, `readEdges[${index}].blockReasons`);
    validateArtifactEvidence(edge.evidence, `readEdges[${index}].evidence`, {
      allowedSources: [
        "INPUT_PACK_TASK",
        "INPUT_PACK_SQL",
        "TABLE_PACK",
        "SQL_PARSE",
      ],
      requireNonEmpty: true,
    });
  }
  const writeEdges = requireArray(artifact.writeEdges, "writeEdges");
  const writeKeys = new Set<string>();
  for (const [index, item] of writeEdges.entries()) {
    const edge = requireRecord(item, `writeEdges[${index}]`);
    const producer = requireString(
      edge.producerTaskId,
      `writeEdges[${index}].producerTaskId`,
    );
    if (!taskIds.has(producer)) throw new Error("WRITE_EDGE_TASK_MISSING");
    const table = validateArtifactTable(
      edge.table,
      `writeEdges[${index}].table`,
      true,
    ) as ProducerTableIdentity;
    const key = writeKey(producer, table);
    if (writeKeys.has(key)) throw new Error("WRITE_EDGE_DUPLICATE");
    if (!tableKeys.has(tableKey(table)))
      throw new Error("WRITE_EDGE_TABLE_MISSING");
    writeKeys.add(key);
    const writes = requireArray(edge.writes, `writeEdges[${index}].writes`);
    if (writes.length === 0) throw new Error("WRITE_OBSERVATIONS_MISSING");
    for (const [writeIndex, writeValue] of writes.entries()) {
      const write = requireRecord(
        writeValue,
        `writeEdges[${index}].writes[${writeIndex}]`,
      );
      const observationKind = requireString(
        write.observationKind,
        `writeEdges[${index}].writes[${writeIndex}].observationKind`,
      );
      if (!["DIRECT_TARGET", "SQL_EXPLICIT_WRITE"].includes(observationKind))
        throw new Error("WRITE_OBSERVATION_KIND_INVALID");
      if (
        write.declaredWriteMode !== null &&
        typeof write.declaredWriteMode !== "string"
      )
        throw new Error("WRITE_DECLARED_MODE_INVALID");
      if (
        ![
          "INSERT_OVERWRITE",
          "INSERT_INTO",
          "MERGE_INTO",
          "CTAS",
          null,
        ].includes(write.sqlWriteKind as string | null)
      )
        throw new Error("SQL_WRITE_KIND_INVALID");
      if (
        write.writeDirection !== undefined &&
        write.writeDirection !== "WRITE_CONFIRMED"
      )
        throw new Error("WRITE_DIRECTION_INVALID");
      if (
        write.targetEvidenceKind !== undefined &&
        !["DIRECT_PLATFORM_TARGET", "SQL_EXACT_TABLE_TARGET"].includes(
          String(write.targetEvidenceKind),
        )
      )
        throw new Error("TARGET_EVIDENCE_KIND_INVALID");
      if (
        observationKind === "SQL_EXPLICIT_WRITE" &&
        write.targetEvidenceKind !== undefined
      )
        throw new Error("WRITE_TARGET_EVIDENCE_MIXED");
      if (
        write.operationClass !== undefined &&
        ![
          "INSERT_OVERWRITE",
          "INSERT_INTO",
          "MERGE_INTO",
          "CTAS",
          "PLATFORM_TRANSFER",
          "DELETE",
          "TRUNCATE",
          "UNKNOWN",
        ].includes(String(write.operationClass))
      )
        throw new Error("OPERATION_CLASS_INVALID");
      if (
        write.dataPathRole !== undefined &&
        !["PRODUCER", "MUTATION_ONLY", "UNKNOWN"].includes(
          String(write.dataPathRole),
        )
      )
        throw new Error("DATA_PATH_ROLE_INVALID");
      if (
        write.operationClass !== undefined &&
        write.dataPathRole !== undefined &&
        (["DELETE", "TRUNCATE"] as readonly string[]).includes(
          String(write.operationClass),
        ) !==
          (write.dataPathRole === "MUTATION_ONLY")
      )
        throw new Error("WRITE_SEMANTICS_MISMATCH");
      for (const [partitionIndex, partitionValue] of requireArray(
        write.partition,
        `writeEdges[${index}].writes[${writeIndex}].partition`,
      ).entries()) {
        const partition = requireRecord(
          partitionValue,
          `writeEdges[${index}].writes[${writeIndex}].partition[${partitionIndex}]`,
        );
        requireString(partition.field, "partition.field");
        requireString(partition.expression, "partition.expression");
        if (
          ![
            "OBSERVED_RENDERED_VALUE",
            "RUNTIME_EXPRESSION",
            "UNKNOWN",
          ].includes(String(partition.valueStatus)) ||
          !(
            partition.observedValue === null ||
            typeof partition.observedValue === "string"
          )
        )
          throw new Error("WRITE_PARTITION_INVALID");
      }
      validateArtifactEvidence(
        write.evidence,
        `writeEdges[${index}].writes[${writeIndex}].evidence`,
        {
          allowedSources: [
            "INPUT_PACK_TASK",
            "INPUT_PACK_SQL",
            "TABLE_PACK",
            "SQL_PARSE",
          ],
          requireNonEmpty: true,
        },
      );
    }
    const edgeIndexContentHash = requireString(
      edge.producerIndexContentHash,
      `writeEdges[${index}].producerIndexContentHash`,
    );
    if (edgeIndexContentHash !== producerIndexContentHash)
      throw new Error("WRITE_EDGE_PRODUCER_INDEX_MISMATCH");
  }
  const bridges = requireArray(artifact.producerBridges, "producerBridges");
  const bridgeKeys = new Set<string>();
  for (const [index, item] of bridges.entries()) {
    const bridge = requireRecord(item, `producerBridges[${index}]`);
    const consumer = requireString(
      bridge.consumerTaskId,
      `producerBridges[${index}].consumerTaskId`,
    );
    const producer = requireString(
      bridge.producerTaskId,
      `producerBridges[${index}].producerTaskId`,
    );
    if (!taskIds.has(consumer) || !taskIds.has(producer))
      throw new Error("PRODUCER_BRIDGE_TASK_MISSING");
    const table = validateArtifactTable(
      bridge.table,
      `producerBridges[${index}].table`,
      true,
    ) as ProducerTableIdentity;
    const key = bridgeKey(consumer, table, producer);
    if (bridgeKeys.has(key)) throw new Error("PRODUCER_BRIDGE_DUPLICATE");
    if (!tableKeys.has(tableKey(table)))
      throw new Error("PRODUCER_BRIDGE_TABLE_MISSING");
    if (
      !readKeys.has(
        readKey(consumer, { ...table, identityStatus: "RESOLVED" }),
      ) ||
      !writeKeys.has(writeKey(producer, table))
    )
      throw new Error("PRODUCER_BRIDGE_EDGE_MISSING");
    bridgeKeys.add(key);
  }
  const terminals = requireArray(artifact.terminals, "terminals");
  const counts = requireRecord(artifact.counts, "counts");
  const expectedCounts = {
    taskNodes: taskNodes.length,
    tableNodes: tableNodes.length,
    readEdges: readEdges.length,
    writeEdges: writeEdges.length,
    producerBridges: bridges.length,
    terminals: terminals.length,
  };
  for (const [field, expected] of Object.entries(expectedCounts))
    if (counts[field] !== expected) throw new Error("MULTI_HOP_COUNTS_INVALID");
  const coverage = requireRecord(artifact.coverage, "coverage");
  if (
    coverage.semantics !== "OBSERVED_EVIDENCE_ONLY" ||
    !["COMPLETE_OBSERVED_EVIDENCE", "PARTIAL_EVIDENCE"].includes(
      String(coverage.status),
    )
  )
    throw new Error("MULTI_HOP_COVERAGE_INVALID");
  const schedule = requireRecord(artifact.scheduleSkeleton, "scheduleSkeleton");
  if (schedule.boundary !== "ROOT_DEPTH_1_ONLY")
    throw new Error("SCHEDULE_BOUNDARY_INVALID");
  for (const [index, item] of requireArray(
    schedule.parents,
    "schedule.parents",
  ).entries()) {
    const parent = requireRecord(item, `schedule.parents[${index}]`);
    requireString(parent.taskId, `schedule.parents[${index}].taskId`);
    validateArtifactEvidence(
      parent.evidence,
      `schedule.parents[${index}].evidence`,
      { allowedSources: ["HORAE_RELATION"], requireNonEmpty: true },
    );
  }
  requireString(artifact.contentHash, "contentHash");
  const expectedHash = canonicalHash(artifact as unknown as JsonValue, [
    "generatedAt",
    "contentHash",
  ]);
  if (artifact.contentHash !== expectedHash)
    throw new Error("MULTI_HOP_CONTENT_HASH_INVALID");
}

interface MutableTaskNode {
  taskId: string;
  minDepth: number;
  expansionStatus: ExpansionStatus;
  taskInputPackStatus: TaskInputPackStatus | null;
  taskContentHash: string | null;
  evidence: readonly TaskReadEvidence[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validateRootOneHopSnapshot(
  value: unknown,
  rootTaskId: string,
  producerIndex: TableProducerIndex,
): asserts value is OneHopReconciliationResult {
  const snapshot = asRecord(value);
  const schedule = asRecord(snapshot?.schedule);
  const index = asRecord(snapshot?.producerIndex);
  if (
    snapshot?.taskId !== rootTaskId ||
    schedule?.direction !== "UPSTREAM" ||
    schedule.depth !== 1 ||
    !Array.isArray(schedule.parents) ||
    index?.contentHash !== producerIndex.contentHash ||
    index.inputFingerprint !== producerIndex.inputFingerprint
  )
    throw new Error("ROOT_ONE_HOP_INVALID");
  for (const parent of schedule.parents) {
    const record = asRecord(parent);
    if (
      typeof record?.taskId !== "string" ||
      record.taskId.trim() === "" ||
      !(record.taskName === null || typeof record.taskName === "string") ||
      !Array.isArray(record.evidence) ||
      record.evidence.length === 0
    )
      throw new Error("ROOT_ONE_HOP_INVALID");
    for (const evidence of record.evidence) {
      const observation = asRecord(evidence);
      if (
        observation?.source !== "HORAE_RELATION" ||
        typeof observation.provider !== "string" ||
        observation.provider.trim() === "" ||
        typeof observation.locator !== "string" ||
        observation.locator.trim() === "" ||
        !("observedAt" in observation) ||
        !(
          observation.observedAt === null ||
          typeof observation.observedAt === "string"
        )
      )
        throw new Error("ROOT_ONE_HOP_INVALID");
    }
  }
}

function tableKey(table: {
  readonly platform: string | null;
  readonly dataSource: string | null;
  readonly qualifiedName: string;
}): string {
  return [table.platform ?? "", table.dataSource ?? "", table.qualifiedName]
    .map((value) => value.trim().toLowerCase())
    .join("\u0000");
}

function readKey(taskId: string, table: TaskReadTableRef): string {
  return `${taskId}\u0000${tableKey(table)}`;
}

function writeKey(taskId: string, table: ProducerTableIdentity): string {
  return `${taskId}\u0000${tableKey(table)}`;
}

function bridgeKey(
  consumerTaskId: string,
  table: ProducerTableIdentity,
  producerTaskId: string,
): string {
  return `${consumerTaskId}\u0000${tableKey(table)}\u0000${producerTaskId}`;
}

function requireLimit(value: number, name: string, minimum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new Error(`${name.toUpperCase()}_INVALID`);
}

/**
 * Build the expensive, immutable evidence context once for a batch of roots.
 * The producer index fingerprint is still checked against the same snapshot,
 * but Task/Table Pack discovery and parsing are shared by every root.
 */
function prepareMultiHopContext(
  dataRootInput: string,
): MultiHopPreparedContext {
  const repository = buildTaskReadEvidenceRepository(dataRootInput);
  const inputFingerprint = fingerprintTableProducerInputs(dataRootInput);
  return {
    dataRoot: repository.dataRoot,
    repository,
    inputFingerprint,
  };
}

function hasTaskPath(
  fromTaskId: string,
  toTaskId: string,
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
): boolean {
  if (fromTaskId === toTaskId) return true;
  const seen = new Set<string>();
  const pending = [fromTaskId];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current === toTaskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of adjacency.get(current) ?? []) pending.push(next);
  }
  return false;
}

function sortTerminals(
  left: MultiHopTerminal,
  right: MultiHopTerminal,
): number {
  return (
    left.depth - right.depth ||
    compareText(left.taskId, right.taskId) ||
    compareText(
      left.table?.qualifiedName ?? "",
      right.table?.qualifiedName ?? "",
    ) ||
    compareText(left.reason, right.reason)
  );
}

function reconcileMultiHopInternal(
  rootTaskId: string,
  options: ReconcileMultiHopOptions,
  preparedContext: MultiHopPreparedContext,
): MultiHopReconciliationResult {
  if (rootTaskId.trim() === "") throw new Error("TASK_ID_REQUIRED");
  requireLimit(options.maxDepth, "max_depth", 0);
  requireLimit(options.maxTasks, "max_tasks", 1);
  requireLimit(options.maxEdges, "max_edges", 1);
  validateTableProducerIndex(options.producerIndex);
  const terminalTableConfig = options.terminalTableConfig;
  const repository = preparedContext.repository;
  if (
    preparedContext.inputFingerprint !== options.producerIndex.inputFingerprint
  )
    throw new Error("PRODUCER_INDEX_STALE");
  if (options.rootOneHop)
    validateRootOneHopSnapshot(
      options.rootOneHop,
      rootTaskId,
      options.producerIndex,
    );
  const now = options.now ?? (() => new Date().toISOString());
  const taskNodes = new Map<string, MutableTaskNode>();
  const tableNodes = new Map<string, MultiHopTableNode>();
  const readEdges = new Map<string, MultiHopReadEdge>();
  const writeEdges = new Map<string, MultiHopWriteEdge>();
  const bridges = new Map<string, MultiHopProducerBridge>();
  const terminals: MultiHopTerminal[] = [];
  const terminalKeys = new Set<string>();
  const adjacency = new Map<string, Set<string>>();
  const frontier: { taskId: string; depth: number }[] = [
    { taskId: rootTaskId, depth: 0 },
  ];
  let traversalStopped = false;
  let truncationReason: MultiHopReconciliationResult["limits"]["truncationReason"] =
    null;
  let readsWithConfirmedProducer = 0;
  let readsWithoutConfirmedProducer = 0;

  const addTerminal = (terminal: MultiHopTerminal): void => {
    const key = [
      terminal.taskId,
      String(terminal.depth),
      terminal.reason,
      terminal.table ? tableKey(terminal.table) : "",
    ].join("\u0000");
    if (!terminalKeys.has(key)) {
      terminalKeys.add(key);
      terminals.push(terminal);
    }
  };

  const markTruncated = (
    reason: NonNullable<
      MultiHopReconciliationResult["limits"]["truncationReason"]
    >,
    terminal: MultiHopTerminal,
    stopTraversal: boolean,
  ): void => {
    truncationReason ??= reason;
    addTerminal(terminal);
    if (stopTraversal) traversalStopped = true;
  };

  const canAddGraphEdge = (terminal: MultiHopTerminal): boolean => {
    if (readEdges.size + writeEdges.size < options.maxEdges) return true;
    markTruncated(
      "MAX_EDGES_REACHED",
      {
        ...terminal,
        reason: "MAX_EDGES_REACHED",
      },
      true,
    );
    return false;
  };

  taskNodes.set(rootTaskId, {
    taskId: rootTaskId,
    minDepth: 0,
    expansionStatus: "TERMINAL",
    taskInputPackStatus: null,
    taskContentHash: null,
    evidence: [],
  });

  while (frontier.length > 0 && !traversalStopped) {
    frontier.sort(
      (left, right) =>
        left.depth - right.depth || compareText(left.taskId, right.taskId),
    );
    const current = frontier.shift()!;
    const node = taskNodes.get(current.taskId)!;
    if (current.depth >= options.maxDepth) {
      node.expansionStatus = "TERMINAL";
      markTruncated(
        "MAX_DEPTH_REACHED",
        {
          taskId: current.taskId,
          depth: current.depth,
          reason: "MAX_DEPTH_REACHED",
        },
        false,
      );
      continue;
    }

    const taskReads = repository.getTaskReads(current.taskId);
    node.taskInputPackStatus = taskReads.status;
    node.taskContentHash = taskReads.taskContentHash;
    node.evidence = taskReads.evidence;
    if (taskReads.status !== "TASK_INPUT_PACK_AVAILABLE") {
      node.expansionStatus = "TERMINAL";
      addTerminal({
        taskId: current.taskId,
        depth: current.depth,
        reason: taskReads.status,
        detail: { issues: taskReads.issues },
      });
      continue;
    }
    for (const statementIssue of taskReads.statementIssues)
      addTerminal({
        taskId: current.taskId,
        depth: current.depth,
        reason: statementIssue.code,
        detail: {
          slot: statementIssue.slot,
          statementIndex: statementIssue.statementIndex,
          locator: statementIssue.locator,
          ...statementIssue.detail,
        },
      });
    if (taskReads.directReads.length === 0) {
      node.expansionStatus = "TERMINAL";
      if (taskReads.statementIssues.length === 0)
        addTerminal({
          taskId: current.taskId,
          depth: current.depth,
          reason: "NO_DIRECT_READS",
        });
      continue;
    }
    node.expansionStatus = "EXPANDED";

    for (const read of taskReads.directReads) {
      if (traversalStopped) break;
      if (
        !canAddGraphEdge({
          taskId: current.taskId,
          depth: current.depth,
          reason: "MAX_EDGES_REACHED",
          table: read.tableRef,
        })
      ) {
        node.expansionStatus = "TRUNCATED";
        break;
      }
      const currentReadKey = readKey(current.taskId, read.tableRef);
      if (!readEdges.has(currentReadKey)) {
        readEdges.set(currentReadKey, {
          consumerTaskId: current.taskId,
          table: read.tableRef,
          statementIndexes: read.statementIndexes,
          eligibleStatementIndexes: read.eligibleStatementIndexes,
          blockedStatementIndexes: read.blockedStatementIndexes,
          recursionStatus: read.recursionStatus,
          blockReasons: read.blockReasons,
          evidence: read.evidence,
        });
      }
      tableNodes.set(tableKey(read.tableRef), { ...read.tableRef });
      if (read.recursionStatus === "BLOCKED") {
        readsWithoutConfirmedProducer += 1;
        addTerminal({
          taskId: current.taskId,
          depth: current.depth,
          reason: read.blockReason ?? "TABLE_IDENTITY_UNRESOLVED",
          table: read.tableRef,
          detail: { blockReasons: read.blockReasons },
        });
        continue;
      }
      if (
        read.tableRef.identityStatus !== "RESOLVED" ||
        read.tableRef.platform === null ||
        read.tableRef.dataSource === null ||
        read.tableRef.dataSource === "default"
      ) {
        readsWithoutConfirmedProducer += 1;
        addTerminal({
          taskId: current.taskId,
          depth: current.depth,
          reason: "TABLE_IDENTITY_UNRESOLVED",
          table: read.tableRef,
        });
        continue;
      }
      const terminalRole = terminalTableConfig
        ? matchingTerminalRole(terminalTableConfig, read.tableRef.qualifiedName)
        : null;
      if (terminalRole) {
        readsWithoutConfirmedProducer += 1;
        addTerminal({
          taskId: current.taskId,
          depth: current.depth,
          reason: "REFERENCE_CONFIG",
          table: read.tableRef,
          detail: {
            role: terminalRole,
            configVersion: terminalTableConfig?.version,
          },
        });
        continue;
      }
      const identity: ProducerTableIdentity = {
        platform: read.tableRef.platform,
        dataSource: read.tableRef.dataSource,
        qualifiedName: read.tableRef.qualifiedName,
      };
      const producers = [
        ...lookupConfirmedProducers(options.producerIndex, identity),
      ].sort((left, right) => compareText(left.taskId, right.taskId));
      if (producers.length === 0) {
        readsWithoutConfirmedProducer += 1;
        addTerminal({
          taskId: current.taskId,
          depth: current.depth,
          reason: "NO_CONFIRMED_PRODUCER_OBSERVED",
          table: identity,
        });
        continue;
      }
      readsWithConfirmedProducer += 1;
      for (const producer of producers) {
        if (traversalStopped) break;
        const currentWriteKey = writeKey(producer.taskId, identity);
        const writeEdgeExists = writeEdges.has(currentWriteKey);
        const producerNodeExists = taskNodes.has(producer.taskId);
        if (!producerNodeExists && taskNodes.size >= options.maxTasks) {
          node.expansionStatus = "TRUNCATED";
          markTruncated(
            "MAX_TASKS_REACHED",
            {
              taskId: producer.taskId,
              depth: current.depth + 1,
              reason: "MAX_TASKS_REACHED",
              table: identity,
              detail: { consumerTaskId: current.taskId },
            },
            true,
          );
          break;
        }
        if (!writeEdgeExists) {
          if (
            !canAddGraphEdge({
              taskId: producer.taskId,
              depth: current.depth + 1,
              reason: "MAX_EDGES_REACHED",
              table: identity,
            })
          ) {
            node.expansionStatus = "TRUNCATED";
            break;
          }
          writeEdges.set(currentWriteKey, {
            producerTaskId: producer.taskId,
            table: identity,
            writes: producer.writes,
            producerIndexContentHash: options.producerIndex.contentHash,
          });
        }
        const currentBridgeKey = bridgeKey(
          current.taskId,
          identity,
          producer.taskId,
        );
        if (!bridges.has(currentBridgeKey))
          bridges.set(currentBridgeKey, {
            consumerTaskId: current.taskId,
            table: identity,
            producerTaskId: producer.taskId,
            producerDepth: current.depth + 1,
          });
        const nextTasks = adjacency.get(current.taskId) ?? new Set<string>();
        const createsCycle = hasTaskPath(
          producer.taskId,
          current.taskId,
          adjacency,
        );
        nextTasks.add(producer.taskId);
        adjacency.set(current.taskId, nextTasks);
        if (createsCycle) {
          addTerminal({
            taskId: producer.taskId,
            depth: current.depth + 1,
            reason: "CYCLE",
            table: identity,
            detail: { consumerTaskId: current.taskId },
          });
          continue;
        }
        if (producerNodeExists) {
          addTerminal({
            taskId: producer.taskId,
            depth: current.depth + 1,
            reason: "ALREADY_DISCOVERED",
            table: identity,
            detail: { consumerTaskId: current.taskId },
          });
          continue;
        }
        taskNodes.set(producer.taskId, {
          taskId: producer.taskId,
          minDepth: current.depth + 1,
          expansionStatus: "TERMINAL",
          taskInputPackStatus: null,
          taskContentHash: producer.taskContentHash,
          evidence: [],
        });
        frontier.push({ taskId: producer.taskId, depth: current.depth + 1 });
      }
    }
  }

  if (traversalStopped) {
    for (const pending of frontier) {
      const node = taskNodes.get(pending.taskId);
      if (node && node.expansionStatus !== "EXPANDED")
        node.expansionStatus = "TRUNCATED";
    }
  }

  const orderedTaskNodes = [...taskNodes.values()].sort(
    (left, right) =>
      left.minDepth - right.minDepth || compareText(left.taskId, right.taskId),
  );
  const orderedTableNodes = [...tableNodes.values()].sort((left, right) =>
    compareText(tableKey(left), tableKey(right)),
  );
  const orderedReadEdges = [...readEdges.values()].sort((left, right) =>
    compareText(
      readKey(left.consumerTaskId, left.table),
      readKey(right.consumerTaskId, right.table),
    ),
  );
  const orderedWriteEdges = [...writeEdges.values()].sort((left, right) =>
    compareText(
      writeKey(left.producerTaskId, left.table),
      writeKey(right.producerTaskId, right.table),
    ),
  );
  const orderedBridges = [...bridges.values()].sort((left, right) =>
    compareText(
      bridgeKey(left.consumerTaskId, left.table, left.producerTaskId),
      bridgeKey(right.consumerTaskId, right.table, right.producerTaskId),
    ),
  );
  const orderedTerminals = [...terminals].sort(sortTerminals);
  const producerIndexStatus =
    options.producerIndex.buildStatus === "PARTIAL"
      ? ("VALID_PARTIAL" as const)
      : ("VALID_SUCCESS" as const);
  const scheduleParents = (options.rootOneHop?.schedule.parents ?? [])
    .map((parent) => ({
      taskId: parent.taskId,
      taskName: parent.taskName,
      evidence: parent.evidence,
    }))
    .sort((left, right) => compareText(left.taskId, right.taskId));
  const withoutHash = {
    schemaVersion: "1.0.0" as const,
    artifactType: "TABLE_MULTI_HOP_RECONCILIATION" as const,
    rootTaskId,
    generatedAt: now(),
    producerIndex: {
      contentHash: options.producerIndex.contentHash,
      inputFingerprint: options.producerIndex.inputFingerprint,
      status: producerIndexStatus,
    },
    terminalTableConfig: {
      version: terminalTableConfig?.version ?? "disabled",
      stopRoles: terminalTableConfig?.stopRoles ?? [],
    },
    taskNodes: orderedTaskNodes,
    tableNodes: orderedTableNodes,
    readEdges: orderedReadEdges,
    writeEdges: orderedWriteEdges,
    producerBridges: orderedBridges,
    terminals: orderedTerminals,
    scheduleSkeleton: {
      boundary: "ROOT_DEPTH_1_ONLY" as const,
      parents: scheduleParents,
    },
    coverage: {
      semantics: "OBSERVED_EVIDENCE_ONLY" as const,
      status:
        producerIndexStatus === "VALID_PARTIAL" ||
        repository.counts.invalidTaskPacks > 0 ||
        repository.counts.invalidTablePacks > 0 ||
        truncationReason !== null
          ? ("PARTIAL_EVIDENCE" as const)
          : ("COMPLETE_OBSERVED_EVIDENCE" as const),
      producerIndexStatus,
      taskPacksDiscovered: repository.counts.taskPacksDiscovered,
      taskPacksInvalid: repository.counts.invalidTaskPacks,
      tablePacksDiscovered: repository.counts.tablePacksDiscovered,
      tablePacksInvalid: repository.counts.invalidTablePacks,
      eligibleReadEdges: orderedReadEdges.filter(
        (edge) => edge.recursionStatus === "ELIGIBLE",
      ).length,
      blockedReadEdges: orderedReadEdges.filter(
        (edge) => edge.recursionStatus === "BLOCKED",
      ).length,
      readsWithConfirmedProducer,
      readsWithoutConfirmedProducer,
    },
    limits: {
      maxDepth: options.maxDepth,
      maxTasks: options.maxTasks,
      maxEdges: options.maxEdges,
      truncated: truncationReason !== null,
      truncationReason,
      remainingFrontierTasks: frontier.length,
    },
    counts: {
      taskNodes: orderedTaskNodes.length,
      tableNodes: orderedTableNodes.length,
      readEdges: orderedReadEdges.length,
      writeEdges: orderedWriteEdges.length,
      producerBridges: orderedBridges.length,
      terminals: orderedTerminals.length,
    },
    countSemantics: "NODE_AND_UNIQUE_EDGE_COUNTS" as const,
    issues: repository.issues,
    boundaries: {
      staticSqlOnly: true as const,
      openCli: "NOT_USED" as const,
      producerCandidatesAreWrites: false as const,
      partitionScope: "TASK_TO_TABLE_WRITE" as const,
      schedulerExecution: "NOT_EVALUATED" as const,
      runtimeDelivery: "NOT_EVALUATED" as const,
      businessCorrectness: "NOT_EVALUATED" as const,
    },
  };
  const result = {
    ...withoutHash,
    contentHash: canonicalHash(withoutHash as unknown as JsonValue, [
      "generatedAt",
      "contentHash",
    ]),
  };
  validateMultiHopReconciliation(result);
  return result;
}

export function reconcileMultiHop(
  rootTaskId: string,
  options: ReconcileMultiHopOptions,
): MultiHopReconciliationResult {
  return reconcileMultiHopInternal(
    rootTaskId,
    options,
    prepareMultiHopContext(options.dataRoot),
  );
}

export interface MultiHopBatchRoot {
  readonly taskId: string;
  readonly rootOneHop?: OneHopReconciliationResult;
}

export function reconcileMultiHopBatch(
  roots: readonly MultiHopBatchRoot[],
  options: Omit<ReconcileMultiHopOptions, "rootOneHop">,
): readonly MultiHopReconciliationResult[] {
  const preparedContext = prepareMultiHopContext(options.dataRoot);
  const results = roots.map((root) =>
    reconcileMultiHopInternal(
      root.taskId,
      {
        ...options,
        ...(root.rootOneHop ? { rootOneHop: root.rootOneHop } : {}),
      },
      preparedContext,
    ),
  );
  if (
    fingerprintTableProducerInputs(options.dataRoot) !==
    preparedContext.inputFingerprint
  )
    throw new Error("INPUT_CHANGED_DURING_MULTI_HOP_BATCH");
  return results;
}

interface CliOptions {
  taskId: string;
  dataRoot: string;
  producerIndexPath: string;
  rootOneHopPath: string | null;
  outputPath: string | null;
  maxDepth: number;
  maxTasks: number;
  maxEdges: number;
  terminalTableConfigPath: string;
}

function parseCli(argv: readonly string[]): CliOptions {
  const values = new Map<string, string>();
  const allowed = new Set([
    "--task-id",
    "--data-root",
    "--producer-index",
    "--root-one-hop",
    "--output",
    "--max-depth",
    "--max-tasks",
    "--max-edges",
    "--terminal-table-config",
  ]);
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      !flag?.startsWith("--") ||
      value === undefined ||
      value.startsWith("--")
    )
      throw new Error(`INVALID_ARGUMENT:${flag ?? "MISSING"}`);
    if (!allowed.has(flag)) throw new Error(`UNKNOWN_ARGUMENT:${flag}`);
    if (values.has(flag)) throw new Error(`DUPLICATE_ARGUMENT:${flag}`);
    values.set(flag, value);
  }
  const required = (flag: string): string => {
    const value = values.get(flag);
    if (!value)
      throw new Error(
        `${flag.slice(2).toUpperCase().replaceAll("-", "_")}_REQUIRED`,
      );
    return value;
  };
  const integer = (flag: string, fallback: number): number => {
    const raw = values.get(flag);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value))
      throw new Error(`${flag.slice(2).toUpperCase()}_INVALID`);
    return value;
  };
  return {
    taskId: required("--task-id"),
    dataRoot: required("--data-root"),
    producerIndexPath: required("--producer-index"),
    rootOneHopPath: values.get("--root-one-hop") ?? null,
    outputPath: values.get("--output") ?? null,
    maxDepth: integer("--max-depth", 3),
    maxTasks: integer("--max-tasks", 100),
    maxEdges: integer("--max-edges", 500),
    terminalTableConfigPath:
      values.get("--terminal-table-config") ??
      "config/multi-hop-terminal-table-rules.json",
  };
}

function main(): void {
  const cli = parseCli(process.argv.slice(2));
  const producerIndex = loadTableProducerIndex(cli.producerIndexPath);
  const terminalTableConfig = loadTerminalTableConfig(
    resolve(cli.terminalTableConfigPath),
  );
  const rootOneHop = cli.rootOneHopPath
    ? (JSON.parse(readFileSync(resolve(cli.rootOneHopPath), "utf8")) as unknown)
    : undefined;
  const result = reconcileMultiHop(cli.taskId, {
    dataRoot: cli.dataRoot,
    producerIndex,
    maxDepth: cli.maxDepth,
    maxTasks: cli.maxTasks,
    maxEdges: cli.maxEdges,
    terminalTableConfig,
    ...(rootOneHop
      ? { rootOneHop: rootOneHop as OneHopReconciliationResult }
      : {}),
  });
  const rendered = `${JSON.stringify(result, null, 2)}\n`;
  if (cli.outputPath) {
    const output = resolve(cli.outputPath);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, rendered, "utf8");
  } else process.stdout.write(rendered);
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) main();
