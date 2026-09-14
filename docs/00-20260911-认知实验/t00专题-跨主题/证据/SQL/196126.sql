-- task_id: 196126
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_SYS_INFO_BDP103.py
-- observed_at: 2026-09-05T01:07:17.081Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_SYS_INFO(
         Sys_Id                     STRING COMMENT '系统编号'
        ,Busi_Uniq_Name             STRING COMMENT '业务唯一命名'
        ,Src_Sys_No                 STRING COMMENT '源系统编号'
        ,Sys_Cd                     STRING COMMENT '系统代码'
        ,Sys_Type                   STRING COMMENT '系统类型'
        ,Sys_En_Fn                  STRING COMMENT '系统英文全称'
        ,Sys_Ch_Fn                  STRING COMMENT '系统中文全称'
        ,Sys_Nknm                   STRING COMMENT '系统别名'
        ,Sys_Old_Name               STRING COMMENT '系统曾用名'
        ,Sys_Abbr                   STRING COMMENT '系统简称'
        ,Sys_Desc                   STRING COMMENT '系统描述'
        ,Sys_Stat                   STRING COMMENT '系统状态'
        ,Join_Flag                  STRING COMMENT '关联标志'
        ,Sys_Modal                  STRING COMMENT '系统形态'
        ,Sys_Imp                    STRING COMMENT '系统重要性'
        ,Sys_Hrch                   STRING COMMENT '系统层级'
        ,Imp_Lbl                    STRING COMMENT '重要性标签'
        ,Dev_Mode                   STRING COMMENT '开发模式'
        ,Dev_Corp                   STRING COMMENT '开发厂商'
        ,Estb_Date                  STRING COMMENT '建设日期'
        ,Test_Run_Date              STRING COMMENT '试运行日期'
        ,Lnch_Date                  STRING COMMENT '上线日期'
        ,Off_Line_Date              STRING COMMENT '下线日期'
        ,Sepr_Test_Env_Flag         STRING COMMENT '独立测试环境标志'
        ,Func_Clas                  STRING COMMENT '功能分类'
        ,Web_Entr                   STRING COMMENT 'web入口'
        ,Deal_Cal_Matn_Info         STRING COMMENT '交易日历维护信息'
        ,Remark                     STRING COMMENT '备注'
        ,Coll_Stat_Cd               STRING COMMENT '采集状态代码'
        ,Ext_Sys_Flag               STRING COMMENT '外部系统标志'
        ,Audi_Stat_Cd               STRING COMMENT '稽核状态代码'
        ,Coll_Theme                 STRING COMMENT '采集主题'
        ,Full_Coll_Data_Qty         STRING COMMENT '全量采集数据量'
        ,Busi_Oa_Inr_Org_Id         STRING COMMENT '业务OA内部机构编号'
        ,Busi_Prin_User_Id_Str      STRING COMMENT '业务负责人用户编号串'
        ,Rd_Prin_User_Id_Str        STRING COMMENT '研发负责人用户编号串'
        ,Op_Prin_User_Id_Str        STRING COMMENT '运维负责人用户编号串'
        ,Cmdb_Sync_Flag             STRING COMMENT 'CMDB同步标志'
        ,Sync_Stat                  STRING COMMENT '同步状态'
        ,Cmdb_Estb_Time             STRING COMMENT 'CMDB创建时间'
        ,Cmdb_Upd_Time              STRING COMMENT 'CMDB更新时间'
        ,Create_User_Id             STRING COMMENT '创建用户编号'
        ,Estb_Time                  STRING COMMENT '创建时间'
        ,Upd_User_Id                STRING COMMENT '更新用户编号'
        ,Upd_Time                   STRING COMMENT '更新时间'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Etl_Date              STRING COMMENT '数据加载日期'
        ,Data_Upt_Date              STRING COMMENT '数据更新日期'
        ,Data_Time                  STRING COMMENT '数据时间'
        ,Real_Src_Tbl               STRING COMMENT '真实源表'
    )COMMENT '系统信息'
    PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
    STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_SYS_INFO PARTITION(SRC_TBL='${src_table}')
    -----------------------------------------------------------------------------------------------------
    --Group2: Source Table:[ODATA_N_BDP.P_T_META_BUSINESS_SYSTEM:业务系统管理] 
    -----------------------------------------------------------------------------------------------------
    SELECT
         ID                                    AS  Sys_Id                  --系统编号                 
        ,QUALIFIED_NAME                        AS  Busi_Uniq_Name          --业务唯一命名               
        ,SYSTEM_NUMBER                         AS  Src_Sys_No              --源系统编号                
        ,SYSTEM_CODE                           AS  Sys_Cd                  --系统代码                 
        ,SYSTEM_TYPE                           AS  Sys_Type                --系统类型                 
        ,SYSTEM_ENGLISH_NAME                   AS  Sys_En_Fn               --系统英文全称               
        ,SYSTEM_CHINESE_NAME                   AS  Sys_Ch_Fn               --系统中文全称               
        ,SYSTEM_ANOTHER_NAME                   AS  Sys_Nknm                --系统别名                 
        ,SYSTEM_OLD_NAME                       AS  Sys_Old_Name            --系统曾用名                
        ,SYSTEM_ABBR_NAME                      AS  Sys_Abbr                --系统简称                 
        ,SYSTEM_DESCRIPTION                    AS  Sys_Desc                --系统描述                 
        ,SYSTEM_STATUS                         AS  Sys_Stat                --系统状态                 
        ,RELEVANCE_STATUS                      AS  Join_Flag               --关联标志                 
        ,SYSTEM_FORM                           AS  Sys_Modal               --系统形态                 
        ,SYSTEM_SIGNIFICANCE                   AS  Sys_Imp                 --系统重要性                
        ,SYSTEM_HIERARCHY                      AS  Sys_Hrch                --系统层级                 
        ,IMPORTANCE_LABEL                      AS  Imp_Lbl                 --重要性标签                
        ,DEVELOP_MODEL                         AS  Dev_Mode                --开发模式                 
        ,DEVELOP_MANUFACTURER                  AS  Dev_Corp                --开发厂商                 
        ,BUILDING_DATE                         AS  Estb_Date               --建设日期                 
        ,COMMISSIONING_DATE                    AS  Test_Run_Date           --试运行日期                
        ,LAUNCH_DATE                           AS  Lnch_Date               --上线日期                 
        ,OFFLINE_DATE                          AS  Off_Line_Date           --下线日期                 
        ,INDEPENDENT_TEST_ENVIRONMENT              AS  Sepr_Test_Env_Flag      --独立测试环境标志             
        ,FUNCTIONAL_CLASSIFICATION              AS  Func_Clas               --功能分类                 
        ,WEB_ENTRANCE                          AS  Web_Entr                --web入口                
        ,TRADING_CALENDAR                      AS  Deal_Cal_Matn_Info      --交易日历维护信息             
        ,REMARK                                AS  Remark                  --备注                   
        ,COLLECT_STATUS                        AS  Coll_Stat_Cd            --采集状态代码               
        ,SYSTEM_CATEGORY                       AS  Ext_Sys_Flag            --外部系统标志               
        ,CHECK_STATUS                          AS  Audi_Stat_Cd            --稽核状态代码               
        ,DATA_COLLECT_TOPIC                    AS  Coll_Theme              --采集主题                 
        ,FULL_COLLECT_AMOUNT                   AS  Full_Coll_Data_Qty      --全量采集数据量              
        ,BUSINESS_DEPT_ID                      AS  Busi_Oa_Inr_Org_Id      --业务OA内部机构编号           
        ,BUSINESS_PRINCIPAL_ID                 AS  Busi_Prin_User_Id_Str   --业务负责人用户编号串           
        ,DEV_ID                                AS  Rd_Prin_User_Id_Str     --研发负责人用户编号串           
        ,OP_ADMIN_GF_UID                       AS  Op_Prin_User_Id_Str     --运维负责人用户编号串           
        ,SYNC_TYPE                             AS  Cmdb_Sync_Flag          --CMDB同步标志
        ,SYNC_STATUS                           AS  Sync_Stat               --同步状态    
        ,CTIME_DB                              AS  Cmdb_Estb_Time          --CMDB创建时间
        ,MTIME_DB                              AS  Cmdb_Upd_Time           --CMDB更新时间
        ,IF(NVL(TRIM(CREATOR_ID),'')='','',CONCAT('BDP001-',CREATOR_ID ))
                                               AS  Create_User_Id          --创建用户编号
        ,CREATE_TIME                           AS  Estb_Time               --创建时间    
        ,IF(NVL(TRIM(UPDATE_ID),'')='','',CONCAT('BDP001-',UPDATE_ID ))
                                               AS  Upd_User_Id             --更新用户编号
        ,UPDATE_TIME                           AS  Upd_Time                --更新时间    
        ,'${data_src_cd}'                 AS  Data_Src_Cd             --数据来源代码
        ,'${filename}'                    AS  Task_Name               --任务名
        ,'${data_day_str}'                AS  Data_Etl_Date           --数据加载日期
        ,'${data_day_str}'                AS  Data_Upt_Date           --数据更新日期
        ,'${data_today}'                  AS  Data_Time               --数据时间
        ,'${src_table}'                   AS  Real_Src_Tbl            --真实源表
    FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A
    ;
