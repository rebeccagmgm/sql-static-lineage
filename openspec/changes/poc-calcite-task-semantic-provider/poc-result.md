# POC Result

## Decision

`VALIDATION_ONLY`

这不是“Calcite 没有价值”的结论。POC 已证明 Calcite 1.42.0 能直接处理当前真实复杂 SQL，并能作为单条 SQL 内关系算子语义的候选主来源。当前又证明了 Calcite 物理读 occurrence 和 dependency endpoint 可以精确闭合到 Native 叶子证据；但算子自身 source span 与完整证据闭合尚未组装，因此当前结果仍不能进入 Confirmed 因果或重跑判断。

## Gate 结果

- Gate A `DIRECT_EXTRACTION`：`PASS`。真实 209119 SQL 直接经过 Calcite parse、validate、RelNode 和 metadata，形成 129 个 relation 与 3,841 条 evaluated local dependencies。
- Gate B `SEMANTIC_EDGE_CORRECTNESS`：`PASS`。10/10 代表性样本通过完整 semantic-edge golden；校验包含端点、方向、impact、JOIN/SETOP input role，并拒绝缺失、意外和重复边。
- Gate C `NATIVE_EVIDENCE_ASSEMBLY`：`PARTIAL`。35/35 个 Calcite 物理读 occurrence 精确映射到 Native read，3,841/3,841 条 dependency endpoint 递归闭合到这些叶子证据，且没有 ambiguous/unmappable；但 129 个 operator 的 source span 与完整 operator-level evidence closure 仍为 0/`NOT_ASSEMBLED`。
- Gate D `PRODUCTION_CAUSAL_INTEGRATION`：`NOT_STARTED`。本 Change 禁止接入 multi-hop、因果闭包和生产 artifact。

## 本轮修正的局部语义

- LEFT JOIN 区分 preserved/optional，并用 `JOIN_NULL_EXTENSION` 表达 null extension，不再粗略当作普通 row membership。
- correlated EXISTS 保留外层与子查询字段共同参与的 predicate refs。
- Window value/partition/order/frame 去重并分别表达。
- CROSS JOIN 增加 relation-existence 与 multiplicity。
- DISTINCT、UNION、INTERSECT、EXCEPT 使用不同 set membership 角色。
- Filter、Join、Aggregate、Window、Sort 等算子补齐局部 value passthrough；literal projection 保留 relation-existence 依赖。

## 性能与隔离

真实 SQL 验证约 2.8 秒，峰值 working set 约 525 MiB，响应约 3.56 MiB；代表性语料约 2.1 秒。该模型按唯一 SQL/schema digest 计算并缓存，不按目标字段或 candidate branch 重复调用。

Provider 和 TypeScript consumer 只写 POC staging；`canonicalArtifactsWritten=false`、`nativeSemanticFallback=false`、`productionIntegrationPerformed=false`。

## 尚未证明的内容

本轮通过同一 Calcite 前端中的 table hint/source occurrence 保留，实现了物理 `TableScan` 叶子的 source map，并将其与 Native physical read/span evidence 精确闭合。20 个 read 使用完整 span 相等，15 个因 Native span 额外包含 alias，使用“全限定表标识符精确前缀 + 同起点 + 唯一 Native occurrence”闭合；未使用 substring、tail table-name 或字段名猜测。

尚未完成的是派生 operator/RexNode 到原 SQL operator span 的精确映射，以及可让每条 semantic dependency 具备 operator 位置和叶子 evidence 的完整证据对象。3,619 条 dependency 的叶子证据恰好共享一个 Native span；其余 222 条涉及多个不连续叶子，系统只保留逐叶子 evidence refs，拒绝拼造一个包围大 span。因此 `exactMappingCount=3,841` 只表示 dependency endpoints 可达精确 Native 叶子，不能解读为 full evidence closure。

在 Gate C 达到 operator-level full evidence closure 之前，最终结论保持 `VALIDATION_ONLY`。由于真实 SQL 需要 9 个有界 reserved-identifier quoting transforms，即使未来 Gate C 通过，预期结论也更可能是 `THIN_ADAPTER_REQUIRED`，而非 `DIRECT_PROVIDER`。

## Evidence

- `staging/calcite-semantic-provider-poc/corpus/support-matrix.json`
- `staging/calcite-semantic-provider-poc/real-209119/input-manifest.json`
- `staging/calcite-semantic-provider-poc/real-209119/response.json`
- `staging/calcite-semantic-provider-poc/real-209119/assembled-response.json`
- `staging/calcite-semantic-provider-poc/real-209119/evidence-assembly-metrics.json`
- `staging/calcite-semantic-provider-poc/real-209119/runtime-metrics.json`
- `staging/calcite-semantic-provider-poc/poc-report.json`

上述文件是 POC evidence，不是 canonical 业务或血缘产物。
