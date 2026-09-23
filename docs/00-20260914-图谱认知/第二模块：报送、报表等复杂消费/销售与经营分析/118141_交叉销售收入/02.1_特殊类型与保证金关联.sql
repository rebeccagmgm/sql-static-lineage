-- 02.1 / 原始收入CASE的第1—4支；由02实际引用，后面才判断金仕达及普通业务。
-- 本片段只有WHEN/THEN，不独立SELECT、不另包CASE，不单独执行。
-- info：PDATA_N.T98_OTC_DERI_COMP_SALE_INFO（合约销售基础）。
--   Ddct_Ptrn=组合履保方案抵扣模式；Marg_Agt_Id=保证金关联合约编号集合。
--   Init_Marg_Prop=初始保证金比例；Base_Marg_Rate=基础保证金率。
-- det：PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET（107491逐日明细）。
--   Dyna_Nom_Prin=当前计提日本金；fee_rate=按工具和日期延续的计提费率。
-- cc：T99_DERI_COMP_TYPE_FND_COST_REF.Fnd_Cost（成本参数），由03按类型＋期初日匹配。
-- 不额外判断起止日期；抵扣先置0，缺成本时非抵扣公式不补0，基础保证金率为1时不保护除零。
-- 本例：无关联168、有关联159；来源、日期差异和后续分配见10_AIRBAG与关联保证金收入贯通.md。

    -- A / 特殊类型优先：抵扣判断来自组合履保方案，不是收入分配比例。
    WHEN info.Src_Contr_Type in ('AIRBAGX','AIRBAGM','AIRBAGL')
        and Ddct_Ptrn = 'DEDUCTION'
        THEN 0  --抵扣则为0
    WHEN info.Src_Contr_Type in ('AIRBAGX','AIRBAGM','AIRBAGL')
        and coalesce(Ddct_Ptrn,'') != 'DEDUCTION'
        and coalesce(info.Marg_Agt_Id,'') = ''
        -- 无保证金关联合约：先用本金×(1−初始保证金比例)，再算费率与成本率之差。
        THEN det.Dyna_Nom_Prin * (1 - Init_Marg_Prop)
            * (det.fee_rate/1.06 - cc.capital_cost) / 365 * 0.3
    WHEN info.Src_Contr_Type in ('AIRBAGX','AIRBAGM','AIRBAGL')
        and coalesce(Ddct_Ptrn,'') != 'DEDUCTION'
        and coalesce(info.Marg_Agt_Id,'') != ''
        -- 有关联：基础保证金率参与内外两处；分母为0时原式没有保护，不约分改写。
        THEN det.Dyna_Nom_Prin * (1 - Base_Marg_Rate)
            * (det.fee_rate*(1 - Init_Marg_Prop)/(1 - Base_Marg_Rate)/1.06 - cc.capital_cost)
            /365 *0.3
    WHEN info.Src_Contr_Type = 'LONG_HOLD_SWAP'
        and coalesce(info.Marg_Agt_Id,'') != ''
        THEN 0
