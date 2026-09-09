import { describe, expect, it } from "vitest";
import { Schema, SqlSession } from "sqllens";
import { buildPlanFacts } from "../scripts/plans/plan-adapter.ts";
import { applySourceSemantics } from "../scripts/plans/source-semantics.ts";

const schema = new Schema({ "demo.source": { id: "int", sysdate: "timestamp", ts: "timestamp" } });
function analyze(sql: string, family?: "oracle", slot?: string) {
  const original = SqlSession.create(sql, "duckdb", { schema }).doc.statements[0]!;
  const cell = applySourceSemantics(original, family, slot);
  const plan = buildPlanFacts(cell, sql, { schema, dialect: "duckdb", include_expression_dependencies: true });
  const project = plan.relations.find(r => r.id === "root.project");
  if (project?.type !== "project") throw new Error("ROOT_PROJECT_MISSING");
  return { original, cell, plan, project };
}
describe("source SQL system value semantics before lineage", () => {
  it("limits task-family semantics to the source query, preserving target-side SQL fields", () => {
    const sql = "SELECT sysdate AS stamp FROM demo.source";
    expect(analyze(sql, "oracle", "query").project.expressions[0]?.input_columns ?? []).toEqual([]);
    for (const slot of ["pre", "post", "preSql", "postSql"]) {
      const { original, cell, project } = analyze(sql, "oracle", slot);
      expect(cell).toBe(original);
      expect(project.expressions[0]?.input_columns?.flatMap(c => c.physical ?? []))
        .toContainEqual({ table: "demo.source", column: "sysdate" });
    }
  });
  it("models Oracle SYSDATE inside formatting as a zero-input expression, including native hops", () => {
    const sql = "SELECT to_char(SYSDATE, 'YYYY-MM-DD') AS generated_at FROM demo.source";
    const { plan, project } = analyze(sql, "oracle");
    expect(project.expressions[0]?.structured_expression).toEqual({ kind: "FUNCTION", name: "to_char",
      args: [{ kind: "FUNCTION", name: "SYSDATE", args: [] }, { kind: "LITERAL", text: "'YYYY-MM-DD'" }] });
    expect(project.expressions[0]?.input_columns ?? []).toEqual([]);
    expect(project.expressions[0]?.expr_text).toBe("to_char(SYSDATE, 'YYYY-MM-DD') AS generated_at");
    expect(plan.lineage_hops?.nodes.flatMap(n => n.terminal_fields)).toEqual([]);
  });
  it("keeps a real same-named field outside the Oracle source family", () => {
    const { original, cell, project } = analyze("SELECT sysdate AS stamp FROM demo.source");
    expect(cell).toBe(original);
    expect(project.expressions[0]?.input_columns?.flatMap(c => c.physical ?? []))
      .toContainEqual({ table: "demo.source", column: "sysdate" });
  });
  it("preserves qualified and quoted fields while normalizing only bare Oracle system values", () => {
    const { project } = analyze('SELECT SYSDATE AS clock, s.sysdate AS actual, "sysdate" AS quoted FROM demo.source s', "oracle");
    expect(project.expressions[0]?.input_columns ?? []).toEqual([]);
    for (const e of project.expressions.slice(1)) expect(e.input_columns?.flatMap(c => c.physical ?? []))
      .toContainEqual({ table: "demo.source", column: "sysdate" });
  });
  it("normalizes nested CTE values before native origins can flatten them into a field", () => {
    const { plan, project } = analyze("WITH q AS (SELECT SYSDATE AS generated_at FROM demo.source) SELECT q.generated_at FROM q", "oracle");
    expect(project.expressions[0]?.input_columns?.flatMap(c => c.physical ?? []) ?? []).toEqual([]);
    expect(plan.lineage_hops?.nodes.flatMap(n => n.terminal_fields)).toEqual([]);
  });
  it("keeps system values out of filter field inputs and preserves actual control fields", () => {
    const { plan } = analyze("SELECT id FROM demo.source WHERE ts < SYSDATE", "oracle");
    const filter = plan.relations.find(r => r.type === "filter");
    if (filter?.type !== "filter") throw new Error("FILTER_MISSING");
    expect(filter.predicate_columns.flatMap(c => c.physical ?? []).map(c => c.column)).toEqual(["ts"]);
    expect(filter.predicate_expr).toBe("ts < SYSDATE");
  });
  it("does not mutate the parsed input or lose the original source span", () => {
    const sql = "SELECT SYSDATE AS clock FROM demo.source";
    const { original, cell, project } = analyze(sql, "oracle");
    expect(original.scopes.root.body.kind).toBe("select");
    if (original.scopes.root.body.kind !== "select" || cell.scopes.root.body.kind !== "select") throw new Error("SELECT_REQUIRED");
    expect(original.scopes.root.body.projections[0]?.expr.kind).toBe("column");
    expect(cell.scopes.root.body.projections[0]?.expr.kind).toBe("function");
    const e = project.expressions[0]!;
    expect(sql.slice(e.span.start, e.span.end)).toBe(e.expr_text);
  });
});
