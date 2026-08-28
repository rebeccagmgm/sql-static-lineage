## Purpose

给定目标任务和目标表的写入观测，从已有表级上游候选空间中计算目标表的静态上游因果闭包，保留字段值、行成员、重复度和关系存在性等间接影响，并为每个候选生产分支输出可审计的相关性与保守重跑候选结论。

## ADDED Requirements

### Requirement: Target write is the causal slicing criterion

系统 SHALL 以版本化的目标写入观测作为因果闭包的根，而不是以目标表字段集合建立主遍历。目标写入观测至少包含任务、写入观测、物理目标表、语句/关系范围和输入 fingerprint；同一任务存在多个写入观测时 MUST 分别计算或由调用方显式指定根集合，禁止隐式合并。

#### Scenario: One target write is analyzed

- **WHEN** 调用方提供一个目标任务、目标表和唯一匹配的写入观测
- **THEN** 系统从该 `TargetWriteRef` 建立一次目标表级闭包，字段只作为解释和证据钻取维度，不生成目标字段×候选分支的主 assessment 矩阵

#### Scenario: Multiple writes are present

- **WHEN** 目标任务对同一物理表存在多个语句或写入观测
- **THEN** 系统要求显式选择写入观测或输出按 `TargetWriteRef` 隔离的闭包，不能因为目标表名相同而合并证据

### Requirement: Relation summaries expose rerun-relevant impact channels

系统 SHALL 对每个任务/语句/目标关系生成可去重的语义摘要，并以正交的 `impactChannels` 表达输入对输出的潜在影响。至少支持 `FIELD_VALUE`、`EXPRESSION_CONTROL`、`ROW_MEMBERSHIP`、`MULTIPLICITY`、`GROUPING`、`SET_MEMBERSHIP`、`ORDER_SELECTION`、`WINDOW_EFFECT` 和 `RELATION_EXISTENCE`；字段血缘不得成为表达关系级影响的唯一方式。

#### Scenario: Indirect operator influence is retained

- **WHEN** 输入关系通过 JOIN、WHERE/HAVING/QUALIFY、GROUP BY、DISTINCT、SET operation 或 `ORDER BY` 与 LIMIT/TOP/FETCH 参与目标写入
- **THEN** 摘要保留对应 relation occurrence、operator evidence 和影响通道，即使输入字段没有直接流入目标字段值

#### Scenario: Fieldless relation dependency is present

- **WHEN** SQL 使用 `COUNT(*)`、`EXISTS`、无条件 CROSS JOIN 或 `SELECT literal FROM relation` 等不产生具体输入字段的关系依赖
- **THEN** 系统以 relation occurrence 表达行存在性或基数影响，不得因 `affectedFields` 为空而裁掉该上游关系

#### Scenario: Ordering does not imply row impact by itself

- **WHEN** 输入只参与没有截断或筛选效果的 ORDER BY 或普通窗口上下文
- **THEN** 系统仅记录 ordering/window impact，不将其自动升级为目标表行成员变化或重跑必需

### Requirement: Global impact closure is computed once at relation granularity

系统 SHALL 将任务语义摘要、精确 read occurrence、producer bridge 和目标写入观测组成全局影响图，并从目标写入观测执行一次有界反向闭包。相同任务/语句/算子摘要和跨任务证据 MUST 去重；系统不得按每个目标字段或每个候选分支重复执行完整语义分析。

#### Scenario: Shared upstream is reached through multiple channels

- **WHEN** 同一候选生产分支同时通过字段值、JOIN 行成员和重复度影响目标表
- **THEN** 系统合并为一个候选分支结论并保留多个 `impactChannels`，不复制成多条字段级主路径

#### Scenario: Candidate branch is not reachable

- **WHEN** 全局图中的候选生产分支无法在已完成的静态边界内到达目标写入观测
- **THEN** 系统只有在负向证明条件满足时输出 `PROVEN_UNRELATED`，否则输出 `UNKNOWN` 并暴露阻断原因

### Requirement: Candidate universe and evidence boundaries are explicit

系统 SHALL 从 fingerprint 匹配的 table multi-hop artifact 投影候选空间，至少保留目标写入、物理生产、schedule-only、unbound read、blocked read 和 coverage boundary。每个候选分支 MUST 具有稳定身份，producer role 只能作为可变化 metadata；缺失、歧义或不连续的 read/write bridge MUST 成为可定位 gap。

#### Scenario: Physical producer bridge is complete

- **WHEN** 候选分支具有唯一物理表身份、read occurrence、producer write、output binding 和连续 evidence refs
- **THEN** 系统可将该分支纳入正向闭包，并在结果中回溯完整 bridge 证据

#### Scenario: Table artifact has an unresolved boundary

- **WHEN** table multi-hop artifact 标记覆盖不完整、unbound/blocked read 或截断边界
- **THEN** 系统把边界纳入 candidate universe，受影响结论保持 `UNKNOWN`，不得因未枚举的对象缺席而声称无关

#### Scenario: Stable identity is ambiguous

- **WHEN** 同名表或字段无法通过 platform、data source、qualified name 和 occurrence 唯一解析
- **THEN** 系统记录 `IDENTITY_AMBIGUOUS` gap 并停止该分支的确定性桥接，不把空 identity 当作通配符

### Requirement: Static relation assessment is separate from runtime rerun policy

系统 SHALL 分别输出静态 `relationStatus` 和运行期 `rerunDecision`。静态状态至少包括 `CONFIRMED_RELATED`、`CONDITIONAL_RELATED`、`PROVEN_UNRELATED` 和 `UNKNOWN`；运行期策略至少包括 `REQUIRED`、`SAFE_INCLUDE`、`NOT_REQUIRED` 和 `UNKNOWN`。静态分析不得声称已验证具体运行实例、分区重叠、参数变化或数据内容变化。

#### Scenario: Confirmed static relation

- **WHEN** 候选生产分支通过连续的 operator、identity、read/write bridge 和 evidence refs 证明可能影响目标写入
- **THEN** 系统输出 `CONFIRMED_RELATED`，并将该分支加入最小确定候选集；实际是否必须重跑仍由运行期策略单独决定

#### Scenario: Conditional or unknown relation

- **WHEN** JOIN 唯一性、动态参数、分区范围、operator 语义或 bridge evidence 仍不完整
- **THEN** 系统输出 `CONDITIONAL_RELATED` 或 `UNKNOWN`，将其加入保守安全候选集，并引用具体 gap 或条件

#### Scenario: Static unrelated relation

- **WHEN** candidate universe 完整、所有支持的 value/control/relation 检查完成、无 gap/截断/未建模算子，且存在可引用的 negative proof
- **THEN** 系统才输出 `PROVEN_UNRELATED`，该分支不进入任何重跑候选集

### Requirement: Evidence and proof obligations are mechanically auditable

系统 SHALL 为正向相关结论保存可回溯的 witness evidence refs，为 Unknown 保存至少一个 gap，为 `PROVEN_UNRELATED` 保存 negative proof 或已知安全 cut。证据 closure、candidate coverage、bridge closure、限制和阶段耗时 MUST 可在 artifact 中读取。

#### Scenario: Positive witness is continuous

- **WHEN** 一个候选分支被标为 `CONFIRMED_RELATED`
- **THEN** validator 能从目标写入观测经 relation/operator edge 回溯到候选生产分支，并核对每个 occurrence-specific evidence ref

#### Scenario: Negative proof is incomplete

- **WHEN** 负向搜索遇到未知 identity、未建模算子、候选覆盖边界或预算截断
- **THEN** 系统禁止生成 `PROVEN_UNRELATED`，并将该分支标为 `UNKNOWN`

### Requirement: Independent artifact preserves existing lineage compatibility

系统 SHALL 发布独立、版本化的目标表因果闭包 artifact、摘要和 HTML；HTML 只能渲染 canonical artifact，不得重新推断相关性。旧 `FIELD_MULTI_HOP_RECONCILIATION`、旧 field-lineage artifact、CLI 和 renderer MUST 保持可独立运行和读取。

#### Scenario: Legacy field lineage is run alone

- **WHEN** 调用方执行现有 field-lineage 命令或读取旧 artifact
- **THEN** 系统不要求目标表因果闭包产物存在，也不修改、删除或降级旧输出

#### Scenario: Causal closure is rendered

- **WHEN** 目标表因果闭包 artifact 已生成
- **THEN** 新 renderer 展示目标写入、候选分支、impact channels、静态状态、证据/gap、最小确定集和保守安全集，且不重新执行因果算法

### Requirement: Calcite is optional semantic enrichment, not canonical authority

系统 SHALL 允许在显式 shadow/differential 模式下，以任务/语句语义摘要为粒度调用固定版本 Calcite，复用同一摘要结果；Calcite 结果只能作为关系语义补充、交叉验证或 Unknown 解释，不得单独生成 canonical dependency、assessment、negative proof 或实际重跑决策。

#### Scenario: Calcite corroborates a mapped summary

- **WHEN** Calcite 对已精确映射的 relation/operator observation 给出一致的谓词、唯一性、函数依赖或基数 metadata
- **THEN** 系统记录可追溯的 corroboration，并保持 Native Plan/Machine Facts 为 canonical evidence

#### Scenario: Calcite is unsupported or unavailable

- **WHEN** Calcite 不支持某个方言/算子、Java 工具不可用、超限或 observation 无法映射回 occurrence
- **THEN** 系统记录 `NOT_EVALUATED` 或 unmappable 原因，不污染 Native 结论，也不把缺失当作无关证明

#### Scenario: Native and Calcite conflict

- **WHEN** 双方对同一精确映射的 relation/operator 命题给出实质冲突
- **THEN** 系统记录 `SEMANTIC_ENGINE_CONFLICT`，相关静态结论降为 `UNKNOWN`，不得配置为静默忽略

### Requirement: Re-evaluation reuses immutable inputs and is resource bounded

系统 SHALL 在输入 fingerprint 一致时复用 Input Pack、Plan/Machine Facts、producer index、table multi-hop artifact 和可用 field-lineage evidence，只执行目标表因果闭包相关阶段。CLI MUST 提供硬性的时间、内存、节点、边和深度限制；超限时 fail-fast，输出阶段耗时、已完成范围和 Unknown boundary，不隐式触发全量采集。

#### Scenario: Cached 209119 re-evaluation

- **WHEN** 209119 的既有输入 fingerprint 一致且调用方执行 causal-only 模式
- **THEN** 系统不重新采集全量任务、不重建旧 field-lineage、不重建全量 producer index，并只生成独立闭包 JSON/摘要/HTML

#### Scenario: Resource budget is exceeded

- **WHEN** 闭包达到时间、内存、图规模或深度上限
- **THEN** 系统停止扩展受影响范围，保留已闭合证据，生成结构化 Unknown/gap 和阶段指标，不能把截断分支标为 `PROVEN_UNRELATED`

#### Scenario: Performance regression is detected

- **WHEN** 参考任务 209119 在复用输入的 causal-only 基准中超过约定性能门槛
- **THEN** 验收失败并报告 load、summary、Calcite、graph、propagation、validation 和 render 各阶段耗时及调用/缓存命中数；不得以提高 heap 或无限延长等待掩盖回归
