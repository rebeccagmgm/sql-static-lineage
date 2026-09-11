import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  expressionValueOrigin,
  evidenceOrigins,
  PublishedFieldOrigins,
} from "../src/asset-graph/field-value-origin.ts";
import type { Evidence } from "../src/asset-graph/evidence-json.ts";

const expression = (value: string) => ({
  expression_id: "expr",
  input_dependency_status: "NO_PHYSICAL_INPUT",
  input_fields: [],
  candidate_input_fields: [],
  unresolved_input_columns: [],
  expression_text: value + " AS result",
  display_text: value + " AS result",
  output_name: "result",
});
describe("field value origin", () => {
  it("resolves short self-read names by occurrence and rejects ambiguous identities", () => {
    const e = {
      bindings: [{ binding_status: "RESOLVED", write_observation_id: "w", target_dataset: "db.target", target_field: "amount", expression_id: "expr" }],
      expressions: [{ ...expression("amount"), relation_id: "p", statement_id: "s", input_dependency_status: "PHYSICAL", input_fields: [{ table: "target", column: "amount" }] }],
      relations: [{relation_id:"p",relation:{type:"project",source:"r"}}, {relation_id:"r",relation:{type:"read",table:"target",read_occurrence_id:"read"}}],
      datasetIo: [{direction:"READ",resolution_status:"RESOLVED",statement_id:"s",physical_dataset:"db.target",read_occurrences:[{occurrence_id:"read"}]}],
    } as unknown as Evidence;
    expect(evidenceOrigins(e).get('["w","amount"]')?.label).toBe("沿用本表原值");
    e.relations[0]!.relation = {type:"project",source:"inner"};
    e.relations.push({relation_id:"inner",relation:{type:"project",source:"r"}});
    e.expressions.push({...e.expressions[0],expression_id:"inner-expr",relation_id:"inner",output_name:"amount",display_text:"amount + 1"});
    expect(evidenceOrigins(e).has('["w","amount"]')).toBe(false);
    e.relations[0]!.relation = {type:"project",source:"r"};
    e.datasetIo.push({...e.datasetIo[0],physical_dataset:"other.target"});
    expect(evidenceOrigins(e).has('["w","amount"]')).toBe(false);
  });
  it("recognizes only unchanged same-table same-column inputs as retained values", () => {
    const e = {
      bindings: [{ binding_status: "RESOLVED", write_observation_id: "w", target_dataset: "db.target", target_field: "amount", expression_id: "expr" }],
      expressions: [{ ...expression("a.amount"), relation_id:"p",statement_id:"s", input_dependency_status: "PHYSICAL", input_fields: [{ table: "db.target", column: "amount" }] }],
      relations: [{relation_id:"p",relation:{type:"project",source:"r"}}, {relation_id:"r",relation:{type:"read",table:"db.target",read_occurrence_id:"read"}}],
      datasetIo: [{direction:"READ",resolution_status:"RESOLVED",statement_id:"s",physical_dataset:"db.target",read_occurrences:[{occurrence_id:"read"}]}],
    } as unknown as Evidence;
    expect(evidenceOrigins(e).get('["w","amount"]')?.label).toBe("沿用本表原值");
    e.expressions[0]!.display_text = "a.amount + 1";
    expect(evidenceOrigins(e).has('["w","amount"]')).toBe(false);
    e.expressions[0]!.display_text = "a.amount";
    e.bindings[0]!.target_field = "other";
    expect(evidenceOrigins(e).has('["w","other"]')).toBe(false);
    e.bindings[0]!.target_field = "amount";
    e.bindings[0]!.target_dataset = "db.other";
    expect(evidenceOrigins(e).has('["w","amount"]')).toBe(false);
  });
  it("follows a derived output through nested unions and deduplicates parameter origins", () => {
    const leaf = (id: string) => ({
      ...expression("'${yyyy-MM-dd}'"),
      expression_id: id,
      relation_id: id,
      ordinal: 0,
    });
    const e = {
      bindings: [
        {
          binding_status: "RESOLVED",
          write_observation_id: "w",
          target_field: "result",
          expression_id: "outer",
        },
      ],
      expressions: [
        {
          ...expression("result"),
          expression_id: "outer",
          relation_id: "outer",
          input_dependency_status: "DERIVED_OUTPUT",
        },
        {
          ...expression("UNION_OUTPUT(result)"),
          expression_id: "union",
          relation_id: "union",
          role: "SETOP_OUTPUT",
          ordinal: 0,
        },
        leaf("a"),
        leaf("b"),
      ],
      relations: [
        { relation_id: "outer", relation: { source: "union" } },
        {
          relation_id: "union",
          relation: { setop: "union", branches: ["a", "b"] },
        },
      ],
    } as unknown as Evidence;
    expect(evidenceOrigins(e).get('["w","result"]')).toMatchObject({
      label: "参数赋值：${yyyy-MM-dd}",
    });
    e.expressions[3] = {
      ...leaf("b"),
      input_dependency_status: "DERIVED_OUTPUT",
    };
    const mixed = evidenceOrigins(e).get('["w","result"]');
    expect(mixed?.kind).toBe("UNRESOLVED");
    expect(mixed?.label).toContain("参数赋值");
    expect(mixed?.label).toContain("字段来源未定位");
  });
  it("requires an exact resolved materialization and never propagates constants through transformations", () => {
    const e = {
      bindings: [
        {
          binding_id: "out",
          binding_status: "RESOLVED",
          write_observation_id: "w",
          target_field: "result",
          expression_id: "read",
        },
        {
          binding_id: "temp",
          binding_status: "RESOLVED",
          write_observation_id: "temp",
          target_field: "result",
          expression_id: "literal",
        },
      ],
      expressions: [
        {
          ...expression("result"),
          expression_id: "read",
          input_dependency_status: "PHYSICAL",
          input_fields: [{ table: "temp.t", column: "result" }],
        },
        { ...expression("'N05'"), expression_id: "literal" },
      ],
      relations: [],
      materializations: [
        {
          status: "RESOLVED",
          physical_dataset: "temp.t",
          column: "result",
          read_expression_ids: ["read"],
          output_binding_id: "temp",
        },
      ],
    } as unknown as Evidence;
    expect(evidenceOrigins(e).get('["w","result"]')?.label).toBe("常量：'N05'");
    e.materializations![0]!.status = "UNRESOLVED";
    expect(evidenceOrigins(e).has('["w","result"]')).toBe(false);
    e.materializations![0]!.status = "RESOLVED";
    e.expressions[0]!.display_text = "concat(result, 'x') AS result";
    expect(evidenceOrigins(e).has('["w","result"]')).toBe(false);
    e.expressions[0]!.display_text = "result AS result";
    e.materializations!.push({ ...e.materializations![0] });
    expect(evidenceOrigins(e).has('["w","result"]')).toBe(false);
  });
  it("labels only explicit literals as constants and preserves their source expression", () => {
    expect(expressionValueOrigin(expression("''"))).toMatchObject({
      kind: "CONSTANT",
      label: "常量：空字符串",
      expression: "'' AS result",
    });
    for (const value of ["NULL", "true", "-1.2e3", "'a''b'"])
      expect(expressionValueOrigin(expression(value))).toMatchObject({
        kind: "CONSTANT",
        label: "常量：" + value,
      });
    for (const value of [
      "current_date()",
      "COUNT(*)",
      "CAST('1' AS int)",
      "'${yyyy-MM-dd}'",
    ])
      expect(expressionValueOrigin(expression(value))).toMatchObject({
        kind: "EXPRESSION",
      });
  });
  it("does not confuse unresolved input or truncated paths with constants", () => {
    expect(expressionValueOrigin(undefined)).toBeUndefined();
    expect(
      expressionValueOrigin({
        ...expression("''"),
        input_dependency_status: "PHYSICAL",
      }),
    ).toBeUndefined();
    expect(
      expressionValueOrigin({
        ...expression("''"),
        unresolved_input_columns: ["missing"],
      }),
    ).toBeUndefined();
    expect(
      expressionValueOrigin({
        ...expression("''"),
        candidate_input_fields: [{ column: "x" }],
      }),
    ).toBeUndefined();
  });
  it("requires an exact task, write and column binding and invalidates on manifest changes", () => {
    const root = mkdtempSync(join(tmpdir(), "field-origins-"));
    const manifestPath = join(root, "manifest.json"),
      evidencePath = join(root, "evidence.json");
    const binding = {
      binding_status: "RESOLVED",
      expression_id: "expr",
      write_observation_id: "write:one",
      target_field: "result",
    };
    writeFileSync(
      evidencePath,
      JSON.stringify({ bindings: [binding], expressions: [expression("''")] }),
    );
    writeFileSync(
      manifestPath,
      JSON.stringify({ tasks: [{ taskId: "1", evidencePath }] }),
    );
    const resolver = new PublishedFieldOrigins();
    const node = {
      kind: "WRITE_FIELD",
      taskId: "1",
      writeId: "write:one",
      column: "result",
    };
    const result = resolver.annotate(
      [
        node,
        { ...node, writeId: "write:other" },
        { ...node, kind: "READ_FIELD" },
        { ...node, taskId: "2" },
      ],
      manifestPath,
    );
    expect(result[0]?.valueOrigin).toMatchObject({ label: "常量：空字符串" });
    expect(result.slice(1).every((n) => !n.valueOrigin)).toBe(true);
    const replacement = join(root, "replacement.json");
    writeFileSync(
      replacement,
      JSON.stringify({
        bindings: [binding],
        expressions: [
          { ...expression("result"), input_dependency_status: "PHYSICAL" },
        ],
      }),
    );
    writeFileSync(
      manifestPath,
      JSON.stringify({ tasks: [{ taskId: "1", evidencePath: replacement }] }),
    );
    expect(
      resolver.annotate([node], manifestPath)[0]?.valueOrigin,
    ).toBeUndefined();
  });
  it("exposes candidate-only input as unresolved instead of calling it a constant", () => {
    expect(
      expressionValueOrigin({
        ...expression("TO_CHAR(SYSDATE)"),
        input_dependency_status: "SQL_CANDIDATE",
        candidate_input_fields: [{ column: "sysdate" }],
      }),
    ).toMatchObject({
      kind: "UNRESOLVED",
      label: "来源待确认（候选字段输入）",
    });
  });
  it("leaves duplicate write bindings ambiguous", () => {
    const root = mkdtempSync(join(tmpdir(), "field-origin-ambiguous-"));
    const path = join(root, "evidence.json"),
      manifest = join(root, "manifest.json");
    const b = {
      binding_status: "RESOLVED",
      expression_id: "expr",
      write_observation_id: "w",
      target_field: "result",
    };
    writeFileSync(
      path,
      JSON.stringify({ bindings: [b, b], expressions: [expression("''")] }),
    );
    writeFileSync(
      manifest,
      JSON.stringify({ tasks: [{ taskId: "1", evidencePath: path }] }),
    );
    expect(
      new PublishedFieldOrigins().annotate(
        [{ kind: "WRITE_FIELD", taskId: "1", writeId: "w", column: "result" }],
        manifest,
      )[0]?.valueOrigin,
    ).toBeUndefined();
  });
});
