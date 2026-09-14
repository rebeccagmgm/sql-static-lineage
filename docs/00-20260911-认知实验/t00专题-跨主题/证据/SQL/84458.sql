-- task_id: 84458
-- hiveDb: 
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: 
-- observed_at: 2026-09-05T02:23:48.897Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_SEAL_INFO (
  Seal_Id STRING COMMENT '印章编号',
  Seal_Name STRING COMMENT '印章名称',
  Seal_Type_Cd STRING COMMENT '印章类型代码',
  Seal_Shape STRING COMMENT '印章形状',
  Seal_Mngr_User_Id STRING COMMENT '印章专管员编号',
  Seal_Keep_Inr_Org_Id STRING COMMENT '印章保管部门编号',
  Seal_Own_Inr_Org_Id STRING COMMENT '印章所属部门编号',
  Seal_Stat_Cd STRING COMMENT '印章状态代码',
  Vld_Flag STRING COMMENT '有效标志',
  Enable_Date STRING COMMENT '启用日期',
  Deact_Date STRING COMMENT '停用日期',
  Destr_Date STRING COMMENT '销毁日期',
  Seal_App_Proc_Id STRING COMMENT '印章申请流程流程id',
  Proc_Title STRING COMMENT '流程标题',
  Seal_Own_Grp STRING COMMENT '印章所属集团',
  Elec_Sign_Id STRING COMMENT '电子签章编号',
  Elec_Seal_Signaty_Type STRING COMMENT '电子章签约方类型',
  Elec_Seal_Signaty_Cd STRING COMMENT '电子章签约方代码',
  Elec_Seal_Type STRING COMMENT '电子章印章类型',
  Exam_Id STRING COMMENT '印章管理考试编号',
  Exam_Pass_Flag STRING COMMENT '考试通过标志',
  Remark STRING COMMENT '备注',
  Create_User_Id STRING COMMENT '创建人用户编号',
  Create_Date STRING COMMENT '创建时间',
  Upd_User_Id STRING COMMENT '修改人用户编号',
  Upd_Date STRING COMMENT '修改日期',
  Del_Flag STRING COMMENT '删除标志',
  Del_Date STRING COMMENT '删除日期',
  Data_Src_Cd STRING COMMENT '数据来源代码',
  Task_Name STRING COMMENT '任务名',
  Data_Etl_Date STRING COMMENT '数据加载日期',
  Data_Upt_Date STRING COMMENT '数据更新日期',
  Data_Time STRING COMMENT '数据时间'
)
COMMENT '印章基本信息'
PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
STORED AS ORC;

CREATE TABLE IF NOT EXISTS TEMP.T00_SEAL_INFO_TEMP_BPM005 AS SELECT CONCAT (
  'BPM005-',
  ID
)
AS Seal_Id --印章编号 ,SEAL_NAME AS Seal_Name --印章名称 ,SEAL_TYPE AS Seal_Type_Cd --印章类型代码 ,SEAL_SHAPE AS Seal_Shape --印章形状 ,SEAL_MANAGER_ID AS Seal_Mngr_User_Id --印章专管员编号 ,SEAL_KEEPING_DEPT_ID AS Seal_Keep_Inr_Org_Id --印章保管部门编号 ,SEAL_THE_DEPT_ID AS Seal_Own_Inr_Org_Id --印章所属部门编号 ,STATE AS Seal_Stat_Cd --印章状态代码 ,IS_AVAILABLE AS Vld_Flag --有效标志 ,ENABLE_DATE AS Enable_Date --启用日期 ,DEACTIVATE_DATE AS Deact_Date --停用日期 ,DESTRUCTION_DATE AS Destr_Date --销毁日期 ,ASSOCIATED_DOCUMENT_ID AS Seal_App_Proc_Id --印章申请流程流程id ,ASSOCIATED_TITLE AS Proc_Title --流程标题 ,CORP_ID AS Seal_Own_Grp --印章所属集团 ,ESIGN_ID AS Elec_Sign_Id --电子签章编号 ,ESIGN_SIGNATORY_TYPE AS Elec_Seal_Signaty_Type --电子章签约方类型 ,ESIGN_SIGNATORY_CODE AS Elec_Seal_Signaty_Cd --电子章签约方代码 ,ESIGN_SEAL_TYPE AS Elec_Seal_Type --电子章印章类型 ,EXAM_ID AS Exam_Id --印章管理考试编号 ,EXAM_PASS AS Exam_Pass_Flag --考试通过标志 ,REMARKS AS Remark --备注 ,CREATE_USER AS Create_User_Id --创建人用户编号 ,CREATE_DATE AS Create_Date --创建时间 ,UPDATE_USER AS Upd_User_Id --修改人用户编号 ,UPDATE_DATE AS Upd_Date --修改日期 ,'BPM' AS Data_Src_Cd --数据来源代码 ,'ODATA_N_BPM.G_OA_SEAL_DETAILED' AS Src_Tbl --源表 ,'PDATA_N.T00_SEAL_INFO_BPM005' AS Task_Name --任务名 ,'2026-05-21' AS Data_Etl_Date --数据加载日期 ,'2026-05-21' AS Data_Upt_Date --数据更新日期 FROM (SELECT * FROM ODATA_N_BPM.G_OA_SEAL_DETAILED WHERE BUSI_DATE='2026-05-21' )A ;

CREATE TABLE IF NOT EXISTS TEMP.T00_SEAL_INFO_MID_BPM005 AS SELECT A.* ,B.Seal_Id AS Seal_Id1 --印章编号 ,B.Seal_Name AS Seal_Name1 --印章名称 ,B.Seal_Type_Cd AS Seal_Type_Cd1 --印章类型代码 ,B.Seal_Shape AS Seal_Shape1 --印章形状 ,B.Seal_Mngr_User_Id AS Seal_Mngr_User_Id1 --印章专管员编号 ,B.Seal_Keep_Inr_Org_Id AS Seal_Keep_Inr_Org_Id1 --印章保管部门编号 ,B.Seal_Own_Inr_Org_Id AS Seal_Own_Inr_Org_Id1 --印章所属部门编号 ,B.Seal_Stat_Cd AS Seal_Stat_Cd1 --印章状态代码 ,B.Vld_Flag AS Vld_Flag1 --有效标志 ,B.Enable_Date AS Enable_Date1 --启用日期 ,B.Deact_Date AS Deact_Date1 --停用日期 ,B.Destr_Date AS Destr_Date1 --销毁日期 ,B.Seal_App_Proc_Id AS Seal_App_Proc_Id1 --印章申请流程流程id ,B.Proc_Title AS Proc_Title1 --流程标题 ,B.Seal_Own_Grp AS Seal_Own_Grp1 --印章所属集团 ,B.Elec_Sign_Id AS Elec_Sign_Id1 --电子签章编号 ,B.Elec_Seal_Signaty_Type AS Elec_Seal_Signaty_Type1 --电子章签约方类型 ,B.Elec_Seal_Signaty_Cd AS Elec_Seal_Signaty_Cd1 --电子章签约方代码 ,B.Elec_Seal_Type AS Elec_Seal_Type1 --电子章印章类型 ,B.Exam_Id AS Exam_Id1 --印章管理考试编号 ,B.Exam_Pass_Flag AS Exam_Pass_Flag1 --考试通过标志 ,B.Remark AS Remark1 --备注 ,B.Create_User_Id AS Create_User_Id1 --创建人用户编号 ,B.Create_Date AS Create_Date1 --创建时间 ,B.Upd_User_Id AS Upd_User_Id1 --修改人用户编号 ,B.Upd_Date AS Upd_Date1 --修改日期 ,B.DATA_SRC_CD AS DATA_SRC_CD1 --数据来源代码 ,B.SRC_TBL AS SRC_TBL1 --源表 ,B.TASK_NAME AS TASK_NAME1 --任务名 ,B.DATA_ETL_DATE AS DATA_ETL_DATE1 --数据加载日期 ,B.DATA_UPT_DATE AS DATA_UPT_DATE1 --数据更新日期 ,CASE WHEN A.Seal_Id IS NULL AND B.Seal_Id IS NOT NULL THEN 'I' --新增 WHEN A.Seal_Id IS NOT NULL AND B.Seal_Id IS NULL THEN 'D' --删除 WHEN A.Seal_Id IS NOT NULL AND B.Seal_Id IS NOT NULL AND (
  COALESCE(A.Seal_Name ,'') <> COALESCE(B.Seal_Name ,'') OR COALESCE(A.Seal_Type_Cd ,'') <> COALESCE(B.Seal_Type_Cd ,'') OR COALESCE(A.Seal_Shape ,'') <> COALESCE(B.Seal_Shape ,'') OR COALESCE(A.Seal_Mngr_User_Id ,'') <> COALESCE(B.Seal_Mngr_User_Id ,'') OR COALESCE(A.Seal_Keep_Inr_Org_Id ,'') <> COALESCE(B.Seal_Keep_Inr_Org_Id ,'') OR COALESCE(A.Seal_Own_Inr_Org_Id ,'') <> COALESCE(B.Seal_Own_Inr_Org_Id ,'') OR COALESCE(A.Seal_Stat_Cd ,'') <> COALESCE(B.Seal_Stat_Cd ,'') OR COALESCE(A.Vld_Flag ,'') <> COALESCE(B.Vld_Flag ,'') OR COALESCE(A.Enable_Date ,'') <> COALESCE(B.Enable_Date ,'') OR COALESCE(A.Deact_Date ,'') <> COALESCE(B.Deact_Date ,'') OR COALESCE(A.Destr_Date ,'') <> COALESCE(B.Destr_Date ,'') OR COALESCE(A.Seal_App_Proc_Id ,'') <> COALESCE(B.Seal_App_Proc_Id ,'') OR COALESCE(A.Proc_Title ,'') <> COALESCE(B.Proc_Title ,'') OR COALESCE(A.Seal_Own_Grp ,'') <> COALESCE(B.Seal_Own_Grp ,'') OR COALESCE(A.Elec_Sign_Id ,'') <> COALESCE(B.Elec_Sign_Id ,'') OR COALESCE(A.Elec_Seal_Signaty_Type ,'') <> COALESCE(B.Elec_Seal_Signaty_Type ,'') OR COALESCE(A.Elec_Seal_Signaty_Cd ,'') <> COALESCE(B.Elec_Seal_Signaty_Cd ,'') OR COALESCE(A.Elec_Seal_Type ,'') <> COALESCE(B.Elec_Seal_Type ,'') OR COALESCE(A.Exam_Id ,'') <> COALESCE(B.Exam_Id ,'') OR COALESCE(A.Exam_Pass_Flag ,'') <> COALESCE(B.Exam_Pass_Flag ,'') OR COALESCE(A.Remark ,'') <> COALESCE(B.Remark ,'') OR COALESCE(A.Create_User_Id ,'') <> COALESCE(B.Create_User_Id ,'') OR COALESCE(A.Create_Date ,'') <> COALESCE(B.Create_Date ,'') OR COALESCE(A.Upd_User_Id ,'') <> COALESCE(B.Upd_User_Id ,'') OR COALESCE(A.Upd_Date ,'') <> COALESCE(B.Upd_Date ,'')
)
THEN 'U' --变更 ELSE 'S' --无变更 END AS DATA_TYPE --数据类型 FROM (SELECT * FROM T00_SEAL_INFO WHERE SRC_TBL='ODATA_N_BPM.G_OA_SEAL_DETAILED')A FULL OUTER JOIN TEMP.T00_SEAL_INFO_TEMP_BPM005 B ON A.Seal_Id=B.Seal_Id ;

-- querySql
INSERT OVERWRITE TABLE T00_SEAL_INFO PARTITION(SRC_TBL)
SELECT
*
FROM T00_SEAL_INFO
WHERE DATA_ETL_DATE !='2026-05-21'
AND SRC_TBL = 'ODATA_N_BPM.G_OA_SEAL_DETAILED'
;

DROP TABLE IF EXISTS TEMP.T00_SEAL_INFO_TEMP_BPM005;

DROP TABLE IF EXISTS TEMP.T00_SEAL_INFO_MID_BPM005;

INSERT OVERWRITE TABLE T00_SEAL_INFO PARTITION(SRC_TBL)
SELECT
Seal_Id                                       --印章编号
,Seal_Name                                     --印章名称
,Seal_Type_Cd                                  --印章类型代码
,Seal_Shape                                    --印章形状
,Seal_Mngr_User_Id                             --印章专管员编号
,Seal_Keep_Inr_Org_Id                          --印章保管部门编号
,Seal_Own_Inr_Org_Id                           --印章所属部门编号
,Seal_Stat_Cd                                  --印章状态代码
,Vld_Flag                                      --有效标志
,Enable_Date                                   --启用日期
,Deact_Date                                    --停用日期
,Destr_Date                                    --销毁日期
,Seal_App_Proc_Id                              --印章申请流程流程id
,Proc_Title                                    --流程标题
,Seal_Own_Grp                                  --印章所属集团
,Elec_Sign_Id                                  --电子签章编号
,Elec_Seal_Signaty_Type                        --电子章签约方类型
,Elec_Seal_Signaty_Cd                          --电子章签约方代码
,Elec_Seal_Type                                --电子章印章类型
,Exam_Id                                       --印章管理考试编号
,Exam_Pass_Flag                                --考试通过标志
,Remark                                        --备注
,Create_User_Id                                --创建人用户编号
,Create_Date                                   --创建时间
,Upd_User_Id                                   --修改人用户编号
,Upd_Date                                      --修改日期
,'0'                     AS Del_Flag           --删除标志
,''                      AS Del_Date           --删除日期
,Data_Src_Cd                                   --数据来源代码
,Task_Name                                     --任务名
,Data_Etl_Date                                 --数据加载日期
,Data_Upt_Date                                 --数据更新日期
,Data_Time                                     --数据时间
,Src_Tbl                                       --源表
FROM TEMP.T00_SEAL_INFO_MID_BPM005 WHERE DATA_TYPE='S'  --插入无变化的数据
UNION ALL
SELECT
Seal_Id1                                     AS Seal_Id                  --印章编号
,Seal_Name1                                   AS Seal_Name                --印章名称
,Seal_Type_Cd1                                AS Seal_Type_Cd             --印章类型代码
,Seal_Shape1                                  AS Seal_Shape               --印章形状
,Seal_Mngr_User_Id1                           AS Seal_Mngr_User_Id        --印章专管员编号
,Seal_Keep_Inr_Org_Id1                        AS Seal_Keep_Inr_Org_Id     --印章保管部门编号
,Seal_Own_Inr_Org_Id1                         AS Seal_Own_Inr_Org_Id      --印章所属部门编号
,Seal_Stat_Cd1                                AS Seal_Stat_Cd             --印章状态代码
,Vld_Flag1                                    AS Vld_Flag                 --有效标志
,Enable_Date1                                 AS Enable_Date              --启用日期
,Deact_Date1                                  AS Deact_Date               --停用日期
,Destr_Date1                                  AS Destr_Date               --销毁日期
,Seal_App_Proc_Id1                            AS Seal_App_Proc_Id         --印章申请流程流程id
,Proc_Title1                                  AS Proc_Title               --流程标题
,Seal_Own_Grp1                                AS Seal_Own_Grp             --印章所属集团
,Elec_Sign_Id1                                AS Elec_Sign_Id             --电子签章编号
,Elec_Seal_Signaty_Type1                      AS Elec_Seal_Signaty_Type   --电子章签约方类型
,Elec_Seal_Signaty_Cd1                        AS Elec_Seal_Signaty_Cd     --电子章签约方代码
,Elec_Seal_Type1                              AS Elec_Seal_Type           --电子章印章类型
,Exam_Id1                                     AS Exam_Id                  --印章管理考试编号
,Exam_Pass_Flag1                              AS Exam_Pass_Flag           --考试通过标志
,Remark1                                      AS Remark                   --备注
,Create_User_Id1                              AS Create_User_Id           --创建人用户编号
,Create_Date1                                 AS Create_Date              --创建时间
,Upd_User_Id1                                 AS Upd_User_Id              --修改人用户编号
,Upd_Date1                                    AS Upd_Date                 --修改日期
,'0'                                          AS Del_Flag                 --删除标志
,''                                           AS Del_Date                 --删除日期
,Data_Src_Cd1                                 AS Data_Src_Cd              --数据来源代码
,Task_Name1                                   AS Task_Name                --任务名
,Data_Etl_Date                                AS Data_Etl_Date            --数据加载日期
,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
,'2026-05-22 03:05:00'                         AS Data_Time                --数据时间
,Src_Tbl1                                     AS Src_Tbl                  --源表
FROM TEMP.T00_SEAL_INFO_MID_BPM005  WHERE DATA_TYPE='U'   --有变更的数据取变更的值
UNION ALL
SELECT
Seal_Id1                                     AS Seal_Id                  --印章编号
,Seal_Name1                                   AS Seal_Name                --印章名称
,Seal_Type_Cd1                                AS Seal_Type_Cd             --印章类型代码
,Seal_Shape1                                  AS Seal_Shape               --印章形状
,Seal_Mngr_User_Id1                           AS Seal_Mngr_User_Id        --印章专管员编号
,Seal_Keep_Inr_Org_Id1                        AS Seal_Keep_Inr_Org_Id     --印章保管部门编号
,Seal_Own_Inr_Org_Id1                         AS Seal_Own_Inr_Org_Id      --印章所属部门编号
,Seal_Stat_Cd1                                AS Seal_Stat_Cd             --印章状态代码
,Vld_Flag1                                    AS Vld_Flag                 --有效标志
,Enable_Date1                                 AS Enable_Date              --启用日期
,Deact_Date1                                  AS Deact_Date               --停用日期
,Destr_Date1                                  AS Destr_Date               --销毁日期
,Seal_App_Proc_Id1                            AS Seal_App_Proc_Id         --印章申请流程流程id
,Proc_Title1                                  AS Proc_Title               --流程标题
,Seal_Own_Grp1                                AS Seal_Own_Grp             --印章所属集团
,Elec_Sign_Id1                                AS Elec_Sign_Id             --电子签章编号
,Elec_Seal_Signaty_Type1                      AS Elec_Seal_Signaty_Type   --电子章签约方类型
,Elec_Seal_Signaty_Cd1                        AS Elec_Seal_Signaty_Cd     --电子章签约方代码
,Elec_Seal_Type1                              AS Elec_Seal_Type           --电子章印章类型
,Exam_Id1                                     AS Exam_Id                  --印章管理考试编号
,Exam_Pass_Flag1                              AS Exam_Pass_Flag           --考试通过标志
,Remark1                                      AS Remark                   --备注
,Create_User_Id1                              AS Create_User_Id           --创建人用户编号
,Create_Date1                                 AS Create_Date              --创建时间
,Upd_User_Id1                                 AS Upd_User_Id              --修改人用户编号
,Upd_Date1                                    AS Upd_Date                 --修改日期
,'0'                                          AS Del_Flag                 --删除标志
,''                                           AS Del_Date                 --删除日期
,Data_Src_Cd1                                 As Data_Src_Cd              --数据来源代码
,Task_Name1                                   As Task_Name                --任务名
,Data_Etl_Date1                               As Data_Etl_Date            --数据加载日期
,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
,'2026-05-22 03:05:00'                         AS Data_Time                --数据时间
,Src_Tbl1                                     AS Src_Tbl                  --源表
FROM TEMP.T00_SEAL_INFO_MID_BPM005  WHERE DATA_TYPE='I'   --插入新增的数据
UNION ALL
SELECT
Seal_Id                                                 --印章编号
,Seal_Name                                               --印章名称
,Seal_Type_Cd                                            --印章类型代码
,Seal_Shape                                              --印章形状
,Seal_Mngr_User_Id                                       --印章专管员编号
,Seal_Keep_Inr_Org_Id                                    --印章保管部门编号
,Seal_Own_Inr_Org_Id                                     --印章所属部门编号
,Seal_Stat_Cd                                            --印章状态代码
,Vld_Flag                                                --有效标志
,Enable_Date                                             --启用日期
,Deact_Date                                              --停用日期
,Destr_Date                                              --销毁日期
,Seal_App_Proc_Id                                        --印章申请流程流程id
,Proc_Title                                              --流程标题
,Seal_Own_Grp                                            --印章所属集团
,Elec_Sign_Id                                            --电子签章编号
,Elec_Seal_Signaty_Type                                  --电子章签约方类型
,Elec_Seal_Signaty_Cd                                    --电子章签约方代码
,Elec_Seal_Type                                          --电子章印章类型
,Exam_Id                                                 --印章管理考试编号
,Exam_Pass_Flag                                          --考试通过标志
,Remark                                                  --备注
,Create_User_Id                                          --创建人用户编号
,Create_Date                                             --创建时间
,Upd_User_Id                                             --修改人用户编号
,Upd_Date                                                --修改日期
,'1'                              AS Del_Flag            --删除标志
,CASE WHEN Del_Date !=''
THEN Del_Date
ELSE '2026-05-21'
END                         AS Del_Date            --删除日期
,Data_Src_Cd                                            --数据来源代码
,Task_Name                                              --任务名
,Data_Etl_Date                                          --数据加载日期
,CASE WHEN Del_Date !=''
THEN Data_Upt_Date
ELSE '2026-05-21'
END                         AS Data_Upt_Date       --数据更新日期
,CASE WHEN Del_Date !=''
THEN Data_Time
ELSE '2026-05-22 03:05:00'
END                         AS Data_Time           --数据时间
,Src_Tbl                                                 --源表
FROM TEMP.T00_SEAL_INFO_MID_BPM005 WHERE DATA_TYPE='D'  --插入删除的数据
;
