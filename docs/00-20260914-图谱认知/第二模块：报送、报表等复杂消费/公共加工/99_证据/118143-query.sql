SELECT  CAST( Agt_Id AS String ) Agt_Id ,
	 CAST( Busi_Type AS String ) Busi_Type ,
	 CAST( Cutp_Pty_Id AS String ) Cutp_Pty_Id ,
	 CAST( Cutp_Pty_Shor_Name AS String ) Cutp_Pty_Shor_Name ,
	 CAST( Cutp_Pty_Full_Name AS String ) Cutp_Pty_Full_Name ,
	 CAST( Sign_Prd_Name AS String ) Sign_Prd_Name ,
	 CAST( Contr_Type_Cd AS String ) Contr_Type_Cd ,
	 CAST( Contr_Type_Desc AS String ) Contr_Type_Desc ,
	 CAST( Undrl_Ins_Id AS String ) Undrl_Ins_Id ,
	 CAST( Undrl_Wd_Cd AS String ) Undrl_Wd_Cd ,
	 CAST( Undrl_Name AS String ) Undrl_Name ,
	 CAST( Undrl_Type AS String ) Undrl_Type ,
	 CAST( Src_Undrl_Type AS String ) Src_Undrl_Type ,
	 CAST( Annu_Sprd AS String ) Annu_Sprd ,
	 CAST( Absl_Sprd AS String ) Absl_Sprd ,
	 CAST( Sprd_Calc_Cd AS String ) Sprd_Calc_Cd ,
	 CAST( Sprd_Data AS String ) Sprd_Data ,
	 CAST( Base_Award_Rate AS String ) Base_Award_Rate ,
	 CAST( Base_Calc_Cd AS String ) Base_Calc_Cd ,
	 CAST( Strt_Pric_Date AS String ) Strt_Pric_Date ,
	 CAST( End_Pric_Date AS String ) End_Pric_Date ,
	 CAST( Earn_Pymt_Date AS String ) Earn_Pymt_Date ,
	 CAST( Agt_Stat_Cd AS String ) Agt_Stat_Cd ,
	 CAST( Main_Oper_User_Id AS String ) Main_Oper_User_Id ,
	 CAST( Main_Oper_Name AS String ) Main_Oper_Name ,
	 CAST( Main_Oper_Emp_Id AS String ) Main_Oper_Emp_Id ,
	 CAST( Intro_Oper_User_Id AS String ) Intro_Oper_User_Id ,
	 CAST( Intro_Oper_Name AS String ) Intro_Oper_Name ,
	 CAST( Intro_Oper_Emp_Id AS String ) Intro_Oper_Emp_Id ,
	 CAST( Intro_Inr_Org_Id_1 AS String ) Intro_Inr_Org_Id_1 ,
	 CAST( Intro_Inr_Org_Name_1 AS String ) Intro_Inr_Org_Name_1 ,
	 CAST( Cust_Mngr_User_Id_1 AS String ) Cust_Mngr_User_Id_1 ,
	 CAST( Cust_Mngr_Name_1 AS String ) Cust_Mngr_Name_1 ,
	 CAST( Cust_Mngr_Emp_Id_1 AS String ) Cust_Mngr_Emp_Id_1 ,
	 CAST( Allo_Prop_1 AS String ) Allo_Prop_1 ,
	 CAST( Intro_Inr_Org_Id_2 AS String ) Intro_Inr_Org_Id_2 ,
	 CAST( Intro_Inr_Org_Name_2 AS String ) Intro_Inr_Org_Name_2 ,
	 CAST( Cust_Mngr_User_Id_2 AS String ) Cust_Mngr_User_Id_2 ,
	 CAST( Cust_Mngr_Name_2 AS String ) Cust_Mngr_Name_2 ,
	 CAST( Cust_Mngr_Emp_Id_2 AS String ) Cust_Mngr_Emp_Id_2 ,
	 CAST( Allo_Prop_2 AS String ) Allo_Prop_2 ,
	 CAST( Intro_Inr_Org_Id_3 AS String ) Intro_Inr_Org_Id_3 ,
	 CAST( Intro_Inr_Org_Name_3 AS String ) Intro_Inr_Org_Name_3 ,
	 CAST( Cust_Mngr_User_Id_3 AS String ) Cust_Mngr_User_Id_3 ,
	 CAST( Cust_Mngr_Name_3 AS String ) Cust_Mngr_Name_3 ,
	 CAST( Cust_Mngr_Emp_Id_3 AS String ) Cust_Mngr_Emp_Id_3 ,
	 CAST( Allo_Prop_3 AS String ) Allo_Prop_3 ,
	 CAST( Upt_Prsn AS String ) Upt_Prsn ,
	 CAST( Upt_Time AS String ) Upt_Time ,
	 CAST( Data_Time AS String ) Data_Time ,
	 CAST( Sale_Type AS String ) Sale_Type ,
	 CAST( Src_Contr_Type AS String ) Src_Contr_Type ,
	 CAST( Src_Contr_Type_Desc AS String ) Src_Contr_Type_Desc ,
	 CAST( Src_Sub_Contr_Type AS String ) Src_Sub_Contr_Type ,
	 CAST( Src_Sub_Contr_Type_Desc AS String ) Src_Sub_Contr_Type_Desc ,
	 CAST( Init_Nom_Prin AS String ) Init_Nom_Prin ,
	 CAST( fee_rate AS String ) fee_rate ,
	 CAST( Fin_Rati AS String ) Fin_Rati ,
	Intr_Marg,
	Ex_Rate_Model,
	 CAST( busi_date AS String ) busi_date  FROM (
	 select
    info.Agt_Id,
    info.Busi_Type,
    info.Cutp_Pty_Id,
    info.Cutp_Pty_Shor_Name,
    info.Cutp_Pty_Full_Name,
    info.Sign_Prd_Name,
    info.Contr_Type_Cd,
    info.Contr_Type_Desc,
    '' as Undrl_Ins_Id,
    info.Undrl_Wd_Cd,
    info.Undrl_Name,
    info.Undrl_Type,
    info.Src_Undrl_Type,
    coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread) as Annu_Sprd,
    coalesce(s_sp.Absolute_Spread, c_sp.Absolute_Spread) as Absl_Sprd,
    coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation) as Sprd_Calc_Cd,
    coalesce(s_sp1.Spread_Data, concat('[','{\"Annu_Sprd\":\"',c_sp.Annualized_Spread,'\",\"Absl_Sprd\":\"',c_sp.Absolute_Spread,'\",\"Sprd_Calc\":\"',c_sp.Spread_Calculation,'\",\"Eff_Date\":\"',info.Strt_Pric_Date,'\"}',']')) as Sprd_Data,
    coalesce(s_ba.Base_Award_Rate, c_ba.Base_Award_Rate) as Base_Award_Rate,
    coalesce(s_ba.Base_Calculation, c_ba.Base_Calculation) as Base_Calc_Cd,
    info.Strt_Pric_Date,
    coalesce(info.Early_Term_Date, info.End_Pric_Date) as End_Pric_Date,
    info.Earn_Pymt_Date,
    info.Agt_Stat_Cd,
    m.Main_Oper_User_Id,
    m.Main_Oper_Name,
    m.Main_Oper_Emp_Id,
    m.Intro_Oper_User_Id,
    m.Intro_Oper_Name,
    m.Intro_Oper_Emp_Id,
    m.Inr_Org_Id_1 as Intro_Inr_Org_Id_1,
    m.Inr_Org_Name_1 as Intro_Inr_Org_Name_1,
    m.Cust_Mngr_User_Id_1,
    m.Cust_Mngr_Name_1,
    m.Cust_Mngr_Emp_Id_1,
    m.Allo_Prop_1,
    m.Inr_Org_Id_2 as Intro_Inr_Org_Id_2,
    m.Inr_Org_Name_2 as Intro_Inr_Org_Name_2,
    m.Cust_Mngr_User_Id_2,
    m.Cust_Mngr_Name_2,
    m.Cust_Mngr_Emp_Id_2,
    m.Allo_Prop_2,
    m.Inr_Org_Id_3 as Intro_Inr_Org_Id_3,
    m.Inr_Org_Name_3 as Intro_Inr_Org_Name_3,
    m.Cust_Mngr_User_Id_3,
    m.Cust_Mngr_Name_3,
    m.Cust_Mngr_Emp_Id_3,
    m.Allo_Prop_3,
    coalesce(s_sp.Updated_By, 'system') as Upt_Prsn,
    coalesce(s_sp.Updated_Datetime,'2022-10-28 08:00:00') as Upt_Time,
    from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') as Data_Time,
    'CROS' as Sale_Type,
    info.Src_Contr_Type,
    info.Src_Contr_Type_Desc,
    info.Src_Sub_Contr_Type,
    info.Src_Sub_Contr_Type_Desc,
    info.Init_Nom_Prin,
    if(info.Src_Contr_Type in ('AIRBAGX','AIRBAGM','AIRBAGL'), fee_rate, null) as fee_rate,
    if(info.Src_Contr_Type in ('AIRBAGX','AIRBAGM','AIRBAGL'), 1 - Init_Marg_Prop, null) as Fin_Rati,
    info.Intr_Marg,
    if(info.Ex_Rate_Model in ('SHENZHEN_HONGKONG_STOCK_CONNECT','SHANGHAI_HONGKONG_STOCK_CONNECT'),info.Ex_Rate_Model,null) as Ex_Rate_Model,
    '${yyyy-MM-dd}' as busi_date
from (
    select *
    from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
    where busi_date = '${yyyy-MM-dd}' and Src_Contr_Type != 'FEE_SWAP'
        and coalesce(Early_Term_Date, End_Pric_Date) > '2021-09-30'
        and grp_id != '04' and Book_Bel_Dept != 'OTC_HK'  --极速合约暂不计算，香港合约单独计算
    ) info
left join (
    select *
    from (
        select
            Inr_Comp_No as Contract_Code,
            Sprd_Calc_Type as Spread_Calculation,
            Annu_Sprd_Coef as Annualized_Spread,
            Absl_Sprd_Coef as Absolute_Spread,
            Upd_Prsn as Updated_By,
            Upd_Time as Updated_Datetime,
            row_number() over(partition by Inr_Comp_No order by Vld_Date desc) as rn
        from PDATA_N.T99_DERI_COMP_SPRD_COEF_REF
        where src_tbl = 'ODATA_N_OIS.O_CONTRACT_SPREAD_RATE' and Del_Flag = '0' and coalesce(Coef_Type, '') != 'INR' and Agt_Id != ''
        ) t
    where t.rn = 1
    ) s_sp
on s_sp.CONTRACT_CODE = info.Agt_Id
left join (
    select
        Contract_Code,
        concat('[',concat_ws(',',collect_list(data)),']') as spread_data 
    from (
        select 
            Inr_Comp_No as Contract_Code, Vld_Date as Effective_Date,
            concat('{\"Annu_Sprd\":\"',Annu_Sprd_Coef,'\",\"Absl_Sprd\":\"',Absl_Sprd_Coef,'\",\"Sprd_Calc\":\"',Sprd_Calc_Type,'\",\"Eff_Date\":\"',substring(Vld_Date,1,10),'\"}') as data 
        from PDATA_N.T99_DERI_COMP_SPRD_COEF_REF
        where src_tbl = 'ODATA_N_OIS.O_CONTRACT_SPREAD_RATE' and Del_Flag = '0' and coalesce(Coef_Type, '') != 'INR' and Agt_Id != ''
        order by Inr_Comp_No, Vld_Date desc
        ) a
    group by Contract_Code
    ) s_sp1
on s_sp1.CONTRACT_CODE = info.Agt_Id
left join (
    select
        CLIENT_ID,
        CONTRACT_TYPE,
        Spread_Calculation,
        Annualized_Spread,
        Absolute_Spread,
        date_add(strt_date, pos) as busi_date
    from (
        select
            Pty_Id as CLIENT_ID,
            Src_Comp_Type_Cd as CONTRACT_TYPE,
            coalesce(Calc_Type, '') as Spread_Calculation,
            Annu_Sprd_Coef as Annualized_Spread,
            Absl_Sprd_Coef as Absolute_Spread,
            if(Bgng_Prcg_Date_Llmt = '1900-01-01','2019-01-01',Bgng_Prcg_Date_Llmt) as strt_date,
            if(Bgng_Prcg_Date_Ulmt = '2999-12-31','${yyyy-MM-dd}',Bgng_Prcg_Date_Ulmt) as end_Date
        from PDATA_N.T99_DERI_CUTP_COMP_TYPE_SPRD_COEF_REF
        where src_tbl = 'ODATA_N_OIS.O_CTPTY_CROSS_SELL_COEFFICIENT' and Del_Flag = '0'
        ) x
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
    ) c_sp
on c_sp.CLIENT_ID = info.Cutp_Pty_Id and c_sp.CONTRACT_TYPE = info.Contr_Type_Cd and c_sp.busi_date = info.Strt_Pric_Date
left join (
    select
        Inr_Comp_No as Contract_Code,
        Calc_Type as BASE_CALCULATION,
        Base_Yield as BASE_AWARD_RATE
    from PDATA_N.T99_DERI_COMP_BASE_COEF_REF
    where src_tbl = 'ODATA_N_OIS.O_CONTRACT_BASE_RATE' and Del_Flag = '0' and Agt_Id != ''
    ) s_ba
on s_ba.CONTRACT_CODE = info.Agt_Id
left join (
    select
        CONTRACT_TYPE,
        CONTRACT_TYPE_NAME,
        BASE_CALCULATION,
        BASE_AWARD_RATE,
        date_add(strt_date, pos) as busi_date
    from (
        select
            Src_Comp_Type_Cd as CONTRACT_TYPE,
            Src_Comp_Type_Desc as CONTRACT_TYPE_NAME,
            Calc_Type as BASE_CALCULATION,
            Base_Yield as BASE_AWARD_RATE,
            if(Bgng_Prcg_Date_Llmt = '1900-01-01','2019-01-01',Bgng_Prcg_Date_Llmt) as strt_date,
            if(Bgng_Prcg_Date_Ulmt = '2999-12-31','${yyyy-MM-dd}',Bgng_Prcg_Date_Ulmt) as end_Date
        from PDATA_N.T99_DERI_COMP_TYPE_BASE_COEF_REF
        where src_tbl = 'ODATA_N_OIS.O_BUS_TYPE_BASE_RATE' and Del_Flag = '0' and Src_Dept_No = 'OTC'
        ) x
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
    ) c_ba
on c_ba.CONTRACT_TYPE = info.Contr_Type_Cd and c_ba.busi_date = info.Strt_Pric_Date
left join (
    select * from PDATA_N.T98_OTC_COMP_MNG_RELA_INFO
    where busi_Date = '${yyyy-MM-dd}'
    ) m
on m.Agt_Id = info.Agt_Id
where (coalesce(if(m.Inr_Org_Id_1 = '', '8846', m.Inr_Org_Id_1), '8846') != '8846' or coalesce(if(m.Inr_Org_Id_2 = '', '8846', m.Inr_Org_Id_2), '8846') != '8846' or coalesce(if(m.Inr_Org_Id_3 = '', '8846', m.Inr_Org_Id_3), '8846') != '8846'
        or info.agt_id in ('OPT-OTC20220163','OPT-OTC20220128','OPT-OTC20220148','OPT-OTC20220162','OPT-OTC20220153','OPT-OTC20220089-1','OPT-OTC20220155','OPT-OTC20220126','OPT-OTC20220147','OPT-OTC20220129'))
    and m.Inr_Org_Id_1 is not null 
	) castTable