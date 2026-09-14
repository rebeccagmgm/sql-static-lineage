-- task_id: 208592
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_OTC_DERI_PRD_POOL_ADTNL_INFO_TIT329.py
-- observed_at: 2026-09-05T01:07:21.172Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_OTC_DERI_PRD_POOL_ADTNL_INFO(
         Pool_Id                    STRING COMMENT '池编号'
        ,Repy_Prior                 STRING COMMENT '还券优先级'
        ,Book_Scr_Prior             STRING COMMENT '约券优先级'
        ,Scr_Src_Trd_Method_Cd      STRING COMMENT '券源交易方式代码'
        ,Scr_Src_Appt_Method_Cd     STRING COMMENT '券源约定方式代码'
        ,Sb_O32_Acct                STRING COMMENT '自营O32账号'
        ,Sb_O32_Oper_Id             STRING COMMENT '自营O32操作员编号'
        ,Scr_Src_Rank_No            STRING COMMENT '券源排序编号'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Etl_Date              STRING COMMENT '数据加载日期'
        ,Data_Upt_Date              STRING COMMENT '数据更新日期'
        ,Data_Time                  STRING COMMENT '数据时间'
        ,Real_Src_Tbl               STRING COMMENT '真实源表'
    )COMMENT '场外衍生品产品池附加信息'
    PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
    STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_OTC_DERI_PRD_POOL_ADTNL_INFO PARTITION(SRC_TBL='${src_table}')
    -----------------------------------------------------------------------------------------------------
    --Group1.: Source Table:[ODATA_N_TIT.K_EQ_EQUITY_SOURCE:券源名称管理] 
    -----------------------------------------------------------------------------------------------------
    SELECT
         EQ_SOURCE_ID                          AS  Pool_Id                 --池编号                  
        ,RETURN_PRIORITY                       AS  Repy_Prior              --还券优先级                
        ,BOOKING_PRIORITY                      AS  Book_Scr_Prior          --约券优先级                
        ,TRADE_TYPE                            AS  Scr_Src_Trd_Method_Cd   --券源交易方式代码             
        ,PROMISE_TYPE                          AS  Scr_Src_Appt_Method_Cd  --券源约定方式代码             
        ,O32_ACCOUNT                           AS  Sb_O32_Acct             --自营O32账号              
        ,O32_OPERATOR                          AS  Sb_O32_Oper_Id          --自营O32操作员编号           
        ,SORT_NUM                              AS  Scr_Src_Rank_No         --券源排序编号               
        ,'${data_src_cd}'                 AS  Data_Src_Cd             --数据来源代码
        ,'${filename}'                    AS  Task_Name               --任务名
        ,'${data_day_str}'                AS  Data_Etl_Date           --数据加载日期
        ,'${data_day_str}'                AS  Data_Upt_Date           --数据更新日期
        ,'${data_today}'                  AS  Data_Time               --数据时间
        ,'${src_table}'                   AS  Real_Src_Tbl            --真实源表
    FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A
    ;
