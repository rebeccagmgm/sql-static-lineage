# 临时表 CTAS 结构修复实施方案

> 2026-09-16 更新：用户追加授权后，已完成 46 个相关任务重跑并发布新图谱。当前结果与合入注意事项见 [发布记录](ctas-like-published-20260916.md)。下文未发布说明是当时阶段记录。

## 范围与目标

承接 `candidate-field-diagnosis-and-merge-plan-20260915.md` 的 A 组：28 个任务、887 个直接候选输出。用户已授权先写方案、随后实施。本次不处理其他五组问题，不重新发布正式图谱。

目标不是强制清零候选，而是使有注释的 CTAS 与等价无注释 SQL 获得正确、相同的字段结构和任务内来源证据。

## 方案

1. 在现有 DDL 解析模块增加小范围、可复用的 CREATE TABLE 头部识别，复用标识符与注释处理，区分真正的列定义区和 AS SELECT/WITH 查询。保留字符串、引用标识符原文。
2. 普通 DDL 只能读取表名后真实列定义区，不能向后搜索并拿查询内第一个括号冒充字段列表。列数不能作为判断结构正确性的唯一依据。
3. 任务本地的 CREATE、写入目标与 CTAS 判定使用同一识别结果；Facts 的 CTAS 写入边界也复用该结果，否则结构恢复后仍无法建立输出绑定及本任务接续。查询仍交给已有 SqlSession/buildPlanFacts 推导输出，不新建 SQL 语义解析器。
4. 不改变跨任务接续、物理身份和分区确认策略；不以消费者列名补造源表结构。不扩张为同名临时表生命周期重构。
5. 检查现有 Facts 版本机制，使变化可被下游缓存识别。生产重建与发布由合入分支沿原流程执行。

## 实施与验收清单

- [x] 回归先复现：AS 与 SELECT 之间的行/块注释、WITH、查询函数括号。
- [x] 普通 DDL、LIKE、字符串及引用标识符中的注释符号保持正确。
- [x] 修复后验证 schema、输入字段及 materialization 来源，不只验证任务 SUCCESS。
- [x] 覆盖多语句和 UNION；检查不完整星号输出继续保留未知。
- [x] 在隔离输出目录验证真实任务 150757、179726，再核对 28 个任务；保留旧发布快照对照。
- [x] 区分当前代码未修复基线、修复后结果和旧发布基线，避免把其他分支改动的收益算到本次。
- [x] 完成相关测试、类型检查尝试和代码审阅；既有失败单独记录如下，不宣称全部检查通过。
- [x] 更新本文结果与合入注意事项，保留未解决问题，不自动提交或发布。

## 分支合入

实际修改 `scripts/plans/ddl-schema.ts`、`scripts/machine-facts/input-pack-machine-facts.ts`、`scripts/machine-facts/machine-facts.ts`、Facts 版本常量及对应测试。开发分支需按函数职责合入，而非按旧行号覆盖；如果解析模块已重写，以本文行为要求和回归样例为准。Facts adapter 从 1.3.19 升为 1.3.20；若承接分支已有更新版本，应按其版本序列前进，不能降级覆盖。

隔离验证结果不替代正式发布。合入后需重新生成受影响 Facts、任务投影和依赖图谱，确认消费者实际读到新版本。共享解析器影响范围内的普通 DDL 和其他任务类别也需回归，但不将外部入 Hive 的候选消除列为本次目标。

## 执行结果

### 代码结果

- 用现有 `sqllens.tokenize` 识别 CREATE TABLE 头部，排除注释/空白，但保留引用标识符和字符串。
- DDL 只接受表名后实际列定义区，CTAS 查询内括号不再生成假列；保留 DROP 后 CREATE 的元数据输入。
- 本任务结构推导和 Facts 写入边界共用 CTAS 识别。只改前者会造成结构恢复而 materialization 仍缺失，本次一并修复。
- 本次未改变跨任务接续策略、分区规则或字段证据等级合同。

### 真实任务对照

使用 HEAD 原始 Input Pack/DDL/Facts 相关实现建立修复前对照，其他当前消费者代码保持相同；修复后使用本次实现。两组输入任务内容哈希及 SQL 哈希全部相同，产物写入独立目录，未写回正式 Pack/Facts 或 writer catalog。

明细：[28 任务结果 JSON](ctas-schema-repair-results-20260915.json)。隔离完整产物位于仓库 `outputs/ctas-schema-repair-20260915/`，其中 `before-summary.json`、`after-summary.json` 保留逐任务、逐写入输出键和临时结构。

| 指标 | 修复前 | 修复后 |
| --- | ---: | ---: |
| 成功生成 Facts 的任务 | 28 | 28 |
| 候选输出字段 | 887 | 4 |
| 候选输出已清零的任务 | 0 | 27 |
| 原 PHYSICAL 输入引用保留 | 13,485 | 13,485，丢失 0 |

净减少 **883** 个候选输出。按输出键核对，是原候选中 885 个不再标记候选，同时 CTAS 写入现在被正确收录，又暴露出 2 个此前未计入的早期输出候选。不能将净减少量理解成 883 个独立原始字段均已完成业务验收。

两个代表任务均从 132 个候选输出降为 0，同任务 RESOLVED materialization 从 263 增至 395：

- 150757：`odata_n_tit.d_ref_counterparty.id` 经临时表进入中间表 `pty_id1`，并继续进入最终写入的 `pty_id`。
- 179726：对应来源为 `odata_n_oom.f_otc_derivative_counterparty.client_id`。

已检查投影中的这些 FIELD_DIRECT 路径及其写入观察，原表历史值分支仍与新增来源分支分开；条件关系没有冒充值来源。结构或常量来源恢复后，图边数量不一定单调增加，不能以边数作为唯一验收。

### 残留与边界

任务 63262 仍有 `pty_id`、`pty_name` 和中间输出 `pty_id1`、`pty_name1` 共 4 个候选。它们最终引用 `odata_n_gpb.u_sys_org.orgid/orglongname/orgname`，但现有源表结构只有 `pty_id`、`full_name_ch` 等另一组字段。属于诊断文档 C 类结构不一致，不在本次 CTAS 修复中补造字段。

仍存在其他 PARTIAL 和控制侧缺口；候选输出降为 0 不等于该任务所有证据完整。正式图谱尚未重建发布，页面仍使用原发布版本。

### 检查结果及合入前已知问题

- 修复前新增回归成功复现错误：普通 CTAS 被 DDL 读取器误取括号，带注释 CTAS 生成假结构。
- 最终针对 DDL、CTAS 注释、WITH/UNION、不完整星号的测试：**24 通过**。
- 成对执行原始 Input Pack 测试与修复后测试，加上 DDL 测试：145 通过、6 失败。6 项为修复前后各出现相同的 3 项，未发现本次新增失败；之后增加的两个不完整星号回归已单独通过。
- 三项既有失败为：无分区 overwrite/append 贡献者断言、静态分区两阶段链 bridge 数量断言、非 SparkIndex 平台分区写入 `fully bound pack-declared partition write is not COMPLETE`。
- 较宽测试还遇到旧 plain JSONL canary 与当前压缩存储合同不一致，以及历史缓存目录被测试发现的问题；没有为本次修复修改这些测试或共享配置。
- `npm run typecheck` 仍被既有 `tests/run-src-table-template-rebuild.test.ts:3` 的 TS7016 阻塞：`run-src-table-template-rebuild.mjs` 缺少声明文件。它不在本次修改范围。
- `npm run build` 通过，但该脚本仅检查 sqllens 引擎可加载，不代表完整 TypeScript 编译或图谱发布。

对本次差异完成了人工代码审阅：检查字符串/标识符不被注释处理破坏、语句边界不借用后续括号、CTAS 输入绑定和原 PHYSICAL 引用保留，以及无正式产物写入。合入分支仍需处理其现有红灯后完成正式集成验收。

可重复的精简回归入口（排除已知历史副本目录，仅筛选本次相关用例）：

```powershell
npm test -- tests/ddl-schema.test.ts --exclude '**/.evidence-cache/**' -t 'incomplete CTAS star|derives Task-local CTAS|DDL schema reader'
```
