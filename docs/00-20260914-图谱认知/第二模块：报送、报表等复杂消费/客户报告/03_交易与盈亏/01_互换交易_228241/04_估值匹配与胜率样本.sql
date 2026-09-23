-- r=创收日报开仓记录；s=T98_OTC_DERI_COMP_SALE_INFO 合约主信息；v=05按合约内部号聚合的腿估值。
-- 两次INNER JOIN：缺主合约或估值的记录不进入胜率分母，但可能仍进入02本金分母。
-- 本模块按USCC+期间聚合，没有客户名分组；分子盈利行数，分母不同Agt_Id，未做一合约一行保证。

    -- 计算交易胜率和收益率所需数据
    SELECT
        USCC as company_id
        ,time_period
        ,count(distinct Agt_Id) as total_count          -- 客户合约数
        ,sum(case when pnl > 0 then 1 else 0 end) as win_count  -- 盈亏>0的交易总数
        ,sum(pnl) as total_pnl                          -- 总收益金额
    from (
        SELECT
            r.USCC
            ,r.Agt_Id
            ,time_period
            ,v.pnl
        from DM_OTC_N.OTC_REV_DAILY_RPT r
        -- 关联合约基本信息表，获取内部流水号
        inner join pdata_n.T98_OTC_DERI_COMP_SALE_INFO s
            on r.Agt_Id = s.Agt_Id
            and s.busi_date = '${yyyy-MM-dd}'
            and s.grp_id = '02'  -- 互换业务分组
        -- 关联互换合约估值信息表，获取盈亏数据
        inner join (
-- @include 05_互换估值汇总.sql

        ) v on s.Inr_Seri_No = v.Swap_Comp_Agt_Id
        lateral view explode(array('近一年', '历史')) t as time_period
        where r.busi_date = '${yyyy-MM-dd}'
          and r.Busi_Type = 'TRS'
          and r.Accrued_Date = r.Strt_Pric_Date
          and ((time_period = '近一年' and r.Accrued_Date between '${yyyy,-1y}-01-01' and '${yyyy-MM-dd}')
               or (time_period = '历史' and r.Accrued_Date <= '${yyyy-MM-dd}'))
    ) t
    group by USCC, time_period
