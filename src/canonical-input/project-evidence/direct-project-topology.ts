import { buildProjectTopology } from "../../project-graph/topology/project-topology-projector.ts";
import {
  publishProjectTopology,
  type PublishProjectTopologyResult,
} from "../../project-graph/topology/project-topology-publication.ts";
import {
  loadDirectProjectTopologySources,
  loadProjectTopologySources,
  type ProjectTopologyRootInput,
} from "../../project-graph/topology/project-topology-source.ts";
import {
  buildProjectEvidenceSourceDescriptor,
  type ProjectEvidenceLimits,
  type ProjectEvidenceSourceDescriptorV1,
} from "./project-evidence-contract.ts";
import {
  publishProjectEvidenceArtifact,
  type PublishProjectEvidenceArtifactResult,
} from "./project-evidence-publication.ts";

export interface DirectProjectTopologyOptions {
  readonly projectKey: string;
  readonly roots: readonly ProjectTopologyRootInput[];
  readonly outputRoot: string;
  readonly maxRoots?: number;
  readonly maxSourceBytesPerFile?: number;
  readonly maxTotalSourceBytes?: number;
  readonly maxNodes?: number;
  readonly maxEdges?: number;
  readonly maxDepth?: number;
  readonly maxTasksPerRoot?: number;
  readonly maxEdgesPerRoot?: number;
  readonly maxUnionTasks?: number;
  readonly maxRounds?: number;
}

export interface DirectProjectTopologyCounters {
  readonly canonicalArtifactRoots: number;
  readonly canonicalArtifactBytes: number;
  readonly graphNodes: number;
  readonly graphEdges: number;
}

export interface DirectProjectTopologyRunResult {
  readonly source: ProjectEvidenceSourceDescriptorV1;
  readonly published: PublishProjectEvidenceArtifactResult;
  readonly graph: PublishProjectTopologyResult;
  readonly roots: ReturnType<typeof loadProjectTopologySources>;
  readonly counters: DirectProjectTopologyCounters;
}

export function runDirectProjectTopology(
  options: DirectProjectTopologyOptions,
): DirectProjectTopologyRunResult {
  const roots = loadProjectTopologySources(options.roots, {
    maxRoots: options.maxRoots,
    maxSourceBytesPerFile: options.maxSourceBytesPerFile,
    maxTotalSourceBytes: options.maxTotalSourceBytes,
  });
  const limits = projectEvidenceLimits(roots, options);
  const source = buildProjectEvidenceSourceDescriptor({
    projectKey: options.projectKey,
    roots: roots.map((root) => ({
      rootTaskId: root.source.rootTaskId,
      oneHop: root.oneHop,
      traversal: root.multiHop,
    })),
    limits,
  });
  const published = publishProjectEvidenceArtifact({
    outputRoot: options.outputRoot,
    projectKey: options.projectKey,
    source,
    roots: roots.map((root) => ({
      rootTaskId: root.source.rootTaskId,
      oneHop: root.oneHop,
      traversal: root.multiHop,
    })),
  });
  const directRoots = loadDirectProjectTopologySources({
    descriptor: source,
    roots: roots.map((root) => ({
      rootTaskId: root.source.rootTaskId,
      oneHop: root.oneHop,
      traversal: root.multiHop,
    })),
  });
  const projection = buildProjectTopology({
    projectKey: options.projectKey,
    roots: directRoots,
    maxNodes: options.maxNodes,
    maxEdges: options.maxEdges,
  });
  const graph = publishProjectTopology(projection, {
    outputRoot: options.outputRoot,
  });
  return {
    source,
    published,
    graph,
    roots,
    counters: {
      canonicalArtifactRoots: roots.length,
      canonicalArtifactBytes: roots.reduce(
        (total, root) =>
          total +
          Buffer.byteLength(JSON.stringify(root.oneHop)) +
          Buffer.byteLength(JSON.stringify(root.multiHop)),
        0,
      ),
      graphNodes: graph.manifest.counts.nodes,
      graphEdges: graph.manifest.counts.edges,
    },
  };
}

function projectEvidenceLimits(
  roots: readonly ReturnType<typeof loadProjectTopologySources>[number][],
  options: DirectProjectTopologyOptions,
): ProjectEvidenceLimits {
  const maxDepth =
    options.maxDepth ??
    Math.max(...roots.map((root) => root.multiHop.limits.maxDepth));
  const maxTasksPerRoot =
    options.maxTasksPerRoot ??
    Math.max(...roots.map((root) => root.multiHop.limits.maxTasks));
  const maxEdgesPerRoot =
    options.maxEdgesPerRoot ??
    Math.max(...roots.map((root) => root.multiHop.limits.maxEdges));
  const maxRoots = options.maxRoots ?? roots.length;
  const maxUnionTasks =
    options.maxUnionTasks ??
    Math.max(
      roots.length,
      roots.reduce((total, root) => total + root.multiHop.taskNodes.length, 0),
    );
  const maxRounds = options.maxRounds ?? 1;
  return {
    maxRoots,
    maxDepth,
    maxTasksPerRoot,
    maxEdgesPerRoot,
    maxUnionTasks,
    maxRounds,
  };
}
