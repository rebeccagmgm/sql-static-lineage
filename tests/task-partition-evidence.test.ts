import { describe, expect, it } from "vitest";
import { buildSimpleTaskPartitionMap } from "../scripts/input/task-partition-evidence.ts";

const target = "dm_index_n.index_grp_cust_acct_cnt";

function table(partitionFields?: readonly string[]) {
  return {
    platform: "hive",
    dataSource: "gfhive",
    qualifiedName: target,
    objectType: "TABLE",
    ...(partitionFields === undefined ? {} : { partitionFields }),
    ddl: "CREATE TABLE dm_index_n.index_grp_cust_acct_cnt (id bigint)",
    evidenceProvider: "fixture:table",
  };
}

describe("task partition map fallback", () => {
  it("keeps the partition shape as a simple field-to-value map", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table(["busi_date"])],
        sql: {
          query: "SELECT TRANSFER_ID FROM source_table",
        },
        schedulerEvidence: {
          hivePartition: "busi_date=${YYYY-MM-DD}",
          evidenceProvider: "fixture:scheduler",
        },
      }),
    ).toEqual({ busi_date: "${YYYY-MM-DD}" });
  });

  it("keeps the existing explicit INSERT partition path primary", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table(["busi_date"])],
        sql: {
          create:
            "CREATE TABLE x (id bigint) PARTITIONED BY (busi_date string)",
          query:
            "INSERT OVERWRITE TABLE dm_index_n.index_grp_cust_acct_cnt PARTITION(busi_date='2026-08-22') SELECT 1;",
        },
      }),
    ).toEqual({ busi_date: "2026-08-22" });
  });

  it("keeps multiple partition fields as the same flat map", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table(["src_tbl", "busi_date"])],
        sql: {
          query:
            "INSERT OVERWRITE TABLE dm_index_n.index_grp_cust_acct_cnt PARTITION(src_tbl='ODATA_N_TIT.D_REF_TRS', busi_date='2026-08-22') SELECT 1;",
        },
      }),
    ).toEqual({
      src_tbl: "ODATA_N_TIT.D_REF_TRS",
      busi_date: "2026-08-22",
    });
  });

  it("uses create.sql fields and the implicit query output when INSERT is absent", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table()],
        sql: {
          create:
            "CREATE TABLE dm_index_n.index_grp_cust_acct_cnt (id bigint) PARTITIONED BY (busi_date string)",
          query:
            "SELECT id, '${YYYY-MM-DD}' AS busi_date FROM dm_index_n.source_table",
        },
      }),
    ).toEqual({ busi_date: "${YYYY-MM-DD}" });
  });

  it("resolves a unique nested output reference", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table()],
        sql: {
          create:
            "CREATE TABLE dm_index_n.index_grp_cust_acct_cnt (id bigint) PARTITIONED BY (busi_date string)",
          query:
            "WITH source_rows AS (SELECT '${YYYY-MM-DD}' AS busi_date FROM src.t) SELECT source_rows.busi_date AS busi_date FROM source_rows",
        },
      }),
    ).toEqual({ busi_date: "${YYYY-MM-DD}" });
  });

  it("uses ADD PARTITION when the query has no INSERT", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table()],
        sql: {
          create:
            "CREATE TABLE dm_index_n.index_grp_cust_acct_cnt (id bigint) PARTITIONED BY (busi_date string)",
          prepare:
            "ALTER TABLE dm_index_n.index_grp_cust_acct_cnt ADD IF NOT EXISTS PARTITION (busi_date='2026-08-22')",
        },
      }),
    ).toEqual({ busi_date: "2026-08-22" });
  });

  it("does not treat source extraction SQL as a target partition", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: "odata_n_tit.d_v_wm_cashflow_report_tit",
        tables: [
          {
            ...table(["busi_date"]),
            qualifiedName: "odata_n_tit.d_v_wm_cashflow_report_tit",
          },
        ],
        sql: {
          query:
            "SELECT TRANSFER_ID, to_char(SYSDATE, 'YYYY-MM-DD') AS DATA_TIME FROM TITANS_DM.V_WM_CASHFLOW_REPORT_TIT",
        },
        allowImplicitQueryOutput: false,
      }),
    ).toBeUndefined();
  });
});
