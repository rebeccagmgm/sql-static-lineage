## Why

WP-3 已产出每任务一份 `TASK_LOCAL_PROJECTION`（schema 1.1.0），但 data-graph 只能从 legacy one-hop/multi-hop 根快照建图，无法把 N 份局部投影并成可查询拓扑。需要第三种快照来源 `TASK_LOCAL_UNION`：跨任务靠同一物理表节点的 READS/WRITES 对接，不在构建期跑 multi-hop。

## What Changes

- 新增 `sourceMode: TASK_LOCAL_UNION` 快照契约与校验（与 `LEGACY_ARTIFACT_PAIRS` 互斥；本仓尚无 `DIRECT_PROJECT_EVIDENCE` 实现，类型上预留互斥位）。
- 新增 batch-manifest + envelope 加载、三方 contentHash 校验、并集合并、接续核（并集内 WRITES / producer-index 边界 / 一表多写剪枝）。
- 可选导出 `SCHEDULE_DEPENDS_ON` 展示边；`scheduleReference` 永不参与数据血缘推导。
- **不**改 legacy `maxRoots=32`、已发布 root 快照 ID、六个参考查询行为。
- **不**改 sql-static-lineage 投影器；§5.3 `targetTable` 走独立 **WP-3.2**（见 design）。

## Capabilities

### New Capabilities

- `task-local-union-source`: 从 WP-3 batch-manifest + envelope 构建 `TASK_LOCAL_UNION` 拓扑快照，并提供跨任务表级接续（含边界与分区剪枝）。

### Modified Capabilities

- （无既有 openspec/specs；本仓首次引入 openspec。legacy topology 行为以回归测试锁定，不写 delta。）

## Impact

- 代码：`src/project-graph/contracts/`、新建 `topology/task-local-union-*` loader/合并/接续；测试夹具与 TU-7 真 Facts 金样。
- 上游：依赖 sql-static-lineage WP-3 产物；§5.3 依赖未来 WP-3.2 的 `scheduleReference.targetTable`。
- 下游：topology 投影、字段证据、文件查询、Neo4j 索引可消费并集快照；legacy / direct 路径零回归。
