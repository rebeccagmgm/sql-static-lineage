-- task_id: 180897
-- hiveDb: dm_index_n
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-dm_index_n/rd_script/dm_index_n.except_cost_temp.py
-- observed_at: 2026-09-01T14:25:58.698Z

-- createSql
CREATE TABLE if not exists temp_activity_service AS select replace (
  r1.Prom_Id,
  'RMS011-ACT-',
  ''
)
as objid, r2.Create_Time as createtimestamp,--substr(t1.createtimestamp,1,10) r1.Prom_Strt_Time, r1.Prom_Subj as meetingtitle, r2.Src_Inpt_User as inputid ,case when nvl(r2.Rms_Serv_Type_Cd,'')='201' then '20' when nvl(r2.Rms_Serv_Type_Cd,'')='302' then '30' when nvl(r2.Rms_Serv_Type_Cd,'')='202' then '3' end as activitytype ,r2.Act_Comnc_Method_Cd as communicationtype, case when (nvl(r2.Rms_Serv_Type_Cd,'')='201'--activitytype = 20 -- 电话会议 and nvl(r2.Conf_Type_Cd,'') = '1'-- 专家会议--phonemeetingtype and r2.Appr_Time is not null and nvl(r1.Prom_Stat_Cd,'')<> '6'--approvestatus ) then '电话会议' when ( nvl(r2.Rms_Serv_Type_Cd,'')='302'--activitytype = 30 and nvl(r1.Prom_Stat_Cd,'')<> '6'--approvestatus ) then '线下专家交流' end as comm_channel ,case when r1.Prom_Strt_Time >=concat(SUBSTR(DATE_SUB('2026-06-17',DAY('2026-06-17')),1,7) ,'-01 00:00:00') and r1.Prom_Strt_Time <=concat(date_sub('2026-06-17',day('2026-06-17')),' 23:59:59') then (case when nvl(r2.Conf_Type_Cd,'') = '1' and nvl(r2.Rms_Serv_Type_Cd,'')='201'--activitytype = 20 and r2.Appr_Time is not null then ( case when nvl(r2.Tele_Conf_Type_Cd,'')='0'--'公开电话会议'--0,'非公开电话会议'--1 then '公开电话会议' when nvl(r2.Tele_Conf_Type_Cd,'')='1'--'公开电话会议'--0,'非公开电话会议'--1 then '非公开电话会议' end ) when nvl(r2.Rms_Serv_Type_Cd,'')='302'--activitytype = 30--302。3--202 and nvl(r2.Appr_Stat_Cd,'') in ('4', '13') then '线下交流' end ) else null end as communication_type-- 交 流 类 型 ,r2.Conf_Type_Cd ,r2.Appr_Stat_Cd ,r2.Tele_Conf_Type_Cd ,r2.Appr_Time as approvaltime ,r2.inpt_emp_id from (select * from PDATA_N.T07_PROM --61527 where SRC_TBL='ODATA_N_RMS.N_CRM_ACTIVITY_SERVICE' and nvl(Del_Flag,'')<>'1') r1 left join (select * from PDATA_N.T07_RMS_ACT_INFO --62943 where SRC_TBL='ODATA_N_RMS.N_CRM_ACTIVITY_SERVICE' and nvl(Del_Flag,'')<>'1' ) r2 on r1.Prom_Id=r2.Prom_Id ;

create table temp_EXPERT_INFO as select d2.Pty_Name as name, d1.Intror_Name as introducer, d1.Intro_Type_Cd as introduce_type, d1.Eprt_Appo_Co_Name as company, d1.Show_Eprt_Name as show_name, d1.Show_Eprt_Intro as show_intro, replace (
  d3.Prom_Id,
  'RMS011-ACT-',
  ''
)
as Prom_Id, replace(d1.Eprt_Pty_Id,'RMS049-','') as id, d3.total_price, d3.actual_cost, d3.pre_tax_actual_cost, d3.entry_time, d3.communication_minutes from (select * from PDATA_N.T01_EXT_EPRT_INFO where SRC_TBL='ODATA_N_RMS.N_EXPERT_INFO') d1--98513--odata_n_rms.n_expert_info left join (select Pty_Id,Pty_Name from PDATA_N.T01_PTY--98510 where nvl(Del_Flag,'')='0' and SRC_TBL='ODATA_N_RMS.N_EXPERT_INFO' ) d2 on d1.Eprt_Pty_Id=d2.Pty_Id left join (select Eprt_Pty_Id, Prom_Id, Eprt_Fee_Tol_Pric as total_price, Actl_Eprt_Fee as actual_cost, Actl_Prev_Tax_Pymt_Amt as pre_tax_actual_cost, Onacct_Time as entry_time, Chat_Dura as communication_minutes from PDATA_N.T07_PROM_EPRT_INFO--99331 where SRC_TBL='ODATA_N_RMS.N_EXPERT_INFO' ) d3 on d1.Eprt_Pty_Id=d3.Eprt_Pty_Id ;

create table if not exists temp_offline_example as select t2.sourceid from (
  select Proc_Id as objid from PDATA_N.T05_RMS_PROC_INFO--191468 where src_tbl='ODATA_N_RMS.N_WF_PROCESS'--busi_date = '2026-06-17' and nvl(Proc_Stat_Cd,'') in ('valid', 'draft_cancelled', 'Invalid','2', '3', '4')--('2', '3', '4') and Proc_Busi_Cd = 'activityOfflineExpertCommunication'
)
t1 inner join (select Proc_Id as processid ,Proc_Instc_Id as objid ,Enty_Id as sourceid from PDATA_N.T05_RMS_PROC_INSTC_INFO-- 191484 where src_tbl='ODATA_N_RMS.N_WF_EXAMPLE'--busi_date = '2026-06-17' and nvl(Proc_Instc_Stat_Cd,'') not in ('3','4','5') and Enty_Id is not null ) t2 on t1.objid = t2.processid inner join (select Proc_Instc_Id as exampleid from PDATA_N.T05_RMS_PROC_INSTC_STEP_INFO--191470 where src_tbl='ODATA_N_RMS.N_WF_EXAMPLESTEP' and nvl(Step_Name,'') = '上传交流纪要') t3 on t2.objid = t3.exampleid group by t2.sourceid ;

create table if not exists activity_service_temp as select objid, createtimestamp, substr (
  Prom_Strt_Time,
  1,
  10
)
as startdate, meetingtitle, inputid, activitytype, communicationtype, '电话会议' as comm_channel ,inpt_emp_id from temp_activity_service where nvl(comm_channel,'')='电话会议' union all select t1.objid, t1.createtimestamp, substr(t1.Prom_Strt_Time,1,10) as startdate, t1.meetingtitle, t1.inputid, t1.activitytype, t1.communicationtype, case when t1.communicationtype = '0' then '腾讯会议' when t1.communicationtype = '1' then '上门路演' when t1.communicationtype = '2' then '面访' when t1.communicationtype = '100' then '其他' end as comm_channel ,t1.inpt_emp_id from temp_activity_service t1 inner join temp_offline_example t2 on t1.objid = t2.sourceid where nvl(t1.comm_channel,'')='线下专家交流' ;

create table if not exists except_cost_temp as select t1.objid as activityid, (
  case when nvl(activitytype,'') = '20' then '专家会议' else '线下专家交流' end
)
as activitytype, t1.createtimestamp as subm_date, t1.startdate as comm_date, t1.meetingtitle as content, t4.name as expert_name, t4.introducer as source, t5.group_name as fare_grp, t5.proportion as fare_rate, nvl(t4.total_price, 0) * t5.proportion / 100 as appnt_amt, nvl(t4.actual_cost, 0) * t5.proportion / 100 as use_amt, t5.group_id as group_id, t4.introduce_type as source_type, nvl(t4.pre_tax_actual_cost,0) as pre_tax_actual_cost, t4.entry_time, nvl(t4.pre_tax_actual_cost,0) * t5.proportion / 100 as grp_use_amt, nvl(t4.actual_cost, 0) as actual_cost, t1.comm_channel, -- 20231109 新增 交流渠道 字段 t4.company as company, --20240508 新增 任职公司 字段 t1.inputid, t5.login_name ,case when nvl(t5.group_id,'') in ('1-800075','1-800126') and t4.entry_time>='2023-01' then '1-800353' else t5.group_id end as group_id_1, case when nvl(t5.group_id,'') in ('1-800075','1-800126') and t4.entry_time>='2023-01' then '金属及金属新材料' else t5.group_name end as fare_grp_1, case when t4.introduce_type = '0' then '个人' else '第三方公司' end as source_1, case when t4.introduce_type = '0' then t4.name else t4.introducer end as expert_source ,t1.inpt_emp_id from activity_service_temp t1 inner join temp_EXPERT_INFO t4 on t1.objid = t4.Prom_Id--(case when t1.activitytype = '20' then t4.teleconference_id else t4.offline_expert_id end) left join (select replace(Prom_Id,'RMS011-ACT-','') as teleconference_id ,Grp_Name as group_name ,Fee_Prop as proportion ,Src_Grp_Id as group_id ,Matn_User_Id as login_name from PDATA_N.T07_PROM_FEE_EMP_GRP_BEAR_PROP-- 191467 where src_tbl='ODATA_N_RMS.N_ACT_COST_ASSUME' and nvl(Del_Flag,'') = '0') t5 on t1.objid = t5.teleconference_id ;

-- querySql
DROP TABLE IF EXISTS temp_activity_service;

drop table if exists temp_EXPERT_INFO;

drop table if exists temp_offline_example ;

drop table if exists activity_service_temp ;

drop table if exists except_cost_temp ;
