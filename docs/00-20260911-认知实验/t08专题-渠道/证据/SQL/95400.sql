-- task_id: 95400
-- hiveDb: dm_ecom_n
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-dm_ecom_n/oao/gfopenaccount_down_mobile_register.py
-- observed_at: 2026-09-04T01:54:12.827Z

-- createSql
create table if not exists gfopenaccount_down_mobile_register (
  first_busi_date string comment '首次登记日期',
  first_busi_time string comment '首次登记时间',
  successflag string comment '生效状态',
  channel string comment '渠道标识',
  khsj string comment '开户手机',
  fcategory string comment '一级渠道',
  scategory string comment '二级渠道',
  tcategory string comment '三级渠道',
  qudao string comment '截取的渠道标识',
  fin_lvl1_clas string comment '财务一级',
  fin_lvl2_clas string comment '财务二级',
  gffrom string comment 'gffrom',
  gffromno string comment 'gffromno',
  scene string comment 'scene',
  sceneno string comment 'sceneno',
  refr string comment '推荐人',
  cust_pty_no string comment '客户编号',
  org_no string comment '营业部编号',
  org_name string comment '营业部名称',
  dept_no string comment '分公司编号',
  dept_name string comment '分公司名称',
  op_acct_date string comment '开户日期',
  open_flag string comment '是否开户：1-开户，0-未开户',
  login_flag string comment '是否登录：1-登录，0-未登录',
  uuid_md5 string comment '加密uuid',
  login_time string comment '登录时间（大于预约的最小时间）',
  gft_oact_date string comment '广发通注册日期',
  reg_src_app string comment '广发通注册来源',
  reg_gft string comment '是否广发通注册'
)
comment '开户落地页登记手机号';

create table if not exists gfopenaccount_down_mobile_register_net_chan (
  first_busi_date string comment '首次登记日期',
  first_busi_time string comment '首次登记时间',
  successflag string comment '生效状态',
  channel string comment '渠道标识',
  khsj string comment '开户手机',
  fcategory string comment '一级渠道',
  scategory string comment '二级渠道',
  tcategory string comment '三级渠道',
  qudao string comment '截取的渠道标识',
  gffrom string comment 'gffrom',
  gffromno string comment 'gffromno',
  scene string comment 'scene',
  sceneno string comment 'sceneno',
  cust_pty_no string comment '客户编号',
  op_acct_date string comment '开户日期',
  open_flag string comment '是否开户：1-开户，0-未开户',
  login_flag string comment '是否登录：1-登录，0-未登录',
  uuid_md5 string comment '加密uuid',
  login_time string comment '登录时间（大于预约的最小时间）'
)
comment '互联网渠道定期批量回访表' ;

-- querySql
drop table if  exists gfopenaccount_down_mobile_register;

insert overwrite table gfopenaccount_down_mobile_register
select
l.first_busi_date,l.first_busi_time,l.successflag,l.channel,l.khsj
,l.fcategory
,l.scategory
,l.tcategory
,l.qudao
,l.fin_lvl1_clas
,l.fin_lvl2_clas
,l.gffrom
,l.gffromno
,l.scene
,l.sceneno
,l.refr
,l.cust_pty_no
,cust.bel_inr_org_id as org_no
,coalesce(org.inr_org_name,cust.bel_inr_org_name) as org_name
,coalesce(org.brch_bel_div_org_id,cust.bel_inr_org_id) as dept_no
,coalesce(org.brch_bel_div_org_name,cust.bel_inr_org_name) as dept_name
,l.op_acct_date
,l.open_flag
,case when mobile_no is not null then '1' else '0' end as login_flag
,l.uuid_md5
,l.login_time
,gft_date.oact_date as gft_oact_date     --广发通注册日期
,gft_src.reg_src_app     --广发通注册来源
,case when gft_date.oact_date is not null and gft_date.oact_date<>'' then '1' else '0' end as reg_gft  --是否广发通注册
from (
select
first_busi_date,first_busi_time,channel,successflag,khsj
,fcategory
,scategory
,tcategory
,qudao
,fin_lvl1_clas
,fin_lvl2_clas
,gffrom
,gffromno
,scene
,sceneno
,refr
,cust_pty_no
,op_acct_date
,open_flag
,min(case when login_time is not null and login_time<>'' then mobile_no end) as mobile_no
,min(case when login_time is not null and login_time<>'' then uuid_md5 end) as uuid_md5
,min(case when login_time is not null and login_time<>'' then login_time end) as login_time
from
(
select first_busi_date,first_busi_time,a.channel,successflag,khsj
,fcategory
,case   when a.scategory='其他'and channel like 'qrcode_user%' then '个人二维码'
when a.scategory='其他' and channel like 'qrcode_org%' then '机构二维码'
else a.scategory
end as scategory
,case   when a.tcategory='其他'and channel like 'qrcode_user%' then '个人二维码'
when a.tcategory='其他' and channel like 'qrcode_org%' then '机构二维码'
else a.tcategory
end as tcategory
,a.qudao
,coalesce(a.fin_lvl1_clas,'非线上渠道') as fin_lvl1_clas
,coalesce(a.fin_lvl2_clas,'非线上渠道') as fin_lvl2_clas
,gffrom
,gffromno
,scene
,sceneno
,refr
,cust_pty_no
,op_acct_date
,open_flag
,b.mobile_no
,b.uuid_md5
,b.login_time
from
(
select a.*,row_number() over(partition by khsj order by request_time) rn
from (
select
to_date(request_time) as first_busi_date, request_time as first_busi_time
,channel,successflag,t1.khsj
,if(all_category_1='其他','其他',if(all_category_1='自来','无引流标识',split(all_category, '__')[1])) as fcategory
,if(all_category_1='其他','其他',if(all_category_1='自来','无引流标识',split(all_category, '__')[2])) as scategory
,if(all_category_1='其他','其他',if(all_category_1='自来','无引流标识',split(all_category, '__')[3])) as tcategory
,if(all_category_1='其他','其他',if(all_category_1='自来','自来',split(all_category, '__')[0])) as qudao
,split(all_category, '__')[4] as fin_lvl1_clas
,split(all_category, '__')[5] as fin_lvl2_clas
,gffrom
,gffromno
,scene
,sceneno
,refr
,coalesce(t2.pty_id,t3.khh) as cust_pty_no
,default.datekey2date(coalesce(t2.Oact_Date,t3.khrq))  as op_acct_date
,case when coalesce(t2.Oact_Date,t3.khrq) is not null then '1' else '0' end as open_flag
,case when successflag=1 then min(request_time) over(partition by khsj,successflag)
when successflag=0 then max(request_time) over(partition by khsj,successflag)
end as request_time
from(
select request_time,channel,successflag,khsj,gffrom,gffromno,scene,sceneno,refr,all_category_1,max(array(split(all_category, '\_')[0],all_category))[1] as all_category
from (
select a.request_time,a.channel,a.successflag,a.khsj,a.gffrom,a.gffromno,a.scene,a.sceneno,refr,
coalesce(case when b.lvl1_cate is not null then concat_ws('__',b.src_chan_id,b.lvl1_cate,b.lvl2_cate,b.lvl3_cate,b.fin_lvl1_clas,b.fin_lvl2_clas) end,
case when c.lvl1_cate is not null then concat_ws('__',c.src_chan_id,c.lvl1_cate,c.lvl2_cate,c.lvl3_cate,c.fin_lvl1_clas,c.fin_lvl2_clas) end) as all_category,
case when (length(a.all_category) > 0 and a.all_category <> 'x') and (b.src_chan_id is null and c.src_chan_id is null)
then '其他'
when (length(a.all_category) = 0 or a.all_category = 'x' or a.all_category is null or a.all_category='') or (b.src_chan_id is null and c.src_chan_id is null)
then '自来'
when a.all_category='非网上开户'
then '其他'
else a.all_category end all_category_1
from (
select
Rsrv_Time as request_time
,Src_Chan_Id as channel,
case when substr(Rsrv_End_Time,1,10)>='2026-05-21' then '1' else '0' end as successflag,
Mobile as khsj
,'NULL' as gffrom
,'NULL' as gffromno
,'NULL' as scene
,'NULL' as sceneno
,case when Src_Chan_Id like 'qrcode_user%' then 'qrcode_user'
else coalesce(split(Src_Chan_Id,'\_')[3],split(Src_Chan_Id,'\_')[0])
end as all_category
,refr --推荐人
from pdata_n.T05_GKS_OACT_RSRV_EVT a
where
substr(Rsrv_End_Time,1,10)>='2026-05-21' and
to_date(Rsrv_Time)>='2018-01-01'
and to_date(Rsrv_Time)<='2020-10-23'
union all
select aa.request_time, aa.channel,aa.successflag, aa.khsj,aa.gffrom,aa.gffromno,aa.scene,aa.sceneno,aa.all_category ,aa.refr
from
(
select Rsrv_Time as request_time
,Src_Chan_Id as channel
,case when substr(Rsrv_End_Time,1,10)>='2026-05-21' then '1' else '0' end as successflag
,max(case when substr(Rsrv_End_Time,1,10)>='2026-05-21' then '1' else '0' end) over(partition by Mobile) is_valid
,max(case when trim(prdc_cust_no_flag)<>'' or trim(prdc_time)<>'' then '1' else '0' end) over(partition by Mobile) is_open
,Mobile as khsj
,refr --推荐人
,coalesce(split(Stati_Chn,'_')[0],'NULL') as gffrom
,coalesce(split(Stati_Chn,'_')[1],'NULL') as gffromno
,coalesce(split(Stati_Chn,'_')[2],'NULL') as scene
,coalesce(split(Stati_Chn,'_')[3],'NULL') as sceneno
,case when Src_Chan_Id like 'qrcode_user%' then 'qrcode_user'
when src_chan_id like '%\_%\_%\_%' then split(src_chan_id,'\_')[3]
else Src_Chan_Id
end as all_category
,row_number() over (partition by Mobile order by prdc_cust_no_flag desc
,prdc_time desc
,(case when substr(Rsrv_End_Time,1,10)>='2026-05-21' then 0 else 1 end)
,cast(Prior_Lvl as bigint) asc
,cast(Uniq_Ind as bigint) desc
) as rn
,row_number() over (partition by Mobile order by Rsrv_Time desc) as rn_1
from pdata_n.T05_GKS_OACT_RSRV_EVT
where (Mobile is not null and Mobile<>'' and Mobile<>' ')
and to_date(Rsrv_Time)>='2020-10-24'
) aa
where (is_open='0' and is_valid='0' and rn_1=1) or (( is_open!='0' or is_valid!='0' ) and rn=1)
union all
select Create_Time as request_time,regexp_replace(Chn,'-dx','') as channel,'空' as successflag,Mobile as khsj
,'NULL' as gffrom
,'NULL' as gffromno
,'NULL' as scene
,'NULL' as sceneno
,case when Chn like 'qrcode_user%' then 'qrcode_user'
else coalesce(split(Chn,'\_')[3],split(Chn,'\_')[0])
end as all_category
,refr
from pdata_n.T05_OAO_APPLIES_EVT a
left join (
select * from (
select rep_no,get_json_object(Evt_Cont,'$.data.recommendation') as refr,
row_number() over(partition by rep_no order by create_time desc) rn
from pdata_n.T05_OAO_OACT_ORD_STEP_EVT
where Evt_Src='gfopen' and curr_step = 'place'
) b0 where rn=1
) b
on a.user_id = b.rep_no
where Src_Tbl='ODATA_N_OAO.C_APPLIES' and
App_Step='login' and to_date(Create_Time)>='2018-01-01'
and
Chn in
(
'newgfweb-dx',
'lhx-dx',
'sina-dx',
'baidu-dx',
'sougou-dx',
'360-dx',
'shenma-dx',
'icbc-dx',
'ccb-dx',
'dazhihui-dx',
'xiaomistore-dx',
'huaweistore-dx',
'oppostore-dx',
'vivostore-dx',
'360store-dx',
'yingyongbaostore-dx',
'baidustore-dx',
'androidstore-dx',
'appStore',
'gfjh1-dx',
'gfjh2-dx',
'gfjh3-dx',
'gfjh4-dx',
'gfjh5-dx',
'gfjh6-dx',
'gfjh7-dx',
'gfjh8-dx',
'gfjh9-dx',
'gfjh10-dx',
'gfjh11-dx'
)
and substr(Create_Time,1,4)='2022'
) a
left join (select * from pdata_n.T08_GKS_CHAN_INFO where lvl1_cate is not null and mode in ('equal') and del_flag='0') b
on a.all_category=b.src_chan_id
left join (select * from pdata_n.T08_GKS_CHAN_INFO where lvl1_cate is not null and mode in ('like') and del_flag='0') c
on a.all_category rlike c.src_chan_id
) a1
group by request_time,channel,successflag,khsj,gffrom,gffromno,scene,sceneno,refr,all_category_1
)t1
left join
(select * from pdata_n.T98_CRM_CUST_CHAN_INFO where busi_date>='2018-01-01' and Mobile is not null) t2
on t1.khsj = t2.Mobile
left join
(
select mobile_no,khh,khrq
from
(
select pty_id as khh,coalesce(mobile,home_phone) as mobile_no,oact_date as khrq from pdata_n.T98_BROK_INDV_CUST_BASE_INFO where busi_date='2026-05-21'
) a
where mobile_no is not null
group by mobile_no,khh,khrq
)t3
on t1.khsj=t3.mobile_no
)a
)a
left join
(
select  b.mobile as mobile_no,uuid_md5,login_time
from (
select   coalesce(uuid_md5, default.gfmd5(uuid)) as uuid_md5,login_time
from (
select
get_json_object(Evt_Cont,'$.time') as login_time,
get_json_object(Evt_Cont,'$.action') as action,
get_json_object(Evt_Cont,'$.uuid') as uuid,
get_json_object(Evt_Cont,'$.uuid_md5') as uuid_md5
from pdata_n.T05_OAO_OACT_ORD_STEP_EVT
) a
where login_time >='2018-01-01' and action='login'
) as a
inner join pdata_n.T98_CRM_OACT_PTY_ID_MOBILE_MAP_INFO b on a.uuid_md5=b.pty_id
)b
on a.khsj = b.mobile_no
where rn=1
)t
group by
first_busi_date,first_busi_time,channel,successflag,khsj
,fcategory
,scategory
,tcategory
,qudao
,fin_lvl1_clas
,fin_lvl2_clas
,gffrom
,gffromno
,scene
,sceneno
,refr
,cust_pty_no
,op_acct_date
,open_flag
)l
left join
(
select pty_id,bel_inr_org_id,bel_inr_org_name from pdata_n.T98_BROK_INDV_CUST_BASE_INFO where busi_date='2026-05-21'
union all
select pty_id,bel_inr_org_id,bel_inr_org_name from pdata_n.T98_BROK_CORP_CUST_BASE_INFO where busi_date='2026-05-21'
) cust
on l.cust_pty_no=cust.pty_id
left join (select * from PDATA_N.T98_ORG_BRCH_DIV_INFO where busi_date='2026-05-21' ) org
on cust.bel_inr_org_id=org.inr_org_id
left join
(
select
mobile, --手机号
split(User_Id, '-')[1] as gft,  --广发通
reg_src_app   -- 广发通注册来源
from
PDATA_N.T04_GFT_USER_ADTNL_INFO
where
del_flag = '0'   -- 没有注销
and src_tbl = 'ODATA_N_CFM.G_T_SYSTEM_WEBUSER'
and mobile is not null
) gft_src
on l.khsj=gft_src.mobile
left join
(
select
split(user_id, '-')[1] as gft_id,  --广发通
default.datekey2date(oact_date) as oact_date  --广发通注册日期
from
pdata_n.T04_USER
where
src_tbl = 'ODATA_N_CFM.G_T_SYSTEM_WEBUSER'
and del_flag = 0 --注销标志为0
) gft_date
on gft_src.gft=gft_date.gft_id
;

drop table if  exists gfopenaccount_down_mobile_register_net_chan;

insert overwrite table gfopenaccount_down_mobile_register_net_chan
select t1.first_busi_date,t1.first_busi_time,t1.successflag,t1.channel,t1.khsj,
t1.fcategory,t1.scategory,t1.tcategory,t1.qudao,t1.gffrom,t1.gffromno,t1.scene,t1.sceneno,
t1.cust_pty_no,t1.op_acct_date,t1.open_flag,t1.login_flag,t1.uuid_md5,t1.login_time
from (
select *
from gfopenaccount_down_mobile_register
where fcategory in ('自有平台渠道','外部互联网渠道','互联网其他')
and open_flag=0
and first_busi_date>=date_sub('2026-05-21',180)
) t1
left join
(
select b.mobile,a.*
from
(
select *
from pdata_n.t98_gks_ord_base_info
where ord_cate_cd = 'item_type_booking' --开户流失挽回订单
and busi_date>=date_sub('2026-05-21',5) --派单日期5天内
) a
left outer join
(
select pty_id,mobile from pdata_n.t98_crm_oact_pty_id_mobile_map_info
where src_tbl = 'ODATA_N_CRM.C_TAPP_MOBILE_UID'
and busi_date = '2026-05-21'
) b
on a.cust_idty_cd=b.pty_id
) t2
on t1.khsj=t2.mobile
where t2.mobile is null
;
