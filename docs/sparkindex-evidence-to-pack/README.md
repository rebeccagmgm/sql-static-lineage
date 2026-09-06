# sparkIndex：evidence → Input Pack

sparkIndex 从调度证据落到 Task/Table Input Pack，仓库里有 **两条组装路径**。
选批、补证脚本 **不写 pack**。落盘契约与其它类型相同，见
[input-pack.md](../input-pack.md)；缓存字段对照见
[input-pack-from-cache.md](../input-pack-from-cache.md) §3.1。

## 1. 两条组装路径

```text
schedule-evidence/tasks/<taskId>/
  horae-task-type.json
  szdata-schedule-detail.json
        │
        ├──────────────────────────────┐
        ▼                              ▼
  from-cache（离线）              input-pack:sparkindex（现网）
  只读 HIT，MISS 不刷新           HIT 用缓存；MISS 打 OpenCLI
  表 DDL ← jsonl / 已有 tables/   表 GUID+DDL ← sql-mcp
        │                              │
        └──────────┬───────────────────┘
                   ▼
         tasks/sparkIndex/<id>/ + tables/
```

| | 离线主路径 | 现网专用路径 |
| --- | --- | --- |
| **命令** | `npm run input-pack:from-cache` | `npm run input-pack:sparkindex` |
| **入口** | `scripts/input/mainline/collect-input-pack-from-cache.ts` | `scripts/input/mainline/collect-one-task-input-pack-sparkindex.ts` |
| **组证** | `assembleCacheTaskEvidence` → `assembleSparkIndex`（`scripts/input/shared/cache-task-evidence.ts`） | 同文件内读缓存 / 刷新后 `buildSparkIndexTaskEvidence` + merge |
| **落盘** | 通用 `materializeTaskAndTablePacks`（`sparkIndexMode`） | `materializeSparkIndexTaskAndTables`（`scripts/input/shared/sparkindex-table-evidence.ts`） |
| **MISS** | 不打接口 | 刷新 Horae detail、szdata schedule-detail；表走 MCP |
| **表 DDL** | 原信息 jsonl / 已有 `tables/` | sql-mcp GUID + DDL |

通用 `npm run input-pack:tasks`（`collect-one-task-input-pack.ts`）**不是** sparkIndex 专用入口。

## 2. 组证规则（两条路径共用语义）

主源是 `szdata-schedule-detail`（`targetTable`、`insertMode`、各 SQL 槽）。
Horae 补缺槽（常见只有 `querySql`）。schedule-detail 有值优先。

sparkIndex **SQL 里通常没有 INSERT**。写身份来自 pack `target`（schedule-detail
`targetTable`），query 槽是写体，不是 hiveTask 那种从 INSERT 抽目标。

`create` 槽：缓存没有单独 `createSql` 时，离线可把 `prepareSql` 开头的
`CREATE TABLE` 抄进 `create`，完整 `prepareSql` 仍留在 `prepare`。

## 3. 不是组 pack 的脚本

| 命令 / 模块 | 做什么 |
| --- | --- |
| `npm run input-pack:fill-sparkindex-schedule-detail-cache` | 只补 `szdata-schedule-detail.json`（按 Horae 类型筛 sparkIndex） |
| `scripts/input/mainline/select-sparkindex-both-evidence.ts` | 按四件套文件是否存在筛 ID：horae-task-type、schedule-detail、relation up/down。**不写 pack**，也 **不是按写表名选批** |

其它 fill（Horae 类型、relation、Hive SQL）是通用缓存补洞，不专属于 sparkIndex 组包。

## 4. 怎么选路径

- 缓存已齐、批量落盘、禁止打平台：**`input-pack:from-cache`**。
- 缓存缺 schedule-detail / Horae、或要给表打 sql-mcp：**`input-pack:sparkindex`**。
- 不要用四件套齐不齐代替「`targetTable` 是否是目标库表」。relation 上下游不是写表证据。
