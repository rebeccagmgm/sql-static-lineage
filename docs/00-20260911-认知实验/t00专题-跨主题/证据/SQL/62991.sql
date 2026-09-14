-- task_id: 62991
-- hiveDb: PDATA_N
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_BUSI_SYS_INFO_ACM001.py
-- observed_at: 2026-09-05T01:06:20.921Z

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


--'业务系统信息表'
--drop table T00_Busi_Sys_info;
CREATE TABLE IF NOT EXISTS T00_BUSI_SYS_INFO (
Sys_Id                STRING COMMENT '业务Id',
Sys_Name              STRING COMMENT '业务系统名称',
Sys_Stat              STRING COMMENT '系统状态:未建设、建设中、试运行、已上线、已下线',
Sys_Imp               STRING COMMENT '系统重要性T1/T2',
Sys_Clas              STRING COMMENT '系统形态:系统、工具、平台',
Init_Date             STRING COMMENT '建设日期',
Pilot_Date            STRING COMMENT '试运行日期',
Onln_Date             STRING COMMENT '上线日期',
Ofln_Date             STRING COMMENT '下线日期',
Sys_Cate              STRING COMMENT '系统分类:实体系统、虚拟系统',
Sys_Dev_Mdl           STRING COMMENT '开发模式:自主研发、合作开发、外购、开源',
Sys_Rank              STRING COMMENT '系统层级:一级系统、二级系统、三级系统',
Sys_Imp_Tag           STRING COMMENT '重要性标签，多个使用分割',
Sys_Dev_Admin         STRING COMMENT '开发负责人中文名，多个使用逗号分割',
Sys_Op_Admin          STRING COMMENT '运维负责人中文名，多个使用逗号分割',
Sys_Op_Bkup_Admin     STRING COMMENT '运维B岗中文名，多个使用逗号分割',
Sys_Test_Admin        STRING COMMENT '测试负责人中文名，多个使用逗号分割',
Sys_Prd_Admin         STRING COMMENT '产品经理中文名，多个使用逗号分割',
Sys_Grps              STRING COMMENT '运维负责人所属团队群组，多个使用逗号分割',
Sys_Op_Grp            STRING COMMENT '主办运维群组',
Sys_Dept              STRING COMMENT '主办业务部门',
Sys_App_Amt           STRING COMMENT '应用数量',
Sys_Host_Amt          STRING COMMENT '主机数量',
Sys_Up_Busi_List      STRING COMMENT '上游系统列表',
Sys_Down_Busi_List    STRING COMMENT '下游系统列表',
Sys_Cnt_Date          STRING COMMENT '统计日期',
Last_Modif_Date       STRING COMMENT '最后一次修改时间',
Data_Src_Cd           STRING COMMENT  '数据来源代码',
Src_Tbl               STRING COMMENT  '源表',
Task_Name             STRING COMMENT  '任务名',
Data_Etl_Date         STRING COMMENT  '数据加载日期',
Data_Upt_Date         STRING COMMENT  '数据更新日期',
Data_Time             STRING COMMENT  '数据时间'
) COMMENT '业务系统信息表'
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_BUSI_SYS_INFO 
SELECT  
     id                                        AS    Sys_Id
    ,name                                      AS    Sys_Name
    ,status                                    AS    Sys_Stat
    ,importance                                AS    Sys_Imp
    ,class                                     AS    Sys_Clas
    ,init_date                                 AS    Init_Date
    ,pilot_date                                AS    Pilot_Date
    ,online_date                               AS    Onln_Date
    ,offline_date                              AS    Ofln_Date
    ,category                                  AS    Sys_Cate
    ,dev_model                                 AS    Sys_Dev_Mdl
    ,rank                                      AS    Sys_Rank
    ,important_tag                             AS    Sys_Imp_Tag
    ,dev_admin                                 AS    Sys_Dev_Admin
    ,op_admin                                  AS    Sys_Op_Admin
    ,op_backup_admin                           AS    Sys_Op_Bkup_Admin
    ,test_admin                                AS    Sys_Test_Admin
    ,product_admin                             AS    Sys_Prd_Admin
    ,groups                                    AS    Sys_Grps
    ,op_group                                  AS    Sys_Op_Grp
    ,department                                AS    Sys_Dept
    ,app_amount                                AS    Sys_App_Amt
    ,host_amount                               AS    Sys_Host_Amt
    ,upstream_business                         AS    Sys_Up_Busi_List
    ,downstream_business                       AS    Sys_Down_Busi_List
    ,count_day                                 AS    Sys_Cnt_Date
    ,last_modify                               AS    Last_Modif_Date
    ,'ACM'                                     AS    Data_Src_Cd 
    ,'ODATA_N_ACM.C_BUSINESS_COUNT'            AS    Src_Tbl
    ,'${filename}'                        AS    Task_Name 
    ,'${data_day_str}'                    AS    Data_Etl_Date 
    ,'${data_day_str}'                    AS    Data_Upt_Date 
    ,'${data_today}'                      AS    Data_Time 
FROM ODATA_N_ACM.C_BUSINESS_COUNT
