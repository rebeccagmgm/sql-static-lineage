# Calcite Sidecar migration

状态：已完成独立 Sidecar 验收，主仓库旧实现已在单独迁移提交中删除。

## 边界与版本

Sidecar 的精确目录是：

`E:\02_area\股衍数据-数据cookbook\scripts\Calcite`

该目录是独立 Git 仓库，当前提交为：

- `7a500b6 feat: add independent Calcite sidecar`
- `96b7c38 feat: retain legacy Calcite compatibility in sidecar`
- `d99be05 fix: isolate legacy sidecar compile output`
- `cdad683 feat: move semantic shadow lane into sidecar`

Sidecar 的 Java/Maven 依赖固定为 Calcite `1.42.0`。主仓库只产生和消费显式版本化的 `PLAN_FACTS_REL_V1` JSONL；Sidecar 只返回独立差分响应和 staging 报告。Sidecar 不写 canonical artifacts、causal decisions 或 negative conclusions。`RAW_SQL_V1` 仅保留显式调用的 legacy 兼容测试路径，Plan Facts Rel bridge 不把原始 SQL 当作输入。

数据流保持单向：

`Native facts/artifacts -> main Plan Facts JSONL projector -> Sidecar process -> independent response/report`

`target-table-upstream-causal-closure`、`TargetWriteIdentity`、Candidate Universe、跨 Task propagation、certainty、Gap/Witness/Budget/Task Rollup 仍完全属于主仓库。

## `scripts/calcite-differential` 逐文件分类

行数口径是迁移前主仓库提交 `ed9b661` 的 Git 文件行数；当前行数使用相同工作树的文本行统计。

| 文件 | 迁移前 | 当前 | 分类与处理 |
| --- | ---: | ---: | --- |
| `bridge-client.ts` | 622 | 0 | **纯 Calcite 协议/进程执行（B）**。负责启动 Java、读写 JSONL、超时和输出校验；功能由 Sidecar `sidecar-runner.mjs` 接管，删除。 |
| `build-causal-evidence-report.ts` | 274 | 0 | **纯差分实验报告编排（B）**。负责调用 bridge 并写独立报告；Sidecar 生成 `INDEPENDENT_DIFFERENTIAL_REPORT`，删除。主仓库只保留读取独立响应的薄适配器。 |
| `machine-facts-gate-input.ts` | 622 | 655 | **必须理解主仓库内部类型/事实（A）**。读取 Input Pack、Machine Facts、`Schema`、Task/表身份和 hash；不能移到不认识主仓库 artifacts 的 Sidecar。保留。 |
| `plan-facts-rel-contract.ts` | 548 | 587 | **稳定 JSON 协议边界（C）**。定义 Sidecar 可消费的关系图形状和 contract validation；它是主仓库投影器的权威出口，不含 Java/Calcite 执行，保留。 |
| `plan-facts-rel-projector.ts` | 1539 | 1575 | **必须理解主仓库内部类型（A）**。从 `PlanRelation`、`ExprSpec`、dialect、physical field identity 和 Native evidence 投影 JSON；迁移执行器而非投影器，保留。 |
| `project-machine-facts-gate.ts` | 66 | 73 | **必须理解主仓库内部 artifacts（A）**。主仓库 CLI，读取 facts root 并输出 Plan Facts 请求；保留为显式入口，不启动 Sidecar。 |
| `protocol.ts` | 1173 | 1249 | **稳定 JSON/file/process 协议（C）**。定义 `PLAN_FACTS_REL_V1`、fingerprint、硬上限、序列化和 response validation；是主仓库与独立进程之间的版本化防火墙，保留。 |
| `reconciler.ts` | 452 | 478 | **稳定 JSON artifact 消费（C）**。只比较已产生的 Native/Calcite observation，不读 SQL、不启动 Java、不写 canonical artifact；当前仍被兼容协议和既有单元测试使用，保留为协议侧兼容适配，不进入因果闭包。 |
| `run-differential.ts` | 527 | 0 | **纯 Calcite 协议/进程执行与 staging 编排（B）**。其 Sidecar 责任由外部 runner 和 Sidecar-local report 接管，删除。 |
| `schema-type-projection.ts` | 978 | 1037 | **必须理解主仓库内部类型/证据（A）**。把 DDL、schema provider、Column 和 nullable/type evidence 转为 Calcite-facing concrete type；只输出稳定 JSON，不包含 Calcite runtime，保留。 |

因此，B 类执行和实验编排均已外移；A 类主仓库事实投影和 C 类稳定协议/兼容边界没有被错误地复制成跨目录 TypeScript import。C 类保留是为了让主仓库能确定性地产生/校验协议，并不是 Sidecar 依赖主仓库源码。

## 主仓库因果适配层

`scripts/reconcile/consumer/target-field-causal-slice/calcite-causal-evidence.ts` 从迁移前 1391 行缩为 800 行，刚好落在约定的 300–800 行范围内。它现在只做：

- 校验 Sidecar observation 到 Native relation occurrence、field/output ordinal 和 evidence ref 的唯一映射；
- 把 `EVALUATED`、`NOT_EVALUATED`、`UNMAPPABLE` 转成独立证据及 fail-closed gap；
- 为 `NOT_EVALUATED`、失败、歧义和缺失身份保留 `blocksNegativeProof: true`；
- 输出 `INDEPENDENT_CALCITE_CAUSAL_EVIDENCE`，并固定三个安全标志为 false。

它不再构造 `SemanticDependencyDefinition`、`SemanticDependencyApplication` 或 edge，不接收 Calcite 结果进入 canonical normalization/traversal，也不使用 `rootTargetFieldId` 制造 target edge。`--calcite-causal-evidence` 作为 canonical slice 输入会明确报错，独立报告必须在 Sidecar lane 单独检查。

`calcite-semantic-mapping.ts` 与 `calcite-shadow-report.ts` 原本是由 `--semantic-oracle calcite` 显式调用的 Calcite 专属 semantic-shadow consumer。它们已迁移为 Sidecar 内的 `semantic-mapping.ts`、`semantic-shadow-report.ts`，并由 `semantic-shadow-runner.mjs` 通过 `CALCITE_SEMANTIC_SHADOW_V1` file/process contract 编排。主仓库不再保留该 flag 的实现或输出 writer；旧 flag 只返回迁移提示。本次不把未完成的 join/aggregate 等语义扩展混入迁移。

Sidecar 的 semantic-shadow 输入可以是 Native operator batch + Calcite response，也可以是已准备的 mapping report；输出为 `CALCITE_SEMANTIC_SHADOW_REPORT`。映射失败、unsupported、failed 和不确定身份继续保持 `NOT_EVALUATED`/`UNMAPPABLE`/`CONFLICT` 等 fail-closed 状态。该报告只表达独立 shadow 对照，不写 canonical dependencies、assessments、rerun sets 或业务负面结论。

## 精确删除清单

在 Sidecar 独立验收和提交之后，主仓库只删除以下已被 Sidecar 替代的冗余文件：

```text
scripts/calcite-differential/bridge-client.ts
scripts/calcite-differential/build-causal-evidence-report.ts
scripts/calcite-differential/run-differential.ts
tests/calcite-differential/bridge-client.test.ts
tests/fixtures/calcite-oracle/basic-request.json
tools/calcite-rel-bridge/README.md
tools/calcite-rel-bridge/pom.xml
tools/calcite-rel-bridge/test-runtime.ps1
tools/calcite-rel-bridge/src/main/java/com/gf/sqlstaticlineage/calciterelbridge/CalciteRelBridge.java
tools/calcite-rel-bridge/src/main/java/com/gf/sqlstaticlineage/calciterelbridge/PlanFactsRelExecutor.java
tools/calcite-oracle/.gitignore
tools/calcite-oracle/pom.xml
tools/calcite-oracle/src/main/java/com/gf/sqlstaticlineage/calciteoracle/CalciteOracle.java
scripts/reconcile/consumer/target-field-causal-slice/calcite-semantic-mapping.ts
scripts/reconcile/consumer/target-field-causal-slice/calcite-shadow-report.ts
tests/target-field-causal-slice/calcite-semantic-mapping.test.ts
tests/target-field-causal-slice/calcite-shadow-report.test.ts
tests/fixtures/target-field-causal-slice/calcite-differential/batches.ts
```

`tools/calcite-oracle/README.md` 和 `tools/calcite-oracle/test-runtime.ps1` 没有删除：它们是短的 deprecated compatibility wrapper，明确指向 Sidecar；`scripts/calcite-oracle/protocol.ts`/`reconciler.ts` 也保留为稳定协议兼容出口。没有删除 Native causal closure、Native pipeline、write identity、Candidate Universe 或跨 Task propagation。

第一阶段明确替代文件清单共 4557 行；其迁移提交实际为 `+389/-6357`，其中包含 `calcite-causal-evidence.ts` 的适配层收缩。第二阶段 semantic-shadow 删除清单共 2046 行，另从通用重协调测试移除了 31 行 Calcite mapping 专项测试，提交实际为 `+32/-2144`。从基线 `0319c75` 到当前主仓库 HEAD 的三次迁移相关提交合计为 30 个文件、`+417/-8497`，净减少 8080 行（包含文档和 package 命令变更）；其中已迁移/删除的 Calcite 实现和测试均已在 Sidecar 独立提交中有对应能力或专项验证。

## 依赖扫描

删除前和删除后均执行了有界源码扫描，排除 `openspec/` 历史记录、`node_modules/` 和 `dist/`：

```text
main source -> E:\02_area\股衍数据-数据cookbook\scripts\Calcite : <none>
main source -> deleted Calcite Java/runner implementation : <none> after deletion
Sidecar src/runner/test scripts -> sql-static-lineage main path or main source imports : <none>
Sidecar source -> scripts/ or src/ cross-directory TypeScript import : <none>
```

Sidecar 只使用 Java 标准库、Calcite 1.42.0 Maven cache/classpath 和 Node built-ins；它不解析主仓库路径、不加载主仓库 `node_modules`，也不通过绝对源码路径回调主仓库。

## 验收证据与命令

在独立 Sidecar 目录执行：

```powershell
Set-Location 'E:\02_area\股衍数据-数据cookbook\scripts\Calcite'
npm run build
npm test
npm run test:legacy
npm run smoke
npm run test:semantic-shadow
npm run smoke:semantic-shadow
```

结果：上述命令均通过。`npm test` 通过了真实 JSONL 往返，并验证 response 为 `PLAN_FACTS_REL_V1`、`SUCCESS`，含 `tableOccurrences` 与 `expressionLineage`；runner 同时生成 `reportKind=INDEPENDENT_DIFFERENTIAL_REPORT` 和内容 hash。semantic-shadow fixture 通过真实 Node process 往返，得到 `CALCITE_SEMANTIC_SHADOW_REPORT`、`overall=GO`、5 条 `AGREED` observation，并验证 canonical artifact 未变更。当前机器没有 `mvn` 命令，因此 `test-runtime.ps1` 使用 sidecar 内的 `-BuildOnly`/runtime javac 路径和已存在的本地 Maven cache；`pom.xml` 仍固定完整依赖和版本，具备 Maven 环境时可用标准 Maven 构建。

本轮删除后在主仓库实际执行并通过：

```powershell
Set-Location 'C:\Users\13246\.codex\worktrees\0bdd\sql-static-lineage'
npm run typecheck
npm run test:calcite-differential
npm run test:calcite-oracle
npm run test:causal-slice
npm run test:target-table-causal-closure
```

本轮按收口范围未运行全量 `npm test`、`format:check` 或额外的 field-lineage 矩阵；Native 默认隔离由 typecheck、causal/closure 目标测试、默认命令静态扫描和未调用 Sidecar 的执行路径共同覆盖。

还应保留以下静态隔离检查：

```powershell
rg -n --glob '!openspec/**' --glob '!node_modules/**' --glob '!dist/**' 'E:\\02_area\\股衍数据-数据cookbook\\scripts\\Calcite|calcite-rel-bridge|CalciteRelBridge|PlanFactsRelExecutor' scripts tests tools package.json
rg -n --glob '!target/**' --glob '!staging/**' 'sql-static-lineage|C:\\Users\\13246\\.codex\\worktrees\\0bdd\\sql-static-lineage|E:/02_area/股衍数据-数据cookbook/sql-static-lineage|from ["\x27].*(src|scripts)/' 'E:\\02_area\\股衍数据-数据cookbook\\scripts\\Calcite'
```

Native 默认路径不调用 `calcite-differential:project`、`test:calcite-oracle` wrapper 或 Sidecar；它只读取 Native 输入并运行既有 TypeScript pipeline。`test:calcite-oracle` 是显式兼容命令，不属于默认测试/构建依赖。

## 提交与限制

- Sidecar 独立提交：`7a500b6`、`96b7c38`、`d99be05`、`cdad683`，目标目录工作树应保持 clean。
- 主仓库 package 命令调整单独提交：`ed9b661`，仅将旧 `calcite-causal-evidence` script 替换为 `calcite-differential:project`；`package-lock.json` 未改动。
- 主仓库 semantic-shadow 删除/适配提交：`f93d2b9`，只删除 Sidecar 已接管的 semantic mapping/shadow 实现、专项 fixture/test，并移除旧 CLI writer；未改动 package 文件。
- 主仓库删除/适配/测试/文档为本轮独立原子提交；不合并 main、不推送远端。
- Calcite 是差分证据，不是运行成功、数据到达或业务正确性的证明；Sidecar failure/unsupported/NOT_EVALUATED 不能反推负面业务结论。
- 本次没有实现新的 join、aggregate、setop 或 window 算子语义；Sidecar 只承接已有 bridge 能力和兼容路径。
- Maven 未安装是当前环境限制，不是 Sidecar 依赖主仓库的理由；独立 javac/runtime 检查已覆盖真实执行。
