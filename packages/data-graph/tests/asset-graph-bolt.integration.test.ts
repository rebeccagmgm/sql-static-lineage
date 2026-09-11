import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assetGraphConfig, openAssetGraph } from "../src/asset-graph/config.ts";
import { AssetGraphStore } from "../src/asset-graph/store.ts";
import type { AssetNode, AssetEdge } from "../src/asset-graph/compile.ts";

// An explicitly provisioned probe database is required. Never target the
// configured production database or create/delete databases from the test.
const configPath = process.env.ASSET_GRAPH_BOLT_TEST_CONFIG;
describe.skipIf(!configPath)("ArcadeDB store integration", () => {
  it("preserves identities, traversal, edge-only owners, rollback and shared nodes", async () => {
    const config = assetGraphConfig(configPath);
    expect(config.provider).toBe("arcadedb");
    expect(config.connection.database).toMatch(/_probe$/);
    const connection = await openAssetGraph(configPath);
    const graphId = `integration-${randomUUID()}`;
    const store = new AssetGraphStore(
      connection.driver,
      connection.database,
      graphId,
    );
    const node = (id: string, kind: string): AssetNode => ({
      id,
      kind,
      taskId: "100",
      table: "demo.positions",
      column: "balance",
      writeId: "write-100",
      label: `金额-${id}`,
      detail: "{}",
    });
    const edge = (id: string, from: string, kind: string): AssetEdge => ({
      id,
      from,
      to: "out",
      kind,
      layer: "field",
      owner: "100",
      status: "CONFIRMED",
      detail: "{}",
    });
    const graph = {
      nodes: [
        node("task:100", "TASK"),
        node("out", "WRITE_FIELD"),
        node("in", "READ_FIELD"),
        node("candidate", "READ_FIELD"),
      ],
      edges: [
        edge("value", "in", "VALUE"),
        edge("candidate", "candidate", "CANDIDATE"),
        edge("condition", "in", "CONDITION"),
      ],
    };
    try {
      await store.initialize();
      await store.initialize();
      await store.begin("v1");
      await expect(store.ready()).rejects.toThrow("ASSET_GRAPH_NOT_PUBLISHED");
      await store.replace("100", "hash-1", graph);
      await store.finish("v1", "fixture-manifest", {});
      const before = await store.counts();
      await store.replace("100", "hash-1", graph);
      expect(await store.counts()).toEqual(before);
      expect((await store.fields({ taskId: "100" })).map((n) => n.id)).toEqual([
        "out",
      ]);
      expect(await store.fields({ taskId: "100", offset: 1 })).toEqual([]);
      expect((await store.search("金额")).map((n) => n.id)).toEqual([
        "task:100",
      ]);
      const trace = {
        taskId: "100",
        column: "balance",
        layer: "field" as const,
        depth: 2,
      };
      expect(
        (await store.traverse(trace)).edges.map((e) => e.id).sort(),
      ).toEqual(["candidate", "value"]);
      expect(
        (await store.traverse({ ...trace, taskId: undefined, table: "demo.positions" }))
          .edges.map((e) => e.id).sort(),
      ).toEqual(["candidate", "value"]);
      expect(
        (await store.traverse({ ...trace, writeId: "different-write" })).nodes,
      ).toEqual([]);
      expect(
        (
          await store.traverse({ ...trace, includeCandidates: false })
        ).edges.map((e) => e.id),
      ).toEqual(["value"]);
      expect((await store.traverse({ ...trace, limit: 1 })).truncated).toBe(
        true,
      );
      await expect(
        store.replace("100", "broken", {
          nodes: graph.nodes,
          edges: [edge("missing", "absent", "VALUE")],
        }),
      ).rejects.toThrow("ASSET_EDGE_ENDPOINT_MISSING");
      expect((await store.owners()).get("100")).toBe("hash-1");
      expect(await store.counts()).toEqual(before);

      // Continuation/schedule owners contribute edges with no owned nodes.
      await store.replace("300", "edges-1", {
        nodes: [],
        edges: [
          edge("cross-1", "in", "CONTINUES"),
          edge("cross-2", "in", "CANDIDATE"),
        ],
      });
      await store.replace("300", "edges-2", {
        nodes: [],
        edges: [edge("cross-3", "candidate", "CONTINUES")],
      });
      expect((await store.counts()).edges).toMatchObject({
        CONTINUES: 1,
        CANDIDATE: 1,
        VALUE: 1,
      });
      await expect(
        store.replace("300", "broken", {
          nodes: [],
          edges: [edge("missing", "absent", "CONTINUES")],
        }),
      ).rejects.toThrow("ASSET_EDGE_ENDPOINT_MISSING");
      expect((await store.owners()).get("300")).toBe("edges-2");
      await store.run(
        "MATCH (o:SLAssetOwner {key:$key}) REMOVE o.edgeSourceKeys",
        { key: `${graphId}|300` },
      );
      await store.replace("empty", "empty-hash", { nodes: [], edges: [] });
      await store.run(
        "MATCH (o:SLAssetOwner {key:$key}) REMOVE o.edgeSourceKeys",
        { key: `${graphId}|empty` },
      );
      const beforeUpgrade = await store.counts();
      expect(await store.upgradeOwnerEdgeSources()).toBe(2);
      expect(await store.upgradeOwnerEdgeSources()).toBe(0);
      expect(await store.counts()).toEqual(beforeUpgrade);
      expect((await store.owners()).get("300")).toBe("edges-2");
      const upgraded = await store.run(
        "MATCH (o:SLAssetOwner {key:$key}) RETURN o.edgeSourceKeys AS sources",
        { key: `${graphId}|300` },
      );
      expect(upgraded.records[0]!.get("sources")).toEqual([`${graphId}|candidate`]);
      await store.remove("300");
      expect(await store.counts()).toEqual(before);

      await store.replace("200", "shared", {
        nodes: [node("in", "READ_FIELD")],
        edges: [],
      });
      await store.remove("100");
      await store.finish("v2", "fixture-manifest", {});
      expect(await store.counts()).toEqual({
        nodes: { READ_FIELD: 1 },
        edges: {},
      });
      expect((await store.ready()).version).toBe("v2");
    } finally {
      // Cleanup is restricted to the unique graph created by this invocation.
      for (const query of [
        "MATCH (n:SLAssetNode {graphId:$graphId}) DETACH DELETE n",
        "MATCH (o:SLAssetOwner {graphId:$graphId}) DETACH DELETE o",
        "MATCH (g:SLAssetGraph {id:$graphId}) DETACH DELETE g",
      ])
        await store.run(query).catch(() => undefined);
      await connection.driver.close();
    }
  }, 60_000);
});
