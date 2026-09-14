import { Schema, SqlSession } from "sqllens";
import { describe, expect, it } from "vitest";

import { buildPlanFacts } from "../../../scripts/plans/plan-adapter.ts";
import { classifyExpressionInputRoles } from "../../../scripts/project-graph/task-local/field-expression-dependencies.ts";
import { isConstantExpression } from "../../../scripts/project-graph/task-local/field-evidence/field-evidence-emission.ts";

function classify(sqlExpression: string) {
  const sql = `SELECT ${sqlExpression} AS result FROM demo.source s`;
  const schema = new Schema({ "demo.source": { a: "string", b: "string", c: "string" } });
  const session = SqlSession.create(sql, "databricks", { schema });
  const plan = buildPlanFacts(session.doc.statements[0]!, sql, {
    dialect: "databricks", schema, include_expression_dependencies: true,
  });
  const root = plan.relations.find((relation) => relation.id === plan.roots[0]);
  const expressions = root?.type === "project" ? root.expressions : root?.type === "aggregate" ? root.measures : [];
  if (!expressions[0]) throw new Error("output expression required");
  return classifyExpressionInputRoles(expressions[0] as unknown as Record<string, unknown>);
}

function columns(inputs: readonly Record<string, unknown>[]) {
  return inputs.map((input) => String(input.column)).sort();
}

describe("expression role composition", () => {
  it("keeps nested COALESCE in a CASE selector conditional", () => {
    const roles = classify("CASE WHEN COALESCE(s.a, '') <> '' THEN 'I' ELSE 'S' END");
    expect(columns(roles.valueInputs)).toEqual([]);
    expect(columns(roles.conditionalInputs)).toEqual(["a"]);
    expect(roles.complete).toBe(true);
  });

  it("does not re-add a nested selector through its parent result summary", () => {
    const roles = classify("CASE WHEN s.a='1' THEN CASE WHEN s.b='2' THEN s.c ELSE 'x' END ELSE s.a END");
    expect(columns(roles.valueInputs)).toEqual(["a", "c"]);
    expect(columns(roles.conditionalInputs)).toEqual(["a", "b"]);
  });

  it("keeps IS NOT NULL selectors and IF selectors", () => {
    for (const expression of [
      "CASE WHEN s.a IS NOT NULL THEN s.b ELSE s.c END",
      "IF(s.a IS NOT NULL, s.b, s.c)",
    ]) {
      const roles = classify(expression);
      expect(columns(roles.valueInputs)).toEqual(["b", "c"]);
      expect(columns(roles.conditionalInputs)).toEqual(["a"]);
    }
  });

  it("preserves value and selection roles of non-final COALESCE operands", () => {
    const roles = classify("COALESCE(s.a, s.b)");
    expect(columns(roles.valueInputs)).toEqual(["a", "b"]);
    expect(columns(roles.conditionalInputs)).toEqual(["a"]);
  });

  it("distinguishes terminal values, rowset derivation and unknown inputs", () => {
    expect(classify("'x'").terminalKind).toBe("LITERAL");
    expect(classify("current_timestamp()").terminalKind).toBe("SYSTEM_VALUE");
    expect(classify("count(*)").terminalKind).toBe("ROWSET_DERIVED");
    const unknown = {
      expression_text: "missing_column", input_fields: [],
      input_dependency_status: "UNRESOLVED", unresolved_input_columns: [{ name: "missing_column" }],
    };
    expect(classifyExpressionInputRoles(unknown).terminalKind).toBe("UNKNOWN");
    expect(classifyExpressionInputRoles(unknown).complete).toBe(false);
    expect(isConstantExpression(unknown)).toBe(false);
    for (const status of ["NO_PHYSICAL_INPUT", "DERIVED_OUTPUT"]) {
      expect(classifyExpressionInputRoles({ input_fields: [], input_dependency_status: status }).terminalKind).toBe("UNKNOWN");
    }
    expect(classify("mystery()").terminalKind).toBe("UNKNOWN");
    expect(classify("1 + 2").terminalKind).toBe("DERIVED_VALUE");
  });
});
