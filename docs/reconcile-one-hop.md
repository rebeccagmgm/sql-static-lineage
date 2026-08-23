# 表级单跳对账器

`reconcile-one-hop(taskId)` 只回答当前任务的直接上一跳：

```text
上游 Task --WRITE--> Table --READ--> 当前 Task
```

## 入口

```text
npm run reconcile-one-hop -- --task-id <taskId> --data-root <input-pack-root> [--output <result.json>]
```

`--data-root` 指向 Task/Table Input Pack V1。未传 `--output` 时，结果只写到标准输出。

## 证据顺序

1. 当前任务直接读表：读取并校验 Task Input Pack 中各 SQL 文件的 SHA-256，再使用现有 `SqlSession + buildPlanFacts` 提取物理读表。
2. 调度骨架：只查询 `horae relation <taskId> --direction up --depth 1`。
3. 父任务写表：优先使用方向明确的 `DIRECT_PLATFORM_TARGET` / `SQL_EXACT_TABLE_TARGET` 和显式 SQL WRITE；父任务 Input Pack 缺失时才查询 `szdata task-source`。
4. 表身份：使用 Table Input Pack 将 `qualifiedName` 解析为唯一的 `platform + dataSource + qualifiedName`。缺失或多义身份不能形成 `MATCHED`。
5. 分区：只属于父 Task 到 Table 的 WRITE observation。Input Pack 中的具体值是采集快照值，不提升为稳定配置；`${...}`、`{{...}}` 等占位表达式保留为 `RUNTIME_EXPRESSION`。

## 状态

- `MATCHED`：Horae 直接父任务有已确认 WRITE，且物理表身份与当前 SQL READ 相同。
- `SQL_ONLY`：当前 SQL 直接读取，但没有任何已确认的 Horae 父任务 WRITE 覆盖。
- `SCHEDULE_ONLY`：Horae 父任务有已确认 WRITE，但当前 SQL 未直接读取该表。
- `UNRESOLVED`：有调度父任务或候选目标，但 WRITE 方向或物理身份证据不足。

`nextScheduleTaskIds` 保留直接调度父任务；`nextDataTaskIds` 只包含形成 `MATCHED` 的父任务。候选任务、任务名、普通 `FROM/JOIN` 和分区值都不能单独把任务提升为 producer。

## 边界

该入口不做字段级血缘、多跳递归、运行实例核验、数据到达核验或业务正确性验收。平台/Portal 查询失败会保留为 `UNRESOLVED`，不会回退到历史实验结果冒充当前证据。
