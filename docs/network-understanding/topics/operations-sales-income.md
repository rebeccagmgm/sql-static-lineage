# 销售参数与销售收入：三套口径及其归属

[返回经营知识入口](../chapters/08-operations-and-customers.md)

## 先问计算哪种收入

这组任务不是把一列“收入”复制三次。它们分别计算内部引入收入、境内交叉销售收入、香港交叉销售收入，客户范围、合同分类、系数来源和特殊条款都有差别。这些是经营分配和计提，不等于已经付款的财务收入；现金状态另见[收付与交割](operations-trading-and-settlement.md)。

| 口径         | 参数展示                   | 按日计提                        | 明确范围                                                                                                |
| ------------ | -------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 内部引入     | 113993 `otc_inr_sale_para` | 114013 `otc_inr_sale_daily_rpt` | 当前合约，终止/期末日不早于 2023-01-01，排除两项指定客户和极速组；OIS 客户满足监测/未删除条件或明确例外 |
| 境内交叉销售 | 118143 `otc_sale_para`     | 118141 `otc_sale_daily_rpt`     | 不含 FEE_SWAP、极速组、OTC_HK；要求机构归属条件或指定历史合约例外                                       |
| 香港交叉销售 | 220981 `otc_hk_sale_para`  | 220979 `otc_hk_sale_daily_rpt`  | 六类明确香港账簿，终止/期末日≥2025-12-01；香港客户未删除且允许计入交叉销售收入                          |

以上是发布 SQL 的范围，不外推为现行制度。[113993 · query · 53–56行](../../../../sql-static-lineage-data/task-projections/tasks/113993/versions/ca5b742f9fa419a9517cedd6ba648182635d95c497beae835cb218fabf5db34c.evidence-v3.json) [114013 · query · 222–238行](../../../../sql-static-lineage-data/task-projections/tasks/114013/versions/3793bc56f5126d6a8042bf97f60dfcca5501521e18b981bb8bdeecfaae2c24fa.evidence-v3.json) [118143 · query · 124–130行](../../../../sql-static-lineage-data/task-projections/tasks/118143/versions/af9bfbf385124e138492654309f42a3198acd6afaf670184ef9ad2d8ac758b7c.evidence-v3.json) [118141 · query · 297–405行](../../../../sql-static-lineage-data/task-projections/tasks/118141/versions/0b0884fbbe2a38bb0db0e366f585c0306529c68f4d105990504ca8625cc4776e.evidence-v3.json) [220979 · query · 303–318行](../../../../sql-static-lineage-data/task-projections/tasks/220979/versions/62f74c1cbaa179b3c0d00713afb74014ae6a33c23466e4b7e275260cf6447ebc.evidence-v3.json)

## 参数展示为什么不等于某个历史日的计提参数

境内参数页先找合约专属价差，再找客户×合同类型的默认价差；基础奖励也优先合同级，再用合同类型级。合同级价差用 `Inr_Comp_No=info.Agt_Id`，按生效日倒序选 `row_number=1`；历史参数另外拼成 `Sprd_Data`。客户默认价差按客户、合同类型和**期初定价日**连接，而不是按今天取一条。参数页还有终止日期大于 2021-09-30、第一组引入机构非空的要求，不能把其行数直接与销售日报比较。[118143 · query · 75–81行](../../../../sql-static-lineage-data/task-projections/tasks/118143/versions/af9bfbf385124e138492654309f42a3198acd6afaf670184ef9ad2d8ac758b7c.evidence-v3.json) [118143 · query · 124–224行](../../../../sql-static-lineage-data/task-projections/tasks/118143/versions/af9bfbf385124e138492654309f42a3198acd6afaf670184ef9ad2d8ac758b7c.evidence-v3.json)

日报将合同级价差从生效日起展开到下一个生效日前一天，再用 `合同编号+计提日` 匹配。默认客户价差、类型基础系数及资金成本，则按期初定价日匹配。`T98_OTC_DERI_COMP_SALE_INFO` 是当天合约快照，`SALE_ADTNL_DET` 按 `Agt_Id` 接历史计提明细；这是一份“按今天可见合同与参数重组的历史日序列”，不是只写今天一行。所有这些关联都没有在本任务执行唯一性断言。[118141 · query · 302–403行](../../../../sql-static-lineage-data/task-projections/tasks/118141/versions/0b0884fbbe2a38bb0db0e366f585c0306529c68f4d105990504ca8625cc4776e.evidence-v3.json)

内部引入参数只认 `Coef_Type='INR'` 的合同价差；交叉销售明确排除 INR。引入基础类型映射会展开标的类型列表，合同级覆盖基础系数和基础收益率，类型级参数按期初日生效。参数展示用最新合同价差；引入日报则把价差展开到每天，按 `dy.Agt_Id+dy.busi_date` 匹配。2026-01-01 起特定港股通类型被归为 CD025；这属于已编码的分类变更，不能忽略日期后拿类型分布横向比较。[113993 · query · 203–355行](../../../../sql-static-lineage-data/task-projections/tasks/113993/versions/ca5b742f9fa419a9517cedd6ba648182635d95c497beae835cb218fabf5db34c.evidence-v3.json) [114013 · query · 174–199行](../../../../sql-static-lineage-data/task-projections/tasks/114013/versions/3793bc56f5126d6a8042bf97f60dfcca5501521e18b981bb8bdeecfaae2c24fa.evidence-v3.json) [114013 · query · 262–338行](../../../../sql-static-lineage-data/task-projections/tasks/114013/versions/3793bc56f5126d6a8042bf97f60dfcca5501521e18b981bb8bdeecfaae2c24fa.evidence-v3.json)

## 内部引入：按年化或绝对方式计提，再分经办人

引入日报把 B2B 期权的期初 NPV 作为特定首日收入：关联合约编号列表展开后，取本合约期初 NPV 的最大值加关联合约 NPV 之和。普通绝对方式仅在起始日计提 `初始名本×基础系数×(基础收益率+绝对价差)`；年化方式按动态名本乘相应年化系数再除 365。Risky/安全气囊和金仕达多空互换另外按保证金比例扣除融资占比，不能套用同一名本公式。早于 2023 年的首日计提有 2023-01-01 补入条件。[114013 · query · 129–148行](../../../../sql-static-lineage-data/task-projections/tasks/114013/versions/3793bc56f5126d6a8042bf97f60dfcca5501521e18b981bb8bdeecfaae2c24fa.evidence-v3.json) [114013 · query · 239–261行](../../../../sql-static-lineage-data/task-projections/tasks/114013/versions/3793bc56f5126d6a8042bf97f60dfcca5501521e18b981bb8bdeecfaae2c24fa.evidence-v3.json)

有引入经办人时，主经办人拿 40%、引入经办人拿 60%；无引入经办人则主经办人 100%。累计收入按 `Agt_Id`、计提日累积。这里是两种人员角色分成；三组机构的 `Allo_Prop` 是另一层分配，不能把两者混为同一个百分比。[114013 · query · 86–103行](../../../../sql-static-lineage-data/task-projections/tasks/114013/versions/3793bc56f5126d6a8042bf97f60dfcca5501521e18b981bb8bdeecfaae2c24fa.evidence-v3.json)

## 境内交叉销售：年化、首日、融资类和期末补足

基础系数与价差可以各自采用年化或绝对方式。年化部分按有效期间内动态名本×年化率÷365，绝对部分按首日初始名本×绝对率；SQL 分别写出期权/互换及两类计算方式的组合。安全气囊类若为 DEDUCTION 则收入为零；其他分支考虑初保/基保线、税前费率除 1.06、资金成本和 30% 系数。金仕达分支使用利息、交易佣金、佣金成本和资金占用，还扣除按当天总收入分摊的固定成本。[118141 · query · 187–248行](../../../../sql-static-lineage-data/task-projections/tasks/118141/versions/0b0884fbbe2a38bb0db0e366f585c0306529c68f4d105990504ca8625cc4776e.evidence-v3.json)

部分个股/指数 ETF 期权在终止日检查累计计提是否低于初始名本的 0.1%，再结合已结算奖励与季度截止日补足；这不是所有合同的保底规则。输出累计收入经过 `default.gfgreatest(...,0)`，这里保留自定义函数调用，不额外保证其内部实现。三组机构收入分别乘三组分配比例；主经办人/引入经办人的规模又按 100/0 或 40/60 分配。[118141 · query · 116–174行](../../../../sql-static-lineage-data/task-projections/tasks/118141/versions/0b0884fbbe2a38bb0db0e366f585c0306529c68f4d105990504ca8625cc4776e.evidence-v3.json) [118141 · query · 187–198行](../../../../sql-static-lineage-data/task-projections/tasks/118141/versions/0b0884fbbe2a38bb0db0e366f585c0306529c68f4d105990504ca8625cc4776e.evidence-v3.json) [118141 · query · 407–418行](../../../../sql-static-lineage-data/task-projections/tasks/118141/versions/0b0884fbbe2a38bb0db0e366f585c0306529c68f4d105990504ca8625cc4776e.evidence-v3.json)

## 香港交叉销售：独立客户资格、佣金和返息基数

香港参数和日报都要求客户 `Incl_Cs_Income_Flag='1'`，并从明确香港账簿范围重分类为香港合同类型及标的类型。默认价差/佣金按客户×业务类型×标的类型、期初日连接；专属合同价差/佣金优先。参数页按最新生效日显示，日报展开有效区间按计提日取值。香港规则默认价差计算方式为 ANNUALIZED，境内日报对应分支默认 ABSOLUTE；不能将两者合并成一份通用模板。[220981 · query · 125–299行](../../../../sql-static-lineage-data/task-projections/tasks/220981/versions/d0328338a761f065310d74ded6d2862fafd5b60700d07a2f0a40de92ebd8c6e5.evidence-v3.json) [220979 · query · 195–224行](../../../../sql-static-lineage-data/task-projections/tasks/220979/versions/62f74c1cbaa179b3c0d00713afb74014ae6a33c23466e4b7e275260cf6447ebc.evidence-v3.json)

香港互换额外计交易佣金：期初日用初始名本，其他日用事件成交金额×汇率；事件金额由正常互换事件及极速事件两个分支合并，普通分支要求生效状态，并关联事件结构明细以 `sum(abs(数量)×价格)` 汇总。返息用途 FEE_SWAP 的计提基数可以换成当天返息基数×汇率。这解释了为什么它不能套用境内“排除费用互换”的规则。[220979 · query · 205–224行](../../../../sql-static-lineage-data/task-projections/tasks/220979/versions/62f74c1cbaa179b3c0d00713afb74014ae6a33c23466e4b7e275260cf6447ebc.evidence-v3.json) [220979 · query · 319–354行](../../../../sql-static-lineage-data/task-projections/tasks/220979/versions/62f74c1cbaa179b3c0d00713afb74014ae6a33c23466e4b7e275260cf6447ebc.evidence-v3.json)

香港也有特定期权类型的期末补足，使用香港已结算奖励；当前主体/销售归属与历史计提组合后，仍需保留后续更名、归属变化和一对多关联的影响。跨境主体及币种背景见[香港业务](../chapters/10-hongkong.md)。[220979 · query · 168–175行](../../../../sql-static-lineage-data/task-projections/tasks/220979/versions/62f74c1cbaa179b3c0d00713afb74014ae6a33c23466e4b7e275260cf6447ebc.evidence-v3.json) [220979 · query · 496–514行](../../../../sql-static-lineage-data/task-projections/tasks/220979/versions/62f74c1cbaa179b3c0d00713afb74014ae6a33c23466e4b7e275260cf6447ebc.evidence-v3.json)

## 下游销售表怎样取数

参数出口 158048/225389 额外按 `Agt_Id` 判断是否也存在于引入参数表；158053 在引入表反向判断是否存在交叉销售参数，而 225390 直接传引入参数，没有该反向标记。日报出口 158050/158052 限制终止日不早于运行日往前 550 天；158050 还截断标的代码和名称到 5000 字符。香港日报/参数出口 222749/222751 使用当前分区并全表替换。传输成功与实际奖励发放需另取证。[158048 · query · 60–69行](../../../../sql-static-lineage-data/task-projections/tasks/158048/versions/f6b36b4795f355372cca3e7c3bdca975d5aada3897e51d9ce86226d5a90db7f9.evidence-v3.json) [225389 · query · 62–68行](../../../../sql-static-lineage-data/task-projections/tasks/225389/versions/e7bcf01dce66a56cab2f46b8c770b82f9919b90c97234dcec029f9a560e0f2fd.evidence-v3.json) [158053 · query · 71–79行](../../../../sql-static-lineage-data/task-projections/tasks/158053/versions/6a6a10cfd8b4a0fd265f6a70de01fbfa9a54f2fdd94bec4938f0655b8bbbea20.evidence-v3.json) [225390 · query · 72–73行](../../../../sql-static-lineage-data/task-projections/tasks/225390/versions/a18983955bb5b50156c8d5db1a80fe060f235829f7c1ee30693283d6b3188c8d.evidence-v3.json) [158050 · query · 13–14行](../../../../sql-static-lineage-data/task-projections/tasks/158050/versions/4acadd38a679178fe994c907e9b551513ed95f137cdd21485a4669281f94a7d1.evidence-v3.json) [158050 · query · 112–113行](../../../../sql-static-lineage-data/task-projections/tasks/158050/versions/4acadd38a679178fe994c907e9b551513ed95f137cdd21485a4669281f94a7d1.evidence-v3.json) [158052 · query · 54–56行](../../../../sql-static-lineage-data/task-projections/tasks/158052/versions/375af35c2551284116b252f06da40539f63c20289dc6beb5b809f497df8e2c68.evidence-v3.json) [222749 · truncate · 1–1行](../../../../sql-static-lineage-data/task-projections/tasks/222749/versions/30d8c08f49fa03e4ecce48c11faa0c00983f95b823be5300f126b5600e4f1f9c.evidence-v3.json) [222751 · truncate · 1–1行](../../../../sql-static-lineage-data/task-projections/tasks/222751/versions/52a6aa1089c6ef8d162333718f5e3804acb456165cecd83f5c146c971b3f61cc.evidence-v3.json)

表定义：[dm_otc_n.otc_inr_sale_daily_rpt · DDL](../../../../sql-static-lineage-data/tables/hive/dm_otc_n.otc_inr_sale_daily_rpt__gfhive/ddl.sql)、[dm_otc_n.otc_sale_daily_rpt · DDL](../../../../sql-static-lineage-data/tables/hive/dm_otc_n.otc_sale_daily_rpt__gfhive/ddl.sql)、[dm_otc_n.otc_hk_sale_daily_rpt · DDL](../../../../sql-static-lineage-data/tables/hive/dm_otc_n.otc_hk_sale_daily_rpt__gfhive/ddl.sql)。字段名保留了计提收入、累计收入、计提日和分配比例，未给出已到账证明。
