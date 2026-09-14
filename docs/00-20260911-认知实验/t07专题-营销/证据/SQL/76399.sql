-- task_id: 76399
-- hiveDb: dm_ecom_n
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-dm_ecom_n/oao/Prd_Cust_Details.py
-- observed_at: 2026-09-04T01:35:25.832Z

-- createSql
create table if not exists Prd_Cust_Details (
  portal_id string comment '广发通ID',
  Cust_Id string comment '客户编号',
  Coup_Id string comment '优惠券编号',
  Deli_To string comment '客户手机',
  Pty_Name string comment '客户姓名',
  Inr_Org_Id string comment '客户营业部编号',
  inr_org_name string comment '客户营业部名称',
  brch_bel_div_org_id string comment '客户分公司编号',
  brch_bel_div_org_name string comment '客户分公司名称',
  First_Create_Time string comment '首次订购开始时间',
  Last_Create_Time string comment '最近一次订购开始时间',
  Last_Due_Time string comment '最近一次订购即将结束时间',
  Total_Vol string comment '累计订购月份数',
  Total_Last_Pay_Bal string comment '累计付费金额',
  Use_Flag string comment '是否已使用',
  First_Vld_Time string comment '首次使用时间',
  Last_Vld_Time string comment '最近一次使用时间',
  Combo_Packs string comment '开通套餐',
  Coupon_Names string comment '所参加的促销活动名称',
  Avail_Days string comment '可用天数',
  Open_Ways string comment '开通方式',
  Vld_Time string comment '生效时间',
  Due_Time string comment '到期时间',
  Normal_Dev_Emp_Name string comment '开发人员',
  Serv_Emp_Name string comment '服务人员',
  Serv_Emp_Id string comment '服务人员编号',
  Serv_Emp_ORG string comment '服务人员所在部门',
  src_prd_id string comment '产品编号',
  prd_name string comment '产品名称',
  Set_Name string comment '设置人',
  Set_ID string comment '设置人ID',
  Set_Date string comment '设置日期'
)
comment '全部客户Level2报表（按客户号）' ;

-- querySql
drop table   if  exists Prd_Cust_Details;

insert overwrite table Prd_Cust_Details
select
a.portal_id,a.Cust_Id,a.Coup_Id,a.Deli_To,a.Pty_Name,a.Inr_Org_Id,a.inr_org_name,a.brch_bel_div_org_id,a.brch_bel_div_org_name
,b.First_Create_Time,b.Last_Create_Time,b.Last_Due_Time
,b.Total_Vol,b.Total_Last_Pay_Bal
,case when a.Vld_Time=b.First_Vld_Time then '0' else 1 end as Use_Flag
,b.First_Vld_Time,b.Last_Vld_Time,
(CASE WHEN length(a.Coup_Id)>0 THEN '免费活动'
WHEN a.Pric_Cyc_Cd = 1 THEN '1个月套餐'
WHEN a.Pric_Cyc_Cd = 2 THEN '3个月套餐'
WHEN a.Pric_Cyc_Cd = 3 THEN '6个月套餐'
WHEN a.Pric_Cyc_Cd = 4 THEN '12个月套餐'
ELSE '-' END) as Combo_Packs,
c.gift_name as Coupon_Names,
b.Avail_Days,
(CASE WHEN length(a.Coup_Id)=0 THEN '主动订购'
WHEN a.Coup_Id='lv2_open' THEN '开户领取'
WHEN a.Coup_Id='lv2_30' THEN '30天内入金条件领取'
WHEN a.Coup_Id='lv2_asset1w_1m' THEN '入金1万送1个月'
WHEN a.Coup_Id='lv2_asset5w_2m' THEN '入金5万送2个月'
WHEN a.Coup_Id='lv2_asset20w_3m' THEN '入金20万送3个月'
ELSE '免费领取' END) as Open_Ways
,Vld_Time,Due_Time
,Normal_Dev_Emp_Name,Serv_Emp_Name,Serv_Emp_Id,d.bel_inr_org_name as Serv_Emp_ORG
,src_prd_id,prd_name
,split(c.upd_user,':')[1] AS Set_Name,split(c.upd_user,':')[0] AS  Set_ID
,substr(c.upd_time,1,10) AS Set_Date
from
(
select *
from
(
select
portal_id,Cust_Id,Deli_To,Coup_Id,Pric_Cyc_Cd,Pty_Name,
Inr_Org_Id,inr_org_name,brch_bel_div_org_id,brch_bel_div_org_name,Vld_Time,Due_Time,Normal_Dev_Emp_Name,Serv_Emp_Id,Serv_Emp_Name
,src_prd_id
,case when Src_Prd_Id='LV2' then 'Level-2十档行情'
when Src_Prd_Id='LV2PLUS' then 'level-2千档行情'
when Src_Prd_Id='PLUS2' then '铂金会员'
when Src_Prd_Id='WEALTHVIP' and pay_method_cd='e' and coup_id = 'openzzfw' then '权能畅享包-开户签约开通'
when Src_Prd_Id='WEALTHVIP' and (pay_method_cd='e' or pay_method_cd<>'e') and (coup_id is null or coup_id <> 'openzzfw') then '权能畅享包-单独签约购买'
end as  prd_name
,row_number() over ( partition by order1.portal_id order by create_time desc ) as rn
from
dm_ecom_n.Prd_Details_n order1
)t
where rn=1
)a
left join
(
select portal_id
,min(create_time) First_Create_Time,max(create_time) Last_Create_Time,max(Due_Time) Last_Due_Time
,sum(
CASE WHEN Pric_Cyc_Cd = 1 THEN 1 * Vol
WHEN  Pric_Cyc_Cd = 2 THEN 3 * Vol
WHEN  Pric_Cyc_Cd = 3 THEN 6 * Vol
WHEN  Pric_Cyc_Cd = 4 THEN 12 * Vol
ELSE 0 END
) as Total_Vol,sum(Last_Pay_Bal)Total_Last_Pay_Bal
,min(Vld_Time) First_Vld_Time,max(Vld_Time) Last_Vld_Time
,sum(datediff(Due_Time, Vld_Time)) as Avail_Days
from dm_ecom_n.Prd_Details_n
group by portal_id
)b
on a.portal_id=b.portal_id
left join (
select gift_coup_id,gift_name,upd_user,upd_time
from(
select *
from pdata_n.T07_PRD_COUP_ADTNL_INFO
)t1
join(
select *
from PDATA_N.T07_GIFT_INFO
)t2 on t1.gift_coup_id=t2.gift_id
) c
on a.Coup_Id=substr(c.Gift_Coup_Id,8)
left join
(
select emp_id,
emp_name,
brok_flag, --经纪人标志
bel_inr_org_id, --所属营业部（ERP机构编号）
bel_inr_org_name
from PDATA_N.T98_ORG_EMP_BASE_INFO
where busi_date = '2026-05-21'
)d
on  a.Serv_Emp_Id=d.emp_id
;
