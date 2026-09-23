-- task_id: 224027
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/REF/PDATA_N.T99_DERI_CUTP_COMP_TYPE_SPRD_COEF_REF_OIS054.py
-- observed_at: 2026-09-05T01:07:26.455Z

-- createSql
CREATE TABLE IF NOT EXISTS T99_DERI_CUTP_COMP_TYPE_SPRD_COEF_REF(
     Pty_Id                     STRING COMMENT '当事人编号'
    ,Pty_Cate_Cd                STRING COMMENT '当事人类别代码'
    ,Busi_Type                  STRING COMMENT '业务类型'
    ,Calc_Type                  STRING COMMENT '计算类型'
    ,Coef_Type                  STRING COMMENT '系数类型'
    ,Src_Comp_Type_Cd           STRING COMMENT '源合约类型代码'
    ,Src_Comp_Type_Desc         STRING COMMENT '源合约类型名称'
    ,Src_Undrl_Type_Cd          STRING COMMENT '源标的类型代码'
    ,Annu_Sprd_Coef             STRING COMMENT '年化价差系数'
    ,Absl_Sprd_Coef             STRING COMMENT '绝对价差系数'
    ,Vld_Date                   STRING COMMENT '生效日期'
    ,Desc                       STRING COMMENT '描述'
    ,Estb_Time                  STRING COMMENT '创建时间'
    ,Creator                    STRING COMMENT '创建人'
    ,Del_Flag                   STRING COMMENT '删除标志'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
    ,Bgng_Prcg_Date_Llmt        STRING COMMENT '期初定价日下限'
    ,Bgng_Prcg_Date_Ulmt        STRING COMMENT '期初定价日上限'
)COMMENT '衍生品对手方合约类型价差系数参考信息'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T99_DERI_CUTP_COMP_TYPE_SPRD_COEF_REF PARTITION(SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group2: Source Table:[ODATA_N_OIS.G_REV_HKCPTY_BID_ASK_SPREAD_COEF:销售收入交易对手价差系数（香港）] 
-----------------------------------------------------------------------------------------------------
SELECT
     A.CLIENT_ID                           AS  Pty_Id                  --当事人编号           
    ,CASE WHEN B.CLIENT_TYPE='Individual(PI Confirmed)' THEN '110500'
          WHEN B.CLIENT_TYPE in ('CPI','IPI')           THEN '210500'
          ELSE B.CLIENT_TYPE END           AS  Pty_Cate_Cd             --当事人类别代码
    ,A.BUSINESS_TYPE                       AS  Busi_Type               --业务类型      
    ,A.SPREAD_CALC_TYPE                    AS  Calc_Type               --计算类型      
    ,'CROSS'                               AS  Coef_Type               --系数类型       'CROSS' --交叉
    ,''                                    AS  Src_Comp_Type_Cd        --源合约类型代码
    ,''                                    AS  Src_Comp_Type_Desc      --源合约类型名称
    ,A.UNDERLYING_TYPE                     AS  Src_Undrl_Type_Cd       --源标的类型代码
    ,A.ANNUALIZED_SPREAD                   AS  Annu_Sprd_Coef          --年化价差系数  
    ,A.ABSOLUTE_SPREAD                     AS  Absl_Sprd_Coef          --绝对价差系数  
    ,''                                    AS  Vld_Date                --生效日期      
    ,''                                    AS  Desc                    --描述          
    ,A.CREATED_DATETIME                    AS  Estb_Time               --创建时间      
    ,A.CREATED_BY                          AS  Creator                 --创建人        
    ,CASE WHEN A.IS_DELETED='Y' THEN '1'
          WHEN A.IS_DELETED='N' THEN '0'
          ELSE A.IS_DELETED END            AS  Del_Flag                --删除标志   
    ,'${data_src_cd}'                 AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                    AS  Task_Name               --任务名
    ,'${data_day_str}'                AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'              AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                  AS  Data_Time               --数据时间
    ,A.START_DATE                          AS  Bgng_Prcg_Date_Llmt     --期初定价日下限
    ,A.END_DATE                            AS  Bgng_Prcg_Date_Ulmt     --期初定价日上限
FROM (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A
LEFT JOIN (SELECT CLIENT_ID,CLIENT_TYPE FROM ODATA_N_OIS.G_HK_COUNTERPARTY WHERE  BUSI_DATE='${data_day_str}' )B
        ON A.CLIENT_ID=B.CLIENT_ID

;
