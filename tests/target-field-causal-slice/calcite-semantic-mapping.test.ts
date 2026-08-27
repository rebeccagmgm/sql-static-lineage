import { describe, expect, it } from "vitest";
import type {
  CalciteOracleResponse,
  CalciteSemanticObservation,
} from "../../scripts/calcite-oracle/protocol.ts";
import {
  cloneBatches,
  nativeBatchFixtures,
} from "../fixtures/target-field-causal-slice/calcite-differential/batches.ts";
import {
  reconcileCalciteResponseWithSemanticMapping,
  reconcileCalciteSemanticBatches,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/calcite-semantic-mapping.ts";

describe("Calcite semantic mapping", () => {
  it("covers every current Native operator batch with exact corroboration", () => {
    const report = reconcileCalciteSemanticBatches(nativeBatchFixtures);

    expect(report.batches.map(({ batch, status }) => `${batch}:${status}`)).toEqual([
      "EXPRESSION_CONTROLS:CALCITE_CORROBORATED",
      "FILTERS_AND_JOINS:CALCITE_CORROBORATED",
      "AGGREGATE_GROUPING_DISTINCT_SETOP:CALCITE_CORROBORATED",
      "WINDOW_TOP_N:CALCITE_CORROBORATED",
      "RELATION_CONTEXT:CALCITE_CORROBORATED",
    ]);
    expect(report.results).toHaveLength(23);
    expect(report.results.every((result) => result.reason === undefined)).toBe(true);
  });

  it("requires exact occurrence, ordinal, operator, and source evidence", () => {
    const batches = cloneBatches();
    const expression = batches[0]!.calcite![0]!;
    const mismatched: CalciteSemanticObservation = {
      ...expression,
      relationOccurrenceId: "different-read",
      outputOrdinal: 1,
      sourceEvidence: {
        ...expression.sourceEvidence,
        canonicalSource: "CASE WHEN s THEN a ELSE c END",
      },
    };
    batches[0] = { ...batches[0]!, calcite: [mismatched] };

    const report = reconcileCalciteSemanticBatches(batches);
    const expressionResults = report.batches[0]!.results;
    expect(expressionResults.some((result) => result.status === "NATIVE_CONFIRMED")).toBe(true);
    expect(expressionResults.some((result) => result.status === "CALCITE_ONLY_UNMAPPABLE")).toBe(true);
    expect(
      expressionResults.find((result) => result.status === "CALCITE_ONLY_UNMAPPABLE")?.reason,
    ).toMatchObject({ code: "NO_EXACT_NATIVE_OBSERVATION" });
  });

  it("preserves both observations when an exact semantic identity conflicts", () => {
    const batches = cloneBatches();
    const calcite = batches[0]!.calcite![0]!;
    batches[0] = {
      ...batches[0]!,
      calcite: [{ ...calcite, value: ["different-value"] }],
    };

    const result = reconcileCalciteSemanticBatches(batches).batches[0]!.results.find(
      (candidate) => candidate.status === "SEMANTIC_ENGINE_CONFLICT",
    )!;
    expect(result.status).toBe("SEMANTIC_ENGINE_CONFLICT");
    expect(result.nativeObservations).toHaveLength(1);
    expect(result.calciteObservations).toHaveLength(1);
    expect(result.nativeValues).toEqual([["field:demo.source:a"]]);
    expect(result.calciteValues).toEqual([["different-value"]]);
    expect(result.conflict).toEqual({
      nativeOnly: [["field:demo.source:a"]],
      calciteOnly: [["different-value"]],
    });
    expect(result.reason).toMatchObject({ code: "SEMANTIC_ENGINE_CONFLICT" });
  });

  it("maps a Calcite occurrence through an explicit exact occurrence mapping", () => {
    const batches = cloneBatches();
    const calcite = batches[0]!.calcite![0]!;
    batches[0] = {
      ...batches[0]!,
      calcite: [{ ...calcite, relationOccurrenceId: "calcite-scan-0" }],
      occurrenceMappings: [{
        calciteRelationOccurrenceId: "calcite-scan-0",
        nativeRelationOccurrenceId: "read-expression",
      }],
    };

    const result = reconcileCalciteSemanticBatches(batches).batches[0]!.results[0]!;
    expect(result.status).toBe("CALCITE_CORROBORATED");
    expect(result.calciteObservationIds).toEqual(["calcite-expression"]);
  });

  it("marks an unsupported operator as NOT_EVALUATED with a reason", () => {
    const batches = cloneBatches();
    const calcite = batches[0]!.calcite![0]!;
    batches[0] = {
      ...batches[0]!,
      calcite: [{ ...calcite, operatorVariant: "DECODE" }],
    };

    const results = reconcileCalciteSemanticBatches(batches).batches[0]!.results;
    const unsupported = results.find((result) => result.calciteObservationIds.length > 0 && result.status === "NOT_EVALUATED");
    expect(unsupported?.reason).toMatchObject({ code: "UNSUPPORTED_OPERATOR_FOR_BATCH" });
  });

  it("reports an explicit reason for an unsupported Calcite sidecar", () => {
    const response: CalciteOracleResponse = {
      protocolVersion: 1,
      status: "UNSUPPORTED",
      fingerprint: {
        tool: "calcite-offline-oracle",
        calciteVersion: "1.42.0",
        protocolVersion: 1,
        buildFingerprint: "fixture",
      },
      error: {
        code: "UNSUPPORTED_HIVE_OPERATOR",
        message: "This Hive operator is outside the Calcite fixture subset.",
      },
    };
    const report = reconcileCalciteResponseWithSemanticMapping({
      nativeBatches: nativeBatchFixtures,
      response,
    });

    expect(report.batches.every((batch) => batch.status === "NOT_EVALUATED")).toBe(true);
    expect(report.batches.every((batch) => batch.reason)).toBe(true);
    expect(report.batches[0]!.reason).toEqual(response.error);
    expect(report.results.every((result) => result.status === "NOT_EVALUATED")).toBe(true);
    expect(report.results.every((result) => result.reason?.code === response.error?.code)).toBe(true);
  });

  it("does not turn a successful response without semantic observations into an empty agreement", () => {
    const response: CalciteOracleResponse = {
      protocolVersion: 1,
      status: "SUCCESS",
      fingerprint: {
        tool: "calcite-offline-oracle",
        calciteVersion: "1.42.0",
        protocolVersion: 1,
        buildFingerprint: "fixture",
      },
      observations: {},
    };
    const report = reconcileCalciteResponseWithSemanticMapping({
      nativeBatches: nativeBatchFixtures,
      response,
    });

    expect(report.batches.every((batch) => batch.status === "NOT_EVALUATED")).toBe(true);
    expect(report.batches[0]!.reason).toMatchObject({
      code: "CALCITE_BATCH_OBSERVATIONS_MISSING",
    });
  });

  it("keeps absent Native batches explicit", () => {
    const report = reconcileCalciteSemanticBatches(nativeBatchFixtures.slice(0, 1));
    expect(report.batches.slice(1).map(({ status, reason }) => ({ status, reason: reason?.code }))).toEqual([
      { status: "NOT_EVALUATED", reason: "NATIVE_BATCH_NOT_PROVIDED" },
      { status: "NOT_EVALUATED", reason: "NATIVE_BATCH_NOT_PROVIDED" },
      { status: "NOT_EVALUATED", reason: "NATIVE_BATCH_NOT_PROVIDED" },
      { status: "NOT_EVALUATED", reason: "NATIVE_BATCH_NOT_PROVIDED" },
    ]);
  });
});
