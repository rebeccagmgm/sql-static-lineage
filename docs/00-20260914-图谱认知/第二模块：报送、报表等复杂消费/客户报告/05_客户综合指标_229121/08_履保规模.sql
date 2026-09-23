-- 履保规模 perf：当日履保参数中STATIC/DYNAMIC，按内部合约号接当日01/02/03销售合约。
-- 取销售合约 Dyna_Nom_Prin（动态名义本金），排除Contr_Type_Desc=南下期货；NULL类型也不满足<>。
-- 按公司全名求和，没有DISTINCT/状态/正本金过滤；重复参数会重复金额。
-- 最终“存续履保交易规模”和“已用额度”使用同一个结果，不是两个独立事实；缺失按0展示。
    SELECT
        s.Cutp_Pty_Full_Name as company_name
        ,sum(cast(s.Dyna_Nom_Prin as double)) as perf_dyna_nom_prin
    from pdata_n.T03_OTC_COMP_PERF_MARG_REF r
    inner join pdata_n.T98_OTC_DERI_COMP_SALE_INFO s
        on r.Otc_Comp_Agt_Id = s.Inr_Seri_No
        and s.busi_date = '${yyyy-MM-dd}'
        and s.grp_id in ('01','02','03')
        and s.Contr_Type_Desc <> '南下期货'
    where r.busi_date = '${yyyy-MM-dd}'
      and r.src_tbl = 'ODATA_N_TIT.D_REF_OTC_CONTR_MARGIN_PARAM'
      and r.Enable_Perf_Marg_Type_Cd in ('STATIC', 'DYNAMIC')
    group by s.Cutp_Pty_Full_Name
