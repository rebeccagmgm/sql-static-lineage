import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { Schema, SqlSession, type SchemaMapping } from "../../src/index.ts";
import type {
  PlanFacts,
  PlanRelation,
  PlanScopeBinding,
} from "../plans/plan-contract.ts";
import {
  loadPhysicalTableCatalog,
  type PhysicalTableCatalogEntry,
} from "../machine-facts/input-pack-machine-facts.ts";
import { sha256File } from "../input/shared/input-pack.ts";
import { inferTaskDefaultSchema } from "../reconcile/shared/task-default-schema.ts";
import { buildPlanFacts } from "../plans/plan-adapter.ts";
import { taskSqlDialect } from "../plans/task-sql-dialect.ts";
import type { ProjectedOutputTypeBinding } from "./plan-facts-rel-projector.ts";
import {
  projectDifferentialSchema,
  type SchemaTypeFact,
  type SchemaTypeProjectionResult,
} from "./schema-type-projection.ts";
import { canonicalJson } from "../machine-facts/machine-facts-contract.ts";

type JsonRecord = Record<string, unknown>;

export interface MachineFactsGateInput {
  readonly status: "SUCCESS" | "PARTIAL" | "UNSUPPORTED";
  readonly taskId: string;
  readonly statementId: string;
  readonly planFacts: PlanFacts | null;
  readonly schemaProjection: SchemaTypeProjectionResult;
  readonly outputTypes: readonly ProjectedOutputTypeBinding[];
  readonly relationEvidenceRefs: Readonly<Record<string, readonly string[]>>;
  readonly expressionEvidenceRefs: Readonly<Record<string, readonly string[]>>;
  readonly defaultSchema?: string;
  readonly issues: readonly string[];
  readonly warnings: readonly string[];
  readonly legacyReadOccurrenceFallbacks: readonly string[];
  readonly projectionPlanSource: "FROZEN_MACHINE_FACTS" | "FINGERPRINT_MATCHED_ENRICHMENT";
  readonly enrichedRelationCount: number;
  readonly fingerprints: {
    readonly sqlSha256: string;
    readonly machineFactsManifestSha256: string;
    readonly schemaBundleSha256: string;
  };
}

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function json(path: string): JsonRecord {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  const parsed = record(value);
  if (!parsed) throw new Error(`JSON_OBJECT_REQUIRED:${path}`);
  return parsed;
}

function jsonl(path: string): readonly JsonRecord[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      const parsed = record(JSON.parse(line));
      if (!parsed) throw new Error(`JSONL_OBJECT_REQUIRED:${path}#L${index + 1}`);
      return parsed;
    });
}

function locator(root: string, path: string, line?: number): string {
  const value = relative(root, path).replaceAll("\\", "/");
  return line === undefined ? value : `${value}#L${line}`;
}

function normalized(value: string): string {
  return value.replaceAll("`", "").replaceAll('"', "").trim().toLowerCase();
}

function sourceContentHash(schemaRef: JsonRecord): string | null {
  const source = text(schemaRef.source);
  return source?.startsWith("input-pack:") ? source.slice("input-pack:".length) : null;
}

function exactCatalogEntry(
  schemaRef: JsonRecord,
  entries: readonly PhysicalTableCatalogEntry[],
): { readonly entry: PhysicalTableCatalogEntry; readonly contentHashDrift: boolean } | null {
  const qualifiedName = text(schemaRef.qualified_name);
  const ddlSha256 = text(schemaRef.ddl_sha256);
  const tableHash = sourceContentHash(schemaRef);
  if (!qualifiedName || !ddlSha256 || !tableHash) return null;
  const guid = text(schemaRef.guid);
  const candidates = entries.filter((entry) =>
    normalized(entry.qualifiedName) === normalized(qualifiedName) &&
    entry.ddlSha256.toLowerCase() === ddlSha256.toLowerCase() &&
    (!guid || entry.guid === guid));
  if (candidates.length !== 1) return null;
  const entry = candidates[0]!;
  return {
    entry,
    contentHashDrift: entry.tableContentHash.toLowerCase() !== tableHash.toLowerCase(),
  };
}

function tableTypeKey(table: string, column: string): string {
  return `${normalized(table)}\u0000${normalized(column)}`;
}

function schemaFactKey(fact: SchemaTypeFact): string {
  const table = [fact.table.catalog, fact.table.schema, fact.table.name]
    .filter((part): part is string => part !== undefined)
    .join(".");
  return tableTypeKey(table, fact.column.name);
}

function evidenceMap(
  rows: readonly JsonRecord[],
  idField: string,
  path: string,
  root: string,
): Readonly<Record<string, readonly string[]>> {
  const output: Record<string, readonly string[]> = {};
  rows.forEach((row, index) => {
    const id = text(row[idField]);
    if (id) output[id] = [locator(root, path, index + 1)];
  });
  return output;
}

function restoredRelations(
  rows: readonly JsonRecord[],
): { readonly relations: readonly PlanRelation[]; readonly fallbacks: readonly string[] } {
  const fallbacks: string[] = [];
  const relations = rows.flatMap((row) => {
    const value = record(row.relation);
    if (!value || !text(value.id) || !text(value.type)) return [];
    if (value.type === "read" && !text(value.read_occurrence_id)) {
      const relationId = String(value.id);
      value.read_occurrence_id = relationId;
      value.read_occurrence = {
        occurrence_id: relationId,
        relation_id: relationId,
        scope_id: value.scope_id ?? null,
        source_span: value.span ?? null,
      };
      fallbacks.push(relationId);
    }
    return [value as unknown as PlanRelation];
  });
  return { relations, fallbacks };
}

function concreteTypeText(fact: SchemaTypeFact): string {
  if (fact.type.precision === undefined) return fact.type.name;
  if (fact.type.scale === undefined) return `${fact.type.name}(${fact.type.precision})`;
  return `${fact.type.name}(${fact.type.precision},${fact.type.scale})`;
}

function schemaForNativeParser(types: readonly SchemaTypeFact[]): Schema {
  const mapping: SchemaMapping = {};
  for (const fact of types) {
    const namespace = [fact.table.catalog, fact.table.schema]
      .filter((part): part is string => part !== undefined);
    let owner = mapping;
    for (const part of namespace) {
      const existing = owner[part];
      if (typeof existing !== "object" || existing === null || "nullable" in existing)
        owner[part] = {};
      owner = owner[part] as SchemaMapping;
    }
    const table = owner[fact.table.name];
    if (typeof table !== "object" || table === null || "nullable" in table)
      owner[fact.table.name] = {};
    (owner[fact.table.name] as SchemaMapping)[fact.column.name] = concreteTypeText(fact);
  }
  return new Schema(mapping);
}

function localRelationId(globalId: string, taskId: string): string {
  const prefix = `task:${taskId}:statement:0:relation:`;
  return globalId.startsWith(prefix) ? globalId.slice(prefix.length) : globalId;
}

function globalRelationId(localId: string, taskId: string): string {
  const prefix = `task:${taskId}:statement:0:relation:`;
  return localId.startsWith(prefix) ? localId : `${prefix}${localId}`;
}

/**
 * The parser owns the complete relational shape.  Machine Facts remains the
 * source of canonical evidence, but it is intentionally not used as a lossy
 * relational-plan substitute when a fingerprint-matched parse is available.
 */
function globalizePlanRelation(
  relation: PlanRelation,
  taskId: string,
): PlanRelation {
  const id = globalRelationId(relation.id, taskId);
  switch (relation.type) {
    case "read":
      return {
        ...relation,
        id,
        read_occurrence_id: globalRelationId(relation.read_occurrence_id, taskId),
        read_occurrence: {
          ...relation.read_occurrence,
          occurrence_id: globalRelationId(relation.read_occurrence.occurrence_id, taskId),
          relation_id: id,
        },
      };
    case "project":
    case "filter":
    case "aggregate":
      return {
        ...relation,
        id,
        ...(relation.source ? { source: globalRelationId(relation.source, taskId) } : {}),
      };
    case "join":
      return {
        ...relation,
        id,
        left: globalRelationId(relation.left, taskId),
        right: globalRelationId(relation.right, taskId),
      };
    case "setop":
      return {
        ...relation,
        id,
        branches: relation.branches.map((branch) => globalRelationId(branch, taskId)),
      };
    case "top_n":
      return {
        ...relation,
        id,
        source: globalRelationId(relation.source, taskId),
      };
    case "expand":
    case "other":
      return {
        ...relation,
        id,
        ...(relation.source ? { source: globalRelationId(relation.source, taskId) } : {}),
      };
  }
}

function globalizeScopeBindings(
  bindings: readonly PlanScopeBinding[],
  taskId: string,
): readonly PlanScopeBinding[] {
  return bindings.map((binding) => ({
    ...binding,
    relation_id: globalRelationId(binding.relation_id, taskId),
    target_relation_id: binding.target_relation_id
      ? globalRelationId(binding.target_relation_id, taskId)
      : null,
  }));
}

function sameSpan(
  left: { readonly start: number; readonly end: number } | null,
  right: { readonly start: number; readonly end: number } | null,
): boolean {
  return left !== null && right !== null &&
    left.start === right.start && left.end === right.end;
}

function enrichFromFingerprintMatchedPlan(options: {
  readonly frozen: readonly PlanRelation[];
  readonly taskId: string;
  readonly task: JsonRecord;
  readonly sql: string;
  readonly schemaTypes: readonly SchemaTypeFact[];
}): {
  readonly relations: readonly PlanRelation[];
  readonly scopeBindings: readonly PlanScopeBinding[];
  readonly source: "FROZEN_MACHINE_FACTS" | "FINGERPRINT_MATCHED_ENRICHMENT";
  readonly enrichedRelationCount: number;
  readonly warning?: string;
} {
  try {
    const dialect = taskSqlDialect(String(options.task.taskCategory));
    const schema = schemaForNativeParser(options.schemaTypes);
    const session = SqlSession.create(options.sql, dialect, { schema });
    const statement = session.doc.statements[0];
    if (!statement || statement.errors > 0)
      return {
        relations: options.frozen,
        scopeBindings: [],
        source: "FROZEN_MACHINE_FACTS",
        enrichedRelationCount: 0,
        warning: "CURRENT_PLAN_REPARSE_FAILED",
      };
    const current = buildPlanFacts(statement, options.sql, {
      statement_index: 0,
      dialect,
      schema,
      include_expression_dependencies: true,
    });
    const currentById = new Map(current.relations.map((relation) => [relation.id, relation]));
    if (current.relations.length !== options.frozen.length)
      return {
        relations: options.frozen,
        scopeBindings: [],
        source: "FROZEN_MACHINE_FACTS",
        enrichedRelationCount: 0,
        warning: "CURRENT_PLAN_RELATION_COUNT_DRIFT",
      };
    for (const frozen of options.frozen) {
      const candidate = currentById.get(localRelationId(frozen.id, options.taskId));
      if (!candidate || candidate.type !== frozen.type ||
          !sameSpan(candidate.span, frozen.span))
        return {
          relations: options.frozen,
          scopeBindings: [],
          source: "FROZEN_MACHINE_FACTS",
          enrichedRelationCount: 0,
          warning: `CURRENT_PLAN_RELATION_IDENTITY_DRIFT:${frozen.id}`,
        };
    }
    // The exact SQL fingerprint and relation identity/span checks above make
    // the current parser plan safe to use as the semantic input.  Do not
    // rebuild a partial relational graph from flattened Machine Facts here:
    // doing so loses ordered operands (for example SUBSTR(column, 8)) and
    // silently turns a complete SQL plan into a PARTIAL Calcite request.
    const relations = current.relations.map((relation) =>
      globalizePlanRelation(relation, options.taskId),
    );
    const frozenById = new Map(options.frozen.map((relation) => [relation.id, relation]));
    const enrichedRelationCount = relations.filter((relation) => {
      const frozen = frozenById.get(relation.id);
      return frozen === undefined || canonicalJson(frozen) !== canonicalJson(relation);
    }).length;
    return {
      relations,
      scopeBindings: globalizeScopeBindings(current.scope_bindings ?? [], options.taskId),
      source: "FINGERPRINT_MATCHED_ENRICHMENT",
      enrichedRelationCount,
    };
  } catch {
    return {
      relations: options.frozen,
      scopeBindings: [],
      source: "FROZEN_MACHINE_FACTS",
      enrichedRelationCount: 0,
      warning: "CURRENT_PLAN_REPARSE_FAILED",
    };
  }
}

function rootRelationIds(relations: readonly PlanRelation[]): readonly string[] {
  const explicit = relations
    .map((relation) => relation.id)
    .filter((id) => id.endsWith(":relation:root.project"));
  if (explicit.length > 0) return explicit;
  const inputs = new Set<string>();
  for (const relation of relations) {
    if ("source" in relation && relation.source) inputs.add(relation.source);
    if ("left" in relation && relation.left) inputs.add(relation.left);
    if ("right" in relation && relation.right) inputs.add(relation.right);
    if ("branches" in relation && relation.branches)
      for (const branch of relation.branches) inputs.add(branch);
  }
  return relations.map((relation) => relation.id).filter((id) => !inputs.has(id));
}

function outputTypeBindings(
  relations: readonly PlanRelation[],
  fieldRows: readonly JsonRecord[],
  bindingRows: readonly JsonRecord[],
  schemaTypes: readonly SchemaTypeFact[],
  fieldPath: string,
  bindingPath: string,
  root: string,
): readonly ProjectedOutputTypeBinding[] {
  const types = new Map(schemaTypes.map((fact) => [schemaFactKey(fact), fact]));
  const fields = new Map<string, { readonly row: JsonRecord; readonly ref: string }>();
  fieldRows.forEach((row, index) => {
    const relationId = text(row.relation_id);
    const ordinal = typeof row.ordinal === "number" && Number.isSafeInteger(row.ordinal)
      ? row.ordinal
      : null;
    if (relationId && ordinal !== null)
      fields.set(`${relationId}\u0000${ordinal}`, {
        row,
        ref: locator(root, fieldPath, index + 1),
      });
  });
  const targetByExpression = new Map<string, { readonly row: JsonRecord; readonly ref: string }>();
  bindingRows.forEach((row, index) => {
    const expressionId = text(row.expression_id);
    if (expressionId)
      targetByExpression.set(expressionId, {
        row,
        ref: locator(root, bindingPath, index + 1),
      });
  });

  const output: ProjectedOutputTypeBinding[] = [];
  for (const relation of relations) {
    if (relation.type !== "project" && relation.type !== "aggregate") continue;
    const projectExpressions = relation.type === "project"
      ? (relation as PlanRelation & { readonly expressions?: readonly unknown[] }).expressions
      : undefined;
    const outputCount = relation.type === "aggregate"
      ? relation.output_columns?.length ?? (relation.group_by.length + relation.measures.length)
      : Array.isArray(projectExpressions) ? projectExpressions.length : 0;
    for (let ordinal = 0; ordinal < outputCount; ordinal += 1) {
      const field = fields.get(`${relation.id}\u0000${ordinal}`);
      if (!field) continue;
      const expressionId = text(field.row.expression_id);
      const target = expressionId ? targetByExpression.get(expressionId) : undefined;
      const inputs = Array.isArray(field.row.input_fields)
        ? field.row.input_fields.map(record).filter((value): value is JsonRecord => value !== null)
        : [];
      let typeFact: SchemaTypeFact | undefined;
      let nativeFieldId = expressionId ?? undefined;
      const evidenceRefs = [field.ref];
      // A direct project alias is a pass-through of one exact physical field.
      // Preserve that identity for downstream JOIN metadata; the expression
      // id is only a stable derived-output identity when the expression has
      // more than one input or no physical input binding.
      if (relation.type === "project" && inputs.length === 1) {
        const directFieldId = text(inputs[0]!.field_id);
        if (directFieldId) nativeFieldId = directFieldId;
      }
      if (target) {
        const table = text(target.row.target_dataset);
        const column = text(target.row.target_field);
        if (table && column) typeFact = types.get(tableTypeKey(table, column));
        nativeFieldId = text(target.row.target_field_id) ?? nativeFieldId;
        evidenceRefs.push(target.ref);
      }
      if (!typeFact) {
        if (inputs.length === 1) {
          const table = text(inputs[0]!.table);
          const column = text(inputs[0]!.column);
          if (table && column) typeFact = types.get(tableTypeKey(table, column));
        }
      }
      if (!typeFact) continue;
      output.push({
        relationId: relation.id,
        ordinal,
        type: typeFact.type,
        evidenceRefs: [...evidenceRefs, ...typeFact.evidenceRefs],
        ...(nativeFieldId ? { nativeFieldId } : {}),
      });
    }
  }
  return output;
}

/**
 * Restore the immutable Plan Facts payload embedded in a fingerprinted Machine
 * Facts bundle. This is a read-only differential input adapter; it does not
 * regenerate or publish Machine Facts.
 */
export function loadMachineFactsGateInput(options: {
  readonly dataRoot: string;
  readonly taskId: string;
}): MachineFactsGateInput {
  const dataRoot = resolve(options.dataRoot);
  const bundle = resolve(dataRoot, "field-facts", "registry", "tasks", options.taskId, "bundle");
  const manifestPath = resolve(bundle, "manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`MACHINE_FACTS_BUNDLE_MISSING:${options.taskId}`);
  const manifest = json(manifestPath);
  if (text(manifest.task_id) !== options.taskId || manifest.status !== "SUCCESS")
    throw new Error(`MACHINE_FACTS_BUNDLE_NOT_CURRENT:${options.taskId}`);

  const inputs = record(manifest.inputs);
  const inputPack = record(inputs?.input_pack);
  const taskLocator = text(inputPack?.task_locator);
  const sqlLocator = text(inputPack?.sql_locator);
  const sqlSha256 = text(inputPack?.analysis_sql_sha256);
  if (!taskLocator || !sqlLocator || !sqlSha256)
    throw new Error("MACHINE_FACTS_INPUT_PROVENANCE_INCOMPLETE");
  const taskPath = resolve(dataRoot, taskLocator);
  const sqlPath = resolve(dataRoot, sqlLocator);
  if (sha256File(sqlPath).toLowerCase() !== sqlSha256.toLowerCase())
    throw new Error("MACHINE_FACTS_SQL_FINGERPRINT_MISMATCH");
  const task = json(taskPath);
  const defaultSchema = inferTaskDefaultSchema(task)?.schema;

  const relationPath = resolve(bundle, "relation-nodes.jsonl");
  const fieldPath = resolve(bundle, "field-expression-nodes.jsonl");
  const bindingPath = resolve(bundle, "output-field-bindings.jsonl");
  const schemaPath = resolve(bundle, "schema-refs.jsonl");
  const datasetPath = resolve(bundle, "dataset-io.jsonl");
  const relationRows = jsonl(relationPath);
  const fieldRows = jsonl(fieldPath);
  const bindingRows = jsonl(bindingPath);
  const schemaRows = jsonl(schemaPath);
  const datasetRows = jsonl(datasetPath);
  const restored = restoredRelations(relationRows);
  const issues: string[] = [];
  const warnings: string[] = [];

  const catalog = loadPhysicalTableCatalog(dataRoot, { lazyDdl: true });
  const schemaInputs = schemaRows.flatMap((schemaRef, index) => {
    const resolvedEntry = exactCatalogEntry(schemaRef, catalog.entries);
    if (!resolvedEntry) {
      issues.push(`SCHEMA_PACK_IDENTITY_NOT_EXACT:${text(schemaRef.qualified_name) ?? index}`);
      return [];
    }
    const entry = resolvedEntry.entry;
    if (resolvedEntry.contentHashDrift)
      warnings.push(`TABLE_PACK_CONTENT_HASH_DRIFT_DDL_STABLE:${entry.qualifiedName}`);
    if (sha256File(entry.ddlPath).toLowerCase() !== entry.ddlSha256.toLowerCase()) {
      issues.push(`SCHEMA_DDL_FINGERPRINT_MISMATCH:${entry.qualifiedName}`);
      return [];
    }
    const parts = normalized(entry.qualifiedName).split(".");
    const table = parts.length === 2
      ? { schema: parts[0]!, name: parts[1]! }
      : parts.length === 3
        ? { catalog: parts[0]!, schema: parts[1]!, name: parts[2]! }
        : { name: parts[0]! };
    return [{
      table,
      ddl: readFileSync(entry.ddlPath, "utf8"),
      physicalTableIdentity: {
        platform: entry.platform,
        dataSource: entry.dataSource,
        stableTableId: entry.stableTableId,
        qualifiedName: entry.qualifiedName,
      },
      evidenceRefs: [
        locator(dataRoot, entry.tablePath),
        locator(dataRoot, entry.ddlPath),
        locator(dataRoot, schemaPath, index + 1),
      ],
    }];
  });
  const schemaProjection = projectDifferentialSchema({
    dialect: "HIVE",
    tables: schemaInputs,
  });
  issues.push(...schemaProjection.issues.map((issue) => `${issue.code}:${issue.path}`));
  const enrichment = enrichFromFingerprintMatchedPlan({
    frozen: restored.relations,
    taskId: options.taskId,
    task,
    sql: readFileSync(sqlPath, "utf8"),
    schemaTypes: schemaProjection.types,
  });
  if (enrichment.warning) warnings.push(enrichment.warning);

  const statementIds = new Set(relationRows.map((row) => text(row.statement_id)).filter(Boolean));
  const statementId = statementIds.size === 1 ? [...statementIds][0]! : "";
  if (!statementId) issues.push("STATEMENT_ID_NOT_UNIQUE");
  const physicalInputs = datasetRows
    .filter((row) => row.direction === "READ")
    .map((row) => text(row.physical_dataset))
    .filter((value): value is string => value !== null);
  const planFacts: PlanFacts = {
    meta: {
      contract_version: "1.4.0",
      adapter_version: text(record(manifest.method)?.plan_adapter && record(record(manifest.method)?.plan_adapter)?.version) ?? "UNKNOWN",
      parser: {
        engine: text(record(record(manifest.method)?.parser)?.engine) ?? "sql-static-lineage",
        version: text(record(record(manifest.method)?.parser)?.version) ?? "UNKNOWN",
      },
      dialect: text(record(manifest.method)?.dialect) ?? "databricks",
      statement_index: 0,
      generated_at: text(task.collectedAt) ?? "1970-01-01T00:00:00.000Z",
    },
    relations: [...enrichment.relations],
    ...(enrichment.scopeBindings.length > 0
      ? { scope_bindings: [...enrichment.scopeBindings] }
      : {}),
    roots: [...rootRelationIds(enrichment.relations)],
    physical_inputs: [...new Set(physicalInputs)],
    unknowns: [],
    lineage_hops: { roots: [], nodes: [], edges: [] },
  };

  const relationEvidenceRefs = evidenceMap(
    relationRows,
    "relation_id",
    relationPath,
    dataRoot,
  );
  const expressionEvidenceRefs: Record<string, readonly string[]> = {};
  fieldRows.forEach((row, index) => {
    const relationId = text(row.relation_id);
    const ordinal = typeof row.ordinal === "number" && Number.isSafeInteger(row.ordinal)
      ? row.ordinal
      : null;
    if (relationId && ordinal !== null) {
      const relation = enrichment.relations.find((candidate) => candidate.id === relationId);
      const role = relation?.type === "aggregate" ? "aggregate" : "project";
      expressionEvidenceRefs[`${relationId}:project:${ordinal}`] = [
        locator(dataRoot, fieldPath, index + 1),
      ];
      expressionEvidenceRefs[`${relationId}:${role}:${ordinal}`] = [
        locator(dataRoot, fieldPath, index + 1),
      ];
    }
  });
  relationRows.forEach((row, index) => {
    if (row.relation_type !== "filter") return;
    const relationId = text(row.relation_id);
    if (relationId)
      expressionEvidenceRefs[`${relationId}:predicate`] = [
        locator(dataRoot, relationPath, index + 1),
      ];
  });

  const outputTypes = outputTypeBindings(
    enrichment.relations,
    fieldRows,
    bindingRows,
    schemaProjection.types,
    fieldPath,
    bindingPath,
    dataRoot,
  );
  const schemaBundleSha256 = text(inputs?.schema_bundle_sha256) ?? "";
  const status = issues.length === 0 && schemaProjection.status === "SUCCESS"
    ? "SUCCESS"
    : restored.relations.length > 0 && schemaProjection.types.length > 0
      ? "PARTIAL"
      : "UNSUPPORTED";
  return {
    status,
    taskId: options.taskId,
    statementId,
    planFacts,
    schemaProjection,
    outputTypes,
    relationEvidenceRefs,
    expressionEvidenceRefs,
    ...(defaultSchema ? { defaultSchema } : {}),
    issues,
    warnings,
    legacyReadOccurrenceFallbacks: restored.fallbacks,
    projectionPlanSource: enrichment.source,
    enrichedRelationCount: enrichment.enrichedRelationCount,
    fingerprints: {
      sqlSha256,
      machineFactsManifestSha256: sha256File(manifestPath),
      schemaBundleSha256,
    },
  };
}
