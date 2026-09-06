# Agent 图谱查询 CLI

Agent 的正式消费入口是 `scripts/lineage-graph.ps1`。它可以从任意工作目录调用，读取已发布的 Neo4j 图；查询命令不生成 Facts、投影或接续索引。HTML 是辅助调查页。

`metrics` 直接读取已发布版本的本地 INDEX，不需要 Neo4j。它不会用正在变化的材料重算历史发布结果。

## 首次调用

```powershell
$graphCli = 'E:\02_area\股衍数据-数据cookbook\sql-static-lineage\scripts\lineage-graph.ps1'
& $graphCli help
& $graphCli status
& $graphCli metrics
```

仓库内也可以使用 `npm run --silent graph:query -- <command> ...`。直接调用 PowerShell 入口更适合 Agent：stdout 只有一份 JSON。需要 Node、已安装的锁定依赖和已启动的本机 Neo4j；不需要 HTML 服务。

路径和 Neo4j 参数统一位于 `config/workspace-paths.json`，通过 `--config <absolute-path>` 或 `LINEAGE_CONFIG` 切换材料和图。密码不写入配置：配置只指向密码文件环境变量的名字。

## 常用查询

```powershell
# 1. 搜索定位
& $graphCli search --text t98_otc_deri_comp_sale_info --limit 10

# 2. 查这张表由哪些任务写入
& $graphCli trace --table pdata_n.t98_otc_deri_comp_sale_info --layer table --depth 1

# 3. 列出任务的输出字段，按需翻页
& $graphCli fields --task-id 86842 --limit 20 --offset 0

# 4. 字段向上追溯，保留写入和读取身份
& $graphCli trace --task-id 86842 --column init_nom_prin --depth 6 --limit 150

# 5. 只看已确认接续；向下查询改用 --direction down
& $graphCli trace --task-id 86842 --column init_nom_prin --confirmed-only

# 6. 四产品同一字段的公式对照
& $graphCli compare --task-ids 86840,86841,86842,220650 --column init_nom_prin

# 7. 单字段表达式、过滤和 Join
& $graphCli detail --task-id 86842 --column init_nom_prin

# 8. 搜索任务内部加工表达式；返回完整表达式和定位
& $graphCli processing --task-id 93338 --text dyna_nom_prin --limit 20

# 9. 按行读取固定版本 SQL
& $graphCli processing --task-id 86842 --sql --slot query --line-start 1 --line-count 80 --limit 1

# 10. 从表达式返回的 relationId 查看所属加工关系
& $graphCli processing --task-id 220650 --text init_nom_prin --limit 20
& $graphCli processing --task-id 220650 --relation-id 'task:220650:statement:8:relation:root.dy.aggregate' --limit 20
```

## JSON 合同

`metrics` 返回 `data.publicationVersion`、`compilerVersion`、`indexContentHash` 和 `metrics`。`snapshotKind: PUBLISHED_INDEX` 表示统计的是该历史发布快照；升级消费代码或终止规则后，需要重新 publish，发布指标才会改变。仅消费代码或规则变化可复用同一份 prepared 材料；材料或投影变化才需要重新 prepare。

新 publication 保存 INDEX 的内容哈希并在查询时核对，`indexBinding` 为 `PUBLICATION_CONTENT_HASH`。旧 publication 缺少此字段时，查询保持可读并标为 `LEGACY_PUBLICATION_DIRECTORY`，只按历史发布目录定位，不宣称已验证 publication 对 INDEX 的哈希归属。

读次口径：`withinUnionReadOccurrences = totalReadOccurrences - confirmedSourceBoundaryReadOccurrences - policyTerminalReadOccurrences`。`withinUnionConfirmationRate` 的分子是 `fullyL1ReadOccurrences`：排除政策终止读次后，至少有一个保留候选，且全部保留候选都满足 INDEX 的 confirmed identity、in-union、CONFIRMED、L1、eligible 和写次绑定要求。分母为零时返回 `null`。未命中终止规则的缺 writer、缺材料、全 DISJOINT 和未分类读次保留在分母；没有 catalog 记录不能证明是范围外源端点。任务覆盖数与读次分母分开，无可投影读次的调度任务不加入读次分母。

compiler 1.0.5 使用既有 `config/multi-hop-terminal-table-rules.json`，把身份已确认且命中 REFERENCE_CONFIG 的读次标为 `POLICY_TERMINAL`。这表示“定义/参数表按规则停止展开”，既不是源端点证明，也不是 UNKNOWN 或新增 L1。字段/表向上追溯在这里停止，返回 `terminalNodes`（节点 ID、role、reason、ruleRef）；读取依赖、过滤条件和 SQL 证据仍可查询。页面显示终止标记，点击可查看证据。命名规则是显式范围政策，不代表每张表均已完成独立业务分类。

终止政策作为与 INDEX 哈希绑定的 `terminal-policy.json` 随版本冻结，配置哈希参与发布版本；查询不使用后来变化的实时配置。原始 INDEX 的候选和状态保留。终止读次不进入接续缺口清单，但材料/身份缺口继续保留；旧发布缺少政策快照时不追溯套用新规则。

```powershell
& $graphCli metrics --terminal-role REFERENCE_CONFIG --limit 25 --offset 0
```

此分页返回 `classification: POLICY_TERMINAL`、表名、任务/读次身份和命中规则，不能与 `--gap-layer` 同时使用。政策终止数单独统计，不能计入 confirmed 数量。

`continuationEdgeMetrics` 单独统计字段接续边，不能与读次确认率混用。`anyL1ReadOccurrences` 仅表示至少一条候选满足 L1，不表示整个读次已确认，也不表示唯一 producer。

缺口按 boundary、actionable、material、unclassified 分组；每组分别给 gap 数和去重读次数。按组分页查看：

```powershell
& $graphCli metrics --gap-layer unclassified --limit 25 --offset 0
& $graphCli metrics --gap-layer actionable --limit 25 --offset 25
```

`pagination.nextOffset` 非 null 时继续翻页，每页最多 100 个读次。只有带独立证据的源端点才归 boundary；`PARTITION_NO_MATCH` 属于 actionable。无法确认的源端点保留 `NO_KNOWN_WRITE_OBSERVATION`。原始 INDEX 不会被查询器改写。

Neo4j 查询成功返回 `schemaVersion: "1.0.0"`、`ok: true`、`command`、`graph.id/version`、`data`、`meta`。`meta.projectionGenerations` 为 0。`metrics` 使用上述本地快照合同。错误返回 `ok: false` 和 `error.code`；退出码 0 为成功、1 为查询/发布问题、2 为参数错误。

`search`、`fields`、`detail`、`processing` 提供 `pagination.nextOffset`，非 null 时用同一查询条件继续翻页。`trace` 返回节点、边及显式 `depth`，并携带 `depthLimit`、`edgeLimit`、`stoppedBy`、`frontierNodeIds`。需要继续调查时，以返回的节点 ID 作为 `--node-id` 查询入口；达到边数上限时，可缩小到具体写入或增大 `--limit`。

默认字段追溯最多 4 层、150 条边，硬上限 12 层、1,000 条边。搜索最多 100 项；加工表达式每页最多 100 项；SQL 每次最多 300 行。未知选项、缺值和越界参数会报错，不会悄悄改成全图查询。

- `VALUE`：任务内字段值依赖。
- `CONTINUES`：满足现有接续规则的跨任务字段连接。
- `CANDIDATE`：保留分区匹配状态的候选连接；默认展示，`--confirmed-only` 排除。
- `CONDITION` / `DATASET_CONTROL`：字段条件或行集控制，在加工详情中消费，不进入默认值来源遍历。
- `SCHEDULE`：调度依赖，必须显式选择 `--layer schedule`。

多个产品或多个写入会保留各自 `writeId`；同名输出字段可以用 `--write-id` 缩小范围。查询表同名但属于不同物理数据源时，以返回的 `nodeId` 继续调查。

`processing.evidence` 提供本批投影路径、内容哈希、详情路径和图版本。Agent 应引用这组固定证据，而不是临时目录中的旧案例。某个字段没有值来源边时，可以继续查绑定、内部加工和 SQL；不能据此把同表调度边解释为字段来源。

`processing.expressions[].inputDependencyStatus` 原样保留 Facts 的依赖状态，例如 `PARTIAL`、`PHYSICAL`、`NO_PHYSICAL_INPUT`；材料没有该状态时返回 `null`。即使已经列出了物理输入字段，`PARTIAL` 也不能省略或当作完整依赖。

`processing --relation-id` 精确读取该任务内的一个加工关系，并将表达式列表限定到该关系；`--text` 可进一步筛选表达式，分页只作用于表达式列表。返回的 `relation` 包含类型、语句身份、SQL 位置和原始 `definition`，可以查看其中的分组键、过滤条件、窗口或 Join 定义。若 `definition` 明确给出 `source`、`left`、`right` 等上游关系 ID，可用同一命令继续读取；不从命名推断连接，不自动递归。关系本身即使没有独立表达式，也会返回。

这些是关系级加工上下文，不等于已证明某个字段受到全部条件影响的精确因果路径。指定 ID 不在该任务的证据中时返回 `RELATION_NOT_IN_TASK_EVIDENCE`，不会扩大为整任务查询；不传 `--relation-id` 时维持原来的表达式查询方式。

## 更新图谱

构建命令和查询命令分开：

```powershell
npm run graph:prepare -- --scope ../sql-static-lineage-data/tmp/from-cache-full/partial-analysis/odata-n-tit/ids-intersect-dm-otc-n.txt
npm run graph:publish
```

准备阶段校验并复用共享任务投影，发布阶段重算受影响接续并增量更新 Neo4j。相同批次重复发布返回 `UNCHANGED`。新增任务需要先加入范围文件；更新任务替换本任务拥有的关系；移出范围后清除其关系并保留其他任务仍在使用的共享实体。

既有 `field-evidence:query` 是旧调查/回归入口，仍可能现场准备投影；Agent 的本批查询统一使用本文入口。旧 Greek 回归和另一个任务新增的资产目录预览都不作为本批发布内容。
