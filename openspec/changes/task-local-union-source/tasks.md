## 1. TU-0 Snapshot contract

- [x] 1.1 Add `TASK_LOCAL_UNION` to source-mode types; keep legacy mode behavior byte-stable
- [x] 1.2 Define union snapshot fields (`taskSources`, `producerIndex`, `batchManifestRef`; no root requirement) and mode-gated validators
- [x] 1.3 Implement envelope unpack + triple contentHash + supported `projection.schemaVersion` (`1.1.0`) helpers
- [x] 1.4 Fixture tests: reject mixed modes, empty taskSources, hash mismatch, unsupported schema; accept valid union metadata
- [x] 1.5 Record §5.3 decision in design (WP-3.2 `scheduleReference.targetTable`; no schedule-cache self-read) — already in design.md

## 2. TU-1 Loader kernel

- [x] 2.1 Implement `loadTaskLocalUnionSources({ manifestPath, projectGraphRoot, producerIndexPath })`
- [x] 2.2 Synthetic manifest + 3 envelopes fixture (PROJECTED / SCHEDULE_ONLY / COLLECTION_FAILED)
- [x] 2.3 Fail closed on any contentHash inconsistency; COLLECTION_FAILED → TASK boundary only

## 3. TU-2 Union merge

- [x] 3.1 Merge nodes/edges per plan §4; emit merge report (dedupe counts, gaps)
- [x] 3.2 `DATASET_IDENTITY_DIVERGENT` / `UNION_EDGE_CONFLICT` gap fixtures
- [x] 3.3 SCHEDULE_ONLY / COLLECTION_FAILED contribute no data edges

## 4. TU-3 Edge semantics freeze

- [x] 4.1 Spec-register WP-3 WRITES two-hop expression in union topology + PRODUCER_BRIDGE derived layer format/provenance
- [x] 4.2 Lock with tests; align Neo4j labels; document read-only refs back to WP-3 docs

## 5. TU-4 Continuation kernel

- [x] 5.1 In-union WRITES continuation (§5.1) with fixtures first
- [x] 5.2 Producer-index boundary + derived bridge kill-switch (§5.2)
- [x] 5.3 Partition pruning table (§5.4); assert scheduleReference never enters prune inputs
- [x] 5.4 Real Facts golden hop checks for 105387→119044→176827 (when data pack present)

## 6. TU-5 Schedule display edges (optional)

- [x] 6.1 Optional `SCHEDULE_DEPENDS_ON` export from scheduleReference; TU-4 results invariant under toggle

## 7. TU-6 / TU-7 / TU-8

- [x] 7.1 Legacy / real-artifact closed-loop + six reference queries byte-stable
- [x] 7.2 Golden union chain (105387→119044→176827) + identity/continuation asserts
- [ ] 7.2b nodeId cross-check vs published root snapshot (留档)
- [ ] 7.3 Write `cost-task-local-union.md` (DM_RSK_N build + query latency)
