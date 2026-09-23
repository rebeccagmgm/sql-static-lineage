/*
两种价差输入，不在这里选出最终比例：
  合约级：按内部合约号 + 每个计提日匹配，允许合约存续中更换系数。
  客户级：按客户 + 合约类型 + 合约开始日匹配，选定的是开仓时适用规则。
04才把两者接到同一行，并逐项做COALESCE；不能理解为整行二选一。
ANNUALIZED=年化，ABSOLUTE=绝对；比例不在这里除100。
*/
-- T99_DERI_COMP_SPRD_COEF_REF：合约价差系数。
-- 下一生效日前一天为本段结束日；最后一段延续到加工日。
contract_spread_days AS (
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
        where src_tbl = 'ODATA_N_OIS.O_CONTRACT_SPREAD_RATE' and Del_Flag = '0' and coalesce(Coef_Type, '') != 'INR' and Agt_Id != ''
        ) x
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
)
,
-- T99_DERI_CUTP_COMP_TYPE_SPRD_COEF_REF：客户/合约类型价差系数。
-- 展开的是“合约开始日适用区间”，不是再次展开每份合约的计提日。
customer_spread_days AS (
    select
        CLIENT_ID,
        CONTRACT_TYPE,
        CONTRACT_TYPE_NAME,
        Spread_Calculation,
        Annualized_Spread,
        Absolute_Spread,
        date_add(strt_date, pos) as busi_date
    from (
        select
            Pty_Id as CLIENT_ID,
            Src_Comp_Type_Cd as CONTRACT_TYPE,
            Src_Comp_Type_Desc as CONTRACT_TYPE_NAME,
            if(Calc_Type = '', null, Calc_Type) as Spread_Calculation,
            Annu_Sprd_Coef as Annualized_Spread,
            Absl_Sprd_Coef as Absolute_Spread,
            if(Bgng_Prcg_Date_Llmt = '1900-01-01','2019-01-01',Bgng_Prcg_Date_Llmt) as strt_date,
            if(Bgng_Prcg_Date_Ulmt = '2999-12-31','${yyyy-MM-dd}',Bgng_Prcg_Date_Ulmt) as end_Date
        from PDATA_N.T99_DERI_CUTP_COMP_TYPE_SPRD_COEF_REF
        where src_tbl = 'ODATA_N_OIS.O_CTPTY_CROSS_SELL_COEFFICIENT' and Del_Flag = '0'
        ) x
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
)
