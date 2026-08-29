import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadProviderCorpus } from "../../scripts/calcite-semantic-provider/corpus.ts";
import { providerRequestDigest } from "../../scripts/calcite-semantic-provider/protocol.ts";

describe("Calcite semantic provider corpus", () => {
  it("contains ten bounded, uniquely fingerprinted SQL/schema cases", () => {
    const corpus = loadProviderCorpus(join("tests", "fixtures", "calcite-semantic-provider", "corpus.json"));
    expect(corpus).toHaveLength(10);
    expect(new Set(corpus.map((item) => item.id)).size).toBe(10);
    expect(new Set(corpus.map((item) => providerRequestDigest(item.request))).size).toBe(10);
    expect(corpus.every((item) => item.request.schema.tables.every((table) =>
      table.columns.every((column) => column.type !== "ANY" && typeof column.nullable === "boolean"),
    ))).toBe(true);
  });
});
