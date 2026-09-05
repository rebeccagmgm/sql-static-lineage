import {
  canonicalHash,
  type JsonValue,
} from "../../../src/contracts/runtime.ts";
import type {
  OneHopReconciliationResult,
  MultiHopReconciliationResult,
} from "../../../src/contracts/canonical-artifacts.ts";

const FIXED_NOW = "2026-08-29T00:00:00.000Z";
export const FIXTURE_PRODUCER_INDEX_HASH = "a".repeat(64);
export const FIXTURE_INPUT_FINGERPRINT = "b".repeat(64);

const taskEvidence = (taskId: string) => ({
  source: "INPUT_PACK_TASK",
  provider: "fixture",
  locator: `task-pack:${taskId}`,
  observedAt: FIXED_NOW,
});

const sqlEvidence = (taskId: string, statementIndex = 0) => ({
  source: "SQL_PARSE",
  provider: "fixture",
  locator: `task-pack:${taskId}/statement:${statementIndex}`,
  observedAt: FIXED_NOW,
});

const scheduleEvidence = (consumerTaskId: string, producerTaskId: string) => ({
  source: "HORAE_RELATION",
  provider: "fixture",
  locator: `schedule:${consumerTaskId}->${producerTaskId}`,
  observedAt: FIXED_NOW,
});

export interface ProjectTopologyFixtureOptions {
  readonly rootTaskId?: string;
  readonly sharedProducerTaskId?: string;
  readonly producerDepth?: number;
  readonly partial?: boolean;
  readonly generatedAt?: string;
}

export interface ProjectTopologyFixturePair {
  readonly oneHop: OneHopReconciliationResult;
  readonly multiHop: MultiHopReconciliationResult;
}

export function projectTopologyFixturePair(
  options: ProjectTopologyFixtureOptions = {},
): ProjectTopologyFixturePair {
  const rootTaskId = options.rootTaskId ?? "root-1";
  const producerTaskId = options.sharedProducerTaskId ?? "shared-producer";
  const producerDepth = options.producerDepth ?? 1;
  const partial = options.partial ?? false;
  const generatedAt = options.generatedAt ?? FIXED_NOW;
  const unknownProducerTaskId = `${rootTaskId}-unknown-producer`;
  const scheduleOnlyTaskId = `${rootTaskId}-schedule-only`;
  const primaryTable = {
    platform: "hive",
    dataSource: "warehouse-a",
    qualifiedName: "dm.shared_source",
  } as const;
  const sameNameOtherSourceTable = {
    platform: "hive",
    dataSource: "warehouse-b",
    qualifiedName: "dm.shared_source",
  } as const;

  const oneHop = {
    schemaVersion: "1.1.0",
    taskId: rootTaskId,
    generatedAt,
    currentTask: {
      inputPackPath: `task-pack:${rootTaskId}`,
      inputPackContentHash: "c".repeat(64),
      directReads: [],
    },
    schedule: {
      direction: "UPSTREAM",
      depth: 1,
      parents: [],
      evidence: [],
    },
    parents: [],
    reconciliation: [],
    counts: {},
    countSemantics: {},
    producerIndex: {
      contentHash: FIXTURE_PRODUCER_INDEX_HASH,
      inputFingerprint: FIXTURE_INPUT_FINGERPRINT,
      status: partial ? "VALID_PARTIAL" : "VALID_SUCCESS",
    },
    dataPath: {},
    coverage: {},
    nextScheduleTaskIds: [scheduleOnlyTaskId],
    nextDataTaskIds: [producerTaskId, unknownProducerTaskId],
    partitionAwareNextDataTaskIds: {},
    finalUpstreamTaskIds: {
      primary: [producerTaskId],
      additional: [],
      unknown: [unknownProducerTaskId],
      decision: "SCHEDULE_DATA_INTERSECTION",
    },
    issues: [],
    issueDetails: [],
    boundaries: {},
  } as unknown as OneHopReconciliationResult;

  const taskNodes = [
    {
      taskId: rootTaskId,
      minDepth: 0,
      expansionStatus: partial ? "TRUNCATED" : "EXPANDED",
      taskInputPackStatus: "TASK_INPUT_PACK_AVAILABLE",
      taskContentHash: "d".repeat(64),
      evidence: [taskEvidence(rootTaskId)],
      upstreamDecision: {
        source: "ONE_HOP_FINAL_UPSTREAM",
        primary: [producerTaskId],
        additional: [],
        unknown: [unknownProducerTaskId],
        decision: "SCHEDULE_DATA_INTERSECTION",
        evidence: [],
      },
    },
    {
      taskId: producerTaskId,
      minDepth: producerDepth,
      expansionStatus: "TERMINAL",
      taskInputPackStatus: "TASK_INPUT_PACK_AVAILABLE",
      taskContentHash: "e".repeat(64),
      evidence: [taskEvidence(producerTaskId)],
      upstreamDecision: null,
    },
    {
      taskId: unknownProducerTaskId,
      minDepth: 1,
      expansionStatus: "TERMINAL",
      taskInputPackStatus: "TASK_INPUT_PACK_AVAILABLE",
      taskContentHash: "f".repeat(64),
      evidence: [taskEvidence(unknownProducerTaskId)],
      upstreamDecision: null,
    },
    {
      taskId: scheduleOnlyTaskId,
      minDepth: 1,
      expansionStatus: "TERMINAL",
      taskInputPackStatus: null,
      taskContentHash: null,
      evidence: [],
      upstreamDecision: null,
    },
  ] as const;

  const tableNodes = [
    { ...primaryTable, identityStatus: "RESOLVED" },
    { ...sameNameOtherSourceTable, identityStatus: "RESOLVED" },
  ] as const;
  const readEdges = [
    {
      consumerTaskId: rootTaskId,
      table: { ...primaryTable, identityStatus: "RESOLVED" },
      statementIndexes: [0],
      eligibleStatementIndexes: [0],
      blockedStatementIndexes: [],
      recursionStatus: "ELIGIBLE",
      blockReasons: [],
      evidence: [sqlEvidence(rootTaskId, 0)],
    },
    {
      consumerTaskId: rootTaskId,
      table: { ...sameNameOtherSourceTable, identityStatus: "RESOLVED" },
      statementIndexes: [1],
      eligibleStatementIndexes: [1],
      blockedStatementIndexes: [],
      recursionStatus: "ELIGIBLE",
      blockReasons: [],
      evidence: [sqlEvidence(rootTaskId, 1)],
    },
  ] as const;
  const primaryWrites = [0, 1].map((statementIndex) => ({
    observationKind: "SQL_EXPLICIT_WRITE" as const,
    declaredWriteMode: "OVERWRITE",
    sqlWriteKind: "INSERT_OVERWRITE" as const,
    partition: [],
    writeDirection: "WRITE_CONFIRMED" as const,
    operationClass: "INSERT_OVERWRITE" as const,
    dataPathRole: "PRODUCER" as const,
    evidence: [sqlEvidence(producerTaskId, statementIndex)],
  }));
  const unknownWrites = [
    {
      observationKind: "SQL_EXPLICIT_WRITE" as const,
      declaredWriteMode: "INTO",
      sqlWriteKind: "INSERT_INTO" as const,
      partition: [],
      writeDirection: "WRITE_CONFIRMED" as const,
      operationClass: "INSERT_INTO" as const,
      dataPathRole: "PRODUCER" as const,
      evidence: [sqlEvidence(unknownProducerTaskId)],
    },
  ];
  const writeEdges = [
    {
      producerTaskId,
      table: primaryTable,
      writes: primaryWrites,
      producerIndexContentHash: FIXTURE_PRODUCER_INDEX_HASH,
    },
    {
      producerTaskId: unknownProducerTaskId,
      table: sameNameOtherSourceTable,
      writes: unknownWrites,
      producerIndexContentHash: FIXTURE_PRODUCER_INDEX_HASH,
    },
  ] as const;
  const producerBridges = [
    {
      consumerTaskId: rootTaskId,
      table: primaryTable,
      producerTaskId,
      producerDepth,
      producerRole: "PRIMARY",
      readOccurrence: {
        occurrenceId: `${rootTaskId}:read:0`,
        readRelationId: `${rootTaskId}:relation:0`,
        statementIndex: 0,
        relationPath: [`${rootTaskId}:relation:0`],
      },
    },
    {
      consumerTaskId: rootTaskId,
      table: sameNameOtherSourceTable,
      producerTaskId: unknownProducerTaskId,
      producerDepth: 1,
      producerRole: "UNKNOWN",
      readOccurrence: null,
    },
  ] as const;
  const scheduleEdges = [
    {
      consumerTaskId: rootTaskId,
      producerTaskId: scheduleOnlyTaskId,
      producerDepth: 1,
      evidence: [scheduleEvidence(rootTaskId, scheduleOnlyTaskId)],
    },
  ] as const;
  const terminals = [
    {
      taskId: scheduleOnlyTaskId,
      depth: 1,
      reason: "REFERENCE_CONFIG",
      detail: { source: "fixture" },
    },
    ...(partial
      ? [
          {
            taskId: rootTaskId,
            depth: 0,
            reason: "MAX_TASKS_REACHED" as const,
            detail: { remainingFrontierTasks: 1 },
          },
        ]
      : []),
  ] as const;

  const withoutContentHash = {
    schemaVersion: "1.1.0",
    artifactType: "TABLE_MULTI_HOP_RECONCILIATION",
    rootTaskId,
    generatedAt,
    producerIndex: {
      contentHash: FIXTURE_PRODUCER_INDEX_HASH,
      inputFingerprint: FIXTURE_INPUT_FINGERPRINT,
      status: partial ? "VALID_PARTIAL" : "VALID_SUCCESS",
    },
    terminalTableConfig: {
      version: "fixture-v1",
      stopRoles: ["REFERENCE_CONFIG"],
    },
    taskNodes,
    tableNodes,
    readEdges,
    writeEdges,
    producerBridges,
    scheduleEdges,
    terminals,
    scheduleSkeleton: {
      boundary: "ROOT_DEPTH_1_ONLY",
      parents: [
        {
          taskId: scheduleOnlyTaskId,
          taskName: null,
          evidence: [scheduleEvidence(rootTaskId, scheduleOnlyTaskId)],
        },
      ],
    },
    coverage: {
      semantics: "OBSERVED_EVIDENCE_ONLY",
      status: partial ? "PARTIAL_EVIDENCE" : "COMPLETE_OBSERVED_EVIDENCE",
      producerIndexStatus: partial ? "VALID_PARTIAL" : "VALID_SUCCESS",
      taskPacksDiscovered: 3,
      taskPacksInvalid: 0,
      tablePacksDiscovered: 2,
      tablePacksInvalid: 0,
      eligibleReadEdges: 2,
      blockedReadEdges: 0,
      readsWithConfirmedProducer: 2,
      readsWithoutConfirmedProducer: 0,
    },
    limits: {
      maxDepth: 10,
      maxTasks: 100,
      maxEdges: 500,
      truncated: partial,
      truncationReason: partial ? "MAX_TASKS_REACHED" : null,
      remainingFrontierTasks: partial ? 1 : 0,
    },
    counts: {
      taskNodes: taskNodes.length,
      tableNodes: tableNodes.length,
      readEdges: readEdges.length,
      writeEdges: writeEdges.length,
      producerBridges: producerBridges.length,
      scheduleEdges: scheduleEdges.length,
      terminals: terminals.length,
    },
    countSemantics: "NODE_AND_UNIQUE_EDGE_COUNTS",
    issues: partial ? ["MAX_TASKS_REACHED"] : [],
    boundaries: {
      staticSqlOnly: true,
      openCli: "NOT_USED",
      producerCandidatesAreWrites: false,
      partitionScope: "TASK_TO_TABLE_WRITE",
      schedulerExecution: "NOT_EVALUATED",
      runtimeDelivery: "NOT_EVALUATED",
      businessCorrectness: "NOT_EVALUATED",
    },
  } as const;
  const multiHop = {
    ...withoutContentHash,
    contentHash: canonicalHash(withoutContentHash as unknown as JsonValue, [
      "generatedAt",
      "contentHash",
    ]),
  } as unknown as MultiHopReconciliationResult;

  return { oneHop, multiHop };
}
