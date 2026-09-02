import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  PROJECT_TOPOLOGY_PROJECTION_VERSION,
  PROJECT_TOPOLOGY_SCHEMA_VERSION,
  PROJECT_TOPOLOGY_SNAPSHOT_TYPE,
  validateProjectTopologyProjection,
} from "../src/project-graph/contracts/project-topology-contract.ts";
import {
  assertExclusiveSourceModes,
  taskLocalUnionSnapshotContentHash,
  taskLocalUnionSnapshotId,
  unpackTaskLocalProjectionEnvelope,
  validateTaskLocalUnionSnapshot,
  type TaskLocalProjectionEnvelope,
  type TaskLocalUnionSnapshotV1,
  type TaskLocalUnionTaskSource,
} from "../src/project-graph/topology/task-local-union/task-local-union-contract.ts";
import { buildProjectTopology } from "../src/project-graph/topology/project-topology-projector.ts";
import { loadProjectTopologySources } from "../src/project-graph/topology/project-topology-source.ts";
import { projectTopologyFixturePair } from "./fixtures/project-topology/cases.ts";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HASH_A = sha("projection-a");
const HASH_B = sha("projection-b");
const PRODUCER_HASH = sha("producer-index");
const MANIFEST_HASH = sha("batch-manifest");

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function envelope(input: {
  readonly taskId: string;
  readonly contentHash: string;
  readonly coverageStatus: "PROJECTED" | "SCHEDULE_ONLY" | "COLLECTION_FAILED";
  readonly schemaVersion?: string;
  readonly projectionContentHash?: string;
  readonly packContentHash?: string;
  readonly factsManifestSha256?: string;
  readonly nodes?: unknown[];
  readonly edges?: unknown[];
  readonly failureReasonCode?: string | null;
}): TaskLocalProjectionEnvelope {
  const schemaVersion = input.schemaVersion ?? "1.1.0";
  return {
    cacheKey: sha(`cache:${input.taskId}`),
    cacheKeyParts: {
      taskId: input.taskId,
      packContentHash: input.packContentHash ?? sha(`pack:${input.taskId}`),
      factsManifestSha256:
        input.factsManifestSha256 ?? sha(`facts:${input.taskId}`),
      schemaVersion,
    },
    projectionContentHash: input.projectionContentHash ?? input.contentHash,
    projection: {
      schemaVersion,
      artifactType: "TASK_LOCAL_PROJECTION",
      generatedAt: "2026-09-02T00:00:00.000Z",
      taskId: input.taskId,
      coverageStatus: input.coverageStatus,
      failureReasonCode: input.failureReasonCode ?? null,
      contentHash: input.contentHash,
      nodes: input.nodes ?? [
        {
          nodeId: `task:${input.taskId}`,
          nodeType: "TASK",
          properties: {
            scheduleReference: {
              role: "SCHEDULE_REFERENCE_ONLY",
              upstreamTaskIds: [],
              downstreamTaskIds: [],
              targetTable: null,
            },
          },
        },
      ],
      edges: input.edges ?? [],
    },
  };
}

function taskSourceFromEnvelope(
  env: TaskLocalProjectionEnvelope,
): TaskLocalUnionTaskSource {
  return {
    taskId: env.projection.taskId,
    contentHash: env.projection.contentHash,
    packContentHash: env.cacheKeyParts.packContentHash,
    factsManifestSha256: env.cacheKeyParts.factsManifestSha256,
    coverageStatus: env.projection.coverageStatus,
    failureReasonCode: env.projection.failureReasonCode,
  };
}

function buildUnionSnapshot(
  sources: readonly TaskLocalUnionTaskSource[],
): TaskLocalUnionSnapshotV1 {
  const taskSources = [...sources].sort((left, right) =>
    left.taskId < right.taskId ? -1 : left.taskId > right.taskId ? 1 : 0,
  );
  const producerIndex = {
    contentHash: PRODUCER_HASH,
    inputFingerprint: "fixture-fingerprint",
  };
  const batchManifestRef = {
    path: "project-graph/batch-manifest.json",
    contentHash: MANIFEST_HASH,
  };
  const body = {
    schemaVersion: PROJECT_TOPOLOGY_SCHEMA_VERSION,
    artifactType: PROJECT_TOPOLOGY_SNAPSHOT_TYPE,
    projectionVersion: PROJECT_TOPOLOGY_PROJECTION_VERSION,
    snapshotId: taskLocalUnionSnapshotId({
      projectKey: "fixture-union",
      taskSources,
      producerIndex,
      batchManifestRef,
    }),
    projectKey: "fixture-union",
    sourceMode: "TASK_LOCAL_UNION" as const,
    taskSources,
    producerIndex,
    batchManifestRef,
    coverageStatus: "PARTIAL" as const,
  };
  return {
    ...body,
    contentHash: taskLocalUnionSnapshotContentHash(body),
  };
}

describe("TASK_LOCAL_UNION contract (TU-0)", () => {
  it("unpacks envelope when triple contentHash agrees", () => {
    const env = envelope({
      taskId: "105387",
      contentHash: HASH_A,
      coverageStatus: "PROJECTED",
    });
    const unpacked = unpackTaskLocalProjectionEnvelope({
      envelope: env,
      manifestTaskContentHash: HASH_A,
    });
    expect(unpacked.taskSource).toMatchObject({
      taskId: "105387",
      contentHash: HASH_A,
      coverageStatus: "PROJECTED",
    });
    expect(unpacked.projection.schemaVersion).toBe("1.1.0");
  });

  it("fails closed on triple contentHash mismatch", () => {
    const env = envelope({
      taskId: "105387",
      contentHash: HASH_A,
      coverageStatus: "PROJECTED",
      projectionContentHash: HASH_B,
    });
    expect(() =>
      unpackTaskLocalProjectionEnvelope({
        envelope: env,
        manifestTaskContentHash: HASH_A,
      }),
    ).toThrow(/TASK_LOCAL_ENVELOPE_HASH_MISMATCH/);

    const aligned = envelope({
      taskId: "105387",
      contentHash: HASH_A,
      coverageStatus: "PROJECTED",
    });
    expect(() =>
      unpackTaskLocalProjectionEnvelope({
        envelope: aligned,
        manifestTaskContentHash: HASH_B,
      }),
    ).toThrow(/TASK_LOCAL_ENVELOPE_HASH_MISMATCH/);
  });

  it("rejects unsupported projection schemaVersion", () => {
    const env = envelope({
      taskId: "105387",
      contentHash: HASH_A,
      coverageStatus: "PROJECTED",
      schemaVersion: "9.9.9",
    });
    expect(() =>
      unpackTaskLocalProjectionEnvelope({
        envelope: env,
        manifestTaskContentHash: HASH_A,
      }),
    ).toThrow(/TASK_LOCAL_PROJECTION_SCHEMA_UNSUPPORTED:9\.9\.9/);
  });

  it("validates a TASK_LOCAL_UNION snapshot with non-empty taskSources", () => {
    const projected = envelope({
      taskId: "105387",
      contentHash: HASH_A,
      coverageStatus: "PROJECTED",
    });
    const scheduleOnly = envelope({
      taskId: "999001",
      contentHash: HASH_B,
      coverageStatus: "SCHEDULE_ONLY",
      packContentHash: "NO_PACK",
      factsManifestSha256: "NO_FACTS",
    });
    const snapshot = buildUnionSnapshot([
      taskSourceFromEnvelope(projected),
      taskSourceFromEnvelope(scheduleOnly),
    ]);
    expect(() => validateTaskLocalUnionSnapshot(snapshot)).not.toThrow();
    expect(snapshot.sourceMode).toBe("TASK_LOCAL_UNION");
  });

  it("rejects empty taskSources", () => {
    const snapshot = buildUnionSnapshot([]);
    expect(() => validateTaskLocalUnionSnapshot(snapshot)).toThrow(
      /TASK_LOCAL_UNION_TASK_SOURCES_EMPTY/,
    );
  });

  it("rejects mixed source modes", () => {
    expect(() =>
      assertExclusiveSourceModes(["LEGACY_ARTIFACT_PAIRS", "TASK_LOCAL_UNION"]),
    ).toThrow(/PROJECT_TOPOLOGY_SOURCE_MODE_MIXED/);
  });

  it("legacy projection validation still rejects TASK_LOCAL_UNION in root sources", () => {
    const directory = mkdtempSync(join(tmpdir(), "tu0-legacy-"));
    const pair = projectTopologyFixturePair();
    const oneHopPath = join(directory, "one-hop.json");
    const multiHopPath = join(directory, "multi-hop.json");
    writeFileSync(oneHopPath, JSON.stringify(pair.oneHop), "utf8");
    writeFileSync(multiHopPath, JSON.stringify(pair.multiHop), "utf8");
    const roots = loadProjectTopologySources([
      { rootTaskId: "root-1", oneHopPath, multiHopPath },
    ]);
    const projection = buildProjectTopology({
      projectKey: "fixture-project",
      roots,
    });
    expect(() => validateProjectTopologyProjection(projection)).not.toThrow();

    const poisoned = {
      ...projection,
      snapshot: {
        ...projection.snapshot,
        sources: projection.snapshot.sources.map((source) => ({
          ...source,
          sourceMode: "TASK_LOCAL_UNION" as const,
        })),
      },
    };
    // Recompute would be needed for hash/id; validation fails on mode first.
    expect(() => validateProjectTopologyProjection(poisoned)).toThrow(
      /PROJECT_TOPOLOGY_SOURCE_MODE_INVALID|PROJECT_TOPOLOGY_SNAPSHOT/,
    );
  });
});
