-- task_id: 113440
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_TBL_INFO_BDP030.py
-- observed_at: 2026-09-05T01:06:47.313Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_TBL_INFO(
     Tbl_Id                     STRING COMMENT '表ID'
    ,Estb_Time                  STRING COMMENT '创建时间'
    ,Db_Id                      STRING COMMENT '数据库ID '
    ,Ltm_Acs_Time               STRING COMMENT '上次访问时间'
    ,Owner                      STRING COMMENT '所有者'
    ,Rsrv_Fld                   STRING COMMENT '保留字段'
    ,Sav_Info_Id                STRING COMMENT '存储信息ID'
    ,Tbl_Name                   STRING COMMENT '表名'
    ,Tbl_Type                   STRING COMMENT '表类型'
    ,View_Det_HQL               STRING COMMENT '视图的详细HQL语句'
    ,View_Init_HQL              STRING COMMENT '视图的原始HQL语句'
    ,Link_Tgt_Id                STRING COMMENT '链接目标ID'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
    ,Upd_time                   STRING COMMENT '更新时间'
    ,Tbl_Cmnt                   STRING COMMENT '表注释'
    ,Estb_User_Id               STRING COMMENT '创建用户编号'
    ,Upd_User_Id                STRING COMMENT '更新用户编号'
)COMMENT '表信息'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_TBL_INFO PARTITION(SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group2: Source Table:[ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_TABLE:HIVE表信息] 
-----------------------------------------------------------------------------------------------------
SELECT
     GUID                                  AS  Tbl_Id                  --表ID
    ,CREATE_TIME                           AS  Estb_Time               --创建时间
    ,DB                                    AS  Db_Id                   --数据库ID
    ,LASTACCESSTIME                        AS  Ltm_Acs_Time            --上次访问时间
    ,OWNER                                 AS  Owner                   --所有者
    ,''                                    AS  Rsrv_Fld                --保留字段
    ,''                                    AS  Sav_Info_Id             --存储信息ID
    ,NAME                                  AS  Tbl_Name                --表名
    ,TABLETYPE                             AS  Tbl_Type                --表类型
    ,VIEWEXPANDEDTEXT                      AS  View_Det_HQL            --视图的详细HQL语句
    ,VIEWORIGINALTEXT                      AS  View_Init_HQL           --视图的原始HQL语句
    ,''                                    AS  Link_Tgt_Id             --链接目标ID
    ,'${data_src_cd}'                 AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                    AS  Task_Name               --任务名
    ,'${data_day_str}'                AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'              AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                  AS  Data_Time               --数据时间
    ,UPDATE_TIME                           AS  Upd_time                   --更新时间
    ,IF(NVL(TRIM(USERCOMMENT),'')='',COMMENT,USERCOMMENT)
                                           AS  Tbl_Cmnt                   --表注释
    ,CREATE_USER                           AS  Estb_User_Id               --创建用户编号
    ,UPDATE_USER                           AS  Upd_User_Id                --更新用户编号
FROM ${src_table}
WHERE STATUS='ACTIVE'
;
