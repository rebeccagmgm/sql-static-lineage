import { normalizeName } from "../../machine-facts/machine-facts-contract.ts";
import type {
  TaskLocalProjectionGap,
  TaskLocalSourceReadOccurrenceReason,
  TaskLocalSourceReadOccurrenceStatus,
} from "../task-local/contract.ts";
import { stableId } from "../task-local/ids.ts";
import {
  nearestSetopAncestor,
  readRelationsInSubtree,
  resolveScopeBinding,
  relationSubtree,
  type RelationRecord,
  type RelationTreeIndex,
} from "./relation-tree.ts";

type JsonRecord = Readonly<Record<string, unknown>>;

export interface SourceReadOccurrenceResolution {
  readonly sourceReadOccurrenceId: string | null;
  readonly sourceReadOccurrenceStatus: TaskLocalSourceReadOccurrenceStatus;
  readonly sourceReadOccurrenceReason: TaskLocalSourceReadOccurrenceReason | null;
  readonly sourceRelationId: string | null;
  readonly scopeBindingStatus: "NOT_REQUIRED" | "EXPLICIT" | "LEGACY_INFERRED";
  /** Explicit logical-source route used to reach this physical occurrence. */
  readonly scopeBindingPath?: readonly string[];
  readonly gap: TaskLocalProjectionGap | null;
}

export interface FieldExpressionContext {
  readonly expressionId: string;
  readonly expression: JsonRecord;
  readonly relationId: string | null;
  readonly ordinal: number | null;
  readonly originExpressionId?: string;
  readonly routeRelationPath?: readonly string[];
  /** Expressions traversed while routing a named output to this context. */
  readonly routeExpressionHops?: readonly JsonRecord[];
  readonly routePathHadAggregation?: boolean;
  readonly scopeBindingStatus?: "NOT_REQUIRED" | "EXPLICIT" | "LEGACY_INFERRED";
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function tableKey(value: string): string {
  return normalizeName(value);
}

function gapForStatus(input: {
  readonly taskId: string;
  readonly expressionId: string;
  readonly sourceTable: string;
  readonly sourceColumn: string;
  readonly status: TaskLocalSourceReadOccurrenceStatus;
  readonly reason: TaskLocalSourceReadOccurrenceReason;
}): TaskLocalProjectionGap {
  const reasonCode = input.status === "AMBIGUOUS"
    ? "FIELD_SOURCE_READ_OCCURRENCE_AMBIGUOUS"
    : "FIELD_SOURCE_READ_OCCURRENCE_UNRESOLVED";
  return {
    gapId: stableId("gap", {
      reasonCode,
      taskId: input.taskId,
      expressionId: input.expressionId,
      sourceTable: input.sourceTable,
      sourceColumn: input.sourceColumn,
    }),
    reasonCode,
    details: {
      taskId: input.taskId,
      expressionId: input.expressionId,
      sourceTable: input.sourceTable,
      sourceColumn: input.sourceColumn,
      sourceReadOccurrenceStatus: input.status,
      reasonCode: input.reason,
    },
  };
}

function unresolved(
  input: {
    readonly taskId: string;
    readonly expressionId: string;
    readonly sourceTable: string;
    readonly sourceColumn: string;
    readonly reason: TaskLocalSourceReadOccurrenceReason;
  },
): SourceReadOccurrenceResolution {
  return {
    sourceReadOccurrenceId: null,
    sourceReadOccurrenceStatus: "UNRESOLVED",
    sourceReadOccurrenceReason: input.reason,
    sourceRelationId: null,
    scopeBindingStatus: "NOT_REQUIRED",
    gap: gapForStatus({
      ...input,
      status: "UNRESOLVED",
    }),
  };
}

function ambiguous(
  input: {
    readonly taskId: string;
    readonly expressionId: string;
    readonly sourceTable: string;
    readonly sourceColumn: string;
    readonly reason: TaskLocalSourceReadOccurrenceReason;
  },
): SourceReadOccurrenceResolution {
  return {
    sourceReadOccurrenceId: null,
    sourceReadOccurrenceStatus: "AMBIGUOUS",
    sourceReadOccurrenceReason: input.reason,
    sourceRelationId: null,
    scopeBindingStatus: "NOT_REQUIRED",
    gap: gapForStatus({
      ...input,
      status: "AMBIGUOUS",
    }),
  };
}

function resolved(
  sourceReadOccurrenceId: string,
  sourceRelationId: string,
  scopeBindingStatus: SourceReadOccurrenceResolution["scopeBindingStatus"] = "NOT_REQUIRED",
  scopeBindingPath?: readonly string[],
): SourceReadOccurrenceResolution {
  return {
    sourceReadOccurrenceId,
    sourceReadOccurrenceStatus: "RESOLVED",
    sourceReadOccurrenceReason: null,
    sourceRelationId,
    scopeBindingStatus,
    ...(scopeBindingPath && scopeBindingPath.length > 0
      ? { scopeBindingPath: [...scopeBindingPath] }
      : {}),
    gap: null,
  };
}

function qualifierFromInput(inputField: JsonRecord): string | null {
  return text(inputField.qualifier) ?? text(inputField.alias);
}

/**
 * Extract table/alias qualifiers that appear as `qualifier.column` in expression text.
 * Ported from physical-field-expander expressionQualifiersForColumn — no task literals.
 */
export function expressionQualifiersForColumn(
  expressionText: string | null | undefined,
  column: string,
): readonly string[] {
  if (!expressionText?.trim() || !column.trim()) return [];
  const escapedColumn = column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?:^|[^\\w$])["\`\\[]?([A-Za-z_][\\w$]*)["\`\\]]?\\s*\\.\\s*["\`\\[]?${escapedColumn}["\`\\]]?(?![\\w$])`,
    "gi",
  );
  const qualifiers = new Set<string>();
  for (const match of expressionText.matchAll(pattern)) {
    if (match[1]) qualifiers.add(normalizeName(match[1]));
  }
  return [...qualifiers].sort((left, right) => left.localeCompare(right));
}

function readOccurrenceIdForRelation(
  readOccurrenceByRelationId: ReadonlyMap<string, string>,
  relationId: string,
): string | null {
  return readOccurrenceByRelationId.get(relationId) ?? relationId;
}

/** Facts mark CTE-body scopes with `.(child)`; expressions outside that body must not bind its reads. */
export function cteBodyScopePrefix(scopeId: string | null | undefined): string | null {
  if (!scopeId) return null;
  const marker = ".(child)";
  const index = scopeId.indexOf(marker);
  if (index < 0) return null;
  return scopeId.slice(0, index + marker.length);
}

export function isReadVisibleFromExpressionScope(
  expressionScopeId: string | null,
  readScopeId: string | null,
): boolean {
  const expressionCte = cteBodyScopePrefix(expressionScopeId);
  const readCte = cteBodyScopePrefix(readScopeId);
  if (readCte && readCte !== expressionCte) return false;
  return true;
}

function readVisibleFromExpression(input: {
  readonly index: RelationTreeIndex;
  readonly expressionRelationId: string;
  readonly read: RelationRecord;
}): boolean {
  const expressionScopeId = input.index.relations.get(input.expressionRelationId)?.scopeId ?? null;
  if (!isReadVisibleFromExpressionScope(expressionScopeId, input.read.scopeId)) return false;
  if (input.index.scopeBindingMode === "LEGACY") return true;
  for (const binding of input.index.scopeBindings) {
    if (
      binding.status !== "RESOLVED"
      || binding.sourceKind !== "cte"
      || !binding.targetRelationId
    ) continue;
    const targetSubtree = relationSubtree(input.index, binding.targetRelationId);
    if (
      targetSubtree.has(input.read.relationId)
      && !targetSubtree.has(input.expressionRelationId)
    ) return false;
  }
  return true;
}

type MatchingReadResult = Readonly<{
  relations: readonly RelationRecord[];
  scopeBindingStatusByRelationId: ReadonlyMap<
    string,
    SourceReadOccurrenceResolution["scopeBindingStatus"]
  >;
}>;

function matchingReads(input: {
  readonly index: RelationTreeIndex;
  readonly leafRelationId: string;
  readonly sourceTable: string;
  readonly sourceColumn: string;
  /** Logical CTE output read by this exact branch expression. */
  readonly cteOutputColumn: string | null;
  /** Optional logical relation qualifier from that same structured input. */
  readonly cteRelationQualifier: string | null;
  readonly bindingByReadRelation: ReadonlyMap<string, string>;
}): MatchingReadResult {
  const targetTable = tableKey(input.sourceTable);
  const targetColumn = normalizeName(input.sourceColumn);
  const matches = new Map<string, RelationRecord>();
  const scopeBindingStatusByRelationId = new Map<
    string,
    SourceReadOccurrenceResolution["scopeBindingStatus"]
  >();
  const reads = readRelationsInSubtree(input.index, input.leafRelationId);
  // A CTE bridge is sound only when this branch has one immediate input
  // relation.  Counting just source-backed reads silently ignores a physical
  // sibling in the same join, which makes an unqualified CTE reference look
  // unique when it is not.
  const directInputReads = reads.filter((relation) => readVisibleFromExpression({
    index: input.index,
    expressionRelationId: input.leafRelationId,
    read: relation,
  }));
  const referencedInputReads = input.cteRelationQualifier
    ? directInputReads.filter((relation) => relationMatchesQualifier(
      relation, input.cteRelationQualifier!, input.bindingByReadRelation,
    ))
    : directInputReads;
  // Unqualified inputs can cross a CTE only if the entire immediate logical
  // input domain is singular.  A matching CTE body must not hide a sibling
  // derived/CTE relation that could also supply the column.
  const hasUniqueDirectInput = referencedInputReads.length === 1;
  const cteBridges: Array<{
    readonly cteRead: RelationRecord;
    readonly cteBody: RelationRecord;
    readonly qualifier: string | null;
    readonly bindingStatus: "EXPLICIT" | "LEGACY_INFERRED";
  }> = [];
  for (const relation of reads) {
    if (relation.physicalDataset === targetTable) {
      if (readVisibleFromExpression({
        index: input.index,
        expressionRelationId: input.leafRelationId,
        read: relation,
      })) {
        matches.set(relation.relationId, relation);
        scopeBindingStatusByRelationId.set(relation.relationId, "NOT_REQUIRED");
      }
      continue;
    }

    // A CTE reference may cross its body only after three Facts agree: this
    // branch reads a named logical output, the body emits that output, and that
    // output lists this physical field.  A CTE source pointer or table match
    // alone is insufficient evidence.
    const explicitBinding = resolveScopeBinding(input.index, {
      ownerRelationId: relation.relationId,
      sourceKind: "cte",
    });
    const targetRelationId = explicitBinding.status === "RESOLVED"
      ? explicitBinding.binding.targetRelationId
      : explicitBinding.status === "LEGACY_ABSENT"
        ? relation.sourceRelationId
        : null;
    const bindingStatus = explicitBinding.status === "RESOLVED"
      ? "EXPLICIT" as const
      : explicitBinding.status === "LEGACY_ABSENT"
        ? "LEGACY_INFERRED" as const
        : null;
    if (
      !hasUniqueDirectInput
      || !targetRelationId
      || !bindingStatus
      || !input.cteOutputColumn
      || relation.relationId !== referencedInputReads[0]!.relationId
    ) continue;
    if (!readVisibleFromExpression({
      index: input.index,
      expressionRelationId: input.leafRelationId,
      read: relation,
    })) continue;
    const cteBody = input.index.relations.get(targetRelationId);
    if (!cteBody) continue;
    const witnesses = cteBody.outputInputColumns.filter((column) =>
      column.outputName === normalizeName(input.cteOutputColumn!)
      && column.physicalDataset === targetTable
      && column.physicalColumn === targetColumn,
    );
    if (witnesses.length !== 1) continue;
    cteBridges.push({
      cteRead: relation,
      cteBody,
      qualifier: witnesses[0]!.qualifier,
      bindingStatus,
    });
  }

  // A branch can only cross one logical CTE read for one unqualified input.
  // If Facts expose two viable reads, they have not established which relation
  // supplied the column; do not collapse their common physical dependency.
  if (cteBridges.length !== 1) {
    return {
      relations: [...matches.values()].sort((left, right) => left.relationId.localeCompare(right.relationId)),
      scopeBindingStatusByRelationId,
    };
  }
  const bridge = cteBridges[0]!;
  for (const sourceRead of readRelationsInSubtree(input.index, bridge.cteBody.relationId)) {
    const isDirectBodyRead = bridge.bindingStatus === "EXPLICIT"
      ? readVisibleFromExpression({
          index: input.index,
          expressionRelationId: bridge.cteBody.relationId,
          read: sourceRead,
        })
      : (() => {
          const bodyScope = bridge.cteBody.scopeId;
          const suffix = bodyScope && sourceRead.scopeId?.startsWith(`${bodyScope}.`)
            ? sourceRead.scopeId.slice(bodyScope.length)
            : sourceRead.scopeId === bodyScope ? "" : null;
          return suffix !== null && !suffix.includes(".(child)");
        })();
    if (
      isDirectBodyRead
      && sourceRead.physicalDataset === targetTable
      && (!bridge.qualifier || relationMatchesQualifier(
        sourceRead, bridge.qualifier, input.bindingByReadRelation,
      ))
    ) {
      matches.set(sourceRead.relationId, sourceRead);
      scopeBindingStatusByRelationId.set(sourceRead.relationId, bridge.bindingStatus);
    }
  }
  return {
    relations: [...matches.values()].sort((left, right) => left.relationId.localeCompare(right.relationId)),
    scopeBindingStatusByRelationId,
  };
}

function relationMatchesQualifier(
  relation: RelationRecord,
  qualifier: string,
  bindingByReadRelation: ReadonlyMap<string, string>,
): boolean {
  const normalizedQualifier = normalizeName(qualifier);
  const binding = bindingByReadRelation.get(relation.relationId);
  if (binding !== undefined && normalizeName(binding) === normalizedQualifier) {
    return true;
  }
  if (relation.binding === normalizedQualifier) return true;
  if (relation.scopeId) {
    const scopeTail = relation.scopeId.split(".").at(-1);
    if (scopeTail && normalizeName(scopeTail) === normalizedQualifier) return true;
  }
  const relationSegments = relation.relationId.toLowerCase().split(/[:.]/);
  return relationSegments.includes(normalizedQualifier);
}

function outputExpression(
  relationId: string,
  outputName: string,
  expressions: ReadonlyMap<string, readonly JsonRecord[]>,
): JsonRecord | null {
  const matches = (expressions.get(relationId) ?? []).filter((expression) =>
    normalizeName(String(expression.output ?? "")) === normalizeName(outputName),
  );
  return matches.length === 1 ? matches[0]! : null;
}

function physicalInput(input: JsonRecord, sourceTable: string, sourceColumn: string): boolean {
  return (Array.isArray(input.physical) ? input.physical : []).some((raw) => {
    const field = record(raw);
    return field !== null
      && normalizeName(String(field.table ?? "")) === normalizeName(sourceTable)
      && normalizeName(String(field.column ?? "")) === normalizeName(sourceColumn);
  });
}

/**
 * Route a physical input through named derived outputs only.  This is a
 * bounded fallback for an outer projection which current setop sinking cannot
 * reach through intervening joins/filters/aggregates.  It never guesses an
 * unqualified join side: every selected producer must be unique in Facts.
 */
export function routeNamedOutputContexts(input: {
  readonly expression: JsonRecord;
  readonly sourceTable: string;
  readonly sourceColumn: string;
  readonly relationExpressionsByRelationId: ReadonlyMap<
    string,
    readonly JsonRecord[]
  >;
  readonly expressionsByRelation: ReadonlyMap<
    string,
    ReadonlyMap<number, JsonRecord>
  >;
  readonly index: RelationTreeIndex;
  /** Select one structured reference when the outer expression reads the same physical field twice. */
  readonly referenceQualifier?: string;
}): readonly FieldExpressionContext[] {
  let current = input.expression;
  const originExpressionId = text(current.expression_id);
  const path: string[] = [];
  const routeExpressionHops: JsonRecord[] = [];
  let routePathHadAggregation = false;
  let routeScopeBindingStatus: FieldExpressionContext["scopeBindingStatus"] =
    "NOT_REQUIRED";
  const visited = new Set<string>();
  const terminalExplicitContext = (): readonly FieldExpressionContext[] => {
    if (
      routeScopeBindingStatus !== "EXPLICIT" ||
      !expressionAcceptsPhysicalSource(
        current,
        input.sourceTable,
        input.sourceColumn,
      )
    )
      return [];
    const expressionId = text(current.expression_id);
    const relationId = text(current.relation_id);
    if (!expressionId || !relationId) return [];
    return [
      {
        expressionId,
        expression: current,
        relationId,
        ordinal: numberValue(current.ordinal),
        originExpressionId: originExpressionId ?? undefined,
        routeRelationPath: [...path],
        routeExpressionHops: [...routeExpressionHops],
        routePathHadAggregation,
        scopeBindingStatus: "EXPLICIT",
      },
    ];
  };
  for (let depth = 0; depth < 16; depth += 1) {
    const relationId = text(current.relation_id);
    const outputName = text(current.output_name);
    if (!relationId || !outputName || visited.has(relationId)) return [];
    visited.add(relationId);
    path.push(relationId);
    const raw = outputExpression(
      relationId,
      outputName,
      input.relationExpressionsByRelationId,
    );
    if (!raw) return [];
    // `current` is the field-expression record and has the expression text,
    // physical dependency status, and relation id required for classification.
    // The relation-body expression below is only a routing witness.
    routeExpressionHops.push(current);
    const matchingInputs = (
      Array.isArray(raw.input_columns) ? raw.input_columns : []
    )
      .map(record)
      .filter(
        (item): item is JsonRecord =>
          item !== null &&
          physicalInput(item, input.sourceTable, input.sourceColumn),
      )
      .filter(
        (item) =>
          depth !== 0 ||
          input.referenceQualifier === undefined ||
          normalizeName(text(item.qualifier) ?? "") ===
            normalizeName(input.referenceQualifier),
      );
    if (matchingInputs.length !== 1) return [];
    const namedInput = matchingInputs[0]!;
    const inputName = text(namedInput.name);
    if (!inputName) return [];
    const qualifier = text(namedInput.qualifier);
    if (qualifier) {
      const currentScope = input.index.relations.get(relationId)?.scopeId;
      if (!currentScope) return [];
      const explicitBinding = resolveScopeBinding(input.index, {
        scopeId: currentScope,
        binding: qualifier,
      });
      const candidates =
        explicitBinding.status === "RESOLVED" &&
        explicitBinding.binding.targetRelationId
          ? [
              input.index.relations.get(
                explicitBinding.binding.targetRelationId,
              ),
            ]
              .filter(
                (relation): relation is RelationRecord =>
                  relation !== undefined,
              )
              .filter(
                (relation) =>
                  outputExpression(
                    relation.relationId,
                    inputName,
                    input.relationExpressionsByRelationId,
                  ) !== null,
              )
          : explicitBinding.status === "LEGACY_ABSENT"
            ? (() => {
                const expectedScope = `${currentScope}.${normalizeName(qualifier)}`;
                return [...relationSubtree(input.index, relationId)]
                  .map((id) => input.index.relations.get(id))
                  .filter(
                    (relation): relation is RelationRecord =>
                      relation !== undefined,
                  )
                  .filter(
                    (relation) =>
                      normalizeName(relation.scopeId ?? "") === expectedScope &&
                      outputExpression(
                        relation.relationId,
                        inputName,
                        input.relationExpressionsByRelationId,
                      ) !== null,
                  );
              })()
            : [];
      if (candidates.length !== 1) return [];
      const next = outputExpression(
        candidates[0]!.relationId,
        inputName,
        input.relationExpressionsByRelationId,
      );
      const nextExpression =
        next &&
        [
          ...(input.expressionsByRelation
            .get(candidates[0]!.relationId)
            ?.values() ?? []),
        ].filter(
          (item) =>
            normalizeName(String(item.output_name ?? "")) ===
            normalizeName(inputName),
        );
      if (!nextExpression || nextExpression.length !== 1) return [];
      current = nextExpression[0]!;
      if (explicitBinding.status === "RESOLVED") {
        routeScopeBindingStatus = "EXPLICIT";
      } else if (routeScopeBindingStatus !== "EXPLICIT") {
        routeScopeBindingStatus = "LEGACY_INFERRED";
      }
      continue;
    }
    let sourceId =
      input.index.relations.get(relationId)?.sourceRelationId ?? null;
    while (sourceId && !visited.has(sourceId)) {
      const source = input.index.relations.get(sourceId);
      if (!source) return [];
      path.push(sourceId);
      if (source.relationType === "setop") {
        const setopOrdinals = source.outputColumns
          .map((column, ordinal) =>
            normalizeName(column) === normalizeName(inputName) ? ordinal : null,
          )
          .filter((ordinal): ordinal is number => ordinal !== null);
        if (setopOrdinals.length !== 1) return [];
        const setopOrdinal = setopOrdinals[0]!;
        if (
          !hasCompleteSetopBranchEvidence({
            setopRelation: source,
            ordinal: setopOrdinal,
            expressionsByRelation: input.expressionsByRelation,
            index: input.index,
          })
        )
          return [];
        const contexts = expandSetopBranches({
          setopRelation: source,
          ordinal: setopOrdinal,
          expressionsByRelation: input.expressionsByRelation,
          index: input.index,
        });
        return contexts
          .map((context) => ({
            ...context,
            originExpressionId: originExpressionId ?? undefined,
            routeRelationPath: [...path, context.relationId ?? ""].filter(
              Boolean,
            ),
            routeExpressionHops: [...routeExpressionHops, context.expression],
            routePathHadAggregation,
            scopeBindingStatus: routeScopeBindingStatus,
          }))
          .filter((context) =>
            expressionAcceptsPhysicalSource(
              context.expression,
              input.sourceTable,
              input.sourceColumn,
            ),
          );
      }
      // The only non-setop hop observed for this repair is the aggregate that
      // directly supplies the setop output.  Do not treat arbitrary source
      // pointers (and their possible renames) as transparent projections.
      if (source.relationType !== "aggregate") return terminalExplicitContext();
      routePathHadAggregation = true;
      visited.add(sourceId);
      sourceId = source.sourceRelationId;
    }
    return terminalExplicitContext();
  }
  return [];
}

/**
 * Router fallback is stricter than the established setop expander.  A missing
 * branch expression or dependency record is unknown, not evidence that the
 * physical field is absent from that branch.  A present `input_fields: []`
 * (or explicit NO_PHYSICAL_INPUT) is the only safe non-dependency.
 */
function hasCompleteSetopBranchEvidence(input: {
  readonly setopRelation: RelationRecord;
  readonly ordinal: number;
  readonly expressionsByRelation: ReadonlyMap<string, ReadonlyMap<number, JsonRecord>>;
  readonly index: RelationTreeIndex;
  readonly seenSetops?: ReadonlySet<string>;
}): boolean {
  const seen = new Set(input.seenSetops ?? []);
  if (seen.has(input.setopRelation.relationId)) return false;
  seen.add(input.setopRelation.relationId);
  if (input.setopRelation.setopBranches.length === 0) return false;
  return input.setopRelation.setopBranches.every((branchRelationId) => {
    const branchRelation = input.index.relations.get(branchRelationId);
    if (!branchRelation) return false;
    if (branchRelation.relationType === "setop") {
      return hasCompleteSetopBranchEvidence({
        setopRelation: branchRelation,
        ordinal: input.ordinal,
        expressionsByRelation: input.expressionsByRelation,
        index: input.index,
        seenSetops: seen,
      });
    }
    const expression = input.expressionsByRelation.get(branchRelationId)?.get(input.ordinal);
    if (!expression) return false;
    const dependencyStatus = text(expression.input_dependency_status);
    const unresolvedInputs = expression.unresolved_input_columns;
    if (
      (Array.isArray(unresolvedInputs) && unresolvedInputs.length > 0)
      || dependencyStatus === "PARTIAL"
      || dependencyStatus === "UNRESOLVED"
      || dependencyStatus === "SQL_CANDIDATE"
    ) return false;
    const inputFields = expression.input_fields;
    if (!Array.isArray(inputFields)) return false;
    // A legacy non-empty list is sufficient evidence for the old producer.
    // An empty list is evidence of no dependency only when the producer says
    // so explicitly; otherwise it is an omitted/incomplete dependency record.
    return inputFields.length > 0 || dependencyStatus === "NO_PHYSICAL_INPUT";
  });
}

function expressionAcceptsPhysicalSource(
  expression: JsonRecord,
  sourceTable: string,
  sourceColumn: string,
): boolean {
  return (Array.isArray(expression.input_fields) ? expression.input_fields : []).some((raw) => {
    const field = record(raw);
    return field !== null
      && normalizeName(String(field.table ?? "")) === normalizeName(sourceTable)
      && normalizeName(String(field.column ?? "")) === normalizeName(sourceColumn);
  });
}

function narrowByQualifiers(input: {
  readonly matches: readonly RelationRecord[];
  readonly qualifiers: readonly string[];
  readonly bindingByReadRelation: ReadonlyMap<string, string>;
}): readonly RelationRecord[] {
  if (input.qualifiers.length === 0 || input.matches.length <= 1) return input.matches;
  const narrowed = input.matches.filter((relation) =>
    input.qualifiers.some((qualifier) =>
      relationMatchesQualifier(relation, qualifier, input.bindingByReadRelation),
    ),
  );
  return narrowed.length > 0 ? narrowed : input.matches;
}

export function resolveSourceReadOccurrence(input: {
  readonly taskId: string;
  readonly expressionId: string;
  readonly sourceTable: string;
  readonly sourceColumn: string;
  readonly inputField: JsonRecord;
  readonly expressionText?: string | null;
  /** A single structured reference, already separated from its sibling inputs. */
  readonly referenceQualifier?: string;
  /** Named CTE output from the branch relation's structured input_columns. */
  readonly cteOutputColumn?: string | null;
  readonly cteRelationQualifier?: string | null;
  readonly leafRelationId: string | null;
  readonly index: RelationTreeIndex;
  readonly readOccurrenceByRelationId: ReadonlyMap<string, string>;
  readonly bindingByReadRelation: ReadonlyMap<string, string>;
  readonly scopeBindingStatus?: SourceReadOccurrenceResolution["scopeBindingStatus"];
  readonly scopeBindingPath?: readonly string[];
}): SourceReadOccurrenceResolution {
  const base = {
    taskId: input.taskId,
    expressionId: input.expressionId,
    sourceTable: input.sourceTable,
    sourceColumn: input.sourceColumn,
  };
  if (!input.leafRelationId) {
    return unresolved({ ...base, reason: "MATERIALIZATION_LEAF_MISSING" });
  }

  const inputQualifier = qualifierFromInput(input.inputField);
  const textQualifiers = expressionQualifiersForColumn(
    input.expressionText,
    input.sourceColumn,
  );
  const qualifiers = [
    ...new Set([
      ...(inputQualifier ? [normalizeName(inputQualifier)] : []),
      ...textQualifiers,
    ]),
  ];

  const candidates = matchingReads({
    index: input.index,
    leafRelationId: input.leafRelationId,
    sourceTable: input.sourceTable,
    sourceColumn: input.sourceColumn,
    cteOutputColumn: input.cteOutputColumn ?? null,
    cteRelationQualifier: input.cteRelationQualifier ?? null,
    bindingByReadRelation: input.bindingByReadRelation,
  });
  const referenceQualifier = input.referenceQualifier;
  const matches = referenceQualifier
    ? candidates.relations.filter((relation) => relationMatchesQualifier(
      relation, referenceQualifier, input.bindingByReadRelation,
    ))
    : narrowByQualifiers({
      matches: candidates.relations,
      qualifiers,
      bindingByReadRelation: input.bindingByReadRelation,
    });
  if (matches.length === 1) {
    const relation = matches[0]!;
    const occurrenceId = readOccurrenceIdForRelation(
      input.readOccurrenceByRelationId,
      relation.relationId,
    );
    if (!occurrenceId) {
      return unresolved({ ...base, reason: "CTE_SCOPE_UNRESOLVED" });
    }
    return resolved(
      occurrenceId,
      relation.relationId,
      input.scopeBindingStatus
        ?? candidates.scopeBindingStatusByRelationId.get(relation.relationId)
        ?? "NOT_REQUIRED",
      input.scopeBindingStatus === "EXPLICIT" ? input.scopeBindingPath : undefined,
    );
  }
  if (matches.length > 1) {
    return ambiguous({ ...base, reason: "SELF_JOIN_NO_QUALIFIER" });
  }
  return unresolved({ ...base, reason: "CTE_SCOPE_UNRESOLVED" });
}

export function expressionsByRelationAndOrdinal(
  expressions: readonly JsonRecord[],
): ReadonlyMap<string, ReadonlyMap<number, JsonRecord>> {
  const byRelation = new Map<string, Map<number, JsonRecord>>();
  for (const expression of expressions) {
    const relationId = text(expression.relation_id);
    const ordinal = numberValue(expression.ordinal);
    if (!relationId || ordinal === null) continue;
    const ordinals = byRelation.get(relationId) ?? new Map<number, JsonRecord>();
    if (!ordinals.has(ordinal)) ordinals.set(ordinal, expression);
    byRelation.set(relationId, ordinals);
  }
  return byRelation;
}

export function expandSetopBranchExpressions(input: {
  readonly expression: JsonRecord;
  readonly expressionsByRelation: ReadonlyMap<string, ReadonlyMap<number, JsonRecord>>;
  readonly index: RelationTreeIndex;
}): readonly FieldExpressionContext[] {
  const expressionId = text(input.expression.expression_id);
  const relationId = text(input.expression.relation_id);
  const ordinal = numberValue(input.expression.ordinal);
  if (!expressionId || !relationId || ordinal === null) {
    return [{
      expressionId,
      expression: input.expression,
      relationId,
      ordinal,
    }].filter((item): item is FieldExpressionContext => item.expressionId !== null);
  }

  const directRelation = input.index.relations.get(relationId);
  if (directRelation?.relationType === "setop") {
    const nested = expandSetopBranches({
      setopRelation: directRelation,
      ordinal,
      expressionsByRelation: input.expressionsByRelation,
      index: input.index,
    });
    return nested.length > 0
      ? nested
      : [{
        expressionId,
        expression: input.expression,
        relationId,
        ordinal,
      }];
  }

  const setopAncestor = nearestSetopAncestor(input.index, relationId);
  if (setopAncestor?.setopBranches.length) {
    const branchContexts = expandSetopBranches({
      setopRelation: setopAncestor,
      ordinal,
      expressionsByRelation: input.expressionsByRelation,
      index: input.index,
    });
    return branchContexts.length > 0
      ? branchContexts
      : [{
        expressionId,
        expression: input.expression,
        relationId,
        ordinal,
      }];
  }

  // A projection can consume a derived setop through a join. Its ordinal is
  // local to the outer projection, so locate the qualified setop and sink by
  // its named output rather than accidentally treating sibling branches as a
  // self-join of the same physical source.
  const outputName = text(input.expression.output_name);
  const qualifiers = outputName
    ? expressionQualifiersForColumn(text(input.expression.expression_text), outputName)
    : [];
  const qualifiedSetop = setopForQualifiedOutput({
    index: input.index,
    relationId,
    qualifiers,
  });
  const setopOrdinal = qualifiedSetop && outputName
    ? uniqueOutputOrdinalInFirstBranch({
      setopRelation: qualifiedSetop,
      outputName,
      expressionsByRelation: input.expressionsByRelation,
    })
    : null;
  if (!qualifiedSetop || setopOrdinal === null || qualifiedSetop.setopBranches.length === 0) {
    return [{
      expressionId,
      expression: input.expression,
      relationId,
      ordinal,
    }];
  }
  const branchContexts = expandSetopBranches({
    setopRelation: qualifiedSetop,
    ordinal: setopOrdinal,
    expressionsByRelation: input.expressionsByRelation,
    index: input.index,
  });
  return branchContexts.length > 0
    ? branchContexts
    : [{
      expressionId,
      expression: input.expression,
      relationId,
      ordinal,
    }];
}

function setopForQualifiedOutput(input: {
  readonly index: RelationTreeIndex;
  readonly relationId: string;
  readonly qualifiers: readonly string[];
}): RelationRecord | null {
  if (input.qualifiers.length === 0) return null;
  const candidates = [...relationSubtree(input.index, input.relationId)]
    .map((relationId) => input.index.relations.get(relationId))
    .filter((relation): relation is RelationRecord =>
      relation?.relationType === "setop"
      && relation.scopeId !== null
      && input.qualifiers.some((qualifier) =>
        normalizeName(relation.scopeId!.split(".").at(-1) ?? "")
          === normalizeName(qualifier)
      )
    );
  return candidates.length === 1 ? candidates[0]! : null;
}

function uniqueOutputOrdinalInFirstBranch(input: {
  readonly setopRelation: RelationRecord;
  readonly outputName: string;
  readonly expressionsByRelation: ReadonlyMap<string, ReadonlyMap<number, JsonRecord>>;
}): number | null {
  const firstBranch = input.setopRelation.setopBranches[0];
  if (!firstBranch) return null;
  const matches = [...(input.expressionsByRelation.get(firstBranch)?.values() ?? [])]
    .filter((expression) =>
      normalizeName(String(expression.output_name ?? ""))
        === normalizeName(input.outputName)
    );
  return matches.length === 1 ? numberValue(matches[0]?.ordinal) : null;
}

function expandSetopBranches(input: {
  readonly setopRelation: RelationRecord;
  readonly ordinal: number;
  readonly expressionsByRelation: ReadonlyMap<string, ReadonlyMap<number, JsonRecord>>;
  readonly index: RelationTreeIndex;
  readonly seenSetops?: ReadonlySet<string>;
}): readonly FieldExpressionContext[] {
  const seen = new Set(input.seenSetops ?? []);
  if (seen.has(input.setopRelation.relationId)) return [];
  seen.add(input.setopRelation.relationId);

  const contexts: FieldExpressionContext[] = [];
  for (const branchRelationId of input.setopRelation.setopBranches) {
    const branchRelation = input.index.relations.get(branchRelationId);
    if (branchRelation?.relationType === "setop") {
      contexts.push(...expandSetopBranches({
        setopRelation: branchRelation,
        ordinal: input.ordinal,
        expressionsByRelation: input.expressionsByRelation,
        index: input.index,
        seenSetops: seen,
      }));
      continue;
    }

    const branchExpression = input.expressionsByRelation
      .get(branchRelationId)
      ?.get(input.ordinal);
    if (!branchExpression) continue;
    const expressionId = text(branchExpression.expression_id);
    if (!expressionId) continue;
    const expressionRelationId = text(branchExpression.relation_id) ?? branchRelationId;
    const expressionRelation = input.index.relations.get(expressionRelationId);
    if (expressionRelation?.relationType === "setop") {
      contexts.push(...expandSetopBranches({
        setopRelation: expressionRelation,
        ordinal: numberValue(branchExpression.ordinal) ?? input.ordinal,
        expressionsByRelation: input.expressionsByRelation,
        index: input.index,
        seenSetops: seen,
      }));
      continue;
    }
    contexts.push({
      expressionId,
      expression: branchExpression,
      relationId: expressionRelationId,
      ordinal: numberValue(branchExpression.ordinal),
    });
  }
  return contexts;
}

export function leafRelationIdForExpression(
  expression: JsonRecord,
  materializedLeafRelationId: string | null,
): string | null {
  return materializedLeafRelationId ?? text(expression.relation_id);
}
