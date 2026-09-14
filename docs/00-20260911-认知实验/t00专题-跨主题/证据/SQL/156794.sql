-- task_id: 156794
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_PAPR_QSTN_RELA_H_CC2025.py
-- observed_at: 2026-09-05T01:07:03.366Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_PAPR_QSTN_RELA_H(
     Papr_Id                    STRING COMMENT '试卷编号'
    ,Papr_Qstn_Rela_Type_Cd     STRING COMMENT '试卷问题关系类型代码'
    ,Strt_Date                  STRING COMMENT '开始日期'
    ,Qstn_No                    STRING COMMENT '问题编号'
    ,Qstn_Bnk_Cate              STRING COMMENT '题库类别'
    ,End_Date                   STRING COMMENT '结束日期'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Time                  STRING COMMENT '数据时间'
    ,Real_Src_Tbl               STRING COMMENT '真实源表'
    ,Qstn_Disp_No               STRING COMMENT '问题展示编号'
)COMMENT '试卷试题关系历史'
PARTITIONED BY (SRC_TBL   STRING COMMENT '源表')
STORED AS ORC;

DROP TABLE IF EXISTS ${db_temp}.T00_PAPR_QSTN_RELA_H_TEMP_CC2025;
CREATE TABLE IF NOT EXISTS ${db_temp}.T00_PAPR_QSTN_RELA_H_TEMP_CC2025
AS
-----------------------------------------------------------------------------------------------------
--Group2: Source Table:[ODATA_N_CC2.C_CCB_PAPER_SHEET：问卷题目表]
-----------------------------------------------------------------------------------------------------
SELECT
     DISTINCT
     CONCAT('CC2030-',PAPER_ID,'-',PAPER_VERSION)   AS  Papr_Id1                --试卷编号
    ,'10'                                    AS  Papr_Qstn_Rela_Type_Cd1 --试卷问题关系类型代码       --试卷试题关系
    ,QUESTION_ID                             AS  Qstn_No1                --问题编号
    ,'CC2-QSTN-AUTO'                         AS  Qstn_Bnk_Cate1          --题库类别
    ,'${data_src_cd}'                   AS  Data_Src_Cd1            --数据来源代码
    ,'${src_table}'                     AS  Src_Tbl1                --源表
    ,'${filename}'                      AS  Task_Name1              --任务名
    ,'${src_table}'                     AS  Real_Src_Tbl1           --真实源表
    ,ORDER_NO                                AS  Qstn_Disp_No1           --问题展示编号
FROM (SELECT *FROM ODATA_N_CC2.C_CCB_PAPER_SHEET WHERE BUSI_DATE ='${data_day_str}') A

UNION ALL

-----------------------------------------------------------------------------------------------------
--Group3: Source Table:[ODATA_N_CC2.C_CCB_PAPER_SHEET：问卷题目表]
-----------------------------------------------------------------------------------------------------
SELECT
     DISTINCT
     CONCAT('CC2030-',PAPER_ID,'-',PAPER_VERSION)   AS  Papr_Id1                --试卷编号
    ,'10'                                    AS  Papr_Qstn_Rela_Type_Cd1 --试卷问题关系类型代码       --试卷试题关系
    ,QUESTION_ID                             AS  Qstn_No1                --问题编号
    ,'CC2-QSTN-MAN'                          AS  Qstn_Bnk_Cate1          --题库类别
    ,'${data_src_cd}'                   AS  Data_Src_Cd1            --数据来源代码
    ,'${src_table}'                     AS  Src_Tbl1                --源表
    ,'${filename}'                      AS  Task_Name1              --任务名
    ,'${src_table}'                     AS  Real_Src_Tbl1           --真实源表
    ,ORDER_NO                                AS  Qstn_Disp_No1           --问题展示编号
FROM (SELECT *FROM ODATA_N_CC2.C_CCB_PAPER_SHEET WHERE BUSI_DATE ='${data_day_str}') A
;

DROP TABLE IF EXISTS ${db_temp}.T00_PAPR_QSTN_RELA_H_MID_CC2025;
CREATE TABLE ${db_temp}.T00_PAPR_QSTN_RELA_H_MID_CC2025
AS
SELECT
       A.*,B.*
       ,CASE WHEN A.Papr_Id IS NULL     AND B.Papr_Id1 IS NOT NULL THEN 'I'           --当天不存在历史的数据为新增
             WHEN A.Papr_Id IS NOT NULL AND B.Papr_Id1 IS NULL THEN 'D'           --历史不存在当天的数据为删除
             WHEN A.Papr_Id IS NOT NULL AND B.Papr_Id1 IS NOT NULL AND
             (   COALESCE(A.Papr_Qstn_Rela_Type_Cd           ,'')   <> COALESCE(B.Papr_Qstn_Rela_Type_Cd1          ,'')
              OR COALESCE(A.Qstn_Disp_No                     ,'')   <> COALESCE(B.Qstn_Disp_No1                    ,'')
             ) THEN 'U'                                                        --当天和历史均存在,除主键外如有字段变更为变更
             ELSE 'S' END AS DATA_TYPE                                         --其他为无变更
FROM   (  SELECT
            *
          FROM  T00_PAPR_QSTN_RELA_H
          WHERE STRT_DATE <='${data_day_str}'
            AND END_DATE  > '${data_day_str}'
            AND SRC_TBL IN ('ODATA_N_CC2.C_CCB_PAPER_SHEET')  )A   --历史(昨日)开链数据
FULL OUTER JOIN ${db_temp}.T00_PAPR_QSTN_RELA_H_TEMP_CC2025 B               --当天的数据
ON   NVL(A.Papr_Id           ,'')= NVL(B.Papr_Id1                ,'')
AND  NVL(A.Qstn_Bnk_Cate     ,'')= NVL(B.Qstn_Bnk_Cate1          ,'')
AND  NVL(A.Qstn_No           ,'')= NVL(B.Qstn_No1                ,'')
AND  NVL(A.Qstn_Disp_No      ,'')= NVL(B.Qstn_Disp_No1           ,'')
;

-- querySql
INSERT OVERWRITE TABLE T00_PAPR_QSTN_RELA_H PARTITION(SRC_TBL)
 --剔除掉源表当日新增和当日闭链的数据
SELECT
     Papr_Id                               --试卷编号
    ,Papr_Qstn_Rela_Type_Cd                --试卷问题关系类型代码
    ,Strt_Date                             --开始日期
    ,Qstn_No                               --问题编号
    ,Qstn_Bnk_Cate                         --题库类别
    ,End_Date                              --结束日期
    ,Data_Src_Cd                           --数据来源代码
    ,Task_Name                             --任务名
    ,Data_Time                             --数据时间
    ,Real_Src_Tbl                          --真实源表
    ,Qstn_Disp_No                          --问题展示编号
    ,Src_Tbl                               --源表
FROM T00_PAPR_QSTN_RELA_H
WHERE STRT_DATE !='${data_day_str}'
  AND END_DATE  !='${data_day_str}'
  AND SRC_TBL IN ('ODATA_N_CC2.C_CCB_PAPER_SHEET')
UNION ALL
 --目标表为源表当日闭链的数据还原
SELECT
     Papr_Id                               --试卷编号
    ,Papr_Qstn_Rela_Type_Cd                --试卷问题关系类型代码
    ,Strt_Date                             --开始日期
    ,Qstn_No                               --问题编号
    ,Qstn_Bnk_Cate                         --题库类别
    ,'2099-12-31'  AS End_Date             --结束日期
    ,Data_Src_Cd                           --数据来源代码
    ,Task_Name                             --任务名
    ,Data_Time                             --数据时间
    ,Real_Src_Tbl                          --真实源表
    ,Qstn_Disp_No                          --问题展示编号
    ,Src_Tbl                               --源表
FROM T00_PAPR_QSTN_RELA_H
WHERE  END_DATE ='${data_day_str}'
  AND  SRC_TBL IN ('ODATA_N_CC2.C_CCB_PAPER_SHEET')
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

INSERT OVERWRITE TABLE T00_PAPR_QSTN_RELA_H PARTITION(SRC_TBL)
  --历史闭链的无效数据插回目标表
SELECT
     Papr_Id                                                    --试卷编号
    ,Papr_Qstn_Rela_Type_Cd                                     --试卷问题关系类型代码
    ,Strt_Date                                                  --开始日期
    ,Qstn_No                                                    --问题编号
    ,Qstn_Bnk_Cate                                              --题库类别
    ,End_Date                                                   --结束日期
    ,Data_Src_Cd                                                --数据来源代码
    ,Task_Name                                                  --任务名
    ,Data_Time                                                  --数据时间
    ,Real_Src_Tbl                                               --真实源表
    ,Qstn_Disp_No                                               --问题展示编号
    ,Src_Tbl                                                    --源表
FROM T00_PAPR_QSTN_RELA_H
WHERE NOT(    STRT_DATE <='${data_day_str}'
          AND END_DATE  > '${data_day_str}'   )
  AND SRC_TBL IN ('ODATA_N_CC2.C_CCB_PAPER_SHEET')  --只插入目标表分区字段为该表的数据
UNION ALL
 --当天有变动和新增的数据开链
SELECT
     Papr_Id1                       AS  Papr_Id                 --试卷编号
    ,Papr_Qstn_Rela_Type_Cd1        AS  Papr_Qstn_Rela_Type_Cd  --试卷问题关系类型代码
    ,'${data_day_str}'         AS  Strt_Date               --开始日期
    ,Qstn_No1                       AS  Qstn_No                 --问题编号
    ,Qstn_Bnk_Cate1                 AS  Qstn_Bnk_Cate           --题库类别
    ,'2099-12-31'                   AS  End_Date                --结束日期
    ,Data_Src_Cd1                   AS  Data_Src_Cd             --数据来源代码
    ,Task_Name1                     AS  Task_Name               --任务名
    ,'${data_today}'           AS  Data_Time               --数据时间
    ,Real_Src_Tbl1                  AS  Real_Src_Tbl            --真实源表
    ,Qstn_Disp_No1                  AS  Qstn_Disp_No            --问题展示编号
    ,Src_Tbl1                       AS  Src_Tbl                 --源表
FROM ${db_temp}.T00_PAPR_QSTN_RELA_H_MID_CC2025 WHERE DATA_TYPE IN ('I','U')     --新增-I,变更-U
UNION ALL
 --历史开链有变动和不存在当天的数据闭链
SELECT
     Papr_Id                                                    --试卷编号
    ,Papr_Qstn_Rela_Type_Cd                                     --试卷问题关系类型代码
    ,Strt_Date                                                  --开始日期
    ,Qstn_No                                                    --问题编号
    ,Qstn_Bnk_Cate                                              --题库类别
    ,'${data_day_str}'         AS  End_Date                --结束日期
    ,Data_Src_Cd                    AS  Data_Src_Cd             --数据来源代码
    ,Task_Name                      AS  Task_Name               --任务名
   ,'${data_today}'            AS  Data_Time               --数据时间
    ,Real_Src_Tbl                   AS  Real_Src_Tbl            --真实源表
    ,Qstn_Disp_No                   AS  Qstn_Disp_No            --问题展示编号
    ,Src_Tbl                        AS  Src_Tbl                 --源表
FROM ${db_temp}.T00_PAPR_QSTN_RELA_H_MID_CC2025 WHERE DATA_TYPE IN ('D','U')     --变更-U,删除-D
UNION ALL
 --无变动的数据插回目标表
SELECT
     Papr_Id                                                    --试卷编号
    ,Papr_Qstn_Rela_Type_Cd                                     --试卷问题关系类型代码
    ,Strt_Date                                                  --开始日期
    ,Qstn_No                                                    --问题编号
    ,Qstn_Bnk_Cate                                              --题库类别
    ,End_Date                                                   --结束日期
    ,Data_Src_Cd                                                --数据来源代码
    ,Task_Name                                                  --任务名
    ,Data_Time                                                  --数据时间
    ,Real_Src_Tbl                                               --真实源表
    ,Qstn_Disp_No                                               --问题展示编号
    ,Src_Tbl                                                    --源表
FROM ${db_temp}.T00_PAPR_QSTN_RELA_H_MID_CC2025 WHERE DATA_TYPE ='S'         --无变更-S
;
