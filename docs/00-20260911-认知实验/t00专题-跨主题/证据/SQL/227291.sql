-- task_id: 227291
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_TBL_FLD_RELA_H_BDP032.py
-- observed_at: 2026-09-05T01:07:27.164Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_TBL_FLD_RELA_H(
         Fld_Id                     STRING COMMENT '字段编号'
        ,Tbl_Id                     STRING COMMENT '表编号'
        ,Fld_Rela_Type_Cd           STRING COMMENT '字段关系类型代码'
        ,Strt_Date                  STRING COMMENT '开始日期'
        ,Rela_Fld_Id                STRING COMMENT '关联字段编号'
        ,Rela_Tbl_Id                STRING COMMENT '关联表编号'
        ,End_Date                   STRING COMMENT '结束日期'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Time                  STRING COMMENT '数据时间'
        ,Real_Src_Tbl               STRING COMMENT '真实源表'
    )COMMENT '表字段关系历史'
    PARTITIONED BY (SRC_TBL   STRING COMMENT '源表')
    STORED AS ORC;

DROP TABLE IF EXISTS ${db_temp}.T00_TBL_FLD_RELA_H_TEMP_BDP032;
    CREATE TABLE IF NOT EXISTS ${db_temp}.T00_TBL_FLD_RELA_H_TEMP_BDP032
    AS
    -----------------------------------------------------------------------------------------------------
    --Group1: Source Table:[ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_COLUMN：HIVE表字段注释]
    -----------------------------------------------------------------------------------------------------
    SELECT DISTINCT
         A.GUID                                  AS  Fld_Id1                 --字段编号        
        ,A.\`TABLE\`                                  AS  Tbl_Id1                 --表编号          
        ,'01'                                    AS  Fld_Rela_Type_Cd1       --字段关系类型代码  '01'---下游
        ,A.DOWNSTREAMS_1                         AS  Rela_Fld_Id1            --关联字段编号    
        ,COALESCE(B.\`TABLE\` ,GET_JSON_OBJECT(C.\`TABLE\` ,'$.guid'),D.TOPIC)
                                                 AS  Rela_Tbl_Id1            --关联表编号      
        ,'${data_src_cd}'                   AS  Data_Src_Cd1            --数据来源代码
        ,'${src_table}'                     AS  Src_Tbl1                --源表
        ,'${filename}'                      AS  Task_Name1              --任务名
        ,'${src_table}'                     AS  Real_Src_Tbl1           --真实源表
    FROM (SELECT GUID,\`TABLE\` ,DOWNSTREAMS_1
            FROM ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_COLUMN 
            LATERAL VIEW EXPLODE(SPLIT(NVL(DOWNSTREAMS,''),',')) T AS DOWNSTREAMS_1
            WHERE STATUS='ACTIVE'
           ) A
    LEFT JOIN ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_COLUMN B
           ON A.DOWNSTREAMS_1 = B.GUID
    LEFT JOIN ODATA_N_BDP.FILE_ATLAS_EXPORT_GF_RDBMS_COLUMN C
           ON A.DOWNSTREAMS_1 = C.GUID
    LEFT JOIN ODATA_N_BDP.FILE_ATLAS_EXPORT_KAFKA_TOPIC_FIELD D
           ON A.DOWNSTREAMS_1 = D.GUID
    UNION ALL
    -----------------------------------------------------------------------------------------------------
    --Group2: Source Table:[ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_COLUMN：HIVE表字段注释]
    -----------------------------------------------------------------------------------------------------
    SELECT DISTINCT
         A.GUID                                  AS  Fld_Id1                 --字段编号        
        ,A.\`TABLE\`                                  AS  Tbl_Id1                 --表编号          
        ,'02'                                    AS  Fld_Rela_Type_Cd1       --字段关系类型代码  '02'---上游
        ,A.UPSTREAMS_1                           AS  Rela_Fld_Id1            --关联字段编号    
        ,COALESCE(B.\`TABLE\` ,GET_JSON_OBJECT(C.\`TABLE\` ,'$.guid'),D.TOPIC)
                                                 AS  Rela_Tbl_Id1            --关联表编号      
        ,'${data_src_cd}'                   AS  Data_Src_Cd1            --数据来源代码
        ,'${src_table}'                     AS  Src_Tbl1                --源表
        ,'${filename}'                      AS  Task_Name1              --任务名
        ,'${src_table}'                     AS  Real_Src_Tbl1           --真实源表
    FROM (SELECT GUID,\`TABLE\` ,UPSTREAMS_1
            FROM ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_COLUMN 
            LATERAL VIEW EXPLODE(SPLIT(NVL(UPSTREAMS,''),',')) T AS UPSTREAMS_1
            WHERE STATUS='ACTIVE'
           ) A
    LEFT JOIN ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_COLUMN B
           ON A.UPSTREAMS_1 = B.GUID
    LEFT JOIN ODATA_N_BDP.FILE_ATLAS_EXPORT_GF_RDBMS_COLUMN C
           ON A.UPSTREAMS_1 = C.GUID
    LEFT JOIN ODATA_N_BDP.FILE_ATLAS_EXPORT_KAFKA_TOPIC_FIELD D
           ON A.UPSTREAMS_1 = D.GUID
    ;

DROP TABLE IF EXISTS ${db_temp}.T00_TBL_FLD_RELA_H_MID_BDP032;
    CREATE TABLE ${db_temp}.T00_TBL_FLD_RELA_H_MID_BDP032
    AS
    SELECT
           A.*,B.*
           ,CASE WHEN A.Fld_Id IS NULL     AND B.Fld_Id1 IS NOT NULL THEN 'I'           --当天不存在历史的数据为新增
                 WHEN A.Fld_Id IS NOT NULL AND B.Fld_Id1 IS NULL THEN 'D'           --历史不存在当天的数据为删除
                 WHEN A.Fld_Id IS NOT NULL AND B.Fld_Id1 IS NOT NULL AND
                 (   COALESCE(A.Rela_Fld_Id             ,'')   <> COALESCE(B.Rela_Fld_Id1            ,'')
                  OR COALESCE(A.Rela_Tbl_Id             ,'')   <> COALESCE(B.Rela_Tbl_Id1            ,'')
             ) THEN 'U'                                                        --当天和历史均存在,除主键外如有字段变更为变更
                 ELSE 'S' END AS DATA_TYPE                                         --其他为无变更
    FROM   (  SELECT
                *
              FROM  T00_TBL_FLD_RELA_H
              WHERE STRT_DATE <='${data_day_str}'
                AND END_DATE  > '${data_day_str}'
                AND SRC_TBL IN ('ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_COLUMN')  )A   --历史(昨日)开链数据
    FULL OUTER JOIN ${db_temp}.T00_TBL_FLD_RELA_H_TEMP_BDP032 B               --当天的数据
    ON  NVL(A.Fld_Id          ,'')= NVL(B.Fld_Id1          ,'')
    AND NVL(A.Tbl_Id          ,'')= NVL(B.Tbl_Id1          ,'')
    AND NVL(A.Fld_Rela_Type_Cd,'')= NVL(B.Fld_Rela_Type_Cd1,'')
    AND NVL(A.Rela_Fld_Id     ,'')= NVL(B.Rela_Fld_Id1     ,'')
    AND NVL(A.Rela_Tbl_Id     ,'')= NVL(B.Rela_Tbl_Id1     ,'')
    ;

-- querySql
INSERT OVERWRITE TABLE T00_TBL_FLD_RELA_H PARTITION(SRC_TBL)
     --剔除掉源表当日新增和当日闭链的数据
    SELECT 
         DISTINCT
         Fld_Id                                --字段编号
        ,Tbl_Id                                --表编号
        ,Fld_Rela_Type_Cd                      --字段关系类型代码
        ,Strt_Date                             --开始日期
        ,Rela_Fld_Id                           --关联字段编号
        ,Rela_Tbl_Id                           --关联表编号
        ,End_Date                              --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM (
    SELECT
         Fld_Id                                --字段编号
        ,Tbl_Id                                --表编号
        ,Fld_Rela_Type_Cd                      --字段关系类型代码
        ,Strt_Date                             --开始日期
        ,Rela_Fld_Id                           --关联字段编号
        ,Rela_Tbl_Id                           --关联表编号
        ,End_Date                              --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM T00_TBL_FLD_RELA_H
    WHERE STRT_DATE !='${data_day_str}'
      AND END_DATE  !='${data_day_str}'
      AND SRC_TBL IN ('ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_COLUMN')
    UNION ALL
     --目标表为源表当日闭链的数据还原
    SELECT
         Fld_Id                                --字段编号
        ,Tbl_Id                                --表编号
        ,Fld_Rela_Type_Cd                      --字段关系类型代码
        ,Strt_Date                             --开始日期
        ,Rela_Fld_Id                           --关联字段编号
        ,Rela_Tbl_Id                           --关联表编号
        ,'2099-12-31'  AS End_Date             --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM T00_TBL_FLD_RELA_H
    WHERE  END_DATE ='${data_day_str}'
      AND  SRC_TBL IN ('ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_COLUMN')
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
    
    INSERT OVERWRITE TABLE T00_TBL_FLD_RELA_H PARTITION(SRC_TBL)
      --历史闭链的无效数据插回目标表
    SELECT
         Fld_Id                                                     --字段编号
        ,Tbl_Id                                                     --表编号
        ,Fld_Rela_Type_Cd                                           --字段关系类型代码
        ,Strt_Date                                                  --开始日期
        ,Rela_Fld_Id                                                --关联字段编号
        ,Rela_Tbl_Id                                                --关联表编号
        ,End_Date                                                   --结束日期
        ,Data_Src_Cd                                                --数据来源代码
        ,Task_Name                                                  --任务名
        ,Data_Time                                                  --数据时间
        ,Real_Src_Tbl                                               --真实源表
        ,Src_Tbl                                                    --源表
    FROM T00_TBL_FLD_RELA_H
    WHERE NOT(    STRT_DATE <='${data_day_str}'
              AND END_DATE  > '${data_day_str}'   )
      AND SRC_TBL IN ('ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_COLUMN')  --只插入目标表分区字段为该表的数据
    UNION ALL
     --当天有变动和新增的数据开链
    SELECT   
         Fld_Id1                        AS  Fld_Id                  --字段编号
        ,Tbl_Id1                        AS  Tbl_Id                  --表编号
        ,Fld_Rela_Type_Cd1              AS  Fld_Rela_Type_Cd        --字段关系类型代码
        ,'${data_day_str}'         AS  Strt_Date               --开始日期
        ,Rela_Fld_Id1                   AS  Rela_Fld_Id             --关联字段编号
        ,Rela_Tbl_Id1                   AS  Rela_Tbl_Id             --关联表编号
        ,'2099-12-31'                   AS  End_Date                --结束日期
        ,Data_Src_Cd1                   AS  Data_Src_Cd             --数据来源代码
        ,Task_Name1                     AS  Task_Name               --任务名
        ,'${data_today}'           AS  Data_Time               --数据时间
        ,Real_Src_Tbl1                  AS  Real_Src_Tbl            --真实源表
        ,Src_Tbl1                       AS  Src_Tbl                 --源表
    FROM ${db_temp}.T00_TBL_FLD_RELA_H_MID_BDP032 WHERE DATA_TYPE IN ('I','U')     --新增-I,变更-U
    UNION ALL
     --历史开链有变动和不存在当天的数据闭链
    SELECT
         Fld_Id                                                     --字段编号
        ,Tbl_Id                                                     --表编号
        ,Fld_Rela_Type_Cd                                           --字段关系类型代码
        ,Strt_Date                                                  --开始日期
        ,Rela_Fld_Id                                                --关联字段编号
        ,Rela_Tbl_Id                                                --关联表编号
        ,'${data_day_str}'         AS  End_Date                --结束日期
        ,Data_Src_Cd                    AS  Data_Src_Cd             --数据来源代码
        ,Task_Name                      AS  Task_Name               --任务名
        ,'${data_today}'           AS  Data_Time               --数据时间
        ,Real_Src_Tbl                   AS  Real_Src_Tbl            --真实源表
        ,Src_Tbl                        AS  Src_Tbl                 --源表
    FROM ${db_temp}.T00_TBL_FLD_RELA_H_MID_BDP032 WHERE DATA_TYPE IN ('D','U')     --变更-U,删除-D
    UNION ALL
     --无变动的数据插回目标表
    SELECT
         Fld_Id                                                     --字段编号
        ,Tbl_Id                                                     --表编号
        ,Fld_Rela_Type_Cd                                           --字段关系类型代码
        ,Strt_Date                                                  --开始日期
        ,Rela_Fld_Id                                                --关联字段编号
        ,Rela_Tbl_Id                                                --关联表编号
        ,End_Date                                                   --结束日期
        ,Data_Src_Cd                                                --数据来源代码
        ,Task_Name                                                  --任务名
        ,Data_Time                                                  --数据时间
        ,Real_Src_Tbl                                               --真实源表
        ,Src_Tbl                                                    --源表
    FROM ${db_temp}.T00_TBL_FLD_RELA_H_MID_BDP032 WHERE DATA_TYPE ='S'         --无变更-S
    ;
