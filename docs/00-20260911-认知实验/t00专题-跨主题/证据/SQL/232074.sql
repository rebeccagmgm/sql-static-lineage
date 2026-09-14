-- task_id: 232074
-- hiveDb: 
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: 
-- observed_at: 2026-09-05T07:23:50.620Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_DOC_MGMT_INFO (
  Doc_Id STRING COMMENT '档案编号',
  Cust_Doc_Attach_No STRING COMMENT '客户档案附件编号',
  Cust_Archv_Time STRING COMMENT '客户档案归档时间',
  Doc_Coll_Stat_Cd STRING COMMENT '档案采集状态代码',
  Doc_Path STRING COMMENT '档案路径',
  Cust_Archv_Stat_Cd STRING COMMENT '客户档案归档状态',
  Cmphs_Archv_Stat_Cd STRING COMMENT '综合档案归档状态',
  Cmphs_Archv_Time STRING COMMENT '综合档案归档时间',
  Cmphs_Doc_Attach_No STRING COMMENT '综合档案附件编号',
  Coll_Time STRING COMMENT '档案采集时间',
  Data_Src_Cd STRING COMMENT '数据来源代码',
  Task_Name STRING COMMENT '任务名',
  Data_Etl_Date STRING COMMENT '数据加载日期',
  Data_Upt_Date STRING COMMENT '数据更新日期',
  Data_Time STRING COMMENT '数据时间',
  Real_Src_Tbl STRING COMMENT '真实源表'
)
COMMENT '档案管理信息'
PARTITIONED BY (Src_Tbl STRING COMMENT'源表',Busi_Date STRING COMMENT '业务日期')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_DOC_MGMT_INFO PARTITION(Src_Tbl='ODATA_N_DMS.T_CCB_ARCHIVE_FILES',Busi_Date='2026-05-26')
SELECT
CONCAT('CC2017-',ID )                              AS  Doc_Id                  --档案编号
,STUFF_ID                                          AS  Cust_Doc_Attach_No      --客户档案附件编号
,CREATE_STUFF_TIME                                 AS  Cust_Archv_Time         --客户档案归档时间
,NVL(B.DW_CD_VAL,IS_EXPORT)                        AS  Doc_Coll_Stat_Cd        --档案采集状态代码
,PATH                                              AS  Doc_Path                --档案路径
,NVL(C.DW_CD_VAL,CREATE_STUFF_FLAG)                AS  Cust_Archv_Stat_Cd      --客户档案归档状态
,IMPORT_DOCUMENT_FLAG                              AS  Cmphs_Archv_Stat_Cd     --综合档案归档状态
,IMPORT_DOCUMENT_TIME                              AS  Cmphs_Archv_Time        --综合档案归档时间
,DOCUMENT_ID                                       AS  Cmphs_Doc_Attach_No     --综合档案附件编号
,PATH_TIME                                         AS  Coll_Time               --档案采集时间
,'DMS'                             AS  Data_Src_Cd             --数据来源代码
,'PDATA_N.T00_DOC_MGMT_INFO_DMS002'                                AS  Task_Name               --任务名
,'2026-05-26'                            AS  Data_Etl_Date           --数据加载日期
,'2026-05-26'                            AS  Data_Upt_Date           --数据更新日期
,'2026-05-27 17:09:48'                              AS  Data_Time               --数据时间
,'ODATA_N_DMS.T_CCB_ARCHIVE_FILES'                               AS  Real_Src_Tbl            --真实源表
FROM   (SELECT *  FROM ODATA_N_DMS.T_CCB_ARCHIVE_FILES WHERE  Busi_Date='2026-05-26' )A
LEFT JOIN (
SELECT SRC_CD_VAL,DW_CD_VAL
FROM PDATA_N.REF_CD_CVT_MAP
WHERE TGT_TAB_NAME = 'T00_DOC_MGMT_INFO'
AND TGT_TAB_FLD  = 'Doc_Coll_Stat_Cd'
AND SRC_TAB_NAME = 'CCB_ARCHIVE_FILES'
AND SRC_FLD_NAME = 'IS_EXPORT'
AND SRC_SYS_NAME='DMS')B
ON      A.IS_EXPORT =B.SRC_CD_VAL                  --IS_EXPORT 转码
LEFT JOIN (
SELECT SRC_CD_VAL,DW_CD_VAL
FROM PDATA_N.REF_CD_CVT_MAP
WHERE TGT_TAB_NAME = 'T00_DOC_MGMT_INFO'
AND TGT_TAB_FLD  = 'Cust_Archv_Stat_Cd'
AND SRC_TAB_NAME = 'CCB_ARCHIVE_FILES'
AND SRC_FLD_NAME = 'CREATE_STUFF_FLAG'
AND SRC_SYS_NAME='DMS')C
ON      A.CREATE_STUFF_FLAG =C.SRC_CD_VAL                  --CREATE_STUFF_FLAG 转码
;
