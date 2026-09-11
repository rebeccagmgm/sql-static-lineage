# 财务与估值：把合约、资金变化和定价材料变成可消费记录

<a id="finance-purpose"></a>

这一部分解决三个不同问题：合约及账户现在是什么；本次应向财务表达什么事件和金额；估值需要哪些合约条款、行情和曲面材料。三者共享合约、账簿和币种，却不是同一张业务事实表。盈亏报表中的一行可能是历史估值日上的持仓，交割明细中的一行可能是期初、计息或保证金变化，期权结构表中的一行则可能只是一个子交易的障碍条件。把它们统称为“财务流水”，会丢失最重要的区别。依据：[118174][E118174] query 95–218、[198806][E198806] query 242–409、[220685][E220685] query 85–169。

本章覆盖发布快照中全部 45 个 `finalWrites` 命中 `dm_fin_n` 的任务，以及 5 个有明确 SQL 读取本范围结果的分发任务；其中 2 个尚未形成图内数据边。它不是全公司财务制度说明。正文中的“生成、过滤、分发”均指所收录 SQL 的行为；未用运行日志或实际业务端数据证明这些行为已发生。逐任务出处、阅读范围及未决项见 [finance-review.json](../evidence/finance-review.json)。

<a id="finance-base"></a>

## 合约、账户和结算：先知道每个数属于什么对象

基础合约视图把不同来源整理成财务可辨认的合约。互换视图保留合约编号、状态、类型、计价起止日、结算币种和账簿；除报送财务的直接账簿，还通过同产品、同持仓日、不同账簿的持仓关系找到映射账簿，第三支接入金仕达合约，并转换部分类型及状态。期权视图保留交易对手、卖方、名义本金和期权费，要求当日、报送财务，排除内部期权和指定状态/对手，再用证券信息补充标的类型。这里的过滤决定“哪些合约进入财务视野”，不能把业务系统全部合约数直接拿来对账。依据：[173559][E173559] query 13–120；[173563][E173563] query 19–47。

账户有两个层次。资金账户每日变动比较当前和上一期余额：TIT 支用**前一自然日**，金仕达支用**前一交易日**，缺值按零参与差额；TIT 还要求账户、有效持有人关系及当日客户资料匹配，并剔除内测和标为非真实的客户。因此 `Diff_Tot_Bal` 是余额差，不是原始入金减出金流水的现场求和，周一的两支也不是同一种“昨日”。保证金视图则从组合履保结果映射到保证金账户，带出应追保、可提取、保证金余额及动态名义本金；已追加/已提取按指定资金变更类型累计到结果日。另一支接金仕达履保结果及同日合约保证金。SQL 未在最终层把全部结果压成“账户一天唯一一行”，不能仅凭表名假设唯一键。依据：[173282][E173282] query 17–94；[173137][E173137] query 23–142。

结算事项视图保留处理日、清算日、合约、应收应付、保证金、期权费、分红和结算金额；它限定 CSS 结算来源及当日，排除“已有协议编号但协议修饰符为空”的记录。这是结算事项的整理，不是把所有资金事件合成一个金额。其源表 `pdata_n.t03_deri_comp_sett_info` 在所收录元数据中标为 `DELETED`，故这里能解释历史收录 SQL，不能宣称该源目前仍可读取。依据：[134640][E134640] query 24–50；表目录该源对象的 `metadata.sourceObjectStatus`，采集日 2026-08-22。

<a id="finance-events"></a>

## 合约事件如何被翻译成财务语言

`adm_trd_otc_comp_day` 是事件汇集层，区分源业务日和本次快照日。期权部分包含新合约、期中/期末收付、期初期权费调整、期初期权费确认、每日摊销五支。普通新合约用期权费，AIRBAGX/AIRBAGM 用期初定价指标的 PV 取反，AUTOCALL 新合约金额置零；期初指标还按部门选择定价环境，并要求定价日等于期初定价日。收付只接有效且已核验或已结算记录，按清算日与提前终止日/期末定价日的关系区分期中期末。买入、卖出方向来自卖方身份，香港与境内使用不同身份判断。金额统一四舍五入到两位，但这并不证明已经完成会计记账。依据：[171179][E171179] query 15–195。

同一任务的互换部分分别生成直接账簿的期初和结算事件、映射账簿的期初和结算事件，再接入金仕达结算汇总和北上 DMA 的期初/结算。映射支的结算金额还乘账簿关系中的损益方向系数，不能把两账簿金额无条件相加。常规与 DMA 分支均有报送标志、状态、内部交易及非真实客户排除；结算支通过清算日与登记结算日判断期中/期末。关联有的用产品、有的用合约，期权收付甚至以“源产品匹配或合约编号匹配”接入；若关联多行，SQL 并不自动保证事件唯一。依据：[171179][E171179] query 197–530。

<a id="finance-pnl"></a>

## 盈亏快照为什么不能按日期直接累加

`v_fin_trs_plreport` 合并七支：常规互换存续、常规到期、互换对冲、项目型多空互换存续、项目型到期、金仕达存续、金仕达到期。常规存续以计价起日至实际结算日（缺失则用结束计价日）之前的持仓为基础，结构腿、固定腿、浮动腿按产品、账簿、估值日聚合；费用损益由累计已实现收益减三腿已实现收益得到。年收益一般是本次累计收益减上年末同持仓维度累计收益，原币、结算币、本币分别保留，不能把三个金额当作三份收益。依据：[118174][E118174] query 1–32、95–218。

到期支把到期日的持仓结果带到此后的日历日，常规到期跨入下一年时年收益置零。对冲支使用非 TRS 持仓和指定对冲账簿，合约编号可为空；项目型支通过产品关系和主合约识别项目；金仕达支直接组合已实现/未实现收益、利息和其他费用，并区分有效、终止状态。所以“每天都有一行”可能表示到期余额延续，逐日相加会重复累计。项目型所依赖的 `pdata_nds.ref_main_contract` 元数据标为 `DELETED`，继续使用情况未确认。依据：[118174][E118174] query 220–348、350–656、658–823；表目录该源对象状态，采集日 2026-08-22。

这份 SQL 还暴露了需要保留的解释边界：项目型到期支第 3–5 个位置依次是账簿、客户、到期状态，而首支相同位置是状态、账簿、客户。`UNION ALL` 按位置对齐，故不能把该支最终字段名直接解释成可靠业务含义。此外，部分分支原币/结算币字段顺序也不一致，项目型本币总收益取的是 `Accum_Yield_Tot`。这些是实际文本中的疑点，本文没有替它纠正或判定正确财务值。依据：[118174][E118174] query 96–121、455–480、558–583。

后续 `civ_fin_trs_plreport` 从另一份收录的 `pdata_nds.fin_trs_plreport` 取当日快照，输出合约、估值日、估值、三腿未实现收益和动态名义本金；没有证据可仅凭名称把它与上述视图认成已经贯通的一条链。它的表描述写成股票行情，与 SQL 内容冲突，本章按 SQL 解释。期权费用视图则保留最近十个交易日阈值之后的日终指标，接**当日**报送账簿、客户名和指定费用类型汇总；结算币金额通过除汇率得到，汇率为零/空时回退为 1。历史指标重取时受当日维表影响，且币种回退不能视为真实汇率。依据：[199845][E199845] query 30–60；[199736][E199736] query 21–73。

<a id="finance-domestic"></a>

## 境内交割记录：同一数量字段承载不同事件含义

境内互换交割加工将事件组织成四支：期初、保证金变化、期中结算、期末结算。期初交易数量固定为 1，期末为 -1；保证金与期中不表达实际标的成交股数。期中取发生金额，期末按合约、日期、币种、部门/账簿及类型汇总。合约事件和合约资料要求当日匹配，并过滤内部交易；保证金另限制用途、非零变化和特定内部账户排除。内部证券账户依据部门、账簿、跨境方向和产品类型映射，最终内连接启用且满足“开户日 ≤ 计算日 < 销户日”的账户映射，由此取得账套。映射缺失会使事件消失，多重映射则可能放大。依据：[198806][E198806] query 242–409。

境内期权交割有五大分支。普通期初排除 AIRBAGX/AIRBAGM，限定新合约且不含确认/调整；保证金支要求用途为期权或混合、金额非零并匹配账户币种；一般期中/期权费支排除每日摊销、确认、调整、终止等名称；期末按合约和业务分类汇总并以数量 -1 表达终止。多支从当日快照取最近三自然日事件，但输出业务日仍是事件日，不能把“今天查询到”写成“今天发生”。依据：[198929][E198929] query 257–298、384–529。

AIRBAG 支另算差额：当日已更新事件金额减过去五自然日范围内按合约、事件日期及业务类型找到的最近镜像金额，覆盖新合约、每日期权费、期初确认/调整以及特定终止/期末事项。它不严格等于减昨天；过去窗口缺失时旧额按零。普通差额只留非零，期末和指定终止类可保留零；新合约数量还取决于旧金额是否为零。与其他支合并后，同样要通过有效内部账户内连接。反例是补录旧事件：现金经济事实未新增，但历史镜像缺失可能使本次差额等于全额，不能把差额流水直接称为新增成交。依据：[198929][E198929] query 303–379、530–532。

<a id="finance-hongkong"></a>

## 香港交割：场外事件与场内数量须分开理解

香港互换覆盖最近十自然日，合约及工具代码加香港前缀，并按合约类型和账簿区分账户。它有期初、每日利息计提、期中/期末结算、非期权资金账户变化四支；票据及特定账簿被排除并在别处处理。利息先把固定腿与浮动腿未实现收益相加，再以 `lag` 求相邻记录差，按合约方向确定应收/应付符号；取十一天资料是为十天输出提供前值。期中/期末又把利息类型与其他金额拆开，结算金额等于两者之和。部分支将离岸人民币代码归为人民币，资金支保留来源币种，不能概括为全表已统一币种或已换汇。依据：[200199][E200199] query 244–414。

香港期权覆盖最近七自然日，但包含三种来源。TIT 场外支处理期初/期中/费用、期末和期权保证金，期初数量 1、期末 -1；部分金额取绝对值，期中保留来源符号。HKGT 场内支把买卖数量乘合约乘数，参考香港日历的上一交易日持仓判断开仓或平仓，并单独识别行权、指派、到期；价格是来源交易价平均值。这里数量已经有真实成交量及乘数意义，不能沿用场外的“1 份事件”理解。前持仓缺失会影响开平判断。依据：[201133][E201133] query 256–433。

HCR 经纪股票期权又分开仓、到期、平仓：开仓用持仓与成交按工具、日期、报告期及数量匹配，价格做数量加权；到期支取到期关闭记录，金额为零、数量为负；普通平仓匹配买入成交，带出费用和结算额。数量相等是接入条件，不只是展示字段。最终全部分支仍要通过有效账户映射，因此不能把三类来源的行数当作互相独立的同口径交易笔数。依据：[201133][E201133] query 435–626。

<a id="finance-notes-market"></a>

## 票据与股票行情：价格的来源并不相同

票据行情一支来自 XIR 交易、票据明细及估值，限定来源交易类型和状态、非零剩余本金及市场映射，以理论价格除剩余本金；同票据按到期日排序只取首条，再过滤未到期。另一支为香港 AMCNote，经产品—底层资产—互换盈亏关联，以“动态名义本金减结构腿未实现收益”除发行数量，要求发行量非零和指定票据账簿。结果同时填入市场价、均价、收盘价等字段，含义是接口价格投影，不是分别观察到这些市场成交价格。依据：[199871][E199871] query 134–185、191–289。

香港票据交割则有发行和利息计提两支。发行按产品起息日进入近三天窗口，数量取匹配成交量，交易金额取产品总名义本金；非 AMCNote 的利息调整为名义本金减匹配成交金额。计提支只处理 AMCNote/FundingNote，将相邻固定腿和浮动腿未实现收益之差取绝对值，保留未到期且销售日起有效的非零记录。**虽然内部子查询算了 `clear_balance`，最终 `Clr_Amt` 位置填空**，不能说最终交割表已经输出该结算金额。产品基本信息任务只转换销售、起息、到期、结算日格式并保留数量、面值、状态，没有自己限定当日。依据：[202510][E202510] query 130–168、208–282；[202957][E202957] query 36–72。

股票行情另有完整五支：股转/北交所有有效交易方式、有证券但完全没有交易方式、其他市场、交易方式最早生效日之前的补录，以及限售股估值补充。前三类主行情带开高低收、前后复权及估值指标；成交量乘 100 转为股、股本乘 10000，交易方式按有效区间匹配。第四支只补最早有效期之前，不能据此认定中间有效期缺口也已补齐。限售股支从证券备注取参照工具和解禁日，接折价估值并通过日历将非交易日对应到前交易日；输出的“收盘价”是限售股估值，部分市值位置也直接使用该值，不能等同交易所普通股票行情。依据：[211987][E211987] query 38–182、183–328、331–462、464–609、611–680。

期权行情任务保留源表价格、结算价、成交量和持仓量，注释单位分别为元、手、万元，未做股票行情那样的乘数转换；限售股折价任务直接保留剩余期限、预期波动率、股利率、期权价值和流动性折扣，不在本任务重算估值模型。这两者均只限定来源/分组，未在 query 限定当天。依据：[220853][E220853] query 28–57；[228801][E228801] query 30–61。

<a id="finance-option-inputs"></a>

## 期权条款与曲面：先备齐定价材料，再谈估值是否完成

期权材料按三个层次保留，不应为了看起来简单压成一行合约：合约层记录对手、账户、币种、费用和终止状态；结构层记录标的、定价日期、精度、跨币种及收益规则；子交易层记录自身有效期、产品、账簿、本金、数量、障碍和兑付安排。`civ_otc_opt_comp_sub_trd_base_info` 是较宽的子交易摘要，已有多种观察日串和产品特殊条款；它不是其他全部细表的一对一替代物。此家族主要是投影和来源筛选，没有在本章这些任务中执行敲入敲出判断或期权定价模型。依据：[220143][E220143] query 141–283；[220336][E220336] query 119–240；[220348][E220348] query 70–142；[220685][E220685] query 84–169。

| 条款细节               | 行所表达的对象与处理                                                                   | 直接证据                                                     |
| ---------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 合约障碍价格、障碍线   | 协议及序号下的价格、障碍类型或有效区间；只限来源，输出日期写为运行日                   | [220372][E220372] query 16–31；[220461][E220461] query 20–38 |
| 票息、行权价           | 协议及序号下的年化票息或执行价；限定来源和当日                                         | [220477][E220477] query 18–35；[220561][E220561] query 19–37 |
| RESET 协商价格         | 协议、产品及观察日的协商价；来源过滤，输出日期写运行日                                 | [220553][E220553] query 16–30                                |
| 自动赎回               | 子交易的参与率、损失上限、敲入/票息障碍及支付标志；限定来源和当日                      | [220723][E220723] query 43–85                                |
| 观察日属性             | 子交易、属性类型、观察/兑付日及票息/障碍；本任务无日期或来源过滤                       | [220751][E220751] query 28–54                                |
| 子交易障碍线、区间属性 | 前者含有效期与触线日；后者含序号、边界值和累积票息率；均按来源，后者把输出日写为运行日 | [220803][E220803] query 23–45；[220813][E220813] query 19–36 |

这些“运行日写入”不代表条款当天生效。实际生效/观察日期仍在业务字段里；查历史时不能把它们与分区日互换。合约投影 220336 的过滤参数写为 `${yyy-MM-dd}`，与同家族常用四位年模板不同，其运行时解释未验证，故该项保留为已定位而未完成解释的边界。依据：[220336][E220336] query 237–240。

曲面材料也分工明确：定价环境配置给出环境、产品、分红曲线、币种及交易类型；环境曲面选择记录环境—曲面—标的及看涨/看跌权利；曲面定义带插值方法、日历、行权价/期限集合和模型信息；实例才带某曲面日期、期限和执行价上的数据。定义任务额外将部分港股标的代码补齐五位；实例按曲面日期截取当日，其他三项没有统一的当日过滤，环境配置还使用与曲面选择不同的来源分组。因此把不同日的定义与实例拼起来前，需要确认版本和适用关系。依据：[226709][E226709] query 21–43；[226067][E226067] query 20–41；[226123][E226123] query 34–71；[226134][E226134] query 19–40。

<a id="finance-consumers"></a>

## 到了分发表，不等于财务端已经读到

明确的分发 SQL 保留不同回刷窗口：境内互换只取当日 TIT，票据行情只取当日两类来源，香港互换取十天，香港期权取七天，香港票据取三天；清理语句也按相应范围删除。境内期权生成阶段可含近三天事件，但 225436 只读取**当日输出业务日**且来源以 TIT 开头，不能直接宣称近三天全部重新推送。账户映射和期权基本信息分发只取当日；期权费用按十个交易日阈值之后回刷，还把买卖方向移入 `def1`。依据：[198831][E198831] query 120–122；[199872][E199872] query 66–68；[200256][E200256] query 120–121；[201181][E201181] query 1–4；[203056][E203056] query 103–104；[225436][E225436] query 1–4；[199723][E199723] query 1–23；[199734][E199734] query 1–28；[199740][E199740] query 1–31，以及各任务 `truncate` 槽位。

账户映射、期权基本信息及交易记录的本地准备任务分别来自当日财务视图，保留账号用途与余额、合约经济要素、事件日期及发生金额；它们不是再计算一次合约估值。股票行情出口 180425 的 SQL 按行情开始日取当日；期权交易记录出口 216869 按业务日取当日。两者虽未在发布图中形成读写边，已有 SQL 可以说明读取行为，不能据图的采集失败反称“没有消费者”。依据：[199720][E199720] query 23–46；[199729][E199729] query 27–54；[216868][E216868] query 14–28；[180425][E180425] query 1–39；[216869][E216869] query 1。

但本范围存在三种不同证据边界。第一，部分分发任务的声明目标、清理语句与投影 `finalWrites` 的库名不一致：6 项仍投影到 `dm_fin_n`，另 3 项投影为 `gfval` 而清理目标为 `gfedw`，物理写入须继续核对。第二，期权子交易的调度邻居 220154 实际读取的是 `dm_fin_test`，不能冒充已验证的 `dm_fin_n` 出口。第三，多项条款和曲面下游只有调度邻居而无 SQL，未证明估值端读取了哪张表、哪天数据。完整说明应把这些断点留在这里；结果被业务端读取、科目映射符合制度和金额通过财务验收，都仍需各自证据。依据：逐任务 [finance-review.json](../evidence/finance-review.json) 的目标差异与 `boundaryTasks`；[220154][E220154] query 141–143。

<!-- Evidence references: line ranges in prose refer to the named sqlSources slot, not JSON file lines. -->

[E118174]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/118174/versions/c8b4e734d772ac25cb9d5542752868040be3d4e7dae593484dd0399c3c97b73b.evidence-v3.json
[E134640]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134640/versions/2cb849173f1ba19be961fb8cb3daf3e254435038353be0622db2e1b2578088dd.evidence-v3.json
[E171179]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/171179/versions/52b3592241d4376de5cba7958db9429eba1376e61958aae49f5fa43ce76c1402.evidence-v3.json
[E173137]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/173137/versions/713624970a02eb7015cfd19618574740967539ea74282b6a4740ba21808cd2ec.evidence-v3.json
[E173282]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/173282/versions/717e4c82699e93581abe3e2e01eae49b0f71e061eb619a8d247b5d91cee7deb4.evidence-v3.json
[E173559]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/173559/versions/0cdf060be6c4559132f37e540bdbb66fd9f78eaee9d126312d0df2858ef1966e.evidence-v3.json
[E173563]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/173563/versions/85fa5d39bbc13a68c6fd0680f090c6c0968b231b32e865d91a26cc3f84269dce.evidence-v3.json
[E180425]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/180425/versions/959409be87568be25142b74a046f77c9f45a17d2fe4f2426778fb3981ebb14d2.evidence-v3.json
[E198806]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/198806/versions/1de0c6c58f34d0e3fa358ab0506890bdae1309ceaf1100bdc8699257a5faeb68.evidence-v3.json
[E198831]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/198831/versions/05da0f88a6ca4d1d969dc1a407d45f17f711971607919208faa7c069ba4734a8.evidence-v3.json
[E198929]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/198929/versions/609ff30c7b2e143e93105d1ec1f83b3f95aba954b81cd0ab86c8a6715f6d5ef9.evidence-v3.json
[E199720]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/199720/versions/be42479f2011552318799a8edd1ea696ad581628a627388f7815598ab24bf6c8.evidence-v3.json
[E199723]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/199723/versions/211709eaa427c93bdfda7446dc9307af779fe480a15e4c241e5e3229283b19de.evidence-v3.json
[E199729]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/199729/versions/6e54bf781f68a34d6edc54ca06f2230e211c7d8f713c5c68c63b5db1abff9634.evidence-v3.json
[E199734]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/199734/versions/5a49272383e862a201fbd9bb66f22b61d57bc144be40633ce5588ce677ea3581.evidence-v3.json
[E199736]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/199736/versions/5c896f769db142b0c673f4f0b4f8cdbf97c1b24b71af868a3504ca677b037aa4.evidence-v3.json
[E199740]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/199740/versions/18ed7733c1d9281e1ce2c588db2001bfce74bda509ded410dc5db1233c03a87e.evidence-v3.json
[E199845]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/199845/versions/4bb08d4a698b6f0faade1b7cce7c5743831f02cd062849fd327a422f2c2af8ae.evidence-v3.json
[E199871]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/199871/versions/6aef2d2a79f5cfdb960e2676b8f351cbe491fbae90b3b54a698ea2ed7f6a02e7.evidence-v3.json
[E199872]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/199872/versions/c3aae921c63e9b6d62c0824f54470f96c440d2e7bc91452e7c20560495b32635.evidence-v3.json
[E200199]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/200199/versions/ac14aa50c534e8937067f3c4dc24975fd9cbfe9f02515edbb3327fdee97ed22e.evidence-v3.json
[E200256]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/200256/versions/8065f9b57caed32124b089e1205172cb7ef88b957eb103de5e61024fd9b47056.evidence-v3.json
[E201133]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/201133/versions/e7f45e44ae7b37b2c28664938044361cacb32963df6f7cfe4dee23d9a82f26bc.evidence-v3.json
[E201181]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/201181/versions/b546cc902285035da9857a9ae1ddafe653f37bce96c345d7a33ccd0620d79729.evidence-v3.json
[E202510]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/202510/versions/361c0b47f677583bf3460dc9d98b7b351ba1d3a0308a3d6eb50906408c06aa32.evidence-v3.json
[E202957]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/202957/versions/992c0825368cc5030eec5ffdf30d509e941b5afb6bb42e1f80c8be8cb4416fc3.evidence-v3.json
[E203056]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/203056/versions/3230bad10cf9d485f435325bd429a68a6af93b2f11700da824eeaee1a70760b7.evidence-v3.json
[E211987]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/211987/versions/f07e8838fd233094e42ae2952bec4ab18236edc42d38189e3d2bfbedf141a442.evidence-v3.json
[E216868]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/216868/versions/df333aed29406e183d3cab9f77a7c5e2ba6a54345d83a8eb1bc13f424229d382.evidence-v3.json
[E216869]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/216869/versions/ab162b0a49d0a64ae01275ca6e3636f1e50f3a9504478445a5d376e739f713e9.evidence-v3.json
[E220143]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/220143/versions/d6dcbc5f7f61cba2ad797a89e2c49071a556196d43eb8c4e5112302f6b46b111.evidence-v3.json
[E220336]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/220336/versions/17f783d968023db44e69c42771700459d46357bc4753b4977337e5d789577b68.evidence-v3.json
[E220348]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/220348/versions/b35311fa20f0fc16549dcc92d0733cae505e1acee8bd02b30ebf7961a8bb1eac.evidence-v3.json
[E220372]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/220372/versions/e85f0f4d5726e5b4652cf0eeae364a70c9063d3ce0a9925fb9c5cec2f8d07f81.evidence-v3.json
[E220461]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/220461/versions/e08bd15543406d116797e0e0f4fd826a7ee08f9a0c50957c91f1011ec1a8c38e.evidence-v3.json
[E220477]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/220477/versions/6d18f3a10934ebcdfde5789be98f15509ec4b3362e593fad29ca42931801d1cc.evidence-v3.json
[E220553]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/220553/versions/8279b87a85d24d26bc0a8703b84de3336ecf53909b9e679a02c247016535e4fd.evidence-v3.json
[E220561]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/220561/versions/01d178343ece0500690659ed2789036171e058acae9e954f90016f1d37dfb023.evidence-v3.json
[E220685]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/220685/versions/a0eab690ff8fc87dc7008b7e70fd6536e85d74f66c24912c727087c345125aa9.evidence-v3.json
[E220723]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/220723/versions/1205be963e351a48fcb076ece1f1624f57969a090a2b2f3f6a5fb1ea3d55d834.evidence-v3.json
[E220751]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/220751/versions/518762787257f3c46cb2e600fdf54a5b04b2877b9ad0a43b2c6dcee084fab014.evidence-v3.json
[E220803]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/220803/versions/17b2ce3bbf91ac1bbdddeeceb0bf7f1b5e60092578c7b553c8e9d9a7e5f77a7c.evidence-v3.json
[E220813]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/220813/versions/f434f57e763610b83349e81cf3dd18b5e9e46528b59bbc651cbad53a01e4d162.evidence-v3.json
[E220853]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/220853/versions/e56ad74d726e9187f849d72ebb9f301f62b54a9ae4534dbf3eee945f6a456cf8.evidence-v3.json
[E225436]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/225436/versions/780633dcb8da6bd2d0d5d238de28e22aee9528442adc30565d5469588b3fc447.evidence-v3.json
[E226067]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/226067/versions/ac7904c8a4bf64dc28d14ec438f734cd06ae4a5e6930b40803f96c67cb536338.evidence-v3.json
[E226123]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/226123/versions/3208194f8ea6f15cde5cf62144d025249c4c8690a649d8cc732948f292a00d8b.evidence-v3.json
[E226134]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/226134/versions/bea2195ae76ae4ba9681dc789f080fd289369ed0a1aacc950d21e030c9f9c267.evidence-v3.json
[E226709]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/226709/versions/a9e5377c32ce58328ca7b4e07601d1d6f98ea308da183c985a2e57875797ceac.evidence-v3.json
[E228801]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/228801/versions/d37a8c648f7befd3a9af9376338e1abb51628a438d3ec350b6e1cb39eee61063.evidence-v3.json
[E220154]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/220154/versions/9b5d0e96fa96934f00f755e594d290940a8075b5d97758dd65bb235b83cb1b6b.evidence-v3.json
