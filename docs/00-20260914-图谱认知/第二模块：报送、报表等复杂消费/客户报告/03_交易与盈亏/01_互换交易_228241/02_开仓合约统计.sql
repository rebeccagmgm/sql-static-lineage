-- 输入：DM_OTC_N.OTC_REV_DAILY_RPT 场外衍生品合约创收日报。
-- Agt_Id=合约号；Init_Nom_Prin=初始本金；Accrued_Date=计提日；Strt_Pric_Date=期初定价日。
-- 每条起始日记录展开近一年/历史标签后按各标签筛选，无grp_id限制。
-- COUNT DISTINCT按合约去重，但AVG/SUM不去重；重复开仓行会改变金额而不改变笔数。

    -- 主查询：按公司+时间区间统计交易基本信息
    SELECT
        Cutp_Pty_Full_Name as company_name
        ,USCC as company_id
        ,time_period
        ,count(distinct Agt_Id) as trd_count           -- 交易笔数
        ,avg(Init_Nom_Prin) as avg_trd_amount          -- 单笔平均交易规模
        ,sum(Init_Nom_Prin) as total_init_nom           -- 总期初名义本金
        ,min(Accrued_Date) as min_accrued_date          -- 公司级实际计提开始日期（历史区间用）
    from DM_OTC_N.OTC_REV_DAILY_RPT
    -- 展开时间区间：近一年、历史
    lateral view explode(array('近一年', '历史')) t as time_period
    where busi_date = '${yyyy-MM-dd}'
      and Busi_Type = 'TRS'                      -- 筛选互换业务
      and Accrued_Date = Strt_Pric_Date          -- 只统计新开仓交易
      -- 根据时间区间筛选计提日期
      and ((time_period = '近一年' and Accrued_Date between '${yyyy,-1y}-01-01' and '${yyyy-MM-dd}')
           or (time_period = '历史' and Accrued_Date <= '${yyyy-MM-dd}'))
    group by USCC, Cutp_Pty_Full_Name, time_period
