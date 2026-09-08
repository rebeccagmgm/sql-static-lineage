# 合约、结构与持仓：一笔业务如何拥有多个身份

一笔场外交易进入数据网络后，不会只留下“一行合约”。交易记录回答由哪个账簿承接；合约回答约定和状态；产品与子交易回答如何表达结构；持仓回答某个业务日还持有什么；估值回答在特定币种、日期和计算口径下这些持仓对应多少价值。把它们接起来的关键，是辨认每个编号指向的对象，再按正确日期连接。

本页与[资金、保证金和结算](05-funds-and-margin.md)共同覆盖固定发布目录中的 **331 项任务**：EDW_AGT 153、EDW_SUM 85、EDW_EVT 19、EDW_NDS 74。两份审阅账本将主范围互斥分配为本页 269 项、资金页 62 项。它们不是两个互不相干的数据库；账户、组合和收付事件仍需相互引用。

这里解释的是已发布 SQL 和对应 TablePack 所表达的数据模型。SQL 中的日期包含不同时间采集的实例，也有未展开参数，不能合成一个“同日全网快照”。当前发布中有两项保留 SQL 但无数据投影、五项没有 SQL，具体列于文末。

<a id="contract-identity"></a>
## AGT 是共同身份层，合约只是其中一类

`pdata_n.t03_agt` 把合同性对象纳入共同结构：编号、修饰符、类别、状态、持有人和有效日期。保证金账户、资金账户和账簿也进入此表。修饰符在这里承担区别对象类别的职责；它不是可以随手丢弃的标签。

| 进入 AGT 的对象      | SQL 采用的原始编号           | 修饰符     | 身份形成方式                               |
| --------------- | --------------------- | ------- | ------------------------------------ |
| 保证金账户           | `KEY_MRG_ACCT_ID`     | `10219` | 账户的 `KEY_CTPTY_ID` 加 `TIT060-` 形成持有人 |
| 资金账户            | `KEY_CAPITAL_ACCT_ID` | `10220` | 与保证金账户分别维护；账户状态使用 `ENABLED` 映射       |
| 账簿              | `KEY_BOOK_ID`         | `20411` | 使用账簿自身的对手方，主对象状态字段可为空                |
| 普通互换、纳入本分支的极速互换 | `KEY_OTC_TRADE_ID`    | `20206` | 由合约接交易，再接账簿，取账簿对手方作为 AGT 持有人         |
| 期权合约            | `KEY_OTC_TRADE_ID`    | `20207` | 同样由交易和账簿补持有人，合约状态取 `CONTR_STATUS`    |
| 外汇远期            | `KEY_OTC_TRADE_ID`    | `20208` | 由远期合约及其交易、账簿形成共同身份                   |

来源：[任务 105053，query 20–47 行](../../../../sql-static-lineage-data/task-projections/tasks/105053/versions/a175f2972fd954a2ac46d054f1582a93e3c720badffa7b3bb50ba14692cce80f.evidence-v3.json)、[任务 105054，query 20–47 行](../../../../sql-static-lineage-data/task-projections/tasks/105054/versions/33f919870ebd77e89792063ad46a7fc69c41841fd802b50078c783736cb2ba24.evidence-v3.json)、[任务 105521，query 20–39 行](../../../../sql-static-lineage-data/task-projections/tasks/105521/versions/b34c48e4b31a8b66989d6d5cbc686f3d5c5c22b8ce603b4a4df6da5e21268422.evidence-v3.json)、[任务 105055，query 20–54 行](../../../../sql-static-lineage-data/task-projections/tasks/105055/versions/1f55ba2fba1e4709e3edf12873c0a65f27a348cd23072a955ee40aeae6eb9b79.evidence-v3.json)、[任务 105522，query 20–54 行](../../../../sql-static-lineage-data/task-projections/tasks/105522/versions/775423cb6e34bf5e9dbfd98c8aeeecff3de17a95d151555c1e17cc7c20d5fa05.evidence-v3.json)、[任务 169636，create 28–59 行](../../../../sql-static-lineage-data/task-projections/tasks/169636/versions/65b647aefaa4ba10223c1bb0e996a82d9229c3a3d048f5a1daf13a4f1d3ad625.evidence-v3.json)；目标 [pdata_n.t03_agt DDL](../../../../sql-static-lineage-data/tables/hive/pdata_n.t03_agt__gfhive/ddl.sql)。

这能解释一个容易混淆的情况：相同文本编号既可能是一个账户，也可能是一个合约。查询方至少需要保留编号、修饰符及来源语境；但这些字段组合是 SQL 的连接依据，不是已验证的数据库唯一约束。这里的 Hive DDL 没有声明主键。

AGT 主对象与关系历史也采用不同维护方式。主表用当前来源分区与当天输入做 FULL OUTER JOIN，分辨新增、变更、未变和删除，覆盖当前值并保留删除标志；它没有 `Strt_Date/End_Date` 两列。关系历史表才按有效区间保存变化。不能仅因元数据描述出现“拉链”，就把 AGT 主对象当成能直接还原所有历史属性的表。[任务 105055，query 57–221 行](../../../../sql-static-lineage-data/task-projections/tasks/105055/versions/1f55ba2fba1e4709e3edf12873c0a65f27a348cd23072a955ee40aeae6eb9b79.evidence-v3.json)

<a id="contract-relations"></a>
## 身份之间靠明确关系连接，不靠编号碰巧相同

`TRD_OTC_TRADE` 中，`KEY_OTC_TRADE_ID` 指向交易/合约身份，`KEY_INSTRUMENT_ID` 指向产品，`KEY_BOOK_ID` 指向账簿。关系加工保留了这三条不同的线：

- `T03_AGT_PRD_RELA_H`：合约编号及修饰符连接 `TIT-` 加产品编号，关系类型 `01`。它根据当前互换、期权、远期和极速互换来源判断修饰符；所有来源均未匹配时写空值。注释把空值称为失效合约，但 SQL 直接证明的只是“没有匹配到这些来源”，不能据此断言业务失效。[任务 105526，query 47–99 行](../../../../sql-static-lineage-data/task-projections/tasks/105526/versions/9b6a3196929100531e1072a417eeaabac3bd3e0dea5a2bfe74e8b47b5ed92d01.evidence-v3.json)
- `T03_AGT_RELA_H`：普通互换以 `A17` 连接资金账户 `10220`，期权分支使用 `A18`；互换还以 `N08` 保存 `ARBITRAGE_CONTRACT_ID`。合约到账簿的关系分别用 `N03/N04/N10`，账簿映射用 `N05` 保存 `KEY_BOOK_ID_FROM → KEY_BOOK_ID_TO`。方向和关系类型必须保留。[任务 105061，query 51–78 行](../../../../sql-static-lineage-data/task-projections/tasks/105061/versions/5c255bdd13278db547e2440b3cdeb4767fec01c93fecbffb6934fec00defcd73.evidence-v3.json)、[任务 105063，query 51–62 行](../../../../sql-static-lineage-data/task-projections/tasks/105063/versions/9e98f78ed6d8ba76e7ffef3c715d028c55b7d7145b8acc18f9ffcc162cf6121c.evidence-v3.json)、[任务 105529，query 51–82 行](../../../../sql-static-lineage-data/task-projections/tasks/105529/versions/91254c3eaad4d453e7e741c6f85d9ec277de67084a611a0500f336491db255e2.evidence-v3.json)、[任务 108070，query 51–62 行](../../../../sql-static-lineage-data/task-projections/tasks/108070/versions/6693081014c43a6c2a16900cc149e6f2206b0b63ffa0bd6f3d2fedf70fb0e99d.evidence-v3.json)
- `T03_AGT_PTY_RELA_H`：互换分支从合约自身取 `KEY_CTPTY_ID`，而 AGT 持有人从账簿取。两列可能回答不同关系，不能假设永远同值。主体本身的定义见[公共对象](02-public-objects.md)。[任务 105058，query 49–59 行](../../../../sql-static-lineage-data/task-projections/tasks/105058/versions/8b1df6b6a3f90ae678524f3c166ad02c8db9117a040e7615a70df17da7ac3c50.evidence-v3.json)

有效关系通常用 `Strt_Date <= 业务日 AND End_Date > 业务日` 选择，开链结束日使用 `2099-12-31`。重跑时先移除当日新链、还原当日闭链，再重新比较。连接时只取 ID 而不限制修饰符、关系类型、来源分区和时间，可能把不同对象或多个历史版本一起带入。[任务 105526，query 1–35 行](../../../../sql-static-lineage-data/task-projections/tasks/105526/versions/9b6a3196929100531e1072a417eeaabac3bd3e0dea5a2bfe74e8b47b5ed92d01.evidence-v3.json)、[任务 105526，query 90–99 行](../../../../sql-static-lineage-data/task-projections/tasks/105526/versions/9b6a3196929100531e1072a417eeaabac3bd3e0dea5a2bfe74e8b47b5ed92d01.evidence-v3.json)；[pdata_n.t03_agt_prd_rela_h DDL](../../../../sql-static-lineage-data/tables/hive/pdata_n.t03_agt_prd_rela_h__gfhive/ddl.sql)。

**已经发现一个不能自动接通的编码差别。** 期权合约信息三个任务把 `KEY_CAPITAL_ACCT_ID` 对应的 `Ast_Acct_Agt_Modifr` 写成 `10218`；资金账户主对象和合约资金关系使用 `10220`。目前没有证据证明二者是可互换别名，知识库保留两边原值。若按“账户编号＋修饰符”关联，应先处理此口径差异，而不是静默改码。[任务 103943，query 8–10 行](../../../../sql-static-lineage-data/task-projections/tasks/103943/versions/1437e360dcd29f816c655cf1b98ddbd043c7470f2f89860009ae59cc921c3665.evidence-v3.json)、[任务 105074，query 8–10 行](../../../../sql-static-lineage-data/task-projections/tasks/105074/versions/5d1140e4415f810cd4465eb3f1b89d334d33a77f63976974ea136caef17aa0fa.evidence-v3.json)、[任务 209862，query 8–10 行](../../../../sql-static-lineage-data/task-projections/tasks/209862/versions/6c2726911854596f451fb7606846a02f92779f0adc82897d8cf31e5a9c2ee9ca.evidence-v3.json)。

名称、分类、状态、静态数量/文本信息，分别由 `T03_AGT_NAME_H / CLAS_H / STAT_H / STATI_INFO_H` 承载。它们是共同身份的侧面，不能因名字含“统计”就当成平台计算出的指标；不少取值是源字段或内部合约号直接映射。账簿附加信息、账簿映射及规则进一步决定业务归属。其逐任务来源、表达式和时间条件保存在本页审阅账本。

<a id="swap-structure"></a>
## 互换需要区分合约、腿和确认记录

普通互换合约信息由 `D_REF_TRS` 补充资金账户、外部合约号、币种、交易日期、结算币种和状态，还连接限额审核以及 `introOrg/sponsorOrg/customerManager/operator` 等合同属性。这里的属性连接按合约编号及属性名进行；源端一项属性是否只有一行，静态 SQL 没有保证。PB 变体主来源为 `D_REF_TRS_PB` 且限制 `GRP_ID='h15'`，辅助属性仍来自普通日终表，这是一种混合来源组合。[任务 105072，query 3–44 行](../../../../sql-static-lineage-data/task-projections/tasks/105072/versions/8be7929931de6111a77443dd52675a32b3e493c347e7f8fd5125aeb5a62fb60e.evidence-v3.json)、[任务 105072，query 149–169 行](../../../../sql-static-lineage-data/task-projections/tasks/105072/versions/8be7929931de6111a77443dd52675a32b3e493c347e7f8fd5125aeb5a62fb60e.evidence-v3.json)、[任务 144296，query 149–169 行](../../../../sql-static-lineage-data/task-projections/tasks/144296/versions/c8222b4110077840bcbc914b4182df1f5c1ae1296cb4dc0bd5a14282cc5c4726.evidence-v3.json)

“腿”是同一合约下不同支付/收益部分的结构单位。`T03_OTC_SWAP_COMP_LEG_INFO` 用 `KEY_LEG_ID` 作为全局腿序号，保存 `LEG_SEQ_ID`、腿类型、支付方向、币种、标的、利差和固定利率；借券腿的折扣率通过 `D_REF_SBL_LEG` 按腿编号补入。它不等同于一笔标的持仓。[任务 103942，query 3–17 行](../../../../sql-static-lineage-data/task-projections/tasks/103942/versions/479e5abd1c127ee73483a0828a77a1cd5f296eacf812ab6ac4d2654f24af5b7c.evidence-v3.json)、[任务 103942，query 64–66 行](../../../../sql-static-lineage-data/task-projections/tasks/103942/versions/479e5abd1c127ee73483a0828a77a1cd5f296eacf812ab6ac4d2654f24af5b7c.evidence-v3.json)

极速互换写入相同模型时，腿编号来自 `KEY_FAST_TRS_LEG_ID`，新增全局腿代码及结算/估值汇率来源；普通腿类型、支付方向、币种等一批字段写空。该分支明确排除 `TRS_TYPE='LONG_SHORT_SWAP'`。所以“模型表存在一列”不表示每种来源都能提供它。[任务 183093，query 3–19 行](../../../../sql-static-lineage-data/task-projections/tasks/183093/versions/a5976f659901c6ae8fd59c9cfb12ec84b9e65dea3d5f90b1fdae8ff1ae5f3039.evidence-v3.json)、[任务 183093，query 47–63 行](../../../../sql-static-lineage-data/task-projections/tasks/183093/versions/a5976f659901c6ae8fd59c9cfb12ec84b9e65dea3d5f90b1fdae8ff1ae5f3039.evidence-v3.json)、[任务 211640，query 138–145 行](../../../../sql-static-lineage-data/task-projections/tasks/211640/versions/b7c037ef8982efc3ec2124d31d0aae27e397cca93b30cd7a8b370b5885a06d44.evidence-v3.json)

金仕达确认记录是另一条入口：`KEY_TRADE_COMFIRM_ID` 配 **`20206-KST`**，读取采集日对应来源且保留近 30 日 `Business_Date`。不能把这条分支强转成普通 `KEY_OTC_TRADE_ID + 20206`。外汇远期则由合约信息和结构要素两表分别表达，后者保留两种币种、期初/期末定价日期和结算币种。[任务 112120，query 3–7 行](../../../../sql-static-lineage-data/task-projections/tasks/112120/versions/e2050e3ed83b0efaea2171608844d5a38a40f9aaefcb70524218981235fb0cf0.evidence-v3.json)、[任务 112120，query 147–150 行](../../../../sql-static-lineage-data/task-projections/tasks/112120/versions/e2050e3ed83b0efaea2171608844d5a38a40f9aaefcb70524218981235fb0cf0.evidence-v3.json)、[任务 163771，query 3–33 行](../../../../sql-static-lineage-data/task-projections/tasks/163771/versions/fddbeac5b2658ec70115c9d0599a841cc8055d2befcca9ad07ca5a3943ea97c3.evidence-v3.json)、[任务 163772，query 3–31 行](../../../../sql-static-lineage-data/task-projections/tasks/163772/versions/1b2eab216a48d8d40dde7f35234ba9f3d39c0ffb84cdd48f373a787afe563450.evidence-v3.json)

与合约相连的出借和对冲也保留独立对象。标的出借先用 `TRS_INS_ID` 接合约产品，再得到合约号，同时保存券源池、标的、数量、起止日期和履保方案；对冲产品信息同时保存原标的与对冲标的、渠道、期初/当前数量及平仓数量。不能把出借数量、对冲数量和客户合约持仓当成同一个量。[任务 209839，query 3–41 行](../../../../sql-static-lineage-data/task-projections/tasks/209839/versions/7ffb300fcdb4800e546f75760fbb06103994fed3d52a2d0dc268b610659332e8.evidence-v3.json)、[任务 210926，query 3–28 行](../../../../sql-static-lineage-data/task-projections/tasks/210926/versions/35d45787c43ff7d98e11c0cd69abdcb397caa3bf1a33131dfdd9812b3f7e7982.evidence-v3.json)

<a id="option-structure"></a>
## 期权是合约、子交易与观察安排的组合

期权合约信息保存协议层约定，如名义本金、绝对名义本金及币种、期权费、初始/动态名义本金、支付日和提前终止相关字段。结构要素表则保存结构类型、方向、标的、观察频率、期初/期末定价日、敲入敲出相关比例、价格精度与汇率。一个字段叫“收益率”并不足以说明它是实际收益：本层多数是在搬运约定和结构参数。[任务 105074，query 16–39 行](../../../../sql-static-lineage-data/task-projections/tasks/105074/versions/5d1140e4415f810cd4465eb3f1b89d334d33a77f63976974ea136caef17aa0fa.evidence-v3.json)、[任务 105074，query 67–78 行](../../../../sql-static-lineage-data/task-projections/tasks/105074/versions/5d1140e4415f810cd4465eb3f1b89d334d33a77f63976974ea136caef17aa0fa.evidence-v3.json)、[任务 108952，query 3–68 行](../../../../sql-static-lineage-data/task-projections/tasks/108952/versions/c304f1b695905fc80c12f77f1336aa07e1ec1d3af59aa7c8f71ee8a12bfb9b32.evidence-v3.json)

子交易使用另一套身份：`EXTERNAL_TRADE_ID → Sub_Trd_Id`，`KEY_INSTRUMENT_ID → 子交易产品`，`CONTRACT_INS_ID → 合约产品`。`REF_INS_OPTION_INFO` 的合约产品再与 `TRD_OTC_TRADE.KEY_INSTRUMENT_ID` 连接，才能回到合约编号。子交易同时保留序号、系数、生效/到期区间、标的、数量、本金和买卖方向。结构属性跟着子交易产品走，不能把子交易产品号直接当成合约号。[任务 107636，query 3–34 行](../../../../sql-static-lineage-data/task-projections/tasks/107636/versions/b44ae9aa7f7796e3f21a2a26cd3b38227ce711aaf77810c953915b7833ab2fb0.evidence-v3.json)、[任务 156492，query 28–32 行](../../../../sql-static-lineage-data/task-projections/tasks/156492/versions/e9359772fe6201e77291458552f12fc9e84885cd471f875eec0b29c5df30acc1.evidence-v3.json)；[pdata_n.t03_otc_opt_comp_sub_trd_info DDL](../../../../sql-static-lineage-data/tables/hive/pdata_n.t03_otc_opt_comp_sub_trd_info__gfhive/ddl.sql)。

观察安排进一步增加“日期、序号或属性类别”这一层粒度：

| 家族 | 明确来源与连接 | 需要保留的差别 |
|---|---|---|
| 合约观察日与票息 | `REF_OP_DEAL_AUTOCALL_KODATE/KIDATE`，按合约号与期权主表 INNER JOIN | KO/KI 不同障碍类型，日期与障碍金额/百分比分列 |
| 票息率、行权价、障碍价、重置价 | `REF_OPTION_DEAL_CR/STRIKE/BARRIER/QUOTE_RESET` | 序号、观察日期、价格与百分比不同，不能只按合约号压成一值 |
| 子交易观察日属性 | DRA、Lizard、Autocall CP/KI/KO 各源表，经子交易产品接合约产品 | CP 的 `COUPON_DATE`、KO 的 `KO_DATE`、KI 的 `KI_DATE` 分别进入观察日期；Lizard 另带兑付日及事件日期 |
| 子交易障碍线与区间属性 | `REF_OPTION_BARRIER_LINE`、`REF_OPTION_DAILYRANGEACCRUAL` | 障碍线序号/生失效日；区间序号/边界比例/累积票息率 |
| 自动赎回属性 | `REF_OPTION_AUTOCALL` | 看涨看跌行权价、参与率、上/下障碍及是否敲出即付分别表达 |
| 累购观察区间 | `REF_OP_CUMULATOR_SCHEDULE` 与 `TRD_CUMULATOR_SCHEDULE_DAILY` | 合约安排和按日累计结果是两类记录；前者变体写 `COMP_DATA` 且业务日期可为空 |

来源：[任务 112813，query 3–38 行](../../../../sql-static-lineage-data/task-projections/tasks/112813/versions/8e13ca84773117d3a9d73a6bf3f7e5bd870731b3c648a0f7178f07175fca0971.evidence-v3.json)、[任务 112814，query 3–18 行](../../../../sql-static-lineage-data/task-projections/tasks/112814/versions/7970e76fa45ece0ceb4af18e6e3b6837993fa6bf14d3302836ac59648e935bf5.evidence-v3.json)、[任务 112837，query 3–19 行](../../../../sql-static-lineage-data/task-projections/tasks/112837/versions/bdb756cac0bf3f1cf8d41adebb02ff19a4b3f0a30b5bade6456cf5238c5c275d.evidence-v3.json)、[任务 126200，query 3–18 行](../../../../sql-static-lineage-data/task-projections/tasks/126200/versions/5a29ac7b81739ac5c24a7eb63913322a051351f3efd47c744417d9338b8b2b1b.evidence-v3.json)、[任务 156492，query 3–32 行](../../../../sql-static-lineage-data/task-projections/tasks/156492/versions/e9359772fe6201e77291458552f12fc9e84885cd471f875eec0b29c5df30acc1.evidence-v3.json)、[任务 156494，query 3–33 行](../../../../sql-static-lineage-data/task-projections/tasks/156494/versions/23d6e375ad8374216efc481b178a8bfcd0011e3ab4bf24df0fcbbf2ed4240dca.evidence-v3.json)、[任务 156495，query 3–33 行](../../../../sql-static-lineage-data/task-projections/tasks/156495/versions/6ca651e3550f4ed7602c4f7788a4def6b92985afc220c5f735e77fbd7b4e0c8e.evidence-v3.json)、[任务 156496，query 3–33 行](../../../../sql-static-lineage-data/task-projections/tasks/156496/versions/7e722f2d193bce2ae9e10bcab59381b3acf60b1527d815574849124dbf56cd09.evidence-v3.json)、[任务 156497，query 3–33 行](../../../../sql-static-lineage-data/task-projections/tasks/156497/versions/9715a7dc84418d9c756b54d46e29ce1c0d2f90c9ac15858f916c3f631e7c1925.evidence-v3.json)、[任务 156498，query 3–29 行](../../../../sql-static-lineage-data/task-projections/tasks/156498/versions/0fd84bd3b9fd62fb5d6cfbe62b65b183aea19485143e9fd5e57b463196e86198.evidence-v3.json)、[任务 156499，query 3–23 行](../../../../sql-static-lineage-data/task-projections/tasks/156499/versions/3d6ec4759bc66565d5a957872acc0fe0f3aa032733e97fb732fb20c1928b976d.evidence-v3.json)、[任务 156500，query 3–50 行](../../../../sql-static-lineage-data/task-projections/tasks/156500/versions/f0e60cfcce12ee13c298548955773c461f40386929a1e84bff3c11baaee54639.evidence-v3.json)、[任务 156493，query 3–28 行](../../../../sql-static-lineage-data/task-projections/tasks/156493/versions/f825bcb9a87347043cd6aaf21476c1391d2a1d0b2b7bb896340179540afad448.evidence-v3.json)、[任务 208636，query 1–33 行](../../../../sql-static-lineage-data/task-projections/tasks/208636/versions/295c457a5d12c7543670bcf5a86c1d0191d359e29171c6913079c2ca04697514.evidence-v3.json)。

这些结构加工有普通来源、PB/P 来源、参数模板和延续前日分区等变体。例如 `211596` 先将前日自动赎回分区带入本日，再写本次来源，不能描述成单纯“当天全量替换”；`${src_table}` 模板的业务字段可以读懂，但物理来源仍未确定，不能用注释中的表名补成已确认血缘。[任务 211596，query 1–100 行](../../../../sql-static-lineage-data/task-projections/tasks/211596/versions/2830c8cd687b674ede91409037f34d172a3e584fea71cf4a534196d500f7581d.evidence-v3.json)

<a id="positions-and-value"></a>
## 持仓和估值回答不同问题，金额必须带口径

互换历史持仓以 `KEY_LEG_POSITION_ID` 标识持仓记录，通过腿信息得到合约号；同一合约可能有多条腿、每条腿又有多项标的或持仓。源数量、期初数量、价格、乘数、已实现和未实现收益分别进入模型，原币、本币和人民币字段也分别保存。模型并没有在这里统一重算所有估值公式。[任务 106083，query 3–54 行](../../../../sql-static-lineage-data/task-projections/tasks/106083/versions/450c20f816e4e3061606d3adf3fd33d7ed2bb06de5f3ee63e4254b8a99bda9de.evidence-v3.json)、[任务 106083，query 99–128 行](../../../../sql-static-lineage-data/task-projections/tasks/106083/versions/450c20f816e4e3061606d3adf3fd33d7ed2bb06de5f3ee63e4254b8a99bda9de.evidence-v3.json)；[pdata_n.t03_otc_swap_comp_hold_info DDL](../../../../sql-static-lineage-data/tables/hive/pdata_n.t03_otc_swap_comp_hold_info__gfhive/ddl.sql)。

互换腿估值使用 `KEY_TRS_LEG_POSITION_ID` 形成估值编号，保存 `NOTIONAL / NOTIONAL_ORG / NOTIONAL_BASE` 和 `VALUE / VALUE_ORG / VALUE_BASE`；还区分当日、累计、已实现、未实现和利息。极速分支中，模型市值 `Mval` 来自 `MARKET_VALUE_SETTLE`，原币市值来自 `MARKET_VALUE`。因此把普通与极速的 `Mval` 汇总前，还需要确认结算币种是否一致。[任务 107641，query 3–38 行](../../../../sql-static-lineage-data/task-projections/tasks/107641/versions/736432b35a7e5d4366effeb54de7f84e116cce2376aaa7fe5769554826023913.evidence-v3.json)、[任务 183098，query 31–64 行](../../../../sql-static-lineage-data/task-projections/tasks/183098/versions/08a3669330ed074e223cb6e9787fad78332fd15f73ef23bb61ab7681415345c4.evidence-v3.json)；[pdata_n.t98_otc_swap_comp_leg_valu_info DDL](../../../../sql-static-lineage-data/tables/hive/pdata_n.t98_otc_swap_comp_leg_valu_info__gfhive/ddl.sql)。

账簿持仓汇总来自 `POS_POSITION_DAILY`，保留源持仓 ID、账簿、产品、多空、数量、成本、市值及收益。它是账簿—产品视角，不是合约视角。合约估值汇总再用有效的合约产品关系和合约账簿关系接入这些持仓；重算日期来自账簿持仓与腿估值的更新日期集合，同时有金仕达和映射账簿分支。直接连接合约号无法替代这段路径。[任务 109369，query 3–40 行](../../../../sql-static-lineage-data/task-projections/tasks/109369/versions/2d43d43e6d0b5b4e6c239112d435095693df3310e4c27644a22857fcef48bac0.evidence-v3.json)、[任务 107937，query 27–65 行](../../../../sql-static-lineage-data/task-projections/tasks/107937/versions/730124c1410204492d38c8eacc6f0a82d0b55e5459df7cbbbfbf29e8c07e88a6.evidence-v3.json)、[任务 107937，query 110–172 行](../../../../sql-static-lineage-data/task-projections/tasks/107937/versions/730124c1410204492d38c8eacc6f0a82d0b55e5459df7cbbbfbf29e8c07e88a6.evidence-v3.json)；[pdata_n.t98_otc_book_hold_sum DDL](../../../../sql-static-lineage-data/tables/hive/pdata_n.t98_otc_book_hold_sum__gfhive/ddl.sql)。

名义本金也有多种来源：合同约定本金、动态名义本金、腿级原币/本币本金，以及按标的存储的累计名义本金。任务 `114019` 将源 `ACCUMULATED_NOTIONAL` 直接映射为累计名义本金，并同时限制采集日与 `RECORD_DATE`；它不是现场将本页所有合约持仓求和得到的结果。期权盈亏汇总也从源风险视图搬运 NPV、当日/累计/年内损益和相应币种字段，完整估值解释见[财务与估值](07-finance-and-valuation.md)。[任务 114019，query 3–15 行](../../../../sql-static-lineage-data/task-projections/tasks/114019/versions/1aa5caaddcf94b7af5feff6ecc0fcba3c74b4faa3475448a0efcd232645c4d70.evidence-v3.json)、[任务 107482，query 3–43 行](../../../../sql-static-lineage-data/task-projections/tasks/107482/versions/ab53beeb283410b535af3d623dd3a7cabf70db9496f0770bc0afd35b48d629d2.evidence-v3.json)

历史重算有明确差异：极速持仓和估值以源业务日期输出分区，根据更新日期、近窗口及源/目标按日期计数差异选出重算日。普通变体可能把日期集合放在 `create` 槽位或临时对象中。仅阅读最终 INSERT、或看 `Busi_Date` 字段名，都不能判断是否只处理当天。完整槽位及各自控制条件已保留在审阅账本。[任务 183096，query 1–27 行](../../../../sql-static-lineage-data/task-projections/tasks/183096/versions/960060f1409886b55bd8c988bad4550761a137ee0e2a89aac325c8a2949355ef.evidence-v3.json)、[任务 183098，query 1–27 行](../../../../sql-static-lineage-data/task-projections/tasks/183098/versions/08a3669330ed074e223cb6e9787fad78332fd15f73ef23bb61ab7681415345c4.evidence-v3.json)、[任务 107641，query 127–131 行](../../../../sql-static-lineage-data/task-projections/tasks/107641/versions/736432b35a7e5d4366effeb54de7f84e116cce2376aaa7fe5769554826023913.evidence-v3.json)

<a id="trade-and-state"></a>
## 变动事件解释状态为何改变，但不代替持仓快照

存续事件保存事件发生日、录入/审批时间和名义本金调整前后值。互换来源用 `KEY_TRS_EVENT_ID`，期权来源用 `KEY_OPTION_EVENT_ID`，并分别接到相应协议修饰符；极速事件把事件类型转为小写，通过产品与交易关系补合约，部分前后本金字段写空。互换持仓变动明细另存 `KEY_LEG_POSITION_ID`、变动前后数量及存续事件源 ID。先解释“是什么事件、动了哪份持仓”，才有条件解释该日持仓变化。[任务 124565，query 3–16 行](../../../../sql-static-lineage-data/task-projections/tasks/124565/versions/e4caa8bb64cd287aa65c158098934f9a131617e492e50a855591cec5a3787031.evidence-v3.json)、[任务 124566，query 3–16 行](../../../../sql-static-lineage-data/task-projections/tasks/124566/versions/3464ce52f29b558673a9349e3cc62527561fa2593f8dd0ae4d2aef2f4f44f051.evidence-v3.json)、[任务 216458，query 3–40 行](../../../../sql-static-lineage-data/task-projections/tasks/216458/versions/37775de9e1ea2f01eac1cf70cd6da984ee9aabaa7418b529a8003209339823b4.evidence-v3.json)、[任务 124564，query 3–16 行](../../../../sql-static-lineage-data/task-projections/tasks/124564/versions/c9bd1307c47bcc8db01a403afcaa3b2e6a7edfa08479441dce45b21db392c2bf.evidence-v3.json)

账簿成交记录与收益凭证交易记录共同进入账簿成交事件表，但事件身份不同：一个分支拼接交易 ID 和账簿 ID，并按交易 ID 取最新更新记录；另一个以凭证交易记录 ID 形成事件。互换成交回报又保留分配方向、分配数量和前后变化。模型共表不意味着这三类记录可以互相去重。[任务 159419，query 20–79 行](../../../../sql-static-lineage-data/task-projections/tasks/159419/versions/72cf59ddd6c9cabc9aa0eec153a236ce36b84f4f1ecb27e31edd556c90e14794.evidence-v3.json)、[任务 160714，query 32–76 行](../../../../sql-static-lineage-data/task-projections/tasks/160714/versions/09b8cf3d677b001872e2b7ffa46827b64132016555a131f5b3424c5a468881ba.evidence-v3.json)、[任务 202899，query 13–45 行](../../../../sql-static-lineage-data/task-projections/tasks/202899/versions/e603995ee0fee029bbad7f51da68ac44be503e0618145f0809ef12e73b3ebcd1.evidence-v3.json)

<a id="workflow-and-files"></a>
## 审计、登记、流程和合同文件是另一组事实

证协登记事件保存报备编号、期限、状态、附件状态及实际结算日；修改日志保存实体字段的原值/新值、操作人与处理结果；流程实例保存流程定义、起止节点、起止时间和状态；合同文件信息把文件关联到合约。它们帮助追溯业务处理，但存在登记记录不等于完成报备，存在流程结束时间也不等于持仓或现金已经更新。[任务 107347，query 3–16 行](../../../../sql-static-lineage-data/task-projections/tasks/107347/versions/8f1665d728eb86b80467032c9676cd7771f0bc85b63b533fc1b6ca25fe257484.evidence-v3.json)、[任务 114026，query 3–16 行](../../../../sql-static-lineage-data/task-projections/tasks/114026/versions/0f40aa5e8eff265d1ef60ba76eb267bca0875ba11d65e26d667f9c0c99e03243.evidence-v3.json)、[任务 128578，query 3–24 行](../../../../sql-static-lineage-data/task-projections/tasks/128578/versions/3f4b4c8b1b8acc3e48c0770348042e27b998c41d3280e6b1375bf947d7b9d72e.evidence-v3.json)、[任务 207946，query 1–45 行](../../../../sql-static-lineage-data/task-projections/tasks/207946/versions/3bc7724aeaa3f7d6cd755ffd2a4aaea39cb79fd08818a2f0a56b61dbf2846393.evidence-v3.json)

<a id="wide-consumers"></a>
## 宽表把对象组织成业务视图，也加入新的筛选口径

期权/互换合约宽表接入状态、内部合约号、分类、主体名称、账簿与产品关系；子交易宽表再把观察日、障碍和票息序列组织成面向阅读的结构。它们并非源合约表的同义副本。子交易宽表排除部分交易状态，按结构类型选择不同 KO/KI 观察规则，并从收付事件中选取最近的清算信息；其日期数组聚合顺序和多表连接唯一性仍需针对消费者验证。[任务 107481，query 190–330 行](../../../../sql-static-lineage-data/task-projections/tasks/107481/versions/d934b8cb1caf8975689bddf6801ad9d2afc27867600b583054ca3d8cf74bd20e.evidence-v3.json)

销售、管理归属、客户宽表及线上开户是本闭合范围中的侧支，保留它们是为了如实交代网络，而不是强行改称“合约”。销售分支按期权结构、互换类型、标的资产类型、币种和业务来源分类，并有明确测试账簿过滤；线上开户分析则使用申请类型、开户步骤完成状态、审核结果及各节点最近审核记录。更多下游口径应接相应业务主题，不能用 AGT 的共同身份层替代这些业务判断。[任务 86840，query 20–87 行](../../../../sql-static-lineage-data/task-projections/tasks/86840/versions/98e14680334a17fef9cf23bcf7f2845dfd68541494598961fb3b0f6b26be0d56.evidence-v3.json)、[任务 86840，query 181–184 行](../../../../sql-static-lineage-data/task-projections/tasks/86840/versions/98e14680334a17fef9cf23bcf7f2845dfd68541494598961fb3b0f6b26be0d56.evidence-v3.json)、[任务 86841，query 159–162 行](../../../../sql-static-lineage-data/task-projections/tasks/86841/versions/a56f356a63b66ab43e23cb4855e77e6c09d02c248a066206ec5b01c40a1a758e.evidence-v3.json)、[任务 220650，query 104–107 行](../../../../sql-static-lineage-data/task-projections/tasks/220650/versions/719a2f738f29fc412c72090bf0422e01175b81bc09557398abeb4774e747b2e0.evidence-v3.json)、[任务 134251，query 84–200 行](../../../../sql-static-lineage-data/task-projections/tasks/134251/versions/4b917e938f00e42fbbc0329b13e8286d7dba1aa0c0d36f847d4800407efe1975.evidence-v3.json)

<a id="risk-and-reporting"></a>
## 风险指标和报表是接出点

压力测试、Vega 分桶、日终/期初定价指标、集中度、标的交易限额、外汇敞口等，也位于本次 EDW_SUM 范围。它们以产品、标的、账簿、日期或指标类型组织，通常接收源计算结果再关联身份。不能把这些指标当成合约结构属性，也不能从名称推导其公式。其风险含义见[风险与定价](06-risk-and-pricing.md)，这里保留本范围每项的 SQL 入口及具体传输、关联和筛选材料。

<a id="nds-interface"></a>
## NDS 保存接口形态，批次和写入方式必须逐项读

大量 `pdata_nds` 任务将 OData 的同日字段投影到接口表，覆盖当日分区；交易、账簿、合约、标的、持仓、估值、白名单和报送结果都可走这条路径。PB 的 `h15` 变体常写入与日终任务相同的目标名称，不是天然独立数据集；另有 `exchange_titans_to_sps` 变体保留 `grp_id,busi_date` 分区。`POS_BUCKET_VEGA_METRICS` 这类 SQL 是整表 overwrite，不能从源有业务日期就推断目标保留每日历史。[任务 160811，query 1–15 行](../../../../sql-static-lineage-data/task-projections/tasks/160811/versions/f684f7808e7c28d728382c6ea77bd031a4e3eadfc7e671f66c259e2bc5cf8f32.evidence-v3.json)、[任务 160815，query 1–30 行](../../../../sql-static-lineage-data/task-projections/tasks/160815/versions/2d97a723769d0b8fac9edf36b03053bdbcf6de229edf78a3df3496f9b3f69cd7.evidence-v3.json)、[任务 152124，query 1–28 行](../../../../sql-static-lineage-data/task-projections/tasks/152124/versions/52ce5094f17cae10b5b3f86f3c432281dc9ddaa306c5ffb6e759edde52ae8864.evidence-v3.json)、[任务 120040，query 1–69 行](../../../../sql-static-lineage-data/task-projections/tasks/120040/versions/59e54faa78f466b92b7c44b0028608ab115897d9661c947f642e6ab2f996675e.evidence-v3.json)

对于接口路径，静态发布证明“这段 SQL 声明了什么输入、输出和条件”；不证明有哪位业务用户实际查询接口、也不证明本次接口数据已送达。

<a id="evidence-limits"></a>
## 阅读和复核边界

审阅账本 [contracts-review.json](../evidence/contracts-review.json) 保存本页 269 项的物理对象、元数据/DDL 路径与哈希、全部 SQL 槽位哈希、控制条件、投影表达式和逐项状态；[funds-review.json](../evidence/funds-review.json) 保存另 62 项。机器抽取表达式和定位文件不自动获得“已理解业务”的状态，整槽位结构核查也不等于每个字段口径已确认。统计以账本 `summary` 为准。

需要显式保留的限制包括：

- **材料缺口。** `149961`、`150768` 有发布 SQL，分别可看见权限/合同属性接口文本，但无可用数据 IO 投影；`213177/213178/213180/213182/213185` 没有发布 SQL。五个数字任务名不能充当其他任务 SQL 的替身，七项均不计业务解释完成。
- **批次与日期字面量混用。** 发布 SQL 中见 `141369/160827/163712/210338/210339/222317/243712` 将 `busi_date` 与 `h15` 或 `h1930` 比较；资金页另有 `213442/236414/236415`。这需要确认参数语义及实际分区，现有证据不够判定运行为空或正确。
- **不同任务写同一物理表。** 历史 `hiveTask` 与 `hiveTask2.0`、PB 和日终版本可能共写。当前目录存在多个生产者，不证明它们同日均启用，也不证明其中一个已经替代另一个；不能合并为一条“最新路径”。
- **空值、枚举与唯一性。** 缺失修饰符不自动等于业务无效；未命中的转码通常保留原值；Hive DDL 未声明主键，LEFT JOIN/INNER JOIN 不保证来源唯一。复杂宽表仍有只定位或只核实模板的记录，未伪装成逐字段业务验收。

本页证据读取于 2026-09-08，依据任务目录内固定发布基线及对应 SQL/DDL；登记状态为 DELETED 的对象仍在逐项账本保留，这不等于实时数据库已不存在。复核一个结论时，应同时打开任务证据中的指定 `sqlSources.slot` 与该物理对象的 TablePack，按这里标出的槽内行号阅读。
