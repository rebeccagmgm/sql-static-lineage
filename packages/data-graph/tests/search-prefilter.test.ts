import { expect, it, vi } from "vitest";
import { AssetGraphStore } from "../src/asset-graph/store.ts";

it("materializes name/description matches before relationship filtering and paginates last", async () => {
  const store = new AssetGraphStore({} as never, "test", "graph");
  vi.spyOn(store, "ready").mockResolvedValue({state:"READY",version:"v1"} as never);
  const run = vi.spyOn(store, "run").mockResolvedValue({records:[]} as never);
  const identities = [{platform:"hive",dataSource:"source",qualifiedName:"s.t"}];
  await store.search("交易日", 31, 30, identities, ["task:1"]);
  const [query, params] = run.mock.calls[0]!;
  expect(query.indexOf("toLower(n.label) CONTAINS")).toBeLessThan(query.indexOf("collect(n) AS matchedNodes"));
  expect(query.indexOf("UNWIND matchedNodes")).toBeLessThan(query.indexOf("EXISTS { MATCH"));
  expect(query.indexOf("EXISTS { MATCH")).toBeLessThan(query.indexOf("SKIP $offset"));
  expect(params).toMatchObject({text:"交易日",metadataIdentities:identities,clusterFiltered:true,clusterTaskIds:["task:1"],limit:31,offset:30});
});
