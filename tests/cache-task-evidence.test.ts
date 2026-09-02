import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { assembleCacheTaskEvidence, sqlSlotCount } from "../scripts/input/shared/cache-task-evidence.ts";
import { writeHiveTaskSqlCache } from "../scripts/input/mainline/hive-task-sql-cache.ts";
import { writeRunScriptSqlCache } from "../scripts/input/mainline/run-script-sql-cache.ts";
import { writeSzdataScheduleDetailCache } from "../scripts/input/mainline/szdata-schedule-detail-cache.ts";
import { writeHoraeTaskTypeCache } from "../scripts/reconcile/consumer/one-hop/schedule-evidence-cache.ts";

const observedAt = "2026-09-02T00:00:00.000Z";

function sqlContent(
  slot: string | { readonly content: string } | null | undefined,
): string | undefined {
  if (slot == null) return undefined;
  return typeof slot === "string" ? slot : slot.content;
}

function sqlProvider(
  slot: string | { readonly evidenceProvider?: string } | null | undefined,
): string | undefined {
  if (slot == null || typeof slot === "string") return undefined;
  return slot.evidenceProvider;
}

describe("cache task evidence", () => {
  it("builds mysql2hive from horae syncInfo without OpenCLI", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cache-task-"));
    writeHoraeTaskTypeCache(
      "62190",
      observedAt,
      {
        id: "62190",
        taskType: "mysql2hive",
        name: "odata_n_uip.q_md_institution_f",
        topic: "ODATA_N_UIP",
        source: "mysql_uip_datayes",
        querySql: "select party_id from md_institution",
        syncInfo: {
          hiveDb: "odata_n_uip",
          hiveTable: "q_md_institution",
          hivePartition: "${YYYY-MM-DD}",
          querySql: "select party_id from md_institution",
          targetTable: "odata_n_uip.q_md_institution",
          sourceServer: "mysql_uip_datayes",
        },
      },
      cacheRoot,
    );
    writeSzdataScheduleDetailCache(
      "62190",
      observedAt,
      {
        taskId: "62190",
        taskType: "19",
        taskName: "odata_n_uip.q_md_institution_f",
        topicName: "ODATA_N_UIP",
        status: "Y",
        cluster: "2",
      },
      cacheRoot,
    );
    const result = assembleCacheTaskEvidence("62190", cacheRoot);
    expect(result.kind).toBe("EVIDENCE");
    if (result.kind !== "EVIDENCE") return;
    expect(result.evidence.taskCategory).toBe("mysql2hive");
    expect(result.evidence.source).toBe("mysql_uip_datayes");
    expect(result.evidence.target).toBe("odata_n_uip.q_md_institution");
    expect(sqlContent(result.evidence.sql?.query)).toBe(
      "select party_id from md_institution",
    );
    expect(result.evidence.evidenceProvider).toContain(
      "local:schedule-evidence:horae-task-type",
    );
    expect(result.missingQuery).toBe(false);
  });

  it("keeps hive2oracle identity when query is missing", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cache-task-"));
    writeHoraeTaskTypeCache(
      "180065",
      observedAt,
      {
        id: "180065",
        taskType: "hive2oracle",
        hiveDb: "dm_otc_n",
        hivePartition: "${YYYY-MM-DD}",
        source: "kxc_hive_pro",
        syncInfo: {
          hiveDb: "dm_otc_n",
          hiveTable: "trd_sso_exch_scr_mtch_day",
          loadMode: "append",
          targetTable: "TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT",
        },
      },
      cacheRoot,
    );
    writeSzdataScheduleDetailCache(
      "180065",
      observedAt,
      {
        taskId: "180065",
        taskType: "24",
        taskName: "TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT",
        topicName: "DM_OTC_N",
        status: "Y",
        insertMode: "append",
        targetTable: "TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT",
        truncateSql:
          "delete from TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT where TRADE_DATE = to_date('${yyyy-MM-dd}', 'yyyy-MM-dd');",
      },
      cacheRoot,
    );
    const result = assembleCacheTaskEvidence("180065", cacheRoot);
    expect(result.kind).toBe("EVIDENCE");
    if (result.kind !== "EVIDENCE") return;
    expect(result.missingQuery).toBe(true);
    expect(result.evidence.source).toBe("dm_otc_n.trd_sso_exch_scr_mtch_day");
    expect(result.evidence.target).toBe(
      "TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT",
    );
    expect(sqlContent(result.evidence.sql?.truncate)).toContain("delete from");
  });

  it("reads hiveTask sql from hive-task.sql", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cache-task-"));
    writeHoraeTaskTypeCache(
      "100078",
      observedAt,
      {
        id: "100078",
        taskType: "hiveTask",
        name: "pdata_n.t05_fin_bdgt_adj_app_evt",
        topic: "PDATA_N",
      },
      cacheRoot,
    );
    writeHiveTaskSqlCache(
      "100078",
      observedAt,
      {
        source: "LOCAL_CODE",
        sqlStatus: "AVAILABLE",
        scriptPath: "EVT/demo.py",
        hiveDb: "pdata_n",
        createSql: "CREATE TABLE IF NOT EXISTS t05 (id string)",
        querySql: "INSERT OVERWRITE TABLE pdata_n.t05 SELECT 1",
      },
      cacheRoot,
    );
    const result = assembleCacheTaskEvidence("100078", cacheRoot);
    expect(result.kind).toBe("EVIDENCE");
    if (result.kind !== "EVIDENCE") return;
    expect(sqlContent(result.evidence.sql?.create)).toContain("CREATE TABLE");
    expect(sqlContent(result.evidence.sql?.query)).toContain("INSERT OVERWRITE");
    expect(result.cacheArtifacts).toContain("hive-task.sql");
  });

  it("splits unmarked hiveTask SQL and publishes the CREATE table as target", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cache-task-"));
    writeHoraeTaskTypeCache(
      "100078",
      observedAt,
      {
        id: "100078",
        taskType: "hiveTask",
        name: "财务预算调整申请事件",
        topic: "EDW_EVT",
        hiveDb: "pdata_n",
      },
      cacheRoot,
    );
    writeSzdataScheduleDetailCache(
      "100078",
      observedAt,
      {
        taskId: "100078",
        taskType: "59",
        taskName: "PDATA_N.T05_FIN_BDGT_ADJ_APP_EVT_HBM002",
        topicName: "EDW_EVT",
        status: "Y",
        database: "pdata_n",
      },
      cacheRoot,
    );
    writeHiveTaskSqlCache(
      "100078",
      observedAt,
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

set hive.exec.dynamic.partition=true;
INSERT OVERWRITE TABLE T05_FIN_BDGT_ADJ_APP_EVT PARTITION(SRC_TBL='\${src_table}',BUSI_DATE='\${data_day_str}')
SELECT A.ID FROM ODATA_N_HBM.H_CUX_ADJ_BUDGET_ADJUST A;`,
        querySql: null,
      },
      cacheRoot,
    );
    const result = assembleCacheTaskEvidence("100078", cacheRoot);
    expect(result.kind).toBe("EVIDENCE");
    if (result.kind !== "EVIDENCE") return;
    expect(sqlContent(result.evidence.sql?.create)).toMatch(
      /^CREATE TABLE IF NOT EXISTS T05_FIN_BDGT_ADJ_APP_EVT/,
    );
    expect(sqlContent(result.evidence.sql?.create)).not.toMatch(/INSERT OVERWRITE/i);
    expect(sqlContent(result.evidence.sql?.query)).toMatch(/INSERT OVERWRITE/i);
    expect(result.missingQuery).toBe(false);
    expect(String(result.evidence.target)).toMatch(
      /pdata_n\.T05_FIN_BDGT_ADJ_APP_EVT/i,
    );
    expect(result.evidence.targetEvidenceKind).toBeUndefined();
  });

  it("reads runScript query from run-script.sql", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cache-task-"));
    writeHoraeTaskTypeCache(
      "74601",
      observedAt,
      { id: "74601", taskType: "runScript-2.0", name: "demo_script" },
      cacheRoot,
    );
    writeRunScriptSqlCache(
      "74601",
      observedAt,
      {
        source: "HORAE_LOG",
        sqlStatus: "AVAILABLE",
        querySql: "SELECT 1 AS id",
        sqlFile: "demo.sql",
        scriptPath: "demo.py",
        hiveDb: null,
        dataDate: "2026-08-27",
      },
      cacheRoot,
    );
    const result = assembleCacheTaskEvidence("74601", cacheRoot);
    expect(result.kind).toBe("EVIDENCE");
    if (result.kind !== "EVIDENCE") return;
    expect(sqlContent(result.evidence.sql?.query)).toBe("SELECT 1 AS id");
    expect(result.cacheArtifacts).toContain("run-script.sql");
  });

  it("remaps sparkIndex evidence providers away from OpenCLI", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cache-task-"));
    writeSzdataScheduleDetailCache(
      "100931",
      observedAt,
      {
        taskId: "100931",
        taskType: "64",
        taskName: "dm_index_n.hold_tag_relation",
        topicName: "DM_INDEX_N",
        status: "Y",
        targetTable: "dm_index_n.hold_tag_relation",
        insertMode: "overwrite",
        createSql: "CREATE TABLE dm_index_n.hold_tag_relation (id string)",
        querySql: "INSERT OVERWRITE TABLE dm_index_n.hold_tag_relation SELECT 1",
      },
      cacheRoot,
    );
    const result = assembleCacheTaskEvidence("100931", cacheRoot);
    expect(result.kind).toBe("EVIDENCE");
    if (result.kind !== "EVIDENCE") return;
    expect(result.evidence.taskCategory).toBe("sparkIndex");
    expect(result.evidence.evidenceProvider).toBe(
      "local:schedule-evidence:szdata-schedule-detail",
    );
    expect(sqlProvider(result.evidence.sql?.query)).toBe(
      "local:schedule-evidence:szdata-schedule-detail",
    );
  });

  it("copies the leading CREATE TABLE from sparkIndex prepareSql into create", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cache-task-"));
    const create =
      "CREATE TABLE IF NOT EXISTS dm_index_n.index_grp_assm_trust_auth_end_date( grp_id STRING ) COMMENT '失效日期' PARTITIONED BY ( busi_date STRING, tag_id STRING ) STORED AS ORC;";
    const prepare = `${create}\nALTER TABLE dm_index_n.index_grp_assm_trust_auth_end_date DROP IF EXISTS PARTITION (busi_date='\${YYYY-MM-DD}' );`;
    writeSzdataScheduleDetailCache(
      "100931",
      observedAt,
      {
        taskId: "100931",
        taskType: "64",
        taskName: "dm_index_n.index_grp_assm_trust_auth_end_date",
        topicName: "DM_INDEX_N",
        status: "Y",
        targetTable: "dm_index_n.index_grp_assm_trust_auth_end_date",
        insertMode: "overwrite",
        prepareSql: prepare,
        querySql: "SELECT grp_id FROM dm_index_n.grp_def",
      },
      cacheRoot,
    );
    const result = assembleCacheTaskEvidence("100931", cacheRoot);
    expect(result.kind).toBe("EVIDENCE");
    if (result.kind !== "EVIDENCE") return;
    expect(sqlContent(result.evidence.sql?.create)).toBe(create);
    expect(sqlContent(result.evidence.sql?.prepare)).toBe(prepare);
    expect(sqlContent(result.evidence.sql?.query)).toContain("grp_def");
    expect(result.evidence.sql?.create).toBeDefined();
    expect(sqlProvider(result.evidence.sql?.create)).toBe(
      "local:schedule-evidence:szdata-schedule-detail",
    );
  });

  it("returns NOT_FOUND when both identity caches miss", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cache-task-"));
    expect(assembleCacheTaskEvidence("missing", cacheRoot)).toEqual({
      kind: "NOT_FOUND",
      cacheArtifacts: [],
    });
  });

  it("returns MANUAL_OR_FROZEN for 手工 cycle", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cache-task-"));
    writeHoraeTaskTypeCache(
      "9",
      observedAt,
      { id: "9", taskType: "hiveTask", cycle: "手工", name: "manual" },
      cacheRoot,
    );
    const result = assembleCacheTaskEvidence("9", cacheRoot);
    expect(result.kind).toBe("MANUAL_OR_FROZEN");
    if (result.kind !== "MANUAL_OR_FROZEN") return;
    expect(result.scheduleCycle).toBe("手工");
  });

  it("materializes metadata-only no-sql categories when scheduler identity exists", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cache-task-"));
    writeHoraeTaskTypeCache(
      "12",
      observedAt,
      { id: "12", taskType: "checkdbflag", name: "flag", topic: "ODATA_N_TIT" },
      cacheRoot,
    );
    const result = assembleCacheTaskEvidence("12", cacheRoot);
    expect(result).toMatchObject({
      kind: "EVIDENCE",
      evidence: {
        taskId: "12",
        taskCategory: "checkdbflag",
        taskName: "flag",
        topicName: "ODATA_N_TIT",
      },
      missingQuery: true,
    });
    if (result.kind !== "EVIDENCE") return;
    expect(sqlSlotCount(result.evidence)).toBe(0);
  });

  it("skips no-sql categories without scheduler identity", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cache-task-"));
    writeHoraeTaskTypeCache(
      "12",
      observedAt,
      { id: "12", taskType: "checkdbflag" },
      cacheRoot,
    );
    const result = assembleCacheTaskEvidence("12", cacheRoot);
    expect(result).toMatchObject({
      kind: "SKIPPED",
      reason: "NO_SQL_SLOT",
      taskCategory: "checkdbflag",
    });
  });
});
