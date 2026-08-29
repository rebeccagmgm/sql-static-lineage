# Phase 3 query index

Phase 3 is an opt-in Neo4j query index over one validated Phase 1 project
topology snapshot, an explicit set of validated Phase 2 field-evidence
snapshots and optional validated Phase 4 target-causal overlays. The immutable
files remain the evidence authority. Neo4j is a
rebuildable index and is not called by `lineage:all`, Phase 1/2 publication or
the existing file-backed query commands.

## Connection and secrets

Every Phase 3 command requires an explicit URI, username and database plus
exactly one password source:

- `--password-env <NAME>` reads a named environment variable.
- `--password-file <absolute-path>` reads one bounded local secret file.

A direct `--password` argument is rejected. URI, username, password, password
file path and absolute source paths are excluded from canonical build and audit
identity. `--target-alias` is optional non-secret runtime diagnostics.

## Explicit commands

```text
npm run query-index:build -- --topology <absolute-dir> --field <absolute-dir> [--causal-overlay <absolute-dir>] --audit-root <absolute-dir> <connection>
npm run query-index:status -- --project-key <key> <connection>
npm run query-index:query -- --project-key <key> --expected-descriptor-hash <sha256> --query <query-name> <query-options> <connection>
npm run query-index:parity -- --topology <absolute-dir> --field <absolute-dir> [--causal-overlay <absolute-dir>] <connection>
```

Run `npm run query-index -- --help` for the complete connection form. `--field`
and `--causal-overlay` are repeatable. Every causal overlay must reference a
field snapshot included in the same build. Build and parity validate all source
manifests, files, counts, ordering and endpoints before opening a database
connection.

Node imports honor the configured batch size. Relationship imports are capped
at 10 records per transaction because live Neo4j 2026.06 acceptance showed
large locking `MERGE` batches scale pathologically even when endpoint indexes
are online. Query pagination casts JavaScript numeric parameters with
`toInteger(...)` for Neo4j 2026 compatibility.

## States and publication gate

- `STAGING`: isolated records may be incomplete and are never served as the
  project current index.
- `READY`: import validation and every required full-envelope parity case have
  passed.
- `FAILED`: a build failed import, validation or parity and cannot be activated.
- `SL_CURRENT_INDEX`: the single project pointer switched in one transaction
  only after the staged build is ready.

The local audit is installed atomically under
`projects/<projectKey>/query-index/<indexBuildId>/` and contains
`query-index-manifest.json` plus `parity-report.json`.

## Fail-closed querying and rollback

Indexed queries require the caller's expected immutable source-descriptor hash.
An older current build returns `QUERY_INDEX_STALE`; a missing, staging, failed or
non-current build returns `QUERY_INDEX_UNAVAILABLE`; an absent selected field
snapshot returns `QUERY_INDEX_FIELD_SNAPSHOT_UNAVAILABLE`; an absent causal
snapshot returns `QUERY_INDEX_CAUSAL_SNAPSHOT_UNAVAILABLE`. There is no
transparent file fallback or cross-build merge.

Rollback means atomically repointing to a previously accepted exact build or
disabling the Phase 3 entry point. Cleanup is an explicit exact-build operation.
It must never clear a database, a whole project, historical KG labels or another
project/build. The tool does not start, provision or clear Neo4j.

Immutable Phase 3 `1.0.0` source descriptors remain readable as rollback
targets. New Phase 4-capable descriptors are `1.1.0`; the exact source bytes,
not a database connection or runtime path, determine the new build ID.
