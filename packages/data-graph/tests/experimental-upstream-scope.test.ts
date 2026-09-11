import { describe, expect, it, vi } from "vitest";
import { compileScopePatterns } from "../src/asset-graph/experimental-upstream-scope/pattern.ts";
import { collectUpstreamScope, SCOPE_LIMITS, type ScopeStore } from "../src/asset-graph/experimental-upstream-scope/closure.ts";
import { projectUpstreamScope } from "../src/asset-graph/experimental-upstream-scope/projection.ts";
import { queryExperimentalUpstreamScope } from "../src/asset-graph/experimental-upstream-scope/endpoint.ts";

const record = (data: Record<string, unknown>) => ({ get: (key: string) => data[key] });
function fixture() {
  const tables = [
    ["a", "dm.t01_a"], ["b", "dm.t01_b"], ["c", "dm.t01_isolated"],
    ["x", "pdata.x"], ["y", "odata.y"], ["sibling", "dm.other_output"], ["unrelated", "dm.unrelated"],
  ].map(([id, table]) => ({ id, table, label: table }));
  const links = [
    { source: "x", task: "t1", target: "a" }, { source: "x", task: "t1", target: "sibling" },
    { source: "x", task: "t2", target: "b" }, { source: "y", task: "t3", target: "x" },
    { source: "x", task: "t4", target: "y" }, { source: "y", task: "t5", target: "unrelated" },
  ];
  const run = vi.fn(async (_query: string, params: Record<string, unknown> = {}) => {
    if (params.patterns) {
      const patterns = params.patterns as ReturnType<typeof compileScopePatterns>;
      return { records: tables.filter(table => patterns.some(p => new RegExp(p.regex).test(p.qualified ? table.table : table.table.split(".").at(-1)!))).map(record) };
    }
    const frontier = params.frontier as string[];
    return { records: links.filter(link => frontier.includes(link.target)).map(link => record({
      sourceId: link.source, sourceTable: tables.find(table => table.id === link.source)!.table,
      sourceLabel: link.source, taskId: link.task, targetId: link.target,
    })) };
  });
  return { ready: vi.fn(async () => ({ version: "v1" })), run };
}

describe("experimental upstream scope", () => {
  it("implements escaped underscore, percent, qualified and short-name matching", () => {
    const [short] = compileScopePatterns(["%t01\\_%"]);
    expect(short.qualified).toBe(false);
    const regex = new RegExp(short.regex);
    expect(regex.test("some_t01_result")).toBe(true);
    expect(regex.test("t01xresult")).toBe(false);
    const [qualified] = compileScopePatterns(["dm.t01\\_a"]);
    expect(qualified.qualified).toBe(true);
    expect(new RegExp(qualified.regex).test("dmXt01_a")).toBe(false);
    for (const input of [[], ["%"], ["a\\"], [null], Array(26).fill("a")]) expect(() => compileScopePatterns(input)).toThrow("INVALID_SCOPE_PATTERNS");
  });

  it("unions all roots and ancestors, terminates cycles, and excludes other outputs/downstream", async () => {
    const store = fixture();
    const closure = await collectUpstreamScope(store as unknown as ScopeStore, ["%t01\\_%"]);
    expect(closure.roots).toEqual(["a", "b", "c"]);
    expect(closure.tables.map(table => table.id).sort()).toEqual(["a", "b", "c", "x", "y"]);
    expect(closure.links).toHaveLength(4);
    expect(store.run).toHaveBeenCalledTimes(4);
    expect(store.run.mock.calls[1][0]).toContain("WHERE target.id IN $frontier");
    expect(store.run.mock.calls[1][0]).not.toContain("SCHEDULE");
    const projected = projectUpstreamScope(closure, ["pdata.x"]);
    expect(projected.tables.map(table => table.id)).toContain("y");
    expect(projected.overview.flows).toEqual([]);
    expect(projected.overview.scope).toMatchObject({ rootCount: 3, tableCount: 5, visibleTableCount: 4 });
  });

  it("rejects incomplete closures rather than labelling a prefix complete", async () => {
    const store = fixture();
    store.ready.mockResolvedValueOnce({ version: "v1" }).mockResolvedValueOnce({ version: "v2" });
    await expect(collectUpstreamScope(store as unknown as ScopeStore, ["%t01\\_%"])).rejects.toThrow("ASSET_GRAPH_CHANGED_DURING_QUERY");
    const overflow = { ready: async () => ({ version: "v1" }), run: async () => ({ records: Array(SCOPE_LIMITS.roots + 1).fill(record({ id: "a" })) }) };
    await expect(collectUpstreamScope(overflow as unknown as ScopeStore, ["a"])).rejects.toThrow("UPSTREAM_SCOPE_ROOT_LIMIT");
  });

  it("reuses closure for scoped drill-down and reapplies hidden rules without truncating ancestry", async () => {
    const store = fixture();
    const query = new URLSearchParams({ patterns: JSON.stringify(["%t01\\_%"]) });
    const overview = await queryExperimentalUpstreamScope(store as unknown as ScopeStore, query);
    expect(overview).toHaveProperty("scope.tableCount", 5);
    const calls = store.run.mock.calls.length;
    query.set("schema", "dm");
    query.set("hiddenTables", JSON.stringify(["dm.t01_a"]));
    const page = await queryExperimentalUpstreamScope(store as unknown as ScopeStore, query);
    expect(page).toHaveProperty("items", [
      { id: "b", table: "dm.t01_b", label: "dm.t01_b", kind: "PHYSICAL_DATASET" },
      { id: "c", table: "dm.t01_isolated", label: "dm.t01_isolated", kind: "PHYSICAL_DATASET" },
    ]);
    expect(store.run).toHaveBeenCalledTimes(calls);
  });
});
