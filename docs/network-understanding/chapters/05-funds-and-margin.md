# 资金、保证金与结算：先辨认是什么金额，再讨论如何相连

这张数据网络同时保存“约定应收多少”“账本记了什么变动”“账户在某日剩多少”“按履保规则需要多少”“结算通知写了多少”和“财务视图输出多少”。这些都与钱有关，但它们不是同一份事实，不能放进一个总额里相加。

本页的主审阅范围是 62 项；另 269 项见[合约、结构与持仓](03-contracts-and-positions.md)。两页合计闭合 EDW_AGT、EDW_SUM、EDW_EVT、EDW_NDS 的 331 项发布任务。账户及合约身份的来源见合约页，主体与组织定义见[公共对象](02-public-objects.md)，本页专注金额和事件之间怎样连接。

| 想回答的问题 | 优先辨认的对象 | 不能直接替代它的对象 |
|---|---|---|
| 该收、该付什么 | 收付款记录、费用与支付计划 | 账户余额 |
| 记了哪一笔资金变动 | 资金/保证金账本事件及原流水、触发来源 | 两天余额之差 |
| 某日可用、冻结、可提多少 | 账户余额快照及相应字段 | 同期发生金额简单求和 |
| 按什么规则要求多少保证金 | 合约参数、组合参数及履保计算结果 | 实际到账金额 |
| 哪份通知包含哪些收付 | 结算通知及通知—收付关系 | 已发送/已收款的运行结论 |
| 财务看到哪种业务金额 | 财务视图、合约补充信息与输出表 | 交易系统所有记录的机械合集 |

这些区分是对下文 SQL 字段与连接的解释，不是外加的财务制度定义。

<a id="receivables-payables"></a>
## 收付记录表达应收应付，实际支付另有日期与状态

`T05_OTC_RECV_PYMT_EVT` 以 `TIT157- + TRANSFER_ID` 形成事件编号，保留源收付款编号、交易号、合同号、账簿、产品、对手方、费用类型、互换持仓/腿/存续事件等关联编号。它把收付事项放回具体业务对象，而不是只存一个金额。[任务 105080，query 20–48 行](../../../../sql-static-lineage-data/task-projections/tasks/105080/versions/b7e0ad32c7134b70aa5c46f2c4dca28f34c27704958b41d86ee498e7b338e275.evidence-v3.json)

此表同时保留支付日期、实际支付日期、清算日期、收付方向和收付状态；金额也区分 `AMOUNT`、我司应收/应付、原币、调整后金额。因此有收付记录不等于已经支付，有 `Paid_Date` 不等于实际付款日，应收字段也不能直接当到账现金。实际结果需要结合状态含义与运行/数据证据，本页没有擅自补这个结论。[任务 105080，query 24–28 行](../../../../sql-static-lineage-data/task-projections/tasks/105080/versions/b7e0ad32c7134b70aa5c46f2c4dca28f34c27704958b41d86ee498e7b338e275.evidence-v3.json)、[任务 105080，query 49–68 行](../../../../sql-static-lineage-data/task-projections/tasks/105080/versions/b7e0ad32c7134b70aa5c46f2c4dca28f34c27704958b41d86ee498e7b338e275.evidence-v3.json)；[pdata_n.t05_otc_recv_pymt_evt DDL](../../../../sql-static-lineage-data/tables/hive/pdata_n.t05_otc_recv_pymt_evt__gfhive/ddl.sql)。

一个值得保留的字段约定是：`AMOUNT_RECEIVALBE` 映射到“调整后我司应付”，`AMOUNT_PAYABLE` 映射到“调整后我司应收”。源 OData 与目标 DDL 的中文注释均如此，不是本章按英文词面推断的方向。读者若发现词面不协调，应追问源口径，不能静默交换字段。[任务 105080，query 56–61 行](../../../../sql-static-lineage-data/task-projections/tasks/105080/versions/b7e0ad32c7134b70aa5c46f2c4dca28f34c27704958b41d86ee498e7b338e275.evidence-v3.json)；[odata_n_tit.d_trd_transfer DDL](../../../../sql-static-lineage-data/tables/hive/odata_n_tit.d_trd_transfer__gfhive/ddl.sql)。

收付款主表采用事件 ID 对比输入与既有记录、维护增改删状态的方式，不是只追加新流水。`104934` 与 `105080` 将前置建临时表的逻辑放在不同槽位；后者源查询 `D_TRD_TRANSFER` 本身没有追加业务日期条件。与此同时，NDS 的普通和 `h15` 变体按采集日期/批次选择来源并写接口分区，保留的是另一种交付形态。[任务 105080，query 74–76 行](../../../../sql-static-lineage-data/task-projections/tasks/105080/versions/b7e0ad32c7134b70aa5c46f2c4dca28f34c27704958b41d86ee498e7b338e275.evidence-v3.json)、[任务 105080，query 141–197 行](../../../../sql-static-lineage-data/task-projections/tasks/105080/versions/b7e0ad32c7134b70aa5c46f2c4dca28f34c27704958b41d86ee498e7b338e275.evidence-v3.json)、[任务 160812，query 1–51 行](../../../../sql-static-lineage-data/task-projections/tasks/160812/versions/7146ff0066b15a61f53b30fe41b81be9c1d0027da951bbed13c5948a01933e91.evidence-v3.json)、[任务 160813，query 1–51 行](../../../../sql-static-lineage-data/task-projections/tasks/160813/versions/72ffa4cd655a0c24b079277baf24501d8fde5dd3c01cf41f273dc717f244dc07.evidence-v3.json)

<a id="ledger-events"></a>
## 账本事件说明什么发生了变化

资金账本与保证金账本分别使用 `KEY_CAP_LEDGER_ID`、`KEY_MRG_LEDGER_ID` 形成事件，连接资金账户 `10220` 或保证金账户 `10219`。它们可以通过账户侧补对手方，通过 `KEY_INSTRUMENT_ID` 关联合约产品；**这个产品号仍需合约—产品关系才能回到合约号**，不能把它直接改叫合约 ID。[任务 173966，query 3–16 行](../../../../sql-static-lineage-data/task-projections/tasks/173966/versions/5bc7110ab371e9be23983fccb9b1f14e527e28ab47c70ed773867bcdfa5c2e02.evidence-v3.json)、[任务 173965，query 29–41 行](../../../../sql-static-lineage-data/task-projections/tasks/173965/versions/72f151a922e782aedceb8624ddfe0ef164489e69656dc3c8b23b050a8daa7eda.evidence-v3.json)

资金变动事件保存发生金额、操作前后资金余额、可用余额、冻结金额，以及挂账金额和挂账可用金额的前后值；另有原流水号、变动类型、账本状态、触发 ID 和触发类型。这些字段可用于解释变动链和状态，但本页没有证明 `操作后余额－操作前余额 = AMOUNT` 对全部类型成立。保证金事件则保存操作前后保证金余额及其变动类型。[任务 173966，query 17–35 行](../../../../sql-static-lineage-data/task-projections/tasks/173966/versions/5bc7110ab371e9be23983fccb9b1f14e527e28ab47c70ed773867bcdfa5c2e02.evidence-v3.json)、[任务 173965，query 42–47 行](../../../../sql-static-lineage-data/task-projections/tasks/173965/versions/72f151a922e782aedceb8624ddfe0ef164489e69656dc3c8b23b050a8daa7eda.evidence-v3.json)

两者时间处理不同：

- 资金账本任务按 `SRC_BUSI_DATE >= 处理日－3天` 读取，输出业务日期取源业务日期；另有 `ACTUAL_BUSI_DATE` 作为生效日期。这条谓词只有下界，不能把注释中的“T 至 T－3”改写成有明确上界的 SQL。[任务 173966，query 34–47 行](../../../../sql-static-lineage-data/task-projections/tasks/173966/versions/5bc7110ab371e9be23983fccb9b1f14e527e28ab47c70ed773867bcdfa5c2e02.evidence-v3.json)
- 保证金任务比较源/目标按业务日的记录数，并纳入当前业务日，选择需要覆盖的分区。同记录数的历史金额变更是否必然重新覆盖，现有选择规则没有证明。[任务 173965，query 1–27 行](../../../../sql-static-lineage-data/task-projections/tasks/173965/versions/72f151a922e782aedceb8624ddfe0ef164489e69656dc3c8b23b050a8daa7eda.evidence-v3.json)
- NDS 的保证金事件变体没有照搬上述逻辑：它按一个采集日读取，整表 overwrite，`Vld_Date` 写空且保留原始变动类型。两张同名业务事件表的含义和时间能力不能判作完全一致。[任务 174016，query 1–31 行](../../../../sql-static-lineage-data/task-projections/tasks/174016/versions/d77c053696cbba04b070c4d41c48d88c73ee2e2d1ad8148f0a2b4757fefa03b6.evidence-v3.json)

上述账本关联账户时，SQL 只按账户 ID 连接，未对账户侧限定业务日期。本次没有数据实例证明账户侧唯一，也没有执行对账。因此“记录了账本事件”与“已经证明真实现金全部发生并入账”仍需区分。

<a id="account-balances"></a>
## 余额是时点状态，且每种余额都带不同约束

统一余额模型 `T03_AST_CRRC_ACCT_BAL` 的保证金分支把源 `BALANCE` 放进 `Begn_Bal`，当前余额、可用余额等多列写空；资金分支除 `BALANCE` 外，还接 `FREEZE_BALANCE`、`AVAILABLE_BALANCE`、`AR_BALANCE`、`AR_AVAILABLE_BALANCE`、`ACTUAL_WITHDRAW_AMOUNT`。两者虽然都写“期初余额”，它们首先是源余额字段按模型口径命名，不能据此推断等于当天所有业务发生之前的余额。[任务 107646，query 4–40 行](../../../../sql-static-lineage-data/task-projections/tasks/107646/versions/07d7dcb1f5682f13642353d724f67b1f61f38b2ef15fd9579c913a043afa3097.evidence-v3.json)、[任务 112644，query 4–40 行](../../../../sql-static-lineage-data/task-projections/tasks/112644/versions/b4f0596031fc8e028efc7ffbfa05d0bbed091b6bb0aba95a0111af47f2bf4a41.evidence-v3.json)；[pdata_n.t03_ast_crrc_acct_bal DDL](../../../../sql-static-lineage-data/tables/hive/pdata_n.t03_ast_crrc_acct_bal__gfhive/ddl.sql)。

这组任务对源业务日期使用近 15 天下界并据此写业务分区；旧变体还关联账户表。值得注意的是模型 `Crrc_Cd` 在这些分支写空，不能因为表名有“分币种”就认为本表可直接进行跨币种总额汇总。源账户币种、其他余额接口、换汇口径应另行核对。

NDS 保留了 `CAPITAL_ACCT_CURRENT_BALANCE / CAPITAL_ACCT_DAILY_BALANCE / MARGIN_ACCT_CURRENT_BALANCE` 等接口。当前余额与每日余额从不同源对象进入；每日资金余额任务的 INSERT 没有分区子句，是整表覆盖，不能与具有 `PARTITION(busi_date)` 的接口视为同一种历史留存方式。[任务 174013，query 1–16 行](../../../../sql-static-lineage-data/task-projections/tasks/174013/versions/dc552df28fb4d58f7f316a58285afbbfb33b1b01d24d7bfed89505c18be344de.evidence-v3.json)、[任务 174014，query 1–17 行](../../../../sql-static-lineage-data/task-projections/tasks/174014/versions/517dd0ecfc8bf5b055dce7c2396df99d50713bd35f212149f9a3840e2da1e271.evidence-v3.json)、[任务 174015，query 1–12 行](../../../../sql-static-lineage-data/task-projections/tasks/174015/versions/4f4463d2375e0a5f7d5071b521e7e3345302b2e3594eda70ef4594cec297afcd.evidence-v3.json)

资金账户余额汇总也有两类不同来源：财务账户映射视图把 `BALANCE` 放到资金总余额，业务发生/实际总余额字段写空；另一个固定收益部门分支从实际余额来源接入业务历史余额、实际资金余额、实际保证金余额和总余额。后者 SQL 将 `Busi_Date` 与 `h21` 比较，且账户关系的唯一性未验证，不能用它替代前者或把两者相加。[任务 199182，query 3–26 行](../../../../sql-static-lineage-data/task-projections/tasks/199182/versions/99de1de7358b9a8229830659468fe86105ed43b92a096aebab8d39b9dbb13c72.evidence-v3.json)、[任务 213442，query 3–31 行](../../../../sql-static-lineage-data/task-projections/tasks/213442/versions/6ead766160df5cd2c502be33dca49976bc47d539b16fc795e63fe4b632bf0a89.evidence-v3.json)

<a id="margin-and-bundles"></a>
## 履保把合约、组合、账户连接起来，参数和结果分开保存

保证金相关模型至少有三层。第一层是账户：钱和担保物记在哪个账户。第二层是合约：合同约定的初始保证金、比例、预警线、追保线、强平线等。第三层是组合：哪些合约共同接受某种履保方案和盯市处理。网络用两类关系连接它们，而非把所有保证金都附在一个合约字段上：

- `MARGIN_ACCT_BUNDLE_MAPPING` 形成关系类型 `14`，把组合接到保证金账户和资金账户，合约栏为空。
- `MARGIN_BUNDLE_CONTRACT_MAPPING` 形成关系类型 `13`，以 `ENTITY_ID` 接交易的产品 ID，再得到合约号；保留资金账户、内部合约号、源合约类型与终止标志。
- 组合附加信息从 `TRD_BUNDLE_INFO` 接 `MARGIN_BUNDLE_ACCT`，保留方案 ID、对手方、组合类型、审批状态、盯市币种与组合成分。

来源：[任务 141595，query 3–23 行](../../../../sql-static-lineage-data/task-projections/tasks/141595/versions/16b4ca7c6640ae8ee09977d70b32ae880417f7ad8ec3bfdccbc89fe71e0f80a1.evidence-v3.json)、[任务 141596，query 3–35 行](../../../../sql-static-lineage-data/task-projections/tasks/141596/versions/897279ff1784541e03fd151ae782b1f1fbd7f93082efd36c339efd51ef409cf1.evidence-v3.json)、[任务 142888，query 3–28 行](../../../../sql-static-lineage-data/task-projections/tasks/142888/versions/aee4aca2eeaf5d386d44937b83a32e7c379538306aed5ad1a3174db86fa32d2b.evidence-v3.json)。此模型允许一组包含多份合约；当前源码并未证明这些关系始终一对一。

静态履保参数从 `REF_OTC_CONTR_MARGIN_PARAM` 进入 `T03_OTC_COMP_PERF_MARG_REF`，类型为 `STC_REF`，表达初始金额、保证金线、最小履保比例、担保品与授信参数。动态参数从 `BUNDLE_DAILY_CONTR_PARAM` 进入同表，类型 `DYNA_REF`，带组合、业务日和一系列 PV 等源计算字段。它们是规则/计算输入及中间结果，不是实际追加保证金流水；PV1～PV6 的完整业务定义在本证据中仍不足。[任务 105397，query 3–23 行](../../../../sql-static-lineage-data/task-projections/tasks/105397/versions/2aac4a9a3f73b106a8610b2e869f5d25fe1b35934a11d7ddab3a8925ec38a2b5.evidence-v3.json)、[任务 105397，query 57–80 行](../../../../sql-static-lineage-data/task-projections/tasks/105397/versions/2aac4a9a3f73b106a8610b2e869f5d25fe1b35934a11d7ddab3a8925ec38a2b5.evidence-v3.json)、[任务 147138，query 22–37 行](../../../../sql-static-lineage-data/task-projections/tasks/147138/versions/253bb49fbed759d7473f55c92032d8847e04a469bdd82cabb14c2f3ba26fe482.evidence-v3.json)、[任务 147138，query 82–100 行](../../../../sql-static-lineage-data/task-projections/tasks/147138/versions/253bb49fbed759d7473f55c92032d8847e04a469bdd82cabb14c2f3ba26fe482.evidence-v3.json)

履保结果 `T03_OTC_CUTP_MARG_ACCT_PERF_GUAR_RSLT` 从 `BUNDLE_MARGIN_DAILY_RESULT` 接入状态、动态名义本金、最小履约保障金额、应追保、可提取、保证金余额及其他要求。**已核对的普通/PB 两个变体把账户、对手方和合约列留空，以 `BUNDLE_ID` 作为实际业务关联中心。** 查询方需要经组合关系找到相关账户/合约，不能把空账户栏理解成没有对应账户。普通分支读普通源，PB 分支另外限定 `GRP_ID='h15'`。[任务 147139，query 3–40 行](../../../../sql-static-lineage-data/task-projections/tasks/147139/versions/76c7ee238e5b8dd4997db870e77fedee16493e5dd7548fecb763ff3042cbc9ed.evidence-v3.json)、[任务 165155，query 3–40 行](../../../../sql-static-lineage-data/task-projections/tasks/165155/versions/339b6fbcece9e0ed3172c17bdac541c4d234168ccc871edec69412864792f30e.evidence-v3.json)；[pdata_n.t03_otc_cutp_marg_acct_perf_guar_rslt DDL](../../../../sql-static-lineage-data/tables/hive/pdata_n.t03_otc_cutp_marg_acct_perf_guar_rslt__gfhive/ddl.sql)。

合约初始保证金信息另从 `F_TRD_OTC_CONTR_INITIAL_AMT` 接入，类型 `INIT_MARG`，保留扣除币种、优先级、方向、余额及折算汇率。组合追保信息则保留确认状态、递延天数、应兑付日、追保金额、完成日期及触发强平标志。一个是合同/初始条件，一个是追保处置记录，也都不能替代保证金账本实收。[任务 208637，query 3–37 行](../../../../sql-static-lineage-data/task-projections/tasks/208637/versions/f6c87d3d95f30aa583500b4ba40c146790dbe09be66cf2124f2417989fe91c3b.evidence-v3.json)、[任务 232684，query 6–39 行](../../../../sql-static-lineage-data/task-projections/tasks/232684/versions/35b0cf361b6fa82e0180235527889f1123c640641c264e64ff2239121fe6b7ac.evidence-v3.json)

### 保证金明细宽表为何不能无条件求和

`T98_OTC_COMP_MARG_DET` 至少有三种来源视角：金仕达风险视图以内部合约号和保证金账户文本提供合同估值、对冲估值、保证金、收益及追保信息；多份期权的组合分支按组合连接履保结果、账户余额、账本和主体；其余期权合约分支再把合约与账簿持仓接入。它们共用一张目标表，却不是同一粒度。

`176874` 用连接产品元数据之后 `HAVING COUNT(1)>1` 选多期权组合，`176877` 用相同条件的 NOT IN 选另外一支。这里数的是连接后的行数，并没有显式 `COUNT(DISTINCT 合约)`；若关系或元数据重复，分类能否保持原意尚未验证。多期权分支输出的合约 ID 为空，按账户账本 `WITHDRAW/REMARGIN` 累计发生金额；另一分支按合约产品和账簿接持仓。混合汇总会重复表达共同组合的要求或账户金额。[任务 176873，query 6–50 行](../../../../sql-static-lineage-data/task-projections/tasks/176873/versions/db0c2abfd637e254740c90b9ece779bb2548bd1a2fb07073cef235a3d5cfec3d.evidence-v3.json)、[任务 176874，query 62–110 行](../../../../sql-static-lineage-data/task-projections/tasks/176874/versions/48ff368fad2ac526b0a40caa1df880c27d41cde0f76e87e352f15cbc0dae5b14.evidence-v3.json)、[任务 176877，query 64–115 行](../../../../sql-static-lineage-data/task-projections/tasks/176877/versions/ca18ec2228c784ea82fd49b33c823f7edb3a89799377028308fd79ca810fc3e0.evidence-v3.json)

另有两个需要消费者确认的具体点：`176877.Accum_Pal` 与 `Accum_Accr_Intr` 都取同一个 `last_pos.Accum_Accr_Intr`；余额先与多条账本记录连接再 SUM 时，需要验证重复度。这里保留 SQL 原样，未将累计计提利息改称已证实的累计损益，也没有凭静态文本宣判金额错误。[任务 176877，query 26–38 行](../../../../sql-static-lineage-data/task-projections/tasks/176877/versions/ca18ec2228c784ea82fd49b33c823f7edb3a89799377028308fd79ca810fc3e0.evidence-v3.json)、[任务 176877，query 82–100 行](../../../../sql-static-lineage-data/task-projections/tasks/176877/versions/ca18ec2228c784ea82fd49b33c823f7edb3a89799377028308fd79ca810fc3e0.evidence-v3.json)

<a id="settlement-chain"></a>
## 从费用和支付计划，走到结算结果及通知

费用主信息记录费用类型、金额、比例、周期和支付频率。支付计划按 `KEY_FEE_PAYMENT_ID` 标识计划项，经 `KEY_FEE_ID` 接回费用，再按源费用记录判断合约编号及修饰符；它分别保存计划支付日、实际支付日、本币/原币/人民币金额和实际支付金额。模板中的 `${src_table}` 尚未落成唯一物理来源，这条业务连接只能解释为模板已表达的关系。[任务 110164，query 3–23 行](../../../../sql-static-lineage-data/task-projections/tasks/110164/versions/48d7d27b3e77395fdfc8ae4365652973f3186b128931b3ffe84c150d1d377a52.evidence-v3.json)、[任务 207947，query 6–42 行](../../../../sql-static-lineage-data/task-projections/tasks/207947/versions/d2392ce64208b224fc0b0e746c2a78307254a47c1b3e86f699873efd04d1af9a.evidence-v3.json)

期权结算信息从 `TRD_OPTION_DEAL_SETTLEMENT` 直接接入结算金额、净收取金额、实际支付/兑付/结算日期、实际期限和终止日价值。另一个结算信息表来自 CSS 结算流水，以合同代码接 TITANS 内部交易号并对清算日期与采集日期，再以金仕达确认 ID 作备选连接；它带应收、应付、保证金、期权费、后端费、分红及其他费用。两者来源和业务粒度不同，不能根据同有 `Sett_Amt` 合并。[任务 112816，query 3–26 行](../../../../sql-static-lineage-data/task-projections/tasks/112816/versions/dba93b984f19e80f6d6b3908126fc9cf645b7c8699c1a49196530db096bb5658.evidence-v3.json)、[任务 134213，query 3–45 行](../../../../sql-static-lineage-data/task-projections/tasks/134213/versions/22b626657026283814d46cdade50960abeccb309c38e0e2f4a9371708e0d56d7.evidence-v3.json)

结算通知形成事件 `TIT292- + ID`，关联合约、资金账户和对手方，保留状态、审批日期、各收益/费用组成、返还保证金与总结算金额。通知与收付款的关系表则明确使用 `KEY_SN_ID → TRANSFER_ID`，输出 `TIT292-… → TIT157-…`，关系类型 `01`。这条关系可以回答“某份通知对应哪些收付款记录”；通知金额与收付金额是否对平、通知是否已发送、钱是否已付，还需要数据和运行证据。[任务 181103，create 55–103 行](../../../../sql-static-lineage-data/task-projections/tasks/181103/versions/45dd5e62789251a58efd77a7fea9ca5a388badb0bcf531b22cad9c05108e3be7.evidence-v3.json)、[任务 185098，create 18–26 行](../../../../sql-static-lineage-data/task-projections/tasks/185098/versions/5af7c4ebd22460c96b882ed5d004e64ce0d318ec5a42eb37eb490852aac0f585.evidence-v3.json)

业务层可沿以下顺序复核一项结算：先认合约身份及产品，找到费用/收付记录；需要查看通知时，通过通知—收付关系接回通知；需要查看账户实际变动时，再依据账户、产品、事件类型与触发 ID 追账本。最后对照相同业务日的余额。这是本图可支持的调查路径，**尚未证明每一笔收付款都存在到银行流水的唯一连接**。

<a id="finance-interfaces"></a>
## 财务输出既使用业务事实，也加入自身的组织方式

财务合约视图与统一合约宽表通过内部合约号补接 AGT：互换使用 `CONTRACT_CODE = Inr_Comp_No`，期权使用 `CONTRACT_CODE = Inr_Ord_Id`。它们保留合约类型、账簿、部门、对手方、销售方、币种等，期权分支额外带名义本金和期权费；内部合约号是否唯一没有由该 JOIN 证明。[任务 199176，query 3–28 行](../../../../sql-static-lineage-data/task-projections/tasks/199176/versions/4ff96d9491bebafd1bea237364c3fe6452da90d016bf72b29d93db5be608f674.evidence-v3.json)、[任务 199178，query 3–30 行](../../../../sql-static-lineage-data/task-projections/tasks/199178/versions/438c1e9756ac3168259109976db2fd536942f015f21423c7627f4887897e1288.evidence-v3.json)

财务交易事件模板有互换和期权两种源意图，均保存业务日期、内部合约号、细业务类型、账簿、部门、币种和发生金额。期权分支还读取 `CONTRACT_TYPE/UPDATE_DATE`，互换对应字段写空。它们没有通过本 SQL 重放和核算全部交易过程；“财务视图”意味着当前可见源加工结果，而不是我们已经验证全部财务定义。[任务 199179，query 6–23 行](../../../../sql-static-lineage-data/task-projections/tasks/199179/versions/db938999d9f0a6425623efcb9cf0bbb475a9549e0e09e247f467c3a621b768fc.evidence-v3.json)、[任务 199180，query 6–23 行](../../../../sql-static-lineage-data/task-projections/tasks/199180/versions/41227de189c4cee3fa53992f83da2c2a754e7110b6fee14c304ed6e1547ab973.evidence-v3.json)

资金余额变动输出从财务资金变动视图接收 `T_BALANCE / PRE_T_BALANCE / DIFF_BALANCE`。这是一组相邻状态及差额，源 SQL 在此没有将账本发生金额重新求和；它与资金账本流水必须分别使用。相关财务与估值主题见[财务与估值](07-finance-and-valuation.md)。[任务 199181，query 6–27 行](../../../../sql-static-lineage-data/task-projections/tasks/199181/versions/c823ecc8f44291c670079faab72055968cfd1f1deeb27c6449e18a96de364056.evidence-v3.json)

保证金报送信息及附件、收益凭证等输出也属于本固定目录的接出点。它们可保留主记录与附件的区别，以及具体来源和筛选方式；本页不将一个报送表已被写入，解释成监管方接收或业务验收完成。

<a id="evidence-limits"></a>
## 可以直接复核什么，哪些结论仍缺证据

[funds-review.json](../evidence/funds-review.json) 包含本页全部 62 项的实际输入/输出物理节点、TablePack 和 DDL、SQL 槽位及哈希、关键控制条件、字段表达式和审阅状态；合约页账本包含另 269 项。每条记录的 `semanticReviewScope` 限定已解释的内容，不能把“解析成功”“模板核实”升级成所有字段均经过业务认可。

当前明确保留的边界：

- **金额币种与粒度：** 原币、本币、结算币、账户、合约、组合和业务日期都不能省略。空值不自动按零处理，模型共表也不自动允许相加。
- **批次参数：** `213442` 用 `h21` 比较业务日期，`236414/236415` 用 `h13`；发布文本需确认日期/批次参数及实际分区。没有据此修改 SQL，也没有声称运行失败。
- **关联与字段口径：** 期权资金账户修饰符 `10218` 与账户主模型 `10220` 不一致，见合约页；账本到账户、财务内部合约号、多合约组合计数、余额连接账本等均未做数据唯一性验证。
- **物理来源未展开：** 支付计划、财务交易与部分追保模板仍含 `${src_table}`。表注释和代码注释用于理解意图，不能冒充已经确认的来源物理键。
- **运营事实尚缺：** 本次发布是静态证据。没有补采实际银行入账、实际到账、通知发送、财务对账和监管接收的证据，也没有把测试或登记状态当成生产事实。

证据读取于 2026-09-08，采用与合约页相同的固定发布基线。引用的行号是证据 JSON 内对应 `sqlSources.slot` 的 SQL 行号；表结构来自目录中精确物理身份匹配的 TablePack，不用同名对象代替。
