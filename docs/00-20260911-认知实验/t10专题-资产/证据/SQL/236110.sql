-- task_id: 236110
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/AST/PDATA_N.T10_AST_STAT_H_FAM001.py
-- observed_at: 2026-09-05T01:07:29.155Z

-- createSql
CREATE TABLE IF NOT EXISTS T10_AST_STAT_H(
         Ast_Id                     STRING COMMENT '资产编号'
        ,Ast_Stat_Type_Cd           STRING COMMENT '资产状态类型代码'
        ,Strt_Date                  STRING COMMENT '开始日期'
        ,Ast_Stat_Cd                STRING COMMENT '资产状态代码'
        ,End_Date                   STRING COMMENT '结束日期'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Time                  STRING COMMENT '数据时间'
        ,Real_Src_Tbl               STRING COMMENT '真实源表'
    )COMMENT '资产状态历史'
    PARTITIONED BY (SRC_TBL   STRING COMMENT '源表')
    STORED AS ORC;

DROP TABLE IF EXISTS ${db_temp}.T10_AST_STAT_H_TEMP_FAM001;
    CREATE TABLE IF NOT EXISTS ${db_temp}.T10_AST_STAT_H_TEMP_FAM001
    AS
    -----------------------------------------------------------------------------------------------------
    --Group1: Source Table:[ODATA_N_FAM.W_ASSET_ACCOUNT：资产台账]
    -----------------------------------------------------------------------------------------------------
    SELECT
         ASSET_TAG_NO                            AS  Ast_Id1                 --资产编号                     
        ,'01'                                    AS  Ast_Stat_Type_Cd1       --资产状态类型代码                01 --固定资产状态
        ,NVL(DW_CD_VAL,STATUS)                   AS  Ast_Stat_Cd1            --资产状态代码
        ,'${data_src_cd}'                   AS  Data_Src_Cd1            --数据来源代码
        ,'${src_table}'                     AS  Src_Tbl1                --源表
        ,'${filename}'                      AS  Task_Name1              --任务名
        ,'${src_table}'                     AS  Real_Src_Tbl1           --真实源表
    FROM (SELECT * FROM ODATA_N_FAM.W_ASSET_ACCOUNT WHERE BUSI_DATE ='${data_day_str}') A
    LEFT JOIN (
             SELECT SRC_CD_VAL,DW_CD_VAL
               FROM PDATA_N.REF_CD_CVT_MAP
             WHERE TGT_TAB_NAME = 'T10_AST_STAT_H'
                AND TGT_TAB_FLD  = 'Ast_Stat_Cd'
                AND SRC_TAB_NAME = 'ASSET_ACCOUNT'
                AND SRC_FLD_NAME = 'STATUS'
                AND SRC_SYS_NAME='FAM')B
       ON      A.STATUS =B.SRC_CD_VAL                  --STATUS 转码
    UNION ALL
    -----------------------------------------------------------------------------------------------------
    --Group2: Source Table:[ODATA_N_FAM.W_ASSET_ACCOUNT：资产台账]
    -----------------------------------------------------------------------------------------------------
    SELECT
         ASSET_TAG_NO                            AS  Ast_Id1                 --资产编号                     
        ,'02'                                    AS  Ast_Stat_Type_Cd1       --资产状态类型代码                02 --固定资产投保状态
        ,NVL(DW_CD_VAL,INSURE_STATUS)            AS  Ast_Stat_Cd1            --资产状态代码
        ,'${data_src_cd}'                   AS  Data_Src_Cd1            --数据来源代码
        ,'${src_table}'                     AS  Src_Tbl1                --源表
        ,'${filename}'                      AS  Task_Name1              --任务名
        ,'${src_table}'                     AS  Real_Src_Tbl1           --真实源表
    FROM (SELECT * FROM ODATA_N_FAM.W_ASSET_ACCOUNT WHERE BUSI_DATE ='${data_day_str}') A
    LEFT JOIN (
             SELECT SRC_CD_VAL,DW_CD_VAL
               FROM PDATA_N.REF_CD_CVT_MAP
             WHERE TGT_TAB_NAME = 'T10_AST_STAT_H'
                AND TGT_TAB_FLD  = 'Ast_Stat_Cd'
                AND SRC_TAB_NAME = 'ASSET_ACCOUNT'
                AND SRC_FLD_NAME = 'INSURE_STATUS'
                AND SRC_SYS_NAME='FAM')B
       ON      A.INSURE_STATUS =B.SRC_CD_VAL                  --INSURE_STATUS 转码
    UNION ALL
    -----------------------------------------------------------------------------------------------------
    --Group3: Source Table:[ODATA_N_FAM.W_ASSET_ACCOUNT：资产台账]
    -----------------------------------------------------------------------------------------------------
    SELECT
         ASSET_TAG_NO                            AS  Ast_Id1                 --资产编号                     
        ,'03'                                    AS  Ast_Stat_Type_Cd1       --资产状态类型代码                03 --固定资产入账状态
        ,NVL(DW_CD_VAL,ENTRY_STATUS)             AS  Ast_Stat_Cd1            --资产状态代码
        ,'${data_src_cd}'                   AS  Data_Src_Cd1            --数据来源代码
        ,'${src_table}'                     AS  Src_Tbl1                --源表
        ,'${filename}'                      AS  Task_Name1              --任务名
        ,'${src_table}'                     AS  Real_Src_Tbl1           --真实源表
    FROM (SELECT * FROM ODATA_N_FAM.W_ASSET_ACCOUNT WHERE BUSI_DATE ='${data_day_str}') A
    LEFT JOIN (
             SELECT SRC_CD_VAL,DW_CD_VAL
               FROM PDATA_N.REF_CD_CVT_MAP
             WHERE TGT_TAB_NAME = 'T10_AST_STAT_H'
                AND TGT_TAB_FLD  = 'Ast_Stat_Cd'
                AND SRC_TAB_NAME = 'ASSET_ACCOUNT'
                AND SRC_FLD_NAME = 'ENTRY_STATUS'
                AND SRC_SYS_NAME='FAM')B
       ON      A.ENTRY_STATUS =B.SRC_CD_VAL                  --ENTRY_STATUS 转码
    ;

DROP TABLE IF EXISTS ${db_temp}.T10_AST_STAT_H_MID_FAM001;
    CREATE TABLE ${db_temp}.T10_AST_STAT_H_MID_FAM001
    AS
    SELECT
           A.*,B.*
           ,CASE WHEN A.Ast_Id IS NULL     AND B.Ast_Id1 IS NOT NULL THEN 'I'           --当天不存在历史的数据为新增
                 WHEN A.Ast_Id IS NOT NULL AND B.Ast_Id1 IS NULL THEN 'D'           --历史不存在当天的数据为删除
                 WHEN A.Ast_Id IS NOT NULL AND B.Ast_Id1 IS NOT NULL AND
                 (   COALESCE(A.Ast_Stat_Cd             ,'')   <> COALESCE(B.Ast_Stat_Cd1            ,'')
             ) THEN 'U'                                                        --当天和历史均存在,除主键外如有字段变更为变更
                 ELSE 'S' END AS DATA_TYPE                                         --其他为无变更
    FROM   (  SELECT
                *
              FROM  T10_AST_STAT_H
              WHERE STRT_DATE <='${data_day_str}'
                AND END_DATE  > '${data_day_str}'
                AND SRC_TBL IN ('ODATA_N_FAM.W_ASSET_ACCOUNT')  )A   --历史(昨日)开链数据
    FULL OUTER JOIN ${db_temp}.T10_AST_STAT_H_TEMP_FAM001 B               --当天的数据
    ON   A.Ast_Id= B.Ast_Id1
    AND  A.Ast_Stat_Type_Cd= B.Ast_Stat_Type_Cd1
    ;

-- querySql
INSERT OVERWRITE TABLE T10_AST_STAT_H PARTITION(SRC_TBL)
     --剔除掉源表当日新增和当日闭链的数据
    SELECT 
         DISTINCT
         Ast_Id                                --资产编号
        ,Ast_Stat_Type_Cd                      --资产状态类型代码
        ,Strt_Date                             --开始日期
        ,Ast_Stat_Cd                           --资产状态代码
        ,End_Date                              --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM (
    SELECT
         Ast_Id                                --资产编号
        ,Ast_Stat_Type_Cd                      --资产状态类型代码
        ,Strt_Date                             --开始日期
        ,Ast_Stat_Cd                           --资产状态代码
        ,End_Date                              --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM T10_AST_STAT_H
    WHERE STRT_DATE !='${data_day_str}'
      AND END_DATE  !='${data_day_str}'
      AND SRC_TBL IN ('ODATA_N_FAM.W_ASSET_ACCOUNT')
    UNION ALL
     --目标表为源表当日闭链的数据还原
    SELECT
         Ast_Id                                --资产编号
        ,Ast_Stat_Type_Cd                      --资产状态类型代码
        ,Strt_Date                             --开始日期
        ,Ast_Stat_Cd                           --资产状态代码
        ,'2099-12-31'  AS End_Date             --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM T10_AST_STAT_H
    WHERE  END_DATE ='${data_day_str}'
      AND  SRC_TBL IN ('ODATA_N_FAM.W_ASSET_ACCOUNT')
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
    
    INSERT OVERWRITE TABLE T10_AST_STAT_H PARTITION(SRC_TBL)
      --历史闭链的无效数据插回目标表
    SELECT
         Ast_Id                                                     --资产编号
        ,Ast_Stat_Type_Cd                                           --资产状态类型代码
        ,Strt_Date                                                  --开始日期
        ,Ast_Stat_Cd                                                --资产状态代码
        ,End_Date                                                   --结束日期
        ,Data_Src_Cd                                                --数据来源代码
        ,Task_Name                                                  --任务名
        ,Data_Time                                                  --数据时间
        ,Real_Src_Tbl                                               --真实源表
        ,Src_Tbl                                                    --源表
    FROM T10_AST_STAT_H
    WHERE NOT(    STRT_DATE <='${data_day_str}'
              AND END_DATE  > '${data_day_str}'   )
      AND SRC_TBL IN ('ODATA_N_FAM.W_ASSET_ACCOUNT')  --只插入目标表分区字段为该表的数据
    UNION ALL
     --当天有变动和新增的数据开链
    SELECT   
         Ast_Id1                        AS  Ast_Id                  --资产编号
        ,Ast_Stat_Type_Cd1              AS  Ast_Stat_Type_Cd        --资产状态类型代码
        ,'${data_day_str}'         AS  Strt_Date               --开始日期
        ,Ast_Stat_Cd1                   AS  Ast_Stat_Cd             --资产状态代码
        ,'2099-12-31'                   AS  End_Date                --结束日期
        ,Data_Src_Cd1                   AS  Data_Src_Cd             --数据来源代码
        ,Task_Name1                     AS  Task_Name               --任务名
        ,'${data_today}'           AS  Data_Time               --数据时间
        ,Real_Src_Tbl1                  AS  Real_Src_Tbl            --真实源表
        ,Src_Tbl1                       AS  Src_Tbl                 --源表
    FROM ${db_temp}.T10_AST_STAT_H_MID_FAM001 WHERE DATA_TYPE IN ('I','U')     --新增-I,变更-U
    UNION ALL
     --历史开链有变动和不存在当天的数据闭链
    SELECT
         Ast_Id                                                     --资产编号
        ,Ast_Stat_Type_Cd                                           --资产状态类型代码
        ,Strt_Date                                                  --开始日期
        ,Ast_Stat_Cd                                                --资产状态代码
        ,'${data_day_str}'         AS  End_Date                --结束日期
        ,Data_Src_Cd                    AS  Data_Src_Cd             --数据来源代码
        ,Task_Name                      AS  Task_Name               --任务名
        ,'${data_today}'           AS  Data_Time               --数据时间
        ,Real_Src_Tbl                   AS  Real_Src_Tbl            --真实源表
        ,Src_Tbl                        AS  Src_Tbl                 --源表
    FROM ${db_temp}.T10_AST_STAT_H_MID_FAM001 WHERE DATA_TYPE IN ('D','U')     --变更-U,删除-D
    UNION ALL
     --无变动的数据插回目标表
    SELECT
         Ast_Id                                                     --资产编号
        ,Ast_Stat_Type_Cd                                           --资产状态类型代码
        ,Strt_Date                                                  --开始日期
        ,Ast_Stat_Cd                                                --资产状态代码
        ,End_Date                                                   --结束日期
        ,Data_Src_Cd                                                --数据来源代码
        ,Task_Name                                                  --任务名
        ,Data_Time                                                  --数据时间
        ,Real_Src_Tbl                                               --真实源表
        ,Src_Tbl                                                    --源表
    FROM ${db_temp}.T10_AST_STAT_H_MID_FAM001 WHERE DATA_TYPE ='S'         --无变更-S
    ;
