# Phase 3 query index retirement

The former `packages/data-graph/src/project-graph/query-index/` product and its
`query-index`, `query-index:build`, `query-index:status`, `query-index:query`
and `query-index:parity` commands have been retired. They duplicated a second
store/schema/build/activation/status/parity lifecycle and had no repository
runtime consumer outside that product.

The nine bounded topology, field-evidence and target-causal query names remain
available through the direct projection file-query command; those query
algorithms were not owned exclusively by the retired index. The formal graph
workflow is the repository-level `graph:prepare`, `graph:publish`,
`graph:query` and `graph:serve` asset graph, using the shared
`packages/data-graph/src/neo4j/connection.ts` connector.

This retirement does not prove that repository-external query-index consumers
do not exist, and it does not claim the older nine file queries are already
semantically identical to the formal asset-graph query API. No Neo4j data,
namespace or database is deleted by removing the source product.

See the [current data-graph README](../packages/data-graph/README.md) for the
remaining commands and boundaries.
