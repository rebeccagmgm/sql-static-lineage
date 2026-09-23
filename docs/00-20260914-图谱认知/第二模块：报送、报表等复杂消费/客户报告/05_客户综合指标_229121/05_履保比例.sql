-- 履保比例 m1：以组合动态本金加权，映射链见下。
-- 履保结果m.Comb_Agt_Grp_Id → 组合附加资料comb.Agt_Grp_Id → 对手方comb.Cutp_Pty_Id
-- → 有效当事人关系h.Pty_Id→h.Rela_Pty_Id → 当日对公客户c.PTY_ID→c.USCC。
-- 只要履保标志1、动态本金>0就参与权重；Marg_Perf_Prtc_Rati为NULL的本金仍占分母。
-- 组合表未筛BUSI_DATE、映射未去重：窗口在这些INNER JOIN之后计算，不保证一组合一行。
    SELECT
        t.company_id

        ,sum(t.marg_ratio * t.nom_weight) as margin_ratio
    from (

        -- @include 05.1_履保身份与加权明细.sql
    ) t
    group by t.company_id
