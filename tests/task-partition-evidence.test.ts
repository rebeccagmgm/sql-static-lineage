import { describe, expect, it } from "vitest";
import {
  buildCompactTaskPartition,
  buildSimpleTaskPartitionMap,
  buildTaskPartitionEvidence,
} from "../scripts/input/task-partition-evidence.ts";

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
  it("emits null only when the target table is confirmed non-partitioned", () => {
    expect(
      buildCompactTaskPartition({
        taskTarget: target,
        tables: [table([])],
        sql: { query: "SELECT id FROM source_table" },
      }),
    ).toBeNull();
  });

  it("omits partition when the target partition value is incomplete", () => {
    expect(
      buildCompactTaskPartition({
        taskTarget: target,
        tables: [table(["busi_date", "grp_id"])],
        sql: {
          query:
            "INSERT OVERWRITE TABLE dm_index_n.index_grp_cust_acct_cnt PARTITION(busi_date='2026-08-22', grp_id) SELECT id, grp_id FROM source_table;",
        },
      }),
    ).toBeUndefined();
  });

  it("omits partition when any write to the target remains incomplete", () => {
    expect(
      buildCompactTaskPartition({
        taskTarget: target,
        tables: [table(["busi_date"])],
        sql: {
          query:
            "INSERT OVERWRITE TABLE dm_index_n.index_grp_cust_acct_cnt PARTITION(busi_date='2026-08-22') SELECT id FROM source_a; INSERT OVERWRITE TABLE dm_index_n.index_grp_cust_acct_cnt PARTITION(busi_date) SELECT * FROM source_b;",
        },
      }),
    ).toBeUndefined();
  });

  it("omits partition when UNION branches disagree on a dynamic value", () => {
    expect(
      buildCompactTaskPartition({
        taskTarget: target,
        tables: [table(["grp_id"])],
        sql: {
          query:
            "INSERT OVERWRITE TABLE dm_index_n.index_grp_cust_acct_cnt PARTITION(grp_id) SELECT id, '01' AS grp_id FROM source_a UNION ALL SELECT id, '02' AS grp_id FROM source_b;",
        },
      }),
    ).toBeUndefined();
  });

  it("omits an implicit target partition when UNION branches disagree", () => {
    expect(
      buildCompactTaskPartition({
        taskTarget: target,
        tables: [table(["grp_id"])],
        sql: {
          query:
            "SELECT id, '01' AS grp_id FROM source_a UNION ALL SELECT id, '02' AS grp_id FROM source_b;",
        },
      }),
    ).toBeUndefined();
  });

  it("omits partition when table metadata does not say whether fields exist", () => {
    expect(
      buildCompactTaskPartition({
        taskTarget: target,
        tables: [table()],
        sql: { query: "SELECT id FROM source_table" },
      }),
    ).toBeUndefined();
  });

  it("accepts a single uniquely identified target when task target is absent", () => {
    expect(
      buildCompactTaskPartition({
        tables: [table(["busi_date"])],
        sparkIndexMode: true,
        sql: {
          query:
            "INSERT OVERWRITE TABLE dm_index_n.index_grp_cust_acct_cnt PARTITION(busi_date='2026-08-22') SELECT id FROM source_table;",
        },
      }),
    ).toEqual({ busi_date: "${YYYY-MM-DD}" });
  });

  it("does not use an intermediate table partition as the task target partition", () => {
    expect(
      buildCompactTaskPartition({
        taskTarget: "features.client_label_latest",
        tables: [
          {
            ...table(["dim_index"]),
            qualifiedName: "temp_n.client_label",
          },
        ],
        sql: {
          query:
            "INSERT INTO PLACEHOLDER_INSERT_DB.PLACEHOLDER_INSERT_TABLE(client) SELECT client FROM src.t; INSERT OVERWRITE TABLE temp_n.client_label PARTITION(dim_index='grp1') SELECT client FROM src.t;",
        },
      }),
    ).toBeUndefined();
  });

  it("keeps the partition shape as a simple field-to-value map", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table(["busi_date"])],
        sparkIndexMode: true,
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
        sparkIndexMode: true,
        sql: {
          create:
            "CREATE TABLE x (id bigint) PARTITIONED BY (busi_date string)",
          query:
            "INSERT OVERWRITE TABLE dm_index_n.index_grp_cust_acct_cnt PARTITION(busi_date='2026-08-22') SELECT 1;",
        },
      }),
    ).toEqual({ busi_date: "${YYYY-MM-DD}" });
  });

  it("canonicalizes a target date literal from an implicit query output", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table(["busi_date"])],
        sparkIndexMode: true,
        sql: {
          query:
            "SELECT id, '2026-05-24' AS busi_date FROM source_table",
        },
      }),
    ).toEqual({ busi_date: "${YYYY-MM-DD}" });
  });

  it("keeps a unique dynamic target expression in the compact map", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table(["busi_date"])],
        sparkIndexMode: true,
        sql: {
          query:
            "SELECT id, SUBSTR(A.AS_OF, 1, 10) AS busi_date FROM source_table A",
        },
      }),
    ).toEqual({ busi_date: "SUBSTR(A.AS_OF, 1, 10)" });
  });

  it("does not apply sparkIndex projection rules to the default resolver mode", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table(["busi_date"])],
        sql: {
          query: "SELECT id, '2026-05-24' AS busi_date FROM source_table",
        },
      }),
    ).toEqual({ busi_date: "2026-05-24" });
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table(["busi_date"])],
        sql: {
          query:
            "SELECT id, SUBSTR(A.AS_OF, 1, 10) AS busi_date FROM source_table A",
        },
      }),
    ).toBeUndefined();
  });

  it("defaults an unresolved single busi_date partition in sparkIndex mode", () => {
    expect(
      buildCompactTaskPartition({
        taskTarget: target,
        tables: [table(["busi_date"])],
        sparkIndexMode: true,
        sql: {
          query:
            "INSERT OVERWRITE TABLE dm_index_n.index_grp_cust_acct_cnt PARTITION(busi_date) SELECT id, busi_date FROM source_table",
        },
      }),
    ).toEqual({ busi_date: "${YYYY-MM-DD}" });
  });

  it("combines the busi_date default with proven other partition fields", () => {
    expect(
      buildCompactTaskPartition({
        taskTarget: target,
        tables: [table(["grp_id", "busi_date"])],
        sparkIndexMode: true,
        sql: {
          query:
            "INSERT OVERWRITE TABLE dm_index_n.index_grp_cust_acct_cnt PARTITION(grp_id='01', busi_date) SELECT id, busi_date FROM source_table",
        },
      }),
    ).toEqual({ grp_id: "01", busi_date: "${YYYY-MM-DD}" });
  });

  it("does not emit a partial map when another partition field is unknown", () => {
    expect(
      buildCompactTaskPartition({
        taskTarget: target,
        tables: [table(["grp_id", "busi_date"])],
        sparkIndexMode: true,
        sql: {
          query:
            "INSERT OVERWRITE TABLE dm_index_n.index_grp_cust_acct_cnt PARTITION(grp_id, busi_date) SELECT id, grp_id, busi_date FROM source_table",
        },
      }),
    ).toBeUndefined();
  });

  it("canonicalizes concrete dates before comparing partition branches", () => {
    expect(
      buildCompactTaskPartition({
        taskTarget: target,
        tables: [table(["busi_date"])],
        sparkIndexMode: true,
        sql: {
          query:
            "SELECT id, '2026-05-24' AS busi_date FROM source_a UNION ALL SELECT id, '2026-05-25' AS busi_date FROM source_b",
        },
      }),
    ).toEqual({ busi_date: "${YYYY-MM-DD}" });
  });

  it("preserves multiple complete sparkIndex partition instances as an array", () => {
    expect(
      buildCompactTaskPartition({
        taskTarget: target,
        tables: [table(["grp_id", "busi_date"])],
        sparkIndexMode: true,
        sql: {
          query:
            "SELECT id, '01' AS grp_id, '2026-05-24' AS busi_date FROM source_a UNION ALL SELECT id, '02' AS grp_id, '2026-05-24' AS busi_date FROM source_b",
        },
      }),
    ).toEqual([
      { grp_id: "01", busi_date: "${YYYY-MM-DD}" },
      { grp_id: "02", busi_date: "${YYYY-MM-DD}" },
    ]);
  });

  it("keeps multiple partition fields as the same flat map", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table(["src_tbl", "busi_date"])],
        sparkIndexMode: true,
        sql: {
          query:
            "INSERT OVERWRITE TABLE dm_index_n.index_grp_cust_acct_cnt PARTITION(src_tbl='ODATA_N_TIT.D_REF_TRS', busi_date='2026-08-22') SELECT 1;",
        },
      }),
    ).toEqual({
      src_tbl: "ODATA_N_TIT.D_REF_TRS",
      busi_date: "${YYYY-MM-DD}",
    });
  });

  it("does not infer a wildcard output binding from a source filter", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table(["src_tbl"])],
        sql: {
          query:
            "INSERT OVERWRITE TABLE dm_index_n.index_grp_cust_acct_cnt PARTITION(src_tbl) SELECT * FROM source_table WHERE src_tbl='ODATA_N_TIT.D_REF_TRS';",
        },
      }),
    ).toBeUndefined();
  });

  it("does not guess a wildcard write when its partition filter has multiple values", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table(["src_tbl"])],
        sql: {
          query:
            "INSERT OVERWRITE TABLE dm_index_n.index_grp_cust_acct_cnt PARTITION(src_tbl) SELECT * FROM source_table WHERE src_tbl IN ('ODATA_N_TIT.D_REF_TRS','ODATA_N_TIT.D_REF_TRS2');",
        },
      }),
    ).toBeUndefined();
  });

  it("keeps wildcard source-filter evidence explicitly incomplete", () => {
    expect(
      buildTaskPartitionEvidence({
        taskTarget: target,
        tables: [table(["src_tbl"])],
        sql: {
          query:
            "INSERT OVERWRITE TABLE dm_index_n.index_grp_cust_acct_cnt PARTITION(src_tbl) SELECT * FROM source_table WHERE src_tbl='ODATA_N_TIT.D_REF_TRS';",
        },
      }),
    ).toMatchObject({
      status: "INCOMPLETE",
      targets: [
        {
          target,
          status: "INCOMPLETE",
          writes: [
            {
              status: "INCOMPLETE",
              assignments: [
                {
                  field: "src_tbl",
                  status: "UNKNOWN",
                  reason: "DYNAMIC_PARTITION_WILDCARD_OUTPUT",
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("uses create.sql fields and the implicit query output when INSERT is absent", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table()],
        sparkIndexMode: true,
        sql: {
          create:
            "CREATE TABLE dm_index_n.index_grp_cust_acct_cnt (id bigint) PARTITIONED BY (busi_date string)",
          query:
            "SELECT id, '${YYYY-MM-DD}' AS busi_date FROM dm_index_n.source_table",
        },
      }),
    ).toEqual({ busi_date: "${YYYY-MM-DD}" });
  });

  it("uses only the matching CREATE statement as a partition fallback", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table()],
        sql: {
          create:
            "CREATE TABLE dm_index_n.other (id bigint) PARTITIONED BY (wrong_field string); CREATE TABLE dm_index_n.index_grp_cust_acct_cnt (id bigint) PARTITIONED BY (busi_date string);",
          query:
            "SELECT id, '${YYYY-MM-DD}' AS busi_date FROM dm_index_n.source_table",
        },
      }),
    ).toEqual({ busi_date: "${YYYY-MM-DD}" });
  });

  it("does not match a qualified CREATE target from another schema", () => {
    expect(
      buildSimpleTaskPartitionMap({
        taskTarget: target,
        tables: [table()],
        sql: {
          create:
            "CREATE TABLE other_schema.index_grp_cust_acct_cnt (id bigint) PARTITIONED BY (busi_date string);",
          query:
            "SELECT id, '${YYYY-MM-DD}' AS busi_date FROM dm_index_n.source_table",
        },
      }),
    ).toBeUndefined();
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
        sparkIndexMode: true,
        sql: {
          create:
            "CREATE TABLE dm_index_n.index_grp_cust_acct_cnt (id bigint) PARTITIONED BY (busi_date string)",
          prepare:
            "ALTER TABLE dm_index_n.index_grp_cust_acct_cnt ADD IF NOT EXISTS PARTITION (busi_date='2026-08-22')",
        },
      }),
    ).toEqual({ busi_date: "${YYYY-MM-DD}" });
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

  it("keeps structured unknown evidence for a source extraction task", () => {
    expect(
      buildTaskPartitionEvidence({
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
    ).toMatchObject({
      status: "INCOMPLETE",
      targets: [
        {
          target: "odata_n_tit.d_v_wm_cashflow_report_tit",
          tableStatus: "PARTITIONED",
          status: "INCOMPLETE",
          writes: [
            {
              assignments: [
                {
                  field: "busi_date",
                  status: "UNKNOWN",
                  reason: "SOURCE_SQL_NOT_TARGET_WRITE",
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("excludes the platform synthetic insert target from partition evidence", () => {
    const evidence = buildTaskPartitionEvidence({
      taskTarget: "features.client_label_latest",
      tables: [
        {
          ...table(["dim_index"]),
          qualifiedName: "temp_n.client_label",
        },
      ],
      sql: {
        query:
          "INSERT INTO PLACEHOLDER_INSERT_DB.PLACEHOLDER_INSERT_TABLE(client) SELECT client FROM src.t; INSERT OVERWRITE TABLE temp_n.client_label PARTITION(dim_index) SELECT client, 'grp1' AS dim_index FROM src.t;",
      },
    });

    expect(evidence.targets.map((item) => item.target)).toEqual([
      "features.client_label_latest",
      "temp_n.client_label",
    ]);
    expect(evidence.targets).not.toContainEqual(
      expect.objectContaining({
        target: "placeholder_insert_db.placeholder_insert_table",
      }),
    );
    expect(evidence.targets[0]).toMatchObject({
      target: "features.client_label_latest",
      status: "UNKNOWN",
      reasonCodes: ["TABLE_PACK_PARTITION_FIELDS_UNAVAILABLE"],
    });
    expect(evidence.targets[1]).toMatchObject({
      target: "temp_n.client_label",
      status: "COMPLETE",
    });
  });
});
