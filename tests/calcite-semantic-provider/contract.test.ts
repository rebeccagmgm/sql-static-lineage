import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseCandidateTaskSemanticFacts,
  semanticFactsCanonicalJson,
  semanticFactsHash,
} from "../../scripts/calcite-semantic-provider/contract.ts";

const fixtures = join("tests", "fixtures", "calcite-semantic-provider");
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixtures, name), "utf8"));
}

describe("CandidateTaskSemanticFacts contract", () => {
  it.each(["valid.json", "partial.json", "unsupported.json", "unmappable.json"])(
    "accepts fail-closed %s fixture",
    (name) => expect(parseCandidateTaskSemanticFacts(fixture(name))).toBeDefined(),
  );

  it("rejects malformed digests and metadata overclaiming", () => {
    expect(() => parseCandidateTaskSemanticFacts(fixture("malformed.json"))).toThrowError(
      /invalid sha256|unevaluated metadata|absenceProven/i,
    );
  });

  it("round-trips deterministically and produces a stable content hash", () => {
    const facts = parseCandidateTaskSemanticFacts(fixture("valid.json"));
    const canonical = semanticFactsCanonicalJson(facts);
    const roundTrip = parseCandidateTaskSemanticFacts(JSON.parse(canonical));
    expect(semanticFactsCanonicalJson(roundTrip)).toBe(canonical);
    expect(semanticFactsHash(roundTrip)).toBe(semanticFactsHash(facts));
    expect(semanticFactsHash(facts)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects non-contiguous slots and non-deterministic array order", () => {
    const facts = fixture("valid.json") as Record<string, unknown>;
    const field = { ...((facts.fields as Record<string, unknown>[])[0]!), slot: 1 };
    expect(() => parseCandidateTaskSemanticFacts({ ...facts, fields: [field] })).toThrowError(
      /contiguous slots/i,
    );
    expect(() =>
      parseCandidateTaskSemanticFacts({
        ...facts,
        capabilities: [
          { capability: "Z_LAST", evaluationStatus: "EVALUATED" },
          { capability: "A_FIRST", evaluationStatus: "EVALUATED" },
        ],
      }),
    ).toThrowError(/sorted/i);
  });
});
