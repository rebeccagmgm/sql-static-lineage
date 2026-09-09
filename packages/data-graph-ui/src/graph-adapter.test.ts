import { describe, expect, it, vi } from "vitest";
import { adaptTrace } from "./graph-adapter";
import type { GraphNode, TraceResult } from "./types";

const field = (
  id: string,
  kind: "READ_FIELD" | "WRITE_FIELD",
  input: Partial<GraphNode>,
): GraphNode => ({
  id,
  kind,
  ...input,
});

const trace: TraceResult = {
  version: "v1",
  layer: "field",
  direction: "up",
  depthLimit: 4,
  edgeLimit: 150,
  truncated: false,
  stoppedBy: null,
  frontierNodeIds: [],
  terminalNodes: [],
  elapsedMs: 2,
  nodes: [
    field("out:a", "WRITE_FIELD", {
      taskId: "consumer",
      writeId: "cw",
      table: "dm.out",
      column: "a",
      depth: 0,
    }),
    field("out:b", "WRITE_FIELD", {
      taskId: "consumer",
      writeId: "cw",
      table: "dm.out",
      column: "b",
      depth: 0,
    }),
    field("in:a", "READ_FIELD", {
      taskId: "consumer",
      table: "pdata.shared",
      column: "a",
      depth: 1,
      detail: {
        occurrenceId: "consumer-read",
        stableTableId: "pdata.shared__hive",
        identityStatus: "CONFIRMED",
      },
    }),
    field("in:b", "READ_FIELD", {
      taskId: "consumer",
      table: "pdata.shared",
      column: "b",
      depth: 1,
      detail: {
        occurrenceId: "consumer-read",
        stableTableId: "pdata.shared__hive",
        identityStatus: "CONFIRMED",
      },
    }),
    field("producer:a", "WRITE_FIELD", {
      taskId: "producer",
      writeId: "pw",
      table: "pdata.shared",
      column: "a",
      depth: 2,
    }),
    field("producer:b", "WRITE_FIELD", {
      taskId: "producer",
      writeId: "pw",
      table: "pdata.shared",
      column: "b",
      depth: 2,
    }),
    field("source:a", "READ_FIELD", {
      taskId: "producer",
      table: "odata.source",
      column: "a",
      depth: 3,
      detail: {
        occurrenceId: "producer-read",
        stableTableId: "odata.source__hive",
        identityStatus: "CONFIRMED",
      },
    }),
    field("source:b", "READ_FIELD", {
      taskId: "producer",
      table: "odata.source",
      column: "b",
      depth: 3,
      detail: {
        occurrenceId: "producer-read",
        stableTableId: "odata.source__hive",
        identityStatus: "CONFIRMED",
      },
    }),
    field("candidate:a", "WRITE_FIELD", {
      taskId: "candidate",
      writeId: "xw",
      table: "pdata.shared",
      column: "a",
      depth: 2,
    }),
    field("candidate-source:a", "READ_FIELD", {
      taskId: "candidate",
      table: "odata.candidate",
      column: "a",
      depth: 3,
      detail: {
        occurrenceId: "candidate-read",
        stableTableId: "odata.candidate__hive",
        identityStatus: "CONFIRMED",
      },
    }),
  ],
  edges: [
    {
      id: "consume-a",
      from: "in:a",
      to: "out:a",
      kind: "VALUE",
      detail: { expressionId: "expr:a" },
    },
    { id: "consume-b", from: "in:b", to: "out:b", kind: "VALUE" },
    {
      id: "bridge-a",
      from: "producer:a",
      to: "in:a",
      kind: "CONTINUES",
      status: "CONFIRMED",
    },
    {
      id: "bridge-b",
      from: "producer:b",
      to: "in:b",
      kind: "CONTINUES",
      status: "CONFIRMED",
    },
    { id: "produce-a", from: "source:a", to: "producer:a", kind: "VALUE" },
    { id: "produce-b", from: "source:b", to: "producer:b", kind: "VALUE" },
    {
      id: "candidate-bridge",
      from: "candidate:a",
      to: "in:a",
      kind: "CANDIDATE",
      status: "UNKNOWN",
    },
    {
      id: "candidate-produce",
      from: "candidate-source:a",
      to: "candidate:a",
      kind: "VALUE",
    },
  ],
};

const containing = (result: ReturnType<typeof adaptTrace>, id: string) =>
  result.nodes.find((node) =>
    [
      ...(node.data.members ?? []),
      ...Object.values(node.data.fieldAliases ?? {}).flat(),
    ].some((member) => member.id === id),
  );

describe("field trial projection", () => {
  it("coalesces only confirmed physical bridges and inserts distinct task nodes", () => {
    const result = adaptTrace(trace);
    expect(containing(result, "producer:a")?.id).toBe(
      containing(result, "in:a")?.id,
    );
    expect(containing(result, "producer:a")?.id).toMatch(
      /^table:pdata\.shared__hive:/,
    );
    expect(
      result.nodes
        .filter(({ type }) => type === "processingTask")
        .map(({ id }) => id)
        .sort(),
    ).toEqual(["task:consumer", "task:producer"]);
    expect(result.edges.some(({ source, target }) => source === target)).toBe(
      false,
    );
    expect(
      result.edges.filter(({ data }) => data?.raw === trace.edges[0]),
    ).toHaveLength(2);
    expect(
      result.edges.find(({ id }) => id === "consume-a:input")?.data?.raw,
    ).toBe(trace.edges[0]);
    expect(
      result.edges.find(({ id }) => id === "consume-a:input")?.label,
    ).toBeUndefined();
  });

  it("keeps candidates isolated by default and expands them with a stable target key", () => {
    const toggle = vi.fn();
    const collapsed = adaptTrace(trace, undefined, undefined, {
      onToggleCandidates: toggle,
    });
    const shared = containing(collapsed, "in:a")!;
    expect(shared.data.candidateCount).toBe(1);
    expect(containing(collapsed, "candidate:a")).toBeUndefined();
    shared.data.onExpandCandidates?.();
    expect(toggle).toHaveBeenCalledWith("candidate:pdata.shared__hive");

    const expanded = adaptTrace(trace, undefined, undefined, {
      expandedCandidates: new Set(["candidate:pdata.shared__hive"]),
      onToggleCandidates: toggle,
    });
    expect(containing(expanded, "candidate:a")?.id).not.toBe(
      containing(expanded, "in:a")?.id,
    );
    expect(expanded.nodes.some(({ id }) => id === "task:candidate")).toBe(true);
    expect(containing(expanded, "in:a")?.data.candidatesExpanded).toBe(true);
    expect(
      expanded.edges.find(({ id }) => id === "candidate-bridge")?.label,
    ).toBe("候选接续");
  });

  it("preserves exact aliases and highlights through tasks without activating sibling fields", () => {
    const result = adaptTrace(trace, undefined, "out:a");
    const shared = containing(result, "in:a")!;
    expect(shared.data.activeFieldIds).toEqual(
      expect.arrayContaining(["in:a", "producer:a"]),
    );
    expect(shared.data.activeFieldIds).not.toContain("in:b");
    expect(shared.data.activeFieldIds).not.toContain("producer:b");
    expect(
      Object.values(shared.data.fieldAliases ?? {})
        .flat()
        .map(({ id }) => id),
    ).toContain("producer:a");
    expect(
      result.nodes.find(({ id }) => id === "task:consumer")?.style?.opacity,
    ).toBe(1);
    expect(
      result.edges.find(({ id }) => id === "consume-a:input")?.style?.opacity,
    ).toBe(1);
    expect(
      result.edges.find(({ id }) => id === "consume-b:input")?.style?.opacity,
    ).toBe(0.14);
  });

  it("highlights only a task's direct visual neighbors without crossing a shared table", () => {
    const result = adaptTrace(trace, undefined, undefined, {
      highlightedTaskId: "task:consumer",
    });
    expect(
      result.nodes.find(({ id }) => id === "task:consumer")?.style?.opacity,
    ).toBe(1);
    expect(containing(result, "in:a")?.style?.opacity).toBe(1);
    expect(result.nodes.some(({ id }) => id === "task:producer")).toBe(false);
    expect(
      result.edges.find(({ id }) => id === "consume-a:input")?.style?.opacity,
    ).toBe(1);
    expect(result.edges.some(({ id }) => id === "produce-a:output")).toBe(
      false,
    );
  });

  it("does not merge an unconfirmed or self-read/write bridge", () => {
    const unsafe: TraceResult = {
      ...trace,
      nodes: trace.nodes.map((node) =>
        node.id === "in:a" || node.id === "in:b"
          ? { ...node, detail: { ...node.detail, identityStatus: "UNKNOWN" } }
          : node,
      ),
    };
    const result = adaptTrace(unsafe, undefined, undefined, {
      expandedCandidates: new Set(["candidate:pdata.shared__hive"]),
    });
    expect(containing(result, "producer:a")?.id).not.toBe(
      containing(result, "in:a")?.id,
    );
  });

  it("keeps a constant-only output connected to its task without inventing input", () => {
    const literal: TraceResult = {
      ...trace,
      nodes: [
        field("literal", "WRITE_FIELD", {
          taskId: "literal-task",
          writeId: "literal-write",
          table: "dm.literal",
          column: "flag",
          depth: 0,
        }),
      ],
      edges: [],
    };
    const result = adaptTrace(literal, undefined, "literal");
    expect(
      result.nodes.some(
        ({ id, type }) =>
          id === "task:literal-task" && type === "processingTask",
      ),
    ).toBe(true);
    expect(result.edges).toEqual([
      expect.objectContaining({
        source: "task:literal-task",
        targetHandle: "literal",
        label: "生成字段",
        data: { rawNode: literal.nodes[0] },
      }),
    ]);
  });
});
