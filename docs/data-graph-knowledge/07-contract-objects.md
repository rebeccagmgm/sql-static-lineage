# 一个 OTC 合约，为什么会出现在这么多张表里

读加工图时，“协议、期权合约、子交易、互换腿、事件”很容易被看成同一份数据的反复搬运。实际 SQL 展示的是几个不同问题：**对象是谁、约定了什么、内部由哪些交易或支付部分组成、存续期间发生了什么。**本章先用期权串起完整实例，再对照普通互换腿。下文的粒度是 SQL 表达的记录层次，实际唯一性尚未用数据验证。

| 对象 | 这一层的一行主要回答什么 |
|---|---|
| 协议 `t03_agt` | 某类账户或合约的公共身份、状态是什么 |
| 期权合约 `t03_otc_opt_comp_info` | 某业务日期，这个合约的交易对手、本金、费用和条款是什么 |
| 期权子交易 `t03_otc_opt_comp_sub_trd_info` | 合约内部这笔子交易的方向、标的、数量和生效期限是什么 |
| 互换腿 `t03_otc_swap_comp_leg_info` | 互换内部这一条腿的类型、支付方向和计息条件是什么 |
| 存续期事件 `t05_otc_comp_dura_chg_evt` | 某个事件发生在何时，对哪个合约产生了什么变化 |

这些层次可以围绕同一合约连接，但并不构成每笔业务都会依次经过的固定流程。期权子交易与互换腿也不是可以直接互换的概念。

## 先认清编号，再讨论“统一”

期权协议写者将 `KEY_OTC_TRADE_ID` 写入 `Agt_Id`，同时填修饰符 `20207`；期权主表也把同一来源字段写入 `Opt_Comp_Agt_Id`，填 `20207`。两张表分别从期权来源生成，这是共享身份的证据，不能据此画成“协议表加工出期权表”。

互换分支使用 `20206`，保证金账户分支使用 `10219`。fast TRS 也使用 `20206`，但来自另一来源分区，且所读分支排除了 `LONG_SHORT_SWAP`。编号值、修饰符和来源要一起理解，不能假定不同来源出现相同值就一定是同一对象。

编号转换也有不同做法：合约编号保留源交易编号，产品编号会添加 `TIT-`，当事人编号会添加 `TIT060-`。这些是各对象的映射规则，不是一条适用于所有 ID 的替换规则。[协议关系历史](02-agreement-history.md)进一步解释了对象之间怎样连接。

这里还有一个必须纠正的描述：`t03_agt` 元数据称其为历史拉链表，但当前 DDL 没有关系历史表那样的开始、结束区间。所读期权写者比较旧记录与当天来源，变更时保存新属性，删除时保留记录并设置 `Del_Flag`、`Del_Date`，同时维护加载和更新时间。**不能把它当作可直接按日期区间还原所有旧版本的表。**

字段名称也需要核对实现：该分支的 `Vld_Date` 来自创建时间的日期，`Due_Date` 填空；不能直接解释成完整的合约生效、到期安排。`Agt_Holder` 经 trade 找到账簿，再取账簿的交易对手编号；期权主表的交易对手则从合约来源取值，两个字段是否相同需要另证。

## 合约层保存条款，子交易层保存内部结构

期权主表按来源与业务日期覆盖写入。`Nom_Prin` 来自 `NOTIONAL`，`Init_Nom_Prin` 来自 `INITIAL_NOTIONAL`，`Dyna_Nom_Prin` 来自 `DYNAMIC_NOTIONAL`；这三个源口径保留为不同字段，不能只因都叫“本金”就合并。期权费支付日、兑付日也各自来自对应源字段。

主表还按合约编号关联障碍价格和参与率来源，用 `SEQ=0/1` 选择条目。它将多处条款组织到合约层。SQL 的意图是补充条款；没有来源键唯一性证据时，不能保证这些关联绝不增加行数。

子交易多了一层自身身份。其 `Sub_Trd_Id` 来自 `EXTERNAL_TRADE_ID`，`Src_Prd_Id` 来自子交易自身的 `KEY_INSTRUMENT_ID`；`Comp_Prd_Id` 则来自 `CONTRACT_INS_ID` 并添加产品前缀。真正找到父合约的连接是：

```text
子交易.CONTRACT_INS_ID
    = OTC trade.KEY_INSTRUMENT_ID
    → OTC trade.KEY_OTC_TRADE_ID
    → 子交易表.Opt_Comp_Agt_Id
```

这里必须区分子交易自身产品键、合约产品键、合约交易编号。生产 SQL 使用左连接，未匹配时父合约编号可以缺失；不能仅因字段已经生成，就认为父子关系全部接通。

子交易同时保留 `Eff_Date/Exp_Date`、期初定价日、到期日、结算日和观察区间。不同日期来自不同源字段，分别回答有效性、定价、结算与观察问题。`BUY/SELL` 在这里转换为 `1/2`，说明细层也会新增标准化规则。

普通互换腿的相应实例是：`KEY_OTC_TRADE_ID` 标识父合约，`KEY_LEG_ID` 写入 `Leg_Glbl_Seq_No`，`LEG_SEQ_ID` 写入 `Leg_Seq_No`。每腿另存类型、支付方向、币种、标的、固定利率和计息基准；因此多条腿不能简单当作多份合约。当前普通分支的 `Leg_Glbl_No` 填空，也说明相似字段名不能替代实际映射。fast TRS 腿的完整差异未在本章展开。

## 看一个真实消费：子交易宽表怎样把层次重新拼起来

任务 107481 以子交易为入口，先限定来源与业务日期，排除状态 `411/141`，并要求父合约编号非空。随后内连接同日、`Rep_Risk_Flag=1` 的账簿，再按父合约编号左连接期权主表。因此它的输入范围已受到状态、身份完整性和[账簿设置](01-book-foundation.md)共同限制；这里尚未核实两个状态码的业务名称。

输出同时保存合约初始本金 `OD.Init_Nom_Prin` 与子交易本金 `OI.Prin`，直接字段 Facts 分别确认了这两个来源。如果一个合约带两笔子交易，合约初始本金可能随父属性重复到两行，不能直接按这些行求和；子交易本金能否相加还需业务口径。这个假设说明粒度风险，不表示已观察到实际重复。

它还把子交易编号为空的记录补成 `TITANS_` 加源产品编号；这只是该消费者的编号规则。观察日及障碍参数则按源产品编号聚合成列表后关联回来。由此可见，一张宽表同时容纳父合约属性、子交易自身信息及更细的观察序列。做字段热点或加工簇分析时，应按这些用途拆开阅读。

## 事件回答“发生了什么”，还带着另一套时间

期权事件将源事件编号保存在 `Src_Id`，将合约编号写入 `Otc_Comp_Agt_Id`；`Evt_Id` 由来源前缀、事件日期、源事件编号及合约编号拼接。普通互换事件采用类似结构。fast TRS 事件则通过 instrument 连接 trade 取得合约编号，其事件 ID 拼接不含合约编号。这些是不同的身份规则，不能统一按字符串外形拆解。

事件还区分 `Evt_Date`、录入时间、审批结束时间和支付日。普通互换、期权分支的 `Busi_Date` 取事件日期，fast TRS 分支填空；当前目标仅按来源分区覆盖写入。因此本文不沿用元数据“每天增量更新”的说法，也不把事件业务日期等同于提取快照日期。

结算异常监控给出了实际用法：期权主表取当日快照，事件取期权来源，再按合约编号筛 `PARTIAL_TERMINATION` 且状态为 `3`。互换分支则筛 `CLOSE_STOCKS` 和状态 `3`，随后用源事件编号接收付款事件，并比较审批与收付款创建时间。**合约状态描述对象，事件状态描述某次变化，现金记录描述处理结果。**三者需要连接，不能相互代替。

理解这些层次后，再读[合约销售收入](03-sale-foundation.md)，就可以先问指标采用合约、子交易还是事件粒度，再看归属与金额规则。

## 证据和仍待确认的边界

本章新增核对 12 个任务，复用此前的 181556 消费证据；没有查询实际业务数据。投影声明 hash 与固定 manifest 一致，所读 SQL 内容 hash 已复核。静态证据尚不能保证来源键唯一、编号跨来源无冲突、父子覆盖完整或不同快照同时运行。部分子交易表达式 Facts 为 `PARTIAL`，已结合 SQL 解释，未将其算成完整字段覆盖。

行号指各证据文件 `sqlSources` 内指定 SQL 内容，不是 JSON 行号。固定发布版本：`df6f0ae4b6ef465f751351b14fd02ea08542d824d7bfea36e5a58dd1039e23c3`。

| 任务与证据 | SQL 位置与用途 |
|---|---|
| [105053](../../../sql-static-lineage-data/task-projections/tasks/105053/versions/a175f2972fd954a2ac46d054f1582a93e3c720badffa7b3bb50ba14692cce80f.evidence-v3.json) | query 20–37：保证金账户公共身份 |
| [105055](../../../sql-static-lineage-data/task-projections/tasks/105055/versions/1f55ba2fba1e4709e3edf12873c0a65f27a348cd23072a955ee40aeae6eb9b79.evidence-v3.json) | query 20–50：互换身份及账簿关联 |
| [105522](../../../sql-static-lineage-data/task-projections/tasks/105522/versions/775423cb6e34bf5e9dbfd98c8aeeecff3de17a95d151555c1e17cc7c20d5fa05.evidence-v3.json) | query 20–50、81–100、122–218：期权身份、日期、更新与删除维护 |
| [183084](../../../sql-static-lineage-data/task-projections/tasks/183084/versions/1b9a038b99b46db54ba8dd758e896b34238696674da8f7261532c8200ac63975.evidence-v3.json) | create 28–58：fast TRS 身份与来源范围 |
| [105074](../../../sql-static-lineage-data/task-projections/tasks/105074/versions/5d1140e4415f810cd4465eb3f1b89d334d33a77f63976974ea136caef17aa0fa.evidence-v3.json) | query 1–30、67–78、139–167：期权日快照、本金与条款关联 |
| [209862](../../../sql-static-lineage-data/task-projections/tasks/209862/versions/6c2726911854596f451fb7606846a02f92779f0adc82897d8cf31e5a9c2ee9ca.evidence-v3.json) | query 1–10、111、138–148：另一批次来源写入同类期权模型；不能据此推定与其他写者同时运行 |
| [107636](../../../sql-static-lineage-data/task-projections/tasks/107636/versions/b44ae9aa7f7796e3f21a2a26cd3b38227ce711aaf77810c953915b7833ab2fb0.evidence-v3.json) | query 1–35、63、85–95：子交易身份、日期及父合约连接 |
| [105073](../../../sql-static-lineage-data/task-projections/tasks/105073/versions/38c3459d99589b016165426956e70b01bce233d4db93eefc31ca8926ecf95052.evidence-v3.json) | query 1–18、50–55：普通互换腿及编号映射 |
| [107481](../../../sql-static-lineage-data/task-projections/tasks/107481/versions/d934b8cb1caf8975689bddf6801ad9d2afc27867600b583054ca3d8cf74bd20e.evidence-v3.json) | query 3–18、33、83、198–225、262–277：子交易消费范围、父子本金及观察序列 |
| [124565](../../../sql-static-lineage-data/task-projections/tasks/124565/versions/e4caa8bb64cd287aa65c158098934f9a131617e492e50a855591cec5a3787031.evidence-v3.json) | query 1–27、61、119–129：互换事件身份、日期和状态 |
| [124566](../../../sql-static-lineage-data/task-projections/tasks/124566/versions/3464ce52f29b558673a9349e3cc62527561fa2593f8dd0ae4d2aef2f4f44f051.evidence-v3.json) | query 1–30、64、134–145：期权事件身份、日期和状态 |
| [216458](../../../sql-static-lineage-data/task-projections/tasks/216458/versions/37775de9e1ea2f01eac1cf70cd6da984ee9aabaa7418b529a8003209339823b4.evidence-v3.json) | query 1–30、62、130–134：fast TRS 事件及 instrument 连接 |
| [181556](../../../sql-static-lineage-data/task-projections/tasks/181556/versions/679fa05dcf80c91d0c5d52cbcc62ed2b1a64a00744372fdae8d379a6cf5967d7.evidence-v3.json) | query 126–144、254–278：合约快照、事件与收付款消费连接 |

结构描述同时对照了 [协议 DDL](../../../sql-static-lineage-data/tables/hive/pdata_n.t03_agt__gfhive/ddl.sql)及[事件 DDL](../../../sql-static-lineage-data/tables/hive/pdata_n.t05_otc_comp_dura_chg_evt__gfhive/ddl.sql)。元数据文字只作候选线索，以上教学结论以 SQL 和直接字段证据为依据。
