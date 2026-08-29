import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolvePocOutputPath } from "../../scripts/calcite-semantic-provider/output-guard.ts";

describe("Calcite semantic provider POC output guard", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("allows only descendants of the POC staging root", () => {
    const root = mkdtempSync(join(tmpdir(), "calcite-provider-poc-"));
    roots.push(root);
    mkdirSync(join(root, "samples"));
    expect(resolvePocOutputPath("samples/result.json", root)).toBe(
      join(root, "samples", "result.json"),
    );
    expect(() => resolvePocOutputPath("../escape.json", root)).toThrowError(
      /POC_STAGING_ESCAPE|staging root/i,
    );
  });

  it("rejects canonical directories and filenames", () => {
    const root = mkdtempSync(join(tmpdir(), "calcite-provider-poc-"));
    roots.push(root);
    expect(() =>
      resolvePocOutputPath("E:/workspace/artifacts/tasks/209119/report.json", root),
    ).toThrowError(/CANONICAL_ARTIFACT_PATH_FORBIDDEN|artifacts\/tasks/i);
    expect(() => resolvePocOutputPath("field-lineage.json", root)).toThrowError(
      /CANONICAL_ARTIFACT_NAME_FORBIDDEN|canonical/i,
    );
    expect(() =>
      resolvePocOutputPath("target-table-upstream-causal-closure.html", root),
    ).toThrowError(/CANONICAL_ARTIFACT_NAME_FORBIDDEN|canonical/i);
  });
});
