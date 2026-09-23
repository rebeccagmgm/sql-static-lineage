
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
	Annu_Base,
	Absl_Base,
	Cms_Fee_Rate,
	Init_Nom_Prin,
	Init_Nom_Prin_Main,
	Init_Nom_Prin_Intro,
	Dyna_Nom_Prin,
	Dyna_Nom_Prin_Main,
	Dyna_Nom_Prin_Intro,
	Accum_Dyna_Nom_Prin,
	Absl_Nom_Prin,
	Absl_Nom_Prin_Main,
	Absl_Nom_Prin_Intro,
	Accum_Absl_Nom_Prin,
	Strt_Pric_Date,
	End_Pric_Date,
	Earn_Pymt_Date,
	Is_Preterm_Flag,
	Early_Term_Date,
	Agt_Stat_Cd,
	Main_Oper_User_Id,
	Main_Oper_Name,
	Main_Oper_Emp_Id,
	Intro_Oper_User_Id,
	Intro_Oper_Name,
	Intro_Oper_Emp_Id,
	Intro_Inr_Org_Id_1,
	Intro_Inr_Org_Name_1,
	Div_Org_Id_1,
	Div_Org_Name_1,
	Cust_Mngr_User_Id_1,
	Cust_Mngr_Name_1,
	Cust_Mngr_Emp_Id_1,
	Allo_Prop_1,
	Intro_Inr_Org_Id_2,
	Intro_Inr_Org_Name_2,
	Div_Org_Id_2,
	Div_Org_Name_2,
	Cust_Mngr_User_Id_2,
	Cust_Mngr_Name_2,
	Cust_Mngr_Emp_Id_2,
	Allo_Prop_2,
	Intro_Inr_Org_Id_3,
	Intro_Inr_Org_Name_3,
	Div_Org_Id_3,
	Div_Org_Name_3,
	Cust_Mngr_User_Id_3,
	Cust_Mngr_Name_3,
	Cust_Mngr_Emp_Id_3,
	Allo_Prop_3,
	Accrued_Date,
	Curr_Prvs_Sales_Income,
	Accum_prvs_sales_income,
	Accum_prvs_sales_income_1,
	Accum_prvs_sales_income_2,
	Accum_prvs_sales_income_3,
	Adtnl_Rwd,
	Fee_Rate,
	Fin_Rati,
	Intr_Marg,
	Res_Flag,
	Opt_Fee_Rate,
	Data_Time,
	busi_date FROM (
	 select
    Agt_Id,  --合约编号
    Busi_Type,  --业务类型
    Cutp_Pty_Id,  --交易对手客户编号
    Cutp_Pty_Shor_Name,  --交易对手当事人简称
    Cutp_Pty_Full_Name,  --交易对手当事人名称
    Sign_Prd_Name,  --代签产品名称
    Contr_Type_Cd,  --合约类型代码
    Contr_Type_Desc,  --合约类型描述
    Src_Contr_Type,  --源合约类型
    Src_Contr_Type_Desc,  --源合约类型描述
    Src_Sub_Contr_Type,  --源合约子类型
    Src_Sub_Contr_Type_Desc,  --源合约子类型描述
    Undrl_Wd_Cd,  --WD标的代码
    Undrl_Name,  --标的名称
    Undrl_Type,  --标的类型
    Src_Undrl_Type,  --源标的类型
    Annu_Sprd,  --年化价差
    Absl_Sprd,  --绝对价差
    Annu_Base,  --年化销售费系数
    Absl_Base,  --绝对销售费系数
    Cms_Fee_Rate,  --交易佣金费率
    Init_Nom_Prin,  --初始名义本金
    IF(coalesce(Intro_Oper_User_Id,'') = '', Init_Nom_Prin * 1, Init_Nom_Prin * 0.4) AS Init_Nom_Prin_Main,  --主经办人初始名义本金
    IF(coalesce(Intro_Oper_User_Id,'') = '', Init_Nom_Prin * 0, Init_Nom_Prin * 0.6) AS Init_Nom_Prin_Intro,  --引入经办人初始名义本金
    Dyna_Nom_Prin,  --动态名义本金
    IF(coalesce(Intro_Oper_User_Id,'') = '', Dyna_Nom_Prin * 1, Dyna_Nom_Prin * 0.4) AS Dyna_Nom_Prin_Main,  --主经办人动态名义本金
    IF(coalesce(Intro_Oper_User_Id,'') = '', Dyna_Nom_Prin * 0, Dyna_Nom_Prin * 0.6) AS Dyna_Nom_Prin_Intro,  --引入经办人动态名义本金
    Accum_Dyna_Nom_Prin,  --累计动态名义本金
    Absl_Nom_Prin,  --绝对名义本金
    IF(coalesce(Intro_Oper_User_Id,'') = '', Absl_Nom_Prin * 1, Absl_Nom_Prin * 0.4) AS Absl_Nom_Prin_Main,  --主经办人绝对名义本金
    IF(coalesce(Intro_Oper_User_Id,'') = '', Absl_Nom_Prin * 0, Absl_Nom_Prin * 0.6) AS Absl_Nom_Prin_Intro,  --引入经办人绝对名义本金
    Accum_Absl_Nom_Prin,  --累计绝对名义本金
    Strt_Pric_Date,  --期初定价日
    End_Pric_Date,  --期末定价日
    Earn_Pymt_Date,  --收益兑付日
    IF(Early_Term_Date IS NULL OR Early_Term_Date = '', '0', '1') AS Is_Preterm_Flag,  --是否提前终止标识
    Early_Term_Date,  --提前终止日
    Agt_Stat_Cd,  --协议状态代码
    Main_Oper_User_Id,  --主经办人ID
    Main_Oper_Name,  --主经办人姓名
    Main_Oper_Emp_Id,  --主经办人ERP编号
    Intro_Oper_User_Id,  --引入经办人ID
    Intro_Oper_Name,  --引入经办人姓名
    Intro_Oper_Emp_Id,  --引入经办人ERP编号
    Intro_Inr_Org_Id_1,  --引入部门ID_1
    Intro_Inr_Org_Name_1,  --引入部门名称_1
    Div_Org_Id_1,  --所属分公司ID_1
    Div_Org_Name_1,  --所属分公司名称_1
    Cust_Mngr_User_Id_1,  --客户经理ID_1
    Cust_Mngr_Name_1,  --客户经理姓名_1
    Cust_Mngr_Emp_Id_1,  --客户经理ERP编号_1
    Allo_Prop_1,  --分配比例_1
    Intro_Inr_Org_Id_2,  --引入部门ID_2
    Intro_Inr_Org_Name_2,  --引入部门名称_2
    Div_Org_Id_2,  --所属分公司ID_2
    Div_Org_Name_2,  --所属分公司名称_2
    Cust_Mngr_User_Id_2,  --客户经理ID_2
    Cust_Mngr_Name_2,  --客户经理姓名_2
    Cust_Mngr_Emp_Id_2,  --客户经理ERP编号_2
    Allo_Prop_2,  --分配比例_2
    Intro_Inr_Org_Id_3,  --引入部门ID_3
    Intro_Inr_Org_Name_3,  --引入部门名称_3
    Div_Org_Id_3,  --所属分公司ID_3
    Div_Org_Name_3,  --所属分公司名称_3
    Cust_Mngr_User_Id_3,  --客户经理ID_3
    Cust_Mngr_Name_3,  --客户经理姓名_3
    Cust_Mngr_Emp_Id_3,  --客户经理ERP编号_3
    Allo_Prop_3,  --分配比例_3
    Accrued_Date,  --计提日期
    Curr_Prvs_Sales_Income_n as Curr_Prvs_Sales_Income,  --当日计提销售收入
    default.gfgreatest(sum(coalesce(Curr_Prvs_Sales_Income_n, 0)) over(partition by agt_id,Contr_Type_Cd order by accrued_date),0) as Accum_prvs_sales_income,  --累计计提销售收入
    default.gfgreatest(sum(coalesce(Curr_Prvs_Sales_Income_n * Allo_Prop_1, 0)) over(partition by agt_id,Contr_Type_Cd order by accrued_date),0) as Accum_prvs_sales_income_1,  --累计计提销售收入_1
    default.gfgreatest(sum(coalesce(Curr_Prvs_Sales_Income_n * Allo_Prop_2, 0)) over(partition by agt_id,Contr_Type_Cd order by accrued_date),0) as Accum_prvs_sales_income_2,  --累计计提销售收入_2
    default.gfgreatest(sum(coalesce(Curr_Prvs_Sales_Income_n * Allo_Prop_3, 0)) over(partition by agt_id,Contr_Type_Cd order by accrued_date),0) as Accum_prvs_sales_income_3,  --累计计提销售收入_3
    Adtnl_Rwd,  --额外奖励
    if(Src_Contr_Type in ('RISKY','AIRBAGX'), fee_rate, null) as Fee_Rate,  --成交费率
    if(Src_Contr_Type in ('RISKY','AIRBAGX'), Fin_Rati, null) as Fin_Rati,  --融资比例
    Intr_Marg,  --利差
    Res_Flag,  --限售标志
    Opt_Fee_Rate,  --期权费率
    from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') AS Data_Time,  --数据时间
    '${yyyy-MM-dd}' as busi_date  --业务日期
from (
    select T.*, case
            -- 个股期权、指数/ETF期权考虑保底，保底系数0.1%
            -- 累计实发+当季应发 < 保底应发，取保底应发-累计实发
            when Contr_Type_Cd in('OPTION_STOCK', 'OPTION_IDX_ETF')
                and End_Pric_Date = Accrued_Date
                and coalesce(sum(Curr_Prvs_Sales_Income) over(partition by Agt_Id order by Accrued_Date),0) < Init_Nom_Prin * 0.001
                    then Init_Nom_Prin * 0.001 - coalesce(actl.Dev_Dept_Rwd, 0) - sum(if(Accrued_Date > coalesce(actl.Qtr_End_Date,'2025-03-31'), Curr_Prvs_Sales_Income,0)) over(partition by Agt_Id) + Curr_Prvs_Sales_Income
            else Curr_Prvs_Sales_Income
            end as Curr_Prvs_Sales_Income_n
    from (
        select
            info.Agt_Id,
            info.Busi_Type,
            info.Cutp_Pty_Id,
            info.Cutp_Pty_Shor_Name,
            info.Cutp_Pty_Full_Name,
            info.Sign_Prd_Name,
            info.HK_Contr_Type_Cd as Contr_Type_Cd,
            info.HK_Contr_Type_Desc as Contr_Type_Desc,
            info.Src_Contr_Type,
            info.Src_Contr_Type_Desc,
            info.Src_Sub_Contr_Type,
            info.Src_Sub_Contr_Type_Desc,
            info.Undrl_Wd_Cd,
            info.Undrl_Name,
            info.HK_Undrl_Type as Undrl_Type,
            info.Src_Undrl_Type,
            IF(coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation) = 'ANNUALIZED', coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread), '') AS Annu_Sprd,
            IF(coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation) = 'ABSOLUTE', coalesce(s_sp.Absolute_Spread, c_sp.Absolute_Spread), '') AS Absl_Sprd,
            IF(coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ANNUALIZED', coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE), '') AS Annu_Base,
            IF(coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ABSOLUTE', coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE), '') AS Absl_Base,
            coalesce(s_cr.commission_rate,c_cr.commission_rate) as Cms_Fee_Rate,
            info.Init_Nom_Prin,
            coalesce(det.Dyna_Nom_Prin, 0) as Dyna_Nom_Prin,
            sum(if(det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date), coalesce(det.Dyna_Nom_Prin, 0),0)) over(partition by info.agt_id order by det.busi_date) as Accum_Dyna_Nom_Prin,
            if(info.grp_id = '01', det.Dyna_Nom_Prin, 0) as Absl_Nom_Prin,
            sum(if(det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date), coalesce(det.Dyna_Nom_Prin, 0),0)) over(partition by info.agt_id order by det.busi_date) as Accum_Absl_Nom_Prin,
            case when info.Src_Contr_Type in ('RISKY','AIRBAGX') and Ddct_Ptrn = 'DEDUCTION' then 0  --抵扣则为0
                 when info.Src_Contr_Type in ('RISKY','AIRBAGX') and coalesce(Ddct_Ptrn,'') != 'DEDUCTION' and coalesce(info.Marg_Agt_Id,'') = '' then det.Dyna_Nom_Prin * (1 - Init_Marg_Prop) * (det.fee_rate/1.06 - cc.capital_cost) / 365 * 0.3
                 when info.Src_Contr_Type in ('RISKY','AIRBAGX') and coalesce(Ddct_Ptrn,'') != 'DEDUCTION' and coalesce(info.Marg_Agt_Id,'') != '' then det.Dyna_Nom_Prin * (1 - Base_Marg_Rate) * (det.fee_rate*(1 - Init_Marg_Prop)/(1 - Base_Marg_Rate)/1.06 - cc.capital_cost) /365 *0.3
                 when info.Busi_Type = 'TRS' and info.Src_Contr_Type = 'LONG_HOLD_SWAP' and coalesce(info.Marg_Agt_Id,'') != '' then 0
                 when info.Busi_Type = 'OPTION' and coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ANNUALIZED') = 'ANNUALIZED' and coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ANNUALIZED'
                        then IF(det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date), det.Dyna_Nom_Prin * coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread, 0) / 365 + det.Dyna_Nom_Prin * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0) / 365, 0)
                 when info.Busi_Type = 'OPTION' and coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ANNUALIZED') = 'ANNUALIZED' and coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ABSOLUTE'
                        then IF(det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date), det.Dyna_Nom_Prin * coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread, 0) / 365, 0) + IF(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0), 0)
                 when info.Busi_Type = 'OPTION' and coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ANNUALIZED') = 'ABSOLUTE' and coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ANNUALIZED'
                        then IF(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin * coalesce(s_sp.Absolute_Spread, c_sp.Absolute_Spread,0), 0) + IF(det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date), det.Dyna_Nom_Prin * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0) / 365, 0)
                 when info.Busi_Type = 'OPTION' and coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ANNUALIZED') = 'ABSOLUTE' and coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ABSOLUTE'
                        then IF(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin * coalesce(s_sp.Absolute_Spread, c_sp.Absolute_Spread,0), 0) + IF(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0), 0)
                 when info.Busi_Type = 'TRS' and coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ANNUALIZED') = 'ANNUALIZED' and coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ANNUALIZED'
                        then IF(det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date), if(info.Comp_Usag_Cd = 'REBATE_INTEREST' and info.Src_Contr_Type = 'FEE_SWAP', di.DAILY_BASE_AMOUNT*coalesce(mid.mid_price,1), det.Dyna_Nom_Prin) * coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread, 0) / 365 + if(info.Comp_Usag_Cd = 'REBATE_INTEREST' and info.Src_Contr_Type = 'FEE_SWAP', di.DAILY_BASE_AMOUNT*coalesce(mid.mid_price,1), det.Dyna_Nom_Prin) * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0) / 365 + if(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin, coalesce(evt.Occu_Amt,0) * info.Cny_Ex_Rate) * coalesce(s_cr.commission_rate,c_cr.commission_rate), 0)
                 when info.Busi_Type = 'TRS' and coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ANNUALIZED') = 'ANNUALIZED' and coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ABSOLUTE'
                        then IF(det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date), if(info.Comp_Usag_Cd = 'REBATE_INTEREST' and info.Src_Contr_Type = 'FEE_SWAP', di.DAILY_BASE_AMOUNT*coalesce(mid.mid_price,1), det.Dyna_Nom_Prin) * coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread, 0) / 365 + if(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin, coalesce(evt.Occu_Amt,0) * info.Cny_Ex_Rate) * coalesce(s_cr.commission_rate,c_cr.commission_rate), 0) + IF(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0), 0)
                 when info.Busi_Type = 'TRS' and coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ANNUALIZED') = 'ABSOLUTE' and coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ANNUALIZED'
                        then IF(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin * coalesce(s_sp.Absolute_Spread, c_sp.Absolute_Spread,0), 0) + IF(det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date), if(info.Comp_Usag_Cd = 'REBATE_INTEREST' and info.Src_Contr_Type = 'FEE_SWAP', di.DAILY_BASE_AMOUNT*coalesce(mid.mid_price,1), det.Dyna_Nom_Prin) * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0) / 365 + if(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin, coalesce(evt.Occu_Amt,0) * info.Cny_Ex_Rate) * coalesce(s_cr.commission_rate,c_cr.commission_rate), 0)
                 when info.Busi_Type = 'TRS' and coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ANNUALIZED') = 'ABSOLUTE' and coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ABSOLUTE'
                        then IF(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin * (coalesce(s_sp.Absolute_Spread, c_sp.Absolute_Spread,0) + coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0)), 0) + IF(det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date), if(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin, coalesce(evt.Occu_Amt,0) * info.Cny_Ex_Rate) * coalesce(s_cr.commission_rate,c_cr.commission_rate), 0)
                 END AS Curr_Prvs_Sales_Income,
            info.Strt_Pric_Date,
            coalesce(info.Early_Term_Date, info.End_Pric_Date) as End_Pric_Date,
            info.Early_Term_Date,
            info.Earn_Pymt_Date,
            info.Agt_Stat_Cd,
            m.Main_Oper_User_Id,            
            if(m.Main_Oper_User_Id = 'ruonanlyu', '吕若楠', m.Main_Oper_Name) as Main_Oper_Name,
            m.Main_Oper_Emp_Id,
            m.Intro_Oper_User_Id,
            if(m.Intro_Oper_User_Id= 'ruonanlyu', '吕若楠', m.Intro_Oper_Name) as Intro_Oper_Name,
            m.Intro_Oper_Emp_Id,
            m.Inr_Org_Id_1 as Intro_Inr_Org_Id_1,
            m.Inr_Org_Name_1 as Intro_Inr_Org_Name_1,
            m.Div_Org_Id_1,
            m.Div_Org_Name_1,
            m.Cust_Mngr_User_Id_1,
            m.Cust_Mngr_Name_1,
            m.Cust_Mngr_Emp_Id_1,
            m.Allo_Prop_1,
            m.Inr_Org_Id_2 as Intro_Inr_Org_Id_2,
            m.Inr_Org_Name_2 as Intro_Inr_Org_Name_2,
            m.Div_Org_Id_2,
            m.Div_Org_Name_2,
            m.Cust_Mngr_User_Id_2,
            m.Cust_Mngr_Name_2,
            m.Cust_Mngr_Emp_Id_2,
            m.Allo_Prop_2,
            m.Inr_Org_Id_3 as Intro_Inr_Org_Id_3,
            m.Inr_Org_Name_3 as Intro_Inr_Org_Name_3,
            m.Div_Org_Id_3,
            m.Div_Org_Name_3,
            m.Cust_Mngr_User_Id_3,
            m.Cust_Mngr_Name_3,
            m.Cust_Mngr_Emp_Id_3,
            m.Allo_Prop_3,
            det.busi_date as Accrued_Date,
            coalesce(s_ba.additional_reward,0) as Adtnl_Rwd,
            det.fee_rate,
            1 - info.Init_Marg_Prop as Fin_Rati,
            info.Intr_Marg,
            info.Res_Flag,
            info.Opt_Fee_Rate
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
            select * from PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET
            where busi_date >= '2024-01-01'
            ) det
        on info.agt_id = det.agt_id
        inner join (
            select Pty_Id
            from PDATA_N.T01_OTC_DERI_CUST
            where Src_Tbl = 'ODATA_N_OIS.G_HK_COUNTERPARTY' and busi_date = '${yyyy-MM-dd}'
                and Del_Flag = '0' and Incl_Cs_Income_Flag = '1'
            ) cp
        on info.Cutp_Pty_Id = cp.Pty_Id
        left join (
            select * from odata_n_tit.d_trd_daily_rebate_interest
            where busi_date = '${yyyy-MM-dd}'
            ) di
        on di.KEY_INSTRUMENT_ID = info.Otc_Seri_No and substr(di.calc_date,1,10) = det.busi_date
        left join (
            select default.datekey2date(trd_dt) as trd_dt, src_crrc_cd, mid_price
            from pdata_news_n.t02_fxr_cfets_quot
            where src_id = 'TIT' and grp_id = '01'
            ) mid
        on mid.src_crrc_cd = info.Sett_Crrc_Cd and mid.trd_dt = det.busi_date
        left join (
            select Otc_Comp_Agt_Id, sum(abs(Occu_Qty)*Pric) as Occu_Amt, Evt_Date
            from (
                select a.Otc_Comp_Agt_Id, a.Evt_Date, b.Occu_Qty, b.Pric
                from (
                    select * from PDATA_N.T05_OTC_COMP_DURA_CHG_EVT
                    where src_tbl = 'ODATA_N_TIT.D_TRD_TRS_EVENT' and Evt_Stat_Cd = '3'
                        and Evt_Type_Cd in ('NEW_CONTRACT','CLOSE_STOCKS','EARLY_TERMINATION','TERMINATION')
                        and Evt_Date >= '2024-01-01'
                    ) a
                left join (
                    select * from PDATA_N.T05_OTC_SWAP_COMP_HOLD_CHG_DET
                    where SRC_TBL = 'ODATA_N_TIT.D_TRD_TRS_EVENT_STRUC_DETAIL'
                    ) b
                on b.Dura_Chg_Src_Id = a.Src_Id and b.Swap_Comp_Agt_Id = a.Otc_Comp_Agt_Id
                union all
                select Otc_Comp_Agt_Id, Trd_Date as Evt_Date, Chg_Vol as Occu_Qty, Mtch_Full_Pric as Pric
                from PDATA_N.T05_OTC_COMP_DURA_CHG_EVT
                where src_tbl = 'ODATA_N_TIT.D_TRD_FAST_TRS_EVENT'
                    and Src_Trd_Dir_Cd in ('SHORT_CLOSE','SHORT_OPEN','SELL','BUY')
                    and upper(Evt_Type_Cd) in ('OPEN','CLOSE_PARTIAL','CLOSE_TERMINATE')
                ) t
            group by Otc_Comp_Agt_Id, Evt_Date
            ) evt
        on evt.Otc_Comp_Agt_Id = info.Inr_Seri_No and evt.Evt_Date = det.busi_date
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
                from (
                    select * from PDATA_N.T99_DERI_COMP_SPRD_COEF_REF
                    where src_tbl = 'ODATA_N_OIS.O_CONTRACT_SPREAD_RATE' and Del_Flag = '0'
                        and coalesce(Coef_Type, '') != 'INR' and Agt_Id != ''
                    ) a
                inner join (
                    select * from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
                    where busi_date = '${yyyy-MM-dd}' and coalesce(Early_Term_Date, End_Pric_Date) >= '2025-12-01'
                        and book_name in ('OTCHK-互换-ISDA','OTCHK-互换-ISDA（费用）','OTCHK-返息费用','OTCHK-Option-北上跨境','OTCHK-Option-B2B','OTCHK-Option-ISDA')
                    ) b
                on a.Inr_Comp_No = b.Agt_Id
                ) x
            lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
            ) s_sp
        on s_sp.CONTRACT_CODE = info.Agt_Id and s_sp.busi_date = det.busi_date
        left join (
            select
                client_id,
                business_type,
                underlying_type,
                Spread_Calculation,
                Annualized_Spread,
                Absolute_Spread,
                date_add(strt_date, pos) as busi_date
            from (
                select
                    client_id as client_id,
                    business_type,
                    underlying_type,
                    if(spread_calc_type = '', null, spread_calc_type) as Spread_Calculation,
                    annualized_spread as Annualized_Spread,
                    absolute_spread as Absolute_Spread,
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
            select
                contract_code,
                commis_calc_type,
                commission_rate,
                date_add(strt_date, pos) as busi_date
            from (
                select
                    contract_code,
                    commis_calc_type,
                    commission_rate,
                    effective_date as strt_date,
                    date_sub(lead(effective_date, 1, date_add('${yyyy-MM-dd}', 1)) over(partition by contract_code order by effective_date), 1) as end_Date
                from odata_n_ois.g_rev_hk_contract_commission_rate
                where busi_date = '${yyyy-MM-dd}' and is_deleted = 'N'
                ) x
            lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
            ) s_cr
        on s_cr.contract_code = info.Agt_Id and s_cr.busi_date = det.busi_date
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
                Base_Yield as base_award_rate,
                if(Adtnl_Rwd = '', 0, Adtnl_Rwd) as additional_reward,
                Adtnl_Rwd_Flag as have_additional_reward
            from PDATA_N.T99_DERI_COMP_BASE_COEF_REF
            where src_tbl = 'ODATA_N_OIS.O_CONTRACT_BASE_RATE' and Del_Flag = '0' and Agt_Id != ''
            ) s_ba
        on s_ba.CONTRACT_CODE = info.Agt_Id
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
            select
                business_type,
                contract_type,
                underlying_type,
                capital_cost,
                date_add(strt_date, pos) as busi_date
            from (
                select
                    business_type,
                    contract_type,
                    underlying_type,
                    capital_cost,
                    if(start_date = '2023-01-01','2024-01-01',start_date) as strt_date,
                    if(end_date = '2999-12-31','${yyyy-MM-dd}',end_date) as end_Date
                from ODATA_N_OIS.G_REV_HK_CAPITAL_COST
                where busi_date = '${yyyy-MM-dd}' and is_deleted = 'N'
                ) x
            lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
            ) cc
        on cc.contract_type = info.HK_Contr_Type_Cd and cc.underlying_type = info.HK_Undrl_Type and cc.busi_date = info.Strt_Pric_Date
        left join (
            select * from PDATA_N.T98_OTC_COMP_MNG_RELA_INFO
            where busi_Date = '${yyyy-MM-dd}'
            ) m
        on m.Agt_Id = info.Agt_Id
        where coalesce(if(m.Inr_Org_Id_1 = '', '8846', m.Inr_Org_Id_1), '8846') != '8846' or coalesce(if(m.Inr_Org_Id_2 = '', '8846', m.Inr_Org_Id_2), '8846') != '8846' or coalesce(if(m.Inr_Org_Id_3 = '', '8846', m.Inr_Org_Id_3), '8846') != '8846'
        ) T
    left join(
        -- 累计实发收入
        select
            contract_no as Contr_Id,
            sum(EXPANSION_DEPT_INCOME) as Dev_Dept_Rwd,
            max(ACCOUNTING_END_DATE) as Qtr_End_Date
        from odata_n_ois.g_rev_hk_cross_income_reward
        where busi_date = '${yyyy-MM-dd}'-- and src_tbl = 'ODATA_N_OIS.G_CROSS_INCOME_REWARD'
            and ACCOUNTING_DATE >= '202502' and ACCOUNTING_DATE < concat('${yyyy}0', quarter('${yyyy-MM-dd}'))
        group by contract_no
        ) actl
    on t.Agt_Id = actl.Contr_Id and actl.Qtr_End_Date < t.End_Pric_Date 
    ) X 
	) castTable