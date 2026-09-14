-- task_id: 202469
-- hiveDb: pdata_nds
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/NDS/pdata_nds.upload_empkpi_chanowner_2025.py
-- observed_at: 2026-09-05T01:07:19.124Z

-- createSql
create table if not exists upload_empkpi_chanowner_2025(
    lvl2_chan string comment '二级渠道',
    lvl3_chan string comment '三级渠道',
    chan_owner_id string comment '考核人编号',
    chan_owner_name string comment '考核人名称',
    tmp string comment '备注',
    data_time string comment '数据时间'
) STORED AS ORC;

-- querySql
insert overwrite table upload_empkpi_chanowner_2025
select 
    coalesce(t3.lvl2_cate,t1.lvl2_chan) lvl2_chan,   
    case when nvl(t1.lvl3_chan,'') = '' then t4.lvl3_cate else t1.lvl3_chan end lvl3_chan,  --补齐三级渠道
    concat_ws('|',collect_set(t2.emp_id)) chan_owner_id,
    concat_ws('|',collect_set(t2.emp_name)) chan_owner_name,
    max(tmp) tmp,
    from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') data_time
from (
    select
        case when length(lvl2_chan) > 0 then lvl2_chan end lvl2_chan,
        case when length(lvl3_chan) > 0 then lvl3_chan end lvl3_chan,
        chan_owner,
        tmp,
        trim(chan_owner_name) chan_owner_name  --去除空格
    from query_upload.empkpi_chanowner_2025
    lateral view explode(split(default.full2half(chan_owner),'\\\\\\|')) chan_owner_tmp as chan_owner_name
) t1 
left join (
    select emp_id,emp_name
    from pdata_n.t98_org_emp_base_info  --员工基本信息表
    where busi_date = '{data_day_str}'
        and emp_cate_cd in ('1','2','3')
        and bel_inr_org_id_len4 in ('8032','0315')
        and emp_stat_cd = '0'  --在职
) t2 on t1.chan_owner_name = t2.emp_name
left join (
    select 
        lvl1_cate,
        lvl2_cate,
        lvl3_cate
    from pdata_n.t08_gks_chan_info 
    where del_flag = '0' and coalesce(lvl3_cate,'') <> ''
    group by lvl1_cate,
        lvl2_cate,
        lvl3_cate
) t3 on t1.lvl3_chan = t3.lvl3_cate
left join (
    select 
        lvl1_cate,
        lvl2_cate,
        lvl3_cate
    from pdata_n.t08_gks_chan_info 
    where del_flag = '0' and coalesce(lvl3_cate,'') <> ''
    group by lvl1_cate,
        lvl2_cate,
        lvl3_cate
) t4 on t1.lvl2_chan = t4.lvl2_cate
group by coalesce(t3.lvl2_cate,t1.lvl2_chan),
    case when nvl(t1.lvl3_chan,'') = '' then t4.lvl3_cate else t1.lvl3_chan end
;
