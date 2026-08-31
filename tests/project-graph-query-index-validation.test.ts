import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildFieldEvidenceProjection } from "../src/project-graph/field-evidence/field-evidence-projector.ts";
import { publishFieldEvidence } from "../src/project-graph/field-evidence/field-evidence-publication.ts";
import { loadFieldEvidenceSource } from "../src/project-graph/field-evidence/field-evidence-source.ts";
import { InMemoryQueryIndexStore } from "../src/project-graph/query-index/in-memory-query-index-store.ts";
import { buildQueryIndexRecordBundle } from "../src/project-graph/query-index/query-index-records.ts";
import { loadQueryIndexSource } from "../src/project-graph/query-index/query-index-source.ts";
import { validateQueryIndexBuild } from "../src/project-graph/query-index/query-index-validation.ts";
import {
  FIELD_FIXTURE_TARGET,
  FIELD_FIXTURE_WRITE_ID,
  materializeFieldEvidenceFixture,
} from "./fixtures/field-evidence-graph/cases.ts";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "query-index-validation-"));
  const materialized = materializeFieldEvidenceFixture(directory, {
    projectKey: "query-index-validation",
  });
  const fieldSource = loadFieldEvidenceSource({
    projectTopologyDirectory: materialized.projectTopologyDirectory,
    fieldLineagePath: materialized.fieldLineagePath,
    rootTaskId: "root-1",
    writeObservationId: FIELD_FIXTURE_WRITE_ID,
    target: FIELD_FIXTURE_TARGET,
    rootFields: ["delta"],
  });
  const fieldDirectory = publishFieldEvidence(
    buildFieldEvidenceProjection(fieldSource),
    { outputRoot: materialized.outputRoot },
  ).directory;
  const source = loadQueryIndexSource({
    topologyDirectory: materialized.projectTopologyDirectory,
    fieldEvidenceDirectories: [fieldDirectory],
  });
  return { source, records: buildQueryIndexRecordBundle(source) };
}

async function stage(
  store: InMemoryQueryIndexStore,
  setup: ReturnType<typeof fixture>,
): Promise<void> {
  await store.beginStagedBuild({
    indexBuildId: setup.source.indexBuildId,
    projectKey: setup.source.descriptor.projectKey,
    sourceDescriptorHash: setup.source.descriptorHash,
    sourceDescriptor: setup.source.descriptor,
    projections: setup.records.projections,
    expectedCounts: setup.records.expectedCounts,
  });
}

describe("query-index staged validation", () => {
  it("accepts exact projection-scoped records and canonical payload hashes", async () => {
    const setup = fixture();
    const store = new InMemoryQueryIndexStore();
    await stage(store, setup);
    await store.writeNodes(setup.source.indexBuildId, setup.records.nodes);
    await store.writeEdges(setup.source.indexBuildId, setup.records.edges);

    const validated = await validateQueryIndexBuild({ store, ...setup });
    expect(validated.counts).toMatchObject({
      nodes: setup.records.expectedCounts.nodes,
      edges: setup.records.expectedCounts.edges,
      uniqueNodeKeys: setup.records.expectedCounts.nodes,
      uniqueEdgeKeys: setup.records.expectedCounts.edges,
      unresolvedEdgeEndpoints: 0,
    });
  });

  it("does not merge equal canonical IDs across topology and field projections", () => {
    const setup = fixture();
    const grouped = new Map<string, Set<string>>();
    for (const node of setup.records.nodes) {
      const projections =
        grouped.get(node.canonicalNodeId) ?? new Set<string>();
      projections.add(
        `${node.key.projectionKind}:${node.key.projectionSnapshotId}`,
      );
      grouped.set(node.canonicalNodeId, projections);
    }
    expect(
      [...grouped.values()].some((projections) => projections.size > 1),
    ).toBe(true);
  });

  it("rejects interrupted imports before the validation gate passes", async () => {
    const setup = fixture();
    const store = new InMemoryQueryIndexStore();
    await stage(store, setup);
    await store.writeNodes(
      setup.source.indexBuildId,
      setup.records.nodes.slice(0, -1),
    );

    await expect(validateQueryIndexBuild({ store, ...setup })).rejects.toThrow(
      "QUERY_INDEX_VALIDATION_COUNT_MISMATCH",
    );
    expect(
      (await store.readBuild(setup.source.indexBuildId))?.validationState,
    ).toBe("PENDING");
  });
});
