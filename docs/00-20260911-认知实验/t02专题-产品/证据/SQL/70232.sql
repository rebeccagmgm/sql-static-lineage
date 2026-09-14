-- task_id: 70232
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_prd_unit_nav_h_WD
-- observed_at: 2026-09-05T01:06:30.389Z

-- createSql
create table if not exists t02_prd_unit_nav_h
(  
rec_id           string      comment '记录编号'
,secu_id         string      comment '统一证券编号'
,src_sys_prdno   string      comment '源系统产品编号'
,scr_cd          string      comment '证券代码'
,crrc_cd         string      comment '货币代码'
,ann_date        string      comment '发布日期'
,trd_dt          string      comment '净值日期'
,shr_nav         string      comment '单位净值'
,unit_yld        string      comment '每万元基金单位当日收益'
,annu_yld_rat    string      comment '最近7日折算年收益率'
,accum_shr_nav   string      comment '累计净值'
,nav_adj_Fctr    string      comment '复权因子'
,net_asset       string      comment '资产净值'
,asset_mer_shr_flag         string      comment '是否合计数据'
,ttl_netasset    string      comment '合计资产净值'
,adj_shr_nav     string      comment '复权单位净值'
,ex_dr_dt_flag   string      comment '是否净值除权日'
,nav_distr       string      comment '累计单位分配'
,unit_yld_14     string      comment '14日年化收益'
,unit_yld_28     string      comment '28日年化收益'
,src_tbl         string      comment '来源表'
,src_rec_id      string      comment '来源记录'
,rec_upd_time    string      comment '记录修改时间'
,rec_down_time   string      comment '记录创建时间'
) comment '基金净值表'
partitioned by (busi_date string comment '数据日期',src_id string comment '来源标识')
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
--当日数据
insert overwrite table t02_prd_unit_nav_h partition (busi_date='${data_day_str}',src_id='WD')
select   
     a.object_id                                                     as rec_id
    ,c.secu_id                                                       as secu_id
    ,c.src_sys_prdno                                                 as src_sys_prdno
    ,c.scr_cd                                                     as scr_cd
    ,coalesce(co.const_cd,a.CRNCY_CODE)                              as crrc_cd
    ,a.ANN_DATE                                                      as ann_date
    ,a.PRICE_DATE                                                    as trd_dt
    ,a.F_NAV_UNIT                                                    as shr_nav
    ,''                                                              as unit_yld
    ,''                                                              as annu_yld_rat
    ,a.F_NAV_ACCUMULATED                                             as accum_shr_nav
    ,a.F_NAV_ADJFACTOR                                               as nav_adj_Fctr
    ,a.F_PRT_NETASSET                                                as net_asset
    ,a.F_ASSET_MERGEDSHARESORNOT                                     as asset_mer_shr_flag
    ,a.NETASSET_TOTAL                                                as ttl_netasset
    ,a.F_NAV_ADJUSTED                                                as adj_shr_nav
    ,a.IS_EXDIVIDENDDATE                                             as ex_dr_dt_flag
    ,a.F_NAV_DISTRIBUTION                                            as nav_distr
    ,''                                                              as unit_yld_14
    ,''                                                              as unit_yld_28
    ,'odata_msg.wind_w_chinamutualfundnav'                                            as src_tbl
    ,a.object_id                                                     as src_rec_id
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')          as rec_upd_time
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')          as rec_down_time       
 	
from  
(
    select *
    from odata_n_uip.w_chinamutualfundnav
    where price_date='${data_day_int}'
) a
left join (select * from t02_pub_covt_const where const_type_cd = 'fin00001' and  src_id='WD') co
on a.CRNCY_CODE=co.src_const_cd
 join 
( select * from t02_scr_base_info where Src_Id = 'WD' ) c
on a.f_info_windcode=c.in_code
;

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
--由于部分基金有延迟公布净值数据,所以重刷上5个交易日数据
insert overwrite table t02_prd_unit_nav_h partition (busi_date,src_id)
select 
   
     a.object_id                                                     as rec_id
    ,c.secu_id                                                       as secu_id
    ,c.src_sys_prdno                                                 as src_sys_prdno
    ,c.scr_cd                                                        as scr_cd
    ,coalesce(co.const_cd,a.CRNCY_CODE)                              as crrc_cd
    ,a.ANN_DATE                                                      as ann_date
    ,a.PRICE_DATE                                                    as trd_dt
    ,a.F_NAV_UNIT                                                    as shr_nav
    ,''                                                              as unit_yld
    ,''                                                              as annu_yld_rat
    ,a.F_NAV_ACCUMULATED                                             as accum_shr_nav
    ,a.F_NAV_ADJFACTOR                                               as nav_adj_Fctr
    ,a.F_PRT_NETASSET                                                as net_asset
    ,a.F_ASSET_MERGEDSHARESORNOT                                     as asset_mer_shr_flag
    ,a.NETASSET_TOTAL                                                as ttl_netasset
    ,a.F_NAV_ADJUSTED                                                as adj_shr_nav
    ,a.IS_EXDIVIDENDDATE                                             as ex_dr_dt_flag
    ,a.F_NAV_DISTRIBUTION                                            as nav_distr
    ,''                                                              as unit_yld_14
    ,''                                                              as unit_yld_28
    ,'odata_msg.wind_w_chinamutualfundnav'                           as src_tbl
    ,a.object_id                                                     as src_rec_id
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')          as rec_upd_time
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')          as rec_down_time
    ,default.pretradedate('${data_day_str}',1)                  as busi_date
    ,'WD'                                                            as src_id
  
from  
(
    select *
    from odata_n_uip.w_chinamutualfundnav
    where price_date=default.date2datekey(default.pretradedate('${data_day_str}',1))
) a
left join (select * from t02_pub_covt_const where const_type_cd = 'fin00001' and  src_id='WD') co
on a.CRNCY_CODE=co.src_const_cd
 join 
( select * from t02_scr_base_info where Src_Id = 'WD' ) c
on a.f_info_windcode=c.in_code
union all
select 
   
     a.object_id                                                     as rec_id
    ,c.secu_id                                                       as secu_id
    ,c.src_sys_prdno                                                 as src_sys_prdno
    ,c.scr_cd                                                     as scr_cd
    ,coalesce(co.const_cd,a.CRNCY_CODE)                              as crrc_cd
    ,a.ANN_DATE                                                      as ann_date
    ,a.PRICE_DATE                                                    as trd_dt
    ,a.F_NAV_UNIT                                                    as shr_nav
    ,''                                                              as unit_yld
    ,''                                                              as annu_yld_rat
    ,a.F_NAV_ACCUMULATED                                             as accum_shr_nav
    ,a.F_NAV_ADJFACTOR                                               as nav_adj_Fctr
    ,a.F_PRT_NETASSET                                                as net_asset
    ,a.F_ASSET_MERGEDSHARESORNOT                                     as asset_mer_shr_flag
    ,a.NETASSET_TOTAL                                                as ttl_netasset
    ,a.F_NAV_ADJUSTED                                                as adj_shr_nav
    ,a.IS_EXDIVIDENDDATE                                             as ex_dr_dt_flag
    ,a.F_NAV_DISTRIBUTION                                            as nav_distr
    ,''                                                              as unit_yld_14
    ,''                                                              as unit_yld_28
    ,'odata_msg.wind_w_chinamutualfundnav'                                            as src_tbl
    ,a.object_id                                                     as src_rec_id
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')          as rec_upd_time
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')          as rec_down_time
    ,default.pretradedate('${data_day_str}',2)                  as busi_date
    ,'WD'                                                            as src_id
  
from  
(
    select *
    from odata_n_uip.w_chinamutualfundnav
    where price_date=default.date2datekey(default.pretradedate('${data_day_str}',2))
) a
left join (select * from t02_pub_covt_const where const_type_cd = 'fin00001' and  src_id='WD') co
on a.CRNCY_CODE=co.src_const_cd
 join 
( select * from t02_scr_base_info where Src_Id = 'WD' ) c
on a.f_info_windcode=c.in_code
union all
select 
   
     a.object_id                                                     as rec_id
    ,c.secu_id                                                       as secu_id
    ,c.src_sys_prdno                                                 as src_sys_prdno
    ,c.scr_cd                                                     as scr_cd
    ,coalesce(co.const_cd,a.CRNCY_CODE)                              as crrc_cd
    ,a.ANN_DATE                                                      as ann_date
    ,a.PRICE_DATE                                                    as trd_dt
    ,a.F_NAV_UNIT                                                    as shr_nav
    ,''                                                              as unit_yld
    ,''                                                              as annu_yld_rat
    ,a.F_NAV_ACCUMULATED                                             as accum_shr_nav
    ,a.F_NAV_ADJFACTOR                                               as nav_adj_Fctr
    ,a.F_PRT_NETASSET                                                as net_asset
    ,a.F_ASSET_MERGEDSHARESORNOT                                     as asset_mer_shr_flag
    ,a.NETASSET_TOTAL                                                as ttl_netasset
    ,a.F_NAV_ADJUSTED                                                as adj_shr_nav
    ,a.IS_EXDIVIDENDDATE                                             as ex_dr_dt_flag
    ,a.F_NAV_DISTRIBUTION                                            as nav_distr
    ,''                                                              as unit_yld_14
    ,''                                                              as unit_yld_28
    ,'odata_msg.wind_w_chinamutualfundnav'                                            as src_tbl
    ,a.object_id                                                     as src_rec_id
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')          as rec_upd_time
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')          as rec_down_time
    ,default.pretradedate('${data_day_str}',3)                  as busi_date
    ,'WD'                                                            as src_id
  
from  
(
    select *
    from odata_n_uip.w_chinamutualfundnav
    where price_date=default.date2datekey(default.pretradedate('${data_day_str}',3))
) a
left join (select * from t02_pub_covt_const where const_type_cd = 'fin00001' and  src_id='WD') co
on a.CRNCY_CODE=co.src_const_cd
 join 
( select * from t02_scr_base_info where Src_Id = 'WD' ) c
on a.f_info_windcode=c.in_code
union all
select 
   
     a.object_id                                                     as rec_id
    ,c.secu_id                                                       as secu_id
    ,c.src_sys_prdno                                                 as src_sys_prdno
    ,c.scr_cd                                                     as scr_cd
    ,coalesce(co.const_cd,a.CRNCY_CODE)                              as crrc_cd
    ,a.ANN_DATE                                                      as ann_date
    ,a.PRICE_DATE                                                    as trd_dt
    ,a.F_NAV_UNIT                                                    as shr_nav
    ,''                                                              as unit_yld
    ,''                                                              as annu_yld_rat
    ,a.F_NAV_ACCUMULATED                                             as accum_shr_nav
    ,a.F_NAV_ADJFACTOR                                               as nav_adj_Fctr
    ,a.F_PRT_NETASSET                                                as net_asset
    ,a.F_ASSET_MERGEDSHARESORNOT                                     as asset_mer_shr_flag
    ,a.NETASSET_TOTAL                                                as ttl_netasset
    ,a.F_NAV_ADJUSTED                                                as adj_shr_nav
    ,a.IS_EXDIVIDENDDATE                                             as ex_dr_dt_flag
    ,a.F_NAV_DISTRIBUTION                                            as nav_distr
    ,''                                                              as unit_yld_14
    ,''                                                              as unit_yld_28
    ,'odata_msg.wind_w_chinamutualfundnav'                                            as src_tbl
    ,a.object_id                                                     as src_rec_id
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')          as rec_upd_time
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')          as rec_down_time
    ,default.pretradedate('${data_day_str}',4)                  as busi_date
    ,'WD'                                                            as src_id
  
from  
(
    select *
    from odata_n_uip.w_chinamutualfundnav
    where price_date=default.date2datekey(default.pretradedate('${data_day_str}',4))
) a
left join (select * from t02_pub_covt_const where const_type_cd = 'fin00001' and  src_id='WD') co
on a.CRNCY_CODE=co.src_const_cd
 join 
( select * from t02_scr_base_info where Src_Id = 'WD' ) c
on a.f_info_windcode=c.in_code
union all
select 
   
     a.object_id                                                     as rec_id
    ,c.secu_id                                                       as secu_id
    ,c.src_sys_prdno                                                 as src_sys_prdno
    ,c.scr_cd                                                     as scr_cd
    ,coalesce(co.const_cd,a.CRNCY_CODE)                              as crrc_cd
    ,a.ANN_DATE                                                      as ann_date
    ,a.PRICE_DATE                                                    as trd_dt
    ,a.F_NAV_UNIT                                                    as shr_nav
    ,''                                                              as unit_yld
    ,''                                                              as annu_yld_rat
    ,a.F_NAV_ACCUMULATED                                             as accum_shr_nav
    ,a.F_NAV_ADJFACTOR                                               as nav_adj_Fctr
    ,a.F_PRT_NETASSET                                                as net_asset
    ,a.F_ASSET_MERGEDSHARESORNOT                                     as asset_mer_shr_flag
    ,a.NETASSET_TOTAL                                                as ttl_netasset
    ,a.F_NAV_ADJUSTED                                                as adj_shr_nav
    ,a.IS_EXDIVIDENDDATE                                             as ex_dr_dt_flag
    ,a.F_NAV_DISTRIBUTION                                            as nav_distr
    ,''                                                              as unit_yld_14
    ,''                                                              as unit_yld_28
    ,'odata_msg.wind_w_chinamutualfundnav'                                            as src_tbl
    ,a.object_id                                                     as src_rec_id
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')          as rec_upd_time
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')          as rec_down_time
    ,default.pretradedate('${data_day_str}',5)                  as busi_date
    ,'WD'                                                            as src_id
  
from  
(
    select *
    from odata_n_uip.w_chinamutualfundnav
    where price_date=default.date2datekey(default.pretradedate('${data_day_str}',5))
) a
left join (select * from t02_pub_covt_const where const_type_cd = 'fin00001' and  src_id='WD') co
on a.CRNCY_CODE=co.src_const_cd
 join 
( select * from t02_scr_base_info where Src_Id = 'WD' ) c
on a.f_info_windcode=c.in_code



--20221209  新增接入odata_n_uip.w_iamfundnav，odata_n_uip.w_chinainhousefundnav源
---------保险资管产品净值	odata_n_uip.w_iamfundnav


union all

select 
     a.object_id                                                     as rec_id
    ,c.secu_id                                                       as secu_id
    ,c.src_sys_prdno                                                 as src_sys_prdno
    ,c.scr_cd                                                     	as scr_cd
    ,coalesce(co.const_cd,a.CRNCY_CODE)                              as crrc_cd
    ,''		                                                      as ann_date
    ,a.PRICE_DATE                                                    as trd_dt
    ,a.F_NAV_UNIT                                                    as shr_nav
    ,''                                                              as unit_yld
    ,''                                                              as annu_yld_rat
    ,a.F_NAV_ACCUMULATED                                             as accum_shr_nav
    ,a.F_NAV_ADJFACTOR                                               as nav_adj_Fctr
    ,''                                               				as net_asset
    ,''                                  							 as asset_mer_shr_flag
    ,''                                              				as ttl_netasset
    ,a.F_NAV_ADJUSTED                                                as adj_shr_nav
    ,''                                          					as ex_dr_dt_flag
    ,a.F_NAV_DIVACCUMULATED                                        as nav_distr
    ,''                                                              as unit_yld_14
    ,''                                       						 as unit_yld_28
    ,'odata_n_uip.w_iamfundnav'                                      as src_tbl
    ,a.object_id                                                     as src_rec_id
    ,from_unixtime(unix_timestamp(a.opdate), 'yyyy-MM-dd HH:mm:ss')  as rec_upd_time
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')          as rec_down_time
    ,default.datekey2date(a.price_date)  						as busi_date
    ,'WD'                                                            as src_id
from  
(
    select *
    from odata_n_uip.w_iamfundnav
    where price_date>=default.date2datekey(default.pretradedate('${data_day_str}',5))
	and price_date<=default.date2datekey('${data_day_str}')
) a
left join (select * from t02_pub_covt_const where src_id = 'WD' and const_type_cd = 'fin00001' and match_type_cd = '10002') co
on a.CRNCY_CODE=co.src_const_cd
 join 
( select * from t02_scr_base_info where Src_Id = 'WD' ) c
on a.f_info_windcode=c.in_code

---------中国券商理财净值	odata_n_uip.w_chinainhousefundnav

union all

select 
     a.object_id                                                     as rec_id
    ,c.secu_id                                                       as secu_id
    ,c.src_sys_prdno                                                 as src_sys_prdno
    ,c.scr_cd                                                     	as scr_cd
    ,coalesce(co.const_cd,a.CRNCY_CODE)                              as crrc_cd
    ,a.ANN_DATE                                                      as ann_date
    ,a.PRICE_DATE                                                    as trd_dt
    ,a.F_NAV_UNIT                                                    as shr_nav
    ,''                                                              as unit_yld
    ,''                                                              as annu_yld_rat
    ,a.F_NAV_ACCUMULATED                                             as accum_shr_nav
    ,a.F_NAV_ADJFACTOR                                               as nav_adj_Fctr
    ,''                                               				as net_asset
    ,''                                  							 as asset_mer_shr_flag
    ,''                                              				as ttl_netasset
    ,a.F_NAV_ADJUSTED                                                as adj_shr_nav
    ,''                                          					as ex_dr_dt_flag
    ,a.F_NAV_DIVACCUMULATED                                        as nav_distr
    ,''                                                              as unit_yld_14
    ,''                                       						 as unit_yld_28
    ,'odata_n_uip.w_chinainhousefundnav'                                      as src_tbl
    ,a.object_id                                                     as src_rec_id
    ,from_unixtime(unix_timestamp(a.opdate), 'yyyy-MM-dd HH:mm:ss')     as rec_upd_time
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')          as rec_down_time
    ,default.datekey2date(a.price_date)     							as busi_date
    ,'WD'                                                            as src_id
from  
(
    select *
    from odata_n_uip.w_chinainhousefundnav
    where price_date>=default.date2datekey(default.pretradedate('${data_day_str}',5))
	and price_date<=default.date2datekey('${data_day_str}')
) a
left join (select * from t02_pub_covt_const where src_id = 'WD' and const_type_cd = 'fin00001' and match_type_cd = '10002') co
on a.CRNCY_CODE=co.src_const_cd
 join 
( select * from t02_scr_base_info where Src_Id = 'WD' ) c
on a.f_info_windcode=c.in_code

;
