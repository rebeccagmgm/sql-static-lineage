# Schedule Evidence SQLite 运维手册

本手册是 `schedule-evidence` 的 SQLite 备份、同步和后续主读迁移入口。
日常操作只使用这里的 npm 命令，不需要重新编写临时脚本。

## 1. 存储边界

| 对象                                                                  | 当前写入位置                                           | SQLite 角色                |
| --------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------- |
| Horae `up/down` 调度关系                                              | `fill-horae-relation-sqlite`                           | **直接主写** `evidence` 表 |
| 任务类型、SZData detail、Hive SQL、run-script SQL、Hive target DDL 等 | `schedule-evidence/tasks/<taskId>/` 下的 JSON/SQL 文件 | 通过导入器同步到 SQLite    |
| Input Pack 当前读取端                                                 | 文件缓存                                               | 尚未切换至 SQLite 主读     |

路径约定：

```text
E:\02_area\股衍数据-数据cookbook\sql-static-lineage-cache\schedule-evidence\
├─ tasks\<taskId>\...                         # 文件证据
└─ tasks-sqlite\
   ├─ schedule-evidence.sqlite                 # 工作库
   └─ backups\schedule-evidence-*.sqlite      # 一致性备份
```

SQLite 的 `evidence` 主键是：
`(task_id, evidence_type, direction, depth)`。

## 2. 日常同步：先备份，再导入非 relation 证据

在仓库根目录执行。每次使用新时间戳，备份文件不允许覆盖。

```powershell
$backup = "E:\02_area\股衍数据-数据cookbook\sql-static-lineage-cache\schedule-evidence\tasks-sqlite\backups\schedule-evidence-$(Get-Date -Format 'yyyyMMdd-HHmmss').sqlite"

npm run input-pack:import-evidence-sqlite -- `
  --cache-root "E:\02_area\股衍数据-数据cookbook\sql-static-lineage-cache" `
  --backup-path $backup
```

该命令按顺序执行：

1. 用 SQLite 原生一致性备份 API 生成 `$backup`；可在其他任务写入 WAL 时取得完整快照。
2. 遍历 `schedule-evidence/tasks/<taskId>/` 的 `.json` 和 `.sql` 文件。
3. 将**非 relation**证据 upsert 到 SQLite；内容 hash 相同则不改写。

输出字段含义：

| 字段                   | 含义                                                  |
| ---------------------- | ----------------------------------------------------- |
| `inserted`             | SQLite 中原先不存在的证据                             |
| `updated`              | 同一主键但文件内容 hash 已变化                        |
| `unchanged`            | hash 相同，安全跳过                                   |
| `invalid`              | 无法读取或解析的文件；非 0 时需调查                   |
| `skippedRelationFiles` | 故意跳过的 `horae-relation-up/down-depth-*.json` 文件 |

同步不会删除 `tasks/<taskId>/` 下的原文件。

## 3. 为什么默认跳过 `up/down` relation JSON

`fill-horae-relation-sqlite` 直接把最新 Horae relation 写入 SQLite。
部分历史 relation JSON 未再持续更新；若日常导入它们，会把 SQLite 中较新的
`up/down` 记录反向覆盖成旧文件内容。

因此默认行为是：

```text
非 relation 文件 -> SQLite 同步
up/down relation  -> SQLite 直写，不从文件回灌
```

只有在**新建空库**或明确要用历史文件快照恢复 relation 时，才允许：

```powershell
npm run input-pack:import-evidence-sqlite -- `
  --cache-root "E:\02_area\股衍数据-数据cookbook\sql-static-lineage-cache" `
  --backup-path $backup `
  --include-relations
```

这会改变现有 relation 记录，应先停掉 relation 写入任务并确认恢复目标。

## 4. 备份大小为什么可能小于工作库

备份是创建时刻的一致性快照，不携带工作库的 `-wal` 增量日志；工作库在备份后还会继续写入。比较大小时应同时考虑：

```text
工作库实际占用 = schedule-evidence.sqlite + schedule-evidence.sqlite-wal
备份大小       = 备份时刻的主库快照
```

因此“备份文件较小”本身不表示数据缺失。应比较备份时刻的 `evidence` 行数和当前写入时间，而不是只比较文件字节数。

## 5. 恢复与主读迁移边界

- 恢复 SQLite 前，先停止所有 relation/detail/SQL 回填写入进程；恢复会替换工作库，属于显式维护操作。
- 当前 Input Pack、lineage 和 project-graph 的读取端仍使用文件缓存。SQLite 已作为 relation 主存储及非 relation 汇总库，但**尚不是全量读取端主库**。
- 切换到 SQLite 主读时，必须统一迁移所有 `readHoraeRelationCache`、`readHoraeTaskTypeCache`、`readSzdataScheduleDetailCache` 及 SQL cache 消费者，并保留文件 fallback 与内容 hash 对账；不能只改某一条读取链。

## 6. 实现与验证

- 实现：[import-schedule-evidence-sqlite.ts](../scripts/input/mainline/import-schedule-evidence-sqlite.ts)
- 回归测试：`npm run test:import-evidence-sqlite -- --no-file-parallelism`
- 导入器可选参数：`--cache-root`、`--database-path`、`--backup-path`、`--include-relations`
