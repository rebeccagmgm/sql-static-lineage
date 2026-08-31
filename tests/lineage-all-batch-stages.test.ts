import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { createTaskDocument } from "../scripts/input/shared/input-pack.ts";
import { runLineageAll } from "../scripts/pipeline/lineage-all.ts";

function writeRootTask(dataRoot: string, taskId: string): void {
  const taskDirectory = join(dataRoot, "tasks", "sparkIndex", taskId);
  mkdirSync(taskDirectory, { recursive: true });
  writeFileSync(
    join(taskDirectory, "task.json"),
    JSON.stringify(createTaskDocument({
      taskId,
      taskCategory: "sparkIndex",
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName: `demo.${taskId}`,
      },
    })),
  );
}

function fakeOneHop(taskId: string): any {
  return {
    schemaVersion: "1.1.0",
    taskId,
    generatedAt: "2026-08-28T00:00:00.000Z",
  };
}

function fakeMultiHop(taskId: string): any {
  return {
    schemaVersion: "1.1.0",
    artifactType: "TABLE_MULTI_HOP_RECONCILIATION",
    rootTaskId: taskId,
    generatedAt: "2026-08-28T00:00:00.000Z",
    taskNodes: [{ taskId }],
  };
}

describe("lineage:all batch stages", () => {
  it("shares main-chain stages across root tasks while keeping root outputs separate", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "lineage-all-batch-stages-"));
    mkdirSync(join(dataRoot, "tables"), { recursive: true });
    const roots = ["root-a", "root-b"];
    for (const taskId of roots) writeRootTask(dataRoot, taskId);

    const closureByRoot = new Map<string, readonly string[]>([
      ["root-a", ["root-a", "shared-task"]],
      ["root-b", ["root-b", "shared-task", "branch-task"]],
    ]);
    const closureUnion = [...new Set([...closureByRoot.values()].flat())].sort();
    const calls = {
      autofillRoots: [] as string[],
      producerIndexTaskIds: [] as (string | undefined)[],
      machineFactsTaskIds: [] as string[][],
      oneHopTaskIds: [] as string[][],
      multiHopRootInputs: [] as string[][],
      fieldLineageRoots: [] as string[],
      tableRenderRoots: [] as string[],
      fieldRenderRoots: [] as string[],
      publishRoots: [] as string[],
    };

    const result = runLineageAll({
      dataRoot,
      taskIds: roots,
      withFields: true,
      stageObserver: (event) => {
        if (event.stage === "html-render" && event.phase === "end" && event.details?.kind === "field")
          calls.fieldRenderRoots.push(event.taskId);
        if (event.stage === "publish" && event.phase === "start") calls.publishRoots.push(event.taskId);
      },
      dependencies: {
        autofill: ({ taskId }) => {
          calls.autofillRoots.push(taskId);
          const taskIds = closureByRoot.get(taskId);
          if (!taskIds) throw new Error(`MISSING_CLOSURE:${taskId}`);
          return {
            taskIds,
            discoveredTaskIds: taskIds,
            collectedTaskIds: [],
            rounds: 1,
            status: "COMPLETE",
            issues: [],
          };
        },
        producerIndex: (_dataRoot, _cacheRoot, options) => {
          calls.producerIndexTaskIds.push(options?.taskId);
          return {
            index: {} as any,
            manifest: {} as any,
            inputFingerprint: "fake-fingerprint",
            indexPath: "fake-index",
            manifestPath: "fake-manifest",
            reused: true,
          };
        },
        machineFacts: ({ taskIds }) => {
          calls.machineFactsTaskIds.push([...taskIds]);
          return { tasks: [], timings: { index_mode: "incremental" } } as any;
        },
        oneHopBatch: (taskIds) => {
          calls.oneHopTaskIds.push([...taskIds]);
          return taskIds.map(fakeOneHop);
        },
        multiHop: ((rootTaskIds: unknown) => {
          const rootsInCall = (Array.isArray(rootTaskIds) ? rootTaskIds : [rootTaskIds])
            .filter((value): value is string => typeof value === "string");
          calls.multiHopRootInputs.push(rootsInCall);
          return rootsInCall.map((taskId) => fakeMultiHop(taskId));
        }) as any,
        fieldLineage: ({ rootTaskId }) => {
          calls.fieldLineageRoots.push(rootTaskId);
          return {} as any;
        },
        visualizeMultiHop: ({ taskId, outputPath }) => {
          calls.tableRenderRoots.push(taskId);
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

    expect(result.status).toBe("SUCCESS");
    expect({
      callCounts: {
        autofill: calls.autofillRoots.length,
        producerIndex: calls.producerIndexTaskIds.length,
        machineFacts: calls.machineFactsTaskIds.length,
        oneHopBatch: calls.oneHopTaskIds.length,
        multiHop: calls.multiHopRootInputs.length,
        fieldLineage: calls.fieldLineageRoots.length,
        tableRender: calls.tableRenderRoots.length,
        fieldRender: calls.fieldRenderRoots.length,
        publish: calls.publishRoots.length,
      },
      autofillRoots: calls.autofillRoots,
      machineFactsTaskIds: calls.machineFactsTaskIds.map((taskIds) => [...taskIds].sort()),
      oneHopTaskIds: calls.oneHopTaskIds.map((taskIds) => [...taskIds].sort()),
      multiHopRootInputs: calls.multiHopRootInputs.map((taskIds) => [...taskIds].sort()),
      fieldLineageRoots: calls.fieldLineageRoots,
      tableRenderRoots: calls.tableRenderRoots,
      fieldRenderRoots: calls.fieldRenderRoots,
      publishRoots: calls.publishRoots,
    }).toEqual({
      callCounts: {
        autofill: 2,
        producerIndex: 1,
        machineFacts: 1,
        oneHopBatch: 1,
        multiHop: 1,
        fieldLineage: 2,
        tableRender: 2,
        fieldRender: 2,
        publish: 2,
      },
      autofillRoots: roots,
      machineFactsTaskIds: [closureUnion],
      oneHopTaskIds: [closureUnion],
      multiHopRootInputs: [roots],
      fieldLineageRoots: roots,
      tableRenderRoots: roots,
      fieldRenderRoots: roots,
      publishRoots: roots,
    });
  });
});
