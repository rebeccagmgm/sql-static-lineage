import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { createTaskDocument } from "../scripts/input/shared/input-pack.ts";
import { runLineageAll } from "../scripts/pipeline/lineage-all.ts";

function writeRootTask(dataRoot: string, taskId: string): void {
  const taskDirectory = join(dataRoot, "tasks", "sparkIndex", taskId);
  mkdirSync(taskDirectory, { recursive: true });
  writeFileSync(
    join(taskDirectory, "task.json"),
    JSON.stringify(
      createTaskDocument({
        taskId,
        taskCategory: "sparkIndex",
        target: {
          platform: "hive",
          dataSource: "gfhive",
          qualifiedName: `demo.${taskId}`,
        },
      }),
    ),
  );
}

function fakeOneHop(taskId: string): any {
  return {
    schemaVersion: "1.1.0",
    taskId,
    generatedAt: "2026-08-28T00:00:00.000Z",
  };
}

function fakeMultiHop(rootTaskId: string): any {
  return {
    schemaVersion: "1.1.0",
    artifactType: "TABLE_MULTI_HOP_RECONCILIATION",
    rootTaskId,
    generatedAt: "2026-08-28T00:00:00.000Z",
    taskNodes: [{ taskId: rootTaskId }],
  };
}

describe("lineage:all root-local batch failures", () => {
  it("keeps root-a successful and root-b failed with one shared batch call", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "lineage-all-batch-failure-"));
    mkdirSync(join(dataRoot, "tables"), { recursive: true });
    const roots = ["root-a", "root-b"];
    for (const taskId of roots) writeRootTask(dataRoot, taskId);

    let oneHopBatchCalls = 0;
    let multiHopBatchCalls = 0;
    const oneHopTaskIds: string[][] = [];
    const multiHopRootIds: string[][] = [];

    const result = runLineageAll({
      dataRoot,
      taskIds: roots,
      dependencies: {
        autofill: ({ taskId }) => ({
          taskIds: [taskId],
          discoveredTaskIds: [taskId],
          collectedTaskIds: [],
          rounds: 1,
          status: "COMPLETE",
          issues: [],
        }),
        producerIndex: () => ({
          index: {} as any,
          manifest: {} as any,
          inputFingerprint: "fake-fingerprint",
          indexPath: "fake-index",
          manifestPath: "fake-manifest",
          reused: true,
        }),
        machineFacts: () => ({
          tasks: [],
          timings: { index_mode: "incremental" },
        }) as any,
        oneHopBatch: (taskIds) => {
          oneHopBatchCalls += 1;
          oneHopTaskIds.push([...taskIds]);
          return [
            fakeOneHop("root-a"),
            {
              taskId: "root-b",
              status: "FAILED",
              evidenceStatus: "UNRESOLVED",
              error: "ROOT_B_ONE_HOP_FAILED",
            },
          ];
        },
        multiHop: (rootTaskIds: unknown) => {
          multiHopBatchCalls += 1;
          const ids = (Array.isArray(rootTaskIds) ? rootTaskIds : [rootTaskIds])
            .filter((value): value is string => typeof value === "string");
          multiHopRootIds.push(ids);
          return fakeMultiHop("root-a");
        },
        visualizeMultiHop: ({ outputPath }) => {
          mkdirSync(dirname(outputPath!), { recursive: true });
          writeFileSync(outputPath!, "<html></html>\n");
          return outputPath!;
        },
      },
    });

    expect(oneHopBatchCalls).toBe(1);
    expect(multiHopBatchCalls).toBe(1);
    expect(oneHopTaskIds).toEqual([roots]);
    expect(multiHopRootIds).toEqual([["root-a"]]);
    expect(result.status).toBe("PARTIAL_FAILURE");
    expect(result.tasks).toEqual([
      expect.objectContaining({ taskId: "root-a", status: "SUCCESS" }),
      expect.objectContaining({
        taskId: "root-b",
        status: "FAILED",
        error: expect.stringContaining("ONE_HOP_ROOT_LOCAL_FAILURE:root-b"),
      }),
    ]);
  });

  it("keeps a lock failure local without staging or publishing that root", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "lineage-all-lock-failure-"));
    mkdirSync(join(dataRoot, "tables"), { recursive: true });
    const artifactRoot = join(dataRoot, "artifacts");
    const roots = ["root-a", "root-b"];
    for (const taskId of roots) writeRootTask(dataRoot, taskId);
    mkdirSync(join(artifactRoot, ".locks"), { recursive: true });
    const rootALock = join(artifactRoot, ".locks", "root-a.lock");
    writeFileSync(rootALock, "held\n");

    let oneHopBatchCalls = 0;
    let multiHopBatchCalls = 0;
    const rootLocalStageStarts: string[] = [];
    const fieldLineageRoots: string[] = [];
    const tableRenderRoots: string[] = [];
    const fieldRenderRoots: string[] = [];
    const publishRoots: string[] = [];

    const result = runLineageAll({
      dataRoot,
      artifactRoot,
      taskIds: roots,
      withFields: true,
      stageObserver: (event) => {
        if (event.phase === "start" && ["json-write", "html-render", "field-lineage-reconcile", "publish"].includes(event.stage))
          rootLocalStageStarts.push(`${event.stage}:${event.taskId}`);
        if (event.phase === "end" && event.status === "SUCCESS" && event.stage === "html-render" && event.details?.kind === "table")
          tableRenderRoots.push(event.taskId);
        if (event.phase === "end" && event.status === "SUCCESS" && event.stage === "html-render" && event.details?.kind === "field")
          fieldRenderRoots.push(event.taskId);
        if (event.phase === "start" && event.stage === "publish") publishRoots.push(event.taskId);
      },
      dependencies: {
        autofill: ({ taskId }) => ({
          taskIds: [taskId],
          discoveredTaskIds: [taskId],
          collectedTaskIds: [],
          rounds: 1,
          status: "COMPLETE",
          issues: [],
        }),
        producerIndex: () => ({
          index: {} as any,
          manifest: {} as any,
          inputFingerprint: "fake-fingerprint",
          indexPath: "fake-index",
          manifestPath: "fake-manifest",
          reused: true,
        }),
        machineFacts: () => ({ tasks: [], timings: { index_mode: "incremental" } }) as any,
        oneHopBatch: (taskIds) => {
          oneHopBatchCalls += 1;
          return taskIds.map(fakeOneHop);
        },
        multiHop: (rootTaskIds: unknown) => {
          multiHopBatchCalls += 1;
          const ids = (Array.isArray(rootTaskIds) ? rootTaskIds : [rootTaskIds])
            .filter((value): value is string => typeof value === "string");
          return ids.map(fakeMultiHop);
        },
        fieldLineage: ({ rootTaskId }) => {
          fieldLineageRoots.push(rootTaskId);
          return {} as any;
        },
        visualizeMultiHop: ({ taskId, outputPath }) => {
          mkdirSync(dirname(outputPath!), { recursive: true });
          writeFileSync(outputPath!, "<html></html>\n");
          return outputPath!;
        },
        visualizeFieldLineage: ({ outputPath }) => {
          mkdirSync(dirname(outputPath!), { recursive: true });
          writeFileSync(outputPath!, "<html></html>\n");
          return outputPath!;
        },
      },
    });

    expect(oneHopBatchCalls).toBe(1);
    expect(multiHopBatchCalls).toBe(1);
    expect(result.status).toBe("PARTIAL_FAILURE");
    expect(result.tasks).toEqual([
      expect.objectContaining({
        taskId: "root-a",
        status: "FAILED",
        error: expect.stringContaining("TASK_LOCK_UNAVAILABLE:root-a"),
      }),
      expect.objectContaining({ taskId: "root-b", status: "SUCCESS" }),
    ]);
    expect(rootLocalStageStarts.every((entry) => entry.endsWith(":root-b"))).toBe(true);
    expect(fieldLineageRoots).toEqual(["root-b"]);
    expect(tableRenderRoots).toEqual(["root-b"]);
    expect(fieldRenderRoots).toEqual(["root-b"]);
    expect(publishRoots).toEqual(["root-b"]);
    expect(existsSync(rootALock)).toBe(true);
    expect(existsSync(join(artifactRoot, ".locks", "root-b.lock"))).toBe(false);
    expect(existsSync(join(artifactRoot, "tasks", "root-a"))).toBe(false);
  });
});
