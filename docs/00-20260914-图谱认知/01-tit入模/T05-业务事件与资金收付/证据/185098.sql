INSERT OVERWRITE TABLE T05_OTC_DERI_EVT_RELA_H PARTITION(SRC_TBL)
SELECT
DISTINCT
Evt_Id                                --事件编号
,Rela_Evt_Id                           --关联事件编号
,Otc_Deri_Evt_Rela_Type_Cd              --场外衍生品事件关系类型代码
,Strt_Date                             --开始日期
,End_Date                              --结束日期
,Data_Src_Cd                           --数据来源代码
,Task_Name                             --任务名
,Data_Time                             --数据时间
,Real_Src_Tbl                          --真实源表
,Src_Tbl                               --源表
FROM (
SELECT
Evt_Id                                --事件编号
,Rela_Evt_Id                           --关联事件编号
,Otc_Deri_Evt_Rela_Type_Cd              --场外衍生品事件关系类型代码
,Strt_Date                             --开始日期
,End_Date                              --结束日期
,Data_Src_Cd                           --数据来源代码
,Task_Name                             --任务名
,Data_Time                             --数据时间
,Real_Src_Tbl                          --真实源表
,Src_Tbl                               --源表
FROM T05_OTC_DERI_EVT_RELA_H
WHERE STRT_DATE !='2026-05-20'
AND END_DATE  !='2026-05-20'
AND SRC_TBL IN ('ODATA_N_TIT.N_OPE_SETTLE_NOTICE_TRANSFER')
UNION ALL
SELECT
Evt_Id                                --事件编号
,Rela_Evt_Id                           --关联事件编号
,Otc_Deri_Evt_Rela_Type_Cd              --场外衍生品事件关系类型代码
,Strt_Date                             --开始日期
,'2099-12-31'  AS End_Date             --结束日期
,Data_Src_Cd                           --数据来源代码
,Task_Name                             --任务名
,Data_Time                             --数据时间
,Real_Src_Tbl                          --真实源表
,Src_Tbl                               --源表
FROM T05_OTC_DERI_EVT_RELA_H
WHERE  END_DATE ='2026-05-20'
AND  SRC_TBL IN ('ODATA_N_TIT.N_OPE_SETTLE_NOTICE_TRANSFER')
) T
;

DROP TABLE IF EXISTS TEMP.T05_OTC_DERI_EVT_RELA_H_TEMP_TIT298;

DROP TABLE IF EXISTS TEMP.T05_OTC_DERI_EVT_RELA_H_MID_TIT298;

INSERT OVERWRITE TABLE T05_OTC_DERI_EVT_RELA_H PARTITION(SRC_TBL)
SELECT
Evt_Id                                                     --事件编号
,Rela_Evt_Id                                                --关联事件编号
,Otc_Deri_Evt_Rela_Type_Cd                                   --场外衍生品事件关系类型代码
,Strt_Date                                                  --开始日期
,End_Date                                                   --结束日期
,Data_Src_Cd                                                --数据来源代码
,Task_Name                                                  --任务名
,Data_Time                                                  --数据时间
,Real_Src_Tbl                                               --真实源表
,Src_Tbl                                                    --源表
FROM T05_OTC_DERI_EVT_RELA_H
WHERE NOT(    STRT_DATE <='2026-05-20'
AND END_DATE  > '2026-05-20'   )
AND SRC_TBL IN ('ODATA_N_TIT.N_OPE_SETTLE_NOTICE_TRANSFER')  --只插入目标表分区字段为该表的数据
UNION ALL
SELECT
Evt_Id1                        AS  Evt_Id                  --事件编号
,Rela_Evt_Id1                   AS  Rela_Evt_Id             --关联事件编号
,Otc_Deri_Evt_Rela_Type_Cd1       AS  Otc_Deri_Evt_Rela_Type_Cd--场外衍生品事件关系类型代码
,'2026-05-20'         AS  Strt_Date               --开始日期
,'2099-12-31'                   AS  End_Date                --结束日期
,Data_Src_Cd1                   AS  Data_Src_Cd             --数据来源代码
,Task_Name1                     AS  Task_Name               --任务名
,'2026-05-21 00:26:42'           AS  Data_Time               --数据时间
,Real_Src_Tbl1                  AS  Real_Src_Tbl            --真实源表
,Src_Tbl1                       AS  Src_Tbl                 --源表
FROM TEMP.T05_OTC_DERI_EVT_RELA_H_MID_TIT298 WHERE DATA_TYPE IN ('I','U')     --新增-I,变更-U
UNION ALL
SELECT
Evt_Id                                                     --事件编号
,Rela_Evt_Id                                                --关联事件编号
,Otc_Deri_Evt_Rela_Type_Cd                                   --场外衍生品事件关系类型代码
,Strt_Date                                                  --开始日期
,'2026-05-20'         AS  End_Date                --结束日期
,Data_Src_Cd                    AS  Data_Src_Cd             --数据来源代码
,Task_Name                      AS  Task_Name               --任务名
,'2026-05-21 00:26:42'            AS  Data_Time               --数据时间
,Real_Src_Tbl                   AS  Real_Src_Tbl            --真实源表
,Src_Tbl                        AS  Src_Tbl                 --源表
FROM TEMP.T05_OTC_DERI_EVT_RELA_H_MID_TIT298 WHERE DATA_TYPE IN ('D','U')     --变更-U,删除-D
UNION ALL
SELECT
Evt_Id                                                     --事件编号
,Rela_Evt_Id                                                --关联事件编号
,Otc_Deri_Evt_Rela_Type_Cd                                   --场外衍生品事件关系类型代码
,Strt_Date                                                  --开始日期
,End_Date                                                   --结束日期
,Data_Src_Cd                                                --数据来源代码
,Task_Name                                                  --任务名
,Data_Time                                                  --数据时间
,Real_Src_Tbl                                               --真实源表
,Src_Tbl                                                    --源表
FROM TEMP.T05_OTC_DERI_EVT_RELA_H_MID_TIT298 WHERE DATA_TYPE ='S'         --无变更-S
;