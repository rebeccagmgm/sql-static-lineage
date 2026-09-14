-- task_id: 98035
-- hiveDb: dm_ecom_n
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-dm_ecom_n/pc/gfmobile_fund_trade_daily.py
-- observed_at: 2026-09-04T02:00:32.086Z

-- createSql
create table if not exists fund_sale_src_subsrc (
  client_id string comment '客户ID',
  prod_code string comment '产品编号',
  source string comment '一级入口',
  sub_source string comment '二级入口'
)
comment '股票加自选来源入口表'
PARTITIONED BY (busi_date string);

create table if not exists gfmobile_fund_trade_details (
  client_id string comment '客户编号',
  fund_account string comment '资产账户协议编号',
  exchange_type string comment '源交易类别代码',
  stock_code string comment '产品编号',
  stock_type string comment '产品类型',
  stock_name string comment '产品名称',
  business_flag string comment '交易类型代码',
  business_flag_name string comment '交易类型名称',
  business_balance string comment '成交金额',
  net_cms_income string comment '交易手续费',
  entrust_date string comment '委托日期',
  entrust_no string comment '委托编号',
  op_station string comment '站点地址',
  feat_cd string comment '特征码',
  source string comment '一级入口',
  sub_source string comment '二级入口',
  prod_type_inv string comment '产品投资类别',
  product_type string comment '产品分类',
  cust_type_name string comment '客户类型',
  brch_inr_org_id string comment '营业部编号',
  entr_method_cd string comment '委托方式',
  secutype_name string comment '产品类型',
  pos_str string comment '定位串'
)
partitioned by (busi_date string)
STORED AS orc ;

create table if not exists gfmobile_fund_trade_daily_new (
  busi_date string comment '购买日期',
  stock_code string comment '产品代码',
  stock_name string comment '产品名称',
  feat_cd string comment '特征码',
  source string comment '一级入口',
  sub_source string comment '二级入口',
  source_cn string comment '一级入口（中文）',
  sub_source_cn string comment '二级入口（中文）',
  primary_class string comment '一级分类',
  secondary_class string comment '二级分类',
  third_class string comment '三级分类',
  is_opt_channel string comment '是否自选渠道',
  business_flag string comment '交易类型代码',
  business_flag_name string comment '交易类型名称',
  prod_type_inv string comment '产品投资类别',
  product_type string comment '产品分类',
  cust_type_name string comment '客户类型',
  orders_num string comment '订单数',
  buy_users string comment '购买用户',
  total_balance string comment '购买金额',
  net_cms_income string comment '交易手续费',
  is_imp_fcs_etf string comment '是否重点聚集ETF'
)
;

-- querySql
insert overwrite table fund_sale_src_subsrc partition(busi_date)
select
if(a.client_id is not null ,a.client_id,b.client_id) client_id
,if(a.prod_code is not null ,a.prod_code,b.src_prd_id) prod_code
,if(b.source is not null ,b.source,a.source) source
,if(b.sub_source is not null ,b.sub_source,a.sub_source) sub_source
,if(b.busi_date is not null, b.busi_date, a.busi_date ) busi_date
from
(
select * from fund_sale_src_subsrc
) a
full join
(
select client_id,src_prd_id,source,sub_source,busi_date from (   -- 取最新一天新增的数据
select client_id,src_prd_id,source,sub_source,busi_date,row_number() over(partition by client_id,src_prd_id,busi_date order by strt_time desc) rn2 from
(
select client_id,src_prd_id  ,flw_lvl1_entr as source,flw_lvl2_entr as sub_source,strt_time, busi_date, row_number() over(partition by client_id,src_prd_id order by busi_date desc) rn from
(
select a.*,if(e1.client_id is not null and length(trim(e1.client_id))!=0,e1.client_id, e2.client_id) client_id
from
(
select * from PDATA_N.T05_USER_FLW_PRD_EVT where src_tbl ='ODATA_N_MEF.Q_STOCK_SOURCE' and busi_date = '2026-08-26'
) a
left join
(
select user_id,pty_id as client_id
from pdata_n.T04_USER_PTY_RELA_H where src_tbl='ODATA_N_CFM.G_T_SYSTEM_WEBUSER' and end_date='2099-12-31'
) e1 on a.user_id = e1.user_id
left join
(
select  user_id,mobile
from PDATA_N.T04_GFT_USER_ADTNL_INFO where src_tbl='ODATA_N_CFM.G_T_SYSTEM_WEBUSER'
) mb on a.user_id = mb.user_id
left join
(
select mobile_tel, client_id,op_acct_date
from (
select mobile_tel,
a.client_id,
op_acct_date,
rank() over (partition by mobile_tel order by b.op_acct_date desc ) rk
from (select pty_id as client_id, mobile as mobile_tel from pdata_n.t01_pty_addr_info where busi_date ='2026-08-26'  and src_tbl = 'ODATA_N_RCC.A_CLIENTINFO') a
left join
(	select pty_id as client_id,
oact_date as op_acct_date
from pdata_n.T98_BROK_INDV_CUST_BASE_INFO  where busi_date = '2026-08-26'				-- 个人客户
union all
select pty_id as client_id,
oact_date as op_acct_date
from pdata_n.t98_brok_corp_cust_base_info  where busi_date = '2026-08-26'					-- 机构客户
) b
on a.client_id = b.client_id
) a
where a.rk = 1
) e2 on mb.mobile = e2.mobile_tel where length(trim(a.flw_lvl1_entr))!=0 and length(trim(a.flw_lvl2_entr))!=0
)t1
)t2 where rn = 1 and client_id is not null
)t3 where rn2 = 1
) b on a.client_id = b.client_id and a.prod_code = b.src_prd_id;

insert overwrite table gfmobile_fund_trade_details partition(busi_date)
select
deli.pty_id as client_id
,deli.ast_acct_agt_id as fund_account
,deli.src_trd_type_cd as exchange_type
,split(deli.prd_id, '-')[2] as stock_code
,deli.src_scr_type_cd as stock_type
,prd.chiname as stock_name
,deli.busi_flag as business_flag
,case when deli.busi_flag = '4002' then '证券买入' when deli.busi_flag = '4702' then '融资买入' when deli.busi_flag = '4704' then '还券买入' else null end as business_flag_name
,deli.mtch_amt as business_balance
,coalesce((deli.paid_in_cms + deli.stmp_tax + deli.tran_fee + deli.entr_fee + deli.oth_fee - deli.lvl1_fee), 0.00) as net_cms_income
,deli.entr_date as entrust_date
,deli.entr_no as entrust_no
,entr.sta_addr as op_station
,entr.feat_cd
,case when entr.sta_addr like '%sjzq%' then split(split(entr.sta_addr, '@')[1], '\073')[3]
when entr.sta_addr like '%HIPPO%' and size(split(split(entr.sta_addr, '@')[1], '\073'))>5 then split(split(entr.sta_addr, '@')[1], '\073')[3]
else 'null' end as source
,case when entr.sta_addr like '%sjzq%' then split(split(entr.sta_addr, '@')[1], '\073')[4]
when entr.sta_addr like '%HIPPO%' and size(split(split(entr.sta_addr, '@')[1], '\073'))>5 then split(split(entr.sta_addr, '@')[1], '\073')[4]
else 'null' end as sub_source
,case when prd.assetstype = '1' then '现金货币类'
when prd.assetstype = '2' then '固定收益类'
when prd.assetstype = '3' then '权益类'
when prd.assetstype = '4' then '另类投资类'
when prd.assetstype = '5' then '海外投资类'
when prd.assetstype = '6' then '混合类'
else null
end as prod_type_inv
,case when deli.src_scr_type_cd = 'r' then 'REITs'
else case when deli.src_trd_type_cd = '1' then (case when (split(deli.prd_id, '-')[2] like '51%' or split(deli.prd_id, '-')[2] like '56%' or split(deli.prd_id, '-')[2] like '58%') and split(deli.prd_id, '-')[2] not like '519%' then 'ETF'
when prd.chiname like '%基础设施%' then 'REITs'
when split(deli.prd_id, '-')[2] like '50%' then 'LOF'
else '非ETF或LOF'
end
)
when deli.src_trd_type_cd = '2' then (case when split(deli.prd_id, '-')[2] like '159%' then 'ETF'
when prd.chiname like '%基础设施%' then 'REITs'
when split(deli.prd_id, '-')[2] like '16%' then 'LOF'
else '非ETF或LOF'
end
)
else null
end
end as product_type
,case when pty.cust_clas_cd = '0' then '个人'
when pty.cust_clas_cd = '1' then '机构'
when pty.cust_clas_cd = '2' then '自营'
when pty.cust_clas_cd = '3' then '产品'
when pty.cust_clas_cd = '4' then '特法户'
when pty.cust_clas_cd = '5' then '产品（机构端）'
when pty.cust_clas_cd = '6' then '机构（机构端）'
else pty.cust_clas_cd
end as cust_type_name
,pty.org_no
,entr.entr_method_cd
,case when prd.psecutype in ('2001', '3303') then '私募'
when prd.secutype between '0' and '5999' then '资管'
when prd.secutype between '6000' and '6999' then '收益凭证'
when prd.secutype between '7000' and '7999' then '私募'
when prd.secutype = '9999' then '公募'
when prd.secutype = '9001' then '保险理财'
when prd.secutype = '9002' then '银行理财'
end secutype_name
,deli.pos_str
,deli.busi_date
from
(
select
t1.*
from
(
select
*
from PDATA_N.T05_EXCH_SCR_DELI_EVT
where busi_date = '2026-08-26'
and src_tbl = 'ODATA_N_RCC.H_HIS_DELIVER'
and src_trd_type_cd in ('1', '2', 'D', 'H', '9', 'A', 'G', 'S')  --大写
and ast_prop <> 'B'
and length(trim(Src_Trd_Type_Cd)) >= 1  --市场类型不为空
and length(trim(src_scr_type_cd)) >= 1  --产品类型不为空
and busi_flag in ('4002', '4702', '4704')
) t1
inner join (select * from PDATA_N.REF_DW_CD_VAL where split(remark,':')[1] = 'dict_entry=1206' and dw_cd_id ='CD130'and dw_cd_val_desc in ('ETF基金', '国债ETF基金', '货币ETF基金', 'LOF基金', '基金认购', '基金申赎', '投资基金', 'ETF认购', '基础设施基金')) t2
on t1.src_scr_type_cd = t2.dw_cd_val
where if(src_scr_type_cd in ('T','j','l','M'),true,cast(paid_in_cms as decimal(20, 2)) > 0)
) deli
left join (select * from PDATA_N.T05_EXCH_SCR_ENTR_EVT where busi_date between date_sub('2026-08-26', 10) and '2026-08-26' and src_tbl in ('ODATA_N_RCC.H_HIS_ENTRUST', 'ODATA_N_RCC.H_HIS_CRDTENTRUST')) entr
on deli.pty_id = entr.pty_id
and deli.ast_acct_agt_id = entr.ast_acct_agt_id
and split(deli.prd_id, '-')[2] = entr.scr_cd
and deli.entr_no = entr.entr_no
and default.datekey2date(deli.entr_date) = entr.busi_date
left join
(
select
*
from (
select
t.secucode
,t.assetstype
,t.psecutype
,t.secutype
,t.chiname
,case when coalesce(interestdays, datediff(closedate_new, setupdate_new)) < 90 and closedate_new <> '1970-01-01' then '1' else '0'
end interestdays_flag
FROM (
select
scr_cd as secucode
,ast_type as assetstype
,psecu_type as psecutype
,scr_type as secutype
,ch_abbr as chiname
,from_unixtime(cast(substr(setp_date, 1, 10) as bigint), 'yyyy-MM-dd') setupdate_new
,from_unixtime(cast(substr(clos_date, 1, 10) as bigint), 'yyyy-MM-dd') closedate_new
,intr_days as interestdays
,ROW_NUMBER() OVER(partition by scr_cd order by upd_time desc) as rank
FROM pdata_news_n.T02_PRD_FIN_INFO
) t
WHERE t.rank = 1
) x
) prd
on split(deli.prd_id, '-')[2] = prd.secucode
left join (select pty_id, '0' as cust_clas_cd,bel_inr_org_id as org_no from pdata_n.t98_brok_indv_cust_base_info where busi_date = '2026-08-26'
union all
select pty_id, corp_cust_clas_cd as cust_clas_cd,bel_inr_org_id as org_no from pdata_n.t98_brok_corp_cust_base_info where busi_date = '2026-08-26'
) pty
on deli.pty_id = pty.pty_id
;

insert overwrite table gfmobile_fund_trade_daily_new
select
a.busi_date
,stock_code
,stock_name
,feat_cd
,source
,sub_source
,source_cn
,sub_source_cn
,coalesce(e.lvl1_cate, b.lvl1_cate, a.primary_class) as primary_class
,coalesce(e.lvl2_cate, b.lvl2_cate, a.secondary_class) as secondary_class
,coalesce(e.lvl3_cate, b.lvl3_cate, a.third_class) as third_class
,is_opt_channel
,business_flag
,business_flag_name
,prod_type_inv
,product_type
,cust_type_name
,orders_num
,buy_users
,total_balance
,net_cms_income
,is_imp_fcs_etf
from (
select
busi_date
,stock_code
,stock_name
,feat_cd
,source
,sub_source
,source_cn
,sub_source_cn
,case when primary_class is null then '其他' else primary_class end as primary_class
,secondary_class
,third_class
,is_opt_channel
,business_flag
,business_flag_name
,prod_type_inv
,product_type
,cust_type_name
,count(1) as orders_num
,count(distinct client_id) as buy_users
,sum(business_balance) as total_balance
,sum(net_cms_income) as net_cms_income
,is_imp_fcs_etf
from (
select
a.client_id
,a.fund_account
,a.exchange_type
,a.stock_code
,a.stock_type
,a.stock_name
,a.business_flag
,a.business_flag_name
,a.business_balance
,a.net_cms_income
,a.entrust_date
,a.entrust_no
,a.op_station
,if(c.source is not null and a.source = 'HQZX' and a.sub_source = 'LB' ,concat(a.source,'-',c.source),a.source) source
,if(c.sub_source is not null and a.source = 'HQZX' and a.sub_source = 'LB' ,concat(a.sub_source,'-',c.sub_source),a.sub_source) sub_source
,if(c.source_cn is not null  and a.source = 'HQZX' and a.sub_source = 'LB' ,concat(b.Lvl1_Entr_Desc,'-',c.source_cn),b.Lvl1_Entr_Desc) source_cn
,if(c.sub_source_cn is not null and a.source = 'HQZX' and a.sub_source = 'LB' ,concat(b.Lvl2_Entr_Desc,'-',c.sub_source_cn),b.Lvl2_Entr_Desc) sub_source_cn
,if(c.source is not null and c.sub_source is not null and a.source = 'HQZX' and a.sub_source = 'LB' ,c.primary_class,coalesce(e.lvl1_cate, b.Lvl1_Cate)) as primary_class
,if(c.source is not null and c.sub_source is not null and a.source = 'HQZX' and a.sub_source = 'LB' ,c.secondary_class,coalesce(e.lvl2_cate, b.Lvl2_Cate)) as secondary_class
,if(c.source is not null and c.sub_source is not null and a.source = 'HQZX' and a.sub_source = 'LB' ,c.third_class,coalesce(e.lvl3_cate, b.Lvl3_Cate)) as third_class
,case when a.source = 'HQZX' and a.sub_source = 'LB' then '是' else '否' end as is_opt_channel
,a.prod_type_inv
,a.product_type
,a.cust_type_name
,a.brch_inr_org_id
,a.busi_date
,case when a.entr_method_cd = '5' then
case
when upper(a.op_station) like '%,ZH%' or upper(a.op_station) like '%CH:ZH%' then '至慧版' --至慧版
when upper(a.op_station) like '%IPHONE Z%' or upper(a.op_station ) like '%ANDROID Z%' then '元始股' --元始股
when upper(a.op_station) like '%@THS%' then '同花顺App'
when upper(a.op_station) like '%@JDJRAPP%' then '京东App'
when upper(a.op_station) like '%@TDX%' then '通达信App'
when upper(a.op_station) like '%@OEM%' then '微信OEM'
when upper(a.op_station) like '%@ANT%' then '蚂蚁App'
when upper(a.op_station) like '%@ZXG%' then '自选股App'
when upper(a.op_station) like '%@九方智投%' then '九方App'
when upper(a.op_station) like '%@市值风云%' then '市值风云App'
when upper(a.op_station) like '%@股掌柜%' then '股掌柜App'
when upper(a.op_station) like '%@巨丰投顾%' then '巨丰投顾App'
else '易淘金'
end  --易淘金
when a.entr_method_cd = '7' then
case
when upper(a.op_station) like '%@TC%' or upper(a.op_station) like '%@TDX%' then '金融终端' --金融终端
when upper(a.op_station) like '%@WT%' or upper(a.op_station) like '%@WT%' then '至诚版' --至诚版
when upper(a.op_station) like '%HIPPO%' then '操盘手' --操盘手
when upper(a.op_station) like '%QL%' or upper(a.op_station) like '%QWIN%' then '钱龙' --钱龙
when upper(a.op_station) like '%@THS%' then '同花顺App'
when upper(a.op_station) like '%@JDJRAPP%' then '京东App'
when upper(a.op_station) like '%@TDX%' then '通达信App'
when upper(a.op_station) like '%@OEM%' then '微信OEM'
when upper(a.op_station) like '%@ANT%' then '蚂蚁App'
when upper(a.op_station) like '%@ZXG%' then '自选股App'
when upper(a.op_station) like '%@九方智投%' then '九方App'
when upper(a.op_station) like '%@市值风云%' then '市值风云App'
when upper(a.op_station) like '%@股掌柜%' then '股掌柜App'
when upper(a.op_station) like '%@巨丰投顾%' then '巨丰投顾App'
else '其他'
end
end as feat_cd,
if(d.compnt_id is not null,'1','0') as is_imp_fcs_etf
from gfmobile_fund_trade_details a
left join(
select * from PDATA_N.T08_SIP_CHAN_INFO where SRC_TBL='ODATA_N_SIP.G_GFMOBILE_FUND_CHANNEL_LABEL' and busi_date = default.pretradedate(date_add('2026-08-26',1),1)
)b on a.source = b.Lvl1_Entr and a.sub_source = b.Lvl2_Entr
left join (
select
Entr,
Lvl1_Cate,
Lvl2_Cate,
Lvl3_Cate
from pdata_n.T99_TRD_ENTR_CLAS_INFO
where src_tbl = 'ODATA_N_BDP.O_WT_FUND_CHANNEL_SOURCE'
) e on a.source = e.entr
left join
(
select fsss.*,tsci.Lvl1_Entr_Desc as source_cn,tsci.Lvl2_Entr_Desc as sub_source_cn ,coalesce(e.lvl1_cate, tsci.Lvl1_Cate) as primary_class ,coalesce(e.lvl2_cate, tsci.Lvl2_Cate) as secondary_class,coalesce(e.lvl3_cate, tsci.Lvl3_Cate) as third_class
from fund_sale_src_subsrc fsss
left join
(
select * from PDATA_N.T08_SIP_CHAN_INFO where SRC_TBL='ODATA_N_SIP.G_GFMOBILE_FUND_CHANNEL_LABEL' and busi_date = default.pretradedate(date_add('2026-08-26',1),1)
)tsci on fsss.source = tsci.Lvl1_Entr and fsss.sub_source = tsci.Lvl2_Entr
left join (
select
Entr,
Lvl1_Cate,
Lvl2_Cate,
Lvl3_Cate
from pdata_n.T99_TRD_ENTR_CLAS_INFO
where src_tbl = 'ODATA_N_BDP.O_WT_FUND_CHANNEL_SOURCE'
) e on fsss.source = e.entr
) c on a.client_id = c.client_id and a.stock_code = c.prod_code
left join (
select compnt_id,get_json_object(pdef_attr_info, '$.1000450') as in_pool_date,get_json_object(pdef_attr_info, '$.1000451') as del_date
from pdata_n.t00_prd_pool_compnt_info
where src_tbl = 'ODATA_N_PRD.P_CUSTOM_WHS_PROD_REL'
and pool_id = '1000444'
and del_flag = '0'
) d on a.stock_code = d.compnt_id and a.busi_date >= substr(d.in_pool_date,1,10) and a.busi_date < d.del_date
) t
group by busi_date
,stock_code
,stock_name
,feat_cd
,source
,sub_source
,source_cn
,sub_source_cn
,case when primary_class is null then '其他' else primary_class end
,secondary_class
,third_class
,is_opt_channel
,business_flag
,business_flag_name
,prod_type_inv
,product_type
,cust_type_name
,is_imp_fcs_etf
) a
left join (
select * from PDATA_N.T08_SIP_CHAN_INFO where SRC_TBL='ODATA_N_SIP.G_GFMOBILE_FUND_CHANNEL_LABEL' and busi_date = default.pretradedate(date_add('2026-08-26',1),1)
)b on a.source = b.Lvl1_Entr and a.sub_source = b.Lvl2_Entr
left join (
select
Entr,
Lvl1_Cate,
Lvl2_Cate,
Lvl3_Cate
from pdata_n.T99_TRD_ENTR_CLAS_INFO
where src_tbl = 'ODATA_N_BDP.O_WT_FUND_CHANNEL_SOURCE'
) e on a.source = e.entr
;
