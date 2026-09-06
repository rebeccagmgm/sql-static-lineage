import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { canonicalizeTaskLocalProjection } from "../../../scripts/project-graph/task-local/contract.ts";
import { previewAssetCatalog } from "../src/asset-graph/catalog-preview.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "asset-catalog-preview-"));
  directories.push(directory);
  const projection = canonicalizeTaskLocalProjection({
    schemaVersion: "1.3.0",
    artifactType: "TASK_LOCAL_PROJECTION",
    taskId: "42",
    generatedAt: "2026-09-05T00:00:00.000Z",
    coverageStatus: "SCHEDULE_ONLY",
    failureReasonCode: null,
    nodes: [{ nodeId: "task:42", nodeType: "TASK", properties: {} }],
    edges: [],
    gaps: [],
  });
  const envelope = {
    cacheKey: "a".repeat(64),
    projectionContentHash: projection.contentHash,
    projection,
    cacheKeyParts: {
      taskId: "42",
      schemaVersion: "1.3.0",
      packContentHash: "b".repeat(64),
      factsManifestSha256: "c".repeat(64),
    },
  };
  const projectionPath = join(directory, "projection.json");
  const outputPath = join(directory, "preview.json");
  writeFileSync(projectionPath, JSON.stringify(envelope));
  return { envelope, projectionPath, outputPath };
}

describe("offline catalogue preview", () => {
  it("reads the real disk-envelope shape without claiming publication validation", () => {
    const input = fixture();
    expect(previewAssetCatalog(input).taskId).toBe("42");
    const preview = JSON.parse(readFileSync(input.outputPath, "utf8"));
    expect(preview.sourceValidation).toBe("LOCAL_PROJECTION_HASH_VERIFIED");
    expect(preview.publicationManifestValidation).toBe("NOT_EVALUATED");
    expect(preview.summary.crossTaskContinuation).toBe("NOT_EVALUATED");
  });

  it("rejects changed projection content even when declared envelope hashes still agree", () => {
    const input = fixture();
    const changed = {
      ...input.envelope,
      projection: {
        ...input.envelope.projection,
        nodes: input.envelope.projection.nodes.map((node) => ({
          ...node,
          properties: { taskName: "changed" },
        })),
      },
    };
    writeFileSync(input.projectionPath, JSON.stringify(changed));
    expect(() => previewAssetCatalog(input)).toThrow(
      "TASK_LOCAL_PROJECTION_CONTENT_HASH_INVALID",
    );
  });

  it("does not replace its input with a preview", () => {
    const input = fixture();
    const before = readFileSync(input.projectionPath, "utf8");
    expect(() =>
      previewAssetCatalog({ ...input, outputPath: input.projectionPath }),
    ).toThrow("ASSET_CATALOG_OUTPUT_OVERWRITES_INPUT");
    expect(readFileSync(input.projectionPath, "utf8")).toBe(before);
  });
});
