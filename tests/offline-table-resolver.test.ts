import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  extractOfflineTableCandidates,
  loadOfflineTableCatalog,
  parsePhysicalTableName,
  platformFromDataSource,
  resolveOfflineTables,
} from "../scripts/input/shared/offline-table-resolver.ts";
import {
  isKnownHoraeDatasourceLabel,
  loadHoraeDatasourceIndex,
  preferredRdbmsDataSourceFromTaskSource,
} from "../scripts/input/shared/horae-datasource-cache.ts";
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

  it("skips *2hive source datasource labels as table candidates", () => {
    const names = extractOfflineTableCandidates(
      task({
        taskId: "68",
        taskCategory: "oracle2hive",
        source: "oracle_rbjygl_85.236",
        target: "odata_ygt.nygt_t_coverstockjour",
        sql: {
          query:
            "SELECT 1 FROM HS_OPT.COVERSTOCKJOUR WHERE INIT_DATE = '${YYYY-MM-DD}'",
        },
      }),
    ).map((item) => item.qualifiedName.toLowerCase());
    expect(names).toContain("odata_ygt.nygt_t_coverstockjour");
    expect(names).toContain("hs_opt.coverstockjour");
    expect(names).not.toContain("oracle_rbjygl_85.236");
  });

  it("still includes source table candidates for non-*2hive tasks", () => {
    const names = extractOfflineTableCandidates(
      task({
        taskCategory: "hive2oracle",
        source: "pdata_n.some_src",
        target: "HS_USER.STKCODE",
        sql: { query: "SELECT 1 FROM pdata_n.some_src" },
      }),
    ).map((item) => item.qualifiedName.toLowerCase());
    expect(names).toContain("pdata_n.some_src");
  });

  it("filters only a unique exact datasource label and keeps unknown physical values", () => {
    const horaeDatasource = {
      byServerTag: new Map([
        [
          "oracle_known_1",
          {
            serverTag: "oracle_known_1",
            serverType: "oracle",
            service: "known",
          },
        ],
      ]),
    };
    const known = extractOfflineTableCandidates(
      task({
        taskCategory: "oracle2hive",
        source: "oracle_known_1",
        target: "odata.target",
        sql: { query: "SELECT 1 FROM schema.read_table" },
      }),
      horaeDatasource,
    ).map((item) => item.qualifiedName.toLowerCase());
    expect(known).not.toContain("oracle_known_1");

    const unknownPhysical = extractOfflineTableCandidates(
      task({
        taskCategory: "oracle2hive",
        source: "schema.read_table@gforacle_unknown#unknown",
        target: "odata.target",
        sql: { query: "SELECT 1 FROM schema.read_table" },
      }),
      horaeDatasource,
    );
    expect(unknownPhysical).toContainEqual({
      qualifiedName: "schema.read_table",
      dataSource: "gforacle_unknown#unknown",
    });
  });

  it("marks conflicting Horae server tags ambiguous instead of choosing a row", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "horae-datasource-conflict-"));
    const directory = join(cacheRoot, "schedule-evidence", "horae-datasource");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "rows.jsonl"),
      [
        { server_tag: "oracle_conflict", server_type: "oracle", service: "a" },
        { server_tag: "oracle_conflict", server_type: "oracle", service: "b" },
      ].map((row) => JSON.stringify(row)).join("\n") + "\n",
      "utf8",
    );
    const index = loadHoraeDatasourceIndex(cacheRoot);
    expect(index?.ambiguousServerTags).toEqual(new Set(["oracle_conflict"]));
    expect(isKnownHoraeDatasourceLabel("oracle_conflict", index)).toBe(false);
    expect(preferredRdbmsDataSourceFromTaskSource("oracle_conflict", index)).toBe(
      undefined,
    );
    const mysqlIndex = {
      byServerTag: new Map([
        [
          "mysql_sag_sagg",
          { serverTag: "mysql_sag_sagg", serverType: "mysql", service: "sagg" },
        ],
      ]),
    };
    expect(preferredRdbmsDataSourceFromTaskSource("mysql_sag_sagg", mysqlIndex)).toBe(
      "gfmysql_sagg",
    );
    expect(
      preferredRdbmsDataSourceFromTaskSource("postgres_fxjs_85.234", {
        byServerTag: new Map([
          [
            "postgres_fxjs_85.234",
            {
              serverTag: "postgres_fxjs_85.234",
              serverType: "postgre",
              service: "risk",
            },
          ],
        ]),
      }),
    ).toBe("gfpostgre_risk#risk");
  });
});

describe("RDBMS disambiguation via horae-datasource", () => {
  it("resolves ambiguous Oracle core rows using server_tag → service", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-rdbms-amb-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", [
        {
          qualifiedname: "odata_ygt.nygt_t_coverstockjour@gfhive",
          querytext:
            "CREATE TABLE odata_ygt.nygt_t_coverstockjour (id string)",
        },
      ]),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          qualifiedname: "HS_OPT.COVERSTOCKJOUR@gforacle_gfufjy2#gfufjy",
          name: "COVERSTOCKJOUR",
          type_name: "gf_rdbms_table",
        },
        {
          qualifiedname: "HS_OPT.COVERSTOCKJOUR@gforacle_jyglrac#jyglrac",
          name: "COVERSTOCKJOUR",
          type_name: "gf_rdbms_table",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", [
        {
          qualifiedname: "HS_OPT.COVERSTOCKJOUR@gforacle_gfufjy2#gfufjy",
          ddl: "CREATE TABLE HS_OPT.COVERSTOCKJOUR (ID NUMBER)",
        },
        {
          qualifiedname: "HS_OPT.COVERSTOCKJOUR@gforacle_jyglrac#jyglrac",
          ddl: "CREATE TABLE HS_OPT.COVERSTOCKJOUR (ID NUMBER, X NUMBER)",
        },
      ]),
      horaeDatasource: {
        byServerTag: new Map([
          [
            "oracle_rbjygl_85.236",
            {
              serverTag: "oracle_rbjygl_85.236",
              serverType: "oracle",
              service: "jyglrac",
            },
          ],
        ]),
      },
    });
    const dataRoot = mkdtempSync(join(tmpdir(), "pack-"));
    const resolved = resolveOfflineTables(
      dataRoot,
      task({
        taskId: "68",
        taskCategory: "oracle2hive",
        source: "oracle_rbjygl_85.236",
        target: "odata_ygt.nygt_t_coverstockjour",
        sql: {
          query: "SELECT 1 FROM HS_OPT.COVERSTOCKJOUR",
        },
      }),
      catalog,
      () => new Date("2026-09-02T00:00:00.000Z"),
    );
    expect(resolved.unavailable).toEqual([]);
    const oracle = resolved.resolved.find(
      (item) =>
        item.qualifiedName.toLowerCase() === "hs_opt.coverstockjour",
    );
    expect(oracle?.dataSource?.toLowerCase()).toBe("gforacle_jyglrac#jyglrac");
    expect(oracle?.evidenceProvider).toContain("local:horae-datasource");
  });

  it("resolves ambiguous MySQL core rows via gfmysql_${service} prefix", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-rdbms-mysql-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", [
        {
          qualifiedname: "odata_sag.s_related_person@gfhive",
          querytext: "CREATE TABLE odata_sag.s_related_person (id string)",
        },
      ]),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          qualifiedname: "sagg.related_person@gfmysql_sagg5",
          name: "related_person",
          type_name: "gf_rdbms_table",
        },
        {
          qualifiedname: "sagg.related_person@gfmysql_sbhf",
          name: "related_person",
          type_name: "gf_rdbms_table",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", [
        {
          qualifiedname: "sagg.related_person@gfmysql_sagg5",
          ddl: "CREATE TABLE sagg.related_person (id bigint)",
        },
        {
          qualifiedname: "sagg.related_person@gfmysql_sbhf",
          ddl: "CREATE TABLE sagg.related_person (id bigint)",
        },
      ]),
      horaeDatasource: {
        byServerTag: new Map([
          [
            "mysql_sag_sagg",
            {
              serverTag: "mysql_sag_sagg",
              serverType: "mysql",
              service: "sagg",
            },
          ],
        ]),
      },
    });
    const dataRoot = mkdtempSync(join(tmpdir(), "pack-mysql-"));
    const resolved = resolveOfflineTables(
      dataRoot,
      task({
        taskId: "5439",
        taskCategory: "mysql2hive",
        source: "mysql_sag_sagg",
        target: "odata_sag.s_related_person",
        sql: {
          query: "SELECT 1 FROM sagg.related_person",
        },
      }),
      catalog,
      () => new Date("2026-09-03T00:00:00.000Z"),
    );
    expect(resolved.unavailable).toEqual([]);
    const mysql = resolved.resolved.find(
      (item) => item.qualifiedName.toLowerCase() === "sagg.related_person",
    );
    expect(mysql?.dataSource?.toLowerCase()).toBe("gfmysql_sagg5");
    expect(mysql?.evidenceProvider).toContain("local:horae-datasource");
  });

  it("matches #service suffix when gforacle_service#service instance is numbered", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-rdbms-svc-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          qualifiedname: "CRMII.TAPP_CHANNELTYPE@gforacle_jgjdb1#jgjdb",
          name: "TAPP_CHANNELTYPE",
          type_name: "gf_rdbms_table",
        },
        {
          qualifiedname: "CRMII.TAPP_CHANNELTYPE@gforacle_jgjdbuat#jgjdbuat",
          name: "TAPP_CHANNELTYPE",
          type_name: "gf_rdbms_table",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", [
        {
          qualifiedname: "CRMII.TAPP_CHANNELTYPE@gforacle_jgjdb1#jgjdb",
          ddl: "CREATE TABLE CRMII.TAPP_CHANNELTYPE (ID NUMBER)",
        },
        {
          qualifiedname: "CRMII.TAPP_CHANNELTYPE@gforacle_jgjdbuat#jgjdbuat",
          ddl: "CREATE TABLE CRMII.TAPP_CHANNELTYPE (ID NUMBER)",
        },
      ]),
      horaeDatasource: {
        byServerTag: new Map([
          [
            "oracle_jgj_69.202",
            {
              serverTag: "oracle_jgj_69.202",
              serverType: "oracle",
              service: "jgjdb",
            },
          ],
        ]),
      },
    });
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskId: "124",
        taskCategory: "oracle2hive",
        source: "oracle_jgj_69.202",
        target: undefined,
        sql: { query: "SELECT 1 FROM CRMII.TAPP_CHANNELTYPE" },
      }),
      catalog,
    );
    expect(resolved.unavailable).toEqual([]);
    expect(resolved.resolved[0]?.dataSource?.toLowerCase()).toBe(
      "gforacle_jgjdb1#jgjdb",
    );
  });

  it("prefers gforacle_jgjdb1#jgjdb when #jgjdb has multiple numbered prod instances", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-rdbms-jgjdb-multi-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          qualifiedname: "CRMII.TRYXX@gforacle_jgjdb1#jgjdb",
          name: "TRYXX",
          type_name: "gf_rdbms_table",
        },
        {
          qualifiedname: "CRMII.TRYXX@gforacle_jgjdb2#jgjdb",
          name: "TRYXX",
          type_name: "gf_rdbms_table",
        },
        {
          qualifiedname: "CRMII.TRYXX@gforacle_jgjdbuat#jgjdbuat",
          name: "TRYXX",
          type_name: "gf_rdbms_table",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", [
        {
          qualifiedname: "CRMII.TRYXX@gforacle_jgjdb1#jgjdb",
          ddl: "CREATE TABLE CRMII.TRYXX (ID NUMBER)",
        },
        {
          qualifiedname: "CRMII.TRYXX@gforacle_jgjdb2#jgjdb",
          ddl: "CREATE TABLE CRMII.TRYXX (ID NUMBER)",
        },
        {
          qualifiedname: "CRMII.TRYXX@gforacle_jgjdbuat#jgjdbuat",
          ddl: "CREATE TABLE CRMII.TRYXX (ID NUMBER)",
        },
      ]),
      horaeDatasource: {
        byServerTag: new Map([
          [
            "oracle_jgj_69.202",
            {
              serverTag: "oracle_jgj_69.202",
              serverType: "oracle",
              service: "jgjdb",
            },
          ],
        ]),
      },
    });
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskId: "143",
        taskCategory: "oracle2hive",
        source: "oracle_jgj_69.202",
        target: undefined,
        sql: { query: "SELECT 1 FROM CRMII.TRYXX" },
      }),
      catalog,
    );
    expect(resolved.unavailable).toEqual([]);
    expect(resolved.resolved[0]?.dataSource?.toLowerCase()).toBe(
      "gforacle_jgjdb1#jgjdb",
    );
  });

  it("collapses case-fold Atlas duplicates that share instanceid", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-rdbms-casefold-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          qualifiedname: "XIR_MD.TBND@gforacle_xir3#Xir",
          instanceid: "xir3@gforacle",
          guid: "guid-upper",
          type_name: "gf_rdbms_table",
        },
        {
          qualifiedname: "XIR_MD.TBND@gforacle_xir3#xir",
          instanceid: "xir3@gforacle",
          guid: "guid-lower",
          type_name: "gf_rdbms_table",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", [
        {
          qualifiedname: "XIR_MD.TBND@gforacle_xir3#Xir",
          instanceid: "xir3@gforacle",
          ddl: "CREATE TABLE XIR_MD.TBND (ID NUMBER)",
        },
        {
          qualifiedname: "XIR_MD.TBND@gforacle_xir3#xir",
          instanceid: "xir3@gforacle",
          ddl: "CREATE TABLE XIR_MD.TBND (ID NUMBER)",
        },
      ]),
      horaeDatasource: {
        byServerTag: new Map([
          [
            "oracle_xir_xir",
            {
              serverTag: "oracle_xir_xir",
              serverType: "oracle",
              service: "Xir",
            },
          ],
        ]),
      },
    });
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskId: "1176",
        taskCategory: "oracle2hive",
        source: "oracle_xir_xir",
        target: undefined,
        sql: { query: "SELECT 1 FROM XIR_MD.TBND" },
      }),
      catalog,
    );
    expect(resolved.unavailable).toEqual([]);
    expect(resolved.resolved[0]?.dataSource?.toLowerCase()).toBe(
      "gforacle_xir3#xir",
    );
  });

  it("prefers gforacle_oracle_uip_winddb#winddb for oracle_wande when #winddb is multi", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-rdbms-wind-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          qualifiedname: "WIND.TB_OBJECT_1021@gforacle_jcywdb3#jcywdb",
          name: "TB_OBJECT_1021",
          type_name: "gf_rdbms_table",
        },
        {
          qualifiedname:
            "WIND.TB_OBJECT_1021@gforacle_oracle_uip_winddb#winddb",
          name: "TB_OBJECT_1021",
          type_name: "gf_rdbms_table",
        },
        {
          qualifiedname: "WIND.TB_OBJECT_1021@gforacle_winddb4#winddb",
          name: "TB_OBJECT_1021",
          type_name: "gf_rdbms_table",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", [
        {
          qualifiedname:
            "WIND.TB_OBJECT_1021@gforacle_oracle_uip_winddb#winddb",
          ddl: "CREATE TABLE WIND.TB_OBJECT_1021 (ID NUMBER)",
        },
        {
          qualifiedname: "WIND.TB_OBJECT_1021@gforacle_winddb4#winddb",
          ddl: "CREATE TABLE WIND.TB_OBJECT_1021 (ID NUMBER)",
        },
      ]),
      horaeDatasource: {
        byServerTag: new Map([
          [
            "oracle_wande_89.132",
            {
              serverTag: "oracle_wande_89.132",
              serverType: "oracle",
              service: "winddb",
              host: "10.2.89.132",
            },
          ],
        ]),
      },
    });
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskId: "166",
        taskCategory: "oracle2hive",
        source: "oracle_wande_89.132",
        target: undefined,
        sql: { query: "SELECT 1 FROM WIND.TB_OBJECT_1021" },
      }),
      catalog,
    );
    expect(resolved.unavailable).toEqual([]);
    expect(resolved.resolved[0]?.dataSource?.toLowerCase()).toBe(
      "gforacle_oracle_uip_winddb#winddb",
    );
  });

  it("stays AMBIGUOUS when horae-datasource is absent", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-rdbms-amb2-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          qualifiedname: "HS_OPT.COVERSTOCKJOUR@gforacle_gfufjy2#gfufjy",
          name: "COVERSTOCKJOUR",
          type_name: "gf_rdbms_table",
        },
        {
          qualifiedname: "HS_OPT.COVERSTOCKJOUR@gforacle_jyglrac#jyglrac",
          name: "COVERSTOCKJOUR",
          type_name: "gf_rdbms_table",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", [
        {
          qualifiedname: "HS_OPT.COVERSTOCKJOUR@gforacle_jyglrac#jyglrac",
          ddl: "CREATE TABLE HS_OPT.COVERSTOCKJOUR (ID NUMBER)",
        },
      ]),
      horaeDatasource: null,
    });
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskId: "68",
        taskCategory: "oracle2hive",
        source: "oracle_rbjygl_85.236",
        target: undefined,
        sql: { query: "SELECT 1 FROM HS_OPT.COVERSTOCKJOUR" },
      }),
      catalog,
    );
    expect(resolved.unavailable).toEqual([
      {
        qualifiedName: "HS_OPT.COVERSTOCKJOUR",
        reason: "RDBMS_CORE_AMBIGUOUS",
      },
    ]);
  });
});

describe("offline table resolver", () => {
  it("uses a unique Hive2 endpoint hint without inventing a non-Oracle datasource", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-hive2-hint-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", [
        {
          qualifiedname: "odata_n.demo_source@gfhive",
          querytext: "CREATE TABLE odata_n.demo_source (ID INT)",
        },
      ]),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          qualifiedname: "HS_OPT.DEMO_TARGET@gforacle_jgjdb#jgjdb",
          type_name: "gf_rdbms_table",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", [
        {
          qualifiedname: "HS_OPT.DEMO_TARGET@gforacle_jgjdb#jgjdb",
          ddl: "CREATE TABLE HS_OPT.DEMO_TARGET (ID NUMBER)",
        },
      ]),
      horaeDatasource: null,
    });
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskCategory: "hive2oracle",
        source: "odata_n.demo_source",
        target: "HS_OPT.DEMO_TARGET",
        endpointDataSourceHints: { target: "gforacle_jgjdb#jgjdb" },
        sql: { query: "INSERT INTO HS_OPT.DEMO_TARGET SELECT 1" },
      }),
      catalog,
    );
    expect(resolved.unavailable).toEqual([]);
    expect(resolved.resolved[0]).toMatchObject({
      qualifiedName: "HS_OPT.DEMO_TARGET",
      dataSource: "gforacle_jgjdb#jgjdb",
      platform: "oracle",
    });
  });

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

describe("task-evidence splice fallback", () => {
  function emptyCatalog(dir: string) {
    return loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", []),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", []),
      horaeDatasource: null,
    });
  }

  it("splices a Hive target from the query SELECT when metadata and ddl miss", () => {
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskId: "255",
        taskCategory: "oracle2hive",
        topicName: "ODATA_MSG",
        source: "oracle_wande_89.132",
        target: "odata_msg.wfd_w_tb_object_3511",
        sql: {
          query:
            "SELECT OBJECT_ID, S_INFO_WINDCODE FROM WIND.TB_OBJECT_3511",
        },
      }),
      emptyCatalog(mkdtempSync(join(tmpdir(), "offline-splice-hive-"))),
    );
    const hive = resolved.resolved.find(
      (item) =>
        item.qualifiedName.toLowerCase() === "odata_msg.wfd_w_tb_object_3511",
    );
    expect(hive?.platform).toBe("hive");
    expect(hive?.dataSource).toBe("gfhive");
    expect(hive?.guid).toBeUndefined();
    expect(hive?.evidenceProvider).toBe(
      "input-pack:spliced-from-query-projection",
    );
    expect(hive?.ddl).toMatch(/CREATE\s+TABLE/i);
    expect(hive?.ddl).toMatch(/OBJECT_ID/i);
    expect(hive?.ddl).toMatch(/S_INFO_WINDCODE/i);
  });

  it("splices an RDBMS source from horae hint plus SQL when core misses", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-splice-rdbms-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", [
        {
          qualifiedname: "odata_mms.mms_k_t_ygzcy@gfhive",
          querytext:
            "CREATE TABLE odata_mms.mms_k_t_ygzcy (yg_id string, yg_name string)",
        },
      ]),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", []),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", []),
      horaeDatasource: {
        byServerTag: new Map([
          [
            "oracle_yxgl_jjir_gc",
            {
              serverTag: "oracle_yxgl_jjir_gc",
              serverType: "oracle",
              service: "yxgl_jjir_gc",
            },
          ],
        ]),
      },
    });
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskId: "557",
        taskCategory: "oracle2hive",
        topicName: "ODATA_MMS",
        source: "oracle_yxgl_jjir_gc",
        target: "odata_mms.mms_k_t_ygzcy",
        sql: {
          query: "SELECT YG_ID, YG_NAME FROM KDBASE.T_YGZCY",
        },
      }),
      catalog,
    );
    expect(
      resolved.unavailable.filter((item) =>
        item.qualifiedName.toLowerCase().includes("t_ygzcy"),
      ),
    ).toEqual([]);
    const oracle = resolved.resolved.find(
      (item) => item.qualifiedName.toLowerCase() === "kdbase.t_ygzcy",
    );
    expect(oracle?.platform).toBe("oracle");
    expect(oracle?.dataSource?.toLowerCase()).toBe(
      "gforacle_yxgl_jjir_gc#yxgl_jjir_gc",
    );
    expect(oracle?.guid).toBeUndefined();
    expect(oracle?.evidenceProvider).toBe("input-pack:spliced-from-task-sql");
    expect(oracle?.ddl).toMatch(/YG_ID/i);
    expect(oracle?.ddl).toMatch(/YG_NAME/i);
    expect(oracle?.ddl).not.toMatch(/mms_k_t_ygzcy/i);
  });

  it("lets real jsonl and task CREATE win over an existing spliced local pack", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "pack-splice-stale-"));
    writeTableInput(dataRoot, {
      platform: "hive",
      dataSource: "gfhive",
      qualifiedName: "odata_msg.wfd_w_tb_object_3511",
      objectType: "hive_table",
      ddl: "CREATE TABLE odata_msg.wfd_w_tb_object_3511 (stub string)",
      evidenceProvider: "input-pack:spliced-from-query-projection",
    });
    writeTableInput(dataRoot, {
      platform: "oracle",
      dataSource: "gforacle_yxgl_jjir_gc#yxgl_jjir_gc",
      qualifiedName: "KDBASE.T_YGZCY",
      objectType: "gf_rdbms_table",
      ddl: "CREATE TABLE KDBASE.T_YGZCY (stub VARCHAR2(4000))",
      evidenceProvider: "input-pack:spliced-from-task-sql",
    });
    const dir = mkdtempSync(join(tmpdir(), "offline-splice-override-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", [
        {
          qualifiedname: "odata_msg.wfd_w_tb_object_3511@gfhive",
          querytext:
            "CREATE TABLE odata_msg.wfd_w_tb_object_3511 (object_id string, s_info_windcode string)",
        },
      ]),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          qualifiedname: "KDBASE.T_YGZCY@gforacle_yxgl_jjir_gc#yxgl_jjir_gc",
          type_name: "gf_rdbms_table",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", [
        {
          qualifiedname: "KDBASE.T_YGZCY@gforacle_yxgl_jjir_gc#yxgl_jjir_gc",
          ddl: "CREATE TABLE KDBASE.T_YGZCY (YG_ID NUMBER, YG_NAME VARCHAR2(64))",
        },
      ]),
      horaeDatasource: {
        byServerTag: new Map([
          [
            "oracle_yxgl_jjir_gc",
            {
              serverTag: "oracle_yxgl_jjir_gc",
              serverType: "oracle",
              service: "yxgl_jjir_gc",
            },
          ],
        ]),
      },
    });
    const resolved = resolveOfflineTables(
      dataRoot,
      task({
        taskId: "557",
        taskCategory: "oracle2hive",
        source: "oracle_yxgl_jjir_gc",
        target: "odata_msg.wfd_w_tb_object_3511",
        sql: {
          create:
            "CREATE TABLE odata_msg.wfd_w_tb_object_3511 (object_id string)",
          query: "SELECT YG_ID, YG_NAME FROM KDBASE.T_YGZCY",
        },
      }),
      catalog,
    );
    const hive = resolved.resolved.find(
      (item) =>
        item.qualifiedName.toLowerCase() === "odata_msg.wfd_w_tb_object_3511",
    );
    const oracle = resolved.resolved.find(
      (item) => item.qualifiedName.toLowerCase() === "kdbase.t_ygzcy",
    );
    expect(hive?.evidenceProvider).toBe("local:hive-ddl-jsonl");
    expect(hive?.ddl).toContain("s_info_windcode");
    expect(oracle?.evidenceProvider).toContain("local:rdbms-core-jsonl");
    expect(oracle?.ddl).toContain("YG_ID NUMBER");
  });

  it("keeps numbered siblings and missing hints as MISS or AMB", () => {
    const ambDir = mkdtempSync(join(tmpdir(), "offline-splice-amb-"));
    const ambCatalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(ambDir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(ambDir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(ambDir, "rdbms-core.jsonl", [
        {
          qualifiedname: "KDBASE.T_YGZCY@gforacle_jjir1#jjir",
          type_name: "gf_rdbms_table",
        },
        {
          qualifiedname: "KDBASE.T_YGZCY@gforacle_jjir2#jjir",
          type_name: "gf_rdbms_table",
        },
      ]),
      rdbmsDdlPath: writeJsonl(ambDir, "rdbms-ddl.jsonl", [
        {
          qualifiedname: "KDBASE.T_YGZCY@gforacle_jjir1#jjir",
          ddl: "CREATE TABLE KDBASE.T_YGZCY (ID NUMBER)",
        },
        {
          qualifiedname: "KDBASE.T_YGZCY@gforacle_jjir2#jjir",
          ddl: "CREATE TABLE KDBASE.T_YGZCY (ID NUMBER)",
        },
      ]),
      horaeDatasource: null,
    });
    const ambiguous = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskCategory: "oracle2hive",
        source: "oracle_yxgl_jjir_gc",
        target: undefined,
        sql: { query: "SELECT ID FROM KDBASE.T_YGZCY" },
      }),
      ambCatalog,
    );
    expect(ambiguous.unavailable).toContainEqual({
      qualifiedName: "KDBASE.T_YGZCY",
      reason: "RDBMS_CORE_AMBIGUOUS",
    });

    const noHint = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskCategory: "oracle2hive",
        source: "oracle_unknown_no_hint",
        target: undefined,
        sql: { query: "SELECT ID FROM KDBASE.T_YGZCY" },
      }),
      emptyCatalog(mkdtempSync(join(tmpdir(), "offline-splice-nohint-"))),
    );
    expect(noHint.unavailable).toContainEqual({
      qualifiedName: "KDBASE.T_YGZCY",
      reason: "TABLE_JSONL_MISS",
    });
    expect(
      noHint.resolved.some(
        (item) => item.qualifiedName.toLowerCase() === "kdbase.t_ygzcy",
      ),
    ).toBe(false);
  });

  it("splices Hive DDL onto metadata when catalog identity hits but ddl misses", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-splice-meta-ddl-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", [
        {
          qualifiedname_clean: "odata_msg.wfd_w_tb_object_3511",
          datasource: "gfhive",
          status: "ACTIVE",
          type_name: "hive_table",
          comment: "wind object",
        },
      ]),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", []),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", []),
      horaeDatasource: null,
    });
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskCategory: "oracle2hive",
        target: "odata_msg.wfd_w_tb_object_3511",
        sql: {
          query: "SELECT OBJECT_ID, S_INFO_WINDCODE FROM WIND.TB_OBJECT_3511",
        },
      }),
      catalog,
    );
    const hive = resolved.resolved.find(
      (item) =>
        item.qualifiedName.toLowerCase() === "odata_msg.wfd_w_tb_object_3511",
    );
    expect(hive?.description).toBe("wind object");
    expect(hive?.evidenceProvider).toBe(
      "input-pack:spliced-from-query-projection",
    );
    expect(hive?.ddl).toMatch(/OBJECT_ID/i);
  });

  it("splices RDBMS DDL onto core identity when ddl jsonl misses", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-splice-core-ddl-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", [
        {
          qualifiedname: "odata_mms.mms_k_t_ygzcy@gfhive",
          querytext: "CREATE TABLE odata_mms.mms_k_t_ygzcy (yg_id string)",
        },
      ]),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          qualifiedname: "KDBASE.T_YGZCY@gforacle_yxgl_jjir_gc#yxgl_jjir_gc",
          type_name: "gf_rdbms_table",
          comment: "员工",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", []),
      horaeDatasource: {
        byServerTag: new Map([
          [
            "oracle_yxgl_jjir_gc",
            {
              serverTag: "oracle_yxgl_jjir_gc",
              serverType: "oracle",
              service: "yxgl_jjir_gc",
            },
          ],
        ]),
      },
    });
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskCategory: "oracle2hive",
        source: "oracle_yxgl_jjir_gc",
        target: "odata_mms.mms_k_t_ygzcy",
        sql: { query: "SELECT YG_ID, YG_NAME FROM KDBASE.T_YGZCY" },
      }),
      catalog,
    );
    const oracle = resolved.resolved.find(
      (item) => item.qualifiedName.toLowerCase() === "kdbase.t_ygzcy",
    );
    expect(oracle?.description).toBe("员工");
    expect(oracle?.dataSource?.toLowerCase()).toBe(
      "gforacle_yxgl_jjir_gc#yxgl_jjir_gc",
    );
    expect(oracle?.evidenceProvider).toBe("input-pack:spliced-from-task-sql");
    expect(oracle?.ddl).toMatch(/YG_ID/i);
  });

  it("does not copy Hive target CREATE columns onto a joined RDBMS table", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-splice-join-hint-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", [
        {
          qualifiedname: "odata_n_erp.g_gl_balances_update@gfhive",
          querytext:
            "CREATE TABLE odata_n_erp.g_gl_balances_update (ledger_id string, period_name string)",
        },
      ]),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", []),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", []),
      horaeDatasource: {
        byServerTag: new Map([
          [
            "oracle_erp_proddb",
            {
              serverTag: "oracle_erp_proddb",
              serverType: "oracle",
              service: "proddb",
            },
          ],
        ]),
      },
    });
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskCategory: "oracle2hive",
        source: "oracle_erp_proddb",
        target: "odata_n_erp.g_gl_balances_update",
        sql: {
          create:
            "CREATE TABLE odata_n_erp.g_gl_balances_update (ledger_id string, period_name string)",
          query:
            "SELECT a.ledger_id FROM GL.gl_balances a JOIN apps.GL_PERIODS p ON a.period_name=p.period_name",
        },
      }),
      catalog,
    );
    expect(resolved.unavailable).toContainEqual({
      qualifiedName: "apps.GL_PERIODS",
      reason: "TABLE_JSONL_MISS",
    });
  });

  it("splices a Hive target from sole SELECT * plus resolved source DDL", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-splice-source-ddl-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          qualifiedname: "SRC_GFJGJ.GO_ORDER_SYNC@gforacle_jgjdb1#jgjdb1",
          type_name: "gf_rdbms_table",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", [
        {
          qualifiedname: "SRC_GFJGJ.GO_ORDER_SYNC@gforacle_jgjdb1#jgjdb1",
          ddl: "CREATE TABLE SRC_GFJGJ.GO_ORDER_SYNC (ORDER_ID NUMBER, CUST_NO VARCHAR2(32), SYNC_TIME DATE)",
        },
      ]),
      horaeDatasource: {
        byServerTag: new Map([
          [
            "oracle_jgjdb1",
            {
              serverTag: "oracle_jgjdb1",
              serverType: "oracle",
              service: "jgjdb1",
            },
          ],
        ]),
      },
    });
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskId: "14578",
        taskCategory: "oracle2hive",
        source: "oracle_jgjdb1",
        target: "gf_jgj_crm.go_order_sync",
        sql: { query: "select * from src_gfjgj.go_order_sync" },
      }),
      catalog,
    );
    const hive = resolved.resolved.find(
      (item) =>
        item.qualifiedName.toLowerCase() === "gf_jgj_crm.go_order_sync",
    );
    expect(hive?.platform).toBe("hive");
    expect(hive?.evidenceProvider).toBe("input-pack:spliced-from-source-ddl");
    expect(hive?.ddl).toMatch(/ORDER_ID/i);
    expect(hive?.ddl).toMatch(/CUST_NO/i);
    expect(hive?.ddl).toMatch(/SYNC_TIME/i);
    expect(hive?.ddl).toMatch(/STRING/i);
    expect(
      resolved.unavailable.some(
        (item) =>
          item.qualifiedName.toLowerCase() === "gf_jgj_crm.go_order_sync",
      ),
    ).toBe(false);
  });

  it("does not splice Hive target columns from source DDL when the query joins two tables", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-splice-source-join-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          qualifiedname: "SRC_GFJGJ.GO_ORDER_SYNC@gforacle_jgjdb1#jgjdb1",
          type_name: "gf_rdbms_table",
        },
        {
          qualifiedname: "SRC_GFJGJ.GO_CUST@gforacle_jgjdb1#jgjdb1",
          type_name: "gf_rdbms_table",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", [
        {
          qualifiedname: "SRC_GFJGJ.GO_ORDER_SYNC@gforacle_jgjdb1#jgjdb1",
          ddl: "CREATE TABLE SRC_GFJGJ.GO_ORDER_SYNC (ORDER_ID NUMBER, CUST_NO VARCHAR2(32))",
        },
        {
          qualifiedname: "SRC_GFJGJ.GO_CUST@gforacle_jgjdb1#jgjdb1",
          ddl: "CREATE TABLE SRC_GFJGJ.GO_CUST (CUST_NO VARCHAR2(32), CUST_NAME VARCHAR2(64))",
        },
      ]),
      horaeDatasource: {
        byServerTag: new Map([
          [
            "oracle_jgjdb1",
            {
              serverTag: "oracle_jgjdb1",
              serverType: "oracle",
              service: "jgjdb1",
            },
          ],
        ]),
      },
    });
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskCategory: "oracle2hive",
        source: "oracle_jgjdb1",
        target: "gf_jgj_crm.go_order_sync",
        sql: {
          query:
            "SELECT * FROM src_gfjgj.go_order_sync a JOIN src_gfjgj.go_cust b ON a.cust_no = b.cust_no",
        },
      }),
      catalog,
    );
    expect(resolved.unavailable).toContainEqual({
      qualifiedName: "gf_jgj_crm.go_order_sync",
      reason: "TABLE_JSONL_MISS",
    });
    expect(
      resolved.resolved.some(
        (item) =>
          item.qualifiedName.toLowerCase() === "gf_jgj_crm.go_order_sync",
      ),
    ).toBe(false);
  });

  it("keeps an explicit SELECT list on query-projection splice instead of source *", () => {
    const dir = mkdtempSync(join(tmpdir(), "offline-splice-source-proj-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", []),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          qualifiedname: "WIND.TB_OBJECT_3511@gforacle_wande#wande",
          type_name: "gf_rdbms_table",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", [
        {
          qualifiedname: "WIND.TB_OBJECT_3511@gforacle_wande#wande",
          ddl: "CREATE TABLE WIND.TB_OBJECT_3511 (OBJECT_ID NUMBER, S_INFO_WINDCODE VARCHAR2(32), EXTRA_COL VARCHAR2(8))",
        },
      ]),
      horaeDatasource: {
        byServerTag: new Map([
          [
            "oracle_wande",
            {
              serverTag: "oracle_wande",
              serverType: "oracle",
              service: "wande",
            },
          ],
        ]),
      },
    });
    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskCategory: "oracle2hive",
        source: "oracle_wande",
        target: "odata_msg.wfd_w_tb_object_3511",
        sql: {
          query:
            "SELECT OBJECT_ID, S_INFO_WINDCODE FROM WIND.TB_OBJECT_3511",
        },
      }),
      catalog,
    );
    const hive = resolved.resolved.find(
      (item) =>
        item.qualifiedName.toLowerCase() === "odata_msg.wfd_w_tb_object_3511",
    );
    expect(hive?.evidenceProvider).toBe(
      "input-pack:spliced-from-query-projection",
    );
    expect(hive?.ddl).toMatch(/OBJECT_ID/i);
    expect(hive?.ddl).toMatch(/S_INFO_WINDCODE/i);
    expect(hive?.ddl).not.toMatch(/EXTRA_COL/i);
  });

  it("lets later hive CREATE or jsonl beat a spliced-from-source-ddl local pack", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "pack-source-ddl-stale-"));
    writeTableInput(dataRoot, {
      platform: "hive",
      dataSource: "gfhive",
      qualifiedName: "gf_jgj_crm.go_order_sync",
      objectType: "hive_table",
      ddl: "CREATE TABLE gf_jgj_crm.go_order_sync (\n  ORDER_ID STRING,\n  CUST_NO STRING\n)",
      evidenceProvider: "input-pack:spliced-from-source-ddl",
    });
    const dir = mkdtempSync(join(tmpdir(), "offline-source-ddl-override-"));
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(dir, "hive-meta.jsonl", []),
      hiveDdlPath: writeJsonl(dir, "hive-ddl.jsonl", [
        {
          qualifiedname: "gf_jgj_crm.go_order_sync@gfhive",
          querytext:
            "CREATE TABLE gf_jgj_crm.go_order_sync (order_id string, cust_no string, sync_time string)",
        },
      ]),
      rdbmsCorePath: writeJsonl(dir, "rdbms-core.jsonl", [
        {
          qualifiedname: "SRC_GFJGJ.GO_ORDER_SYNC@gforacle_jgjdb1#jgjdb1",
          type_name: "gf_rdbms_table",
        },
      ]),
      rdbmsDdlPath: writeJsonl(dir, "rdbms-ddl.jsonl", [
        {
          qualifiedname: "SRC_GFJGJ.GO_ORDER_SYNC@gforacle_jgjdb1#jgjdb1",
          ddl: "CREATE TABLE SRC_GFJGJ.GO_ORDER_SYNC (ORDER_ID NUMBER, CUST_NO VARCHAR2(32))",
        },
      ]),
      horaeDatasource: {
        byServerTag: new Map([
          [
            "oracle_jgjdb1",
            {
              serverTag: "oracle_jgjdb1",
              serverType: "oracle",
              service: "jgjdb1",
            },
          ],
        ]),
      },
    });
    const resolved = resolveOfflineTables(
      dataRoot,
      task({
        taskId: "14578",
        taskCategory: "oracle2hive",
        source: "oracle_jgjdb1",
        target: "gf_jgj_crm.go_order_sync",
        sql: { query: "select * from src_gfjgj.go_order_sync" },
      }),
      catalog,
    );
    const hive = resolved.resolved.find(
      (item) =>
        item.qualifiedName.toLowerCase() === "gf_jgj_crm.go_order_sync",
    );
    expect(hive?.evidenceProvider).toBe("local:hive-ddl-jsonl");
    expect(hive?.ddl).toContain("sync_time");
  });

  it("splices a postgres2hive Hive target from sole SELECT * plus source pack DDL", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "pack-pg-source-ddl-"));
    writeTableInput(dataRoot, {
      platform: "postgre",
      dataSource: "gfpostgre_risk#risk",
      qualifiedName: "public.offline_prod_share_his",
      objectType: "gf_rdbms_table",
      ddl: "CREATE TABLE public.offline_prod_share_his (prod_id VARCHAR(32), share_qty NUMERIC, busi_date DATE)",
      evidenceProvider: "local:rdbms-core-jsonl,local:rdbms-ddl-jsonl",
    });
    writeTableInput(dataRoot, {
      platform: "hive",
      dataSource: "gfhive",
      qualifiedName: "odata_n_prd.p_offline_prod_share_his",
      objectType: "hive_table",
      ddl: "CREATE TABLE odata_n_prd.p_offline_prod_share_his (other_id STRING, other_name STRING)",
      evidenceProvider: "local:hive-ddl-jsonl",
    });
    const resolved = resolveOfflineTables(
      dataRoot,
      task({
        taskId: "26171",
        taskCategory: "postgre2hive",
        source: "postgres_fxjs_85.234",
        target: "dm_prd.offline_prod_share_his",
        sql: { query: "select * from public.offline_prod_share_his" },
      }),
      emptyCatalog(mkdtempSync(join(tmpdir(), "offline-pg-source-ddl-"))),
    );
    const hive = resolved.resolved.find(
      (item) =>
        item.qualifiedName.toLowerCase() === "dm_prd.offline_prod_share_his",
    );
    expect(hive?.platform).toBe("hive");
    expect(hive?.evidenceProvider).toBe("input-pack:spliced-from-source-ddl");
    expect(hive?.ddl).toMatch(/prod_id/i);
    expect(hive?.ddl).toMatch(/share_qty/i);
    expect(hive?.ddl).toMatch(/busi_date/i);
    expect(hive?.ddl).not.toMatch(/other_id/i);
    expect(hive?.ddl).not.toMatch(/p_offline_prod_share_his/i);
  });

  it("does not splice datasource labels as tables", () => {
    const horaeDatasource = {
      byServerTag: new Map([
        [
          "oracle_rbjygl_85.236",
          {
            serverTag: "oracle_rbjygl_85.236",
            serverType: "oracle",
            service: "jyglrac",
          },
        ],
      ]),
    };
    const names = extractOfflineTableCandidates(
      task({
        taskCategory: "oracle2hive",
        source: "oracle_rbjygl_85.236",
        target: "odata_ygt.nygt_t_coverstockjour",
        sql: {
          query:
            "SELECT COVER_ID FROM HS_OPT.COVERSTOCKJOUR WHERE INIT_DATE = '${YYYY-MM-DD}'",
        },
      }),
      horaeDatasource,
    ).map((item) => item.qualifiedName.toLowerCase());
    expect(names).not.toContain("oracle_rbjygl_85.236");

    const resolved = resolveOfflineTables(
      mkdtempSync(join(tmpdir(), "pack-")),
      task({
        taskCategory: "oracle2hive",
        source: "oracle_rbjygl_85.236",
        target: "odata_ygt.nygt_t_coverstockjour",
        sql: {
          query: "SELECT COVER_ID FROM HS_OPT.COVERSTOCKJOUR",
        },
      }),
      loadOfflineTableCatalog({
        hiveMetadataPath: writeJsonl(
          mkdtempSync(join(tmpdir(), "offline-splice-label-")),
          "hive-meta.jsonl",
          [],
        ),
        hiveDdlPath: writeJsonl(
          mkdtempSync(join(tmpdir(), "offline-splice-label-ddl-")),
          "hive-ddl.jsonl",
          [],
        ),
        rdbmsCorePath: writeJsonl(
          mkdtempSync(join(tmpdir(), "offline-splice-label-core-")),
          "rdbms-core.jsonl",
          [],
        ),
        rdbmsDdlPath: writeJsonl(
          mkdtempSync(join(tmpdir(), "offline-splice-label-rdbms-ddl-")),
          "rdbms-ddl.jsonl",
          [],
        ),
        horaeDatasource,
      }),
    );
    expect(
      resolved.resolved.map((item) => item.qualifiedName.toLowerCase()),
    ).not.toContain("oracle_rbjygl_85.236");
    expect(
      resolved.unavailable.map((item) => item.qualifiedName.toLowerCase()),
    ).not.toContain("oracle_rbjygl_85.236");
  });
});
