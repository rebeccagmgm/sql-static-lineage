import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const THIN_CONSUMER_FILES = [
  "scripts/calcite-semantic-provider/consumer.ts",
  "scripts/calcite-semantic-provider/evidence-adapter.ts",
  "scripts/calcite-semantic-provider/impact-value-report.ts",
  "scripts/calcite-semantic-provider/runner.ts",
];

describe("Calcite semantic provider TypeScript boundary", () => {
  it("does not import or invoke a second SQL operator semantic engine", () => {
    for (const path of THIN_CONSUMER_FILES) {
      const source = readFileSync(path, "utf8");
      expect(source, path).not.toMatch(
        /(?:plan-facts-rel-projector|semantic-dependency-normalizer|sqlglot|\bsql-parser\b)/i,
      );
      expect(source, path).not.toMatch(
        /\b(?:parse|infer|normalize)(?:Join|Filter|Aggregate|SetOp|Window|Expression)\b/,
      );
      expect(source, path).not.toMatch(
        /switch\s*\([^)]*(?:dependencyKind|operatorKind|impactKind)/,
      );
    }
  });

  it("keeps operator words out of the read-only consumer implementation", () => {
    const source = readFileSync(
      "scripts/calcite-semantic-provider/consumer.ts",
      "utf8",
    );
    expect(source).not.toMatch(
      /\b(?:JOIN|FILTER|AGGREGATE|WINDOW|UNION|INTERSECT|EXCEPT|CASE)\b/,
    );
  });
});
