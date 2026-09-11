import { describe, expect, it } from "vitest";
import { AssetGraphStore } from "../src/asset-graph/store.ts";

function record(values: Record<string, unknown>) {
  return { get: (name: string) => values[name] };
}

function integer(value: number) {
  return { toNumber: () => value };
}

describe("AssetGraphStore.upgradeOwnerEdgeSources", () => {
  function fixture(missing: Record<string, unknown>[], updated?: number) {
    const queries: string[] = [];
    const batches: Record<string, unknown>[][] = [];
    const tx = {
      run: async (query: string, params?: Record<string, unknown>) => {
        queries.push(query);
        if (query.includes("RETURN o.key AS ownerKey"))
          return { records: missing.map(record) };
        if (query.includes("RETURN DISTINCT r.ownerKey"))
          return {
            records: [
              record({ ownerKey: "g|edge-only", sourceKey: "g|source" }),
            ],
          };
        const rows = params?.rows as Record<string, unknown>[];
        batches.push(rows);
        return {
          records: [record({ updated: integer(updated ?? rows.length) })],
        };
      },
    };
    const driver = {
      session: () => ({
        executeWrite: async (work: (tx: unknown) => Promise<unknown>) =>
          work(tx),
        close: async () => undefined,
      }),
    };
    return {
      store: new AssetGraphStore(driver as never, "test", "g"),
      queries,
      batches,
    };
  }

  it("skips relationship scanning when every owner has source metadata", async () => {
    const f = fixture([]);
    expect(await f.store.upgradeOwnerEdgeSources()).toBe(0);
    expect(f.queries).toHaveLength(1);
  });

  it("upgrades edge-only and empty owners in one relationship scan without changing hashes", async () => {
    const f = fixture([
      { ownerKey: "g|edge-only", hash: "edges-hash" },
      { ownerKey: "g|empty", hash: "empty-hash" },
    ]);
    expect(await f.store.upgradeOwnerEdgeSources()).toBe(2);
    expect(f.batches.flat()).toEqual([
      { key: "g|edge-only", hash: "edges-hash", sources: ["g|source"] },
      { key: "g|empty", hash: "empty-hash", sources: [] },
    ]);
    expect(
      f.queries.filter((q) => q.includes("RETURN DISTINCT r.ownerKey")),
    ).toHaveLength(1);
    expect(f.queries.join(" ")).not.toMatch(/DELETE|SET o\.hash/);
  });

  it("fails the transaction if an owner changes during the upgrade", async () => {
    const f = fixture([{ ownerKey: "g|empty", hash: "old" }], 0);
    await expect(f.store.upgradeOwnerEdgeSources()).rejects.toThrow(
      "ASSET_OWNER_METADATA_CHANGED",
    );
  });
});

describe("AssetGraphStore.finish", () => {
  it("reports whole-graph continuation counts after an incremental publication", async () => {
    const store = new AssetGraphStore({} as never, "test", "g");
    store.run = async () => ({ records: [] }) as never;
    store.counts = async () => ({ nodes: {}, edges: { CONTINUES: 20, CANDIDATE: 7 } });
    const result = await store.finish("v", "manifest", {
      confirmedFieldContinuations: 2,
      candidateFieldContinuations: 1,
      continuationMetrics: {
        totalReadOccurrences: 40,
        continuationEdgeMetrics: { totalContinuationEdges: 3, confirmedContinuationEdges: 2 },
      },
    });
    expect(result).toMatchObject({
      confirmedFieldContinuations: 20,
      candidateFieldContinuations: 7,
      continuationMetrics: {
        totalReadOccurrences: 40,
        continuationEdgeMetrics: { totalContinuationEdges: 27, confirmedContinuationEdges: 20 },
      },
    });
  });
  it("uses post-cleanup live counts and preserves the pre-cleanup delta", async () => {
    const reports: string[] = [];
    const driver = {
      session: () => ({
        run: async (query: string, params?: Record<string, unknown>) => {
          if (query.includes("RETURN n.kind AS kind"))
            return {
              records: [
                record({ kind: "PHYSICAL_DATASET", count: integer(6877) }),
              ],
            };
          if (query.includes("RETURN r.kind AS kind")) return { records: [] };
          if (query.includes("g.state='READY'")) {
            reports.push(String(params?.report));
          }
          return { records: [] };
        },
        close: async () => undefined,
      }),
    };
    const store = new AssetGraphStore(driver as never, "neo4j", "titans-otc");

    const report = await store.finish("version", "manifest", {
      counts: {
        nodes: { PHYSICAL_DATASET: 6893 },
        edges: {},
      },
    });

    expect(report).toMatchObject({
      counts: { nodes: { PHYSICAL_DATASET: 6877 }, edges: {} },
      countBasis: "LIVE_AFTER_UNOWNED_CLEANUP",
      preCleanupCounts: {
        nodes: { PHYSICAL_DATASET: 6893 },
        edges: {},
      },
      countDelta: {
        nodes: { PHYSICAL_DATASET: -16 },
        edges: {},
      },
    });
    expect(JSON.parse(reports[0]!)).toMatchObject({
      counts: { nodes: { PHYSICAL_DATASET: 6877 } },
    });
  });
});
