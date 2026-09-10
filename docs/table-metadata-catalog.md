# 表／字段元数据 SQLite 目录

该目录是 Table Input Pack 的可重建只读投影，不是新的人工事实源。它使用独立 SQLite 文件，不修改 `schedule-evidence.sqlite`，也不参与 data-graph 的节点、边或发布版本。

## 构建与更新

```powershell
npm run table-metadata:build
npm run table-metadata:update -- --platform hive --stable-table-id dm.demo__gfhive
npm run table-metadata:query -- --platform hive --data-source gfhive --qualified-name dm.demo
npm run table-metadata:fields -- --platform hive --data-source gfhive --qualified-name dm.demo --limit 100
```

默认输入为工作区配置的 `inputPackRoot/tables`，默认输出为 `evidenceRoot/schedule-evidence/tasks-sqlite/table-metadata-catalog`。可用 `--tables-root` 和 `--catalog-root` 指向隔离目录。`input-pack:from-cache` 在成功写入有变化的 Table Input Pack 后自动执行限定范围更新；`--skip-metadata-catalog-refresh` 仅用于明确不刷新目录的诊断运行。

首次更新没有可复制的当前目录时会执行一次完整构建。后续限定范围更新只删除并重导指定物理表；范围外记录不会删除。没有范围的 `build` 从 Input Pack 完整重建，因此可处理新增、修改和删除。来源文件、声明的 DDL hash 或 Input Pack content hash 不一致时，该来源只记录为导入问题，不会作为成功元数据进入目录。

## 读取和切换

目录保存表、字段和导入问题，以及 schema、解析器和内容版本。身份匹配必须同时具备 `platform + dataSource + qualifiedName`；`stableTableId` 只能作为额外校验，不能代替完整物理身份。多个匹配会返回明确歧义，不按表名猜测。

构建先写新的不可变 SQLite 文件，再原子替换 `current.json`。事务失败或切换前中断时，读者继续使用旧版本；Windows 上已经打开旧 SQLite 的请求不会阻止新版本投入使用。读者只读取 SQLite 和指针文件，不扫描 Input Pack，也不解析 DDL。目录缺失、不可读或 schema 不兼容时，图查询仍返回节点和边，并在元数据状态中报告原因。

元数据目录版本来自 Input Pack 内容和解析器版本；它与 data-graph 发布版本分别返回，不能解释为同一个快照。
