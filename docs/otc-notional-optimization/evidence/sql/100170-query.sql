select
    Div_Org_Id,
    Div_Org_Name,
    cast(Intro_Inr_Org_Id as int) as Intro_Inr_Org_Id ,
    Intro_Inr_Org_Name,
    Cust_Mngr_Name,
    cust_mngr_emp_id,
    Cutp_Pty_Shor_Name,
    cast(dyna_nom_prin as decimal(25,4)) as dyna_nom_prin,
    cast(init_nom_prin as decimal(25,4)) as init_nom_prin,
    accrued_date as busi_date
from dm_otc_n.otc_cust_daily_dyna_nom_prin
where busi_date = '${yyyy-MM-dd}'