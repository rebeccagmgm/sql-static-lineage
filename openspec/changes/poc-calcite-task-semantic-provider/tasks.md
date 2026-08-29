## 1. Baseline and isolation

- [x] 1.1 Record the current branch/commit, existing unrelated dirty files, Calcite 1.42.0 tool inventory, package commands and changed-file exclusion list for this POC.
- [x] 1.2 Freeze the current 209119 target-table metrics, Calcite v18 partial/`NOT_EVALUATED` evidence and hashes of the external canonical files without rewriting them.
- [x] 1.3 Inventory reusable JSONL, resource-limit, schema-loading, metadata and runtime-test code from `calcite-oracle` and `calcite-rel-bridge`; identify duplicate compatibility/projector code eligible for later deletion.
- [x] 1.4 Add a POC-only staging root guard and tests proving no command can resolve an output under `artifacts/tasks/` or existing lineage/causal artifact filenames.

## 2. Candidate TaskSemanticFacts contract

- [x] 2.1 Create `canonical-task-semantic-facts.schema.json` for POC-local candidate Facts with provider/input fingerprints, statement status, capabilities, relation/field occurrences, operators, local dependencies, metadata, evidence mappings and issues.
- [x] 2.2 Add immutable TypeScript types plus strict validation for stable ids, contiguous slots, exact mapping refs, supported dependency/impact kinds and deterministic ordering.
- [x] 2.3 Implement the two-dimensional metadata contract: `evaluationStatus` and `knowledgeStatus`, including basis and `absenceProven`; reject empty/null metadata interpreted as negative proof.
- [x] 2.4 Add valid, partial, unsupported, unmappable and malformed JSON fixtures and round-trip/hash tests without any SQL semantic inference in TypeScript.

## 3. Single Calcite semantic provider foundation

- [x] 3.1 Create the consolidated `tools/calcite-semantic-provider/` module pinned to Calcite 1.42.0 by migrating the useful JSONL process boundary, hard limits and deterministic response behavior from the existing tools.
- [x] 3.2 Define a bounded SQL/schema request containing SQL source identity, SQL text/hash, catalog/schema tables, concrete types/nullability, dialect configuration, typed dynamic parameters and requested capabilities.
- [x] 3.3 Implement Calcite parser, validator and unoptimized relational conversion for the supported input envelope; return structured `SUCCESS`, `PARTIAL`, `UNSUPPORTED` or `ERROR` without broad `ANY` fallback.
- [x] 3.4 Preserve one-response-per-input behavior, fixed protocol/build fingerprints, deadline/node/output limits and module-local runtime tests.

## 4. RelNode semantic extraction

- [x] 4.1 Extract stable provider-local relation/operator/input/output slot observations from validated RelNode/RexNode without emitting a raw RelNode dump as final Facts.
- [ ] 4.2 Implement and golden-verify project/value, CASE/IF/COALESCE, filter/having/qualify and side-aware inner/outer/semi/anti/cross join local dependencies and impact kinds in the Java Provider adapter.
- [x] 4.3 Implement and golden-verify aggregate/GROUP BY/COUNT(*), true DISTINCT, UNION/INTERSECT/EXCEPT role-specific and relation-existence/multiplicity dependencies, preserving fieldless dependencies.
- [x] 4.4 Implement and golden-verify window value/partition/order/frame and ORDER BY + LIMIT/TOP/FETCH dependencies, deduplicating equivalent Project/RexOver and Window RelNode facts while keeping ordering-only effects distinct from row selection.
- [x] 4.5 Emit predicates, expression lineage, unique keys, functional dependencies, row count/selectivity/cardinality where Calcite evaluates them, using exact/derived/estimated/unknown knowledge status.
- [ ] 4.6 Add Java/golden tests for each supported operator, exact edge endpoints/direction/impact/side roles, duplicate and unexpected-edge rejection, missing schema/type, unsupported function, metadata unknown, self join occurrence isolation and resource limits.

## 5. Dialect adaptation and evidence assembly

- [x] 5.1 Implement a Native evidence adapter that loads only fixed SQL slot/statement identity, raw text/token/span, physical table/field identity and existing evidence refs; it must not emit relation semantics.
- [ ] 5.2 Implement the SemanticFactAssembler mapping Calcite relation/slot observations to Native statement, relation occurrence, field occurrence, physical identity, source span and evidence refs with `EXACT` or explicit unmappable status.
- [ ] 5.3 Cover self join, repeated table occurrence, nested scope and output-slot mapping; reject substring, tail table-name and bare-field-name fallback.
- [x] 5.4 Implement a versioned dialect transform manifest for statement extraction, identifier quoting, conformance and typed parameters; reject transforms that alter join/filter/aggregate/scope/field semantics.
- [x] 5.5 Add mapping and dialect tests for exact, partial, ambiguous and unsupported cases, including deterministic before/after span references.

Semantic outcome: full-edge golden verification now passes for 10/10 representative samples. Task 4.2 remains open because the corpus does not yet prove every advertised QUALIFY and SEMI/ANTI instance; task 4.6 remains open rather than treating representative coverage as every supported operator.

Mapping outcome: 5.1 is complete. The same-front-end source occurrence experiment anchored all 35 Calcite physical `TableScan` leaves and mapped all 35 to unique Native read occurrences: 20 by identical full span and 15 by exact table-identifier prefix inside a Native span that additionally contains the alias. All 3,841 dependency endpoints recursively reach exact Native leaf evidence with zero ambiguous/unmappable mappings. Tasks 5.2-5.3 remain open because operator source spans and complete operator-level evidence closure are still `NOT_ASSEMBLED`; leaf/endpoint closure must not be presented as full SemanticFactAssembler completion.

## 6. Thin TypeScript consumer and runner

- [x] 6.1 Create `scripts/calcite-semantic-provider/` with schema validation, deterministic serialization/hash, issue/capability summaries and a read-only query interface over CandidateTaskSemanticFacts.
- [x] 6.2 Add guard tests proving the TypeScript path does not parse alias/scope/expression trees, switch on SQL operator semantics or substitute a Native SemanticProvider when Calcite Facts are missing.
- [x] 6.3 Implement an explicitly invoked POC runner that batches requests in one bounded JVM, caches by SQL/schema/dialect/provider digest and executes each digest at most once.
- [x] 6.4 Write only POC-local candidate JSON/JSONL, per-sample summaries, support matrix and performance data under the staging guard.

## 7. Representative corpus and real SQL

- [x] 7.1 Add 8-10 representative SQL/schema fixtures covering projection, conditional expressions, filters, join variants/self join, aggregate/COUNT(*), DISTINCT/setop, EXISTS/literal/CROSS JOIN, window and Top-N.
- [x] 7.2 Select and freeze one existing complex Horae/Hive statement with CTE/JOIN/filter/expression projection and complete available schema, recording its SQL source identity and input hashes without collecting new external data.
- [x] 7.3 Preserve a real `PROJECT_EXPRESSION_STRUCTURE_UNSUPPORTED` case and prove Calcite either emits exact expression dependencies or retains explicit unsupported/unknown without SQL simplification, hand-authored dependency or TypeScript fallback.
- [x] 7.4 Generate and validate one candidate Facts JSON for every sample and the real statement, including mapping status, capabilities, unsupported reasons and metadata quality.
- [x] 7.5 Replace kind-only corpus acceptance with full golden semantic-edge validation and record per-sample missing, unexpected, duplicate and mismatched edges.

## 8. Code convergence in the experimental branch

- [x] 8.1 Migrate all still-required raw-SQL parser, metadata, JSONL, hard-limit and runtime-test behavior into the consolidated Provider and prove replacement with focused tests.
- [x] 8.2 Remove the old Java `calcite-oracle`; retain only documented TypeScript compatibility shapes still imported by existing code, with no fallback use in this POC.
- [x] 8.3 Isolate the Plan-Facts operator projector/differential runner from the new Provider path; no POC command runs both semantic paths.
- [x] 8.4 Verify existing field-lineage, multi-hop, Machine Facts, target-field slice and target-table causal code remains untouched except for package/test wiring strictly required by this POC.

## 9. POC gate and decision

- [ ] 9.1 Run TypeScript targeted tests, default tests affected by package wiring, typecheck, build and format checks using project npm scripts; run the independent Maven/runtime suite.
- [ ] 9.2 Verify deterministic output, 100% exact mapping for every evaluated dependency, explicit unsupported/unmappable boundaries, absence of Native semantic fallback and unchanged canonical artifact hashes.
- [x] 9.3 Measure cold corpus time, warm real-statement time, peak heap, request/output size and digest cache behavior against the proposed 30-second corpus, 5-second warm statement and 1-GiB heap budgets.
- [x] 9.4 Publish the revised machine-readable support matrix and final POC report with Gate A/B/C/D, exactly one decision (`DIRECT_PROVIDER`, `THIN_ADAPTER_REQUIRED`, `VALIDATION_ONLY` or `NO_GO`), and separate leaf occurrence, dependency endpoint, operator-span and full-closure metrics for the real SQL.
- [x] 9.5 Resolve the focused-review findings for outer joins, correlated subqueries, Window duplication, CROSS JOIN multiplicity, SETOP roles, identity guessing and hidden Unknown; rerun affected checks without touching unrelated dirty files.
- [x] 9.6 Stop after the POC decision. Do not integrate with multi-hop/target-table closure, modify runtime rerun policy, publish canonical artifacts or start a production Provider migration in this Change.

Verification outcome: 9.1 remains open because the repository-wide formatting baseline has 12 pre-existing documentation warnings and the default suite has 6 pre-existing `task-inspection` fixture failures (365 tests pass, 3 skip, 1 todo). 9.2 remains open because operator source spans/full evidence closure are not assembled; deterministic output, 35/35 exact leaf occurrence mapping, 3,841/3,841 exact dependency endpoint mapping, explicit fail-closed boundaries, no Native fallback and unchanged canonical hashes pass independently.
