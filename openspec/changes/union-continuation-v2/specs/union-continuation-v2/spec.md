## Purpose

Consumes WP-7 `TASK_LOCAL_PROJECTION` 1.2.0 evidence and exposes an evidence-bounded cross-task continuation for each read occurrence.

## ADDED Requirements

### Requirement: v2 consumes current task-local projection evidence

The v2 continuation MUST use `localClosure.externalReads` and `localClosure.finalWrites` from projection schema 1.2.0. A legacy projection or a flat read node without the 1.2.0 closure MUST fail closed as v2 evidence.

### Requirement: continuation has three write-preserving tiers

For each read occurrence, the consumer MUST expose table-level candidates, per-write partition decisions, and the remaining write-observation candidates. It MUST preserve distinct `writeObservationId` values and MUST NOT collapse multiple writes to one task.

### Requirement: partition match status is explicit

Each candidate MUST carry `partitionMatchStatus` with one of `CONFIRMED`, `ASSUMED`, `UNKNOWN`, or `DISJOINT`. `DISJOINT` candidates are pruned after the table tier. `ASSUMED` and `UNKNOWN` candidates remain visible but are L2.

### Requirement: L1 is confirmation-only

Only a confirmed read identity matched to an in-union final write with `partitionMatchStatus=CONFIRMED` may enter L1. `ASSUMED` MUST NOT enter L1.

### Requirement: schedule references are not lineage candidates

`scheduleReference` and `SCHEDULE_DEPENDS_ON` MUST NOT enter table, partition, or write-observation continuation tiers.

### Requirement: ambiguous multi-write alignment fails closed

When one producer-index partition record cannot be aligned to a specific
`finalWrite` among multiple final writes for the same task and physical table,
the consumer MUST NOT broadcast that partition to all writes or emit it as an
additional PI-only write. Each in-union final write MUST remain visible with
`UNKNOWN` partition status, and the result MUST expose
`WRITE_OBSERVATION_ALIGNMENT_AMBIGUOUS` in its gaps.

### Requirement: continuation exposes a replayable L0-L3 envelope

The consumer MUST provide a minimal `UNION_CONTINUATION_EVIDENCE` 1.0.0
envelope. L0 MUST identify consumer coverage, candidate counts, task-local
projection hashes, producer-index identity, and batch-manifest identity. L1 and
L2 MUST preserve their write-observation candidates, and L3 MUST preserve
explicit gaps. The complete v2 three-tier result MUST remain in the envelope;
volatile `generatedAt` MUST NOT affect its content hash.
