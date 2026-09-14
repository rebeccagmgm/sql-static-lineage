import { describe, expect, it } from "vitest";
import { restrictTableClusters } from "./clusters";
import { graphMembers, projectScope } from "./model";
import type { GraphNode, TraceResult } from "../types";

const table: GraphNode = {
  id: "table",
  kind: "PHYSICAL_DATASET",
  table: "ods.a",
  detail: { platform: "hive", dataSource: "one", qualifiedName: "ods.a" },
};
const task = (id: string): GraphNode => ({
  id: `task:${id}`,
  kind: "TASK",
  taskId: id,
});
const raw: TraceResult = {
  version: "v1",
  layer: "table",
  direction: "up",
  depthLimit: 1,
  edgeLimit: 400,
  truncated: false,
  stoppedBy: null,
  elapsedMs: 1,
  terminalNodes: [],
  frontierNodeIds: ["task:8"],
  taskClusters: { "7": "A", "8": "B" },
  nodes: [
    table,
    task("7"),
    task("8"),
    { ...table, id: "foreign-table" },
    task("9"),
  ],
  edges: [
    {
      id: "kept",
      from: "table",
      to: "task:7",
      kind: "READS_TABLE",
      status: "UNKNOWN",
    },
    { id: "cut", from: "task:8", to: "table", kind: "WRITES_TABLE" },
    { id: "foreign", from: "foreign-table", to: "task:8", kind: "READS_TABLE" },
  ],
};

describe("cluster boundary throughout analysis", () => {
  it("cuts foreign tasks and their exclusive tables, preserves shared physical identity and evidence", () => {
    const result = restrictTableClusters(raw, ["A"], [table.id]);
    expect(result.trace.nodes.map((n) => n.id)).toEqual([table.id, "task:7"]);
    expect(result.trace.edges).toEqual([raw.edges[0]]);
    expect(result.trace.frontierNodeIds).toEqual([]);
    expect(result.omittedTaskIds).toEqual(["8", "9"]);
    expect(restrictTableClusters(raw, []).trace).toBe(raw);
    expect(
      restrictTableClusters(raw, [""]).trace.nodes.map((n) => n.id),
    ).toEqual(["task:9"]);
  });

  it("keeps the existing valid graph when an expansion reaches only excluded tasks", () => {
    const result = restrictTableClusters(
      { ...raw, nodes: [table, task("8")] },
      ["A"],
      [table.id],
    );
    expect(result.trace.nodes).toEqual([table]);
    expect(result.trace.edges).toEqual([]);
  });

  it("field projection cannot bring another cluster back through the same physical table", () => {
    const allowed = restrictTableClusters(raw, ["A"]).trace;
    const root: GraphNode = {
      ...table,
      id: "root",
      kind: "WRITE_FIELD",
      taskId: "7",
      column: "id",
    };
    const foreign: GraphNode = { ...root, id: "foreign", taskId: "8" };
    const disconnected: GraphNode = { ...root, id: "reentry" };
    const result = projectScope(
      {
        ...raw,
        layer: "field",
        nodes: [root, foreign, disconnected],
        edges: [
          {
            id: "one",
            from: foreign.id,
            to: root.id,
            kind: "CONTINUES",
            status: "UNKNOWN",
          },
          { id: "two", from: disconnected.id, to: foreign.id, kind: "VALUE" },
        ],
      },
      graphMembers(allowed),
      [root.id],
    );
    expect(result.trace.nodes).toEqual([root]);
    expect(result.trace.edges).toEqual([]);
    expect(result.boundary).toEqual([foreign]);
    expect(result.omittedNodes).toBe(2);
  });
});
