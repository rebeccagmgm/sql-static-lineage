-- 结束合约创收正值占比 t1（输出沿用 cust_hold_win_rate 名称）。
-- 先按公司名+USCC+合约 Agt_Id 汇总区间 Curr_Rev（我司创收），再数合计>0的组/全部组。
-- 结束日=COALESCE(提前终止日,到期计价日)，<=报告日即入围；不查状态，也不是客户投资盈亏。
-- 本模块不筛 grp；NULL创收不算正，但该合约组仍进COUNT。按名+证件分组，外层却只按USCC连接。
    -- 阶段三：客户级正值合约组数 / 全部结束合约组数 → 14统一输出。
    SELECT
        t.company_name
        ,t.company_id
        ,sum(case when t.contract_rev > 0 then 1 else 0 end) / count(*) as cust_hold_win_rate
    from (
        -- 阶段二：同公司名+USCC+合约跨计提日累加，得到一份合约的区间创收。
        SELECT
            Cutp_Pty_Full_Name as company_name
            ,USCC as company_id
            ,Agt_Id
            ,sum(cast(Curr_Rev as double)) as contract_rev
        from DM_OTC_N.OTC_REV_DAILY_RPT
        -- 阶段一：从报告日创收快照选择区间内、结束日期不晚于报告日的样本。
        where busi_date = '${yyyy-MM-dd}'
          and Accrued_Date between '${yyyy,-1y}-01-01' and '${yyyy-MM-dd}'
          and coalesce(Early_Term_Date, End_Pric_Date) <= '${yyyy-MM-dd}'
        group by USCC, Cutp_Pty_Full_Name, Agt_Id
    ) t
    group by t.company_name, t.company_id
