import { describe, expect, it, vi } from "vitest";
import { loadScope, expandScope, collapseScope } from "./client";
import { projectScope, type ScopeRef } from "./model";
import type { GraphNode, TraceResult } from "../types";

const task: GraphNode = { id: "task:7", kind: "TASK", taskId: "7" };
const a: GraphNode = {
  id: "dataset:a",
  kind: "PHYSICAL_DATASET",
  table: "ods.a",
};
const b: GraphNode = {
  id: "dataset:b",
  kind: "PHYSICAL_DATASET",
  table: "model.b",
};
const extra: GraphNode = {
  id: "dataset:other",
  kind: "PHYSICAL_DATASET",
  table: "shared.codes",
};
const refs: ScopeRef[] = [
  { kind: "TASK", value: "7", enabled: true },
  { kind: "PHYSICAL_DATASET", value: "ods.a", enabled: true },
  { kind: "PHYSICAL_DATASET", value: "model.b", enabled: true },
];
function client() {
  return {
    status: vi.fn(async () => ({ version: "v1" })),
    search: vi.fn(
      async (q: string, _offset = 0, _limit = 101, _clusters: string[] = []) =>
        [task, a, b].filter((n) => n.taskId === q || n.table === q),
    ),
    trace: vi.fn(
      async (input: { direction: string }): Promise<TraceResult> => ({
        version: "v1",
        layer: "table",
        direction: input.direction as "up" | "down",
        depthLimit: 1,
        edgeLimit: 400,
        truncated: false,
        stoppedBy: "DEPTH_LIMIT",
        frontierNodeIds: [],
        terminalNodes: [],
        elapsedMs: 1,
        taskClusters: { "7": "A" },
        nodes: input.direction === "up" ? [task, a, extra] : [task, b],
        edges:
          input.direction === "up"
            ? [
                { id: "a", from: a.id, to: task.id, kind: "READS_TABLE" },
                {
                  id: "extra",
                  from: extra.id,
                  to: task.id,
                  kind: "READS_TABLE",
                },
              ]
            : [{ id: "b", from: task.id, to: b.id, kind: "WRITES_TABLE" }],
      }),
    ),
  };
}
describe("bounded scope loading", () => {
  it("reads a known task directly and reuses its input and cluster metadata", async () => {
    const api = client();
    const loaded = await loadScope(
      [refs[0]!],
      () => true,
      api,
      () => {},
      ["A"],
    );
    expect(api.search).not.toHaveBeenCalled();
    expect(api.trace).toHaveBeenCalledTimes(2);
    expect(loaded.trace.nodes.map((n) => n.id)).toEqual(
      expect.arrayContaining([task.id, a.id, b.id, extra.id]),
    );
  });
  it("filters mixed seeds by cluster without losing their saved selection", async () => {
    const api = client();
    api.search.mockImplementation(async (q, _offset, _limit, clusters = []) =>
      [task, a, b].filter(
        (n) =>
          (n.taskId === q || n.table === q) &&
          (!clusters.length || n.id !== task.id),
      ),
    );
    const loaded = await loadScope(
      refs,
      () => true,
      api,
      () => {},
      ["B"],
    );
    expect(loaded.members.every((m) => m.enabled)).toBe(true);
    expect(loaded.excludedIds).toEqual([task.id]);
    expect(loaded.clusters).toEqual(["B"]);
    expect(api.trace).toHaveBeenCalledTimes(5);
    expect(
      api.trace.mock.calls.every(([input]) => !("clusters" in input)),
    ).toBe(true);
  });
  it("returns an explicit empty view when the cluster excludes every seed", async () => {
    const api = client();
    api.search.mockImplementation(async (q, _offset, _limit, clusters = []) =>
      clusters.length
        ? []
        : [task, a, b].filter((n) => n.taskId === q || n.table === q),
    );
    const loaded = await loadScope(
      refs,
      () => true,
      api,
      () => {},
      ["B"],
    );
    expect(loaded.trace.nodes).toEqual([]);
    expect(loaded.warnings.join(" ")).toContain("未命中");
    expect(api.trace).toHaveBeenCalledTimes(1);
    expect(loaded.members).toHaveLength(3);
  });
  it("continues to enforce the cluster when a shared table expands to a foreign writer", async () => {
    const api = client();
    const loaded = await loadScope(
      [refs[0]!],
      () => true,
      api,
      () => {},
      ["A"],
    );
    const original = await api.trace({ direction: "up" });
    api.trace.mockResolvedValue({
      ...original,
      taskClusters: { "8": "B" },
      nodes: [a, { id: "task:8", kind: "TASK", taskId: "8" }],
      edges: [
        {
          id: "foreign-writer",
          from: "task:8",
          to: a.id,
          kind: "WRITES_TABLE",
        },
      ],
    });
    const expanded = await expandScope(loaded, a.id, "up", () => true, api);
    expect(expanded.trace.nodes).toEqual(loaded.trace.nodes);
    expect(expanded.trace.edges).toEqual(loaded.trace.edges);
    expect(expanded.warnings.join(" ")).toContain("集群边界");
    expect(collapseScope(expanded).warnings).toEqual(loaded.warnings);
  });
  it("times out a stuck lookup instead of leaving the workspace busy forever", async () => {
    vi.useFakeTimers();
    try {
      const api = client();
      api.search.mockImplementation(() => new Promise(() => {}));
      const result = expect(
        loadScope([refs[1]!], () => true, api),
      ).rejects.toThrow("30 秒");
      await vi.advanceTimersByTimeAsync(30001);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });
  it("does not accept a late result after cancellation", async () => {
    const api = client();
    let active = true;
    api.search.mockImplementation(async () => {
      active = false;
      return [a];
    });
    await expect(loadScope([refs[1]!], () => active, api)).rejects.toThrow(
      "SCOPE_QUERY_CANCELLED",
    );
    expect(api.trace).not.toHaveBeenCalled();
  });
  it("limits concurrent lookups and publishes progress", async () => {
    const api = client();
    let active = 0,
      peak = 0;
    api.search.mockImplementation(async (q) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return [{ id: "dataset:" + q, table: q, kind: "PHYSICAL_DATASET" }];
    });
    const progress = vi.fn();
    await loadScope(
      Array.from({ length: 9 }, (_, i) => ({
        kind: "PHYSICAL_DATASET",
        value: "ods.t" + (i + 1),
        enabled: true,
      })),
      () => true,
      api,
      progress,
    );
    expect(peak).toBe(4);
    expect(
      progress.mock.calls.some(([message]) =>
        message.includes("读取关系 18/18"),
      ),
    ).toBe(true);
  });
  it("queries every mixed table/task seed in both directions and retains discovered nodes", async () => {
    const api = client();
    const loaded = await loadScope(refs, () => true, api);
    expect(api.trace).toHaveBeenCalledTimes(6);
    expect(
      api.trace.mock.calls.some(([i]) => "taskId" in i && i.taskId === "7"),
    ).toBe(true);
    expect(
      api.trace.mock.calls.some(([i]) => "nodeId" in i && i.nodeId === a.id),
    ).toBe(true);
    expect(loaded.trace.nodes).toHaveLength(4);
    expect(projectScope(loaded.trace, loaded.members).trace.nodes).toHaveLength(
      3,
    );
    expect(
      projectScope(loaded.trace, loaded.members).boundary.map((n) => n.id),
    ).toEqual([extra.id]);
  });
  it("fails closed on ambiguous physical names", async () => {
    const api = client();
    api.search.mockImplementation(async (q) =>
      q === "ods.a"
        ? [a, { ...a, id: "dataset:another" }]
        : [task, b].filter((n) => n.taskId === q || n.table === q),
    );
    await expect(loadScope(refs, () => true, api)).rejects.toThrow(
      "多个物理来源",
    );
    expect(
      api.trace.mock.calls.every(([input]) => input.direction === "up"),
    ).toBe(true);
  });
  it("restores the exact saved identity and rejects a disappeared identity", async () => {
    await expect(
      loadScope(
        refs.map((r) =>
          r.value === "ods.a" ? { ...r, id: "dataset:missing" } : r,
        ),
        () => true,
        client(),
      ),
    ).rejects.toThrow("保存的对象");
  });
  it("rejects a graph change after queries rather than mixing versions", async () => {
    const api = client();
    api.status
      .mockResolvedValueOnce({ version: "v1" })
      .mockResolvedValueOnce({ version: "v2" });
    await expect(loadScope(refs, () => true, api)).rejects.toThrow("换版");
  });
  it("does not query deselected task neighbors", async () => {
    const api = client();
    await loadScope(
      refs.map((r) => (r.kind === "TASK" ? { ...r, enabled: false } : r)),
      () => true,
      api,
    );
    expect(api.trace.mock.calls.every(([i]) => !("taskId" in i))).toBe(true);
  });
  it("reports truncated immediate reads rather than claiming completeness", async () => {
    const api = client();
    const normal = await api.trace({ direction: "up" });
    api.trace.mockResolvedValue({ ...normal, truncated: true });
    const loaded = await loadScope(refs, () => true, api);
    expect(loaded.trace.truncated).toBe(true);
    expect(loaded.warnings.length).toBe(6);
  });
  it("expands a discovered table without adding it to seeds, then collapses only that step", async () => {
    const api = client();
    const loaded = await loadScope([refs[0]!], () => true, api);
    const original = await api.trace({ direction: "up" });
    const upstream: GraphNode = {
      id: "dataset:upstream",
      kind: "PHYSICAL_DATASET",
      table: "raw.codes",
    };
    api.trace.mockResolvedValue({
      ...original,
      nodes: [extra, upstream],
      edges: [
        {
          id: "upstream",
          from: upstream.id,
          to: extra.id,
          kind: "READS_TABLE",
        },
      ],
    });
    const expanded = await expandScope(loaded, extra.id, "up", () => true, api);
    expect(expanded.members).toEqual(loaded.members);
    expect(expanded.trace.nodes.map((n) => n.id)).toContain(upstream.id);
    expect(expanded.expansions).toEqual([
      { nodeId: extra.id, direction: "up" },
    ]);
    expect(collapseScope(expanded).trace).toEqual(loaded.trace);
    await expect(
      expandScope(loaded, "absent", "up", () => true, api),
    ).rejects.toThrow("当前图");
  });
});
