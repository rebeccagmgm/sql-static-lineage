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
	 CAST( fee_rate AS String ) fee_rate ,
	 CAST( Fin_Rati AS String ) Fin_Rati ,
	 CAST( Base_Coef AS String ) Base_Coef ,
	 CAST( Base_Rate AS String ) Base_Rate ,
	 CAST( Sprd_Rate AS String ) Sprd_Rate ,
	 CAST( Strt_Pric_Date AS String ) Strt_Pric_Date ,
	 CAST( End_Pric_Date AS String ) End_Pric_Date ,
	 CAST( Actl_Days AS String ) Actl_Days ,
	 CAST( Is_Preterm_Flag AS String ) Is_Preterm_Flag ,
	 CAST( Early_Term_Date AS String ) Early_Term_Date ,
	 CAST( Agt_Stat_Cd AS String ) Agt_Stat_Cd ,
	 CAST( Init_Nom_Prin AS String ) Init_Nom_Prin ,
	 CAST( Dyna_Nom_Prin AS String ) Dyna_Nom_Prin ,
	 CAST( Sales_Income AS String ) Sales_Income ,
	 CAST( Sales_Income_Main AS String ) Sales_Income_Main ,
	 CAST( Sales_Income_Intro AS String ) Sales_Income_Intro ,
	 CAST( Main_Oper_User_Id AS String ) Main_Oper_User_Id ,
	 CAST( Main_Oper_Name AS String ) Main_Oper_Name ,
	 CAST( Main_Oper_Emp_Id AS String ) Main_Oper_Emp_Id ,
	 CAST( Intro_Oper_User_Id AS String ) Intro_Oper_User_Id ,
	 CAST( Intro_Oper_Name AS String ) Intro_Oper_Name ,
	 CAST( Intro_Oper_Emp_Id AS String ) Intro_Oper_Emp_Id ,
	 CAST( Accrued_Date AS String ) Accrued_Date ,
	 CAST( Data_Time AS String ) Data_Time ,
	Intr_Marg,
	Accum_Dyna_Nom_Prin,
	Accum_Sales_Income,
	Accum_Sales_Income_Main,
	Accum_Sales_Income_Intro,
	Ex_Rate_Model,
	 CAST( busi_date AS String ) busi_date  FROM (
	 select
    t.Agt_Id,
    t.Busi_Type,
    t.Cutp_Pty_Id,
    t.Cutp_Pty_Shor_Name,
    t.Cutp_Pty_Full_Name,
    t.Sign_Prd_Name,
    t.Contr_Type_Cd,
    t.Contr_Type_Desc,
    t.Src_Contr_Type,
    t.Src_Contr_Type_Desc,
    t.Src_Sub_Contr_Type,
    t.Src_Sub_Contr_Type_Desc,
    t.Rel_Agt_Id,
    t.Undrl_Wd_Cd,
    t.Undrl_Name,
    t.Undrl_Type,
    t.Undrl_Type_Desc,
    t.Src_Undrl_Type,
    t.Src_Undrl_Type_Desc,
    t.Indt_Cd,
    t.Hedg_Type_Cd,
    t.fee_rate,
    t.Fin_Rati,
    t.Base_Coef,
    t.Base_Rate,
    t.Sprd_Rate,
    t.Strt_Pric_Date,
    t.End_Pric_Date,
    t.Actl_Days,
    t.Is_Preterm_Flag,
    t.Early_Term_Date,
    t.Agt_Stat_Cd,
    coalesce(t.Init_Nom_Prin,0) as Init_Nom_Prin,
    coalesce(t.Dyna_Nom_Prin,0) as Dyna_Nom_Prin,
    coalesce(t.Sales_Income,0) as Sales_Income,
    IF(coalesce(m.Inr_Intro_Oper_User_Id,'') = '', coalesce(t.Sales_Income,0) * 1, coalesce(t.Sales_Income,0) * 0.4) AS Sales_Income_Main,
    IF(coalesce(m.Inr_Intro_Oper_User_Id,'') = '', coalesce(t.Sales_Income,0) * 0, coalesce(t.Sales_Income,0) * 0.6) AS Sales_Income_Intro,
    m.Inr_Main_Oper_User_Id as Main_Oper_User_Id,
    m.Inr_Main_Oper_Name as Main_Oper_Name,
    m.Inr_Main_Oper_Emp_Id as Main_Oper_Emp_Id,
    m.Inr_Intro_Oper_User_Id as Intro_Oper_User_Id,
    m.Inr_Intro_Oper_Name as Intro_Oper_Name,
    m.Inr_Intro_Oper_Emp_Id as Intro_Oper_Emp_Id,
    t.Accrued_Date,
    from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') as Data_Time,
    t.Intr_Marg,
    sum(if(t.Accrued_Date BETWEEN Strt_Pric_Date AND End_Pric_Date, coalesce(t.Dyna_Nom_Prin, 0),0)) over(partition by t.agt_id order by accrued_date) as Accum_Dyna_Nom_Prin,
    sum(coalesce(Sales_Income, 0)) over(partition by t.agt_id order by accrued_date) as Accum_Sales_Income,
    sum(IF(coalesce(m.Inr_Intro_Oper_User_Id,'') = '', coalesce(t.Sales_Income,0) * 1, coalesce(t.Sales_Income,0) * 0.4)) over(partition by t.agt_id order by accrued_date) as Accum_Sales_Income_Main,
    sum(IF(coalesce(m.Inr_Intro_Oper_User_Id,'') = '', coalesce(t.Sales_Income,0) * 0, coalesce(t.Sales_Income,0) * 0.6)) over(partition by t.agt_id order by accrued_date) as Accum_Sales_Income_Intro,
    t.Ex_Rate_Model,
    '${yyyy-MM-dd}' as busi_date
from (
    select
        info.Agt_Id,
        info.Busi_Type,
        info.Cutp_Pty_Id,
        info.Cutp_Pty_Shor_Name,
        info.Cutp_Pty_Full_Name,
        info.Sign_Prd_Name,
        coalesce(info.Inr_Contr_Type_Cd, mp.otc_contract_type, 'CD017') as Contr_Type_Cd,
        coalesce(info.Inr_Contr_Type_Desc, mp.otc_contract_type_name, '其他') as Contr_Type_Desc,
        info.Src_Contr_Type,
        info.Src_Contr_Type_Desc,
        info.Src_Sub_Contr_Type,
        info.Src_Sub_Contr_Type_Desc,
        info.Rel_Agt_Id,
        info.Undrl_Wd_Cd,
        info.Undrl_Name,
        if(info.Src_Contr_Type = 'B_LONG_SHORT_SWAP', replace(info.src_undrl_type,'EQUITY','CIR_STOCK'), info.Undrl_Type_n) as Undrl_Type,
        if(info.Src_Contr_Type = 'B_LONG_SHORT_SWAP', replace(info.src_undrl_type_desc,'股票','流通股'), info.Undrl_Type_Desc_n) as Undrl_Type_Desc,
        info.Src_Undrl_Type,
        info.Src_Undrl_Type_Desc,
        info.Indt_Cd,
        info.Hedg_Type_Cd,
        if(info.Src_Contr_Type in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL'), info.fee_rate, null) as fee_rate,
        if(info.Src_Contr_Type in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL','B_LONG_SHORT_SWAP'), 1 - if(cast(coalesce(dy.Marg_Prop, info.Init_Marg_Prop,0) as double) > 1, 1, coalesce(dy.Marg_Prop, info.Init_Marg_Prop,0)), null) as Fin_Rati,
        coalesce(cb.Base_Coef,b.Base_Coef) as Base_Coef,
        coalesce(cb.Base_Rate,b.Base_Rate) as Base_Rate,
        coalesce(if(sp.Spread_Calculation = 'ABSOLUTE', sp.Absolute_Spread, sp.Annualized_Spread), b.Spread_Rate) as Sprd_Rate,
        info.Strt_Pric_Date,
        info.End_Pric_Date_n as End_Pric_Date,
        info.Term_Days as Actl_Days,
        IF(info.Early_Term_Date IS NULL OR info.Early_Term_Date = '', '0', '1') AS Is_Preterm_Flag,
        info.Early_Term_Date,
        info.Agt_Stat_Cd,
        dy.Init_Nom_Prin,
        dy.Dyna_Nom_Prin,
        case when info.Busi_Type = 'OPTION' and info.hedg_type_cd = 'B2B' then if((info.Strt_Pric_Date < '2023-01-01' and dy.busi_date = '2023-01-01') or info.Strt_Pric_Date = dy.busi_date, npv.initial_npv, 0)
             when info.Src_Contr_Type in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then coalesce(dy.Dyna_Nom_Prin, 0) * (1 - if(coalesce(info.Init_Marg_Prop,1) = 1, 0, info.Init_Marg_Prop))  * coalesce(cb.Base_Coef,b.Base_Coef,0) * (coalesce(cb.Base_Rate,b.Base_Rate,0) + coalesce(sp.Annualized_Spread, b.Spread_Rate,0)) / 365
             when info.Src_Contr_Type in ('B_LONG_SHORT_SWAP') then coalesce(dy.Dyna_Nom_Prin, 0) * (1 - if(cast(coalesce(dy.Marg_Prop,0) as double) > 1, 1, coalesce(dy.Marg_Prop,0)))  * coalesce(cb.Base_Coef,b.Base_Coef,0) * (coalesce(cb.Base_Rate,b.Base_Rate,0) + coalesce(sp.Annualized_Spread, b.Spread_Rate,0)) / 365
             when coalesce(b.base_calculation, cb.base_calculation, sp.Spread_Calculation, 'ABSOLUTE') = 'ABSOLUTE' then if((info.Strt_Pric_Date < '2023-01-01' and dy.busi_date = '2023-01-01') or info.Strt_Pric_Date = dy.busi_date, coalesce(dy.Init_Nom_Prin, 0) * coalesce(cb.Base_Coef,b.Base_Coef,0) * (coalesce(cb.Base_Rate,b.Base_Rate,0) + coalesce(sp.Absolute_Spread, b.Spread_Rate,0)), 0)
             when coalesce(b.base_calculation, cb.base_calculation, sp.Spread_Calculation, 'ABSOLUTE') = 'ANNUALIZED' then coalesce(dy.Dyna_Nom_Prin, 0)  * coalesce(cb.Base_Coef,b.Base_Coef,0) * (coalesce(cb.Base_Rate,b.Base_Rate,0) + coalesce(sp.Annualized_Spread, b.Spread_Rate,0)) / 365
             end as Sales_Income,
        dy.busi_date as Accrued_Date,
        info.Intr_Marg,
        if(info.Ex_Rate_Model in ('SHENZHEN_HONGKONG_STOCK_CONNECT','SHANGHAI_HONGKONG_STOCK_CONNECT'),info.Ex_Rate_Model,null) as Ex_Rate_Model,
        '${yyyy-MM-dd}' as busi_date
    from (
        select *, coalesce(Early_Term_Date, End_Pric_Date) as End_Pric_Date_n,
            case when Src_Contr_Type = 'B_LONG_SHORT_SWAP' then ''
                 when (Src_Undrl_Type in ('EQUITY', 'BASKET') and Res_Flag = '1') or Src_Undrl_Type = 'GDR' then 'PRI_STOCK'
                 when Src_Undrl_Type in ('EQUITY', 'BASKET') and Res_Flag = '0' then 'CIR_STOCK'
                 when Src_Undrl_Type = 'BOND' then 'BOND'
                 when Src_Undrl_Type = 'FUTURE' then 'FUTURE'
                 when Src_Undrl_Type = 'INDEX' then 'INDEX'
                 when Src_Undrl_Type = 'QIS' then 'QIS'
                 when Src_Undrl_Type in ('FUND','HEDGE_FUND') then 'FUND'
                 else 'OTHER'
                 end as Undrl_Type_n,
            case when Src_Contr_Type = 'B_LONG_SHORT_SWAP' then ''
                 when (Src_Undrl_Type in ('EQUITY', 'BASKET') and Res_Flag = '1') or Src_Undrl_Type = 'GDR' then '限售股'
                 when Src_Undrl_Type in ('EQUITY', 'BASKET') and Res_Flag = '0' then '流通股'
                 when Src_Undrl_Type = 'BOND' then '债券'
                 when Src_Undrl_Type = 'FUTURE' then '期货'
                 when Src_Undrl_Type = 'INDEX' then '股指'
                 when Src_Undrl_Type = 'QIS' then '策略指数'
                 when Src_Undrl_Type in ('FUND','HEDGE_FUND') then '基金'
                 else '其他'
                 end as Undrl_Type_Desc_n,
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
                 end as Inr_Contr_Type_Cd,
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
                 end as Inr_Contr_Type_Desc
        from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
        where busi_date = '${yyyy-MM-dd}' and coalesce(Early_Term_Date, End_Pric_Date) >= '2023-01-01'
            and Cutp_Pty_Id not in ('DEV1100101715','DEV1100103266')
            and grp_id != '04'
        ) info
    inner join (
        select * from PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET
        where busi_date >= '2023-01-01'
        ) dy
    on info.agt_id = dy.agt_id
    inner join (
        select Pty_Id
        from PDATA_N.T01_OTC_DERI_CUST
        where Src_Tbl in ('ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY') and busi_date = '${yyyy-MM-dd}'
            and ((Del_Flag = '0' and Montr_Flag = '1') or Pty_Id in ('DEV1100100652','DEV1100101701'))
        ) cp
    on info.Cutp_Pty_Id = cp.Pty_Id
    left join (
        select
            x.agt_id,
            max(x.Bgng_Npv) + sum(z.Bgng_Npv) as initial_npv
        from (
            select agt_id, x.rel_agt_id, Bgng_Npv
            from (
                select agt_id, rel_agt_id, Bgng_Npv from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
                where busi_date = '${yyyy-MM-dd}' and coalesce(Early_Term_Date, End_Pric_Date) >= '2023-01-01' and hedg_type_cd = 'B2B'
                ) t
            lateral view explode(split(rel_agt_id,',')) x as rel_agt_id
            ) x
        left join (
            select
                agt_id,
                Bgng_Npv
            from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
            where busi_date = '${yyyy-MM-dd}'
            ) z
        on x.rel_agt_id = z.agt_id
        group by x.agt_id
        ) npv
    on npv.Agt_Id = info.Agt_Id
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
    on coalesce(mp.Undrl_Type,'') = coalesce(info.Undrl_Type_n,'') and mp.Src_Contr_Type = info.Src_Contr_Type and coalesce(mp.Src_Sub_Contr_Type,info.Src_Sub_Contr_Type,'') = coalesce(info.Src_Sub_Contr_Type,'')
    left join (
        select
            Contract_Code,
            Spread_Calculation,
            Annualized_Spread,
            Absolute_Spread,
            date_add(strt_date, pos) as busi_date
        from (
            select
                Inr_Comp_No as Contract_Code,
                if(Sprd_Calc_Type = '', null, Sprd_Calc_Type) as Spread_Calculation,
                Annu_Sprd_Coef as Annualized_Spread,
                Absl_Sprd_Coef as Absolute_Spread,
                Vld_Date as strt_date,
                date_sub(lead(Vld_Date, 1, date_add('${yyyy-MM-dd}', 1)) over(partition by Inr_Comp_No order by Vld_Date), 1) as end_Date
            from PDATA_N.T99_DERI_COMP_SPRD_COEF_REF
            where SRC_TBL = 'ODATA_N_OIS.O_CONTRACT_SPREAD_RATE' and Del_Flag = '0' and coalesce(Coef_Type,'') = 'INR' and Agt_Id != ''
            ) x
        lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
        ) sp
    on sp.CONTRACT_CODE = dy.Agt_Id and sp.busi_date = dy.busi_date
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
    on b.OTC_CONTRACT_TYPE = coalesce(info.Inr_Contr_Type_Cd, mp.otc_contract_type, 'CD017') and b.busi_date = info.Strt_Pric_Date
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
    ) t
left join (
    select * from PDATA_N.T98_OTC_COMP_MNG_RELA_INFO
    where busi_date = '${yyyy-MM-dd}'
    ) m
on m.Agt_Id = t.Agt_Id 
	) castTable