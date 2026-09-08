# 固收规模：先定业务集合，再定金额

规模表回答“某类业务在某天有多大”，但不同家族对业务范围、有效状态、计价币种和时间窗口的选择并不相同。它们可以在一个看板并列展示，直接相加或逐项对账之前需要先对齐这些条件。

## 北向、南向与境内期货并非同一条公式

171450 的输出按业务类型与日分区保存存量、本年新增、本月新增名义本金。北向期货读取三个公共指标表：当日存量 `index_grp1_CompScal_OtcDeri_Tdy`、本年新增 `index_grp1_DealScal_OtcDeri_Year`、本月新增 `index_grp1_DealScal_OtcDeri_Mth`，分别限定三个指标 ID、共同标签 `tag510003012` 和当天日期。本任务只是取数汇总，公共指标上游对成交、终止、抵消的定义需回到指标本身，不能从这里补造。[171450 · query · 1-52行](../../../../sql-static-lineage-data/task-projections/tasks/171450/versions/a104468df9dcabb6465982d451ef9c3ca27131464c65a6b9ae9e64a16c410678.evidence-v3.json)

南向期货直接读取 `T98_SB_OTC_SWAP_COMP_INFO` 当天合约，只取 `S_CROSS_FUTURE_SWAP`，账簿 10201/10199/10236 分成对冲、对客、对港。存量取原币动态名本；新增取原币初始名本，并以期初定价日落在年初/月初至当天判断。人民币换算依次用原币已为 CNY、对应本币为 CNY 的期初汇率、结算币为 CNY 的结算期初汇率；没有匹配分支时表达式为 NULL。三段均筛状态 101/229/226/225/252，因此“本年新增”是当天状态集合内的新增，不是无条件保留所有年度历史成交。[171450 · query · 54-123行](../../../../sql-static-lineage-data/task-projections/tasks/171450/versions/a104468df9dcabb6465982d451ef9c3ca27131464c65a6b9ae9e64a16c410678.evidence-v3.json)

境内期货按 10234/10227 对客、10235/10228 对冲分类，金额和时间公式类似，但 SQL 中互换类型限制已经注释，实际边界由账簿及状态决定。这个差别必须保留，不能将南向的产品类型条件复制到境内解释。[171450 · query · 125-196行](../../../../sql-static-lineage-data/task-projections/tasks/171450/versions/a104468df9dcabb6465982d451ef9c3ca27131464c65a6b9ae9e64a16c410678.evidence-v3.json) [171450 输出DDL](../../../../sql-static-lineage-data/tables/hive/dm_fii_n.adm_trd_nfutr_scal_sum_day_titans__gfhive/ddl.sql)

## 债券互换与期权的存量、新增

| 家族 | 业务集合 | 存量 | 本月/本年新增 |
|---|---|---|---|
| 债券互换 204172 | 账簿 10218/10231，状态 101/226，排除 `FEE_SWAP`；对手简称“广发全球资本FICC”分为北向，其余为境内利率债互换 | 原币动态名本按合约期初汇率换算人民币 | 原币初始名本换算人民币，按期初定价日入年/月窗口 |
| 期权 201568 | 交易→当日有效 N04 账簿关系，`GFS_FICC`，排除虚拟账簿 10207；反转码后的状态 EFFECTIVE/TERMINATED | 当天位于起始日（含）与提前终止/期末日（不含）之间才保留名本，否则为 0 | 初始名本按期初定价日入年/月窗口 |

债券的三个汇总都从存量分类集合向年/月新增左连接。期权按账簿 10213/10241 标成利率/债券期权，其他再按对手英文简称分为对内固收委、对内资金部、对客。其汇率依次为 CNY=1、CNY 结算使用结构期初汇率2、其他使用期初定价日的市场汇率。它没有把 NULL 汇率默认成 1。[204172 · query · 8-71行](../../../../sql-static-lineage-data/task-projections/tasks/204172/versions/d04843012c277b2628c5e5d5068829277c68a49d810ef1cb8211edaae543a215.evidence-v3.json) [201568 · query · 1-138行](../../../../sql-static-lineage-data/task-projections/tasks/201568/versions/6f442394109a3fad948b3f7dda1945bffa64aefa15a0d6ef6b53c4dbe6c544ce.evidence-v3.json) [201568 · query · 148-156行](../../../../sql-static-lineage-data/task-projections/tasks/201568/versions/6f442394109a3fad948b3f7dda1945bffa64aefa15a0d6ef6b53c4dbe6c544ce.evidence-v3.json)

期权取合约、宽表内部编号、结构、账簿关系、账簿名及对手名；其中多处是内连接。缺少维度会失去该合约，不只是缺一个显示名称。合约与关系表中的 ID、修饰符及有效区间应一起核对，具体模型背景见[合约与持仓](../chapters/03-contracts-and-positions.md)。

## 合约规模明细不等于业务规模表的直接明细

209894 把互换与期权合并，保留类型、对手、合约协议编号、内部编号、状态、账簿、三个规模值。互换按当天 GFS_FICC 账簿取数，产品类型限制是注释；期权也按部门取数，却没有 201568 的 EFFECTIVE/TERMINATED 最终过滤和排除 10207 的条件。因此“各合约规模求和=上述业务规模”不是这个发布版本已建立的等式。[209894 · query · 15-176行](../../../../sql-static-lineage-data/task-projections/tasks/209894/versions/20f15447830b9448d45a3ce5957c75ca4efb6aaf371c265a55ca804dd0d6210a.evidence-v3.json) [209894 · query · 181-300行](../../../../sql-static-lineage-data/task-projections/tasks/209894/versions/20f15447830b9448d45a3ce5957c75ca4efb6aaf371c265a55ca804dd0d6210a.evidence-v3.json)

这里的状态来源还要区分：合约状态经 `REF_CD_CVT_MAP` 映射回源系统值，交易关系按协议 ID 连接。它没有证明同一合约/账簿/日期只出现一次，也没有在最终求和之前建立唯一约束。[209894 输出DDL](../../../../sql-static-lineage-data/tables/hive/dm_fii_n.adm_trd_comp_scal_sum_day_titans__gfhive/ddl.sql)

## “国债期货现值”实际从确认收付累计而来

182264 的 `Pv` 是针对对手简称“广发全球资本FICC”的互换，按有效交易关系接 `T05_OTC_RECV_PYMT_EVT`，筛未删除、状态 VERIFIED、清算日不晚于当天，计算 `-sum(Aft_Adj_Amt)`。同样口径算前一自然日，再做当天减前日得到 `Pv_Diff`。该任务没有期货账簿或互换类型筛选；名称里的“国债期货”不能代替实际业务集合。SQL虽取收付币种，却没有按币种分组或换汇，故这里不能断言它已经是统一币种公允价值。[182264 · query · 7-75行](../../../../sql-static-lineage-data/task-projections/tasks/182264/versions/af4c723946fb6c44ed63b107bc74ac644fa056cbf95339b843c245de6f3b9c11.evidence-v3.json)

利率读取 `WD-FR007.IR`，日期取不晚于当天的银行间交易日历最近交易日。它在本任务是并列展示字段，未用于将现金流折现。VERIFIED 是所筛源收付状态，也不等于真实银行款已结算；参见[资金与保证金](../chapters/05-funds-and-margin.md)。[182264 · query · 76-88行](../../../../sql-static-lineage-data/task-projections/tasks/182264/versions/af4c723946fb6c44ed63b107bc74ac644fa056cbf95339b843c245de6f3b9c11.evidence-v3.json)

## 下游合表的替换范围

171657/201572/204174 从当天三个规模表输出，把 `busi_date` 改名为 `Hold_Date`，登记到同一 `gfedw.adm_trd_nfutr_scal_sum_day_titans`；删除槽位按日期和业务类型分段清理。期货和债券清理名单与这里看到的业务分类相符，期权清理名单缺少生产查询已产生的“债券期权”。这意味着删除与选数范围不对称；是否产生重复或旧行残留，还取决于目标键及实际加载方式，静态材料不能直接判定。[171657 · truncate · 1-1行](../../../../sql-static-lineage-data/task-projections/tasks/171657/versions/32519946d6c24133a273753a288974f7574f3878369dd5de1cb1780cbfcf5174.evidence-v3.json) [201572 · truncate · 1-1行](../../../../sql-static-lineage-data/task-projections/tasks/201572/versions/9c0fc74410cc7a67bd5e714a1ab4543f634431302edfc93b46426fd14f40b3fa.evidence-v3.json) [204174 · truncate · 1-1行](../../../../sql-static-lineage-data/task-projections/tasks/204174/versions/3bb694fa8127d13e17ecd1745b84910cefaed189f94d1fa2b3afe43903353806.evidence-v3.json)

211076/211090/211097 加了装载时间并输出同样业务字段，但发布目标登记为 Hive 同名对象，与任务类别指向的出口并不一致；不能仅凭名称写成已确认 StarRocks 物理去向。输出与配置的界限见[下游交付](fixed-income-funds-and-delivery.md)。

返回[固收入口](../chapters/11-fixed-income.md)。
