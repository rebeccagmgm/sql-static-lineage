# POC Result

## Decision

`VALIDATION_ONLY`

Calcite 1.42.0 is demonstrably useful for direct SQL relational semantics, but
this POC did not close the exact Native occurrence/span evidence mapping gate.
It therefore must not replace the current task-local semantic path or feed
confirmed causal decisions yet.

## What was proved

- The ten-sample corpus completed with 10 `SUCCESS` responses, no unsupported
  sample, no process error and no missing expected dependency kind.
- The frozen 209119 statement parsed, validated and converted directly from
  SQL and exact schema evidence. It produced 129 relations and 348 evaluated
  dependencies, including value, expression selector, filter, join match,
  join cardinality, grouping, set membership and relation-existence facts.
- The real statement completed in 2,380.500 ms with a 420,474,880-byte peak
  working set. The corpus completed in 1,931.471 ms with a 342,257,664-byte
  peak. Both are within the POC budgets.
- The real statement required nine bounded reserved-identifier quoting
  transforms. They are recorded with reversible before/after spans and do not
  alter relation semantics.
- The Provider and TypeScript consumer remain isolated from production
  artifacts and do not use a Native semantic fallback.

## Gate that failed

All 348 evaluated dependencies remain `UNMAPPABLE`; exact mapping is 0/348.
The Provider correctly reports `NATIVE_EVIDENCE_NOT_ASSEMBLED` and leaves the
statement `PARTIAL`.

The mapping gap is structural, not a Calcite parse failure:

- Calcite `RelNode` does not retain the original SQL source span needed by the
  existing evidence contract.
- Native facts preserve CTE references and independent CTE definition graphs,
  while Calcite expands CTEs into the relational plan. The two graphs are not
  directly occurrence-isomorphic.
- Mapping repeated table reads by table-name order, tail names, substrings or
  field names would be guessing and is forbidden.

Building a TypeScript dual-graph matcher would be a large new compatibility
engine and would undermine the goal of keeping Calcite as the sole supported
operator semantic source. This POC intentionally does not do that.

## Architecture consequence

Keep the existing field lineage, Multi-hop, Machine Facts and cross-task
causal propagation unchanged. The current Calcite Provider is suitable for
offline semantic validation only.

A future, separately approved experiment may try a same-front-end source map
inside the Java Provider: retain validated `SqlNode` parser positions and carry
their occurrence identity into normalized RelNode dependencies. Only if every
evaluated dependency maps exactly should the route be reconsidered. Because
the real SQL needs bounded identifier quoting, a successful mapped result would
be `THIN_ADAPTER_REQUIRED`, not `DIRECT_PROVIDER`.

## Evidence

- `staging/calcite-semantic-provider-poc/corpus/support-matrix.json`
- `staging/calcite-semantic-provider-poc/real-209119/input-manifest.json`
- `staging/calcite-semantic-provider-poc/real-209119/response.json`
- `staging/calcite-semantic-provider-poc/real-209119/runtime-metrics.json`
- `staging/calcite-semantic-provider-poc/poc-report.json`

The staging files are POC evidence, not canonical business or lineage output.
