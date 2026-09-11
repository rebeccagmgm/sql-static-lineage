import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { SchemaAnnotationResolver } from "../src/asset-graph/schema-annotation.ts";

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "schema-annotation-"));
  mkdirSync(root, { recursive: true });
  const path = join(root, "datasource-catalog.sqlite");
  const database = new DatabaseSync(path);
  database.exec(`
    CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO meta(key, value) VALUES ('schema_version', '1.0.0');
    CREATE TABLE schema_annotation(
      platform TEXT NOT NULL,
      platform_norm TEXT NOT NULL,
      data_source TEXT NOT NULL,
      data_source_norm TEXT NOT NULL,
      schema_name TEXT NOT NULL,
      schema_name_norm TEXT NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT NOT NULL,
      PRIMARY KEY(platform_norm, data_source_norm, schema_name_norm)
    );
    INSERT INTO schema_annotation VALUES(
      'oracle', 'oracle', 'warehouse-a', 'warehouse-a', 'titans_dm', 'titans_dm',
      'TITANS 业务库', 'TITANS 相关业务数据'
    );
  `);
  database.close();
  return path;
}

describe("SchemaAnnotationResolver", () => {
  it("returns only the display name and description for an exact physical identity", () => {
    const resolver = new SchemaAnnotationResolver(fixture());

    expect(
      resolver.resolve({
        platform: "ORACLE",
        dataSource: "WAREHOUSE-A",
        qualifiedName: "TITANS_DM.CAPITAL_ACCT_DAILY_BALANCE",
      }),
    ).toEqual({
      displayName: "TITANS 业务库",
      description: "TITANS 相关业务数据",
    });
    resolver.close();
  });

  it("does not reuse an annotation for the same schema on another datasource", () => {
    const resolver = new SchemaAnnotationResolver(fixture());

    expect(
      resolver.resolve({
        platform: "oracle",
        dataSource: "warehouse-b",
        qualifiedName: "titans_dm.capital_acct_daily_balance",
      }),
    ).toBeUndefined();
    resolver.close();
  });
});
