# 详细实现方案

日期：2026-09-07。状态：**待实现**。本文中的新文件、合同、命令都是本批的实现目标，不是现有 API。范围与取舍见 [README](README.md) 和 [architecture](architecture.md)，完成标准见 [acceptance](acceptance.md)。

## 1. 推荐实施顺序

先完成“现有导出 → 精确重算 → 可查询结果”的小闭环；随后把 Titans 来源做成从总览到对象、任务、证据都能读的纵向样本。再完成骨架自动布局、其他来源、odata，以及迁移验证。不要先铺所有标签、所有页面或全库索引。

| 阶段 | 输入 | 输出 | 进入下一阶段的条件 |
| --- | --- | --- | --- |
| A. 固定输入与关系重算 | 旧 network、两份 sidecar、必要留存证据 | 可搬迁输入包、规范化关系索引、基线比较 | 所有方向成员集合与 schema 摘要精确一致 |
| B. 最小知识与元数据 | 本批对象范围、有效 JSONL 索引、既有知识 | 元数据摘录包、公共分类与解释、匹配缺口 | 有一个来源业务组能解释到对象与去向，不仅有分类数字 |
| C. Titans 纵向样本 | A/B 结果、来源视图配置 | 总览入口 → 来源 → 类别 → 对象 → 任务／证据 | 主画面穿透、返回、同一对象身份贯通 |
| D. 骨架计算与来源细化 | 同一输入、区域／阶段规则 | 计算得到的总览、其他来源和未展示方向 | 当前骨架可对照；改分类重跑，无前端特例 |
| E. odata 分析 | 区域对象与关联、三任务证据 | 区域分析首层、两个明确标注的案例 | 读者知道案例所在类别与边界，不误认为全区流水线 |
| F. 迁移与交付 | 本批另一个来源、完整 next 页面 | 迁移样本、回归结果、真实阅读发现 | 算法未复制、原入口完整、离线与内容验收通过 |

允许 C 中用一个极小计算总览连接入口，D 再补齐全部 14 节点布局。不要为临时演示写一次性坐标。

## 2. 文件与修改边界

新模块集中在 `scripts/processing-map/next/`，避免把新计算逻辑继续塞进 `content.mjs` 或 `view.js`。

| 文件（待新增，除注明外） | 单一职责 | 关键接口建议 |
| --- | --- | --- |
| `next/cli.mjs` | 参数解析、子命令调度、JSON 结果与退出码 | `import`、`metadata`、`build`、`inspect` |
| `next/input.mjs` | 输入包导入／读取、摘要与身份校验 | `importLegacyBundle(options)`、`loadInputBundle(path)` |
| `next/relations.mjs` | 任务与对象索引、schema／区域成员聚合 | `buildRelationIndex(network)`、`computeSchemaFlows(index)`、`computeSchemaSummary(index)` |
| `next/metadata.mjs` | 复用现有离线目录能力，按范围提取小包 | `extractScopedMetadata(index, catalogConfig)` |
| `next/knowledge.mjs` | 读取本批公共 catalog，解析分类／解释／适用性 | `loadMapKnowledge(root, scope)`、`resolveClassification(subject)` |
| `next/compute.mjs` | 总览、来源、类别、区域、对象的视图计算 | `computeMapViews(input, knowledge, definition)` |
| `next/layout.mjs` | 确定性的分列、排序、边路由、边界框 | `layoutView(view, layoutRules)` |
| `next/snapshot.mjs` | 结果合同、revision、差异、预算及最终写出 | `createSnapshot(...)`、`compareSnapshots(...)` |
| `next/compat.mjs` | 新结果映射到原 DATA 结构，保留历史专题 | `assemblePageData(nextSnapshot, legacyPayload)` |
| `next/definitions/titans-otc.json` | 本批区域、来源、阶段、路由、展开与预算配置 | 纯 JSON，无 x/y、无任意 JS |
| `next/tests/*.test.mjs` | 关系、分类、视图、快照、兼容的有意义测试 | Node test runner；需要 TS reader 时加载已有 tsx |
| `scripts/processing-map/payload.mjs`（必要时抽取） | 从原 build 抽出可调用的留存材料／原 DATA 构造 | `buildLegacyPayload(options)`；不在 import 时写文件 |
| 原 `build.mjs`（最小调整） | 继续构建原入口，调用抽出的 payload | 保持原默认路径、版本闸和校验语义 |
| 原 `view.js`（增量修改） | 消费新 view/action/memberRefs，保持原详情 | 不查文件、不计算业务分类、不按 schema 写分支 |
| 原 `view.css`、`template.html`（必要调整） | 主画面的分类切换、成员分页、面包屑 | 保持离线 CSP、键盘入口及原布局兼容 |
| `package.json` | 新 CLI／定向测试入口与 `pre*` 准备钩子 | 不覆盖现有 inventory-map 等未提交修改 |

不要直接 import 原 `build.mjs` 来取得 DATA，它当前有顶层读取和写出副作用。抽取 payload 时先保持原页面生成结果与校验一致，再接新路径；不借机重构无关 SQL 阅读器或 knowledge 合同。

### 数据与产物位置

```text
<dataRoot>/
  processing-map/
    inputs/<bundleId>/manifest.json + graph/ + retained/
    metadata/<metadataRevision>/manifest.json + objects.json + evidence/
    snapshots/<snapshotId>/manifest.json + map.json + changes.json
  knowledge/catalogs/titans-otc/
    tags.json
    schemas.json
    objects.json
    regions.json
    notes/*.md

<repo>/
  scripts/processing-map/next/definitions/titans-otc.json
  docs/processing-map.html              # 原入口，保留
  docs/processing-map-next.html         # 本批新入口
```

dataRoot 必须用 `resolveKnowledgeDataRoot()` 或项目已有路径解析器获得；配置内相对路径以配置文件目录为基准，不能以 shell cwd 或字符串拼接猜测。源目录、缓存索引路径由 CLI／配置指定，交付 HTML 中不暴露环境地址与内部连接配置。

## 3. 输入包合同与导入

### 3.1 最小 manifest

以下示例是结构示意，`<...>` 由程序产生，不可原样写入真实产物：

```json
{
  "schemaVersion": 1,
  "kind": "processing_map_input",
  "sourceKind": "legacy_table_network",
  "bundleId": "<content-digest>",
  "graphId": "titans-otc",
  "graphVersion": "<published-version>",
  "scope": {"taskCount": 3615, "taskIdsSha256": "<digest>"},
  "semantics": "same_task_read_output_association_v1",
  "files": [
    {"role": "network", "path": "graph/table-network.json", "sha256": "<digest>"},
    {"role": "legacyFlows", "path": "graph/schema-flows.json", "sha256": "<digest>"},
    {"role": "legacySchemas", "path": "graph/schema-summary.json", "sha256": "<digest>"}
  ],
  "retainedEvidence": [{"role": "fixedSql", "path": "retained/fixed-sql.json", "sha256": "<digest>"}]
}
```

manifest 新增的导入时间、导入位置等执行信息作为 provenance 另存，不进入 ID。确定性以**相同原始文件字节**为前提；network 文件自身的 exportedAt、manifestPath 等也是字节的一部分，它们被重新导出改变时允许生成新的 inputRevision，不另建一套剥离 provenance 的语义哈希。包内路径必须是相对路径，解析后处于包目录内。manifest 是文件绑定，不代表额外的业务认证。

### 3.2 导入步骤

1. 读取显式传入的 network 和 sidecar，计算实际字节摘要；对同一输入只读取一次或确保摘要与解析同一批字节。
2. 校验 tasks 的 taskId/nodeId、tables 的 id 唯一；所有输入输出 datasetId、边端点必须存在且方向一致；对照声明的 counts。
3. 从原始 edges 重建每任务输入输出的去重集合，与 `tasks.inputs/outputs` 比较；再验证 `tables.readers/writers`。原边允许 occurrence 级重复，不要求原边数等于去重关联数。
4. 用 `relations.mjs` 重算全部 schema-flow 和 schema-summary；对 sidecar 比较**完整成员集合与数字**。缺一个合法成员也应失败，不能只验证列出的成员都合法。
5. 关系包可以独立导入。只有显式传入本包的留存材料时，才按该包自身的 graphVersion、任务身份和 `querySha256` 核验附件。本次固定基线验收带齐 SQL／本金／正文；一般新图不强制带旧附件。将实际使用的正文和摘录列入清单，不依赖已经失效的 evidencePath。跨版本历史材料通过独立的旧输入包提供，不混在新 network 的证据闸中。
6. 验证成功后写到新 bundle 目录，最后写 manifest；已有同 ID 包只验证后复用，不就地覆盖。失败不得修改旧输入或旧 HTML。

schema 解析在 legacy adapter 中保持旧规则 `table.split('.')[0]` 以复现当前基线，同时输出 `schemaResolution: legacy_first_segment`。新输入必须显式带 schema 或声明适配规则；无 schema、多段名称、占位符应保留状态，不自动套用全局解析假设。

## 4. 关系计算与视图成员

### 4.1 建一次索引

至少构建：`taskById`、`datasetById`、`inputIdsByTask`、`outputIdsByTask`、`readersByDataset`、`outputsByDataset`、`datasetIdsBySchema`、`flowBySchemaPair`。

对每任务，遍历去重的输入 schema 集合与输出 schema 集合，向对应 pair 的 taskId Set 加入任务。schema／区域集合只存身份引用；不在每个视图复制任务详情或 SQL。不要每个对象都重新扫 3,615 个任务，或逐表启动一次 graph CLI。

`buildRelationIndex` 的遍历工作量应随任务关联数和各任务的 schema 配对数增长；成员列表输出统一排序。对象身份有重名时仍是独立节点。

### 4.2 原骨架的可重跑定义

从原 overview 提取 **14 个语义区域和 18 条路由选择规则**，保留阶段／职责意图；不要把原 x/y、`viaY`、`labelOffset` 搬过来。节点与边的数字、成员由输入生成。

视图 selector 只实现本批需要的几个可组合操作：`schemaIn`、`datasetIds`、`tag`、`incomingTo`、`excludeSchemas`、`excludeRegions`。不建设通用查询语言；非法组合给明确错误。`excludeRegions` 用于 X 动态排除 S／O，先计算被引用区域，不允许循环引用。

```json
{
  "schemaVersion": 1,
  "id": "titans-otc",
  "stages": [
    {"id": "source", "order": 0, "title": "来源"},
    {"id": "ingest", "order": 1, "title": "采集与整理"},
    {"id": "model", "order": 2, "title": "模型与主题"},
    {"id": "application", "order": 3, "title": "应用加工"},
    {"id": "delivery", "order": 4, "title": "交付"}
  ],
  "regions": [
    {"id": "S", "stageId": "source", "selector": {"tag": {"dimension": "sourceSystem", "value": "titans"}}, "knowledgeRef": "region:titans-visible", "openView": "source:titans"},
    {"id": "O", "stageId": "ingest", "selector": {"schemaIn": ["odata_n_tit"]}, "knowledgeRef": "region:odata", "openView": "odata"}
  ],
  "routes": [{"from": "S", "to": "O", "kind": "read_output_association", "display": "split_by_schema_pair"}],
  "sourceViews": [{"id": "source:titans", "rootRegion": "S", "groupBy": "businessObject"}]
}
```

示例仅列两个区域，实施时需补齐原区域定义。`schema → sourceSystem` 的初始知识映射让 S 命中 titans_dm、titans_refdata；改动该标签后重新生成 S 与其他接入来源的成员和连线，不改前端。

原 X 的精确含义是：所有 `to=odata_n_tit` 且 from 不在 `titans_dm/titans_refdata/odata_n_tit` 的方向。它**不等于全库所有非 Titans 外部来源**。新配置实现为 `incomingTo: O` 并 `excludeRegions: [S, O]`，按 S／O 当前命中的 schema 排除；在旧标签下恰好等价原条件。将 titans_refdata 从 sourceSystem=titans 移出后，它进入 X，S→O 保留 484，X→O 增加该方向的 30 个任务分项；移入一个来源时从 X 移除，不能漏掉或重复归入这对互补来源组。已知加工区域也可能出现在这些接入关系里，不得统称外部源。

region selector 允许在不同阅读上下文重叠。不要把所有 dataset 永久塞入唯一全局区域。每条可视边保留实际 pair 及成员，跨边与跨组联合数量使用 Set；摘要应标明重叠。

### 4.3 边结果必须带成员

```json
{
  "id": "flow:S:O",
  "from": "S",
  "to": "O",
  "kind": "read_output_association",
  "groups": [
    {"fromSchema": "titans_dm", "toSchema": "odata_n_tit", "memberSetRef": "flow:titans_dm:odata_n_tit", "count": 484},
    {"fromSchema": "titans_refdata", "toSchema": "odata_n_tit", "memberSetRef": "flow:titans_refdata:odata_n_tit", "count": 30}
  ],
  "uniqueTaskCount": 514,
  "scope": "visible_snapshot"
}
```

这是当前基线示例，真实输出不能写死 484／30／514。页面标签显示 484 / 30；点击后分方向读取精确成员。结果还须保留未显示方向及其原因，例如 `not_selected_in_overview`、`unmapped_region`，让新增关系有可读入口。

## 5. 元数据提取：复用既有索引

### 5.1 已有适配器

- `scripts/input/shared/offline-table-resolver.ts`：`loadOfflineTableCatalog(options)`、`resolveStandaloneOfflineTable(qualifiedName, catalog, packStore, collectedAt, options)`。
- `scripts/input/shared/jsonl-offset-index.ts`：`loadPersistedJsonlOffsetIndex(persistPath, jsonlPath)`、`loadJsonlOffsetIndex(jsonlPath, {persistPath, keyOf, sameRecord})`、`lookupJsonlByKey(index, key)`；保留 HIT／MISS／AMBIGUOUS。
- 上述实现是 TypeScript。新 Node CLI 使用仓库锁定的 `tsx` 加载，不用 npx 临时下载依赖。

`loadOfflineTableCatalog` 会为默认的多类目录建立索引，并可能读取已有数据源映射，不能为了查少量 Titans 对象无条件调用默认全量路径。优先从显式配置复用有效的 RDBMS 索引，仅 odata 范围补 Hive 索引；若需要包装薄的只读 scope adapter，复用键与歧义规则，不调用采集／Pack 写入流程。现有 `rdbmsKeys`、`sameRdbmsPhysicalInstance` 和 Hive key helpers 并非全部已导出，必要时仅导出这些现有纯函数供薄适配器使用，避免复制一套身份规则；对应源文件的最小导出修改纳入本批文件范围。

已有 `tmp/from-cache-trial/jsonl-indexes/` 是可核查的缓存候选，不是永久依赖路径。metadata 命令使用 `--index-dir`；索引失效或缺失默认报告需要准备，只有显式 `--allow-index-build` 时顺序扫描所需 JSONL 一次并保存索引。普通 `build` 不允许隐式建索引。

### 5.2 原始输入与提取范围

| 原信息子路径 | 当前量级 | 本批用途 |
| --- | --- | --- |
| `RDBMS核心信息/gf_rdbms_table_core_restored.jsonl` | 约 948 MB | Titans 范围的候选身份、注释、键和类型来源 |
| `关系ddl-实际/gf_rdbms_table_ddl_restored.jsonl` | 约 1.82 GB | 命中对象的 DDL／定义摘录 |
| `hive元信息-20260831快照/hive_table_restored.jsonl` | 约 74 MB | odata 等本批仓内对象元数据 |
| `20260830211426ddl/hive_table_ddl_restored.jsonl` | 约 154 MB | 对应结构、分区和定义 |

`metadata` 子命令先由图和 scope 生成目标对象 ID 集合，再查询目录。第一批为 Titans 234 个可见表身份和 odata 分析需要的对象；其他来源只提取迁移样本。每次记录命中／歧义／缺失和类型未确认原因，不能把目录全量对象并入图中成员。

物理类型不能直接照抄 resolver 的 `objectType`：其值可能来自 `type_name=gf_rdbms_table` 等目录实体类别。保留原始 `type`、`type_name`，经受支持的明确映射或 DDL 的 CREATE TABLE／CREATE VIEW 证据再给出 TABLE／VIEW，否则 UNKNOWN。不写完整 SQL 解析器。

### 5.3 元数据包结果

每个 datasetId 至少返回：`matchStatus`、`sourceRevision`、`qualifiedName`、`nativeType`、`objectType`、`comment`、`declaredKeys`、`columns`（有依据时）、`evidenceRefs`、`gaps`。匹配仅到同名候选时，信息放在候选区，不覆盖对象已确认事实。

完整 JSONL 不入 HTML。可预取本批命中对象的精简结构与关键定义选段，构建后点击读取内嵌内容；未预取的完整 DDL 显示“本快照未收录”，不能离线点击时偷查本地文件。SQL 行号、slot、原始摘要和展示脱敏状态分开保存。

234 个对象的精确匹配率、DDL 命中率、多实例歧义率、业务标签覆盖仍未核验。实施阶段据实生成，不在样例里填猜测数。

## 6. 共享分类与解释合同

### 6.1 四份结构化文件

| 文件 | 内容 |
| --- | --- |
| `tags.json` | sourceSystem、businessObject、productScope、dataRole、processingDuty 词表；id、label、definition、order |
| `schemas.json` | 本图范围中的 schema 分类与区域职责依据；scope 中保留 graphId／schemaName |
| `objects.json` | 以 datasetId 绑定对象分类、用途和重要判断，不以表名末段作主键 |
| `regions.json` | 读者标题、区域说明、典型问题、案例引用；不存布局或计算数字 |

每份带 `schemaVersion: 1`。一条分类／判断结构：

```json
{
  "id": "classification:example",
  "subject": {"kind": "dataset", "id": "<dataset-id>"},
  "dimension": "businessObject",
  "values": ["trade", "contract"],
  "preferredValue": "trade",
  "status": "interpreted",
  "scope": {"graphId": "titans-otc"},
  "evidenceRefs": ["<metadata-or-retained-evidence-ref>"],
  "noteRef": "notes/example.md"
}
```

`observed` 表示材料明确声明，`interpreted` 表示有依据的阅读归纳，`candidate` 表示待核线索。以上是本批新 catalog 的状态，不修改现有 task knowledge 的状态枚举。候选不伪装为已确认标签；缺少分类归入未分类，有初步解释可读，不要求先人工批准。

`tags.json` 中是机器稳定 ID 与读者名称的映射，页面可以改中文标题而不改变对象身份。long-form 说明放 notes，正文和 JSON 都参与 knowledgeRevision。

### 6.2 分类解析规则

1. schema 标签只用于 schema／区域分组，或明确标注为继承的来源系统维度。不得自动给 schema 下每张表继承同一个业务对象或加工职责。
2. 对象已明确声明的标签优先；多个同维度标签均保留。当前画布主分组由 preferredValue／词表顺序确定，其余标签可筛选。
3. 筛选集合允许交叠；显示联合数量必须按 datasetId 去重。主分组成员和“同时具有其他标签”的匹配成员分开命名。
4. prefix 只能生成候选；`_p` 与 `_pb` 不能自动转换为“采集”与“批次整理”已确认职责。
5. 冲突分类保留来源和待核状态；不要以最后读到的文件覆盖前一个判断。
6. 为每个已发布阅读发现保存结论、对象／任务引用、证据与边界。反向关联只写“发现配置／输出关联线索”，确认实际语义后再写更强结论。

## 7. 视图计算与有界穿透

### 7.1 新快照的共同结构

```text
MapSnapshot
  schemaVersion, snapshotId, versions, scope, coverage
  entities.datasets / entities.tasks     # 一份精简字典
  memberSets                            # 精确对象/任务集合，去重复用
  views[id]                             # nodes/edges/stages/导航/预算
  knowledge / evidence                  # 本次实际引用的内容
  findings                              # 有依据的分析结论与待解释关系
  changes                               # 与显式上一快照的差异

View
  id, kind, title, summary, scope, parentId, breadcrumbs
  nodes[], edges[], stages[], width, height
  memberSetRefs, omittedDirectionRefs, gaps

Node
  id, kind, entityRef?, title, subtitle, stageId
  memberSetRef?, tags?, objectType?, knowledgeRefs?
  action { type: openView | taskDetail | evidence, target }
  x, y, width, height                    # 仅布局计算后写入
```

`kind` 最少支持 overview、source、members、region、object、case。所有引用能解析，所有 count 可从 memberSet 还原。节点 action 必须是已支持的枚举，不能带可执行脚本。

### 7.2 Titans 来源页

输入：S 选中的 datasetId 集合、关系索引、精简元数据、共享知识。

首屏表现：在主画面展示来源组成和业务类别，并与消费去向连接；顶端说明范围和一两条已核阅读发现。schema、业务对象、TABLE／VIEW／UNKNOWN 是可切换维度，不堆三套互不关联的统计图。

点击类别进入主画面的成员页，30 项分页、名称／标签筛选；选择对象进入对象关系页。成员页是为了找对象，不能承担全部分析结果。对象页显示来源、本体、消费任务或任务组、输出区域；存在多个输入／输出时明确任务共现语义。

任务组点击进入该组主画面成员页；单任务打开原侧栏。对 514 个读取任务等高扇出集合，先按去向／任务职责聚合，不能一次画出全部任务。精确任务成员仍要可分页读完。

至少完成以下真实问题的材料调查并记录结果：

- 可见来源分别提供什么业务对象？哪些名称相似但类型／用途不同？
- 本批哪些对象被哪些加工区域消费？存在什么直接读取或参考支撑？
- 4＋1 个反向输出关联分别是什么性质？能证实到哪一层，还缺什么？

若材料只支持一部分，形成有证据的部分结论与具体缺口；不能补造一组“有价值发现”来满足数量。

### 7.3 其他来源与迁移

X 进入按当前入 O 的来源 schema／sourceSystem 组织的分析页。已知系统可分组，未知仍保留原 schema 与实际关联。以 OIS 等本批确实存在的一个来源为迁移样本：只新增／修改 view definition 与 knowledge，复用 source 计算器和前端；禁止 `if schema === ...` 页面分支。

### 7.4 odata 首层与案例

首层计算 odata 的全体可见对象、输入来源、输出关联任务、读取任务和消费方向；按有依据的 processingDuty／dataRole 分组，缺分类不阻塞全体结构可见。

案例层 `case:odata-batch` 显示 144134 与 144141：区分来源表、采集任务、配置目标、整理任务及产物；标明 SQL 读取与目标配置，跨任务连接标“表级关联，批次未确认”。不以一条无提示实线暗示日期分区与 h15 已接续。

案例层 `case:odata-margin` 显示 41540：完整 schema 表名、TITANS／OTC 来源标识、UNION ALL 的共同输出。标题使用“保证金参数合并输出”等证据支持的措辞；说明没有从 SQL 证明去重、粒度一致或业务口径统一。

每个案例有进入时的父类别、选择依据、成员与覆盖边界、产物主要去向。若“主要去向”仅由同任务输入／输出关联得出，沿用该语义，不标成已确认字段因果。

## 8. 布局与前端兼容

### 8.1 布局算法细节

1. 按 stage.order 建列；未知阶段必须进入定义的兜底列，不能丢节点。
2. 初始列内排序使用业务分组 order 和稳定 ID。做固定 4 次左右往返的加权重心排序，权重来自去重关联任务数并作上限压缩，避免一条巨大支撑边独占布局。
3. 排序平局按原稳定序号／ID；固定间距计算 x/y。标题换行按共同宽度和字符估算规则，节点高统一或按相同规则计算。
4. 跨列、逆向、同列边分别使用统一端口和通道分配；通道按端点 ID 排序，标签位置由路径中点与统一偏移计算。禁止把原 viaY／labelOffset 当新配置保留。
5. 算包围盒和 width/height。对节点重叠、边标签明显落在节点内进行几何检查；视觉拥挤仍需真实截图检查，不能靠算法测试替代。

五阶段是阅读顺序，不能据此禁止逆向边或将关系拓扑强制变成 DAG。本批节点拖动只保留相机平移，不新增单节点手工摆放保存。

### 8.2 前端接入

兼容层把计算视图转成原 nodes/edges/stages 形态，新增的 action/memberSetRefs 用一个统一分发器支持。旧 `flowGroups` 的 `otherSources` 特例仅服务旧 DATA；新视图直接消费计算好的 groups，前端不再硬编码 schema 条件。

导航 hash 采用可编码的稳定 viewId；父层显式保存在 views 中，直达对象页也可返回来源／总览。多路径进入同一对象时保留当前 trail；不能只靠一个 parentId 丢掉进入上下文。成员页页码与筛选、每个视图相机状态放会话状态，图版本变化时重新建立状态。

保留 Esc、Enter／空格、键盘焦点返回、窄屏、面板开合不重置相机。来源和区域的初次点击必须走主画面；任务、SQL 和证据保持侧栏。

## 9. 构建、查询与更新命令

以下 npm scripts **需要实施阶段新增**，当前不要执行：

```text
processing-map:import    -> node --import tsx scripts/processing-map/next/cli.mjs import
processing-map:metadata  -> node --import tsx scripts/processing-map/next/cli.mjs metadata
processing-map:build     -> node --import tsx scripts/processing-map/next/cli.mjs build
processing-map:inspect   -> node --import tsx scripts/processing-map/next/cli.mjs inspect
test:processing-map-next -> node --import tsx --test scripts/processing-map/next/tests/*.test.mjs
```

各 script 添加对应 `pre*` 调用 `npm run prepare:deps`，使用仓库锁定依赖。纯计算模块不得依赖 tsx 以外的新库；若现有 tsx 不在锁定依赖中，先查清当前运行约定，不用 npx 绕过 lockfile。

建议参数合同：

| 命令 | 必要参数 | 行为 |
| --- | --- | --- |
| import | `--network`、`--flows`、`--schemas`、`--config` | 只读导入；`--retained-sql`／`--retained-principal` 可选且必须属于本包版本；本次旧基线兼容验收必须提供，正文由受控清单读取；输出 bundleId／manifest 路径 |
| metadata | `--input <manifest>`、`--scope <titans-source|odata|configured-source>`、`--catalog-config <json>`、`--index-dir` | 只提取指定范围；索引未就绪时报明确原因；可显式 `--allow-index-build` |
| build | `--input <manifest>`、`--definition <json>`、`--config`、`--output <html>` | 可带 `--metadata <manifest>` 和独立历史包 `--legacy-input <manifest>`；无元数据或历史附件仍可构建结构并保留缺口 |
| inspect | `--snapshot <map.json>` 及 `--view`／`--dataset-id`／`--flow-id` 三选一 | 返回与 HTML 同份快照的成员、解释引用和缺口；`--offset/--limit` 分页 |

`build` 可带 `--previous <map.json>` 输出差异；没有 previous 时标 `initial`。示例边界：新图多一个 schema，但传入的 legacy 包仍属于旧版本，结构照常生成，旧专题转入带旧版本标识的历史参考；不将其任务集合和说明并入当前区域。输出路径不得等于原 `docs/processing-map.html`，本批使用 `docs/processing-map-next.html`。stdout 为一个结构化 JSON 结果，进度走 stderr；错误含稳定 code、对象引用和可执行原因，不输出内部连接串。

第一次执行示意：

```powershell
npm run processing-map:import -- --config config/workspace-paths.json --network tmp/processing-skeleton/table-network.json --flows tmp/processing-skeleton/schema-flows.json --schemas tmp/processing-skeleton/schema-summary.json --retained-sql docs/processing-map/fixed-sql.json --retained-principal tmp/otc-principal-value-case/four-writer-evidence.json
```

后续以该命令返回的 manifest 路径传给 metadata/build；文档中不硬编码一串不存在的 bundleId。更新标签后只需重新 build。普通 build 不重新跑旧 exporter、解析 SQL、刷新图、采集资料或遍历所有 Facts。

### 写出规则与预算

先在同目录的唯一临时产物完成所有计算、引用与预算检查，再发布 snapshot manifest 和替换 next HTML；失败保留上一版 next 和原 HTML。构建时间另存日志，内容 ID 与 map.json 不因时间变化而改变。正式快照不要写环境绝对路径。

初始预算沿用架构方案：overview 24/40、source/region 36/60、object 60/100、case 30/50（节点/边）；成员分页 30，inspect 默认 30、最大 100；HTML 12 MiB。分页是完整集合的分段访问，不是静默截断。超限返回 `VIEW_LIMIT_EXCEEDED`／`HTML_LIMIT_EXCEEDED` 并指明需缩小的具体视图。

## 10. 验证与交付材料

技术验证按 [验收标准](acceptance.md) 执行，先写关系完整性、标签重算、证据适用性这些有意义的测试，再实现对应逻辑；不为每个样式常量写测试。

至少保留如下产物：输入 manifest、基线比较结果、元数据匹配缺口、next HTML、snapshot、一次标签变化的差异、另一个来源的迁移配置、主要阅读路径截图、阅读发现及证据。大文件按现有产物规则保存，不把全部原始 JSONL 或输入包提交进代码仓库。

完成报告按“读者现在能回答的问题／证据／剩余缺口”组织；测试数量、节点数量和脚本跑通不能代替可视化价值。原页面是否切换到 next、是否进一步拓展全库，留给用户在看到实际结果后判断。
