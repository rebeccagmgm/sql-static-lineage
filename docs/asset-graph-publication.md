# Asset Graph publication and retention

`npm run graph:publish` writes each changed task's complete local graph before
building cross-task continuations. It keeps only compact read/write and
continuation indexes between stages, so the published node IDs, edge IDs,
details, statuses, and `store.replace` transaction boundary are unchanged.

The graph is `UPDATING` until all local owners and affected continuation owners
are written. A successful run changes it to `READY`; a repeated publish of the
same prepared manifest returns `UNCHANGED`.

## Multi-write output qualification

Task-local `finalWrites` distinguishes the configured main target from other
SQL output candidates through the optional `outputQualification` field:

- `PLATFORM_TARGET`: the write matches the configured target. Its table-write
  edge is `CONFIRMED`; cross-task L1 eligibility still requires the existing
  identity and partition checks.
- `SQL_UNCONSUMED`: a non-primary write with confirmed physical identity and
  no detected later task-local read, subject to the temporary-name guard. Its
  table-write edge and cross-task continuation remain candidates, not L1
  evidence. A confirmed partition match does not change this qualification.
- Missing qualification: legacy projections keep their previous behavior.
  Explicit invalid values are rejected rather than silently treated as legacy.

Later task-local consumption is an intermediate-role signal, not proof that a
table can never be consumed externally. This conservative classification does
not establish a complete output inventory or a temporary table's lifecycle.

Read and write classification uses the same resolved physical identity; an
unqualified table name must not make an intermediate write look unconsumed.
Repeated writes retain separate write observations and field-source paths.

Multiple SQL statements are supported. A single statement with multiple write
branches fails explicitly with `MULTI_WRITE_STATEMENT_UNSUPPORTED`; SQL keywords
inside quoted values, quoted identifiers, or comments are not write branches.

After upgrading, regenerate affected Facts and prepare a new projection
manifest before publication. Versioned cache fingerprints invalidate the old
Facts/projection/compiler results; rerunning `graph:publish` against an old
prepared manifest alone does not regenerate its SQL evidence or output list.

## Retention

Task-local projection versions are not deleted during preparation or cache
writes. After `READY`, cleanup keeps cache keys named by every readable
`current.json` and `prepared.json` manifest below the shared graph root. It
only removes unreferenced derived projection versions and graph publication
directories. Input Packs, Facts, and documentation are outside this cleanup.

The publication report records elapsed time plus separate peak RSS values for
local and continuation import stages. Neo4j transaction-log retention is an
instance setting and is intentionally not changed by this command. For the
2026-09-06 controlled publication, a target-database checkpoint completed in
50.204 seconds and reduced its transaction-log files from 12 / 2,785,837,784
bytes to 10 / 2,248,579,770 bytes. The configured retention remains `2 days
2G`; the proposed `1 days 1G` setting has not been authorized because it would
apply to the instance's other databases as well.

## Published continuation evidence queries

These commands are read-only and resolve `current.json` to that publication's
immutable `union-continuation-index.json`; they do not prepare, publish, write
evidence, or connect to Neo4j.

```powershell
npm run graph:query -- metrics --gap-layer actionable --reason-code WRITER_PARTITION_UNKNOWN --limit 2 --offset 0
npm run graph:query -- query-read-candidates --read-occurrence-id '<read-occurrence-id>' --publication-version '<publication-version>' --limit 2 --offset 0
```

The reason-code option only filters the paged `metrics.items`; global metrics
always describe the complete frozen INDEX. Candidate queries expose the INDEX's
recorded matching status and read/write partition evidence without inferring
an L1 result. The INDEX contains only the read partition predicate status, so
the query does not reopen a newer projection to fetch predicate literals.
Reuse the returned `publicationVersion` on later pages; a changed current
publication fails instead of silently switching snapshots. If the same read
occurrence ID exists under multiple consumers, pass `--consumer-task-id`.
