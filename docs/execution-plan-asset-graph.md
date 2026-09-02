# 数据资产图执行方案

配套架构文档：`docs/domain-asset-graph-architecture.md`。本文件只讲**怎么执行**：
工作包切分、依赖关系、并行边界、每包的完成定义。

每个工作包（WP）按 1:1 可转成一个 OpenSpec change 的粒度切分。领取时执行
`openspec new change "<wp-name>"` 再补齐 proposal / specs / design / tasks。

## 先做这个（P0）：重跑收缩

完整方案见 `docs/execution-plan-rerun-shrink.md`。
问题不在清单太长（field-lineage HTML 的「81→69」是另一个消费者）。
P0 的 RS-5 已过（`176827.json` 14:22：档二仅拉链三张；`155015.json` 四张 ref 仍在）。
**WP-1 可以领。** 总览表前置仍写 P0 RS-5，现在已满足；不要再按「立即开始」绕过 P0 的旧印象。

## 现状事实（2026-09-01 实测，作为所有 WP 的共同基线）

```text
采集
  task pack            2,708      其中 2,694 有 SQL（99.5%）
  table pack           4,740
  schedule 缓存       13,740      13,284 带 topicName（290 个域）
  facts bundle           344      ~349 KB/任务，已按 sql_sha256 内容哈希缓存
  已发布 artifacts        10      ← 0.4%

体积失控点
  209119  field-lineage.json 22.21 MB   rowsetControls 占 90.6%
          11,783 条控制注解 / 219 个不同 relationId = 53.8x
          字段身份 27,104 次 / 750 唯一 = 36.1x
  176827  10.15 MB   4,376 / 202 = 21.7x
  155015   0.29 MB      78 /  25 =  3.1x

语义资产（已采集，未消费）
  DDL 字段 COMMENT   110,021 条，覆盖 89.6% 的表，去重 29,263，仅出现一次 15,222
  表级 description   90.4%

结构约束
  data-graph loadProjectTopologySources 写死 maxRoots = 32
  血缘跨域是常态：抽样 400 任务，有上游的 309 个中 226 个跨域（73%）
```

## 工作包总览

| WP   | 名称                             | 仓库               | 前置                             | 可并行                          |
| ---- | -------------------------------- | ------------------ | -------------------------------- | ------------------------------- |
| WP-1 | `separate-field-impact-channels` | sql-static-lineage | **P0 RS-5 通过**                 | RS-5 之后，可与 WP-2 并行       |
| WP-2 | `harvest-declared-semantics`     | sql-static-lineage | 无（地图侧采集，不依赖闭包播种） | 可先做；不要当成「WP-1 已开工」 |
| WP-3 | `task-local-graph-projection`    | sql-static-lineage | WP-1                             | WP-1 合入后                     |
| WP-4 | `task-processing-kind`           | sql-static-lineage | WP-1                             | 与 WP-3 并行                    |
| WP-5 | `task-local-union-source`        | data-graph         | WP-3 契约冻结                    | 契约冻结后                      |

```text
WP-1 影响通道分离 ──┬─> WP-3 任务局部投影 ──> WP-5 data-graph 接入
                    └─> WP-4 加工/通道识别
WP-2 声明口径采集 ────────────────────────> （WP-3 后可加传播与矛盾检测）
```

WP-1 **P0 RS-5 已过，可以领。** WP-2 不碰闭包播种，可先做采集，但不得暗示 WP-1
已经开始。WP-3 与 WP-4 都依赖 WP-1 的分类结果，文件不重叠，可在 WP-1 合入后并行。

## 共享不变量

**所有 WP 必须遵守。违反其一即判定失败，不论其他门槛是否通过。**

1. 不修改 SQLLens、`scripts/plans/`、`scripts/machine-facts/` 的事实生产逻辑。
   事实不足时补 typed gap，不在消费侧猜测或补齐。
2. 不引入新解析器（Calcite / sqlglot / ScopeLineage / SQLLineage）。
3. 数据集级控制证据**不得**挂到字段节点，不得产生 `affectedRootFields`
   一类字段级断言。这是 WP-1 的核心，也是其余 WP 的前提。
4. 证据三态 `CONFIRMED | CANDIDATE | UNKNOWN` 与静态边界声明必须逐边保留；
   不得因为下游好看而升级状态。
5. 语义三档来源 `DECLARED | INHERITED | GENERATED` 不得合并或互相冒充。
6. 调度缓存中的 `querySql` / `prepareSql` 不作为事实来源。Input Pack 是唯一
   权威输入边界（`docs/l1-scope-and-architecture.md`）。
7. 缺证据的对象必须在产物中显式存在（边界节点 / gap），不得静默缺失。
8. 已发布的 10 份 root 产物与 `LEGACY_ARTIFACT_PAIRS` 路径的行为、快照 ID 算法、
   六个参考查询结果不得改变，用作回归基线。
9. 每个 WP 自带 155015 金样断言。跨任务值流
   `112715 → 114026 → 155015` 与 `71698 → 105387 → 155015` 精度不得回退。
10. 不另起通道词典。已有 `target-table-upstream-causal-closure` 的
    `FIELD_VALUE` / `ROW_MEMBERSHIP` / `MULTIPLICITY` / `EXPRESSION_CONTROL`
    是权威语义；WP-1 的 OpenLineage 投影与 WP-3 的图边必须是它的视图，
    不得平行发明 `rowDetermining` 一类同义新词。

## 既有 consumer 对齐（2026-09-01）

`openspec/changes/target-write-upstream-causal-closure` 已覆盖场景 3 的骨架，
不是空白。核对 `tasks.md` 与 `209119-gate-evidence.md` 后的状态：

```text
已完成    Baseline、M1（除 2.3 完整 field-port）、Gate A（带范围）
          M3 的图与 rollup（5.1–5.4）、M4 通道代数（除 6.6）
          5.1 JOIN 侧别（LEFT 保留侧 ROW_MEMBERSHIP，可空侧 MULTIPLICITY）
          3.4 部分字段不扩散（119044 档一只挂 5 列）
          拉链 CASE 的 summary 层标签（existenceCaseSelections）
          105387 / 176827 夹具与 176827 基线产物
未完成    2.3 完整 field-port
          3.2 跨任务 FIELD_VALUE 精确接续
          闭包播种已收口：值召回跳本地有拉链 CASE 才问 RM；LEFT 维表在档三
          （P0 RS-3 / 7b.6 + RS-5 / 7b.8：档二仅拉链三张）
暂停      M5/M6（Gate B 未过）
未开始    M7 独立 HTML/schema 发布
Gate B    任务清单勾了，证据写 NOT VERIFIED / REOPENED
          只过了更窄的 projection-readiness：可发表 overlay，不是运行期重跑清单
```

209119 最近一次：542 候选分支，46 `CONFIRMED_RELATED` / 496 `UNKNOWN`，
最小确定 41 任务 / 保守安全 78 任务。`runtimeRerunDecision = NOT_EVALUATED`。
155015 / 105387 拉链样例**已经进入**该 consumer 的金样
（`join-side-and-field-scope.test.ts` + `105387-zipper-relations.json`）。
176827 也跑过基线：`176827-baseline.json` 档一 27 任务可用，档二/档三空，32/59 UNKNOWN。
`155015.json` 档二已有四张 ref。`176827.json`（14:22）档二仅拉链三张；LEFT 维表
和 103943 generic CASE 子查询在档三。RS-5 已过。

现有 `summarizeTaskRelations` **已经按 JOIN 侧别分通道**，不再把任意 `join`
一律标成三通道。`demandedFieldNames` 对 join 取 `condition_columns`，
拉链 CASE 经 `existenceCaseSelections()` 能给出 `Agt_Modifr` 理由。
176827 到 105387 **不是直连**（`176827 --FV--> 119044 --FV--> 105387`）。
RS-3 已收口：值召回跳本地有拉链 CASE 才问 RM，LEFT 可空维表在档三。详见 P0 方案。

分工因此固定：

- 场景 3（单表重跑溯源）继续用该 consumer 做查询期反向闭包，先做 P0
  （闭包播种 + UNKNOWN 可解释 + 档四归因）。不在 WP-3 重写一遍闭包引擎。
- 场景 1（全局地图）仍需要 WP-3 的任务局部投影；该 consumer 是按 root 加载
  multi-hop universe 的，结构上铺不满 13,740 个任务。
- WP-3 只物化 `TaskRelationSummary` 已有的通道为图边，查询期把闭包引擎接到
  这张图上。

## WP-1 `separate-field-impact-channels`

**前置**：P0 重跑收缩的 RS-5 通过。总览表已写明；不要只看旧印象里的「立即开始」。

**目标**：把"值影响"和"行集影响"拆成互不污染的两条通道。同时消除假阳性与 90% 体积。

**改动范围**

```text
scripts/reconcile/consumer/field-lineage/field-lineage.ts
  rowsetControlsFor()        不再以 node.nodeId 为键
  主循环调用点               控制证据改为按 relation 收集一次
scripts/reconcile/consumer/field-lineage/field-lineage-contract.ts
  RowsetControlAnnotation -> DatasetControlAnnotation
  新增 grain 字段与 FIELD_DIRECT subtype / FIELD_CONDITIONAL
  counts / canonicalize / validate 同步
scripts/reconcile/consumer/field-lineage/format-field-lineage.ts
scripts/visualize/field-lineage-visualize.ts
  字段值流与数据集控制分列展示，不合并成单一"影响表数"
```

**这不是自创重构。** OpenLineage `ColumnLineageDatasetFacet`（spec v1.52.0）已定义
同一套分类，并提供独立的 `dataset` 数组承载影响整个数据集的算子依赖。其文档中的
"Legacy representation" 一节描述的正是把这些依赖搬进每个输出字段的旧行为，原文结论是
"producing almost a cartesian product of all dataset fields. This is very inefficient."，
并建议切换到分离表示。本仓库当前的 `rowsetControls → node.nodeId` 即处于该 legacy 形态，
209119 的 53.8 倍重复就是这段描述的笛卡尔积。

**契约要点**

- `DATASET_CONTROL` 键为 `task + relation + 控制字段`，与受影响的输出字段数无关。
  起点是控制字段而非整张表，与 OpenLineage `dataset` 数组条目为 `InputField` 一致。
- `subtype` 逐字采用 OpenLineage 词典，不自造：
  - DIRECT：`IDENTITY | TRANSFORMATION | AGGREGATION`
  - INDIRECT：`JOIN | GROUP_BY | FILTER | SORT | WINDOW | CONDITIONAL`
- 新增 `masking` 布尔位（`hash`、`count` 等脱敏变换），对齐 OpenLineage。
- `FIELD_CONDITIONAL` 即 OpenLineage 的 `INDIRECT/CONDITIONAL`，
  仅在 `expression_roles` 命中 `BRANCH_SELECTION` 时产生。
- `grain` 是**本地扩展**（OpenLineage 无行倍增语义），第一版只做可证明的粗档：
  `GROUP BY`/`DISTINCT`/`FILTER` → `REDUCE`；可证明多对一或一对一的 JOIN → `PRESERVE`；
  证不出基数的 JOIN → `EXPAND_RISK`（INNER 不落 `UNKNOWN`）。
  `WINDOW` 证据不足才记 `UNKNOWN`。不做唯一键证明，不做行数估算。
- 证据三态与 typed gaps 沿用本仓库既有模型，同样标注为本地扩展。
- 重跑影响集分两档：最小确定集（`FIELD_DIRECT` + `CONFIRMED`），
  保守安全集（并入 `FIELD_CONDITIONAL` 与非 `PRESERVE` 的 `DATASET_CONTROL`）。

**完成定义**

1. 155015：`internal_trade_id` 的 `FIELD_DIRECT` 上游不含那四张 LEFT JOIN 表。
2. 155015：四张表以 `DATASET_CONTROL / JOIN` 出现在 Task 105387 的目标写入上，带 `grain`。
3. 209119：控制注解由 11,783 条降到与不同 `relationId` 同量级（实测 711 条 /
   339 个 relationId，比值 2.10；旧形态是 11,783 / 219 = 53.8 的逐字段复制），
   `field-lineage.json` 由 22.21 MB 降至 3 MB 以内（实测 2.69 MB）。
   176827 由 10.33 MB 降至 2 MB 以内（实测 1.37 MB）。
4. 155015、176827、209119 的 `nodes` / `edges` 计数不减少。
5. 产物与页面中字段值流与数据集控制分列统计。
6. `npm run test:field-lineage`、`npm run typecheck`、`npm run build`、
   `npm run format:check` 全绿。

## WP-2 `harvest-declared-semantics`

**目标**：把已采集但未消费的 110,021 条 DDL 注释变成可查询的声明口径层。

**改动范围**：新增独立模块，不改动现有 Table Pack 采集与 DDL 冻结逻辑。
只读 `<data-root>/tables/**/ddl.sql` 与 `table.json` 的 `description`。

**契约要点**

- 输出 `DECLARED_SEMANTICS` 记录：`platform | dataSource | qualifiedName [| column]`
  → 描述文本 + 来源 locator + DDL sha256。
- `provenance` 固定为 `DECLARED`。本 WP 不产生 `INHERITED` / `GENERATED`。
- 标注低信息量：注释在全库出现频次超过阈值（如 `数据时间` 2,817 次、
  `业务日期` 2,127 次、`指标值` 669 次）时置 `lowInformation: true`，
  供地图排序与人工补全优先级使用。不删除，不改写。
- 不做 LLM 生成，不做跨字段推断。

**完成定义**

1. 覆盖率留档：字段级注释条数、去重数、覆盖表比例，与基线（110,021 / 29,263 / 89.6%）
   一致或给出差异说明。
2. 表级 `description` 覆盖率留档，与基线 90.4% 一致。
3. 低信息量标注可复现：同一输入两次运行结果字节一致。
4. 不修改任何 Table Pack 文件；DDL sha256 校验通过。
5. `npm run typecheck` / `build` / `format:check` 全绿，新增聚焦测试通过。

## WP-3 `task-local-graph-projection`

**目标**：建立 O(N) 任务局部投影，把遍历从构建期移到查询期。

**前置**：WP-1 合入（需要 `FIELD_DIRECT` subtype 与 `DATASET_CONTROL`）。

**改动范围**：新增 `scripts/project-graph/task-local/`。不写入
`artifacts/tasks/<task-id>/`，不改动 one-hop / multi-hop / field-lineage 生产。

**契约要点**

- 节点：`TASK`（含 `topicName`、`taskCategory`）、`PHYSICAL_DATASET`、
  `PHYSICAL_FIELD`、`TARGET_WRITE`。身份函数与 data-graph 现有实现一致。
- 边：`WRITES`、`READS`、`FIELD_DIRECT`、`FIELD_CONDITIONAL`、`DATASET_CONTROL`。
  全部限定在本任务内，**不做任何跨任务遍历**。
- 通道来源：直接读取 `summarizeTaskRelations()` 的 `readImpacts` /
  `impactChannels` / `demandedFieldNames`，按下表投影，不平行实现一套规则。

  | 图边                                      | 来自                        |
  | ----------------------------------------- | --------------------------- |
  | `FIELD_DIRECT`                            | `FIELD_VALUE`               |
  | `FIELD_CONDITIONAL`                       | `EXPRESSION_CONTROL`        |
  | `DATASET_CONTROL` subtype `JOIN`/`FILTER` | `ROW_MEMBERSHIP`            |
  | `grain`                                   | `MULTIPLICITY` 的 certainty |

  `demandedFieldNames` 在 JOIN 键闭包（P0 RS-3）补完之前，跨 hop 的行决定列
  仍可能传不出去。WP-3 可以先按现有摘要落边；105387 金样允许先断言
  summary 层标签（已绿），闭包层理由链等 P0 RS-3 合入后再收紧。

- 常量谓词：形如 `SRC_TBL IN ('...')` 的字面量分区谓词单独记为
  `partitionPredicates[]`（列 + 字面量集合）。查询侧据此在多写入方分区表上
  剪掉不匹配分区的写入任务。
- 不落盘路径。路径在查询时展开并受查询侧上限约束。
- 增量：按 Input Pack 内容哈希复用，机制沿用现有 `task-fact-index.jsonl`
  （`sql_sha256` + `manifest_sha256`）。
- 覆盖状态：`PROJECTED | SCHEDULE_ONLY | COLLECTION_FAILED`。
  `SCHEDULE_ONLY` 只承载调度边，不产生字段边。

**首批范围**：`DM_RSK_N`，调度缓存 63 个任务，其中 57 个已有 Input Pack（90%），
含 155015。域仅用于批次顺序，**不进入图或快照契约的 scope**。

**完成定义**

1. 首批 63 个任务全部产出局部投影或显式失败原因，不静默跳过。
2. 二次运行在 Input Pack 未变时全部命中缓存，产出字节一致。
3. 物理字段身份全局唯一：同一 `platform|dataSource|table|column` 只有一个节点，
   不再出现 209119 那样的 36 倍重复。
4. `DATASET_CONTROL` 条数等于不同 `relation × 控制表` 组合数，不随字段数增长。
5. 跨域连通不被批次切断：155015 的上游 `EDW_EVT` / `ODATA_N_TIT` / `EDW_AGT`
   以 `SCHEDULE_ONLY` 或 `PROJECTED` 出现，不缺失。
6. 追加第二批后既有节点与边身份不变，覆盖状态单调改善。
7. 单任务投影耗时与批次总耗时留档，作为扩批 `DM_OTC_N`（732 / 412 已有包）与
   `ODATA_N_TIT`（1,061 / 546）的成本依据。
8. 105387 作为回归样例固化：其输出列 `Stati_Cont_Desc` 的 `FIELD_DIRECT`
   只含 `D_TRD_OTC_TRADE.INTERNAL_TRADE_ID`；其 `rowDetermining` 必须覆盖
   `Agt_Modifr`、`Agt_Type_Cd`、`STRT_DATE`、`END_DATE`、`SRC_TBL`，
   经递归展开后可达 `D_REF_TRS`、`D_REF_OTC_OPTION_DEAL`、`D_REF_FX_FORWARD`、
   `D_REF_FAST_TRS` 四张参考表。仅按值血缘剪枝会漏掉这四个上游，属不可接受的假阴性。
9. 105387 的 `partitionPredicates` 含
   `SRC_TBL = {'ODATA_N_TIT.D_TRD_OTC_TRADE'}`。

## WP-4 `task-processing-kind`

**目标**：区分"真加工"与"纯通道"，这是业务地图最直观的一层。

**前置**：WP-1 合入（需要 `FIELD_DIRECT` subtype）。可与 WP-3 并行。

**契约要点**

```text
PASSTHROUGH    输出字段全 IDENTITY，单一源表，无 filter/join/aggregate/window
PROJECTION     全 IDENTITY，仅列裁剪或重命名
FILTERED_COPY  全 IDENTITY，但存在 FILTER
TRANSFORM      存在 TRANSFORMATION 表达式
AGGREGATE      存在 AGGREGATION 或 GROUP_BY
JOIN_ENRICH    读入多张物理表且存在 JOIN
UNKNOWN        SQL 缺失或证据不足
```

判据完全来自任务局部事实，不需跨任务遍历。`taskCategory` 只作**交叉验证**，
不作判据。当前分布：加工候选 1,598（`sparkIndex` 1,058 / `hiveTask-2.0` 314 /
`hiveTask` 216 / `qualityTask` 10），通道候选 1,097（`oracle2hive` 528 /
`hive2starrocks` 486 / 其余 83），`checkdbflag` 13。

**完成定义**

1. 声明为通道类别却检出 `JOIN_ENRICH` / `AGGREGATE`，或声明为加工却是
   `PASSTHROUGH`，一律输出为显式分歧项，数量留档，不静默采信任一侧。
2. `UNKNOWN` 必须给出原因码，不得作为兜底默认值。
3. 同一输入两次运行结果一致。

## WP-5 `task-local-union-source`

**目标**：让 data-graph 消费任务局部并集图，复用其全部投影、查询与索引能力。

**前置**：WP-3 的 `TASK_LOCAL_PROJECTION` 契约冻结（不必等全量铺完）。

**仓库**：`scripts/data-graph`（独立 git 仓库）。

**契约要点**

```text
sourceMode: TASK_LOCAL_UNION
  taskSources[]   taskId + 局部投影 sha256 + Input Pack fingerprint + 覆盖状态
  producerIndex   contentHash + inputFingerprint（单一身份，沿用现有校验）
  无 rootTaskIds  并集图没有 root，规模上限按任务数与总字节独立设定
```

新增 loader 与现有 `loadProjectTopologySources` 并列，**不修改** `maxRoots = 32`
及 `LEGACY_ARTIFACT_PAIRS` 的任何行为。两种 mode 不混入同一份快照。

**完成定义**

1. `LEGACY_ARTIFACT_PAIRS` 路径的校验、快照 ID、六个参考查询结果逐字节不变。
2. 并集图与已发布 root 快照在同一 ID 空间：同一任务/数据集节点 ID 可比对，
   用现有 10 份 root 产物做交叉验证并留档差异。
3. `npm run typecheck` / `build` / `test` / `format:check` 在 data-graph 仓库全绿。
4. 现有 `test:real-artifact` 闭环测试不回归。

## 并行调度建议

```text
第 0 波（现在）
  P0 重跑收缩 RS-0…RS-5   见 docs/execution-plan-rerun-shrink.md
  agent B -> WP-2         声明口径采集（不依赖 P0，可并行）

第 1 波（P0 RS-5 通过后）
  agent A -> WP-1   影响通道分离      收益：假阳性消除 + 9x 体积下降

第 2 波（WP-1 合入后，可同时派两个 agent）
  agent C -> WP-3   任务局部投影
  agent D -> WP-4   加工/通道识别

第 3 波
  agent E -> WP-5   data-graph 接入（WP-3 契约冻结即可开始，不必等铺完）
  WP-2 扩展         INHERITED 传播与"声明 vs 实现"矛盾检测（需 WP-3 的图）
```

派单给 agent 时必须同时给出：本文件的**共享不变量**全文、目标 WP 全文、
以及 `docs/domain-asset-graph-architecture.md`。缺不变量会导致并行改动互相破坏。

## 里程碑

**M1（WP-1 + WP-2）**：影响分类正确、产物体积回到可用量级、口径层可查。
**单表重跑收缩不在这个里程碑**——那是 P0 RS-5。M1 只覆盖 field-lineage HTML
通道分离与声明口径。

**M2（WP-3 + WP-4）**：`DM_RSK_N` 63 个任务铺满，成本模型实测有数，
加工/通道可见。此时具备扩批依据。

**M3（WP-5）**：并集图进入 data-graph 的查询与索引管线，
地图与影响分析共用同一份图。

## 明确不在本方案内

- 指标口径归并与指标目录绑定。指标口径是**行级**的（指标宽表 `index_val`
  列注释恒为"指标值"，真实口径由行内 `index_id` 决定），锚点必须是
  `(表, 列, index_id 值)`。从 SQL 字面量提取不可靠（DM_INDEX_N 652 个包中
  仅 57 个命中，8.7%）。该能力依赖一个尚不存在的权威指标目录，需单独立项。
- 业务粒度词典（一行 = 交易 / 账户 / 日终快照）。
- 接入 OpenLineage 生态。仅借用 `DIRECT` / `INDIRECT` 分层词典；
  其 columnLineage facet 无法表达 `grain`、证据等级、typed gaps 与
  `write_observation_id`，`JobEvent` 导出只作将来对接外部目录的有损出口视图。
- 运行时是否跑成功、数据是否正确、业务是否验收。
