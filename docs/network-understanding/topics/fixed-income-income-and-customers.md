# 固收收入与客户业务统计

本页的“收入”涉及交易收费要素、日保有利差估算、期权净费用和面向 CRM 的业务金额。它们的用途与粒度不同，不能把列名中的收入、规模或名本当成已统一的经营指标。

## 互换交易流水与保有收入

222569 以当天源交易、账簿和合约为入口，筛 GFS_FICC 且账簿名以“对客”结尾、合约 EFFECTIVE/TERMINATED。只取新建、平仓、提前终止、到期事件，排除 FAILED/CANCELED；按事件 ID 连接结构化标的明细。名为开平仓名义本金的值是事件价格×绝对数量，平仓相关事件取平仓费率，新建事件取当前结构腿持仓费率。这是交易收费所需的明细要素，输出中没有统一的“实际收费收入”计算。[222569 · query · 30-63行](../../../../sql-static-lineage-data/task-projections/tasks/222569/versions/563a6ac073e671b09c718ea80b960913a9882f3c23d8cd14169476d7501c0aee.evidence-v3.json) [222569 · query · 123-136行](../../../../sql-static-lineage-data/task-projections/tasks/222569/versions/563a6ac073e671b09c718ea80b960913a9882f3c23d8cd14169476d7501c0aee.evidence-v3.json)

这里还把事件、当前结构腿持仓和非结构腿分别按合约/腿接入。持仓连接没有在事件标的与当前持仓标的之间补等值条件；多标的或多费用腿可能放大事件行，不能默认一事件一行。当天源快照也不等于只含当天事件，查询未限制 `EVENT_DATE=当天`。

222726 面向相同部门、对客账簿及合约状态，连接当天装载的日持仓和腿历史持仓，并用原业务日期相等、原业务日期不早于费用腿起始日筛选。它定义期初价为开仓全价×(1+佣金率)，存续名本为该价格×数量，日收益为该名本÷365×绝对利差。利差取绝对值而数量保留正负，未另做百分数单位换算；使用时必须沿用源字段单位，不能自行再除 100。输出原持仓日与当天分区并存。[222726 · query · 25-50行](../../../../sql-static-lineage-data/task-projections/tasks/222726/versions/29cd31acf0e35b4e2e745f35c1894d3d3e58850c9d32ee132bd4b0b68a33c4e6.evidence-v3.json) [222726 · query · 108-146行](../../../../sql-static-lineage-data/task-projections/tasks/222726/versions/29cd31acf0e35b4e2e745f35c1894d3d3e58850c9d32ee132bd4b0b68a33c4e6.evidence-v3.json)

两项输出登记及 DDL 分别为 `dtl_trd_jour_income_day`、`dtl_tnr_scal_sale_income_day`。222589/222728 按当天分区输出并对价格、利差、佣金、金额转 double，保留事件/持仓原日期；其发布目标登记仍为 Hive，应与“h2sr”任务名称分开理解。[222589 · query · 1-31行](../../../../sql-static-lineage-data/task-projections/tasks/222589/versions/0b00161783f0b2264465079aec4c8e59a11dcbe753e08ce270fdd75a13a4810f.evidence-v3.json) [222728 · query · 1-26行](../../../../sql-static-lineage-data/task-projections/tasks/222728/versions/b35179361342adc321d27914f886db1dce7ad5a30da70250fa9159b8f65421bb.evidence-v3.json)

## “同业/非同业”期权两表实际都限定两本账簿

227251 名为非同业机构期权收入持仓，227254 名为同业机构期权收入交易，两者最终都筛账簿 10175、10213（商品与利率期权），并筛 EFFECTIVE/TERMINATED。SQL 没有按机构同业类型分组或过滤，所以名称不能证明两者构成互斥客户集合。[227251 · query · 223-224行](../../../../sql-static-lineage-data/task-projections/tasks/227251/versions/ab9f5fca15afd771edea94dee5ee5358abaa80d9f9e7676cf4d149beb2cc8c8d.evidence-v3.json) [227254 · query · 277-278行](../../../../sql-static-lineage-data/task-projections/tasks/227254/versions/eb22baac6bc4494e9c71639e1ae3303e8a3432a2461e216a8c6ccf46cdc7cd73.evidence-v3.json)

持仓版以产品+账簿接历史持仓，再按相同业务日接日终指标，用 `coalesce(cm.nom_prin,cm.init_nom_prin)` 作动态名本，原持仓日保留为 `src_busi_date`；历史持仓和指标子查询没有当天过滤。交易版则按交易达成日接指标数量，净期权费为绝对名本×(期权费率−最低收益率)，总期权费另取源字段。客户名称、法律主体和鉴别信息接成所谓 USCC，但鉴别信息子查询未限定信息类型，因此不能仅凭输出名证明所有值都是统一社会信用代码。[227251 · query · 94-123行](../../../../sql-static-lineage-data/task-projections/tasks/227251/versions/ab9f5fca15afd771edea94dee5ee5358abaa80d9f9e7676cf4d149beb2cc8c8d.evidence-v3.json) [227251 · query · 179-222行](../../../../sql-static-lineage-data/task-projections/tasks/227251/versions/ab9f5fca15afd771edea94dee5ee5358abaa80d9f9e7676cf4d149beb2cc8c8d.evidence-v3.json) [227254 · query · 234-278行](../../../../sql-static-lineage-data/task-projections/tasks/227254/versions/eb22baac6bc4494e9c71639e1ae3303e8a3432a2461e216a8c6ccf46cdc7cd73.evidence-v3.json)

## 销交协同：客户、销售与交易的连接

237888 合并 TITANS 互换/期权、衡泰 CLN、衡泰收益互换和债券远期，输出客户、账户所属机构、账簿、销售、最近交易日及两种名本。TITANS 分支要求 GFS_FICC_COM/GFS_FICC、账簿启用风险报送、引入部门 8046；客户经理接 OA 用户，机构类型及账户所属机构通过客户全名与 OOM 签约产品名（缺失时法人名）相等连接。输出“引入人”直接复制销售姓名/OA，未读取独立引入关系。[237888 · query · 17-35行](../../../../sql-static-lineage-data/task-projections/tasks/237888/versions/85f266347004253a00d49f4cf03cac1ee22f6130a530d393b027a65fa2601fa8.evidence-v3.json) [237888 · query · 72-170行](../../../../sql-static-lineage-data/task-projections/tasks/237888/versions/85f266347004253a00d49f4cf03cac1ee22f6130a530d393b027a65fa2601fa8.evidence-v3.json) [237888 · query · 209-307行](../../../../sql-static-lineage-data/task-projections/tasks/237888/versions/85f266347004253a00d49f4cf03cac1ee22f6130a530d393b027a65fa2601fa8.evidence-v3.json)

TITANS 的“当年累计交易名本”实际按当年交易日汇总当前持仓动态名本，缺失时退回合约值；“存续名本”取当前持仓普通名本，缺失时退回合同普通/绝对名本。没有逐事件累计成交。因此它与[规模页](fixed-income-scales.md)的初始名本新增不是同一指标。互换分支还将交易对手 ID 去掉 `TIT060-` 后直接连接未去前缀的 `Pty_Id`，而期权保留完整 ID；这是明确的键表示不一致，实际是否丢行要核对数据，不能宣称两支已完全覆盖。[237888 · query · 47-56行](../../../../sql-static-lineage-data/task-projections/tasks/237888/versions/85f266347004253a00d49f4cf03cac1ee22f6130a530d393b027a65fa2601fa8.evidence-v3.json) [237888 · query · 91-124行](../../../../sql-static-lineage-data/task-projections/tasks/237888/versions/85f266347004253a00d49f4cf03cac1ee22f6130a530d393b027a65fa2601fa8.evidence-v3.json) [237888 · query · 184-193行](../../../../sql-static-lineage-data/task-projections/tasks/237888/versions/85f266347004253a00d49f4cf03cac1ee22f6130a530d393b027a65fa2601fa8.evidence-v3.json)

衡泰分支都经 `金融工具+资产类型+市场` 三项连接交易与产品，以当天账户树 h19 限定账户：CLN 为 Q0022/Q0098，互换为 Q0012，债券远期为 Q0136。CLN 交易额用面值×委托数量，持仓不为零时保留该金额；互换年度交易额取报送人民币本金，USD 存续额以报送本金/面值×长仓数量，否则直接用长仓数量；债券远期存续取到期结算日不早于当天的面额。最后一支“当年累计”计算只有交易日不晚于当天，**没有年初下界**。客户机构仍按名称接 OOM，不是三系统 ID 已统一。[237888 · query · 321-467行](../../../../sql-static-lineage-data/task-projections/tasks/237888/versions/85f266347004253a00d49f4cf03cac1ee22f6130a530d393b027a65fa2601fa8.evidence-v3.json) [237888 · query · 471-628行](../../../../sql-static-lineage-data/task-projections/tasks/237888/versions/85f266347004253a00d49f4cf03cac1ee22f6130a530d393b027a65fa2601fa8.evidence-v3.json) [237888 · query · 632-778行](../../../../sql-static-lineage-data/task-projections/tasks/237888/versions/85f266347004253a00d49f4cf03cac1ee22f6130a530d393b027a65fa2601fa8.evidence-v3.json)

237893/239731 的固定发布查询相同：当天协同结果 `distinct` 后送出，登记目标都是 `SIEBEL.ECRM_XJ_OTC_SYNERGY_DATA`。任务类别中的 Oracle/PostgreSQL 差别不能凌驾于发布登记；这里可以核实选数，尚不能确认两个物理数据库出口。[237893 · query · 1-17行](../../../../sql-static-lineage-data/task-projections/tasks/237893/versions/7ed9eabe1587c10599030f215954c62a517d98208aaa9c66c7eed455946615a3.evidence-v3.json) [239731 · query · 1-17行](../../../../sql-static-lineage-data/task-projections/tasks/239731/versions/dd5a54f6e298ea4eacea3af70b5d29d8bb62456eb0bf452baec67ee0427e6c45.evidence-v3.json)

## 理财子月报覆盖哪些业务

232836 组合了 11 个业务分支，金额以亿元输出，按机构、二/三级部门和交易月份归集。它不是全客户月报：各分支采用一组固定的 18 个 USCC。衡泰客户先接机构层级，缺 USCC 时以 CRM 同名机构的 `max(USCC)` 补值；产品的归属路径通过 `<` 拆成多层名字，再参与汇总，没有只选一个层级的最终限制。名称和层级都影响金额分组，不能把输出视为已去重的法人名单。[232836 · query · 1-67行](../../../../sql-static-lineage-data/task-projections/tasks/232836/versions/6f852763a30672c6e654afdc2f7569c24ae76a0af7f49ae6699f4175aa55cb8b.evidence-v3.json) [232836 · query · 230-342行](../../../../sql-static-lineage-data/task-projections/tasks/232836/versions/6f852763a30672c6e654afdc2f7569c24ae76a0af7f49ae6699f4175aa55cb8b.evidence-v3.json)

| 业务分支 | 实际金额和主要边界 |
|---|---|
| 一级债券 | 当天衡泰主交易快照中状态7、承销注册类型60，累计委托金额，按原交易月份分组 |
| 流动性支持 | 债券交易基础表类型61（分销买入），按原交易月累计委托金额；该源没有当天分区过滤 |
| 二级交易 | 主交易状态7，限定撮合过券账户 Q0044，累计委托金额 |
| 资金交易 | 主交易状态7、逆回购类型41/47，累计委托金额 |
| 正/逆回购 | 类型40/46与41/47，另排无效对手和首期指令0；亿元保留0位小数，其他多数分支保留2位 |
| TITANS 期权/利率债互换 | 沿合约、账簿、状态及汇率规则取动态名本，但先按月/对手等窗口取一行，再求和 |
| CLN/信用保护工具/CDS | 衡泰状态7/10；前两者取面值×委托数量，CDS取本金；只在当前有效长仓非零时计入，再按原交易月份分组 |

[232836 · query · 347-871行](../../../../sql-static-lineage-data/task-projections/tasks/232836/versions/6f852763a30672c6e654afdc2f7569c24ae76a0af7f49ae6699f4175aa55cb8b.evidence-v3.json) [232836 · query · 875-1026行](../../../../sql-static-lineage-data/task-projections/tasks/232836/versions/6f852763a30672c6e654afdc2f7569c24ae76a0af7f49ae6699f4175aa55cb8b.evidence-v3.json) [232836 · query · 1035-1423行](../../../../sql-static-lineage-data/task-projections/tasks/232836/versions/6f852763a30672c6e654afdc2f7569c24ae76a0af7f49ae6699f4175aa55cb8b.evidence-v3.json)

三个使用限制尤其影响读数。第一，资金交易与逆回购存在类型重叠，分类行不能无条件横向相加。第二，期权窗口按“月+对手+业务类型+状态”，互换按“月+对手+简称”排序取 `rn=1`，**没有合约编号，也没有先汇总某日全部合同**；同组多份合约可能只剩一行，因此不能把该结果断言为完整月末规模。第三，TITANS 对手与衡泰机构层级是去掉系统前缀后按尾部 ID 相等连接，本文没有证据证明两系统编号天然同义。[232836 · query · 901-917行](../../../../sql-static-lineage-data/task-projections/tasks/232836/versions/6f852763a30672c6e654afdc2f7569c24ae76a0af7f49ae6699f4175aa55cb8b.evidence-v3.json) [232836 · query · 973-999行](../../../../sql-static-lineage-data/task-projections/tasks/232836/versions/6f852763a30672c6e654afdc2f7569c24ae76a0af7f49ae6699f4175aa55cb8b.evidence-v3.json)

232845/235360 导出全量替换 CRM 目标，排除资金管理部，并使用 `int(当前yyyyMM)-int(ORD_MON去横线)>1`。这不是正确的月份差：例如一月减上一年十二月为 89，仍会被选入。故它能说明实际筛选，不应写成“严格排除最近一个月”。[232845 · query · 1-14行](../../../../sql-static-lineage-data/task-projections/tasks/232845/versions/d11e697e85261a2821c724049a7fa870d8b7a74eab85d6f602d8e617586219ba.evidence-v3.json) [235360 · truncate · 1-1行](../../../../sql-static-lineage-data/task-projections/tasks/235360/versions/230371f8c9a6b3529bd1820e28b158fbbf3464579779f03f111436018b5ef0f3.evidence-v3.json)

这些口径与差异应在业务确认时逐项对齐，正文保留 SQL 行号供复核；本知识主题不修改源 SQL，也不将静态疑点断言为已发生的生产损失。

返回[固收入口](../chapters/11-fixed-income.md)，相关客户和收入背景见[经营与客户](../chapters/08-operations-and-customers.md)。
