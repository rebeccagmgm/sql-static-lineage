# 已读取的任务SQL索引

[返回覆盖页](覆盖与证据.md)

保留采集原文及内容哈希，不执行SQL。任务名仅供导航；hive-task中的建表与有效写入分别判断，目标DDL文件不算生产证据。

共42个任务的hive-task文本。索引JSON保留数据库的 `observed_at` 原值；原值为空时，原文头部日期另存为 `observed_at_from_text`，不伪装成已补齐数据库记录。哈希为原证据内容的校验值。

| 任务 | 名称 | 已采集文本 | 证据类型 |
|---|---|---|---|
| 59493 | pdata_news_n.t02_scr_base_info_WD | [原文](SQL/59493-hive-task.sql) | 含写入语句；语义以正文解释为准 |
| 61529 | pdata_news_n.t02_scr_base_info_XLA | [原文](SQL/61529-hive-task.sql) | 含写入语句；语义以正文解释为准 |
| 61577 | pdata_news_n.t02_scr_base_info_PRD | [原文](SQL/61577-hive-task.sql) | 含写入语句；语义以正文解释为准 |
| 103232 | pdata_news_n.t02_scr_base_info_TIT | [原文](SQL/103232.sql) | 含写入语句；语义以正文解释为准 |
| 65938 | pdata_news_n.t02_scr_type_XLA | [原文](SQL/65938-hive-task.sql) | 含写入语句；语义以正文解释为准 |
| 66204 | pdata_news_n.t02_prd_fin_info | [原文](SQL/66204-hive-task.sql) | 含写入语句；语义以正文解释为准 |
| 69638 | pdata_news_n.t02_fnd_base_info_WD | [原文](SQL/69638-hive-task.sql) | 仅建表定义，未作为生产规则 |
| 69289 | pdata_news_n.t02_bond_base_info_WD | [原文](SQL/69289-hive-task.sql) | 含写入语句；语义以正文解释为准 |
| 105612 | pdata_news_n.t02_fut_base_info_TIT_ref_future_properties_grp01 | [原文](SQL/105612.sql) | 含写入语句；语义以正文解释为准 |
| 176204 | pdata_news_n.t02_opt_base_info_tit_TIT_ref_listed_option_props_grp01 | [原文](SQL/176204.sql) | 含写入语句；语义以正文解释为准 |
| 69692 | pdata_news_n.t02_exch_quot_s_WD_A | [原文](SQL/69692-hive-task.sql) | 含写入语句；语义以正文解释为准 |
| 69825 | pdata_news_n.t02_exch_quot_h_WD_A | [原文](SQL/69825.sql) | 含写入语句；语义以正文解释为准 |
| 70232 | pdata_news_n.t02_prd_unit_nav_h_WD | [原文](SQL/70232.sql) | 含写入语句；语义以正文解释为准 |
| 59471 | pdata_news_n.t02_co_base_info_WD | [原文](SQL/59471-hive-task.sql) | 含写入语句；语义以正文解释为准 |
| 69799 | pdata_news_n.t02_co_bal_sht_WD_WABC | [原文](SQL/69799-hive-task.sql) | 含写入语句；语义以正文解释为准 |
| 69798 | pdata_news_n.t02_co_income_WD_WAIN | [原文](SQL/69798-hive-task.sql) | 含写入语句；语义以正文解释为准 |
| 69312 | pdata_news_n.t02_ann_info_WD_AShareAnninf_grp01 | [原文](SQL/69312.sql) | 含写入语句；语义以正文解释为准 |
| 70009 | pdata_news_n.t02_scr_rela_WD | [原文](SQL/70009-hive-task.sql) | 含写入语句；语义以正文解释为准 |
| 65994 | pdata_news_n.t02_marg_base_info_RCC | [原文](SQL/65994-hive-task.sql) | 含写入语句；语义以正文解释为准 |
| 74847 | pdata_news_n.t02_pub_cst_info | [原文](SQL/74847.sql) | 含写入语句；语义以正文解释为准 |
| 74850 | pdata_news_n.t02_pub_covt_const | [原文](SQL/74850.sql) | 含写入语句；语义以正文解释为准 |
| 92881 | pdata_news_n.t02_bnd_income_vchr_ois_OIS_incomecertificate_grp01 | [原文](SQL/92881.sql) | 含写入语句；语义以正文解释为准 |
| 160750 | pdata_news_n.t02_tit_prd_info_TIT_prd_product_grp01 | [原文](SQL/160750.sql) | 含写入语句；语义以正文解释为准 |
| 160753 | pdata_news_n.t02_tit_prd_asset_info_TIT_prd_product_asset_grp01 | [原文](SQL/160753.sql) | 含写入语句；语义以正文解释为准 |
| 100743 | dm_wm_test.srr_org_prd_sale_redeem_rate_mon | [原文](SQL/100743.sql) | 含写入语句；语义以正文解释为准 |
| 105135 | temp.wt_list_corp_equi_fin | [原文](SQL/105135.sql) | 含写入语句；语义以正文解释为准 |
| 66042 | pdata_news_n.t02_stk_base_info_WD | [原文](SQL/66042.sql) | 仅建表定义，未作为生产规则 |
| 69852 | pdata_news_n.t02_cstd_prd_base_info_MOT | [原文](SQL/69852.sql) | 含写入语句；语义以正文解释为准 |
| 70610 | pdata_news_n.t02_co_stkhold_WD_ashareinsideholder_grp01 | [原文](SQL/70610.sql) | 含写入语句；语义以正文解释为准 |
| 61490 | pdata_news_n.t02_rd_base_info_RMS | [原文](SQL/61490.sql) | 含写入语句；语义以正文解释为准 |
| 70149 | pdata_news_n.t02_fxr_cfets_quot_TL_mkt_fx_ref_rate_grp01 | [原文](SQL/70149.sql) | 含写入语句；语义以正文解释为准 |
| 156365 | pdata_news_n.t02_edb_idx_RPA_znyjpt_edb | [原文](SQL/156365.sql) | 含写入语句；语义以正文解释为准 |
| 155318 | pdata_news_n.t02_ira_ibor_WD_hiborprices_grp03 | [原文](SQL/155318.sql) | 含写入语句；语义以正文解释为准 |
| 70047 | pdata_news_n.t02_idx_compnt_info_WD_aindexmembers_grp04 | [原文](SQL/70047.sql) | 含写入语句；语义以正文解释为准 |
| 41646 | pdata_news_n.t02_stk_base_info_WD | [原文](SQL/41646.sql) | 仅建表定义，未作为生产规则 |
| 69826 | pdata_news_n.t02_fnd_base_info_TL_fund | [原文](SQL/69826.sql) | 含写入语句；语义以正文解释为准 |
| 167704 | pdata_news_n.t02_fnd_base_info_ext_WD_chinamutualfunddescription | [原文](SQL/167704.sql) | 含写入语句；语义以正文解释为准 |
| 66002 | pdata_news_n.t02_stk_base_info_WD_Ashare | [原文](SQL/66002.sql) | 含写入语句；语义以正文解释为准 |
| 77510 | pdata_hk.t02_prd_gmp | [原文](SQL/77510.sql) | 含写入语句；语义以正文解释为准 |
| 77545 | pdata_hk.t02_prd_name_h_gmp | [原文](SQL/77545.sql) | 含写入语句；语义以正文解释为准 |
| 203243 | pdata_n.t02_stk_fctr_expo_sw_TL_dy1d_exposure_grp01 | [原文](SQL/203243.sql) | 含写入语句；语义以正文解释为准 |
| 107580 | pdata_ams.t02_bond_payment_kxc | [原文](SQL/107580.sql) | 含写入语句；语义以正文解释为准 |
