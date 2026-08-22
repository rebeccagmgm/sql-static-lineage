import { describe, expect, it } from "vitest";
import { parseDdlSchema } from "../scripts/plans/ddl-schema.ts";

describe("DDL schema reader", () => {
	it("reads Hive columns and appends partition columns", () => {
		const result = parseDdlSchema(
			"create table demo.orders (id bigint, amount decimal(18,2), note string comment 'a,b') partitioned by (busi_date string comment '业务日期') stored as orc",
		);

		expect(result.columns.map((column) => column.name)).toEqual(["id", "amount", "note", "busi_date"]);
		expect(result.partition_columns).toEqual(["busi_date"]);
		expect(result.warnings).toEqual([]);
	});

	it("ignores table constraints and indexes", () => {
		const result = parseDdlSchema(
			'CREATE TABLE "DEMO"."ORDERS" ("ID" NUMBER(10,0), "NAME" VARCHAR2(50), PRIMARY KEY ("ID"), CONSTRAINT "UQ_NAME" UNIQUE ("NAME")); CREATE INDEX "IDX_NAME" ON "DEMO"."ORDERS" ("NAME")',
		);

		expect(result.columns.map((column) => column.name)).toEqual(["ID", "NAME"]);
		expect(result.partition_columns).toEqual([]);
	});

	it("keeps an explicit unknown result when there is no column list", () => {
		const result = parseDdlSchema("CREATE TABLE demo.orders LIKE demo.base");

		expect(result.columns).toEqual([]);
		expect(result.warnings).toContain("table column list not found");
	});

	it("derives output columns from a view defining SELECT", () => {
		const result = parseDdlSchema(`
			SELECT 'OPTION' DATA_TYPE,
			       OT.INTERNAL_TRADE_ID AS CONTRACT_CODE,
			       MAX(OD.INITIAL_NOTIONAL) INITIAL_NOTIONAL
		FROM REF_OTC_OPTION_DEAL OD
		UNION ALL
		SELECT MAX(DATA_TYPE), CONTRACT_CODE, MAX(INITIAL_NOTIONAL)
		FROM demo.trs
		`);

		expect(result.columns.map((column) => column.name)).toEqual([
			"DATA_TYPE",
			"CONTRACT_CODE",
			"INITIAL_NOTIONAL",
		]);
		expect(result.warnings).toEqual([]);
	});
});
