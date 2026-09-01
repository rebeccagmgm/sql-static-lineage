import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Schema, type SchemaMapping } from "../../../../src/index.ts";
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
import { isCanonicalTargetWriteBundle } from "../target-write-evidence-resolver.ts";
import {
  validateTaskDocument,
  type TaskDocument,
} from "../../../input/shared/input-pack.ts";
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
  SemanticOccurrenceScope,
  SemanticSubject,
} from "./semantic-dependency-contract.ts";
import {
  makeSemanticOccurrenceScope,
  semanticWriteOccurrenceKey,
} from "./semantic-dependency-contract.ts";
import {
  makeWriteScopedPlanInputGap,
  resolveWriteScopedPlanInputs,
  type RootCriterion,
  type WriteScopedPlanInputGap,
} from "./write-scoped-plan-inputs.ts";
import { buildWriteScopedPlans } from "./write-scoped-plan-builder.ts";
import { resolveUnambiguousRelationProducerScopes } from "./relation-producer-scope.ts";
import { guardOccurrenceExactPhysicalExpansion } from "./strict-physical-expansion.ts";
import {
  projectCandidateUniverse,
  buildAssessmentPairSkeleton,
  type CandidatePhysicalTable,
  type CandidateUniverse,
} from "./candidate-universe.ts";
import {
  traverseCausalDependencies,
  type CausalTraversalResult,
  type ProducerScopeResolutionRequest,
  type ResolvedProducerScope,
  type SemanticTraversalLoadRequest,
  type SemanticTraversalLoadResult,
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
  | "LEGACY_VALUE_EVIDENCE"
  | "CALCITE_DIFFERENTIAL";

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

function records(value: unknown): readonly JsonRecord[] {
  return Array.isArray(value)
    ? value.map(record)
    : [];
}

/**
 * Relation ids have several canonical representations across the Plan Facts,
 * Machine Facts and table-multi-hop layers.  Compare only explicit id aliases;
 * never fall back to a table or column name, since self-joins depend on this
 * distinction.
 */
function relationIdAliases(value: string): readonly string[] {
  const aliases = new Set<string>([value, value.toLowerCase()]);
  const add = (candidate: string | undefined): void => {
    if (candidate) {
      aliases.add(candidate);
      aliases.add(candidate.toLowerCase());
    }
  };
  const relationMarker = value.lastIndexOf(":relation:");
  if (relationMarker >= 0) add(value.slice(relationMarker + ":relation:".length));
  const localRelation = value.match(/^relation:\d+:(.+)$/i);
  if (localRelation) add(localRelation[1]);
  const queryRelation = value.match(/^query#\d+:(.+)$/i);
  if (queryRelation) add(queryRelation[1]);
  return [...aliases];
}

function sameRelationReference(left: string, right: string): boolean {
  const rightAliases = new Set(relationIdAliases(right));
  return relationIdAliases(left).some((alias) => rightAliases.has(alias));
}

function relationChildren(relation: JsonRecord): readonly string[] {
  const type = text(relation.type)?.toLowerCase();
  if (type === "join")
    return [text(relation.left), text(relation.right)].filter(
      (value): value is string => value !== null,
    );
  if (type === "setop")
    return Array.isArray(relation.branches)
      ? relation.branches.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [];
  const source = text(relation.source);
  return source ? [source] : [];
}

function relationEntries(load: CurrentBundleLoad): readonly JsonRecord[] {
  return records(load.records["relation-nodes.jsonl"]);
}

function relationEntryId(entry: JsonRecord): string | null {
  return text(entry.relation_id) ?? text(record(entry.relation).id);
}

function relationEntryMatches(entry: JsonRecord, requestedId: string): boolean {
  const id = relationEntryId(entry);
  return id !== null && sameRelationReference(id, requestedId);
}

interface ScopedRelationReference {
  readonly taskId: string | null;
  readonly statementIndex: number;
}

function scopedRelationReference(value: string): ScopedRelationReference | null {
  const machineFacts = value.match(
    /^task:([^:]+):statement:(\d+):relation:.+$/i,
  );
  const planOccurrence = value.match(/^relation:(\d+):.+$/i);
  const legacyOccurrence = value.match(/^query#(\d+):.+$/i);
  const match = machineFacts ?? planOccurrence ?? legacyOccurrence;
  if (!match) return null;
  const statementIndex = Number(match[machineFacts ? 2 : 1]);
  if (!Number.isSafeInteger(statementIndex) || statementIndex < 0) return null;
  return {
    taskId: machineFacts ? machineFacts[1]! : null,
    statementIndex,
  };
}

function machineFactsRelationScope(
  value: string,
): { readonly taskId: string; readonly statementIndex: number } | null {
  const scope = scopedRelationReference(value);
  return scope?.taskId ? { taskId: scope.taskId, statementIndex: scope.statementIndex } : null;
}

/**
 * Resolve relation descendants only inside the statement occurrence proven by
 * both statements.jsonl and globally-scoped relation ids.  Local-id aliases
 * are considered only after this boundary is fixed, so structurally identical
 * sibling INSERT statements cannot contaminate one another.
 */
export function selectStatementScopedRelationReads(input: {
  readonly taskId: string;
  readonly statements: readonly JsonRecord[];
  readonly relations: readonly JsonRecord[];
  readonly requestedRelationId: string;
}): readonly JsonRecord[] {
  const requestedScope = scopedRelationReference(input.requestedRelationId);
  if (
    !requestedScope ||
    (requestedScope.taskId !== null && requestedScope.taskId !== input.taskId)
  ) return [];

  const statementRows = input.statements.filter((entry) =>
    text(entry.task_id) === input.taskId &&
    entry.statement_index === requestedScope.statementIndex
  );
  if (statementRows.length !== 1) return [];
  const statementId = text(statementRows[0]!.statement_id);
  if (!statementId) return [];

  const scopedEntries: JsonRecord[] = [];
  for (const entry of input.relations) {
    const relationId = relationEntryId(entry);
    const entryStatementId = text(entry.statement_id);
    if (!relationId) {
      if (entryStatementId === statementId) return [];
      continue;
    }
    const relationScope = machineFactsRelationScope(relationId);
    if (!relationScope) {
      if (entryStatementId === statementId) return [];
      continue;
    }
    if (
      relationScope.taskId !== input.taskId ||
      relationScope.statementIndex !== requestedScope.statementIndex
    ) continue;
    const relation = record(entry.relation);
    if (
      text(entry.task_id) !== input.taskId ||
      entryStatementId !== statementId ||
      text(relation.id) !== relationId
    ) return [];
    scopedEntries.push(entry);
  }

  const byId = new Map<string, JsonRecord>();
  for (const entry of scopedEntries) {
    const id = relationEntryId(entry)!;
    if (byId.has(id)) return [];
    byId.set(id, entry);
  }
  const uniqueMatch = (reference: string): JsonRecord | null => {
    const candidates = scopedEntries.filter((entry) =>
      relationEntryMatches(entry, reference)
    );
    return candidates.length === 1 ? candidates[0]! : null;
  };
  const requestedEntry = uniqueMatch(input.requestedRelationId);
  if (!requestedEntry) return [];

  const queue = [relationEntryId(requestedEntry)!];
  const seen = new Set<string>();
  const reads: JsonRecord[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const entry = byId.get(id);
    if (!entry) return [];
    const relation = record(entry.relation);
    if (text(relation.type)?.toLowerCase() === "read") {
      if (relation.is_cte !== true) reads.push(entry);
      continue;
    }
    for (const child of relationChildren(relation)) {
      const childScope = machineFactsRelationScope(child);
      if (
        !childScope ||
        childScope.taskId !== input.taskId ||
        childScope.statementIndex !== requestedScope.statementIndex
      ) return [];
      const childEntry = uniqueMatch(child);
      if (!childEntry) return [];
      queue.push(relationEntryId(childEntry)!);
    }
  }
  return reads;
}

function descendantReadEntries(
  load: CurrentBundleLoad,
  requestedId: string,
): readonly JsonRecord[] {
  return selectStatementScopedRelationReads({
    taskId: load.taskId,
    statements: records(load.records["statements.jsonl"]),
    relations: relationEntries(load),
    requestedRelationId: requestedId,
  });
}

function relationReadMatchesBridge(
  entry: JsonRecord,
  bridge: JsonRecord,
): boolean {
  const relationId = relationEntryId(entry);
  const relation = record(entry.relation);
  const occurrence = record(bridge.readOccurrence);
  const bridgeIds = [
    text(occurrence.readRelationId),
    text(occurrence.occurrenceId),
  ].filter((value): value is string => value !== null);
  const readIds = [
    relationId,
    text(relation.read_occurrence_id),
    text(record(relation.read_occurrence).occurrence_id),
  ].filter((value): value is string => value !== null);
  return bridgeIds.some((bridgeId) =>
    readIds.some((readId) => sameRelationReference(bridgeId, readId)),
  );
}

function occurrenceMatches(
  left: JsonRecord,
  right: JsonRecord,
): boolean {
  const leftIds = [text(left.occurrenceId), text(left.readOccurrenceId), text(left.readRelationId)]
    .filter((value): value is string => value !== null);
  const rightIds = [text(right.occurrenceId), text(right.readOccurrenceId), text(right.readRelationId)]
    .filter((value): value is string => value !== null);
  return leftIds.some((leftId) =>
    rightIds.some((rightId) => sameRelationReference(leftId, rightId)),
  );
}

function relationBridgeEvidenceRefs(
  tableArtifact: JsonRecord,
  bridge: JsonRecord,
): readonly string[] {
  const occurrence = record(bridge.readOccurrence);
  const identity = {
    consumerTaskId: text(bridge.consumerTaskId),
    producerTaskId: text(bridge.producerTaskId),
    table: record(bridge.table),
    readOccurrence: occurrence,
  };
  const refs = new Set<string>([
    `table-multi-hop:producer-bridge:${sha256(canonicalJson(identity))}`,
  ]);
  const tableName = text(record(bridge.table).qualifiedName)?.toLowerCase();
  const addArtifactEvidence = (kind: string, values: unknown): void => {
    for (const value of records(values)) {
      const source = text(value.source);
      const locator = text(value.locator);
      if (!source && !locator) continue;
      refs.add(`table-multi-hop:${kind}:${sha256(canonicalJson({ source, locator }))}`);
    }
  };
  for (const read of records(tableArtifact.readEdges)) {
    if (
      text(read.consumerTaskId) === text(bridge.consumerTaskId) &&
      text(record(read.table).qualifiedName)?.toLowerCase() === tableName &&
      occurrenceMatches(record(read.readOccurrence), occurrence)
    ) addArtifactEvidence("read", read.evidence);
  }
  for (const write of records(tableArtifact.writeEdges)) {
    if (
      text(write.producerTaskId) === text(bridge.producerTaskId) &&
      text(record(write.table).qualifiedName)?.toLowerCase() === tableName
    )
      for (const detail of records(write.writes)) addArtifactEvidence("write", detail.evidence);
  }
  return [...refs].sort((left, right) => left.localeCompare(right));
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

function buildPlanInputs(
  taskId: string,
  pack: PhysicalFieldExpanderTaskPack,
  load: CurrentBundleLoad,
  catalog: PhysicalTableCatalog,
  validatedTableKeys: ReadonlySet<string>,
  targetTable: ReturnType<typeof targetEntry>,
  writeObservationIds: readonly string[],
  requestedTargetFields: readonly string[],
  causalRootCriterion?: RootCriterion,
  exactOutputBindingIds?: ReadonlySet<string>,
): {
  readonly normalizations: readonly {
    readonly normalization: SemanticDependencyNormalization;
    readonly semanticScope: SemanticOccurrenceScope;
    readonly relationIds: ReadonlySet<string>;
  }[];
  readonly identities: ReadonlyMap<string, PhysicalFieldIdentity>;
  /** Relation ids come from the current Plan Facts graph, never from Calcite. */
  readonly relationIds: ReadonlySet<string>;
  /** Only these relation ids are the actual roots of the Plan Facts statement. */
  readonly rootRelationIds: ReadonlySet<string>;
  readonly rootCriteria: readonly RootCriterion[];
  readonly semanticScopes: readonly SemanticOccurrenceScope[];
  readonly scopeGaps: readonly WriteScopedPlanInputGap[];
} {
  const schema = schemaFor(load, pack);
  const identities = new Map<string, PhysicalFieldIdentity>();
  const normalizations: {
    readonly normalization: SemanticDependencyNormalization;
    readonly semanticScope: SemanticOccurrenceScope;
    readonly relationIds: ReadonlySet<string>;
  }[] = [];
  const relationIds = new Set<string>();
  const rootRelationIds = new Set<string>();
  const resolution = resolveWriteScopedPlanInputs({
    taskId,
    targetTableKey: physicalTableKey(targetTable),
    writeObservationIds,
    requestedTargetFields,
    load,
    resolveRootTargetFieldId: (targetFieldName) => {
      const identity = physicalFieldForTable(targetTable, targetFieldName);
      if (identity) identities.set(physicalFieldKey(identity), identity);
      return identity ? physicalFieldKey(identity) : null;
    },
  });
  const selectedCriteria = exactOutputBindingIds === undefined
    ? resolution.rootCriteria
    : resolution.rootCriteria.filter((criterion) =>
        exactOutputBindingIds.has(criterion.outputBindingId),
      );
  const built = buildWriteScopedPlans({
    rootCriteria: selectedCriteria,
    load,
    schema,
  });
  const scopes: SemanticOccurrenceScope[] = [];
  for (const scopedPlan of built.plans) {
    const scopedRelationIds = new Set(
      scopedPlan.plan.relations.map((relation) => relation.id),
    );
    for (const relationId of scopedRelationIds) relationIds.add(relationId);
    for (const root of scopedPlan.plan.roots) rootRelationIds.add(root);
    for (const localRootCriterion of scopedPlan.rootCriteria) {
      const semanticScope = makeSemanticOccurrenceScope({
        rootCriterion: localRootCriterion,
        evidenceRefs: localRootCriterion.evidenceRefs,
      });
      scopes.push(semanticScope);
      const normalized = normalizeSemanticDependencies({
        plan: scopedPlan.plan,
        rootCriterion: causalRootCriterion ?? localRootCriterion,
        localRootCriterion,
        semanticScope,
        ...(causalRootCriterion === undefined ||
        causalRootCriterion.rootTargetFieldId ===
          localRootCriterion.rootTargetFieldId
          ? {}
          : {
              targetSubject: {
                subjectKind: "PHYSICAL_FIELD" as const,
                physicalFieldId: localRootCriterion.rootTargetFieldId,
              },
            }),
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
      normalizations.push({
        normalization: normalized,
        semanticScope,
        relationIds: scopedRelationIds,
      });
    }
  }
  return {
    normalizations,
    identities,
    relationIds,
    rootRelationIds,
    rootCriteria: selectedCriteria,
    semanticScopes: scopes.sort((left, right) =>
      left.semanticScopeId.localeCompare(right.semanticScopeId),
    ),
    scopeGaps: [...resolution.gaps, ...built.gaps].sort((left, right) =>
      left.gapId.localeCompare(right.gapId),
    ),
  };
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
  const requestedFields = options.fields ?? [];
  const rootBuilt = buildPlanInputs(
    options.taskId,
    rootPack,
    rootLoad,
    catalog,
    validatedTableKeys,
    table,
    options.writeObservationIds,
    requestedFields,
  );
  const rootCriteria = rootBuilt.rootCriteria;
  const requestedFieldNames = requestedFields.length > 0
    ? requestedFields
    : bindings
        .filter((binding) =>
          text(binding.target_dataset)?.toLowerCase() ===
            table.qualifiedName.toLowerCase() &&
          options.writeObservationIds!.includes(
            text(binding.write_observation_id) ?? "",
          ),
        )
        .map((binding) => text(binding.target_field))
        .filter((value): value is string => value !== null);
  const requestRootFieldIds = sortedUnique(
    requestedFieldNames.flatMap((field) => {
      const identity = physicalFieldForTable(
        table,
        field.split(".").at(-1) ?? field,
      );
      return identity ? [physicalFieldKey(identity)] : [];
    }),
  );
  if (rootCriteria.length === 0 && requestRootFieldIds.length === 0)
    throw new Error(`ROOT_TARGET_FIELDS_UNRESOLVED:${options.targetTable}`);
  const rootTargetFieldIds = sortedUnique([
    ...requestRootFieldIds,
    ...rootCriteria.map((root) => root.rootTargetFieldId),
  ]);
  const candidateUniverse = projectCandidateUniverse({
    tableArtifact,
    rootCriteria,
    resolvePhysicalTable: (candidate: CandidatePhysicalTable): CandidatePhysicalTable | null => {
      const qualifiedName = text(candidate.qualifiedName)?.toLowerCase();
      const platform = text(candidate.platform)?.toLowerCase();
      const dataSource = text(candidate.dataSource)?.toLowerCase();
      if (!qualifiedName || !platform || !dataSource) return null;
      const matches = catalog.entries.filter((entry) =>
        entry.qualifiedName.toLowerCase() === qualifiedName &&
        entry.platform.toLowerCase() === platform &&
        entry.dataSource.toLowerCase() === dataSource &&
        (candidate.stableTableId === null ||
          candidate.stableTableId === undefined ||
          entry.stableTableId === candidate.stableTableId),
      );
      if (matches.length !== 1) return null;
      const resolved = matches[0]!;
      return {
        platform: resolved.platform,
        dataSource: resolved.dataSource,
        qualifiedName: resolved.qualifiedName,
        stableTableId: resolved.stableTableId,
        identityStatus: "SCHEMA_BACKED",
      };
    },
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
  const semanticScopeRegistry = new Map<string, SemanticOccurrenceScope>();
  const scopeGapRegistry = new Map<string, WriteScopedPlanInputGap>();
  const semanticEdgeIndex = new Map<string, SemanticDependencyEdge[]>();
  const semanticGapIndex = new Map<string, SemanticDependencyGap[]>();
  const initializedSemanticScopes = new Set<string>();
  const loadedSemanticSubjects = new Set<string>();
  const scopeLoadKey = (
    rootCriterionId: string,
    scope: SemanticOccurrenceScope,
    taskId: string,
  ): string =>
    canonicalJson({
      rootCriterionId,
      semanticWriteOccurrence: semanticWriteOccurrenceKey(scope),
      taskId,
    });
  const indexedSubjectKey = (
    rootCriterionId: string,
    scope: SemanticOccurrenceScope,
    taskId: string,
    subject: SemanticSubject,
  ): string =>
    canonicalJson({
      scope: scopeLoadKey(rootCriterionId, scope, taskId),
      subject,
    });
  const setCanonical = <T>(
    values: Map<string, T>,
    id: string,
    value: T,
    kind: string,
  ): void => {
    const previous = values.get(id);
    if (previous !== undefined && canonicalJson(previous) !== canonicalJson(value)) {
      // The same semantic object can be reached from more than one target
      // field/root build.  Its identity-bearing fields must agree, while the
      // proof-ref set is allowed to grow as additional occurrences are seen.
      // Do not apply this merge to unrelated object kinds or to any semantic
      // core conflict.
      const previousRecord = record(previous);
      const valueRecord = record(value);
      const { proofRefs: previousRefs, ...previousCore } = previousRecord;
      const { proofRefs: valueRefs, ...valueCore } = valueRecord;
      if (
        kind.startsWith("DEPENDENCY_") &&
        canonicalJson(previousCore) === canonicalJson(valueCore) &&
        Array.isArray(previousRefs) &&
        Array.isArray(valueRefs)
      ) {
        const refs = new Map<string, unknown>();
        for (const ref of [...previousRefs, ...valueRefs]) {
          const refRecord = record(ref);
          const refId = text(refRecord.proofRefId) ?? canonicalJson(ref);
          if (!refs.has(refId)) refs.set(refId, ref);
        }
        values.set(id, {
          ...previousRecord,
          proofRefs: [...refs.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([, ref]) => ref),
        } as T);
        return;
      }
      throw new Error(`SEMANTIC_${kind}_ID_CONFLICT:${id}`);
    }
    values.set(id, value);
  };
  const addSemanticScope = (scope: SemanticOccurrenceScope): void => {
    const previous = semanticScopeRegistry.get(scope.semanticScopeId);
    if (!previous) {
      semanticScopeRegistry.set(scope.semanticScopeId, scope);
      return;
    }
    const { evidenceRefs: previousRefs, ...previousIdentity } = previous;
    const { evidenceRefs: currentRefs, ...currentIdentity } = scope;
    if (canonicalJson(previousIdentity) !== canonicalJson(currentIdentity))
      throw new Error(`SEMANTIC_SCOPE_ID_CONFLICT:${scope.semanticScopeId}`);
    semanticScopeRegistry.set(scope.semanticScopeId, {
      ...previous,
      evidenceRefs: sortedUnique([...previousRefs, ...currentRefs]),
    });
  };
  const addNormalizations = (
    taskId: string,
    built: ReturnType<typeof buildPlanInputs>,
    causalRootCriterion?: RootCriterion,
  ): void => {
    for (const scope of built.semanticScopes) addSemanticScope(scope);
    for (const localRootCriterion of built.rootCriteria) {
      const scope = built.semanticScopes.find((candidate) =>
        candidate.writeObservationId ===
          localRootCriterion.rootWriteObservationId &&
        candidate.outputBindingId === localRootCriterion.outputBindingId,
      );
      if (scope)
        initializedSemanticScopes.add(
          scopeLoadKey(
            (causalRootCriterion ?? localRootCriterion).rootCriterionId,
            scope,
            taskId,
          ),
        );
    }
    for (const gap of built.scopeGaps) {
      const scopedGap = causalRootCriterion === undefined
        ? gap
        : makeWriteScopedPlanInputGap({
            rootCriterionId: causalRootCriterion.rootCriterionId,
            taskId: gap.taskId,
            targetTableKey: gap.targetTableKey,
            writeObservationId: gap.writeObservationId,
            targetFieldName: gap.targetFieldName,
            reasonCode: gap.reasonCode,
            message: gap.message,
            evidenceRefs: gap.evidenceRefs,
          });
      setCanonical(scopeGapRegistry, scopedGap.gapId, scopedGap, "WRITE_SCOPE_GAP");
    }
    for (const [id, identity] of built.identities)
      setCanonical(allIdentities, id, identity, "PHYSICAL_FIELD");
    for (const scopedNormalization of built.normalizations) {
      const normalization = scopedNormalization.normalization;
      for (const definition of normalization.definitions)
        if (definition.semanticScope) addSemanticScope(definition.semanticScope);
      for (const application of normalization.applications)
        if (application.semanticScope) addSemanticScope(application.semanticScope);
      for (const edge of normalization.edges)
        if (edge.semanticScope) addSemanticScope(edge.semanticScope);
      for (const gap of normalization.gaps)
        if (gap.semanticScope) addSemanticScope(gap.semanticScope);
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
        if (!edge.rootCriterionId || !edge.semanticScope) continue;
        const key = indexedSubjectKey(
          edge.rootCriterionId,
          edge.semanticScope,
          taskId,
          edge.toSubject,
        );
        const indexed = semanticEdgeIndex.get(key) ?? [];
        if (!indexed.some((item) => item.edgeId === edge.edgeId)) indexed.push(edge);
        semanticEdgeIndex.set(key, indexed);
      }
      for (const gap of normalization.gaps) {
        if (!gap.rootCriterionId || !gap.semanticScope) continue;
        const key = scopeLoadKey(
          gap.rootCriterionId,
          gap.semanticScope,
          taskId,
        );
        const indexed = semanticGapIndex.get(key) ?? [];
        if (!indexed.some((item) => item.gapId === gap.gapId)) indexed.push(gap);
        semanticGapIndex.set(key, indexed);
      }
    }
  };
  addNormalizations(options.taskId, rootBuilt);
  for (const root of rootCriteria) {
    const scope = rootBuilt.semanticScopes.find((candidate) =>
      candidate.writeObservationId === root.rootWriteObservationId &&
      candidate.outputBindingId === root.outputBindingId,
    );
    if (scope)
      loadedSemanticSubjects.add(
        indexedSubjectKey(
          root.rootCriterionId,
          scope,
          options.taskId,
          {
            subjectKind: "PHYSICAL_FIELD",
            physicalFieldId: root.rootTargetFieldId,
          },
        ),
      );
  }
  const loadSemanticEdges = (
    request: SemanticTraversalLoadRequest,
  ): SemanticTraversalLoadResult | null => {
    const subjectIndexKey = indexedSubjectKey(
      request.rootCriterion.rootCriterionId,
      request.semanticScope,
      request.taskId,
      request.subject,
    );
    const scopeKey = scopeLoadKey(
      request.rootCriterion.rootCriterionId,
      request.semanticScope,
      request.taskId,
    );
    const result = (): SemanticTraversalLoadResult => ({
      edges: semanticEdgeIndex.get(subjectIndexKey) ?? [],
      gaps: semanticGapIndex.get(scopeKey) ?? [],
    });
    if (loadedSemanticSubjects.has(subjectIndexKey)) return result();
    if (request.subject.subjectKind !== "PHYSICAL_FIELD")
      return initializedSemanticScopes.has(scopeKey) ? result() : null;
    const pack = packs.get(request.taskId);
    const load = preflightResult.facts.get(request.taskId);
    const identity = allIdentities.get(request.subject.physicalFieldId);
    if (!pack || !load || !identity)
      return initializedSemanticScopes.has(scopeKey) ? result() : null;
    const target = pack.target;
    if (!target)
      return initializedSemanticScopes.has(scopeKey) ? result() : null;
    const built = buildPlanInputs(
      request.taskId,
      pack,
      load,
      catalog,
      validatedTableKeys,
      target,
      [request.localRootCriterion.rootWriteObservationId],
      [request.localRootCriterion.targetFieldName],
      request.rootCriterion,
      new Set([request.localRootCriterion.outputBindingId]),
    );
    addNormalizations(request.taskId, built, request.rootCriterion);
    loadedSemanticSubjects.add(subjectIndexKey);
    return result();
  };
  const resolveProducerScopes = (
    request: ProducerScopeResolutionRequest,
  ): readonly ResolvedProducerScope[] => {
    const pack = packs.get(request.producerTaskId);
    const load = preflightResult.facts.get(request.producerTaskId);
    const target = pack?.target;
    if (!pack || !load || !target) return [];
    const exactBindingIds = new Set(
      request.producerBindings
        .map((binding) => text(binding.binding_id))
        .filter((value): value is string => value !== null),
    );
    const writeObservationIds = sortedUnique(
      request.producerBindings
        .map((binding) => text(binding.write_observation_id))
        .filter((value): value is string => value !== null),
    );
    if (
      exactBindingIds.size !== request.producerBindings.length ||
      writeObservationIds.length === 0
    ) return [];
    const resolution = resolveWriteScopedPlanInputs({
      taskId: request.producerTaskId,
      targetTableKey: physicalTableKey(target),
      writeObservationIds,
      requestedTargetFields: [request.producerField.column],
      load,
      resolveRootTargetFieldId: (targetFieldName) => {
        const identity = physicalFieldForTable(target, targetFieldName);
        if (identity) allIdentities.set(physicalFieldKey(identity), identity);
        return identity ? physicalFieldKey(identity) : null;
      },
    });
    const criteria = resolution.rootCriteria.filter((criterion) =>
      exactBindingIds.has(criterion.outputBindingId) &&
      criterion.rootTargetFieldId === physicalFieldKey(request.producerField),
    );
    if (
      resolution.gaps.length > 0 ||
      criteria.length !== exactBindingIds.size
    ) return [];
    return criteria
      .map((localRootCriterion) => ({
        localRootCriterion,
        semanticScope: makeSemanticOccurrenceScope({
          rootCriterion: localRootCriterion,
          evidenceRefs: [
            ...localRootCriterion.evidenceRefs,
            ...request.evidenceRefs,
          ],
        }),
      }))
      .sort((left, right) =>
        left.localRootCriterion.rootCriterionId.localeCompare(
          right.localRootCriterion.rootCriterionId,
        ),
      );
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
    roots: rootCriteria.flatMap((rootCriterion) => {
      const semanticScope = rootBuilt.semanticScopes.find((candidate) =>
        candidate.writeObservationId ===
          rootCriterion.rootWriteObservationId &&
        candidate.outputBindingId === rootCriterion.outputBindingId,
      );
      return semanticScope
        ? [{ rootCriterion, semanticScope }]
        : [];
    }),
    semanticDependencies,
    loadSemanticEdges,
    resolveProducerScopes,
    resolvePhysicalField: (id) => allIdentities.get(id) ?? null,
    expandPhysicalField: (request) => {
      const pack = packs.get(request.taskId);
      const load = preflightResult.facts.get(request.taskId);
      if (!pack || !load) return { classified: false, ambiguous: false, producers: [], candidates: [], gaps: [] };
      const expansion = expander.expand({
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
      return guardOccurrenceExactPhysicalExpansion({
        taskId: request.taskId,
        sourceNodeId: request.sourceNodeId,
        field: request.field,
        expansion,
      });
    },
    expandRelationOccurrence: (request) => {
      const load = preflightResult.facts.get(request.taskId);
      if (!load) return { relationOccurrences: [], relationBridges: [] };
      const producerBridges = records(tableArtifact.producerBridges);
      const relationReads = descendantReadEntries(
        load,
        request.relationOccurrenceId,
      );
      const relationBridges: {
        readonly producerTaskId: string;
        readonly readOccurrenceId: string;
        readonly producerRootCriterion?: RootCriterion;
        readonly producerSemanticScope?: SemanticOccurrenceScope;
        readonly evidenceStatus: "CONFIRMED" | "PROVISIONAL_LEGACY" | "UNRESOLVED";
        readonly evidenceRefs: readonly string[];
      }[] = [];
      for (const read of relationReads) {
        const relation = record(read.relation);
        const tableName = text(relation.table)?.toLowerCase();
        if (!tableName) continue;
        for (const bridge of producerBridges) {
          if (
            text(bridge.consumerTaskId) !== request.taskId ||
            text(bridge.producerTaskId) === null ||
            text(record(bridge.table).qualifiedName)?.toLowerCase() !== tableName ||
            !relationReadMatchesBridge(read, bridge)
          ) continue;
          const role = text(bridge.producerRole);
          const evidenceStatus = role === "PRIMARY"
            ? "CONFIRMED"
            : role === "ADDITIONAL"
              ? "PROVISIONAL_LEGACY"
              : "UNRESOLVED";
          const occurrenceId = text(record(bridge.readOccurrence).occurrenceId);
          if (!occurrenceId) continue;
          const producerTaskId = text(bridge.producerTaskId)!;
          const bridgeEvidenceRefs = relationBridgeEvidenceRefs(
            tableArtifact,
            bridge,
          );
          const producerLoad = preflightResult.facts.get(producerTaskId);
          const producerPack = packs.get(producerTaskId);
          const producerTarget = producerPack?.target;
          const unambiguousScopes = producerLoad && producerTarget
            ? resolveUnambiguousRelationProducerScopes<ResolvedProducerScope>({
                producerTaskId,
                targetTable: tableName,
                datasetWrites:
                  producerLoad.records["dataset-io.jsonl"] ?? [],
                outputBindings:
                  producerLoad.records["output-field-bindings.jsonl"] ?? [],
                resolveBinding: (binding) => {
                  const targetFieldName = text(binding.target_field);
                  const producerField = targetFieldName
                    ? physicalFieldForTable(producerTarget, targetFieldName)
                    : null;
                  if (!producerField) return [];
                  return resolveProducerScopes({
                    rootCriterion: request.rootCriterion,
                    localRootCriterion: request.localRootCriterion,
                    semanticScope: request.semanticScope,
                    producerTaskId,
                    producerField,
                    producerBindings: [binding],
                    readOccurrenceId: occurrenceId,
                    evidenceRefs: bridgeEvidenceRefs,
                  });
                },
              })
            : null;
          if (!unambiguousScopes) {
            relationBridges.push({
              producerTaskId,
              readOccurrenceId: occurrenceId,
              evidenceStatus,
              evidenceRefs: bridgeEvidenceRefs,
            });
            continue;
          }
          for (const resolvedScope of unambiguousScopes) {
            addSemanticScope(resolvedScope.semanticScope);
            relationBridges.push({
              producerTaskId,
              readOccurrenceId: occurrenceId,
              producerRootCriterion: resolvedScope.localRootCriterion,
              producerSemanticScope: resolvedScope.semanticScope,
              evidenceStatus,
              evidenceRefs: sortedUnique([
                ...bridgeEvidenceRefs,
                ...resolvedScope.semanticScope.evidenceRefs,
              ]),
            });
          }
        }
      }
      const deduplicated = new Map<string, typeof relationBridges[number]>();
      for (const bridge of relationBridges) {
        const key = `${bridge.producerTaskId}\u0000${bridge.readOccurrenceId}\u0000${bridge.producerRootCriterion?.rootCriterionId ?? "UNRESOLVED"}`;
        const previous = deduplicated.get(key);
        if (!previous) deduplicated.set(key, bridge);
        else
          deduplicated.set(key, {
            ...previous,
            evidenceRefs: sortedUnique([
              ...previous.evidenceRefs,
              ...bridge.evidenceRefs,
            ]),
            evidenceStatus: previous.evidenceStatus === "CONFIRMED" ||
              bridge.evidenceStatus === "CONFIRMED"
              ? "CONFIRMED"
              : previous.evidenceStatus === "PROVISIONAL_LEGACY" ||
                bridge.evidenceStatus === "PROVISIONAL_LEGACY"
                ? "PROVISIONAL_LEGACY"
                : "UNRESOLVED",
          });
      }
      return {
        relationOccurrences: [],
        relationBridges: [...deduplicated.values()].sort(
          (left, right) =>
            left.producerTaskId.localeCompare(right.producerTaskId) ||
            left.readOccurrenceId.localeCompare(right.readOccurrenceId),
        ),
      };
    },
    options: {
      maxDepth: options.maxDepth ?? 25,
      maxValueStates: options.maxValueStates ?? 5000,
      maxValuePaths: options.maxValuePaths ?? 10000,
      maxControlStates: options.maxControlStates ?? 5000,
      maxControlPaths: options.maxControlPaths ?? 10000,
    },
  });
  const rootWriteProofs: RootWritePositiveProofInput[] = [];
  for (const root of rootCriteria) {
    const rootQualifiedName = root.targetTableKey.split("|")[2]?.toLowerCase();
    if (!rootQualifiedName) continue;
    for (const branch of candidateUniverse.branches.filter((candidate) =>
      candidate.branchKind === "ROOT_WRITE" &&
      candidate.writeObservationId === root.rootWriteObservationId
    )) {
      const evidenceRefs = bindings
      .filter((binding) =>
        text(binding.binding_id) === root.outputBindingId &&
        text(binding.target_dataset)?.toLowerCase() === rootQualifiedName &&
        text(binding.target_field)?.toLowerCase() === root.targetFieldName.toLowerCase() &&
        text(binding.write_observation_id) === root.rootWriteObservationId &&
        (branch.table?.qualifiedName === null || branch.table?.qualifiedName === undefined ||
          branch.table.qualifiedName.toLowerCase() === rootQualifiedName),
      )
      .flatMap((binding) => [
        root.rootWriteObservationId,
        text(binding.binding_id),
        ...(Array.isArray(binding.evidence_refs)
          ? binding.evidence_refs.map(String)
          : []),
      ])
      .filter((ref): ref is string => ref !== null);
      if (evidenceRefs.length > 0) rootWriteProofs.push({
        rootCriterionId: root.rootCriterionId,
        rootTargetFieldId: root.rootTargetFieldId,
        candidateBranchId: branch.candidateBranchId,
        pathCertainty: isCanonicalTargetWriteBundle(rootLoad, options.taskId)
          ? "CONFIRMED"
          : "CONDITIONAL",
        evidenceRefs,
      });
    }
  }
  const positive = assessPositiveCausalRelationships({
    candidateUniverse,
    traversal,
    rootCriteria,
    assessmentPairs: buildAssessmentPairSkeleton(rootCriteria, candidateUniverse.branches),
    rootWriteProofs,
  });
  const positiveValidation = validatePositiveCausalAssessments(candidateUniverse, rootCriteria, traversal, positive);
  if (!positiveValidation.valid) throw new Error(`CAUSAL_ASSESSMENT_INVALID:${positiveValidation.errors.join(";")}`);
  const negative = assessNegativeCausalRelationships({
    candidateUniverse,
    traversal,
    rootCriteria,
    assessments: positive.assessments,
    negativeProofRequests: options.negativeProofRequests ?? [],
    knownCuts: options.knownCuts ?? [],
  });
  const negativeValidation = validateNegativeCausalAssessments({ candidateUniverse, traversal, rootCriteria, assessments: positive.assessments, negativeProofRequests: options.negativeProofRequests ?? [], knownCuts: options.knownCuts ?? [] }, negative);
  if (!negativeValidation.valid) throw new Error(`CAUSAL_NEGATIVE_PROOF_INVALID:${negativeValidation.errors.join(";")}`);
  const rerunSets = generateRerunSets({ candidateUniverse, rootCriteria, assessments: negative.assessments });
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
    rootCriteria,
    semanticScopes: [...semanticScopeRegistry.values()],
    scopeGaps: [...scopeGapRegistry.values()],
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
