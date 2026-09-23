-- PDATA_N.T98_OTC_SWAP_COMP_LEG_VALU_INFO：场外互换合约腿估值信息。
-- Swap_Comp_Agt_Id匹配主合约Inr_Seri_No（内部流水号），不是直接匹配日报Agt_Id。
-- Lcrrc_Accum_Unrlz_Yield=本币累计未实现收益；Lcrrc_Accum_Rlz_Yield=本币累计已实现收益。
-- 先在同一行相加再SUM；任何一项NULL，该行加法即NULL，不是逐项自动补0。
-- 当前报告日累计估值，不是按标签起止日做收益差分；SRC_TBL限定TIT腿估值来源。

            SELECT
                Swap_Comp_Agt_Id
                -- 总收益 = 累计未实现收益 + 累计已实现收益
                ,sum(Lcrrc_Accum_Unrlz_Yield + Lcrrc_Accum_Rlz_Yield) as pnl
            from pdata_n.T98_OTC_SWAP_COMP_LEG_VALU_INFO
            where SRC_TBL = 'ODATA_N_TIT.D_POS_TRS_LEG_VALUATION'
              and busi_date = '${yyyy-MM-dd}'
            group by Swap_Comp_Agt_Id
