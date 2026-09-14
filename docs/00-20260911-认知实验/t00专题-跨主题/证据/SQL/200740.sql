-- task_id: 200740
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_TBL_RELA_H_BDP030.py
-- observed_at: 2026-09-05T01:07:18.631Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_TBL_RELA_H(
         Tbl_Id                     STRING COMMENT '表编号'
        ,Tbl_Rela_Type_Cd           STRING COMMENT '表关系类型代码'
        ,Strt_Date                  STRING COMMENT '开始日期'
        ,Rela_Tbl_Id                STRING COMMENT '关联表编号'
        ,End_Date                   STRING COMMENT '结束日期'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Time                  STRING COMMENT '数据时间'
        ,Real_Src_Tbl               STRING COMMENT '真实源表'
    )COMMENT '表关系历史'
    PARTITIONED BY (SRC_TBL   STRING COMMENT '源表')
    STORED AS ORC;

DROP TABLE IF EXISTS ${db_temp}.T00_TBL_RELA_H_TEMP_BDP030;
    CREATE TABLE IF NOT EXISTS ${db_temp}.T00_TBL_RELA_H_TEMP_BDP030
    AS
    -----------------------------------------------------------------------------------------------------
    --Group3.: Source Table:[ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_TABLE：数据地图表信息]
    -----------------------------------------------------------------------------------------------------
    SELECT DISTINCT
           GUID                                    AS  Tbl_Id1                 --表编号                     只入status='ACTIVE'
          ,'01'                                    AS  Tbl_Rela_Type_Cd1       --表关系类型代码                  '01'---下游
          ,DOWNSTREAMS_1                           AS  Rela_Tbl_Id1            --关联表编号
          ,'${data_src_cd}'                   AS  Data_Src_Cd1            --数据来源代码
          ,'${src_table}'                     AS  Src_Tbl1                --源表
          ,'${filename}'                      AS  Task_Name1              --任务名
          ,'${src_table}'                     AS  Real_Src_Tbl1           --真实源表
    FROM ${src_table} A
    LATERAL VIEW EXPLODE(SPLIT(DOWNSTREAMS,',')) T AS DOWNSTREAMS_1
    WHERE STATUS='ACTIVE'
    UNION ALL
    -----------------------------------------------------------------------------------------------------
    --Group4.: Source Table:[ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_TABLE：数据地图表信息]
    -----------------------------------------------------------------------------------------------------
    SELECT DISTINCT
           GUID                                    AS  Tbl_Id1                 --表编号                     只入status='ACTIVE'
          ,'02'                                    AS  Tbl_Rela_Type_Cd1       --表关系类型代码                  '02'---上游
          ,UPSTREAMS_1                             AS  Rela_Tbl_Id1            --关联表编号
          ,'${data_src_cd}'                   AS  Data_Src_Cd1            --数据来源代码
          ,'${src_table}'                     AS  Src_Tbl1                --源表
          ,'${filename}'                      AS  Task_Name1              --任务名
          ,'${src_table}'                     AS  Real_Src_Tbl1           --真实源表
    FROM ${src_table} A
    LATERAL VIEW EXPLODE(SPLIT(UPSTREAMS,',')) T AS UPSTREAMS_1
    WHERE STATUS='ACTIVE'
    ;

DROP TABLE IF EXISTS ${db_temp}.T00_TBL_RELA_H_MID_BDP030;
    CREATE TABLE ${db_temp}.T00_TBL_RELA_H_MID_BDP030
    AS
    SELECT
           A.*,B.*
           ,CASE WHEN A.Tbl_Id IS NULL     AND B.Tbl_Id1 IS NOT NULL THEN 'I'           --当天不存在历史的数据为新增
                 WHEN A.Tbl_Id IS NOT NULL AND B.Tbl_Id1 IS NULL THEN 'D'           --历史不存在当天的数据为删除
                 WHEN A.Tbl_Id IS NOT NULL AND B.Tbl_Id1 IS NOT NULL AND
                 (   COALESCE(A.Rela_Tbl_Id             ,'')   <> COALESCE(B.Rela_Tbl_Id1            ,'')
             ) THEN 'U'                                                        --当天和历史均存在,除主键外如有字段变更为变更
                 ELSE 'S' END AS DATA_TYPE                                         --其他为无变更
    FROM   (  SELECT
                *
              FROM  T00_TBL_RELA_H
              WHERE STRT_DATE <='${data_day_str}'
                AND END_DATE  > '${data_day_str}'
                AND SRC_TBL IN ('ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_TABLE')  )A   --历史(昨日)开链数据
    FULL OUTER JOIN ${db_temp}.T00_TBL_RELA_H_TEMP_BDP030 B               --当天的数据
    ON   NVL(A.Tbl_Id          ,'')= NVL(B.Tbl_Id1          ,'')
    AND  NVL(A.Tbl_Rela_Type_Cd,'')= NVL(B.Tbl_Rela_Type_Cd1,'')
    AND  NVL(A.Rela_Tbl_Id     ,'')= NVL(B.Rela_Tbl_Id1     ,'')
    ;

-- querySql
INSERT OVERWRITE TABLE T00_TBL_RELA_H PARTITION(SRC_TBL)
     --剔除掉源表当日新增和当日闭链的数据
    SELECT 
         DISTINCT
         Tbl_Id                                --表编号
        ,Tbl_Rela_Type_Cd                      --表关系类型代码
        ,Strt_Date                             --开始日期
        ,Rela_Tbl_Id                           --关联表编号
        ,End_Date                              --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM (
    SELECT
         Tbl_Id                                --表编号
        ,Tbl_Rela_Type_Cd                      --表关系类型代码
        ,Strt_Date                             --开始日期
        ,Rela_Tbl_Id                           --关联表编号
        ,End_Date                              --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM T00_TBL_RELA_H
    WHERE STRT_DATE !='${data_day_str}'
      AND END_DATE  !='${data_day_str}'
      AND SRC_TBL IN ('ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_TABLE')
    UNION ALL
     --目标表为源表当日闭链的数据还原
    SELECT
         Tbl_Id                                --表编号
        ,Tbl_Rela_Type_Cd                      --表关系类型代码
        ,Strt_Date                             --开始日期
        ,Rela_Tbl_Id                           --关联表编号
        ,'2099-12-31'  AS End_Date             --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM T00_TBL_RELA_H
    WHERE  END_DATE ='${data_day_str}'
      AND  SRC_TBL IN ('ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_TABLE')
      ) T
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
    
    INSERT OVERWRITE TABLE T00_TBL_RELA_H PARTITION(SRC_TBL)
      --历史闭链的无效数据插回目标表
    SELECT
         Tbl_Id                                                     --表编号
        ,Tbl_Rela_Type_Cd                                           --表关系类型代码
        ,Strt_Date                                                  --开始日期
        ,Rela_Tbl_Id                                                --关联表编号
        ,End_Date                                                   --结束日期
        ,Data_Src_Cd                                                --数据来源代码
        ,Task_Name                                                  --任务名
        ,Data_Time                                                  --数据时间
        ,Real_Src_Tbl                                               --真实源表
        ,Src_Tbl                                                    --源表
    FROM T00_TBL_RELA_H
    WHERE NOT(    STRT_DATE <='${data_day_str}'
              AND END_DATE  > '${data_day_str}'   )
      AND SRC_TBL IN ('ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_TABLE')  --只插入目标表分区字段为该表的数据
    UNION ALL
     --当天有变动和新增的数据开链
    SELECT   
         Tbl_Id1                        AS  Tbl_Id                  --表编号
        ,Tbl_Rela_Type_Cd1              AS  Tbl_Rela_Type_Cd        --表关系类型代码
        ,'${data_day_str}'         AS  Strt_Date               --开始日期
        ,Rela_Tbl_Id1                   AS  Rela_Tbl_Id             --关联表编号
        ,'2099-12-31'                   AS  End_Date                --结束日期
        ,Data_Src_Cd1                   AS  Data_Src_Cd             --数据来源代码
        ,Task_Name1                     AS  Task_Name               --任务名
        ,'${data_today}'           AS  Data_Time               --数据时间
        ,Real_Src_Tbl1                  AS  Real_Src_Tbl            --真实源表
        ,Src_Tbl1                       AS  Src_Tbl                 --源表
    FROM ${db_temp}.T00_TBL_RELA_H_MID_BDP030 WHERE DATA_TYPE IN ('I','U')     --新增-I,变更-U
    UNION ALL
     --历史开链有变动和不存在当天的数据闭链
    SELECT
         Tbl_Id                                                     --表编号
        ,Tbl_Rela_Type_Cd                                           --表关系类型代码
        ,Strt_Date                                                  --开始日期
        ,Rela_Tbl_Id                                                --关联表编号
        ,'${data_day_str}'         AS  End_Date                --结束日期
        ,Data_Src_Cd                    AS  Data_Src_Cd             --数据来源代码
        ,Task_Name                      AS  Task_Name               --任务名
        ,'${data_today}'           AS  Data_Time               --数据时间
        ,Real_Src_Tbl                   AS  Real_Src_Tbl            --真实源表
        ,Src_Tbl                        AS  Src_Tbl                 --源表
    FROM ${db_temp}.T00_TBL_RELA_H_MID_BDP030 WHERE DATA_TYPE IN ('D','U')     --变更-U,删除-D
    UNION ALL
     --无变动的数据插回目标表
    SELECT
         Tbl_Id                                                     --表编号
        ,Tbl_Rela_Type_Cd                                           --表关系类型代码
        ,Strt_Date                                                  --开始日期
        ,Rela_Tbl_Id                                                --关联表编号
        ,End_Date                                                   --结束日期
        ,Data_Src_Cd                                                --数据来源代码
        ,Task_Name                                                  --任务名
        ,Data_Time                                                  --数据时间
        ,Real_Src_Tbl                                               --真实源表
        ,Src_Tbl                                                    --源表
    FROM ${db_temp}.T00_TBL_RELA_H_MID_BDP030 WHERE DATA_TYPE ='S'         --无变更-S
    ;
