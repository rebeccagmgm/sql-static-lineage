## Why

`UNION_CONTINUATION_EVIDENCE` is intentionally one-read-occurrence scoped.
Cross-task closure consumers need one deterministic, replayable batch artifact
containing every projected consumer read and its v2 candidates.

## What Changes

- Add `UNION_CONTINUATION_INDEX` 1.0.0 and a user-facing batch CLI.
- Preflight every `PROJECTED` input before invoking v2: it must be projection
  schema `1.2.0`; `SCHEDULE_ONLY` and `COLLECTION_FAILED` are excluded.
- Flatten `traceUnionTaskContinuationV2` results into one entry per
  `(consumerTaskId, readOccurrenceId)` while preserving write observation,
  partition state, evidence layer, and reason-code evidence.
- Write an index manifest with input hashes and the index content hash.

The CLI only orchestrates the existing loader, merge, v2 trace, and envelope
contracts. It does not add or reinterpret continuation matching semantics.

## Capabilities

### New Capabilities

- `union-continuation-index`: Replayable batch index of WP-8 v2 continuation
  results for projected consumer reads, with 1.2.0 fail-closed preflight.

## Non-Goals

- No changes to `partitionMatchStatus`, L1 eligibility, schedule exclusion, v1
  semantics, SQL/Facts production, closure propagation, Neo4j, or UI.
