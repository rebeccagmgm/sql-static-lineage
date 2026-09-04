## Purpose

对任一任务写观察的任一输出列，在任务局部投影并集与接续索引之上，于查询期给出可解释、可跨任务、诚实标注不确定性的字段证据链：值来源、按列作用域的控制因素、候选 writer 前沿与具名缺口。

## ADDED Requirements

### Requirement: Impact Query answers one anchor field at query time

The system SHALL accept an anchor `(taskId, writeObservationId, outputColumn)`, a union projection root and a `UNION_CONTINUATION_INDEX`, and SHALL return a `FIELD_IMPACT_RESULT` 1.0.0 containing `value[]`, `control[]`, `frontier[]`, `gaps[]` and `budget`. The result SHALL be computed at query time and SHALL NOT be persisted as a closure, path list or derived edge set.

#### Scenario: Anchor with resolvable local value edges

- **WHEN** the anchor task's projection is schema 1.3.0 and has `FIELD_DIRECT` or `FIELD_CONDITIONAL` edges for `outputColumn`
- **THEN** `value[]` contains one entry per such edge at `depth = 0` with `subtype`, `sourceReadOccurrenceId`, `expressionId` and `evidenceStatus = CONFIRMED`

#### Scenario: Anchor projection older than 1.3.0

- **WHEN** the anchor task's projection schema is 1.2.0 or lower
- **THEN** the result contains a single gap with `reasonCode = CONTRACT_TOO_OLD`
- **AND** `value[]`, `control[]` and `frontier[]` are empty

### Requirement: Cross-task continuation resolves through the INDEX only

For each value edge whose `sourceReadOccurrenceStatus = RESOLVED`, the system SHALL look up `(consumerTaskId, sourceReadOccurrenceId)` in the INDEX and SHALL continue into a producer task only when exactly one candidate exists and that candidate is `l1Eligible`. The producer's edges SHALL be selected by `writeObservationId` and `outputColumn` equality. The system SHALL NOT infer producers from table names, schedule upstream task ids or array position.

#### Scenario: Unique eligible candidate

- **WHEN** the INDEX entry has exactly one candidate with `l1Eligible = true`
- **THEN** `value[]` gains entries at `depth + 1` taken from the producer projection where `writeObservationId` equals the candidate's and `outputColumn` equals the consumed column
- **AND** each such entry carries `evidenceStatus = CONFIRMED`

#### Scenario: Producer in union but column has no binding

- **WHEN** the INDEX candidate is unique and eligible but the producer projection has no field edge for that `writeObservationId` and `outputColumn`
- **THEN** a gap with `reasonCode = PRODUCER_BINDING_NOT_FOUND` is emitted and traversal stops on that branch

#### Scenario: No INDEX entry for the read occurrence

- **WHEN** the INDEX has no entry for `(consumerTaskId, sourceReadOccurrenceId)`
- **THEN** a gap with `reasonCode = PRODUCER_NOT_PROJECTED` is emitted and traversal stops on that branch

### Requirement: Multiple or ineligible candidates form a frontier and do not recurse

When an INDEX entry has more than one candidate, or its sole candidate is not `l1Eligible`, the system SHALL append a `frontier[]` entry carrying the read field, every candidate with its `partitionMatchStatus` and INDEX `reasonCode`, and `reasonCode = MULTI_WRITER_CANDIDATE_FRONTIER`. The system SHALL NOT recurse into any of these candidates unless `expandCandidates = true` is explicitly requested.

#### Scenario: Seven writers for the consumed table

- **WHEN** the INDEX entry lists seven candidates
- **THEN** `frontier[]` contains one entry with seven candidates and `value[]` contains no entry at `depth + 1` derived from that read field

#### Scenario: Explicit candidate expansion

- **WHEN** `expandCandidates = true`
- **THEN** each candidate is traversed separately, its derived value entries carry `evidenceStatus = CANDIDATE`, and each traversal counts against the budget

### Requirement: Ambiguous or unresolved read occurrences stop traversal with a gap

The system SHALL NOT continue across tasks from a value edge whose `sourceReadOccurrenceStatus` is `AMBIGUOUS` or `UNRESOLVED`; it SHALL emit a gap carrying the edge's status code.

#### Scenario: Self-join makes the source read ambiguous

- **WHEN** a value edge has `sourceReadOccurrenceStatus = AMBIGUOUS`
- **THEN** the edge appears in `value[]` at its depth and a gap with `reasonCode = FIELD_SOURCE_READ_OCCURRENCE_AMBIGUOUS` is emitted
- **AND** no INDEX lookup is attempted for that edge

### Requirement: Control factors are shared per write observation and scoped per column at query time

The system SHALL list every `DATASET_CONTROL` edge of each visited write observation in `control[]` exactly once per visited write observation, and SHALL attach a `scope` of `FIELD_SCOPED`, `DATASET_SCOPED` or `SCOPE_DISJOINT` computed from the value edge's `sourceRelationId` and the control edge's `subtype`, `joinType`, `controlSide` and relation tree. The system SHALL NOT materialize control-to-column edges.

#### Scenario: Value from nullable side of a LEFT JOIN

- **WHEN** the anchor column's value edge has `sourceRelationId` inside the right subtree of a control edge with `subtype = JOIN` and `joinType = LEFT`
- **THEN** that control entry has `scope = FIELD_SCOPED`

#### Scenario: Value from preserved side of the same LEFT JOIN

- **WHEN** another anchor column's value edge has `sourceRelationId` inside the left subtree of the same control edge
- **THEN** that control entry has `scope = DATASET_SCOPED` and retains `grain`

#### Scenario: INNER JOIN is never marked unrelated

- **WHEN** a control edge has `subtype = JOIN` and `joinType = INNER`
- **THEN** its `scope` is `DATASET_SCOPED` for every anchor column of that write observation

#### Scenario: Disjoint UNION branch

- **WHEN** the control edge's `relationId` and the value edge's `sourceRelationId` lie under different children of the same set-operation relation
- **THEN** that control entry has `scope = SCOPE_DISJOINT`

#### Scenario: Scope must be proven, not defaulted

- **WHEN** the relation tree cannot prove disjointness
- **THEN** `scope` is `DATASET_SCOPED`, never `SCOPE_DISJOINT`

### Requirement: Traversal is bounded and over-budget is named

The system SHALL enforce `maxDepth`, `maxEdges` and `maxFrontier`, SHALL return an edge set rather than enumerated paths, and SHALL emit a gap with `reasonCode = TRAVERSAL_BUDGET_EXCEEDED` identifying which limit was hit when any bound is reached.

#### Scenario: Depth limit reached

- **WHEN** a CONFIRMED continuation would exceed `maxDepth`
- **THEN** traversal stops, `budget.exhausted = true` and a `TRAVERSAL_BUDGET_EXCEEDED` gap names `maxDepth`

### Requirement: Field-scoped control columns join the traversal; dataset-scoped ones do not

The system SHALL recurse into the value chain of a control column only when that control entry is `FIELD_SCOPED`; control entries scoped `DATASET_SCOPED` or `SCOPE_DISJOINT` SHALL be recorded without traversal.

#### Scenario: LEFT JOIN key on nullable side is traversed

- **WHEN** a `FIELD_SCOPED` control column has its own `FIELD_DIRECT` edges in the producer that wrote it
- **THEN** those edges are traversed under the same INDEX and budget rules and appear in `value[]` flagged as reached via control

### Requirement: Golden acceptance on real anchors

The system SHALL ship five golden cases against real Facts for tasks 176827 and 181058 that fail closed when the data pack is present and `FIELD_EVIDENCE_GOLDEN_REQUIRED=1`, and skip otherwise.

#### Scenario: Golden data present and required

- **WHEN** the sibling Facts root exists and `FIELD_EVIDENCE_GOLDEN_REQUIRED=1`
- **THEN** all five cases execute and any mismatch against `expected.json` fails the run

#### Scenario: Golden data absent and not required

- **WHEN** the sibling Facts root is missing and the variable is unset
- **THEN** the five cases are reported as skipped, not passed

### Requirement: Stop-loss decision is machine-produced

The system SHALL compute, over a configured list of high-value anchor columns, `confirmedTwoHopRatio` (share of columns with at least one `depth = 1` CONFIRMED value entry) and `dominantGap` (most frequent `reasonCode` across `frontier[]` and `gaps[]`), and SHALL print one of `PROCEED_PHASE_3`, `FREEZE_AND_FIX_WP8`, `COLLECT_MORE_PACKS`, `FIX_PHASE_1_DERIVATION`.

#### Scenario: Partition evidence dominates

- **WHEN** `confirmedTwoHopRatio < 0.5` and `dominantGap` is `WRITER_PARTITION_UNKNOWN` or `MULTI_WRITER_CANDIDATE_FRONTIER`
- **THEN** the decision is `FREEZE_AND_FIX_WP8`

#### Scenario: Ratio at or above threshold

- **WHEN** `confirmedTwoHopRatio >= 0.5`
- **THEN** the decision is `PROCEED_PHASE_3`
