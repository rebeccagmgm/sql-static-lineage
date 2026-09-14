-- task_id: 62888
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_ELIG_ANS_SCOR_DEF_RCC177.py
-- observed_at: 2026-09-05T01:06:20.360Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_ELIG_ANS_SCOR_DEF(
Qstnn_Type_Cd   string comment'试卷类型代码',
Prd_Ta_No       string comment'产品TA编号',
Org_Flag        string comment'机构标志',
Qstn_No         string comment'问题编号',
Qstn_Bnk_Cate   string comment'题库类别',
Ans_No          string comment'答案序号',
Ans_Scor        string comment'答案分值',
Remark          string comment'备注',
Elig_Qstnn_Ver  string comment'适当性试卷版本',
Delete_Flag     string comment'删除标志',
Data_Src_Cd     string comment'数据来源代码',
Task_Name       string comment'任务名',
Data_Etl_Date   string comment'数据加载日期',
Data_Upt_Date   string comment'数据更新日期',
Data_Time       string comment '数据时间'
)COMMENT '适当性答案分值定义'
PARTITIONED BY (BUSI_DATE STRING COMMENT '业务日期',Src_Tbl string comment '源表')
STORED AS ORC
;

-- querySql
INSERT OVERWRITE TABLE T00_ELIG_ANS_SCOR_DEF PARTITION(BUSI_DATE,Src_Tbl)
SELECT
paper_type  ,--试卷类别
prodta_no   ,--产品TA编号
organ_flag  ,--机构标志
question_no ,--问题编号
'RCC-QSTN' as Qstn_Bnk_Cate ,--题库类别
answer_no   ,--答案序号
answer_score,--答案分值
remark ,--备注
eligpaper_version,--适当性试卷版本
delete_flag,--删除标志
'RCC' as Data_Src_Cd,--数据来源代码
'PDATA_N.T00_ELIG_ANS_SCOR_DEF_RCC177' as Task_Name,--任务名
'${data_day_str}' as Data_Etl_Date,
'${data_day_str}' as Data_Upt_Date,
'${data_today}' as DATA_TIME,--数据时间
'${data_day_str}' as BUSI_DATE,
'ODATA_N_RCC.A_ELIGANSWERSCORE' as Src_Tbl --源表
FROM ODATA_N_RCC.A_ELIGANSWERSCORE
where busi_date='${data_day_str}'
;
