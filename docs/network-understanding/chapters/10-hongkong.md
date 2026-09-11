# 香港业务：如何把共同源数据整理成香港对象，再分发给下游

<a id="hk-scope"></a>

这里的香港数据层做了三件事：从 TITANS 及公共数据层选择属于香港处理范围的对象，把公共模型字段整理成合约、持仓、资金和事件的消费格式，再按不同日期窗口输出文件或 StarRocks 表。它也带入共享证券、行情和部分未做香港筛选的对象。因此，看到 `dm_hk_n` 不能直接断言“这一行原生来自香港”，看到“每日”“h13”也不能直接断言“这一行发生在当天”。本页逐层说明这些差别。

范围固定在本知识库的 [task-catalog](../evidence/task-catalog.json)：`topicName=DM_HK_N` 共 **486 个任务**，包括 **171 个 sparkIndex、45 个 hive2file、270 个 hive2starrocks**。其中 214 个任务的发布 `finalWrites` 命中 `dm_hk_n`，涉及 171 个不同目标名；214 并不是 214 套业务计算，里面有 43 个文件导出任务沿用了 DM 目标绑定。StarRocks 类又包含 131 个推数日志任务。479 个任务有 SQL、7 个只有调度定位；479 份 query 的完整 hash 均不同，本页没有把相似名字冒充相同 SQL。每个任务的实际来源、目标、核读槽位、日期条件、解释章节和缺口，都在 [香港逐项证据账本](../evidence/hongkong-review.json)。

发布基线为 `df6f0ae4…9e23c3`，manifest 生成时间为 2026-09-07 06:05:52 UTC。下文“实现”均指这一批 SQL 和元数据。账本的 `EXPLAINED` 表示业务对象与 SQL 规则已解释，`TRANSFER_VERIFIED` 表示传输选择、映射与窗口已核对；它们都不表示生产运行、实际数据到达或财务口径已经验收。SQL 行号统一把 CRLF、单独 CR、LF 视为换行，匹配 catalog 的行数。

<a id="hk-membership"></a>

## 香港范围首先由账簿关系决定

交易父表连接四个不同概念：`KEY_OTC_TRADE_ID` 是内部交易/协议标识，`KEY_INSTRUMENT_ID` 是合约证券定义标识，`KEY_BOOK_ID` 是账簿，`INTERNAL_TRADE_ID` 是内部交易编号。它们不是可互换的“合约 ID”。在 [134545][E134545]（query 14–171）中，第一支选当天原账簿 `company='GFS_HK'` 的交易，保留原账簿，`BOOK_SIDE='0'`。其余三支先找当前 TRS，再按账簿映射规则把源账簿换成香港目标账簿，`BOOK_SIDE='1'`：合约编号精确相等、合约编号包含匹配、交易对手短名相等。规则里名为 `IN` 的操作实际写成 `LIKE '%条件%'`，不是拆分列表后逐项相等；交易对手分支仅约束规则列名，没有另加 operator 条件。

四支使用 `UNION`。它能消除所有输出列都相同的行，却不保证一个交易或证券仅剩一行：同一交易匹配多个目标账簿仍可保留多行，直接与映射行也因账簿/`BOOK_SIDE` 不同而并存。h13 版 [245498][E245498]（query 14–171）保持这四支结构，源表改为 `_p`，源分区值为字面量 `h13`，输出业务日另写计算日。`h13` 是 SQL 所选择的批次标识；单凭该值不能证明任务实际在 13 点完成。

另一组常见规则是：业务对象按交易 ID 连接 `T03_AGT_RELA_H`，取 `strt_date<=计算日<end_date` 的交易到账簿关系，再连接计算日的账簿附加信息，要求 `Bel_Co='GFS_HK'`。即使第二步写成 LEFT JOIN，最后 `WHERE Bel_Co='GFS_HK'` 仍会排除账簿未匹配的行。账簿 [134167][E134167]（query 40–80）还连接有效名称和归属主体，将报送财务、风控、报备等开关回译为 Y/N；有开关列不等于本查询已经按所有开关过滤。映射表 [172367][E172367]（query 15–38）保留源或目标任一端为香港的映射，DDL 把 `DIRECTION` 注释为盈亏方向转换。真正是否翻转金额，必须再看消费查询，不能只看有一条映射边。

<a id="hk-parties"></a>

## 客户、资金账户、保证金账户和组合各有自己的归属入口

交易对手 [134549][E134549]（query 29–95）以当日客户和有效客户分类/名称关系组装，纳入部门为 `OTC_HK`、`MARKET` 及少量明确例外的客户，保存删除标志、分类、名称和普通佣金费率。它虽然有客户经理、引入部门、港美费率等列，却在 query 49–55 将这些列填为 NULL。h13 版 [245381][E245381]（query 29–57）直接读取 `_p` 客户表，才把客户经理、引入部门、港美费率及固定收益率等源值投影出来，并按相同部门集合及指定例外筛选。这里的客户范围比“部门严格等于香港”大；删除标志被输出，不代表删除客户都已过滤。这些属性也不是本层重新计算的销售归属或佣金结算结果。

资金账户 [172272][E172272]（query 23–62）通过账户所属部门、有效账户持有人和客户补充信息形成账户主档。保证金账户 [172288][E172288]（query 25–68）要求源协议未删除，经有效持有人关系连接香港客户；保证金账户、资金账户、交易对手三个键不可混用。组合关系分两段：`MARGIN_BUNDLE_CONTRACT_MAPPING` 把组合接到合约并带上终止标志、业务类型，`MARGIN_ACCT_BUNDLE_MAPPING` 把组合接到保证金账户/资金账户。一个组合可以有多个合约，也不能因两张表都出现 bundle 就默认一对一。[172252][E172252] query 17–45；[172257][E172257] query 12–34。

余额与台账不是同一种行。资金每日余额保留余额日期、余额、可用、冻结、挂账和可提取金额，以账户和源业务日从原始余额表补充 `TOTAL_BALANCE`；当前余额选择当前源快照。每日 `BALANCE` 取自 `Begn_Bal`，这里没有单独的期末余额列。保证金台账保留流水 ID、保证金账户、合约证券及收付金额；组合履保监控结果保存已经计算出的监控数值和 `IS_CALC` 标志，本层没有实现追保模型。[172276][E172276] query 14–35；[174022][E174022] query 16–33；[174032][E174032] query 19–44；[172296][E172296] query 17–56。反例是 [207898][E207898] query 10–21：它把 `Begn_Bal` 映成 `BALANCE`，把源日保存在 `BUSI_DATE_RAW`，只筛源表和计算日，没有香港客户/账户过滤，因此不能把它直接读成“香港账户当前可用余额”。

h13 的账户、台账、账户余额和组合映射仍会连接计算日有效的客户/账户关系，不能被视为纯粹独立的 h13 全历史快照。两张原始源 `odata_n_tit.d_margin_account_p`、`odata_n_tit.d_margin_acct_bundle_mapping_p` 的 catalog 元数据状态为 `DELETED`，而发布 SQL 仍引用它们；这些是当前知识材料中的状态冲突，不能据此断言链路仍然可运行。[243831][E243831] query 38–52；[244011][E244011] query 35–49；[244100][E244100] query 19–33；[244109][E244109] query 17–31；[244135][E244135] query 21–35。

组合合约映射的原始日批 [244203][E244203] query 47–51 与 h13 [244169][E244169] query 47–51 都以 `entity_id=key_instrument_id` 连接交易父表，使用的是合约证券键，且未给被连接的交易父表限定日期。它们不能按“名字都是合约ID”改接内部协议键，也不能预设历史保留场景下一对一。

客户账号任务 [219099][E219099]（query 29–44）还存在具体待确认点：源表同时有 `key_ctpty_id` 和行 `id`，SQL 却以 `t1.id=去前缀后的客户id` 连接香港客户集合。可以确认实现如此，不能确认它正确表达“该账号属于该客户”。账本把该项列为 `LOCATED`，避免用字段名推测补齐。

<a id="hk-reference"></a>

## 共享证券和行情给香港对象提供可识别的标的

证券基本信息、证券编码、期货属性、证券日行情、汇率中间价、利率指标、期权基础参数、篮子成分和公司行为构成引用资料。证券内码连接业务对象，证券编码表的一行是一个内码的一种编码，不应和“一证券一行”混同。早期基本信息把数值币种码回译成 CNY/USD/HKD/EUR/JPY，并保留未知原码；证券编码、行情和期货属性常按来源/分组读取，未再按香港账簿筛证券。因此这些共享表覆盖面可以大于香港实际持仓。[134550][E134550] query 24–55；[134551][E134551] query 9–16；[160530][E160530] query 27–59；[160531][E160531] query 32–60；[166014][E166014] query 9–14。

后续原始表版本直接保留证券币种、编码、更新时间，公司行为保留除权、派息/送股、比例和币种，篮子成分保留篮子、成分证券和权重。SQL 传递这些输入，没有在本层计算证券收益、复权或重新定价。利率指标的 query 保存利率和交易日期；prepare/create 提供结构，也不是利率计算公式。[181104][E181104] query 22–42、create 1–2；[195090][E195090] query 38–75；[233694][E233694] query 8–14；[242926][E242926] query 37–72；[243805][E243805] query 28–54；[246035][E246035] query 11–20。部门属性 [223558][E223558] query 14–26 另保存本币、公司及是否启用跨币种履保，只按计算日读取，未限制香港部门；它提供解释“本币”的配置上下文，却没有在此进行币种折算。字段注释若带 `【AI】`，只能作为注释来源线索，仍应以取值表达式为准。

<a id="hk-contracts"></a>

## TRS、极速互换、SBL与期权主合约是不同层次的对象

TRS 主合约持有交易对手、账簿、名义本金、币种、计息基准、到期和状态；腿表以 `KEY_LEG_ID` 连接主合约，保存方向、多空、固定/浮动利率及结构参数。早期 [134536][E134536]（query 83–225）和 [134537][E134537]（query 41–135）从公共模型回译字段和状态，允许直接香港账簿或 N05 映射到香港的账簿；腿方向和多空是不同列，`SHOR` 到 `SHORT` 的文本转换不等于把所有金额乘负号。后续 [221903][E221903] query 95–279、[221904][E221904] query 51–150 改从原始 TRS/腿主档取值，再通过香港交易父表确定集合；h13 的 [237580][E237580] query 281–284、[237592][E237592] query 152–155 又改用 `_p` 及当日交易父表。三种来源路线不能按任务名字认定数值完全等价。

`ref_trs_n` [220427][E220427]（query 97、191–201）在 `info_ref_trs` 上追加“总部交易对手”展示字段：源交易的原账簿属于香港时沿用客户，否则填指定内部主体。原客户键仍保留。h13 的 StarRocks 导出 [237564][E237564] query 74 则把原客户键直接另起别名为新字段；日批 [244410][E244410] query 1–94 输出 `ref_trs_n` 的现成值。这是同一下游表的可见语义差异，不能把两个入口拼起来当完全重复数据。

极速互换单列主合约、腿、事件、持仓和估值，携带业务方案、券源、长短方向、双币种本金和费率。公共模型路线 [197337][E197337] query 403–468、[197339][E197339] query 151–185 会回译代码；原始路线 [223192][E223192] query 284–472 重新补前缀、做状态/计息基准映射，并明确排除 `TRS_TYPE='LONG_SHORT_SWAP'`。h13 原始主档 [245043][E245043] query 112–114 没有同一条 TRS 类型过滤，不能默认继承。证券借贷 SBL 这里只解释合约 SBL 类型、结算类型与腿的质押折扣：早期主档需要两类有效协议分类同时命中，腿要求 `Impa_Disc_Rate IS NOT NULL`；h13 直接取 SBL 主档再接香港交易集合。[134530][E134530] query 19–37；[134533][E134533] query 21–35；[245763][E245763] query 22–24。这些字段不足以推出整个融资融券、券源管理或托管业务制度。

期权主合约同时有交易合同层与证券子交易层。合同层保存合约、对手、保证金/资金账户、期权费、结算币种和生命周期状态；证券子交易层保存子交易序号、名义本金、数量、方向、标的与结构。早期 [134528][E134528] query 81–201 做 Y/N 和状态回译，后续 [221901][E221901] query 104–304 多为原始字段投影；h13 [244982][E244982] query 200–202 读取 `_p` 后接交易父表。`ref_main_contract` [175112][E175112] query 78–99 排除若干草稿/待交易/取消状态，但其原始来源 `pdata_nds.ref_main_contract` 元数据标 `DELETED`。它不是证明所有其他合约表也排除了这些状态的依据。

<a id="hk-options"></a>

## 期权结构与观察日：合同条件被拆开保存，没有在此判断是否敲入敲出

47 个结构任务覆盖两套键体系。合同键侧包括敲入/敲出观察日、票息、参与率、障碍线、执行价格、浮动后端费、Reset 价格、累积器计划和 Lizard 观察日；证券键侧包括通用子交易、Autocall 的票息/风险/赎回障碍、Barrier、Digital、Cumulator、Vanilla、DRA 观察日、历史变动和 Reset 比例。一行可能是“合约＋观察日”“合约＋顺序号”或“子交易证券＋参数/观察日”。只按合约 ID 将所有子表平铺 Join，会把多个观察日、多个参与率、多个子交易相乘，不能直接求和成名义本金。[134143][E134143] query 15–40、prepare；[134146][E134146] query 23–56、prepare；[219390][E219390] query 41–62；[219391][E219391] query 77–163；[228650][E228650] query 135–212、prepare。

参与率表是一个明确的拆行例子：[134477][E134477] query 19–37 把主合约的两个非空参与率用 `UNION ALL` 输出，序号分别为 0 和 1。h13 [245885][E245885] query 20–33 则直接读取已有参与率行，只保留参与率非空。两个来源对序号和行数的保证不同。敲入、敲出表直接搬运观察日、障碍价、收盘价和票息；SQL 没有用收盘价重新判定触发事件。合同执行价格任务虽有“票息表”类注释，实际字段是 strike/strike_pct 等执行价格，正文以 SQL 及列名为准。[245412][E245412] query 15–62；[245661][E245661] query 15–40；[245676][E245676] query 23–56。

证券键侧常以 `key_instrument_id=Src_Prd_Id` 连接计算日公共期权子交易，再通过子交易的账簿选择香港。h13 的原始结构条件和计算日子交易/账簿会合，因此历史结构是否保留仍依赖当前关联集合。通用信息还区分标的币种对结算币种、名义本金币种对结算币种，区分计算用汇率、用户录入汇率及对应货币对；这些列不能统称成一个“汇率”。[228650][E228650] query 181–212；[245627][E245627] query 23–34；[245883][E245883] query 159–190。`info_ref_option_dailyrangeaccrual`、`info_ref_option_dra_obs`、`info_ref_option_lizard_obs_date` 三个 DM 对象的元数据为 `DELETED`，日批导出 SQL 仍存在；h13 中有其他结构版本，不足以自动证明前三张已被成功替代。

<a id="hk-margin"></a>

## 履保参数是计算条件，初始金额是按币种安排的扣款输入

合约静态履保参数包含是否启用履保、初始保证金、预警/追保/提取线及维持线、盯市方式、保证金方向；新版本还带担保品类型、授信比例、强平线等。这里是原字段选择和香港交易过滤，没有根据行情重新算追保额，也没有执行强平。[134519][E134519] query 21–50、prepare；[246160][E246160] query 39–78、prepare。自定义精度 [134527][E134527] query 13–36 是合约/字段的精度配置，不是对全库金额统一四舍五入的证据。

初始金额 [207917][E207917] query 40–78 保存扣除币种、扣款优先级、初始保证金、折算汇率、资金户及保证金方向，经当前交易到账簿关系选择香港。一个合约可有不同币种或不同扣除优先级的多行；直接按合约汇总 `initial_amt` 会混币种，还可能把用于选择的备选安排当成全部实际扣款。组合监控结果、静态参数、初始金额和账户余额应分别阅读。

<a id="hk-trading"></a>

## 成交、事件、收付和清算记录保留不同时间与状态

场内成交行以 `KEY_TRADE_ID` 识别成交，携带证券、账簿、交易数量/价格/金额、交收金额、交易货币、买卖业务方向和状态。早期公共模型 [166009][E166009] query 35–111 回译投资类型、市场、状态和删除/异常标志，原始日批 [219264][E219264] query 36–74、h13 [245941][E245941] query 45–89 主要保留原值再筛香港账簿。输出了 `is_deleted`、`is_abnormal` 不代表已经剔除删除/异常成交；数量符号也不能替代方向字段。

互换和期权存续事件描述增减本金、终止、结算等变化；结构化腿明细再保存事件前后数量、发生数量、价格、收益和成本变化。它们通过交易、事件、腿及持仓 ID 对接，事件总金额与腿明细金额不可在跨层 Join 后一起相加。新版互换事件还保留结算生成标志、支付日、结构/利息结算日及分红币种；收付款保存应收应付、调整前后金额、原币金额、实际支付日、费用类型和清算类型，本层大多不重新计算其金额。[134540][E134540] query 50–122；[134548][E134548] query 29–68；[221897][E221897] query 43–135；[221899][E221899] query 55–178；[221895][E221895] query 56–126。期权结算 [134538][E134538] query 23–56、[245312][E245312] query 24–48 是另一类结算记录，不能用“存在结算表行”取代结算状态的解释。

极速互换成交回报 [202186][E202186] query 29–55 按来源及计算日前 10 日到计算日的 `busi_date` 窗口选择，没有再接香港账簿；出口 [202219][E202219] query 25–27 保留这一窗口。极速事件出口 [215631][E215631] query 52–54 还要求事件日等于计算日。场内清算 [243021][E243021] query 164–173 以香港账簿选取源清算流水，h13 [245529][E245529] query 110–112 接香港账簿主档。两个出口 [243023][E243023] query 53–55、[245598][E245598] query 53–56 又把交易日限制为真实 `current_date()` 之前 6 天以来；这是随执行日移动的窗口，历史重跑即使参数日不变，返回范围也可能改变。

<a id="hk-positions"></a>

## 持仓与风险结果携带的金额和日期不能脱离各自层次

账户每日持仓以持仓 ID、账簿、证券、投资类型、多空和源业务日描述余额，保存数量、成本、市值、交易费、当日与累计收益。TRS 腿当前/历史持仓以腿持仓 ID 和腿 ID 描述虚拟持仓，腿估值又包含方向、原币/结算币/本币市值及收益。不能把账户持仓、腿持仓、合约本金视为三份可相加的资产。早期 [134474][E134474] query 129–266 选计算日原始快照，但把 `substr(SRC_BUSI_DATE,1,10)` 输出为 `BUSI_DATE`；[134476][E134476] query 191–294 与 [172371][E172371] query 54–98 也经腿和交易父表确定范围。表名中的“每日/历史/当前”没有消除源快照日和被描述日期的区别。

h13 版 [237617][E237617] query 406–410 将源日期留作 `src_busi_date`、输出计算日 `busi_date`，但通过**证券 ID**连接当日香港交易父表，没有同时约束持仓自身账簿。某证券在香港贸易集合出现，就可能带入该证券的其他源账簿持仓；集合里同证券有多行还可能放大持仓行数。这与早期按持仓账簿直接筛香港不是同一条规则。历史腿持仓 [237630][E237630] query 350–359 又没有给被连接的 `trd_otc_trade_info` 加业务日条件，是否读到多日分区不能从 SQL 外观排除。账本保留这些粒度风险，不假定上游唯一。

日终指标与 bucket Vega 表保存已有定价结果，包括 PV/NPV、Delta/Gamma/Vega/Theta/Rho、跨币种风险、期初指标、客户估值报告值及解释项。本层主要做当前香港对象筛选，SQL 没有实现定价模型或逐项盈亏归因算法。原币、结算币、本币、人民币、15 点估值、期初/当日/累计值必须按具体列辨别，不能把 `*_org` 在所有表里一概解释成同一币种；部分旧 DDL 注释互相矛盾，账本将原注释与 SQL 保留供追证。[166021][E166021] query 68–149、prepare；[172318][E172318] query 25–56；[219089][E219089] query 214–435、prepare；[245094][E245094] query 67–149。模型和跨域风险处理的共同边界见 [风险与定价](06-risk-and-pricing.md)。

最容易导致漏数的日期组合有两种。[243793][E243793] query 390–406 读取 `busi_date='h13'`，要求 `updated_datetime` 的日期等于“计算日＋1 日”，最后却输出计算日分区；它表达一个批次选择，并没有证明上游数据恰好完整。极速腿估值 [245295][E245295] query 160–174 则直接把 `SRC_BUSI_DATE` 写为目标 `busi_date`，出口 [245310][E245310] query 79–81 要求这个日期等于计算日，并再要求更新时间为计算日＋1 日。晚到的历史估值行可能已进入 DM，但在该次出口被日期条件排除。极速历史持仓日批出口 [234543][E234543] query 44–46 还有源持仓日不早于计算日前 30 日的下限；h13 出口 [245236][E245236] query 43–45 使用次日更新时间条件，窗口并不等价。

<a id="hk-fx"></a>

## 外汇远期按主合约和结构组合，不把两种货币数量混成一个名义本金

外汇远期主档保存合约、买卖双方、交割方式、结算和生命周期信息，结构表保存币种 1/币种 2、两侧数量、交割/结算/期末汇率及起止日。整合对象 [166644][E166644] query 45–136 按合约连结构、有效交易到账簿关系、香港账簿和客户，回译合约状态；h13 [245918][E245918] query 49–144 换用 `_p` 原始主档/结构，再接计算日的公共关系。原始输出另有主档/结构两表版本 [228089][E228089] query 47–87、[228094][E228094] query 50–93 及对应 h13 任务。SQL 保存两种货币数量与结算币种，没有把它们统一换成人民币，因此不能把数量 1、数量 2、名义本金和终止结算金额直接合计。

<a id="hk-finance"></a>

## 财务视图与费用计划：用账簿和方向组织已有金额

香港财务互换主档 [176930][E176930] query 15–100 有两支。直接支取当前互换及香港账簿；映射支通过同证券、同持仓日期而不同账簿的两份持仓，要求源侧能找到互换、目标侧找不到独立互换、目标有持仓且存在有效 N05 映射，再使用香港目标账簿名称和部门。它输出报送财务开关，未要求开关必须为 1。两支是 `UNION ALL`，不是按合约强制去重。

财务交易流水 [176941][E176941] query 15–226 分为“直接期初、直接收付、映射期初、映射收付”四支。两种期初行金额均为 0，业务日来自合约实际生效日，是合约开立标记，不代表本金收款。收付行只取未删除且 VERIFIED/SETTLED 的记录，以收付更新时间作为 `src_busi_date`；清算日等于实际结算日则标为期末，否则期中。直接金额是调整后我司应付加应收；映射金额再乘映射盈亏方向。应收应付原字段的符号约定必须追原始口径，不能擅自改成相减。

四支筛选不完全相同：直接分支排除指定状态、特定账簿/客户、内部业务和标记为非真实的客户，并要求香港账簿报送财务；映射分支有状态、持仓/N05 关系及香港目标账簿报送财务约束，却没有照搬前述客户/内部业务排除。映射持仓源未明确限定一个计算日，只要求两侧持仓日相等。把四支概括成“已全局排除测试客户、只取当天流水”会造成错误理解。下游 [244853][E244853] query 1–13 将 grp 02 输出为财务 TRS 交易记录；财务主档出口 [246308][E246308] query 1–26 还把状态码反向映射，映射缺失时保留原状态。

财务估值 [176951][E176951] query 17–39 读取已有互换估值和当日香港账簿，源估值日另存 `valu_date`、目标业务日写计算日；源估值表本身没有日期过滤。因此出口 [198246][E198246] query 17–18 仅筛目标业务日，不足以证明只含同日估值。互换主档、交易流水和估值行各自承担不同用途，不能把它们当一张可直接相加的财务明细。更多财务事件映射和估值分发规则见 [财务与估值](07-finance-and-valuation.md)，其中实施事实与财务制度的边界同样适用。

费用定义 [242611][E242611] query 59–108 先在交易键为空/零时回退到 `entity_id`，再按有效交易关系选香港；定义里 `amount_type` 区分固定金额或费率，频率、折现、期末确认等是参数，不是已支付费用。h13 [245219][E245219] query 59–107 采用同类处理。支付计划 [208264][E208264] query 24–49 保留计划金额、实际支付金额及本币/原币/人民币列，以 `Data_Etl_Date` 选本批装载，没有香港账簿过滤；“本批装入”不等于“当天实际支付”。返息参数 [230182][E230182] query 17–70 传递支付方向、计息方式/基数、固定或浮动利率、利差和支付日延期，没有执行利息计算。把定义、计划和实际支付列混汇总，会同时重复和混用单位。

<a id="hk-products"></a>

## 产品、票据与运营资料补足上下文，不能据此生成不存在的报表口径

产品主档保存产品、账簿、结算币种、期限/状态等，底层资产是一产品到多证券的关系，经产品账簿选择香港。[183294][E183294] query 33–76；[183259][E183259] query 11–26。票据基础与票据交易记录则直接按计算日取原始 `P_PRD_NOTES`、`P_PRD_NOTES_TRADE_RECORD`，SQL 没有香港筛选；交易记录保存买卖、数量、金额、币种、账簿和客户，不是本层重算的票据估值。[236429][E236429] query 18–34；[236438][E236438] query 25–48；对应出口 [236470][E236470] query 1–16、[236469][E236469] query 1–23。

<a id="hk-operations"></a>

运营对象包括合约报备、补充属性、限额审核、交易组合和合同附件。报备保存报价编号、报备状态、截止日、实际结算日及附件状态；合同文件保存文件类型/关联信息；限额审核保存已有审核状态。这些 SQL 复制状态，不在这里完成审核或向外报备。[134140][E134140] query 17–59；[207902][E207902] query 12–48；[207904][E207904] query 8–36；[208265][E208265] query 28–94；[243807][E243807] query 24–69；[245027][E245027] query 22–46。组合补充 [207905][E207905] query 15–30 只限制来源，未限制数据日或香港归属。

因此可以用这些对象解释“客户是谁、合同是什么、报备/审核状态是什么、源日终结果有哪些”，但本范围没有实现一套独立的香港销售月累计/日报指标聚合，也没有完整的托管账实核对流程。客户经理、引入部门、客户报告 PV 或清算行是其他消费者的输入线索，不能仅凭字段存在补写销售分摊、日报汇总或托管制度。需要追消费者时，先查逐项账本的真实读写；在本图内，除香港主题本身，明确读取 `dm_hk_n` 的只有下面列出的 3 个测试主题出口，不能把调度邻接当成已知跨域数据消费。

<a id="hk-delivery"></a>

## 文件、StarRocks和推数日志是三种不同的交付事实

44 个有 SQL 的文件任务以字段投影为主，把 NULL 或空串编码为文件空值标记，通常还新增执行时刻 `data_time`。43 项有发布目标绑定，1 项未绑定。多数没有额外业务日过滤；一部分要求计算日，极速主档/腿还要求指定 `src_tbl` 并做前缀移除与字段改名。声明目标不能代替真实 FROM：如 [197437][E197437] query 52–54 实读 `info_otc_swap_comp_info_n_cross_dma_swap`，catalog 的目标却是旧 `wt_...` 名；[198441][E198441] query 9–10 实读 `ref_instrument_code_info`，目标沿用旧名。文件格式和空值编码已能从 SQL 核对，实际文件落点、下游解析是否成功不在证据中。

StarRocks 中有 133 个带业务选择 SQL 的任务，132 个有真实输出绑定，涉及 90 个不同 `ods_titans` 目标名；这不是 90 个已运行成功的接口。日批与 h13 可写同一目标，源字段集合和窗口各有差异。可核实的窗口包括：不额外筛日期、计算日分区、计算日且事件日、前 10 日批次范围、源持仓日近 30 日、计算日分区且次日创建/更新时间，以及前述相对 `current_date()` 的清算窗口。账本逐项保存实际谓词，没有把“Delta”备注当作增量事实。[237596][E237596] query 41–43；[237626][E237626] query 126–128；[245945][E245945] query 33–35。尤其 245945 同时要求成交日和更新时间为计算日＋1 日；这与“当前分区全部成交”显著不同。

131 个推数日志任务都写 `ods_gf1.hq_data_push_log`。共同实现是对 **DM 输入**做 `count(1)`，可选取 `max(data_time)` 当作开始时间，然后把 `push_status` 写成字面量 `'success'`，报告日/结束时间取真实执行时刻，业务日取参数。SQL 没有查询下游接收行数、校验数据内容或读取传输返回码。即使源计数为零也会形成聚合日志行；日志成功常量更不能证明真实推送完成。[226465][E226465] query 1–16；[226495][E226495] query 1–16；[226737][E226737] query 1–16。具体缺陷还包括 [245768][E245768] query 6 把 `'data_time'` 当字符串而非字段，以及 [245596][E245596] query 51 的时间格式为 `HH:mm:dd`，末段是日期的日而非秒；这两项已留在账本，不能作为准确链路耗时使用。

测试边界必须沿真实读写看。主题内 [247365][E247365] 的任务名含 test，实际读取日批证券编码并写 `ods_titans.ref_instrument_code_new`，用途/启用状态未证实。主题外 `DM_HK_TEST` 的 [244420][E244420]、[244438][E244438]、[244446][E244446] 读取正式命名的 `dm_hk_n` 票息、障碍、客户表，并指向与其他出口同名的 `ods_titans` 目标；catalog 的物理数据集身份仍需保留，不能仅凭同名判定同一实例，也不能因为主题叫 TEST 就断言数据完全隔离。这三项在账本作为边界消费者，不增加 486 的主题分母。

<a id="hk-gaps"></a>

## 能确认到哪里，以及哪些问题已有明确落点

本页把 171 个业务对象任务归入 12 个家族，并把所有文件选择、StarRocks 选择和日志单列。它解释了读者面对一行数据时需要知道的对象、键、范围、日期、金额维度和下游窗口；具体任务不必只属于一个业务过程，主家族用于阅读，实际读写关系和交叉引用仍保留在账本。

还有几类材料边界必须保持：7 个无 SQL 项只有调度定位；198445 虽有文件选择但没有发布输出绑定；243796 有完整 h13 日终指标选择，发布仍无 finalWrites，因此不能宣称该选择已接续到具体下游表。219099 的客户账号 Join 含义待证。前述已删除源/目标、持仓按证券接续的多重匹配、快照与源业务日混用、日志成功常量和多入口窗口差异，均有精确任务落点。其余业务规则已经在对应章节说明，但源主键唯一性、实际生产可用性、港方最终看见的数据、金融模型正确性和组织制度仍需它们各自的证据，不能由静态图状态代替。

<!-- 链接指向固定发布 evidence；文中行号是指定SQL槽位内的行号。 -->

[E134545]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134545/versions/5a6826729dca1aeac7f07f2cb773714bd4481be569017d7750a919ac0e3d62e6.evidence-v3.json
[E245498]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245498/versions/0aa542cb0acdfd5c514bbab97795abcb90659e903d3b55d54d505711aa9f1b09.evidence-v3.json
[E134167]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134167/versions/5fc9928e779e3ed2c0e137674ebcb80736de8e4fef73f4ce326e2ec1f014571f.evidence-v3.json
[E172367]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/172367/versions/b13627dc1043d389389e6e6a483748f49fac30178d4e2ec73c4289feaa7727c6.evidence-v3.json
[E134549]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134549/versions/d9c3c250b2a348a6156ba9aeb51479f4b76088b043a3f9099558b8287967bf18.evidence-v3.json
[E245381]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245381/versions/92a92e4e534b22bcef6cc7367525a278b0557d5c9a79d078d7ad86926d6a393e.evidence-v3.json
[E172272]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/172272/versions/53c675c4ba0bcb83ff6e48e3b0e8c3c8d1d5ffef38a0de238062c6704333de35.evidence-v3.json
[E172288]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/172288/versions/74e06f28f81866e1eb40efb87b94831d311d81152b7369838b61f76809e9c499.evidence-v3.json
[E172252]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/172252/versions/d90e4dabbe2879009cab5a9fc8111f01036143d2ef78fdb87f7a8611a1d1b672.evidence-v3.json
[E172257]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/172257/versions/034a1ecd092afc2cebcf581a4370c77a38d7896c3f3ab5ede376429a2c12b328.evidence-v3.json
[E172276]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/172276/versions/098b94a81bb05bb0942576e8537480c0c16e733eb51ed5e5a88c31624f5e5b19.evidence-v3.json
[E174022]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/174022/versions/d2aab8fc6d394fc6d719f744dfbde282f096f08c01fc58d627b911ca6b917c0d.evidence-v3.json
[E174032]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/174032/versions/934570424a30ac833401efeeb7e821633af73f93f18f81cfe208ef8274a02fe1.evidence-v3.json
[E172296]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/172296/versions/9c196ae19f722df9e546df1d54c693f092b08bd5f3c7746ab29aa9e554feba18.evidence-v3.json
[E207898]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/207898/versions/9eea6758ee0a9b38fc99d372ddf522067cf72f18c0843cc647d8f9d599de3867.evidence-v3.json
[E243831]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/243831/versions/b0b719f03243f10361e92277c7c574dc65093a47bd2add9a6d9898dae9b4a164.evidence-v3.json
[E244011]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/244011/versions/f92bdabddcdf8e72c36afcb10fbc878d16c6d801198075d1d20fef86492a6bee.evidence-v3.json
[E244100]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/244100/versions/ce498dadb4b43da472d5fe3e9ed14ba09bf5714c4f45a54b39df803ddd583f65.evidence-v3.json
[E244109]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/244109/versions/aaf311499bfca6ab7b6bb5b2d37a5bd6f16ea31db89c97bd1ac6c83127cf83d7.evidence-v3.json
[E244135]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/244135/versions/b2914b0081180e9e10cc9f62314b6943de0cbfc054b4e36302aafcea023837e9.evidence-v3.json
[E219099]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/219099/versions/edf1a4e8c000ba0daf4d244e7dca89cc7b59389b58f1a975554f55bceb8610d3.evidence-v3.json
[E134550]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134550/versions/d61300995f5812cffb917bee4b0cd963835a4d64a719569ac0b080888a460f73.evidence-v3.json
[E134551]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134551/versions/0b4572819c76ca1d2f0d85b5ac027323d64ed6bfca5736c74c6ed626648bea20.evidence-v3.json
[E160530]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/160530/versions/ae0c849ff3a3ae45159ba745c78c3aefd4cc50d8b3de9f2ebe5020a08d5dfc50.evidence-v3.json
[E160531]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/160531/versions/911f3bb6d9b28a766e535b7f79079683b19b37a396686b88344e776d4043a919.evidence-v3.json
[E166014]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/166014/versions/ebfecad9c66d30004ab996c103427fba360016227b02f6df01c9936191288378.evidence-v3.json
[E181104]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/181104/versions/e818cae6a66c2b8c8ab4b60279126f020f600db6617ef8200f76725399ea2387.evidence-v3.json
[E195090]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/195090/versions/9933c639016c70c18da29c118fbcc085e007135845a9dfe433f68b15e9a1f9b5.evidence-v3.json
[E233694]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/233694/versions/ead92614c72963300d1513cd0061fe23f44037633d59eac08d36513974918709.evidence-v3.json
[E242926]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/242926/versions/7735b86fc62d5063e98fd3bd7e9a9b26bc1f9db361f0e034daac9184aa4a0d11.evidence-v3.json
[E243805]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/243805/versions/4fafbe4f1867d4b3d39fe255211206f9bc736ef7fdcedc6bdda4fb36a3fedaaa.evidence-v3.json
[E246035]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/246035/versions/a98cc6ef1fb933065f7bc72e9387c440fcec393a18496b2d06344eb72c146a09.evidence-v3.json
[E134536]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134536/versions/6847f00e5f8dae42b74b573a8f53c9b764268979984a2855b4acc0931dc45ded.evidence-v3.json
[E134537]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134537/versions/9bc478803ad5ea5d87287be161a2ef217773e83122907a7d672f39286ae25d72.evidence-v3.json
[E221903]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/221903/versions/d82472e317e64025c8ae7ecbd0842c0e4b4199ab6f4c38d54d56ddf6bbc15825.evidence-v3.json
[E221904]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/221904/versions/c3be7b1c1c436dd5db5a395abc83eb3fdef0e871cb91eb43190c39621b66a364.evidence-v3.json
[E237580]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237580/versions/2f93cd94688fd0704259f61414634c03a5a2bb1d34176b51b9d13569f02983f8.evidence-v3.json
[E237592]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237592/versions/fb13ff8304f4b4d6e5b26c048f8e2c5e32eb347e96357567cbe424688499aa1c.evidence-v3.json
[E220427]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/220427/versions/9cb259c258d7efa98c55b712f1c03c184b3f4831b10c16ed6a2511e320af3ec0.evidence-v3.json
[E237564]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237564/versions/63a728e7f57265266a8ac8be58819d0db1302814291857393931910e44a1ce29.evidence-v3.json
[E244410]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/244410/versions/3d6f3cedd6ac2bf29e06b4d3a2839baf171f4005e6c8e8ee13fe1d5eab609c78.evidence-v3.json
[E197337]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/197337/versions/347cc5aeeb4e113ad2ff9836f18516bc89522096de686624161f1e210abcfdbc.evidence-v3.json
[E197339]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/197339/versions/848e5e72bd031d136d423286f4536a10762f377be6160f1bb965170b0a99c7d6.evidence-v3.json
[E223192]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/223192/versions/d11b85f9f740f724820c02902d00de19713f9958ffd353a44e8a0fd85c64bc51.evidence-v3.json
[E245043]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245043/versions/1525d4d069c4a3df2883ba35ee7ed18afa265b6e05af2e133051a4b151c9147a.evidence-v3.json
[E134530]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134530/versions/7f7fc99292efadd5053d64bd6e8f559f02983f38c32a696bca4c7607bd631385.evidence-v3.json
[E134533]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134533/versions/4f0c0e9eaac11cc44ef5efde30a5fe48dab7385215ee245040158c860fd009b3.evidence-v3.json
[E245763]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245763/versions/ac3f7f5b7dffc463304118c38a1f85f40d0fae53d8cc391b46eda8116cd5050c.evidence-v3.json
[E134528]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134528/versions/6cdee4b4a5ab1d0c4c00f0b72a248879597285ed88789907bee665f57dd90a83.evidence-v3.json
[E221901]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/221901/versions/8a9497ac1a2579a6fc8bcd8601d878ff466a0b635186f8e0a5f1df01dfb476ce.evidence-v3.json
[E244982]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/244982/versions/68dc576dfaa323b232d2af79eea5a630d0d2a80b0f957c975e290ca66eb97d02.evidence-v3.json
[E175112]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/175112/versions/ec7e283d69d97e478d1a5e8014ee32f9ede07b6f46bc115a98ca50da20e53bd7.evidence-v3.json
[E134143]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134143/versions/e1e4b9282e0225f92fef8c7f1f1da1ea63f79294cbbcb71917ba3c582a5f35f1.evidence-v3.json
[E134146]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134146/versions/7d76b2f3d7272603941075e34570381f12873ac51fd5268c14f40cda64aa778f.evidence-v3.json
[E219390]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/219390/versions/893c3f6bc00f103dd6e45ed1cf71f99ded04c13892d7aee81a4966394436ea7d.evidence-v3.json
[E219391]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/219391/versions/a63f3c6ea1871224c9c515b307ca7e8b8eacba03153d762ad9fb921f5de68129.evidence-v3.json
[E228650]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/228650/versions/66bb82de0fe9e0001a7526830c496ebd5a30ce883dc837c086bab4351beb58e4.evidence-v3.json
[E134477]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134477/versions/a313e997b11612376150debfb3956bbb3bcce8cf3f4cb2ca2fb7f53c06b8a6e4.evidence-v3.json
[E245885]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245885/versions/089eb8e03eb562ada2d88e0941c46920db1c7680a182ae76917ccd1ad9a25d50.evidence-v3.json
[E245412]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245412/versions/932e8052d9c67d2afc234dcad9921d5ff14544b6033a920054243f95161ea60b.evidence-v3.json
[E245661]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245661/versions/65c4ec5ed2205c97dcc8f8b77bc19acd07d4b9eef02f59f4d9fc5d986d4848b8.evidence-v3.json
[E245676]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245676/versions/b3533545806e48839f9d87e89059f817683e041e1a886e13e36b79b594b3ca67.evidence-v3.json
[E245627]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245627/versions/00fd5fb99ff640ac5868a5c6f0627abebc3817129e890b8562fb140c60301540.evidence-v3.json
[E245883]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245883/versions/4044d0c52e8eb8cc2fd57401d1014bf1c01f78018f6df3b584ea0742440e0d81.evidence-v3.json
[E134519]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134519/versions/fa9ddf844c6c8ac23ba0d10124c2dcebdf05e6d9515dbd237cfd8ddf90ef7fb9.evidence-v3.json
[E246160]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/246160/versions/25ff7533e12c8299b4c7bb99e986a7d4564275278acccac4a6da6af135f8ad26.evidence-v3.json
[E134527]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134527/versions/4ca28153472e6862de7e8f4456b9c390244b5f3a4660b908c6244c5c6a67f55c.evidence-v3.json
[E207917]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/207917/versions/3fac8ef3016e0eddc373d55da2773f9371ac460008fa9a09d258fb0301b8b362.evidence-v3.json
[E166009]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/166009/versions/ffa3a13363f533ddd9ff41cd012825755bca533a8b4705b54a025f13699ba11a.evidence-v3.json
[E219264]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/219264/versions/e9163d6fbf58aa111192093d022d2112639e9747af8ede78d5cb149f5a3d657e.evidence-v3.json
[E245941]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245941/versions/9a1ce32740b161e516e16e2444c01df9738c82898804bf744eaf04cf7029191f.evidence-v3.json
[E134540]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134540/versions/1c9482264eb1f4c642281b881e42ab882fbe21dff4c7c620c54911376e0ac75f.evidence-v3.json
[E134548]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134548/versions/e1f266e3f73322cd50f94d3bf23fc9b05652e168e2afa0907b2cbc75032d775b.evidence-v3.json
[E221897]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/221897/versions/d28753444b48c64767003d291fe62527e938417d700fdf19c993c4579fc2976c.evidence-v3.json
[E221899]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/221899/versions/ec7b0c6e8eca3200be0278542f82c4acb7d5770d1d5457d76c5d9a57d8b56cdf.evidence-v3.json
[E221895]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/221895/versions/433870804c233bb5ed5817094965bda6419d6a53d2ebf28ab5aa67e8f60695d4.evidence-v3.json
[E134538]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134538/versions/f151ffdcd25ca79ccc50e322fe816ae18d2cb48957d0087b5281551d747932fa.evidence-v3.json
[E245312]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245312/versions/ef29d270f0eed4f0818bff59cb78c2ba0c2cd813247efb27999850dc339b534a.evidence-v3.json
[E202186]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/202186/versions/c9d0b894cf322002e2f3fde2caad3f05958df17cce7df4c3eb14eb443ec7abee.evidence-v3.json
[E202219]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/202219/versions/a4bac0b73558bb4838d7db54f8250432712fd0c9698f401920a7be0f41b57c35.evidence-v3.json
[E215631]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/215631/versions/d9f06da41208936f23fbff7c2e59c6d76194969a365eca3a7b1b07d5b66ba05a.evidence-v3.json
[E243021]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/243021/versions/1d1b8c7135fcab1746e61ac82c578aa26eeceebe58e7dc9a081c722a7c4e0e9d.evidence-v3.json
[E245529]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245529/versions/eaca1bc79b7293ace42f155561d7d04fa27ba6a6d873e0bb6964e2e7b5f84c44.evidence-v3.json
[E243023]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/243023/versions/23259e3ba9a8402fe523c579bdff4677a7c15c26a9aa6ee9f3a64eee5780b07d.evidence-v3.json
[E245598]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245598/versions/791d671ed3d330a258d0137e9f51566071038869ed2bc50aff07d335eec97563.evidence-v3.json
[E134474]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134474/versions/f800ed0d0239e60f0159bee5ec3f2c95056e25d60e993f90e53da6f7e280125d.evidence-v3.json
[E134476]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134476/versions/e7b7501516038934338069eeb066d1e2d5ab514b415efba8b7014dbdb37c62de.evidence-v3.json
[E172371]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/172371/versions/1f662ebfc8c0429dd19f5965150178aea9f820621dc361625a30378cadfcecf9.evidence-v3.json
[E237617]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237617/versions/04aef96570dc1bf4428d4a91bb739ecbfcd3610fb2e932160416874986a8346e.evidence-v3.json
[E237630]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237630/versions/3cd46c9d0183d1118c4f479a534c4279bc5aaf4cedfb61e7336d1442017184bc.evidence-v3.json
[E166021]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/166021/versions/63217b6b10f80d5273382e7efd5cf478afb37504629054cb9413b550711f4aa3.evidence-v3.json
[E172318]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/172318/versions/b09514c03e0a305df404d9f7be71b2f92b536ba7944c76c2076138dccf38d9af.evidence-v3.json
[E219089]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/219089/versions/c7692ecbd1f694e3491be028e29c65293ecd844f8594d6329294ed5d99e7a2a1.evidence-v3.json
[E245094]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245094/versions/15ee5e5ea3207c8443a808cf9afdb8aa263c6a9c8d1b19b6068fb5d2b8a3ea5d.evidence-v3.json
[E243793]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/243793/versions/35cb5d67cb8de16696f294329d4b9a5a38f59847b65fd7d2f1a4f63d72d2d5a2.evidence-v3.json
[E245295]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245295/versions/2ad2d9ed1fb67a005e4590926690b515241e7ae9a0dba3c4ae5e45475a4244d5.evidence-v3.json
[E245310]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245310/versions/81571169b42421fa68f6647fecd7271a73a3fe0aef9049c1f5a8dccb5e5afab4.evidence-v3.json
[E234543]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/234543/versions/2f4d5c8066581b10473d3b8c551ac385fdbf5a2325183766d10aaa3b54f59991.evidence-v3.json
[E245236]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245236/versions/fe9babc37d7b72eaf919164d44b0cd76b3cebadb47d02f4dc82752fdf0f2165b.evidence-v3.json
[E166644]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/166644/versions/cb76694020061c33d198f83ddfcd7c115b68687480cf3c92ab525577369d268a.evidence-v3.json
[E245918]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245918/versions/bcf391feaa98c889cbd8085e5e000cf002af16eb604e970edeafc543aac8a29b.evidence-v3.json
[E228089]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/228089/versions/b3233fd0b87f61227665867b16465eb69df7bededa499ebd11c4ef05f5c88b70.evidence-v3.json
[E228094]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/228094/versions/6f7f633265c8bdd7758ef7d956ac5c7fa7df01c345bc69e6f1b44adfe2d5432a.evidence-v3.json
[E176930]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/176930/versions/a5b6c6221c9fd149c4b0f4523445459bf3308d244d6cba3adf54c115fcb41e46.evidence-v3.json
[E176941]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/176941/versions/bfe00266d5834298834a045b7aef672498590f0ff09c9de82ebd349157f513fe.evidence-v3.json
[E244853]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/244853/versions/bd019a5b926229cc6908157fbb04c8eaf1c6acbacab0eadeeb207ead620cf88d.evidence-v3.json
[E246308]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/246308/versions/f4cd8e811b4388b6b99f4d398aebc27f7a5f508fb79b41a0c77ab0acf08d1b3e.evidence-v3.json
[E176951]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/176951/versions/e65a401421276c2e1a90bcd45fa2acaa3561cb13b67b12294aa1702f0be78d8d.evidence-v3.json
[E198246]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/198246/versions/d298020aadde285d064db67588a5cf5a59e7816735d63c93ac1cf49e12ccea97.evidence-v3.json
[E242611]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/242611/versions/8b40c5da4ab43d7e17968509e5c2f86cac5397b9fa92d2df7d5b374ce4c3d350.evidence-v3.json
[E245219]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245219/versions/0c9b09fa5879ba34c21f1b7890a4fce4b2870e48a33740021c171497ac9fbdf8.evidence-v3.json
[E208264]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/208264/versions/cf2ed4ebe43a7b7f7de25e068d95c5e516f669c0cbf11e60b0cf0c7d23b55fd8.evidence-v3.json
[E230182]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/230182/versions/bd351434c0e92e4c31a969fe7dc08f796e93cad4f6813c758669f8143a52d317.evidence-v3.json
[E183294]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/183294/versions/82e39ef2bcfb155ee7615f3aa7f635ea9f9c04723cb8d75441910c0f4c0d6fa7.evidence-v3.json
[E183259]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/183259/versions/9930a6f2b1701b880d25fd0079832a7cd6505733d8873bfcc323d65ff6c55da3.evidence-v3.json
[E236429]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/236429/versions/4bba5828bea3d25ceaaf7bfd45fc33b356e4311fe42492b505420b5d15b675e2.evidence-v3.json
[E236438]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/236438/versions/2e88efa7ed23f91b7eb238e4416228849636f8a7cfa35d1b4c2842c55c3962e9.evidence-v3.json
[E236470]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/236470/versions/62c01f214505b653b975715c17a22ac3ce65724f20bb9fc08ff4a44736b4ae68.evidence-v3.json
[E236469]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/236469/versions/6e6b3c4409542fcdc48aefb9c137068e5c44df9ba1556d7d674e8e228cd5c67a.evidence-v3.json
[E134140]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/134140/versions/770ae7ec283a374273511613c61937b2d476555bb60e043f6a88a4ed3728ead9.evidence-v3.json
[E207902]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/207902/versions/784066f15e5d7d8f1dab8aea079cddebfa118cd4d6156d647379707cdc6e86ca.evidence-v3.json
[E207904]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/207904/versions/ddd0a965fe38ea1b0ad4c2522bcbe542cd1c26a69a1559abcad04bdc41cb7189.evidence-v3.json
[E208265]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/208265/versions/df2541e52482fc56faebe15c0307359b0afd742b6deef9f947a9461258c6e6ec.evidence-v3.json
[E243807]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/243807/versions/f56234a53a3f0403a228689143828e65c9e3ef6062daf4a67fe99a01a6f7fa3a.evidence-v3.json
[E245027]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245027/versions/5feed3bbafea4b492e36a157857b0576a2ba2f78a7047da5a0ba0b53debd8fe8.evidence-v3.json
[E207905]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/207905/versions/728dd834064c38d92bbadea301b18c4468e34f9ba5203eb54c3a2aa44886bdaa.evidence-v3.json
[E197437]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/197437/versions/bb9012c911a6474098a3ad8433d760d5428dce7d73b0aac5c322b61b676c04b4.evidence-v3.json
[E198441]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/198441/versions/6fabad2054c07114fe6afc524d82a7f8eb6164e870795667eac6f6e9f84bcd07.evidence-v3.json
[E237596]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237596/versions/e4b6d37d3775f3b004ce96ad731c9811311d79b59572e9b7d51b18d5f2791e7b.evidence-v3.json
[E237626]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237626/versions/e5d2354d8c9f1aa5ae2bf3de3925262c6bea3687d0b87c4b971c109fe685d76b.evidence-v3.json
[E245945]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245945/versions/93f49c8a4b15122d1e7e9da479de0fcf3d498e2604a16a04268cfe60c340d122.evidence-v3.json
[E226465]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/226465/versions/0c3e95ecda8f78371ba5abae502ce7a224fa0d0c5e64cc4c2942219a49621c3d.evidence-v3.json
[E226495]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/226495/versions/ce16f4df0699d737d9dbfecb7b55eee0c8c108e01a9486bed1e021e1505e55fc.evidence-v3.json
[E226737]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/226737/versions/8a0562b99be17336e118f1c266e69a2ba4c4faef6e62e92248f271f3c5a6c354.evidence-v3.json
[E245768]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245768/versions/fb93c577b1321479519d6fa4d496b127b1a0cf3d6b6766fd43ed72b7a05f613b.evidence-v3.json
[E245596]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/245596/versions/c0d801bb1c66f11da538c4a822979902bad7b2df007197aea562d3728a09c1aa.evidence-v3.json
[E247365]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/247365/versions/be87501ed4978b3b95a8a7007dd1102080f1c1bb9ad07e85148502d2fa7b1dce.evidence-v3.json
[E244420]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/244420/versions/529ed283505717ea01e613050f5a9a3fdef54aed6a1c72c573aa6ce8a5e85b92.evidence-v3.json
[E244438]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/244438/versions/bb0b392207e2d8b611ebbca76832cd5cfcd26850502d3854c5ef5de8ff898f97.evidence-v3.json
[E244446]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/244446/versions/75f67c17bb0184c11a2d16b20cb6a10a64b3b2fe4b39d7eacb2f3700a454422d.evidence-v3.json
[E244203]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/244203/versions/ab3c0a413346b4cc9580da6589ebe4b9b289677a9da19a432dc2bd934e2fbacc.evidence-v3.json
[E244169]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/244169/versions/c32046cbafc5edf44ac8c04c854744acd099c7c62fd735370c54d3358603c395.evidence-v3.json
[E223558]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/223558/versions/5374fe25ffb08b271256c19d2526628ee6da6f8400cad117a23740ba0bfbc1b7.evidence-v3.json
