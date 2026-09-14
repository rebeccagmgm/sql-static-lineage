-- task_id: 109963
-- hiveDb: 
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: 
-- observed_at: 2026-09-05T02:36:50.857Z

-- createSql
CREATE TABLE IF NOT EXISTS T09_AST_BOOK_USER_RELA_H (
  Ast_Book_Id STRING COMMENT '资产账簿编号',
  Ast_Book_User_Rela_Type_Cd STRING COMMENT '资产账簿用户关系类型代码',
  Strt_Date STRING COMMENT '开始日期',
  User_Id STRING COMMENT '用户编号',
  End_Date STRING COMMENT '结束日期',
  Data_Src_Cd STRING COMMENT '数据来源代码',
  Task_Name STRING COMMENT '任务名',
  Data_Time STRING COMMENT '数据时间'
)
COMMENT '资产账簿用户关系历史'
PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
STORED AS ORC;

CREATE TABLE IF NOT EXISTS TEMP.T09_AST_BOOK_USER_RELA_H_TEMP_ERP063 AS SELECT BOOK_TYPE_CODE AS Ast_Book_Id1 --资产账簿编号 ,'01' AS Ast_Book_User_Rela_Type_Cd1--资产账簿用户关系类型代码 01 --资产账簿使用用户 ,LOWER (
  USER_NAME
)
AS User_Id1 --用户编号 ,'ERP' AS Data_Src_Cd1 --数据来源代码 ,'ODATA_N_ERP.E_CUX_FA_USER_BOOK_LIMIT' AS Src_Tbl1 --源表 ,'PDATA_N.T09_AST_BOOK_USER_RELA_H_ERP063' AS Task_Name1 --任务名 FROM (SELECT *FROM ODATA_N_ERP.E_CUX_FA_USER_BOOK_LIMIT WHERE BUSI_DATE ='2026-05-18') A ;

CREATE TABLE TEMP.T09_AST_BOOK_USER_RELA_H_MID_ERP063 AS SELECT A.*,B.* ,CASE WHEN A.Ast_Book_Id IS NULL AND B.Ast_Book_Id1 IS NOT NULL THEN 'I' --当天不存在历史的数据为新增 WHEN A.Ast_Book_Id IS NOT NULL AND B.Ast_Book_Id1 IS NULL THEN 'D' --历史不存在当天的数据为删除 WHEN A.Ast_Book_Id IS NOT NULL AND B.Ast_Book_Id1 IS NOT NULL AND (
  COALESCE(A.User_Id ,'') <> COALESCE(B.User_Id1 ,'')
)
THEN 'U' --当天和历史均存在,除主键外如有字段变更为变更 ELSE 'S' END AS DATA_TYPE --其他为无变更 FROM ( SELECT * FROM T09_AST_BOOK_USER_RELA_H WHERE STRT_DATE <='2026-05-18' AND END_DATE > '2026-05-18' AND SRC_TBL IN ('ODATA_N_ERP.E_CUX_FA_USER_BOOK_LIMIT') )A --历史(昨日)开链数据 FULL OUTER JOIN TEMP.T09_AST_BOOK_USER_RELA_H_TEMP_ERP063 B --当天的数据 ON A.Ast_Book_Id= B.Ast_Book_Id1 AND A.Ast_Book_User_Rela_Type_Cd= B.Ast_Book_User_Rela_Type_Cd1 AND A.User_Id=B.User_Id1 ;

-- querySql
INSERT OVERWRITE TABLE T09_AST_BOOK_USER_RELA_H PARTITION(SRC_TBL)
SELECT
Ast_Book_Id                           --资产账簿编号
,Ast_Book_User_Rela_Type_Cd              --资产账簿用户关系类型代码
,Strt_Date                             --开始日期
,User_Id                               --用户编号
,End_Date                              --结束日期
,Data_Src_Cd                           --数据来源代码
,Task_Name                             --任务名
,Data_Time                             --数据时间
,Src_Tbl                               --源表
FROM T09_AST_BOOK_USER_RELA_H
WHERE STRT_DATE !='2026-05-18'
AND END_DATE  !='2026-05-18'
AND SRC_TBL IN ('ODATA_N_ERP.E_CUX_FA_USER_BOOK_LIMIT')
UNION ALL
SELECT
Ast_Book_Id                           --资产账簿编号
,Ast_Book_User_Rela_Type_Cd              --资产账簿用户关系类型代码
,Strt_Date                             --开始日期
,User_Id                               --用户编号
,'2099-12-31'  AS End_Date             --结束日期
,Data_Src_Cd                           --数据来源代码
,Task_Name                             --任务名
,Data_Time                             --数据时间
,Src_Tbl                               --源表
FROM T09_AST_BOOK_USER_RELA_H
WHERE  END_DATE ='2026-05-18'
AND  SRC_TBL IN ('ODATA_N_ERP.E_CUX_FA_USER_BOOK_LIMIT')
;

DROP TABLE IF EXISTS TEMP.T09_AST_BOOK_USER_RELA_H_TEMP_ERP063;

DROP TABLE IF EXISTS TEMP.T09_AST_BOOK_USER_RELA_H_MID_ERP063;

INSERT OVERWRITE TABLE T09_AST_BOOK_USER_RELA_H PARTITION(SRC_TBL)
SELECT
Ast_Book_Id                                                --资产账簿编号
,Ast_Book_User_Rela_Type_Cd                                   --资产账簿用户关系类型代码
,Strt_Date                                                  --开始日期
,User_Id                                                    --用户编号
,End_Date                                                   --结束日期
,Data_Src_Cd                                                --数据来源代码
,Task_Name                                                  --任务名
,Data_Time                                                  --数据时间
,Src_Tbl                                                    --源表
FROM T09_AST_BOOK_USER_RELA_H
WHERE NOT(    STRT_DATE <='2026-05-18'
AND END_DATE  > '2026-05-18'   )
AND SRC_TBL IN ('ODATA_N_ERP.E_CUX_FA_USER_BOOK_LIMIT')  --只插入目标表分区字段为该表的数据
UNION ALL
SELECT
Ast_Book_Id1                   AS  Ast_Book_Id             --资产账簿编号
,Ast_Book_User_Rela_Type_Cd1       AS  Ast_Book_User_Rela_Type_Cd--资产账簿用户关系类型代码
,'2026-05-18'         AS  Strt_Date               --开始日期
,User_Id1                       AS  User_Id                 --用户编号
,'2099-12-31'                   AS  End_Date                --结束日期
,Data_Src_Cd1                   AS  Data_Src_Cd             --数据来源代码
,Task_Name1                     AS  Task_Name               --任务名
,'2026-05-19 08:01:54'           AS  Data_Time               --数据时间
,Src_Tbl1                       AS  Src_Tbl                 --源表
FROM TEMP.T09_AST_BOOK_USER_RELA_H_MID_ERP063 WHERE DATA_TYPE IN ('I','U')     --新增-I,变更-U
UNION ALL
SELECT
Ast_Book_Id                                                --资产账簿编号
,Ast_Book_User_Rela_Type_Cd                                   --资产账簿用户关系类型代码
,Strt_Date                                                  --开始日期
,User_Id                                                    --用户编号
,'2026-05-18'         AS  End_Date                --结束日期
,Data_Src_Cd                    AS  Data_Src_Cd             --数据来源代码
,Task_Name                      AS  Task_Name               --任务名
,'2026-05-19 08:01:54'            AS  Data_Time               --数据时间
,Src_Tbl                        AS  Src_Tbl                 --源表
FROM TEMP.T09_AST_BOOK_USER_RELA_H_MID_ERP063 WHERE DATA_TYPE IN ('D','U')     --变更-U,删除-D
UNION ALL
SELECT
Ast_Book_Id                                                --资产账簿编号
,Ast_Book_User_Rela_Type_Cd                                   --资产账簿用户关系类型代码
,Strt_Date                                                  --开始日期
,User_Id                                                    --用户编号
,End_Date                                                   --结束日期
,Data_Src_Cd                                                --数据来源代码
,Task_Name                                                  --任务名
,Data_Time                                                  --数据时间
,Src_Tbl                                                    --源表
FROM TEMP.T09_AST_BOOK_USER_RELA_H_MID_ERP063 WHERE DATA_TYPE ='S'         --无变更-S
;
