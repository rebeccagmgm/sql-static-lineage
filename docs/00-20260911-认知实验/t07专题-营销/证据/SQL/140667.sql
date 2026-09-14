-- task_id: 140667
-- hiveDb: temp
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-dm_ecom_n/personas/user_tweakcube_campgingn.py
-- observed_at: 2026-09-03T07:40:11.740Z

-- createSql
create table if not exists user_tweakcube_form_record_qa_info (
  activity_id string comment '活动编号',
  pty_id string comment '客户编号',
  gft_id string comment '广发通编号',
  qa_info string comment '表单填写明细',
  create_time string comment '提交时间'
)
comment '画龙样本标签数据表'
PARTITIONED BY (busi_date string comment '业务日期')
STORED AS ORC;

create table if not exists user_tweakcube_campgign_view_daily (
  activity_id string comment '活动编号',
  pty_id string comment '客户编号',
  mobile_no string comment '手机号',
  cnt string comment '浏览次数'
)
comment '画龙样本标签数据表'
PARTITIONED BY (busi_date string comment '业务日期')
STORED AS ORC;

create table if not exists campgign_huaxiang_config_tmp (
  activity_id string comment '活动编号',
  button_id string comment '按钮ID',
  button_name string comment '按钮名称',
  times string comment '采集点击阀值',
  collect_begin_time string comment '数据采集开始日期',
  collect_end_time string comment '数据采集结束日期',
  volume_status string comment '画像配置状态'
)
comment '魔方活动配置临时表'
PARTITIONED BY (busi_date string comment '业务日期')
STORED AS ORC;

create table if not exists user_tweakcube_campgign_click_daily (
  activity_id string comment '活动编号',
  pty_id string comment '客户编号',
  mobile_no string comment '手机号',
  button_name string comment '按钮名称',
  button_id string comment '按钮ID',
  click_cnt string comment '点击次数'
)
comment '用户点击魔方活动每日明细'
PARTITIONED BY (busi_date string comment '业务日期')
STORED AS ORC;

-- querySql
insert overwrite table user_tweakcube_form_record_qa_info partition (busi_date)
select
activity_id,
pty_id,
gft_id,
qa_info,
Creat_Time,
'2026-05-19'
from (
select
split(Prom_Id,'-')[1] activity_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) = 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end   pty_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) != 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end  gft_id,
concat_ws('-',a0,a1) qa_info,
Creat_Time
from pdata_n.T07_PROM_CUST_LIST
lateral view json_tuple(split(Cust_Info,'-')[1],'客户手机号','客户姓名') t as a0,a1
where split(Prom_Id,'-')[1]  = '6848103fd9afbd0022c4c9e7'
and busi_date = '2026-05-19'
and src_tbl = 'ODATA_N_MMP.T_USER_FORM_RECORD'
union all
select
split(Prom_Id,'-')[1] activity_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) = 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end   pty_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) != 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end  gft_id,
concat_ws('-',a0) qa_info,
Creat_Time
from pdata_n.T07_PROM_CUST_LIST
lateral view json_tuple(split(Cust_Info,'-')[1],'compv0lxp00ytxnx') t as a0
where split(Prom_Id,'-')[1]  = '6357502599e8040143fe3024'
and busi_date = '2026-05-19'
and src_tbl = 'ODATA_N_MMP.T_USER_FORM_RECORD'
union all
select
split(Prom_Id,'-')[1] activity_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) = 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end   pty_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) != 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end  gft_id,
concat_ws('-',a0) qa_info,
Creat_Time
from pdata_n.T07_PROM_CUST_LIST
lateral view json_tuple(split(Cust_Info,'-')[1],'手机号') t as a0
where split(Prom_Id,'-')[1]  = '635752403911900144c2a5ad'
and busi_date = '2026-05-19'
and src_tbl = 'ODATA_N_MMP.T_USER_FORM_RECORD'
union all
select
split(Prom_Id,'-')[1] activity_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) = 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end   pty_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) != 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end  gft_id,
concat_ws('-',a0,a1) qa_info,
Creat_Time
from pdata_n.T07_PROM_CUST_LIST
lateral view json_tuple(split(Cust_Info,'-')[1],'123','测试') t as a0,a1
where split(Prom_Id,'-')[1]  = '63d8bd092c5887014b5f7748'
and busi_date = '2026-05-19'
and src_tbl = 'ODATA_N_MMP.T_USER_FORM_RECORD'
union all
select
split(Prom_Id,'-')[1] activity_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) = 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end   pty_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) != 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end  gft_id,
concat_ws('-',a0,a1) qa_info,
Creat_Time
from pdata_n.T07_PROM_CUST_LIST
lateral view json_tuple(split(Cust_Info,'-')[1],'多行输入框2','多行输入框1') t as a0,a1
where split(Prom_Id,'-')[1]  = '684a408f2cb1d3005aed2266'
and busi_date = '2026-05-19'
and src_tbl = 'ODATA_N_MMP.T_USER_FORM_RECORD'
union all
select
split(Prom_Id,'-')[1] activity_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) = 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end   pty_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) != 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end  gft_id,
concat_ws('-',a0,a1) qa_info,
Creat_Time
from pdata_n.T07_PROM_CUST_LIST
lateral view json_tuple(split(Cust_Info,'-')[1],'客户手机号','客户姓名') t as a0,a1
where split(Prom_Id,'-')[1]  = '6841b727d9afbd0022c4c98b'
and busi_date = '2026-05-19'
and src_tbl = 'ODATA_N_MMP.T_USER_FORM_RECORD'
union all
select
split(Prom_Id,'-')[1] activity_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) = 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end   pty_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) != 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end  gft_id,
concat_ws('-',a0) qa_info,
Creat_Time
from pdata_n.T07_PROM_CUST_LIST
lateral view json_tuple(split(Cust_Info,'-')[1],'compCslGf7gjr6') t as a0
where split(Prom_Id,'-')[1]  = '69dded666821120b685d17ba'
and busi_date = '2026-05-19'
and src_tbl = 'ODATA_N_MMP.T_USER_FORM_RECORD'
union all
select
split(Prom_Id,'-')[1] activity_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) = 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end   pty_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) != 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end  gft_id,
concat_ws('-',a0) qa_info,
Creat_Time
from pdata_n.T07_PROM_CUST_LIST
lateral view json_tuple(split(Cust_Info,'-')[1],'name') t as a0
where split(Prom_Id,'-')[1]  = '69c4f3a64e68de1e8ad9f574'
and busi_date = '2026-05-19'
and src_tbl = 'ODATA_N_MMP.T_USER_FORM_RECORD'
union all
select
split(Prom_Id,'-')[1] activity_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) = 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end   pty_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) != 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end  gft_id,
concat_ws('-',a0,a1) qa_info,
Creat_Time
from pdata_n.T07_PROM_CUST_LIST
lateral view json_tuple(split(Cust_Info,'-')[1],'客户手机号','客户姓名') t as a0,a1
where split(Prom_Id,'-')[1]  = '672496804661030c17f5a69c'
and busi_date = '2026-05-19'
and src_tbl = 'ODATA_N_MMP.T_USER_FORM_RECORD'
union all
select
split(Prom_Id,'-')[1] activity_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) = 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end   pty_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) != 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end  gft_id,
concat_ws('-',a0,a1,a2,a3) qa_info,
Creat_Time
from pdata_n.T07_PROM_CUST_LIST
lateral view json_tuple(split(Cust_Info,'-')[1],'详细地址','所在地区','手机号码','收货人') t as a0,a1,a2,a3
where split(Prom_Id,'-')[1]  = '638803bfa30d1a014a5faef7'
and busi_date = '2026-05-19'
and src_tbl = 'ODATA_N_MMP.T_USER_FORM_RECORD'
union all
select
split(Prom_Id,'-')[1] activity_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) = 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end   pty_id,
case when length(REGEXP_REPLACE(Cust_Id,'MMP005-','')) != 12 then REGEXP_REPLACE(Cust_Id,'MMP005-','') else '' end  gft_id,
concat_ws('-',a0,a1) qa_info,
Creat_Time
from pdata_n.T07_PROM_CUST_LIST
lateral view json_tuple(split(Cust_Info,'-')[1],'勾选协议','您的投票意见') t as a0,a1
where split(Prom_Id,'-')[1]  = '684d34ae3d488e002191c582'
and busi_date = '2026-05-19'
and src_tbl = 'ODATA_N_MMP.T_USER_FORM_RECORD'
)t;

insert overwrite table user_tweakcube_campgign_view_daily partition (busi_date)
select
activity_id,
pty_id,
mobile_no,
count(*) cnt,
daily busi_date
from
(
select
split(Prom_Id,'-')[1] campaign_id,Portr_Lbl_Data_Coll_Strt_Time ,Portr_Lbl_Data_Coll_End_Time
from
(select split(prom_id,'-')[1] prom_id1,* from
pdata_n.T07_MIO_ACT_ADTNL_INFO
where portr_lbl_open_flag != ''
) a
where substr(Portr_Lbl_Data_Coll_End_Time,1,10) >= date_sub('2026-05-19',9)
and substr(Portr_Lbl_Data_Coll_Strt_Time,1,10) <= '2026-05-19'
and Portr_Lbl_Open_Flag = '1'
AND SRC_TBL = 'ODATA_N_MIO.H_CAMPAIGNS'
)t1
join
(
select
case when distinct_id rlike '^[0-9]{12}$' then distinct_id else '' end pty_id
,properties['userMobile'] mobile_no
,properties['hd_id'] activity_id
,log_time
,daily
from  pdata_n.t05_view_shence_log_retail
where event_type = 'hd'
and event = 'hd_pageView'
and daily between date_sub('2026-05-19', 9) and '2026-05-19'
and properties['eventType'] = 'magic_sdk_h5url_view'
and (distinct_id rlike '^[0-9]{12}$' or properties['userMobile'] != '')
)t2 on t1.campaign_id =t2.activity_id
where t2.log_time > t1.Portr_Lbl_Data_Coll_Strt_Time
and t2.log_time < t1.Portr_Lbl_Data_Coll_End_Time
group by activity_id ,pty_id,mobile_no,daily;

insert overwrite table campgign_huaxiang_config_tmp partition (busi_date)
select
campaign_id activity_id
,get_json_object(button_config1,'$.button_id') button_id
,get_json_object(button_config1,'$.button_name') button_name
,get_json_object(button_config1,'$.times') times
,Portr_Lbl_Data_Coll_Strt_Time collect_begin_time
,Portr_Lbl_Data_Coll_End_Time collect_end_time
,Portr_Lbl_Open_Flag volume_status
,'2026-05-19'  busi_date
from
(
select split(Prom_Id,'-')[1]  campaign_id
,Portr_Lbl_Data_Coll_Strt_Time
,Portr_Lbl_Data_Coll_End_Time
,button_config1
,Portr_Lbl_Open_Flag
from
(  select a.* from
(select split(prom_id,'-')[1] prom_id1,* from
pdata_n.T07_MIO_ACT_ADTNL_INFO
where portr_lbl_open_flag != ''
) a
)t
lateral view
explode(split(regexp_replace(regexp_replace(Portr_Lbl_Act_Button_Info , '\\\[|\\\]' , ''),'\\\}\\\,\\\{' ,'\\\}\\\-\\\{'),'-')) t as button_config1
where Portr_Lbl_Open_Flag != ''
AND SRC_TBL = 'ODATA_N_MIO.H_CAMPAIGNS'
)a;

insert overwrite table user_tweakcube_campgign_click_daily partition (busi_date)
select
t1.activity_id,
pty_id,
mobile_no,
t1.button_name,
t1.button_id,
count(*) click_cnt,
daily busi_date
from
(
select
*
from campgign_huaxiang_config_tmp
where  substr(collect_end_time,1,10) >= date_sub('2026-05-19',9)
and substr(collect_begin_time,1,10) <= '2026-05-19'
and volume_status = '1'
and times != 0
and busi_date = '2026-05-19'
)t1
join
(
select
case when distinct_id rlike '^[0-9]{12}$' then distinct_id else '' end pty_id
,properties['userMobile'] mobile_no
,properties['hd_id'] activity_id
,properties['compid'] button_id
,log_time
,daily
from pdata_n.t05_view_shence_log_retail
where event_type = 'hd'
and event = 'hd_click'
and daily between date_sub('2026-05-19', 9) and '2026-05-19'
and (distinct_id rlike '^[0-9]{12}$' or properties['userMobile'] != '')
)t2 on t1.activity_id =t2.activity_id and t1.button_id =t2.button_id
where t2.log_time > t1.collect_begin_time
and t2.log_time < t1.collect_end_time
group by t1.activity_id ,pty_id,mobile_no,t1.button_name,t1.button_id,daily;
