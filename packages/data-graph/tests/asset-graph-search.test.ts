import { describe, expect, it, vi } from "vitest";
import { AssetGraphStore } from "../src/asset-graph/store.ts";

describe("asset search task identity", () => {
  it.each(["105388", " task:105388 "])("uses exact task identity for %s", async query => {
    const store = new AssetGraphStore({} as never, "test", "test");
    vi.spyOn(store, "ready").mockResolvedValue({} as never);
    const run = vi.spyOn(store, "run").mockResolvedValue({ records: [] } as never);
    expect(await store.search(query, 31, 0, [], ["task:105388"])).toEqual([]);
    const [cypher, params] = run.mock.calls[0]!;
    expect(cypher).toContain("kind:'TASK',id:$task");
    expect(cypher).not.toContain("CONTAINS");
    expect(params).toMatchObject({ task: "task:105388", offset: 0, limit: 31 });
    expect(cypher).toContain("$clusterTaskIds");
  });
  it("preserves text search for table names", async () => {
    const store = new AssetGraphStore({} as never, "test", "test");
    vi.spyOn(store, "ready").mockResolvedValue({} as never);
    const run = vi.spyOn(store, "run").mockResolvedValue({ records: [] } as never);
    await store.search("PDATA_N.T03_AGT_RELA_H");
    expect(run.mock.calls[0]![0]).toContain("CONTAINS $text");
  });
});
