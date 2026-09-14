-- task_id: 136764
-- hiveDb: 
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: 
-- observed_at: 2026-09-05T05:38:45.646Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_DOC_EVT_RELA_H (
  Doc_Id STRING COMMENT '档案编号',
  Doc_Evt_Rela_Type_Cd STRING COMMENT '档案事件关系类型代码',
  Evt_Id STRING COMMENT '事件编号',
  Strt_Date STRING COMMENT '开始日期',
  End_Date STRING COMMENT '结束日期',
  Data_Src_Cd STRING COMMENT '数据来源代码',
  Task_Name STRING COMMENT '任务名',
  Data_Time STRING COMMENT '数据时间'
)
COMMENT '档案事件关系历史'
PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
STORED AS ORC;

CREATE TABLE IF NOT EXISTS TEMP.T00_DOC_EVT_RELA_H_TEMP_CC2017 AS SELECT CONCAT (
  'CC2017-',
  ID
)
AS Doc_Id1 --档案编号 ,'02' AS Doc_Evt_Rela_Type_Cd1 --档案事件关系类型代码 '02'--呼叫中心回访事件归档 ,SOURCE_ID AS Evt_Id1 --事件编号 ,'CC2' AS Data_Src_Cd1 --数据来源代码 ,'ODATA_N_CC2.C_CCB_ARCHIVE_FILES' AS Src_Tbl1 --源表 ,'PDATA_N.T00_DOC_EVT_RELA_H_CC2017' AS Task_Name1 --任务名 FROM ODATA_N_CC2.C_CCB_ARCHIVE_FILES A ;

CREATE TABLE TEMP.T00_DOC_EVT_RELA_H_MID_CC2017 AS SELECT A.*,B.* ,CASE WHEN A.Doc_Id IS NULL AND B.Doc_Id1 IS NOT NULL THEN 'I' --当天不存在历史的数据为新增 WHEN A.Doc_Id IS NOT NULL AND B.Doc_Id1 IS NULL THEN 'D' --历史不存在当天的数据为删除 WHEN A.Doc_Id IS NOT NULL AND B.Doc_Id1 IS NOT NULL AND (
  COALESCE(A.Evt_Id ,'') <> COALESCE(B.Evt_Id1 ,'')
)
THEN 'U' --当天和历史均存在,除主键外如有字段变更为变更 ELSE 'S' END AS DATA_TYPE --其他为无变更 FROM ( SELECT * FROM T00_DOC_EVT_RELA_H WHERE STRT_DATE <='2026-05-19' AND END_DATE > '2026-05-19' AND SRC_TBL IN ('ODATA_N_CC2.C_CCB_ARCHIVE_FILES') )A --历史(昨日)开链数据 FULL OUTER JOIN TEMP.T00_DOC_EVT_RELA_H_TEMP_CC2017 B --当天的数据 ON A.Doc_Id= B.Doc_Id1 AND A.Doc_Evt_Rela_Type_Cd= B.Doc_Evt_Rela_Type_Cd1 ;

-- querySql
INSERT OVERWRITE TABLE T00_DOC_EVT_RELA_H PARTITION(SRC_TBL)
SELECT
Doc_Id                                --档案编号
,Doc_Evt_Rela_Type_Cd                  --档案事件关系类型代码
,Evt_Id                                --事件编号
,Strt_Date                             --开始日期
,End_Date                              --结束日期
,Data_Src_Cd                           --数据来源代码
,Task_Name                             --任务名
,Data_Time                             --数据时间
,Src_Tbl                               --源表
FROM T00_DOC_EVT_RELA_H
WHERE STRT_DATE !='2026-05-19'
AND END_DATE  !='2026-05-19'
AND SRC_TBL IN ('ODATA_N_CC2.C_CCB_ARCHIVE_FILES')
UNION ALL
SELECT
Doc_Id                                --档案编号
,Doc_Evt_Rela_Type_Cd                  --档案事件关系类型代码
,Evt_Id                                --事件编号
,Strt_Date                             --开始日期
,'2099-12-31'  AS End_Date             --结束日期
,Data_Src_Cd                           --数据来源代码
,Task_Name                             --任务名
,Data_Time                             --数据时间
,Src_Tbl                               --源表
FROM T00_DOC_EVT_RELA_H
WHERE  END_DATE ='2026-05-19'
AND  SRC_TBL IN ('ODATA_N_CC2.C_CCB_ARCHIVE_FILES')
;

DROP TABLE IF EXISTS TEMP.T00_DOC_EVT_RELA_H_TEMP_CC2017;

DROP TABLE IF EXISTS TEMP.T00_DOC_EVT_RELA_H_MID_CC2017;

INSERT OVERWRITE TABLE T00_DOC_EVT_RELA_H PARTITION(SRC_TBL)
SELECT
Doc_Id                                                     --档案编号
,Doc_Evt_Rela_Type_Cd                                       --档案事件关系类型代码
,Evt_Id                                                     --事件编号
,Strt_Date                                                  --开始日期
,End_Date                                                   --结束日期
,Data_Src_Cd                                                --数据来源代码
,Task_Name                                                  --任务名
,Data_Time                                                  --数据时间
,Src_Tbl                                                    --源表
FROM T00_DOC_EVT_RELA_H
WHERE NOT(    STRT_DATE <='2026-05-19'
AND END_DATE  > '2026-05-19'   )
AND SRC_TBL IN ('ODATA_N_CC2.C_CCB_ARCHIVE_FILES')  --只插入目标表分区字段为该表的数据
UNION ALL
SELECT
Doc_Id1                        AS  Doc_Id                  --档案编号
,Doc_Evt_Rela_Type_Cd1          AS  Doc_Evt_Rela_Type_Cd    --档案事件关系类型代码
,Evt_Id1                        AS  Evt_Id                  --事件编号
,'2026-05-19'         AS  Strt_Date               --开始日期
,'2099-12-31'                   AS  End_Date                --结束日期
,Data_Src_Cd1                   AS  Data_Src_Cd             --数据来源代码
,Task_Name1                     AS  Task_Name               --任务名
,'2026-05-20 04:56:22'           AS  Data_Time               --数据时间
,Src_Tbl1                       AS  Src_Tbl                 --源表
FROM TEMP.T00_DOC_EVT_RELA_H_MID_CC2017 WHERE DATA_TYPE IN ('I','U')     --新增-I,变更-U
UNION ALL
SELECT
Doc_Id                                                     --档案编号
,Doc_Evt_Rela_Type_Cd                                       --档案事件关系类型代码
,Evt_Id                                                     --事件编号
,Strt_Date                                                  --开始日期
,'2026-05-19'         AS  End_Date                --结束日期
,Data_Src_Cd                    AS  Data_Src_Cd             --数据来源代码
,Task_Name                      AS  Task_Name               --任务名
,'2026-05-20 04:56:22'            AS  Data_Time               --数据时间
,Src_Tbl                        AS  Src_Tbl                 --源表
FROM TEMP.T00_DOC_EVT_RELA_H_MID_CC2017 WHERE DATA_TYPE IN ('D','U')     --变更-U,删除-D
UNION ALL
SELECT
Doc_Id                                                     --档案编号
,Doc_Evt_Rela_Type_Cd                                       --档案事件关系类型代码
,Evt_Id                                                     --事件编号
,Strt_Date                                                  --开始日期
,End_Date                                                   --结束日期
,Data_Src_Cd                                                --数据来源代码
,Task_Name                                                  --任务名
,Data_Time                                                  --数据时间
,Src_Tbl                                                    --源表
FROM TEMP.T00_DOC_EVT_RELA_H_MID_CC2017 WHERE DATA_TYPE ='S'         --无变更-S
;
