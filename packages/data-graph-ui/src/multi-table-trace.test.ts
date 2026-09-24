import { describe, expect, it, vi } from "vitest";
import { collectMultiTableTrace, mergeTableTraceContext } from "./multi-table-trace";
import type { Anchor, GraphNode, TraceResult } from "./types";

const datasetId = "dataset:hive:warehouse:pdata_n.t98_otc_deri_comp_sale_info";

function root(taskId: string): { id: string; label: string; anchor: Anchor } {
  return {
    id: `task:${taskId}`,
    label: `调度 ${taskId}`,
    anchor: { taskId, label: `调度 ${taskId}` },
  };
}

function taskTrace(taskId: string, partition: string, version = "v1"): TraceResult {
  const writeId = `write:${taskId}:${partition}`;
  const nodes: GraphNode[] = [
    { id: `task:${taskId}`, kind: "TASK", taskId, label: `调度 ${taskId}` },
    { id: writeId, kind: "TARGET_WRITE", taskId, table: "pdata_n.t98_otc_deri_comp_sale_info" },
    { id: datasetId, kind: "PHYSICAL_DATASET", table: "pdata_n.t98_otc_deri_comp_sale_info" },
  ];
  return {
    version,
    layer: "table",
    direction: "up",
    depthLimit: 2,
    edgeLimit: 400,
    truncated: false,
    stoppedBy: null,
    frontierNodeIds: [],
    terminalNodes: [],
    elapsedMs: 2,
    nodes,
    edges: [
      { id: `edge:${taskId}:write`, from: `task:${taskId}`, to: writeId, kind: "OWNS_WRITE" },
      { id: `edge:${taskId}:dataset`, from: writeId, to: datasetId, kind: "WRITES_TABLE", detail: { partition } },
    ],
  };
}

describe("collectMultiTableTrace", () => {
  it("adds a direct write context without replacing the upstream trace", () => {
    const upstream = taskTrace("86840", "grp_id=01");
    const writes = taskTrace("86840", "grp_id=01");
    writes.nodes = [
      writes.nodes[0]!,
      { id: "write-context:86840", kind: "PHYSICAL_DATASET", physicalNodeId: datasetId, table: "pdata_n.t98_otc_deri_comp_sale_info" },
    ];
    writes.edges = [{ id: "direct-write:86840", from: "task:86840", to: "write-context:86840", kind: "WRITES_TABLE" }];

    const result = mergeTableTraceContext(upstream, writes);

    expect(result.nodes.map((node) => node.id)).toContain("write-context:86840");
    expect(result.edges.map((edge) => edge.id)).toEqual([
      "edge:86840:write",
      "edge:86840:dataset",
      "direct-write:86840",
    ]);
  });

  it("deduplicates a shared physical table by stable ID and retains both task writes", async () => {
    const roots = [root("86840"), root("86841")];
    const result = await collectMultiTableTrace({
      roots,
      isCurrent: () => true,
      fetchTrace: async (item) =>
        taskTrace(item.anchor.taskId!, item.anchor.taskId === "86840" ? "grp_id=01" : "grp_id=02"),
    });

    expect(result.nodes.filter((node) => node.id === datasetId)).toHaveLength(1);
    expect(result.nodes.filter((node) => node.kind === "TASK").map((node) => node.taskId)).toEqual(["86840", "86841"]);
    expect(result.nodes.filter((node) => node.kind === "TARGET_WRITE")).toHaveLength(2);
    expect(result.edges.map((edge) => edge.id)).toEqual([
      "edge:86840:write",
      "edge:86840:dataset",
      "edge:86841:write",
      "edge:86841:dataset",
    ]);
    expect(result.multiRootSummary).toMatchObject({ requested: 2, completed: 2, failed: [] });
  });

  it("does not merge same-name tables with different stable IDs", async () => {
    const roots = [root("1"), root("2")];
    const result = await collectMultiTableTrace({
      roots,
      isCurrent: () => true,
      fetchTrace: async (item) => {
        const value = taskTrace(item.anchor.taskId!, "grp_id=01");
        const distinctId = `dataset:source-${item.anchor.taskId}`;
        return {
          ...value,
          nodes: value.nodes.map((node) =>
            node.id === datasetId ? { ...node, id: distinctId, table: "same.name" } : node,
          ),
          edges: value.edges.map((edge) =>
            edge.to === datasetId ? { ...edge, to: distinctId } : edge,
          ),
        };
      },
    });

    expect(result.nodes.filter((node) => node.table === "same.name")).toHaveLength(2);
  });

  it("fails closed when successful roots span graph versions", async () => {
    await expect(collectMultiTableTrace({
      roots: [root("1"), root("2")],
      isCurrent: () => true,
      fetchTrace: async (item) => taskTrace(item.anchor.taskId!, "grp_id=01", item.id === "task:1" ? "v1" : "v2"),
    })).rejects.toThrow("图谱版本");
  });

  it("returns successful roots but marks a partial failure as incomplete", async () => {
    const fetchTrace = vi.fn(async (item: ReturnType<typeof root>) => {
      if (item.id === "task:86841") throw new Error("服务暂时不可用");
      return taskTrace(item.anchor.taskId!, "grp_id=01");
    });
    const result = await collectMultiTableTrace({
      roots: [root("86840"), root("86841")],
      isCurrent: () => true,
      fetchTrace,
    });

    expect(result.truncated).toBe(true);
    expect(result.multiRootSummary).toEqual({
      requested: 2,
      completed: 1,
      failed: [{ rootId: "task:86841", label: "调度 86841", message: "服务暂时不可用" }],
      truncatedRootIds: [],
    });
    expect(result.scopeWarnings).toContain("多起点查询仅完成 1/2 个起点；当前画布不是完整结果。");
  });

  it("keeps the combined edge limit and reports roots not queried", async () => {
    const result = await collectMultiTableTrace({
      roots: [root("1"), root("2")],
      edgeLimit: 2,
      isCurrent: () => true,
      fetchTrace: async (item) => taskTrace(item.anchor.taskId!, "grp_id=01"),
    });

    expect(result.edges).toHaveLength(2);
    expect(result.unqueriedRootNodeIds).toEqual(["task:2"]);
    expect(result.truncated).toBe(true);
    expect(result.stoppedBy).toBe("EDGE_LIMIT");
  });

  it("stops after cancellation instead of publishing stale partial data", async () => {
    let current = true;
    await expect(collectMultiTableTrace({
      roots: [root("1"), root("2")],
      isCurrent: () => current,
      fetchTrace: async (item) => {
        current = false;
        return taskTrace(item.anchor.taskId!, "grp_id=01");
      },
    })).rejects.toThrow("取消");
  });
});
