-- 独立于06的另一列，不自动加回Curr_Rev。只在本行期初定价日=det计提日时确认。
-- 动态柜台取info.Bgng_Npv×本日汇率；静态柜台按同组本金权重分配组内已换算的期初NPV。
-- 即使06先命中气囊，只要本行柜台符合，07仍会计算；不能把“气囊优先”误解成整行跳过NPV。
case
    when info.Cntr = 'DYNAMIC_HEDGING'
    then if(info.Strt_Pric_Date = det.busi_date,
        info.Bgng_Npv * coalesce(mid.mid_price,1), 0)
    when info.Cntr = 'STATIC_HEDGING'
    then if(info.Strt_Pric_Date = det.busi_date,
        coalesce(det.Init_Nom_Prin, 0)
            / sum(if(info.Cutp_Pty_Id in ('DEV1100101715','DEV1100103266','DEV1100105899'),0,
                coalesce(info.Init_Nom_Prin, 0))) over(partition by info.prop_group, det.busi_date)
            * sum(coalesce(info.Bgng_Npv * coalesce(mid.mid_price,1), 0))
                over(partition by info.prop_group, det.busi_date),
        0)
    else 0
end as Opt_Npv_Curr_Rev,
