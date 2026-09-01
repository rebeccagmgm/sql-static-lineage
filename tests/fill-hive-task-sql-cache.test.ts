import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HoraeSerialGate } from "../scripts/input/mainline/collect-one-task-input-pack-sparkindex.ts";
import {
  extractHiveTaskSqlFromScript,
  readHiveTaskSqlCache,
  resolveLocalHiveTaskScriptPath,
  writeHiveTaskSqlCache,
} from "../scripts/input/mainline/hive-task-sql-cache.ts";
import {
  fillHiveTaskSqlCache,
  hiveTaskIdsFromHoraeTypeCache,
} from "../scripts/input/mainline/fill-hive-task-sql-cache.ts";
import {
  resolveScheduleEvidenceCacheRoot,
  writeHoraeTaskTypeCache,
} from "../scripts/reconcile/consumer/one-hop/schedule-evidence-cache.ts";

const SAMPLE_SCRIPT = `#!/usr/bin/env python
from HiveTask import HiveTask
ht = HiveTask()
db_name = ht.schema_name
data_day_str = ht.data_day_str
sql = """
CREATE TABLE IF NOT EXISTS t02_idx_mkt_quot_s(
  busi_date string comment '数据日期'
)
COMMENT '指数日行情';
"""
ht.exec_sql(schema_name = db_name, sql = sql)
sql = """
INSERT overwrite TABLE t02_idx_mkt_quot_s
SELECT
'"""+data_day_str+"""' as busi_date
from odata_n_uip.w_aindexindustrieseodcitics a;
"""
ht.exec_sql(schema_name = db_name, sql = sql)
`;

function tasksRoot(cacheRoot: string): string {
  return join(resolveScheduleEvidenceCacheRoot(cacheRoot), "tasks");
}

function writeType(
  cacheRoot: string,
  taskId: string,
  detail: Record<string, unknown>,
): void {
  mkdirSync(join(tasksRoot(cacheRoot), taskId), { recursive: true });
  writeHoraeTaskTypeCache(
    taskId,
    "2026-08-31T00:00:00.000Z",
    { id: taskId, ...detail },
    cacheRoot,
  );
}

describe("hiveTask SQL cache fill", () => {
  it("maps BigData-<repo>/path onto the local code checkout", () => {
    expect(
      resolveLocalHiveTaskScriptPath(
        "E:/code-BigData",
        "BigData-pdata_news_n/news_dm02/pdata_news_n.t02_idx_mkt_quot_s_WD_grp13",
      ),
    ).toBe(
      join(
        "E:/code-BigData",
        "pdata_news_n",
        "news_dm02",
        "pdata_news_n.t02_idx_mkt_quot_s_WD_grp13",
      ),
    );
  });

  it("extracts create/query SQL and keeps HiveTask date variables", () => {
    expect(extractHiveTaskSqlFromScript(SAMPLE_SCRIPT)).toEqual({
      createSql:
        "CREATE TABLE IF NOT EXISTS t02_idx_mkt_quot_s(\n  busi_date string comment '数据日期'\n)\nCOMMENT '指数日行情';",
      querySql:
        "INSERT overwrite TABLE t02_idx_mkt_quot_s\nSELECT\n'${data_day_str}' as busi_date\nfrom odata_n_uip.w_aindexindustrieseodcitics a;",
    });
  });

  it("selects only hiveTask and hiveTask-2.0 ids that have scriptPath", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-sql-ids-"));
    try {
      writeType(cacheRoot, "100", { taskType: "sparkIndex" });
      writeType(cacheRoot, "129", {
        taskType: "hiveTask-2.0",
        hiveDb: "odata_jgj",
      });
      writeType(cacheRoot, "200", {
        taskType: "hiveTask",
        scriptPath: "BigData-pdata_news_n/a",
        hiveDb: "pdata_news_n",
      });
      writeType(cacheRoot, "300", {
        taskType: "hiveTask-2.0",
        scriptPath: "BigData-GF_FDM_N/b",
        hiveDb: "pdata_n",
      });
      expect(hiveTaskIdsFromHoraeTypeCache(cacheRoot)).toEqual(["200", "300"]);
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("uses local code first, skips HIT, and only rate-limits MCP misses", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-sql-fill-"));
    const codeRoot = join(cacheRoot, "code");
    try {
      const scriptPath =
        "BigData-pdata_news_n/news_dm02/pdata_news_n.t02_idx_mkt_quot_s_WD_grp13";
      mkdirSync(join(codeRoot, "pdata_news_n", "news_dm02"), { recursive: true });
      writeFileSync(
        join(
          codeRoot,
          "pdata_news_n",
          "news_dm02",
          "pdata_news_n.t02_idx_mkt_quot_s_WD_grp13",
        ),
        SAMPLE_SCRIPT,
      );
      writeType(cacheRoot, "100036", {
        taskType: "hiveTask",
        scriptPath,
        hiveDb: "pdata_news_n",
      });
      writeType(cacheRoot, "100037", {
        taskType: "hiveTask-2.0",
        scriptPath: "BigData-missing_repo/nope.sql",
        hiveDb: "dm_otc_n",
      });
      writeType(cacheRoot, "100038", {
        taskType: "hiveTask",
        scriptPath: "BigData-pdata_news_n/missing.py",
        hiveDb: "pdata_news_n",
      });
      writeHiveTaskSqlCache(
        "100036",
        "2026-08-31T00:00:00.000Z",
        {
          source: "LOCAL_CODE",
          scriptPath,
          hiveDb: "pdata_news_n",
          createSql: "CREATE TABLE already (id INT);",
          querySql: "SELECT 1",
        },
        cacheRoot,
      );

      const mcpCalls: string[] = [];
      const slept: number[] = [];
      const summary = await fillHiveTaskSqlCache({
        cacheRoot,
        codeRoot,
        startTaskId: "100036",
        maxErrors: 3,
        minIntervalMs: 5_000,
        gate: new HoraeSerialGate({
          minIntervalMs: 5_000,
          sleep: (ms) => slept.push(ms),
        }),
        mcpRunner: (taskId) => {
          mcpCalls.push(taskId);
          return [
            {
              createSql: `CREATE TABLE mcp_${taskId} (id INT);`,
              querySql: `SELECT ${taskId}`,
            },
          ];
        },
      });

      expect(summary).toMatchObject({
        total: 3,
        skipped: 1,
        localCached: 0,
        mcpCached: 2,
        mcpEmpty: 0,
        errors: 0,
        stopped: false,
        startTaskId: "100036",
      });
      expect(mcpCalls).toEqual(["100037", "100038"]);
      expect(slept.length).toBe(1);
      expect(slept[0]).toBeGreaterThan(0);
      expect(readHiveTaskSqlCache("100037", cacheRoot)).toMatchObject({
        status: "HIT",
        source: "SQL_MCP",
      });
      expect(
        readFileSync(join(tasksRoot(cacheRoot), "100037", "hive-task.sql"), "utf8"),
      ).toContain("SELECT 100037");
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("writes local SQL without calling MCP when the script exists", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-sql-local-"));
    const codeRoot = join(cacheRoot, "code");
    try {
      const scriptPath = "BigData-pdata_news_n/news_dm02/task";
      mkdirSync(join(codeRoot, "pdata_news_n", "news_dm02"), { recursive: true });
      writeFileSync(
        join(codeRoot, "pdata_news_n", "news_dm02", "task"),
        SAMPLE_SCRIPT,
      );
      writeType(cacheRoot, "100036", {
        taskType: "hiveTask",
        scriptPath,
        hiveDb: "pdata_news_n",
      });
      const mcpCalls: string[] = [];
      const summary = await fillHiveTaskSqlCache({
        cacheRoot,
        codeRoot,
        minIntervalMs: 5_000,
        mcpRunner: (taskId) => {
          mcpCalls.push(taskId);
          throw new Error(`unexpected MCP ${taskId}`);
        },
      });
      expect(summary).toMatchObject({
        total: 1,
        skipped: 0,
        localCached: 1,
        mcpCached: 0,
        mcpEmpty: 0,
        errors: 0,
      });
      expect(mcpCalls).toEqual([]);
      const cached = readHiveTaskSqlCache("100036", cacheRoot);
      expect(cached).toMatchObject({
        status: "HIT",
        source: "LOCAL_CODE",
        hiveDb: "pdata_news_n",
      });
      if (cached.status !== "HIT") throw new Error("expected HIT");
      expect(cached.querySql).toContain("${data_day_str}");
      expect(cached.querySql).not.toMatch(/2026-05-23/);
      const raw = readFileSync(
        join(tasksRoot(cacheRoot), "100036", "hive-task.sql"),
        "utf8",
      );
      expect(raw.startsWith("{")).toBe(false);
      expect(raw).toContain("INSERT overwrite TABLE t02_idx_mkt_quot_s");
      expect(raw).toContain("'${data_day_str}' as busi_date");
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("writes local SQL first and treats empty MCP as unavailable without stopping", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-sql-empty-"));
    const codeRoot = join(cacheRoot, "code");
    try {
      const scriptPath = "BigData-pdata_news_n/news_dm02/task";
      mkdirSync(join(codeRoot, "pdata_news_n", "news_dm02"), { recursive: true });
      writeFileSync(
        join(codeRoot, "pdata_news_n", "news_dm02", "task"),
        SAMPLE_SCRIPT,
      );
      writeType(cacheRoot, "129", {
        taskType: "hiveTask-2.0",
        hiveDb: "odata_jgj",
      });
      writeType(cacheRoot, "358", {
        taskType: "hiveTask-2.0",
        scriptPath: "BigData-bd_other_test/odm/missing.py",
        hiveDb: "odata_gfqh",
      });
      writeType(cacheRoot, "100036", {
        taskType: "hiveTask",
        scriptPath,
        hiveDb: "pdata_news_n",
      });
      const mcpCalls: string[] = [];
      const summary = await fillHiveTaskSqlCache({
        cacheRoot,
        codeRoot,
        maxErrors: 1,
        minIntervalMs: 0,
        mcpRunner: (taskId) => {
          mcpCalls.push(taskId);
          return [{ createSql: null, querySql: null }];
        },
      });
      expect(hiveTaskIdsFromHoraeTypeCache(cacheRoot)).toEqual([
        "358",
        "100036",
      ]);
      expect(summary).toMatchObject({
        total: 2,
        skipped: 0,
        localCached: 1,
        mcpCached: 0,
        mcpEmpty: 1,
        errors: 0,
        stopped: false,
      });
      expect(mcpCalls).toEqual(["358"]);
      expect(readHiveTaskSqlCache("100036", cacheRoot)).toMatchObject({
        status: "HIT",
        source: "LOCAL_CODE",
        sqlStatus: "AVAILABLE",
      });
      expect(readHiveTaskSqlCache("358", cacheRoot)).toMatchObject({
        status: "HIT",
        source: "SQL_MCP",
        sqlStatus: "UNAVAILABLE",
      });
      expect(readHiveTaskSqlCache("129", cacheRoot)).toMatchObject({
        status: "MISS",
      });
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });
});
