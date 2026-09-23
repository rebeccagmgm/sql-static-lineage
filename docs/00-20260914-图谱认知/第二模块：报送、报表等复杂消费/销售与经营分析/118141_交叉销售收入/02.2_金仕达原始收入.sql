-- 02.2 / 原始收入CASE的第5支；只有未命中前面的特殊类型时，才判断金仕达。
-- 本片段只有WHEN/THEN，由02实际引用，不独立执行。
-- det来自PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET（107491逐日明细）：
--   Inta=源accrued_interest取反；Trd_Cms=profit；Trd_Cms_Cost=fee_cost；Fnd_Cost=occupy_cost。
--   源表均为ODATA_N_TIT.D_KS_TRADE_COMFIRM_INFO（交易确认书信息表）。
--   利息/用资可延续，交易收入成本仅匹配当天；Fnd_Cost在这里作为乘成本率的基数。
-- cc.capital_cost来自T99_DERI_COMP_TYPE_FND_COST_REF.Fnd_Cost，是另一条OIS成本参数。
-- 本式无起止日IF，也不将缺成本补0；0.94、0.5的制度依据不由SQL本身证明。
-- 本例KS_A原始1,500、KS_B原始3,000；还要交给04按同日占比分摊系统费用。
-- 从源字段到日报的完整算例：11_金仕达收入与系统费用贯通.md。

    -- B / 金仕达：det.Fnd_Cost来自occupy_cost，作计费基数；cc是OIS成本率，不是同一个量。
    WHEN info.Contr_Type_Cd = 'TRS_KINGSTAR_SWAP'
        THEN (det.Inta * 0.94 + det.Trd_Cms - det.Trd_Cms_Cost
            - det.Fnd_Cost * cc.capital_cost/365) * 0.5
