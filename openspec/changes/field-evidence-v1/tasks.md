## 1. FE-0 契约 1.3.0（与 §2–§4 同一 PR 合入）

- [ ] 1.1 `scripts/project-graph/task-local/contract.ts`：新增 `TASK_LOCAL_PROJECTION_SCHEMA_VERSION = "1.3.0"`，把 `"1.2.0"` 与 `"1.1.0"` 归入 legacy 版本联合类型；导出 `TaskLocalSourceReadOccurrenceStatus`、`TaskLocalSubtypeReason`、`TaskLocalJoinType`、`TaskLocalControlSide` 类型与 `TaskLocalProjectionGap { gapId, reasonCode, details }`；`TaskLocalProjection` 增加 `gaps: readonly TaskLocalProjectionGap[]`（1.3.0 必填，legacy 可缺省为空）。
- [ ] 1.2 `contract.ts` `validateTaskLocalProjection`：仅当 `schemaVersion === "1.3.0"` 时，字段边缺 `sourceReadOccurrenceStatus | sourceRelationId | expressionId` → 抛类型化契约错误；`subtype === "UNKNOWN"` 且无 `subtypeReason` → 抛；`DATASET_CONTROL.subtype === "JOIN"` 且 `joinType === "N/A"` → 抛；任何 `FIELD_*` 边的 `toNodeId` 不是 `TARGET_WRITE` → 抛（防止字段级控制边）。保留既有 `affectedRootFields / rowsetControls / 跨任务边` 拒绝。
- [ ] 1.3 `scripts/project-graph/task-local/ids.ts`：不改节点 id 函数；在 `project-task-local.ts` 字段边 `semanticKey` 中加入 `sourceReadOccurrenceId`（`AMBIGUOUS/UNRESOLVED` 时为 `null`）与 `expressionId`。
- [ ] 1.4 `tests/project-graph/task-local/contract.test.ts`：新增 1.3.0 校验用例——缺属性拒绝、`UNKNOWN` 无 reason 拒绝、`JOIN` 无 `joinType` 拒绝、1.2.0 投影仍通过 legacy 校验；`ids.test.ts` 冻结节点向量不变。

## 2. FE-1 读次派生（`sourceReadOccurrenceId`）

- [ ] 2.1 新建 `scripts/project-graph/field-evidence-v1/relation-tree.ts`：从 `relation-nodes.jsonl` + `relation-edges.jsonl` 构建 `RelationTree { parent(id), children(id), subtreeReads(id): ReadRelation[], setopBranchOf(id): { setopId, branchIndex } | null, isNullableSide(joinId, relationId) }`；复用 `scripts/plans/read-occurrence-resolver.ts` 的 relation 遍历工具，不复制其代码。
- [ ] 2.2 新建 `scripts/project-graph/field-evidence-v1/source-read-occurrence.ts`：`resolveSourceReadOccurrence({ expression, inputField, tree, readOccurrencesByTable })` → `{ status: RESOLVED|AMBIGUOUS|UNRESOLVED, readOccurrenceId, relationId, reasonCode? }`；`|R|>1` 时按输入引用 qualifier 收窄，收窄失败即 `AMBIGUOUS`，**禁止取第一个**。
- [ ] 2.3 `project-task-local.ts` 第 780–871 行：字段边循环对每个 `source.field` 调用 2.2；`expandMaterializedField` 折叠路径取最底层物理读的结果；边 `properties` 写入 `sourceReadOccurrenceId / sourceReadOccurrenceStatus / sourceRelationId(=expression.relation_id) / expressionId`；`AMBIGUOUS/UNRESOLVED` 追加 `gaps[]` 条目 `FIELD_SOURCE_READ_OCCURRENCE_AMBIGUOUS | FIELD_SOURCE_READ_OCCURRENCE_UNRESOLVED`。`FIELD_CONDITIONAL` 同样处理。
- [ ] 2.4 `tests/project-graph/field-evidence-v1/source-read-occurrence.test.ts`：合成 Facts 覆盖——单读 RESOLVED；自连接无 qualifier → AMBIGUOUS；自连接带 qualifier → RESOLVED；CTE 内读 → 归属正确；物化折叠取底层读；同 `(表,列,输出列)` 两读次产两条边（id 不同）。

## 3. FE-2 subtype 三分类

- [ ] 3.1 新建 `scripts/project-graph/field-evidence-v1/subtype-classifier.ts`：`classifyDirectSubtype({ expression, inputFields, relationType }) → { subtype, subtypeReason? , emitEdge: boolean }`，按 design D4 顺序：无输入 → `emitEdge=false`（CONSTANT）；仅 window 上下文 → `emitEdge=false` + `WINDOW_CONTEXT_ONLY`；聚合白名单（词边界、大小写不敏感）或 aggregate relation → `AGGREGATION`；去别名后 `^[\w]+(\.[\w]+)?$` 且单输入 → `IDENTITY`；其余有物理输入 → `TRANSFORMATION`；`input_dependency_status ≠ PHYSICAL` → `UNKNOWN` + `INPUT_DEPENDENCY_NOT_PHYSICAL`；兜底 `UNKNOWN` + `EXPRESSION_TEXT_UNPARSEABLE`。
- [ ] 3.2 `project-task-local.ts`：`FIELD_DIRECT` 发射前调用 3.1；`emitEdge=false` 不发边；写入 `subtype` 与可选 `subtypeReason`；`UNKNOWN` 追加 `gaps[]` `FIELD_SUBTYPE_UNKNOWN{ expressionId, subtypeReason }`。
- [ ] 3.3 `tests/project-graph/field-evidence-v1/subtype-classifier.test.ts`：`t.npv as npv_base` → IDENTITY；`cast(a.price as decimal(18,6))` → TRANSFORMATION；`coalesce(a,0)` → TRANSFORMATION；`sum(price)` → AGGREGATION；`'Y' as flag` → 不发边；`row_number() over (partition by prd_id order by dt)` 的 `prd_id/dt` → 不发边 + `WINDOW_CONTEXT_ONLY`；`a.x + b.y` 双输入 → TRANSFORMATION（不得 IDENTITY）。
- [ ] 3.4 新建 `scripts/project-graph/field-evidence-v1/subtype-distribution-cli.ts` + `package.json` 脚本 `field-evidence:subtype-distribution`：读投影目录，输出 `field-subtype-distribution.json`（全批 + 每任务 + 四锚点各输出列 subtype 计数与 `UNKNOWN` 原因分布）。

## 4. FE-3 控制侧别（`joinType / controlSide`）

- [ ] 4.1 `scripts/reconcile/shared/dataset-controls.ts`：`DatasetControlAnnotation`（或 `datasetControlsForStatement` 返回项）增加 `joinType: "INNER"|"LEFT"|"RIGHT"|"FULL"|"CROSS"|"N/A"`、`leftRelationId`、`rightRelationId`、`controlSide: "LEFT"|"RIGHT"|"BOTH"|"N/A"`；`joinType` 由 `join_type` 大写归一（`inner`→`INNER`，`left`/`left outer`→`LEFT` …）；`controlSide` 由控制列的表在 `left`/`right` 子树判定，qualifier 可判时按 qualifier，两侧皆有且不可判 → `BOTH`。非 JOIN 一律 `N/A`。只加字段，不改既有字段与 `grain` 逻辑。
- [ ] 4.2 `project-task-local.ts` 第 898–915 行：`DATASET_CONTROL.properties` 写入 4.1 四个字段；`controlSide === "BOTH"` 追加 `gaps[]` `CONTROL_SIDE_UNRESOLVED{ relationId, column }`。
- [ ] 4.3 `tests/reconcile/shared/dataset-controls.test.ts` 追加：LEFT JOIN 右表键 → `LEFT / RIGHT`；INNER → `INNER / LEFT|RIGHT`；自连接同表两侧 → `BOTH`；FILTER → `N/A / N/A`。`npm run test:field-lineage` 保持全绿（legacy 消费者只多字段）。

## 5. FE-1' 临时表断链具名

- [ ] 5.1 `project-task-local.ts`：在字段边循环中，若 `source.field.qualifiedName` 命中本任务 `writeRecords` 中非 final 的写（`isTempLikeTableName` 或非 pack target）且 `expandMaterializedField` 未折叠（`materializationBridgeIds.length === 0`）→ 累积到 `gaps[]` 一条 `TASK_LOCAL_MATERIALIZATION_FIELD_BREAK{ physicalDataset, readOccurrenceId, columns[] }`（按表聚合，不逐列多条）。
- [ ] 5.2 `tests/project-graph/task-local/materialization.test.ts` 追加：任务内写 temp 再读 temp 且无 bridge → 一条 gap 含全部列；有 bridge → 无 gap。

## 6. 升版重投与 INDEX 重建（FE-0…FE-3 合入后）

- [ ] 6.1 `npm run typecheck && npm run test:task-local-projection && npm run test:field-lineage && npm run format:check` 全绿；`project-task-local.ts` 输出 `schemaVersion: "1.3.0"`。
- [ ] 6.2 清四锚点批缓存后重跑 `npm run project-task-local -- --task-ids 181058,176827,209119,155015 --expand-upstream …`；确认 186 PROJECTED、0 COLLECTION_FAILED；运行 `field-evidence:subtype-distribution`，把 `RESOLVED` 读次比例、`subtype` 分布、`gaps` 按码计数写入 `artifacts/gold-case-dm-rsk-n/field-evidence-v1/phase1-baseline.json`（本地留档，不提交）。
- [ ] 6.3 在 `scripts/data-graph` 用 1.3.0 投影重建 `union-continuation-index.json`（现有 CLI，不改代码）；确认条目数与 1.2.0 版一致（535 ± 读次 id 未变）。

## 7. FE-4 `FieldEdgeIndex` 与跨任务 resolve

- [ ] 7.1 新建 `scripts/project-graph/field-evidence-v1/field-edge-index.ts`：`FieldEdgeIndex` 接口（design D6）+ `InMemoryFieldEdgeIndex`：按需懒加载 `tasks/<id>/task-local-projection.json`（读 envelope 的 `projection`），建 `(taskId, readOccurrenceId, column) → FieldEdgeRef[]`、`(taskId, writeObservationId, outputColumn) → FieldEdgeRef[]`、`(taskId, writeObservationId) → ControlEdgeRef[]`、`taskId → RelationTree`（用 Facts root 的 `relation-*.jsonl`）、`taskId → schemaVersion`。不做一次性全量合并。
- [ ] 7.2 新建 `scripts/project-graph/field-evidence-v1/continuation-index-reader.ts`：严格解析 INDEX 1.0.0（`artifactType / schemaVersion / contentHash` 校验），`candidatesForRead(consumerTaskId, readOccurrenceId) → IndexEntry | null`。若 data-graph 已有可复用的解析器契约，以其字段名为准，不自造。
- [ ] 7.3 新建 `scripts/project-graph/field-evidence-v1/resolve-read-field.ts`：`resolveReadField({ consumerTaskId, readOccurrenceId, column, index, edgeIndex }) → { kind: "CONFIRMED", producer: { taskId, writeObservationId }, edges } | { kind: "FRONTIER", candidates[] } | { kind: "GAP", reasonCode: PRODUCER_NOT_PROJECTED | PRODUCER_BINDING_NOT_FOUND | CONTRACT_TOO_OLD }`；CONFIRMED 仅当 `candidates.length === 1 && l1Eligible`。
- [ ] 7.4 `tests/project-graph/field-evidence-v1/resolve-read-field.test.ts`：合成投影 + 合成 INDEX 四态——唯一且 eligible → CONFIRMED 且边按 `writeObservationId + outputColumn` 精确选中；两候选 → FRONTIER 带 `partitionMatchStatus`；唯一但 `l1Eligible=false` → FRONTIER；无条目 → `PRODUCER_NOT_PROJECTED`；有条目无 binding → `PRODUCER_BINDING_NOT_FOUND`；producer 投影 1.2.0 → `CONTRACT_TOO_OLD`。

## 8. FE-5 Impact Query

- [ ] 8.1 新建 `scripts/project-graph/field-evidence-v1/scope.ts`：`scopeFor({ valueEdge, controlEdge, tree }) → { scope: FIELD_SCOPED|DATASET_SCOPED|SCOPE_DISJOINT, reason }`，按 design D7 顺序；`SCOPE_DISJOINT` 只由 `tree.setopBranchOf` 不同分支或 CTE 子树无公共祖先证明；无法定位 → `DATASET_SCOPED` + `CONTROL_SIDE_UNRESOLVED`。
- [ ] 8.2 新建 `scripts/project-graph/field-evidence-v1/impact-result-contract.ts`：`FIELD_IMPACT_RESULT` 1.0.0 类型、`canonicalizeImpactResult`（排序：value 按 `depth, taskId, outputColumn, sourceReadOccurrenceId`；control 按 `depth, relationId, column`；frontier 按 `depth, readOccurrenceId, column`；gaps 按 `gapId`）、`validateImpactResult`。
- [ ] 8.3 新建 `scripts/project-graph/field-evidence-v1/impact-query.ts`：`impactQuery({ edgeIndex, index, anchor, maxDepth=3, budget={maxEdges:5000,maxFrontier:200}, expandCandidates=false })`；算法按 `docs/execution-plan-field-evidence-v1.md` §6.2：depth 0 取锚点值边 + 该写观察控制边（每写观察只列一次）→ 每条 RESOLVED 值边调 7.3 → CONFIRMED 递归 / FRONTIER 记录 / GAP 记录；`AMBIGUOUS|UNRESOLVED` 值边不查 INDEX、记 gap；`FIELD_SCOPED` 控制列进入递归并标 `reachedVia: "CONTROL"`，其他 scope 不递归；任何预算触顶 → `budget.exhausted=true` + `TRAVERSAL_BUDGET_EXCEEDED{ limit }`；返回边集，不枚举路径。
- [ ] 8.4 新建 `scripts/project-graph/field-evidence-v1/impact-query-cli.ts` + `package.json` 脚本 `field-evidence:impact`：参数 `--projection-root --facts-root --index --task --write-observation --column [--max-depth --max-edges --max-frontier --expand-candidates --out]`；输出 canonical JSON 到 stdout 或 `--out`。
- [ ] 8.5 `tests/project-graph/field-evidence-v1/scope.test.ts`：LEFT 可空侧 → FIELD_SCOPED；同 join 保留侧 → DATASET_SCOPED；INNER → DATASET_SCOPED；setop 不同分支 → SCOPE_DISJOINT；同分支但无路径 → 仍 DATASET_SCOPED（反例断言）；FILTER → DATASET_SCOPED。
- [ ] 8.6 `tests/project-graph/field-evidence-v1/impact-query.test.ts`（合成三任务链 A→B→C）：两跳 CONFIRMED；中间表两 writer → frontier 且 depth 2 为空；`expandCandidates` → depth 2 出现且标 CANDIDATE 且预算计数增加；`maxDepth=1` → `TRAVERSAL_BUDGET_EXCEEDED{limit:"maxDepth"}`；控制 FIELD_SCOPED 列被递归且 `reachedVia="CONTROL"`；控制每写观察只出现一次；锚点 1.2.0 → 只有 `CONTRACT_TOO_OLD`。

## 9. FE-6 五个真数据金样

- [ ] 9.1 新建 `tests/project-graph/field-evidence-v1/golden.test.ts` + `tests/fixtures/field-evidence-v1/{case-a-pric,case-b-gamma,case-c-join5-two-columns,case-d-vola-frontier,case-e-181058-temp-break}/{anchor.json,expected.json}`；发现规则同 `TASK_LOCAL_GOLDEN_*`：缺 sibling `sql-static-lineage-data/field-facts` 或缺 6.2 产出的 1.3.0 投影/INDEX 则 `skip`；`FIELD_EVIDENCE_GOLDEN_REQUIRED=1` 时改为 fail。
- [ ] 9.2 Case A `176827 / write-observation:176827:platform-target:0 / pric`：断言 depth 0 唯一值边 `subtype=IDENTITY`、`sourceReadOccurrenceStatus=RESOLVED`、源 `pdata_n.t98_sb_tit_day_hold_indx.pric`；`control[]` 中 relationId 含 `setop.b1` 的为 `DATASET_SCOPED`，含 `setop.b0` 的全部为 `SCOPE_DISJOINT` 且 `reason` 为 setop 分支证明；depth 1 为 CONFIRMED 或 frontier（两 writer），不得为空且无 gap。
- [ ] 9.3 Case B `gamma`：`value[]` depth 0 至少 7 条，可按 `sourceRelationId` 分为 b0/b1 两组；含 `pos_eod_position_view.gamma` 与 `t98_sb_tit_day_hold_indx.gamma`；日期列（`erly_trmt_date / end_prcg_date / trgr_date / trgr_line_date / src_busi_date`）的边 `edgeType=FIELD_CONDITIONAL` 或 `subtype=TRANSFORMATION`，无一为 `IDENTITY`。
- [ ] 9.4 Case C 两次查询 `gamma_pct` 与 `nom`：`control[]` 中 `relationId = task:176827:statement:0:relation:root.casttable.setop.b0.join.5` 的条目，对 `gamma_pct` 为 `FIELD_SCOPED`、对 `nom` 为 `DATASET_SCOPED` 且 `grain=EXPAND_RISK`；两者 `joinType=LEFT`。
- [ ] 9.5 Case D `vola`：源 `pdata_n.t98_sb_otc_opt_sub_trd_prcg_indx.fx_vola`；若 INDEX 候选 >1 或非 eligible → `frontier[]` 一条、`reasonCode=MULTI_WRITER_CANDIDATE_FRONTIER`、每候选带 `partitionMatchStatus`，且 `value[]` 无该分支 depth ≥1 条目；若 INDEX 已唯一 eligible（WP-8 修好后）→ 断言改为 depth 1 CONFIRMED（fixture 中用 `oneOf` 表达，两种都算通过但必须记录命中哪种）。
- [ ] 9.6 Case E `181058` 任一来自 `dm_rsk_n.otc_opt_inr_comp_pal_sum_temp` 的输出列：`gaps[]` 含 `TASK_LOCAL_MATERIALIZATION_FIELD_BREAK` 且 `details.columns` 非空；不含针对该表的 `PRODUCER_NOT_PROJECTED`。
- [ ] 9.7 `package.json` 新增 `test:field-evidence`（`vitest run tests/project-graph/field-evidence-v1 --no-file-parallelism`）并加入 `npm test` 聚合；`AGENTS.md` 的金样段落追加一行 `FIELD_EVIDENCE_GOLDEN_REQUIRED=1` 说明（仅追加，不改既有文字）。

## 10. FE-7 止损脚本

- [ ] 10.1 新建 `scripts/project-graph/field-evidence-v1/stop-loss-cli.ts` + 脚本 `field-evidence:stop-loss`：输入 `--columns` 配置（默认 `tests/fixtures/field-evidence-v1/stop-loss-columns.json`，内容为 176827 的 `gamma, delta, vega, theta, gamma_base, theta_base, vega_base, gamma_pct, npv_base, vola`）；对每列跑 8.3；输出 `{ confirmedTwoHopRatio, perColumn[], dominantGap, decision }`，`decision ∈ PROCEED_PHASE_3 | FREEZE_AND_FIX_WP8 | COLLECT_MORE_PACKS | FIX_PHASE_1_DERIVATION`，规则按 spec「Stop-loss decision is machine-produced」。
- [ ] 10.2 `tests/project-graph/field-evidence-v1/stop-loss.test.ts`：合成结果驱动四种决策各一例；阈值 `0.5` 为常量并被测试引用，不可在 CLI 参数里放宽。

## 11. FE-8 文档回写与收口

- [ ] 11.1 `docs/execution-plan-asset-graph.md` WP-11 行、`docs/domain-asset-graph-architecture.md` 实现状态表：各**只改一行**，状态从「冻结」改为「Phase 1 范围已定 → 见 `docs/execution-plan-field-evidence-v1.md` / `openspec/changes/field-evidence-v1`」；不改正文。
- [ ] 11.2 `docs/execution-plan-field-evidence-v1.md` §0「当前阶段」表按实际完成情况更新状态列（仅状态列）。
- [ ] 11.3 全量门：`npm test`、`npm run typecheck`、`npm run build`、`npm run format:check`、`npm run test:target-table-causal-closure`（回归，本 change 不得改闭包实现）、`openspec validate field-evidence-v1 --strict` 全绿。
- [ ] 11.4 运行 10.1，把 `decision` 与统计写入 `openspec/changes/field-evidence-v1/STATUS.md`；若为 `FREEZE_AND_FIX_WP8`，在同文件登记「等待 WP-8」并停止 Phase 3 规划。
