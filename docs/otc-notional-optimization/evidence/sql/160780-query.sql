--148763,102002,149053,159763,128369
with aum_asset as 
(
select 
	t1.grp_id1,
	t1.grp_id2,
	t2.grp_id3,
	tag_id,
	index_val,
	t1.busi_mon
from 
(select * from dm_index_n.index_grp2_std_ast_aft_covt_mth_apd
where busi_mon between '${yyyyMM,-6M}' and '${yyyyMM}'
and tag_id not in ('tag999999999','tag074443736','tag074443705','tag074443704')
)t1 
left join 
(
select 
	b.grp_id grp_id1,
	c.grp_id grp_id3,
	busi_mon
from 
(select 
	emp_id as emp_no,
	pty_id as cust_no,
	substr(date2datekey(busi_date),1,6) busi_mon 
from  pdata_n.T01_PTY_EMP_RELA_ADTNL_INFO
where src_tbl = 'ODATA_N_AUM.A_TCUST_RELA'  
and busi_date  in (LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-6)),
							LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-5)),
							LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-4)),
							LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-3)),
							LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-2)),
							LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-1)),
							'${yyyy-MM-dd}'
							)
and Pty_Emp_Rela_Type_Cd = '01'
and vld_flag = '1'
group by 1,2,3
)a
join 
(select grp_val,grp_id
from dm_index_n.grp_def 
where grp_type_code in ('CORP_CUST','INDV_CUST', 'OFFLINE_CUST') 
and status = '1'
)b
on a.cust_no = b.grp_val 
join 
(select * from dm_index_n.grp_def where grp_type_code = 'STAFF'and status = '1')c 
on a.emp_no = c.grp_val 
)t2 
on t1.grp_id1 = t2.grp_id1 and t1.busi_mon = t2.busi_mon 

union all 
select grp_id3 grp_id1,grp_id1 grp_id2,grp_id2 grp_id3,'tag074443736' tag_id,sum(cast(index_val as double))*0.06 index_val,busi_mon
from dm_index_n.index_grp3_org_emp_cstdprd_avgast_aum_mon 
where busi_mon BETWEEN substr(default.date2datekey(ADD_MONTHS('${yyyy-MM}-01',-6)),1,6)  and '${yyyyMM}'
group by grp_id3,grp_id1,grp_id2,busi_mon

union all 
select grp_id1,grp_id2,grp_id3,tag_id,sum(case when tag_id = 'tag074443705' then cast(index_val as double)*0.8
									   when tag_id = 'tag074443704' then cast(index_val as double)*0.26 end)index_val,busi_mon 
from 	dm_index_n.index_grp3_CompScal_OtcDeri_Cs_MthApd 
where busi_mon BETWEEN substr(default.date2datekey(ADD_MONTHS('${yyyy-MM}-01',-6)),1,6)  and '${yyyyMM}'
group by 1,2,3,4,busi_mon
)

SELECT grp1.grp_id AS grp_id1, grp2.grp_id AS grp_id2, grp3.grp_id AS grp_id3, index.index_val, from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') data_time, 'wxfuyangxun' modify_operator, '2999-12-31 00:00:00' modify_time, '1' status, 'ind2024062601642742' index_id, index.busi_mon busi_mon, tag_id FROM (



select 
	grp_id1,
	grp_id2,
	grp_id3,
	index_val,
	tag_id,
	busi_mon 

from 
	(
	select 
		grp_id1,
		nvl(pre.grp_id2,a.grp_id2)  grp_id2,
		grp_id3,
		sum(index_val) index_val,
		tag_id,
		busi_mon 
	from 
	(
	select 
		grp_id1,
		grp_id2,
		grp_id3,
		index_val,
		tag_id,
		busi_mon
	from  aum_asset 
	union all 
	select 
		grp_id1,
		grp_id2,
		grp_id3,
		sum(cast(index_val as double)) index_val,
		'tag999999999' tag_id,
		busi_mon
	from  aum_asset 
	group by grp_id1,grp_id2,grp_id3,busi_mon
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
	(select * from dm_index_n.grp_def where grp_type_code in ('COMPANY', 'DEPT_OF_HO', 'SUB_COMPANY', 'BRANCH_HEADQUARTERS', 'BUSINESSOFFICE'))b 
	on a.pre_org_no = b.grp_val
	join 
	(select * from dm_index_n.grp_def where grp_type_code in ('COMPANY', 'DEPT_OF_HO', 'SUB_COMPANY', 'BRANCH_HEADQUARTERS', 'BUSINESSOFFICE') and status = '1')c 
	on a.inr_org_id = c.grp_val
	)pre 
	on a.grp_id2 = pre.grp_id
	group by 1,2,3,5,6
	)a 
	join 
	(select * from dm_index_n.grp_def where status = '1' and grp_type_code in ('CORP_CUST', 'CSTD_MOT_PRD', 'INDV_CUST', 'OFFLINE_CUST', 'OTC_COUNTERPARTY','COMPANY'))b1 
	on a.grp_id1 = b1.grp_id 
	
	join 
	(SELECT grp_id,case when grp_val = '8888' then 'ERP-0' else grp_val end grp_val FROM dm_index_n.grp_def WHERE status = '1'  AND grp_type_code IN ('BRANCH_HEADQUARTERS', 'COMPANY', 'DEPT_OF_HO', 'BUSINESSOFFICE', 'SUB_COMPANY'))b2 
	on a.grp_id2 = b2.grp_id 
	
	left join 
	(select * from dm_index_n.grp_def WHERE status = '1'  AND grp_type_code in('STAFF','COMPANY'))b3 
	on a.grp_id3 = b3.grp_id 
	where busi_mon >= '${yyyy}01'
	) index 
JOIN (SELECT * FROM dm_index_n.grp_def WHERE status='1' AND grp_type_code IN ('COMPANY', 'CORP_CUST', 'CSTD_MOT_PRD', 'CSTD_MOT_PRD', 'INDV_CUST', 'OFFLINE_CUST', 'OTC_COUNTERPARTY')) grp1 ON index.grp_id1 = grp1.grp_id 
JOIN (SELECT * FROM dm_index_n.grp_def WHERE status='1' AND grp_type_code IN ('BUSINESSOFFICE', 'BRANCH_HEADQUARTERS', 'COMPANY', 'DEPT_OF_HO', 'BUSINESSOFFICE', 'SUB_COMPANY', 'BUSINESSOFFICE')) grp2 ON index.grp_id2 = grp2.grp_id 
LEFT JOIN (SELECT * FROM dm_index_n.grp_def WHERE status='1' AND grp_type_code IN ('STAFF', 'STAFF', 'COMPANY', 'STAFF', 'STAFF', 'STAFF', 'STAFF')) grp3 ON index.grp_id3 = grp3.grp_id