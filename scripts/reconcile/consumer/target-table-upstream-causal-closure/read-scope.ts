import { normalizeName } from "../../../machine-facts/machine-facts-contract.ts";
import {
  canonicalPlanSlotId,
  canonicalRelationIdentity,
  planSlotSqlSourceId,
  sameRelationIdentity,
} from "../../../machine-facts/relation-identity.ts";
import { proveReadOccurrence } from "../../../machine-facts/read-occurrence-proof.ts";
import type { CurrentBundleLoad } from "../../../query/current-task-bundle.ts";
import type {
  CandidateBranch,
  CandidateReadOccurrence,
  CandidateUniverse,
} from "../target-field-causal-slice/candidate-universe.ts";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function records(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item))
    : [];
}

function statementOrdinal(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/(?:^|:)statement:(\d+)(?::|$)/i);
  return match ? Number(match[1]) : null;
}

function statementIndexForId(
  load: CurrentBundleLoad,
  statementId: unknown,
): number | null {
  const normalizedStatementId = text(statementId);
  if (!normalizedStatementId) return null;
  const statement = records(load.records["statements.jsonl"]).find(
    (candidate) => String(candidate.statement_id ?? "") === normalizedStatementId,
  );
  const statementIndex = statement?.statement_index;
  if (Number.isSafeInteger(statementIndex)) return Number(statementIndex);
  return statementOrdinal(normalizedStatementId);
}

function occurrencePlanSlot(occurrenceId: string | null | undefined): string | null {
  const raw = text(occurrenceId);
  if (!raw) return null;
  const match = raw.match(/^(query|finish|create)#(\d+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function statementMatchesOccurrenceSlot(
  statementId: string | null,
  occurrence: CandidateReadOccurrence,
): boolean {
  const slot = occurrencePlanSlot(occurrence.occurrenceId);
  if (!slot || !statementId) return true;
  return statementId.toLowerCase().includes(`:slot:${slot}:statement:${occurrence.statementIndex}`);
}

function relationIdOf(row: Record<string, unknown>): string | null {
  return text(row.relation_id) ?? text((row.relation as Record<string, unknown> | undefined)?.id);
}

function parentByChild(load: CurrentBundleLoad): Map<string, string> {
  const map = new Map<string, string>();
  for (const edge of records(load.records["relation-edges.jsonl"])) {
    const child = text(edge.from_relation_id);
    const parent = text(edge.to_relation_id);
    if (child && parent) map.set(child, parent);
  }
  return map;
}

function walkParents(start: string, parents: Map<string, string>): string {
  let current = start;
  const seen = new Set<string>();
  while (parents.has(current) && !seen.has(current)) {
    seen.add(current);
    current = parents.get(current)!;
  }
  return current;
}

function matchingRelationRows(
  load: CurrentBundleLoad,
  occurrence: CandidateReadOccurrence,
): readonly Record<string, unknown>[] {
  return records(load.records["relation-nodes.jsonl"]).filter((row) => {
    const id = relationIdOf(row);
    const statementId = text(row.statement_id);
    const index = statementIndexForId(load, statementId);
    return id !== null
      && index === occurrence.statementIndex
      && statementMatchesOccurrenceSlot(statementId, occurrence)
      && occurrence.relationPath.some((path) => sameRelationIdentity(id, path));
  });
}

function slotForRelation(
  load: CurrentBundleLoad,
  relationId: string,
  statementIndex: number,
  occurrence?: CandidateReadOccurrence,
): string | null {
  const sources = new Set(
    records(load.records["relation-nodes.jsonl"])
      .filter((row) => {
        const id = relationIdOf(row);
        const statementId = text(row.statement_id);
        const index = statementIndexForId(load, statementId);
        return id !== null
          && sameRelationIdentity(id, relationId)
          && index === statementIndex
          && (!occurrence || statementMatchesOccurrenceSlot(statementId, occurrence));
      })
      .map((row) => text(row.statement_id))
      .filter((value): value is string => value !== null)
      .map((value) => canonicalPlanSlotId(value))
      .filter((value) => planSlotSqlSourceId(value) !== null),
  );
  return sources.size === 1 ? [...sources][0]! : null;
}

function walkWriteRoot(
  load: CurrentBundleLoad,
  relationId: string,
  occurrence: CandidateReadOccurrence,
): { readonly sqlSourceId: string | null; readonly rootRelationId: string | null } {
  const root = walkParents(relationId, parentByChild(load));
  return {
    sqlSourceId: slotForRelation(load, relationId, occurrence.statementIndex, occurrence),
    rootRelationId: root,
  };
}

function walkByPath(
  load: CurrentBundleLoad,
  occurrence: CandidateReadOccurrence,
  explicit: string | null,
): { readonly sqlSourceId: string | null; readonly rootRelationId: string | null } {
  const relationIds = matchingRelationRows(load, occurrence)
    .map((row) => relationIdOf(row))
    .filter((value): value is string => value !== null);
  const parents = parentByChild(load);
  const roots = new Set(relationIds.map((id) => walkParents(id, parents)));
  const sources = new Set(
    relationIds
      .map((id) => slotForRelation(load, id, occurrence.statementIndex, occurrence))
      .filter((value): value is string => value !== null),
  );
  return {
    sqlSourceId: sources.size === 1 ? [...sources][0]! : explicit,
    rootRelationId: roots.size === 1 ? [...roots][0]! : occurrence.rootRelationId ?? null,
  };
}

function localRelationPath(relationId: string): string {
  return canonicalRelationIdentity(relationId) ?? relationId;
}

function resolveLeafRelationId(
  load: CurrentBundleLoad,
  branch: CandidateBranch,
  occurrence: CandidateReadOccurrence,
): string | null {
  const tableName = branch.table?.qualifiedName;
  if (tableName) {
    const proof = proveReadOccurrence(load, { qualifiedName: tableName }, occurrence);
    if (proof.valid && proof.relationId) return proof.relationId;
  }
  for (const row of matchingRelationRows(load, occurrence)) {
    const id = relationIdOf(row);
    if (id) return id;
  }
  return null;
}

const MAX_RELATION_PATH_DEPTH = 25;

/** Walk relation-edges from the proven read toward ancestors (includes JOIN when present). */
export function enrichRelationPathFromFacts(
  load: CurrentBundleLoad,
  branch: CandidateBranch,
  occurrence: CandidateReadOccurrence,
): readonly string[] {
  const leafRelationId = resolveLeafRelationId(load, branch, occurrence);
  if (!leafRelationId) return occurrence.relationPath;
  const parents = parentByChild(load);
  const chain: string[] = [];
  let current: string | null = leafRelationId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    chain.unshift(localRelationPath(current));
    current = parents.get(current) ?? null;
  }
  if (chain.length <= occurrence.relationPath.length) return occurrence.relationPath;
  const joinIndex = chain.findIndex((value) => /(?:^|[./:])join(?:[./:]|$)/i.test(value));
  if (joinIndex >= 0) {
    const from = Math.max(0, joinIndex - 1);
    const trimmed = chain.slice(from, from + MAX_RELATION_PATH_DEPTH);
    return trimmed.length > occurrence.relationPath.length ? trimmed : occurrence.relationPath;
  }
  const capped = chain.length > MAX_RELATION_PATH_DEPTH ? chain.slice(-MAX_RELATION_PATH_DEPTH) : chain;
  return capped.length > occurrence.relationPath.length ? capped : occurrence.relationPath;
}

/**
 * When multi-hop still carries a stale query#/create# occurrence, rebind it
 * from the current machine-facts dataset-io read_occurrences for that table.
 */
export function refreshReadOccurrenceFromDatasetIo(
  load: CurrentBundleLoad,
  branch: CandidateBranch,
): CandidateReadOccurrence | null {
  const tableName = branch.table?.qualifiedName;
  const occurrence = branch.readOccurrence;
  if (!tableName || !occurrence || !Number.isSafeInteger(occurrence.statementIndex)) return null;
  const qualifiedTable = normalizeName(tableName);
  const reads = records(load.records["dataset-io.jsonl"]).filter((record) =>
    record.direction === "READ"
    && String(record.task_id ?? "") === load.taskId
    && normalizeName(String(record.physical_dataset ?? "")) === qualifiedTable
    && statementIndexForId(load, record.statement_id) === occurrence.statementIndex
    && statementMatchesOccurrenceSlot(text(record.statement_id), occurrence));
  const readOccurrences = reads.flatMap((record) =>
    Array.isArray(record.read_occurrences) ? record.read_occurrences : [],
  );
  if (readOccurrences.length !== 1) return null;
  const raw = readOccurrences[0] as Record<string, unknown>;
  const relationId = text(raw.relation_id) ?? text(raw.relationId);
  const occurrenceId = text(raw.occurrence_id) ?? text(raw.occurrenceId);
  if (!relationId || !occurrenceId) return null;
  const localPath = localRelationPath(relationId);
  const statementId = text(reads[0]?.statement_id);
  const base: CandidateReadOccurrence = {
    ...occurrence,
    occurrenceId,
    readRelationId: localPath,
    relationPath: [localPath],
    ...(planSlotSqlSourceId(statementId) ? { sqlSourceId: planSlotSqlSourceId(statementId)! } : {}),
  };
  return {
    ...base,
    relationPath: enrichRelationPathFromFacts(load, branch, base),
  };
}

/**
 * Resolve the consumer read onto the owning SQL slot and write-root relation.
 * Prove the occurrence against machine-facts first, then walk parent edges.
 */
export function inferReadScope(
  load: CurrentBundleLoad,
  branch: CandidateBranch,
): { readonly sqlSourceId: string | null; readonly rootRelationId: string | null } {
  const occurrence = branch.readOccurrence;
  if (!occurrence) return { sqlSourceId: null, rootRelationId: null };
  const explicit = planSlotSqlSourceId(occurrence.sqlSourceId ?? null);
  const tableName = branch.table?.qualifiedName;
  if (tableName) {
    const proof = proveReadOccurrence(load, { qualifiedName: tableName }, occurrence);
    // An unprovable occurrence must not lose the scope the relation path can
    // still establish; only a proven read may claim the stronger walk.
    if (proof.valid && proof.relationId) {
      const walked = walkWriteRoot(load, proof.relationId, occurrence);
      return {
        sqlSourceId: walked.sqlSourceId ?? explicit,
        rootRelationId: walked.rootRelationId ?? occurrence.rootRelationId ?? null,
      };
    }
  }
  return walkByPath(load, occurrence, explicit);
}

export function normalizeReadScopes(
  universe: CandidateUniverse,
  loadForTask: (taskId: string) => CurrentBundleLoad,
): CandidateUniverse {
  const branches = universe.branches.map((branch) => {
    if (!branch.consumerTaskId || !branch.readOccurrence) return branch;
    const originalOccurrence = branch.readOccurrence;
    const load = loadForTask(branch.consumerTaskId);
    let readOccurrence = originalOccurrence;
    if (
      branch.table?.qualifiedName
      && !proveReadOccurrence(load, { qualifiedName: branch.table.qualifiedName }, readOccurrence).valid
    ) {
      const refreshed = refreshReadOccurrenceFromDatasetIo(load, branch);
      if (refreshed) readOccurrence = refreshed;
    }
    const workingBranch = readOccurrence === originalOccurrence
      ? branch
      : { ...branch, readOccurrence };
    const scope = inferReadScope(load, workingBranch);
    const enrichedPath = enrichRelationPathFromFacts(load, workingBranch, readOccurrence);
    const relationPath = enrichedPath.length > 0
      ? enrichedPath
      : (readOccurrence.relationPath ?? []);
    const resolvedSqlSourceId = scope.sqlSourceId
      ?? planSlotSqlSourceId(readOccurrence.occurrenceId)
      ?? readOccurrence.sqlSourceId
      ?? null;
    const nextOccurrence = {
      ...readOccurrence,
      relationPath,
      ...(resolvedSqlSourceId ? { sqlSourceId: resolvedSqlSourceId } : {}),
      ...(scope.rootRelationId ? { rootRelationId: scope.rootRelationId } : {}),
    };
    return scope.sqlSourceId !== originalOccurrence.sqlSourceId
      || scope.rootRelationId !== originalOccurrence.rootRelationId
      || readOccurrence.occurrenceId !== originalOccurrence.occurrenceId
      || readOccurrence.readRelationId !== originalOccurrence.readRelationId
      || relationPath.length !== (originalOccurrence.relationPath?.length ?? 0)
      || relationPath.some((value, index) => value !== (originalOccurrence.relationPath?.[index] ?? ""))
      ? { ...workingBranch, readOccurrence: nextOccurrence }
      : branch;
  });
  return { ...universe, branches };
}
