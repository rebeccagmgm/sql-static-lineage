# 协议关系历史：同一合约怎样连到账簿、账户和其他合约

`pdata_n.t03_agt_rela_h` 值得先学，因为它把多种业务对象之间的关系保存成共同格式。理解它，就能看懂下游为什么能够从一个合约编号找到所属账簿、资金账户或关联合约。这里的“协议”是模型用语，也容纳账簿和账户。

## 一行保存的是一段关系历史

可以把一行读成：**在某段有效时间内，左端的某类对象与右端的某类对象，具有某种关系。**

| 字段                             | 读法                               |
| -------------------------------- | ---------------------------------- |
| `Agt_Id`、`Agt_Modifr`           | 左端对象编号及类别识别             |
| `Rela_Agt_Id`、`Rela_Agt_Modifr` | 右端对象编号及类别识别             |
| `Agt_Rela_Type_Cd`               | 两端是什么关系                     |
| `Strt_Date`、`End_Date`          | 这条关系版本的有效区间             |
| `Src_Tbl`                        | 关系来源分区，帮助限定要取哪类关系 |

开始、结束日期描述仓库中的关系版本，不能直接当成合约的起息日、到期日。元数据称其为“历史拉链表”，并将完整关系清单指向 CD051 字典；本文仅解释当前图中已核对的 OTC 部分。

## 同一列，为什么有时是账簿、有时是账户

写者 SQL 中，`Rela_Agt_Id` 会接收不同业务字段。下面的箭头表示实际存放方向：左端编号指向右端编号。

| 来源及关系代码           | 左端 → 右端                                           |
| ------------------------ | ----------------------------------------------------- |
| TRS，`A17`               | 互换合约 → 资金账户                                   |
| TRS，`N08`               | 互换合约 → `ARBITRAGE_CONTRACT_ID` 所指的关联互换合约 |
| 期权，`A18`              | 期权合约 → 资金账户                                   |
| OTC trade，`N03/N04/N10` | 互换／期权／外汇远期合约 → 账簿                       |
| book mapping，`N05`      | `KEY_BOOK_ID_FROM` → `KEY_BOOK_ID_TO`                 |
| fast TRS，`A17`          | 快速互换合约 → 资金账户；此分支排除 `LONG_SHORT_SWAP` |

所以，仅凭 `Agt_Id` 相同就关联整张表，会把不同关系和不同历史版本一起取出。即使只追踪 `Rela_Agt_Id` 这一个字段，也要保留关系类型、来源分区和日期上下文，才能判断它属于哪个加工主题。

## 加工还负责分类和保存变化

合约到账簿的加工先读 OTC trade，再检查合约是否出现在 TRS、期权、外汇远期、fast TRS 中，据此写入对象类别与关系代码。它已经新增了一条分类规则，不只是复制两个编号。

随后，当天来源与历史有效记录做全外连接，区分新增、删除、变化和未变。变化时，旧记录在当天结束，新记录从当天开始；未结束记录使用 `2099-12-31`。这表达仓库观察到的变化，尚不能证明现实中的关系恰好在该日改变。

各分支比较历史时采用的键也不同：TRS 包含关系类型，账簿映射还包含右端编号。不能据此宣称整表以合约编号唯一，或所有关系都是一对一。

## 下游怎样用它找到账簿

结算异常监控的 SQL 从合约状态信息出发，取 `b.rela_agt_id AS key_book_id`。它的实际条件可简写为：

```sql
a.agt_id = b.agt_id
AND b.strt_date <= 业务日期
AND b.end_date > 业务日期
AND b.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
```

这是左闭右开的日期区间。这个消费者靠来源分区限定合约到账簿关系，**没有另外筛选关系代码**；这只是已观察到的用法，不是全表唯一性保证。取得账簿后，可以继续理解[账簿承载哪些业务属性](01-book-foundation.md)。

以下为教学示意，编号和日期变化均非实际数据：互换合约 C100 同时关联资金账户 A8、账簿 B2、另一合约 C200。如果账簿关系在 6 月 10 日被观察到改为 B3，旧 B2 版本结束于当天，新 B3 版本当天开始。查询 6 月 9 日取 B2，查询 6 月 10 日取 B3；取资金账户则应选另一种关系。

## 学会这一点，再读后续加工

先确认“连接的是什么对象、哪种关系、哪个时点”，再解释金额和指标，就能避免把连接键相同误认为业务含义相同。这也是继续阅读[合约销售收入](03-sale-foundation.md)时需要携带的基础知识。

本轮核对了当前发布中的十个写者及一个消费样例，写者覆盖五个来源分区。尚未核对实际重复率、空值、区间重叠、任务运行结果或 CD051 全部定义。不同快照的日期也不同，不能当作同一天的运行全景。部分字段 Facts 为 `PARTIAL`，本文以直接表达式结合 SQL 解释，没有计算未经核实的字段贡献比例。

## 证据索引

以下行号均指链接证据文件 `sqlSources` 中相应 SQL 内容的行号，**不是 JSON 文件行号**。当前发布版本为 `df6f0ae4b6ef465f751351b14fd02ea08542d824d7bfea36e5a58dd1039e23c3`。十个写者投影的声明 hash 与 manifest 一致，所读 SQL 内容 hash 已复核。

- [表元数据](../../../sql-static-lineage-data/tables/hive/pdata_n.t03_agt_rela_h__gfhive/table.json)：历史关系说明及 CD051 引用。
- [105061](../../../sql-static-lineage-data/task-projections/tasks/105061/versions/5c255bdd13278db547e2440b3cdeb4767fec01c93fecbffb6934fec00defcd73.evidence-v3.json)：query 第 50–79 行，TRS 两类关系；第 108–111 行，历史匹配键。
- [105063](../../../sql-static-lineage-data/task-projections/tasks/105063/versions/9e98f78ed6d8ba76e7ffef3c715d028c55b7d7145b8acc18f9ffcc162cf6121c.evidence-v3.json)：query 第 50–63 行，期权到账户。
- [105529](../../../sql-static-lineage-data/task-projections/tasks/105529/versions/91254c3eaad4d453e7e741c6f85d9ec277de67084a611a0500f336491db255e2.evidence-v3.json)：query 第 50–82 行，对象分类与账簿映射；第 93–113、154–203 行，变化识别与历史开闭链。
- [108070](../../../sql-static-lineage-data/task-projections/tasks/108070/versions/6693081014c43a6c2a16900cc149e6f2206b0b63ffa0bd6f3d2fedf70fb0e99d.evidence-v3.json)：query 第 50–63、92–96 行，账簿映射及匹配键。
- [183087](../../../sql-static-lineage-data/task-projections/tasks/183087/versions/f1eea283ea66da758a9ff1ffb958cd4521a9a3f73f31a9ef7a6b0e0074f278b5.evidence-v3.json)：create 第 19–31 行，fast TRS 关系与范围；query 第 80–127 行，关系历史维护。
- [181556](../../../sql-static-lineage-data/task-projections/tasks/181556/versions/679fa05dcf80c91d0c5d52cbcc62ed2b1a64a00744372fdae8d379a6cf5967d7.evidence-v3.json)：query 第 119–124 行，以日期及来源分区取得账簿编号。

另五个已对照的写者为 [103935](../../../sql-static-lineage-data/task-projections/tasks/103935/versions/8e1721765104ac6ec9e1d95e6738079000dd8f0dddf53913a48b6885d7f95dd3.evidence-v3.json)、[103936](../../../sql-static-lineage-data/task-projections/tasks/103936/versions/c7499908a186a01eb66bdaf3d900ba91bed4b7be0266c40a1b5e12d0b4dce72d.evidence-v3.json)、[105388](../../../sql-static-lineage-data/task-projections/tasks/105388/versions/19eb15a82a5597f786ad59936dff352c378e96c69a4853ab894e98b3bdb11e62.evidence-v3.json)、[107938](../../../sql-static-lineage-data/task-projections/tasks/107938/versions/24e7b1a08900cc6252fcfd5ee4b49a05cf31a5f211056f5b8c3b3b06cb45e167.evidence-v3.json)、[144288](../../../sql-static-lineage-data/task-projections/tasks/144288/versions/efacda2b5cc688e9ccdfd9593599002b3ec8c604a43b3caa4f5e206fce41431a.evidence-v3.json)。它们连同上述五个写者构成本章十个生产任务的范围；不能把某一分支的历史键条件套到所有分支。
