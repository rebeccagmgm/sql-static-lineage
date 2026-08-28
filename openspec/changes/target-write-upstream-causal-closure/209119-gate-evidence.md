# 209119 Baseline-M4 Gate Evidence

Date: 2026-08-28

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

## M3 and M4 semantic result

The native summary consumes structured Machine Facts relation rows and relation edges. It covers the current first semantic batch: project expression control, filter, join (including outer/cross shape), grouping/aggregate markers, set operation, Top-N markers, COUNT(*), EXISTS and literal-from-relation relation dependence. An ordinary read alone is not treated as a confirmed relation-existence dependency.

For this 209119 run:

- 239 branches are `CONFIRMED_RELATED` (238 physical producer branches plus the root write).
- 310 branches are `UNKNOWN`, with explicit gaps from schedule-only, unbound reads, blocked reads or coverage boundaries.
- There are no `PROVEN_UNRELATED` results because the observed table candidate universe is incomplete; this is intentional.
- The task rollup contains 78 upstream tasks. All 78 have at least one confirmed physical producer branch, so the minimum certain task set is also 78. The run does not claim task-count reduction for this SQL; the reduction is at branch level and the unresolved boundaries remain in the conservative safety set.

## Implementation fixes in the current code

The current uncommitted patch fixes four mechanical defects and has focused regression coverage: the CLI now calls the shared closure entry point; field-value lookup requires the read occurrence; relation summaries are scoped by statement; and negative proofs are typed, deterministic and content-validated. These tests do not prove full global path certainty; task 6.3 remains open.

## Gate B

Gate B: **NOT VERIFIED / REOPENED**. The current code does not yet provide evidence for target-rooted multi-hop certainty, same-channel alternative-path merging, or a product-level reduction in rerun tasks. M5/M6 remain paused, and Calcite remains the separately isolated Plan Facts-driven differential lane.

The output is a static candidate assessment, not a runtime rerun decision: `runtimeRerunDecision=NOT_EVALUATED`.

## Post-fix read-only re-evaluation

On 2026-08-29 the target-table CLI was run in causal-only mode with the existing `field-facts`, producer-index, 209119 multi-hop artifact and the existing canonical field-lineage JSON as read-only inputs. Output was written only to `sql-static-lineage-artifacts/target-table-causal-closure/209119-post-fix.{json,txt,html}`. No command in this run wrote or regenerated `sql-static-lineage-data/artifacts/tasks/209119`.

The post-fix artifact is schema `1.1.0` and records 542 candidate branches, 542 assessments, 142 `CONFIRMED_RELATED`, 400 `UNKNOWN`, 78 upstream tasks, 60 minimum-certain tasks and 78 conservative-safety tasks. Field evidence was scanned once. Producer-write bridge enrichment resolved 155 branches, found 84 ambiguous writes and 193 missing/boundary observations. The run took about 4.8 seconds wall time and peaked at about 580 MiB RSS. Decision coverage is 542/542 and the evidence-closure metric is 100%; this metric does not prove full path certainty.

The candidate universe remains `INCOMPLETE`, there are no `PROVEN_UNRELATED` assessments, one relation summary remains partial, and 772 explicit gaps remain. Therefore this run verifies the mechanical fixes and bounded cost, but does not pass Gate B or establish a final task rerun list. Path certainty/alternative-path merging remains task 6.3, and M5/M6 remain paused.
