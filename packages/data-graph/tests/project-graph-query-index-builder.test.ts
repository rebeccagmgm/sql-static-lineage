import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalJson, sha256 } from "../src/contracts/runtime.ts";
import { buildFieldEvidenceProjection } from "../src/project-graph/field-evidence/field-evidence-projector.ts";
import { publishFieldEvidence } from "../src/project-graph/field-evidence/field-evidence-publication.ts";
import { loadFieldEvidenceSource } from "../src/project-graph/field-evidence/field-evidence-source.ts";
import {
  createQueryIndexParityReport,
  loadQueryIndexAuditDirectory,
  publishQueryIndexAudit,
  queryIndexAuditDirectory,
} from "../src/project-graph/query-index/query-index-audit-publication.ts";
import {
  buildQueryIndex,
  stageQueryIndexBuild,
} from "../src/project-graph/query-index/query-index-builder.ts";
import { InMemoryQueryIndexStore } from "../src/project-graph/query-index/in-memory-query-index-store.ts";
import { requiredQueryIndexParityCases } from "../src/project-graph/query-index/query-index-parity.ts";
import { loadQueryIndexSource } from "../src/project-graph/query-index/query-index-source.ts";
import type {
  QueryIndexIndexedEdge,
  QueryIndexIndexedNode,
  QueryIndexRecordCounts,
} from "../src/project-graph/query-index/query-index-store.ts";
import {
  FIELD_FIXTURE_TARGET,
  FIELD_FIXTURE_WRITE_ID,
  materializeFieldEvidenceFixture,
} from "./fixtures/field-evidence-graph/cases.ts";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "query-index-builder-"));
  const materialized = materializeFieldEvidenceFixture(join(root, "source"), {
    projectKey: "query-index-builder",
  });
  const publish = (rootFields: readonly string[]) => {
    const fieldSource = loadFieldEvidenceSource({
      projectTopologyDirectory: materialized.projectTopologyDirectory,
      fieldLineagePath: materialized.fieldLineagePath,
      rootTaskId: "root-1",
      writeObservationId: FIELD_FIXTURE_WRITE_ID,
      target: FIELD_FIXTURE_TARGET,
      rootFields,
    });
    return publishFieldEvidence(buildFieldEvidenceProjection(fieldSource), {
      outputRoot: materialized.outputRoot,
    }).directory;
  };
  const deltaDirectory = publish(["delta"]);
  const gammaDirectory = publish(["gamma"]);
  const load = (fields: readonly string[]) =>
    loadQueryIndexSource({
      topologyDirectory: materialized.projectTopologyDirectory,
      fieldEvidenceDirectories: fields,
    });
  return {
    root,
    topologyDirectory: materialized.projectTopologyDirectory,
    deltaDirectory,
    gammaDirectory,
    delta: load([deltaDirectory]),
    both: load([deltaDirectory, gammaDirectory]),
    auditRoot: join(root, "audit"),
  };
}

function passingReport(source: ReturnType<typeof loadQueryIndexSource>) {
  const hash = sha256(canonicalJson({ result: "same" }));
  return createQueryIndexParityReport({
    indexBuildId: source.indexBuildId,
    sourceDescriptorHash: source.descriptorHash,
    cases: requiredQueryIndexParityCases(source).map(({ caseId, query }) => ({
      caseId,
      query,
      required: true,
      status: "PASSED",
      referenceResultHash: hash,
      indexedResultHash: hash,
      difference: null,
    })),
  });
}

function failingReport(source: ReturnType<typeof loadQueryIndexSource>) {
  return createQueryIndexParityReport({
    indexBuildId: source.indexBuildId,
    sourceDescriptorHash: source.descriptorHash,
    cases: requiredQueryIndexParityCases(source).map(
      ({ caseId, query }, index) =>
        index === 0
          ? {
              caseId,
              query,
              required: true,
              status: "FAILED" as const,
              referenceResultHash: "a".repeat(64),
              indexedResultHash: "b".repeat(64),
              difference: {
                path: "$.result.nodes",
                kind: "VALUE" as const,
                referenceSummary: "count=2",
                indexedSummary: "count=1",
              },
            }
          : {
              caseId,
              query,
              required: true,
              status: "PASSED" as const,
              referenceResultHash: "c".repeat(64),
              indexedResultHash: "c".repeat(64),
              difference: null,
            },
    ),
  });
}

async function build(
  store: InMemoryQueryIndexStore,
  setup: ReturnType<typeof fixture>,
  source = setup.delta,
) {
  return buildQueryIndex({
    source,
    store,
    auditOutputRoot: setup.auditRoot,
    runParity: async () => passingReport(source),
    batchSize: 2,
  });
}

function sourceHashes(setup: ReturnType<typeof fixture>): readonly string[] {
  return [
    join(setup.topologyDirectory, "projection-manifest.json"),
    join(setup.topologyDirectory, "snapshot.json"),
    join(setup.topologyDirectory, "topology.nodes.jsonl"),
    join(setup.topologyDirectory, "topology.edges.jsonl"),
    join(setup.deltaDirectory, "projection-manifest.json"),
    join(setup.deltaDirectory, "snapshot.json"),
    join(setup.deltaDirectory, "field-evidence.nodes.jsonl"),
    join(setup.deltaDirectory, "field-evidence.edges.jsonl"),
  ].map((path) => sha256(readFileSync(path)));
}

class CountConflictStore extends InMemoryQueryIndexStore {
  override async readBuildRecordCounts(
    indexBuildId: string,
  ): Promise<QueryIndexRecordCounts> {
    const actual = await super.readBuildRecordCounts(indexBuildId);
    return { ...actual, nodes: actual.nodes + 1 };
  }
}

class BatchTrackingStore extends InMemoryQueryIndexStore {
  readonly nodeBatchSizes: number[] = [];
  readonly edgeBatchSizes: number[] = [];

  override async writeNodes(
    indexBuildId: string,
    nodes: readonly QueryIndexIndexedNode[],
  ): Promise<void> {
    this.nodeBatchSizes.push(nodes.length);
    await super.writeNodes(indexBuildId, nodes);
  }

  override async writeEdges(
    indexBuildId: string,
    edges: readonly QueryIndexIndexedEdge[],
  ): Promise<void> {
    this.edgeBatchSizes.push(edges.length);
    await super.writeEdges(indexBuildId, edges);
  }
}

describe("query-index builder and audit publication", () => {
  it("caps relationship batches without shrinking the node batch", async () => {
    const setup = fixture();
    const store = new BatchTrackingStore();

    await stageQueryIndexBuild({
      source: setup.delta,
      store,
      batchSize: 100,
    });

    expect(store.nodeBatchSizes.some((size) => size > 10)).toBe(true);
    expect(store.edgeBatchSizes.length).toBeGreaterThan(1);
    expect(Math.max(...store.edgeBatchSizes)).toBe(10);
  });

  it("stages, validates, gates, activates and publishes without changing sources", async () => {
    const setup = fixture();
    const before = sourceHashes(setup);
    const store = new InMemoryQueryIndexStore();
    const result = await build(store, setup);

    expect(result.build.state).toBe("READY");
    expect(result.build.validationState).toBe("PASSED");
    expect(result.build.parityState).toBe("PASSED");
    expect(result.audit.status).toBe("CREATED");
    expect(
      (await store.resolveCurrentBuild("query-index-builder"))?.indexBuildId,
    ).toBe(setup.delta.indexBuildId);
    expect(sourceHashes(setup)).toEqual(before);
    expect(
      loadQueryIndexAuditDirectory(result.audit.directory).manifest,
    ).toEqual(result.audit.manifest);
  });

  it("reuses the exact complete build and byte-identical audit", async () => {
    const setup = fixture();
    const store = new InMemoryQueryIndexStore();
    const first = await build(store, setup);
    const firstBytes = [
      readFileSync(
        join(first.audit.directory, "query-index-manifest.json"),
        "utf8",
      ),
      readFileSync(join(first.audit.directory, "parity-report.json"), "utf8"),
    ];
    const second = await build(store, setup);

    expect(second.outcome).toBe("REUSED");
    expect(second.audit.status).toBe("REUSED");
    expect(second.source.indexBuildId).toBe(first.source.indexBuildId);
    expect([
      readFileSync(
        join(second.audit.directory, "query-index-manifest.json"),
        "utf8",
      ),
      readFileSync(join(second.audit.directory, "parity-report.json"), "utf8"),
    ]).toEqual(firstBytes);
  });

  it("keeps the old current build when a changed-source import fails", async () => {
    const setup = fixture();
    const store = new InMemoryQueryIndexStore();
    await build(store, setup, setup.delta);
    store.failNext("WRITE_NODES");

    await expect(build(store, setup, setup.both)).rejects.toThrow(
      "QUERY_INDEX_SIMULATED_WRITE_NODES_FAILURE",
    );
    expect(
      (await store.resolveCurrentBuild("query-index-builder"))?.indexBuildId,
    ).toBe(setup.delta.indexBuildId);
    expect(
      existsSync(
        queryIndexAuditDirectory({
          outputRoot: setup.auditRoot,
          projectKey: "query-index-builder",
          indexBuildId: setup.both.indexBuildId,
        }),
      ),
    ).toBe(false);
  });

  it("blocks activation on validation or required parity failure", async () => {
    const validationSetup = fixture();
    const countConflict = new CountConflictStore();
    await expect(build(countConflict, validationSetup)).rejects.toThrow(
      "QUERY_INDEX_VALIDATION_COUNT_MISMATCH",
    );
    expect(
      await countConflict.resolveCurrentBuild("query-index-builder"),
    ).toBeNull();

    const paritySetup = fixture();
    const parityStore = new InMemoryQueryIndexStore();
    const staged = await stageQueryIndexBuild({
      source: paritySetup.delta,
      store: parityStore,
    });
    await expect(
      buildQueryIndex({
        source: paritySetup.delta,
        store: parityStore,
        auditOutputRoot: paritySetup.auditRoot,
        runParity: async () => failingReport(paritySetup.delta),
      }),
    ).rejects.toThrow("QUERY_INDEX_PARITY_REQUIRED_CASE_FAILED");
    expect(staged.validation.counts.nodes).toBeGreaterThan(0);
    expect(
      await parityStore.resolveCurrentBuild("query-index-builder"),
    ).toBeNull();
  });

  it("installs audit files atomically and rejects immutable conflicts", async () => {
    const setup = fixture();
    const store = new InMemoryQueryIndexStore();
    const built = await build(store, setup);
    const conflicting = {
      ...built.audit.manifest,
      publication: {
        ...built.audit.manifest.publication,
        previousCurrentBuildId: "f".repeat(64),
      },
    };
    const { contentHash: _contentHash, ...body } = conflicting;
    const changed = {
      ...body,
      contentHash: sha256(canonicalJson(body)),
    };
    expect(() =>
      publishQueryIndexAudit({
        outputRoot: setup.auditRoot,
        manifest: changed,
        parityReport: built.audit.parityReport,
      }),
    ).toThrow("QUERY_INDEX_AUDIT_IMMUTABLE_CONFLICT");

    const interruptedRoot = join(setup.root, "interrupted-audit");
    expect(() =>
      publishQueryIndexAudit({
        outputRoot: interruptedRoot,
        manifest: built.audit.manifest,
        parityReport: built.audit.parityReport,
        beforeInstall: () => {
          throw new Error("SIMULATED_AUDIT_INSTALL_INTERRUPTION");
        },
      }),
    ).toThrow("SIMULATED_AUDIT_INSTALL_INTERRUPTION");
    expect(
      existsSync(
        queryIndexAuditDirectory({
          outputRoot: interruptedRoot,
          projectKey: built.audit.manifest.projectKey,
          indexBuildId: built.audit.manifest.indexBuildId,
        }),
      ),
    ).toBe(false);
  });
});
