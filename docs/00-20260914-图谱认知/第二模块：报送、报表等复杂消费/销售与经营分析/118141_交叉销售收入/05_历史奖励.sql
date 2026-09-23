/*
用途：为04提供actl.Dev_Dept_Rwd（历史部门所得收入合计）及actl.Qtr_End_Date（最大核算结束日）。
来源：T98_OTC_DERI_UNDRL_INCOME_RWD_SUM，场外衍生品收入奖励汇总。
按Contr_Id汇总，不按人员机构输出。WHERE按本次加工日、OIS来源及结算期筛选。
只连接核算截止日早于当前合约结束日的结果；无匹配时04将金额补0、核算截止日回退2025-03-31。
这是原SQL的历史奖励输入，不在此生成上游奖励记录；08解释其生产。
*/

left join(
    -- 原注释称“累计实发收入”；实际SUM部门所得收入，未核实资金支付。
    select
        Contr_Id,
        sum(Dev_Dept_Rwd) as Dev_Dept_Rwd,
        max(Sett_End_Date) as Qtr_End_Date
    from PDATA_N.T98_OTC_DERI_UNDRL_INCOME_RWD_SUM
    where busi_date = '${yyyy-MM-dd}' and src_tbl = 'ODATA_N_OIS.G_CROSS_INCOME_REWARD'
        -- 本例2026年第三季度加工，上限202603；本季核算码不纳入，202502为固定下限。
        and Sett_Time >= '202502' and Sett_Time < concat('${yyyy}0', quarter('${yyyy-MM-dd}'))
    group by Contr_Id
    ) actl
on t.Agt_Id = actl.Contr_Id and actl.Qtr_End_Date < t.End_Pric_Date
