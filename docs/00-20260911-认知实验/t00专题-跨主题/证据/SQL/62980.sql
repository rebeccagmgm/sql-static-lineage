-- task_id: 62980
-- hiveDb: PDATA_N
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_QSTN_INFO_CC2003.py
-- observed_at: 2026-09-05T01:06:20.853Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_QSTN_INFO(
Qstn_No       string comment '问题编号',
Qstn_Bnk_Cate string comment '题库类别',
Seri_No       string comment '顺序号',
Qstn_Kind_Cd  string comment '试题种类代码',
Qstn_Type_Cd  string comment '试题类型代码',
Qstn_Cont     string comment '试题内容',
Qstn_Std_Ans  string comment '试题标准答案',
Use_Flag      string comment '使用信息标志',
Remark        string comment '备注',
Qstn_Prop     string comment '试题属性',
Data_Src_Cd   string comment '数据来源代码',
Task_Name     string comment '任务名',
Data_Etl_Date string comment '数据加载日期',
Data_Upt_Date string comment '数据更新日期',
DATA_TIME     string comment '数据时间'
)COMMENT '试题信息'
PARTITIONED BY (BUSI_DATE STRING COMMENT '业务日期',Src_Tbl string comment '源表')
STORED AS ORC
;

-- querySql
INSERT OVERWRITE TABLE T00_QSTN_INFO PARTITION(BUSI_DATE,Src_Tbl)
-----------------------------------------------------------------------------------------------------
--Group2: Source Table:[ODATA_N_CC2.C_CCB_QUESTION:问卷题目]
-----------------------------------------------------------------------------------------------------
SELECT
      QUESTION_ID                    AS Qstn_No         --问题编号
     ,'CC2-QSTN-MAN'                 AS Qstn_Bnk_Cate   --题库类别
     ,''                             AS Seri_No         --顺序号
     ,NVL(DW_CD_VAL,QUESTION_TYPE)   AS Qstn_Kind_Cd    --试题种类代码
     ,''                             AS Qstn_Type_Cd    --试题类型代码
     ,QUESTION_CONTENT               AS Qstn_Cont       --试题内容
     ,QUESTION_STANDARD_ANSWER       AS Qstn_Std_Ans    --试题标准答案
     ,QUESTION_ENABLE                AS Use_Flag        --使用标志
     ,QUESTION_REMARK                AS Remark          --备注
     ,''                             AS Qstn_Prop	    --试题属性
     ,'${data_src_cd}'          AS Data_Src_Cd     --数据来源代码
     ,'${filename}'             AS Task_Name       --任务名
     ,'${data_day_str}'         AS Data_Etl_Date   --数据加载日期
     ,'${data_day_str}'         AS Data_Upt_Date   --数据更新日期
     ,'${data_today}'           AS DATA_TIME       --数据时间
     ,CALLBACK_BUSINESS_ID           AS Clbk_Busi_Id    --回访业务编号
     ,'${data_day_str}'         AS BUSI_DATE       --业务日期
     ,'${src_table}'            AS Src_Tbl         --源表
FROM ${src_table} A
LEFT JOIN (
          SELECT SRC_CD_VAL,DW_CD_VAL
          FROM PDATA_N.REF_CD_CVT_MAP
          WHERE TGT_TAB_NAME = 'T00_QSTN_INFO'
            AND TGT_TAB_FLD  = 'Qstn_Kind_Cd'
            AND SRC_TAB_NAME = 'CCB_QUESTION'
            AND SRC_FLD_NAME = 'QUESTION_TYPE'
            AND SRC_SYS_NAME= '${data_src_cd}' ) C
ON        A.QUESTION_TYPE = C.SRC_CD_VAL                  --QUESTION_TYPE转码
WHERE BUSI_DATE='${data_day_str}'
UNION ALL
-----------------------------------------------------------------------------------------------------
--Group3: Source Table:[ODATA_N_CC2.C_CCB_QUESTION:问卷题目]
-----------------------------------------------------------------------------------------------------
SELECT
      QUESTION_ID                    AS Qstn_No         --问题编号
     ,'CC2-QSTN-AUTO'                AS Qstn_Bnk_Cate   --题库类别
     ,''                             AS Seri_No         --顺序号
     ,NVL(DW_CD_VAL,QUESTION_TYPE)   AS Qstn_Kind_Cd    --试题种类代码
     ,''                             AS Qstn_Type_Cd    --试题类型代码
     ,QUESTION_SELF_CONTENT          AS Qstn_Cont       --试题内容
     ,QUESTION_STANDARD_ANSWER       AS Qstn_Std_Ans    --试题标准答案
     ,QUESTION_SELF_ENABLE           AS Use_Flag        --使用标志
     ,QUESTION_SELF_REMARK           AS Remark          --备注
     ,''                             AS Qstn_Prop	    --试题属性
     ,'${data_src_cd}'          AS Data_Src_Cd     --数据来源代码
     ,'${filename}'             AS Task_Name       --任务名
     ,'${data_day_str}'         AS Data_Etl_Date   --数据加载日期
     ,'${data_day_str}'         AS Data_Upt_Date   --数据更新日期
     ,'${data_today}'           AS DATA_TIME       --数据时间
     ,CALLBACK_BUSINESS_ID           AS Clbk_Busi_Id    --回访业务编号
     ,'${data_day_str}'         AS BUSI_DATE       --业务日期
     ,'${src_table}'            AS Src_Tbl         --源表
FROM ${src_table} A
LEFT JOIN (
          SELECT SRC_CD_VAL,DW_CD_VAL
          FROM PDATA_N.REF_CD_CVT_MAP
          WHERE TGT_TAB_NAME = 'T00_QSTN_INFO'
            AND TGT_TAB_FLD  = 'Qstn_Kind_Cd'
            AND SRC_TAB_NAME = 'CCB_QUESTION'
            AND SRC_FLD_NAME = 'QUESTION_TYPE'
            AND SRC_SYS_NAME= '${data_src_cd}' ) C
ON        A.QUESTION_TYPE = C.SRC_CD_VAL                  --QUESTION_TYPE转码
WHERE BUSI_DATE='${data_day_str}'
;
