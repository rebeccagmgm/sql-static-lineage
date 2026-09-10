import { afterEach, describe, expect, it, vi } from "vitest";
import type { Driver } from "neo4j-driver";

const queries: Array<{ query: string; params: Record<string, unknown> }> = [];
const record = (values: Record<string, unknown>) => ({
  get: (name: string) => values[name],
});
const driver = {
  session: () => ({
    run: async (query: string, params: Record<string, unknown>) => {
      queries.push({ query, params });
      if (query.includes("MATCH (g:SLAssetGraph"))
        return {
          records: [
            record({
              g: {
                state: "READY",
                version: "test-version",
                report: "{}",
                manifestPath: "unused.json",
              },
            }),
          ],
        };
      return { records: [] };
    },
    close: async () => undefined,
  }),
  close: async () => undefined,
} as unknown as Driver;

vi.mock("../src/asset-graph/config.ts", () => ({
  openAssetGraph: async () => ({
    driver,
    database: "neo4j",
    graphId: "test-graph",
  }),
}));

import { AssetGraphStore } from "../src/asset-graph/store.ts";
import { startAssetGraphServer } from "../src/asset-graph/service.ts";

const integer = (value: unknown) =>
  typeof value === "object" && value !== null && "toNumber" in value
    ? (value as { toNumber: () => number }).toNumber()
    : value;

describe("asset graph HTTP query contract", () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await close?.();
    close = undefined;
    queries.length = 0;
  });

  const serve = async (metadataCatalogRoot?: string) => {
    const started = await startAssetGraphServer(undefined, 0, {
      metadataCatalogRoot,
    });
    close = started.close;
    const address = started.server.address();
    if (!address || typeof address === "string")
      throw new Error("NO_TEST_PORT");
    return `http://127.0.0.1:${address.port}`;
  };

  it("keeps graph status available while reporting a missing metadata catalog", async () => {
    const base = await serve();
    const status = await fetch(`${base}/api/status`);

    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      state: "READY",
      version: "test-version",
      metadataCatalog: {
        status: "MISSING",
        reason: "METADATA_CATALOG_MISSING",
      },
    });
  });

  it("passes bounded offsets through while preserving array responses", async () => {
    const base = await serve();
    const search = await fetch(`${base}/api/search?q=demo&limit=5&offset=7`);
    const fields = await fetch(
      `${base}/api/fields?nodeId=dataset%3Ademo&limit=9&offset=3`,
    );

    expect(await search.json()).toEqual([]);
    expect(await fields.json()).toEqual([]);
    const searchQuery = queries.find(({ query }) =>
      query.includes("CONTAINS $text"),
    );
    const fieldsQuery = queries.find(({ query }) =>
      query.includes("key:$datasetKey"),
    );
    expect(integer(searchQuery?.params.offset)).toBe(7);
    expect(integer(fieldsQuery?.params.offset)).toBe(3);
    expect(fieldsQuery?.params.datasetKey).toBe("test-graph|dataset:demo");
  });

  it("rejects invalid pagination, field selectors, and trace directions", async () => {
    const base = await serve();
    const cases = [
      ["/api/search?offset=-1", "INVALID_QUERY_OFFSET"],
      ["/api/fields", "FIELDS_SELECTOR_REQUIRED"],
      [
        "/api/fields?taskId=1&nodeId=dataset%3Ademo",
        "FIELDS_SELECTORS_MUTUALLY_EXCLUSIVE",
      ],
      ["/api/trace?direction=sideways", "INVALID_GRAPH_DIRECTION"],
      ["/api/trace?depthUnit=rows", "INVALID_DEPTH_UNIT"],
    ] as const;
    for (const [path, error] of cases) {
      const response = await fetch(`${base}${path}`);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error });
    }
  });

  it("exposes bounded overview and region dataset routes", async () => {
    const base = await serve();
    const overview = await fetch(
      `${base}/api/overview?regionLimit=8&flowLimit=13`,
    );
    const region = await fetch(
      `${base}/api/regions?schema=dm_otc_n&limit=6&offset=2`,
    );

    expect(overview.status).toBe(200);
    expect(await overview.json()).toEqual(
      expect.objectContaining({
        version: "test-version",
        limits: { regions: 8, flows: 13 },
      }),
    );
    expect(region.status).toBe(200);
    expect(await region.json()).toEqual(
      expect.objectContaining({
        version: "test-version",
        schema: "dm_otc_n",
        pagination: { offset: 2, limit: 6, nextOffset: null },
      }),
    );
  });

  const isolatedCatalogRoot = process.env.METADATA_CATALOG_HTTP_VERIFY_ROOT;
  const isolatedIt = isolatedCatalogRoot ? it : it.skip;
  isolatedIt(
    "keeps trace topology stable and serves catalog metadata after thirty seconds",
    async () => {
      const graphNodes = [
        {
          id: "task:86840",
          kind: "TASK",
          taskId: "86840",
          depth: 0,
        },
        {
          id: "dataset:hive:gfhive:pdata_n.t98_otc_deri_comp_sale_info",
          kind: "PHYSICAL_DATASET",
          table: "pdata_n.t98_otc_deri_comp_sale_info",
          depth: 1,
          detail: {
            platform: "hive",
            dataSource: "gfhive",
            qualifiedName: "pdata_n.t98_otc_deri_comp_sale_info",
            stableTableId: "pdata_n.t98_otc_deri_comp_sale_info__gfhive",
            identityStatus: "CONFIRMED",
          },
        },
      ];
      const graphEdges = [
        {
          id: "edge:86840:table",
          source: graphNodes[0].id,
          target: graphNodes[1].id,
          kind: "WRITES_TABLE",
          layer: "table",
        },
      ];
      vi.spyOn(AssetGraphStore.prototype, "traverse").mockResolvedValue({
        version: "test-version",
        layer: "table",
        direction: "up",
        depthLimit: 2,
        edgeLimit: 80,
        truncated: false,
        stoppedBy: null,
        frontierNodeIds: [],
        terminalNodes: [],
        nodes: graphNodes,
        edges: graphEdges,
        elapsedMs: 7,
        projectionGenerations: 0,
      });
      vi.spyOn(
        AssetGraphStore.prototype,
        "metadataIdentities",
      ).mockResolvedValue(new Map());
      const base = await serve(isolatedCatalogRoot);
      const request = async (label: string) => {
        const started = performance.now();
        const response = await fetch(
          `${base}/api/trace?taskId=86840&layer=table&direction=up&depth=2&depthUnit=table-hop&limit=80`,
        );
        const body = await response.text();
        const received = performance.now();
        const value = JSON.parse(body);
        const parsed = performance.now();
        expect(response.status).toBe(200);
        expect(value.nodes.map((node: { id: string }) => node.id)).toEqual(
          graphNodes.map((node) => node.id),
        );
        expect(value.edges).toEqual(graphEdges);
        expect(value.nodes[1].metadata).toMatchObject({
          table: { status: "AVAILABLE" },
          metadataCatalog: { status: "READY" },
        });
        return {
          label,
          graphQueryMs: value.elapsedMs,
          completeHttpMs: Number((received - started).toFixed(3)),
          clientJsonParseMs: Number((parsed - received).toFixed(3)),
          nodes: value.nodes.length,
          edges: value.edges.length,
          metadataVersion: value.nodes[1].metadata.metadataCatalog.version,
        };
      };

      const measurements = [await request("first"), await request("repeat")];
      await new Promise((resolve) => setTimeout(resolve, 31_000));
      measurements.push(await request("after-31s"));
      console.info(`METADATA_HTTP_VERIFY ${JSON.stringify(measurements)}`);
    },
    40_000,
  );
});

describe("exact physical dataset field lookup", () => {
  it("follows WRITES and HAS_FIELD from the requested dataset identity", async () => {
    const store = new AssetGraphStore(driver, "neo4j", "test-graph");
    await store.fields({ nodeId: "dataset:exact", limit: 12, offset: 4 });
    const call = queries.find(({ query }) => query.includes("WITH DISTINCT n"));

    expect(call?.query).toContain(
      "PHYSICAL_DATASET',key:$datasetKey})<-[:SL_ASSET_EDGE",
    );
    expect(call?.query).toContain("kind:'WRITES'");
    expect(call?.query).toContain("kind:'HAS_FIELD'");
    expect(call?.params.datasetKey).toBe("test-graph|dataset:exact");
    expect(integer(call?.params.limit)).toBe(12);
    expect(integer(call?.params.offset)).toBe(4);
  });
});
