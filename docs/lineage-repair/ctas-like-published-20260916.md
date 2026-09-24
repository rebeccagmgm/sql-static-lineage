# CTAS / CREATE LIKE 修复与图谱发布记录

## 结果（2026-09-16）

已完成代码修复、46 个任务正式 Facts 重跑、对应投影重建和图谱发布。

- 发布版本：`243350d5ad79d4f3def2c923b682b8be426368e3b14625eee003b4b6c8f63c88`。
- 发布时间：2026-09-16 00:36:53 +08:00；数据库和页面接口均返回 `READY`。
- 全图保留 7,478 个任务，替换 46 个任务投影，保留其余 7,432 个，删除 0 个。
- 覆盖仍为 PROJECTED 6,039、SCHEDULE_ONLY 1,324、COLLECTION_FAILED 115。

| 统计口径 | 发布前 | 发布后 | 净减少 |
|---|---:|---:|---:|
| 本次 46 个任务的候选字段输出 | 1,124 | 143 | 981 |
| 排除外部数据库入 Hive 后的候选字段输出 | 2,219 | 1,238 | 981（44.2%） |
| 全图候选字段输出 | 7,942 | 6,961 | 981 |
| 全图包含候选字段的任务数 | 459 | 427 | 32 |

外部入 Hive 的 5,723 个候选字段、345 个任务保持原投影，不列入修复目标。剩余范围内为 1,238 个候选字段、82 个任务。

字段输出按 taskId + writeObservationId + 字段名计数，包含中间写入，不是最终业务字段去重数。新图共有 173,772 个 WRITE_FIELD，6,961 个候选输出约占 4.01%。跨任务 CANDIDATE 边是另一个口径：新图为 8,238 条，不能与候选字段数混用。

## 问题与方案

### 1. CTAS 被误当作显式列定义

例如 `CREATE TABLE tmp AS SELECT coalesce(a, b) AS value FROM src`，旧 DDL 读取器会把函数或子查询括号当作建表字段；AS 后有注释时，部分 CTAS 绑定也漏识别。

已统一使用词法化的 CREATE TABLE 头部识别，只有紧跟表名的括号才属于显式列清单；CTAS 的输出结构和字段绑定从 SELECT 推导。无法展开的星号仍保持未知。本次除了原先 28 个任务，另重跑 4 个同属 CTAS、但原结构为零列的任务，合计净减少 980 个候选输出。

### 2. LIKE 来源被 SQL 引用过滤掉

例如任务读取 `odata_n_rcc.u_price_p`，其 DDL 是 `LIKE odata_n_rcc.u_price_t`。来源结构在本地，但 SQL 没有直接读来源表，过滤后的 catalog 不包含它。

现在按 LIKE 引用补载确切平台、数据源和限定表名的依赖；路径队列去重避免循环加载。字段继承也必须匹配相同物理来源，不再借用其他数据源的同名表。继承前校验来源 DDL 哈希，循环仍保持未知。

任务 214752 的 `src_sys_prdno` 从候选变为 `odata_n_rcc.u_price_p.exchange_type`、`stock_code` 的明确输入。LIKE 来源只提供列结构，血缘来源仍为实际读取的 `u_price_p`，不伪造读取 `u_price_t`。

### 3. 明确保留的缺口

- 13 个 LIKE 任务仍有 139 个候选输出：6 张 LIKE 来源表未收录，本地表 Pack 与本地元数据目录均未找到；本次未补采在线平台，不能断言平台也不存在。
- 任务 63262 剩余 4 个候选输出：SQL 使用的 `u_sys_org` 字段与现有结构不一致。
- 其他缺失 schema、schema 与 SQL 不一致的任务不在本次 46 个任务重跑范围内。

## 验证

- 46 个任务正式重跑全部 SUCCESS，46 个投影全部 PROJECTED；正式与隔离重跑的输入 provenance、SQL/schema 哈希一致。
- 46 个任务原有 16,487 条物理输入引用全部保留，丢失 0 条。
- CTAS、LIKE、来源隔离等定向测试 27 项通过。
- 两个相关测试文件全跑：86 项通过、3 项失败；失败项与修复前已核对的历史失败一致，涉及 overwrite/append、两阶段静态分区、非 SparkIndex 分区合同。
- `npm run typecheck` 仍存在原有 TS7016：`run-src-table-template-rebuild.mjs` 缺声明，未宣称全仓检查全绿。
- 发布更新 46 个本地任务，影响 160 个任务的 continuation 计算，其中 29 个 continuation owner 更新。
- CLI status、fields、trace 和页面 HTTP status/fields 均已验证；150757、214752 字段追溯返回新版本，样例结果未截断。本次没有进行浏览器交互性能验收。
- 静态字段来源修复不证明任务实际运行成功或业务数据正确。

## 发布方法与回退证据

1. 使用 `outputs/like-schema-repair-20260916/scope.txt` 固定 46 个任务范围。
2. 在隔离目录重跑 Facts、prepare 并对照发布快照，再重跑正式 Facts。
3. 以正式 Facts 生成 46 个投影，局部 prepare 清单写到隔离 graphRoot。
4. 以当前全图清单为基线，只替换这 46 项，重新计算规范化清单哈希；断言总任务数、唯一性和覆盖状态，并检查发布基线未变化。
5. 写完整 prepared 清单后执行 `npm run graph:publish`。不能将仅包含 46 项的清单直接发布，否则会移除其他任务。
6. 发布器正常清理历史版本之前，已将旧发布索引/报告、46 个旧任务 bundle 与投影备份到 `outputs/like-schema-repair-20260916/rollback/`。恢复时需先恢复旧产物路径，再由旧完整清单重新发布；只改 current.json 不会回退数据库。

完整结果和日志在 `outputs/like-schema-repair-20260916/`。可跟踪的摘要见同目录文档 `ctas-like-published-results-20260916.json`。

## 另一个开发分支合入时

本次代码范围：

- `scripts/plans/ddl-schema.ts`：共享 CREATE TABLE 头识别，DDL 解析边界。
- `scripts/machine-facts/input-pack-machine-facts.ts`：CTAS 结构推导、LIKE catalog 依赖与物理身份限制。
- `scripts/machine-facts/machine-facts.ts`：CTAS 字段绑定边界。
- `scripts/machine-facts/machine-facts-contract.ts`：adapter 版本 1.3.20。
- `tests/ddl-schema.test.ts`、`tests/input-pack-machine-facts.test.ts`：相关回归。
- `docs/lineage-repair/` 下的诊断、方案和结果文档。

本次未提交 Git，也未合并另一个开发分支。共享工作区已有 UI、发布器、continuation 等改动，本次没有覆盖这些文件；发布使用的是当前工作区实现，正式导入报告确认只有上述 46 个任务 owner 更新。

合入时保留双方修改，复核上述三个解析/适配文件的冲突。若另一分支已提高 adapter 版本，不可回退为 1.3.20，应确定新的单调版本并重跑对应内容。历史红灯需单独处理；不要把本记录理解为另一分支完整集成验收。重发布前应重新读取届时的完整图谱清单，不能复用本次旧基线去覆盖后续发布。
