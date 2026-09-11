# 销售归属、标准资产与考核：一笔业务如何成为机构和员工的成绩

<a id="p09-scope"></a>

这里要回答的是：客户持有的资产、发生的交易和产生的收入，经过什么规则，才成为营业部、分公司或员工的考核结果？当前 SQL 给出的主链是“确定业务与归属 → 形成折前资产 → 按类别折标 → 形成日月季年口径 → 算增长、占比和亩产 → 排名赋分 → 形成客户跟进名单”。交易金额、客户真实资产、折后标准资产、员工成绩是不同对象，不能看到同一个 index_val 就直接相加。

本主题原始闭合核心为 topicName 精确等于 DM_INDEX_N、DM_OM_N、DM_CO_N、DM_ECOM_N 的 298 项，加实际写入 dm_co_n.org_cust_week_t0 的 198013，共 299 项。现按明确后处理链增加 EM_OM_N 的 164991、156254、166545，账本合计 302 项；固定发布中 289 项提供 SQL，共 731 槽位、45,402 行。另 7 项使用显式当前 Input Pack 补充 SQL、独立记录 968 行，未替代发布版本。当前 193 项有实质规则解释、2 项仅定位、107 项未解释；EXPLAINED 不表示该任务所有上游、运行和制度已证。

本篇的 EXPLAINED 表示指定规则已在正文解释，仍保留未读槽位、上游定义与运行验证缺口。它不表示任务运行成功、金额正确、制度已获确认。每条脚注定位固定发布 evidence 文件；文中的 query/prepare 行号均指该槽位解码后的 SQL 行号，非 JSON 文件行号。[逐项核读账本](../evidence/performance-review.json)保留全部任务、实际读过的行及未读区间。

业务对象和系统职责可接着读[公共对象](02-public-objects.md)、[来源与系统](01-sources-and-systems.md)；交易估值与本篇考核值的区别见[风险与定价](06-risk-and-pricing.md)、[财务与估值](07-finance-and-valuation.md)。

<a id="p09-sales"></a>

## 1. 先分清交易规模、日均规模与跨销售归属

跨销售成交规模任务 144887 取计算日的 T98_OTC_DERI_COMP_SALE_INFO，按起始计价日在当年内筛选，使用 init_nom_prin，排除 FEE_SWAP、DIGITAL，限定三个产品分组；然后用计算日的 T98_OTC_COMP_MNG_RELA_INFO 取三组机构、员工与分摊比例。它按员工输出年内累计成交规模，并非年内每一天名义本金的累计。154068 把窗口改为当月，输出月份；155410 改为当季，输出季度。这两个变体已逐行对比，差异落在窗口、指标身份和输出时间字段。（144887 query 1–29、32–94；154068、155410 query 16–37）[^144887][^154068][^155410]

三组比例不是简单的“三人各领一份”。例如第一路金额仍乘 allo_prop_1，但当第一机构不满足机构编码小于 8000 的条件，会按第一、第二、第三机构的顺序寻找可归属的员工；第二、第三路有自己的回退顺序。另有全部机构落在特定内部代码组时保留原员工的分支。过滤还包括缺省机构、缺省人员、特定历史合约例外及第二、第三路非零比例；最后剔除空员工与零结果。因而“归属人数”和“比例所在槽位”不能互换。只有比例完整、各来源 Join 不放大、人员映射完整时，才可以进一步检查分摊前后守恒；SQL 本身没有证明这些前提。（144887 query 24–28、39–93）[^144887]

159763/159768 则解释“某交易对手、某机构、某员工、某业务标签”的月内/年内日均规模：合约主表取计算日，附加明细按月初/年初至计算日取 dyna_nom_prin，并限定明细日在该合约起止计价日之内。**历史日金额使用计算日的管理归属关系分摊**，并不是每天都使用当天的归属。月均分母是月初至计算日的自然天数，年均分母是年初至计算日的自然天数；年均结果仍用 busi_mon 落当前月份。两类标签的划分还依赖 FUTURE、币种、部门、特定合约类型和交易对手条件。（159763 query 1–44、63–144；159768 query 23–33、63–144）[^159763][^159768]

示意：截至月第 10 天，一笔业务只在后 5 天每天有 1,000 万动态名义本金，月内平均为 500 万，再按归属比例分配；不是对 5 条有值记录求平均得到 1,000 万。如果今天换了管理归属，用当前快照回算出的历史日均归属也可能一起变化。这是 SQL 的时间选择造成的结果，尚不能据此断言业务是否允许追溯改归属。

公司全量成交规模 171347/171364 是另一条口径：按业务类型、报表合约类型、部门、北上跨境期货及指定债券 TRS 组合标签分别生成公司行。部分分支从互换综合表以原币名义本金和期初汇率折成人民币，并有不同状态、账簿过滤。它们不走员工跨销售分摊。多个标签分支也可能观察同一业务，跨标签全加会重复。（171347 query 1–138；171364 query 1–139，已与年版逐行对比）[^171347][^171364]

<a id="p09-assets-before"></a>

## 2. 折前标准资产是一张归属账，不是一张原始持仓表

148368 的输出主粒度为“客户类组合 × 机构组合 × 资产标签 × 月份”。客户类可包含普通个人/机构客户、OTC 对手、托管产品、线下客户及部分公司占位对象。因此读取 grp_id1 必须同时解释组合类型，不能一概叫“证券客户号”。正文中的“折前”仅指这个加工阶段，并不承诺各上游已经完全没有口径加工。（148368 query 101–316、318–391）[^148368]

普通账户先汇总 index_grp2_cust_org_asset_std_mthaccum_all，按客户、标签、月份合并后除以日历中的自然日数；然后重新分配机构。归属有三个有优先级的来源：

- 异地开户：从客户基本资料取得开户归属；从 T01_CRM_OFST_OACT_CUST_DIV 取已审批通过且通知日期满足截止条件的比例。同客户、介绍机构、日期按通知时间倒序取一条；介绍机构取各自比例，开户机构取 1−介绍比例合计。比例转为两位小数，分组汇总后再做营业部翻牌映射。
- 代销产品户：优先使用“杠杆资产比例 × 机构持有比例”。后一项缺失时按 0 参与相乘，并非回落到开户机构。
- 定向配比户：将比例设为 1，全部归给定向机构，同时有单独的机构代码替换。

实际表达式是机构取 nvl(产品户机构,异地机构)、金额乘 nvl(产品户比例,异地比例)。如果产品户匹配出多条机构、异地关系也有多条，两次 Left Join 的基数需要单独核验；末尾按相同输出值分组并不等价于证明不存在重复分配。比例超 1、有效记录并列、名称变化带来的去重差异，也没有在本 SQL 中被完整防住。（148368 query 2–99、119–224）[^148368]

普通账户之外，折前账还拼入财富相关资产、跨销售 OTC 日均、托管外包、投顾和期货 IB 标准权益。它们各自采用已经加工好的金额/日均，不再统一套同一个分母。财富分支有指定客户向指定分公司改归属；投顾按客户开户机构归属；期货 IB 从文件标准权益按机构汇总，以公司组合占客户维度。（148368 query 227–309）[^148368]

最后用当年 aum_asset_ast_style_cd 内连接筛选标签，保留分类明细，并另造 tag999999999 总计行；再映射翻牌机构、剔除指定考核排除客户与上一年末司法冻结客户、限定当年月份，并要求客户和机构组合有效。因此读取时要在“分类明细”与“总计标签”中选择一种汇总方式；两者一起加会重复。排除名单的一个分支取实际运行日的前一天，而多数业务值取任务计算日期，历史重跑可能混用两种时钟。（148368 query 310–391）[^148368]

<a id="p09-conversion"></a>

## 3. 折后不能简化成“折前 × 一个系数”

148763 对普通股票、信用账户、期权、T0 分别做特殊计算，其余类别才走“折前分类值 × 当年配置表 ast_exam_coef”。该通用分支明确排除普通股票、信用、期权和总计标签；配置采用 Left Join，未匹配系数并不自动变成 1。（148763 query 928–1054）[^148763]

普通股票先判断客户是否属于系数优化客群。企业客群要剔除指定回购和员工持股计划；银行分类与单独维护的客户名单也会进入优化集合。另一集合是回购、员工持股计划及特殊名单，采用 5% 处理。优化先于 5% 分支命中。（148763 query 2–253、631–684）[^148763]

优化客群的金额采用分段累计，单位以下均为亿元：

| 月均普通股票金额 x | SQL 的折算表达式                   |
| ------------------ | ---------------------------------- |
| 1≤x<10             | 1＋(x−1)×10%                       |
| 10≤x<50            | 1＋9×10%＋(x−10)×5%                |
| 50≤x<100           | 1＋9×10%＋40×5%＋(x−50)×2%         |
| x>100              | 1＋9×10%＋40×5%＋50×2%＋(x−100)×1% |
| 其他               | 命中 5% 集合则 x×5%，否则保留 x    |

例如 2 亿元折为 1.1 亿元，不是整笔乘 10%。还要保留一个明确的待核对点：**恰好 100 亿元不在上述四个分段内**，会继续落到后续分支。这里记录可执行 SQL 的边界，不替业务判定应采用哪一档。（148763 query 635–640）[^148763]

另有单一客户、单只股票的特殊分支：指定股票持仓乘 5%，其他股票保留 1 倍，再进行市值标签加减，拼入约定购回与证券借贷日均。持仓字典和标签关系使用实际运行日的最近交易日快照，而数值窗口使用计算日期，历史重跑仍需检查此差异。（148763 query 356–525）[^148763]

信用账户：命中特殊 5% 集合取 0.05；否则近六个月已连接的每个交易日总资产均等于净资产、且不是当年新开信用账户时取 1；其他取 **2.99**。这里是对已有资产/净资产配对行计算 flag=0，不能把它扩写为“已经验证整个六个月无缺日、无负债”。注释中的 3.7 与执行值 2.99 不一致。（148763 query 974–1052）[^148763]

期权账户：非交易日按前一交易日映射，负净资产转 0；若在观察窗内的已配对交易日净资产等于现金，且无指定交收业务标志，则按 **2.99** 折算，否则按 **22.25**。之后求自然日月均。注释写“现金系数 3.64”，但执行表达式为 2.99。（148763 query 687–839）[^148763]

T0 取客户每日单边交易量，以日历把非交易日映射至上一交易日，再除以当月已过自然日数；个人系数 17.69、机构系数 8.37。原先交易日均的代码已被整段注释，不能当成同时执行的规则。当前分支限定当年日历。（148763 query 526–615、841–863）[^148763]

这几个特殊分支形成折后客户金额后，还要重新走产品户/异地机构分摊。最终仍保留分类和总计、翻牌与排除逻辑。因此看到营业部折后金额变化，应分别追查资产值、客户类别、系数配置、分配比例和机构映射，不能只找持仓变动。（148763 query 621–626、867–969、1056–1128）[^148763]

<a id="p09-employee"></a>

## 4. 员工归属至少有资产包、开发关系和业务推荐三套口径

160773/160780 在客户×机构折前/折后月均上补员工时，普通类别使用 T01_PTY_EMP_RELA_ADTNL_INFO 中资产包关系 01、有效标志 1，按客户和月份连接；并不再次乘一个员工分摊比例。托管与跨销售类别被先排除，再从保有员工维度的专用上游拼回。折后版托管乘 0.06，两类跨销售标签分别乘 0.8、0.26。最终员工组合是 Left Join，故可以保留空员工；如果一个客户同月存在多个有效员工，金额是否重复归属必须核验关系基数。（160773 query 1–64、126–141；160780 query 1–65、128–143）[^160773][^160780]

165154 是“客户×员工、开发关系口径”的折后月均。它先把客户×机构资产按客户合并，再按资产标签选择不同关系：普通资产用普通开发关系 11，信用资产用两融开发关系 14；一组其他资产优先普通开发、缺失再取两融开发；期权用 15，投顾用签约关系 02。月度关系取各月末对应交易日及当期快照，不能用资产包员工替换。（165154 query 1–264）[^165154]

T0 更不同：从 T01_PTY_EMP_RELA_H 选推荐关系 47，条件为 STRT_DATE≤计算日且 END_DATE>计算日，是左闭右开的有效期；连接历史月份资产时没有再按资产月份选推荐人，使用的是计算日有效推荐人。OTC、托管、财富分支沿用专用员工归属并乘当年配置系数；期货 IB 从推荐人工号汇总。末尾还要求 STAFF 有效内连接，缺少员工映射会丢行，与 160773/160780 保留空员工的行为不同。（165154 query 267–436）[^165154]

示意：客户某月折后 100 万，可同时出现在“资产包员工 A 的服务口径”和“推荐员工 B 的开发口径”中。这是两个考核视角，不是应把两份相加成客户 200 万。尤其 T0 推荐关系改期，可能改变历史月份的开发归属，而资产包表未必发生同样变化。

<a id="p09-calendar"></a>

## 5. 月均、年均、季均与固化窗口必须一起读

148419/149048 的年均并非对每个月均值直接 avg：普通类别按各月自然天数加权，即 Σ(月均×该月天数)/年内已过天数；OTC 与托管类别另取专门的年均结果，折后版再乘 0.8/0.26、0.06。因此不能再将这些专用年均分支乘月天数。（148419 query 1–51；149048 query 1–52）[^148419][^149048]

两个年均任务在计算日为每月 1–2 日时还输出上月末的 busi_date；其 prepare 仅显式删除当前计算日分区。201644/201657 的月度错期版本在每月 1–9 日选择上月和本月，10 日起只选择本月；201695/201699 的年度错期只在 1–2 日带上上月末。**选出历史月份与最终是否覆盖历史分区是两件事**：动态写入方式、调度参数和重跑行为仍需运行配置验证，不能仅凭表注释“10号固化”就宣布已实现固化。（148419 query 52–149、prepare 2；149048 query 53–150、prepare 2；201644/201657 query 1–3、prepare 2；201695/201699 query 1–6、prepare 2）[^148419][^149048][^201644][^201657][^201695][^201699]

202038 的季均按当季自然日加权，源头仍是折后月均。新的考核应用 230911 先剔除一个指定产品标签，重建总计；230006 仅取当前月总计，虽然表注释写“每月8号固化上月数据”，query 本身没有日期小于 8 的分支。因此本篇把“8号固化”保留为名称/注释意图，未证明运行机制。（202038 query 1–39；230911 query 1–14；230006 create 1、query 1–9、prepare 2）[^202038][^230911][^230006]

230016 通过考核客户关系将期初、期末两种资产聚合到员工。月均按天数加权前，先排除 235142 返回的“当月日均不足 10 万且不满足新客开发例外”的客户月份。被剔除月份连同加权分母一起移除，因而这是剩余合格月份的加权平均，不是把不合格月份按零计入整季天数。（230016 query 14–82）[^230016]

235142 的例外不是所有新开户客户：要求开户一年内，且上一季末开发人与考核资产包员工一致；或本季开户，当前开发人与资产包员工相同，或只有开发关系没有资产包关系。这个任务输出的是待剔除清单，不能直接当成“达标客户表”。（235142 query 10–120）[^235142]

<a id="p09-ratios"></a>

## 6. 增长值、增长率、司占比与亩产有不同分母

201976 先按机构、标签、月份汇总，在指定产品标签上对每个机构封顶 3 亿元，重新拼出总计，再计算相对上年 12 月的增长率，乘 100。201993 名称虽含“客户×机构”，当前 SQL 实际先做同样的机构聚合与封顶，输出 grp_id1 空串、grp_id2 为机构，只计算增长值。不能用它回答具体客户贡献多少增长。（201976 query 16–88；201993 query 2–73）[^201976][^201993]

202020 是当前机构司占比减上年 12 月司占比，单位是占比差；202160 是客户当前季度平均资产占可见客户总额的比例，减上一季度末对应口径的比例，直接输出小数差。它没有乘 100，所以不能与已经乘 100 的增长率在展示中混为同一单位。分母来自其已筛选的个人/机构客户集合，不宜扩写成所有集团资产。（202020 query 16–45；202160 query 1–47）[^202020][^202160]

亩产 202279 用机构当年累计全口径开户关系收入÷折后年均标准资产×10,000，202286 用客户当季累计全口径收入÷折后季度均值×10,000。二者观察期不同；表达式没有再年化，不能叫年化收益率，也不等于交易产品的投资收益率。零分母/缺失分母的引擎行为须保留，不能自行展示成 0。（202279 query 1–46；202286 query 1–21）[^202279][^202286]

<a id="p09-score"></a>

## 7. 从原值变成分数，再变成需要跟进的客户

218236/218244 分别取客户资产增长值和增长率。客户先映射当前归属营业部及地区分类，再按当月折后标准资产分为不足 10 万、10–50 万、50–500 万、500 万及以上四档；尽管字段注释写“季度日均资产”，分档源实际取当前月折后日均总计。每个“地区×资产档”内按指标降序 rank；缺失指标由于 Inner Join 可能根本不进入排名人口。（218236 query 1–105；218244 query 54–102）[^218236][^218244]

分数公式为 8×(1＋N−r)/N；末尾并列排名被改成 N。末名因此得 8/N，不能据注释说最低必为 0；如果全组并列，全部被改成末名逻辑。客户关系去重按“客户、状态”而非客户一个键，地区配置按机构编码排序取一条，均没有证明并列行有稳定业务优先级。（218236 query 8、44–48、87–120；218244 query 87–117）[^218236][^218244]

司占比增长值、司占比增长率与标准资产亩产三项只按地区排名，没有再按资产档分组。218252、218255、218404 的查询已分别核读；它们与新 schema 中 232675、234130、232652 的 query 完全同 hash。增长率 218244/232676 同 hash；增长值 232677 则改从客户单维增长值表取值，已逐行核对三处差异，不能只因名称相同而合并。（218252 query 54–104；218255 query 54–104；218404 query 54–105；232677 query 73–77）[^218252][^218255][^218404][^232675][^234130][^232652][^232676][^232677]

234147 将 16 项原值和分数按客户转成宽表。前 9 项包含资产增长、占比、收入、亩产和净值，分母固定先算 9；后 7 项是企微、服务覆盖、投顾新签、产品覆盖、期权新增、买方投顾新增和两融渗透，只在该项分数非空时加入分母。最终 Σ(coalesce(分数,0))/[9＋适用的后7项数]，故“有 16 列”不等于“每人除以 16”。资产包员工和服务月份是另一次当前关系补充，客户存在多个有效员工时，宽表仍可能产生多行。（234147 query 1–115、203–262）[^234147]

218429 将通用客户总分表的当前月份直接送入 DM_OM 的对应表；它没有重新计算评分。（218429 query 1）[^218429]

随后各分公司/营业部保留基础总分的 80%，另加 20% 自选项。以下均核读了实际公式；“均分”指这部分 20% 在所列计入项间分配，固定项即使值为空仍占分母，条件项仅非空时占分母：

| 任务 / 适用组织                   | 其余 20% 的实际规则                                                    |
| --------------------------- | --------------------------------------------------------------- |
| 237459 / 7006；237483 / 7025 | 投顾资讯收入、T0收入、两融利息各5%；买方投顾规模增长值、增长率各2.5%                          |
| 237468 / 7007               | T0收入为固定项，加非空的新签投顾、买方投顾新增、两融渗透后均分                                |
| 237470 / 7010               | 资产增长率、净资产亩产、净值3个固定项，加非空的新签投顾、买方投顾新增后均分                          |
| 237471 / 7005               | 净资产亩产为固定项，加非空的新签投顾、买方投顾新增、两融渗透后均分                               |
| 237474 / 7023               | 买方投顾规模增长值、T0收入固定；两融开户服务非空时加入，均分                                 |
| 237480 / 7013               | 投顾资讯收入、买方投顾规模增长值固定；两融开户服务非空时加入，均分                               |
| 237485 / 7014               | 投顾资讯收入、T0收入、买方投顾规模增长值固定；两融开户服务非空时加入，均分                          |
| 237486 / 7020               | 上一行的增长值改为买方投顾期末规模                                               |
| 237478 / 7029               | 资讯5%、T0 2%、两融2%、买方规模增长3%、资产司占比增长3%、全收入3%、投顾新签2%；新签为空时其2%平分给其余6项 |
| 237481 / 营业部0315            | 买方投顾期末规模10%、两融收入5%、两融开户服务5%；后者为空时其5%平分给前两项                      |

证据分别为各任务 query 45 至末行；237459 为 45–64，237483 为 45–62，其余精确行范围见账本。并未核实自选指标上游的全部计分制度。[^237459][^237483][^237468][^237470][^237471][^237474][^237480][^237485][^237486][^237478][^237481]

237505 先从通用分数中排除已出现在专用组织分数里的客户，再 Union All 专用分数；它只在资产档 1、2、3 内分别按总分降序 row_number，筛 score_rank>total_rows×0.95，即每档排名尾部约 5%。再补当前有效资产包员工、服务时长档、工龄与关系变更时间，形成跟进结果。它没有执行客户分配，alloc_stat 明写空值。专用组织结果若互相重叠，Union All 不会自动去重；最终同分没有稳定的第二排序键。（237505 query 1–61、80–117、136–173、192–229）[^237505]

<a id="p09-consumers"></a>

## 8. 经营报表呈现的零、系数和机构层级另有加工

149001 的营业部月均折标表把折前、折后两条指标用 Union All 转成两列，再连接当年系数表，并补“机构×资产类别×月份”的全零框架。因此报表中的 0 可能来自主动补行，不能等价为底层真实存在一条零资产记录。历史月份的机构分公司关系采用计算日最近交易日映射，不保证是历史月末层级。（149001 query 43–153）[^149001]

152234 的员工月均报表按各月末/当前员工快照补组织，用上月数据加一个月来对齐本月后算增长。折前增长率分支检查的是上月折后值是否为 0，却用上月折前值作分母；这两者并非同一字段，需作为具体待核对差异。表内展示的 ast_busi_coef、ast_adj_coef、ast_exam_coef 来自类别配置，不代表每笔特殊资产都实际按这些展示系数相乘。（152234 query 18–37、59–134）[^152234]

DM_CO 的机构看板 150128/150131 则按 ALL、机构、私募、银行、托管、结算、存管等标志分别复制客户明细后聚合。类型之间可以重叠，不能将各类型汇总为公司总量。日表 count(distinct pty_id) 统计客户键，字段注释虽写“总账户数”，并未按账户键数。月表使用当前日快照中的当月交易量，除以当前资产得到换手率；“月表”不表示一定只有月末才生成。客户明细上游尚未全部解释，因而“近一年”的具体起止口径仍需从 150023 核实。（150128 query 1–81；150131 query 1–113）[^150128][^150131]

<a id="p09-ecom"></a>

## 9. 开户审核奖励是另一类成绩，时间与人数不能照搬资产口径

135361 从开户订单拆出初审、复审、回访三类操作，按激活日期套奖励：2026年7月1日起两次单向审核分别为 1，回访为 2；此前存在不同日期档。它还有港澳台/外国/北向通开户启用时间、特定营业部跨分公司不计奖及历史折扣。这里陈述的是 SQL 中的奖励数值，币种与制度单位尚未另行确认。（135361 query 132–219）[^135361]

回访排除呼叫中心已处理的指定订单日志；客户限定个人交易客户和开户时间。员工采用人员岗位历史，并把最新一段结束日期延至远期，再以“起始日≤激活日≤结束日”连接；这是两端均包含的区间，与 T0 推荐人的左闭右开不同。扣罚按月份首日定位人员归属，将 penal_money 取负数加入。最终只有员工整月奖励合计≥0 的月份才输出，不是把负的整月结果截为 0；还存在具体员工/日期的单笔排除。（135361 query 76–124、220–296）[^135361]

137020 的收支展示表目前主要提供机构按激活日、开户类别的总数/初审数/复审数：从 136990 的不同标签读取，经 tag_name 拆分出纯基金、港澳台、外国、北向通等分类，另改部分分公司归属。其上游计数规则、135663 的可奖励账户数和具体奖励明细并未在本篇完全核读，不能用“总人数=一审+二审”推导或把收入表名解释成已有金额。（137020 query 1–108）[^137020]

旁支 78321 是网上开户适当性匹配检查：按低风险等级与投资品种组合分四类，只有第4类映射为 is_match=1，未匹配到适当性行也会得到 0。两个输入都固定读取 2026-05-21，不是动态计算日。它输出敏感客户明细，本篇只解释规则，不复制具体客户身份字段值；也不把这段 SQL 判定扩写成合规结论。（78321 query 1–27）[^78321]

<a id="p09-collection"></a>

## 独立业务子页

| 阅读问题                                           | 内容                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 员工和团队创收怎样计入月、季、年评价？             | [收入归属、团队考核与绩效接口](../topics/performance-income-and-evaluation.md)        |
| 接口后还会不会重算、排名和打分？                   | [考核后处理：团队层级、排名与 K1 计分](../topics/performance-postprocessing.md)       |
| 算法统计、T0、回测和大宗佣金怎样区分？             | [机构算法统计、T0 与大宗交易](../topics/performance-algorithm-and-trading.md)         |
| 有效户、盈利户和资产流入流出指什么？               | [有效客户、账户盈亏与经营归属](../topics/performance-customer-profitability.md)       |
| OTC 定义、标签、对手和规模口径怎样接续？           | [OTC组合定义、标签与对手指标](../topics/performance-otc-model.md)                     |
| 机构、员工与客户结构中的户均和分布怎样计算？       | [AUM 结构、关系明细与趋势](../topics/performance-asset-structure.md)                  |
| 各种月季年增长率、固定基期、汇总封顶有何不同？     | [标准资产汇总、比较基期与派生指标](../topics/performance-derived-indicators.md)       |
| 开户奖励金额、账户次数、客户数与发放接口有何不同？ | [网上开户审核：奖励、账户次数、客户数与发放接口](../topics/performance-onboarding.md) |
| 下游为何出现占位零、择一行与不同回补窗口？         | [考核与经营报表的传输、去重和占位值](../topics/performance-output-contracts.md)       |

这些分支各有对象和规则，OTC 组合模型与算法执行统计并非员工考核的子步骤。它们放在同一主题集合中是由于实际主题范围与数据联系，而不是把所有业务强行归成一种资产。

<a id="p09-open"></a>

## 已知边界与剩余范围

主篇和九个独立子页已经覆盖销售与资产主干、收入和团队、评分与后处理、OTC组合模型、算法交易、账户盈亏、经营结构与趋势、派生指标和多种输出合同。以下具体范围仍需补读，逐项状态以 [performance-review.json](../evidence/performance-review.json) 为准：

| 尚缺的内容                             | 具体任务或范围                                           | 不可提前宣称的结论                               |
| -------------------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| 折前资产更上游、客户分组与产品比例定义 | 148368/148763 所引累积资产、比例、名单                   | 比例守恒与制度正确性                             |
| 其余年均/资产包/期初期末变体           | 161054、161152、184973、184974、185235、235871、235878等 | 不能由已读月度例子自动推定所有变体               |
| 经营客户结构、高净值与季度分配分析     | 175419、175427、176693、190435、203119、207665、208353等 | 客户分层、关系重分类和结构比较的完整规则         |
| 户均/人均经营分析                      | 177395、177407                                           | 当前只定位片段，尚未解释完整值来源               |
| 机构客户屏剩余基础                     | 150023、150213、150507                                   | 客户标志、其他日月指标完整定义                   |
| 开户恢复、回访接通与企微运营           | 100130、124476、139708、144891、167299等                 | 恢复订单、回访记录、标签变化和企微周报的完整规则 |
| 无 SQL 的检查与其他未核读出口          | 账本明确列出的条目                                       | 无 SQL 不等于空操作，图可连不等于目标已到数      |

全部 302 个 ID 保留在同一账本，补充来源与发布来源分开。没有执行业务 SQL，也没有拿真实金额验证分摊或制度。业务确认重点包括：历史归属、特殊系数和等号边界、缺失月份对分母的影响、分支规则重叠，以及固化日期是否由真实运行机制保证。

## 固定发布证据索引

[^144887]: 任务 144887；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/144887/versions/86b30e908976e4ac3634b8c6015d797468435e497cbba52a429d86801584a44b.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^154068]: 任务 154068；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/154068/versions/cba73e64a80628a915556d376a27bacf007a5a83e8b8527afbead96db06b6970.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^155410]: 任务 155410；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/155410/versions/4da23aa129371b3f3d46459d6b9c7da9c997b304d703060b80f0b96a7ea5b7b0.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^159763]: 任务 159763；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/159763/versions/c87821fad514ef930309c036b4a8b04a78b1be5539385b41aa0ce1a3ddc81a31.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^159768]: 任务 159768；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/159768/versions/2b15865851e166768cd124074d8c2552233efecf18e1f3d13cf4ffae0294e376.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^171347]: 任务 171347；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/171347/versions/be685e0309e487ce68dada856781e630183f11c579a76be9bd3c54a76a230232.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^171364]: 任务 171364；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/171364/versions/be9b520a38166c829c880230fd7d72304277a11d8c22471617fbf291ad126625.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^148368]: 任务 148368；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/148368/versions/ab6106d5a9bb9a4c27dd31551c4a5235048a218dc51aaf805b0a22728178658e.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^148763]: 任务 148763；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/148763/versions/2942afc4ba95be6e33ea2c9835e34f6097f3a0bd7a0840ce0ebe0b02c94df7d2.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^160773]: 任务 160773；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/160773/versions/e5170c519ac4828888a5c0ff23671138ca26fb03d6ce0e712290864cc2a0e448.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^160780]: 任务 160780；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/160780/versions/6a4431dd4a7a766ab827e56d5bd79022c9e55dd19832541eb0fc81c1136160c6.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^165154]: 任务 165154；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/165154/versions/a4764b331eb83e4d0a8117314d0c94abbc7ed4a13801327ee29a10ebe27c7271.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^148419]: 任务 148419；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/148419/versions/ce3b589899e068c3d4e4dd594a5fa9aa75327aa2bb954b21b2c58910bc81a0fe.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^149048]: 任务 149048；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/149048/versions/f3b36228e9dfcf43e0f6344177b1f77bbee975472bd9f924682d236764043ee5.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^201644]: 任务 201644；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/201644/versions/2b54993871edd3dbbc2d524485005e59675c37bdfaecd95c391322903cfbc38c.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^201657]: 任务 201657；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/201657/versions/f0406f462b62c4b78312190544ed86b57e4b6d9041c6a09fbe282beda7d46dc8.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^201695]: 任务 201695；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/201695/versions/a2de3a3e69b61a3c69e1a706c35f952771c9c38ceaed1230888944f1580e21fa.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^201699]: 任务 201699；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/201699/versions/08078e1193175b3a7091af1435398175f114df9715542be66e04185363859035.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^202038]: 任务 202038；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/202038/versions/72921658069fb1d03352d7dbd8a557a3011a3ecc7e61dc9dba754dc5e2b691aa.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^230911]: 任务 230911；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/230911/versions/3f9aaea6340a8ed636f6a88bac3368f05a03246a4599e0a03a1212a7227824b7.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^230006]: 任务 230006；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/230006/versions/9f76e71e8e27c6597f52631e6a67e3b5afc0ec9c74202d71cac3b23d65cf89a3.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^230016]: 任务 230016；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/230016/versions/53b0cbbf95aa8e742af9cf4eece1d128a1cf5bac9fa53590c22208b202437daf.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^235142]: 任务 235142；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/235142/versions/2af7a103b3ceb0eab5ea93202b3ccc8f1cebd802deac961ad2ac270803cb94b2.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^201976]: 任务 201976；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/201976/versions/d2581a77547b3abd1fd8268890bb17b83435335e03d194feae40a4f3b383948d.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^201993]: 任务 201993；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/201993/versions/4ca91af1083e156ed36652b5fd0bfc5e8e6bede292787cf286481eab511e06f6.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^202020]: 任务 202020；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/202020/versions/b38016b8b72136e6d6df8034d4ae5f54e8f1200e90908248150d804d4d2a0909.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^202160]: 任务 202160；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/202160/versions/61f229d7a643a48243074bee0221cb65de4f29ead1b96c89032278de04b53d5d.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^202279]: 任务 202279；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/202279/versions/706734faf09c10b71732db564b4079c0d58a90d3463fdf326cb822b5922f3fa7.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^202286]: 任务 202286；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/202286/versions/c540f9d3d77a94ff021e572f697698eee7c202174e0c2e60f163f3d4d155de2c.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^218236]: 任务 218236；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/218236/versions/1358d7196445bdedc4227bae033d15fb3bde5ba7ed24d432e95715589201b58b.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^218244]: 任务 218244；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/218244/versions/badddbebc90b690c3249ebd851ac1ed63f0bcaada7fad9dfd76b0d976bb4bfc1.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^218252]: 任务 218252；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/218252/versions/191b6207f0537798da553150feb991788ccf65ac6164fea623b390e028739dd5.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^218255]: 任务 218255；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/218255/versions/ab8d1be9339a16fc1d8b9b519ed0a8d1475d6932d1daab96a2619fe305736bf3.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^218404]: 任务 218404；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/218404/versions/4192bae137ea4bf3aa09c403ad80af88285572b08279ef6c6ced0307e5ec2be1.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^232675]: 任务 232675；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/232675/versions/9a56ce0dc10483a7a4e4b46a44f1d569827e3e97f1d54c1d2405aa4e72f2c70a.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^234130]: 任务 234130；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/234130/versions/062ce88e003274dcbb8acf03a30d46ef0631fded65a5a531bc9969e865db505e.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^232652]: 任务 232652；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/232652/versions/16393cc39107a99e921ef0ef27a56f7cdae55a5bc90e8163b3a61025d4b6d458.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^232676]: 任务 232676；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/232676/versions/b6f52c3857cdc91b57e40b18c5c08d7623df335ebb89b896b7c2b50b8ddde66a.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^232677]: 任务 232677；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/232677/versions/3dd1002d5b7b3c3669fdc9ba806fd77f76515f7f16017a139d63a6e165530312.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^234147]: 任务 234147；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/234147/versions/859a46da95ad5c3b9b067ae554a844eb279bba7e17d684489fa9da4e7c924b03.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^218429]: 任务 218429；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/218429/versions/bfbb5ae0ee256d9bf226396772f13eea979a2f8faae518754e60443e960bb32e.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^237459]: 任务 237459；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237459/versions/9b8665852d8811f7478d4a7ff7ec85ddc70506257dd3b29162d785cc39599395.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^237483]: 任务 237483；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237483/versions/0c7d41e452beab61eb30577b72f2f0fa05dd8d7e80e30e97a5564b096513ba20.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^237468]: 任务 237468；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237468/versions/3d7760b5fecd63b96b14dc4aea66f9b96a4fd228e8f8c0005dd993d4caa5fbe8.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^237470]: 任务 237470；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237470/versions/a70b4322ba90434f2c83e54e2d8ae72248463c64223ba78e88b2d42ca65d4524.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^237471]: 任务 237471；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237471/versions/776cc60c46b0878fdef1d8f37998a8be8f650d3c63c5ef265c4847194670c4d4.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^237474]: 任务 237474；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237474/versions/7834d84cc20894b66da5e8c144bda18c290a2181ee9775aecf078852733857e8.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^237480]: 任务 237480；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237480/versions/c00392519956243eb4f8ea464652ca2ece32a28d4b5dbf2386c916700fc984e6.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^237485]: 任务 237485；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237485/versions/8e24be40c34830342b0ab638b235f8bcaeb356a25d9f8b02b988a18c1248d58f.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^237486]: 任务 237486；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237486/versions/51220542ed193040696eededc7488bcb44836762c2840a8b3eece06650f7a042.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^237478]: 任务 237478；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237478/versions/f592b9378d8d04d468f10ca7b25266682e2f73ab6504e4ed25da97efbc6aa2a7.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^237481]: 任务 237481；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237481/versions/4e883bd1702c8483cf550abeb8606927513034adf2ca0499cee9066b0423d106.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^237505]: 任务 237505；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/237505/versions/a76c3e2e50ce2753af5a3c51b4dff49665f94d80fd8293b6c63f16f52f45f828.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^149001]: 任务 149001；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/149001/versions/381aa86e6bc1c5df789dd6103cb30fb7e7cc59b986508a20fa210e8d0c79e059.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^152234]: 任务 152234；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/152234/versions/5090d0fb6619fa7c0867888c7a5c7a65c0dfdc458a943a8ff6fffc10ec1c4786.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^150128]: 任务 150128；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/150128/versions/c29d7d05005a8b78e213418816a6bf1354346b681122fd2ac2f21045cf27ee21.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^150131]: 任务 150131；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/150131/versions/863d0b16c60c378208c2f05e7784c1d037f4edef73dab439e2536ef19bffbc91.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^135361]: 任务 135361；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/135361/versions/33e53e1a9a61774dfbcdb74b82b7b8efed33ad93b98c6d198c42e9bca91f50df.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^137020]: 任务 137020；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/137020/versions/690f68fc36467e4ffe4ac78275f536406e80a4574ff23460d3ddd10195393d6d.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。

[^78321]: 任务 78321；[发布 evidence](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/78321/versions/0efb8eaf242eefb2ae410ec914960338e6a6691692fb0d1fbaeb79f626d3a385.evidence-v3.json)。精确 SQL 槽位与行段见正文及 performance-review.json。
