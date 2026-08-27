## 1. Baseline and semantic contracts

- [ ] 1.1 Freeze the current field-lineage VALUE_FLOW, ROWSET_CONTROL, default-Hive-schema, self-join occurrence, legacy artifact, and 209119 field-only behavior as regression fixtures without rerunning full input collection.
- [x] 1.2 Add the operator semantic support matrix and representative fixtures for CASE/IF/COALESCE, filters, join types, aggregates, distinct/setop, windows, Top-N, subqueries, COUNT(*), EXISTS, CROSS JOIN, and literal-from-relation.
- [x] 1.3 Add the orthogonal semantic dependency contract covering subject/effect/operator/root-dependence/local-edge dimensions, PathCertainty, support status, proof refs, and stable canonical IDs.
- [ ] 1.4 Extend Plan Facts expression/relationship projections only where canonical roles are currently missing, preserving original SQL bytes, source spans, scope IDs, occurrence IDs, and explicit Unknowns.

## 2. Shared physical resolution and expansion

- [x] 2.1 Extract a single physical-field resolver used by VALUE and all control dependencies, with qualified identity, Task default schema, unique catalog/Table Pack match, and task-local schema-backed resolution.
- [x] 2.2 Add resolver tests for bare tables, same-name tables in multiple schemas, missing schema evidence, task-local CTAS, and the 209119 default Hive database case.
- [ ] 2.3 Extract a shared physical-field expander for producer selection, read occurrence, producer write/output binding, Task loading, next binding, cycle/gap handling, and evidence references.
- [ ] 2.4 Add occurrence-specific bridge references to cross-Task VALUE/control edges and reject any bridge that cannot cite the consumer read and producer write continuously.

## 3. Native dependency normalization

- [ ] 3.1 Implement canonical dependency definitions, per-root applications, and local dependency edges without changing the legacy `edges = VALUE_FLOW` contract.
- [ ] 3.2 Implement expression-control normalization for CASE, IF, and COALESCE with separate branch-selector and value-contribution roles.
- [ ] 3.3 Implement rowset/window normalization for WHERE, HAVING, QUALIFY, all supported JOIN types, GROUP BY, DISTINCT, SETOP, WINDOW PARTITION/ORDER/FRAME, and ORDER BY combined with LIMIT/TOP/FETCH.
- [ ] 3.4 Implement relation-context normalization for COUNT(*), EXISTS, CROSS JOIN cardinality, literal-from-relation, and other supported fieldless row-existence dependencies.
- [ ] 3.5 Emit operator-specific support gaps for every unmodeled or structurally incomplete cell in the semantic matrix and ensure those gaps block negative proof.

## 4. Per-target causal traversal

- [ ] 4.1 Refactor traversal so every root target field owns independent visited, cycle, frontier, path-certainty, and decision state while sharing canonical evidence objects.
- [ ] 4.2 Add first-class EXPRESSION/ROWSET/WINDOW/RELATION control frontiers that recursively expand physical fields and relation occurrences across confirmed producer bridges.
- [ ] 4.3 Add independent value/control state and path budgets with a shared depth limit; control truncation must not lower a closed VALUE status.
- [ ] 4.4 Preserve real local edge kinds along mixed paths while retaining the root dependence reason used to assess the target field.
- [ ] 4.5 Add deterministic ordering, cycle termination, repeated-read isolation, and limit-specific gaps for all frontier kinds.

## 5. Candidate universe and evidence closure

- [ ] 5.1 Project Candidate Universe from the matching table multi-hop artifact, including ROOT_WRITE, PHYSICAL_PRODUCER, SCHEDULE_ONLY, UNBOUND_READ, BLOCKED_READ, and coverage boundaries.
- [ ] 5.2 Generate stable candidate branch IDs without producerRole and validate that every root-target-field × candidate-branch pair is represented exactly once.
- [ ] 5.3 Implement positive evidence closure and `CONFIRMED_RELATED / CONDITIONAL_RELATED / UNKNOWN` assessments with mandatory proof/gap references.
- [ ] 5.4 Implement negative proof and known-cut propagation for `PROVEN_UNRELATED`, restricted to fully observed and already enumerated candidate subtrees.
- [ ] 5.5 Generate the minimum confirmed rerun set and conservative safety rerun set with target-field, candidate-branch, proof, and gap references.

## 6. Artifact, CLI, summary, and HTML

- [ ] 6.1 Publish the new field-lineage artifact contract with definitions/applications/control edges, Candidate Universe, assessments, proofs, separate limits, metrics, and rerun sets while preserving legacy VALUE_FLOW readers.
- [ ] 6.2 Strengthen artifact validation for assessment-pair completeness, Unknown gaps, confirmed proof continuity, negative-proof obligations, non-vacuous closure metrics, and NOT_EVALUATED Precision/Recall.
- [ ] 6.3 Update the deterministic text summary to render per-field causal classifications, proofs/gaps, operator support, and both rerun sets from the canonical artifact only.
- [ ] 6.4 Update the HTML renderer to remain a pure artifact consumer and display value/control/relation paths, candidate coverage, assessments, limits, and rerun sets without recomputation.
- [ ] 6.5 Add a field-only CLI path that reuses matching Input Pack, Machine Facts, producer index, and table artifact fingerprints and reports the exact stale layer instead of triggering a full rebuild.

## 7. Calcite differential oracle

- [x] 7.1 Add a separately invoked Java tool pinned to Calcite 1.42.0 with deterministic JSONL stdin/stdout, version fingerprints, bounded inputs, and explicit unsupported/failed results.
- [x] 7.2 Implement Calcite extraction for expression lineage, predicates, unique keys, functional dependencies, table occurrences, and row-count/cardinality metadata on the supported fixture subset.
- [x] 7.3 Add a TypeScript differential reconciler that reports AGREED, NATIVE_ONLY, CALCITE_ONLY_UNMAPPABLE, NOT_EVALUATED, and CONFLICT without modifying canonical artifacts.
- [x] 7.4 Add an independent Calcite build/test command and ensure default `npm test`, production CLI, and field-only reconciliation neither build nor start Java.

## 8. Verification and bounded rollout

- [ ] 8.1 Run focused semantic, resolver, traversal, candidate-universe, assessment, artifact, summary, HTML, legacy compatibility, and Calcite differential tests.
- [ ] 8.2 Run repository typecheck, default tests, build, and format checks; classify any pre-existing failures separately from change regressions.
- [ ] 8.3 Reconcile Task 209119 from the existing matching immutable inputs, regenerate field JSON/summary/HTML only, and verify no full Task collection or producer-index rebuild occurred.
- [ ] 8.4 Inspect 209119 minimum/safety rerun sets, proof continuity, Unknown gaps, candidate-pair coverage, limits, and HTML parity; record Calcite sidecar go/no-go evidence without enabling it in production.
