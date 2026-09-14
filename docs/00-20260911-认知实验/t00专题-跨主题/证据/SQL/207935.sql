-- task_id: 207935
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_REQ_PROC_TPLT_INFO_TIT324.py
-- observed_at: 2026-09-05T01:07:20.663Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_REQ_PROC_TPLT_INFO(
         Proc_Tplt_Id               STRING COMMENT '流程模版编号'
        ,Proc_Tplt_Clas_Cd          STRING COMMENT '流程模版分类代码'
        ,Proc_Tplt_Def_Id           STRING COMMENT '流程模版定义编号'
        ,Proc_Clas_Cd               STRING COMMENT '流程分类代码'
        ,Deflt_Proc_Flag            STRING COMMENT '默认流程标志'
        ,Req_Proc_Tplt_Stat_Cd      STRING COMMENT '需求流程模版状态代码'
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
    )COMMENT '需求流程模版信息'
    PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
    STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_REQ_PROC_TPLT_INFO PARTITION(SRC_TBL='${src_table}')
    -----------------------------------------------------------------------------------------------------
    --Group1.: Source Table:[ODATA_N_TIT.F_TRD_OPTION_PROCESS_DEF:期权流程配置表] 
    -----------------------------------------------------------------------------------------------------
    SELECT
         CONCAT('TIT324-',ID)                  AS  Proc_Tplt_Id            --流程模版编号 
        ,'OTC_DERI_OPT_PROC'                   AS  Proc_Tplt_Clas_Cd       --流程模版分类代码             'OTC_DERI_OPT_PROC' --场外衍生品期权流程
        ,PROCESS_DEF_ID                        AS  Proc_Tplt_Def_Id        --流程模版定义编号    
        ,EVENT_TYPE                            AS  Proc_Clas_Cd           --流程分类代码    
        ,CASE WHEN IS_DEFAULT = 'Y' THEN '1'
              WHEN IS_DEFAULT = 'N' THEN '0'
              ELSE IS_DEFAULT END              AS  Deflt_Proc_Flag         --默认流程标志        
        ,NVL(DW_CD_VAL,IS_ENABLE)              AS  Req_Proc_Tplt_Stat_Cd   --需求流程模版状态代码
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
    LEFT JOIN (
             SELECT SRC_CD_VAL,DW_CD_VAL
               FROM PDATA_N.REF_CD_CVT_MAP_TEMP
             WHERE TGT_TAB_NAME = 'T00_REQ_PROC_TPLT_INFO'
                AND TGT_TAB_FLD  = 'Req_Proc_Tplt_Stat_Cd'
                AND SRC_TAB_NAME = 'TRD_OPTION_PROCESS_DEF'
                AND SRC_FLD_NAME = 'IS_ENABLE'
                AND SRC_SYS_NAME='TIT')B
       ON      A.IS_ENABLE =B.SRC_CD_VAL                  --IS_ENABLE 转码
    ;
