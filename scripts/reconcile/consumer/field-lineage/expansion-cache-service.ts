import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { existsSync, realpathSync } from "node:fs";

import {
  canonicalJson,
  sha256,
} from "../../../machine-facts/machine-facts-contract.ts";
import {
  canonicalHash,
  type JsonValue,
} from "../../../input/shared/input-pack.ts";
import { physicalTableKey } from "../../../machine-facts/input-pack-machine-facts.ts";
import { assertOutputOutsideDataRoot } from "../../producer/producer-index.ts";
import type { CurrentBundleLoad, JsonRecord } from "../../../query/current-task-bundle.ts";
import {
  FIELD_EXPANSION_CACHE_ALGORITHM_VERSION,
  FIELD_EXPANSION_CACHE_CONTRACT_VERSION,
  FIELD_EXPANSION_CACHE_SCHEMA_VERSION,
  fieldExpansionCacheKey,
  fieldExpansionCachePayloadSha256,
  hasOnlyLogicalLocators,
  type CachedPhysicalFieldExpansion,
  type FieldExpansionCacheDependency,
  type FieldExpansionCacheEntry,
  type FieldExpansionCacheRequest,
} from "./expansion-cache-contract.ts";
import {
  FileExpansionCacheStore,
  type ExpansionCacheStore,
} from "./expansion-cache-store.ts";
import {
  type PhysicalFieldExpanderLike,
  type PhysicalFieldExpansion,
  type PhysicalFieldExpansionRequest,
  type PhysicalFieldProducerExpansion,
  type PhysicalFieldExpanderTaskPackLookup,
} from "./physical-field-expander.ts";
import { physicalFieldKey, type FactsPolicy } from "./field-lineage-contract.ts";

export interface ExpansionCacheCounters {
  hits: number;
  misses: number;
  writes: number;
  stale: number;
  corrupt: number;
}

export interface CachedPhysicalFieldExpanderOptions {
  readonly cacheRoot: string;
  readonly dataRoot: string;
  readonly factsRoot: string;
  readonly tableLineage: JsonRecord;
  readonly taskPacks: PhysicalFieldExpanderTaskPackLookup;
  readonly loadFacts: (taskId: string) => CurrentBundleLoad;
  readonly factsPolicy: FactsPolicy;
  readonly counters?: ExpansionCacheCounters;
  readonly store?: ExpansionCacheStore;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function pathFreeProjection(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(pathFreeProjection);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => {
        const normalized = key.toLowerCase();
        return (
          normalized !== "generatedat" &&
          normalized !== "collectedat" &&
          normalized !== "contenthash" &&
          normalized !== "evidence" &&
          normalized !== "path" &&
          normalized !== "locator" &&
          !normalized.endsWith("filepath") &&
          !normalized.endsWith("physicalpath") &&
          !normalized.endsWith("sourcepath") &&
          !normalized.endsWith("bundlepath") &&
          !normalized.endsWith("taskpath") &&
          !normalized.endsWith("tablepath") &&
          !normalized.endsWith("ddlpath") &&
          !normalized.endsWith("indexpath") &&
          !normalized.endsWith("statuspath") &&
          !normalized.endsWith("bundledir")
        );
      })
      .map(([key, item]) => [key, pathFreeProjection(item)]),
  );
}

function contentHash(value: unknown, preferred: unknown): string {
  return isSha256(preferred)
    ? preferred
    : sha256(canonicalJson(pathFreeProjection(value)));
}

function taskPackContentHash(
  pack: ReturnType<PhysicalFieldExpanderTaskPackLookup["get"]>,
): string | null {
  if (!pack) return null;
  return contentHash(pack.document, pack.document.contentHash);
}

function factsManifestSha256(load: CurrentBundleLoad): string | null {
  return isSha256(load.manifestSha256) ? load.manifestSha256 : null;
}

function producerTargetIdentity(
  pack: ReturnType<PhysicalFieldExpanderTaskPackLookup["get"]>,
): string | null {
  const target = pack?.target;
  if (!target) return null;
  return sha256(
    canonicalJson({
      physicalTableKey: physicalTableKey(target),
      tableContentHash: target.tableContentHash,
      ddlSha256: target.ddlSha256,
    }),
  );
}

function tableLineageContentHash(tableLineage: JsonRecord): string | null {
  const declaredHash = tableLineage.contentHash;
  if (!isSha256(declaredHash)) return null;
  try {
    return canonicalHash(
      tableLineage as unknown as JsonValue,
      ["generatedAt", "contentHash"],
    ) === declaredHash
      ? declaredHash
      : null;
  } catch {
    return null;
  }
}

export function realPathWithMissingSuffix(
  input: string,
  realpath: (path: string) => string = realpathSync.native,
): string {
  let candidate = resolve(input);
  const missingSuffix: string[] = [];
  while (!existsSync(candidate)) {
    const parent = dirname(candidate);
    if (parent === candidate) return candidate;
    missingSuffix.unshift(basename(candidate));
    candidate = parent;
  }
  try {
    return resolve(realpath(candidate), ...missingSuffix);
  } catch {
    throw new Error("EXPANSION_CACHE_ROOT_REALPATH_UNAVAILABLE");
  }
}

function pathsOverlap(left: string, right: string): boolean {
  const relativePath = relative(left, right);
  return (
    relativePath === "" ||
    (!isAbsolute(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`))
  );
}

export function assertExpansionCacheStorageOutsideInputRoots(
  dataRoot: string,
  factsRoot: string,
  cacheRoot: string,
  realpath: (path: string) => string = realpathSync.native,
): void {
  const storageRoot = realPathWithMissingSuffix(
    join(resolve(cacheRoot), "field-expansion-v1"),
    realpath,
  );
  for (const inputRoot of [dataRoot, factsRoot]) {
    const resolvedInputRoot = realPathWithMissingSuffix(inputRoot, realpath);
    if (
      pathsOverlap(storageRoot, resolvedInputRoot) ||
      pathsOverlap(resolvedInputRoot, storageRoot)
    ) {
      throw new Error("EXPANSION_CACHE_STORAGE_ROOT_OVERLAPS_INPUT_ROOT");
    }
  }
}

function cacheRequest(
  options: CachedPhysicalFieldExpanderOptions,
  request: PhysicalFieldExpansionRequest,
): FieldExpansionCacheRequest | null {
  const lineageHash = tableLineageContentHash(options.tableLineage);
  if (lineageHash === null) return null;
  return {
    cacheContractVersion: FIELD_EXPANSION_CACHE_CONTRACT_VERSION,
    algorithmVersion: FIELD_EXPANSION_CACHE_ALGORITHM_VERSION,
    factsPolicy: options.factsPolicy,
    tableLineageContentHash: lineageHash,
    consumerTaskPackContentHash: taskPackContentHash(
      request.consumerPack,
    ),
    consumerFactsManifestSha256: factsManifestSha256(request.consumerLoad),
    consumerFactsState: request.consumerLoad.state,
    consumerTaskId: request.consumerTaskId,
    sourceNodeId: request.sourceNodeId,
    physicalFieldKey: physicalFieldKey(request.source),
    expression: pathFreeProjection({
      expressionText: request.expressionText,
      expression: request.expression ?? null,
    }),
  };
}

interface DependencyStateResult {
  readonly snapshot: FieldExpansionCacheDependency;
  readonly readError: boolean;
}

function dependencyState(
  taskId: string,
  options: CachedPhysicalFieldExpanderOptions,
): DependencyStateResult {
  let readError = false;
  let pack: ReturnType<PhysicalFieldExpanderTaskPackLookup["get"]>;
  try {
    pack = options.taskPacks.get(taskId);
  } catch {
    readError = true;
    pack = undefined;
  }
  let facts: CurrentBundleLoad | undefined;
  try {
    facts = options.loadFacts(taskId);
  } catch {
    readError = true;
    facts = undefined;
  }
  const taskPackHash = taskPackContentHash(pack);
  const factsHash = facts ? factsManifestSha256(facts) : null;
  return {
    readError,
    snapshot: {
      taskId,
      taskPackPresent: taskPackHash !== null,
      taskPackContentHash: taskPackHash,
      factsPresent: factsHash !== null,
      factsManifestSha256: factsHash,
      factsState: facts?.state ?? "MISSING",
      producerTargetIdentity: producerTargetIdentity(pack),
    },
  };
}

function dependenciesFor(
  expansion: PhysicalFieldExpansion,
  options: CachedPhysicalFieldExpanderOptions,
): readonly FieldExpansionCacheDependency[] | null {
  const taskIds = new Set([
    ...expansion.consultedProducerTaskIds,
    ...expansion.producers.map((producer) => producer.producerTaskId),
    ...expansion.candidates.map((candidate) => candidate.producerTaskId),
  ]);
  const dependencies: FieldExpansionCacheDependency[] = [];
  for (const taskId of [...taskIds].sort()) {
    const state = dependencyState(taskId, options);
    if (state.readError) return null;
    dependencies.push(state.snapshot);
  }
  return dependencies;
}

function currentDependencyMatches(
  dependency: FieldExpansionCacheDependency,
  options: CachedPhysicalFieldExpanderOptions,
): boolean {
  const current = dependencyState(dependency.taskId, options);
  if (current.readError) return false;
  return (
    current.snapshot.taskPackPresent === dependency.taskPackPresent &&
    current.snapshot.taskPackContentHash === dependency.taskPackContentHash &&
    current.snapshot.factsPresent === dependency.factsPresent &&
    current.snapshot.factsManifestSha256 === dependency.factsManifestSha256 &&
    current.snapshot.factsState === dependency.factsState &&
    current.snapshot.producerTargetIdentity === dependency.producerTargetIdentity
  );
}

function expansionHasOnlyLogicalEvidence(
  expansion: unknown,
): boolean {
  return hasOnlyLogicalLocators(expansion);
}

function toCachedExpansion(
  expansion: PhysicalFieldExpansion,
): CachedPhysicalFieldExpansion {
  return {
    ...expansion,
    producers: expansion.producers.map(({ producerPack: _producerPack, ...producer }) =>
      producer,
    ),
  };
}

function fromCachedExpansion(
  expansion: CachedPhysicalFieldExpansion,
  taskPacks: PhysicalFieldExpanderTaskPackLookup,
): PhysicalFieldExpansion {
  return {
    ...expansion,
    producers: expansion.producers.map((producer) => ({
      ...producer,
      producerPack: taskPacks.get(producer.producerTaskId) ?? null,
    })),
  };
}

export class CachedPhysicalFieldExpander implements PhysicalFieldExpanderLike {
  private readonly store: ExpansionCacheStore;
  private readonly counters: ExpansionCacheCounters;

  public constructor(
    private readonly delegate: PhysicalFieldExpanderLike,
    private readonly options: CachedPhysicalFieldExpanderOptions,
  ) {
    assertOutputOutsideDataRoot(options.dataRoot, options.cacheRoot);
    assertOutputOutsideDataRoot(options.factsRoot, options.cacheRoot);
    assertExpansionCacheStorageOutsideInputRoots(
      options.dataRoot,
      options.factsRoot,
      options.cacheRoot,
    );
    this.store = options.store ?? new FileExpansionCacheStore(resolve(options.cacheRoot));
    this.counters = options.counters ?? {
      hits: 0,
      misses: 0,
      writes: 0,
      stale: 0,
      corrupt: 0,
    };
  }

  public expand(request: PhysicalFieldExpansionRequest): PhysicalFieldExpansion {
    const identity = cacheRequest(this.options, request);
    if (identity === null) {
      this.counters.misses += 1;
      return this.delegate.expand(request);
    }
    const key = fieldExpansionCacheKey(identity);
    let cached: ReturnType<ExpansionCacheStore["read"]>;
    try {
      cached = this.store.read(key);
    } catch {
      cached = { status: "CORRUPT" };
    }
    if (cached.status === "VALID") {
      const validDependencies = cached.entry.dependencies.every((dependency) =>
        currentDependencyMatches(dependency, this.options),
      );
      if (validDependencies) {
        try {
          const expansion = fromCachedExpansion(
            cached.entry.expansion,
            this.options.taskPacks,
          );
          this.counters.hits += 1;
          return expansion;
        } catch {
          this.counters.corrupt += 1;
        }
      } else this.counters.stale += 1;
    } else if (cached.status === "CORRUPT") this.counters.corrupt += 1;
    this.counters.misses += 1;

    const expansion = this.delegate.expand(request);
    const cachedExpansion = toCachedExpansion(expansion);
    if (!expansionHasOnlyLogicalEvidence(cachedExpansion)) return expansion;
    const dependencies = dependenciesFor(expansion, this.options);
    if (dependencies === null) return expansion;
    const payload = {
      schemaVersion: FIELD_EXPANSION_CACHE_SCHEMA_VERSION,
      key,
      request: identity,
      dependencies,
      expansion: cachedExpansion,
    };
    const entry: FieldExpansionCacheEntry = {
      ...payload,
      payloadSha256: fieldExpansionCachePayloadSha256(payload),
    };
    try {
      this.store.write(entry);
      this.counters.writes += 1;
    } catch {
      // Cache persistence is advisory; lineage output remains authoritative.
    }
    return expansion;
  }
}

export function createCachedPhysicalFieldExpander(
  delegate: PhysicalFieldExpanderLike,
  options: CachedPhysicalFieldExpanderOptions,
): CachedPhysicalFieldExpander {
  return new CachedPhysicalFieldExpander(delegate, options);
}

export function createExpansionCacheCounters(): ExpansionCacheCounters {
  return { hits: 0, misses: 0, writes: 0, stale: 0, corrupt: 0 };
}
