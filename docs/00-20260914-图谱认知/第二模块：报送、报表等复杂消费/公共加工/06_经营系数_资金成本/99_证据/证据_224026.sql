-- task_id: 224026
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/REF/PDATA_N.T99_DERI_COMP_TYPE_FND_COST_REF_OIS053.py
-- observed_at: 2026-09-05T01:07:26.448Z

-- createSql
CREATE TABLE IF NOT EXISTS T99_DERI_COMP_TYPE_FND_COST_REF(
     Busi_Type                  STRING COMMENT '业务类型'
    ,Src_Comp_Type_Cd           STRING COMMENT '源合约类型代码'
    ,Src_Comp_Type_Desc         STRING COMMENT '源合约类型名称'
    ,Src_Undrl_Type_Cd          STRING COMMENT '源标的类型代码'
    ,Vld_Date                   STRING COMMENT '生效日期'
    ,Fnd_Cost                   STRING COMMENT '资金成本'
    ,Estb_Time                  STRING COMMENT '创建时间'
    ,Upd_Time                   STRING COMMENT '更新时间'
    ,Creator                    STRING COMMENT '创建人'
    ,Upd_Prsn                   STRING COMMENT '更新人'
    ,Desc                       STRING COMMENT '描述'
    ,Del_Flag                   STRING COMMENT '逻辑删除标识'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
    ,Real_Src_Tbl               STRING COMMENT '真实源表'
    ,Src_Dept_No                STRING COMMENT '源部门编码'
    ,Intr_Strt_Date             STRING COMMENT '起息开始日期'
    ,Intr_End_Date              STRING COMMENT '起息结束日期'
    ,Bel_Busi_Dept              STRING COMMENT '所属业务部门'
)COMMENT '衍生品合约类型资金成本参考信息'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T99_DERI_COMP_TYPE_FND_COST_REF PARTITION(SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group2: Source Table:[ODATA_N_OIS.G_REV_HK_CAPITAL_COST:销售收入资金成本（香港）] 
-----------------------------------------------------------------------------------------------------
SELECT
     BUSINESS_TYPE                         AS  Busi_Type               --业务类型      
    ,CONTRACT_TYPE                         AS  Src_Comp_Type_Cd        --源合约类型代码
    ,CONTRACT_TYPE_NAME                    AS  Src_Comp_Type_Desc      --源合约类型名称
    ,UNDERLYING_TYPE                       AS  Src_Undrl_Type_Cd       --源标的类型代码
    ,''                                    AS  Vld_Date                --生效日期      
    ,CAPITAL_COST                          AS  Fnd_Cost                --资金成本      
    ,CREATED_DATETIME                      AS  Estb_Time               --创建时间      
    ,UPDATED_DATETIME                      AS  Upd_Time                --更新时间      
    ,CREATED_BY                            AS  Creator                 --创建人        
    ,UPDATED_BY                            AS  Upd_Prsn                --更新人        
    ,DESCRIPTION                           AS  Desc                    --描述          
    ,CASE WHEN IS_DELETED='Y' THEN '1'
          WHEN IS_DELETED='N' THEN '0'
          ELSE IS_DELETED END              AS  Del_Flag                --删除标志 
    ,'${data_src_cd}'                 AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                    AS  Task_Name               --任务名
    ,'${data_day_str}'                AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'              AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                  AS  Data_Time               --数据时间
    ,'${src_table}'                   AS  Real_Src_Tbl            --真实源表
    ,''                                    AS  Src_Dept_No             --源部门编码
    ,START_DATE                            AS  Intr_Strt_Date          --起息开始日期
    ,END_DATE                              AS  Intr_End_Date           --起息结束日期
    ,'OTC_HK'                              AS  Bel_Busi_Dept           --所属业务部门   'OTC_HK' --香港股衍
FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A

;
