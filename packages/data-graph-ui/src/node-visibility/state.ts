import type { Edge, Node } from "@xyflow/react";

export function appendHiddenBatch(history: string[][], ids: string[]): string[][] {
  const hidden = new Set(history.flat());
  const batch = [...new Set(ids)].filter(id => !hidden.has(id));
  return batch.length ? [...history, batch] : history;
}

export function projectVisibility<N extends Node, E extends Edge>(
  nodes: N[], edges: E[], history: string[][], selected: string[],
) {
  const hidden = new Set(history.flat());
  const selection = new Set(selected);
  return {
    nodes: nodes.map(node => ({ ...node,
      hidden: Boolean(node.hidden || hidden.has(node.id)),
      selected: !hidden.has(node.id) && selection.has(node.id),
    })),
    edges: edges.map(edge => ({ ...edge,
      hidden: Boolean(edge.hidden || hidden.has(edge.source) || hidden.has(edge.target)),
    })),
    hiddenCount: nodes.filter(node => hidden.has(node.id)).length,
  };
}
