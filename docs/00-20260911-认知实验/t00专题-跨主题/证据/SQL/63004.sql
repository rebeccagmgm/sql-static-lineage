-- task_id: 63004
-- hiveDb: PDATA_N
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_KNWLG_ANS_STAT_H_GKS011.py
-- observed_at: 2026-09-05T01:06:20.999Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_KNWLG_ANS_STAT_H(
     ANS_ID                    STRING COMMENT '答案编号'
    ,ANS_STAT_TYPE_CD          STRING COMMENT '答案状态类型代码'
    ,STRT_DATE                 STRING COMMENT '开始日期'
    ,ANS_STAT_CD               STRING COMMENT '答案状态代码'
    ,AUDI_STG                  STRING COMMENT '审核阶段'
    ,AUDI_USER                 STRING COMMENT '审核用户编号'
    ,END_DATE                  STRING COMMENT '结束日期'
    ,DATA_SRC_CD               STRING COMMENT '数据来源代码'
    ,TASK_NAME                 STRING COMMENT '任务名'
    ,DATA_TIME                 STRING COMMENT '数据时间'
)COMMENT '知识库答案状态历史'
PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
STORED AS ORC;

DROP TABLE IF EXISTS ${DB_TEMP}.${temp_tbl};
CREATE TABLE IF NOT EXISTS ${DB_TEMP}.${temp_tbl}
AS
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_GKS.M_ANSWER 知识库答案表]
-----------------------------------------------------------------------------------------------------
SELECT
       CONCAT('GKS009-',\`_ID\`)                            AS ANS_ID1              --答案编号
      ,'01'                                                 AS ANS_STAT_TYPE_CD1    --答案状态类型代码
      ,AUDITSTATUS                                          AS ANS_STAT_CD1         --答案状态代码
      ,AUDITSTAGE                                           AS AUDI_STG1            --审核阶段
      ,LOCKER                                               AS AUDI_USER1           --审核用户编号
      ,'${data_src_cd}'                                AS DATA_SRC_CD1         --数据来源代码
      ,'${src_table}'                                  AS SRC_TBL1             --源表
      ,UPPER('${filename}')                            AS TASK_NAME1           --任务名
  FROM   ${src_table} A
UNION ALL 
-----------------------------------------------------------------------------------------------------
--Group2: Source Table:[ODATA_N_GKS.M_ANSWER 知识库答案表]
-----------------------------------------------------------------------------------------------------
SELECT
       CONCAT('GKS009-',\`_ID\`)                            AS ANS_ID1              --答案编号
      ,'02'                                                 AS ANS_STAT_TYPE_CD1    --答案状态类型代码
      ,REPORTSTATUS                                         AS ANS_STAT_CD1         --答案状态代码
      ,''                                                   AS AUDI_STG1            --审核阶段
      ,''                                                   AS AUDI_USER1           --审核用户编号
      ,'${data_src_cd}'                                AS DATA_SRC_CD1         --数据来源代码
      ,'${src_table}'                                  AS SRC_TBL1             --源表
      ,UPPER('${filename}')                            AS TASK_NAME1           --任务名
  FROM   ${src_table} A

;

DROP TABLE IF EXISTS ${DB_TEMP}.${mid_tbl};
CREATE TABLE ${DB_TEMP}.${mid_tbl}
AS
SELECT
        A.*,B.*
       ,CASE WHEN A.ANS_ID IS NULL     AND B.ANS_ID1 IS NOT NULL THEN 'I'           --当天不存在历史的数据为新增
             WHEN A.ANS_ID IS NOT NULL AND B.ANS_ID1 IS NULL     THEN 'D'           --历史不存在当天的数据为删除
             WHEN A.ANS_ID IS NOT NULL AND B.ANS_ID1 IS NOT NULL AND
             (
                   NVL(A.ANS_STAT_CD               ,'') <>  NVL(B.ANS_STAT_CD1               ,'') 
                OR NVL(A.AUDI_STG                  ,'') <>  NVL(B.AUDI_STG1                  ,'') 
                OR NVL(A.AUDI_USER                 ,'') <>  NVL(B.AUDI_USER1                 ,'')
             ) THEN 'U'                                                        --当天和历史均存在,除主键外如有字段变更为变更
             ELSE 'S' END AS DATA_TYPE                                         --其他为无变更
FROM (
    SELECT  *
      FROM T00_KNWLG_ANS_STAT_H
     WHERE STRT_DATE <='${data_day_str}'
       AND END_DATE  > '${data_day_str}'
       AND SRC_TBL ='${src_table}' )A   --历史(昨日)开链数据
FULL OUTER JOIN ${DB_TEMP}.${temp_tbl} B               --当天的数据
ON      A.ANS_ID            =B.ANS_ID1
AND     A.ANS_STAT_TYPE_CD  =B.ANS_STAT_TYPE_CD1
;

-- querySql
INSERT OVERWRITE TABLE T00_KNWLG_ANS_STAT_H PARTITION(SRC_TBL)
 --剔除掉源表当日新增和当日闭链的数据
SELECT
       ANS_ID                    --答案编号
      ,ANS_STAT_TYPE_CD          --答案状态类型代码
      ,STRT_DATE                 --开始日期
      ,ANS_STAT_CD               --答案状态代码
      ,AUDI_STG                  --审核阶段
      ,AUDI_USER                 --审核用户编号
      ,END_DATE                  --结束日期
      ,DATA_SRC_CD               --数据来源代码
      ,TASK_NAME                 --任务名
      ,DATA_TIME                 --数据时间
      ,SRC_TBL                   --源表
  FROM T00_KNWLG_ANS_STAT_H
WHERE STRT_DATE !='${data_day_str}'
  AND END_DATE  !='${data_day_str}'
  AND SRC_TBL ='${src_table}' --只更新该源表分区数据
UNION ALL
 --当日闭链的数据还原
SELECT
       ANS_ID                    --答案编号
      ,ANS_STAT_TYPE_CD          --答案状态类型代码
      ,STRT_DATE                 --开始日期
      ,ANS_STAT_CD               --答案状态代码
      ,AUDI_STG                  --审核阶段
      ,AUDI_USER                 --审核用户编号
      ,'2099-12-31' AS END_DATE  --结束日期
      ,DATA_SRC_CD               --数据来源代码
      ,TASK_NAME                 --任务名
      ,DATA_TIME                 --数据时间
      ,SRC_TBL                   --源表
FROM T00_KNWLG_ANS_STAT_H
WHERE  END_DATE ='${data_day_str}'
  AND SRC_TBL ='${src_table}' --只更新该源表分区数据
;

INSERT OVERWRITE TABLE T00_KNWLG_ANS_STAT_H PARTITION(SRC_TBL)
  --历史闭链的无效数据插回目标表
SELECT
      ANS_ID                     AS ANS_ID                    --答案编号
     ,ANS_STAT_TYPE_CD           AS ANS_STAT_TYPE_CD          --答案状态类型代码
     ,STRT_DATE                  AS STRT_DATE                 --开始日期
     ,ANS_STAT_CD                AS ANS_STAT_CD               --答案状态代码
     ,AUDI_STG                   AS AUDI_STG                  --审核阶段
     ,AUDI_USER                  AS AUDI_USER                 --审核用户编号
     ,END_DATE                   AS END_DATE                  --结束日期
     ,DATA_SRC_CD                AS DATA_SRC_CD               --数据来源代码
     ,TASK_NAME                  AS TASK_NAME                 --任务名
     ,'${data_today}'       AS DATA_TIME                 --数据时间
     ,SRC_TBL                    AS SRC_TBL                   --源表
FROM    T00_KNWLG_ANS_STAT_H
WHERE   NOT(    STRT_DATE <='${data_day_str}'
            AND END_DATE  > '${data_day_str}')
AND SRC_TBL ='${src_table}'  --只回插该源表分区的数据

UNION ALL
--当天有变动和新增的数据开链
SELECT
      ANS_ID1                     AS ANS_ID                    --答案编号
     ,ANS_STAT_TYPE_CD1           AS ANS_STAT_TYPE_CD          --答案状态类型代码
     ,'${data_day_str}'      AS STRT_DATE                 --开始日期
     ,ANS_STAT_CD1                AS ANS_STAT_CD               --答案状态代码
     ,AUDI_STG1                   AS AUDI_STG                  --审核阶段
     ,AUDI_USER1                  AS AUDI_USER                 --审核用户编号
     ,'2099-12-31'                AS END_DATE                  --结束日期
     ,DATA_SRC_CD1                AS DATA_SRC_CD               --数据来源代码
     ,TASK_NAME1                  AS TASK_NAME                 --任务名
     ,'${data_today}'        AS DATA_TIME                 --数据时间
     ,SRC_TBL1                    AS SRC_TBL                   --源表
FROM  ${DB_TEMP}.${mid_tbl} WHERE DATA_TYPE IN ('I','U') --新增-I,变更-U

UNION ALL
--历史开链有变动和不存在当天的数据闭链
SELECT
      ANS_ID                     AS ANS_ID                    --答案编号
     ,ANS_STAT_TYPE_CD           AS ANS_STAT_TYPE_CD          --答案状态类型代码
     ,STRT_DATE                  AS STRT_DATE                 --开始日期
     ,ANS_STAT_CD                AS ANS_STAT_CD               --答案状态代码
     ,AUDI_STG                   AS AUDI_STG                  --审核阶段
     ,AUDI_USER                  AS AUDI_USER                 --审核用户编号
     ,'${data_day_str}'     AS END_DATE                  --结束日期
     ,DATA_SRC_CD                AS DATA_SRC_CD               --数据来源代码
     ,TASK_NAME                  AS TASK_NAME                 --任务名
     ,'${data_today}'       AS DATA_TIME                 --数据时间
     ,SRC_TBL                    AS SRC_TBL                   --源表
FROM   ${DB_TEMP}.${mid_tbl} WHERE DATA_TYPE IN ('D','U') --变更-U,删除-D

UNION ALL
--无变动的数据插回目标表
SELECT
      ANS_ID                     AS ANS_ID                    --答案编号
     ,ANS_STAT_TYPE_CD           AS ANS_STAT_TYPE_CD          --答案状态类型代码
     ,STRT_DATE                  AS STRT_DATE                 --开始日期
     ,ANS_STAT_CD                AS ANS_STAT_CD               --答案状态代码
     ,AUDI_STG                   AS AUDI_STG                  --审核阶段
     ,AUDI_USER                  AS AUDI_USER                 --审核用户编号
     ,END_DATE                   AS END_DATE                  --结束日期
     ,DATA_SRC_CD                AS DATA_SRC_CD               --数据来源代码
     ,TASK_NAME                  AS TASK_NAME                 --任务名
     ,DATA_TIME                  AS DATA_TIME                 --数据时间
     ,SRC_TBL                    AS SRC_TBL                   --源表
FROM   ${DB_TEMP}.${mid_tbl} WHERE DATA_TYPE ='S'         --无变更-S
;
