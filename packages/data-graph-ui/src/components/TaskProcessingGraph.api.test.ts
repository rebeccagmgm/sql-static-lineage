import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../api";

afterEach(() => vi.unstubAllGlobals());

describe("published task explanation API", () => {
  it("pins the exact task, write, column and publication with bounded traversal", async () => {
    const response = { taskId: "104734", version: "published-v1" };
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal("fetch", fetch);
    expect(await api.explain("104734", {
      writeId: "write-observation:104734:19", column: "Cust_Type_Desc", publicationVersion: "published-v1",
    })).toBe(response);
    const request = new URL(fetch.mock.calls[0]![0], "http://localhost");
    expect(request.pathname).toBe("/api/explain");
    expect(Object.fromEntries(request.searchParams)).toEqual({
      taskId: "104734", writeId: "write-observation:104734:19", column: "Cust_Type_Desc", publicationVersion: "published-v1",
      maxDepth: "32", maxNodes: "500", maxEdges: "1000",
    });
  });

  it("surfaces publication mismatches instead of silently reading a later version", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 409, json: async () => ({ error: "ASSET_GRAPH_CHANGED_DURING_QUERY" }),
    }));
    await expect(api.explain("104734", { writeId: "w", column: "x", publicationVersion: "old" }))
      .rejects.toEqual(new ApiError("ASSET_GRAPH_CHANGED_DURING_QUERY", 409));
  });
});
