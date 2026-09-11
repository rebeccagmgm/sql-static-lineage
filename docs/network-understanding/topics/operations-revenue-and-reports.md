# 经营日报与指标：规模、创收、盈亏及月季报

[返回经营知识入口](../chapters/08-operations-and-customers.md)

## 创收日报的一行为什么不只是“合约今天赚了多少钱”

`OTC_REV_DAILY_RPT` 同时保留合约、客户、标的、计提日、当前分区日期和组别。发布中可读的 230202 写期权组 01，223867 写金仕达组 03；“互换”230204 在固定发布没有 SQL，当前精确任务包路径也未找到。下游读取 02 组的事实不能代替其创收公式证据。[dm_otc_n.otc_rev_daily_rpt · DDL](../../../../sql-static-lineage-data/tables/hive/dm_otc_n.otc_rev_daily_rpt__gfhive/ddl.sql)

两项可读生产者均从当前销售合约快照出发，要求 OTC 部门、终止/期末日不早于 2022-01-01，然后按 `Agt_Id` 接处于起止定价期间的明细，将明细日期输出为 `Accrued_Date`。当前表分区因此可包含多年的计提日。客户 USCC 来自当天未删除 OIS 公司，历史计提会使用当前可见的主体属性。[230202 · query · 156–200行](../../../../sql-static-lineage-data/task-projections/tasks/230202/versions/054fea93fea9ed6256ee5087deea9b8e94b43aef5625415a20840276b3a06ae3.evidence-v3.json) [223867 · query · 147–161行](../../../../sql-static-lineage-data/task-projections/tasks/223867/versions/6c5c97670353118b223099fd048aca3f8b4d5176d58c54edd0e6f4c1ebf74fd5.evidence-v3.json)

期权组有三条主要计算路径。Risky/安全气囊 X 从按日计提费用出发，区分 CNY/HKD、COMPOSITE/FLEXO 等情形，扣除相应资金成本，再按结算币种兑人民币中间价转换。动态对冲分支按合约绝对 Delta 占标的汇总绝对 Delta 的比重，将标的盈亏与模拟对冲差额分摊到合约；静态对冲按关联合约组的期初名本比例分摊。期初 NPV 另写 `Opt_Npv_Curr_Rev`，不能在不说明口径时与 `Curr_Rev` 相加。静态组从关联编号展开后按编号排序取一条组归属，分母有指定客户排除；SQL 未为所有比例分母提供零值保护。[230202 · query · 92–153行](../../../../sql-static-lineage-data/task-projections/tasks/230202/versions/054fea93fea9ed6256ee5087deea9b8e94b43aef5625415a20840276b3a06ae3.evidence-v3.json) [230202 · query · 161–178行](../../../../sql-static-lineage-data/task-projections/tasks/230202/versions/054fea93fea9ed6256ee5087deea9b8e94b43aef5625415a20840276b3a06ae3.evidence-v3.json)

日期连接同样重要：费用按产品编号和计提日；动态对冲持仓指标还加账簿；普通持仓损益按合约产品、账簿、计提日。HIBOR/SOFR 使用上月最后交易日的利率展开为当月日期，资金成本系数按有效日期展开。`mid_price` 缺失默认 1 是实现中的回退，不能证明原币一定等于人民币。[230202 · query · 185–303行](../../../../sql-static-lineage-data/task-projections/tasks/230202/versions/054fea93fea9ed6256ee5087deea9b8e94b43aef5625415a20840276b3a06ae3.evidence-v3.json)

金仕达组只对 `B_LONG_SHORT_SWAP` 给出非零 `Curr_Rev`：利息减实际占资×资金成本÷365，加每日交易佣金，再减成交金额×0.00000641 和客户费用。累计佣金、成交金额和费用用窗口相邻差得到每日增量；实际占资按计提日最近交易日连接；系数只取当前可见、未删除的金仕达资金成本配置并按有效期展开。它不是期权 Delta 分摊的另一种别名。[223867 · query · 92–99行](../../../../sql-static-lineage-data/task-projections/tasks/223867/versions/6c5c97670353118b223099fd048aca3f8b4d5176d58c54edd0e6f4c1ebf74fd5.evidence-v3.json) [223867 · query · 162–197行](../../../../sql-static-lineage-data/task-projections/tasks/223867/versions/6c5c97670353118b223099fd048aca3f8b4d5176d58c54edd0e6f4c1ebf74fd5.evidence-v3.json)

## 常用经营指标的直接公式

| 表/任务                               | 实际粒度与口径                                                            | 使用边界                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `bi_otc_amount_change` / 227697       | 客户名称+USCC+计提日，分别合计期权/互换动态名本，最近 12 个月             | 名字叫 change，SQL 未求相邻日差，是各日规模水平                                    |
| `bi_otc_year_revenue` / 227701        | 客户+计提年，按 OPTION/TRS 汇总 `Curr_Rev` 并除 1 万；非 CNY 标的创收另列 | “跨境”由标的币种判断，不能代替法律主体或完整跨境分类；交叉奖励按公司名和结算年另接 |
| `bi_otc_busi_stat` / 228008           | 客户+业务类型+合同类型，新增仅首个计提日初始名本，存量取当天动态名本      | 只保留期初日≥2025-04-01 的合同；利润率为今年创收/当日正存量，不是年化收益率        |
| `bi_otc_underlying_analysis` / 234355 | 客户+标的+业务类型+计提日，动态名本÷1万                                   | `current_pnl` 直接 NULL；出口 234407 又排除标的名称含分号的行                      |
| `otc_rev_daily_rpt_sum` / 227888      | 按业务类型、客户、合同类型和计提日等维度合计规模/创收/NPV创收             | 数据库出口自身有聚合，不是明细的无损副本                                           |

公式证据：[227697 · query · 9–22行](../../../../sql-static-lineage-data/task-projections/tasks/227697/versions/dde02898bbcc610245d3e308de389be76c8094f2531be7b7802b18a9601ee6d9.evidence-v3.json) [227701 · query · 18–44行](../../../../sql-static-lineage-data/task-projections/tasks/227701/versions/56bc3d521850db14663cd55d76c21c53516335189eea1cde089db9c8f0342c2b.evidence-v3.json) [228008 · query · 15–44行](../../../../sql-static-lineage-data/task-projections/tasks/228008/versions/46414c969ab4fcf6f2b7c78f8a6bcb3b8564b34b4cb2c0f0fff4f32c21de790b.evidence-v3.json) [234355 · query · 11–23行](../../../../sql-static-lineage-data/task-projections/tasks/234355/versions/fea6b528ba398c82d80543a01261a83d0564f5e2642dc13c50bbcebab0b5db6c.evidence-v3.json) [234407 · query · 9–11行](../../../../sql-static-lineage-data/task-projections/tasks/234407/versions/4378ce5e239fbc0e2cd31b0f06c4d61bf9aea8caa096f59f60927486ef13e085.evidence-v3.json) [227888 · query · 1–22行](../../../../sql-static-lineage-data/task-projections/tasks/227888/versions/9a44a6e092fbaaa9ff21e97ecd96c9631a19d3578e9fed88dfc96a1f6d70b711.evidence-v3.json)

## 客户持仓盈亏为什么又读了一批日内表

227869 从当前创收日报取客户与标的的当天持有规模；盈亏不是直接用创收，而是两项相加：历史结算类资金流水、当天期权合约 PV/互换浮动收益估值。资金流水读 h15，先取“行数超过 10 万的源日期中最大日期”，再筛备注非空、类型含“结算”；备注连接 OTC 内部交易号。数量阈值只是程序选批条件，既不是取数据量最大的一批，也不能证明完整性。期权结构和互换腿/持仓取 h13，形成日内批次混合。[227869 · query · 75–157行](../../../../sql-static-lineage-data/task-projections/tasks/227869/versions/d3f31e49b0aaf98998cc305c9846e2f87d36b5eb6dc72f8b0f33bc57ffad1968.evidence-v3.json)

标的优先用流水自带代码，再用期权结构标的，最后用互换持仓代码集合。估值只取 h15 组、当天业务日期和 `vr_opt_contractPV_eur` / `vr_trs_floatIncome_eur` 两类要素，备注接交易对手 ID、业务键接交易编号。最终通过公司名称和标的代码连接创收规模，不以 USCC 接盈亏来源；未匹配盈亏填零。比例分母是同名客户各输出行盈亏绝对值之和，它表达盈亏贡献度，不是以本金为分母的投资回报率。字符串形式的多标的组合也不会自动拆分到单证券。[227869 · query · 175–300行](../../../../sql-static-lineage-data/task-projections/tasks/227869/versions/d3f31e49b0aaf98998cc305c9846e2f87d36b5eb6dc72f8b0f33bc57ffad1968.evidence-v3.json) [dm_otc_n.bi_otc_hold_pnl · DDL](../../../../sql-static-lineage-data/tables/hive/dm_otc_n.bi_otc_hold_pnl__gfhive/ddl.sql)

## 互换交易行为和月季经营报告

228241 用首个计提日记录按客户统计 `count(distinct Agt_Id)`、平均初始名本和类型频次，输出“近一年”与“历史”两行范围。“近一年”的下界实际是上一年 1 月 1 日。盈亏/胜率模块另接当前互换腿估值，按 `销售.Inr_Seri_No=估值.Swap_Comp_Agt_Id`，不是拿日报的 `Curr_Rev`。获胜计数是内层行数中盈亏正数之和，分母是 distinct 合约数；关联扩行会影响比值，未见唯一性验证。[228241 · query · 34–129行](../../../../sql-static-lineage-data/task-projections/tasks/228241/versions/cdbb4ccd18160081b8b8726c9146a437d84bf848e678a2c25efdb60fc8e93a6c.evidence-v3.json)

月报 199408/199482 从预计算指标取分支机构日均规模排名和结构占比；199706/199727 比较当前月累计与上月末，使用 COMPANY 组合和业务/合同类型标签；200048 按客户主体日均规模取前十名及十一类合同结构占比；200633 按客户交易频率标签选前三客户，再接其规模最大的交易类型。有并列的 `dense_rank` 可超过名义“前十/前三”；预计算指标的最早源口径应接指标主题，不能仅凭 `index_val` 名称确认。[199408 · query · 7–21行](../../../../sql-static-lineage-data/task-projections/tasks/199408/versions/0335d3b8548f50f895fbdf576cb7d8e40f7d7961a2cf66ba443ffe03aabb0199.evidence-v3.json) [199482 · query · 9–38行](../../../../sql-static-lineage-data/task-projections/tasks/199482/versions/a8d39bf217872dba95a66b63b119d4283c66177f6d86456178d1b5dea5d5ccca.evidence-v3.json) [199706 · query · 41–111行](../../../../sql-static-lineage-data/task-projections/tasks/199706/versions/db82b5a8600affeca440ae2c9ebee67918e2a437d7a9ec7989f11b68bd770449.evidence-v3.json) [200048 · query · 31–67行](../../../../sql-static-lineage-data/task-projections/tasks/200048/versions/ebe95e15e5ff7548ae8c228cea8ee8a79c0491484b14f527ac507f232cad9664.evidence-v3.json) [200633 · query · 21–79行](../../../../sql-static-lineage-data/task-projections/tasks/200633/versions/6c616d46658f8a25635e38de74f13b27fb8435cde508149596f009bda20a67ed.evidence-v3.json)

已发现两处名称与实现冲突，应在消费时保留：199727 的本月占比分母 `sum(sum(index_val)) over()` 来自当前日和上月末共同集合，含两期数据；上月为零时环比硬编码为 1，零增长也被方向分支写成“下降”。198739 的“四个季度奖励持续下滑”标志实际检测 `前三季<前两季<前一季<本季`，这是严格上升；同一 SQL 的分段趋势文字又把 `<` 正确写为“上升”。因此不能把该标志直接用于下滑预警。[199727 · query · 10–31行](../../../../sql-static-lineage-data/task-projections/tasks/199727/versions/3d4d80bc804075af383ba8afeed3fe1f40288275f909d647b8f3d421b0801429.evidence-v3.json) [198739 · query · 31–53行](../../../../sql-static-lineage-data/task-projections/tasks/198739/versions/f6373b87c3066a19b934c9b4b712d491d3b3af0ec9098d704fd17007b2683e11.evidence-v3.json)

198739 的报告季度是运行日往前三个月所在季度，读取前四个季度的奖励和销售收入，按有效合同类型标签汇总并除 1 万；“截至当季”在本查询里是这四季度窗口的合计，不应无条件解读成年初累计。[198739 · query · 53–104行](../../../../sql-static-lineage-data/task-projections/tasks/198739/versions/f6373b87c3066a19b934c9b4b712d491d3b3af0ec9098d704fd17007b2683e11.evidence-v3.json)

## 受益所有人穿透占比与经营通知

208230 对仍存续的安全气囊 X/互换合约，将受益人或超比例持有人比例×当天标的动态名本汇总，除以上个有效交易日的总市值，再加上季度末公开持股比例，最终筛大于 3%。受益人同名不同证件的分支会按姓名取证件最大值、比例最大值；公开股东表又用证券和股东姓名 **inner join**，未匹配者不会进入结果。它是一套明确范围的提示计算，不能宣称覆盖所有实益拥有人或完整权益披露口径。[208230 · query · 1–170行](../../../../sql-static-lineage-data/task-projections/tasks/208230/versions/610408609d37b8381a060d77be9c991123a7c76d1c5bdc3302e4eecd1538b09f.evidence-v3.json)

210221 仅传当天结果并删除目标当天分区。212278 是关联的邮件任务，当前 `sqlFiles` 为空，本次未取得收件人、正文模板或实际发送日志；不能从调度存在推导通知已经送达。[210221 · query · 1–12行](../../../../sql-static-lineage-data/task-projections/tasks/210221/versions/884f4a4c34d2172d027843fc485cfad8a8a5db40c82d5a10938001408eccb60e.evidence-v3.json) [210221 · truncate · 1–1行](../../../../sql-static-lineage-data/task-projections/tasks/210221/versions/884f4a4c34d2172d027843fc485cfad8a8a5db40c82d5a10938001408eccb60e.evidence-v3.json)

继续阅读：[客户画像](operations-customers-and-sales.md)、[销售收入](operations-sales-income.md)、[财务与估值](../chapters/07-finance-and-valuation.md)、[下游日期与替换窗口](operations-delivery-and-market-data.md)。
