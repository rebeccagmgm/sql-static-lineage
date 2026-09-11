import { describe, expect, it } from "vitest";
import type { OverviewResult } from "../types";
import { CARD_HEIGHT, CARD_WIDTH, curvedRoute, layoutOverview, relationDirection, relatedRegions } from "./layout";

function overview(): OverviewResult {
  return { version: "v", stages: [], limits: { regions: 100, flows: 150 }, truncated: { regions: false, flows: false }, excluded: { unqualifiedDatasets: 0 },
    regions: [
      { schema: "source", stage: "UNCLASSIFIED", datasetCount: 3 },
      { schema: "middle", stage: "PDATA", datasetCount: 8 },
      { schema: "target", stage: "DM", datasetCount: 2 },
      { schema: "isolated", stage: "UNCLASSIFIED", datasetCount: 1 },
    ],
    flows: [["source", "middle"], ["middle", "target"]].map(([fromSchema, toSchema]) => ({ fromSchema, toSchema, fromStage: "UNCLASSIFIED", toStage: "UNCLASSIFIED", taskCount: 4, evidenceKind: "TABLE_IO" })),
  };
}

describe("overview canvas layout", () => {
  it("packs a broad stage into multiple columns while retaining every region and flow", () => {
    const input = overview();
    input.regions.push(...Array.from({ length: 72 }, (_, i) => ({ schema: `extra_${i}`, stage: "UNCLASSIFIED", datasetCount: 1 })));
    const graph = layoutOverview(input);
    expect(graph.nodes).toHaveLength(input.regions.length);
    expect(graph.edges.map(edge => edge.flow)).toEqual(input.flows);
    const unknown = graph.nodes.filter(node => node.region.stage === "UNCLASSIFIED");
    expect(new Set(unknown.map(node => node.position.x)).size).toBeGreaterThan(4);
    const width = Math.max(...graph.nodes.map(node => node.position.x)) + CARD_WIDTH;
    const height = Math.max(...graph.nodes.map(node => node.position.y)) + CARD_HEIGHT;
    expect(height / width).toBeLessThan(1.5);
    expect(graph.sections).toHaveLength(3);
  });
  it("keeps cyclic and shared branches finite and non-overlapping", () => {
    const input = overview();
    input.flows.push({ ...input.flows[0], fromSchema: "target", toSchema: "source" });
    const graph = layoutOverview(input);
    for (let i = 0; i < graph.nodes.length; i++) {
      const a = graph.nodes[i].position;
      expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true);
      for (const node of graph.nodes.slice(i + 1)) {
        const b = node.position;
        expect(Math.abs(a.x - b.x) >= CARD_WIDTH || Math.abs(a.y - b.y) >= CARD_HEIGHT).toBe(true);
      }
    }
    expect(graph.edges).toHaveLength(3);
    expect(graph.edges.every(edge => !curvedRoute(edge.points).includes("NaN"))).toBe(true);
    expect(layoutOverview(input)).toEqual(graph);
  });
  it("highlights only adjacent regions without inventing edges or changing counts", () => {
    const input = overview();
    expect(relatedRegions(input, "middle")).toEqual(new Set(["middle", "source", "target"]));
    expect(relatedRegions(input, undefined)).toBeUndefined();
    expect(layoutOverview({ ...input, regions: [], flows: [] }).nodes).toEqual([]);
  });
});

it("distinguishes incoming and outgoing relative to the selected region", () => {
  expect(relationDirection("a", "b", "b")).toBe("incoming");
  expect(relationDirection("b", "a", "b")).toBe("outgoing");
  expect(relationDirection("a", "c", "b")).toBeUndefined();
  expect(relationDirection("a", "b")).toBeUndefined();
});
