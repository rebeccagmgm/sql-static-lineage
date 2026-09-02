import {
  compareText,
  sortedUnique,
} from "../../contracts/project-topology-contract.ts";
import type { TaskLocalUnionDerivedEdge } from "./task-local-union-edges.ts";
import type {
  TaskLocalUnionEdge,
  TaskLocalUnionMergeResult,
  TaskLocalUnionNode,
} from "./task-local-union-merge.ts";
import { normalizeName } from "./task-local-union-merge.ts";

export type TaskLocalUnionContinuationGapCode =
  | "WRITER_NOT_IN_UNION"
  | "NO_KNOWN_WRITER"
  | "PARTITION_NO_MATCH"
  | "WRITER_PARTITION_UNKNOWN"
  | "READ_PREDICATE_NON_LITERAL"
  | "CANDIDATE_SCHEDULE_ONLY_WRITER";

export interface TaskLocalUnionContinuationGap {
  readonly gapId: string;
  readonly reasonCode: TaskLocalUnionContinuationGapCode;
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface ProducerIndexWriter {
  readonly taskId: string;
  readonly datasetNodeId?: string;
  readonly qualifiedName?: string;
  readonly partition?: readonly {
    readonly column: string;
    readonly values: readonly string[];
    readonly partitionStatus?: string;
  }[];
}

export interface TraceUnionUpstreamOptions {
  readonly merge: TaskLocalUnionMergeResult;
  /** Dataset node id to resolve writers for. */
  readonly datasetNodeId: string;
  /**
   * Optional producer-index writers for §5.2 boundary. When omitted / empty,
   * only in-union WRITES are considered.
   */
  readonly producerIndexWriters?: readonly ProducerIndexWriter[];
  /** Kill-switch for derived PRODUCER_BRIDGE emission. Default true. */
  readonly enableDerivedProducerBridge?: boolean;
  /**
   * Optional read-side partition predicates for §5.4 pruning.
   * scheduleReference MUST NOT be passed here.
   */
  readonly readPartition?: {
    readonly partitionPredicateStatus:
      "LITERAL" | "NON_LITERAL_PRESENT" | "NONE";
    readonly partitionPredicates?: readonly {
      readonly column: string;
      readonly values: readonly string[];
    }[];
  };
  /**
   * Optional SCHEDULE_ONLY candidate writers from scheduleReference.targetTable
   * (WP-3.2). Never CONFIRMED.
   */
  readonly scheduleOnlyCandidates?: readonly {
    readonly taskId: string;
    readonly targetTable: string | null;
  }[];
}

export interface TraceUnionUpstreamResult {
  readonly datasetNodeId: string;
  readonly inUnionWriterTaskIds: readonly string[];
  readonly producerIndexBoundaryTaskIds: readonly string[];
  readonly candidateScheduleOnlyTaskIds: readonly string[];
  readonly derivedEdges: readonly TaskLocalUnionDerivedEdge[];
  readonly gaps: readonly TaskLocalUnionContinuationGap[];
  readonly prunedByPartition: boolean;
}

/**
 * §5.1–5.4 continuation kernel.
 * scheduleReference is intentionally absent from prune inputs.
 */
export function traceUnionUpstream(
  options: TraceUnionUpstreamOptions,
): TraceUnionUpstreamResult {
  const enableDerived = options.enableDerivedProducerBridge !== false;
  const nodesById = new Map(
    options.merge.nodes.map((node) => [node.nodeId, node]),
  );
  const dataset = nodesById.get(options.datasetNodeId);
  if (!dataset || dataset.nodeType !== "PHYSICAL_DATASET") {
    throw new Error(
      `TASK_LOCAL_UNION_DATASET_MISSING:${options.datasetNodeId}`,
    );
  }

  const inUnionWriterTaskIds = findInUnionWriters(
    options.merge.edges,
    nodesById,
    options.datasetNodeId,
  );

  const gaps: TaskLocalUnionContinuationGap[] = [];
  let writers = [...inUnionWriterTaskIds];
  let prunedByPartition = false;

  const readPartition = options.readPartition;
  if (readPartition?.partitionPredicateStatus === "NON_LITERAL_PRESENT") {
    gaps.push({
      gapId: `read-predicate-non-literal:${options.datasetNodeId}`,
      reasonCode: "READ_PREDICATE_NON_LITERAL",
      message: "Read partition predicate is non-literal; no writer pruning",
      details: { datasetNodeId: options.datasetNodeId },
    });
  } else if (
    readPartition?.partitionPredicateStatus === "LITERAL" &&
    writers.length > 0
  ) {
    const prune = pruneWritersByPartition({
      writerTaskIds: writers,
      producerIndexWriters: options.producerIndexWriters ?? [],
      predicates: readPartition.partitionPredicates ?? [],
      datasetNodeId: options.datasetNodeId,
    });
    writers = prune.retained;
    prunedByPartition = prune.pruned;
    gaps.push(...prune.gaps);
  }

  const inUnionSet = new Set(inUnionWriterTaskIds);
  const producerWriters = (options.producerIndexWriters ?? []).filter(
    (writer) =>
      writer.datasetNodeId === options.datasetNodeId ||
      (writer.qualifiedName &&
        dataset.properties.qualifiedName &&
        normalizeName(writer.qualifiedName) ===
          normalizeName(String(dataset.properties.qualifiedName))),
  );
  const boundaryTaskIds = sortedUnique(
    producerWriters
      .map((writer) => writer.taskId)
      .filter((taskId) => !inUnionSet.has(taskId)),
  );

  const derivedEdges: TaskLocalUnionDerivedEdge[] = [];
  if (boundaryTaskIds.length > 0) {
    for (const taskId of boundaryTaskIds) {
      gaps.push({
        gapId: `writer-not-in-union:${options.datasetNodeId}:${taskId}`,
        reasonCode: "WRITER_NOT_IN_UNION",
        message: `Producer-index writer ${taskId} is not in the union`,
        details: { datasetNodeId: options.datasetNodeId, taskId },
      });
      if (enableDerived) {
        derivedEdges.push({
          edgeId: `derived:producer-bridge:${taskId}:${options.datasetNodeId}`,
          edgeType: "PRODUCER_BRIDGE",
          fromNodeId: `task:${taskId}`,
          toNodeId: options.datasetNodeId,
          properties: { provenance: "PRODUCER_INDEX" },
          derived: true,
          provenance: "PRODUCER_INDEX",
          evidenceStatus: "CONFIRMED",
        });
      }
    }
  } else if (
    writers.length === 0 &&
    inUnionWriterTaskIds.length === 0 &&
    producerWriters.length === 0
  ) {
    gaps.push({
      gapId: `no-known-writer:${options.datasetNodeId}`,
      reasonCode: "NO_KNOWN_WRITER",
      message: `No known writer for ${options.datasetNodeId}`,
      details: { datasetNodeId: options.datasetNodeId },
    });
  }

  const qualifiedName = text(dataset.properties.qualifiedName);
  const candidateScheduleOnlyTaskIds = sortedUnique(
    (options.scheduleOnlyCandidates ?? [])
      .filter(
        (candidate) =>
          candidate.targetTable &&
          qualifiedName &&
          normalizeName(candidate.targetTable) === normalizeName(qualifiedName),
      )
      .map((candidate) => candidate.taskId),
  );
  for (const taskId of candidateScheduleOnlyTaskIds) {
    gaps.push({
      gapId: `candidate-schedule-only:${options.datasetNodeId}:${taskId}`,
      reasonCode: "CANDIDATE_SCHEDULE_ONLY_WRITER",
      message: `SCHEDULE_ONLY task ${taskId} is a CANDIDATE writer via targetTable`,
      details: {
        datasetNodeId: options.datasetNodeId,
        taskId,
        evidenceStatus: "CANDIDATE",
      },
    });
  }

  return {
    datasetNodeId: options.datasetNodeId,
    inUnionWriterTaskIds: sortedUnique(writers),
    producerIndexBoundaryTaskIds: boundaryTaskIds,
    candidateScheduleOnlyTaskIds,
    derivedEdges: enableDerived ? derivedEdges : [],
    gaps: gaps.sort((left, right) => compareText(left.gapId, right.gapId)),
    prunedByPartition,
  };
}

function findInUnionWriters(
  edges: readonly TaskLocalUnionEdge[],
  nodesById: Map<string, TaskLocalUnionNode>,
  datasetNodeId: string,
): string[] {
  const writerTaskIds = new Set<string>();
  // TARGET_WRITE → PHYSICAL_DATASET (WRITES)
  const targetWriteIds = new Set(
    edges
      .filter(
        (edge) => edge.edgeType === "WRITES" && edge.toNodeId === datasetNodeId,
      )
      .map((edge) => edge.fromNodeId)
      .filter((nodeId) => nodesById.get(nodeId)?.nodeType === "TARGET_WRITE"),
  );
  // Also accept direct TASK → PHYSICAL_DATASET WRITES if present in fixtures.
  for (const edge of edges) {
    if (edge.edgeType !== "WRITES" || edge.toNodeId !== datasetNodeId) continue;
    const from = nodesById.get(edge.fromNodeId);
    if (from?.nodeType === "TASK") {
      const taskId = taskIdFromNodeId(from.nodeId);
      if (taskId) writerTaskIds.add(taskId);
    }
  }
  for (const edge of edges) {
    if (edge.edgeType !== "WRITES") continue;
    if (!targetWriteIds.has(edge.toNodeId)) continue;
    const from = nodesById.get(edge.fromNodeId);
    if (from?.nodeType === "TASK") {
      const taskId = taskIdFromNodeId(from.nodeId);
      if (taskId) writerTaskIds.add(taskId);
    }
  }
  // Walk TARGET_WRITE owners via properties.taskId when TASK→TARGET_WRITE missing.
  for (const targetWriteId of targetWriteIds) {
    const node = nodesById.get(targetWriteId);
    const taskId =
      text(node?.properties.taskId) ??
      taskIdFromNodeId(
        // some projections store owning task on properties
        String(node?.properties.ownerTaskId ?? ""),
      );
    if (taskId) writerTaskIds.add(taskId);
    for (const edge of edges) {
      if (
        edge.edgeType === "WRITES" &&
        edge.toNodeId === targetWriteId &&
        nodesById.get(edge.fromNodeId)?.nodeType === "TASK"
      ) {
        const owner = taskIdFromNodeId(edge.fromNodeId);
        if (owner) writerTaskIds.add(owner);
      }
    }
  }
  return sortedUnique([...writerTaskIds]);
}

function pruneWritersByPartition(input: {
  readonly writerTaskIds: readonly string[];
  readonly producerIndexWriters: readonly ProducerIndexWriter[];
  readonly predicates: readonly {
    readonly column: string;
    readonly values: readonly string[];
  }[];
  readonly datasetNodeId: string;
}): {
  readonly retained: string[];
  readonly pruned: boolean;
  readonly gaps: TaskLocalUnionContinuationGap[];
} {
  const gaps: TaskLocalUnionContinuationGap[] = [];
  if (input.predicates.length === 0) {
    return { retained: [...input.writerTaskIds], pruned: false, gaps };
  }

  const retained: string[] = [];
  let anyUnknown = false;
  for (const taskId of input.writerTaskIds) {
    const writer = input.producerIndexWriters.find(
      (item) => item.taskId === taskId,
    );
    const partition = writer?.partition;
    if (
      !partition ||
      partition.some((part) => part.partitionStatus === "LEGACY_UNKNOWN")
    ) {
      anyUnknown = true;
      retained.push(taskId);
      continue;
    }
    if (partitionMatches(partition, input.predicates)) {
      retained.push(taskId);
    }
  }

  if (anyUnknown) {
    gaps.push({
      gapId: `writer-partition-unknown:${input.datasetNodeId}`,
      reasonCode: "WRITER_PARTITION_UNKNOWN",
      message: "One or more writers lack definite partition assignment",
      details: { datasetNodeId: input.datasetNodeId },
    });
    return {
      retained: sortedUnique([...input.writerTaskIds]),
      pruned: false,
      gaps,
    };
  }

  if (retained.length === 0) {
    gaps.push({
      gapId: `partition-no-match:${input.datasetNodeId}`,
      reasonCode: "PARTITION_NO_MATCH",
      message:
        "No writer partition matched read literals; retaining all writers",
      details: { datasetNodeId: input.datasetNodeId },
    });
    return {
      retained: sortedUnique([...input.writerTaskIds]),
      pruned: false,
      gaps,
    };
  }

  return {
    retained: sortedUnique(retained),
    pruned: retained.length !== input.writerTaskIds.length,
    gaps,
  };
}

function partitionMatches(
  writerPartition: readonly {
    readonly column: string;
    readonly values: readonly string[];
  }[],
  predicates: readonly {
    readonly column: string;
    readonly values: readonly string[];
  }[],
): boolean {
  for (const predicate of predicates) {
    const column = normalizeName(predicate.column);
    const writerCol = writerPartition.find(
      (part) => normalizeName(part.column) === column,
    );
    if (!writerCol) return false;
    const writerValues = new Set(
      writerCol.values.map((value) => normalizeName(value)),
    );
    const ok = predicate.values.some((value) =>
      writerValues.has(normalizeName(value)),
    );
    if (!ok) return false;
  }
  return true;
}

function taskIdFromNodeId(nodeId: string): string | null {
  return nodeId.startsWith("task:") ? nodeId.slice("task:".length) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Exported for tests: ensure scheduleReference never feeds prune inputs. */
export function assertNoScheduleReferenceInPruneInput(
  readPartition: TraceUnionUpstreamOptions["readPartition"],
): void {
  if (!readPartition) return;
  const record = readPartition as Record<string, unknown>;
  if ("scheduleReference" in record || "upstreamTaskIds" in record) {
    throw new Error("TASK_LOCAL_UNION_SCHEDULE_REFERENCE_IN_PRUNE_INPUT");
  }
}
