import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalJson } from "../scripts/machine-facts/machine-facts-contract.ts";
import {
  fieldEvidenceDatasetNodeId,
  fieldEvidencePhysicalFieldNodeId,
  validateFieldEvidenceProjection,
} from "../scripts/project-graph/field-evidence/field-evidence-contract.ts";
import { parseFieldEvidenceCli } from "../scripts/project-graph/field-evidence/field-evidence-cli.ts";
import { buildFieldEvidenceProjection } from "../scripts/project-graph/field-evidence/field-evidence-projector.ts";
import {
  loadFieldEvidenceDirectory,
  publishFieldEvidence,
  serializeFieldEvidence,
  FIELD_EVIDENCE_NODES_FILE,
} from "../scripts/project-graph/field-evidence/field-evidence-publication.ts";
import {
  explainFieldEvidenceRecord,
  getFieldEvidence,
  traceFieldValuePath,
} from "../scripts/project-graph/field-evidence/field-evidence-query.ts";
import {
  FIELD_EVIDENCE_SOURCE_CONTRACT,
  loadFieldEvidenceSource,
} from "../scripts/project-graph/field-evidence/field-evidence-source.ts";
import type { FieldLineageArtifact } from "../scripts/reconcile/consumer/field-lineage/field-lineage-contract.ts";
import {
  FIELD_FIXTURE_TARGET,
  FIELD_FIXTURE_WRITE_ID,
  fieldLineageFixture,
  invalidFieldLineageFixtures,
  materializeFieldEvidenceFixture,
} from "./fixtures/field-evidence-graph/cases.ts";

function temporaryDirectory(label: string): string {
  return mkdtempSync(join(tmpdir(), `${label}-`));
}

function loadFixture(
  options: {
    readonly artifact?: FieldLineageArtifact;
    readonly fields?: readonly string[];
    readonly limits?: Partial<{
      readonly maxNodes: number;
      readonly maxEdges: number;
      readonly maxPaths: number;
      readonly maxControls: number;
      readonly maxCandidates: number;
      readonly maxGaps: number;
    }>;
    readonly target?: {
      readonly platform: string;
      readonly dataSource: string;
      readonly stableTableId: string;
      readonly qualifiedName: string;
    };
    readonly rootTaskId?: string;
    readonly writeObservationId?: string;
  } = {},
) {
  const materialized = materializeFieldEvidenceFixture(
    temporaryDirectory("field-evidence-fixture"),
    { field: options.artifact },
  );
  return {
    materialized,
    source: loadFieldEvidenceSource({
      projectTopologyDirectory: materialized.projectTopologyDirectory,
      fieldLineagePath: materialized.fieldLineagePath,
      rootTaskId: options.rootTaskId ?? "root-1",
      writeObservationId: options.writeObservationId ?? FIELD_FIXTURE_WRITE_ID,
      target: options.target ?? FIELD_FIXTURE_TARGET,
      rootFields: options.fields ?? ["delta"],
      limits: options.limits,
    }),
  };
}

describe("field evidence source alignment", () => {
  it("freezes the local-only source contract and exact source identities", () => {
    expect(FIELD_EVIDENCE_SOURCE_CONTRACT).toMatchObject({
      rootWriteCardinality: "EXACTLY_ONE",
      traversal: "INCOMING_VALUE_FLOW_ONLY",
      externalCalls: 0,
      topologyMutation: false,
    });
    const { source } = loadFixture();
    expect(source.fieldSource).toMatchObject({
      rootTaskId: "root-1",
      declaredContentHash: source.artifact.contentHash,
      contentSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(source.projectSource).toMatchObject({
      snapshotId: source.project.projection.snapshot.snapshotId,
      manifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(source.slice).toMatchObject({
      reachableTaskIds: ["root-1", "shared-producer"],
      truncated: false,
      exploredPaths: 2,
    });
  });

  it("fails closed on hashes, roots, writes, targets, fields, Tasks, and non-primary pairs", () => {
    const invalid = invalidFieldLineageFixtures();
    expect(() => loadFixture({ artifact: invalid.brokenContentHash })).toThrow(
      /contentHash does not match/,
    );
    expect(() => loadFixture({ artifact: invalid.multipleRootWrites })).toThrow(
      /ROOT_WRITE_AMBIGUOUS_OR_MISMATCHED/,
    );
    expect(() => loadFixture({ rootTaskId: "wrong-root" })).toThrow(
      /PROJECT_ROOT_MISSING/,
    );
    expect(() => loadFixture({ writeObservationId: "write:wrong" })).toThrow(
      /ROOT_WRITE_AMBIGUOUS_OR_MISMATCHED/,
    );
    expect(() =>
      loadFixture({
        target: { ...FIELD_FIXTURE_TARGET, qualifiedName: "dm.wrong" },
      }),
    ).toThrow(/ROOT_TARGET_MISMATCH/);
    expect(() => loadFixture({ fields: ["not_a_field"] })).toThrow(
      /REQUESTED_FIELD_NOT_DECLARED/,
    );
    expect(() => loadFixture({ artifact: invalid.missingProjectTask })).toThrow(
      /REACHABLE_TASK_MISSING/,
    );
    expect(() =>
      loadFixture({ artifact: invalid.nonPrimaryCrossTask }),
    ).toThrow(/PRIMARY_PAIR_MISSING/);
  });

  it("keeps dataset presence separate from physical identity", () => {
    const { source } = loadFixture({ fields: ["delta", "gamma"] });
    const projection = buildFieldEvidenceProjection(source);
    const target = projection.nodes.find(
      (node) =>
        node.nodeId === fieldEvidenceDatasetNodeId(FIELD_FIXTURE_TARGET),
    );
    expect(target?.properties.topologyPresence).toBe("NOT_IN_PROJECT_TOPOLOGY");
    const sameNameFields = projection.nodes.filter(
      (node) =>
        node.nodeType === "PHYSICAL_FIELD" &&
        node.properties.qualifiedName === "dm.shared_source",
    );
    expect(
      new Set(sameNameFields.map((node) => node.properties.dataSource)),
    ).toEqual(new Set(["warehouse-a", "warehouse-b"]));
    expect(
      fieldEvidencePhysicalFieldNodeId({
        platform: "hive",
        dataSource: "warehouse-a",
        stableTableId: "guid-shared-warehouse-a",
        qualifiedName: "dm.shared_source",
        column: "delta",
      }),
    ).not.toBe(
      fieldEvidencePhysicalFieldNodeId({
        platform: "hive",
        dataSource: "warehouse-b",
        stableTableId: "guid-shared-warehouse-b",
        qualifiedName: "dm.shared_source",
        column: "delta",
      }),
    );
  });
});

describe("on-demand field evidence projection", () => {
  it("projects only reverse-reachable states and exact occurrence/write proof", () => {
    const { source } = loadFixture();
    const projection = buildFieldEvidenceProjection(source);
    validateFieldEvidenceProjection(projection);
    expect(projection.snapshot.slice).toMatchObject({
      coverageStatus: "COMPLETE",
      reachableSourceNodes: 3,
      reachableValueEdges: 2,
      reachableTasks: 2,
      exactPrecisionEdges: 1,
      precisionBoundaryEdges: 0,
      controls: 1,
      candidates: 2,
      gaps: 0,
      truncated: false,
    });
    const sourceNodeIds = projection.nodes
      .filter((node) => node.nodeType === "FIELD_BINDING_STATE")
      .map((node) => node.properties.sourceNodeId);
    expect(sourceNodeIds).toEqual(
      expect.arrayContaining([
        "node:producer:delta",
        "node:root:read:delta",
        "node:root:target:delta",
      ]),
    );
    expect(sourceNodeIds).not.toContain("node:root:target:gamma");
    expect(
      projection.nodes.filter((node) => node.nodeType === "READ_OCCURRENCE"),
    ).toHaveLength(1);
    expect(
      projection.nodes.filter((node) => node.nodeType === "WRITE_OBSERVATION"),
    ).toHaveLength(1);
    expect(
      projection.edges.filter((edge) => edge.edgeType === "VALUE_FLOW"),
    ).toHaveLength(2);
  });

  it("merges explicit roots deterministically without treating controls as value flow", () => {
    const first = buildFieldEvidenceProjection(
      loadFixture({ fields: ["gamma", "delta"] }).source,
    );
    const second = buildFieldEvidenceProjection(
      loadFixture({ fields: ["delta", "gamma"] }).source,
    );
    expect(first.snapshot.snapshotId).toBe(second.snapshot.snapshotId);
    expect(first).toEqual(second);
    expect(Object.keys(first.snapshot.selection.rootStateIds)).toEqual([
      "delta",
      "gamma",
    ]);
    expect(
      first.edges.filter((edge) => edge.edgeType === "VALUE_FLOW"),
    ).toHaveLength(3);
    expect(
      first.edges.find((edge) => edge.edgeType === "CONTROL_ANNOTATES_STATE")
        ?.relationLayer,
    ).toBe("ANNOTATION");
  });

  it("retains value flow and emits a precision boundary when write proof is ambiguous", () => {
    const { source } = loadFixture({
      artifact: invalidFieldLineageFixtures().ambiguousPrecision,
    });
    const projection = buildFieldEvidenceProjection(source);
    expect(projection.snapshot.slice).toMatchObject({
      coverageStatus: "PARTIAL",
      exactPrecisionEdges: 0,
      precisionBoundaryEdges: 1,
    });
    expect(
      projection.edges.filter((edge) => edge.edgeType === "VALUE_FLOW"),
    ).toHaveLength(2);
    expect(
      projection.nodes.filter((node) => node.nodeType === "READ_OCCURRENCE"),
    ).toHaveLength(0);
    expect(
      projection.nodes.find(
        (node) =>
          node.nodeType === "BOUNDARY" &&
          node.properties.reason === "EVIDENCE_PRECISION_UNAVAILABLE",
      ),
    ).toBeDefined();
  });

  it("reuses one producer Write Observation across multiple exact bindings", () => {
    const projection = buildFieldEvidenceProjection(
      loadFixture({
        artifact: fieldLineageFixture({ sharedWriteSecondBinding: true }),
      }).source,
    );
    expect(projection.snapshot.slice.exactPrecisionEdges).toBe(2);
    expect(
      projection.nodes.filter((node) => node.nodeType === "WRITE_OBSERVATION"),
    ).toHaveLength(1);
    expect(
      projection.edges.filter(
        (edge) => edge.edgeType === "VALUE_FLOW_WRITTEN_BY",
      ),
    ).toHaveLength(2);
  });

  it("preserves source PARTIAL, gaps, and deterministic projection limits", () => {
    const partial = buildFieldEvidenceProjection(
      loadFixture({
        artifact: fieldLineageFixture({ includeGap: true }),
      }).source,
    );
    expect(partial.snapshot.slice).toMatchObject({
      sourceOverallStatus: "PARTIAL",
      coverageStatus: "PARTIAL",
      gaps: 2,
    });
    expect(
      partial.nodes.filter((node) => node.nodeType === "GAP"),
    ).toHaveLength(2);
    const taskScopedGap = partial.nodes.find(
      (node) =>
        node.nodeType === "GAP" &&
        node.properties.sourceGapId === "gap:task-scoped",
    )!;
    expect(
      partial.edges.find(
        (edge) =>
          edge.fromNodeId === taskScopedGap.nodeId &&
          edge.edgeType === "EVIDENCE_SCOPED_TO_TASK",
      ),
    ).toBeDefined();

    const limited = buildFieldEvidenceProjection(
      loadFixture({ limits: { maxNodes: 1 } }).source,
    );
    expect(limited.snapshot.slice).toMatchObject({
      coverageStatus: "PARTIAL",
      truncated: true,
      limitReasons: ["MAX_NODES_REACHED"],
    });
    expect(
      limited.nodes.find(
        (node) =>
          node.nodeType === "BOUNDARY" &&
          node.properties.reason === "MAX_NODES_REACHED",
      ),
    ).toBeDefined();

    const candidateLimited = buildFieldEvidenceProjection(
      loadFixture({ limits: { maxCandidates: 1 } }).source,
    );
    expect(candidateLimited.snapshot.slice).toMatchObject({
      coverageStatus: "PARTIAL",
      candidates: 1,
      truncated: true,
      limitReasons: ["MAX_CANDIDATES_REACHED"],
    });

    const blocked = buildFieldEvidenceProjection(
      loadFixture({ artifact: fieldLineageFixture({ blocked: true }) }).source,
    );
    expect(blocked.snapshot.slice).toMatchObject({
      sourceOverallStatus: "BLOCKED",
      coverageStatus: "BLOCKED",
    });
  });
});

describe("field evidence publication and queries", () => {
  it("publishes deterministic immutable files, reuses exact bytes, and changes identity by selection", () => {
    const { source, materialized } = loadFixture();
    const projection = buildFieldEvidenceProjection(source);
    expect(serializeFieldEvidence(projection)).toEqual(
      serializeFieldEvidence(projection),
    );
    const created = publishFieldEvidence(projection, {
      outputRoot: materialized.outputRoot,
    });
    const before = [
      "snapshot.json",
      "field-evidence.nodes.jsonl",
      "field-evidence.edges.jsonl",
      "projection-manifest.json",
    ].map((fileName) =>
      readFileSync(join(created.directory, fileName), "utf8"),
    );
    const reused = publishFieldEvidence(projection, {
      outputRoot: materialized.outputRoot,
    });
    expect(reused.status).toBe("REUSED");
    expect(
      [
        "snapshot.json",
        "field-evidence.nodes.jsonl",
        "field-evidence.edges.jsonl",
        "projection-manifest.json",
      ].map((fileName) =>
        readFileSync(join(reused.directory, fileName), "utf8"),
      ),
    ).toEqual(before);

    const gamma = buildFieldEvidenceProjection(
      loadFixture({ fields: ["gamma"] }).source,
    );
    expect(gamma.snapshot.snapshotId).not.toBe(projection.snapshot.snapshotId);
    const changedBytesArtifact = {
      ...fieldLineageFixture(),
      generatedAt: "2026-08-29T01:00:01.000Z",
    };
    const changedBytes = buildFieldEvidenceProjection(
      loadFixture({ artifact: changedBytesArtifact }).source,
    );
    expect(changedBytes.snapshot.fieldSource.declaredContentHash).toBe(
      projection.snapshot.fieldSource.declaredContentHash,
    );
    expect(changedBytes.snapshot.fieldSource.contentSha256).not.toBe(
      projection.snapshot.fieldSource.contentSha256,
    );
    expect(changedBytes.snapshot.snapshotId).not.toBe(
      projection.snapshot.snapshotId,
    );
    writeFileSync(
      join(created.directory, FIELD_EVIDENCE_NODES_FILE),
      "corrupt",
      "utf8",
    );
    expect(() =>
      publishFieldEvidence(projection, { outputRoot: materialized.outputRoot }),
    ).toThrow(/IMMUTABLE_CONFLICT/);
  });

  it("does not expose interrupted output and rejects manifest/file tampering", () => {
    const { source, materialized } = loadFixture();
    const projection = buildFieldEvidenceProjection(source);
    const finalDirectory = join(
      materialized.outputRoot,
      "projects",
      projection.snapshot.projectKey,
      "field-evidence",
      projection.snapshot.snapshotId,
    );
    expect(() =>
      publishFieldEvidence(projection, {
        outputRoot: materialized.outputRoot,
        beforeInstall: () => {
          throw new Error("fixture interruption");
        },
      }),
    ).toThrow("fixture interruption");
    expect(existsSync(finalDirectory)).toBe(false);

    const published = publishFieldEvidence(projection, {
      outputRoot: materialized.outputRoot,
    });
    writeFileSync(
      join(published.directory, "field-evidence.edges.jsonl"),
      "{}\n",
      "utf8",
    );
    expect(() => loadFieldEvidenceDirectory(published.directory)).toThrow(
      /FILE_HASH_OR_COUNT_INVALID/,
    );

    const manifestFixture = loadFixture();
    const manifestProjection = buildFieldEvidenceProjection(
      manifestFixture.source,
    );
    const manifestPublished = publishFieldEvidence(manifestProjection, {
      outputRoot: manifestFixture.materialized.outputRoot,
    });
    const manifestPath = join(
      manifestPublished.directory,
      "projection-manifest.json",
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
      string,
      unknown
    >;
    writeFileSync(
      manifestPath,
      canonicalJson({ ...manifest, contentHash: "0".repeat(64) }),
      "utf8",
    );
    expect(() =>
      loadFieldEvidenceDirectory(manifestPublished.directory),
    ).toThrow(/MANIFEST_HASH_INVALID/);
  });

  it("retrieves pages, traces VALUE_FLOW only, and explains exact proof and boundaries", () => {
    const { source, materialized } = loadFixture();
    const projection = buildFieldEvidenceProjection(source);
    const published = publishFieldEvidence(projection, {
      outputRoot: materialized.outputRoot,
    });
    const page = getFieldEvidence(published.directory, { limit: 2 });
    expect(page.status).toBe("partial");
    expect(page.warnings).toContain("QUERY_LIMIT_REACHED");
    expect(page.result.selection.rootFields).toEqual(["delta"]);
    const statePage = getFieldEvidence(published.directory, {
      nodeTypes: ["FIELD_BINDING_STATE"],
      limit: 100,
    });
    expect(statePage.status).toBe("ok");
    expect(statePage.result.edges).toHaveLength(0);
    expect(
      statePage.result.nodes.every(
        (node) => node.nodeType === "FIELD_BINDING_STATE",
      ),
    ).toBe(true);

    const trace = traceFieldValuePath(published.directory, {
      rootField: "delta",
    });
    expect(trace.status).toBe("ok");
    expect(trace.result.nodes).toHaveLength(3);
    expect(trace.result.valueEdges).toHaveLength(2);
    expect(
      trace.result.annotationEdges.some(
        (edge) => edge.edgeType === "CONTROL_ANNOTATES_STATE",
      ),
    ).toBe(true);
    expect(
      trace.result.valueEdges.every((edge) => edge.edgeType === "VALUE_FLOW"),
    ).toBe(true);

    const crossEdge = projection.edges.find(
      (edge) =>
        edge.edgeType === "VALUE_FLOW" &&
        edge.properties.sourceEdgeId === "edge:cross:delta",
    )!;
    const explanation = explainFieldEvidenceRecord(
      published.directory,
      crossEdge.edgeId,
    );
    expect(explanation.status).toBe("ok");
    expect(explanation.result.endpoints).toHaveLength(2);
    expect(explanation.result.bindingStates).toHaveLength(2);
    expect(
      explanation.result.precisionRecords.map((node) => node.nodeType).sort(),
    ).toEqual(["READ_OCCURRENCE", "WRITE_OBSERVATION"]);
    expect(explanation.result.sourceArtifacts).toHaveLength(2);
    expect(
      explainFieldEvidenceRecord(published.directory, "missing").status,
    ).toBe("not_found");

    const limited = traceFieldValuePath(published.directory, {
      rootField: "delta",
      maxPaths: 1,
    });
    expect(limited.status).toBe("partial");
    expect(limited.result.truncated).toBe(true);

    const recordLimited = traceFieldValuePath(published.directory, {
      rootField: "delta",
      maxNodes: 1,
      maxEdges: 1,
    });
    expect(recordLimited.status).toBe("partial");
    expect(
      recordLimited.result.nodes.length +
        recordLimited.result.annotationNodes.length,
    ).toBeLessThanOrEqual(1);
    expect(
      recordLimited.result.valueEdges.length +
        recordLimited.result.annotationEdges.length,
    ).toBeLessThanOrEqual(1);

    const explanationLimited = explainFieldEvidenceRecord(
      published.directory,
      crossEdge.edgeId,
      { maxAttachments: 1 },
    );
    expect(explanationLimited.status).toBe("partial");
    expect(explanationLimited.result.attachments).toHaveLength(1);
    expect(explanationLimited.warnings).toContain("QUERY_LIMIT_REACHED");
  });

  it("can return ambiguous for a colliding reference ID without guessing", () => {
    const { source, materialized } = loadFixture();
    const projection = buildFieldEvidenceProjection(source);
    const collisionId = projection.nodes[0]!.nodeId;
    const collisionProjection = {
      ...projection,
      edges: projection.edges
        .map((edge, index) =>
          index === 0 ? { ...edge, edgeId: collisionId } : edge,
        )
        .sort((left, right) => left.edgeId.localeCompare(right.edgeId)),
    };
    validateFieldEvidenceProjection(collisionProjection);
    const published = publishFieldEvidence(collisionProjection, {
      outputRoot: join(materialized.outputRoot, "collision"),
    });
    expect(
      explainFieldEvidenceRecord(published.directory, collisionId).status,
    ).toBe("ambiguous");
  });
});

describe("field evidence CLI", () => {
  it("requires explicit source, target, write, field, output, and limits", () => {
    const parsed = parseFieldEvidenceCli([
      "--project-topology",
      "phase1",
      "--field-lineage",
      "field.json",
      "--output-root",
      "out",
      "--root-task-id",
      "176827",
      "--write-observation-id",
      "write:176827:0",
      "--target-platform",
      "hive",
      "--target-data-source",
      "gfhive",
      "--target-stable-table-id",
      "guid-1",
      "--target-qualified-name",
      "dm.target",
      "--root-field",
      "delta,gamma",
      "--max-nodes",
      "100",
    ]);
    expect(parsed).toMatchObject({
      rootTaskId: "176827",
      writeObservationId: "write:176827:0",
      rootFields: ["delta", "gamma"],
      limits: { maxNodes: 100 },
    });
    expect(() =>
      parseFieldEvidenceCli([
        "--project-topology",
        "phase1",
        "--field-lineage",
        "field.json",
      ]),
    ).toThrow(/usage:/);
  });
});
