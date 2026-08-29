## Purpose

验证 Apache Calcite 能否在当前 Horae/Hive SQL 与 Schema 证据边界内，成为单条 SQL 关系语义的唯一主来源，并生成可精确映射、可保守降级且可由 TypeScript 因果引擎直接消费的候选任务语义事实。

## ADDED Requirements

### Requirement: Immutable SQL and schema input

POC SHALL 以固定 SQL snapshot、明确的 SQL source/statement identity、Schema fingerprint、方言配置和动态参数声明作为输入。每次输出 MUST 携带输入 hash、Provider version、Calcite version 和方言适配版本；不得访问实时 Horae 或以运行期查询结果补足缺失事实。

#### Scenario: Repeated analysis of the same statement

- **WHEN** 相同 SQL、Schema、方言配置和 Provider 版本被重复分析
- **THEN** 系统产生内容等价且 hash 稳定的候选 TaskSemanticFacts

#### Scenario: Required schema or parameter type is missing

- **WHEN** Calcite validate 或 metadata 推导需要的字段类型、nullable、函数签名或动态参数类型无法确定
- **THEN** 对应 statement、operator 或 fact 输出结构化 `UNSUPPORTED`、`NOT_EVALUATED` 或 `UNKNOWN`，不得使用 `ANY`、字段名猜测或默认类型制造确定结论

### Requirement: Calcite is the sole relational semantic provider in the POC

对于 capability matrix 声明支持的 JOIN、FILTER、PROJECT、AGGREGATE、SETOP、WINDOW、Top-N 和 expression 语义，POC SHALL 仅接受由 Calcite parse/validate 后的 RelNode、RexNode 或 metadata 派生的语义事实。TypeScript consumer 和 Native evidence adapter MUST NOT 重新解析或补算这些关系语义。

#### Scenario: Supported filter and join

- **WHEN** Calcite 成功验证包含过滤和连接的 SQL，并形成可映射的关系计划
- **THEN** 候选 Facts 直接包含对应 predicate、input/output occurrence、dependency role 和 impact kind，TypeScript consumer 只读取这些事实

#### Scenario: Calcite cannot prove a supported capability instance

- **WHEN** 某个声明支持的算子实例因方言、类型、函数或 metadata 边界无法形成确定事实
- **THEN** 系统输出该实例的 `UNKNOWN`、`UNSUPPORTED` 或 `ERROR`，Native 或 TypeScript 不得覆盖、修正或补算

### Requirement: Native responsibilities are evidence-only

Native 侧 SHALL 仅提供 SQL 原文、Token、expression/source span、Horae SQL slot、statement identity、物理表字段身份和既有 evidence refs。alias、scope、relation occurrence、field occurrence 和 Calcite slot 到 Native evidence 的组装 MUST 在 Provider/Assembler 边界完成，并且不得依赖 substring、tail table-name 或裸字段名猜测。

Evidence mapping 状态 MUST 区分 `NOT_ATTEMPTED`、`NOT_ASSEMBLED`、`AMBIGUOUS`、`UNMAPPABLE` 和 `EXACT`。缺少 Native evidence 输入或未调用 Assembler 时不得报告 `UNMAPPABLE`。

#### Scenario: Self join uses the same physical table twice

- **WHEN** 同一物理表在一条 SQL 中以两个 alias 被读取
- **THEN** 输出为两个不同的 `relationOccurrenceId` 和 `fieldOccurrenceId`，同时允许它们引用相同 `physicalFieldId`

#### Scenario: Occurrence mapping is ambiguous

- **WHEN** Calcite relation/slot 无法唯一映射到 Native statement、occurrence 或 source evidence
- **THEN** 该对象被标为 unmappable/unknown，并且不得进入确定 dependency 或 metadata 结论

#### Scenario: Evidence assembler was not run

- **WHEN** Provider 已生成本地 dependency，但真实流程未提供 Native statement evidence 或未调用 Assembler
- **THEN** mapping 状态为 `NOT_ASSEMBLED` 或 `NOT_ATTEMPTED`，报告不得将其解释为结构性不可映射

#### Scenario: Same-front-end source map

- **WHEN** Calcite 从 SqlNode 转换为 RelNode/RexNode 并生成本地 dependency
- **THEN** Provider 保留可审计的 SqlNode occurrence/source position 到关系算子和输入 slot 的映射；Assembler 只将叶子 TableScan/字段 occurrence 对接 Native physical read evidence，不要求两套派生关系图同构

### Requirement: Candidate TaskSemanticFacts are normalized and consumable

POC SHALL 生成版本化的 `CandidateTaskSemanticFacts` JSON/JSONL，而不是直接发布 RelNode dump。Facts MUST 至少包含 statement identity、operator、input/output slot、relation/field occurrence、local dependency、impact kind、evidence refs、capability 状态和 metadata 状态；输出 SHALL 能被无 Java 依赖的 TypeScript consumer 校验和读取。

#### Scenario: TypeScript consumer loads a valid candidate fact file

- **WHEN** Provider/Assembler 输出满足 schema 的候选 Facts
- **THEN** TypeScript consumer 在不执行 SQL 语义推导的情况下读取 operator、dependency、capability 和 evidence mapping，并产生确定性摘要

#### Scenario: RelNode dump is supplied instead of canonical facts

- **WHEN** 输入只包含 Calcite 内部节点 dump，缺少稳定 occurrence、slot、capability 或 evidence identity
- **THEN** TypeScript consumer 拒绝该输入并返回结构化 contract error

### Requirement: Metadata status separates execution from knowledge quality

每项 metadata SHALL 分别保存 `evaluationStatus` 和 `knowledgeStatus`。`evaluationStatus` 至少包含 `EVALUATED`、`NOT_EVALUATED`、`UNSUPPORTED` 和 `ERROR`；`knowledgeStatus` 至少包含 `EXACT`、`DERIVED`、`ESTIMATED` 和 `UNKNOWN`。空集合或 null MUST NOT 自动解释为已证明不存在。

#### Scenario: Row count is estimated from statistics

- **WHEN** Calcite 根据可用统计信息返回行数估计
- **THEN** 结果标记为 `EVALUATED + ESTIMATED`，并记录 metadata basis，不得标为 exact/confirmed

#### Scenario: No unique key is returned

- **WHEN** unique-key metadata 已调用但 Calcite 未返回可用 key
- **THEN** 结果保留 `knowledgeStatus=UNKNOWN` 和 `absenceProven=false`，不得推导“已证明没有唯一键”

### Requirement: Capability and unsupported boundaries are machine-readable

每个 statement、operator 或 fact SHALL 声明 Provider、整体状态、已支持 capability 和未支持 capability/reason。对已声明支持的事实，Native 不得提供第二份语义结论；对未支持范围，系统 MUST 明确暴露 Unknown 边界。

#### Scenario: Partially supported statement

- **WHEN** 一条 statement 的 JOIN/FILTER 可评价，但某个 vendor function 或 lateral 结构不可评价
- **THEN** statement 状态为 `PARTIAL`，支持和不支持 capability 分别列出，已评价结果保留，未评价范围不得静默删除

#### Scenario: Previously unsupported project expression

- **WHEN** 既有 `PROJECT_EXPRESSION_STRUCTURE_UNSUPPORTED` 真实样本进入 POC
- **THEN** Calcite 要么生成精确表达式 dependency，要么保留明确 unsupported/unknown；测试不得通过修改 SQL、手填 dependency 或 TypeScript fallback 隐藏该边界

### Requirement: POC outputs are isolated from production artifacts

POC SHALL 只写独立 staging 目录中的候选 Facts、样本输出、支持矩阵、性能报告和最终决策，不得写入或覆盖现有 field-lineage、multi-hop、target-field causal slice、target-table causal closure 或 `artifacts/tasks/` 文件。

#### Scenario: POC succeeds or fails

- **WHEN** 任意 POC 样本、真实 SQL 或批量验证运行结束
- **THEN** 现有 production canonical artifacts 和 Native assessments 的内容与 hash 保持不变

### Requirement: Representative corpus and decision gate

POC SHALL 覆盖 8～10 类代表性 SQL 和至少一条现有项目真实复杂 SQL，包括 projection、CASE/IF/COALESCE、filter、不同 join/self join、aggregate/COUNT(*)、distinct/setop、EXISTS/literal/CROSS JOIN、window 和 Top-N。最终报告 MUST 给出 `DIRECT_PROVIDER`、`THIN_ADAPTER_REQUIRED`、`VALIDATION_ONLY` 或 `NO_GO` 之一，并逐项引用语料、映射、unsupported 和性能证据。

每个代表性 fixture MUST 以完整 golden semantic edge 验收，而不是只检查 dependency kind 是否出现。Golden 至少包含 dependency kind、impact kind、operator/join/setop 角色、规范化 from/to 端点；校验必须拒绝缺失边、意外边和重复边。

#### Scenario: Thin adapter is sufficient

- **WHEN** 真实复杂 SQL 仅需有界、可审计且不改变关系语义的方言适配，就能获得精确映射的 Calcite 事实
- **THEN** POC 结论可以为 `THIN_ADAPTER_REQUIRED`，并列出允许的转换和剩余 Unknown

#### Scenario: Heavy semantic rewrite is required

- **WHEN** 真实 SQL 必须依赖大规模 AST 重写、字段名猜测或另一套 Native operator 规则才能得到结果
- **THEN** POC 结论必须为 `VALIDATION_ONLY` 或 `NO_GO`，不得进入生产接入

#### Scenario: Dependency kind exists but endpoints are wrong

- **WHEN** Provider 输出了预期 dependency kind，但端点、方向、impact kind、输入侧角色或重复度与 golden 不一致
- **THEN** 该样本不得标为 semantic success，支持矩阵必须显示 `PARTIAL` 或 `FAILED`

### Requirement: Execution is bounded and cached by semantic input

POC SHALL 在单一有界 JVM 中批量执行，并按 SQL hash、Schema fingerprint、方言适配版本和 Provider/Calcite 版本形成 semantic digest。每个 digest 在一次运行中最多分析一次；超时、内存或输出限制 MUST 形成显式边界而不是无限等待。

#### Scenario: Multiple consumers request the same statement

- **WHEN** 多个候选分支或测试引用相同 semantic digest
- **THEN** Provider 只执行一次并复用 Facts，不按字段、candidate branch 或 target field 重复调用 Calcite

#### Scenario: Resource budget is exceeded

- **WHEN** parse、validate、metadata 或输出超过配置的 deadline、heap、节点或字节限制
- **THEN** 当前输入以结构化 `ERROR`/`UNKNOWN` 结束，其他输入继续或安全停止，且不产生部分确定性事实

### Requirement: Calcite indirect-impact value gate

POC SHALL 在真实复杂 SQL 的同一份 `CandidateTaskSemanticFacts` 上比较两种只读图投影：仅沿 `FIELD_VALUE` 的值血缘基线，以及沿 Calcite 已显式输出的全部 `impactKind` 的影响投影。TypeScript MUST NOT 根据 operator kind、SQL 文本或字段名补算影响类型；它只能传播 Provider 已发布的 dependency 与 impact。

每条可确认的 impact witness MUST 从一个精确映射的 Native physical read occurrence 出发，经 `EVALUATED` dependency、存在的 Calcite operator 和 `EXACT` evidence mapping 到达唯一的 Calcite root relation。该 witness 使用 `CALCITE_VALIDATED_PLAN` 坐标和稳定 digest；它 MUST 明确保留 `operatorSourceSpanStatus=NOT_ASSEMBLED`，不得冒充原 SQL operator span 或 production evidence closure。

#### Scenario: Calcite retains an indirect-only read

- **WHEN** 某个 physical read occurrence 没有纯 `FIELD_VALUE` 路径到 root，但存在一条完整、精确的 `ROW_MEMBERSHIP`、`MULTIPLICITY`、`EXPRESSION_CONTROL`、`NULL_EXTENSION` 或 `RELATION_EXISTENCE` 路径
- **THEN** 报告将该 occurrence 标为 `INDIRECT_ONLY`，给出 dependency/operator/evidence witness，并计入 Calcite 相对值血缘基线的净新增读取

#### Scenario: Direct path and uncertain alternative coexist

- **WHEN** 同一读取存在一条精确 `FIELD_VALUE` 路径，同时另一路径包含未评价或不可精确映射的 dependency
- **THEN** 精确路径仍被保留，未知路径的 gap 同时保留；未知备选路径不得推翻已有精确 witness

#### Scenario: No path is observed

- **WHEN** 当前 Facts 中没有从某个 physical read occurrence 到 root 的完整路径，或遍历预算被截断
- **THEN** 结果只能是 `NOT_REACHED/UNKNOWN`，不得生成 `PROVEN_UNRELATED` 或任何 negative proof

#### Scenario: Value is not demonstrated

- **WHEN** 真实 SQL 中不存在至少一个具有精确 Native occurrence 与完整 Calcite plan witness 的 `INDIRECT_ONLY` 读取
- **THEN** 本价值门禁输出 `NO_GO` 并停止扩大工程；不得用语料覆盖率或 dependency 数量替代该业务价值证据

### Requirement: Occurrence-aligned three-way net-value gate

POC SHALL 在相同 SQL source identity、相同 target write root 和相同 physical read occurrence 上，对齐比较现有 field-lineage `VALUE_FLOW`、现有 Native `rowsetControls`/Machine Facts relation evidence 与 Calcite impact facts。差分 MUST 保留三方各自的状态、证据引用、impact/control 类型和 mapping gap，不得把 Calcite 内部的 FIELD_VALUE baseline 当作现有 Native 字段血缘。

Root identity MUST 由目标 `write_observation_id` 对应的 output binding 和 statement identity 唯一确定。Occurrence identity MUST 使用显式 `read_occurrence_id`；旧 bundle 仅在 read relation id、完整 source span 和 qualified physical table 同时唯一时允许 legacy exact 映射。任何 CTE 名、substring、tail table-name 或裸字段名 fallback SHALL 被拒绝。

#### Scenario: Native and Calcite use different impact labels for the same occurrence

- **WHEN** Native rowset control 通过精确 relation evidence 保留一个 JOIN read，而 Calcite 通过 `MULTIPLICITY` 或 `NULL_EXTENSION` witness 保留同一 occurrence
- **THEN** 该 occurrence 归为 Native/Calcite overlap，并分别保存原始 control 与 Calcite channel；不得因为标签不同误报 `CALCITE_ONLY`

#### Scenario: Calcite finds a genuinely additional occurrence

- **WHEN** Calcite 以完整、精确的 indirect witness 到达一个 physical read occurrence，现有 VALUE_FLOW 和 Native indirect evidence 均未保留它，而且对应 Native artifact/occurrence mapping 覆盖完整
- **THEN** 该 occurrence 标为 `CALCITE_ONLY`，并可计入 `CALCITE_NET_INCREMENTAL_VALUE_PROVEN`

#### Scenario: Native coverage is incomplete

- **WHEN** Calcite 命中一个 Native 未观察到的 occurrence，但 field-lineage 为 `PARTIAL`、存在 unresolved control、同表多 occurrence 歧义或 fingerprint/root 无法闭合
- **THEN** 结果只能是 `CALCITE_ONLY_CANDIDATE` 或 `UNKNOWN`，不得宣称 Calcite 净增价值

#### Scenario: Native retained the physical table but not the exact occurrence

- **WHEN** Calcite 以精确 witness 命中一个 occurrence，而 Native 已通过完整物理表身份保留同表读取、但因 CTE/derived/self-join 边界无法唯一选择 occurrence
- **THEN** 该差异只能标为 `OCCURRENCE_PRECISION_ONLY`，不得计为新增重跑表、任务或 `CALCITE_NET_INCREMENTAL_VALUE_PROVEN`

#### Scenario: A selected real case has multiple SQL sources

- **WHEN** 一个案例无法将目标 root 精确映射到唯一原始 SQL source，且没有完整多 source source-map
- **THEN** 该案例保留在矩阵中并显示 `NOT_EVALUATED` 与明确原因，不得静默选择 query/finish 中任意一个 source

#### Scenario: Target root closes one statement inside a multi-source task

- **WHEN** `write_observation_id`、output binding、statement id、SQL slot 全部唯一闭合，且 Machine Facts statement 在该原始 slot 中唯一精确命中
- **THEN** Provider MAY 只分析该 target statement，并 MUST 保留 statement id、ordinal、原始 SQL hash 与 slot locator；其它 SQL slot 不得进入该请求

#### Scenario: Machine Facts analysis added a statement terminator

- **WHEN** 合并 SQL slot 的 Machine Facts 视图仅在目标 statement 末尾增加了分号和空白
- **THEN** 输入适配 MAY 去除该末尾补充并要求结果在原始 slot 中唯一精确命中；任何其它近似、substring 猜测或多重命中 MUST fail closed

#### Scenario: Canonical Facts approach the output budget

- **WHEN** Provider 已在 canonical Facts 中表达 dependency、metadata 和 evidence mapping
- **THEN** 响应不得再输出语义等价的 legacy `observations` 副本；相同的 provider-local pending-mapping 状态 MAY 使用一个共享 issue，但每条 dependency 的独立 mapping MUST 保留，且不得通过提高 hard limit 隐藏体积问题

#### Scenario: No system observes a path

- **WHEN** A/B/C 均未观察到当前 occurrence 到 root 的路径
- **THEN** 报告仅陈述 `NOT_OBSERVED/NOT_EVALUATED/UNKNOWN`，不得生成 `PROVEN_UNRELATED`
