# POC Baseline

Captured on 2026-08-29 before application code changes.

## Git and exclusion boundary

- Branch: `codex/calcite-semantic-provider-poc`
- Base commit: `d7ed044fc043405a9039c0fea1ac543c60bea0b6`
- Pre-existing unrelated changes excluded from this Change:
  - `scripts/reconcile/consumer/field-lineage/physical-field-expander.ts`
  - `tests/physical-field-expander.test.ts`
- POC outputs are restricted to `staging/calcite-semantic-provider-poc/`.
- Existing `artifacts/tasks/**`, field-lineage, causal-slice and causal-closure artifacts are read-only.

## Existing Calcite assets

- Calcite version: `1.42.0` in both historical Maven modules.
- `tools/calcite-oracle/`: raw SQL + schema parsing/validation, JSONL process boundary, hard limits, schema loading and metadata extraction.
- `tools/calcite-rel-bridge/`: Plan-Facts projected RelNode construction, metadata queries, Jackson JSONL protocol and JUnit runtime tests.
- `scripts/calcite-oracle/`: legacy TypeScript protocol/reconciliation.
- `scripts/calcite-differential/`: Plan-Facts projection, process client, report guard and v18 differential workflow.
- Reusable implementation: JSONL framing, one-response-per-request, resource limits, Calcite schema/type loading, deterministic fingerprints, metadata status handling and one-JVM batching.
- Duplicate implementation eligible for later removal after replacement tests: raw-SQL oracle wrapper, Plan-Facts operator/expression projector, semantic reconciliation path and compatibility-only package commands.

## Package commands at baseline

- `npm run test:calcite-oracle`
- `npm run test:calcite-differential`
- `npm run calcite-causal-evidence`
- `npm run reconcile-target-table-causal-closure`

## Frozen 209119 evidence

Target-table causal-closure baseline from the preceding experimental Change:

- candidate assessments: 542
- confirmed related: 46
- unknown: 496
- minimum certain tasks: 41
- conservative tasks: 78
- elapsed: approximately 6 seconds
- peak memory: approximately 599 MiB
- newly confirmed through cross-channel transfer: 0

Calcite v18 differential boundary:

- responses: 114/114 process responses
- partial responses: 17
- `NOT_EVALUATED` observations: 1,565
- raw SQL requests: 0/0
- exact mapping applies only to evaluated observations
- no demonstrated reduction of current target-table Unknown assessments

External canonical files were hashed read-only:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `field-lineage.json` | 23,290,979 | `71487CE3869A9A5F2CD125263CB8AEC1B6408E6CAD1390F507551C25C6ADC768` |
| `input-pack-closure.json` | 6,862 | `070A73B6696268EB84F9698BED76658638A2785FE32C2BF76E1B6EC7F1307217` |
| `multi-hop.json` | 1,131,889 | `E7116D2F8010366DB990A2C315C9327D41E9ED9C5FFA0D03C0AB88CC0889BC20` |
| `one-hop.json` | 10,580,252 | `38B7FE0E578CD677081F92EE2EAAB11B5A36C683C8451BF28F219A23A0BE841F` |

These values are baseline evidence only. The POC must not rebuild, restore or publish any of these files.
