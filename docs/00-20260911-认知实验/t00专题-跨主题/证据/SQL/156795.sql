-- task_id: 156795
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_PAPR_INFO_CC2024.py
-- observed_at: 2026-09-05T01:07:03.371Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_PAPR_INFO(
     Papr_Id                    STRING COMMENT '试卷编号'
    ,Papr_Name                  STRING COMMENT '试卷名称'
    ,Papr_Stat_Cd               STRING COMMENT '试卷状态代码'
    ,Papr_Clas_Cd               STRING COMMENT '试卷分类代码'
    ,Papr_Desc                  STRING COMMENT '试卷说明'
    ,Remark                     STRING COMMENT '备注'
    ,Creator                    STRING COMMENT '创建人'
    ,Create_Time                STRING COMMENT '创建时间'
    ,Del_Flag                   STRING COMMENT '删除标志'
    ,Del_Date                   STRING COMMENT '删除日期'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
)COMMENT '试卷信息'
PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
STORED AS ORC;

DROP TABLE IF EXISTS ${DB_TEMP}.T00_PAPR_INFO_TEMP_CC2024;
CREATE TABLE IF NOT EXISTS ${DB_TEMP}.T00_PAPR_INFO_TEMP_CC2024
AS
-----------------------------------------------------------------------------------------------------
--GROUP2: SOURCE TABLE:[ODATA_N_CC2.C_CCB_PAPER: 问卷表]
-----------------------------------------------------------------------------------------------------
SELECT
     CONCAT('CC2030-',PAPER_ID,'-',PAPER_VERSION) AS  Papr_Id             --试卷编号
    ,PAPER_NAME                               AS  Papr_Name               --试卷名称
    ,PAPER_STATUS                             AS  Papr_Stat_Cd            --试卷状态代码
    ,'CC2_CLBK_PAPR'                          AS  Papr_Clas_Cd            --试卷分类代码
    ,''                                       AS  Papr_Desc               --试卷说明
    ,''                                       AS  Remark                  --备注
    ,CREATOR                                  AS  Creator                 --创建人
    ,CREATE_DATE_TIME                         AS  Create_Time             --创建时间
    ,DELETE_FLAG                              AS  Del_Flag                --删除标志
    ,''                                       AS  Del_Date                --删除日期
    ,'${data_src_cd}'                    AS  Data_Src_Cd             --数据来源代码
    ,'${src_table}'                      AS  Src_Tbl                 --源表
    ,'${filename}'                       AS  Task_Name               --任务名
    ,'${data_day_str}'                   AS  Data_Etl_Date           --数据加载日期
    ,'${data_day_str}'                   AS  Data_Upt_Date           --数据更新日期
FROM  (SELECT * FROM ${src_table}  WHERE BUSI_DATE='${data_day_str}' )A

;

DROP TABLE IF EXISTS ${DB_TEMP}.T00_PAPR_INFO_MID_CC2024;
CREATE TABLE IF NOT EXISTS ${DB_TEMP}.T00_PAPR_INFO_MID_CC2024
AS
SELECT
         A.*
        ,B.Papr_Id                    AS Papr_Id1                  --试卷编号
        ,B.Papr_Name                  AS Papr_Name1                --试卷名称
        ,B.Papr_Stat_Cd               AS Papr_Stat_Cd1             --试卷状态代码
        ,B.Papr_Clas_Cd               AS Papr_Clas_Cd1             --试卷分类代码
        ,B.Papr_Desc                  AS Papr_Desc1                --试卷说明
        ,B.Remark                     AS Remark1                   --备注
        ,B.Creator                    AS Creator1                  --创建人
        ,B.Create_Time                AS Create_Time1              --创建时间
        ,B.Del_Flag                   AS Del_Flag1                 --删除标志
        ,B.Del_Date                   AS Del_Date1                 --删除日期
        ,B.DATA_SRC_CD                AS DATA_SRC_CD1              --数据来源代码
        ,B.SRC_TBL                    AS SRC_TBL1                  --源表
        ,B.TASK_NAME                  AS TASK_NAME1                --任务名
        ,B.DATA_ETL_DATE              AS DATA_ETL_DATE1            --数据加载日期
        ,B.DATA_UPT_DATE              AS DATA_UPT_DATE1            --数据更新日期
        ,CASE WHEN A.Papr_Id IS NULL     AND B.Papr_Id IS NOT NULL THEN 'I' --新增
              WHEN A.Papr_Id IS NOT NULL AND B.Papr_Id IS NULL THEN 'D' --删除
              WHEN A.Papr_Id IS NOT NULL AND B.Papr_Id IS NOT NULL AND (
                     COALESCE(A.Papr_Name               ,'') <> COALESCE(B.Papr_Name               ,'')
                  OR COALESCE(A.Papr_Stat_Cd            ,'') <> COALESCE(B.Papr_Stat_Cd            ,'')
                  OR COALESCE(A.Papr_Clas_Cd            ,'') <> COALESCE(B.Papr_Clas_Cd            ,'')
                  OR COALESCE(A.Papr_Desc               ,'') <> COALESCE(B.Papr_Desc               ,'')
                  OR COALESCE(A.Remark                  ,'') <> COALESCE(B.Remark                  ,'')
                  OR COALESCE(A.Creator                 ,'') <> COALESCE(B.Creator                 ,'')
                  OR COALESCE(A.Create_Time             ,'') <> COALESCE(B.Create_Time             ,'')
                  OR COALESCE(A.Del_Flag                ,'') <> COALESCE(B.Del_Flag                ,'')
                  OR COALESCE(A.Del_Date                ,'') <> COALESCE(B.Del_Date                ,'')
             ) THEN 'U' --变更
             ELSE 'S' --无变更
             END                 AS DATA_TYPE              --数据类型
FROM  (SELECT * FROM T00_PAPR_INFO
                WHERE SRC_TBL='ODATA_N_CC2.C_CCB_PAPER')A
FULL OUTER JOIN ${DB_TEMP}.T00_PAPR_INFO_TEMP_CC2024 B
ON    A.Papr_Id=B.Papr_Id
;

-- querySql
INSERT OVERWRITE TABLE T00_PAPR_INFO PARTITION(SRC_TBL)
 --剔除当日新增的数据
SELECT
      *
  FROM T00_PAPR_INFO
  WHERE DATA_ETL_DATE !='${data_day_str}'
    AND SRC_TBL = 'ODATA_N_CC2.C_CCB_PAPER'
;

set hive.merge.mapfiles = true ;
set hive.merge.mapredfiles = true;
set hive.merge.size.per.task=1073741824;
set hive.merge.smallfiles.avgsize=1073741824;
set hive.merge.orcfile.stripe.level=false;
set hive.exec.dynamic.partition=true;
set hive.exec.dynamic.partition.mode=nonstrict;
set hive.exec.max.created.files=10000;
set hive.exec.max.dynamic.partitions.pernode=10000;
set hive.exec.max.dynamic.partitions=10000;
set hive.auto.convert.join=false;

INSERT OVERWRITE TABLE T00_PAPR_INFO PARTITION(SRC_TBL)
SELECT
     Papr_Id                                       --试卷编号
    ,Papr_Name                                     --试卷名称
    ,Papr_Stat_Cd                                  --试卷状态代码
    ,Papr_Clas_Cd                                  --试卷分类代码
    ,Papr_Desc                                     --试卷说明
    ,Remark                                        --备注
    ,Creator                                       --创建人
    ,Create_Time                                   --创建时间
    ,Del_Flag                     AS Del_Flag           --删除标志
    ,Del_Date                     AS Del_Date           --删除日期
    ,Data_Src_Cd                                   --数据来源代码
    ,Task_Name                                     --任务名
    ,Data_Etl_Date                                 --数据加载日期
    ,Data_Upt_Date                                 --数据更新日期
    ,Data_Time                                     --数据时间
    ,Src_Tbl                                       --源表
FROM ${DB_TEMP}.T00_PAPR_INFO_MID_CC2024 WHERE DATA_TYPE='S'  --插入无变化的数据
UNION ALL
SELECT
     Papr_Id1                                     AS Papr_Id                  --试卷编号
    ,Papr_Name1                                   AS Papr_Name                --试卷名称
    ,Papr_Stat_Cd1                                AS Papr_Stat_Cd             --试卷状态代码
    ,Papr_Clas_Cd1                                AS Papr_Clas_Cd             --试卷分类代码
    ,Papr_Desc1                                   AS Papr_Desc                --试卷说明
    ,Remark1                                      AS Remark                   --备注
    ,Creator1                                     AS Creator                  --创建人
    ,Create_Time1                                 AS Create_Time              --创建时间
    ,Del_Flag1                                    AS Del_Flag                 --删除标志
    ,Del_Date1                                    AS Del_Date                 --删除日期
    ,Data_Src_Cd1                                 AS Data_Src_Cd              --数据来源代码
    ,Task_Name1                                   AS Task_Name                --任务名
    ,Data_Etl_Date                                AS Data_Etl_Date            --数据加载日期
    ,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
    ,'${data_today}'                         AS Data_Time                --数据时间
    ,Src_Tbl1                                     AS Src_Tbl                  --源表
FROM ${DB_TEMP}.T00_PAPR_INFO_MID_CC2024  WHERE DATA_TYPE='U'   --有变更的数据取变更的值
UNION ALL
SELECT
     Papr_Id1                                     AS Papr_Id                  --试卷编号
    ,Papr_Name1                                   AS Papr_Name                --试卷名称
    ,Papr_Stat_Cd1                                AS Papr_Stat_Cd             --试卷状态代码
    ,Papr_Clas_Cd1                                AS Papr_Clas_Cd             --试卷分类代码
    ,Papr_Desc1                                   AS Papr_Desc                --试卷说明
    ,Remark1                                      AS Remark                   --备注
    ,Creator1                                     AS Creator                  --创建人
    ,Create_Time1                                 AS Create_Time              --创建时间
    ,Del_Flag1                                    AS Del_Flag                 --删除标志
    ,Del_Date1                                    AS Del_Date                 --删除日期
    ,Data_Src_Cd1                                 As Data_Src_Cd              --数据来源代码
    ,Task_Name1                                   As Task_Name                --任务名
    ,Data_Etl_Date1                               As Data_Etl_Date            --数据加载日期
    ,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
    ,'${data_today}'                         AS Data_Time                --数据时间
    ,Src_Tbl1                                     AS Src_Tbl                  --源表
FROM ${DB_TEMP}.T00_PAPR_INFO_MID_CC2024  WHERE DATA_TYPE='I'   --插入新增的数据
UNION ALL
SELECT
     Papr_Id                                                 --试卷编号
    ,Papr_Name                                               --试卷名称
    ,Papr_Stat_Cd                                            --试卷状态代码
    ,Papr_Clas_Cd                                            --试卷分类代码
    ,Papr_Desc                                               --试卷说明
    ,Remark                                                  --备注
    ,Creator                                                 --创建人
    ,Create_Time                                             --创建时间
    ,'1'                              AS Del_Flag            --删除标志
    ,CASE WHEN Del_Date !=''
            THEN Del_Date
          ELSE '${data_day_str}'
          END                         AS Del_Date            --删除日期
     ,Data_Src_Cd                                            --数据来源代码
     ,Task_Name                                              --任务名
     ,Data_Etl_Date                                          --数据加载日期
     ,CASE WHEN Del_Date !=''
           THEN Data_Upt_Date
           ELSE '${data_day_str}'
          END                         AS Data_Upt_Date       --数据更新日期
    ,CASE WHEN Del_Date !=''
            THEN Data_Time
          ELSE '${data_today}'
          END                         AS Data_Time           --数据时间
    ,Src_Tbl                                                 --源表
FROM ${DB_TEMP}.T00_PAPR_INFO_MID_CC2024 WHERE DATA_TYPE='D'  --插入删除的数据
;
