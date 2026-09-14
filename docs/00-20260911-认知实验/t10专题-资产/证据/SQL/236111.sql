-- task_id: 236111
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/AST/PDATA_N.T10_AST_PLAC_H_FAM001.py
-- observed_at: 2026-09-05T01:07:29.161Z

-- createSql
CREATE TABLE IF NOT EXISTS T10_AST_PLAC_H(
         Ast_Id                     STRING COMMENT '资产编号'
        ,Strt_Date                  STRING COMMENT '开始日期'
        ,Oper_Sys                   STRING COMMENT '操作系统'
        ,Mfr                        STRING COMMENT '制造商'
        ,Mdl                        STRING COMMENT '型号'
        ,Vol                        STRING COMMENT '数量'
        ,Plac                       STRING COMMENT '配置'
        ,End_Date                   STRING COMMENT '结束日期'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Time                  STRING COMMENT '数据时间'
        ,Real_Src_Tbl               STRING COMMENT '真实源表'
    )COMMENT '资产配置历史'
    PARTITIONED BY (SRC_TBL   STRING COMMENT '源表')
    STORED AS ORC;

DROP TABLE IF EXISTS ${db_temp}.T10_AST_PLAC_H_TEMP_FAM001;
    CREATE TABLE IF NOT EXISTS ${db_temp}.T10_AST_PLAC_H_TEMP_FAM001
    AS
    -----------------------------------------------------------------------------------------------------
    --Group1: Source Table:[ODATA_N_FAM.W_ASSET_ACCOUNT：资产台账]
    -----------------------------------------------------------------------------------------------------
    SELECT
         ASSET_TAG_NO                            AS  Ast_Id1                 --资产编号    
        ,OPERATE_SYSTEM                          AS  Oper_Sys1               --操作系统    
        ,SUPPLIER                                AS  Mfr1                    --制造商      
        ,ASSET_MODEL                             AS  Mdl1                    --型号        
        ,NUM                                     AS  Vol1                    --数量        
        ,''                                      AS  Plac1                   --配置        
        ,'${data_src_cd}'                   AS  Data_Src_Cd1            --数据来源代码
        ,'${src_table}'                     AS  Src_Tbl1                --源表
        ,'${filename}'                      AS  Task_Name1              --任务名
        ,'${src_table}'                     AS  Real_Src_Tbl1           --真实源表
    FROM (SELECT * FROM ODATA_N_FAM.W_ASSET_ACCOUNT WHERE BUSI_DATE ='${data_day_str}') A
    ;

DROP TABLE IF EXISTS ${db_temp}.T10_AST_PLAC_H_MID_FAM001;
    CREATE TABLE ${db_temp}.T10_AST_PLAC_H_MID_FAM001
    AS
    SELECT
           A.*,B.*
           ,CASE WHEN A.Ast_Id IS NULL     AND B.Ast_Id1 IS NOT NULL THEN 'I'           --当天不存在历史的数据为新增
                 WHEN A.Ast_Id IS NOT NULL AND B.Ast_Id1 IS NULL THEN 'D'           --历史不存在当天的数据为删除
                 WHEN A.Ast_Id IS NOT NULL AND B.Ast_Id1 IS NOT NULL AND
                 (   COALESCE(A.Oper_Sys                ,'')   <> COALESCE(B.Oper_Sys1               ,'')
                  OR COALESCE(A.Mfr                     ,'')   <> COALESCE(B.Mfr1                    ,'')
                  OR COALESCE(A.Mdl                     ,'')   <> COALESCE(B.Mdl1                    ,'')
                  OR COALESCE(A.Vol                     ,'')   <> COALESCE(B.Vol1                    ,'')
                  OR COALESCE(A.Plac                    ,'')   <> COALESCE(B.Plac1                   ,'')
             ) THEN 'U'                                                        --当天和历史均存在,除主键外如有字段变更为变更
                 ELSE 'S' END AS DATA_TYPE                                         --其他为无变更
    FROM   (  SELECT
                *
              FROM  T10_AST_PLAC_H
              WHERE STRT_DATE <='${data_day_str}'
                AND END_DATE  > '${data_day_str}'
                AND SRC_TBL IN ('ODATA_N_FAM.W_ASSET_ACCOUNT')  )A   --历史(昨日)开链数据
    FULL OUTER JOIN ${db_temp}.T10_AST_PLAC_H_TEMP_FAM001 B               --当天的数据
    ON   A.Ast_Id= B.Ast_Id1
    ;

-- querySql
INSERT OVERWRITE TABLE T10_AST_PLAC_H PARTITION(SRC_TBL)
     --剔除掉源表当日新增和当日闭链的数据
    SELECT 
         DISTINCT
         Ast_Id                                --资产编号
        ,Strt_Date                             --开始日期
        ,Oper_Sys                              --操作系统
        ,Mfr                                   --制造商
        ,Mdl                                   --型号
        ,Vol                                   --数量
        ,Plac                                  --配置
        ,End_Date                              --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM (
    SELECT
         Ast_Id                                --资产编号
        ,Strt_Date                             --开始日期
        ,Oper_Sys                              --操作系统
        ,Mfr                                   --制造商
        ,Mdl                                   --型号
        ,Vol                                   --数量
        ,Plac                                  --配置
        ,End_Date                              --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM T10_AST_PLAC_H
    WHERE STRT_DATE !='${data_day_str}'
      AND END_DATE  !='${data_day_str}'
      AND SRC_TBL IN ('ODATA_N_FAM.W_ASSET_ACCOUNT')
    UNION ALL
     --目标表为源表当日闭链的数据还原
    SELECT
         Ast_Id                                --资产编号
        ,Strt_Date                             --开始日期
        ,Oper_Sys                              --操作系统
        ,Mfr                                   --制造商
        ,Mdl                                   --型号
        ,Vol                                   --数量
        ,Plac                                  --配置
        ,'2099-12-31'  AS End_Date             --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM T10_AST_PLAC_H
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
    
    INSERT OVERWRITE TABLE T10_AST_PLAC_H PARTITION(SRC_TBL)
      --历史闭链的无效数据插回目标表
    SELECT
         Ast_Id                                                     --资产编号
        ,Strt_Date                                                  --开始日期
        ,Oper_Sys                                                   --操作系统
        ,Mfr                                                        --制造商
        ,Mdl                                                        --型号
        ,Vol                                                        --数量
        ,Plac                                                       --配置
        ,End_Date                                                   --结束日期
        ,Data_Src_Cd                                                --数据来源代码
        ,Task_Name                                                  --任务名
        ,Data_Time                                                  --数据时间
        ,Real_Src_Tbl                                               --真实源表
        ,Src_Tbl                                                    --源表
    FROM T10_AST_PLAC_H
    WHERE NOT(    STRT_DATE <='${data_day_str}'
              AND END_DATE  > '${data_day_str}'   )
      AND SRC_TBL IN ('ODATA_N_FAM.W_ASSET_ACCOUNT')  --只插入目标表分区字段为该表的数据
    UNION ALL
     --当天有变动和新增的数据开链
    SELECT   
         Ast_Id1                        AS  Ast_Id                  --资产编号
        ,'${data_day_str}'         AS  Strt_Date               --开始日期
        ,Oper_Sys1                      AS  Oper_Sys                --操作系统
        ,Mfr1                           AS  Mfr                     --制造商
        ,Mdl1                           AS  Mdl                     --型号
        ,Vol1                           AS  Vol                     --数量
        ,Plac1                          AS  Plac                    --配置
        ,'2099-12-31'                   AS  End_Date                --结束日期
        ,Data_Src_Cd1                   AS  Data_Src_Cd             --数据来源代码
        ,Task_Name1                     AS  Task_Name               --任务名
        ,'${data_today}'           AS  Data_Time               --数据时间
        ,Real_Src_Tbl1                  AS  Real_Src_Tbl            --真实源表
        ,Src_Tbl1                       AS  Src_Tbl                 --源表
    FROM ${db_temp}.T10_AST_PLAC_H_MID_FAM001 WHERE DATA_TYPE IN ('I','U')     --新增-I,变更-U
    UNION ALL
     --历史开链有变动和不存在当天的数据闭链
    SELECT
         Ast_Id                                                     --资产编号
        ,Strt_Date                                                  --开始日期
        ,Oper_Sys                                                   --操作系统
        ,Mfr                                                        --制造商
        ,Mdl                                                        --型号
        ,Vol                                                        --数量
        ,Plac                                                       --配置
        ,'${data_day_str}'         AS  End_Date                --结束日期
        ,Data_Src_Cd                    AS  Data_Src_Cd             --数据来源代码
        ,Task_Name                      AS  Task_Name               --任务名
        ,'${data_today}'           AS  Data_Time               --数据时间
        ,Real_Src_Tbl                   AS  Real_Src_Tbl            --真实源表
        ,Src_Tbl                        AS  Src_Tbl                 --源表
    FROM ${db_temp}.T10_AST_PLAC_H_MID_FAM001 WHERE DATA_TYPE IN ('D','U')     --变更-U,删除-D
    UNION ALL
     --无变动的数据插回目标表
    SELECT
         Ast_Id                                                     --资产编号
        ,Strt_Date                                                  --开始日期
        ,Oper_Sys                                                   --操作系统
        ,Mfr                                                        --制造商
        ,Mdl                                                        --型号
        ,Vol                                                        --数量
        ,Plac                                                       --配置
        ,End_Date                                                   --结束日期
        ,Data_Src_Cd                                                --数据来源代码
        ,Task_Name                                                  --任务名
        ,Data_Time                                                  --数据时间
        ,Real_Src_Tbl                                               --真实源表
        ,Src_Tbl                                                    --源表
    FROM ${db_temp}.T10_AST_PLAC_H_MID_FAM001 WHERE DATA_TYPE ='S'         --无变更-S
    ;
