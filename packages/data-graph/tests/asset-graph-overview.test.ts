import { describe, expect, it, vi } from "vitest";
import {
  classifyRegion,
  getAssetGraphOverview,
  listAssetGraphRegionDatasets,
} from "../src/asset-graph/overview.ts";
import type { AssetGraphStore } from "../src/asset-graph/store.ts";

const record = (values: Record<string, unknown>) => ({
  get: (name: string) => values[name],
});

describe("asset graph live overview", () => {
  it("classifies only explicit warehouse schema prefixes", () => {
    expect(classifyRegion("odata_otc")).toBe("ODATA");
    expect(classifyRegion("PDATA_FI")).toBe("PDATA");
    expect(classifyRegion("dm_index_n")).toBe("DM");
    expect(classifyRegion("ods_source")).toBe("UNCLASSIFIED");
    expect(classifyRegion("dmart")).toBe("UNCLASSIFIED");
  });

  it("bounds regions and table-IO flows while preserving dataset counts", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        records: [record({ datasetCount: 6 })],
      })
      .mockResolvedValueOnce({
        records: [
          record({ schema: "pdata_otc", datasetCount: 8 }),
          record({ schema: "dm_otc", datasetCount: 5 }),
          record({ schema: "misc", datasetCount: 3 }),
        ],
      })
      .mockResolvedValueOnce({
        records: [
          record({ fromSchema: "pdata_otc", toSchema: "dm_otc", taskCount: 4 }),
          record({ fromSchema: "misc", toSchema: "pdata_otc", taskCount: 2 }),
        ],
      });
    const store = {
      ready: vi.fn(async () => ({ state: "READY", version: "v1" })),
      run,
    } as unknown as AssetGraphStore;
    const value = await getAssetGraphOverview(store, {
      regionLimit: 2,
      flowLimit: 1,
    });
    expect(value.regions).toEqual([
      { schema: "pdata_otc", stage: "PDATA", datasetCount: 8 },
      { schema: "dm_otc", stage: "DM", datasetCount: 5 },
    ]);
    expect(value.flows).toEqual([
      {
        fromSchema: "pdata_otc",
        toSchema: "dm_otc",
        fromStage: "PDATA",
        toStage: "DM",
        taskCount: 4,
        evidenceKind: "TABLE_IO",
      },
    ]);
    expect(value.truncated).toEqual({ regions: true, flows: true });
    expect(value.excluded).toEqual({ unqualifiedDatasets: 6 });
    expect(run.mock.calls[0][0]).toContain(
      "size(split(coalesce(n.table,''),'.')) < 2",
    );
    expect(run.mock.calls[1][0]).toContain(
      "split(coalesce(n.table,''),'.')[1] <> ''",
    );
    expect(run.mock.calls[1][1]).toEqual({ limit: 3, hiddenTables: [] });
    expect(run.mock.calls[2][1]).toEqual({
      schemas: ["pdata_otc", "dm_otc"],
      limit: 2,
      hiddenTables: [],
    });
    expect(run.mock.calls[2][0]).toContain(
      "split(coalesce(source.table,''),'.')[1] <> ''",
    );
    expect(run.mock.calls[2][0]).toContain(
      "split(coalesce(target.table,''),'.')[1] <> ''",
    );
    expect(run.mock.calls[2][0]).toContain("count(DISTINCT task.id)");
  });

  it("returns actual dataset ids in a bounded array envelope", async () => {
    const run = vi.fn(async (_query: string, _params?: Record<string, unknown>) => ({
      records: [
        record({
          id: "dataset:1",
          table: "pdata_otc.a",
          label: "pdata_otc.a",
        }),
        record({
          id: "dataset:2",
          table: "pdata_otc.b",
          label: "pdata_otc.b",
        }),
      ],
    }));
    const store = {
      ready: vi.fn(async () => ({ state: "READY", version: "v2" })),
      run,
    } as unknown as AssetGraphStore;
    const value = await listAssetGraphRegionDatasets(store, {
      schema: "PDATA_OTC",
      limit: 1,
      offset: 4,
    });
    expect(value).toMatchObject({
      version: "v2",
      schema: "pdata_otc",
      items: [{ id: "dataset:1", table: "pdata_otc.a" }],
      pagination: { offset: 4, limit: 1, nextOffset: 5 },
      truncated: true,
    });
    expect(run.mock.calls[0][0]).toContain(
      "size(split(coalesce(n.table,''),'.')) >= 2",
    );
    expect(run.mock.calls[0][0]).toContain("split(n.table,'.')[1] <> ''");
  });

  it("rejects broad schema input and fails closed across a version change", async () => {
    const invalidStore = {} as AssetGraphStore;
    await expect(
      listAssetGraphRegionDatasets(invalidStore, { schema: "pdata_%" }),
    ).rejects.toThrow("INVALID_GRAPH_SCHEMA");
    const changedStore = {
      ready: vi
        .fn()
        .mockResolvedValueOnce({ state: "READY", version: "v1" })
        .mockResolvedValueOnce({ state: "READY", version: "v2" }),
      run: vi.fn(async () => ({ records: [] })),
    } as unknown as AssetGraphStore;
    await expect(getAssetGraphOverview(changedStore)).rejects.toThrow(
      "ASSET_GRAPH_CHANGED_DURING_QUERY",
    );
  });

  it("excludes named tables before aggregating both ends and before region pagination", async () => {
    const run = vi.fn(async (query: string, _params?: Record<string, unknown>) => ({
      records: query.includes("RETURN schema,datasetCount") ? [record({ schema: "dm_index_n", datasetCount: 1 })] : [],
    }));
    const store = { ready: async () => ({ version: "v1" }), run } as unknown as AssetGraphStore;
    await getAssetGraphOverview(store, { hiddenTables: ["DM_INDEX_N.GRP_DEF"] });
    expect(run.mock.calls[1][0]).toContain("NOT toLower(coalesce(n.table,'')) IN $hiddenTables");
    expect(run.mock.calls[2][0]).toContain("NOT toLower(coalesce(source.table,'')) IN $hiddenTables");
    expect(run.mock.calls[2][0]).toContain("NOT toLower(coalesce(target.table,'')) IN $hiddenTables");
    expect(run.mock.calls[2][1]?.hiddenTables).toEqual(["dm_index_n.grp_def"]);
    await listAssetGraphRegionDatasets(store, { schema: "dm_index_n", hiddenTables: ["dm_index_n.grp_def"] });
    expect(run.mock.calls[3][0]).toContain("NOT toLower(coalesce(n.table,'')) IN $hiddenTables");
    await expect(getAssetGraphOverview(store, { hiddenTables: ["dm_index_n.*"] })).rejects.toThrow("INVALID_HIDDEN_TABLES");
  });
});
