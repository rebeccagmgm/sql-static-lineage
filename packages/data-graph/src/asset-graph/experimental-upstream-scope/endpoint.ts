import { collectUpstreamScope, type ScopeStore, type UpstreamClosure } from "./closure.ts";
import { projectUpstreamScope } from "./projection.ts";
import { compileScopePatterns } from "./pattern.ts";
import { normalizeHiddenTables } from "../node-visibility.ts";

const cache = new WeakMap<ScopeStore, Map<string, UpstreamClosure>>();
export async function queryExperimentalUpstreamScope(store: ScopeStore, query: URLSearchParams) {
  const patterns = compileScopePatterns(JSON.parse(query.get("patterns") ?? "[]")).map(p => p.pattern);
  const hidden = normalizeHiddenTables(JSON.parse(query.get("hiddenTables") ?? "[]"));
  const schema = query.get("schema");
  const offset = Number(query.get("offset") ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || (schema !== null && !/^[A-Za-z0-9_]+$/.test(schema))) throw new Error("INVALID_SCOPE_PAGE");
  const closure = await cachedUpstreamScope(store, patterns);
  const projected = projectUpstreamScope(closure, hidden);
  if (String((await store.ready()).version) !== closure.version) throw new Error("ASSET_GRAPH_CHANGED_DURING_QUERY");
  if (schema === null) return projected.overview;
  const members = projected.tables.filter(table => table.table.split(".")[0].toLowerCase() === schema.toLowerCase())
    .sort((a, b) => a.table.localeCompare(b.table) || a.id.localeCompare(b.id));
  const truncated = offset + 50 < members.length;
  return { version: closure.version, schema, items: members.slice(offset, offset + 50).map(table => ({ ...table, kind: "PHYSICAL_DATASET" })), pagination: { offset, limit: 50, nextOffset: truncated ? offset + 50 : null }, truncated };
}

export async function cachedUpstreamScope(store: ScopeStore, patterns: string[]) {
  const ready = await store.ready();
  const key = JSON.stringify([ready.version, patterns]);
  const entries = cache.get(store) ?? new Map<string, UpstreamClosure>();
  let closure = entries.get(key);
  if (!closure) {
    closure = await collectUpstreamScope(store, patterns);
    if (closure.version !== String(ready.version)) throw new Error("ASSET_GRAPH_CHANGED_DURING_QUERY");
    if (entries.size >= 4) entries.delete(entries.keys().next().value!);
    entries.set(key, closure);
    cache.set(store, entries);
  }
  return closure;
}
