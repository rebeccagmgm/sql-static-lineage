-- 独立展示毛佣金：未扣COMMISSION_COST或每股0.03，也没有gfgreatest截零。
-- 07前两分支已经加净佣金，不能把此列再加到Curr_Rev形成所谓总创收。
-- sh为按腿最新持仓参数；evt为事件日汇总。开仓条件优先，其他日才用事件金额/数量。
    case when info.Strt_Pric_Date = det.busi_date and sh.Cms_Mode_Cd = '1' then info.Init_Nom_Prin * sh.Trd_Fee_Rate
            when info.Strt_Pric_Date = det.busi_date and sh.Cms_Mode_Cd = '10' then sh.Bgng_Vol * sh.Peshr_Cms * sh.Init_Rate * coalesce(mid.mid_price,1)
            when sh.Cms_Mode_Cd = '1' then coalesce(evt.Nom_Prin_Chg_Delta,0) * sh.Trd_Fee_Rate  * coalesce(mid.mid_price,1)
            when sh.Cms_Mode_Cd = '10' then coalesce(evt.Occu_Qty,0) * sh.Peshr_Cms * coalesce(mid.mid_price,1) end as Trd_Cms,  --交易佣金收入
