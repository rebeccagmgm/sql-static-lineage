# 字段证据链 V1：执行方案（WP-11 · Phase 1–3 · 不物化闭包）

配套（本文件不覆盖、不替代以下任何一份）：

| 文档                                        | 读什么                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| `domain-asset-graph-architecture.md`        | 机器单位（写观察×读次）、影响三档、第二正交轴、`affectedRootFields` 停用理由 |
| `execution-plan-gold-case-investigation.md` | 四锚点并集图 GC-0…GC-5，本文件的原料来自它的产物                             |
| `execution-plan-task-local-projection.md`   | WP-3 纸条契约 1.2.0（本文件升到 1.3.0）                                      |
| `execution-plan-task-local-union.md`        | WP-5 并集 + WP-8 接续 INDEX（本文件的跨任务 resolve 只消费它，不改它）       |
| `execution-plan-rerun-shrink.md`            | 重跑三档（值必达 / 行决定 / 倍增风险）——CONTROL 的现有消费者                 |
| `graph-accuracy-architecture.md`            | WP-11 原登记项：`outputDerivationKind`、混合角色列、window 上下文列          |
| `graph-user-narrative.md`                   | L0–L3 对用户陈述                                                             |

本文件只解决一件事：

**把已经存在于任务局部投影里的字段事实（9,070 条值边、2,204 条控制边）从「静态解析结果」提升为「可跨任务、可解释、可诚实标注不确定性的证据链」，并用四锚点真数据验证一次 Impact Query——不新增节点类型、不物化任何闭包、不做算子全矩阵。**

---

## 0. 一页摘要

### 要什么

对任一锚点写观察的任一输出列，回答两个问题并给出证据：

```text
问题 A  这个字段的值怎么来的？         → VALUE 链（IDENTITY / TRANSFORMATION / AGGREGATION）
问题 B  什么因素会让这个字段的结果变？  → VALUE 链 ∪ CONTROL（带该列的作用域 scope）
```

跨任务时经 WP-8 `UNION_CONTINUATION_INDEX` 解析到具体写观察；解析不唯一 → **CANDIDATE frontier，不再递归**；证不出 → 具名 gap。

### 三句话

1. **修粒度**：字段边补 `sourceReadOccurrenceId` + `sourceRelationId` + `expressionId`，让字段级回到「写观察 × 读次」单位，与 INDEX 可对接。
2. **补语义**：值边 `subtype` 从 100% `UNKNOWN` 落到三分类（硬规则，不扯皮）；控制边补 `joinType` + `controlSide`，让「侧别」可算。
3. **查询期投影**：Impact Query 在查询时把 CONTROL 按列标注 `FIELD_SCOPED / DATASET_SCOPED / SCOPE_DISJOINT`，**不落盘、不生成字段级控制边**。

### 当前阶段（2026-09-04）

| 项                           | 状态                                          |
| ---------------------------- | --------------------------------------------- |
| 字段事实存在性（真数据实测） | **已确认**（§2）                              |
| 两跳数据可达性（四锚点）     | **已确认** 66/67、121/122、45/52、14/14（§2） |
| 契约 1.3.0                   | **未做**（FE-0）                              |
| Phase 1 三项派生             | **未做**（FE-1…FE-3）                         |
| Impact Query                 | **未做**（FE-4…FE-5）                         |
| 五个真数据验收 case          | **未冻结**（FE-6）                            |

### 立刻做什么（顺序）

```text
① FE-0  契约 1.3.0 一次升版（三项属性同进，缓存全失效只发生一次）
② FE-1  sourceReadOccurrence 派生 + AMBIGUOUS fail-closed
③ FE-2  subtype 三分类 + 分布留档
④ FE-3  DATASET_CONTROL joinType / controlSide
⑤ FE-4  跨任务 resolve（只读 INDEX）
⑥ FE-5  Impact Query：scope 计算 + 预算 + 输出契约
⑦ FE-6  五 case 金样冻结
⑧ 止损判定（§9）→ 决定 Phase 3 或回修 WP-8
```

---

## 1. 问题与目标

### 1.1 解决什么

- 字段级与表级**单位不一致**：表级坚持「写观察 × 读次」，字段边却只有 `(表, 列)`，接不上 INDEX。
- 值边**没有语义**：`select a`、`sum(a)`、`coalesce(a,0)`、`a*b` 在图上同形。
- 控制**停留在写观察级**：JOIN/FILTER 事实齐全，但对某一列「为什么受影响」讲不出侧别。
- 多 writer 是常态（7～10 个），产品若只画确定线，上线即「看起来很空」；需要一个诚实的 CANDIDATE 呈现契约。

### 1.2 不解决什么

- 不做全列覆盖、不做 100% 跨任务 FIELD 闭合
- 不做算子全矩阵（CASE/CAST/COALESCE/WINDOW/ARITHMETIC 各成一类）
- 不新增节点类型（`FieldBinding` 不是节点，见 §3）
- 不恢复 `affectedRootFields`、不生成字段级控制边（`FIELD_IMPACT_EDGE` 一类）
- 不改 SQLLens / Plan Facts / Machine Facts 发布器
- 不改 WP-8 INDEX 契约（只消费）
- 不上 Neo4j、不做 HTML

---

## 2. 实测基线（2026-09-04，四锚点穿透批 · 186 PROJECTED + 28 SCHEDULE_ONLY）

### 2.1 字段事实规模

| 指标                      | 数值                                            |
| ------------------------- | ----------------------------------------------- |
| `FIELD_DIRECT`            | 9,070（subtype 100% `UNKNOWN`）                 |
| `FIELD_CONDITIONAL`       | 201                                             |
| `DATASET_CONTROL`         | 2,204（JOIN 873 / FILTER 1,211 / GROUP_BY 120） |
| `PHYSICAL_FIELD` 出现次数 | 7,691（去重 4,683，重复率 1.64）                |
| identity `CONFIRMED`      | 7,477（97%）                                    |
| 有字段边的任务            | 182 / 186                                       |
| 投影总大小                | 10.4 MB（214 文件）                             |
| INDEX                     | 535 条目，候选均值 1.33，最大 10；0.9 MB        |

### 2.2 两跳可达性（锚点输入字段 → 批内 producer 是否有同名输出列 binding）

| 锚点   | 输入字段 | 可接到 producer binding | 断点                                                                             |
| ------ | -------- | ----------------------- | -------------------------------------------------------------------------------- |
| 176827 | 67       | 66                      | `pdata_n.ref_cd_cvt_map` 未投影（终止表）                                        |
| 209119 | 122      | 121                     | 同上                                                                             |
| 181058 | 52       | 45                      | 7 个卡在 `dm_rsk_n.otc_opt_inr_comp_pal_sum_temp`（writer 在批内、无列 binding） |
| 155015 | 14       | 14                      | —                                                                                |

结论：**数据层面多跳骨架已在**。缺的不是事实，是粒度、语义、侧别与查询契约。

### 2.3 当前字段边的形状（问题所在）

```text
FIELD_DIRECT
  from  PHYSICAL_FIELD(qualifiedName, column)          ← 全局身份，无读次
  to    TARGET_WRITE(writeObservationId)
  properties { bindingId, outputColumn, subtype: "UNKNOWN" }

DATASET_CONTROL
  from  PHYSICAL_FIELD
  to    TARGET_WRITE
  properties { subtype: JOIN|FILTER|GROUP_BY, grain, grainReason, relationId, statementId, writeObservationId }
                                                       ← 无 joinType、无侧别
```

`field-expression-nodes.jsonl` 的 `input_fields[]` 只带 `(table, column, field_id)`，读次需经 `expression.relation_id` 沿 relation 树回推；`relation-nodes.jsonl` 的 join relation 已带 `join_type` 与 `left / right` relation id（176827：16 个 join，inner 6 / left 10）。**所需原料都在 Facts 里，不需要新解析。**

### 2.4 一个被当前形状抹平的结构：UNION 分支

176827 是 `setop.b0 UNION setop.b1`：b0 为 OTC 期权支（经 `pdata_nds.pos_eod_position_view` 等 LEFT JOIN 链），b1 为 `t98_sb_tit_day_hold_indx` 支（INNER JOIN）。输出列 `gamma` 的 7 个来源同时含 b0 的 `pos_eod_position_view.gamma` 与 b1 的 `t98_sb_tit_day_hold_indx.gamma`——当前按 `outputColumn` 合并，分支信息丢失。补 `sourceRelationId` 后可区分，且为 `SCOPE_DISJOINT` 提供**可证明**的判据（§6.3）。

---

## 3. 概念模型：四原语 + 派生身份

### 3.1 Canonical（落盘，仅此四类事实）

```text
WriteObservation     TARGET_WRITE 节点，writeObservationId          已有
ReadOccurrence       READ_OCCURRENCE 节点，readOccurrenceId           已有
FieldEdge            FIELD_DIRECT / FIELD_CONDITIONAL 边（1.3.0 补属性）  改
DatasetControlFact   DATASET_CONTROL 边（1.3.0 补属性）                 改
```

### 3.2 派生身份（契约里写明，不是节点）

```text
FieldBinding  := (writeObservationId, outputColumn)
                 从现有 bindingId 可得；对外可展示为 <table>.<col>@<taskId>
ReadField     := (readOccurrenceId, column)
                 Impact Query 的 resolve 输入端
```

### 3.3 明确不加的东西

| 不加                              | 原因                                                          |
| --------------------------------- | ------------------------------------------------------------- |
| `FieldBinding` 节点类型           | 派生即可；加节点 = 概念通胀起点                               |
| 字段级控制边（`控制列 → 输出列`） | 209119 实测 53.8 倍重复；四份文档硬约束；行集控制天然按写观察 |
| `Effect Graph` 作为存储图         | 它是查询期投影（§6），不是一层存储                            |
| 第四类 subtype                    | 三类之外一律 `UNKNOWN` + 原因码，宁失精度不开口子             |

---

## 4. 契约变更：`TASK_LOCAL_PROJECTION` 1.2.0 → 1.3.0（一次升版）

三项属性**同一次**进契约。任何一项单独 bump 都会让全量缓存多失效一次。

### 4.1 `FIELD_DIRECT` / `FIELD_CONDITIONAL` 新增属性

| 属性                         | 类型                                                   | 说明                                                                             |
| ---------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `sourceReadOccurrenceId`     | `string \| null`                                       | 该输入字段来自本任务哪一次物理读；派生失败为 `null`                              |
| `sourceReadOccurrenceStatus` | `RESOLVED \| AMBIGUOUS \| UNRESOLVED`                  | `AMBIGUOUS`：同表多读次且无法唯一归属（自连接、分区 UNION）                      |
| `sourceRelationId`           | `string`                                               | 表达式所在 relation（`expression.relation_id`），用于分支/作用域判定             |
| `expressionId`               | `string`                                               | 回溯 `field-expression-nodes` 的证据锚点                                         |
| `subtype`                    | `IDENTITY \| TRANSFORMATION \| AGGREGATION \| UNKNOWN` | 类型已在 `TaskLocalDirectSubtype`，1.3.0 起要求非 `UNKNOWN` 或附 `subtypeReason` |
| `subtypeReason`              | `string?`                                              | 仅 `UNKNOWN` 时必填（§5.2 码表）                                                 |

`FIELD_CONDITIONAL` 的 `subtype` 保持 `CONDITIONAL`，其余新属性同样必填。

### 4.2 `DATASET_CONTROL` 新增属性

| 属性                                 | 类型                                             | 说明                                                      |
| ------------------------------------ | ------------------------------------------------ | --------------------------------------------------------- |
| `joinType`                           | `INNER \| LEFT \| RIGHT \| FULL \| CROSS \| N/A` | 仅 `subtype = JOIN` 时非 `N/A`；来自 `relation.join_type` |
| `controlSide`                        | `LEFT \| RIGHT \| BOTH \| N/A`                   | 该控制列位于 join 的哪一侧；FILTER/GROUP_BY 为 `N/A`      |
| `leftRelationId` / `rightRelationId` | `string?`                                        | 仅 JOIN；来自 `relation.left / right`                     |

### 4.3 `localClosure.localFieldPaths`

当前 176827 为空数组（1.2.0 未填）。1.3.0 不扩展其语义，但要求：有 `task-local-materializations` 桥接时必须填 `materializationBridgeIds`；无桥接而字段来源是任务内临时表时，产 gap（§5.4）。

### 4.4 校验规则（`validateTaskLocalProjection` 新增）

1. 1.3.0 的字段边缺任一新属性 → 校验失败
2. `subtype = UNKNOWN` 且无 `subtypeReason` → 失败
3. `subtype = JOIN` 且 `joinType = N/A` → 失败
4. 仍然拒绝：跨任务边、`affectedRootFields`、`rowsetControls`、任何 `控制列 → 输出列` 的字段级边
5. 1.2.0 投影继续可读（legacy），但 Impact Query 对 1.2.0 输入直接返回 `CONTRACT_TOO_OLD` gap，不降级猜测

### 4.5 成本声明

`projectionContentHash` 变化 → 已缓存投影**全部失效一次**。186 任务分钟级；全库 13.7k 任务小时级。这是排期项，不是技术风险；**所以只允许升一次版**。

---

## 5. Phase 1：三项派生 + 一个具名断链

### 5.1 FE-1 `sourceReadOccurrenceId` 派生

原料：`field-expression-nodes.input_fields[].(table, column)`、`expression.relation_id`、`relation-nodes` / `relation-edges`（relation 树）、`dataset-io.read_occurrences[]`。

```text
for each FieldEdge (expression E, input field (T, C)):
  S := relation 子树(E.relation_id) 内所有 relation_type = read 且 physical table = T 的 relation
  R := S 对应的 read_occurrence_id 集合
  |R| = 1  → RESOLVED, sourceReadOccurrenceId = R[0]
  |R| > 1  → 尝试用 qualifier（别名）收窄：若 E 的输入引用带 qualifier 且唯一命中 → RESOLVED
             否则 AMBIGUOUS, sourceReadOccurrenceId = null, gap FIELD_SOURCE_READ_OCCURRENCE_AMBIGUOUS
  |R| = 0  → UNRESOLVED（CTE 作用域映射失败等），gap FIELD_SOURCE_READ_OCCURRENCE_UNRESOLVED
```

复用 `scripts/plans/read-occurrence-resolver.ts` 的 relation 树遍历与既有 `READ_OCCURRENCE_*` 原因码，不另写一套。**禁止**在 `|R| > 1` 时取第一个。

### 5.2 FE-2 `subtype` 三分类（硬规则）

| 判定             | 规则                                                                       | 例                                           |
| ---------------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| `IDENTITY`       | 表达式为**裸列引用**，允许别名、允许 `AS`                                  | `a.price`, `price AS pric`                   |
| `AGGREGATION`    | 表达式含聚合函数，或所在 relation 为 aggregate/GROUP BY 上下文             | `sum(price)`, `count(1)`, `max(dt)`          |
| `TRANSFORMATION` | 其余一切**有物理输入**的表达式：函数包裹、算术、CAST、COALESCE、字符串拼接 | `cast(a as decimal)`, `a*b`, `coalesce(a,0)` |
| `UNKNOWN`        | 仅当上述均判不出，**必附** `subtypeReason`                                 | 见下表                                       |

`subtypeReason` 码表：

| 码                              | 含义                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `EXPRESSION_TEXT_UNPARSEABLE`   | 表达式文本无法分类                                                                                               |
| `MIXED_ROLE_COLUMN`             | 同一输入列既在值表达式又在条件里，且无法拆分（WP-11 原登记项）                                                   |
| `WINDOW_CONTEXT_ONLY`           | 输入列仅出现在 `PARTITION BY / ORDER BY`，**不进值流**（此时应无 FIELD_DIRECT 边；若已有，标此码并在 FE-2 修掉） |
| `INPUT_DEPENDENCY_NOT_PHYSICAL` | `input_dependency_status ≠ PHYSICAL`                                                                             |

两条边界：

- **CONSTANT 不生源边**：`select 'Y' as flag` 无输入字段，不产生 `FIELD_DIRECT`；若历史投影有，1.3.0 删除。
- **CASE/IF 走 `FIELD_CONDITIONAL`**：分支选择列已在 201 条 `FIELD_CONDITIONAL` 里，值分支列按上表分类，不合并为一类。

完成定义附带一个**分布留档**：176827 的 57 列、四锚点全部输出列的 subtype 分布写入 `artifacts/…/field-subtype-distribution.json`。这不是 KPI，是让 §9 止损判定有数。

### 5.3 FE-3 `DATASET_CONTROL` 补 `joinType / controlSide`

原料：`relation-nodes` 中 `relation_type = join` 的 `join_type`、`left`、`right`、`condition_columns[].qualifier / physical`。

```text
for each DATASET_CONTROL(subtype = JOIN, relationId = J):
  joinType := upper(J.relation.join_type)
  controlSide :=
    控制列的物理表只出现在 J.left 子树   → LEFT
    只出现在 J.right 子树               → RIGHT
    两侧都出现（自连接）且 qualifier 可判 → 按 qualifier
    否则                                → BOTH, gap CONTROL_SIDE_UNRESOLVED
for FILTER / GROUP_BY: joinType = N/A, controlSide = N/A
```

`grain` 规则不变（`PRESERVE / REDUCE / EXPAND_RISK`）。

### 5.4 临时表断链具名

181058 读 `dm_rsk_n.otc_opt_inr_comp_pal_sum_temp`（7 个字段），writer 在批内但无列 binding——多语句任务内物化未被字段边串起。Phase 1 **不修**，只让它可见：

```text
gap TASK_LOCAL_MATERIALIZATION_FIELD_BREAK
  details { taskId, readOccurrenceId, physicalDataset, columns[], materializationRecords: 0 | n }
```

出现在该任务的 `localClosure` gap 列表与 Impact Query 输出的 `gaps[]`。修复归 WP-4/后续，不在本文件排期。

---

## 6. Phase 2：Impact Query（查询期投影，不落盘）

### 6.1 签名

```text
impactQuery({
  unionRoot,                  // 并集投影目录（tasks/<id>/task-local-projection.json）
  indexPath,                  // union-continuation-index.json
  anchor: { taskId, writeObservationId, outputColumn },
  maxDepth = 3,
  budget: { maxEdges = 5000, maxFrontier = 200 },
  expandCandidates = false    // 默认 CANDIDATE 不递归
}) → ImpactResult
```

### 6.2 算法

```text
1. 起点  anchor 写观察上 outputColumn 的全部 FieldEdge → VALUE 层 0
2. 控制  anchor 写观察上的全部 DATASET_CONTROL（共享，不复制）→ 对每条按 §6.3 计算 scope
3. 递归（深度 d < maxDepth）
   对每条 VALUE 边（及 FIELD_SCOPED 控制列自身的值链）：
     key := (sourceReadOccurrenceId, column)
     若 sourceReadOccurrenceStatus ≠ RESOLVED → gap，停在此分支
     entry := INDEX[consumerTaskId = 当前任务, readOccurrenceId = key.ro]
     若 entry 不存在                     → gap PRODUCER_NOT_PROJECTED（终止表/未采集）
     candidates := entry.candidates
       |candidates| = 1 且 l1Eligible   → CONFIRMED 接续：
           在 producer 投影里取 FieldEdge where writeObservationId = c.wo 且 outputColumn = key.column
           无 → gap PRODUCER_BINDING_NOT_FOUND
           有 → 作为下一层 VALUE，继续
       否则                               → CANDIDATE frontier：
           frontier += { readField: key, candidates[] (每个带 partitionMatchStatus, reasonCode) }
           不递归（除非 expandCandidates = true，且每个候选各自计入预算）
4. 预算  超 maxEdges / maxFrontier / maxDepth → gap TRAVERSAL_BUDGET_EXCEEDED{ which, at }
5. 输出  边集（DAG）+ frontier + gaps；不输出路径列表
```

`needed(hop) = 值列 ∪ 控制列` 的口径沿用架构文档「重跑溯源」节：`FIELD_SCOPED` 的控制列进入递归，`DATASET_SCOPED` 的控制列**只记录、不递归**（其值链属重跑三档的「行决定」消费者，不属本查询）。

### 6.3 scope 计算（第二正交轴，查询期）

输入：某条 VALUE 边 `v`（带 `sourceRelationId`）、同写观察的某条控制边 `c`（带 `subtype / joinType / controlSide / relationId`）。

| 情形                                                                                                                                                         | scope                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `c.subtype = JOIN`，`v.sourceRelationId` 位于 `c` 的**可空侧**子树（LEFT 的 right / RIGHT 的 left / FULL 任一侧）                                            | `FIELD_SCOPED` —— join 键决定该列取值或 NULL     |
| `c.subtype = JOIN`，`v.sourceRelationId` 位于**保留侧**                                                                                                      | `DATASET_SCOPED`，保留 `grain` 提示倍增风险      |
| `c.subtype = JOIN`，`joinType = INNER`                                                                                                                       | `DATASET_SCOPED`，**不得标无关**                 |
| `c.subtype = FILTER / GROUP_BY`                                                                                                                              | `DATASET_SCOPED`                                 |
| `c.relationId` 与 `v.sourceRelationId` 处于**不同 setop 分支**（如 176827 的 `setop.b0` vs `setop.b1`），或 `c` 所在 CTE 子树与 `v` 子树无公共祖先直至写观察 | `SCOPE_DISJOINT`                                 |
| `controlSide = BOTH` 且无法判                                                                                                                                | `DATASET_SCOPED` + gap `CONTROL_SIDE_UNRESOLVED` |

硬规则：

- **判别式不是「控制列与该列 VALUE 闭包是否相交」**——交集为空不等于无影响。
- **`SCOPE_DISJOINT` 只能由可证明的作用域不相交产生，禁止由「没找到路径」产生。**
- `FIELD_SCOPED` 的控制条目类型仍是 CONTROL，不改标 VALUE。

### 6.4 输出契约（`FIELD_IMPACT_RESULT` 1.0.0）

```json
{
  "artifactType": "FIELD_IMPACT_RESULT",
  "schemaVersion": "1.0.0",
  "anchor": {
    "taskId": "176827",
    "writeObservationId": "write-observation:176827:platform-target:0",
    "outputColumn": "gamma_pct"
  },
  "value": [
    {
      "depth": 0,
      "taskId": "176827",
      "writeObservationId": "…",
      "outputColumn": "gamma_pct",
      "source": {
        "qualifiedName": "pdata_nds.pos_eod_position_view",
        "column": "gamma_pct",
        "readOccurrenceId": "task:176827:…:pepv.read.pos_eod_position_view"
      },
      "subtype": "IDENTITY",
      "evidenceStatus": "CONFIRMED",
      "expressionId": "…"
    }
  ],
  "control": [
    {
      "depth": 0,
      "subtype": "JOIN",
      "joinType": "LEFT",
      "controlSide": "RIGHT",
      "column": {
        "qualifiedName": "pdata_nds.pos_eod_position_view",
        "column": "key_instrument_id"
      },
      "scope": "FIELD_SCOPED",
      "grain": "EXPAND_RISK",
      "relationId": "task:176827:…:setop.b0.join.5"
    }
  ],
  "frontier": [
    {
      "depth": 1,
      "readField": { "readOccurrenceId": "…", "column": "fx_vola" },
      "candidates": [
        {
          "taskId": "…",
          "writeObservationId": "…",
          "partitionMatchStatus": "UNKNOWN",
          "reasonCode": "WRITER_PARTITION_UNKNOWN"
        }
      ],
      "reasonCode": "MULTI_WRITER_CANDIDATE_FRONTIER"
    }
  ],
  "gaps": [
    { "gapId": "…", "reasonCode": "PRODUCER_NOT_PROJECTED", "details": {} }
  ],
  "budget": { "maxDepth": 3, "edgesVisited": 0, "exhausted": false }
}
```

`value / control / frontier / gaps` 四栏就是 UI 的呈现契约：**不画一张箭头图，画 Confirmed / Candidate / Gap 三栏。**

### 6.5 gap 码表（本 WP 新增；INDEX 既有码原样透传）

| 码                                        | 层         | 含义                                          |
| ----------------------------------------- | ---------- | --------------------------------------------- |
| `FIELD_SOURCE_READ_OCCURRENCE_AMBIGUOUS`  | Phase 1    | 同表多读次无法唯一归属                        |
| `FIELD_SOURCE_READ_OCCURRENCE_UNRESOLVED` | Phase 1    | relation 树内找不到该表的读                   |
| `FIELD_SUBTYPE_UNKNOWN`                   | Phase 1    | 附 `subtypeReason`                            |
| `CONTROL_SIDE_UNRESOLVED`                 | Phase 1    | 自连接等无法判侧                              |
| `TASK_LOCAL_MATERIALIZATION_FIELD_BREAK`  | Phase 1    | 任务内临时表字段链断                          |
| `PRODUCER_NOT_PROJECTED`                  | Phase 2    | INDEX 无条目：终止表 / 未采集 / SCHEDULE_ONLY |
| `PRODUCER_BINDING_NOT_FOUND`              | Phase 2    | writer 在并集内但该列无 RESOLVED binding      |
| `MULTI_WRITER_CANDIDATE_FRONTIER`         | Phase 2    | 候选 > 1 或 `l1Eligible = false`，停止递归    |
| `WRITER_PARTITION_UNKNOWN` 等             | INDEX 透传 | 不改写                                        |
| `TRAVERSAL_BUDGET_EXCEEDED`               | Phase 2    | 深度/边数/frontier 超限                       |
| `CONTRACT_TOO_OLD`                        | Phase 2    | 输入投影 < 1.3.0                              |

---

## 7. 验收：五个真数据 case（FE-6 冻结为 golden）

期望值在 FE-1…FE-3 跑完真数据后冻结；本节写**不变量**，不写猜测的具体边数。全部取自 `176827`（`dm_rsk_n.otc_opt_greek_val_det_h`）与 `181058`。

### Case A 单源 IDENTITY + UNION 分支不相交

- 锚点：`176827.pric ← pdata_n.t98_sb_tit_day_hold_indx.pric`（位于 `setop.b1`，b1 内均为 INNER JOIN）
- 不变量：
  - `value[0].subtype = IDENTITY`，`sourceReadOccurrenceStatus = RESOLVED`
  - b1 的 FILTER（`m.filter`、`c.filter`、`rb.filter`）与两处 INNER JOIN 键 → `DATASET_SCOPED`
  - **b0 的全部控制边（LEFT 链 `join.3…join.12`、`ko_barrier.filter` 等）→ `SCOPE_DISJOINT`**，且必须由 setop 分支判据产生，不得由「无路径」产生
  - 两跳：`t98_sb_tit_day_hold_indx` 在批内有 2 个 writer → 除非 INDEX 唯一且 `l1Eligible`，否则进入 frontier

### Case B 高 fan-in 跨分支

- 锚点：`176827.gamma`（7 源：b0 `pos_eod_position_view.gamma` + 日期条件列；b1 `t98_sb_tit_day_hold_indx.gamma`）
- 不变量：
  - `value[]` 按 `sourceRelationId` 可区分 b0 / b1 两组
  - 日期类输入（`erly_trmt_date`、`end_prcg_date`、`trgr_date`、`trgr_line_date`、`src_busi_date`）出现在 `FIELD_CONDITIONAL` 或 `TRANSFORMATION`，**不得**被标 `IDENTITY`
  - 至少一条 `IDENTITY` 或 `TRANSFORMATION` 值边指向 `pos_eod_position_view.gamma`
  - `pos_eod_position_view` 单 writer → 若 INDEX `l1Eligible` 则出现 depth 1 的 CONFIRMED 接续

### Case C LEFT JOIN 侧别（同一 join 对两列结论不同）

- join：`task:176827:statement:0:relation:root.casttable.setop.b0.join.5`，`joinType = LEFT`，right = `pepv.project`（`pdata_nds.pos_eod_position_view`）
- 列 1：`gamma_pct ← pos_eod_position_view.gamma_pct`（可空侧）→ join.5 的键（`key_instrument_id`、`key_book_id`、`src_busi_date`、`t98_sb_otc_opt_sub_trd_prcg_indx.busi_date / src_prd_id`、`t98_sb_otc_opt_comp_info.book_agt_id`）对该列 **`FIELD_SCOPED`**
- 列 2：`nom ← pdata_n.t03_otc_opt_comp_sub_trd_info.prin`（保留侧，b0 基表）→ 同一批键对该列 **`DATASET_SCOPED`**，`grain = EXPAND_RISK`
- 不变量：同一 `relationId` 的控制条目在两个查询里 scope 不同；类型均为 CONTROL

### Case D 多 writer 必须是 CANDIDATE

- 锚点：`176827.vola ← pdata_n.t98_sb_otc_opt_sub_trd_prcg_indx.fx_vola`；该表批内 **7 个 writer**
- 不变量：
  - 若 INDEX 该读次 `candidates.length > 1` 或 `l1Eligible = false` → `frontier[]` 有条目，`reasonCode = MULTI_WRITER_CANDIDATE_FRONTIER`，每个候选带 `partitionMatchStatus`
  - `value[]` 中**不得**出现 depth ≥ 1 的该分支边（默认不递归）
  - `expandCandidates = true` 时每个候选各计预算，结果标 `evidenceStatus = CANDIDATE`

### Case E 临时表断链具名

- 锚点：`181058` 任一来自 `dm_rsk_n.otc_opt_inr_comp_pal_sum_temp` 的输出列（7 个输入字段之一）
- 不变量：`gaps[]` 含 `TASK_LOCAL_MATERIALIZATION_FIELD_BREAK`，`details.columns` 非空；不出现假的 `PRODUCER_NOT_PROJECTED`

### 金样位置与运行

```text
tests/fixtures/field-evidence-v1/<case>/expected.json
npm run test:field-evidence          # 需 sibling sql-static-lineage-data/field-facts；缺则 skip
FIELD_EVIDENCE_GOLDEN_REQUIRED=1     # CI 挂载数据包时 fail closed，与 TASK_LOCAL_GOLDEN_REQUIRED 同规则
```

---

## 8. 存储与规模约束

### 8.1 物化边界（对表决策，不再逐案争论）

| 产物                         | 规模                                    | 物化                     |
| ---------------------------- | --------------------------------------- | ------------------------ |
| 任务局部投影                 | O(任务)                                 | 是                       |
| INDEX                        | O(读次 × 候选)，实测候选均值 1.33       | 是                       |
| `FIELD_DIRECT / CONDITIONAL` | O(表达式输入引用)，实测 49/任务         | 是                       |
| `DATASET_CONTROL`            | O(写观察 × 控制列)                      | 是                       |
| 字段级控制边                 | O(控制列 × 输出列) / 写观察 —— 笛卡尔积 | **否**                   |
| Impact Graph / 多跳闭包      | 传递闭包                                | **否**                   |
| 路径列表                     | 组合爆炸                                | **否**（呈现层按需展开） |

原则：**只物化线性规模、按单元可增量重建、内容哈希可缓存的投影；永不物化传递闭包或笛卡尔积。**

### 8.2 全库外推（13,740 任务 ≈ 64×）

| 产物                           | 现在    | 外推    |
| ------------------------------ | ------- | ------- |
| 投影                           | 10.4 MB | ~670 MB |
| `FIELD_DIRECT`                 | 9,070   | ~58 万  |
| `PHYSICAL_FIELD`（并集去重后） | 4,683   | ~30 万  |
| INDEX 条目                     | 535     | ~3.5 万 |

推论（全库前必做，非本 WP 排期）：并集不能单体 `JSON.parse` 合并；需按任务分片 + `(qualifiedName, column) → FieldEdge[]` 与 `bindingId → FieldEdge[]` 反向索引。本 WP 的 Impact Query 实现**必须通过一个 `FieldEdgeIndex` 接口读边**，不得直接遍历数组，以便后续替换存储而不改查询。

### 8.3 查询期爆炸控制

实测参数：fan-in 2～8 × 候选 ≤ 10 × 深度 3 → 无剪枝可达 ~2.5 万路径/列。控制手段即 §6.1 的 `budget`、§6.2 的「CANDIDATE 不递归」、§6.5 的 `TRAVERSAL_BUDGET_EXCEEDED`。**超限具名，不静默截断。**

---

## 9. 止损条件（反自嗨机制）

Phase 2 跑完后，对 176827 选定的高价值前 10 列（Greek 类：`gamma / delta / vega / theta / *_base / gamma_pct / npv_base / net_now_val / now_vall / vola`）统计：

```text
confirmedTwoHopRatio := 深度 1 存在 CONFIRMED 接续的列数 / 10
dominantGap          := frontier + gaps 中占比最高的 reasonCode
```

| 结果                                                                                     | 动作                                                                        |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `confirmedTwoHopRatio ≥ 0.5`                                                             | 进入 Phase 3                                                                |
| `< 0.5` 且 `dominantGap ∈ { WRITER_PARTITION_UNKNOWN, MULTI_WRITER_CANDIDATE_FRONTIER }` | **冻结本 WP 一切概念工作，回修 WP-8 分区匹配**；本文件状态改为「等待 WP-8」 |
| `< 0.5` 且 `dominantGap = PRODUCER_NOT_PROJECTED`                                        | 是采集广度问题，回 GC-0 步骤 ③ 补采，不动模型                               |
| `< 0.5` 且 `dominantGap ∈ Phase 1 码`                                                    | 是派生质量问题，修 FE-1…FE-3，不加概念                                      |

没有可量化的失败判据，任何阶段都能被解释成「还差一点」。这条不可删。

---

## 10. Phase 3：CONTROL 的消费价值验证

已有一个肯定答案：`execution-plan-rerun-shrink.md` 的三档（值必达 / 行决定 / 倍增风险）是 CONTROL 的独立消费者，105387 拉链键 `Agt_Modifr` 是真实用例（值链零贡献，却决定下游读到哪些行）。

Phase 3 要验证的缩小为：**除重跑外，指标口径追因是否也需要 CONTROL 分轨。** 方法：拿 176827 一次真实的 Greek 值异常（或构造一次上游 `pos_eod_position_view` 分区缺失），看排查者是否用到了 `control[]` 中 `FIELD_SCOPED` 条目。

| 结果   | 动作                                                             |
| ------ | ---------------------------------------------------------------- |
| 用到   | 保留分轨；此时才允许对外使用「Effect」一类命名                   |
| 没用到 | CONTROL 保留在事实层（零成本），产品层降为内部分类，不宣称差异化 |

---

## 11. 工作包

| 包                      | 内容                                                                                                                                                     | 完成定义                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **FE-0** 契约 1.3.0     | `contract.ts` 新属性、校验规则、legacy 读取；`ids.ts` 边 id 语义键含 `sourceReadOccurrenceId`（AMBIGUOUS 时用 `null` 占位，保证同一表达式两条边不撞 id） | 契约测试绿；1.2.0 投影可读；1.3.0 缺属性拒绝                        |
| **FE-1** 读次派生       | §5.1 算法，复用 `read-occurrence-resolver`                                                                                                               | 四锚点 `RESOLVED` 比例留档；`AMBIGUOUS` 有 gap；无「取第一个」      |
| **FE-2** subtype 三分类 | §5.2 规则 + 码表；删 CONSTANT 源边；window 上下文列不进值流                                                                                              | `field-subtype-distribution.json` 留档；`UNKNOWN` 全部带 reason     |
| **FE-3** 控制侧别       | §5.3；`joinType / controlSide / left / rightRelationId`                                                                                                  | 176827 16 个 join 全部有 `joinType`；`BOTH` 有 gap                  |
| **FE-4** 跨任务 resolve | 只读 INDEX 的 `resolveReadField()`；`FieldEdgeIndex` 接口                                                                                                | 单元测试覆盖：唯一 + l1Eligible / 多候选 / 无条目 / 无 binding 四态 |
| **FE-5** Impact Query   | §6 算法、scope、预算、输出契约                                                                                                                           | 五 case 跑通产出 `FIELD_IMPACT_RESULT`；预算超限具名                |
| **FE-6** 金样冻结       | §7 五 case `expected.json` + `npm run test:field-evidence`                                                                                               | 缺数据 skip；`FIELD_EVIDENCE_GOLDEN_REQUIRED=1` fail closed         |
| **FE-7** 止损判定       | §9 统计脚本 `npm run field-evidence:stop-loss`                                                                                                           | 输出 `confirmedTwoHopRatio / dominantGap / decision`                |
| **FE-8** 文档回写       | 在 `execution-plan-asset-graph.md` WP-11 行、`domain-asset-graph-architecture.md` WP 状态表**各改一行**指向本文件                                        | 仅状态行，不改正文                                                  |

领取顺序：FE-0 → FE-1 → FE-2 → FE-3（可并行 FE-1/2/3 的派生逻辑，但**同一 PR 合入**以满足一次升版）→ FE-4 → FE-5 → FE-6 → FE-7 → 按 §9 决定。

---

## 12. 硬约束（与既有文档一致，本文件重申并新增）

1. 不新增 `TaskLocalNodeType`；`FieldBinding` / `ReadField` 只是派生键。
2. 不生成任何 `控制列 → 输出列` 字段级边；不恢复 `affectedRootFields` / `rowsetControls`。
3. `SCOPE_DISJOINT` 只能由可证明的作用域不相交产生，禁止由「没找到路径」产生。
4. INNER JOIN 对所有输出列 `DATASET_SCOPED`，不得标无关。
5. `sourceReadOccurrenceId` 多候选时禁止取第一个；标 `AMBIGUOUS`。
6. `subtype` 三类之外一律 `UNKNOWN` + reason；不开第四类。
7. CANDIDATE 默认不递归；递归须显式 `expandCandidates` 且计预算。
8. Impact Query 不落盘、不缓存闭包；只允许缓存 `FieldEdgeIndex`。
9. 契约只升一次版（1.3.0）；三项属性同 PR。
10. 不改 WP-8 INDEX 契约；INDEX 的 reasonCode 原样透传。
11. 不改 SQLLens / Plan Facts / Machine Facts 发布器；不动 legacy `field-lineage` 消费者。
12. §9 止损条件不可删、不可放宽。

---

## 13. 明确不做

- 全列覆盖、全链路 100% 字段闭合
- 算子全矩阵（CASE / CAST / COALESCE / WINDOW / ARITHMETIC 各成一类）
- `Effect Graph` 作为存储层或对外命名（Phase 3 前）
- Neo4j / 图数据库、HTML 调查页（列级）
- 并集分片与反向索引的存储实现（记录为全库前必做，非本 WP）
- 临时表断链修复（只具名，不修）
- WP-10 legacy 闭包 KPI 对比

---

## 14. 何时算解决

1. 1.3.0 投影在四锚点穿透批上重投成功，`RESOLVED` 读次比例与 subtype 分布已留档
2. 五个 case 的 `FIELD_IMPACT_RESULT` 与 `expected.json` 一致，且 Case A 的 `SCOPE_DISJOINT`、Case C 的同 join 双 scope、Case D 的 frontier 三个「诚实性」断言绿
3. `field-evidence:stop-loss` 给出明确 decision，并已按 §9 执行（进入 Phase 3 或回修 WP-8）
4. 任何评审者能只凭 `value / control / frontier / gaps` 四栏复述「这个字段怎么来的、什么会让它变、哪里我们不知道」——不需要看图
