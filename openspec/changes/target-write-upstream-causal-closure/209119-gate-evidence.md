# 209119 Target-rooted Propagation Gate Evidence

Date: 2026-08-29

## Execution boundary

This run used the existing Input Pack/Machine Facts, producer-index cache, table multi-hop artifact and existing field-lineage JSON. It did not collect tasks, rebuild the producer index, rebuild old field-lineage, invoke Calcite, or write `artifacts/tasks/209119`. The output was written to the separate `sql-static-lineage-artifacts/target-table-causal-closure/` directory.

## Baseline, M1 and M2

- Root is one resolved `TargetWriteIdentity` for `write-observation:209119:platform-target:0`.
- Candidate Universe contains 549 branch identities and is `INCOMPLETE` because the source table artifact exposes unbound/blocked/schedule/coverage boundaries.
- The main assessment key is `targetWriteId + candidateBranchId`; 137 target fields are not an assessment dimension.
- The field evidence adapter reads the old field-lineage JSON once (`fieldValueEvidenceScanCount=1`) and aggregates VALUE_FLOW evidence by consumer task, producer task and physical table.
- Occurrence-specific read identity remains on each candidate branch. Where the old field artifact does not carry a matching bridge occurrence, the result is not promoted to a fabricated unrelated conclusion.

## Gate A

The previously cached 209119 run completed in about 5 seconds wall time. The artifact records 1,750 ms of measured stage time, a peak RSS of 602,783,744 bytes (574.9 MiB), and no full field matrix. This is evidence for the earlier baseline artifact only; it is not a post-fix acceptance run.

| Metric | Result |
| --- | ---: |
| Candidate branches | 549 |
| Assessments | 549 |
| Field × branch matrix | not generated |
| Field evidence scans | 1 |
| Resolved physical producer branches | 238 |
| Ambiguous bridge/boundary observations | 44 |
| Missing/unbound/blocked boundary observations | 200 |
| Peak memory | 574.9 MiB |
| Decision coverage | 549/549 |

Gate A: **PASS WITH SCOPE** for branch cardinality and measured cached performance. Target-write identity, producer-write bridge closure and occurrence correctness are **PARTIAL / NOT VERIFIED** for the current post-fix code because the canonical 209119 field artifact was changed outside this run and was not overwritten or regenerated here.

## Historical pre-propagation result

The native summary consumes structured Machine Facts relation rows and relation edges. It covers the current first semantic batch: project expression control, filter, join (including outer/cross shape), grouping/aggregate markers, set operation, Top-N markers, COUNT(*), EXISTS and literal-from-relation relation dependence. An ordinary read alone is not treated as a confirmed relation-existence dependency.

For the earlier pre-propagation 209119 run:

- 239 branches are `CONFIRMED_RELATED` (238 physical producer branches plus the root write).
- 310 branches are `UNKNOWN`, with explicit gaps from schedule-only, unbound reads, blocked reads or coverage boundaries.
- There are no `PROVEN_UNRELATED` results because the observed table candidate universe is incomplete; this is intentional.
- The task rollup contains 78 upstream tasks. All 78 have at least one confirmed physical producer branch, so the minimum certain task set is also 78. The run does not claim task-count reduction for this SQL; the reduction is at branch level and the unresolved boundaries remain in the conservative safety set.

## Implementation fixes in the current code

The pre-propagation implementation fixed the CLI entry point, occurrence-scoped field lookup, statement-scoped summaries and negative-proof validation. It did not yet prove target-rooted multi-hop certainty.

## Gate B

Gate B: **NOT VERIFIED / REOPENED**. The current code does not yet provide evidence for target-rooted multi-hop certainty, same-channel alternative-path merging, or a product-level reduction in rerun tasks. M5/M6 remain paused, and Calcite remains the separately isolated Plan Facts-driven differential lane.

The output is a static candidate assessment, not a runtime rerun decision: `runtimeRerunDecision=NOT_EVALUATED`.

## Latest target-rooted read-only re-evaluation

On 2026-08-29 the target-table CLI was run in causal-only mode with the existing `field-facts`, producer-index, 209119 multi-hop artifact and the existing canonical field-lineage JSON as read-only inputs. Output was written only to `sql-static-lineage-artifacts/target-table-causal-closure/209119-path-propagation.{json,txt,html}`. No command in this run wrote or regenerated `sql-static-lineage-data/artifacts/tasks/209119`.

The latest artifact is schema `1.1.0` and records:

| Metric | Result |
| --- | ---: |
| Candidate branches / assessments | 542 / 542 |
| `CONFIRMED_RELATED` / `UNKNOWN` | 52 / 490 |
| Upstream tasks | 78 |
| Minimum certain tasks | 43 |
| Conservative safety tasks | 78 |
| Field evidence scans | 1 |
| Producer-write bridge enrichment | 155 resolved, 84 ambiguous, 193 missing |
| Decision coverage | 542/542 |
| Evidence closure | 100% for non-empty confirmed assessments |
| Explicit gaps | 1,377 |
| Runtime rerun decision | `NOT_EVALUATED` |
| Wall time / peak RSS | about 7 seconds end-to-end / 593,776,640 bytes (about 566 MiB) |

The propagation state is target-write rooted and carries write observation, channel, certainty, evidence/gap refs and a predecessor witness. It composes certainty along a path and merges same-channel alternatives by strongest evidence while retaining weaker-path gaps. The field-value adapter now handles the legacy opaque `occurrenceId:readRelationId` locator by exact whole-token comparison; it does not use substring matching.

The candidate universe remains `INCOMPLETE`, there are no `PROVEN_UNRELATED` assessments, and all unresolved evidence remains `UNKNOWN` with explicit gaps. `CONFIRMED_RELATED` is a static structural conclusion only; it does not establish runtime data change, partition overlap or a mandatory rerun. Therefore this run verifies the target-rooted propagation mechanics and bounded cost, but does not pass Gate B or establish a final runtime rerun list. M5/M6 remain paused.

## Canonical artifact isolation

The canonical directory `sql-static-lineage-data/artifacts/tasks/209119` was checked after the run. It still contains only the four pre-existing JSON files; `field-lineage.json` remains 23,290,979 bytes with SHA-256 `71487CE3869A9A5F2CD125263CB8AEC1B6408E6CAD1390F507551C25C6ADC768`, last written 2026-08-28 23:51:02. The target-table outputs remain in the separate `sql-static-lineage-artifacts/target-table-causal-closure/` directory.
