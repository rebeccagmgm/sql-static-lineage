# data-graph

`data-graph` is the downstream consumer of versioned `sql-static-lineage`
JSON/JSONL artifacts. It projects topology, field evidence, and target-table
causal overlays, then serves bounded file-backed and Neo4j-backed queries.

The producer remains the authority for SQL, Machine Facts, one-hop, multi-hop,
field-lineage, and target-table causal closure. This package only validates the
published artifact boundary and builds rebuildable projections.

The primary workflow is published artifacts -> file queries -> the offline
investigation view. Neo4j is an optional query-index backend; file queries and
the view do not require an index build, database connection, or database credentials.

## Commands

```text
npm install
npm run typecheck
npm run build
npm test
npm run format:check
```

The package scripts invoke these entrypoints:

```text
npm run project-topology       -> src/project-graph/project-topology-cli.ts
npm run project-topology-view  -> src/project-graph/project-topology-view-cli.ts
npm run query                  -> src/project-graph/query/file-query-cli.ts
npm run field-evidence-graph   -> src/project-graph/field-evidence/field-evidence-cli.ts
npm run target-causal-overlay  -> src/project-graph/target-causal-overlay/target-causal-overlay-cli.ts
npm run union-continuation-v2  -> src/project-graph/topology/task-local-union/union-continuation-v2-cli.ts
npm run union-continuation-index -> src/project-graph/topology/task-local-union/union-continuation-index-cli.ts
npm run query-index             -> src/project-graph/query-index/query-index-cli.ts
```

Build a replayable WP-8.1 continuation index from current task-local 1.2.0
projections. The command indexes every `PROJECTED` task by default; pass
`--consumer-task-id` to limit the consumer tasks. `SCHEDULE_ONLY` and
`COLLECTION_FAILED` inputs are excluded, and any non-1.2.0 `PROJECTED` input
fails the whole run before output is written.

```text
npm run union-continuation-index -- --batch-dir tmp/wp8-real-v2-119044 --producer-index ../../sql-static-lineage-data.producer-index/producer-index.json --consumer-task-id 119044 --output-dir tmp/wp8-continuation-index
```

Query a published projection directly. `--directory` selects the topology,
field-evidence, or target-causal-overlay directory appropriate to the query.
The loader checks the existing publication manifest and hashes. No separate
project key, descriptor hash, or snapshot identifier needs to be supplied.

```text
npm run query -- --directory <snapshot-dir> --query get_project_topology --limit 20
npm run query -- --directory <snapshot-dir> --query trace_project_upstream --start-node-id <node-id> --max-hops 3
npm run query -- --directory <field-dir> --query trace_field_value_path --root-field <field-name> --max-hops 3
npm run query -- --directory <overlay-dir> --query get_target_causal_overlay --relation-status UNKNOWN --limit 20
npm run query -- --help
```

All nine query names listed by help use the same options and projection query
functions as the index CLI. Existing file-query APIs and the target-causal
query commands remain compatible. Shared CLI validation retains the existing
`QUERY_INDEX_*` error codes for compatibility, including on the file route.

For the offline page, use `project-topology-view` with the published topology
and field evidence. This view already reads file artifacts directly; the new
query entrypoint does not add continuation or causal-overlay UI features.

Use the existing optional index commands only when a Neo4j-backed copy is
needed. For example:

```text
npm run target-causal-overlay -- publish --topology <snapshot-dir> --field <field-dir> --causal <closure.json> --output-root <dir>
npm run query-index:build -- --topology <snapshot-dir> --field <field-dir> --causal-overlay <overlay-dir> --audit-root <dir> <connection>
```

All input paths are passed explicitly; no producer source path or shared
dependency directory is used.

## Real artifact closed loop

Set `DATA_GRAPH_ACCEPTANCE_ROOT` to the published acceptance artifact root and
run the existing closed-loop test from this directory:

```powershell
$env:DATA_GRAPH_ACCEPTANCE_ROOT = 'E:\02_area\股衍数据-数据cookbook\sql-static-lineage-cache\project-topology-phase1\projects\joint-176827-181058-209119-acceptance'
npm run test:real-artifact
```

The test consumes the published topology snapshot
`fa0f0ed6fe71fa2c5c9efb82d6e512c2e444d80fc0b57f334369f08648375fce`, field
evidence snapshot `1f42b891b585ad81c814ef89003222f39f00a1e0fda605904a202d0735f1121e`
and target-causal overlay `83ddd89c5c90f03d7fd3fe753628daced1ec479f2680a7caa35732b1a84e658d`.
It verifies one topology -> field-evidence -> causal-overlay consumption path
through one in-memory query-index build, then compares all nine queries through
the file and index CLI routes against the existing file APIs, including their
evidence envelopes. This test does not connect to a live Neo4j server. Without
the required local artifacts, it is skipped.

## Boundary and current query scope

`sql-static-lineage` remains the canonical evidence producer. Its published
JSON/JSONL artifacts are authoritative for SQL/Plan Facts, Machine Facts,
one-hop, multi-hop, field-lineage and target-table causal closure.
`data-graph` only validates and projects those artifacts. `UNKNOWN`, `PARTIAL`,
gaps, `write_observation_id` and evidence references are preserved; graph and
index output is not a facts source and does not rerun runtime conclusions.

The file and index CLIs share one query dispatcher and parameter validation.
The index backend still loads the selected projection into memory before
executing the same query functions; a small result limit does not imply a
small database read. Index expansion and performance optimization are outside
the current consolidation scope.

The standalone `Neo4jQueryIndexStore.traceProjectUpstreamGraphNative` method
and its path types have been retired. It had no caller in the checked CLI,
view, or sibling consumer code. Existing `query-index` commands and indexed
query APIs retain their query behavior, source checks and activation gates.
Continuation v2/index production remains a separate artifact workflow.

The task/dataset-level v1 `traceUnionUpstream` kernel and its exclusive helpers
have been retired after checking callers. Continuation uses the existing v2
read-occurrence and write-observation entrypoints. Historical 1.1.0 projection
loading and merging remain supported; v2 continues to require 1.2.0 evidence
and does not silently upgrade old snapshots. `ProducerIndexWriter` is now
exported by `task-local-union-producer-index.ts`.
