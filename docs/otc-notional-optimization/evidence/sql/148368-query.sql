--68275,68873,69189,147847,149249,149270,86692,147630,159763,149053,128639,164766
with cust_kh_org as
 (select pty_id, bel_inr_org_id,bel_inr_org_name,substr(date2datekey(busi_date),1,6) busi_mon 
    from pdata_n.T98_BROK_INDV_CUST_BASE_INFO
   where busi_Date in (LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-6)),
						LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-5)),
						LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-4)),
						LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-3)),
						LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-2)),
						LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-1)),
						'${yyyy-MM-dd}')
						
  union all
  select pty_id, bel_inr_org_id,bel_inr_org_name,substr(date2datekey(busi_date),1,6) busi_mon 
    from pdata_n.T98_BROK_CORP_CUST_BASE_INFO
   where busi_Date in (LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-6)),
						LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-5)),
						LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-4)),
						LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-3)),
						LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-2)),
						LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-1)),
						'${yyyy-MM-dd}')
)
 
,cust_org_ratio as
--异地开户切分
 (select 
	t1.pty_id,
	t1.busi_mon,
	coalesce(t2.inr_org_id,t1.org_id) org_id,
	t1.div_rati
from 
	(	
	select pty_id, busi_mon,org_id,sum(div_rati) div_rati
    from (select Pty_Id,
				 busi_mon,
                 Intro_Inr_Org_Id as org_id,
				 Intro_Inr_Org_name as bel_inr_org_name,
                 cast(Ast_Adj_Div_Rati as decimal(18, 2)) as div_rati
            from (select *
                    from (select Pty_Id,
                                 Intro_Inr_Org_Id,
								 Intro_Inr_Org_name,
                                 Ast_Adj_Div_Rati,
								 substr(date2datekey(busi_date),1,6) as busi_mon,
                                 row_number() over(partition by Pty_Id, Intro_Inr_Org_Id,Intro_Inr_Org_name,busi_Date order by Ntfc_Time desc,busi_Date desc) as rn
                            from PDATA_N.T01_CRM_OFST_OACT_CUST_DIV
                           where SRC_TBL = 'ODATA_N_CRM.C_TJJYWTZ_YDKHTJ'
                             and BUSI_DATE in (pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-6)),-1),1),
												pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-5)),-1),1),
												pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-4)),-1),1),
												pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-3)),-1),1),
												pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-2)),-1),1),
												pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-1)),-1),1),
												pretradedate(date_sub('${yyyy-MM-dd}',-1),1))
                             and Appr_Stat_Cd = '2'
                             and substr(Ntfc_Time, 1, 10) <= date_sub(pretradedate(busi_Date,-1),1))t
                   where t.rn = 1) temp
          union all
          select Pty_Id,
				 busi_mon,
                 bel_inr_org_id as org_id,
				 bel_inr_org_name,
                 1 -
                 coalesce(sum(cast(Ast_Adj_Div_Rati as decimal(38, 2))), 0) as div_rati
            from (select t1.Pty_Id,
						 t1.busi_mon,
                         t2.Intro_Inr_Org_Id,
                         t2.Ast_Adj_Div_Rati,
                         t1.bel_inr_org_id,
						 t1.bel_inr_org_name
                    from cust_kh_org t1
                    left join (select Pty_Id,
									  substr(date2datekey(busi_date),1,6) busi_mon,
                                     Intro_Inr_Org_Id,
                                     Ast_Adj_Div_Rati,
                                     row_number() over(partition by Pty_Id, Intro_Inr_Org_Id,busi_Date order by Ntfc_Time desc,busi_date desc) as rn
                                from PDATA_N.T01_CRM_OFST_OACT_CUST_DIV
                               where SRC_TBL = 'ODATA_N_CRM.C_TJJYWTZ_YDKHTJ'
                                and BUSI_DATE in (pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-6)),-1),1),
												pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-5)),-1),1),
												pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-4)),-1),1),
												pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-3)),-1),1),
												pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-2)),-1),1),
												pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-1)),-1),1),
												pretradedate(date_sub('${yyyy-MM-dd}',-1),1))
                                 and Appr_Stat_Cd = '2'
                                 and substr(Ntfc_Time, 1, 10) <=  date_sub(pretradedate(busi_Date,-1),1)) t2
                      on t1.Pty_Id = t2.pty_id and t1.busi_mon = t2.busi_mon
                     and t2.rn = 1) temp
           group by Pty_Id, bel_inr_org_id,bel_inr_org_name,busi_mon) t
   group by pty_id, org_id,busi_mon
   )t1  
	left join 
	--翻牌营业部处理
	(select pre_org_no,inr_org_id from  pdata_nds.om_flip_new_orgid)t2 
	on t1.org_id = t2.pre_org_no
	
   )

,aum_asset as 
(
select 
	grp_id1,
	grp_id2,
	index_val,
	a.tag_id,
	busi_mon
from 
	(
	select 
		b.grp_id grp_id1,
		c.grp_id grp_id2,
		tag_id,
		index_val,
		busi_mon
	from 	
		(
		--普通账户市值等进行异地开户及代销产品户切分
		select 
			s1.grp_val grp_val1,
			nvl(s2.org_id,s3.org_id) grp_val2,
			s1.index_val * nvl(s2.index_val,div_rati) index_val,
			tag_id,
			s1.busi_mon
		from
			(
			select 
				grp_val,tag_id,index_val/num index_val,t1.busi_mon
			from 
				(
				select grp_id1 grp_id,tag_id,sum(cast(index_val as double))index_val,busi_mon
				from dm_index_n.index_grp2_cust_org_asset_std_mthaccum_all 
				where busi_mon BETWEEN substr(default.date2datekey(ADD_MONTHS('${yyyy-MM}-01',-6)),1,6) and '${yyyyMM}'
				group by grp_id1,tag_id,busi_mon
				)t1 
				join 
				(select 
					count(zzr_date) num,
					mon busi_mon
				from  
				(
				select 	default.datekey2date(b.cal_date) as zzr_date,
						substr(cal_date,1,6) AS mon,
						substr(cal_date,1,4) AS annual
				from pdata_news_n.t02_scr_trd_cal b
				where src_id = 'TL' 
				and grp_id = '01'  
				and mkt_cd = 'SSE' 
				and cal_date between default.date2datekey(ADD_MONTHS('${yyyy-MM}-01',-6)) and '${yyyyMMdd}'
				)a group by mon
				)t2
				on t1.busi_mon = t2.busi_mon
				join 
				(select * FROM dm_index_n.grp_def WHERE status = '1' and grp_type_code IN ('CORP_CUST','INDV_CUST'))t3 
				on t1.grp_id = t3.grp_id
			)s1 
			left join 
			(
			--代销产品户切分
			select 
				t2.grp_val as cust_no,
				nvl(t3.grp_val,'-') as org_id,
				index_val,
				busi_mon
			from 
				(
				select 
					grp_id,grp_id2,a.index_val * nvl(b.index_val,0) as index_val,a.busi_mon
				from 
					(
					select distinct grp_id,cast(index_val as double) index_val,busi_mon from dm_index_n.index_grp1_LvrgAstProp_Prdcust_Mth
					where tag_id = 'tag999999999' 
					and busi_mon between substr(default.date2datekey(ADD_MONTHS('${yyyy-MM-dd}',-6)),1,6) and '${yyyyMM}'
					)a 
					left join 
					(
					select distinct grp_id1,grp_id2,cast(index_val as double) index_val,busi_mon from dm_index_n.index_grp2_TnrProp_Prdcust_Mth
					where tag_id = 'tag999999999' 
					and busi_mon between substr(default.date2datekey(ADD_MONTHS('${yyyy-MM-dd}',-6)),1,6) and '${yyyyMM}'
					)b 
					on a.grp_id = b.grp_id1 and a.busi_mon = b.busi_mon 
				)t1 
				left join 
				(select * from dm_index_n.grp_def WHERE status = '1' and grp_type_code ='CORP_CUST')t2 
				on t1.grp_id = t2.grp_id 
				left join 
				(SELECT * FROM dm_index_n.grp_def WHERE grp_type_code ='BUSINESSOFFICE' and status = '1')t3 
				on t1.grp_id2 = t3.grp_id 
				
			union all 
			--定向配比户
			select 
				prd_cust_no cust_no, -- 产品户编码
				case when directional_branch_org = '1505' then '1519' else directional_branch_org end  org_id,  -- 定向机构编码
				1 as index_val,--资产全部记给定向配比户定向配比的分支机构
				substr(default.date2datekey(busi_date),1,6) busi_mon
			from dm_index_n.prdcust_mng_prd_ext_rela 
			where busi_date in( pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-6)),-1),1),
								pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-5)),-1),1),
								pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-4)),-1),1),
								pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-3)),-1),1),
								pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-2)),-1),1),
								pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-1)),-1),1),
								default.pretradedate(date_sub('${yyyy-MM-dd}',-1),1) 
								)
			and prod_account_sub_type='1' --定向配比户
			group by prd_cust_no,directional_branch_org,substr(default.date2datekey(busi_date),1,6)
			)s2
			
			on s1.grp_val = s2.cust_no and s1.busi_mon = s2.busi_mon
			
			left join 
			--异地开户切分
			(select pty_id,busi_mon,org_id,div_rati from cust_org_ratio)s3
			on s1.grp_val = s3.pty_id and s1.busi_mon = s3.busi_mon 
		)a 
		join 
		(select * FROM dm_index_n.grp_def WHERE status = '1' and grp_type_code IN ('CORP_CUST','INDV_CUST'))b 
		on a.grp_val1 = b.grp_val 
		join 
		(SELECT * FROM dm_index_n.grp_def WHERE grp_type_code IN ('BRANCH_HEADQUARTERS', 'BUSINESSOFFICE') and status = '1')c 
		on a.grp_val2 = c.grp_val 
	group by 1,2,3,4,5
	
	
	union all 
	--财富相关资产
	select 
		grp_id1,
		--将长沙银行股份有限公司OTC_其他类型的AUM标准资产考核规模由慈溪浒山路营业部调整至湖南分公司
		case when grp_id1 in ('grp00010000000000049593','grp00010000000000049674','grp00010000000000049673','grp00010000000000049675')
			 then 'grp00030000000000000264' else grp_id2 end grp_id2,
		tag_id,sum(cast(index_val as double)) index_val,busi_mon
	from 	dm_index_n.index_grp2_ApdTnrAmt_2026YearAUMExamCali_MthApd --190449>>226278
	where busi_mon BETWEEN substr(default.date2datekey(ADD_MONTHS('${yyyy-MM}-01',-6)),1,6)  and '${yyyyMM}'
	group by grp_id1,grp_id2,tag_id,busi_mon
	
	union all 
	--跨境期货
	select grp_id1,grp_id2,tag_id,sum(cast(index_val as double)) index_val,busi_mon
	from dm_index_n.index_grp3_CompScal_OtcDeri_Cs_MthApd
	where busi_mon BETWEEN substr(default.date2datekey(ADD_MONTHS('${yyyy-MM}-01',-6)),1,6)  and '${yyyyMM}'
	group by grp_id1,grp_id2,tag_id,busi_mon
	
	union all 
	--托管外包
	select grp_id3 grp_id1,grp_id1 grp_id2,'tag074443736' tag_id,sum(cast(index_val as double)) index_val,busi_mon
	from dm_index_n.index_grp3_org_emp_cstdprd_avgast_aum_mon 
	where busi_mon BETWEEN substr(default.date2datekey(ADD_MONTHS('${yyyy-MM}-01',-6)),1,6)  and '${yyyyMM}'
	group by grp_id3,grp_id1,busi_mon


	union all 
	--投顾业务
	select 
		a.grp_id grp_id1,
		d.grp_id grp_id2,
		'tag074451889' as tag_id,
		sum(index_val) index_val,
		a.busi_mon 
	from 
	(select grp_id,cast(index_val as double) as index_val,substr(date2datekey(busi_date),1,6) busi_mon
	from dm_index_n.index_grp1_ApdAst_IaBusi_Mth --226095
	where tag_id = 'tag999999999'
	and  busi_date in (LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-6)),
						LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-5)),
						LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-4)),
						LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-3)),
						LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-2)),
						LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-1)),
						'${yyyy-MM-dd}')
	and busi_date >='${yyyy}-01-01'
	)a 
	join 
	(select * FROM dm_index_n.grp_def WHERE status = '1' and grp_type_code IN ('CORP_CUST','INDV_CUST'))b 
	on a.grp_id = b.grp_id 
	join cust_kh_org c 
	on b.grp_val = c.pty_id and a.busi_mon = c.busi_mon
	join 
	(SELECT * FROM dm_index_n.grp_def WHERE grp_type_code IN ('BRANCH_HEADQUARTERS', 'BUSINESSOFFICE') and status ='1')d 
	on c.bel_inr_org_id = d.grp_val 
	group by 1,2,5

	union all 
	--期货
	select 
		'grp00090000000000000001' as grp_id1,
		grp_id grp_id2,
		'tag074443204' as tag_id,
		sum(cast(std_equi as double)) as index_val, 
		busi_mon 
	from  
		(select sec_dept_no,std_equi,bus_mon busi_mon from pdata_nds.file_gfqh_ib_cust_eval_sum --229112
		where bus_mon between substr(default.date2datekey(ADD_MONTHS('${yyyy-MM}-01',-6)),1,6)  and '${yyyyMM}'
		--and busi_date in 
		--                (pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-6)),-1),1),
		--				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-5)),-1),1),
		--				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-4)),-1),1),
		--				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-3)),-1),1),
		--				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-2)),-1),1),
		--				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-1)),-1),1),
		--				pretradedate(date_sub('${yyyy-MM-dd}',-1),1))
		and bus_mon >='${yyyy}01'
		)a 
		join 
		(SELECT grp_id,grp_val FROM dm_index_n.grp_def WHERE grp_type_code IN ('BRANCH_HEADQUARTERS', 'BUSINESSOFFICE') and status ='1')b 
		on lpad(a.sec_dept_no,4,'0') = b.grp_val
	group by grp_id,busi_mon
	)a
	join 
	(select * from pdata_nds.aum_asset_ast_style_cd 
	where busi_year = '${yyyy}'
	) b 
	on a.tag_id = b.tag_id 
)

SELECT grp1.grp_id AS grp_id1, grp2.grp_id AS grp_id2, index.index_val, from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') data_time, 'wxfuyangxun' modify_operator, '2999-12-31 00:00:00' modify_time, '1' status, 'ind2024030684173584' index_id, index.busi_mon busi_mon, tag_id FROM ( 


select 
	grp_id1,
	nvl(pre.grp_id2,a.grp_id2)  grp_id2,
	sum(index_val) index_val,
	tag_id,
	busi_mon 
from 
(
select 
	grp_id1,
	grp_id2,
	index_val,
	tag_id,
	busi_mon
from  aum_asset 
union all 
select 
	grp_id1,
	grp_id2,
	sum(cast(index_val as double)) index_val,
	'tag999999999' tag_id,
	busi_mon
from  aum_asset 
group by grp_id1,grp_id2,busi_mon
)a 
left join 
(select 
	pre_org_no,
	b.grp_id,
	inr_org_id,
	c.grp_id grp_id2
from  
(select pre_org_no,inr_org_id from  pdata_nds.om_flip_new_orgid)a 
join 
(select * from dm_index_n.grp_def where grp_type_code in ('COMPANY', 'DEPT_OF_HO', 'SUB_COMPANY', 'BRANCH_HEADQUARTERS', 'BUSINESSOFFICE') )b 
on a.pre_org_no = b.grp_val
join 
(select * from dm_index_n.grp_def where grp_type_code in ('COMPANY', 'DEPT_OF_HO', 'SUB_COMPANY', 'BRANCH_HEADQUARTERS', 'BUSINESSOFFICE') and status = '1')c 
on a.inr_org_id = c.grp_val
)pre 
on a.grp_id2 = pre.grp_id
left join 
(
select 
	grp_id,
	substr(date_sub(busi_date,-1),1,4) busi_year
from 
	(
	select a.grp_id,'${yyyy,-1y}-12-31' busi_date 
	from  
	(select * from dm_index_n.grp_tag_client_is_aum_exam_del 
	where busi_Date = date_sub(from_unixtime(unix_timestamp(),'yyyy-MM-dd'),1)
	and tag_id = 'tag074449073'
	)a 
	join 
	(select * from dm_index_n.grp_def 
	where status = '1' and grp_type_code in   ('CORP_CUST','CSTD_MOT_PRD', 'INDV_CUST','OFFLINE_CUST', 'OTC_COUNTERPARTY')
	and grp_val in ('021300031950','021300036928','020109024758','020109022523','060700002115','022000004588','022000004826','022000005327','090100010008','037281879866')
	)b 
	on a.grp_id = b.grp_id 
	
	union all 
	select grp_id,busi_date from dm_index_n.grp_tag_client_is_cust_judic_frz where busi_date in( '${yyyy,-1y}-12-31') and tag_id = 'tag074445064'
	)t group by 1,2 
)b 
on a.grp_id1 = b.grp_id and substr(a.busi_mon,1,4) = b.busi_year

where b.grp_id is null 
and busi_mon >='${yyyy}01'
group by 1,2,4,5
	) index JOIN (SELECT * FROM dm_index_n.grp_def WHERE status='1' AND grp_type_code IN ('COMPANY', 'CORP_CUST', 'CORP_CUST', 'CSTD_MOT_PRD', 'CSTD_MOT_PRD', 'CSTD_MOT_PRD', 'CSTD_MOT_PRD', 'INDV_CUST', 'INDV_CUST', 'OFFLINE_CUST', 'OTC_COUNTERPARTY', 'OTC_COUNTERPARTY')) grp1 ON index.grp_id1 = grp1.grp_id JOIN (SELECT * FROM dm_index_n.grp_def WHERE status='1' AND grp_type_code IN ('BUSINESSOFFICE', 'BRANCH_HEADQUARTERS', 'BUSINESSOFFICE', 'BUSINESSOFFICE', 'COMPANY', 'DEPT_OF_HO', 'SUB_COMPANY', 'BRANCH_HEADQUARTERS', 'BUSINESSOFFICE', 'BUSINESSOFFICE', 'BRANCH_HEADQUARTERS', 'BUSINESSOFFICE')) grp2 ON index.grp_id2 = grp2.grp_id