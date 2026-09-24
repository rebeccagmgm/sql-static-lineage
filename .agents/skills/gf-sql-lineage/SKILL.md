---
name: gf-sql-lineage
description: 基于 SQLLens 对调度 SQL 进行只读静态解析，生成并查询证据约束的表级、字段级血缘。用于识别 CTE、Join、聚合、UNION、窗口、临时表和多次写入中的字段来源，追溯跨任务上下游，分析加工条件和变更影响。调度关系不能作为数据血缘，候选和未知不得描述为已确认。
metadata:
  version: "1.0.0"
  contains_scripts: false
  production_data_access: read-only
---

# SQLLens 高精度 SQL 血缘

使用 SQLLens 解析 SQL 语法和关系作用域，再结合 Input Pack 中声明的任务、目标表、Schema 和分区证据生成 Machine Facts。血缘结果应能追溯到具体任务、写入、读取实例、物理字段和 SQL 证据。

该能力只做静态分析：不执行 SQL、不触发调度、不读取业务数据行。

## 能力链路

```text
Input Pack（任务 SQL、目标、Schema/View 快照）
  -> SQLLens（语法、作用域、表达式和关系解析）
  -> Machine Facts（写入、读取、字段绑定、条件、行集控制、未知）
  -> Task-local / 跨 Task 接续
  -> 表级血缘、字段级血缘、加工解释和影响查询
```

SQLLens 负责单段 SQL 内可以由语法和 Schema 证明的关系。跨 Task 生产者选择、物理身份、分区匹配和证据等级由本项目完成，不能让解析器或调度关系代替这些判断。

## 模式选择

- 用户要查询已有血缘：优先使用已发布图的只读 JSON CLI，不重新解析或生成产物。
- 用户要求解析一个任务、验证血缘或生成新事实：从该任务的 Input Pack 运行 SQLLens → Machine Facts，输出到明确的隔离目录。
- 用户要求修复、批量重建或发布：这属于工程变更，先核对输入快照、影响范围和发布目标；本 Skill 本身不授予覆盖当前产物的权限。

## 已发布血缘查询

在 `sql-static-lineage` 仓库根目录执行：

```powershell
& .\scripts\lineage-graph.ps1 <command> <args>
```

所有查询均应保持有界。

### 查询方法

1. 涉及“当前血缘”时，先运行 `status`，确认发布状态和版本。历史版本或固定产物必须明确标注版本。
2. 优先使用用户给出的 Task ID、限定表名或字段名作为锚点。锚点不明确时先 `search`，不要猜表、Task 或 Schema。
3. 查询表级路径用 `trace --layer table`；查询字段值来源或影响用 `trace --layer field`。
4. 解释一个目标字段时，先用 `fields` 或 `detail` 找到精确 `writeId`，再用 `explain` 读取完整加工链。存在多个写入时不得只凭表名或字段名选择。
5. 只有用户需要公式、条件、聚合、Join、UNION 分支或 SQL 行证据时才用 `processing`。条件字段和行集控制必须与字段值来源分开说明。
6. 默认从小范围开始，读取返回的 `pagination.nextOffset` 后再决定是否翻页；不要一次性导出整图。

### 常用命令

```powershell
# 当前发布状态
& .\scripts\lineage-graph.ps1 status

# 搜索任务或表
& .\scripts\lineage-graph.ps1 search --text <名称> --limit 25

# 查看任务或表有哪些字段
& .\scripts\lineage-graph.ps1 fields --task-id <taskId> --limit 100
& .\scripts\lineage-graph.ps1 fields --table <schema.table> --limit 100

# 表级上游或下游
& .\scripts\lineage-graph.ps1 trace --table <schema.table> --layer table --direction up --depth 3 --limit 150
& .\scripts\lineage-graph.ps1 trace --table <schema.table> --layer table --direction down --depth 3 --limit 150

# 字段级来源或影响
& .\scripts\lineage-graph.ps1 trace --task-id <taskId> --column <column> --layer field --direction up --depth 6 --limit 150
& .\scripts\lineage-graph.ps1 trace --task-id <taskId> --column <column> --layer field --direction down --depth 6 --limit 150

# 精确字段解释
& .\scripts\lineage-graph.ps1 detail --task-id <taskId> --column <column> --limit 50
& .\scripts\lineage-graph.ps1 explain --task-id <taskId> --write-id <writeId> --column <column>

# 加工关系和原 SQL 片段
& .\scripts\lineage-graph.ps1 processing --task-id <taskId> --text <字段或表达式> --limit 25
& .\scripts\lineage-graph.ps1 processing --task-id <taskId> --sql --slot query --line-start <line> --line-count 80

# 比较多个任务中的同一字段
& .\scripts\lineage-graph.ps1 compare --task-ids <id1,id2> --column <column>
```

需要只看已确认边时给 `trace` 增加 `--confirmed-only`。这会隐藏候选证据，但不能把剩余结果解释为全链完整。

## SQLLens 分析与事实生成

只有用户明确要求解析、生成或验证新血缘时才运行。先确认目标 Task 的 Input Pack 已包含需要的 SQL、目标和 Schema/View 快照，然后将结果写入隔离输出目录：

```powershell
npm run input-pack:machine-facts -- `
  --data-root <input-pack-root> `
  --task-id <taskId> `
  --output <isolated-facts-root>
```

需要表级直接上下游时，基于同一冻结 Input Pack 运行：

```powershell
npm run addon:task-lineage:one-hop -- `
  --task-id <taskId> `
  --data-root <input-pack-root> `
  --producer-index <producer-index.json> `
  --output <one-hop.json>
```

需要跨 Task 字段链时，必须使用与 Input Pack 指纹匹配的 Facts 和表级 multi-hop 产物：

```powershell
npm run addon:task-lineage:field-lineage -- `
  --data-root <input-pack-root> `
  --facts-root <isolated-facts-root> `
  --multi-hop-artifact <multi-hop.json> `
  --task-id <taskId> `
  --target-table <schema.table> `
  --write-observation-id <writeId> `
  --fields <field1,field2> `
  --output <field-lineage.json>
```

存在多个写入时必须指定 `writeObservationId`。Input Pack、Facts 或 producer index 指纹不一致时停止，不混用旧产物补齐结果。

## 证据语义

- `VALUE` / `CONTINUES`：可用于描述字段值来源或确认的字段延续。
- `CONDITION`：影响筛选、分支或计算条件，不是字段值来源。
- `CANDIDATE`：存在关联线索但尚未闭合，只能称为候选。
- `UNKNOWN`、`UNRESOLVED`、`MATERIAL_GAP`：保留为证据缺口，不补猜、不跨越后继续断言。
- `schedule` 层：用于任务导航和调度参考，不能作为数据因果证明。

同名任务、同名表和同名字段不能证明是同一物理对象。字段结论至少要绑定 Task、目标写入和物理字段；同一张表的多次读取要保留独立 Read Occurrence；跨 Task 延续还需已确认的生产者、物理身份和分区证据。

## 回答要求

先直接回答来源、去向或差异，再给最短可证明主链。加工条件和 Join/Filter/聚合影响单独说明。最后列出发布版本、候选边、截断和证据缺口。

不要把 SQLLens 的成功解析等同于完整血缘，也不要把静态血缘描述为运行成功、数据正确、业务口径正确或生产环境实际流转的证明。需要运行状态时使用调度平台能力；需要核验数据值时使用受控数据库查询能力。
