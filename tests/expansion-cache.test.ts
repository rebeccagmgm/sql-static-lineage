import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  canonicalHash,
  type JsonValue,
} from "../scripts/input/shared/input-pack.ts";
import type { CurrentBundleLoad } from "../scripts/query/current-task-bundle.ts";
import {
  fieldExpansionCacheKey,
  type FieldExpansionCacheEntry,
  type FieldExpansionCacheRequest,
} from "../scripts/reconcile/consumer/field-lineage/expansion-cache-contract.ts";
import {
  createCachedPhysicalFieldExpander,
  createExpansionCacheCounters,
  assertExpansionCacheStorageOutsideInputRoots,
  realPathWithMissingSuffix,
} from "../scripts/reconcile/consumer/field-lineage/expansion-cache-service.ts";
import {
  FileExpansionCacheStore,
  writeCacheBytes,
} from "../scripts/reconcile/consumer/field-lineage/expansion-cache-store.ts";
import type {
  PhysicalFieldExpanderLike,
  PhysicalFieldExpanderTaskPack,
  PhysicalFieldExpansion,
  PhysicalFieldExpansionRequest,
} from "../scripts/reconcile/consumer/field-lineage/physical-field-expander.ts";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);

function canonicalTableLineage(value: Record<string, unknown> = {}): Record<string, unknown> {
  const { contentHash: _contentHash, ...withoutHash } = value;
  return {
    ...withoutHash,
    contentHash: canonicalHash(
      withoutHash as unknown as JsonValue,
      ["generatedAt", "contentHash"],
    ),
  };
}

const VALID_TABLE_LINEAGE_HASH = canonicalTableLineage().contentHash as string;

function field() {
  return {
    platform: "hive",
    dataSource: "warehouse",
    stableTableId: "demo.source__warehouse",
    qualifiedName: "demo.source",
    column: "src_a",
    identityStatus: "SCHEMA_BACKED" as const,
  };
}

function pack(taskId: string, contentHash: string): PhysicalFieldExpanderTaskPack {
  return {
    document: { taskId, contentHash } as PhysicalFieldExpanderTaskPack["document"],
    path: `C:\\relocated\\tasks\\${taskId}\\task.json`,
    target: null,
  };
}

function load(taskId: string, manifestSha256: string): CurrentBundleLoad {
  return {
    state: "CURRENT_L1",
    factsRoot: "C:\\relocated\\facts",
    taskId,
    bundleDir: `C:\\relocated\\facts\\${taskId}`,
    indexPath: "C:\\relocated\\facts\\index.jsonl",
    statusPath: `C:\\relocated\\facts\\${taskId}\\analysis-status.json`,
    manifest: { schema_version: "2.0.0" },
    manifestSha256,
    records: {},
    evidence: { "dataset-io.jsonl": `machine-facts:tasks/${taskId}/dataset-io.jsonl` },
    issues: [],
  };
}

function request(consumer: PhysicalFieldExpanderTaskPack, consumerLoad: CurrentBundleLoad): PhysicalFieldExpansionRequest {
  return {
    consumerTaskId: "consumer",
    consumerPack: consumer,
    consumerLoad,
    sourceNodeId: "field-source-node:consumer:src_a",
    source: field(),
    expressionText: "s.src_a",
    expression: { expression_id: "expression:consumer:0", expression_text: "s.src_a" },
  };
}

function expansion(producerPack: PhysicalFieldExpanderTaskPack): PhysicalFieldExpansion {
  return {
    classified: true,
    ambiguous: false,
    consultedProducerTaskIds: ["producer"],
    reachablePrimaryProducerTaskIds: ["producer"],
    producers: [
      {
        producerTaskId: "producer",
        producerPack,
        producerField: field(),
        producerBindings: [],
        bridge: null,
        bridges: [],
        producerRole: "PRIMARY",
        evidenceStatus: "CONFIRMED",
        evidenceRefs: ["field-lineage:consumer-read:consumer:read-1"],
        shouldRecurse: true,
      },
    ],
    candidates: [],
    gaps: [],
  };
}

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "field-expansion-cache-"));
  const dataRoot = join(parent, "data");
  const factsRoot = join(parent, "facts");
  const cacheRoot = join(parent, "cache");
  const packs = new Map([
    ["consumer", pack("consumer", HASH_A)],
    ["producer", pack("producer", HASH_B)],
  ]);
  const loads = new Map([
    ["consumer", load("consumer", HASH_C)],
    ["producer", load("producer", HASH_D)],
  ]);
  let calls = 0;
  const delegate: PhysicalFieldExpanderLike = {
    expand: () => {
      calls += 1;
      return expansion(packs.get("producer")!);
    },
  };
  const counters = createExpansionCacheCounters();
  const make = (sharedCounters = counters, tableLineage: Record<string, unknown> = canonicalTableLineage()) =>
    createCachedPhysicalFieldExpander(delegate, {
      cacheRoot,
      dataRoot,
      factsRoot,
      tableLineage,
      taskPacks: { get: (taskId) => packs.get(taskId) },
      loadFacts: (taskId) => loads.get(taskId)!,
      factsPolicy: "current-only",
      counters: sharedCounters,
    });
  return {
    cacheRoot,
    packs,
    loads,
    request: () => request(packs.get("consumer")!, loads.get("consumer")!),
    make,
    counters,
    get calls() {
      return calls;
    },
  };
}

describe("field expansion cache", () => {
  it("reuses a context-free expansion and reattaches the current producer pack", () => {
    const f = setup();
    const first = f.make();
    const firstResult = first.expand(f.request());
    const second = f.make();
    const secondResult = second.expand(f.request());

    expect(f.calls).toBe(1);
    expect(f.counters).toEqual({ hits: 1, misses: 1, writes: 1, stale: 0, corrupt: 0 });
    expect(secondResult).toEqual(firstResult);
    expect(secondResult.producers[0]!.producerPack).toBe(f.packs.get("producer"));
    const cacheFiles = readdirSync(join(f.cacheRoot, "field-expansion-v1"), { recursive: true });
    expect(cacheFiles.some((value) => String(value).endsWith(".json"))).toBe(true);
    expect(readFileSync(join(f.cacheRoot, "field-expansion-v1", String(cacheFiles.find((value) => String(value).endsWith(".json")))), "utf8")).not.toContain("relocated");
  });

  it("invalidates only entries whose consulted producer changes", () => {
    const f = setup();
    const expander = f.make();
    expander.expand(f.request());
    f.packs.set("unrelated", pack("unrelated", "e".repeat(64)));
    const warm = f.make();
    warm.expand(f.request());
    expect(f.counters.hits).toBe(1);

    f.packs.set("producer", pack("producer", "f".repeat(64)));
    const stale = f.make();
    stale.expand(f.request());
    expect(f.counters.stale).toBe(1);

    f.loads.set("producer", load("producer", "0".repeat(64)));
    const staleFacts = f.make();
    staleFacts.expand(f.request());
    expect(f.counters.stale).toBe(2);
    expect(f.counters.misses).toBe(3);
    expect(f.calls).toBe(3);
  });

  it("misses when consumer identity or expression content changes", () => {
    const f = setup();
    const expander = f.make();
    expander.expand(f.request());

    f.packs.set("consumer", pack("consumer", "1".repeat(64)));
    const changedConsumer = f.make();
    changedConsumer.expand(f.request());
    const changedExpression = f.make();
    changedExpression.expand({ ...f.request(), expressionText: "s.other_a" });

    expect(f.counters.hits).toBe(0);
    expect(f.counters.misses).toBe(3);
    expect(f.calls).toBe(3);
  });

  it("does not cache a table lineage artifact when its content hash is absent", () => {
    const f = setup();
    const counters = createExpansionCacheCounters();
    const first = f.make(counters, {
      writeEdges: [{ writes: [{ evidence: [{ locator: "machine-facts:old" }] }] }],
    });
    first.expand(f.request());
    const second = f.make(counters, {
      writeEdges: [{ writes: [{ evidence: [{ locator: "machine-facts:new" }] }] }],
    });
    second.expand(f.request());

    expect(f.calls).toBe(2);
    expect(counters).toEqual({ hits: 0, misses: 2, writes: 0, stale: 0, corrupt: 0 });
  });

  it("does not cache a table lineage artifact whose valid hash no longer matches its content", () => {
    const f = setup();
    const original = canonicalTableLineage({
      writeEdges: [{ writes: [{ evidence: [] }] }],
    });
    const tampered = {
      ...original,
      writeEdges: [{ writes: [{ evidence: [{ kind: "changed" }] }] }],
    };
    const counters = createExpansionCacheCounters();
    f.make(counters, tampered).expand(f.request());
    f.make(counters, tampered).expand(f.request());

    expect(f.calls).toBe(2);
    expect(counters).toEqual({ hits: 0, misses: 2, writes: 0, stale: 0, corrupt: 0 });
  });

  it("falls back from a corrupt entry and atomically leaves a complete final JSON file", () => {
    const f = setup();
    const first = f.make();
    first.expand(f.request());
    const cacheRequest: FieldExpansionCacheRequest = {
      cacheContractVersion: "field-expansion-cache-v1",
      algorithmVersion: "physical-field-expander-v2",
      factsPolicy: "current-only",
      tableLineageContentHash: VALID_TABLE_LINEAGE_HASH,
      consumerTaskPackContentHash: HASH_A,
      consumerFactsManifestSha256: HASH_C,
      consumerFactsState: "CURRENT_L1",
      consumerTaskId: "consumer",
      sourceNodeId: "field-source-node:consumer:src_a",
      physicalFieldKey: "hive|warehouse|demo.source__warehouse|demo.source|src_a",
      expression: { expressionText: "s.src_a", expression: { expression_id: "expression:consumer:0", expression_text: "s.src_a" } },
    };
    const key = fieldExpansionCacheKey(cacheRequest);
    const path = join(f.cacheRoot, "field-expansion-v1", key.slice(0, 2), `${key}.json`);
    expect(existsSync(path)).toBe(true);
    writeFileSync(path, "{not-json", "utf8");

    const counters = createExpansionCacheCounters();
    const recovered = f.make(counters);
    recovered.expand(f.request());
    expect(counters).toEqual({ hits: 0, misses: 1, writes: 1, stale: 0, corrupt: 1 });
    expect(() => JSON.parse(readFileSync(path, "utf8"))).not.toThrow();
    expect(readdirSync(join(f.cacheRoot, "field-expansion-v1"), { recursive: true }).some((value) => String(value).includes("staged-"))).toBe(false);
  });

  it("misses when dependency validation cannot read a Task Pack or facts bundle", () => {
    const f = setup();
    const first = f.make();
    first.expand(f.request());
    const counters = createExpansionCacheCounters();
    let delegateCalls = 0;
    const failing = createCachedPhysicalFieldExpander(
      {
        expand: () => {
          delegateCalls += 1;
          return expansion(f.packs.get("producer")!);
        },
      },
      {
        cacheRoot: f.cacheRoot,
        dataRoot: join(f.cacheRoot, "..", "data-for-failing-read"),
        factsRoot: join(f.cacheRoot, "..", "facts-for-failing-read"),
        tableLineage: canonicalTableLineage(),
        taskPacks: { get: () => { throw new Error("pack read failed"); } },
        loadFacts: () => { throw new Error("facts read failed"); },
        factsPolicy: "current-only",
        counters,
      },
    );

    expect(() => failing.expand(f.request())).not.toThrow();
    expect(delegateCalls).toBe(1);
    expect(counters).toEqual({ hits: 0, misses: 1, writes: 0, stale: 1, corrupt: 0 });
  });

  it("rejects a semantically modified entry even when its JSON remains valid", () => {
    const f = setup();
    f.make().expand(f.request());
    const cacheFile = readdirSync(join(f.cacheRoot, "field-expansion-v1"), { recursive: true })
      .map(String)
      .find((value) => value.endsWith(".json"))!;
    const path = join(f.cacheRoot, "field-expansion-v1", cacheFile);
    const entry = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    const cachedExpansion = entry.expansion as Record<string, unknown>;
    cachedExpansion.classified = false;
    writeFileSync(path, JSON.stringify(entry), "utf8");

    const counters = createExpansionCacheCounters();
    f.make(counters).expand(f.request());
    expect(counters).toEqual({ hits: 0, misses: 1, writes: 1, stale: 0, corrupt: 1 });
  });

  it("detects short cache writes", () => {
    expect(() => writeCacheBytes(new Uint8Array([1, 2]), () => 1)).toThrow("CACHE_WRITE_SHORT");
    expect(() => writeCacheBytes(new Uint8Array([1, 2]), (bytes) => bytes.byteLength)).not.toThrow();

    const f = setup();
    f.make().expand(f.request());
    const cacheFile = readdirSync(join(f.cacheRoot, "field-expansion-v1"), { recursive: true })
      .map(String)
      .find((value) => value.endsWith(".json"))!;
    const path = join(f.cacheRoot, "field-expansion-v1", cacheFile);
    const entry = JSON.parse(readFileSync(path, "utf8")) as FieldExpansionCacheEntry;
    const shortStore = new FileExpansionCacheStore(f.cacheRoot, {
      writeBytes: () => 1,
    });
    expect(() => shortStore.write(entry)).toThrow("CACHE_WRITE_SHORT");

    let renameCalls = 0;
    const failedPublishStore = new FileExpansionCacheStore(f.cacheRoot, {
      renameFile: (source, destination) => {
        renameCalls += 1;
        if (renameCalls === 2) throw new Error("publish failed");
        renameSync(source, destination);
      },
    });
    expect(() => failedPublishStore.write(entry)).toThrow("publish failed");
    expect(() => JSON.parse(readFileSync(path, "utf8"))).not.toThrow();
    expect(readdirSync(join(f.cacheRoot, "field-expansion-v1"), { recursive: true })
      .map(String)
      .some((value) => value.includes("staged-") || value.includes("previous-"))).toBe(false);
  });

  it("rejects cache roots inside either input root", () => {
    const f = setup();
    expect(() => f.make()).not.toThrow();
    expect(() =>
      createCachedPhysicalFieldExpander(
        { expand: () => expansion(f.packs.get("producer")!) },
        {
          cacheRoot: join(f.cacheRoot, "nested"),
          dataRoot: f.cacheRoot,
          factsRoot: join(f.cacheRoot, "facts"),
          tableLineage: { contentHash: HASH_C },
          taskPacks: { get: (taskId) => f.packs.get(taskId) },
          loadFacts: (taskId) => f.loads.get(taskId)!,
          factsPolicy: "current-only",
        },
      ),
    ).toThrow("OUTPUT_MUST_BE_OUTSIDE_INPUT_PACK_ROOT");

    expect(() =>
      assertExpansionCacheStorageOutsideInputRoots(
        join(f.cacheRoot, "field-expansion-v1", "nested-data"),
        join(f.cacheRoot, "other-facts"),
        f.cacheRoot,
      ),
    ).toThrow("EXPANSION_CACHE_STORAGE_ROOT_OVERLAPS_INPUT_ROOT");
  });

  it("fails closed when the existing cache ancestor cannot be realpathed", () => {
    const f = setup();
    f.make().expand(f.request());
    const realpathUnavailable = () => {
      throw new Error("realpath denied");
    };

    expect(() =>
      realPathWithMissingSuffix(
        join(f.cacheRoot, "field-expansion-v1", "future"),
        realpathUnavailable,
      ),
    ).toThrow("EXPANSION_CACHE_ROOT_REALPATH_UNAVAILABLE");
    expect(() =>
      assertExpansionCacheStorageOutsideInputRoots(
        join(f.cacheRoot, "data"),
        join(f.cacheRoot, "facts"),
        f.cacheRoot,
        realpathUnavailable,
      ),
    ).toThrow("EXPANSION_CACHE_ROOT_REALPATH_UNAVAILABLE");
  });
});
