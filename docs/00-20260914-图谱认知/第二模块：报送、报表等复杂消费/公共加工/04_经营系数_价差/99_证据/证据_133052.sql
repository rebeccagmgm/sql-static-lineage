-- task_id: 133052
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/REF/PDATA_N.T99_DERI_COMP_SPRD_COEF_REF_OIS010.py
-- observed_at: 2026-09-05T01:06:53.145Z

-- createSql
CREATE TABLE IF NOT EXISTS T99_DERI_COMP_SPRD_COEF_REF(
     Agt_Id                     STRING COMMENT '协议编号'
    ,Agt_Modifr                 STRING COMMENT '协议修饰符'
    ,Inr_Comp_No                STRING COMMENT '内部合约编号'
    ,Busi_Type                  STRING COMMENT '业务类型'
    ,Coef_Type                  STRING COMMENT '系数类型'
    ,Src_Comp_Type_Cd           STRING COMMENT '源合约类型代码'
    ,Src_Comp_Type_Name         STRING COMMENT '源合约类型名称'
    ,Src_Undrl_Type_Cd          STRING COMMENT '源标的类型代码'
    ,Sprd_Calc_Type             STRING COMMENT '价差计算类型'
    ,Annu_Sprd_Coef             STRING COMMENT '年化价差系数'
    ,Absl_Sprd_Coef             STRING COMMENT '绝对价差系数'
    ,Vld_Date                   STRING COMMENT '生效日期'
    ,Desc                       STRING COMMENT '描述'
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
    ,Real_Src_Tbl               STRING COMMENT '真实源表'
    ,Bel_Busi_Dept              STRING COMMENT '所属业务部门'
    ,Cms_Fee_Rate               STRING COMMENT '佣金费率'
    ,Para_Appr_Evt_Id           STRING COMMENT '参数审批事件编号'
    ,Trd_Cutp_Pty_Id            STRING COMMENT '交易对手当事人编号'
    ,Dft_Prsn_User_Id           STRING COMMENT '拟稿人用户编号'
)COMMENT '衍生品合约价差系数参考信息'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T99_DERI_COMP_SPRD_COEF_REF PARTITION(SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_OIS.O_CONTRACT_SPREAD_RATE:销售收入合约价差系数表]
-----------------------------------------------------------------------------------------------------
SELECT
     CASE WHEN C.KEY_OTC_TRADE_ID IS NOT NULL THEN B.KEY_OTC_TRADE_ID
          WHEN D.KEY_OTC_TRADE_ID IS NOT NULL THEN B.KEY_OTC_TRADE_ID
          WHEN E.KEY_TRADE_COMFIRM_ID IS NOT NULL THEN A.CONTRACT_CODE
          ELSE '' END
                                           AS  Agt_Id                  --协议编号
    ,CASE WHEN C.KEY_OTC_TRADE_ID IS NOT NULL THEN '20206'
          WHEN D.KEY_OTC_TRADE_ID IS NOT NULL THEN '20207'
          WHEN E.KEY_TRADE_COMFIRM_ID IS NOT NULL THEN '20206-KST'
          ELSE '' END
                                           AS  Agt_Modifr              --协议修饰符
    ,A.CONTRACT_CODE                       AS  Inr_Comp_No             --内部合约编号
    ,A.BUSINESS_TYPE                       AS  Busi_Type               --业务类型
    ,A.CROSS_OR_INR                        AS  Coef_Type               --系数类型
    ,A.CONTRACT_TYPE                       AS  Src_Comp_Type_Cd        --源合约类型代码
    ,A.CONTRACT_TYPE_NAME                  AS  Src_Comp_Type_Name      --源合约类型名称
    ,A.UNDERLYING_TYPE                     AS  Src_Undrl_Type_Cd       --源标的类型代码
    ,A.SPREAD_CALCULATION                  AS  Sprd_Calc_Type          --价差计算类型
    ,A.ANNUALIZED_SPREAD                   AS  Annu_Sprd_Coef          --年化价差系数
    ,A.ABSOLUTE_SPREAD                     AS  Absl_Sprd_Coef          --绝对价差系数
    ,A.EFFECTIVE_DATE                      AS  Vld_Date                --生效日期
    ,A.DISCRIPTION                         AS  Desc                    --描述
    ,A.CREATED_DATETIME                    AS  Estb_Time               --创建时间
    ,A.UPDATED_DATETIME                    AS  Upd_Time                --更新时间
    ,A.CREATED_BY                          AS  Creator                 --创建人
    ,A.UPDATED_BY                          AS  Upd_Prsn                --更新人
    ,CASE WHEN A.IS_DELETED='Y' THEN '1'
          WHEN A.IS_DELETED='N' THEN '0'
          ELSE A.IS_DELETED END            AS  Del_Flag                --删除标志
    ,'${data_src_cd}'                 AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                    AS  Task_Name               --任务名
    ,'${data_day_str}'                AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'              AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                  AS  Data_Time               --数据时间
    ,'${src_table}'                   AS  Real_Src_Tbl            --真实源表
    ,'OTC'                                 AS  Bel_Busi_Dept           --所属业务部门  'OTC' --总部股衍
    ,''                                    AS  Cms_Fee_Rate            --佣金费率
    ,CONCAT('OIS061-',T3.CROSS_SELL_APPROVAL_PROCESS_ID)
                                           AS  Para_Appr_Evt_Id        --参数审批事件编号
    ,T3.CLIENT_ID                          AS  Trd_Cutp_Pty_Id         --交易对手当事人编号
    ,T3.DRAFTER                            AS  Dft_Prsn_User_Id        --拟稿人用户编号
FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A
LEFT JOIN(SELECT * FROM ODATA_N_TIT.D_TRD_OTC_TRADE WHERE BUSI_DATE ='${data_day_str}') B
       ON   A.CONTRACT_CODE=B.INTERNAL_TRADE_ID
LEFT JOIN (SELECT * FROM ODATA_N_TIT.D_REF_TRS  WHERE BUSI_DATE ='${data_day_str}'  )C
       ON B.KEY_OTC_TRADE_ID=C.KEY_OTC_TRADE_ID
LEFT JOIN (SELECT KEY_OTC_TRADE_ID FROM ODATA_N_TIT.D_REF_OTC_OPTION_DEAL WHERE BUSI_DATE ='${data_day_str}'  )D
       ON B.KEY_OTC_TRADE_ID=D.KEY_OTC_TRADE_ID
LEFT JOIN  (SELECT DISTINCT KEY_TRADE_COMFIRM_ID FROM ODATA_N_TIT.D_KS_TRADE_COMFIRM_INFO  WHERE BUSI_DATE='${data_day_str}' )E
       ON A.CONTRACT_CODE=E.KEY_TRADE_COMFIRM_ID
LEFT JOIN (
  SELECT * FROM (
    SELECT
        T.*,
        ROW_NUMBER() OVER (
            PARTITION BY CONTRACT_CODE, CROSS_OR_INR, CONTRACT_TYPE,
                         SPREAD_CALCULATION, ANNUALIZED_SPREAD, ABSOLUTE_SPREAD
            ORDER BY UPDATED_DATETIME DESC
        ) AS RN
    FROM ODATA_N_OIS.G_CONTRACT_SPREAD_RATE_TEMP T
    WHERE IS_DELETED = 'N'
      AND BUSI_DATE = '${data_day_str}'
  ) T0 WHERE T0.RN=1
) T3
    ON A.CONTRACT_CODE = T3.CONTRACT_CODE
    AND A.CROSS_OR_INR = T3.CROSS_OR_INR
    AND A.CONTRACT_TYPE = T3.CONTRACT_TYPE
    AND A.SPREAD_CALCULATION = T3.SPREAD_CALCULATION
    AND A.ANNUALIZED_SPREAD = T3.ANNUALIZED_SPREAD
    AND A.ABSOLUTE_SPREAD = T3.ABSOLUTE_SPREAD

;
