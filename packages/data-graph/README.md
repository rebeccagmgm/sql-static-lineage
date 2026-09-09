# data-graph

`data-graph` is the downstream consumer of versioned `sql-static-lineage`
JSON/JSONL artifacts. It projects topology, field evidence, and target-table
causal overlays, then serves bounded file-backed and Neo4j-backed queries.

The producer remains the authority for SQL, Machine Facts, one-hop, multi-hop,
field-lineage, and target-table causal closure. This package only validates the
published artifact boundary and builds rebuildable projections.

The formal workflow is the repository-level `graph:prepare` -> `graph:publish`
-> `graph:query` / `graph:serve` asset graph. The older projection file queries
remain available for their nine bounded topology/field/causal queries, but the
separate query-index store, build, activation, status and parity lifecycle has
been retired. Neo4j access for the formal asset graph uses the shared
`src/neo4j/connection.ts` boundary.

This independent package was imported from `data-graph` mainline commit
`04a37cc`. It consumes only explicitly supplied published artifacts; it has no
source-repository path dependency and does not include producer data, caches,
or dependencies.

## Commands

```text
npm --prefix packages/data-graph ci --ignore-scripts
npm --prefix packages/data-graph run typecheck
npm --prefix packages/data-graph run build
npm --prefix packages/data-graph test
npm --prefix packages/data-graph run format:check
```

Migration verification (2026-09-05): typecheck, build, both continuation CLI
help entries, and package tests passed (119 tests; 3 optional-artifact tests
skipped). Tests used `--maxWorkers=2 --no-file-parallelism`. Changed-file
formatting passed; the full-package formatter still reports 84 inherited
files, which this migration intentionally leaves unchanged. One additional
real-artifact run returned no final test result and is not recorded as passed;
no matching test process remained when checked. This is a package relocation
verification, not acceptance of new producer contracts or graph coverage.

The package scripts invoke these entrypoints:

```text
npm run project-topology       -> src/project-graph/project-topology-cli.ts
npm run project-topology-view  -> src/project-graph/project-topology-view-cli.ts
npm run query                  -> src/project-graph/query/file-query-cli.ts
npm run field-evidence-graph   -> src/project-graph/field-evidence/field-evidence-cli.ts
npm run target-causal-overlay  -> src/project-graph/target-causal-overlay/target-causal-overlay-cli.ts
npm run union-continuation-v2  -> src/project-graph/topology/task-local-union/union-continuation-v2-cli.ts
npm run union-continuation-index -> src/project-graph/topology/task-local-union/union-continuation-index-cli.ts
```

Build a replayable WP-8.1 continuation index from current task-local 1.2.0
projections. The command indexes every `PROJECTED` task by default; pass
`--consumer-task-id` to limit the consumer tasks. `SCHEDULE_ONLY` and
`COLLECTION_FAILED` inputs are excluded, and any non-1.2.0 `PROJECTED` input
fails the whole run before output is written.

```text
npm --prefix packages/data-graph run union-continuation-index -- --batch-dir <published-task-local-batch-dir> --producer-index <producer-index.json> --consumer-task-id 119044 --output-dir tmp/wp8-continuation-index
```

Query a published projection directly. `--directory` selects the topology,
field-evidence, or target-causal-overlay directory appropriate to the query.
The loader checks the existing publication manifest and hashes. No separate
project key, descriptor hash, or snapshot identifier needs to be supplied.

```text
npm --prefix packages/data-graph run query -- --directory <snapshot-dir> --query get_project_topology --limit 20
npm --prefix packages/data-graph run query -- --directory <snapshot-dir> --query trace_project_upstream --start-node-id <node-id> --max-hops 3
npm --prefix packages/data-graph run query -- --directory <field-dir> --query trace_field_value_path --root-field <field-name> --max-hops 3
npm --prefix packages/data-graph run query -- --directory <overlay-dir> --query get_target_causal_overlay --relation-status UNKNOWN --limit 20
npm --prefix packages/data-graph run query -- --help
```

All nine query names listed by help use the same options and projection query
functions as the index CLI. Existing file-query APIs and the target-causal
query commands remain compatible. Shared CLI validation retains the existing
`QUERY_INDEX_*` error codes for compatibility, including on the file route.

For the offline page, use `project-topology-view` with the published topology
and field evidence. This view already reads file artifacts directly; the new
query entrypoint does not add continuation or causal-overlay UI features.

The retired `query-index`, `query-index:build`, `query-index:status`,
`query-index:query` and `query-index:parity` commands must not be used. Use the
direct `query` command above for these older projection artifacts. For the
formal data graph, use the repository-level `graph:query` command against an
already published graph version; the query layer does not build projections.

## Real artifact closed loop

Set `DATA_GRAPH_ACCEPTANCE_ROOT` to the published acceptance artifact root and
run the existing closed-loop test from this directory:

```powershell
$env:DATA_GRAPH_ACCEPTANCE_ROOT = 'E:\02_area\股衍数据-数据cookbook\sql-static-lineage-cache\project-topology-phase1\projects\joint-176827-181058-209119-acceptance'
npm --prefix packages/data-graph run test:real-artifact
```

The test consumes the published topology snapshot
`fa0f0ed6fe71fa2c5c9efb82d6e512c2e444d80fc0b57f334369f08648375fce`, field
evidence snapshot `1f42b891b585ad81c814ef89003222f39f00a1e0fda605904a202d0735f1121e`
and target-causal overlay `83ddd89c5c90f03d7fd3fe753628daced1ec479f2680a7caa35732b1a84e658d`.
It verifies one topology -> field-evidence -> causal-overlay consumption path
through direct projection loaders and the file-query CLI. It does not build an
index or connect to Neo4j. Without the required local artifacts, it is skipped.

## Boundary and current query scope

`sql-static-lineage` remains the canonical evidence producer. Its published
JSON/JSONL artifacts are authoritative for SQL/Plan Facts, Machine Facts,
one-hop, multi-hop, field-lineage and target-table causal closure.
`data-graph` only validates and projects those artifacts. `UNKNOWN`, `PARTIAL`,
gaps, `write_observation_id` and evidence references are preserved; graph and
index output is not a facts source and does not rerun runtime conclusions.

The retained file CLI and direct APIs share one query dispatcher and parameter
validation. The removed query-index backend called those same projection query
functions after loading its records, so retiring it does not remove the nine
file-query names. It does remove the optional Neo4j namespace, source
descriptor, staged build, activation, status and parity-audit contracts.
Continuation v2/index production remains a separate artifact workflow.

The task/dataset-level v1 `traceUnionUpstream` kernel and its exclusive helpers
have been retired after checking callers. Continuation uses the existing v2
read-occurrence and write-observation entrypoints. Historical 1.1.0 projection
loading and merging remain supported; v2 continues to require 1.2.0 evidence
and does not silently upgrade old snapshots. `ProducerIndexWriter` is now
exported by `task-local-union-producer-index.ts`.
