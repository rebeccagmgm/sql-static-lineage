# TIT 入模去向

这里按本地主模型库 pdata_n、pdata_news_n 的目标组织 305 个检索候选。297 个已取得 TIT 参与任务的读取证据；另有 5 个 LSS 显式读取、3 个宏来源未闭合的历史标记候选。这里仍不把同任务的全部输入输出配对为字段血缘。

完整源表名、物理身份、写次和任务证据见 [盘点 JSON](证据/TIT源与入模任务盘点.json)。字段与业务解释见 [关键链路](03-关键入模链路.md)。

## T01 当事人

| 目标                                   | TIT 参与证据任务数 | 检索候选任务号              | 未投影候选 |
| ------------------------------------ | ----------: | -------------------- | ----- |
| pdata_n.t01_cutp_perf_marg_plan_info |           1 | 200060               | 无     |
| pdata_n.t01_indv                     |           2 | 104298、105075        | 无     |
| pdata_n.t01_otc_deri_cust            |           1 | 150757               | 无     |
| pdata_n.t01_pty                      |           2 | 76984、77078          | 无     |
| pdata_n.t01_pty_clas_h               |           1 | 105380               | 无     |
| pdata_n.t01_pty_cutp                 |           2 | 105379、105518        | 无     |
| pdata_n.t01_pty_idty_info            |           1 | 219164               | 无     |
| pdata_n.t01_pty_imp_lkman            |           1 | 150755               | 无     |
| pdata_n.t01_pty_lmt_h                |           1 | 229973               | 无     |
| pdata_n.t01_pty_name                 |           2 | 104299、105076        | 无     |
| pdata_n.t01_pty_rat                  |           2 | 104300、105077        | 无     |
| pdata_n.t01_pty_rela_h               |           3 | 104301、105079、219175 | 无     |
| pdata_n.t01_pty_stati_info_h         |           3 | 114401、114423、173975 | 无     |
| pdata_n.t01_same_pty_rela_adtnl_info |           1 | 150759               | 无     |

## T02 产品

| 目标                                              | TIT 参与证据任务数 | 检索候选任务号                                   | 未投影候选                                                                                                       |
| ----------------------------------------------- | ----------: | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| pdata_news_n.t02_co_behav_info                  |           1 | 188381                                    | 无                                                                                                           |
| pdata_news_n.t02_fin_curv_def                   |           5 | 103203、103204、103207、103208、172069        | 无                                                                                                           |
| pdata_news_n.t02_fin_curv_fctr_def              |           1 | 170265                                    | 无                                                                                                           |
| pdata_news_n.t02_fin_curv_mkt_quot              |           5 | 103198、103199、103200、103201、228422        | 无                                                                                                           |
| pdata_news_n.t02_fin_cutp_bail_acct_daily_rslt  |           2 | 104658、104937                             | 无                                                                                                           |
| pdata_news_n.t02_fin_equi_fctr_info             |           1 | 168302                                    | 无                                                                                                           |
| pdata_news_n.t02_fin_prcg_env_curv              |           3 | 103238、103239、226617                      | 无                                                                                                           |
| pdata_news_n.t02_fin_prcg_env_divd_curv         |           2 | 103252、103253                             | 无                                                                                                           |
| pdata_news_n.t02_fin_prcg_vol_curv_surf         |           2 | 103249、103251                             | 无                                                                                                           |
| pdata_news_n.t02_fin_undrl_attr                 |           2 | 158210、158292                             | 无                                                                                                           |
| pdata_news_n.t02_fin_vol_curv_surf              |           4 | 103242、103243、103245、103246               | 无                                                                                                           |
| pdata_news_n.t02_fin_vola_instc                 |           2 | 103248、103250                             | 无                                                                                                           |
| pdata_news_n.t02_fut_base_info                  |           4 | 105612、105862、144301、211516               | 无                                                                                                           |
| pdata_news_n.t02_fut_base_info_ext              |           2 | 105745、105746                             | 无                                                                                                           |
| pdata_news_n.t02_fxr_cfets_quot                 |           4 | 105616、105863、144298、211752               | 无                                                                                                           |
| pdata_news_n.t02_idx_strg_matn_tit              |           1 | 219012                                    | 无                                                                                                           |
| pdata_news_n.t02_ira_indx_info                  |           1 | 165804                                    | 无                                                                                                           |
| pdata_news_n.t02_ira_indx_info_pb               |           1 | 239826                                    | 无                                                                                                           |
| pdata_news_n.t02_opt_base_info_tit              |           1 | 176204                                    | 无                                                                                                           |
| pdata_news_n.t02_opt_deri_idx                   |           1 | 119465                                    | 无                                                                                                           |
| pdata_news_n.t02_opt_greek_val_det              |           2 | 103255、103256                             | 103255: SQL_TIT_READ_AND_MODEL_WRITE_GRAPH_INCOMPLETE；103256: SQL_TIT_READ_AND_MODEL_WRITE_GRAPH_INCOMPLETE |
| pdata_news_n.t02_opt_greek_val_det_h            |           3 | 114560、114561、245011                      | 114560: SQL_TIT_READ_AND_MODEL_WRITE_GRAPH_INCOMPLETE；114561: SQL_TIT_READ_AND_MODEL_WRITE_GRAPH_INCOMPLETE |
| pdata_news_n.t02_opt_mkt_quot                   |           1 | 139409                                    | 无                                                                                                           |
| pdata_news_n.t02_opt_mult_bask_info             |           2 | 104478、104481                             | 无                                                                                                           |
| pdata_news_n.t02_opt_mutl_undrl_prcg_indx       |           6 | 104483、104484、104487、104489、244510、244515 | 无                                                                                                           |
| pdata_news_n.t02_opt_ost_qtf_sstv_indx_tit      |           1 | 219014                                    | 无                                                                                                           |
| pdata_news_n.t02_oth_corre_fctr                 |           1 | 117794                                    | 无                                                                                                           |
| pdata_news_n.t02_prd_unit_nav_s_tit             |           1 | 207284                                    | 无                                                                                                           |
| pdata_news_n.t02_scr_base_info                  |           2 | 103230、103232                             | 无                                                                                                           |
| pdata_news_n.t02_scr_base_info_newest_tit_tmp_b |           2 | 103230、103232                             | 无                                                                                                           |
| pdata_news_n.t02_scr_lbl                        |           1 | 127897                                    | 无                                                                                                           |
| pdata_news_n.t02_stk_overseas_opt_cd_map        |           1 | 218469                                    | 无                                                                                                           |
| pdata_news_n.t02_stk_rstk_disc_info             |           1 | 228593                                    | 无                                                                                                           |
| pdata_news_n.t02_tit_impl_vola_srfc_indx_info   |           1 | 240855                                    | 无                                                                                                           |
| pdata_news_n.t02_tit_ira_crrc_attr              |           1 | 170648                                    | 无                                                                                                           |
| pdata_news_n.t02_tit_note_info                  |           2 | 160751、211487                             | 无                                                                                                           |
| pdata_news_n.t02_tit_prd_asset_info             |           2 | 160753、211486                             | 无                                                                                                           |
| pdata_news_n.t02_tit_prd_info                   |           2 | 160750、211488                             | 无                                                                                                           |
| pdata_news_n.t02_tit_scr_base_info              |           6 | 103234、103235、103236、103237、144303、211515 | 无                                                                                                           |
| pdata_news_n.t02_tit_scr_trd_cal                |           1 | 161255                                    | 无                                                                                                           |
| pdata_news_n.t02_tit_scr_trd_cal_tit_temp       |           1 | 161255                                    | 无                                                                                                           |
| pdata_news_n.t02_tit_scr_trd_cal_tit_temp_not   |           1 | 161255                                    | 无                                                                                                           |
| pdata_news_n.t02_tit_stk_bene_owsr_prop         |           1 | 208603                                    | 无                                                                                                           |
| pdata_news_n.t02_tit_wi_undrl_pool              |           1 | 171427                                    | 无                                                                                                           |
| pdata_news_n.t02_tit_wi_undrl_pool_pb           |           1 | 221125                                    | 无                                                                                                           |

## T03 协议

| 目标 | TIT 参与证据任务数 | 检索候选任务号 | 未投影候选 |
|---|---:|---|---|
| pdata_n.t03_agt | 13 | 103928、103929、103930、105053、105054、105055、105381、105383、105521、105522、169636、183084、211541、107663 | 107663: MACRO_SOURCE_LSS_DECLARATION_UNRESOLVED |
| pdata_n.t03_agt_agt_grp_rela_h | 4 | 109798、109799、141600、183089 | 无 |
| pdata_n.t03_agt_clas_h | 5 | 106661、106676、139853、144287、211812 | 无 |
| pdata_n.t03_agt_div_rati | 1 | 134215 | 无 |
| pdata_n.t03_agt_grp | 1 | 109800 | 无 |
| pdata_n.t03_agt_inr_list_det | 1 | 246200 | 无 |
| pdata_n.t03_agt_name_h | 3 | 106660、106674、144290 | 无 |
| pdata_n.t03_agt_prd_rela_h | 2 | 105386、105526 | 无 |
| pdata_n.t03_agt_pty_rela_h | 9 | 103931、103932、103933、103934、105058、105384、107664、169637、183085、222317 | 107664: LSS_READ_WITH_TIT_LABEL |
| pdata_n.t03_agt_rela_h | 10 | 103935、103936、105061、105063、105388、105529、107938、108070、144288、183087、107665 | 107665: LSS_READ_WITH_TIT_LABEL |
| pdata_n.t03_agt_stat_h | 4 | 103937、103938、169638、183088、107666 | 107666: LSS_READ_WITH_TIT_LABEL |
| pdata_n.t03_agt_stati_info_h | 8 | 103939、105069、105385、105387、105527、144289、210925、215170 | 215170: SQL_TIT_READ_AND_MODEL_WRITE_GRAPH_INCOMPLETE |
| pdata_n.t03_ast_crrc_acct_bal | 4 | 107280、107646、112620、112644 | 无 |
| pdata_n.t03_deri_comp_sett_info | 1 | 134213 | 无 |
| pdata_n.t03_otc_comp_calc_idx_precision_ref | 1 | 139660 | 无 |
| pdata_n.t03_otc_comp_perf_marg_ref | 3 | 105397、105946、140619、147138、140620 | 140619: LSS_READ_WITH_TIT_LABEL；140620: LSS_READ_WITH_TIT_LABEL |
| pdata_n.t03_otc_cutp_marg_acct_perf_guar_rslt | 2 | 140935、147139、165155 | 140935: MACRO_SOURCE_LSS_DECLARATION_UNRESOLVED |
| pdata_n.t03_otc_deri_agt_agt_grp_rela_adtnl_info | 2 | 141595、141596 | 无 |
| pdata_n.t03_otc_deri_agt_rela_adtnl_info | 2 | 122185、122239 | 无 |
| pdata_n.t03_otc_deri_book_adtnl_info | 3 | 105382、106096、144293 | 无 |
| pdata_n.t03_otc_deri_book_agt_map_regu | 2 | 177928、211620 | 无 |
| pdata_n.t03_otc_deri_book_agt_trd_jour_map_regu | 1 | 180014 | 无 |
| pdata_n.t03_otc_deri_comp_comb_adtnl_info | 1 | 142888 | 无 |
| pdata_n.t03_otc_deri_comp_comb_marg_call_info | 1 | 232684 | 无 |
| pdata_n.t03_otc_deri_comp_contr_file_info | 1 | 207946 | 无 |
| pdata_n.t03_otc_deri_comp_hedg_prd_info | 1 | 210926 | 无 |
| pdata_n.t03_otc_deri_comp_marg_info | 1 | 208637 | 无 |
| pdata_n.t03_otc_deri_comp_undrl_lend_info | 1 | 209839 | 无 |
| pdata_n.t03_otc_fx_fwd_comp_info | 2 | 163771、211809 | 无 |
| pdata_n.t03_otc_fx_fwd_comp_stru_elmn_info | 2 | 163772、211810 | 无 |
| pdata_n.t03_otc_opt_comp_barr_line_info | 1 | 139658 | 无 |
| pdata_n.t03_otc_opt_comp_barr_pric_adtnl_info | 2 | 124563、211549 | 无 |
| pdata_n.t03_otc_opt_comp_conf_pric | 2 | 126200、211813 | 无 |
| pdata_n.t03_otc_opt_comp_coup_rate | 1 | 112814 | 无 |
| pdata_n.t03_otc_opt_comp_exer_pric | 2 | 112815、112837 | 无 |
| pdata_n.t03_otc_opt_comp_info | 3 | 103943、105074、209862 | 无 |
| pdata_n.t03_otc_opt_comp_obsv_date_coup_info | 5 | 112813、113014、113051、113053、207944 | 无 |
| pdata_n.t03_otc_opt_comp_obsv_scop_info | 3 | 156493、208636、211696 | 无 |
| pdata_n.t03_otc_opt_comp_reed_fee_flot_rati_info | 1 | 139657 | 无 |
| pdata_n.t03_otc_opt_comp_sett_info | 2 | 112816、112838 | 无 |
| pdata_n.t03_otc_opt_comp_stres | 2 | 106208、107350 | 无 |
| pdata_n.t03_otc_opt_comp_stru_elmn_info | 3 | 108951、108952、210339 | 无 |
| pdata_n.t03_otc_opt_comp_sub_trd_auto_redp_info | 2 | 156500、211596 | 无 |
| pdata_n.t03_otc_opt_comp_sub_trd_barr_line_info | 2 | 156498、211699 | 无 |
| pdata_n.t03_otc_opt_comp_sub_trd_info | 2 | 105395、107636 | 无 |
| pdata_n.t03_otc_opt_comp_sub_trd_obsv_date_attr_info | 10 | 156492、156494、156495、156496、156497、211692、211693、211694、211695、211697 | 无 |
| pdata_n.t03_otc_opt_comp_sub_trd_scop_attr_info | 2 | 156499、211698 | 无 |
| pdata_n.t03_otc_swap_comp_hold_info | 5 | 105392、106083、144295、183096、211472 | 无 |
| pdata_n.t03_otc_swap_comp_info | 7 | 103941、105072、112119、112120、144296、183091、211640 | 无 |
| pdata_n.t03_otc_swap_comp_leg_info | 5 | 103942、105073、144299、183093、211639 | 无 |
| pdata_n.t03_sb_otc_comp_trd_fee | 1 | 110164 | 无 |
| pdata_n.t03_tit_ast_acct_adtnl_info | 1 | 103940 | 无 |

## T04 内部机构

| 目标 | TIT 参与证据任务数 | 检索候选任务号 | 未投影候选 |
|---|---:|---|---|
| pdata_n.t04_inr_org | 1 | 165634 | 无 |
| pdata_n.t04_inr_org_name_h | 1 | 165635 | 无 |
| pdata_n.t04_inr_org_rela_h | 1 | 165637 | 无 |
| pdata_n.t04_otc_deri_dept_adtnl_info | 2 | 165638、211773 | 无 |
| pdata_n.t04_role | 1 | 159423 | 无 |
| pdata_n.t04_role_righ_h | 2 | 159421、178884 | 无 |
| pdata_n.t04_user | 1 | 159422 | 无 |
| pdata_n.t04_user_role_rela_h | 1 | 177461 | 无 |
| pdata_n.t04_user_stati_info_h | 1 | 159420 | 无 |

## T05 事件

| 目标                                           | TIT 参与证据任务数 | 检索候选任务号              | 未投影候选                                           |
| -------------------------------------------- | ----------: | -------------------- | ----------------------------------------------- |
| pdata_n.t05_otc_comp_dura_chg_evt            |           3 | 124565、124566、216458 | 无                                               |
| pdata_n.t05_otc_comp_rgst_sac_evt            |           2 | 106204、106205、107347 | 106205: MACRO_SOURCE_LSS_DECLARATION_UNRESOLVED |
| pdata_n.t05_otc_deri_book_mtch_evt           |           3 | 159419、160714、211535 | 无                                               |
| pdata_n.t05_otc_deri_comp_fee_pymt_plan      |           1 | 207947               | 无                                               |
| pdata_n.t05_otc_deri_comp_sett_ntfc_send_evt |           1 | 181103               | 无                                               |
| pdata_n.t05_otc_deri_cutp_fnd_chg_evt        |           1 | 173966               | 无                                               |
| pdata_n.t05_otc_deri_cutp_marg_chg_evt       |           1 | 173965               | 无                                               |
| pdata_n.t05_otc_deri_evt_rela_h              |           1 | 185098               | 无                                               |
| pdata_n.t05_otc_deri_swap_mtch_retu_asgn_evt |           1 | 202900               | 无                                               |
| pdata_n.t05_otc_deri_swap_mtch_retu_evt      |           1 | 202899               | 无                                               |
| pdata_n.t05_otc_recv_pymt_evt                |           2 | 104934、105080        | 无                                               |
| pdata_n.t05_otc_swap_comp_hold_chg_det       |           1 | 124564               | 无                                               |
| pdata_n.t05_sb_otc_comp_modif_log            |           1 | 114026               | 无                                               |
| pdata_n.t05_tit_proc_instc                   |           2 | 128578、210338        | 无                                               |
| pdata_n.t05_tit_proc_var_chg_evt             |           1 | 128579               | 无                                               |

## T06 区域

本地候选集未命中直接入模；未穷尽经过其他模型表的间接路径。

区域主题的核心模型、字段分工及已知来源见 [T06 区域范围说明](T06%20区域范围说明.md)。

## T07 营销

本地候选集未命中直接入模；未穷尽经过其他模型表的间接路径。

## T08 渠道

本地候选集未命中直接入模；未穷尽经过其他模型表的间接路径。

## T09 财务

本地候选集未命中直接入模；未穷尽经过其他模型表的间接路径。

## T10 资产

本地候选集未命中直接入模；未穷尽经过其他模型表的间接路径。
