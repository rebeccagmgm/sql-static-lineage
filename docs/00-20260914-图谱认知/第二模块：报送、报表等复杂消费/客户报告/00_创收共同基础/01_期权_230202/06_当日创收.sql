-- SELECT表达式片段；info=01主合约；det=00直接连接的逐日明细；fee=02每日费用。
-- u=03标的盈亏池，cr=04参考利率，co/co_c=05/05.1成本；pe/pd模拟对冲/持仓、mid汇率的来源和全部ON均在00。
-- 优先顺序：三种气囊 → 动态柜台 → 静态柜台 → 0。窗口仍基于FROM全部连接结果，不因CASE分支提前缩小行集。
case
    -- 1. 气囊人民币标的，或HKD标的且COMPOSITE：按预估期权费率扣CNY成本。
    -- 无关联合约时校正因子=1；有关联时=(1-初保线)/(1-基保线)。不是按本金直接扣365天成本。
    when info.Src_Contr_Type in ('RISKY','AIRBAGX')
        and (info.Undrl_Curr = 'CNY' or (info.Cros_Crrc_Type_Cd = 'COMPOSITE' and info.Undrl_Curr = 'HKD'))
    then (
        fee.OTHER_Prvs_Fee
        + if(cast(fee.PREMIUM_Prvs_Fee as double) <= 0, 0,
            fee.PREMIUM_Prvs_Fee * (
                1 - 1 / info.Opt_Fee_Rate * co_c.CAPITAL_COST
                    / if(coalesce(info.Marg_Agt_Id,'') = '', 1,
                        (1 - info.Init_Marg_Prop)/(1 - info.Base_Marg_Rate))
            )
        )
    ) * coalesce(mid.mid_price,1)

    -- 2. 其余气囊且FLEXO：期权费减去逐日本金×净成本/365。
    -- cr.ir/100=百分数转比例；净成本=参考利率+非CNY成本-保证金比例×CNY成本。
    -- 无关联用初保线，有关联用基保线；直接读det.Dyna_Nom_Prin，不用08展示列的补0值。
    when info.Src_Contr_Type in ('RISKY','AIRBAGX') and info.Cros_Crrc_Type_Cd = 'FLEXO'
    then (
        fee.OTHER_Prvs_Fee
        + if(cast(fee.PREMIUM_Prvs_Fee as double) <= 0, 0,
            fee.PREMIUM_Prvs_Fee
            - det.Dyna_Nom_Prin * (
                coalesce(cr.ir/100,0) + co.CAPITAL_COST
                - if(coalesce(info.Marg_Agt_Id,'') = '', info.Init_Marg_Prop, info.Base_Marg_Rate)
                    * co_c.CAPITAL_COST
            ) / 365
        )
    ) * coalesce(mid.mid_price,1)

    -- 3. 剩余气囊：固定0.035替代“参考利率+非CNY成本”，再减保证金抵减部分。
    -- 0.035与365按程序保留，制度来源待确认；不推断是当前市场报价或真实天数制。
    when info.Src_Contr_Type in ('RISKY','AIRBAGX')
    then (
        fee.OTHER_Prvs_Fee
        + if(cast(fee.PREMIUM_Prvs_Fee as double) <= 0, 0,
            fee.PREMIUM_Prvs_Fee
            - det.Dyna_Nom_Prin * (
                0.035 - if(coalesce(info.Marg_Agt_Id,'') = '', info.Init_Marg_Prop, info.Base_Marg_Rate)
                    * co_c.CAPITAL_COST
            ) / 365
        )
    ) * coalesce(mid.mid_price,1)

    -- 4. 动态对冲：本合约模拟对冲盈亏＋本合约持仓盈亏＋delta权重×标的残差，再按本行汇率转换。
    -- 权重=abs(delta)/组内abs(delta)合计；残差=u标的盈亏-组内模拟盈亏。
    -- 组键pe.Undrl_Sum_Compr+pe.busi_date；绝对delta合计为0时没有保护条件。
    when info.Cntr = 'DYNAMIC_HEDGING'
    then (
        coalesce(pe.Simu_Hedg_Pal,0) + coalesce(pd.Tdy_Yield,0)
        + abs(coalesce(pe.delta,0))
            / sum(abs(coalesce(pe.delta,0))) over(partition by pe.Undrl_Sum_Compr, pe.busi_date)
            * (
                coalesce(u.Tdy_Yield,0)
                - sum(coalesce(pe.Simu_Hedg_Pal,0)) over(partition by pe.Undrl_Sum_Compr, pe.busi_date)
            )
    ) * coalesce(mid.mid_price,1)

    -- 5. 静态对冲：det初始本金/组内info初始本金 × 组内已换成人民币的持仓盈亏。
    -- 三个指定客户只在分母置0，分子和盈亏合计未同样剔除，不能声称所有输出加总必守恒。
    when info.Cntr = 'STATIC_HEDGING'
    then coalesce(det.Init_Nom_Prin, 0)
        / sum(if(info.Cutp_Pty_Id in ('DEV1100101715','DEV1100103266','DEV1100105899'),0,
            coalesce(info.Init_Nom_Prin, 0))) over(partition by info.prop_group, det.busi_date)
        * sum(coalesce(coalesce(pd.Tdy_Yield,0) * coalesce(mid.mid_price,1), 0))
            over(partition by info.prop_group, det.busi_date)
    else 0
end AS Curr_Rev,
