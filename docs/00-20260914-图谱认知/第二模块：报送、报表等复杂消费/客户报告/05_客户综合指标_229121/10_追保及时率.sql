-- 追保及时率 mc：当日追保设置快照、履保日期上一年元旦至报告日。
-- Defr_Days=递延天数；分子是<=2的天数之和，分母是全部天数之和；不是及时笔数/总笔数。
-- 以有效当事人映射补公司名，按名称连接；NULL在SUM中跳过，零/负数未过滤，分母零未保护。
    SELECT
        c.ORG_FULL_NAME_CH as company_name
        ,sum(case when cast(m.Defr_Days as int) <= 2 then cast(m.Defr_Days as int) else 0 end)
         / sum(cast(m.Defr_Days as int)) as margin_call_rate
    from PDATA_N.T03_OTC_DERI_COMP_COMB_MARG_CALL_INFO m
    inner join pdata_n.T01_PTY_RELA_H h
        on m.Pty_Id = h.Pty_Id
        and h.SRC_TBL = 'ODATA_N_TIT.D_REF_CTPTY_MAPPING'
        and h.STRT_DATE <= '${yyyy-MM-dd}'
        and h.END_DATE > '${yyyy-MM-dd}'
    inner join pdata_n.T01_CORP_CUST c
        on h.Rela_Pty_Id = c.PTY_ID
        and c.BUSI_DATE = '${yyyy-MM-dd}'
        and c.SRC_TBL = 'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY'
    where m.Busi_Date = '${yyyy-MM-dd}'
      and m.Perf_Marg_Date >= '${yyyy,-1y}-01-01'
      and m.Perf_Marg_Date <= '${yyyy-MM-dd}'
      and m.Src_Tbl = 'ODATA_N_TIT.G_MARGIN_CALL_SETTING'
    group by c.ORG_FULL_NAME_CH
