-- 香港互换增加的三路金额资料。它们在01与参数并列连接，只由02的相关分支使用。
-- 08_普通互换与返息费用贯通.md给出同一TRS逐日例子：事件金额→佣金→收入→累计。
-- 源字段注释见来源字段证据.json；当前三路结果继续进入01，不在本文件产生日报。
-- di：预付金返息每日计提明细，本日计息基数不是事件金额，也不是det动态本金。
-- 按加工日取快照，再按主信息产品ID＋源计提日期的前10位接当前计提日。
left join (
    select * from odata_n_tit.d_trd_daily_rebate_interest
    where busi_date = '${yyyy-MM-dd}'
    ) di
on di.KEY_INSTRUMENT_ID = info.Otc_Seri_No and substr(di.calc_date,1,10) = det.busi_date
-- mid：外汇交易中心中间价，结算币种＋计提日；这里只保留TIT来源、01分组，不按加工日筛选。
-- di用途的收入公式缺汇率补1；交易佣金另用info.Cny_Ex_Rate（见02），没有此补1。
left join (
    select default.datekey2date(trd_dt) as trd_dt, src_crrc_cd, mid_price
    from pdata_news_n.t02_fxr_cfets_quot
    where src_id = 'TIT' and grp_id = '01'
    ) mid
on mid.src_crrc_cd = info.Sett_Crrc_Cd and mid.trd_dt = det.busi_date
-- evt：同一合约、事件日汇总Σ(abs(数量)×价格)，价格不取绝对值；不是净数量变化后的持仓。
-- 普通TRS：主事件限定状态3/四类事件/2024年起，关联事件ID＋合约ID取得结构腿数量和价格。
-- FAST：用交易日期/变动数量/成交全价，有自己的方向/事件类型条件；原文没有再加相同日期/状态过滤。
-- UNION ALL保留两路发生额，聚合后按Inr_Seri_No＋计提日接回；不凭Otc_Seri_No匹配事件。
left join (
    select Otc_Comp_Agt_Id, sum(abs(Occu_Qty)*Pric) as Occu_Amt, Evt_Date
    from (
        select a.Otc_Comp_Agt_Id, a.Evt_Date, b.Occu_Qty, b.Pric
        from (
            select * from PDATA_N.T05_OTC_COMP_DURA_CHG_EVT
            where src_tbl = 'ODATA_N_TIT.D_TRD_TRS_EVENT' and Evt_Stat_Cd = '3'
                and Evt_Type_Cd in ('NEW_CONTRACT','CLOSE_STOCKS','EARLY_TERMINATION','TERMINATION')
                and Evt_Date >= '2024-01-01'
            ) a
        left join (
            select * from PDATA_N.T05_OTC_SWAP_COMP_HOLD_CHG_DET
            where SRC_TBL = 'ODATA_N_TIT.D_TRD_TRS_EVENT_STRUC_DETAIL'
            ) b
        on b.Dura_Chg_Src_Id = a.Src_Id and b.Swap_Comp_Agt_Id = a.Otc_Comp_Agt_Id
        union all
        select Otc_Comp_Agt_Id, Trd_Date as Evt_Date, Chg_Vol as Occu_Qty, Mtch_Full_Pric as Pric
        from PDATA_N.T05_OTC_COMP_DURA_CHG_EVT
        where src_tbl = 'ODATA_N_TIT.D_TRD_FAST_TRS_EVENT'
            and Src_Trd_Dir_Cd in ('SHORT_CLOSE','SHORT_OPEN','SELL','BUY')
            and upper(Evt_Type_Cd) in ('OPEN','CLOSE_PARTIAL','CLOSE_TERMINATE')
        ) t
    group by Otc_Comp_Agt_Id, Evt_Date
    ) evt
on evt.Otc_Comp_Agt_Id = info.Inr_Seri_No and evt.Evt_Date = det.busi_date
