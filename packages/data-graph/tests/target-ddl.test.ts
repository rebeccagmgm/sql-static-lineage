import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { readTargetDdls } from "../src/asset-graph/target-ddl.ts";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "target-ddl-")); roots.push(root);
  mkdirSync(join(root, "hive", "demo"), { recursive: true });
  const content = "CREATE TABLE demo (id DECIMAL(20, 4) COMMENT '编号');\n";
  writeFileSync(join(root, "hive", "demo", "ddl.sql"), content);
  const binding = { table: "demo", writeId: "w1", outputScope: "FINAL", metadata: {
    table: { status: "AVAILABLE" as const },
    identity: { platform: "hive", dataSource: "source-a", qualifiedName: "demo", stableTableId: "demo" },
    sourcePath: "hive/demo", ddlHash: createHash("sha256").update(content).digest("hex"), collectedAt: "2026-09-15",
  } };
  return { root, content, binding };
}
it("returns exact original DDL once per physical write and excludes intermediate fields", () => {
  const { root, content, binding } = fixture();
  expect(readTargetDdls(root, [binding, binding, { ...binding, outputScope: "OTHER" }]))
    .toEqual([expect.objectContaining({ content, status: "AVAILABLE", table: "demo", writeId: "w1" })]);
});
it("fails closed for missing identity, stale content, missing files and escaping paths", () => {
  const { root, binding } = fixture();
  const read = (metadata: typeof binding.metadata | undefined) => readTargetDdls(root, [{ ...binding, metadata }])[0];
  expect(read(undefined)?.status).toBe("UNAVAILABLE");
  expect(read({ ...binding.metadata, ddlHash: "stale" })?.status).toBe("CHANGED");
  expect(read({ ...binding.metadata, sourcePath: "../outside" })?.status).toBe("UNAVAILABLE");
  expect(read({ ...binding.metadata, sourcePath: "hive/missing" })?.status).toBe("UNAVAILABLE");
});
it("keeps separate writes and physical sources even when their table names match", () => {
  const { root, binding } = fixture();
  const other = { ...binding, writeId: "w2", metadata: { ...binding.metadata,
    identity: { ...binding.metadata.identity, dataSource: "source-b" }, sourcePath: "hive/not-collected" } };
  const result = readTargetDdls(root, [binding, other]);
  expect(result.map(item => [item.writeId, item.status])).toEqual([["w1", "AVAILABLE"], ["w2", "UNAVAILABLE"]]);
  expect(result[1]?.content).toBeUndefined();
});
