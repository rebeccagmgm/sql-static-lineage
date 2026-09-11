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
    expect(resolver.resolveTopics(["168293"])).toEqual({});
    expect(resolver.resolveTopicDescriptions(["168293"])).toEqual({});
    expect(resolver.resolveOwners(["168293"])).toEqual({});
    resolver.close();
  });
  it("reads catalog topics including tasks without names and omits missing topics", async () => {
    const root = join(tmpdir(), `scheduler-task-topics-${randomUUID()}`);
    const sqlitePath = join(root, "schedule-evidence", "tasks-sqlite", "schedule-evidence.sqlite");
    await mkdir(dirname(sqlitePath), { recursive: true });
    const database = new DatabaseSync(sqlitePath);
    database.exec(`CREATE TABLE horae_task_catalog(task_id TEXT PRIMARY KEY, task_name TEXT, topic TEXT);
      INSERT INTO horae_task_catalog VALUES ('1', 'Task one', ' DM_OTC_N '), ('2', NULL, 'ODATA_N_TIT'), ('3', 'Task three', ' ');
      ALTER TABLE horae_task_catalog ADD COLUMN owner TEXT;
      UPDATE horae_task_catalog SET owner=' account_one,account_two ' WHERE task_id='1';
      CREATE TABLE horae_topic_catalog(topic TEXT PRIMARY KEY, description TEXT);
      INSERT INTO horae_topic_catalog VALUES ('DM_OTC_N', '柜台交易市场部数据集市'), ('DM_OTC_TEST', '测试主题');
      CREATE TABLE evidence(task_id TEXT, payload_json TEXT);
      INSERT INTO evidence VALUES ('1', '{"detail":{"topicName":"DM_OTC_TEST"}}');`);
    database.close();
    const resolver = new SchedulerTaskNameResolver(root);
    try {
      expect(resolver.resolve(["1", "2", "3"])).toEqual({ "1": "Task one", "3": "Task three" });
      expect(resolver.resolveTopics(["1", "2", "3", "missing"])).toEqual({ "1": "DM_OTC_N", "2": "ODATA_N_TIT" });
      expect(resolver.resolveTopics(["1"])).toEqual({ "1": "DM_OTC_N" });
      expect(resolver.resolveTopicDescriptions(["1", "2", "missing"])).toEqual({ "1": "柜台交易市场部数据集市" });
      expect(resolver.resolveOwners(["1", "2", "missing"])).toEqual({ "1": "account_one,account_two" });
    } finally { resolver.close(); }
  });
});
