import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runInputPackMachineFacts } from "../../../scripts/machine-facts/input-pack-machine-facts.ts";
import { sha256 } from "../../../scripts/machine-facts/machine-facts-contract.ts";
import {
  writeTableInput,
  writeTaskInput,
} from "../../../scripts/input/shared/input-pack.ts";
import { projectTaskLocalBatch } from "../../../scripts/project-graph/task-local/project-task-local-batch.ts";
import { canonicalizeTaskLocalProjection, taskLocalProjectionContentHash } from "../../../scripts/project-graph/task-local/contract.ts";
import {
  packContentHashForTask,
  projectionBytesEqualIgnoringGeneratedAt,
  resolveTaskLocalCacheKeyParts,
  storeTaskLocalProjectionCache,
  taskLocalCacheKey,
  taskLocalProjectionVersionPath,
} from "../../../scripts/project-graph/task-local/projection-cache.ts";

function writeDemoTables(dataRoot: string): void {
  for (const table of [
    { qualifiedName: "demo.stati", columns: "internal_trade_id STRING, stati_cont_desc STRING" },
    { qualifiedName: "demo.trades", columns: "internal_trade_id STRING, v STRING" },
  ]) {
    writeTableInput(dataRoot, {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: table.qualifiedName,
      objectType: "hive_table",
      partitionFields: [],
      ddl: `CREATE TABLE ${table.qualifiedName} (${table.columns});`,
      evidenceProvider: "synthetic:test",
      collectedAt: "2026-01-01T00:00:00.000Z",
    });
  }
}

function writeDemoTask(dataRoot: string, taskId: string, extraSql = ""): void {
  writeTaskInput(dataRoot, {
    taskId,
    taskCategory: "sparkIndex",
    taskName: `demo.stati.${taskId}`,
    target: {
      platform: "hive",
      dataSource: "warehouse",
      qualifiedName: "demo.stati",
    },
    targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
    partition: null,
    sql: {
      query: {
        content:
          `INSERT OVERWRITE TABLE demo.stati SELECT t.internal_trade_id AS internal_trade_id, t.v AS stati_cont_desc FROM demo.trades t; ${extraSql}`,
        evidenceProvider: "synthetic:test",
      },
    },
    evidenceProvider: "synthetic:test",
    collectedAt: "2026-01-01T00:00:00.000Z",
  });
}

function setupProjectedTasks(taskIds: readonly string[]): {
  dataRoot: string;
  factsRoot: string;
} {
  const parent = mkdtempSync(join(tmpdir(), "task-local-cache-"));
  const dataRoot = join(parent, "data");
  const factsRoot = join(parent, "facts");
  writeDemoTables(dataRoot);
  for (const taskId of taskIds) writeDemoTask(dataRoot, taskId);
  runInputPackMachineFacts({
    dataRoot,
    taskIds: [...taskIds],
    outputRoot: factsRoot,
  });
  return { dataRoot, factsRoot };
}

function mutatePackContentHash(dataRoot: string, taskId: string): string {
  const packPath = join(dataRoot, "tasks", "sparkIndex", taskId, "task.json");
  const document = JSON.parse(readFileSync(packPath, "utf8")) as Record<string, unknown>;
  document.contentHash = sha256(`mutated-pack:${taskId}:${String(document.contentHash)}`);
  writeFileSync(packPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  return String(document.contentHash);
}

describe("task-local projection cache (TL-4)", () => {
  it("invalidates primary-only generator 1.3.8 output and reuses the rebuilt multi-output projection", () => {
    const taskId = "300098";
    const { dataRoot, factsRoot } = setupProjectedTasks([taskId]);
    writeDemoTask(dataRoot, taskId,
      "INSERT OVERWRITE TABLE demo.trades SELECT internal_trade_id, stati_cont_desc AS v FROM demo.stati;");
    expect(runInputPackMachineFacts({ dataRoot, taskIds: [taskId], outputRoot: factsRoot }).tasks[0]?.state)
      .toBe("SUCCESS");
    const current = projectTaskLocalBatch({ dataRoot, factsRoot, taskIds: [taskId] }).projections[0]!;
    expect(current.localClosure).toBeDefined();
    const currentClosure = current.localClosure!;
    expect(currentClosure.finalWrites.map((write) => write.qualifiedName).sort())
      .toEqual(["demo.stati", "demo.trades"]);
    const legacyInput = {
      ...current,
      localClosure: {
        ...currentClosure,
        finalWrites: currentClosure.finalWrites
          .filter((write) => write.qualifiedName === "demo.stati")
          .map(({ outputQualification: _qualification, ...write }) => write),
      },
    };
    const legacy = canonicalizeTaskLocalProjection({
      ...legacyInput,
      contentHash: taskLocalProjectionContentHash(legacyInput),
    });
    const outputRoot = mkdtempSync(join(tmpdir(), "task-local-generator-upgrade-"));
    const legacyEnvelope = storeTaskLocalProjectionCache({
      outputRoot,
      cacheKeyParts: {
        ...resolveTaskLocalCacheKeyParts({ taskId, dataRoot, factsRoot }),
        generatorVersion: "1.3.8",
      },
      projection: legacy,
    });
    const legacyVersion = taskLocalProjectionVersionPath(outputRoot, taskId, legacyEnvelope.cacheKey);
    const legacyBytes = readFileSync(legacyVersion, "utf8");

    const rebuilt = projectTaskLocalBatch({ dataRoot, factsRoot, taskIds: [taskId], outputRoot });
    expect(rebuilt.cache).toEqual({ hits: 0, misses: 1 });
    expect(rebuilt.results[0]!.cacheKey).not.toBe(legacyEnvelope.cacheKey);
    expect(rebuilt.projections[0]!.localClosure?.finalWrites).toEqual(currentClosure.finalWrites);
    expect(readFileSync(legacyVersion, "utf8")).toBe(legacyBytes);

    const hot = projectTaskLocalBatch({ dataRoot, factsRoot, taskIds: [taskId], outputRoot });
    expect(hot.cache).toEqual({ hits: 1, misses: 0 });
    expect(hot.projections[0]!.contentHash).toBe(rebuilt.projections[0]!.contentHash);
  });

  it("keeps a published version readable after the current task changes", () => {
    const { dataRoot, factsRoot } = setupProjectedTasks(["300099"]);
    const outputRoot = mkdtempSync(join(tmpdir(), "task-local-immutable-"));
    const first = projectTaskLocalBatch({ dataRoot, factsRoot, outputRoot, taskIds: ["300099"] });
    const version = taskLocalProjectionVersionPath(outputRoot, "300099", first.results[0]!.cacheKey);
    const original = readFileSync(version, "utf8");
    mutatePackContentHash(dataRoot, "300099");
    const second = projectTaskLocalBatch({ dataRoot, factsRoot, outputRoot, taskIds: ["300099"] });
    expect(second.results[0]!.cacheKey).not.toBe(first.results[0]!.cacheKey);
    expect(readFileSync(version, "utf8")).toBe(original);
    expect(JSON.parse(original).projection.contentHash).toBe(first.projections[0]!.contentHash);
  });
  it("hits every unchanged task on the second batch", () => {
    const { dataRoot, factsRoot } = setupProjectedTasks(["105387"]);
    const outputRoot = mkdtempSync(join(tmpdir(), "task-local-cache-out-"));
    const first = projectTaskLocalBatch({
      dataRoot,
      factsRoot,
      taskIds: ["105387"],
      outputRoot,
      generatedAt: "2026-09-02T00:00:00.000Z",
    });
    expect(first.cache).toEqual({ hits: 0, misses: 1 });
    expect(first.results[0]?.cacheHit).toBe(false);

    const second = projectTaskLocalBatch({
      dataRoot,
      factsRoot,
      taskIds: ["105387"],
      outputRoot,
      generatedAt: "2026-09-02T01:00:00.000Z",
    });
    expect(second.cache).toEqual({ hits: 1, misses: 0 });
    expect(second.results[0]?.cacheHit).toBe(true);
    expect(
      projectionBytesEqualIgnoringGeneratedAt(
        first.projections[0]!,
        second.projections[0]!,
      ),
    ).toBe(true);
    expect(second.projections[0]?.generatedAt).toBe(first.projections[0]?.generatedAt);
  });

  it("misses only the task whose pack content hash changed", () => {
    const { dataRoot, factsRoot } = setupProjectedTasks(["200001", "200002"]);
    const outputRoot = mkdtempSync(join(tmpdir(), "task-local-cache-multi-out-"));
    const warm = projectTaskLocalBatch({
      dataRoot,
      factsRoot,
      taskIds: ["200001", "200002"],
      outputRoot,
      generatedAt: "2026-09-02T00:00:00.000Z",
    });
    expect(warm.cache).toEqual({ hits: 0, misses: 2 });

    mutatePackContentHash(dataRoot, "200001");
    const again = projectTaskLocalBatch({
      dataRoot,
      factsRoot,
      taskIds: ["200001", "200002"],
      outputRoot,
      generatedAt: "2026-09-02T01:00:00.000Z",
    });
    expect(again.cache).toEqual({ hits: 1, misses: 1 });
    const byTask = new Map(again.results.map((result) => [result.taskId, result]));
    expect(byTask.get("200001")?.cacheHit).toBe(false);
    expect(byTask.get("200002")?.cacheHit).toBe(true);
  });

  it("includes pack hash, facts fingerprint, and schema version in the cache key", () => {
    const { dataRoot, factsRoot } = setupProjectedTasks(["300001"]);
    const before = resolveTaskLocalCacheKeyParts({
      taskId: "300001",
      dataRoot,
      factsRoot,
    });
    expect(before.schemaVersion).toBe("1.3.0");
    expect(before.packContentHash).toBe(packContentHashForTask(dataRoot, "300001"));
    expect(before.factsManifestSha256).not.toBe("NO_FACTS");

    const beforeKey = taskLocalCacheKey(before);
    expect(
      taskLocalCacheKey({
        ...before,
        schemaVersion: "9.9.9" as typeof before.schemaVersion,
      }),
    ).not.toBe(beforeKey);

    mutatePackContentHash(dataRoot, "300001");
    const afterPack = resolveTaskLocalCacheKeyParts({
      taskId: "300001",
      dataRoot,
      factsRoot,
    });
    expect(afterPack.packContentHash).not.toBe(before.packContentHash);
    expect(taskLocalCacheKey(afterPack)).not.toBe(beforeKey);
  });
});
