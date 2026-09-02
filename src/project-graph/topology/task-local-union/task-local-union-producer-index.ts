import { readFileSync } from "node:fs";

import { normalizeName } from "./task-local-union-merge.ts";
import type { ProducerIndexWriter } from "./task-local-union-continuation.ts";
import type { TaskLocalUnionProducerIndexRef } from "./task-local-union-contract.ts";

const SHA256 = /^[a-f0-9]{64}$/i;

export interface LoadedProducerIndex {
  readonly identity: TaskLocalUnionProducerIndexRef;
  readonly writers: readonly ProducerIndexWriter[];
}

/**
 * Load TABLE_PRODUCER_INDEX identity + confirmed writer observations for §5.2/§5.4.
 */
export function loadProducerIndex(path: string): LoadedProducerIndex {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  const contentHash = text(parsed.contentHash);
  const inputFingerprint = text(parsed.inputFingerprint);
  if (!contentHash || !SHA256.test(contentHash) || !inputFingerprint) {
    throw new Error("TASK_LOCAL_UNION_PRODUCER_INDEX_INVALID");
  }
  const edges = Array.isArray(parsed.confirmedProducerEdges)
    ? parsed.confirmedProducerEdges
    : [];
  const writers: ProducerIndexWriter[] = [];
  for (const edge of edges) {
    if (typeof edge !== "object" || edge === null || Array.isArray(edge))
      continue;
    const record = edge as Record<string, unknown>;
    const taskId = text(record.taskId);
    if (!taskId) continue;
    const table =
      typeof record.table === "object" &&
      record.table !== null &&
      !Array.isArray(record.table)
        ? (record.table as Record<string, unknown>)
        : null;
    const qualifiedName = table ? text(table.qualifiedName) : null;
    const writes = Array.isArray(record.writes) ? record.writes : [];
    const partition = flattenPartitions(writes);
    writers.push({
      taskId,
      qualifiedName: qualifiedName ?? undefined,
      partition,
    });
  }
  return {
    identity: { contentHash, inputFingerprint },
    writers,
  };
}

export function writersForQualifiedName(
  writers: readonly ProducerIndexWriter[],
  qualifiedName: string,
): ProducerIndexWriter[] {
  const key = normalizeName(qualifiedName);
  return writers.filter(
    (writer) =>
      writer.qualifiedName !== undefined &&
      normalizeName(writer.qualifiedName) === key,
  );
}

function flattenPartitions(
  writes: readonly unknown[],
): ProducerIndexWriter["partition"] {
  const parts: NonNullable<ProducerIndexWriter["partition"]>[number][] = [];
  for (const write of writes) {
    if (typeof write !== "object" || write === null || Array.isArray(write)) {
      continue;
    }
    const record = write as Record<string, unknown>;
    const partitionStatus = text(record.partitionStatus) ?? undefined;
    const partition = Array.isArray(record.partition) ? record.partition : [];
    for (const item of partition) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        continue;
      }
      const part = item as Record<string, unknown>;
      const column = text(part.field) ?? text(part.column);
      if (!column) continue;
      const values: string[] = [];
      const observed = text(part.observedValue);
      if (observed) values.push(observed);
      const expression = text(part.expression);
      if (expression && !values.includes(expression)) values.push(expression);
      parts.push({
        column,
        values,
        ...(partitionStatus ? { partitionStatus } : {}),
      });
    }
  }
  return parts;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
