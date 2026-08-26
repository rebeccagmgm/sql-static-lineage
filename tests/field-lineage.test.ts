import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { runInputPackMachineFacts } from "../scripts/machine-facts/input-pack-machine-facts.ts";
import {
  canonicalizeFieldLineageArtifact,
  validateFieldLineageArtifact,
} from "../scripts/reconcile/consumer/field-lineage/field-lineage-contract.ts";
import { reconcileFieldLineage } from "../scripts/reconcile/consumer/field-lineage/field-lineage.ts";
import { formatFieldLineageSummary } from "../scripts/reconcile/consumer/field-lineage/format-field-lineage.ts";
import {
  createSyntheticFieldLineageInputPack,
  syntheticTableLineage,
} from "./fixtures/field-lineage/cases.ts";

function fixture() {
  const parent = mkdtempSync(join(tmpdir(), "field-lineage-"));
  const dataRoot = join(parent, "data");
  const factsRoot = join(parent, "facts");
  createSyntheticFieldLineageInputPack(dataRoot);
  runInputPackMachineFacts({
    dataRoot,
    taskIds: ["100", "200", "300", "400"],
    outputRoot: factsRoot,
  });
  return { dataRoot, factsRoot };
}

describe("field multi-hop lineage", () => {
  it("publishes the versioned canonical JSON Schema", () => {
    const schema = JSON.parse(
      readFileSync(
        resolve("schemas/field-multi-hop-reconciliation.schema.json"),
        "utf8",
      ),
    );
    expect(schema.properties.artifactType.const).toBe(
      "FIELD_MULTI_HOP_RECONCILIATION",
    );
    expect(schema.properties.schemaVersion.const).toBe("1.0.0");
    expect(schema.$defs.physicalField.properties.identityStatus.enum).toEqual([
      "SCHEMA_BACKED",
      "TASK_LOCAL_SCHEMA_BACKED",
    ]);
  });
  it("recurses primary only, annotates rowset control, and preserves gaps", () => {
    const f = fixture();
    const artifact = reconcileFieldLineage({
      dataRoot: f.dataRoot,
      factsRoot: f.factsRoot,
      tableLineage: syntheticTableLineage(),
      rootTaskId: "100",
      rootTable: "demo.root",
      rootFields: ["out_a"],
      factsPolicy: "allow-legacy-partial",
      maxDepth: 8,
      maxStates: 100,
      maxPaths: 100,
    });
    expect(artifact.overallStatus).toBe("PARTIAL");
    expect(artifact.edges.some((edge) => edge.producerTaskId === "200")).toBe(
      true,
    );
    expect(artifact.edges.some((edge) => edge.producerTaskId === "300")).toBe(
      true,
    );
    expect(artifact.edges.some((edge) => edge.producerTaskId === "400")).toBe(
      false,
    );
    expect(
      artifact.candidates.some(
        (candidate) => candidate.producerTaskId === "400",
      ),
    ).toBe(true);
    expect(
      artifact.gaps.some(
        (gap) =>
          gap.taskId === "500" && gap.reasonCode === "TASK_INPUT_PACK_EXCLUDED",
      ),
    ).toBe(true);
    expect(artifact.gaps.some((gap) => gap.reasonCode === "CYCLE")).toBe(true);
    expect(
      artifact.rowsetControls.some(
        (control) => control.controlType === "filter",
      ),
    ).toBe(true);
    expect(validateFieldLineageArtifact(artifact)).toEqual([]);
    const summary = formatFieldLineageSummary(artifact);
    expect(summary).toContain("字段 VALUE_FLOW Task 树");
    expect(summary).toContain("ROWSET_CONTROL");
  });

  it("blocks legacy facts under the default current-only policy", () => {
    const f = fixture();
    const artifact = reconcileFieldLineage({
      dataRoot: f.dataRoot,
      factsRoot: f.factsRoot,
      tableLineage: syntheticTableLineage(),
      rootTaskId: "100",
      rootTable: "demo.root",
      rootFields: ["out_a"],
      factsPolicy: "current-only",
      maxDepth: 8,
      maxStates: 100,
      maxPaths: 100,
    });
    expect(artifact.overallStatus).toBe("BLOCKED");
    expect(
      artifact.gaps.some(
        (gap) => gap.reasonCode === "LEGACY_FACTS_NOT_ALLOWED",
      ),
    ).toBe(true);
    expect(
      artifact.nodes.every(
        (node) => node.evidenceStatus !== "PROVISIONAL_LEGACY",
      ),
    ).toBe(true);
  });

  it("is deterministic and rejects COMPLETE artifacts with legacy evidence", () => {
    const f = fixture();
    const options = {
      dataRoot: f.dataRoot,
      factsRoot: f.factsRoot,
      tableLineage: syntheticTableLineage(),
      rootTaskId: "100",
      rootTable: "demo.root",
      rootFields: ["out_a"],
      factsPolicy: "allow-legacy-partial" as const,
      maxDepth: 8,
      maxStates: 100,
      maxPaths: 100,
    };
    const left = reconcileFieldLineage(options);
    const right = reconcileFieldLineage(options);
    expect(right).toEqual(left);
    const invalid = { ...left, overallStatus: "COMPLETE" };
    expect(validateFieldLineageArtifact(invalid).join(" ")).toMatch(
      /COMPLETE cannot contain/,
    );
    expect(() =>
      canonicalizeFieldLineageArtifact({
        ...invalid,
        contentHash: undefined,
      } as never),
    ).toThrow();
  });

  it("rejects a root field missing from Schema", () => {
    const f = fixture();
    expect(() =>
      reconcileFieldLineage({
        dataRoot: f.dataRoot,
        factsRoot: f.factsRoot,
        tableLineage: syntheticTableLineage(),
        rootTaskId: "100",
        rootTable: "demo.root",
        rootFields: ["guessed_name"],
        factsPolicy: "allow-legacy-partial",
        maxDepth: 8,
        maxStates: 100,
        maxPaths: 100,
      }),
    ).toThrow(/ROOT_FIELD_NOT_IN_SCHEMA/);
  });

  it("keeps unknown producers and source fields without Schema as unresolved", () => {
    const f = fixture();
    runInputPackMachineFacts({
      dataRoot: f.dataRoot,
      taskIds: ["700"],
      outputRoot: f.factsRoot,
    });
    const tableLineage = {
      ...syntheticTableLineage(),
      rootTaskId: "700",
      taskNodes: [
        {
          taskId: "700",
          upstreamDecision: { primary: [], additional: [], unknown: ["999"] },
        },
      ],
      producerBridges: [],
    };
    const artifact = reconcileFieldLineage({
      dataRoot: f.dataRoot,
      factsRoot: f.factsRoot,
      tableLineage,
      rootTaskId: "700",
      rootTable: "demo.root",
      rootFields: ["out_a", "out_b"],
      factsPolicy: "allow-legacy-partial",
      maxDepth: 8,
      maxStates: 100,
      maxPaths: 100,
    });
    expect(artifact.rootNodeIds).toHaveLength(2);
    expect(
      artifact.gaps.some(
        (gap) =>
          gap.reasonCode === "SOURCE_FIELD_SCHEMA_UNVERIFIED" ||
          gap.reasonCode === "PHYSICAL_FIELD_UNRESOLVED",
      ),
    ).toBe(true);
    expect(artifact.edges.some((edge) => edge.producerTaskId === "999")).toBe(
      false,
    );
  });

  it("does not attach unrelated table-level unknowns to a field value path", () => {
    const f = fixture();
    const base = syntheticTableLineage();
    const artifact = reconcileFieldLineage({
      dataRoot: f.dataRoot,
      factsRoot: f.factsRoot,
      tableLineage: {
        ...base,
        taskNodes: base.taskNodes.map((node) =>
          node.taskId === "100"
            ? {
                ...node,
                upstreamDecision: {
                  ...node.upstreamDecision,
                  unknown: ["400"],
                },
              }
            : node,
        ),
      },
      rootTaskId: "100",
      rootTable: "demo.root",
      rootFields: ["out_a"],
      factsPolicy: "allow-legacy-partial",
      maxDepth: 8,
      maxStates: 100,
      maxPaths: 100,
    });

    expect(
      artifact.tableEdges.some(
        (edge) =>
          edge.consumerTaskId === "100" &&
          edge.producerTaskId === "400" &&
          edge.classification === "UNKNOWN",
      ),
    ).toBe(true);
    expect(
      artifact.gaps.some(
        (gap) => gap.reasonCode === "ONE_HOP_UPSTREAM_UNKNOWN",
      ),
    ).toBe(false);
  });

  it("stops a table-level unknown only when it matches the current physical source", () => {
    const f = fixture();
    const base = syntheticTableLineage();
    const artifact = reconcileFieldLineage({
      dataRoot: f.dataRoot,
      factsRoot: f.factsRoot,
      tableLineage: {
        ...base,
        rootTaskId: "200",
        taskNodes: [
          {
            taskId: "200",
            upstreamDecision: {
              primary: [],
              additional: [],
              unknown: ["400"],
            },
          },
        ],
      },
      rootTaskId: "200",
      rootTable: "demo.mid",
      rootFields: ["mid_a"],
      factsPolicy: "allow-legacy-partial",
      maxDepth: 8,
      maxStates: 100,
      maxPaths: 100,
    });

    expect(
      artifact.gaps.some(
        (gap) =>
          gap.reasonCode === "ONE_HOP_UPSTREAM_UNKNOWN" &&
          gap.taskId === "400" &&
          gap.field?.qualifiedName === "demo.source",
      ),
    ).toBe(true);
    expect(
      artifact.candidates.some(
        (candidate) =>
          candidate.consumerTaskId === "200" &&
          candidate.producerTaskId === "400" &&
          candidate.reasonCode === "ONE_HOP_UNKNOWN_NOT_RECURSED",
      ),
    ).toBe(true);
    expect(artifact.edges.some((edge) => edge.producerTaskId === "400")).toBe(
      false,
    );
  });

  it("deduplicates a relevant unknown across repeated bindings of the same physical field", () => {
    const f = fixture();
    runInputPackMachineFacts({
      dataRoot: f.dataRoot,
      taskIds: ["900"],
      outputRoot: f.factsRoot,
    });
    const artifact = reconcileFieldLineage({
      dataRoot: f.dataRoot,
      factsRoot: f.factsRoot,
      tableLineage: {
        ...syntheticTableLineage(),
        rootTaskId: "900",
        taskNodes: [
          {
            taskId: "900",
            upstreamDecision: {
              primary: [],
              additional: [],
              unknown: ["1100"],
            },
          },
        ],
        producerBridges: [
          {
            consumerTaskId: "900",
            producerTaskId: "1100",
            table: {
              platform: "hive",
              dataSource: "warehouse",
              qualifiedName: "demo.extra",
            },
          },
        ],
      },
      rootTaskId: "900",
      rootTable: "demo.root",
      rootFields: ["out_a"],
      factsPolicy: "allow-legacy-partial",
      maxDepth: 8,
      maxStates: 100,
      maxPaths: 100,
    });

    expect(
      artifact.gaps.filter(
        (gap) =>
          gap.reasonCode === "ONE_HOP_UPSTREAM_UNKNOWN" &&
          gap.taskId === "1100",
      ),
    ).toHaveLength(1);
  });

  it("branches traversal state by output binding when a Task writes the same field more than once", () => {
    const f = fixture();
    runInputPackMachineFacts({
      dataRoot: f.dataRoot,
      taskIds: ["900"],
      outputRoot: f.factsRoot,
    });
    const artifact = reconcileFieldLineage({
      dataRoot: f.dataRoot,
      factsRoot: f.factsRoot,
      tableLineage: {
        ...syntheticTableLineage(),
        rootTaskId: "900",
        taskNodes: [
          {
            taskId: "900",
            upstreamDecision: { primary: [], additional: [], unknown: [] },
          },
        ],
        producerBridges: [],
      },
      rootTaskId: "900",
      rootTable: "demo.root",
      rootFields: ["out_a"],
      factsPolicy: "allow-legacy-partial",
      maxDepth: 8,
      maxStates: 100,
      maxPaths: 100,
    });
    expect(artifact.rootNodeIds).toHaveLength(2);
    expect(
      new Set(
        artifact.rootNodeIds.map(
          (id) => artifact.nodes.find((node) => node.nodeId === id)?.bindingId,
        ),
      ).size,
    ).toBe(2);
    expect(
      artifact.gaps.some(
        (gap) => gap.reasonCode === "OUTPUT_FIELD_BINDING_NOT_PROVABLE",
      ),
    ).toBe(false);
    expect(validateFieldLineageArtifact(artifact)).toEqual([]);
  });

  it("surfaces an excluded schedule-fallback parent when one eligible read makes the stop unambiguous", () => {
    const f = fixture();
    const artifact = reconcileFieldLineage({
      dataRoot: f.dataRoot,
      factsRoot: f.factsRoot,
      tableLineage: {
        ...syntheticTableLineage(),
        rootTaskId: "200",
        taskNodes: [
          {
            taskId: "200",
            upstreamDecision: { primary: ["500"], additional: [], unknown: [] },
          },
        ],
        producerBridges: [],
        scheduleEdges: [{ consumerTaskId: "200", producerTaskId: "500" }],
        readEdges: [
          {
            consumerTaskId: "200",
            recursionStatus: "ELIGIBLE",
            table: {
              platform: "hive",
              dataSource: "warehouse",
              qualifiedName: "demo.source",
            },
          },
        ],
      },
      rootTaskId: "200",
      rootTable: "demo.mid",
      rootFields: ["mid_a"],
      factsPolicy: "allow-legacy-partial",
      maxDepth: 8,
      maxStates: 100,
      maxPaths: 100,
    });
    expect(
      artifact.gaps.some(
        (gap) =>
          gap.taskId === "500" && gap.reasonCode === "TASK_INPUT_PACK_EXCLUDED",
      ),
    ).toBe(true);
    expect(artifact.edges.some((edge) => edge.producerTaskId === "500")).toBe(
      false,
    );
  });

  it("stitches Task-local CTAS fields across Input Pack SQL slots without exposing them as cross-Task identities", () => {
    const f = fixture();
    runInputPackMachineFacts({
      dataRoot: f.dataRoot,
      taskIds: ["1000"],
      outputRoot: f.factsRoot,
    });
    const artifact = reconcileFieldLineage({
      dataRoot: f.dataRoot,
      factsRoot: f.factsRoot,
      tableLineage: {
        ...syntheticTableLineage(),
        rootTaskId: "1000",
        taskNodes: [
          {
            taskId: "1000",
            upstreamDecision: { primary: [], additional: [], unknown: [] },
          },
        ],
        producerBridges: [],
      },
      rootTaskId: "1000",
      rootTable: "demo.root",
      rootFields: ["out_a"],
      factsPolicy: "allow-legacy-partial",
      maxDepth: 8,
      maxStates: 100,
      maxPaths: 100,
    });
    expect(
      artifact.nodes.some(
        (node) =>
          node.field.identityStatus === "TASK_LOCAL_SCHEMA_BACKED" &&
          node.field.qualifiedName === "temp.local_stage",
      ),
    ).toBe(true);
    expect(
      artifact.nodes.some(
        (node) =>
          node.field.identityStatus === "TASK_LOCAL_SCHEMA_BACKED" &&
          node.field.qualifiedName === "temp.mid_stage",
      ),
    ).toBe(true);
    expect(
      artifact.nodes.some(
        (node) =>
          node.field.identityStatus === "SCHEMA_BACKED" &&
          node.field.qualifiedName === "demo.extra" &&
          node.field.column === "src_a",
      ),
    ).toBe(true);
    expect(
      artifact.gaps.some(
        (gap) => gap.reasonCode === "SOURCE_TABLE_PACK_MISSING",
      ),
    ).toBe(false);
    expect(
      artifact.edges.filter((edge) => edge.producerTaskId !== null),
    ).toHaveLength(0);
    expect(validateFieldLineageArtifact(artifact)).toEqual([]);
  });
});
