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
```

The CLI entrypoints are under `src/project-graph`. All input paths are passed
explicitly; no producer source path or shared dependency directory is used.
