import { describe, expect, it } from "vitest";
import type {
  TaskLocalEdge,
  TaskLocalNode,
  TaskLocalProjection,
} from "../../../scripts/project-graph/task-local/contract.ts";
import {
  fieldEvidencePhysicalFieldNodeId,
  physicalDatasetNodeId,
  readOccurrenceNodeId,
  targetWriteNodeId,
  taskLocalEdgeId,
  taskNodeId,
} from "../../../scripts/project-graph/task-local/ids.ts";
import type { AssetEdge, CompiledTask } from "../src/asset-graph/compile.ts";
import { compileCatalogTask as compileTask } from "../src/asset-graph/compile-catalog.ts";
import { assetColumnNodeId } from "../src/asset-graph/catalog.ts";

interface TableIdentity {
  platform: string;
  dataSource: string;
  stableTableId: string;
  qualifiedName: string;
}

interface Dependency {
  column?: string;
  output?: string;
  read?: number;
  write?: number;
  conditional?: boolean;
  ambiguous?: boolean;
}

const sourceTable: TableIdentity = {
  platform: "hive",
  dataSource: "source-a",
  stableTableId: "table-source",
  qualifiedName: "demo.source",
};
const targetTable: TableIdentity = {
  platform: "hive",
  dataSource: "target-a",
  stableTableId: "table-target",
  qualifiedName: "demo.target",
};
const fieldId = (table: TableIdentity, column: string): string =>
  fieldEvidencePhysicalFieldNodeId({ ...table, column });
const columnId = (table: TableIdentity, column: string): string =>
  assetColumnNodeId({
    platform: table.platform,
    dataSource: table.dataSource,
    qualifiedName: table.qualifiedName,
    column,
  });
const datasetProperties = (table: TableIdentity) => ({
  platform: table.platform,
  dataSource: table.dataSource,
  qualifiedName: table.qualifiedName,
});

/** Matches the 1.3 projection's node properties and explicit read/write topology. */
function fixture(
  options: {
    taskId?: string;
    source?: TableIdentity;
    target?: TableIdentity;
    readCount?: number;
    writeCount?: number;
    dependencies?: Dependency[];
    targetStatus?: "CONFIRMED" | "UNRESOLVED";
  } = {},
) {
  const taskId = options.taskId ?? "producer";
  const source = options.source ?? sourceTable;
  const target = options.target ?? targetTable;
  const sourceDatasetId = physicalDatasetNodeId(source);
  const targetDatasetId = physicalDatasetNodeId(target);
  const readCount = options.readCount ?? 1;
  const writeCount = options.writeCount ?? 1;
  const dependencies = options.dependencies ?? [{}];
  const nodes: TaskLocalNode[] = [
    {
      nodeId: taskNodeId(taskId),
      nodeType: "TASK",
      properties: { taskName: taskId },
    },
    {
      nodeId: sourceDatasetId,
      nodeType: "PHYSICAL_DATASET",
      properties: { ...datasetProperties(source), identityStatus: "CONFIRMED" },
    },
    {
      nodeId: targetDatasetId,
      nodeType: "PHYSICAL_DATASET",
      properties: {
        ...datasetProperties(target),
        identityStatus: options.targetStatus ?? "CONFIRMED",
      },
    },
  ];
  const edges: TaskLocalEdge[] = [];
  const addEdge = (
    edgeType: TaskLocalEdge["edgeType"],
    fromNodeId: string,
    toNodeId: string,
    properties: Record<string, unknown>,
  ): TaskLocalEdge => {
    const result = {
      edgeId: taskLocalEdgeId({
        edgeType,
        fromNodeId,
        toNodeId,
        semanticKey: properties,
      }),
      edgeType,
      fromNodeId,
      toNodeId,
      properties,
    };
    edges.push(result);
    return result;
  };
  const externalReads = Array.from({ length: readCount }, (_, index) => {
    const occurrenceId = `read:${taskId}:${index}`;
    const relationId = `relation:${taskId}:${index}`;
    const nodeId = readOccurrenceNodeId({
      consumerTaskId: taskId,
      occurrenceId,
      readRelationId: relationId,
    });
    nodes.push({
      nodeId,
      nodeType: "READ_OCCURRENCE",
      properties: {
        taskId,
        occurrenceId,
        relationId,
        datasetNodeId: sourceDatasetId,
        physicalDataset: source.qualifiedName,
        identityStatus: "CONFIRMED",
        readDisposition: "EXTERNAL_READ",
      },
    });
    addEdge("READS", taskNodeId(taskId), nodeId, {
      readOccurrenceId: occurrenceId,
    });
    addEdge("READS", nodeId, sourceDatasetId, {
      readOccurrenceId: occurrenceId,
    });
    return {
      readOccurrenceId: occurrenceId,
      readOccurrenceNodeId: nodeId,
      datasetNodeId: sourceDatasetId,
      qualifiedName: source.qualifiedName,
      identityStatus: "CONFIRMED" as const,
    };
  });
  const finalWrites = Array.from({ length: writeCount }, (_, index) => {
    const writeObservationId = `write:${taskId}:${index}`;
    const nodeId = targetWriteNodeId({
      taskId,
      datasetNodeId: targetDatasetId,
      writeObservationId,
    });
    nodes.push({
      nodeId,
      nodeType: "TARGET_WRITE",
      properties: { writeObservationId, qualifiedName: target.qualifiedName },
    });
    addEdge("WRITES", taskNodeId(taskId), nodeId, { writeObservationId });
    addEdge("WRITES", nodeId, targetDatasetId, { writeObservationId });
    return {
      writeObservationId,
      targetWriteNodeId: nodeId,
      datasetNodeId: targetDatasetId,
      qualifiedName: target.qualifiedName,
    };
  });
  const fieldEdges = dependencies.map((dependency, index) => {
    const column = dependency.column ?? "amount";
    const nodeId = fieldId(source, column);
    if (!nodes.some((node) => node.nodeId === nodeId)) {
      nodes.push({
        nodeId,
        nodeType: "PHYSICAL_FIELD",
        properties: { ...source, column, identityStatus: "CONFIRMED" },
      });
    }
    const read = externalReads[dependency.read ?? 0]!;
    const write = finalWrites[dependency.write ?? 0]!;
    return addEdge(
      dependency.conditional ? "FIELD_CONDITIONAL" : "FIELD_DIRECT",
      nodeId,
      write.targetWriteNodeId,
      {
        subtype: dependency.conditional ? "CONDITIONAL" : "IDENTITY",
        outputColumn: dependency.output ?? "principal",
        expressionId: `expression:${taskId}:${index}`,
        bindingId: `binding:${taskId}:${index}`,
        sourceReadOccurrenceId: dependency.ambiguous
          ? null
          : read.readOccurrenceId,
        sourceReadOccurrenceStatus: dependency.ambiguous
          ? "AMBIGUOUS"
          : "RESOLVED",
        ...(dependency.ambiguous
          ? { sourceReadOccurrenceReason: "SELF_JOIN_NO_QUALIFIER" }
          : {}),
        sourceRelationId: dependency.ambiguous
          ? null
          : `relation:${taskId}:${dependency.read ?? 0}`,
      },
    );
  });
  const projection: TaskLocalProjection = {
    schemaVersion: "1.3.0",
    artifactType: "TASK_LOCAL_PROJECTION",
    generatedAt: "2026-09-05T00:00:00.000Z",
    taskId,
    coverageStatus: "PROJECTED",
    failureReasonCode: null,
    contentHash: "fixture-hash",
    nodes,
    edges,
    localClosure: { externalReads, finalWrites, localFieldPaths: [] },
    gaps: [],
  };
  return {
    projection,
    source,
    target,
    sourceDatasetId,
    targetDatasetId,
    externalReads,
    finalWrites,
    fieldEdges,
  };
}

function link(
  graph: CompiledTask,
  kind: string,
  from: string,
  to: string,
): AssetEdge | undefined {
  return graph.edges.find(
    (edge) => edge.kind === kind && edge.from === from && edge.to === to,
  );
}

describe("asset catalogue and occurrence evidence", () => {
  it("connects physical columns to their dataset and to explicit read/write fields", () => {
    const f = fixture();
    const graph = compileTask(f.projection);
    const input = columnId(f.source, "amount");
    const output = columnId(f.target, "principal");
    expect(graph.nodes.find((node) => node.id === output)).toMatchObject({
      kind: "COLUMN",
      taskId: "",
      column: "principal",
    });
    expect(
      graph.nodes
        .filter((node) => node.kind === "PHYSICAL_FIELD")
        .map((node) => node.id),
    ).toEqual([fieldId(f.source, "amount")]);
    expect(link(graph, "HAS_COLUMN", f.sourceDatasetId, input)).toBeDefined();
    expect(link(graph, "HAS_COLUMN", f.targetDatasetId, output)).toBeDefined();
    expect(
      link(
        graph,
        "HAS_FIELD",
        f.externalReads[0]!.readOccurrenceNodeId,
        graph.reads[0]!.id,
      ),
    ).toBeDefined();
    expect(
      link(
        graph,
        "OBSERVED_FIELD",
        fieldId(f.source, "amount"),
        graph.reads[0]!.id,
      ),
    ).toBeDefined();
    expect(
      link(graph, "IDENTIFIES_COLUMN", fieldId(f.source, "amount"), input),
    ).toBeDefined();
    expect(
      link(graph, "OBSERVES_COLUMN", graph.reads[0]!.id, input),
    ).toBeDefined();
    expect(
      link(graph, "OBSERVES_COLUMN", graph.writes[0]!.id, output),
    ).toBeDefined();
    expect(
      link(
        graph,
        "HAS_FIELD",
        f.finalWrites[0]!.targetWriteNodeId,
        graph.writes[0]!.id,
      ),
    ).toBeDefined();
  });

  it("gives a producer output and an independently compiled consumer source the same physical identity", () => {
    const producer = fixture();
    const consumer = fixture({
      taskId: "consumer",
      source: targetTable,
      target: {
        ...targetTable,
        stableTableId: "table-final",
        qualifiedName: "demo.final",
      },
      dependencies: [{ column: "principal", output: "total" }],
    });
    const a = compileTask(producer.projection);
    const b = compileTask(consumer.projection);
    const identity = columnId(targetTable, "principal");
    expect(link(a, "OBSERVES_COLUMN", a.writes[0]!.id, identity)).toBeDefined();
    expect(link(b, "OBSERVES_COLUMN", b.reads[0]!.id, identity)).toBeDefined();
    expect(a.writes[0]!.id).not.toBe(b.reads[0]!.id);
  });

  it("separates value and conditional asset summaries and retains original edge evidence", () => {
    const f = fixture({
      dependencies: [{}, { column: "flag", conditional: true }],
    });
    const graph = compileTask(f.projection);
    const value = link(
      graph,
      "DERIVED_FROM",
      columnId(f.target, "principal"),
      columnId(f.source, "amount"),
    );
    const condition = link(
      graph,
      "CONDITIONED_BY",
      columnId(f.target, "principal"),
      columnId(f.source, "flag"),
    );
    expect(value?.layer).toBe("asset");
    expect(condition?.layer).toBe("asset");
    expect(JSON.parse(value!.detail)).toMatchObject({
      ...f.fieldEdges[0]!.properties,
      sourceEdgeId: f.fieldEdges[0]!.edgeId,
      writeObservationId: f.finalWrites[0]!.writeObservationId,
    });
    expect(JSON.parse(condition!.detail)).toMatchObject({
      ...f.fieldEdges[1]!.properties,
      sourceEdgeId: f.fieldEdges[1]!.edgeId,
    });
    expect(
      link(
        graph,
        "DERIVED_FROM",
        columnId(f.target, "principal"),
        columnId(f.source, "flag"),
      ),
    ).toBeUndefined();
  });

  it("catalogues constant output bindings without inventing source fields or lineage", () => {
    const f = fixture({ dependencies: [], readCount: 0 });
    const graph = compileTask(f.projection, [
      {
        write_observation_id: f.finalWrites[0]!.writeObservationId,
        target_field: "source_type",
        binding_status: "RESOLVED",
      },
    ]);
    const output = columnId(f.target, "source_type");
    expect(link(graph, "HAS_COLUMN", f.targetDatasetId, output)).toBeDefined();
    expect(
      link(graph, "OBSERVES_COLUMN", graph.writes[0]!.id, output),
    ).toBeDefined();
    expect(graph.reads).toEqual([]);
    expect(
      graph.edges.filter(
        (edge) => edge.layer === "field" || edge.layer === "asset",
      ),
    ).toEqual([]);
  });

  it("does not merge identically named tables and columns from different data sources", () => {
    const first = fixture();
    const second = fixture({
      taskId: "other",
      target: { ...targetTable, dataSource: "target-b" },
    });
    const a = compileTask(first.projection);
    const b = compileTask(second.projection);
    const outputA = a.edges.find(
      (edge) =>
        edge.kind === "OBSERVES_COLUMN" && edge.from === a.writes[0]!.id,
    )?.to;
    const outputB = b.edges.find(
      (edge) =>
        edge.kind === "OBSERVES_COLUMN" && edge.from === b.writes[0]!.id,
    )?.to;
    expect(outputA).toBe(columnId(first.target, "principal"));
    expect(outputB).toBe(columnId(second.target, "principal"));
    expect(outputA).not.toBe(outputB);
  });

  it("keeps self-join reads and repeated writes distinct beneath their shared asset summary", () => {
    const f = fixture({
      readCount: 2,
      writeCount: 2,
      dependencies: [
        { read: 0, write: 0 },
        { read: 1, write: 1 },
      ],
    });
    const graph = compileTask(f.projection);
    expect(new Set(graph.reads.map((read) => read.id)).size).toBe(2);
    expect(new Set(graph.writes.map((write) => write.id)).size).toBe(2);
    const summaries = graph.edges.filter(
      (edge) => edge.kind === "DERIVED_FROM",
    );
    expect(summaries).toHaveLength(2);
    expect(new Set(summaries.map((edge) => edge.from))).toEqual(
      new Set([columnId(f.target, "principal")]),
    );
    expect(
      new Set(
        summaries.map((edge) => JSON.parse(edge.detail).sourceReadOccurrenceId),
      ),
    ).toEqual(new Set(f.externalReads.map((read) => read.readOccurrenceId)));
    expect(
      new Set(
        summaries.map((edge) => JSON.parse(edge.detail).writeObservationId),
      ),
    ).toEqual(new Set(f.finalWrites.map((write) => write.writeObservationId)));
    const nodeKinds = new Map(graph.nodes.map((node) => [node.id, node.kind]));
    expect(
      graph.edges
        .filter((edge) => edge.layer === "field")
        .every(
          (edge) =>
            nodeKinds.get(edge.from) === "READ_FIELD" &&
            nodeKinds.get(edge.to) === "WRITE_FIELD",
        ),
    ).toBe(true);
  });

  it("isolates ambiguous source reads per edge instead of using a physical field as a traversal junction", () => {
    const f = fixture({
      readCount: 2,
      writeCount: 2,
      dependencies: [
        { ambiguous: true, write: 0 },
        { ambiguous: true, write: 1 },
      ],
    });
    const graph = compileTask(f.projection);
    expect(graph.reads).toEqual([]);
    const unresolved = graph.nodes.filter(
      (node) => node.kind === "UNRESOLVED_READ_FIELD",
    );
    expect(unresolved).toHaveLength(2);
    expect(new Set(unresolved.map((node) => node.id)).size).toBe(2);
    for (const node of unresolved) {
      expect(JSON.parse(node.detail)).toMatchObject({
        sourceFieldNodeId: fieldId(f.source, "amount"),
        sourceReadOccurrenceReason: "SELF_JOIN_NO_QUALIFIER",
      });
    }
    const unresolvedIds = new Set(unresolved.map((node) => node.id));
    expect(
      graph.edges
        .filter((edge) => edge.layer === "field")
        .every((edge) => unresolvedIds.has(edge.from)),
    ).toBe(true);
    expect(graph.edges.filter((edge) => edge.layer === "asset")).toEqual([]);
  });

  it("preserves occurrence evidence without synthesizing shared output fields for unresolved target identity", () => {
    const f = fixture({ targetStatus: "UNRESOLVED" });
    const graph = compileTask(f.projection);
    expect(graph.writes).toHaveLength(1);
    expect(graph.edges.filter((edge) => edge.kind === "VALUE")).toHaveLength(1);
    expect(
      graph.nodes.some((node) => node.id === columnId(f.target, "principal")),
    ).toBe(false);
    expect(
      graph.edges.filter(
        (edge) =>
          (edge.kind === "OBSERVES_COLUMN" &&
            edge.from === graph.writes[0]!.id) ||
          edge.layer === "asset",
      ),
    ).toEqual([]);
  });
});
