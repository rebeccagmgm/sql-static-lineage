import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  canonicalHash,
  writeTableInput,
  writeTaskInput,
  type JsonValue,
} from "../scripts/input/shared/input-pack.ts";
import { runProjectInputPackClosure } from "../scripts/pipeline/input-pack-closure.ts";
import { parseProjectEvidenceCli } from "../scripts/project-graph/project-evidence/project-evidence-cli.ts";
import {
  buildProjectEvidenceSourceDescriptor,
  stableProjectEvidenceHash,
} from "../scripts/project-graph/project-evidence/project-evidence-contract.ts";
import { runDirectProjectTopology } from "../scripts/project-graph/project-evidence/direct-project-topology.ts";
import {
  reconcileOneHopBatch,
  type ReconcileOneHopOptions,
} from "../scripts/reconcile/consumer/one-hop/reconcile-one-hop.ts";
import { traceProjectUpstream } from "../scripts/project-graph/query/project-topology-query.ts";
import {
  explainTopologyEdge,
  getProjectTopology,
} from "../scripts/project-graph/query/project-topology-query.ts";
import { taskNodeId } from "../scripts/project-graph/contracts/project-topology-contract.ts";
import { buildProjectTopology } from "../scripts/project-graph/topology/project-topology-projector.ts";
import { compareProjectRootTraversal } from "../scripts/project-graph/project-evidence/project-evidence-parity.ts";
import {
  loadDirectProjectTopologySources,
  loadProjectTopologySources,
} from "../scripts/project-graph/topology/project-topology-source.ts";
import {
  projectTopologyFixturePair,
  FIXTURE_INPUT_FINGERPRINT,
  FIXTURE_PRODUCER_INDEX_HASH,
} from "./fixtures/project-topology/cases.ts";

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

function descriptor(rootTaskIds: readonly string[]) {
  return buildProjectEvidenceSourceDescriptor({
    projectKey: "fixture-project",
    rootTaskIds,
    inputFingerprint: FIXTURE_INPUT_FINGERPRINT,
    producerIndexContentHash: FIXTURE_PRODUCER_INDEX_HASH,
    terminalConfig: {
      version: "fixture-v1",
      contentHash: "c".repeat(64),
      stopRoles: ["REFERENCE_CONFIG"],
    },
    scheduleEvidenceContentHash: "d".repeat(64),
    limits: {
      maxRoots: 8,
      maxDepth: 10,
      maxTasksPerRoot: 100,
      maxEdgesPerRoot: 500,
      maxUnionTasks: 200,
      maxRounds: 12,
    },
  });
}

function rehashTraversal<T extends { readonly contentHash: string }>(
  traversal: T,
): T {
  const { contentHash: _contentHash, ...body } = traversal;
  return {
    ...body,
    contentHash: canonicalHash(body as unknown as JsonValue, [
      "generatedAt",
      "contentHash",
    ]),
  } as T;
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

describe("direct project source contracts", () => {
  it("keeps direct identity stable across generation timestamps", () => {
    const firstPair = projectTopologyFixturePair({
      generatedAt: "2026-08-29T00:00:00.000Z",
    });
    const secondPair = projectTopologyFixturePair({
      generatedAt: "2026-08-29T00:00:01.000Z",
    });
    const source = descriptor(["root-1"]);
    const first = buildProjectTopology({
      projectKey: "fixture-project",
      roots: loadDirectProjectTopologySources({
        descriptor: source,
        roots: [
          {
            rootTaskId: "root-1",
            oneHop: firstPair.oneHop,
            traversal: firstPair.multiHop,
          },
        ],
      }),
    });
    const second = buildProjectTopology({
      projectKey: "fixture-project",
      roots: loadDirectProjectTopologySources({
        descriptor: source,
        roots: [
          {
            rootTaskId: "root-1",
            oneHop: secondPair.oneHop,
            traversal: secondPair.multiHop,
          },
        ],
      }),
    });
    expect(first.snapshot.snapshotId).toBe(second.snapshot.snapshotId);
    expect(first.snapshot.sources[0]).toMatchObject({
      sourceMode: "DIRECT_PROJECT_EVIDENCE",
      projectEvidence: { sourceId: source.sourceId },
      multiHop: { contract: "ProjectRootTraversalView" },
    });
    expect(stableProjectEvidenceHash(firstPair.multiHop)).toBe(
      stableProjectEvidenceHash(secondPair.multiHop),
    );
  });

  it("fails closed on mixed modes and conflicting shared Task facts", () => {
    const directory = temporaryDirectory("project-evidence-legacy");
    const legacyPair = projectTopologyFixturePair({
      rootTaskId: "legacy-root",
    });
    const oneHopPath = join(directory, "one-hop.json");
    const multiHopPath = join(directory, "multi-hop.json");
    writeFileSync(oneHopPath, JSON.stringify(legacyPair.oneHop), "utf8");
    writeFileSync(multiHopPath, JSON.stringify(legacyPair.multiHop), "utf8");
    const legacy = loadProjectTopologySources([
      { rootTaskId: "legacy-root", oneHopPath, multiHopPath },
    ])[0]!;
    const directPair = projectTopologyFixturePair({
      rootTaskId: "direct-root",
    });
    const direct = loadDirectProjectTopologySources({
      descriptor: descriptor(["direct-root"]),
      roots: [
        {
          rootTaskId: "direct-root",
          oneHop: directPair.oneHop,
          traversal: directPair.multiHop,
        },
      ],
    })[0]!;
    expect(() =>
      buildProjectTopology({
        projectKey: "fixture-project",
        roots: [legacy, direct],
      }),
    ).toThrow("PROJECT_TOPOLOGY_SOURCE_MODE_MIXED");

    const first = projectTopologyFixturePair({
      rootTaskId: "root-a",
      sharedProducerTaskId: "shared-producer",
    });
    const second = projectTopologyFixturePair({
      rootTaskId: "root-b",
      sharedProducerTaskId: "shared-producer",
    });
    const conflicting = rehashTraversal({
      ...second.multiHop,
      taskNodes: second.multiHop.taskNodes.map((task) =>
        task.taskId === "shared-producer"
          ? { ...task, taskContentHash: "9".repeat(64) }
          : task,
      ),
    });
    expect(() =>
      loadDirectProjectTopologySources({
        descriptor: descriptor(["root-a", "root-b"]),
        roots: [
          {
            rootTaskId: "root-a",
            oneHop: first.oneHop,
            traversal: first.multiHop,
          },
          {
            rootTaskId: "root-b",
            oneHop: second.oneHop,
            traversal: conflicting,
          },
        ],
      }),
    ).toThrow("PROJECT_TOPOLOGY_DIRECT_TASK_HASH_CONFLICT:shared-producer");
  });

  it("fails closed on cross-fingerprint roots and invalid root overlays", () => {
    const pair = projectTopologyFixturePair();
    const wrongFingerprint = buildProjectEvidenceSourceDescriptor({
      projectKey: "fixture-project",
      rootTaskIds: ["root-1"],
      inputFingerprint: "8".repeat(64),
      producerIndexContentHash: FIXTURE_PRODUCER_INDEX_HASH,
      terminalConfig: {
        version: "fixture-v1",
        contentHash: "c".repeat(64),
        stopRoles: ["REFERENCE_CONFIG"],
      },
      scheduleEvidenceContentHash: "d".repeat(64),
      limits: descriptor(["root-1"]).limits,
    });
    expect(() =>
      loadDirectProjectTopologySources({
        descriptor: wrongFingerprint,
        roots: [
          {
            rootTaskId: "root-1",
            oneHop: pair.oneHop,
            traversal: pair.multiHop,
          },
        ],
      }),
    ).toThrow("PROJECT_TOPOLOGY_DIRECT_SOURCE_IDENTITY_MISMATCH:root-1");

    const invalidOverlay = rehashTraversal({
      ...pair.multiHop,
      taskNodes: pair.multiHop.taskNodes.map((task) =>
        task.taskId === "root-1" ? { ...task, minDepth: 1 } : task,
      ),
    });
    expect(() =>
      loadDirectProjectTopologySources({
        descriptor: descriptor(["root-1"]),
        roots: [
          {
            rootTaskId: "root-1",
            oneHop: pair.oneHop,
            traversal: invalidOverlay,
          },
        ],
      }),
    ).toThrow("PROJECT_TOPOLOGY_DIRECT_ENTRY_INVALID:root-1");
  });

  it("keeps pre-source-mode legacy snapshots constructible", () => {
    const directory = temporaryDirectory("project-evidence-old-legacy");
    const pair = projectTopologyFixturePair();
    const oneHopPath = join(directory, "one-hop.json");
    const multiHopPath = join(directory, "multi-hop.json");
    writeFileSync(oneHopPath, JSON.stringify(pair.oneHop), "utf8");
    writeFileSync(multiHopPath, JSON.stringify(pair.multiHop), "utf8");
    const loaded = loadProjectTopologySources([
      { rootTaskId: "root-1", oneHopPath, multiHopPath },
    ])[0]!;
    const { sourceMode: _sourceMode, ...oldSource } = loaded.source;
    const projection = buildProjectTopology({
      projectKey: "fixture-project",
      roots: [{ ...loaded, source: oldSource }],
    });
    expect(projection.snapshot.sources[0].sourceMode).toBeUndefined();
  });
});

describe("root traversal parity gates", () => {
  it("accepts equal semantics and rejects boundary loss or stronger roles", () => {
    const pair = projectTopologyFixturePair({ partial: true });
    expect(compareProjectRootTraversal(pair.multiHop, pair.multiHop)).toEqual({
      rootTaskId: "root-1",
      matches: true,
      differences: [],
    });
    const missingBoundary = {
      ...pair.multiHop,
      terminals: pair.multiHop.terminals.slice(1),
    };
    expect(
      compareProjectRootTraversal(pair.multiHop, missingBoundary).differences,
    ).toContainEqual(
      expect.objectContaining({
        section: "terminals",
        kind: "BOUNDARY_MISMATCH",
      }),
    );
    const stronger = {
      ...pair.multiHop,
      producerBridges: pair.multiHop.producerBridges.map((bridge) =>
        bridge.producerRole === "UNKNOWN"
          ? { ...bridge, producerRole: "PRIMARY" as const }
          : bridge,
      ),
    };
    expect(
      compareProjectRootTraversal(pair.multiHop, stronger).differences,
    ).toContainEqual(
      expect.objectContaining({
        section: "producerBridges",
        kind: "STRONGER_CONFIRMATION",
      }),
    );
    const leaked = {
      ...pair.multiHop,
      taskNodes: [
        ...pair.multiHop.taskNodes,
        {
          ...pair.multiHop.taskNodes[0]!,
          taskId: "unrelated-root-task",
          minDepth: 1,
        },
      ],
    };
    expect(
      compareProjectRootTraversal(pair.multiHop, leaked).differences,
    ).toContainEqual(
      expect.objectContaining({
        section: "taskNodes",
        kind: "SOURCE_ROOT_LEAK",
      }),
    );
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
    expect(
      first.projection.snapshot.sources.every(
        (source) => source.sourceMode === "DIRECT_PROJECT_EVIDENCE",
      ),
    ).toBe(true);
    expect(existsSync(join(dataRoot, "artifacts", "tasks"))).toBe(false);
    expect(second.published.status).toBe("REUSED");
    expect(second.published.directory).toBe(first.published.directory);
    expect(
      readFileSync(join(first.published.directory, "snapshot.json"), "utf8"),
    ).toBe(
      readFileSync(join(second.published.directory, "snapshot.json"), "utf8"),
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

    const traced = traceProjectUpstream(first.published.directory, {
      startNodeId: taskNodeId("root-a"),
      relationLayers: ["DATA_PRODUCTION"],
    });
    expect(traced.status).toBe("ok");
    expect(traced.result.nodes.map((node) => node.nodeId)).toContain(
      taskNodeId("shared-producer"),
    );
    expect(getProjectTopology(first.published.directory).status).toBe("ok");
    const bridge = first.projection.edges.find(
      (edge) => edge.edgeType === "PRODUCER_BRIDGE",
    )!;
    const explained = explainTopologyEdge(
      first.published.directory,
      bridge.edgeId,
    );
    expect(explained.status).toBe("ok");
    expect(explained.result.sourceArtifacts).toEqual([
      expect.objectContaining({ contract: "ProjectRootTraversalView" }),
    ]);
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
    expect(result.projection.snapshot.coverageStatus).toBe("PARTIAL");
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
