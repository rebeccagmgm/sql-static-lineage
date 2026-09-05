import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildFieldEvidenceProjection } from "../src/project-graph/field-evidence/field-evidence-projector.ts";
import { publishFieldEvidence } from "../src/project-graph/field-evidence/field-evidence-publication.ts";
import { loadFieldEvidenceSource } from "../src/project-graph/field-evidence/field-evidence-source.ts";
import { getIndexedFieldEvidence } from "../src/project-graph/query-index/indexed-field-evidence-query.ts";
import { getIndexedProjectTopology } from "../src/project-graph/query-index/indexed-project-topology-query.ts";
import {
  buildQueryIndex,
  stageQueryIndexBuild,
} from "../src/project-graph/query-index/query-index-builder.ts";
import { InMemoryQueryIndexStore } from "../src/project-graph/query-index/in-memory-query-index-store.ts";
import { runRequiredQueryIndexParity } from "../src/project-graph/query-index/query-index-parity.ts";
import { loadQueryIndexSource } from "../src/project-graph/query-index/query-index-source.ts";
import {
  FIELD_FIXTURE_TARGET,
  FIELD_FIXTURE_WRITE_ID,
  materializeFieldEvidenceFixture,
} from "./fixtures/field-evidence-graph/cases.ts";

function sourceFixture(projectKey: string) {
  const root = mkdtempSync(join(tmpdir(), "query-index-availability-"));
  const materialized = materializeFieldEvidenceFixture(join(root, "source"), {
    projectKey,
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
  const delta = publish(["delta"]);
  const gamma = publish(["gamma"]);
  return {
    root,
    delta: loadQueryIndexSource({
      topologyDirectory: materialized.projectTopologyDirectory,
      fieldEvidenceDirectories: [delta],
    }),
    both: loadQueryIndexSource({
      topologyDirectory: materialized.projectTopologyDirectory,
      fieldEvidenceDirectories: [delta, gamma],
    }),
  };
}

async function activate(
  store: InMemoryQueryIndexStore,
  source: ReturnType<typeof loadQueryIndexSource>,
  outputRoot: string,
) {
  return buildQueryIndex({
    source,
    store,
    auditOutputRoot: outputRoot,
    runParity: async () => runRequiredQueryIndexParity({ source, store }),
  });
}

function expected(
  store: InMemoryQueryIndexStore,
  source: ReturnType<typeof loadQueryIndexSource>,
) {
  return {
    store,
    projectKey: source.descriptor.projectKey,
    expectedSourceDescriptorHash: source.descriptorHash,
  };
}

describe("query-index availability and staleness gates", () => {
  it("fails closed for missing, STAGING, FAILED and READY non-current builds", async () => {
    const fixture = sourceFixture("availability-project");

    const missing = new InMemoryQueryIndexStore();
    await expect(
      getIndexedProjectTopology(expected(missing, fixture.delta)),
    ).rejects.toMatchObject({
      code: "QUERY_INDEX_UNAVAILABLE",
      reason: "BUILD_MISSING",
    });

    const staging = new InMemoryQueryIndexStore();
    await stageQueryIndexBuild({ source: fixture.delta, store: staging });
    await expect(
      getIndexedProjectTopology(expected(staging, fixture.delta)),
    ).rejects.toMatchObject({
      code: "QUERY_INDEX_UNAVAILABLE",
      reason: "BUILD_STAGING",
    });

    const failed = new InMemoryQueryIndexStore();
    await stageQueryIndexBuild({ source: fixture.delta, store: failed });
    await failed.markBuildFailed(
      fixture.delta.indexBuildId,
      "QUERY_INDEX_TEST_FAILURE",
    );
    await expect(
      getIndexedProjectTopology(expected(failed, fixture.delta)),
    ).rejects.toMatchObject({
      code: "QUERY_INDEX_UNAVAILABLE",
      reason: "BUILD_FAILED",
    });

    const nonCurrent = new InMemoryQueryIndexStore();
    await activate(nonCurrent, fixture.delta, join(fixture.root, "audit"));
    nonCurrent.clearCurrentPointer("availability-project");
    await expect(
      getIndexedProjectTopology(expected(nonCurrent, fixture.delta)),
    ).rejects.toMatchObject({
      code: "QUERY_INDEX_UNAVAILABLE",
      reason: "BUILD_NOT_CURRENT",
    });
  });

  it("reports stale descriptors and absent field snapshots without file fallback", async () => {
    const fixture = sourceFixture("stale-project");
    const store = new InMemoryQueryIndexStore();
    await activate(store, fixture.delta, join(fixture.root, "audit"));

    await expect(
      getIndexedProjectTopology({
        store,
        projectKey: "stale-project",
        expectedSourceDescriptorHash: fixture.both.descriptorHash,
      }),
    ).rejects.toMatchObject({
      code: "QUERY_INDEX_STALE",
      reason: "SOURCE_DESCRIPTOR_MISMATCH",
      actualIndexBuildId: fixture.delta.indexBuildId,
    });
    await expect(
      getIndexedFieldEvidence({
        ...expected(store, fixture.delta),
        fieldEvidenceSnapshotId: "field-evidence-missing",
      }),
    ).rejects.toMatchObject({
      code: "QUERY_INDEX_FIELD_SNAPSHOT_UNAVAILABLE",
      reason: "FIELD_SNAPSHOT_MISSING",
    });
  });

  it("keeps parity and query scope isolated across two indexed projects", async () => {
    const first = sourceFixture("isolated-project-a");
    const second = sourceFixture("isolated-project-b");
    const store = new InMemoryQueryIndexStore();
    await activate(store, first.delta, join(first.root, "audit"));
    await activate(store, second.delta, join(second.root, "audit"));

    const [firstResult, secondResult] = await Promise.all([
      getIndexedProjectTopology(expected(store, first.delta)),
      getIndexedProjectTopology(expected(store, second.delta)),
    ]);
    expect(firstResult.snapshotId).toBe(
      first.delta.descriptor.topology.snapshotId,
    );
    expect(secondResult.snapshotId).toBe(
      second.delta.descriptor.topology.snapshotId,
    );
    expect(
      (await store.resolveCurrentBuild("isolated-project-a"))?.projectKey,
    ).toBe("isolated-project-a");
    expect(
      (await store.resolveCurrentBuild("isolated-project-b"))?.projectKey,
    ).toBe("isolated-project-b");
  });
});
