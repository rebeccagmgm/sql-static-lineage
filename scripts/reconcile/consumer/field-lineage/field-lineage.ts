import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import {
  loadPhysicalTableCatalog,
  physicalTableKey,
  type PhysicalTableCatalog,
  type PhysicalTableCatalogEntry,
} from "../../../machine-facts/input-pack-machine-facts.ts";
import { normalizeName } from "../../../machine-facts/machine-facts-contract.ts";
import {
  validateTaskDocument,
  type TaskDocument,
} from "../../../input/shared/input-pack.ts";
import {
  loadCurrentTaskBundle,
  type CurrentBundleLoad,
  type JsonRecord,
} from "../../../query/current-task-bundle.ts";
import {
  FIELD_LINEAGE_ARTIFACT_TYPE,
  FIELD_LINEAGE_SCHEMA_VERSION,
  canonicalizeFieldLineageArtifact,
  physicalFieldKey,
  type FactsPolicy,
  type FieldLineageArtifact,
  type FieldLineageEdge,
  type FieldLineageGap,
  type FieldLineageNode,
  type FieldLineageTableEdge,
  type FieldProducerCandidate,
  type PhysicalFieldIdentity,
  type RowsetControlAnnotation,
} from "./field-lineage-contract.ts";

type TaskPack = {
  readonly document: TaskDocument & JsonRecord;
  readonly path: string;
  readonly target: PhysicalTableCatalogEntry | null;
};

type TableLineageArtifact = JsonRecord & {
  readonly rootTaskId?: string;
  readonly generatedAt?: string;
  readonly taskNodes?: readonly JsonRecord[];
  readonly producerBridges?: readonly JsonRecord[];
  readonly readEdges?: readonly JsonRecord[];
  readonly scheduleEdges?: readonly JsonRecord[];
};

export interface ReconcileFieldLineageOptions {
  readonly dataRoot: string;
  readonly factsRoot: string;
  readonly tableLineage: TableLineageArtifact;
  readonly rootTaskId: string;
  readonly rootTable: string;
  readonly rootFields: readonly string[];
  readonly factsPolicy: FactsPolicy;
  readonly maxDepth: number;
  readonly maxStates: number;
  readonly maxPaths: number;
  readonly now?: () => string;
}

type TraversalState = {
  readonly taskId: string;
  readonly field: PhysicalFieldIdentity;
  readonly bindingId: string | null;
  readonly nodeId: string | null;
  readonly depth: number;
  readonly active: ReadonlySet<string>;
  readonly incoming: {
    readonly sourceNodeId: string;
    readonly consumerTaskId: string;
    readonly producerTaskId: string | null;
    readonly evidenceStatus: "CONFIRMED" | "PROVISIONAL_LEGACY";
  } | null;
};

const CONTROL_TYPES = new Set([
  "filter",
  "join",
  "aggregate",
  "setop",
  "window",
  "distinct",
]);

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "-" ? null : trimmed;
}

function discoverTaskPaths(dataRoot: string): string[] {
  const root = join(dataRoot, "tasks");
  if (!existsSync(root)) return [];
  const result: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
      (left, right) => compareText(left.name, right.name),
    )) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === "task.json") result.push(path);
    }
  };
  visit(root);
  return result.sort(compareText);
}

function taskTarget(
  document: TaskDocument & JsonRecord,
  catalog: PhysicalTableCatalog,
): PhysicalTableCatalogEntry | null {
  const target = asRecord(document.target);
  const platform = nonEmpty(target?.platform);
  const dataSource = nonEmpty(target?.dataSource);
  const qualifiedName = nonEmpty(target?.qualifiedName);
  if (!platform || !dataSource || !qualifiedName) return null;
  return (
    catalog.byPhysicalKey.get(
      physicalTableKey({ platform, dataSource, qualifiedName }),
    ) ?? null
  );
}

function loadTaskPacks(
  dataRoot: string,
  catalog: PhysicalTableCatalog,
): ReadonlyMap<string, TaskPack> {
  const grouped = new Map<string, TaskPack[]>();
  for (const path of discoverTaskPaths(dataRoot)) {
    try {
      const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
      validateTaskDocument(raw);
      const document = raw as TaskDocument & JsonRecord;
      const values = grouped.get(document.taskId) ?? [];
      values.push({ document, path, target: taskTarget(document, catalog) });
      grouped.set(document.taskId, values);
    } catch {
      // Invalid packs remain unavailable to the field consumer. Their status is
      // surfaced when a lineage branch tries to enter the Task.
    }
  }
  return new Map(
    [...grouped.entries()]
      .filter(([, values]) => values.length === 1)
      .map(([taskId, values]) => [taskId, values[0]!]),
  );
}

function excludedTaskDetail(
  dataRoot: string,
  taskId: string,
): { reason: string; evidence: string[] } | null {
  const statusPath = `${resolve(dataRoot)}.input-pack-status.json`;
  if (!existsSync(statusPath)) return null;
  try {
    const status = JSON.parse(readFileSync(statusPath, "utf8")) as JsonRecord;
    const task = asRecord(asRecord(status.tasks)?.[taskId]);
    if (!task || task.status !== "EXCLUDED") return null;
    return {
      reason: nonEmpty(task.exclusionReason) ?? "EXCLUDED",
      evidence: [statusPath],
    };
  } catch {
    return null;
  }
}

function physicalField(
  table: PhysicalTableCatalogEntry,
  columnInput: string,
): PhysicalFieldIdentity | null {
  const column = normalizeName(columnInput);
  if (!table.columns.some((candidate) => normalizeName(candidate) === column))
    return null;
  return {
    platform: table.platform,
    dataSource: table.dataSource,
    stableTableId: table.stableTableId,
    qualifiedName: table.qualifiedName,
    column,
    identityStatus: "SCHEMA_BACKED",
  };
}

function nodeId(
  taskId: string,
  field: PhysicalFieldIdentity,
  bindingId: string | null,
): string {
  return `field-node:${taskId}:${physicalFieldKey(field)}:${bindingId ?? "unresolved"}`;
}

function sourceNodeId(
  taskId: string,
  field: PhysicalFieldIdentity,
  bindingId: string,
): string {
  return `field-source-node:${taskId}:${physicalFieldKey(field)}:${bindingId}`;
}

function stateKey(
  taskId: string,
  field: PhysicalFieldIdentity,
  bindingId: string,
): string {
  return `${taskId}|${physicalFieldKey(field)}|${bindingId}`;
}

function factsStatus(
  load: CurrentBundleLoad,
  policy: FactsPolicy,
): "CONFIRMED" | "PROVISIONAL_LEGACY" | null {
  if (load.state === "CURRENT_L1") return "CONFIRMED";
  if (load.state === "LEGACY_NOT_L1" && policy === "allow-legacy-partial")
    return "PROVISIONAL_LEGACY";
  return null;
}

function targetBindings(
  load: CurrentBundleLoad,
  targetQualifiedName: string,
  field: PhysicalFieldIdentity,
): JsonRecord[] {
  return (load.records["output-field-bindings.jsonl"] ?? [])
    .filter(
      (binding) =>
        normalizeName(String(binding.target_dataset ?? "")) ===
          normalizeName(targetQualifiedName) &&
        normalizeName(String(binding.target_field ?? "")) === field.column &&
        binding.binding_status === "RESOLVED",
    )
    .sort((left, right) =>
      compareText(
        String(left.binding_id ?? ""),
        String(right.binding_id ?? ""),
      ),
    );
}

function expressionFor(
  load: CurrentBundleLoad,
  binding: JsonRecord,
): JsonRecord | null {
  return (
    (load.records["field-expression-nodes.jsonl"] ?? []).find(
      (expression) => expression.expression_id === binding.expression_id,
    ) ?? null
  );
}

function sourceFields(
  expression: JsonRecord,
  catalog: PhysicalTableCatalog,
  load: CurrentBundleLoad,
  taskId: string,
  taskTarget: PhysicalTableCatalogEntry,
): {
  fields: PhysicalFieldIdentity[];
  unresolved: { table: string; column: string; reason: string }[];
} {
  const fields = new Map<string, PhysicalFieldIdentity>();
  const unresolved: { table: string; column: string; reason: string }[] = [];
  for (const raw of Array.isArray(expression.input_fields)
    ? expression.input_fields
    : []) {
    const input = asRecord(raw);
    const tableName = normalizeName(String(input?.table ?? ""));
    const column = normalizeName(String(input?.column ?? ""));
    if (!tableName || !column) continue;
    const exact = catalog.byQualifiedName.get(tableName) ?? [];
    const tailMatches = tableName.includes(".")
      ? []
      : catalog.entries.filter(
          (entry) =>
            normalizeName(entry.qualifiedName).split(".").at(-1) === tableName,
        );
    const tables =
      exact.length > 0 ? exact : tailMatches.length === 1 ? tailMatches : [];
    if (tables.length !== 1) {
      const localSchemas = (load.records["schema-refs.jsonl"] ?? []).filter(
        (record) =>
          normalizeName(String(record.qualified_name ?? "")) === tableName &&
          String(record.source ?? "").startsWith(
            `input-pack-task-local-ctas:${taskId}:`,
          ) &&
          Array.isArray(record.physical_columns) &&
          record.physical_columns
            .map((value) => normalizeName(String(value)))
            .includes(column),
      );
      if (localSchemas.length === 1) {
        const field: PhysicalFieldIdentity = {
          platform: taskTarget.platform,
          dataSource: taskTarget.dataSource,
          stableTableId: `task-local:${taskId}:${tableName}`,
          qualifiedName: tableName,
          column,
          identityStatus: "TASK_LOCAL_SCHEMA_BACKED",
        };
        fields.set(physicalFieldKey(field), field);
        continue;
      }
      unresolved.push({
        table: tableName,
        column,
        reason:
          tables.length === 0
            ? "SOURCE_TABLE_PACK_MISSING"
            : "SOURCE_TABLE_IDENTITY_AMBIGUOUS",
      });
      continue;
    }
    const field = physicalField(tables[0]!, column);
    if (!field)
      unresolved.push({
        table: tableName,
        column,
        reason: "SOURCE_FIELD_NOT_IN_SCHEMA",
      });
    else fields.set(physicalFieldKey(field), field);
  }
  return {
    fields: [...fields.values()].sort((left, right) =>
      compareText(physicalFieldKey(left), physicalFieldKey(right)),
    ),
    unresolved: unresolved.sort((left, right) =>
      compareText(
        `${left.table}.${left.column}`,
        `${right.table}.${right.column}`,
      ),
    ),
  };
}

function lineageDecisions(tableLineage: TableLineageArtifact): ReadonlyMap<
  string,
  {
    primary: readonly string[];
    additional: readonly string[];
    unknown: readonly string[];
  }
> {
  const result = new Map<
    string,
    {
      primary: readonly string[];
      additional: readonly string[];
      unknown: readonly string[];
    }
  >();
  for (const raw of Array.isArray(tableLineage.taskNodes)
    ? tableLineage.taskNodes
    : []) {
    const node = asRecord(raw);
    const taskId = nonEmpty(node?.taskId);
    const decision = asRecord(node?.upstreamDecision);
    if (!taskId || !decision) continue;
    const values = (key: string): string[] =>
      (Array.isArray(decision[key]) ? decision[key] : [])
        .map(String)
        .filter(Boolean)
        .sort(compareText);
    result.set(taskId, {
      primary: values("primary"),
      additional: values("additional"),
      unknown: values("unknown"),
    });
  }
  return result;
}

function bridgeMatches(
  tableLineage: TableLineageArtifact,
  consumerTaskId: string,
  producerTaskId: string,
  field: PhysicalFieldIdentity,
): boolean {
  const bridges = Array.isArray(tableLineage.producerBridges)
    ? tableLineage.producerBridges
    : [];
  const relevant = bridges.filter((raw) => {
    const bridge = asRecord(raw);
    return (
      bridge?.consumerTaskId === consumerTaskId &&
      bridge?.producerTaskId === producerTaskId
    );
  });
  if (relevant.length === 0) return false;
  return relevant.some((raw) => {
    const table = asRecord(asRecord(raw)?.table);
    return (
      normalizeName(String(table?.qualifiedName ?? "")) ===
        normalizeName(field.qualifiedName) &&
      normalizeName(String(table?.platform ?? "")) ===
        normalizeName(field.platform) &&
      normalizeName(String(table?.dataSource ?? "")) ===
        normalizeName(field.dataSource)
    );
  });
}

function producerMatchesField(
  tableLineage: TableLineageArtifact,
  taskPacks: ReadonlyMap<string, TaskPack>,
  consumerTaskId: string,
  producerTaskId: string,
  field: PhysicalFieldIdentity,
): boolean {
  const target = taskPacks.get(producerTaskId)?.target;
  if (target !== null && target !== undefined) {
    const targetField = physicalField(target, field.column);
    if (
      targetField !== null &&
      physicalFieldKey(targetField) === physicalFieldKey(field)
    )
      return true;
    if (physicalTableKey(target) === physicalTableKey(field)) return false;
  }
  if (bridgeMatches(tableLineage, consumerTaskId, producerTaskId, field))
    return true;

  // A schedule-fallback parent can be surfaced as an unresolved stop only
  // when the table artifact proves both a single primary parent and a single
  // eligible consumer read.  This does not claim a producer field bridge; it
  // merely lets the traversal report the unavailable/excluded parent instead
  // of silently dropping the scheduler evidence.
  const decision = lineageDecisions(tableLineage).get(consumerTaskId);
  if (decision?.primary.length !== 1 || decision.primary[0] !== producerTaskId)
    return false;
  const hasScheduleEdge = (
    Array.isArray(tableLineage.scheduleEdges) ? tableLineage.scheduleEdges : []
  ).some((raw) => {
    const edge = asRecord(raw);
    return (
      edge?.consumerTaskId === consumerTaskId &&
      edge?.producerTaskId === producerTaskId
    );
  });
  if (!hasScheduleEdge) return false;
  const eligibleReads = (
    Array.isArray(tableLineage.readEdges) ? tableLineage.readEdges : []
  ).filter((raw) => {
    const edge = asRecord(raw);
    return (
      edge?.consumerTaskId === consumerTaskId &&
      edge?.recursionStatus === "ELIGIBLE"
    );
  });
  if (eligibleReads.length !== 1) return false;
  const table = asRecord(eligibleReads[0]?.table);
  return (
    normalizeName(String(table?.qualifiedName ?? "")) ===
      normalizeName(field.qualifiedName) &&
    normalizeName(String(table?.platform ?? "")) ===
      normalizeName(field.platform) &&
    normalizeName(String(table?.dataSource ?? "")) ===
      normalizeName(field.dataSource)
  );
}

function collectPhysicalPairs(
  value: unknown,
  output: { table: string; column: string }[] = [],
): { table: string; column: string }[] {
  if (Array.isArray(value)) {
    for (const item of value) collectPhysicalPairs(item, output);
    return output;
  }
  const record = asRecord(value);
  if (!record) return output;
  if (nonEmpty(record.table) && nonEmpty(record.column))
    output.push({
      table: normalizeName(String(record.table)),
      column: normalizeName(String(record.column)),
    });
  for (const child of Object.values(record))
    collectPhysicalPairs(child, output);
  return output;
}

function physicalTablesForReference(
  catalog: PhysicalTableCatalog,
  tableName: string,
): readonly PhysicalTableCatalogEntry[] {
  const normalized = normalizeName(tableName);
  const exact = catalog.byQualifiedName.get(normalized) ?? [];
  if (exact.length > 0 || normalized.includes(".")) return exact;
  return catalog.entries.filter(
    (entry) =>
      normalizeName(entry.qualifiedName).split(".").at(-1) === normalized,
  );
}

function taskLocalPhysicalField(
  load: CurrentBundleLoad,
  node: FieldLineageNode,
  pair: { table: string; column: string },
): PhysicalFieldIdentity | null {
  const matches = (load.records["schema-refs.jsonl"] ?? []).filter(
    (record) =>
      normalizeName(String(record.qualified_name ?? "")) === pair.table &&
      String(record.source ?? "").startsWith(
        `input-pack-task-local-ctas:${node.taskId}:`,
      ) &&
      Array.isArray(record.physical_columns) &&
      record.physical_columns
        .map((value) => normalizeName(String(value)))
        .includes(pair.column),
  );
  if (matches.length !== 1) return null;
  return {
    platform: node.field.platform,
    dataSource: node.field.dataSource,
    stableTableId: `task-local:${node.taskId}:${pair.table}`,
    qualifiedName: pair.table,
    column: pair.column,
    identityStatus: "TASK_LOCAL_SCHEMA_BACKED",
  };
}

function rowsetControlsFor(
  load: CurrentBundleLoad,
  node: FieldLineageNode,
  expression: JsonRecord,
  catalog: PhysicalTableCatalog,
  status: "CONFIRMED" | "PROVISIONAL_LEGACY",
): RowsetControlAnnotation[] {
  const relationById = new Map(
    (load.records["relation-nodes.jsonl"] ?? []).map((relation) => [
      String(relation.relation_id),
      relation,
    ]),
  );
  const incoming = new Map<string, string[]>();
  for (const edge of load.records["relation-edges.jsonl"] ?? []) {
    const to = String(edge.to_relation_id ?? "");
    const from = String(edge.from_relation_id ?? "");
    if (!to || !from) continue;
    const values = incoming.get(to) ?? [];
    values.push(from);
    incoming.set(to, values);
  }
  const ancestry = new Set<string>();
  const frontier = [String(expression.relation_id ?? "")].filter(Boolean);
  while (frontier.length > 0) {
    const current = frontier.shift()!;
    if (ancestry.has(current)) continue;
    ancestry.add(current);
    frontier.push(...(incoming.get(current) ?? []));
  }
  const statementId = String(expression.statement_id ?? "");
  const allControls = [...relationById.values()].filter(
    (relation) =>
      relation.statement_id === statementId &&
      CONTROL_TYPES.has(String(relation.relation_type).toLowerCase()),
  );
  const output: RowsetControlAnnotation[] = [];
  for (const relation of allControls.filter((item) =>
    ancestry.has(String(item.relation_id)),
  )) {
    const fields = new Map<string, PhysicalFieldIdentity>();
    let unresolved = false;
    for (const pair of collectPhysicalPairs(relation.relation)) {
      const tables = physicalTablesForReference(catalog, pair.table);
      const field =
        tables.length === 1
          ? physicalField(tables[0]!, pair.column)
          : tables.length === 0
            ? taskLocalPhysicalField(load, node, pair)
            : null;
      if (field) fields.set(physicalFieldKey(field), field);
      else unresolved = true;
    }
    output.push({
      controlId: `rowset-control:${node.nodeId}:${String(relation.relation_id)}`,
      taskId: node.taskId,
      nodeId: node.nodeId,
      statementId,
      relationId: String(relation.relation_id),
      controlType: String(
        relation.relation_type,
      ).toLowerCase() as RowsetControlAnnotation["controlType"],
      fields: [...fields.values()],
      sourceText: nonEmpty(relation.source_text),
      evidenceStatus: unresolved ? "UNRESOLVED" : status,
      reasonCode: unresolved ? "ROWSET_FIELD_IDENTITY_UNRESOLVED" : null,
      evidenceRefs: [
        load.evidence["relation-nodes.jsonl"] ??
          "machine-facts:relation-nodes.jsonl",
      ],
    });
  }
  if (
    status === "PROVISIONAL_LEGACY" &&
    allControls.some((item) => !ancestry.has(String(item.relation_id)))
  ) {
    output.push({
      controlId: `rowset-control:${node.nodeId}:scope-unresolved`,
      taskId: node.taskId,
      nodeId: node.nodeId,
      statementId,
      relationId: null,
      controlType: "filter",
      fields: [],
      sourceText: null,
      evidenceStatus: "UNRESOLVED",
      reasonCode: "ROWSET_SCOPE_UNRESOLVED",
      evidenceRefs: [
        load.evidence["relation-edges.jsonl"] ??
          "machine-facts:relation-edges.jsonl",
      ],
    });
  }
  return output;
}

function tableEdgesOf(
  tableLineage: TableLineageArtifact,
): FieldLineageTableEdge[] {
  const decisions = lineageDecisions(tableLineage);
  const edges: FieldLineageTableEdge[] = [];
  for (const [consumerTaskId, decision] of decisions) {
    for (const producerTaskId of decision.primary)
      edges.push({ consumerTaskId, producerTaskId, classification: "PRIMARY" });
    for (const producerTaskId of decision.additional)
      edges.push({
        consumerTaskId,
        producerTaskId,
        classification: "ADDITIONAL",
      });
    for (const producerTaskId of decision.unknown)
      edges.push({ consumerTaskId, producerTaskId, classification: "UNKNOWN" });
  }
  return edges;
}

export function reconcileFieldLineage(
  options: ReconcileFieldLineageOptions,
): FieldLineageArtifact {
  if (!options.rootTaskId.trim()) throw new Error("ROOT_TASK_ID_REQUIRED");
  if (!options.rootTable.trim()) throw new Error("ROOT_TABLE_REQUIRED");
  if (options.rootFields.length === 0) throw new Error("ROOT_FIELDS_REQUIRED");
  for (const [name, value, minimum] of [
    ["maxDepth", options.maxDepth, 0],
    ["maxStates", options.maxStates, 1],
    ["maxPaths", options.maxPaths, 1],
  ] as const)
    if (!Number.isInteger(value) || value < minimum)
      throw new Error(`${name.toUpperCase()}_INVALID`);
  if (
    options.tableLineage.rootTaskId &&
    options.tableLineage.rootTaskId !== options.rootTaskId
  )
    throw new Error("TABLE_LINEAGE_ROOT_MISMATCH");

  const dataRoot = resolve(options.dataRoot);
  const catalog = loadPhysicalTableCatalog(dataRoot);
  const taskPacks = loadTaskPacks(dataRoot, catalog);
  const rootPack = taskPacks.get(options.rootTaskId);
  if (!rootPack)
    throw new Error(`ROOT_TASK_INPUT_PACK_MISSING:${options.rootTaskId}`);
  if (!rootPack.target)
    throw new Error(`ROOT_TARGET_IDENTITY_UNRESOLVED:${options.rootTaskId}`);
  if (
    normalizeName(rootPack.target.qualifiedName) !==
    normalizeName(options.rootTable)
  )
    throw new Error("ROOT_TABLE_MISMATCH");

  const nodes = new Map<string, FieldLineageNode>();
  const edges = new Map<string, FieldLineageEdge>();
  const controls = new Map<string, RowsetControlAnnotation>();
  const candidates = new Map<string, FieldProducerCandidate>();
  const gaps = new Map<string, FieldLineageGap>();
  const rootNodeIds: string[] = [];
  const frontier: TraversalState[] = [];
  const visited = new Set<string>();
  const decisions = lineageDecisions(options.tableLineage);
  const factsCache = new Map<string, CurrentBundleLoad>();
  const limitReasons = new Set<
    "MAX_DEPTH_REACHED" | "MAX_STATES_REACHED" | "MAX_PATHS_REACHED"
  >();
  let pathCount = 0;
  let startedRoots = 0;

  const loadFacts = (taskId: string): CurrentBundleLoad => {
    const cached = factsCache.get(taskId);
    if (cached) return cached;
    const loaded = loadCurrentTaskBundle(options.factsRoot, taskId);
    factsCache.set(taskId, loaded);
    return loaded;
  };
  const addGap = (gap: FieldLineageGap): void => {
    gaps.set(gap.gapId, gap);
  };

  for (const requestedField of [
    ...new Set(options.rootFields.map(normalizeName)),
  ].sort(compareText)) {
    const field = physicalField(rootPack.target, requestedField);
    if (!field) throw new Error(`ROOT_FIELD_NOT_IN_SCHEMA:${requestedField}`);
    frontier.push({
      taskId: options.rootTaskId,
      field,
      bindingId: null,
      nodeId: null,
      depth: 0,
      active: new Set(),
      incoming: null,
    });
  }

  while (frontier.length > 0) {
    frontier.sort(
      (left, right) =>
        left.depth - right.depth ||
        compareText(left.taskId, right.taskId) ||
        compareText(
          physicalFieldKey(left.field),
          physicalFieldKey(right.field),
        ) ||
        compareText(left.bindingId ?? "", right.bindingId ?? ""),
    );
    const current = frontier.shift()!;
    const pack = taskPacks.get(current.taskId);
    if (!pack || !pack.target) {
      const excluded = excludedTaskDetail(dataRoot, current.taskId);
      const unresolvedNodeId =
        current.nodeId ??
        nodeId(current.taskId, current.field, current.bindingId);
      if (!nodes.has(unresolvedNodeId))
        nodes.set(unresolvedNodeId, {
          nodeId: unresolvedNodeId,
          taskId: current.taskId,
          taskName: pack ? nonEmpty(pack.document.taskName) : null,
          depth: current.depth,
          field: current.field,
          bindingId: current.bindingId,
          expressionId: null,
          expressionText: null,
          evidenceStatus: "UNRESOLVED",
        });
      if (current.depth === 0) rootNodeIds.push(unresolvedNodeId);
      addGap({
        gapId: `gap:${unresolvedNodeId}:task-pack`,
        taskId: current.taskId,
        nodeId: unresolvedNodeId,
        field: current.field,
        reasonCode: excluded
          ? "TASK_INPUT_PACK_EXCLUDED"
          : "TASK_INPUT_PACK_MISSING",
        message: excluded
          ? `Task Input Pack is excluded: ${excluded.reason}`
          : "Task Input Pack is missing from the primary data root",
        evidenceStatus: "UNRESOLVED",
        evidenceRefs: excluded?.evidence ?? [],
      });
      continue;
    }
    const load = loadFacts(current.taskId);
    const evidenceStatus = factsStatus(load, options.factsPolicy);
    if (!evidenceStatus) {
      const unresolvedNodeId =
        current.nodeId ??
        nodeId(current.taskId, current.field, current.bindingId);
      if (!nodes.has(unresolvedNodeId))
        nodes.set(unresolvedNodeId, {
          nodeId: unresolvedNodeId,
          taskId: current.taskId,
          taskName: nonEmpty(pack.document.taskName),
          depth: current.depth,
          field: current.field,
          bindingId: current.bindingId,
          expressionId: null,
          expressionText: null,
          evidenceStatus: "UNRESOLVED",
        });
      if (current.depth === 0) rootNodeIds.push(unresolvedNodeId);
      addGap({
        gapId: `gap:${unresolvedNodeId}:facts-policy`,
        taskId: current.taskId,
        nodeId: unresolvedNodeId,
        field: current.field,
        reasonCode:
          load.state === "LEGACY_NOT_L1"
            ? "LEGACY_FACTS_NOT_ALLOWED"
            : "MACHINE_FACTS_UNAVAILABLE",
        message:
          load.issues.join("; ") || `Machine Facts state is ${load.state}`,
        evidenceStatus: "UNRESOLVED",
        evidenceRefs: [load.indexPath],
      });
      continue;
    }
    if (current.bindingId === null) {
      const bindings = targetBindings(
        load,
        current.field.qualifiedName,
        current.field,
      );
      if (bindings.length === 0) {
        const unresolvedNodeId = nodeId(current.taskId, current.field, null);
        nodes.set(unresolvedNodeId, {
          nodeId: unresolvedNodeId,
          taskId: current.taskId,
          taskName: nonEmpty(pack.document.taskName),
          depth: current.depth,
          field: current.field,
          bindingId: null,
          expressionId: null,
          expressionText: null,
          evidenceStatus: "UNRESOLVED",
        });
        if (current.depth === 0) rootNodeIds.push(unresolvedNodeId);
        addGap({
          gapId: `gap:${unresolvedNodeId}:binding`,
          taskId: current.taskId,
          nodeId: unresolvedNodeId,
          field: current.field,
          reasonCode: "OUTPUT_FIELD_BINDING_NOT_PROVABLE",
          message: "exact target output binding is missing",
          evidenceStatus: "UNRESOLVED",
          evidenceRefs: [
            load.evidence["output-field-bindings.jsonl"] ?? load.bundleDir,
          ],
        });
        continue;
      }
      for (const binding of bindings) {
        const bindingId = String(binding.binding_id);
        const bindingNodeId = nodeId(current.taskId, current.field, bindingId);
        const bindingStateKey = stateKey(
          current.taskId,
          current.field,
          bindingId,
        );
        if (!nodes.has(bindingNodeId))
          nodes.set(bindingNodeId, {
            nodeId: bindingNodeId,
            taskId: current.taskId,
            taskName: nonEmpty(pack.document.taskName),
            depth: current.depth,
            field: current.field,
            bindingId,
            expressionId: null,
            expressionText: null,
            evidenceStatus,
          });
        if (current.depth === 0) rootNodeIds.push(bindingNodeId);
        if (current.incoming) {
          const crossEdgeId = `value-edge:${bindingNodeId}->${current.incoming.sourceNodeId}:cross-task`;
          edges.set(crossEdgeId, {
            edgeId: crossEdgeId,
            fromNodeId: bindingNodeId,
            toNodeId: current.incoming.sourceNodeId,
            consumerTaskId: current.incoming.consumerTaskId,
            producerTaskId: current.incoming.producerTaskId,
            kind: "VALUE_FLOW",
            mapping: `${current.field.qualifiedName}.${current.field.column} -> ${current.field.qualifiedName}.${current.field.column}`,
            evidenceStatus: current.incoming.evidenceStatus,
            evidenceRefs: [],
          });
        }
        if (current.active.has(bindingStateKey)) {
          addGap({
            gapId: `gap:${bindingNodeId}:cycle`,
            taskId: current.taskId,
            nodeId: bindingNodeId,
            field: current.field,
            reasonCode: "CYCLE",
            message:
              "field traversal returned to a Task/physical-field/output-binding state already active on this path",
            evidenceStatus: "UNRESOLVED",
            evidenceRefs: [],
          });
          continue;
        }
        frontier.push({
          ...current,
          bindingId,
          nodeId: bindingNodeId,
          active: new Set([...current.active, bindingStateKey]),
        });
      }
      continue;
    }
    const currentNodeId = current.nodeId!;
    const currentNode = nodes.get(currentNodeId)!;
    const currentStateKey = stateKey(
      current.taskId,
      current.field,
      current.bindingId,
    );
    if (visited.has(currentStateKey)) continue;
    if (visited.size >= options.maxStates) {
      limitReasons.add("MAX_STATES_REACHED");
      addGap({
        gapId: `gap:${current.nodeId}:max-states`,
        taskId: current.taskId,
        nodeId: current.nodeId,
        field: current.field,
        reasonCode: "MAX_STATES_REACHED",
        message: `maximum traversal states ${options.maxStates} reached`,
        evidenceStatus: "UNRESOLVED",
        evidenceRefs: [],
      });
      break;
    }
    visited.add(currentStateKey);
    const binding = targetBindings(
      load,
      current.field.qualifiedName,
      current.field,
    ).find((candidate) => candidate.binding_id === current.bindingId);
    if (!binding) {
      addGap({
        gapId: `gap:${current.nodeId}:binding`,
        taskId: current.taskId,
        nodeId: current.nodeId,
        field: current.field,
        reasonCode: "OUTPUT_FIELD_BINDING_NOT_PROVABLE",
        message: `output binding ${current.bindingId} is no longer present in the current bundle`,
        evidenceStatus: "UNRESOLVED",
        evidenceRefs: [
          load.evidence["output-field-bindings.jsonl"] ?? load.bundleDir,
        ],
      });
      continue;
    }
    const expression = expressionFor(load, binding);
    if (!expression) {
      addGap({
        gapId: `gap:${current.nodeId}:expression`,
        taskId: current.taskId,
        nodeId: current.nodeId,
        field: currentNode.field,
        reasonCode: "OUTPUT_EXPRESSION_MISSING",
        message: "output binding expression endpoint is missing",
        evidenceStatus: "UNRESOLVED",
        evidenceRefs: [
          load.evidence["field-expression-nodes.jsonl"] ?? load.bundleDir,
        ],
      });
      continue;
    }
    const resolvedNode: FieldLineageNode = {
      ...currentNode,
      bindingId: String(binding.binding_id),
      expressionId: String(expression.expression_id),
      expressionText: String(expression.expression_text ?? ""),
      evidenceStatus,
    };
    nodes.set(currentNodeId, resolvedNode);
    if (current.depth === 0) startedRoots += 1;
    for (const control of rowsetControlsFor(
      load,
      resolvedNode,
      expression,
      catalog,
      evidenceStatus,
    ))
      controls.set(control.controlId, control);

    const sources = sourceFields(
      expression,
      catalog,
      load,
      current.taskId,
      pack.target,
    );
    for (const [kind, records] of [
      [
        "SOURCE_FIELD_SCHEMA_UNVERIFIED",
        Array.isArray(expression.candidate_input_fields)
          ? expression.candidate_input_fields
          : [],
      ],
      [
        "PHYSICAL_FIELD_UNRESOLVED",
        Array.isArray(expression.unresolved_input_columns)
          ? expression.unresolved_input_columns
          : [],
      ],
    ] as const) {
      for (const [index, record] of records.entries())
        addGap({
          gapId: `gap:${current.nodeId}:${kind.toLowerCase()}:${index}`,
          taskId: current.taskId,
          nodeId: current.nodeId,
          field: null,
          reasonCode: kind,
          message: `output expression input is not backed by an exact Table Pack field: ${JSON.stringify(record)}`,
          evidenceStatus: "UNRESOLVED",
          evidenceRefs: [
            load.evidence["field-expression-nodes.jsonl"] ?? load.bundleDir,
          ],
        });
    }
    for (const unresolved of sources.unresolved) {
      addGap({
        gapId: `gap:${current.nodeId}:${unresolved.reason}:${unresolved.table}.${unresolved.column}`,
        taskId: current.taskId,
        nodeId: current.nodeId,
        field: null,
        reasonCode: unresolved.reason,
        message: `${unresolved.table}.${unresolved.column} lacks one exact Schema-backed physical identity`,
        evidenceStatus: "UNRESOLVED",
        evidenceRefs: [
          load.evidence["field-expression-nodes.jsonl"] ?? load.bundleDir,
        ],
      });
    }
    for (const rawSource of sources.fields) {
      const taskLocalBindings =
        physicalTableKey(rawSource) !== physicalTableKey(pack.target)
          ? targetBindings(load, rawSource.qualifiedName, rawSource)
          : [];
      const source: PhysicalFieldIdentity =
        taskLocalBindings.length > 0
          ? {
              ...rawSource,
              stableTableId: `task-local:${current.taskId}:${rawSource.qualifiedName}`,
              identityStatus: "TASK_LOCAL_SCHEMA_BACKED",
            }
          : rawSource;
      if (pathCount >= options.maxPaths) {
        limitReasons.add("MAX_PATHS_REACHED");
        addGap({
          gapId: `gap:${current.nodeId}:max-paths`,
          taskId: current.taskId,
          nodeId: current.nodeId,
          field: source,
          reasonCode: "MAX_PATHS_REACHED",
          message: `maximum value-flow paths ${options.maxPaths} reached`,
          evidenceStatus: "UNRESOLVED",
          evidenceRefs: [],
        });
        break;
      }
      pathCount += 1;
      const sourceId = sourceNodeId(current.taskId, source, current.bindingId);
      if (!nodes.has(sourceId))
        nodes.set(sourceId, {
          nodeId: sourceId,
          taskId: current.taskId,
          taskName: nonEmpty(pack.document.taskName),
          depth: current.depth,
          field: source,
          bindingId: null,
          expressionId: null,
          expressionText: null,
          evidenceStatus,
        });
      const internalEdgeId = `value-edge:${sourceId}->${currentNodeId}:${String(expression.expression_id)}`;
      edges.set(internalEdgeId, {
        edgeId: internalEdgeId,
        fromNodeId: sourceId,
        toNodeId: currentNodeId,
        consumerTaskId: current.taskId,
        producerTaskId: null,
        kind: "VALUE_FLOW",
        mapping: `${source.column} -> ${currentNode.field.column}`,
        evidenceStatus,
        evidenceRefs: [
          load.evidence["field-expression-nodes.jsonl"] ?? load.bundleDir,
          load.evidence["output-field-bindings.jsonl"] ?? load.bundleDir,
        ],
      });
      if (source.identityStatus === "TASK_LOCAL_SCHEMA_BACKED") {
        frontier.push({
          taskId: current.taskId,
          field: source,
          bindingId: null,
          nodeId: null,
          depth: current.depth,
          active: current.active,
          incoming: {
            sourceNodeId: sourceId,
            consumerTaskId: current.taskId,
            producerTaskId: null,
            evidenceStatus,
          },
        });
        continue;
      }

      const decision = decisions.get(current.taskId);
      if (!decision) {
        addGap({
          gapId: `gap:${sourceId}:table-lineage-decision`,
          taskId: current.taskId,
          nodeId: sourceId,
          field: source,
          reasonCode: "TABLE_LINEAGE_PRIMARY_DECISION_MISSING",
          message:
            "table-level artifact has no one-hop primary decision for this Task",
          evidenceStatus: "UNRESOLVED",
          evidenceRefs: [],
        });
        continue;
      }
      for (const additionalTaskId of decision.additional.filter((taskId) =>
        producerMatchesField(
          options.tableLineage,
          taskPacks,
          current.taskId,
          taskId,
          source,
        ),
      )) {
        const candidateId = `candidate:${current.taskId}:${additionalTaskId}:${physicalFieldKey(source)}`;
        candidates.set(candidateId, {
          candidateId,
          consumerTaskId: current.taskId,
          producerTaskId: additionalTaskId,
          field: source,
          evidenceStatus: "CANDIDATE",
          reasonCode: "ONE_HOP_ADDITIONAL_NOT_RECURSED",
        });
      }
      const relevantUnknowns = decision.unknown.filter((taskId) =>
        producerMatchesField(
          options.tableLineage,
          taskPacks,
          current.taskId,
          taskId,
          source,
        ),
      );
      for (const unknownTaskId of relevantUnknowns) {
        const candidateId = `candidate:${current.taskId}:${unknownTaskId}:${physicalFieldKey(source)}`;
        candidates.set(candidateId, {
          candidateId,
          consumerTaskId: current.taskId,
          producerTaskId: unknownTaskId,
          field: source,
          evidenceStatus: "CANDIDATE",
          reasonCode: "ONE_HOP_UNKNOWN_NOT_RECURSED",
        });
        addGap({
          gapId: `gap:upstream-unknown:${current.taskId}:${unknownTaskId}:${physicalFieldKey(source)}`,
          taskId: unknownTaskId,
          nodeId: null,
          field: source,
          reasonCode: "ONE_HOP_UPSTREAM_UNKNOWN",
          message: `one-hop classifies Task ${unknownTaskId} as unknown for the current physical source field; the field branch is not recursed`,
          evidenceStatus: "UNRESOLVED",
          evidenceRefs: [],
        });
      }
      const producers = decision.primary.filter((taskId) =>
        producerMatchesField(
          options.tableLineage,
          taskPacks,
          current.taskId,
          taskId,
          source,
        ),
      );
      for (const producerTaskId of producers) {
        if (current.depth >= options.maxDepth) {
          limitReasons.add("MAX_DEPTH_REACHED");
          addGap({
            gapId: `gap:${sourceId}:max-depth:${producerTaskId}`,
            taskId: current.taskId,
            nodeId: sourceId,
            field: source,
            reasonCode: "MAX_DEPTH_REACHED",
            message: `maximum depth ${options.maxDepth} reached before Task ${producerTaskId}`,
            evidenceStatus: "UNRESOLVED",
            evidenceRefs: [],
          });
          continue;
        }
        const producerPack = taskPacks.get(producerTaskId);
        if (!producerPack || !producerPack.target) {
          const excluded = excludedTaskDetail(dataRoot, producerTaskId);
          addGap({
            gapId: `gap:${sourceId}:producer-pack:${producerTaskId}`,
            taskId: producerTaskId,
            nodeId: sourceId,
            field: source,
            reasonCode: excluded
              ? "TASK_INPUT_PACK_EXCLUDED"
              : "TASK_INPUT_PACK_MISSING",
            message: excluded
              ? `upstream Task Input Pack is excluded: ${excluded.reason}`
              : "upstream Task Input Pack is missing",
            evidenceStatus: "UNRESOLVED",
            evidenceRefs: excluded?.evidence ?? [],
          });
          continue;
        }
        const producerField = physicalField(producerPack.target, source.column);
        if (
          !producerField ||
          physicalFieldKey(producerField) !== physicalFieldKey(source)
        ) {
          addGap({
            gapId: `gap:${sourceId}:physical-mismatch:${producerTaskId}`,
            taskId: producerTaskId,
            nodeId: sourceId,
            field: source,
            reasonCode: "PHYSICAL_FIELD_IDENTITY_MISMATCH",
            message:
              "producer target field does not exactly match the consumer physical source field",
            evidenceStatus: "UNRESOLVED",
            evidenceRefs: [],
          });
          continue;
        }
        frontier.push({
          taskId: producerTaskId,
          field: producerField,
          bindingId: null,
          nodeId: null,
          depth: current.depth + 1,
          active: current.active,
          incoming: {
            sourceNodeId: sourceId,
            consumerTaskId: current.taskId,
            producerTaskId,
            evidenceStatus,
          },
        });
      }
    }
  }

  const allNodes = [...nodes.values()];
  const allEdges = [...edges.values()];
  const allControls = [...controls.values()];
  const allGaps = [...gaps.values()];
  const hasLegacy =
    allNodes.some((node) => node.evidenceStatus === "PROVISIONAL_LEGACY") ||
    allEdges.some((edge) => edge.evidenceStatus === "PROVISIONAL_LEGACY");
  const hasUnresolved =
    allNodes.some((node) => node.evidenceStatus === "UNRESOLVED") ||
    allEdges.some((edge) => edge.evidenceStatus === "UNRESOLVED") ||
    allControls.some((control) => control.evidenceStatus === "UNRESOLVED");
  const overallStatus =
    startedRoots === 0
      ? "BLOCKED"
      : allGaps.length > 0 ||
          hasLegacy ||
          hasUnresolved ||
          limitReasons.size > 0
        ? "PARTIAL"
        : "COMPLETE";
  return canonicalizeFieldLineageArtifact({
    schemaVersion: FIELD_LINEAGE_SCHEMA_VERSION,
    artifactType: FIELD_LINEAGE_ARTIFACT_TYPE,
    generatedAt:
      options.tableLineage.generatedAt ??
      options.now?.() ??
      new Date().toISOString(),
    request: {
      rootTaskId: options.rootTaskId,
      rootTable: normalizeName(options.rootTable),
      rootFields: options.rootFields,
      factsPolicy: options.factsPolicy,
    },
    overallStatus,
    rootNodeIds,
    nodes: allNodes,
    edges: allEdges,
    rowsetControls: allControls,
    candidates: [...candidates.values()],
    gaps: allGaps,
    tableEdges: tableEdgesOf(options.tableLineage),
    limits: {
      maxDepth: options.maxDepth,
      maxStates: options.maxStates,
      maxPaths: options.maxPaths,
      truncated: limitReasons.size > 0,
      reasons: [...limitReasons],
    },
    boundaries: {
      staticSqlOnly: true,
      runtimeExecution: "NOT_EVALUATED",
      dataCorrectness: "NOT_EVALUATED",
      businessAcceptance: "NOT_EVALUATED",
    },
  });
}
