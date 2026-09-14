# OIS 源对象与入模检索索引

这是本地元数据与SQL的并集。模型目标栏是同任务候选，不是每源每目标的字段血缘；声明来源可用于解析宏源表，但仍需具体SQL核验。空白只表示本地未命中，不能解释为系统没有该功能。完整字段、来源说明、全部任务号见 [[00-20260911-认知实验/t03专题-协议/证据/衍生品补充/TIT-OIS全源对象及跨主题去向.json|JSON]]。

| 源对象 | 原始元数据说明 | 模型候选目标 | 任务号（前8） | 证据情况 |
|---|---|---|---|---|
| odata_n_ois.e_otc_portfolio_performance | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.f_amazons3_file_info | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.f_aml_beneficiary | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.f_aorg | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.f_auser | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.f_client_review_buffer | 注释缺失 | t98_otc_deri_cust_ecr | 216975 | EXPLICIT_REFERENCE |
| odata_n_ois.f_client_review_whitelist | 注释缺失 | t98_otc_deri_cust_ecr | 216975 | EXPLICIT_REFERENCE |
| odata_n_ois.f_counterparty_account | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.f_counterparty_introduction | 注释缺失 | t01_pty_div_rati、t01_otc_deri_cutp_intro_adtnl_info | 223223、223228 | DECLARATION_ONLY |
| odata_n_ois.f_counterparty_margin | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.f_counterparty_org | 注释缺失 | t98_otc_deri_cust_ecr | 216975 | EXPLICIT_REFERENCE |
| odata_n_ois.f_counterparty_trade_confirm | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.f_counterparty_trade_confirm_file | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.f_counterparty_trade_confirm_no | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.f_deriv_client_accounting_firm | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.f_deriv_client_accounting_penty | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.f_deriv_client_due_diligence | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.f_dictions | 注释缺失 | t98_otc_deri_cust_ecr | 216975 | EXPLICIT_REFERENCE |
| odata_n_ois.f_dictions_details | 注释缺失 | t98_otc_deri_cust_ecr | 216975 | EXPLICIT_REFERENCE |
| odata_n_ois.f_option_parameter_net | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.f_otc_derivative_counterparty | 注释缺失 | t98_otc_deri_cust_ecr | 216975 | EXPLICIT_REFERENCE |
| odata_n_ois.f_same_counterparty_input | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_aml_beneficiary | 受益所有人 | t01_bene_owner_dd_info | 149557 | EXPLICIT_REFERENCE |
| odata_n_ois.g_aml_counterparty | 交易对手 | t01_bene_owner_dd_info | 149557 | EXPLICIT_REFERENCE |
| odata_n_ois.g_autocall_scale_total | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_bus_type_capital_cost | 注释缺失 | t99_deri_comp_type_fnd_cost_ref | 133057 | DECLARATION_ONLY |
| odata_n_ois.g_client_revenue_coefficient | 客户创收系数配置表 | t99_deri_comp_type_income_coef_ref | 229588 | DECLARATION_ONLY |
| odata_n_ois.g_client_review_buffer | 注释缺失 | t98_otc_deri_cust_ecr | 216975 | EXPLICIT_REFERENCE |
| odata_n_ois.g_client_review_counterparty | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_client_review_whitelist | 注释缺失 | t98_otc_deri_cust_ecr | 216975 | EXPLICIT_REFERENCE |
| odata_n_ois.g_contract_spread_rate_temp | 交叉销售合约编号价差系数临时表 | t99_deri_comp_sprd_coef_ref | 133052、246739 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_ois.g_contract_spread_rate_temp_p | 交叉销售合约编号价差系数临时表 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_counterparty_benefit_over_list | 注释缺失 | t01_pty_owsr_over_prop_bene_info | 149555、166540 | EXPLICIT_REFERENCE |
| odata_n_ois.g_counterparty_linkman | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_counterparty_mailbox_info_p | 客户邮箱 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_counterparty_margin | 交易对手履保信息 | t01_cutp_perf_marg_info | 176166 | DECLARATION_ONLY |
| odata_n_ois.g_counterparty_org | 注释缺失 | t98_otc_deri_cust_ecr | 216975 | EXPLICIT_REFERENCE |
| odata_n_ois.g_counterparty_trade_confirm | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_counterparty_trade_confirm_file | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_counterparty_trade_confirm_no | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_cross_income_reward | 【AI】交叉收入奖励 | t98_otc_deri_undrl_income_rwd_sum | 203358 | DECLARATION_ONLY |
| odata_n_ois.g_cross_sell_approval_process | 销售收入审批流 | t05_otc_deri_comp_sale_income_para_appr_evt | 246857 | DECLARATION_ONLY |
| odata_n_ois.g_cross_sell_approval_process_p | 销售收入审批流 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_deriv_client_accounting_firm | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_deriv_client_accounting_penty | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_deriv_client_due_diligence | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_derivative_counterparty_brk | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_dictions | 注释缺失 | t98_otc_deri_cust_ecr | 216975 | EXPLICIT_REFERENCE |
| odata_n_ois.g_dictions_details | 注释缺失 | t98_otc_deri_cust_ecr | 216975 | EXPLICIT_REFERENCE |
| odata_n_ois.g_fdsypz_ledger | 【AI】浮动收益凭证台账 | t02_fin_float_income_vchr_info | 104907、104908、128177、89268 | EXPLICIT_REFERENCE |
| odata_n_ois.g_fdsypz_ledger_p | 注释缺失 | 未命中 | 89268 | EXPLICIT_REFERENCE |
| odata_n_ois.g_hk_account_info | 注释缺失 | t01_otc_deri_cutp_bnk_acct_adtnl_info、t01_pty_bnk_acct_h | 212182、212183 | DECLARATION_ONLY／EXPLICIT_REFERENCE |
| odata_n_ois.g_hk_counterparty | 香港交易对手 | t98_otc_trd_comp_info、t99_deri_cutp_comp_type_sprd_coef_ref、t01_pty、t01_indv、t01_corp_cust、t01_pty_idty_info、t01_pty_stat_h、t01_pty_name、t01_otc_deri_cust、t01_pty_cutp、t01_otc_cutp_valu_rpt_cfg_info、t98_cutp_base_info、t98_otc_deri_comp_sale_info、t98_otc_trd_cutp_hk_info、t01_cutp_perf_marg_info、t01_pty_imp_lkman、t01_pty_rate_h、t00_otc_doc_attach_adtnl_info | 123780、123781、133049、144556、144557、144558、144559、144560 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_ois.g_hk_counterparty_ftp_info |  | t01_otc_deri_cutp_ftp_dir | 212181 | EXPLICIT_REFERENCE |
| odata_n_ois.g_hk_counterparty_progress |  | t01_otc_deri_cutp_busi_proc_prog | 212180 | EXPLICIT_REFERENCE |
| odata_n_ois.g_hk_counterparty_td | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_hk_funds_interest_repayment | 注释缺失 | t01_pty_rate_h | 212179 | EXPLICIT_REFERENCE |
| odata_n_ois.g_hk_guarantee_agreement | 注释缺失 | t01_cutp_perf_marg_info | 212178 | DECLARATION_ONLY |
| odata_n_ois.g_hk_link_man_info | 注释缺失 | t01_pty_imp_lkman | 212177 | EXPLICIT_REFERENCE |
| odata_n_ois.g_hk_threshold |  | t01_otc_deri_cutp_isda_agt_thrh | 212650 | EXPLICIT_REFERENCE |
| odata_n_ois.g_hk_trader_authority | 注释缺失 | t01_pty_imp_lkman | 212176 | EXPLICIT_REFERENCE |
| odata_n_ois.g_hs_allbranch | 注释缺失 | t04_inr_org_stati_info_h | 246687 | EXPLICIT_REFERENCE |
| odata_n_ois.g_inr_base_rate | 销售收入内部合约基础系数维护表 | t99_otc_deri_inr_base_ref | 121683 | DECLARATION_ONLY |
| odata_n_ois.g_inr_contract_base_rate | 内部销售合约基础系数表 | t98_otc_comp_mng_rela_info、t99_deri_comp_base_coef_ref | 105743、133054、241466 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_ois.g_inr_contract_base_rate_temp | 内部销售合约基础系数临时表 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_inr_contract_mapping | 销售收入内部合约类型映射表 | t99_otc_deri_inr_base_mapping | 121685 | DECLARATION_ONLY |
| odata_n_ois.g_interest_payment_list | 付息日期 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_newthree_review_instruction | 注释缺失 | t05_neeq_make_mkt_undrl_eval_evt | 158028 | EXPLICIT_REFERENCE |
| odata_n_ois.g_option_parameter_net | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_otc_derivcodeoffer | 注释缺失 | t02_fin_offr_admin | 176202 | EXPLICIT_REFERENCE |
| odata_n_ois.g_otc_dictionary | 报价管理的资金类型映射表 | t02_bnd_income_vchr_ois_h、t02_bnd_income_vchr_ois_h05、t02_bnd_income_vchr_ois_pb_h | 96673、210709、219414、148207 | EXPLICIT_REFERENCE |
| odata_n_ois.g_otc_prod_contacts | 注释缺失 | t02_fin_prd_cont_info | 197317 | EXPLICIT_REFERENCE |
| odata_n_ois.g_process_expired_remind | 回访、证件到期、公开信息流程到期提醒表 | t05_otc_cutp_proc_exp_hint_evt | 133130、136324 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_ois.g_rev_hk_capital_cost | 销售收入资金成本（香港） | t99_deri_comp_type_fnd_cost_ref | 224026 | DECLARATION_ONLY |
| odata_n_ois.g_rev_hk_contract_commission_rate | 交叉销售合约编号佣金费率系数正式表 | t99_deri_comp_sprd_coef_ref | 224028 | DECLARATION_ONLY |
| odata_n_ois.g_rev_hk_cross_income_reward | 交叉收入奖励（香港） | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_rev_hk_sales_base_coef | 销售收入基础系数配置（香港） | t99_deri_comp_type_base_coef_ref | 224025 | DECLARATION_ONLY |
| odata_n_ois.g_rev_hkcpty_bid_ask_commission_rate | 销售收入交易对手佣金费率表（香港） | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_rev_hkcpty_bid_ask_spread_coef | 销售收入交易对手价差系数（香港） | t99_deri_cutp_comp_type_sprd_coef_ref | 224027 | DECLARATION_ONLY |
| odata_n_ois.g_same_counterparty | 同一客户表 | t01_same_pty_rela_adtnl_info、t01_pty_rela_h | 149556、149553 | EXPLICIT_REFERENCE |
| odata_n_ois.g_same_counterparty_input | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.g_same_manager_input | 注释缺失 | t02_co_imp_info | 229000 | EXPLICIT_REFERENCE |
| odata_n_ois.g_transm_flow |  | t05_otc_deri_cust_tran_proc | 229695 | EXPLICIT_REFERENCE |
| odata_n_ois.g_value_report_api_data | 注释缺失 | t05_otc_deri_send_cust_valu_rpt_create_evt | 167451、169162 | EXPLICIT_REFERENCE |
| odata_n_ois.g_value_report_config | 注释缺失 | t01_otc_cutp_valu_rpt_cfg_info | 147452、146618 | EXPLICIT_REFERENCE |
| odata_n_ois.g_value_report_ctpty_config | 估值报告交易对手配置表 | t01_pty_cutp_send_otc_deri_valu_rpt_plac_info | 161706、169644 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_ois.g_value_report_execution | 注释缺失 | t05_otc_cutp_valu_rpt_exec_evt | 147451、146619 | EXPLICIT_REFERENCE |
| odata_n_ois.g_value_report_gen_result | 估值报告生成记录表 | t05_otc_deri_send_cust_valu_rpt_create_evt | 161707、169162 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_ois.g_value_report_template_config | 模板管理配置表 | 未命中 | 161708 | EXPLICIT_REFERENCE |
| odata_n_ois.o_aml_his_riskrep_view | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_aml_riskrep_view | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_aorg | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_association_code_record | 注释缺失 | t02_fin_assc_cd_app_rec | 109939、89268、92540 | EXPLICIT_REFERENCE |
| odata_n_ois.o_auser | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_bpm_flow_result | 注释缺失 | 未命中 | 121422 | EXPLICIT_REFERENCE |
| odata_n_ois.o_bus_type_base_rate | 注释缺失 | t99_deri_comp_type_base_coef_ref | 133056 | DECLARATION_ONLY |
| odata_n_ois.o_contract_base_rate | 【AI】合约基础系数表 | t98_otc_comp_mng_rela_info、t99_deri_comp_base_coef_ref | 105743、133055、241466 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_ois.o_contract_base_rate_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_contract_introduction | 【AI】合约开发关系分成表 | t98_otc_comp_mng_rela_info、t03_agt_div_rati | 105743、134215、241466 | EXPLICIT_REFERENCE |
| odata_n_ois.o_contract_spread_rate | 【AI】合约价差系数表 | t99_deri_comp_sprd_coef_ref | 133052、246739 | DECLARATION_ONLY／EXPLICIT_REFERENCE |
| odata_n_ois.o_contract_spread_rate_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_counterparty_account | 注释缺失 | t01_pty_bnk_acct_h | 199856、43284、228157 | EXPLICIT_REFERENCE |
| odata_n_ois.o_counterparty_introduction | 【AI】开发关系表 | t98_otc_comp_mng_rela_info、t01_pty_emp_rela、t01_cust_emp_org_comb_div_rati | 105743、122367、134302、135142、241466 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_ois.o_counterparty_linkman | 注释缺失 | t01_pty_imp_lkman | 124884、43285、71107、227674、227984 | EXPLICIT_REFERENCE |
| odata_n_ois.o_ctpty_cross_sell_coefficient | 【AI】交易对手合约价差系数表 | t99_deri_cutp_comp_type_sprd_coef_ref | 133049 | DECLARATION_ONLY |
| odata_n_ois.o_ctpty_cross_sell_coefficient_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_deriv_client_admit_flow_brk | 注释缺失 | 未命中 | 121425 | EXPLICIT_REFERENCE |
| odata_n_ois.o_exchange_pre_termination_list | 注释缺失 | t02_fin_prd_preterm_info、t98_fms_liab_trd_basic、t98_liab_cashflow、t98_fms_liab_trd_basic_t0 | 110000、128177、146845、146882、148208、148508 | EXPLICIT_REFERENCE |
| odata_n_ois.o_exchange_pre_termination_list_p | 注释缺失 | 未命中 | 89268、147765 | EXPLICIT_REFERENCE |
| odata_n_ois.o_exchange_pre_termination_list_pb | 注释缺失 | 未命中 | 148208 | EXPLICIT_REFERENCE |
| odata_n_ois.o_flow_basic_info | 流程基础信息表 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_global_trs_view | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_long_short_view | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_margin_account | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_margin_parameter | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_option_parameter | 期权参数表 | 未命中 | 217451、43427、43428、228150、228152 | EXPLICIT_REFERENCE |
| odata_n_ois.o_option_parameter_notional | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_option_subject | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_otc_assets | 资产明细表 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_otc_derivative_counterparty | 衍生品交易对手维护表 | t98_otc_comp_mng_rela_info、t98_otc_trd_comp_info、t01_pty_clas_h、t01_pty_imp_lkman、t99_deri_cutp_comp_type_sprd_coef_ref、t01_pty_cutp、t01_cust_emp_org_comb_div_rati、t01_otc_cutp_valu_rpt_cfg_info、t01_pty_stati_info_h、t01_pty_owsr_over_prop_bene_info、t01_same_pty_rela_adtnl_info、t01_bene_owner_dd_info、t98_cutp_base_info、t98_sb_otc_swap_comp_info、t98_otc_deri_comp_sale_info、t01_pty、t01_corp_cust、t01_indv、t01_pty_addr_info、t01_corp_reg_info、t01_otc_deri_cust、t01_pty_indt_h、t01_pty_name、t01_pty_stat_h、t01_pty_idty_info、t01_pty_rat、t01_pty_imp_date_h、t01_cutp_perf_marg_info、t98_otc_deri_cust_ecr | 105743、117081、123780、123781、123977、124884、133049、134323 | EXPLICIT_REFERENCE／DECLARATION_ONLY |
| odata_n_ois.o_otc_derivative_counterparty_p | 衍生品交易对手维护表 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_otc_incomecertificate | 注释缺失 | t02_scr_type、t02_bnd_income_vchr_ois、t02_bnd_income_vchr_ois_h、t02_bnd_income_vchr_ois_h05、t98_fms_liab_trd_basic_t0 | 119829、39836、40208、65938、66251、92881、96673、210709 | EXPLICIT_REFERENCE |
| odata_n_ois.o_otc_incomecertificate_p | 注释缺失 | 未命中 | 147867 | EXPLICIT_REFERENCE |
| odata_n_ois.o_otc_incomecertificate_pb | 注释缺失 | t02_bnd_income_vchr_ois_h05、t02_bnd_income_vchr_ois_pb_h | 210709、219414、148207 | EXPLICIT_REFERENCE |
| odata_n_ois.o_otc_manual_input_sypz | 手工收入凭证 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_otc_prod_type_setting | 产品类型设置 | t02_fin_prd_type_setp | 109998、92540 | EXPLICIT_REFERENCE |
| odata_n_ois.o_otc_prod_type_setting_p | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_otc_trs | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_s_cust_appr_info | 注释缺失 | 未命中 | 170632 | EXPLICIT_REFERENCE |
| odata_n_ois.o_s_cust_cust_rel | 注释缺失 | 未命中 | 170622 | EXPLICIT_REFERENCE |
| odata_n_ois.o_s_org_cust_base_info | 注释缺失 | 未命中 | 170625 | EXPLICIT_REFERENCE |
| odata_n_ois.o_s_org_cust_cert_info | 注释缺失 | 未命中 | 170627 | EXPLICIT_REFERENCE |
| odata_n_ois.o_s_prod_cust_base_info | 注释缺失 | 未命中 | 170628 | EXPLICIT_REFERENCE |
| odata_n_ois.o_signed_multi_product_info | 代签产品信息(多产品) | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_signed_product_info | 代签产品情况 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_sypz_s3file_info | 注释缺失 | t02_fin_prd_att_info | 110022、96430 | EXPLICIT_REFERENCE |
| odata_n_ois.o_transaction_overview | 交易概况表 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_v_margin_account | 注释缺失 | 未命中 | 41825 | EXPLICIT_REFERENCE |
| odata_n_ois.o_v_margin_parameter | 注释缺失 | 未命中 | 41540 | EXPLICIT_REFERENCE |
| odata_n_ois.o_v_option_param | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_v_otc_trs_long_short | 注释缺失 | 未命中 | 41828、71734 | EXPLICIT_REFERENCE |
| odata_n_ois.o_weight_of_market_value_view | 注释缺失 | 未命中 |  | 仅本地元数据 |
| odata_n_ois.o_weight_of_nav_view | 注释缺失 | 未命中 |  | 仅本地元数据 |
