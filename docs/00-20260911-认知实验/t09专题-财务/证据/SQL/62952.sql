-- task_id: 62952
-- hiveDb: PDATA_N
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/FIN/PDATA_N.T09_ACCTNT_SUBJ_ERP038_GD.py
-- observed_at: 2026-09-05T01:06:20.694Z

-- createSql
CREATE TABLE IF NOT EXISTS T09_ACCTNT_SUBJ(
      Sob_Plan_Id              string comment'账套方案编号'
     ,Subj_Id                  string comment'科目编号'
     ,Subj_Name                string comment'科目名称'
     ,Subj_Lvl                 string comment'科目层级'
     ,Upper_Subj_Id            string comment'上级科目编号'
     ,Upper_Subj_Name          string comment'上级科目名称'
     ,Crrc_Cd                  string comment'币种'
     ,Subj_Type_Cd             string comment'科目类型代码'
     ,Subj_Bal_Dir_Cd          string comment'科目余额方向代码'
     ,Out_Subj_Flag            string comment'表外科目标志'
     ,Ivst_Cls_Cd              string comment'投资分类代码'
     ,Sub_Sob_Id               string comment'子账套编号'
     ,Trd_Attr_Cd              string comment'交易属性代码'
     ,Acctng_Proj              string comment'核算项目'
     ,Fare_Cd                  string comment'费用代码'
     ,Exch_Type_Cd             string comment'市场代码'
     ,Scr_Cd                   string comment'证券代码'
     ,Scr_Var                  string comment'证券品种'
     ,Det_Flag                 string comment'明细项标志'
     ,Acctng_Stru              string comment'核算结构'
     ,Iss_Method_Cd            string comment'发行方式代码'
     ,Acct_No                  string comment'账户代码'
     ,Acct_Var                 string comment'账户品种'
     ,Fare_Type_Cd             string comment'费用类型代码'
     ,Sale_Method_Cd           string comment'销售方式代码'
     ,Qty_Acctng_Ind           string comment'数量核算标识'
     ,Use_Flag                 string comment'使用标志'
     ,Desc_Info                string comment'描述信息'
     ,Subj_Appr_Stat_Cd        string comment'科目审核状态代码'
     ,Assis_Acctng_Ind         string comment'辅助核算标识'
     ,Data_Src_Cd              string comment'数据来源代码'
     ,Task_Name                string comment'任务名'
     ,Data_Etl_Date            string comment'数据加载日期'
     ,DATA_TIME                string comment'数据时间'
     ,End_Subj_Flag            string comment'末级科目标志'
     ,End_Subj_No              string comment'末级科目号'
    ,Real_Src_Tbl               STRING COMMENT '真实源表'
    ,Vld_Date                   STRING COMMENT '生效日期'
    ,Invld_Date                 STRING COMMENT '失效日期'
    ,Enable_Stat_Cd             STRING COMMENT '启用状态代码'
    ,Subj_Cash_Clas_Cd          STRING COMMENT '科目现金分类代码'
    ,Use_Desc                   STRING COMMENT '使用说明'
    ,Matn_Desc                  STRING COMMENT '维护备注'
    ,Req_Acct_Age_Date_Flag     STRING COMMENT '需要账龄日期标志'
    ,Sub_Sys_Ctrl_Subj_Flag     STRING COMMENT '子系统控制科目标志'
    ,Mth_End_Clos_Flag          STRING COMMENT '月末结平标志'
    ,Ast_Module_Ctrl_Subj_Flag  STRING COMMENT '资产模块控制科目标志'
    ,Inr_Crpd_Subj_Flag         STRING COMMENT '内部往来科目标志'
    ,Sob_Id                     STRING COMMENT '账套编号'
    ,Subj_Plan_Id               STRING COMMENT '科目方案编号'
    ,Subj_Full_Name             STRING COMMENT '科目全称'
    ,Acctnt_Type_Cd             STRING COMMENT '会计类型代码'
    ,Ldg_Elmn_Regu              STRING COMMENT '台账要素规则'
    ,Lvl_Regu                   STRING COMMENT '级次规则'
    ,Assis_Item_Regu            STRING COMMENT '辅助项规则'
    ,Inpt_Time                  STRING COMMENT '录入时间'
)COMMENT '会计科目'
PARTITIONED BY (BUSI_DATE  string comment'业务日期',SRC_TBL string comment '源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE  T09_ACCTNT_SUBJ  PARTITION(Busi_Date='${data_day_str}',SRC_TBL='ODATA_N_ERP.A_FND_FLEX_VALUES_VL')
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_ERP.A_FND_FLEX_VALUES_VL:参数值VL表]
-----------------------------------------------------------------------------------------------------
SELECT DISTINCT
       B.FLEX_VALUE_SET_ID                         as Sob_Plan_Id              --账套方案编号
      ,B.FLEX_VALUE                                as Subj_Id                  --科目编号
      ,T.DESCRIPTION                               as Subj_Name                --科目名称
      ,Case When Length(B.FLEX_VALUE) = 4 Then '1'
            When Length(B.FLEX_VALUE) = 6 Then '2'
            When Length(B.FLEX_VALUE) = 8 Then '3'
             End                                 as Subj_Lvl                 --科目层级
      ,''                                        as Upper_Subj_Id            --上级科目编号
      ,''                                        as Upper_Subj_Name          --上级科目名称
      ,''                                        as Crrc_Cd                  --币种
      ,Case WHEN SUBSTR(REGEXP_REPLACE(C.COMPILED_VALUE_ATTRIBUTES, '\\n', ''), 3, 1)='A' THEN 'ZC'
            WHEN SUBSTR(REGEXP_REPLACE(C.COMPILED_VALUE_ATTRIBUTES, '\\n', ''), 3, 1)='L' THEN 'FZ'
            WHEN SUBSTR(REGEXP_REPLACE(C.COMPILED_VALUE_ATTRIBUTES, '\\n', ''), 3, 1)='O' THEN 'QY'
            WHEN SUBSTR(REGEXP_REPLACE(C.COMPILED_VALUE_ATTRIBUTES, '\\n', ''), 3, 1)='R' THEN 'SY_SR'
            WHEN SUBSTR(REGEXP_REPLACE(C.COMPILED_VALUE_ATTRIBUTES, '\\n', ''), 3, 1)='E' THEN 'SY_FY'
            ELSE '' END                     as Subj_Type_Cd             --科目类型代码
      ,Case WHEN C.ATTRIBUTE2 IN ('DR','CR') THEN C.ATTRIBUTE2
            ELSE CASE WHEN substr(REGEXP_REPLACE(C.COMPILED_VALUE_ATTRIBUTES, '\\n', ''), 3, 1) IN ('A','E') THEN 'DR'
                     ELSE 'CR' END
             End                                 as Subj_Bal_Dir_Cd          --科目余额方向代码
      ,''                                        as Out_Subj_Flag            --表外科目标志
      ,''                                        as Ivst_Cls_Cd              --投资分类代码
      ,''                                        as Sub_Sob_Id               --子账套编号
      ,''                                        as Trd_Attr_Cd              --交易属性代码
      ,''                                        as Acctng_Proj              --核算项目
      ,''                                        as Fare_Cd                  --费用代码
      ,''                                        as Exch_Type_Cd             --市场代码
      ,''                                        as Scr_Cd                   --证券代码
      ,''                                        as Scr_Var                  --证券品种
      ,Case When B.SUMMARY_FLAG='N' Then '1'
            When B.SUMMARY_FLAG='Y' Then '0'
             End                                 as Det_Flag                 --明细项标志
      ,''                                        as Acctng_Stru              --核算结构
      ,''                                        as Iss_Method_Cd            --发行方式代码
      ,''                                        as Acct_No                  --账户代码
      ,''                                        as Acct_Var                 --账户品种
      ,''                                        as Fare_Type_Cd             --费用类型代码
      ,''                                        as Sale_Method_Cd           --销售方式代码
      ,''                                        as Qty_Acctng_Ind           --数量核算标识
      ,''                                        as Use_Flag                 --使用标志
      ,''                                        as Desc_Info                --描述信息
      ,''                                        as Subj_Appr_Stat_Cd        --科目审核状态代码
      ,''                                        as Assis_Acctng_Ind         --辅助核算标识
      ,'ERP'                                     as DATA_SRC_CD              --数据来源代码
      ,UPPER('${filename}')                 as TASK_NAME                --任务名
      ,'${data_day_str}'                    as DATA_ETL_DATE            --数据加载日期
      ,'${data_today}'                      as DATA_TIME                --数据时间
      ,''                                        as End_Subj_Flag            --末级科目标志    
      ,''                                        as End_Subj_No              --末级科目号  
      ,'ODATA_N_ERP.A_FND_FLEX_VALUES_VL'        AS  Real_Src_Tbl              --真实源表
      ,''                                        AS  Vld_Date                  --生效日期
      ,''                                        AS  Invld_Date                --失效日期
      ,''                                        AS  Enable_Stat_Cd            --启用状态代码
      ,''                                        AS  Subj_Cash_Clas_Cd         --科目现金分类代码
      ,''                                        AS  Use_Desc                  --使用说明
      ,''                                        AS  Matn_Desc                 --维护备注
      ,''                                        AS  Req_Acct_Age_Date_Flag    --需要账龄日期标志
      ,''                                        AS  Sub_Sys_Ctrl_Subj_Flag    --子系统控制科目标志
      ,''                                        AS  Mth_End_Clos_Flag         --月末结平标志
      ,''                                        AS  Ast_Module_Ctrl_Subj_Flag --资产模块控制科目标志
      ,''                                        AS  Inr_Crpd_Subj_Flag        --内部往来科目标志
      ,''                                        AS  Sob_Id                    --账套编号
      ,''                                        AS  Subj_Plan_Id              --科目方案编号
      ,''                                        AS  Subj_Full_Name            --科目全称
      ,''                                        AS  Acctnt_Type_Cd            --会计类型代码
      ,''                                        AS  Ldg_Elmn_Regu             --台账要素规则
      ,''                                        AS  Lvl_Regu                  --级次规则
      ,''                                        AS  Assis_Item_Regu           --辅助项规则
      ,''                                        AS  Inpt_Time                 --录入时间
FROM  (SELECT FLEX_VALUE_ID,DESCRIPTION 
         FROM ${src_table_erp}.A_FND_FLEX_VALUES_TL 
        WHERE BUSI_DATE='${data_day_str}' AND LANGUAGE='ZHS')T

     ,(SELECT FLEX_VALUE_SET_ID,FLEX_VALUE,FLEX_VALUE_ID ,SUMMARY_FLAG
         FROM ${src_table_erp}.A_FND_FLEX_VALUES_VL 
        WHERE BUSI_DATE='${data_day_str}' 
          AND ENABLED_FLAG = 'Y'
          AND Length(FLEX_VALUE) NOT IN('1','5','7')
          )B 
     ,(SELECT FLEX_VALUE_SET_ID 
        FROM  ${src_table_erp}.A_FND_FLEX_VALUE_SETS
        WHERE FLEX_VALUE_SET_NAME = 'GFS_B00_COA_ACCOUNT' AND BUSI_DATE='${data_day_str}' ) S
     
     ,(SELECT  FLEX_VALUE_ID
              ,START_DATE_ACTIVE
              ,END_DATE_ACTIVE 
              ,COMPILED_VALUE_ATTRIBUTES
              ,ATTRIBUTE2  
         FROM ${src_table_erp}.A_FND_FLEX_VALUES    
        WHERE BUSI_DATE='${data_day_str}' 
          AND ENABLED_FLAG = 'Y' )C

WHERE
      B.FLEX_VALUE_ID = T.FLEX_VALUE_ID
  AND C.FLEX_VALUE_ID = T.FLEX_VALUE_ID
  AND B.FLEX_VALUE_SET_ID =S.FLEX_VALUE_SET_ID 
  AND  '${data_day_str}' BETWEEN Nvl(Substr(C.START_DATE_ACTIVE,1,10), '${data_day_str}') AND
       Nvl(Substr(C.END_DATE_ACTIVE,1,10), '${data_day_str}')
;
