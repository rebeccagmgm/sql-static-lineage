## Context

现有仓库已经有稳定的 TypeScript parser、immutable IR、Plan Facts、Machine Facts、物理字段 resolver、producer bridge、table multi-hop artifact 和 field-lineage consumer。`dc041f5` 又补充了 Plan Facts 到 Calcite Rel 的独立差分旁路，以及 relation-level bridge 的基础能力。

但现有 `target-field-causal-slice` 仍按目标字段启动 traversal，并为每个目标字段与候选分支生成 assessment。对 209119 这类 137 字段、549 候选分支的宽表，这会重复计算同一任务/算子/关系证据，且不能自然表达没有具体字段的行存在性和重复度影响。本 change 只新增目标表级 consumer；旧 field-lineage 和旧目标字段 consumer 都是兼容输入或独立产品，不在本 change 中原地升级。

## Goals / Non-Goals

**Goals:**

- 以 `TargetWriteRef` 为目标表级 slicing criterion，按生产分支而非字段矩阵输出静态影响结论。
- 复用既有 immutable evidence，并将任务内 operator semantics 归一化为可去重的 `TaskRelationSummary`。
- 对 FIELD_VALUE 之外的 ROW_MEMBERSHIP、MULTIPLICITY、GROUPING、RELATION_EXISTENCE 和 ORDER_SELECTION 等重跑相关影响建立统一表达。
- 从现有 table multi-hop artifact 投影 candidate universe，使用 occurrence-specific bridge 做一次全局反向闭包。
- 让 Calcite 按任务/语句摘要作为可选的语义增强和差分轨，默认不阻塞生产链。
- 输出可核对的 relation status、候选集、proof/gap、coverage、limits 和阶段性能数据。
- 为 209119 提供不触发全量采集或旧字段血缘重建的 causal-only 重算与可量化性能门槛。

**Non-Goals:**

- 不重写 parser、IR、Plan Facts、Machine Facts、producer index 或旧 field-lineage contract。
- 不把 Calcite 变成 canonical parser、唯一语义来源或默认生产依赖。
- 不承诺纯静态分析能证明真实运行实例的 actual causality、分区重叠、参数变化或数据内容变化。
- 不在首版生成运行期 `MUST_RERUN` 事实；只提供静态相关性和可供策略消费的候选集。
- 不为首版追求所有 SQL 方言/UDTF/lateral/动态 SQL 的完整覆盖；未建模能力必须进入 Unknown 边界。
- 不枚举所有字段级路径或保存完整路径集合；字段级细节通过既有 field-lineage evidence 引用和有限 witness 提供。

## Decisions

### 1. Create a separate target-table consumer

新增目录建议为：

```text
scripts/reconcile/consumer/target-table-upstream-causal-closure/
├─ target-write-contract.ts
├─ task-relation-summary.ts
├─ impact-graph.ts
├─ candidate-universe.ts
├─ causal-closure.ts
├─ static-assessment.ts
├─ proof-validator.ts
├─ artifact-contract.ts
├─ format-target-table-causal-closure.ts
└─ reconcile-target-table-causal-closure.ts
```

新模块只读调用共享 evidence adapter，并使用独立 artifact type、文件名和 renderer。选择独立 consumer 而不是继续扩大 `target-field-causal-slice`，是为了让旧消费者不会因为新关系语义、图预算或 Calcite 可用性而改变行为。

### 2. Use a write-observation root and producer-branch assessment

根对象定义为：

```ts
type TargetWriteRef = {
  taskId: string;
  writeObservationId: string;
  targetTableKey: string;
  statementIndex: number;
  rootRelationId: string;
  inputFingerprint: string;
};
```

主 assessment key 为：

```text
TargetWriteRef + candidateBranchId
```

`candidateBranchId` 在 V1 继续使用现有稳定候选身份，包含 consumer/read occurrence/physical producer 等稳定身份，不包含 producer role。以后 producer index 提供稳定 write observation identity 时，可增加字段而不改变当前候选语义。

字段不是主 graph vertex。它只在 `FIELD_VALUE`、`EXPRESSION_CONTROL` 等需要解释字段证据时作为 subject，并引用旧 field-lineage 或 shared physical evidence；因此不会产生 137×549 的 assessment 数量。

### 3. Normalize once into task relation summaries

每个唯一的 task、statement、root relation/semantic digest 只生成一个摘要。摘要记录：

```ts
type TaskRelationSummary = {
  taskId: string;
  statementIndex: number;
  rootRelationId: string;
  digest: string;
  readImpacts: ReadonlyArray<{
    readOccurrenceId: string;
    impactChannels: ImpactChannel[];
    operatorEvidenceRefs: string[];
    fieldEvidenceRefs: string[];
    relationEvidenceRefs: string[];
    gaps: string[];
  }>;
};
```

Native Plan Facts/Machine Facts 负责确定“观察到的 operator、occurrence 和证据”；summary 负责把这些事实映射为重跑相关影响通道。Calcite 以 `digest` 为缓存键补充 predicates、unique keys、functional dependencies 和 cardinality metadata，不以字段或候选分支为缓存键。

首版 operator semantics 按批次实现：

1. project/value、CASE/IF/COALESCE 和 expression subquery；
2. filter/having/qualify、inner/outer/semi/anti/cross join；
3. aggregate、GROUP BY、COUNT(*)、DISTINCT 和 set operation；
4. window value/partition/order/frame、ORDER + LIMIT/TOP/FETCH；
5. relation existence/cardinality，包括 EXISTS、literal-from-relation 和 fieldless dependency。

JOIN dependency 不以 uniqueness 为前提；uniqueness 只更新 `MULTIPLICITY` 的 certainty。普通 ORDER BY 和普通 window context 不自动变成 row membership dependency。

### 4. Build a deduplicated global impact graph

图的节点以 relation/read/write occurrence 为主，边以生产者到消费者方向保存，边上携带：

```text
candidateBranchId
readOccurrenceId
impactChannels
pathCertainty
evidenceRefs
gapRefs
```

构图顺序是：

```text
TaskRelationSummary
  → exact read occurrence
  → producer bridge / relation bridge
  → producer write observation
  → GlobalImpactGraph
```

从 `TargetWriteRef` 反向传播一次。传播状态只保留节点、impact-channel bitset、`PathCertainty`、深度和少量 witness predecessor；不保存所有 root field、所有路径或所有字段组合。重复到达同一节点时使用集合并集和保守 certainty 合并，直到固定点或预算停止。

为避免跨任务闭环造成无限传播，使用稳定 occurrence/branch 状态键和共享 depth 上限；只有在实际输入出现强连通循环时再增加 SCC 压缩，不能用循环上限掩盖未知证据。

### 5. Keep positive propagation and negative proof separate

正向传播只回答“已发现哪些可能影响”；它可以形成 `CONFIRMED_RELATED` 或 `CONDITIONAL_RELATED` 的候选证据。最终 assessment 还要读取 candidate universe coverage 和 gap。

首版 `PROVEN_UNRELATED` 只允许安全规则：候选分支已在完整静态边界中枚举、所有支持的 operator/channel 都已检查、没有 gap/截断/未建模 operator，并且有明确的 no-path cut。没有满足这些条件时即使没有找到路径也只能是 `UNKNOWN`。

`UNKNOWN` 不向未枚举的上游虚构分支传播；对 candidate universe 中已知属于已证明 cut subtree 的分支，可以引用同一个 negative proof，记录继承来源。

### 6. Separate static assessment from runtime rerun policy

canonical artifact 保存：

```text
relationStatus
impactChannels
evidenceRefs
gapRefs
negativeProofRefs
```

另设策略投影保存：

```text
rerunDecision
decisionBasis
runtimeEvidenceRefs
```

本 change 的默认投影为：

```text
minimumCertainSet = CONFIRMED_RELATED
conservativeSafetySet = CONFIRMED_RELATED
                          + CONDITIONAL_RELATED
                          + UNKNOWN
```

它们是静态候选集，不等价于某个运行实例的必然重跑列表。后续接入分区、参数、运行状态和数据变化时，只新增 RuntimeRerunPolicy consumer，不改变静态闭包证明。

### 7. Reuse Calcite as a bounded shadow semantic track

Calcite 继续复用 `dc041f5` 的 Plan Facts Rel 投影和 JSONL bridge。目标表闭包只为唯一 semantic digest 请求一次（或命中缓存），请求超限、Java 不可用或无法映射时记录 `NOT_EVALUATED`，不阻塞 Native summary。

只有双方对同一已映射命题发生实质冲突时，才生成 `SEMANTIC_ENGINE_CONFLICT` gap 并把受影响结论降为 Unknown。Calcite 单方额外 metadata 先作为 validation observation；若要改变 Native transfer rule，必须沉淀为有 source/evidence 映射的回归 fixture。

### 8. Make performance a measured contract

causal-only CLI 的阶段必须分别计时：

```text
input load
summary normalization
Calcite shadow (if enabled)
candidate projection
graph build
reverse propagation
assessment/proof validation
artifact + renderer
```

每阶段输出调用次数、cache hit/miss、节点数、边数、候选数、witness 数和峰值内存。209119 的首轮验收使用已固定 fingerprint 的输入，不包含全量 Horae 采集；目标是缓存复用模式 5 分钟内、峰值 1GB 内，超出即失败并定位阶段。冷启动采集另行测量，不把外部采集耗时混入算法性能结论。

### 9. Preserve compatibility and publish independently

新 artifact 不覆盖：

```text
FIELD_MULTI_HOP_RECONCILIATION
target-field-causal-slice.json/html
```

新 renderer 只读取目标表闭包 artifact。共享 resolver/expander 若需要补强，先用旧 field-lineage golden、occurrence bridge 和 hash 检查锁定兼容性；任何旧输出变化都作为回归失败，而不是顺手更新基线。

## Risks / Trade-offs

- [Relation-level graph 仍可能很大] → 以 task/statement digest 去重，按 relation occurrence 建图，只保留 channel bitset 和少量 witness，并使用硬预算 fail-fast。
- [一次全局传播可能掩盖某个局部分支的证据差异] → 边和 assessment 仍保留 candidateBranchId、read occurrence、certainty、gap 和 evidence refs，合并只发生在共享语义节点。
- [没有稳定 producer write observation ID] → V1 使用现有稳定 candidateBranchId，并把 `TargetWriteRef` 纳入 assessment key；待 producer index 契约成熟后再无损升级。
- [Calcite 方言或 Plan Facts 投影不完整] → Calcite 只做 shadow enrichment；unsupported/unmappable 进入 `NOT_EVALUATED` 或 Unknown，不影响 Native canonical facts。
- [唯一性/函数依赖缺失导致大量 Conditional] → 将 dependency existence 与 multiplicity refinement 分开；不因缺少唯一键而删除明确 JOIN 结构依赖。
- [table artifact coverage 不完整] → 显式 candidate boundary 和 coverage status；禁止在边界内生成 `PROVEN_UNRELATED`。
- [共享 adapter 改动影响旧字段血缘] → 通过兼容 re-export、旧 golden、artifact hash 和独立 causal-only 开关验证，必要时回滚新 consumer而不回滚旧链路。
- [严格 5 分钟/1GB 门槛不适用于冷启动] → 门槛只约束复用 fingerprint 的 causal-only 基准，采集和浏览器/外部服务耗时单列。

## Migration Plan

1. 冻结 `dc041f5` 及旧 field-lineage/target-field 产物和 golden；确认新 change 不修改其 contract。
2. 建立目标表闭包 contract、artifact schema、CLI 参数和阶段指标；先用静态 fixture 验证根粒度和候选投影。
3. 复用现有 resolver、producer bridge、relation bridge 和 Calcite differential adapter，补齐稳定 branch identity、bridge closure 统计和兼容测试。
4. 实现 task relation summary 和 operator/channel transfer rules，先覆盖 JOIN/FILTER/AGGREGATE/COUNT(*)/EXISTS/CROSS JOIN/Top-N 的重跑相关语义。
5. 实现去重 global impact graph、一次反向固定点传播、witness 回溯和预算 fail-fast；禁止引入字段笛卡尔积。
6. 实现 static assessment、negative proof safe rules、Unknown gap、最小确定集和保守安全集。
7. 实现独立 JSON/摘要/HTML renderer，并验证旧 field-lineage 产物、hash 和命令行为不变。
8. 使用固定 fingerprint 对 209119 做 causal-only A/B：比较旧字段矩阵与新候选分支数量、桥接闭合率、Unknown 原因、峰值内存和阶段耗时；不满足门槛则停止扩大 operator 范围。
9. 只有在真实语料证明新闭包减少重复计算且 Calcite shadow 产生可映射语义收益后，才单独提出 RuntimeRerunPolicy 或 Calcite 生产侧车 change。

## Open Questions

- 209119 的目标表是否存在多个实际 write observation，需要在首个 fixture 中确认；这不影响 contract 对多写入隔离的要求。
- producer-index 何时提供稳定的 `ProducerWriteObservation` ID，可在 V1 使用 branch identity 后单独迁移。
