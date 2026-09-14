-- task_id: 240240
-- hiveDb: 
-- source: HORAE_LOG
-- sqlStatus: AVAILABLE
-- scriptPath: 
-- observed_at: 2026-09-05T07:36:36.845Z

-- createSql
set hive.exec.dynamic.partition=true;
set hive.exec.dynamic.partition.mode=nonstrict;
set hive.auto.convert.join=false;
use pdata_n;

    CREATE TABLE IF NOT EXISTS T00_STRG_INFO(
         Strg_Id                    STRING COMMENT '策略编号'
        ,Strg_Name                  STRING COMMENT '策略名称'
        ,Strg_Cate_Cd               STRING COMMENT '策略类别代码'
        ,Strg_Kind_Cd               STRING COMMENT '策略种类代码'
        ,Strg_Stat_Cd               STRING COMMENT '策略状态代码'
        ,Strg_Mode_Cd               STRING COMMENT '策略模式代码'
        ,Vld_Date                   STRING COMMENT '生效日期'
        ,Due_Date                   STRING COMMENT '到期日期'
        ,Strg_Cont                  STRING COMMENT '策略内容'
        ,Remark                     STRING COMMENT '备注'
        ,Del_Flag                   STRING COMMENT '删除标志'
        ,Del_Date                   STRING COMMENT '删除日期'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Etl_Date              STRING COMMENT '数据加载日期'
        ,Data_Upt_Date              STRING COMMENT '数据更新日期'
        ,Data_Time                  STRING COMMENT '数据时间'
        ,Real_Src_Tbl               STRING COMMENT '真实源表'
    )COMMENT '策略信息'
    PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
    STORED AS ORC;

set hive.exec.dynamic.partition=true;
set hive.exec.dynamic.partition.mode=nonstrict;
set hive.auto.convert.join=false;
use pdata_n;

    
    DROP TABLE IF EXISTS TEMP.T00_STRG_INFO_TEMP_FS2003;
    CREATE TABLE IF NOT EXISTS TEMP.T00_STRG_INFO_TEMP_FS2003
    AS
    -----------------------------------------------------------------------------------------------------
    --GROUP3.: SOURCE TABLE:[ODATA_N_FS2.Q_DTSSTRATEGYLISTTABLE: 策略总表]
    -----------------------------------------------------------------------------------------------------
    SELECT
         CONCAT('FS2003-',STRATEGYID)             AS  Strg_Id                 --策略编号
        ,STRATEGYNAME                             AS  Strg_Name               --策略名称
        ,'02'                                     AS  Strg_Cate_Cd            --策略类别代码
        ,''                                       AS  Strg_Kind_Cd            --策略种类代码
        ,''                                       AS  Strg_Stat_Cd            --策略状态代码
        ,''                                       AS  Strg_Mode_Cd            --策略模式代码
        ,SUBSTR(CREATETIME,1,10)                  AS  Vld_Date                --生效日期
        ,''                                       AS  Due_Date                --到期日期
        ,''                                       AS  Strg_Cont               --策略内容
        ,DESCRIPTION                              AS  Remark                  --备注
        ,'FS2'                    AS  Data_Src_Cd             --数据来源代码
        ,'ODATA_N_FS2.Q_DTSSTRATEGYLISTTABLE'                      AS  Src_Tbl                 --源表
        ,'PDATA_N.T00_STRG_INFO_FS2003'                       AS  Task_Name               --任务名
        ,'2026-08-27'                   AS  Data_Etl_Date           --数据加载日期
        ,'2026-08-27'                   AS  Data_Upt_Date           --数据更新日期
        ,'ODATA_N_FS2.Q_DTSSTRATEGYLISTTABLE'                      AS  Real_Src_Tbl            --真实源表
    FROM ODATA_N_FS2.Q_DTSSTRATEGYLISTTABLE  WHERE BUSI_DATE='2026-08-27' AND STRATEGYTYPE = '1'

    ;

set hive.exec.dynamic.partition=true;
set hive.exec.dynamic.partition.mode=nonstrict;
set hive.auto.convert.join=false;
use pdata_n;

    DROP TABLE IF EXISTS TEMP.T00_STRG_INFO_MID_FS2003;
    CREATE TABLE IF NOT EXISTS TEMP.T00_STRG_INFO_MID_FS2003
    AS
    SELECT
             A.*
            ,B.Strg_Id                    AS Strg_Id1                  --策略编号
            ,B.Strg_Name                  AS Strg_Name1                --策略名称
            ,B.Strg_Cate_Cd               AS Strg_Cate_Cd1             --策略类别代码
            ,B.Strg_Kind_Cd               AS Strg_Kind_Cd1             --策略种类代码
            ,B.Strg_Stat_Cd               AS Strg_Stat_Cd1             --策略状态代码
            ,B.Strg_Mode_Cd               AS Strg_Mode_Cd1             --策略模式代码
            ,B.Vld_Date                   AS Vld_Date1                 --生效日期
            ,B.Due_Date                   AS Due_Date1                 --到期日期
            ,B.Strg_Cont                  AS Strg_Cont1                --策略内容
            ,B.Remark                     AS Remark1                   --备注
            ,B.DATA_SRC_CD                AS DATA_SRC_CD1              --数据来源代码
            ,B.SRC_TBL                    AS SRC_TBL1                  --源表
            ,B.TASK_NAME                  AS TASK_NAME1                --任务名
            ,B.DATA_ETL_DATE              AS DATA_ETL_DATE1            --数据加载日期
            ,B.DATA_UPT_DATE              AS DATA_UPT_DATE1            --数据更新日期
            ,B.Real_Src_Tbl               AS Real_Src_Tbl1             --真实源表
            ,CASE WHEN A.Strg_Id IS NULL     AND B.Strg_Id IS NOT NULL THEN 'I' --新增
                  WHEN A.Strg_Id IS NOT NULL AND B.Strg_Id IS NULL THEN 'D' --删除
                  WHEN A.Strg_Id IS NOT NULL AND B.Strg_Id IS NOT NULL AND (
                     COALESCE(A.Strg_Name               ,'') <> COALESCE(B.Strg_Name               ,'')
                  OR COALESCE(A.Strg_Cate_Cd            ,'') <> COALESCE(B.Strg_Cate_Cd            ,'')
                  OR COALESCE(A.Strg_Kind_Cd            ,'') <> COALESCE(B.Strg_Kind_Cd            ,'')
                  OR COALESCE(A.Strg_Stat_Cd            ,'') <> COALESCE(B.Strg_Stat_Cd            ,'')
                  OR COALESCE(A.Strg_Mode_Cd            ,'') <> COALESCE(B.Strg_Mode_Cd            ,'')
                  OR COALESCE(A.Vld_Date                ,'') <> COALESCE(B.Vld_Date                ,'')
                  OR COALESCE(A.Due_Date                ,'') <> COALESCE(B.Due_Date                ,'')
                  OR COALESCE(A.Strg_Cont               ,'') <> COALESCE(B.Strg_Cont               ,'')
                  OR COALESCE(A.Remark                  ,'') <> COALESCE(B.Remark                  ,'')
             ) THEN 'U' --变更
                 ELSE 'S' --无变更
                 END                 AS DATA_TYPE              --数据类型
    FROM  (SELECT * FROM T00_STRG_INFO 
                    WHERE SRC_TBL='ODATA_N_FS2.Q_DTSSTRATEGYLISTTABLE')A
    FULL OUTER JOIN TEMP.T00_STRG_INFO_TEMP_FS2003 B
    ON    A.Strg_Id=B.Strg_Id
    ;

-- querySql
INSERT OVERWRITE TABLE T00_STRG_INFO PARTITION(SRC_TBL)
     --剔除当日新增的数据
    SELECT DISTINCT
         Strg_Id                                       --策略编号
        ,Strg_Name                                     --策略名称
        ,Strg_Cate_Cd                                  --策略类别代码
        ,Strg_Kind_Cd                                  --策略种类代码
        ,Strg_Stat_Cd                                  --策略状态代码
        ,Strg_Mode_Cd                                  --策略模式代码
        ,Vld_Date                                      --生效日期
        ,Due_Date                                      --到期日期
        ,Strg_Cont                                     --策略内容
        ,Remark                                        --备注
        ,Del_Flag                                      --删除标志
        ,Del_Date                                      --删除日期
        ,Data_Src_Cd                                   --数据来源代码
        ,Task_Name                                     --任务名
        ,Data_Etl_Date                                 --数据加载日期
        ,Data_Upt_Date                                 --数据更新日期
        ,Data_Time                                     --数据时间
        ,Real_Src_Tbl                                  --真实源表
        ,Src_Tbl                                       --源表
      FROM T00_STRG_INFO
      WHERE DATA_ETL_DATE !='2026-08-27' 
        AND SRC_TBL = 'ODATA_N_FS2.Q_DTSSTRATEGYLISTTABLE'
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
    
    INSERT OVERWRITE TABLE T00_STRG_INFO PARTITION(SRC_TBL)
    SELECT
         Strg_Id                                       --策略编号
        ,Strg_Name                                     --策略名称
        ,Strg_Cate_Cd                                  --策略类别代码
        ,Strg_Kind_Cd                                  --策略种类代码
        ,Strg_Stat_Cd                                  --策略状态代码
        ,Strg_Mode_Cd                                  --策略模式代码
        ,Vld_Date                                      --生效日期
        ,Due_Date                                      --到期日期
        ,Strg_Cont                                     --策略内容
        ,Remark                                        --备注
        ,'0'                     AS Del_Flag           --删除标志
        ,''                      AS Del_Date           --删除日期
        ,Data_Src_Cd                                   --数据来源代码
        ,Task_Name                                     --任务名
        ,Data_Etl_Date                                 --数据加载日期
        ,Data_Upt_Date                                 --数据更新日期
        ,Data_Time                                     --数据时间
        ,Real_Src_Tbl                                  --真实源表
        ,Src_Tbl                                       --源表
    FROM TEMP.T00_STRG_INFO_MID_FS2003 WHERE DATA_TYPE='S'  --插入无变化的数据
    UNION ALL
    SELECT
         Strg_Id1                                     AS Strg_Id                  --策略编号
        ,Strg_Name1                                   AS Strg_Name                --策略名称
        ,Strg_Cate_Cd1                                AS Strg_Cate_Cd             --策略类别代码
        ,Strg_Kind_Cd1                                AS Strg_Kind_Cd             --策略种类代码
        ,Strg_Stat_Cd1                                AS Strg_Stat_Cd             --策略状态代码
        ,Strg_Mode_Cd1                                AS Strg_Mode_Cd             --策略模式代码
        ,Vld_Date1                                    AS Vld_Date                 --生效日期
        ,Due_Date1                                    AS Due_Date                 --到期日期
        ,Strg_Cont1                                   AS Strg_Cont                --策略内容
        ,Remark1                                      AS Remark                   --备注
        ,'0'                                          AS Del_Flag                 --删除标志
        ,''                                           AS Del_Date                 --删除日期
        ,Data_Src_Cd1                                 AS Data_Src_Cd              --数据来源代码
        ,Task_Name1                                   AS Task_Name                --任务名
        ,Data_Etl_Date                                AS Data_Etl_Date            --数据加载日期
        ,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
        ,'2026-08-28 08:52:19'                         AS Data_Time                --数据时间
        ,Real_Src_Tbl1                                AS Real_Src_Tbl             --真实源表
        ,Src_Tbl1                                     AS Src_Tbl                  --源表
    FROM TEMP.T00_STRG_INFO_MID_FS2003  WHERE DATA_TYPE='U'   --有变更的数据取变更的值
    UNION ALL
    SELECT
         Strg_Id1                                     AS Strg_Id                  --策略编号
        ,Strg_Name1                                   AS Strg_Name                --策略名称
        ,Strg_Cate_Cd1                                AS Strg_Cate_Cd             --策略类别代码
        ,Strg_Kind_Cd1                                AS Strg_Kind_Cd             --策略种类代码
        ,Strg_Stat_Cd1                                AS Strg_Stat_Cd             --策略状态代码
        ,Strg_Mode_Cd1                                AS Strg_Mode_Cd             --策略模式代码
        ,Vld_Date1                                    AS Vld_Date                 --生效日期
        ,Due_Date1                                    AS Due_Date                 --到期日期
        ,Strg_Cont1                                   AS Strg_Cont                --策略内容
        ,Remark1                                      AS Remark                   --备注
        ,'0'                                          AS Del_Flag                 --删除标志
        ,''                                           AS Del_Date                 --删除日期
        ,Data_Src_Cd1                                 As Data_Src_Cd              --数据来源代码
        ,Task_Name1                                   As Task_Name                --任务名
        ,Data_Etl_Date1                               As Data_Etl_Date            --数据加载日期
        ,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
        ,'2026-08-28 08:52:19'                         AS Data_Time                --数据时间
        ,Real_Src_Tbl1                                AS Real_Src_Tbl             --真实源表
        ,Src_Tbl1                                     AS Src_Tbl                  --源表
    FROM TEMP.T00_STRG_INFO_MID_FS2003  WHERE DATA_TYPE='I'   --插入新增的数据
    UNION ALL
    SELECT
         Strg_Id                                                 --策略编号
        ,Strg_Name                                               --策略名称
        ,Strg_Cate_Cd                                            --策略类别代码
        ,Strg_Kind_Cd                                            --策略种类代码
        ,Strg_Stat_Cd                                            --策略状态代码
        ,Strg_Mode_Cd                                            --策略模式代码
        ,Vld_Date                                                --生效日期
        ,Due_Date                                                --到期日期
        ,Strg_Cont                                               --策略内容
        ,Remark                                                  --备注
        ,'1'                              AS Del_Flag            --删除标志
        ,CASE WHEN Del_Date !=''
                THEN Del_Date
              ELSE '2026-08-27'
              END                         AS Del_Date            --删除日期
        ,Data_Src_Cd                                            --数据来源代码
        ,Task_Name                                              --任务名
        ,Data_Etl_Date                                          --数据加载日期
        ,CASE WHEN Del_Date !=''
              THEN Data_Upt_Date
              ELSE '2026-08-27'
             END                         AS Data_Upt_Date       --数据更新日期
        ,CASE WHEN Del_Date !=''
               THEN Data_Time
             ELSE '2026-08-28 08:52:19'
             END                         AS Data_Time           --数据时间
        ,Real_Src_Tbl                                            --真实源表
        ,Src_Tbl                                                 --源表
    FROM TEMP.T00_STRG_INFO_MID_FS2003 WHERE DATA_TYPE='D'  --插入删除的数据
    ;
