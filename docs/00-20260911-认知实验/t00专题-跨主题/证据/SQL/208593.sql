-- task_id: 208593
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_PRD_POOL_INFO_TIT329.py
-- observed_at: 2026-09-05T01:07:21.179Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_PRD_POOL_INFO(
         Pool_Id                   STRING COMMENT '池编号'
        ,Pool_Name                 STRING COMMENT '池名称'
        ,Pool_Cate_Cd              STRING COMMENT '池类别代码'
        ,Pool_Type_Cd              STRING COMMENT '池类型代码'
        ,Pool_Stat_Cd              STRING COMMENT '池状态代码'
        ,Remark                    STRING COMMENT '备注'
        ,Del_Flag                  STRING COMMENT '删除标志'
        ,Del_Date                  STRING COMMENT '删除日期'
        ,Data_Src_Cd               STRING COMMENT '数据来源代码'
        ,Task_Name                 STRING COMMENT '任务名'
        ,Data_Etl_Date             STRING COMMENT '数据加载日期'
        ,Data_Upt_Date             STRING COMMENT '数据更新日期'
        ,Data_Time                 STRING COMMENT '数据时间'
        ,Pool_Create_Type_Cd       STRING COMMENT '池生成类型代码'
        ,Pool_Create_Method_Cd     STRING COMMENT '池生成方式代码'
        ,Real_Src_Tbl              STRING COMMENT '真实源表'
    )COMMENT '产品池信息'
    PARTITIONED BY (Src_Tbl  STRING COMMENT '源表')
    STORED AS ORC;

DROP TABLE IF EXISTS ${DB_TEMP}.${temp_tbl};
    CREATE TABLE IF NOT EXISTS ${DB_TEMP}.${temp_tbl}
    AS
    -----------------------------------------------------------------------------------------------------
    --Group3: Source Table:[ODATA_N_TIT.K_EQ_EQUITY_SOURCE 券源名称管理]
    -----------------------------------------------------------------------------------------------------
    SELECT
            EQ_SOURCE_ID                 AS Pool_Id1                  --池编号
           ,EQ_SOURCE_NAME               AS Pool_Name1                --池名称
           ,'OTC_DERI_SCR_POOL'          AS Pool_Cate_Cd1             --池类别代码   'OTC_DERI_SCR_POOL' --场外衍生品产品池
           ,NVL(DW_CD_VAL,EQ_SOURCE_TYPE) AS Pool_Type_Cd1             --池类型代码
           ,''                           AS Pool_Stat_Cd1                  --池状态代码
           ,REMARK                       AS Remark1                   --备注
           ,'${data_src_cd}'        AS Data_Src_Cd1              --数据来源代码
           ,'${src_table}'          AS Src_Tbl1                  --源表
           ,'${filename}'           AS Task_Name1                --任务名
           ,'${data_day_str}'       AS Data_Etl_Date1            --数据加载日期
           ,'${data_day_str}'     AS Data_Upt_Date1            --数据更新日期
           ,''                           AS Pool_Create_Type_Cd1       --池生成类型代码
           ,''                           AS Pool_Create_Method_Cd1     --池生成方式代码
           ,'${src_table}'          AS Real_Src_Tbl1             --真实源表
    FROM   ${src_table} A
    LEFT JOIN (
             SELECT SRC_CD_VAL,DW_CD_VAL
               FROM PDATA_N.REF_CD_CVT_MAP_TEMP
             WHERE TGT_TAB_NAME = 'T00_PRD_POOL_INFO'
                AND TGT_TAB_FLD  = 'Pool_Type_Cd'
                AND SRC_TAB_NAME = 'EQ_EQUITY_SOURCE'
                AND SRC_FLD_NAME = 'EQ_SOURCE_TYPE'
                AND SRC_SYS_NAME='TIT')B
       ON      A.EQ_SOURCE_TYPE =B.SRC_CD_VAL                  --EQ_SOURCE_TYPE 转码
    WHERE BUSI_DATE='${data_day_str}'
    ;

DROP TABLE IF EXISTS ${DB_TEMP}.${mid_tbl};
    CREATE TABLE IF NOT EXISTS ${DB_TEMP}.${mid_tbl}
    AS
    SELECT
           A.*
          ,B.*
          ,CASE WHEN A.Pool_Id IS NULL AND B.Pool_Id1 IS NOT NULL THEN 'I' --新增
                WHEN A.Pool_Id IS NOT NULL AND B.Pool_Id1 IS NULL THEN 'D' --删除
                WHEN A.Pool_Id IS NOT NULL AND B.Pool_Id1 IS NOT NULL AND (
                    COALESCE(A.Pool_Name              ,'')   <> COALESCE(B.Pool_Name1               ,'')
                 OR COALESCE(A.Pool_Cate_Cd           ,'')   <> COALESCE(B.Pool_Cate_Cd1            ,'')
                 OR COALESCE(A.Pool_Type_Cd           ,'')   <> COALESCE(B.Pool_Type_Cd1            ,'')
                 OR COALESCE(A.Pool_Stat_Cd           ,'')   <> COALESCE(B.Pool_Stat_Cd1            ,'')
                 OR COALESCE(A.Remark                 ,'')   <> COALESCE(B.Remark1                  ,'')
                 OR COALESCE(A.Pool_Create_Type_Cd    ,'')   <> COALESCE(B.Pool_Create_Type_Cd1     ,'')
                 OR COALESCE(A.Pool_Create_Method_Cd  ,'')   <> COALESCE(B.Pool_Create_Method_Cd1   ,'')
                 )
                THEN     'U' --变更
                ELSE     'S' --无变更
                END AS DATA_TYPE
    FROM  (SELECT * FROM T00_PRD_POOL_INFO WHERE Src_Tbl IN ('${src_table}') )A --只对比该源表的数据
    FULL OUTER JOIN ${DB_TEMP}.${temp_tbl} B
    ON    A.Pool_Id=B.Pool_Id1
    ;

-- querySql
INSERT OVERWRITE TABLE T00_PRD_POOL_INFO PARTITION (Src_Tbl )
     --剔除源表当日新增的数据
    SELECT
     *
    FROM T00_PRD_POOL_INFO
    WHERE Data_Etl_Date !='${data_day_str}'
    AND  Src_Tbl IN ('${src_table}')
    ;

INSERT OVERWRITE TABLE T00_PRD_POOL_INFO PARTITION (Src_Tbl )
    SELECT
          Pool_Id                                 --池编号
         ,Pool_Name                               --池名称
         ,Pool_Cate_Cd                            --池类别代码
         ,Pool_Type_Cd                            --池类型代码
         ,Pool_Stat_Cd                                 --池状态代码
         ,Remark                                  --备注
         ,'0'                    AS Del_Flag      --删除标志
         ,''                     AS Del_Date      --删除日期
         ,Data_Src_Cd                             --数据来源代码
         ,Task_Name                               --任务名
         ,Data_Etl_Date                           --数据加载日期
         ,Data_Upt_Date                           --数据更新日期
         ,Data_Time                               --数据时间
         ,Pool_Create_Type_Cd                     --池生成类型代码
         ,Pool_Create_Method_Cd                   --池生成方式代码
         ,Real_Src_Tbl                            --真实源表
         ,Src_Tbl                                 --源表
    FROM ${DB_TEMP}.${mid_tbl} WHERE DATA_TYPE='S'  --插入无变化的数据
    UNION ALL
    SELECT
          Pool_Id1               AS Pool_Id        --池编号
         ,Pool_Name1             AS Pool_Name      --池名称
         ,Pool_Cate_Cd1          AS Pool_Cate_Cd   --池类别代码
         ,Pool_Type_Cd1   AS Pool_Type_Cd   --池类型代码
         ,Pool_Stat_Cd1               AS Pool_Stat_Cd        --池状态代码
         ,Remark1                AS Remark         --备注
         ,'0'                    AS Del_Flag       --删除标志
         ,''                     AS Del_Date       --删除日期
         ,Data_Src_Cd1           AS Data_Src_Cd    --数据来源代码
         ,Task_Name1             AS Task_Name      --任务名
         ,Data_Etl_Date          AS Data_Etl_Date  --数据加载日期  有变更的数据取原etl_date
         ,Data_Upt_Date1         AS Data_Upt_Date  --数据更新日期
         ,'${data_today}'   AS Data_Time      --数据时间
         ,Pool_Create_Type_Cd1   AS Pool_Create_Type_Cd    --池生成类型代码
         ,Pool_Create_Method_Cd1 AS Pool_Create_Method_Cd  --池生成方式代码
         ,Real_Src_Tbl1          AS Real_Src_Tb1   --真实源表
         ,Src_Tbl1               AS Src_Tbl        --源表
    FROM ${DB_TEMP}.${mid_tbl} WHERE DATA_TYPE IN ('U')
    UNION ALL
    SELECT
          Pool_Id1               AS Pool_Id        --池编号
         ,Pool_Name1             AS Pool_Name      --池名称
         ,Pool_Cate_Cd1          AS Pool_Cate_Cd   --池类别代码
         ,Pool_Type_Cd1   AS Pool_Type_Cd   --池类型代码
         ,Pool_Stat_Cd1               AS Pool_Stat_Cd        --池状态代码
         ,Remark1                AS Remark         --备注
         ,'0'                    AS Del_Flag       --删除标志
         ,''                     AS Del_Date       --删除日期
         ,Data_Src_Cd1           AS Data_Src_Cd    --数据来源代码
         ,Task_Name1             AS Task_Name      --任务名
         ,Data_Etl_Date1         AS Data_Etl_Date  --数据加载日期  有变更的数据取原etl_date
         ,Data_Upt_Date1         AS Data_Upt_Date  --数据更新日期
         ,'${data_today}'   AS Data_Time      --数据时间
         ,Pool_Create_Type_Cd1   AS Pool_Create_Type_Cd    --池生成类型代码
         ,Pool_Create_Method_Cd1 AS Pool_Create_Method_Cd  --池生成方式代码
         ,Real_Src_Tbl1          AS Real_Src_Tb1   --真实源表
         ,Src_Tbl1               AS Src_Tbl        --源表
    FROM ${DB_TEMP}.${mid_tbl} WHERE DATA_TYPE IN ('I')
    UNION ALL
    SELECT
          Pool_Id                                 --池编号
         ,Pool_Name                               --池名称
         ,Pool_Cate_Cd                            --池类别代码
         ,Pool_Type_Cd                            --池类型代码
         ,Pool_Stat_Cd                                 --池状态代码
         ,Remark                                  --备注
         ,'1' Del_Flag                            --删除标志
         ,CASE WHEN Del_Date !=''
               THEN Del_Date
               ELSE '${data_day_str}'
               END                AS   Del_Date   --删除日期
         ,Data_Src_Cd                             --数据来源代码
         ,Task_Name                               --任务名
         ,Data_Etl_Date                           --数据加载日期
         ,CASE WHEN Del_Date !=''
               THEN Data_Upt_Date
               ELSE '${data_day_str}'
               END               AS Data_Upt_Date --数据更新日期
         ,CASE WHEN Del_Date !=''
               THEN Data_Time
               ELSE '${data_today}'
               END               AS Data_Time     --数据时间
         ,Pool_Create_Type_Cd                     --池生成类型代码
         ,Pool_Create_Method_Cd                   --池生成方式代码
         ,Real_Src_Tbl                            --真实源表
         ,Src_Tbl                                 --源表
    FROM ${DB_TEMP}.${mid_tbl} WHERE DATA_TYPE='D'  --插入删除的数据
    ;
