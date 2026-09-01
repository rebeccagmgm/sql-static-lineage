import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { collectInputPackFromCache } from "../scripts/input/mainline/collect-input-pack-from-cache.ts";
import { writeSzdataScheduleDetailCache } from "../scripts/input/mainline/szdata-schedule-detail-cache.ts";
import { writeHoraeTaskTypeCache } from "../scripts/reconcile/consumer/one-hop/schedule-evidence-cache.ts";

const observedAt = "2026-09-02T00:00:00.000Z";

function writeJsonl(dir: string, name: string, lines: readonly unknown[]): string {
  const path = join(dir, name);
  writeFileSync(
    path,
    lines.length === 0
      ? ""
      : `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
    "utf8",
  );
  return path;
}

function fixtureRoots() {
  const dataRoot = mkdtempSync(join(tmpdir(), "from-cache-data-"));
  const cacheRoot = mkdtempSync(join(tmpdir(), "from-cache-cache-"));
  const catalogDir = mkdtempSync(join(tmpdir(), "from-cache-jsonl-"));
  return {
    dataRoot,
    cacheRoot,
    hiveMetadataPath: writeJsonl(catalogDir, "hive-meta.jsonl", []),
    hiveDdlPath: writeJsonl(catalogDir, "hive-ddl.jsonl", [
      {
        qualifiedname: "odata_n_uip.q_md_institution@gfhive:1",
        querytext:
          "CREATE TABLE odata_n_uip.q_md_institution (party_id string)",
      },
    ]),
    rdbmsCorePath: writeJsonl(catalogDir, "rdbms-core.jsonl", [
      {
        qualifiedname:
          "TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT@gforacle_gftzdb#gftzdb",
        type_name: "gf_rdbms_table",
      },
    ]),
    rdbmsDdlPath: writeJsonl(catalogDir, "rdbms-ddl.jsonl", [
      {
        qualifiedname:
          "TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT@gforacle_gftzdb#gftzdb",
        ddl: 'CREATE TABLE "TITANS_TRADEFLOW"."TRANS_SMT_ATP_T_REPORT" ("ID" NUMBER)',
      },
    ]),
  };
}

function collect(
  roots: ReturnType<typeof fixtureRoots>,
  taskIds: readonly string[],
  extra: { force?: boolean } = {},
) {
  return collectInputPackFromCache({
    ...roots,
    taskIds,
    force: extra.force,
    now: () => new Date(observedAt),
  });
}

describe("collect input pack from cache", () => {
  it("writes mysql2hive task and hive table from name-matched ddl", () => {
    const roots = fixtureRoots();
    writeHoraeTaskTypeCache(
      "62190",
      observedAt,
      {
        id: "62190",
        taskType: "mysql2hive",
        name: "odata_n_uip.q_md_institution_f",
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
      roots.cacheRoot,
    );
    const [summary] = collect(roots, ["62190"]);
    expect(summary?.collectionStatus).toBe("SUCCESS");
    expect(summary?.tablesWritten).toBe(1);
    const taskPath = join(
      roots.dataRoot,
      "tasks",
      "mysql2hive",
      "62190",
      "task.json",
    );
    expect(existsSync(taskPath)).toBe(true);
    const task = JSON.parse(readFileSync(taskPath, "utf8")) as {
      evidenceProvider: string;
      source: string;
    };
    expect(task.evidenceProvider).toContain("local:schedule-evidence");
    expect(task.source).toBe("mysql_uip_datayes");
    expect(
      existsSync(
        join(
          roots.dataRoot,
          "tables",
          "hive",
          "odata_n_uip.q_md_institution__gfhive",
          "ddl.sql",
        ),
      ),
    ).toBe(true);
  });

  it("writes hive2oracle identity as PARTIAL when query is missing", () => {
    const roots = fixtureRoots();
    writeHoraeTaskTypeCache(
      "180065",
      observedAt,
      {
        id: "180065",
        taskType: "hive2oracle",
        hiveDb: "dm_otc_n",
        hivePartition: "${YYYY-MM-DD}",
        syncInfo: {
          hiveDb: "dm_otc_n",
          hiveTable: "trd_sso_exch_scr_mtch_day",
          loadMode: "append",
          targetTable: "TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT",
        },
      },
      roots.cacheRoot,
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
        targetTable:
          "TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT@gforacle_gftzdb#gftzdb",
        truncateSql:
          "delete from TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT where TRADE_DATE = to_date('${yyyy-MM-dd}', 'yyyy-MM-dd');",
      },
      roots.cacheRoot,
    );
    const [summary] = collect(roots, ["180065"]);
    expect(summary?.collectionStatus).toBe("PARTIAL");
    expect(summary?.reason ?? "").not.toMatch(/OPENCLI|opencli/i);
    expect(
      existsSync(
        join(
          roots.dataRoot,
          "tables",
          "oracle",
          "TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT__gforacle_gftzdb#gftzdb",
          "ddl.sql",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(roots.dataRoot, "tasks", "hive2oracle", "180065", "task.json"),
      ),
    ).toBe(true);
  });

  it("skips an existing valid pack and does not overwrite", () => {
    const roots = fixtureRoots();
    writeHoraeTaskTypeCache(
      "62190",
      observedAt,
      {
        id: "62190",
        taskType: "mysql2hive",
        name: "odata_n_uip.q_md_institution_f",
        source: "mysql_uip_datayes",
        querySql: "select party_id from md_institution",
        syncInfo: {
          hiveDb: "odata_n_uip",
          hiveTable: "q_md_institution",
          targetTable: "odata_n_uip.q_md_institution",
        },
      },
      roots.cacheRoot,
    );
    expect(collect(roots, ["62190"])[0]?.collectionStatus).toBe("SUCCESS");
    const second = collect(roots, ["62190"]);
    expect(second[0]).toMatchObject({
      collectionStatus: "SKIPPED",
      reason: "EXISTING_VALID_PACK",
    });
  });

  it("excludes tasks missing both identity caches", () => {
    const roots = fixtureRoots();
    const [summary] = collect(roots, ["404"]);
    expect(summary).toMatchObject({
      collectionStatus: "EXCLUDED",
      reason: "HORAE_TASK_NOT_FOUND",
    });
  });
});
