-- 输入03每个管理人每个有记录月份的候选履保日期数。
-- ROWS 2 PRECEDING是最近至多3行，不保证连续3个自然月；一个月已3天同样可命中。
-- 只有本分支SELECT DISTINCT去重管理人标签，00 UNION ALL不会替其他分支全局去重。
    SELECT distinct
        t2.company_name
        ,t2.company_id
        ,'有垫资' as tag_name
        ,null as rn
    from (
        select
            t1.company_name
            ,t1.company_id
            ,t1.mon
            ,t1.month_cnt
            ,sum(t1.month_cnt) over(
                partition by t1.company_name, t1.company_id 
                order by t1.mon 
                rows between 2 preceding and current row           -- 最近至多3个有记录月份，未补自然月
            ) as rolling_3mon_cnt                                 -- 记录月份窗口累计次数
        from (
            -- Step1: 交易对手(Pty_Id)→T01链路→管理人(c.ORG_FULL_NAME_CH)
            --       筛选 Defr_Days>=2 的记录 → 按 (公司,月份) 聚合
            --       统计原始Perf_Marg_Date不同值，未截成自然日；相同字段值的多交易对手记录只计一次
-- @include 03_垫资按月计数.sql

        ) t1
    ) t2
    where t2.rolling_3mon_cnt >= 3                               -- 存在任意记录月份窗口累计>=3次
