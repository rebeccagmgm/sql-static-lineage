/*
基准和资金成本不是同一种输入：
  合约基准 ─┐
            ├→ 04逐项优先选择 → 05普通业务的基准收入
  类型基准 ─┘
  类型资金成本 → 04匹配 → 06气囊/金仕达公式扣成本
本模块没有把成本从所有业务收入中统一扣一次。

合约基准按合约号连接，没有日期条件。
类型基准、类型成本按合约类型 + 合约开始日连接，不按每个计提日重选。
*/
-- T99_DERI_COMP_BASE_COEF_REF：合约基准系数；附加奖励也由此带出。
contract_baselines AS (
    select
        Inr_Comp_No as Contract_Code,
        Calc_Type as BASE_CALCULATION,
        Base_Yield as BASE_AWARD_RATE,
        if(Adtnl_Rwd = '', 0, Adtnl_Rwd) as additional_reward,
        Adtnl_Rwd_Flag as have_additional_reward
    from PDATA_N.T99_DERI_COMP_BASE_COEF_REF
    where src_tbl = 'ODATA_N_OIS.O_CONTRACT_BASE_RATE' and Del_Flag = '0' and Agt_Id != ''
)
,
-- T99_DERI_COMP_TYPE_BASE_COEF_REF：合约类型基准系数。
type_baseline_days AS (
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
)
,
-- T99_DERI_COMP_TYPE_FND_COST_REF：合约类型资金成本。
type_cost_days AS (
    select
        CONTRACT_TYPE,
        CAPITAL_COST,
        date_add(strt_date, pos) as busi_date
    from (
        select
            Src_Comp_Type_Cd as CONTRACT_TYPE,
            Fnd_Cost as CAPITAL_COST,
            if(Intr_Strt_Date = '1900-01-01','2019-01-01',Intr_Strt_Date) as strt_date,
            if(Intr_End_Date = '2999-12-31','${yyyy-MM-dd}',Intr_End_Date) as end_Date
        from PDATA_N.T99_DERI_COMP_TYPE_FND_COST_REF
        where src_tbl = 'ODATA_N_OIS.G_BUS_TYPE_CAPITAL_COST' and Del_Flag = '0' and Src_Dept_No = 'OTC'
        ) x
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
)
