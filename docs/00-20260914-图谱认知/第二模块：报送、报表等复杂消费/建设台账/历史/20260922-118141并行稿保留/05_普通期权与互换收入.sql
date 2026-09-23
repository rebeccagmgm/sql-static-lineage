/*
输入：04的contract_day_inputs；输出：ordinary_income_rows，增加ordinary_daily_income。
先只读前四段期权，四种组合看懂后，互换使用同样的组合。

年化项 = 当日动态本金 × 年化比例 / 365（开始日至结束日，含两端）
绝对项 = 初始本金 × 绝对比例（只在开始日）
普通当日收入 = 价差收入 + 基准收入
计提是把收入归到某一天，不是这一天已经收款或发奖。

关键来源：
  det_Dyna_Nom_Prin / det_busi_date ← 107491附加明细的动态本金 / 计提日
  info_Init_Nom_Prin / info_Strt_Pric_Date ← 合约主信息的初始本金 / 期初定价日
  spread_mode、base_mode、各比例、income_end_date ← 04下方的计算参数
这里用的是原始动态本金；展示字段补0不等于公式也补0。

本结果是普通公式候选值。06仍先判断气囊、保证金长期互换、金仕达，再使用它。
未匹配基准方式或业务类型时仍为NULL，不能自行补成0。
*/
ordinary_income_rows AS (
    SELECT
        inputs.*,
        CASE
            -- 期权：年化价差 + 年化基准；只在计提区间内逐日计算。
            WHEN info_Busi_Type = 'OPTION' and spread_mode = 'ANNUALIZED' and base_mode = 'ANNUALIZED'
                THEN IF(det_busi_date BETWEEN info_Strt_Pric_Date AND income_end_date, det_Dyna_Nom_Prin *
                    annual_spread_rate / 365 + det_Dyna_Nom_Prin * base_rate / 365, 0)
    
            -- 期权：年化价差逐日算；绝对基准只在开始日算。
            WHEN info_Busi_Type = 'OPTION' and spread_mode = 'ANNUALIZED' and base_mode = 'ABSOLUTE'
                THEN IF(det_busi_date BETWEEN info_Strt_Pric_Date AND income_end_date, det_Dyna_Nom_Prin *
                    annual_spread_rate / 365, 0) + IF(det_busi_date = info_Strt_Pric_Date, info_Init_Nom_Prin *
                    base_rate, 0)
    
            -- 期权：绝对价差只在开始日算；年化基准逐日算。
            WHEN info_Busi_Type = 'OPTION' and spread_mode = 'ABSOLUTE' and base_mode = 'ANNUALIZED'
                THEN IF(det_busi_date = info_Strt_Pric_Date, info_Init_Nom_Prin * absolute_spread_rate, 0) +
                    IF(det_busi_date BETWEEN info_Strt_Pric_Date AND income_end_date, det_Dyna_Nom_Prin * base_rate
                    / 365, 0)
    
            -- 期权：价差、基准都只在开始日算。
            WHEN info_Busi_Type = 'OPTION' and spread_mode = 'ABSOLUTE' and base_mode = 'ABSOLUTE'
                THEN IF(det_busi_date = info_Strt_Pric_Date, info_Init_Nom_Prin * absolute_spread_rate, 0) +
                    IF(det_busi_date = info_Strt_Pric_Date, info_Init_Nom_Prin * base_rate, 0)
    
            -- 普通互换：年化 + 年化。
            WHEN info_Busi_Type = 'TRS' and spread_mode = 'ANNUALIZED' and base_mode = 'ANNUALIZED'
                THEN IF(det_busi_date BETWEEN info_Strt_Pric_Date AND income_end_date, det_Dyna_Nom_Prin *
                    annual_spread_rate / 365 + det_Dyna_Nom_Prin * base_rate / 365, 0)
    
            -- 普通互换：年化 + 绝对。
            WHEN info_Busi_Type = 'TRS' and spread_mode = 'ANNUALIZED' and base_mode = 'ABSOLUTE'
                THEN IF(det_busi_date BETWEEN info_Strt_Pric_Date AND income_end_date, det_Dyna_Nom_Prin *
                    annual_spread_rate / 365, 0) + IF(det_busi_date = info_Strt_Pric_Date, info_Init_Nom_Prin *
                    base_rate, 0)
    
            -- 普通互换：绝对 + 年化。
            WHEN info_Busi_Type = 'TRS' and spread_mode = 'ABSOLUTE' and base_mode = 'ANNUALIZED'
                THEN IF(det_busi_date = info_Strt_Pric_Date, info_Init_Nom_Prin * absolute_spread_rate, 0) +
                    IF(det_busi_date BETWEEN info_Strt_Pric_Date AND income_end_date, det_Dyna_Nom_Prin * base_rate
                    / 365, 0)
    
            -- 普通互换：绝对 + 绝对。
            WHEN info_Busi_Type = 'TRS' and spread_mode = 'ABSOLUTE' and base_mode = 'ABSOLUTE'
                THEN IF(det_busi_date = info_Strt_Pric_Date, info_Init_Nom_Prin * absolute_spread_rate, 0) +
                    IF(det_busi_date = info_Strt_Pric_Date, info_Init_Nom_Prin * base_rate, 0)
        END AS ordinary_daily_income
    FROM contract_day_inputs inputs
)
