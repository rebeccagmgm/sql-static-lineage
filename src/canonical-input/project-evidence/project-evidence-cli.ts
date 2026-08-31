import { basename, resolve } from "node:path";

import { safeSegment } from "../../contracts/runtime.ts";
import {
  runDirectProjectTopology,
  type DirectProjectTopologyOptions,
} from "./direct-project-topology.ts";

export function parseProjectEvidenceCli(
  args: readonly string[],
): DirectProjectTopologyOptions {
  let projectKey: string | null = null;
  let outputRoot: string | null = null;
  let maxRoots = 32;
  let maxSourceBytesPerFile = 256 * 1024 * 1024;
  let maxTotalSourceBytes = 1024 * 1024 * 1024;
  let maxNodes = 100_000;
  let maxEdges = 250_000;
  let maxDepth: number | undefined;
  let maxTasksPerRoot: number | undefined;
  let maxEdgesPerRoot: number | undefined;
  let maxUnionTasks: number | undefined;
  let maxRounds: number | undefined;
  const roots: Array<{
    rootTaskId: string;
    oneHopPath?: string;
    multiHopPath?: string;
  }> = [];
  let current: (typeof roots)[number] | null = null;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    const value = (): string => {
      const next = args[index + 1];
      if (!next) throw new Error(`OPTION_VALUE_MISSING:${arg}`);
      index += 1;
      return next;
    };
    if (arg === "--project-key") projectKey = value();
    else if (arg === "--output-root") outputRoot = value();
    else if (arg === "--root-task-id") {
      current = { rootTaskId: safeSegment(value(), "rootTaskId") };
      roots.push(current);
    } else if (arg === "--one-hop") {
      if (!current) throw new Error("ONE_HOP_WITHOUT_ROOT");
      current.oneHopPath = resolve(value());
    } else if (arg === "--multi-hop") {
      if (!current) throw new Error("MULTI_HOP_WITHOUT_ROOT");
      current.multiHopPath = resolve(value());
    } else if (arg === "--max-roots") maxRoots = integer(value(), arg);
    else if (arg === "--max-source-bytes-per-file")
      maxSourceBytesPerFile = integer(value(), arg);
    else if (arg === "--max-total-source-bytes")
      maxTotalSourceBytes = integer(value(), arg);
    else if (arg === "--max-nodes") maxNodes = integer(value(), arg);
    else if (arg === "--max-edges") maxEdges = integer(value(), arg);
    else if (arg === "--max-depth") maxDepth = integer(value(), arg);
    else if (arg === "--max-tasks-per-root")
      maxTasksPerRoot = integer(value(), arg);
    else if (arg === "--max-edges-per-root")
      maxEdgesPerRoot = integer(value(), arg);
    else if (arg === "--max-union-tasks") maxUnionTasks = integer(value(), arg);
    else if (arg === "--max-rounds") maxRounds = integer(value(), arg);
    else throw new Error(`UNKNOWN_OPTION:${arg}`);
  }
  if (!projectKey || !outputRoot || roots.length === 0)
    throw new Error(usage());
  if (roots.length > maxRoots)
    throw new Error("PROJECT_EVIDENCE_MAX_ROOTS_REACHED");
  return {
    projectKey: safeSegment(projectKey, "projectKey"),
    outputRoot: resolve(outputRoot),
    roots: roots.map((root) => {
      if (!root.oneHopPath || !root.multiHopPath)
        throw new Error(`ROOT_ARTIFACT_PAIR_INCOMPLETE:${root.rootTaskId}`);
      return {
        rootTaskId: root.rootTaskId,
        oneHopPath: root.oneHopPath,
        multiHopPath: root.multiHopPath,
      };
    }),
    maxRoots,
    maxSourceBytesPerFile,
    maxTotalSourceBytes,
    maxNodes,
    maxEdges,
    ...(maxDepth === undefined ? {} : { maxDepth }),
    ...(maxTasksPerRoot === undefined ? {} : { maxTasksPerRoot }),
    ...(maxEdgesPerRoot === undefined ? {} : { maxEdgesPerRoot }),
    ...(maxUnionTasks === undefined ? {} : { maxUnionTasks }),
    ...(maxRounds === undefined ? {} : { maxRounds }),
  };
}

export function runProjectEvidenceCli(args: readonly string[]): void {
  const result = runDirectProjectTopology(parseProjectEvidenceCli(args));
  process.stdout.write(
    `${JSON.stringify({
      status: "COMPLETE",
      sourceMode: result.source.sourceMode,
      sourceId: result.source.sourceId,
      contentHash: result.source.contentHash,
      evidenceDirectory: result.published.directory,
      graphDirectory: result.graph.directory,
      coverageStatus: result.graph.manifest.coverageStatus,
      counts: result.counters,
    })}\n`,
  );
}

function integer(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new Error(`OPTION_INVALID:${option}`);
  return parsed;
}

function usage(): string {
  return "usage: project-evidence --project-key <key> --output-root <dir> --root-task-id <id> --one-hop <one-hop.json> --multi-hop <multi-hop.json> [repeat root triple] [limits]";
}

if (process.argv[1] && basename(process.argv[1]) === "project-evidence-cli.ts")
  runProjectEvidenceCli(process.argv.slice(2));
