import { describe, expect, it } from "vitest";
import {
  projectConcreteSqlType,
  projectDifferentialSchema,
  type SchemaColumnEvidence,
  type SchemaTableProjectionInput,
} from "../../scripts/calcite-differential/schema-type-projection.ts";
import type { SchemaProvider } from "../../src/qualify/schema-provider.ts";

const tableEvidence = ["table-ddl-1"] as const;

function typedTable(
  columns: readonly SchemaColumnEvidence[],
  overrides: Partial<SchemaTableProjectionInput> = {},
): SchemaTableProjectionInput {
  return {
    table: { catalog: "APP", schema: "PUBLIC", name: "orders" },
    columns,
    evidenceRefs: tableEvidence,
    ...overrides,
  };
}

describe("Calcite differential schema/type projection", () => {
  it("projects exact table/column identity, concrete types, nullability, and evidence refs", () => {
    const result = projectDifferentialSchema({
      tables: [
        typedTable([
          { name: "order_id", type: "bigint", nullable: false, evidenceRefs: ["col-id"] },
          { name: "amount", type: "decimal(18,2)", nullable: true, evidenceRefs: ["col-amount"] },
        ]),
      ],
      dialect: "HIVE",
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.issues).toEqual([]);
    expect(result.schema).toEqual({
      tables: [
        {
          catalog: "APP",
          schema: "PUBLIC",
          name: "orders",
          evidenceRefs: ["table-ddl-1"],
          columns: [
            {
              name: "order_id",
              type: "BIGINT",
              nullable: false,
              ordinal: 0,
              evidenceRefs: ["col-id"],
            },
            {
              name: "amount",
              type: "DECIMAL(18,2)",
              nullable: true,
              ordinal: 1,
              evidenceRefs: ["col-amount"],
            },
          ],
        },
      ],
    });
    expect(result.types).toEqual([
      {
        table: { catalog: "APP", schema: "PUBLIC", name: "orders" },
        column: { name: "order_id", ordinal: 0 },
        type: { status: "CONCRETE", name: "BIGINT", nullable: false },
        evidenceRefs: ["col-id"],
      },
      {
        table: { catalog: "APP", schema: "PUBLIC", name: "orders" },
        column: { name: "amount", ordinal: 1 },
        type: {
          status: "CONCRETE",
          name: "DECIMAL",
          nullable: true,
          precision: 18,
          scale: 2,
        },
        evidenceRefs: ["col-amount"],
      },
    ]);
  });

  it("sorts explicit ordinals before building the Calcite schema and type facts", () => {
    const result = projectDifferentialSchema({
      tables: [
        typedTable([
          { name: "amount", type: "DECIMAL(18,2)", nullable: true, ordinal: 1 },
          { name: "order_id", type: "BIGINT", nullable: false, ordinal: 0 },
        ]),
      ],
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.schema?.tables[0]?.columns.map((column) => column.name)).toEqual([
      "order_id",
      "amount",
    ]);
    expect(result.types.map((fact) => fact.column.name)).toEqual([
      "order_id",
      "amount",
    ]);
    expect(result.schema?.tables[0]?.columns.map((column) => column.ordinal)).toEqual([
      0,
      1,
    ]);
  });

  it("rejects explicit ordinal gaps instead of letting Calcite reinterpret positions", () => {
    const result = projectDifferentialSchema({
      tables: [
        typedTable([
          { name: "order_id", type: "BIGINT", nullable: false, ordinal: 0 },
          { name: "amount", type: "DECIMAL(18,2)", nullable: true, ordinal: 2 },
        ]),
      ],
    });

    expect(result.status).toBe("UNSUPPORTED");
    expect(result.schema).toBeNull();
    expect(result.types).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "SCHEMA_COLUMN_ORDINAL_NONCONTIGUOUS",
        path: "tables[0].columns",
        table: { catalog: "APP", schema: "PUBLIC", name: "orders" },
        columnName: "amount",
      }),
    ]);
  });

  it("returns a column-scoped unsupported issue when type evidence is missing", () => {
    const result = projectDifferentialSchema({
      tables: [typedTable([{ name: "order_id", nullable: false }])],
    });

    expect(result.status).toBe("UNSUPPORTED");
    expect(result.schema).toBeNull();
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "SCHEMA_TYPE_MISSING",
        path: "tables[0].columns[0].type",
        table: { catalog: "APP", schema: "PUBLIC", name: "orders" },
        columnName: "order_id",
        evidenceRefs: ["table-ddl-1"],
      }),
    ]);
  });

  it("rejects an ambiguous table suffix before consuming either candidate schema", () => {
    const provider: SchemaProvider = {
      version: 1,
      columnsFor: () => [
        { name: "order_id", type: "BIGINT", nullable: false },
      ],
      tableCandidates: () => [
        ["prod", "orders"],
        ["test", "orders"],
      ],
      tables: () => ["orders"],
    };
    const result = projectDifferentialSchema({
      provider,
      tables: [
        {
          table: { name: "orders" },
          evidenceRefs: ["schema-catalog-1"],
        },
      ],
    });

    expect(result.status).toBe("UNSUPPORTED");
    expect(result.schema).toBeNull();
    expect(result.issues[0]).toMatchObject({
      code: "SCHEMA_TABLE_AMBIGUOUS",
      path: "tables[0].table",
      table: { name: "orders" },
      evidenceRefs: ["schema-catalog-1"],
      candidates: [{ schema: "prod", name: "orders" }, { schema: "test", name: "orders" }],
    });
  });

  it("does not project a type when nullability is absent", () => {
    const result = projectDifferentialSchema({
      tables: [typedTable([{ name: "amount", type: "DECIMAL(18,2)" }])],
    });

    expect(result.status).toBe("UNSUPPORTED");
    expect(result.schema).toBeNull();
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "SCHEMA_NULLABILITY_MISSING",
        path: "tables[0].columns[0].nullable",
        columnName: "amount",
      }),
    ]);
    expect(result.types).toEqual([]);
  });

  it("keeps unambiguous Hive decimal precision and scale", () => {
    expect(
      projectConcreteSqlType(
        { type: "decimal ( 18 , 2 )", nullable: false },
        { table: { name: "orders" }, columnName: "amount", evidenceRefs: ["ddl-amount"] },
      ),
    ).toEqual({
      status: "SUCCESS",
      type: {
        status: "CONCRETE",
        name: "DECIMAL",
        nullable: false,
        precision: 18,
        scale: 2,
      },
      issues: [],
    });
  });

  it("fails closed instead of guessing from names or raw expression text", () => {
    const missing = projectConcreteSqlType(
      { type: undefined, nullable: false },
      { table: { name: "orders" }, columnName: "id", evidenceRefs: ["e1"] },
    );
    const expressionText = projectDifferentialSchema({
      tables: [
        typedTable([
          {
            name: "amount",
            nullable: false,
            // Deliberately not part of SchemaColumnEvidence; the projector must ignore it.
            ...( { expression_text: "CAST(amount AS DECIMAL(18,2))" } as object),
          } as SchemaColumnEvidence,
        ]),
      ],
    });

    expect(missing.status).toBe("UNSUPPORTED");
    expect(missing.type).toBeNull();
    expect(missing.issues[0]?.code).toBe("SCHEMA_TYPE_MISSING");
    expect(expressionText.status).toBe("UNSUPPORTED");
    expect(expressionText.types).toEqual([]);
    expect(expressionText.issues.map((issue) => issue.code)).toContain("SCHEMA_TYPE_MISSING");
  });

  it("uses Hive's nullable default only for trusted Hive DDL", () => {
    const explicit = projectDifferentialSchema({
      tables: [
        {
          table: { schema: "PUBLIC", name: "orders" },
          ddl: "CREATE TABLE PUBLIC.orders (order_id BIGINT NOT NULL, amount DECIMAL(18,2))",
          evidenceRefs: ["ddl-1"],
        },
      ],
      dialect: "HIVE",
    });
    expect(explicit.status).toBe("SUCCESS");
    expect(explicit.issues).toEqual([]);
    expect(explicit.schema?.tables[0]?.columns).toEqual([
      expect.objectContaining({ name: "order_id", nullable: false }),
      expect.objectContaining({ name: "amount", nullable: true }),
    ]);

    const generic = projectDifferentialSchema({
      tables: [
        {
          table: { schema: "PUBLIC", name: "orders" },
          ddl: "CREATE TABLE PUBLIC.orders (amount DECIMAL(18,2))",
          evidenceRefs: ["ddl-1"],
        },
      ],
      dialect: "ANSI",
    });
    expect(generic.status).toBe("UNSUPPORTED");
    expect(generic.issues).toEqual([
      expect.objectContaining({ code: "SCHEMA_NULLABILITY_MISSING" }),
    ]);
  });

  it("rejects Hive-only aliases outside Hive and malformed Hive suffixes", () => {
    const ansi = projectDifferentialSchema({
      tables: [typedTable([{ name: "payload", type: "STRING", nullable: false }])],
      dialect: "ANSI",
    });
    expect(ansi.status).toBe("UNSUPPORTED");
    expect(ansi.issues[0]?.code).toBe("SCHEMA_TYPE_UNSUPPORTED");

    const malformed = projectDifferentialSchema({
      tables: [{
        table: { schema: "APP", name: "orders" },
        ddl: "CREATE TABLE APP.orders (id INT DEFAULT)",
        evidenceRefs: ["ddl-bad"],
      }],
      dialect: "HIVE",
    });
    expect(malformed.status).toBe("UNSUPPORTED");
    expect(malformed.issues.map((issue) => issue.code)).toContain("SCHEMA_TYPE_AMBIGUOUS");
  });

  it("does not let direct columns bypass a provider's ambiguous physical identity", () => {
    const provider: SchemaProvider = {
      version: 1,
      columnsFor: () => [{ name: "id", type: "BIGINT", nullable: false }],
      tableCandidates: () => [["prod", "orders"], ["test", "orders"]],
      tables: () => ["orders"],
    };
    const result = projectDifferentialSchema({
      provider,
      tables: [{ table: { name: "orders" }, columns: [{ name: "id", type: "BIGINT", nullable: false }], evidenceRefs: ["catalog"] }],
    });
    expect(result.status).toBe("UNSUPPORTED");
    expect(result.issues[0]?.code).toBe("SCHEMA_TABLE_AMBIGUOUS");
  });

  it("rejects conflicting object and explicit nullability evidence", () => {
    const result = projectConcreteSqlType(
      { type: "BIGINT", nullable: false },
      true,
      { table: { schema: "APP", name: "orders" }, columnName: "id" },
    );

    expect(result.status).toBe("UNSUPPORTED");
    expect(result.type).toBeNull();
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "SCHEMA_NULLABILITY_AMBIGUOUS" }),
    ]);
  });
});
