-- task_id: 247683
-- hiveDb: pdata_n
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_AGNT_SCHD_TASK_ADTNL_INFO_WAS003.py
-- observed_at: 2026-09-05T00:26:28.934Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_AGNT_SCHD_TASK_ADTNL_INFO (
  Task_Id STRING COMMENT '任务编号',
  Exec_Time STRING COMMENT '执行时间',
  Task_Cont STRING COMMENT '任务内容',
  Agnt_Id STRING COMMENT '智能体编号',
  Ntce_Way_Cd STRING COMMENT '通知方式代码',
  Ltm_Run_Time STRING COMMENT '上次运行时间',
  Ntm_Run_Time STRING COMMENT '下次运行时间',
  Pdef_Expr STRING COMMENT '自定义表达式',
  Del_Time STRING COMMENT '删除时间',
  Data_Src_Cd STRING COMMENT '数据来源代码',
  Task_Name STRING COMMENT '任务名',
  Data_Etl_Date STRING COMMENT '数据加载日期',
  Data_Upt_Date STRING COMMENT '数据更新日期',
  Data_Time STRING COMMENT '数据时间',
  Real_Src_Tbl STRING COMMENT '真实源表'
)
COMMENT '智能体调度任务附加信息'
PARTITIONED BY (Src_Tbl STRING COMMENT'源表',Busi_Date STRING COMMENT '业务日期')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_AGNT_SCHD_TASK_ADTNL_INFO PARTITION(Src_Tbl='ODATA_N_WAS.P_AI_SCHEDULER_TASK',Busi_Date='2026-09-03')
SELECT
concat('WAS003-',ID)                              AS  Task_Id                 --任务编号
,EXECUTE_AT                                        AS  Exec_Time               --执行时间
,CONTENT                                           AS  Task_Cont               --任务内容
,AGENT_ID                                          AS  Agnt_Id                 --智能体编号
,NVL(DW_CD_VAL,NOTIFY_TYPE)                        AS  Ntce_Way_Cd             --通知方式代码
,LAST_RUN_AT                                       AS  Ltm_Run_Time            --上次运行时间
,NEXT_RUN_AT                                       AS  Ntm_Run_Time            --下次运行时间
,CRON_EXPRESSION                                   AS  Pdef_Expr               --自定义表达式
,DELETED_AT                                        AS  Del_Time                --删除时间
,'WAS'                             AS  Data_Src_Cd             --数据来源代码
,'PDATA_N.T00_AGNT_SCHD_TASK_ADTNL_INFO_WAS003'                                AS  Task_Name               --任务名
,'2026-09-03'                            AS  Data_Etl_Date           --数据加载日期
,'2026-09-03'                            AS  Data_Upt_Date           --数据更新日期
,'2026-09-04 18:18:48'                              AS  Data_Time               --数据时间
,'ODATA_N_WAS.P_AI_SCHEDULER_TASK'                               AS  Real_Src_Tbl            --真实源表
FROM (SELECT *  FROM ODATA_N_WAS.P_AI_SCHEDULER_TASK WHERE  Busi_Date='2026-09-03' )A
LEFT JOIN (
SELECT SRC_CD_VAL,DW_CD_VAL
FROM PDATA_N.REF_CD_CVT_MAP
WHERE TGT_TAB_NAME = 'T00_AGNT_SCHD_TASK_ADTNL_INFO'
AND TGT_TAB_FLD  = 'Ntce_Way_Cd'
AND SRC_TAB_NAME = 'AI_SCHEDULER_TASK'
AND SRC_FLD_NAME = 'NOTIFY_TYPE'
AND SRC_SYS_NAME='WAS')B
ON      A.NOTIFY_TYPE =B.SRC_CD_VAL                  --NOTIFY_TYPE 转码
;
