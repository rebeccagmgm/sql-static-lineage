import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { stageConvertedPack } from "../scripts/input/stage-converted-pack.ts";
import { writeTaskInput, validateTaskDocument, type TaskEvidence } from "../scripts/input/shared/input-pack.ts";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
it("stages a valid Pack, retains original evidence and refuses overwrites", () => {
  const root = mkdtempSync(join(tmpdir(), "stage-pack-test-")); roots.push(root);
  const written = writeTaskInput(join(root, "source"), {
    taskId: "100", taskCategory: "hiveTask", taskType: "59", taskName: "demo", topicName: "demo",
    scheduleCycle: "每日", scheduleStatus: "Y", target: { platform: "hive", dataSource: "hive", qualifiedName: "demo.t" },
    partition: null, evidenceProvider: "test:explicit", collectedAt: "2026-09-08T00:00:00Z",
    sql: { query: { content: "SELECT '${day}';", evidenceProvider: "test:sql" } },
  } as TaskEvidence);
  const input = join(written.directory, "task.json");
  const before = readFileSync(input, "utf8");
  const output = join(root, "converted");
  const result = stageConvertedPack(input, output, { "${day}": "2026-09-07" });
  expect(result.changed).toBe(true);
  validateTaskDocument(JSON.parse(readFileSync(join(output, "tasks/hiveTask/100/task.json"), "utf8")));
  expect(readFileSync(join(output, "tasks/hiveTask/100/sql/query.sql"), "utf8")).toBe("SELECT '2026-09-07';");
  expect(readFileSync(input, "utf8")).toBe(before);
  expect(() => stageConvertedPack(input, output)).toThrow();
});
