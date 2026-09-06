import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  collectCreateTableLikeSources,
  isCreateTableLikeOnly,
  qualifyCreateTableLikeSource,
  tableHasProvableColumns,
} from "../scripts/input/shared/create-table-like-chain.ts";
import { repairCreateTableLikeSources } from "../scripts/input/mainline/repair-create-table-like-sources.ts";
import { loadOfflineTableCatalog } from "../scripts/input/shared/offline-table-resolver.ts";
import { writeTableInput } from "../scripts/input/shared/input-pack.ts";

function writeJsonl(dir: string, name: string, lines: readonly unknown[]): string {
  const path = join(dir, name);
  writeFileSync(
    path,
    `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
    "utf8",
  );
  return path;
}

describe("create table like chain", () => {
  it("qualifies bare LIKE sources against the target schema", () => {
    expect(
      qualifyCreateTableLikeSource("dm_crd_n.wt_x", "d_acct_p"),
    ).toBe("dm_crd_n.d_acct_p");
    expect(
      qualifyCreateTableLikeSource("dm_crd_n.wt_x", "dm_crd_test.wt_x"),
    ).toBe("dm_crd_test.wt_x");
  });

  it("detects column-less LIKE DDL", () => {
    expect(
      isCreateTableLikeOnly("CREATE TABLE dm_crd_n.wt_x LIKE dm_crd_test.wt_x"),
    ).toBe(true);
    expect(
      tableHasProvableColumns(
        "CREATE TABLE dm_crd_n.wt_x (id BIGINT) STORED AS ORC",
      ),
    ).toBe(true);
  });

  it("collects LIKE sources from leaf to parent", () => {
    const ddls = new Map<string, string>([
      [
        "dm_index_n.target",
        "CREATE TABLE dm_index_n.target LIKE dm_index_n.stage",
      ],
      [
        "dm_index_n.stage",
        "CREATE TABLE dm_index_n.stage LIKE dm_index_n.base",
      ],
      ["dm_index_n.base", "CREATE TABLE dm_index_n.base (id BIGINT)"],
    ]);
    const chain = collectCreateTableLikeSources("dm_index_n.target", (name) =>
      ddls.get(name.toLowerCase()),
    );
    expect(chain.sources).toEqual(["dm_index_n.base", "dm_index_n.stage"]);
    expect(chain.stoppedReason).toBeUndefined();
  });

  it("stops on cycles and depth limits", () => {
    const ddls = new Map<string, string>([
      ["a.one", "CREATE TABLE a.one LIKE a.two"],
      ["a.two", "CREATE TABLE a.two LIKE a.one"],
    ]);
    const cycle = collectCreateTableLikeSources("a.one", (name) => ddls.get(name));
    expect(cycle.sources).toEqual(["a.two"]);
    expect(cycle.stoppedReason).toBe("CYCLE");

    const depthDdls = new Map<string, string>([
      ["t1", "CREATE TABLE t1 LIKE t2"],
      ["t2", "CREATE TABLE t2 LIKE t3"],
      ["t3", "CREATE TABLE t3 LIKE t4"],
      ["t4", "CREATE TABLE t4 (id BIGINT)"],
    ]);
    const depth = collectCreateTableLikeSources(
      "t0",
      (name) => depthDdls.get(name),
      2,
    );
    expect(depth.sources).toEqual(["t1", "t2"]);
    expect(depth.stoppedReason).toBe("MAX_DEPTH");
  });
});

describe("repair create table like sources", () => {
  it("writes missing LIKE source table packs from local hive ddl jsonl", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "like-repair-data-"));
    const cacheRoot = mkdtempSync(join(tmpdir(), "like-repair-cache-"));
    const jsonlDir = mkdtempSync(join(tmpdir(), "like-repair-jsonl-"));
    const hiveDdlPath = writeJsonl(jsonlDir, "hive-ddl.jsonl", [
      {
        qualifiedname: "dm_index_n.base_table",
        querytext: "CREATE TABLE dm_index_n.base_table (id BIGINT) STORED AS ORC",
      },
    ]);
    const catalog = loadOfflineTableCatalog({
      hiveMetadataPath: writeJsonl(jsonlDir, "hive-meta.jsonl", []),
      hiveDdlPath,
      rdbmsCorePath: writeJsonl(jsonlDir, "rdbms-core.jsonl", []),
      rdbmsDdlPath: writeJsonl(jsonlDir, "rdbms-ddl.jsonl", []),
      horaeDatasource: null,
    });

    writeTableInput(dataRoot, {
      platform: "hive",
      dataSource: "gfhive",
      qualifiedName: "dm_index_n.target_table",
      schema: "dm_index_n",
      name: "target_table",
      objectType: "hive_table",
      partitionFields: [],
      ddl: "CREATE TABLE dm_index_n.target_table LIKE dm_index_n.base_table",
      evidenceProvider: "local:hive-ddl-jsonl",
    });

    const taskDir = join(dataRoot, "tasks", "sparkIndex", "1001");
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(
      join(taskDir, "task.json"),
      JSON.stringify(
        {
          taskId: "1001",
          taskCategory: "sparkIndex",
          target: "dm_index_n.target_table",
          sqlFiles: [],
        },
        null,
        2,
      ),
      "utf8",
    );

    const summary = repairCreateTableLikeSources({
      dataRoot,
      cacheRoot,
      catalog,
      manifestPath: join(dataRoot, "manifest.jsonl"),
    });

    expect(summary.likeTargets).toBe(1);
    expect(summary.sourcesResolvedLocal).toBe(1);
    expect(summary.affectedTaskIds).toEqual(["1001"]);
    const basePack = join(
      dataRoot,
      "tables",
      "hive",
      "dm_index_n.base_table__gfhive",
      "table.json",
    );
    expect(existsSync(basePack)).toBe(true);
    const ddl = readFileSync(join(dirname(basePack), "ddl.sql"), "utf8");
    expect(tableHasProvableColumns(ddl)).toBe(true);
  });
});
