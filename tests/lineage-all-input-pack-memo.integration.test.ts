import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import {
  canonicalHash,
  canonicalJson,
  sha256Text,
  type JsonValue,
} from "../scripts/input/shared/input-pack.ts";
import {
  runLineageAll,
} from "../scripts/pipeline/lineage-all.ts";
import type { TableProducerInputManifest } from "../scripts/reconcile/producer/producer-index.ts";

function manifest(): TableProducerInputManifest {
  const packs: TableProducerInputManifest["packs"] = [];
  const withoutHash = {
    schemaVersion: "1.0.0" as const,
    artifactType: "TABLE_PRODUCER_INPUT_MANIFEST" as const,
    generatedAt: "2026-08-28T00:00:00.000Z",
    generation: 1,
    inputFingerprint: sha256Text(canonicalJson(packs as unknown as JsonValue)),
    packs,
  };
  return {
    ...withoutHash,
    contentHash: canonicalHash(
      withoutHash as unknown as JsonValue,
      ["generatedAt", "contentHash"],
    ),
  };
}

function fakeOneHop(taskId: string): any {
  return {
    schemaVersion: "1.1.0",
    taskId,
    generatedAt: "2026-08-28T00:00:00.000Z",
  };
}

function fakeMultiHop(taskIds: readonly string[] | string): any {
  const rootTaskIds = Array.isArray(taskIds) ? taskIds : [taskIds];
  return rootTaskIds.map((taskId) => ({
    schemaVersion: "1.1.0",
    artifactType: "TABLE_MULTI_HOP_RECONCILIATION",
    rootTaskId: taskId,
    generatedAt: "2026-08-28T00:00:00.000Z",
    taskNodes: [{ taskId }],
  }));
}

describe("lineage:all Input Pack manifest memo integration", () => {
  it("captures once and shares the manifest across two Task closures and pins", () => {
    const root = mkdtempSync(join(tmpdir(), "lineage-all-input-pack-memo-"));
    mkdirSync(join(root, "tasks"), { recursive: true });
    mkdirSync(join(root, "tables"), { recursive: true });
    const captured = manifest();
    let captureCount = 0;
    const closureManifests: TableProducerInputManifest[] = [];
    const pinManifests: TableProducerInputManifest[] = [];
    const closureMemos: unknown[] = [];
    const pinMemos: unknown[] = [];
    const oneHopOptions: unknown[] = [];
    const multiHopOptions: unknown[] = [];

    const result = runLineageAll({
      dataRoot: root,
      taskIds: ["memo-a", "memo-b"],
      inputPackManifestCapture: () => {
        captureCount += 1;
        return captured;
      },
      dependencies: {
        autofill: (options) => {
          closureMemos.push(options.inputPackManifestMemo);
          const current = options.inputPackManifestMemo?.capture();
          if (!current) throw new Error("MEMO_NOT_PROVIDED_TO_CLOSURE");
          closureManifests.push(current);
          return {
            taskIds: [options.taskId],
            discoveredTaskIds: [options.taskId],
            collectedTaskIds: [],
            rounds: 1,
            status: "COMPLETE",
            issues: [],
          };
        },
        producerIndex: (_dataRoot, _cacheRoot, options) => {
          pinMemos.push(options?.inputPackManifestMemo);
          const current = options?.inputPackManifestMemo?.capture();
          if (!current) throw new Error("MEMO_NOT_PROVIDED_TO_PIN");
          pinManifests.push(current);
          return {
            index: { inputFingerprint: current.inputFingerprint } as any,
            manifest: current,
            inputFingerprint: current.inputFingerprint,
            indexPath: "index",
            manifestPath: "manifest",
            reused: true,
          };
        },
        machineFacts: () => ({
          tasks: [],
          timings: { index_mode: "incremental" },
        }) as any,
        oneHopBatch: (taskIds, options) => {
          oneHopOptions.push(options);
          return taskIds.map(fakeOneHop);
        },
        multiHop: (taskId, options) => {
          multiHopOptions.push(options);
          return fakeMultiHop(taskId);
        },
        visualizeMultiHop: ({ outputPath }) => {
          mkdirSync(dirname(outputPath!), { recursive: true });
          writeFileSync(outputPath!, "<html></html>\n");
          return outputPath!;
        },
      },
    });

    expect(result.status).toBe("SUCCESS");
    expect(captureCount).toBe(1);
    expect(closureManifests).toHaveLength(2);
    // The batch producer-index pin is shared by both roots, so it runs once.
    expect(pinManifests).toHaveLength(1);
    expect(closureManifests[0]).toBe(captured);
    expect(closureManifests[1]).toBe(captured);
    expect(pinManifests[0]).toBe(captured);
    expect(closureMemos[0]).toBe(closureMemos[1]);
    expect(pinMemos).toHaveLength(1);
    expect(pinMemos[0]).toBe(closureMemos[0]);
    expect(oneHopOptions.every((options) => !("inputPackManifestMemo" in (options as object)))).toBe(true);
    expect(multiHopOptions.every((options) => !("inputPackManifestMemo" in (options as object)))).toBe(true);
    for (const taskId of ["memo-a", "memo-b"])
      expect(result.tasks.find((task) => task.taskId === taskId)?.files).toEqual([
        "one-hop.json",
        "multi-hop.json",
        "views/table-lineage.html",
      ]);
  });
});
