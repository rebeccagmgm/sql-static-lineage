# Phase 4 target causal overlay migration

The target-causal overlay projection and direct file queries remain in the
`packages/data-graph` consumer. Its former query-index backend has been
retired; this does not retire the overlay or its direct query API.

`sql-static-lineage` still owns and publishes the canonical
`target-table-upstream-causal-closure`, including cross-task propagation,
certainty, witnesses, budgets, task rollups, `UNKNOWN`/gaps,
`write_observation_id` and evidence references. The overlay is a rebuildable
consumer projection and must not turn into a facts source or rerun runtime
conclusions.

See the [current data-graph README](../packages/data-graph/README.md) for the
remaining commands, entrypoints and acceptance boundary.
