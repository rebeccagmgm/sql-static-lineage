# 数据资产图架构

## 目标

建立一张**无边界、可增量长大**的静态资产图，替代当前"每个目标表跑一次上游闭包"的
生产方式，使数据地图、加工/通道识别、重跑影响分析和后续指标治理共用同一份图。

现状基线（2026-09-01 实测）：

```text
schedule-evidence 缓存      13,740 任务   13,284 带 topicName（290 个域）
                                         6,776 带 targetTable
已采集 task pack             2,708 任务   2,694 有 SQL（99.5%）
                                         2,033 同时有调度缓存
已采集 table pack            4,740
producer-index               8.8 MB      全局
已发布血缘产物 artifacts/tasks   10       ← 0.4%
```

单任务 SQL 并不缺，缺的是广度（2,708 / 13,740 ≈ 20%）。覆盖率不足不是代码缺陷，
是生产单位问题：现单位是 `root → 上游闭包 → per-root 产物`，成本随 root 数与深度相乘，
root 之间重复遍历，结构上到不了铺满。

## 核心翻转：把遍历从构建期移到查询期

```text
现在  root task ──闭包遍历──> per-root 产物        O(root × 深度)，不可复用
本设计 task ──局部事实──> 并集图 ──查询时遍历──> 地图 / 加工识别 / 影响面
                          O(N)，按 Input Pack 内容哈希增量
```

任务局部投影只声明"该任务自己的 SQL 能证明的事"，不做任何跨任务遍历。它每任务独立、
可并行、可按内容哈希缓存复用。跨任务拼接留给全局 `producer-index`，查询时按需展开。

## 图没有域边界

血缘天然跨域，且这是常态而非特例。随机抽样 400 个有调度缓存的任务：

```text
有上游且全部同域     83
有上游且跨域        226   ← 占有上游任务的 73%
无上游              81
```

155015（`DM_RSK_N`）的字段上游即横跨四个域：

```text
155015  DM_RSK_N      dm_rsk_n.v_risk_audit_log
114026  EDW_EVT
112715  ODATA_N_TIT   odata_n_tit.d_adm_audit_log
105387  EDW_AGT
71698   ODATA_N_TIT   odata_n_tit.d_trd_otc_trade
```

按域切图会切断约四分之三任务的上游链路。

因此 `topicName` **不进入图或快照契约的 scope**，只用于两件事：

1. **投影批次顺序**：先投哪批任务。可从调度缓存独立枚举，无需先有 Input Pack。
2. **查询时过滤与展示分组**：地图上按域收拢节点。

图的内容 = 已投影任务的并集。新增任务只追加，不需要重算既有部分，也不需要预先决定范围。

## 任务局部投影契约（新增，生产侧）

`TASK_LOCAL_PROJECTION`，每任务一份，落在图投影根下，不写入 `artifacts/tasks/<task-id>/`。

节点：

```text
TASK              taskId, taskName, topicName, taskCategory, processingKind
PHYSICAL_DATASET  platform | dataSource | qualifiedName      （复用现有身份函数）
PHYSICAL_FIELD    上述 + normalizedColumn
TARGET_WRITE      write_observation_id + 物理目标
```

边（全部限定在本任务内，不跨任务）：

```text
WRITES            TASK -> TARGET_WRITE -> PHYSICAL_DATASET
READS             TASK -> PHYSICAL_DATASET        携带 read_occurrence_id
FIELD_DIRECT      PHYSICAL_FIELD -> PHYSICAL_FIELD
                  subtype: IDENTITY | TRANSFORMATION | AGGREGATION
                  masking: boolean（hash、count 等脱敏变换）
FIELD_CONDITIONAL PHYSICAL_FIELD -> PHYSICAL_FIELD
                  OpenLineage 对应 INDIRECT/CONDITIONAL
                  仅 expression_roles 命中 BRANCH_SELECTION 时产生
DATASET_CONTROL   PHYSICAL_FIELD -> TARGET_WRITE
                  subtype: JOIN | GROUP_BY | FILTER | SORT | WINDOW
                  grain:   PRESERVE | REDUCE | EXPAND_RISK | UNKNOWN
```

`FIELD_DIRECT`、`FIELD_CONDITIONAL` 的 `subtype` 与 `masking`，以及 `DATASET_CONTROL`
的 `subtype`，逐字采用 OpenLineage `ColumnLineageDatasetFacet` 的分类词典
（spec v1.52.0）。`DATASET_CONTROL` 的起点是**控制字段**而非整张表，与 OpenLineage
`dataset` 数组条目为 `InputField` 一致：需要保留 JOIN/WHERE 用到的是哪一列。

`grain` 是本设计的扩展，OpenLineage 无行倍增语义；证据三态与 typed gaps 沿用本仓库
既有模型，OpenLineage 亦无不确定性表达。二者均标注为本地扩展，不冒充标准字段。

每条边携带 `evidenceStatus`（`CONFIRMED | CANDIDATE | UNKNOWN`）、证据引用和静态边界声明。
证不明时记 `UNKNOWN` 并生成 typed gap，不猜、不由相邻通道补齐。

来源全部是已有 Machine Facts，不新增解析：`relation-nodes.jsonl`、
`field-expression-nodes.jsonl`、`output-field-bindings.jsonl`、`schema-refs.jsonl`、
`task-local-materializations.jsonl`。SQLLens、Plan Facts、Machine Facts 发布器均不改。

## 加工 vs 通道识别

`processingKind` 是任务节点上的派生属性，判据完全来自同一份局部事实，不需跨任务遍历：

```text
PASSTHROUGH    输出字段全 IDENTITY，单一源表，无 filter/join/aggregate/window
PROJECTION     全 IDENTITY，仅列裁剪或重命名
FILTERED_COPY  全 IDENTITY，但存在 FILTER
TRANSFORM      存在 TRANSFORMATION 表达式
AGGREGATE      存在 AGGREGATION 或 GROUP_BY
JOIN_ENRICH    读入多张物理表且存在 JOIN
UNKNOWN        SQL 缺失或证据不足
```

`taskCategory` 作为**独立交叉验证**，不作为判据。当前分布：

```text
加工候选 1,598   sparkIndex 1058 / hiveTask-2.0 314 / hiveTask 216 / qualityTask 10
通道候选 1,097   oracle2hive 528 / hive2starrocks 486 / hive2mysql 32 /
                 hive2oracle 24 / mysql2hive 19 / hive2postgre 7 / postgre2hive 1
检查        13   checkdbflag
```

声明为通道类别却检出 `JOIN_ENRICH`/`AGGREGATE`，或声明为加工却是 `PASSTHROUGH`，
一律输出为显式分歧项供复核，不静默采信任何一侧。

## 覆盖状态必须显式

任务分三种可见状态，缺证据的任务必须在图上存在，不能静默缺失：

```text
PROJECTED         有 Input Pack 且局部投影成功
SCHEDULE_ONLY     仅有调度证据（含 topicName / targetTable），无 SQL 事实
                  以边界节点出现，只承载调度边，不产生字段边
COLLECTION_FAILED 有 Pack 但投影失败，显式列出原因
```

Input Pack 扩充时，图单调改善：`SCHEDULE_ONLY` 转为 `PROJECTED`，既有节点身份不变，
未变任务命中内容哈希缓存不重算。

**调度缓存中的** `querySql` **/** `prepareSql` **不作为事实来源。** Input Pack 仍是唯一权威、
冻结、可校验的输入边界（见 `docs/l1-scope-and-architecture.md`）。调度缓存只用于
域名单枚举、调度边和覆盖率核算。

## 两个仓库的分工

图能力已独立成仓：`scripts/data-graph`（独立 git 仓库，约 14k 行 + 4.4k 行测试），
已实现拓扑投影、字段证据投影、目标因果叠加、文件查询与 Neo4j 索引。

```text
sql-static-lineage（生产侧）
  SQLLens / Plan Facts / Machine Facts          不改
  one-hop / multi-hop / field-lineage           不改
  + TASK_LOCAL_PROJECTION 生产器                新增
  + 影响三档分类与 grain                        改消费投影
  - rowsetControls → 字段级 affectedRootFields   停用

data-graph（消费侧）
  topology / field-evidence / query / query-index / view   不重写
  + TASK_LOCAL_UNION source loader                          新增
```

两侧只通过已发布产物契约交互，不共享源码路径或依赖目录，沿用现有边界。

## 与 data-graph 的接法

现有 `ProjectTopologySnapshotV1` 在结构上是 root 驱动的：`rootTaskIds` 必须非空、
`sources.length` 必须等于 root 数、每个 source 必须给出 one-hop + multi-hop 产物对，
`sourceMode` 只接受 `LEGACY_ARTIFACT_PAIRS`。更硬的约束在
`loadProjectTopologySources` 里：`maxRoots` 默认 **32**，且每个 root 都要加载完整的
one-hop + multi-hop 文件并校验 producer index 配对。

这是"做不成地图"的结构性证据，不是参数没调大：root 数有上限、每 root 成本固定、
root 间重复遍历不可复用。任务局部并集图无法伪装成 root 对，也不该去改这个上限。

因此新增第二种 source mode 与配套 loader，而不是改动或绕过 Phase 1 契约：

```text
sourceMode: TASK_LOCAL_UNION
  taskSources[]   每任务：taskId + 局部投影 sha256 + Input Pack fingerprint + 覆盖状态
  producerIndex   contentHash + inputFingerprint（单一身份，沿用现有校验）
  无 rootTaskIds  并集图没有 root，规模上限按任务数与总字节独立设定
```

`LEGACY_ARTIFACT_PAIRS` 的现有行为、`maxRoots` 上限、快照 ID 算法、六个参考查询和
Neo4j 索引全部保持不变；两种 mode 不混入同一份快照。节点与边身份复用 `taskNodeId`、
`physicalDatasetNodeId`、`stableId`，使并集图与已发布 root 快照在同一 ID 空间内可比对，
便于用现有 10 份 root 产物做交叉验证。

## 规模与去重

当前 per-root 产物的体积失控，且失控点单一。实测（2026-09-01）：

```text
任务      field-lineage.json   nodes    edges    rowsetControls
155015              0.29 MB       94       80         78
176827             10.15 MB      538      441      4,376
209119             22.21 MB      951      814     11,783

按段占比
176827    nodes 3.4%   edges 5.3%   rowsetControls 90.9%
209119    nodes 3.5%   edges 5.2%   rowsetControls 90.6%
```

`nodes`/`edges` 增长温和；**90% 的体积来自算子控制注解**，而这些注解高度重复：

```text
209119   11,783 条控制注解，仅 219 个不同 relationId    = 53.8x
176827    4,376 条，          202 个                    = 21.7x
155015       78 条，           25 个                    =  3.1x

209119 字段身份出现 27,104 次，去重后仅 750 个           = 36.1x
```

重复来源与假阳性来源是同一条投影：控制注解按 `node.nodeId` 逐字段复制，
一个 JOIN 关系被复制成"受影响字段数"份。因此本设计的三处去重同时降体积与消误报：

1. **控制注解按 relation 存一次**，不按字段复制。`DATASET_CONTROL` 的键是
   `task + relation + 控制表`，与受影响字段数无关。
   按比例估算：209119 约 22.21 MB → 2.4 MB，176827 约 10.15 MB → 1.3 MB。
2. **物理字段身份全局唯一**。并集图中一个 `platform|dataSource|table|column`
   只有一个节点，不再按路径状态重复。
3. **任务只投影一次**。当前每份 root 产物各自内联自己的上游闭包
   （209119 的 one-hop 单文件即 10.3 MB），共享上游被反复装载；
   并集图中无论多少 root 可达，同一任务只存一份。

此外，路径不落盘。当前 artifact 受 `maxPaths` 约束枚举路径，属组合爆炸来源；
并集图只存节点与边，路径在查询时按需展开并受查询侧上限约束。

## 影响分类三档

同一次变更问三个不同问题，走三条不同通道，不互相冒充：

| 变更含义     | 通道                        | 用途                   |
| ------------ | --------------------------- | ---------------------- |
| 改值         | `FIELD_DIRECT`              | 字段下钻、指标取值来源 |
| 改口径分支   | `FIELD_CONDITIONAL`         | CASE/IF 条件字段       |
| 改样本或粒度 | `DATASET_CONTROL` + `grain` | 重跑范围、行集风险     |

硬约束：`DATASET_CONTROL` **不得**投影到输出字段节点，也不得产生 `affectedRootFields`
一类字段级断言。当前 `scripts/reconcile/consumer/field-lineage/field-lineage.ts` 中
`rowsetControls → node.nodeId → affectedRootFields` 这条投影是夸大来源，须停用；
JOIN/FILTER 改为独立的数据集通道。

`grain` 第一版只做可证明的粗档：`GROUP BY`/`DISTINCT` 记 `REDUCE`；能证明多对一或
一对一的 JOIN 记 `PRESERVE`；证不出基数的 JOIN 记 `EXPAND_RISK`。`WINDOW` 等非 JOIN 算子证据不足才记 `UNKNOWN`。
不做唯一键证明，不做行数估算。

### 第二正交轴：关联范围（WP-1 之后的细化，不并入 WP-1）

影响类型回答"改了会不会改值"；它不回答"这个算子该不该出现在某个字段的页面上"。
后者是独立的第二轴，两轴不得拍平成一维列表：

```text
FIELD_SCOPED    该字段的值经过此算子所在侧，或该字段本身即控制列
DATASET_SCOPED  只影响整个结果集的行存在性或重复度，不进该字段值链
SCOPE_DISJOINT  作用域不相交（不同 UNION 分支、仅供其他输出列的 CTE）
```

判别式**不是**"控制列与该字段 VALUE_FLOW 闭包是否相交"。交集为空不等于无影响：
任何改变行存在性的算子都会改变每个输出字段的结果行，即使不碰其值链。采用相交判据
会把当前的假阳性问题换成假阴性问题，而对重跑决策而言假阴性危害更大。

正确判别依据是**该字段的值来自算子的哪一侧**，结合算子类型：

- 值来自可空侧（如 LEFT JOIN 的右表）→ 算子决定该字段取值或 NULL → `FIELD_SCOPED`
- 值来自保留侧 → 不改值、不改行存在 → `DATASET_SCOPED`，仅保留一对多倍增风险
- INNER JOIN → 两侧均可能被裁剪 → 对所有输出字段均为 `DATASET_SCOPED`，
  **不得标注为无关**
- 仅当作用域可证明不相交时才使用 `SCOPE_DISJOINT`

现有 `rowsetControlsFor` 已按 `expression.relation_id` 的 relation 祖先做裁剪，
但单 SELECT 语句中所有输出字段共享同一 root relation，祖先集无区分度，因而全部命中。
这正是 209119 出现 53.8 倍重复的直接原因。第二轴需要上述侧别分析，
不能仅靠 relation 祖先推导。

`INDIRECT/JOIN` 且 `FIELD_SCOPED` 的条目应在字段视图中以高优先级展示，
但其类型仍为 `INDIRECT`，不得改标为 `DIRECT`：否则将失去"改此列是否改值"
这一可判定问法。

### 重跑溯源：需求驱动的反向切片

给定"某表需重跑、不知何处上游导致"，逐跳向上携带一个所需列集合，只展开能供给
该集合的上游任务。所需列集合每跳重算：

```text
needed(hop) = 值列
            ∪ 决定这些值列所在行是否存在、或存在于哪个版本的控制列
```

控制列自身有值链，须递归展开。**只按值列剪枝会产生假阴性**：105387 的
`Stati_Cont_Desc` 值仅来自 `D_TRD_OTC_TRADE.INTERNAL_TRADE_ID`，但拉链匹配键
`Agt_Modifr` 由四张参考表的存在性判断决定，匹配失败即闭旧链开新链、改写
`STRT_DATE`/`END_DATE`，而下游正是按这两列过滤。值链上零贡献的上游，
实际决定下游读到哪些行。

结果按档输出并标注理由，不输出单棵树（一棵树无法同时表达值必达与行决定）：

| 档       | 判据                                              | 用途                   |
| -------- | ------------------------------------------------- | ---------------------- |
| 值必达   | `FIELD_VALUE` / `FIELD_DIRECT` + `CONFIRMED`      | 排查起点               |
| 行决定   | `ROW_MEMBERSHIP` 闭包（含拉链匹配键与变更检测列） | 值未变但行集变时看这里 |
| 倍增风险 | `MULTIPLICITY` 且 `grain ≠ PRESERVE`              | 行数异常时看这里       |
| 已剪除   | 作用域可证明不相交；当前禁止由"没找到路径"产生    | 不展示，仅计数         |

查询期反向闭包已经存在于
`scripts/reconcile/consumer/target-table-upstream-causal-closure/`，
不另写引擎。5.1（JOIN 侧别）和 3.4（部分字段不扩散）已经落地；
拉链 CASE 在 summary 层也已接到 `Agt_Modifr`。155015 档二已经用这套规则证出
四张 ref。RS-3 已收口：值召回跳穿过 119044 问行决定，LEFT 维表在档三。
详见 `docs/execution-plan-rerun-shrink.md` RS-3。
105387 已是该 consumer 的金样：四张参考表走 `ROW_MEMBERSHIP`，
理由链经 `Agt_Modifr`，不得只出现一张无理由的算子表。

真正的规模收益来自常量分区谓词：分区共写表（如按 `SRC_TBL` 分区、每任务写一个
分区）在表级血缘上呈现全部写入方扇入，按 `partitionPredicates` 匹配后只保留
对应分区的写入任务。此剪枝与列裁剪正交，且在框架化生成的 ETL 中普遍适用。

## 边界

本设计不做，且不为其预留隐式接口：

- 指标口径与指标目录绑定。口径不能由 SQL 推导，须由数综/指标目录/人工确认独立供给，
  以绑定形式挂到 `PHYSICAL_FIELD`；归并发生在物理节点，不是合并口径文本。
- 业务粒度词典（一行 = 交易 / 账户 / 日终快照）。
- 更换解析引擎。SQLLens 已在 2,694 个真实任务上覆盖现有方言与证据语义；
  ScopeLineage（sqlglot / Python）、SQLLineage、Calcite 占的是同一格，替换只会回归。
  可借鉴 ScopeLineage 的 `logic_blocks[]` 类型化与 grain 标注设计，不引入其实现。
- 以 OpenLineage 作为内部模型。其 columnLineage facet 无法表达 `grain`、证据等级、
  typed gaps 与 `write_observation_id`，落成内部契约会丢证据。只借用
  `DIRECT`/`INDIRECT` 分层词典。OpenLineage 1.0+ 的 `JobEvent` 确实支持静态血缘
  （无需 run），但只作为将来对接外部目录时的**有损出口视图**，不反向充当事实来源，
  本期不实现。
- 运行时是否跑成功、数据是否正确、业务是否验收。
- 把数据集级 JOIN/FILTER 精确分摊到具体输出字段。

## 验收

先在一批小样本验证成本模型，再按批次铺开。首批建议 `DM_RSK_N`：调度缓存 63 个任务，
其中 57 个已有 Input Pack（90%），含 155015，可立即开跑。

工程门槛：

1. 首批任务全部产出局部投影或显式失败原因，不静默跳过。
2. 二次运行在 Input Pack 未变时全部命中内容哈希缓存，产出字节一致。
3. 快照通过 `TASK_LOCAL_UNION` 校验；已发布 root 快照的校验与查询结果不变。
4. 单任务投影耗时与批次总耗时留档，作为扩批到 `DM_OTC_N`（732 缓存 / 412 已有包）
   与 `ODATA_N_TIT`（1,061 / 546）的成本依据。
5. 追加一批任务后，既有节点与边身份不变，覆盖状态单调改善。
6. 去重生效可度量：`DATASET_CONTROL` 条数等于不同 `relation × 控制表` 组合数，
   不随受影响字段数增长；209119 的控制注解由 11,783 条降至 219 量级，
   字段身份不再出现 36 倍重复。

语义门槛，以 155015 为金样：

1. `internal_trade_id` 的 `FIELD_DIRECT` 上游不含那四张 LEFT JOIN 表。
2. 四张表以 `DATASET_CONTROL / JOIN` 出现在 Task 105387 的目标写入上，带 `grain` 判定。
3. 跨任务字段值流精度不回退：`112715 → 114026 → 155015` 与
   `71698 → 105387 → 155015` 仍完整，且跨域连通不被批次划分切断。
4. 字段值流与数据集控制在产物与页面上分列统计，不合并成单一"影响表数"。
5. `processingKind` 与 `taskCategory` 的分歧项显式输出，数量留档。
