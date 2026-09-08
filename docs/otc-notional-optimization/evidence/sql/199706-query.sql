
SELECT deri_type,
	otc_deri_type,
	add_nom_prin_mth,
	add_nom_prin_pmth,
	add_nom_prin_mom,
	add_nom_prin_mom_flag,
	mom_abs_rank_no,
	add_nom_prin_year_rate,
	dura_nom_prin_mth_rate,
	rate_diff_abs_gt_pct5_flag,
	rate_diff_abs_gt_pct2_flag,
	busi_mon FROM (
	 select 
     idx2.busi_type as deri_type -- 衍生品类型
    ,idx1.rpt_contr_type as otc_deri_type -- 合约类型
    ,idx1.cur_mth_scal / 100000000 as add_nom_prin_mth  -- 本月新增名义本金规模（亿元）
    ,idx1.last_mth_scal / 100000000 as add_nom_prin_pmth  -- 上月新增名义本金规模（亿元）
    ,if(idx1.last_mth_scal = 0, 1, idx1.cur_mth_scal/idx1.last_mth_scal - 1) as add_nom_prin_mom -- 新增名义本金环比
    ,if(if(idx1.last_mth_scal = 0, 1, idx1.cur_mth_scal/idx1.last_mth_scal - 1) > 0, '上升', '下降') as add_nom_prin_mom_flag -- 新增名义本金环比升降标志
    ,dense_rank()over(order by abs(if(idx1.last_mth_scal = 0, 1, idx1.cur_mth_scal/idx1.last_mth_scal - 1)) desc) as mom_abs_rank_no -- 环比绝对值排序
    ,if(idx2.cur_year_scal = 0, 0, idx1.cur_year_scal / idx2.cur_year_scal) as add_nom_prin_year_rate -- 今年新增名义本金占比
    ,if(idx2.cur_dura_scal = 0, 0, idx1.cur_dura_scal / idx2.cur_dura_scal) as dura_nom_prin_mth_rate -- 本月存续名义本金占比
    ,if(
        abs(
        if(idx2.cur_year_scal = 0, 0, idx1.cur_year_scal / idx2.cur_year_scal) -
        if(idx2.cur_dura_scal = 0, 0, idx1.cur_dura_scal / idx2.cur_dura_scal)
        ) > 0.05,
        '1',
        '0'
     ) as rate_diff_abs_gt_pct5_flag -- 占比差绝对值是否大于百分之五
    ,if(
        abs(
        if(idx2.cur_year_scal = 0, 0, idx1.cur_year_scal / idx2.cur_year_scal) -
        if(idx2.cur_dura_scal = 0, 0, idx1.cur_dura_scal / idx2.cur_dura_scal)
        ) > 0.02,
        '1',
        '0'
     ) as rate_diff_abs_gt_pct2_flag -- 占比差绝对值是否大于百分之二
    ,'${yyyyMM}' as busi_mon -- 月份
from(
    -- tag_id1 报表合约类型
    -- 本月/上月/今年新增名义本金
    -- 本月存续
    select
        tag.tag_name as rpt_contr_type
        ,tag.tag_id
        ,sum(if(idx.pd_flag = 'cur_mth', idx.index_val, 0)) as cur_mth_scal -- 本月新增规模
        ,sum(if(idx.pd_flag = 'last_mth', idx.index_val, 0)) as last_mth_scal -- 上月新增规模
        ,sum(if(idx.pd_flag = 'cur_year', idx.index_val, 0)) as cur_year_scal -- 今年新增规模
        ,sum(if(idx.pd_flag = 'cur_dura', idx.index_val, 0)) as cur_dura_scal -- 本月存续规模
    from(
        -- 月新增
        select 'cur_mth' as pd_flag, index_val, tag_id, grp_id from dm_index_n.index_grp1_DealScal_OtcDeri_Mth where busi_date = '${yyyy-MM-dd}'
        union all
        -- 月新增
        select 'last_mth' as pd_flag, index_val, tag_id, grp_id from dm_index_n.index_grp1_DealScal_OtcDeri_Mth where busi_date = last_day('${yyyy-MM-dd,-1M}')
        union all
        -- 年新增
        select 'cur_year' as pd_flag, index_val, tag_id, grp_id from dm_index_n.index_grp1_DealScal_OtcDeri_Year where busi_date = '${yyyy-MM-dd}'
        union all
        -- 当前存续
        select 'cur_dura' as pd_flag, index_val, tag_id, grp_id from dm_index_n.index_grp1_CompScal_OtcDeri_Tdy where busi_date = '${yyyy-MM-dd}'
    ) idx
    join(
        select * from dm_index_n.grp_def where grp_type_code in('COMPANY') and status = '1'
    ) grp
    on idx.grp_id = grp.grp_id
    join(
        select tag_id, tag_name from dm_index_n.tag_def where tag_partition_id = 'tagdim102531' and status = '1' and dim_num = '1' and calc_ind = '0'
    ) tag
    on idx.tag_id = tag.tag_id
    group by
        tag.tag_name, tag.tag_id
) idx1
join(
    -- 建立映射关系：tag_id1 <---> tag_id2
    select 
        distinct
        s1.tag_id as tag_id1 -- 报表合约类型
        ,s2.tag_id as tag_id2 -- 业务类型
    from(select grp_id, grp_val from dm_index_n.grp_def where status = '1' and grp_type_code = 'OTC_DERI_CONTR_TYPE') s0
    join(select grp_id, tag_id from dm_index_n.grp_tag_OTC_DERI_CONTR_TYPE_rpt_contr_type where busi_date = '${yyyy-MM-dd}') s1
    on s0.grp_id = s1.grp_id
    join(select grp_id, tag_id from dm_index_n.grp_tag_OTC_DERI_CONTR_TYPE_busi_type where busi_date = '${yyyy-MM-dd}') s2
    on s0.grp_id = s2.grp_id
) tg
on idx1.tag_id = tg.tag_id1
join(
    -- tag_id2 业务类型
    -- 今年新增名义本金
    -- 本月存续
    select
        if(idx.tag_id = 'tag074451812', '期权', '互换') as busi_type
        ,idx.tag_id
        ,sum(if(idx.pd_flag = 'cur_year', idx.index_val, 0)) as cur_year_scal -- 今年新增名义本金
        ,sum(if(idx.pd_flag = 'cur_dura', idx.index_val, 0)) as cur_dura_scal -- 本月存续名义本金
    from(
        -- 年新增
        select 'cur_year' as pd_flag, index_val, tag_id, grp_id from dm_index_n.index_grp1_DealScal_OtcDeri_Year where busi_date = '${yyyy-MM-dd}' and tag_id in('tag074451812', 'tag074451813') -- 期权、互换
        union all
        -- 当前存续
        select 'cur_dura' as pd_flag, index_val, tag_id, grp_id from dm_index_n.index_grp1_CompScal_OtcDeri_Tdy where busi_date = '${yyyy-MM-dd}' and tag_id in('tag074451812', 'tag074451813') -- 期权、互换
    ) idx
    join(
        select * from dm_index_n.grp_def where grp_type_code in('COMPANY') and status = '1'
    ) grp
    on idx.grp_id = grp.grp_id
    group by idx.tag_id
) idx2
on tg.tag_id2 = idx2.tag_id 
	) castTable