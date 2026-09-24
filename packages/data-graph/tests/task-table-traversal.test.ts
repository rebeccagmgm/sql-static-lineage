import { describe, expect, it } from "vitest";
import {
  traverseTaskTables,
  type TableTraversalReader,
  type TableNode,
  type TableEdge,
} from "../src/asset-graph/task-table-traversal.ts";
import {
  taskTableId,
  parseTaskTableId,
} from "../src/asset-graph/task-table-context.ts";

function fixture() {
  const nodes = new Map<string, TableNode>();
  for (const task of ["A", "B", "C", "D", "X", "Y"])
    nodes.set(`task:${task}`, {
      id: `task:${task}`,
      kind: "TASK",
      taskId: task,
      detail: {},
    });
  for (const table of ["T", "U"])
    nodes.set(`dataset:${table}`, {
      id: `dataset:${table}`,
      kind: "PHYSICAL_DATASET",
      table,
      detail: {},
    });
  const edges: TableEdge[] = [];
  const add = (from: string, to: string, kind: string) =>
    edges.push({
      id: `${from}-${to}`,
      from,
      to,
      kind,
      status: "OBSERVED",
      detail: {},
    });
  for (const [a, b] of [
    ["A", "B"],
    ["A", "C"],
    ["B", "D"],
    ["C", "Y"],
  ])
    add(`task:${a}`, `task:${b}`, "SCHEDULE");
  add("task:A", "dataset:T", "WRITES_TABLE");
  add("task:C", "dataset:T", "WRITES_TABLE");
  for (const t of ["B", "X", "Y"]) add("dataset:T", `task:${t}`, "READS_TABLE");
  add("task:B", "dataset:U", "WRITES_TABLE");
  for (const t of ["D", "X", "Y"]) add("dataset:U", `task:${t}`, "READS_TABLE");
  const reader: TableTraversalReader = {
    node: async (id) => nodes.get(id),
    adjacent: async (id, direction, layer, limit, allowed) =>
      edges
        .filter((e) => (layer === "schedule") === (e.kind === "SCHEDULE"))
        .filter((e) => (direction === "down" ? e.from : e.to) === id)
        .map((edge) => ({
          edge,
          node: nodes.get(direction === "down" ? edge.to : edge.from)!,
        }))
        .filter((r) => allowed === undefined || allowed.includes(r.node.id))
        .slice(0, limit),
  };
  return { reader, edges, nodes };
}
const query = {
  nodeId: "task:A",
  direction: "down" as const,
  depth: 6,
  depthUnit: "edge" as const,
  limit: 100,
  includeCandidates: true,
};
const taskIds = (r: Awaited<ReturnType<typeof traverseTaskTables>>) =>
  r.nodes.filter((n) => n.kind === "TASK").map((n) => n.id);

describe("task-scoped table traversal", () => {
  it("filters each hop, not a whole-closure whitelist; schedule alone never draws a table edge", async () => {
    const { reader } = fixture();
    const result = await traverseTaskTables(reader, query);
    expect(taskIds(result)).toEqual(["task:A", "task:B", "task:D"]);
    expect(result.edges.some((e) => e.kind === "SCHEDULE")).toBe(false);
    expect(result.scheduleReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskId: "A", neighborTaskIds: ["B", "C"] }),
      ]),
    );
  });
  it("keeps the originating task when a saved table card is expanded again", async () => {
    const { reader } = fixture();
    const first = await traverseTaskTables(reader, { ...query, depth: 1 });
    const card = first.nodes.find((n) => n.kind === "PHYSICAL_DATASET")!;
    const saved = JSON.parse(JSON.stringify({ nodeId: card.id }));
    const next = await traverseTaskTables(reader, {
      ...query,
      ...saved,
      depth: 2,
    });
    expect(taskIds(next)).toEqual(["task:B"]);
    expect(next.nodes[0]?.id).toBe(card.id);
    expect(parseTaskTableId(card.id)?.taskNodeId).toBe("task:A");
    const reverse = await traverseTaskTables(reader, {
      ...query,
      ...saved,
      direction: "up",
      depth: 1,
    });
    expect(taskIds(reverse)).toEqual(["task:A"]);
  });
  it("uses different table instances for the same physical table on separate task paths", async () => {
    const { reader } = fixture();
    const a = await traverseTaskTables(reader, { ...query, depth: 2 });
    const c = await traverseTaskTables(reader, {
      ...query,
      nodeId: "task:C",
      depth: 2,
    });
    const ac = a.nodes.find((n) => n.kind === "PHYSICAL_DATASET")!;
    const cc = c.nodes.find((n) => n.kind === "PHYSICAL_DATASET")!;
    expect(ac.id).not.toBe(cc.id);
    expect(ac.physicalNodeId).toBe(cc.physicalNodeId);
    expect(taskIds(c)).toEqual(["task:C", "task:Y"]);
  });
  it("restricts upstream writers to the current consumer's direct dependencies", async () => {
    const { reader } = fixture();
    const result = await traverseTaskTables(reader, {
      ...query,
      nodeId: "task:B",
      direction: "up",
      depth: 2,
    });
    expect(taskIds(result)).toEqual(["task:B", "task:A"]);
  });
  it("stops at a table when schedule evidence is absent and respects limits and cycles", async () => {
    const { reader, edges } = fixture();
    edges.push({
      id: "loop",
      from: "task:D",
      to: "task:A",
      kind: "SCHEDULE",
      detail: {},
    });
    edges.push({
      id: "loop-write",
      from: "task:D",
      to: "dataset:T",
      kind: "WRITES_TABLE",
      detail: {},
    });
    edges.push({
      id: "loop-read",
      from: "dataset:T",
      to: "task:A",
      kind: "READS_TABLE",
      detail: {},
    });
    const result = await traverseTaskTables(reader, { ...query, depth: 12 });
    expect(result.nodes.length).toBeLessThan(12);
    const limited = await traverseTaskTables(reader, { ...query, limit: 1 });
    expect(limited.edges).toHaveLength(1);
    expect(limited.truncated).toBe(true);
    edges.splice(
      0,
      edges.length,
      ...edges.filter((e) => e.kind !== "SCHEDULE"),
    );
    expect(taskIds(await traverseTaskTables(reader, query))).toEqual([
      "task:A",
    ]);
  });
  it("rejects malformed context instead of falling back to a public table", () => {
    expect(() => parseTaskTableId("task-table:broken")).toThrow(
      "TASK_TABLE_CONTEXT_INVALID",
    );
    const id = taskTableId({
      taskNodeId: "task:A",
      datasetId: "dataset:T",
      role: "WRITE",
    });
    expect(parseTaskTableId(id)).toEqual({
      taskNodeId: "task:A",
      datasetId: "dataset:T",
      role: "WRITE",
    });
  });
});
