import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { taskDetail } from "../src/asset-graph/service.ts";
import type { AssetGraphStore } from "../src/asset-graph/store.ts";
import type { TableMetadataResolver } from "../src/asset-graph/table-metadata.ts";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "task-detail-metadata-"));
  const projectionPath = join(root, "projection.json");
  const evidencePath = join(root, "evidence.json");
  const manifestPath = join(root, "manifest.json");
  const identity = (dataSource: string) => ({
    platform: "hive",
    dataSource,
    qualifiedName: "dm.party",
    identityStatus: "CONFIRMED",
  });
  const projection = {
    schemaVersion: "1.3.0",
    artifactType: "TASK_LOCAL_PROJECTION",
    taskId: "task",
    coverageStatus: "PROJECTED",
    failureReasonCode: null,
    contentHash: "a".repeat(64),
    edges: [],
    nodes: [
      ...["a", "b"].map((id) => ({
        nodeId: `dataset:${id}`,
        nodeType: "PHYSICAL_DATASET",
        properties: identity(id),
      })),
      ...["a", "b"].map((id) => ({
        nodeId: `write:${id}`,
        nodeType: "TARGET_WRITE",
        properties: { qualifiedName: "dm.party" } as Record<string, unknown>,
      })),
    ],
    localClosure: {
      externalReads: [],
      finalWrites: ["a", "b"].map((id) => ({
        writeObservationId: id,
        targetWriteNodeId: `write:${id}`,
        datasetNodeId: `dataset:${id}`,
        qualifiedName: "dm.party",
      })),
    },
  };
  const evidence = {
    bindings: ["a", "b", "unknown"].map((id) => ({
      target_field: "pty_id",
      target_dataset: "dm.party",
      write_observation_id: id,
      expression_id: "expr",
    })),
    expressions: [{ expression_id: "expr", expression_text: "id AS pty_id" }],
    relations: [],
    datasetIo: [],
    statements: [],
    sqlSources: [],
  };
  const save = () => {
    writeFileSync(
      projectionPath,
      JSON.stringify({
        cacheKey: "b".repeat(64),
        cacheKeyParts: {
          taskId: "task",
          packContentHash: "c".repeat(64),
          factsManifestSha256: "d".repeat(64),
          schemaVersion: "1.3.0",
        },
        projectionContentHash: "a".repeat(64),
        projection,
      }),
    );
    writeFileSync(evidencePath, JSON.stringify(evidence));
  };
  save();
  writeFileSync(
    manifestPath,
    JSON.stringify({
      tasks: [
        {
          taskId: "task",
          path: projectionPath,
          contentHash: "a".repeat(64),
          evidencePath,
        },
      ],
    }),
  );
  const store = {
    ready: async () => ({ version: "published-version", manifestPath }),
  } as unknown as AssetGraphStore;
  const resolveMany = vi.fn<TableMetadataResolver["resolveMany"]>(
    async (requests) =>
      requests.map(({ identity }) => ({
        table: { status: "AVAILABLE" },
        field:
          identity?.identityStatus === "CONFIRMED"
            ? {
                status: "AVAILABLE",
                comment: `${identity.dataSource} 的当事人编号`,
              }
            : {
                status: "METADATA_UNAVAILABLE",
                reason: "PHYSICAL_IDENTITY_INCOMPLETE",
              },
        metadataCatalog: { status: "READY", version: "metadata-version" },
      })),
  );
  return {
    store,
    projection,
    evidence,
    save,
    resolveMany,
    projectionPath,
    manifestPath,
    evidencePath,
  };
}

describe("processing evidence field metadata", () => {
  it("matches each write to its physical source, even with the same table and column names", async () => {
    const f = fixture();
    const detail = await taskDetail(
      f.store,
      "task",
      undefined,
      undefined,
      false,
      f,
    );
    expect(
      detail.bindings.map((binding) => binding.metadata?.field?.comment),
    ).toEqual(["a 的当事人编号", "b 的当事人编号", undefined]);
    expect(detail.bindings[2]?.metadata?.field?.status).toBe(
      "METADATA_UNAVAILABLE",
    );
    expect(
      detail.bindings.every((binding) => binding.expression === "id AS pty_id"),
    ).toBe(true);
    expect(detail.version).toBe("published-version");
    expect(detail.bindings.map((binding) => binding.outputScope)).toEqual([
      "FINAL",
      "FINAL",
      "OTHER",
    ]);
  });

  it("leaves ambiguous, conflicting and uncertain identities unavailable", async () => {
    const f = fixture();
    f.projection.localClosure.finalWrites.push({
      ...f.projection.localClosure.finalWrites[1]!,
      writeObservationId: "a",
    });
    f.projection.nodes[1]!.properties.identityStatus = "CANDIDATE_DATASET";
    f.save();
    await taskDetail(f.store, "task", undefined, undefined, false, f);
    expect(
      f.resolveMany.mock.calls[0]?.[0].map(
        ({ identity }) => identity?.identityStatus,
      ),
    ).toEqual([undefined, undefined, undefined]);

    const mismatch = fixture();
    mismatch.evidence.bindings[0]!.target_dataset = "dm.another_party";
    mismatch.save();
    await taskDetail(mismatch.store, "task", "pty_id", "a", false, mismatch);
    expect(
      mismatch.resolveMany.mock.calls[0]?.[0][0]?.identity,
    ).toBeUndefined();
  });

  it("preserves write filtering and SQL content while resolving only requested fields", async () => {
    const f = fixture();
    const detail = await taskDetail(f.store, "task", "PTY_ID", "b", true, f);
    expect(detail.bindings).toHaveLength(1);
    expect(detail.bindings[0]?.metadata?.field?.comment).toBe("b 的当事人编号");
    expect(f.resolveMany.mock.calls[0]?.[0]).toHaveLength(1);
    expect(detail.sqlSources).toEqual([]);
  });

  it("retains expressions and reports metadata failure if the projection cannot be read", async () => {
    const f = fixture();
    writeFileSync(f.projectionPath, "invalid json");
    const detail = await taskDetail(
      f.store,
      "task",
      undefined,
      undefined,
      false,
      f,
    );
    expect(detail.bindings[0]?.expression).toBe("id AS pty_id");
    expect(detail.bindings[0]?.metadata?.field?.status).toBe(
      "METADATA_READ_FAILED",
    );
    const legacy = await taskDetail(f.store, "task");
    expect(legacy.bindings[0]?.metadata).toBeUndefined();
    expect(detail.bindings[0]?.outputScope).toBe("UNKNOWN");
  });

  it("does not use metadata identities from a projection with a different published hash", async () => {
    const f = fixture();
    f.projection.contentHash = "e".repeat(64);
    f.save();
    const detail = await taskDetail(
      f.store,
      "task",
      undefined,
      undefined,
      false,
      f,
    );
    expect(f.resolveMany).not.toHaveBeenCalled();
    expect(detail.bindings[0]?.metadata?.field?.status).toBe(
      "METADATA_READ_FAILED",
    );
    expect(detail.bindings[0]?.expression).toBe("id AS pty_id");
  });
});
