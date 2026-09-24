import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";
import { appendTableBranch } from "./branch-expansion";
import { adaptTrace } from "./graph-adapter";
import { projectTableDisplay } from "./analysis-scope/table-display";
import { taskTableId } from "../../data-graph/src/asset-graph/task-table-context";
import type { TraceResult } from "./types";

afterEach(() => vi.unstubAllGlobals());
const a = taskTableId({
  taskNodeId: "task:103935",
  datasetId: "dataset:shared",
  role: "WRITE",
});
const b = taskTableId({
  taskNodeId: "task:999",
  datasetId: "dataset:shared",
  role: "WRITE",
});

it("passes the saved task-scoped table ID unchanged through the trace API", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ nodes: [], edges: [] }),
    });
  vi.stubGlobal("fetch", fetch);
  await api.trace({
    nodeId: a,
    label: "shared",
    layer: "table",
    direction: "down",
    depth: 1,
    includeCandidates: true,
  });
  expect(
    new URL(fetch.mock.calls[0]![0], "http://localhost").searchParams.get(
      "nodeId",
    ),
  ).toBe(a);
});

it("preserves task paths in raw data while merging their physical table on the canvas", () => {
  const base: TraceResult = {
    version: "v1",
    layer: "table",
    direction: "down",
    depthLimit: 2,
    edgeLimit: 400,
    truncated: false,
    stoppedBy: null,
    frontierNodeIds: [],
    terminalNodes: [],
    elapsedMs: 0,
    nodes: [
      { id: "task:103935", kind: "TASK", taskId: "103935" },
      {
        id: a,
        kind: "PHYSICAL_DATASET",
        physicalNodeId: "dataset:shared",
        table: "shared",
        depth: 1,
      },
      { id: "task:999", kind: "TASK", taskId: "999", depth: 2 },
    ],
    edges: [
      { id: "a-write", from: "task:103935", to: a, kind: "WRITES_TABLE" },
    ],
  };
  const branch: TraceResult = {
    ...base,
    nodes: [
      { id: "task:999", kind: "TASK", taskId: "999" },
      {
        id: b,
        kind: "PHYSICAL_DATASET",
        physicalNodeId: "dataset:shared",
        table: "shared",
        depth: 1,
      },
    ],
    edges: [{ id: "b-write", from: "task:999", to: b, kind: "WRITES_TABLE" }],
  };
  const merged = appendTableBranch(
    base,
    branch,
    base.nodes[2]!,
    "down",
    [],
  ).trace;
  expect(
    merged.nodes.filter((n) => n.kind === "PHYSICAL_DATASET").map((n) => n.id),
  ).toEqual([a, b]);
  const canvas = adaptTrace(projectTableDisplay(merged));
  expect(
    canvas.nodes.filter((n) => n.data.raw?.kind === "PHYSICAL_DATASET"),
  ).toHaveLength(1);
  expect(canvas.edges).toHaveLength(2);
  expect(canvas.edges.map(e => e.target)).toEqual(["dataset:shared", "dataset:shared"]);
});
