-- task_id: 136762
-- hiveDb: 
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: 
-- observed_at: 2026-09-05T05:38:41.568Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_DOC_INFO (
  Doc_Id STRING COMMENT '档案编号',
  Doc_Type_Cd STRING COMMENT '档案类型代码',
  Doc_Path STRING COMMENT '档案路径',
  Vld_Time STRING COMMENT '生效时间',
  Seq STRING COMMENT '序号',
  Proc_Id STRING COMMENT '流程编号',
  Bel_Doc_Type_Cd STRING COMMENT '归档类型代码',
  Chk_File_Name STRING COMMENT '检查底稿文件名',
  Proc_File_Name STRING COMMENT '流程文件名',
  Del_Flag STRING COMMENT '删除标志',
  Del_Date STRING COMMENT '删除日期',
  Data_Src_Cd STRING COMMENT '数据来源代码',
  Task_Name STRING COMMENT '任务名',
  Data_Etl_Date STRING COMMENT '数据加载日期',
  Data_Upt_Date STRING COMMENT '数据更新日期',
  Data_Time STRING COMMENT '数据时间',
  Doc_Name STRING COMMENT '档案名称',
  Real_Src_Tbl STRING COMMENT '真实源表',
  Invld_Time STRING COMMENT '失效时间',
  File_Type STRING COMMENT '文件类型',
  File_Size STRING COMMENT '文件大小',
  File_Upd_Time STRING COMMENT '文件更新时间',
  Remark STRING COMMENT '备注'
)
COMMENT '档案信息'
PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
STORED AS ORC;

CREATE TABLE IF NOT EXISTS TEMP.T00_DOC_INFO_TEMP_CC2017 AS SELECT CONCAT (
  'CC2017-',
  ID
)
AS Doc_Id --档案编号 ,'02' AS Doc_Type_Cd --档案类型代码 ,'' AS Doc_Path --档案路径 ,CREATE_DATE_TIME AS Vld_Time --生效时间 ,'' AS Seq --序号 ,SOURCE_ID AS Proc_Id --流程编号 ,'' AS Bel_Doc_Type_Cd --归档类型代码 ,'' AS Chk_File_Name --检查底稿文件名 ,TABLE_NAME AS Proc_File_Name --流程文件名 ,'CC2' AS Data_Src_Cd --数据来源代码 ,'ODATA_N_CC2.C_CCB_ARCHIVE_FILES' AS Src_Tbl --源表 ,'PDATA_N.T00_DOC_INFO_CC2017' AS Task_Name --任务名 ,'2026-05-19' AS Data_Etl_Date --数据加载日期 ,'2026-05-19' AS Data_Upt_Date --数据更新日期 ,'' AS Doc_Name --档案名称 ,'ODATA_N_CC2.C_CCB_ARCHIVE_FILES' AS Real_Src_Tbl --真实源表 ,'' AS Invld_Time --失效时间 ,'' AS File_Type --文件类型 ,'' AS File_Size --文件大小 ,'' AS File_Upd_Time --文件更新时间 ,'' AS Remark --备注 FROM ODATA_N_CC2.C_CCB_ARCHIVE_FILES A ;

CREATE TABLE IF NOT EXISTS TEMP.T00_DOC_INFO_MID_CC2017 AS SELECT A.* ,B.Doc_Id AS Doc_Id1 --档案编号 ,B.Doc_Type_Cd AS Doc_Type_Cd1 --档案类型代码 ,B.Doc_Path AS Doc_Path1 --档案路径 ,B.Vld_Time AS Vld_Time1 --生效时间 ,B.Seq AS Seq1 --序号 ,B.Proc_Id AS Proc_Id1 --流程编号 ,B.Bel_Doc_Type_Cd AS Bel_Doc_Type_Cd1 --归档类型代码 ,B.Chk_File_Name AS Chk_File_Name1 --检查底稿文件名 ,B.Proc_File_Name AS Proc_File_Name1 --流程文件名 ,B.DATA_SRC_CD AS DATA_SRC_CD1 --数据来源代码 ,B.SRC_TBL AS SRC_TBL1 --源表 ,B.TASK_NAME AS TASK_NAME1 --任务名 ,B.DATA_ETL_DATE AS DATA_ETL_DATE1 --数据加载日期 ,B.DATA_UPT_DATE AS DATA_UPT_DATE1 --数据更新日期 ,B.Doc_Name AS Doc_Name1 --档案名称 ,B.Real_Src_Tbl AS Real_Src_Tbl1 --真实源表 ,B.Invld_Time AS Invld_Time1 --失效时间 ,B.File_Type AS File_Type1 --文件类型 ,B.File_Size AS File_Size1 --文件大小 ,B.File_Upd_Time AS File_Upd_Time1 --文件更新时间 ,B.Remark AS Remark1 --备注 ,CASE WHEN A.Doc_Id IS NULL AND B.Doc_Id IS NOT NULL THEN 'I' --新增 WHEN A.Doc_Id IS NOT NULL AND B.Doc_Id IS NULL THEN 'D' --删除 WHEN A.Doc_Id IS NOT NULL AND B.Doc_Id IS NOT NULL AND (
  COALESCE(A.Doc_Type_Cd ,'') <> COALESCE(B.Doc_Type_Cd ,'') OR COALESCE(A.Doc_Path ,'') <> COALESCE(B.Doc_Path ,'') OR COALESCE(A.Vld_Time ,'') <> COALESCE(B.Vld_Time ,'') OR COALESCE(A.Seq ,'') <> COALESCE(B.Seq ,'') OR COALESCE(A.Proc_Id ,'') <> COALESCE(B.Proc_Id ,'') OR COALESCE(A.Bel_Doc_Type_Cd ,'') <> COALESCE(B.Bel_Doc_Type_Cd ,'') OR COALESCE(A.Chk_File_Name ,'') <> COALESCE(B.Chk_File_Name ,'') OR COALESCE(A.Proc_File_Name ,'') <> COALESCE(B.Proc_File_Name ,'') OR COALESCE(A.Doc_Name ,'') <> COALESCE(B.Doc_Name ,'') OR COALESCE(A.Invld_Time ,'') <> COALESCE(B.Invld_Time ,'') OR COALESCE(A.File_Type ,'') <> COALESCE(B.File_Type ,'') OR COALESCE(A.File_Size ,'') <> COALESCE(B.File_Size ,'') OR COALESCE(A.File_Upd_Time ,'') <> COALESCE(B.File_Upd_Time ,'') OR COALESCE(A.Remark ,'') <> COALESCE(B.Remark ,'')
)
THEN 'U' --变更 ELSE 'S' --无变更 END AS DATA_TYPE --数据类型 FROM (SELECT * FROM T00_DOC_INFO WHERE SRC_TBL='ODATA_N_CC2.C_CCB_ARCHIVE_FILES')A FULL OUTER JOIN TEMP.T00_DOC_INFO_TEMP_CC2017 B ON A.Doc_Id=B.Doc_Id ;

-- querySql
INSERT OVERWRITE TABLE T00_DOC_INFO PARTITION(SRC_TBL)
SELECT
*
FROM T00_DOC_INFO
WHERE DATA_ETL_DATE !='2026-05-19'
AND SRC_TBL = 'ODATA_N_CC2.C_CCB_ARCHIVE_FILES'
;

DROP TABLE IF EXISTS TEMP.T00_DOC_INFO_TEMP_CC2017;

DROP TABLE IF EXISTS TEMP.T00_DOC_INFO_MID_CC2017;

INSERT OVERWRITE TABLE T00_DOC_INFO PARTITION(SRC_TBL)
SELECT
Doc_Id                                        --档案编号
,Doc_Type_Cd                                   --档案类型代码
,Doc_Path                                      --档案路径
,Vld_Time                                      --生效时间
,Seq                                           --序号
,Proc_Id                                       --流程编号
,Bel_Doc_Type_Cd                               --归档类型代码
,Chk_File_Name                                 --检查底稿文件名
,Proc_File_Name                                --流程文件名
,'0'                     AS Del_Flag           --删除标志
,''                      AS Del_Date           --删除日期
,Data_Src_Cd                                   --数据来源代码
,Task_Name                                     --任务名
,Data_Etl_Date                                 --数据加载日期
,Data_Upt_Date                                 --数据更新日期
,Data_Time                                     --数据时间
,Doc_Name                                      --档案名称
,Real_Src_Tbl                                  --真实源表
,Invld_Time                                    --失效时间
,File_Type                                     --文件类型
,File_Size                                     --文件大小
,File_Upd_Time                                 --文件更新时间
,Remark                                        --备注
,Src_Tbl                                       --源表
FROM TEMP.T00_DOC_INFO_MID_CC2017 WHERE DATA_TYPE='S'  --插入无变化的数据
UNION ALL
SELECT
Doc_Id1                                      AS Doc_Id                   --档案编号
,Doc_Type_Cd1                                    AS Doc_Type_Cd                --档案类型代码
,Doc_Path1                                    AS Doc_Path                 --档案路径
,Vld_Time1                                    AS Vld_Time                 --生效时间
,Seq1                                         AS Seq                      --序号
,Proc_Id1                                     AS Proc_Id                  --流程编号
,Bel_Doc_Type_Cd1                             AS Bel_Doc_Type_Cd          --归档类型代码
,Chk_File_Name1                               AS Chk_File_Name            --检查底稿文件名
,Proc_File_Name1                              AS Proc_File_Name           --流程文件名
,'0'                                          AS Del_Flag                 --删除标志
,''                                           AS Del_Date                 --删除日期
,Data_Src_Cd1                                 AS Data_Src_Cd              --数据来源代码
,Task_Name1                                   AS Task_Name                --任务名
,Data_Etl_Date                                AS Data_Etl_Date            --数据加载日期
,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
,'2026-05-20 04:56:11'                         AS Data_Time                --数据时间
,Doc_Name1                                    AS Doc_Name                 --档案名称
,Real_Src_Tbl1                                AS Real_Src_Tbl             --真实源表
,Invld_Time1                                  AS Invld_Time               --失效时间
,File_Type1                                   AS File_Type                --文件类型
,File_Size1                                   AS File_Size                --文件大小
,File_Upd_Time1                               AS File_Upd_Time            --文件更新时间
,Remark1                                      AS Remark                   --备注
,Src_Tbl1                                     AS Src_Tbl                  --源表
FROM TEMP.T00_DOC_INFO_MID_CC2017  WHERE DATA_TYPE='U'   --有变更的数据取变更的值
UNION ALL
SELECT
Doc_Id1                                      AS Doc_Id                   --档案编号
,Doc_Type_Cd1                                    AS Doc_Type_Cd                --档案类型代码
,Doc_Path1                                    AS Doc_Path                 --档案路径
,Vld_Time1                                    AS Vld_Time                 --生效时间
,Seq1                                         AS Seq                      --序号
,Proc_Id1                                     AS Proc_Id                  --流程编号
,Bel_Doc_Type_Cd1                             AS Bel_Doc_Type_Cd          --归档类型代码
,Chk_File_Name1                               AS Chk_File_Name            --检查底稿文件名
,Proc_File_Name1                              AS Proc_File_Name           --流程文件名
,'0'                                          AS Del_Flag                 --删除标志
,''                                           AS Del_Date                 --删除日期
,Data_Src_Cd1                                 As Data_Src_Cd              --数据来源代码
,Task_Name1                                   As Task_Name                --任务名
,Data_Etl_Date1                               As Data_Etl_Date            --数据加载日期
,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
,'2026-05-20 04:56:11'                         AS Data_Time                --数据时间
,Doc_Name1                                    AS Doc_Name                 --档案名称
,Real_Src_Tbl1                                AS Real_Src_Tbl             --真实源表
,Invld_Time1                                  AS Invld_Time               --失效时间
,File_Type1                                   AS File_Type                --文件类型
,File_Size1                                   AS File_Size                --文件大小
,File_Upd_Time1                               AS File_Upd_Time            --文件更新时间
,Remark1                                      AS Remark                   --备注
,Src_Tbl1                                     AS Src_Tbl                  --源表
FROM TEMP.T00_DOC_INFO_MID_CC2017  WHERE DATA_TYPE='I'   --插入新增的数据
UNION ALL
SELECT
Doc_Id                                                  --档案编号
,Doc_Type_Cd                                               --档案类型代码
,Doc_Path                                                --档案路径
,Vld_Time                                                --生效时间
,Seq                                                     --序号
,Proc_Id                                                 --流程编号
,Bel_Doc_Type_Cd                                         --归档类型代码
,Chk_File_Name                                           --检查底稿文件名
,Proc_File_Name                                          --流程文件名
,'1'                              AS Del_Flag            --删除标志
,CASE WHEN Del_Date !=''
THEN Del_Date
ELSE '2026-05-19'
END                         AS Del_Date            --删除日期
,Data_Src_Cd                                            --数据来源代码
,Task_Name                                              --任务名
,Data_Etl_Date                                          --数据加载日期
,CASE WHEN Del_Date !=''
THEN Data_Upt_Date
ELSE '2026-05-19'
END                         AS Data_Upt_Date       --数据更新日期
,CASE WHEN Del_Date !=''
THEN Data_Time
ELSE '2026-05-20 04:56:11'
END                         AS Data_Time           --数据时间
,Doc_Name                                                --档案名称
,Real_Src_Tbl                                            --真实源表
,Invld_Time                                              --失效时间
,File_Type                                               --文件类型
,File_Size                                               --文件大小
,File_Upd_Time                                           --文件更新时间
,Remark                                                  --备注
,Src_Tbl                                                 --源表
FROM TEMP.T00_DOC_INFO_MID_CC2017 WHERE DATA_TYPE='D'  --插入删除的数据
;
