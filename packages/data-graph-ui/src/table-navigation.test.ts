import { expect, it, vi } from "vitest";
import type { api } from "./api";
import { taskTableId } from "../../data-graph/src/asset-graph/task-table-context";
import { projectTableDisplay } from "./analysis-scope/table-display";
import { expandTableCard, physicalTableAnchor, tableCardAnchor, traceTableAnchor } from "./table-navigation";
import type { GraphNode, TraceResult } from "./types";

const physical = "dataset:shared";
const context = (task: string, role: "READ" | "WRITE" = "WRITE"): GraphNode => {
  const detail = { taskNodeId: `task:${task}`, datasetId: physical, role };
  return { id: taskTableId(detail), kind: "PHYSICAL_DATASET", physicalNodeId: physical,
    table: "model.shared", detail: { identityStatus: "CONFIRMED", taskTableContext: detail } };
};
const left = context("86840"), right = context("86841"), reader = context("reader", "READ");
const base: TraceResult = {
  version: "v1", layer: "table", direction: "down", depthLimit: 1,
  edgeLimit: 400, truncated: false, stoppedBy: null, frontierNodeIds: [], terminalNodes: [], elapsedMs: 0,
  nodes: [left, right, reader, { id: physical, kind: "PHYSICAL_DATASET" }], edges: [],
};
function response(root: GraphNode, consumer: string): TraceResult {
  return { ...base, nodes: [root, { id: `task:${consumer}`, kind: "TASK", taskId: consumer }],
    edges: [{ id: consumer, from: root.id, to: `task:${consumer}`, kind: "READS_TABLE" }] };
}
const card = () => projectTableDisplay(base).nodes.find(n => n.id === physical)!;

it("explicit table analysis leaves both a task instance and a merged card for the physical root", async () => {
  const fetchTrace = vi.fn(async (_query: Parameters<typeof api.trace>[0]) => base);
  for (const node of [left, card()]) {
    const anchor = physicalTableAnchor(node);
    expect(anchor.nodeId).toBe(physical);
    expect(anchor.tableContextIds).toBeUndefined();
    await traceTableAnchor({ ...anchor, layer: "table", direction: "up", depth: 1, includeCandidates: true }, fetchTrace, () => true);
  }
  expect(fetchTrace.mock.calls.map(([q]) => q.nodeId)).toEqual([physical, physical]);
});

it("never substitutes a same-name table or an unconfirmed physical identity", () => {
  expect(physicalTableAnchor({ id: "dataset:other", kind: "PHYSICAL_DATASET", table: left.table }).nodeId).toBe("dataset:other");
  for (const node of [
    { ...left, detail: { ...left.detail, identityStatus: "UNKNOWN" } },
    { ...left, physicalNodeId: "dataset:conflicting" },
    { id: "unknown:table", kind: "PHYSICAL_DATASET", table: left.table },
  ]) expect(() => physicalTableAnchor(node)).toThrow("物理身份");
});

it("expands every applicable context of a merged card without a global table query", async () => {
  const before = JSON.stringify(base);
  const fetchTrace = vi.fn(async (query) => response(query.nodeId === left.id ? left : right, query.nodeId === left.id ? "A" : "B"));
  const result = await expandTableCard({ base, nodeId: physical, direction: "down", clusters: [], includeCandidates: true, fetchTrace, isCurrent: () => true });
  expect(fetchTrace.mock.calls.map(([q]) => q.nodeId)).toEqual([left.id, right.id]);
  expect(result.trace.edges.map(e => [e.from, e.to])).toEqual([[left.id, "task:A"], [right.id, "task:B"]]);
  expect(JSON.stringify(base)).toBe(before);
  expect(projectTableDisplay(result.trace).nodes.filter(n => n.kind === "PHYSICAL_DATASET")).toHaveLength(1);
});

it("keeps contexts through re-anchoring, direction changes, and a saved JSON round trip", async () => {
  const anchor = JSON.parse(JSON.stringify(tableCardAnchor(card())));
  expect(anchor.tableContextIds).toEqual([left.id, right.id, reader.id]);
  const fetchTrace = vi.fn(async q => response(q.nodeId === left.id ? left : q.nodeId === right.id ? right : reader, "next"));
  await traceTableAnchor({ ...anchor, layer: "table", direction: "down", depth: 2, includeCandidates: true }, fetchTrace, () => true);
  expect(fetchTrace.mock.calls.map(([q]) => q.nodeId)).toEqual([left.id, right.id]);
  fetchTrace.mockClear();
  await traceTableAnchor({ ...anchor, layer: "table", direction: "up", depth: 2, includeCandidates: true }, fetchTrace, () => true);
  expect(fetchTrace.mock.calls.map(([q]) => q.nodeId)).toEqual([reader.id]);
});

it("preserves explicit legacy context anchors and standalone physical anchors", async () => {
  const fetchTrace = vi.fn(async (_query: Parameters<typeof api.trace>[0]) => base);
  for (const nodeId of [left.id, physical]) {
    await traceTableAnchor({ nodeId, label: "table", layer: "table", direction: "down", depth: 1, includeCandidates: false }, fetchTrace, () => true);
  }
  expect(fetchTrace.mock.calls.map(([q]) => q.nodeId)).toEqual([left.id, physical]);
  expect(tableCardAnchor({ ...left, tableContexts: [left] }).tableContextIds).toBeUndefined();
});

it("uses the explicitly selected partition scope instead of duplicating it per task context", async () => {
  const partitionSelection = { fixture: true } as unknown as TraceResult["partitionSelection"];
  const query = { ...tableCardAnchor(card()), layer: "table" as const, direction: "up" as const, depth: 1, includeCandidates: true, partitionSelection };
  const fetchTrace = vi.fn(async (_query: Parameters<typeof api.trace>[0]) => base);
  await traceTableAnchor(query, fetchTrace, () => true);
  expect(fetchTrace).toHaveBeenCalledExactlyOnceWith(query);
});

it("rejects a combined edge overflow without returning a partial merged query", async () => {
  const fetchTrace = vi.fn(async (query: Parameters<typeof api.trace>[0]) => {
    const root = query.nodeId === left.id ? left : right;
    return { ...response(root, "A"), edges: Array.from({ length: 201 }, (_, i) => ({ id: `${root.id}:${i}`, from: root.id, to: "task:A", kind: "READS_TABLE" })) };
  });
  await expect(traceTableAnchor({ ...tableCardAnchor(card()), layer: "table", direction: "down", depth: 1, includeCandidates: true }, fetchTrace, () => true)).rejects.toThrow("400");
});

it("fails atomically on a failed, stale, or changed-version context", async () => {
  const before = JSON.stringify(base);
  const input = { base, nodeId: physical, direction: "down" as const, clusters: [], includeCandidates: true, isCurrent: () => true };
  await expect(expandTableCard({ ...input, fetchTrace: vi.fn().mockResolvedValueOnce(response(left, "A")).mockRejectedValueOnce(new Error("unavailable")) })).rejects.toThrow("unavailable");
  await expect(expandTableCard({ ...input, fetchTrace: vi.fn().mockResolvedValueOnce(response(left, "A")).mockResolvedValueOnce({ ...response(right, "B"), version: "v2" }) })).rejects.toThrow("版本");
  const fetchTrace = vi.fn(async () => response(left, "A"));
  await expect(expandTableCard({ ...input, fetchTrace, isCurrent: () => false })).rejects.toThrow("取消");
  expect(fetchTrace).not.toHaveBeenCalled();
  expect(JSON.stringify(base)).toBe(before);
});

it("retains partition query arguments, cluster filters and truncation warnings", async () => {
  const scoped = { ...base, partitionSelection: { fixture: true } as unknown as TraceResult["partitionSelection"] };
  const fetchTrace = vi.fn(async q => ({ ...response(q.nodeId === left.id ? left : right, "A"), truncated: true, stoppedBy: "EDGE_LIMIT" as const }));
  const result = await expandTableCard({ base: scoped, nodeId: physical, direction: "down", clusters: ["cluster"], includeCandidates: false, fetchTrace, isCurrent: () => true });
  expect(fetchTrace.mock.calls[0]![0]).toMatchObject({ nodeId: left.id, scopeFocus: left.id, scopeDepth: base.depthLimit, scopeDirection: base.direction, clusters: ["cluster"], partitionSelection: scoped.partitionSelection });
  expect(result.trace.truncated).toBe(true);
});

it("rejects malformed or foreign saved contexts without falling back to global IO", async () => {
  const fetchTrace = vi.fn(async () => base);
  for (const ids of [[], ["dataset:other"], [taskTableId({ taskNodeId: "task:1", datasetId: "dataset:other", role: "WRITE" })]]) {
    await expect(traceTableAnchor({ nodeId: physical, tableContextIds: ids, label: "table", layer: "table", direction: "down", depth: 1, includeCandidates: false }, fetchTrace, () => true)).rejects.toThrow("上下文");
  }
  expect(fetchTrace).not.toHaveBeenCalled();
});
