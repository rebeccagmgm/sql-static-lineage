# 客户、签约结果与销售归属

[返回经营知识入口](../chapters/08-operations-and-customers.md)

## 先区分交易对手、管理人、代签产品和经办人

一笔交易的 TITANS 交易对手、运营系统里的客户/管理人，以及产品代签名称，可以同时出现在经营表中。它们回答不同问题：交易对手承接交易，管理人用于归并客户经营情况，代签产品用于说明产品侧签约名称，经办人用于服务和收入归属。不能只凭名字把四者折叠成一个“客户”。

`goat_ref_counter_party` 的普通账户分支，从当天 `D_REF_COUNTERPARTY` 取 OTC、OTC_HK、GFS_FICC 部门、非账户组且未删除的账户；用 `id=KEY_CTPTY_ID` 接外部编号映射和扩展参数。业务许可来自有效期满足 `strt_date≤当天<end_date` 的当事人分类记录，限定类型 59 后按 `Pty_Id` 拼接。账户组分支则只选 OTC、`GROUP_FLAG='Y'`，用交易组成员表按组 ID 拼成员列表，授权额度和业务许可等字段写空，且没有普通分支的未删除条件。由此得到的是一份带映射和许可属性的接口客户清单，不是开户流程逐节点的完成记录。[150022 · query · 22–102行](../../../../sql-static-lineage-data/task-projections/tasks/150022/versions/ef8854d728dd8b045b3c3272a3e8550f4e5108775c904ea6c56df3456f0d82c9.evidence-v3.json)

经营画像 `bi_otc_cust_index` 的客户范围来自当前分区创收日报里、上一年 1 月 1 日至当天有计提记录的 01/02/03 组客户。输出以名称和 USCC 聚合；通过 `r.Cutp_Pty_Id=c.Pty_Id` 接当天 OIS 客户，再以 `Oper_User_Id=Oa_User_Id` 接员工，聚成销售姓名和账号集合。这条链解释“谁对接这个已有业务的客户”，不能用于统计所有开户客户或开户转化率。[229121 · query · 64–80行](../../../../sql-static-lineage-data/task-projections/tasks/229121/versions/dbd5530118fb0fc7a3ff6bb512f30ed2a5f30ca96149bd89d2d0ad0542d604fd.evidence-v3.json) [dm_otc_n.bi_otc_cust_index · DDL](../../../../sql-static-lineage-data/tables/hive/dm_otc_n.bi_otc_cust_index__gfhive/ddl.sql)

合约服务页保留 `Sign_Prd_Name`、内外合约号、协议类别、交易状态、交易所报备标志和新增/终止报备状态。期权参数 159177 用当前有效 `T01_PTY_RELA_H` 把 TITANS 当事人接到 OIS 客户，再取客户上的交易所报备标志；出口 159182 把报备状态和到期/提前终止日期组合成“待新增、待终止、新增已报备、终止已报备”。这些是已有协议与报备信息的消费，不足以复原客户申请、签约审批、开户成功的完整流程。更早的主体与账户模型见[公共对象](../chapters/02-public-objects.md)。[159177 · query · 220–249行](../../../../sql-static-lineage-data/task-projections/tasks/159177/versions/055c039bbff36626020df82b76207b1aa86b97730d750f193e7053377f62facf.evidence-v3.json) [159182 · query · 39–56行](../../../../sql-static-lineage-data/task-projections/tasks/159182/versions/5f2a792a495ab7b3b22543011e022dc24e33de62f4a81b028c65828aedb772d1.evidence-v3.json)

## 同一合约可以同时有主经办人、引入经办人和三组机构分配

`wt_otc_trade_dtl` 从当天销售合约信息接当天 `T98_OTC_COMP_MNG_RELA_INFO`，关联键为 `Agt_Id`。它保留三组引入机构、客户经理和分配比例；客户资质标签另外从 CRM 指定来源的当事人标签接入。期初日期决定业务月份；同一聚合内超过一个标的时，标的代码写 `-`、名称写“多标的”。其粒度还包括合约类型、客户、日期、三组归属等字段，不能只按合约编号就断言唯一。[103457 · query · 74–164行](../../../../sql-static-lineage-data/task-projections/tasks/103457/versions/6976a6fbca1852a06e83fc75f1e9bb67a999f9a1b86b07364b7b20e2bf005d96.evidence-v3.json) [103457 · query · 165–219行](../../../../sql-static-lineage-data/task-projections/tasks/103457/versions/6976a6fbca1852a06e83fc75f1e9bb67a999f9a1b86b07364b7b20e2bf005d96.evidence-v3.json) [dm_otc_n.wt_otc_trade_dtl · DDL](../../../../sql-static-lineage-data/tables/hive/dm_otc_n.wt_otc_trade_dtl__gfhive/ddl.sql)

该明细还带经营估算：预估期权费取 `abs(期权费×10%)` 与按初始名本计算的上限两者较小值；个股和指数/商品的上限系数不同。“折算规模”在 2021-01-01 前后对个股和部分互换类型使用不同的十倍系数。这些是该报表的经营折算，不是交易持仓或现金金额发生了十倍变化。[103457 · query · 86–98行](../../../../sql-static-lineage-data/task-projections/tasks/103457/versions/6976a6fbca1852a06e83fc75f1e9bb67a999f9a1b86b07364b7b20e2bf005d96.evidence-v3.json)

客户经理每日规模 224351 更进一步：当前销售合约接所有计提明细时只有 `Agt_Id` 条件，没有把明细限制为当天；接当天管理关系后，将三组机构分支展开，乘各自 `Allo_Prop_1/2/3`。动态名本只在计提日落在起止定价日内记入，初始名本只在计提日等于期初日记入。最后按机构、经理 ERP 编号、客户简称、计提日等汇总，剔除经理编号为空和两项规模均为零的结果。还存在机构类别分支和历史合约例外名单。[224351 · query · 1–167行](../../../../sql-static-lineage-data/task-projections/tasks/224351/versions/f61623e6b2a18142182993d6e03e347074ced7d39c0efdae5b1a2a56dc4f5e12.evidence-v3.json)

这解释了三个常见差异：同一合约可在多位经理名下出现；当前分区含多个历史计提日；按客户简称聚合并不能证明法律主体唯一。SQL 也没有在这里核验三组分配比例之和是否等于 1。出口 100170 把 `accrued_date` 改名为下游 `busi_date`，而源过滤仍是当前快照 `busi_date`；两端同名日期的含义发生了变化。[100170 · query · 1–13行](../../../../sql-static-lineage-data/task-projections/tasks/100170/versions/2b4ac8dd01c13949a3e4062c91e402f4a877dc0eedeff81cff0459918c1d6a38.evidence-v3.json) [dm_otc_n.otc_cust_daily_dyna_nom_prin · DDL](../../../../sql-static-lineage-data/tables/hive/dm_otc_n.otc_cust_daily_dyna_nom_prin__gfhive/ddl.sql)

## 客户标签是具体计算规则，不能当作完整客户事实

`bi_otc_cust_tag` 的“前十大期权/互换客户”是按当天计提日的动态名本分业务类型 `dense_rank`，排名≤10；有并列时可以超过十个客户。“定增客户”要求当前销售表有个股且限售标志为 1 的合约，再按客户全称关联；“单笔交易小”是首次计提日记录的初始名本平均值小于 100 万；“高换手”在这段 SQL 中只要存在 `grp_id='03'` 就打标，没有另外计算换手阈值。[231146 · query · 16–81行](../../../../sql-static-lineage-data/task-projections/tasks/231146/versions/b3bedadc3891329de1529b68912b65ba7546fb2b2c94908b44e0db800f23de8e.evidence-v3.json)

“有垫资”标签使用追保记录 `Defr_Days≥2`，把交易对手经当前有效主体关系映射到 OIS 公司，按公司和月份数不同履保日期。窗口 `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` 累计最近三条有记录的月份，再判断≥3。未补齐没有记录的月份，因此它不严格等于连续三个自然月；日期起点为上一年 1 月 1 日，也不是滚动 365 天。这个标签是追保递延代理规则，不是银行来款流水核对结论。[231146 · query · 96–142行](../../../../sql-static-lineage-data/task-projections/tasks/231146/versions/b3bedadc3891329de1529b68912b65ba7546fb2b2c94908b44e0db800f23de8e.evidence-v3.json)

画像还把“有垫资”客户生成一段文字，其中“根据托管行资金流水及券商对账单回溯”“规模可控”是固定文本。实际计算读取追保记录、当事人关系和公司资料，周频率为不同履保日期数除以从上一年 1 月 1 日起的天数再乘 7，平均时长为递延天数均值，金额为追保金额之和除以递延天数之和再除 1 万。SQL 没有展示对托管行流水、券商对账单的读取，也没有“可控”的判定阈值，不能把生成文案当成完成了这些核验。[229121 · query · 394–451行](../../../../sql-static-lineage-data/task-projections/tasks/229121/versions/dbd5530118fb0fc7a3ff6bb512f30ed2a5f30ca96149bd89d2d0ad0542d604fd.evidence-v3.json)

## 客户画像里的风险、收益和合作关系应怎样读

画像的“履保比例”和“追保线”分别按组合/合约的名本作权重，经过 `组合→交易对手→有效主体关系→USCC` 汇总。获批额度却按公司名称取 `max(Lmt)`，而不是加总；存续履保规模通过 `Otc_Comp_Agt_Id=Inr_Seri_No` 接销售合约、排除南下期货并筛选 STATIC/DYNAMIC，再按公司名求和。“已用额度”和“存续履保交易规模”在输出中使用同一个名本和。[229121 · query · 206–343行](../../../../sql-static-lineage-data/task-projections/tasks/229121/versions/dbd5530118fb0fc7a3ff6bb512f30ed2a5f30ca96149bd89d2d0ad0542d604fd.evidence-v3.json)

“及时追保完成率”是 `Σ(递延天数≤2的递延天数)/Σ递延天数`，不是及时完成笔数除以总笔数。所谓“客户持仓总胜率”反而对已经终止的合约，把期间 `Curr_Rev` 合计大于零的笔数除以合约数；这依赖我方创收正负，不能直接当客户投资收益胜率。另一项期权客户胜率只取欧式香草/安全气囊、首个计提日，净收为负记为一次支付，且各类型分母是公司两个类型的总笔数。履保分级、压测数据、满意度评分和满意度反馈均直接填空。[229121 · query · 28–53行](../../../../sql-static-lineage-data/task-projections/tasks/229121/versions/dbd5530118fb0fc7a3ff6bb512f30ed2a5f30ca96149bd89d2d0ad0542d604fd.evidence-v3.json) [229121 · query · 90–143行](../../../../sql-static-lineage-data/task-projections/tasks/229121/versions/dbd5530118fb0fc7a3ff6bb512f30ed2a5f30ca96149bd89d2d0ad0542d604fd.evidence-v3.json) [229121 · query · 368–388行](../../../../sql-static-lineage-data/task-projections/tasks/229121/versions/dbd5530118fb0fc7a3ff6bb512f30ed2a5f30ca96149bd89d2d0ad0542d604fd.evidence-v3.json)

`bi_otc_cross_sale` 给基础客户固定展开托管、财富代销、研究服务、商机转介四种合作类别。托管和研究按公司名称接部门奖励；财富代销从证券组合的产品代码接 OIS 产品代码，再用 `Sign_Prd_Name=signature_name` 连接；商机转介按奖励记录中“非股权衍生品业务部”的部门聚合。四类行的出现并不意味着每种合作都已经发生，财富代销的“有/无”与发放金额也来自不同证据。名称关联存在同名和更名边界；这里没有唯一性检验。[232556 · query · 34–146行](../../../../sql-static-lineage-data/task-projections/tasks/232556/versions/a7986e478668bcc9b4cba2d18170a91b1148170130e8bc5d94ce6bd5ac28b137.evidence-v3.json)

相关页面：[销售收入](operations-sales-income.md)、[经营指标](operations-revenue-and-reports.md)、[合约服务](operations-contract-service.md)、[资金与保证金](../chapters/05-funds-and-margin.md)。
