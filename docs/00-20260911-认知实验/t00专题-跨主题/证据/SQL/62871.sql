-- task_id: 62871
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_REQ_BASE_INFO_S_JIR001.py
-- observed_at: 2026-09-05T01:06:20.258Z

-- createSql
set hive.merge.mapfiles=true ;
set hive.merge.mapredfiles=true;
set hive.merge.size.per.task=1073741824;
set hive.merge.smallfiles.avgsize=1073741824;
set hive.merge.orcfile.stripe.level=false;
set hive.exec.dynamic.partition=true;
set hive.exec.dynamic.partition.mode=nonstrict;

set hive.exec.parallel=true;
set hive.exec.parallel.thread.number=8;
set hive.input.format=org.apache.hadoop.hive.ql.io.CombineHiveInputFormat;
set mapreduce.input.fileinputformat.split.maxsize=1073741824;
set mapreduce.input.fileinputformat.split.minsize=1073741824;


CREATE TABLE  IF NOT EXISTS T00_REQ_BASE_INFO_S
(
Req_No	        STRING	COMMENT '需求编号',
Dept_Id	        STRING	COMMENT '拟稿部门代码',
Curr_Oper	    STRING	COMMENT '当前经办人',
Creator	        STRING	COMMENT '创建人',
Title	        STRING	COMMENT '标题',
Req_Type_Cd	    STRING	COMMENT '需求单类型代码',
Prior_Cd	    STRING	COMMENT '优先级代码',
Stat_Cd	        STRING	COMMENT '状态代码',
Aprs_Scor	    STRING	COMMENT '评价份数',
Aprs_Emp_id	    STRING	COMMENT '评价人',
Create_Time	    STRING	COMMENT '创建时间',
Upd_Time	    STRING	COMMENT '更新时间',
Due_Time	    STRING	COMMENT '到期时间',
Aprs_Time	    STRING	COMMENT '评价时间',
Rsol_Time	    STRING	COMMENT '解决时间',
Data_Src_Cd	    STRING	COMMENT '数据来源代码',
Task_Name	    STRING	COMMENT '任务名',
Data_Etl_Date	STRING	COMMENT '数据加载日期',
Data_Upt_Date	STRING	COMMENT '数据更新日期',
Data_Time	    STRING	COMMENT '数据时间'
)
COMMENT '需求基本信息'
PARTITIONED BY 
(
Src_Tbl	  STRING	COMMENT '源表',
Busi_Date STRING	COMMENT '业务日期'
);

-- querySql
INSERT OVERWRITE TABLE T00_REQ_BASE_INFO_S PARTITION (Src_Tbl ='ODATA_N_JIR.P_JIRAISSUE_S',Busi_Date= '${data_day_str}')
SELECT
	concat('JIR-',a.id)                                     AS  Req_No,       --需求编号',
	''                                                      AS  Dept_Id,      --拟稿部门代码',
	a.assignee                                              AS  Curr_Oper,    --当前经办人',
	a.creator                                               AS  Creator,      --创建人',
	a.summary                                               AS  Title,        --标题',
	nvl(B.DW_CD_VAL,'999')                                  AS  Req_Type_Cd,  --需求单类型代码',
	nvl(C.DW_CD_VAL,'99')                                   AS  Prior_Cd,     --优先级代码',
	nvl(D.DW_CD_VAL,'999')                                  AS  Stat_Cd,      --状态代码',
	''                                                      AS  Aprs_Scor,    --评价份数',
	''                                                      AS  Aprs_Emp_id,  --评价人',
	substr(coalesce( rtrim(a.created), ''),1,19)            AS  Create_Time,  --创建时间',
	substr(coalesce( rtrim(a.updated), ''),1,19)            AS  Upd_Time,     --更新时间',
	substr(coalesce( rtrim(DUE_TIME.datevalue), ''),1,19)   AS  Due_Time,     --到期时间',
	''                                                      AS  Aprs_Time,    --评价时间',
	substr(coalesce( rtrim(a.resolutiondate), ''),1,19)     AS  Rsol_Time,    --解决时间',
	'JIR'                                                   AS  Data_Src_Cd,  --数据来源代码',
	'${filename}'                                      AS  Task_Name,    --任务名',
	'${data_day_str}'                                  AS  Data_Etl_Date,--数据加载日期',
	'${data_day_str}'                                  AS  Data_Upt_Date,--数据更新日期'
	'${data_today}'                                    AS  Data_Time     --数据时间
FROM  (SELECT * FROM ODATA_N_JIR.P_JIRAISSUE_S WHERE busi_date = '${data_day_str}' )a
LEFT JOIN (
          SELECT SRC_CD_VAL,DW_CD_VAL
          FROM PDATA_N.REF_CD_CVT_MAP
          WHERE TGT_TAB_NAME = 'T00_REQ_BASE_INFO_S'
            AND TGT_TAB_FLD  = 'Req_Type_Cd'
            AND SRC_TAB_NAME = 'JIRAISSUE'
            AND SRC_FLD_NAME = 'ISSUETYPE'
            AND SRC_SYS_NAME='JIR') B
ON        a.issuetype = B.SRC_CD_VAL            --ISSUETYPE
LEFT JOIN (
          SELECT SRC_CD_VAL,DW_CD_VAL
          FROM PDATA_N.REF_CD_CVT_MAP
          WHERE TGT_TAB_NAME = 'T00_REQ_BASE_INFO_S'
            AND TGT_TAB_FLD  = 'Prior_Cd'
            AND SRC_TAB_NAME = 'JIRAISSUE'
            AND SRC_FLD_NAME = 'PRIORITY'
            AND SRC_SYS_NAME='JIR') C
ON        a.priority = C.SRC_CD_VAL              --priority	
LEFT JOIN (
          SELECT SRC_CD_VAL,DW_CD_VAL
          FROM PDATA_N.REF_CD_CVT_MAP
          WHERE TGT_TAB_NAME = 'T00_REQ_BASE_INFO_S'
            AND TGT_TAB_FLD  = 'Stat_Cd'
            AND SRC_TAB_NAME = 'JIRAISSUE'
            AND SRC_FLD_NAME = 'ISSUESTATUS'
            AND SRC_SYS_NAME='JIR') D
ON        a.issuestatus = D.SRC_CD_VAL            --ISSUESTATUS	
LEFT JOIN ODATA_N_JIR.P_CUSTOMFIELDVALUE  DUE_TIME
ON a.ID=DUE_TIME.ISSUE 
      AND DUE_TIME.CUSTOMFIELD='13107'        ---业务预期上线时间

;

-- 获取jira的用户名和emp_id的对应关系 ,如有数据质量问题,由郑淞对接上游
CREATE TABLE IF NOT EXISTS tmp_user_emp 
(
jira_user_id string ,
emp_id string
) 
;

-- erp员工数据
INSERT OVERWRITE TABLE tmp_user_emp
SELECT 
	D.USER_KEY  AS jira_user_id,
	F.ERP_ID AS emp_id
FROM 
(          SELECT 
                LOGIN_ID
                ,ERP_ID
           FROM ODATA_N_IOA.I_GF_USER 
           WHERE BUSI_DATE='${data_day_str}'  
                 AND ERP_ID IS NOT NULL 
                 AND main_department = 'true'
           UNION ALL

           SELECT  
                LOGIN_ID
                ,ERP_ID
           FROM (SELECT 
                     row_number() over(partition by a.LOGIN_ID order by a.USER_DELETE_DATE desc) as rn, 
                     a.* 
                FROM ODATA_N_IOA.I_GF_USER_DEL a 
                WHERE  a.busi_date='${data_day_str}'  
                       AND a.main_department = 'true'
                       AND a.ERP_ID IS NOT NULL 
                )b
            WHERE rn = 1  

          ) F
LEFT JOIN (SELECT * FROM ODATA_N_JIR.P_APP_USER) D
ON  D.lower_user_name=F.LOGIN_ID
;

-- 合作方员工数据		 
INSERT INTO TABLE tmp_user_emp           
SELECT 
	 d.USER_KEY  as jira_user_id,
	 E.pbi_person_id  as emp_id
FROM ODATA_N_JIR.P_APP_USER D
INNER JOIN (SELECT * FROM 
             (SELECT * 
                  ,row_number()over(partition by internet_number order by pbi_status desc) rn
             FROM ODATA_N_PPM.P_PERSON_BASE_INFO 
            WHERE BUSI_DATE='${data_day_str}' 
                AND PBI_PERSON_TYPE='2'
                AND pbi_person_id!='95440'
				)T
			WHERE T.RN=1
            )E
ON D.lower_user_name=E.internet_number
;

INSERT OVERWRITE TABLE T00_REQ_BASE_INFO_S PARTITION (Src_Tbl ='ODATA_N_JIR.P_JIRAISSUE_S',Busi_Date= '${data_day_str}')
SELECT 
	a.Req_No,                --需求编号',
	a.Dept_Id,               --拟稿部门代码',
	b.emp_id  AS Curr_Oper,  --当前经办人',
	c.emp_id  AS Creator,    --创建人',
	a.Title,                 --标题',
	a.Req_Type_Cd,           --需求单类型代码',
	a.Prior_Cd,              --优先级代码',
	a.Stat_Cd,               --状态代码',
	a.Aprs_Scor,             --评价份数',
	a.Aprs_Emp_id,           --评价人',
	a.Create_Time,           --创建时间',
	a.Upd_Time,              --更新时间',
	a.Due_Time,              --到期时间',
	a.Aprs_Time,             --评价时间',
	a.Rsol_Time,             --解决时间',
	a.Data_Src_Cd,           --数据来源代码',
	a.Task_Name,             --任务名',
	a.Data_Etl_Date,         --数据加载日期',
	a.Data_Upt_Date,         --数据更新日期'
	a.Data_Time              --数据时间
FROM  (SELECT * FROM T00_REQ_BASE_INFO_S
       WHERE  Busi_Date= '${data_day_str}' 
	      AND Src_Tbl ='ODATA_N_JIR.P_JIRAISSUE_S'
	   )a
LEFT JOIN tmp_user_emp b 
ON a.Curr_Oper = b.jira_user_id
LEFT JOIN tmp_user_emp c 
ON a.Creator = c.jira_user_id
