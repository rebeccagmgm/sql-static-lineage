-- 02.3 / 普通期权：未命中特殊类型、金仕达后，再按价差/基准组合选这四支。
-- 本片段由02的同一个CASE引用，不独立执行；输出仍是原始收入，不是保底后金额。
-- info.Init_Nom_Prin来自PDATA_N.T98_OTC_DERI_COMP_SALE_INFO（合约销售基础）；
-- det.Dyna_Nom_Prin来自PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET（107491逐日明细），不取展示列补0值。
-- s_sp/c_sp：合约价差/客户类型价差；s_ba/c_ba：合约基准/类型基准，均由03并列接入。
-- 年化项：动态本金×所选系数÷365，起止日都包含；绝对项：初始本金×系数，只在期初日计算。
-- 类型与系数分别COALESCE，不是整套回退；0不回退。所有分支未命中时，02没有ELSE，返回NULL。
-- 本页普通期权100元原始日收入，如何变成结束日3,450元：见README和04_收入调整.sql。

    -- C / 普通期权：价差年化、基准年化；贯穿算例命中此支，365万元×(.006+.004)÷365=100。
    WHEN info.Busi_Type = 'OPTION'
        and coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ABSOLUTE') = 'ANNUALIZED'
        and coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ANNUALIZED'
        THEN IF(
            det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date),
            det.Dyna_Nom_Prin * coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread, 0) / 365
            + det.Dyna_Nom_Prin * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0) / 365,
            0
        )
    -- 价差年化＋基准绝对：价差每天算，基准只在期初算一次。
    WHEN info.Busi_Type = 'OPTION'
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
    -- 价差绝对＋基准年化：价差只在期初算一次，基准每天算。
    WHEN info.Busi_Type = 'OPTION'
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
    -- 两项绝对：只在期初计算，其他日期均为0。
    WHEN info.Busi_Type = 'OPTION'
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
