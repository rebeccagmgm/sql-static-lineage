-- task_id: 159558
-- hiveDb: dm_index_n
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-brk_dataanalysis_test/dm_wm/act/wmmg_act_index_sale_det_s.py
-- observed_at: 2026-09-03T07:57:01.994Z

-- createSql
create table if not exists wmmg_act_index_sale_det_s (
  strt_date string comment '活动开始时间',
  end_date string comment '活动结束时间',
  obj_type string comment '活动对象',
  obj_cd string comment '活动对象代码',
  index_id string comment '指标id',
  index_cd string comment '指标代码',
  index_name string comment '指标名称',
  pty_id string comment '客户编号',
  cust_name string comment '客户名称',
  cust_type string comment '客户类型',
  cust_type2 string comment '客户类型，细分',
  inr_org_id string comment '营业部编号',
  brch_bel_div_org_id string comment '分公司编号',
  prd_no string comment '产品编号',
  prd_name string comment '产品名称',
  entr_date string comment '委托日期',
  busi_date string comment '成交日期',
  calc_type string comment '计算方式 1份额 2金额',
  val_ori string comment '原始销量',
  val string comment '折算销量',
  prd_mult string comment '产品倍数',
  cust_mult string comment '客户类型倍数',
  newcust_mult string comment '新客倍数',
  org_rate string comment '营业部分成',
  divd_type string comment '分成比例',
  emp_id string comment '认领人id',
  pos_str string comment '定位串',
  rep_no string comment '申请编号',
  data_time string comment '数据时间'
)
comment '活动管理销售明细表'
PARTITIONED BY (snap_date string comment '快照日期',act_id string comment '活动id')
STORED AS orc;

-- querySql
insert overwrite table wmmg_act_index_sale_det_s partition(snap_date='2026-05-23',act_id)
select act_time.strt_date  --活动开始时间
,act_time.end_date  --活动结束时间
,obj.obj_type  --活动对象
,obj.obj_cd --活动对象代码
,b.index_id --指标id
,b.index_cd --指标代码 --要带上这个，方便复合指标
,b.index_name --指标别名
,a.pty_id --客户编号
,c.cust_name --客户名称
,c.cust_type --客户类型
,ctm.cust_type cust_type2 --客户类型细分（机构客户再分）
,if(a.src_tbl='ODATA_N_PRD.P_INSURANCE_ORDER',rel1.org_id,coalesce(spec.org_no,divd.org_no,c.bel_inr_org_id)) inr_org_id --计入营业部
,if(a.src_tbl='ODATA_N_PRD.P_INSURANCE_ORDER',rel1.dept_id,dept.dept_no) brch_bel_div_org_id --计入分公司
,a.prd_no --产品编号
,prd.prd_name --产品名称
,a.entr_date_adj entr_date --委托时间
,a.busi_date --成交时间
,b.calc_type --计算方式 1份额 2金额
,cast(if(b.calc_type='1',a.mtch_vol,a.mtch_amt) as double)*coalesce(divd.org_rate,1) val_ori --原始销量
,cast(if(b.calc_type='1',a.mtch_vol,a.mtch_amt) as double)*coalesce(divd.org_rate,1)*coalesce(b.covt_mult,1)*coalesce(ctm.covt_mult,1)*coalesce(nc2.covt_mult,nc.covt_mult,1) val --折算后的销量
,b.covt_mult prd_mult --产品倍数
,ctm.covt_mult cust_mult --客户类型倍数
,coalesce(nc2.covt_mult,nc.covt_mult) newcust_mult --新客倍数
,divd.org_rate --营业部分成比例
,divd.divd_type --营业部分成类型
,coalesce(a.offline_emp,rel1.emp_id,rel2.emp_id,rel4.emp_id,rel3.emp_id) emp_id --认领人，基金投顾的按组合认领人，现金增利按最新一笔，人员自购给推荐人
,a.pos_str --定位串
,a.rep_no --申请编号
,'2026-05-24 05:01:23' data_time
,b.act_id
from (--销售明细表 2024开始
select tt.src_tbl,tt.busi_date,tt.entr_date,tt.entr_date_adj
,tt.pos_str,tt.rep_no,tt.busi_flag
,tt.pty_id,if(busi_flag='582986' and tt.mtch_amt=0 and tt.mtch_vol>0,cast(tt.mtch_vol*100 as varchar(24)),tt.mtch_amt) mtch_amt,tt.mtch_vol,if(vv.flag='1',vv.comb_prd_no,tt.prd_no) prd_no
,if(vv.flag='1','1','0') wqj_flag,tt.fia_ast_unit_agt_id,vv.Src_Firm_Comb_Id
,if(tt.src_tbl='ODATA_N_PRD.C_OFFLINE_SALES',tt.remark,null) offline_emp
from (
select pty_id, prd_no, busi_flag
, mtch_vol, mtch_amt, pos_str, rep_no, entr_date, remark, src_tbl, busi_date
,if(coalesce(entr_date,'')='',if(src_tbl='ODATA_N_RCC.H_HIS_PRODADVDELIVER',substr(rep_no,10,8),translate(busi_date,'-','')),entr_date) entr_date_adj
,if(src_tbl='ODATA_N_RCC.H_HIS_PRODADVDELIVER',remark,null) fia_ast_unit_agt_id
from pdata_n.t98_cust_prd_sale_det
where busi_date>='2024-01-01' and src_tbl not in ('ODATA_N_PRD.P_INSURANCE_ORDER')
and busi_date>=default.add_months('2026-01-01',-3)
union all
select t1.pty_id,t1.prd_no,null busi_flag,cast(t1.tot_prem as varchar(38)) mtch_vol,cast(t1.tot_prem as varchar(38)) mtch_amt
,t1.seri_no pos_str,null rep_no,t1.cfm_date entr_date,null remark,'ODATA_N_PRD.P_INSURANCE_ORDER' src_tbl,t1.busi_date
,t1.cfm_date entr_date_adj,null fia_ast_unit_agt_id
from (--主险
select seri_no,agt_id,default.datekey2date(cfm_date) busi_date,cfm_date
,substr(Prd_Id,5,10) prd_no,Pymt_Year_Pd
,Pymt_Year_Pd_Type_Cd,Fir_Tot_Prem,Plcy_Id,tot_prem,pty_id
from pdata_n.T03_PLCY_ADTNL_INFO o1
where src_tbl='ODATA_N_IMS.I_TBSHAREINSURE'
and if(length(coalesce(surnd_date,''))=8,surnd_date<=hesitate_maty_date,true) --如果有退保，必须在犹豫期内
and cfm_date>='20260101'
and del_flag='0'
) t1
join (--正常与满期退保
select Agt_Id,Agt_Stat_Cd,row_number() over(partition by Agt_Id order by End_Date desc) rn
from pdata_n.T03_AGT_STAT_H where src_tbl='ODATA_N_IMS.I_TBSHAREINSURE'
) t0 on t1.agt_id = t0.Agt_Id and t0.rn=1 and t0.Agt_Stat_Cd in ('0','A','101','487','266')
) tt
left join (
select
ast_unit_id,replace(ivst_advs_comb_prd_id,'FAS-P-','') comb_prd_no,ivst_advs_comb_prd_name comb_prd_name
,Frim_Comb_Type_Cd,Src_Firm_Comb_Id,'1' flag
from pdata_n.T03_FAP_FIRM_COMB_HOLD_INFO
where
busi_date='2026-05-23'
and src_tbl='ODATA_N_FAP.F_INVEST_PLAN'
)vv on tt.fia_ast_unit_agt_id=vv.ast_unit_id
) a
join (--标的，假设这些指标产品池都要维护倍数！ 含 活动id 指标id 产品编号 开始结束日期(有些产品无开始结果日期按活动来) 倍数
select act_id
,index_id
,index_cd
,index_name
,strt_date
,end_date
,calc_type
,prd_no
,covt_mult
from dm_index_n.wmmg_act_index_sale_prd_covt_mult_s where busi_date='2026-05-23' and index_type='1'
) b on a.prd_no = b.prd_no
left join (--产品名称
select scr_cd,ch_abbr prd_name from pdata_news_n.t02_prd_fin_info
) prd on a.prd_no = prd.scr_cd
left join (--活动时间范围 用于鉴定新客 【活动id】
select act_id,strt_date, end_date from pdata_nds.pc_wmmg_act_basic where status='0'
) act_time on b.act_id = act_time.act_id
join (--客户类型 ，客户范围筛选
select pty_id,'机构客户' cust_type,cust_full_name_ch cust_name,bel_inr_org_id
from pdata_n.t98_brok_corp_cust_base_info
where busi_date = default.pretradedate(date_sub('2026-05-23', -1), 1)
and coalesce(inr_acct_flag, '') <> '1' --去掉内部户
union all
select pty_id,'个人客户' cust_type,cust_name_ch cust_name,bel_inr_org_id
from pdata_n.t98_brok_indv_cust_base_info
where busi_date = default.pretradedate(date_sub('2026-05-23', -1), 1)
and coalesce(inr_acct_flag, '') <> '1' --去掉内部户
) c on a.pty_id = c.pty_id
left join (--客户范围 与客户类型一起筛选客户 【活动id】
select act_id,id index_id,case when cust_type is null or cust_type like '%3%' or length(cust_type)>1 then '全部客户'
when cust_type='1' then '个人客户'
when cust_type='2' then '机构客户' end as cust_type
from pdata_nds.pc_wmmg_act_index
where index_type='1' and coalesce(index_is_cmpl,'')<>'1'
) d on b.act_id = d.act_id and b.index_id = d.index_id
left join (--代销产品户要剔除
select distinct prd_cust_no from dm_index_n.prdcust_mng_prd_ext_rela
where busi_date=default.pretradedate(date_sub('2026-05-23',-1),1)
and coalesce(prod_account_sub_type,'')<>'1'
) dxcph on a.pty_id = dxcph.prd_cust_no
left join (--客户白名单，从代销产品户中排除掉 【活动id】
select distinct act_id,pty_id
from (
select * from (select act_id,white_cust from pdata_nds.pc_wmmg_act_basic  where status='0') p
lateral view explode(split(white_cust, ',')) num as pty_id
) kkk
) dxcph_wl on b.act_id = dxcph_wl.act_id and dxcph.prd_cust_no = dxcph_wl.pty_id
left join (--客户黑名单，要单独剔除客户的 【活动id】
select distinct act_id,pty_id
from (
select * from (select act_id,black_cust from pdata_nds.pc_wmmg_act_basic  where status='0') p
lateral view explode(split(black_cust, ',')) num as pty_id
) kkk
) bl on b.act_id = bl.act_id and c.pty_id = bl.pty_id
left join (--客户类型倍数，一个指标一个倍数，【活动id】【指标id】 简单处理，只取前三个配置
select pty_id,act_id,index_id,cust_type,cast(covt_mult as double) covt_mult
from dm_index_n.wmmg_act_index_cust_covt_mult_s where snap_date='2026-05-23' and rn='1'
)ctm on b.act_id = ctm.act_id and b.index_id = ctm.index_id and a.pty_id = ctm.pty_id
left join (--新客倍数,加上客户类型，这样给倍数 一个指标只会有一个新客类型 【活动id】【指标id】
select n1.act_id,n1.index_id,n1.covt_mult,n2.first_date,n2.pty_id
from (--新客倍数
select act_id,id index_id,covt_newcust_type cust_type,covt_newcust_mult covt_mult from pdata_nds.pc_wmmg_act_index
where index_type='1' and coalesce(index_is_cmpl,'')<>'1'
) n1
join (--先用成交口径的，后续改用委托的话替换表
select coalesce(v2.grp_val,v1.grp_id) pty_id,v1.index_val first_date,newcust_type
from (
select grp_id,index_val
,case when tag_id='tag999999999' then '金融产品新客'
when tag_id='tag074440618' then '大公募新客'
when tag_id='tag074440617' then '大私募新客' end newcust_type
from dm_index_n.index_Cust_Fir_EntrDate_FinPrd_DelCashExclu_Day
where busi_date='2026-05-23'
union all
select grp_id,translate(index_val,'-','') index_val,'ETF新客' newcust_type
from dm_index_n.index_grp_fir_ret_date_etf where busi_date='2026-05-23'
) v1
left join (
select grp_id,grp_val FROM dm_index_n.grp_def where grp_type_code in ('CORP_CUST', 'INDV_CUST','OFFLINE_CUST')
) v2 on v1.grp_id = v2.grp_id
) n2 on n1.cust_type = n2.newcust_type
union all
select c.act_id,c.index_id,c.covt_mult,translate(min(a.index_val),'-','') first_date,coalesce(d.grp_val,a.grp_id1) pty_id
from (
select * from dm_index_n.index_grp_cust_prd_fir_ret_date where busi_date='2026-05-23'
) a
left join (--活动自定义产品清单
select grp_id,grp_val FROM dm_index_n.grp_def where grp_type_code in ('NEWS_SECU')
) b on a.grp_id2 = b.grp_id
join (
select h1.act_id,h1.index_id,h2.prod_code,h1.covt_mult
from (
select act_id,id index_id,covt_newcust_pdef_pool_id ,covt_newcust_mult covt_mult
FROM pdata_nds.pc_wmmg_act_index
where index_type='1' and coalesce(index_is_cmpl,'')<>'1'
and length(covt_newcust_pdef_pool_id)>0
) h1
join (
select distinct Compnt_Id prod_code , Pool_Id
from pdata_n.T00_PRD_POOL_COMPNT_INFO where src_tbl='ODATA_N_PRD.P_CUSTOM_WHS_PROD_REL'
and coalesce(del_flag,'')<>'1'
) h2 on h1.covt_newcust_pdef_pool_id = h2.Pool_Id
) c on split(coalesce(b.grp_val,a.grp_id2),'\\\.')[2] = c.prod_code
left join (
select grp_id,grp_val FROM dm_index_n.grp_def where grp_type_code in ('CORP_CUST', 'INDV_CUST','OFFLINE_CUST')
) d on a.grp_id1 = d.grp_id
group by c.act_id,c.index_id,c.covt_mult,coalesce(d.grp_val,a.grp_id1)
) nc on a.pty_id = nc.pty_id and b.act_id = nc.act_id and b.index_id = nc.index_id and translate(act_time.strt_date,'-','')<=nc.first_date
left join (--新客补充
select distinct pty_id,'1.2' covt_mult from temp_n.kmh2025_newcust_spec_s where busi_date='2026-05-23'
) nc2 on a.pty_id = nc2.pty_id and b.act_id='2024121525001'
left join (--认领人，统一按最新，毕竟这里只会跑在进行的活动
select deli_pos_str,join_app_no,pty_id,src_prd_id
,row_number() over(partition by pty_id,mtch_date,src_prd_id order by Last_Clm_Time desc,cast(Src_Id as bigint) desc) as rn1
,if(clm_type_cd='5',coalesce(recmd_user,sale_emp_id),sale_emp_id) emp_id --如果是自购的给推荐人
,null org_id,null dept_id
from pdata_n.T01_PRD_SALE_RELA_CLM
where busi_date=default.pretradedate(date_sub('2026-05-23',-1),1)
and src_tbl='ODATA_N_CRM.C_PROD_SALES_RELATION'
and mtch_date >= '20240101'
and Rela_Clm_Stat_Cd ='2'
and length(coalesce(Sale_Emp_Id,''))>=5
union all
select Seri_No deli_pos_str,Plcy_Id  join_app_no,pty_id,substr(Prd_Id,5,10) src_prd_id,1 rn
,if(coalesce(trim(Refr_Emp_Id),'')='' or b.emp_id is null,Cust_Mngr_Emp_Id,Refr_Emp_Id) emp_id
,if(coalesce(trim(Refr_Emp_Id),'')='' or b.emp_id is null,coalesce(d.bel_inr_org_id_len4,d.brch_bel_div_org_id_len4),coalesce(c.bel_inr_org_id_len4,c.brch_bel_div_org_id_len4)) org_id
,if(coalesce(trim(Refr_Emp_Id),'')='' or b.emp_id is null,d.brch_bel_div_org_id_len4,c.brch_bel_div_org_id_len4) dept_id
from (
select Seri_No,Plcy_Id,pty_id,Prd_Id,Cust_Mngr_Emp_Id,Refr_Emp_Id from pdata_n.T03_PLCY_ADTNL_INFO where src_tbl='ODATA_N_IMS.I_TBSHAREINSURE' and del_flag='0'
) a
left join (
select emp_id,brch_bel_div_org_id_len4,brch_bel_div_org_name,bel_inr_org_id,bel_inr_org_name,bel_inr_org_id_len4 from pdata_n.t98_org_emp_base_info where busi_date='2026-05-23'
and (brch_bel_div_org_id_len4 in ('7001','7007','7005','7025') or bel_inr_org_id='ERP-660')
) b on a.Refr_Emp_Id=b.emp_id
left join (--推荐人
select emp_id,brch_bel_div_org_id_len4,brch_bel_div_org_name,bel_inr_org_id,bel_inr_org_name,bel_inr_org_id_len4 from pdata_n.t98_org_emp_base_info where busi_date='2026-05-23'
) c on a.Refr_Emp_Id=c.emp_id
left join (--录单人
select emp_id,brch_bel_div_org_id_len4,brch_bel_div_org_name,bel_inr_org_id,bel_inr_org_name,bel_inr_org_id_len4 from pdata_n.t98_org_emp_base_info where busi_date='2026-05-23'
) d on a.Cust_Mngr_Emp_Id=d.emp_id
) rel1 on a.pos_str = rel1.deli_pos_str and a.prd_no = rel1.src_prd_id and a.pty_id = rel1.pty_id
left join (--现金增利认领人，按最新
select *
,row_number() over(partition by pty_id order by Last_Clm_Time desc,cast(Src_Id as bigint) desc) as rn2
,if(clm_type_cd='5',coalesce(recmd_user,sale_emp_id),sale_emp_id) emp_id --如果是自购的给推荐人
from pdata_n.T01_PRD_SALE_RELA_CLM
where busi_date=default.pretradedate(date_sub('2026-05-23',-1),1)
and src_tbl='ODATA_N_CRM.C_PROD_SALES_RELATION'
and Rela_Clm_Stat_Cd ='2'
and src_prd_id in ('873001','026088')
and length(coalesce(Sale_Emp_Id,''))>=5
) rel2 on a.prd_no = rel2.src_prd_id and a.pty_id = rel2.pty_id and rel2.rn2=1
left join (--基金投顾认领人
select deli_pos_str,pty_id,src_prd_id,sale_emp_id,join_app_no,mtch_amt
,if(clm_type_cd='5',coalesce(recmd_user,sale_emp_id),sale_emp_id) emp_id
from pdata_n.T01_PRD_SALE_RELA_CLM
where busi_date=default.pretradedate(date_sub('2026-05-23',-1),1)
and src_tbl='ODATA_N_CRM.C_PROD_SALES_RELATION'
and Rela_Clm_Stat_Cd ='2'
and Src_Prd_Clas_Cd = '7'
) rel3 on a.Src_Firm_Comb_Id = rel3.deli_pos_str and a.pty_id = rel3.pty_id and a.src_tbl in ('ODATA_N_RCC.H_HIS_PRODADVDELIVER') --and a.wqj_flag='0'
left join ( --微骐骥合并认领人
select deli_pos_str,pty_id,src_prd_id,sale_emp_id ,mtch_amt
,if(clm_type_cd='5',coalesce(recmd_user,sale_emp_id),sale_emp_id) emp_id
,join_app_no
from pdata_n.T01_PRD_SALE_RELA_CLM
where busi_date=default.pretradedate(date_sub('2026-05-23',-1),1)
and src_tbl='ODATA_N_CRM.C_PROD_SALES_RELATION'
and Rela_Clm_Stat_Cd ='2'
) rel4 on a.rep_no = rel4.join_app_no and a.pty_id = rel4.pty_id and cast(a.mtch_amt as double) = cast(rel4.mtch_amt as double)
left join (--营业部特殊调整
select '324800160236' pty_id,1.0 rate,'3266' org_no ,'8764H8' prd_no
) spec on a.pty_id=spec.pty_id and a.prd_no=spec.prd_no
left join (--营业部分成
select * from dm_index_n.wm_cust_org_rate_s where busi_date = '2026-05-23' and  rn='1' and  rn='1' and cast(org_rate as double)>0
) divd on a.pty_id = divd.pty_id and translate(substr(a.busi_date,1,7),'-','') = divd.mon_no and if(a.src_tbl='ODATA_N_PRD.P_INSURANCE_ORDER',false,true)
left join (--分公司
select if(length(orgcode)=3,concat('0',orgcode),orgcode) org_no
,name
,if(length(if(fid='8811',orgcode,fid))=3,concat('0',if(fid='8811',orgcode,fid)),if(fid='8811',orgcode,fid)) dept_no
from PDATA_NDS.LBORGANIZATION where busi_date='2026-05-23'
) dept on coalesce(spec.org_no,divd.org_no,c.bel_inr_org_id) = dept.org_no
join (--活动对象 多个的话这里最高 【活动id】
select act_id,obj_cd,obj_type
from dm_index_n.pc_wmmg_act_obj where snap_date='2026-05-23'
) obj on b.act_id = obj.act_id and case when obj.obj_type='全部' then true
when obj.obj_type='分公司' then if(a.src_tbl='ODATA_N_PRD.P_INSURANCE_ORDER',rel1.dept_id,dept.dept_no) = obj.obj_cd
when obj.obj_type='营业部' then if(a.src_tbl='ODATA_N_PRD.P_INSURANCE_ORDER',rel1.org_id,coalesce(spec.org_no,divd.org_no,c.bel_inr_org_id)) = lpad(obj.obj_cd,4,'0') end
where a.entr_date_adj between coalesce(b.strt_date,act_time.strt_date) and coalesce(b.end_date,act_time.end_date) --活动时间
and if(d.cust_type is null or d.cust_type='全部客户',true,c.cust_type= d.cust_type) --客户范围
and if(dxcph_wl.pty_id is not null, true, dxcph.prd_cust_no is null) --代销产品户剔除，除了白名单的客户不剔
and bl.pty_id is null --客户黑名单
and if(coalesce(ctm.covt_mult,1)=0,false,true) --客户倍数为0的剔除;
