import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { importTopicCatalog, parseTopicCatalog } from "../../../scripts/input/mainline/import-horae-topic-catalog.ts";

const header = "主题\t主题描述\t任务数量\t操作\n";
describe("Horae topic dictionary import", () => {
  it("accepts repeated page headers and keeps counts as snapshot metadata", () => {
    expect(parseTopicCatalog(header + "DM_OTC_N\t柜台交易市场部数据集市\t1135\t\n\n" + header + "ODATA_N_TIT\t投资管理系统采集\t1200\n"))
      .toEqual([{topic: "DM_OTC_N", description: "柜台交易市场部数据集市", taskCountSnapshot: 1135}, {topic: "ODATA_N_TIT", description: "投资管理系统采集", taskCountSnapshot: 1200}]);
  });
  it("rejects malformed, empty and duplicate mappings", () => {
    for (const input of [header, "A\t名称\t1", header+"A\t名称\tx", header+"A\t\t1", header+"A\t名称\t1\nA\t另一个名称\t1"]) {
      expect(() => parseTopicCatalog(input)).toThrow();
    }
  });
  it("joins exact codes, preserves tasks and supports repeat import", () => {
    const root = mkdtempSync(join(tmpdir(), "topic-import-"));
    const path = join(root, "evidence.sqlite"), source = join(root, "topics.tsv");
    const seed = new DatabaseSync(path);
    seed.exec("CREATE TABLE horae_task_catalog(task_id TEXT, topic TEXT); INSERT INTO horae_task_catalog VALUES ('1','DM_OTC_N'), ('2','dm_otc_n')");
    seed.close();
    writeFileSync(source, header + "DM_OTC_N\t柜台交易市场部数据集市\t1135");
    expect(importTopicCatalog(source, path)).toMatchObject({changed: 1, coverage: {totalTasks: 2, matchedTasks: 1}});
    expect(importTopicCatalog(source, path)).toMatchObject({changed: 0});
    writeFileSync(source, header + "DM_OTC_N\t更新\t1\nBAD");
    expect(() => importTopicCatalog(source, path)).toThrow();
    const db = new DatabaseSync(path, {readOnly:true});
    try {
      expect(db.prepare("SELECT description FROM horae_topic_catalog").get()).toEqual({description:"柜台交易市场部数据集市"});
      expect(db.prepare("SELECT count(*) n FROM horae_task_catalog").get()).toEqual({n:2});
    } finally {db.close();}
  });
});

