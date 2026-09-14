-- task_id: 155318
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm03/pdata_news_n.t02_ira_ibor_WD_hiborprices_grp03
-- observed_at: 2026-09-05T01:07:02.688Z

-- createSql
CREATE TABLE IF NOT EXISTS t02_ira_ibor(
    busi_date               string 	comment '数据日期'
   ,rec_id                  string 	comment '记录编号'
   ,secu_id                 string 	comment '统一证券编号'
   ,src_sys_prdno           string 	comment '源系统产品编号'
   ,trd_dt		              string 	comment '交易日期'
   ,crrc_cd                 string 	comment '货币代码'
   ,ir         				      string 	comment '利率'
   ,scr_abbr         		    string 	comment '证券简称'
   ,scr_name        		    string 	comment '证券全称'
   ,scr_cd         			    string 	comment '交易代码'
   ,remark                  string 	comment '备注'
   ,src_tbl                 string 	comment '来源表'
   ,src_rec_id              string 	comment '来源记录'
   ,rec_upd_time            string 	comment '记录修改时间'
   ,rec_down_time           string 	comment '记录创建时间'
 )COMMENT '银行间同业拆借利率'
PARTITIONED BY (
  src_id 				            string 	comment '来源标识'
  ,grp_id 				          string 	comment '并行标识'
)
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

INSERT overwrite TABLE t02_ira_ibor partition(src_id = 'WD', grp_id = '03')
select    
     '${data_day_str}'                                                 as busi_date           --数据日期
     ,a.OBJECT_ID                                                           as rec_id              --记录编号
     ,b.secu_id                                                             as secu_id             --统一证券编号
     ,b.src_sys_prdno                                                       as src_sys_prdno       --源系统产品编号
     ,a.trade_dt                                                            as trd_dt              --交易日期                                                 
     ,b.crrc_cd                                                             as crrc_cd             --货币代码                                          
     ,a.b_info_rate                                                         as ir                  --利率                                                
     ,b.ch_abbr                                                             as scr_abbr            --证券简称                                                  
     ,b.ch_name                                                             as scr_name            --证券全称                                                   
     ,b.scr_cd                                                              as scr_cd              --交易代码                                                
     ,''                                                                    as remark              --备注                                         
     ,'odata_n_uip.w_hiborprices'                                           as src_tbl             --来源表                                                                   
     ,a.object_id                                                           as src_rec_id          --来源记录                                                      
     ,from_unixtime(unix_timestamp(a.opdate), 'yyyy-MM-dd HH:mm:ss')        as rec_upd_time        --记录修改时间                                                                                                           
     ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')                as rec_down_time       --记录创建时间                                                                                                    
from 
(select * from odata_n_uip.w_hiborprices where busi_date = '${data_day_str}') a 
left join 
(select * from t02_scr_base_info where src_id = 'WD') b 
on a.s_info_windcode = b.in_code 

;
