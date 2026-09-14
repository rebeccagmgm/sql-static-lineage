import { describe, expect, it } from "vitest";
import { layoutTableTrace } from "./layout";
import type { TraceResult } from "../types";
const trace: TraceResult = {
  version: "v1",
  layer: "table",
  direction: "up",
  depthLimit: 1,
  edgeLimit: 400,
  truncated: false,
  stoppedBy: null,
  frontierNodeIds: [],
  terminalNodes: [],
  elapsedMs: 1,
  nodes: [
    { id: "raw", kind: "PHYSICAL_DATASET" },
    { id: "collect", kind: "TASK" },
    { id: "ods", kind: "PHYSICAL_DATASET" },
    { id: "model", kind: "TASK" },
    { id: "out", kind: "PHYSICAL_DATASET" },
  ],
  edges: [
    { from: "raw", to: "collect", kind: "READS_TABLE" },
    { from: "collect", to: "ods", kind: "WRITES_TABLE" },
    { from: "ods", to: "model", kind: "READS_TABLE" },
    { from: "model", to: "out", kind: "WRITES_TABLE" },
  ],
};
describe("table graph layout", () => {
  it("places multi-stage processing by observed edges, not fixed source/task/target columns", () => {
    const result = layoutTableTrace(trace);
    expect(result.nodes.map((n) => n.depth)).toEqual([0, 1, 2, 3, 4]);
    expect(result.edges).toBe(trace.edges);
    expect(trace.nodes.every((n) => n.depth === undefined)).toBe(true);
  });
  it("retains cycles and unknown edges without infinite ranking or merging identities", () => {
    const input = {
      ...trace,
      edges: [
        ...trace.edges,
        { from: "out", to: "model", kind: "READS_TABLE", status: "UNKNOWN" },
      ],
    };
    const result = layoutTableTrace(input);
    expect(result.nodes.map((n) => n.depth)).toEqual([0, 1, 2, 3, 3]);
    expect(result.edges).toEqual(input.edges);
    expect(result.nodes).toHaveLength(5);
  });
});
