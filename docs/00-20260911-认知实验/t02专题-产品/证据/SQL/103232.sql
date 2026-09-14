-- task_id: 103232
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm02/pdata_news_n.t02_scr_base_info_TIT
-- observed_at: 2026-09-05T01:06:43.749Z

-- createSql
CREATE TABLE IF NOT EXISTS t02_scr_base_info(
 busi_date            string  comment  '数据日期'
,rec_id               string  comment  '记录编号'
,secu_id              string  comment  '统一证券编码'
,src_sys_prdno        string  comment  '源系统产品编号'
,Crrc_cd              string  comment  '货币代码'
,Crrc_name            string  comment  '货币名称'
,Cty_cd               string  comment  '国家代码'
,Cty_name             string  comment  '国家名称'
,corp_id              string  comment  '公司id'
,scr_stat             string  comment  '当前状态'
,min_pric_chg_unit    string  comment  '最小价格变动单位'
,Peru                 string  comment  '每手数量'
,scr_type             string  comment  '证券类别'
,ch_abbr              string  comment  '证券简称'
,scr_cd               string  comment  '证券代码'
,ch_abbr_pinyin       string  comment  '中文拼音简称'
,ch_name              string  comment  '证券中文名称'
,en_name              string  comment  '证券英文名称'
,ch_abbr_l            string  comment  '证券简称(长)'
,en_abbr              string  comment  '英文简称'
,mkt_cd               string  comment  '交易市场代码'
,mkt_ch_name          string  comment  '交易市场中文名称'
,in_code              string  comment  '源内部编码'
,remark               string  comment  '备注'
,src_tbl              string  comment  '来源表'
,src_rec_id           string  comment  '来源记录'
,rec_upd_time         string  comment  '数据更新时间'
,rec_down_time        string  comment  '数据进表时间'
)
partitioned by (src_id string comment '数据来源')
stored as orc;


CREATE TABLE IF NOT EXISTS t02_scr_base_info_newest_tit_tmp_b(
 busi_date            string  comment  '数据日期'
,rec_id               string  comment  '记录编号'
,secu_id              string  comment  '统一证券编码'
,src_sys_prdno        string  comment  '源系统产品编号'
,Crrc_cd              string  comment  '货币代码'
,Crrc_name            string  comment  '货币名称'
,Cty_cd               string  comment  '国家代码'
,Cty_name             string  comment  '国家名称'
,corp_id              string  comment  '公司id'
,scr_stat             string  comment  '当前状态'
,min_pric_chg_unit    string  comment  '最小价格变动单位'
,Peru                 string  comment  '每手数量'
,scr_type             string  comment  '证券类别'
,ch_abbr              string  comment  '证券简称'
,scr_cd               string  comment  '证券代码'
,ch_abbr_pinyin       string  comment  '中文拼音简称'
,ch_name              string  comment  '证券中文名称'
,en_name              string  comment  '证券英文名称'
,ch_abbr_l            string  comment  '证券简称(长)'
,en_abbr              string  comment  '英文简称'
,mkt_cd               string  comment  '交易市场代码'
,mkt_ch_name          string  comment  '交易市场中文名称'
,in_code              string  comment  '源内部编码'
,remark               string  comment  '备注'
,src_tbl              string  comment  '来源表'
,src_rec_id           string  comment  '来源记录'
,rec_upd_time         string  comment  '数据更新时间'
,rec_down_time        string  comment  '数据进表时间'
)
partitioned by (src_id string comment '数据来源')
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
set hive.optimize.sort.dynamic.partition=true;
set hive.map.aggr = true;
set hive.groupby.skewindata=true;
set hive.support.concurrency=false;

with tmp_ref_instrument as (
select 
     b.const_cd                                                               as crrc_cd
    ,b.const_cn_desc                                                          as crrc_name
    ,case when a.INS_FAMILY = 'EQUITY'                   then 'STK'             
          when a.INS_FAMILY = 'FUTURE'                   then 'FUT'          
          when a.INS_FAMILY = 'INDEX'                    then 'IDX'        
          when a.INS_FAMILY = 'FUND'                     then 'FIN'        
          when a.INS_FAMILY = 'LISTEDOPTION'             then 'OPT'              
          when a.INS_FAMILY = 'OTCOPTION'                then 'OPT'           
          when a.INS_FAMILY = 'TRS'                      then 'OTH'         
          when a.INS_FAMILY = 'RATE_INDEX'               then 'IRA'              
          when a.INS_FAMILY = 'HEDGE_FUND'               then 'FIN'            
          when a.INS_FAMILY = 'OTC_OPTION_CONTRACT'      then 'OPT'                       
          when a.INS_FAMILY = 'FX'                       then 'FXR'  
          when a.INS_FAMILY = 'QIS'                      then 'IDX'    
          when a.INS_FAMILY = 'COMMODITY'                then 'GDS'         
          when a.INS_FAMILY = 'GDR'                      then 'STK'     
          when a.INS_FAMILY = 'BOND'                     then 'BND' 
     else 'OTH'     end                                                                 as   scr_type
    ,a.INS_SHT_DESC                                                                     as ch_abbr
    ,trim(a.WIND_CODE)                                                                  as scr_cd  
    ,a.INS_LNG_DESC                                                                     as ch_name
    ,a.DESCRIPTION                                                                      as ch_abbr_l
    ,case when a.EXCH_MARKET = 'ICE_EU'    then 'LSE'   
          when a.EXCH_MARKET = 'NAS'       then 'NASDAQ'
          when a.EXCH_MARKET = 'OTC'       then '99'    
          when a.EXCH_MARKET = 'PBC'       then '99'    
          when a.EXCH_MARKET = 'NYS'       then 'NYSE'  
          when a.EXCH_MARKET = 'ASE'       then 'AMEX'
          when a.EXCH_MARKET is null       then '99'
     else a.EXCH_MARKET    end                                                          as mkt_cd
    ,case when a.EXCH_MARKET = 'SGE'              then '上海黄金交易所'                                              
          when a.EXCH_MARKET = 'HKEX'             then '香港联交所'                                                  	
          when a.EXCH_MARKET = 'ICE'              then '洲际交易所'                                                                          
          when a.EXCH_MARKET = 'CME'              then '芝加哥商品交易所'                                             
          when a.EXCH_MARKET = 'NYMEX'            then '纽约商业交易所'                   
          when a.EXCH_MARKET = 'CFETS'            then '中国外汇交易所'                                                           
          when a.EXCH_MARKET = 'CBOT'             then '芝加哥期货交易所'                                                               
          when a.EXCH_MARKET = 'LME'              then '伦敦金属交易所'                                                        
          when a.EXCH_MARKET = 'CZCE'             then '郑州商品交易所'                                                          
          when a.EXCH_MARKET = 'DCE'              then '大连商品交易所'                                                         
          when a.EXCH_MARKET = 'SHFE'             then '上海期货交易所'                                                          
          when a.EXCH_MARKET = 'CFFEX'            then '中国金融期货交易所'                                                           
          when a.EXCH_MARKET = 'SSE'              then '上海证券交易所'                                                         
          when a.EXCH_MARKET = 'SZSE'             then '深圳证券交易所'                                                          
          when a.EXCH_MARKET = 'INE'              then '上海期货交易所-上海国际能源交易中心'                                                                
          when a.EXCH_MARKET = 'OSE'              then '大坂证券交易所'                                                         
          when a.EXCH_MARKET = 'COMEX'            then '纽约商品交易所'                                                           
          when a.EXCH_MARKET = 'SGX'              then '新加坡交易所'                                                         
          when a.EXCH_MARKET = 'EUREX'            then '欧洲期货交易所'                                                           
          when a.EXCH_MARKET = 'ICE_EU'           then '伦敦洲际交易所'       
          when a.EXCH_MARKET = 'NAS'              then '纳斯达克证券交易所'   
          when a.EXCH_MARKET = 'OTC'              then '其他'                 
          when a.EXCH_MARKET = 'PBC'              then '其他'                 
          when a.EXCH_MARKET = 'NYS'              then '纽约证券交易所'       
          when a.EXCH_MARKET = 'ASE'              then '美国证券交易所'       
     else ''                    end                                                         as mkt_ch_name
    ,a.KEY_INSTRUMENT_ID                                                                    as in_code
    ,a.UPDATED_DATETIME                                                                     as updated_datetime
from (select * from odata_n_tit.d_ref_instrument where busi_date = '${data_day_str}') a
left join
(select * from t02_pub_covt_const where src_id = 'TIT' and const_type_cd = 'fin00001' ) b
on a.CURRENCY = b.src_const_cd  
)
insert overwrite table t02_scr_base_info_newest_tit_tmp_b  partition (src_id='TIT')
select 
    '${data_day_str}'                                                                                              as busi_date                  --数据日期                                                                                      
    ,''                                                                                                                 as rec_id                     --记录编号                                                                
    ,concat(scr_type,'.',a.ID ,'.',coalesce(split(a.scr_cd,'\\\\\\\\.')[0],in_code),'.',mkt_cd)                                                 as secu_id                    --统一证券编码                                                                                                               
    ,concat('TIT-',in_code)                                                                                             as src_sys_prdno              --源系统产品编号                                                                                           
    ,a.crrc_cd                                                                                                          as crrc_cd                    --货币代码                                                                        
    ,a.crrc_name                                                                                                        as crrc_name                  --货币名称                                                                            
    ,''                                                                                                                 as cty_cd                     --国家代码                                                                
    ,''                                                                                                                 as cty_name                   --国家名称                                                                  
    ,''                                                                                                                 as corp_id                    --公司id                                                                 
    ,''                                                                                                                 as scr_stat                   --当前状态                                                                  
    ,''                                                                                                                 as min_pric_chg_unit          --最小价格变动单位                                                                           
    ,''                                                                                                                 as peru                       --每手数量                                                              
    ,a.scr_type                                                                                                         as scr_type                   --证券类别                                                                          
    ,a.ch_abbr                                                                                                          as ch_abbr                    --证券简称                                                                        
    ,split(a.scr_cd,'\\\\\\\\.')[0]                                                                                     as scr_cd                     --证券代码                                                                      
    ,''                                                                                                                 as ch_abbr_pinyin             --中文拼音简称                                                                        
    ,a.ch_name                                                                                                          as ch_name                    --证券中文名称                                                                        
    ,''                                                                                                                 as en_name                    --证券英文名称                                                                 
    ,a.ch_abbr_l                                                                                                        as ch_abbr_l                  --证券简称(长)                                                                            
    ,''                                                                                                                 as en_abbr                    --英文简称                                                                 
    ,a.mkt_cd                                                                                                           as mkt_cd                     --交易市场代码                                                                      
    ,a.mkt_ch_name                                                                                                      as mkt_ch_name                --交易市场中文名称                                                                                
    ,a.in_code                                                                                                          as in_code                    --源内部编码                                                                        
    ,''                                                                                                                 as remark                     --备注                                                                
    ,'odata_n_tit.d_ref_instrument'                                                                                     as src_tbl                    --来源表                                                                                             
    ,''                                                                                                                 as src_rec_id                 --来源记录                                                                    
    ,from_unixtime(unix_timestamp(a.UPDATED_DATETIME),'yyyy-MM-dd HH:mm:ss')                                            as rec_upd_time               --数据更新时间                                                                                    
    ,from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss')                                                              as rec_down_time              --数据进表时间                                                                                                                          
from (select *, 
cast(row_number() over(partition by scr_type, mkt_cd, in_code order by in_code) as bigint) + 100000000 as ID 
from 
tmp_ref_instrument) a
                                                                                                                                                                     

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


with tb1 as
(
    select 
        a.busi_date
        ,a.rec_id
        ,coalesce(b.secu_id,a.secu_id)  as secu_id
        ,a.src_sys_prdno
        ,a.crrc_cd
        ,a.crrc_name
        ,a.cty_cd
        ,a.cty_name
        ,a.corp_id
        ,a.scr_stat
        ,a.min_pric_chg_unit
        ,a.peru
        ,a.scr_type
        ,a.ch_abbr
        ,a.scr_cd
        ,a.ch_abbr_pinyin
        ,a.ch_name
        ,a.en_name
        ,a.ch_abbr_l
        ,a.en_abbr
        ,a.mkt_cd
        ,a.mkt_ch_name
        ,a.in_code
        ,a.remark
        ,a.src_tbl
        ,a.src_rec_id
        ,a.rec_upd_time
        ,a.rec_down_time 
    from (
        select * from t02_scr_base_info_newest_tit_tmp_b  WHERE Src_Id = 'TIT' 
    ) a left join  t02_scr_cd_rplc_info b 
        on  a.scr_cd = b.scr_cd 
        and a.scr_type = b.scr_type 
        and a.mkt_cd = b.mkt_cd 
        and a.src_id = b.src_id
)
INSERT OVERWRITE TABLE t02_scr_base_info PARTITION (Src_Id = 'TIT')
select 
   res.Busi_Date
  ,res.Rec_Id
  ,res.Secu_Id
  ,res.Src_Sys_Prdno
  ,res.Crrc_cd
  ,res.Crrc_name
  ,res.Cty_cd
  ,res.Cty_name
  ,res.corp_id
  ,res.scr_stat
  ,res.min_pric_chg_unit
  ,res.Peru
  ,res.scr_type
  ,res.ch_abbr
  ,res.scr_cd
  ,res.ch_abbr_pinyin
  ,res.ch_name
  ,res.en_name
  ,res.ch_abbr_l
  ,res.en_abbr
  ,res.mkt_cd
  ,res.mkt_ch_name
  ,res.In_Code
  ,res.Remark
  ,res.Src_Tbl
  ,res.Src_Rec_Id
  ,res.rec_upd_time
  ,res.rec_down_time
 from (
    select * from 
        (
            SELECT *,row_number() over(partition by secu_id,src_sys_prdno,scr_type,scr_cd,mkt_cd,ch_name order by in_code , src_tbl desc ) as rn  
            from tb1 
        ) t where t.rn=1
) res
