import { describe, expect, it } from "vitest";
import {
  collectMultiFieldTrace,
  loadAllFieldPages,
  shouldFallbackToDepthOne,
} from "./multi-field-trace";
import type { GraphNode, TraceResult } from "./types";

const root = (id: string): GraphNode => ({
  id,
  kind: "WRITE_FIELD",
  table: "s.t",
  column: id,
});
const trace = (
  rootNode: GraphNode,
  version = "v1",
  edgeSuffix = "x",
): TraceResult => ({
  version,
  layer: "field",
  direction: "up",
  depthLimit: 2,
  edgeLimit: 150,
  truncated: false,
  stoppedBy: null,
  frontierNodeIds: [],
  terminalNodes: [],
  elapsedMs: 1,
  nodes: [
    rootNode,
    { id: `source-${edgeSuffix}`, kind: "READ_FIELD", depth: 1 },
  ],
  edges: [
    {
      id: `edge-${edgeSuffix}`,
      from: `source-${edgeSuffix}`,
      to: rootNode.id,
      kind: "VALUE",
    },
  ],
});

describe("collectMultiFieldTrace", () => {
  it("deduplicates shared evidence while keeping every selected root", async () => {
    const roots = [root("a"), root("b")];
    const result = await collectMultiFieldTrace({
      roots,
      isCurrent: () => true,
      fetchTrace: async (item) => ({
        ...trace(item),
        nodes: [
          item,
          { id: "junction", kind: "READ_FIELD" },
          { id: "source", kind: "READ_FIELD" },
        ],
        edges: [
          {
            id: `root-${item.id}`,
            from: "junction",
            to: item.id,
            kind: "VALUE",
          },
          { id: "shared", from: "source", to: "junction", kind: "CONTINUES" },
        ],
      }),
    });
    expect(result.edges).toHaveLength(3);
    expect(result.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["a", "b"]),
    );
  });
  it("retains parallel canonical edges with distinct identities", async () => {
    const item = root("a");
    const result = await collectMultiFieldTrace({
      roots: [item],
      isCurrent: () => true,
      fetchTrace: async () => ({
        ...trace(item),
        edges: [
          {
            id: "confirmed",
            from: "source-x",
            to: "a",
            kind: "CONTINUES",
            status: "CONFIRMED",
          },
          {
            id: "candidate",
            from: "source-x",
            to: "a",
            kind: "CONTINUES",
            status: "CANDIDATE",
          },
        ],
      }),
    });
    expect(result.edges.map((edge) => edge.id)).toEqual([
      "confirmed",
      "candidate",
    ]);
  });
  it("fails closed across versions", async () => {
    let calls = 0;
    await expect(
      collectMultiFieldTrace({
        roots: [root("a"), root("b")],
        isCurrent: () => true,
        fetchTrace: async (item) =>
          trace(item, ++calls === 1 ? "v1" : "v2", item.id),
      }),
    ).rejects.toThrow("ASSET_GRAPH_CHANGED_DURING_MULTI_FIELD_QUERY");
  });
  it("stops stale sequential work", async () => {
    let current = true,
      calls = 0;
    const roots = Array.from({ length: 23 }, (_, index) => root(String(index)));
    await expect(
      collectMultiFieldTrace({
        roots,
        isCurrent: () => current,
        fetchTrace: async (item) => {
          calls += 1;
          current = false;
          return trace(item);
        },
      }),
    ).rejects.toThrow("STALE_MULTI_FIELD_QUERY");
    expect(calls).toBe(1);
  });
  it("reports unqueried roots without drawing misleading isolated nodes", async () => {
    const roots = [root("a"), root("b")];
    const result = await collectMultiFieldTrace({
      roots,
      edgeLimit: 1,
      isCurrent: () => true,
      fetchTrace: async (item) => trace(item, "v1", item.id),
    });
    expect(result.truncated).toBe(true);
    expect(result.unqueriedRootNodeIds).toEqual(["b"]);
    expect(result.nodes.some(node => node.id === "b")).toBe(false);
    expect(result.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["a"]),
    );
  });
  it("merges task labels, stop reasons and the shortest shared depth", async () => {
    const roots = [root("a"), root("b")];
    const result = await collectMultiFieldTrace({
      roots,
      isCurrent: () => true,
      fetchTrace: async (item) => ({
        ...trace(item, "v1", item.id),
        stoppedBy: item.id === "b" ? "DEPTH_LIMIT" : null,
        taskLabels: { [`task-${item.id}`]: `name-${item.id}` },
        taskTopics: { [`task-${item.id}`]: `topic-${item.id}` },
        taskTopicDescriptions: { [`task-${item.id}`]: `中文-${item.id}` },
        nodes: [
          item,
          {
            id: "shared",
            kind: "READ_FIELD",
            depth: item.id === "a" ? 2 : 1,
          },
        ],
        edges: [
          {
            id: `edge-${item.id}`,
            from: "shared",
            to: item.id,
            kind: "VALUE",
          },
        ],
      }),
    });
    expect(result.taskLabels).toEqual({
      "task-a": "name-a",
      "task-b": "name-b",
    });
    expect(result.taskTopics).toEqual({ "task-a": "topic-a", "task-b": "topic-b" });
    expect(result.taskTopicDescriptions).toEqual({ "task-a": "中文-a", "task-b": "中文-b" });
    expect(result.stoppedBy).toBe("DEPTH_LIMIT");
    expect(result.nodes.find((node) => node.id === "shared")?.depth).toBe(1);
  });
  it("trims in root-reachable order even when the API edge array is reversed", async () => {
    const item = root("root");
    const result = await collectMultiFieldTrace({
      roots: [item],
      edgeLimit: 1,
      isCurrent: () => true,
      fetchTrace: async () => ({
        ...trace(item),
        nodes: [
          item,
          { id: "near", kind: "READ_FIELD" },
          { id: "far", kind: "READ_FIELD" },
        ],
        edges: [
          { id: "far", from: "far", to: "near", kind: "VALUE" },
          { id: "near", from: "near", to: "root", kind: "VALUE" },
        ],
      }),
    });
    expect(result.edges.map((edge) => edge.id)).toEqual(["near"]);
    expect(result.nodes.map((node) => node.id)).not.toContain("far");
  });
});

describe("field query orchestration", () => {
  it("loads every page without a field-count cap", async () => {
    const all = Array.from({ length: 305 }, (_, index) => root(String(index)));
    const result = await loadAllFieldPages({
      readVersion: async () => "v1",
      isCurrent: () => true,
      fetchPage: async (offset, limit) => all.slice(offset, offset + limit),
    });
    expect(result).toHaveLength(305);
    expect(result.at(-1)?.id).toBe("304");
  });
  it("rejects field pages spanning a publication change", async () => {
    let reads = 0;
    await expect(loadAllFieldPages({
      readVersion: async () => ++reads === 1 ? "v1" : "v2",
      isCurrent: () => true,
      pageSize: 1,
      fetchPage: async (offset) => offset === 0 ? [root("a"), root("b")] : [root("b")],
    })).rejects.toThrow("字段加载期间图谱已换版");
  });
  it("falls back only for an edge-limit truncation above depth one", () => {
    const item = {
      ...trace(root("a")),
      truncated: true,
      stoppedBy: "EDGE_LIMIT" as const,
    };
    expect(shouldFallbackToDepthOne(item, 4)).toBe(true);
    expect(shouldFallbackToDepthOne(item, 1)).toBe(false);
    expect(
      shouldFallbackToDepthOne({ ...item, stoppedBy: "DEPTH_LIMIT" }, 4),
    ).toBe(false);
  });
});
