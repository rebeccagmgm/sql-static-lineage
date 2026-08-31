import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { createTaskDocument } from "../scripts/input/shared/input-pack.ts";
import type { InputPackMachineFactsRunResult } from "../scripts/machine-facts/input-pack-machine-facts.ts";
import {
  formalArtifactPaths,
  runLineageAll,
  type LineageAllDependencies,
} from "../scripts/pipeline/lineage-all.ts";
import type { FieldLineageArtifact } from "../scripts/reconcile/consumer/field-lineage/field-lineage-contract.ts";
import type { MultiHopReconciliationResult } from "../scripts/reconcile/consumer/multi-hop/reconcile-multi-hop.ts";
import type { OneHopReconciliationResult } from "../scripts/reconcile/consumer/one-hop/reconcile-one-hop.ts";
import type {
  PinTableProducerIndexResult,
  TableProducerIndex,
  TableProducerInputManifest,
} from "../scripts/reconcile/producer/producer-index.ts";

function writeRootTask(dataRoot: string, taskId: string, qualifiedName = `demo.${taskId}`): string {
  const taskDirectory = join(dataRoot, "tasks", "sparkIndex", taskId);
  mkdirSync(taskDirectory, { recursive: true });
  const taskPath = join(taskDirectory, "task.json");
  writeFileSync(
    taskPath,
    JSON.stringify(createTaskDocument({
      taskId,
      taskCategory: "sparkIndex",
      target: {
        platform: "hive",
        dataSource: "gfhive",
        qualifiedName,
      },
    })),
  );
  return taskPath;
}

function fakeOneHop(taskId: string): OneHopReconciliationResult {
  return {
    schemaVersion: "1.1.0",
    taskId,
    generatedAt: "2026-08-28T00:00:00.000Z",
  } as unknown as OneHopReconciliationResult;
}

function fakeMultiHop(rootTaskId: string): MultiHopReconciliationResult {
  return {
    schemaVersion: "1.1.0",
    artifactType: "TABLE_MULTI_HOP_RECONCILIATION",
    rootTaskId,
    generatedAt: "2026-08-28T00:00:00.000Z",
    taskNodes: [{ taskId: rootTaskId }],
  } as unknown as MultiHopReconciliationResult;
}

function fakeProducerIndex(): PinTableProducerIndexResult {
  return {
    index: {} as TableProducerIndex,
    manifest: {} as TableProducerInputManifest,
    inputFingerprint: "fake-fingerprint",
    indexPath: "fake-index",
    manifestPath: "fake-manifest",
    reused: true,
  };
}

function fakeMachineFacts(): InputPackMachineFactsRunResult {
  return {
    tasks: [],
    timings: { index_mode: "incremental" },
  } as unknown as InputPackMachineFactsRunResult;
}

describe("lineage:all final freshness fence", () => {
  it("fails every root after staging but before publish and preserves existing artifacts", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "lineage-all-freshness-fence-"));
    mkdirSync(join(dataRoot, "tables"), { recursive: true });
    const roots = ["root-a", "root-b"];
    for (const taskId of roots) writeRootTask(dataRoot, taskId);

    const artifactRoot = join(dataRoot, "artifacts");
    const sentinelByPath = new Map<string, string>();
    for (const taskId of roots) {
      const paths = formalArtifactPaths(artifactRoot, taskId);
      mkdirSync(paths.views, { recursive: true });
      for (const [path, content] of [
        [paths.oneHop, `${taskId}-old-one-hop\n`],
        [paths.multiHop, `${taskId}-old-multi-hop\n`],
        [paths.fieldLineage, `${taskId}-old-field\n`],
        [paths.tableHtml, `${taskId}-old-table-html\n`],
        [paths.fieldHtml, `${taskId}-old-field-html\n`],
      ] as const) {
        writeFileSync(path, content);
        sentinelByPath.set(path, content);
      }
    }

    let multiHopCalls = 0;
    let fieldLineageCalls = 0;
    let tableRenderCalls = 0;
    let fieldRenderCalls = 0;
    let publishStageStarts = 0;
    let jsonWriteStageStarts = 0;
    let mutatedAfterStaging = false;

    const result = runLineageAll({
      dataRoot,
      artifactRoot,
      taskIds: roots,
      withFields: true,
      stageObserver: (event) => {
        if (event.stage === "publish" && event.phase === "start") publishStageStarts += 1;
        if (event.stage === "json-write" && event.phase === "start") jsonWriteStageStarts += 1;
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
        producerIndex: (() => fakeProducerIndex()) as LineageAllDependencies["producerIndex"],
        machineFacts: () => fakeMachineFacts(),
        oneHopBatch: (taskIds) => taskIds.map(fakeOneHop),
        multiHop: (rootTaskIds: unknown) => {
          multiHopCalls += 1;
          const ids = (Array.isArray(rootTaskIds) ? rootTaskIds : [rootTaskIds])
            .filter((value): value is string => typeof value === "string");
          return ids.map(fakeMultiHop);
        },
        fieldLineage: () => {
          fieldLineageCalls += 1;
          return {} as unknown as FieldLineageArtifact;
        },
        visualizeMultiHop: ({ outputPath }) => {
          if (!outputPath) throw new Error("TABLE_OUTPUT_PATH_REQUIRED");
          tableRenderCalls += 1;
          mkdirSync(dirname(outputPath), { recursive: true });
          writeFileSync(outputPath, "<html></html>\n");
          return outputPath;
        },
        visualizeFieldLineage: ({ outputPath }) => {
          if (!outputPath) throw new Error("FIELD_OUTPUT_PATH_REQUIRED");
          fieldRenderCalls += 1;
          mkdirSync(dirname(outputPath), { recursive: true });
          writeFileSync(outputPath, "<html></html>\n");
          if (!mutatedAfterStaging) {
            mutatedAfterStaging = true;
            writeRootTask(dataRoot, "root-a", "demo.root-a-changed-after-staging");
          }
          return outputPath;
        },
      },
    });

    expect(multiHopCalls).toBe(1);
    expect(mutatedAfterStaging).toBe(true);
    expect(fieldLineageCalls).toBe(2);
    expect(tableRenderCalls).toBe(2);
    expect(fieldRenderCalls).toBe(2);
    expect(jsonWriteStageStarts).toBe(4);
    expect(publishStageStarts).toBe(0);
    expect(result.status).toBe("PARTIAL_FAILURE");
    expect(result.tasks).toHaveLength(2);
    for (const task of result.tasks) {
      expect(task.status).toBe("FAILED");
      expect(task.error).toBe("INPUT_CHANGED_BEFORE_PUBLISH");
      expect(task.files).toEqual([]);
    }
    for (const [path, content] of sentinelByPath) {
      expect(existsSync(path)).toBe(true);
      expect(readFileSync(path, "utf8")).toBe(content);
    }
    expect(existsSync(join(artifactRoot, ".staging"))).toBe(false);
  });
});
