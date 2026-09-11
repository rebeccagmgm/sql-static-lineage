import { TRACE_EDGE_LIMIT } from "./graph-limits";
import type {
  Anchor,
  Direction,
  GraphLayer,
  GraphNode,
  TaskDetail,
  TraceResult,
  OverviewResult,
  RegionResult,
} from "./types";
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function get<T>(
  path: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== "") q.set(k, String(v));
  const response = await fetch(`/api/${path}?${q}`);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError("服务返回了无法读取的响应", response.status);
  }
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? String(body.error)
        : "查询失败";
    throw new ApiError(message, response.status);
  }
  return body as T;
}
export const api = {
  status: () => get<Record<string, unknown>>("status"),
  overview: () => get<OverviewResult>("overview"),
  region: (schema: string, offset = 0, limit = 50) =>
    get<RegionResult>("regions", { schema, offset, limit }),
  search: (q: string, offset = 0, limit = 31) =>
    get<GraphNode[]>("search", { q, offset, limit }),
  fields: (a: Anchor, offset = 0, limit = 101) =>
    get<GraphNode[]>(
      "fields",
      a.nodeId
        ? { nodeId: a.nodeId, offset, limit }
        : a.taskId
          ? { taskId: a.taskId, offset, limit }
          : { table: a.table, offset, limit },
    ),
  trace: (
    i: Anchor & {
      layer: GraphLayer;
      direction: Direction;
      depth: number;
      includeCandidates: boolean;
    },
  ) =>
    get<TraceResult>("trace", {
      taskId: i.taskId,
      table: i.table,
      nodeId: i.nodeId,
      column: i.column,
      writeId: i.writeId,
      layer: i.layer,
      direction: i.direction,
      depth: i.depth,
      depthUnit: "table-hop",
      limit: TRACE_EDGE_LIMIT,
      candidates: i.includeCandidates ? 1 : 0,
    }),
  task: (
    taskId: string,
    i: { column?: string; writeId?: string; sql?: boolean } = {},
  ) =>
    get<TaskDetail>("task", {
      taskId,
      column: i.column,
      writeId: i.writeId,
      sql: i.sql ? 1 : undefined,
    }),
};
