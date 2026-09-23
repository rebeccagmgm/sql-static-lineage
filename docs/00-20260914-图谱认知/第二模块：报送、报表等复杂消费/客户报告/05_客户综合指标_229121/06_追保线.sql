-- 追保线 m2：沿与m1相同的组合→当事人→对公客户链，按本币动态本金加权。
-- T03_OTC_COMP_PERF_MARG_REF（合约履保参数）：Bail_Apd_Marg_Line=保证金追保线；Lcrrc_Dyna_Nom_Prin=本币动态本金。
-- 与m1关键不同：先排除NULL追保线再计算权重；未要求m1的履保标志。
-- 组合附加资料仍不筛快照、仍未去重；不是先按组合汇总再加权。
    SELECT
        t.company_id

        ,sum(t.margin_call_line * t.nom_weight) as margin_call_line
    from (

        -- @include 06.1_追保身份与加权明细.sql
    ) t
    group by t.company_id
