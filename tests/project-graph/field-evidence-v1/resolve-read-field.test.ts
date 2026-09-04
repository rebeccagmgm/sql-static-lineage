import { describe, expect, it } from "vitest";

import {
  createUnionContinuationCandidateSource,
  type UnionContinuationIndex,
  type UnionContinuationIndexCandidate,
  type UnionContinuationIndexEntry,
} from "../../../scripts/reconcile/consumer/target-table-upstream-causal-closure/union-continuation-candidate-source.ts";
import { canonicalJson, sha256 } from "../../../scripts/machine-facts/machine-facts-contract.ts";
import { buildFieldEdgeIndex } from "../../../scripts/project-graph/field-evidence-v1/field-edge-index.ts";
import { resolveReadField } from "../../../scripts/project-graph/field-evidence-v1/resolve-read-field.ts";
import type { TaskLocalProjection } from "../../../scripts/project-graph/task-local/contract.ts";

function candidate(
  overrides: Partial<UnionContinuationIndexCandidate> = {},
): UnionContinuationIndexCandidate {
  return {
    taskId: "producer-a",
    writeObservationId: "write-observation:producer-a:0",
    targetWriteNodeId: "target-write:producer-a:0",
    datasetNodeId: "dataset:example",
    qualifiedName: "warehouse.example_table",
    source: "IN_UNION_FINAL_WRITE",
    partitionMatchStatus: "CONFIRMED",
    partition: [],
    evidenceLayer: "L1",
    l1Eligible: true,
    ...overrides,
  };
}

function entry(
  consumerTaskId: string,
  readOccurrenceId: string,
  candidates: readonly UnionContinuationIndexCandidate[],
): UnionContinuationIndexEntry {
  return {
    consumerTaskId,
    readOccurrenceId,
    readOccurrenceNodeId: `read-node:${readOccurrenceId}`,
    datasetNodeId: "dataset:example",
    qualifiedName: "warehouse.example_table",
    identityStatus: "CONFIRMED",
    partitionPredicateStatus: "NONE",
    candidates,
    prunedWriteObservationIds: [],
    gaps: [],
  };
}

function index(entries: readonly UnionContinuationIndexEntry[]) {
  const body = {
    schemaVersion: "1.0.0" as const,
    artifactType: "UNION_CONTINUATION_INDEX" as const,
    generatedAt: "2026-09-04T00:00:00.000Z",
    input: {
      batchManifestRef: { contentHash: "batch-hash" },
      producerIndex: { contentHash: "producer-hash", inputFingerprint: "input-hash" },
      taskProjections: [],
    },
    entries,
  };
  const { generatedAt: _generatedAt, ...stableBody } = body;
  return {
    ...body,
    contentHash: sha256(canonicalJson(stableBody)),
  } satisfies UnionContinuationIndex;
}

function projectionWithBinding(input: {
  readonly taskId: string;
  readonly writeObservationId: string;
  readonly outputColumn: string;
  readonly readOccurrenceId: string;
}): TaskLocalProjection {
  const targetWriteNodeId = `target-write:${input.taskId}:0`;
  const fieldNodeId = "physical-field:amount";
  return {
    schemaVersion: "1.3.0",
    artifactType: "TASK_LOCAL_PROJECTION",
    generatedAt: "2026-09-04T00:00:00.000Z",
    taskId: input.taskId,
    coverageStatus: "PROJECTED",
    failureReasonCode: null,
    contentHash: "projection-hash",
    nodes: [
      { nodeId: `task:${input.taskId}`, nodeType: "TASK", properties: {} },
      {
        nodeId: fieldNodeId,
        nodeType: "PHYSICAL_FIELD",
        properties: {
          qualifiedName: "warehouse.example_table",
          column: "amount",
        },
      },
      {
        nodeId: targetWriteNodeId,
        nodeType: "TARGET_WRITE",
        properties: { writeObservationId: input.writeObservationId },
      },
    ],
    edges: [{
      edgeId: "edge:field-direct:1",
      edgeType: "FIELD_DIRECT",
      fromNodeId: fieldNodeId,
      toNodeId: targetWriteNodeId,
      properties: {
        outputColumn: input.outputColumn,
        expressionId: "expr:1",
        sourceReadOccurrenceId: input.readOccurrenceId,
        sourceReadOccurrenceStatus: "RESOLVED",
        sourceRelationId: "relation:read:1",
        subtype: "IDENTITY",
      },
    }],
    localClosure: {
      finalWrites: [{
        writeObservationId: input.writeObservationId,
        targetWriteNodeId,
        datasetNodeId: "dataset:target",
        qualifiedName: "warehouse.target_table",
      }],
      externalReads: [],
      localFieldPaths: [],
    },
    gaps: [],
  };
}

describe("resolveReadField", () => {
  const consumerTaskId = "consumer-x";
  const readOccurrenceId = "task:consumer-x:statement:0:relation:root.read.example";
  const column = "amount";

  it("returns CONFIRMED for a unique l1Eligible candidate with producer binding", () => {
    const writeObservationId = "write-observation:producer-a:0";
    const source = createUnionContinuationCandidateSource(index([
      entry(consumerTaskId, readOccurrenceId, [candidate({ writeObservationId })]),
    ]));
    const producerProjection = projectionWithBinding({
      taskId: "producer-a",
      writeObservationId,
      outputColumn: column,
      readOccurrenceId,
    });
    const resolved = resolveReadField({
      consumerTaskId,
      readOccurrenceId,
      column,
      index: source,
      producerIndexForTask: (taskId) =>
        taskId === "producer-a" ? buildFieldEdgeIndex({ projection: producerProjection }) : null,
    });
    expect(resolved.kind).toBe("CONFIRMED");
    if (resolved.kind === "CONFIRMED") {
      expect(resolved.producerEdges).toHaveLength(1);
    }
  });

  it("returns FRONTIER for multiple candidates", () => {
    const source = createUnionContinuationCandidateSource(index([
      entry(consumerTaskId, readOccurrenceId, [
        candidate({ taskId: "producer-a" }),
        candidate({ taskId: "producer-b", writeObservationId: "write-observation:producer-b:0" }),
      ]),
    ]));
    const resolved = resolveReadField({
      consumerTaskId,
      readOccurrenceId,
      column,
      index: source,
      producerIndexForTask: () => null,
    });
    expect(resolved.kind).toBe("FRONTIER");
  });

  it("returns NO_INDEX_ENTRY when the read occurrence is absent", () => {
    const source = createUnionContinuationCandidateSource(index([]));
    const resolved = resolveReadField({
      consumerTaskId,
      readOccurrenceId,
      column,
      index: source,
      producerIndexForTask: () => null,
    });
    expect(resolved.kind).toBe("NO_INDEX_ENTRY");
  });

  it("returns NO_BINDING when producer has no matching field edge", () => {
    const writeObservationId = "write-observation:producer-a:0";
    const source = createUnionContinuationCandidateSource(index([
      entry(consumerTaskId, readOccurrenceId, [candidate({ writeObservationId })]),
    ]));
    const emptyProducer = projectionWithBinding({
      taskId: "producer-a",
      writeObservationId,
      outputColumn: "other-column",
      readOccurrenceId,
    });
    const resolved = resolveReadField({
      consumerTaskId,
      readOccurrenceId,
      column,
      index: source,
      producerIndexForTask: () => buildFieldEdgeIndex({ projection: emptyProducer }),
    });
    expect(resolved.kind).toBe("NO_BINDING");
  });
});
