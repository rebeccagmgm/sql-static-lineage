import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { assembleCacheTaskEvidence } from "../scripts/input/shared/cache-task-evidence.ts";
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

  it("skips no-sql categories", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cache-task-"));
    writeHoraeTaskTypeCache(
      "12",
      observedAt,
      { id: "12", taskType: "checkdbflag", name: "flag" },
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
