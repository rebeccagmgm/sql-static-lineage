-- 实际SELECT表达式：info=01主合约，u=02标的盈亏池，evt=04开平仓/分红，cr=05参考利率，co=06成本。
-- det逐日明细、sh最新腿、mid结算币种汇率、fr浮动指数、ins标的分类、x上传分配的实际查询与全部ON均在00。
-- 前两分支=本金息差/365＋净佣金。净佣金先选开仓/平仓、按金额/按股，再gfgreatest(...,0)。
-- 佣金模式1按金额；10按股。按股开仓乘Init_Rate，平仓不乘；开仓日即使有平仓事件仍优先开仓。
-- gfgreatest/gfleast对正常数值分别取大/小；平台UDF的NULL与非法值行为未由资料证明。
case
    -- 1. 固定COMPOSITE：逐日本金×固定净息差/365，再加扣成本并截零的佣金。
    when info.Agt_Clas_Cd = 'TRS_SAC_OTC'
        and ((info.Src_Contr_Type = 'S_CROSS_SWAP' and info.Src_Undrl_Type = 'EQUITY') or info.Src_Contr_Type = 'S_CROSS_OPTION_SWAP')
        and info.Cros_Crrc_Type_Cd = 'COMPOSITE'
    then det.Dyna_Nom_Prin * (
        coalesce(info.fixed_rate,0) - co.FUND_COST_RATE + co.MARGIN_FIXED_RATE
    ) / 365
    + default.gfgreatest(
        case
            when info.Strt_Pric_Date = det.busi_date and sh.Cms_Mode_Cd = '1'
            then info.Init_Nom_Prin * (sh.Trd_Fee_Rate - co.COMMISSION_COST)
            when info.Strt_Pric_Date = det.busi_date and sh.Cms_Mode_Cd = '10'
            then sh.Bgng_Vol * (sh.Peshr_Cms - 0.03) * sh.Init_Rate * coalesce(mid.mid_price,1)
            when sh.Cms_Mode_Cd = '1'
            then coalesce(evt.Nom_Prin_Chg_Delta,0) * (sh.Trd_Fee_Rate - co.COMMISSION_COST)  * coalesce(mid.mid_price,1)
            when sh.Cms_Mode_Cd = '10'
            then coalesce(evt.Occu_Qty,0) * (sh.Peshr_Cms - 0.03) * coalesce(mid.mid_price,1)
        end,0)

    -- 2. FLEXO：参考指数+利差，先取下限再封顶，随后扣利差/成本并加保证金固定利率。
    when info.Agt_Clas_Cd = 'TRS_SAC_OTC'
        and ((info.Src_Contr_Type = 'S_CROSS_SWAP' and info.Src_Undrl_Type = 'EQUITY') or info.Src_Contr_Type = 'S_CROSS_OPTION_SWAP')
        and info.Cros_Crrc_Type_Cd = 'FLEXO'
    then det.Dyna_Nom_Prin * (default.gfleast(
        coalesce(cast(info.Flot_Intrt_Ulmt as double),100),
        default.gfgreatest(cast(info.Float_Base_Rate as double),
            cast(fr.intrt as double)/100 + cast(info.Intr_Marg as double))
    ) - co.SPREAD - coalesce(cr.ir/100,0) + co.MARGIN_FIXED_RATE) / 365
    + default.gfgreatest(
        case
            when info.Strt_Pric_Date = det.busi_date and sh.Cms_Mode_Cd = '1'
            then info.Init_Nom_Prin * (sh.Trd_Fee_Rate - co.COMMISSION_COST)
            when info.Strt_Pric_Date = det.busi_date and sh.Cms_Mode_Cd = '10'
            then sh.Bgng_Vol * (sh.Peshr_Cms - 0.03) * sh.Init_Rate * coalesce(mid.mid_price,1)
            when sh.Cms_Mode_Cd = '1'
            then coalesce(evt.Nom_Prin_Chg_Delta,0) * (sh.Trd_Fee_Rate - co.COMMISSION_COST)  * coalesce(mid.mid_price,1)
            when sh.Cms_Mode_Cd = '10'
            then coalesce(evt.Occu_Qty,0) * (sh.Peshr_Cms - 0.03)  * coalesce(mid.mid_price,1)
        end,0)

    -- 3. 多头持券：日息差＋分红税额×汇率，不加前两分支的净佣金。
    when info.Agt_Clas_Cd = 'TRS_SAC_OTC' and info.Src_Contr_Type = 'LONG_HOLD_SWAP' and info.Src_Undrl_Type = 'EQUITY'
    then det.Dyna_Nom_Prin * (info.fixed_rate - co.FIXED_RATE) / 365 + coalesce(evt.Divd_Tax_Amt,0) * coalesce(mid.mid_price,1)

    -- 4. 指数增强：合格10016合约按动态本金占比分配u+x盈亏池；无零分母保护。
    when info.book_agt_id = '10016' and coalesce(ins.undrl_clas, info.undrl_wd_cd) in ('000905.SH','000852.SH','000016.SH','000300.SH','8841431.WI') and info.Src_Contr_Type = 'INDEX_ENHANCE_SWAP'

    then coalesce(det.Dyna_Nom_Prin, 0)
        / sum(if(
            info.book_agt_id = '10016'
            and coalesce(ins.undrl_clas, info.undrl_wd_cd) in ('000905.SH','000852.SH','000016.SH','000300.SH','8841431.WI')
            and info.Src_Contr_Type = 'INDEX_ENHANCE_SWAP',
            coalesce(det.Dyna_Nom_Prin, 0),0
        )) over(partition by coalesce(ins.undrl_clas, info.undrl_wd_cd),det.busi_date)
        * (coalesce(u.Tdy_Yield, 0)+coalesce(x.Tdy_Yield, 0))
        * coalesce(mid.mid_price,1)
    else 0
end AS Curr_Rev,
