import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Schema, SqlSession, type SchemaMapping } from "../../../../src/index.ts";
import {
  canonicalJson,
  sha256,
} from "../../../machine-facts/machine-facts-contract.ts";
import {
  indexTaskInputPacks,
  loadPhysicalTableCatalog,
  physicalTableKey,
  selectLineageSql,
  type PhysicalTableCatalog,
} from "../../../machine-facts/input-pack-machine-facts.ts";
import { validateTableProducerIndex } from "../../producer/producer-index.ts";
import { validateMultiHopReconciliation } from "../multi-hop/reconcile-multi-hop.ts";
import {
  createCurrentTaskBundleReader,
  type CurrentBundleLoad,
  type JsonRecord,
} from "../../../query/current-task-bundle.ts";
import {
  validateTaskDocument,
  type TaskDocument,
} from "../../../input/shared/input-pack.ts";
import { taskSqlDialect } from "../../../plans/task-sql-dialect.ts";
import { buildPlanFacts } from "../../../plans/plan-adapter.ts";
import {
  physicalFieldKey,
  type PhysicalFieldIdentity,
} from "../field-lineage/field-lineage-contract.ts";
import {
  physicalFieldForTable,
  resolvePhysicalInputField,
} from "../field-lineage/physical-field-resolver.ts";
import {
  createPhysicalFieldExpander,
  loadPhysicalFieldExpanderTaskPacks,
  taskDefaultSchemaFor,
  type PhysicalFieldExpanderTaskPack,
} from "../field-lineage/physical-field-expander.ts";
import {
  normalizeSemanticDependencies,
  type SemanticDependencyGap,
  type SemanticDependencyNormalization,
} from "./semantic-dependency-normalizer.ts";
import type {
  SemanticDependencyApplication,
  SemanticDependencyDefinition,
  SemanticDependencyEdge,
  SemanticSubject,
} from "./semantic-dependency-contract.ts";
import {
  projectCandidateUniverse,
  buildAssessmentPairSkeleton,
  type CandidateUniverse,
} from "./candidate-universe.ts";
import {
  traverseCausalDependencies,
  type CausalTraversalResult,
} from "./causal-traversal.ts";
import {
  assessPositiveCausalRelationships,
  validatePositiveCausalAssessments,
  type RootWritePositiveProofInput,
} from "./causal-assessment.ts";
import {
  assessNegativeCausalRelationships,
  validateNegativeCausalAssessments,
  type NegativeProofRequest,
  type KnownUnrelatedCut,
} from "./causal-negative-proof.ts";
import { generateRerunSets } from "./rerun-sets.ts";
import {
  TARGET_FIELD_CAUSAL_SLICE_ARTIFACT_TYPE,
  TARGET_FIELD_CAUSAL_SLICE_SCHEMA_VERSION,
  canonicalizeCausalSliceArtifact,
  type CausalSliceArtifact,
  type CausalSliceArtifactInput,
} from "./causal-slice-contract.ts";

export type CausalSliceStaleLayer =
  | "INPUT_PACK"
  | "MACHINE_FACTS"
  | "PRODUCER_INDEX"
  | "TABLE_MULTI_HOP"
  | "LEGACY_VALUE_EVIDENCE";

export interface TargetFieldCausalSliceOptions {
  readonly dataRoot: string;
  readonly factsRoot: string;
  readonly producerIndex: string;
  readonly tableMultiHop: string;
  readonly taskId: string;
  readonly targetTable: string;
  readonly writeObservationIds?: readonly string[];
  readonly fields?: readonly string[];
  readonly legacyFieldLineage?: string;
  readonly output?: string;
  readonly outputDir?: string;
  readonly summaryOutput?: string;
  readonly semanticOracle?: "calcite";
  readonly calciteMappingReport?: string;
  readonly semanticOracleOutput?: string;
  readonly maxDepth?: number;
  readonly maxValueStates?: number;
  readonly maxValuePaths?: number;
  readonly maxControlStates?: number;
  readonly maxControlPaths?: number;
  readonly negativeProofRequests?: readonly NegativeProofRequest[];
  readonly knownCuts?: readonly KnownUnrelatedCut[];
  readonly now?: () => string;
}

export class TargetFieldCausalSliceStaleError extends Error {
  readonly layer: CausalSliceStaleLayer;

  constructor(layer: CausalSliceStaleLayer, detail: string) {
    super(`STALE_LAYER:${layer}:${detail}`);
    this.name = "TargetFieldCausalSliceStaleError";
    this.layer = layer;
  }
}

function record(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const valueText = value.trim();
  return valueText.length > 0 ? valueText : null;
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function readJson(path: string, layer: CausalSliceStaleLayer): JsonRecord {
  try {
    const value: unknown = JSON.parse(readFileSync(resolve(path), "utf8"));
    if (typeof value !== "object" || value === null || Array.isArray(value))
      throw new Error("expected object");
    return value as JsonRecord;
  } catch (error) {
    throw new TargetFieldCausalSliceStaleError(
      layer,
      `${resolve(path)}:${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function requireFingerprint(value: unknown, name: string, layer: CausalSliceStaleLayer): string {
  const valueText = text(value);
  if (!valueText) throw new TargetFieldCausalSliceStaleError(layer, `${name}_MISSING`);
  return valueText;
}

function candidateTaskIds(artifact: JsonRecord, rootTaskId: string): readonly string[] {
  const ids = new Set<string>([rootTaskId]);
  for (const key of ["taskNodes", "readEdges", "producerBridges", "scheduleEdges", "writeEdges", "terminals"]) {
    const values = Array.isArray(artifact[key]) ? artifact[key] : [];
    for (const item of values) {
      const value = record(item);
      for (const idKey of ["taskId", "consumerTaskId", "producerTaskId"])
        if (text(value[idKey])) ids.add(text(value[idKey])!);
    }
  }
  return [...ids].sort((left, right) => left.localeCompare(right));
}

function expectedTaskContentHashes(
  artifact: JsonRecord,
): ReadonlyMap<string, string> {
  const hashes = new Map<string, string>();
  const taskNodes = Array.isArray(artifact.taskNodes) ? artifact.taskNodes : [];
  for (const item of taskNodes) {
    const node = record(item);
    const taskId = text(node.taskId);
    const contentHash = text(node.taskContentHash);
    if (taskId && contentHash) hashes.set(taskId, contentHash);
  }
  return hashes;
}

function targetEntry(
  catalog: PhysicalTableCatalog,
  pack: PhysicalFieldExpanderTaskPack,
  targetTable: string,
) {
  const exact = catalog.byQualifiedName.get(targetTable.trim().toLowerCase()) ?? [];
  if (exact.length === 1) return exact[0]!;
  if (
    pack.target &&
    pack.target.qualifiedName.toLowerCase() === targetTable.trim().toLowerCase()
  ) return pack.target;
  if (exact.length === 0)
    throw new Error(`ROOT_TARGET_IDENTITY_UNRESOLVED:${targetTable}`);
  throw new Error(`ROOT_TARGET_IDENTITY_AMBIGUOUS:${targetTable}`);
}

function schemaFor(
  load: CurrentBundleLoad,
  pack: PhysicalFieldExpanderTaskPack,
): Schema {
  const mapping: SchemaMapping = {};
  const add = (qualifiedName: string, columns: readonly string[]): void => {
    const parts = qualifiedName.split(".").filter(Boolean);
    if (parts.length === 0 || columns.length === 0) return;
    let cursor = mapping;
    for (const part of parts.slice(0, -1)) {
      const next = cursor[part];
      if (typeof next !== "object" || next === null || Array.isArray(next))
        cursor[part] = {};
      cursor = cursor[part] as SchemaMapping;
    }
    const table: SchemaMapping = {};
    for (const column of columns) table[column] = "string";
    cursor[parts.at(-1)!] = table;
  };
  for (const ref of load.records["schema-refs.jsonl"] ?? []) {
    const qualifiedName = text(ref.qualified_name);
    const columns = Array.isArray(ref.physical_columns)
      ? ref.physical_columns.map(String)
      : [];
    if (qualifiedName) add(qualifiedName, columns);
  }
  if (pack.target) add(pack.target.qualifiedName, pack.target.columns);
  return new Schema(mapping);
}

function physicalResolver(
  taskId: string,
  pack: PhysicalFieldExpanderTaskPack,
  load: CurrentBundleLoad,
  catalog: PhysicalTableCatalog,
  validatedTableKeys: ReadonlySet<string>,
) {
  const context = {
    catalog,
    taskId,
    defaultSchema: taskDefaultSchemaFor(pack),
    fallbackTable: pack.target ?? catalog.entries[0],
    schemaRefs: load.records["schema-refs.jsonl"] ?? [],
  };
  return (reference: { readonly table: string; readonly column: string }, _column: unknown) => {
    if (!context.fallbackTable) return null;
    const result = resolvePhysicalInputField(context, reference);
    return result.status === "RESOLVED" &&
      validatedTableKeys.has(physicalTableKey(result.field))
      ? result.field
      : null;
  };
}

function outputRoots(
  taskId: string,
  load: CurrentBundleLoad,
  table: ReturnType<typeof targetEntry>,
  requestedRootFields: readonly string[],
): readonly { rootTargetFieldId: string; outputName: string }[] {
  const bindings = (load.records["output-field-bindings.jsonl"] ?? [])
    .filter((binding) =>
      binding.task_id === taskId &&
      binding.binding_status === "RESOLVED" &&
      text(binding.target_dataset)?.toLowerCase() === table.qualifiedName.toLowerCase(),
    );
  const names = bindings.map((binding) => text(binding.target_field)).filter((value): value is string => value !== null);
  const selected = requestedRootFields.length > 0 ? requestedRootFields : names;
  return sortedUnique(selected.map((field) => field.split(".").at(-1) ?? field)).flatMap((name) => {
    const identity = physicalFieldForTable(table, name);
    return identity ? [{ rootTargetFieldId: physicalFieldKey(identity), outputName: name }] : [];
  });
}

function buildPlanInputs(
  dataRoot: string,
  taskId: string,
  pack: PhysicalFieldExpanderTaskPack,
  load: CurrentBundleLoad,
  catalog: PhysicalTableCatalog,
  validatedTableKeys: ReadonlySet<string>,
  roots: readonly { rootTargetFieldId: string; outputName: string }[],
): { readonly normalizations: readonly SemanticDependencyNormalization[]; readonly identities: ReadonlyMap<string, PhysicalFieldIdentity>; } {
  const selected = selectLineageSql(dataRoot, pack.path, pack.document);
  const sql = selected.selected.content;
  const schema = schemaFor(load, pack);
  const session = SqlSession.create(sql, taskSqlDialect(String(pack.document.taskCategory)), { schema });
  const identities = new Map<string, PhysicalFieldIdentity>();
  const normalizations: SemanticDependencyNormalization[] = [];
  for (const cell of session.doc.statements) {
    const plan = buildPlanFacts(cell, sql, {
      dialect: taskSqlDialect(String(pack.document.taskCategory)),
      schema,
      include_expression_dependencies: true,
    });
    const normalized = normalizeSemanticDependencies({
      plan,
      roots: roots.map((root) => ({
        rootTargetFieldId: root.rootTargetFieldId,
        outputName: root.outputName,
      })),
      physicalFieldResolver: (reference, column) => {
        const field = physicalResolver(
          taskId,
          pack,
          load,
          catalog,
          validatedTableKeys,
        )(reference, column);
        if (field) identities.set(physicalFieldKey(field), field);
        return field;
      },
      machineFacts: load.records,
    });
    normalizations.push(normalized);
  }
  return { normalizations, identities };
}

function preflight(
  options: TargetFieldCausalSliceOptions,
  producerIndex: JsonRecord,
  tableArtifact: JsonRecord,
  taskIds: readonly string[],
  packs: ReturnType<typeof loadPhysicalFieldExpanderTaskPacks>,
  loads: ReturnType<typeof createCurrentTaskBundleReader>,
): {
  readonly facts: ReadonlyMap<string, CurrentBundleLoad>;
  readonly inputPackFingerprint: string;
  readonly machineFactsFingerprint: string;
} {
  const inputFingerprint = requireFingerprint(producerIndex.inputFingerprint, "inputFingerprint", "PRODUCER_INDEX");
  const tableProducer = record(tableArtifact.producerIndex);
  if (text(tableArtifact.artifactType) !== "TABLE_MULTI_HOP_RECONCILIATION" ||
      text(tableProducer.inputFingerprint) !== inputFingerprint ||
      text(tableProducer.contentHash) !== text(producerIndex.contentHash))
    throw new TargetFieldCausalSliceStaleError("TABLE_MULTI_HOP", "producer snapshot does not match");
  const expectedTaskHashes = expectedTaskContentHashes(tableArtifact);
  const facts = new Map<string, CurrentBundleLoad>();
  const inputPackFingerprints: Record<string, string> = {};
  const fingerprints: Record<string, string> = {};
  for (const taskId of taskIds) {
    const load = loads.load(taskId);
    const pack = packs.get(taskId);
    if (!pack) {
      if (taskId === options.taskId)
        throw new TargetFieldCausalSliceStaleError("INPUT_PACK", `${taskId}:Input Pack missing`);
      inputPackFingerprints[taskId] = sha256(canonicalJson({ state: "INPUT_PACK_MISSING" }));
      fingerprints[taskId] = sha256(canonicalJson({ state: load.state, issues: load.issues }));
      continue;
    }
    const expectedTaskHash = expectedTaskHashes.get(taskId);
    if (!expectedTaskHash || expectedTaskHash !== text(pack.document.contentHash)) {
      if (taskId === options.taskId)
        throw new TargetFieldCausalSliceStaleError(
          expectedTaskHash ? "INPUT_PACK" : "TABLE_MULTI_HOP",
          `${taskId}:task content hash expected=${expectedTaskHash ?? "MISSING"} actual=${text(pack.document.contentHash) ?? "MISSING"}`,
        );
      inputPackFingerprints[taskId] = sha256(canonicalJson({
        state: expectedTaskHash ? "TASK_CONTENT_HASH_MISMATCH" : "TASK_CONTENT_HASH_MISSING",
        expectedTaskHash: expectedTaskHash ?? null,
        actualTaskHash: text(pack.document.contentHash),
      }));
      fingerprints[taskId] = sha256(canonicalJson({ state: "NOT_USED" }));
      continue;
    }
    if ((load.state !== "CURRENT_L1" && load.state !== "LEGACY_NOT_L1") || !load.manifest) {
      if (taskId === options.taskId)
        throw new TargetFieldCausalSliceStaleError("MACHINE_FACTS", `${taskId}:${load.state}:${load.issues.join(";")}`);
      inputPackFingerprints[taskId] = sha256(canonicalJson({
        taskContentHash: expectedTaskHash,
        state: load.state,
      }));
      fingerprints[taskId] = sha256(canonicalJson({
        state: load.state,
        issues: load.issues,
      }));
      continue;
    }
    const provenance = record(record(load.manifest).inputs).input_pack;
    if (text(provenance?.task_content_hash) !== text(pack.document.contentHash)) {
      if (taskId === options.taskId)
        throw new TargetFieldCausalSliceStaleError("MACHINE_FACTS", `${taskId}:task content hash mismatch`);
      inputPackFingerprints[taskId] = sha256(canonicalJson({ state: "FACTS_TASK_HASH_MISMATCH" }));
      fingerprints[taskId] = sha256(canonicalJson({ state: "NOT_USED" }));
      continue;
    }
    const selectedSql = selectLineageSql(options.dataRoot, pack.path, pack.document);
    if (
      text(provenance?.sql_sha256) !== null &&
      text(provenance?.sql_sha256) !== selectedSql.selected.sha256
    ) {
      if (taskId === options.taskId)
        throw new TargetFieldCausalSliceStaleError("MACHINE_FACTS", `${taskId}:SQL snapshot hash mismatch`);
      inputPackFingerprints[taskId] = sha256(canonicalJson({ state: "FACTS_SQL_HASH_MISMATCH" }));
      fingerprints[taskId] = sha256(canonicalJson({ state: "NOT_USED" }));
      continue;
    }
    if (
      text(provenance?.analysis_sql_sha256) !== null &&
      text(provenance?.analysis_sql_sha256) !== selectedSql.selected.analysisSha256
    ) {
      if (taskId === options.taskId)
        throw new TargetFieldCausalSliceStaleError("MACHINE_FACTS", `${taskId}:analysis SQL snapshot hash mismatch`);
      inputPackFingerprints[taskId] = sha256(canonicalJson({ state: "FACTS_ANALYSIS_SQL_HASH_MISMATCH" }));
      fingerprints[taskId] = sha256(canonicalJson({ state: "NOT_USED" }));
      continue;
    }
    const expectedTableHash = text(provenance?.table_content_hash);
    const expectedDdlHash = text(provenance?.ddl_sha256);
    if (
      (expectedTableHash !== null || expectedDdlHash !== null) &&
      (!pack.target ||
        (expectedTableHash !== null && pack.target.tableContentHash !== expectedTableHash) ||
        (expectedDdlHash !== null && pack.target.ddlSha256 !== expectedDdlHash))
    ) {
      if (taskId === options.taskId)
        throw new TargetFieldCausalSliceStaleError("INPUT_PACK", `${taskId}:target table/DDL snapshot hash mismatch`);
      inputPackFingerprints[taskId] = sha256(canonicalJson({ state: "FACTS_TABLE_DDL_HASH_MISMATCH" }));
      fingerprints[taskId] = sha256(canonicalJson({ state: "NOT_USED" }));
      continue;
    }
    inputPackFingerprints[taskId] = sha256(canonicalJson({
      taskContentHash: expectedTaskHash,
      sqlSha256: selectedSql.selected.sha256,
      analysisSqlSha256: selectedSql.selected.analysisSha256,
      tableContentHash: pack.target?.tableContentHash ?? null,
      ddlSha256: pack.target?.ddlSha256 ?? null,
      schemaBundleSha256: text(record(record(load.manifest).inputs).schema_bundle_sha256),
    }));
    fingerprints[taskId] = text(load.manifestSha256) ?? sha256(canonicalJson(load.manifest));
    facts.set(taskId, load);
  }
  if (options.legacyFieldLineage) {
    const legacy = readJson(options.legacyFieldLineage, "LEGACY_VALUE_EVIDENCE");
    const request = record(legacy.request);
    if (text(request.rootTaskId) !== options.taskId || text(request.rootTable)?.toLowerCase() !== options.targetTable.toLowerCase())
      throw new TargetFieldCausalSliceStaleError("LEGACY_VALUE_EVIDENCE", "request does not match causal-slice target");
  }
  return {
    facts,
    inputPackFingerprint: sha256(canonicalJson(inputPackFingerprints)),
    machineFactsFingerprint: sha256(canonicalJson(fingerprints)),
  };
}

export function reconcileTargetFieldCausalSlice(
  options: TargetFieldCausalSliceOptions,
): CausalSliceArtifact {
  if (!options.writeObservationIds || options.writeObservationIds.length === 0)
    throw new Error("ROOT_WRITE_OBSERVATION_REQUIRED");
  const dataRoot = resolve(options.dataRoot);
  const factsRoot = resolve(options.factsRoot);
  const producerIndex = readJson(options.producerIndex, "PRODUCER_INDEX");
  const tableArtifact = readJson(options.tableMultiHop, "TABLE_MULTI_HOP");
  try {
    validateTableProducerIndex(producerIndex);
  } catch (error) {
    throw new TargetFieldCausalSliceStaleError(
      "PRODUCER_INDEX",
      error instanceof Error ? error.message : String(error),
    );
  }
  try {
    validateMultiHopReconciliation(tableArtifact);
  } catch (error) {
    throw new TargetFieldCausalSliceStaleError(
      "TABLE_MULTI_HOP",
      error instanceof Error ? error.message : String(error),
    );
  }
  const rootTaskId = text(tableArtifact.rootTaskId) ?? options.taskId;
  if (rootTaskId !== options.taskId)
    throw new TargetFieldCausalSliceStaleError("TABLE_MULTI_HOP", `root task expected=${options.taskId} actual=${rootTaskId}`);
  const catalog = loadPhysicalTableCatalog(dataRoot, { lazyDdl: true });
  const taskPathIndex = indexTaskInputPacks(dataRoot);
  const packs = loadPhysicalFieldExpanderTaskPacks(dataRoot, catalog, taskPathIndex);
  const bundleReader = createCurrentTaskBundleReader(factsRoot);
  const taskIds = candidateTaskIds(tableArtifact, options.taskId);
  const preflightResult = preflight(options, producerIndex, tableArtifact, taskIds, packs, bundleReader);
  const validatedTableKeys = new Set(
    [...preflightResult.facts.keys()]
      .map((taskId) => packs.get(taskId)?.target)
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null && entry !== undefined)
      .map((entry) => physicalTableKey(entry)),
  );
  const rootPack = packs.get(options.taskId);
  const rootLoad = preflightResult.facts.get(options.taskId);
  if (!rootPack || !rootLoad) throw new TargetFieldCausalSliceStaleError("MACHINE_FACTS", `${options.taskId}:root unavailable`);
  const table = targetEntry(catalog, rootPack, options.targetTable);
  const bindings = rootLoad.records["output-field-bindings.jsonl"] ?? [];
  const availableWriteObservationIds = new Set(
    bindings
      .filter((binding) => text(binding.target_dataset)?.toLowerCase() === table.qualifiedName.toLowerCase())
      .map((binding) => text(binding.write_observation_id))
      .filter((value): value is string => value !== null),
  );
  for (const writeObservationId of options.writeObservationIds)
    if (!availableWriteObservationIds.has(writeObservationId))
      throw new Error(`ROOT_WRITE_OBSERVATION_UNRESOLVED:${writeObservationId}`);
  const requestedFields = options.fields ?? [];
  const rootFields = outputRoots(options.taskId, rootLoad, table, requestedFields);
  if (rootFields.length === 0)
    throw new Error(`ROOT_TARGET_FIELDS_UNRESOLVED:${options.targetTable}`);
  const rootTargetFieldIds = rootFields.map((root) => root.rootTargetFieldId);
  const candidateUniverse = projectCandidateUniverse({
    rootTargetFields: rootTargetFieldIds,
    tableArtifact,
    rootWriteObservationIds: options.writeObservationIds,
  });
  const allIdentities = new Map<string, PhysicalFieldIdentity>();
  for (const entry of catalog.entries.filter((candidate) =>
    validatedTableKeys.has(physicalTableKey(candidate)),
  ))
    for (const column of entry.columns) {
      const identity = physicalFieldForTable(entry, column);
      if (identity) allIdentities.set(physicalFieldKey(identity), identity);
    }
  const semanticDependencies = new Map<string, readonly SemanticDependencyNormalization[]>();
  const semanticDefinitions = new Map<string, SemanticDependencyDefinition>();
  const semanticApplications = new Map<string, SemanticDependencyApplication>();
  const semanticEdges = new Map<string, SemanticDependencyEdge>();
  const semanticGaps = new Map<string, SemanticDependencyGap>();
  const semanticEdgeIndex = new Map<string, SemanticDependencyEdge[]>();
  const initializedSemanticTasks = new Set<string>();
  const loadedSemanticSubjects = new Set<string>();
  const indexedSubjectKey = (taskId: string, subject: SemanticSubject): string =>
    subject.subjectKind === "PHYSICAL_FIELD"
      ? `${taskId}|field|${subject.physicalFieldId}`
      : `${taskId}|relation|${subject.relationOccurrenceId}`;
  const setCanonical = <T>(
    values: Map<string, T>,
    id: string,
    value: T,
    kind: string,
  ): void => {
    const previous = values.get(id);
    if (previous !== undefined && canonicalJson(previous) !== canonicalJson(value))
      throw new Error(`SEMANTIC_${kind}_ID_CONFLICT:${id}`);
    values.set(id, value);
  };
  const addNormalizations = (
    taskId: string,
    built: ReturnType<typeof buildPlanInputs>,
  ): void => {
    initializedSemanticTasks.add(taskId);
    for (const [id, identity] of built.identities)
      setCanonical(allIdentities, id, identity, "PHYSICAL_FIELD");
    for (const normalization of built.normalizations) {
      for (const definition of normalization.definitions)
        setCanonical(
          semanticDefinitions,
          definition.dependencyId,
          definition,
          "DEPENDENCY_DEFINITION",
        );
      for (const application of normalization.applications)
        setCanonical(
          semanticApplications,
          application.applicationId,
          application,
          "DEPENDENCY_APPLICATION",
        );
      for (const edge of normalization.edges)
        setCanonical(semanticEdges, edge.edgeId, edge, "DEPENDENCY_EDGE");
      for (const gap of normalization.gaps)
        setCanonical(semanticGaps, gap.gapId, gap, "DEPENDENCY_GAP");
      for (const edge of normalization.edges) {
        const key = indexedSubjectKey(taskId, edge.toSubject);
        const indexed = semanticEdgeIndex.get(key) ?? [];
        if (!indexed.some((item) => item.edgeId === edge.edgeId)) indexed.push(edge);
        semanticEdgeIndex.set(key, indexed);
      }
    }
  };
  const rootBuilt = buildPlanInputs(
    dataRoot,
    options.taskId,
    rootPack,
    rootLoad,
    catalog,
    validatedTableKeys,
    rootFields,
  );
  addNormalizations(options.taskId, rootBuilt);
  for (const root of rootFields)
    loadedSemanticSubjects.add(`${options.taskId}|${root.rootTargetFieldId}`);
  const loadSemanticEdges = (
    taskId: string,
    subject: SemanticSubject,
  ): readonly SemanticDependencyEdge[] | null => {
    const subjectIndexKey = indexedSubjectKey(taskId, subject);
    const current = semanticEdgeIndex.get(subjectIndexKey) ?? [];
    if (subject.subjectKind !== "PHYSICAL_FIELD")
      return initializedSemanticTasks.has(taskId) ? current : null;
    const cacheKey = `${taskId}|${subject.physicalFieldId}`;
    if (loadedSemanticSubjects.has(cacheKey)) return current;
    const pack = packs.get(taskId);
    const load = preflightResult.facts.get(taskId);
    const identity = allIdentities.get(subject.physicalFieldId);
    if (!pack || !load || !identity)
      return initializedSemanticTasks.has(taskId) ? current : null;
    const built = buildPlanInputs(dataRoot, taskId, pack, load, catalog, validatedTableKeys, [{
      rootTargetFieldId: subject.physicalFieldId,
      outputName: identity.column,
    }]);
    addNormalizations(taskId, built);
    loadedSemanticSubjects.add(cacheKey);
    return semanticEdgeIndex.get(subjectIndexKey) ?? [];
  };
  const expander = createPhysicalFieldExpander({
    dataRoot,
    catalog,
    tableLineage: tableArtifact,
    taskPacks: packs,
    loadFacts: (taskId) => preflightResult.facts.get(taskId) ?? bundleReader.load(taskId),
    factsPolicy: "current-only",
  }, { evidenceMode: "STRICT_CAUSAL" });
  const traversal = traverseCausalDependencies({
    roots: rootFields.map((root) => ({ rootTargetFieldId: root.rootTargetFieldId, taskId: options.taskId })),
    semanticDependencies,
    loadSemanticEdges,
    resolvePhysicalField: (id) => allIdentities.get(id) ?? null,
    expandPhysicalField: (request) => {
      const pack = packs.get(request.taskId);
      const load = preflightResult.facts.get(request.taskId);
      if (!pack || !load) return { classified: false, ambiguous: false, producers: [], candidates: [], gaps: [] };
      return expander.expand({
        consumerTaskId: request.taskId,
        consumerPack: pack,
        consumerLoad: load,
        sourceNodeId: request.sourceNodeId,
        source: request.field,
        expressionText: "",
        depth: request.depth,
        maxDepth: request.maxDepth,
        rootDependenceKind: request.rootDependenceKind,
        localDependenceKind: request.localEdgeKind,
        pathCertainty: request.pathCertainty,
      });
    },
    expandRelationOccurrence: () => ({
      // The dependency edge already carries the canonical Plan Facts refs.
      // Do not manufacture a second evidence identifier for the occurrence.
      evidenceRefs: [],
      relationOccurrences: [],
    }),
    options: {
      maxDepth: options.maxDepth ?? 25,
      maxValueStates: options.maxValueStates ?? 5000,
      maxValuePaths: options.maxValuePaths ?? 10000,
      maxControlStates: options.maxControlStates ?? 5000,
      maxControlPaths: options.maxControlPaths ?? 10000,
    },
  });
  const rootWriteProofs: RootWritePositiveProofInput[] = [];
  for (const root of rootFields) {
    for (const branch of candidateUniverse.branches.filter((candidate) => candidate.branchKind === "ROOT_WRITE")) {
      const evidenceRefs = bindings
      .filter((binding) =>
        text(binding.target_dataset)?.toLowerCase() === table.qualifiedName.toLowerCase() &&
        text(binding.target_field)?.toLowerCase() === root.outputName.toLowerCase() &&
        text(binding.write_observation_id) === branch.writeObservationId &&
        (branch.table?.qualifiedName === null || branch.table?.qualifiedName === undefined ||
          branch.table.qualifiedName.toLowerCase() === table.qualifiedName.toLowerCase()),
      )
      .flatMap((binding) => Array.isArray(binding.evidence_refs) ? binding.evidence_refs.map(String) : []);
      if (evidenceRefs.length > 0) rootWriteProofs.push({
        rootTargetFieldId: root.rootTargetFieldId,
        candidateBranchId: branch.candidateBranchId,
        pathCertainty: rootLoad.state === "CURRENT_L1" ? "CONFIRMED" : "CONDITIONAL",
        evidenceRefs,
      });
    }
  }
  const positive = assessPositiveCausalRelationships({
    candidateUniverse,
    traversal,
    assessmentPairs: buildAssessmentPairSkeleton(rootTargetFieldIds, candidateUniverse.branches),
    rootWriteProofs,
  });
  const positiveValidation = validatePositiveCausalAssessments(candidateUniverse, rootTargetFieldIds, traversal, positive);
  if (!positiveValidation.valid) throw new Error(`CAUSAL_ASSESSMENT_INVALID:${positiveValidation.errors.join(";")}`);
  const negative = assessNegativeCausalRelationships({
    candidateUniverse,
    traversal,
    assessments: positive.assessments,
    negativeProofRequests: options.negativeProofRequests ?? [],
    knownCuts: options.knownCuts ?? [],
  });
  const negativeValidation = validateNegativeCausalAssessments({ candidateUniverse, traversal, assessments: positive.assessments, negativeProofRequests: options.negativeProofRequests ?? [], knownCuts: options.knownCuts ?? [] }, negative);
  if (!negativeValidation.valid) throw new Error(`CAUSAL_NEGATIVE_PROOF_INVALID:${negativeValidation.errors.join(";")}`);
  const rerunSets = generateRerunSets({ candidateUniverse, rootTargetFieldIds, assessments: negative.assessments });
  const assessments = negative.assessments;
  const legacyHash = options.legacyFieldLineage && existsSync(resolve(options.legacyFieldLineage))
    ? sha256(readFileSync(resolve(options.legacyFieldLineage)))
    : null;
  const valueLimitReasons = sortedUnique(
    traversal.gaps
      .filter((gap) => gap.reasonCode.includes("VALUE") || gap.reasonCode === "MAX_DEPTH_REACHED")
      .map((gap) => gap.reasonCode),
  );
  const controlLimitReasons = sortedUnique(
    traversal.gaps
      .filter((gap) => gap.reasonCode.includes("CONTROL") || gap.reasonCode === "MAX_DEPTH_REACHED")
      .map((gap) => gap.reasonCode),
  );
  const artifactInput: CausalSliceArtifactInput = {
    schemaVersion: TARGET_FIELD_CAUSAL_SLICE_SCHEMA_VERSION,
    artifactType: TARGET_FIELD_CAUSAL_SLICE_ARTIFACT_TYPE,
    generatedAt: (options.now ?? (() => new Date().toISOString()))(),
    request: {
      rootTaskId: options.taskId,
      rootTable: table.qualifiedName,
      rootFields: rootTargetFieldIds,
      rootWriteObservationIds: sortedUnique(options.writeObservationIds ?? []),
      negativeProofMode: "SAFE_RULES_ONLY",
    },
    inputFingerprints: {
      inputPack: [{
        fingerprint: preflightResult.inputPackFingerprint,
        reference: resolve(options.dataRoot),
        artifactType: "TASK_SCOPED_INPUT_PACK_SET",
      }],
      machineFacts: [{
        fingerprint: preflightResult.machineFactsFingerprint,
        reference: resolve(options.factsRoot),
      }],
      producerIndex: [{
        fingerprint: requireFingerprint(producerIndex.contentHash, "contentHash", "PRODUCER_INDEX"),
        reference: resolve(options.producerIndex),
        artifactType: text(producerIndex.artifactType) ?? "TABLE_PRODUCER_INDEX",
      }],
      tableMultiHopArtifact: [{
        fingerprint: requireFingerprint(tableArtifact.contentHash, "contentHash", "TABLE_MULTI_HOP"),
        reference: resolve(options.tableMultiHop),
        artifactType: "TABLE_MULTI_HOP_RECONCILIATION",
      }],
      ...(legacyHash === null
        ? {}
        : { legacyFieldLineageValueEvidence: [{
            fingerprint: legacyHash,
            reference: resolve(options.legacyFieldLineage!),
            artifactType: "FIELD_MULTI_HOP_RECONCILIATION",
          }] }),
    },
    dependencies: {
      definitions: [...semanticDefinitions.values()],
      applications: [...semanticApplications.values()],
      edges: [...semanticEdges.values()],
      gaps: [...semanticGaps.values()],
    },
    candidateUniverse,
    traversal,
    limits: {
      maxDepth: traversal.options.maxDepth,
      value: {
        maxStates: traversal.options.maxValueStates,
        maxPaths: traversal.options.maxValuePaths,
        truncated: valueLimitReasons.length > 0,
        reasons: valueLimitReasons,
      },
      control: {
        maxStates: traversal.options.maxControlStates,
        maxPaths: traversal.options.maxControlPaths,
        truncated: controlLimitReasons.length > 0,
        reasons: controlLimitReasons,
      },
    },
    assessments,
    positiveProofs: positive.positiveProofs,
    negativeProofs: negative.negativeProofs,
    assessmentGaps: positive.gaps,
    rerunSets,
    boundaries: {
      staticSqlOnly: true,
      runtimeExecution: "NOT_EVALUATED",
      dataCorrectness: "NOT_EVALUATED",
      businessAcceptance: "NOT_EVALUATED",
    },
  };
  return canonicalizeCausalSliceArtifact(artifactInput);
}
