import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { safeSegment } from "../../machine-facts/machine-facts-contract.ts";
import {
  runDirectProjectTopology,
  type DirectProjectTopologyOptions,
} from "./direct-project-topology.ts";

export interface ProjectEvidenceCliOptions extends DirectProjectTopologyOptions {}

const VALUE_OPTIONS = new Set([
  "--project-key",
  "--root-task-id",
  "--root-task-ids",
  "--data-root",
  "--output-root",
  "--facts-root",
  "--producer-index-cache-root",
  "--schedule-evidence-cache-root",
  "--one-hop-cache-root",
  "--terminal-table-config",
  "--max-roots",
  "--max-depth",
  "--max-tasks-per-root",
  "--max-edges-per-root",
  "--max-union-tasks",
  "--max-rounds",
]);

export function parseProjectEvidenceCli(
  args: readonly string[],
): ProjectEvidenceCliOptions {
  const values = new Map<string, string[]>();
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (!option || !VALUE_OPTIONS.has(option))
      throw new Error(`UNKNOWN_OPTION:${option ?? "MISSING"}`);
    if (!value || value.startsWith("--"))
      throw new Error(`OPTION_VALUE_MISSING:${option}`);
    const existing = values.get(option) ?? [];
    if (option !== "--root-task-id" && existing.length > 0)
      throw new Error(`DUPLICATE_OPTION:${option}`);
    existing.push(value);
    values.set(option, existing);
  }
  const one = (option: string): string => {
    const value = values.get(option)?.[0];
    if (!value) throw new Error(`OPTION_REQUIRED:${option}`);
    return value;
  };
  const roots = [
    ...(values.get("--root-task-id") ?? []),
    ...(values.get("--root-task-ids")?.[0]?.split(",") ?? []),
  ]
    .map((taskId) => taskId.trim())
    .filter(Boolean)
    .map((taskId) => safeSegment(taskId, "rootTaskId"));
  if (roots.length === 0 || new Set(roots).size !== roots.length)
    throw new Error("PROJECT_EVIDENCE_ROOTS_INVALID");
  const optionalPath = (option: string): string | undefined => {
    const value = values.get(option)?.[0];
    return value ? resolve(value) : undefined;
  };
  return {
    projectKey: safeSegment(one("--project-key"), "projectKey"),
    rootTaskIds: roots,
    dataRoot: resolve(one("--data-root")),
    outputRoot: resolve(one("--output-root")),
    terminalTableConfigPath: resolve(one("--terminal-table-config")),
    ...(optionalPath("--facts-root")
      ? { factsRoot: optionalPath("--facts-root") }
      : {}),
    ...(optionalPath("--producer-index-cache-root")
      ? { producerIndexCacheRoot: optionalPath("--producer-index-cache-root") }
      : {}),
    ...(optionalPath("--schedule-evidence-cache-root")
      ? {
          scheduleEvidenceCacheRoot: optionalPath(
            "--schedule-evidence-cache-root",
          ),
        }
      : {}),
    ...(optionalPath("--one-hop-cache-root")
      ? { oneHopCacheRoot: optionalPath("--one-hop-cache-root") }
      : {}),
    limits: {
      maxRoots: integer(one("--max-roots"), "--max-roots"),
      maxDepth: integer(one("--max-depth"), "--max-depth"),
      maxTasksPerRoot: integer(
        one("--max-tasks-per-root"),
        "--max-tasks-per-root",
      ),
      maxEdgesPerRoot: integer(
        one("--max-edges-per-root"),
        "--max-edges-per-root",
      ),
      maxUnionTasks: integer(one("--max-union-tasks"), "--max-union-tasks"),
      maxRounds: integer(one("--max-rounds"), "--max-rounds"),
    },
  };
}

export async function runProjectEvidenceCli(
  args: readonly string[],
): Promise<void> {
  const result = await runDirectProjectTopology(parseProjectEvidenceCli(args));
  process.stdout.write(
    `${JSON.stringify({
      status: result.published.status,
      sourceMode: "DIRECT_PROJECT_EVIDENCE",
      snapshotId: result.projection.snapshot.snapshotId,
      directory: result.published.directory,
      coverageStatus: result.projection.snapshot.coverageStatus,
      counts: result.published.manifest.counts,
      counters: result.counters,
      timingsMs: result.timingsMs,
    })}\n`,
  );
}

function integer(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new Error(`OPTION_INVALID:${option}`);
  return parsed;
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain)
  void runProjectEvidenceCli(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
