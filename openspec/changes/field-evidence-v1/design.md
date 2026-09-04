## Context

动机见 `proposal.md - Why`；完整方案见 `docs/execution-plan-field-evidence-v1.md`。本文件只记录实现层面的选择。

现状约束（2026-09-04 真数据实测）：

- 字段边发射在 `scripts/project-graph/task-local/project-task-local.ts` 第 780–871 行：按 `resolvedBindings` 遍历，`taskLocalSourceFieldsForExpression()` 给出 `PhysicalFieldIdentity[]`（只有表、列、身份状态），`expandMaterializedField()` 折叠任务内物化，然后 `pushEdge(FIELD_DIRECT, subtype: "UNKNOWN")`。边 id 语义键是 `{outputColumn, sourceColumn, sourceTable}`。
- 控制边发射在同文件 878–915 行，来源 `datasetControlsForStatement()`（`scripts/reconcile/shared/dataset-controls.ts`）；`joinGrain(join_type)` 已读到 `join_type` 但只用来算 `grain`，未透出。
- Facts 侧：`field-expression-nodes.input_fields[]` 只有 `(table, column, field_id)`，无 relation 引用；`expression.relation_id` 指向 project relation；`relation-nodes` join 记录带 `join_type`、`left`、`right`；`relation-edges` 给出树。176827：16 join（inner 6 / left 10），UNION `setop.b0 / b1`。
- `scripts/plans/read-occurrence-resolver.ts` 已有 relation 树遍历与 `READ_OCCURRENCE_*` 原因码。
- INDEX：`scripts/data-graph` 产出的 `union-continuation-index.json`，条目键 `(consumerTaskId, readOccurrenceId)`，候选带 `writeObservationId / l1Eligible / partitionMatchStatus / reasonCode`。本 change 只读。
- 规模：214 任务 10.4 MB 投影、0.9 MB INDEX；全库外推 ~670 MB / ~58 万字段边。

## Goals / Non-Goals

**Goals:**

- 一次契约升版让字段边回到「写观察 × 读次」单位，且 subtype 与 JOIN 侧别可算。
- 一个查询期函数在真数据上产出 `FIELD_IMPACT_RESULT`，四栏（value / control / frontier / gaps）即呈现契约。
- 五个真数据金样 + 一个止损脚本，让「继续 / 停」由数字决定。

**Non-Goals:**

- 不改 `scripts/data-graph`、不改 INDEX 契约。
- 不改 SQLLens / Plan Facts / Machine Facts 发布器；所有派生只读现有 Facts 字段。
- 不实现并集分片存储与反向索引的持久化（只定义 `FieldEdgeIndex` 接口，实现为内存版）。
- 不修临时表断链，只具名。
- 不做 HTML、Neo4j、算子全矩阵。

## Decisions

### D1. 新代码放 `scripts/project-graph/field-evidence-v1/`，不进 `field-lineage/` 也不进 `data-graph`

- 理由：`field-lineage/` 是 legacy 递归树消费者，架构文档已定位为 LEGACY_COMPAT；`data-graph` 是独立仓库。本 change 的输入是任务局部投影 + INDEX，两者都是已发布产物，放在 `project-graph/` 下与 `task-local/` 并列最贴切。
- 备选：扩 `openspec/changes/field-evidence-graph-projection` 的 `scripts/project-graph/field-evidence/`——否决，那套以 `FIELD_MULTI_HOP_RECONCILIATION` legacy 产物为源，root 驱动、快照物化，与本 change 的查询期模型相反；两套并存但目录名区分（`field-evidence` vs `field-evidence-v1`）。

### D2. 读次派生放在投影生产期（Phase 1），不放查询期

- 理由：读次归属只依赖本任务 Facts，是「本任务 SQL 能证明的事」，符合纸条定义；查询期再算会让每次查询重读 Facts。
- 实现：新增 `source-read-occurrence.ts`，输入 `(expression, inputField, relationTree, readOccurrencesByTable)`，输出 `{ status, readOccurrenceId, relationId }`。relation 树用 `relation-edges.jsonl` 建一次索引（`children(relationId)`），与 `read-occurrence-resolver.ts` 共用遍历工具而非复制。
- 物化折叠（`expandMaterializedField`）的情况：折叠后的边 `sourceReadOccurrenceId` 取**最底层物理读**的读次；`materializationBridgeIds` 保留；若底层读无法归属 → `AMBIGUOUS`。

### D3. 边 id 语义键加入 `sourceReadOccurrenceId`（`AMBIGUOUS` 时为 `null` 字面量）

- 理由：同一 `(表, 列, 输出列)` 经两次读到达必须是两条边（spec 场景「Edge identity distinguishes read occurrences」）。`null` 占位保证 AMBIGUOUS 边与 RESOLVED 边不撞 id。
- 后果：所有字段边 id 变化 → 这本身就是升版的一部分，与缓存失效同批发生。`tests/project-graph/task-local/ids.test.ts` 的冻结向量只覆盖节点 id，不受影响；边 id 无冻结向量。

### D4. subtype 分类基于 `expression_text` + `expression_roles` + relation 类型，不引入新解析器

- 规则顺序：① 无 `input_fields` → 不发边（CONSTANT）；② `role`/`expression_roles` 表明只在 window 上下文 → 不发边，记 `WINDOW_CONTEXT_ONLY`；③ 所在 relation 为 aggregate 或文本匹配聚合函数白名单（`sum|count|max|min|avg|collect_set|collect_list|first_value|last_value|percentile.*`，大小写不敏感，词边界）→ `AGGREGATION`；④ 文本去别名后是 `[qualifier.]column` 且 `input_fields.length === 1` → `IDENTITY`；⑤ 其余有物理输入 → `TRANSFORMATION`；⑥ 判不出 → `UNKNOWN` + reason。
- 备选：解析 SQLLens IR 表达式树——否决，本 change 不改 Facts；文本规则对三分类足够，边界一次写死。
- 分布留档：`field-subtype-distribution.json` 按任务与全批统计，作为止损输入之一。

### D5. 控制侧别在 `dataset-controls.ts` 透出，不在投影层重算

- `datasetControlsForStatement()` 返回的记录增加 `joinType`、`leftRelationId`、`rightRelationId`、`controlSide`；`controlSide` 由「控制列的表在 left 子树 / right 子树 / 两侧」判定，qualifier 可判时按 qualifier。
- 理由：`joinGrain` 已在此处读 `join_type`，同源同处；legacy `field-lineage` 消费者也用这个函数，透出新字段对它是加性、无破坏。

### D6. `FieldEdgeIndex` 接口先行，内存实现

```ts
interface FieldEdgeIndex {
  byReadField(taskId, readOccurrenceId, column): FieldEdgeRef[]; // 消费者侧
  byBinding(taskId, writeObservationId, outputColumn): FieldEdgeRef[]; // 生产者侧
  controlsOf(taskId, writeObservationId): ControlEdgeRef[];
  relationTree(taskId): RelationTree;
  schemaVersion(taskId): string;
}
```

- 理由：§8.2 全库外推要求未来可换分片/磁盘索引；查询实现不得直接遍历 `edges[]`。
- 内存版按需懒加载每任务投影文件，不一次性合并。

### D7. scope 在查询期计算，输入是 relation 树 + `sourceRelationId` + 控制边属性

- 判定顺序：① `subtype ≠ JOIN` → `DATASET_SCOPED`；② 控制 `relationId` 与值 `sourceRelationId` 在同一 setop 的不同子分支 → `SCOPE_DISJOINT`；③ `joinType = INNER` → `DATASET_SCOPED`；④ 值 relation 在可空侧子树（LEFT→right，RIGHT→left，FULL→任一）→ `FIELD_SCOPED`；⑤ 值 relation 在保留侧 → `DATASET_SCOPED`；⑥ 无法定位 → `DATASET_SCOPED` + gap `CONTROL_SIDE_UNRESOLVED`。
- **禁止**用「控制列与值闭包相交」判定；**禁止**由「找不到路径」产生 `SCOPE_DISJOINT`。
- CTE 作用域不相交（`c` 所在 CTE 子树与 `v` 子树无公共祖先直至写观察）作为 ② 的补充条件，同样必须由树结构证明。

### D8. 递归策略：CONFIRMED 才递归，CANDIDATE 进 frontier

- INDEX 条目 `candidates.length === 1 && l1Eligible` → 递归；否则 frontier。
- `expandCandidates = true` 时每候选独立递归、结果标 `CANDIDATE`、各计预算。
- `FIELD_SCOPED` 控制列进入递归（其值链），`DATASET_SCOPED / SCOPE_DISJOINT` 不递归。
- 返回边集 + frontier + gaps，不返回路径。

### D9. 金样用真 Facts，期望值在 Phase 1 跑完后冻结

- 期望文件 `tests/fixtures/field-evidence-v1/<case>/expected.json`，写不变量断言（subtype、scope、frontier 存在性、gap 码），不写具体边数。
- 与 `TASK_LOCAL_GOLDEN_*` 同机制：缺 sibling `sql-static-lineage-data/field-facts` 则 skip；`FIELD_EVIDENCE_GOLDEN_REQUIRED=1` 时 fail closed。
- 五 case：A `176827.pric`（b1、IDENTITY、b0 控制 SCOPE_DISJOINT）；B `176827.gamma`（跨分支 fan-in）；C `join.5` 对 `gamma_pct` FIELD_SCOPED / 对 `nom` DATASET_SCOPED；D `176827.vola`（7 writer → frontier）；E `181058` 临时表断链 gap。

### D10. 一次升版、一个 PR

- FE-0…FE-3 的契约、发射、校验改动在同一 PR 合入并统一 bump 到 1.3.0；不允许先合 `sourceReadOccurrenceId` 再合 `subtype`。
- 升版后四锚点穿透批需重投一次（`--no-cache` 或清缓存），产物作为 FE-6 金样的输入快照。

## Risks / Trade-offs

- [读次派生对 CTE 多层引用误判] → 复用 `read-occurrence-resolver` 的 CTE 作用域映射；判不出一律 `UNRESOLVED`，不猜；FE-1 完成定义要求四锚点 `RESOLVED` 比例留档。
- [subtype 文本规则把 UDF 或复杂 CASE 归 TRANSFORMATION 而非更细类] → 这是有意的精度损失；三类之外不开口子；`FIELD_CONDITIONAL` 已单独承载 CASE 分支列。
- [边 id 全变导致下游 data-graph 并集比对失效] → data-graph 并集 merge 按节点 id 去重、边按 id 合并；1.3.0 投影与 1.2.0 投影不混入同一并集，INDEX 需在升版后重建（一次性）。
- [INDEX 多候选普遍 → 两跳大多进 frontier] → 这是 §9 止损要测的事实，不是本 change 要绕过的事实；若发生则决策 `FREEZE_AND_FIX_WP8`。
- [查询期递归在 fan-in × 候选下爆炸] → 默认 CANDIDATE 不递归；`maxDepth=3 / maxEdges=5000 / maxFrontier=200`；超限具名。
- [`dataset-controls.ts` 改动波及 legacy field-lineage 测试] → 只加字段不改现有字段；`npm run test:field-lineage` 作为回归门。
- [全量缓存失效的重投成本] → 一次升版；四锚点批分钟级；全库重投不在本 change 排期。

## Migration Plan

1. 合入 FE-0…FE-3（一个 PR，契约 1.3.0）。
2. 清四锚点批缓存，重跑 `npm run project-task-local -- --task-ids 181058,176827,209119,155015 --expand-upstream …`，确认 186 PROJECTED 且 `subtype ≠ UNKNOWN` 比例与 `RESOLVED` 比例留档。
3. 在 data-graph 用 1.3.0 投影重建 INDEX（现有 CLI，不改）。
4. 合入 FE-4…FE-6，跑 `npm run test:field-evidence`，冻结 `expected.json`。
5. 跑 `npm run field-evidence:stop-loss`，按决策进入 Phase 3 或回修 WP-8。
6. 回滚：1.2.0 投影仍可读；删除 `field-evidence-v1/` 目录与 `package.json` 三个脚本即恢复；INDEX 可用旧投影重建。

## Open Questions

- `expression_roles` 在真 Facts 中对 window 上下文列的标注覆盖率——若不足，`WINDOW_CONTEXT_ONLY` 的判定改为「`window_spec.input_bindings` 中出现且 `expression_text` 主体不含该列」；不改 spec，只改 D4 第 ② 步实现。
- 止损脚本的高价值列清单是否需要按锚点各配一份——当前只配 176827 的 10 列；其他锚点在 Phase 3 决定后追加，不影响本 change 任务拆分。
