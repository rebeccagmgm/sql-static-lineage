import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCandidateTaskSemanticFacts } from "../../scripts/calcite-semantic-provider/contract.ts";
import {
  compareSemanticGolden,
  semanticEdges,
} from "../../scripts/calcite-semantic-provider/semantic-golden.ts";

const valid = parseCandidateTaskSemanticFacts(JSON.parse(readFileSync(join(
  "tests", "fixtures", "calcite-semantic-provider", "valid.json",
), "utf8")));
const corpusGolden = JSON.parse(readFileSync(join(
  "tests", "fixtures", "calcite-semantic-provider", "semantic-golden.json",
), "utf8")) as Record<string, readonly ReturnType<typeof semanticEdges>[number][]>;

describe("Calcite semantic edge golden", () => {
  it("normalizes exact endpoints and verifies the complete edge set", () => {
    const expected = [{
      dependencyKind: "VALUE_INPUT" as const,
      impactKind: "FIELD_VALUE" as const,
      operatorKind: "TABLE_SCAN" as const,
      from: ["relation:table_scan#0.field:amount#0"],
      to: ["relation:table_scan#0.field:amount#0"],
    }];
    expect(compareSemanticGolden(valid, expected)).toEqual(expect.objectContaining({
      status: "SEMANTIC_EDGE_VERIFIED",
      missingEdges: [],
      unexpectedEdges: [],
      duplicateEdges: [],
    }));
  });

  it("reports missing, unexpected and duplicate edges instead of kind-only success", () => {
    const actualEdge = semanticEdges(valid)[0]!;
    const duplicateFacts = parseCandidateTaskSemanticFacts({
      ...valid,
      dependencies: [
        valid.dependencies[0],
        { ...valid.dependencies[0], dependencyId: "dep:1", evidenceMappingRefs: ["mapping:1"] },
      ],
      evidenceMappings: [
        valid.evidenceMappings[0],
        { ...valid.evidenceMappings[0], mappingId: "mapping:1", providerRefId: "dep:1" },
      ],
    });
    const expected = [{ ...actualEdge, impactKind: "ROW_MEMBERSHIP" as const }];
    const result = compareSemanticGolden(duplicateFacts, expected);
    expect(result.status).toBe("PARTIAL");
    expect(result.missingEdges).toHaveLength(1);
    expect(result.unexpectedEdges).toEqual([actualEdge]);
    expect(result.duplicateEdges).toEqual([actualEdge]);
  });

  it("pins the reviewed side-aware and fieldless operator semantics", () => {
    expect(corpusGolden["04-left-join"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        dependencyKind: "JOIN_NULL_EXTENSION",
        impactKind: "NULL_EXTENSION",
        joinType: "LEFT",
        inputRoles: ["PRESERVED", "OPTIONAL"],
      }),
    ]));
    expect(corpusGolden["06-set-operations"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        operatorKind: "EXCEPT",
        inputRoles: ["CONTRIBUTING", "EXCLUDING"],
      }),
      expect.objectContaining({
        operatorKind: "INTERSECT",
        inputRoles: ["REQUIRED", "REQUIRED"],
      }),
    ]));
    expect(corpusGolden["07-exists-anti"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        dependencyKind: "FILTER_PREDICATE",
        from: [
          "table:app.customers#0.field:customer_id#0",
          "table:app.orders#0.field:customer_id#1",
        ],
      }),
    ]));
    expect(corpusGolden["08-literal-cross-join"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        dependencyKind: "JOIN_CARDINALITY",
        impactKind: "MULTIPLICITY",
        joinType: "CROSS",
        from: ["table:app.customers#0", "table:app.orders#0"],
      }),
      expect.objectContaining({
        dependencyKind: "RELATION_EXISTENCE",
        to: ["relation:project#0.field:flag#0"],
      }),
    ]));
  });

  it("pins one non-duplicated edge for each window role", () => {
    const windowEdges = corpusGolden["09-window"] ?? [];
    for (const kind of ["WINDOW_VALUE", "WINDOW_PARTITION", "WINDOW_ORDER", "WINDOW_FRAME"]) {
      expect(windowEdges.filter((edge) => edge.dependencyKind === kind)).toHaveLength(1);
    }
  });
});
