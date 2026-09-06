import { describe, it, expect } from "vitest";
import { compileTask } from "../src/asset-graph/compile.ts";
import type { TaskLocalProjection } from "../../../scripts/project-graph/task-local/contract.ts";
const projection = (taskId: string) =>
  ({
    taskId,
    coverageStatus: "PROJECTED",
    nodes: [
      { nodeId: `task:${taskId}`, nodeType: "TASK", properties: {} },
      {
        nodeId: "field:x",
        nodeType: "PHYSICAL_FIELD",
        properties: { qualifiedName: "demo.source", column: "amount" },
      },
      ...["a", "b"].map((x) => ({
        nodeId: `write:${taskId}:${x}`,
        nodeType: "TARGET_WRITE",
        properties: {
          qualifiedName: "demo.target",
          writeObservationId: `${taskId}:${x}`,
        },
      })),
    ],
    edges: ["a", "b"].map((x) => ({
      edgeId: `${taskId}:${x}`,
      edgeType: "FIELD_DIRECT",
      fromNodeId: "field:x",
      toNodeId: `write:${taskId}:${x}`,
      properties: {
        outputColumn: "principal",
        sourceReadOccurrenceId: `read:${taskId}:${x}`,
        sourceReadOccurrenceStatus: "RESOLVED",
      },
    })),
    localClosure: { externalReads: [], finalWrites: [], localFieldPaths: [] },
  }) as unknown as TaskLocalProjection;
describe("published asset field graph", () => {
  it("keeps two output writes and their input occurrences distinct", () => {
    const g = compileTask(projection("1"));
    expect(g.writes).toHaveLength(2);
    expect(g.reads).toHaveLength(2);
    expect(
      new Set(g.edges.filter((e) => e.kind === "VALUE").map((e) => e.to)).size,
    ).toBe(2);
  });
  it("shares a physical field without making it a field traversal junction", () => {
    const a = compileTask(projection("1")),
      b = compileTask(projection("2"));
    expect(a.nodes.find((n) => n.id === "field:x")?.id).toBe(
      b.nodes.find((n) => n.id === "field:x")?.id,
    );
    expect(
      a.edges
        .filter((e) => e.layer === "field")
        .every((e) => e.from !== "field:x"),
    ).toBe(true);
    expect(new Set([...a.reads, ...b.reads].map((r) => r.id)).size).toBe(4);
  });

  it("marks reference reads as policy terminals while retaining local value and table evidence", () => {
    const p = projection("1");
    const read = {
      readOccurrenceId: "read:1:a",
      readOccurrenceNodeId: "read-node:a",
      datasetNodeId: "dataset:ref",
      qualifiedName: "dm.grp_def",
      identityStatus: "CONFIRMED",
    };
    const enriched = {
      ...p,
      nodes: [
        ...p.nodes.map((node) =>
          node.nodeId === "field:x"
            ? {
                ...node,
                properties: { ...node.properties, qualifiedName: "dm.grp_def" },
              }
            : node,
        ),
        {
          nodeId: "dataset:ref",
          nodeType: "PHYSICAL_DATASET",
          properties: {
            qualifiedName: "dm.grp_def",
            identityStatus: "CONFIRMED",
          },
        },
        {
          nodeId: "read-node:a",
          nodeType: "READ_OCCURRENCE",
          properties: {
            occurrenceId: "read:1:a",
            physicalDataset: "dm.grp_def",
            identityStatus: "CONFIRMED",
            partitionPredicates: [
              { column: "grp_type_code", values: ["GKS_ORDER"] },
            ],
          },
        },
      ],
      localClosure: { ...p.localClosure, externalReads: [read] },
    } as unknown as TaskLocalProjection;
    const config = {
      version: "1",
      stopRoles: ["REFERENCE_CONFIG"],
      roles: { REFERENCE_CONFIG: { qualifiedNameTerms: ["grp_def"] } },
    };
    const g = compileTask(enriched, [], config);
    const a = g.nodes.find(
      (n) =>
        n.kind === "READ_FIELD" &&
        JSON.parse(n.detail).occurrenceId === "read:1:a",
    )!;
    expect(JSON.parse(a.detail)).toMatchObject({
      continuationDisposition: "POLICY_TERMINAL",
      boundaryRole: "REFERENCE_CONFIG",
    });
    expect(
      JSON.parse(g.nodes.find((n) => n.id === "read-node:a")!.detail)
        .partitionPredicates,
    ).toHaveLength(1);
    expect(g.edges.filter((e) => e.kind === "VALUE")).toHaveLength(2);
    expect(g.edges.filter((e) => e.kind === "READS_TABLE")).toHaveLength(1);
    const b = g.nodes.find(
      (n) =>
        n.kind === "READ_FIELD" &&
        JSON.parse(n.detail).occurrenceId === "read:1:b",
    )!;
    expect(JSON.parse(b.detail).continuationDisposition).toBeUndefined();
  });
});
