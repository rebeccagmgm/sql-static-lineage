-- task_id: 176204
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm02/pdata_news_n.t02_opt_base_info_tit_TIT_ref_listed_option_props_grp01
-- observed_at: 2026-09-05T01:07:10.727Z

-- createSql
CREATE TABLE if not exists t02_opt_base_info_tit( 
     busi_date         STRING COMMENT  '数据日期' 
    ,rec_id            STRING COMMENT  '记录编号' 
    ,secu_id           STRING COMMENT  '统一证券编码' 
    ,src_sys_prdno     STRING COMMENT  '源系统产品编号' 
    ,scr_in_code       STRING COMMENT  '证券内码' 
    ,undrl_scr_in_code STRING COMMENT  '标的证券内码' 
    ,data_src          STRING COMMENT  '数据源' 
    ,comp_cd           STRING COMMENT  '合约编码' 
    ,comp_name_wd      STRING COMMENT  '月合约名称的Wind全称' 
    ,comp_trd_cd       STRING COMMENT  '合约交易代码' 
    ,comp_abbr         STRING COMMENT  '合约简称' 
    ,comp_unit         STRING COMMENT  '合约单位' 
    ,comp_type         STRING COMMENT  '合约类型' 
    ,exer_pric         STRING COMMENT  '行权价格' 
    ,deli_mon          STRING COMMENT  '交割月份' 
    ,maty_date         STRING COMMENT  '到期日' 
    ,strt_trd_date     STRING COMMENT  '开始交易日' 
    ,last_trd_date     STRING COMMENT  '最后交易日' 
    ,last_exer_date    STRING COMMENT  '最后行权日' 
    ,last_deli_date    STRING COMMENT  '最后交割日' 
    ,list_bm_pric      STRING COMMENT  '挂牌基准价' 
    ,trd_flag          STRING COMMENT  '交易标志(0否1是)' 
    ,adj_flag          STRING COMMENT  '调整标志' 
    ,upd_prsn          STRING COMMENT  '更新人' 
    ,src_create_date   STRING COMMENT  '源创建日期' 
    ,creator           STRING COMMENT  '创建人' 
    ,remark            STRING COMMENT  '备注' 
    ,min_offer_unit    STRING COMMENT  '最小报价单位'               --新增字段 by wxliupengfei 20241029
    ,exer_way          STRING COMMENT  '行权方式'                   --新增字段 by wxliupengfei 20241029
    ,src_tbl           STRING COMMENT  '来源表' 
    ,src_rec_id        STRING COMMENT  '来源记录' 
    ,rec_upd_time      STRING COMMENT  '记录修改时间' 
    ,rec_down_time     STRING COMMENT  '记录创建时间' 
)COMMENT '期权基础信息tit' 
partitioned by (src_id string comment'来源标识',grp_id string comment'并行标识')

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


INSERT overwrite TABLE t02_opt_base_info_tit partition(src_id='TIT',grp_id='01')
SELECT  '${data_day_str}'                                                                          AS busi_date --数据日期 
       ,''                                                                                              AS rec_id --记录编号 
       ,b.secu_id                                                                                       AS secu_id --统一证券编码 
       ,b.src_sys_prdno                                                                                 AS src_sys_prdno --源系统产品编号 
       ,a.key_instrument_id                                                                             AS scr_in_code --证券内码 
       ,a.underlying_ins_id                                                                             AS undrl_scr_in_code --标的证券内码 
       ,a.data_source                                                                                   AS data_src --数据源 
       ,a.option_code_for_trade                                                                         AS comp_cd --合约编码 
       ,a.option_name_for_trade                                                                         AS comp_name_wd --月合约名称的Wind全称 
       ,a.option_code_in_exch                                                                           AS comp_trd_cd --合约交易代码 
       ,a.option_name_in_exch                                                                           AS comp_abbr --合约简称 
       ,a.contract_multiplier                                                                           AS comp_unit --合约单位 
       ,a.callput                                                                                       AS comp_type --合约类型 
       ,a.strike_price                                                                                  AS exer_pric --行权价格 
       ,a.delivery_month                                                                                AS deli_mon --交割月份 
       ,a.maturity_date                                                                                 AS maty_date --到期日 
       ,from_unixtime(unix_timestamp(a.first_trading_date,'yyyy-MM-dd HH:mm:ss'),'yyyyMMdd')            AS strt_trd_date --开始交易日 
       ,from_unixtime(unix_timestamp(a.last_trading_date,'yyyy-MM-dd HH:mm:ss'),'yyyyMMdd')             AS last_trd_date --最后交易日 
       ,from_unixtime(unix_timestamp(a.last_exercisable_date,'yyyy-MM-dd HH:mm:ss'),'yyyyMMdd')         AS last_exer_date --最后行权日 
       ,from_unixtime(unix_timestamp(a.last_delivery_date,'yyyy-MM-dd HH:mm:ss'),'yyyyMMdd')            AS last_deli_date --最后交割日 
       ,a.listed_price                                                                                  AS list_bm_pric --挂牌基准价 
       ,a.tradable                                                                                      AS trd_flag --交易标志(0否1是) 
       ,a.adj_sign                                                                                      AS adj_flag --调整标志 
       ,a.updated_by                                                                                    AS upd_prsn --更新人 
       ,from_unixtime(unix_timestamp(a.created_datetime),'yyyy-MM-dd HH:mm:ss')                         AS src_create_date --源创建日期 
       ,a.created_by                                                                                    AS creator --创建人 
       ,a.minpricefluct                                                                                 AS min_offer_unit --最小报价单位   --新增字段 by wxliupengfei 20241029
       ,a.exercise_type                                                                                 AS exer_way  --行权方式            --新增字段 by wxliupengfei 20241029
       ,''                                                                                              AS remark --备注 
       ,'odata_n_tit.r_ref_listed_option_props'                                                         AS src_tbl --来源表 
       ,''                                                                                              AS src_rec_id --来源记录 
       ,from_unixtime(unix_timestamp(a.updated_datetime),'yyyy-MM-dd HH:mm:ss')                         AS rec_upd_time --记录修改时间 
       ,from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss')                                           AS rec_down_time --记录创建时间 

FROM
(
	SELECT  *
	FROM odata_n_tit.r_ref_listed_option_props
	WHERE busi_date = '${data_day_str}' 
) a
left join 
(
	select * from t02_scr_base_info where src_id = 'TIT'
) b
on a.key_instrument_id = b.in_code

;
