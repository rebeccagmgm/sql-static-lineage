-- task_id: 224870
-- hiveDb: 
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: 
-- observed_at: 2026-09-05T07:16:53.231Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_CONT_SET_STAT_H (
  Cont_Set_Id STRING COMMENT '内容集合编号',
  Cont_Set_Stat_Type_Cd STRING COMMENT '内容集合状态类型代码',
  Strt_Date STRING COMMENT '开始日期',
  Cont_Set_Stat_Cd STRING COMMENT '内容集合状态代码',
  End_Date STRING COMMENT '结束日期',
  Data_Src_Cd STRING COMMENT '数据来源代码',
  Task_Name STRING COMMENT '任务名',
  Data_Time STRING COMMENT '数据时间',
  Real_Src_Tbl STRING COMMENT '真实源表'
)
COMMENT '内容集合状态历史'
PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
STORED AS ORC;

CREATE TABLE IF NOT EXISTS TEMP.T00_CONT_SET_STAT_H_TEMP_LMS040 AS SELECT CONCAT (
  'LMS040-',
  SUBJECT_ID
)
AS Cont_Set_Id1 --内容集合编号 ,'01' AS Cont_Set_Stat_Type_Cd1 --内容集合状态类型代码 '01' --内容集合运营状态 ,NVL(B.DW_CD_VAL,STATUS) AS Cont_Set_Stat_Cd1 --内容集合状态代码 ,'LMS' AS Data_Src_Cd1 --数据来源代码 ,'ODATA_N_LMS.I_LMS_SUBJECT' AS Src_Tbl1 --源表 ,'PDATA_N.T00_CONT_SET_STAT_H_LMS040' AS Task_Name1 --任务名 ,'ODATA_N_LMS.I_LMS_SUBJECT' AS Real_Src_Tbl1 --真实源表 FROM (SELECT * FROM ODATA_N_LMS.I_LMS_SUBJECT WHERE BUSI_DATE ='2026-05-23') A LEFT JOIN ( SELECT SRC_CD_VAL,DW_CD_VAL FROM PDATA_N.REF_CD_CVT_MAP_TEMP WHERE TGT_TAB_NAME = 'T00_CONT_SET_STAT_H' AND TGT_TAB_FLD = 'Cont_Set_Stat_Cd' AND SRC_TAB_NAME = 'LMS_SUBJECT' AND SRC_FLD_NAME = 'STATUS' AND SRC_SYS_NAME='LMS')B ON A.STATUS =B.SRC_CD_VAL --STATUS 转码 ;

CREATE TABLE TEMP.T00_CONT_SET_STAT_H_MID_LMS040 AS SELECT A.*,B.* ,CASE WHEN A.Cont_Set_Id IS NULL AND B.Cont_Set_Id1 IS NOT NULL THEN 'I' --当天不存在历史的数据为新增 WHEN A.Cont_Set_Id IS NOT NULL AND B.Cont_Set_Id1 IS NULL THEN 'D' --历史不存在当天的数据为删除 WHEN A.Cont_Set_Id IS NOT NULL AND B.Cont_Set_Id1 IS NOT NULL AND (
  COALESCE(A.Cont_Set_Stat_Cd ,'') <> COALESCE(B.Cont_Set_Stat_Cd1 ,'')
)
THEN 'U' --当天和历史均存在,除主键外如有字段变更为变更 ELSE 'S' END AS DATA_TYPE --其他为无变更 FROM ( SELECT * FROM T00_CONT_SET_STAT_H WHERE STRT_DATE <='2026-05-23' AND END_DATE > '2026-05-23' AND SRC_TBL IN ('ODATA_N_LMS.I_LMS_SUBJECT') )A --历史(昨日)开链数据 FULL OUTER JOIN TEMP.T00_CONT_SET_STAT_H_TEMP_LMS040 B --当天的数据 ON A.Cont_Set_Id= B.Cont_Set_Id1 AND A.Cont_Set_Stat_Type_Cd= B.Cont_Set_Stat_Type_Cd1 ;

-- querySql
INSERT OVERWRITE TABLE T00_CONT_SET_STAT_H PARTITION(SRC_TBL)
SELECT
DISTINCT
Cont_Set_Id                           --内容集合编号
,Cont_Set_Stat_Type_Cd                 --内容集合状态类型代码
,Strt_Date                             --开始日期
,Cont_Set_Stat_Cd                      --内容集合状态代码
,End_Date                              --结束日期
,Data_Src_Cd                           --数据来源代码
,Task_Name                             --任务名
,Data_Time                             --数据时间
,Real_Src_Tbl                          --真实源表
,Src_Tbl                               --源表
FROM (
SELECT
Cont_Set_Id                           --内容集合编号
,Cont_Set_Stat_Type_Cd                 --内容集合状态类型代码
,Strt_Date                             --开始日期
,Cont_Set_Stat_Cd                      --内容集合状态代码
,End_Date                              --结束日期
,Data_Src_Cd                           --数据来源代码
,Task_Name                             --任务名
,Data_Time                             --数据时间
,Real_Src_Tbl                          --真实源表
,Src_Tbl                               --源表
FROM T00_CONT_SET_STAT_H
WHERE STRT_DATE !='2026-05-23'
AND END_DATE  !='2026-05-23'
AND SRC_TBL IN ('ODATA_N_LMS.I_LMS_SUBJECT')
UNION ALL
SELECT
Cont_Set_Id                           --内容集合编号
,Cont_Set_Stat_Type_Cd                 --内容集合状态类型代码
,Strt_Date                             --开始日期
,Cont_Set_Stat_Cd                      --内容集合状态代码
,'2099-12-31'  AS End_Date             --结束日期
,Data_Src_Cd                           --数据来源代码
,Task_Name                             --任务名
,Data_Time                             --数据时间
,Real_Src_Tbl                          --真实源表
,Src_Tbl                               --源表
FROM T00_CONT_SET_STAT_H
WHERE  END_DATE ='2026-05-23'
AND  SRC_TBL IN ('ODATA_N_LMS.I_LMS_SUBJECT')
) T
;

DROP TABLE IF EXISTS TEMP.T00_CONT_SET_STAT_H_TEMP_LMS040;

DROP TABLE IF EXISTS TEMP.T00_CONT_SET_STAT_H_MID_LMS040;

INSERT OVERWRITE TABLE T00_CONT_SET_STAT_H PARTITION(SRC_TBL)
SELECT
Cont_Set_Id                                                --内容集合编号
,Cont_Set_Stat_Type_Cd                                      --内容集合状态类型代码
,Strt_Date                                                  --开始日期
,Cont_Set_Stat_Cd                                           --内容集合状态代码
,End_Date                                                   --结束日期
,Data_Src_Cd                                                --数据来源代码
,Task_Name                                                  --任务名
,Data_Time                                                  --数据时间
,Real_Src_Tbl                                               --真实源表
,Src_Tbl                                                    --源表
FROM T00_CONT_SET_STAT_H
WHERE NOT(    STRT_DATE <='2026-05-23'
AND END_DATE  > '2026-05-23'   )
AND SRC_TBL IN ('ODATA_N_LMS.I_LMS_SUBJECT')  --只插入目标表分区字段为该表的数据
UNION ALL
SELECT
Cont_Set_Id1                   AS  Cont_Set_Id             --内容集合编号
,Cont_Set_Stat_Type_Cd1         AS  Cont_Set_Stat_Type_Cd   --内容集合状态类型代码
,'2026-05-23'         AS  Strt_Date               --开始日期
,Cont_Set_Stat_Cd1              AS  Cont_Set_Stat_Cd        --内容集合状态代码
,'2099-12-31'                   AS  End_Date                --结束日期
,Data_Src_Cd1                   AS  Data_Src_Cd             --数据来源代码
,Task_Name1                     AS  Task_Name               --任务名
,'2026-05-24 07:28:05'           AS  Data_Time               --数据时间
,Real_Src_Tbl1                  AS  Real_Src_Tbl            --真实源表
,Src_Tbl1                       AS  Src_Tbl                 --源表
FROM TEMP.T00_CONT_SET_STAT_H_MID_LMS040 WHERE DATA_TYPE IN ('I','U')     --新增-I,变更-U
UNION ALL
SELECT
Cont_Set_Id                                                --内容集合编号
,Cont_Set_Stat_Type_Cd                                      --内容集合状态类型代码
,Strt_Date                                                  --开始日期
,Cont_Set_Stat_Cd                                           --内容集合状态代码
,'2026-05-23'         AS  End_Date                --结束日期
,Data_Src_Cd                    AS  Data_Src_Cd             --数据来源代码
,Task_Name                      AS  Task_Name               --任务名
,'2026-05-24 07:28:05'           AS  Data_Time               --数据时间
,Real_Src_Tbl                   AS  Real_Src_Tbl            --真实源表
,Src_Tbl                        AS  Src_Tbl                 --源表
FROM TEMP.T00_CONT_SET_STAT_H_MID_LMS040 WHERE DATA_TYPE IN ('D','U')     --变更-U,删除-D
UNION ALL
SELECT
Cont_Set_Id                                                --内容集合编号
,Cont_Set_Stat_Type_Cd                                      --内容集合状态类型代码
,Strt_Date                                                  --开始日期
,Cont_Set_Stat_Cd                                           --内容集合状态代码
,End_Date                                                   --结束日期
,Data_Src_Cd                                                --数据来源代码
,Task_Name                                                  --任务名
,Data_Time                                                  --数据时间
,Real_Src_Tbl                                               --真实源表
,Src_Tbl                                                    --源表
FROM TEMP.T00_CONT_SET_STAT_H_MID_LMS040 WHERE DATA_TYPE ='S'         --无变更-S
;
