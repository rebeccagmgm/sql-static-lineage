# 公共加工证据索引

核对日期：2026-09-18。主图发布版本：`9dbe562350452a41ae13c1b95f260a631fce9d2f9b8dceeba43e79dbf65f7c02`，发布时间：2026-09-16 09:27。

本目录SQL来自该版本清单绑定的任务证据，逐项核对投影声明的内容哈希，并重新计算query原文的SHA256，与证据所存SQL哈希一致。副本不添加行号或改写SQL，因此正文行号直接对应`.sql`文件。它们是当前已发布图使用的冻结材料，不声称是平台实时SQL。

完整任务名称、目标物理身份、写入实例、原证据路径和哈希见[JSON索引](20260918-公共加工SQL索引.json)。原证据路径供追溯，正文优先链接本目录副本。

| 任务 | SQL | 本轮使用范围 | 目标写入实例 |
| --- | --- | --- | --- |
| 86840 | [query](../../../../attachments/02.1-销售基础经营分类规则/IMG-02.1-销售基础经营分类规则-20260921105055365.sql) | 期权销售基础分支全文 | `write-observation:86840:8` |
| 86841 | [query](../../../../attachments/02.1-销售基础经营分类规则/IMG-02.1-销售基础经营分类规则-20260921105055616.sql) | 普通互换销售基础分支全文 | `write-observation:86841:8` |
| 86842 | [query](../../../../attachments/02.1-销售基础经营分类规则/IMG-02.1-销售基础经营分类规则-20260921105055882.sql) | KS销售基础分支全文 | `write-observation:86842:8` |
| 220650 | [query](../../../../attachments/02.1-销售基础经营分类规则/IMG-02.1-销售基础经营分类规则-20260921105056086.sql) | FAST TRS销售基础分支全文 | `write-observation:220650:8` |
| 105743 | [query](105743-query.sql) | 关系中间加工与最终归属全文 | `write-observation:105743:8`、`write-observation:105743:17` |
| 107491 | [query](107491-query.sql) | 逐日金额与费用全文 | `write-observation:107491:8` |
| 118141 | [query](../../../../attachments/02.1-销售基础经营分类规则/IMG-02.1-销售基础经营分类规则-20260921105055153.sql) | 共同输入、连接、日期及范围；完整收入口径另建专题 | `write-observation:118141:platform-target:0` |
| 118143 | [query](118143-query.sql) | 参数查询输出的独立输入；未证明是收入日报直接上游 | `write-observation:118143:platform-target:0` |
| 224351 | [query](224351-query.sql) | 共同输入、关系展开和汇总边界 | `write-observation:224351:platform-target:0` |
| 171364 | [query](171364-query.sql) | 本月新增规模基础输入和分类入口 | `write-observation:171364:platform-target:0` |
| 171347 | [query](171347-query.sql) | 当年新增规模基础输入和分类入口 | `write-observation:171347:platform-target:0` |
| 171370 | [query](171370-query.sql) | 存续范围、日期、明细连接 | `write-observation:171370:platform-target:0` |
| 206208 | [query](206208-query.sql) | 期间金额、分母及三槽位归属展开 | `write-observation:206208:platform-target:0` |
| 220979 | [query](220979-query.sql) | 香港收入共同输入的使用入口；未完成全公式解释 | `write-observation:220979:platform-target:0` |

[107491上游表级查询](20260918-107491上游.json)：`trace --task-id 107491 --layer table --direction up --depth 2 --limit 100`，同一图版本，返回20个节点、20条边，未触发条数截断，停止原因为`DEPTH_LIMIT`。查询范围为`TASK_SCHEDULE`，仍需实际读写证据，返回中保留未证明的范围。本次没有生成或发布新图，也没有把候选范围提升为已确认字段因果。

六个公共任务的生产SQL已用于正文说明；消费SQL只用于本版说明的具体边界。副本存在不等于该任务全部业务口径已解释，更不代表生产数据和运行结果已验证。
