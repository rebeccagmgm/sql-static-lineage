## 1. TL-0 Contract and identity

- [x] 1.1 Add `scripts/project-graph/task-local/contract.ts` with `TASK_LOCAL_PROJECTION` types, schema version, and validator (reject cross-task data edges, `affectedRootFields`, `rowsetControls`).
- [x] 1.2 Add `scripts/project-graph/task-local/ids.ts` copied from data-graph identity algorithms.
- [x] 1.3 Add frozen vector tests for `176827`, `dm_rsk_n.otc_opt_greek_val_det_h`, `write-observation:176827:platform-target:0`, `odata_n_tit.d_ref_trs.key_otc_trade_id`.
- [x] 1.4 Wire `npm run test:task-local-projection` and keep `npm run typecheck` green.

## 2. TL-1 Single-task projection kernel

- [x] 2.1 Implement `projectTaskLocal(taskId)` loading Facts only.
- [x] 2.2 Emit TASK / TARGET_WRITE / WRITES / READS / FIELD_DIRECT / DATASET_CONTROL / FIELD_CONDITIONAL in documented order.
- [x] 2.3 Allow `FIELD_DIRECT.subtype = UNKNOWN` with typed gaps when subtype cannot be derived.

## 3. TL-2 Shared control collection

- [x] 3.1 Extract `datasetControlsForStatement` (+ grain) to a shared module importable by field-lineage and task-local projection.
- [x] 3.2 Keep `npm run test:field-lineage` byte-level behavior unchanged.

## 4. TL-3 Coverage states

- [x] 4.1 Implement `PROJECTED`, `SCHEDULE_ONLY`, `COLLECTION_FAILED` with reason codes.
- [x] 4.2 Batch summary counts per status.

## 5. TL-4 Content-hash cache

- [ ] 5.1 Cache key: taskId + pack hash + facts manifest + projection schema version.
- [ ] 5.2 Second batch all cache hit; single changed SQL hash only misses that task.

## 6. TL-5 Batch CLI

- [ ] 6.1 `npm run project-task-local --` with `--topic DM_RSK_N`, `--also-task-ids 105387,119044`, `--no-prepare-facts`.
- [ ] 6.2 Output under project-graph root, not task artifacts.

## 7. TL-6 Golden samples

- [ ] 7.1 Assertions for 176827, 119044, 105387 per execution plan TL-6.
- [ ] 7.2 Control edges must not scale with output column count.

## 8. TL-7 partitionPredicates

- [ ] 8.1 Literal FILTER predicates per READ occurrence (not task-merged).
- [ ] 8.2 Golden checks for 105387 and 119044 SRC_TBL placement.

## 9. TL-8 Cost record

- [ ] 9.1 Document p50/p95 and wall clock for DM_RSK_N + goldens in change notes.
