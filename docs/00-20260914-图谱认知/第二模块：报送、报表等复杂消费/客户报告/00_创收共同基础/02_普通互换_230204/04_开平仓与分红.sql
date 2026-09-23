-- 本文件生产evt平仓/分红事件汇总；sh最新腿查询另在00，二者不是串行步骤。
-- sh：互换腿历史持仓，每条Leg_Glbl_Seq_No按日期倒序取rk=1，再按内部流水号连接合约。
-- “最新”是源中该腿最新，并无<=计提日限制；一合约多腿仍可能多条，不能说已做到每合约唯一。
-- evt：持仓变动明细＋状态代码3的存续变动事件，按内部合约号+事件日汇总。
-- CLOSE_STOCKS/EARLY_TERMINATION/TERMINATION汇总绝对数量×价格×rate与绝对数量×rate；不是直接取本金余额的前日差。
-- DIVIDEND_STOCKS汇总分红税额×rate。rate与后续mid不是同一层：这里先形成结算币种金额，公式再按mid转换。
-- 07与08均先判断期初定价日，开仓日即使有evt也优先使用开仓公式，不把两段相加。
-- 本文件提供evt查询体；外层JOIN与ON在00主脚本，实际公式继续在收入模块。
--平仓
    select
        tes.Swap_Comp_Agt_Id,
        sum(if(Evt_Type_Cd in ('CLOSE_STOCKS','EARLY_TERMINATION','TERMINATION'),coalesce(abs(tes.Occu_Qty)*tes.Pric*tes.rate,0),0)) as Nom_Prin_Chg_Delta,
        sum(if(Evt_Type_Cd in ('CLOSE_STOCKS','EARLY_TERMINATION','TERMINATION'),coalesce(abs(tes.Occu_Qty)*tes.rate,0),0)) as Occu_Qty,
        sum(if(Evt_Type_Cd = 'DIVIDEND_STOCKS',coalesce(tes.Divd_Tax_Amt,0)*tes.rate,0)) as Divd_Tax_Amt,
        te.Evt_Date
    from (
        select * from PDATA_N.T05_OTC_SWAP_COMP_HOLD_CHG_DET
        where SRC_TBL = 'ODATA_N_TIT.D_TRD_TRS_EVENT_STRUC_DETAIL'
        ) tes
    join (
        select * from PDATA_N.T05_OTC_COMP_DURA_CHG_EVT
        where src_tbl = 'ODATA_N_TIT.D_TRD_TRS_EVENT' and Evt_Stat_Cd = '3'
            and Evt_Type_Cd in ('CLOSE_STOCKS','EARLY_TERMINATION','TERMINATION','DIVIDEND_STOCKS')
        ) te
    on tes.Dura_Chg_Src_Id = te.Src_Id and tes.Swap_Comp_Agt_Id = te.Otc_Comp_Agt_Id
    group by tes.Swap_Comp_Agt_Id, te.Evt_Date
