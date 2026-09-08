
SELECT deri_type,
	add_nom_prin_mth,
	add_nom_prin_pmth,
	add_nom_prin_mth_rate,
	add_nom_prin_mom,
	add_nom_prin_mom_flag,
	busi_mon FROM (
	 select 
    if(t1.tag_id = 'tag074451812', '期权', '互换') as deri_type -- 衍生品类型
    ,t1.cur_mth_scal / 100000000 as add_nom_prin_mth  -- 本月新增名义本金规模（亿元）
    ,t1.last_mth_scal / 100000000 as add_nom_prin_pmth  -- 上月新增名义本金规模（亿元）
    ,t1.cur_mth_scal / t1.cur_mth_scal_all as add_nom_prin_mth_rate -- 本月新增名义本金规模占比
    ,if(t1.last_mth_scal = 0, 1, t1.cur_mth_scal/t1.last_mth_scal - 1) as add_nom_prin_mom -- 新增名义本金环比
    ,if(if(t1.last_mth_scal = 0, 1, t1.cur_mth_scal/t1.last_mth_scal - 1) > 0, '上升', '下降') as add_nom_prin_mom_flag -- 新增名义本金环比升降标志
    ,'${yyyyMM}' as busi_mon -- 月份
from(
    -- 本月/上月新增名义本金
    select
        idx.tag_id
        ,sum(sum(idx.index_val))over() as cur_mth_scal_all -- 本月新增规模(总)
        ,sum(if(idx.busi_date = '${yyyy-MM-dd}', idx.index_val, 0)) as cur_mth_scal -- 本月新增规模
        ,sum(if(idx.busi_date = last_day('${yyyy-MM-dd,-1M}'), idx.index_val, 0)) as last_mth_scal -- 上月新增规模
    from dm_index_n.index_grp1_DealScal_OtcDeri_Mth idx
    join(
        select * from dm_index_n.grp_def where grp_type_code in('COMPANY') and status = '1'
    ) grp
    on idx.grp_id = grp.grp_id
    where idx.busi_date in('${yyyy-MM-dd}', last_day('${yyyy-MM-dd,-1M}'))
    and idx.tag_id in('tag074451812', 'tag074451813') -- 期权、互换
    group by idx.tag_id
) t1 
	) castTable