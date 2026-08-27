import { describe, expect, it } from "vitest";
import {
  reconcileCalciteResponse,
  reconcileDifferential,
} from "../scripts/calcite-oracle/reconciler.ts";
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
      tableOccurrences: { evaluated: true, values: [{ occurrenceId: "read-2" }] },
    } as const;
    const before = JSON.stringify({ native, calcite });
    const result = reconcileDifferential({ native, calcite });

    expect(JSON.stringify({ native, calcite })).toBe(before);
    expect(result.results.map(({ kind, status }) => `${kind}:${status}`)).toEqual([
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
        functionalDependencies: [{
          nodeId: "rel-1",
          determinant: ["ID"],
          dependent: ["VALUE"],
          source: "CALCITE_METADATA",
        }],
      },
    };
    const result = reconcileCalciteResponse(native, response);
    expect(result.sidecar).toEqual({ status: "SUCCESS", error: undefined });
    expect(result.results.find((item) => item.kind === "functionalDependencies")?.status)
      .toBe("CALCITE_ONLY_UNMAPPABLE");
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
    expect(result.results.map(({ kind, status }) => `${kind}:${status}`)).toEqual([
      "expressionLineage:NOT_EVALUATED",
      "predicates:NOT_EVALUATED",
      "uniqueKeys:NOT_EVALUATED",
      "functionalDependencies:NOT_EVALUATED",
      "tableOccurrences:NOT_EVALUATED",
      "rowCountCardinality:NOT_EVALUATED",
    ]);
    expect(result.results.find((item) => item.kind === "expressionLineage")?.nativeValues)
      .toEqual(native.expressionLineage?.values);
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
    expect(result.results.every((item) => item.status === "NOT_EVALUATED")).toBe(true);
    expect(result.results.find((item) => item.kind === "predicates")?.nativeValues)
      .toEqual(native.predicates?.values);
  });
});
