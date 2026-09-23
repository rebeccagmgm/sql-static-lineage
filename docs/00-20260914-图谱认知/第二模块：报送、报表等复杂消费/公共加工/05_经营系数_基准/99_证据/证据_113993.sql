with contr_info as (
    select
        Agt_Id,
        Busi_Type,
        Cutp_Pty_Id,
        Cutp_Pty_Shor_Name,
        Cutp_Pty_Full_Name,
        Sign_Prd_Name,
        Src_Contr_Type,
        Src_Contr_Type_Desc,
        Src_Sub_Contr_Type,
        Src_Sub_Contr_Type_Desc,
        Rel_Agt_Id,
        Indt_Cd,
        Hedg_Type_Cd,
        fee_rate,
        Init_Marg_Prop,
        Undrl_Wd_Cd,
        Undrl_Name,
        Undrl_Curr,
        case when Src_Contr_Type = 'B_LONG_SHORT_SWAP' then ''
             when (Src_Undrl_Type in ('EQUITY', 'BASKET') and Res_Flag = '1') or Src_Undrl_Type = 'GDR' then 'PRI_STOCK'
             when Src_Undrl_Type in ('EQUITY', 'BASKET') and Res_Flag = '0' then 'CIR_STOCK'
             when Src_Undrl_Type = 'BOND' then 'BOND'
             when Src_Undrl_Type = 'FUTURE' then 'FUTURE'
             when Src_Undrl_Type = 'INDEX' then 'INDEX'
             when Src_Undrl_Type = 'QIS' then 'QIS'
             when Src_Undrl_Type in ('FUND','HEDGE_FUND') then 'FUND'
             else 'OTHER'
             end as Undrl_Type,
        case when Src_Contr_Type = 'B_LONG_SHORT_SWAP' then ''
             when (Src_Undrl_Type in ('EQUITY', 'BASKET') and Res_Flag = '1') or Src_Undrl_Type = 'GDR' then '限售股'
             when Src_Undrl_Type in ('EQUITY', 'BASKET') and Res_Flag = '0' then '流通股'
             when Src_Undrl_Type = 'BOND' then '债券'
             when Src_Undrl_Type = 'FUTURE' then '期货'
             when Src_Undrl_Type = 'INDEX' then '股指'
             when Src_Undrl_Type = 'QIS' then '策略指数'
             when Src_Undrl_Type in ('FUND','HEDGE_FUND') then '基金'
             else '其他'
             end as Undrl_Type_Desc,
        Src_Undrl_Type,
        Src_Undrl_Type_Desc,
        Strt_Pric_Date,
        coalesce(Early_Term_Date, End_Pric_Date) as End_Pric_Date,
        Term_Days as Actl_Days,
        IF(Early_Term_Date IS NULL OR Early_Term_Date = '', '0', '1') AS Is_Preterm_Flag,
        Early_Term_Date,
        Agt_Stat_Cd,
        Book_Bel_Dept,
        Intr_Marg,
        coalesce(Init_Nom_Prin,0) as Init_Nom_Prin,
        Ex_Rate_Model
    from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
    where busi_date = '${yyyy-MM-dd}' and coalesce(Early_Term_Date, End_Pric_Date) >= '2023-01-01'
        and Cutp_Pty_Id not in ('DEV1100101715','DEV1100103266')
        and grp_id != '04'  --极速合约暂不计算
    )

SELECT  CAST( Agt_Id AS String ) Agt_Id ,
	 CAST( Busi_Type AS String ) Busi_Type ,
	 CAST( Cutp_Pty_Id AS String ) Cutp_Pty_Id ,
	 CAST( Cutp_Pty_Shor_Name AS String ) Cutp_Pty_Shor_Name ,
	 CAST( Cutp_Pty_Full_Name AS String ) Cutp_Pty_Full_Name ,
	 CAST( Sign_Prd_Name AS String ) Sign_Prd_Name ,
	 CAST( Contr_Type_Cd AS String ) Contr_Type_Cd ,
	 CAST( Contr_Type_Desc AS String ) Contr_Type_Desc ,
	 CAST( Src_Contr_Type AS String ) Src_Contr_Type ,
	 CAST( Src_Contr_Type_Desc AS String ) Src_Contr_Type_Desc ,
	 CAST( Src_Sub_Contr_Type AS String ) Src_Sub_Contr_Type ,
	 CAST( Src_Sub_Contr_Type_Desc AS String ) Src_Sub_Contr_Type_Desc ,
	 CAST( Rel_Agt_Id AS String ) Rel_Agt_Id ,
	 CAST( Undrl_Wd_Cd AS String ) Undrl_Wd_Cd ,
	 CAST( Undrl_Name AS String ) Undrl_Name ,
	 CAST( Undrl_Type AS String ) Undrl_Type ,
	 CAST( Undrl_Type_Desc AS String ) Undrl_Type_Desc ,
	 CAST( Src_Undrl_Type AS String ) Src_Undrl_Type ,
	 CAST( Src_Undrl_Type_Desc AS String ) Src_Undrl_Type_Desc ,
	 CAST( Indt_Cd AS String ) Indt_Cd ,
	 CAST( Hedg_Type_Cd AS String ) Hedg_Type_Cd ,
	 CAST( Fee_Rate AS String ) Fee_Rate ,
	 CAST( Fin_Rati AS String ) Fin_Rati ,
	 CAST( Calc_Method AS String ) Calc_Method ,
	 CAST( Base_Coef AS String ) Base_Coef ,
	 CAST( Base_Rate AS String ) Base_Rate ,
	 CAST( Sprd_Rate AS String ) Sprd_Rate ,
	 CAST( Sprd_Data AS String ) Sprd_Data ,
	 CAST( Strt_Pric_Date AS String ) Strt_Pric_Date ,
	 CAST( End_Pric_Date AS String ) End_Pric_Date ,
	 CAST( Actl_Days AS String ) Actl_Days ,
	 CAST( Is_Preterm_Flag AS String ) Is_Preterm_Flag ,
	 CAST( Early_Term_Date AS String ) Early_Term_Date ,
	 CAST( Agt_Stat_Cd AS String ) Agt_Stat_Cd ,
	 CAST( Init_Nom_Prin AS String ) Init_Nom_Prin ,
	 CAST( Main_Oper_User_Id AS String ) Main_Oper_User_Id ,
	 CAST( Main_Oper_Name AS String ) Main_Oper_Name ,
	 CAST( Main_Oper_Emp_Id AS String ) Main_Oper_Emp_Id ,
	 CAST( Intro_Oper_User_Id AS String ) Intro_Oper_User_Id ,
	 CAST( Intro_Oper_Name AS String ) Intro_Oper_Name ,
	 CAST( Intro_Oper_Emp_Id AS String ) Intro_Oper_Emp_Id ,
	 CAST( Update_Person AS String ) Update_Person ,
	 CAST( Update_Time AS String ) Update_Time ,
	 CAST( Data_Time AS String ) Data_Time ,
	 CAST( Inr_Org_Id_1 AS String ) Inr_Org_Id_1 ,
	 CAST( Inr_Org_Name_1 AS String ) Inr_Org_Name_1 ,
	 CAST( Div_Org_Id_1 AS String ) Div_Org_Id_1 ,
	 CAST( Div_Org_Name_1 AS String ) Div_Org_Name_1 ,
	 CAST( Cust_Mngr_User_Id_1 AS String ) Cust_Mngr_User_Id_1 ,
	 CAST( Cust_Mngr_Name_1 AS String ) Cust_Mngr_Name_1 ,
	 CAST( Cust_Mngr_Emp_Id_1 AS String ) Cust_Mngr_Emp_Id_1 ,
	 CAST( Allo_Prop_1 AS String ) Allo_Prop_1 ,
	 CAST( Inr_Org_Id_2 AS String ) Inr_Org_Id_2 ,
	 CAST( Inr_Org_Name_2 AS String ) Inr_Org_Name_2 ,
	 CAST( Div_Org_Id_2 AS String ) Div_Org_Id_2 ,
	 CAST( Div_Org_Name_2 AS String ) Div_Org_Name_2 ,
	 CAST( Cust_Mngr_User_Id_2 AS String ) Cust_Mngr_User_Id_2 ,
	 CAST( Cust_Mngr_Name_2 AS String ) Cust_Mngr_Name_2 ,
	 CAST( Cust_Mngr_Emp_Id_2 AS String ) Cust_Mngr_Emp_Id_2 ,
	 CAST( Allo_Prop_2 AS String ) Allo_Prop_2 ,
	 CAST( Inr_Org_Id_3 AS String ) Inr_Org_Id_3 ,
	 CAST( Inr_Org_Name_3 AS String ) Inr_Org_Name_3 ,
	 CAST( Div_Org_Id_3 AS String ) Div_Org_Id_3 ,
	 CAST( Div_Org_Name_3 AS String ) Div_Org_Name_3 ,
	 CAST( Cust_Mngr_User_Id_3 AS String ) Cust_Mngr_User_Id_3 ,
	 CAST( Cust_Mngr_Name_3 AS String ) Cust_Mngr_Name_3 ,
	 CAST( Cust_Mngr_Emp_Id_3 AS String ) Cust_Mngr_Emp_Id_3 ,
	 CAST( Allo_Prop_3 AS String ) Allo_Prop_3 ,
	 CAST( Intr_Marg AS String ) Intr_Marg ,
	Ex_Rate_Model,
	 CAST( busi_date AS String ) busi_date  FROM (
	 
select
    info.Agt_Id,
    info.Busi_Type,
    info.Cutp_Pty_Id,
    info.Cutp_Pty_Shor_Name,
    info.Cutp_Pty_Full_Name,
    info.Sign_Prd_Name,
    coalesce(info.Contr_Type_Cd, mp.otc_contract_type, 'CD017') as Contr_Type_Cd,
    coalesce(info.Contr_Type_Desc, mp.otc_contract_type_name, '其他') as Contr_Type_Desc,
    info.Src_Contr_Type,
    info.Src_Contr_Type_Desc,
    info.Src_Sub_Contr_Type,
    info.Src_Sub_Contr_Type_Desc,
    info.Rel_Agt_Id,
    info.Undrl_Wd_Cd as Undrl_Wd_Cd,
    info.Undrl_Name as Undrl_Name,        
    if(info.Src_Contr_Type = 'B_LONG_SHORT_SWAP', replace(info.src_undrl_type,'EQUITY','CIR_STOCK'), info.Undrl_Type) as Undrl_Type,
    if(info.Src_Contr_Type = 'B_LONG_SHORT_SWAP', replace(info.src_undrl_type_desc,'股票','流通股'), info.Undrl_Type_Desc) as Undrl_Type_Desc,
    info.Src_Undrl_Type,
    info.Src_Undrl_Type_Desc,
    info.Indt_Cd,
    info.Hedg_Type_Cd,
    if(info.Src_Contr_Type in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL'), info.fee_rate, null) as Fee_Rate,
    if(info.Src_Contr_Type in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL','B_LONG_SHORT_SWAP'), 1 - if(coalesce(dy.Marg_Prop, info.Init_Marg_Prop,0) > 1, 1, coalesce(dy.Marg_Prop, info.Init_Marg_Prop,0)), null) as Fin_Rati,
    coalesce(sp.Spread_Calculation, b.base_calculation) as Calc_Method,
    coalesce(cb.Base_Coef,b.Base_Coef) as Base_Coef,
    coalesce(cb.Base_Rate,b.Base_Rate) as Base_Rate,
    coalesce(if(sp.Spread_Calculation = 'ABSOLUTE', sp.Absolute_Spread, sp.Annualized_Spread), b.Spread_Rate) as Sprd_Rate,
    coalesce(sp1.Spread_Data, concat('[','{\"Annu_Sprd\":\"',if(b.base_calculation = 'ABSOLUTE', 0, b.Spread_Rate),'\",\"Absl_Sprd\":\"',if(b.base_calculation = 'ABSOLUTE', b.Spread_Rate, 0),'\",\"Sprd_Calc\":\"',b.base_calculation,'\",\"Eff_Date\":\"',info.Strt_Pric_Date,'\"}',']')) as Sprd_Data,
    info.Strt_Pric_Date,
    info.End_Pric_Date,
    info.Actl_Days,
    info.Is_Preterm_Flag,
    info.Early_Term_Date,
    info.Agt_Stat_Cd,
    info.Init_Nom_Prin,
    m.Inr_Main_Oper_User_Id as Main_Oper_User_Id,
    m.Inr_Main_Oper_Name as Main_Oper_Name,
    m.Inr_Main_Oper_Emp_Id as Main_Oper_Emp_Id,
    m.Inr_Intro_Oper_User_Id as Intro_Oper_User_Id,
    m.Inr_Intro_Oper_Name as Intro_Oper_Name,
    m.Inr_Intro_Oper_Emp_Id as Intro_Oper_Emp_Id,
    coalesce(sp.Updated_By, 'system') as Update_Person,
    coalesce(sp.Updated_Datetime, '2023-07-05 08:00:00') as Update_Time,
    from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') as Data_Time,
    m.Inr_Org_Id_1,
    m.Inr_Org_Name_1,
    m.Div_Org_Id_1,
    m.Div_Org_Name_1,
    m.Cust_Mngr_User_Id_1,
    m.Cust_Mngr_Name_1,
    m.Cust_Mngr_Emp_Id_1,
    m.Allo_Prop_1,
    m.Inr_Org_Id_2,
    m.Inr_Org_Name_2,
    m.Div_Org_Id_2,
    m.Div_Org_Name_2,
    m.Cust_Mngr_User_Id_2,
    m.Cust_Mngr_Name_2,
    m.Cust_Mngr_Emp_Id_2,
    m.Allo_Prop_2,
    m.Inr_Org_Id_3,
    m.Inr_Org_Name_3,
    m.Div_Org_Id_3,
    m.Div_Org_Name_3,
    m.Cust_Mngr_User_Id_3,
    m.Cust_Mngr_Name_3,
    m.Cust_Mngr_Emp_Id_3,
    m.Allo_Prop_3,
    info.Intr_Marg,
    if(info.Ex_Rate_Model in ('SHENZHEN_HONGKONG_STOCK_CONNECT','SHANGHAI_HONGKONG_STOCK_CONNECT'),info.Ex_Rate_Model,null) as Ex_Rate_Model,
    '${yyyy-MM-dd}' as busi_date
from (
    select *,
        case when Strt_Pric_Date >= '2026-01-01' and Ex_Rate_Model in ('SHENZHEN_HONGKONG_STOCK_CONNECT','SHANGHAI_HONGKONG_STOCK_CONNECT')
                and Src_Contr_Type in ('RISKY','AIRBAGX','S_CROSS_SWAP') then 'CD025'
             when Busi_Type = 'OPTION' and Indt_Cd in ('11','13') and coalesce(hedg_type_cd,'') != 'B2B'
                and Src_Undrl_Type not in ('EQUITY','GDR','QIS') and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'CD002'
             when Busi_Type = 'OPTION' and Indt_Cd in ('11','13') and coalesce(hedg_type_cd,'') != 'B2B'
                and Src_Undrl_Type = 'QIS' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'CD020'
             when Busi_Type = 'OPTION' and hedg_type_cd = 'B2B' then 'CD001'
             when Busi_Type = 'OPTION' and Book_Bel_Dept = 'OTC' and Src_Undrl_Type not in ('EQUITY','GDR','QIS')
                and Undrl_Curr != 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'CD023'
             when Busi_Type = 'OPTION' and (Cutp_Pty_Id like 'HK%' or Cutp_Pty_Full_Name = '廣發全球資本有限公司') and Src_Undrl_Type not in ('EQUITY','GDR','QIS')
                and Undrl_Curr = 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'CD023'
             when Busi_Type = 'OPTION' and Book_Bel_Dept = 'OTC' and Src_Undrl_Type in ('EQUITY','GDR')
                and Undrl_Curr != 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'CD024'
             when Busi_Type = 'OPTION' and (Cutp_Pty_Id like 'HK%' or Cutp_Pty_Full_Name = '廣發全球資本有限公司') and Src_Undrl_Type in ('EQUITY','GDR')
                and Undrl_Curr = 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'CD024'
             when Busi_Type = 'OPTION' and Book_Bel_Dept = 'OTC' and Src_Undrl_Type = 'QIS'
                and Undrl_Curr != 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'CD021'
             when Busi_Type = 'OPTION' and (Cutp_Pty_Id like 'HK%' or Cutp_Pty_Full_Name = '廣發全球資本有限公司') and Src_Undrl_Type = 'QIS'
                and Undrl_Curr = 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'CD021'
             when Busi_Type = 'OPTION' and Src_Undrl_Type = 'QIS' then 'CD022'
             when Busi_Type = 'TRS' and (Cutp_Pty_Id like 'HK%' or Cutp_Pty_Full_Name = '廣發全球資本有限公司')
                and Undrl_Curr = 'CNY' then 'CD018'
             when Busi_Type = 'TRS' and Src_Undrl_Type = 'QIS' then 'CD019'
             end as Contr_Type_Cd,
        case when Strt_Pric_Date >= '2026-01-01' and Ex_Rate_Model in ('SHENZHEN_HONGKONG_STOCK_CONNECT','SHANGHAI_HONGKONG_STOCK_CONNECT')
                and Src_Contr_Type in ('RISKY','AIRBAGX','S_CROSS_SWAP') then '特殊气囊（港股通）'
             when Busi_Type = 'OPTION' and Indt_Cd in ('11','13') and coalesce(hedg_type_cd,'') != 'B2B'
                and Src_Undrl_Type not in ('EQUITY','GDR','QIS') and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then '同业自主对冲真期权（非个股）'
             when Busi_Type = 'OPTION' and Indt_Cd in ('11','13') and coalesce(hedg_type_cd,'') != 'B2B'
                and Src_Undrl_Type = 'QIS' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then '策略指数-同业期权'
             when Busi_Type = 'OPTION' and hedg_type_cd = 'B2B' then '真期权背靠背'
             when Busi_Type = 'OPTION' and Book_Bel_Dept = 'OTC' and Src_Undrl_Type not in ('EQUITY','GDR','QIS')
                and Undrl_Curr != 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then '跨境期权（非个股）'
             when Busi_Type = 'OPTION' and (Cutp_Pty_Id like 'HK%' or Cutp_Pty_Full_Name = '廣發全球資本有限公司') and Src_Undrl_Type not in ('EQUITY','GDR','QIS')
                and Undrl_Curr = 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then '跨境期权（非个股）'
             when Busi_Type = 'OPTION' and Book_Bel_Dept = 'OTC' and Src_Undrl_Type in ('EQUITY','GDR')
                and Undrl_Curr != 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then '跨境期权（个股）'
             when Busi_Type = 'OPTION' and (Cutp_Pty_Id like 'HK%' or Cutp_Pty_Full_Name = '廣發全球資本有限公司') and Src_Undrl_Type in ('EQUITY','GDR')
                and Undrl_Curr = 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then '跨境期权（个股）'
             when Busi_Type = 'OPTION' and Book_Bel_Dept = 'OTC' and Src_Undrl_Type = 'QIS'
                and Undrl_Curr != 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then '策略指数-跨境期权'
             when Busi_Type = 'OPTION' and (Cutp_Pty_Id like 'HK%' or Cutp_Pty_Full_Name = '廣發全球資本有限公司') and Src_Undrl_Type = 'QIS'
                and Undrl_Curr = 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then '策略指数-跨境期权'
             when Busi_Type = 'OPTION' and Src_Undrl_Type = 'QIS' then '策略指数-其他期权'
             when Busi_Type = 'TRS' and (Cutp_Pty_Id like 'HK%' or Cutp_Pty_Full_Name = '廣發全球資本有限公司')
                and Undrl_Curr = 'CNY' then '北上跨境互换'
             when Busi_Type = 'TRS' and Src_Undrl_Type = 'QIS' then '策略指数-互换'
             end as Contr_Type_Desc
    from contr_info
    ) info
inner join (
    select Pty_Id
        from PDATA_N.T01_OTC_DERI_CUST
        where Src_Tbl in ('ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY') and busi_date = '${yyyy-MM-dd}'
            and ((Del_Flag = '0' and Montr_Flag = '1') or Pty_Id in ('DEV1100100652','DEV1100101701'))
    ) cp
on info.Cutp_Pty_Id = cp.Pty_Id
left join (
    select * from PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET
    where (busi_date = End_Pric_Date or busi_date = '${yyyy-MM-dd}') and busi_date between Strt_Pric_Date and End_Pric_Date
        and Marg_Prop is not null
    ) dy
on info.agt_id = dy.agt_id
left join (
    select
        otc_contract_type,
        otc_contract_type_name,
        t.Undrl_Type,
        Src_Contr_Type,
        Src_Sub_Contr_Type
    from (
        select
            Op_Mng_Comp_Type_Id as otc_contract_type,
            Op_Mng_Comp_Type_Desc as otc_contract_type_name,
            case when Src_Agt_Type_Cd = 'B_LONG_SHORT_SWAP' then ''
                 when coalesce(Src_Undrl_Type_Cd_Str,'') = '' then 'PRI_STOCK,CIR_STOCK,INDEX,QIS,BOND,FUTURE,FUND,OTHER'
                 else replace(replace(Src_Undrl_Type_Cd_Str,'ALL_STOCK','PRI_STOCK,CIR_STOCK'),'NON_STOCK','INDEX,QIS,BOND,FUTURE,FUND,OTHER')
                 end as Undrl_Type,
            Src_Agt_Type_Cd as Src_Contr_Type,
            Src_Agt_Sub_Type_Cd as Src_Sub_Contr_Type
        from PDATA_N.T99_OTC_DERI_INR_BASE_MAPPING
        where src_tbl = 'ODATA_N_OIS.G_INR_CONTRACT_MAPPING' and busi_date = '${yyyy-MM-dd}' and Src_Deleted_Flag = '0'
        ) x
    lateral view explode(split(Undrl_Type,',')) t as Undrl_Type
    ) mp
on coalesce(mp.Undrl_Type,'') = coalesce(info.Undrl_Type,'') and mp.Src_Contr_Type = info.Src_Contr_Type and coalesce(mp.Src_Sub_Contr_Type,coalesce(info.Src_Sub_Contr_Type,'')) = coalesce(info.Src_Sub_Contr_Type,'')
left join (
    select *
    from (
        select
            Inr_Comp_No as Contract_Code,
            if(Sprd_Calc_Type = '', null, Sprd_Calc_Type) as Spread_Calculation,
            Annu_Sprd_Coef as Annualized_Spread,
            Absl_Sprd_Coef as Absolute_Spread,
            Upd_Prsn as Updated_By,
            Upd_Time as Updated_Datetime,
            row_number() over(partition by Inr_Comp_No order by Vld_Date desc) as rn
        from PDATA_N.T99_DERI_COMP_SPRD_COEF_REF
        where SRC_TBL = 'ODATA_N_OIS.O_CONTRACT_SPREAD_RATE' and Del_Flag = '0' and coalesce(Coef_Type,'') = 'INR' and Agt_Id != ''
        ) t
    where t.rn = 1
    ) sp
on sp.CONTRACT_CODE = info.Agt_Id
left join (
    select
        Contract_Code,
        concat('[',concat_ws(',',collect_list(data)),']') as spread_data 
    from (
        select 
            Inr_Comp_No as Contract_Code, Vld_Date as Effective_Date,
            concat('{\"Annu_Sprd\":\"',Annu_Sprd_Coef,'\",\"Absl_Sprd\":\"',Absl_Sprd_Coef,'\",\"Sprd_Calc\":\"',Sprd_Calc_Type,'\",\"Eff_Date\":\"',substring(Vld_Date,1,10),'\"}') as data 
        from PDATA_N.T99_DERI_COMP_SPRD_COEF_REF
        where SRC_TBL = 'ODATA_N_OIS.O_CONTRACT_SPREAD_RATE' and Del_Flag = '0' and coalesce(Coef_Type,'') = 'INR' and Agt_Id != ''
        order by Inr_Comp_No, Vld_Date desc
        ) a
    group by Contract_Code
    ) sp1
on sp1.CONTRACT_CODE = info.Agt_Id
left join (
    select
        OTC_CONTRACT_TYPE,
        Dft_Base_Coef as Base_Coef,
        Base_Yield as Base_Rate,
        Adtnl_Yield as Spread_Rate,
        base_calculation,
        date_add(strt_date, pos) as busi_date
    from (
        select
            Op_Mng_Comp_Type_Id as OTC_CONTRACT_TYPE,
            Base_Yield,
            Dft_Base_Coef,
            Adtnl_Yield,
            Calc_Way as base_calculation,
            Actl_Vld_Day as strt_date,
            date_sub(lead(Actl_Vld_Day, 1, date_add('${yyyy-MM-dd}', 1)) over(partition by Op_Mng_Comp_Type_Id order by Actl_Vld_Day), 1) as end_Date
        from PDATA_N.T99_OTC_DERI_INR_BASE_REF
        where src_tbl = 'ODATA_N_OIS.G_INR_BASE_RATE' and busi_date = '${yyyy-MM-dd}' and Src_Deleted_Flag = '0'
        ) x
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
    ) b
on b.OTC_CONTRACT_TYPE = coalesce(info.Contr_Type_Cd, mp.otc_contract_type, 'CD017') and b.busi_date = info.Strt_Pric_Date
left join (
    select
        Inr_Comp_No as CONTRACT_CODE,
        Dft_Base_Coef as Base_Coef,
        Base_Yield as Base_Rate,
        Calc_Type as base_calculation
    from PDATA_N.T99_DERI_COMP_BASE_COEF_REF
    where SRC_TBL = 'ODATA_N_OIS.G_INR_CONTRACT_BASE_RATE' and Del_Flag = '0' and Agt_Id != ''
    ) cb
on cb.CONTRACT_CODE = info.agt_id
left join (
    select * from PDATA_N.T98_OTC_COMP_MNG_RELA_INFO
    where busi_date = '${yyyy-MM-dd}'
    ) m
on m.Agt_Id = info.Agt_Id 
	) castTable