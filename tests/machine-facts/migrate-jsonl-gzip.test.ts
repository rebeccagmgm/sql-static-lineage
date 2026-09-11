import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalJsonl, sha256 } from "../../scripts/machine-facts/machine-facts-contract.ts";
import { migrateMachineFactsJsonl } from "../../scripts/machine-facts/migrate-jsonl-gzip.ts";
import { readJsonlRecords } from "../../scripts/machine-facts/jsonl-store.ts";

describe("migrate-machine-facts-jsonl-gzip", () => {
  it("migrates only manifest-declared bundle JSONL and preserves the declared content hash", () => {
    const root = mkdtempSync(join(tmpdir(), "facts-migrate-"));
    const bundle = join(root, "registry", "tasks", "task-1", "bundle");
    const logical = join(bundle, "dataset-io.jsonl");
    const content = canonicalJsonl([{ task_id: "task-1", direction: "READ" }]);
    mkdirSync(bundle, { recursive: true });
    writeFileSync(logical, content);
    writeFileSync(
      join(bundle, "manifest.json"),
      JSON.stringify({ outputs: [{ path: "dataset-io.jsonl", content_sha256: sha256(content) }] }),
    );
    const ignored = join(root, "indexes", "task-fact-index.jsonl");
    mkdirSync(join(root, "indexes"), { recursive: true });
    writeFileSync(ignored, "{\"task_id\":\"task-1\"}\n");

    expect(migrateMachineFactsJsonl({ root })).toMatchObject({ planned: 1, migrated: 0, failures: [] });
    expect(existsSync(logical)).toBe(true);

    expect(migrateMachineFactsJsonl({ root, apply: true })).toMatchObject({ planned: 1, migrated: 1, failures: [] });
    expect(existsSync(logical)).toBe(false);
    expect(readJsonlRecords(logical)).toEqual([{ task_id: "task-1", direction: "READ" }]);
    expect(readFileSync(ignored, "utf8")).toBe("{\"task_id\":\"task-1\"}\n");
  });
});
