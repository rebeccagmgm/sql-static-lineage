-- task_id: 110348
-- hiveDb: spdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/SPDATA_N.T00_PRD_POOL_COMPNT_INFO_XIR226.py
-- observed_at: 2026-09-05T01:06:46.460Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_PRD_POOL_COMPNT_INFO(
     POOL_ID                   STRING COMMENT '池编号'
    ,POOL_CATE_CD              STRING COMMENT '池类别代码'
    ,Pool_Compnt_Type_Cd       STRING COMMENT '池成分类型代码'
    ,COMPNT_ID                 STRING COMMENT '成分'
    ,PORT                      STRING COMMENT '端口'
    ,SRC                       STRING COMMENT '来源'
    ,IN_POOL_DATE              STRING COMMENT '入池日期'
    ,IN_OPER                   STRING COMMENT '入池人'
    ,IN_POOL_RSN               STRING COMMENT '入池原因'
    ,OUT_POOL_DATE             STRING COMMENT '出池日期'
    ,SRC_TRD_NO                STRING COMMENT '源交易序号'
    ,DEL_FLAG                  STRING COMMENT '删除标志'
    ,DEL_DATE                  STRING COMMENT '删除日期'
    ,DATA_SRC_CD               STRING COMMENT '数据来源代码'
    ,TASK_NAME                 STRING COMMENT '任务名'
    ,DATA_ETL_DATE             STRING COMMENT '数据加载日期'
    ,DATA_UPT_DATE             STRING COMMENT '数据更新日期'
    ,Data_Time                 STRING COMMENT '数据时间'
    ,Pdef_Attr_Info            STRING COMMENT '自定义属性信息'
    ,Real_Src_Tbl              STRING COMMENT '真实源表'
)COMMENT '产品池成分信息'
PARTITIONED BY (SRC_TBL  STRING COMMENT '源表')
STORED AS ORC;

DROP TABLE IF EXISTS ${temp_tbl};
CREATE TABLE ${temp_tbl}
AS
-----------------------------------------------------------------------------------------------------
---Group1: Source Table:[ODATA_N_XIR.T_TTRD_OTC_POOL_COMPONENT 债券池成分表]   
-----------------------------------------------------------------------------------------------------
SELECT
     OTCPOOLID                         AS Pool_Id                 --池编号
    ,'SB_OTC_BND_POOL'                 AS Pool_Cate_Cd            --池类别代码
    ,COMPONENTTYPE                     AS Pool_Compnt_Type_Cd     --池成分类型代码
    ,COMPONENT                         AS Compnt_Id               --成分
    ,SORT                              AS Port                    --端口
    ,SOURCE                            AS Src                     --来源
    ,IF(length(BEGDATE)=10,from_unixtime(unix_timestamp(BEGDATE ,'yyyy-MM-dd') ,'yyyy-MM-dd HH:mm:ss'),BEGDATE)                         
	                                   AS In_Pool_Date            --入池日期
    ,OPERATOR                          AS In_Oper                 --入池人
    ,REMARK                            AS In_Pool_Rsn             --入池原因
    ,IF(length(OUTPOOLDATE)=10,from_unixtime(unix_timestamp(OUTPOOLDATE ,'yyyy-MM-dd') ,'yyyy-MM-dd HH:mm:ss'),OUTPOOLDATE)
                                       AS Out_Pool_Date           --出池日期
    ,SYSORDID                          AS Src_Trd_No              --源交易序号
    ,'${data_src_cd}'             AS Data_Src_Cd             --数据来源代码
    ,'${src_table}'               AS Src_Tbl                 --源表
    ,'${filename}'                AS Task_Name               --任务名
    ,'${data_day_str}'            AS Data_Etl_Date           --数据加载日期
    ,'${data_day_str}'            AS Data_Upt_Date           --数据更新日期
    ,''                                AS Pdef_Attr_Info            --自定义属性信息
    ,'${src_table}'               AS Real_Src_Tbl              --真实源表
FROM  ${src_table}  A
WHERE BUSI_DATE = '${data_day_str}'

;

DROP TABLE IF EXISTS ${mid_tbl};
CREATE TABLE IF NOT EXISTS ${mid_tbl}
AS
SELECT
       A.*
      ,B.Pool_Id                   AS Pool_Id1
      ,B.Pool_Cate_Cd              AS Pool_Cate_Cd1
      ,B.Pool_Compnt_Type_Cd            AS Pool_Compnt_Type_Cd1
      ,B.Compnt_Id                 AS Compnt_Id1
      ,B.Port                      AS Port1
      ,B.Src                       AS Src1
      ,B.In_Pool_Date              AS In_Pool_Date1
      ,B.In_Oper                   AS In_Oper1
      ,B.In_Pool_Rsn               AS In_Pool_Rsn1
      ,B.Out_Pool_Date             AS Out_Pool_Date1
      ,B.Src_Trd_No                AS Src_Trd_No1
      ,B.Data_Src_Cd               AS Data_Src_Cd1
      ,B.Src_Tbl                   AS Src_Tbl1
      ,B.Task_Name                 AS Task_Name1
      ,B.Data_Etl_Date             AS Data_Etl_Date1
      ,B.Data_Upt_Date             AS Data_Upt_Date1
      ,B.Pdef_Attr_Info            AS Pdef_Attr_Info1
      ,B.Real_Src_Tbl              AS Real_Src_Tbl1
      ,CASE WHEN A.Pool_Id IS NULL AND B.Pool_Id IS NOT NULL THEN 'I' --新增
            WHEN A.Pool_Id IS NOT NULL AND B.Pool_Id IS NULL THEN 'D' --删除
            WHEN A.Pool_Id IS NOT NULL AND B.Pool_Id IS NOT NULL AND (
                COALESCE(A.Port              ,'')   <> COALESCE(B.Port                ,'')
             OR COALESCE(A.Src               ,'')   <> COALESCE(B.Src                 ,'')
             OR COALESCE(A.In_Pool_Date      ,'')   <> COALESCE(B.In_Pool_Date        ,'')			 
             OR COALESCE(A.In_Oper           ,'')   <> COALESCE(B.In_Oper             ,'')	
             OR COALESCE(A.In_Pool_Rsn       ,'')   <> COALESCE(B.In_Pool_Rsn         ,'')
             OR COALESCE(A.Out_Pool_Date     ,'')   <> COALESCE(B.Out_Pool_Date       ,'')
             OR COALESCE(A.Src_Trd_No        ,'')   <> COALESCE(B.Src_Trd_No          ,'')
             OR COALESCE(A.Pdef_Attr_Info    ,'')   <> COALESCE(B.Pdef_Attr_Info      ,'')
            )
            THEN     'U' --变更
            ELSE     'S' --无变更
            END AS DATA_TYPE
FROM  (SELECT * FROM T00_PRD_POOL_COMPNT_INFO WHERE SRC_TBL='${src_table}' )A --拆分后只对比该表的数据
FULL OUTER JOIN ${temp_tbl} B
ON    A.Pool_Id=B.Pool_Id
AND   A.Pool_Cate_Cd=B.Pool_Cate_Cd  
AND   A.Pool_Compnt_Type_Cd=B.Pool_Compnt_Type_Cd
AND   A.Compnt_Id=B.Compnt_Id
;

-- querySql
INSERT OVERWRITE TABLE T00_PRD_POOL_COMPNT_INFO PARTITION(SRC_TBL)
 --剔除当日新增的数据
SELECT                       
     POOL_ID                   --池编号
    ,POOL_CATE_CD              --池类别代码
    ,Pool_Compnt_Type_Cd            --池成分类型代码
    ,COMPNT_ID                 --成分
    ,PORT                      --端口
    ,SRC                       --来源
    ,IN_POOL_DATE              --入池日期
    ,IN_OPER                   --入池人
    ,IN_POOL_RSN               --入池原因
    ,OUT_POOL_DATE             --出池日期
    ,SRC_TRD_NO                --源交易序号
    ,DEL_FLAG                  --删除标志
    ,DEL_DATE                  --删除日期
    ,DATA_SRC_CD               --数据来源代码
    ,TASK_NAME                 --任务名
    ,DATA_ETL_DATE             --数据加载日期
    ,DATA_UPT_DATE             --数据更新日期
    ,DATA_TIME                 --数据时间
    ,Pdef_Attr_Info            --自定义属性信息
    ,Real_Src_Tbl              --真实源表
    ,Src_Tbl                   --源表
FROM T00_PRD_POOL_COMPNT_INFO
WHERE DATA_ETL_DATE !='${data_day_str}'
  AND SRC_TBL ='${src_table}'
;

INSERT OVERWRITE TABLE T00_PRD_POOL_COMPNT_INFO PARTITION(SRC_TBL)
SELECT
      POOL_ID                                 --池编号
     ,POOL_CATE_CD                            --池类别代码
     ,Pool_Compnt_Type_Cd                          --池成分类型代码
     ,COMPNT_ID                               --成分
     ,PORT                                    --端口
     ,SRC                                     --来源
     ,IN_POOL_DATE                            --入池日期
     ,IN_OPER                                 --入池人
     ,IN_POOL_RSN                             --入池原因
     ,OUT_POOL_DATE                           --出池日期
     ,SRC_TRD_NO                              --源交易序号
     ,'0'                    AS DEL_FLAG      --删除标志
     ,''                     AS DEL_DATE      --删除日期
     ,DATA_SRC_CD                             --数据来源代码
     ,TASK_NAME                               --任务名
     ,DATA_ETL_DATE                           --数据加载日期
     ,DATA_UPT_DATE                           --数据更新日期
     ,DATA_TIME                               --数据时间
     ,Pdef_Attr_Info                          --自定义属性信息
     ,Real_Src_Tbl                            --真实源表
     ,SRC_TBL                                 --源表
FROM ${mid_tbl} WHERE DATA_TYPE='S'  --插入无变化的数据
UNION ALL
SELECT
      POOL_ID1               AS POOL_ID                  --池编号
     ,POOL_CATE_CD1          AS POOL_CATE_CD             --池类别代码
     ,Pool_Compnt_Type_Cd1        AS Pool_Compnt_Type_Cd           --池成分类型代码
     ,COMPNT_ID1             AS COMPNT_ID                --成分
     ,PORT1                  AS PORT                     --端口
     ,SRC1                   AS SRC                      --来源
     ,IN_POOL_DATE1          AS IN_POOL_DATE             --入池日期
     ,IN_OPER1               AS IN_OPER                  --入池人
     ,IN_POOL_RSN1           AS IN_POOL_RSN              --入池原因
     ,OUT_POOL_DATE1         AS OUT_POOL_DATE            --出池日期
     ,SRC_TRD_NO1            AS SRC_TRD_NO               --源交易序号
     ,'0'                    AS DEL_FLAG                 --删除标志
     ,''                     AS DEL_DATE                 --删除日期
     ,DATA_SRC_CD1           AS DATA_SRC_CD              --数据来源代码
     ,TASK_NAME1             AS TASK_NAME                --任务名
     ,DATA_ETL_DATE          AS DATA_ETL_DATE            --数据加载日期
     ,DATA_UPT_DATE1         AS DATA_UPT_DATE            --数据更新日期
     ,'${data_today}'   AS DATA_TIME                --数据时间
     ,Pdef_Attr_Info1        AS Pdef_Attr_Info           --自定义属性信息
     ,Real_Src_Tbl1          AS Real_Src_Tbl             --真实源表
     ,SRC_TBL1               AS SRC_TBL                  --源表
FROM ${mid_tbl} WHERE DATA_TYPE='U'           --有变更的数据取变更的值
UNION ALL
SELECT
      POOL_ID1               AS POOL_ID                  --池编号
     ,POOL_CATE_CD1          AS POOL_CATE_CD             --池类别代码
     ,Pool_Compnt_Type_Cd1        AS Pool_Compnt_Type_Cd           --池成分类型代码
     ,COMPNT_ID1             AS COMPNT_ID                --成分
     ,PORT1                  AS PORT                     --端口
     ,SRC1                   AS SRC                      --来源
     ,IN_POOL_DATE1          AS IN_POOL_DATE             --入池日期
     ,IN_OPER1               AS IN_OPER                  --入池人
     ,IN_POOL_RSN1           AS IN_POOL_RSN              --入池原因
     ,OUT_POOL_DATE1         AS OUT_POOL_DATE            --出池日期
     ,SRC_TRD_NO1            AS SRC_TRD_NO               --源交易序号
     ,'0'                    AS DEL_FLAG                 --删除标志
     ,''                     AS DEL_DATE                 --删除日期
     ,DATA_SRC_CD1           AS DATA_SRC_CD              --数据来源代码
     ,TASK_NAME1             AS TASK_NAME                --任务名
     ,DATA_ETL_DATE1         AS DATA_ETL_DATE            --数据加载日期
     ,DATA_UPT_DATE1         AS DATA_UPT_DATE            --数据更新日期
     ,'${data_today}'   AS DATA_TIME                --数据时间
     ,Pdef_Attr_Info1        AS Pdef_Attr_Info           --自定义属性信息
     ,Real_Src_Tbl1          AS Real_Src_Tbl             --真实源表
     ,SRC_TBL1               AS SRC_TBL                  --源表
FROM ${mid_tbl} WHERE DATA_TYPE='I' --插入新增的数据
UNION ALL
SELECT
      POOL_ID                                 --池编号
     ,POOL_CATE_CD                            --池类别代码
     ,Pool_Compnt_Type_Cd                          --池成分类型代码
     ,COMPNT_ID                               --成分
     ,PORT                                    --端口
     ,SRC                                     --来源
     ,IN_POOL_DATE                            --入池日期
     ,IN_OPER                                 --入池人
     ,IN_POOL_RSN                             --入池原因
     ,OUT_POOL_DATE                           --出池日期
     ,SRC_TRD_NO                              --源交易序号
     ,'1' DEL_FLAG                            --删除标志
     ,CASE WHEN DEL_DATE !=''
           THEN DEL_DATE
           ELSE '${data_day_str}'
           END                AS DEL_DATE     --删除日期
     ,DATA_SRC_CD                             --数据来源代码
     ,TASK_NAME                               --任务名
     ,DATA_ETL_DATE                           --数据加载日期
     ,CASE WHEN DEL_DATE !=''
           THEN DATA_UPT_DATE
           ELSE '${data_day_str}'
           END               AS DATA_UPT_DATE --数据更新日期
     ,CASE WHEN DEL_DATE !=''
           THEN DATA_TIME
           ELSE '${data_today}'
           END               AS DATA_TIME     --数据时间
     ,Pdef_Attr_Info                          --自定义属性信息
     ,Real_Src_Tbl                            --真实源表
     ,SRC_TBL                                 --源表
FROM ${mid_tbl} WHERE DATA_TYPE='D'  --插入删除的数据
;
