/*
输入：raw_daily_income（原始收入）+ paid_reward_by_contract（已发奖励汇总）。
输出：adjusted_daily_income；新增Curr_Prvs_Sales_Income_n，原始收入列仍保留。

两条调整路：
  金仕达 → 同类同日原始收入占比 × 150万 / 365 × 50%，从该行收入扣除。
  个股/指数ETF期权 → 仅结束日检查累计原始收入是否低于初始本金×0.1%。
    满足时，当天改为：保底总额 - 已发奖励 - 截止日后整段原始收入 + 当天原始收入。
    最后一项是加回当天，避免当天被减两次。
其他行不调整。它不是“每天至少赚0.1%”。

注意两类累计：触发条件是截至该日的窗口；扣减项是合约整段窗口（没有ORDER BY）。
原SQL的默认截止日2025-03-31、结算期下限202502都原样保留。
*/
-- T98_OTC_DERI_UNDRL_INCOME_RWD_SUM：奖励汇总输入；按当前加工日取历史结算期记录。
paid_reward_by_contract AS (
    -- 累计实发收入
    select
        Contr_Id,
        sum(Dev_Dept_Rwd) as Dev_Dept_Rwd,
        max(Sett_End_Date) as Qtr_End_Date
    from PDATA_N.T98_OTC_DERI_UNDRL_INCOME_RWD_SUM
    where busi_date = '${yyyy-MM-dd}' and src_tbl = 'ODATA_N_OIS.G_CROSS_INCOME_REWARD'
        and Sett_Time >= '202502' and Sett_Time < concat('${yyyy}0', quarter('${yyyy-MM-dd}'))
    group by Contr_Id
)
,
adjusted_daily_income AS (
    select T.*,
        case
            --金仕达分摊150万的系统费用
            when Contr_Type_Cd = 'TRS_KINGSTAR_SWAP' then Curr_Prvs_Sales_Income - Curr_Prvs_Sales_Income/sum(Curr_Prvs_Sales_Income) over(partition by Contr_Type_Cd, Accrued_Date) * 1500000 / 365 * 0.5
            -- 个股期权、指数/ETF期权考虑保底，保底系数0.1%
            -- 累计实发+当季应发 < 保底应发，取保底应发-累计实发
            when Contr_Type_Cd in('OPTION_STOCK', 'OPTION_IDX_ETF')
                and End_Pric_Date = Accrued_Date
                and coalesce(sum(Curr_Prvs_Sales_Income) over(partition by Agt_Id order by Accrued_Date),0) < Init_Nom_Prin * 0.001
                    then Init_Nom_Prin * 0.001 - coalesce(actl.Dev_Dept_Rwd, 0) - sum(if(Accrued_Date > coalesce(actl.Qtr_End_Date,'2025-03-31'), Curr_Prvs_Sales_Income,0)) over(partition by Agt_Id) + Curr_Prvs_Sales_Income
            else Curr_Prvs_Sales_Income
            end as Curr_Prvs_Sales_Income_n
    from raw_daily_income T
    left join paid_reward_by_contract actl
    on t.Agt_Id = actl.Contr_Id and actl.Qtr_End_Date < t.End_Pric_Date
)
