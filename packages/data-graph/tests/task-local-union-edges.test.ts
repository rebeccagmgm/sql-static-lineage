import { describe, expect, it } from "vitest";

import {
  TASK_LOCAL_UNION_DERIVED_EDGE_TYPES,
  TASK_LOCAL_UNION_LOCAL_EDGE_TYPES,
  isTaskLocalUnionDerivedEdgeType,
  isTaskLocalUnionLocalEdgeType,
} from "../src/project-graph/topology/task-local-union/task-local-union-edges.ts";

describe("TASK_LOCAL_UNION edge vocabulary (TU-3)", () => {
  it("freezes WP-3 local edge types without MATERIALIZES", () => {
    expect([...TASK_LOCAL_UNION_LOCAL_EDGE_TYPES].sort()).toEqual([
      "DATASET_CONTROL",
      "FIELD_CONDITIONAL",
      "FIELD_DIRECT",
      "READS",
      "WRITES",
    ]);
    expect(isTaskLocalUnionLocalEdgeType("MATERIALIZES")).toBe(false);
    expect(isTaskLocalUnionLocalEdgeType("WRITES")).toBe(true);
  });

  it("keeps derived PRODUCER_BRIDGE / SCHEDULE_DEPENDS_ON separable", () => {
    expect([...TASK_LOCAL_UNION_DERIVED_EDGE_TYPES].sort()).toEqual([
      "PRODUCER_BRIDGE",
      "SCHEDULE_DEPENDS_ON",
    ]);
    expect(isTaskLocalUnionDerivedEdgeType("PRODUCER_BRIDGE")).toBe(true);
    expect(isTaskLocalUnionLocalEdgeType("PRODUCER_BRIDGE")).toBe(false);
  });
});
