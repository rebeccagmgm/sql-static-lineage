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

The cached 209119 run completed in about 5 seconds wall time. The artifact records 1,750 ms of measured stage time, a peak RSS of 602,783,744 bytes (574.9 MiB), and no full field matrix.

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

Gate A: **PASS**. The cost problem is addressed at the traversal granularity: the result is bounded by candidate branches rather than target fields multiplied by branches.

## M3 and M4 semantic result

The native summary consumes structured Machine Facts relation rows and relation edges. It covers the current first semantic batch: project expression control, filter, join (including outer/cross shape), grouping/aggregate markers, set operation, Top-N markers, COUNT(*), EXISTS and literal-from-relation relation dependence. An ordinary read alone is not treated as a confirmed relation-existence dependency.

For this 209119 run:

- 239 branches are `CONFIRMED_RELATED` (238 physical producer branches plus the root write).
- 310 branches are `UNKNOWN`, with explicit gaps from schedule-only, unbound reads, blocked reads or coverage boundaries.
- There are no `PROVEN_UNRELATED` results because the observed table candidate universe is incomplete; this is intentional.
- The task rollup contains 78 upstream tasks. All 78 have at least one confirmed physical producer branch, so the minimum certain task set is also 78. The run does not claim task-count reduction for this SQL; the reduction is at branch level and the unresolved boundaries remain in the conservative safety set.

## Gate B

Gate B: **PASS WITH EXPLICIT BOUNDARY** for the implemented baseline-M4 value. The output distinguishes direct field value evidence from row membership, multiplicity and relation-existence evidence, and every unknown points to a gap. It is worth continuing only with measured operator/bridge improvements; M5/M6 remain intentionally unstarted, and Calcite remains the separately isolated Plan Facts-driven differential lane.

The output is a static candidate assessment, not a runtime rerun decision: `runtimeRerunDecision=NOT_EVALUATED`.
