# 风险与定价：把合约、持仓、市场数据和业务状态放到同一张工作台上

本章覆盖当前发布图中，最终写入 `dm_rsk_n` 的全部100个任务。它们的共同工作是把不同来源的合约、估值、损益、账户、行情和流程信息整理为风险使用的数据。**这些SQL大多消费已有定价结果，再做关联、转换、汇总和状态控制；它们并没有在这一层重新计算一套完整的期权或互换定价模型。** 因而，读懂这一层要同时回答“金额取自哪里”和“为什么这条记录被留下、改名、置零或分配给另一本账簿”。

这里的100个任务也不全是OTC。末节单独交代香港负债以及融资融券客户月报，避免把相同schema误认成同一种业务。任务内的 `query`、`finish` 均可能写表；本章描述实际SQL阶段，读写范围账本中的“最终写入”只是任务内未再消费的输出。

本章证据固定在 publication `df6f0ae4b6ef465f751351b14fd02ea08542d824d7bfea36e5a58dd1039e23c3`。引文中的“query 163–205”是发布evidence内相应SQL槽位的行号，**不是JSON文件行号**。实际运行批次、风险制度的批准口径，以及业务用户当前看到的页面，均未由这些静态证据证明。

## 一、先把“哪笔合约、哪个对手、哪本账、哪个账户”对齐

<a id="risk-identities"></a>

四种对象不能混为一个编号：合约描述交易约定；账簿描述头寸归属和报风控范围；组合把多笔合约组织到同一履约保障计算；保证金账户和资金账户分别承载保证金管理及资金余额。`d_v_risk_contr_capital_mapping` 先从合约—组合关系找到保证金账户，同一源产品存在多个候选时，以组合编号升序、保证金编号转整数后降序取第一条，再接合约、账簿和履保参数，要求账簿报风险标志为1。它输出的是映射关系，不是“每笔合约天然只有一个账户”的制度证明。[143830 · query 8–20、50–79][R143830]

`comp_marg_acct_info` 也择一映射，但分组用产品编号，账户编号排序没有相同的转整数表达式。这两个视图虽然都讲保证金账户，不能仅凭名称互换。`v_risk_contr_margin_mapping` 则把保证金账户继续接到资金账户，并排除资金账户用途为 `GROUP` 的记录；其中 `distinct` 消除的是输出列完全相同的行，并不声明上游关系一定一对一。[151145 · query 9–33][R151145] [163599 · query 8–48][R163599]

交易对手表 `otc_cutp_base_info` 以TITANS对手为主，接中文名称、部门、评级、分类，再通过有效关系找到运管对手；统一社会信用代码在直接映射缺失时还会尝试法律主体对应的父级对手。`Pty_Id`、`Cutp_Pty_Id`、对手产品编号、法律主体是不同层次。一个产品对手与其管理人的名字相近，不代表它们可以用名字合并。直接关系使用 `strt_date <= 计算日 < end_date`，父级备用关系却使用 `strt_date < 计算日 <= end_date`，边界当天需要保留这一区别。[147185 · query 19–91][R147185]

本层常同时保存 `busi_date` 与 `src_busi_date`：前者可能是加载/分区日期，后者是历史计算日期。映射表可以把历史保证金结果接到**计算日有效的合约、组合及账户关系**。因此，今天重跑历史结果时，关系变化可能改变历史日期行的归属；不能因为金额日期很早，就断定所有描述也来自当年。[143830 · query 37–79][R143830] [145583 · query 13–60][R145583]

## 二、期权有三层：合约条款、子交易风险、汇总损益

<a id="option-contracts"></a>

`otc_opt_sub_trd_info` 一行首先带期权合约协议编号和子交易编号，再展开交易对手、条款、观察日、障碍、收益及结算安排。它的主来源已经是 `t98_otc_opt_comp_sub_trd_base_info` 中的风险期权信息，本层还接账簿映射、结构和状态转码。一个合约可有多个子交易，一次映射也可能形成多个风险账簿视角，不能只用合约编号去重。[209119 · query 317–339、470–527][R209119]

账簿映射不是只换一个显示名称：按合约编号精确匹配、包含匹配，或交易对手规则找到目标账簿后，若源账簿与目标账簿不同，SQL会翻转 `Buy/Sell`。所以“同一子交易在另一视图变成卖方”可能来自风险归属转换，需要先查映射，不宜先判断交易记录错了。普通任务从PDATA的有效映射模型取规则；`h15`任务改读ODATA的 `h15` 分区，其他主要条款仍来自当日PDATA。两者不是完全相同的输入快照。[209119 · query 9–43、335–339][R209119] [244970 · query 9–70、474–517][R244970]

<a id="option-risk"></a>

`otc_opt_greek_val_det_h` 将子交易、合约、定价指标、持仓风险数值、汇率和障碍事件并在一起。场外期权分支排除两个交易状态编码，并要求合约报风险；其定价环境按所属部门选择，不能将各环境混加成同一个风险数。另一分支接入场内期权，字段来源和空值安排不同。[176827 · query 248–264、348–349、454–466][R176827]

这里可以直接看到“值来源”和“控制条件”的区别：Delta取持仓风险数值并除以汇率，汇率为0时分母改为NULL；Gamma、Theta、Vega遇到终止日或已触发条件会置零；本币Gamma/Vega还乘汇率。并非每个 `_base` 字段都与普通字段使用完全相同的置零规则，例如 `delta_base` 直接取原始Delta。示意地，原始Delta为700、换算率为7时，普通Delta可显示100；终止条件触发时普通Delta变成0，并不证明源定价结果也已经变为0。[176827 · query 163–205][R176827]

多标的风险又分成两类行：`grp01` 以X/Y标的对记录交叉Gamma、CEGA和相关性；`grp02` 以单个标的记录Delta、Vega、Rho及标的价格。前者的Delta等字段刻意留空，后者的交叉Gamma等字段刻意留空，空字符串不能统一解释为“漏采指标”。篮子成分表另外描述合约—篮子—成分标的及权重，一个篮子有几个成分就可能有几行；篮子权重不能直接当作所有风险值的线性分摊系数。[176831 · query 35–98][R176831] [176839 · query 35–98][R176839] [177267 · query 26–75][R177267]

期限桶表保留子交易、定价日、环境、期限、波动率曲面和期限Vega，本币Vega由Vega乘汇率。压力测试表则把指定账簿的AUTOCALL情景结果汇总：规则998用情景PV减零价格偏移、零波动率偏移的基准PV；规则999汇总情景Delta；另一分支接现成风险指标。这里的压力损失是情景差额，不能当作当天已经实现的亏损。[155906 · query 16–30、34–60][R155906] [155157 · query 1–33、48–110][R155157]

<a id="option-pl-settlement"></a>

合约损益表 `otc_opt_inr_comp_pal_sum` 再把子交易损益按内部合约、账簿、日期、终止日标志等汇总；总成本在这一分支是“累计收益合计减PV合计”。动态名义本金另受起始定价日、终止日和存续期事件控制。这与Greeks既不同粒度，也不同计算目的。结算表则接收已经形成的结算金额、净收取额、实际支付日和终止日PV；普通任务读当日PDATA，`h15`直接读ODATA的 `h15` 分区后重命名字段。收付款事件表再按报风险账簿关联子交易，不等于这些款项已经实收实付。[181058 · query 48–67、97–145][R181058] [244919 · query 27–55][R244919] [244811 · query 28–54][R244811] [150915 · query 34–58][R150915]

## 三、互换损益是一组带明确边界的分支

<a id="swap-pl"></a>

互换P&L的主要输入来自NDS交易、合约、腿、持仓和估值，辅以对手、账簿、保证金和汇率。读一行时，至少同时看内部合约、账簿视角、估值日期、币种和分组。金额字段分别表达原币、结算币种、本币及人民币；有的人民币金额乘估值日汇率，有的市值或动态本金使用期初约定汇率，不能把所有“人民币”都解释为统一的当日汇率换算。[159489 · query 114–235、291–453][R159489]

| 分组 | 这类行在表达什么               | 已见的关键区别                                                                              |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| 01   | 普通互换存续期内的日期结果     | 由结构腿历史持仓日期展开，限制在实际结算日或到期日以内；账簿要求报风险。                    |
| 02   | 普通互换存续期外的延续记录     | 交易日历生成结束日之后的日期，沿用终止时点相关累计结果，当日损益字段置0，并控制跨年累计值。 |
| 03   | 通过另一账簿展示的存续期内结果 | 同产品、同日期在不同账簿的持仓与映射相接，按 `direction` 转换方向。                         |
| 04   | 映射账簿的存续期外结果         | 同时应用结束日后的日历展开和映射方向。                                                      |
| 05   | KS来源互换                     | 来自KS交易确认、日终持仓及风险输入；一条SQL里含存续期内、存续期外两个分支。                 |
| 06   | FAST互换存续期内结果           | 先按合约、账簿、日期聚合FAST腿估值及头寸，再接前日、年末基准等。                            |
| 07   | FAST互换存续期外结果           | 从结束日之后展开日期，取结束时点结果；当日收益置0，年度累计受年份边界约束。                 |

这些分组来自各SQL的日期条件、来源和映射连接，而非仅按任务名猜测。尤其是03/04的映射，要求源账簿有对应交易、另一账簿有同产品持仓但没有对应交易，并存在有效账簿关系。该关系会改变损益视角。[159495 · query 452–513][R159495] [159497 · query 301–306、433–489][R159497] [159506 · query 302–307、463–541][R159506] [159498 · query 255–337、480–562][R159498] [188414 · query 433–454][R188414] [188419 · query 371–443、473–509][R188419]

因此，**合约结束后仍在某天的P&L表里出现，不代表当天还有新交易或新损益。** 示意：结束日累计收益为100，后续日期行仍可能保留100，但当天收益为0。年度累计还可能在跨年后归零。这是报表保留历史累计结果的实现方式，不能把累计值跨日期求和。[159497 · query 175–243、301–306][R159497] [188419 · query 371–443][R188419]

普通七组任务的 `finish` 先将临时表转写正式 `otc_trs_risk_plreport`，再将正式表写入备份；六个对应 `h15` 任务只有正式转写阶段。以01组为例，临时表按加载日选取，正式表分区日期改用 `src_busi_date`，并筛选最近15天的来源日期。这里的“回写窗口”与“合约存续区间”是两回事。六对日内/普通任务的query逐字hash相同，但finish阶段不同；SQL相同也不能证明调度时刻和实际输入数据相同。[159489 · finish 117–233、351–354][R159489] [160795 · finish 117–233][R160795]

<a id="swap-contracts"></a>

互换参数表另外整理合约状态、支付腿、保证金参数、币种和约定汇率，并含KS来源分支；`v_trs_nav_acc_for_risk` 在TIT分支按日期、基金、协议组、标的汇总数量和市值，却对期初价格、收盘价、集中度取平均，KS分支直接接已有值。不能拿这里的均价乘汇总数量，自动认定等于汇总市值。`trs_pal_stmt` 是另一个边界更窄的结果：最后选取估值终止日，缺失时退到实际结算日，再退到合约到期日，不是全日期的普通P&L替代品。外汇远期参数表则保留两币种相关本金、约定和实际结算等条款，不能当作股票互换。[163286 · query 180–235、497–504][R163286] [149570 · query 15–60][R149570] [218601 · query 674–681][R218601] [163077 · query 42–69][R163077]

## 四、保证金余额、履保结果和可取资金不是同一个数

<a id="margin-accounts"></a>

账户详情把组合履保计算结果、每日参数、账户余额并在一起，分开保存批次保证金余额、账户余额、履约保障比例、最小金额、应追保和可提取额。参数有组合级哨兵记录时，SQL优先选该记录，否则使用组合下合约参数；KS分支可把合同编号作为保证金编号，并将一些不适用字段填NULL。不能看到相同列名就假设两分支的实体和可用字段相同。[143860 · query 27–108、139–167][R143860]

`adm_v_risk_daily_bundle_margin` 同时呈现批次保证金余额和实时保证金余额，状态翻译为正常、预警、追保、未知、平仓，并列示保证金参数及模型已有PV场景值。这些是上游计算结果与参数的组织，不是本层根据市场数据重新算一次完整履保算法。其“合计应追加金额”是应追加额加垫资额；资金账户报表中的应追保却先按组合取“应追加额与垫资额绝对值的较大值”，再汇总到资金账户。两个字段看起来相似，公式并不相同。[200078 · query 390–439][R200078] [206952 · query 6–35][R206952]

资金账户表还把实际可取额定义为 `min(可用余额−挂账可用额, 当前余额)`，再组合保证金敞口得到可提取资金总额。因此当前余额100、可用余额80、挂账可用额20时，该子公式得到60；不能将100直接视为可取资金。普通任务还追加LSS来源账户余额，日内 `h13` 任务没有这条分支，两个版本的总行数和总额不宜直接比较。`is_valid_acct` 是按持有人名下特定账户后缀规则计算的标识，不能泛化为“银行确认账户有效”。[206952 · query 57–77、97–145][R206952] [236759 · query 58–109][R236759]

合约保证金明细又把期权与互换分开：期权分支保留履保结果及出入金，互换分支进一步区分借券、空头、指数增强，并引用持仓、腿估值和买卖方向。它们位于“合约—账户”的解释层，不能把组合余额在每个合约行上直接累加。其全部分摊、关联倍数和历史边界仍列为待补核事项。[176330 · query 46–65、328–347][R176330] [176360 · query 46–65、225–273][R176360]

## 五、市场数据供给和异常检查各司其职

<a id="market"></a>

供给表通常保留证券/因子、行情日期和加载日期三类信息。期货、涡轮、牛熊证、股票/指数、基金、场内期权行情都经过来源及证券分类筛选：同一行情基础表被按 `FUTURE`、`WAR`、`CBBC`、`INDEX/EQUITY`、`FUND`、`LISTEDOPTION` 分流。基础信息表负责证券、交易所、币种、期限和日历，行情表负责某日的价格与成交量；有 `busi_date` 并不等于所有源行情都只有当天一行。[164723 · query 48–95][R164723] [172823 · query 63–80][R172823] [172848 · query 63–80][R172848] [175782 · query 71–89][R175782] [175843 · query 57–77][R175843] [175878 · query 61–77][R175878]

收益率曲线、分红曲线、波动率和相关性需要再区分“定义”与“数值”：定义告诉系统它是哪条曲线、哪个因子、哪个期限；数值告诉系统在某个观察日该点取多少。波动率输出里，一条来源分支直接取因子值，另一条把TIT插值结果除以100。若源值为20，后者输出0.20，这是单位转换；两个数必须先对齐单位再比较。多时点任务中，波动率两份query相同，因子行情三份query也相同；时点含义需要调度和输入证据补足。[155160 · query 37–59][R155160] [176548 · query 17–30、76–91、100–150][R176548] [182209 · query 56–101][R182209] [182230 · query 14–60][R182230] [194609 · query 16–62][R194609]

因子行情表用 `union all` 合并已得因子涨跌幅、证券行情和净值。其证券行情分支按证券和日期排除已有净值的记录。SQL注释写“优先风管”，实际排除连接却指向净值表；目前能确认的是这条具体条件，不能扩写成覆盖全部行情的统一优先级。[177526 · query 17–35、75–115][R177526]

<a id="market-monitor"></a>

异常表的一行是“某规则在某日命中的某个对象/期限点”，不是自动修正后的行情。它保留规则编号、检查对象、今日/前值、阈值、被检表及字段；“异常处理后填充值”在这些SQL中留空。三类检查解决三个不同问题：

- **停滞**：连续观察值相同达到一定天数。商品结算价和曲线点按5/15/30天分级；外汇即期及远掉期点也有对应检查。SQL里5天边界存在 `>5` 与标签 `>=5` 并存，应按实际筛选和标签分别解释。
- **缺失/不合理值**：商品结算价及期限点有零、负、空值，另查整条曲线、某个期限点或到期日缺失。波动率家族区分利率/商品/外汇、LBR/TIT、整条曲线/部分期限，并扩展至权益收盘价、涨跌幅和分红率曲线。预期对象定义与实际行情做左关联后为空才形成告警；已到期的期货因子有排除条件。
- **跳变**：商品价格和曲线点用绝对相对变动，超过5%命中；外汇即期超过1%命中，超过3%标为另一档。外汇远掉期跳变分支在当前SQL中已注释，不能算作正在执行的检查。

证据分别见[178749 · query 19–36、62–112][R178749]、[178766 · query 18–86、197–394][R178766]、[178769 · query 20–71、74–128][R178769]、[180145 · query 19–36、119–129][R180145]、[180307 · query 20–78][R180307]及[191254 · query 18–106、326–1196][R191254]。例如价格100变成106，变动6%，商品规则可命中；但一次命中只说明符合SQL异常条件，仍需判断是市场真实波动、源数据问题还是规则不适配。

## 六、清算异常检查的是业务对象之间是否相互一致

<a id="settlement-monitor"></a>

八组任务汇入同一清算异常表，使用共同的合约、事件、流程、证券和交易日历。列中既可能出现流程时间，也可能出现事件日、清算日或公司行为日；各分支空着的列常是“不适用”。应按 `grp_id` 和异常类别解读一行：

| 组  | 主要检查                         | 关键边界                                                                                      |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------- |
| 01  | 合约起始相关流程时效             | 不同市场/产品分别使用后续一或两个交易日，并检查15点时间界限；部分源合约有2024年起始日期下限。 |
| 02  | 部分平仓、平仓、终止事件处理时效 | 比较事件实际处理时间和交易日边界；港交所基金另按较长边界，且最终排除特定内部合约前缀。        |
| 03  | 收付款回滚                       | 检查完成在指定结束节点的回滚流程，并与收付款/合约匹配。                                       |
| 04  | 流程与合约状态矛盾               | 包括通过终止流程后仍生效、存在多个通过终止流程等情况。                                        |
| 05  | 公司行为后应有的期权事件缺失     | 公司行为日在起始与终止之间，按分红处理方式和产品类型排除例外，再查是否缺事件。                |
| 06  | 收付款或结算通知书缺失/迟生成    | 分期权、互换与部分/全部终止八个子分支。                                                       |
| 07  | 负持仓或负动态名义本金           | 互换从实时腿持仓查负数量；期权从存续期变化事件重建相关数量后查负值。                          |
| 08  | 结束边界之后仍录入事件           | 比较事件日期与提前终止/到期日期，并限定输入时间。                                             |

这组规则的业务价值是把“合约状态”“流程是否完成”“事件是否通过”“是否生成收付款/通知书”放到一起比较。一个流程为完成，不推出所有后续对象齐全；也不能把静态规则输出直接称为已确认操作事故。清算日期和节假日按SQL使用的交易日历解释，`${…,1d}` 等调度占位符保留原意，当前未重新定义其运行时解析约定。[180692 · query 280–303][R180692] [181553 · query 402–445][R181553] [180700 · query 144–192][R180700] [180714 · query 107–140、148–312][R180714] [181555 · query 159–169][R181555] [181556 · query 106–108、168–582、641–650][R181556] [187506 · query 78–115、155–182][R187506] [187509 · query 177–189][R187509]

## 七、边界内还有这些结果，不能漏掉或混入主线

<a id="hedge-risk"></a>

对冲持仓表排除场外期权、期权合约、费用及TRS分类，只留下报风险账簿的其他持仓；普通/h15 query相同，保留近期来源日期。`fx_enay_pal_expo_stmt` 虽保留各种证券解释分支，最终SQL限定 `CASH`，它在当前实现中是现金外汇敞口视角。QIS视图从清算头寸及合约/账簿补充信息生成，其业务使用范围尚待确认，不能仅按缩写赋予产品制度含义。[148697 · query 276–328][R148697] [219735 · query 18–44、125–126][R219735] [155118 · query 54–71][R155118]

<a id="hk-liability"></a>

香港负债基础日表至少有票据和另一组融资/回购相关输入，包含融资期限、剩余天数、本金、利率、计息基础，并在部分分支补最新SOFR/HIBOR。它服务于负债端融资解释，不能并入OTC合约风险敞口求和。该两任务的完整品种分支和利率适用条件仍待逐段收口。[176443 · query 50–69、235–260][R176443] [176525 · query 1–27、303–338][R176525]

<a id="audit"></a>

审计日志表保留旧值、新值、处理人、动作、结果和更新时间，并补计算日有效的内部合约编号；它是解释“谁何时改过什么”的线索，日志中的处理结果不证明所有下游已更新。[155015 · query 26–41][R155015]

<a id="brokerage-margin"></a>

`marg_brch_cust_situ_mon` 是融资融券经营统计，按机构/月统计开户、销户、激活、负债、授信及渗透率，涉及客户、信用账户和标签；其中还排除同日销户再开户的特殊计数。它与OTC履约保证金的“追保/可取额”不是同一业务对象，放在同一schema不足以统一两种保证金语义。[237113 · query 20–57、162–180][R237113]

## 八、读完这一章，应能分辨哪些变化会传到哪里

<a id="risk-boundaries"></a>

改变账簿报风险标志，会改变进入Greeks、部分P&L或对冲持仓的记录集合；改变账簿映射，可能同时改变归属、买卖方向及收益符号。改变实际终止日，会改变存续期分支、日期延续、动态本金和指标置零，而不只是改一个日期字段。改变一个市场价格，可能影响上游重估及本层异常命中，但本章SQL没有证明上游模型一定重跑。改变保证金账户映射，会改变组合汇总到哪个资金账户；不会自动令两个不同公式的“应追加额”变成同一口径。

当前发布图对这些风险表的已投影外部读取很少；可以明确看到资金账户任务消费交易对手基础表，以及任务内部临时表—正式表—备份的传递。没有证据证明所有最终风险页面、导出端或业务消费系统已经纳入这张图，因此本章对最终用途的判断止于表说明和SQL行为，不补画未经证明的消费者。

逐项范围与核读记录在 [risk-review.json](../evidence/risk-review.json)。`EXPLAINED` 表示本章实质解释了相应加工家族；`LOCATED` 表示已有来源、条件和章节归属，但仍缺完整变体或关键细节核读，均不表示运行验收完成。当前仍需补足：香港负债的全部分支、保证金明细关联倍数、部分复杂汇总finish的完整改写、QIS使用语义，以及曲线检查中阈值边界不一致的业务确认。以上缺口不应被“100个任务都在目录里”掩盖。

<!-- Evidence reference definitions are generated from the pinned task catalog below. -->

[R143830]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/143830/versions/96f95ce82190888a16b5a330d5b93b71a3902478d229d69924ea5d31e991283d.evidence-v3.json
[R151145]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/151145/versions/77c1b9546120662e614ae89e31eeedfe8aaa8c557643f66dd821bc9081b94e70.evidence-v3.json
[R163599]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/163599/versions/8ebf3fca68c10a2db72c6bef14d453221a0b61a699dbc4b0899e60a17022814e.evidence-v3.json
[R147185]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/147185/versions/3defdda1d103c5f7b3f64ece2ccf11547f27216a38d6884df3ae69c948cc3105.evidence-v3.json
[R145583]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/145583/versions/9f8c15f34e3cf6ab37ad605f2e52fe8cb3dc3eb5cb0fb0d4b67dc7930ece16f4.evidence-v3.json
[R209119]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/209119/versions/d72abb49af1d05c6c0c5906ec6ed5de093e3afe61ddb53cee898f54fa734fc87.evidence-v3.json
[R244970]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/244970/versions/c020fe3366d7bce9a764c9d2d45fd532b4cb4f1deeb1d7add5547858cbdbf796.evidence-v3.json
[R176827]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/176827/versions/c78fc11aa3464b40c41ede1d525e01bf7f54a39d86fff3c775e983991a5708b0.evidence-v3.json
[R176831]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/176831/versions/0f13be479736d22bb9f0c0fa111c5ceb67f1150e69ec53755af975b46291d4a0.evidence-v3.json
[R176839]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/176839/versions/7880a7b688575b97be09398432346cd2bc71fc0782ef95314189951e06829df7.evidence-v3.json
[R177267]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/177267/versions/24ba25e4b5516925550d0e9d2cb096d3b9376c248d3c451c9ceab9a4265ff9eb.evidence-v3.json
[R155906]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/155906/versions/b0cab4f61d2bf3bd75521ae426e7019bac467c3908a6798292ba7cdebac8fb82.evidence-v3.json
[R155157]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/155157/versions/9d891241cb34e707d03c1f2c1a7b301ee93c93646ed13beab684044a2328ec38.evidence-v3.json
[R181058]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/181058/versions/a785c56ce7dc9ba7770ddb7c534cf85e721360f1b23d380371dd2dd2e5b2b1b8.evidence-v3.json
[R244919]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/244919/versions/50af9c81b181176e6fb7cd74ce76898d86c45f6f764b5481c70fc68688be18fd.evidence-v3.json
[R244811]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/244811/versions/b9e21c672c967f568cd0a8c635f335ccc6f1a0f338c7753b23b0368b5d2eed93.evidence-v3.json
[R150915]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/150915/versions/caf32d77463864cde7abd15b7c6841b510185597baf148c573d37c6d4784dd32.evidence-v3.json
[R159489]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/159489/versions/4de7ba47e9b0797b5a9cc5b79ad4157c125651c801de6f5e27980cf13a39a873.evidence-v3.json
[R159495]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/159495/versions/f64063fd3893a5fb986dc1c1ef3d8d67826c251dd91074c66f578c8ac97e52fa.evidence-v3.json
[R159497]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/159497/versions/b2d05e202fb99bb36d062dce1d70ef5ddec4267f3be1e4e4c87f3d896d34d497.evidence-v3.json
[R159506]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/159506/versions/730f5f1c3b4e9239eb348538a10bbeebf0d83122e5f243c6709d22f5929fb09b.evidence-v3.json
[R159498]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/159498/versions/b30726989b53645d5e59332157b8e1a2b937c58fde53b48a0531eb88aa5ae5c4.evidence-v3.json
[R188414]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/188414/versions/da6ceb0dad005e5cbe58639332bf0380367cbc39786e65eaec8269edddb34309.evidence-v3.json
[R188419]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/188419/versions/3cb0a48b133cb0a3454e7dbf2478a3c423becebb39f1456bdc9732ff23930cd5.evidence-v3.json
[R160795]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/160795/versions/3b47fe6db3620d4bd01d0066485949a875f975bdea0464cbc3423f84a76b1692.evidence-v3.json
[R163286]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/163286/versions/cb2b9f1909f4ce12afb73d993e47198f7ac37185f16cc7767d8143ff611b2895.evidence-v3.json
[R149570]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/149570/versions/4ec2af0cb9521e619ffb569cb6c25d3d761566e2b3e72aba08b17c45b1b0e4b6.evidence-v3.json
[R218601]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/218601/versions/5c795ab1f5d543abbd794f3f51023c97550910da8d0a2dd6419a57e7af60c3bb.evidence-v3.json
[R163077]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/163077/versions/04beff306b3e13fffdd9d4fcad4dbc425ae264c16cdf029e3aca3de9c1a316e4.evidence-v3.json
[R143860]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/143860/versions/debd21d56ba0ce3f9445b0d74719013c692e2c68716b4f36d8db5abe54b40df5.evidence-v3.json
[R200078]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/200078/versions/f8035b40370ea23eb3360fa7dc7ac5b8ebdad7bbf07f4429f10f2d84c25164d0.evidence-v3.json
[R206952]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/206952/versions/c0881b8dd114b3334a09e67017f6c25162f513d9b8fa21ee869cbe3d6f1f7bc9.evidence-v3.json
[R236759]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/236759/versions/e179a7f5a5d9aea44556d1bab6b2393409ff1c0524c4c667cca5b05e63dbca36.evidence-v3.json
[R176330]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/176330/versions/c9763fb10152545e4c88b30b9c5ed278b75bafff150f988ad1cb1fa2255d7ead.evidence-v3.json
[R176360]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/176360/versions/f00f9eef239388b9487cc3cf5de7181a8ec19fcc68c0d6c6a3cdb33d89e40aa1.evidence-v3.json
[R164723]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/164723/versions/89f4560ff962cef40bd45b788a0e0fff54c5df53f8c403ec7e0b4a920ea9692d.evidence-v3.json
[R172823]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/172823/versions/adc9858ead0b8b0b0619e46961584bbe46a7f0557974d118c3957ab04f3c24e0.evidence-v3.json
[R172848]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/172848/versions/19172d09dbcb37811643e1306d312e97d4eae05d6d2083bbb68fb3cb59684cdb.evidence-v3.json
[R175782]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/175782/versions/77e6eba11e478171c2fed2cfdeae66135e9d921061ad87264b5448ccb2edb828.evidence-v3.json
[R175843]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/175843/versions/f6c10a32aea617f117d841740bdfeec556a67b22fa7515b3a1cdb6e84eadc61f.evidence-v3.json
[R175878]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/175878/versions/d49f81cec4f18fdc4445213c9f3aefd1243607f78108ed534660355d9a0a7041.evidence-v3.json
[R155160]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/155160/versions/be2ac69ed5591a61fc86b479af354e9bdbf2a0059bba11cd9f4a41a6d8af4b9e.evidence-v3.json
[R176548]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/176548/versions/08932dff3b15466c9e13b0720f2fc82a7b3baa2aa62e7f7cb692d4de8c9c880a.evidence-v3.json
[R182209]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/182209/versions/72577de16bf7a4714bf7b062142f4f78238c029b2794c136ae6c93035c991dd9.evidence-v3.json
[R182230]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/182230/versions/b9df2457174be99c5cb5683792dbce109f44ec853362847b8f47a1add339b655.evidence-v3.json
[R194609]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/194609/versions/784f56dd99a80170d0e32e530d87a5fd437fca8a9c5a03f143201b7176288316.evidence-v3.json
[R177526]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/177526/versions/443da63c3bd0440754bce1cfb7c0ca8206a43eaf9b8229fd7bfef10d1072922c.evidence-v3.json
[R178749]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/178749/versions/721dacf0457c0dc2f0c47ffc018ad80695b0a71163c44bd92a49466dfa1be714.evidence-v3.json
[R178766]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/178766/versions/8b0396de065ff944f69cb5d4d42f935a6e8da1dfe87ddf30a57cfd1fffb0b276.evidence-v3.json
[R178769]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/178769/versions/6a0a69490c357f71de0395ba8cc1c4fa57660d9093a2cadbb327d35858776681.evidence-v3.json
[R180145]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/180145/versions/e0bf7da8960f87f96f51c55702747dff153a20832538a4d24c69847f48e45923.evidence-v3.json
[R180307]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/180307/versions/689c900a4f17557cad4d7c419c16cee6f56a8f3063fed09f43077aa90cc087fd.evidence-v3.json
[R191254]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/191254/versions/7b83a7bc3200b6089f097168e4f2018076269c242247cc8fbc4aee114939b431.evidence-v3.json
[R180692]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/180692/versions/458f07ebd47b55558c9d798ae6051d84bd1eefbdb847a6861267ea44041a6082.evidence-v3.json
[R181553]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/181553/versions/18ba572f716a73d70557dc8df8203b9ac318d5098bd5e078a9df6af2d967ee32.evidence-v3.json
[R180700]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/180700/versions/fe49ed0d36d7dc93040317f6227a55c6a572dc8df9a6c0b9949f35dd5323574c.evidence-v3.json
[R180714]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/180714/versions/8744052a5fa620400f67a5caa52b7ebedcb12b27aa9c86b79d8f1ba1e8ec52bb.evidence-v3.json
[R181555]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/181555/versions/f0b4d09450f281ec6892615951c11765cdbb984d841e9bed148bdf621da921b1.evidence-v3.json
[R181556]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/181556/versions/679fa05dcf80c91d0c5d52cbcc62ed2b1a64a00744372fdae8d379a6cf5967d7.evidence-v3.json
[R187506]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/187506/versions/6685dd6cd8f02056bf02ac1f50146d4f8a1b7ccba8a07d10ab89c78bf86bab7e.evidence-v3.json
[R187509]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/187509/versions/45759599382eb3da8b6da93fbc153f57d64db24a03896d7248476095543cd14e.evidence-v3.json
[R148697]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/148697/versions/59e8e9be82574348a0b966644435c48d7e3f0d357ddf97b9b53570bd681bd268.evidence-v3.json
[R219735]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/219735/versions/32d73db3f8bdad22488ef73cf3075bd1871b1db8503826741796e731ff1ffffc.evidence-v3.json
[R155118]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/155118/versions/1e134be88f170ab7e36980423e23ae662fea31d6d12a10000143f3e72ad53e41.evidence-v3.json
[R176443]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/176443/versions/4e1388cd4b736c48a694f6afe8fbcb05ef288abf19eb3288bfb0b45e3008544a.evidence-v3.json
[R176525]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/176525/versions/f073b3ff62560eb751e68c865510ae42127c07d1e796ed52a30eda84454709b6.evidence-v3.json
[R155015]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/155015/versions/4229be05be01f837f4038b5cb7ea39fabefcba8c4a04741cafc8d2076fa620c8.evidence-v3.json
[R237113]: E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237113/versions/abdf9f78dd3919597c8b3f6fb9369e2d88bf0d6054a92bd78eaceab2b11d3700.evidence-v3.json
