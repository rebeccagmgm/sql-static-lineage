-- 互换月换手 t3：本月起始日初始本金+本月事件本金变动 / 上月末动态本金。
-- 创收快照按USCC+内部合约号 Inr_Seri_No归集：只取TRS、本月起始行或上月末行。
-- T05_OTC_COMP_DURA_CHG_EVT（合约存续变动事件）：Otc_Comp_Agt_Id接内部合约号。
-- 三类平仓/终止事件按 Evt_Date筛月，Nom_Prin_Chg_Delta原符号相加；没有ABS/汇率换算/事件快照筛选。
-- 只有先进入s的合约才能带入事件；零分母未保护，方言行为不在这里修正。
    SELECT
        s.USCC as company_id
        ,(sum(s.new_principal) + sum(coalesce(c.close_amount, 0))) / sum(s.outst_amount) as swap_turnover_rate
        ,sum(s.new_principal) as swap_new_principal
        ,sum(s.outst_amount) as swap_outst_month_end
    from (
        SELECT
            USCC
            ,Inr_Seri_No
            ,sum(case when Accrued_Date between '${yyyy-MM}-01' and '${yyyy-MM-dd}'
                      then Init_Nom_Prin else 0 end) as new_principal
            ,sum(case when Accrued_Date = last_day('${yyyy-MM-dd,-1M}')
                      then Dyna_Nom_Prin else 0 end) as outst_amount
        from DM_OTC_N.OTC_REV_DAILY_RPT
        where busi_date = '${yyyy-MM-dd}'
          and Busi_Type = 'TRS'
          and(
            Accrued_Date between '${yyyy-MM}-01' and '${yyyy-MM-dd}' and Accrued_Date = Strt_Pric_Date
            or
            Accrued_Date = last_day('${yyyy-MM-dd,-1M}')
          )
        group by USCC, Inr_Seri_No
    ) s
    left join (
        SELECT
            Otc_Comp_Agt_Id
            ,sum(Nom_Prin_Chg_Delta) as close_amount
        from pdata_n.T05_OTC_COMP_DURA_CHG_EVT
        where src_tbl = 'ODATA_N_TIT.D_TRD_TRS_EVENT'
          and Evt_Date between '${yyyy-MM}-01' and '${yyyy-MM-dd}'
          and Evt_Type_Cd in (
                'CLOSE_STOCKS'
              , 'EARLY_TERMINATION'
              , 'TERMINATION'
              )
        group by Otc_Comp_Agt_Id
    ) c on s.Inr_Seri_No = c.Otc_Comp_Agt_Id
    group by s.USCC
