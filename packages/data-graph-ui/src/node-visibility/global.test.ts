import { describe, expect, it } from "vitest";
import { hideTableCards, normalizeHiddenTables } from "./global";

describe("global table visibility", () => {
  it("accepts exact table names and rejects wildcard or unbounded rules", () => {
    expect(normalizeHiddenTables([" DM_INDEX_N.GRP_DEF ", "dm_index_n.grp_def"])).toEqual(["dm_index_n.grp_def"]);
    for (const value of [["grp_def"], ["dm_index_n.*"], ["a.b'"], null, Array(101).fill("a.b")]) {
      expect(() => normalizeHiddenTables(value)).toThrow("INVALID_HIDDEN_TABLES");
    }
  });
  it("hides table occurrences and incident edges while retaining tasks and other tables", () => {
    const nodes = [
      { id: "table", data: { raw: { id: "raw", kind: "PHYSICAL_DATASET", table: "dm_index_n.grp_def" } } },
      { id: "field", data: { members: [{ id: "f", kind: "WRITE_FIELD", table: "dm_index_n.grp_def" }] } },
      { id: "other", data: { raw: { id: "o", kind: "PHYSICAL_DATASET", table: "other.grp_def" } } },
      { id: "task", data: { raw: { id: "t", kind: "TASK", table: "dm_index_n.grp_def" } } },
    ].map(n => ({ ...n, position: { x: 0, y: 0 } }));
    const edges = [{ id: "in", source: "other", target: "table" }, { id: "out", source: "table", target: "task" }, { id: "keep", source: "other", target: "task" }];
    const graph = hideTableCards(nodes, edges, ["dm_index_n.grp_def"]);
    expect(graph.nodes.map(n => n.hidden)).toEqual([true, true, false, false]);
    expect(graph.edges.map(e => e.hidden)).toEqual([true, true, false]);
    expect(hideTableCards(nodes, edges, []).nodes.every(n => !n.hidden)).toBe(true);
  });
});
