## 1. Baseline and target-write identity

- [ ] 1.1 冻结旧 `FIELD_MULTI_HOP_RECONCILIATION`、field-lineage 和 target-field-causal-slice 的 golden/hash 回归样本，确认本 change 的独立 artifact type、文件名和 schema version。
- [ ] 1.2 定义 `TargetWriteIdentity` 与 `AnalysisSnapshotRef`，将稳定写入身份和输入 fingerprint/hash 分开保存。
- [ ] 1.3 实现 `TargetWriteResolver`：把 task、目标物理表、statement slot、root relation 和 canonical write evidence 唯一绑定。
- [ ] 1.4 覆盖多候选写入、root relation 无法映射和 write evidence 缺失，分别输出 `TARGET_WRITE_AMBIGUOUS`、`TARGET_WRITE_RELATION_UNMAPPED` 或对应 gap，不猜测根。
- [ ] 1.5 为目标表闭包 CLI 增加 causal-only、输入 fingerprint、时间/内存/图规模/深度预算和结构化 fail-fast 输出。

## 2. M1: Single-task value closure

- [ ] 2.1 建立目标表级 artifact contract，主 assessment key 使用 `targetWriteId + candidateBranchId`，不包含 root target field。
- [ ] 2.2 建立 `FieldValueEvidenceProvider` 或 canonical VALUE_FLOW index 的候选分支聚合接口，返回 channel status、output field bindings、affected target fields、evidence refs 和 gap refs。
- [ ] 2.3 实现 project/value、CASE/IF/COALESCE 的 Task-local field port/value transfer，验证输入字段只接续对应输出 binding。
- [ ] 2.4 实现单 Task 目标写入闭包和 task-level rollup；确认字段数量增加不会生成字段×候选分支 assessment。
- [ ] 2.5 覆盖 field-lineage 缺失：仅将 `FIELD_VALUE` 标为 `UNKNOWN`，不阻断其他通道，也不生成 `PROVEN_UNRELATED`。

## 3. M2: Cross-task field bridge

- [ ] 3.1 复用 exact producer/read bridge、relation bridge 和 occurrence-specific evidence refs，输出 resolved/ambiguous/missing bridge 统计。
- [ ] 3.2 实现跨 Task field port 的 `FIELD_VALUE` 接续，覆盖同表多次读取、self join 和多个 write observation 隔离。
- [ ] 3.3 验证 Task-local semantic edge 不携带 `candidateBranchId`，只有跨任务 bridge edge 携带候选分支身份。
- [ ] 3.4 验证同一输入只影响部分输出字段时不会无差别传播到 Task 的全部字段。

## 4. M3: Row membership and task rollup

- [ ] 4.1 从现有 table multi-hop artifact 投影 ROOT_WRITE、PHYSICAL_PRODUCER、SCHEDULE_ONLY、UNBOUND_READ、BLOCKED_READ 和 COVERAGE_BOUNDARY。
- [ ] 4.2 实现 WHERE/HAVING/QUALIFY、INNER/OUTER/SEMI/ANTI/CROSS JOIN 的 `ROW_MEMBERSHIP`/`MULTIPLICITY` 规则；JOIN dependency 不以 uniqueness 为前提。
- [ ] 4.3 建立去重 GlobalImpactGraph，local semantic edge 与 producer bridge edge 分层保存。
- [ ] 4.4 实现从 TargetWriteRef 出发的一次有界反向闭包和 task-level rollup，保留 channel、certainty、evidence/gap refs。
- [ ] 4.5 覆盖一个 Task 多个 branch、多通道和 ROOT_WRITE 排除规则，验证任务级最小确定集与保守安全集。

## 5. M4: Relation-level dependencies and channel algebra

- [ ] 5.1 实现 COUNT(*)、EXISTS、literal-from-relation 和 CROSS JOIN 的 `RELATION_EXISTENCE`/基数影响。
- [ ] 5.2 定义 `ChannelAssessment`：`CONFIRMED`、`CONDITIONAL`、`PROVEN_ABSENT`、`UNKNOWN`、`NOT_APPLICABLE`，分别保存 proof/witness/gap refs。
- [ ] 5.3 实现同一 channel 的 certainty 合并和不同 channel 的 relationStatus 聚合，验证 `FIELD_VALUE=CONFIRMED` 不被独立 `MULTIPLICITY=UNKNOWN` 降级。
- [ ] 5.4 实现 negative proof safe rules；所有适用 channel 均 `PROVEN_ABSENT` 且无未关闭义务时才允许 `PROVEN_UNRELATED`。
- [ ] 5.5 验证未建模 operator、coverage boundary、截断和未知 identity 都只能产生 Unknown/gap。

## 6. M5: Remaining operator semantics and bounded propagation

- [ ] 6.1 实现 AGGREGATE、GROUP BY、DISTINCT、UNION/INTERSECT/EXCEPT 的 GROUPING/SET_MEMBERSHIP 规则。
- [ ] 6.2 实现 WINDOW value/partition/order/frame，以及 ORDER + LIMIT/TOP/FETCH 的 WINDOW_EFFECT/ORDER_SELECTION 规则。
- [ ] 6.3 完成 PathCertainty、循环/重复状态检测、少量 witness predecessor 回溯，以及 VALUE/CONTROL/RELATION 独立预算。
- [ ] 6.4 验证一次 global propagation 不保存完整路径集合，不按字段或候选分支重复执行 semantic summary。

## 7. M6: Calcite shadow and differential reuse

- [ ] 7.1 将现有 Calcite Rel bridge/differential adapter 接入 semantic digest 级缓存，验证调用次数以上限唯一 digest 数量为准。
- [ ] 7.2 为 JOIN、FILTER、AGGREGATE、SETOP、WINDOW、Top-N 和 relation-context 增加 mapped/unsupported/unmappable/conflict fixture。
- [ ] 7.3 验证 Calcite corroboration 只写 validation observation；unsupported/unavailable 记录 `NOT_EVALUATED`，冲突生成 `SEMANTIC_ENGINE_CONFLICT` 并降为 Unknown。
- [ ] 7.4 在 Java/Calcite 不可用时验证默认 TypeScript causal-only 命令、默认测试和旧 field-lineage 命令仍可运行。

## 8. M7: Artifact, renderer, and 209119 acceptance

- [ ] 8.1 发布独立目标表闭包 JSON schema、canonical artifact、summary 和 HTML；包含 TargetWriteIdentity、AnalysisSnapshotRef、逐通道 assessment、task rollup、proof/gap 和 `runtimeRerunDecision = NOT_EVALUATED`。
- [ ] 8.2 验证 renderer 只读取 canonical artifact，不重新计算结论；旧 field-lineage artifact/HTML/hash 和 CLI 行为保持不变。
- [ ] 8.3 输出 load、summary、Calcite、candidate projection、graph、propagation、validation、render 各阶段耗时、调用数、cache hit/miss、节点/边数和峰值内存。
- [ ] 8.4 校验 209119 Input Pack、Plan/Machine Facts、producer index 和 table artifact fingerprint；一致时禁止全量采集、旧 field-lineage 重建和全量 producer-index 重建。
- [ ] 8.5 运行 209119 causal-only 验收：主 assessment 按唯一 candidate branch 计，不存在 137×549 字段矩阵；核对 FIELD_VALUE、ROW_MEMBERSHIP、MULTIPLICITY、RELATION_EXISTENCE 和 task rollup。
- [ ] 8.6 验收性能目标：复用输入模式约 5 分钟内、峰值内存约 1GB 内；超出时先定位阶段，不通过提高 heap 或无限延长等待掩盖。

## 9. Documentation and handoff

- [ ] 9.1 更新使用说明，明确静态 relationStatus、逐通道 ChannelAssessment、最小确定集、保守安全集和 runtimeRerunDecision 的边界。
- [ ] 9.2 记录 operator support matrix、Calcite differential 状态、Known Unknown、bridge closure 和性能基准结果。
- [ ] 9.3 完成 targeted tests、typecheck、build/format/inspect 以及默认无 Java 的回归验证。
- [ ] 9.4 形成 review checklist：目标写入身份可构造、字段只作内部 field port、无字段笛卡尔积、无静默裁枝、无 Calcite 强依赖、所有 Unknown 可追溯。
