import { describe, expect, it, vi } from "vitest";
import { ClusterCatalog, clusterParams, parseClusters } from "../src/asset-graph/cluster-filter.ts";

describe("cluster entry filter", () => {
  it("validates selections and separates all clusters from missing metadata", () => {
    expect(parseClusters(null)).toEqual([]);
    expect(parseClusters('["", "A", "A"]')).toEqual(["", "A"]);
    expect(() => parseClusters('{}')).toThrow("INVALID_CLUSTER_FILTER");
    expect(() => parseClusters('[1]')).toThrow("INVALID_CLUSTER_FILTER");
    expect(clusterParams(undefined).clusterFiltered).toBe(false);
    expect(clusterParams([]).clusterFiltered).toBe(true);
  });
  it("counts only published tasks, supports multiple clusters and unknown values, and caches reads", async () => {
    const run = vi.fn().mockResolvedValue({ records: ["task:1", "task:2", "task:3"].map(id => ({ get: () => id })) });
    const catalog = new ClusterCatalog({ ready: vi.fn().mockResolvedValue({ version: "v1" }), run } as never, {
      resolveClusters: () => ({ "1": "A", "2": "B", "unpublished": "C" }),
    });
    expect((await catalog.read()).clusters.map(c => c.value).sort()).toEqual(["", "A", "B"]);
    expect(await catalog.select([])).toBeUndefined();
    expect(await catalog.select(["A", "B"])).toEqual(["task:1", "task:2"]);
    expect(await catalog.select([""])).toEqual(["task:3"]);
    expect(await catalog.select(["absent"])).toEqual([]);
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("rejects a catalog collected across publication versions", async () => {
    const ready = vi.fn().mockResolvedValueOnce({ version: "v1" }).mockResolvedValue({ version: "v2" });
    const catalog = new ClusterCatalog({ ready, run: vi.fn().mockResolvedValue({ records: [] }) } as never, { resolveClusters: () => ({}) });
    await expect(catalog.read()).rejects.toThrow("ASSET_GRAPH_CHANGED_DURING_QUERY");
  });
  it("refreshes cluster labels after expiry without rescanning unchanged published tasks", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
    try {
      const ready = vi.fn().mockResolvedValue({ version: "v1" });
      const run = vi.fn().mockResolvedValue({ records: [{ get: () => "task:1" }] });
      const resolveClusters = vi.fn().mockReturnValue({ "1": "A" });
      const catalog = new ClusterCatalog({ ready, run } as never, { resolveClusters });
      expect(await catalog.select(["A"])).toEqual(["task:1"]);
      clock.mockReturnValue(32000);
      resolveClusters.mockReturnValue({ "1": "B" });
      expect(await catalog.select(["B"])).toEqual(["task:1"]);
      expect(run).toHaveBeenCalledTimes(1);
      ready.mockResolvedValue({ version: "v2" });
      await catalog.read();
      expect(run).toHaveBeenCalledTimes(2);
    } finally { clock.mockRestore(); }
  });
});
