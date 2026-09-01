import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HoraeSerialGate } from "../scripts/input/mainline/collect-one-task-input-pack-sparkindex.ts";
import {
  fillHoraeRelationCache,
  rowsOfHoraeRelation,
} from "../scripts/input/mainline/fill-horae-relation-cache.ts";
import {
  readHoraeRelationCache,
  resolveScheduleEvidenceCacheRoot,
  writeHoraeRelationCache,
} from "../scripts/reconcile/consumer/one-hop/schedule-evidence-cache.ts";

function makeTaskDirectories(cacheRoot: string, taskIds: readonly string[]): void {
  const tasksRoot = join(resolveScheduleEvidenceCacheRoot(cacheRoot), "tasks");
  for (const taskId of taskIds) {
    mkdirSync(join(tasksRoot, taskId), { recursive: true });
  }
}

describe("fillHoraeRelationCache", () => {
  it("skips HIT, fills MISS serially, and resumes from start-task-id", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "horae-relation-fill-"));
    try {
      makeTaskDirectories(cacheRoot, ["100", "200", "300", "400"]);
      writeHoraeRelationCache(
        "100",
        "2026-08-31T00:00:00.000Z",
        [{ task_id: "100" }],
        cacheRoot,
        "down",
      );
      writeHoraeRelationCache(
        "200",
        "2026-08-31T00:00:00.000Z",
        [{ task_id: "200" }],
        cacheRoot,
        "down",
      );

      const starts: string[] = [];
      const summary = await fillHoraeRelationCache({
        cacheRoot,
        startTaskId: "200",
        direction: "down",
        maxErrors: 3,
        minIntervalMs: 0,
        gate: new HoraeSerialGate({ minIntervalMs: 0 }),
        runner: (taskId) => {
          starts.push(taskId);
          return [{ task_id: `child-${taskId}` }];
        },
      });

      expect(summary).toMatchObject({
        total: 3,
        skipped: 1,
        cached: 2,
        errors: 0,
        stopped: false,
        direction: "down",
        startTaskId: "200",
      });
      expect(starts).toEqual(["300", "400"]);
      expect(readHoraeRelationCache("300", cacheRoot, "down")).toMatchObject({
        status: "HIT",
      });
      expect(readHoraeRelationCache("400", cacheRoot, "down")).toMatchObject({
        status: "HIT",
      });
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("stops after max-errors and leaves failed tasks as MISS", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "horae-relation-errors-"));
    try {
      makeTaskDirectories(cacheRoot, ["1", "2", "3"]);
      const summary = await fillHoraeRelationCache({
        cacheRoot,
        direction: "down",
        maxErrors: 2,
        minIntervalMs: 0,
        gate: new HoraeSerialGate({ minIntervalMs: 0 }),
        runner: (taskId) => {
          throw new Error(`HTTP 429 for ${taskId}`);
        },
      });
      expect(summary.errors).toBe(2);
      expect(summary.stopped).toBe(true);
      expect(summary.failedTaskIds).toEqual(["1", "2"]);
      expect(readHoraeRelationCache("1", cacheRoot, "down").status).toBe("MISS");
      expect(readHoraeRelationCache("3", cacheRoot, "down").status).toBe("MISS");
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("parses empty relation envelopes as empty rows", () => {
    expect(rowsOfHoraeRelation([], "1")).toEqual([]);
    expect(rowsOfHoraeRelation({ records: [] }, "1")).toEqual([]);
  });
});
