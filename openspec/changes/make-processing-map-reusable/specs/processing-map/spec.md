## Purpose

定义现有固定材料上的可重跑加工地图：保留主加工骨架，以版本明确的关系、元数据、共享知识和视图规则生成有界离线分析；逐层穿透能回答实际加工问题。

## ADDED Requirements

### Requirement: Fixed input consumption is explicit and reproducible

The system SHALL consume an explicit input bundle that binds graph version, task scope and exact source file digests. Import SHALL validate dataset/task identities, edge direction, counts, task associations and complete recomputed schema member sets. Build MUST NOT implicitly collect source data, rebuild Facts, export a graph or scan all projection files.

#### Scenario: Existing fixed baseline is imported

- **WHEN** the current 3,615-task export and its sidecars are imported
- **THEN** recomputed results contain 2,740 dataset identities, 111 schema summaries and 245 schema directions with exact matching members
- **AND** the source files and original HTML remain unchanged

#### Scenario: A sidecar omits a valid member

- **WHEN** a sidecar lists only a subset of the tasks calculated from network associations
- **THEN** import fails with a membership mismatch even if every listed task is individually valid

### Requirement: Graph relationships preserve evidence strength

The system SHALL present schema/region flows as same-task read and output associations, retaining each constituent member set. It MUST NOT upgrade these associations to per-field causality, physical SQL writes, runtime delivery or same-batch continuity without supporting evidence. Scheduler-only references MUST NOT become data-flow edges.

#### Scenario: One task has multiple inputs and outputs

- **WHEN** the task contributes to multiple schema pairs
- **THEN** each pair keeps its exact task membership and the map explains the association scope
- **AND** combined counts use task-set union rather than sums across overlapping directions

### Requirement: Views are computed from definitions and shared classification

The system SHALL compute region members, flow groups, counts, drill targets and layout from input data, shared classification and explicit view definitions. New computed views MUST NOT read per-node coordinates or hardcoded member counts from authored content. Business interpretation MAY remain curated with evidence references.

#### Scenario: A schema source classification changes

- **WHEN** a schema's sourceSystem classification is changed and the same bundle is rebuilt
- **THEN** affected region membership and flow labels are recalculated without frontend code changes
- **AND** the result has a changed knowledge revision while retaining the original graph version

### Requirement: The baseline skeleton remains a useful reading entry

The system SHALL preserve the original skeleton's main routes, parallel branches, direct reads and distinction between delivery, log and export interpretations. Baseline comparison SHALL use the current 14 nodes and 18 visual edges rather than historical conversational counts. Directions excluded from the overview SHALL remain discoverable with members and exclusion reasons.

#### Scenario: A valid direction is outside the selected overview

- **WHEN** a computed schema direction is not selected by the overview rules
- **THEN** the direction remains accessible through the relevant analysis or unshown-direction view
- **AND** it is neither silently discarded nor forced into the initial overview

### Requirement: Source drill-down is an analysis in the main workspace

The system SHALL open source, classification-member and dataset analysis in the main view. A source analysis SHALL connect scope and classification to object purpose, observed consumption routes, evidence and gaps; counts or side-panel task lists alone SHALL NOT satisfy this requirement.

#### Scenario: The reader enters Titans visible sources

- **WHEN** the reader opens the Titans source node
- **THEN** the analysis covers the baseline 234 visible dataset identities across titans_dm and titans_refdata
- **AND** schema, object type and business classification are distinct reading dimensions
- **AND** the reader can continue to a specific identity and its related task/evidence

#### Scenario: Source objects have reverse output associations

- **WHEN** the analysis includes the four odata_n_tit and one dm_tit output-associated tasks returning to titans_dm
- **THEN** those associations are visible as investigation candidates
- **AND** the map does not claim production write-back without additional evidence

### Requirement: Metadata enrichment is scoped and identity-aware

The system SHALL reuse existing offline JSONL lookup/index behavior and extract only configured objects into a small metadata bundle. Ordinary build SHALL consume the extracted bundle and MUST NOT implicitly create large catalog indexes. Object type SHALL be TABLE, VIEW or UNKNOWN based on explicit supported metadata/DDL evidence; catalog entity classes and name prefixes alone are insufficient.

#### Scenario: An object has multiple same-name metadata candidates

- **WHEN** the graph identity cannot uniquely bind to a catalog object
- **THEN** enrichment preserves the candidates or missing state and does not replace identity-bound facts

#### Scenario: A persisted index is absent

- **WHEN** metadata extraction needs an index and explicit index-building authorization was not supplied
- **THEN** it reports the missing preparation step without silently scanning GB-scale files

### Requirement: Shared knowledge is reusable without forcing one global parent

The system SHALL store new classifications and explanations under the configured shared knowledge root, with subject, scope, evidence and interpretation status. Objects MAY have multiple tags; missing classifications and unknown object types SHALL remain visible. Layout and view-specific grouping SHALL NOT be written into source facts or shared business classifications.

#### Scenario: An object belongs to multiple business categories

- **WHEN** the object is included by multiple tag filters
- **THEN** every applicable tag remains available, the current display grouping is deterministic and combined totals deduplicate by dataset identity

### Requirement: Odata analysis distinguishes region coverage from examples

The system SHALL provide odata_n_tit region composition, supported processing categories, input/output associations and downstream context before presenting representative cases. Cases SHALL state their selection scope, node types, full schema names and evidence limits.

#### Scenario: The reader opens the batch-arrangement example

- **WHEN** tasks 144134 and 144141 are displayed
- **THEN** the acquisition target is distinguished from SQL evidence and the unmatched date/h15 batch continuity is explicit on the route

#### Scenario: The reader opens the margin-parameter example

- **WHEN** task 41540 is displayed
- **THEN** UNION ALL and source identifiers are explained as a shared output construction
- **AND** the map does not imply deduplication or unified business definitions without evidence

### Requirement: Layout and rendering remain deterministic and bounded

The system SHALL calculate new-view positions using stage rules and deterministic ordering/routing. Per-node coordinate patches SHALL NOT be an accepted solution. Every view SHALL have explicit node/edge limits, and large member collections SHALL support complete paginated access. Exceeding a build budget SHALL report the affected view and preserve the previous complete output.

#### Scenario: Identical inputs are rebuilt

- **WHEN** graph, metadata, knowledge, definition and algorithm content are unchanged
- **THEN** snapshot identity, member ordering and layout are identical, excluding separate execution-time provenance

#### Scenario: A source has more members than a page

- **WHEN** the reader browses the member pages
- **THEN** all members can be reached without duplication or silent truncation
- **AND** the first view remains within its rendering budget

### Requirement: Snapshot revisions and stale explanations are distinct

The system SHALL record graph, input, metadata, knowledge, definition and algorithm identities in generated results. Structural changes SHALL be recalculated. Missing business explanation MAY remain an explicit gap; evidence-bound explanations with incompatible hashes MUST NOT be shown as verified current knowledge.

#### Scenario: A new graph input invalidates an old SQL interpretation

- **WHEN** the stored evidence binding no longer matches the new input
- **THEN** the map marks that interpretation as needing review or presents it only as a separately versioned historical reference
- **AND** it does not relabel old evidence as current

### Requirement: Existing offline reading behavior remains available

The system SHALL preserve the original HTML, build a separate next HTML, and retain offline resource isolation, navigation, task/evidence details, fixed SQL and existing knowledge/principal reading where their original evidence is compatible. Main-view navigation SHALL preserve return context and per-view camera state.

#### Scenario: A reader returns from a dataset to the overview

- **WHEN** the reader follows a source/category/dataset route and returns
- **THEN** the same navigation context and overview camera are restored without requiring network requests

### Requirement: Reuse and analytical value are validated with real material

Acceptance SHALL include a second source from the same fixed input using the same algorithms and renderer with only scope/knowledge/configuration changes. Acceptance SHALL separately record the questions a reader can answer, supporting evidence and unresolved gaps. Test success, classification counts and dataset scale alone MUST NOT be described as business-value acceptance.

#### Scenario: The source template is applied to another available source

- **WHEN** an OIS or other verified source scope is configured
- **THEN** it produces source-to-object-to-task analysis without schema-specific frontend branches or copied computation
- **AND** the handoff records what useful explanation was obtained and what remains unsupported
