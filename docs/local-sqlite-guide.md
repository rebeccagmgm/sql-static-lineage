# 本地 SQLite 查询导航

用户说 SQLite / sqlite / sqllite 时，先用本页定位，不要重新全盘找库。
路径和表结构核对日期：2026-09-11。这里的数据库是离线快照或派生索引，不等于平台实时数据。

## 先按问题选库

| 用户想查什么 | 首选库 | 查询入口 |
| --- | --- | --- |
| 某个代码是什么意思，例如偏好代码 207 | 资产目录库 | `code_values`；先确定代码域和偏好类型 |
| 某字段用哪个代码域、代码域中文名称 | 资产目录库 | `ref_dw_cd_list` |
| 指标定义、标签、标签 SQL、组合类型 | 资产目录库 | `indicators`、`tag_*`、`grp_type_info` |
| 某表怎么加工、CASE/Join/源字段、任务 SQL | 调度证据库 | `evidence` 中 `format='sql'` 的记录 |
| 任务名称、主题、调度证据 | 调度证据库 | `horae_task_catalog`、`horae_topic_catalog`、`evidence` |
| 表是否在数综目录、分类、目录归属 | 表目录采集库 | `assets` / `union_tables`、`table_sources` |
| 表注释、字段注释、字段列表 | 表元数据目录库 | `tables`、`fields`；保留完整物理来源身份 |
| 数据源、schema、来源间匹配 | 数据源目录库 | 已有 `datasource-catalog:query` CLI |
| SQL 函数、变量、宏的已有知识 | 函数知识库 | 已有 `function-catalog.ts` CLI |

## 数据库位置与内容

以下相对路径均以本仓库根目录为基准：
`E:/02_area/股衍数据-数据cookbook/sql-static-lineage`。
在其他 worktree 中不要照搬 `../`；优先使用这里的主工作区绝对路径。

### 1. 资产目录库：码值、指标、标签、组合类型

路径：`../sql-static-lineage-cache/schedule-evidence/tasks-sqlite/asset-catalog/asset-catalog.sqlite`

- `code_values`：来源 `ref_dw_cd_val_restored_60094.csv` 的码值记录，对应 `REF_DW_CD_VAL`。
  重点字段：`code_id`、`chinese_name`、`code_value`、`value_description`、`remark`、`source_table`、`business_date`。
- `ref_dw_cd_list`：代码域定义，对应 `pdata_n.ref_dw_cd_list`，用 `dw_cd_id` 关联 `code_values.code_id`。
- `indicators`：指标定义；`tag_dimensions` / `tag_dimension_details` / `tag_values` / `tag_links`：标签资料。
- `tag_sql`：标签 SQL；只有 `status='VERIFIED'` 才按已验证 SQL 使用。
- `grp_type_info`：组合类型定义，包括 `grp_def_sql`。
- `task_links`：原资料声明的任务关联，不自动等于数据血缘。
- `records`、`source_files`：原文、来源文件和行号；`snapshots`、`import_runs`：快照与导入状态。

**不要混淆：`REF_CD_CVT_MAP` 是源代码→仓库代码转换表；`REF_DW_CD_VAL` 是代码→含义字典。**
当前资产库已确认导入的是后者，未发现独立的 `REF_CD_CVT_MAP` 数据表；加工 SQL 中引用了转换表，不代表转换表的数据也已入库。

详细说明：[资产目录 SQLite](asset-catalog-sqlite.md)。导入配置：`scripts/asset-catalog/local-snapshot.json`。
普通查询不要执行导入或重建。码值快照状态当前为 `UNVERIFIED`：可报告实际命中记录，不能宣称已核验全量或最新。

### 2. 调度证据库：任务及加工 SQL

路径：`../sql-static-lineage-cache/schedule-evidence/tasks-sqlite/schedule-evidence.sqlite`

表：`task_inventory`、`evidence`、`horae_catalog_runs`、`horae_task_catalog`、`horae_topic_catalog`。
`evidence` 按 `task_id + evidence_type + direction + depth` 区分证据；SQL 放在 `payload_text`，JSON 放在 `payload_json`。
SQL 记录可能有完整头部来源信息；`observed_at` 列可能为空，需要再看 SQL 头部日期。
这是任务证据库，不是业务表行数据仓库。

### 3. 数综表目录采集库

当前路径：`outputs/table-catalog-union-20260911/catalog.sqlite`

- `assets` / `union_tables`（视图）：按 GUID 去重的表目录；字段有 `name`、`database_name`、`qualified_name`、`raw_json`。
- `memberships`、`table_sources`（视图）、`observed_classifications`：目录与分类来源。
- `run`、`groups`、`pages`、`events`：采集状态、分页响应和诊断；不是业务表内容。

先看同目录 `status.json` 或 `run`，不能把采集中或 PARTIAL 当全量。
详细说明：[表目录采集](../scripts/table-catalog-harvest/README.md)。

### 4. 表与字段元数据目录

目录：`../sql-static-lineage-cache/schedule-evidence/tasks-sqlite/table-metadata-catalog/`

文件名含版本哈希，会变化；只枚举此目录的 `*.sqlite`，不要全域递归。
表：`catalog_meta`、`tables`、`fields`、`import_issues`。
先用 `PRAGMA table_info` 确认字段，再按平台、数据源、完整表名查询。
同名表不同物理来源的注释不能混用；这个库不提供业务表行数据。

### 5. 数据源目录

路径：`artifacts/datasource-catalog/datasource-catalog.sqlite`

表包括 `datasource_record`、`datasource_match`、`datasource_schema`、`datasource_alias`、`schema_annotation`。
优先已有 CLI，不重造查询工具：

```powershell
npm run --silent datasource-catalog:query -- status
npm run --silent datasource-catalog:query -- schemas --q trade --limit 20
npm run --silent datasource-catalog:query -- schema-match --name public --limit 20
```

详细说明：[数据源目录](datasource-catalog.md)。查询结果对外解释时过滤连接地址、凭证和内部数据源标识。

### 6. 函数知识库

路径：`../sql-static-lineage-data/knowledge/function-catalog.sqlite`
表：`sources`、`knowledge_entries`。从仓库根目录执行：

```powershell
node --import tsx scripts/knowledge/function-catalog.ts find --db ../sql-static-lineage-data/knowledge/function-catalog.sqlite --name lpad --limit 10
```

### 其他已知库

- `../sql-static-lineage-data.writer-catalog/writer-catalog.sqlite`：生产者候选索引；本次只读打开报 `unable to open database file`，未核验当前内容。
- `../数综基础信息/原信息/关系ddl-实际/_gf_rdbms_table_ddl_restore.sqlite`：DDL 恢复文件；本次同样未能只读打开，不能据此判定为空。
- `backups/`、`asset-catalog-before-*`：历史备份，不作为当前查询的默认入口。
- `scripts/inventory-map/README.md` 另有快照索引说明；只有需要该页面投影时再定位其版本库。

## 可以直接运行的只读查询

需要支持 `node:sqlite` 的 Node.js（本机已验证 Node 24）。PowerShell 使用单引号 here-string，避免 SQL 或模板变量被 shell 展开。

### 例一：查偏好代码 207 的含义

```powershell
@'
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('../sql-static-lineage-cache/schedule-evidence/tasks-sqlite/asset-catalog/asset-catalog.sqlite', { readOnly: true });
try {
  const rows = db.prepare(`
    SELECT code_id, code_value, value_description, remark, source_table, business_date
    FROM code_values
    WHERE code_id = ? AND code_value = ?
    LIMIT 20
  `).all('CD177', '207');
  console.log(JSON.stringify(rows, null, 2));
} finally { db.close(); }
'@ | node --no-warnings
```

本次实际命中：`CD177 / 207`，备注 `Pty_Prefr_Type_Cd=02时，投资期限偏好`，
含义 **五年以内（可购买或接受五年期以内的产品或服务）**，来源表 `MANU_MATN`，业务日期 `2021-08-27`。
回答时必须带上类型 `02`；不要把任意代码域中的 `207` 都解释成这个含义。

### 例二：先定位涉及目标表的 SQL，再读单个任务

复用上面的 Node 只读打开方式，将库路径换为调度证据库，执行：

```javascript
const matches = db.prepare(`
  SELECT task_id, evidence_type, observed_at, length(payload_text) AS sql_length
  FROM evidence
  WHERE format = 'sql' AND instr(lower(payload_text), lower(?)) > 0
  LIMIT 20
`).all('t01_pty_prefr');
console.log(JSON.stringify(matches, null, 2));
// 根据命中的 ID 精读；不要一次打印全部匹配任务的完整 SQL。
const sql = db.prepare(`
  SELECT payload_text FROM evidence
  WHERE task_id = ? AND evidence_type = ? AND direction = '' AND depth = 0
`).get('46774', 'hive-task');
```

优先已知 task_id 查询。全文子串搜索没有自动全文索引，必要时只做一次有界结果定位。
`instr` 按字面匹配下划线，不把 `_` 当 LIKE 通配符；用户 Markdown 中的 `\_` 应还原为 `_`。

### 其他常用 SQL

以下先在相应数据库执行，不要把不同库的表名混在一起：

```sql
-- 资产目录：先由中文名称找代码域
SELECT dw_cd_id, dw_cd_eng_name, dw_cd_chn_name
FROM ref_dw_cd_list WHERE dw_cd_chn_name LIKE '%偏好%' LIMIT 20;

-- 资产目录：保留一条命中记录的原始出处
SELECT f.path, r.source_row, r.raw_json
FROM records r JOIN source_files f ON f.id = r.source_id
WHERE r.id = 92025;

-- 资产目录：快照状态
SELECT kind, snapshot_label, status FROM snapshots;

-- 表目录：找物理表目录记录
SELECT guid, name, database_name, qualified_name
FROM assets WHERE instr(lower(name), 't01_pty_prefr') > 0 LIMIT 20;

-- 任一已选定库：先检查结构，不猜列名
SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view');
PRAGMA table_info(code_values);
```

## 查询与维护约定

1. 先选库、再查结构或已有 CLI；只有入口失效时才做目标目录内查找。
2. 只读打开（`readOnly: true`），默认 `LIMIT 20`；已知键用参数绑定。未找到记录不等于平台没有。
3. 码值分清代码域、类型、源系统、备注与日期；重复或歧义保留，不取第一条冒充唯一答案。
4. 需要的是码值含义时，优先 `code_values`；需要源代码转换明细时，再核验 `REF_CD_CVT_MAP` 的实际数据是否已导入。
5. 返回直接业务结论和必要出处；不要只交付 SQL 加工规则而遗漏已存在的字典含义。
6. 新增或迁移 SQLite 时同步更新本页；不要写死会漂移的行数、哈希文件名或“最新”结论。
