-- task_id: 69312
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_ann_info_WD_grp01
-- observed_at: 2026-09-05T01:06:27.616Z

-- createSql
create table if not exists t02_ann_info(
busi_date      	string	comment'数据日期',
rec_id	        string	comment'记录编号',
secu_id	        string	comment'统一证券编码',
src_sys_prdno	string	comment'源系统产品编号',
corp_id	        string	comment'统一公司编号',
ann_date	    string	comment'公告日期',
info_title	    string	comment'标题',
info_fcode	    string	comment'栏目代码',
info_fname	    string	comment'栏目名称',
info_ftext	    string	comment'摘要',
ann_link	    string	comment'公告链接',
ann_id	        string	comment'公告ID',
collect_time	string	comment'收录时间',
remark	        string	comment'备注',
src_tbl	        string	comment'来源表',
src_rec_id	    string	comment'来源记录 ',
rec_upd_time	string	comment'记录修改时间 ',
rec_down_time	string	comment'记录创建时间 '
) comment '公告信息表'
partitioned by (src_id string comment'数据来源',grp_id string  comment'并行标识')
stored as ORC;

-- querySql
set hive.merge.mapfiles = true ;
set hive.merge.mapredfiles = true;
set hive.merge.size.per.task=1073741824;
set hive.merge.smallfiles.avgsize=1073741824;
set hive.merge.orcfile.stripe.level=false;
set hive.exec.dynamic.partition=true;
set hive.exec.dynamic.partition.mode=nonstrict;
set hive.exec.max.created.files=10000;
set hive.exec.max.dynamic.partitions.pernode=10000;
set hive.exec.max.dynamic.partitions=10000;
set hive.auto.convert.join=false;
set hive.optimize.sort.dynamic.partition=true;
set hive.map.aggr = true;
set hive.groupby.skewindata=true;
set hive.support.concurrency=false;

insert overwrite table t02_ann_info partition(src_id='WD',grp_id='01')
select 
	'${data_day_str}' as  busi_date,      --数据日期
	a.object_id	as	rec_id,
	b.secu_id	    as	secu_id,
	concat('WD-',a.S_INFO_WINDCODE)	as	src_sys_prdno,
	b.corp_id	    as	corp_id,
	regexp_replace(substr(a.ANN_DT,1,10),'-','') as	ann_date,
	a.N_INFO_TITLE	as	info_title,
	a.N_INFO_FCODE	as	info_fcode,
	c.n_info_name	as	info_fname,
	a.N_INFO_FTXT	    as	info_ftext,
	a.N_INFO_ANNLINK	as	ann_link,
	a.ID	 as	ann_id,
	a.COLLECT_DT	as	collect_time,
	''	as	remark,
	'odata_msg.wfd_w_AShareAnninf'	as	src_tbl,
	a.object_id	as	src_rec_id,
	from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')	as	rec_upd_time,
	from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')	as	rec_down_time
from  odata_n_uip.w_ashareanninf  a
left join  (select * from t02_scr_BASE_INFO where src_id='WD') b 
	on a.S_INFO_WINDCODE = b.in_code 
left join ( select * from odata_n_uip.w_ashareanncolumn where busi_date= '${data_day_str}' ) c 
	on a.N_INFO_FCODE =c.n_info_fcode
