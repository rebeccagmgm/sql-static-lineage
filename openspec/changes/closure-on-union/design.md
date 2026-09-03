## Context

The existing consumer projects `TABLE_MULTI_HOP_RECONCILIATION` into
table-level `PHYSICAL_PRODUCER` branches, then enriches each branch from the
producer task's Facts. Its legacy enrichment expands every write for a
same-table multi-write producer. WP-8.1 now publishes a JSON-only
`UNION_CONTINUATION_INDEX` 1.0.0 with exact read-occurrence entries and
write-observation partition judgments.

## Goals / Non-Goals

**Goals:**

- Keep legacy projection/enrichment byte-for-byte compatible by isolating the
  new path behind an opt-in mode.
- Add a strict index DTO/parser and exact read lookup.
- Attach WP-8 statuses to existing multi-hop table edges, bind exact write
  scopes, and expose evidence-bounded counters.

**Non-Goals:**

- Do not replace the multi-hop candidate universe in this slice; C2 owns that.
- Do not implement partition matching, WP-8/8.1 kernels, producer-index-query,
  value-evidence downgrade, Gate B-UNION, or L0-L3 envelope work.

## Decisions

### 1. Isolate union-v2 at the consumer boundary

`runTargetTableCausalClosure` will branch after the existing table projection.
Legacy continues through the current `enrichProducerWriteBridges` function.
Union-v2 normalizes read occurrences before exact index lookup, removes
schedule-only producer branches, and expands only existing multi-hop physical
bridges using matching index candidates. Index-only writers do not create new
table edges in C1; if a base bridge has no matching entry, it remains an
UNKNOWN boundary.

### 2. Use a local, strict DTO adapter

`union-continuation-candidate-source.ts` owns file loading, schema/hash
validation, enum validation, duplicate read detection, and an immutable map
keyed by `consumerTaskId` plus `readOccurrenceId`. The adapter emits a stable
`indexEntryRef` derived from the index content hash and exact read key. It
never imports data-graph code or evaluates partition predicates.

### 3. Bind scopes from the indexed write id

The union path calls the existing `producerWriteScope` logic with one indexed
`writeObservationId` at a time. It does not enumerate all `dataset-io` writes
for the table. A missing scope leaves the branch visible with the existing
UNKNOWN gap. Alignment ambiguity is carried as a continuation gap while the
distinct write id remains available for an exact scope lookup.

### 4. Cap propagation certainty with continuation evidence

The closure engine already composes local transfer certainty. Union-v2 adds a
branch-level cap: exact L1 candidates are CONFIRMED, ASSUMED candidates are
CONDITIONAL, and non-L1/PI-only candidates are UNKNOWN. This prevents legacy
field evidence or a relation summary from silently promoting L2 candidates.

### 5. Count read-level ambiguity separately from candidate-level resolution

The adapter stage counts retained candidates per exact read after DISJOINT
pruning. A read with two or more retained write observations contributes one
`ambiguousReads`/`bridgeStats.ambiguous`. `resolved` is incremented only while
binding an L1 candidate with a non-null exact scope.

## Risks / Trade-offs

- [Index schema drift] → Reject the index before closure starts with a
  contract error; no partial union-v2 result is emitted.
- [Read occurrence mismatch] → Preserve the multi-hop branch as UNKNOWN and
  expose `CONTINUATION_READ_NOT_FOUND`; do not fuzzy-match or fan out.
- [Legacy regression] → Keep the old enrichment function and all new metrics
  optional/absent in legacy artifacts; run the existing target-table suite and
  compare a legacy artifact hash.
- [C1 does not widen the universe] → PI-only candidates without a corresponding
  multi-hop table bridge remain outside the candidate universe until C2.
