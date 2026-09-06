import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { storeTaskLocalProjectionCache } from "../../../scripts/project-graph/task-local/projection-cache.ts";
import {
  pruneAllTaskProjectionVersions,
  pruneTaskProjectionVersions,
  projectionVersionPrefix,
  readActiveProjectionReferences,
} from "../../../scripts/project-graph/task-local/projection-prune.ts";
import type { TaskLocalProjection } from "../../../scripts/project-graph/task-local/contract.ts";

function sampleProjection(taskId: string): TaskLocalProjection {
  return {
    schemaVersion: "1.3.0",
    artifactType: "TASK_LOCAL_PROJECTION",
    taskId,
    taskCategory: "sparkIndex",
    generatedAt: "2026-01-01T00:00:00.000Z",
    contentHash: `${taskId}-hash`,
    coverageStatus: "PROJECTED",
    coverageDisposition: "DATA_LINEAGE",
    failureReasonCode: null,
    nodes: [],
    edges: [],
  };
}

describe("projection-prune", () => {
  it("matches only the current cache key files", () => {
    const cacheKey = "abc123";
    expect(projectionVersionPrefix(cacheKey, `${cacheKey}.json`)).toBe(true);
    expect(projectionVersionPrefix(cacheKey, `${cacheKey}.evidence-v2.json`)).toBe(true);
    expect(projectionVersionPrefix(cacheKey, `${cacheKey}.evidence-v3.json`)).toBe(true);
    expect(projectionVersionPrefix(cacheKey, "old-key.json")).toBe(false);
  });

  it("removes stale version files but keeps the current cache key", () => {
    const root = mkdtempSync(join(tmpdir(), "projection-prune-"));
    const taskId = "176827";
    const currentKey = "current-key";
    const staleKey = "stale-key";
    const versionsDir = join(root, "tasks", taskId, "versions");
    mkdirSync(versionsDir, { recursive: true });
    writeFileSync(join(root, "tasks", taskId, "task-local-projection.json"), JSON.stringify({
      cacheKey: currentKey,
      cacheKeyParts: { taskId },
      projectionContentHash: "hash",
      projection: sampleProjection(taskId),
    }));
    writeFileSync(join(versionsDir, `${currentKey}.json`), "{}");
    writeFileSync(join(versionsDir, `${currentKey}.evidence-v2.json`), "{}");
    writeFileSync(join(versionsDir, `${currentKey}.evidence-v3.json`), "{}");
    writeFileSync(join(versionsDir, `${staleKey}.json`), "{}");
    writeFileSync(join(versionsDir, `${staleKey}.evidence-v2.json`), "{}");
    writeFileSync(join(versionsDir, `${staleKey}.evidence-v3.json`), "{}");

    const result = pruneTaskProjectionVersions(root, taskId, currentKey);

    expect(result.removedVersionFiles.sort()).toEqual([
      `${staleKey}.evidence-v2.json`,
      `${staleKey}.evidence-v3.json`,
      `${staleKey}.json`,
    ]);
    expect(readdirSync(versionsDir).sort()).toEqual([
      `${currentKey}.evidence-v2.json`,
      `${currentKey}.evidence-v3.json`,
      `${currentKey}.json`,
    ]);
  });

  it("prunes all tasks from task-local-projection.json", () => {
    const root = mkdtempSync(join(tmpdir(), "projection-prune-all-"));
    storeTaskLocalProjectionCache({
      outputRoot: root,
      cacheKeyParts: {
        taskId: "1",
        packContentHash: "pack",
        factsManifestSha256: "facts",
        schemaVersion: "1.3.0",
        generatorVersion: "1.3.2",
      },
      projection: sampleProjection("1"),
    });
    const versionsDir = join(root, "tasks", "1", "versions");
    writeFileSync(join(versionsDir, "stale.json"), "{}");

    const result = pruneAllTaskProjectionVersions(root);

    expect(result.prunedTasks).toBe(1);
    expect(result.removedVersionFiles).toBe(1);
    expect(existsSync(join(versionsDir, "stale.json"))).toBe(false);
  });

  it("keeps cache keys referenced by another graph profile", () => {
    const root = mkdtempSync(join(tmpdir(), "projection-prune-reference-"));
    const versionsDir = join(root, "tasks", "1", "versions");
    mkdirSync(versionsDir, { recursive: true });
    writeFileSync(join(root, "tasks", "1", "task-local-projection.json"), JSON.stringify({ cacheKey: "new" }));
    writeFileSync(join(versionsDir, "new.json"), "{}");
    writeFileSync(join(versionsDir, "published.json"), "{}");
    writeFileSync(join(versionsDir, "stale.json"), "{}");
    writeFileSync(join(versionsDir, "operator-note.txt"), "keep");
    const graphRoot = join(root, "graphs");
    const manifestPath = join(graphRoot, "other", "batches", "one", "batch-manifest.json");
    mkdirSync(join(graphRoot, "other", "batches", "one"), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify({ tasks: [{ taskId: "1", cacheKey: "published" }] }));
    writeFileSync(join(graphRoot, "other", "current.json"), JSON.stringify({ manifestPath }));

    const references = readActiveProjectionReferences(graphRoot);
    expect(references).not.toBeNull();
    const result = pruneAllTaskProjectionVersions(root, references!);

    expect(result.removedVersionFiles).toBe(1);
    expect(readdirSync(versionsDir).sort()).toEqual([
      "new.json",
      "operator-note.txt",
      "published.json",
    ]);
  });

  it("fails closed when an active graph pointer cannot be read", () => {
    const root = mkdtempSync(join(tmpdir(), "projection-prune-malformed-"));
    const graphRoot = join(root, "graphs");
    mkdirSync(join(graphRoot, "other"), { recursive: true });
    writeFileSync(join(graphRoot, "other", "current.json"), "not json");

    expect(readActiveProjectionReferences(graphRoot)).toBeNull();
  });
});
