-- task_id: 133054
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/REF/PDATA_N.T99_DERI_COMP_BASE_COEF_REF_OIS011.py
-- observed_at: 2026-09-05T01:06:53.152Z

-- createSql
CREATE TABLE IF NOT EXISTS T99_DERI_COMP_BASE_COEF_REF(
     Agt_Id                     STRING COMMENT '协议编号'
    ,Agt_Modifr                 STRING COMMENT '协议修饰符'
    ,Inr_Comp_No                STRING COMMENT '内部合约编号'
    ,Calc_Type                  STRING COMMENT '计算类型'
    ,Coef_Type                  STRING COMMENT '系数类型'
    ,Base_Yield                 STRING COMMENT '基础收益率'
    ,Dft_Base_Coef              STRING COMMENT '拟定基础系数'
    ,Desc                       STRING COMMENT '描述'
    ,Main_Oper_Prsn             STRING COMMENT '主经办人'
    ,Intro_Oper_Prsn            STRING COMMENT '引入经办人'
    ,Adtnl_Rwd_Flag             STRING COMMENT '额外奖励标志'
    ,Adtnl_Rwd                  STRING COMMENT '额外奖励'
    ,Estb_Time                  STRING COMMENT '创建时间'
    ,Upd_Time                   STRING COMMENT '更新时间'
    ,Creator                    STRING COMMENT '创建人'
    ,Upd_Prsn                   STRING COMMENT '更新人'
    ,Del_Flag                   STRING COMMENT '删除标志'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
)COMMENT '衍生品合约基础系数参考信息'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T99_DERI_COMP_BASE_COEF_REF PARTITION(SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group2: Source Table:[ODATA_N_OIS.G_INR_CONTRACT_BASE_RATE:销售收入内部合约基础系数维护表]
-----------------------------------------------------------------------------------------------------
SELECT
     CASE WHEN C.KEY_OTC_TRADE_ID IS NOT NULL THEN B.KEY_OTC_TRADE_ID
          WHEN D.KEY_OTC_TRADE_ID IS NOT NULL THEN B.KEY_OTC_TRADE_ID
          WHEN E.KEY_TRADE_COMFIRM_ID IS NOT NULL THEN A.CONTRACT_CODE
          ELSE '' END                         AS  Agt_Id                  --协议编号
    ,CASE WHEN C.KEY_OTC_TRADE_ID IS NOT NULL THEN '20206'
          WHEN D.KEY_OTC_TRADE_ID IS NOT NULL THEN '20207'
          WHEN E.KEY_TRADE_COMFIRM_ID IS NOT NULL THEN '20206-KST'
          ELSE '' END                        AS  Agt_Modifr              --协议修饰符
    ,A.CONTRACT_CODE                         AS  Inr_Comp_No             --内部合约编号
    ,A.BASE_CALCULATION                      AS  Calc_Type               --计算类型
    ,'INR'                                   AS  Coef_Type               --系数类型
    ,A.BASE_EARNING_RATE                     AS  Base_Yield              --基础收益率
    ,A.DRAFT_BASE_RATE                       AS  Dft_Base_Coef           --拟定基础系数
    ,A.DISCRIPTION                           AS  Desc                    --描述
    ,A.OPERATOR_NAME                         AS  Main_Oper_Prsn          --主经办人
    ,A.INTRODUCTION_OPERATOR_NAME            AS  Intro_Oper_Prsn         --引入经办人
    ,''                                      AS  Adtnl_Rwd_Flag          --额外奖励标志
    ,''                                      AS  Adtnl_Rwd               --额外奖励
    ,A.CREATED_DATETIME                      AS  Estb_Time               --创建时间
    ,A.UPDATED_DATETIME                      AS  Upd_Time                --更新时间
    ,A.CREATED_BY                            AS  Creator                 --创建人
    ,A.UPDATED_BY                            AS  Upd_Prsn                --更新人
    ,CASE WHEN A.IS_DELETED='Y' THEN '1'
          WHEN A.IS_DELETED='N' THEN '0'
          ELSE A.IS_DELETED END              AS  Del_Flag                --删除标志
    ,'${data_src_cd}'                   AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                      AS  Task_Name               --任务名
    ,'${data_day_str}'                  AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'                AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                    AS  Data_Time               --数据时间
FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A
LEFT JOIN(SELECT * FROM ODATA_N_TIT.D_TRD_OTC_TRADE WHERE BUSI_DATE ='${data_day_str}') B
       ON   A.CONTRACT_CODE=B.INTERNAL_TRADE_ID
LEFT JOIN (SELECT * FROM ODATA_N_TIT.D_REF_TRS  WHERE BUSI_DATE ='${data_day_str}'  )C
       ON B.KEY_OTC_TRADE_ID=C.KEY_OTC_TRADE_ID
LEFT JOIN (SELECT KEY_OTC_TRADE_ID FROM ODATA_N_TIT.D_REF_OTC_OPTION_DEAL WHERE BUSI_DATE ='${data_day_str}'  )D
       ON B.KEY_OTC_TRADE_ID=D.KEY_OTC_TRADE_ID
LEFT JOIN  (SELECT DISTINCT KEY_TRADE_COMFIRM_ID FROM ODATA_N_TIT.D_KS_TRADE_COMFIRM_INFO  WHERE BUSI_DATE='${data_day_str}' )E
       ON A.CONTRACT_CODE=E.KEY_TRADE_COMFIRM_ID


;
