# data-graph

`data-graph` is the downstream consumer of versioned `sql-static-lineage`
JSON/JSONL artifacts. It projects topology, field evidence, and target-table
causal overlays, then serves bounded file-backed and Neo4j-backed queries.

The producer remains the authority for SQL, Machine Facts, one-hop, multi-hop,
field-lineage, and target-table causal closure. This package only validates the
published artifact boundary and builds rebuildable projections.

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
npm run field-evidence-graph   -> src/project-graph/field-evidence/field-evidence-cli.ts
npm run target-causal-overlay  -> src/project-graph/target-causal-overlay/target-causal-overlay-cli.ts
npm run query-index             -> src/project-graph/query-index/query-index-cli.ts
```

For example, publish a target-causal overlay and build the query index from
published projections with:

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
through one query-index build.

## Boundary and current query scope

`sql-static-lineage` remains the canonical evidence producer. Its published
JSON/JSONL artifacts are authoritative for SQL/Plan Facts, Machine Facts,
one-hop, multi-hop, field-lineage and target-table causal closure.
`data-graph` only validates and projects those artifacts. `UNKNOWN`, `PARTIAL`,
gaps, `write_observation_id` and evidence references are preserved; graph and
index output is not a facts source and does not rerun runtime conclusions.

The migration adds one bounded graph-native topology upstream-path query,
`Neo4jQueryIndexStore.traceProjectUpstreamGraphNative`, with explicit hop and
result limits. Other file/index query families remain bounded consumers and
are not promised to be fully graph-native.
