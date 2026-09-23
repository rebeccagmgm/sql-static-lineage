-- task_id: 203358
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/SUM/PDATA_N.T98_OTC_DERI_UNDRL_INCOME_RWD_SUM_OIS040.py
-- observed_at: 2026-09-05T01:07:19.271Z

-- createSql
CREATE TABLE IF NOT EXISTS T98_OTC_DERI_UNDRL_INCOME_RWD_SUM(
     Src_Id                     STRING COMMENT '源ID'
    ,Sett_Time                  STRING COMMENT '核算时间'
    ,Inpt_Time                  STRING COMMENT '数据导入时间'
    ,Bel_Div_Org_Name           STRING COMMENT '所属分公司名称'
    ,Bel_Inr_Org_Id             STRING COMMENT '所属内部机构编号'
    ,Bel_Inr_Org_Name           STRING COMMENT '所属内部机构名称'
    ,Mngr_Emp_Name              STRING COMMENT '客户经理员工名称'
    ,Cupt_Name                  STRING COMMENT '交易对手简称'
    ,Otc_Deri_Type              STRING COMMENT '衍生品类型'
    ,Annu_Pric_Diff             STRING COMMENT '年化价差'
    ,Absl_Pric_Diff             STRING COMMENT '绝对价差'
    ,Sale_Coef                  STRING COMMENT '销售费系数'
    ,Absl_Nom_Prin              STRING COMMENT '绝对名义本金'
    ,Dev_Dept_Rwd               STRING COMMENT '拓展方部门所得收入'
    ,Bgng_Prcg_Date             STRING COMMENT '期初定价日期'
    ,Accr_Begn_Date             STRING COMMENT '计提起始日'
    ,Accr_End_Date              STRING COMMENT '计提终止日'
    ,End_Date                   STRING COMMENT '到期日(含提前终止日)'
    ,Accr_Days                  STRING COMMENT '实际天数/计提天数'
    ,Erly_Trmt_Flag             STRING COMMENT '提前终止标志'
    ,Erly_Trmt_Date             STRING COMMENT '提前终止日期'
    ,Nom_Prin                   STRING COMMENT '名义本金'
    ,Contr_Id                   STRING COMMENT '合同编号'
    ,Pty_Cutp_Name              STRING COMMENT '当事人交易对手名称'
    ,Sign_Prd_Name              STRING COMMENT '代签产品名称'
    ,Undrl_Cd                   STRING COMMENT '标的代码'
    ,Undrl_Name                 STRING COMMENT '标的名称'
    ,Undrl_Type                 STRING COMMENT '标的名称'
    ,Remark                     STRING COMMENT '备注'
    ,Dev_Cust_Flag              STRING COMMENT '研发客户标志'
    ,Curr_Payb_Rwd              STRING COMMENT '本期应发奖励'
    ,Curr_Defr_Rwd              STRING COMMENT '本期递延奖励'
    ,Mtch_Defr_Rwd              STRING COMMENT '历史累计递延奖励'
    ,Curr_Actl_Rwd              STRING COMMENT '本期实发奖励'
    ,Cust_Type_Desc             STRING COMMENT '客户类型描述'
    ,Matn_Emp_Id                STRING COMMENT '维护员工编号'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
    ,Real_Src_Tbl               STRING COMMENT '真实源表'
    ,Cros_Bord_Flag             STRING COMMENT '跨境标志'
    ,Sett_Strt_Date             STRING COMMENT '核算开始日期'
    ,Sett_End_Date              STRING COMMENT '核算结束日期'
)COMMENT 'T98_场外衍生品收入奖励汇总'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表',BUSI_DATE  STRING COMMENT '业务日期')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T98_OTC_DERI_UNDRL_INCOME_RWD_SUM PARTITION(SRC_TBL='${src_table}',BUSI_DATE='${data_day_str}')
-----------------------------------------------------------------------------------------------------
--Group2: Source Table:[ODATA_N_OIS.G_CROSS_INCOME_REWARD:交叉收入奖励]
-----------------------------------------------------------------------------------------------------
SELECT
     ID                                                AS  Src_Id                  --源ID
    ,ACCOUNTING_DATE                                   AS  Sett_Time               --核算时间
    ,CREATE_TIME                                       AS  Inpt_Time               --数据导入时间
    ,BRANCH_OFFICE                                     AS  Bel_Div_Org_Name        --所属分公司名称
    ,''                                                AS  Bel_Inr_Org_Id          --所属内部机构编号
    ,BRANCH_NAME                                       AS  Bel_Inr_Org_Name        --所属内部机构名称
    ,CUSTOMER_MANAGER_NAME                             AS  Mngr_Emp_Name           --客户经理员工名称
    ,ABBREVIATION                                      AS  Cupt_Name               --交易对手简称
    ,OPTION_TYPE                                       AS  Otc_Deri_Type           --衍生品类型
    ,''                                                AS  Annu_Pric_Diff          --年化价差
    ,''                                                AS  Absl_Pric_Diff          --绝对价差
    ,''                                                AS  Sale_Coef               --销售费系数
    ,NOTIONAL                                          AS  Absl_Nom_Prin           --绝对名义本金
    ,EXPANSION_DEPT_INCOME                             AS  Dev_Dept_Rwd            --拓展方部门所得收入
    ,''                                                AS  Bgng_Prcg_Date          --期初定价日期
    ,''                                                AS  Accr_Begn_Date          --计提起始日
    ,''                                                AS  Accr_End_Date           --计提终止日
    ,''                                                AS  End_Date                --到期日(含提前终止日)
    ,''                                                AS  Accr_Days               --实际天数/计提天数
    ,''                                                AS  Erly_Trmt_Flag          --提前终止标志
    ,''                                                AS  Erly_Trmt_Date          --提前终止日期
    ,NOTIONAL                                          AS  Nom_Prin                --名义本金
    ,CONTRACT_NO                                       AS  Contr_Id                --合同编号
    ,CORPORATE_NAME                                    AS  Pty_Cutp_Name           --当事人交易对手名称
    ,SIGNATURE_NAME                                    AS  Sign_Prd_Name           --代签产品名称
    ,UNDERLYING_CODE                                   AS  Undrl_Cd                --标的代码
    ,UNDERLYING_NAME                                   AS  Undrl_Name              --标的名称
    ,UNDERLYING_TYPE                                   AS  Undrl_Type              --标的名称
    ,REMARK                                            AS  Remark                  --备注
    ,''                                                AS  Dev_Cust_Flag           --研发客户标志
    ,''                                                AS  Curr_Payb_Rwd           --本期应发奖励
    ,''                                                AS  Curr_Defr_Rwd           --本期递延奖励
    ,''                                                AS  Mtch_Defr_Rwd           --历史累计递延奖励
    ,''                                                AS  Curr_Actl_Rwd           --本期实发奖励
    ,APTITUDE                                          AS  Cust_Type_Desc          --客户类型描述
    ,''                                                AS  Matn_Emp_Id             --维护员工编号
    ,'${data_src_cd}'                             AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                                AS  Task_Name               --任务名
    ,'${data_day_str}'                            AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'                          AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                              AS  Data_Time               --数据时间
    ,'${src_table}'                               AS  Real_Src_Tbl            --真实源表
    ,CASE WHEN IS_CROSS_BORDER = 'true' THEN '1'
          WHEN IS_CROSS_BORDER = 'false' THEN '0'
          ELSE IS_CROSS_BORDER END                     AS  Cros_Bord_Flag          --跨境标志
    ,ACCOUNTING_START_DATE                             AS  Sett_Strt_Date          --核算开始日期
    ,ACCOUNTING_END_DATE                               AS  Sett_End_Date           --核算结束日期
FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A

;
