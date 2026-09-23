-- 在01的SELECT内择一计算 Curr_Prvs_Sales_Income；不独立产生一张表。
-- 顺序：RISKY/AIRBAGX → 关联保证金LONG_HOLD_SWAP归零 → 普通期权四组合 → 普通互换四组合。
-- 下列仍是一个 CASE：仅按业务分组排版，未重排分支、提取公因式或改变 NULL 传播。
CASE

    -- A：RISKY/AIRBAGX 先于普通期权。抵扣直接0；其余按是否关联保证金选择保证金比例。
    -- fee_rate 取 det 当日费率，capital_cost 取 cc 期初日成本；此处没有额外日期区间判断。
    WHEN info.Src_Contr_Type in ('RISKY','AIRBAGX')
         AND Ddct_Ptrn = 'DEDUCTION'
        THEN 0  --抵扣则为0

    WHEN info.Src_Contr_Type in ('RISKY','AIRBAGX')
         AND coalesce(Ddct_Ptrn,'') != 'DEDUCTION'
         AND coalesce(info.Marg_Agt_Id,'') = ''
        THEN det.Dyna_Nom_Prin
             * (1 - Init_Marg_Prop)
             * (det.fee_rate / 1.06 - cc.capital_cost)
              / 365 * 0.3

    WHEN info.Src_Contr_Type in ('RISKY','AIRBAGX')
         AND coalesce(Ddct_Ptrn,'') != 'DEDUCTION'
         AND coalesce(info.Marg_Agt_Id,'') != ''
        THEN det.Dyna_Nom_Prin
             * (1 - Base_Marg_Rate)
             * (
                 det.fee_rate * (1 - Init_Marg_Prop) / (1 - Base_Marg_Rate) / 1.06
                 - cc.capital_cost
               )
              / 365 * 0.3

    WHEN info.Busi_Type = 'TRS'
         AND info.Src_Contr_Type = 'LONG_HOLD_SWAP'
         AND coalesce(info.Marg_Agt_Id,'') != ''
        THEN 0

    -- B：普通期权。年化项用 det 逐日本金，在含首尾的存续区间计提；绝对项用初始本金在期初日确认。
    -- 价差计算类型最终缺省 ANNUALIZED；基准类型没有缺省，空串也不当 NULL。
    WHEN info.Busi_Type = 'OPTION'
         AND coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ANNUALIZED') = 'ANNUALIZED'
         AND coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ANNUALIZED'
        THEN IF(
            det.busi_date BETWEEN info.Strt_Pric_Date
                AND coalesce(info.Early_Term_Date, info.End_Pric_Date),
            det.Dyna_Nom_Prin * coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread, 0)
              / 365
            + det.Dyna_Nom_Prin * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0)
              / 365, 0)

    WHEN info.Busi_Type = 'OPTION'
         AND coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ANNUALIZED') = 'ANNUALIZED'
         AND coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ABSOLUTE'
        THEN IF(
            det.busi_date BETWEEN info.Strt_Pric_Date
                AND coalesce(info.Early_Term_Date, info.End_Pric_Date),
            det.Dyna_Nom_Prin * coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread, 0)
              / 365, 0)
            + IF(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0), 0)

    WHEN info.Busi_Type = 'OPTION'
         AND coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ANNUALIZED') = 'ABSOLUTE'
         AND coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ANNUALIZED'
        THEN IF(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin * coalesce(s_sp.Absolute_Spread, c_sp.Absolute_Spread,0), 0)
            + IF(
            det.busi_date BETWEEN info.Strt_Pric_Date
                AND coalesce(info.Early_Term_Date, info.End_Pric_Date),
            det.Dyna_Nom_Prin * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0)
              / 365, 0)

    WHEN info.Busi_Type = 'OPTION'
         AND coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ANNUALIZED') = 'ABSOLUTE'
         AND coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ABSOLUTE'
        THEN IF(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin * coalesce(s_sp.Absolute_Spread, c_sp.Absolute_Spread,0), 0)
            + IF(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0), 0)

    -- C：普通互换。年化本金在返息费用互换时改取 di 本日计息基数 × mid 当日汇率。
    -- 佣金基数：期初用 info 初始本金，其他日用 evt 事件发生额 × info 主信息汇率。
    -- 注意是两路汇率，不能混用；佣金两侧费率都 NULL 时整段相加结果可为 NULL，不能补0。
    WHEN info.Busi_Type = 'TRS'
         AND coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ANNUALIZED') = 'ANNUALIZED'
         AND coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ANNUALIZED'
        THEN IF(
            det.busi_date BETWEEN info.Strt_Pric_Date
                AND coalesce(info.Early_Term_Date, info.End_Pric_Date),
            IF(
                info.Comp_Usag_Cd = 'REBATE_INTEREST'
                    AND info.Src_Contr_Type = 'FEE_SWAP',
                di.DAILY_BASE_AMOUNT * coalesce(mid.mid_price, 1),
                det.Dyna_Nom_Prin
              )
              * coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread, 0)
              / 365
            + IF(
                info.Comp_Usag_Cd = 'REBATE_INTEREST'
                    AND info.Src_Contr_Type = 'FEE_SWAP',
                di.DAILY_BASE_AMOUNT * coalesce(mid.mid_price, 1),
                det.Dyna_Nom_Prin
              )
              * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0)
              / 365
            + IF(
                det.busi_date = info.Strt_Pric_Date,
                info.Init_Nom_Prin,
                coalesce(evt.Occu_Amt, 0) * info.Cny_Ex_Rate
              )
              * coalesce(s_cr.commission_rate,c_cr.commission_rate),
            0
        )

    WHEN info.Busi_Type = 'TRS'
         AND coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ANNUALIZED') = 'ANNUALIZED'
         AND coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ABSOLUTE'
        THEN IF(
            det.busi_date BETWEEN info.Strt_Pric_Date
                AND coalesce(info.Early_Term_Date, info.End_Pric_Date),
            IF(
                info.Comp_Usag_Cd = 'REBATE_INTEREST'
                    AND info.Src_Contr_Type = 'FEE_SWAP',
                di.DAILY_BASE_AMOUNT * coalesce(mid.mid_price, 1),
                det.Dyna_Nom_Prin
              )
              * coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread, 0)
              / 365
            + IF(
                det.busi_date = info.Strt_Pric_Date,
                info.Init_Nom_Prin,
                coalesce(evt.Occu_Amt, 0) * info.Cny_Ex_Rate
              )
              * coalesce(s_cr.commission_rate,c_cr.commission_rate),
            0
        )
            + IF(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0), 0)

    WHEN info.Busi_Type = 'TRS'
         AND coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ANNUALIZED') = 'ABSOLUTE'
         AND coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ANNUALIZED'
        THEN IF(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin * coalesce(s_sp.Absolute_Spread, c_sp.Absolute_Spread,0), 0)
            + IF(
            det.busi_date BETWEEN info.Strt_Pric_Date
                AND coalesce(info.Early_Term_Date, info.End_Pric_Date),
            IF(
                info.Comp_Usag_Cd = 'REBATE_INTEREST'
                    AND info.Src_Contr_Type = 'FEE_SWAP',
                di.DAILY_BASE_AMOUNT * coalesce(mid.mid_price, 1),
                det.Dyna_Nom_Prin
              )
              * coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0)
              / 365
            + IF(
                det.busi_date = info.Strt_Pric_Date,
                info.Init_Nom_Prin,
                coalesce(evt.Occu_Amt, 0) * info.Cny_Ex_Rate
              )
              * coalesce(s_cr.commission_rate,c_cr.commission_rate),
            0
        )

    WHEN info.Busi_Type = 'TRS'
         AND coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ANNUALIZED') = 'ABSOLUTE'
         AND coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ABSOLUTE'
        THEN IF(det.busi_date = info.Strt_Pric_Date, info.Init_Nom_Prin * (coalesce(s_sp.Absolute_Spread, c_sp.Absolute_Spread,0)
            + coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0)), 0)
            + IF(
            det.busi_date BETWEEN info.Strt_Pric_Date
                AND coalesce(info.Early_Term_Date, info.End_Pric_Date),
            IF(
                det.busi_date = info.Strt_Pric_Date,
                info.Init_Nom_Prin,
                coalesce(evt.Occu_Amt, 0) * info.Cny_Ex_Rate
              )
              * coalesce(s_cr.commission_rate,c_cr.commission_rate),
            0
        )
END AS Curr_Prvs_Sales_Income,
