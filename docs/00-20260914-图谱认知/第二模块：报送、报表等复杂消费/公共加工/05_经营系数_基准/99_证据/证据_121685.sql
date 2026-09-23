-- task_id: 121685
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/REF/PDATA_N.T99_OTC_DERI_INR_BASE_MAPPING_OIS007.py
-- observed_at: 2026-09-05T01:06:48.672Z

-- createSql
CREATE TABLE IF NOT EXISTS T99_OTC_DERI_INR_BASE_MAPPING(
     Otc_Deri_Comp_Type         STRING COMMENT '场外衍生品合约类型'
    ,Op_Mng_Comp_Type_Id        STRING COMMENT '运管合约类型编号'
    ,Op_Mng_Comp_Type_Desc      STRING COMMENT '运管合约类型描述'
    ,Src_Agt_Type_Cd            STRING COMMENT '源协议类型代码'
    ,Src_Agt_Type_Desc          STRING COMMENT '源协议类型描述'
    ,Src_Agt_Sub_Type_Cd        STRING COMMENT '源协议子类型代码'
    ,Src_Agt_Sub_Type_Desc      STRING COMMENT '源协议子类型描述'
    ,Src_Undrl_Type_Cd_Str      STRING COMMENT '源标的类型代码串'
    ,Src_Undrl_Type_Desc_Str    STRING COMMENT '源标的类型描述串'
    ,Create_Time                STRING COMMENT '创建时间'
    ,Src_Deleted_Flag           STRING COMMENT '源删除标志'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
)COMMENT '场外衍生品合约销售收入内部基础参数分类映射表'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表',BUSI_DATE  STRING COMMENT '业务日期')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T99_OTC_DERI_INR_BASE_MAPPING PARTITION(SRC_TBL='${src_table}',BUSI_DATE='${data_day_str}')
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_OIS.G_INR_CONTRACT_MAPPING:销售收入内部合约类型映射表] 
-----------------------------------------------------------------------------------------------------
SELECT
     BUSINESS_TYPE                                     AS  Otc_Deri_Comp_Type      --场外衍生品合约类型
    ,OTC_CONTRACT_TYPE                                 AS  Op_Mng_Comp_Type_Id     --运管合约类型编号  
    ,OTC_CONTRACT_TYPE_NAME                            AS  Op_Mng_Comp_Type_Desc   --运管合约类型描述  
    ,SRC_CONTR_TYPE                                    AS  Src_Agt_Type_Cd         --源协议类型代码    
    ,SRC_CONTR_TYPE_DESC                               AS  Src_Agt_Type_Desc       --源协议类型描述    
    ,SRC_SUB_CONTR_TYPE                                AS  Src_Agt_Sub_Type_Cd     --源协议子类型代码  
    ,SRC_SUB_CONTR_TYPE_DESC                           AS  Src_Agt_Sub_Type_Desc   --源协议子类型描述  
    ,UNDRL_TYPE                                        AS  Src_Undrl_Type_Cd_Str   --源标的类型代码串  
    ,UNDRL_TYPE_DESC                                   AS  Src_Undrl_Type_Desc_Str --源标的类型描述串  
    ,CREATED_DATETIME                                  AS  Create_Time             --创建时间          
    ,CASE WHEN IS_DELETED = 'Y' THEN '1'
          WHEN IS_DELETED = 'N' THEN '0' 
          ELSE IS_DELETED END     
                                                       AS  Src_Deleted_Flag        --源删除标志        
    ,'${data_src_cd}'                             AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                                AS  Task_Name               --任务名
    ,'${data_day_str}'                            AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'                          AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                              AS  Data_Time               --数据时间
FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A

;
