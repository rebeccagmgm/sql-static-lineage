import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  canonicalHash,
  canonicalJson,
  sha256Text,
  type JsonValue,
  writeTableInput,
} from "../scripts/input/shared/input-pack.ts";
import {
  buildTableProducerIndex,
  buildTableProducerInputManifest,
  createInputPackManifestMemo,
  pinTableProducerIndex,
  validateTableProducerInputManifest,
  writeTableProducerIndex,
  writeTableProducerInputManifest,
  type TableProducerInputManifest,
} from "../scripts/reconcile/producer/producer-index.ts";

function manifest(generation: number): TableProducerInputManifest {
  const packs: TableProducerInputManifest["packs"] = [];
  const withoutHash = {
    schemaVersion: "1.0.0" as const,
    artifactType: "TABLE_PRODUCER_INPUT_MANIFEST" as const,
    generatedAt: `2026-08-28T00:00:0${generation}.000Z`,
    generation,
    inputFingerprint: sha256Text(canonicalJson(packs as unknown as JsonValue)),
    packs,
  };
  return {
    ...withoutHash,
    contentHash: canonicalHash(withoutHash as unknown as JsonValue, ["generatedAt", "contentHash"]),
  };
}

function inputPackRoot(tableName: string): string {
  const root = mkdtempSync(join(tmpdir(), "sql-lineage-explicit-manifest-"));
  mkdirSync(join(root, "tasks"), { recursive: true });
  writeTableInput(root, {
    platform: "hive",
    dataSource: "gfhive",
    qualifiedName: `lake.${tableName}`,
    schema: "lake",
    name: tableName,
    objectType: "TABLE",
    ddl: `CREATE TABLE lake.${tableName} (id bigint)`,
    evidenceProvider: "fixture:table",
    collectedAt: "2026-08-28T00:00:00.000Z",
  });
  return root;
}

function prepareCache(root: string): {
  readonly cacheRoot: string;
  readonly indexPath: string;
  readonly manifestPath: string;
  readonly index: ReturnType<typeof buildTableProducerIndex>;
  readonly manifest: TableProducerInputManifest;
} {
  const manifest = buildTableProducerInputManifest(root, {
    now: () => "2026-08-28T00:00:00.000Z",
  });
  const index = buildTableProducerIndex(root, {
    now: () => "2026-08-28T00:00:00.000Z",
  });
  if (index.inputFingerprint !== manifest.inputFingerprint)
    throw new Error("TEST_MANIFEST_INDEX_FINGERPRINT_MISMATCH");
  const cacheRoot = mkdtempSync(join(tmpdir(), "sql-lineage-explicit-cache-"));
  const snapshotRoot = join(cacheRoot, manifest.inputFingerprint);
  const indexPath = join(snapshotRoot, "producer-index.json");
  const manifestPath = join(snapshotRoot, "producer-index.manifest.json");
  writeTableProducerIndex(indexPath, index);
  writeTableProducerInputManifest(manifestPath, manifest);
  return { cacheRoot, indexPath, manifestPath, index, manifest };
}

describe("Input Pack manifest memo", () => {
  it("captures once, validates the manifest, and captures again after invalidation", () => {
    const first = manifest(1);
    const second = manifest(2);
    let captureCount = 0;
    const memo = createInputPackManifestMemo("C:\\input-pack", {
      capture: () => {
        captureCount += 1;
        return captureCount === 1 ? first : second;
      },
    });

    expect(memo.get()).toBeUndefined();
    expect(memo.capture()).toBe(first);
    expect(memo.capture()).toBe(first);
    expect(memo.get()).toBe(first);
    expect(captureCount).toBe(1);
    expect(() => validateTableProducerInputManifest(memo.get())).not.toThrow();

    memo.invalidate();
    expect(memo.get()).toBeUndefined();
    expect(memo.capture()).toBe(second);
    expect(captureCount).toBe(2);
    expect(() => validateTableProducerInputManifest(memo.get())).not.toThrow();
  });

  it("uses an explicit manifest without invoking manifest capture", () => {
    const root = inputPackRoot("explicit");
    const cache = prepareCache(root);
    let captureCount = 0;
    const memo = createInputPackManifestMemo(root, {
      capture: () => {
        captureCount += 1;
        throw new Error("CAPTURE_MUST_NOT_RUN");
      },
    });

    const result = pinTableProducerIndex(root, cache.cacheRoot, {
      inputManifest: cache.manifest,
      inputPackManifestMemo: memo,
    });

    expect(result.reused).toBe(true);
    expect(result.inputFingerprint).toBe(cache.manifest.inputFingerprint);
    expect(result.indexPath).toBe(cache.indexPath);
    expect(result.manifestPath).toBe(cache.manifestPath);
    expect(captureCount).toBe(0);
    expect(memo.get()).toBeUndefined();
  });

  it("fails closed for an explicit manifest or cache mismatch", () => {
    const root = inputPackRoot("base");
    const cache = prepareCache(root);
    const other = prepareCache(inputPackRoot("other"));

    writeTableProducerIndex(cache.indexPath, other.index);
    expect(() =>
      pinTableProducerIndex(root, cache.cacheRoot, {
        inputManifest: cache.manifest,
      }),
    ).toThrow("EXPLICIT_INPUT_MANIFEST_CACHE_MISS");

    const corruptedManifest = {
      ...cache.manifest,
      contentHash: "0".repeat(64),
    } as TableProducerInputManifest;
    expect(() =>
      pinTableProducerIndex(root, cache.cacheRoot, {
        inputManifest: corruptedManifest,
      }),
    ).toThrow("contentHash");

    const corruptedRoot = inputPackRoot("corrupted");
    const corruptedCache = prepareCache(corruptedRoot);
    writeFileSync(corruptedCache.manifestPath, "{\"broken\":true}\n", "utf8");
    expect(() =>
      pinTableProducerIndex(corruptedRoot, corruptedCache.cacheRoot, {
        inputManifest: corruptedCache.manifest,
      }),
    ).toThrow("EXPLICIT_INPUT_MANIFEST_CACHE_MISS");
  });
});
