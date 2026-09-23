/*
输入：主脚本T=第一阶段contract_day_income，actl=05按合约汇总的历史部门所得收入。
输出：Curr_Prvs_Sales_Income_n（调整后的当日收入），进入06分配和累计。

金仕达：按“该类型全部合约同一天的原始收入总和”分摊，不是本合约累计。
  分母为0/NULL时原式没有保护，不能把结果想成固定每合约扣同一笔。
期权保底：判断累计原始收入是否小于初始本金×0.001；仅结束日替换当天金额。
  结束日T.End_Pric_Date已在01优先取提前终止日，NULL才回退原期末日。
  公式减历史部门所得收入，再减核算截止日之后全分区的原收入，最后加回当天原收入；
  没有GREATEST保底下限，不能保证调整当天一定非负。
*/

case
--金仕达分摊150万的系统费用
when Contr_Type_Cd = 'TRS_KINGSTAR_SWAP'
    THEN Curr_Prvs_Sales_Income
        - Curr_Prvs_Sales_Income/sum(Curr_Prvs_Sales_Income) over(partition by Contr_Type_Cd, Accrued_Date)
            * 1500000 / 365 * 0.5
-- 个股期权、指数/ETF期权考虑保底，保底系数0.1%
-- 判断条件实际比较“累计原始收入”，不是原注释所说的“累计实发+当季应发”。
when Contr_Type_Cd in('OPTION_STOCK', 'OPTION_IDX_ETF')
    and End_Pric_Date = Accrued_Date
    and coalesce(sum(Curr_Prvs_Sales_Income) over(partition by Agt_Id order by Accrued_Date),0) < Init_Nom_Prin * 0.001

    THEN Init_Nom_Prin * 0.001
        - coalesce(actl.Dev_Dept_Rwd, 0)
        - sum(if(Accrued_Date > coalesce(actl.Qtr_End_Date,'2025-03-31'), Curr_Prvs_Sales_Income,0)) over(partition by Agt_Id)
        + Curr_Prvs_Sales_Income
else Curr_Prvs_Sales_Income
end as Curr_Prvs_Sales_Income_n
