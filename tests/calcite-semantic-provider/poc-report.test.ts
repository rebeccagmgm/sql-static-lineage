import { describe, expect, it } from "vitest";
import { decideProvider } from "../../scripts/calcite-semantic-provider/poc-report.ts";

describe("Calcite semantic provider POC decision", () => {
  it("requires exact Native evidence mapping for a direct-provider decision", () => {
    expect(decideProvider({
      corpusPassed: true,
      realStatus: "SUCCESS",
      dependencyCount: 20,
      evaluatedDependencyCount: 20,
      exactMappingCount: 0,
      boundedDialectTransformCount: 0,
      fullEvidenceClosureStatus: "NOT_ASSEMBLED",
    })).toBe("VALIDATION_ONLY");
    expect(decideProvider({
      corpusPassed: true,
      realStatus: "SUCCESS",
      dependencyCount: 20,
      evaluatedDependencyCount: 20,
      exactMappingCount: 20,
      boundedDialectTransformCount: 0,
      fullEvidenceClosureStatus: "EXACT",
    })).toBe("DIRECT_PROVIDER");
    expect(decideProvider({
      corpusPassed: true,
      realStatus: "SUCCESS",
      dependencyCount: 20,
      evaluatedDependencyCount: 20,
      exactMappingCount: 20,
      boundedDialectTransformCount: 2,
      fullEvidenceClosureStatus: "EXACT",
    })).toBe("THIN_ADAPTER_REQUIRED");
  });

  it("does not convert unsupported or failed real SQL into a positive provider decision", () => {
    expect(decideProvider({
      corpusPassed: true,
      realStatus: "UNSUPPORTED",
      dependencyCount: 0,
      evaluatedDependencyCount: 0,
      exactMappingCount: 0,
      boundedDialectTransformCount: 0,
      fullEvidenceClosureStatus: "NOT_ASSEMBLED",
    })).toBe("VALIDATION_ONLY");
    expect(decideProvider({
      corpusPassed: false,
      realStatus: "ERROR",
      dependencyCount: 0,
      evaluatedDependencyCount: 0,
      exactMappingCount: 0,
      boundedDialectTransformCount: 0,
      fullEvidenceClosureStatus: "NOT_ASSEMBLED",
    })).toBe("NO_GO");
  });

  it("requires full semantic-edge verification instead of dependency-kind coverage", () => {
    expect(decideProvider({
      corpusPassed: false,
      realStatus: "SUCCESS",
      dependencyCount: 20,
      evaluatedDependencyCount: 20,
      exactMappingCount: 20,
      boundedDialectTransformCount: 0,
      fullEvidenceClosureStatus: "EXACT",
    })).toBe("NO_GO");
  });

  it("keeps exact dependency endpoints validation-only until full evidence closure exists", () => {
    expect(decideProvider({
      corpusPassed: true,
      realStatus: "SUCCESS",
      dependencyCount: 20,
      evaluatedDependencyCount: 20,
      exactMappingCount: 20,
      boundedDialectTransformCount: 2,
      fullEvidenceClosureStatus: "NOT_ASSEMBLED",
    })).toBe("VALIDATION_ONLY");
  });
});
