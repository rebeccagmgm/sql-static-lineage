import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createTaskDocument } from "../scripts/input/shared/input-pack.ts";

import {
  formalArtifactPaths,
  parseLineageAllArgs,
  publishStagedTask,
  runLineageAll,
} from "../scripts/pipeline/lineage-all.ts";

function fakeMultiHop(taskId: string): any {
  return {
    schemaVersion: "1.1.0",
    artifactType: "TABLE_MULTI_HOP_RECONCILIATION",
    rootTaskId: taskId,
    generatedAt: "2026-08-26T00:00:00.000Z",
    taskNodes: [{ taskId }],
  };
}

function fakeOneHop(taskId: string): any {
  return { schemaVersion: "1.1.0", taskId, generatedAt: "2026-08-26T00:00:00.000Z" };
}

describe("lineage:all", () => {
  it("parses repeated and comma-separated task ids", () => {
    const parsed = parseLineageAllArgs([
      "--data-root", "E:/packs", "--task-ids", "181058,155015", "--task-id", "181058", "--with-fields",
    ]);
    expect(parsed.taskIds).toEqual(["181058", "155015"]);
    expect(parsed.withFields).toBe(true);
    expect(parsed.maxDepth).toBe(25);
    expect(parsed.maxTasks).toBe(1000);
    expect(parsed.maxEdges).toBe(10000);
  });

  it("publishes the fixed task directory and removes stale optional files", () => {
    const root = mkdtempSync(join(tmpdir(), "lineage-publish-"));
    const staged = join(root, ".staging", "task");
    const final = formalArtifactPaths(root, "181058");
    mkdirSync(join(staged, "views"), { recursive: true });
    mkdirSync(final.views, { recursive: true });
    writeFileSync(join(final.directory, "field-lineage.json"), "stale\n");
    writeFileSync(join(staged, "one-hop.json"), "new\n");
    writeFileSync(join(staged, "multi-hop.json"), "new\n");
    writeFileSync(join(staged, "views", "table-lineage.html"), "new\n");
    publishStagedTask(staged, final.directory, root);
    expect(existsSync(final.oneHop)).toBe(true);
    expect(existsSync(final.multiHop)).toBe(true);
    expect(existsSync(final.tableHtml)).toBe(true);
    expect(existsSync(final.fieldLineage)).toBe(false);
  });

  it("publishes in place when Windows holds a formal artifact file open", () => {
    if (process.platform !== "win32") return;
    const root = mkdtempSync(join(tmpdir(), "lineage-publish-open-file-"));
    const staged = join(root, ".staging", "task");
    const final = formalArtifactPaths(root, "181058");
    mkdirSync(join(staged, "views"), { recursive: true });
    mkdirSync(final.views, { recursive: true });
    writeFileSync(final.fieldHtml, "old\n");
    writeFileSync(join(staged, "one-hop.json"), "new\n");
    writeFileSync(join(staged, "multi-hop.json"), "new\n");
    writeFileSync(join(staged, "field-lineage.json"), "new\n");
    writeFileSync(join(staged, "views", "table-lineage.html"), "new\n");
    writeFileSync(join(staged, "views", "field-lineage.html"), "new\n");
    const fd = openSync(final.fieldHtml, "r");
    try {
      publishStagedTask(staged, final.directory, root);
    } finally {
      closeSync(fd);
    }
    expect(readFileSync(final.fieldHtml, "utf8")).toBe("new\n");
    expect(readFileSync(final.fieldLineage, "utf8")).toBe("new\n");
  });

  it("keeps one task failure isolated while publishing successful siblings", () => {
    const root = mkdtempSync(join(tmpdir(), "lineage-all-"));
    mkdirSync(join(root, "tasks"), { recursive: true });
    mkdirSync(join(root, "tables"), { recursive: true });
    const result = runLineageAll({
      dataRoot: root,
      taskIds: ["ok", "bad"],
      dependencies: {
        autofill: ({ taskId }) => {
          if (taskId === "bad") throw new Error("AUTOFILL_FAILED");
          return { taskIds: [taskId], discoveredTaskIds: [taskId], collectedTaskIds: [], rounds: 1, status: "COMPLETE", issues: [] };
        },
        machineFacts: () => ({ tasks: [] }) as any,
        oneHopBatch: (taskIds) => taskIds.map((taskId) => fakeOneHop(taskId)),
        multiHop: (taskId) => fakeMultiHop(taskId),
        visualizeMultiHop: ({ outputPath }) => {
          mkdirSync(join(outputPath!, ".."), { recursive: true });
          writeFileSync(outputPath!, "<html></html>\n");
          return outputPath!;
        },
      },
    });
    expect(result.status).toBe("PARTIAL_FAILURE");
    expect(result.tasks.find((task) => task.taskId === "ok")?.status).toBe("SUCCESS");
    expect(result.tasks.find((task) => task.taskId === "bad")?.status).toBe("FAILED");
    expect(existsSync(join(root, "artifacts", "tasks", "ok", "one-hop.json"))).toBe(true);
    expect(existsSync(join(root, "artifacts", "tasks", "bad"))).toBe(false);
  });

  it("executes the formal stages in the documented order", () => {
    const root = mkdtempSync(join(tmpdir(), "lineage-order-"));
    mkdirSync(join(root, "tasks"), { recursive: true });
    mkdirSync(join(root, "tables"), { recursive: true });
    const taskPack = join(root, "tasks", "sparkIndex", "181058");
    mkdirSync(taskPack, { recursive: true });
    writeFileSync(join(taskPack, "task.json"), JSON.stringify(createTaskDocument({
      taskId: "181058",
      taskCategory: "sparkIndex",
      target: { platform: "hive", dataSource: "gfhive", qualifiedName: "demo.target" },
    })));
    const events: string[] = [];
    const result = runLineageAll({
      dataRoot: root,
      taskIds: ["181058"],
      withFields: true,
      dependencies: {
        autofill: ({ taskId, maxTasks, maxDiscoveredTasks }) => {
          events.push(`input-pack-autofill:${maxTasks}:${maxDiscoveredTasks}`);
          return { taskIds: [taskId], discoveredTaskIds: [taskId], collectedTaskIds: [], rounds: 1, status: "COMPLETE", issues: [] };
        },
        machineFacts: () => {
          events.push("machine-facts");
          return { tasks: [] } as any;
        },
        producerIndex: () => {
          events.push("producer-index");
          return { index: {} as any, cachePath: "", manifestPath: "" } as any;
        },
        oneHopBatch: (taskIds) => {
          events.push(`one-hop:${taskIds.join(",")}`);
          return taskIds.map((taskId) => fakeOneHop(taskId));
        },
        multiHop: (taskId, options) => {
          events.push(`multi-hop:${taskId}:${options.rootOneHop?.taskId ?? "missing"}:${options.maxTasks}:${options.maxEdges}`);
          return fakeMultiHop(taskId);
        },
        visualizeMultiHop: ({ outputPath }) => {
          events.push("table-html");
          mkdirSync(join(outputPath!, ".."), { recursive: true });
          writeFileSync(outputPath!, "<html></html>\n");
          return outputPath!;
        },
        fieldLineage: (options) => {
          events.push(`field-lineage:${options.maxStates}:${options.maxPaths}`);
          return {} as any;
        },
        visualizeFieldLineage: () => {
          events.push("field-html");
          return "";
        },
      },
    });
    expect(result.status).toBe("SUCCESS");
    expect(events).toEqual([
      "input-pack-autofill:1000:5000",
      "producer-index",
      "machine-facts",
      "one-hop:181058",
      "multi-hop:181058:181058:1000:10000",
      "table-html",
      "field-lineage:5000:10000",
      "field-html",
    ]);
  });

  it("removes checkdbflag scheduler parents from the formal lineage snapshot", () => {
    const root = mkdtempSync(join(tmpdir(), "lineage-checkdbflag-"));
    mkdirSync(join(root, "tasks"), { recursive: true });
    mkdirSync(join(root, "tables"), { recursive: true });
    let filtered: any;
    const result = runLineageAll({
      dataRoot: root,
      taskIds: ["181058"],
      dependencies: {
        autofill: ({ taskId }) => ({
          taskIds: [taskId, "78585"],
          discoveredTaskIds: [taskId, "78585"],
          collectedTaskIds: [],
          rounds: 1,
          status: "COMPLETE",
          issues: [],
        }),
        machineFacts: () => ({ tasks: [] }) as any,
        oneHopBatch: () => [
          {
            ...fakeOneHop("181058"),
            schedule: {
              direction: "UPSTREAM",
              depth: 1,
              parents: [
                { taskId: "169692", taskName: "checker.demo", evidence: [] },
              ],
              evidence: [],
            },
            finalUpstreamTaskIds: {
              primary: [],
              additional: [],
              unknown: [],
              decision: "SCHEDULE_FALLBACK",
            },
            dataPath: { confirmedProducers: [], readOccurrenceDecisions: [] },
          } as any,
          {
            ...fakeOneHop("78585"),
            schedule: {
              direction: "UPSTREAM",
              depth: 1,
              parents: [
                { taskId: "169692", taskName: "checker.demo", evidence: [] },
              ],
              evidence: [],
            },
            finalUpstreamTaskIds: {
              primary: ["169692"],
              additional: [],
              unknown: [],
              decision: "SCHEDULE_FALLBACK",
            },
            dataPath: { confirmedProducers: [], readOccurrenceDecisions: [] },
          } as any,
        ],
        multiHop: (_taskId, options) => {
          filtered = options.oneHopSnapshots?.get("78585");
          return fakeMultiHop("181058");
        },
        visualizeMultiHop: ({ outputPath }) => {
          mkdirSync(join(outputPath!, ".."), { recursive: true });
          writeFileSync(outputPath!, "<html></html>\n");
          return outputPath!;
        },
      },
    });
    expect(result.status).toBe("SUCCESS");
    expect(filtered.finalUpstreamTaskIds.primary).toEqual([]);
    expect(filtered.schedule.parents).toEqual([]);
  });

  it("fails closed when Input Pack or Machine Facts is partial", () => {
    const root = mkdtempSync(join(tmpdir(), "lineage-closed-") );
    mkdirSync(join(root, "tasks"), { recursive: true });
    mkdirSync(join(root, "tables"), { recursive: true });
    const partialInput = runLineageAll({
      dataRoot: root,
      taskIds: ["input-partial"],
      dependencies: {
        autofill: () => ({ taskIds: ["input-partial"], discoveredTaskIds: [], collectedTaskIds: [], rounds: 1, status: "PARTIAL", issues: ["COLLECTION_FAILED"] }),
        machineFacts: () => ({ tasks: [] }) as any,
      },
    });
    expect(partialInput.tasks[0]?.error).toContain("INPUT_PACK_CLOSURE_PARTIAL");

    const partialFacts = runLineageAll({
      dataRoot: root,
      taskIds: ["facts-partial"],
      dependencies: {
        autofill: () => ({ taskIds: ["facts-partial"], discoveredTaskIds: [], collectedTaskIds: [], rounds: 1, status: "COMPLETE", issues: [] }),
        machineFacts: () => ({ tasks: [{ task_id: "facts-partial", state: "FAILED", status: "FAILED" }] }) as any,
      },
    });
    expect(partialFacts.tasks[0]?.error).toContain("MACHINE_FACTS_FAILED");
  });
});
