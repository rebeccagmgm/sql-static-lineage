# TIT 向下游供数

[返回总览](README.md)

核对日期：2026-09-18。图谱：`9dbe5623`，状态 READY。范围与来源见 [统计口径与证据](05-统计口径与证据.md)。

## 1. TIT 提供的五类内容

TIT 供数既包括产品、证券等资料，也包括定价配置以及已经在源端形成的估值、盈亏和风险结果。判断本模块的加工量，要看进入数仓之后又做了什么，不能看到“估值”二字就认定本条链路重新估值。

| 业务组 | 主要内容 | 阅读重点 |
| --- | --- | --- |
| 证券、产品与外部编码 | 产品信息、产品底层资产、票据信息、期货基本信息、场内期权基础信息、货币利率属性、TIT 证券扩展资料、外部来源证券编码 | 查看来源范围、分区、字段整理及关联用途 |
| 标的池、白名单与标签 | 标的池白名单及保证金参数、标的池属性、证券标签 | 查看来源范围、分区、字段整理及关联用途 |
| 行情、利率与曲面数据 | 人民币汇率中间价、风管部私募等行情、利率指标、期权 reset 行情、波动率实例、分红曲线行情、收益率曲线行情、相关性因子值 | 查看来源范围、分区、字段整理及关联用途 |
| 定价环境、曲线定义与因子配置 | 波动率曲面定义、波动率曲面结构点、定价环境定义、环境选择波动率曲面、曲线期限对应关系、普通曲线定义、曲线类因子定义、权益类因子定义、WIND 曲线映射 | 区分配置、映射和真正的价格或结果字段 |
| 已有盈亏、持仓与风险结果 | 互换盈亏推送、期权盈亏推送、持仓报告推送、限售股折价与估值、组合风险报告 | 区分承接已有结果和在下游重新计算 |

## 2. 下游落点与数量

| 落点 | 业务目录 | 下游表数 | 涉及 TIT 贴源表数 | 原清单记录数 |
| --- | --- | --- | --- | --- |
| `dm_ctms_n` | 结算与交易管理部集市 | 1 | 1 | 1 |
| `dm_fin_n` | 财务部集市 | 9 | 10 | 12 |
| `dm_hk_n` | 广发香港集市 | 5 | 7 | 7 |
| `dm_otc_n` | 柜台交易市场部集市 | 13 | 15 | 24 |
| `dm_rsk_n` | 风险管理部集市 | 16 | 18 | 44 |
| `gfval` | GFVAL 接收库 | 3 | 3 | 6 |

**合计 47 张下游表、35 张 TIT 贴源表、94 条记录。** 各域的贴源表会重叠，不能按列相加得到 35。47 张表在当前图中均有写入关系；这不等于原清单中的每条源路径都已完成字段或分区核验。

94 条中，原分类为直接消费或转发还原的有 28 条，标为简单加工的有 66 条。原清单允许筛选、关联和来源优先级等“简单加工”，不能把这些记录整体改称不含业务规则的纯通道。

以下按内容归并原清单。同一目标可能承接多项内容，因此各节的目标表数不相加。来源和模型为原清单中的路径导航；末段调度从当前图补齐，其输入可能比旧清单多一层中间表。

## 3. 证券、产品与外部编码

| 内容 | TIT 贴源表 → 模型 | 下游落点表 | 具体加工或用途 |
| --- | --- | --- | --- |
| 产品信息 | `odata_n_tit.p_prd_product`（产品基础信息）<br>→<br>`pdata_news_n.t02_tit_prd_info`（TIT产品信息表） | `dm_fin_n.civ_t02_tit_prd_info`（估值系统-香港TIT产品信息表）<br>`dm_otc_n.t02_tit_prd_info`（TIT产品信息表）<br>`dm_rsk_n.trd_rsk_hk_liab_basic_day`（风控-香港负债表）<br>`gfval.src_t02_tit_prd_info`（TIT产品信息表） | 复制 TIT/01 产品资料，继续向 gfval 分发。<br>接收产品资料。<br>筛选融资票据等产品，排除作废，形成香港负债资料。<br>经 OTC 同名表间接分发，未核验接收端估值算法。 |
| 产品底层资产 | `odata_n_tit.p_prd_product_asset`（产品底层资产表）<br>→<br>`pdata_news_n.t02_tit_prd_asset_info`（TIT产品底层资产信息表） | `dm_otc_n.t02_tit_prd_asset_info`（TIT产品底层资产信息表）<br>`dm_rsk_n.trd_rsk_hk_liab_basic_day`（风控-香港负债表）<br>`gfval.src_t02_tit_prd_asset_info`（TIT产品底层资产信息表） | 复制 TIT/01 底层资产关系，继续向 gfval 分发。<br>提供内部交易号，关联交易与利息腿。<br>经 OTC 同名表间接分发。 |
| 票据信息 | `odata_n_tit.p_prd_notes`（票据基础信息）<br>→<br>`pdata_news_n.t02_tit_note_info`（TIT票据信息表） | `dm_otc_n.t02_tit_note_info`（TIT票据信息表）<br>`gfval.src_t02_tit_note_info`（TIT票据信息表） | 复制 TIT/01 票据资料，继续向 gfval 分发。<br>经 OTC 同名表间接分发。 |
| 期货基本信息 | `odata_n_tit.d_ref_future_properties`（【AI】证券-期货信息表）<br>`odata_n_tit.d_ref_future_properties_p`（【AI】证券-期货信息表）<br>→<br>`pdata_news_n.t02_fut_base_info`（期货品种基本信息） | `dm_hk_n.ref_future_properties`（证券期货信息表）<br>`dm_rsk_n.futr_base_info`（期货基本信息） | 拆出备注属性，反向还原源期货类型。<br>拆备注取交割月、合约类型等，形成期货基础资料。 |
| 场内期权基础信息 | `odata_n_tit.r_ref_listed_option_props`（注释待补）<br>→<br>`pdata_news_n.t02_opt_base_info_tit`（期权基础信息tit） | `dm_hk_n.fdm_info_tit_opt_base`（TIT期权基础信息）<br>`dm_rsk_n.trd_opt_base_info_day`（场内期权基本信息） | 接收 TIT/01 的场内期权基础资料。<br>输出行权方式、行权价、合约单位等；结算类型固定 Cash。 |
| 货币利率属性 | `odata_n_tit.d_ref_rate_properites`（货币利率属性表）<br>→<br>`pdata_news_n.t02_tit_ira_crrc_attr`（货币利率属性表） | `dm_rsk_n.crrc_mkt_intrt_base_info`（货币市场利率基本信息） | 补期限及复利、日算、结算、日历等属性。 |
| TIT 证券扩展资料 | `odata_n_tit.d_ref_instrument`（证券-证券基本信息）<br>`odata_n_tit.d_ref_instrument_p`（注释待补）<br>→<br>`pdata_news_n.t02_tit_scr_base_info`（证券基本信息） | `dm_otc_n.option_subject_view`（Titans标的池）<br>`dm_otc_n.otc_undrl_def`（OTC互换标的池）<br>`dm_rsk_n.crrc_mkt_intrt`（货币市场利率）<br>`dm_rsk_n.crrc_mkt_intrt_base_info`（货币市场利率基本信息）<br>`dm_rsk_n.fnd_mkt_quot_day`（基金行情表）<br>`dm_rsk_n.futr_base_info`（期货基本信息）<br>`dm_rsk_n.futr_mkt_quot`（期货行情表）<br>`dm_rsk_n.stk_spi_mkt_quot_day`（股票股指行情表）<br>`dm_rsk_n.trd_opt_base_info_day`（场内期权基本信息）<br>`dm_rsk_n.trd_opt_mkt_quot_day`（场内期权行情） | 以 RATE_INDEX 限定范围，缺名称/币种时补充。<br>匹配 WIND 市场数据代码。<br>提供场内期权类型与 WIND 代码。<br>提供基金类型、币种与 WIND 代码。<br>提供源证券类型与 WIND 代码，确定期货范围。<br>提供股票/指数分类与市场代码。<br>提供证券代码与名称。<br>提供证券类型、名称、市场等标的资料。<br>补期权和标的名称、市场代码与币种。<br>补证券简称、市场及 WIND 代码。 |
| 外部来源证券编码 | `odata_n_tit.d_ref_instrument_code`（【AI】证券-证券编码）<br>→<br>`pdata_news_n.t02_tit_scr_base_info`（证券基本信息） | `dm_otc_n.option_subject_view`（Titans标的池）<br>`dm_otc_n.otc_undrl_def`（OTC互换标的池）<br>`dm_rsk_n.crrc_mkt_intrt`（货币市场利率）<br>`dm_rsk_n.crrc_mkt_intrt_base_info`（货币市场利率基本信息）<br>`dm_rsk_n.fnd_mkt_quot_day`（基金行情表）<br>`dm_rsk_n.futr_base_info`（期货基本信息）<br>`dm_rsk_n.futr_mkt_quot`（期货行情表）<br>`dm_rsk_n.stk_spi_mkt_quot_day`（股票股指行情表）<br>`dm_rsk_n.trd_opt_base_info_day`（场内期权基本信息）<br>`dm_rsk_n.trd_opt_mkt_quot_day`（场内期权行情） | 以 RATE_INDEX 限定范围，缺名称/币种时补充。<br>匹配 WIND 市场数据代码。<br>提供场内期权类型与 WIND 代码。<br>提供基金类型、币种与 WIND 代码。<br>提供源证券类型与 WIND 代码，确定期货范围。<br>提供股票/指数分类与市场代码。<br>提供证券代码与名称。<br>提供证券类型、名称、市场等标的资料。<br>补期权和标的名称、市场代码与币种。<br>补证券简称、市场及 WIND 代码。 |

当前图末段调度：产品信息：176443、176525、181136、181183、202946、202957；产品底层资产：176443、176525、181142、181181；票据信息：181140、181182；期货基本信息：160530、164500、198437；场内期权基础信息：176983、195090；货币利率属性：171040；TIT 证券扩展资料：119976、158671、164500、164723、166041、171040、175782、175843、175878、176983；外部来源证券编码：119976、158671、164500、164723、166041、171040、175782、175843、175878、176983。

## 4. 标的池、白名单与标签

| 内容 | TIT 贴源表 → 模型 | 下游落点表 | 具体加工或用途 |
| --- | --- | --- | --- |
| 标的池白名单及保证金参数 | `odata_n_tit.d_ref_instrument_pool_whitelist_p`（一站通白名单标的池）<br>→<br>— | `dm_otc_n.ref_instrument_pool_whitelist`（一站通白名单标的池） | 直接承接标的池白名单及保证金参数；源端已有的数值和结果不在本次推送中重算。 |
| 标的池属性 | `odata_n_tit.r_cfg_instrument_pool_props`（配置-标的池标的属性表）<br>`odata_n_tit.r_cfg_instrument_pool_props_pb`（配置-标的池标的属性表）<br>→<br>`pdata_news_n.t02_fin_undrl_attr`（标的池标的属性表） | `dm_otc_n.cfg_instrument_pool_props_td`（标的池标的属性表）<br>`dm_otc_n.option_subject_view`（Titans标的池） | 只取标的池 10000，转换报备场所及标的类型。<br>输出标的池配置资料。 |
| 证券标签 | `odata_n_tit.d_ref_instrument_tag`（证券-证券标签表）<br>→<br>`pdata_news_n.t02_scr_lbl`（证券标签表） | `dm_otc_n.otc_comp_dura_chg_evt`（场外合约存续期变动事件）<br>`dm_otc_n.otc_undrl_def`（OTC互换标的池） | 沪/深港通标志从 1/0 转回 Y/N。<br>证券标签参与合约存续变更输出。 |

当前图末段调度：标的池白名单及保证金参数：146823、219432；标的池属性：158671、159250；证券标签：119976、146386。

## 5. 行情、利率与曲面数据

| 内容 | TIT 贴源表 → 模型 | 下游落点表 | 具体加工或用途 |
| --- | --- | --- | --- |
| 人民币汇率中间价 | `odata_n_tit.d_ref_rmb_midrate`（注释待补）<br>`odata_n_tit.d_ref_rmb_midrate_p`（注释待补）<br>→<br>`pdata_news_n.t02_fxr_cfets_quot`（外汇交易中心汇率中间价） | `dm_fin_n.v_fin_trs_plreport`（财务视图-TRS盈亏报表）<br>`dm_hk_n.ref_rmb_midrate`（OTCHK外汇交易中心汇率中间价） | 按币种及日期带出 exchangeRateCny；人民币取 1。<br>接收源币种、行情日期与中间价。 |
| 风管部私募等行情 | `odata_n_tit.d_mkt_risk_daily_info`（风管部私募行情数据表）<br>→<br>`pdata_news_n.t02_prd_unit_nav_s_tit`（基金净值表(TIT)） | `dm_rsk_n.pric_fctr_mkt_quot_day`（价格类因子行情表） | 优先输出收盘价和单位净值，并匹配权益因子。 |
| 利率指标 | `odata_n_tit.m_ref_cbond_rate`（注释待补）<br>→<br>`pdata_news_n.t02_ira_indx_info`（利率指标信息） | `dm_hk_n.info_tit_ira_indx_day`（TIT利率指标信息）<br>`dm_rsk_n.crrc_mkt_intrt`（货币市场利率） | 利率 ÷ 100 写入中间价，买/卖价为空。<br>接收 TIT/01 利率指标，保留百分数口径。 |
| 期权 reset 行情 | `odata_n_tit.r_ref_option_quote_reset`（期权reset行情）<br>→<br>`pdata_news_n.t02_opt_mkt_quot`（期权行情数据表） | `dm_fin_n.civ_opt_mkt_quot`（场外期权行情数据表）<br>`dm_hk_n.ref_option_quote_reset`（OTCHK期权reset行情） | 接收 TIT/01 reset 行情字段，未进一步计算价格。<br>限定 GFS_HK 账簿子交易，将结算价还原为 reset 值。 |
| 波动率实例 | `odata_n_tit.d_ref_volsurface_instance`（【AI】DM-波动率实例表）<br>→<br>`pdata_news_n.t02_fin_vola_instc`（波动率实例表） | `dm_fin_n.civ_fin_vola_instc`（估值系统波动率实例表）<br>`dm_rsk_n.vola_mkt_quot_day`（波动率行情表） | 按曲面 ID 匹配指定因子类别，intrpn ÷ 100 输出波动率。<br>按曲面日期取当天实例。 |
| 分红曲线行情 | `odata_n_tit.d_ref_div_curve`（【AI】分红曲线行情表）<br>→<br>`pdata_news_n.t02_fin_curv_mkt_quot`（曲线行情表） | `dm_rsk_n.div_curv_fctr_mkt_quot`（分红率曲线因子行情） | 按曲线编号匹配分红因子，输出期限及收益率。 |
| 收益率曲线行情 | `odata_n_tit.d_ref_wind_yield_curve`（【AI】证券行情-WIND收益率曲线行情表）<br>→<br>`pdata_news_n.t02_fin_curv_mkt_quot`（曲线行情表） | `dm_rsk_n.v_risk_yield_curve`（风控视图-收益率曲线） | 与曲线定义匹配，输出收益率行情。 |
| 相关性因子值 | `odata_n_tit.d_ref_correlation_daily_info`（相关性数据表）<br>→<br>`pdata_news_n.t02_oth_corre_fctr`（相关性因子表） | `dm_rsk_n.corr_fctr_mkt_quot`（相关性因子行情表）<br>`dm_rsk_n.otc_opt_greek_val_det_h`（OTC期权子交易希腊值明细数据）<br>`dm_rsk_n.v_risk_correlation_info`（风控视图-相关性数据信息） | 按一对标的匹配因子，输出相关系数。<br>提供日期与相关系数，结合证券代码组装相关性视图。<br>提供相关性数据，参与下游 Greeks 结果组装。 |

当前图末段调度：人民币汇率中间价：118174、166014；风管部私募等行情：177526、182738、182755；利率指标：166041、181104；期权 reset 行情：134518、220853；波动率实例：176548、188171、226134；分红曲线行情：182230；收益率曲线行情：155160；相关性因子值：163633、176827、194609。

## 6. 定价环境、曲线定义与因子配置

| 内容 | TIT 贴源表 → 模型 | 下游落点表 | 具体加工或用途 |
| --- | --- | --- | --- |
| 波动率曲面定义 | `odata_n_tit.d_ref_vol_surface`（【AI】波动率曲面定义表）<br>→<br>`pdata_news_n.t02_fin_vol_curv_surf`（波动率曲面定义表） | `dm_fin_n.civ_fin_vol_curv_surf`（估值系统波动率曲面定义表） | 接收曲面定义，部分港股标的代码补足 5 位。 |
| 波动率曲面结构点 | `odata_n_tit.d_ref_vol_surface_structure`（【AI】波动率曲面结构定义）<br>→<br>`pdata_news_n.t02_fin_vol_curv_surf`（波动率曲面定义表） | `dm_fin_n.civ_fin_vol_curv_surf`（估值系统波动率曲面定义表） | 接收执行价、期限及 spread 结构点。 |
| 定价环境定义 | `odata_n_tit.r_cfg_pricing_env_def`（注释待补）<br>→<br>`pdata_news_n.t02_fin_prcg_env_curv`（定价环境配置表\|\|t02_fin_prcg_env_curv） | `dm_ctms_n.wt_tit_sys_user_pricing_rights_rt`（权限核查_泰坦系统用户定价环境权限）<br>`dm_fin_n.civ_fin_prcg_env_curv`（估值系统定价环境配置表） | 取 02 环境信息补充用户资源权限。<br>只取 02 环境名称与类型等资料。 |
| 环境选择波动率曲面 | `odata_n_tit.d_cfg_pricing_env_vol_surf`（【AI】配置表-定价环境波动率曲面选择）<br>→<br>`pdata_news_n.t02_fin_prcg_vol_curv_surf`（定价环境波动率曲面选择） | `dm_fin_n.civ_fin_prcg_vol_curv_surf`（估值系统定价环境波动率曲面选择） | 接收 TIT/01 曲面选择配置。 |
| 曲线期限对应关系 | `odata_n_tit.tit_r_ref_instrument_wind_curve_s`（注释待补）<br>→<br>`pdata_news_n.t02_fin_curv_def`（曲线定义表\|\|t02_fin_curv_def） | `dm_otc_n.trans_ins_wind_cur_tenor_tit`（WD利率互换收益率曲线TENOR表_TIT） | 参与曲线期限对应关系：将当月互换曲线利率类型对应到 TIT 曲线编号，合并上个交易日已有曲线期限关系并去重。 |
| 普通曲线定义 | `odata_n_tit.d_ref_curve`（【AI】曲线定义历史表）<br>→<br>`pdata_news_n.t02_fin_curv_def`（曲线定义表\|\|t02_fin_curv_def） | `dm_rsk_n.v_risk_yield_curve`（风控视图-收益率曲线） | 提供曲线定义和规则。 |
| 曲线类因子定义 | `odata_n_tit.d_cfg_dictionary_desc`（参考数据-数据字典表）<br>→<br>`pdata_news_n.t02_fin_curv_fctr_def`（曲线类因子定义表） | `dm_rsk_n.div_curv_fctr_mkt_quot`（分红率曲线因子行情） | 通过分红曲线 ID 把行情关联到因子。 |
| 权益类因子定义 | `odata_n_tit.d_cfg_dictionary_desc`（参考数据-数据字典表）<br>→<br>`pdata_news_n.t02_fin_equi_fctr_info`（权益类因子信息） | `dm_rsk_n.pric_fctr_mkt_quot_day`（价格类因子行情表） | 将证券内码映射为权益因子 ID。 |
| WIND 曲线映射 | `odata_n_tit.tit_r_ref_instrument_wind_curve_s`（注释待补）<br>→<br>`pdata_news_n.t02_fin_curv_def`（曲线定义表\|\|t02_fin_curv_def） | `dm_rsk_n.v_risk_yield_curve`（风控视图-收益率曲线） | 提供 WIND 映射与描述。 |

当前图末段调度：波动率曲面定义：226123；波动率曲面结构点：226123；定价环境定义：208181、226709；环境选择波动率曲面：226067；曲线期限对应关系：222346；普通曲线定义：155160；曲线类因子定义：182230；权益类因子定义：177526、182738、182755；WIND 曲线映射：155160。

## 7. 已有盈亏、持仓与风险结果

| 内容 | TIT 贴源表 → 模型 | 下游落点表 | 具体加工或用途 |
| --- | --- | --- | --- |
| 互换盈亏推送 | `odata_n_tit.d_v_otc_plreport_trs`（【AI】TRS盈亏数据视图）<br>→<br>— | `dm_otc_n.otc_pl_trs_mq`（运管Titans互换日报盈亏视图） | 按指定交易台及年内日期筛选终止互换记录；非目标日的日损益置零。 |
| 期权盈亏推送 | `odata_n_tit.d_v_otc_plreport`（运管视图-期权日报盈亏视图）<br>→<br>— | `dm_otc_n.otc_pl_mq`（运管Titans盈亏报表） | 按指定交易台及年内日期筛选终止记录；非目标日的日损益置零，保留源累计损益。 |
| 持仓报告推送 | `odata_n_tit.d_v_otc_position_report_tit`（运管视图-持仓报表数据）<br>→<br>— | `dm_otc_n.otc_position_mq`（运管Titans持仓报表数据） | 筛选指定交易台的当日持仓报告。 |
| 限售股折价与估值 | `odata_n_tit.m_ref_restricted_stock_daily`（注释待补）<br>→<br>`pdata_news_n.t02_stk_rstk_disc_info`（限售股折价信息表） | `dm_fin_n.civ_stk_rstk_disc_info`（估值系统限售股折价信息表）<br>`dm_fin_n.fin_gf_fi_quot_stock`（估值系统股票行情） | 按证券及解禁日关联，以限售股估值作为对应分支收盘/复权价。<br>接收 TIT 限售股折价及估值明细。 |
| 组合风险报告 | `odata_n_tit.d_v_risk_rm_bundlereport_tit`（【AI】风控视图-期权子交易信息表）<br>→<br>— | `dm_otc_n.otc_bundle_report_mq`（运管Titans期权子交易信息） | 筛选指定交易台及终止日期范围，整理结构类型，合约比例乘100后输出。 |

当前图末段调度：互换盈亏推送：223564；期权盈亏推送：223523；持仓报告推送：223557；限售股折价与估值：211987、228801；组合风险报告：223556。

## 8. 阅读时需要保留的三个区别

1. **落在 DM_OTC_N 不代表已经到 TIT 应用。** 本页统计的是下游加工落点；要确认回到 TIT，继续对照入向目标清单。
2. **配置参与不代表提供结果值。** 境外期权代码映射是典型例子，已放在[双角色链路](04-典型链路与加工边界.md)中，不重复计入本页 47 张外部命名空间落点。
3. **旧清单的简化路径需要展开中间层。** 例如当前图中任务 181183 读取的是 `dm_otc_n.t02_tit_prd_info`（TIT产品信息表），再写 `gfval.src_t02_tit_prd_info`（TIT产品信息表）；不能把原清单的“PDATA → GFVAL”当作直接读取边。

对象含义和具体入模字段继续阅读 [TIT 入模目录](../01-tit入模/README.md)。本页来源：原工作簿的「业务链路」L0001～L0236 中 TIT 参与且落点不属于 TIT 命名空间的 94 条记录，以及当前图中的目标写入和实际读取。
