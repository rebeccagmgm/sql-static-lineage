import { mkdtempSync, writeFileSync } from "node:fs";
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
    expect(resolved.resolved[0]?.guid).toBe("meta-guid");
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
});
