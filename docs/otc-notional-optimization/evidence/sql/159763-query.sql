with dy as (
    select
        a.Cutp_Pty_Id,
        b.dyna_nom_prin,
        c.inr_org_id_1,
        c.cust_mngr_emp_id_1,
        c.allo_prop_1,
        c.inr_org_id_2,
        c.cust_mngr_emp_id_2,
        c.allo_prop_2,
        c.inr_org_id_3,
        c.cust_mngr_emp_id_3,
        c.allo_prop_3,
        case when a.Book_Bel_Dept = 'OTC' and a.Src_Undrl_Type = 'FUTURE'
                and ins.crrc_cd != '156' and a.Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'tag074443704'
             when (a.Cutp_Pty_Id like 'HK%' or a.Cutp_Pty_Full_Name = '廣發全球資本有限公司') and a.Src_Undrl_Type = 'FUTURE'
                and ins.crrc_cd = '156' and a.Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'tag074443704'
             else 'tag074443705' end as tag_id
    from (
        select * from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
        where busi_Date = '${yyyy-MM-dd}' and Src_Contr_Type != 'FEE_SWAP' and grp_id in ('01','02','03')
        ) a
    inner join (
        select *
        from PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET
        where busi_Date between concat(substr('${yyyy-MM-dd}',1,8),'01') and '${yyyy-MM-dd}' and busi_Date between Strt_Pric_Date and End_Pric_Date
        ) b
    on a.agt_id = b.agt_id
    left join (
        select * from pdata_n.T98_OTC_COMP_MNG_RELA_INFO
        where busi_Date = '${yyyy-MM-dd}'
        ) c
    on c.Agt_Id = a.Agt_Id
    left join (
        select * from pdata_news_n.t02_tit_scr_base_info
        where src_id = 'TIT' and grp_id = '01'
        ) ins
    on ins.in_code = a.Undrl_Ins_Id
    where (coalesce(if(Inr_Org_Id_1 in ('','8846','8037','8022') or Inr_Org_Id_1 is null, '8846', Inr_Org_Id_1), '8846') != '8846'
        or coalesce(if(Inr_Org_Id_2 in ('','8846','8037','8022') or Inr_Org_Id_2 is null, '8846', Inr_Org_Id_2), '8846') != '8846'
        or coalesce(if(Inr_Org_Id_3 in ('','8846','8037','8022') or Inr_Org_Id_3 is null, '8846', Inr_Org_Id_3), '8846') != '8846'
        or a.agt_id in ('OPT-OTC20220163','OPT-OTC20220128','OPT-OTC20220148','OPT-OTC20220162','OPT-OTC20220153','OPT-OTC20220089-1','OPT-OTC20220155','OPT-OTC20220147','OPT-OTC20220129'))
        and (if(cust_mngr_user_id_1 = '', 'kenanfan', cust_mngr_user_id_1) != 'kenanfan' or if(cust_mngr_user_id_2 = '', 'kenanfan', cust_mngr_user_id_2) != 'kenanfan' or if(cust_mngr_user_id_3 = '', 'kenanfan', cust_mngr_user_id_3) != 'kenanfan')
    )

SELECT grp1.grp_id AS grp_id1, grp2.grp_id AS grp_id2, grp3.grp_id AS grp_id3, index.index_val, from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss'), 'wxgaoh' modify_operator, '2999-12-31 00:00:00' modify_time, '1' status, 'ind2024061838275461' index_id, index.busi_mon busi_mon, tag_id FROM (
select
    x.Cutp_Pty_Id as grp_val1,
    'OTC_COUNTERPARTY' as grp_type_code1,
    x.inr_org_id as grp_val2,
    y.grp_type_code as grp_type_code2,
    x.cust_mngr_emp_id as grp_val3,
    'STAFF' as grp_type_code3,
    x.index_val,
    x.tag_id,
    '${yyyyMM}' as busi_mon
from ( 
    select
        Cutp_Pty_Id,
        inr_org_id,
        cust_mngr_emp_id,
        tag_id,
        sum(cast(dyna_nom_prin as double))/(datediff('${yyyy-MM-dd}',concat('${yyyy-MM}','-01')) + 1) as index_val
    from (
        select
            Cutp_Pty_Id,
            if(cast(inr_org_id_1 as int) < 8000, inr_org_id_1, if(cast(inr_org_id_2 as int) < 8000, inr_org_id_2, inr_org_id_3)) as inr_org_id,
            if(cast(inr_org_id_1 as int) < 8000, cust_mngr_emp_id_1, if(cast(inr_org_id_2 as int) < 8000, cust_mngr_emp_id_2, cust_mngr_emp_id_3)) as cust_mngr_emp_id,
            tag_id,
            coalesce(dyna_nom_prin, 0) * allo_prop_1 as dyna_nom_prin
        from dy
        where (cast(case when coalesce(inr_org_id_1,'') = '' then '8846' else inr_org_id_1 end as int) < 8000
            or cast(case when coalesce(inr_org_id_2,'') = '' then '8846' else inr_org_id_2 end as int) < 8000
            or cast(case when coalesce(inr_org_id_3,'') = '' then '8846' else inr_org_id_3 end as int) < 8000)
        union all
        select
            Cutp_Pty_Id,
            if(cast(inr_org_id_2 as int) < 8000, inr_org_id_2, if(cast(inr_org_id_3 as int) < 8000, inr_org_id_3, inr_org_id_1)) as inr_org_id,
            if(cast(inr_org_id_2 as int) < 8000, cust_mngr_emp_id_2, if(cast(inr_org_id_3 as int) < 8000, cust_mngr_emp_id_3, cust_mngr_emp_id_1)) as cust_mngr_emp_id,
            tag_id,
            coalesce(dyna_nom_prin, 0) * allo_prop_2 as dyna_nom_prin
        from dy
        where (cast(case when coalesce(inr_org_id_1,'') = '' then '8846' else inr_org_id_1 end as int) < 8000
            or cast(case when coalesce(inr_org_id_2,'') = '' then '8846' else inr_org_id_2 end as int) < 8000
            or cast(case when coalesce(inr_org_id_3,'') = '' then '8846' else inr_org_id_3 end as int) < 8000)
            and cast(allo_prop_2 as double) != 0
        union all
        select
            Cutp_Pty_Id,
            if(cast(inr_org_id_3 as int) < 8000, inr_org_id_3, if(cast(inr_org_id_2 as int) < 8000, inr_org_id_2, inr_org_id_1)) as inr_org_id,
            if(cast(inr_org_id_3 as int) < 8000, cust_mngr_emp_id_3, if(cast(inr_org_id_2 as int) < 8000, cust_mngr_emp_id_2, cust_mngr_emp_id_1)) as cust_mngr_emp_id,
            tag_id,
            coalesce(dyna_nom_prin, 0) * allo_prop_3 as dyna_nom_prin
        from dy
        where (cast(case when coalesce(inr_org_id_1,'') = '' then '8846' else inr_org_id_1 end as int) < 8000
            or cast(case when coalesce(inr_org_id_2,'') = '' then '8846' else inr_org_id_2 end as int) < 8000
            or cast(case when coalesce(inr_org_id_3,'') = '' then '8846' else inr_org_id_3 end as int) < 8000)
            and cast(allo_prop_3 as double) != 0
        union all
        select
            Cutp_Pty_Id,
            inr_org_id_1 as inr_org_id,
            cust_mngr_emp_id_1 as cust_mngr_emp_id,
            tag_id,
            coalesce(dyna_nom_prin, 0) * allo_prop_1 as Dyna_Nom_Prin
        from dy
        where (case when coalesce(inr_org_id_1,'') in ('','8848','8828','8822') then '8848' else inr_org_id_1 end = '8848'
           and case when coalesce(inr_org_id_2,'') in ('','8848','8828','8822') then '8848' else inr_org_id_2 end = '8848'
           and case when coalesce(inr_org_id_3,'') in ('','8848','8828','8822') then '8848' else inr_org_id_3 end = '8848')
        union all
        select
            Cutp_Pty_Id,
            inr_org_id_2 as inr_org_id,
            cust_mngr_emp_id_2 as cust_mngr_emp_id,
            tag_id,
            coalesce(dyna_nom_prin, 0) * allo_prop_2 as Dyna_Nom_Prin
        from dy
        where (case when coalesce(inr_org_id_1,'') in ('','8848','8828','8822') then '8848' else inr_org_id_1 end = '8848'
           and case when coalesce(inr_org_id_2,'') in ('','8848','8828','8822') then '8848' else inr_org_id_2 end = '8848'
           and case when coalesce(inr_org_id_3,'') in ('','8848','8828','8822') then '8848' else inr_org_id_3 end = '8848')
           and coalesce(allo_prop_2,0) != 0
        union all
        select
            Cutp_Pty_Id,
            inr_org_id_3 as inr_org_id,
            cust_mngr_emp_id_3 as cust_mngr_emp_id,
            tag_id,
            coalesce(dyna_nom_prin, 0) * allo_prop_3 as Dyna_Nom_Prin
        from dy
        where (case when coalesce(inr_org_id_1,'') in ('','8848','8828','8822') then '8848' else inr_org_id_1 end = '8848'
           and case when coalesce(inr_org_id_2,'') in ('','8848','8828','8822') then '8848' else inr_org_id_2 end = '8848'
           and case when coalesce(inr_org_id_3,'') in ('','8848','8828','8822') then '8848' else inr_org_id_3 end = '8848')
           and coalesce(allo_prop_3,0) != 0
        ) t
    group by Cutp_Pty_Id, inr_org_id, cust_mngr_emp_id, tag_id
    having index_val <> 0
    ) x
left join (
    select *
    from dm_index_n.grp_def 
    where grp_type_code in ('BUSINESSOFFICE','BRANCH_HEADQUARTERS')
    ) y
on x.inr_org_id = y.grp_val
	) index JOIN (SELECT * FROM dm_index_n.grp_def WHERE status='1' AND grp_type_code IN ('OTC_COUNTERPARTY', 'OTC_COUNTERPARTY')) grp1 ON index.grp_type_code1 = (CASE WHEN grp1.grp_type_code IN ('INDV_CUST','CORP_CUST') THEN 'CLIENT' ELSE grp1.grp_type_code END) AND index.grp_val1 = grp1.grp_val JOIN (SELECT * FROM dm_index_n.grp_def WHERE grp_type_code IN ('BRANCH_HEADQUARTERS', 'BUSINESSOFFICE')) grp2 ON index.grp_type_code2 = (CASE WHEN grp2.grp_type_code IN ('INDV_CUST','CORP_CUST') THEN 'CLIENT' ELSE grp2.grp_type_code END) AND index.grp_val2 = grp2.grp_val JOIN (SELECT * FROM dm_index_n.grp_def WHERE status='1' AND grp_type_code IN ('STAFF', 'STAFF')) grp3 ON index.grp_type_code3 = (CASE WHEN grp3.grp_type_code IN ('INDV_CUST','CORP_CUST') THEN 'CLIENT' ELSE grp3.grp_type_code END) AND index.grp_val3 = grp3.grp_val