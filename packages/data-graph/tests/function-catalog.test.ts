import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importFunctionKnowledge, queryFunctionKnowledge, readFunctionKnowledgeSource, type FunctionKnowledgeSource } from "../../../scripts/knowledge/function-catalog.ts";
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const fixture = (): FunctionKnowledgeSource => ({ title: "reference", locator: "document:1", receivedAt: "2026-09-11", rawText: "original",
  entries: [{ kind: "FUNCTION", name: "IsTradeDay", engine: "presto", status: "DOCUMENTED", summary: "boolean" }] });
it("keeps imports idempotent and preserves conflicting source versions", () => {
  const dir = mkdtempSync(join(tmpdir(), "function-catalog-")); dirs.push(dir); const db = join(dir, "catalog.sqlite");
  expect(importFunctionKnowledge(db, [fixture(), fixture()])).toEqual({ sources: 1, entries: 1 });
  const next = { ...fixture(), rawText: "second source version", entries: [{ ...fixture().entries[0]!, summary: "1/0" }] };
  expect(importFunctionKnowledge(db, [next])).toEqual({ sources: 2, entries: 2 });
  expect(queryFunctionKnowledge(db, "istradeday")).toHaveLength(2);
  expect(queryFunctionKnowledge(db, "' OR 1=1 --")).toHaveLength(0);
  const rows = queryFunctionKnowledge(db,"istradeday") as {source_id:string}[];
  expect(["original","second source version"]).toContain(readFunctionKnowledgeSource(db,rows[0]!.source_id).raw_text);
  expect(() => readFunctionKnowledgeSource(db,"missing")).toThrow("CATALOG_SOURCE_NOT_FOUND");
});
it("rejects malformed imports and unbounded queries", () => {
  expect(() => importFunctionKnowledge("unused.sqlite", [{ ...fixture(), entries: [{ ...fixture().entries[0]!, kind: "EXECUTE" as never }] }])).toThrow("CATALOG_ENTRY_INVALID");
  expect(() => queryFunctionKnowledge("unused.sqlite", "x", 201)).toThrow("CATALOG_LIMIT_INVALID");
});
