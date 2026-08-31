import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { runInputPackMachineFacts } from "../../machine-facts/input-pack-machine-facts.ts";
import { sha256 } from "../../machine-facts/machine-facts-contract.ts";
import {
  checkDbFlagTaskIds,
  prefetchHoraeRelations,
  withoutCheckDbFlagParents,
  type PrefetchedScheduleEvidence,
} from "../../pipeline/lineage-all.ts";
import {
  runProjectInputPackClosure,
  type ProjectInputPackClosureOptions,
  type ProjectInputPackClosureResult,
} from "../../pipeline/input-pack-closure.ts";
import {
  reconcileMultiHopBatch,
  type MultiHopReconciliationResult,
} from "../../reconcile/consumer/multi-hop/reconcile-multi-hop.ts";
import {
  loadTerminalTableConfig,
  type TerminalTableConfig,
} from "../../reconcile/consumer/multi-hop/terminal-table-config.ts";
import {
  reconcileOneHopBatch,
  type OneHopReconciliationResult,
  type ReconcileOneHopOptions,
} from "../../reconcile/consumer/one-hop/reconcile-one-hop.ts";
import { DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT } from "../../reconcile/consumer/one-hop/schedule-evidence-cache.ts";
import {
  fingerprintTableProducerInputs,
  loadTableProducerIndex,
} from "../../reconcile/producer/producer-index.ts";
import {
  publishProjectEvidenceArtifact,
  type PublishProjectEvidenceArtifactResult,
} from "./project-evidence-publication.ts";
import {
  buildProjectEvidenceSourceDescriptor,
  scheduleEvidenceIdentityHash,
  type ProjectEvidenceLimits,
  type ProjectEvidenceSourceDescriptorV1,
} from "./project-evidence-contract.ts";
import {
  buildRawOneHopCacheLookupIdentity,
  DEFAULT_RAW_ONE_HOP_CACHE_ROOT,
  readRawOneHopCache,
  rebindOneHopProducerIndexProvenance,
  rebindOneHopScheduleProvenance,
  writeRawOneHopCache,
  type RawOneHopCacheLookupIdentity,
} from "./task-evidence-cache.ts";

export interface DirectProjectTopologyOptions {
  readonly projectKey: string;
  readonly rootTaskIds: readonly string[];
  readonly dataRoot: string;
  readonly outputRoot: string;
  readonly terminalTableConfigPath: string;
  readonly limits: ProjectEvidenceLimits;
  readonly factsRoot?: string;
  readonly producerIndexCacheRoot?: string;
  readonly scheduleEvidenceCacheRoot?: string | null;
  readonly oneHopCacheRoot?: string;
  readonly dependencies?: Partial<DirectProjectTopologyDependencies>;
}

export interface DirectProjectTopologyDependencies {
  readonly closure: (
    options: ProjectInputPackClosureOptions,
  ) => ProjectInputPackClosureResult;
  readonly machineFacts: typeof runInputPackMachineFacts;
  readonly schedulePrefetch: typeof prefetchHoraeRelations;
  readonly oneHopBatch: (
    taskIds: readonly string[],
    options: ReconcileOneHopOptions,
  ) => readonly OneHopReconciliationResult[];
  readonly multiHopBatch: typeof reconcileMultiHopBatch;
  readonly fingerprintInput: typeof fingerprintTableProducerInputs;
  readonly loadTerminalConfig: typeof loadTerminalTableConfig;
}

export interface DirectProjectTopologyCounters {
  readonly rootTaskOccurrences: number;
  readonly uniqueTasks: number;
  readonly stableTraversalTasks: number;
  readonly sharedTaskOccurrencesSaved: number;
  readonly worksetRounds: number;
  readonly machineFactsCalls: number;
  readonly machineFactsTasks: number;
  readonly machineFactsCacheHits: number;
  readonly machineFactsComputedTasks: number;
  readonly schedulePrefetchCalls: number;
  readonly schedulePrefetchTasks: number;
  readonly oneHopBatchCalls: number;
  readonly oneHopTasks: number;
  readonly oneHopCacheHits: number;
  readonly oneHopCacheMisses: number;
  readonly oneHopCacheInvalidEntries: number;
  readonly oneHopComputedTasks: number;
  readonly oneHopCacheWrites: number;
  readonly rootTraversalCalls: number;
  readonly rootTraversalRounds: number;
  readonly closure: ProjectInputPackClosureResult["counters"];
}

export interface DirectProjectTopologyRunResult {
  readonly source: ProjectEvidenceSourceDescriptorV1;
  readonly published: PublishProjectEvidenceArtifactResult;
  readonly roots: readonly MultiHopReconciliationResult[];
  readonly closure: ProjectInputPackClosureResult;
  readonly counters: DirectProjectTopologyCounters;
  readonly timingsMs: Readonly<Record<string, number>>;
}

export async function runDirectProjectTopology(
  options: DirectProjectTopologyOptions,
): Promise<DirectProjectTopologyRunResult> {
  validateRunSelection(options);
  const dataRoot = resolve(options.dataRoot);
  const outputRoot = resolve(options.outputRoot);
  const terminalConfigPath = resolve(options.terminalTableConfigPath);
  if (
    !existsSync(join(dataRoot, "tasks")) ||
    !existsSync(join(dataRoot, "tables"))
  )
    throw new Error("INPUT_PACK_ROOT_INCOMPLETE");
  const deps = dependencies(options.dependencies);
  const timings: Record<string, number> = {};
  const timed = async <T>(
    label: string,
    action: () => T | Promise<T>,
  ): Promise<T> => {
    const started = performance.now();
    try {
      return await action();
    } finally {
      timings[label] = (timings[label] ?? 0) + performance.now() - started;
    }
  };
  const terminalConfigBytes = readFileSync(terminalConfigPath);
  const terminalConfigHash = sha256(terminalConfigBytes);
  const terminalTableConfig = deps.loadTerminalConfig(terminalConfigPath);
  const producerIndexCacheRoot = resolve(
    options.producerIndexCacheRoot ?? `${dataRoot}.producer-index-cache`,
  );
  const factsRoot = resolve(
    options.factsRoot ??
      join(outputRoot, ".project-evidence-cache", "machine-facts"),
  );
  const oneHopCacheRoot = resolve(
    options.oneHopCacheRoot ?? DEFAULT_RAW_ONE_HOP_CACHE_ROOT,
  );

  const closure = await timed("closure", () =>
    deps.closure({
      rootTaskIds: options.rootTaskIds,
      dataRoot,
      producerIndexCacheRoot,
      maxDepth: options.limits.maxDepth,
      // Closure preparation is bounded by the union cap. Per-root traversal
      // limits belong to the shared kernel so they produce explicit root
      // boundaries instead of aborting source preparation early.
      maxTasksPerRoot: options.limits.maxUnionTasks,
      maxUnionTasks: options.limits.maxUnionTasks,
      maxRounds: options.limits.maxRounds,
      terminalTableConfig,
    }),
  );
  if (closure.status !== "COMPLETE")
    throw new Error(
      `PROJECT_INPUT_PACK_CLOSURE_PARTIAL:${closure.issues.join(";")}`,
    );
  const producerIndex = loadTableProducerIndex(
    closure.producerSnapshot.indexPath,
  );
  if (
    producerIndex.inputFingerprint !== closure.producerSnapshot.inputFingerprint
  )
    throw new Error("PROJECT_PRODUCER_SNAPSHOT_MISMATCH");

  const preparedTaskIds = sortedUniqueTaskIds(closure.taskIds);
  const facts = await timed("machineFacts", () =>
    deps.machineFacts({
      dataRoot,
      taskIds: preparedTaskIds,
      outputRoot: factsRoot,
      indexMode: "incremental",
    }),
  );
  const failedFacts = facts.tasks.filter(
    (fact) => fact.status === "FAILED" || fact.state === "FAILED",
  );
  if (failedFacts.length > 0)
    throw new Error(
      `MACHINE_FACTS_FAILED:${failedFacts.map((fact) => fact.task_id).join(",")}`,
    );
  const machineFactsCacheHits = facts.tasks.filter(
    (fact) => fact.status === "REUSED",
  ).length;
  const taskInputByTaskId = new Map(
    facts.prepared.map((prepared) => [prepared.taskId, prepared] as const),
  );
  const machineFactsByTaskId = new Map(
    facts.tasks.map((fact) => [fact.task_id, fact] as const),
  );

  const scheduleEvidence: ReadonlyMap<string, PrefetchedScheduleEvidence> =
    await timed("schedulePrefetch", () =>
      deps.schedulePrefetch(preparedTaskIds, {
        cacheRoot:
          options.scheduleEvidenceCacheRoot === undefined
            ? DEFAULT_SCHEDULE_EVIDENCE_CACHE_ROOT
            : options.scheduleEvidenceCacheRoot,
      }),
    );
  for (const taskId of preparedTaskIds)
    if (!scheduleEvidence.has(taskId))
      throw new Error(`SCHEDULE_PREFETCH_MISSING:${taskId}`);

  const rawOneHopByTaskId = new Map<string, OneHopReconciliationResult>();
  const oneHopIdentityByTaskId = new Map<
    string,
    RawOneHopCacheLookupIdentity
  >();
  const oneHopMissTaskIds: string[] = [];
  let oneHopCacheInvalidEntries = 0;
  for (const taskId of preparedTaskIds) {
    const taskScheduleEvidence = scheduleEvidence.get(taskId);
    if (!taskScheduleEvidence)
      throw new Error(`SCHEDULE_PREFETCH_MISSING:${taskId}`);
    const taskInput = taskInputByTaskId.get(taskId);
    if (!taskInput)
      throw new Error(`MACHINE_FACTS_PREPARED_INPUT_MISSING:${taskId}`);
    const machineFact = machineFactsByTaskId.get(taskId);
    if (!machineFact?.manifest_sha256)
      throw new Error(`MACHINE_FACTS_MANIFEST_MISSING:${taskId}`);
    const identity = buildRawOneHopCacheLookupIdentity({
      taskId,
      taskInputContentHash: taskInput.taskContentHash,
      machineFactsManifestHash: machineFact.manifest_sha256,
      scheduleRows: taskScheduleEvidence.rows,
      terminalConfigContentHash: terminalConfigHash,
    });
    oneHopIdentityByTaskId.set(taskId, identity);
    const cached = readRawOneHopCache(oneHopCacheRoot, identity, producerIndex);
    if (cached.status === "HIT") {
      const currentProducerIdentity = rebindOneHopProducerIndexProvenance(
        cached.result,
        producerIndex,
      );
      rawOneHopByTaskId.set(
        taskId,
        rebindOneHopScheduleProvenance(
          currentProducerIdentity,
          taskScheduleEvidence,
        ),
      );
      continue;
    }
    if (cached.status === "INVALID") oneHopCacheInvalidEntries += 1;
    oneHopMissTaskIds.push(taskId);
  }

  const computedRawOneHop =
    oneHopMissTaskIds.length === 0
      ? []
      : await timed("oneHop", () =>
          deps.oneHopBatch(oneHopMissTaskIds, {
            dataRoot,
            producerIndex,
            verifyInputFingerprint: true,
            trustedInputFingerprint: closure.producerSnapshot.inputFingerprint,
            scheduleEvidenceByTaskId: scheduleEvidence,
            terminalTableConfig,
          }),
        );
  if (computedRawOneHop.length !== oneHopMissTaskIds.length)
    throw new Error("PROJECT_ONE_HOP_RESULT_COUNT_MISMATCH");
  let oneHopCacheWrites = 0;
  for (const snapshot of computedRawOneHop) {
    const identity = oneHopIdentityByTaskId.get(snapshot.taskId);
    if (!identity)
      throw new Error(`RAW_ONE_HOP_CACHE_IDENTITY_MISSING:${snapshot.taskId}`);
    const written = writeRawOneHopCache(
      oneHopCacheRoot,
      identity,
      producerIndex,
      snapshot,
    );
    if (written.status !== "REUSED") oneHopCacheWrites += 1;
    rawOneHopByTaskId.set(snapshot.taskId, snapshot);
  }
  const rawOneHop = preparedTaskIds.map((taskId) => {
    const snapshot = rawOneHopByTaskId.get(taskId);
    if (!snapshot)
      throw new Error(`PROJECT_ONE_HOP_SNAPSHOT_MISSING:${taskId}`);
    return snapshot;
  });
  const checkDbFlagIds = checkDbFlagTaskIds(dataRoot, rawOneHop);
  const oneHopByTaskId = new Map(
    rawOneHop.map((snapshot) => [
      snapshot.taskId,
      withoutCheckDbFlagParents(snapshot, checkDbFlagIds),
    ]),
  );
  const roots = options.rootTaskIds.map((taskId) => {
    const rootOneHop = oneHopByTaskId.get(taskId);
    if (!rootOneHop) throw new Error(`ROOT_ONE_HOP_SNAPSHOT_MISSING:${taskId}`);
    return { taskId, rootOneHop };
  });
  const traversals = await timed("rootTraversal", () =>
    deps.multiHopBatch(roots, {
      dataRoot,
      producerIndex,
      maxDepth: options.limits.maxDepth,
      maxTasks: options.limits.maxTasksPerRoot,
      maxEdges: options.limits.maxEdgesPerRoot,
      oneHopSnapshots: oneHopByTaskId,
      trustedInputFingerprint: closure.producerSnapshot.inputFingerprint,
      terminalTableConfig,
    }),
  );
  if (traversals.length !== options.rootTaskIds.length)
    throw new Error("PROJECT_ROOT_TRAVERSAL_RESULT_COUNT_MISMATCH");

  const fingerprintAfterTraversal = await timed("finalFingerprint", () =>
    deps.fingerprintInput(dataRoot),
  );
  if (fingerprintAfterTraversal !== closure.producerSnapshot.inputFingerprint)
    throw new Error("INPUT_CHANGED_DURING_PROJECT_EVIDENCE");
  if (sha256(readFileSync(terminalConfigPath)) !== terminalConfigHash)
    throw new Error("TERMINAL_CONFIG_CHANGED_DURING_PROJECT_EVIDENCE");

  const descriptor = buildProjectEvidenceSourceDescriptor({
    projectKey: options.projectKey,
    rootTaskIds: options.rootTaskIds,
    inputFingerprint: closure.producerSnapshot.inputFingerprint,
    producerIndexContentHash: producerIndex.contentHash,
    terminalConfig: {
      version: terminalTableConfig.version,
      contentHash: terminalConfigHash,
      stopRoles: terminalTableConfig.stopRoles,
    },
    scheduleEvidenceContentHash: scheduleEvidenceIdentityHash(scheduleEvidence),
    limits: options.limits,
  });
  const published = await timed("publication", () =>
    publishProjectEvidenceArtifact({
      outputRoot,
      projectKey: options.projectKey,
      source: descriptor,
      roots: traversals.map((traversal) => {
        const oneHop = rawOneHopByTaskId.get(traversal.rootTaskId);
        if (!oneHop)
          throw new Error(
            `ROOT_ONE_HOP_SNAPSHOT_MISSING:${traversal.rootTaskId}`,
          );
        return { rootTaskId: traversal.rootTaskId, oneHop, traversal };
      }),
    }),
  );
  const rootTaskOccurrences = traversals.reduce(
    (sum, traversal) => sum + traversal.taskNodes.length,
    0,
  );
  const stableTraversalTasks = new Set(
    traversals.flatMap((traversal) =>
      traversal.taskNodes.map((task) => task.taskId),
    ),
  ).size;
  return {
    source: descriptor,
    published,
    roots: traversals,
    closure,
    counters: {
      rootTaskOccurrences,
      uniqueTasks: preparedTaskIds.length,
      stableTraversalTasks,
      sharedTaskOccurrencesSaved: rootTaskOccurrences - stableTraversalTasks,
      worksetRounds: 1,
      machineFactsCalls: 1,
      machineFactsTasks: preparedTaskIds.length,
      machineFactsCacheHits,
      machineFactsComputedTasks: preparedTaskIds.length - machineFactsCacheHits,
      schedulePrefetchCalls: 1,
      schedulePrefetchTasks: scheduleEvidence.size,
      oneHopBatchCalls: oneHopMissTaskIds.length === 0 ? 0 : 1,
      oneHopTasks: oneHopByTaskId.size,
      oneHopCacheHits: preparedTaskIds.length - oneHopMissTaskIds.length,
      oneHopCacheMisses: oneHopMissTaskIds.length,
      oneHopCacheInvalidEntries,
      oneHopComputedTasks: oneHopMissTaskIds.length,
      oneHopCacheWrites,
      rootTraversalCalls: traversals.length,
      rootTraversalRounds: 1,
      closure: closure.counters,
    },
    timingsMs: timings,
  };
}

function validateRunSelection(options: DirectProjectTopologyOptions): void {
  if (
    options.rootTaskIds.length === 0 ||
    new Set(options.rootTaskIds).size !== options.rootTaskIds.length
  )
    throw new Error("PROJECT_EVIDENCE_ROOTS_INVALID");
  for (const [label, value] of Object.entries(options.limits))
    if (!Number.isSafeInteger(value) || value < 1)
      throw new Error(`PROJECT_EVIDENCE_${label.toUpperCase()}_INVALID`);
  if (options.rootTaskIds.length > options.limits.maxRoots)
    throw new Error("PROJECT_EVIDENCE_MAX_ROOTS_REACHED");
}

function sortedUniqueTaskIds(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

function dependencies(
  overrides: Partial<DirectProjectTopologyDependencies> | undefined,
): DirectProjectTopologyDependencies {
  return {
    closure: runProjectInputPackClosure,
    machineFacts: runInputPackMachineFacts,
    schedulePrefetch: prefetchHoraeRelations,
    oneHopBatch: reconcileOneHopBatch,
    multiHopBatch: reconcileMultiHopBatch,
    fingerprintInput: fingerprintTableProducerInputs,
    loadTerminalConfig: loadTerminalTableConfig,
    ...overrides,
  };
}
