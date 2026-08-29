## Why

现有目标表因果闭包已经解决“目标字段 × 候选分支”的规模问题，但任务内 JOIN、FILTER、AGGREGATE 等关系语义仍由 TypeScript 规则和表达式文本启发式推导；与此同时，现有 Calcite 只作为 Plan Facts 驱动的差分旁路，尚未证明能成为真正的语义 Provider。需要一个隔离 POC，直接验证 Calcite 能否基于 SQL 与 Schema 生成稳定、精确映射且可被跨 Task 因果引擎消费的任务语义事实，从而决定是否停止重复建设 Native 关系算子语义。

## What Changes

- 新增独立的 Calcite Task Semantic Provider POC：以固定 SQL snapshot、Schema 和显式方言配置为输入，执行 Calcite parse、validate、RelNode 构造和 metadata 查询。
- 新增 POC-local `CandidateTaskSemanticFacts` 契约，规范 operator、relation/field occurrence、input/output slot、dependency role、impact kind、source evidence、capability 和 metadata certainty。
- 新增 Semantic Fact Assembler，将 Calcite 关系语义与 Native IR 提供的原文、Token、source span、Horae SQL slot 和物理身份证据拼接；无法精确映射时 fail closed。
- 新增只校验和消费 Facts 的 TypeScript consumer；禁止在 TypeScript 中重新推导 JOIN、FILTER、PROJECT、AGGREGATE、SETOP、WINDOW 等语义。
- 新增 8～10 条代表性 SQL 语料和至少一条现有项目真实复杂 SQL，保留 `PROJECT_EXPRESSION_STRUCTURE_UNSUPPORTED` 等既有失败作为对照实验。
- 新增可机器识别的支持矩阵、unsupported/unknown 状态、确定性输出和资源指标，并通过明确 Gate 给出 `DIRECT_PROVIDER`、`THIN_ADAPTER_REQUIRED`、`VALIDATION_ONLY` 或 `NO_GO` 结论。
- 将语料验收从 dependency kind 覆盖升级为完整 semantic edge golden：必须核对端点、方向、impact kind、算子输入侧角色、重复边和意外边。
- 将 evidence mapping 的“未运行/缺输入”与“已运行但不可映射”分开；只有映射器实际执行后才能报告 `UNMAPPABLE`。
- 在 Calcite 同一前端内保留 `SqlNode -> RelNode/RexNode` source map，只要求叶子物理读/字段与 Native evidence 精确闭合，不要求 Calcite 与 Native 派生关系图同构。
- POC 允许在当前实验分支合并或删除重复的 `calcite-oracle`、Plan Facts differential compatibility 路径，但必须先迁移仍有价值的 JSONL、资源限制、metadata 和测试能力。
- POC 不修改现有 field-lineage、table multi-hop、Machine Facts、producer bridge、target-rooted causal closure 或生产 canonical artifacts；正式生产接入必须另开 Change。

## Capabilities

### New Capabilities

- `calcite-task-semantic-provider-poc`: 验证 Calcite 作为单条 SQL 内关系语义主 Provider，并输出可审计、可降级、可由 TypeScript 消费的候选 TaskSemanticFacts。

### Modified Capabilities

无。现有生产能力在 POC 期间保持不变。

## Impact

- 新增或收敛实验目录下的 Java Calcite Provider、Facts schema、Assembler、TypeScript consumer、fixture、输出样本和验证命令。
- 复用现有 Calcite 1.42.0 JSONL/metadata/资源限制实现和真实 209119 证据，但不沿用“Plan Facts 是 Calcite 主输入”或“Native 是 canonical 关系语义”的最终架构假设。
- POC 输出只能写入独立 staging 目录，不能覆盖 `artifacts/tasks/`、字段血缘、目标字段切片或目标表闭包产物。
- 当前 worktree 中既有的 field-lineage 未提交改动不属于本 Change，不能被暂存、修改或删除。
