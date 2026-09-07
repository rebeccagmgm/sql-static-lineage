import { createHash } from "node:crypto";
import type { TaskLocalProjection } from "../../../../scripts/project-graph/task-local/contract.ts";
import type { TerminalTableConfig } from "../../../../scripts/reconcile/consumer/multi-hop/terminal-table-config.ts";
import { terminalNodeDetails } from "./terminal-policy.ts";

export interface AssetNode {
  id: string;
  kind: string;
  taskId: string;
  table: string;
  column: string;
  writeId: string;
  label: string;
  detail: string;
}
export interface AssetEdge {
  id: string;
  from: string;
  to: string;
  kind: string;
  layer: string;
  owner: string;
  status: string;
  detail: string;
}
export interface CompiledTask {
  taskId: string;
  nodes: AssetNode[];
  edges: AssetEdge[];
  reads: { id: string; occurrence: string; column: string }[];
  writes: { id: string; writeId: string; column: string; table: string }[];
}
export type FactRecord = Record<string, unknown>;
export const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const portId = (kind: string, scope: string, column: string) =>
  `${kind}:${digest([scope, column.toLowerCase()])}`;
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Preserve write/read occurrences; physical columns are catalogue identities, never traversal junctions. */
export function compileTask(
  p: TaskLocalProjection,
  bindings: readonly FactRecord[] = [],
  terminalConfig?: TerminalTableConfig,
): CompiledTask {
  const taskId = p.taskId,
    nodes = new Map<string, AssetNode>(),
    edges = new Map<string, AssetEdge>();
  const originals = new Map(p.nodes.map((n) => [n.nodeId, n]));
  const terminalReads = new Map(
    (p.localClosure?.externalReads ?? []).flatMap((read) => {
      if (!terminalConfig || read.identityStatus !== "CONFIRMED") return [];
      const details = terminalNodeDetails(read.qualifiedName, terminalConfig);
      return details ? [[read.readOccurrenceId, details] as const] : [];
    }),
  );
  const reads: CompiledTask["reads"] = [],
    writes: CompiledTask["writes"] = [];
  const node = (id: string, kind: string, props: FactRecord = {}) => {
    if (!nodes.has(id))
      nodes.set(id, {
        id,
        kind,
        taskId: ["PHYSICAL_DATASET", "PHYSICAL_FIELD"].includes(kind)
          ? ""
          : taskId,
        table: str(props.qualifiedName ?? props.physicalDataset).toLowerCase(),
        column: str(props.column).toLowerCase(),
        writeId: str(props.writeObservationId),
        label:
          str(
            props.taskName ??
              props.qualifiedName ??
              props.physicalDataset ??
              props.column,
          ) || id,
        detail: JSON.stringify(props),
      });
  };
  const edge = (
    from: string,
    to: string,
    kind: string,
    layer: string,
    props: FactRecord = {},
    id?: string,
  ) => {
    const key = id ?? digest([taskId, from, to, kind, props]);
    edges.set(key, {
      id: key,
      from,
      to,
      kind,
      layer,
      owner: taskId,
      status: str(props.status) || "OBSERVED",
      detail: JSON.stringify(props),
    });
  };
  for (const n of p.nodes) {
    const terminal =
      n.nodeType === "READ_OCCURRENCE"
        ? terminalReads.get(str(n.properties.occurrenceId))
        : n.nodeType === "PHYSICAL_DATASET" &&
            n.properties.identityStatus === "CONFIRMED" &&
            terminalConfig
          ? terminalNodeDetails(str(n.properties.qualifiedName), terminalConfig)
          : null;
    node(n.nodeId, n.nodeType, { ...n.properties, ...terminal });
  }
  const taskNode = `task:${taskId}`;
  node(taskNode, "TASK", {
    coverageStatus: p.coverageStatus,
    coverageDisposition: p.coverageDisposition,
    taskCategory: p.taskCategory,
    coverageExpectation:
      p.coverageDisposition === "EXPECTED_SCHEDULE_REFERENCE"
        ? "SCHEDULE_REFERENCE_ONLY"
        : p.coverageDisposition === "MATERIAL_GAP"
          ? "MATERIAL_GAP"
          : "DATA_LINEAGE",
  });
  for (const read of p.localClosure?.externalReads ?? [])
    edge(read.datasetNodeId, taskNode, "READS_TABLE", "table", {
      readOccurrenceId: read.readOccurrenceId,
      ...terminalReads.get(read.readOccurrenceId),
    });
  for (const write of p.localClosure?.finalWrites ?? []) {
    const outputQualification = write.outputQualification;
    edge(taskNode, write.datasetNodeId, "WRITES_TABLE", "table", {
      writeObservationId: write.writeObservationId,
      ...(outputQualification
        ? {
            outputQualification,
            status:
              outputQualification === "PLATFORM_TARGET"
                ? "CONFIRMED"
                : "CANDIDATE",
          }
        : {}),
    });
  }
  const writePort = (target: string, column: string) => {
    const props = originals.get(target)?.properties ?? {};
    const id = portId("write-field", target, column);
    node(id, "WRITE_FIELD", { ...props, column });
    if (!writes.some((w) => w.id === id))
      writes.push({
        id,
        writeId: str(props.writeObservationId),
        column: column.toLowerCase(),
        table: str(props.qualifiedName).toLowerCase(),
      });
    edge(target, id, "HAS_FIELD", "catalog");
    return id;
  };
  for (const binding of bindings) {
    const write = p.localClosure?.finalWrites.find(
      (w) => w.writeObservationId === binding.write_observation_id,
    );
    if (write && str(binding.target_field))
      writePort(write.targetWriteNodeId, str(binding.target_field));
  }
  for (const e of p.edges) {
    if (e.edgeType === "FIELD_DIRECT" || e.edgeType === "FIELD_CONDITIONAL") {
      const source = originals.get(e.fromNodeId),
        column = str(source?.properties.column),
        output = str(e.properties.outputColumn);
      if (!column || !output) continue;
      const target = writePort(e.toNodeId, output);
      const occurrence = str(e.properties.sourceReadOccurrenceId);
      let from = e.fromNodeId;
      if (
        occurrence &&
        e.properties.sourceReadOccurrenceStatus === "RESOLVED"
      ) {
        from = portId("read-field", `${taskId}:${occurrence}`, column);
        node(from, "READ_FIELD", {
          ...source?.properties,
          occurrenceId: occurrence,
          column,
          ...terminalReads.get(occurrence),
          ...(terminalReads.has(occurrence)
            ? {
                partitionPredicates:
                  originals.get(
                    (p.localClosure?.externalReads ?? []).find(
                      (r) => r.readOccurrenceId === occurrence,
                    )?.readOccurrenceNodeId ?? "",
                  )?.properties.partitionPredicates ?? [],
              }
            : {}),
        });
        if (!reads.some((r) => r.id === from))
          reads.push({ id: from, occurrence, column: column.toLowerCase() });
        edge(e.fromNodeId, from, "OBSERVED_FIELD", "catalog");
      }
      edge(
        from,
        target,
        e.edgeType === "FIELD_DIRECT" ? "VALUE" : "CONDITION",
        "field",
        { ...e.properties, sourceColumn: column },
        e.edgeId,
      );
    } else
      edge(
        e.fromNodeId,
        e.toNodeId,
        e.edgeType,
        e.edgeType === "DATASET_CONTROL" ? "control" : "catalog",
        e.properties,
        e.edgeId,
      );
  }
  return {
    taskId,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    reads,
    writes,
  };
}
