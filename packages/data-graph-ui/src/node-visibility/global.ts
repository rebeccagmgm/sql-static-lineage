import type { Edge, Node } from "@xyflow/react";
import type { LineageNodeData } from "../graph-adapter";
export { normalizeHiddenTables } from "../../../data-graph/src/asset-graph/node-visibility";
import { normalizeHiddenTables } from "../../../data-graph/src/asset-graph/node-visibility";

export const STORAGE_KEY = "data-graph.hidden-tables.v1";
export function readHiddenTables(): string[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? ["dm_index_n.grp_def"] : normalizeHiddenTables(JSON.parse(raw));
}

export function hideTableCards<N extends Node, E extends Edge>(nodes: N[], edges: E[], tables: string[]) {
  const rules = new Set(tables);
  const hidden = new Set(nodes.filter(node => {
    const data = node.data as LineageNodeData;
    const members = data.members ?? (data.raw ? [data.raw] : []);
    return members.length > 0 && members.every(member => member.kind !== "TASK" && rules.has(String(member.table ?? member.metadata?.identity?.qualifiedName ?? "").toLowerCase()));
  }).map(node => node.id));
  return {
    nodes: nodes.map(node => ({ ...node, hidden: Boolean(node.hidden || hidden.has(node.id)) })),
    edges: edges.map(edge => ({ ...edge, hidden: Boolean(edge.hidden || hidden.has(edge.source) || hidden.has(edge.target)) })),
  };
}
