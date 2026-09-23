-- 来源：ODATA_N_OIS.G_CLIENT_REVENUE_COEFFICIENT，客户创收参数；不是销售资金成本参数表。
-- 取报告日快照中未删除的 KS_LONG_SHORT_SWAP / FUND_COST_RATE 配置。
-- 本次 effective_date 起，覆盖至下次生效日前一天；最后一条截止报告日，展开成每天的 fc.fund_cost_rate。
-- 原窗口仅 order by effective_date，没有币种分组、同日去重或对重复日期的次级排序。
-- 缺少整条日期参数时，LEFT JOIN后的利率是NULL；创收公式没有把利率补成0。
select
        value as fund_cost_rate,
        date_add(strt_date, pos) as busi_date
    from (
        select
            value,
            effective_date as strt_date,
            date_sub(lead(effective_date, 1, date_add('${yyyy-MM-dd}', 1)) over(order by effective_date), 1) as end_Date
        from odata_n_ois.g_client_revenue_coefficient
        where busi_date = '${yyyy-MM-dd}' and is_del = 'N' and contract_type = 'KS_LONG_SHORT_SWAP' and coefficient_type = 'FUND_COST_RATE'
        ) x
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val

