# 覆盖范围与选题账本

第一版覆盖的是**以 OTC 为中心、能从证据连贯解释的学习问题**。候选发现使用全图，正文深度不均等；“读过图”“核验过某个消费”“解释过该表全部生产者”是三种不同覆盖，不能互相替代。

## 候选怎样进入正文

固定发布批次有 3,615 个任务，分析视图保留 2,654 个节点、5,084 个不重复表对。128 个 qualified-name schema 前缀包含源端、PDATA、经营、风险、香港及其他区域；前缀不是 128 个业务主题。版本与公式见[图结构发现](06-graph-findings.md)及[证据](evidence.md)。

本轮先按不同下游数和汇聚／扩散的组合选取 55 个结构候选，再补查高入度终点、风险与香港区域，避免只挑“大出度表”。55 个列表的探索排序为 `出度 + sqrt(入度×出度)`，只是安排阅读顺序，未校准为业务重要性分数，不作为最终文章优先级。

语义选题还问：是否复用关键身份或控制、是否改变一行含义、是否引入新规则、相似来源是否出现值得解释的差异，以及能否连起一个具体业务问题。因此低出度的终点也入选；有大量输入的权限或客户画像表则没有自动成为 OTC 核心。

## 第一版具体回答了哪些问题

| 学习问题                   | 已解释的路线与边界                                                             | 文章       |
| -------------------------- | ------------------------------------------------------------------------------ | ---------- |
| 如何在多种编号之间认清对象 | 当事人／客户、共同协议、产品合约、子交易／腿、结构元素；保留多来源和唯一性边界 | 07、10、17 |
| 哪些公共知识能反复使用     | 账簿控制、历史关系、证券身份、汇率与日历；规则配置被消费时仍要解释             | 01、02、11 |
| 金额与风险结果有什么区别   | 持仓、估值、Greeks、组合履保、账户余额及风险报表整合                           | 08、14、16 |
| 收付义务与状态怎样形成报表 | 事件／TRANSFER／通知来源、标准化、现金流与异常监控；银行到账未覆盖             | 09         |
| 规模为什么进入考核         | 四路销售基础→日明细与归属→交叉销售月日均→客户机构标准资产；另解释年度 OTC 分叉 | 03、04、13 |
| 收益为什么成为创收         | TITANS 动态／静态与金仕达成本公式→日报→指定年度经营汇总                        | 08、12     |
| 同一交易为什么出现另一视角 | 香港账簿映射、观察日与运行日、导出型写者                                       | 15         |
| 怎样按字段理解热点片段     | 最终写入字段的输入足迹、重叠用途、值与关系控制分开                             | 17、18     |

这些是围绕问题形成的**可重叠片段**，不是自动算法生成的互斥簇。每条路线的“完整”指问题所需的已核验加工闭合；例如从销售基础追到标准资产，不意味着已经重建源系统定价模型、调度实绩或全部下游。

## 55 个结构候选的处置

“已深入”指正文核验了该对象的指定生产或实质转换，以及有关消费；仍受各章任务范围限制。“消费侧解释”只说明相关用途，不等于上游全覆盖。“生产侧简讲”只解释来源字段映射，尚未闭合实际消费。“后续候选”尚未形成充分语义解释。“边界保留”表示当前身份或生产证据不足，不能硬补。

本表共 55 项：已深入 27，消费侧解释 6，生产侧简讲 1，后续候选 14，边界保留 7。以下度数都是四表排除后的全图直接度数，非只在正文样本内统计。

| 原探索序号 | 候选表                                             | 入／出 | 当前处置   | 对应内容及理由                                                                                                                        |
| ---------- | -------------------------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1          | `pdata_n.t03_otc_deri_book_adtnl_info`             | 2／155 | 已深入     | [01](01-book-foundation.md)：账簿开关、组织与标的映射                                                                                 |
| 2          | `pdata_n.t03_agt_rela_h`                           | 9／98  | 已深入     | [02](02-agreement-history.md)：关系来源、对象类型与有效期                                                                             |
| 3          | `dm_index_n.index_grp2_std_ast_aft_covt_mth_apd`   | 28／46 | 已深入     | [13](13-standard-assets.md)：月折算、机构处理与年度旁路                                                                               |
| 4          | `pdata_n.t98_otc_deri_comp_sale_info`              | 31／44 | 已深入     | [03](03-sale-foundation.md)、[04](04-contract-to-cross-sale.md)、[12](12-revenue-and-business-results.md)：四来源基础及规模／创收消费 |
| 5          | `pdata_n.t98_cust_indv_cust_base_info`             | 10／37 | 后续候选   | —：个人客户综合模型；本版先解释 OTC 对手身份                                                                                          |
| 6          | `pdata_n.t03_agt_stati_info_h`                     | 11／36 | 后续候选   | —：通用协议统计历史；尚未逐指标解释                                                                                                   |
| 7          | `pdata_n.t03_otc_opt_comp_sub_trd_info`            | 4／39  | 已深入     | [07](07-contract-objects.md)、[17](17-option-structure.md)：父子键、日期及条款消费                                                    |
| 8          | `pdata_n.t01_pty_name`                             | 2／42  | 已深入     | [10](10-party-customer-identity.md)：名称日快照与不同编号空间                                                                         |
| 9          | `pdata_n.t03_otc_opt_comp_info`                    | 6／34  | 已深入     | [07](07-contract-objects.md)：期权合约属性与公共协议的区别                                                                            |
| 10         | `pdata_n.t98_brok_indv_cust_base_info`             | 0／48  | 边界保留   | [10](10-party-customer-identity.md)：可见读者多、未见写者；未重建经纪个人客户模型                                                     |
| 11         | `pdata_n.t98_sb_otc_swap_comp_info`                | 9／31  | 后续候选   | —：互换综合模型；本版解释基础对象与风险整合，不覆盖其全部字段                                                                         |
| 12         | `pdata_n.t98_sb_otc_opt_comp_info`                 | 13／28 | 后续候选   | —：期权综合模型；暂未比较其全部生产分支                                                                                               |
| 13         | `pdata_n.t98_brok_corp_cust_base_info`             | 0／46  | 边界保留   | [10](10-party-customer-identity.md)：可见读者多、未见写者；未重建经纪机构客户模型                                                     |
| 14         | `pdata_n.t03_otc_swap_comp_leg_info`               | 6／32  | 已深入     | [07](07-contract-objects.md)、[08](08-positions-valuation-pnl.md)：腿对象与持仓、估值接续                                             |
| 15         | `pdata_n.t03_otc_swap_comp_info`                   | 7／29  | 后续候选   | —：本版已讲互换腿与通用协议，尚未深入该合约表本身                                                                                     |
| 16         | `pdata_n.t03_otc_opt_comp_stru_elmn_info`          | 2／33  | 已深入     | [17](17-option-structure.md)：付款安排控制日期、系数组合与来源差异                                                                    |
| 17         | `pdata_n.t03_agt_prd_rela_h`                       | 5／29  | 后续候选   | —：曾在相关 SQL 见到，但正文尚未解释该表的具体关系类型、键与桥接用途                                                                  |
| 18         | `odata_n_tit.d_ref_otc_option_deal`                | 1／33  | 消费侧解释 | [03](03-sale-foundation.md)、[07](07-contract-objects.md)：源期权合约参与映射；源业务系统建模不在本版                                 |
| 19         | `pdata_n.t98_otc_comp_mng_rela_info`               | 10／23 | 已深入     | [04](04-contract-to-cross-sale.md)：管理归属、回退与当前关系作用于历史规模                                                            |
| 20         | `pdata_n.t01_pty_stati_info_h`                     | 3／28  | 后续候选   | —：当事人统计历史；需明确统计量后再选题                                                                                               |
| 21         | `odata_n_tit.d_trd_otc_trade`                      | 1／31  | 消费侧解释 | [03](03-sale-foundation.md)、[07](07-contract-objects.md)、[15](15-hong-kong-projections.md)：交易源在多个投影使用，不假定唯一层级链  |
| 22         | `pdata_n.t03_agt_name_h`                           | 2／28  | 后续候选   | —：协议名称历史；不能用关系历史样本代替具体实现                                                                                       |
| 23         | `dm_index_n.index_grp2_std_ast_aft_covt_year_apd`  | 5／24  | 已深入     | [13](13-standard-assets.md)：一般月权重与 OTC 年内日均分支                                                                            |
| 24         | `odata_n_tit.d_ref_trs`                            | 1／29  | 后续候选   | —：已讲互换概念与腿来源，尚未形成此精确 ODATA 合约表的语义说明                                                                        |
| 25         | `pdata_n.t01_pty_emp_rela_adtnl_info`              | 0／34  | 边界保留   | —：可见消费者、未见写者；本版归属章采用其他来源，未解释该表                                                                           |
| 26         | `pdata_news_n.t02_fxr_cfets_quot`                  | 3／25  | 已深入     | [11](11-security-market-time.md)：汇率来源、折算日期与单位前提                                                                        |
| 27         | `pdata_n.t05_otc_comp_rgst_sac_evt`                | 3／25  | 后续候选   | —：登记生命周期值得独立讲解；尚未核验登记口径及下游用途                                                                               |
| 28         | `dm_hk_n.trd_otc_trade`                            | 6／21  | 已深入     | [15](15-hong-kong-projections.md)：本方／映射账簿视角及导出型写者                                                                     |
| 29         | `pdata_news_n.t02_pub_covt_const`                  | 0／31  | 边界保留   | —：可见消费者、未见写者；正文未解释该精确公共常量表的规则用途                                                                         |
| 30         | `pdata_n.t03_agt`                                  | 9／18  | 已深入     | [07](07-contract-objects.md)：共同协议身份与当前属性维护                                                                              |
| 31         | `pdata_n.t03_agt_clas_h`                           | 9／18  | 后续候选   | —：协议分类历史的类别制度与各来源尚未解释                                                                                             |
| 32         | `pdata_n.t98_otc_deri_comp_sale_adtnl_det`         | 8／18  | 已深入     | [04](04-contract-to-cross-sale.md)、[12](12-revenue-and-business-results.md)：日序列展开与两类经营用途                                |
| 33         | `pdata_n.t01_pty_rela_h`                           | 4／20  | 已深入     | [10](10-party-customer-identity.md)：不同当事人关系、来源与有效期                                                                     |
| 34         | `dm_index_n.wide_idx_cust_aum_tot_score`           | 15／14 | 后续候选   | —：预览见多维评分汇集；尚未解释各评分来源与制度，不能称完整 AUM 评分知识                                                              |
| 35         | `pdata_n.t98_cust_corp_cust_base_info`             | 0／28  | 边界保留   | [10](10-party-customer-identity.md)：企业客户综合对象未见生产者；OTC 身份映射只覆盖部分消费语境                                       |
| 36         | `pdata_n.t03_otc_swap_comp_hold_info`              | 9／15  | 已深入     | [08](08-positions-valuation-pnl.md)：腿持仓与币种、金额来源差异                                                                       |
| 37         | `pdata_n.t98_otc_deri_book_info`                   | 4／18  | 消费侧解释 | [07](07-contract-objects.md)、[17](17-option-structure.md)：107481 按同日 Rep_Risk_Flag=1 内连接子交易，不能替代账簿附加表的全部解释  |
| 38         | `pdata_n.t98_otc_book_hold_sum`                    | 2／20  | 已深入     | [08](08-positions-valuation-pnl.md)、[12](12-revenue-and-business-results.md)：源日持仓映射及下游标的盈亏聚合                         |
| 39         | `pdata_n.${src_table}`                             | 0／26  | 边界保留   | [08](08-positions-valuation-pnl.md)：模板名，不能按名称补成具体物理表                                                                 |
| 40         | `pdata_n.t03_agt_pty_rela_h`                       | 8／15  | 已深入     | [07](07-contract-objects.md)、[10](10-party-customer-identity.md)：合约当事人关联的指定样本；其余写者未全覆盖                         |
| 41         | `pdata_n.t01_otc_deri_cust`                        | 2／19  | 已深入     | [10](10-party-customer-identity.md)：OTC 客户身份与外部客户映射                                                                       |
| 42         | `pdata_nds.om_flip_new_orgid`                      | 0／25  | 消费侧解释 | [13](13-standard-assets.md)：机构重映射影响汇总；配置由来未解释                                                                       |
| 43         | `pdata_n.t03_otc_deri_agt_agt_grp_rela_adtnl_info` | 5／16  | 已深入     | [14](14-margin-risk-controls.md)：账户—组合与组合—合约两类关系                                                                        |
| 44         | `dm_otc_n.otc_rev_daily_rpt`                       | 16／11 | 已深入     | [12](12-revenue-and-business-results.md)：TITANS／金仕达公式及经营消费                                                                |
| 45         | `pdata_n.t98_sb_tit_day_hold_indx`                 | 3／17  | 已深入     | [08](08-positions-valuation-pnl.md)：持仓指标来源和结果边界                                                                           |
| 46         | `pdata_n.t05_otc_comp_dura_chg_evt`                | 4／16  | 已深入     | [07](07-contract-objects.md)、[09](09-cash-settlement-monitoring.md)：存续变动事件的来源与日期；未接续全部事件消费                    |
| 47         | `dm_index_n.index_grp2_std_ast_bef_covt_mth_apd`   | 17／10 | 已深入     | [13](13-standard-assets.md)：去员工维度、标签与总计重叠                                                                               |
| 48         | `pdata_n.t03_tit_ast_acct_adtnl_info`              | 1／18  | 生产侧简讲 | [09](09-cash-settlement-monitoring.md)：103940 映射账户编号、币种、启用与用途，尚未闭合该精确表的下游消费                             |
| 49         | `odata_n_tit.d_ref_fast_trs`                       | 1／18  | 后续候选   | —：fast 对象已在其他层解释，但此精确 ODATA 合约表尚未形成正文覆盖                                                                     |
| 50         | `pdata_n.t98_sb_otc_opt_sub_trd_prcg_indx`         | 11／11 | 已深入     | [08](08-positions-valuation-pnl.md)：定价指标、输出绑定及部分未知来源                                                                 |
| 51         | `pdata_n.t01_pty_cutp`                             | 2／16  | 已深入     | [10](10-party-customer-identity.md)：交易对手属性与身份                                                                               |
| 52         | `odata_n_tit.d_ref_counterparty`                   | 1／16  | 消费侧解释 | [10](10-party-customer-identity.md)：相近源表名称与统一编号不能自动视为同一身份体系                                                   |
| 53         | `dm_index_n.grp_tag_client_aum_perf_exam`          | 0／20  | 边界保留   | —：可见消费者、未见写者；月系数及排除规则不能代替对此表标签口径的说明                                                                 |
| 54         | `pdata_news_n.t02_fut_base_info`                   | 3／13  | 后续候选   | —：期货基础对象；不由期权／互换样本泛化                                                                                               |
| 55         | `pdata_news_n.t02_scr_trd_cal`                     | 0／19  | 消费侧解释 | [11](11-security-market-time.md)、[13](13-standard-assets.md)：按日历记录计数的真实消费，源日历生成未核验                             |

## 高汇聚终点与区域补查

| 补查对象                                                        | 全图入／出   | 处置及理由                                                                                           |
| --------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| `pdata_n.t98_otc_opt_comp_sub_trd_base_info`                    | 40／2        | 已入 07、17；真正值得解释的是父子粒度、纳入控制和条款消费                                            |
| `dm_rsk_n.otc_trs_risk_plreport`                                | 20／0        | 已入 16；另查 `_temp、_bkup` 各 24／0，SQL 内确有后续读取，零出度不是现实消费终点                    |
| `dm_rsk_n.otc_deri_sett_abn_montr_indx`                         | 19／0        | 09 核验其中 TRANSFER 监控路径，其他指标写者未全覆盖                                                  |
| `dm_rsk_n.otc_comp_marg_det`                                    | 16／0        | 已入 14；期权合约／组合与互换分支的粒度、金额来源不同                                                |
| `dm_rsk_n.adm_v_risk_daily_bundle_margin`                       | 14／0        | 已入 14；解释模型结果与账户当前余额，未重建模型公式                                                  |
| `dm_hk_n.trd_otc_trade_info`                                    | 6／9         | 已入 15；并行投影及 `h13` 过滤的证据边界                                                             |
| `dm_rsk_n.curv_lack_abn_hand_info`／`curv_delay_abn_hand_info`  | 15／0、11／0 | 后续选题：曲线输入质量与异常处理；本版未解释各来源检测条件                                           |
| `dm_rsk_n.otc_opt_sub_trd_info`                                 | 15／0        | 本版先建立子交易和参数基础，风险输出全部分支尚未覆盖                                                 |
| `dm_rsk_n.trd_rsk_hk_liab_basic_day`                            | 14／0        | 后续选题：香港负债口径，不能由交易映射章代替                                                         |
| `dm_ctms_n.pwc_psn_sys_user_roles`                              | 111／1       | 134442 的 query 1–13 行定向预览确认是人员系统权限整合；其高入度不代表 OTC 业务承载中心，暂不扩成正文 |
| `dm_engin_n.employee_clt_tb`／`dm_om_n.wt_qywxtagchanges_day_s` | 55／0、49／0 | 依据当前元数据与图定位为客户画像／标签区域；未深查 SQL，不纳入 OTC 第一版主线                        |

图节点／表对只负责候选定位。风险报表的多输出和香港导出型任务，已经提供实际反例：一组任务输入输出不能直接解释为每个字段的完整因果关系。175 条仅由多输出任务支持的表对仍在发现图内，必须逐写入检查。

## 仍然缺少什么，怎样决定下一步

当前最值得延伸的主题是登记生命周期、曲线输入质量、香港负债，以及综合期权／互换宽表与已解释基础对象的差异。它们留作后续独立问题，而不是用一段推测填满“已覆盖”。

另一类工作需要新增类型的证据：源定价／履保模型文档、正式业务标签及考核制度、唯一性与比例等数据检验、到账或真实报表消费。它们决定部分待确认问题能否关闭，不能通过继续排列图节点解决。具体问题见[待确认问题](open-questions.md)。

当前版的验收重点是能顺着正文解释上述学习问题，并回查关键字段、规则和来源；不以篇数、表数或图连通度代替业务理解。尚未形成全图字段级聚类、全公司业务百科，也未评估实际阅读后的学习效果。
