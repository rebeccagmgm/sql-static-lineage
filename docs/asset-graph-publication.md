# Asset Graph publication and retention

`npm run graph:publish` writes each changed task's complete local graph before
building cross-task continuations. It keeps only compact read/write and
continuation indexes between stages, so the published node IDs, edge IDs,
details, statuses, and `store.replace` transaction boundary are unchanged.

The graph is `UPDATING` until all local owners and affected continuation owners
are written. A successful run changes it to `READY`; a repeated publish of the
same prepared manifest returns `UNCHANGED`.

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
