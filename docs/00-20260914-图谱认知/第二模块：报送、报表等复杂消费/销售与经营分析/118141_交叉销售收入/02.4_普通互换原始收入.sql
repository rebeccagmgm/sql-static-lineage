-- 02.4 / 普通互换：未命中前面的特殊类型、金仕达和期权分支，才进入这四支。
-- 本片段由02的同一个CASE引用，不独立执行；普通公式没有统一扣资金成本。
-- info.Init_Nom_Prin来自PDATA_N.T98_OTC_DERI_COMP_SALE_INFO（合约销售基础）：初始持仓金额×汇率。
-- det.Dyna_Nom_Prin来自PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET（107491逐日明细）：
--   期初日取初始本金；结束后归0；其余日期按历史日结构腿持仓金额×汇率，不沿用主信息当日持仓。
-- s_sp/c_sp：合约价差/客户类型价差；s_ba/c_ba：合约基准/类型基准，具体匹配见03。
-- 年化用动态本金且含起止日；绝对用初始本金且只算期初日；类型、系数分别NULL回退。
-- 减仓后本例收入100→80→50；调整、分配、累计及四种组合见09_普通互换收入贯通.md。

    -- D / 普通互换：同样保留年化/绝对四种组合；并不统一扣资金成本。
    WHEN info.Busi_Type = 'TRS'
        and coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ABSOLUTE') = 'ANNUALIZED'
        and coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ANNUALIZED'
        THEN IF(
            det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date),
            det.Dyna_Nom_Prin * coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread, 0) / 365
            + det.Dyna_Nom_Prin * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0) / 365,
            0
        )
    -- 价差年化＋基准绝对：每日价差，期初另加初始本金×绝对基准。
    WHEN info.Busi_Type = 'TRS'
        and coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ABSOLUTE') = 'ANNUALIZED'
        and coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ABSOLUTE'
        THEN IF(
            det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date),
            det.Dyna_Nom_Prin * coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread, 0) / 365,
            0
        )
        + IF(
            det.busi_date = info.Strt_Pric_Date,
            info.Init_Nom_Prin * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0),
            0
        )
    -- 价差绝对＋基准年化：期初价差，每日动态本金×年化基准。
    WHEN info.Busi_Type = 'TRS'
        and coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ABSOLUTE') = 'ABSOLUTE'
        and coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ANNUALIZED'
        THEN IF(
            det.busi_date = info.Strt_Pric_Date,
            info.Init_Nom_Prin * coalesce(s_sp.Absolute_Spread, c_sp.Absolute_Spread, 0),
            0
        )
        + IF(
            det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date),
            det.Dyna_Nom_Prin * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0) / 365,
            0
        )
    -- 两项绝对：只在期初用初始本金计算，其他日期0。
    WHEN info.Busi_Type = 'TRS'
        and coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ABSOLUTE') = 'ABSOLUTE'
        and coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ABSOLUTE'
        THEN IF(
            det.busi_date = info.Strt_Pric_Date,
            info.Init_Nom_Prin * coalesce(s_sp.Absolute_Spread, c_sp.Absolute_Spread, 0),
            0
        )
        + IF(
            det.busi_date = info.Strt_Pric_Date,
            info.Init_Nom_Prin * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0),
            0
        )
