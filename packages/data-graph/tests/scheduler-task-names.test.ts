import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { SchedulerTaskNameResolver } from "../src/asset-graph/scheduler-task-names.ts";

describe("SchedulerTaskNameResolver", () => {
  it("uses horae_task_catalog.task_name and never evidence descriptions", async () => {
    const root = join(tmpdir(), `scheduler-task-names-${randomUUID()}`);
    const sqlitePath = join(
      root,
      "schedule-evidence",
      "tasks-sqlite",
      "schedule-evidence.sqlite",
    );
  await mkdir(dirname(sqlitePath), { recursive: true });
    const database = new DatabaseSync(sqlitePath);
    database.exec(
      "CREATE TABLE horae_task_catalog(task_id TEXT PRIMARY KEY, task_name TEXT)",
    );
    database
      .prepare(
        "INSERT INTO horae_task_catalog(task_id, task_name) VALUES (?, ?)",
      )
      .run("168293", "pdata_n.t98_sb_otc_opt_comp_prcg_indx_tit278");
    database.close();

    const resolver = new SchedulerTaskNameResolver(root);
    expect(resolver.resolve(["168293", "144136"])).toEqual({
      "168293": "pdata_n.t98_sb_otc_opt_comp_prcg_indx_tit278",
    });
    resolver.close();
  });
});
