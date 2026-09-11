import { describe, expect, it } from "vitest";
import { consumptionScopeFromDetail } from "../src/asset-graph/consumption-scope.ts";
import {
  buildTraceConsumption,
  type TraceConsumptionEdge,
  type TraceConsumptionNode,
} from "../src/asset-graph/trace-consumption.ts";

const write = (
  id: string,
  taskId: string,
  writeId: string,
  column = "amount",
  detail: Record<string, unknown> = {},
): TraceConsumptionNode => ({
  id,
  kind: "WRITE_FIELD",
  taskId,
  writeId,
  table: "pdata.shared",
  column,
  detail,
  depth: taskId === "consumer" ? 0 : 2,
});

it("preserves proven non-partitioned output scope without requiring outgoing continuation edges", () => {
  const nodes = [write("a", "consumer", "write:1", "a", { partition: [], partitionStatus: "NON_PARTITIONED" }),
    write("b", "consumer", "write:1", "b", { partition: [], partitionStatus: "NON_PARTITIONED" })];
  const result = buildTraceConsumption({ nodes, edges: [], direction: "up" });
  expect(result.groups).toHaveLength(2);
  for (const group of result.groups) {
    expect(group.scope).toMatchObject({ status: "TABLE_LEVEL", label: "非分区表", nonPartitioned: true });
    expect(group.writeRefs[0]?.scope).toMatchObject({ status: "TABLE_LEVEL", label: "非分区表" });
  }
  expect(consumptionScopeFromDetail({ partition: [] }).status).toBe("UNKNOWN");
});

it("distinguishes an unfiltered read from an unresolved partition expression", () => {
  expect(consumptionScopeFromDetail({ partitionPredicateStatus: "NONE", partitionPredicates: [] })).toMatchObject({
    status: "TABLE_LEVEL", label: "读取未限定分区",
  });
  expect(consumptionScopeFromDetail({ partitionPredicateStatus: "NON_LITERAL_PRESENT", partitionPredicates: [] }).status).toBe("UNKNOWN");
  expect(consumptionScopeFromDetail({ partitionPredicateStatus: "LITERAL", partitionPredicates: [{ column: "grp_id", values: ["A"] }] })).toMatchObject({
    status: "EXPLICIT", label: "grp_id=A",
  });
});

const read = (
  id: string,
  occurrenceId: string,
  column = "amount",
  stableTableId = "pdata.shared__gfhive",
): TraceConsumptionNode => ({
  id,
  kind: "READ_FIELD",
  taskId: "consumer",
  table: "pdata.shared",
  column,
  depth: 1,
    detail: {
      occurrenceId,
      stableTableId,
      platform: "hive",
      dataSource: "gfhive",
      qualifiedName: "pdata.shared",
      identityStatus: "CONFIRMED",
  },
});

const bridge = (
  id: string,
  from: string,
  to: string,
  grp: string,
  status = "CONFIRMED",
  date = "${YYYY-MM-DD}",
): TraceConsumptionEdge => ({
  id,
  from,
  to,
  kind: status === "ASSUMED" ? "CANDIDATE" : "CONTINUES",
  status,
  detail: {
    partitionMatchStatus: status,
    partition: [
      { column: "busi_date", values: [date], partitionStatus: "STATIC" },
      { column: "grp_id", values: [grp], partitionStatus: "STATIC" },
    ],
  },
});

describe("trace consumption projection", () => {
  it("keeps a shared read once and exposes all four confirmed source scopes", () => {
    const root = write("out", "consumer", "consumer-write");
    const input = read("read", "read:partial-key");
    const producers = ["01", "02", "03", "04"].map((grp) =>
      write(`write-${grp}`, `producer-${grp}`, `write-${grp}`),
    );
    const edges: TraceConsumptionEdge[] = [
      { id: "value", from: input.id, to: root.id, kind: "VALUE", status: "OBSERVED" },
      ...producers.map((producer, index) =>
        bridge(`bridge-${index + 1}`, producer.id, input.id, `0${index + 1}`),
      ),
    ];
    const result = buildTraceConsumption({
      nodes: [root, input, ...producers],
      edges,
      direction: "up",
    });
    expect(result.groups.filter((group) => group.role === "READ")).toHaveLength(1);
    const sourceGroups = result.groups.filter(
      (group) => group.role === "WRITE" && group.taskId?.startsWith("producer-"),
    );
    expect(sourceGroups).toHaveLength(4);
    expect(sourceGroups.map((group) => group.scope.label).sort()).toEqual([
      "busi_date=${YYYY-MM-DD} · grp_id=01",
      "busi_date=${YYYY-MM-DD} · grp_id=02",
      "busi_date=${YYYY-MM-DD} · grp_id=03",
      "busi_date=${YYYY-MM-DD} · grp_id=04",
    ]);
    expect(result.branches.filter((branch) => branch.kind === "CONTINUES")).toHaveLength(4);
    expect(result.rootPaths).toEqual([
      expect.objectContaining({
        rootNodeId: "out",
        rawNodeIds: expect.arrayContaining(["read", "write-01", "write-02", "write-03", "write-04"]),
        rawEdgeIds: expect.arrayContaining(["bridge-1", "bridge-2", "bridge-3", "bridge-4"]),
      }),
    ]);
  });

  it("coalesces same-scope multi-write fields without losing aliases or write refs", () => {
    const inputA = read("read-a", "read:1", "a");
    const inputB = read("read-b", "read:1", "b");
    const writeA = write("write-a", "producer", "write:3", "a");
    const writeB = write("write-b", "producer", "write:6", "b");
    const result = buildTraceConsumption({
      nodes: [inputA, inputB, writeA, writeB],
      edges: [
        bridge("bridge-a", "write-a", "read-a", "SRC"),
        bridge("bridge-b", "write-b", "read-b", "SRC"),
      ],
      direction: "up",
    });
    const producer = result.groups.find((group) => group.role === "WRITE")!;
    expect(result.groups.filter((group) => group.role === "WRITE")).toHaveLength(1);
    expect(producer.rawNodeIds).toEqual(["write-a", "write-b"]);
    expect(producer.fields.map((field) => field.column)).toEqual(["a", "b"]);
    expect(producer.writeRefs.map((ref) => ref.writeId)).toEqual(["write:3", "write:6"]);
  });

  it("does not merge different physical sources, unknown scopes, or distinct dynamic symbols", () => {
    const reads = [
      read("read-hive", "read:1", "amount", "pdata.shared__hive-a"),
      read("read-other", "read:1", "amount", "pdata.shared__hive-b"),
    ];
    const writes = [
      write("today", "producer", "write:today"),
      write("yesterday", "producer", "write:yesterday"),
      write("unknown-a", "producer", "write:unknown-a"),
      write("unknown-b", "producer", "write:unknown-b"),
    ];
    const result = buildTraceConsumption({
      nodes: [...reads, ...writes],
      edges: [
        bridge("today-edge", "today", "read-hive", "01", "CONFIRMED", "${YYYY-MM-DD}"),
        bridge("yesterday-edge", "yesterday", "read-hive", "01", "CONFIRMED", "${YYYY-MM-DD-1}"),
      ],
      direction: "up",
    });
    expect(result.groups.filter((group) => group.role === "READ")).toHaveLength(2);
    expect(result.groups.filter((group) => group.role === "WRITE")).toHaveLength(4);
    expect(
      result.groups.filter((group) => group.rawNodeIds.some((id) => id.startsWith("unknown"))).map((group) => group.scope.status),
    ).toEqual(["UNKNOWN", "UNKNOWN"]);
  });

  it("keeps candidate status separate from confirmed scope and preserves root ownership", () => {
    const roots = [write("root-a", "consumer", "root:a", "a"), write("root-b", "consumer", "root:b", "b")];
    const reads = [read("read-a", "read:a", "a"), read("read-b", "read:b", "b")];
    const producer = write("producer-a", "producer", "write:1", "a");
    const edges: TraceConsumptionEdge[] = [
      { id: "value-a", from: "read-a", to: "root-a", kind: "VALUE" },
      { id: "value-b", from: "read-b", to: "root-b", kind: "VALUE" },
      bridge("confirmed", "producer-a", "read-a", "03"),
      bridge("assumed", "producer-a", "read-b", "03", "ASSUMED"),
    ];
    const result = buildTraceConsumption({ nodes: [...roots, ...reads, producer], edges, direction: "up" });
    expect(result.branches.map((branch) => `${branch.kind}:${branch.status}`).sort()).toEqual(
      expect.arrayContaining(["CANDIDATE:ASSUMED", "CONTINUES:CONFIRMED"]),
    );
    const a = result.rootPaths.find((path) => path.rootNodeId === "root-a")!;
    const b = result.rootPaths.find((path) => path.rootNodeId === "root-b")!;
    expect(a.rawEdgeIds).not.toContain("assumed");
    expect(b.rawEdgeIds).not.toContain("confirmed");
  });

  it("keeps full physical identity and merges scope across fields", () => {
    const readA = read("read-a", "read:shared", "a", "shared-guid");
    const readB = read("read-b", "read:shared", "b", "shared-guid");
    const otherSource = {
      ...read("read-other", "read:shared", "a", "shared-guid"),
      detail: {
        ...readA.detail,
        dataSource: "other-source",
        qualifiedName: "other.shared",
      },
    };
    const writeA = write("write-a", "producer-a", "write:a", "a");
    const writeB = write("write-b", "producer-b", "write:b", "b");
    const result = buildTraceConsumption({
      nodes: [readA, readB, otherSource, writeA, writeB],
      edges: [
        bridge("bridge-a", "write-a", "read-a", "01"),
        bridge("bridge-b", "write-b", "read-b", "02"),
      ],
      direction: "up",
    });
    const reads = result.groups.filter((group) => group.role === "READ");
    expect(reads).toHaveLength(2);
    expect(reads.find((group) => group.rawNodeIds.includes("read-a"))?.scope).toMatchObject({
      status: "EXPLICIT",
      label: "共同消费 2 个范围",
    });
  });

  it("distinguishes partial, unknown and table-level partition evidence", () => {
    const root = write("root", "consumer", "root");
    const inputs = [read("partial", "read:p"), read("unknown", "read:u"), read("table", "read:t")];
    const producer = write("producer", "producer", "write:p");
    const result = buildTraceConsumption({
      nodes: [root, ...inputs, producer],
      edges: [
        {
          id: "partial-edge",
          from: "producer",
          to: "partial",
          kind: "CONTINUES",
          status: "CONFIRMED",
          detail: {
            partitionMatchStatus: "CONFIRMED",
            partition: [
              { column: "dt", values: ["2026-09-10"], partitionStatus: "STATIC" },
              { column: "grp", values: [], partitionStatus: "UNKNOWN", valueStatus: "UNKNOWN" },
            ],
          },
        },
        {
          id: "unknown-edge",
          from: "producer",
          to: "unknown",
          kind: "CANDIDATE",
          status: "UNKNOWN",
          detail: {
            partitionMatchStatus: "UNKNOWN",
            partition: [{ column: "p", values: [], partitionStatus: "UNKNOWN", valueStatus: "UNKNOWN" }],
          },
        },
        {
          id: "table-edge",
          from: "producer",
          to: "table",
          kind: "CONTINUES",
          status: "CONFIRMED",
          detail: { partitionMatchStatus: "CONFIRMED", partition: [] },
        },
      ],
      direction: "up",
    });
    const byEdge = (id: string) =>
      result.branches.find((branch) => branch.rawEdgeIds.includes(id))!.scope;
    expect(byEdge("partial-edge")).toMatchObject({ status: "PARTIAL", unknownCount: 1 });
    expect(
      result.groups.find((group) =>
        group.rawNodeIds.includes("partial"),
      )?.scope,
    ).toMatchObject({ status: "PARTIAL", unknownCount: 1 });
    expect(
      result.groups
        .find((group) => group.rawNodeIds.includes("producer"))
        ?.writeRefs.find((ref) => ref.writeId === "write:p")?.scope,
    ).toMatchObject({ status: "PARTIAL" });
    expect(byEdge("unknown-edge")).toMatchObject({ status: "UNKNOWN" });
    expect(byEdge("table-edge")).toMatchObject({
      status: "TABLE_LEVEL",
      label: "表级接续（未记录分区限定）",
    });
  });

  it("stops root paths at candidate boundaries unless a confirmed path reaches the endpoint", () => {
    const root = write("root", "consumer", "root");
    const input = read("read", "read:1");
    const candidate = write("candidate", "candidate-task", "candidate-write");
    const past = read("past", "candidate-input");
    const candidateEdge = bridge("candidate-edge", "candidate", "read", "03", "ASSUMED");
    const valueEdges: TraceConsumptionEdge[] = [
      { id: "root-value", from: "read", to: "root", kind: "VALUE" },
      { id: "past-value", from: "past", to: "candidate", kind: "VALUE" },
    ];
    const candidateOnly = buildTraceConsumption({
      nodes: [root, input, candidate, past],
      edges: [valueEdges[0]!, candidateEdge, valueEdges[1]!],
      direction: "up",
    }).rootPaths[0]!;
    expect(candidateOnly.rawEdgeIds).toContain("candidate-edge");
    expect(candidateOnly.rawNodeIds).toContain("candidate");
    expect(candidateOnly.rawEdgeIds).not.toContain("past-value");
    expect(candidateOnly.rawNodeIds).not.toContain("past");

    const withConfirmed = buildTraceConsumption({
      nodes: [root, input, candidate, past],
      edges: [
        valueEdges[0]!,
        candidateEdge,
        bridge("confirmed-edge", "candidate", "read", "03"),
        valueEdges[1]!,
      ],
      direction: "up",
    }).rootPaths[0]!;
    expect(withConfirmed.rawEdgeIds).toContain("past-value");
    expect(withConfirmed.rawNodeIds).toContain("past");
  });
});
