import { describe, expect, it } from "vitest";
import { adaptHiveCompatSql } from "../../scripts/calcite-semantic-provider/dialect-adapter.ts";

describe("bounded Hive compatibility adapter", () => {
  it("quotes only registered reserved identifiers in alias/member positions", () => {
    const sql = "SELECT x AS CONDITION, t.CONDITION, 'AS CONDITION', t.OPERATOR FROM demo t -- CONDITION\n";
    const result = adaptHiveCompatSql(sql);
    expect(result.sql).toBe("SELECT x AS `CONDITION`, t.`CONDITION`, 'AS CONDITION', t.`OPERATOR` FROM demo t -- CONDITION\n");
    expect(result.transforms).toHaveLength(3);
    for (const transform of result.transforms) {
      expect(result.sql.slice(transform.afterSpan.start, transform.afterSpan.end)).toBe(`\`${transform.identifier}\``);
      expect(sql.slice(transform.beforeSpan.start, transform.beforeSpan.end)).toBe(transform.identifier);
    }
  });

  it("is deterministic and does not transform strings/comments", () => {
    const sql = "SELECT 'CONDITION', col FROM t /* t.OPERATOR */";
    const first = adaptHiveCompatSql(sql);
    expect(first.status).toBe("UNCHANGED");
    expect(adaptHiveCompatSql(sql)).toEqual(first);
  });
});
