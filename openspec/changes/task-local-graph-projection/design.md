## Context

Execution plan: `docs/execution-plan-task-local-projection.md`. WP-1 (`cdc187a`) is merged. This change implements WP-3 TL-0…TL-8 in sql-static-lineage only; data-graph consumes the union later (WP-5).

## Goals / Non-Goals

**Goals**

- Deterministic per-task JSON projection from Machine Facts for one task at a time.
- Identity parity with data-graph `project-topology-contract` and `field-evidence-contract`.
- Golden gates on 176827 / 119044 / 105387 using existing Facts (`--no-prepare-facts`).
- Incremental batch with explicit cache miss/hit.

**Non-Goals**

- Producer-index or multi-hop reads during projection.
- Cross-task edges or upstream task ids on data edges.
- `processingKind`, Neo4j, union loader, query-time closure.

## Decisions

### Identity copy, not import

Copy `taskNodeId`, `physicalDatasetNodeId`, `fieldEvidencePhysicalFieldNodeId`, `targetWriteNodeId`, and `stableId` into `scripts/project-graph/task-local/ids.ts` using this repo's `canonicalJson` / `sha256`. Freeze hex vectors in tests; data-graph is reference only.

### Inputs

Per task: Facts bundle (`dataset-io`, relation nodes/edges, bindings, column-lineage, schema-refs), schedule cache row, Input Pack fingerprint + `task-fact-index.jsonl` manifest hashes. Channel mapping uses existing `summarizeTaskRelations()` + WP-1 control collection.

### Edge mapping

| Projection edge | Source channel |
| --- | --- |
| `FIELD_DIRECT` | `FIELD_VALUE` (subtype `UNKNOWN` unless derived in TL-1) |
| `FIELD_CONDITIONAL` | `EXPRESSION_CONTROL` + `BRANCH_SELECTION` |
| `DATASET_CONTROL` | `ROW_MEMBERSHIP` / `MULTIPLICITY` controls via shared collector |

### Coverage

- `PROJECTED`: pack + facts present, projection succeeded.
- `SCHEDULE_ONLY`: schedule row only; TASK node (+ optional `scheduleUpstreamTaskIds` attribute), no data edges.
- `COLLECTION_FAILED`: typed reason code, no silent skip.

### Cache key

`taskId | packContentHash | factsManifestSha256 | projectionSchemaVersion`.

## Risks / Trade-offs

- **Identity drift vs data-graph** → frozen vector tests in TL-0.
- **Duplicated control collection** until TL-2 extract → temporary bridge import acceptable for TL-1 if tests green.
- **Golden sample data availability** → `--also-task-ids` for tasks outside `DM_RSK_N` topic filter.

## Migration Plan

Additive outputs under project-graph root. No migration of existing task artifacts. Rollout: TL-0 merge → TL-1 kernel → TL-5 batch → TL-6 goldens.

## Open Questions

- None blocking TL-0. Multi-hop gap for off-closure reads does not block local projection.
