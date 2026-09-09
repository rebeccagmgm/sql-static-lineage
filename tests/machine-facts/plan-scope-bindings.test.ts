import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Schema, SqlSession } from "sqllens";
import { buildPlanFacts } from "../../scripts/plans/plan-adapter.ts";
import { globalizePlanScopeBindings } from "../../scripts/machine-facts/plan-scope-bindings.ts";
import { runTask } from "../../scripts/machine-facts/machine-facts.ts";
import {
  canonicalJson,
  sha256,
} from "../../scripts/machine-facts/machine-facts-contract.ts";
import { readJsonlRecords } from "../../scripts/machine-facts/jsonl-store.ts";

const sql =
  "WITH q AS (SELECT id FROM demo.source) SELECT a.id FROM (SELECT id FROM q) a JOIN (SELECT id FROM q) b ON a.id=b.id";
function plan() {
  const schema = new Schema({ "demo.source": { id: "int" } });
  const cell = SqlSession.create(sql, "databricks", { schema }).doc
    .statements[0]!;
  return buildPlanFacts(cell, sql, {
    dialect: "databricks",
    schema,
    include_expression_dependencies: true,
  });
}
describe("Machine Facts scope binding preservation", () => {
  it("globalizes already-resolved CTE and derived mappings without changing scope or alias", () => {
    const p = plan(),
      before = JSON.stringify(p.scope_bindings);
    const result = globalizePlanScopeBindings(p, "t", 2);
    const bs = [...result.bindingsByRelationId.values()].flat();
    expect(result.issues).toEqual([]);
    expect(bs).toHaveLength(4);
    expect(bs.find((b) => b.binding === "a")).toMatchObject({
      scope_id: "root",
      target_scope_id: "root.a",
      relation_id: "task:t:statement:2:relation:root.a.project",
      target_relation_id: "task:t:statement:2:relation:root.a.project",
    });
    expect(
      bs
        .filter((b) => b.source_kind === "cte")
        .map((b) => b.target_relation_id),
    ).toEqual([
      "task:t:statement:2:relation:root.(child).project",
      "task:t:statement:2:relation:root.(child).project",
    ]);
    expect(JSON.stringify(p.scope_bindings)).toBe(before);
  });
  it("retains local unresolved issues without failing the whole task", () => {
    for (const mode of ["owner", "target", "scope", "cte", "alias"]) {
      const p = plan(),
        b = p.scope_bindings![0]!;
      if (mode === "owner") b.relation_id = "missing";
      if (mode === "target")
        b.target_relation_id = "task:other:statement:0:relation:root.project";
      if (mode === "scope") b.target_scope_id = "root.wrong";
      if (mode === "cte") {
        b.target_relation_id = "root.a.project";
        b.target_scope_id = "root.a";
      }
      if (mode === "alias") b.binding = "wrong_alias";
      const result = globalizePlanScopeBindings(p, "t", 0);
      expect(
        result.issues.some((issue) =>
          issue.reasonCode.startsWith("SCOPE_BINDING_"),
        ),
      ).toBe(true);
    }
  });
  it("retains null targets and duplicate candidates so consumers cannot silently select one", () => {
    const p = plan(),
      b = p.scope_bindings![0]!;
    b.target_relation_id = null;
    b.target_scope_id = null;
    p.scope_bindings!.push({ ...b });
    const result = globalizePlanScopeBindings(p, "t", 0);
    expect(result.bindingsByRelationId.get(b.relation_id)).toHaveLength(2);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        reasonCode: "SCOPE_BINDING_DUPLICATE",
      }),
    );
  });
  it("writes the mappings into serialized Facts using actual SQL, with same-task statement IDs", () => {
    const root = mkdtempSync(join(tmpdir(), "facts-binding-proof-"));
    const sqlFile = join(root, "query.sql");
    writeFileSync(sqlFile, sql);
    const schema = {
      records: [
        {
          qualified_name: "demo.source",
          status: "SUCCESS",
          columns: [{ name: "id" }],
        },
      ],
    };
    const task = { task_id: "binding-proof", sql_snapshot: sqlFile };
    const run = runTask(
      task,
      { schema_version: "test", dialect: "databricks", tasks: [task] },
      "test",
      root,
      schema,
      sha256(canonicalJson(schema)),
    );
    expect(run.state).toBe("SUCCESS");
    const nodes = readJsonlRecords(
      join(root, "registry/tasks/binding-proof/bundle/relation-nodes.jsonl"),
    ) as any[];
    const ids = new Set(nodes.map((r) => r.relation_id));
    const bs = nodes.flatMap((r) => r.relation.scope_bindings ?? []);
    expect(bs).toHaveLength(4);
    for (const b of bs) {
      expect(ids.has(b.relation_id)).toBe(true);
      expect(ids.has(b.target_relation_id)).toBe(true);
    }
    expect(
      nodes.every((r) => Object.hasOwn(r.relation, "scope_bindings")),
    ).toBe(true);
  });
});
