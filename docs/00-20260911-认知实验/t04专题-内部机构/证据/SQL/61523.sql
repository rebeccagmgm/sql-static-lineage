-- task_id: 61523
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/ORG/PDATA_N.T04_INR_ORG_RCC001.py
-- observed_at: 2026-09-05T01:06:18.997Z

-- createSql
CREATE TABLE IF NOT EXISTS T04_INR_ORG(
     BUSI_DATE                 STRING COMMENT '业务日期'
    ,INR_ORG_ID                STRING COMMENT '内部机构编号'
    ,INR_ORG_NAME              STRING COMMENT '内部机构名称'
    ,INR_ORG_CATE_CD           STRING COMMENT '内部机构类别代码'
    ,INR_ORG_TYPE_CD           STRING COMMENT '内部机构类型代码'
    ,INR_ORG_STAT_CD           STRING COMMENT '内部机构状态代码'
    ,SETP_DATE                 STRING COMMENT '成立日期'
    ,CANC_DATE                 STRING COMMENT '注销日期'
    ,DEL_FLAG                  STRING COMMENT '删除标志'
    ,DEL_DATE                  STRING COMMENT '删除日期'
    ,DATA_SRC_CD               STRING COMMENT '数据来源代码'
    ,TASK_NAME                 STRING COMMENT '任务名'
    ,DATA_ETL_DATE             STRING COMMENT '数据加载日期'
    ,DATA_UPT_DATE             STRING COMMENT '数据更新日期'
    ,DATA_TIME                 STRING COMMENT '数据时间'
    ,Real_Src_Tbl              STRING COMMENT '真实源表'
)COMMENT '内部机构'
PARTITIONED BY (SRC_TBL  STRING COMMENT '源表')
STORED AS ORC;

DROP TABLE IF EXISTS TEMP.T04_INR_ORG_TEMP_RCC001;
CREATE TABLE TEMP.T04_INR_ORG_TEMP_RCC001
AS
-----------------------------------------------------------------------------------------------------
---Group1: Source Table:[ODATA_N_RCC.U_ALLBRANCH:券商机构表]
-----------------------------------------------------------------------------------------------------
SELECT
        LPAD(BRANCH_NO,4,'0')                  AS INR_ORG_ID1               --内部机构编号
       ,BRANCH_NAME                            AS INR_ORG_NAME1             --内部机构名称
       ,'1'                                    AS INR_ORG_CATE_CD1          --内部机构类别代码
       ,CONCAT('1',LPAD(BRANCH_TYPE,2,'0'))    AS INR_ORG_TYPE_CD1          --内部机构类型代码
       ,''                                     AS INR_ORG_STAT_CD1          --内部机构状态代码
       ,''                                     AS SETP_DATE1                --成立日期
       ,''                                     AS CANC_DATE1                --注销日期
       ,'RCC'                                  AS DATA_SRC_CD1              --数据来源代码
       ,'ODATA_N_RCC.U_ALLBRANCH'              AS SRC_TBL1                  --源表
       ,UPPER('${filename}')              AS TASK_NAME1                --任务名
       ,'${data_day_str}'                 AS DATA_ETL_DATE1            --数据加载日期
       ,'${data_day_str}'               AS DATA_UPT_DATE1            --数据更新日期
       ,'ODATA_N_RCC.U_ALLBRANCH'              AS Real_Src_Tbl1             --真实源表
FROM  ODATA_N_RCC.U_ALLBRANCH
WHERE BUSI_DATE='${data_day_str}'
;

DROP TABLE IF EXISTS TEMP.T04_INR_ORG_MID_RCC001;
CREATE TABLE IF NOT EXISTS TEMP.T04_INR_ORG_MID_RCC001
AS
SELECT
       A.*,B.*,
       CASE WHEN A.INR_ORG_ID IS NULL AND B.INR_ORG_ID1 IS NOT NULL THEN 'I' --新增
            WHEN A.INR_ORG_ID IS NOT NULL AND B.INR_ORG_ID1 IS NULL THEN 'D' --删除
            WHEN A.INR_ORG_ID IS NOT NULL AND B.INR_ORG_ID1 IS NOT NULL AND (
                COALESCE(A.INR_ORG_NAME        ,'')   <> COALESCE(B.INR_ORG_NAME1           ,'')
             OR COALESCE(A.INR_ORG_CATE_CD     ,'')   <> COALESCE(B.INR_ORG_CATE_CD1        ,'')
             OR COALESCE(A.INR_ORG_TYPE_CD     ,'')   <> COALESCE(B.INR_ORG_TYPE_CD1        ,'')
             OR COALESCE(A.INR_ORG_STAT_CD     ,'')   <> COALESCE(B.INR_ORG_STAT_CD1        ,'')
             OR COALESCE(A.SETP_DATE           ,'')   <> COALESCE(B.SETP_DATE1              ,'')
             OR COALESCE(A.CANC_DATE           ,'')   <> COALESCE(B.CANC_DATE1              ,'')
            ) THEN 'U' --变更
            ELSE 'S' --无变更
            END AS DATA_TYPE
FROM  (SELECT * FROM T04_INR_ORG WHERE SRC_TBL='ODATA_N_RCC.U_ALLBRANCH' )A --只对比ODATA_N_RCC.U_ALLBRANCH的数据
FULL OUTER JOIN TEMP.T04_INR_ORG_TEMP_RCC001 B
ON    A.INR_ORG_ID=B.INR_ORG_ID1
;

-- querySql
INSERT OVERWRITE TABLE T04_INR_ORG PARTITION(SRC_TBL)
 --剔除当日新增的数据
SELECT
      BUSI_DATE                    --业务日期
     ,INR_ORG_ID                   --内部机构编号
     ,INR_ORG_NAME                 --内部机构名称
     ,INR_ORG_CATE_CD              --内部机构类别代码
     ,INR_ORG_TYPE_CD              --内部机构类型代码
     ,INR_ORG_STAT_CD              --内部机构状态代码
     ,SETP_DATE                    --成立日期
     ,CANC_DATE                    --注销日期
     ,DEL_FLAG                     --删除标志
     ,DEL_DATE                     --删除日期
     ,DATA_SRC_CD                  --数据来源代码
     ,TASK_NAME                    --任务名
     ,DATA_ETL_DATE                --数据加载日期
     ,DATA_UPT_DATE                --数据更新日期
     ,DATA_TIME                    --数据时间
     ,Real_Src_Tbl                 --真实源表
     ,SRC_TBL                      --源表
FROM T04_INR_ORG
WHERE BUSI_DATE !='${data_day_str}'
  AND SRC_TBL='ODATA_N_RCC.U_ALLBRANCH'
;

INSERT OVERWRITE TABLE T04_INR_ORG PARTITION(SRC_TBL)
SELECT
      BUSI_DATE                    --业务日期
     ,INR_ORG_ID                   --内部机构编号
     ,INR_ORG_NAME                 --内部机构名称
     ,INR_ORG_CATE_CD              --内部机构类别代码
     ,INR_ORG_TYPE_CD              --内部机构类型代码
     ,INR_ORG_STAT_CD              --内部机构状态代码
     ,SETP_DATE                    --成立日期
     ,CANC_DATE                    --注销日期
     ,'0'                    AS DEL_FLAG              --删除标志
     ,''                     AS DEL_DATE              --删除日期
     ,DATA_SRC_CD                  --数据来源代码
     ,TASK_NAME                    --任务名
     ,DATA_ETL_DATE                --数据加载日期
     ,DATA_UPT_DATE                --数据更新日期
     ,DATA_TIME                    --数据时间
     ,Real_Src_Tbl                 --真实源表
     ,SRC_TBL                      --源表
FROM TEMP.T04_INR_ORG_MID_RCC001 WHERE DATA_TYPE='S'  --插入无变化的数据
UNION ALL
SELECT
      BUSI_DATE                                       --业务日期
     ,INR_ORG_ID1            AS INR_ORG_ID            --内部机构编号
     ,INR_ORG_NAME1          AS INR_ORG_NAME          --内部机构名称
     ,INR_ORG_CATE_CD1       AS INR_ORG_CATE_CD       --内部机构类别代码
     ,INR_ORG_TYPE_CD1       AS INR_ORG_TYPE_CD       --内部机构类型代码
     ,INR_ORG_STAT_CD1       AS INR_ORG_STAT_CD       --内部机构状态代码
     ,SETP_DATE1             AS SETP_DATE             --成立日期
     ,CANC_DATE1             AS CANC_DATE             --注销日期
     ,'0'                    AS DEL_FLAG              --删除标志
     ,''                     AS DEL_DATE              --删除日期
     ,DATA_SRC_CD1           AS DATA_SRC_CD           --数据来源代码
     ,TASK_NAME1             AS TASK_NAME             --任务名
     ,DATA_ETL_DATE          AS DATA_ETL_DATE         --数据加载日期
     ,DATA_UPT_DATE1         AS DATA_UPT_DATE         --数据更新日期
     ,'${data_today}'   AS DATA_TIME             --数据时间
     ,Real_Src_Tbl1          AS Real_Src_Tbl          --真实源表
     ,SRC_TBL1               AS SRC_TBL               --源表
FROM TEMP.T04_INR_ORG_MID_RCC001 WHERE DATA_TYPE='U'   --有变更的数据取变更的值
UNION ALL
SELECT
      '${data_day_str}' AS BUSI_DATE             --业务日期
     ,INR_ORG_ID1            AS INR_ORG_ID            --内部机构编号
     ,INR_ORG_NAME1          AS INR_ORG_NAME          --内部机构名称
     ,INR_ORG_CATE_CD1       AS INR_ORG_CATE_CD       --内部机构类别代码
     ,INR_ORG_TYPE_CD1       AS INR_ORG_TYPE_CD       --内部机构类型代码
     ,INR_ORG_STAT_CD1       AS INR_ORG_STAT_CD       --内部机构状态代码
     ,SETP_DATE1             AS SETP_DATE             --成立日期
     ,CANC_DATE1             AS CANC_DATE             --注销日期
     ,'0'                    AS DEL_FLAG              --删除标志
     ,''                     AS DEL_DATE              --删除日期
     ,DATA_SRC_CD1           AS DATA_SRC_CD           --数据来源代码
     ,TASK_NAME1             AS TASK_NAME             --任务名
     ,DATA_ETL_DATE1         AS DATA_ETL_DATE         --数据加载日期
     ,DATA_UPT_DATE1         AS DATA_UPT_DATE         --数据更新日期
     ,'${data_today}'   AS DATA_TIME             --数据时间
     ,Real_Src_Tbl1          AS Real_Src_Tbl          --真实源表
     ,SRC_TBL1               AS SRC_TBL               --源表
FROM TEMP.T04_INR_ORG_MID_RCC001 WHERE DATA_TYPE='I' --插入新增的数据
UNION ALL
SELECT
      BUSI_DATE                                       --业务日期
     ,INR_ORG_ID                                      --内部机构编号
     ,INR_ORG_NAME                                    --内部机构名称
     ,INR_ORG_CATE_CD                                 --内部机构类别代码
     ,INR_ORG_TYPE_CD                                 --内部机构类型代码
     ,'04'                      AS   INR_ORG_STAT_CD  --内部机构状态代码  --已撤销
     ,SETP_DATE                                       --成立日期
     ,CANC_DATE                                       --注销日期
     ,'1' DEL_FLAG                                    --删除标志
     ,CASE WHEN DEL_DATE !=''
           THEN DEL_DATE
           ELSE '${data_day_str}'
           END                  AS   DEL_DATE          --删除日期
     ,DATA_SRC_CD                                      --数据来源代码
     ,TASK_NAME                                        --任务名
     ,DATA_ETL_DATE                                    --数据加载日期
     ,CASE WHEN DEL_DATE !=''
           THEN DATA_UPT_DATE
           ELSE '${data_day_str}'
           END                  AS DATA_UPT_DATE       --数据更新日期
     ,CASE WHEN DEL_DATE !=''
           THEN DATA_TIME
           ELSE '${data_today}'
           END                  AS DATA_TIME            --数据时间
     ,Real_Src_Tbl                                     --真实源表
     ,SRC_TBL                                          --源表
FROM TEMP.T04_INR_ORG_MID_RCC001 WHERE DATA_TYPE='D'  --插入删除的数据
;
