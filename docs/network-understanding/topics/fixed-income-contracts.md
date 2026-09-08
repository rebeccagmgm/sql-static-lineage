# 固收合约：身份、结构、条款和存续变化

一份业务合同在数据里至少有三种身份：模型中的协议编号、TITANS 内部交易编号、客户确认/外部合约编号。账簿通过交易关系接入，证券或合约产品通过协议产品关系接入；资产腿、费用腿和事件再围绕协议编号展开。它们不是可随意替换的一列“合同号”。

## 期权与互换簿记服务

207513 的期权簿记以当天 `T98_SB_OTC_OPT_COMP_INFO` 为入口，筛 `Book_Bel_Dept='GFS_FICC'`、状态不为 218，再内连接期权主表和结构表。它输出内部/外部编号、标的/篮子、期权类型与方向、初始/动态/绝对名本、期权费、敲入敲出、保证金线、报价与观察日；这些是条款及状态的重组，不是本任务重新定价。篮子证券名称和代码由成分汇集，执行价按序号 0/1/2，障碍价按序号 0/1 摊列。[207513 · query · 100-280行](../../../../sql-static-lineage-data/task-projections/tasks/207513/versions/fbc5c11a18d3c8dffdb8fe44a79d0daab67c37b5500cead6cff6ddc1d7a010f0.evidence-v3.json) [207513 · query · 292-402行](../../../../sql-static-lineage-data/task-projections/tasks/207513/versions/fbc5c11a18d3c8dffdb8fe44a79d0daab67c37b5500cead6cff6ddc1d7a010f0.evidence-v3.json) [207513 输出DDL](../../../../sql-static-lineage-data/tables/hive/dm_fii_n.otc_opt_para__gfhive/ddl.sql)

这个查询混合了当天快照与没有日期筛选的参数历史。`CM` 按产品、账簿对 `BUSI_DATE` **升序**取第一行，得到的是已有材料里的最早记录，并非最新日终指标；期初/期末确认价格则按合约、产品、观察日连接。保证金参数、报备事件、障碍和观察区间没有统一的当天过滤。因此观察日、敲出价格等显示字段的时间背景不能统一解释成“今天最新”。[207513 · query · 312-375行](../../../../sql-static-lineage-data/task-projections/tasks/207513/versions/fbc5c11a18d3c8dffdb8fe44a79d0daab67c37b5500cead6cff6ddc1d7a010f0.evidence-v3.json)

207514 的互换簿记筛当天非 218 合约并通过账簿限定 GFS_FICC。它增加组合、配对协议 N08、原币/结算币金额、保证金方向、结构腿和非结构腿、浮动利率标的、借券券源、分红税和最近平仓日。借券券源来自当天 `f_eq_lend_info` 与 `k_eq_equity_source`，先按券源 ID 连接，再按产品 `TRS_INS_ID` 回接互换。这说明“借券”在本页是具体合约及其券源信息，不是全市场证券借贷台账。[207514 · query · 183-226行](../../../../sql-static-lineage-data/task-projections/tasks/207514/versions/e4ad4f347c5a06ca052194a9daaf58cc3373c5d45074eacde5f353bdf9aed166.evidence-v3.json) [207514 · query · 277-318行](../../../../sql-static-lineage-data/task-projections/tasks/207514/versions/e4ad4f347c5a06ca052194a9daaf58cc3373c5d45074eacde5f353bdf9aed166.evidence-v3.json)

其“当前数量”子查询以 `Leg_Glbl_Seq_No` 单独分组，按日期倒序、产品排序取 `rn=1`，之后才把数量及乘数串接。这只保留每条腿的一条持仓记录，不能解释为该腿所有标的的最新数量集合。非结构腿与结构腿分别按合约连接，多腿合约仍可能产生多行。[207514 · query · 207-246行](../../../../sql-static-lineage-data/task-projections/tasks/207514/versions/e4ad4f347c5a06ca052194a9daaf58cc3373c5d45074eacde5f353bdf9aed166.evidence-v3.json) [207514 输出DDL](../../../../sql-static-lineage-data/tables/hive/dm_fii_n.otc_trs_para__gfhive/ddl.sql)

## 对客互换主表：资产端、费用端和保证金各有来源

232822 先用当前有效的交易静态信息、关系、产品关系和分类建立合约身份，再限定当天有效的 GFS_FICC 账簿及名称以“对客”结尾。输出主协议/补充协议时，路径是 TITANS 对手→`T01_SAME_PTY_RELA_ADTNL_INFO`→OOM 客户，读取 `Blt_Appt_Main_Agt_Id`、`Blt_Appt_Supp_Agt_Id`。这是跨系统客户映射，既不是把名字相等当同一客户，也不是每份互换都必然具有主协议号。[232822 · query · 1-103行](../../../../sql-static-lineage-data/task-projections/tasks/232822/versions/891a17c67146eabbd99ccaf7a5c69742432e57b808981c19e0d26d5e35aedd20.evidence-v3.json) [232822 · query · 521-579行](../../../../sql-static-lineage-data/task-projections/tasks/232822/versions/891a17c67146eabbd99ccaf7a5c69742432e57b808981c19e0d26d5e35aedd20.evidence-v3.json) [232822 · query · 658-710行](../../../../sql-static-lineage-data/task-projections/tasks/232822/versions/891a17c67146eabbd99ccaf7a5c69742432e57b808981c19e0d26d5e35aedd20.evidence-v3.json)

资产端选择 `STRUCTURE_LEG_TYPE`，费用端选择其余腿；资产端的标的、数量、开仓价和佣金来自持仓，费用端保留利率、利差、香港用资利差、计息基础及延期方式。合同初始保证金、授信比例和追保线来自 `T03_OTC_COMP_PERF_MARG_REF`。对法律主体为“廣發全球資本有限公司”的合同，担保分类先按 CREDIT 时的初始授信比例，否则按初始保证金线，分无/部分/全额；其他客户按初始保证金线分类。它是参数分类，不是当天保证金足额结论。[232822 · query · 427-517行](../../../../sql-static-lineage-data/task-projections/tasks/232822/versions/891a17c67146eabbd99ccaf7a5c69742432e57b808981c19e0d26d5e35aedd20.evidence-v3.json)

有几处字段不能直接按名称使用：`notional_cny` 固定 NULL；`dynamic_notional_cny` 实际取本币动态名本；估值汇率来源、部分期货/计息字段固定 NULL。资产端历史持仓按“腿”取最新一条，未包含标的键，同样不能保证覆盖多标的；费用端计息/汇率代码的字典连接使用资产腿 `rtl`，而展示字段是费用腿 `rtl2`，两腿代码不同时需要人工核对。报备日期还通过裁切事件 ID 回接交易，不能从字段说明推定连接唯一。[232822 · query · 104-170行](../../../../sql-static-lineage-data/task-projections/tasks/232822/versions/891a17c67146eabbd99ccaf7a5c69742432e57b808981c19e0d26d5e35aedd20.evidence-v3.json) [232822 · query · 397-426行](../../../../sql-static-lineage-data/task-projections/tasks/232822/versions/891a17c67146eabbd99ccaf7a5c69742432e57b808981c19e0d26d5e35aedd20.evidence-v3.json) [232822 · query · 587-634行](../../../../sql-static-lineage-data/task-projections/tasks/232822/versions/891a17c67146eabbd99ccaf7a5c69742432e57b808981c19e0d26d5e35aedd20.evidence-v3.json)

## 资产腿明细：测试对象不能升格成正式报送

234256 的任务名写 `dm_fii_n`，但发布 DDL 与登记输出均是 `dm_fii_test.dtl_otc_swap_ast_leg_info_day`。它按“腿+标的”分别取历史最早与最新记录，期初数量用最早 `Bgng_Vol/Comp_Qty_Mulplr`；名为当前数量的字段实际也用最新记录的 **Bgng_Vol** 除乘数，而不是 `Vol`。开仓全价和净价两列都取 `Bgng_Mtch_Net_Pric`。这些是已核实的字段映射，不能代换成预期含义。[234256 · query · 81-154行](../../../../sql-static-lineage-data/task-projections/tasks/234256/versions/2da6788dbd43a593398d052725e9fdb72f542b98dbaeb14a09222eef663139d4.evidence-v3.json) [234256 · prepare · 1-2行](../../../../sql-static-lineage-data/task-projections/tasks/234256/versions/2da6788dbd43a593398d052725e9fdb72f542b98dbaeb14a09222eef663139d4.evidence-v3.json)

该查询没有最终 GFS_FICC/对客过滤，按 `ROW_NUMBER` 生成 ID 后再 `distinct` 也不能证明业务键去重。下游 234717 明确读取测试 schema，登记写入 `bd_dm_fii_uat`，并把若干数值空串转为 NULL；这是测试链上的消费证据。[234256 · query · 245-366行](../../../../sql-static-lineage-data/task-projections/tasks/234256/versions/2da6788dbd43a593398d052725e9fdb72f542b98dbaeb14a09222eef663139d4.evidence-v3.json) [234717 · query · 1-46行](../../../../sql-static-lineage-data/task-projections/tasks/234717/versions/be8c9646d34b1f958d6b24a1469bbec92ad4684d313b9e41619071934d4c0922.evidence-v3.json)

## 事件维度与标的维度不能重复求和

234575 是事件×标的粒度：用事件 `Src_Id` 接结构化明细的 `Dura_Chg_Src_Id`，再连接证券内码。它保留事件前后名本、变化量、支付日期/方向和状态，并计算标的金额 `abs(coalesce(Occu_Amt,数量×价格))`、本币发生额 `Occu_Amt×Rate`、分红税 `Divd_Tax_Rate×Occu_Amt`。来源事件和明细不按事件日期或失败状态筛选，最终只是限定当天 GFS_FICC 对客账簿，所以当天分区可能携带历史或失败状态事件。[234575 · query · 104-137行](../../../../sql-static-lineage-data/task-projections/tasks/234575/versions/4ba972fb44a0e4e48166a216972314285d45a8491aeb79f7113b60f621a8656e.evidence-v3.json) [234575 · query · 189-314行](../../../../sql-static-lineage-data/task-projections/tasks/234575/versions/4ba972fb44a0e4e48166a216972314285d45a8491aeb79f7113b60f621a8656e.evidence-v3.json)

事件前后名本属于事件级字段，会随多个标的重复出现；不能对标的行直接求和得到总事件名本变化。资产/费用结算日期来自当天源事件补充，延期计算使用 `pretradedate` 与实际延期天数，费用端再减一自然日。列名虽写“下一个交易日”，SQL 并不固定移动一个交易日；自定义日期函数的日历实现不在这里验证。[234575 · query · 217-221行](../../../../sql-static-lineage-data/task-projections/tasks/234575/versions/4ba972fb44a0e4e48166a216972314285d45a8491aeb79f7113b60f621a8656e.evidence-v3.json) [234575 · query · 294-310行](../../../../sql-static-lineage-data/task-projections/tasks/234575/versions/4ba972fb44a0e4e48166a216972314285d45a8491aeb79f7113b60f621a8656e.evidence-v3.json)

事件维度核心任务 234457 在固定发布没有 SQL。本次精确只读平台补查取得了脚本：按事件 ID 汇总标的明细的已实现损益、原币金额、本币金额和分红税，内连接该汇总，所以没有结构化明细的事件不会进入；最终筛 GFS_FICC，未限定账簿“对客”或排除失败状态。主协议、状态和支付日期是附带信息，不能当成实际支付证明。参见[当前补充脚本](../evidence/fixed-income-234457-current.sql.txt)第 106–125、166–275 行及[原始响应](../evidence/fixed-income-234457-response.json)。

**这条补证仍不能闭合原发布出口。** 当前脚本 DDL 是 `dm_fii_n.dtl_otc_swap_dura_evt_dim_day`，而原发布 234628 读取 `dm_fii_test.dtl_otc_swap_dura_evt_dim_day`，且没有带出新脚本的部分结算延期列。本文明确保留新旧来源和 schema 差异，不补建正式图边。[234628 · query · 1-33行](../../../../sql-static-lineage-data/task-projections/tasks/234628/versions/3123168813d1dd26dbb6e6dac218401a2feb4e21592cdc0debe3b97d083b4ce5.evidence-v3.json)

## 到期提醒是时间窗口，不是自动结清

212078 面向 GFS_FICC/GFS_FICC_COM，期权以提前终止日优先于期末日，互换以实际结算日优先于期末日，保留距离当天 1–9 个自然日的合约。它排除 DRAFT，但不是只取 EFFECTIVE；期权篮子与互换持仓标的通过窗口 `collect_list` 汇成串，排序窗口可能留下逐步增长的不同串，`distinct` 不保证每份合同一行。到期提醒也不证明结算完成。[212078 · query · 26-33行](../../../../sql-static-lineage-data/task-projections/tasks/212078/versions/22890190f9f1ae2442952b70a78c4df7d50bc878d9e71315e6568a2b5d1ab20b.evidence-v3.json) [212078 · query · 226-295行](../../../../sql-static-lineage-data/task-projections/tasks/212078/versions/22890190f9f1ae2442952b70a78c4df7d50bc878d9e71315e6568a2b5d1ab20b.evidence-v3.json)

返回[固收入口](../chapters/11-fixed-income.md)，或继续[持仓与盈亏](fixed-income-positions.md)、[资金与保证金](fixed-income-funds-and-delivery.md)。
