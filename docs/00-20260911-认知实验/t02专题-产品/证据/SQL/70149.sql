-- task_id: 70149
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_fxr_cfets_quot_TL_mkt_fx_ref_rate_grp01
-- observed_at: 2026-09-05T01:06:30.136Z

-- createSql
create table if not exists t02_fxr_cfets_quot(

 busi_date          string    comment'数据日期'
,rec_id			    string    comment'记录编号'
,trd_dt			    string    comment'交易日期'
,crrc_cd		    string    comment'货币代码（本币)'
,Frgn_crrc_cd	    string    comment'货币代码(外币)'
,src_crrc_cd	    string    comment'源头货币代码'
,Mid_price		    string    comment'中间价'
,remark			    string    comment'备注'
,src_tbl		    string    comment'来源表'
,src_rec_id		    string    comment'来源记录'
,rec_upd_time	    string    comment'记录修改时间'
,rec_down_time	    string    comment'记录创建时间'

)COMMENT '外汇交易中心汇率中间价' 
partitioned by ( src_id string comment '数据来源', grp_id string comment '并行分组标识')
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


INSERT overwrite TABLE t02_fxr_cfets_quot  partition(src_id='TL',grp_id='01')
SELECT 
     '${data_day_str}'             -- 数据日期            
     ,a.id                              -- 记录编号         
     ,from_unixtime( unix_timestamp(a.TRADE_DATE,'yyyy-MM-dd' ),'yyyyMMdd')                      -- 交易日期         
     ,b.const_cd                        -- 货币代码（本币)  
     ,c.const_cd                        -- 货币代码(外币)   
     ,a.CURRENCY_PAIR                   -- 源头货币代码     
     ,a.MID_RATE                        -- 中间价           
     ,a.UPDATE_TIME                     -- 备注             
     ,'odata_n_uip.q_mkt_fx_ref_rate'   -- 来源表           
     ,a.id                              -- 来源记录         
     ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')    -- 记录修改时间     
     ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')    -- 记录创建时间     

FROM ( select * FROM odata_n_uip.q_mkt_fx_ref_rate WHERE busi_date='${data_day_str}' ) a
LEFT JOIN 
( SELECT * FROM t02_pub_covt_const  where const_type_cd = 'fin00001' and src_id ='TL') b ON regexp_replace(split(a.CURRENCY_PAIR,'/')[0],'100','') = b.src_const_cd
LEFT JOIN 
( SELECT * FROM t02_pub_covt_const  where const_type_cd = 'fin00001' and src_id ='TL') c ON regexp_replace(split(a.CURRENCY_PAIR,'/')[1],'100','') = c.src_const_cd

;
