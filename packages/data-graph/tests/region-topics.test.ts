import { describe, expect, it, vi } from "vitest";
import { regionTopics } from "../src/asset-graph/region-topics.ts";
import type { AssetGraphStore } from "../src/asset-graph/store.ts";

describe("region writer topics", () => {
  it("keeps schemas separate and returns only two names per card", async () => {
    const rows = [["1", "dm_a"], ["2", "dm_a"], ["3", "dm_a"], ["4", "dm_b"]];
    const store = { ready: async () => ({ version: "v1" }), run: async () => ({ records: rows.map(([id, schema]) => ({ get: (key: string) => key === "taskId" ? `task:${id}` : key === "tableIds" ? [id] : schema })) }) } as unknown as AssetGraphStore;
    const resolver = { resolveTopics: () => ({ "1": "a", "2": "b", "3": "c", "4": "d" }), resolveTopicDescriptions: () => ({}) };
    const result = await regionTopics(store, resolver, new URLSearchParams({ schemas: '["dm_a","dm_b"]' }));
    expect("regions" in result && result.regions.map(region => [region.schema, region.total, region.topics.map(topic => topic.name)])).toEqual([["dm_a", 3, ["a", "b"]], ["dm_b", 1, ["d"]]]);
  });
  it("deduplicates actual writer topics and reports missing evidence", async () => {
    const run = vi.fn(async () => ({ records: ["task:1", "task:2", "task:3"].map(task => ({ get: (key: string) => key === "tableIds" ? ["same-table"] : task })) }));
    const store = { ready: async () => ({ version: "v1" }), run } as unknown as AssetGraphStore;
    const resolver = { resolveTopics: () => ({ "1": "topicA", "2": "topicA" }), resolveTopicDescriptions: () => ({ "1": "业务主题", "2": "业务主题" }) };
    const result = await regionTopics(store, resolver, new URLSearchParams({ schema: "dm_x", hiddenTables: '["dm_x.hidden"]' }));
    expect("topics" in result && result.topics).toEqual([{ name: "topicA", label: "业务主题", tableCount: 1 }]);
    expect("incomplete" in result && result.incomplete).toBe(true);
    expect(run.mock.calls[0]).toBeDefined();
    expect(JSON.stringify(run.mock.calls)).toContain("WRITES_TABLE");
    expect(JSON.stringify(run.mock.calls)).not.toContain("READS_TABLE");
    expect(JSON.stringify(run.mock.calls)).toContain("dm_x.hidden");
  });
  it("ranks by unique table coverage rather than alphabet or task count", async () => {
    const rows = [
      { taskId: "task:1", tableIds: ["t1", "t2"] },
      { taskId: "task:2", tableIds: ["t2"] },
      { taskId: "task:3", tableIds: ["t3"] },
    ];
    const store = { ready: async () => ({ version: "v1" }), run: async () => ({ records: rows.map(row => ({ get: (key: string) => row[key as keyof typeof row] })) }) } as unknown as AssetGraphStore;
    const result = await regionTopics(store, { resolveTopics: () => ({ "1": "z", "2": "z", "3": "a" }), resolveTopicDescriptions: () => ({}) }, new URLSearchParams({ schema: "dm_x" }));
    expect("topics" in result && result.topics.map(t => [t.name, t.tableCount])).toEqual([["z", 2], ["a", 1]]);
  });
  it("rejects broad schema input before querying", async () => {
    await expect(regionTopics({} as AssetGraphStore, {} as never, new URLSearchParams({ schema: "dm_%" }))).rejects.toThrow("INVALID_GRAPH_SCHEMA");
  });
});
