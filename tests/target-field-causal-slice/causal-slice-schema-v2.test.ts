import { describe, expect, it } from "vitest";

import {
  TARGET_FIELD_CAUSAL_SLICE_SCHEMA,
  TARGET_FIELD_CAUSAL_SLICE_SCHEMA_VERSION,
  validateCausalSliceArtifact,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-slice-contract.ts";

describe("target-field causal-slice schema 2.0 boundary", () => {
  it("rejects a stale 1.0 artifact as occurrence-unsafe without rewriting it", () => {
    const staleArtifact = {
      artifactType: "TARGET_FIELD_CAUSAL_SLICE",
      schemaVersion: "1.0.0",
      generatedAt: "2026-08-30T00:00:00Z",
      contentHash: "legacy-content-hash-must-remain-untouched",
      request: {
        rootTaskId: "task-root",
        rootTable: "demo.target",
        rootFields: ["hive|warehouse|target-table|demo.target|amount"],
        rootWriteObservationIds: ["write-observation:task-root:0"],
        negativeProofMode: "SAFE_RULES_ONLY",
      },
    };
    const before = JSON.stringify(staleArtifact);

    const errors = validateCausalSliceArtifact(staleArtifact);

    expect(TARGET_FIELD_CAUSAL_SLICE_SCHEMA_VERSION).toBe("2.0.0");
    expect(TARGET_FIELD_CAUSAL_SLICE_SCHEMA.schemaVersion).toBe("2.0.0");
    expect(errors).toContain("schemaVersion must be 2.0.0");
    expect(
      errors.some(
        (error) =>
          error.includes("1.0.0") &&
          /occurrence-unsafe|stale|regenerate/i.test(error),
      ),
    ).toBe(true);
    expect(JSON.stringify(staleArtifact)).toBe(before);
    expect(staleArtifact).not.toHaveProperty("rootCriteria");
    expect(staleArtifact).not.toHaveProperty("semanticScopes");
  });
});
