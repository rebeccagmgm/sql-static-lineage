import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  batchHashFromManifestPath,
  pruneGraphArtifactHistory,
} from "../src/asset-graph/prune-artifacts.ts";

describe("pruneGraphArtifactHistory", () => {
  it("keeps only the current published version and batch", () => {
    const root = mkdtempSync(join(tmpdir(), "graph-prune-"));
    const keepVersion = "current-version";
    const keepBatch = "current-batch";
    const dropVersion = "old-version";
    const dropBatch = "old-batch";

    mkdirSync(join(root, "published", keepVersion), { recursive: true });
    mkdirSync(join(root, "published", dropVersion), { recursive: true });
    mkdirSync(join(root, "batches", keepBatch), { recursive: true });
    mkdirSync(join(root, "batches", dropBatch), { recursive: true });
    mkdirSync(join(root, "union-continuation"), { recursive: true });
    writeFileSync(join(root, "union-continuation", "manifest.json"), "{}");

    const manifestPath = join(
      root,
      "batches",
      keepBatch,
      "batch-manifest.json",
    );
    writeFileSync(manifestPath, "{}");

    const result = pruneGraphArtifactHistory(root, {
      version: keepVersion,
      manifestPath,
    });

    expect(result.removedPublished).toEqual([dropVersion]);
    expect(result.removedBatches).toEqual([dropBatch]);
    expect(result.removedLegacy).toEqual(["union-continuation"]);
    expect(readdirSync(join(root, "published"))).toEqual([keepVersion]);
    expect(readdirSync(join(root, "batches"))).toEqual([keepBatch]);
    expect(existsSync(join(root, "union-continuation"))).toBe(false);
  });

  it("derives batch hash from manifest path", () => {
    expect(
      batchHashFromManifestPath(
        "/graphs/titans-otc/batches/abc123/batch-manifest.json",
      ),
    ).toBe("abc123");
  });

  it("protects a prepared publication while removing unreferenced history", () => {
    const root = mkdtempSync(join(tmpdir(), "graph-prune-references-"));
    for (const version of ["current", "prepared", "stale"])
      mkdirSync(join(root, "published", version), { recursive: true });
    for (const batch of ["current-batch", "prepared-batch", "stale-batch"])
      mkdirSync(join(root, "batches", batch), { recursive: true });
    const currentManifest = join(
      root,
      "batches",
      "current-batch",
      "batch-manifest.json",
    );
    const preparedManifest = join(
      root,
      "batches",
      "prepared-batch",
      "batch-manifest.json",
    );
    writeFileSync(currentManifest, "{}");
    writeFileSync(preparedManifest, "{}");

    const result = pruneGraphArtifactHistory(
      root,
      { version: "current", manifestPath: currentManifest },
      [{ version: "prepared", manifestPath: preparedManifest }],
    );

    expect(result.removedPublished).toEqual(["stale"]);
    expect(result.removedBatches).toEqual(["stale-batch"]);
  });
});
