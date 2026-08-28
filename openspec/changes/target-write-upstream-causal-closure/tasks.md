## 1. Baseline and target-write identity

- [ ] 1.1 冻结旧 `FIELD_MULTI_HOP_RECONCILIATION`、field-lineage 和 target-field-causal-slice 的 golden/hash 回归样本，确认本 change 的独立 artifact type、文件名和 schema version。
- [x] 1.2 定义 `TargetWriteIdentity`（包含 `sqlSourceId`、statement ordinal、write ordinal）与 `AnalysisSnapshotRef`，将稳定写入身份和输入 fingerprint/hash 分开保存。
- [x] 1.3 实现 `TargetWriteResolver`：把 task、目标物理表、SQL source/slot、statement/write ordinal、root relation 和 canonical write evidence 唯一绑定。
- [x] 1.4 覆盖多候选写入、root relation 无法映射和 write evidence 缺失，分别输出 `TARGET_WRITE_AMBIGUOUS`、`TARGET_WRITE_RELATION_UNMAPPED` 或对应 gap，不猜测根。
- [x] 1.5 为目标表闭包 CLI 增加 causal-only、输入 fingerprint、时间/内存/图规模/深度预算和结构化 fail-fast 输出。
- [x] 1.6 从现有 table multi-hop artifact 投影最小 Candidate Universe：ROOT_WRITE、PHYSICAL_PRODUCER、SCHEDULE_ONLY、UNBOUND_READ、BLOCKED_READ、COVERAGE_BOUNDARY。

## 2. M1: Single-task value closure

- [x] 2.1 建立目标表级 artifact contract，主 assessment key 使用 `targetWriteId + candidateBranchId`，不包含 root target field。
- [x] 2.2 建立 `FieldValueEvidenceProvider` 或 canonical VALUE_FLOW index 的候选分支聚合接口，返回 channel status、output field bindings、affected target fields、evidence refs 和 gap refs，并验证现有字段证据只扫描/加载一次。
- [ ] 2.3 以 provider adapter 实现 project/value、CASE/IF/COALESCE 的单 Task `FIELD_VALUE` 聚合；只有 provider 无法精确接续时才启用完整 Task-local field port。
- [x] 2.4 实现单 Task 目标写入闭包和最小 artifact contract；确认字段数量增加不会生成字段×候选分支 assessment。
- [x] 2.5 覆盖 field-lineage 缺失：仅将 `FIELD_VALUE` 标为 `UNKNOWN`，不阻断其他通道，也不生成 `PROVEN_UNRELATED`。

## 3. M2: Cross-task field bridge

- [ ] 3.1 复用 exact producer/read bridge、relation bridge 和 occurrence-specific evidence refs，输出 resolved/ambiguous/missing bridge 统计，并识别 `PRODUCER_WRITE_AMBIGUOUS`。
- [ ] 3.2 先实现跨 Task provider 聚合的 `FIELD_VALUE` 接续，覆盖同表多次读取、self join 和多个 write observation 隔离；仅在 Gate A 证明 provider 不足时实现完整 field-port propagation。
- [x] 3.3 验证 Task-local semantic edge 不携带 `candidateBranchId`，只有跨任务 bridge edge 携带候选分支身份。
- [ ] 3.4 验证同一输入只影响部分输出字段时不会无差别传播到 Task 的全部字段。

## 4. Gate A: 209119 structural and performance gate

- [x] 4.1 验证 `TargetWriteIdentity` 唯一构造、Candidate Universe 投影成功、assessment 数量不超过唯一 candidate branch 数且不存在 137×549。
- [x] 4.2 验证字段证据只扫描/加载一次、跨任务 bridge closure 统计可见、阶段耗时/调用数/cache hit/miss/峰值内存可见。
- [x] 4.3 验收缓存复用模式约 5 分钟内、峰值内存约 1GB 内；不通过则停止后续 operator 扩展并先修粒度/缓存。

## 5. M3: Row membership and task rollup

- [ ] 5.1 实现 WHERE/HAVING/QUALIFY、INNER/OUTER/SEMI/ANTI/CROSS JOIN 的 `ROW_MEMBERSHIP`/`MULTIPLICITY` 规则；JOIN dependency 不以 uniqueness 为前提。
- [x] 5.2 建立去重 GlobalImpactGraph，local semantic edge 与 producer bridge edge 分层保存。
- [x] 5.3 实现从 TargetWriteRef 出发的一次有界反向闭包和 task-level rollup，保留 channel、certainty、evidence/gap refs；`ROOT_WRITE` 不计入上游任务数量。
- [x] 5.4 覆盖一个 Task 多个 branch、多通道和 task rollup 状态，验证任务级最小确定集与保守安全集。

## 6. M4: Relation-level dependencies and channel algebra

- [x] 6.1 实现 COUNT(*)、EXISTS、literal-from-relation 和 CROSS JOIN 的 `RELATION_EXISTENCE`/基数影响。
- [x] 6.2 定义 `ChannelAssessment`：`CONFIRMED`、`CONDITIONAL`、`PROVEN_ABSENT`、`UNKNOWN`、`NOT_APPLICABLE`，分别保存 proof/witness/gap refs。
- [ ] 6.3 实现路径内 certainty 串联、同 channel 备选路径合并和不同 channel 的 relationStatus 聚合，验证 `FIELD_VALUE=CONFIRMED` 不被独立 `MULTIPLICITY=UNKNOWN` 降级。
- [x] 6.4 实现 negative proof safe rules；所有适用 channel 均 `PROVEN_ABSENT` 且无未关闭义务时才允许 `PROVEN_UNRELATED`。
- [x] 6.5 验证未建模 operator、coverage boundary、截断和未知 identity 都只能产生 Unknown/gap。
- [ ] 6.6 验证 Calcite/native 语义冲突只降级对应 channel；目标写入、read occurrence 或 producer bridge identity 冲突才阻断整个候选分支。

## 7. Gate B: 209119 product-value gate

- [x] 7.1 核对 FIELD_VALUE、FILTER、INNER/LEFT JOIN、COUNT(*)、EXISTS、CROSS JOIN、MULTIPLICITY 和 task rollup。
- [x] 7.2 评估候选范围是否比纯表血缘合理、Unknown 是否可定位、bridge closure 是否值得继续投入；未通过则停止 M5/M6。

## 8. M5: Remaining operator semantics and bounded propagation (Gate B 通过后)

- [ ] 8.1 实现 AGGREGATE、GROUP BY、DISTINCT、UNION/INTERSECT/EXCEPT 的 GROUPING/SET_MEMBERSHIP 规则。
- [ ] 8.2 实现 WINDOW value/partition/order/frame，以及 ORDER + LIMIT/TOP/FETCH 的 WINDOW_EFFECT/ORDER_SELECTION 规则。
- [ ] 8.3 完成 PathCertainty、循环/重复状态检测、少量 witness predecessor 回溯，以及 VALUE/CONTROL/RELATION 独立预算。
- [ ] 8.4 验证一次 global propagation 不保存完整路径集合，不按字段或候选分支重复执行 semantic summary。

## 9. M6: Calcite shadow and differential reuse (Gate B 通过后)

- [ ] 9.1 将现有 Calcite Rel bridge/differential adapter 接入 semantic digest 级缓存，验证调用次数以上限唯一 digest 数量为准。
- [ ] 9.2 为 JOIN、FILTER、AGGREGATE、SETOP、WINDOW、Top-N 和 relation-context 增加 mapped/unsupported/unmappable/conflict fixture。
- [ ] 9.3 验证 Calcite corroboration 只写 validation observation；unsupported/unavailable 记录 `NOT_EVALUATED`，冲突生成 `SEMANTIC_ENGINE_CONFLICT` 并按通道或共享 identity 规则降级。
- [ ] 9.4 在 Java/Calcite 不可用时验证默认 TypeScript causal-only 命令、默认测试和旧 field-lineage 命令仍可运行。

## 10. M7: Artifact, renderer, and 209119 acceptance (M5/M6 通过后)

- [ ] 10.1 发布独立目标表闭包 JSON schema、canonical artifact、summary 和 HTML；包含 TargetWriteIdentity、AnalysisSnapshotRef、逐通道 assessment、task rollup、proof/gap 和 `runtimeRerunDecision = NOT_EVALUATED`。
- [ ] 10.2 验证 renderer 只读取 canonical artifact，不重新计算结论；旧 field-lineage artifact/HTML/hash 和 CLI 行为保持不变。
- [ ] 10.3 输出 load、summary、Calcite、candidate projection、graph、propagation、validation、render 各阶段耗时、调用数、cache hit/miss、节点/边数和峰值内存。
- [ ] 10.4 校验 209119 Input Pack、Plan/Machine Facts、producer index 和 table artifact fingerprint；一致时禁止全量采集、旧 field-lineage 重建和全量 producer-index 重建。
- [ ] 10.5 运行 209119 causal-only 正式验收：主 assessment 按唯一 candidate branch 计，不存在 137×549 字段矩阵；核对 FIELD_VALUE、ROW_MEMBERSHIP、MULTIPLICITY、RELATION_EXISTENCE 和 task rollup。
- [ ] 10.6 输出最终性能报告；复用输入模式约 5 分钟内、峰值内存约 1GB 内，超出时先定位阶段，不通过提高 heap 或延长等待掩盖。

## 11. Documentation and handoff

- [ ] 11.1 更新使用说明，明确静态 relationStatus、逐通道 ChannelAssessment、最小确定集、保守安全集和 runtimeRerunDecision 的边界。
- [ ] 11.2 记录 operator support matrix、Calcite differential 状态、Known Unknown、bridge closure 和性能基准结果。
- [ ] 11.3 完成 targeted tests、typecheck、build/format/inspect 以及默认无 Java 的回归验证。
- [ ] 11.4 形成 review checklist：目标写入身份可构造、字段只作内部 field port、无字段笛卡尔积、无静默裁枝、无 Calcite 强依赖、所有 Unknown 可追溯。
