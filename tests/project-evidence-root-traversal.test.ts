import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  writeTableInput,
  writeTaskInput,
} from "../scripts/input/shared/input-pack.ts";
import { runProjectInputPackClosure } from "../scripts/pipeline/input-pack-closure.ts";
import { parseProjectEvidenceCli } from "../scripts/project-graph/project-evidence/project-evidence-cli.ts";
import { runDirectProjectTopology } from "../scripts/project-graph/project-evidence/direct-project-topology.ts";
import {
  reconcileOneHopBatch,
  type ReconcileOneHopOptions,
} from "../scripts/reconcile/consumer/one-hop/reconcile-one-hop.ts";

const FIXED_NOW = "2026-08-29T00:00:00.000Z";

function temporaryDirectory(label: string): string {
  return mkdtempSync(join(tmpdir(), `${label}-`));
}

function writeTable(root: string, qualifiedName: string): void {
  const [schema, name] = qualifiedName.split(".");
  writeTableInput(root, {
    platform: "hive",
    dataSource: "gfhive",
    qualifiedName,
    schema,
    name,
    objectType: "TABLE",
    ddl: `CREATE TABLE ${qualifiedName} (id bigint)`,
    evidenceProvider: "fixture:table",
    collectedAt: FIXED_NOW,
  });
}

function writeTask(
  root: string,
  taskId: string,
  target: string,
  source: string,
): void {
  writeTaskInput(root, {
    taskId,
    taskCategory: "hiveTask-2.0",
    collectedAt: FIXED_NOW,
    evidenceProvider: "fixture:task",
    target: {
      platform: "hive",
      dataSource: "gfhive",
      qualifiedName: target,
    },
    targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
    writeMode: "OVERWRITE",
    sql: {
      query: {
        content: `INSERT OVERWRITE TABLE ${target} SELECT id FROM ${source}`,
        evidenceProvider: "fixture:sql",
      },
    },
  });
}

function sharedInputPack(): string {
  const root = temporaryDirectory("project-evidence-input-pack");
  for (const table of [
    "dm.root_a",
    "dm.root_b",
    "dm.shared",
    "pdata_n.ref_source_table",
  ])
    writeTable(root, table);
  writeTask(root, "root-a", "dm.root_a", "dm.shared");
  writeTask(root, "root-b", "dm.root_b", "dm.shared");
  writeTask(root, "shared-producer", "dm.shared", "pdata_n.ref_source_table");
  return root;
}

function terminalConfig() {
  return {
    version: "fixture-v1",
    stopRoles: ["REFERENCE_CONFIG"],
    roles: {
      REFERENCE_CONFIG: {
        qualifiedNameExact: ["pdata_n.ref_source_table"],
        qualifiedNameTerms: ["ref_source_table"],
      },
    },
  } as const;
}

describe("shared project Input Pack closure", () => {
  it("evaluates a shared Task's SQL reads once while retaining both root memberships", () => {
    const dataRoot = sharedInputPack();
    const result = runProjectInputPackClosure({
      rootTaskIds: ["root-a", "root-b"],
      dataRoot,
      producerIndexCacheRoot: join(
        dirname(dataRoot),
        `${dataRoot.split(/[\\/]/).at(-1)}-producer-index-cache`,
      ),
      maxDepth: 5,
      maxTasksPerRoot: 20,
      maxUnionTasks: 30,
      maxRounds: 8,
      terminalTableConfig: terminalConfig(),
    });

    expect(result.status).toBe("COMPLETE");
    expect(result.taskIds).toEqual(["root-a", "root-b", "shared-producer"]);
    expect(result.roots).toEqual([
      expect.objectContaining({
        rootTaskId: "root-a",
        taskIds: ["root-a", "shared-producer"],
      }),
      expect.objectContaining({
        rootTaskId: "root-b",
        taskIds: ["root-b", "shared-producer"],
      }),
    ]);
    expect(result.counters).toMatchObject({
      rootTaskOccurrences: 4,
      uniqueTasks: 3,
      taskReadsEvaluated: 3,
      discoveryQueries: 0,
      collectionBatches: 0,
    });
  });
});

describe("direct project topology orchestration", () => {
  it("prepares union evidence once, publishes no task artifacts, and reuses the snapshot", async () => {
    const dataRoot = sharedInputPack();
    const outputRoot = temporaryDirectory("project-evidence-output");
    const oneHopCacheRoot = join(outputRoot, "one-hop-cache");
    const terminalConfigPath = join(outputRoot, "terminal-config.json");
    writeFileSync(
      terminalConfigPath,
      `${JSON.stringify(terminalConfig(), null, 2)}\n`,
      "utf8",
    );
    let schedulePrefetchCalls = 0;
    let oneHopBatchCalls = 0;
    const schedulePrefetch = async (taskIds: readonly string[]) => {
      schedulePrefetchCalls += 1;
      return new Map(
        taskIds.map((taskId) => [
          taskId,
          {
            rows: [],
            provider: "opencli:horae.relation" as const,
            locator: `fixture:schedule:${taskId}`,
            observedAt: FIXED_NOW,
          },
        ]),
      );
    };
    const options = {
      projectKey: "shared-project",
      rootTaskIds: ["root-a", "root-b"],
      dataRoot,
      outputRoot,
      oneHopCacheRoot,
      terminalTableConfigPath: terminalConfigPath,
      limits: {
        maxRoots: 4,
        maxDepth: 5,
        maxTasksPerRoot: 20,
        maxEdgesPerRoot: 100,
        maxUnionTasks: 30,
        maxRounds: 8,
      },
      dependencies: {
        schedulePrefetch,
        oneHopBatch: (
          taskIds: readonly string[],
          oneHopOptions: ReconcileOneHopOptions,
        ) => {
          oneHopBatchCalls += 1;
          return reconcileOneHopBatch(taskIds, oneHopOptions);
        },
      },
    } as const;
    const first = await runDirectProjectTopology(options);
    const second = await runDirectProjectTopology(options);

    expect(schedulePrefetchCalls).toBe(2);
    expect(oneHopBatchCalls).toBe(1);
    expect(first.counters).toMatchObject({
      rootTaskOccurrences: 4,
      uniqueTasks: 3,
      stableTraversalTasks: 3,
      sharedTaskOccurrencesSaved: 1,
      worksetRounds: 1,
      machineFactsCalls: 1,
      machineFactsTasks: 3,
      machineFactsCacheHits: 0,
      machineFactsComputedTasks: 3,
      schedulePrefetchCalls: 1,
      schedulePrefetchTasks: 3,
      oneHopBatchCalls: 1,
      oneHopTasks: 3,
      oneHopCacheHits: 0,
      oneHopComputedTasks: 3,
      rootTraversalCalls: 2,
      rootTraversalRounds: 1,
    });
    expect(second.counters).toMatchObject({
      machineFactsCacheHits: 3,
      machineFactsComputedTasks: 0,
      oneHopBatchCalls: 0,
      oneHopCacheHits: 3,
      oneHopCacheMisses: 0,
      oneHopComputedTasks: 0,
    });
    expect(first.source).toMatchObject({
      sourceMode: "DIRECT_PROJECT_EVIDENCE",
      projectKey: "shared-project",
    });
    expect(first.published.manifest).toMatchObject({
      artifactType: "PROJECT_EVIDENCE_BUNDLE",
      roots: expect.arrayContaining([
        expect.objectContaining({ rootTaskId: "root-a" }),
        expect.objectContaining({ rootTaskId: "root-b" }),
      ]),
    });
    expect(existsSync(join(dataRoot, "artifacts", "tasks"))).toBe(false);
    expect(second.published.status).toBe("REUSED");
    expect(second.published.directory).toBe(first.published.directory);
    expect(
      readFileSync(join(first.published.directory, "manifest.json"), "utf8"),
    ).toBe(
      readFileSync(join(second.published.directory, "manifest.json"), "utf8"),
    );

    const corruptedPath = join(
      oneHopCacheRoot,
      "tasks",
      "root-a",
      "one-hop.json",
    );
    writeFileSync(corruptedPath, "{corrupt", "utf8");
    const third = await runDirectProjectTopology(options);
    expect(oneHopBatchCalls).toBe(2);
    expect(third.counters).toMatchObject({
      oneHopCacheHits: 2,
      oneHopCacheMisses: 1,
      oneHopCacheInvalidEntries: 1,
      oneHopComputedTasks: 1,
      oneHopCacheWrites: 1,
    });
    expect(third.published.status).toBe("REUSED");
  });

  it("recomputes only the Task whose schedule rows changed", async () => {
    const dataRoot = sharedInputPack();
    const outputRoot = temporaryDirectory("project-evidence-selective-cache");
    const oneHopCacheRoot = join(outputRoot, "one-hop-cache");
    const terminalConfigPath = join(outputRoot, "terminal-config.json");
    writeFileSync(terminalConfigPath, JSON.stringify(terminalConfig()), "utf8");
    let rootRevision = 1;
    const computedBatches: string[][] = [];
    const options = {
      projectKey: "selective-cache-project",
      rootTaskIds: ["root-a", "root-b"],
      dataRoot,
      outputRoot,
      oneHopCacheRoot,
      terminalTableConfigPath: terminalConfigPath,
      limits: {
        maxRoots: 2,
        maxDepth: 5,
        maxTasksPerRoot: 20,
        maxEdgesPerRoot: 100,
        maxUnionTasks: 30,
        maxRounds: 8,
      },
      dependencies: {
        schedulePrefetch: async (taskIds: readonly string[]) =>
          new Map(
            taskIds.map((taskId) => [
              taskId,
              {
                rows:
                  taskId === "root-a"
                    ? [
                        {
                          task_id: "shared-producer",
                          task_name: "shared producer",
                          direction: "上游",
                          revision: rootRevision,
                        },
                      ]
                    : [],
                provider: "opencli:horae.relation" as const,
                locator: `fixture:schedule:${taskId}`,
                observedAt: FIXED_NOW,
              },
            ]),
          ),
        oneHopBatch: (
          taskIds: readonly string[],
          oneHopOptions: ReconcileOneHopOptions,
        ) => {
          computedBatches.push([...taskIds]);
          return reconcileOneHopBatch(taskIds, oneHopOptions);
        },
      },
    } as const;

    const first = await runDirectProjectTopology(options);
    rootRevision = 2;
    const second = await runDirectProjectTopology(options);

    expect(first.counters.oneHopComputedTasks).toBe(3);
    expect(second.counters).toMatchObject({
      oneHopCacheHits: 2,
      oneHopCacheMisses: 1,
      oneHopComputedTasks: 1,
    });
    expect(computedBatches).toEqual([
      ["root-a", "root-b", "shared-producer"],
      ["root-a"],
    ]);
  });

  it("keeps per-root truncation as a published partial boundary", async () => {
    const dataRoot = sharedInputPack();
    const outputRoot = temporaryDirectory("project-evidence-partial");
    const oneHopCacheRoot = join(outputRoot, "one-hop-cache");
    const terminalConfigPath = join(outputRoot, "terminal-config.json");
    writeFileSync(terminalConfigPath, JSON.stringify(terminalConfig()), "utf8");
    const result = await runDirectProjectTopology({
      projectKey: "partial-project",
      rootTaskIds: ["root-a", "root-b"],
      dataRoot,
      outputRoot,
      oneHopCacheRoot,
      terminalTableConfigPath: terminalConfigPath,
      limits: {
        maxRoots: 2,
        maxDepth: 5,
        maxTasksPerRoot: 1,
        maxEdgesPerRoot: 100,
        maxUnionTasks: 30,
        maxRounds: 8,
      },
      dependencies: {
        schedulePrefetch: async (taskIds) =>
          new Map(
            taskIds.map((taskId) => [
              taskId,
              {
                rows: [],
                provider: "opencli:horae.relation" as const,
                locator: `fixture:schedule:${taskId}`,
                observedAt: FIXED_NOW,
              },
            ]),
          ),
      },
    });
    expect(
      result.roots.some((root) => root.coverage.status === "PARTIAL_EVIDENCE"),
    ).toBe(true);
    expect(result.roots.every((root) => root.limits.truncated)).toBe(true);
    expect(
      result.roots.flatMap((root) => root.terminals.map((item) => item.reason)),
    ).toContain("MAX_TASKS_REACHED");
  });

  it("fails before publication when the final Input Pack fingerprint drifts", async () => {
    const dataRoot = sharedInputPack();
    const outputRoot = temporaryDirectory("project-evidence-drift");
    const oneHopCacheRoot = join(outputRoot, "one-hop-cache");
    const terminalConfigPath = join(outputRoot, "terminal-config.json");
    writeFileSync(terminalConfigPath, JSON.stringify(terminalConfig()), "utf8");
    await expect(
      runDirectProjectTopology({
        projectKey: "drift-project",
        rootTaskIds: ["root-a"],
        dataRoot,
        outputRoot,
        oneHopCacheRoot,
        terminalTableConfigPath: terminalConfigPath,
        limits: {
          maxRoots: 1,
          maxDepth: 5,
          maxTasksPerRoot: 20,
          maxEdgesPerRoot: 100,
          maxUnionTasks: 30,
          maxRounds: 8,
        },
        dependencies: {
          schedulePrefetch: async (taskIds) =>
            new Map(
              taskIds.map((taskId) => [
                taskId,
                {
                  rows: [],
                  provider: "opencli:horae.relation" as const,
                  locator: `fixture:schedule:${taskId}`,
                  observedAt: FIXED_NOW,
                },
              ]),
            ),
          fingerprintInput: () => "0".repeat(64),
        },
      }),
    ).rejects.toThrow("INPUT_CHANGED_DURING_PROJECT_EVIDENCE");
    expect(existsSync(join(outputRoot, "projects"))).toBe(false);
  });
});

describe("project evidence CLI", () => {
  it("requires explicit roots, source paths, terminal config, and limits", () => {
    const parsed = parseProjectEvidenceCli([
      "--project-key",
      "fixture-project",
      "--root-task-ids",
      "176827,181058,209119",
      "--data-root",
      "input-pack",
      "--output-root",
      "project-graph",
      "--terminal-table-config",
      "terminal.json",
      "--max-roots",
      "3",
      "--max-depth",
      "25",
      "--max-tasks-per-root",
      "1000",
      "--max-edges-per-root",
      "10000",
      "--max-union-tasks",
      "2000",
      "--max-rounds",
      "28",
    ]);
    expect(parsed).toMatchObject({
      projectKey: "fixture-project",
      rootTaskIds: ["176827", "181058", "209119"],
      limits: { maxRoots: 3, maxDepth: 25, maxUnionTasks: 2000 },
    });
    expect(() =>
      parseProjectEvidenceCli([
        "--project-key",
        "fixture-project",
        "--root-task-id",
        "176827",
        "--data-root",
        "input-pack",
        "--output-root",
        "project-graph",
        "--terminal-table-config",
        "terminal.json",
      ]),
    ).toThrow("OPTION_REQUIRED:--max-roots");
  });
});
