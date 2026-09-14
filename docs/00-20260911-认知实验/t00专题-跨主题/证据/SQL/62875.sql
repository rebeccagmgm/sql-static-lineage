-- task_id: 62875
-- hiveDb: PDATA_N
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_KNWLG_QSTN_LIST_GKS010.py
-- observed_at: 2026-09-05T01:06:20.289Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_KNWLG_QSTN_LIST(
     QSTN_ID                   STRING COMMENT '问题编号'
    ,SRC_QSTN_ID               STRING COMMENT '源问题编号'
    ,QSTN_CATE_CD              STRING COMMENT '问题类别代码'
    ,QSTN_CLS                  STRING COMMENT '问题分类'
    ,QSTN_CONT                 STRING COMMENT '问题内容'
    ,AUTH                      STRING COMMENT '作者'
    ,LBL                       STRING COMMENT '标签符号'
    ,CREATE_TIME               STRING COMMENT '创建时间'
    ,LAST_UPD_TIME             STRING COMMENT '最后更新时间'
    ,SCOR                      STRING COMMENT '分数'
    ,LAST_ANS                  STRING COMMENT '最新答案'
    ,DEL_FLAG                  STRING COMMENT '删除标志'
    ,DEL_DATE                  STRING COMMENT '删除日期'
    ,DATA_SRC_CD               STRING COMMENT '数据来源代码'
    ,TASK_NAME                 STRING COMMENT '任务名'
    ,DATA_ETL_DATE             STRING COMMENT '数据加载日期'
    ,DATA_UPT_DATE             STRING COMMENT '数据更新日期'
    ,DATA_TIME                 STRING COMMENT '数据时间'
)COMMENT '知识库问题清单'
PARTITIONED BY(SRC_TBL STRING COMMENT '源表')
STORED AS ORC;

DROP TABLE IF EXISTS T00_KNWLG_QSTN_LIST_GROUP1_TEMP;
CREATE TABLE IF NOT EXISTS T00_KNWLG_QSTN_LIST_GROUP1_TEMP
AS
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_GKS.M_QUESTION:知识库问题表]
-----------------------------------------------------------------------------------------------------
SELECT
       CONCAT('GKS008-',ID)                                AS QSTN_ID             --问题编号
      ,ID                                                  AS SRC_QSTN_ID         --源问题编号
      ,'GKS-KNWLG'                                         AS QSTN_CATE_CD        --问题类别代码
      ,CATEGORY                                            AS QSTN_CLS            --问题分类
      ,QUESTION                                            AS QSTN_CONT           --问题内容
      ,AUTHOR                                              AS AUTH                --作者
      ,TAGS                                                AS LBL                 --标签符号
      ,CREATEDAT                                           AS CREATE_TIME         --创建时间
      ,MODIFIEDAT                                          AS LAST_UPD_TIME       --最后更新时间
      ,SCORE                                               AS SCOR                --分数
      ,LATESTANSWER                                        AS LAST_ANS            --最新答案
      ,'GKS'                                               AS DATA_SRC_CD         --数据来源代码
      ,'ODATA_N_GKS.M_QUESTION'                            AS SRC_TBL             --源表
      ,UPPER('${filename}')                           AS TASK_NAME           --任务名
      ,'${data_day_str}'                              AS DATA_ETL_DATE       --数据加载日期
      ,'${data_day_str}'                            AS DATA_UPT_DATE       --数据更新日期
FROM  (SELECT * FROM ODATA_N_GKS.M_QUESTION )A
;

DROP TABLE IF EXISTS T00_KNWLG_QSTN_LIST_GROUP1_MID;
CREATE TABLE IF NOT EXISTS T00_KNWLG_QSTN_LIST_GROUP1_MID
AS
SELECT
         A.*
        ,B.QSTN_ID                    AS QSTN_ID1                   --问题编号1
        ,B.SRC_QSTN_ID                AS SRC_QSTN_ID1               --源问题编号1
        ,B.QSTN_CATE_CD               AS QSTN_CATE_CD1              --问题类别代码1
        ,B.QSTN_CLS                   AS QSTN_CLS1                  --问题分类1
        ,B.QSTN_CONT                  AS QSTN_CONT1                 --问题内容1
        ,B.AUTH                       AS AUTH1                      --作者1
        ,B.LBL                        AS LBL1                       --标签符号1
        ,B.CREATE_TIME                AS CREATE_TIME1               --创建时间1
        ,B.LAST_UPD_TIME              AS LAST_UPD_TIME1             --最后更新时间1
        ,B.SCOR                       AS SCOR1                      --分数1
        ,B.LAST_ANS                   AS LAST_ANS1                  --最新答案1
        ,B.DATA_SRC_CD                AS DATA_SRC_CD1               --数据来源代码1
        ,B.SRC_TBL                    AS SRC_TBL1                   --源表1
        ,B.TASK_NAME                  AS TASK_NAME1                 --任务名1
        ,B.DATA_ETL_DATE              AS DATA_ETL_DATE1             --数据加载日期1
        ,B.DATA_UPT_DATE              AS DATA_UPT_DATE1             --数据更新日期1
        ,CASE WHEN A.QSTN_ID IS NULL     AND B.QSTN_ID IS NOT NULL THEN 'I' --新增
              WHEN A.QSTN_ID IS NOT NULL AND B.QSTN_ID IS NULL     THEN 'D' --删除
              WHEN A.QSTN_ID IS NOT NULL AND B.QSTN_ID IS NOT NULL AND (
              COALESCE(A.SRC_QSTN_ID         ,'') <> COALESCE(B.SRC_QSTN_ID         ,'') 
           OR COALESCE(A.QSTN_CATE_CD        ,'') <> COALESCE(B.QSTN_CATE_CD        ,'') 
           OR COALESCE(A.QSTN_CLS            ,'') <> COALESCE(B.QSTN_CLS            ,'') 
           OR COALESCE(A.QSTN_CONT           ,'') <> COALESCE(B.QSTN_CONT           ,'') 
           OR COALESCE(A.AUTH                ,'') <> COALESCE(B.AUTH                ,'') 
           OR COALESCE(A.LBL                 ,'') <> COALESCE(B.LBL                 ,'') 
           OR COALESCE(A.CREATE_TIME         ,'') <> COALESCE(B.CREATE_TIME         ,'') 
           OR COALESCE(A.LAST_UPD_TIME       ,'') <> COALESCE(B.LAST_UPD_TIME       ,'') 
           OR COALESCE(A.SCOR                ,'') <> COALESCE(B.SCOR                ,'') 
           OR COALESCE(A.LAST_ANS            ,'') <> COALESCE(B.LAST_ANS            ,'') 
            )
            THEN     'U' --变更
            ELSE     'S' --无变更
            END                         AS DATA_TYPE
FROM  (SELECT * FROM T00_KNWLG_QSTN_LIST WHERE SRC_TBL ='ODATA_N_GKS.M_QUESTION')A --只对比ODATA_N_GKS.M_QUESTION表的数据
FULL OUTER JOIN T00_KNWLG_QSTN_LIST_GROUP1_TEMP B
 ON    A.QSTN_ID=B.QSTN_ID

;

-- querySql
INSERT OVERWRITE TABLE T00_KNWLG_QSTN_LIST PARTITION (SRC_TBL )
 --剔除源表当日新增的数据
SELECT
 *
 FROM T00_KNWLG_QSTN_LIST
WHERE DATA_ETL_DATE !='${data_day_str}' 
  AND SRC_TBL ='ODATA_N_GKS.M_QUESTION'
;

INSERT OVERWRITE TABLE T00_KNWLG_QSTN_LIST PARTITION (SRC_TBL ='ODATA_N_GKS.M_QUESTION')
SELECT
      QSTN_ID                    AS QSTN_ID                   --问题编号
     ,SRC_QSTN_ID                AS SRC_QSTN_ID               --源问题编号
     ,QSTN_CATE_CD               AS QSTN_CATE_CD              --问题类别代码
     ,QSTN_CLS                   AS QSTN_CLS                  --问题分类
     ,QSTN_CONT                  AS QSTN_CONT                 --问题内容
     ,AUTH                       AS AUTH                      --作者
     ,LBL                        AS LBL                       --标签符号
     ,CREATE_TIME                AS CREATE_TIME               --创建时间
     ,LAST_UPD_TIME              AS LAST_UPD_TIME             --最后更新时间
     ,SCOR                       AS SCOR                      --分数
     ,LAST_ANS                   AS LAST_ANS                  --最新答案
     ,'0'                        AS DEL_FLAG                  --删除标志
     ,''                         AS DEL_DATE                  --删除日期
     ,DATA_SRC_CD                AS DATA_SRC_CD               --数据来源代码
     ,TASK_NAME                  AS TASK_NAME                 --任务名
     ,DATA_ETL_DATE              AS DATA_ETL_DATE             --数据加载日期
     ,DATA_UPT_DATE              AS DATA_UPT_DATE             --数据更新日期
     ,DATA_TIME                  AS DATA_TIME                 --数据时间
FROM T00_KNWLG_QSTN_LIST_GROUP1_MID WHERE DATA_TYPE='S' --插入无变化的数据
UNION ALL
SELECT
      QSTN_ID1                    AS QSTN_ID                   --问题编号
     ,SRC_QSTN_ID1                AS SRC_QSTN_ID               --源问题编号
     ,QSTN_CATE_CD1               AS QSTN_CATE_CD              --问题类别代码
     ,QSTN_CLS1                   AS QSTN_CLS                  --问题分类
     ,QSTN_CONT1                  AS QSTN_CONT                 --问题内容
     ,AUTH1                       AS AUTH                      --作者
     ,LBL1                        AS LBL                       --标签符号
     ,CREATE_TIME1                AS CREATE_TIME               --创建时间
     ,LAST_UPD_TIME1              AS LAST_UPD_TIME             --最后更新时间
     ,SCOR1                       AS SCOR                      --分数
     ,LAST_ANS1                   AS LAST_ANS                  --最新答案
     ,'0'                         AS DEL_FLAG                  --删除标志
     ,''                          AS DEL_DATE                  --删除日期
     ,DATA_SRC_CD1                AS DATA_SRC_CD               --数据来源代码
     ,TASK_NAME1                  AS TASK_NAME                 --任务名
     ,DATA_ETL_DATE               AS DATA_ETL_DATE             --数据加载日期
     ,DATA_UPT_DATE1              AS DATA_UPT_DATE             --数据更新日期
     ,'${data_today}'        AS DATA_TIME                 --数据时间
FROM T00_KNWLG_QSTN_LIST_GROUP1_MID WHERE DATA_TYPE='U'  --有变更的数据取变更的值
UNION ALL
SELECT
      QSTN_ID1                    AS QSTN_ID                   --问题编号
     ,SRC_QSTN_ID1                AS SRC_QSTN_ID               --源问题编号
     ,QSTN_CATE_CD1               AS QSTN_CATE_CD              --问题类别代码
     ,QSTN_CLS1                   AS QSTN_CLS                  --问题分类
     ,QSTN_CONT1                  AS QSTN_CONT                 --问题内容
     ,AUTH1                       AS AUTH                      --作者
     ,LBL1                        AS LBL                       --标签符号
     ,CREATE_TIME1                AS CREATE_TIME               --创建时间
     ,LAST_UPD_TIME1              AS LAST_UPD_TIME             --最后更新时间
     ,SCOR1                       AS SCOR                      --分数
     ,LAST_ANS1                   AS LAST_ANS                  --最新答案
     ,'0'                         AS DEL_FLAG                  --删除标志
     ,''                          AS DEL_DATE                  --删除日期
     ,DATA_SRC_CD1                AS DATA_SRC_CD               --数据来源代码
     ,TASK_NAME1                  AS TASK_NAME                 --任务名
     ,DATA_ETL_DATE1              AS DATA_ETL_DATE             --数据加载日期
     ,DATA_UPT_DATE1              AS DATA_UPT_DATE             --数据更新日期
     ,'${data_today}'        AS DATA_TIME                 --数据时间
FROM T00_KNWLG_QSTN_LIST_GROUP1_MID WHERE DATA_TYPE='I'  --插入新增的数据
UNION ALL
SELECT
      QSTN_ID                    AS QSTN_ID                   --问题编号
     ,SRC_QSTN_ID                AS SRC_QSTN_ID               --源问题编号
     ,QSTN_CATE_CD               AS QSTN_CATE_CD              --问题类别代码
     ,QSTN_CLS                   AS QSTN_CLS                  --问题分类
     ,QSTN_CONT                  AS QSTN_CONT                 --问题内容
     ,AUTH                       AS AUTH                      --作者
     ,LBL                        AS LBL                       --标签符号
     ,CREATE_TIME                AS CREATE_TIME               --创建时间
     ,LAST_UPD_TIME              AS LAST_UPD_TIME             --最后更新时间
     ,SCOR                       AS SCOR                      --分数
     ,LAST_ANS                   AS LAST_ANS                  --最新答案
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
FROM T00_KNWLG_QSTN_LIST_GROUP1_MID WHERE DATA_TYPE='D' --插入删除的数据
;
