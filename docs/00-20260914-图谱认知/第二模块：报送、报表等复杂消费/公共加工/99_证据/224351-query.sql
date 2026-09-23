with rpt as(
    select
        m.Div_Org_Id_1,m.Div_Org_Id_2,m.Div_Org_Id_3,
        m.Div_Org_Name_1,m.Div_Org_Name_2,m.Div_Org_Name_3,
        m.Inr_Org_Id_1 as Intro_Inr_Org_Id_1,
        m.Inr_Org_Id_2 as Intro_Inr_Org_Id_2,
        m.Inr_Org_Id_3 as Intro_Inr_Org_Id_3,
        m.Inr_Org_Name_1 as Intro_Inr_Org_Name_1,
        m.Inr_Org_Name_2 as Intro_Inr_Org_Name_2,
        m.Inr_Org_Name_3 as Intro_Inr_Org_Name_3,
        m.Cust_Mngr_Name_1,m.Cust_Mngr_Name_2,m.Cust_Mngr_Name_3,
        m.cust_mngr_emp_id_1,m.cust_mngr_emp_id_2,m.cust_mngr_emp_id_3,
        m.cust_mngr_user_id_1,m.cust_mngr_user_id_2,m.cust_mngr_user_id_3,
        m.allo_prop_1,m.allo_prop_2,m.allo_prop_3,
        info.Cutp_Pty_Shor_Name,
        info.Strt_Pric_Date,
        info.End_Pric_Date,
        det.dyna_nom_prin,
        info.init_nom_prin,
        det.busi_date as accrued_date
    from (
        select * from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
        where busi_date = '${yyyy-MM-dd}' and src_contr_type not in ('DIGITAL','FEE_SWAP') and Book_Bel_Dept in ('OTC_HK','OTC')
        ) info
    inner join PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET det
    on info.agt_id = det.agt_id
    left join (
        select * from PDATA_N.T98_OTC_COMP_MNG_RELA_INFO
        where busi_Date = '${yyyy-MM-dd}'
        ) m
    on m.Agt_Id = info.Agt_Id
    where coalesce(if(m.Inr_Org_Id_1 = '', '8846', m.Inr_Org_Id_1), '8846') != '8846' or coalesce(if(m.Inr_Org_Id_2 = '', '8846', m.Inr_Org_Id_2), '8846') != '8846' or coalesce(if(m.Inr_Org_Id_3 = '', '8846', m.Inr_Org_Id_3), '8846') != '8846'
        or info.agt_id in ('OPT-OTC20220163','OPT-OTC20220128','OPT-OTC20220148','OPT-OTC20220162','OPT-OTC20220153','OPT-OTC20220089-1','OPT-OTC20220155','OPT-OTC20220126','OPT-OTC20220147','OPT-OTC20220129')
    )

SELECT Div_Org_Id,
	Div_Org_Name,
	Intro_Inr_Org_Id,
	Intro_Inr_Org_Name,
	Cust_Mngr_Name,
	cust_mngr_emp_id,
	Cutp_Pty_Shor_Name,
	dyna_nom_prin,
	init_nom_prin,
	accrued_date,
	busi_date FROM (
	 
select
    Div_Org_Id,
    Div_Org_Name,
    Intro_Inr_Org_Id,
    Intro_Inr_Org_Name,
    Cust_Mngr_Name,
    cust_mngr_emp_id,
    Cutp_Pty_Shor_Name,
    sum(coalesce(dyna_nom_prin,0)) as dyna_nom_prin,
    sum(coalesce(init_nom_prin,0)) as init_nom_prin,
    accrued_date,
    '${yyyy-MM-dd}' as busi_date
from (
    select
        if(cast(intro_inr_org_id_1 as int) < 8000, Div_Org_Id_1, if(cast(intro_inr_org_id_2 as int) < 8000, Div_Org_Id_2, Div_Org_Id_3)) as Div_Org_Id,
        if(cast(intro_inr_org_id_1 as int) < 8000, Div_Org_Name_1, if(cast(intro_inr_org_id_2 as int) < 8000, Div_Org_Name_2, Div_Org_Name_3)) as Div_Org_Name,
        if(cast(intro_inr_org_id_1 as int) < 8000, Intro_Inr_Org_Id_1, if(cast(intro_inr_org_id_2 as int) < 8000, Intro_Inr_Org_Id_2, Intro_Inr_Org_Id_3)) as Intro_Inr_Org_Id,
        if(cast(intro_inr_org_id_1 as int) < 8000, Intro_Inr_Org_Name_1, if(cast(intro_inr_org_id_2 as int) < 8000, Intro_Inr_Org_Name_2, Intro_Inr_Org_Name_3)) as Intro_Inr_Org_Name,
        if(cast(intro_inr_org_id_1 as int) < 8000, Cust_Mngr_Name_1, if(cast(intro_inr_org_id_2 as int) < 8000, Cust_Mngr_Name_2, Cust_Mngr_Name_3)) as Cust_Mngr_Name,
        if(cast(intro_inr_org_id_1 as int) < 8000, cust_mngr_emp_id_1, if(cast(intro_inr_org_id_2 as int) < 8000, cust_mngr_emp_id_2, cust_mngr_emp_id_3)) as cust_mngr_emp_id,
        Cutp_Pty_Shor_Name,
        if(accrued_date between Strt_Pric_Date and End_Pric_Date, coalesce(dyna_nom_prin,'0'), '0') * allo_prop_1 as dyna_nom_prin,
        if(accrued_date = Strt_Pric_Date, coalesce(init_nom_prin,'0'), '0') * allo_prop_1 as init_nom_prin,
        accrued_date
    from rpt
    where (cast(if(intro_inr_org_id_1 = '' or Intro_Inr_Org_Id_1 is null, '8846', intro_inr_org_id_1) as int) < 8000
            or cast(if(intro_inr_org_id_2 = '' or Intro_Inr_Org_Id_2 is null, '8846', intro_inr_org_id_2) as int) < 8000
            or cast(if(intro_inr_org_id_3 = '' or Intro_Inr_Org_Id_3 is null, '8846', intro_inr_org_id_3) as int) < 8000)
    union all
    select
        if(cast(intro_inr_org_id_2 as int) < 8000, Div_Org_Id_2, if(cast(intro_inr_org_id_3 as int) < 8000, Div_Org_Id_3, Div_Org_Id_1)) as Div_Org_Id,
        if(cast(intro_inr_org_id_2 as int) < 8000, Div_Org_Name_2, if(cast(intro_inr_org_id_3 as int) < 8000, Div_Org_Name_3, Div_Org_Name_1)) as Div_Org_Name,
        if(cast(intro_inr_org_id_2 as int) < 8000, Intro_Inr_Org_Id_2, if(cast(intro_inr_org_id_3 as int) < 8000, Intro_Inr_Org_Id_3, Intro_Inr_Org_Id_1)) as Intro_Inr_Org_Id,
        if(cast(intro_inr_org_id_2 as int) < 8000, Intro_Inr_Org_Name_2, if(cast(intro_inr_org_id_3 as int) < 8000, Intro_Inr_Org_Name_3, Intro_Inr_Org_Name_1)) as Intro_Inr_Org_Name,
        if(cast(intro_inr_org_id_2 as int) < 8000, Cust_Mngr_Name_2, if(cast(intro_inr_org_id_3 as int) < 8000, Cust_Mngr_Name_3, Cust_Mngr_Name_1)) as Cust_Mngr_Name,
        if(cast(intro_inr_org_id_2 as int) < 8000, cust_mngr_emp_id_2, if(cast(intro_inr_org_id_3 as int) < 8000, cust_mngr_emp_id_3, cust_mngr_emp_id_1)) as cust_mngr_emp_id,
        Cutp_Pty_Shor_Name,
        if(accrued_date between Strt_Pric_Date and End_Pric_Date, coalesce(dyna_nom_prin,'0'), '0') * allo_prop_2 as dyna_nom_prin,
        if(accrued_date = Strt_Pric_Date, coalesce(init_nom_prin,'0'), '0') * allo_prop_2 as init_nom_prin,
        accrued_date
    from rpt
    where (cast(if(intro_inr_org_id_1 = '' or Intro_Inr_Org_Id_1 is null, '8846', intro_inr_org_id_1) as int) < 8000
            or cast(if(intro_inr_org_id_2 = '' or Intro_Inr_Org_Id_2 is null, '8846', intro_inr_org_id_2) as int) < 8000
            or cast(if(intro_inr_org_id_3 = '' or Intro_Inr_Org_Id_3 is null, '8846', intro_inr_org_id_3) as int) < 8000)
        and cast(allo_prop_2 as double) != 0
    union all
    select
        if(cast(intro_inr_org_id_3 as int) < 8000, Div_Org_Id_3, if(cast(intro_inr_org_id_2 as int) < 8000, Div_Org_Id_2, Div_Org_Id_1)) as Div_Org_Id,
        if(cast(intro_inr_org_id_3 as int) < 8000, Div_Org_Name_3, if(cast(intro_inr_org_id_2 as int) < 8000, Div_Org_Name_2, Div_Org_Name_1)) as Div_Org_Name,
        if(cast(intro_inr_org_id_3 as int) < 8000, Intro_Inr_Org_Id_3, if(cast(intro_inr_org_id_2 as int) < 8000, Intro_Inr_Org_Id_2, Intro_Inr_Org_Id_1)) as Intro_Inr_Org_Id,
        if(cast(intro_inr_org_id_3 as int) < 8000, Intro_Inr_Org_Name_3, if(cast(intro_inr_org_id_2 as int) < 8000, Intro_Inr_Org_Name_2, Intro_Inr_Org_Name_1)) as Intro_Inr_Org_Name,
        if(cast(intro_inr_org_id_3 as int) < 8000, Cust_Mngr_Name_3, if(cast(intro_inr_org_id_2 as int) < 8000, Cust_Mngr_Name_2, Cust_Mngr_Name_1)) as Cust_Mngr_Name,
        if(cast(intro_inr_org_id_3 as int) < 8000, cust_mngr_emp_id_3, if(cast(intro_inr_org_id_2 as int) < 8000, cust_mngr_emp_id_2, cust_mngr_emp_id_1)) as cust_mngr_emp_id,
        Cutp_Pty_Shor_Name,
        if(accrued_date between Strt_Pric_Date and End_Pric_Date, coalesce(dyna_nom_prin,'0'), '0') * allo_prop_3 as dyna_nom_prin,
        if(accrued_date = Strt_Pric_Date, coalesce(init_nom_prin,'0'), '0') * allo_prop_3 as init_nom_prin,
        accrued_date
    from rpt
    where (cast(if(intro_inr_org_id_1 = '' or Intro_Inr_Org_Id_1 is null, '8846', intro_inr_org_id_1) as int) < 8000
            or cast(if(intro_inr_org_id_2 = '' or Intro_Inr_Org_Id_2 is null, '8846', intro_inr_org_id_2) as int) < 8000
            or cast(if(intro_inr_org_id_3 = '' or Intro_Inr_Org_Id_3 is null, '8846', intro_inr_org_id_3) as int) < 8000)
        and cast(allo_prop_3 as double) != 0
    union all
    select
        Div_Org_Id_1 as Div_Org_Id,
        Div_Org_Name_1 as Div_Org_Name,
        Intro_Inr_Org_Id_1 as Intro_Inr_Org_Id,
        Intro_Inr_Org_Name_1 as Intro_Inr_Org_Name,
        Cust_Mngr_Name_1 as Cust_Mngr_Name,
        cust_mngr_emp_id_1 as cust_mngr_emp_id,
        Cutp_Pty_Shor_Name,
        if(accrued_date between Strt_Pric_Date and End_Pric_Date, coalesce(dyna_nom_prin,'0'), '0') * allo_prop_1 as dyna_nom_prin,
        if(accrued_date = Strt_Pric_Date, coalesce(init_nom_prin,'0'), '0') * allo_prop_1 as init_nom_prin,
        accrued_date
    from rpt
    where (if(Intro_Inr_Org_Id_1 in ('','8848','8828','8822') or Intro_Inr_Org_Id_1 is null, '8828', Intro_Inr_Org_Id_1) = '8828'
            and if(Intro_Inr_Org_Id_2 in ('','8848','8828','8822') or Intro_Inr_Org_Id_2 is null, '8828', Intro_Inr_Org_Id_2) = '8828'
            and if(Intro_Inr_Org_Id_3 in ('','8848','8828','8822') or Intro_Inr_Org_Id_3 is null, '8828', Intro_Inr_Org_Id_3) = '8828')
        and (if(cust_mngr_user_id_1 = '', 'kenanfan', cust_mngr_user_id_1) != 'kenanfan' or if(cust_mngr_user_id_2 = '', 'kenanfan', cust_mngr_user_id_2) != 'kenanfan' or if(cust_mngr_user_id_3 = '', 'kenanfan', cust_mngr_user_id_3) != 'kenanfan')
    union all
    select
        Div_Org_Id_2 as Div_Org_Id,
        Div_Org_Name_2 as Div_Org_Name,
        Intro_Inr_Org_Id_2 as Intro_Inr_Org_Id,
        Intro_Inr_Org_Name_2 as Intro_Inr_Org_Name,
        Cust_Mngr_Name_2 as Cust_Mngr_Name,
        cust_mngr_emp_id_2 as cust_mngr_emp_id,
        Cutp_Pty_Shor_Name,
        if(accrued_date between Strt_Pric_Date and End_Pric_Date, coalesce(dyna_nom_prin,'0'), '0') * allo_prop_2 as dyna_nom_prin,
        if(accrued_date = Strt_Pric_Date, coalesce(init_nom_prin,'0'), '0') * allo_prop_2 as init_nom_prin,
        accrued_date
    from rpt
    where (if(Intro_Inr_Org_Id_1 in ('','8848','8828','8822') or Intro_Inr_Org_Id_1 is null, '8828', Intro_Inr_Org_Id_1) = '8828'
            and if(Intro_Inr_Org_Id_2 in ('','8848','8828','8822') or Intro_Inr_Org_Id_2 is null, '8828', Intro_Inr_Org_Id_2) = '8828'
            and if(Intro_Inr_Org_Id_3 in ('','8848','8828','8822') or Intro_Inr_Org_Id_3 is null, '8828', Intro_Inr_Org_Id_3) = '8828')
        and (if(cust_mngr_user_id_1 = '', 'kenanfan', cust_mngr_user_id_1) != 'kenanfan' or if(cust_mngr_user_id_2 = '', 'kenanfan', cust_mngr_user_id_2) != 'kenanfan' or if(cust_mngr_user_id_3 = '', 'kenanfan', cust_mngr_user_id_3) != 'kenanfan')
        and cast(allo_prop_2 as double) != 0
    union all
    select
        Div_Org_Id_3 as Div_Org_Id,
        Div_Org_Name_3 as Div_Org_Name,
        Intro_Inr_Org_Id_3 as Intro_Inr_Org_Id,
        Intro_Inr_Org_Name_3 as Intro_Inr_Org_Name,
        Cust_Mngr_Name_3 as Cust_Mngr_Name,
        cust_mngr_emp_id_3 as cust_mngr_emp_id,
        Cutp_Pty_Shor_Name,
        if(accrued_date between Strt_Pric_Date and End_Pric_Date, coalesce(dyna_nom_prin,'0'), '0') * allo_prop_3 as dyna_nom_prin,
        if(accrued_date = Strt_Pric_Date, coalesce(init_nom_prin,'0'), '0') * allo_prop_3 as init_nom_prin,
        accrued_date
    from rpt
    where (if(Intro_Inr_Org_Id_1 in ('','8848','8828','8822') or Intro_Inr_Org_Id_1 is null, '8828', Intro_Inr_Org_Id_1) = '8828'
            and if(Intro_Inr_Org_Id_2 in ('','8848','8828','8822') or Intro_Inr_Org_Id_2 is null, '8828', Intro_Inr_Org_Id_2) = '8828'
            and if(Intro_Inr_Org_Id_3 in ('','8848','8828','8822') or Intro_Inr_Org_Id_3 is null, '8828', Intro_Inr_Org_Id_3) = '8828')
        and (if(cust_mngr_user_id_1 = '', 'kenanfan', cust_mngr_user_id_1) != 'kenanfan' or if(cust_mngr_user_id_2 = '', 'kenanfan', cust_mngr_user_id_2) != 'kenanfan' or if(cust_mngr_user_id_3 = '', 'kenanfan', cust_mngr_user_id_3) != 'kenanfan')
        and cast(allo_prop_3 as double) != 0    
    ) t
where cust_mngr_emp_id != ''
group by Div_Org_Id, Div_Org_Name, Intro_Inr_Org_Id, Intro_Inr_Org_Name, Cust_Mngr_Name, cust_mngr_emp_id, Cutp_Pty_Shor_Name, accrued_date
having dyna_nom_prin <> 0 or init_nom_prin <> 0 
	) castTable