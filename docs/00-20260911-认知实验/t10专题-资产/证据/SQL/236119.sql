-- task_id: 236119
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/AST/PDATA_N.T10_OUR_FIX_AST_ADTNL_INFO_FAM001.py
-- observed_at: 2026-09-05T01:07:29.209Z

-- createSql
CREATE TABLE IF NOT EXISTS T10_OUR_FIX_AST_ADTNL_INFO(
      Fix_Ast_Id                 STRING COMMENT '固定资产编号'
     ,Fix_Ast_Src_Id             STRING COMMENT '固定资产源编号'
     ,Fa_Ast_Id                  STRING COMMENT 'FA资产编号'
     ,Ast_Ref_No                 STRING COMMENT '资产参考号'
     ,Ori_Val                    STRING COMMENT '原值'
     ,Net_Val                    STRING COMMENT '净值'
     ,Pc_Use_Type_Cd             STRING COMMENT '计算机使用类型代码'
     ,Respon_Prsn_Emp_Id         STRING COMMENT '资产责任人员工编号'
     ,Respon_Prsn_User_Id        STRING COMMENT '资产责任人用户编号'
     ,Respon_Prsn_Name           STRING COMMENT '资产责任人名称'
     ,Use_Dept_Inr_Org_Id        STRING COMMENT '使用内部机构编号'
     ,Use_Dept_Inr_Org_Name      STRING COMMENT '使用内部机构名称'
     ,Cost_Bear_Inr_Org_Id       STRING COMMENT '成本承担内部机构编号'
     ,Cost_Bear_Org_Seg          STRING COMMENT '成本承担机构段值'
     ,Cost_Bear_Inr_Org_Name     STRING COMMENT '成本承担内部机构名称'
     ,Req_Print_Lbl_Flag         STRING COMMENT '需打印标签标志'
     ,Print_Flag                 STRING COMMENT '已打印标志'
     ,Ntce_Flag                  STRING COMMENT '公示标志'
     ,Purch_Ord_Id               STRING COMMENT '采购订单编号'
     ,Contr_No                   STRING COMMENT '合同编号'
     ,Po_No                      STRING COMMENT 'PO单号'
     ,Rent_Term_Type_Cd          STRING COMMENT '租借期限类型代码'
     ,Rent_Strt_Time             STRING COMMENT '租借开始时间'
     ,Rent_End_Time              STRING COMMENT '租借结束时间'
     ,Bpm_Instc_Id               STRING COMMENT 'BPM实例编号'
     ,Proc_Lnch_User_Id          STRING COMMENT '流程发起用户编号'
     ,Proc_Title                 STRING COMMENT '流程标题'
     ,Req_Insr_Flag              STRING COMMENT '需投保标志'
     ,Insr_No                    STRING COMMENT '投保单号'
     ,Insr_Begn_Time             STRING COMMENT '投保起始时间'
     ,Insr_Maty_Time             STRING COMMENT '投保到期时间'
     ,Aprn_Bel_Cd                STRING COMMENT '分摊归属代码'
     ,Depr_Way                   STRING COMMENT '折旧方法'
     ,Depr_Mth_Num               STRING COMMENT '折旧月份数'
     ,Curr_Mth_Depr_Amt          STRING COMMENT '当月折旧金额'
     ,Incrs_Depr_Amt             STRING COMMENT '已提折旧金额'
     ,Trc_Back_Main_Ast_Depr_Amrt_Flag   STRING COMMENT '追溯主资产折旧摊销标志'
     ,Purch_Oper_Vsb_Flag        STRING COMMENT '采购经办人可见标志'
     ,Itai_Flag                  STRING COMMENT '信创标志'
     ,Push_Fsc_Flag              STRING COMMENT '推送共享标志'
     ,Push_Cloud_Flag            STRING COMMENT '推送云管标志'
      ,Data_Src_Cd                STRING COMMENT '数据来源代码'
     ,Task_Name                  STRING COMMENT '任务名'
     ,Data_Etl_Date              STRING COMMENT '数据加载日期'
     ,Data_Upt_Date              STRING COMMENT '数据更新日期'
     ,Data_Time                  STRING COMMENT '数据时间'
     ,Real_Src_Tbl               STRING COMMENT '真实源表'
)COMMENT '我司固定资产附加信息'
PARTITIONED BY (Src_Tbl  STRING COMMENT'源表',Busi_Date  STRING COMMENT '业务日期')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T10_OUR_FIX_AST_ADTNL_INFO PARTITION(Src_Tbl='${src_table}',Busi_Date='${data_day_str}')
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_FAM.W_ASSET_ACCOUNT:资产台账] 
-----------------------------------------------------------------------------------------------------
SELECT
      ASSET_TAG_NO                                      AS  Fix_Ast_Id              --固定资产编号                              
     ,ID_                                               AS  Fix_Ast_Src_Id          --固定资产源编号                              
     ,ASSET_CODE                                        AS  Fa_Ast_Id               --FA资产编号                              
     ,NEW_OLD_REFER_NUM                                 AS  Ast_Ref_No              --资产参考号                              
     ,ORIGINAL_VALUE_NO_TAX                             AS  Ori_Val                 --原值                              
     ,NET_VALUE                                         AS  Net_Val                 --净值                              
     ,COMPUTER_TYPE                                     AS  Pc_Use_Type_Cd          --计算机使用类型代码                              
     ,ASSET_PERSON_ERP_CODE                             AS  Respon_Prsn_Emp_Id      --资产责任人员工编号                              
     ,ASSET_RESPONSIBLE_PERSON                          AS  Respon_Prsn_User_Id     --资产责任人用户编号                              
     ,ASSET_RESPONSIBLE_PERSON_NAME                          AS  Respon_Prsn_Name        --资产责任人名称                              
     ,ASSET_USE_DEPT                                    AS  Use_Dept_Inr_Org_Id     --使用内部机构编号                              
     ,ASSET_USE_DEPT_NAME                               AS  Use_Dept_Inr_Org_Name   --使用内部机构名称                              
     ,COST_BEAR_DEPT                                    AS  Cost_Bear_Inr_Org_Id    --成本承担内部机构编号                              
     ,COST_BEAR_DEPT_CODE                               AS  Cost_Bear_Org_Seg       --成本承担机构段值                              
     ,COST_BEAR_DEPT_NAME                               AS  Cost_Bear_Inr_Org_Name  --成本承担内部机构名称                              
     ,IS_NEED_LABEL                                     AS  Req_Print_Lbl_Flag      --需打印标签标志                              
     ,IS_PRINT                                          AS  Print_Flag              --已打印标志                              
     ,IS_ANNOUNCE                                       AS  Ntce_Flag               --公示标志                              
     ,BUY_ORDER_CODE                                    AS  Purch_Ord_Id            --采购订单编号                              
     ,CONTRACT_CODE                                     AS  Contr_No                --合同编号                              
     ,PO_NUM                                            AS  Po_No                   --PO单号                              
     ,USE_PERIOD_TYPE                                   AS  Rent_Term_Type_Cd       --租借期限类型代码                              
     ,USE_TIME_START                                    AS  Rent_Strt_Time          --租借开始时间                              
     ,USE_TIME_END                                      AS  Rent_End_Time           --租借结束时间                              
     ,BPM_INST_ID                                       AS  Bpm_Instc_Id            --BPM实例编号                              
     ,FLOW_START_USER                                   AS  Proc_Lnch_User_Id       --流程发起用户编号                              
     ,FLOW_TITLE                                        AS  Proc_Title              --流程标题                              
     ,IS_NEED_INSURE                                    AS  Req_Insr_Flag           --需投保标志                              
     ,INSURE_NUM                                        AS  Insr_No                 --投保单号                              
     ,INSURE_START_DATE                                 AS  Insr_Begn_Time          --投保起始时间                              
     ,INSURE_END_DATE                                   AS  Insr_Maty_Time          --投保到期时间                              
     ,SHARE_SIGN                                        AS  Aprn_Bel_Cd             --分摊归属代码                              
     ,DEVALUE_METHOD                                    AS  Depr_Way                --折旧方法                              
     ,DEVALUE_MONTH                                     AS  Depr_Mth_Num            --折旧月份数                              
     ,CURRENT_MONTH_DEVALUE                             AS  Curr_Mth_Depr_Amt       --当月折旧金额                              
     ,PROPOSE_DEVALUE                                   AS  Incrs_Depr_Amt          --已提折旧金额                              
     ,IS_BACK_DEVALUE_COST                              AS  Trc_Back_Main_Ast_Depr_Amrt_Flag--追溯主资产折旧摊销标志                              
     ,BUY_AGENT_IS_VISIBLE                              AS  Purch_Oper_Vsb_Flag     --采购经办人可见标志                              
     ,IS_INFO_INNOVATE                                  AS  Itai_Flag               --信创标志                              
     ,IS_PUSH_SHARE                                     AS  Push_Fsc_Flag           --推送共享标志                              
     ,IS_PUSH_CMP                                       AS  Push_Cloud_Flag         --推送云管标志                              
     ,'${data_src_cd}'                             AS  Data_Src_Cd             --数据来源代码
     ,'${filename}'                                AS  Task_Name               --任务名
     ,'${data_day_str}'                            AS  Data_Etl_Date           --数据加载日期
     ,'${data_day_str}'                            AS  Data_Upt_Date           --数据更新日期
     ,'${data_today}'                              AS  Data_Time               --数据时间
     ,'${src_table}'                               AS  Real_Src_Tbl            --真实源表
FROM (SELECT *  FROM ${src_table} WHERE  Busi_Date='${data_day_str}' )A

;
