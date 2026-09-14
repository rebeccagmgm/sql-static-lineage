-- task_id: 62906
-- hiveDb: PDATA_N
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_PROJ_BASE_INFO_PMS003.py
-- observed_at: 2026-09-05T01:06:20.441Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_PROJ_BASE_INFO(
     Proj_Id                    STRING COMMENT '项目编号'
    ,Proj_Cate_Cd               STRING COMMENT '项目类别代码'
    ,Proj_Type_Cd               STRING COMMENT '项目类型代码'
    ,Src_Proj_Id                STRING COMMENT '源项目编号'
    ,Proj_Full_Name             STRING COMMENT '项目全称'
    ,Proj_Shor_Name             STRING COMMENT '项目简称'
    ,Proj_Strt_Date             STRING COMMENT '项目开始日期'
    ,Proj_End_Date              STRING COMMENT '项目结束日期'
    ,Proj_Stat_Cd               STRING COMMENT '项目状态代码'
    ,Main_Inr_Org_Id            STRING COMMENT '主管内部机构编号'
    ,Proj_Mngr                  STRING COMMENT '项目负责人'
    ,Del_Flag                   STRING COMMENT '删除标志'
    ,Del_Date                   STRING COMMENT '删除日期'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
)COMMENT '项目基本信息'
PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
STORED AS ORC;

DROP TABLE IF EXISTS ${DB_TEMP}.T00_PROJ_BASE_INFO_TEMP_PMS003;
CREATE TABLE IF NOT EXISTS ${DB_TEMP}.T00_PROJ_BASE_INFO_TEMP_PMS003
AS
-----------------------------------------------------------------------------------------------------
--GROUP5: SOURCE TABLE:[ODATA_N_PMS.G_WT_CGXM: 关联项目(数据来源项目管理系统)]
-----------------------------------------------------------------------------------------------------
SELECT
     CONCAT('IPM-',A.XMID)                    AS  Proj_Id                 --项目编号                
    ,'PURCH-IPM-PRJ'                          AS  Proj_Cate_Cd            --项目类别代码                 
    ,''                                       AS  Proj_Type_Cd            --项目类型代码                 
    ,A.XMID                                   AS  Src_Proj_Id             --源项目编号                    
    ,A.XMQC                                   AS  Proj_Full_Name          --项目全称                     
    ,NVL(TRIM(A.XMMC),'')                     AS  Proj_Shor_Name          --项目简称                    
    ,IF(NVL(TRIM(A.SDATE),'')='','',DEFAULT.DATE2DATEKEY(SUBSTR(A.SDATE,0,10))) AS  PROJ_STRT_DATE       --项目开始日期                
    ,IF(NVL(TRIM(A.EDATE),'')='','',DEFAULT.DATE2DATEKEY(SUBSTR(A.EDATE,0,10))) AS  Proj_End_Date        --项目结束日期                
    ,''                                       AS  Proj_Stat_Cd            --项目状态代码                
    ,''                                       AS  Main_Inr_Org_Id         --主管内部机构编号            
    ,''                                       AS  Proj_Mngr               --项目负责人                  
    ,'${data_src_cd}'                    AS  Data_Src_Cd             --数据来源代码
    ,'${src_table}'                      AS  Src_Tbl                 --源表
    ,'${filename}'                       AS  Task_Name               --任务名
    ,'${data_day_str}'                   AS  Data_Etl_Date           --数据加载日期
    ,'${data_day_str}'                   AS  Data_Upt_Date           --数据更新日期
FROM  (SELECT XMID,XMQC,XMMC,SDATE,EDATE
             ,ROW_NUMBER()OVER(PARTITION BY XMID ORDER BY XGSJ DESC) AS RN 
         FROM ${src_table}  
        WHERE BUSI_DATE='${data_day_str}' )A
LEFT JOIN (SELECT ID FROM ODATA_N_IPM.P_PMS_LX_JBXX b
            WHERE BUSI_DATE='${data_day_str}' )B
  ON A.XMID =B.ID
WHERE A.RN=1
  AND B.ID IS NULL
;

DROP TABLE IF EXISTS ${DB_TEMP}.T00_PROJ_BASE_INFO_MID_PMS003;
CREATE TABLE IF NOT EXISTS ${DB_TEMP}.T00_PROJ_BASE_INFO_MID_PMS003
AS
SELECT
         A.*
        ,B.Proj_Id                    AS Proj_Id1                  --项目编号
        ,B.Proj_Cate_Cd               AS Proj_Cate_Cd1             --项目类别代码
        ,B.Proj_Type_Cd               AS Proj_Type_Cd1             --项目类型代码
        ,B.Src_Proj_Id                AS Src_Proj_Id1              --源项目编号
        ,B.Proj_Full_Name             AS Proj_Full_Name1           --项目全称
        ,B.Proj_Shor_Name             AS Proj_Shor_Name1           --项目简称
        ,B.Proj_Strt_Date             AS Proj_Strt_Date1           --项目开始日期
        ,B.Proj_End_Date              AS Proj_End_Date1            --项目结束日期
        ,B.Proj_Stat_Cd               AS Proj_Stat_Cd1             --项目状态代码
        ,B.Main_Inr_Org_Id            AS Main_Inr_Org_Id1          --主管内部机构编号
        ,B.Proj_Mngr                  AS Proj_Mngr1                --项目负责人
        ,B.DATA_SRC_CD                AS DATA_SRC_CD1              --数据来源代码
        ,B.SRC_TBL                    AS SRC_TBL1                  --源表
        ,B.TASK_NAME                  AS TASK_NAME1                --任务名
        ,B.DATA_ETL_DATE              AS DATA_ETL_DATE1            --数据加载日期
        ,B.DATA_UPT_DATE              AS DATA_UPT_DATE1            --数据更新日期
        ,CASE WHEN A.Proj_Id IS NULL     AND B.Proj_Id IS NOT NULL THEN 'I' --新增
              WHEN A.Proj_Id IS NOT NULL AND B.Proj_Id IS NULL THEN 'D' --删除
              WHEN A.Proj_Id IS NOT NULL AND B.Proj_Id IS NOT NULL AND (
                     COALESCE(A.Proj_Type_Cd            ,'')   <> COALESCE(B.Proj_Type_Cd            ,'')
                  OR COALESCE(A.Src_Proj_Id             ,'')   <> COALESCE(B.Src_Proj_Id             ,'')
                  OR COALESCE(A.Proj_Full_Name          ,'')   <> COALESCE(B.Proj_Full_Name          ,'')
                  OR COALESCE(A.Proj_Shor_Name          ,'')   <> COALESCE(B.Proj_Shor_Name          ,'')
                  OR COALESCE(A.Proj_Strt_Date          ,'')   <> COALESCE(B.Proj_Strt_Date          ,'')
                  OR COALESCE(A.Proj_End_Date           ,'')   <> COALESCE(B.Proj_End_Date           ,'')
                  OR COALESCE(A.Proj_Stat_Cd            ,'')   <> COALESCE(B.Proj_Stat_Cd            ,'')
                  OR COALESCE(A.Main_Inr_Org_Id         ,'')   <> COALESCE(B.Main_Inr_Org_Id         ,'')
                  OR COALESCE(A.Proj_Mngr               ,'')   <> COALESCE(B.Proj_Mngr               ,'')
             ) THEN 'U' --变更
             ELSE 'S' --无变更
             END                 AS DATA_TYPE              --数据类型
FROM  (SELECT * FROM T00_PROJ_BASE_INFO 
                WHERE SRC_TBL='ODATA_N_PMS.G_WT_CGXM')A
FULL OUTER JOIN ${DB_TEMP}.T00_PROJ_BASE_INFO_TEMP_PMS003 B
ON    A.Proj_Id=B.Proj_Id
AND   A.Proj_Cate_Cd=B.Proj_Cate_Cd
;

-- querySql
INSERT OVERWRITE TABLE T00_PROJ_BASE_INFO PARTITION(SRC_TBL)
 --剔除当日新增的数据
SELECT
      *
  FROM T00_PROJ_BASE_INFO
  WHERE DATA_ETL_DATE !='${data_day_str}' 
    AND SRC_TBL = 'ODATA_N_PMS.G_WT_CGXM'
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

INSERT OVERWRITE TABLE T00_PROJ_BASE_INFO PARTITION(SRC_TBL)
SELECT
     Proj_Id                                       --项目编号
    ,Proj_Cate_Cd                                  --项目类别代码
    ,Proj_Type_Cd                                  --项目类型代码
    ,Src_Proj_Id                                   --源项目编号
    ,Proj_Full_Name                                --项目全称
    ,Proj_Shor_Name                                --项目简称
    ,Proj_Strt_Date                                --项目开始日期
    ,Proj_End_Date                                 --项目结束日期
    ,Proj_Stat_Cd                                  --项目状态代码
    ,Main_Inr_Org_Id                               --主管内部机构编号
    ,Proj_Mngr                                     --项目负责人
    ,'0'                     AS Del_Flag           --删除标志
    ,''                      AS Del_Date           --删除日期
    ,Data_Src_Cd                                   --数据来源代码
    ,Task_Name                                     --任务名
    ,Data_Etl_Date                                 --数据加载日期
    ,Data_Upt_Date                                 --数据更新日期
    ,Data_Time                                     --数据时间
    ,Src_Tbl                                       --源表
FROM ${DB_TEMP}.T00_PROJ_BASE_INFO_MID_PMS003 WHERE DATA_TYPE='S'  --插入无变化的数据
UNION ALL
SELECT
     Proj_Id1                                     AS Proj_Id                  --项目编号
    ,Proj_Cate_Cd1                                AS Proj_Cate_Cd             --项目类别代码
    ,Proj_Type_Cd1                                AS Proj_Type_Cd             --项目类型代码
    ,Src_Proj_Id1                                 AS Src_Proj_Id              --源项目编号
    ,Proj_Full_Name1                              AS Proj_Full_Name           --项目全称
    ,Proj_Shor_Name1                              AS Proj_Shor_Name           --项目简称
    ,Proj_Strt_Date1                              AS Proj_Strt_Date           --项目开始日期
    ,Proj_End_Date1                               AS Proj_End_Date            --项目结束日期
    ,Proj_Stat_Cd1                                AS Proj_Stat_Cd             --项目状态代码
    ,Main_Inr_Org_Id1                             AS Main_Inr_Org_Id          --主管内部机构编号
    ,Proj_Mngr1                                   AS Proj_Mngr                --项目负责人
    ,'0'                                          AS Del_Flag                 --删除标志
    ,''                                           AS Del_Date                 --删除日期
    ,Data_Src_Cd1                                 AS Data_Src_Cd              --数据来源代码
    ,Task_Name1                                   AS Task_Name                --任务名
    ,Data_Etl_Date                                AS Data_Etl_Date            --数据加载日期
    ,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
    ,'${data_today}'                         AS Data_Time                --数据时间
    ,Src_Tbl1                                     AS Src_Tbl                  --源表
FROM ${DB_TEMP}.T00_PROJ_BASE_INFO_MID_PMS003  WHERE DATA_TYPE='U'   --有变更的数据取变更的值
UNION ALL
SELECT
     Proj_Id1                                     AS Proj_Id                  --项目编号
    ,Proj_Cate_Cd1                                AS Proj_Cate_Cd             --项目类别代码
    ,Proj_Type_Cd1                                AS Proj_Type_Cd             --项目类型代码
    ,Src_Proj_Id1                                 AS Src_Proj_Id              --源项目编号
    ,Proj_Full_Name1                              AS Proj_Full_Name           --项目全称
    ,Proj_Shor_Name1                              AS Proj_Shor_Name           --项目简称
    ,Proj_Strt_Date1                              AS Proj_Strt_Date           --项目开始日期
    ,Proj_End_Date1                               AS Proj_End_Date            --项目结束日期
    ,Proj_Stat_Cd1                                AS Proj_Stat_Cd             --项目状态代码
    ,Main_Inr_Org_Id1                             AS Main_Inr_Org_Id          --主管内部机构编号
    ,Proj_Mngr1                                   AS Proj_Mngr                --项目负责人
    ,'0'                                          AS Del_Flag                 --删除标志
    ,''                                           AS Del_Date                 --删除日期
    ,Data_Src_Cd1                                 As Data_Src_Cd              --数据来源代码
    ,Task_Name1                                   As Task_Name                --任务名
    ,Data_Etl_Date1                               As Data_Etl_Date            --数据加载日期
    ,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
    ,'${data_today}'                         AS Data_Time                --数据时间
    ,Src_Tbl1                                     AS Src_Tbl                  --源表
FROM ${DB_TEMP}.T00_PROJ_BASE_INFO_MID_PMS003  WHERE DATA_TYPE='I'   --插入新增的数据
UNION ALL
SELECT
     Proj_Id                                                 --项目编号
    ,Proj_Cate_Cd                                            --项目类别代码
    ,Proj_Type_Cd                                            --项目类型代码
    ,Src_Proj_Id                                             --源项目编号
    ,Proj_Full_Name                                          --项目全称
    ,Proj_Shor_Name                                          --项目简称
    ,Proj_Strt_Date                                          --项目开始日期
    ,Proj_End_Date                                           --项目结束日期
    ,Proj_Stat_Cd                                            --项目状态代码
    ,Main_Inr_Org_Id                                         --主管内部机构编号
    ,Proj_Mngr                                               --项目负责人
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
FROM ${DB_TEMP}.T00_PROJ_BASE_INFO_MID_PMS003 WHERE DATA_TYPE='D'  --插入删除的数据
;
