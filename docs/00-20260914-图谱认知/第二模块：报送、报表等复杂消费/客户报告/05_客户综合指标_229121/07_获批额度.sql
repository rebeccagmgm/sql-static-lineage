-- 获批额度 lim：有效管理人限额→有效当事人映射→当日对公客户，按公司中文全名归集。
-- T01_PTY_LMT_H（当事人限额历史）：Lmt取MAX，不是SUM；Perm_Busi_Type去重拼接，不翻译码值。
-- 有效期均含开始、不含结束；外层按名称而非USCC连接，缺失额度保持NULL。
    SELECT
        c.ORG_FULL_NAME_CH as company_name
        ,max(cast(l.Lmt as double)) as approved_limit
        ,concat_ws(';', collect_set(l.Perm_Busi_Type)) as approved_type
    from pdata_n.T01_PTY_LMT_H l
    inner join pdata_n.T01_PTY_RELA_H h
        on l.Pty_Id = h.Pty_Id
        and h.SRC_TBL = 'ODATA_N_TIT.D_REF_CTPTY_MAPPING'
        and h.STRT_DATE <= '${yyyy-MM-dd}'
        and h.END_DATE > '${yyyy-MM-dd}'
    inner join pdata_n.T01_CORP_CUST c
        on h.Rela_Pty_Id = c.PTY_ID
        and c.BUSI_DATE = '${yyyy-MM-dd}'
        and c.SRC_TBL = 'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY'
    where l.SRC_TBL = 'ODATA_N_TIT.D_RISK_CTPTY_LIMIT_THRESHOLD'
        and l.Strt_Date <= '${yyyy-MM-dd}'
        and l.End_Date > '${yyyy-MM-dd}'
        and l.Pty_Lmt_Type_Cd = 'ADMINISTRATORLIMIT'
    group by c.ORG_FULL_NAME_CH
