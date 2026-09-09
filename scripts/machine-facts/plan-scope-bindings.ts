import type { PlanFacts, PlanScopeBinding } from "../plans/plan-contract.ts";
import { globalRelationId } from "./plan-occurrence-id.ts";

/** Preserve source mappings already produced by the parser-side scope layer. */
export function globalizePlanScopeBindings(
  plan: PlanFacts,
  taskId: string,
  statementIndex: number,
): Readonly<{
  bindingsByRelationId: ReadonlyMap<string, readonly PlanScopeBinding[]>;
  issues: readonly Readonly<{
    relationId: string | null;
    reasonCode: string;
    message: string;
  }>[];
}> {
  const byId = new Map(plan.relations.map(r => [r.id, r]));
  const scopes = new Set(plan.relations.map(r => r.scope_id).filter(Boolean));
  const result = new Map<string, PlanScopeBinding[]>();
  const issues: Array<{ relationId: string | null; reasonCode: string; message: string }> = [];
  if (byId.size !== plan.relations.length) {
    issues.push({
      relationId: null,
      reasonCode: "SCOPE_BINDING_DUPLICATE_RELATION_ID",
      message: "PlanFacts contains duplicate local relation IDs; scope bindings are not unique",
    });
  }
  const bindingCounts = new Map<string, number>();
  for (const binding of plan.scope_bindings ?? []) {
    const owner = byId.get(binding.relation_id);
    const key = `${binding.relation_id}\u0000${binding.scope_id}\u0000${binding.binding}\u0000${binding.source_kind}`;
    bindingCounts.set(key, (bindingCounts.get(key) ?? 0) + 1);
    if (!owner || !scopes.has(binding.scope_id)) {
      issues.push({
        relationId: owner?.id ?? null,
        reasonCode: "SCOPE_BINDING_OWNER_MISSING",
        message: `scope binding owner or scope is missing: ${binding.relation_id}`,
      });
    }
    const target = binding.target_relation_id === null ? null : byId.get(binding.target_relation_id);
    if (binding.target_relation_id !== null && !target) {
      issues.push({
        relationId: owner?.id ?? null,
        reasonCode: "SCOPE_BINDING_TARGET_MISSING",
        message: `scope binding target is missing: ${binding.target_relation_id}`,
      });
    }
    if (target ? target.scope_id !== binding.target_scope_id : binding.target_scope_id !== null) {
      issues.push({
        relationId: owner?.id ?? null,
        reasonCode: "SCOPE_BINDING_TARGET_SCOPE_MISMATCH",
        message: `scope binding target scope does not match target relation: ${binding.relation_id}`,
      });
    }
    if (binding.source_kind === "cte" && (!owner || owner.type !== "read" || owner.is_cte !== true
      || owner.scope_id !== binding.scope_id || owner.binding !== binding.binding
      || (target && owner.source !== binding.target_relation_id))) {
      issues.push({
        relationId: owner?.id ?? null,
        reasonCode: "SCOPE_BINDING_CTE_LINK_MISMATCH",
        message: `CTE scope binding does not match its owning read: ${binding.relation_id}`,
      });
    }
    if (binding.source_kind !== "cte" && target && owner && (
      owner.id !== target.id || owner.scope_id !== binding.target_scope_id
    )) {
      issues.push({
        relationId: owner.id,
        reasonCode: "SCOPE_BINDING_DERIVED_LINK_MISMATCH",
        message: `derived scope binding does not match its target relation: ${binding.relation_id}`,
      });
    }
    const global = { ...binding, relation_id: globalRelationId(taskId, statementIndex, binding.relation_id),
      target_relation_id: binding.target_relation_id === null ? null
        : globalRelationId(taskId, statementIndex, binding.target_relation_id) };
    if (!owner) continue;
    const bindings = result.get(binding.relation_id) ?? [];
    // Preserve multiplicity. Consumers must reject ambiguous bindings rather
    // than the writer silently selecting or merging one candidate.
    bindings.push(global);
    result.set(binding.relation_id, bindings);
  }
  for (const [key, count] of bindingCounts) {
    if (count <= 1) continue;
    const relationId = key.split("\u0000", 1)[0] ?? null;
    issues.push({
      relationId,
      reasonCode: "SCOPE_BINDING_DUPLICATE",
      message: `scope binding is duplicated ${count} times: ${relationId}`,
    });
  }
  return { bindingsByRelationId: result, issues };
}
