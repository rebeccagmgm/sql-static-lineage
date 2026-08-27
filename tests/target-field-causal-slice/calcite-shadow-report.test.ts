import { describe, expect, it } from "vitest";
import { cloneBatches, nativeBatchFixtures } from "../fixtures/target-field-causal-slice/calcite-differential/batches.ts";
import {
  buildCalciteSemanticShadowReport,
  validateCalciteSemanticShadowReport,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/calcite-shadow-report.ts";
import { reconcileCalciteSemanticBatches } from "../../scripts/reconcile/consumer/target-field-causal-slice/calcite-semantic-mapping.ts";

function reportFor(
  batches = nativeBatchFixtures,
  artifactValidationSummary = { status: "VALID" as const },
) {
  return buildCalciteSemanticShadowReport({
    mappingReport: reconcileCalciteSemanticBatches(batches),
    inputFingerprint: "input-fixture",
    nativeFingerprint: "native-fixture",
    calciteFingerprint: {
      tool: "calcite-offline-oracle",
      calciteVersion: "1.42.0",
      protocolVersion: 1,
      buildFingerprint: "calcite-fixture",
    },
    artifactValidationSummary,
  });
}

describe("Calcite semantic shadow report", () => {
  it("projects exact Native/Calcite matches as AGREED and gates them GO", () => {
    const report = reportFor();

    expect(report.artifactType).toBe("CALCITE_SEMANTIC_SHADOW_REPORT");
    expect(report.observations).toHaveLength(23);
    expect(report.observations.every((observation) => observation.status === "AGREED")).toBe(true);
    expect(report.releaseGates.overall).toBe("GO");
    expect(report.releaseGates.occurrenceMapping.status).toBe("GO");
    expect(report.releaseGates.fieldMapping.status).toBe("GO");
    expect(report.releaseGates.operatorMapping.status).toBe("GO");
    expect(report.releaseGates.sourceEvidenceMapping.status).toBe("GO");
    expect(report.releaseGates.supportedCorpusAgreement.status).toBe("GO");
    expect(validateCalciteSemanticShadowReport(report)).toEqual([]);
  });

  it("retains an unsupported sidecar reason as NOT_EVALUATED", () => {
    const mapping = reconcileCalciteSemanticBatches(
      nativeBatchFixtures.map((batch) => ({
        ...batch,
        calcite: undefined,
        calciteStatus: "UNSUPPORTED" as const,
        calciteReason: {
          code: "UNSUPPORTED_HIVE_OPERATOR",
          message: "The operator is outside the supported Calcite subset.",
        },
      })),
    );
    const report = buildCalciteSemanticShadowReport({ mappingReport: mapping });

    expect(report.observations.every((observation) => observation.status === "NOT_EVALUATED")).toBe(true);
    expect(report.observations.every((observation) => observation.reason?.code === "UNSUPPORTED_HIVE_OPERATOR")).toBe(true);
    expect(report.releaseGates.overall).toBe("NOT_EVALUATED");
  });

  it("keeps Calcite-only observations unmappable and out of any decision surface", () => {
    const batches = cloneBatches();
    const calcite = batches[0]!.calcite![0]!;
    batches[0] = { ...batches[0]!, calcite: [{ ...calcite, relationOccurrenceId: "calcite-only" }] };
    const report = reportFor(batches);
    const unmappable = report.observations.find((observation) => observation.status === "CALCITE_ONLY_UNMAPPABLE")!;

    expect(unmappable.mappingStatus.occurrence).toBe("UNMAPPABLE");
    expect(unmappable.nativeObservationIds).toEqual([]);
    expect(report.releaseGates.overall).toBe("NO_GO");
    expect(report).not.toHaveProperty("dependencies");
    expect(report).not.toHaveProperty("assessments");
    expect(report).not.toHaveProperty("negativeProofs");
    expect(report).not.toHaveProperty("rerunSets");
    expect(report).not.toHaveProperty("proofs");
  });

  it("turns a semantic conflict into NO_GO and an advisory Unknown only", () => {
    const batches = cloneBatches();
    const calcite = batches[0]!.calcite![0]!;
    batches[0] = { ...batches[0]!, calcite: [{ ...calcite, value: ["different"] }] };
    const report = reportFor(batches);
    const conflict = report.observations.find((observation) => observation.status === "CONFLICT")!;

    expect(conflict.nativeObservationIds).toEqual(["calcite-expression"]);
    expect(conflict.calciteObservationIds).toEqual(["calcite-expression"]);
    expect(report.releaseGates.overall).toBe("NO_GO");
    expect(report.releaseGates.supportedCorpusAgreement.status).toBe("NO_GO");
    expect(report.validationSummary).toMatchObject({
      advisoryOnly: true,
      status: "UNKNOWN",
      reasonCodes: ["SEMANTIC_ENGINE_CONFLICT"],
    });
  });

  it("has an order-independent canonical hash and preserves decision isolation", () => {
    const reversed = [...nativeBatchFixtures].reverse().map((batch) => ({
      ...batch,
      observations: [...batch.observations].reverse(),
      calcite: [...(batch.calcite ?? [])].reverse(),
    }));
    const first = reportFor();
    const second = reportFor(reversed);
    expect(second.contentHash).toBe(first.contentHash);
    expect(second).toEqual(first);
    expect(validateCalciteSemanticShadowReport(second)).toEqual([]);
    expect(second.decisionIsolation).toEqual({
      canonicalDependencies: "NOT_INCLUDED",
      assessments: "NOT_INCLUDED",
      negativeProofs: "NOT_INCLUDED",
      rerunSets: "NOT_INCLUDED",
      canonicalArtifactsMutated: false,
    });
  });
});
