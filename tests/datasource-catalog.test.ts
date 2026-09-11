import { importDatasourceAliases, parseDatasourceAliases } from "../scripts/datasource-catalog/aliases.ts";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import {
  buildDatasourceCatalog,
  catalogStatus,
  queryDatasourceRecords,
  queryDatasourceAliases,
  querySchemaMatches,
  querySchemas,
} from "../scripts/datasource-catalog/catalog.ts";

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(path: string, rows: readonly unknown[]): string {
  const text = `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  writeFileSync(path, text, "utf8");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function fixture(): {
  readonly root: string;
  readonly horaeDir: string;
  readonly szdataDir: string;
  readonly databasePath: string;
  readonly annotationsPath: string;
} {
  const root = mkdtempSync(join(tmpdir(), "datasource-catalog-"));
  const horaeDir = join(root, "horae-datasource");
  const szdataDir = join(root, "szdata-datasource");
  mkdirSync(horaeDir);
  mkdirSync(szdataDir);

  const horaeRows = [
    {
      keyword: "shared",
      server_tag: "shared",
      server_type: "postgre",
      service: "service-a",
      cmdb_name: "System A",
      host: "host-a",
      port: 1001,
      connectable: true,
    },
    {
      keyword: "horae-composite",
      server_tag: "horae-composite",
      server_type: "mysql",
      service: "service-b",
      cmdb_name: "System B",
      host: "host-b",
      port: 1002,
      connectable: true,
    },
    {
      keyword: "horae-system-service",
      server_tag: "horae-system-service",
      server_type: "oracle",
      service: "service-c",
      cmdb_name: "System C",
      host: "old-host",
      port: 1003,
      connectable: false,
    },
    {
      keyword: "horae-only",
      server_tag: "horae-only",
      server_type: "http",
      service: "service-d",
      cmdb_name: "System D",
      host: "host-d",
      port: 1004,
      connectable: true,
    },
  ];
  writeJsonl(join(horaeDir, "rows.jsonl"), horaeRows);
  writeJson(join(horaeDir, "snapshot.json"), {
    schema_version: "1.0.0",
    artifact_type: "HORAE_DATASOURCE_EVIDENCE",
    observed_at: "2026-09-02T09:49:05.186Z",
    total: horaeRows.length,
    row_count: horaeRows.length,
    content_sha256: "a".repeat(64),
    rows: horaeRows,
  });

  const szdataRows = [
    {
      id: "sz-1",
      sourceIdentifier: "shared",
      cmdbSystemName: "System A renamed",
      dbType: "PostgreSQL",
      host: "host-a",
      port: 1001,
      dbServiceName: "service-a",
      schemasJson: JSON.stringify([
        { id: "schema-1", name: "public", shortName: "p", remark: "main" },
      ]),
      accessPointsJson: JSON.stringify([
        {
          id: "access-1",
          accessTag: "direct",
          identifier: "shared",
          nickname: "primary",
          host: "host-a",
          port: 1001,
        },
      ]),
      attributesJson: JSON.stringify({ status: { connectable: true } }),
    },
    {
      id: "sz-2",
      sourceIdentifier: "sz-composite",
      cmdbSystemName: "System B",
      dbType: "MySQL",
      host: "host-b",
      port: 1002,
      dbServiceName: "service-b",
      schemasJson: JSON.stringify([
        { id: "schema-2", name: "trade", shortName: "t", remark: null },
      ]),
      accessPointsJson: "[]",
      attributesJson: "{}",
    },
    {
      id: "sz-3",
      sourceIdentifier: "sz-system-service",
      cmdbSystemName: "System C",
      dbType: "Oracle",
      host: "new-host",
      port: 9999,
      dbServiceName: "service-c",
      schemasJson: "[]",
      accessPointsJson: "[]",
      attributesJson: "{}",
    },
    {
      id: "sz-4",
      sourceIdentifier: "sz-only",
      cmdbSystemName: "System Z",
      dbType: "MySQL",
      host: "host-z",
      port: 1005,
      dbServiceName: "service-z",
      schemasJson: "[]",
      accessPointsJson: "[]",
      attributesJson: "{}",
    },
  ];
  const rowsSha256 = writeJsonl(join(szdataDir, "rows.jsonl"), szdataRows);
  writeJson(join(szdataDir, "manifest.json"), {
    schemaVersion: "1.0.0",
    artifactType: "SZDATA_DATASOURCE_EVIDENCE",
    observedAt: "2026-09-02T12:14:52.138Z",
    total: 5,
    fetchedRowCount: 4,
    rowCount: 4,
    coverageGap: 1,
    failureCount: 1,
    duplicateGroupCount: 0,
    complete: false,
    hashes: { rowsSha256 },
  });
  const annotationsPath = join(root, "schema-annotations.json");
  writeJson(annotationsPath, {
    schemaVersion: "1.0.0",
    annotations: [
      {
        platform: "oracle",
        dataSource: "warehouse-a",
        schemaName: "public",
        displayName: "业务公共区",
        description: "公共业务数据",
      },
    ],
  });

  return {
    root,
    horaeDir,
    szdataDir,
    databasePath: join(root, "output", "datasource-catalog.sqlite"),
    annotationsPath,
  };
}

describe("datasource catalog", () => {
  it("keeps source records separate and records evidence-bounded matches", () => {
    const input = fixture();
    const beforeHorae = readFileSync(
      join(input.horaeDir, "rows.jsonl"),
      "utf8",
    );
    const beforeSzdata = readFileSync(
      join(input.szdataDir, "rows.jsonl"),
      "utf8",
    );

    const result = buildDatasourceCatalog(input);

    expect(result).toMatchObject({
      records: { horae: 4, szdata: 4 },
      matches: { confirmed: 1, candidates: 2, total: 3 },
      schemas: 2,
      accessPoints: 1,
      annotations: 1,
      unresolved: { horae: 1, szdata: 1 },
    });
    expect(readFileSync(join(input.horaeDir, "rows.jsonl"), "utf8")).toBe(
      beforeHorae,
    );
    expect(readFileSync(join(input.szdataDir, "rows.jsonl"), "utf8")).toBe(
      beforeSzdata,
    );

    const database = new DatabaseSync(input.databasePath, { readOnly: true });
    expect(
      database
        .prepare(
          "SELECT match_method AS method, match_status AS status FROM datasource_match ORDER BY match_rank",
        )
        .all(),
    ).toEqual([
      { method: "EXACT_IDENTIFIER", status: "CONFIRMED" },
      { method: "HOST_PORT_TYPE_SERVICE", status: "CANDIDATE" },
      { method: "SYSTEM_SERVICE_TYPE", status: "CANDIDATE" },
    ]);
    expect(
      database
        .prepare(
          "SELECT agreement_cmdb AS cmdbAgreement FROM datasource_match WHERE match_method = 'EXACT_IDENTIFIER'",
        )
        .get(),
    ).toEqual({ cmdbAgreement: 0 });
    expect(
      database.prepare("SELECT * FROM schema_annotation").get(),
    ).toMatchObject({
      platform: "oracle",
      data_source: "warehouse-a",
      schema_name: "public",
      display_name: "业务公共区",
      description: "公共业务数据",
    });
    database.close();
  });

  it("surfaces incomplete snapshots and provides bounded datasource/schema queries", () => {
    const input = fixture();
    buildDatasourceCatalog(input);
    const database = new DatabaseSync(input.databasePath, { readOnly: true });

    expect(catalogStatus(database)).toMatchObject({
      ready: true,
      snapshots: {
        horae: { complete: true, rowCount: 4 },
        szdata: {
          complete: false,
          rowCount: 4,
          coverageGap: 1,
          failureCount: 1,
        },
      },
    });
    expect(
      queryDatasourceRecords(database, { schema: "public", limit: 10 }),
    ).toMatchObject({
      total: 2,
      limit: 10,
      offset: 0,
      nextOffset: null,
    });
    expect(querySchemas(database, { q: "tra", limit: 1 })).toMatchObject({
      total: 1,
      items: [{ schemaName: "trade", sourceIdentifier: "sz-composite" }],
    });
    expect(
      querySchemaMatches(database, { name: "public", limit: 10 }),
    ).toMatchObject({
      total: 1,
      items: [
        {
          schemaName: "public",
          szdataIdentifier: "shared",
          horaeIdentifier: "shared",
          matchStatus: "CONFIRMED",
          matchMethod: "EXACT_IDENTIFIER",
        },
      ],
    });
    database.close();
  });

  it("fails closed when nested schema evidence is malformed", () => {
    const input = fixture();
    const rowsPath = join(input.szdataDir, "rows.jsonl");
    const rows = readFileSync(rowsPath, "utf8")
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    rows[0]!.schemasJson = "not-json";
    const rowsSha256 = writeJsonl(rowsPath, rows);
    const manifestPath = join(input.szdataDir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
      string,
      unknown
    >;
    manifest.hashes = { rowsSha256 };
    writeJson(manifestPath, manifest);

    expect(() => buildDatasourceCatalog(input)).toThrow(
      "INVALID_NESTED_JSON:schemasJson:szdata:sz-1",
    );
  });

  it("imports and preserves file aliases across rebuilds without merging platform identities", () => {
    const input = fixture();
    buildDatasourceCatalog(input);
    const source = join(input.root, "aliases.txt");
    const header = "\t数据源标识\t数据源类型\t数据源别名\t域名或IP\t端口\t服务名\t数据源用户名\tDBA\t需求者\tCMDB\n";
    const text = header + [
      ["shared","postgre","已有中文别名","host-a","1001","service-a","","","",""],
      ["new-file","mysql","新增中文别名","host-new","1002","service-new","","","",""],
      ["no-alias","http","","","","","","","",""],
    ].map(c=>c.join("\t")).join("\n") + "\n显示第1至3项结果，共3项";
    writeFileSync(source, text);
    expect(importDatasourceAliases(source,input.databasePath)).toMatchObject({
      importedRows:3,changed:3,coverage:{totalRecords:3,matchedRecords:1,withAlias:2},
    });
    expect(importDatasourceAliases(source,input.databasePath)).toMatchObject({changed:0});
    const verify = () => {
      const database = new DatabaseSync(input.databasePath,{readOnly:true});
      try {
        expect(queryDatasourceRecords(database,{identifier:"shared"})).toMatchObject({
          total:2,items:[
            {sourceSystem:"HORAE",alias:"已有中文别名"},
            {sourceSystem:"SZDATA",alias:null},
          ],
        });
        expect(queryDatasourceRecords(database,{q:"已有中文别名"})).toMatchObject({total:1});
        expect(queryDatasourceAliases(database,{q:"新增中文别名",limit:1})).toMatchObject({
          total:1,items:[{identifier:"new-file",alias:"新增中文别名",catalogStatus:"NOT_IN_CATALOG",recordSource:"FILE_SUPPLEMENT"}],
        });
        expect(queryDatasourceAliases(database,{limit:2})).toMatchObject({total:3,nextOffset:2});
        expect(database.prepare("SELECT count(*) n FROM datasource_record").get()).toEqual({n:8});
      } finally {database.close();}
    };
    verify();
    buildDatasourceCatalog(input);
    verify();
    writeFileSync(source,text.replace("共3项","共4项"));
    expect(()=>importDatasourceAliases(source,input.databasePath)).toThrow("ROW_COUNT_MISMATCH");
    verify();
    expect(()=>parseDatasourceAliases(text.replace("new-file","shared"))).toThrow("DUPLICATE");
    expect(()=>parseDatasourceAliases(header+"malformed\trow\n共1项")).toThrow("INVALID");
  });
});
