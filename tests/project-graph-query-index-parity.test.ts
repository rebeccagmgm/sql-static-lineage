import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import {
  explainFieldEvidenceRecord,
  getFieldEvidence,
  traceFieldValuePath,
} from "../src/project-graph/field-evidence/field-evidence-query.ts";
import { buildFieldEvidenceProjection } from "../src/project-graph/field-evidence/field-evidence-projector.ts";
import { publishFieldEvidence } from "../src/project-graph/field-evidence/field-evidence-publication.ts";
import { loadFieldEvidenceSource } from "../src/project-graph/field-evidence/field-evidence-source.ts";
import {
  explainIndexedFieldEvidenceRecord,
  getIndexedFieldEvidence,
  traceIndexedFieldValuePath,
} from "../src/project-graph/query-index/indexed-field-evidence-query.ts";
import {
  explainIndexedTopologyEdge,
  getIndexedProjectTopology,
  traceIndexedProjectUpstream,
} from "../src/project-graph/query-index/indexed-project-topology-query.ts";
import { buildQueryIndex } from "../src/project-graph/query-index/query-index-builder.ts";
import { InMemoryQueryIndexStore } from "../src/project-graph/query-index/in-memory-query-index-store.ts";
import {
  boundedStructuralDifference,
  runRequiredQueryIndexParity,
} from "../src/project-graph/query-index/query-index-parity.ts";
import { loadQueryIndexSource } from "../src/project-graph/query-index/query-index-source.ts";
import {
  explainTopologyEdge,
  getProjectTopology,
  traceProjectUpstream,
} from "../src/project-graph/query/project-topology-query.ts";
import {
  FIELD_FIXTURE_TARGET,
  FIELD_FIXTURE_WRITE_ID,
  fieldLineageFixture,
  materializeFieldEvidenceFixture,
} from "./fixtures/field-evidence-graph/cases.ts";
import { projectTopologyFixturePair } from "./fixtures/project-topology/cases.ts";

async function indexedFixture(partial = false) {
  const root = mkdtempSync(join(tmpdir(), "query-index-parity-"));
  const materialized = materializeFieldEvidenceFixture(join(root, "source"), {
    projectKey: partial ? "query-index-partial" : "query-index-complete",
    topology: projectTopologyFixturePair({ partial }),
    field: fieldLineageFixture({ partial }),
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
  const store = new InMemoryQueryIndexStore();
  const built = await buildQueryIndex({
    source,
    store,
    auditOutputRoot: join(root, "audit"),
    runParity: async () => runRequiredQueryIndexParity({ source, store }),
  });
  return {
    source,
    store,
    topologyDirectory: materialized.projectTopologyDirectory,
    fieldDirectory,
    built,
    expected: {
      store,
      projectKey: source.descriptor.projectKey,
      expectedSourceDescriptorHash: source.descriptorHash,
    },
    expectedField: {
      store,
      projectKey: source.descriptor.projectKey,
      expectedSourceDescriptorHash: source.descriptorHash,
      fieldEvidenceSnapshotId: source.descriptor.fieldEvidence[0]!.snapshotId,
    },
  };
}

describe("query-index topology parity", () => {
  let setup: Awaited<ReturnType<typeof indexedFixture>>;
  let partial: Awaited<ReturnType<typeof indexedFixture>>;

  beforeAll(async () => {
    [setup, partial] = await Promise.all([
      indexedFixture(),
      indexedFixture(true),
    ]);
  });

  it("matches get_project_topology filters, paging and boundaries", async () => {
    for (const options of [
      {},
      { nodeTypes: ["TASK" as const] },
      { edgeTypes: ["PRODUCER_BRIDGE" as const] },
      { offset: 1, limit: 2 },
      { nodeTypes: ["BOUNDARY" as const], offset: 0, limit: 1 },
    ]) {
      expect(await getIndexedProjectTopology(setup.expected, options)).toEqual(
        getProjectTopology(setup.topologyDirectory, options),
      );
    }
    expect(await getIndexedProjectTopology(partial.expected)).toEqual(
      getProjectTopology(partial.topologyDirectory),
    );
  });

  it("publishes deterministic full-envelope cases for all six query families", async () => {
    const first = setup.built.audit.parityReport;
    const second = await runRequiredQueryIndexParity({
      source: setup.source,
      store: setup.store,
    });
    expect(second).toEqual(first);
    expect(first.status).toBe("PASSED");
    expect(first.cases).toHaveLength(14);
    expect(new Set(first.cases.map(({ query }) => query))).toEqual(
      new Set([
        "get_project_topology",
        "trace_project_upstream",
        "explain_topology_edge",
        "get_field_evidence",
        "trace_field_value_path",
        "explain_field_evidence_record",
      ]),
    );
    expect(partial.built.audit.parityReport.status).toBe("PASSED");
  });

  it("matches topology traversal direction, limits, truncation and not-found", async () => {
    const bridge = setup.source.topology.projection.edges.find(
      (edge) => edge.edgeType === "PRODUCER_BRIDGE",
    )!;
    const cases = [
      {
        startNodeId: bridge.fromNodeId,
      },
      {
        startNodeId: bridge.fromNodeId,
        relationLayers: ["DATA_PRODUCTION" as const],
        maxHops: 0,
        maxNodes: 2,
        maxEdges: 1,
        maxPaths: 1,
      },
      {
        startNodeId: "missing-node",
        relationLayers: ["SCHEDULE" as const],
      },
    ];
    for (const options of cases) {
      expect(
        await traceIndexedProjectUpstream(setup.expected, options),
      ).toEqual(traceProjectUpstream(setup.topologyDirectory, options));
    }
  });

  it("matches topology edge explanation and missing edges", async () => {
    const edge = setup.source.topology.projection.edges.find(
      (candidate) => candidate.sourceArtifactRefIds.length > 0,
    )!;
    for (const edgeId of [edge.edgeId, "missing-edge"]) {
      expect(await explainIndexedTopologyEdge(setup.expected, edgeId)).toEqual(
        explainTopologyEdge(setup.topologyDirectory, edgeId),
      );
    }
  });
});

describe("query-index bounded structural differences", () => {
  it("reports one bounded path without exposing string values or secret keys", () => {
    const difference = boundedStructuralDifference(
      { result: { password: "reference-secret" } },
      { result: { password: "indexed-secret" } },
    );
    expect(difference.path).toContain("<redacted-key>");
    expect(difference.referenceSummary).not.toContain("reference-secret");
    expect(difference.indexedSummary).not.toContain("indexed-secret");
    expect(difference.referenceSummary.length).toBeLessThan(128);
  });
});

describe("query-index field-evidence parity", () => {
  let setup: Awaited<ReturnType<typeof indexedFixture>>;
  let partial: Awaited<ReturnType<typeof indexedFixture>>;

  beforeAll(async () => {
    [setup, partial] = await Promise.all([
      indexedFixture(),
      indexedFixture(true),
    ]);
  });

  it("matches field retrieval filters, paging, coverage and diagnostics", async () => {
    for (const options of [
      {},
      { nodeTypes: ["FIELD_BINDING_STATE" as const] },
      { edgeTypes: ["VALUE_FLOW" as const] },
      { offset: 1, limit: 3 },
      { nodeTypes: ["BOUNDARY" as const], limit: 1 },
    ]) {
      expect(
        await getIndexedFieldEvidence(setup.expectedField, options),
      ).toEqual(getFieldEvidence(setup.fieldDirectory, options));
    }
    expect(await getIndexedFieldEvidence(partial.expectedField)).toEqual(
      getFieldEvidence(partial.fieldDirectory),
    );
  });

  it("matches incoming VALUE_FLOW traversal, annotations, limits and missing roots", async () => {
    const cases = [
      { rootField: "delta" },
      {
        rootField: "delta",
        maxHops: 1,
        maxNodes: 2,
        maxEdges: 2,
        maxPaths: 1,
      },
      { startStateId: "missing-state" },
    ];
    for (const options of cases) {
      expect(
        await traceIndexedFieldValuePath(setup.expectedField, options),
      ).toEqual(traceFieldValuePath(setup.fieldDirectory, options));
    }
  });

  it("matches node/edge explanation, precision attachments and not-found", async () => {
    const valueEdge = setup.source.fieldEvidence[0]!.projection.edges.find(
      (edge) => edge.edgeType === "VALUE_FLOW",
    )!;
    const state = setup.source.fieldEvidence[0]!.projection.nodes.find(
      (node) => node.nodeType === "FIELD_BINDING_STATE",
    )!;
    for (const [recordId, options] of [
      [valueEdge.edgeId, {}],
      [state.nodeId, { maxAttachments: 1 }],
      ["missing-record", {}],
    ] as const) {
      expect(
        await explainIndexedFieldEvidenceRecord(
          setup.expectedField,
          recordId,
          options,
        ),
      ).toEqual(
        explainFieldEvidenceRecord(setup.fieldDirectory, recordId, options),
      );
    }
  });
});
