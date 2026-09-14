-- task_id: 66277
-- hiveDb: pdata_n
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-WM_DataAnalysis/dm_wm/prd_income/T98_CUST_PRD_SALE_INFO_DER.py
-- observed_at: 2026-09-01T13:37:44.048Z

-- createSql
create table if not exists T98_CUST_PRD_SALE_INFO (
  Pty_Id string comment '当事人编号',
  inr_org_id string comment '所属内部机构编号',
  Prd_Id string comment '产品代码（长）',
  Prd_No string comment '产品代码（短）',
  Pur_Type string comment '购买方式',
  Evt_Type string comment '购买渠道',
  Prd_Busi_Type string comment '产品业务类型',
  Prd_Inv_Type string comment '产品资产分类',
  Prd_Coll_Type string comment '资管产品分类',
  Prd_Fund_Type string comment '公私募分类',
  Mtch_Vol string comment '份额',
  Mtch_Amt string comment '金额',
  Chrg_Fee string comment '费用',
  remark string comment '备注',
  Data_Time string comment '数据时间'
)
comment 'T98_客户全产品销售明细表'
PARTITIONED BY ( Src_Tbl string comment '源表', Busi_Date string comment '业务日期')
STORED AS orc;

-- querySql
insert overwrite table T98_CUST_PRD_SALE_INFO partition(src_tbl,Busi_Date)
select
pty_id,
inr_org_id,
prd_id,
prd_no,
pur_type,
Evt_Type,
b.Prd_Busi_Type,
b.Prd_Inv_Type,
b.Prd_Coll_Type,
b.Prd_Fund_Type,
Mtch_Vol,
Mtch_Amt,
Chrg_Fee,
'' as remark,
'2026-05-19 00:10:20' data_time,
'ODATA_N_RCC.H_HIS_DERIVDELIVER' as src_tbl,
busi_date
from
(
select
pty_id,
inr_org_id,
prd_id,
prd_no,
pur_type,
Evt_Type,
busi_date,
sum(cast(Mtch_Vol as decimal(18, 4))) as Mtch_Vol,
sum(cast(Mtch_Amt as decimal(18, 4))) as Mtch_Amt,
sum(cast(Chrg_Fee as decimal(18, 4))) as Chrg_Fee
from
(
select
pty_id,
inr_org_id,
concat(split(prd_id, '-') [1],'-',split(prd_id, '-') [2]) as prd_id,
split(prd_id, '-') [2] as prd_no,
case
when busi_flag in ('582943') then 'scrp'
when busi_flag in ('582986') then 'purch'
end as pur_type,
'OTC' Evt_Type,
Mtch_Vol,
Mtch_Amt,
Chrg_Fee,
busi_date
from pdata_n.t05_exch_scr_deli_evt
where busi_date = '2026-05-18'
and src_tbl in ('ODATA_N_RCC.H_HIS_DERIVDELIVER')
and busi_flag in ('582943', '582986')
) xxx
where
prd_no not in ('GF0256', 'GF0243', 'GF0220', 'GF0229')
and concat(prd_no, '#', pty_id) <> 'GF0011#020108006122'
group by
pty_id,
inr_org_id,
prd_id,
prd_no,
pur_type,
Evt_Type,
busi_date
) a
left join (
select
scr_cd,
type_cd as prd_busi_type,
type_name_zh as prd_inv_type,
remark as prd_coll_type,
case when type_cd = '4' or (type_cd = '1' and remark = '2') then '2'
when type_cd in ('2', '3') or (type_cd = '1' and remark = '1') then '1'
end as prd_fund_type
from pdata_news_n.t02_scr_type
where src_id = 'PRD'
and scr_type_std_cd ='PRD01'
) b on a.prd_no = b.scr_cd
;
