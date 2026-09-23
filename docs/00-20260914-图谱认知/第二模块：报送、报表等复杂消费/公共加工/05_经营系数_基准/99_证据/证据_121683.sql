-- task_id: 121683
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/REF/PDATA_N.T99_OTC_DERI_INR_BASE_REF_OIS006.py
-- observed_at: 2026-09-05T01:06:48.666Z

-- createSql
CREATE TABLE IF NOT EXISTS T99_OTC_DERI_INR_BASE_REF(
     Op_Mng_Comp_Type_Id        STRING COMMENT '运管合约类型编号'
    ,Base_Yield                 STRING COMMENT '基础收益率'
    ,Dft_Base_Coef              STRING COMMENT '拟定基础系数'
    ,Calc_Way                   STRING COMMENT '计算方式'
    ,Adtnl_Yield                STRING COMMENT '附加收益率'
    ,Create_Time                STRING COMMENT '创建时间'
    ,Actl_Vld_Day               STRING COMMENT '实际生效日'
    ,Src_Deleted_Flag           STRING COMMENT '源删除标志'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
)COMMENT '场外衍生品合约销售收入内部基础参数表'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表',BUSI_DATE  STRING COMMENT '业务日期')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T99_OTC_DERI_INR_BASE_REF PARTITION(SRC_TBL='${src_table}',BUSI_DATE='${data_day_str}')
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_OIS.G_INR_BASE_RATE:销售收入内部合约基础系数维护表] 
-----------------------------------------------------------------------------------------------------
SELECT
     OTC_CONTRACT_TYPE                                 AS  Op_Mng_Comp_Type_Id     --运管合约类型编号 
    ,BASE_EARNING_RATE                                 AS  Base_Yield              --基础收益率       
    ,DRAFT_BASE_RATE                                   AS  Dft_Base_Coef           --拟定基础系数     
    ,BASE_CALCULATION                                  AS  Calc_Way                --计算方式         
    ,ADDITIONAL_RATE                                   AS  Adtnl_Yield             --附加收益率       
    ,CREATED_DATETIME                                  AS  Create_Time             --创建时间         
    ,EFFECTIVE_DATE                                    AS  Actl_Vld_Day            --实际生效日       
    ,CASE WHEN IS_DELETED = 'Y' THEN '1'
          WHEN IS_DELETED = 'N' THEN '0' 
          ELSE IS_DELETED END                          AS  Src_Deleted_Flag        --源删除标志       
    ,'${data_src_cd}'                             AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                                AS  Task_Name               --任务名
    ,'${data_day_str}'                            AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'                          AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                              AS  Data_Time               --数据时间
FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A

;
