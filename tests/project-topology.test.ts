import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  physicalDatasetNodeId,
  taskNodeId,
  validateProjectTopologyProjection,
} from "../scripts/project-graph/contracts/project-topology-contract.ts";
import { parseProjectTopologyCli } from "../scripts/project-graph/project-topology-cli.ts";
import {
  explainTopologyEdge,
  getProjectTopology,
  traceProjectUpstream,
} from "../scripts/project-graph/query/project-topology-query.ts";
import {
  buildProjectTopology,
  projectTopologySourceCounts,
} from "../scripts/project-graph/topology/project-topology-projector.ts";
import {
  loadProjectTopologyDirectory,
  PROJECT_TOPOLOGY_NODES_FILE,
  publishProjectTopology,
  serializeProjectTopology,
} from "../scripts/project-graph/topology/project-topology-publication.ts";
import {
  loadProjectTopologySources,
  PROJECT_TOPOLOGY_SOURCE_CONTRACT,
  type LoadedProjectTopologyRoot,
} from "../scripts/project-graph/topology/project-topology-source.ts";
import {
  FIXTURE_INPUT_FINGERPRINT,
  projectTopologyFixturePair,
  type ProjectTopologyFixturePair,
} from "./fixtures/project-topology/cases.ts";

interface MaterializedPair {
  readonly oneHopPath: string;
  readonly multiHopPath: string;
}

function temporaryDirectory(label: string): string {
  return mkdtempSync(join(tmpdir(), `${label}-`));
}

function materializePair(
  directory: string,
  label: string,
  pair: ProjectTopologyFixturePair,
): MaterializedPair {
  const oneHopPath = join(directory, `${label}.one-hop.json`);
  const multiHopPath = join(directory, `${label}.multi-hop.json`);
  writeFileSync(oneHopPath, JSON.stringify(pair.oneHop), "utf8");
  writeFileSync(multiHopPath, JSON.stringify(pair.multiHop), "utf8");
  return { oneHopPath, multiHopPath };
}

function loadFixtureRoots(
  fixtures: readonly {
    readonly rootTaskId: string;
    readonly pair: ProjectTopologyFixturePair;
  }[],
): LoadedProjectTopologyRoot[] {
  const directory = temporaryDirectory("project-topology-sources");
  return loadProjectTopologySources(
    fixtures.map(({ rootTaskId, pair }, index) => ({
      rootTaskId,
      ...materializePair(directory, String(index), pair),
    })),
  );
}

function completeProjection() {
  const roots = loadFixtureRoots([
    { rootTaskId: "root-1", pair: projectTopologyFixturePair() },
  ]);
  return buildProjectTopology({ projectKey: "fixture-project", roots });
}

function observations(edge: {
  readonly properties: Readonly<Record<string, unknown>>;
}) {
  return edge.properties.observations as readonly Record<string, unknown>[];
}

describe("project topology source contracts", () => {
  it("records current source-contract asymmetry without changing source artifacts", () => {
    expect(PROJECT_TOPOLOGY_SOURCE_CONTRACT).toMatchObject({
      oneHop: {
        sourceSchemaVersion: "1.1.0",
        topLevelArtifactType: false,
        topLevelContentHash: false,
        contentIdentity: "EXACT_FILE_SHA256",
      },
      multiHop: {
        sourceSchemaVersion: "1.1.0",
        artifactType: "TABLE_MULTI_HOP_RECONCILIATION",
        declaredContentHash: true,
      },
    });
  });

  it("loads a validated pair and retains exact-file and declared hashes", () => {
    const [loaded] = loadFixtureRoots([
      { rootTaskId: "root-1", pair: projectTopologyFixturePair() },
    ]);
    expect(loaded.source.oneHop).toMatchObject({
      contract: "OneHopReconciliationResult",
      artifactType: null,
      declaredContentHash: null,
      contentSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(loaded.source.multiHop).toMatchObject({
      contract: "MultiHopReconciliationResult",
      artifactType: "TABLE_MULTI_HOP_RECONCILIATION",
      declaredContentHash: loaded.multiHop.contentHash,
      contentSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("fails closed on root, producer-pair, declared-hash, and byte limits", () => {
    const directory = temporaryDirectory("project-topology-invalid");
    const valid = projectTopologyFixturePair();
    const paths = materializePair(directory, "valid", valid);
    expect(() =>
      loadProjectTopologySources([{ rootTaskId: "wrong-root", ...paths }]),
    ).toThrow(/ONE_HOP_ROOT_OR_SCHEMA_INVALID/);

    const mismatchedOneHop = {
      ...valid.oneHop,
      producerIndex: {
        ...valid.oneHop.producerIndex,
        inputFingerprint: "9".repeat(64),
      },
    } as unknown as ProjectTopologyFixturePair["oneHop"];
    const mismatchPaths = materializePair(directory, "mismatch", {
      oneHop: mismatchedOneHop,
      multiHop: valid.multiHop,
    });
    expect(() =>
      loadProjectTopologySources([{ rootTaskId: "root-1", ...mismatchPaths }]),
    ).toThrow(/PRODUCER_PAIR_MISMATCH/);

    const invalidHash = {
      ...valid.multiHop,
      contentHash: "0".repeat(64),
    } as ProjectTopologyFixturePair["multiHop"];
    const invalidHashPaths = materializePair(directory, "invalid-hash", {
      oneHop: valid.oneHop,
      multiHop: invalidHash,
    });
    expect(() =>
      loadProjectTopologySources([
        { rootTaskId: "root-1", ...invalidHashPaths },
      ]),
    ).toThrow("MULTI_HOP_CONTENT_HASH_INVALID");
    expect(() =>
      loadProjectTopologySources([{ rootTaskId: "root-1", ...paths }], {
        maxSourceBytesPerFile: 10,
      }),
    ).toThrow(/SOURCE_LIMIT/);
  });
});

describe("project topology projection", () => {
  it("preserves physical identity, producer roles, write observations, and relation layers", () => {
    const projection = completeProjection();
    expect(projection.snapshot.coverageStatus).toBe("COMPLETE");
    const datasets = projection.nodes.filter(
      (node) => node.nodeType === "PHYSICAL_DATASET",
    );
    expect(datasets).toHaveLength(2);
    expect(new Set(datasets.map((node) => node.nodeId)).size).toBe(2);
    expect(datasets.map((node) => node.properties.dataSource).sort()).toEqual([
      "warehouse-a",
      "warehouse-b",
    ]);

    const primaryBridge = projection.edges.find(
      (edge) =>
        edge.edgeType === "PRODUCER_BRIDGE" &&
        observations(edge).some(
          (observation) => observation.producerRole === "PRIMARY",
        ),
    )!;
    const unknownBridge = projection.edges.find(
      (edge) =>
        edge.edgeType === "PRODUCER_BRIDGE" &&
        observations(edge).some(
          (observation) => observation.producerRole === "UNKNOWN",
        ),
    )!;
    expect(primaryBridge.relationLayer).toBe("DATA_PRODUCTION");
    expect(unknownBridge).toBeDefined();
    expect(observations(primaryBridge)[0]).toMatchObject({
      readOccurrenceRef: expect.objectContaining({
        occurrenceId: "root-1:read:0",
      }),
      exactWriteObservationRef: null,
    });
    const primaryWrite = projection.edges.find(
      (edge) =>
        edge.edgeType === "WRITES" &&
        edge.fromNodeId === taskNodeId("shared-producer"),
    )!;
    expect(
      (observations(primaryWrite)[0].writeObservationRefs as readonly unknown[])
        .length,
    ).toBe(2);
    expect(
      projection.edges.find((edge) => edge.edgeType === "SCHEDULE_DEPENDS_ON")
        ?.relationLayer,
    ).toBe("SCHEDULE");
  });

  it("projects partial/truncated evidence and source terminals as explicit boundaries", () => {
    const roots = loadFixtureRoots([
      {
        rootTaskId: "partial-root",
        pair: projectTopologyFixturePair({
          rootTaskId: "partial-root",
          partial: true,
        }),
      },
    ]);
    const projection = buildProjectTopology({
      projectKey: "partial-project",
      roots,
    });
    expect(projection.snapshot.coverageStatus).toBe("PARTIAL");
    expect(
      projection.nodes
        .filter((node) => node.nodeType === "BOUNDARY")
        .map((node) => node.properties.reason),
    ).toEqual(
      expect.arrayContaining(["REFERENCE_CONFIG", "MAX_TASKS_REACHED"]),
    );
    expect(projection.snapshot.sources[0].limits).toMatchObject({
      truncated: true,
      truncationReason: "MAX_TASKS_REACHED",
    });
  });

  it("merges shared stable identities but retains root-scoped depths", () => {
    const roots = loadFixtureRoots([
      {
        rootTaskId: "root-a",
        pair: projectTopologyFixturePair({
          rootTaskId: "root-a",
          sharedProducerTaskId: "shared-producer",
          producerDepth: 1,
        }),
      },
      {
        rootTaskId: "root-b",
        pair: projectTopologyFixturePair({
          rootTaskId: "root-b",
          sharedProducerTaskId: "shared-producer",
          producerDepth: 2,
        }),
      },
    ]);
    const projection = buildProjectTopology({
      projectKey: "multi-root-project",
      roots,
    });
    const sharedTasks = projection.nodes.filter(
      (node) => node.nodeId === taskNodeId("shared-producer"),
    );
    expect(sharedTasks).toHaveLength(1);
    expect(sharedTasks[0].sourceRootTaskIds).toEqual(["root-a", "root-b"]);
    const reachability = projection.edges.filter(
      (edge) =>
        edge.edgeType === "ROOT_REACHES_TASK" &&
        edge.toNodeId === taskNodeId("shared-producer"),
    );
    expect(reachability).toHaveLength(2);
    expect(
      reachability
        .flatMap((edge) => observations(edge))
        .map((observation) => observation.minDepth)
        .sort(),
    ).toEqual([1, 2]);
    expect(
      projectTopologySourceCounts(roots.map((root) => root.multiHop)),
    ).toMatchObject({
      roots: 2,
      taskNodes: 8,
      producerBridges: 4,
    });
  });

  it("fails validation when an edge endpoint is absent", () => {
    const projection = completeProjection();
    const invalid = {
      ...projection,
      nodes: projection.nodes.filter(
        (node) => node.nodeId !== taskNodeId("shared-producer"),
      ),
    };
    expect(() => validateProjectTopologyProjection(invalid)).toThrow(
      /EDGE_ENDPOINT_MISSING/,
    );
  });
});

describe("project topology publication", () => {
  it("is deterministic, immutable, and reuses byte-identical snapshots", () => {
    const projection = completeProjection();
    expect(serializeProjectTopology(projection)).toEqual(
      serializeProjectTopology(projection),
    );
    const outputRoot = temporaryDirectory("project-topology-output");
    const created = publishProjectTopology(projection, { outputRoot });
    const before = [
      "snapshot.json",
      "topology.nodes.jsonl",
      "topology.edges.jsonl",
      "projection-manifest.json",
    ].map((fileName) =>
      readFileSync(join(created.directory, fileName), "utf8"),
    );
    const reused = publishProjectTopology(projection, { outputRoot });
    expect(reused.status).toBe("REUSED");
    expect(reused.directory).toBe(created.directory);
    expect(
      [
        "snapshot.json",
        "topology.nodes.jsonl",
        "topology.edges.jsonl",
        "projection-manifest.json",
      ].map((fileName) =>
        readFileSync(join(created.directory, fileName), "utf8"),
      ),
    ).toEqual(before);

    writeFileSync(
      join(created.directory, PROJECT_TOPOLOGY_NODES_FILE),
      "corrupt",
      "utf8",
    );
    expect(() => publishProjectTopology(projection, { outputRoot })).toThrow(
      /IMMUTABLE_CONFLICT/,
    );
  });

  it("changes snapshot identity when exact source bytes change", () => {
    const first = buildProjectTopology({
      projectKey: "source-byte-project",
      roots: loadFixtureRoots([
        { rootTaskId: "root-1", pair: projectTopologyFixturePair() },
      ]),
    });
    const second = buildProjectTopology({
      projectKey: "source-byte-project",
      roots: loadFixtureRoots([
        {
          rootTaskId: "root-1",
          pair: projectTopologyFixturePair({
            generatedAt: "2026-08-29T00:00:01.000Z",
          }),
        },
      ]),
    });
    expect(second.snapshot.snapshotId).not.toBe(first.snapshot.snapshotId);
  });

  it("does not expose a final snapshot when publication is interrupted", () => {
    const projection = completeProjection();
    const outputRoot = temporaryDirectory("project-topology-interrupted");
    const finalDirectory = join(
      outputRoot,
      "projects",
      projection.snapshot.projectKey,
      "snapshots",
      projection.snapshot.snapshotId,
    );
    expect(() =>
      publishProjectTopology(projection, {
        outputRoot,
        beforeInstall: () => {
          throw new Error("fixture interruption");
        },
      }),
    ).toThrow("fixture interruption");
    expect(existsSync(finalDirectory)).toBe(false);
  });
});

describe("file-backed project topology queries", () => {
  it("keeps data-production and schedule traversals isolated", () => {
    const projection = completeProjection();
    const outputRoot = temporaryDirectory("project-topology-query");
    const published = publishProjectTopology(projection, { outputRoot });
    const loaded = loadProjectTopologyDirectory(published.directory);
    expect(loaded.projection).toEqual(projection);

    const data = traceProjectUpstream(published.directory, {
      startNodeId: taskNodeId("root-1"),
      relationLayers: ["DATA_PRODUCTION"],
    });
    const dataNodeIds = data.result.nodes.map((node) => node.nodeId);
    expect(data.status).toBe("ok");
    expect(dataNodeIds).toContain(taskNodeId("shared-producer"));
    expect(dataNodeIds).not.toContain(taskNodeId("root-1-schedule-only"));

    const schedule = traceProjectUpstream(published.directory, {
      startNodeId: taskNodeId("root-1"),
      relationLayers: ["SCHEDULE"],
    });
    expect(schedule.result.nodes.map((node) => node.nodeId)).toEqual(
      expect.arrayContaining([
        taskNodeId("root-1"),
        taskNodeId("root-1-schedule-only"),
      ]),
    );
    expect(schedule.result.nodes.map((node) => node.nodeId)).not.toContain(
      taskNodeId("shared-producer"),
    );
  });

  it("reports limits, partial sources, not-found nodes, and complete edge evidence", () => {
    const roots = loadFixtureRoots([
      {
        rootTaskId: "partial-root",
        pair: projectTopologyFixturePair({
          rootTaskId: "partial-root",
          partial: true,
        }),
      },
    ]);
    const projection = buildProjectTopology({
      projectKey: "partial-query-project",
      roots,
    });
    const published = publishProjectTopology(projection, {
      outputRoot: temporaryDirectory("project-topology-partial-query"),
    });
    const topology = getProjectTopology(published.directory, { limit: 1 });
    expect(topology.status).toBe("partial");
    expect(topology.warnings).toEqual(
      expect.arrayContaining([
        "SOURCE_EVIDENCE_PARTIAL",
        "QUERY_LIMIT_REACHED",
      ]),
    );
    expect(topology.result.boundaries.length).toBeGreaterThan(0);

    const missing = traceProjectUpstream(published.directory, {
      startNodeId: "task:not-present",
    });
    expect(missing.status).toBe("not_found");

    const limited = traceProjectUpstream(published.directory, {
      startNodeId: taskNodeId("partial-root"),
      maxPaths: 1,
    });
    expect(limited.status).toBe("partial");
    expect(limited.result).toMatchObject({
      exploredPaths: 1,
      truncated: true,
    });
    expect(limited.warnings).toContain("QUERY_LIMIT_REACHED");

    const primaryBridge = projection.edges.find(
      (edge) =>
        edge.edgeType === "PRODUCER_BRIDGE" &&
        observations(edge).some(
          (observation) => observation.producerRole === "PRIMARY",
        ),
    )!;
    const explanation = explainTopologyEdge(
      published.directory,
      primaryBridge.edgeId,
    );
    expect(explanation.status).toBe("partial");
    expect(explanation.result.edge).toEqual(primaryBridge);
    expect(explanation.result.endpoints).toHaveLength(2);
    expect(explanation.result.sourceArtifacts).toEqual([
      expect.objectContaining({
        contract: "MultiHopReconciliationResult",
        rootTaskId: "partial-root",
      }),
    ]);
    expect(observations(explanation.result.edge!)[0]).toMatchObject({
      producerRole: "PRIMARY",
      exactWriteObservationRef: null,
    });
    expect(
      explainTopologyEdge(published.directory, "edge:missing").status,
    ).toBe("not_found");
  });
});

describe("project topology CLI", () => {
  it("requires explicit root artifact pairs and bounded options", () => {
    const parsed = parseProjectTopologyCli([
      "--project-key",
      "fixture-project",
      "--output-root",
      "out",
      "--root-task-id",
      "176827",
      "--one-hop",
      "one-hop.json",
      "--multi-hop",
      "multi-hop.json",
      "--max-nodes",
      "100",
    ]);
    expect(parsed).toMatchObject({
      projectKey: "fixture-project",
      roots: [{ rootTaskId: "176827" }],
      maxNodes: 100,
    });
    expect(() =>
      parseProjectTopologyCli([
        "--project-key",
        "fixture-project",
        "--output-root",
        "out",
        "--root-task-id",
        "176827",
        "--one-hop",
        "one-hop.json",
      ]),
    ).toThrow("ROOT_ARTIFACT_PAIR_INCOMPLETE:176827");
  });
});

describe("fixture guards", () => {
  it("keeps the producer identity pair explicit and dataset IDs source-aware", () => {
    const pair = projectTopologyFixturePair();
    expect(pair.oneHop.producerIndex.inputFingerprint).toBe(
      FIXTURE_INPUT_FINGERPRINT,
    );
    expect(pair.multiHop.producerIndex.inputFingerprint).toBe(
      FIXTURE_INPUT_FINGERPRINT,
    );
    expect(
      physicalDatasetNodeId({
        platform: "hive",
        dataSource: "warehouse-a",
        qualifiedName: "dm.shared_source",
      }),
    ).not.toBe(
      physicalDatasetNodeId({
        platform: "hive",
        dataSource: "warehouse-b",
        qualifiedName: "dm.shared_source",
      }),
    );
  });
});
