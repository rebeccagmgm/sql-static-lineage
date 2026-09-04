## Why

任务局部投影（`TASK_LOCAL_PROJECTION` 1.2.0）已经在四锚点穿透批（186 PROJECTED 任务）上产出 9,070 条 `FIELD_DIRECT`、201 条 `FIELD_CONDITIONAL`、2,204 条 `DATASET_CONTROL`，且锚点输入字段有 246/255 能在批内找到 producer 的同名输出列 binding。字段事实**已经存在**，但还不能回答「这个字段怎么来的、什么会让它变、哪里我们不知道」：

1. 字段边没有读次：`FIELD_DIRECT` 起点是全局 `(表, 列)`，接不上按读次键控的 `UNION_CONTINUATION_INDEX`，字段级悄悄退回了第一代 `column → column` 模型。
2. 值边没有语义：`subtype` 100% `UNKNOWN`，`select a`、`sum(a)`、`a*b` 同形。
3. 控制没有侧别：JOIN/FILTER 事实齐全，但缺 `joinType / controlSide`，无法按列判定 `FIELD_SCOPED / DATASET_SCOPED`。
4. 多 writer 是常态（7～10 个），产品若只画确定线会「看起来很空」；需要一个诚实呈现 CANDIDATE 与 gap 的查询契约。

`docs/execution-plan-field-evidence-v1.md` 已完成方案；本 change 把它拆成可执行任务。

## What Changes

- **契约 1.2.0 → 1.3.0（一次升版）**：`FIELD_DIRECT / FIELD_CONDITIONAL` 增加 `sourceReadOccurrenceId`、`sourceReadOccurrenceStatus`、`sourceRelationId`、`expressionId`、`subtypeReason`；`DATASET_CONTROL` 增加 `joinType`、`controlSide`、`leftRelationId`、`rightRelationId`。校验拒绝缺属性的 1.3.0 投影；1.2.0 继续可读。
- **Phase 1 三项派生**：读次派生（复用 relation 树，多候选 fail-closed 标 `AMBIGUOUS`）；`subtype` 三分类硬规则（IDENTITY / TRANSFORMATION / AGGREGATION，其余 `UNKNOWN` + 原因码）；JOIN 侧别派生（原料 `relation-nodes.join_type / left / right`）。任务内临时表字段断链以 `TASK_LOCAL_MATERIALIZATION_FIELD_BREAK` 具名，不修。
- **Phase 2 Impact Query**（查询期投影，不落盘）：从锚点写观察的某输出列出发，经 INDEX 解析 producer 写观察，只对唯一且 `l1Eligible` 的接续递归；多候选进入 frontier 不递归；控制边按列在查询期标注 scope；输出 `FIELD_IMPACT_RESULT`（`value / control / frontier / gaps / budget`）。
- **五个真数据金样**（176827 / 181058）+ **止损脚本**（`confirmedTwoHopRatio`、`dominantGap` → 决策）。
- **不做**：新节点类型、字段级控制边、Impact Graph 物化、算子全矩阵、Neo4j、HTML、修改 INDEX 契约、修改 SQLLens / Facts 发布器、修改 legacy `field-lineage` 消费者。

## Capabilities

### New Capabilities

- `field-evidence-v1`: 字段证据链查询——跨任务 `ReadField → 写观察 → FieldBinding` 解析、查询期 scope 标注、CANDIDATE frontier、预算与 gap 码表、`FIELD_IMPACT_RESULT` 输出契约、止损判定。

### Modified Capabilities

- `task-local-graph-projection`: `TASK_LOCAL_PROJECTION` 1.3.0 要求字段边携带读次/表达式/relation 出处与非 `UNKNOWN` 或带原因码的 `subtype`；`DATASET_CONTROL` 携带 JOIN 类型与侧别；校验规则相应收紧。

## Impact

- `scripts/project-graph/task-local/contract.ts`、`ids.ts`、`project-task-local.ts`：契约、边 id 语义键、字段/控制边发射。
- `scripts/reconcile/shared/dataset-controls.ts`：控制记录暴露 `joinType / left / right`（`joinGrain` 已读 `join_type`，只需透出）。
- 新增 `scripts/project-graph/field-evidence-v1/`：读次派生、subtype 分类、侧别派生、`FieldEdgeIndex`、`resolveReadField`、`impactQuery`、`FIELD_IMPACT_RESULT` 契约、CLI、止损脚本。
- 新增 `tests/project-graph/field-evidence-v1/` 与 `tests/fixtures/field-evidence-v1/`；`package.json` 新增 `test:field-evidence`、`field-evidence:impact`、`field-evidence:stop-loss`。
- 全量投影缓存因 `projectionContentHash` 变化失效一次（排期项，非风险）。
- 不改 `scripts/data-graph`（INDEX 只读消费）；不改 `openspec/changes/field-evidence-graph-projection`（那是基于 legacy `FIELD_MULTI_HOP_RECONCILIATION` 的 Phase 2，本 change 基于任务局部投影 + INDEX，二者互不替代）。
