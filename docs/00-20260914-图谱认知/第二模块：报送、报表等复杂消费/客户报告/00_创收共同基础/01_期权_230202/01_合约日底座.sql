-- 本文件选info（报告日合约主信息）；00再INNER JOIN逐日明细det，决定哪些合约日实际出现。
-- 普通/动态入口过滤OTC、grp_id=01、结束日不早于2022，并排除STATIC_HEDGING与TRS_INNER。
-- 静态入口另造prop_group：拆开自身号+关联合约号，按字符串排序取第一项；不是图连通分量。
-- 注意静态入口未写TRS_INNER排除；z回连只按报告日读取，没有重加外层筛选。
-- det只用自己的Strt_Pric_Date/End_Pric_Date限制自身busi_date；此任务未额外写det.busi_date<=报告日。
-- 本文件输出合约资料与静态组号；00连接det后才输出合约×明细日。两处都不擅自去重。
-- 本文件提供info查询体；外层JOIN与ON在00主脚本，实际公式继续在收入模块。
select *, null as prop_group from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
    where busi_date = '${yyyy-MM-dd}' and Book_Bel_Dept = 'OTC' and coalesce(Early_Term_Date, End_Pric_Date) >= '2022-01-01'
        and grp_id = '01' and Cntr != 'STATIC_HEDGING'
        and Agt_Clas_Cd != 'TRS_INNER'
    union all
    select  --静态对冲期权
        z.*, x.prop_group
    from (
        select agt_id, x.rel_agt_id as prop_group, row_number() over(partition by agt_id order by x.rel_agt_id) as rk
        from (
            select agt_id, concat(agt_id,',',coalesce(rel_agt_id,agt_id)) as rel_agt_id from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
            where busi_date = '${yyyy-MM-dd}' and Book_Bel_Dept = 'OTC' and coalesce(Early_Term_Date, End_Pric_Date) >= '2022-01-01'
                and grp_id = '01' and Cntr = 'STATIC_HEDGING'
            ) t
        lateral view explode(split(rel_agt_id,',')) x as rel_agt_id
        ) x
    left join (
        select * from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
        where busi_date = '${yyyy-MM-dd}'
        ) z
    on x.agt_id = z.agt_id
    where x.rk = 1
