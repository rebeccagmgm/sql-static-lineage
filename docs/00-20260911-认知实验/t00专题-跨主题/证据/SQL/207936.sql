-- task_id: 207936
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_REQ_PROC_TPLT_DEF_COND_TIT325.py
-- observed_at: 2026-09-05T01:07:20.687Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_REQ_PROC_TPLT_DEF_COND(
         Proc_Tplt_Id               STRING COMMENT '流程模版编号'
        ,Sel_Regu_Cond_Name         STRING COMMENT '筛选规则条件名称'
        ,Oper                       STRING COMMENT '运算符号'
        ,Sel_Regu_Cond_Val          STRING COMMENT '筛选规则条件值'
        ,Remark                     STRING COMMENT '备注'
        ,Create_User_Id             STRING COMMENT '创建用户编号'
        ,Create_Time                STRING COMMENT '创建时间'
        ,Upd_User_Id                STRING COMMENT '更新用户编号'
        ,Upd_Time                   STRING COMMENT '更新时间'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Etl_Date              STRING COMMENT '数据加载日期'
        ,Data_Upt_Date              STRING COMMENT '数据更新日期'
        ,Data_Time                  STRING COMMENT '数据时间'
        ,Real_Src_Tbl               STRING COMMENT '真实源表'
    )COMMENT '需求流程模版定义条件'
    PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
    STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_REQ_PROC_TPLT_DEF_COND PARTITION(SRC_TBL='${src_table}')
    -----------------------------------------------------------------------------------------------------
    --Group1.: Source Table:[ODATA_N_TIT.F_TRD_OPTION_PROCESS_CONDITION:期权流程定义条件表] 
    -----------------------------------------------------------------------------------------------------
    SELECT
         CONCAT('TIT324-',KEY_DEF_ID)          AS  Proc_Tplt_Id            --流程模版编号    
        ,CONDITION_NAME                        AS  Sel_Regu_Cond_Name      --筛选规则条件名称
        ,CONDITION_OPERATOR                    AS  Oper                    --运算符号        
        ,CONDITION_VALUE                       AS  Sel_Regu_Cond_Val       --筛选规则条件值  
        ,REMARK                                AS  Remark                  --备注            
        ,CREATED_BY                            AS  Create_User_Id          --创建用户编号    
        ,CREATED_DATETIME                      AS  Create_Time             --创建时间        
        ,UPDATED_BY                            AS  Upd_User_Id             --更新用户编号    
        ,UPDATED_DATETIME                      AS  Upd_Time                --更新时间        
        ,'${data_src_cd}'                 AS  Data_Src_Cd             --数据来源代码
        ,'${filename}'                    AS  Task_Name               --任务名
        ,'${data_day_str}'                AS  Data_Etl_Date           --数据加载日期
        ,'${data_day_str}'                AS  Data_Upt_Date           --数据更新日期
        ,'${data_today}'                  AS  Data_Time               --数据时间
        ,'${src_table}'                   AS  Real_Src_Tbl            --真实源表
    FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A
    ;
