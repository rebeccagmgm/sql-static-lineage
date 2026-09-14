-- task_id: 70047
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_idx_compnt_info_WD_aindexmembers_grp04
-- observed_at: 2026-09-05T01:06:29.718Z

-- createSql
CREATE TABLE IF NOT EXISTS t02_idx_Compnt_info(
     busi_date       string comment '数据日期'
    ,rec_id          string comment '记录编号'
    ,idx_secu_id     string comment '指数统一证券编号'
    ,con_secu_id     string comment '成分股统一证券编号'
    ,src_sys_prdno   string comment '源系统产品编号'
    ,idx_scr_cd     string comment '指数证券代码'
    ,con_scr_cd     string comment '成份股证券代码'
    ,INDATE          string comment '纳入日期'
    ,OUTDATE         string comment '剔除日期'
    ,curr_flag       string comment '最新标志'
    ,into_date	     string comment'入选日期'
    ,upd_time	     string comment'更新时间'
    ,remark          string comment '备注'
    ,src_tbl         string comment '来源表'
    ,src_rec_id      string comment '来源记录'
    ,rec_upd_time    string comment '记录修改时间'
    ,rec_down_time   string comment '记录创建时间'
)COMMENT '指数成分股信息'
PARTITIONED BY (src_id string comment '来源标识', grp_id string comment '并行标识')
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


insert overwrite table t02_idx_Compnt_info partition (src_id = 'WD', grp_id = '04')
select
     '${data_day_str}' as busi_date
    ,a.object_id as rec_id
    ,b.secu_id as idx_secu_id
    ,c.secu_id as con_secu_id
    ,concat('WD-',a.S_INFO_WINDCODE) as src_sys_prdno
    ,b.scr_cd as idx_scr_cd
    ,c.scr_cd as con_scr_cd
    ,a.S_CON_INDATE as INDATE
    ,a.S_CON_OUTDATE as OUTDATE
    ,a.CUR_SIGN as curr_flag
    ,'中国A股指数成份股' as remark
    ,'odata_msg.wind_w_aindexmembers' as src_tbl
    ,a.object_id as src_rec_id
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss') as rec_upd_time
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss') as rec_down_time
from odata_n_uip.w_aindexmembers a -- 中国A股指数成份股
left join (select secu_id, scr_cd, in_code from t02_scr_BASE_INFO where src_id = 'WD') b on a.s_info_windcode = b.in_code
left join (select secu_id, scr_cd, in_code from t02_scr_BASE_INFO where src_id = 'WD') c on a.S_CON_WINDCODE = c.in_code
where a.busi_date='${data_day_str}'
