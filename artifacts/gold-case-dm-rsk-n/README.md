# gold-case-dm-rsk-n (legacy projection snapshots)

This directory holds **checked-in task-local projection JSON** used for manual inspection and historical comparison on the DM_RSK_N anchor expansion case.

## Schema version

Most files under `project-graph/tasks/*/task-local-projection.json` were captured at **`schemaVersion: "1.2.0"`** (pre–field-evidence-v1). They do **not** include:

- `sourceReadOccurrenceId` / read-occurrence status on field edges
- `gaps[]` (materialization breaks, control-side unresolved, read-occurrence gaps)
- JOIN `joinType` / `controlSide` on `DATASET_CONTROL` edges

For **1.3.0** behavior and §5.5 acceptance, use:

- `npm run test:task-local-projection` (includes `tests/project-graph/field-evidence-v1/phase1-acceptance.test.ts`)
- `artifacts/field-evidence-v1/phase1-baseline.json` (cohort metrics + `anchorTaskRatios`)

Regenerating a single task at 1.3.0 (requires sibling `sql-static-lineage-data/field-facts`):

```bash
npm run inspect -- project-task-local --data-root ../sql-static-lineage-data \
  --facts-root ../sql-static-lineage-data/field-facts --task-ids 181058
```

Do not treat 1.2.0 files here as the contract reference for field-evidence-v1 Phase 1.
