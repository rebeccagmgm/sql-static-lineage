import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalJson } from "../src/contracts/runtime.ts";
import {
  batchManifestContentHashOf,
  loadTaskLocalUnionSources,
  type TaskLocalBatchManifest,
} from "../src/project-graph/topology/task-local-union/task-local-union-source.ts";
import type { TaskLocalProjectionEnvelope } from "../src/project-graph/topology/task-local-union/task-local-union-contract.ts";

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function writeEnvelope(
  root: string,
  taskId: string,
  envelope: TaskLocalProjectionEnvelope,
): string {
  const dir = join(root, "tasks", taskId);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "task-local-projection.json");
  writeFileSync(path, `${canonicalJson(envelope)}\n`, "utf8");
  return path;
}

function makeEnvelope(input: {
  readonly taskId: string;
  readonly contentHash: string;
  readonly coverageStatus: "PROJECTED" | "SCHEDULE_ONLY" | "COLLECTION_FAILED";
  readonly failureReasonCode?: string | null;
  readonly edges?: unknown[];
  readonly nodes?: unknown[];
}): TaskLocalProjectionEnvelope {
  return {
    cacheKey: sha(`cache:${input.taskId}`),
    cacheKeyParts: {
      taskId: input.taskId,
      packContentHash:
        input.coverageStatus === "PROJECTED"
          ? sha(`pack:${input.taskId}`)
          : "NO_PACK",
      factsManifestSha256:
        input.coverageStatus === "PROJECTED"
          ? sha(`facts:${input.taskId}`)
          : "NO_FACTS",
      schemaVersion: "1.1.0",
    },
    projectionContentHash: input.contentHash,
    projection: {
      schemaVersion: "1.1.0",
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
              upstreamTaskIds: ["upstream-1"],
              downstreamTaskIds: [],
              targetTable:
                input.coverageStatus === "SCHEDULE_ONLY"
                  ? "dm.fixture_target"
                  : null,
            },
            ...(input.coverageStatus === "COLLECTION_FAILED"
              ? {
                  failureReasonCode:
                    input.failureReasonCode ?? "FACTS_UNAVAILABLE",
                }
              : {}),
          },
        },
      ],
      edges:
        input.edges ??
        (input.coverageStatus === "PROJECTED"
          ? [
              {
                edgeId: sha(`edge-read:${input.taskId}`),
                edgeType: "READS",
                fromNodeId: `task:${input.taskId}`,
                toNodeId: "dataset:fixture",
                properties: {},
              },
            ]
          : []),
    },
  };
}

function materializeFixtureBatch(options?: {
  readonly breakHashForTaskId?: string;
}): {
  readonly root: string;
  readonly manifestPath: string;
  readonly producerIndexPath: string;
  readonly hashes: Record<string, string>;
} {
  const root = mkdtempSync(join(tmpdir(), "tu1-union-"));
  const hashes = {
    projected: sha("projected-body"),
    scheduleOnly: sha("schedule-only-body"),
    collectionFailed: sha("collection-failed-body"),
  };

  const projected = makeEnvelope({
    taskId: "100001",
    contentHash: hashes.projected,
    coverageStatus: "PROJECTED",
  });
  const scheduleOnly = makeEnvelope({
    taskId: "100002",
    contentHash: hashes.scheduleOnly,
    coverageStatus: "SCHEDULE_ONLY",
  });
  const collectionFailed = makeEnvelope({
    taskId: "100003",
    contentHash: hashes.collectionFailed,
    coverageStatus: "COLLECTION_FAILED",
    failureReasonCode: "FACTS_UNAVAILABLE",
  });

  const projectedForDisk: TaskLocalProjectionEnvelope =
    options?.breakHashForTaskId === "100001"
      ? {
          ...projected,
          projectionContentHash: sha("tampered"),
        }
      : projected;

  const projectedPath = writeEnvelope(root, "100001", projectedForDisk);
  const schedulePath = writeEnvelope(root, "100002", scheduleOnly);
  const failedPath = writeEnvelope(root, "100003", collectionFailed);

  const manifest: TaskLocalBatchManifest = {
    schemaVersion: "1.0.0",
    artifactType: "TASK_LOCAL_BATCH_MANIFEST",
    generatedAt: "2026-09-02T00:00:00.000Z",
    taskIds: ["100001", "100002", "100003"],
    summary: {
      total: 3,
      projected: 1,
      scheduleOnly: 1,
      collectionFailed: 1,
    },
    cache: { hits: 0, misses: 3 },
    tasks: [
      {
        taskId: "100001",
        coverageStatus: "PROJECTED",
        failureReasonCode: null,
        contentHash: hashes.projected,
        cacheHit: false,
        cacheKey: projected.cacheKey,
        path: projectedPath,
      },
      {
        taskId: "100002",
        coverageStatus: "SCHEDULE_ONLY",
        failureReasonCode: null,
        contentHash: hashes.scheduleOnly,
        cacheHit: false,
        cacheKey: scheduleOnly.cacheKey,
        path: schedulePath,
      },
      {
        taskId: "100003",
        coverageStatus: "COLLECTION_FAILED",
        failureReasonCode: "FACTS_UNAVAILABLE",
        contentHash: hashes.collectionFailed,
        cacheHit: false,
        cacheKey: collectionFailed.cacheKey,
        path: failedPath,
      },
    ],
  };

  const manifestPath = join(root, "batch-manifest.json");
  writeFileSync(manifestPath, `${canonicalJson(manifest)}\n`, "utf8");

  const producerIndexPath = join(root, "producer-index.json");
  writeFileSync(
    producerIndexPath,
    `${canonicalJson({
      contentHash: sha("producer-index-body"),
      inputFingerprint: sha("producer-input-fingerprint"),
      status: "VALID_SUCCESS",
    })}\n`,
    "utf8",
  );

  return { root, manifestPath, producerIndexPath, hashes };
}

describe("loadTaskLocalUnionSources (TU-1)", () => {
  it("loads PROJECTED / SCHEDULE_ONLY / COLLECTION_FAILED fixtures", () => {
    const { root, manifestPath, producerIndexPath } = materializeFixtureBatch();
    const loaded = loadTaskLocalUnionSources({
      manifestPath,
      projectGraphRoot: root,
      producerIndexPath,
    });

    expect(loaded.sourceMode).toBe("TASK_LOCAL_UNION");
    expect(loaded.tasks).toHaveLength(3);
    expect(loaded.batchManifestRef.contentHash).toBe(
      batchManifestContentHashOf(loaded.batchManifest),
    );

    const byId = Object.fromEntries(
      loaded.tasks.map((task) => [task.taskSource.taskId, task]),
    );
    expect(byId["100001"]?.boundaryOnly).toBe(false);
    expect(byId["100001"]?.projection.edges).toHaveLength(1);
    expect(byId["100002"]?.boundaryOnly).toBe(true);
    expect(byId["100002"]?.projection.edges).toHaveLength(0);
    expect(byId["100003"]?.boundaryOnly).toBe(true);
    expect(byId["100003"]?.projection.edges).toHaveLength(0);
    expect(byId["100003"]?.taskSource.failureReasonCode).toBe(
      "FACTS_UNAVAILABLE",
    );
  });

  it("fails closed when envelope contentHash disagrees with manifest", () => {
    const { root, manifestPath, producerIndexPath } = materializeFixtureBatch({
      breakHashForTaskId: "100001",
    });
    expect(() =>
      loadTaskLocalUnionSources({
        manifestPath,
        projectGraphRoot: root,
        producerIndexPath,
      }),
    ).toThrow(/TASK_LOCAL_ENVELOPE_HASH_MISMATCH/);
  });
});
