
SELECT Agt_Id,
	Busi_Type,
	Cutp_Pty_Id,
	Cutp_Pty_Shor_Name,
	Cutp_Pty_Full_Name,
	Sign_Prd_Name,
	Contr_Type_Cd,
	Contr_Type_Desc,
	Src_Contr_Type,
	Src_Contr_Type_Desc,
	Src_Sub_Contr_Type,
	Src_Sub_Contr_Type_Desc,
	Undrl_Wd_Cd,
	Undrl_Name,
	Undrl_Type,
	Src_Undrl_Type,
	Annu_Sprd,
	Absl_Sprd,
	Sprd_Calc_Cd,
	Sprd_Data,
	Base_Award_Rate,
	Base_Calc_Cd,
	Cms_Fee_Rate,
	Cms_Rate_Calc_Cd,
	Cms_Data,
	Strt_Pric_Date,
	End_Pric_Date,
	Earn_Pymt_Date,
	Agt_Stat_Cd,
	Main_Oper_User_Id,
	Main_Oper_Name,
	Main_Oper_Emp_Id,
	Intro_Oper_User_Id,
	Intro_Oper_Name,
	Intro_Oper_Emp_Id,
	Intro_Inr_Org_Id_1,
	Intro_Inr_Org_Name_1,
	Cust_Mngr_User_Id_1,
	Cust_Mngr_Name_1,
	Cust_Mngr_Emp_Id_1,
	Allo_Prop_1,
	Intro_Inr_Org_Id_2,
	Intro_Inr_Org_Name_2,
	Cust_Mngr_User_Id_2,
	Cust_Mngr_Name_2,
	Cust_Mngr_Emp_Id_2,
	Allo_Prop_2,
	Intro_Inr_Org_Id_3,
	Intro_Inr_Org_Name_3,
	Cust_Mngr_User_Id_3,
	Cust_Mngr_Name_3,
	Cust_Mngr_Emp_Id_3,
	Allo_Prop_3,
	Init_Nom_Prin,
	fee_rate,
	Fin_Rati,
	Intr_Marg,
	Upt_Prsn,
	Upt_Time,
	Data_Time,
	busi_date FROM (
	 select
    info.Agt_Id,  --合约编号
    info.Busi_Type,  --业务类型
    info.Cutp_Pty_Id,  --交易对手客户编号
    info.Cutp_Pty_Shor_Name,  --交易对手当事人简称
    info.Cutp_Pty_Full_Name,  --交易对手当事人名称
    info.Sign_Prd_Name,  --代签产品名称
    info.HK_Contr_Type_Cd as Contr_Type_Cd,  --合约类型代码
    info.HK_Contr_Type_Desc as Contr_Type_Desc,  --合约类型描述
    info.Src_Contr_Type,  --源合约类型
    info.Src_Contr_Type_Desc,  --源合约类型描述
    info.Src_Sub_Contr_Type,  --源合约子类型
    info.Src_Sub_Contr_Type_Desc,  --源合约子类型描述
    info.Undrl_Wd_Cd,  --WD标的代码
    info.Undrl_Name,  --标的名称
    info.HK_Undrl_Type as Undrl_Type,  --标的类型
    info.Src_Undrl_Type,  --源标的类型
    coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread) as Annu_Sprd,  --年化价差
    coalesce(s_sp.Absolute_Spread, c_sp.Absolute_Spread) as Absl_Sprd,  --绝对价差
    coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation) as Sprd_Calc_Cd,  --价差计算方式代码
    coalesce(s_sp1.Spread_Data, concat('[','{\"Annu_Sprd\":\"',c_sp.Annualized_Spread,'\",\"Absl_Sprd\":\"',c_sp.Absolute_Spread,'\",\"Sprd_Calc\":\"',c_sp.Spread_Calculation,'\",\"Eff_Date\":\"',info.Strt_Pric_Date,'\"}',']')) as Sprd_Data,
    coalesce(s_ba.Base_Award_Rate, c_ba.Base_Award_Rate) as Base_Award_Rate,  --销售基础奖励系数
    coalesce(s_ba.Base_Calculation, c_ba.Base_Calculation) as Base_Calc_Cd,  --销售基础奖励计算方式代码
    coalesce(s_cr.commission_rate,c_cr.commission_rate) as Cms_Fee_Rate,  --交易佣金费率
    coalesce(s_cr.commis_calc_type,c_cr.commis_calc_type) as Cms_Rate_Calc_Cd,  --交易佣金费率计算方式代码
    coalesce(s_cr1.Cms_data, concat('[','{\"Cms_Fee_Rate\":\"',c_cr.commission_rate,'\",\"Cms_Rate_Calc\":\"',c_cr.commis_calc_type,'\",\"Eff_Date\":\"',info.Strt_Pric_Date,'\"}',']')) as Cms_Data,
    info.Strt_Pric_Date,  --期初定价日
    coalesce(info.Early_Term_Date, info.End_Pric_Date) as End_Pric_Date,  --期末定价日
    info.Earn_Pymt_Date,  --收益兑付日
    info.Agt_Stat_Cd,  --协议状态代码
    m.Main_Oper_User_Id,  --主经办人USER_ID
    if(m.Main_Oper_User_Id = 'ruonanlyu', '吕若楠', m.Main_Oper_Name) as Main_Oper_Name,  --主经办人姓名
    m.Main_Oper_Emp_Id,  --主经办人ERP编号
    m.Intro_Oper_User_Id,  --引入经办人USER_ID
    if(m.Intro_Oper_User_Id= 'ruonanlyu', '吕若楠', m.Intro_Oper_Name) as Intro_Oper_Name,  --引入经办人姓名
    m.Intro_Oper_Emp_Id,  --引入经办人ERP编号
    m.Inr_Org_Id_1 as Intro_Inr_Org_Id_1,  --引入部门ID_1
    m.Inr_Org_Name_1 as Intro_Inr_Org_Name_1,  --引入部门名称_1
    m.Cust_Mngr_User_Id_1,  --客户经理USER_ID_1
    m.Cust_Mngr_Name_1,  --客户经理姓名_1
    m.Cust_Mngr_Emp_Id_1,  --客户经理ERP编号_1
    m.Allo_Prop_1,  --分配比例_1
    m.Inr_Org_Id_2 as Intro_Inr_Org_Id_2,  --引入部门ID_2
    m.Inr_Org_Name_2 as Intro_Inr_Org_Name_2,  --引入部门名称_2
    m.Cust_Mngr_User_Id_2,  --客户经理USER_ID_2
    m.Cust_Mngr_Name_2,  --客户经理姓名_2
    m.Cust_Mngr_Emp_Id_2,  --客户经理ERP编号_2
    m.Allo_Prop_2,  --分配比例_2
    m.Inr_Org_Id_3 as Intro_Inr_Org_Id_3,  --引入部门ID_3
    m.Inr_Org_Name_3 as Intro_Inr_Org_Name_3,  --引入部门名称_3
    m.Cust_Mngr_User_Id_3,  --客户经理USER_ID_3
    m.Cust_Mngr_Name_3,  --客户经理姓名_2
    m.Cust_Mngr_Emp_Id_3,  --客户经理ERP编号_3
    m.Allo_Prop_3,  --分配比例_3
    info.Init_Nom_Prin,  --期初名义本金
    if(info.Src_Contr_Type in ('RISKY','AIRBAGX'), fee_rate, null) as fee_rate,  --成交费率
    if(info.Src_Contr_Type in ('RISKY','AIRBAGX'), 1 - Init_Marg_Prop, null) as Fin_Rati,  --融资比例
    info.Intr_Marg,  --利差
    coalesce(s_sp.Updated_By, 'system') as Upt_Prsn,  --更新人
    coalesce(s_sp.Updated_Datetime,'2022-10-28 08:00:00') as Upt_Time,  --更新时间
    from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') as Data_Time,  --数据时间
    '${yyyy-MM-dd}' as busi_date  --业务日期
from (
    select *,
        if(busi_type = 'OPTION',
            case when Src_Undrl_Type = 'EQUITY'
                       and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL','CUSTOMISED')
                       and not(Src_Contr_Type = 'AUTOCALL' and Src_Sub_Contr_Type = 'SNOWBALL')
                       then 'OPTION_STOCK'
                 when Src_Undrl_Type in ('INDEX', 'FUND')
                       and(Src_Contr_Type in ('ACCUMULATOR','DECCUMULATOR','AIRBAG') or (Src_Contr_Type = 'AUTOCALL' and Src_Sub_Contr_Type != 'SNOWBALL'))
                       then 'OPTION_IDX_ETF'
                 when Cntr = 'OTCHK_QIS' and Src_Undrl_Type = 'QIS' and Sler_Cutp_Pty_Id = 'TIT060-11613' then 'OPTION_N_CROSS_QTF_STRG_IDX'
                 when Src_Contr_Type in ('RISKY','AIRBAGX') and Src_Undrl_Type = 'EQUITY' and Res_Flag = '1' then 'OPTION_RISKY_AIRBAGX_PRI_STOCK'
                 when Src_Contr_Type in ('RISKY','AIRBAGX') and Res_Flag = '0' then 'OPTION_RISKY_AIRBAGX_CIR_STOCK'
                 else 'OPTION_OTHER_NONSTOCK' end,
            case when Src_Contr_Type in ('N_CROSS_SWAP','LEND_SWAP','INDEX_ENHANCE_SWAP','FEE_SWAP','CROSS_LEND_SWAP','HK_LONG_HOLD_SWAP','N_CROSS_QFII_SWAP','LONG_SHORT_SWAP','N_CROSS_FUTURE_SWAP','N_CROSS_DMA_SWAP') then Src_Contr_Type
                 else 'TRS_OTHER_SWAP' end) as HK_Contr_Type_Cd,
        if(busi_type = 'OPTION',
            case when Src_Undrl_Type = 'EQUITY'
                       and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL','CUSTOMISED')
                       and not(Src_Contr_Type = 'AUTOCALL' and Src_Sub_Contr_Type = 'SNOWBALL')
                       then '个股期权'
                 when Src_Undrl_Type in ('INDEX', 'FUND')
                       and(Src_Contr_Type in ('ACCUMULATOR','DECCUMULATOR','AIRBAG') or (Src_Contr_Type = 'AUTOCALL' and Src_Sub_Contr_Type != 'SNOWBALL'))
                       then '指数/ETF期权'
                 when Cntr = 'OTCHK_QIS' and Src_Undrl_Type = 'QIS' and Sler_Cutp_Pty_Id = 'TIT060-11613' then '北上量化策略指数期权'
                 when Src_Contr_Type in ('RISKY','AIRBAGX') and Src_Undrl_Type = 'EQUITY' and Res_Flag = '1' then 'Risky和安全气囊X（限售股）'
                 when Src_Contr_Type in ('RISKY','AIRBAGX') and Res_Flag = '0' then 'Risky和安全气囊X（流通股）'
                 else '其他期权' end,
            case when Src_Contr_Type in ('LEND_SWAP','FEE_SWAP','CROSS_LEND_SWAP','HK_LONG_HOLD_SWAP','N_CROSS_QFII_SWAP','LONG_SHORT_SWAP','N_CROSS_FUTURE_SWAP','N_CROSS_DMA_SWAP') then Src_Contr_Type_Desc
                 when Src_Contr_Type = 'N_CROSS_SWAP' then '北上A股'
                 when Src_Contr_Type = 'INDEX_ENHANCE_SWAP' then '北上指数增强'
                 else '其他互换类型' end) as HK_Contr_Type_Desc,
        case when Futr_Type in ('COMMODITY_FUTURE','EQUITY_INDEX_FUTURE') then Futr_Type
             when Src_Undrl_Type in ('EQUITY','INDEX','FUND') then Src_Undrl_Type
             else 'OTHER' end as HK_Undrl_Type
    from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
    where busi_date = '${yyyy-MM-dd}' and coalesce(Early_Term_Date, End_Pric_Date) >= '2025-12-01'
        and book_name in ('OTCHK-互换-ISDA','OTCHK-互换-ISDA（费用）','OTCHK-返息费用','OTCHK-Option-北上跨境','OTCHK-Option-B2B','OTCHK-Option-ISDA')
    ) info
inner join (
    select Pty_Id
    from PDATA_N.T01_OTC_DERI_CUST
    where Src_Tbl = 'ODATA_N_OIS.G_HK_COUNTERPARTY' and busi_date = '${yyyy-MM-dd}'
        and Del_Flag = '0' and Incl_Cs_Income_Flag = '1'
    ) cp
on info.Cutp_Pty_Id = cp.Pty_Id
left join (
    select
        Inr_Comp_No as contract_code,
        Sprd_Calc_Type as Spread_Calculation,
        Annu_Sprd_Coef as Annualized_Spread,
        Absl_Sprd_Coef as Absolute_Spread,
        Upd_Prsn as Updated_By,
        Upd_Time as Updated_Datetime,
        row_number() over(partition by Inr_Comp_No order by Vld_Date desc) as rn
    from PDATA_N.T99_DERI_COMP_SPRD_COEF_REF
    where src_tbl = 'ODATA_N_OIS.O_CONTRACT_SPREAD_RATE' and Del_Flag = '0' and coalesce(Coef_Type, '') != 'INR' and Agt_Id != ''
    ) s_sp
on s_sp.contract_code = info.Agt_Id and s_sp.rn = 1
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
        client_id,
        business_type,
        underlying_type,
        Spread_Calculation,
        Annualized_Spread,
        Absolute_Spread,
        Updated_By,
        Updated_Datetime,
        date_add(strt_date, pos) as busi_date
    from (
        select
            client_id as client_id,
            business_type,
            underlying_type,
            if(spread_calc_type = '', null, spread_calc_type) as Spread_Calculation,
            annualized_spread as Annualized_Spread,
            absolute_spread as Absolute_Spread,
            Updated_By,
            Updated_Datetime,
            if(start_date = '2023-01-01','2024-01-01',start_date) as strt_date,
            if(end_date = '2999-12-31','${yyyy-MM-dd}',end_date) as end_Date
        from ODATA_N_OIS.G_REV_HKCPTY_BID_ASK_SPREAD_COEF
        where busi_date = '${yyyy-MM-dd}' and is_deleted = 'N'
        ) x
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
    ) c_sp
on c_sp.client_id = info.Cutp_Pty_Id and c_sp.business_type = info.Busi_Type
    and c_sp.underlying_type = info.HK_Undrl_Type and c_sp.busi_date = info.Strt_Pric_Date
left join (
    select *, row_number() over(partition by contract_code order by effective_date desc) as rn
    from odata_n_ois.g_rev_hk_contract_commission_rate
    where busi_date = '${yyyy-MM-dd}' and is_deleted = 'N'
    ) s_cr
on s_cr.contract_code = info.Agt_Id and s_cr.rn = 1
left join (
    select
        Contract_Code,
        concat('[',concat_ws(',',collect_list(data)),']') as Cms_data 
    from (
        select 
            Contract_Code, Effective_Date,
            concat('{\"Cms_Fee_Rate\":\"',commission_rate,'\",\"Cms_Rate_Calc\":\"',commis_calc_type,'\",\"Eff_Date\":\"',effective_date,'\"}') as data 
        from odata_n_ois.g_rev_hk_contract_commission_rate
        where busi_date = '${yyyy-MM-dd}' and is_deleted = 'N'
        order by contract_code, effective_date desc
        ) a
    group by Contract_Code
    ) s_cr1
on s_cr1.CONTRACT_CODE = info.Agt_Id
left join (
    select
        client_id,
        business_type,
        underlying_type,
        commission_rate,
        commis_calc_type,
        date_add(strt_date, pos) as busi_date
    from (
        select
            client_id as client_id,
            business_type,
            underlying_type,
            commission_rate,
            commis_calc_type,
            if(start_date = '2023-01-01','2024-01-01',start_date) as strt_date,
            if(end_date = '2999-12-31','${yyyy-MM-dd}',end_date) as end_Date
        from odata_n_ois.g_rev_hkcpty_bid_ask_commission_rate
        where busi_date = '${yyyy-MM-dd}' and is_deleted = 'N'
        ) x
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
    ) c_cr
on c_cr.client_id = info.Cutp_Pty_Id and c_cr.business_type = info.Busi_Type
     and c_cr.underlying_type = info.HK_Undrl_Type and c_cr.busi_date = info.Strt_Pric_Date
left join (
    select
        Inr_Comp_No as contract_code,
        Calc_Type as base_calculation,
        Base_Yield as base_award_rate
    from PDATA_N.T99_DERI_COMP_BASE_COEF_REF
    where src_tbl = 'ODATA_N_OIS.O_CONTRACT_BASE_RATE' and Del_Flag = '0' and Agt_Id != ''
    ) s_ba
on s_ba.contract_code = info.Agt_Id
left join (
    select
        business_type,
        underlying_type,
        base_calculation,
        base_award_rate
    from ODATA_N_OIS.G_REV_HK_SALES_BASE_COEF
    where busi_date = '${yyyy-MM-dd}' and is_deleted = 'N'
    ) c_ba
on c_ba.business_type = info.Busi_Type and c_ba.underlying_type = info.HK_Undrl_Type     
left join (
    select * from PDATA_N.T98_OTC_COMP_MNG_RELA_INFO
    where busi_Date = '${yyyy-MM-dd}'
    ) m
on m.Agt_Id = info.Agt_Id
where coalesce(if(m.Inr_Org_Id_1 = '', '8846', m.Inr_Org_Id_1), '8846') != '8846' or coalesce(if(m.Inr_Org_Id_2 = '', '8846', m.Inr_Org_Id_2), '8846') != '8846' or coalesce(if(m.Inr_Org_Id_3 = '', '8846', m.Inr_Org_Id_3), '8846') != '8846' 
	) castTable