-- task_id: 104575
-- hiveDb: dm_index_n
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-dm_index_n/grp_def/dm_index_n.grp_def_kxc_base.py
-- observed_at: 2026-09-03T05:52:00.790Z

-- createSql
create table if not exists dm_index_n.grp_def (
  begin_date string comment '开始日期',
  end_date string comment '结束日期',
  grp_id string comment '组合ID',
  grp_val string comment '组合值',
  grp_name string comment '组合名称',
  data_time string comment '数据时间',
  modify_operator string comment '修改人',
  modify_time string comment '修改时间',
  status string comment '状态 1：可用 0：已失效'
)
comment '组合定义'
PARTITIONED BY (grp_type_code string comment '组合类型代码' )
STORED AS orc ;

create table grp_def_tmp_SRC_CHAN_ID as select '1900-01-01' begin_date,'2099-12-31' end_date,src_chan_id as grp_val,'引流渠道标识' as grp_name from (
  select * from pdata_n.t08_gks_chan_info where del_flag='0'
)
a;

-- querySql
drop table grp_def_tmp_SRC_CHAN_ID;

insert overwrite table dm_index_n.grp_def partition (grp_type_code='SRC_CHAN_ID')
select t1.begin_date,
t1.end_date,
concat('grp','0076',lpad(cast(row_number() over(order by t1.grp_val) +coalesce(t2.max_grp_id,0) as string),16,'0')) grp_id,
t1.grp_val,
t1.grp_name,
from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') data_time,
'huangxin' modify_operator,
'2099-12-31 00:00:00' modify_time,
'1' status
from grp_def_tmp_SRC_CHAN_ID t1
left join (select grp_type_code,cast(substr(max(grp_id),8) as bigint) max_grp_id
from dm_index_n.grp_def
where grp_type_code = 'SRC_CHAN_ID'
group by grp_type_code) t2
on 1 = 1
left join (select *
from dm_index_n.grp_def
where grp_type_code = 'SRC_CHAN_ID') t3
on t1.grp_val = t3.grp_val
where t3.grp_id is null
union all
select t1.begin_date,
t1.end_date,
t2.grp_id,
t2.grp_val,
t1.grp_name,
from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') data_time,
'huangxin' modify_operator,
(case when t1.begin_date = t2.begin_date and t1.end_date = t2.end_date and t1.grp_name = t2.grp_name then t2.modify_time else from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') end) modify_time,
'1' status
from grp_def_tmp_SRC_CHAN_ID t1
join (select *
from dm_index_n.grp_def
where grp_type_code = 'SRC_CHAN_ID')t2
on t1.grp_val = t2.grp_val
union all
select t1.begin_date,
(case when t1.end_date > date_sub('2026-05-18',1) then date_sub('2026-05-18',1)  else t1.end_date end) end_date,
t1.grp_id,
t1.grp_val,
t1.grp_name,
from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') data_time,
'huangxin' modify_operator,
(case when t1.end_date > date_sub('2026-05-18',1) then from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') else t1.modify_time end) modify_time,
'0' status
from (select *
from dm_index_n.grp_def
where grp_type_code = 'SRC_CHAN_ID') t1
left join grp_def_tmp_SRC_CHAN_ID t2
on t1.grp_val = t2.grp_val
where t2.grp_val is null;
