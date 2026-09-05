## Context

See proposal.md. Upstream WP-3 (`TASK_LOCAL_PROJECTION` 1.1.0 + batch-manifest) lives in sql-static-lineage. This repo today only implements `LEGACY_ARTIFACT_PAIRS` topology (`maxRoots=32`, root-pair snapshot ID). Execution plan also names `DIRECT_PROJECT_EVIDENCE`; it is **not** present in this checkout — treat it as a reserved exclusive mode for a future change, not something WP-5 implements.

Authoritative plan: `sql-static-lineage/docs/execution-plan-task-local-union.md` (TU-0…TU-8).

## Goals / Non-Goals

**Goals:**

- Discriminated snapshot validation for `TASK_LOCAL_UNION` vs legacy.
- Envelope unpack + triple contentHash + schemaVersion gate (TU-0/TU-1).
- Union merge, continuation kernel, optional schedule display edges (TU-2…TU-5).
- Fixtures first; golden Facts 105387→119044→176827 for TU-4/TU-7.

**Non-Goals:**

- Changing sql-static-lineage Facts/projector (WP-3.2 is a separate change).
- Raising `maxRoots` or altering legacy snapshot ID inputs.
- Build-time multi-hop / field-lineage closure.
- WP-4 `processingKind`.

## Decisions

### D1 — §5.3 targetTable path: **WP-3.2** (not self-read cache)

**Choice:** (b) Open WP-3.2 in sql-static-lineage to add `scheduleReference.targetTable: string | null` (role stays `SCHEDULE_REFERENCE_ONLY`). WP-5 reads that field only.

**Rejected:** (a) WP-5 loader opens schedule-evidence cache — dual entry for the same fact, drift risk vs projection cacheKey, and contradicts “single scheduleReference envelope”.

**Interim:** Contract/fixtures may include optional `targetTable` on `scheduleReference` as forward-compatible. Until WP-3.2 ships real envelopes, §5.3 CANDIDATE path is fixture-covered; real Facts without the field simply yield no candidate upgrade. WP-5 **never** opens schedule-evidence cache.

### D2 — Snapshot discrimination without breaking legacy

Keep `ProjectTopologySnapshotV1` schemaVersion `1.0.0` for legacy. For union, either:

- extend with optional fields + mode-gated validators (`rootTaskIds` empty/absent allowed only for `TASK_LOCAL_UNION`), or
- a thin union-specific snapshot type sharing node/edge record shapes.

Prefer **mode-gated fields on the same artifact family** so downstream query-index can branch on `sourceMode` once. Legacy `projectSnapshotId` / `validateSourceModes` paths MUST remain byte-stable for LEGACY inputs.

### D3 — Edge vocabulary

Reuse existing data-graph edge types: `READS` / `WRITES` / `PRODUCER_BRIDGE` / `SCHEDULE_DEPENDS_ON`. WP-3 field/control edges (`FIELD_DIRECT`, `FIELD_CONDITIONAL`, `DATASET_CONTROL`) are carried in union topology records. **TU-3 freeze:** keep WP-3 `WRITES` two-hop (TASK→TARGET_WRITE and TARGET_WRITE→PHYSICAL_DATASET, same `edgeType`, distinguished by endpoint nodeTypes). Do **not** introduce `MATERIALIZES`. Derived edges (`PRODUCER_BRIDGE`, optional `SCHEDULE_DEPENDS_ON`) use `derived: true` + `provenance` and are kill-switchable. See `src/project-graph/topology/task-local-union/task-local-union-edges.ts`.

### D4 — Node ID algorithms

Copy/align with WP-3 / existing helpers: `taskNodeId`, `physicalDatasetNodeId`, field five-tuple IDs, `targetWriteNodeId`. No catalog hand-merges for divergent IDs.

### D5 — Implementation order

TU-0 contract+validate → TU-1 loader fixtures → TU-2 merge → TU-3 edge freeze (parallel, before export) → TU-4 continuation → TU-6 regression each merge → TU-7 goldens → TU-8 cost. TU-5 optional.

## Risks / Trade-offs

- [WP-3.2 lag] → Mitigation: fixtures carry `targetTable`; golden path §5.1/§5.2 does not need SCHEDULE_ONLY writers.
- [DIRECT mode absent] → Mitigation: document reserved exclusivity; do not fake DIRECT behavior.
- [Identity divergence false negatives] → Mitigation: normalize qualifiedName aggregation + TU-7 zero-divergence assert.
- [Query consumers assume rootTaskIds] → Mitigation: mode branch; file-query/API updates in later TUs, not silent root invent.

## Migration Plan

1. Land TU-0/TU-1 behind new modules; legacy tests green.
2. Merge/continuation behind explicit CLI/API flags for `TASK_LOCAL_UNION`.
3. After WP-3.2, enable §5.3 on real SCHEDULE_ONLY envelopes.
4. Rollback = stop selecting TASK_LOCAL_UNION; legacy path untouched.

## Open Questions

None blocking TU-0. TU-3 freezes WRITES two-hop vs MATERIALIZES before union export.
