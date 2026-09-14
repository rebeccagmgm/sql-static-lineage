-- task_id: 96431
-- hiveDb: dm_ecom_n
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-dm_ecom_n/oao/gfopenaccount_split_flow_cust_details.py
-- observed_at: 2026-09-01T13:56:15.850Z

-- createSql
create table if not exists gfopenaccount_emp_org_tmp (
  user_id string comment 'user_id',
  erp_no string comment '员工编号',
  erp_name string comment '员工名称',
  erp_org_no string comment '员工归属营业部编号',
  erp_org_name string comment '员工归属营业部名称',
  erp_dept_no string comment '员工归属分公司编号',
  erp_dept_name string comment '员工归属分公司名称'
)
comment '员工对应营业部公司关系表' ;

create table if not exists gfopenaccount_split_flow_cust_details (
  busi_date string comment '开户日期',
  cust_pty_no string comment '客户编号',
  khxm string comment '客户姓名',
  kfrbh string comment '开发人编号',
  kfrxm string comment '开发人姓名',
  kfr_org_no string comment '开发人员营业部编号',
  kfr_org_name string comment '开发人员营业部',
  kfr_dept_no string comment '开发人员分公司编号',
  kfr_dept_name string comment '开发人员分公司',
  fwrbh string comment '服务人编号',
  fwrxm string comment '服务人姓名',
  fw_org_no string comment '服务所属营业部编号',
  fw_org_name string comment '服务所属营业部',
  fw_dept_no string comment '服务所属分公司编号',
  fw_dept_name string comment '服务所属分公司',
  yyb string comment '客户营业部',
  org_no string comment '营业部编号',
  org_name string comment '营业部',
  dept_no string comment '分公司编号',
  dept_name string comment '分公司',
  pty_stat_desc string comment '客户状态',
  net_asset string comment '昨日时点净资产',
  cms_rati string comment '佣金套餐费率',
  rsrv_time string comment '已开户记录扫码时间',
  ylyyb string comment '引流营业部',
  yl_org_no string comment '引流营业部编号',
  yl_org_name string comment '引流营业部',
  yl_dept_no string comment '引流分公司编号',
  yl_dept_name string comment '引流分公司',
  channel string comment '渠道',
  fcategory string comment '一级渠道',
  scategory string comment '二级渠道',
  tcategory string comment '三级渠道',
  chan_name string comment '渠道名称',
  fin_lvl1_clas string comment '财务一级',
  fin_lvl2_clas string comment '财务二级',
  incharge string comment '是否打折',
  ylqd2 string comment '引流渠道',
  gffrom string comment 'gffrom',
  gffromno string comment 'gffromno',
  scene string comment 'scene',
  sceneno string comment 'sceneno',
  khs int comment '客户数',
  gffromname string comment 'gffrom名称',
  scenename string comment 'scene名称',
  assessor_id string comment '渠道考核人id(多人拼接erp)',
  assessor string comment '渠道考核人'
)
comment '第三方引流客户明细表' ;

-- querySql
drop table if exists gfopenaccount_emp_org_tmp;

insert overwrite table gfopenaccount_emp_org_tmp
select * from (select tt2.user_id,tt2.erp_no,tt2.user_name as erp_name
,case when coalesce(tt3.org_name,tt4.dept_name)='辽宁分公司' then '7029'
else tt2.branch_no end as erp_org_no
,coalesce(tt3.org_name,tt4.dept_name)   as erp_org_name
,case when coalesce(tt3.dept_name,tt4.dept_name)='辽宁分公司' then '7029'
else coalesce(tt3.dept_no,tt4.dept_no) end as erp_dept_no
,coalesce(tt3.dept_name,tt4.dept_name)  as erp_dept_name
from
(select
user_id,erp_no,user_name,lpad(branch_no,4,0) as branch_no
from (select
user_id,erp_no,user_name,rela_inr_org_id as branch_no
from (
select a.oa_user_id as user_id,a.emp_id as erp_no,a.emp_name as user_name,a.bel_inr_org_id as org_no
from
(select * from pdata_n.T98_ORG_EMP_BASE_INFO where busi_date='2026-08-03') a
) t1
left join
(select * from (
select inr_org_id, rela_inr_org_id,row_number() over(partition by inr_org_id order by end_date desc) as rn
from pdata_n.t04_inr_org_rela_h
where inr_org_rela_type_cd = '11'
and src_tbl = 'ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V'
) a where rn=1
) t2
on t1.org_no = t2.inr_org_id  ) a
) tt2
left join (
select inr_org_id as org_no,
inr_org_name as org_name,
brch_bel_div_org_id as dept_no,
brch_bel_div_org_name as dept_name
from pdata_n.T98_ORG_BRCH_DIV_INFO
where busi_date='2026-08-03'
) tt3
on tt2.branch_no=tt3.org_no
left join (select
brch_bel_div_org_id as dept_no,
max(brch_bel_div_org_name) as dept_name
from pdata_n.T98_ORG_BRCH_DIV_INFO
where busi_date='2026-08-03'
group by brch_bel_div_org_id) tt4
on tt2.branch_no=tt4.dept_no ) t
;

drop  table if  exists gfopenaccount_split_flow_cust_details;

insert overwrite table gfopenaccount_split_flow_cust_details
select
tt.busi_date
,tt.cust_pty_no
,coalesce(kfgx.pty_name,tt.cust_name) as khxm
,kfgx.normal_dev_emp_id as kfrbh
,kfgx.normal_dev_emp_name as kfrxm
,emp1.erp_org_no  as kfr_org_no
,emp1.erp_org_name  as kfr_org_name
,emp1.erp_dept_no as kfr_dept_no
,emp1.erp_dept_name as kfr_dept_name
,kfgx.serv_emp_id as fwrbh
,kfgx.serv_emp_name as fwrxm
,emp2.erp_org_no fw_org_no
,emp2.erp_org_name fw_org_name
,emp2.erp_dept_no fw_dept_no
,emp2.erp_dept_name fw_dept_name
,tt.yyb
,tt.yyb as org_no
,coalesce(org1.inr_org_name,tt.bel_inr_org_name) as org_name
,coalesce(org1.brch_bel_div_org_id,tt.yyb) as dept_no
,coalesce(org1.brch_bel_div_org_name,org1.inr_org_name,tt.bel_inr_org_name) as dept_name
,tt.pty_stat_desc
,n.net_asset
,n.cms_rati
,n.rsrv_time
,tt.ylyyb
,tt.ylyyb as yl_org_no
,coalesce(org2.inr_org_name,org3.brch_bel_div_org_name) as yl_org_name
,coalesce(org2.brch_bel_div_org_id,org3.brch_bel_div_org_id)  as yl_dept_no
,coalesce(org2.brch_bel_div_org_name,org3.brch_bel_div_org_name) as yl_dept_name
,tt.channel
,tt.fcategory
,tt.scategory
,tt.tcategory
,tt.chan_name
,coalesce(tt.fin_lvl1_clas,'非线上渠道') as fin_lvl1_clas
,coalesce(tt.fin_lvl2_clas,'非线上渠道') as fin_lvl2_clas
,tt.incharge
,case when length(trim(tt.ylqd2))=0 then tt.channel else coalesce(tt.ylqd2,tt.channel) end  as ylqd2
,case when length(trim(tt.gffrom))=0 then 'NULL' else tt.gffrom end as gffrom
,case when length(trim(tt.gffromno))=0 then 'NULL' else tt.gffromno end as gffromno
,case when length(trim(tt.scene))=0 then 'NULL' else tt.scene end as scene
,case when length(trim(tt.sceneno))=0 then 'NULL' else tt.sceneno end as sceneno
,1 as khs
,coalesce(t1.mc,'NULL') AS gffromname
,coalesce(t2.mc,'NULL') AS scenename
,tt.assessor_id,tt.assessor --渠道考核人
from
(
select
t.busi_date,t.cust_pty_no,t.cust_name,t.channel,t.ylqd2,t.yyb,t.bel_inr_org_name,t.pty_stat_desc,t.ylyyb,t.incharge,t.fcategory,t.scategory,t.tcategory,t.chan_name,t.fin_lvl1_clas,t.fin_lvl2_clas
,case when t.gffrom is not null and upper(t.gffrom)<>'NULL' and trim(t.gffrom)<>'' then t.gffrom
when t3.gffrom is not null and upper(t3.gffrom)<>'NULL' and trim(t3.gffrom)<>'' then t3.gffrom
when t4.gffrom is not null and upper(t4.gffrom)<>'NULL' and trim(t4.gffrom)<>'' then t4.gffrom
else 'NULL'
end as gffrom
,case when t.gffromno is not null and upper(t.gffromno)<>'NULL' and trim(t.gffromno)<>'' then t.gffromno
when t3.gffromno is not null and upper(t3.gffromno)<>'NULL' and trim(t3.gffromno)<>'' then t3.gffromno
when t4.gffromno is not null and upper(t4.gffromno)<>'NULL' and trim(t4.gffromno)<>'' then t4.gffromno
else 'NULL'
end as gffromno
,case when t.scene is not null and upper(t.scene)<>'NULL' and trim(t.scene)<>'' then t.scene
when t3.scene is not null and upper(t3.scene)<>'NULL' and trim(t3.scene)<>'' then t3.scene
when t4.scene is not null and upper(t4.scene)<>'NULL' and trim(t4.scene)<>'' then t4.scene
else 'NULL'
end as scene
,case when t.sceneno is not null and upper(t.sceneno)<>'NULL' and trim(t.sceneno)<>'' then t.sceneno
when t3.sceneno is not null and upper(t3.sceneno)<>'NULL' and trim(t3.sceneno)<>'' then t3.sceneno
when t4.sceneno is not null and upper(t4.sceneno)<>'NULL' and trim(t4.sceneno)<>'' then t4.sceneno
else 'NULL'
end as sceneno
,t.assessor_id,t.assessor --渠道考核人
from
(
select busi_date,a.cust_pty_no,c.cust_name,cust_src_code as channel,ylqd2,c.bel_inr_org_id as yyb,c.bel_inr_org_name,c.pty_stat_desc,ylyyb,a.incharge,a.fcategory,a.scategory,a.tcategory,a.chan_name,a.fin_lvl1_clas,a.fin_lvl2_clas
,case when instr(ylqd2,':')>0 then substr(ylqd2,1,instr(ylqd2,':')-1) else  ylqd2 end as ylqd
,case when (gffrom is null or length(trim(gffrom))=0 or gffrom='null') then 'NULL' else gffrom end as gffrom
,case when (gffromno is null or length(trim(gffromno))=0 or gffromno='null') then 'NULL' else gffromno end as gffromno
,case when (scene is null or length(trim(scene))=0 or scene='null') then 'NULL' else scene end as scene
,case when (sceneno is null or length(trim(sceneno))=0 or sceneno='null') then 'NULL' else sceneno end as sceneno
,d.assessor_id,d.assessor --渠道考核人
from
(
select
busi_date,cust_pty_no
,cust_src_code,ylqd2,incharge,fcategory,scategory,tcategory,chan_name
,fin_lvl1_clas,fin_lvl2_clas
from(
select  a.oact_date as busi_date,cust_id as cust_pty_no,lvl1_chan as fcategory,lvl2_chan as scategory,lvl3_chan as tcategory,b.chan_name
,case when chan_code='其他' then dvrs_chan else chan_code end as cust_src_code
,a.dvrs_chan as ylqd2
,case when c.disc_flag='1' then '是' when c.disc_flag='0' then '否' else '否' end as incharge
, a.fin_lvl1_clas, a.fin_lvl2_clas
from pdata_n.T98_Cust_Dvrs_Chan_Info a
left join (select * from pdata_n.t08_gks_chan_info where del_flag='0') b
on (case when a.chan_code='其他' then a.dvrs_chan else a.chan_code end) = b.src_chan_id
left join pdata_n.t98_crm_cust_chan_info c
on a.cust_id=c.pty_id
where a.oact_date >= '2017-01-01'
)t
group by busi_date,cust_pty_no,cust_src_code,ylqd2,incharge,fcategory,scategory,tcategory,chan_name,fin_lvl1_clas,fin_lvl2_clas
)a
left join
(
select gffrom,gffromno,scene,sceneno,channel,khh,ylyyb
from
(
select a.pty_id as khh,a.dvrs_inr_org_id as ylyyb
,coalesce(split(a.New_Dvrs_Chan_Id,'_')[0],'NULL') as gffrom
,coalesce(split(a.New_Dvrs_Chan_Id,'_')[1],'NULL') as gffromno
,coalesce(split(a.New_Dvrs_Chan_Id,'_')[2],'NULL') as scene
,coalesce(split(a.New_Dvrs_Chan_Id,'_')[3],'NULL') as sceneno
,coalesce(split(a.New_Dvrs_Chan_Id,'_')[4],'NULL') as channel
from pdata_n.T98_CRM_CUST_CHAN_INFO a
where
a.oact_date>'20170101'
)t
group by gffrom,gffromno,scene,sceneno,channel,khh,ylyyb
)b
on a.cust_pty_no=b.khh
left join (
select pty_id,cust_name_ch as cust_name,bel_inr_org_id,bel_inr_org_name ,pty_stat_desc
from pdata_n.T98_BROK_INDV_CUST_BASE_INFO
where busi_date='2026-08-03'
and inr_acct_flag = '0'  --剔除内部户
and substr(Oact_Date,1,4) <> '2099'    --剔除2099年开户数据（不合理）
union all
select pty_id,cust_full_name_ch as cust_name,bel_inr_org_id,bel_inr_org_name ,pty_stat_desc
from pdata_n.T98_BROK_CORP_CUST_BASE_INFO
where busi_date='2026-08-03'
and Corp_Cust_Clas_Cd<>'2'
and (length(bel_inr_org_id)<>4 or bel_inr_org_id not like '8%')
) c
on a.cust_pty_no=c.pty_id
left join (
select lvl2_chan,lvl3_chan,chan_owner_id as assessor_id,chan_owner_name as assessor from pdata_nds.upload_empkpi_chanowner_2025
) d
on a.tcategory = d.lvl3_chan
where c.pty_id is not null  --需剔除内部户
)t
left join
(select Src_Chan_Id as channel,Ext_Chn as gffrom,Sub_Ext_Chn as gffromno,Inr_Occa as scene,Sub_Inr_Occa as sceneno from pdata_n.T08_GKS_CHAN_INFO
where src_tbl='ODATA_N_GKS.J_CHANNELTYPE' and del_flag='0') t3
on ylqd =t3.channel
left join  pdata_nds.channel_stat t4
on ylqd=t4.channel
)tt
left join
(select src_chan_id as bm,chan_name as mc from PDATA_N.T08_CHAN where src_tbl = 'ODATA_N_CRM.C_TH5_GFFROM' and del_flag = '0' and chan_type_cd = '96' ) t1
on tt.gffrom=t1.bm
left join
(select src_chan_id as bm,chan_name as mc from PDATA_N.T08_CHAN where src_tbl = 'ODATA_N_CRM.C_TH5_GFFROM' and del_flag = '0' and chan_type_cd = '05') t2
on tt.scene=t2.bm
LEFT JOIN (select * from pdata_n.t98_cust_brok_mng_rela_info where busi_date='2026-08-03' and del_flag='0') kfgx ON tt.cust_pty_no=kfgx.pty_id  --取客户开发服务关系
LEFT JOIN gfopenaccount_emp_org_tmp emp1 on kfgx.normal_dev_emp_id = emp1.erp_no  --开发人员信息
LEFT JOIN gfopenaccount_emp_org_tmp emp2 ON kfgx.serv_emp_id = emp2.erp_no  --服务人员信息
LEFT JOIN (select *  from  PDATA_N.T98_ORG_BRCH_DIV_INFO  where busi_date='2026-08-03' ) org1 on  cast(tt.yyb as int)=cast(org1.inr_org_id as int) --取客户营业部信息
LEFT JOIN (
select * from (
select inr_org_id,inr_org_name,brch_bel_div_org_id,brch_bel_div_org_name,
row_number() over(partition by inr_org_id order by busi_date desc) rn
from  PDATA_N.T98_ORG_BRCH_DIV_INFO
) t
where rn=1
) org2
on cast(tt.ylyyb as int)=cast(org2.inr_org_id as int)  --取客户引流营业部信息
LEFT JOIN (select distinct brch_bel_div_org_id,brch_bel_div_org_name from PDATA_N.T98_ORG_BRCH_DIV_INFO  where busi_date='2026-08-03')  org3 on  cast(tt.ylyyb as int)=cast(org3.brch_bel_div_org_id as int)
left join
(
select t2.grp_val as cust_id,net_asset,cms_rati,rsrv_time
from (
select coalesce(a.grp_id,b.grp_id,c.grp_id) as grp_id,a.net_asset,b.index_val as cms_rati,c.index_val as rsrv_time
from
(
select grp_id, sum( cast( coalesce ( index_val, '0' ) as decimal(20,2) ) ) as net_asset
from dm_index_n.index_grp1_net_ast  --20240621切换新指标 158338
where tag_id in('tag999999999') and  busi_date ='2026-08-03'
group by grp_id
) a
full join
(select * from dm_index_n.index_grp_cust_cms_rati where busi_date='2026-08-03') b
on a.grp_id=b.grp_id
full join
(select * from dm_index_n.index_grp_openaccount_rsrv_time where busi_date='2026-08-03') c
on coalesce(a.grp_id,b.grp_id)=c.grp_id
) t1
left join
(select * from dm_index_n.grp_def where grp_type_code in ('INDV_CUST','CORP_CUST')) t2
on t1.grp_id=t2.grp_id
) n
on tt.cust_pty_no=n.cust_id;
