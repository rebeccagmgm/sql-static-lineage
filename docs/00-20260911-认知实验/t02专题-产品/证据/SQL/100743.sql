-- task_id: 100743
-- hiveDb: dm_wm_test
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-brk_dataanalysis_test/dm_wm/srr_org_prd_sale_redeem_rate_mon.py
-- observed_at: 2026-09-04T02:03:12.785Z

-- createSql
create table if not exists srr_cust_prd_redeem_mon_tmp as select c.grp_val as pty_id,p.scr_cd as prd_no,g.prd_type_busi,o.bel_inr_org_id as inr_org_id,b.brch_bel_div_org_id ,max (
  o.cust_type
)
cust_type ,substr(k.busi_date,1,7) mon_no ,sum(cast(k.index_val as double)) redeem_amt from ( select grp_id1,grp_id2,index_val,busi_date from dm_index_n.index_grp_client_secu_otc_fin_redeem_amt where substr(busi_date,1,7)=substr('2026-01-17',1,7) and tag_id = 'tag999999999' union all select grp_id1,grp_id2,index_val,busi_date from dm_index_n.index_grp_client_secu_otc_deri_redeem_amt where substr(busi_date,1,7)=substr('2026-01-17',1,7) and tag_id = 'tag999999999' ) k left join (--客户 SELECT grp_id,grp_val FROM dm_index_n.grp_def WHERE grp_type_code IN ('CORP_CUST', 'INDV_CUST') ) c on k.grp_id1 = c.grp_id left join (--产品 SELECT grp_id,grp_val FROM dm_index_n.grp_def WHERE grp_type_code IN ('NEWS_SECU') ) s on k.grp_id2 = s.grp_id left join ( select scr_cd,secu_id from pdata_news_n.t02_scr_type where src_id = 'XLA' and scr_type_std_cd ='PRD01' ) p on s.grp_val = p.secu_id join ( select scr_cd,ch_name ,if(scr_type='9999','公募','私募') prd_type_busi ,case ast_type when '1' then '现金货币类' when '2' then '固定收益类' when '3' then '权益类' when '4' then '另类投资类' when '5' then '海外投资类' when '6' then '混合类' end as prd_type_inv ,case strg when '1' then '管理期货' when '2' then '固定收益' when '3' then '主观多头' when '4' then '量化多头' when '5' then '结构化衍生品' when '6' then '组合基金' when '7' then '中性套利' when '8' then '复合策略' when '9' then '股权投资' when '10' then '非标类' when '11' then '事件驱动' end as prd_type_strg from pdata_news_n.t02_prd_fin_info where ( scr_type='9999' and Ast_Type not in ('1','2')--公募 非 现金货币 固收收益 or ('7000'<scr_type and scr_type<'8000' and strg not in ('2'))--私募 非固定收益 ) ) g on p.scr_cd = g.scr_cd left join (--营业部 select pty_id,bel_inr_org_id,'indv' cust_type,busi_date from pdata_n.t98_brok_indv_cust_base_info where substr(busi_date,1,7)=substr('2026-01-17',1,7) union all select pty_id,bel_inr_org_id,'corp' cust_type,busi_date from pdata_n.t98_brok_corp_cust_base_info where substr(busi_date,1,7)=substr('2026-01-17',1,7) ) o on c.grp_val = o.pty_id and k.busi_date = o.busi_date left join ( select inr_org_id,inr_org_name,brch_bel_div_org_id,brch_bel_div_org_name from pdata_n.t98_org_brch_div_info where busi_date=default.pretradedate(date_sub('2026-01-17',-1),1) ) b on b.inr_org_id = o.bel_inr_org_id group by c.grp_val,p.scr_cd,g.prd_type_busi,o.bel_inr_org_id ,substr(k.busi_date,1,7),b.brch_bel_div_org_id ;

create table if not exists srr_org_prd_sale_redeem_rate_tmp as select org.inr_org_id ,org.inr_org_name ,org.brch_bel_div_org_id ,org.brch_bel_div_org_name ,prd.scr_cd as prd_no ,prd.prd_type_busi ,coalesce (
  red.redeem_amt,
  0
)
redeem_amt ,coalesce(sal.mtch_amt,0) mtch_amt ,coalesce(ret.ret_mval,0) ret_mval ,coalesce(red.redeem_amt,0)/(coalesce(red.redeem_amt,0)+coalesce(ret.ret_mval,0)) redeem_rate ,coalesce(tret.ret_mval,0) last_ret_mval ,coalesce(ret.ret_mval,0)-coalesce(tret.ret_mval,0) add_ret_mval ,red.redeem_cust_num ,red.redeem_indv_num ,red.redeem_corp_num ,'2026-01-18 08:05:03' as data_time from ( select inr_org_id,inr_org_name,brch_bel_div_org_id,brch_bel_div_org_name from pdata_n.t98_org_brch_div_info where busi_date=default.pretradedate(date_sub('2026-01-17',-1),1) ) org join (--标的 公募 私募 非固收 select scr_cd,ch_name ,if(scr_type='9999','公募','私募') prd_type_busi ,case ast_type when '1' then '现金货币类' when '2' then '固定收益类' when '3' then '权益类' when '4' then '另类投资类' when '5' then '海外投资类' when '6' then '混合类' end as prd_type_inv ,case strg when '1' then '管理期货' when '2' then '固定收益' when '3' then '主观多头' when '4' then '量化多头' when '5' then '结构化衍生品' when '6' then '组合基金' when '7' then '中性套利' when '8' then '复合策略' when '9' then '股权投资' when '10' then '非标类' when '11' then '事件驱动' end as prd_type_strg from pdata_news_n.t02_prd_fin_info where ( scr_type='9999' and Ast_Type not in ('1','2')--公募 非 现金货币 固收收益 or ('7000'<scr_type and scr_type<'8000' and strg not in ('2'))--私募 非固定收益 ) ) prd on 1=1 left join (--场外 赎回 select prd_no,inr_org_id,mon_no ,sum(redeem_amt) redeem_amt ,count(distinct pty_id) redeem_cust_num ,count(distinct if(cust_type='indv',pty_id,null)) redeem_indv_num ,count(distinct if(cust_type='corp',pty_id,null)) redeem_corp_num from srr_cust_prd_redeem_mon_tmp group by prd_no,inr_org_id,mon_no ) red on org.inr_org_id = red.inr_org_id and prd.scr_cd = red.prd_no left join (--申购，全产品销售中取，含转换 select prd_no,inr_org_id,substr(busi_date,1,7) mon_no ,sum(cast(mtch_amt as double)) mtch_amt,count(distinct pty_id) as sale_cust_num from pdata_n.t98_cust_prd_sale_info where substr(busi_date,1,7) = substr('2026-01-17',1,7) and src_tbl in ( 'ODATA_N_RCC.H_HIS_SECUMDELIVER' --零售多金融柜台交易 ,'ODATA_N_RCC.H_HIS_DERIVDELIVER' --零售衍生品理财（OTC）交易 ,'ODATA_N_RCC.H_HIS_PRODADVDELIVER' --基金投顾交易 ,'ODATA_N_ICC.H_HIS_SECUMDELIVER' --机构多金融柜台交易（认申购业务较少） ) and evt_type='OTC' group by prd_no,inr_org_id,substr(busi_date,1,7) )sal on org.inr_org_id = sal.inr_org_id and prd.scr_cd = sal.prd_no left join (--月末保有 select prd_no,inr_org_id,substr(busi_date,1,7) mon_no ,sum(cast(ret_mval as double)) as ret_mval from pdata_n.t98_cust_prd_ret_info where busi_date = '2026-01-17'--date_sub(concat(substr('2026-01-17',1,7),'-01'),1) and src_tbl in ( 'ODATA_N_RCC.A_SECUMSHARE' --零售多金融柜台 ,'ODATA_N_RCC.A_PRODADVSHARE' --基金投顾 ,'ODATA_N_ICC.A_SECUMSHARE' --机构多金融柜台 ) and evt_type='OTC' group by prd_no,inr_org_id,substr(busi_date,1,7) )ret on org.inr_org_id = ret.inr_org_id and prd.scr_cd = ret.prd_no left join (--上年末保有 select prd_no,inr_org_id,substr(busi_date,1,7) mon_no ,sum(cast(ret_mval as double)) as ret_mval from pdata_n.t98_cust_prd_ret_info where busi_date = concat(cast(cast(substr('2026-01-17',1,4) as int)-1 as varchar(4)),'-12-31') and src_tbl in ( 'ODATA_N_RCC.A_SECUMSHARE' --零售多金融柜台 ,'ODATA_N_RCC.A_PRODADVSHARE' --基金投顾 ,'ODATA_N_ICC.A_SECUMSHARE' --机构多金融柜台 ) and evt_type='OTC' group by prd_no,inr_org_id,substr(busi_date,1,7) )tret on org.inr_org_id = tret.inr_org_id and prd.scr_cd = tret.prd_no where coalesce(red.redeem_amt,0)+coalesce(sal.mtch_amt,0)+coalesce(ret.ret_mval,0)+coalesce(tret.ret_mval,0)<>0 ;

create table if not exists srr_org_prd_sale_redeem_rate_mon (
  count_dimen string comment '统计维度',
  inr_org_id string comment '营业部编号',
  inr_org_name string comment '营业部名称',
  brch_bel_div_org_id string comment '分公司编号',
  brch_bel_div_org_name string comment '分公司名称',
  prd_no string comment '产品编号',
  prd_name string comment '产品名称',
  prd_type_busi string comment '公募私募',
  prd_type_inv string comment '产品类型',
  prd_type_strg string comment '私募策略',
  mngr_name string comment '管理人',
  redeem_amt string comment '赎回金额',
  mtch_amt string comment '销售金额',
  ret_mval string comment '保有金额',
  redeem_rate string comment '赎回占比',
  last_ret_mval string comment '上年末保有金额',
  add_ret_mval string comment '较上年末保有增值',
  redeem_cust_num string comment '赎回客户数',
  redeem_indv_num string comment '赎回个人客户数',
  redeem_corp_num string comment '赎回机构客户数',
  mth_1_ror string comment '近一个月产品收益率',
  ths_year_ror string comment '今年以来产品收益率',
  data_time string comment '数据时间'
)
comment '营业部产品销赎比'
PARTITIONED BY (mon_no string comment '')
STORED AS orc;

-- querySql
drop table if exists srr_cust_prd_redeem_mon_tmp;

drop table if exists srr_org_prd_sale_redeem_rate_tmp;

insert overwrite table srr_org_prd_sale_redeem_rate_mon partition (mon_no='202601')
select t1.count_dimen
,t1.inr_org_id
,t1.inr_org_name
,t1.brch_bel_div_org_id
,t1.brch_bel_div_org_name
,t1.prd_no
,t2.ch_name prd_name
,coalesce(t1.prd_type_busi,t2.prd_type_busi) prd_type_busi
,t2.prd_type_inv
,t2.prd_type_strg
,t3.mngr_name
,t1.redeem_amt
,t1.mtch_amt
,t1.ret_mval
,t1.redeem_rate
,t1.last_ret_mval
,t1.add_ret_mval
,t1.redeem_cust_num
,t1.redeem_indv_num
,t1.redeem_corp_num
,t4.mth_1_ror
,t4.ths_year_ror
,'2026-01-18 08:05:03' data_time
from (
select '营业部+产品' count_dimen
,inr_org_id
,inr_org_name
,brch_bel_div_org_id
,brch_bel_div_org_name
,prd_no
,null prd_type_busi
,redeem_amt
,mtch_amt
,ret_mval
,redeem_rate
,last_ret_mval
,add_ret_mval
,redeem_cust_num
,redeem_indv_num
,redeem_corp_num
from srr_org_prd_sale_redeem_rate_tmp
union all
select '分公司+产品' count_dimen
,null inr_org_id
,null inr_org_name
,a.brch_bel_div_org_id
,a.brch_bel_div_org_name
,a.prd_no
,null prd_type_busi
,coalesce(a.redeem_amt,0) redeem_amt
,coalesce(a.mtch_amt,0) mtch_amt
,coalesce(a.ret_mval,0) ret_mval
,coalesce(a.redeem_amt,0)/(coalesce(a.redeem_amt,0)+coalesce(a.ret_mval,0)) redeem_rate
,coalesce(a.last_ret_mval,0) last_ret_mval
,coalesce(a.add_ret_mval,0) add_ret_mval
,coalesce(b.redeem_cust_num,0) redeem_cust_num
,coalesce(b.redeem_indv_num,0) redeem_indv_num
,coalesce(b.redeem_corp_num,0) redeem_corp_num
from (
select brch_bel_div_org_id
,brch_bel_div_org_name
,prd_no
,sum(redeem_amt) redeem_amt
,sum(mtch_amt) mtch_amt
,sum(ret_mval) ret_mval
,sum(last_ret_mval) last_ret_mval
,sum(add_ret_mval) add_ret_mval
from srr_org_prd_sale_redeem_rate_tmp
group by brch_bel_div_org_id
,brch_bel_div_org_name
,prd_no
) a
left join (--赎回客户数
select prd_no,brch_bel_div_org_id,mon_no
,sum(redeem_amt) redeem_amt
,count(distinct pty_id) redeem_cust_num
,count(distinct if(cust_type='indv',pty_id,null)) redeem_indv_num
,count(distinct if(cust_type='corp',pty_id,null)) redeem_corp_num
from srr_cust_prd_redeem_mon_tmp
group by prd_no,brch_bel_div_org_id,mon_no
) b on a.brch_bel_div_org_id = b.brch_bel_div_org_id and a.prd_no = b.prd_no
union all
select '产品' count_dimen
,null inr_org_id
,null inr_org_name
,null brch_bel_div_org_id
,null brch_bel_div_org_name
,a.prd_no
,null prd_type_busi
,coalesce(a.redeem_amt,0) redeem_amt
,coalesce(a.mtch_amt,0) mtch_amt
,coalesce(a.ret_mval,0) ret_mval
,coalesce(a.redeem_amt,0)/(coalesce(a.redeem_amt,0)+coalesce(a.ret_mval,0)) redeem_rate
,coalesce(a.last_ret_mval,0) last_ret_mval
,coalesce(a.add_ret_mval,0) add_ret_mval
,coalesce(b.redeem_cust_num,0) redeem_cust_num
,coalesce(b.redeem_indv_num,0) redeem_indv_num
,coalesce(b.redeem_corp_num,0) redeem_corp_num
from (
select prd_no
,sum(redeem_amt) redeem_amt
,sum(mtch_amt) mtch_amt
,sum(ret_mval) ret_mval
,sum(last_ret_mval) last_ret_mval
,sum(add_ret_mval) add_ret_mval
from srr_org_prd_sale_redeem_rate_tmp
group by prd_no
) a
left join (--赎回客户数
select prd_no,mon_no
,sum(redeem_amt) redeem_amt
,count(distinct pty_id) redeem_cust_num
,count(distinct if(cust_type='indv',pty_id,null)) redeem_indv_num
,count(distinct if(cust_type='corp',pty_id,null)) redeem_corp_num
from srr_cust_prd_redeem_mon_tmp
group by prd_no,mon_no
) b on a.prd_no = b.prd_no
union all
select '分公司' count_dimen
,null inr_org_id
,null inr_org_name
,a.brch_bel_div_org_id
,a.brch_bel_div_org_name
,null as prd_no
,null as prd_type_busi
,coalesce(a.redeem_amt,0) redeem_amt
,coalesce(a.mtch_amt,0) mtch_amt
,coalesce(a.ret_mval,0) ret_mval
,coalesce(a.redeem_amt,0)/(coalesce(a.redeem_amt,0)+coalesce(a.ret_mval,0)) redeem_rate
,coalesce(a.last_ret_mval,0) last_ret_mval
,coalesce(a.add_ret_mval,0) add_ret_mval
,coalesce(b.redeem_cust_num,0) redeem_cust_num
,coalesce(b.redeem_indv_num,0) redeem_indv_num
,coalesce(b.redeem_corp_num,0) redeem_corp_num
from (
select brch_bel_div_org_id
,brch_bel_div_org_name
,sum(redeem_amt) redeem_amt
,sum(mtch_amt) mtch_amt
,sum(ret_mval) ret_mval
,sum(last_ret_mval) last_ret_mval
,sum(add_ret_mval) add_ret_mval
from srr_org_prd_sale_redeem_rate_tmp
group by brch_bel_div_org_id
,brch_bel_div_org_name
) a
left join (--赎回客户数
select brch_bel_div_org_id,mon_no
,sum(redeem_amt) redeem_amt
,count(distinct pty_id) redeem_cust_num
,count(distinct if(cust_type='indv',pty_id,null)) redeem_indv_num
,count(distinct if(cust_type='corp',pty_id,null)) redeem_corp_num
from srr_cust_prd_redeem_mon_tmp
group by brch_bel_div_org_id,mon_no
) b on a.brch_bel_div_org_id = b.brch_bel_div_org_id
union all
select '分公司' count_dimen
,null inr_org_id
,null inr_org_name
,a.brch_bel_div_org_id
,a.brch_bel_div_org_name
,null as prd_no
,a.prd_type_busi
,coalesce(a.redeem_amt,0) redeem_amt
,coalesce(a.mtch_amt,0) mtch_amt
,coalesce(a.ret_mval,0) ret_mval
,coalesce(a.redeem_amt,0)/(coalesce(a.redeem_amt,0)+coalesce(a.ret_mval,0)) redeem_rate
,coalesce(a.last_ret_mval,0) last_ret_mval
,coalesce(a.add_ret_mval,0) add_ret_mval
,coalesce(b.redeem_cust_num,0) redeem_cust_num
,coalesce(b.redeem_indv_num,0) redeem_indv_num
,coalesce(b.redeem_corp_num,0) redeem_corp_num
from (
select brch_bel_div_org_id
,brch_bel_div_org_name
,prd_type_busi
,sum(redeem_amt) redeem_amt
,sum(mtch_amt) mtch_amt
,sum(ret_mval) ret_mval
,sum(last_ret_mval) last_ret_mval
,sum(add_ret_mval) add_ret_mval
from srr_org_prd_sale_redeem_rate_tmp
group by brch_bel_div_org_id
,brch_bel_div_org_name
,prd_type_busi
) a
left join (--赎回客户数
select brch_bel_div_org_id,mon_no
,prd_type_busi
,sum(redeem_amt) redeem_amt
,count(distinct pty_id) redeem_cust_num
,count(distinct if(cust_type='indv',pty_id,null)) redeem_indv_num
,count(distinct if(cust_type='corp',pty_id,null)) redeem_corp_num
from srr_cust_prd_redeem_mon_tmp
group by brch_bel_div_org_id,mon_no,prd_type_busi
) b on a.brch_bel_div_org_id = b.brch_bel_div_org_id and a.prd_type_busi = b.prd_type_busi
union all
select '营业部' count_dimen
,a.inr_org_id
,a.inr_org_name
,a.brch_bel_div_org_id
,a.brch_bel_div_org_name
,null as prd_no
,null as prd_type_busi
,coalesce(a.redeem_amt,0) redeem_amt
,coalesce(a.mtch_amt,0) mtch_amt
,coalesce(a.ret_mval,0) ret_mval
,coalesce(a.redeem_amt,0)/(coalesce(a.redeem_amt,0)+coalesce(a.ret_mval,0)) redeem_rate
,coalesce(a.last_ret_mval,0) last_ret_mval
,coalesce(a.add_ret_mval,0) add_ret_mval
,coalesce(b.redeem_cust_num,0) redeem_cust_num
,coalesce(b.redeem_indv_num,0) redeem_indv_num
,coalesce(b.redeem_corp_num,0) redeem_corp_num
from (
select inr_org_id
,inr_org_name
,brch_bel_div_org_id
,brch_bel_div_org_name
,sum(redeem_amt) redeem_amt
,sum(mtch_amt) mtch_amt
,sum(ret_mval) ret_mval
,sum(last_ret_mval) last_ret_mval
,sum(add_ret_mval) add_ret_mval
from srr_org_prd_sale_redeem_rate_tmp
group by inr_org_id
,inr_org_name
,brch_bel_div_org_id
,brch_bel_div_org_name
) a
left join (--赎回客户数
select inr_org_id,mon_no
,sum(redeem_amt) redeem_amt
,count(distinct pty_id) redeem_cust_num
,count(distinct if(cust_type='indv',pty_id,null)) redeem_indv_num
,count(distinct if(cust_type='corp',pty_id,null)) redeem_corp_num
from srr_cust_prd_redeem_mon_tmp
group by inr_org_id,mon_no
) b on a.inr_org_id = b.inr_org_id
union all
select '营业部' count_dimen
,a.inr_org_id
,a.inr_org_name
,a.brch_bel_div_org_id
,a.brch_bel_div_org_name
,null as prd_no
,a.prd_type_busi
,coalesce(a.redeem_amt,0) redeem_amt
,coalesce(a.mtch_amt,0) mtch_amt
,coalesce(a.ret_mval,0) ret_mval
,coalesce(a.redeem_amt,0)/(coalesce(a.redeem_amt,0)+coalesce(a.ret_mval,0)) redeem_rate
,coalesce(a.last_ret_mval,0) last_ret_mval
,coalesce(a.add_ret_mval,0) add_ret_mval
,coalesce(b.redeem_cust_num,0) redeem_cust_num
,coalesce(b.redeem_indv_num,0) redeem_indv_num
,coalesce(b.redeem_corp_num,0) redeem_corp_num
from (
select inr_org_id
,inr_org_name
,brch_bel_div_org_id
,brch_bel_div_org_name
,prd_type_busi
,sum(redeem_amt) redeem_amt
,sum(mtch_amt) mtch_amt
,sum(ret_mval) ret_mval
,sum(last_ret_mval) last_ret_mval
,sum(add_ret_mval) add_ret_mval
from srr_org_prd_sale_redeem_rate_tmp
group by inr_org_id
,inr_org_name
,brch_bel_div_org_id
,brch_bel_div_org_name
,prd_type_busi
) a
left join (--赎回客户数
select inr_org_id,mon_no
,prd_type_busi
,sum(redeem_amt) redeem_amt
,count(distinct pty_id) redeem_cust_num
,count(distinct if(cust_type='indv',pty_id,null)) redeem_indv_num
,count(distinct if(cust_type='corp',pty_id,null)) redeem_corp_num
from srr_cust_prd_redeem_mon_tmp
group by inr_org_id,mon_no,prd_type_busi
) b on a.inr_org_id = b.inr_org_id and a.prd_type_busi = b.prd_type_busi
) t1
left join (
select scr_cd,ch_name
,if(scr_type='9999','公募','私募') prd_type_busi
,case ast_type
when '1' then '现金货币类'
when '2' then '固定收益类'
when '3' then '权益类'
when '4' then '另类投资类'
when '5' then '海外投资类'
when '6' then '混合类' end as prd_type_inv
,case strg
when '1' then '管理期货'
when '2' then '固定收益'
when '3' then '主观多头'
when '4' then '量化多头'
when '5' then '结构化衍生品'
when '6' then '组合基金'
when '7' then '中性套利'
when '8' then '复合策略'
when '9' then '股权投资'
when '10' then '非标类'
when '11' then '事件驱动' end as prd_type_strg
from pdata_news_n.t02_prd_fin_info
) t2 on t1.prd_no = t2.scr_cd
left join (
select scr_cd,mngr_name
from pdata_news_n.t02_prd_fin_info_ext
where src_id='PRD' and grp_id='01'
) t3 on t1.prd_no = t3.scr_cd
left join (
select trd_cd,trd_dt,1_mth_ror as mth_1_ror,Ror_Ths_Year as Ths_Year_ror
,substr(trd_dt,1,6) mon_no
,row_number() over(partition by trd_cd order by trd_dt desc,rec_upd_time desc) rn
from pdata_news_n.t02_fnd_nav_perf_s where src_id in('WD','PP') --and grp_id='02'
and substr(trd_dt,1,6)<=substr(translate('2026-01-17','-',''),1,6)
) t4 on t1.prd_no = t4.trd_cd and t4.rn=1
;
