-- m=T03_OTC_DERI_COMP_COMB_MARG_CALL_INFO 组合追保信息：Perf_Marg_Date履保日期、Defr_Days递延天数。
-- h=T01_PTY_RELA_H 当事人关系历史；c=T01_CORP_CUST 法人客户。
-- m.Pty_Id交易对手→h.Rela_Pty_Id关联方→c.PTY_ID管理人，取报告日有效关系，不按历史事件日回溯关系。
-- 上年1月1日至报告日，Defr_Days>=2仅作为本标签候选；按原始履保日期去重，不数追保行数。
-- 没有符合条件的月份不会自动补零；这影响04的ROWS窗口含义。
            SELECT
                c.ORG_FULL_NAME_CH as company_name                -- 管理人名称
                ,c.USCC as company_id
                ,substr(m.Perf_Marg_Date, 1, 7) as mon            -- 截取到月(yyyy-MM)
                ,count(distinct m.Perf_Marg_Date) as month_cnt    -- 当月入选履保日期字段不同值数，未截自然日
            from PDATA_N.T03_OTC_DERI_COMP_COMB_MARG_CALL_INFO m
            inner join pdata_n.T01_PTY_RELA_H h
                on m.Pty_Id = h.Pty_Id                            -- 交易对手ID
                and h.SRC_TBL = 'ODATA_N_TIT.D_REF_CTPTY_MAPPING'
                and h.STRT_DATE <= '${yyyy-MM-dd}'
                and h.END_DATE > '${yyyy-MM-dd}'
            inner join pdata_n.T01_CORP_CUST c
                on h.Rela_Pty_Id = c.PTY_ID                      -- 映射到管理人
                and c.BUSI_DATE = '${yyyy-MM-dd}'
                and c.SRC_TBL = 'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY'
            where m.Busi_Date = '${yyyy-MM-dd}'
              and m.Perf_Marg_Date >= '${yyyy,-1y}-01-01'
              and m.Perf_Marg_Date <= '${yyyy-MM-dd}'
              and m.Src_Tbl = 'ODATA_N_TIT.G_MARGIN_CALL_SETTING'
              and cast(m.Defr_Days as int) >= 2                  -- 递延天数>=2进入本标签候选，不证明实际资金垫付
            group by c.ORG_FULL_NAME_CH, c.USCC,
                     substr(m.Perf_Marg_Date, 1, 7)               -- ← 按 (公司, 月) 一步聚合
