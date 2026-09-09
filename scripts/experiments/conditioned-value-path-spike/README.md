# 条件分支值路径隔离实验

本实验检验：现有 Facts 的结构证据，能否支持先沿明确引用构建路径、
再结合分支条件确定值来源。它不修改或发布正式 Facts、投影、Neo4j。

## 已测结果

冻结任务 208983 的当前 Facts、SQL 和正式任务投影。原始 SQL 哈希与
Facts 一致，正式投影引用相同 Facts manifest。输入在读取器中分类为
`LEGACY_NOT_L1`、无读取问题；本实验不把它升级或宣称为 L1。

| 输出 | 原投影 | 实验中的值路径 |
| --- | --- | --- |
| CDP000809 服务员工编号 | 33 条未解析字段边 | 服务员工表 index_val，1 条路径 |
| CDP000802 开发员工编号 | 33 条未解析字段边 | 开发员工表 index_val，1 条路径 |

每个字段都遍历 57 个分支、56 个 SETOP 节点，保留一个标签匹配分支，
证明其余 56 个分支不为这个 CASE 贡献值。33 是物理字段数，57 是分支数，
不能把两者相减，也不能据此计算准确率。

24 项测试通过，包括两个真实输出的来源断言、输出/CTE/分支列别名变化、
UNION 重排和扁平化、同标签多个分支、动态标签、缺失关系或读取实例、
错误 scope、Schema 未验证、循环、不支持的算子，以及独立的简化 SQL
执行核对。SQL 核对使用内存 SQLite，只验证 MAX/CASE/COALESCE 的简化形态。

## 明确的边界

- 只验证两个输出的字段值贡献路径；未验收全任务或跨任务血缘。
- JOIN、FILTER、分组存在性、隐式类型转换和 Hive 运行语义未验证。
  排除一个分支的值贡献，不代表它对行集或整个结果完全没有影响。
- 输出带 `publicationEligible: false`；`PROVEN_WITHIN_SCOPE` 仅指上述窄范围。
- 变形测试修改冻结的结构化记录，不覆盖 SQL 重新解析后的稳定性。
- 适配器仅支持当前明确列出的结构组合，不是通用 SQL 解释器。
  它证明了一部分证据可用，不决定正式能力最后放在哪个模块。
- 不读取旧投影来生成新路径；旧投影只用于结果对照。
- 任务 ID 和业务字段名只出现在执行器、测试中；生产端候选算法不按它们分支。

## 复现

在仓库根目录运行：

```powershell
npm run prepare:deps
node --import tsx scripts/experiments/conditioned-value-path-spike/run.mjs
node --import tsx --test scripts/experiments/conditioned-value-path-spike/proof.test.mjs scripts/experiments/conditioned-value-path-spike/real-facts.test.mjs
```

首次执行冻结输入，之后始终重放同一快照。输入缺失会失败，不会跳过测试。
快照及逐路径报告位于 `tmp/conditioned-value-path-spike-20260909/`。
报告包含 Facts manifest hash、快照 hash、路径、分支排除证据及原始文件
是否仍与冻结时一致。不要将快照提交为正式 Facts 或覆盖现有发布物。

## 文件职责

- `facts-adapter.mjs`：沿输出引用定位 CTE/聚合，按 UNION 列位置形成分支证据。
- `proof.mjs`：证明标签相等/不等，保留多条合法路径和未知候选。
- `run.mjs`：冻结真实输入、与旧结果对照、生成隔离报告。
- 两个测试文件：独立预期、结构变形、负例和简化 SQL 执行核对。

后续应增加另一种真实加工形态，并验证 SQL 重新解析、控制依赖和缺口
传播。当前结果支持继续小范围验证，不支持直接替换正式主链。

## 第二轮：多种加工与无物理来源的输出

新增 34901、86840、155157、119044、105387 五个真实任务、14 个案例。
覆盖复制、改名、常量、空串、日期参数、参数变换、当前时间、聚合、
两侧字段运算、JOIN 别名、条件常量、窗口序号和 UNION。

```powershell
node --import tsx scripts/experiments/conditioned-value-path-spike/multi-case-run.mjs
node --import tsx --test scripts/experiments/conditioned-value-path-spike/output-description.test.mjs scripts/experiments/conditioned-value-path-spike/multi-case.test.mjs
```

报告在同一实验输出目录的 `multi-case/report.md` 和 `multi-case/report.json`。
**13 个表达式形态与独立预期相符，不代表 13 条新路径验收通过。**
原 MAX/CASE/UNION 路径算法不支持这些新形态，本轮新增完整路径通过数为零。
34901 的 Oracle `SYSDATE` 被 Facts 识别为物理列，是保留在报告中的语义失败。
检查器测试通过不消除这个失败，也不会把生成说明标记成正式血缘。

`output-description.mjs` 仅尝试为输出保留表达式、值引用、条件引用、常量、
参数、时钟函数、默认值及窗口输入等说明，不重新计算物理血缘。
固定赋值和时间生成即使没有字段上游，也应有输出生成说明；不能将时钟或
参数伪装成物理表列。暂未实施正式投影合同或 UI 修改。

参数直接赋值（例如 `'${data_day_str}'`）是正常生成，不要求知道当次运行值。
实验现在分别保存 `operation: DIRECT_ASSIGNMENT` 与参数来源信息；无物理
字段输入的生成方式标记为路径追踪 `NOT_APPLICABLE`，不计为解析失败。
需要源字段路径、但原小实验尚不支持的案例仍保留 `NOT_EVALUABLE`。

## 第三轮：复制与复杂加工的路径验收

在第二轮的五个冻结任务上继续验证 15 个检查项（包括内部表达式和最终
写入字段，存在重叠，不是 15 种独立 SQL 模板）。13 项限定范围通过，
1 项窗口部分验证，1 项 SYSDATE 语义失败；三个正确旧读取实例均保留。
第二轮报告为历史阶段记录，新增完整路径结果以本轮报告为准。

- 复制、改名、JOIN：对照独立 SQL 预期与旧投影读取实例，并区分同表 C/K。
- SUM/NVL、相减、UNION：贯穿 CTE 和物理读取，保留左右操作数、默认值、
  分支位置和分组字段；PVS/BP 最终物理端点相同也保留两条计算路径。
- CASE：固定结果值与四条条件字段路径分开，保留顺序及 ELSE。
- ROW_NUMBER：分区、排序字段路径已验证；窗口元数据不完整，未宣称一般
  窗口语义通过。frame 未暴露不等于已发现这个 ROW_NUMBER 计算错误。
- 常量、参数和时间：展示可统一为“赋值：原表达式”，无需产品分类膨胀。
  SYSDATE 赋值本身正常，失败的是 Facts 给它制造了物理表字段来源。

`path-witness.mjs` 是隔离的证据遍历实验。它仍使用现有直接子 scope 编码
匹配派生 JOIN 别名，此处不是正式引用 ID 合同。不要将它直接接入生产或
扩展为另一套 SQL 语义解析器。`path-case-audit.mjs` 用独立 SQL 预期做验收；
SYSDATE 特别说明：内部路径可以完整连接，但仍然不符合 SQL 语义。

```powershell
node scripts/experiments/conditioned-value-path-spike/path-witness-run.mjs
node --test scripts/experiments/conditioned-value-path-spike/copy-path.test.mjs scripts/experiments/conditioned-value-path-spike/path-witness.test.mjs scripts/experiments/conditioned-value-path-spike/path-case-audit.test.mjs
```

本轮 28 项测试通过，含真实路径、回归、缺证据及歧义反例、结构变形和
简化 SQLite 执行核对。**测试检查器通过不消除报告中的 1 项真实语义失败。**
报告位于 `tmp/conditioned-value-path-spike-20260909/path-validation/report.md`
和 `report.json`，原始 SQL、Facts、正式投影哈希核对未变。

本轮未验收 SQL 重新解析、完整 JOIN/FILTER 行集语义、跨任务接续或生产
发布。因此结果支持继续有界验证，不构成整体替换架构的批准依据。

## 第四轮：原 SQL 重放与最小 Facts 修复

Machine Facts adapter 1.3.14 做两项公共修正：

- 将 PlanFacts 已有的 `scope_bindings` 保存到对应的 relation 对象中；关系 ID
  加上任务、语句前缀，scope 名和 alias 原样保留。保存前验证端点和 CTE
  body 关系；空目标、多个候选仍保留，消费者必须拒绝不唯一的确认。
- Input Pack 的 `oracle2*` 任务携带 `source_sql_family: oracle`。在原生字段
  推导之前，仅在源 `query` 段（或显式指定 Oracle 的无分段输入）将 canonical IR
  中裸 `SYSDATE` 标成零参数系统表达式，前后置 SQL 不受影响；再由
  同一原生引擎建立 scope 和字段依赖。SQL 文本、CST 及位置不变；带引号、
  带限定词、其他 SQL 来源家族的同名字段仍按字段处理。

这两项会改变 Facts 生成配置哈希；旧 Facts 不被原地修改。正式投影算法
未切换。实验 `bindingMode: explicit` 直接读取已保存映射，不使用 scope
名称拼接作 fallback；缺映射则停止证明。

六个真实任务从原 SQL 重生成：15 项主检查 14 项通过、窗口部分验证；
208983 的两个 MAX/CASE/UNION 输出继续通过。五个任务仅增加合计 117 条
scope 映射，其他原有记录不变；34901 只移除错误的 SYSDATE 字段依赖并
更新对应表达式。正式原始文件哈希保持不变。

```powershell
node --import tsx scripts/experiments/conditioned-value-path-spike/sql-replay-run.mjs candidate
node --test scripts/experiments/conditioned-value-path-spike/sql-replay.test.mjs
```

运行目录已存在时拒绝覆盖。`baseline` 是修复前的重放；若需重现此前
基线，应在修复前代码树上执行，不能用修复后代码伪造历史结果。干净代码
树可设置 `REPLAY_WORKSPACE` 指向保存冻结输入的工作区，再使用新的阶段名。
报告在 `tmp/conditioned-value-path-spike-20260909/sql-replay/`。结构变形反例
与原 SQL 重放分别记录；窗口全类及跨任务因果仍未验收。
