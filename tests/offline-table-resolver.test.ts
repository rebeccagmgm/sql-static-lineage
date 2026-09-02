import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadOfflineTableCatalog,
  parsePhysicalTableName,
  platformFromDataSource,
  resolveOfflineTables,
} from "../scripts/input/shared/offline-table-resolver.ts";
import { writeTableInput, type TaskEvidence } from "../scripts/input/shared/input-pack.ts";

function writeJsonl(dir: string, name: string, lines: readonly unknown[]): string {
  const path = join(dir, name);
  writeFileSync(
    path,
    `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
    "utf8",
  );
  return path;
}

function task(overrides: Partial<TaskEvidence> = {}): TaskEvidence {
  return {
    taskId: "100931",
    taskCategory: "sparkIndex",
    target: "dm_index_n.hold_tag_relation",
    sql: {
      query: "SELECT id FROM dm_index_n.hold_tag_relation",
    },
    ...overrides,
  };
}

describe("offline table name helpers", () => {
  it("strips hive ddl timestamp from dataSource", () => {
    expect(
      parsePhysicalTableName(
        "dm_index_n.hold_tag_relation@gfhive:1739783191128",
      ),
    ).toEqual({
      qualifiedName: "dm_index_n.hold_tag_relation",
      dataSource: "gfhive",
    });
  });

  it("maps gfhive and oracle prefixes", () => {
    expect(platformFromDataSource("gfhive")).toBe("hive");
    expect(platformFromDataSource("gforacle_gftzdb#gftzdb")).toBe("oracle");
  });
});

describe("offline table resolver", () => {
  it("adds a gfhive table from ddl alone when names match, without guid", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-table-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", [
        {
          qualifiedname: "dm_index_n.hold_tag_relation@gfhive:1",
          querytext: "CREATE TABLE dm_index_n.hold_tag_relation (id string)",
        },
      ]),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", []),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", []),
    });
    const dataRoot = mkdtempSync(join(tmpdir(), "pack-"));
    const resolved = resolveOfflineTables(dataRoot, task(), catalog, () =>
      new Date("2026-09-02T00:00:00.000Z"),
    );
    expect(resolved.unavailable).toEqual([]);
    expect(resolved.resolved).toHaveLength(1);
    expect(resolved.resolved[0]).toMatchObject({
      platform: "hive",
      dataSource: "gfhive",
      qualifiedName: "dm_index_n.hold_tag_relation",
      objectType: "hive_table",
    });
    expect(resolved.resolved[0]?.guid).toBeUndefined();
    expect(resolved.resolved[0]?.ddl).toContain("CREATE TABLE");
    expect(resolved.resolved[0]?.partitionFields).toEqual([]);
  });

  it("writes hive partitionFields from PARTITIONED BY, not into task.partition", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-table-"));
    const ddl =
      "CREATE TABLE dm_index_n.index_grp_assm_trust_auth_end_date( grp_id STRING ) COMMENT 'x' PARTITIONED BY ( busi_date STRING COMMENT '业务日期', tag_id STRING COMMENT '标签ID' ) STORED AS ORC";
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", [
        {
          qualifiedname:
            "dm_index_n.index_grp_assm_trust_auth_end_date@gfhive:1",
          querytext: ddl,
        },
      ]),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", []),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", []),
    });
    const dataRoot = mkdtempSync(join(tmpdir(), "pack-"));
    const resolved = resolveOfflineTables(
      dataRoot,
      task({
        target: "dm_index_n.index_grp_assm_trust_auth_end_date",
        sql: { query: "SELECT 1 FROM dm_index_n.index_grp_assm_trust_auth_end_date" },
      }),
      catalog,
    );
    expect(resolved.resolved[0]?.partitionFields).toEqual([
      "busi_date",
      "tag_id",
    ]);
    const written = writeTableInput(dataRoot, resolved.resolved[0]!);
    const tableJson = JSON.parse(
      readFileSync(join(written.directory, "table.json"), "utf8"),
    ) as { partitionFields?: unknown };
    expect(tableJson.partitionFields).toEqual(["busi_date", "tag_id"]);
    expect(resolved.resolved[0]?.description).toBe("x");
  });

  it("ignores hive ALTER querytext and falls back to unique task CREATE", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-table-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", [
        {
          guid: "meta-guid",
          qualifiedname_clean: "odata_n_uip.q_md_institution",
          datasource: "gfhive",
          status: "ACTIVE",
          type_name: "hive_table",
        },
      ]),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", [
        {
          qualifiedname: "odata_n_uip.q_md_institution@gfhive:1",
          querytext:
            "alter table q_md_institution change column data_time data_time string comment '数据时间'",
        },
      ]),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", []),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", []),
    });
    const create =
      "CREATE TABLE odata_n_uip.q_md_institution(party_id string) COMMENT '机构主表' PARTITIONED BY (busi_date string)";
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        target: "odata_n_uip.q_md_institution",
        sql: {
          create,
          query: "SELECT party_id FROM odata_n_uip.q_md_institution",
        },
      }),
      catalog,
    );
    expect(resolved.resolved[0]?.ddl).toBe(create);
    expect(resolved.resolved[0]?.evidenceProvider).toBe(
      "input-pack:task-sql-create",
    );
    expect(resolved.resolved[0]?.guid).toBeUndefined();
    expect(resolved.resolved[0]?.description).toBe("机构主表");
    expect(resolved.resolved[0]?.partitionFields).toEqual(["busi_date"]);
  });

  it("joins hive metadata and ddl by table name when guids differ", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-table-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", [
        {
          guid: "meta-guid",
          qualifiedname_clean: "dm_index_n.hold_tag_relation",
          datasource: "gfhive",
          status: "ACTIVE",
          type_name: "hive_table",
        },
      ]),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", [
        {
          guid: "other-guid",
          qualifiedname: "dm_index_n.hold_tag_relation@gfhive:99",
          querytext: "CREATE TABLE dm_index_n.hold_tag_relation (id string)",
        },
      ]),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", []),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", []),
    });
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task(),
      catalog,
    );
    expect(resolved.resolved[0]?.ddl).toContain("CREATE TABLE");
    expect(resolved.resolved[0]?.guid).toBeUndefined();
  });

  it("joins rdbms core and ddl by qualifiedname, guid optional", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-table-"));
    const qn = "TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT@gforacle_gftzdb#gftzdb";
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          qualifiedname: qn,
          type_name: "gf_rdbms_table",
          primarykeys: "TE_REPORT_ID,TRADE_DATE",
          comment: "成交流水",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", [
        {
          qualifiedname: qn,
          ddl: 'CREATE TABLE "TITANS_TRADEFLOW"."TRANS_SMT_ATP_T_REPORT" ("ID" NUMBER)',
        },
      ]),
    });
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskCategory: "hive2oracle",
        source: "dm_otc_n.src",
        target: "TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT@gforacle_gftzdb#gftzdb",
        sql: { truncate: "delete from TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT" },
      }),
      catalog,
    );
    const oracle = resolved.resolved.find((item) => item.platform === "oracle");
    expect(oracle?.guid).toBeUndefined();
    expect(oracle?.dataSource).toBe("gforacle_gftzdb#gftzdb");
    expect(oracle?.ddl).toContain("TRANS_SMT_ATP_T_REPORT");
    expect(oracle?.description).toBe("成交流水");
    expect(oracle?.partitionFields).toEqual([]);
    expect(oracle?.primaryKey).toBeUndefined();
  });

  it("omits rdbms partitionFields when PARTITION BY RANGE (null)", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-table-"));
    const qn = "TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT@gforacle_gftzdb#gftzdb";
    const ddl =
      'CREATE TABLE "TITANS_TRADEFLOW"."TRANS_SMT_ATP_T_REPORT" ("ID" NUMBER ,"TRADE_DATE" DATE)  PARTITION BY RANGE (null)  INTERVAL (NUMTOYMINTERVAL(1, \'MONTH\')) ( PARTITION "p_month_1" VALUES LESS THAN (TO_DATE(\' 2024-11-01 00:00:00\', \'SYYYY-MM-DD HH24:MI:SS\', \'NLS_CALENDAR=GREGORIAN\')));COMMENT ON TABLE "TITANS_TRADEFLOW"."TRANS_SMT_ATP_T_REPORT"  IS \'带有委托编号的成交流水表\';';
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          guid: "jsonl-guid-must-not-be-copied",
          qualifiedname: qn,
          type_name: "gf_rdbms_table",
          ispartitioned: "true",
          comment: "带有委托编号的成交流水表",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", [{ qualifiedname: qn, ddl }]),
    });
    const dataRoot = mkdtempSync(join(tmpdir(), "pack-"));
    const resolved = resolveOfflineTables(
      dataRoot,
      task({
        taskCategory: "hive2oracle",
        target: qn,
        sql: { truncate: "delete from TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT" },
      }),
      catalog,
    );
    const oracle = resolved.resolved.find((item) => item.platform === "oracle");
    expect(oracle?.guid).toBeUndefined();
    expect(oracle?.description).toBe("带有委托编号的成交流水表");
    expect(oracle?.partitionFields).toBeUndefined();
    const written = writeTableInput(dataRoot, oracle!);
    const tableJson = JSON.parse(
      readFileSync(join(written.directory, "table.json"), "utf8"),
    ) as { guid?: string; partitionFields?: unknown };
    expect(tableJson.guid).toBeUndefined();
    expect("partitionFields" in tableJson).toBe(false);
  });

  it("writes rdbms partitionFields from parseable PARTITION BY RANGE", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-table-"));
    const qn = "TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT@gforacle_gftzdb#gftzdb";
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          qualifiedname: qn,
          type_name: "gf_rdbms_table",
          ispartitioned: "true",
          comment: "成交流水",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", [
        {
          qualifiedname: qn,
          ddl: 'CREATE TABLE "TITANS_TRADEFLOW"."TRANS_SMT_ATP_T_REPORT" ("TRADE_DATE" DATE) PARTITION BY RANGE ("TRADE_DATE") INTERVAL (NUMTOYMINTERVAL(1, \'MONTH\')) (PARTITION "p1" VALUES LESS THAN (MAXVALUE))',
        },
      ]),
    });
    const dataRoot = mkdtempSync(join(tmpdir(), "pack-"));
    const resolved = resolveOfflineTables(
      dataRoot,
      task({
        taskCategory: "hive2oracle",
        target: qn,
        sql: { truncate: "delete from TITANS_TRADEFLOW.TRANS_SMT_ATP_T_REPORT" },
      }),
      catalog,
    );
    const oracle = resolved.resolved.find((item) => item.platform === "oracle");
    expect(oracle?.partitionFields).toEqual(["TRADE_DATE"]);
    const written = writeTableInput(dataRoot, oracle!);
    const tableJson = JSON.parse(
      readFileSync(join(written.directory, "table.json"), "utf8"),
    ) as { partitionFields?: unknown };
    expect(tableJson.partitionFields).toEqual(["TRADE_DATE"]);
  });

  it("reuses an existing table pack", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "pack-"));
    writeTableInput(dataRoot, {
      platform: "hive",
      dataSource: "gfhive",
      qualifiedName: "dm_index_n.hold_tag_relation",
      objectType: "hive_table",
      ddl: "CREATE TABLE dm_index_n.hold_tag_relation (id string)",
      evidenceProvider: "local:table-pack",
    });
    const dir = mkdtempSync(join(tmpdir(), "offline-table-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", []),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", []),
    });
    const resolved = resolveOfflineTables(dataRoot, task(), catalog);
    expect(resolved.resolved[0]?.evidenceProvider).toMatch(/local:table-pack|local:tables-cache/);
  });

  it("uses unique task CREATE when hive metadata exists but ddl does not", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-table-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", [
        {
          qualifiedname_clean: "dm_index_n.hold_tag_relation",
          datasource: "gfhive",
          status: "ACTIVE",
          type_name: "hive_table",
        },
      ]),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", []),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", []),
    });
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        sql: {
          create:
            "CREATE TABLE dm_index_n.hold_tag_relation (id string)",
        },
      }),
      catalog,
    );
    expect(resolved.resolved[0]?.evidenceProvider).toBe("input-pack:task-sql-create");
    expect(resolved.resolved[0]?.guid).toBeUndefined();
  });

  it("omits empty hive description so table.json can be written", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-table-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", [
        {
          qualifiedname_clean: "odata_n_hbm.h_cux_adj_budget_adjust",
          datasource: "gfhive",
          status: "ACTIVE",
          type_name: "hive_table",
          comment: "",
        },
      ]),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", [
        {
          qualifiedname: "odata_n_hbm.h_cux_adj_budget_adjust@gfhive:1",
          querytext:
            "create table h_cux_adj_budget_adjust (document_id string comment '文档id') COMMENT ''",
        },
      ]),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", []),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", []),
    });
    const dataRoot = mkdtempSync(join(tmpdir(), "pack-"));
    const resolved = resolveOfflineTables(
      dataRoot,
      task({
        target: "odata_n_hbm.h_cux_adj_budget_adjust",
        sql: { query: "SELECT 1 FROM odata_n_hbm.h_cux_adj_budget_adjust" },
      }),
      catalog,
    );
    expect(resolved.resolved[0]?.description).toBeUndefined();
    const written = writeTableInput(dataRoot, resolved.resolved[0]!);
    const tableJson = JSON.parse(
      readFileSync(join(written.directory, "table.json"), "utf8"),
    ) as { description?: string };
    expect(tableJson.description).toBeUndefined();
  });

  it("qualifies an unqualified hiveTask CREATE from the task name schema", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-table-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", []),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", []),
    });
    const create =
      "CREATE TABLE IF NOT EXISTS T05_FIN_BDGT_ADJ_APP_EVT(\n    Evt_Id STRING\n)COMMENT '财务预算调整申请事件'\nPARTITIONED BY (SRC_TBL STRING, BUSI_DATE STRING)\nSTORED AS ORC;";
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskId: "100078",
        taskCategory: "hiveTask",
        taskName: "PDATA_N.T05_FIN_BDGT_ADJ_APP_EVT_HBM002",
        target: undefined,
        sql: {
          create,
          query:
            "INSERT OVERWRITE TABLE T05_FIN_BDGT_ADJ_APP_EVT SELECT 1 FROM ODATA_N_HBM.H_CUX_ADJ_BUDGET_ADJUST",
        },
      }),
      catalog,
    );
    const target = resolved.resolved.find(
      (item) =>
        item.qualifiedName.toLowerCase() ===
        "pdata_n.t05_fin_bdgt_adj_app_evt",
    );
    expect(target?.evidenceProvider).toBe("input-pack:task-sql-create");
    expect(target?.description).toBe("财务预算调整申请事件");
    expect(target?.partitionFields).toEqual(["src_tbl", "busi_date"]);
    expect(target?.guid).toBeUndefined();
  });
});
