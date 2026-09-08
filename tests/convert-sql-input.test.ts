import { describe, expect, it } from "vitest";
import { convertSqlInput } from "../scripts/input/convert-sql-input.ts";

describe("standalone SQL conversion", () => {
  it("retains configuration, comments and semicolons in strings", () => {
    const sql = "-- header;\nSET hive.exec.dynamic.partition=true; SELECT 'a;b' AS value;";
    const result = convertSqlInput(sql, "databricks");
    expect(result.statements.map(s => s.role)).toEqual(["CONFIGURATION", "QUERY_OR_WRITE"]);
    expect(result.sourceSql).toBe(sql);
    expect(result.convertedSql).toBe(sql);
    expect(result.boundaryPreserved).toBe(true);
  });
  it("maps exact parameters once and retains original locations", () => {
    const sql = "SELECT '${date}' FROM ${db}.t;";
    const params = { "${date}": "2026-09-07", "${db}": "demo" };
    const result = convertSqlInput(sql, "databricks", params);
    expect(result.convertedSql).toBe("SELECT '2026-09-07' FROM demo.t;");
    expect(result.boundaryPreserved).toBe(true);
    expect(result.replacements.every(r => sql.slice(r.start, r.end) === r.token)).toBe(true);
    expect(convertSqlInput(sql, "databricks", params)).toEqual(result);
  });
  it("retains missing mappings and blocks statement injection", () => {
    expect(convertSqlInput("SELECT '${date}';", "databricks").gaps).toContain("SYMBOLIC_PARAMETERS_RETAINED");
    expect(convertSqlInput("SELECT ${x};", "databricks", { "${x}": "1; SELECT 2" }).gaps).toContain("PARAMETER_CHANGED_STATEMENT_BOUNDARIES");
  });
  it("preserves temporary table lifecycle and rejects unknown wrappers", () => {
    const result = convertSqlInput("CREATE TABLE t AS SELECT 1 AS a; SELECT * FROM t; DROP TABLE t;", "databricks");
    expect(result.statements.map(s => s.role)).toEqual(["DDL", "QUERY_OR_WRITE", "DDL"]);
    expect(convertSqlInput("echo hello;", "databricks").status).toBe("PARTIAL");
  });
});
