-- 输入contract_day_income原始收入；输出同一行加Curr_Prvs_Sales_Income_n，交06分配累计。
-- 仅OPTION_STOCK/OPTION_IDX_ETF在结束日判断保底；香港无金仕达系统费用调整分支。
-- 第一个SUM按计提日累计；第二个SUM无ORDER BY，取当前合同整个输入分区的截止日后金额。
-- 结束日已由01改成提前终止日优先。此式替换结束日收入，不是再额外加一笔保底。
SELECT T.*, CASE
    -- 个股期权、指数/ETF期权考虑保底，保底系数0.1%
    -- 下方实际触发条件只比较原始累计与0.1%本金；不要用这条源注释概括成历史+当期的比较。
    when Contr_Type_Cd in('OPTION_STOCK', 'OPTION_IDX_ETF')
        and End_Pric_Date = Accrued_Date
        and coalesce(sum(Curr_Prvs_Sales_Income) over(partition by Agt_Id order by Accrued_Date),0) < Init_Nom_Prin * 0.001
            then Init_Nom_Prin * 0.001
             - coalesce(actl.Dev_Dept_Rwd, 0)
             - sum(if(Accrued_Date > coalesce(actl.Qtr_End_Date,'2025-03-31'), Curr_Prvs_Sales_Income,0)) over(partition by Agt_Id)
             + Curr_Prvs_Sales_Income
    else Curr_Prvs_Sales_Income
    end as Curr_Prvs_Sales_Income_n
FROM contract_day_income T
LEFT JOIN (
    -- 源SQL称“累计实发”，元数据实际是“拓展方部门所得收入（元）”，不证明付款事实。
    -- 香港在这里直接读OIS奖励源，没有经过交叉收入的203358汇总表。
    -- 金额SUM与结束日MAX分别聚合；最大核算结束日早于本层合约结束日时，整份汇总才接入。
    SELECT
        contract_no AS Contr_Id,
        sum(EXPANSION_DEPT_INCOME) AS Dev_Dept_Rwd,
        max(ACCOUNTING_END_DATE) AS Qtr_End_Date
    FROM odata_n_ois.g_rev_hk_cross_income_reward
    WHERE busi_date = '${yyyy-MM-dd}'
        AND ACCOUNTING_DATE >= '202502'
        AND ACCOUNTING_DATE < concat('${yyyy}0', quarter('${yyyy-MM-dd}'))
    GROUP BY contract_no
) actl
ON t.Agt_Id = actl.Contr_Id AND actl.Qtr_End_Date < t.End_Pric_Date
