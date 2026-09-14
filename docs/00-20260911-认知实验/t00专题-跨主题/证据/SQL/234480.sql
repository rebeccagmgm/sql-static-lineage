-- task_id: 234480
-- hiveDb: 
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: 
-- observed_at: 2026-09-05T07:27:17.581Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_INST_ABLT_COMPNT_RELA_H (
  Compnt_Id STRING COMMENT '组件编号',
  Compnt_Rela_Type_Cd STRING COMMENT '组件关系类型代码',
  Strt_Date STRING COMMENT '开始日期',
  Join_Compnt_Id STRING COMMENT '关联组件编号',
  End_Date STRING COMMENT '结束日期',
  Data_Src_Cd STRING COMMENT '数据来源代码',
  Task_Name STRING COMMENT '任务名',
  Data_Time STRING COMMENT '数据时间',
  Real_Src_Tbl STRING COMMENT '真实源表'
)
COMMENT '工具能力组件关系历史'
PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
STORED AS ORC;

CREATE TABLE IF NOT EXISTS TEMP.T00_INST_ABLT_COMPNT_RELA_H_TEMP_MIO072 AS SELECT DISTINCT CONCAT (
  'MIO072-',
  A.ID
)
AS Compnt_Id1 --组件编号 ,'01' AS Compnt_Rela_Type_Cd1 --组件关系类型代码 '01' --调用关系 ,IF(NVL(TRIM(B.ID),'')='','',CONCAT('MIO069-',B.ID)) AS Join_Compnt_Id1 --关联组件编号 ,'MIO' AS Data_Src_Cd1 --数据来源代码 ,'ODATA_N_MIO.H_GUANGZHI_SKILL' AS Src_Tbl1 --源表 ,'PDATA_N.T00_INST_ABLT_COMPNT_RELA_H_MIO072' AS Task_Name1 --任务名 ,'ODATA_N_MIO.H_GUANGZHI_SKILL' AS Real_Src_Tbl1 --真实源表 FROM (SELECT ID ,GET_JSON_OBJECT(T2.JSON_ELEMENT,'$.name') AS NAME FROM ODATA_N_MIO.H_GUANGZHI_SKILL LATERAL VIEW EXPLODE( SPLIT( REGEXP_REPLACE( REGEXP_REPLACE(ALLOW_TOOLS, '\\\\[|\\\\]', ''), '\\\\}, \\\\{', '\\\\}###\\\\{'), '###') ) T2 AS JSON_ELEMENT WHERE BUSI_DATE ='2026-05-24' ) A LEFT JOIN (SELECT * FROM ODATA_N_MIO.H_GUANGZHI_TOOL WHERE BUSI_DATE ='2026-05-24')B ON A.NAME = B.NAME ;

CREATE TABLE TEMP.T00_INST_ABLT_COMPNT_RELA_H_MID_MIO072 AS SELECT A.*,B.* ,CASE WHEN A.Compnt_Id IS NULL AND B.Compnt_Id1 IS NOT NULL THEN 'I' --当天不存在历史的数据为新增 WHEN A.Compnt_Id IS NOT NULL AND B.Compnt_Id1 IS NULL THEN 'D' --历史不存在当天的数据为删除 ELSE 'S' END AS DATA_TYPE --其他为无变更 FROM (
  SELECT * FROM T00_INST_ABLT_COMPNT_RELA_H WHERE STRT_DATE <='2026-05-24' AND END_DATE > '2026-05-24' AND SRC_TBL IN ('ODATA_N_MIO.H_GUANGZHI_SKILL')
)
A --历史(昨日)开链数据 FULL OUTER JOIN TEMP.T00_INST_ABLT_COMPNT_RELA_H_TEMP_MIO072 B --当天的数据 ON NVL(A.Compnt_Id ,'')= NVL(B.Compnt_Id1 ,'') AND NVL(A.Compnt_Rela_Type_Cd,'')= NVL(B.Compnt_Rela_Type_Cd1,'') AND NVL(A.Join_Compnt_Id ,'')= NVL(B.Join_Compnt_Id1 ,'') ;

-- querySql
INSERT OVERWRITE TABLE T00_INST_ABLT_COMPNT_RELA_H PARTITION(SRC_TBL)
SELECT
DISTINCT
Compnt_Id                             --组件编号
,Compnt_Rela_Type_Cd                   --组件关系类型代码
,Strt_Date                             --开始日期
,Join_Compnt_Id                        --关联组件编号
,End_Date                              --结束日期
,Data_Src_Cd                           --数据来源代码
,Task_Name                             --任务名
,Data_Time                             --数据时间
,Real_Src_Tbl                          --真实源表
,Src_Tbl                               --源表
FROM (
SELECT
Compnt_Id                             --组件编号
,Compnt_Rela_Type_Cd                   --组件关系类型代码
,Strt_Date                             --开始日期
,Join_Compnt_Id                        --关联组件编号
,End_Date                              --结束日期
,Data_Src_Cd                           --数据来源代码
,Task_Name                             --任务名
,Data_Time                             --数据时间
,Real_Src_Tbl                          --真实源表
,Src_Tbl                               --源表
FROM T00_INST_ABLT_COMPNT_RELA_H
WHERE STRT_DATE !='2026-05-24'
AND END_DATE  !='2026-05-24'
AND SRC_TBL IN ('ODATA_N_MIO.H_GUANGZHI_SKILL')
UNION ALL
SELECT
Compnt_Id                             --组件编号
,Compnt_Rela_Type_Cd                   --组件关系类型代码
,Strt_Date                             --开始日期
,Join_Compnt_Id                        --关联组件编号
,'2099-12-31'  AS End_Date             --结束日期
,Data_Src_Cd                           --数据来源代码
,Task_Name                             --任务名
,Data_Time                             --数据时间
,Real_Src_Tbl                          --真实源表
,Src_Tbl                               --源表
FROM T00_INST_ABLT_COMPNT_RELA_H
WHERE  END_DATE ='2026-05-24'
AND  SRC_TBL IN ('ODATA_N_MIO.H_GUANGZHI_SKILL')
) T
;

DROP TABLE IF EXISTS TEMP.T00_INST_ABLT_COMPNT_RELA_H_TEMP_MIO072;

DROP TABLE IF EXISTS TEMP.T00_INST_ABLT_COMPNT_RELA_H_MID_MIO072;

INSERT OVERWRITE TABLE T00_INST_ABLT_COMPNT_RELA_H PARTITION(SRC_TBL)
SELECT
Compnt_Id                                                  --组件编号
,Compnt_Rela_Type_Cd                                        --组件关系类型代码
,Strt_Date                                                  --开始日期
,Join_Compnt_Id                                             --关联组件编号
,End_Date                                                   --结束日期
,Data_Src_Cd                                                --数据来源代码
,Task_Name                                                  --任务名
,Data_Time                                                  --数据时间
,Real_Src_Tbl                                               --真实源表
,Src_Tbl                                                    --源表
FROM T00_INST_ABLT_COMPNT_RELA_H
WHERE NOT(    STRT_DATE <='2026-05-24'
AND END_DATE  > '2026-05-24'   )
AND SRC_TBL IN ('ODATA_N_MIO.H_GUANGZHI_SKILL')  --只插入目标表分区字段为该表的数据
UNION ALL
SELECT
Compnt_Id1                     AS  Compnt_Id               --组件编号
,Compnt_Rela_Type_Cd1           AS  Compnt_Rela_Type_Cd     --组件关系类型代码
,'2026-05-24'         AS  Strt_Date               --开始日期
,Join_Compnt_Id1                AS  Join_Compnt_Id          --关联组件编号
,'2099-12-31'                   AS  End_Date                --结束日期
,Data_Src_Cd1                   AS  Data_Src_Cd             --数据来源代码
,Task_Name1                     AS  Task_Name               --任务名
,'2026-05-25 07:56:40'           AS  Data_Time               --数据时间
,Real_Src_Tbl1                  AS  Real_Src_Tbl            --真实源表
,Src_Tbl1                       AS  Src_Tbl                 --源表
FROM TEMP.T00_INST_ABLT_COMPNT_RELA_H_MID_MIO072 WHERE DATA_TYPE IN ('I','U')     --新增-I,变更-U
UNION ALL
SELECT
Compnt_Id                                                  --组件编号
,Compnt_Rela_Type_Cd                                        --组件关系类型代码
,Strt_Date                                                  --开始日期
,Join_Compnt_Id                                             --关联组件编号
,'2026-05-24'         AS  End_Date                --结束日期
,Data_Src_Cd                    AS  Data_Src_Cd             --数据来源代码
,Task_Name                      AS  Task_Name               --任务名
,'2026-05-25 07:56:40'           AS  Data_Time               --数据时间
,Real_Src_Tbl                   AS  Real_Src_Tbl            --真实源表
,Src_Tbl                        AS  Src_Tbl                 --源表
FROM TEMP.T00_INST_ABLT_COMPNT_RELA_H_MID_MIO072 WHERE DATA_TYPE IN ('D','U')     --变更-U,删除-D
UNION ALL
SELECT
Compnt_Id                                                  --组件编号
,Compnt_Rela_Type_Cd                                        --组件关系类型代码
,Strt_Date                                                  --开始日期
,Join_Compnt_Id                                             --关联组件编号
,End_Date                                                   --结束日期
,Data_Src_Cd                                                --数据来源代码
,Task_Name                                                  --任务名
,Data_Time                                                  --数据时间
,Real_Src_Tbl                                               --真实源表
,Src_Tbl                                                    --源表
FROM TEMP.T00_INST_ABLT_COMPNT_RELA_H_MID_MIO072 WHERE DATA_TYPE ='S'         --无变更-S
;
