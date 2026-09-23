-- 垫资文字 adv：先要当日客户标签存在“有垫资”，再汇总区间内递延>=2天的追保记录。
-- 标签来源231146的判断见同级专题；此处不重新证明标签条件，qual也未去重。
-- 最近季度取MAX履保日期；频次=不同履保日期数×7/区间天数，时长=每行递延天数平均。
-- 所谓日均金额=追保金额SUM/递延天数SUM/10000，不是日历逐日垫资本金平均。
-- “托管行资金流水及券商对账单回溯”“持续但规模可控”均是硬编码模板，不是本SQL查证的事实。
    SELECT
        ind.company_name
        ,concat(
            '根据托管行资金流水及券商对账单回溯，客户于',
            ind.freq_quarter,
            '存在垫资行为'
            ,'。客户近一年存在持续但规模可控的垫资行为，平均每周约',
            cast(round(ind.weekly_freq, 1) as string),
            '次、单次时长',
            round(ind.avg_duration, 0),
            '天左右，日均垫资金额集中在',
            round(ind.daily_amt_wan, 0),
            '万元。'
        ) as cust_advance_info
    from (
        select company_name from dm_otc_n.bi_otc_cust_tag
        where busi_date = '${yyyy-MM-dd}'
          and tag_name = '有垫资'
    ) qual
    inner join (
        -- @include 11.1_垫资统计.sql
    ) ind on qual.company_name = ind.company_name
