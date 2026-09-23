-- 两路都读取OIS客户创收系数g_client_revenue_coefficient，不是销售经营系数的T99。
-- co：非CNY气囊CAPITAL_COST配置；按币种分组，把生效日到下次生效日前一日展开为逐日参数。
-- co_c人民币配置另见05.1_人民币用资成本.sql；两者独立在00连接，不在本文件合并。
-- 当前报告日快照中is_del=N、contract_type=AIRBAGX；最终按明细日匹配，co还按HKD/OTHER映射匹配。
-- 最后一条配置展开至报告日。生效日当天切到新值，不是沿用旧值到当天结束。
-- 无默认值、无同生效日去重；缺配置会传播NULL，同日多条的先后仍不确定。
-- 本文件提供co查询体；外层JOIN与ON在00主脚本，实际公式继续在收入模块。
--美股、港股安全垫利率
    select
        currency,
        value as CAPITAL_COST,
        date_add(strt_date, pos) as busi_date
    from (
        select
            currency,
            value,
            effective_date as strt_date,
            date_sub(lead(effective_date, 1, date_add('${yyyy-MM-dd}', 1)) over(partition by currency order by effective_date), 1) as end_Date
        from odata_n_ois.g_client_revenue_coefficient
        where busi_date = '${yyyy-MM-dd}' and is_del = 'N' and contract_type = 'AIRBAGX' and coefficient_type = 'CAPITAL_COST' and currency != 'CNY'
        ) x
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
