with temp_std as(
select 
    grp_val,
    grp_id,
    sum(cast(index_val as decimal(20,6))) index_val,
    tag_id,
	busi_mon
from  
    (select * from dm_index_n.index_grp2_std_ast_aft_covt_mth_apd where busi_mon BETWEEN '${yyyyMM,-6M}' and '${yyyyMM}' 
    and tag_id in (
                    'tag074443733'
                    ,'tag074443734'
                    ,'tag074440653'
                    ,'tag045318005'
                    ,'tag074443735'
                    ,'tag510001141'
                    ,'tag510000107'
                    ,'tag510000003'
                    ,'tag510000108'
                    ,'tag000000005'
                    ,'tag074450890'
                    ,'tag074451889')
    and busi_mon >='${yyyy}01' 
    )a 
    join 
    (select grp_id,grp_val from dm_index_n.grp_def where grp_type_code in ('CORP_CUST','INDV_CUST') and status = '1')b 
    on a.grp_id1 = b.grp_id 
group by grp_val,grp_id,tag_id,busi_mon
) 
,temp_1 as (
select 
    grp_id1,
    t2.grp_id grp_id2,
    index_val,
    tag_id,
    busi_mon 
from 
    (
    select 
        a.grp_id grp_id1,
        emp_id,
        index_val,
        tag_id,
        a.busi_mon
    from 
        (select 
            grp_val,
            grp_id,
            index_val,
            tag_id,
    	    busi_mon
        from temp_std 
        where tag_id in('tag074443733','tag510000107')
        )a
        left join 
        (
        select 
               pty_id,
               emp_id,
        	   substr(default.date2datekey(busi_date),1,6) busi_mon
        from 
        pdata_n.t01_pty_emp_rela
        where pty_emp_rela_type_cd = '11'  --普通开发关系
        and busi_date in(
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-6)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-5)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-4)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-3)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-2)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-1)),-1),1),
        				pretradedate(date_sub('${yyyy-MM-dd}',-1),1)

        				)
        and src_tbl in ('ODATA_N_CRM.C_TJJGX')
        group by 1,2,3
        )b 
        on a.grp_val = b.pty_id and a.busi_mon = b.busi_mon

    union all 
    select 
        a.grp_id grp_id1,
        emp_id,
        index_val,
        tag_id,
        a.busi_mon
    from 
        (select 
            grp_val,
            grp_id,
            index_val,
            tag_id,
    	    busi_mon
        from temp_std 
        where tag_id in ('tag510000003','tag510000108')
        )a
        left join 
        (
        select 
               pty_id,
               emp_id,
        	   substr(default.date2datekey(busi_date),1,6) busi_mon
        from 
        pdata_n.t01_pty_emp_rela
        where pty_emp_rela_type_cd = '14'  --两融开发关系
        and busi_date in(
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-6)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-5)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-4)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-3)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-2)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-1)),-1),1),
        				pretradedate(date_sub('${yyyy-MM-dd}',-1),1)

        				)
        and src_tbl  = 'ODATA_N_AUM.R_TRELA_HOOK'
        group by 1,2,3
        )b 
        on a.grp_val = b.pty_id  and a.busi_mon = b.busi_mon

    union all 
    select 
        a.grp_id grp_id1,
        coalesce(b.emp_id,c.emp_id) emp_id,
        index_val,
        a.tag_id,
        a.busi_mon
    from 
        (select 
            grp_val,
            grp_id,
            index_val,
            tag_id,
    	    busi_mon
        from temp_std 
        where tag_id in ('tag074443734','tag074440653','tag045318005','tag074443735','tag510001141')
        )a
        left join 
        (
        select 
               pty_id,
               emp_id,
        	   substr(default.date2datekey(busi_date),1,6) busi_mon
        from 
        pdata_n.t01_pty_emp_rela
        where pty_emp_rela_type_cd = '11'  --普通开发关系
        and busi_date in(
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-6)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-5)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-4)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-3)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-2)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-1)),-1),1),
        				pretradedate(date_sub('${yyyy-MM-dd}',-1),1)

        				)
        and src_tbl in ('ODATA_N_CRM.C_TJJGX')
        group by 1,2,3
        )b 
        on a.grp_val = b.pty_id  and a.busi_mon = b.busi_mon
        left join 
        (
        select 
               pty_id,
               emp_id,
        	   substr(default.date2datekey(busi_date),1,6) busi_mon
        from 
        pdata_n.t01_pty_emp_rela
        where pty_emp_rela_type_cd = '14'  --两融开发关系
        and busi_date in(
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-6)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-5)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-4)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-3)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-2)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-1)),-1),1),
        				pretradedate(date_sub('${yyyy-MM-dd}',-1),1)

        				)
        and src_tbl  = 'ODATA_N_AUM.R_TRELA_HOOK'
        group by 1,2,3
        )c
        on a.grp_val = c.pty_id and a.busi_mon = c.busi_mon

    union all 
    select 
        a.grp_id grp_id1,
        emp_id,
        index_val,
        tag_id,
        a.busi_mon
    from 
        (select 
            grp_val,
            grp_id,
            index_val,
            tag_id,
    	    busi_mon
        from temp_std 
        where tag_id = 'tag000000005'
        )a
        left join 
        (
        select 
               pty_id,
               emp_id,
        	   substr(default.date2datekey(busi_date),1,6) busi_mon
        from 
        pdata_n.t01_pty_emp_rela
        where pty_emp_rela_type_cd = '15'  --期权开发关系
        and busi_date in(
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-6)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-5)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-4)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-3)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-2)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-1)),-1),1),
        				pretradedate(date_sub('${yyyy-MM-dd}',-1),1)

        				)
        and src_tbl = 'ODATA_N_AUM.R_TRELA_HOOK'
        group by 1,2,3
        )b 
        on a.grp_val = b.pty_id  and a.busi_mon = b.busi_mon

    union all 
    select 
        a.grp_id grp_id1,
        emp_id,
        index_val,
        tag_id,
        a.busi_mon
    from 
        (select 
            grp_val,
            grp_id,
            index_val,
            tag_id,
    	    busi_mon
        from temp_std 
        where tag_id = 'tag074451889'
        )a
        left join 
        (
        select 
               pty_id,
               emp_id,
        	   substr(default.date2datekey(busi_date),1,6) busi_mon
        from 
        pdata_n.t01_pty_emp_rela
        where pty_emp_rela_type_cd = '02'  --投顾签约关系
        and busi_date in(
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-6)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-5)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-4)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-3)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-2)),-1),1),
        				pretradedate(date_sub(LAST_DAY(ADD_MONTHS('${yyyy-MM-dd}',-1)),-1),1),
        				pretradedate(date_sub('${yyyy-MM-dd}',-1),1)

        				)
        and src_tbl = 'ODATA_N_CRM.C_TTZGW_QYXY'
        group by 1,2,3
        )b 
        on a.grp_val = b.pty_id and a.busi_mon = b.busi_mon
        

    union all 
    select 
        a.grp_id grp_id1,
        emp_id,
        index_val,
        tag_id,
        a.busi_mon
    from 
        (select 
            grp_val,
            grp_id,
            index_val,
            tag_id,
            busi_mon
        from temp_std 
        where tag_id = 'tag074450890'
        )a
        left join 
        (
        select 
	    	pty_id as cust_no,
	    	Emp_Id as emp_id
	    from pdata_n.T01_PTY_EMP_RELA_H  --212648
	    where SRC_TBL IN ('ODATA_N_AUM.C_CUST_BUSI_RELATION') 
	    and Pty_Emp_Rela_Type_Cd  = '47' --T0业务推荐人
	    AND STRT_DATE <='${YYYY-MM-DD}'
        AND END_DATE  > '${YYYY-MM-DD}'   
        )b 
        on a.grp_val = b.cust_no
    )t1 
    left join 
    (select grp_id,grp_val FROM dm_index_n.grp_def WHERE status = '1' and grp_type_code = 'STAFF')t2 
    on t1.emp_id = t2.grp_val
)
,temp_2 as
(
select 
    grp_id1,
    grp_id2,
    index_val * cast(ast_exam_coef as double) index_val,
    a.tag_id,
    busi_mon 
from 
    (
    select 
    	grp_id1,
    	grp_id3 as grp_id2,
    	tag_id,
    	sum(cast(index_val as double)) index_val,
    	busi_mon
    from dm_index_n.index_grp3_CompScal_OtcDeri_Cs_MthApd  
    where busi_mon BETWEEN '${yyyyMM,-6M}' and '${yyyyMM}'
    and busi_mon >='${yyyy}01'
    group by grp_id1,grp_id3,tag_id,busi_mon 

    union all 
    select grp_id3 grp_id1,grp_id2 ,'tag074443736' tag_id,sum(cast(index_val as double)) index_val,busi_mon
    from dm_index_n.index_grp3_org_emp_cstdprd_avgast_aum_mon 
    where busi_mon BETWEEN '${yyyyMM,-6M}' and '${yyyyMM}'
    and busi_mon >='${yyyy}01'
    group by grp_id3,grp_id2,busi_mon

    union all 
    select 
    	grp_id1,
    	grp_id3 as grp_id2,
    	tag_id,
    	sum(cast(index_val as double)) index_val,
    	busi_mon
    from dm_index_n.index_grp3_ApdTnrAmt_2026YearAUMExamCali_MthApd  
    where busi_mon BETWEEN '${yyyyMM,-6M}' and '${yyyyMM}'
    and busi_mon >='${yyyy}01'
    group by grp_id1,grp_id3,tag_id,busi_mon 
    )a
    join 
    (select tag_id,cast(ast_exam_coef as double) ast_exam_coef  from pdata_nds.aum_asset_ast_style_cd where busi_year = '${yyyy}')b 
    on a.tag_id = b.tag_id 
)

,temp_3 as 
(
select 
	grp_id1,
	grp_id2,
	index_val * cast(ast_exam_coef as double) index_val,
	a.tag_id,
	busi_mon 
from 
	(
    select 
		'grp00090000000000000001' as grp_id1,
		grp_id grp_id2,
		'tag074443204' as tag_id,
		sum(cast(std_equi as double)) as index_val, 
		busi_mon 
	from  
		(select recomder_erp_no,std_equi,bus_mon busi_mon from pdata_nds.file_gfqh_ib_cust_eval_dtl 
		where bus_mon between substr(default.date2datekey(ADD_MONTHS('${yyyy-MM}-01',-6)),1,6)  and '${yyyyMM}'
		and bus_mon >='${yyyy}01'
		)a 
		join 
		(SELECT grp_id,grp_val FROM dm_index_n.grp_def WHERE grp_type_code IN ('STAFF') and status ='1')b 
		on recomder_erp_no = b.grp_val
	group by grp_id,busi_mon
    )a 
    join 
    (select tag_id,cast(ast_exam_coef as double) ast_exam_coef  from pdata_nds.aum_asset_ast_style_cd where busi_year = '${yyyy}')b 
    on a.tag_id = b.tag_id 
)

SELECT grp1.grp_id AS grp_id1, grp2.grp_id AS grp_id2, index.index_val, from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') data_time, 'wxfuyangxun' modify_operator, '2999-12-31 00:00:00' modify_time, '1' status, 'ind2024072635488047' index_id, index.busi_mon busi_mon, tag_id FROM (

select 
    grp_id1,
    grp_id2,
    index_val,
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
    from temp_1 
    union all 
    select 
        grp_id1,
        grp_id2,
        index_val,
        tag_id,
        busi_mon 
    from temp_2 
    union all 
    select 
        grp_id1,
        grp_id2,
        index_val,
        tag_id,
        busi_mon 
    from temp_3
    )a
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
    	)b 
    	on a.grp_id = b.grp_id 

    	union all 
    	select grp_id,busi_date from dm_index_n.grp_tag_client_is_cust_judic_frz where busi_date in( '${yyyy,-1y}-12-31') and tag_id = 'tag074445064'
    	)t group by 1,2 
    )b 
    on a.grp_id1 = b.grp_id and substr(a.busi_mon,1,4) = b.busi_year
where b.grp_id is null
	) index JOIN (SELECT * FROM dm_index_n.grp_def WHERE status='1' AND grp_type_code IN ('CORP_CUST', 'CSTD_MOT_PRD', 'INDV_CUST', 'OFFLINE_CUST', 'OTC_COUNTERPARTY')) grp1 ON index.grp_id1 = grp1.grp_id JOIN (SELECT * FROM dm_index_n.grp_def WHERE status='1' AND grp_type_code IN ('STAFF', 'STAFF', 'STAFF', 'STAFF', 'STAFF')) grp2 ON index.grp_id2 = grp2.grp_id