# 数据源统一查询目录

`datasource-catalog` 把 Horae 与 SZData 数据源快照投影到一个可重建的
SQLite 查询库。原始 `snapshot.json`、`manifest.json` 和 `rows.jsonl` 保持只读，
SQLite 不是新的事实来源。

## 构建

从仓库根目录执行：

```powershell
npm run datasource-catalog:build
```

默认读取仓库同级基础信息目录中的：

```text
数综基础信息/原信息/horae-datasource
数综基础信息/原信息/szdata-datasource
```

默认产物为：

```text
artifacts/datasource-catalog/datasource-catalog.sqlite
```

路径可通过 `--horae-dir`、`--szdata-dir`、`--database` 覆盖。构建会校验
JSONL 行数、SZData rows hash、源记录键以及嵌套 JSON；校验失败时不会替换
已有数据库。

构建还会读取 `config/schema-annotations.json`。注释以
`platform + dataSource + schemaName` 为内部唯一身份，人工只维护
`displayName` 和 `description`。需要使用隔离配置时可传
`--annotations <path>`。

## 查询

所有命令只输出有界 JSON：

```powershell
npm run --silent datasource-catalog:query -- status
npm run --silent datasource-catalog:query -- datasources --q oracle --limit 20
npm run --silent datasource-catalog:query -- datasources --schema public --limit 20
npm run --silent datasource-catalog:query -- schemas --q trade --limit 20
npm run --silent datasource-catalog:query -- schema-match --name public --limit 20
```

分页参数是 `--limit 1..100` 与 `--offset 0..10000000`。数据源查询还支持
`--identifier`、`--db-type`、`--schema` 和
`--match-status CONFIRMED|CANDIDATE|UNRESOLVED`。

## 匹配边界

匹配按顺序执行，且每条源记录最多进入一个一对一关系：

1. `EXACT_IDENTIFIER`：Horae `server_tag` 与 SZData `sourceIdentifier` 相同，
   状态为 `CONFIRMED`。
2. `HOST_PORT_TYPE_SERVICE`：剩余记录的地址、端口、规范化数据库类型和服务名
   形成双方唯一组合，状态为 `CANDIDATE`。
3. `SYSTEM_SERVICE_TYPE`：剩余记录的系统名、服务名和规范化数据库类型形成双方
   唯一组合，状态为 `CANDIDATE`。

`datasource_match` 保留各字段是否一致和冲突数。即使标识确认相同，也不会用一边
的字段覆盖另一边。

`datasource_schema` 只保存 SZData 门户注册的 schema。schema 与 Horae 的关联必须
先经过 `datasource_match`，不会把 Horae `service` 名直接解释为 schema。

SZData 当前快照若不完整，`import_snapshot.complete`、`coverage_gap` 和
`failure_count` 会原样进入目录并由 `status` 返回；导入不会把部分快照包装成完整
事实。

## 表

| 表                        | 作用                                     |
| ------------------------- | ---------------------------------------- |
| `import_snapshot`         | 来源、时间、hash、行数与完整性           |
| `datasource_record`       | 两个平台各自的数据源记录与规范化检索字段 |
| `datasource_match`        | 一对一匹配方法、状态、一致性与冲突数     |
| `datasource_schema`       | SZData 注册的 schema 明细                |
| `datasource_access_point` | SZData 注册的访问点明细                  |
| `schema_annotation`       | schema 展示名称和简短说明                |

## 图谱展示

图谱服务默认读取同一个 `datasource-catalog.sqlite`。命中完整物理身份时，API
只向页面补充 `schema.displayName` 和 `schema.description`；数据源标识、匹配方法、
负责人等目录字段不进入表卡。schema 注释是运行时展示信息，不产生图谱节点或边，
也不改变已发布图谱版本。

更新说明后重新运行 `npm run datasource-catalog:build`，再刷新图谱页面即可。图谱
服务也支持通过 `--datasource-catalog-path` 指向隔离数据库。

## 文件补充的中文别名

导入 Horae 数据源列表复制文本（保留列分隔符和页面总条数）：

```powershell
npm run --silent datasource-catalog:query -- import-aliases --source <文件路径>
npm run --silent datasource-catalog:query -- datasources --q <中文别名> --limit 20
npm run --silent datasource-catalog:query -- aliases --q <中文别名> --limit 20
```

补充记录存入 `datasource_alias`，以 `source_system + identifier` 精确关联。
`datasources` 增加 `alias` 字段与中文别名搜索；不会把 Horae 别名直接套到同名
SZData 记录。`aliases` 可分页读取全部文件记录，包含尚未出现在平台快照中的标识，
通过 `catalogStatus=IN_CATALOG/NOT_IN_CATALOG` 区分，来源为 `FILE_SUPPLEMENT`。

表内保存原始行、来源文件路径、文件 hash、行号和导入时间；空别名保持为空。
先校验页脚总条数、重复标识与行结构，再事务写入。重复导入相同文件不改写记录。
目录重建会保留此独立补充表，不修改平台快照、匹配结果或源记录数。
此补充暂不改变图谱卡片展示，也不代表数据源连通性已验证。

