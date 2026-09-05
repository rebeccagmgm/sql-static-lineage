import {
  explainTopologyEdgeFromProjection,
  getProjectTopologyFromProjection,
  traceProjectUpstreamFromProjection,
  type GetProjectTopologyOptions,
  type TraceProjectUpstreamOptions,
} from "../query/project-topology-query.ts";
import {
  loadIndexedProjectTopology,
  type QueryIndexExpectedSource,
} from "./query-index-query-source.ts";

export async function getIndexedProjectTopology(
  input: QueryIndexExpectedSource,
  options: GetProjectTopologyOptions = {},
): Promise<ReturnType<typeof getProjectTopologyFromProjection>> {
  return getProjectTopologyFromProjection(
    await loadIndexedProjectTopology(input),
    options,
  );
}

export async function traceIndexedProjectUpstream(
  input: QueryIndexExpectedSource,
  options: TraceProjectUpstreamOptions,
): Promise<ReturnType<typeof traceProjectUpstreamFromProjection>> {
  return traceProjectUpstreamFromProjection(
    await loadIndexedProjectTopology(input),
    options,
  );
}

export async function explainIndexedTopologyEdge(
  input: QueryIndexExpectedSource,
  edgeId: string,
): Promise<ReturnType<typeof explainTopologyEdgeFromProjection>> {
  return explainTopologyEdgeFromProjection(
    await loadIndexedProjectTopology(input),
    edgeId,
  );
}
