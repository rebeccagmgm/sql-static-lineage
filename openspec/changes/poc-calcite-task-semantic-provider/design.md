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

Corpus 的 `SUCCESS` 不能只由 dependency kind 集合决定。每个 fixture 使用完整 semantic edge golden，比对规范化 from/to occurrence、dependency kind、impact kind、operator/join/setop 角色，并拒绝重复边和意外边。当前 kind-only 结果统一称为 `PARSE_AND_KIND_COVERAGE_SUCCESS`，不作为边语义正确性的证明。

本地语义优先收口以下已观测缺口：LEFT/RIGHT/FULL JOIN preserved/optional side、correlated EXISTS 外层引用、Window 双路径重复、CROSS JOIN multiplicity，以及 DISTINCT/INTERSECT/EXCEPT 的不同成员角色。

Gate 的结果只允许：

```text
DIRECT_PROVIDER
THIN_ADAPTER_REQUIRED
VALIDATION_ONLY
NO_GO
```

判定 `DIRECT_PROVIDER/THIN_ADAPTER_REQUIRED` 的必要条件：支持范围内 Calcite 是唯一关系语义来源；所有 evaluated dependency 映射精确；真实 SQL 不依赖重型语义改写；unsupported 可定位；输出确定；资源可接受。confirmed 数量或 Native Unknown 数量不是单独的通过标准，因为当前 209119 的大量 Unknown 来自跨 Task candidate/bridge 边界，Calcite不负责解决这些缺口。

POC Gate 分层报告：Gate A 为 Calcite direct extraction；Gate B 为 canonical local semantic correctness；Gate C 为 Native/source evidence assembly；Gate D 为 production causal integration。Gate C 未运行时只能报告 `NOT_ATTEMPTED/NOT_ASSEMBLED`，不能以 `0/N UNMAPPABLE` 声称结构性失败；Gate D 始终不在本 Change 中启动。

Source map 在 Calcite 同一前端内建立：保留 SqlNode parser position/occurrence，并传播到 RelNode/RexNode 生成的 operator/slot。与 Native 的闭合边界只覆盖 statement identity、叶子物理 table/field occurrence、source span 和 evidence refs；不实施 Calcite 派生图与 Native CTE/scope 图的一一 reconciliation。

### 10. Measure cost before production integration

POC 的建议验收预算为：单 JVM 完成全部样例冷启动不超过 30 秒；真实复杂 statement 在 JVM 已启动时不超过 5 秒；heap 上限 1 GiB；每个 semantic digest 每次运行最多执行一次。预算是验收目标，不作为当前已测事实。

POC 不运行完整 multi-hop。若 Gate 通过，后续生产 Change 才验证按 unique task/statement digest 预计算和缓存 Facts：209119 不得按 542 个 candidate branch 调用 Calcite，hot-cache causal closure 不应启动 Java。

### 11. Reuse the existing Input Pack preparation boundary

真实 SQL POC 不再手工接收 frozen SQL path、schema snapshot path 并重新发现 DDL。它必须通过现有 `prepareInputPackTask` 读取并验证 Input Pack，复用已有 SQL slot 选择、任务方言、SQL hash、schema bundle、物理表身份、DDL hash 和稳定输入校验，再把原 SQL 与 typed schema 直接交给 Calcite。

这个复用边界不等于 `Plan Facts -> Calcite`：POC 不把 Plan Facts、Machine Facts operator 或 Native relation semantics 投影成 Calcite RelNode。Calcite 仍直接 parse/validate SQL；Native 只提供输入与证据身份。Calcite 专属方言桥只保留有 manifest、可逆 source map 且不改变关系语义的最小转换。

为避免伪造 source evidence，首版只接受能够与一个原始 Input Pack SQL source 精确同一的分析 SQL。多 slot 拼接、重复 SQL 归一化或其他 derived analysis SQL 在没有完整 source map 前必须 fail closed，不得继续使用某个原文件路径充当其 source evidence。

### 12. First prove Calcite-internal indirect semantics

最后的价值门禁不再追求补齐 operator source span，也不扩大 Calcite operator support。它在真实 209119 Facts 上形成两个可比较投影：

```text
Calcite FIELD_VALUE-only graph
              versus
Calcite all declared impact channels graph
```

若一个精确 Native read occurrence 在第一张图中无法到达 root、但在第二张图中通过完整的 Calcite dependency path 到达，则它是 `INDIRECT_ONLY`。这直接证明 Calcite 能保留纯字段值传播无法解释的上游读取。TypeScript 只执行通用图传播、预算和 witness 组装；不读取 SQL、不按 operator kind 分支，也不推导 impact kind。

Calcite `RelNode`/`RexNode` 当前不能可靠提供所有原 SQL operator span。POC 不再通过 AST 与 RelNode ordinal 配对伪造该映射，而是新增严格分离的 plan-coordinate witness：它绑定 SQL/schema/dialect/provider fingerprint、root/source relation、完整 normalized dependencies/operators、精确 Native leaf occurrence/evidence refs，并计算稳定 SHA-256。该 witness 可以证明“Calcite validated plan 内存在这条语义路径”，但不满足 production source-span closure；总体 Provider 决策继续为 `VALIDATION_ONLY`。

Root 使用 Provider 的显式 POC 契约：relation traversal root 必须是唯一 `providerOrdinal=0` 的 relation。缺失或多重 root、非精确 leaf mapping、dependency 未评价、mapping 非 EXACT、operator 缺失或预算截断均形成 gap。没有路径仅表示 `NOT_REACHED/UNKNOWN`，通用 `PROVEN_UNRELATED` 继续关闭。

该门禁只证明 Calcite 自己的全影响图比 Calcite 自己的 `FIELD_VALUE` 投影多保留间接影响；它不是相对现有 Native 实现的净价值结论。报告独立于生产因果闭包，不改写 canonical artifact 或重跑结论。

### 13. Prove net value against the current Native artifacts

第 12 节的 `FIELD_VALUE-only versus all Calcite impacts` 只能证明 Calcite 内部存在间接语义，不能证明这些读取是当前 `src / plan-adaptor / field-lineage` 没有保留的净新增。因此终局价值判断增加 occurrence-aligned 三方差分：

```text
同一 SQL source + 同一 target write root + 同一 physical read occurrence

A. 现有 field-lineage VALUE_FLOW
B. 现有 rowsetControls / Machine Facts relation evidence
C. Calcite impact facts
```

三方差分只读取现存 canonical artifact、Machine Facts 和 POC staging；不得重跑或改写 canonical pipeline。根由 `write_observation_id -> output-field-bindings.statement_id` 精确确定。物理读取 identity 使用 `read_occurrence_id`，旧 bundle 缺少该字段时只允许使用同一条 read relation 的完整 `relation_id + source_span + qualified table` 作为 legacy exact occurrence；CTE 名、tail table name、substring 和裸字段名均不得进入对齐。

Native VALUE_FLOW 只有在物理表在当前 statement/root scope 内对应唯一 read occurrence 时才能提升为 occurrence-level positive evidence；同表多 occurrence 且现有 artifact 未保留 alias/occurrence 时必须为 `UNKNOWN`。Native 间接影响从 root node 已发布的 `rowsetControls` 出发，并通过其精确 `relationId`、Machine Facts relation input graph、完整物理 identity 与 qualifier/binding 映射到 read occurrence。两边 impact channel 命名不同不构成冲突：Native `join` 与 Calcite `MULTIPLICITY` 可以同时归为该 occurrence 已被两边保留，但原始 control/channel 与 evidence refs 必须分别保存。

每个 occurrence 输出 A/B/C 三份独立状态和 overlap class。`C_ONLY` 只有在 Calcite witness、Native occurrence、root/fingerprint 全部精确时才成立；若 Native artifact 为 `PARTIAL`、存在 unresolved control、同表 occurrence 歧义或缺少必要 mapping，只能输出 `CALCITE_ONLY_CANDIDATE`，不得宣称净增价值。若 Native 已用完整物理表身份保留该读取、但无法区分同表 occurrence，则只记为 `OCCURRENCE_PRECISION_ONLY`：它证明 Calcite提高了 occurrence/channel/witness 精度，不代表新增重跑表或任务。只有 `COMPLETE` Native coverage 下至少一个精确的 Calcite indirect occurrence 同时未被 A/B 以精确或粗粒度证据保留，才允许 `CALCITE_NET_INCREMENTAL_VALUE_PROVEN`。

首批真实矩阵固定为 `93338 / 155015 / 176827 / 181058 / 209119`。每个唯一 SQL/schema digest 至多执行 Calcite 一次。输入准备失败的案例仍必须出现在最终矩阵中并显示结构化 `NOT_EVALUATED`。多 SQL source 只有在 `write_observation_id -> output binding -> statement_id -> SQL slot` 唯一闭合，且该 statement 原文在对应原始 slot 中唯一命中时才允许选取目标 statement；否则不得偷偷选择 query/finish 中任意一个 source。Machine Facts 合并视图只允许审计明确的末尾补充分号规范化，不接受其它文本近似。没有路径或没有观察到现有 evidence 继续不表示 `PROVEN_UNRELATED`。

### 14. Final bounded result

最后一次五案例门禁只修复两个有现成证据支持的结构问题：目标 statement 精确选择，以及 Provider 同时输出 legacy `observations` 与 canonical Facts、逐 dependency 重复同一 pending-mapping issue 造成的体积膨胀。后者不提高 4 MiB 限额，不删除任何 dependency/evidence mapping，只删除重复表示并共享同一 `NATIVE_EVIDENCE_NOT_ASSEMBLED` issue。

修复后 93338 从 `OUTPUT_LIMIT` 进入 evaluated，155015 和 209119 继续 evaluated；176827 因缺少正式 `pretradedate` UDF 类型契约保持 `FUNCTION_UNSUPPORTED`；181058 已精确选择 query statement 0，但 Calcite parser 不支持 Hive `LATERAL VIEW POSEXPLODE`，保持 `PLANNER_FAILURE`。A/B/C 门禁在 68 个物理读取 occurrence 上得到一个 93338 `CALCITE_ONLY_CANDIDATE` 和六个 209119 `OCCURRENCE_PRECISION_ONLY`，没有 `CALCITE_NET_INCREMENTAL_VALUE_PROVEN`。

因此终局仍为 `VALIDATION_ONLY`。这批证据证明 Calcite 可在部分真实 SQL 上提供 Native 当前未精确表达的 occurrence/channel/plan witness，并出现一个值得后续独立核验的间接影响候选；它没有证明现在应替换生产 Native 语义路径。继续适配业务 UDF 或重写 `LATERAL VIEW` 已超出本次“证明价值后再扩大工程”的边界。

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
