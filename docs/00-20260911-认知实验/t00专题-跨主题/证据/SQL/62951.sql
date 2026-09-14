-- task_id: 62951
-- hiveDb: PDATA_N
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_KNWLG_ANS_GKS011.py
-- observed_at: 2026-09-05T01:06:20.687Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_KNWLG_ANS(
     ANS_ID                    STRING COMMENT '答案编号'
    ,SRC_ANS_ID                STRING COMMENT '源答案编号'
    ,ANS_CATE_CD               STRING COMMENT '答案类别代码'
    ,QSTN_ID                   STRING COMMENT '问题编号'
    ,ANS_CONT                  STRING COMMENT '答案内容'
    ,ANS_AUTH                  STRING COMMENT '答案作者'
    ,ANS_CLAS                  STRING COMMENT '答案分类'
    ,SCOR                      STRING COMMENT '分数'
    ,ANS_STAT_CD               STRING COMMENT '答案状态代码'
    ,CREATE_TIME               STRING COMMENT '创建时间'
    ,LAST_UPD_TIME             STRING COMMENT '最后更新时间'
    ,UPD_AUTH                  STRING COMMENT '更新作者'
    ,DEL_FLAG                  STRING COMMENT '删除标志'
    ,DEL_DATE                  STRING COMMENT '删除日期'
    ,DATA_SRC_CD               STRING COMMENT '数据来源代码'
    ,TASK_NAME                 STRING COMMENT '任务名'
    ,DATA_ETL_DATE             STRING COMMENT '数据加载日期'
    ,DATA_UPT_DATE             STRING COMMENT '数据更新日期'
    ,DATA_TIME                 STRING COMMENT '数据时间'
)COMMENT '知识库答案'
PARTITIONED BY(SRC_TBL STRING COMMENT '源表')
STORED AS ORC;

DROP TABLE IF EXISTS T00_KNWLG_ANS_GROUP1_TEMP;
CREATE TABLE IF NOT EXISTS T00_KNWLG_ANS_GROUP1_TEMP
AS
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_GKS.M_ANSWER:知识库答案表]
-----------------------------------------------------------------------------------------------------
SELECT
       CONCAT('GKS009-',\`_ID\`)                           AS ANS_ID              --答案编号
      ,\`_ID\`                                             AS SRC_ANS_ID          --源答案编号
      ,'GKS-KNWLG'                                         AS ANS_CATE_CD         --答案类别代码
      ,CASE WHEN NVL(QUESTIONID,'')<>'' THEN CONCAT('GKS008-',QUESTIONID)           
            ELSE NULL 
        END                                                AS QSTN_ID             --问题编号
      ,ANSWER                                              AS ANS_CONT            --答案内容
      ,AUTHOR                                              AS ANS_AUTH            --答案作者
      ,CATEGORY                                            AS ANS_CLAS            --答案分类
      ,SCORE                                               AS SCOR                --分数
      ,AUDITSTATUS                                         AS ANS_STAT_CD         --答案状态代码
      ,CREATEDAT                                           AS CREATE_TIME         --创建时间
      ,MODIFIEDAT                                          AS LAST_UPD_TIME       --最后更新时间
      ,UPDATEAUTHOR                                        AS UPD_AUTH            --更新作者
      ,'GKS'                                               AS DATA_SRC_CD         --数据来源代码
      ,'ODATA_N_GKS.M_ANSWER'                              AS SRC_TBL             --源表
      ,UPPER('${filename}')                           AS TASK_NAME           --任务名
      ,'${data_day_str}'                              AS DATA_ETL_DATE       --数据加载日期
      ,'${data_day_str}'                            AS DATA_UPT_DATE       --数据更新日期
FROM  (SELECT * FROM ODATA_N_GKS.M_ANSWER )A
;

DROP TABLE IF EXISTS T00_KNWLG_ANS_GROUP1_MID;
CREATE TABLE IF NOT EXISTS T00_KNWLG_ANS_GROUP1_MID
AS
SELECT
         A.*
        ,B.ANS_ID                     AS ANS_ID1                    --答案编号1
        ,B.SRC_ANS_ID                 AS SRC_ANS_ID1                --源答案编号1
        ,B.ANS_CATE_CD                AS ANS_CATE_CD1               --答案类别代码1
        ,B.QSTN_ID                    AS QSTN_ID1                   --问题编号1
        ,B.ANS_CONT                   AS ANS_CONT1                  --答案内容1
        ,B.ANS_AUTH                   AS ANS_AUTH1                  --答案作者1
        ,B.ANS_CLAS                   AS ANS_CLAS1                  --答案分类1
        ,B.SCOR                       AS SCOR1                      --分数1
        ,B.ANS_STAT_CD                AS ANS_STAT_CD1               --答案状态代码1
        ,B.CREATE_TIME                AS CREATE_TIME1               --创建时间1
        ,B.LAST_UPD_TIME              AS LAST_UPD_TIME1             --最后更新时间1
        ,B.UPD_AUTH                   AS UPD_AUTH1                  --更新作者1
        ,B.DATA_SRC_CD                AS DATA_SRC_CD1               --数据来源代码1
        ,B.SRC_TBL                    AS SRC_TBL1                   --源表1
        ,B.TASK_NAME                  AS TASK_NAME1                 --任务名1
        ,B.DATA_ETL_DATE              AS DATA_ETL_DATE1             --数据加载日期1
        ,B.DATA_UPT_DATE              AS DATA_UPT_DATE1             --数据更新日期1
        ,CASE WHEN A.ANS_ID IS NULL     AND B.ANS_ID IS NOT NULL THEN 'I' --新增
              WHEN A.ANS_ID IS NOT NULL AND B.ANS_ID IS NULL     THEN 'D' --删除
              WHEN A.ANS_ID IS NOT NULL AND B.ANS_ID IS NOT NULL AND (
              COALESCE(A.SRC_ANS_ID          ,'') <> COALESCE(B.SRC_ANS_ID          ,'') 
           OR COALESCE(A.ANS_CATE_CD         ,'') <> COALESCE(B.ANS_CATE_CD         ,'') 
           OR COALESCE(A.QSTN_ID             ,'') <> COALESCE(B.QSTN_ID             ,'') 
           OR COALESCE(A.ANS_CONT            ,'') <> COALESCE(B.ANS_CONT            ,'') 
           OR COALESCE(A.ANS_AUTH            ,'') <> COALESCE(B.ANS_AUTH            ,'') 
           OR COALESCE(A.ANS_CLAS            ,'') <> COALESCE(B.ANS_CLAS            ,'') 
           OR COALESCE(A.SCOR                ,'') <> COALESCE(B.SCOR                ,'') 
           OR COALESCE(A.ANS_STAT_CD         ,'') <> COALESCE(B.ANS_STAT_CD         ,'') 
           OR COALESCE(A.CREATE_TIME         ,'') <> COALESCE(B.CREATE_TIME         ,'') 
           OR COALESCE(A.LAST_UPD_TIME       ,'') <> COALESCE(B.LAST_UPD_TIME       ,'') 
           OR COALESCE(A.UPD_AUTH            ,'') <> COALESCE(B.UPD_AUTH            ,'') 
            )
            THEN     'U' --变更
            ELSE     'S' --无变更
            END                         AS DATA_TYPE
FROM  (SELECT * FROM T00_KNWLG_ANS WHERE SRC_TBL ='ODATA_N_GKS.M_ANSWER')A --只对比ODATA_N_GKS.M_ANSWER表的数据
FULL OUTER JOIN T00_KNWLG_ANS_GROUP1_TEMP B
 ON    A.ANS_ID=B.ANS_ID

;

-- querySql
INSERT OVERWRITE TABLE T00_KNWLG_ANS PARTITION (SRC_TBL )
 --剔除源表当日新增的数据
SELECT
 *
 FROM T00_KNWLG_ANS
WHERE DATA_ETL_DATE !='${data_day_str}' 
  AND SRC_TBL ='ODATA_N_GKS.M_ANSWER'
;

INSERT OVERWRITE TABLE T00_KNWLG_ANS PARTITION (SRC_TBL ='ODATA_N_GKS.M_ANSWER')
SELECT
      ANS_ID                     AS ANS_ID                    --答案编号
     ,SRC_ANS_ID                 AS SRC_ANS_ID                --源答案编号
     ,ANS_CATE_CD                AS ANS_CATE_CD               --答案类别代码
     ,QSTN_ID                    AS QSTN_ID                   --问题编号
     ,ANS_CONT                   AS ANS_CONT                  --答案内容
     ,ANS_AUTH                   AS ANS_AUTH                  --答案作者
     ,ANS_CLAS                   AS ANS_CLAS                  --答案分类
     ,SCOR                       AS SCOR                      --分数
     ,ANS_STAT_CD                AS ANS_STAT_CD               --答案状态代码
     ,CREATE_TIME                AS CREATE_TIME               --创建时间
     ,LAST_UPD_TIME              AS LAST_UPD_TIME             --最后更新时间
     ,UPD_AUTH                   AS UPD_AUTH                  --更新作者
     ,'0'                        AS DEL_FLAG                  --删除标志
     ,''                         AS DEL_DATE                  --删除日期
     ,DATA_SRC_CD                AS DATA_SRC_CD               --数据来源代码
     ,TASK_NAME                  AS TASK_NAME                 --任务名
     ,DATA_ETL_DATE              AS DATA_ETL_DATE             --数据加载日期
     ,DATA_UPT_DATE              AS DATA_UPT_DATE             --数据更新日期
     ,DATA_TIME                  AS DATA_TIME                 --数据时间
FROM T00_KNWLG_ANS_GROUP1_MID WHERE DATA_TYPE='S' --插入无变化的数据
UNION ALL
SELECT
      ANS_ID1                     AS ANS_ID                    --答案编号
     ,SRC_ANS_ID1                 AS SRC_ANS_ID                --源答案编号
     ,ANS_CATE_CD1                AS ANS_CATE_CD               --答案类别代码
     ,QSTN_ID1                    AS QSTN_ID                   --问题编号
     ,ANS_CONT1                   AS ANS_CONT                  --答案内容
     ,ANS_AUTH1                   AS ANS_AUTH                  --答案作者
     ,ANS_CLAS1                   AS ANS_CLAS                  --答案分类
     ,SCOR1                       AS SCOR                      --分数
     ,ANS_STAT_CD1                AS ANS_STAT_CD               --答案状态代码
     ,CREATE_TIME1                AS CREATE_TIME               --创建时间
     ,LAST_UPD_TIME1              AS LAST_UPD_TIME             --最后更新时间
     ,UPD_AUTH1                   AS UPD_AUTH                  --更新作者
     ,'0'                         AS DEL_FLAG                  --删除标志
     ,''                          AS DEL_DATE                  --删除日期
     ,DATA_SRC_CD1                AS DATA_SRC_CD               --数据来源代码
     ,TASK_NAME1                  AS TASK_NAME                 --任务名
     ,DATA_ETL_DATE               AS DATA_ETL_DATE             --数据加载日期
     ,DATA_UPT_DATE1              AS DATA_UPT_DATE             --数据更新日期
     ,'${data_today}'        AS DATA_TIME                 --数据时间
FROM T00_KNWLG_ANS_GROUP1_MID WHERE DATA_TYPE='U'  --有变更的数据取变更的值
UNION ALL
SELECT
      ANS_ID1                     AS ANS_ID                    --答案编号
     ,SRC_ANS_ID1                 AS SRC_ANS_ID                --源答案编号
     ,ANS_CATE_CD1                AS ANS_CATE_CD               --答案类别代码
     ,QSTN_ID1                    AS QSTN_ID                   --问题编号
     ,ANS_CONT1                   AS ANS_CONT                  --答案内容
     ,ANS_AUTH1                   AS ANS_AUTH                  --答案作者
     ,ANS_CLAS1                   AS ANS_CLAS                  --答案分类
     ,SCOR1                       AS SCOR                      --分数
     ,ANS_STAT_CD1                AS ANS_STAT_CD               --答案状态代码
     ,CREATE_TIME1                AS CREATE_TIME               --创建时间
     ,LAST_UPD_TIME1              AS LAST_UPD_TIME             --最后更新时间
     ,UPD_AUTH1                   AS UPD_AUTH                  --更新作者
     ,'0'                         AS DEL_FLAG                  --删除标志
     ,''                          AS DEL_DATE                  --删除日期
     ,DATA_SRC_CD1                AS DATA_SRC_CD               --数据来源代码
     ,TASK_NAME1                  AS TASK_NAME                 --任务名
     ,DATA_ETL_DATE1              AS DATA_ETL_DATE             --数据加载日期
     ,DATA_UPT_DATE1              AS DATA_UPT_DATE             --数据更新日期
     ,'${data_today}'        AS DATA_TIME                 --数据时间
FROM T00_KNWLG_ANS_GROUP1_MID WHERE DATA_TYPE='I'  --插入新增的数据
UNION ALL
SELECT
      ANS_ID                     AS ANS_ID                    --答案编号
     ,SRC_ANS_ID                 AS SRC_ANS_ID                --源答案编号
     ,ANS_CATE_CD                AS ANS_CATE_CD               --答案类别代码
     ,QSTN_ID                    AS QSTN_ID                   --问题编号
     ,ANS_CONT                   AS ANS_CONT                  --答案内容
     ,ANS_AUTH                   AS ANS_AUTH                  --答案作者
     ,ANS_CLAS                   AS ANS_CLAS                  --答案分类
     ,SCOR                       AS SCOR                      --分数
     ,ANS_STAT_CD                AS ANS_STAT_CD               --答案状态代码
     ,CREATE_TIME                AS CREATE_TIME               --创建时间
     ,LAST_UPD_TIME              AS LAST_UPD_TIME             --最后更新时间
     ,UPD_AUTH                   AS UPD_AUTH                  --更新作者
     ,'1'                        AS DEL_FLAG                  --删除标志
     ,CASE WHEN DEL_DATE !=''
           THEN DEL_DATE
           ELSE '${data_day_str}'
       END                       AS DEL_DATE                  --删除日期
     ,DATA_SRC_CD                                             --数据来源代码
     ,TASK_NAME                                               --任务名
     ,DATA_ETL_DATE                                           --数据加载日期
     ,CASE WHEN DEL_DATE !=''
           THEN DATA_UPT_DATE
           ELSE '${data_day_str}'
       END                       AS DATA_UPT_DATE             --数据更新日期
     ,CASE WHEN DEL_DATE !=''
           THEN DATA_TIME
           ELSE '${data_today}'
       END                       AS DATA_TIME                 --数据时间
FROM T00_KNWLG_ANS_GROUP1_MID WHERE DATA_TYPE='D' --插入删除的数据
;
