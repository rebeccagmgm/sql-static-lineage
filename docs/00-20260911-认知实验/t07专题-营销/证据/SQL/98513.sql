-- task_id: 98513
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/PTY/PDATA_N.T01_EXT_EPRT_INFO_RMS049.py
-- observed_at: 2026-09-05T01:06:41.992Z

-- createSql
CREATE TABLE IF NOT EXISTS T01_EXT_EPRT_INFO(
     Eprt_Pty_Id                STRING COMMENT '专家编号'
    ,Eprt_Intro                 STRING COMMENT '专家简介'
    ,Show_Eprt_Name             STRING COMMENT '对客展示专家名称'
    ,Show_Eprt_Intro            STRING COMMENT '对客展示专家简介'
    ,Nationality                STRING COMMENT '国籍'
    ,Intro_Type_Cd              STRING COMMENT '引入人类型代码'
    ,Intror_Name                STRING COMMENT '引入人名称'
    ,Intror_No                  STRING COMMENT '引入人号码'
    ,Eprt_Appo_Co_Name          STRING COMMENT '专家任职公司名称'
    ,Eprt_Appo_Status_Cd        STRING COMMENT '专家任职状态代码'
    ,Pos_Name                   STRING COMMENT '职位名称'
    ,Oact_Bank_No               STRING COMMENT '开户行编号'
    ,Bank_Acct                  STRING COMMENT '银行账户'
    ,Appr_Stat_Cd               STRING COMMENT '审批状态代码'
    ,Remark                     STRING COMMENT '备注'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
)COMMENT '外部专家信息'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T01_EXT_EPRT_INFO PARTITION(SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_RMS.N_EXPERT_INFO:专家信息表] 
-----------------------------------------------------------------------------------------------------
SELECT
     CONCAT('RMS049-',ID)                  AS  Eprt_Pty_Id             --专家编号        
    ,INTRO                                 AS  Eprt_Intro              --专家简介        
    ,SHOW_NAME                             AS  Show_Eprt_Name          --对客展示专家名称
    ,SHOW_INTRO                            AS  Show_Eprt_Intro         --对客展示专家简介
    ,NVL(B.DW_CD_VAL,NATION)               AS  Nationality             --国籍            
    ,INTRODUCE_TYPE                        AS  Intro_Type_Cd           --引入人类型代码  
    ,INTRODUCER                            AS  Intror_Name             --引入人名称      
    ,INTRODUCER_PHONE                      AS  Intror_No               --引入人号码      
    ,COMPANY                               AS  Eprt_Appo_Co_Name       --专家任职公司名称
    ,IN_SERVICE                            AS  Eprt_Appo_Status_Cd     --专家任职状态代码
    ,POST                                  AS  Pos_Name                --职位名称        
    ,BANK                                  AS  Oact_Bank_No            --开户行编号      
    ,BANK_ACCOUNT                          AS  Bank_Acct               --银行账户        
    ,NVL(C.DW_CD_VAL,APPROVE_STATUS)       AS  Appr_Stat_Cd            --审批状态代码    
    ,REMARK                                AS  Remark                  --备注            
    ,'${data_src_cd}'                 AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                    AS  Task_Name               --任务名
    ,'${data_day_str}'                AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'              AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                  AS  Data_Time               --数据时间
FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' AND NOT(TELECONFERENCE_ID='0' and OFFLINE_EXPERT_ID='0') AND REMOVE_TAG='0' )A
LEFT JOIN (
         SELECT SRC_CD_VAL,DW_CD_VAL
           FROM PDATA_N.REF_CD_CVT_MAP
         WHERE TGT_TAB_NAME = 'T01_EXT_EPRT_INFO'
            AND TGT_TAB_FLD  = 'Nat_Area_Cd'
            AND SRC_TAB_NAME = 'EXPERT_INFO'
            AND SRC_FLD_NAME = 'NATION'
            AND SRC_SYS_NAME='RMS')B
   ON      A.NATION =B.SRC_CD_VAL                  --NATION 转码
LEFT JOIN (
         SELECT SRC_CD_VAL,DW_CD_VAL
           FROM PDATA_N.REF_CD_CVT_MAP
         WHERE TGT_TAB_NAME = 'T07_PROM_EPRT_INFO'
            AND TGT_TAB_FLD  = 'Appr_Stat_Cd'
            AND SRC_TAB_NAME = 'EXPERT_INFO'
            AND SRC_FLD_NAME = 'APPROVE_STATUS'
            AND SRC_SYS_NAME='RMS')C
   ON      A.APPROVE_STATUS =C.SRC_CD_VAL                  --APPROVE_STATUS 转码
;
