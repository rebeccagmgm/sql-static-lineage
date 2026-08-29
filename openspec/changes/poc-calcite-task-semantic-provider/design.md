## Context

见 `proposal.md`。当前分支已经存在三类可复用资产：稳定的 Native `src → Plan Facts → Machine Facts → field-lineage` 证据链；基于 table multi-hop、TargetWriteIdentity 和 write-scoped fixed point 的跨 Task 因果闭包；以及两个历史 Calcite 旁路——raw-SQL `calcite-oracle` 与 Plan-Facts-driven `calcite-rel-bridge/differential`。

209119 已证明目标表级 candidate branch 模型可以在约数秒和约 600 MiB 内运行，但当前 Gate B 仍未通过；最新闭包为 542 个 assessment、46 个 confirmed、496 个 unknown，且没有通过 cross-channel transfer 新关闭分支。Calcite v18 证明 Plan Facts bridge 可以批量运行和精确映射已评价 observation，但仍有 17 个 projection partial 和 1,565 个 `NOT_EVALUATED`，也没有验证 raw SQL 或减少当前关键 Unknown。

重复建设集中在 `task-relation-summary.ts` 的 operator switch、表达式文本/正则和 impact-channel 推导，以及 Plan Facts relational projector 对 typed expression/operator 的再次解释。跨 Task 候选、字段值证据、write/read occurrence、certainty algebra 和预算并不属于 Calcite 的职责。

当前是独立实验 worktree，允许在 POC 分支中合并和删除无价值的旁路/兼容代码；但既有 field-lineage 未提交改动属于其他工作，必须保持原样且不得纳入本 Change。

## Goals / Non-Goals

**Goals:**

- 直接验证 `SQL + Schema → Calcite Parser/Validator/RelNode/Metadata → CandidateTaskSemanticFacts` 是否成立。
- 在 Calcite 支持范围内只保留一个关系语义来源，不建设第二套 Native provider 或 reconciliation 决策层。
- 复用 Native 的方言输入、原始 source evidence、Horae identity 和物理身份，但把它限制为 Evidence Adapter。
- 产出稳定、精确映射、两维 metadata 状态、机器可识别 capability 和明确 Unknown 的候选 Facts。
- 通过小语料、真实复杂 SQL、确定性和资源数据作出路线决策，而不是先迁移生产链。
- 收敛现有 Calcite 代码到一个 Provider 方向，允许删除只服务旧旁路架构的重复实现。

**Non-Goals:**

- 不在本 Change 中接入 table multi-hop、重跑 CLI 或 production target-table causal closure。
- 不修改现有 field-lineage、Plan/Machine Facts、producer bridge 或 published artifacts 的行为。
- 不要求 Calcite 自动解决跨 Task bridge、write ambiguity、candidate boundary、分区或运行期重跑判断。
- 不承诺所有 Horae/Hive 方言、动态 SQL、UDTF/lateral 或 vendor UDF 在 POC 中可用。
- 不以更高 confirmed 数量作为成功条件；正确的 unsupported/unknown 可以是合格结果。
- 不保留两个完整 SemanticProvider，也不在 TypeScript 中以 fallback 方式补算 Calcite 缺失语义。

## Decisions

### 1. Use a clean-cut POC branch and a new capability

POC 在 `codex/calcite-semantic-provider-poc` 分支和 `poc-calcite-task-semantic-provider` Change 中实施。所有输出进入独立 staging。旧 `add-plan-facts-calcite-differential` 和 `target-write-upstream-causal-closure` 作为历史证据与可复用代码来源，不在本 Change 中继续勾选任务或改变其设计。

选择独立 POC 而不是继续修改旧 differential，是因为旧 Change 的核心契约是“Plan Facts 为主输入、Native 为 canonical 语义、Calcite 只旁路验证”，与本 POC 要验证的“Calcite 为关系语义主 Provider”不同。直接改写旧 Change 会混淆已完成证据和新的路线假设。

### 2. Allow dual front-end processing once per semantic digest

同一 SQL snapshot 可以同时进入 Calcite 和 Native evidence path：

```text
SQL + Schema
   ├─ Calcite Parser / Validator / RelNode / Metadata
   └─ Native Evidence Adapter: SQL slot / token / span / physical identity
                    ↓
             SemanticFactAssembler
```

POC 不坚持字面上的“只解析一次”。真正的性能约束是每个 `(sqlHash, schemaFingerprint, dialectAdapterVersion, providerVersion)` digest 只运行一次，并且绝不按字段或 candidate branch 重复解析。Native path 可以继续使用既有 parser 产物，但不得向候选 Facts贡献 JOIN/FILTER/AGGREGATE 等关系语义。

替代方案是继续从 Plan Facts 构造 Calcite RelNode；既有 v18 已证明该链可运行，但也证明 TypeScript projector 必须再次解释 expression/operator，并暴露 `PROJECT_EXPRESSION_STRUCTURE_UNSUPPORTED`，因此不作为主 Provider 路径。另一个方案是只使用 Calcite 并放弃 Native evidence；这会丢失现有 Horae identity、source span、物理字段和 field-lineage 连续证据，也不采用。

### 3. Reuse one Java boundary and converge the Calcite modules

目标目录收敛为：

```text
tools/calcite-semantic-provider/
scripts/calcite-semantic-provider/
tests/calcite-semantic-provider/
tests/fixtures/calcite-semantic-provider/
staging/calcite-semantic-provider-poc/
```

Java Provider 复用现有 Calcite 1.42.0、JSONL、hard limits、schema loading、metadata extraction 和 deterministic response；新增 SQL/schema request、方言配置、RelNode semantic extraction 和候选 Facts observation。TypeScript 只实现 schema、evidence assembler、CLI orchestration 和 consumer。

POC 早期可以直接迁移代码；迁移完成并有测试后，删除实验分支中的 `tools/calcite-oracle/`、`scripts/calcite-oracle/` 和不再使用的 compatibility wrapper。Plan Facts differential 的历史 fixture/report 可以保留为对照数据，但它的 projector/runner 不进入新 Provider 路径；若其全部有用能力已迁移且测试等价，可以删除重复实现。

不删除现有 field-lineage、target-field causal slice 和 target-table causal closure 代码。特别是 `TargetWriteIdentity`、Candidate Universe、`FieldValueEvidenceProvider`、producer bridge、`composePath`、`mergeAlternative`、budget 和 task rollup 均保留，留待 POC 通过后的独立生产接入 Change 使用。

### 4. Make the Java Provider emit normalized local semantic dependencies

Calcite Provider 不能只输出 RelNode dump。它需要从 validated RelNode/RexNode 生成稳定的 local semantic records：

```ts
type CandidateTaskSemanticFacts = {
  schemaVersion: string;
  provider: ProviderFingerprint;
  input: StatementInputIdentity;
  statementStatus: "SUCCESS" | "PARTIAL" | "UNSUPPORTED" | "ERROR";
  capabilities: CapabilityReport;
  relations: RelationOccurrence[];
  fields: FieldOccurrence[];
  operators: SemanticOperator[];
  dependencies: LocalSemanticDependency[];
  metadata: SemanticMetadata[];
  evidenceMappings: EvidenceMapping[];
  issues: SemanticIssue[];
};
```

`LocalSemanticDependency` 至少区分：

```text
VALUE_INPUT
EXPRESSION_SELECTOR
FILTER_PREDICATE
JOIN_MATCH
JOIN_CARDINALITY
GROUP_KEY
AGGREGATE_INPUT
SET_MEMBERSHIP
WINDOW_VALUE
WINDOW_PARTITION
WINDOW_ORDER
WINDOW_FRAME
ORDER_SELECTION
RELATION_EXISTENCE
```

同时输出面向因果 consumer 的 `impactKind`：

```text
FIELD_VALUE
EXPRESSION_CONTROL
ROW_MEMBERSHIP
MULTIPLICITY
GROUPING
SET_MEMBERSHIP
WINDOW_EFFECT
ORDER_SELECTION
RELATION_EXISTENCE
```

这层转换属于 Calcite Provider adapter：它依据已验证 RelNode 类型、输入、RexNode 和 metadata 建立规范化事实。TypeScript 不再通过 SQL 文本或 Machine Facts operator switch 重新推导 impact channel。

### 5. Keep source identity native and map it in the assembler

稳定 identity 不使用 Calcite 内部 node id。Assembler 以 SQL hash、SQL source slot、statement ordinal、Native relation/field occurrence、source span、qualified physical identity 和 Calcite input/output ordinal建立 mapping。

每项 evaluated dependency 必须有：

```text
operatorId
relationOccurrenceId
inputSlotId / outputSlotId
fieldOccurrenceId（适用时）
physicalFieldId（可证明时）
sourceSpan / evidenceRefs
mappingStatus=EXACT
```

self join 的两个 relation occurrence 即使物理表相同也不得合并。任何 ambiguity、scope 漂移、setop alignment 漂移或 span 无法对齐都生成 `UNMAPPABLE` issue，并使依赖保持 Unknown。Assembler 可以使用 existing Native IDs，但不能根据字段名、tail table name、expression text 或 candidate task 猜测映射。

### 6. Use explicit dialect adaptation with a transform manifest

Calcite raw-SQL 旧尝试在真实 Horae/Hive 方言上可能在 parser/validator 前失败，因此 POC 将方言适配作为被测对象，而不是隐藏实现细节。只允许以下类别的有界转换：

- 从已固定 Input Pack 中提取明确的 SQL statement/slot；
- 标识符 quoting 和 parser conformance 配置；
- 将有类型声明的动态参数替换为 Calcite parameter；
- 语义等价且能映射回原 span 的已登记语法适配。

每次转换记录 `transformKind`、before/after span、理由和可逆映射。若需要改变 join、filter、aggregate、scope、字段绑定或函数含义，当前 statement 直接 unsupported。真实 SQL 只有依赖这类重写才能通过时，POC 不得给出主 Provider GO。

### 7. Separate evaluation status from knowledge quality

Metadata 统一采用：

```text
evaluationStatus = EVALUATED | NOT_EVALUATED | UNSUPPORTED | ERROR
knowledgeStatus  = EXACT | DERIVED | ESTIMATED | UNKNOWN
```

每项 metadata 还记录 `basis`，例如 schema constraint、Calcite metadata rule 或 table statistics。unique-key 空集合、null row count、缺失 statistics 和不支持 metadata handler 都不能转成 negative proof。POC 不生成 `PROVEN_UNRELATED`。

### 8. Keep the TypeScript consumer deliberately thin

TypeScript consumer 只做：

- JSON schema/contract 验证；
- deterministic serialization/hash；
- capability、issue、metadata 和 dependency 摘要；
- 按稳定 ID 查询已有事实；
- 为未来 causal engine 提供只读接口。

明确禁止 alias/scope 解析、expression tree 重建、operator switch 语义、字段名 fallback 和 Native/Calcite semantic reconciliation。若 Calcite 不可用或 Facts 缺失，consumer 返回 provider unavailable/unknown，而不是调用 NativeSemanticProvider。

### 9. Use a representative corpus and a real failure as the value gate

语料至少覆盖十组：projection、CASE/IF/COALESCE、WHERE/HAVING/QUALIFY、inner/outer/semi/anti/self join、aggregate/GROUP BY/COUNT(*)、DISTINCT/SETOP、EXISTS/literal/CROSS JOIN、window、Top-N，以及一条真实复杂 SQL。

`PROJECT_EXPRESSION_STRUCTURE_UNSUPPORTED` 必须保留为对照：POC 要么通过 Calcite direct SQL 路径产生精确 dependency，要么明确 unsupported。不得改写 fixture 语义、手工指定 dependency 或在 TypeScript 补规则。

Gate 的结果只允许：

```text
DIRECT_PROVIDER
THIN_ADAPTER_REQUIRED
VALIDATION_ONLY
NO_GO
```

判定 `DIRECT_PROVIDER/THIN_ADAPTER_REQUIRED` 的必要条件：支持范围内 Calcite 是唯一关系语义来源；所有 evaluated dependency 映射精确；真实 SQL 不依赖重型语义改写；unsupported 可定位；输出确定；资源可接受。confirmed 数量或 Native Unknown 数量不是单独的通过标准，因为当前 209119 的大量 Unknown 来自跨 Task candidate/bridge 边界，Calcite不负责解决这些缺口。

### 10. Measure cost before production integration

POC 的建议验收预算为：单 JVM 完成全部样例冷启动不超过 30 秒；真实复杂 statement 在 JVM 已启动时不超过 5 秒；heap 上限 1 GiB；每个 semantic digest 每次运行最多执行一次。预算是验收目标，不作为当前已测事实。

POC 不运行完整 multi-hop。若 Gate 通过，后续生产 Change 才验证按 unique task/statement digest 预计算和缓存 Facts：209119 不得按 542 个 candidate branch 调用 Calcite，hot-cache causal closure 不应启动 Java。

## Risks / Trade-offs

- [Calcite parser仍无法覆盖真实 Horae/Hive SQL] → 使用机器可审计的薄方言适配；需要重型语义重写时判 `VALIDATION_ONLY/NO_GO`。
- [双 front-end 产生 occurrence 漂移] → 以同一 SQL hash/statement slot、source span 和 ordinal mapping 组装；任一不唯一映射都 fail closed。
- [Calcite metadata 经常返回 unknown] → 区分 execution/knowledge 状态；Provider 价值首先是结构和绑定正确，不伪装 statistics 完备。
- [Provider adapter 又变成手写语义引擎] → 只允许从 RelNode/RexNode 类型和 metadata 生成固定的 normalized roles；禁止 SQL 文本启发式和 TypeScript fallback。
- [删除旧旁路丢失资源限制或测试] → 先迁移 JSONL、hard limits、metadata 和 fixture，再删除；用 targeted regression 验证等价边界。
- [POC 成功被误解为重跑产品成功] → 输出明确标注 POC-local；生产接入、209119 Gate B 和 RuntimeRerunDecision 均另开 Change。
- [当前 worktree 脏文件被误提交] → 所有暂存和提交按精确路径执行，持续检查 changed-file inventory。

## Migration Plan

1. 冻结当前分支、两个未提交 field-lineage 文件、209119 target-table 指标和 Calcite v18 报告，仅作为只读基线。
2. 建立 candidate Facts schema、JSON fixture 和纯 TypeScript contract consumer。
3. 从现有两个 Calcite 工具迁移 JSONL、limits、schema loader、metadata extraction 和 runtime test 到单一 Provider 模块。
4. 实现 SQL/schema parse、validate、RelNode semantic extraction 和两维 metadata 状态。
5. 实现 Native evidence adapter、exact mapping 和 SemanticFactAssembler。
6. 运行代表性语料、真实复杂 SQL、unsupported、determinism 和资源测试，生成每条样本 JSON、支持矩阵与 POC 决策。
7. 只有在替代能力和测试已迁移后，删除实验分支中的旧 oracle/differential compatibility 路径；若 Gate 为 `VALIDATION_ONLY/NO_GO`，保留最小诊断工具或直接回滚 POC 分支，不影响生产代码。
8. Gate 为 `DIRECT_PROVIDER/THIN_ADAPTER_REQUIRED` 时，另开生产 Change：让 target-table closure 加载预计算 Facts，替换 Native `impactChannels` 语义规则；Calcite unavailable 时对应通道 Unknown，不启用第二语义 provider。

回滚策略是丢弃本 POC 分支或删除 POC-local 模块和 staging 输出；由于当前生产入口和 canonical artifact 未接入 Provider，不需要数据迁移或产物修复。

## Open Questions

- 真实复杂 SQL 的最终 fixture 从 209119 哪个 SQL slot/statement 选取，可在实现时按“同时包含 CTE、JOIN、过滤、表达式投影且已有 schema”的原则选择，不改变 POC 范围。
- POC 通过后是否将 Java Provider 作为 target-table closure 的按需进程或预计算服务，由后续生产 Change 根据 cold/hot-cache 实测决定。
