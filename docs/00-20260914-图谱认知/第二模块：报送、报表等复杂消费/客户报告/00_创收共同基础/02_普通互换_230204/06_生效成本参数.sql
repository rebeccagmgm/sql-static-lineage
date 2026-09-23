-- OIS客户创收系数，仅S_CROSS_SWAP与LONG_HOLD_SWAP、报告日快照、is_del=N。
-- 每个合约类型+系数类型按effective_date排列，下一次生效日前一天结束；逐日展开后透视为5列。
-- 有该类型/日期分组但缺某系数：SUM(CASE...ELSE0)可得到0；整个co行未匹配则五项都NULL，不能混同。
-- 同日重复有效配置未去重，也无币种筛选；存在重复时先后与SUM结果需实数核验。
-- S_CROSS_OPTION_SWAP映射到S_CROSS_SWAP参数，其余保留原类型；按det计提日而非报告日匹配。
-- 本文件提供co查询体；外层JOIN与ON在00主脚本，实际公式继续在收入模块。
select
        contract_type,
        sum(case when coefficient_type = 'FUND_COST_RATE' then value else 0 end) as FUND_COST_RATE,
        sum(case when coefficient_type = 'SPREAD' then value else 0 end) as SPREAD,
        sum(case when coefficient_type = 'MARGIN_FIXED_RATE' then value else 0 end) as MARGIN_FIXED_RATE,
        sum(case when coefficient_type = 'FIXED_RATE' then value else 0 end) as FIXED_RATE,
        sum(case when coefficient_type = 'COMMISSION_COST' then value else 0 end) as COMMISSION_COST,
        busi_date
    from (
        select
            contract_type,
            coefficient_type,
            value,
            date_add(strt_date, pos) as busi_date
        from (
            select
                contract_type,
                coefficient_type,
                value,
                effective_date as strt_date,
                date_sub(lead(effective_date, 1, date_add('${yyyy-MM-dd}', 1)) over(partition by contract_type,coefficient_type order by effective_date), 1) as end_Date
            from odata_n_ois.g_client_revenue_coefficient
            where busi_date = '${yyyy-MM-dd}' and is_del = 'N' and contract_type in ('S_CROSS_SWAP','LONG_HOLD_SWAP')
            ) x
        lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
        ) t
    group by contract_type, busi_date
