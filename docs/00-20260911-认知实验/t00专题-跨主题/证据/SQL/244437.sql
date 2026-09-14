-- task_id: 244437
-- hiveDb: 
-- source: HORAE_LOG
-- sqlStatus: AVAILABLE
-- scriptPath: 
-- observed_at: 2026-09-05T07:44:26.867Z

-- createSql
set hive.exec.dynamic.partition=true;
set hive.exec.dynamic.partition.mode=nonstrict;
set hive.auto.convert.join=false;
use pdata_n;

    CREATE TABLE IF NOT EXISTS T00_SYS_STATI_INFO_H(
         Sys_Id                     STRING COMMENT '系统编号'
        ,Sys_Stati_Info_Type_Cd     STRING COMMENT '系统统计信息类型代码'
        ,Strt_Date                  STRING COMMENT '开始日期'
        ,Stati_Cont_Desc            STRING COMMENT '统计内容描述'
        ,Stati_Qty_Info             STRING COMMENT '统计数值信息'
        ,Stati_Num_Info             STRING COMMENT '统计数量信息'
        ,Stati_Subdv_Cd             STRING COMMENT '统计细项代码'
        ,End_Date                   STRING COMMENT '结束日期'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Time                  STRING COMMENT '数据时间'
        ,Real_Src_Tbl               STRING COMMENT '真实源表'
    )COMMENT '系统统计信息历史'
    PARTITIONED BY (SRC_TBL   STRING COMMENT '源表')
    STORED AS ORC;

set hive.exec.dynamic.partition=true;
set hive.exec.dynamic.partition.mode=nonstrict;
set hive.auto.convert.join=false;
use pdata_n;

    
    DROP TABLE IF EXISTS TEMP.T00_SYS_STATI_INFO_H_TEMP_ISM012;
    CREATE TABLE IF NOT EXISTS TEMP.T00_SYS_STATI_INFO_H_TEMP_ISM012
    AS
    -----------------------------------------------------------------------------------------------------
    --Group1: Source Table:[ODATA_N_ISM.E_EFFECTIVE_CMDB_BUSINESS：CMDB业务系统表]
    -----------------------------------------------------------------------------------------------------
    SELECT
         INSTANCE_ID                             AS  Sys_Id1                 --系统编号                     
        ,'01'                                    AS  Sys_Stati_Info_Type_Cd1 --系统统计信息类型代码    '01'--系统内部唯一标识
        ,OBJECT_ID                               AS  Stati_Cont_Desc1        --统计内容描述 
        ,''                                      AS  Stati_Qty_Info1         --统计数值信息 
        ,''                                      AS  Stati_Num_Info1         --统计数量信息 
        ,''                                      AS  Stati_Subdv_Cd1         --统计细项代码 
        ,'ISM'                   AS  Data_Src_Cd1            --数据来源代码
        ,'ODATA_N_ISM.E_EFFECTIVE_CMDB_BUSINESS'                     AS  Src_Tbl1                --源表
        ,'PDATA_N.T00_SYS_STATI_INFO_H_ISM012'                      AS  Task_Name1              --任务名
        ,'ODATA_N_ISM.E_EFFECTIVE_CMDB_BUSINESS'                     AS  Real_Src_Tbl1           --真实源表
    FROM (SELECT * FROM ODATA_N_ISM.E_EFFECTIVE_CMDB_BUSINESS WHERE BUSI_DATE ='2026-08-27') A
    ;

set hive.exec.dynamic.partition=true;
set hive.exec.dynamic.partition.mode=nonstrict;
set hive.auto.convert.join=false;
use pdata_n;

    
    DROP TABLE IF EXISTS TEMP.T00_SYS_STATI_INFO_H_MID_ISM012;
    CREATE TABLE TEMP.T00_SYS_STATI_INFO_H_MID_ISM012
    AS
    SELECT
           A.*,B.*
           ,CASE WHEN A.Sys_Id IS NULL     AND B.Sys_Id1 IS NOT NULL THEN 'I'           --当天不存在历史的数据为新增
                 WHEN A.Sys_Id IS NOT NULL AND B.Sys_Id1 IS NULL THEN 'D'           --历史不存在当天的数据为删除
                 WHEN A.Sys_Id IS NOT NULL AND B.Sys_Id1 IS NOT NULL AND
                 (   COALESCE(A.Stati_Cont_Desc         ,'')   <> COALESCE(B.Stati_Cont_Desc1        ,'')
                  OR COALESCE(A.Stati_Qty_Info          ,'')   <> COALESCE(B.Stati_Qty_Info1         ,'')
                  OR COALESCE(A.Stati_Num_Info          ,'')   <> COALESCE(B.Stati_Num_Info1         ,'')
                  OR COALESCE(A.Stati_Subdv_Cd          ,'')   <> COALESCE(B.Stati_Subdv_Cd1         ,'')
             ) THEN 'U'                                                        --当天和历史均存在,除主键外如有字段变更为变更
                 ELSE 'S' END AS DATA_TYPE                                         --其他为无变更
    FROM   (  SELECT
                *
              FROM  T00_SYS_STATI_INFO_H
              WHERE STRT_DATE <='2026-08-27'
                AND END_DATE  > '2026-08-27'
                AND SRC_TBL IN ('ODATA_N_ISM.E_EFFECTIVE_CMDB_BUSINESS')  )A   --历史(昨日)开链数据
    FULL OUTER JOIN TEMP.T00_SYS_STATI_INFO_H_TEMP_ISM012 B               --当天的数据
    ON   A.Sys_Id= B.Sys_Id1
    AND  A.Sys_Stati_Info_Type_Cd= B.Sys_Stati_Info_Type_Cd1
    ;

-- querySql
INSERT OVERWRITE TABLE T00_SYS_STATI_INFO_H PARTITION(SRC_TBL)
     --剔除掉源表当日新增和当日闭链的数据
    SELECT 
         DISTINCT
         Sys_Id                                --系统编号
        ,Sys_Stati_Info_Type_Cd                --系统统计信息类型代码
        ,Strt_Date                             --开始日期
        ,Stati_Cont_Desc                       --统计内容描述
        ,Stati_Qty_Info                        --统计数值信息
        ,Stati_Num_Info                        --统计数量信息
        ,Stati_Subdv_Cd                        --统计细项代码
        ,End_Date                              --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM (
    SELECT
         Sys_Id                                --系统编号
        ,Sys_Stati_Info_Type_Cd                --系统统计信息类型代码
        ,Strt_Date                             --开始日期
        ,Stati_Cont_Desc                       --统计内容描述
        ,Stati_Qty_Info                        --统计数值信息
        ,Stati_Num_Info                        --统计数量信息
        ,Stati_Subdv_Cd                        --统计细项代码
        ,End_Date                              --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM T00_SYS_STATI_INFO_H
    WHERE STRT_DATE !='2026-08-27'
      AND END_DATE  !='2026-08-27'
      AND SRC_TBL IN ('ODATA_N_ISM.E_EFFECTIVE_CMDB_BUSINESS')
    UNION ALL
     --目标表为源表当日闭链的数据还原
    SELECT
         Sys_Id                                --系统编号
        ,Sys_Stati_Info_Type_Cd                --系统统计信息类型代码
        ,Strt_Date                             --开始日期
        ,Stati_Cont_Desc                       --统计内容描述
        ,Stati_Qty_Info                        --统计数值信息
        ,Stati_Num_Info                        --统计数量信息
        ,Stati_Subdv_Cd                        --统计细项代码
        ,'2099-12-31'  AS End_Date             --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM T00_SYS_STATI_INFO_H
    WHERE  END_DATE ='2026-08-27'
      AND  SRC_TBL IN ('ODATA_N_ISM.E_EFFECTIVE_CMDB_BUSINESS')
      ) T
    ;

set hive.exec.dynamic.partition=true;
set hive.exec.dynamic.partition.mode=nonstrict;
set hive.auto.convert.join=false;
use pdata_n;

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
    
    INSERT OVERWRITE TABLE T00_SYS_STATI_INFO_H PARTITION(SRC_TBL)
      --历史闭链的无效数据插回目标表
    SELECT
         Sys_Id                                                     --系统编号
        ,Sys_Stati_Info_Type_Cd                                     --系统统计信息类型代码
        ,Strt_Date                                                  --开始日期
        ,Stati_Cont_Desc                                            --统计内容描述
        ,Stati_Qty_Info                                             --统计数值信息
        ,Stati_Num_Info                                             --统计数量信息
        ,Stati_Subdv_Cd                                             --统计细项代码
        ,End_Date                                                   --结束日期
        ,Data_Src_Cd                                                --数据来源代码
        ,Task_Name                                                  --任务名
        ,Data_Time                                                  --数据时间
        ,Real_Src_Tbl                                               --真实源表
        ,Src_Tbl                                                    --源表
    FROM T00_SYS_STATI_INFO_H
    WHERE NOT(    STRT_DATE <='2026-08-27'
              AND END_DATE  > '2026-08-27'   )
      AND SRC_TBL IN ('ODATA_N_ISM.E_EFFECTIVE_CMDB_BUSINESS')  --只插入目标表分区字段为该表的数据
    UNION ALL
     --当天有变动和新增的数据开链
    SELECT   
         Sys_Id1                        AS  Sys_Id                  --系统编号
        ,Sys_Stati_Info_Type_Cd1        AS  Sys_Stati_Info_Type_Cd  --系统统计信息类型代码
        ,'2026-08-27'         AS  Strt_Date               --开始日期
        ,Stati_Cont_Desc1               AS  Stati_Cont_Desc         --统计内容描述
        ,Stati_Qty_Info1                AS  Stati_Qty_Info          --统计数值信息
        ,Stati_Num_Info1                AS  Stati_Num_Info          --统计数量信息
        ,Stati_Subdv_Cd1                AS  Stati_Subdv_Cd          --统计细项代码
        ,'2099-12-31'                   AS  End_Date                --结束日期
        ,Data_Src_Cd1                   AS  Data_Src_Cd             --数据来源代码
        ,Task_Name1                     AS  Task_Name               --任务名
        ,'2026-08-28 09:44:29'           AS  Data_Time               --数据时间
        ,Real_Src_Tbl1                  AS  Real_Src_Tbl            --真实源表
        ,Src_Tbl1                       AS  Src_Tbl                 --源表
    FROM TEMP.T00_SYS_STATI_INFO_H_MID_ISM012 WHERE DATA_TYPE IN ('I','U')     --新增-I,变更-U
    UNION ALL
     --历史开链有变动和不存在当天的数据闭链
    SELECT
         Sys_Id                                                     --系统编号
        ,Sys_Stati_Info_Type_Cd                                     --系统统计信息类型代码
        ,Strt_Date                                                  --开始日期
        ,Stati_Cont_Desc                                            --统计内容描述
        ,Stati_Qty_Info                                             --统计数值信息
        ,Stati_Num_Info                                             --统计数量信息
        ,Stati_Subdv_Cd                                             --统计细项代码
        ,'2026-08-27'         AS  End_Date                --结束日期
        ,Data_Src_Cd                    AS  Data_Src_Cd             --数据来源代码
        ,Task_Name                      AS  Task_Name               --任务名
        ,'2026-08-28 09:44:29'           AS  Data_Time               --数据时间
        ,Real_Src_Tbl                   AS  Real_Src_Tbl            --真实源表
        ,Src_Tbl                        AS  Src_Tbl                 --源表
    FROM TEMP.T00_SYS_STATI_INFO_H_MID_ISM012 WHERE DATA_TYPE IN ('D','U')     --变更-U,删除-D
    UNION ALL
     --无变动的数据插回目标表
    SELECT
         Sys_Id                                                     --系统编号
        ,Sys_Stati_Info_Type_Cd                                     --系统统计信息类型代码
        ,Strt_Date                                                  --开始日期
        ,Stati_Cont_Desc                                            --统计内容描述
        ,Stati_Qty_Info                                             --统计数值信息
        ,Stati_Num_Info                                             --统计数量信息
        ,Stati_Subdv_Cd                                             --统计细项代码
        ,End_Date                                                   --结束日期
        ,Data_Src_Cd                                                --数据来源代码
        ,Task_Name                                                  --任务名
        ,Data_Time                                                  --数据时间
        ,Real_Src_Tbl                                               --真实源表
        ,Src_Tbl                                                    --源表
    FROM TEMP.T00_SYS_STATI_INFO_H_MID_ISM012 WHERE DATA_TYPE ='S'         --无变更-S
    ;
