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

  const serve = async () => {
    const started = await startAssetGraphServer(undefined, 0);
    close = started.close;
    const address = started.server.address();
    if (!address || typeof address === "string") throw new Error("NO_TEST_PORT");
    return `http://127.0.0.1:${address.port}`;
  };

  it("passes bounded offsets through while preserving array responses", async () => {
    const base = await serve();
    const search = await fetch(`${base}/api/search?q=demo&limit=5&offset=7`);
    const fields = await fetch(
      `${base}/api/fields?nodeId=dataset%3Ademo&limit=9&offset=3`,
    );

    expect(await search.json()).toEqual([]);
    expect(await fields.json()).toEqual([]);
    const searchQuery = queries.find(({ query }) => query.includes("CONTAINS $text"));
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
