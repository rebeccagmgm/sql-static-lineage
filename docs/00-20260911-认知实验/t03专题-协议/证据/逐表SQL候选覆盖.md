# 逐表 SQL 候选覆盖

2026-09-12 修正默认库名大小写及空值跨行读取。下列为词法候选，不是正式物理血缘。空库名写入单独显示，未强行认定为 PDATA_N。

共 256 个可解析对象；26 个未命中明确库范围内写候选，117 个未命中读候选。未命中不等于没有加工。

| 模型表 | 写候选数 | 读候选数 | 写任务入口（前8） | 空库名同名写候选（前8） |
|---|---:|---:|---|---|
| pdata_n.t03_acct_repo_risk_para_info | 4 | 0 | 61189、61191、63938、64279 |  |
| pdata_n.t03_acv_mkthold_seat | 1 | 1 | 78047 |  |
| pdata_n.t03_agt | 164 | 215 | 100665、103039、103928、103929、103930、105053、105054、105055 | 107958、140681、180270、157982、169641、185011、186390、186393 |
| pdata_n.t03_agt_acctnt_subj_rela_h | 1 | 2 | 90750 | 157979 |
| pdata_n.t03_agt_addr_info | 1 | 1 | 148857 |  |
| pdata_n.t03_agt_agt_grp_rela_h | 7 | 7 | 109798、109799、141600、183089、64355、82971、206695 | 246850 |
| pdata_n.t03_agt_algo_open_info | 1 | 0 | 237231 |  |
| pdata_n.t03_agt_algo_trd_acct_hold_adtnl | 0 | 0 |  | 205241 |
| pdata_n.t03_agt_algo_trd_strg_info | 4 | 2 | 205242、209835、217476、223247 |  |
| pdata_n.t03_agt_algo_trd_task_info | 2 | 2 | 216977、223013 |  |
| pdata_n.t03_agt_algo_trd_task_undrl_info | 2 | 2 | 216978、223014 |  |
| pdata_n.t03_agt_cash_guar_info | 0 | 0 |  | 178897 |
| pdata_n.t03_agt_clas_h | 10 | 25 | 104500、106661、106676、139853、144287、193730、211812、89050 |  |
| pdata_n.t03_agt_div_rati | 1 | 0 | 134215 |  |
| pdata_n.t03_agt_ei_hold_shr_info | 4 | 1 | 69196、69199、69878、69879 |  |
| pdata_n.t03_agt_emp_rela_h | 8 | 11 | 132319、132321、138935、162175、213380、215089、64082、64166 |  |
| pdata_n.t03_agt_fee_ref_info | 4 | 2 | 124117、208629、222322、115324 |  |
| pdata_n.t03_agt_grp | 3 | 3 | 109800、235482、85557 | 246849 |
| pdata_n.t03_agt_grp_rela_h | 0 | 0 |  |  |
| pdata_n.t03_agt_hold_shr_h | 41 | 72 | 100923、103614、123808、123809、130640、130641、133178、135146 | 200037、225972、157784、157785、57582、238303、238379、238380 |
| pdata_n.t03_agt_idty_info | 5 | 1 | 135152、64081、64083、240871、167932 |  |
| pdata_n.t03_agt_imp_date_h | 1 | 1 | 111412 | 203482 |
| pdata_n.t03_agt_inr_list_det | 8 | 0 | 123676、163656、232069、234622、235484、246200、92134、96686 |  |
| pdata_n.t03_agt_inr_org_div_info | 3 | 2 | 109527、123976、125080 |  |
| pdata_n.t03_agt_inr_org_rela_h | 52 | 53 | 102993、119500、140470、234625、36519、36520、36521、36523 |  |
| pdata_n.t03_agt_intr_h | 18 | 47 | 35132、35368、35370、35907、39907、49026、49027、53804 | 185015 |
| pdata_n.t03_agt_keep_ass_prop_h | 1 | 1 | 133995 | 180825 |
| pdata_n.t03_agt_lmt_h | 10 | 16 | 137268、37248、37385、61992、63961、63990、64129、64345 | 229250 |
| pdata_n.t03_agt_name_h | 33 | 48 | 100667、106660、106674、122075、122081、135150、144290、157719 | 180271、90834、92095、92096、92097、169642、186391、224853 |
| pdata_n.t03_agt_org_hrch_rela | 1 | 0 | 64137 |  |
| pdata_n.t03_agt_prd_lmt_h | 2 | 2 | 139143、163655 |  |
| pdata_n.t03_agt_prd_rela_h | 9 | 18 | 105386、105526、122076、122082、139059、139061、160935、160937 | 239219、240465、246199 |
| pdata_n.t03_agt_pty_rela_h | 91 | 98 | 102995、103931、103932、103933、103934、105058、105384、107664 | 140683、180274、221538、222320、232369、233445、233971、235951 |
| pdata_n.t03_agt_purch_equi | 4 | 0 | 38117、38118、64163、64164 |  |
| pdata_n.t03_agt_rat_h | 2 | 4 | 34954、64261 |  |
| pdata_n.t03_agt_rela_h | 85 | 99 | 102992、103041、103935、103936、105061、105063、105388、105529 | 199983、216980、232365、235952、239213、246142 |
| pdata_n.t03_agt_righ_h | 15 | 23 | 155023、158595、224275、37138、37139、63963、63964、64090 |  |
| pdata_n.t03_agt_sign_info | 3 | 0 | 215090、80260、98213 | 221390、223622 |
| pdata_n.t03_agt_stat_h | 107 | 146 | 100666、102991、103937、103938、121404、122073、122079、123804 | 140686、140687、185012、186392、221537、224852、232368、233447 |
| pdata_n.t03_agt_stati_info_h | 27 | 50 | 103939、105069、105385、105387、105527、109002、144289、155480 | 186385、189901、199853、212207 |
| pdata_n.t03_agt_user_rela_h | 8 | 8 | 131031、138937、139892、140617、213377、235014、63934、90831 | 239218 |
| pdata_n.t03_algo_trd_fnd_acct_adtnl_info | 1 | 0 | 218146 |  |
| pdata_n.t03_algo_trd_vrtl_fnd_acct | 0 | 0 |  | 159347 |
| pdata_n.t03_alm_liab_info | 1 | 0 | 90746 |  |
| pdata_n.t03_ams_fnd_acct | 4 | 10 | 40421、40422、64177、64178 | 233973、233974 |
| pdata_n.t03_ams_fnd_trd_acct | 4 | 7 | 40125、40126、63414、63415 | 235954 |
| pdata_n.t03_ams_prd_acct_info | 1 | 2 | 96590 |  |
| pdata_n.t03_ams_ta_shr_det | 7 | 2 | 122196、122199、122200、41163、41348、63975、63991 | 238305、238381、238382 |
| pdata_n.t03_ams_ta_stc_shr_info | 4 | 3 | 154894、64330、64452、64373 | 41241、238304 |
| pdata_n.t03_aplt_trd_ivstr_acct_list | 1 | 0 | 142887 |  |
| pdata_n.t03_arp_comp_info | 2 | 20 | 35753、63983 |  |
| pdata_n.t03_ast_acct | 3 | 79 | 182471、35803、63435 |  |
| pdata_n.t03_ast_acct_ass_scr_info | 1 | 0 | 100627 | 180826 |
| pdata_n.t03_ast_acct_marg_busi_prd_wl_det | 0 | 0 |  | 181043、181044 |
| pdata_n.t03_ast_acct_old_consu_cms_ref | 2 | 0 | 117787、117788 |  |
| pdata_n.t03_ast_acct_scr_crn_ctrl_info | 0 | 0 |  | 181041、181042 |
| pdata_n.t03_ast_acct_scr_ctrl_info | 3 | 0 | 205240、98215、98216 |  |
| pdata_n.t03_ast_acct_scr_grp_crn_ctrl_info | 1 | 0 | 181039 | 181040 |
| pdata_n.t03_ast_acct_spec_cash_ctrl | 2 | 0 | 101482、64091 |  |
| pdata_n.t03_ast_acct_trd_risk_ctrl | 3 | 0 | 61193、63936、63937 |  |
| pdata_n.t03_ast_acct_uft_mutl_center_info | 1 | 0 | 133997 |  |
| pdata_n.t03_ast_acct_undrl_scr_marg_bail_plac_info | 2 | 0 | 164897、164899 |  |
| pdata_n.t03_ast_crrc_acct_bal | 14 | 50 | 107280、107646、112620、112644、155479、37915、41753、46904 | 169155、218151 |
| pdata_n.t03_bed_bnk_acct_adtnl_info | 1 | 1 | 165645 |  |
| pdata_n.t03_bnk_acct | 7 | 12 | 165647、165648、165649、165652、41445、64270、96352 | 231855、231856 |
| pdata_n.t03_bnk_acct_bal | 1 | 0 | 121409 |  |
| pdata_n.t03_bond_coll_contr_adtnl_info | 2 | 5 | 113807、183117 | 211610 |
| pdata_n.t03_bond_iss_contr_cupt_det | 1 | 0 | 183120 | 211537 |
| pdata_n.t03_brok_ass_hold_det | 8 | 1 | 115322、115323、115490、115491、92483、92485、116439、116442 |  |
| pdata_n.t03_brok_ast_sati_equi_shr | 2 | 0 | 124567、124568 |  |
| pdata_n.t03_brp_comp_info | 3 | 7 | 102994、37086、64347 |  |
| pdata_n.t03_cash_agt_grp_adtnl_info | 1 | 1 | 85556 |  |
| pdata_n.t03_cash_comp_info | 4 | 4 | 45980、46237、64184、64189 |  |
| pdata_n.t03_cds_coll_acct_adtnl_info | 1 | 1 | 202187 |  |
| pdata_n.t03_cds_trd_acct | 2 | 4 | 154894、64452 | 64128 |
| pdata_n.t03_chrem_cash_acct | 1 | 2 | 90748 |  |
| pdata_n.t03_cntr_spec_chrem_shr_det | 1 | 0 | 128327 |  |
| pdata_n.t03_cntr_spec_fia_shr_det | 1 | 0 | 200757 |  |
| pdata_n.t03_cred_acct_ast_liab_info | 4 | 39 | 37044、53780、63933、64192 |  |
| pdata_n.t03_cred_acct_marg_coup_info | 2 | 0 | 136020、136022 |  |
| pdata_n.t03_cros_bord_chrem_agt_sign_info | 1 | 2 | 164367 |  |
| pdata_n.t03_csdc_scr_acct_adtnl_info | 1 | 6 | 136983 |  |
| pdata_n.t03_csdc_scr_acct_cmphs_data_serv_det | 1 | 0 | 183111 |  |
| pdata_n.t03_csdc_scr_acct_use_info | 2 | 4 | 130268、130271 |  |
| pdata_n.t03_csdc_sett_pty_bnk_acc | 1 | 1 | 122806 |  |
| pdata_n.t03_csdc_shr_stmt_det | 7 | 0 | 167372、167374、183100、183107、185023、185025、195443 |  |
| pdata_n.t03_csdc_sse_oth_shr_stmt_det | 1 | 0 | 183105 |  |
| pdata_n.t03_csdc_unqual_scr_acct_info | 1 | 1 | 130272 |  |
| pdata_n.t03_cstd_contr_info | 0 | 0 |  | 139056 |
| pdata_n.t03_cstd_prd_acct_pdc_tran_det | 1 | 0 | 105820 |  |
| pdata_n.t03_cust_brok_entr_agt | 4 | 1 | 46628、46629、64152、64153 |  |
| pdata_n.t03_cvs_mkthold_acct | 0 | 0 |  | 73056 |
| pdata_n.t03_deri_comp_sett_info | 1 | 0 | 134213 |  |
| pdata_n.t03_exch_opt_comb_info | 2 | 0 | 37221、63939 |  |
| pdata_n.t03_exch_opt_occp_marg_h | 4 | 10 | 36783、36784、64125、64126 |  |
| pdata_n.t03_exch_scr_unfnsh_det | 10 | 20 | 154894、46826、48275、63075、63158、64452、74307、74308 |  |
| pdata_n.t03_extspd_strg_trd_cust_mngr_acct_info | 1 | 1 | 140618 |  |
| pdata_n.t03_fap_firm_comb_hold_info | 2 | 3 | 62495、64269 |  |
| pdata_n.t03_fap_simu_trd_comb_adtnl_info | 1 | 5 | 100664 |  |
| pdata_n.t03_fia_acct_excp_det | 1 | 0 | 64058 |  |
| pdata_n.t03_fia_ast_uint_hold_adtnl | 2 | 0 | 50761、63154 |  |
| pdata_n.t03_fia_ast_unit_info | 1 | 1 | 64170 |  |
| pdata_n.t03_fia_ast_unit_trd_acct | 2 | 3 | 47020、63117 |  |
| pdata_n.t03_fin_exer_comp_info | 2 | 7 | 37253、63994 |  |
| pdata_n.t03_fin_exer_sell_repy_det | 1 | 1 | 86923 |  |
| pdata_n.t03_fin_leas_comp_adtnl_info | 1 | 1 | 163681 |  |
| pdata_n.t03_fin_leas_comp_loan_det | 1 | 1 | 163682 |  |
| pdata_n.t03_fin_leas_comp_loan_det_cash_flow | 1 | 0 | 164368 |  |
| pdata_n.t03_fin_loan_comp_adtnl_info | 0 | 0 |  | 164892 |
| pdata_n.t03_fin_loan_comp_wthdr_det | 0 | 0 |  | 164895 |
| pdata_n.t03_fnd_admin_bnk_acct_info | 1 | 0 | 139654 |  |
| pdata_n.t03_fnd_admin_prov_acct_info | 1 | 0 | 140474 |  |
| pdata_n.t03_fnd_sav_agt | 0 | 0 |  | 92089 |
| pdata_n.t03_fnd_sett_bank_acct_info | 1 | 1 | 109093 |  |
| pdata_n.t03_foc_bnk_acct_info | 1 | 1 | 91931 |  |
| pdata_n.t03_foc_fnd_bnk_acct | 1 | 1 | 91930 |  |
| pdata_n.t03_fund_admin_hk_pb_fin_acct_adtnl_info | 0 | 0 |  | 169643、211469 |
| pdata_n.t03_futr_fnd_crrc_acct_bal | 1 | 0 | 91842 |  |
| pdata_n.t03_futr_o32_ast_unit | 0 | 0 |  | 92101 |
| pdata_n.t03_futr_o32_comb | 0 | 0 |  | 92100 |
| pdata_n.t03_futr_o32_comb_hold_adtnl | 0 | 0 |  | 92099 |
| pdata_n.t03_futr_o32_prd_acct | 0 | 0 |  | 92098 |
| pdata_n.t03_futr_opt_hold_adtnl | 1 | 0 | 91841 |  |
| pdata_n.t03_gem_acct_elig_info | 1 | 1 | 82970 |  |
| pdata_n.t03_gfhk_liab_busi_det | 1 | 0 | 183124 | 211539 |
| pdata_n.t03_gks_ord_info | 2 | 4 | 64052、44478 |  |
| pdata_n.t03_gks_potn_ord_info | 0 | 0 |  | 64244 |
| pdata_n.t03_ia_agt_fare_cal_pd | 1 | 4 | 93014 |  |
| pdata_n.t03_ia_sign_agt | 2 | 11 | 49074、64071 |  |
| pdata_n.t03_ia_simu_trd_comb_hold_adtnl | 1 | 0 | 135143 |  |
| pdata_n.t03_ics_agt_sign_adtnl | 1 | 0 | 87440 |  |
| pdata_n.t03_income_vchr_hold_adtnl | 1 | 5 | 86922 |  |
| pdata_n.t03_indt_acct_list | 1 | 0 | 64331 |  |
| pdata_n.t03_intel_cond_ord | 7 | 0 | 80254、80256、80257、80258、93518、189432、189434 |  |
| pdata_n.t03_labor_contr_info | 1 | 1 | 222592 |  |
| pdata_n.t03_lmt_marg_comp_repy_info | 0 | 0 |  | 93016 |
| pdata_n.t03_load_agt_adtnl_info | 1 | 1 | 183119 | 211607 |
| pdata_n.t03_loan_agt_cutp_lmt_h | 1 | 1 | 183121 | 211536 |
| pdata_n.t03_lp_sett_rsrv_acct | 1 | 1 | 122807 |  |
| pdata_n.t03_lp_sett_rsrv_acct_bal | 1 | 0 | 121408 |  |
| pdata_n.t03_marg_comp_info | 2 | 24 | 35612、63115 |  |
| pdata_n.t03_marg_comp_info_t0 | 3 | 2 | 101484、102638、102639 | 101486、102665、102666 |
| pdata_n.t03_marg_contr_info | 2 | 7 | 35611、64315 |  |
| pdata_n.t03_nation_debt_impa | 4 | 6 | 36211、48267、63619、63622 |  |
| pdata_n.t03_nbo_bill_center_appr_ord_adtnl_info | 1 | 0 | 234626 |  |
| pdata_n.t03_new_med_acct_adtnl_info | 1 | 1 | 213381 | 226118 |
| pdata_n.t03_oao_ord_info | 2 | 4 | 51626、64210 |  |
| pdata_n.t03_opt_ast_acct_marg_flot_info | 3 | 0 | 36632、64193、64213 |  |
| pdata_n.t03_opt_ast_acct_prd_lmt_info | 3 | 0 | 36633、64036、64212 |  |
| pdata_n.t03_opt_cptl_scr_comp_info | 1 | 0 | 140473 |  |
| pdata_n.t03_opt_ia_agt_adtnl_info | 1 | 0 | 215084 |  |
| pdata_n.t03_ord | 19 | 20 | 105812、119397、123805、140961、140962、168843、215088、64155 | 108419、221539 |
| pdata_n.t03_org_busi_contr_info | 1 | 0 | 157720 |  |
| pdata_n.t03_otc_chrem_acct | 3 | 17 | 152697、35804、63437 |  |
| pdata_n.t03_otc_chrem_fix_ivst_comp | 5 | 2 | 139044、39087、45225、64019、64195 | 232366 |
| pdata_n.t03_otc_chrem_fix_ivst_hold_adtnl | 1 | 1 | 135145 |  |
| pdata_n.t03_otc_chrem_fix_ivst_plan_info | 1 | 0 | 215169 |  |
| pdata_n.t03_otc_comp_calc_idx_precision_ref | 1 | 0 | 139660 |  |
| pdata_n.t03_otc_comp_perf_marg_ref | 5 | 0 | 105397、105946、140619、147138、140620 | 211526 |
| pdata_n.t03_otc_cutp_marg_acct_perf_guar_rslt | 3 | 3 | 140935、147139、165155 |  |
| pdata_n.t03_otc_deri_agt_agt_grp_rela_adtnl_info | 2 | 2 | 141595、141596 |  |
| pdata_n.t03_otc_deri_agt_rela_adtnl_info | 2 | 2 | 122185、122239 |  |
| pdata_n.t03_otc_deri_book_adtnl_info | 3 | 15 | 105382、106096、144293 |  |
| pdata_n.t03_otc_deri_book_agt_map_regu | 2 | 0 | 177928、211620 |  |
| pdata_n.t03_otc_deri_book_agt_trd_jour_map_regu | 1 | 0 | 180014 |  |
| pdata_n.t03_otc_deri_book_ext_hold_info | 1 | 0 | 175396 |  |
| pdata_n.t03_otc_deri_comp_comb_adtnl_info | 1 | 1 | 142888 |  |
| pdata_n.t03_otc_deri_comp_comb_marg_call_info | 1 | 0 | 232684 |  |
| pdata_n.t03_otc_deri_comp_contr_file_info | 1 | 0 | 207946 |  |
| pdata_n.t03_otc_deri_comp_hedg_prd_info | 1 | 0 | 210926 |  |
| pdata_n.t03_otc_deri_comp_marg_info | 1 | 0 | 208637 |  |
| pdata_n.t03_otc_deri_comp_undrl_lend_info | 1 | 0 | 209839 |  |
| pdata_n.t03_otc_deri_hedg_acct_info | 0 | 0 |  | 171897 |
| pdata_n.t03_otc_fx_fwd_comp_info | 2 | 0 | 163771、211809 |  |
| pdata_n.t03_otc_fx_fwd_comp_stru_elmn_info | 2 | 0 | 163772、211810 |  |
| pdata_n.t03_otc_opt_comp_barr_line_info | 1 | 0 | 139658 |  |
| pdata_n.t03_otc_opt_comp_barr_pric_adtnl_info | 2 | 2 | 124563、211549 |  |
| pdata_n.t03_otc_opt_comp_conf_pric | 2 | 2 | 126200、211813 |  |
| pdata_n.t03_otc_opt_comp_coup_rate | 1 | 0 | 112814 |  |
| pdata_n.t03_otc_opt_comp_exer_pric | 2 | 2 | 112815、112837 |  |
| pdata_n.t03_otc_opt_comp_info | 3 | 8 | 103943、105074、209862 | 110183、211590、233448 |
| pdata_n.t03_otc_opt_comp_obsv_date_coup_info | 5 | 0 | 112813、113014、113051、113053、207944 |  |
| pdata_n.t03_otc_opt_comp_obsv_scop_info | 3 | 2 | 156493、208636、211696 |  |
| pdata_n.t03_otc_opt_comp_reed_fee_flot_rati_info | 1 | 0 | 139657 |  |
| pdata_n.t03_otc_opt_comp_sett_info | 2 | 0 | 112816、112838 |  |
| pdata_n.t03_otc_opt_comp_stres | 2 | 0 | 106208、107350 |  |
| pdata_n.t03_otc_opt_comp_stru_elmn_info | 3 | 10 | 108951、108952、210339 | 233450 |
| pdata_n.t03_otc_opt_comp_sub_trd_auto_redp_info | 2 | 4 | 156500、211596 |  |
| pdata_n.t03_otc_opt_comp_sub_trd_barr_line_info | 2 | 2 | 156498、211699 |  |
| pdata_n.t03_otc_opt_comp_sub_trd_info | 2 | 9 | 105395、107636 |  |
| pdata_n.t03_otc_opt_comp_sub_trd_obsv_date_attr_info | 10 | 2 | 156492、156494、156495、156496、156497、211692、211693、211694 |  |
| pdata_n.t03_otc_opt_comp_sub_trd_scop_attr_info | 2 | 2 | 156499、211698 |  |
| pdata_n.t03_otc_swap_comp_bal_info | 1 | 3 | 151343 |  |
| pdata_n.t03_otc_swap_comp_hold_info | 7 | 6 | 105392、106083、144295、183096、211472、106060、150114 |  |
| pdata_n.t03_otc_swap_comp_info | 9 | 16 | 103941、105072、112119、112120、144296、151342、183091、211608 |  |
| pdata_n.t03_otc_swap_comp_leg_info | 5 | 7 | 103942、105073、144299、183093、211639 |  |
| pdata_n.t03_otc_swap_comp_nom_prin | 1 | 0 | 237232 |  |
| pdata_n.t03_otc_swap_comp_pos_hold_undrl_info | 2 | 0 | 238504、238505 |  |
| pdata_n.t03_otc_swap_comp_pos_info | 1 | 0 | 238502 |  |
| pdata_n.t03_our_bank_sav | 1 | 1 | 186394 |  |
| pdata_n.t03_our_bank_sav_eday_det | 1 | 0 | 186395 |  |
| pdata_n.t03_pb_ast_unit | 3 | 4 | 38174、64313、64314 |  |
| pdata_n.t03_pb_ast_unit_oper_busi_righ | 1 | 0 | 64342 |  |
| pdata_n.t03_pb_fnd_acct | 11 | 14 | 130260、131032、160933、167934、224271、235012、235016、37947 |  |
| pdata_n.t03_pb_scr_acct | 1 | 2 | 64134 |  |
| pdata_n.t03_pb_work_flow_agt_rela_h | 1 | 1 | 130273 |  |
| pdata_n.t03_pens_ast_acct_adtnl_info | 1 | 2 | 88540 |  |
| pdata_n.t03_plcy_adtnl_info | 1 | 8 | 162180 |  |
| pdata_n.t03_plcy_adtnl_prd_info | 0 | 0 |  | 162179 |
| pdata_n.t03_pmb_scor_ord_info | 1 | 1 | 93304 |  |
| pdata_n.t03_prd_cstd_unit_adtnl_info | 1 | 1 | 139060 |  |
| pdata_n.t03_prd_ext_ord | 1 | 1 | 168842 |  |
| pdata_n.t03_prd_insure_ord | 0 | 3 |  |  |
| pdata_n.t03_prd_ord_info | 4 | 24 | 52731、52732、63980、63981 |  |
| pdata_n.t03_prd_sign_agt | 2 | 0 | 233908、74993 |  |
| pdata_n.t03_purch_contr_pymt_det | 0 | 0 |  | 100669 |
| pdata_n.t03_qrp_agt | 1 | 0 | 119502 |  |
| pdata_n.t03_ras_ivst_plan_ord | 1 | 0 | 123806 |  |
| pdata_n.t03_ref_comp_info | 8 | 17 | 45187、45188、45189、45190、64172、64175、64176、64305 |  |
| pdata_n.t03_ref_contr_info | 2 | 2 | 44974、64098 |  |
| pdata_n.t03_refin_lend_acct | 1 | 4 | 92730 |  |
| pdata_n.t03_rstk_sell_ctrl_info | 2 | 6 | 92767、92769 |  |
| pdata_n.t03_sb_fwd_buyt_repo_comp | 1 | 1 | 77616 |  |
| pdata_n.t03_sb_gold_delay_comp_hold_info | 1 | 0 | 221388 |  |
| pdata_n.t03_sb_nstd_fin_inst_comp | 1 | 1 | 90753 | 152168 |
| pdata_n.t03_sb_opt_ast_acct_bal | 2 | 0 | 134312、134316 | 157786、157787 |
| pdata_n.t03_sb_otc_comp_trd_fee | 1 | 2 | 110164 |  |
| pdata_n.t03_sb_scr_hold_adtnl | 1 | 0 | 64015 | 56275 |
| pdata_n.t03_sb_smm_hold_adtnl | 3 | 0 | 221601、224244、87030 |  |
| pdata_n.t03_sb_so_hold_adtnl | 1 | 0 | 64360 | 199987、55939、240699 |
| pdata_n.t03_sb_so_marg_det | 1 | 0 | 64294 | 199379、56158、240700、240701 |
| pdata_n.t03_sb_stkhold_acct_info | 1 | 0 | 127011 | 127009 |
| pdata_n.t03_scr_acct | 3 | 33 | 130267、35362、63460 |  |
| pdata_n.t03_scr_acct_csdc_info | 2 | 7 | 46806、64191 |  |
| pdata_n.t03_scr_acct_cstd_chk_info | 0 | 0 |  | 64053 |
| pdata_n.t03_scr_acct_flw_cms | 1 | 0 | 64225 | 55817 |
| pdata_n.t03_scr_acct_opt_covd_scr_hold_info | 2 | 0 | 212199、212200 |  |
| pdata_n.t03_scr_acct_righ_ctrl_adtnl | 4 | 0 | 61951、61952、64272、64371 |  |
| pdata_n.t03_sfb_lmt_marg_comp_info | 1 | 1 | 63969 |  |
| pdata_n.t03_shts_scr_src_comp_info | 1 | 0 | 186387 |  |
| pdata_n.t03_shts_scr_src_ldr_acct | 0 | 0 |  | 186857 |
| pdata_n.t03_sopt_stkhold_hold_adtnl | 1 | 0 | 64267 |  |
| pdata_n.t03_srp_agt_dect_tax_set_info | 0 | 0 |  | 129424 |
| pdata_n.t03_srp_comp_co_divd_adtnl_info | 1 | 1 | 121576 |  |
| pdata_n.t03_srp_comp_deflt_info | 1 | 1 | 82088 |  |
| pdata_n.t03_srp_comp_info | 2 | 43 | 35751、63411 |  |
| pdata_n.t03_sse_scr_acct_asgn_trd_info | 1 | 0 | 172914 |  |
| pdata_n.t03_st_acct_open_info | 2 | 1 | 48471、64318 |  |
| pdata_n.t03_stmt_bnk_acct_info | 1 | 0 | 96351 |  |
| pdata_n.t03_ta_acct_unpd_income_det | 1 | 0 | 64297 |  |
| pdata_n.t03_tit_ast_acct_adtnl_info | 1 | 2 | 103940 |  |
| pdata_n.t03_wos_ia_ord_info | 1 | 0 | 90745 |  |
| pdata_n.t03_xir_fnd_acct | 2 | 1 | 64181、64182 | 55102 |
| pdata_n.t03_xir_lvl2_scr_hold_adtnl | 1 | 0 | 64277 | 200035、55309 |
| pdata_n.t03_xir_lvl2_scr_hold_busi | 0 | 1 |  | 88790 |
| pdata_n.t03_xir_scr_acct | 5 | 26 | 154603、154604、64035、64361、90840 |  |

[[00-20260911-认知实验/t03专题-协议/证据/逐表SQL候选映射.json|完整映射 JSON]]
