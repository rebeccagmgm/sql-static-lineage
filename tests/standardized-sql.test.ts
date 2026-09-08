import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { describeStandardizedSql } from "../scripts/input/shared/standardized-sql.ts";
import { stageConvertedPack } from "../scripts/input/stage-converted-pack.ts";
import { writeTaskInput } from "../scripts/input/shared/input-pack.ts";
import { loadPhysicalTableCatalog, prepareInputPackTask, runInputPackMachineFacts } from "../scripts/machine-facts/input-pack-machine-facts.ts";
import { readJsonlRecords } from "../scripts/machine-facts/jsonl-store.ts";
import { createSyntheticFieldLineageInputPack } from "./fixtures/field-lineage/cases.ts";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
it("only marks reviewed, syntactically parsed configuration statements", () => {
  const rows = describeStandardizedSql("-- comment;\nSET hive.exec.dynamic.partition=true; USE demo; SET x=1; SELECT 'SET hive.map.aggr=true;';", "databricks");
  expect(rows.filter(r => r.configuration)).toHaveLength(1);
  expect(rows[0]?.configuration?.key).toBe("hive.exec.dynamic.partition");
  expect(describeStandardizedSql("SET hive.exec.dynamic.partition=;", "databricks").every(r => r.configuration === null)).toBe(true);
  expect(describeStandardizedSql("SET hive.exec.dynamic.partition=true;", "duckdb").every(r => r.configuration === null)).toBe(true);
});
it("consumes a staged manifest only with opt-in, preserves business facts, and invalidates cache", () => {
  const root = mkdtempSync(join(tmpdir(), "normalized-pack-")); roots.push(root);
  const source = join(root, "source"); createSyntheticFieldLineageInputPack(source);
  const written = writeTaskInput(source, { taskId: "1100", taskCategory: "sparkIndex",
    target: { platform: "hive", dataSource: "warehouse", qualifiedName: "demo.root" }, partition: null,
    sql: { query: "SET hive.map.aggr=true; SELECT m.mid_a AS out_a, m.filter_key AS out_b FROM demo.mid m;" },
    evidenceProvider: "test:explicit", collectedAt: "2026-01-01T00:00:00.000Z" });
  const staged = join(root, "staged"); stageConvertedPack(join(written.directory, "task.json"), staged);
  const tableCatalog = loadPhysicalTableCatalog(source);
  const outputRoot = join(root, "facts");
  const options = { dataRoot: staged, taskIds: ["1100"], outputRoot, tableCatalog, noWriterCatalog: true };
  expect(runInputPackMachineFacts(options).tasks[0]?.state).toBe("SUCCESS");
  const bundle = join(outputRoot, "registry/tasks/1100/bundle");
  const records = (name: string) => readJsonlRecords(join(bundle, `${name}.jsonl`));
  const originalIo = records("dataset-io"), originalEdges = records("column-lineage-edges"), originalBindings = records("output-field-bindings");
  expect(records("unknowns").some(r => r.reason_code === "PLAN_FACT_UNRESOLVED")).toBe(true);
  const switched = runInputPackMachineFacts({ ...options, standardizedInput: true });
  expect(switched.tasks[0]?.state).toBe("SUCCESS");
  expect(switched.tasks[0]?.status).not.toBe("UNCHANGED");
  expect(records("unknowns").some(r => r.reason_code === "PLAN_FACT_UNRESOLVED")).toBe(false);
  expect(records("dataset-io")).toEqual(originalIo);
  expect(records("column-lineage-edges")).toEqual(originalEdges);
  expect(records("output-field-bindings")).toEqual(originalBindings);
  expect(records("statements")[0]).toMatchObject({ statement_type: "SET_CONFIGURATION", field_analysis: "NOT_APPLICABLE", configuration: { key: "hive.map.aggr", value: "true" } });
  const manifestPath = join(staged, "tasks/sparkIndex/1100/standardized-sql.json");
  const sqlPath = join(staged, "tasks/sparkIndex/1100/sql/query.sql");
  const originalSql = readFileSync(sqlPath, "utf8");
  writeFileSync(sqlPath, originalSql + " SELECT 2;");
  expect(() => prepareInputPackTask({ dataRoot: staged, taskId: "1100", tableCatalog, standardizedInput: true })).toThrow();
  writeFileSync(sqlPath, originalSql);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")); manifest.slots[0].statements[1].configuration = manifest.slots[0].statements[0].configuration;
  writeFileSync(manifestPath, JSON.stringify(manifest));
  expect(() => prepareInputPackTask({ dataRoot: staged, taskId: "1100", tableCatalog, standardizedInput: true })).toThrow("STANDARDIZED_SQL_MANIFEST_MISMATCH");
  rmSync(manifestPath);
  expect(() => prepareInputPackTask({ dataRoot: staged, taskId: "1100", tableCatalog, standardizedInput: true })).toThrow();
  expect(() => prepareInputPackTask({ dataRoot: staged, taskId: "1100", tableCatalog })).not.toThrow();
});
