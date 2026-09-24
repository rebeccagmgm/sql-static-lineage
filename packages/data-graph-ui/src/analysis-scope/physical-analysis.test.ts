import { expect, it, vi } from "vitest";
import { taskTableId } from "../../../data-graph/src/asset-graph/task-table-context";
import { loadPhysicalTableAnalysis } from "./physical-analysis";
import { projectTableDisplay } from "./table-display";
import type { GraphNode, TraceResult } from "../types";

const identity = { platform: "test", dataSource: "source", qualifiedName: "pdata_n.t98_otc_deri_comp_sale_info" };
const table: GraphNode = { id: "dataset:sale", kind: "PHYSICAL_DATASET", table: identity.qualifiedName, detail: identity };
const ids = ["86840", "86841", "86842", "220650"];
const tasks = ids.map(taskId => ({ id: `task:${taskId}`, kind: "TASK", taskId }));
const context = { taskNodeId: tasks[0]!.id, datasetId: table.id, role: "WRITE" as const };
const selected = { ...table, id: taskTableId(context), physicalNodeId: table.id, detail: { taskTableContext: context } };
const fields = ids.map(taskId => ({ id: `field:${taskId}`, kind: "COLUMN", table: table.table, taskId, column: "amount", physicalNodeId: table.id, detail: identity }));
const trace: TraceResult = {
  version: "v1", layer: "table", direction: "up", depthLimit: 1, edgeLimit: 400,
  truncated: false, stoppedBy: null, frontierNodeIds: [], terminalNodes: [], elapsedMs: 0,
  nodes: [table, ...tasks], taskClusters: Object.fromEntries(ids.map((id, index) => [id, index < 3 ? "A" : "B"])),
  edges: tasks.map(task => ({ id: task.id, from: task.id, to: table.id, kind: "WRITES_TABLE" })),
};
function client() {
  return {
    status: vi.fn(async () => ({ version: "v1" })),
    search: vi.fn(async () => [table]),
    trace: vi.fn(async () => trace),
    fields: vi.fn(async () => fields),
  };
}

it("replaces one writer's scope with both directions of the physical root and all its writer fields", async () => {
  const api = client();
  const result = await loadPhysicalTableAnalysis(selected, [], () => true, api);
  expect(result.scope.members.map(m => m.node.id)).toEqual([table.id]);
  expect(api.trace.mock.calls).toEqual([
    [expect.objectContaining({ nodeId: table.id, direction: "up", depth: 1 })],
    [expect.objectContaining({ nodeId: table.id, direction: "down", depth: 1 })],
  ]);
  expect(result.fields.map(f => f.taskId)).toEqual(ids);
  expect(projectTableDisplay(result.scope.trace).nodes.filter(n => n.kind === "PHYSICAL_DATASET")).toHaveLength(1);
  expect(selected.id).toBe(taskTableId(context));
});

it("retains explicit cluster filtering for relationships and selectable fields", async () => {
  const api = client();
  const result = await loadPhysicalTableAnalysis(selected, ["A"], () => true, api);
  expect(result.scope.clusters).toEqual(["A"]);
  expect(result.scope.trace.nodes.filter(n => n.kind === "TASK").map(n => n.taskId)).toEqual(ids.slice(0, 3));
  expect(result.fields.map(f => f.taskId)).toEqual(ids.slice(0, 3));
});

it("does not return a partial new scope when fields fail or the publication changes", async () => {
  const api = client();
  api.fields.mockRejectedValueOnce(new Error("field query failed"));
  await expect(loadPhysicalTableAnalysis(selected, [], () => true, api)).rejects.toThrow("field query failed");
  api.fields.mockImplementationOnce(async () => {
    api.status.mockResolvedValue({ version: "v2" });
    return fields;
  });
  await expect(loadPhysicalTableAnalysis(selected, [], () => true, api)).rejects.toThrow("换版");
});

it("stops cancelled queries and preserves truncation warnings", async () => {
  const api = client();
  await expect(loadPhysicalTableAnalysis(selected, [], () => false, api)).rejects.toThrow("CANCELLED");
  expect(api.trace).not.toHaveBeenCalled();
  api.trace.mockResolvedValue({ ...trace, truncated: true, stoppedBy: "EDGE_LIMIT" });
  const result = await loadPhysicalTableAnalysis(selected, [], () => true, api);
  expect(result.scope.trace.truncated).toBe(true);
  expect(result.scope.warnings.length).toBeGreaterThan(0);
});
