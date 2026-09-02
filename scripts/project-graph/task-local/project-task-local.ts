import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  indexTaskInputPacks,
  loadPhysicalTableCatalog,
  type PhysicalTableCatalog,
  type PhysicalTableCatalogEntry,
} from "../../machine-facts/input-pack-machine-facts.ts";
import { normalizeName } from "../../machine-facts/machine-facts-contract.ts";
import {
  validateTaskDocument,
  type TaskDocument,
} from "../../input/shared/input-pack.ts";
import {
  loadCurrentTaskBundle,
  type CurrentBundleLoad,
  type JsonRecord,
} from "../../query/current-task-bundle.ts";
import {
  fieldConditionalsForExpression,
  sourceFieldsForExpression,
} from "../../reconcile/consumer/field-lineage/field-lineage.ts";
import {
  datasetControlsForStatement,
} from "../../reconcile/shared/dataset-controls.ts";
import type { PhysicalFieldIdentity } from "../../reconcile/consumer/field-lineage/field-lineage-contract.ts";
import { inferTaskDefaultSchema } from "../../reconcile/shared/task-default-schema.ts";
import {
  buildCollectionFailedProjection,
  buildScheduleOnlyProjection,
  factsEvidenceStatus,
  failureReasonFromLoad,
} from "./coverage.ts";
import {
  canonicalizeTaskLocalProjection,
  type TaskLocalEdge,
  type TaskLocalFailureReasonCode,
  type TaskLocalNode,
  type TaskLocalProjection,
} from "./contract.ts";
import {
  fieldEvidencePhysicalFieldNodeId,
  physicalDatasetNodeId,
  targetWriteNodeId,
  taskLocalEdgeId,
  taskNodeId,
} from "./ids.ts";
import { partitionPredicatesByReadOccurrence } from "./partition-predicates.ts";
import { readTaskScheduleContext } from "./schedule-context.ts";

export interface ProjectTaskLocalOptions {
  readonly factsRoot: string;
  readonly dataRoot: string;
  readonly taskId: string;
  readonly scheduleCacheRoot?: string;
  readonly generatedAt?: string;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function records(value: unknown): readonly JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => typeof item === "object" && item !== null && !Array.isArray(item))
    : [];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function loadTaskPack(
  dataRoot: string,
  catalog: PhysicalTableCatalog,
  taskId: string,
): { document: TaskDocument & JsonRecord; target: PhysicalTableCatalogEntry | null } | null {
  const index = indexTaskInputPacks(dataRoot);
  const paths = index.get(taskId) ?? [];
  const path = paths.length === 1 ? paths[0] : null;
  if (!path) return null;
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  validateTaskDocument(raw);
  const document = raw as TaskDocument & JsonRecord;
  const targetName = text(document.target?.qualifiedName);
  const target = targetName
    ? catalog.byQualifiedName.get(normalizeName(targetName))?.[0] ?? null
    : null;
  return { document, target };
}

function tableIdentity(
  catalog: PhysicalTableCatalog,
  qualifiedName: string,
  fallback: Pick<PhysicalTableCatalogEntry, "platform" | "dataSource">,
): { platform: string | null; dataSource: string | null; qualifiedName: string } {
  const normalized = normalizeName(qualifiedName);
  const matches = catalog.byQualifiedName.get(normalized) ?? [];
  if (matches.length === 1) {
    return {
      platform: matches[0]!.platform,
      dataSource: matches[0]!.dataSource,
      qualifiedName: matches[0]!.qualifiedName,
    };
  }
  return {
    platform: fallback.platform,
    dataSource: fallback.dataSource,
    qualifiedName: normalized,
  };
}

function ensureNode(
  nodes: Map<string, TaskLocalNode>,
  node: TaskLocalNode,
): void {
  if (!nodes.has(node.nodeId)) nodes.set(node.nodeId, node);
}

function ensureFieldNode(
  nodes: Map<string, TaskLocalNode>,
  field: PhysicalFieldIdentity,
): string {
  const nodeId = fieldEvidencePhysicalFieldNodeId(field);
  ensureNode(nodes, {
    nodeId,
    nodeType: "PHYSICAL_FIELD",
    properties: {
      platform: field.platform,
      dataSource: field.dataSource,
      qualifiedName: field.qualifiedName,
      stableTableId: field.stableTableId,
      column: field.column,
    },
  });
  return nodeId;
}

function expressionFor(load: CurrentBundleLoad, binding: JsonRecord): JsonRecord | null {
  const expressionId = text(binding.expression_id);
  if (!expressionId) return null;
  return records(load.records["field-expression-nodes.jsonl"]).find(
    (expression) => text(expression.expression_id) === expressionId,
  ) ?? null;
}

function projectTaskLocalFromFacts(input: {
  readonly taskId: string;
  readonly generatedAt: string;
  readonly load: CurrentBundleLoad;
  readonly evidenceStatus: "CONFIRMED" | "PROVISIONAL_LEGACY";
  readonly dataRoot: string;
}): TaskLocalProjection {
  const { taskId, generatedAt, load, evidenceStatus, dataRoot } = input;
  const catalog = loadPhysicalTableCatalog(dataRoot, { lazyDdl: true });
  const pack = loadTaskPack(dataRoot, catalog, taskId);
  const fallbackTable = pack?.target ?? { platform: "hive", dataSource: "unknown" };
  const defaultSchema = pack ? inferTaskDefaultSchema(pack.document) : null;
  const nodes = new Map<string, TaskLocalNode>();
  const edges: TaskLocalEdge[] = [];
  const edgeIds = new Set<string>();

  const pushEdge = (edge: TaskLocalEdge): void => {
    if (edgeIds.has(edge.edgeId)) return;
    edgeIds.add(edge.edgeId);
    edges.push(edge);
  };

  ensureNode(nodes, {
    nodeId: taskNodeId(taskId),
    nodeType: "TASK",
    properties: pack?.document.taskName ? { taskName: pack.document.taskName } : {},
  });

  const writeRecords = records(load.records["dataset-io.jsonl"]).filter(
    (record) =>
      text(record.task_id) === taskId
      && String(record.direction ?? "").toUpperCase() === "WRITE"
      && text(record.write_observation_id),
  );
  if (writeRecords.length === 0) {
    return buildCollectionFailedProjection({
      taskId,
      generatedAt,
      failureReasonCode: "NO_RESOLVED_WRITE",
      taskProperties: pack?.document.taskName ? { taskName: pack.document.taskName } : {},
    });
  }

  const resolvedBindings = records(load.records["output-field-bindings.jsonl"]).filter(
    (binding) =>
      text(binding.task_id) === taskId
      && binding.binding_status === "RESOLVED"
      && text(binding.write_observation_id),
  );
  const primaryTarget = pack?.target ?? null;
  if (resolvedBindings.length > 0 && !primaryTarget) {
    return buildCollectionFailedProjection({
      taskId,
      generatedAt,
      failureReasonCode: "SCHEMA_UNRESOLVED",
      taskProperties: pack?.document.taskName ? { taskName: pack.document.taskName } : {},
    });
  }

  const targetWriteNodes = new Map<string, string>();
  for (const write of writeRecords) {
    const writeObservationId = text(write.write_observation_id)!;
    const identity = tableIdentity(
      catalog,
      String(write.physical_dataset ?? ""),
      fallbackTable,
    );
    const datasetNodeId = physicalDatasetNodeId(identity);
    ensureNode(nodes, {
      nodeId: datasetNodeId,
      nodeType: "PHYSICAL_DATASET",
      properties: {
        platform: identity.platform,
        dataSource: identity.dataSource,
        qualifiedName: identity.qualifiedName,
      },
    });
    const writeNodeId = targetWriteNodeId({
      taskId,
      datasetNodeId,
      writeObservationId,
    });
    ensureNode(nodes, {
      nodeId: writeNodeId,
      nodeType: "TARGET_WRITE",
      properties: {
        writeObservationId,
        qualifiedName: identity.qualifiedName,
      },
    });
    targetWriteNodes.set(writeObservationId, writeNodeId);
    pushEdge({
      edgeId: taskLocalEdgeId({
        edgeType: "WRITES",
        fromNodeId: taskNodeId(taskId),
        toNodeId: writeNodeId,
        semanticKey: { writeObservationId },
      }),
      edgeType: "WRITES",
      fromNodeId: taskNodeId(taskId),
      toNodeId: writeNodeId,
      properties: { writeObservationId },
    });
    pushEdge({
      edgeId: taskLocalEdgeId({
        edgeType: "WRITES",
        fromNodeId: writeNodeId,
        toNodeId: datasetNodeId,
        semanticKey: { writeObservationId },
      }),
      edgeType: "WRITES",
      fromNodeId: writeNodeId,
      toNodeId: datasetNodeId,
      properties: { writeObservationId },
    });
  }

  const predicatesByOccurrence = partitionPredicatesByReadOccurrence({
    taskId,
    relationRecords: records(load.records["relation-nodes.jsonl"]),
    relationEdgeRecords: records(load.records["relation-edges.jsonl"]),
  });
  for (const read of records(load.records["dataset-io.jsonl"])) {
    if (text(read.task_id) !== taskId || String(read.direction ?? "").toUpperCase() !== "READ") continue;
    const identity = tableIdentity(
      catalog,
      String(read.physical_dataset ?? ""),
      fallbackTable,
    );
    const datasetNodeId = physicalDatasetNodeId(identity);
    ensureNode(nodes, {
      nodeId: datasetNodeId,
      nodeType: "PHYSICAL_DATASET",
      properties: {
        platform: identity.platform,
        dataSource: identity.dataSource,
        qualifiedName: identity.qualifiedName,
      },
    });
    const occurrences = records(read.read_occurrences);
    const readOccurrenceIds = occurrences.length > 0
      ? occurrences.map((occurrence) => ({
        occurrenceId: text(occurrence.occurrence_id),
        relationId: text(occurrence.relation_id) ?? text(occurrence.occurrence_id),
      }))
      : [{ occurrenceId: null, relationId: null }];
    for (const occurrence of readOccurrenceIds) {
      const predicates = occurrence.relationId
        ? predicatesByOccurrence.get(occurrence.relationId) ?? []
        : [];
      pushEdge({
        edgeId: taskLocalEdgeId({
          edgeType: "READS",
          fromNodeId: taskNodeId(taskId),
          toNodeId: datasetNodeId,
          semanticKey: { readOccurrenceId: occurrence.occurrenceId ?? "legacy" },
        }),
        edgeType: "READS",
        fromNodeId: taskNodeId(taskId),
        toNodeId: datasetNodeId,
        properties: {
          ...(occurrence.occurrenceId ? { readOccurrenceId: occurrence.occurrenceId } : {}),
          partitionPredicates: predicates,
        },
      });
    }
  }

  const statementIds = new Set<string>();
  for (const binding of resolvedBindings) {
    const writeObservationId = text(binding.write_observation_id)!;
    const targetWriteNode = targetWriteNodes.get(writeObservationId);
    if (!targetWriteNode || !primaryTarget) continue;
    const outputColumn = normalizeName(String(binding.target_field ?? ""));
    if (!outputColumn) continue;
    const expression = expressionFor(load, binding);
    if (!expression) continue;
    const statementId = text(expression.statement_id);
    if (statementId) statementIds.add(statementId);
    const sources = sourceFieldsForExpression(
      expression,
      catalog,
      load,
      taskId,
      primaryTarget,
      defaultSchema,
    );
    for (const source of sources.fields) {
      const fromNodeId = ensureFieldNode(nodes, source);
      pushEdge({
        edgeId: taskLocalEdgeId({
          edgeType: "FIELD_DIRECT",
          fromNodeId,
          toNodeId: targetWriteNode,
          semanticKey: { outputColumn, sourceColumn: source.column, sourceTable: source.qualifiedName },
        }),
        edgeType: "FIELD_DIRECT",
        fromNodeId,
        toNodeId: targetWriteNode,
        properties: {
          subtype: "UNKNOWN",
          outputColumn,
          bindingId: text(binding.binding_id),
        },
      });
    }
    for (const conditional of fieldConditionalsForExpression(
      load,
      taskId,
      outputColumn,
      expression,
      catalog,
      defaultSchema,
      primaryTarget,
      evidenceStatus,
    )) {
      for (const source of conditional.fields) {
        const fromNodeId = ensureFieldNode(nodes, source);
        pushEdge({
          edgeId: taskLocalEdgeId({
            edgeType: "FIELD_CONDITIONAL",
            fromNodeId,
            toNodeId: targetWriteNode,
            semanticKey: { outputColumn, sourceColumn: source.column, conditionalId: conditional.conditionalId },
          }),
          edgeType: "FIELD_CONDITIONAL",
          fromNodeId,
          toNodeId: targetWriteNode,
          properties: {
            subtype: "CONDITIONAL",
            outputColumn,
          },
        });
      }
    }
  }

  for (const statementId of [...statementIds].sort(compareText)) {
    for (const control of datasetControlsForStatement(
      load,
      taskId,
      statementId,
      catalog,
      defaultSchema,
      primaryTarget ?? fallbackTable,
      evidenceStatus,
    )) {
      if (!control.field) continue;
      const targetWriteNode = [...targetWriteNodes.values()].sort(compareText)[0];
      if (!targetWriteNode) continue;
      const fromNodeId = ensureFieldNode(nodes, control.field);
      pushEdge({
        edgeId: taskLocalEdgeId({
          edgeType: "DATASET_CONTROL",
          fromNodeId,
          toNodeId: targetWriteNode,
          semanticKey: { controlId: control.controlId },
        }),
        edgeType: "DATASET_CONTROL",
        fromNodeId,
        toNodeId: targetWriteNode,
        properties: {
          subtype: control.subtype,
          grain: control.grain,
          ...(control.grainReason ? { grainReason: control.grainReason } : {}),
          relationId: control.relationId,
          statementId: control.statementId,
        },
      });
    }
  }

  return canonicalizeTaskLocalProjection({
    schemaVersion: "1.0.0",
    artifactType: "TASK_LOCAL_PROJECTION",
    generatedAt,
    taskId,
    coverageStatus: "PROJECTED",
    failureReasonCode: null,
    nodes: [...nodes.values()],
    edges,
  });
}

export function projectTaskLocal(options: ProjectTaskLocalOptions): TaskLocalProjection {
  const taskId = options.taskId.trim();
  const factsRoot = resolve(options.factsRoot);
  const dataRoot = resolve(options.dataRoot);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const schedule = readTaskScheduleContext(taskId, options.scheduleCacheRoot);
  const load = loadCurrentTaskBundle(factsRoot, taskId);
  const evidenceStatus = factsEvidenceStatus(load);

  if (!evidenceStatus) {
    if (schedule) {
      return buildScheduleOnlyProjection({ taskId, generatedAt, schedule });
    }
    return buildCollectionFailedProjection({
      taskId,
      generatedAt,
      failureReasonCode: failureReasonFromLoad(load),
    });
  }

  try {
    return projectTaskLocalFromFacts({
      taskId,
      generatedAt,
      load,
      evidenceStatus,
      dataRoot,
    });
  } catch (error) {
    const failureReasonCode: TaskLocalFailureReasonCode =
      error instanceof Error && error.message.startsWith("SCHEMA_UNRESOLVED:")
        ? "SCHEMA_UNRESOLVED"
        : "PROJECTION_FAILED";
    return buildCollectionFailedProjection({
      taskId,
      generatedAt,
      failureReasonCode,
    });
  }
}
