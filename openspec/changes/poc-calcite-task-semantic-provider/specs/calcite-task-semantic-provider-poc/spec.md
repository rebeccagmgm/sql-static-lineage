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
