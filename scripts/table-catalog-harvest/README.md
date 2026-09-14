# Table catalog union harvest

Collects read-only metadata for the union of the 13 observed classification directories and
tables whose owning system is the selected big data platform. Preserves the existing page's
active/non-temporary scope. Virtual-directory membership is a source relation, not a fabricated tag.

Uses the installed OpenCLI portal helper and a dedicated browser session. Its site-internal
request contract was verified against the visible page and live bounded queries; it is not a
documented bulk-export API. No business-table data is queried. Authentication stays inside the
browser and is never written to output. The transport accepts only the observed search endpoint.

```powershell
node scripts/table-catalog-harvest/run.mjs --pilot --output outputs/table-catalog-union-20260911
node scripts/table-catalog-harvest/run.mjs --output outputs/table-catalog-union-20260911
node scripts/table-catalog-harvest/run.mjs --status --output outputs/table-catalog-union-20260911
```

The first command verified a complete 106-table group. The second continues the same SQLite
database. No change to configuration is accepted in an existing database. A process lock prevents
parallel collectors. Place `stop.requested` in the output directory to pause after the current
request; remove that file before explicitly resuming with the second command.

Outputs: `catalog.sqlite`, `status.json`, `config.json`, and redirected process logs. SQLite uses
WAL and transactions per page. `assets`/`union_tables` contain GUID-deduplicated records;
`table_sources` preserves group origins; `observed_classifications` contains tags actually seen;
`pages` retains full source responses; `groups` and `events` retain checkpoints and diagnostics.
Tags are observations during a live crawl, not an assertion of a transactionally frozen catalog.

Requests are sequential, with a random 1000–1500 ms delay after each request completes.
HTTP 429 receives bounded exponential backoff; persistent network/authentication failures pause
the run. Page number times page size never exceeds 10,000. Oversized root classifications use
observed child paths; the big data platform uses its database inventory and **qualified database
names**, not database asset GUIDs, as filters. Each database query retains the system filter and
checks the returned parent identity. Oversized leaves and unexplained coverage gaps remain partial.

Every completed leaf has a unique-count check and a first-page/total recheck. Aggregated roots
also compare unique coverage to their current root total. These checks detect several common
live-pagination drifts but do not create source snapshot isolation. A database inventory gap,
direct-parent-only classification assignments, or source changes can leave the run `PARTIAL`.
Do not report complete extraction unless status is `COMPLETE`; even then retain the live-crawl
time bounds and query conditions.

Local tests use Node's built-in test runner and SQLite, with no additional dependencies:
`node --test scripts/table-catalog-harvest/store.test.mjs`.

## Partition filter snapshots

`node scripts/table-catalog-harvest/partition-run.mjs --pilot` verifies five tables;
omit `--pilot` to resume all tasks. `--status` reads progress without a browser.
The queue is frozen from the current 68,889-table catalog on first creation.
Kafka topics are marked not applicable. The output is
`outputs/partition-filter-harvest-20260912/partition-filters.sqlite`.
Place `stop.requested` in that output directory to pause; remove it before resuming.
Only one collector can hold the process lock. Requests run serially with a random
1–1.5 second delay after each response. The specifically verified business error
`typeName is null` (HTTP 200, business code 1, exact observed message) marks that
table BLOCKED, records an event, and immediately proceeds to the next table.
The user-authorized exact response `查询异常null` (HTTP 200, business code 1)
also skips only that table, recording `SOURCE_PARTITION_QUERY_NULL` and the
message in the event. Its cause remains unverified; it does not prove deletion.
Permissions, rate limits, unknown business errors and data validation failures
still pause the entire run. A finished queue with BLOCKED tables is FINISHED_PARTIAL.

`tasks` records table identities and keys; `filters` stores independent per-key
values, never inferred partition combinations. Business values are preserved;
observed consecutive daily dates are summarized by count and range. Monthly,
sparse, uncertain, or special dates retain their values. A day observation is
not proof of daily production cadence. No partition detail records are fetched.
The option endpoint has no exposed total/pagination contract, so captures remain
`CAPTURED_UNVERIFIED` / `UNVERIFIED_ENDPOINT_TOTAL`, not proven full snapshots.
The values endpoint requires JSON; the keys endpoint accepts form parameters.
