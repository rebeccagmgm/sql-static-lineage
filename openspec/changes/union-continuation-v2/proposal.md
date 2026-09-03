## Why

WP-7 在 `sql-static-lineage` 已产出 `TASK_LOCAL_PROJECTION` 1.2.0。data-graph 的旧接续核只能按任务/表聚合，无法区分同一任务的多个真实读次，也不能在多个写观察之间保留分区证据。WP-8 需要在 data-graph 增加一个独立的 `union-continuation-v2` 消费者。

## What Changes

- 消费 1.2.0 的 `localClosure.externalReads`、`localClosure.finalWrites` 以及确认过的 producer-index 写观察。
- 对每个 `READ_OCCURRENCE` 执行表 → 分区 → 写观察三档接续，保留 `writeObservationId`，不退化为 taskId 唯一选择。
- 落地 `partitionMatchStatus: CONFIRMED | ASSUMED | UNKNOWN | DISJOINT`；`ASSUMED` 只进入 L2，不能进入 L1。
- producer-index 每个 `writes[]` 保持独立，禁止把同表多写扁平化后交叉组合。
- producer-index 无法与同 scope 的多个 `finalWrites` 精确对齐时 fail-closed，保留独立写观察并输出 `WRITE_OBSERVATION_ALIGNMENT_AMBIGUOUS`。
- 提供最小 `UNION_CONTINUATION_EVIDENCE` L0-L3 envelope，带任务投影、producer-index、batch manifest 哈希和可回放的 v2 结果。
- 提供 `union-continuation-v2` batch CLI；它只编排既有 loader/merge/v2 trace/envelope，不改接续核语义。
- `scheduleReference` / `SCHEDULE_DEPENDS_ON` 不进入任何接续档位。

旧 1.1.0 仍由已有 union loader 为历史 v1 路径兼容读取；v2 接续入口明确拒绝旧投影作为证据。

## Impact

- 代码：`src/project-graph/topology/task-local-union/` 的 v2 接续、1.2.0 closure 保留和 producer-index 写观察读取。
- 测试：用 119044 当前 1.2.0 形状的两个真实读次覆盖 `SRC_TBL` 分区裁剪、L2 边界和无调度污染；补 105387 `#3/#6` 多写对齐断言、当前索引 20 个同表多写抽检、`ASSUMED` L1 禁入和 L0-L3 envelope。
- legacy `traceUnionUpstream`、旧投影和既有快照 ID 不改变。
