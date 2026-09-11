import { describe, expect, it } from "vitest";
import type { Driver } from "neo4j-driver";
import { AssetGraphStore } from "../src/asset-graph/store.ts";

type TestNode = { id: string; kind: string; detail: string };
type TestEdge = {
  id: string;
  from: string;
  to: string;
  kind: string;
  layer: "table" | "field";
};

const record = (values: Record<string, unknown>) => ({
  get: (name: string) => values[name],
});

class MemoryTraversalStore extends AssetGraphStore {
  constructor(
    private readonly anchorId: string,
    private readonly testNodes: TestNode[],
    private readonly testEdges: TestEdge[],
  ) {
    super({} as Driver, "neo4j", "test");
  }

  override async ready() {
    return { state: "READY", version: "v1" };
  }

  override async run(query: string, params: Record<string, unknown> = {}) {
    if (query.includes("RETURN properties(n) AS node ORDER BY n.id"))
      return { records: [record({ node: this.node(this.anchorId) })] } as never;
    const keys = (params.keys as string[]).map((key) =>
      key.replace(/^test\|/, ""),
    );
    const up = query.includes("(n)<-[r:SL_ASSET_EDGE]-(m)");
    const layer = String(params.layer);
    const fieldBoundary = params.fieldBoundary === true;
    const candidates = params.candidates !== false;
    const rows = this.testEdges.flatMap((edge) => {
      if (edge.layer !== layer || (!candidates && edge.kind === "CANDIDATE"))
        return [];
      if (fieldBoundary && !["CONTINUES", "CANDIDATE"].includes(edge.kind))
        return [];
      const sourceId = up ? edge.to : edge.from;
      const nextId = up ? edge.from : edge.to;
      if (!keys.includes(sourceId)) return [];
      return [
        record({
          source: this.node(sourceId),
          node: this.node(nextId),
          edge: { ...edge, key: edge.id, status: "CONFIRMED", detail: "{}" },
        }),
      ];
    });
    return { records: rows } as never;
  }

  private node(id: string) {
    const node = this.testNodes.find((candidate) => candidate.id === id);
    if (!node) throw new Error(`MISSING_TEST_NODE:${id}`);
    return { ...node, key: `test|${id}` };
  }
}

const tableNodes: TestNode[] = [
  { id: "table:a", kind: "PHYSICAL_DATASET", detail: "{}" },
  { id: "task:1", kind: "TASK", detail: "{}" },
  { id: "table:b", kind: "PHYSICAL_DATASET", detail: "{}" },
  { id: "task:2", kind: "TASK", detail: "{}" },
  { id: "table:c", kind: "PHYSICAL_DATASET", detail: "{}" },
];
const tableEdges: TestEdge[] = [
  {
    id: "write-a",
    from: "task:1",
    to: "table:a",
    kind: "WRITES_TABLE",
    layer: "table",
  },
  {
    id: "read-b",
    from: "table:b",
    to: "task:1",
    kind: "READS_TABLE",
    layer: "table",
  },
  {
    id: "write-b",
    from: "task:2",
    to: "table:b",
    kind: "WRITES_TABLE",
    layer: "table",
  },
  {
    id: "read-c",
    from: "table:c",
    to: "task:2",
    kind: "READS_TABLE",
    layer: "table",
  },
];

describe("asset graph table-hop depth", () => {
  it("closes one table processing step without entering the next task", async () => {
    const result = await new MemoryTraversalStore(
      "table:a",
      tableNodes,
      tableEdges,
    ).traverse({
      nodeId: "table:a",
      layer: "table",
      direction: "up",
      depth: 1,
      depthUnit: "table-hop",
    });
    expect(result.nodes.map(({ id }) => id)).toEqual([
      "table:a",
      "task:1",
      "table:b",
    ]);
    expect(result.nodes.find(({ id }) => id === "task:1")).toMatchObject({
      depth: 1,
      lineageDepth: 0,
    });
    expect(result.nodes.find(({ id }) => id === "table:b")).toMatchObject({
      depth: 2,
      lineageDepth: 1,
    });
    expect(result.nodes.some(({ id }) => id === "task:2")).toBe(false);
    expect(result.frontierNodeIds).toEqual(["table:b"]);
  });

  it("preserves legacy raw-edge depth by default", async () => {
    const result = await new MemoryTraversalStore(
      "table:a",
      tableNodes,
      tableEdges,
    ).traverse({
      nodeId: "table:a",
      layer: "table",
      direction: "up",
      depth: 1,
    });
    expect(result.nodes.map(({ id }) => id)).toEqual(["table:a", "task:1"]);
    expect(result.nodes[1]).not.toHaveProperty("lineageDepth");
  });

  it("includes a zero-cost field bridge at the boundary without the producer input", async () => {
    const nodes: TestNode[] = [
      { id: "write:root", kind: "WRITE_FIELD", detail: "{}" },
      { id: "read:consumer", kind: "READ_FIELD", detail: "{}" },
      { id: "write:producer", kind: "WRITE_FIELD", detail: "{}" },
      { id: "read:producer", kind: "READ_FIELD", detail: "{}" },
    ];
    const edges: TestEdge[] = [
      {
        id: "consumer-value",
        from: "read:consumer",
        to: "write:root",
        kind: "VALUE",
        layer: "field",
      },
      {
        id: "bridge",
        from: "write:producer",
        to: "read:consumer",
        kind: "CONTINUES",
        layer: "field",
      },
      {
        id: "producer-value",
        from: "read:producer",
        to: "write:producer",
        kind: "VALUE",
        layer: "field",
      },
    ];
    const result = await new MemoryTraversalStore(
      "write:root",
      nodes,
      edges,
    ).traverse({
      nodeId: "write:root",
      layer: "field",
      direction: "up",
      depth: 1,
      depthUnit: "table-hop",
    });
    expect(result.nodes.map(({ id }) => id)).toEqual([
      "write:root",
      "read:consumer",
      "write:producer",
    ]);
    expect(
      result.nodes.find(({ id }) => id === "write:producer"),
    ).toMatchObject({
      depth: 2,
      lineageDepth: 1,
    });
    expect(result.edges.map(({ id }) => id)).toEqual([
      "consumer-value",
      "bridge",
    ]);
    expect(result.frontierNodeIds).toEqual(["write:producer"]);
  });
});
