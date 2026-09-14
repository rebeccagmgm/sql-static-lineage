-- task_id: 66074
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.kxc_tyzx_scr_clas_info_fnd_rcc_grp02
-- observed_at: 2026-09-05T01:06:26.289Z

-- createSql
CREATE TABLE IF NOT EXISTS tyzx_scr_clas_info(
busi_date              string  comment       '数据日期',
rec_id                 string  comment       '记录编号',
secu_id                string  comment       '统一证券编号',
src_sys_prdno          string  comment       '源系统产品编号',
scr_cd                 string  comment       '证券代码',
clas_cd                string  comment       '分类编码',
clas_name              string  comment       '分类名称',
remark                 string  comment       '备注',
src_tbl                string  comment       '来源表',
src_rec_id             string  comment       '来源记录',
rec_upd_time           string  comment       '记录修改时间',
rec_down_time          string  comment       '记录创建时间'
)COMMENT '证券分类信息'
partitioned by (grp_id string comment '并行分组标识')
stored as orc;

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
set hive.support.concurrency=false;

INSERT OVERWRITE TABLE tyzx_scr_clas_info  partition(grp_id='02')
--select A.busi_date
--     ,A.rec_id
--     ,A.secu_id
--     ,NULL as src_sys_prdno           --源系统产品编号'
--     ,A.scr_cd
--    ,'F12' as  clas_cd
--    ,'场内基金' as clas_name
--    ,'FND' as remark
--    ,'pdata_news_n.t02_scr_type' as src_tbl
--    ,A.src_rec_id
--    ,A.rec_upd_time
--    ,A.rec_down_time
--from (select *from pdata_news_n.t02_scr_type where src_id = 'RCC' and scr_type_std_cd = 'RCC002' and type_cd in  ('6','T','L','A','K','j','M','r','l') and src_tbl<>'ODATA_N_RCC.U_OPTCODE') A


select B.busi_date,B.REC_ID, b.secu_id,NULL as src_sys_prdno,b.scr_cd
    , 'P01' as clas_cd 
    ,'90天期及以上金融产品' clas_name
    , 'SDE' as remark
    ,'pdata_news_n.t02_prd_fin_info' as src_tbl
    ,b.src_rec_id
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as rec_upd_time            --记录修改时间',
	,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as rec_down_time           --记录创建时间'  

from
(select scr_cd from
(select scr_cd,
case when coalesce(intr_days,datediff(from_unixtime(BIGINT(substr(clos_date,1,10)),'yyyy-MM-dd'),from_unixtime(BIGINT(substr(setp_date,1,10)),'yyyy-MM-dd')))<90
and from_unixtime(BIGINT(substr(clos_date,1,10)),'yyyy-MM-dd')<>'1970-01-01' then '1' else '0' end as intr_flag
from pdata_news_n.t02_prd_fin_info
) aa where intr_flag = '0'
) a join 
(select * from pdata_news_n.t02_scr_base_info where src_id = 'XLA') b on a.scr_cd = b.scr_cd

union all

select a.busi_date,a.REC_ID, a.secu_id,NULL as src_sys_prdno,a.scr_cd
    , 'P02' as clas_cd 
    ,'机构份额产品' clas_name
    , 'SDE' as remark
    ,'pdata_news_n.t02_scr_type' as src_tbl
    ,a.src_rec_id
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as rec_upd_time            --记录修改时间',
	,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as rec_down_time           --记录创建时间'  

from 
(
    select *
    from pdata_news_n.t02_scr_type 
    where src_id='PRD' and src_tbl='odata_n_prd.p_prod_manual_label_rel_view'
)a join 
(
    select * 
    from odata_n_prd.p_taglib_value 
    where busi_date='${data_day_str}'
       and label_id='27'
)b on a.type_name_zh = b.tag_value_id

union all

select a.busi_date,a.REC_ID, a.secu_id,NULL as src_sys_prdno,a.scr_cd
    , 'P03' as clas_cd 
    ,'重点持营产品' clas_name
    , 'SDE' as remark
    ,'pdata_news_n.t02_scr_base_info' as src_tbl
    ,a.src_rec_id
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as rec_upd_time            --记录修改时间',
	,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as rec_down_time           --记录创建时间'  

from 
(
    select *
    from pdata_news_n.t02_scr_base_info
    where src_id='PRD' 
)a join 
(
    select
        prod_id
    from odata_n_prd.p_key_prod_rec
    where busi_date='${data_day_str}'
    and status='0'
    group by prod_id
)b on a.rec_id=b.prod_id

union all 

select a.busi_date,a.REC_ID, a.secu_id,NULL as src_sys_prdno,a.scr_cd
    , 'P04' as clas_cd 
    ,'现金增利' clas_name
    , 'SDE' as remark
    ,'pdata_news_n.t02_scr_base_info' as src_tbl
    ,a.src_rec_id
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as rec_upd_time            --记录修改时间',
	,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as rec_down_time           --记录创建时间'  

from 
(
    select *
    from pdata_news_n.t02_scr_base_info
    where src_id='PRD' and secu_id = 'FIN.100000001.026088.99'
) a

union all 

select a.busi_date,a.REC_ID, a.secu_id,NULL as src_sys_prdno,a.scr_cd
    , 'P05' as clas_cd 
    ,'ETF基金持营产品' clas_name
    , 'SDE' as remark
    ,'pdata_news_n.t02_scr_base_info' as src_tbl
    ,a.src_rec_id
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as rec_upd_time            --记录修改时间',
	,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as rec_down_time           --记录创建时间' 
from (
    select *
    from pdata_news_n.t02_scr_base_info
    where src_id='PRD' 
    ) a
join PDATA_NDS.ETF_HOLDING_PRD b on a.scr_cd = b.prd_code

union all
-- wxxieshiyuan 20250418新增财富管理平台-产品-精选持营库-重点聚焦ETF基金专区
select 
    a.busi_date
    ,a.REC_ID
    ,a.secu_id
    ,NULL as src_sys_prdno
    ,a.scr_cd
    ,'P06' as clas_cd 
    ,'重点聚焦ETF基金专区' clas_name
    ,'SDE' as remark
    ,'pdata_news_n.t02_scr_base_info' as src_tbl
    ,a.src_rec_id
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as rec_upd_time            --记录修改时间',
	,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as rec_down_time           --记录创建时间' 
from (
select *
from pdata_news_n.t02_scr_base_info
where src_id='PRD' 
    ) a
join (
select compnt_id
from pdata_n.T00_PRD_POOL_COMPNT_INFO 
where src_tbl='ODATA_N_PRD.P_CUSTOM_WHS_PROD_REL'
    and Pool_Id = '1000328' 
    and del_flag = '0'
group by compnt_id
) b on a.scr_cd = b.compnt_id
