import { describe, expect, it } from "vitest";
import { buildWritePartitionParts } from "../../../scripts/project-graph/task-local/write-partition-evidence.ts";

describe("buildWritePartitionParts", () => {
  it("falls back to pack partition when platform-target SQL has no INSERT", () => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm_index_n.grp_def",
      statementSql: "select grp_id from tmp",
      packPartition: { grp_type_code: "OTC_DERI_CONTR_TYPE" },
      packTarget: { qualifiedName: "dm_index_n.grp_def" },
      targetWriteCount: 1,
      writeObservationId: "write:platform",
      factsWrite: {
        write_observation_id: "write:platform",
        physical_dataset: "dm_index_n.grp_def",
        partition_mode: "STATIC",
        partition_columns: ["grp_type_code"],
        partition_assignments: [{ field: "grp_type_code", status: "CONFIRMED" }],
      },
    });
    expect(parts).toEqual([
      expect.objectContaining({
        column: "grp_type_code",
        values: ["OTC_DERI_CONTR_TYPE"],
      }),
    ]);
  });

  it("prefers SQL partition extraction for INSERT OVERWRITE", () => {
    const sql = "insert overwrite table pdata_n.t98_otc_deri_comp_sale_info partition(busi_date='${data_day_str}', grp_id='03') select 1";
    const parts = buildWritePartitionParts({
      qualifiedName: "pdata_n.t98_otc_deri_comp_sale_info",
      statementSql: sql,
      packPartition: { busi_date: "${YYYY-MM-DD}", grp_id: "03" },
    });
    expect(parts.map((part) => part.column)).toEqual(["busi_date", "grp_id"]);
    expect(parts[0]?.values[0]).toBe("${YYYY-MM-DD}");
  });

  it("does not infer an unpartitioned target from an INSERT without PARTITION", () => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm.target",
      statementSql: "insert overwrite table dm.target select 1",
      packPartition: null,
      packTarget: { qualifiedName: "dm.target" },
      targetWriteCount: 1,
      writeObservationId: "write:static",
      factsWrite: {
        write_observation_id: "write:static",
        physical_dataset: "dm.target",
        partition_mode: "STATIC",
      },
    });
    expect(parts).toEqual([
      expect.objectContaining({ column: "__unresolved_partition__", values: [] }),
    ]);
  });

  it("uses the Pack temporal binding when a dynamic writer output is unresolved", () => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm.target",
      statementSql: "select 1",
      packPartition: { busi_date: "2026-09-06" },
      packTarget: { qualifiedName: "dm.target" },
      targetWriteCount: 1,
      writeObservationId: "write:dynamic",
      factsWrite: {
        write_observation_id: "write:dynamic",
        physical_dataset: "dm.target",
        partition_mode: "DYNAMIC",
        partition_assignments: [
          { field: "busi_date", status: "CONFIRMED" },
        ],
      },
    });
    expect(parts).toEqual([
      expect.objectContaining({
        column: "busi_date",
        values: ["${YYYY-MM-DD}"],
        observedValue: "2026-09-06",
        valueStatus: "OBSERVED_RENDERED_VALUE",
        partitionStatus: "STATIC",
      }),
    ]);
  });

  it("recovers a dynamic partition literal from the write-bound output binding", () => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm.target", statementSql: "select 1", packPartition: { p: "WRONG_PACK_VALUE" },
      packTarget: { qualifiedName: "dm.target" }, targetWriteCount: 1, writeObservationId: "write:dynamic-literal",
      factsWrite: { write_observation_id: "write:dynamic-literal", physical_dataset: "dm.target", partition_mode: "DYNAMIC",
        partition_assignments: [{ field: "p", mapping_method: "DYNAMIC_PARTITION_OUTPUT_ORDINAL", status: "CONFIRMED" }] },
      bindings: [{ write_observation_id: "write:dynamic-literal", target_field: "p", binding_status: "RESOLVED", source_ordinal: 0, expression_id: "expr:p" }],
      expressions: [{ expression_id: "expr:p", relation_id: "rel:project", role: "PROJECT_EXPRESSION", ordinal: 0, expression_text: "'FACTS_VALUE' as p" }], relations: [],
    });
    expect(parts).toEqual([expect.objectContaining({ column: "p", values: ["FACTS_VALUE"], partitionStatus: "STATIC" })]);
  });

  it("preserves a dynamic temporal template for later canonical comparison", () => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm.target", statementSql: "select 1", packPartition: null, writeObservationId: "write:dynamic-template",
      factsWrite: { write_observation_id: "write:dynamic-template", physical_dataset: "dm.target", partition_mode: "DYNAMIC",
        partition_assignments: [{ field: "busi_date", mapping_method: "DYNAMIC_PARTITION_OUTPUT_ORDINAL", status: "CONFIRMED" }] },
      bindings: [{ write_observation_id: "write:dynamic-template", target_field: "busi_date", binding_status: "RESOLVED", source_ordinal: 0, expression_id: "expr:busi_date" }],
      expressions: [{ expression_id: "expr:busi_date", relation_id: "rel:project", role: "PROJECT_EXPRESSION", ordinal: 0, expression_text: "${data_day_str} AS busi_date" }], relations: [],
    });
    expect(parts).toEqual([expect.objectContaining({
      column: "busi_date",
      values: ["${YYYY-MM-DD}"],
      valueStatus: "RUNTIME_EXPRESSION",
      observedValue: "${data_day_str}",
      expression: "${data_day_str}",
      partitionStatus: "STATIC",
    })]);
  });

  it("resolves a dynamic output reference through the bound SQL alias", () => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm.target",
      statementSql: "select 'OTC_DERI_CONTR' as grp_type_code",
      packPartition: null,
      writeObservationId: "write:dynamic-reference",
      factsWrite: {
        write_observation_id: "write:dynamic-reference",
        physical_dataset: "dm.target",
        partition_mode: "DYNAMIC",
        partition_assignments: [{ field: "grp_type_code", mapping_method: "DYNAMIC_PARTITION_OUTPUT_ORDINAL", status: "CONFIRMED" }],
      },
      bindings: [{ write_observation_id: "write:dynamic-reference", target_field: "grp_type_code", binding_status: "RESOLVED", source_ordinal: 0, expression_id: "expr:grp_type_code" }],
      expressions: [{ expression_id: "expr:grp_type_code", relation_id: "rel:project", role: "PROJECT_EXPRESSION", ordinal: 0, expression_text: "grp_type_code" }],
      relations: [],
    });
    expect(parts).toEqual([expect.objectContaining({
      column: "grp_type_code",
      values: ["OTC_DERI_CONTR"],
      valueStatus: "OBSERVED_RENDERED_VALUE",
      expression: "'OTC_DERI_CONTR'",
      partitionStatus: "STATIC",
    })]);
  });

  it("accepts stringified source ordinals from Facts bindings", () => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm.target",
      statementSql: "select 'OTC_DERI_CONTR_TYPE' as grp_type_code",
      packPartition: null,
      writeObservationId: "write:string-ordinal",
      factsWrite: {
        write_observation_id: "write:string-ordinal",
        physical_dataset: "dm.target",
        partition_mode: "DYNAMIC",
        partition_assignments: [{ field: "grp_type_code", mapping_method: "DYNAMIC_PARTITION_OUTPUT_ORDINAL", status: "CONFIRMED" }],
      },
      bindings: [{ write_observation_id: "write:string-ordinal", target_field: "grp_type_code", binding_status: "RESOLVED", source_ordinal: "0", expression_id: "expr:grp_type_code" }],
      expressions: [{ expression_id: "expr:grp_type_code", relation_id: "rel:project", role: "PROJECT_EXPRESSION", ordinal: 0, expression_text: "grp_type_code" }],
      relations: [],
    });
    expect(parts).toEqual([expect.objectContaining({
      column: "grp_type_code",
      values: ["OTC_DERI_CONTR_TYPE"],
      partitionStatus: "STATIC",
    })]);
  });

  it("preserves a non-temporal dynamic runtime template", () => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm.target", statementSql: "select 1", packPartition: null, writeObservationId: "write:dynamic-src-tpl",
      factsWrite: { write_observation_id: "write:dynamic-src-tpl", physical_dataset: "dm.target", partition_mode: "DYNAMIC",
        partition_assignments: [{ field: "src_tbl", mapping_method: "DYNAMIC_PARTITION_OUTPUT_ORDINAL", status: "CONFIRMED" }] },
      bindings: [{ write_observation_id: "write:dynamic-src-tpl", target_field: "src_tbl", binding_status: "RESOLVED", source_ordinal: 0, expression_id: "expr:src_tbl" }],
      expressions: [{ expression_id: "expr:src_tbl", relation_id: "rel:project", role: "PROJECT_EXPRESSION", ordinal: 0, expression_text: "${src_table} as src_tbl" }], relations: [],
    });
    expect(parts).toEqual([expect.objectContaining({
      column: "src_tbl",
      values: ["${src_table}"],
      valueStatus: "RUNTIME_EXPRESSION",
      observedValue: "${src_table}",
      expression: "${src_table}",
      partitionStatus: "STATIC",
    })]);
  });

  it("resolves a UNION dynamic partition when all branches agree canonically", () => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm.target",
      statementSql: "select 1",
      packPartition: null,
      writeObservationId: "write:union-template",
      factsWrite: {
        write_observation_id: "write:union-template",
        physical_dataset: "dm.target",
        partition_mode: "DYNAMIC",
        partition_assignments: [{ field: "busi_date", mapping_method: "DYNAMIC_PARTITION_OUTPUT_ORDINAL", status: "CONFIRMED" }],
      },
      bindings: [{ write_observation_id: "write:union-template", target_field: "busi_date", binding_status: "RESOLVED", source_ordinal: 0, expression_id: "expr:setop" }],
      expressions: [
        { expression_id: "expr:setop", relation_id: "rel:setop", role: "SETOP_OUTPUT", ordinal: 0, expression_text: "UNION_OUTPUT(busi_date)" },
        { expression_id: "expr:left", relation_id: "rel:left", role: "PROJECT_EXPRESSION", ordinal: 0, expression_text: "${data_day_str} as busi_date" },
        { expression_id: "expr:right", relation_id: "rel:right", role: "PROJECT_EXPRESSION", ordinal: 0, expression_text: "'${YYYY-MM-DD}' as busi_date" },
      ],
      relations: [
        { relation_id: "rel:setop", relation_type: "setop", relation: { type: "setop", setop: "union", branches: ["rel:left", "rel:right"] } },
        { relation_id: "rel:left", relation_type: "project", relation: { type: "project" } },
        { relation_id: "rel:right", relation_type: "project", relation: { type: "project" } },
      ],
    });
    expect(parts).toEqual([expect.objectContaining({
      column: "busi_date",
      values: ["${YYYY-MM-DD}"],
      valueStatus: "RUNTIME_EXPRESSION",
      partitionStatus: "STATIC",
    })]);
  });

  it("requires every UNION branch to provide the same bound ordinal literal", () => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm.target", statementSql: "select 1", packPartition: null, writeObservationId: "write:union",
      factsWrite: { write_observation_id: "write:union", physical_dataset: "dm.target", partition_mode: "DYNAMIC",
        partition_assignments: [{ field: "p", mapping_method: "DYNAMIC_PARTITION_OUTPUT_ORDINAL", status: "CONFIRMED" }] },
      bindings: [{ write_observation_id: "write:union", target_field: "p", binding_status: "RESOLVED", source_ordinal: 0, expression_id: "expr:setop" }],
      expressions: [{ expression_id: "expr:setop", relation_id: "rel:setop", role: "SETOP_OUTPUT", ordinal: 0, expression_text: "UNION_OUTPUT(p)" },
        { expression_id: "expr:left", relation_id: "rel:left", role: "PROJECT_EXPRESSION", ordinal: 0, expression_text: "'LEFT' as p" },
        { expression_id: "expr:right", relation_id: "rel:right", role: "PROJECT_EXPRESSION", ordinal: 0, expression_text: "'RIGHT' as p" }],
      relations: [
        { relation_id: "rel:setop", relation_type: "setop", relation: { type: "setop", setop: "union", branches: ["rel:left", "rel:right"] } },
        { relation_id: "rel:left", relation_type: "project", relation: { type: "project" } },
        { relation_id: "rel:right", relation_type: "project", relation: { type: "project" } },
      ],
    });
    expect(parts).toEqual([expect.objectContaining({
      column: "p",
      values: [],
      valueStatus: "UNKNOWN",
      reason: "DYNAMIC_PARTITION_UNION_BRANCH_CONFLICT",
    })]);
  });

  it("reports a non-unique dynamic output reference explicitly", () => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm.target",
      statementSql: "select 'A' as grp_type_code union all select 'B' as grp_type_code",
      packPartition: null,
      writeObservationId: "write:dynamic-ambiguous-reference",
      factsWrite: {
        write_observation_id: "write:dynamic-ambiguous-reference",
        physical_dataset: "dm.target",
        partition_mode: "DYNAMIC",
        partition_assignments: [{ field: "grp_type_code", mapping_method: "DYNAMIC_PARTITION_OUTPUT_ORDINAL", status: "CONFIRMED" }],
      },
      bindings: [{ write_observation_id: "write:dynamic-ambiguous-reference", target_field: "grp_type_code", binding_status: "RESOLVED", source_ordinal: 0, expression_id: "expr:grp_type_code" }],
      expressions: [{ expression_id: "expr:grp_type_code", relation_id: "rel:project", role: "PROJECT_EXPRESSION", ordinal: 0, expression_text: "grp_type_code" }],
      relations: [],
    });
    expect(parts[0]).toEqual(expect.objectContaining({
      values: [],
      reason: "DYNAMIC_PARTITION_OUTPUT_REFERENCE_NOT_UNIQUE",
    }));
  });

  it.each([
    ["rejects string concatenation", "'LEFT' || 'RIGHT' as p", "PROJECT_EXPRESSION"],
    ["rejects unsupported leaf role", "'VALUE' as p", "FILTER_PREDICATE"],
  ])("%s", (_name, expressionText, role) => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm.target", statementSql: "select 1", packPartition: null, writeObservationId: "write:boundary",
      factsWrite: { write_observation_id: "write:boundary", physical_dataset: "dm.target", partition_mode: "DYNAMIC",
        partition_assignments: [{ field: "p", mapping_method: "DYNAMIC_PARTITION_OUTPUT_ORDINAL", status: "CONFIRMED" }] },
      bindings: [{ write_observation_id: "write:boundary", target_field: "p", binding_status: "RESOLVED", source_ordinal: 0, expression_id: "expr:boundary" }],
      expressions: [{ expression_id: "expr:boundary", relation_id: "rel:boundary", role, ordinal: 0, expression_text: expressionText }],
      relations: [],
    });
    expect(parts[0]).toEqual(expect.objectContaining({
      values: [],
      reason: role === "FILTER_PREDICATE"
        ? "DYNAMIC_PARTITION_UNSUPPORTED_EXPRESSION_ROLE"
        : "DYNAMIC_PARTITION_EXPRESSION_NOT_LITERAL",
    }));
  });

  it("rejects a non-UNION SETOP root", () => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm.target", statementSql: "select 1", packPartition: null, writeObservationId: "write:setop",
      factsWrite: { write_observation_id: "write:setop", physical_dataset: "dm.target", partition_mode: "DYNAMIC",
        partition_assignments: [{ field: "p", mapping_method: "DYNAMIC_PARTITION_OUTPUT_ORDINAL", status: "CONFIRMED" }] },
      bindings: [{ write_observation_id: "write:setop", target_field: "p", binding_status: "RESOLVED", source_ordinal: 0, expression_id: "expr:setop" }],
      expressions: [{ expression_id: "expr:setop", relation_id: "rel:setop", role: "SETOP_OUTPUT", ordinal: 0, expression_text: "EXCEPT_OUTPUT(p)" }],
      relations: [{ relation_id: "rel:setop", relation_type: "setop", relation: { type: "setop", setop: "except", branches: ["rel:left"] } }],
    });
    expect(parts[0]).toEqual(expect.objectContaining({
      values: [],
      reason: "DYNAMIC_PARTITION_SETOP_NOT_UNION",
    }));
  });

  it("reports a missing UNION branch ordinal explicitly", () => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm.target",
      statementSql: "select 1",
      packPartition: null,
      writeObservationId: "write:setop-missing-ordinal",
      factsWrite: {
        write_observation_id: "write:setop-missing-ordinal",
        physical_dataset: "dm.target",
        partition_mode: "DYNAMIC",
        partition_assignments: [{ field: "p", mapping_method: "DYNAMIC_PARTITION_OUTPUT_ORDINAL", status: "CONFIRMED" }],
      },
      bindings: [{ write_observation_id: "write:setop-missing-ordinal", target_field: "p", binding_status: "RESOLVED", source_ordinal: 0, expression_id: "expr:setop" }],
      expressions: [
        { expression_id: "expr:setop", relation_id: "rel:setop", role: "SETOP_OUTPUT", ordinal: 0, expression_text: "UNION_OUTPUT(p)" },
        { expression_id: "expr:left", relation_id: "rel:left", role: "PROJECT_EXPRESSION", ordinal: 1, expression_text: "'LEFT' as p" },
      ],
      relations: [
        { relation_id: "rel:setop", relation_type: "setop", relation: { type: "setop", setop: "union", branches: ["rel:left", "rel:right"] } },
        { relation_id: "rel:left", relation_type: "project", relation: { type: "project" } },
      ],
    });
    expect(parts[0]).toEqual(expect.objectContaining({
      values: [],
      reason: "DYNAMIC_PARTITION_BRANCH_ORDINAL_MISSING",
    }));
  });

  it("does not transfer a Pack partition from one target to another", () => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm.other",
      statementSql: "select 1",
      packPartition: { p: "A" },
      packTarget: { qualifiedName: "dm.target" },
      targetWriteCount: 1,
      writeObservationId: "write:other",
      factsWrite: {
        write_observation_id: "write:other",
        physical_dataset: "dm.other",
        partition_mode: "STATIC",
        partition_assignments: [{ field: "p", status: "CONFIRMED" }],
      },
    });
    expect(parts).toEqual([
      expect.objectContaining({ column: "p", values: [], partitionStatus: "UNKNOWN" }),
    ]);
  });

  it("fails closed for a conflicting Facts assignment", () => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm.target",
      statementSql: "select 1",
      packPartition: { p: "A" },
      packTarget: { qualifiedName: "dm.target" },
      targetWriteCount: 1,
      writeObservationId: "write:conflict",
      factsWrite: {
        write_observation_id: "write:conflict",
        physical_dataset: "dm.target",
        partition_mode: "STATIC",
        partition_binding_status: "CONFLICT",
        partition_assignments: [{ field: "p", status: "CONFLICT" }],
      },
    });
    expect(parts).toEqual([
      expect.objectContaining({ column: "p", values: [], partitionStatus: "UNKNOWN" }),
    ]);
  });

  it("does not apply a task Pack without the write-bound Facts target evidence", () => {
    const parts = buildWritePartitionParts({
      qualifiedName: "dm.target",
      statementSql: "select 1",
      packPartition: { p: "A" },
      packTarget: { qualifiedName: "dm.target" },
    });
    expect(parts).toEqual([
      expect.objectContaining({ column: "__unresolved_partition__", values: [] }),
    ]);
  });
});
