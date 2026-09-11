# 证券、行情与定价输入：先识别对象，再解释价格、模型参数和计算结果

<a id="market-scope"></a>

这组数据把 TITANS、Libra 及行情来源的证券、产品和市场参数整理成共同对象，供交易、风险、估值、香港业务和监控任务使用。理解它，需要分开四件事：证券是谁；哪一天、哪个批次观察到了什么价格；定价模型应使用哪套曲线和参数；上游计算引擎已经算出了什么结果。相同证券可以同时出现在这些对象里，但它们的行粒度、日期和单位不同，不能仅凭统一证券编码直接合并成一张事实表。

本页完整覆盖固定 [task-catalog](../evidence/task-catalog.json) 中 `topicName=PDATA_NEWS_N` 的 **78 个任务、156 个 SQL 槽位、7,443 行**，其中有 58 组完整 query hash、51 组完整 create hash，没有 finish 槽位。发布图中 77 项有投影，涉及 47 个不同目标表名；219012 虽无发布写绑定，仍有完整策略指数 SQL，单独解释。日批与重复任务共享解释的前提是完整 SQL 相等，同时分别核对 create。本页不是整个公司的行情制度或全市场资产目录；11 个额外消费者只用于证明这些输入怎样被使用。每项任务、全部槽位 hash、正文位置和剩余问题见 [市场逐项证据账本](../evidence/market-review.json)。

证据固定为版本 `df6f0ae4…9e23c3`，manifest 时间为 2026-09-07 06:05:52 UTC。“已解释”指固定 SQL 的对象、映射和筛选已经读清，不等于源值正确、生产运行成功或模型通过验收。下文行号将 CRLF、独立 CR、LF 都计为换行，与 catalog 一致。系统背景可回看 [来源与系统](01-sources-and-systems.md)。

<a id="market-identity"></a>

## 证券身份：内部编号、市场代码、统一编码各负责什么

`in_code` 是源系统内部证券编号，`scr_cd` 通常承载 WIND 代码，`secu_id` 是整理后的统一证券编码；`src_sys_prdno` 带来源前缀，却不保证所有表里都拼接同一种 ID。基础证券任务 [103230][E103230] / [103232][E103232]（query 17–209）先读取计算日 `D_REF_INSTRUMENT`，将 EQUITY/GDR 归入股票、FUTURE 归入期货、INDEX/QIS 归入指数、各类期权归入 OPT，并将交易市场 NAS、NYS、ASE 等转为标准写法；未知类别归 OTH，部分空市场归 99。币种通过 TIT 货币字典 LEFT JOIN，没有匹配时币种可以为空，不会自动回退原币种。

接着，任务用证券类型、市场、内部编号及 WIND 代码等生成候选 `secu_id`，再按 `scr_cd + scr_type + mkt_cd + src_id` LEFT JOIN `t02_scr_cd_rplc_info`，优先采用替换编码。这个映射才是本分支显式采用的身份合并依据；不能把相似代码或同名证券自行视为同一资产。最后按 `secu_id、src_sys_prdno、scr_type、scr_cd、mkt_cd、ch_name` 分组做 ROW_NUMBER，保留第一行，所以结果并不承诺“一只证券恰好一行”。前面生成编号的窗口内排序也没有为相同内部编号的重复行提供独立稳定顺序。（103230 query 82–113、134–209。）

还有一项直接影响可信度的边界：[table-catalog](../evidence/table-catalog.json) 将替换映射 `pdata_news_n.t02_scr_cd_rplc_info` 的源对象状态标为 **DELETED**，固定 SQL 却仍引用它。这里能确认的是“发布 SQL 采用了该映射”，不能据此宣称它仍是当前可用的编码治理表，也不能推断本次运行已完成合并。

`t02_tit_scr_base_info` 把两种行放进不同分组。grp01 的 [103234][E103234] / [103235][E103235]（query 17–68）是一条证券属性记录，补入源类别、可见穿透标志、到期日、发行人、GDR 基础证券及转换比例、行业等；其统一身份来自对共同基础表的 LEFT JOIN。grp02 的 [103236][E103236] / [103237][E103237]（query 17–66）是一条源代码记录，保留 `SEC_CODE、CODE_VALUE、UPPER_CODE_VALUE`，同一内部证券可有多种来源代码。两分组中空置的国家、公司、状态等模板列不能当作已采集的业务信息；Y/N 转 1/0 的可见标志遇其他值返回 NULL。

h15 版 [144303][E144303]（query 18–145）读取当日 PB 来源的 `grp_id='h15'`，写回同一 grp01。它与日批有实质差异：统一基础表匹配失败时，用本地生成的身份、名称、市场和币种兜底，并保留源每手数量；日批没有这套身份兜底。因此“日批缺失、h15 有记录”可能来自纳入与兜底差异，也可能来自批次数据变化，不能单凭任务名判断根因。

<a id="market-contracts"></a>

## 证券定义延伸到期货和期权，映射规则会决定是否入表

期货主表 [105612][E105612] / [105862][E105862]（query 19–71）读取当日期货属性，整理标准合约代码、乘数、上市/最后交易/交割日期、交易所和期货类型。它先 LEFT JOIN TIT 证券基础信息，最后却要求 `b.secu_id IS NOT NULL`，所以没有共同证券映射的期货会被排除。补充表 [105745][E105745] / [105746][E105746]（query 19–52）采用相同入表门槛，补交割月份、源数据来源、交易代码、英文简称等。补充表 DDL 新增的涨跌停、手续费、当日结算价、交易单位等列在此 query 中仍全填空，不能因有列就宣称已覆盖。（105745 create 16–27、query 35–46。）

[144301][E144301]（query 19–71）使用 PB 当日 h15 期货属性，写同一期货主表 grp01，并保留映射非空门槛。日批和 h15 都不是“把源期货全收进来”。字段叫 `undrl_secu_id` 也应看赋值：这几个期货分支保留的是源标的标识/代码语义，不能自动等同证券共同主表的 `secu_id` 命名空间。

场内期权 [176204][E176204]（query 15–62）保存合约、标的内部编号、看涨看跌、行权价、合约单位、交易/到期/行权/交割日期、最小报价单位及行权方式。它对共同证券表 LEFT JOIN，未采用期货的映射非空筛选；源交易标志被保存，未按标志过滤。境外期权代码映射 [218469][E218469]（query 14–43）保留源交易代码、境外期权代码、市场识别码、BB_ROOT 和启用标志，也没有在输入层只留启用行。

启用条件是在实际消费者中落实的：[234508][E234508]（query 52–66）用映射的 `whth_enable='Y'` 和 BB_ROOT 内连接境外行情。普通分组要求报价日等于计算日且最新成交价非空；grp04 则要求最近结算日等于计算日且结算价非空，并把结算日期/价格作为输出报价日期/价格。代码映射、是否启用、当天有效价格是三道不同条件。该导出还按报价日期先删除目标对应日数据；静态 SQL 只能证明这套选择与写入准备，不能证明下游已收到。

<a id="market-pools"></a>

## 标的池和标签表达选择范围，不能替代准入决定

[127897][E127897]（query 17–53）把源证券标签的 Y/N 转成 1/0，涵盖指数成分、商品/原油期货、两融及互联互通等标志；其他值为 NULL。它保存标签，不根据这些标签过滤证券，也没有在本层执行交易准入规则。

标的池属性 [158210][E158210]（query 14–51）以源证券内部编号产生记录标识，读取报价系统代码、标的分类、交易与报备场所、最后交易日、收盘价发布机构/参考网页、保证金 L/H 参数、风险等级和池编码，再 LEFT JOIN 证券身份及 OTC 类型字典。这里保存“从哪里取价”的配置，不实际访问网页或计算价格。PB 版 [158292][E158292]（query 14–51）读取当日 `exchange_titans_to_sps` 分组，仍覆盖同一目标 grp01；它没有显式时点字段可让读者同时保留多个批次。

白名单 [171427][E171427]（query 16–55）的一行包含证券、业务方案、交易对手、实例、池以及初保线、维持线、基础保证金率，另保留 `src_busi_date`。记录编号拼接证券与方案 ID，但没有分隔符；若 ID 长度不固定，编号唯一性还需要源合同支持，SQL 本身没有约束。PB 版 [221125][E221125]（query 16–55）从字面分区 `busi_date='h1230'` 取数，写目标 `time_flag='1230h'`。这两个字符串与真实业务日是不同维度，不能拿 h1230 当日期。

受益人持股“比例表” [208603][E208603]（create 1–21、query 8–39）实际没有比例字段：它输出受监控证券的内部身份、名称、WIND 大写代码及创建信息。实际消费者 [208230][E208230]（query 64–169）把它当**监控标的清单**，再从客户受益人/持有人资料、存续合约规模、证券总市值、上季度末股东资料计算持有比例，并筛选合计大于 3。不能将本输入表描述成“已经计算好受益持股比例”，也不能把这条实现直接等同监管完整口径。

策略指数 [219012][E219012]（query 16–80）整理策略证券及其标的、初始价格/点位/日期、当前数量、有效数量、版本和源业务日。两次 LEFT JOIN 证券主表，币种字典只约束 `src_id='TIT'`，没有另约束字典类型；若同一码在多种类型出现，会放大行数。这个任务有 create 和 INSERT OVERWRITE SQL，却在发布图里没有 `finalWrites`；本页可以解释源 SQL，但目标绑定仍记为未解决，不能冒充已接通的图路径。它也没有计算策略指数收益。

<a id="market-products"></a>

## 产品、票据、底层资产和篮子组成一组关联对象

[160750][E160750]（query 15–55）以产品 ID 保存发行部门、账簿、内外部代码、销售/起息/到期/结算日、名义本金、发行数量、面值、发行与到期价格、结算币种、认购边界及已认购结果；[160751][E160751]（query 15–42）以产品与票据关系保留票据 ID、序列、交易方式、名义本金、发行数量/价格、利息与赎回基准和 ISIN。前者是产品头，后者是票据条目，不是证券每日价格。票据的 `accum_scrp_amt` 来自源 `NET_PROCEEDS`，名称与本地“累计已认购金额”注释之间的会计含义仍应由源口径确认。

底层资产 [160753][E160753] / [211486][E211486]（query 15–40）把产品 ID 与底层证券内部编号、统一证券编号、内部交易流水相连；它保留一对多关系，没有聚合为一产品一资产。财务交割如何使用产品与资产关系，见 [财务与估值](07-finance-and-valuation.md)。

篮子有两层：[176353][E176353]（query 14–27）整表覆盖 `nds_ref_basket_constituent`，每条保留篮子内部证券编号、成分内部编号及权重，没有统一证券映射或权重归一化。期权合约篮子 [104478][E104478] / [104481][E104481]（query 14–43）则从合约篮子视图保留合约、内部交易、篮子类型、成分权重、账簿及部门，并分别映射合约和成分证券。它的 `src_sys_prdno` 拼接的是**合约代码**，不是证券内部编号；不能用“所有 TIT- 前缀均可直接连接 in_code”的规则接续。SQL 没有强制篮子权重和等于 1，也没有计算最差/最优成分的期权价值。

<a id="market-prices"></a>

## 价格与汇率：观察日期、单位及源分组比“每日行情”表名更重要

六个任务 [104663][E104663]、[104933][E104933]、[144020][E144020]、[144022][E144022]、[183785][E183785]、[208352][E208352] 的 create/query 完整相等。它们向 `tyzx_exch_quot_h_fk` 的 TIT/01 分组写行情，读取源行情时**没有业务日期筛选**（query 13–71）。输出 `busi_date` 是计算日，`trd_dt` 才来自 `QUOTE_DATE`；不能因为任务名带 h10、h8 或每日，就把全部行当作该时刻的新报价。证券身份先用 TIT 内码映射，失败再用 WIND 代码映射 WD 证券；币种却只取 TIT 映射，没有对应的 WD 兜底，因此可能“有统一证券编码、币种为空”。

源开高低收、昨收、成交、复权字段、买卖报价、结算价、持仓量、净值、市值及 VWAP 等直接传入，本层不重新计算复权或市值。create 13–26 明确保留混合单位：涨跌对场内期权/港股期货是价格变化，对其他类型是百分比；成交量可能是股、张、千克或手，持仓量也区分张/手。没有合约单位与品种条件，跨品种求和并无共同物理含义。

[144765][E144765]（query 13–67）写另一个 `tyzx_exch_quot_h`，不能与前表混为同一报价合同：query 22 将 **`close_quote` 写入 `pric_high`**，开高低复权部分字段为空。这里记录的是固定 SQL 的具体赋值差异；是否为应修缺陷仍需维护方确认，不能静默把它解释成真实最高价。

中间汇率 [105616][E105616] / [105863][E105863]（query 19–37）读取当日 RMB 中间价来源，把源币种映射成代码，另一币种列固定为 156，价格直接取 `MID_RATE`。日批记录编号拼报价日与币种；h15 的 [144298][E144298]（query 19–37）读取 PB 当日 h15，记录编号为空，并在字典缺失时使用特定币种例外或原始代码兜底。此处没有取倒数、币值基数换算或两币种互换；仅凭列注释“本币/外币”不能确定一单位哪种货币等于多少另一货币。

利率指标 [165804][E165804]（query 17–49）读取当日 CBOND RATE，以证券与报价日期形成记录，明确做 `RATE * 100`，输出列注明百分数。h0830 的 [239826][E239826]（query 17–49）读取 `_P` 的 `busi_date='h0830'`，目标 `time_flag='0830h'`，映射改用 TIT 证券属性 grp01，也保留乘 100。香港消费者 [181104][E181104]（query 20–43）读取日批 TIT/01，保留输入的业务日、报价日和利率，没有再次乘 100；不能替换为 0830 批次而不审查日期及映射差别。香港其他日期约定见 [香港业务](10-hongkong.md)。

几个名字相近的价格对象必须分别使用：基金/产品净值 [207284][E207284]（query 17–46）按证券与报价日保留单位净值、净资产、虚拟净值、结算/收盘价格和成交市值；限售股折价 [228593][E228593]（query 15–49）按证券、报价日、解禁日保留折价及估值参数/结果，来源没有业务日过滤；期权行情 [139409][E139409]（query 16–54）实际来自重置报价，`OBSERVATION_DATE` 是观察日，`RESET_VALUE` 写入 `sett_pric`，普通开高低收、成交量等列全为空。它们不是三套可以互相替代的现货收盘价。

<a id="market-curves"></a>

## 利率曲线由定义、行情点和外部曲线标识拼接

曲线行情 [103198][E103198]（query 18–41）读取当日收益率曲线源分区，保存曲线 ID、报价日、期限、到期日，以及 YTM、即期、远期和收益率值；一条曲线可有多日期和期限，`rec_id` 仅为曲线 ID，并非点的唯一键。收益率直接复制，前三种列注释为百分数，并没有前述 CBOND 的乘 100。

曲线定义 [103203][E103203]（query 18–53）以曲线 ID 保存币种、插值、日历、日期调整、计息、付息频率、利差类型、曲线类型、报价来源和行情引用 ID；这些是模型输入规则，SQL 没有实施插值。grp03 的 [172069][E172069]（query 18–50）保留外部 WIND 曲线 ID、代码和名称，大量通用规则列为空。定义的内部 ID、引用行情 ID与 WIND 曲线 ID各有作用，不能把三者统称“曲线编号”后按任一列连接。

实际拼接见 [155160][E155160]（query 43–62）：行情 TIT/01 内连接定义 TIT/01，以 `定义.curv_id_src = 行情.rec_id` 匹配，再按行情 rec_id LEFT JOIN grp03 补 WIND 名称。未被定义引用的行情点会被内连接排除；本查询不按行情日取最新一条，也不限制只有一条定义引用某行情曲线。一条行情被多套定价定义复用是可表达的情形，不应在整理知识时擅自去重。

<a id="market-surfaces"></a>

## 波动率曲面、点值和定价环境选择是三层数据

曲面定义 grp01 的 [103242][E103242] / [103243][E103243]（query 19–55）保存曲面 ID、标的身份、曲面类型、生成器、插值、日历、行权坐标、计息、到期类型、模型和时区；它的行权价/期限/数据集合列为空。grp02 的 [103245][E103245] / [103246][E103246]（query 19–52）则保留曲面结构的 STRIKE、TENOR、SPREAD，大部分名称/标的/模型属性为空。两种行共享表结构，但分别表达定义与结构点。grp01 将部分 ID cast 为 bigint，grp02 没有同样转换；有前导零等情况时跨组连接仍需要检查实际值。

波动率实例 [103248][E103248]（query 19–36）按曲面 ID、ASOF_DATE、TENOR、STRIKE、到期日保留实际点值 `VOL`。本层把 VOL 写到名为 `intrpn` 的列，并没有运行插值算法；来源也没有日期 WHERE。消费者必须选择曲面日期，不能用任务装载日期冒充定价日期。

定价环境到波动率曲面的选择 [103249][E103249] / [103251][E103251]（query 18–38）保留环境、曲面、标的和 CALL/PUT/ANY；环境到分红曲线关系 [103252][E103252] / [103253][E103253]（query 19–40）保留环境、分红曲线、标的。两者都读取计算日配置并 LEFT JOIN 标的身份，不产生曲线数值。[226617][E226617]（query 17–37）写 `t02_fin_prcg_env_curv` 的 grp02，实际只整理环境自身的名称、类型及创建修改信息，分红曲线、币种、交易类型列为空，不能凭表名宣称有了具体曲线选择。

隐含曲面指标 [240855][E240855]（query 16–47）保留标的 ID、曲面 ID、发生日、期权到期日、隐含远期价格和隐含分红率；既没有实际波动率点，也没有从报价反解隐含波动率。它是与曲面相关的计算输出。

这几层进入估值时仍保留区别：[226067][E226067]（query 20–42）传递环境到曲面关系；[226123][E226123]（query 34–72）同时传递曲面两个分组，并对部分香港股票标的代码补至五位；[226134][E226134]（query 19–41）只保留曲面日期等于计算日的实例点，再用曲面日期写目标业务日；[226709][E226709]（query 21–44）只取环境配置 grp02。因此“同一曲面点存在于公共输入”和“当天估值输出包含该点”之间，有明确日期条件，而不是一条无条件复制边。估值分发后续见 [财务与估值](07-finance-and-valuation.md)。

<a id="market-factors"></a>

## Libra 因子定义把对象和模型规则接起来，数值在另一层

权益因子 [168302][E168302]（query 18–71）读取 Libra 因子定义，把因子 ID、标的代码/名称、币种、交易所与 TIT 证券身份相连；货币走 WD 字典，交易所名称走字典表。外汇因子 [170264][E170264]（query 18–44）保存因子 ID、基准/计价币种和源外汇标的代码，不包含汇率值。两者的统一证券映射都来自 TIT 主表，但源系统产品编号前缀并不一致，权益使用 TIT，外汇使用 LBR；接续必须使用实际键。

曲线因子 [170265][E170265]（query 18–66）保存复利、频率、日算、工作日调整、交易所/日历、内外插、月末规则、允许负利率及分红曲线 ID；货币利率属性 [170648][E170648]（query 14–41）保存期限、到期和计息/结算/日历规则，不包含当日利率。波动率因子 [176350][E176350]（query 16–46）保存因子到波动曲线的引用，以及两个维度的内外插、日算、日历、衰变和风险标签。这些 SQL 整理参数，没有重新实现定价引擎。

Libra 标的数据 [176349][E176349]（query 16–46）保留内部 ID、完整代码、名称、市场、两层类型和币种；源编号用 LBR 前缀，统一身份仍由 TIT 主表映射。它与波动率因子是这里少数按 **busi_date 分区** 的输入，消费者能显式选择同日配置；多数其他表只覆盖来源/分组快照。168302 的发布 `externalReads` 包含字段名样式的伪表项，176349 的发布读边为空，但它们的 SQL 都清楚存在上述真实源与 Join。因此正文按 SQL 解释，账本仍将图接续记为需补核；不能把图中无上游写成业务无上游。

相关性同样要分开“定义了谁和谁”与“哪一天值是多少”。[194512][E194512]（query 14–49）保存 Libra 因子及两个标的/类型，两个 LBR 编号分别映射 TIT 证券；[117794][E117794]（query 14–31）保存 TIT 当日采集的相关性数值、因子 X/Y 和 AS_OF 日期，没有计算相关系数。消费者 [194609][E194609]（query 23–67）只纳入引擎方法 `CORR_DEF_SYNC`，将 Libra 两个源编号去前缀后分别与 X、Y **按方向精确内连接**。即使数学上的某种相关性对称，本查询也没有自动将反向 X/Y 交换后匹配。

波动率数值单位的转换发生在已核读的风险消费者 [176548][E176548]（query 16–153）。历史计算类方法连接 Libra 因子数据，直接取因子值；另一类方法连接当日 TERM 波动率因子、当日 Libra 标的，以及 TIT 波动率实例，以曲线 ID 匹配，并明确 `intrpn / 100`。后者未额外按曲面日期过滤，保留点自身日期。两分支都以内连接纳入指定方法/曲面类型，不能把公共输入中全部 VOL 都当成消费者无条件采用的数值。完整风险计算用途见 [风险与定价](06-risk-and-pricing.md)。

<a id="market-actions"></a>

## 公司行动和日历共同决定事件何时影响合约

公司行动 [188381][E188381]（query 14–71）保留源行动 ID、对象、方式/类型、登记/除息/派息/公告/失效日期、现金与送转配股比例、配股价、拆分比例和方案进度。一条行动可以有子类型及多个对象，记录 ID 由这些源字段拼接后取 MD5，并没有分隔符或空值兜底。它先按内部证券编号映射 TIT `secu_id`，再以**相同 secu_id**连接 WD 主表取公司 ID；这要求两端统一证券身份已经对齐，不是直接按 WIND 代码补公司。各比例和日期仍是源值，本层不对持仓计算应收红利或调整头寸。

交易日历 [161255][E161255]（query 14–183）真正做了计算：读取计算日的完整源日历，每个市场、自然日一行，以 `IS_HOLIDAY='N'` 产生交易日序号，再计算周/月/季/年第几个、首个和末个交易日。周分组以 2018-01-01 为锚按七天划分，不能视为输出 ISO 周序号。交易日的前后交易日由相邻序号找到；非交易日则向前、后搜索严格小于 15 天的窗口，取最近交易日，长假或源日历范围不足可能得到 NULL。源重复日期也未预先清理，窗口序号依赖输入唯一性。（query 16–54、71–89、149–183；create 31–58 为两个辅助表。）

日历市场代码直接保留源写法，证券主表却将 NAS/NYS 等规范化。按“市场代码相等”连两表之前必须确认转换，不能因为中文市场名一致就假设键一致。日历的源日期范围也决定是否能取到未来交易日，计算日分区本身不保证未来日期齐全。

实际作用可在结算异常监控 [181555][E181555] 看到：query 1–25 将自然日映射至当日或之后第一个上交所交易日；query 115–169 将分红/送股行动与存续期权、账簿及已审批公司行动事件相连，在指定除息日、合约期间及分红方式条件下，找不到及时完成事件的合约才进入结果。这里核实的是某一监控消费者的实现，不是“所有公司行动均在下一个交易日处理”的制度结论。

<a id="market-results"></a>

## 同一主题还保存已计算的风险结果，不能误认为定价原料

保证金账户日结果 [104658][E104658] / [104937][E104937]（query 14–46）直接读取交易对手—保证金账户结果，没有业务日期 WHERE。输出计算日、源 `src_busi_date` 转出的保证金计算日期、履保比例、最小履保、应追保、可提取、余额、累计追加/提取、动态名义本金及状态；它没有自行计算追保公式，记录编号也为空。金额列注释为元，但此选择没有币种列或折算过程，不能跨不同源账户币种直接合计。

多标的定价指标分两个分组：交叉分组 [104483][E104483] / [104484][E104484]（query 14–50）保留 X/Y 标的及 GAMMA、UNIT_GAMMA、CEGA、CORR；单标的分组 [104487][E104487] / [104489][E104489]（query 14–50）保留 X 标的、期初/现货价、现货日期、波动点及 DELTA、VEGA、RHO_Q、单位 DELTA/VEGA。对方分组的指标留空，不代表数值为零。[244510][E244510] / [244515][E244515] 从 `_P` 的 h15 分区读取相应结果，仍写同一 grp01/02。它们对证券属性使用 `DISTINCT(in_code,secu_id)` 却没有来源/分组限制；DISTINCT 不保证每个内码只对应一个统一编号，映射多值仍可能放大结果。

场内量化敏感指标 [219014][E219014]（query 16–89）保留期权、标的、源业务日、方向、到期、行权/理论/标的价格、基差、远期、波动率、单位 Greeks 和各项损益归因，分别 LEFT JOIN 期权及标的身份。这些数值直接来自量化来源；SQL 未执行敏感性算法或检验各归因之和等于总损益。另一个名为“期权衍生指标”的 [119465][E119465]（query 14–44）实际将敲入日期、上下涨跌比例及价格写入 remark，Greeks、理论价和隐含波动率列均为空，不能作为替代来源。

子交易 Greeks h15 [245011][E245011]（query 16–125）从风险定价结果 `_P` 的 h15 分区读取交易编号、产品引用、账簿/销售/交易员、币种、方向、名义本金、持仓以及全套原值/基准值 Greeks、现值和敲入结果，不连接共同证券主表。币种仅对 CNY 做显式代码替换，其他币种保留原值；`premium_amount` 被写到本地注释为手续费的 `cms`，不能由本地列名抹掉源字段语义。源 ERROR_COUNT 被保留为错误列，却没有按错误数或交易状态过滤。目标动态 `busi_date` 取 `substr(src_busi_date,1,10)`，一次 h15 批次可能覆盖源里多个业务日分区；它与前述计算日字段的快照写法不同。

<a id="market-time"></a>

## 日期、批次和覆盖方式必须一起阅读

| 对象/任务                      | 实际选择与写法                                                       | 读取时的含义                                                |
| ------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------- |
| 多数证券、曲线、价格、产品输入 | create 按 src_id/grp_id 分区，query 覆盖固定分组；busi_date 是普通列 | 保留的是本次该来源/分组快照，不能自动追溯昨日版本           |
| 103230/103232 共同证券         | 仅按 src_id 分区，经过临时表后覆盖 TIT                               | 合并规则变化可改变整组身份；不是按日追加                    |
| 176353 篮子成分                | 无分区，整表 INSERT OVERWRITE                                        | 原有行由此次源结果替换                                      |
| 144303、144301、144298         | PB 当日数据再加 h15 分组；写回日批共用的目标分组                     | h15 并非目标历史分区，日批与 h15 的先后运行影响最终可见快照 |
| 244510、244515                 | 源 busi_date 字面值 h15，目标仍为固定分组                            | 源业务日另保留在列中，不应把 h15 解释为自然日期             |
| 221125、239826                 | 源 h1230/h0830，目标另有 time_flag                                   | 可以区分目标批次；time_flag 本身不证明真实完成时刻          |
| 176349、176350                 | 目标明确含 busi_date 分区                                            | 可以按日选择标的与因子配置；同日源配置一致性仍须查运行      |
| 245011                         | h15 来源，动态目标业务日取源 src_busi_date                           | 业务日属于源结果，可能与装载日不一致                        |

表中依据为相应任务完整 create/query；全部逐项引用在账本。`rec_down_time` 通常写执行时钟，`rec_upd_time` 有的保存源修改时间、有的写执行时钟。来源日期、业务日期、报价日期、创建时间不能互相替代。PB 查询的 `src_tbl` 字面值有时仍写非 PB 表名（例如 158292、221125、244510），排查实际来源应以 FROM 和 WHERE 为准。重复任务 SQL 完全相等也不代表上游批次、运行参数、调度时刻或最终行集相等。

<a id="market-coverage"></a>

## 从内容回到全范围证据

本页的十个家族覆盖全部 78 项；家族用于帮助阅读，不要求一张表只属于一个业务过程。逐项账本对 75 项记为 EXPLAINED；168302、176349 的 SQL 已解释但图接续不完整，整体记 LOCATED；219012 的发布写绑定仍为 UNRESOLVED。这里没有以“发布成功”替代内容验收，也没有以一个家族的代表 SQL 替代其他任务的不同 create 或分组。

| 家族              | 全部任务                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 证券身份          | 103230、103232、103234、103235、103236、103237、144303                                                                 |
| 证券合约/境外代码 | 105612、105862、105745、105746、144301、176204、218469                                                                 |
| 标签/池/策略      | 127897、158210、158292、171427、221125、208603、219012                                                                 |
| 产品/票据/篮子    | 160750、160751、160753、211486、176353、104478、104481                                                                 |
| 价格/汇率/净值    | 104663、104933、144020、144022、183785、208352、144765、105616、105863、144298、165804、239826、207284、228593、139409 |
| 收益率曲线        | 103198、103203、172069                                                                                                 |
| 曲面/环境选择     | 103242、103243、103245、103246、103248、103249、103251、103252、103253、226617、240855                                 |
| Libra 因子/相关性 | 117794、168302、170264、170265、170648、176349、176350、194512                                                         |
| 公司行动/日历     | 188381、161255                                                                                                         |
| 已计算风险结果    | 104658、104937、119465、104483、104484、104487、104489、244510、244515、219014、245011                                 |

本范围未验证的内容包括实际源记录唯一性、字典多值、单位是否符合源合同、任务运行顺序、目标当日可读行数及业务制度正确性。它们各有具体落点：代码合并、篮子权重、汇率方向、曲面日期、因子单位和带错误结果的纳入，不能用统一的“SQL 已读”状态消除。图中未列消费者的表，也只能说本发布范围未定位到消费者，不能说现实中无人使用。

[E103198]: ../../../../sql-static-lineage-data/task-projections/tasks/103198/versions/9caa116ecc4ef44aec93ec420d3fba53ed405d573ec345f0b50f55530b1ffd90.evidence-v3.json
[E103203]: ../../../../sql-static-lineage-data/task-projections/tasks/103203/versions/f9045a633b8fd6843391abe3835cf70ec73dfe95f307dc1d498efe448093764b.evidence-v3.json
[E103230]: ../../../../sql-static-lineage-data/task-projections/tasks/103230/versions/596e2e2f3fc5be88024c6ab5d2187ae32b575c25b6f911ca0717e678548bcb6b.evidence-v3.json
[E103232]: ../../../../sql-static-lineage-data/task-projections/tasks/103232/versions/d84cad3cbb9fa41c9f2c9703e750f5d4a98b1192f983ad74c2c517319aeedee7.evidence-v3.json
[E103234]: ../../../../sql-static-lineage-data/task-projections/tasks/103234/versions/cf51b5b8d869d4d157da96242f414f73840432148e1ed2be5eeb5575c72c3bba.evidence-v3.json
[E103235]: ../../../../sql-static-lineage-data/task-projections/tasks/103235/versions/2c477f49233c5bb83990350a3cb961024be531372496d2c49af43f8bec63f096.evidence-v3.json
[E103236]: ../../../../sql-static-lineage-data/task-projections/tasks/103236/versions/caf7458d4328ea965d5380809c1fc782ddcb5d2a3384bcc7ca37ae43a92be6d5.evidence-v3.json
[E103237]: ../../../../sql-static-lineage-data/task-projections/tasks/103237/versions/663c6431b801c49148b2f343683de4f47ba22a207fe0ecd12ece651e524a45b0.evidence-v3.json
[E103242]: ../../../../sql-static-lineage-data/task-projections/tasks/103242/versions/0d4d7bee5602c365c4a30d903e0e5bc836b740ba199d390d21b9bbc9087e1754.evidence-v3.json
[E103243]: ../../../../sql-static-lineage-data/task-projections/tasks/103243/versions/dd117c9c47a9de89e393c8f77245a61cdb329d31ba93be99593b29d3d28bb67f.evidence-v3.json
[E103245]: ../../../../sql-static-lineage-data/task-projections/tasks/103245/versions/cc89c1d1d6f887b55f918857b2346ee92d983d228f8279782d7551c6feeaf390.evidence-v3.json
[E103246]: ../../../../sql-static-lineage-data/task-projections/tasks/103246/versions/5060aa5ff31bbb0e95ad4f41196659f3d2f70c1dfc52ec123f88ae73d74b40ab.evidence-v3.json
[E103248]: ../../../../sql-static-lineage-data/task-projections/tasks/103248/versions/78f151f90ee0f8597d3faf44ede75d0cea264ac5fc9c15e10a90d69cdb9f8489.evidence-v3.json
[E103249]: ../../../../sql-static-lineage-data/task-projections/tasks/103249/versions/070a4eb79bffb21fc7b852044d885b54a38da25e1d190cae35a9e9473333f23a.evidence-v3.json
[E103251]: ../../../../sql-static-lineage-data/task-projections/tasks/103251/versions/028850d085b08b2078c958cc7d8f9fe590dd4dc2016eec1d9ebf0cf882fa5a56.evidence-v3.json
[E103252]: ../../../../sql-static-lineage-data/task-projections/tasks/103252/versions/97a1a9dedab6cb5f5b222aeee145bf25c016b69cbd1137781ada5b7a6345c3d9.evidence-v3.json
[E103253]: ../../../../sql-static-lineage-data/task-projections/tasks/103253/versions/ad8523a387e92ab73268496c3e1575dfe48683bdb990deec268a478822fa8895.evidence-v3.json
[E104478]: ../../../../sql-static-lineage-data/task-projections/tasks/104478/versions/67d700b13e50199725fde3efe74406ccec683e35ade07e659d13208ec95bb8e0.evidence-v3.json
[E104481]: ../../../../sql-static-lineage-data/task-projections/tasks/104481/versions/a98349283a225a5d3c8d8245b5f5da58e283d276f33adb3228dacfe638104112.evidence-v3.json
[E104483]: ../../../../sql-static-lineage-data/task-projections/tasks/104483/versions/42c6e54fb2c1512ac301a3276118be59cddb0a661b600bf5e1f7a9e20a71511a.evidence-v3.json
[E104484]: ../../../../sql-static-lineage-data/task-projections/tasks/104484/versions/d7ac4dbbbd9d9c3442d6a855d9809a0197e19d4ef3b8f5d7bf036a269183bc38.evidence-v3.json
[E104487]: ../../../../sql-static-lineage-data/task-projections/tasks/104487/versions/42bf26c21251b854dc649186f31093ae93bd8eea6c6f487fe4100dd5ee6b6b85.evidence-v3.json
[E104489]: ../../../../sql-static-lineage-data/task-projections/tasks/104489/versions/275419ed27b3a27b4355c162de930375902d2cd3639686e1b618a0e68361690b.evidence-v3.json
[E104658]: ../../../../sql-static-lineage-data/task-projections/tasks/104658/versions/9fcf101fb77e1dcc08a41ca98d4b60a61da2d84642caacaa1cd46575c918bbc9.evidence-v3.json
[E104663]: ../../../../sql-static-lineage-data/task-projections/tasks/104663/versions/c8b57dab1d5bb695a3b89827c279cfb58e8fdd1c27d10b374b8d00ba2fd91ee5.evidence-v3.json
[E104933]: ../../../../sql-static-lineage-data/task-projections/tasks/104933/versions/e1d26c31a095e8d05ac121d5616f877be531f41f2c4438cfeb0e460541ba02ac.evidence-v3.json
[E104937]: ../../../../sql-static-lineage-data/task-projections/tasks/104937/versions/00060babc027b53881ccbe42622b7bc9c6708d72be2df638d6e09b48a3ab3f5a.evidence-v3.json
[E105612]: ../../../../sql-static-lineage-data/task-projections/tasks/105612/versions/b389e76a43b463265b6741a486cbf38ef02e01ef03db988f878899f01757c652.evidence-v3.json
[E105616]: ../../../../sql-static-lineage-data/task-projections/tasks/105616/versions/9a3d6a7904621ea9fb202b79dc7a338522dfdfb8bf12e533474d0da24bec827e.evidence-v3.json
[E105745]: ../../../../sql-static-lineage-data/task-projections/tasks/105745/versions/c7edace6103df2f2315ae88968db6501a67a58cf5f018533e230a3b650629864.evidence-v3.json
[E105746]: ../../../../sql-static-lineage-data/task-projections/tasks/105746/versions/9c7fd717be2d9eae54bf10188196f8c2575633434f5777773ed424f1ab124e03.evidence-v3.json
[E105862]: ../../../../sql-static-lineage-data/task-projections/tasks/105862/versions/3cd27566d554e51c226e0ff8c7f29643b3a6e22ce49ecce81890761265eb51d3.evidence-v3.json
[E105863]: ../../../../sql-static-lineage-data/task-projections/tasks/105863/versions/bae30d8cb586f0efec8635fb15945b2a7a92a90eb4ddfd252fc29f9c70a3fe50.evidence-v3.json
[E117794]: ../../../../sql-static-lineage-data/task-projections/tasks/117794/versions/6d18a471a519e7e4f905b27a03da18c552fc7a71c181937c8ea1c208ef1453ac.evidence-v3.json
[E119465]: ../../../../sql-static-lineage-data/task-projections/tasks/119465/versions/914e001cd855a5b352c79f2350f25e34f82fea6ae676efaf323002234ebdc152.evidence-v3.json
[E127897]: ../../../../sql-static-lineage-data/task-projections/tasks/127897/versions/ac587d23281088c5c52eed9d4956d57dd47fb589560945b6b7694ed73b7fd675.evidence-v3.json
[E139409]: ../../../../sql-static-lineage-data/task-projections/tasks/139409/versions/3c646525e0fb43bb714e9c2e8c9a7f4c6c38b87a6672e1dfb524d011c97e6615.evidence-v3.json
[E144020]: ../../../../sql-static-lineage-data/task-projections/tasks/144020/versions/d29ce2f139b52767ac935319a020f2bc773ba6fba4ea22db0e51da529a1a4319.evidence-v3.json
[E144022]: ../../../../sql-static-lineage-data/task-projections/tasks/144022/versions/74c3ae575473afa71d7a90057e1ac1bbda764865ec22dd14fe6b2e5b6212886d.evidence-v3.json
[E144298]: ../../../../sql-static-lineage-data/task-projections/tasks/144298/versions/ba293c6a42ece99065f1630676cbb40ded5be47f43da169936dd0c0f5397ae6d.evidence-v3.json
[E144301]: ../../../../sql-static-lineage-data/task-projections/tasks/144301/versions/9de84c9a999557e9c847d657869ac8e961dfbd08790fd9f0347db904493b143b.evidence-v3.json
[E144303]: ../../../../sql-static-lineage-data/task-projections/tasks/144303/versions/2bbd591753611303c6d93c26a1462886819cf71f7d5cef7c43db7c81bcb414b2.evidence-v3.json
[E144765]: ../../../../sql-static-lineage-data/task-projections/tasks/144765/versions/822edcabd769839437e7c2901e53e940f11290e25481974d068b103abab16930.evidence-v3.json
[E158210]: ../../../../sql-static-lineage-data/task-projections/tasks/158210/versions/09c0c59157445db296d21c66e34c80d37a305478d045173715bacfdc15de0b31.evidence-v3.json
[E158292]: ../../../../sql-static-lineage-data/task-projections/tasks/158292/versions/109dc375de204bd7bbe3ffee7c416fb2b69a701c4e455ff9b3a3456658a0324f.evidence-v3.json
[E160750]: ../../../../sql-static-lineage-data/task-projections/tasks/160750/versions/30b0d1729cc4a35d21c351b06cde362f1168b411441e9814cb7af8ecf8e7c1fe.evidence-v3.json
[E160751]: ../../../../sql-static-lineage-data/task-projections/tasks/160751/versions/028c9c76be4e3811ac0cfbb593c30d2211dc0af76db3e89243ae116fed7963ce.evidence-v3.json
[E160753]: ../../../../sql-static-lineage-data/task-projections/tasks/160753/versions/77abf6b43e56c824fc0fca5b2f7b3c09b311ec70b6d89e5f7e79f60f7082a995.evidence-v3.json
[E161255]: ../../../../sql-static-lineage-data/task-projections/tasks/161255/versions/89afd596f751d991edded17e81d9d933cd6050e1931f32713268141dc1a5bd86.evidence-v3.json
[E165804]: ../../../../sql-static-lineage-data/task-projections/tasks/165804/versions/4a580b372b596283f2ca2bed2e8f6e109e20de5f53e9f85d78340848ddb96990.evidence-v3.json
[E168302]: ../../../../sql-static-lineage-data/task-projections/tasks/168302/versions/cb1f1797d94d9cdb363834b16babc1f6b7eaf6bca6ccf5485189055f6eff3355.evidence-v3.json
[E170264]: ../../../../sql-static-lineage-data/task-projections/tasks/170264/versions/0334b9561ad5e95b22a2395acedacf87439d15ffaad970ef05de25d0d184dacb.evidence-v3.json
[E170265]: ../../../../sql-static-lineage-data/task-projections/tasks/170265/versions/8e2e5e8b537696b35c8b17dcf2f95148d5cfaf314dd8a2e9e27344965ed83e95.evidence-v3.json
[E170648]: ../../../../sql-static-lineage-data/task-projections/tasks/170648/versions/e7619b19b419e9f3af27a55b667caf2aee340285d5ebef790e33aa3f80bb0d9c.evidence-v3.json
[E171427]: ../../../../sql-static-lineage-data/task-projections/tasks/171427/versions/c09d2471b0d0b064275490b020979ce6785df6479ee45b0fcf44d7d195465f62.evidence-v3.json
[E172069]: ../../../../sql-static-lineage-data/task-projections/tasks/172069/versions/6ada321f3aaa32c4d8f0f0806271d77c48a6741b391d131987c09619f22bb36d.evidence-v3.json
[E176204]: ../../../../sql-static-lineage-data/task-projections/tasks/176204/versions/381c3d0605bf23617245048d3e70d708afdb375e13312a325238a9bbfbdfedae.evidence-v3.json
[E176349]: ../../../../sql-static-lineage-data/task-projections/tasks/176349/versions/447cd2738149fc26e69f9ced6d73b5b3da55b7c14e66afe63a1d90e26ebecd1a.evidence-v3.json
[E176350]: ../../../../sql-static-lineage-data/task-projections/tasks/176350/versions/3ae8b35c6d777d2991c3ef4cdee0b336566a5b0b62871aa3b5582af9b185cbbf.evidence-v3.json
[E176353]: ../../../../sql-static-lineage-data/task-projections/tasks/176353/versions/5ec18261731e2e2e79ae52cf557e5a1e2e87ed743707c88195dbe02aef6af73c.evidence-v3.json
[E183785]: ../../../../sql-static-lineage-data/task-projections/tasks/183785/versions/0641e22063054fb0b223218ab6c456e54370cf44ec0f0b47032e3cfdb3c3e97c.evidence-v3.json
[E188381]: ../../../../sql-static-lineage-data/task-projections/tasks/188381/versions/1e23e58742f4f0aa1697b224ba8cfa9d5e1a2d93e4a7bd39b0bb5a56e5fe414e.evidence-v3.json
[E194512]: ../../../../sql-static-lineage-data/task-projections/tasks/194512/versions/cd7cadafd1844d6ee22cf105548d948af1f1fc13fe7771b411a40d433d6d9a1f.evidence-v3.json
[E207284]: ../../../../sql-static-lineage-data/task-projections/tasks/207284/versions/7eaf83d31c4455e99031efc5aff2013849087a813ce2da23cf9c915498c59a08.evidence-v3.json
[E208352]: ../../../../sql-static-lineage-data/task-projections/tasks/208352/versions/0f66ed9fd2cd11f37bbf4e98769f39c0485b5460e42f689872f8050f36992cf5.evidence-v3.json
[E208603]: ../../../../sql-static-lineage-data/task-projections/tasks/208603/versions/644a667dbeabc5d0097e89400f1c9ab93fcfc19f3b5ea7b0122f20097b567c7e.evidence-v3.json
[E211486]: ../../../../sql-static-lineage-data/task-projections/tasks/211486/versions/2a8996480836b6462387215bce75cde400ea9d49a8f5ccf88aa479a02b5e2652.evidence-v3.json
[E218469]: ../../../../sql-static-lineage-data/task-projections/tasks/218469/versions/a9470caf18adae2ea530478f6316ba7335b27c2ae1ff6d9d87bf40d01a88afd3.evidence-v3.json
[E219012]: ../../../../sql-static-lineage-data/task-projections/tasks/219012/versions/bb8b73993121df181271c8ebdfc91ae6e38bf032e42f8fff3f2e2ac2c9d0ad48.evidence-v3.json
[E219014]: ../../../../sql-static-lineage-data/task-projections/tasks/219014/versions/f7ca45dbe98aab6773c3ae719b70f0854b91f9d0f91c7787e6fae9486bd2660e.evidence-v3.json
[E221125]: ../../../../sql-static-lineage-data/task-projections/tasks/221125/versions/0ebf77067acfd692a746a0ef1dff9fce7d7d6dce712d6d5a18bc6dbffe5bace5.evidence-v3.json
[E226617]: ../../../../sql-static-lineage-data/task-projections/tasks/226617/versions/83192287369c4d557ffb55f633f8f9efb27caa35f8daa7b69421f956b4bb8e49.evidence-v3.json
[E228593]: ../../../../sql-static-lineage-data/task-projections/tasks/228593/versions/78df4d450d753a153917f8874664958c08fc43b0c3b611e7cc0754aadde2573e.evidence-v3.json
[E239826]: ../../../../sql-static-lineage-data/task-projections/tasks/239826/versions/30bbf6d68386cf1eb6f5014f9530603ebccbfd7376690690c844ce0345eb76c8.evidence-v3.json
[E240855]: ../../../../sql-static-lineage-data/task-projections/tasks/240855/versions/e49ae434c9694703a833f3eabd088f3334fbffea635ac2b7861d0abb0542e5bc.evidence-v3.json
[E244510]: ../../../../sql-static-lineage-data/task-projections/tasks/244510/versions/c6b9299b08db27ae39b8d7a7576d26d704ed69b7faa36fccc85d6b2d7146e775.evidence-v3.json
[E244515]: ../../../../sql-static-lineage-data/task-projections/tasks/244515/versions/4f7081d90779f9ba377a3a6ae32c2d092dcf8a4a71f5c1e346ce8e1dce0ac631.evidence-v3.json
[E245011]: ../../../../sql-static-lineage-data/task-projections/tasks/245011/versions/44f796f1ec1614b1587764d60043fd2854f5c26424e62f5f0ed623f7880c3612.evidence-v3.json
[E155160]: ../../../../sql-static-lineage-data/task-projections/tasks/155160/versions/be2ac69ed5591a61fc86b479af354e9bdbf2a0059bba11cd9f4a41a6d8af4b9e.evidence-v3.json
[E176548]: ../../../../sql-static-lineage-data/task-projections/tasks/176548/versions/08932dff3b15466c9e13b0720f2fc82a7b3baa2aa62e7f7cb692d4de8c9c880a.evidence-v3.json
[E194609]: ../../../../sql-static-lineage-data/task-projections/tasks/194609/versions/784f56dd99a80170d0e32e530d87a5fd437fca8a9c5a03f143201b7176288316.evidence-v3.json
[E181555]: ../../../../sql-static-lineage-data/task-projections/tasks/181555/versions/f0b4d09450f281ec6892615951c11765cdbb984d841e9bed148bdf621da921b1.evidence-v3.json
[E226067]: ../../../../sql-static-lineage-data/task-projections/tasks/226067/versions/ac7904c8a4bf64dc28d14ec438f734cd06ae4a5e6930b40803f96c67cb536338.evidence-v3.json
[E226123]: ../../../../sql-static-lineage-data/task-projections/tasks/226123/versions/3208194f8ea6f15cde5cf62144d025249c4c8690a649d8cc732948f292a00d8b.evidence-v3.json
[E226134]: ../../../../sql-static-lineage-data/task-projections/tasks/226134/versions/bea2195ae76ae4ba9681dc789f080fd289369ed0a1aacc950d21e030c9f9c267.evidence-v3.json
[E226709]: ../../../../sql-static-lineage-data/task-projections/tasks/226709/versions/a9e5377c32ce58328ca7b4e07601d1d6f98ea308da183c985a2e57875797ceac.evidence-v3.json
[E234508]: ../../../../sql-static-lineage-data/task-projections/tasks/234508/versions/d2f8ac568ed4b7171f807056596e2a5d4c51af8fcc768c0518d10ae8d4f03848.evidence-v3.json
[E208230]: ../../../../sql-static-lineage-data/task-projections/tasks/208230/versions/610408609d37b8381a060d77be9c991123a7c76d1c5bdc3302e4eecd1538b09f.evidence-v3.json
[E181104]: ../../../../sql-static-lineage-data/task-projections/tasks/181104/versions/e818cae6a66c2b8c8ab4b60279126f020f600db6617ef8200f76725399ea2387.evidence-v3.json
