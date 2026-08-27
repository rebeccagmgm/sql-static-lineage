import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  reconcileCalciteResponse,
  reconcileDifferential,
} from "../scripts/calcite-oracle/reconciler.ts";
import { reconcileCalciteResponseWithSemanticMapping } from "../scripts/reconcile/consumer/target-field-causal-slice/calcite-semantic-mapping.ts";
import type {
  CalciteOracleResponse,
  DifferentialObservationSet,
} from "../scripts/calcite-oracle/protocol.ts";

const native: DifferentialObservationSet = {
  expressionLineage: { evaluated: true, values: [{ expression: "A + 1" }] },
  predicates: { evaluated: true, values: [{ predicate: "A > 0" }] },
  uniqueKeys: { evaluated: true, values: [{ columns: ["ID"] }] },
  functionalDependencies: { evaluated: false, values: [] },
  tableOccurrences: { evaluated: true, values: [{ occurrenceId: "read-1" }] },
  rowCountCardinality: { evaluated: false, values: [] },
};

describe("Calcite differential reconciler", () => {
  it("is deterministic and does not mutate either observation set", () => {
    const calcite = {
      expressionLineage: { evaluated: true, values: [{ expression: "A + 1" }] },
      predicates: { evaluated: true, values: [{ predicate: "A > 1" }] },
      uniqueKeys: { evaluated: false, values: [] },
      tableOccurrences: {
        evaluated: true,
        values: [{ occurrenceId: "read-2" }],
      },
    } as const;
    const before = JSON.stringify({ native, calcite });
    const result = reconcileDifferential({ native, calcite });

    expect(JSON.stringify({ native, calcite })).toBe(before);
    expect(
      result.results.map(({ kind, status }) => `${kind}:${status}`),
    ).toEqual([
      "expressionLineage:AGREED",
      "predicates:CONFLICT",
      "uniqueKeys:NATIVE_ONLY",
      "functionalDependencies:NOT_EVALUATED",
      "tableOccurrences:CONFLICT",
      "rowCountCardinality:NOT_EVALUATED",
    ]);
  });

  it("keeps Calcite-only observations explicitly unmappable", () => {
    const response: CalciteOracleResponse = {
      protocolVersion: 1,
      status: "SUCCESS",
      fingerprint: {
        tool: "calcite-offline-oracle",
        calciteVersion: "1.42.0",
        protocolVersion: 1,
        buildFingerprint: "test",
      },
      observations: {
        functionalDependencies: [
          {
            nodeId: "rel-1",
            determinant: ["ID"],
            dependent: ["VALUE"],
            source: "CALCITE_METADATA",
          },
        ],
      },
    };
    const result = reconcileCalciteResponse(native, response);
    expect(result.sidecar).toEqual({ status: "SUCCESS", error: undefined });
    expect(
      result.results.find((item) => item.kind === "functionalDependencies")
        ?.status,
    ).toBe("CALCITE_ONLY_UNMAPPABLE");
    expect(result.fingerprint?.calciteVersion).toBe("1.42.0");
  });

  it("does not evaluate a failed or unsupported sidecar", () => {
    const response: CalciteOracleResponse = {
      protocolVersion: 1,
      status: "UNSUPPORTED",
      fingerprint: {
        tool: "calcite-offline-oracle",
        calciteVersion: "1.42.0",
        protocolVersion: 1,
        buildFingerprint: "test",
      },
      error: { code: "UNSUPPORTED_SQL", message: "fixture subset only" },
    };
    const result = reconcileCalciteResponse(native, response);
    expect(result.sidecar).toEqual({
      status: "UNSUPPORTED",
      error: { code: "UNSUPPORTED_SQL", message: "fixture subset only" },
    });
    expect(
      result.results.map(({ kind, status }) => `${kind}:${status}`),
    ).toEqual([
      "expressionLineage:NOT_EVALUATED",
      "predicates:NOT_EVALUATED",
      "uniqueKeys:NOT_EVALUATED",
      "functionalDependencies:NOT_EVALUATED",
      "tableOccurrences:NOT_EVALUATED",
      "rowCountCardinality:NOT_EVALUATED",
    ]);
    expect(
      result.results.find((item) => item.kind === "expressionLineage")
        ?.nativeValues,
    ).toEqual(native.expressionLineage?.values);
  });

  it("preserves a failed sidecar and its error separately from observations", () => {
    const response: CalciteOracleResponse = {
      protocolVersion: 1,
      status: "FAILED",
      fingerprint: {
        tool: "calcite-offline-oracle",
        calciteVersion: "1.42.0",
        protocolVersion: 1,
        buildFingerprint: "test",
      },
      error: { code: "PLANNER_FAILURE", message: "cannot validate query" },
    };

    const result = reconcileCalciteResponse(native, response);
    expect(result.sidecar).toEqual({
      status: "FAILED",
      error: { code: "PLANNER_FAILURE", message: "cannot validate query" },
    });
    expect(
      result.results.every((item) => item.status === "NOT_EVALUATED"),
    ).toBe(true);
    expect(
      result.results.find((item) => item.kind === "predicates")?.nativeValues,
    ).toEqual(native.predicates?.values);
  });

  it("does not turn a real Calcite metadata response into a mapped causal result", () => {
    const response: CalciteOracleResponse = {
      protocolVersion: 1,
      requestId: "209119-real-probe",
      status: "FAILED",
      fingerprint: {
        tool: "calcite-offline-oracle",
        calciteVersion: "1.42.0",
        protocolVersion: 1,
        buildFingerprint:
          "calcite-offline-oracle/0.1.0;calcite/1.42.0;protocol/1",
      },
      error: {
        code: "PLANNER_FAILURE",
        message:
          "Incorrect syntax near the keyword CONDITION in the 209119 query.",
      },
    };
    const mapped = reconcileCalciteResponseWithSemanticMapping({
      nativeBatches: [],
      response,
    });

    expect(mapped.results).toEqual([]);
    expect(
      mapped.batches.every((batch) => batch.status === "NOT_EVALUATED"),
    ).toBe(true);
    expect(mapped.fingerprint?.calciteVersion).toBe("1.42.0");
  });

  it("keeps the recorded 209119 probe explicitly NO_GO and decision-free", () => {
    const evidence = JSON.parse(
      readFileSync(
        "tests/fixtures/target-field-causal-slice/calcite-differential/209119-no-go.json",
        "utf8",
      ),
    ) as {
      readonly status: string;
      readonly evaluation: string;
      readonly reason: { readonly code: string };
      readonly inputFingerprint: string;
      readonly nativeFingerprint: string;
      readonly calciteVersion: string;
      readonly mappingReport?: unknown;
      readonly assessments?: unknown;
      readonly rerunSets?: unknown;
    };

    expect(evidence.status).toBe("NO_GO");
    expect(evidence.evaluation).toBe("NOT_EVALUATED");
    expect(evidence.reason.code).toBe("PLANNER_FAILURE");
    expect(evidence.calciteVersion).toBe("1.42.0");
    expect(evidence.inputFingerprint).toBe(
      "ec4e5337c676f6675244f668603d9e66d24e4a16b4fe5153c120779a25f76bf5",
    );
    expect(evidence.nativeFingerprint).toBe(
      "eaacf4fa15f5ce6e9d15a1c3e739043ab3483d3ebc62645311f57da24f9dc430",
    );
    expect(evidence).not.toHaveProperty("mappingReport");
    expect(evidence).not.toHaveProperty("assessments");
    expect(evidence).not.toHaveProperty("rerunSets");
  });
});
