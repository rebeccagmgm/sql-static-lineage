-- task_id: 160753
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm02/pdata_news_n.t02_tit_prd_asset_info_TIT_prd_product_asset_grp01
-- observed_at: 2026-09-05T01:07:04.747Z

-- createSql
create table if not exists t02_tit_prd_asset_info(

     busi_date       STRING COMMENT  '数据日期' 
    ,rec_id          STRING COMMENT  '记录编号' 
    ,prd_id          STRING COMMENT  '产品id' 
    ,undrl_scr_cd    STRING COMMENT  '标的证券代码' 
    ,undrl_secu_id   STRING COMMENT  '标的统一证券代码' 
    ,inr_trd_jour_no STRING COMMENT  '内部交易流水号' 
    ,remark          STRING COMMENT  '备注' 
    ,src_tbl         STRING COMMENT  '来源表' 
    ,src_rec_id      STRING COMMENT  '来源记录' 
    ,rec_upd_time    STRING COMMENT  '记录修改时间' 
    ,rec_down_time   STRING COMMENT  '记录创建时间' 

) comment 'TIT产品底层资产信息表'
partitioned by (src_id STRING COMMENT '数据来源',grp_id STRING COMMENT '分组标识')
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
set hive.support.concurrency=false;


INSERT OVERWRITE TABLE t02_tit_prd_asset_info PARTITION (src_id = 'TIT',grp_id = '01')
SELECT  '${data_day_str}'                                AS busi_date --数据日期 
       ,a.id                                                  AS rec_id --记录编号 
       ,a.key_prod_id                                         AS prd_id --产品id 
       ,a.key_instrument_id                                   AS undrl_scr_cd --标的证券代码 
       ,b.secu_id                                             AS undrl_secu_id --标的统一证券代码 
       ,a.internal_trade_id                                   AS inr_trd_jour_no --内部交易流水号 
       ,''                                                    AS remark --备注 
       ,'odata_n_tit.p_prd_product_asset'                     AS src_tbl --来源表 
       ,a.id                                                  AS src_rec_id --来源记录 
       ,from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') AS rec_upd_time --记录修改时间 
       ,from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') AS rec_down_time --记录创建时间 
FROM
(
	SELECT  *
	FROM odata_n_tit.p_prd_product_asset
	WHERE busi_date = '${data_day_str}' 
) a
LEFT JOIN
(
	SELECT  *
	FROM t02_scr_base_info
	WHERE src_id = 'TIT'
) b
ON a.key_instrument_id = b.in_code
;
