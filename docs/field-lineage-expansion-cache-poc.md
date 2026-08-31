# Field Lineage Expansion Cache PoC

## Outcome

Reduce repeated field-level multi-hop work by persistently reusing context-free
`PhysicalFieldExpander` results across roots and process runs, while preserving the
existing `FieldLineageArtifact` bytes and conservative evidence behavior.

This PoC is a computation cache. It is not the cumulative KG, RootRevision store,
or Neo4j publisher. Those remain downstream consumers of unchanged lineage
artifacts.

## Scope

The PoC shall:

1. Make physical-field expansion independent of root-relative `depth` and
   `maxDepth`; traversal remains responsible for truncation and `MAX_DEPTH_REACHED`.
2. Add an optional persistent cache around `PhysicalFieldExpander.expand`.
3. Key entries from canonical content identity rather than source file paths.
4. Validate producer dependencies before accepting a cached result.
5. Treat corrupt, stale, or incompatible entries as cache misses.
6. Publish entries atomically so concurrent processes never observe partial JSON.
7. Expose cache hit, miss, write, stale, and corrupt counters in CLI timing output.
8. Preserve uncached behavior when no cache root is configured.

The PoC shall not:

- change `FieldLineageArtifact` schema or IDs;
- add RootRevision, active graph, JSONL graph store, or Neo4j integration;
- cache root-relative `depth`, active-path cycle state, path counts, or traversal
  limits;
- guess missing producer evidence or weaken Candidate/Gap behavior;
- mutate the Input Pack or Machine Facts roots.

## Cache boundary

The reusable value is one context-free source-field expansion:

```text
consumer OutputBinding / SourceReference
        -> selected producer bridge(s)
        -> exact producer WRITE/output binding(s)
        -> Candidate / Gap evidence
```

Root assembly still owns:

```text
frontier, active path, visited states, depth, maxDepth, maxStates, maxPaths
```

## Identity and invalidation

Each lookup uses a canonical request key containing at least:

- cache contract and algorithm versions;
- field-lineage facts policy;
- table-lineage artifact content hash;
- consumer Task Input Pack content hash;
- consumer Machine Facts manifest SHA-256;
- consumer Task ID and source node ID;
- physical field key;
- canonical expression identity/content projection.

An entry records every producer Task consulted, including its current Task Input
Pack content hash and Machine Facts manifest SHA-256 (or explicit absence). A hit
is valid only when all recorded dependency states still match. A producer Facts
or Input Pack change therefore invalidates only entries that consulted it.

Physical paths and `generatedAt` must not participate in cache identity. Evidence
locators may remain in the cached result only when they are logical locators; a
path relocation must not create a false hit with stale physical locators.

## Storage and concurrency

Entries use one file per request key:

```text
<cacheRoot>/field-expansion-v1/<key-prefix>/<key>.json
```

Writers create a unique temporary sibling, flush complete canonical JSON, then
atomically rename it to the final path. A racing writer may win; equivalent
content is acceptable. Invalid JSON, unsupported schema, key mismatch, or failed
dependency validation is a miss, never a fatal lineage error.

The configured cache root must resolve outside the Input Pack and Machine Facts
roots.

## CLI behavior

`reconcile-field-lineage` accepts an opt-in cache root:

```text
--expansion-cache-root <directory>
```

Omitting the option preserves current behavior. Timing output adds counters:

```text
expansion_cache_hits
expansion_cache_misses
expansion_cache_writes
expansion_cache_stale
expansion_cache_corrupt
```

## Acceptance cases

1. Cached and uncached reconciliation produce the same artifact `contentHash`.
2. A second unchanged run records cache hits and performs no equivalent expansion
   work for those entries.
3. Changing the consumer manifest or expression creates a miss.
4. Changing one consulted producer manifest invalidates the affected entry.
5. Changing an unrelated producer does not invalidate the entry.
6. A corrupt cache file is ignored and replaced by a valid entry.
7. Two writers cannot leave a partially readable final cache file.
8. Different root depths preserve existing truncation and Gap behavior; depth is
   not serialized into cached expansion values.
9. With no cache option, existing field-lineage tests and CLI behavior remain
   unchanged.

## Proof boundary

The PoC proves deterministic reuse and invalidation. It does not claim an overall
wall-clock improvement until measured on real overlapping roots. Timing counters
must make hit rate and reconcile duration observable for that later benchmark.
