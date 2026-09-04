## ADDED Requirements

### Requirement: Field edges carry read-occurrence and expression provenance

Starting at `TASK_LOCAL_PROJECTION` schema 1.3.0, every `FIELD_DIRECT` and `FIELD_CONDITIONAL` edge SHALL carry `sourceReadOccurrenceId` (string or null), `sourceReadOccurrenceStatus` (`RESOLVED | AMBIGUOUS | UNRESOLVED`), `sourceRelationId` and `expressionId`. When more than one read occurrence of the same physical table lies under the expression's relation subtree and the reference cannot be narrowed by qualifier, the edge SHALL be `AMBIGUOUS` with a null id; the system SHALL NOT select the first candidate.

#### Scenario: Single read of the source table under the expression

- **WHEN** exactly one read occurrence of the input field's table lies under `expression.relation_id`
- **THEN** the edge has `sourceReadOccurrenceStatus = RESOLVED` and `sourceReadOccurrenceId` equal to that occurrence

#### Scenario: Self-join without resolvable qualifier

- **WHEN** two read occurrences of the same table lie under the expression's relation subtree and the input reference carries no qualifier that uniquely matches one of them
- **THEN** the edge has `sourceReadOccurrenceStatus = AMBIGUOUS`, `sourceReadOccurrenceId = null`, and a projection gap `FIELD_SOURCE_READ_OCCURRENCE_AMBIGUOUS` is recorded

#### Scenario: Edge identity distinguishes read occurrences

- **WHEN** the same `(sourceTable, sourceColumn, outputColumn)` is reached through two different resolved read occurrences
- **THEN** two distinct `FIELD_DIRECT` edges are emitted, not one

### Requirement: Value edge subtype is classified or explained

Starting at schema 1.3.0, `FIELD_DIRECT.subtype` SHALL be `IDENTITY` for a bare column reference (alias permitted), `AGGREGATION` when the expression contains an aggregate function or its relation is an aggregate context, `TRANSFORMATION` for every other expression with physical input, and `UNKNOWN` only with a non-empty `subtypeReason` drawn from `EXPRESSION_TEXT_UNPARSEABLE | MIXED_ROLE_COLUMN | WINDOW_CONTEXT_ONLY | INPUT_DEPENDENCY_NOT_PHYSICAL`. Constant expressions SHALL NOT produce field edges. Columns appearing only in window `PARTITION BY` / `ORDER BY` SHALL NOT produce `FIELD_DIRECT` edges.

#### Scenario: Cast is a transformation

- **WHEN** the output expression is `cast(a.price as decimal(18,6))`
- **THEN** the edge subtype is `TRANSFORMATION`

#### Scenario: Bare column with alias is identity

- **WHEN** the output expression is `t.npv as npv_base`
- **THEN** the edge subtype is `IDENTITY`

#### Scenario: Constant produces no source edge

- **WHEN** the output expression is `'Y' as flag`
- **THEN** no `FIELD_DIRECT` edge is emitted for `flag`

#### Scenario: Unknown must be explained

- **WHEN** validating a 1.3.0 edge with `subtype = UNKNOWN` and no `subtypeReason`
- **THEN** validation fails with a typed contract error

### Requirement: Dataset control edges carry join type and control side

Starting at schema 1.3.0, every `DATASET_CONTROL` edge with `subtype = JOIN` SHALL carry `joinType` (`INNER | LEFT | RIGHT | FULL | CROSS`), `controlSide` (`LEFT | RIGHT | BOTH`), `leftRelationId` and `rightRelationId`; non-JOIN controls SHALL carry `joinType = N/A` and `controlSide = N/A`. When the control column's table appears on both sides and cannot be attributed by qualifier, `controlSide` SHALL be `BOTH` and a projection gap `CONTROL_SIDE_UNRESOLVED` SHALL be recorded.

#### Scenario: LEFT JOIN key on the right table

- **WHEN** a join relation has `join_type = left` and the control column belongs to a table only under its right child
- **THEN** the edge has `joinType = LEFT` and `controlSide = RIGHT`

#### Scenario: JOIN without join type is rejected

- **WHEN** validating a 1.3.0 `DATASET_CONTROL` edge with `subtype = JOIN` and `joinType = N/A`
- **THEN** validation fails with a typed contract error

### Requirement: Task-local materialization field breaks are named

When an input field's table is a task-local materialization written by the same task and no resolved materialization bridge connects it to an output binding, the projection SHALL record a gap `TASK_LOCAL_MATERIALIZATION_FIELD_BREAK` listing the affected columns, and SHALL NOT report the table as an external producer gap.

#### Scenario: Temp table read by its own task

- **WHEN** task 181058 reads `dm_rsk_n.otc_opt_inr_comp_pal_sum_temp` and its bindings have no bridge to that read
- **THEN** the projection gap list contains `TASK_LOCAL_MATERIALIZATION_FIELD_BREAK` with the seven affected columns

### Requirement: Schema 1.3.0 is a single version bump with legacy read compatibility

The contract SHALL move from 1.2.0 to 1.3.0 in one release carrying all field-edge and control-edge additions together. Readers SHALL continue to accept 1.2.0 and 1.1.0 artifacts. The 1.3.0 validator SHALL reject a 1.3.0 artifact missing any newly required property, and SHALL continue to reject cross-task data edges, `affectedRootFields`, `rowsetControls` and any edge whose endpoints connect a control column to an output column.

#### Scenario: Legacy artifact still loads

- **WHEN** loading a 1.2.0 projection
- **THEN** it validates under legacy rules and is not rewritten

#### Scenario: Incomplete 1.3.0 artifact is rejected

- **WHEN** a 1.3.0 `FIELD_DIRECT` edge lacks `sourceReadOccurrenceStatus`
- **THEN** validation fails with a typed contract error
