import type { GraphEdge, GraphNode, TraceResult } from "./types";

export const COMBINED_EDGE_LIMIT = 150;

export function shouldFallbackToDepthOne(
  result: TraceResult,
  requestedDepth: number,
) {
  return (
    requestedDepth > 1 && result.truncated && result.stoppedBy === "EDGE_LIMIT"
  );
}

export async function loadAllFieldPages(input: {
  fetchPage: (offset: number, limit: number) => Promise<GraphNode[]>;
  readVersion: () => Promise<string>;
  isCurrent: () => boolean;
  pageSize?: number;
}): Promise<GraphNode[]> {
  const version = await input.readVersion();
  if (!version) throw new Error("图谱版本不可用，请稍后重试。");
  const pageSize = input.pageSize ?? 300;
  const fields: GraphNode[] = [];
  let offset = 0;
  while (true) {
    const page = await input.fetchPage(offset, pageSize + 1);
    if (!input.isCurrent()) throw new Error("STALE_FIELD_LIST_QUERY");
    fields.push(...page.slice(0, pageSize));
    if (page.length <= pageSize) {
      const finalVersion = await input.readVersion();
      if (!input.isCurrent()) throw new Error("STALE_FIELD_LIST_QUERY");
      if (version !== finalVersion)
        throw new Error("字段加载期间图谱已换版，请重新加载字段。");
      return fields;
    }
    offset += pageSize;
  }
}

function edgeIdentity(edge: GraphEdge, index: number): string {
  return (
    edge.id ??
    edge.key ??
    `${edge.from}|${edge.to}|${edge.kind}|${edge.status ?? ""}|${index}`
  );
}

function reachableEdges(rootId: string, result: TraceResult): GraphEdge[] {
  const visited = new Set([rootId]);
  const pending = result.edges.map((edge, index) => ({ edge, index }));
  const ordered: GraphEdge[] = [];
  while (pending.length) {
    let progressed = false;
    for (let index = 0; index < pending.length;) {
      const candidate = pending[index]!;
      const touches =
        result.direction === "up"
          ? visited.has(candidate.edge.to)
          : visited.has(candidate.edge.from);
      if (!touches) {
        index += 1;
        continue;
      }
      ordered.push(candidate.edge);
      visited.add(
        result.direction === "up" ? candidate.edge.from : candidate.edge.to,
      );
      pending.splice(index, 1);
      progressed = true;
    }
    if (!progressed) break;
  }
  return ordered;
}

export async function collectMultiFieldTrace(input: {
  roots: GraphNode[];
  fetchTrace: (root: GraphNode) => Promise<TraceResult>;
  isCurrent: () => boolean;
  edgeLimit?: number;
}): Promise<TraceResult> {
  const roots = input.roots;
  if (!roots.length) throw new Error("NO_FIELDS_SELECTED");
  const edgeLimit = input.edgeLimit ?? COMBINED_EDGE_LIMIT;
  const nodes = new Map<string, GraphNode>(
    roots.map((root) => [root.id, { ...root, depth: 0 }]),
  );
  const edges = new Map<string, GraphEdge>();
  const terminalNodes = new Map<string, TraceResult["terminalNodes"][number]>();
  const frontier = new Set<string>();
  let version: string | undefined;
  let template: TraceResult | undefined;
  let elapsedMs = 0;
  let truncated = false;
  let queried = 0;

  for (const root of roots) {
    if (!input.isCurrent()) throw new Error("STALE_MULTI_FIELD_QUERY");
    if (edges.size >= edgeLimit) {
      truncated = true;
      break;
    }
    const result = await input.fetchTrace(root);
    if (!input.isCurrent()) throw new Error("STALE_MULTI_FIELD_QUERY");
    queried += 1;
    template ??= result;
    elapsedMs += result.elapsedMs;
    if (version !== undefined && result.version !== version)
      throw new Error("ASSET_GRAPH_CHANGED_DURING_MULTI_FIELD_QUERY");
    version = result.version;
    for (const edge of reachableEdges(root.id, result)) {
      const identity = edgeIdentity(edge, edges.size);
      if (edges.has(identity)) continue;
      if (edges.size >= edgeLimit) {
        truncated = true;
        break;
      }
      edges.set(identity, edge);
    }
    const connectedIds = new Set<string>([root.id]);
    for (const edge of edges.values()) {
      connectedIds.add(edge.from);
      connectedIds.add(edge.to);
    }
    for (const node of result.nodes)
      if (connectedIds.has(node.id) && !nodes.has(node.id))
        nodes.set(node.id, node);
    for (const terminal of result.terminalNodes)
      if (connectedIds.has(terminal.nodeId))
        terminalNodes.set(terminal.nodeId, terminal);
    for (const id of result.frontierNodeIds)
      if (connectedIds.has(id)) frontier.add(id);
    truncated ||= result.truncated;
  }
  if (!template || !version) throw new Error("MULTI_FIELD_QUERY_DID_NOT_START");
  truncated ||= queried < roots.length;
  return {
    ...template,
    version,
    edgeLimit,
    truncated,
    stoppedBy: truncated ? "EDGE_LIMIT" : template.stoppedBy,
    frontierNodeIds: [...frontier],
    terminalNodes: [...terminalNodes.values()],
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    elapsedMs,
  };
}
