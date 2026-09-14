-- task_id: 69852
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_cstd_prd_base_info_MOT_kxc
-- observed_at: 2026-09-05T01:06:29.251Z

-- createSql
CREATE TABLE IF NOT EXISTS T02_CSTD_PRD_BASE_INFO
(
    secu_id                 string comment '统一产品编号',
    src_sys_prdno           string comment '源系统产品编号',
    outserialno             string comment '运营管控产品编号',
    prd_code                string comment '产品编号',
    ta_cd                   string comment 'TA产品编号',
    ast_cd                  string comment '资产代码',
    amac_cd                 string comment '协会备案码',
    prd_name                string comment '产品名称',
    prd_full_name           string comment '产品全称',
    prd_en_name             string comment '产品英文名称',
    prd_type_cd             string comment '产品类型',
    prd_pd_stat_cd          string comment '生命周期状态',
    setp_dt                 string comment '成立日期',
    init_amt                string comment '成立规模',
    amac_record_dt          string comment '备案日期',
    contr_eff_dt            string comment '合同生效日期',
    due_dt                  string comment '到期日期',
    liqd_dt                 string comment '清盘日期',
    fnd_serv_type_cd        string comment '基金服务类型',
    dept                    string comment '所属部门',
    prd_mngr_name           string comment '产品经理',
    prd_mngr_intro          string comment '产品经理简介',
    ivst_policy             string comment '投资策略',
    scr_ivst_scope          string comment '证券类投资范围',
    not_scr_ivst_scope      string comment '非证券类投资范围',
    ivst_adviser_flag       string comment '投顾标识（0否1是）',
    ivst_adviser            string comment '投资顾问',
    clos_pd                 string comment '封闭期限',
    clos_pd_unit_cd         string comment '封闭期限单位',
    lockout_pd              string comment '份额锁定期限',
    lockup_pd_unit_cd       string comment '锁定期限单位',
    time_lmt                string comment '存续期限',
    time_lmt_unit_cd        string comment '存续期限单位',
    stru_fnd_flag_cd        string comment '分级产品标识',
    ta_clr_flag             string comment '纳入TA管理标识（0否1是）',
    max_redp_rati           string comment '巨额赎回比例',
    sett_mode_cd            string comment '产品结算模式',
    Appr_Flag               string comment '审核标识',
    Del_Flag                string comment '删除标识',
    src_tbl                 string comment '来源表',
    rec_upd_time            string comment '数据更新时间',
    rec_down_time           string comment '数据进表时间',
    busi_date               string comment '数据日期',
    oserv_estb_sob_date     string comment '外包建账日期',
    nav_accy                string comment '份额净值精度',
    oserv_oper_estb_sob_date string comment '外包操作建账日期'
)  comment '托管产品基本信息' 
partitioned by (src_id string comment '来源标识')
stored as orc;

CREATE TABLE IF NOT EXISTS T02_CSTD_PRD_BASE_INFO_MOT_TEMP
(
    secu_id                 string comment '统一产品编号',
    src_sys_prdno           string comment '源系统产品编号',
    outserialno             string comment '运营管控产品编号',
    prd_code                string comment '产品编号',
    ta_cd                   string comment 'TA产品编号',
    ast_cd                  string comment '资产代码',
    amac_cd                 string comment '协会备案码',
    prd_name                string comment '产品名称',
    prd_full_name           string comment '产品全称',
    prd_en_name             string comment '产品英文名称',
    prd_type_cd             string comment '产品类型',
    prd_pd_stat_cd          string comment '生命周期状态',
    setp_dt                 string comment '成立日期',
    init_amt                string comment '成立规模',
    amac_record_dt          string comment '备案日期',
    contr_eff_dt            string comment '合同生效日期',
    due_dt                  string comment '到期日期',
    liqd_dt                 string comment '清盘日期',
    fnd_serv_type_cd        string comment '基金服务类型',
    dept                    string comment '所属部门',
    prd_mngr_name           string comment '产品经理',
    prd_mngr_intro          string comment '产品经理简介',
    ivst_policy             string comment '投资策略',
    scr_ivst_scope          string comment '证券类投资范围',
    not_scr_ivst_scope      string comment '非证券类投资范围',
    ivst_adviser_flag       string comment '投顾标识（0否1是）',
    ivst_adviser            string comment '投资顾问',
    clos_pd                 string comment '封闭期限',
    clos_pd_unit_cd         string comment '封闭期限单位',
    lockout_pd              string comment '份额锁定期限',
    lockup_pd_unit_cd       string comment '锁定期限单位',
    time_lmt                string comment '存续期限',
    time_lmt_unit_cd        string comment '存续期限单位',
    stru_fnd_flag_cd        string comment '分级产品标识',
    ta_clr_flag             string comment '纳入TA管理标识（0否1是）',
    max_redp_rati           string comment '巨额赎回比例',
    sett_mode_cd            string comment '产品结算模式',
    Appr_Flag               string comment '审核标识',
    Del_Flag                string comment '删除标识',
    oserv_estb_sob_date     string comment '外包建账日期',
    nav_accy                string comment '份额净值精度'
)  comment '托管产品基本信息_MOT临时表' 
stored as orc;

CREATE TABLE IF NOT EXISTS T02_CSTD_PRD_BASE_INFO_MOT_S
(
    outserialno             string comment '运营管控产品编号',
    rec_down_time           string comment '数据进表时间'
)  comment '托管产品基本信息_MOT更新时间' 
stored as orc;

-- querySql
set hive.support.concurrency=false;

insert overwrite table T02_CSTD_PRD_BASE_INFO_MOT_S
select outserialno, min(rec_down_time) rec_down_time
from T02_CSTD_PRD_BASE_INFO
where src_id = 'MOT'
group by outserialno
;

set hive.support.concurrency=false;

with tpdtfundinfo as 
(
  SELECT  tf.TA_CODE                                    AS C_TAFUNDCODE --TA代码 
         ,tf.PRD_CODE                                   AS C_FUNDCODE --产品主键 
         ,tf.TENANT_ID                                  AS C_MANAGERCODE --管理人代码 
         ,tf.SERVICE_TYPE                               AS C_FUNDSERVICETYPE --服务类型 430008 
         ,tf.PRD_STATUS                                 AS C_PDTSTATUS --产品状态 
         ,tf.PRD_FULL_NAME                              AS C_FUNDNAME --产品全称 
         ,tf.PRD_TYPE                                   AS C_PDTTYPE --产品类型 430015 
         ,bt.TENANTNAME                                 AS C_MANAGERNAME --管理人名称 
         ,tf.PRODUCT_CUSTODIAN                          AS C_TRUSTEECODE --托管人代码 
         ,btt.BANKACCO                                  AS C_TRUSTEENAME --托管人中文 
         ,''                                            AS F_MANAGERFEE --无该字段 
         ,''                                            AS F_TRUSTEEFEE --无该字段 
         ,SUBSTR(tf.FILING_DATE,1,10)                   AS D_RECORDDATE --产品备案日期 
         ,tf.FUND_CATEGORY                              AS C_BUSINESSTYPE --基金类别 430060 
         ,''                                            AS C_OPERATEWAY --无该字段 
         ,''                                            AS C_MONEYTYPE --无该字段 
         ,tf.PRD_INNER_CODE                             AS C_OUTSERIALNO --产品内部编码 
         ,SUBSTR(tf.PRD_ESTIMATED_EXPIRATION_DATE,1,10) AS D_CONTRACTENDDATE --产品预估到期日 
         ,tf.IS_FOF                                     AS C_ISFOF --是否FOF 
         ,''                                            AS L_PDTTEMPLETID --L_PDTTEMPLETID 产品模板 
         ,trp.MANAGER_PR_ACCRUAL_RATE / 100             AS F_COMMISSIONRATE --业绩报酬计提比例 
         ,''                                            AS C_INVESTTYPE --已弃用该字段 
         ,tri.DEFERRAL_WORK_METHOD                      AS C_REDEMPTIONMODE --赎回运作方式 431137 
         ,tf.CURRENT_STAGE                              AS C_AUDITSTATUS --赎回开放频率 430006 
         ,tia.INVESTMENT_STRATEGY_DESC                  AS C_INVESTSCHEMA --投资策略 
         ,trd.PROCEEDS_DISTRIBUTION_DESC                AS C_BONUSARRANGEMENT --收益分配描述 
         ,SUBSTR(tf.PRODUCT_ESTABLISHMENT_DATE,1,10)    AS D_SETUPDATE --产品成立日 
         ,SUBSTR(tf.FINAL_WINDIN_UP_DATE,1,10)          AS D_LIQUIDATIONDATE --最终清盘日期 
         ,SUBSTR(tf.FIRST_WINDIN_UP_DATE,1,10)           AS D_FAILUEDATE --首次清盘日期 
         ,tri.REDEEM_OPEN_FREQUENCY                     AS C_REDEMPTIONOPENRATE --赎回开放频率 431138 
         ,''                                            AS D_FUNDENDDATE --无该字段 
         ,''                                            AS D_ISSUEDATE --无该字段 
         ,''                                            AS D_LISTINGDATE --无该字段 
         ,''                                            AS D_ISSUEENDDATE --无该字段 
         ,tia.FUND_MANAGER                              AS C_INVESTMANAGER --基金经理 
         ,tia.FUND_MANAGER_INTRODUCTION                 AS C_INVESTMANAGERCV --基金经理简介 
         ,''                                            AS F_MINBALA --无该字段 
         ,tsi.ROLL_IN_TYPE                              AS C_ROLLFLAGTYPE --转入类型 430778 
         ,''                                            AS C_FUNDFULLNAME --无该字段
  -----------------------2026-5-20补充字段--------- 
         ,tsa.ACCOUNT_BANK                              AS c_raisebank --募集户开户银行 
         ,tsa.ACCOUNT_NAME                              AS c_raisename --募集户名称 
         ,tsa.ACCOUNT                                   AS c_raiseacco --募集户账号 
         ,bpi.MINIMUM_ESTABLISHMENT_SIZE                AS f_minshares --最低成立规模 (元) 
         ,trd.IS_ALLOWED_PD                             AS c_incomedistributionflag --是否允许收益分配 
         ,trd.DEFAULT_DIVIDEND_METHOD                   AS C_INCOMEDISTRIBUTIONWAY --收益分配方式 (中台默认分红方式) 
         ,tia.RISK_LEVEL_DESC                           AS c_risklevel --风险等级 
         ,tia.OTHER_RISK_LEVEL_DESC                     AS c_riskprofitfeatures --风险等级描述 
         ,tri.HR_RECOGNIZED_PERCENTAGE                  AS f_maxredeem --巨额赎回比例 
         ,tia.OTHER_INVESTMENT_SCOPE                    AS C_INVESTSCOPE --投资范围 
         ,tia.INVESTMENT_OBJECTIVES                     AS c_investgoal --投资目标 
         ,tf.PRD_FULL_NAME                              AS c_fundshortname --产品简称 
         ,tf.DURATION_EXISTENCE                         AS l_timelimit --存续期限 
         ,tf.DURATION                                   AS c_pdttimelimit -- 存续期限（文本型）
  ----2026-05-26 补充字段---------- 
         ,tsi.IS_TRANSFER                               AS c_rollflag ---是否转入产品 
         ,bps.CURRENT_PRD_MANAGER                       AS c_subprojectcode
  FROM
  (  
	SELECT  *  
	FROM odata_n_cap.s_biz_pro_prd_base_info  
	WHERE BUSI_DATE = '${data_day_str}' 
  ) tf
  LEFT JOIN
  (  
	SELECT  * FROM odata_n_cap.a_biz_pro_tenant  
	WHERE BUSI_DATE = '${data_day_str}' 
  ) bt
  ON tf.TENANT_ID = bt.id AND bt.deleted = '0'
  LEFT JOIN
  (  
	SELECT  *  
	FROM odata_n_cap.p_biz_pro_trusteebank  
	WHERE BUSI_DATE = '${data_day_str}' 
  ) btt
  ON tf.PRODUCT_CUSTODIAN = btt.TRUSTEECREDITCODE AND btt.deleted = '0'
  LEFT JOIN
  (  
	SELECT  *  
	FROM odata_n_cap.p_biz_pro_remunerate_performance  
	WHERE BUSI_DATE = '${data_day_str}' 
  ) trp
  ON tf.PRD_CODE = trp.PRD_CODE AND trp.deleted = '0'
  LEFT JOIN
  (  
	SELECT  *  
	FROM odata_n_cap.p_biz_pro_redemption_info  
	WHERE BUSI_DATE = '${data_day_str}' 
  ) tri
  ON tf.PRD_CODE = tri.PRD_CODE AND tri.deleted = '0'
  LEFT JOIN
  (  
	SELECT  *  
	FROM odata_n_cap.p_biz_pro_investment_arrangement  
	WHERE BUSI_DATE = '${data_day_str}' 
  ) tia
  ON tf.PRD_CODE = tia.PRD_CODE AND tia.deleted = '0'
  LEFT JOIN
  (  
	SELECT  *  
	FROM odata_n_cap.p_biz_pro_revenue_distribution  
	WHERE BUSI_DATE = '${data_day_str}' 
  ) trd
  ON tf.PRD_CODE = trd.PRD_CODE AND trd.deleted = '0'
  LEFT JOIN
  (  
	SELECT  *  
	FROM odata_n_cap.p_biz_pro_transfer_service_info  
	WHERE BUSI_DATE = '${data_day_str}' 
  ) tsi
  ON tf.PRD_CODE = tsi.PRD_CODE AND tsi.deleted = '0'
  LEFT JOIN
  (  
	SELECT  *  
	FROM odata_n_cap.a_biz_pro_sync_account_info  
	WHERE BUSI_DATE = '${data_day_str}' 
  ) tsa
  ON tf.PRD_CODE = tsa.PRD_CODE AND tsa.ACCOUNT_TYPE = '16' AND tsa.deleted = '0'
  LEFT JOIN
  (  
	SELECT  *  
	FROM odata_n_cap.a_biz_pro_pe_info  
	WHERE BUSI_DATE = '${data_day_str}' 
  ) bpi
  ON tf.PRD_CODE = bpi.PRD_CODE AND bpi.deleted = '0'
  LEFT JOIN
  (
  	SELECT  *
  	FROM odata_n_cap.p_biz_pro_prd_service_info
  	WHERE busi_date = '${data_day_str}'
  ) bps
  ON tf.prd_code = bps.prd_code AND bps.deleted = '0'
  WHERE tf.deleted = '0'
)
,tpdtfundextinfo as
(
  SELECT  tf.PRD_CODE                       AS C_FUNDCODE
         ,tf.ICP_FILING_CODE                AS C_ASSOCIATIONNUMBER --产品备案编码 
         ,tr.IS_PRELIMINARY_CASE_CODE       AS C_ISPRERECORD --是否有预备案编码 430014 一致 
         ,tr.PRELIMINARY_CASE_CODE          AS C_RECORDCODE --管理人提交的募集信息-预备案编码 
         ,tf.REGISTRATION_AUTHORITY         AS C_FUNDREGINS --注册登记管理机构 430235 一致 
         ,tg.OLD_RATING_TYPE                AS C_IFGRADING --（旧）分级类型 430072 
         ,''                                AS L_FADATE --托管估值日期T+ 无该字段 
         ,bpi.PRINCIPAL_NAME                AS C_ASSETPRINCIPAL --委托人名称 
         ,tf.WORKS_TYPE                     AS C_OPERATIONTYPE --运作方式 430011 
         ,tf.IS_INVESTMENT_ADVISOR          AS C_ISINVESTMENTADVISER --是否有投顾/有无投顾 以中台为准 字典：430020 
         ,''                                AS C_ISCHANNE --无该字段 
         ,tf.INVESTMENT_ADVISOR             AS C_ISINVESTADVISE --投资顾问 
         ,tdi.OPEN_DESC                     AS C_OTHEROPENDAY --开放日描述 
         ,''                                AS D_CONTRACEFFECTIVEDATE --无该字段 
         ,tr.SOLICITATION_START_DATE        AS D_RAISINGSTARTDATE --募集起始日 
         ,tr.RAISED_TOTAL_AMOUNT            AS F_RAISINGAMOUNT --募集总金额 
         ,tr.SOLICITATION_END_DATE          AS D_RAISINGENDDATE --募集结束日 
         ,tf.REGISTRARS                     AS C_SHAREREGISTERSERVICE -- 注册登记机构 
         ,tf.VALUATION_OUTSOURCING_AGENCIES AS C_OUTSERVICECONTENT --估值外包机构 
         ,tli.SHARE_LOCK_UP_PERIOD_TYPE     AS C_ISLOCKUPPERIOD --份额有无锁定期 430257 一致 
         ,tli.SHARE_LOCK_UP_PERIOD          AS C_LOCKOUTDURATION --份额锁定期
  -- C_TAFUNDCODE, 
         ,tf.OV_ESTABLISHMENT_NUMBER        AS c_wbfaaccno --外包估值账套号 
         ,tf.EV_ESTABLISHMENT_NUMBER        AS c_tgfaaccno --托管估值账套号
  -----------2026-6-1----- 
         ,bps.PRD_INTRODUCTION_AGENCIES     AS c_branchorgcode --产品引入机构 
         ,''                                AS c_branchorgcontactor --引入机构联系人 
         ,''                                AS c_introducepersionemail --无 
         ,''                                AS c_introducepersionphone --无 
         ,''                                AS c_introducepersionmobile --无 
         ,bcp.CLOSED_PERIOD                 AS c_closedperiodflag --封闭期 
         ,tf.BILLING_MODE                   AS c_settlementmodel --结算模式 字典：430036 一致 
         ,brd.BD_UNITS_NET_VALUE            AS f_netvalueprecision --分红前最低单位净值 
         ,tf.VC_ESTABLISHMENT_DATE          AS d_tgfacreatedate --托管估值建账日期 
         ,tf.OV_ESTABLISHMENT_DATE          AS d_wbfacreatedate --外包估值建账日期
  ------------2026-6-4------- 
         ,bcp.CLOSURE_PERIOD                AS l_closedperiod --封闭期限 
         ,bts.ESCROW_CT_DATE                AS d_transferdatumday --托管转出（终止）基准日 
         ,bts.NEW_CUSTODIANS                AS c_newtrusteecode --新托管机构 
         ,bts.OUTSOURCING_CT_DATE           AS d_tatransferendday --外包转出（终止）基准日 
         ,bts.NEW_OUTSOURCING_AGENCIES      AS c_newoutservicecode --新外包机构 
         ,bts.ESCROW_PERFORMANCE_BEGIN_DATE AS d_outserviceexecutiondate --托管履职起始日 
         ,bts.ORIGINAL_ESCROW_CUSTODIAN     AS c_originaltrusteecode --原托管机构 
         ,bts.OP_BEGIN_DATE                 AS d_trusteeexecutiondate --外包履职起始日(外包服务起始日) 
         ,bts.ORIGINAL_OUTSOURCE_CUSTODIAN  AS c_originaloutservicecode --原外包机构 
         ,bri.HR_DEFERRAL_METHOD            AS c_redemptionclause --巨额赎回顺延方式 MOT 字典：430122 中台字典：430193 一致 
         ,brp.ACCRUING_BY                   AS c_yjbcextracttype --业绩报酬计提方 Mot 字典：430047 中台字典：accrual --;比MOT字典少了一个3：不计提 
         ,brp.ATTRIBUTION                   AS c_yjbcbelong --业绩报酬归属方 字典：430275 一致 
         ,brp.ACCRUAL_BASE_RATIO            AS f_yjbcbenchmarkrate --计提基准比例
  ---------c_yjbcbasedate, 无 MOT计提基准日 已拆分成TA计提业绩报酬计提时点、估值计提业绩报酬计提时点 
         ,brp.TA_ACCRUES_TIME --TA计提业绩报酬计提时点 字典：ta_accrual_time 
         ,brp.VA_PR_ACCRUAL_TIME --估值计提业绩报酬计提时点 字典：valuation_accrual_time 
         ,bia.INVESTMENT_PROHIBITED_CONDUCT AS c_investlimit --投资禁止行为
  ---c_raiseaccountremark, 无
  --bpd.NET_WD_FREQUENCY c_reportruledesc, --净值披露频率 mot字典：430182 --中台字典：net_wd_frequency 一致
  --bai.IS_SINGLE_FO_ACCOUNT c_isopenraiseaccount, --是否开单一募集户 字典：430014 一致 
         ,tr.SOLICITATION_MODE              AS c_raisingmode --募集模式 字典：430092 一致 
         

  FROM
  (
  	SELECT  *
  	FROM odata_n_cap.s_biz_pro_prd_base_info
  	WHERE busi_date = '${data_day_str}'
  ) tf
  LEFT JOIN
  (
  	SELECT  *
  	FROM odata_n_cap.p_biz_pro_fund_raising
  	WHERE busi_date = '${data_day_str}' 
  )tr
  ON tf.prd_code = tr.prd_code AND tr.deleted = '0'
  LEFT JOIN
  (
  	SELECT  *
  	FROM odata_n_cap.p_biz_pro_grade_info
  	WHERE busi_date = '${data_day_str}'
  ) tg
  ON tf.prd_code = tg.prd_code AND tg.deleted = '0'
  LEFT JOIN
  (
  	SELECT  *
  	FROM odata_n_cap.p_biz_pro_principal_info
  	WHERE busi_date = '${data_day_str}'
  ) bpi
  ON tf.prd_code = bpi.prd_code AND bpi.deleted = '0'
  LEFT JOIN
  (
  	SELECT  *
  	FROM odata_n_cap.p_biz_pro_to_days_info
  	WHERE busi_date = '${data_day_str}'
  ) tdi
  ON tf.prd_code = tdi.prd_code AND tdi.deleted = '0'
  LEFT JOIN
  (
  	SELECT  *
  	FROM odata_n_cap.p_biz_pro_lock_in_period_info
  	WHERE busi_date = '${data_day_str}'
  ) tli
  ON tf.prd_code = tli.prd_code AND tli.deleted = '0'
  LEFT JOIN
  (
  	SELECT  *
  	FROM odata_n_cap.p_biz_pro_prd_service_info
  	WHERE busi_date = '${data_day_str}'
  ) bps
  ON tf.prd_code = bps.prd_code AND bps.deleted = '0'
  LEFT JOIN
  (
  	SELECT  *
  	FROM odata_n_cap.a_biz_pro_closed_period_info
  	WHERE busi_date = '${data_day_str}'
  ) bcp
  ON tf.prd_code = bcp.prd_code AND bcp.deleted = '0'
  LEFT JOIN
  (
  	SELECT  *
  	FROM odata_n_cap.p_biz_pro_revenue_distribution
  	WHERE busi_date = '${data_day_str}'
  ) brd
  ON tf.prd_code = brd.prd_code AND brd.deleted = '0'
  LEFT JOIN
  (
  	SELECT  *
  	FROM odata_n_cap.p_biz_pro_transfer_service_info
  	WHERE busi_date = '${data_day_str}'
  ) bts
  ON tf.prd_code = bts.prd_code AND bts.deleted = '0'
  LEFT JOIN
  (
  	SELECT  *
  	FROM odata_n_cap.p_biz_pro_redemption_info
  	WHERE busi_date = '${data_day_str}'
  ) bri
  ON tf.prd_code = bri.prd_code AND bri.deleted = '0'
  LEFT JOIN
  (
  	SELECT  *
  	FROM odata_n_cap.p_biz_pro_remunerate_performance
  	WHERE busi_date = '${data_day_str}'
  ) brp
  ON tf.prd_code = brp.prd_code AND brp.deleted = '0'
  LEFT JOIN
  (
  	SELECT  *
  	FROM odata_n_cap.p_biz_pro_investment_arrangement
  	WHERE busi_date = '${data_day_str}'
  ) bia
  ON tf.prd_code = bia.prd_code AND bia.deleted = '0'
  --left JOIN
  --(select *
  --FROM odata_n_cap.p_BIZ_PRO_DISCLOSURE
  --WHERE busi_date = '${data_day_str}') bpd
  --ON tf.prd_code = bpd.prd_code
  -- AND bpd.deleted = '0'
  --left JOIN
  --(select *
  --FROM odata_n_cap.p_BIZ_PRO_ACCOUNT_INFO
  --WHERE busi_date = '${data_day_str}') bai
  --ON tf.prd_code = bai.prd_code
  -- AND bai.deleted = '0'
  --where tf.deleted = '0' 

)
insert overwrite table T02_CSTD_PRD_BASE_INFO_MOT_TEMP
select d.secu_id,
    d.src_sys_prdno,
    a.outserialno,
    a.prd_code,
    a.ta_cd,
    null ast_cd,
    b.amac_cd,
    a.prd_name,
    a.prd_full_name,
    null prd_en_name,
    a.prd_type_cd,
    a.prd_pd_stat_cd,
    a.setp_dt,
    null init_amt,
    a.amac_record_dt,
    null contr_eff_dt,
    a.due_dt,
    c.liqd_dt,
    a.fnd_serv_type_cd,
    null dept,
    a.prd_mngr_name,
    a.prd_mngr_intro,
    a.ivst_policy,
    a.scr_ivst_scope,
    a.not_scr_ivst_scope,
    b.ivst_adviser_flag,
    b.ivst_adviser,
    b.clos_pd,
    b.clos_pd_unit_cd,
    b.lockout_pd,
    b.lockup_pd_unit_cd,
    a.time_lmt,
    a.time_lmt_unit_cd,
    b.stru_fnd_flag_cd,
    case when a.fnd_serv_type_cd like '%2%' then 1 else 0 end as ta_clr_flag,
    a.max_redp_rati,
    b.sett_mode_cd,
    --20220316 新增审核标识、删除标识
    null as Appr_Flag,  
    null as Del_Flag,
    --20220607 新增外包创建日期
    null as oserv_estb_sob_date,
    --20220722 新增份额净值精度
    b.nav_accy
from 
    -- 基本信息
    (select c_outserialno outserialno,
        c_fundcode prd_code, 
        c_tafundcode ta_cd, --TA产品编号
        c_fundname prd_name,--产品名称
        c_fundfullname prd_full_name, --产品全称
        c_pdttype prd_type_cd, --产品类型(CD019 MOT_PRD_TYPE_CD)
        c_pdtstatus prd_pd_stat_cd, --生命周期状态(A:需求,B:筹备,C:发行,D:存续,E:清盘)
        substr(d_setupdate,1,10) setp_dt, --成立日期
        substr(d_recorddate,1,10) amac_record_dt, --备案日期
        substr(d_contractenddate,1,10) due_dt, --到期日期
        c_fundservicetype fnd_serv_type_cd, --基金服务类型
        c_investmanager prd_mngr_name, --产品经理
        c_investmanagercv prd_mngr_intro, --产品经理简介,
        c_investschema ivst_policy, --投资策略 
        --c_securityinvestscope和c_notsecurityinvestscope在新表合并了，因此证券和非证券投资范围都写入投资范围
        C_INVESTSCOPE scr_ivst_scope, --证券类投资范围 
        C_INVESTSCOPE not_scr_ivst_scope, --非证券类投资范围
        l_timelimit time_lmt, --存续期限
        c_pdttimelimit time_lmt_unit_cd, --存续期限单位(1:年,2:月,3:日,4:无,99:永续) 
        f_maxredeem max_redp_rati --巨额赎回比例
    from TPDTFUNDINFO -- MOT产品信息表
        --gf_dcp.mot_m_tpdtfundinfo 
    where c_outserialno is not null 
        and c_pdtstatus <> 'F'
    ) a 
    -- 扩展信息
    left join 
    (select c_fundcode prd_code, 
        c_associationnumber amac_cd, --协会备案码
        c_isinvestadvise ivst_adviser, --投资顾问
        c_isinvestmentadviser ivst_adviser_flag, --投顾标识（0否1是）
        l_closedperiod clos_pd, --封闭期限
        c_closedperiodflag clos_pd_unit_cd, --封闭期限单位(1:年,2:月,3:日,4:无,99:其他) 
        c_lockoutduration lockout_pd, --份额锁定期限
        c_islockupperiod lockup_pd_unit_cd, --锁定期限单位(1:年,2:月,3:日,4:无,99:其他) 
        c_ifgrading stru_fnd_flag_cd, --分级产品标识(1:不分级,2:优先和劣后,3:优先、普通和劣后,4:其它,5:安全垫产品,9:未知)
        c_settlementmodel sett_mode_cd, --产品结算模式 (1:托管行结算模式,2:券商结算模式)
        f_netvalueprecision as nav_accy --份额净值精度
    from tpdtfundextinfo   -- MOT产品扩展信息表
        --gf_dcp.mot_m_tpdtfundextinfo 
    where c_fundcode is not null
    ) b
    on a.prd_code = b.prd_code
    left join 
    -- 清盘日期
    (select outserialno, max(liqd_dt) liqd_dt
    from pdata_news_n.T02_CSTD_PRD_LIQD_INFO
    where src_id = 'MOT' and liqd_dt is not null
    group by outserialno 
    ) c
    on a.outserialno = c.outserialno
    -- 统一id
    left join
    (select rec_id outserialno,
        src_sys_prdno,
        secu_id
    from pdata_news_n.T02_SCR_BASE_INFO --证券基本信息表 MOT
    where src_id = 'MOT'
    ) d
    on a.outserialno = d.outserialno
;

insert overwrite table T02_CSTD_PRD_BASE_INFO partition (src_id = 'MOT')
select 
    a.secu_id,
    a.src_sys_prdno,
    a.outserialno,
    a.prd_code,
    a.ta_cd,
    a.ast_cd,
    a.amac_cd,
    a.prd_name,
    a.prd_full_name,
    a.prd_en_name,
    a.prd_type_cd,
    a.prd_pd_stat_cd,
    a.setp_dt,
    a.init_amt,
    a.amac_record_dt,
    a.contr_eff_dt,
    a.due_dt,
    a.liqd_dt,
    a.fnd_serv_type_cd,
    a.dept,
    a.prd_mngr_name,
    a.prd_mngr_intro,
    a.ivst_policy,
    a.scr_ivst_scope,
    a.not_scr_ivst_scope,
    a.ivst_adviser_flag,
    a.ivst_adviser,
    a.clos_pd,
    a.clos_pd_unit_cd,
    a.lockout_pd,
    a.lockup_pd_unit_cd,
    a.time_lmt,
    a.time_lmt_unit_cd,
    a.stru_fnd_flag_cd,
    a.ta_clr_flag,
    a.max_redp_rati,
    a.sett_mode_cd,
    a.appr_flag,
    a.del_flag,
    'ODATA_N_MOT.M_TPDTFUNDINFO' src_tbl,
    from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss') as rec_upd_time,
    coalesce(b.rec_down_time, from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')) as rec_down_time,
    '{busi_date}' busi_date,
    a.oserv_estb_sob_date,
    a.nav_accy,
    null as oserv_oper_estb_sob_date
from T02_CSTD_PRD_BASE_INFO_MOT_TEMP a 
left join T02_CSTD_PRD_BASE_INFO_MOT_S b 
on a.outserialno = b.outserialno
;
