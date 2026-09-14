-- task_id: 113442
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_FLD_INFO_BDP032.py
-- observed_at: 2026-09-05T01:06:47.325Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_FLD_INFO(
     Fld_Id                     STRING COMMENT '字段ID'
    ,Tbl_Fld_Id                 STRING COMMENT '表字段ID'
    ,Fld_Cmnt                   STRING COMMENT '字段注释'
    ,Fld_Name                   STRING COMMENT '字段名'
    ,Fld_Type                   STRING COMMENT '字段类型'
    ,Fld_Seq                    STRING COMMENT '字段顺序 '
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
    ,Estb_Time                  STRING COMMENT '创建时间'
    ,Upd_time                   STRING COMMENT '更新时间'
    ,Estb_User_Id               STRING COMMENT '创建用户编号'
    ,Upd_User_Id                STRING COMMENT '更新用户编号'
    ,Cls_Name                   STRING COMMENT '分类分级名称'
    ,Real_Src_Tbl               STRING COMMENT '真实源表'
    ,Fld_Busi_Remark            STRING COMMENT '字段业务备注'
    ,Cd_Set_Id                  STRING COMMENT '代码集编号'
    ,Data_Std_Id                STRING COMMENT '数据标准编号'
    ,Data_Ast_Stat              STRING COMMENT '数据资产状态'
    ,Auth_Flag                  STRING COMMENT '认证标志'
    ,Busi_Prin_User_Id          STRING COMMENT '业务负责人用户编号'
    ,Fld_Meta_Clas_Cd           STRING COMMENT '字段元数据分类代码'
    ,Safe_Lvl_Cd                STRING COMMENT '安全等级代码'
    ,Fld_Meta_Lbl_Id            STRING COMMENT '字段元数据标签编号'
)COMMENT '表字段信息'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_FLD_INFO PARTITION(SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group2: Source Table:[ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_COLUMN:HIVE表字段注释] 
-----------------------------------------------------------------------------------------------------
SELECT
     GUID                                  AS  Fld_Id                  --字段ID
    ,\`TABLE\`                             AS  Tbl_Fld_Id              --表字段ID
    ,IF(NVL(TRIM(USERCOMMENT),'')='',COMMENT,USERCOMMENT)
                                           AS  Fld_Cmnt                --字段注释
    ,NAME                                  AS  Fld_Name                --字段名
    ,TYPE                                  AS  Fld_Type                --字段类型
    ,POSITION                              AS  Fld_Seq                 --字段顺序
    ,'${data_src_cd}'                 AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                    AS  Task_Name               --任务名
    ,'${data_day_str}'                AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'              AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                  AS  Data_Time               --数据时间
    ,CREATE_TIME                           AS  Estb_Time                --创建时间
    ,UPDATE_TIME                           AS  Upd_time                 --更新时间
    ,CREATE_USER                           AS  Estb_User_Id             --创建用户编号
    ,UPDATE_USER                           AS  Upd_User_Id              --更新用户编号
    ,CLASSIFICATIONS                       AS  Cls_Name                 --分类分级名称
    ,'${src_table}'                   AS  Real_Src_Tbl            --真实源表
    ,''                                    AS  Fld_Busi_Remark         --字段业务备注
    ,CODEID                                AS  Cd_Set_Id               --代码集编号
    ,DATASTANDARDID                        AS  Data_Std_Id             --数据标准编号
    ,BUSINESS_STATUS                       AS  Data_Ast_Stat           --数据资产状态
    ,BUSINESS_ISCERTIFIED                  AS  Auth_Flag               --认证标志
    ,BUSINESS_MANAGER                      AS  Busi_Prin_User_Id       --业务负责人用户编号
    ,CLASSIFICATION                        AS  Fld_Meta_Clas_Cd        --字段元数据分类代码
    ,GRADE                                 AS  Safe_Lvl_Cd             --安全等级代码
    ,TAG                                   AS  Fld_Meta_Lbl_Id         --字段元数据标签编号
FROM ${src_table} A
WHERE  STATUS='ACTIVE'
      
;
