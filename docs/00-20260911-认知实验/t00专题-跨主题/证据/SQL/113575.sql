-- task_id: 113575
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_TASK_RELA_H_BDP035.py
-- observed_at: 2026-09-05T01:06:47.369Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_TASK_RELA_H(
     Task_Id                    STRING COMMENT '任务编号'
    ,Task_Rela_Type_Cd          STRING COMMENT '任务关系类型代码'
    ,Strt_Date                  STRING COMMENT '开始日期'
    ,Rela_Task_Id               STRING COMMENT '关联任务编号'
    ,End_Date                   STRING COMMENT '结束日期'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Time                  STRING COMMENT '数据时间'
)COMMENT '任务关系历史'
PARTITIONED BY (SRC_TBL   STRING COMMENT '源表')
STORED AS ORC;

DROP TABLE IF EXISTS ${db_temp}.T00_TASK_RELA_H_TEMP_BDP035;
CREATE TABLE IF NOT EXISTS ${db_temp}.T00_TASK_RELA_H_TEMP_BDP035
AS
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_BDP.L_LB_TASK_LINK：调度系统任务依赖表]
-----------------------------------------------------------------------------------------------------
SELECT
     T1.TASK_TO                               AS  Task_Id1                --任务编号        
    ,'01'                                    AS  Task_Rela_Type_Cd1      --任务关系类型代码
    ,T1.TASK_FROM                             AS  Rela_Task_Id1           --关联任务编号    
    ,'${data_src_cd}'                   AS  Data_Src_Cd1            --数据来源代码
    ,'${src_table}'                     AS  Src_Tbl1                --源表
    ,'${filename}'                      AS  Task_Name1              --任务名
FROM ODATA_N_BDP.L_LB_TASK_LINK T1
INNER JOIN ODATA_N_BDP.L_LB_TASK T2 ON T1.TASK_TO=T2.TASK_ID 
INNER JOIN ODATA_N_BDP.L_LB_TASK T3 ON T1.TASK_FROM=T3.TASK_ID 
WHERE  T1.STATUS<>'N'AND T2.STATUS<>'N'AND T3.STATUS<>'N'  --只取当前生效的关系数据
;

DROP TABLE IF EXISTS ${db_temp}.T00_TASK_RELA_H_MID_BDP035;
CREATE TABLE ${db_temp}.T00_TASK_RELA_H_MID_BDP035
AS
SELECT
       A.*,B.*
       ,CASE WHEN A.Task_Id IS NULL     AND B.Task_Id1 IS NOT NULL THEN 'I'           --当天不存在历史的数据为新增
             WHEN A.Task_Id IS NOT NULL AND B.Task_Id1 IS NULL THEN 'D'           --历史不存在当天的数据为删除
             WHEN A.Task_Id IS NOT NULL AND B.Task_Id1 IS NOT NULL AND
             (   COALESCE(A.Rela_Task_Id            ,'')   <> COALESCE(B.Rela_Task_Id1           ,'')
             ) THEN 'U'                                                        --当天和历史均存在,除主键外如有字段变更为变更
             ELSE 'S' END AS DATA_TYPE                                         --其他为无变更
FROM   (  SELECT
            *
          FROM  T00_TASK_RELA_H
          WHERE STRT_DATE <='${data_day_str}'
            AND END_DATE  > '${data_day_str}'
            AND SRC_TBL IN ('ODATA_N_BDP.L_LB_TASK_LINK')  )A   --历史(昨日)开链数据
FULL OUTER JOIN ${db_temp}.T00_TASK_RELA_H_TEMP_BDP035 B               --当天的数据
ON   A.Task_Id= B.Task_Id1
AND  A.Task_Rela_Type_Cd= B.Task_Rela_Type_Cd1
AND  NVL(A.Rela_Task_Id,'')=NVL(B.Rela_Task_Id1,'')
;

-- querySql
INSERT OVERWRITE TABLE T00_TASK_RELA_H PARTITION(SRC_TBL)
 --剔除掉源表当日新增和当日闭链的数据
SELECT
     Task_Id                               --任务编号
    ,Task_Rela_Type_Cd                     --任务关系类型代码
    ,Strt_Date                             --开始日期
    ,Rela_Task_Id                          --关联任务编号
    ,End_Date                              --结束日期
    ,Data_Src_Cd                           --数据来源代码
    ,Task_Name                             --任务名
    ,Data_Time                             --数据时间
    ,Src_Tbl                               --源表
FROM T00_TASK_RELA_H
WHERE STRT_DATE !='${data_day_str}'
  AND END_DATE  !='${data_day_str}'
  AND SRC_TBL IN ('ODATA_N_BDP.L_LB_TASK_LINK')
UNION ALL
 --目标表为源表当日闭链的数据还原
SELECT
     Task_Id                               --任务编号
    ,Task_Rela_Type_Cd                     --任务关系类型代码
    ,Strt_Date                             --开始日期
    ,Rela_Task_Id                          --关联任务编号
    ,'2099-12-31'  AS End_Date             --结束日期
    ,Data_Src_Cd                           --数据来源代码
    ,Task_Name                             --任务名
    ,Data_Time                             --数据时间
    ,Src_Tbl                               --源表
FROM T00_TASK_RELA_H
WHERE  END_DATE ='${data_day_str}'
  AND  SRC_TBL IN ('ODATA_N_BDP.L_LB_TASK_LINK')
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

INSERT OVERWRITE TABLE T00_TASK_RELA_H PARTITION(SRC_TBL)
  --历史闭链的无效数据插回目标表
SELECT
     Task_Id                                                    --任务编号
    ,Task_Rela_Type_Cd                                          --任务关系类型代码
    ,Strt_Date                                                  --开始日期
    ,Rela_Task_Id                                               --关联任务编号
    ,End_Date                                                   --结束日期
    ,Data_Src_Cd                                                --数据来源代码
    ,Task_Name                                                  --任务名
    ,Data_Time                                                  --数据时间
    ,Src_Tbl                                                    --源表
FROM T00_TASK_RELA_H
WHERE NOT(    STRT_DATE <='${data_day_str}'
          AND END_DATE  > '${data_day_str}'   )
  AND SRC_TBL IN ('ODATA_N_BDP.L_LB_TASK_LINK')  --只插入目标表分区字段为该表的数据
UNION ALL
 --当天有变动和新增的数据开链
SELECT   
     Task_Id1                       AS  Task_Id                 --任务编号
    ,Task_Rela_Type_Cd1             AS  Task_Rela_Type_Cd       --任务关系类型代码
    ,'${data_day_str}'         AS  Strt_Date               --开始日期
    ,Rela_Task_Id1                  AS  Rela_Task_Id            --关联任务编号
    ,'2099-12-31'                   AS  End_Date                --结束日期
    ,Data_Src_Cd1                   AS  Data_Src_Cd             --数据来源代码
    ,Task_Name1                     AS  Task_Name               --任务名
    ,'${data_today}'           AS  Data_Time               --数据时间
    ,Src_Tbl1                       AS  Src_Tbl                 --源表
FROM ${db_temp}.T00_TASK_RELA_H_MID_BDP035 WHERE DATA_TYPE IN ('I','U')     --新增-I,变更-U
UNION ALL
 --历史开链有变动和不存在当天的数据闭链
SELECT
     Task_Id                                                    --任务编号
    ,Task_Rela_Type_Cd                                          --任务关系类型代码
    ,Strt_Date                                                  --开始日期
    ,Rela_Task_Id                                               --关联任务编号
    ,'${data_day_str}'         AS  End_Date                --结束日期
    ,Data_Src_Cd                    AS  Data_Src_Cd             --数据来源代码
    ,Task_Name                      AS  Task_Name               --任务名
   ,'${data_today}'            AS  Data_Time               --数据时间
    ,Src_Tbl                        AS  Src_Tbl                 --源表
FROM ${db_temp}.T00_TASK_RELA_H_MID_BDP035 WHERE DATA_TYPE IN ('D','U')     --变更-U,删除-D
UNION ALL
 --无变动的数据插回目标表
SELECT
     Task_Id                                                    --任务编号
    ,Task_Rela_Type_Cd                                          --任务关系类型代码
    ,Strt_Date                                                  --开始日期
    ,Rela_Task_Id                                               --关联任务编号
    ,End_Date                                                   --结束日期
    ,Data_Src_Cd                                                --数据来源代码
    ,Task_Name                                                  --任务名
    ,Data_Time                                                  --数据时间
    ,Src_Tbl                                                    --源表
FROM ${db_temp}.T00_TASK_RELA_H_MID_BDP035 WHERE DATA_TYPE ='S'         --无变更-S
;
