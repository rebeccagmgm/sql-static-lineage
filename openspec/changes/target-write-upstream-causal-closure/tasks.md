## 1. Baseline and contract

- [ ] 1.1 冻结旧 `FIELD_MULTI_HOP_RECONCILIATION`、field-lineage 和 target-field-causal-slice 的 golden/hash 回归样本，明确本 change 的独立 artifact type、文件名和 schema version。
- [ ] 1.2 定义 `TargetWriteRef`、`CandidateBranchAssessment`、`ImpactChannel`、`StaticRelationStatus`、`RerunDecision`、proof/gap 和阶段性能指标 contract。
- [ ] 1.3 为目标表闭包 CLI 增加 causal-only、输入 fingerprint、时间/内存/图规模/深度预算和结构化 fail-fast 输出。

## 2. Candidate universe and shared evidence

- [ ] 2.1 从现有 table multi-hop artifact 投影 ROOT_WRITE、PHYSICAL_PRODUCER、SCHEDULE_ONLY、UNBOUND_READ、BLOCKED_READ 和 COVERAGE_BOUNDARY，并保留 coverage boundary。
- [ ] 2.2 复用共享 physical resolver、producer bridge、relation bridge 和 occurrence-specific evidence refs，输出 stable/ambiguous/missing bridge 统计。
- [ ] 2.3 确认 `candidateBranchId` 不包含 producer role，并覆盖同表多次读取、self join 和多个 write observation 的隔离测试。
- [ ] 2.4 在 bridge identity 不完整、fingerprint 不一致和 table artifact coverage 不完整时验证 fail-closed 行为。

## 3. Task relation summary and semantic channels

- [ ] 3.1 建立按 task/statement/root-relation semantic digest 去重的 `TaskRelationSummary` 生成器和缓存。
- [ ] 3.2 实现 project/value、CASE/IF/COALESCE、expression-control 和字段 evidence 引用。
- [ ] 3.3 实现 WHERE/HAVING/QUALIFY、INNER/OUTER/SEMI/ANTI/CROSS JOIN 的 ROW_MEMBERSHIP/MULTIPLICITY 规则；JOIN dependency 不依赖 uniqueness。
- [ ] 3.4 实现 GROUP BY、aggregate、COUNT(*)、DISTINCT、UNION/INTERSECT/EXCEPT 的 GROUPING/RELATION_EXISTENCE/SET_MEMBERSHIP 规则。
- [ ] 3.5 实现 window value/partition/order/frame 以及 ORDER + LIMIT/TOP/FETCH 的 WINDOW_EFFECT/ORDER_SELECTION 规则。
- [ ] 3.6 对 EXISTS、literal-from-relation 和其他 fieldless dependency 生成 RELATION_EXISTENCE；对未建模 operator 生成明确 support gap。
- [ ] 3.7 为每批 operator 建立代表性 SQL/Plan Facts fixture，验证同一 digest 不因目标字段数量重复生成 summary。

## 4. Global closure and proof

- [ ] 4.1 建立 relation/read/write occurrence 粒度的 GlobalImpactGraph，去重节点和边并保留 candidate branch、channel、certainty、evidence/gap refs。
- [ ] 4.2 实现从 TargetWriteRef 出发的一次有界反向固定点传播，状态不包含目标字段集合，不保存完整路径集合。
- [ ] 4.3 实现 PathCertainty 合并、循环/重复状态检测、少量 witness predecessor 回溯，以及 VALUE/CONTROL/RELATION 独立预算。
- [ ] 4.4 实现 static assessment：`CONFIRMED_RELATED`、`CONDITIONAL_RELATED`、`PROVEN_UNRELATED`、`UNKNOWN`，并保证每个 `TargetWriteRef × candidateBranchId` 恰好一个结果。
- [ ] 4.5 实现 negative proof safe rules；任何 gap、coverage boundary、未建模 operator、截断或未知身份均阻止 `PROVEN_UNRELATED`。
- [ ] 4.6 生成最小确定集与保守安全集，保留触发它们的 candidate branch、impact channel、proof/gap refs。

## 5. Calcite shadow and differential reuse

- [ ] 5.1 将现有 Calcite Rel bridge/differential adapter 接入 semantic digest 级缓存，验证不会按字段或候选分支重复调用。
- [ ] 5.2 为 JOIN、FILTER、AGGREGATE、SETOP、WINDOW、Top-N 和 relation-context summary 增加 mapped/unsupported/unmappable/conflict fixture。
- [ ] 5.3 验证 Calcite corroboration 只写 validation observation；unsupported/unavailable 记录 `NOT_EVALUATED`，冲突生成 `SEMANTIC_ENGINE_CONFLICT` 并降为 Unknown。
- [ ] 5.4 在 Java/Calcite 不可用时验证默认 TypeScript causal-only 命令和旧 field-lineage 命令仍可运行。

## 6. Artifact, renderer, and validation

- [ ] 6.1 发布独立目标表闭包 JSON schema、canonical artifact、summary 和 HTML renderer；renderer 不重新计算结论。
- [ ] 6.2 在 artifact validator 中校验 TargetWriteRef、candidate coverage、proof/gap closure、bridge closure、assessment 唯一性、metrics 和 limits。
- [ ] 6.3 输出 load、summary、Calcite、candidate projection、graph、propagation、validation、render 各阶段耗时、调用数、cache hit/miss、节点/边数和峰值内存。
- [ ] 6.4 增加旧 field-lineage artifact/HTML/hash 不变、旧 CLI 不依赖新 artifact、新 CLI 不写回旧 artifact 的回归测试。

## 7. 209119 causal-only acceptance

- [ ] 7.1 校验 209119 Input Pack、Plan/Machine Facts、producer index 和 table artifact fingerprint，一致时禁止全量采集和旧 field-lineage 重建。
- [ ] 7.2 运行新闭包并确认主 assessment 数量按唯一 candidate branch 计，不存在 137×549 字段矩阵；对多 write observation 按根隔离。
- [ ] 7.3 核对 JOIN、FILTER、COUNT(*)、EXISTS、CROSS JOIN、Top-N 的 impact channels、bridge evidence 和 Unknown 原因。
- [ ] 7.4 验收性能目标：复用输入的 causal-only 模式约 5 分钟内、峰值内存约 1GB 内；超出时先定位阶段，不通过提高 heap 或延长等待掩盖。
- [ ] 7.5 生成 209119 独立 JSON/摘要/HTML，并与旧 field-lineage 产物做 hash 和行为对照。

## 8. Documentation and handoff

- [ ] 8.1 更新使用说明，明确静态 relationStatus、最小确定集、保守安全集与运行期 rerunDecision 的边界。
- [ ] 8.2 记录 operator support matrix、Calcite differential 状态、Known Unknown 和性能基准结果。
- [ ] 8.3 完成 targeted tests、typecheck、build/format/inspect 以及默认无 Java 的回归验证。
- [ ] 8.4 形成 review checklist：旧链路无变化、无字段笛卡尔积、无静默裁枝、无 Calcite 强依赖、所有 Unknown 可追溯。
