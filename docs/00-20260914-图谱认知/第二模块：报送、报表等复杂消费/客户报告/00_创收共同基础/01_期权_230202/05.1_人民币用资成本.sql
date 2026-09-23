-- 人民币用资成本：OIS客户创收系数，取AIRBAGX / CAPITAL_COST / CNY并按生效区间展开。
-- 本文件提供co_c查询体；外层JOIN与ON在00主脚本，实际公式继续在收入模块。
--人民币用资利率
    select
        value as CAPITAL_COST,
        date_add(strt_date, pos) as busi_date
    from (
        select
            value,
            effective_date as strt_date,
            date_sub(lead(effective_date, 1, date_add('${yyyy-MM-dd}', 1)) over(order by effective_date), 1) as end_Date
        from odata_n_ois.g_client_revenue_coefficient
        where busi_date = '${yyyy-MM-dd}' and is_del = 'N' and contract_type = 'AIRBAGX' and coefficient_type = 'CAPITAL_COST' and currency = 'CNY'
        ) x
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
