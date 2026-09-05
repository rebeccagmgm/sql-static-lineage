import { describe, expect, it } from "vitest";

import {
  columnNamesFromCreateTable,
  extractSqlReadTableNames,
  isSoleStarSelectQuery,
  queryOutputColumnNames,
  queryProjectionColumnNames,
} from "../scripts/input/shared/sql-table-references.ts";

describe("SQL Input Pack table discovery", () => {
  it("discovers physical source tables instead of treating a datasource label as a table", () => {
    expect(
      extractSqlReadTableNames(`
        SELECT ENTITY_ID
        FROM TITANS_DM.ADM_AUDIT_LOG
        WHERE ENTITY_TYPE = 'FROM fake.example'
        -- JOIN commented.example
      `),
    ).toEqual(["TITANS_DM.ADM_AUDIT_LOG"]);
  });

  it("does not request CTE names as physical tables", () => {
    expect(
      extractSqlReadTableNames(
        "WITH source_rows AS (SELECT id FROM raw.source_table) SELECT id FROM source_rows JOIN raw.other_table ON source_rows.id = raw.other_table.id",
      ),
      ).toEqual(["raw.other_table", "raw.source_table"]);
  });
});

describe("query projection columns for spliced DDL", () => {
  it("reads output names from a simple *2hive SELECT list", () => {
    expect(
      queryOutputColumnNames(
        "SELECT OBJECT_ID, S_INFO_WINDCODE FROM WIND.TB_OBJECT_3511",
      ),
    ).toEqual(["OBJECT_ID", "S_INFO_WINDCODE"]);
  });

  it("uses AS aliases as Hive output names and source columns for that table", () => {
    const sql =
      "SELECT YG_ID AS staff_id, NVL(YG_NAME, '-') AS staff_name FROM KDBASE.T_YGZCY";
    expect(queryOutputColumnNames(sql)).toEqual(["staff_id", "staff_name"]);
    expect(queryProjectionColumnNames(sql, "KDBASE.T_YGZCY")).toEqual([
      "YG_ID",
      "YG_NAME",
    ]);
  });

  it("attributes JOIN columns to the matching FROM object only", () => {
    const sql =
      "SELECT a.YG_ID, b.DEPT_NAME FROM KDBASE.T_YGZCY a JOIN HR.DEPT b ON a.DEPT_ID = b.DEPT_ID";
    expect(queryProjectionColumnNames(sql, "KDBASE.T_YGZCY")).toEqual([
      "YG_ID",
    ]);
    expect(queryProjectionColumnNames(sql, "HR.DEPT")).toEqual(["DEPT_NAME"]);
  });

  it("unwraps a single-argument TRIM as the source column", () => {
    expect(
      queryProjectionColumnNames(
        "SELECT '${YYYY-MM-DD}' AS BUSI_DATE, trim(CUST_PTY_NO), trim(SYS_CODE) FROM tgbsjcl.acs_cust_bill_list",
        "tgbsjcl.acs_cust_bill_list",
      ),
    ).toEqual(["CUST_PTY_NO", "SYS_CODE"]);
  });

  it("reads backtick column names from a Hive CREATE", () => {
    expect(
      columnNamesFromCreateTable(
        "CREATE EXTERNAL TABLE IF NOT EXISTS odata_acs.acs_t_acs_cust_bill_list ( `busi_date` string, `cust_pty_no` string )",
      ),
    ).toEqual(["busi_date", "cust_pty_no"]);
  });

  it("does not invent columns from SELECT *", () => {
    expect(
      queryOutputColumnNames("SELECT * FROM WIND.TB_OBJECT_3511"),
    ).toEqual([]);
    expect(
      queryProjectionColumnNames(
        "SELECT t.* FROM WIND.TB_OBJECT_3511 t",
        "WIND.TB_OBJECT_3511",
      ),
    ).toEqual([]);
  });

  it("detects exact sole SELECT * and rejects joins or column lists", () => {
    expect(
      isSoleStarSelectQuery("select * from src_gfjgj.go_order_sync"),
    ).toBe(true);
    expect(
      isSoleStarSelectQuery(
        "SELECT * FROM public.offline_prod_share_his WHERE dt = '2026-08-27'",
      ),
    ).toBe(true);
    expect(
      isSoleStarSelectQuery(
        "SELECT t.* FROM src_gfjgj.go_order_sync t",
      ),
    ).toBe(false);
    expect(
      isSoleStarSelectQuery(
        "SELECT ORDER_ID FROM src_gfjgj.go_order_sync",
      ),
    ).toBe(false);
    expect(
      isSoleStarSelectQuery(
        "SELECT * FROM src_gfjgj.go_order_sync a JOIN src_gfjgj.go_cust b ON a.id = b.id",
      ),
    ).toBe(false);
    expect(
      isSoleStarSelectQuery(
        "SELECT * FROM src_gfjgj.go_order_sync, src_gfjgj.go_cust",
      ),
    ).toBe(false);
  });
});
