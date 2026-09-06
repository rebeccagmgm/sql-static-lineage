import { DatabaseSync } from "node:sqlite";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  backupScheduleEvidenceSqlite,
  importScheduleEvidenceToSqlite,
} from "../scripts/input/mainline/import-schedule-evidence-sqlite.ts";

describe("importScheduleEvidenceToSqlite", () => {
  it("imports task inventory and JSON/SQL evidence idempotently", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "schedule-evidence-sqlite-"));
    const taskRoot = join(cacheRoot, "schedule-evidence", "tasks", "100");
    mkdirSync(taskRoot, { recursive: true });
    writeFileSync(
      join(taskRoot, "horae-task-type.json"),
      JSON.stringify({
        task_id: "100",
        observed_at: "2026-09-04T00:00:00.000Z",
        detail: { taskType: "hiveTask" },
        content_sha256: "a".repeat(64),
      }),
    );
    writeFileSync(join(taskRoot, "hive-task.sql"), "select 1;\n");
    writeFileSync(
      join(taskRoot, "horae-relation-up-depth-1.json"),
      JSON.stringify({ task_id: "100", direction: "up", depth: 1, rows: [] }),
    );

    const databasePath = join(
      cacheRoot,
      "schedule-evidence",
      "tasks-sqlite",
      "schedule-evidence.sqlite",
    );
    const first = importScheduleEvidenceToSqlite({
      cacheRoot,
      databasePath,
      includeRelations: true,
    });
    const second = importScheduleEvidenceToSqlite({
      cacheRoot,
      databasePath,
      includeRelations: true,
    });

    expect(first.taskDirectories).toBe(1);
    expect(first.filesSeen).toBe(3);
    expect(first.inserted).toBe(3);
    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(3);

    const database = new DatabaseSync(databasePath);
    expect(database.prepare("SELECT COUNT(*) AS count FROM task_inventory").get()).toEqual({
      count: 1,
    });
    expect(database.prepare("SELECT COUNT(*) AS count FROM evidence").get()).toEqual({
      count: 3,
    });
    expect(
      database
        .prepare(
          "SELECT direction, depth, format, payload_text FROM evidence WHERE evidence_type = ?",
        )
        .get("horae-relation-up-depth-1"),
    ).toMatchObject({ direction: "up", depth: 1, format: "json", payload_text: null });
    expect(readFileSync(join(taskRoot, "hive-task.sql"), "utf8")).toBe("select 1;\n");
    database.close();
  });

  it("skips relation files when SQLite relation evidence is authoritative", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "schedule-evidence-no-relations-"));
    const taskRoot = join(cacheRoot, "schedule-evidence", "tasks", "101");
    mkdirSync(taskRoot, { recursive: true });
    writeFileSync(
      join(taskRoot, "horae-task-type.json"),
      JSON.stringify({ task_id: "101", detail: { taskType: "hiveTask" } }),
    );
    writeFileSync(
      join(taskRoot, "horae-relation-up-depth-1.json"),
      JSON.stringify({ task_id: "101", direction: "up", depth: 1, rows: [] }),
    );
    const databasePath = join(
      cacheRoot,
      "schedule-evidence",
      "tasks-sqlite",
      "schedule-evidence.sqlite",
    );

    const result = importScheduleEvidenceToSqlite({
      cacheRoot,
      databasePath,
    });

    expect(result).toMatchObject({
      filesSeen: 2,
      inserted: 1,
      skippedRelationFiles: 1,
    });
    const database = new DatabaseSync(databasePath);
    expect(database.prepare("SELECT COUNT(*) AS count FROM evidence").get()).toEqual({
      count: 1,
    });
    expect(
      database
        .prepare("SELECT COUNT(*) AS count FROM evidence WHERE evidence_type LIKE ?")
        .get("horae-relation-%"),
    ).toEqual({ count: 0 });
    database.close();
  });

  it("creates an openable SQLite backup before a subsequent import", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "schedule-evidence-backup-"));
    const taskRoot = join(cacheRoot, "schedule-evidence", "tasks", "102");
    mkdirSync(taskRoot, { recursive: true });
    writeFileSync(join(taskRoot, "hive-task.sql"), "select 102;\n");
    const databasePath = join(
      cacheRoot,
      "schedule-evidence",
      "tasks-sqlite",
      "schedule-evidence.sqlite",
    );
    importScheduleEvidenceToSqlite({ cacheRoot, databasePath });
    const backupPath = join(cacheRoot, "backup", "schedule-evidence.sqlite");

    const result = await backupScheduleEvidenceSqlite({ databasePath, backupPath });

    expect(result).toBe(backupPath);
    expect(existsSync(backupPath)).toBe(true);
    const backup = new DatabaseSync(backupPath, { readOnly: true });
    expect(backup.prepare("SELECT COUNT(*) AS count FROM evidence").get()).toEqual({
      count: 1,
    });
    backup.close();
  });
});
