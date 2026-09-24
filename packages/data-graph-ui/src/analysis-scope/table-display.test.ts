import { describe, expect, it } from "vitest";
import { adaptTrace } from "../graph-adapter";
import type { GraphNode, TraceResult } from "../types";
import { layoutTableTrace } from "./layout";
import { projectTableDisplay, scopeExpansionNodes } from "./table-display";

function fixture(): TraceResult {
  const physical = (id: string, role: string, task: string): GraphNode => ({
    id,
    physicalNodeId: "dataset:shared",
    kind: "PHYSICAL_DATASET",
    table: "model.shared",
    detail: {
      identityStatus: "CONFIRMED",
      taskTableContext: {
        role,
        taskNodeId: `task:${task}`,
        datasetId: "dataset:shared",
      },
    },
    metadata: {
      table: {
        status: "AVAILABLE",
        description: '<font color="red">共享</font>模型',
      },
    },
  });
  return {
    version: "v1",
    layer: "table",
    direction: "down",
    depthLimit: 1,
    edgeLimit: 80,
    truncated: false,
    stoppedBy: null,
    terminalNodes: [],
    frontierNodeIds: ["r2"],
    elapsedMs: 0,
    nodes: [
      { id: "task:1", taskId: "1", kind: "TASK" },
      { id: "task:2", taskId: "2", kind: "TASK" },
      { id: "task:3", taskId: "3", kind: "TASK" },
      physical("w1", "WRITE", "1"),
      physical("r2", "READ", "2"),
      physical("r3", "READ", "3"),
    ],
    edges: [
      {
        id: "w",
        from: "task:1",
        to: "w1",
        kind: "WRITES_TABLE",
        status: "OBSERVED",
      },
      {
        id: "r2",
        from: "r2",
        to: "task:2",
        kind: "READS_TABLE",
        status: "OBSERVED",
      },
      {
        id: "r3",
        from: "r3",
        to: "task:3",
        kind: "READS_TABLE",
        status: "CANDIDATE",
      },
      {
        id: "schedule",
        from: "task:1",
        to: "task:2",
        kind: "SCHEDULE_DEPENDS_ON",
      },
    ],
  };
}
describe("existing analysis canvas physical table display", () => {
  it("shows one shared table on the existing canvas without changing raw evidence", () => {
    const raw = fixture(),
      before = JSON.stringify(raw);
    const projected = projectTableDisplay(raw);
    expect(projected.nodes).toHaveLength(4);
    expect(projected.edges).toHaveLength(3);
    expect(projected.edges[0].to).toBe(projected.edges[1].from);
    expect(projected.edges[2].status).toBe("CANDIDATE");
    expect(
      projected.nodes.find((n) => n.id === "dataset:shared")?.metadata?.table
        .description,
    ).toBe("共享模型");
    expect(projected.frontierNodeIds).toEqual(["dataset:shared"]);
    const graph = adaptTrace(layoutTableTrace(projected));
    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges).toHaveLength(3);
    expect(JSON.stringify(raw)).toBe(before);
  });
  it("keeps equal names from different physical sources and unknown identities separate", () => {
    const raw = fixture();
    raw.nodes[4] = { ...raw.nodes[4], physicalNodeId: "dataset:other" };
    raw.nodes[5] = {
      ...raw.nodes[5],
      detail: { ...raw.nodes[5].detail, identityStatus: "UNKNOWN" },
    };
    expect(projectTableDisplay(raw).nodes).toHaveLength(6);
  });
  it("expands the merged card through its readers upstream and writer downstream", () => {
    const raw = fixture();
    expect(
      scopeExpansionNodes(raw, "dataset:shared", "up").map((n) => n.id),
    ).toEqual(["r2", "r3"]);
    expect(
      scopeExpansionNodes(raw, "dataset:shared", "down").map((n) => n.id),
    ).toEqual(["w1"]);
    expect(scopeExpansionNodes(raw, "r2", "down").map((n) => n.id)).toEqual([
      "r2",
    ]);
    expect(scopeExpansionNodes(raw, "task:1", "up").map((n) => n.id)).toEqual([
      "task:1",
    ]);
  });
  it("does not merge field/write occurrence identities", () => {
    const raw = { ...fixture(), layer: "field" as const };
    expect(projectTableDisplay(raw)).toBe(raw);
  });
  it("retains every write and read record when parallel relations share a line", () => {
    const raw = fixture();
    raw.edges[0] = {
      ...raw.edges[0],
      detail: {
        writeObservationId: "write:3",
        partition: [{ column: "src", values: ["A"] }],
      },
    };
    raw.edges[1] = { ...raw.edges[1], detail: { readOccurrenceId: "read:1" } };
    raw.edges.push(
      {
        ...raw.edges[0],
        id: "w6",
        detail: { writeObservationId: "write:6", partitionStatus: "UNKNOWN" },
      },
      {
        ...raw.edges[1],
        id: "r2-again",
        detail: { readOccurrenceId: "read:2" },
      },
      {
        ...raw.edges[0],
        id: "candidate-write",
        status: "CANDIDATE",
        detail: { writeObservationId: "write:candidate" },
      },
    );
    const before = JSON.stringify(raw);
    const projected = projectTableDisplay(raw);
    const writes = projected.edges.find(
      (e) => e.kind === "WRITES_TABLE" && e.status === "OBSERVED",
    )!;
    expect(writes.tableRelations).toEqual([raw.edges[0], raw.edges[4]]);
    expect(writes.detail?.writeObservationId).toBeUndefined();
    expect(projected.edges.find((e) => e.id === "r2")?.tableRelations).toEqual([
      raw.edges[1],
      raw.edges[5],
    ]);
    expect(
      projected.edges.find((e) => e.id === "candidate-write")?.status,
    ).toBe("CANDIDATE");
    const card = projected.nodes.find((n) => n.id === "dataset:shared")!;
    expect(card.tableContexts?.map((n) => n.id)).toEqual(["w1", "r2", "r3"]);
    expect(card.detail?.taskTableContext).toBeUndefined();
    expect(JSON.stringify(raw)).toBe(before);
    expect(
      adaptTrace(layoutTableTrace(projected)).edges.find(
        (e) => e.id === writes.id,
      )?.label,
    ).toContain("2");
  });
  it("prefers task contexts over a mixed physical-table anchor in both directions", () => {
    const raw = fixture();
    const physical: GraphNode = {
      id: "dataset:shared",
      kind: "PHYSICAL_DATASET",
      table: "model.shared",
    };
    raw.nodes.unshift(physical);
    expect(
      scopeExpansionNodes(raw, physical.id, "up").map((n) => n.id),
    ).toEqual(["r2", "r3"]);
    expect(
      scopeExpansionNodes(raw, physical.id, "down").map((n) => n.id),
    ).toEqual(["w1"]);
    const writersOnly = {
      ...raw,
      nodes: raw.nodes.filter((n) => !["r2", "r3"].includes(n.id)),
    };
    expect(
      scopeExpansionNodes(writersOnly, physical.id, "up").map((n) => n.id),
    ).toEqual(["w1"]);
    expect(scopeExpansionNodes(raw, "r2", "down").map((n) => n.id)).toEqual([
      "r2",
    ]);
    expect(
      scopeExpansionNodes({ ...raw, nodes: [physical] }, physical.id, "down"),
    ).toEqual([physical]);
  });
});
