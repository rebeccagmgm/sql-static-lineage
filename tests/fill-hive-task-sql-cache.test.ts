import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { describe, expect, it } from "vitest";

import { HoraeSerialGate } from "../scripts/input/mainline/collect-one-task-input-pack-sparkindex.ts";
import {
  extractHiveTaskSqlFromHoraeLog,
  extractHiveTaskSqlFromScript,
  readHiveTaskSqlCache,
  resolveLocalHiveTaskScriptPath,
  resolveExistingLocalHiveTaskScriptPath,
  listLocalHiveTaskScriptPathCandidates,
  normalizeHiveTaskScriptPath,
  isLegacyGfFdmHiveTaskScriptPath,
  sqlHasStructuralTemplateVars,
  writeHiveTaskSqlCache,
} from "../scripts/input/mainline/hive-task-sql-cache.ts";
import { extractSqlWriteTableNames } from "../scripts/input/shared/sql-target-evidence.ts";
import {
  fillHiveTaskSqlCache,
  evidenceFromTaskCodeResponse,
  hiveTaskIdsFromHoraeTypeCache,
} from "../scripts/input/mainline/fill-hive-task-sql-cache.ts";
import {
  resolveScheduleEvidenceCacheRoot,
  writeHoraeTaskTypeCache,
} from "../scripts/evidence/schedule-evidence-cache.ts";

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

  it("normalizes bare GF_FDM script paths before resolving local checkout", () => {
    expect(
      normalizeHiveTaskScriptPath(
        "GF_FDM/fdm_asset/pdata.asset_nts_xy_vw_sagf_xs_s.py",
      ),
    ).toBe("BigData-GF_FDM/fdm_asset/pdata.asset_nts_xy_vw_sagf_xs_s.py");
    expect(
      isLegacyGfFdmHiveTaskScriptPath(
        "GF_FDM/fdm_asset/pdata.asset_nts_xy_vw_sagf_xs_s.py",
      ),
    ).toBe(true);
    expect(
      resolveLocalHiveTaskScriptPath(
        "E:/code-BigData",
        "GF_FDM/fdm_asset/pdata.asset_nts_xy_vw_sagf_xs_s.py",
      ),
    ).toBe(
      join(
        "E:/code-BigData",
        "GF_FDM",
        "fdm_asset",
        "pdata.asset_nts_xy_vw_sagf_xs_s.py",
      ),
    );
    expect(
      listLocalHiveTaskScriptPathCandidates(
        "E:/code-BigData",
        "GF_FDM/fdm_asset/pdata.asset_nts_xy_vw_sagf_xs_s.py",
      ),
    ).toEqual([
      join(
        "E:/code-BigData",
        "GF_FDM",
        "fdm_asset",
        "pdata.asset_nts_xy_vw_sagf_xs_s.py",
      ),
      join(
        "E:/code-BigData",
        "GF_FDM_N",
        "fdm_asset",
        "pdata.asset_nts_xy_vw_sagf_xs_s.py",
      ),
    ]);
  });

  it("resolves legacy GF_FDM scripts at the same relative path in GF_FDM_N", () => {
    const codeRoot = mkdtempSync(join(tmpdir(), "hive-task-gf-fdm-alias-"));
    const scriptName = "pdata.asset_nts_xy_vw_sagf_xs_s.py";
    const aliasedPath = join(codeRoot, "GF_FDM_N", "fdm_asset", scriptName);
    mkdirSync(dirname(aliasedPath), { recursive: true });
    writeFileSync(aliasedPath, SAMPLE_SCRIPT, "utf8");

    expect(
      resolveExistingLocalHiveTaskScriptPath(
        codeRoot,
        "GF_FDM/fdm_asset/pdata.asset_nts_xy_vw_sagf_xs_s.py",
      ),
    ).toBe(aliasedPath);

    rmSync(codeRoot, { recursive: true, force: true });
  });

  it.each([
    ["GF_FDM", "other/demo.py"],
    ["GF_FDM_N", "other/demo.py"],
    ["GF_FDM", "fdm_asset/demo.sql"],
    ["GF_FDM_N", "fdm_asset/demo.sql"],
  ])("does not substitute a missing script with %s/%s", (repo, relativePath) => {
    const codeRoot = mkdtempSync(join(tmpdir(), "hive-task-exact-path-"));
    try {
      const unrelatedPath = join(codeRoot, repo, relativePath);
      mkdirSync(dirname(unrelatedPath), { recursive: true });
      writeFileSync(unrelatedPath, SAMPLE_SCRIPT, "utf8");

      expect(
        resolveExistingLocalHiveTaskScriptPath(
          codeRoot,
          "GF_FDM/fdm_asset/demo.py",
        ),
      ).toBeNull();
    } finally {
      rmSync(codeRoot, { recursive: true, force: true });
    }
  });

  it("extracts hiveTask SQL from task-code sparse checkout content", () => {
    expect(
      evidenceFromTaskCodeResponse(
        [
          {
            codeCachePath: "E:/cache/repo::ORG/demo.py",
            preview: "",
          },
        ],
        "BigData-GF_FDM/fdm_asset/demo.py",
        "pdata",
      ),
    ).toBeNull();

    const codeRoot = mkdtempSync(join(tmpdir(), "hive-task-task-code-"));
    const cacheDir = join(codeRoot, "repo");
    const scriptPath = join(cacheDir, "ORG", "demo.py");
    mkdirSync(dirname(scriptPath), { recursive: true });
    writeFileSync(scriptPath, SAMPLE_SCRIPT, "utf8");

    const evidence = evidenceFromTaskCodeResponse(
      [
        {
          codeCachePath: `${cacheDir}::ORG/demo.py`,
        },
      ],
      "BigData-GF_FDM/fdm_asset/demo.py",
      "pdata",
    );
    expect(evidence?.source).toBe("LOCAL_CODE");
    expect(evidence?.querySql).toContain("INSERT overwrite TABLE t02_idx_mkt_quot_s");

    rmSync(codeRoot, { recursive: true, force: true });
  });

  it("extracts create/query SQL and keeps HiveTask date variables", () => {
    expect(extractHiveTaskSqlFromScript(SAMPLE_SCRIPT)).toEqual({
      createSql:
        "CREATE TABLE IF NOT EXISTS t02_idx_mkt_quot_s(\n  busi_date string comment '数据日期'\n)\nCOMMENT '指数日行情';",
      querySql:
        "INSERT overwrite TABLE t02_idx_mkt_quot_s\nSELECT\n'${data_day_str}' as busi_date\nfrom odata_n_uip.w_aindexindustrieseodcitics a;",
    });
  });

  it("joins non-diagnostic hive -e blocks and drops progress log INSERTs", () => {
    const sampleLog = `[2026-08-28 00:53:42]-[INFO] hive -e"
[2026-08-28 00:53:42]-[INFO] use pdata;
[2026-08-28 00:53:42]-[INFO] insert into table pdata.cust_nts_load_log_s partition(BUSI_DATE)
[2026-08-28 00:53:42]-[INFO] select 1 from default.dual;
[2026-08-28 00:53:42]-[INFO] "
[2026-08-28 00:54:38]-[INFO] hive -e"
[2026-08-28 00:54:38]-[INFO] use pdata;
[2026-08-28 00:54:38]-[INFO] insert overwrite table PDATA.ASSET_NTS_XY_VW_SAGF_XS
[2026-08-28 00:54:38]-[INFO] select xs.GFZQDM from ODATA_XY.XY_S_VW_SAGF_XS xs;
[2026-08-28 00:54:38]-[INFO] "
[2026-08-28 00:55:12]-[INFO] hive -e"
[2026-08-28 00:55:12]-[INFO] use pdata;
[2026-08-28 00:55:12]-[INFO] insert overwrite table PDATA.ASSET_NTS_XY_VW_SAGF_XS_S partition(BUSI_DATE)
[2026-08-28 00:55:12]-[INFO] select t1.CLEAR_DATE from PDATA.ASSET_NTS_XY_VW_SAGF_XS t1;
[2026-08-28 00:55:12]-[INFO] "
`;
    const extracted = extractHiveTaskSqlFromHoraeLog(sampleLog, {
      taskName: "pdata.asset_nts_xy_vw_sagf_xs_s",
      hiveDb: "pdata",
    });
    expect(extracted.createSql).toBeNull();
    expect(extracted.querySql).toMatch(
      /INSERT\s+OVERWRITE\s+TABLE\s+PDATA\.ASSET_NTS_XY_VW_SAGF_XS\b/i,
    );
    expect(extracted.querySql).toMatch(
      /INSERT\s+OVERWRITE\s+TABLE\s+PDATA\.ASSET_NTS_XY_VW_SAGF_XS_S/i,
    );
    expect(extracted.querySql).toMatch(/ODATA_XY\.XY_S_VW_SAGF_XS/i);
    expect(extracted.querySql).not.toMatch(/cust_nts_load_log_s/i);
  });

  it("extracts CREATE and INSERT from differently named sql variables passed to exec_sql", () => {
    const script = `#!/usr/bin/env python
from HiveTask import HiveTask
ht = HiveTask()
db_name = ht.schema_name
sql_create_table = """
CREATE TABLE IF NOT EXISTS t02_demo(
  busi_date string comment '数据日期'
)
COMMENT 'demo table';
"""
ht.exec_sql(schema_name = db_name, sql = sql_create_table)
sql = """
INSERT overwrite TABLE t02_demo
SELECT '2026-01-01' as busi_date;
"""
ht.exec_sql(schema_name = db_name, sql = sql)
`;
    expect(extractHiveTaskSqlFromScript(script)).toEqual({
      createSql:
        "CREATE TABLE IF NOT EXISTS t02_demo(\n  busi_date string comment '数据日期'\n)\nCOMMENT 'demo table';",
      querySql:
        "INSERT overwrite TABLE t02_demo\nSELECT '2026-01-01' as busi_date;",
    });
  });

  it("extracts query SQL from a non-sql variable name passed to exec_sql", () => {
    const script = `#!/usr/bin/env python
from HiveTask import HiveTask
ht = HiveTask()
db_name = ht.schema_name
sql_tmp_table = """
INSERT OVERWRITE TABLE t02_demo PARTITION(busi_date='2026-01-01')
SELECT col_a FROM src_table;
"""
ht.exec_sql(schema_name = db_name, sql = sql_tmp_table)
`;
    const extracted = extractHiveTaskSqlFromScript(script);
    expect(extracted.createSql).toBeNull();
    expect(extracted.querySql).toMatch(/INSERT OVERWRITE TABLE t02_demo/i);
    expect(extracted.querySql).toContain("SELECT col_a FROM src_table");
  });

  it("ignores unused triple-quoted strings when exec_sql is present", () => {
    const script = `#!/usr/bin/env python
from HiveTask import HiveTask
ht = HiveTask()
db_name = ht.schema_name
unused_sql = """
DROP TABLE IF EXISTS should_not_appear;
"""
sql = """
INSERT INTO t02_demo SELECT 1;
"""
ht.exec_sql(schema_name = db_name, sql = sql)
`;
    const extracted = extractHiveTaskSqlFromScript(script);
    expect(extracted.createSql).toBeNull();
    expect(extracted.querySql).toMatch(/INSERT INTO t02_demo/i);
    expect(extracted.querySql).not.toMatch(/DROP TABLE/i);
  });

  it("splits a single sql assignment that contains CREATE then INSERT", () => {
    const script = `sql = """
CREATE TABLE IF NOT EXISTS T05_FIN_BDGT_ADJ_APP_EVT(
    Evt_Id STRING
)COMMENT '财务预算调整申请事件'
PARTITIONED BY (SRC_TBL STRING, BUSI_DATE STRING)
STORED AS ORC;

set hive.exec.dynamic.partition=true;
INSERT OVERWRITE TABLE T05_FIN_BDGT_ADJ_APP_EVT PARTITION(SRC_TBL='\${src_table}',BUSI_DATE='\${data_day_str}')
SELECT A.ID FROM \${src_table} A;
"""`;
    const extracted = extractHiveTaskSqlFromScript(script);
    expect(extracted.createSql).toMatch(/^CREATE TABLE IF NOT EXISTS T05_FIN_BDGT_ADJ_APP_EVT/);
    expect(extracted.createSql).toContain("STORED AS ORC;");
    expect(extracted.createSql).not.toMatch(/INSERT OVERWRITE/i);
    expect(extracted.querySql).toMatch(/INSERT OVERWRITE TABLE T05_FIN_BDGT_ADJ_APP_EVT/i);
    expect(extracted.querySql).toContain("${src_table}");
  });

  it("reads a hive-task.sql that only marked createSql as create plus query", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-sql-split-"));
    writeHiveTaskSqlCache(
      "100078",
      "2026-09-01T00:00:00.000Z",
      {
        source: "LOCAL_CODE",
        sqlStatus: "AVAILABLE",
        scriptPath: "EVT/demo.py",
        hiveDb: "pdata_n",
        createSql: `CREATE TABLE IF NOT EXISTS T05_FIN_BDGT_ADJ_APP_EVT(
    Evt_Id STRING
)COMMENT '财务预算调整申请事件'
PARTITIONED BY (SRC_TBL STRING, BUSI_DATE STRING)
STORED AS ORC;

set hive.merge.mapfiles = true;
INSERT OVERWRITE TABLE T05_FIN_BDGT_ADJ_APP_EVT PARTITION(SRC_TBL='\${src_table}',BUSI_DATE='\${data_day_str}')
SELECT A.ID FROM \${src_table} A;`,
        querySql: null,
      },
      cacheRoot,
    );
    const cached = readHiveTaskSqlCache("100078", cacheRoot);
    expect(cached.status).toBe("HIT");
    if (cached.status !== "HIT") return;
    expect(cached.createSql).toContain("CREATE TABLE IF NOT EXISTS T05_FIN_BDGT_ADJ_APP_EVT");
    expect(cached.createSql).not.toMatch(/INSERT OVERWRITE/i);
    expect(cached.querySql).toMatch(/INSERT OVERWRITE/i);
    expect(cached.querySql).toContain("${data_day_str}");
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

  it("supports descending task-id order", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-sql-order-"));
    try {
      for (const taskId of ["10", "2", "30"]) {
        writeType(cacheRoot, taskId, {
          taskType: "hiveTask",
          scriptPath: `BigData-demo/${taskId}.py`,
          hiveDb: "demo",
        });
      }
      const calls: string[] = [];
      const summary = await fillHiveTaskSqlCache({
        cacheRoot,
        taskIds: ["10", "2", "30"],
        order: "desc",
        maxErrors: 1,
        minIntervalMs: 0,
        gate: new HoraeSerialGate({ minIntervalMs: 0 }),
        mcpRunner: (taskId) => {
          calls.push(taskId);
          return [{ querySql: `SELECT ${taskId}` }];
        },
      });

      expect(summary).toMatchObject({
        total: 3,
        mcpCached: 3,
        errors: 0,
        order: "desc",
      });
      expect(calls).toEqual(["30", "10", "2"]);
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("force-overwrites HIT from local code and does not re-call MCP for available caches", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-sql-force-"));
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
      writeHiveTaskSqlCache(
        "100036",
        "2026-08-31T00:00:00.000Z",
        {
          source: "LOCAL_CODE",
          sqlStatus: "AVAILABLE",
          scriptPath,
          hiveDb: "pdata_news_n",
          createSql: null,
          querySql: "INSERT OVERWRITE TABLE stale SELECT 1;",
        },
        cacheRoot,
      );
      writeHiveTaskSqlCache(
        "100037",
        "2026-08-31T00:00:00.000Z",
        {
          source: "SQL_MCP",
          sqlStatus: "AVAILABLE",
          scriptPath: "BigData-missing_repo/nope.sql",
          hiveDb: "dm_otc_n",
          createSql: "CREATE TABLE mcp_keep (id INT);",
          querySql: "SELECT kept",
        },
        cacheRoot,
      );
      const mcpCalls: string[] = [];
      const summary = await fillHiveTaskSqlCache({
        cacheRoot,
        codeRoot,
        force: true,
        minIntervalMs: 0,
        mcpRunner: (taskId) => {
          mcpCalls.push(taskId);
          throw new Error(`unexpected MCP ${taskId}`);
        },
      });
      expect(summary).toMatchObject({
        total: 2,
        skipped: 1,
        localCached: 1,
        mcpCached: 0,
        errors: 0,
      });
      expect(mcpCalls).toEqual([]);
      const refreshed = readHiveTaskSqlCache("100036", cacheRoot);
      expect(refreshed).toMatchObject({ status: "HIT", source: "LOCAL_CODE" });
      if (refreshed.status !== "HIT") throw new Error("expected HIT");
      expect(refreshed.createSql).toMatch(/CREATE TABLE IF NOT EXISTS t02_idx_mkt_quot_s/i);
      expect(refreshed.querySql).toContain("${data_day_str}");
      expect(refreshed.querySql).not.toMatch(/stale/);
      expect(readHiveTaskSqlCache("100037", cacheRoot)).toMatchObject({
        status: "HIT",
        source: "SQL_MCP",
        querySql: "SELECT kept",
      });
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("force retries an unavailable cache through MCP and preserves an available cache", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-sql-force-unavailable-"));
    try {
      writeType(cacheRoot, "100037", {
        taskType: "hiveTask-2.0",
        scriptPath: "BigData-missing_repo/nope.sql",
        hiveDb: "dm_otc_n",
      });
      writeType(cacheRoot, "100038", {
        taskType: "hiveTask-2.0",
        scriptPath: "BigData-missing_repo/keep.sql",
        hiveDb: "dm_otc_n",
      });
      writeHiveTaskSqlCache(
        "100037",
        "2026-08-31T00:00:00.000Z",
        {
          source: "SQL_MCP",
          sqlStatus: "UNAVAILABLE",
          scriptPath: "BigData-missing_repo/nope.sql",
          hiveDb: "dm_otc_n",
          createSql: null,
          querySql: null,
        },
        cacheRoot,
      );
      writeHiveTaskSqlCache(
        "100038",
        "2026-08-31T00:00:00.000Z",
        {
          source: "SQL_MCP",
          sqlStatus: "AVAILABLE",
          scriptPath: "BigData-missing_repo/keep.sql",
          hiveDb: "dm_otc_n",
          createSql: null,
          querySql: "SELECT keep",
        },
        cacheRoot,
      );
      const mcpCalls: string[] = [];
      const summary = await fillHiveTaskSqlCache({
        cacheRoot,
        force: true,
        minIntervalMs: 0,
        mcpRunner: (taskId) => {
          mcpCalls.push(taskId);
          return [{ createSql: null, querySql: "SELECT recovered" }];
        },
      });
      expect(summary).toMatchObject({
        total: 2,
        skipped: 1,
        mcpCached: 1,
        errors: 0,
      });
      expect(mcpCalls).toEqual(["100037"]);
      expect(readHiveTaskSqlCache("100037", cacheRoot)).toMatchObject({
        status: "HIT",
        source: "SQL_MCP",
        sqlStatus: "AVAILABLE",
        querySql: "SELECT recovered",
      });
      expect(readHiveTaskSqlCache("100038", cacheRoot)).toMatchObject({
        status: "HIT",
        source: "SQL_MCP",
        sqlStatus: "AVAILABLE",
        querySql: "SELECT keep",
      });
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

  it("writes local SQL first and does not materialize an empty SQL cache", async () => {
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
        logRunner: async () => "",
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
        logCached: 0,
        logEmpty: 1,
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
        status: "MISS",
      });
      expect(readHiveTaskSqlCache("129", cacheRoot)).toMatchObject({
        status: "MISS",
      });
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("uses the first day of the month for monthly Horae log fallback", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-sql-monthly-log-"));
    try {
      writeType(cacheRoot, "5432", {
        taskType: "hiveTask",
        cycle: "每月",
        scriptPath:
          "BigData-brk_dataanalysis/dm_da/dm_da.star_org_cust_level_mon.py",
        hiveDb: "dm_da",
      });
      const logDates: string[] = [];
      const summary = await fillHiveTaskSqlCache({
        cacheRoot,
        codeRoot: join(cacheRoot, "missing-code"),
        dataDate: "2026-08-27",
        minIntervalMs: 0,
        mcpRunner: () => [{ createSql: null, querySql: null }],
        logRunner: (_taskId, dataDate) => {
          logDates.push(dataDate);
          return `[2026-09-01 06:01:00]-[INFO] hive -e"
[2026-09-01 06:01:00]-[INFO] CREATE TABLE IF NOT EXISTS STAR_ORG_CUST_LEVEL_MON(id STRING);
[2026-09-01 06:01:00]-[INFO] INSERT OVERWRITE TABLE STAR_ORG_CUST_LEVEL_MON SELECT id FROM SOURCE_TABLE;
[2026-09-01 06:01:01]-[INFO] "`;
        },
      });

      expect(logDates).toEqual(["2026-08-01"]);
      expect(summary).toMatchObject({
        mcpEmpty: 1,
        logCached: 1,
        logEmpty: 0,
      });
      expect(readHiveTaskSqlCache("5432", cacheRoot)).toMatchObject({
        status: "HIT",
        source: "HORAE_LOG",
        sqlStatus: "AVAILABLE",
      });
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("upgrades LOCAL_CODE structural ${} via MCP, or Horae log when MCP is empty", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-sql-structural-"));
    try {
      writeType(cacheRoot, "61477", {
        taskType: "hiveTask",
        scriptPath: "BigData-missing/x.py",
        hiveDb: "pdata_n",
      });
      writeHiveTaskSqlCache(
        "61477",
        "2026-08-31T00:00:00.000Z",
        {
          source: "LOCAL_CODE",
          sqlStatus: "AVAILABLE",
          scriptPath: "BigData-missing/x.py",
          hiveDb: "pdata_n",
          createSql:
            "CREATE TABLE IF NOT EXISTS ${DB_TEMP}.T04_USER_TEMP AS SELECT 1",
          querySql: "SELECT * FROM ${DB_ODATA_N_GKS}.M_TUSER",
        },
        cacheRoot,
      );
      expect(
        sqlHasStructuralTemplateVars(
          "CREATE TABLE IF NOT EXISTS ${DB_TEMP}.T04_USER_TEMP AS SELECT 1",
          "SELECT '${data_day_str}'",
        ),
      ).toBe(true);
      expect(sqlHasStructuralTemplateVars("SELECT '${data_day_str}'")).toBe(
        false,
      );
      expect(
        sqlHasStructuralTemplateVars(
          "SELECT '${yyyy-MM-dd}', '${2026-08}', '${start_day}', '${end_day}', '${Q}', '${QQ}'",
        ),
      ).toBe(false);

      const mcpOnly = await fillHiveTaskSqlCache({
        cacheRoot,
        codeRoot: join(cacheRoot, "no-code"),
        minIntervalMs: 0,
        mcpRunner: () => [
          {
            createSql: "CREATE TABLE IF NOT EXISTS T04_USER(id string)",
            querySql: "SELECT 1",
          },
        ],
        logRunner: async () => {
          throw new Error("log should not run when MCP returns SQL");
        },
      });
      expect(mcpOnly).toMatchObject({
        mcpCached: 1,
        logCached: 0,
        structuralUpgrades: 1,
      });
      expect(readHiveTaskSqlCache("61477", cacheRoot)).toMatchObject({
        source: "SQL_MCP",
        sqlStatus: "AVAILABLE",
      });

      writeHiveTaskSqlCache(
        "61477",
        "2026-08-31T00:00:00.000Z",
        {
          source: "LOCAL_CODE",
          sqlStatus: "AVAILABLE",
          scriptPath: "BigData-missing/x.py",
          hiveDb: "pdata_n",
          createSql:
            "CREATE TABLE IF NOT EXISTS ${DB_TEMP}.T04_USER_TEMP AS SELECT 1",
          querySql: null,
        },
        cacheRoot,
        { overwrite: true },
      );
      const sampleLog = `[2026-08-28 02:16:56]-[INFO] hive -e"
[2026-08-28 02:16:56]-[INFO] use pdata_n;
[2026-08-28 02:16:56]-[INFO] CREATE TABLE IF NOT EXISTS T04_USER(
[2026-08-28 02:16:56]-[INFO]   id STRING
[2026-08-28 02:16:56]-[INFO] );
[2026-08-28 02:16:56]-[INFO] INSERT OVERWRITE TABLE T04_USER SELECT id FROM ODATA_N_GKS.M_TUSER;
[2026-08-28 02:16:56]-[INFO] "
[2026-08-28 02:18:06]-[INFO] hive -e"
[2026-08-28 02:18:06]-[INFO] CREATE TABLE IF NOT EXISTS TEMP.T04_USER_TEMP_GKS002 AS SELECT 1;
[2026-08-28 02:18:06]-[INFO] "
`;
      expect(extractHiveTaskSqlFromHoraeLog(sampleLog).createSql).toMatch(
        /CREATE TABLE IF NOT EXISTS T04_USER/i,
      );
      const logFallback = await fillHiveTaskSqlCache({
        cacheRoot,
        codeRoot: join(cacheRoot, "no-code"),
        minIntervalMs: 0,
        mcpRunner: () => [{ createSql: null, querySql: null }],
        logRunner: async () => sampleLog,
      });
      expect(logFallback).toMatchObject({
        mcpEmpty: 1,
        logCached: 1,
        structuralUpgrades: 1,
      });
      expect(readHiveTaskSqlCache("61477", cacheRoot)).toMatchObject({
        source: "HORAE_LOG",
        sqlStatus: "AVAILABLE",
      });
      expect(
        extractSqlWriteTableNames(
          {
            create:
              "CREATE TABLE IF NOT EXISTS ${DB_TEMP}.T04_USER_TEMP AS SELECT 1",
          },
          "PDATA_N.T04_USER_GKS002",
          { allowSchemaOnlyQualification: true },
        ),
      ).not.toContain("PDATA_N.IF");
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("falls back to Horae log when MCP SQL still contains structural template variables", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-sql-structural-mcp-template-"));
    try {
      writeType(cacheRoot, "61478", {
        taskType: "hiveTask",
        scriptPath: "BigData-missing/x.py",
        hiveDb: "pdata_n",
      });
      writeHiveTaskSqlCache(
        "61478",
        "2026-08-31T00:00:00.000Z",
        {
          source: "LOCAL_CODE",
          sqlStatus: "AVAILABLE",
          scriptPath: "BigData-missing/x.py",
          hiveDb: "pdata_n",
          createSql: null,
          querySql: "INSERT OVERWRITE TABLE target SELECT id FROM ${src_table}",
        },
        cacheRoot,
      );
      const summary = await fillHiveTaskSqlCache({
        cacheRoot,
        codeRoot: join(cacheRoot, "no-code"),
        minIntervalMs: 0,
        mcpRunner: () => [
          {
            createSql: null,
            querySql: "INSERT OVERWRITE TABLE target SELECT id FROM ${src_table}",
          },
        ],
        logRunner: async () => `[2026-08-28 02:16:56]-[INFO] hive -e"
[2026-08-28 02:16:56]-[INFO] use pdata_n;
[2026-08-28 02:16:56]-[INFO] INSERT OVERWRITE TABLE target SELECT id FROM odata_n_source.source;
[2026-08-28 02:16:56]-[INFO] "
`,
      });

      expect(summary).toMatchObject({
        mcpCached: 0,
        mcpEmpty: 0,
        logCached: 1,
        structuralUpgrades: 1,
      });
      const cached = readHiveTaskSqlCache("61478", cacheRoot);
      expect(cached).toMatchObject({ source: "HORAE_LOG", sqlStatus: "AVAILABLE" });
      if (cached.status !== "HIT") throw new Error("expected HIT");
      expect(cached.querySql).toContain("odata_n_source.source");
      expect(sqlHasStructuralTemplateVars(cached.createSql, cached.querySql)).toBe(false);
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("does not treat an unexpanded Horae log as resolved SQL", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-sql-structural-log-template-"));
    try {
      writeType(cacheRoot, "61479", {
        taskType: "hiveTask",
        scriptPath: "BigData-missing/x.py",
        hiveDb: "pdata_n",
      });
      writeHiveTaskSqlCache(
        "61479",
        "2026-08-31T00:00:00.000Z",
        {
          source: "LOCAL_CODE",
          sqlStatus: "AVAILABLE",
          scriptPath: "BigData-missing/x.py",
          hiveDb: "pdata_n",
          createSql: null,
          querySql: "INSERT OVERWRITE TABLE target SELECT id FROM ${src_table}",
        },
        cacheRoot,
      );
      const summary = await fillHiveTaskSqlCache({
        cacheRoot,
        codeRoot: join(cacheRoot, "no-code"),
        minIntervalMs: 0,
        mcpRunner: () => [{ createSql: null, querySql: null }],
        taskCodeRunner: () => {
          throw new Error("task code unavailable");
        },
        logRunner: async () => `[2026-08-28 02:16:56]-[INFO] hive -e"
[2026-08-28 02:16:56]-[INFO] use pdata_n;
[2026-08-28 02:16:56]-[INFO] INSERT OVERWRITE TABLE target SELECT id FROM \${src_table};
[2026-08-28 02:16:56]-[INFO] "
`,
      });

      expect(summary).toMatchObject({
        mcpEmpty: 1,
        logCached: 0,
        logEmpty: 1,
        structuralUpgrades: 0,
      });
      const cached = readHiveTaskSqlCache("61479", cacheRoot);
      expect(cached).toMatchObject({ source: "LOCAL_CODE", sqlStatus: "AVAILABLE" });
      if (cached.status !== "HIT") throw new Error("expected HIT");
      expect(sqlHasStructuralTemplateVars(cached.createSql, cached.querySql)).toBe(true);
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("retries a structural cached Horae log instead of skipping it", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-sql-retry-structural-log-"));
    try {
      writeType(cacheRoot, "61480", {
        taskType: "hiveTask",
        scriptPath: "BigData-missing/x.py",
        hiveDb: "pdata_n",
      });
      writeHiveTaskSqlCache(
        "61480",
        "2026-08-31T00:00:00.000Z",
        {
          source: "HORAE_LOG",
          sqlStatus: "AVAILABLE",
          scriptPath: "BigData-missing/x.py",
          hiveDb: "pdata_n",
          createSql: null,
          querySql: "INSERT OVERWRITE TABLE target SELECT id FROM ${src_table}",
        },
        cacheRoot,
      );
      const summary = await fillHiveTaskSqlCache({
        cacheRoot,
        codeRoot: join(cacheRoot, "no-code"),
        minIntervalMs: 0,
        mcpRunner: () => [
          {
            createSql: null,
            querySql: "INSERT OVERWRITE TABLE target SELECT id FROM odata_n_source.source",
          },
        ],
      });

      expect(summary).toMatchObject({
        skipped: 0,
        mcpCached: 1,
        structuralUpgrades: 1,
      });
      const cached = readHiveTaskSqlCache("61480", cacheRoot);
      expect(cached).toMatchObject({ source: "SQL_MCP", sqlStatus: "AVAILABLE" });
      if (cached.status !== "HIT") throw new Error("expected HIT");
      expect(sqlHasStructuralTemplateVars(cached.createSql, cached.querySql)).toBe(false);
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("skips non-hiveTask types such as exeSql without calling MCP or log", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-sql-exesql-"));
    try {
      writeType(cacheRoot, "14806", {
        taskType: "exeSql",
        name: "crm_xc.pkg_prod_wallet.pro_calc_main",
      });
      writeType(cacheRoot, "100036", {
        taskType: "hiveTask",
        scriptPath: "BigData-missing/x.py",
        hiveDb: "pdata_n",
      });
      const mcpCalls: string[] = [];
      const logCalls: string[] = [];
      const summary = await fillHiveTaskSqlCache({
        cacheRoot,
        codeRoot: join(cacheRoot, "no-code"),
        taskIds: ["14806", "100036"],
        minIntervalMs: 0,
        mcpRunner: (taskId) => {
          mcpCalls.push(taskId);
          return [{ createSql: null, querySql: `SELECT ${taskId}` }];
        },
        logRunner: async (taskId) => {
          logCalls.push(taskId);
          return "";
        },
      });
      expect(summary).toMatchObject({
        total: 2,
        skipped: 1,
        mcpCached: 1,
        logCached: 0,
        errors: 0,
      });
      expect(mcpCalls).toEqual(["100036"]);
      expect(logCalls).toEqual([]);
      expect(readHiveTaskSqlCache("14806", cacheRoot)).toMatchObject({
        status: "MISS",
      });
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("horae-log-only re-extracts from cached script-log without MCP", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-log-only-"));
    try {
      writeHoraeTaskTypeCache(
        "1017",
        "2026-09-05T00:00:00.000Z",
        {
          id: "1017",
          taskType: "hiveTask",
          name: "pdata.asset_nts_xy_vw_sagf_xs_s",
          hiveDb: "pdata",
        },
        cacheRoot,
      );
      writeHiveTaskSqlCache(
        "1017",
        "2026-09-05T00:00:00.000Z",
        {
          source: "HORAE_LOG",
          sqlStatus: "AVAILABLE",
          scriptPath: "BigData-GF_FDM/demo.py",
          hiveDb: "pdata",
          createSql: null,
          querySql: "insert overwrite table PDATA.ASSET_NTS_XY_VW_SAGF_XS_S select 1",
        },
        cacheRoot,
      );
      const logPath = join(
        cacheRoot,
        "schedule-evidence/script-log/1017_20260827.log",
      );
      mkdirSync(dirname(logPath), { recursive: true });
      writeFileSync(
        logPath,
        `[2026-08-28 00:53:42]-[INFO] hive -e"
[2026-08-28 00:53:42]-[INFO] insert into table pdata.cust_nts_load_log_s select 1;
[2026-08-28 00:53:42]-[INFO] "
[2026-08-28 00:54:38]-[INFO] hive -e"
[2026-08-28 00:54:38]-[INFO] insert overwrite table PDATA.ASSET_NTS_XY_VW_SAGF_XS select xs.GFZQDM from ODATA_XY.XY_S_VW_SAGF_XS xs;
[2026-08-28 00:54:38]-[INFO] "
[2026-08-28 00:55:12]-[INFO] hive -e"
[2026-08-28 00:55:12]-[INFO] insert overwrite table PDATA.ASSET_NTS_XY_VW_SAGF_XS_S select t1.CLEAR_DATE from PDATA.ASSET_NTS_XY_VW_SAGF_XS t1;
[2026-08-28 00:55:12]-[INFO] "
`,
        "utf8",
      );
      const summary = await fillHiveTaskSqlCache({
        cacheRoot,
        taskIds: ["1017"],
        dataDate: "2026-08-27",
        horaeLogOnly: true,
        minIntervalMs: 0,
      });
      expect(summary).toMatchObject({ logCached: 1, mcpCached: 0 });
      const cached = readHiveTaskSqlCache("1017", cacheRoot);
      if (cached.status !== "HIT") throw new Error("Expected cached SQL for task 1017");
      expect(String(cached.querySql)).toMatch(/ODATA_XY\.XY_S_VW_SAGF_XS/i);
      expect(String(cached.querySql)).toMatch(/ASSET_NTS_XY_VW_SAGF_XS_S/i);
      expect(String(cached.querySql)).not.toMatch(/cust_nts_load_log_s/i);
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });
});
