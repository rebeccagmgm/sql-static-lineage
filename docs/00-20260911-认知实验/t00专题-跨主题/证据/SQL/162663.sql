-- task_id: 162663
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_PROJ_STAT_H_GLM012.py
-- observed_at: 2026-09-05T01:07:05.528Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_PROJ_STAT_H(
         Proj_Id                    STRING COMMENT '项目编号'
        ,Proj_Stat_Type_Cd          STRING COMMENT '项目状态类型代码'
        ,Strt_Date                  STRING COMMENT '开始日期'
        ,Proj_Stat_Cd               STRING COMMENT '项目状态代码'
        ,End_Date                   STRING COMMENT '结束日期'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Time                  STRING COMMENT '数据时间'
    )COMMENT '项目状态历史'
    PARTITIONED BY (SRC_TBL   STRING COMMENT '源表')
    STORED AS ORC;

DROP TABLE IF EXISTS ${db_temp}.T00_PROJ_STAT_H_TEMP_GLM012;
    CREATE TABLE IF NOT EXISTS ${db_temp}.T00_PROJ_STAT_H_TEMP_GLM012
    AS
    -----------------------------------------------------------------------------------------------------
    --Group7: Source Table:[ODATA_N_GLM.P_PRJ_PROJECT：租赁项目信息]
    -----------------------------------------------------------------------------------------------------
    SELECT
         CONCAT('GLM012-',PROJECT_ID)            AS  Proj_Id1                --项目编号        
        ,'01'                                    AS  Proj_Stat_Type_Cd1      --项目状态类型代码
        ,NVL(DW_CD_VAL,PROJECT_STATUS)           AS  Proj_Stat_Cd1           --项目状态代码    
        ,'${data_src_cd}'                   AS  Data_Src_Cd1            --数据来源代码
        ,'${src_table}'                     AS  Src_Tbl1                --源表
        ,'${filename}'                      AS  Task_Name1              --任务名
    FROM (SELECT * FROM ODATA_N_GLM.P_PRJ_PROJECT WHERE BUSI_DATE ='${data_day_str}' AND DEL_FLAG='N') A
    LEFT JOIN (
             SELECT SRC_CD_VAL,DW_CD_VAL
              FROM PDATA_N.REF_CD_CVT_MAP
              WHERE TGT_TAB_NAME = 'T00_PROJ_BASE_INFO'
                 AND TGT_TAB_FLD  = 'Proj_Stat_Cd'
                 AND SRC_TAB_NAME = 'PRJ_PROJECT'
                 AND SRC_FLD_NAME = 'PROJECT_STATUS'
                 AND SRC_SYS_NAME='GLM')B
          ON      A.PROJECT_STATUS =B.SRC_CD_VAL                         --PROJECT_STATUS 转码
    ;

DROP TABLE IF EXISTS ${db_temp}.T00_PROJ_STAT_H_MID_GLM012;
    CREATE TABLE ${db_temp}.T00_PROJ_STAT_H_MID_GLM012
    AS
    SELECT
           A.*,B.*
           ,CASE WHEN A.Proj_Id IS NULL     AND B.Proj_Id1 IS NOT NULL THEN 'I'           --当天不存在历史的数据为新增
                 WHEN A.Proj_Id IS NOT NULL AND B.Proj_Id1 IS NULL THEN 'D'           --历史不存在当天的数据为删除
                 WHEN A.Proj_Id IS NOT NULL AND B.Proj_Id1 IS NOT NULL AND
                 (   COALESCE(A.Proj_Stat_Cd            ,'')   <> COALESCE(B.Proj_Stat_Cd1           ,'')
             ) THEN 'U'                                                        --当天和历史均存在,除主键外如有字段变更为变更
                 ELSE 'S' END AS DATA_TYPE                                         --其他为无变更
    FROM   (  SELECT
                *
              FROM  T00_PROJ_STAT_H
              WHERE STRT_DATE <='${data_day_str}'
                AND END_DATE  > '${data_day_str}'
                AND SRC_TBL IN ('ODATA_N_GLM.P_PRJ_PROJECT')  )A   --历史(昨日)开链数据
    FULL OUTER JOIN ${db_temp}.T00_PROJ_STAT_H_TEMP_GLM012 B               --当天的数据
    ON   A.Proj_Id= B.Proj_Id1
    AND  A.Proj_Stat_Type_Cd= B.Proj_Stat_Type_Cd1
    ;

-- querySql
INSERT OVERWRITE TABLE T00_PROJ_STAT_H PARTITION(SRC_TBL)
     --剔除掉源表当日新增和当日闭链的数据
    SELECT
         Proj_Id                               --项目编号
        ,Proj_Stat_Type_Cd                     --项目状态类型代码
        ,Strt_Date                             --开始日期
        ,Proj_Stat_Cd                          --项目状态代码
        ,End_Date                              --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Src_Tbl                               --源表
    FROM T00_PROJ_STAT_H
    WHERE STRT_DATE !='${data_day_str}'
      AND END_DATE  !='${data_day_str}'
      AND SRC_TBL IN ('ODATA_N_GLM.P_PRJ_PROJECT')
    UNION ALL
     --目标表为源表当日闭链的数据还原
    SELECT
         Proj_Id                               --项目编号
        ,Proj_Stat_Type_Cd                     --项目状态类型代码
        ,Strt_Date                             --开始日期
        ,Proj_Stat_Cd                          --项目状态代码
        ,'2099-12-31'  AS End_Date             --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Src_Tbl                               --源表
    FROM T00_PROJ_STAT_H
    WHERE  END_DATE ='${data_day_str}'
      AND  SRC_TBL IN ('ODATA_N_GLM.P_PRJ_PROJECT')
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
    
    INSERT OVERWRITE TABLE T00_PROJ_STAT_H PARTITION(SRC_TBL)
      --历史闭链的无效数据插回目标表
    SELECT
         Proj_Id                                                    --项目编号
        ,Proj_Stat_Type_Cd                                          --项目状态类型代码
        ,Strt_Date                                                  --开始日期
        ,Proj_Stat_Cd                                               --项目状态代码
        ,End_Date                                                   --结束日期
        ,Data_Src_Cd                                                --数据来源代码
        ,Task_Name                                                  --任务名
        ,Data_Time                                                  --数据时间
        ,Src_Tbl                                                    --源表
    FROM T00_PROJ_STAT_H
    WHERE NOT(    STRT_DATE <='${data_day_str}'
              AND END_DATE  > '${data_day_str}'   )
      AND SRC_TBL IN ('ODATA_N_GLM.P_PRJ_PROJECT')  --只插入目标表分区字段为该表的数据
    UNION ALL
     --当天有变动和新增的数据开链
    SELECT   
         Proj_Id1                       AS  Proj_Id                 --项目编号
        ,Proj_Stat_Type_Cd1             AS  Proj_Stat_Type_Cd       --项目状态类型代码
        ,'${data_day_str}'         AS  Strt_Date               --开始日期
        ,Proj_Stat_Cd1                  AS  Proj_Stat_Cd            --项目状态代码
        ,'2099-12-31'                   AS  End_Date                --结束日期
        ,Data_Src_Cd1                   AS  Data_Src_Cd             --数据来源代码
        ,Task_Name1                     AS  Task_Name               --任务名
        ,'${data_today}'           AS  Data_Time               --数据时间
        ,Src_Tbl1                       AS  Src_Tbl                 --源表
    FROM ${db_temp}.T00_PROJ_STAT_H_MID_GLM012 WHERE DATA_TYPE IN ('I','U')     --新增-I,变更-U
    UNION ALL
     --历史开链有变动和不存在当天的数据闭链
    SELECT
         Proj_Id                                                    --项目编号
        ,Proj_Stat_Type_Cd                                          --项目状态类型代码
        ,Strt_Date                                                  --开始日期
        ,Proj_Stat_Cd                                               --项目状态代码
        ,'${data_day_str}'         AS  End_Date                --结束日期
        ,Data_Src_Cd                    AS  Data_Src_Cd             --数据来源代码
        ,Task_Name                      AS  Task_Name               --任务名
       ,'${data_today}'            AS  Data_Time               --数据时间
        ,Src_Tbl                        AS  Src_Tbl                 --源表
    FROM ${db_temp}.T00_PROJ_STAT_H_MID_GLM012 WHERE DATA_TYPE IN ('D','U')     --变更-U,删除-D
    UNION ALL
     --无变动的数据插回目标表
    SELECT
         Proj_Id                                                    --项目编号
        ,Proj_Stat_Type_Cd                                          --项目状态类型代码
        ,Strt_Date                                                  --开始日期
        ,Proj_Stat_Cd                                               --项目状态代码
        ,End_Date                                                   --结束日期
        ,Data_Src_Cd                                                --数据来源代码
        ,Task_Name                                                  --任务名
        ,Data_Time                                                  --数据时间
        ,Src_Tbl                                                    --源表
    FROM ${db_temp}.T00_PROJ_STAT_H_MID_GLM012 WHERE DATA_TYPE ='S'         --无变更-S
    ;
