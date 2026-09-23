-- 在这里输出频率、平均规模、胜率、收益率；不在此重新生成样本。
-- t1来自创收日报起始日记录；t3来自这些记录与当前主合约、当前腿估值的内连接。
-- 所有除法保持原式，未加零分母保护；频率不是简单除52。
SELECT
    t1.company_name                    -- 公司名称
    ,t1.company_id                     -- 公司ID
    ,t1.time_period                    -- 时间区间（近一年/历史）
    -- 每周交易频率 = 交易笔数 / 周数
    -- 标签“近一年”的分母实际从上年1月1日算到报告日，不是本年年初。
    -- 历史：从本快照入选开仓记录的最早日期算到报告日，不证明真实首次交易。
    ,t1.trd_count / case when t1.time_period = '近一年' 
                          then datediff('${yyyy-MM-dd}', '${yyyy,-1y}-01-01') / 7.0
                          else datediff('${yyyy-MM-dd}', t1.min_accrued_date) / 7.0 end as weekly_trd_freq  -- 每周交易频率(笔)
    ,t1.avg_trd_amount                 -- 单笔平均交易规模
    -- 胜率分子数盈利匹配行；分母数估值匹配后的不同合约。重复匹配时口径并不等价。
    ,t3.win_count / t3.total_count as trd_win_rate  -- 交易胜率
    -- 收益率分子来自t3估值匹配样本；分母来自t1全部入选开仓行，不保证同一集合。
    ,t3.total_pnl / t1.total_init_nom as yield_rate  -- 收益率
    ,t2.swap_first_trd_type            -- 互换业务笔数第一业务类型
    ,t2.swap_second_trd_type           -- 互换业务笔数第二业务类型
    ,t2.swap_first_trd_count           -- 互换业务第一交易笔数
    ,t2.swap_second_trd_count          -- 互换业务第二交易笔数
    ,'${yyyy-MM-dd}' as busi_date      -- 业务日期
