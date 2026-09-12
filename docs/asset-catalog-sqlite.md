# 指标、标签、码值、数据元和组合类型 SQLite

从现有离线快照导入，不连接平台。原始资料保留，既有调度证据库不改动。

## 执行

需要支持 `node:sqlite` 的 Node.js（已在 Node 24 验证），无新增依赖。

```powershell
node scripts/asset-catalog/import.mjs scripts/asset-catalog/local-snapshot.json
```

配置指定指标目录、标签目录、码值 CSV、代码定义 CSV (`dataElementCsv`)、组合类型 CSV (`grpTypeCsv`) 和输出目录。当前输出为同级缓存项目中的
`schedule-evidence/tasks-sqlite/asset-catalog/asset-catalog.sqlite`。
数据库旁的 `import-manifest-<hash>.json` 保存导入数量、状态和异常；相同内容也保存在
`import_runs.report_json`。相同输入重跑返回 `UNCHANGED` 并恢复清单。
输入发生变化时拒绝覆盖，需指定新的输出目录以保留旧快照。

## 表与粒度

| 表 | 一行含义 |
| --- | --- |
| `snapshots` | 一类资料的来源状态和原始 manifest；码值无完整性清单，标记 UNVERIFIED |
| `source_files` | 来源文件路径、SHA-256、字节数；SQL 原始字节另存 BLOB |
| `records` | 一条原始 JSON/CSV 记录及来源行号；也存目录树和各类 manifest |
| `indicators` | 一条指标记录及定义、输出库表、目录 |
| `tag_dimensions` | 一条标签维度目录记录 |
| `tag_dimension_details` | 一条标签维度详情，不覆盖目录记录 |
| `tag_values` | 一条标签值记录 |
| `tag_links` | 一条来源中的标签值与维度关联；保留来源状态和本地存在性检查 |
| `task_links` | 来源记录中明确声明的一项任务关联，不等于已验证血缘 |
| `tag_sql` | 每条详情的 SQL 校验结果；只有 VERIFIED 才提供 sql_text |
| `code_values` | 一条码值 CSV 记录，保留来源表、来源、业务日期等全部字段 |
| `ref_dw_cd_list` | 一条仓库代码定义 CSV 记录；对应物理表 `pdata_n.ref_dw_cd_list` |
| `grp_type_info` | 一条组合类型定义 CSV 记录；对应物理表 `dm_index_n.grp_type_info` |

实体投影使用 `record_id` 关联原文；业务 ID 建查询索引，不作为去重键。
码值保留前导零、空字符串和重复行，不假定来源组合构成唯一键。
`ref_dw_cd_list` 与 `code_values` 独立导入、独立保留来源；查询时可按
`ref_dw_cd_list.dw_cd_id = code_values.code_id` 获取一个定义下的多个取值，
不在导入存储层建立外键或强制一一对应。
`grp_type_info` 也独立导入；其中 `grp_def_sql` 作为来源 SQL 文本保存，导入时不执行、
不改写，也不自动转换为血缘或 Machine Facts。
CSV 的 `source_row` 是含表头的逻辑记录序号，多行引号内容可能占多个物理行。
标签详情多于目录条目是允许的。`dimension_present=1` 只表示本地存在目录或详情，
不会覆盖原来源 `NOT_FOUND` 等状态，也不证明业务关系正确。

SQL 严格比较文件字节哈希，不自动修改换行或格式。异常文件的原始字节仍可从
`source_files.raw_sql_bytes` 获取，但不能称为已验证 SQL。未将指标关联任务的外部
SQL 冒充指标口径。目录树、索引和详情等快照主体入库，采集 raw-pages 不重复展开。

## 查询示例

```sql
SELECT indicator_id, name, definition
FROM indicators WHERE name LIKE '%客户%' LIMIT 20;

SELECT asset_kind, asset_id, relation_kind, task_id
FROM task_links WHERE task_id = '245353' LIMIT 20;

SELECT code_id, code_value, value_description, source_table, business_date
FROM code_values WHERE code_id = :code_id LIMIT 50;

SELECT dw_cd_id, dw_cd_eng_name, dw_cd_chn_name, encd_mode, src_dict_tbl
FROM ref_dw_cd_list WHERE dw_cd_id = :dw_cd_id;

SELECT grp_type_id, grp_type_code, grp_type_name, sys_code,
       grp_attr_table_name, grp_attr_table_pk, tag_dim_id, grp_def_sql
FROM grp_type_info WHERE grp_type_code = :grp_type_code;

SELECT f.path, r.source_row, r.raw_json
FROM records r JOIN source_files f ON f.id = r.source_id
WHERE r.id = :record_id;
```

## 验证

```powershell
npm run prepare:deps
node --test scripts/asset-catalog/import.test.mjs
```

导入事务中检查外键、SQLite 完整性和来源文件哈希；通过后才发布独立数据库。
发布使用排他创建，不覆盖其他进程已发布的文件。数据库保留本次快照，不代表平台实时状态。
