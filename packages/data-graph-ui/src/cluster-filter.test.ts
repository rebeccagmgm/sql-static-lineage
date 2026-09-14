import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => vi.unstubAllGlobals());
it("passes cancellation to search requests", async () => {
  const fetch = vi.fn().mockResolvedValue({ok:true,json:async()=>[]});
  vi.stubGlobal("fetch",fetch);
  const controller = new AbortController();
  await api.search("calendar",0,31,["A"],controller.signal);
  expect(fetch.mock.calls[0]![1]).toEqual({signal:controller.signal});
});
it("scopes entry queries and defaults trace requests to all clusters", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetch);
  await api.overview([], ["A", ""]);
  await api.region("pdata_n", 50, 50, [], ["A", ""]);
  await api.search("party", 30, 31, ["A", ""]);
  for (const call of fetch.mock.calls) {
    const url = new URL(call[0], "http://localhost");
    expect(JSON.parse(url.searchParams.get("clusters")!)).toEqual(["A", ""]);
  }
  await api.trace({ taskId: "1", label: "Task 1", layer: "table", direction: "up", depth: 2, includeCandidates: true });
  expect(JSON.parse(new URL(fetch.mock.lastCall![0], "http://localhost").searchParams.get("clusters")!)).toEqual([]);
});
