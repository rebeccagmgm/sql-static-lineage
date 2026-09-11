import { describe, expect, it } from "vitest";
import { appendHiddenBatch, projectVisibility } from "./state";

describe("incremental node visibility", () => {
  const nodes = ["a", "b", "c"].map(id => ({ id, position: { x: 0, y: 0 }, data: {} }));
  const edges = [{ id: "ab", source: "a", target: "b" }, { id: "bc", source: "b", target: "c" }, { id: "ac", source: "a", target: "c", hidden: true }];
  it("hides batches and restores only the last batch on undo", () => {
    const first = appendHiddenBatch([], ["b", "b"]);
    const second = appendHiddenBatch(first, ["b", "c"]);
    expect(second).toEqual([["b"], ["c"]]);
    expect(projectVisibility(nodes, edges, second.slice(0, -1), []).nodes.map(n => n.hidden)).toEqual([false, true, false]);
    expect(first).toEqual([["b"]]);
    expect(appendHiddenBatch(first, ["b"])).toBe(first);
  });
  it("hides incident edges without inventing a shortcut or clearing existing edge hiding", () => {
    const graph = projectVisibility(nodes, edges, [["b"]], ["b", "c"]);
    expect(graph.edges.every(edge => edge.hidden)).toBe(true);
    expect(graph.edges.map(edge => edge.id)).toEqual(["ab", "bc", "ac"]);
    expect(graph.nodes.map(node => node.selected)).toEqual([false, false, true]);
    expect(projectVisibility(nodes, edges, [], []).edges.map(edge => edge.hidden)).toEqual([false, false, true]);
    expect(edges[0].hidden).toBeUndefined();
  });
});
