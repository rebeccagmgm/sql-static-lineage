# POC Result

## Terminal decisions

- Provider decision: `VALIDATION_ONLY`
- Net value over current Native artifacts: `CALCITE_INCREMENTAL_VALUE_CANDIDATE_ONLY`
- Production integration: `NOT_STARTED`
- `PROVEN_UNRELATED`: disabled

Calcite is not useless, but this POC still does not justify making it the production semantic provider. The final occurrence-aligned five-case comparison found one exact Calcite-only indirect-impact candidate in 93338 and six occurrence-level precision improvements in 209119. The 93338 Native artifact is `PARTIAL`, so the candidate is not promoted to proven net-new rerun scope.

## What was compared

The terminal gate aligns the same SQL source identity, target write root and physical read occurrence across:

```text
A. existing field-lineage VALUE_FLOW
B. existing rowsetControls / Machine Facts relation evidence
C. Calcite impact facts
```

Calcite's own `FIELD_VALUE: 10 -> all impacts: 16` result for 209119 remains useful evidence that Calcite models indirect semantics, but it is not by itself evidence of value over Native. Only the A/B/C comparison is used for the terminal net-value decision.

## Five-case result

| Task   | Physical reads | Calcite                                | A: exact value | B: exact Native indirect | C: Calcite reached | Net result                                                               |
| ------ | -------------: | -------------------------------------- | -------------: | -----------------------: | -----------------: | ------------------------------------------------------------------------ |
| 93338  |              4 | `EVALUATED`                            |              3 |                        2 |                  4 | 1 `CALCITE_ONLY_CANDIDATE`; Native coverage is partial                   |
| 155015 |              2 | `EVALUATED`                            |              2 |                        2 |                  2 | complete overlap                                                         |
| 176827 |             18 | `NOT_EVALUATED / FUNCTION_UNSUPPORTED` |              7 |                       18 |                  0 | `pretradedate` has no supplied type contract                             |
| 181058 |              9 | `NOT_EVALUATED / PLANNER_FAILURE`      |              7 |                        9 |                  0 | exact query root selected; Hive `LATERAL VIEW POSEXPLODE` is unsupported |
| 209119 |             35 | `EVALUATED`                            |              5 |                       10 |                 16 | 6 occurrence-precision improvements; 0 new table/task scope              |

Aggregate: 68 physical read occurrences, three evaluated cases, two explicitly not evaluated, zero proven net-new Calcite occurrences, one candidate and six occurrence-precision-only improvements. Report digest: `bfda6bb93e5ac3df903f577a4f2caa9ea67aa421b844416b6b501633ac18eaae`.

## The 93338 candidate

Calcite reaches the exact Native occurrence for `pdata_n.t98_otc_deri_comp_sale_info` through an evaluated plan path containing field propagation plus join, set-membership and relation-existence dependencies. It reports `ROW_MEMBERSHIP`, `MULTIPLICITY`, `NULL_EXTENSION`, `SET_MEMBERSHIP` and `RELATION_EXISTENCE`; the plan witness has no traversal gap and its leaf maps to the exact Native read occurrence.

This is meaningful evidence that Calcite can expose an indirect-impact path not present as exact A/B evidence. It is still only a candidate because the current 93338 field-lineage/Native indirect coverage is partial and has `CONTROL_SCOPE_UNRESOLVED`. Claiming a proven net-new rerun branch would therefore overstate the evidence.

## Final bounded fixes

Two evidence-backed structural issues were fixed without expanding operator support:

- Multi-source tasks now select a statement only through the exact chain `write_observation_id -> output binding -> statement_id -> SQL slot`, and only when the statement uniquely matches the original slot. This moved 181058 past the former blanket multi-source rejection and exposed its real `LATERAL VIEW` boundary.
- Provider output no longer duplicates canonical Facts under legacy `observations`, and identical `NATIVE_EVIDENCE_NOT_ASSEMBLED` records share one issue while retaining every dependency mapping. This moved 93338 below the unchanged 4 MiB limit: 5,266 dependencies were emitted in about 3.39 MiB.

The POC did not invent a `pretradedate` contract, rewrite Hive `LATERAL VIEW`, raise the output hard limit, modify canonical artifacts or enable `PROVEN_UNRELATED`.

## What Calcite proved

- It emits structured direct and indirect channels from validated RelNode/RexNode semantics for the supported subset.
- It can provide exact Native leaf-occurrence and dependency-endpoint mappings for evaluated real statements.
- It improves occurrence/channel/witness precision for six 209119 reads.
- It finds one additional indirect-impact candidate in 93338 that deserves a separate business-value review.
- It runs once per unique SQL/schema digest rather than per target field or candidate branch.

## What remains unproved

- No net-new rerun table or task is proven over complete Native coverage.
- Two of five real cases remain not evaluated at explicit UDF/dialect boundaries.
- Derived operator/RexNode source-span closure remains incomplete.
- Calcite cannot write canonical artifacts, change Native conclusions or generate `PROVEN_UNRELATED` in this POC.

## Gate summary

- Direct extraction and representative semantic-edge corpus: passed within the declared subset.
- Exact Native leaf/dependency endpoint mapping: passed for evaluated evidence.
- Full operator source-span evidence closure: partial.
- A/B/C business-value gate: one candidate, no proven net-new scope.
- Production causal integration: not started.

## Evidence

- `staging/calcite-semantic-provider-poc/three-way-impact-differential/report.json`
- `staging/calcite-semantic-provider-poc/real-93338/`
- `staging/calcite-semantic-provider-poc/real-155015/`
- `staging/calcite-semantic-provider-poc/real-176827/`
- `staging/calcite-semantic-provider-poc/real-181058/`
- `staging/calcite-semantic-provider-poc/real-209119/`

All listed files are POC-local evidence, not canonical lineage or business artifacts.
