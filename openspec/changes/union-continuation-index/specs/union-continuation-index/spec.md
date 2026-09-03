## Purpose

Publishes one deterministic, replayable `UNION_CONTINUATION_INDEX` 1.0.0 batch
artifact that flattens WP-8 v2 continuation results for every selected
`PROJECTED` consumer read occurrence, so cross-task closure can consume
partition state without re-running matching logic.

## ADDED Requirements

### Requirement: index artifact is versioned and replayable

The system MUST emit `UNION_CONTINUATION_INDEX` with `schemaVersion` `1.0.0`.
The artifact MUST include `generatedAt`, an `input` provenance block, `entries`,
and a `contentHash`. The content hash MUST use canonical JSON and MUST ignore
only `generatedAt`.

#### Scenario: content hash ignores generatedAt

- **WHEN** the same index body is serialized with two different `generatedAt`
  timestamps
- **THEN** both artifacts share the same `contentHash`

### Requirement: input provenance names only preflight-passing projections

The index `input` MUST record `batchManifestRef` (`path`, `contentHash`),
`producerIndex` (`contentHash`, `inputFingerprint`), and
`taskProjections[]` of `{taskId, contentHash, schemaVersion}`.
`taskProjections` MUST include only `PROJECTED` tasks that passed the 1.2.0
preflight and MUST NOT include `SCHEDULE_ONLY` or `COLLECTION_FAILED` tasks.

#### Scenario: boundary coverages stay out of taskProjections

- **WHEN** a batch contains `PROJECTED`, `SCHEDULE_ONLY`, and
  `COLLECTION_FAILED` tasks
- **THEN** `input.taskProjections` lists only the `PROJECTED` 1.2.0 tasks

### Requirement: projected inputs fail closed before v2 tracing

Before invoking `traceUnionTaskContinuationV2`, every `PROJECTED` task MUST
have projection schema `1.2.0` (including envelope `cacheKeyParts.schemaVersion`
when loaded from disk). If any `PROJECTED` task is missing, non-1.2.0, or
schema-drifted, index generation MUST fail and MUST NOT write a consumable
partial index or manifest.

#### Scenario: non-1.2.0 projected input aborts without output

- **WHEN** a batch includes a `PROJECTED` task whose projection schema is
  `1.1.0`
- **THEN** the CLI fails closed and creates neither
  `union-continuation-index.json` nor `manifest.json`

### Requirement: boundary tasks are not index consumers

`SCHEDULE_ONLY` and `COLLECTION_FAILED` tasks MUST NOT become index entries and
MUST NOT be accepted as `--consumer-task-id` values. By default the CLI indexes
every `PROJECTED` task; an explicit consumer filter MUST still resolve only to
`PROJECTED` task ids.

#### Scenario: schedule-only and collection-failed stay out of entries

- **WHEN** a batch mixes projected consumers with `SCHEDULE_ONLY` and
  `COLLECTION_FAILED` tasks and the CLI runs without a consumer filter
- **THEN** `entries` contain only projected-consumer read occurrences

### Requirement: one entry per consumer read occurrence

The index MUST contain exactly one entry per
`(consumerTaskId, readOccurrenceId)` obtained by flattening
`traceUnionTaskContinuationV2`. Each entry MUST carry
`readOccurrenceNodeId`, `datasetNodeId`, `qualifiedName`, `identityStatus`,
`partitionPredicateStatus`, `candidates[]`, `prunedWriteObservationIds[]`, and
`gaps[]` with reason codes. The index MUST NOT invent partition statuses or call
`producer-index-query`.

#### Scenario: projected external reads become index entries

- **WHEN** a projected consumer exposes multiple `localClosure.externalReads`
- **THEN** the index emits one entry per read occurrence and preserves the v2
  `partitionMatchStatus`, evidence layer, L1 flag, pruned ids, and gaps

### Requirement: candidates preserve write-observation identity and partition evidence

Each candidate MUST include `taskId`, `writeObservationId`,
`targetWriteNodeId`, write-side `datasetNodeId` and `qualifiedName`, `source`
(`IN_UNION_FINAL_WRITE` | `PRODUCER_INDEX_ONLY`), `partitionMatchStatus`
(`CONFIRMED` | `ASSUMED` | `UNKNOWN` | `DISJOINT`), write-side `partition`,
`evidenceLayer`, and `l1Eligible`. Optional `alignmentGapCode` / `reasonCode`
MAY surface v2 gaps such as `WRITE_OBSERVATION_ALIGNMENT_AMBIGUOUS`.
`evidenceEnvelopeRef` MAY be omitted. Downstream consumers MUST treat
`DISJOINT` candidates as pruned from their own candidate universe using
`partitionMatchStatus` and `prunedWriteObservationIds`.

#### Scenario: disjoint candidates remain explicit and listed as pruned

- **WHEN** v2 marks a write observation `DISJOINT` for a read occurrence
- **THEN** the index candidate keeps `partitionMatchStatus=DISJOINT` and that
  `writeObservationId` appears in `prunedWriteObservationIds`

### Requirement: ambiguous multi-write alignment stays unknown without shared producer id

When producer-index partition evidence cannot be aligned to a specific final
write among multiple in-union writes for the same task and table, the index
MUST preserve distinct `writeObservationId` values (for example `105387:3` and
`105387:6`), MUST keep those candidates `UNKNOWN` and not L1-eligible, MUST
expose `WRITE_OBSERVATION_ALIGNMENT_AMBIGUOUS`, and MUST NOT collapse them into
a shared producer-index `:0` candidate.

#### Scenario: 105387 multi-write ambiguity is not collapsed to :0

- **WHEN** the batch includes the current 1.2.0 projection for task `105387`
  with two final writes and producer-index rows lack per-write ids
- **THEN** index candidates for that task keep both write observation ids,
  remain `UNKNOWN` / non-L1, carry
  `alignmentGapCode=WRITE_OBSERVATION_ALIGNMENT_AMBIGUOUS`, and do not emit
  `write-observation:105387:0` as a substitute candidate

### Requirement: CLI writes and revalidates index plus manifest

The user-facing CLI MUST write `union-continuation-index.json` and
`manifest.json` under the output directory, MUST refuse to overwrite an
existing index or manifest, and MUST re-assert both artifacts after writing.
The manifest MUST record the index content hash, selected consumer task ids,
projected task count, and read-occurrence count.

#### Scenario: successful run emits validated index and manifest

- **WHEN** a valid 1.2.0 batch is indexed into an empty output directory
- **THEN** both files exist, pass assertion, and the manifest
  `indexContentHash` equals the index `contentHash`
