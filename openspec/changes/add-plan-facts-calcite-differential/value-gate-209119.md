# 209119 early Calcite value gate

Recorded on 2026-08-28. This gate used the existing fingerprint-matched Input Pack, Machine Facts and DDL evidence only. It did not recollect Horae inputs and did not publish lineage artifacts.

## Result

Decision: **GO for controlled broader operator expansion, with Calcite remaining an independent semantic corroboration lane.**

The Plan Facts lane now proves that Calcite can consume the repository's structured facts without a Hive SQL rewrite and that its evaluated observations can be mapped back to exact Native physical identities. It is not allowed to rewrite canonical field lineage or make a rerun decision by itself. The controlled expansion can therefore proceed for operator semantics, while canonical decisions remain Native-owned and evidence-conservative.

| Measure | Raw SQL lane | Plan Facts core lane |
| --- | ---: | ---: |
| Input outcome | Not used in this gate | 92/92 requests succeeded |
| Relation coverage | N/A | 92 successful projections; 39 explicit partial projection boundaries; 0 unsupported requests |
| Calcite observation occurrences | N/A | 8,684 |
| Unique Calcite evidence objects | N/A | 3,723 |
| Evaluated observations | N/A | 8,024/8,684 |
| Exact mapping of evaluated observations | N/A | 8,024/8,024 (100%) |
| Not evaluated observations | N/A | 660, each retained as an explicit boundary |
| Sidecar failures/conflicts | N/A | 0 process/protocol failures; 0 observation-id content conflicts |
| Native corroboration on `contr_status` | N/A | 8 exact Calcite proof refs attached without changing Native dependency IDs |
| Measured Native Unknown reduction | Not evaluated | Not claimed: the Calcite lane does not create or rewrite Native decisions |

The Plan Facts observations comprise expression lineage, predicates, unique keys, functional dependencies, table occurrences and row-count/cardinality metadata. The causal adapter maps the evaluated subset to exact physical fields or relation occurrences; 48 observations that cannot be assigned a valid operator descriptor are explicit `CALCITE_OPERATOR_MAPPING_UNSUPPORTED` boundaries, not dependencies. None is converted to unrelated evidence.

## Safety check

The independent reports are `staging/calcite-differential/209119-plan-facts-core-join-v4.json` and `staging/calcite-differential/209119-causal-evidence-v4.json`. The explicit Native overlay is `staging/calcite-differential/209119-contr-status-calcite-v4.json`. None is a canonical published artifact; the differential runner cannot write causal decisions or `PROVEN_UNRELATED`.

All four published 209119 acceptance hashes remained equal to `baseline-evidence.md` after the run:

- `field-lineage.json`: `49F4CD10B3C081430DFA4A63BD3DABF90E89679A020A667D866BF7B09579C5C6`
- `field-lineage.html`: `D52FD694097C09997938EB1A08175290894A0C0617A55ACC94762857441093FE`
- `target-field-causal-slice.json`: `DDB1A2C9CA1F8052C94CB48B04003879F87004252F21C07234D08FFC007AE15D`
- `target-field-causal-slice.html`: `DD69050C1D7525ACEAA59F749AC6552B1F9B1A9EF5580C3F06CF31EA3EB4C307`

## Expansion condition

The value gate is met for controlled expansion because the evaluated observations have a 100% exact mapping rate and provide measurable operator metadata, with no evidence-identity loss or canonical-path regression. This does not claim a Native `UNKNOWN` reduction: the overlay is intentionally proof-only. Future batches must retain the same exact-identity, explicit-boundary and default-off rules.
