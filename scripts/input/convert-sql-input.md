# 独立 SQL 输入转换

运行环境为仓库 Node.js 24；先执行 `npm run prepare:deps`。

```powershell
node --experimental-strip-types scripts/input/convert-sql-input.ts --sql input.sql --dialect databricks --parameters parameters.json --out converted.json
```

`--parameters` 可省略。映射文件是显式的文本替换表，例如：

```json
{"${data_day_str}": "2026-09-07", "${DB_TEMP}": "demo_temp"}
```

映射值不自动加引号，不执行表达式，也不从当前时间推导。调用者提供的映射必须适合原 SQL 所处位置。映射应用于全文，包括注释，所有出现位置均记录。不自动推断 `scriptParams` 的位置参数，也不将运行日期归一化为另一种语义；现有 temporal helper 仅用于标记参数粒度。无法映射的参数保留符号形式并产生 `SYMBOLIC_PARAMETERS_RETAINED`。

输出为独立 JSON：原文及 SHA-256、转换文本及 SHA-256、参数映射、每次替换的原始 UTF-16 字符偏移、语句原文及转换后的边界。复用 sqllens 拆句及现有可逆参数掩码。语句角色是用途路由标签，不代表完整语义解析或字段血缘已确认。DDL（包括 CTAS）及配置语句均保留；下游不能直接丢弃它们。参数转换后重新解析，语句边界变化、诊断、未支持语句均标为 PARTIAL。此版本不把日志或 shell 脚本当作纯 SQL 自动提取。

`CONVERTED` 仅表示转换检查通过，不证明参数映射业务正确、Schema 完整或血缘闭合。输出保留完整源 SQL，按原始数据的权限保护。CLI 使用独占创建，不覆盖已有输出或原始 Pack，也没有接入正式 Facts 发布链。

目标验证：`npm run prepare:deps` 后执行 `npm run test:input-pack -- tests/convert-sql-input.test.ts`。

## 独立 Pack

```powershell
node --experimental-strip-types scripts/input/stage-converted-pack.ts SOURCE/task.json NEW_DATA_ROOT [PARAMETERS.json]
```

输出根必须不存在，父目录必须存在。读取并校验源 task contentHash 和各 SQL 哈希，更新 SQL 哈希、来源及任务 contentHash，使用原合同校验后写入 `tasks/<category>/<id>`。原任务文档和逐槽位转换记录放入 `conversion-evidence`。源 Pack 不修改。

有解析诊断、未知语句或参数造成边界变化时拒绝写 Pack；未映射参数可以原样保存。包含非空 partition 元数据且 SQL 发生变化时拒绝写入，避免携带过期分区证据。表结构仍需从原数据根加载，输出根不是全量自包含数据包。参数影响物理库表名时，替换正式 Pack 前还必须验证目标元数据与表结构的一致性。

2026-09-08 实测 `100000`：未指定参数映射，原/转换 Pack 的 contentHash 相同；两路 Facts 重建均 SUCCESS。读写记录 4 条、列级边 203 条完全一致；15 条 Unknown 也相同。输出字段绑定 12 条的证据路径因数据根改变而变化。该结果验证独立 Pack 可消费，但不支持用覆盖 Pack 来解决 SET 误报；当前正式 Pack 未替换。

## 临时标准化消费链（v1，默认关闭）

新的 staging 运行额外生成 `tasks/<category>/<id>/standardized-sql.json`。它基于解析器的实际语句类别记录所有 SQL 槽位、哈希、语句原文范围及顺序。识别到已审核的 15 种 Hive SET 配置且语法无诊断时，记录配置键值和 `fieldAnalysis=NOT_APPLICABLE`。保留原始 SQL，不抽走 SET 或把它们移到别的执行槽位。`USE`、变量赋值、未支持的配置键、DDL/CTAS 均不被该规则跳过。现有转换 JSON 的首关键词角色只是预览标签；此标准化目录才是启用消费后的校验输入。

Facts API 显式传入 `standardizedInput: true`（CLI 对应 `--standardized-input`）。缺失目录、源 SQL 改动、角色篡改或目录过期会失败，不降级成偷偷忽略目录。Facts 保留 `SET_CONFIGURATION` 语句、配置键值、原始顺序和标准化目录哈希，只跳过这些配置自身的字段投影分析。不会据此额外推断分区值、执行成功或运行时配置语义。目录纳入缓存上下文指纹，并冻结到 Facts 的 `input-pack-sources/<taskId>/standardized-<hash>.json`。

临时 Pack 仅含指定任务，表结构从原根通过 API 的 `tableCatalog` 提供；若使用 CLI，需提供具有表结构的独立数据根。当前不把这种任务子集冒充全量可替换 Pack。正式入口默认行为保持原样。

2026-09-08 标准化真实对照（相同临时 Pack、相同表结构、开关前后）：

| 任务 | Unknown 开启前 → 后 | 读写 | 字段边 | 输出绑定 | 配置语句 |
| --- | --- | --- | --- | --- | --- |
| 100000 | 15 → 0 | 4 | 203 | 12 | 15 |
| 100019 | 16 → 4 | 8 | 545 | 9 | 12 |

两例均重建 SUCCESS，三类业务记录逐条完全一致；全部语句保留，剩余 Unknown 未删除。该结果支持这批已审核配置的临时标准化链，不支持对所有任务类型直接替换正式输入。未配置参数值时仍保留日期占位符；日期映射、库表名映射和复杂脚本适配不因 SET 验证通过而获得全量正确性保证。

验证更新：聚焦输入测试 117 项通过。此前扩展验证的两项失败已修正：裸表名测试按规范物理身份 `demo.mid` 断言，仍保留跨写次隔离验证；索引测试改用普通 JSONL 读取，并额外验证当前 manifest 未被旧结果覆盖。为 `task-knowledge.mjs` 补充准确的模块声明后，`npm run typecheck` 通过。

复测命令 `npm run test:machine-facts -- tests/input-pack-machine-facts.test.ts tests/standardized-sql.test.ts tests/stage-converted-pack.test.ts tests/convert-sql-input.test.ts tests/knowledge/task-knowledge.test.ts`：16 个测试文件、270 项测试全部通过。`100000` / `100019` 在新的隔离 Facts 根重建，Unknown 仍分别为 15→0 / 16→4，业务读写、字段边及输出绑定逐条一致。上述原验证阻塞已解除；覆盖范围仍为已审核 SET 规则和两个真实样例，默认开关及正式数据未切换。
