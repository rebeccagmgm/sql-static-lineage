import { normalizeName } from "../../machine-facts/machine-facts-contract.ts";
import type { TaskLocalControlSide, TaskLocalJoinType } from "../task-local/contract.ts";

export type RelationRecord = Readonly<{
  readonly relationId: string;
  readonly taskId: string | null;
  readonly statementId: string | null;
  readonly relationType: string;
  readonly physicalDataset: string | null;
  readonly binding: string | null;
  readonly isCte: boolean;
  /** Relation that supplies a logical CTE/read alias, when Facts expose one. */
  readonly sourceRelationId: string | null;
  /** Proven physical inputs of a named output from this relation. */
  readonly outputInputColumns: readonly RelationOutputInputColumn[];
  readonly outputColumns: readonly string[];
  readonly joinType: string | null;
  readonly leftRelationId: string | null;
  readonly rightRelationId: string | null;
  readonly setopBranches: readonly string[];
  readonly scopeId: string | null;
  readonly scopeBindingsDeclared: boolean;
  readonly scopeBindings: readonly ScopeBindingRecord[];
}>;

export type ScopeBindingRecord = Readonly<{
  readonly scopeId: string | null;
  readonly relationId: string | null;
  readonly binding: string | null;
  readonly sourceKind: string | null;
  readonly targetScopeId: string | null;
  readonly targetRelationId: string | null;
  readonly status: "RESOLVED" | "UNRESOLVED";
  readonly reason: string | null;
}>;

export type ScopeBindingResolution =
  | Readonly<{ status: "RESOLVED"; binding: ScopeBindingRecord }>
  | Readonly<{ status: "ABSENT" | "LEGACY_ABSENT" | "AMBIGUOUS" | "INVALID" }>;

export type RelationOutputInputColumn = Readonly<{
  readonly outputName: string;
  readonly inputName: string;
  readonly physicalDataset: string;
  readonly physicalColumn: string;
  readonly qualifier: string | null;
}>;

export interface RelationTreeIndex {
  readonly relations: ReadonlyMap<string, RelationRecord>;
  readonly incomingByTo: ReadonlyMap<string, readonly string[]>;
  readonly scopeBindingMode: "EXPLICIT" | "LEGACY" | "MIXED";
  readonly scopeBindings: readonly ScopeBindingRecord[];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function relationBody(relation: Record<string, unknown>): Record<string, unknown> {
  return record(relation.relation) ?? relation;
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function unresolvedBinding(raw: Record<string, unknown>, reason: string): ScopeBindingRecord {
  return {
    scopeId: text(raw.scope_id),
    relationId: text(raw.relation_id),
    binding: text(raw.binding),
    sourceKind: text(raw.source_kind)?.toLowerCase() ?? null,
    targetScopeId: text(raw.target_scope_id),
    targetRelationId: text(raw.target_relation_id),
    status: "UNRESOLVED",
    reason,
  };
}

function outputInputColumns(body: Record<string, unknown>): readonly RelationOutputInputColumn[] {
  const expressions = Array.isArray(body.expressions) ? body.expressions : [];
  const columns: RelationOutputInputColumn[] = [];
  for (const rawExpression of expressions) {
    const expression = record(rawExpression);
    const outputName = text(expression?.output);
    if (!expression || !outputName) continue;
    const inputs = Array.isArray(expression.input_columns) ? expression.input_columns : [];
    for (const rawInput of inputs) {
      const input = record(rawInput);
      const inputName = text(input?.name);
      const physical = Array.isArray(input?.physical) ? input.physical : [];
      if (!input || !inputName) continue;
      for (const rawPhysical of physical) {
        const item = record(rawPhysical);
        const physicalDataset = text(item?.table);
        const physicalColumn = text(item?.column);
        if (!item || !physicalDataset || !physicalColumn) continue;
        columns.push({
          outputName: normalizeName(outputName),
          inputName: normalizeName(inputName),
          physicalDataset: normalizeName(physicalDataset),
          physicalColumn: normalizeName(physicalColumn),
          qualifier: text(input.qualifier) ? normalizeName(text(input.qualifier)!) : null,
        });
      }
    }
  }
  return columns;
}

export function buildRelationTreeIndex(
  relationNodes: readonly Record<string, unknown>[],
): RelationTreeIndex {
  const relations = new Map<string, RelationRecord>();
  const rawBindingsByOwner = new Map<string, readonly Record<string, unknown>[]>();
  let declaredCount = 0;
  for (const row of relationNodes) {
    const relationId = text(row.relation_id);
    if (!relationId) continue;
    const body = relationBody(row);
    const relationType = (
      text(row.relation_type)
      ?? text(body.type)
      ?? ""
    ).toLowerCase();
    const physicalDataset = text(row.physical_dataset)
      ?? text(body.table)
      ?? text(body.physical_dataset);
    const branches = Array.isArray(body.branches)
      ? body.branches.map((value) => String(value)).filter(Boolean)
      : [];
    const outputColumns = Array.isArray(body.output_columns)
      ? body.output_columns.map((value) => text(value)).filter((value): value is string => value !== null)
      : [];
    const scopeBindingsDeclared = hasOwn(body, "scope_bindings");
    if (scopeBindingsDeclared) declaredCount += 1;
    const rawScopeBindings = Array.isArray(body.scope_bindings)
      ? body.scope_bindings.map(record).filter((item): item is Record<string, unknown> => item !== null)
      : [];
    rawBindingsByOwner.set(relationId, rawScopeBindings);
    relations.set(relationId, {
      relationId,
      taskId: text(row.task_id),
      statementId: text(row.statement_id),
      relationType,
      physicalDataset: physicalDataset ? normalizeName(physicalDataset) : null,
      binding: text(body.binding) ? normalizeName(text(body.binding)!) : null,
      isCte: body.is_cte === true,
      sourceRelationId: text(body.source) ?? text(row.source),
      outputInputColumns: outputInputColumns(body),
      outputColumns: outputColumns.map(normalizeName),
      joinType: text(body.join_type),
      leftRelationId: text(body.left),
      rightRelationId: text(body.right),
      setopBranches: branches,
      scopeId: text(row.scope_id) ?? text(body.scope_id),
      scopeBindingsDeclared,
      scopeBindings: [],
    });
  }

  const sourceKinds = new Set(["cte", "subquery", "relation", "graphtable", "pivot"]);
  const cteSourceCycle = (ownerId: string, targetId: string): boolean => {
    const seen = new Set<string>();
    let current: string | null = targetId;
    while (current) {
      if (current === ownerId || seen.has(current)) return true;
      seen.add(current);
      current = relations.get(current)?.sourceRelationId ?? null;
    }
    return false;
  };
  const scopeBindings: ScopeBindingRecord[] = [];
  for (const [ownerId, rawBindings] of rawBindingsByOwner) {
    const owner = relations.get(ownerId)!;
    const ownerBindings: ScopeBindingRecord[] = [];
    for (const raw of rawBindings) {
      const base = unresolvedBinding(raw, "SCOPE_BINDING_MALFORMED");
      const target = base.targetRelationId ? relations.get(base.targetRelationId) : undefined;
      let reason: string | null = null;
      if (!base.scopeId || !base.relationId || !base.binding || !base.sourceKind) {
        reason = "SCOPE_BINDING_MALFORMED";
      } else if (!sourceKinds.has(base.sourceKind)) {
        reason = "SCOPE_BINDING_SOURCE_KIND_INVALID";
      } else if (base.relationId !== ownerId) {
        reason = "SCOPE_BINDING_OWNER_MISMATCH";
      } else if (!base.targetRelationId || !base.targetScopeId) {
        reason = "SCOPE_BINDING_TARGET_UNRESOLVED";
      } else if (!target) {
        reason = "SCOPE_BINDING_TARGET_MISSING";
      } else if (owner.taskId !== target.taskId || owner.statementId !== target.statementId) {
        reason = "SCOPE_BINDING_CROSS_STATEMENT";
      } else if (target.scopeId !== base.targetScopeId) {
        reason = "SCOPE_BINDING_TARGET_SCOPE_MISMATCH";
      } else if (base.sourceKind === "cte" && base.targetRelationId
        && cteSourceCycle(ownerId, base.targetRelationId)) {
        reason = "SCOPE_BINDING_CYCLE";
      } else if (base.sourceKind === "cte" && (
        owner.relationType !== "read" || !owner.isCte || owner.scopeId !== base.scopeId
        || owner.binding !== normalizeName(base.binding)
        || owner.sourceRelationId !== base.targetRelationId
      )) {
        reason = "SCOPE_BINDING_CTE_LINK_MISMATCH";
      } else if (base.sourceKind !== "cte" && (
        owner.relationId !== base.targetRelationId || owner.scopeId !== base.targetScopeId
      )) {
        reason = "SCOPE_BINDING_DERIVED_LINK_MISMATCH";
      }
      const binding: ScopeBindingRecord = {
        ...base,
        status: reason === null ? "RESOLVED" : "UNRESOLVED",
        reason,
      };
      ownerBindings.push(binding);
      scopeBindings.push(binding);
    }
    relations.set(ownerId, { ...owner, scopeBindings: ownerBindings });
  }
  const scopeBindingMode = declaredCount === 0
    ? "LEGACY"
    : declaredCount === relations.size ? "EXPLICIT" : "MIXED";
  return { relations, incomingByTo: new Map(), scopeBindingMode, scopeBindings };
}

export function resolveScopeBinding(
  index: RelationTreeIndex,
  input: Readonly<{
    ownerRelationId?: string;
    scopeId?: string;
    binding?: string;
    sourceKind?: string;
  }>,
): ScopeBindingResolution {
  const matches = index.scopeBindings.filter((candidate) =>
    (input.ownerRelationId === undefined || candidate.relationId === input.ownerRelationId)
    && (input.scopeId === undefined || candidate.scopeId === input.scopeId)
    && (input.binding === undefined || normalizeName(candidate.binding ?? "") === normalizeName(input.binding))
    && (input.sourceKind === undefined || candidate.sourceKind === input.sourceKind),
  );
  if (matches.length === 0) {
    return { status: index.scopeBindingMode === "LEGACY" ? "LEGACY_ABSENT" : "ABSENT" };
  }
  if (matches.some((candidate) => candidate.status !== "RESOLVED")) return { status: "INVALID" };
  if (matches.length !== 1) return { status: "AMBIGUOUS" };
  return { status: "RESOLVED", binding: matches[0]! };
}

export function withIncomingRelations(
  index: RelationTreeIndex,
  relationEdges: readonly Record<string, unknown>[],
): RelationTreeIndex {
  const incomingByTo = new Map<string, string[]>();
  for (const edge of relationEdges) {
    const to = text(edge.to_relation_id);
    const from = text(edge.from_relation_id);
    if (!to || !from) continue;
    const values = incomingByTo.get(to) ?? [];
    values.push(from);
    incomingByTo.set(to, values);
  }
  return { ...index, incomingByTo };
}

export function relationSubtree(
  index: RelationTreeIndex,
  rootRelationId: string,
): ReadonlySet<string> {
  const visited = new Set<string>();
  const stack = [rootRelationId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const parent of index.incomingByTo.get(current) ?? []) {
      if (!visited.has(parent)) stack.push(parent);
    }
  }
  return visited;
}

export function subtreeContains(
  index: RelationTreeIndex,
  ancestorRelationId: string,
  descendantRelationId: string,
): boolean {
  return relationSubtree(index, ancestorRelationId).has(descendantRelationId);
}

export function readRelationsInSubtree(
  index: RelationTreeIndex,
  rootRelationId: string,
): readonly RelationRecord[] {
  const subtree = relationSubtree(index, rootRelationId);
  return [...subtree]
    .map((relationId) => index.relations.get(relationId))
    .filter((relation): relation is RelationRecord =>
      relation !== undefined && relation.relationType === "read",
    )
    .sort((left, right) => left.relationId.localeCompare(right.relationId));
}

export function nearestSetopAncestor(
  index: RelationTreeIndex,
  relationId: string,
): RelationRecord | null {
  const visited = new Set<string>();
  let current: string | null = relationId;
  while (current && !visited.has(current)) {
    visited.add(current);
    const relation = index.relations.get(current);
    if (relation?.relationType === "setop") return relation;
    const parents: readonly string[] = index.incomingByTo.get(current) ?? [];
    current = parents.length === 1 ? parents[0]! : null;
  }
  return null;
}

export function normalizeJoinType(joinType: string | null): TaskLocalJoinType {
  const kind = (joinType ?? "").trim().toUpperCase();
  if (kind.includes("SEMI")) return "SEMI";
  if (kind.includes("ANTI")) return "ANTI";
  if (kind.includes("INNER")) return "INNER";
  if (kind.includes("LEFT")) return "LEFT";
  if (kind.includes("RIGHT")) return "RIGHT";
  if (kind.includes("FULL")) return "FULL";
  if (kind.includes("CROSS")) return "CROSS";
  return "N/A";
}

export function controlSideForJoin(input: {
  readonly index: RelationTreeIndex;
  readonly joinRelation: RelationRecord;
  readonly controlReadRelationId: string | null;
}): TaskLocalControlSide {
  const { index, joinRelation, controlReadRelationId } = input;
  if (!controlReadRelationId || !joinRelation.leftRelationId || !joinRelation.rightRelationId) {
    return "BOTH";
  }
  const inLeft = subtreeContains(index, joinRelation.leftRelationId, controlReadRelationId);
  const inRight = subtreeContains(index, joinRelation.rightRelationId, controlReadRelationId);
  if (inLeft && !inRight) return "LEFT";
  if (inRight && !inLeft) return "RIGHT";
  return "BOTH";
}
