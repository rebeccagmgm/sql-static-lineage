# TIT 源对象与入模检索索引

这是本地元数据与SQL的并集。模型目标栏是同任务候选，不是每源每目标的字段血缘；声明来源可用于解析宏源表，但仍需具体SQL核验。空白只表示本地未命中，不能解释为系统没有该功能。完整字段、来源说明、全部任务号见 [[00-20260911-认知实验/t03专题-协议/证据/衍生品补充/TIT-OIS全源对象及跨主题去向.json|JSON]]。

| 源对象 | 原始元数据说明 | 模型候选目标 | 任务号（前8） | 证据情况 |
|---|---|---|---|---|
| odata_n_tit.a_adm_department | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.a_adm_employee | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.a_adm_function | 注释缺失 | t00_sys_func_info | 242362、247673 | DECLARATION_ONLY／EXPLICIT_REFERENCE |
| odata_n_tit.a_adm_function_menu_mapping | 功能菜单映射表 | t99_sys_func_menu_map | 242349 | DECLARATION_ONLY |
| odata_n_tit.a_adm_menu_permission | 注释缺失 | t99_sys_menu_info | 177760 | DECLARATION_ONLY |
| odata_n_tit.a_adm_menu_role_mapping | 注释缺失 | t04_role_righ_h | 178884 | EXPLICIT_REFERENCE |
| odata_n_tit.a_adm_role | 注释缺失 | t04_role | 159423、37062 | EXPLICIT_REFERENCE |
| odata_n_tit.a_adm_role_access | 注释缺失 | t04_role_righ_h | 159421 | EXPLICIT_REFERENCE |
| odata_n_tit.a_adm_user | 注释缺失 | t04_user_stati_info_h、t04_user | 159420、159422、37063 | EXPLICIT_REFERENCE |
| odata_n_tit.a_adm_user_role | 注释缺失 | t04_user_role_rela_h | 177461、37020 | EXPLICIT_REFERENCE |
| odata_n_tit.b_trd_book_mapping | 注释缺失 | t03_otc_deri_book_agt_trd_jour_map_regu | 180014 | DECLARATION_ONLY |
| odata_n_tit.b_trd_book_mapping_condition | 交易流水账簿映射条件 | t03_otc_deri_book_agt_trd_jour_map_regu | 180014 | EXPLICIT_REFERENCE |
| odata_n_tit.b_trd_deal | 注释缺失 | t05_otc_deri_book_mtch_evt | 159419 | DECLARATION_ONLY |
| odata_n_tit.b_trd_deal_otcoption | 注释缺失 | 未命中 | 37016 | EXPLICIT_REFERENCE |
| odata_n_tit.b_trd_deal_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_adm_audit_log | 审计表 | t05_sb_otc_comp_modif_log | 114026 | DECLARATION_ONLY |
| odata_n_tit.d_adm_valuation_check_result | 【AI】估值数据质量监控结果表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_amazons3_file_info | S3附件信息表 | t00_tit_s3_attach_info | 124870 | DECLARATION_ONLY |
| odata_n_tit.d_bk_book_mapping | 【AI】账簿映射关系表 | t98_otc_swap_comp_valu_sum、t03_agt_rela_h、t03_otc_deri_agt_rela_adtnl_info、t03_otc_deri_book_agt_map_regu | 107937、107938、108070、122185、122239、177928、211620 | EXPLICIT_REFERENCE |
| odata_n_tit.d_bk_book_mapping_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_bk_book_mapping_rule | 账簿映射条件表 | t03_otc_deri_book_agt_map_regu | 177928、211620 | DECLARATION_ONLY |
| odata_n_tit.d_bk_book_mapping_rule_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_bk_department_properties | 账簿管理-部门配置表 | t04_inr_org、t04_inr_org_name_h、t04_inr_org_rela_h、t04_otc_deri_dept_adtnl_info、t98_otc_swap_comp_trd_undrl_info | 165634、165635、165637、165638、185234、211619、211773、166266 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_bk_department_properties_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_bundle_daily_contr_param | 组合履保计算参数 | t03_otc_comp_perf_marg_ref | 147138、199157 | EXPLICIT_REFERENCE |
| odata_n_tit.d_bundle_margin_daily_result | 组合履保监控结果 | t03_otc_cutp_marg_acct_perf_guar_rslt、t98_otc_comp_marg_det | 147139、160816、165155、176874、176877 | EXPLICIT_REFERENCE |
| odata_n_tit.d_bundle_margin_daily_result_p | 组合履保监控结果 | 未命中 | 160427、211544、236415 | EXPLICIT_REFERENCE |
| odata_n_tit.d_bundle_margin_daily_result_pb | 组合履保监控结果 | t03_otc_cutp_marg_acct_perf_guar_rslt | 160817、165155 | EXPLICIT_REFERENCE |
| odata_n_tit.d_bundle_margin_underlying_type | 组合履保标的类型 | 未命中 | 200489 | EXPLICIT_REFERENCE |
| odata_n_tit.d_capital_account | 【AI】客户资金账户信息 | t03_agt、t03_agt_pty_rela_h、t03_tit_ast_acct_adtnl_info、t03_ast_crrc_acct_bal、t05_otc_deri_cutp_fnd_chg_evt、t98_otc_deri_ast_acct_bal_sum | 103929、103932、103940、105054、112620、112644、173966、213442 | EXPLICIT_REFERENCE |
| odata_n_tit.d_capital_account_ledger | 【AI】资金流水台账 | t05_otc_deri_cutp_fnd_chg_evt | 173966 | DECLARATION_ONLY |
| odata_n_tit.d_capital_account_p | 客户资金账户信息 | t03_agt_pty_rela_h | 222317 | EXPLICIT_REFERENCE |
| odata_n_tit.d_capital_acct_current_balance | 【AI】资金账户当前余额表 | 未命中 | 174013 | EXPLICIT_REFERENCE |
| odata_n_tit.d_capital_acct_current_balance_p | 【AI】资金账户当前余额表 | 未命中 | 236414 | EXPLICIT_REFERENCE |
| odata_n_tit.d_capital_acct_daily_balance | 【AI】资金账户余额表 | t03_ast_crrc_acct_bal | 112620、112644、174014 | EXPLICIT_REFERENCE |
| odata_n_tit.d_capital_acct_daily_balance_p | 【AI】资金账户余额表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_capital_acct_daily_balance_pb | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_capital_daily_actual_balance |  | t98_otc_deri_ast_acct_bal_sum | 213442 | EXPLICIT_REFERENCE |
| odata_n_tit.d_capital_daily_actual_balance_p | 客户历史实际资金总额数据 | t98_otc_deri_ast_acct_bal_sum | 213442 | DECLARATION_ONLY |
| odata_n_tit.d_cfg_calendar | 【AI】参考数据-日历表 | t02_tit_scr_trd_cal | 161255 | EXPLICIT_REFERENCE |
| odata_n_tit.d_cfg_dictionary_desc | 参考数据-数据字典表 | t04_inr_org、t04_inr_org_name_h、t02_fin_equi_fctr_info、t02_fin_curv_fctr_def | 142305、165634、165635、168302、170265 | EXPLICIT_REFERENCE |
| odata_n_tit.d_cfg_pricing_env_curve | 【AI】配置表-定价环境DISCOUNT CURVE历史表 | t02_fin_prcg_env_curv | 103238、103239 | EXPLICIT_REFERENCE |
| odata_n_tit.d_cfg_pricing_env_div_curve | 【AI】配置表-定价环境分红曲线 | t02_fin_prcg_env_divd_curv | 103252、103253 | EXPLICIT_REFERENCE |
| odata_n_tit.d_cfg_pricing_env_vol_surf | 【AI】配置表-定价环境波动率曲面选择 | t02_fin_prcg_vol_curv_surf | 103249、103251 | EXPLICIT_REFERENCE |
| odata_n_tit.d_dm_option_contract_info | 【AI】资管视图-期权交易要素信息 | 未命中 | 178488 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ft_sod_counter_party | 客户账户信息 | 未命中 | 148764 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ft_sod_eq_lend_available | 融券券池信息 | 未命中 | 148765 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ft_sod_eq_lend_record | 客户借券记录 | 未命中 | 148766 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ft_sod_eq_recall_record | 标的被召回信息 | 未命中 | 148767 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ft_sod_instrument | 履保方案信息 | 未命中 | 148768 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ft_sod_margin_plan | 履保方案信息 | 未命中 | 148770 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ks_contract_info | 【AI】合约表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ks_fin_capital_acct_mapping | 资金账户 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ks_fin_margin_acct_mapping | 【AI】合约映射表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ks_fin_margin_daily_report | 【AI】保证金余额 | t03_otc_cutp_marg_acct_perf_guar_rslt | 140935 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ks_fin_trs_valuation | 【AI】TRS估值结果 | t98_otc_swap_comp_leg_valu_info、t98_otc_swap_comp_valu_sum | 106211、107937 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ks_leg_info | 【AI】leg表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ks_marketval_acc_for_risk | 【AI】风控-集中度数据 | t98_otc_deri_undrl_crn_info | 106218 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ks_risk_long_short_acc | 风控多空互换集中度指标 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ks_trade_comfirm_info | 交易确认书信息表 | t05_otc_comp_rgst_sac_evt、t98_otc_deri_comp_sale_adtnl_det、t03_agt_pty_rela_h、t03_otc_swap_comp_info、t99_deri_comp_sprd_coef_ref、t99_deri_comp_base_coef_ref、t03_deri_comp_sett_info、t03_agt_div_rati、t98_sb_otc_swap_comp_info、t98_otc_deri_comp_sale_info、t03_agt、t03_agt_rela_h、t03_agt_stat_h | 106205、107491、107664、112119、112120、119487、133052、133054 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ks_trs_eod_postion | 日终持仓表视图 | t98_otc_deri_comp_sale_info | 130652、86842 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ks_trs_for_risk | 【AI】TRS风控数据表 | t98_otc_deri_comp_sale_adtnl_det、t98_otc_comp_marg_det | 107491、120007、176873、176878 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ks_trs_nav_acc_for_risk | 【AI】风控视图-TRS净值数据 | t98_otc_comp_crn_info | 106212 | EXPLICIT_REFERENCE |
| odata_n_tit.d_margin_account | 【AI】保证金-交易对手保证金账户 | t03_agt、t03_agt_pty_rela_h、t03_agt_stati_info_h、t03_ast_crrc_acct_bal、t05_otc_deri_cutp_marg_chg_evt、t98_otc_comp_marg_det | 103928、103931、103939、105053、105069、107280、107646、173965 | EXPLICIT_REFERENCE |
| odata_n_tit.d_margin_account_ledger | 【AI】保证金-交易对手保证金账户台账 | t05_otc_deri_cutp_marg_chg_evt、t98_otc_comp_marg_det | 173965、174016、176874、176877 | DECLARATION_ONLY／EXPLICIT_REFERENCE |
| odata_n_tit.d_margin_account_ledger_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_margin_account_p | 保证金-交易对手保证金账户 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_margin_acct_bundle_mapping | 组合编号和保证金映射表 | t03_otc_deri_agt_agt_grp_rela_adtnl_info、t03_agt_agt_grp_rela_h、t98_otc_comp_marg_det | 141595、141600、176874、176877 | DECLARATION_ONLY／EXPLICIT_REFERENCE |
| odata_n_tit.d_margin_acct_bundle_mapping_p | MARGIN_ACCT_BUNDLE_MAPPING | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_margin_acct_contract_mapping | 【AI】保证金-交易对手保证金账户与合约映射 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_margin_acct_contract_mapping_p | 【AI】保证金-交易对手保证金账户与合约映射 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_margin_acct_current_balance | 【AI】保证金-交易对手保证金账户当前余额表 | 未命中 | 174015 | EXPLICIT_REFERENCE |
| odata_n_tit.d_margin_acct_current_balance_p | 【AI】保证金-交易对手保证金账户当前余额表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_margin_acct_daily_balance | 【AI】保证金账户余额 | t03_ast_crrc_acct_bal、t98_otc_comp_marg_det | 107280、107646、176874、176877 | EXPLICIT_REFERENCE |
| odata_n_tit.d_margin_acct_daily_balance_p | 【AI】保证金账户余额 | 未命中 | 198710 | EXPLICIT_REFERENCE |
| odata_n_tit.d_margin_acct_daily_balance_pb | 【AI】保证金账户余额 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_margin_acct_daily_no_calc | 保证金-交易对手保证金账户每日不履保账户数据 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_margin_acct_daily_result | 【AI】保证金-交易对手保证金账户每日履保计算结果 | t02_fin_cutp_bail_acct_daily_rslt | 104658、104937 | EXPLICIT_REFERENCE |
| odata_n_tit.d_margin_acct_daily_result_p | 【AI】保证金-交易对手保证金账户每日履保计算结果 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_margin_acct_daily_result_pb | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_margin_bundle_acct | 组合盯市账号表 | t03_otc_deri_comp_comb_adtnl_info | 142888、199158 | EXPLICIT_REFERENCE |
| odata_n_tit.d_margin_bundle_contract_mapping | 组合和合约映射关系表 | t03_otc_deri_agt_agt_grp_rela_adtnl_info、t98_otc_comp_marg_det | 141596、176874、176877 | EXPLICIT_REFERENCE |
| odata_n_tit.d_margin_bundle_contract_mapping_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_margin_daily_contr_param | 保证金账户日终计算监控计算的履约保证金参数 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_margin_daily_contr_param_p | 保证金账户日终计算监控计算的履约保证金参数 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_margin_plan | 【AI】履保方案表 | t01_cutp_perf_marg_plan_info、t98_otc_deri_comp_sale_info | 199159、200060、220650、86840、86841 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_mkt_ins_daily_info | 【AI】证券-每日行情信息 | 未命中 | 104663、104933、143405、144020、144022、144739、144765、183785 | EXPLICIT_REFERENCE |
| odata_n_tit.d_mkt_ins_daily_info_p | 【AI】证券-每日行情信息 | 未命中 | 143405、144739、207701、143404、144741 | EXPLICIT_REFERENCE |
| odata_n_tit.d_mkt_ins_op_eod_metric | 【AI】证券-期权每日日终指标表 | t98_sb_otc_opt_sub_trd_prcg_indx | 121574 | DECLARATION_ONLY |
| odata_n_tit.d_mkt_option_eod_pt_metric | 证券-期权每日日终压力测试指标表 | t98_sb_otc_opt_sub_trd_prcg_indx | 160493 | DECLARATION_ONLY |
| odata_n_tit.d_mkt_risk_daily_info | 风管部私募行情数据表 | t02_prd_unit_nav_s_tit | 207284 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ncross_ab_daily_result | 多空互换监控结果 (HK) | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ope_capital_acct_element | 资金账户指标表 | t98_otc_deri_ast_acct_valu_rpt_info | 114021 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ope_margin_acct_element | 保证金指标表 | t98_otc_deri_marg_acct_valu_rpt_info | 114020 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ope_option_element | 期权合约指标表 | t98_otc_comp_valu_rpt_info | 114024 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ope_option_element_p | 【AI】期权合约指标表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ope_trs_element | 互换合约指标表 | t98_otc_comp_valu_rpt_info | 114023 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ope_trs_element_p | 【AI】互换合约指标表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_otchk_hedge_pnl_report | 香港盈亏报表-盈亏明细表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_pos_bucket_vega_metrics | 期权合约维度日终<font color='red'>bucket</font>定价指标表 | t98_sb_otc_opt_comp_prcg_indx | 120040、168293、211730 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_pos_bucket_vega_metrics_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_pos_eod_calc_metrics | 日终持仓-指标计算结果表 | t98_sb_tit_day_hold_indx、t98_sb_otc_opt_comp_prcg_indx、t98_otc_deri_comp_sale_info | 117337、121575、121720、168293、211730、243712、86840 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_eod_calc_metrics_p | 日终持仓-指标计算结果表 | t98_sb_tit_day_hold_indx | 141369、243712 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_eod_calc_metrics_pb | 日终持仓-指标计算结果表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_pos_eod_fx_exposure | 日终外汇敞口／／<font color='red'>POS</font>_<font color='red'>EOD</font>_<font color='red'>FX</font>_<font color='red'>EXPOSURE</font> | t98_otc_deri_fx_expo | 219358 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_eod_position_view | 【AI】日终持仓表视图 | 未命中 | 150384 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_eod_position_view_p | 【AI】日终持仓表视图 | 未命中 | 198727 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_eod_position_view_pb | 【AI】日终持仓表视图 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_pos_fast_trs_leg_his_pos | 北上极速腿历史持仓表 | t98_otc_deri_comp_sale_adtnl_det、t03_otc_swap_comp_hold_info、t98_otc_swap_comp_trd_undrl_info、t98_otc_deri_comp_sale_info | 107491、180754、183096、185234、211472、211619、220650 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_fast_trs_leg_his_pos_p | 北上极速腿历史持仓表 | 未命中 | 211716 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_fast_trs_leg_his_pos_pb | 北上极速腿历史持仓表 | 未命中 | 180755 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_fast_trs_leg_valuation | 极速互换腿估值表 | t98_otc_swap_comp_leg_valu_info、t98_otc_swap_comp_trd_undrl_info | 180757、183098、185234、211619、211644 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_fast_trs_leg_valuation_p | 极速互换腿估值表 | 未命中 | 180586、211555 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_fast_trs_leg_valuation_pb | 极速互换腿估值表 | 未命中 | 180759 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_pd_clearing_position | partial<font color='red'>D</font>elta清算数据表 | t98_sb_otc_opt_sub_trd_prcg_indx | 154814 | DECLARATION_ONLY |
| odata_n_tit.d_pos_position_daily | 【AI】持仓-账户每日持仓数据表 | t98_otc_book_hold_sum、t98_otc_swap_comp_valu_sum、t98_otc_opt_comp_sub_trd_pal_sum、t98_otc_comp_marg_det | 106590、107937、109369、117937、169145、176877 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_position_daily_p | 【AI】持仓-账户每日持仓数据表 | 未命中 | 160423、194589、195010、211719 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_position_daily_pb | 【AI】持仓-账户每日持仓数据表 | 未命中 | 160818 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_qg_clearing_greeks | 自营做市绩效合约<font color='red'>Greeks</font>表 | t02_opt_ost_qtf_sstv_indx_tit | 219014 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_trs_leg_current_pos | 持仓-<font color='red'>TRS</font>浮动及结构化腿虚拟当前持仓 | 未命中 | 119514 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_trs_leg_current_pos_p | 持仓-<font color='red'>TRS</font>浮动及结构化腿虚拟当前持仓 | 未命中 | 158446 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_trs_leg_current_pos_pb | 持仓-TRS浮动及结构化腿虚拟当前持仓 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_pos_trs_leg_his_pos | 【AI】持仓-TRS浮动及结构化腿历史持仓 | t03_otc_swap_comp_hold_info、t98_otc_swap_comp_trd_undrl_info、t98_otc_deri_comp_sale_adtnl_det、t98_sb_otc_deri_trd_evt_sum、t98_otc_deri_comp_sale_info | 105392、106083、107018、107024、107491、119640、144295、228195 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_trs_leg_his_pos_p | 【AI】持仓-TRS浮动及结构化腿历史持仓 | 未命中 | 198717、144167、211491 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_trs_leg_his_pos_pb | 【AI】持仓-TRS浮动及结构化腿历史持仓 | t03_otc_swap_comp_hold_info | 144295、160828 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_trs_leg_valuation | 【AI】持仓-账户TRS LEG每日估值 | t98_otc_swap_comp_leg_valu_info、t98_otc_swap_comp_valu_sum | 106210、107641、107937、119563 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_trs_leg_valuation_p | 【AI】持仓-账户TRS LEG每日估值 | 未命中 | 160425、211715 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_trs_leg_valuation_pb | 【AI】持仓-账户TRS LEG每日估值 | 未命中 | 160822 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_trs_underlying_valuation | 【AI】持仓-账户TRS 标的估值表 | t98_otc_swap_comp_undrl_valu_info | 119641、159782 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_pos_trs_underlying_valuation_p | 【AI】持仓-账户TRS 标的估值表 | 未命中 | 160426、211546 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pos_trs_underlying_valuation_pb | 【AI】持仓-账户TRS 标的估值表 | 未命中 | 160821 | EXPLICIT_REFERENCE |
| odata_n_tit.d_prd_valuation | 产品估值表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_pricing_bucket_metric | 证券-期权日终<font color='red'>bucket</font>定价指标表 | t98_otc_opt_comp_sub_trd_term_prcg_indx、t98_sb_otc_opt_sub_trd_prcg_indx | 110827、110828、160494 | EXPLICIT_REFERENCE |
| odata_n_tit.d_pricing_eod_cross_metric | 证券-多标的期权日终定价<font color='red'>cross</font>指标表 | t98_sb_otc_opt_sub_trd_prcg_indx | 154813 | DECLARATION_ONLY |
| odata_n_tit.d_pricing_eod_part_metric | 证券-多标的期权日终定价<font color='red'>part</font>ial指标表 | t98_sb_otc_opt_sub_trd_prcg_indx | 154812 | DECLARATION_ONLY |
| odata_n_tit.d_pricing_initpx_part_metric | 证券-多标的期权日终定价<font color='red'>part</font>ial指标表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_basket | 篮子定义表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_basket_constituent | 篮子成分表 | t98_otc_deri_comp_sale_info | 176353、86840 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_book | 账簿信息表 | t03_agt、t03_otc_deri_book_adtnl_info、t03_agt_pty_rela_h、t03_agt_stati_info_h、t03_agt_name_h、t98_otc_swap_comp_trd_undrl_info、t98_otc_swap_comp_valu_sum、t98_sb_otc_opt_comp_info、t98_otc_trd_comp_info、t98_otc_deri_book_info、t98_sb_otc_swap_comp_info、t98_sb_otc_opt_comp_prcg_indx、t98_otc_opt_comp_sub_trd_pal_sum、t98_otc_deri_comp_sale_info | 103930、105055、105381、105382、105383、105384、105385、105521 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_book_p | 账簿信息表 | t98_otc_opt_comp_sub_trd_base_info | 163712、144142、146686、211615 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_book_pb | 账簿信息表 | t03_agt_name_h、t03_otc_deri_book_adtnl_info | 144290、144293、160815 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_corporate_action_info | 【AI】公司行为信息表 | t02_co_behav_info | 188381 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_correlation_daily_info | 相关性数据表 | t02_oth_corre_fctr | 117794 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_counter_party | 交易参数-交易对手 | t01_indv、t01_pty_rela_h、t01_pty_name、t01_pty_rat、t01_pty_clas_h、t01_pty_cutp、t98_otc_swap_comp_trd_undrl_info、t98_otc_opt_comp_sub_trd_base_info、t01_pty_stati_info_h、t98_sb_otc_opt_comp_info、t98_otc_deri_book_info、t01_pty_imp_lkman、t01_otc_deri_cust、t98_cutp_base_info、t98_sb_otc_swap_comp_info、t01_same_pty_rela_adtnl_info、t98_sb_otc_deri_trd_evt_sum、t01_pty | 104298、104301、105075、105076、105077、105079、105380、105518 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_counter_party_p | 交易参数-交易对手 | t98_otc_opt_comp_sub_trd_base_info | 160422、163712、211720 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_counter_party_pb | 交易参数-交易对手 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_counterparty | 系统静态数据-交易对手数据表 | t01_indv、t01_pty_name、t01_pty_rat、t01_pty_cutp、t01_pty_clas_h、t01_pty_stati_info_h、t01_pty_imp_lkman、t01_otc_deri_cust、t01_same_pty_rela_adtnl_info、t01_pty_idty_info、t01_pty_rela_h、t01_pty | 104298、104299、104300、105379、105380、114401、150755、150757 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_counterparty_p | 系统静态数据-交易对手数据表 | 未命中 | 160827 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_ctpty_account | 【AI】交易参数-OTC交易对手账户信息表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_ctpty_auth_busi | 【AI】交易参数-OTC交易对手授权业务类型 | t01_pty_stati_info_h | 173975、149961 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_ctpty_ext_param | 交易对手属性参数表 | t01_pty_rat、t01_pty_cutp、t01_pty_clas_h、t01_pty_stati_info_h、t01_pty_imp_lkman、t01_otc_deri_cust | 104300、105379、105380、114401、150755、150757 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_ctpty_ext_param_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_ctpty_mapping | 交易参数-交易对手映射表 | t01_pty_rela_h、t98_otc_trd_comp_info、t01_same_pty_rela_adtnl_info、t98_otc_deri_comp_sale_info | 104301、105079、123781、150759、220650、86840、86841 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_ctpty_trade_group | 交易对手账户组绑定关系 | t01_pty_rela_h | 219175 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_curve | 【AI】曲线定义历史表 | t02_fin_curv_def | 103203、103204 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_div_curve | 【AI】分红曲线行情表 | t02_fin_curv_mkt_quot | 103200、103201 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_div_curve_def | 【AI】分红曲线定义表 | t02_fin_curv_def | 103207、103208 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_fast_trs | 极速互换合约要素表 | t03_agt_prd_rela_h、t03_agt_stati_info_h、t03_agt_rela_h、t03_agt_clas_h、t98_sb_otc_swap_comp_info、t03_agt、t03_agt_pty_rela_h、t03_agt_stat_h、t03_agt_agt_grp_rela_h、t03_otc_swap_comp_info、t03_otc_swap_comp_leg_info、t98_otc_swap_comp_leg_valu_info、t98_otc_swap_comp_trd_undrl_info、t03_otc_deri_comp_contr_file_info、t03_otc_deri_comp_marg_info、t03_otc_deri_comp_undrl_lend_info、t98_otc_deri_comp_sale_info、t99_deri_comp_sprd_coef_ref | 105386、105387、105388、105526、105527、105529、106661、106676 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_fast_trs_leg | 极速互换腿表 | t03_otc_swap_comp_leg_info、t98_otc_swap_comp_trd_undrl_info | 180407、183093、185234、211619、211639 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_fast_trs_leg_p | 极速互换腿表 | 未命中 | 180585、211718 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_fast_trs_leg_pb | 极速互换腿表 | 未命中 | 180753 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_fast_trs_p | 极速互换合约要素表 | 未命中 | 180587、211556 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_fast_trs_pb | 极速互换合约要素表 | t03_agt_clas_h、t03_agt_rela_h、t03_agt_stati_info_h | 144287、144288、144289、180406 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_future_properties | 【AI】证券-期货信息表 | t02_fut_base_info、t02_fut_base_info_ext、t98_otc_deri_comp_sale_info | 105612、105745、105746、105862、144301、211516、220650、86840 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_future_properties_p | 【AI】证券-期货信息表 | 未命中 | 144168、211760 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_future_properties_pb | 【AI】证券-期货信息表 | t02_fut_base_info | 144301、211516 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_fx_forward | 外汇远期-合约要素／／<font color='red'>REF</font>_<font color='red'>FX</font>_<font color='red'>FORWARD</font>／／<font color='red'>REF</font>_<font color='red'>FX</font>_<font color='red'>FORWARD</font> | t03_agt_prd_rela_h、t03_agt_stati_info_h、t03_agt_rela_h、t03_agt_clas_h、t03_otc_fx_fwd_comp_info、t03_agt、t03_agt_pty_rela_h、t03_agt_stat_h、t03_otc_deri_comp_contr_file_info、t03_otc_deri_comp_marg_info、t03_otc_deri_comp_undrl_lend_info、t99_deri_comp_sprd_coef_ref | 105386、105387、105388、105526、105527、105529、106661、106676 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_fx_forward_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_fx_forward_structure | 外汇远期-结构要素／／<font color='red'>REF</font>_<font color='red'>FX</font>_<font color='red'>FORWARD</font>_<font color='red'>STRUCTURE</font>／／<font color='red'>REF</font>_<font color='red'>FX</font>_<font color='red'>FORWARD</font>_<font color='red'>STRUCTURE</font> | t03_otc_fx_fwd_comp_stru_elmn_info | 163772、211810 | DECLARATION_ONLY |
| odata_n_tit.d_ref_fx_forward_structure_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_implied_metrics | <font color='red'>IMPLIED</font> <font color='red'>METRICS</font>表 | t02_tit_impl_vola_srfc_indx_info | 240855 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_ins_option_info | 【AI】期权合约信息表 | t03_otc_opt_comp_sub_trd_info、t98_otc_opt_comp_sub_trd_base_info、t98_otc_opt_comp_sub_trd_term_prcg_indx、t98_sb_otc_opt_sub_trd_prcg_indx、t03_otc_opt_comp_sub_trd_obsv_date_attr_info、t03_otc_opt_comp_sub_trd_barr_line_info、t03_otc_opt_comp_sub_trd_scop_attr_info、t03_otc_opt_comp_sub_trd_auto_redp_info、t98_otc_opt_comp_sub_trd_pal_sum | 105395、107281、107481、107636、110827、110828、121573、121574 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_ins_option_info_p | 【AI】期权合约信息表 | t98_otc_opt_comp_sub_trd_base_info | 163712 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_ins_option_info_pb | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_instrument | 证券-证券基本信息 | t02_scr_base_info、t02_tit_scr_base_info、t98_sb_otc_opt_comp_prcg_indx、t98_otc_deri_comp_sale_info、t02_scr_base_info_test_lbj、t02_scr_base_info_no_rplc_test | 103230、103232、103234、103235、120051、144303、168293、211515 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_instrument_bbg_code | 证券-<font color='red'>BBG</font>代码映射表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_instrument_bbg_code_p | 证券-<font color='red'>BBG</font>代码映射表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_instrument_code | 【AI】证券-证券编码 | t02_tit_scr_base_info | 103236、103237 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_instrument_code_p | 【AI】证券-证券编码 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_instrument_p | 注释缺失 | 未命中 | 211616 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_instrument_pb | 证券-证券基本信息 | t02_tit_scr_base_info | 144303、152124、211515 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_instrument_pool_whitelist | 一站通白名单标的池 | t02_tit_wi_undrl_pool | 146819、171427 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_instrument_pool_whitelist_b |  | t02_tit_wi_undrl_pool_pb | 221125 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_instrument_pool_whitelist_p | 一站通白名单标的池 | t02_tit_wi_undrl_pool_pb | 221125 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_instrument_tag | 证券-证券标签表 | t02_scr_lbl | 127897 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_main_contract | 主合约信息表 | 未命中 | 117940 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_op_cumulator_schedule | Ac<font color='red'>cumulator</font>观察区间表 | t98_otc_opt_comp_sub_trd_base_info、t03_otc_opt_comp_obsv_scop_info | 107281、107481、156493、211696 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_op_cumulator_schedule_p | 注释缺失 | t98_otc_opt_comp_sub_trd_base_info | 163712 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_op_deal_autocall_kidate | 【AI】场外交易-期权敲入观察日及票息信息 | t03_otc_opt_comp_obsv_date_coup_info、t98_otc_deri_comp_sale_info | 113014、113053、86840 | DECLARATION_ONLY／EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_op_deal_autocall_kidate_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_op_deal_autocall_kodate | 【AI】场外交易-期权敲出观察日及票息信息 | t03_otc_opt_comp_obsv_date_coup_info、t98_otc_deri_comp_sale_info | 112813、113051、86840 | DECLARATION_ONLY／EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_op_deal_autocall_kodate_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_op_deal_float_back_fee | 期权后端费挂钩浮动利率表／／<font color='red'>REF</font>_<font color='red'>OP</font>_<font color='red'>DEAL</font>_<font color='red'>FLOAT</font>_<font color='red'>BACK</font>_<font color='red'>FEE</font> | t03_otc_opt_comp_reed_fee_flot_rati_info | 139657 | DECLARATION_ONLY |
| odata_n_tit.d_ref_option_attribute | 证券-期权其他属性表 | t03_otc_opt_comp_sub_trd_info | 105395、107636 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_option_attribute_p | 注释缺失 | t98_otc_opt_comp_sub_trd_base_info | 163712 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_option_autocall | 证券-期权-自动赎回期权属性 | t98_otc_opt_comp_sub_trd_base_info、t03_otc_opt_comp_sub_trd_auto_redp_info | 107281、107481、156500、211596 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_option_autocall_cp | <font color='red'>AUTOCALL</font>息票障碍信息表 | t98_otc_opt_comp_sub_trd_base_info、t03_otc_opt_comp_sub_trd_obsv_date_attr_info | 107281、107481、156495、211692 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_option_autocall_cp_p | 注释缺失 | t98_otc_opt_comp_sub_trd_base_info | 163712 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_option_autocall_ki | <font color='red'>AUTOCALL</font>风险障碍信息表 | t98_otc_opt_comp_sub_trd_base_info、t02_opt_deri_idx、t03_otc_opt_comp_sub_trd_obsv_date_attr_info | 107281、107481、119465、156496、211695 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_option_autocall_ki_p | <font color='red'>AUTOCALL</font>风险障碍信息表 | t98_otc_opt_comp_sub_trd_base_info | 163712 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_option_autocall_ki_pb | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_option_autocall_ko | <font color='red'>AUTOCALL</font>赎回障碍信息表 | t98_otc_opt_comp_sub_trd_base_info、t03_otc_opt_comp_sub_trd_obsv_date_attr_info | 107281、107481、156497、211694 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_option_autocall_ko_p | 注释缺失 | t98_otc_opt_comp_sub_trd_base_info | 163712 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_option_autocall_p | 证券-期权-自动赎回期权属性 | t98_otc_opt_comp_sub_trd_base_info | 163712 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_option_autocall_pb | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_option_barrier_line | 子交易障碍线信息表 | t98_otc_opt_comp_sub_trd_base_info、t03_otc_opt_comp_sub_trd_barr_line_info | 107281、107481、156498、211699 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_option_barrier_line_p | 注释缺失 | t98_otc_opt_comp_sub_trd_base_info | 163712 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_option_dailyrangeaccrual | 证券-期权-区间累积权属性 | t98_otc_opt_comp_sub_trd_base_info、t03_otc_opt_comp_sub_trd_scop_attr_info | 107281、107481、156499、211698 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_option_dailyrangeaccrual_p | 注释缺失 | t98_otc_opt_comp_sub_trd_base_info | 163712 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_option_deal_barrier | 场外交易-期权合约结构-障碍价格 | t03_otc_opt_comp_info、t98_otc_opt_comp_sub_trd_base_info、t03_otc_opt_comp_barr_pric_adtnl_info | 103943、105074、107281、107481、124563、209862、211549 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_option_deal_barrier_line | 交易障碍线信息表／／<font color='red'>REF</font>_<font color='red'>OPTION</font>_<font color='red'>DEAL</font>_<font color='red'>BARRIER</font>_<font color='red'>LINE</font> | t03_otc_opt_comp_barr_line_info | 139658 | DECLARATION_ONLY |
| odata_n_tit.d_ref_option_deal_barrier_p | 注释缺失 | t98_otc_opt_comp_sub_trd_base_info | 163712 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_option_deal_cr | 【AI】场外交易-期权合约结构-票息表 | t03_otc_opt_comp_coup_rate、t98_otc_deri_comp_sale_info | 112814、86840 | DECLARATION_ONLY／EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_option_deal_cr_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_option_deal_pr | 【AI】场外交易-期权合约结构-参与率表 | t03_otc_opt_comp_info、t98_otc_deri_comp_sale_info | 103943、105074、209862、86840 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_option_deal_pr_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_option_deal_quote_reset | 场外交易-<font color='red'>RESET</font>价格表 | t98_otc_opt_comp_sub_trd_base_info、t03_otc_opt_comp_conf_pric | 107281、107481、126200、211813 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_option_deal_quote_reset_p | 注释缺失 | t98_otc_opt_comp_sub_trd_base_info | 163712 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_option_deal_strike | 【AI】场外交易-期权合约结构-执行价格 | t98_otc_opt_comp_sub_trd_base_info、t03_otc_opt_comp_exer_pric、t98_otc_deri_comp_sale_info | 107281、107481、112815、112837、86840 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_option_deal_strike_p | 注释缺失 | t98_otc_opt_comp_sub_trd_base_info | 163712 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_option_deal_structure | 场外交易-期权交易结构表 | t98_otc_opt_comp_sub_trd_base_info、t03_otc_opt_comp_stru_elmn_info、t98_sb_otc_opt_comp_info、t98_otc_trd_comp_info、t98_otc_opt_comp_sub_trd_pal_sum、t98_otc_comp_marg_det、t98_sb_otc_deri_trd_evt_sum、t98_otc_deri_comp_sale_info | 107281、107481、108951、108952、119044、123781、163712、169145 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_option_deal_structure_p | 场外交易-期权交易结构表 | t98_otc_opt_comp_sub_trd_base_info、t03_otc_opt_comp_stru_elmn_info | 163712、210339 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_option_deal_structure_pb | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_option_dra_obs | 区间累积观察日表 | t98_otc_opt_comp_sub_trd_base_info、t03_otc_opt_comp_sub_trd_obsv_date_attr_info | 107281、107481、156492、211697 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_option_dra_obs_p | 注释缺失 | t98_otc_opt_comp_sub_trd_base_info | 163712 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_option_lizard_obs_date | <font color='red'>LIZARD</font>观察日信息表 | t98_otc_opt_comp_sub_trd_base_info、t03_otc_opt_comp_sub_trd_obsv_date_attr_info | 107281、107481、156494、211693 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_option_lizard_obs_date_p | 注释缺失 | t98_otc_opt_comp_sub_trd_base_info | 163712 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_otc_contr_margin_param | 【AI】合约-静态履约保证金参数 | t03_otc_comp_perf_marg_ref、t98_otc_deri_comp_sale_info | 105397、105946、220650、86840、86841 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_otc_contr_margin_param_p | 【AI】合约-静态履约保证金参数 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_otc_contr_margin_param_pb | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_otc_contr_precision_detail | 合约自定义精度配置表 | t03_otc_comp_calc_idx_precision_ref | 139660 | DECLARATION_ONLY |
| odata_n_tit.d_ref_otc_option_deal | 场外交易-期权交易合同要素表 | t03_agt_pty_rela_h、t03_agt_rela_h、t03_agt_stat_h、t03_otc_opt_comp_info、t03_agt、t03_agt_prd_rela_h、t03_agt_stati_info_h、t03_otc_opt_comp_sub_trd_info、t03_otc_comp_perf_marg_ref、t05_otc_comp_rgst_sac_evt、t98_otc_comp_crn_info、t03_agt_clas_h、t98_otc_opt_comp_sub_trd_base_info、t03_agt_agt_grp_rela_h、t98_otc_opt_comp_sub_trd_term_prcg_indx、t03_otc_opt_comp_obsv_date_coup_info、t03_otc_opt_comp_coup_rate、t03_otc_opt_comp_exer_pric、t98_sb_otc_opt_comp_info、t98_otc_trd_comp_info、t03_otc_opt_comp_barr_pric_adtnl_info、t03_otc_opt_comp_conf_pric、t99_deri_comp_sprd_coef_ref、t99_deri_comp_base_coef_ref、t03_deri_comp_sett_info、t03_agt_div_rati、t03_otc_opt_comp_reed_fee_flot_rati_info、t03_otc_comp_calc_idx_precision_ref、t03_otc_deri_agt_agt_grp_rela_adtnl_info、t98_sb_otc_opt_sub_trd_prcg_indx、t03_otc_deri_comp_contr_file_info、t03_otc_deri_comp_marg_info、t03_otc_deri_comp_undrl_lend_info、t98_sb_otc_deri_trd_evt_sum、t98_otc_deri_comp_sale_info | 103934、103936、103937、103943、105063、105074、105383、105386 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_otc_option_deal_p | 场外交易-期权交易合同要素表 | 未命中 | 149698、149699 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_otc_option_deal_pb | 场外交易-期权交易合同要素表 | t03_otc_opt_comp_info | 209862 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_rate_properites | 货币利率属性表 | t02_tit_ira_crrc_attr | 170648 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_rmb_midrate | 注释缺失 | t02_fxr_cfets_quot、t98_otc_deri_comp_sale_info | 105616、105863、144298、211752、86840 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_rmb_midrate_p | 注释缺失 | 未命中 | 144166、211754 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_rmb_midrate_pb | 注释缺失 | t02_fxr_cfets_quot | 144298、211752 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_sbl | <font color='red'>SBL</font>合约要素表／／<font color='red'>REF</font>_<font color='red'>SBL</font> | t03_agt_clas_h | 139853、211812 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_sbl_leg | <font color='red'>SBL</font>合约要素表／／<font color='red'>REF</font>_<font color='red'>SBL</font>_<font color='red'>LEG</font> | t03_otc_swap_comp_leg_info | 103942、105073、144299 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_sbl_p | <font color='red'>SBL</font>合约要素表／／<font color='red'>REF</font>_<font color='red'>SBL</font> | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_strategy_index | 策略指数维护表 | t02_idx_strg_matn_tit | 219012 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_trs | 场外交易-<font color='red'>TRS</font> | t03_agt、t03_agt_pty_rela_h、t03_agt_rela_h、t03_agt_stat_h、t03_otc_swap_comp_info、t03_agt_prd_rela_h、t03_agt_stati_info_h、t03_otc_comp_perf_marg_ref、t05_otc_comp_rgst_sac_evt、t98_otc_swap_comp_leg_valu_info、t98_otc_comp_crn_info、t03_agt_clas_h、t98_otc_swap_comp_trd_undrl_info、t98_otc_swap_comp_valu_sum、t03_agt_agt_grp_rela_h、t98_otc_trd_comp_info、t99_deri_comp_sprd_coef_ref、t99_deri_comp_base_coef_ref、t03_deri_comp_sett_info、t03_agt_div_rati、t03_otc_comp_calc_idx_precision_ref、t03_otc_deri_agt_agt_grp_rela_adtnl_info、t98_sb_otc_swap_comp_info、t03_otc_deri_comp_contr_file_info、t03_otc_deri_comp_marg_info、t03_otc_deri_comp_undrl_lend_info、t98_sb_otc_deri_trd_evt_sum、t98_otc_deri_comp_sale_info | 103930、103933、103935、103938、103941、105055、105058、105061 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_ref_trs_leg | 场外交易-<font color='red'>TRS</font>-<font color='red'>leg</font>基本信息 | t03_otc_swap_comp_leg_info、t03_otc_swap_comp_hold_info、t98_otc_swap_comp_trd_undrl_info、t98_otc_deri_comp_sale_adtnl_det、t98_otc_swap_comp_valu_sum、t05_otc_swap_comp_hold_chg_det、t98_sb_otc_deri_trd_evt_sum、t98_otc_deri_comp_sale_info | 103942、105073、105392、106083、107018、107024、107491、107937 | DECLARATION_ONLY／EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_trs_leg_p | 场外交易-<font color='red'>TRS</font>-<font color='red'>leg</font>基本信息 | 未命中 | 211618 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_trs_leg_pb | 场外交易-<font color='red'>TRS</font>-<font color='red'>leg</font>基本信息 | t03_otc_swap_comp_hold_info、t03_otc_swap_comp_leg_info | 144295、144299、160824 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_trs_p | 场外交易-<font color='red'>TRS</font> | 未命中 | 144144、211617 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_trs_pb | 场外交易-<font color='red'>TRS</font> | t03_agt_clas_h、t03_agt_rela_h、t03_agt_stati_info_h、t03_otc_swap_comp_info | 144287、144288、144289、144296、160830 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_vol_surface | 【AI】波动率曲面定义表 | t02_fin_vol_curv_surf | 103242、103243 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_vol_surface_structure | 【AI】波动率曲面结构定义 | t02_fin_vol_curv_surf | 103245、103246 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_volsurface_instance | 【AI】DM-波动率实例表 | t02_fin_vola_instc | 103248、103250 | EXPLICIT_REFERENCE |
| odata_n_tit.d_ref_volsurface_instance_p | 【AI】DM-波动率实例表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_ref_wind_yield_curve | 【AI】证券行情-WIND收益率曲线行情表 | t02_fin_curv_mkt_quot | 103198、103199 | EXPLICIT_REFERENCE |
| odata_n_tit.d_report_big_data_log | 执行大数据调度任务日志表 | 未命中 | 154782 | EXPLICIT_REFERENCE |
| odata_n_tit.d_report_option_autocall | 报备视图-雪球月报-期权端-20210901前历史数据 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_risk_accumulated_notional | 风险限额名义本金阈值 | t98_otc_deri_undrl_nom_prin_sum | 114019 | EXPLICIT_REFERENCE |
| odata_n_tit.d_risk_ctpty_limit_threshold | 【AI】风控视图-限额阈值 | t01_pty_lmt_h | 229973 | EXPLICIT_REFERENCE |
| odata_n_tit.d_risk_eod_report_metric_detail | 日终限额报告 | t98_otc_deri_undrl_trd_lmt_det | 134994 | EXPLICIT_REFERENCE |
| odata_n_tit.d_risk_eod_report_metric_value | 日终限额报告-指标实际值 | t98_otc_deri_undrl_trd_lmt_idx | 106216、107480 | DECLARATION_ONLY |
| odata_n_tit.d_risk_equity_market_value_acc | 【AI】限额-股票占总市值集中度 | t98_otc_deri_undrl_crn_info | 106217 | EXPLICIT_REFERENCE |
| odata_n_tit.d_risk_equity_nav_acc | 【AI】限额-股票占产品净值集中度 | t98_otc_comp_crn_info | 106214 | EXPLICIT_REFERENCE |
| odata_n_tit.d_risk_limit_index_info | 【AI】风控视图-限额指标信息表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_risk_long_short_acc | 限额-风控多空互换集中度指标 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_risk_option_initial_metric | 【AI】风控视图-期权日终指标表 | t98_sb_otc_opt_sub_trd_prcg_indx | 121573 | EXPLICIT_REFERENCE |
| odata_n_tit.d_risk_option_market_value_acc | 限额-期权市值指标 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_risk_pressure_test_loss_detail | 风控压力测试损失明细 | t03_otc_opt_comp_stres | 106208、107350 | EXPLICIT_REFERENCE |
| odata_n_tit.d_risk_quick_check_log | 速查记录表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_ab_swap_report | 交易-<font color='red'>AB</font>款子合约报备明细 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_atp_deal | 【AI】交易-场内交易成交表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_bundle_info | 【AI】合约组合参数配置父表 | t03_agt_grp、t03_otc_deri_comp_comb_adtnl_info、t98_otc_deri_comp_sale_info、t03_otc_deri_comp_comb_marg_call_info | 109800、142888、220650、232684、86840、86841 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_bundle_info_p | 【AI】合约组合参数配置父表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_bundle_info_pb | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_cumulator_schedule_daily | 累购累沽观察区间每日记录表 | t98_otc_opt_comp_sub_trd_base_info、t03_otc_opt_comp_obsv_scop_info | 107281、107481、208636 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_trd_cumulator_schedule_daily_p | 注释缺失 | t98_otc_opt_comp_sub_trd_base_info | 163712 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_daily_accrual_fee | 【AI】按日应计提费用表 | t98_otc_deri_comp_sale_adtnl_det、t98_otc_opt_comp_eday_prvs_fee、t98_otc_deri_comp_sale_info | 107491、124561、211547、86840 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_daily_accrual_fee_p | 【AI】按日应计提费用表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_daily_rebate_interest | 预付金返息每日计提明细表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_deal | 【AI】交易-场内交易成交表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_fast_trs_event | 极速互换存续期事件表 | t05_otc_comp_dura_chg_evt | 216458 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_fast_trs_event_p | 极速互换存续期事件表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_fee | 【AI】交易-费用定义 | t03_sb_otc_comp_trd_fee、t98_otc_opt_comp_sub_trd_pal_sum、t98_sb_otc_deri_trd_evt_sum | 110164、169145、228195 | DECLARATION_ONLY／EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_fee_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_fee_payment_schedule | 【AI】交易-费用支付列表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_fee_payment_schedule_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_hedge_product_info | 对冲品管理信息表 | t03_otc_deri_comp_hedg_prd_info | 210926 | DECLARATION_ONLY |
| odata_n_tit.d_trd_option_deal_settlement | 【AI】场外交易-期权交易结算表 | t03_otc_opt_comp_sett_info、t98_otc_deri_comp_sale_info | 112816、112838、86840 | DECLARATION_ONLY／EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_option_deal_settlement_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_option_event | 交易-OTC<font color='red'>OPTION</font>存续期事件表 | t98_otc_deri_comp_sale_adtnl_det、t05_otc_comp_dura_chg_evt、t98_sb_otc_deri_trd_evt_sum | 107491、124566、228195 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_option_limit_audit | 期权限额审核表 | t03_otc_opt_comp_info | 103943、105074、209862 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_option_limit_audit_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_otc_contr_files | 交易-交易-期权合约合同相关文件 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_otc_contr_initial_amt | 产品-合约初始保证金信息 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_otc_contr_props | 【AI】交易-场外合约结构-其他属性表 | t03_otc_swap_comp_info、t03_otc_opt_comp_info、t98_otc_comp_mng_rela_info、t03_agt_stati_info_h、t98_otc_deri_comp_sale_info | 103941、103943、105072、105074、105743、144296、209862、210925 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_otc_contr_props_p | 交易-场外合约结构-其他属性表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_otc_contr_report | 交易-合约报备信息 | t05_otc_comp_rgst_sac_evt、t98_otc_trd_comp_info、t98_otc_deri_comp_sale_info | 106204、107347、118156、123781、220650、86841 | DECLARATION_ONLY／EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_otc_contr_report_p | 交易-合约报备信息 | 未命中 | 211815 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_otc_contr_report_pb | 交易-合约报备信息 | 未命中 | 160829 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_otc_report_result | 交易-场外合约报备回写历史表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_otc_trade | 【AI】交易-OTC—交易表（父类） | t03_agt、t03_agt_prd_rela_h、t03_agt_stati_info_h、t03_agt_rela_h、t03_otc_opt_comp_sub_trd_info、t03_agt_clas_h、t98_otc_swap_comp_trd_undrl_info、t98_otc_opt_comp_sub_trd_base_info、t98_otc_swap_comp_valu_sum、t98_otc_opt_comp_sub_trd_term_prcg_indx、t98_sb_otc_opt_comp_info、t98_otc_trd_comp_info、t98_otc_opt_comp_eday_prvs_fee、t99_deri_comp_sprd_coef_ref、t99_deri_comp_base_coef_ref、t03_deri_comp_sett_info、t03_agt_div_rati、t03_otc_deri_agt_agt_grp_rela_adtnl_info、t03_otc_opt_comp_sub_trd_obsv_date_attr_info、t03_otc_opt_comp_sub_trd_barr_line_info、t03_otc_opt_comp_sub_trd_scop_attr_info、t03_otc_opt_comp_sub_trd_auto_redp_info、t98_sb_otc_opt_sub_trd_prcg_indx、t98_sb_otc_swap_comp_info、t98_otc_opt_comp_sub_trd_pal_sum、t03_otc_swap_comp_hold_info、t98_otc_swap_comp_leg_valu_info、t03_otc_opt_comp_obsv_scop_info、t03_otc_deri_comp_undrl_lend_info、t05_otc_comp_dura_chg_evt、t98_otc_deri_comp_sale_info、t98_sb_otc_deri_trd_evt_sum | 103930、105055、105383、105386、105387、105388、105395、105522 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_otc_trade_p | 【AI】交易-OTC—交易表（父类） | t98_otc_opt_comp_sub_trd_base_info | 163712、144141、146688、211614 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_otc_trade_pb | 【AI】交易-OTC—交易表（父类） | t03_agt_clas_h、t03_agt_rela_h、t03_agt_stati_info_h | 144287、144288、144289、160811 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_rebate_interest_param | 计提返息参数 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_transfer | 交易-收付款记录表 | t05_otc_recv_pymt_evt、t98_otc_opt_comp_sub_trd_base_info、t98_sb_otc_deri_trd_evt_sum | 104934、105080、107281、107481、160812、228195 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_transfer_p | 交易-收付款记录表 | t98_otc_opt_comp_sub_trd_base_info | 160420、163712、211648、151779 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_transfer_pb | 交易-收付款记录表 | 未命中 | 152125、160813 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_trs_event | 交易-<font color='red'>TRS</font>存续期事件表 | t05_otc_comp_dura_chg_evt、t98_sb_otc_deri_trd_evt_sum | 124565、166925、228195 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_trs_event_p | 交易-<font color='red'>TRS</font>存续期事件表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_trd_trs_event_struc_detail | 交易-<font color='red'>TRS</font>存续期事件结构化腿明细表 | t05_otc_swap_comp_hold_chg_det、t98_sb_otc_deri_trd_evt_sum | 124564、228195 | DECLARATION_ONLY／EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_trs_limit_audit | <font color='red'>TRS</font>_<font color='red'>LIMIT</font>_<font color='red'>AUDIT</font>表 | t03_otc_swap_comp_info | 103941、105072、144296 | EXPLICIT_REFERENCE |
| odata_n_tit.d_trd_trs_underlying_deal | 【AI】交易-南下跨境成交回报表 | t05_otc_deri_swap_mtch_retu_evt | 202899 | DECLARATION_ONLY |
| odata_n_tit.d_v_associated_product_a1002 | 主协议-关联产品列 | 未命中 | 128048 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_busi_representative_a1001 | 主协议-业务代表明细 | 未命中 | 128046 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_confirmationatt_a1017 | 交易确认书附件 | 未命中 | 127202 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_cus_ope_cabin_daily_hk | 【AI】持仓-客户运营视图每日数据表(香港) | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_cus_ope_capital | 【AI】资金账户指标表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_cus_operate_cabin | 【AI】交易对手合约信息 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_cus_operate_cabin_daily | 【AI】客户操作台-每日场外衍生品合约视图 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_ecif_capital_balance | <font color='red'>ECIF</font>视图-交易对手维度-资金余额信息 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_ecif_margin_balance | <font color='red'>ECIF</font>视图-交易对手维度-保证金数据 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_ecif_option_nav | <font color='red'>ECIF</font>视图-交易对手维度-期权净值（不含保证金） | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_ecif_trs_nav | <font color='red'>ECIF</font>视图-交易对手维度-互换净值数据（合约未实现收益） | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_equity_autocall_obs_info | 权衍部视图-雪球敲出信息表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_equity_option_contract_info | 权衍部视图-期权合约信息表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_equity_option_event_info | 权衍部视图-期权存续期事件 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_equity_option_transfer_info | 权衍部视图-期权<font color='red'>TRANSFER</font> | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_equity_plreport_contract | 权衍部视图-合约维度盈亏数据表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_equity_trs | 权益视图-互换合约要素 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_equity_trs_leg | 权益视图-互换合约腿要素 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_equity_trs_lifecycle | 权益视图-互换合约存续期事件 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_equity_trs_plreport | 权衍部视图-互换合约维度盈亏表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_equity_trs_transfer_info | 权衍部视图-互换<font color='red'>TRANSFER</font> | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_equity_trs_underlying | 权益视图-互换合约标的信息 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_equity_value_report | 权益视图-互换估值持仓数据 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_ficc_trs_position | 财务视图-互换合约及腿收益 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_ficc_trs_position_p | 财务视图-互换合约及腿收益 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_ficc_trs_position_pb | 财务视图-互换合约及腿收益 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_fin_capital_acct_mapping | 【AI】财务视图-Titans资金账户信息 | t98_otc_deri_ast_acct_bal_sum | 198021、199182 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_v_fin_capital_change | 资金总额变动视图 | t98_otc_deri_ast_acct_bal_chg_evt | 185038、199181 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_v_fin_margin_daily_report | 【AI】保证金余额 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_fin_option_info | 财务视图-<font color='red'>Tit</font>a<font color='red'>n</font>s期权信息 | t98_rep_fin_otc_deri_comp_info | 185518、199178 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_v_fin_option_trade_record | 财务视图-<font color='red'>OPTION</font>交易流水 | t98_rep_fin_otc_deri_comp_trd_evt | 185525、199180 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_v_fin_trs | 【AI】财务视图-Titans互换信息 | t98_rep_fin_otc_deri_comp_info | 185032、199176 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_v_fin_trs_plreport | 财务视图-<font color='red'>TRS</font>盈亏报表 | 未命中 | 121315 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_fin_trs_plreport_p | 财务视图-<font color='red'>TRS</font>盈亏报表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_fin_trs_trade_record | 【AI】财务视图-互换交易流水 | t98_rep_fin_otc_deri_comp_trd_evt | 184959、199179 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_tit.d_v_fin_trs_trade_record_p | 【AI】财务视图-互换交易流水 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_fin_trs_valuation | 【AI】财务视图-TRS估值 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_gfa_autocall_obs_info | 合约观察信息 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_gfa_eod_m2m_info | 【AI】资管视图-期权日终盯市信息表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_gfa_option_contract_info | 【AI】资管视图-期权交易要素信息 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_greeks_pricing_rm | 【AI】风控视图-子交易希腊值明细数据 | t02_opt_greek_val_det、t02_opt_greek_val_det_h | 103255、103256、114560、114561、245011 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_greeks_pricing_rm_all | 风控视图-子交易希腊值明细数据 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_greeks_pricing_rm_bak | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_greeks_pricing_rm_p | 注释缺失 | t02_opt_greek_val_det_h | 245011 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_ks_contract_param | 风控视图-金仕达互换合约信息 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_ks_cross_border_trs | 风控视图-金仕达互换合约盈亏信息 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_ks_trs_contract | 金仕达互换保证金信息表／／<font color='red'>V</font>_<font color='red'>KS</font>_<font color='red'>TRS</font>_<font color='red'>CONTRACT</font> | t03_otc_comp_perf_marg_ref | 140619、211526 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_margin_account_for_risk | 【AI】保证金账户视图 | 未命中 | 41825 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_margin_param_for_risk | 【AI】风控视图-保证金参数信息 | 未命中 | 41540 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_marketval_acc_for_risk | 【AI】风控视图-集中度数据 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_master_agrmt_a1001 | 场外衍生品主协议 | 未命中 | 128047 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_otc_plreport | 运管视图-期权日报盈亏视图 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_otc_plreport_trs | 【AI】TRS盈亏数据视图 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_otc_pos_eod_calc_metrics | 【AI】日终持仓-指标计算结果表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_otc_pos_position_daily | 【AI】持仓-账户每日持仓数据表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_otc_position_report_tit | 运管视图-持仓报表数据 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_otc_ref_otc_option_deal | 场外交易-期权交易合同要素表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_otc_ref_trs | 场外交易-<font color='red'>TRS</font> | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_otcm_se_event | 视图-运管交易所报备-事件 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_otcm_se_report | 视图-运管交易所报备 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_otcm_se_report_p | 视图-运管交易所报备 | 未命中 | 151780 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_otcm_se_report_pb | 视图-运管交易所报备 | 未命中 | 152123 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_plreport | 风控视图-基础盈亏视图 | t98_otc_opt_comp_sub_trd_pal_sum | 169145 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_customer_margin_a1020 | 协会报备-客户保证金 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_report_deri_rpt_a2001 | 报备视图-跨境月报 | t95_cbo_otc_deri_busi_det | 205224 | DECLARATION_ONLY |
| odata_n_tit.d_v_report_equity_inv_a2004 | <font color='red'>A2004</font> 跨境自营权益投资业务视图 | t95_cbo_sb_equi_ivst_busi_det | 242878 | DECLARATION_ONLY |
| odata_n_tit.d_v_report_file_info | 报备视图-报备用附件信息汇总视图 | 未命中 | 128212 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_file_info_ls | 报备视图-极速互换报备用附件信息汇总视图 | t95_otc_deri_rpt_doc_attach_info | 212702 | DECLARATION_ONLY |
| odata_n_tit.d_v_report_file_info_maspt |  | 未命中 | 191700 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_file_info_opt |  | 未命中 | 191702 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_file_info_p | 报备视图-报备用附件信息汇总视图 | 未命中 | 191700、191702、191703 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_file_info_sw |  | 未命中 | 191703 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_guarantee_agrmt_a1008 | 履约担保 | 未命中 | 128050 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_isda_a1013 | 协会报备-<font color='red'>ISDA</font>-汇总页 | 未命中 | 128201 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_isda_bymclywmx_a1013 | <font color='red'>ISDA</font>-本月末存量业务明细 | 未命中 | 128202 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_isda_byxzywmx_a1013 | <font color='red'>ISDA</font>-本月新增业务明细 | 未命中 | 128200 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_margin_a1020 | 协会报备-客户保证金 | t95_otc_deri_cust_bail_info | 207789 | DECLARATION_ONLY |
| odata_n_tit.d_v_report_margin_balance | 【AI】协会报备-保证金余额表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_report_margin_details_a1020 | 协会报备-客户保证金-履约保障品详情 | t95_otc_deri_cust_bail_colla_det | 207790 | DECLARATION_ONLY |
| odata_n_tit.d_v_report_margin_file_a1020 | 协会报备-客户保证金-客户保证金附件 | t95_otc_deri_cust_bail_attach | 207791 | DECLARATION_ONLY |
| odata_n_tit.d_v_report_monthlyreport_a2005 | 跨境场外衍生品业务视图 | t95_our_cbo_mth_rpt | 205225 | DECLARATION_ONLY |
| odata_n_tit.d_v_report_nafmii_a1012 | 协会报备-<font color='red'>NAFMII</font> | 未命中 | 128256 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_nafmii_qtjymxb_a1012 | 协会报备-<font color='red'>NAFMII</font>-其他交易明细表 | 未命中 | 128257 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_nib_trading_detail | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_report_nib_trading_pos | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_report_opt_accrual_a1004 | 期权结构类型-区间累计 | 未命中 | 128016 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_opt_airbag_a1004 | 期权结构类型-安全气囊 | 未命中 | 127953 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_opt_autocall_a1004 | 期权结构类型-自动赎回 | 未命中 | 127954 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_opt_barrier_a1004 | 期权结构类型-障碍及其组合 | 未命中 | 127962 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_opt_collateral_a1004 | 期权交易确认书-履约担保品 | 未命中 | 127947 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_opt_confirm_a1004 | 期权交易确认书 | 未命中 | 127924 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_opt_confirmatt_a1019 | 场外期权交易确认书附件 | 未命中 | 128021 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_opt_digital_a1004 | 期权结构类型-二元及其组合 | 未命中 | 127968 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_opt_others_a1004 | 期权结构类型-其他 | 未命中 | 128015 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_opt_termination_a1007 | 场外期权交易存续期管理 | 未命中 | 128018 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_opt_underlying_a1004 | 期权交易确认书-标的详情 | 未命中 | 127938 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_opt_valina_a1004 | 期权结构类型-香草 | 未命中 | 128017 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_opt_valuation_a1018 | 场外期权合约估值信息 | 未命中 | 128019 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_product_report | 报备-收益凭证报备 | t95_otc_deri_income_vchr_info | 223239 | DECLARATION_ONLY |
| odata_n_tit.d_v_report_sac_a1011 | <font color='red'>SAC</font>月报 | 未命中 | 128175 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_sac_bdqkydc_a1011 | <font color='red'>SAC</font>-标的情况与对冲 | 未命中 | 128199 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_sac_bymclywmx_a1011 | <font color='red'>SAC</font>-本月末存量业务明细 | 未命中 | 128198 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_sac_byxzywmx_a1011 | <font color='red'>SAC</font>-本月新增业务明细 | 未命中 | 128196 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_report_swap_coll_a1005_ls | 协会报备-互换交易确认书-履约担保品（多空互换） | t95_otc_deri_swap_trd_cfm_book_perf_colla | 207096 | DECLARATION_ONLY |
| odata_n_tit.d_v_report_swap_confatt_a1017_ls | 协会报备-交易确认书附件（多空互换） | t95_otc_deri_swap_trd_cfm_book_attach_info | 207103 | DECLARATION_ONLY |
| odata_n_tit.d_v_report_swap_confirm_a1005_ls | 协会报备-互换交易确认书（多空互换） | t95_otc_deri_swap_trd_cfm_book_info | 207097 | DECLARATION_ONLY |
| odata_n_tit.d_v_report_swap_fee_pay_a1005_ls | 协会报备-互换交易确认书-费用端支付（多空互换） | t95_otc_deri_swap_trd_cost_pymt_det | 207098 | DECLARATION_ONLY |
| odata_n_tit.d_v_report_swap_life_a1006_ls | 协会报备-互换交易存续期管理(多空互换) | t95_otc_deri_swap_trd_dura_oper_info | 207099 | DECLARATION_ONLY |
| odata_n_tit.d_v_report_swap_pay_a1016_ls | 协会报备-互换-权益端支付(多空互换) | t95_otc_deri_swap_trd_equi_pymt_main_info | 207100 | DECLARATION_ONLY |
| odata_n_tit.d_v_report_swap_pos_a1006_ls | 协会报备-互换-权益端持仓明细(多空互换) | t95_otc_deri_swap_trd_dura_comp_hold_det | 207101 | DECLARATION_ONLY |
| odata_n_tit.d_v_report_swap_tp_a1016_ls | 协会报备-互换-权益端支付明细(多空互换) | t95_otc_deri_swap_trd_equi_pymt_det | 207102 | DECLARATION_ONLY |
| odata_n_tit.d_v_retail_option_param | 零售视图-期权台账 | t98_otc_comp_ldg_det | 107631、109973、41831、71703 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_risk_audit_log | 风控视图-修改日志记录 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_capital_acct_info | 【AI】风控视图-资金账户余额 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_contr_capital_mapping | 【AI】合约与保证金账户对照关系 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_contr_margin_mapping | 【AI】风控视图-保证金与资金账户对照 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_contract_security_rela | 互换合约标的信息 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_correlation_info | 视图-风控相关性数据信息 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_counter_party | 交易对手 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_counter_party_tit | 交易对手 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_county_capital_mapping | 【AI】风控视图-交易对手资金账户 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_cross_border_trs | 【AI】风控视图-跨境互换 | t98_otc_swap_comp_pal_sum | 106589、107062、143973、143974 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_risk_daily_bundle_margin | 风控视图-每日组合履保计算结果 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_f_gfs_option | 【AI】风控视图-GFS期权信息 | 未命中 | 47250 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_risk_f_gfs_option_tit | 【AI】风控视图-GFS期权信息表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_hedging_position_tit | 【AI】风控视图-对冲交易持仓信息表 | 未命中 | 242032、242274 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_risk_hedging_position_tit_p | 【AI】风控视图-对冲交易持仓信息表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_hedging_position_tit_pb | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_limit_threshold | 风控视图-限额阈值 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_long_short_acc | 限额-风控多空互换集中度指标 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_margin_acct_info | 【AI】保证金详情表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_option_basket_info | 【AI】风控视图-期权篮子信息表 | t02_opt_mult_bask_info | 104226、104478、104481 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_risk_option_cross_metric | 【AI】风控视图-多标的期权交叉指标表 | t02_opt_mutl_undrl_prcg_indx | 104483、104484、244510 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_risk_option_cross_metric_p | 注释缺失 | t02_opt_mutl_undrl_prcg_indx | 244510 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_risk_option_info | 【AI】风控视图-期权子交易信息表 | t98_otc_opt_comp_sub_trd_base_info | 107281、107481、163712 | DECLARATION_ONLY |
| odata_n_tit.d_v_risk_option_info_p | 风控视图-期权子交易信息表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_option_margin | 风控视图-期权合约保证金流水表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_option_part_metric | 【AI】证券-期权每日日终压力测试指标表 | t02_opt_mutl_undrl_prcg_indx | 104487、104489、244515 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_risk_option_part_metric_p | 注释缺失 | t02_opt_mutl_undrl_prcg_indx | 244515 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_risk_otc_margin | 保证金信息 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_plreport | 风控视图-LIZAR<font color='red'>D</font>盈亏报表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_plreport_contract | 风控视图-合约维度盈亏数据表 | t98_otc_opt_inr_comp_pal_sum | 107284、107482、244380 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_risk_plreport_contract_all | 风控视图-合约维度盈亏数据表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_plreport_contract_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_plreport_contract_pb | 注释缺失 | t98_otc_opt_inr_comp_pal_sum | 244380 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_risk_plreport_contract_tmp | 风控视图-合约维度盈亏数据表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_plreport_contract_tmp_pb_h15risk | 风控视图-合约维度盈亏数据表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_plreport_tit | 【AI】风控视图-盈亏数据表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_presure_test_pd | 【AI】风控压力测试损失明细 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_pricing_bucket_metric | 风控视图-期权日终<font color='red'>bucket</font>定价指标表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_qis | 【AI】风控视图-风险指标表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_rm_bundlereport | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_rm_bundlereport_tit | 【AI】风控视图-期权子交易信息表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_tradereport_equity_tit | 【AI】风控视图-期权交易信息 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_transferreport | 【AI】风控视图-收付款信息表 | 未命中 | 47249 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_risk_transferreport_tit | 【AI】风控视图-收付款信息表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_trs_contract_param | <font color='red'>TRS</font>合约参数表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_risk_yield_curve | 【AI】风控视图-收益率曲线行情 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_sup_agrmt_a1003 | 补充协议 | 未命中 | 128049 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_swap_collateral_a1005 | 互换-履约担保品 | 未命中 | 127411 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_swap_confirmation_a1005 | 互换交易确认书 | 未命中 | 127680 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_swap_equity_payment_a1016 | 收益互换交易权益端支付 | 未命中 | 127236 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_swap_equity_payment_tp_a1016 | 收益互换交易权益端支付-权益端支付 | 未命中 | 127223 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_swap_fee_payment_a1005 | 互换交易确认书-费用端支付 | 未命中 | 127681 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_swap_lifecycle_a1006 | 互换交易存续期管理 | 未命中 | 127335 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_swap_lifecycle_pos_dt_a1006 | 互换交易存续期管理-合约持仓明细 | 未命中 | 127327 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_trs_for_risk | <font color='red'>TRS</font>监控表 | t98_otc_comp_marg_det | 176873、41828、71734 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_trs_nav_acc_for_risk | 【AI】风控视图-TRS净值数据 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_trs_param_for_risk | 期权台账 | t98_otc_comp_ldg_det | 107625、107647、41831、71703 | EXPLICIT_REFERENCE |
| odata_n_tit.d_v_type11_collateral | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_type11_collateral_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_wm_bundlereport_tit | 【AI】风控视图-期权子交易信息表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_wm_cashflow_report | 产品中心-现金流视图 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_wm_cashflow_report_tit | 【AI】风控视图-收付款信息表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_v_wm_greeks_pricing_tit | 【AI】风控视图-子交易希腊值明细数据 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_value_report_cap_flow_p | 统一估值报告-资金流水 | 未命中 | 167920 | EXPLICIT_REFERENCE |
| odata_n_tit.d_value_report_cap_flow_pb | 统一估值报告-资金流水 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_value_report_element_config | 指标定义-配置表 | t99_idx_def_info、t99_idx_rela_h、t99_otc_deri_valu_rpt_idx_def_adtnl_info | 173967、173971、173973 | DECLARATION_ONLY／EXPLICIT_REFERENCE |
| odata_n_tit.d_value_report_element_config_p | 【AI】指标定义-配置表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_value_report_element_result | 指标定义-结果表 | t98_otc_deri_valu_rpt_idx_calc_rslt | 173052 | DECLARATION_ONLY |
| odata_n_tit.d_value_report_element_result_p | 【AI】指标定义-结果表 | 未命中 | 147156 | EXPLICIT_REFERENCE |
| odata_n_tit.d_value_report_element_result_pb | 指标定义-结果表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_value_report_fast_cap_flow | 统一估值报告-极速资金流水表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_value_report_fee_details | 统一估值报告-费用明细表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_value_report_fee_details_p | 【AI】价值报告-费用明细表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_value_report_trs_tradeflow_p | 统一估值报告-互换交易流水 | 未命中 | 167884 | EXPLICIT_REFERENCE |
| odata_n_tit.d_value_report_trs_tradeflow_pb | 统一估值报告-互换交易流水 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.d_value_report_trs_underlying_p | 统一估值报告-互换标的分笔持仓 | 未命中 | 167916 | EXPLICIT_REFERENCE |
| odata_n_tit.d_value_report_trs_underlying_pb | 统一估值报告-互换标的分笔持仓 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.email_finbd_airbag_option_monthly_fee | FINBD气囊期权每月期权费数据表 | t98_otc_deri_arbg_opt_comp_opt_fee | 229583 | DECLARATION_ONLY |
| odata_n_tit.email_finbd_airbagx_liquidation_detail | FINBD年初到本季度末发生清算的已终止气囊X合约清算明细表 | t98_otc_deri_arbg_opt_comp_sett_det | 229582 | DECLARATION_ONLY |
| odata_n_tit.f_eq_lend_info | 已出借记录表 | t03_otc_deri_comp_undrl_lend_info | 209839 | DECLARATION_ONLY |
| odata_n_tit.f_ref_op_cumulator_schedule | Accumulator观察区间表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_ref_op_deal_autocall_kidate | 场外交易-期权敲出观察日及票息信息 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_ref_op_deal_autocall_kodate | 场外交易-期权敲出观察日及票息信息 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_ref_op_deal_float_back_fee | 期权后端费挂钩浮动利率表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_ref_op_deal_lizard_obsdate | 场外交易-Lizard观察日 | t03_otc_opt_comp_obsv_date_coup_info | 207944 | DECLARATION_ONLY |
| odata_n_tit.f_ref_op_deal_lizard_obsdate_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_ref_option_deal_barrier | 场外交易-期权合约结构-障碍价格 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_ref_option_deal_barrier_line | 交易障碍线信息表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_ref_option_deal_cr | 场外交易-期权合约结构-票息表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_ref_option_deal_pr | 场外交易-期权合约结构-参与率表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_ref_option_deal_quote_reset | 场外交易-Reset价格表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_ref_option_deal_strike | 场外交易-期权合约结构-执行价格 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_ref_option_deal_structure | 场外交易-期权交易结构表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_ref_option_margin_trs_relation | 期权合约与互换合约关联关系表 | t98_otc_deri_comp_sale_info | 86840、86841 | EXPLICIT_REFERENCE |
| odata_n_tit.f_ref_otc_contr_margin_param | 合约-静态履约保证金参数 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_ref_otc_option_deal | 场外交易-期权交易合同要素表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_trd_bundle_info | 合约组合参数配置父表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_trd_fee | 交易-费用定义 | t05_otc_deri_comp_fee_pymt_plan | 207947 | EXPLICIT_REFERENCE |
| odata_n_tit.f_trd_fee_payment_schedule | 交易-费用支付列表 | t05_otc_deri_comp_fee_pymt_plan、t98_sb_otc_deri_trd_evt_sum | 207947、228195 | DECLARATION_ONLY／EXPLICIT_REFERENCE |
| odata_n_tit.f_trd_fee_payment_schedule_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_trd_fee_rate_reset | 费率修改表 | t99_otc_deri_comp_fee_rate_info | 207937 | DECLARATION_ONLY |
| odata_n_tit.f_trd_option_deal_settlement | 场外交易-期权交易结算表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_trd_option_event | 交易-OTCOption存续期事件表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_trd_option_limit_audit | 期权限额审核表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_trd_option_process_condition | 期权流程定义条件表 | t00_req_proc_tplt_def_cond | 207936 | DECLARATION_ONLY |
| odata_n_tit.f_trd_option_process_def | 期权流程配置表 | t00_req_proc_tplt_info | 207935 | DECLARATION_ONLY |
| odata_n_tit.f_trd_otc_contr_files | 交易-交易-期权合约合同相关文件 | t03_otc_deri_comp_contr_file_info | 207946 | DECLARATION_ONLY |
| odata_n_tit.f_trd_otc_contr_initial_amt | 产品-合约初始保证金信息 | t03_otc_deri_comp_marg_info | 208637 | DECLARATION_ONLY |
| odata_n_tit.f_trd_otc_contr_props | 交易-场外合约结构-其他属性表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_trd_otc_prepay_coupon_date | 预付票息日期列表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_trd_otc_trade | 交易-OTC—交易表（父类） | 未命中 |  | 仅本地元数据 |
| odata_n_tit.f_trd_trs_udly_deal_allo | 交易- 交易型TRS成交回报分配表 | t05_otc_deri_swap_mtch_retu_asgn_evt | 202900 | DECLARATION_ONLY |
| odata_n_tit.g_capital_account | 客户资金账户信息 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.g_margin_account | 保证金-交易对手保证金账户 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.g_margin_acct_bundle_mapping | MARGIN_ACCT_BUNDLE_MAPPING | 未命中 |  | 仅本地元数据 |
| odata_n_tit.g_margin_acct_contract_mapping | 保证金-交易对手保证金账户与合约映射 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.g_margin_acct_daily_balance | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.g_margin_call_setting | 注释缺失 | t03_otc_deri_comp_comb_marg_call_info | 232684 | DECLARATION_ONLY |
| odata_n_tit.k_eq_equity_source | 券源名称管理 | t00_otc_deri_prd_pool_adtnl_info、t00_prd_pool_info | 208592、208593 | DECLARATION_ONLY |
| odata_n_tit.m_capital_account_p | 注释缺失 | 未命中 | 213177 | EXPLICIT_REFERENCE |
| odata_n_tit.m_capital_acct_current_balance_p | 注释缺失 | 未命中 | 213185 | EXPLICIT_REFERENCE |
| odata_n_tit.m_margin_account_p | 注释缺失 | 未命中 | 213178 | EXPLICIT_REFERENCE |
| odata_n_tit.m_margin_acct_bundle_mapping_p | 注释缺失 | 未命中 | 213180 | EXPLICIT_REFERENCE |
| odata_n_tit.m_margin_acct_current_balance_p | 注释缺失 | 未命中 | 213182 | EXPLICIT_REFERENCE |
| odata_n_tit.m_ref_cbond_rate | 注释缺失 | t02_ira_indx_info | 165804 | EXPLICIT_REFERENCE |
| odata_n_tit.m_ref_cbond_rate_p | 注释缺失 | t02_ira_indx_info_pb | 239826 | EXPLICIT_REFERENCE |
| odata_n_tit.m_ref_div_curve | 注释缺失 | t02_fin_curv_mkt_quot | 228422 | EXPLICIT_REFERENCE |
| odata_n_tit.m_ref_float_rate_formula | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.m_ref_float_rate_formula_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.m_ref_float_rate_formula_prop | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.m_ref_float_rate_formula_prop_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.m_ref_instrument_daily_info | 注释缺失 | 未命中 | 37022 | EXPLICIT_REFERENCE |
| odata_n_tit.m_ref_instrument_daily_info_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.m_ref_restricted_stock_daily | 注释缺失 | t02_stk_rstk_disc_info | 228593 | EXPLICIT_REFERENCE |
| odata_n_tit.n_ope_contract_repeat_check | 二次复核合约监控管理表 | t03_agt_stati_info_h | 215170 | EXPLICIT_REFERENCE |
| odata_n_tit.n_ope_incoming_detail | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.n_ope_settle_notice | 结算通知书主表 | t05_otc_deri_comp_sett_ntfc_send_evt | 181103 | EXPLICIT_REFERENCE |
| odata_n_tit.n_ope_settle_notice_transfer | 结算通知书 - 已生成 Transfer 记录 | t05_otc_deri_evt_rela_h | 185098 | EXPLICIT_REFERENCE |
| odata_n_tit.o_liq_clearing_trans | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.o_liq_clearing_trans_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.o_pos_otc_position_daily | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.otc_o_margin_account | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.otc_o_margin_parameter | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.otc_o_option_parameter | 期权台账 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.otc_o_otc_trs | <font color='red'>TRS</font>监控表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.p_prd_notes | 票据基础信息 | t02_tit_note_info | 160751、211487 | EXPLICIT_REFERENCE |
| odata_n_tit.p_prd_notes_trade_record | 票据交易流水 | t05_otc_deri_book_mtch_evt | 160714、211535 | DECLARATION_ONLY |
| odata_n_tit.p_prd_product | 产品基础信息 | t02_tit_prd_info | 160750、211488 | EXPLICIT_REFERENCE |
| odata_n_tit.p_prd_product_asset | 产品底层资产表 | t02_tit_prd_asset_info | 160753、211486 | EXPLICIT_REFERENCE |
| odata_n_tit.r_cfg_ice_listedoption | 注释缺失 | t02_stk_overseas_opt_cd_map | 218469 | EXPLICIT_REFERENCE |
| odata_n_tit.r_cfg_ins_be_share_proportion | 受益人持股比例监控标的 | t02_tit_stk_bene_owsr_prop | 208603 | EXPLICIT_REFERENCE |
| odata_n_tit.r_cfg_instrument_pool | 标的池属性表 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.r_cfg_instrument_pool_detail | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.r_cfg_instrument_pool_props | 配置-标的池标的属性表 | t02_fin_undrl_attr、t98_otc_deri_comp_sale_info | 158210、158292、86840、86841 | EXPLICIT_REFERENCE |
| odata_n_tit.r_cfg_instrument_pool_props_p | 配置-标的池标的属性表 | 未命中 | 151778 | EXPLICIT_REFERENCE |
| odata_n_tit.r_cfg_instrument_pool_props_pb | 配置-标的池标的属性表 | t02_fin_undrl_attr | 152121、158292 | EXPLICIT_REFERENCE |
| odata_n_tit.r_cfg_pricing_env_def | 注释缺失 | t02_fin_prcg_env_curv | 226617 | EXPLICIT_REFERENCE |
| odata_n_tit.r_ref_div_curve_def | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.r_ref_future_properties |  | 未命中 | 37058、37059、37060 | EXPLICIT_REFERENCE |
| odata_n_tit.r_ref_instrument | 证券基本信息 | 未命中 | 36711、37058、37060 | EXPLICIT_REFERENCE |
| odata_n_tit.r_ref_instrument_code | 注释缺失 | 未命中 | 36710 | EXPLICIT_REFERENCE |
| odata_n_tit.r_ref_listed_option_props | 注释缺失 | t02_opt_base_info_tit | 176204 | EXPLICIT_REFERENCE |
| odata_n_tit.r_ref_option_attribute | 注释缺失 | 未命中 | 37018 | EXPLICIT_REFERENCE |
| odata_n_tit.r_ref_option_barrieroption | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.r_ref_option_barrieroption_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.r_ref_option_cumulator | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.r_ref_option_cumulator_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.r_ref_option_digitaloption | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.r_ref_option_digitaloption_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.r_ref_option_general_info | 注释缺失 | 未命中 | 37015、37017 | EXPLICIT_REFERENCE |
| odata_n_tit.r_ref_option_history_info | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.r_ref_option_quote_reset | 期权reset行情 | t02_opt_mkt_quot | 139409 | EXPLICIT_REFERENCE |
| odata_n_tit.r_ref_option_quote_reset_rate | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.r_ref_option_vanillaoption | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.r_ref_option_vanillaoption_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.s_amazons3_file_info |  | 未命中 | 131135 | EXPLICIT_REFERENCE |
| odata_n_tit.s_v_confirmationatt_a1017 |  | 未命中 | 131094 | EXPLICIT_REFERENCE |
| odata_n_tit.s_v_ks_trade_comfirm_info |  | t03_otc_comp_perf_marg_ref | 140620 | EXPLICIT_REFERENCE |
| odata_n_tit.s_v_swap_collateral_a1005 |  | 未命中 | 131089 | EXPLICIT_REFERENCE |
| odata_n_tit.s_v_swap_confirmation_a1005 |  | 未命中 | 131088 | EXPLICIT_REFERENCE |
| odata_n_tit.s_v_swap_equity_payment_a1016 |  | 未命中 | 131092 | EXPLICIT_REFERENCE |
| odata_n_tit.s_v_swap_equity_payment_tp_a1016 |  | 未命中 | 131093 | EXPLICIT_REFERENCE |
| odata_n_tit.s_v_swap_fee_payment_a1005 |  | 未命中 | 131087 | EXPLICIT_REFERENCE |
| odata_n_tit.s_v_swap_lifecycle_a1006 |  | 未命中 | 131090 | EXPLICIT_REFERENCE |
| odata_n_tit.s_v_swap_lifecycle_pos_dt_a1006 |  | 未命中 | 131091 | EXPLICIT_REFERENCE |
| odata_n_tit.t_bk_book | 注释缺失 | 未命中 | 36705、37015、37066 | EXPLICIT_REFERENCE |
| odata_n_tit.t_ref_counter_party | 注释缺失 | 未命中 | 31943、32003、32004 | EXPLICIT_REFERENCE |
| odata_n_tit.t_ref_portfolio | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.t_ref_portfolio_element | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.t_ref_qfii_product_info | 注释缺失 | t03_agt_inr_list_det | 246200 | DECLARATION_ONLY |
| odata_n_tit.tit_r_ref_future_properties | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.tit_r_ref_instrument_code_s | 注释缺失 | 未命中 | 35017、37458、41392 | EXPLICIT_REFERENCE |
| odata_n_tit.tit_r_ref_instrument_wind_curve_s | 注释缺失 | t02_fin_curv_def | 172069、35016 | EXPLICIT_REFERENCE |
| odata_n_tit.union_risk_gfs_option | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.union_risk_rm_bundlereport | bundlereport | 未命中 |  | 仅本地元数据 |
| odata_n_tit.union_risk_transferreport | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.v_gpu_ma_eod_cross_metric | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.v_gpu_ma_eod_part_metric | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.v_gpu_ma_eod_pt_metric | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.v_pricing_bucket_metric | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.v_pricing_eod_cross_metric | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.v_pricing_eod_part_metric | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.v_pricing_listed_pt_metric | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.v_pricing_ma_eod_cross_metric | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.v_pricing_ma_eod_part_metric | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.v_pricing_ma_eod_pt_metric | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.v_pricing_monitor_pt_metric | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.v_pricing_option_eod_metric | 注释缺失 | 未命中 | 37021 | EXPLICIT_REFERENCE |
| odata_n_tit.v_pricing_option_eod_pt_metric | 注释缺失 | 未命中 | 37069 | EXPLICIT_REFERENCE |
| odata_n_tit.v_pricing_user_def_pt_metric | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_tit.w_act_hi_procinst | 注释缺失 | t05_tit_proc_instc | 128578 | DECLARATION_ONLY |
| odata_n_tit.w_act_hi_procinst_p | 注释缺失 | t05_tit_proc_instc | 210338 | EXPLICIT_REFERENCE |
| odata_n_tit.w_act_hi_varinst | 注释缺失 | t05_tit_proc_var_chg_evt | 128579 | DECLARATION_ONLY |
| odata_n_tit.w_plc_process_def | 流程定义管理 | t99_tit_proc_def_info | 128577 | DECLARATION_ONLY |
| odata_n_tit.w_plc_process_def_p | 注释缺失 | t99_tit_proc_def_info | 210337 | EXPLICIT_REFERENCE |
| odata_n_tit.xb_trd_deal | 注释缺失 | 未命中 |  | 仅本地元数据 |
