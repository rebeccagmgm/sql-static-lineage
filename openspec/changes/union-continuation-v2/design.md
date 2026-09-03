## Context

WP-7 的 1.2.0 投影将读次和局部闭包作为 canonical input：

- `localClosure.externalReads[]` 是消费侧的真实读次集合；
- `localClosure.finalWrites[]` 是并集内可确认的写观察集合；
- `READ_OCCURRENCE` 节点提供分区谓词，不能用旧 flat `READS` 表边替代。

本 change 只实现 data-graph 的可重建消费投影，不重算 SQL 语义，也不把调度参考解释成数据血缘。

## Decisions

### D1 — v2 只接受 1.2.0 证据

合同层保留 1.1.0 兼容，以免破坏已有 v1 loader 和快照；`traceUnionContinuationV2` 只接受拥有 `localClosure.externalReads` 且 `projectionSchemaVersion === 1.2.0` 的任务。缺少该证据或只有旧节点时 fail-closed。

### D2 — 三档接续按读次和写观察展开

1. 表档：按 `datasetNodeId + qualifiedName` 收集并集 `finalWrites`，再并入 producer-index 中相同物理表的确认写观察；producer-index-only 保留 `WRITER_NOT_IN_UNION` 边界。
2. 分区档：对每个读次 × 写观察独立计算 `partitionMatchStatus`。字面值冲突为 `DISJOINT` 并裁剪；非字面、动态或证据不足为 `UNKNOWN`；运行时模板/日期默认等可推断但未确认的相等关系为 `ASSUMED`；证据完全字面相等为 `CONFIRMED`。
3. 写观察档：保留分区档剩余的每个 `writeObservationId`。多个写观察不折叠成一个任务，也不人工选唯一结果。

### D3 — L1/L2 和调度边界

只有 `identityStatus=CONFIRMED`、来源为 `IN_UNION_FINAL_WRITE` 且分区状态为 `CONFIRMED` 的候选才标记 `L1`。`ASSUMED`、`UNKNOWN` 和 producer-index-only 一律为 `L2`。v2 API 没有 schedule candidate 参数，`scheduleReference` 与 `SCHEDULE_DEPENDS_ON` 因此不可能进入三档。

### D4 — producer-index 不扁平化

每个 `writes[]` 产生一个独立的 producer-index writer。缺少上游显式 ID 时使用 `write-observation:<taskId>:<index>` 的确定性 fallback；这只是观察标识，不提升证据等级。

### D5 — 多写对齐必须可证明

producer-index 的 fallback ID 不得广播到同一任务/同一物理表的多个
`finalWrites`。只有显式 `writeObservationId` 精确命中，或该物理写 scope
恰好只有一个 `finalWrite` 和一个 producer-index writer 时，才可补入分区证据。
否则保留每个 `finalWrite`，分区为 `UNKNOWN`，输出
`WRITE_OBSERVATION_ALIGNMENT_AMBIGUOUS`，并抑制无法归属的 PI-only writer。

### D6 — 最小 L0-L3 evidence envelope

`buildUnionContinuationEvidenceEnvelope` 将单个 v2 读次结果包成可回放的
`UNION_CONTINUATION_EVIDENCE` 1.0.0：L0 带消费者覆盖、三档数量和所有任务/PI/
batch manifest 哈希；L1/L2 带写观察候选；L3 带显式 gaps；完整 v2 结果原样保留。
`generatedAt` 不进入 envelope content hash。该 factory 是可消费的契约，批量 CLI
仍作为后续接入项。

## Rollback

停止调用 v2 入口即可回到既有 `traceUnionUpstream`。不修改 legacy 投影、旧快照或现有 v1 测试输入。
