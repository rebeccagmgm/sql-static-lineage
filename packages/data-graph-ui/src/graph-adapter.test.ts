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
  taskLabels: { consumer: "消费任务名称", producer: "生产任务名称" },
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
  it("explains folded intermediate steps on the selected value path", () => {
    const folded = { ...trace, edges: trace.edges.map(edge => edge.id === "consume-a" ?
      { ...edge, detail: { ...edge.detail, materializationFolded: true, materializationBridgeIds: ["step1", "step2"] } } : edge) };
    const result = adaptTrace(folded, undefined, "out:a");
    expect(result.edges.find(edge => edge.id === "consume-a")?.label).toBe("取值 · 经 2 个中间步骤");
  });
  it("coalesces fallback physical bridges and keeps field edges direct", () => {
    const result = adaptTrace(trace);
    expect(containing(result, "producer:a")?.id).toBe(
      containing(result, "in:a")?.id,
    );
    expect(containing(result, "producer:a")?.id).toMatch(
      /^table:pdata\.shared__hive:/,
    );
    expect(
      result.nodes.filter(({ type }) => type === "processingTask"),
    ).toEqual([]);
    expect(result.edges.some(({ source, target }) => source === target)).toBe(
      false,
    );
    expect(
      result.edges.filter(({ data }) => data?.raw === trace.edges[0]),
    ).toHaveLength(1);
    expect(result.edges.find(({ id }) => id === "consume-a")).toMatchObject({
      sourceHandle: "in:a",
      targetHandle: "out:a",
      data: { raw: trace.edges[0] },
    });
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
    expect(expanded.nodes.some(({ id }) => id === "task:candidate")).toBe(
      false,
    );
    expect(containing(expanded, "in:a")?.data.candidatesExpanded).toBe(true);
    expect(
      expanded.edges.find(({ id }) => id === "candidate-bridge")?.label,
    ).toBe("候选接续");
  });

  it("preserves exact aliases and highlights direct mappings without activating sibling fields", () => {
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
      result.edges.find(({ id }) => id === "consume-a")?.style?.opacity,
    ).toBe(1);
    expect(
      result.edges.find(({ id }) => id === "consume-b")?.style?.opacity,
    ).toBe(0.14);
  });

  it("does not synthesize task-level bundles in field mode", () => {
    const result = adaptTrace(trace, undefined, undefined, {
      highlightedTaskId: "task:consumer",
    });
    expect(result.nodes.some(({ type }) => type === "processingTask")).toBe(
      false,
    );
    expect(result.edges.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "consume-a",
        "consume-b",
        "produce-a",
        "produce-b",
      ]),
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

  it("keeps a constant-only field card without inventing an input edge", () => {
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
    expect(containing(result, "literal")).toBeDefined();
    expect(result.nodes.some(({ type }) => type === "processingTask")).toBe(
      false,
    );
    expect(result.edges).toEqual([]);
  });

  it("uses the SQLite scheduler name for an existing task node over an old graph label", () => {
    const result = adaptTrace({
      ...trace,
      taskLabels: { "144136": "odata_n_tit.d_ref_book_p_h15_f" },
      taskTopics: { "144136": "ODATA_N_TIT" },
      taskTopicDescriptions: { "144136": "投资管理系统采集" },
      nodes: [
        {
          id: "task:144136",
          kind: "TASK",
          taskId: "144136",
          label: "http://jira.example.invalid/BIGDATADEV-28821",
          depth: 0,
        },
      ],
      edges: [],
    });
    expect(result.nodes[0]?.data.raw).toMatchObject({
      label: "odata_n_tit.d_ref_book_p_h15_f",
      detail: {
        taskName: "odata_n_tit.d_ref_book_p_h15_f",
        topicName: "ODATA_N_TIT",
        topicDescription: "投资管理系统采集",
      },
    });
  });

  it("does not fall back to an old graph task label when SQLite has no name", () => {
    const result = adaptTrace({
      ...trace,
      taskLabels: {},
      nodes: [
        {
          id: "task:missing",
          kind: "TASK",
          taskId: "missing",
          label: "old requirement annotation",
          detail: {
            taskName: "old requirement annotation",
            topicName: "STALE_TOPIC",
            topicDescription: "旧描述",
          },
          depth: 0,
        },
      ],
      edges: [],
    });
    expect(result.nodes[0]?.data.raw).toMatchObject({
      taskId: "missing",
      detail: {},
    });
    expect(result.nodes[0]?.data.raw?.label).toBeUndefined();
  });
});

it("orders published consumption fields by name without changing edge endpoints", () => {
  const raw = [
    field("w:z", "WRITE_FIELD", {
      column: "z",
      table: "s.t",
      taskId: "t",
      writeId: "w",
      depth: 0,
    }),
    field("w:a", "WRITE_FIELD", {
      column: "a",
      table: "s.t",
      taskId: "t",
      writeId: "w",
      depth: 0,
    }),
  ];
  const result = adaptTrace({
    ...trace,
    nodes: raw,
    edges: [],
    consumption: {
      schemaVersion: "1.0.0",
      branches: [],
      rootPaths: [],
      groups: [
        {
          id: "published",
          role: "WRITE",
          presentation: "FIELD_GROUP",
          scopeEquivalence: "PROVEN",
          depth: 0,
          scope: { status: "UNKNOWN", label: "范围未证明", items: [] },
          rawNodeIds: ["w:z", "w:a"],
          rawEdgeIds: [],
          rootNodeIds: [],
          fields: [],
          writeRefs: [],
        },
      ],
    },
  });
  expect(result.nodes[0]?.data.members?.map((member) => member.column)).toEqual(
    ["a", "z"],
  );
  expect(raw.map((member) => member.column)).toEqual(["z", "a"]);
});
it("shows value labels only for the highlighted lineage", () => {
  const unselected = adaptTrace(trace);
  expect(unselected.edges.filter((edge) => edge.label === "取值")).toHaveLength(
    0,
  );
});

describe("table view candidate boundaries", () => {
  it.each(["up", "down"] as const)("keeps returned table IO beyond candidate writes in %s traces", direction => {
    const nodes: GraphNode[] = direction === "up" ? [
      {id:"target",kind:"PHYSICAL_DATASET",table:"dm.target",depth:0},
      {id:"task:writer",kind:"TASK",taskId:"writer",depth:1},
      {id:"source",kind:"PHYSICAL_DATASET",table:"odata.source",depth:2},
    ] : [
      {id:"task:writer",kind:"TASK",taskId:"writer",depth:0},
      {id:"target",kind:"PHYSICAL_DATASET",table:"dm.target",depth:1},
      {id:"task:reader",kind:"TASK",taskId:"reader",depth:2},
    ];
    const candidate = {id:"candidate-write",from:"task:writer",to:"target",kind:"WRITES_TABLE",status:"CANDIDATE"};
    const observed = direction === "up"
      ? {id:"read",from:"source",to:"task:writer",kind:"READS_TABLE",status:"OBSERVED"}
      : {id:"read",from:"target",to:"task:reader",kind:"READS_TABLE",status:"OBSERVED"};
    const input: TraceResult = {...trace,layer:"table",direction,nodes,edges:[candidate,observed],consumption:undefined};
    const graph = adaptTrace(input);
    expect(graph.nodes.map(node=>node.id).sort()).toEqual(nodes.map(node=>node.id).sort());
    expect(graph.edges.map(edge=>edge.id).sort()).toEqual(["candidate-write","read"]);
    const rendered = graph.edges.find(edge=>edge.id === "candidate-write")!;
    expect(rendered.style?.strokeDasharray).toBe("6 5");
    expect(rendered.data?.raw).toEqual(candidate);
    expect(candidate.status).toBe("CANDIDATE");
  });
});
