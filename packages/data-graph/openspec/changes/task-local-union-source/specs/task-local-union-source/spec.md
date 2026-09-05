## Purpose

Builds a queryable project topology snapshot by unioning WP-3 task-local projections, joining across tasks via shared physical dataset identity without multi-hop closure at build time.

## ADDED Requirements

### Requirement: TASK_LOCAL_UNION source mode is exclusive

The system MUST support `sourceMode: TASK_LOCAL_UNION` as a project topology snapshot source. A single snapshot MUST contain exactly one source mode. Mixing `TASK_LOCAL_UNION` with `LEGACY_ARTIFACT_PAIRS` (or any other mode) MUST fail closed. Legacy `LEGACY_ARTIFACT_PAIRS` validation, `maxRoots` default of 32, and published root snapshot ID algorithms MUST remain unchanged.

#### Scenario: Reject mixed source modes

- **WHEN** a snapshot claims both legacy root sources and task-local union sources
- **THEN** validation fails with a source-mode error and no snapshot is accepted

#### Scenario: Legacy path unchanged

- **WHEN** a legacy artifact-pair snapshot is validated or built
- **THEN** behavior matches pre-WP-5 contracts including `maxRoots=32` and snapshot ID hashing inputs

### Requirement: Envelope unpack and triple contentHash check

The system MUST unpack WP-3 disk envelopes (`cacheKey`, `cacheKeyParts`, `projectionContentHash`, `projection`) before union. It MUST accept a projection only when `projectionContentHash`, `projection.contentHash`, and the corresponding `batch-manifest.tasks[].contentHash` are identical. Unsupported `projection.schemaVersion` MUST fail closed. Supported version for this WP includes `1.1.0`.

#### Scenario: Triple hash mismatch fails closed

- **WHEN** any of the three contentHash values disagree for a task
- **THEN** loading fails and that task is not merged into the union

#### Scenario: Unsupported schema rejected

- **WHEN** `projection.schemaVersion` is outside the supported set
- **THEN** loading fails closed

### Requirement: Union snapshot shape without root semantics

A `TASK_LOCAL_UNION` snapshot MUST record `taskSources[]` (taskId, projection contentHash, packContentHash, factsManifestSha256, coverageStatus), a producer-index identity (`contentHash` + `inputFingerprint`), and a batch-manifest reference (path + contentHash). It MUST NOT require `rootTaskIds` or root-driven source pairs. Empty `taskSources` MUST fail closed. Producer-index fingerprint mismatch across required inputs MUST fail closed.

#### Scenario: Empty taskSources rejected

- **WHEN** a TASK_LOCAL_UNION snapshot has zero taskSources
- **THEN** validation fails

#### Scenario: Valid union metadata accepted

- **WHEN** taskSources are non-empty, hashes consistent, and producer-index identity matches
- **THEN** the snapshot validates for the TASK_LOCAL_UNION mode

### Requirement: Coverage-status boundaries in the union

`PROJECTED` tasks MUST contribute their data nodes/edges. `SCHEDULE_ONLY` tasks MUST appear as TASK nodes with `scheduleReference` only and MUST NOT contribute data edges. `COLLECTION_FAILED` tasks MUST appear as TASK boundary nodes with `failureReasonCode` and MUST NOT contribute data edges. Neither status may be upgraded to `PROJECTED`.

#### Scenario: SCHEDULE_ONLY has no data edges

- **WHEN** a SCHEDULE_ONLY task is included in the union
- **THEN** the union contains its TASK node and no READS/WRITES/FIELD_*/DATASET_CONTROL edges from that task

### Requirement: Physical dataset identity divergence is reported not merged

Nodes keyed by `physicalDatasetNodeId` MUST merge when IDs match. When the same normalized qualifiedName maps to multiple distinct physical dataset node IDs across tasks, the system MUST emit a `DATASET_IDENTITY_DIVERGENT` gap and MUST NOT auto-merge those nodes.

#### Scenario: Divergent identity gap

- **WHEN** two projected tasks emit different physicalDatasetNodeIds for the same normalized qualifiedName
- **THEN** a DATASET_IDENTITY_DIVERGENT gap is recorded and both nodes remain

### Requirement: Cross-task continuation via dataset identity

Table-level upstream tracing on a union snapshot MUST first follow in-union WRITES into the shared PHYSICAL_DATASET (no taskId data edge). Writers present only in producer-index and absent from the union MUST surface as explicit boundaries (`WRITER_NOT_IN_UNION` or `NO_KNOWN_WRITER`). Derived `PRODUCER_BRIDGE` edges MUST be separable from WP-3 local edges and MUST be disable-able without breaking in-union WRITES continuation. `scheduleReference` MUST NOT participate in writer selection or partition pruning.

#### Scenario: In-union writer found via shared dataset

- **WHEN** consumer task A READs dataset D and writer task B WRITEs D in the same union
- **THEN** upstream tracing returns B without consulting producer-index for that hop

#### Scenario: scheduleReference excluded from pruning

- **WHEN** partition pruning or writer selection runs
- **THEN** scheduleReference fields are not used as inputs

### Requirement: SCHEDULE_ONLY candidate writers use WP-3.2 targetTable

For SCHEDULE_ONLY candidate writers of a dataset, the system MUST use `scheduleReference.targetTable` supplied by WP-3.2 (when present). Evidence status MUST remain `CANDIDATE` and MUST NOT upgrade to `CONFIRMED`. The WP-5 loader MUST NOT open the schedule-evidence cache as a second entry point. Missing targetTable yields no confirmed/candidate upgrade beyond an explicit absence boundary.

#### Scenario: Candidate only when targetTable matches

- **WHEN** a SCHEDULE_ONLY task’s scheduleReference.targetTable normalizes equal to dataset D
- **THEN** the task may be reported as a CANDIDATE writer of D and never as CONFIRMED

#### Scenario: No self-read of schedule cache

- **WHEN** scheduleReference lacks targetTable
- **THEN** the loader does not read schedule-evidence cache to invent a targetTable
