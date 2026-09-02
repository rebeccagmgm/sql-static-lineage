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
  taskNodeProperties,
} from "./coverage.ts";
import {
  canonicalizeTaskLocalProjection,
  type TaskLocalEdge,
  type TaskLocalFailureReasonCode,
  type TaskLocalFieldPathSummary,
  type TaskLocalExternalReadSummary,
  type TaskLocalFinalWriteSummary,
  type TaskLocalNode,
  type TaskLocalProjection,
} from "./contract.ts";
import {
  fieldEvidencePhysicalFieldNodeId,
  physicalDatasetNodeId,
  readOccurrenceNodeId,
  targetWriteNodeId,
  taskLocalEdgeId,
  taskNodeId,
} from "./ids.ts";
import {
  isTempLikeTableName,
  resolveTaskLocalTableIdentity,
  type TaskLocalTableIdentity,
} from "./identity.ts";
import {
  partitionPredicatesByReadOccurrence,
  readPartitionPredicatesForOccurrence,
} from "./partition-predicates.ts";
import { readTaskScheduleContext, type TaskScheduleContext } from "./schedule-context.ts";

export interface ProjectTaskLocalOptions {
  readonly factsRoot: string;
  readonly dataRoot: string;
  readonly taskId: string;
  readonly scheduleCacheRoot?: string;
  readonly generatedAt?: string;
}

// A CLI process projects many tasks against one immutable Pack/catalog snapshot.
// Cache only directory indexes; file contents and Facts remain per-task reads.
const physicalCatalogCache = new Map<string, PhysicalTableCatalog>();
const taskPackIndexCache = new Map<string, ReadonlyMap<string, readonly string[]>>();

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
  const index = taskPackIndexCache.get(dataRoot)
    ?? (() => {
      const next = indexTaskInputPacks(dataRoot);
      taskPackIndexCache.set(dataRoot, next);
      return next;
    })();
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

function ensureNode(
  nodes: Map<string, TaskLocalNode>,
  node: TaskLocalNode,
): void {
  if (!nodes.has(node.nodeId)) nodes.set(node.nodeId, node);
}

function ensureFieldNode(
  nodes: Map<string, TaskLocalNode>,
  field: PhysicalFieldIdentity,
  catalog: PhysicalTableCatalog,
): string {
  const nodeId = fieldEvidencePhysicalFieldNodeId(field);
  const identity = resolveTaskLocalTableIdentity({
    catalog,
    rawName: field.qualifiedName,
    defaultSchema: null,
    fallback: field,
  });
  ensureNode(nodes, {
    nodeId,
    nodeType: "PHYSICAL_FIELD",
    properties: {
      platform: field.platform,
      dataSource: field.dataSource,
      qualifiedName: field.qualifiedName,
      stableTableId: field.stableTableId,
      column: field.column,
      identityStatus: identity.identityStatus,
      ...(identity.qualificationStatus
        ? { qualificationStatus: identity.qualificationStatus }
        : {}),
      ...(identity.identityReasonCode
        ? { identityReasonCode: identity.identityReasonCode }
        : {}),
    },
  });
  return nodeId;
}

function datasetProperties(identity: TaskLocalTableIdentity): Record<string, unknown> {
  return {
    platform: identity.platform,
    dataSource: identity.dataSource,
    qualifiedName: identity.qualifiedName,
    identityStatus: identity.identityStatus,
    ...(identity.qualificationStatus
      ? { qualificationStatus: identity.qualificationStatus }
      : {}),
    ...(identity.identityReasonCode
      ? { identityReasonCode: identity.identityReasonCode }
      : {}),
  };
}

function ensureDatasetNode(
  nodes: Map<string, TaskLocalNode>,
  identity: TaskLocalTableIdentity,
): string {
  const nodeId = physicalDatasetNodeId(identity);
  ensureNode(nodes, {
    nodeId,
    nodeType: "PHYSICAL_DATASET",
    properties: datasetProperties(identity),
  });
  return nodeId;
}

function materializationKey(dataset: string, column: string): string {
  return `${normalizeName(dataset)}\u0000${normalizeName(column)}`;
}

function isFinalWrite(
  physicalDataset: string,
  targetQualifiedName: string | null,
  writeKind: string | null,
): boolean {
  if (writeKind?.toUpperCase() === "CREATE_TABLE") return false;
  const normalized = normalizeName(physicalDataset);
  if (targetQualifiedName) return normalized === normalizeName(targetQualifiedName);
  return !isTempLikeTableName(normalized);
}

function taskLocalSourceFieldsForExpression(
  expression: JsonRecord,
  catalog: PhysicalTableCatalog,
  load: CurrentBundleLoad,
  taskId: string,
  taskTarget: PhysicalTableCatalogEntry,
  defaultSchema: ReturnType<typeof inferTaskDefaultSchema>,
): ReturnType<typeof sourceFieldsForExpression> {
  const result = sourceFieldsForExpression(
    expression,
    catalog,
    load,
    taskId,
    taskTarget,
    defaultSchema,
  );
  // The legacy resolver can use a unique catalog tail when no task schema exists.
  // Keep task-local projection fail-closed for that one case; task-local schema-backed
  // fields remain valid evidence.
  if (defaultSchema !== null) return result;
  const bareInputTables = new Set(
    records(expression.input_fields)
      .map((input) => normalizeName(String(input.table ?? "")))
      .filter((table) => table !== "" && !table.includes(".")),
  );
  if (bareInputTables.size === 0) return result;
  return {
    ...result,
    fields: result.fields.filter(
      (field) =>
        field.identityStatus === "TASK_LOCAL_SCHEMA_BACKED"
        || !bareInputTables.has(normalizeName(field.qualifiedName.split(".").at(-1) ?? "")),
    ),
  };
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
  readonly schedule: TaskScheduleContext | null;
}): TaskLocalProjection {
  const { taskId, generatedAt, load, evidenceStatus, dataRoot, schedule } = input;
  const catalog = physicalCatalogCache.get(dataRoot)
    ?? (() => {
      const next = loadPhysicalTableCatalog(dataRoot, { lazyDdl: true });
      physicalCatalogCache.set(dataRoot, next);
      return next;
    })();
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
    properties: taskNodeProperties({
      packTaskName: pack?.document.taskName ?? null,
      schedule,
    }),
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
      taskProperties: taskNodeProperties({
        packTaskName: pack?.document.taskName ?? null,
        schedule,
      }),
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
      taskProperties: taskNodeProperties({
        packTaskName: pack?.document.taskName ?? null,
        schedule,
      }),
    });
  }

  const writeObservationByStatement = new Map<string, string>();
  for (const write of writeRecords) {
    const writeObservationId = text(write.write_observation_id)!;
    const statementId =
      text(write.write_statement_id)
      ?? text(write.statement_id);
    if (statementId) writeObservationByStatement.set(statementId, writeObservationId);
  }
  for (const binding of resolvedBindings) {
    const writeObservationId = text(binding.write_observation_id);
    const statementId =
      text(binding.write_statement_id)
      ?? text(binding.statement_id);
    if (writeObservationId && statementId && !writeObservationByStatement.has(statementId)) {
      writeObservationByStatement.set(statementId, writeObservationId);
    }
  }

  const outputBindings = records(load.records["output-field-bindings.jsonl"]);
  const bindingById = new Map(
    outputBindings
      .map((binding) => [text(binding.binding_id), binding] as const)
      .filter((entry): entry is readonly [string, JsonRecord] => entry[0] !== null),
  );
  const materializationRecords = records(load.records["task-local-materializations.jsonl"])
    .filter((record) => text(record.task_id) === taskId);
  const materializationsByField = new Map<string, JsonRecord[]>();
  for (const materialization of materializationRecords) {
    const dataset = text(materialization.physical_dataset);
    const column = text(materialization.column);
    if (!dataset || !column) continue;
    const key = materializationKey(dataset, column);
    const values = materializationsByField.get(key) ?? [];
    values.push(materialization);
    materializationsByField.set(key, values);
  }

  const targetWriteNodes = new Map<string, string>();
  const finalWriteSummaries: TaskLocalFinalWriteSummary[] = [];
  const finalDatasetNames = new Set<string>();
  for (const write of writeRecords) {
    const writeObservationId = text(write.write_observation_id)!;
    const identity = resolveTaskLocalTableIdentity({
      catalog,
      rawName: String(write.physical_dataset ?? ""),
      defaultSchema,
      fallback: fallbackTable,
    });
    const datasetNodeId = ensureDatasetNode(nodes, identity);
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
    if (
      isFinalWrite(
        identity.qualifiedName,
        pack?.target?.qualifiedName ?? null,
        text(write.write_kind),
      )
    ) {
      finalDatasetNames.add(identity.qualifiedName);
      finalWriteSummaries.push({
        writeObservationId,
        targetWriteNodeId: writeNodeId,
        datasetNodeId,
        qualifiedName: identity.qualifiedName,
      });
    }
  }

  const predicatesByOccurrence = partitionPredicatesByReadOccurrence({
    taskId,
    relationRecords: records(load.records["relation-nodes.jsonl"]),
    relationEdgeRecords: records(load.records["relation-edges.jsonl"]),
  });
  const externalReadSummaries: TaskLocalExternalReadSummary[] = [];
  for (const read of records(load.records["dataset-io.jsonl"])) {
    if (text(read.task_id) !== taskId || String(read.direction ?? "").toUpperCase() !== "READ") continue;
    const baseIdentity = resolveTaskLocalTableIdentity({
      catalog,
      rawName: String(read.physical_dataset ?? ""),
      defaultSchema,
      fallback: fallbackTable,
    });
    const rawReadDataset = normalizeName(String(read.physical_dataset ?? ""));
    const datasetMaterializations = materializationRecords.filter((materialization) => {
      const materializedDataset = normalizeName(String(materialization.physical_dataset ?? ""));
      return materializedDataset === rawReadDataset
        || materializedDataset === baseIdentity.qualifiedName;
    });
    const identity = isTempLikeTableName(rawReadDataset) && datasetMaterializations.length === 0
      ? {
        ...baseIdentity,
        identityStatus: "CANDIDATE_DATASET" as const,
        identityReasonCode: "TEMP_MATERIALIZATION_MISSING",
      }
      : baseIdentity;
    const datasetNodeId = ensureDatasetNode(nodes, identity);
    const hasResolvedMaterialization = datasetMaterializations.some(
      (materialization) => String(materialization.status ?? "").toUpperCase() === "RESOLVED",
    );
    const hasUnresolvedMaterialization = datasetMaterializations.some(
      (materialization) => String(materialization.status ?? "").toUpperCase() !== "RESOLVED",
    );
    const occurrences = records(read.read_occurrences);
    const readOccurrenceIds = occurrences.length > 0
      ? occurrences.map((occurrence, index) => ({
        occurrenceId: text(occurrence.occurrence_id)
          ?? `legacy:${taskId}:${text(read.statement_id) ?? "statement"}:${identity.qualifiedName}:${index}`,
        relationId: text(occurrence.relation_id) ?? text(occurrence.occurrence_id),
      }))
      : [{
        occurrenceId: `legacy:${taskId}:${text(read.statement_id) ?? "statement"}:${identity.qualifiedName}:0`,
        relationId: null,
      }];
    for (const [occurrenceIndex, occurrence] of readOccurrenceIds.entries()) {
      const partition = readPartitionPredicatesForOccurrence(
        predicatesByOccurrence,
        occurrence.relationId,
      );
      const selfRead = finalDatasetNames.has(identity.qualifiedName);
      const readDisposition = selfRead
        ? "SELF_READ"
        : hasResolvedMaterialization && !hasUnresolvedMaterialization
        ? "LOCAL_MATERIALIZATION"
        : "EXTERNAL_READ";
      const occurrenceNodeId = readOccurrenceNodeId({
        consumerTaskId: taskId,
        occurrenceId: occurrence.occurrenceId,
        readRelationId: occurrence.relationId ?? `${identity.qualifiedName}:${occurrenceIndex}`,
      });
      ensureNode(nodes, {
        nodeId: occurrenceNodeId,
        nodeType: "READ_OCCURRENCE",
        properties: {
          taskId,
          occurrenceId: occurrence.occurrenceId,
          relationId: occurrence.relationId,
          statementId: text(read.statement_id),
          datasetNodeId,
          physicalDataset: identity.qualifiedName,
          identityStatus: identity.identityStatus,
          ...(identity.qualificationStatus
            ? { qualificationStatus: identity.qualificationStatus }
            : {}),
          ...(identity.identityReasonCode
            ? { identityReasonCode: identity.identityReasonCode }
            : {}),
          readDisposition,
          partitionPredicates: partition.predicates,
          partitionPredicateStatus: partition.status,
          ...(hasUnresolvedMaterialization
            ? { materializationBoundaryReason: "MATERIALIZATION_NOT_RESOLVED" }
            : {}),
        },
      });
      pushEdge({
        edgeId: taskLocalEdgeId({
          edgeType: "READS",
          fromNodeId: taskNodeId(taskId),
          toNodeId: occurrenceNodeId,
          semanticKey: { readOccurrenceId: occurrence.occurrenceId },
        }),
        edgeType: "READS",
        fromNodeId: taskNodeId(taskId),
        toNodeId: occurrenceNodeId,
        properties: {
          readOccurrenceId: occurrence.occurrenceId,
          readDisposition,
        },
      });
      pushEdge({
        edgeId: taskLocalEdgeId({
          edgeType: "READS",
          fromNodeId: occurrenceNodeId,
          toNodeId: datasetNodeId,
          semanticKey: { readOccurrenceId: occurrence.occurrenceId },
        }),
        edgeType: "READS",
        fromNodeId: occurrenceNodeId,
        toNodeId: datasetNodeId,
        properties: {
          readOccurrenceId: occurrence.occurrenceId,
          partitionPredicates: partition.predicates,
          partitionPredicateStatus: partition.status,
          readDisposition,
        },
      });
      if (readDisposition === "EXTERNAL_READ") {
        externalReadSummaries.push({
          readOccurrenceId: occurrence.occurrenceId,
          readOccurrenceNodeId: occurrenceNodeId,
          datasetNodeId,
          qualifiedName: identity.qualifiedName,
          identityStatus: identity.identityStatus,
        });
      }
    }
  }

  type ExpandedSource = {
    readonly field: PhysicalFieldIdentity;
    readonly materializationBridgeIds: readonly string[];
  };
  const expandedMaterializationMemo = new Map<string, ExpandedSource[]>();
  const expandMaterializedField = (
    source: PhysicalFieldIdentity,
    visited: ReadonlySet<string> = new Set(),
  ): ExpandedSource[] => {
    const key = materializationKey(source.qualifiedName, source.column);
    if (visited.size === 0) {
      const cached = expandedMaterializationMemo.get(key);
      if (cached) return cached;
    }
    const resolved = (materializationsByField.get(key) ?? []).filter(
      (materialization) =>
        String(materialization.status ?? "").toUpperCase() === "RESOLVED"
        && text(materialization.output_binding_id),
    );
    if (resolved.length !== 1 || !primaryTarget || visited.has(key)) {
      const result = [{ field: source, materializationBridgeIds: [] }];
      if (visited.size === 0) expandedMaterializationMemo.set(key, result);
      return result;
    }
    const materialization = resolved[0]!;
    const binding = bindingById.get(text(materialization.output_binding_id)!);
    const expression = binding ? expressionFor(load, binding) : null;
    if (!expression) {
      const result = [{ field: source, materializationBridgeIds: [] }];
      if (visited.size === 0) expandedMaterializationMemo.set(key, result);
      return result;
    }
    const underlying = taskLocalSourceFieldsForExpression(
      expression,
      catalog,
      load,
      taskId,
      primaryTarget,
      defaultSchema,
    );
    if (underlying.fields.length === 0) {
      const result = [{ field: source, materializationBridgeIds: [] }];
      if (visited.size === 0) expandedMaterializationMemo.set(key, result);
      return result;
    }
    const nextVisited = new Set(visited);
    nextVisited.add(key);
    const result = underlying.fields.flatMap((field) =>
      expandMaterializedField(field, nextVisited).map((expanded) => ({
        field: expanded.field,
        materializationBridgeIds: [
          text(materialization.bridge_id) ?? "",
          ...expanded.materializationBridgeIds,
        ].filter(Boolean),
      })),
    );
    if (visited.size === 0) expandedMaterializationMemo.set(key, result);
    return result;
  };

  const localFieldPaths: TaskLocalFieldPathSummary[] = [];
  const localFieldPathKeys = new Set<string>();
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
    const sources = taskLocalSourceFieldsForExpression(
      expression,
      catalog,
      load,
      taskId,
      primaryTarget,
      defaultSchema,
    );
    for (const source of sources.fields.flatMap((field) => expandMaterializedField(field))) {
      const fromNodeId = ensureFieldNode(nodes, source.field, catalog);
      const bridgeIds = [...new Set(source.materializationBridgeIds)].sort(compareText);
      pushEdge({
        edgeId: taskLocalEdgeId({
          edgeType: "FIELD_DIRECT",
          fromNodeId,
          toNodeId: targetWriteNode,
          semanticKey: {
            outputColumn,
            sourceColumn: source.field.column,
            sourceTable: source.field.qualifiedName,
          },
        }),
        edgeType: "FIELD_DIRECT",
        fromNodeId,
        toNodeId: targetWriteNode,
        properties: {
          subtype: "UNKNOWN",
          outputColumn,
          bindingId: text(binding.binding_id),
          ...(bridgeIds.length > 0
            ? { materializationBridgeIds: bridgeIds, materializationFolded: true }
            : {}),
        },
      });
      if (bridgeIds.length > 0) {
        const pathKey = `${fromNodeId}|${targetWriteNode}|${outputColumn}`;
        if (!localFieldPathKeys.has(pathKey)) {
          localFieldPathKeys.add(pathKey);
          localFieldPaths.push({
            sourceFieldNodeId: fromNodeId,
            targetWriteNodeId: targetWriteNode,
            outputColumn,
            materializationBridgeIds: bridgeIds,
          });
        }
      }
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
        const fromNodeId = ensureFieldNode(nodes, source, catalog);
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

  for (const statementId of writeObservationByStatement.keys()) {
    statementIds.add(statementId);
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
      const writeObservationId =
        writeObservationByStatement.get(control.statementId)
        ?? writeObservationByStatement.get(statementId);
      const targetWriteNode = writeObservationId
        ? targetWriteNodes.get(writeObservationId)
        : undefined;
      if (!targetWriteNode) continue;
      const fromNodeId = ensureFieldNode(nodes, control.field, catalog);
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
          writeObservationId,
        },
      });
    }
  }

  return canonicalizeTaskLocalProjection({
    schemaVersion: "1.2.0",
    artifactType: "TASK_LOCAL_PROJECTION",
    generatedAt,
    taskId,
    coverageStatus: "PROJECTED",
    failureReasonCode: null,
    nodes: [...nodes.values()],
    edges,
    localClosure: {
      finalWrites: [...finalWriteSummaries].sort((left, right) =>
        compareText(left.writeObservationId, right.writeObservationId),
      ),
      externalReads: [...externalReadSummaries].sort((left, right) =>
        compareText(left.readOccurrenceId, right.readOccurrenceId),
      ),
      localFieldPaths: [...localFieldPaths].sort((left, right) =>
        compareText(
          `${left.targetWriteNodeId}|${left.outputColumn}|${left.sourceFieldNodeId}`,
          `${right.targetWriteNodeId}|${right.outputColumn}|${right.sourceFieldNodeId}`,
        ),
      ),
    },
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
      schedule,
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
