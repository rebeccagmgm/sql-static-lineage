-- task_id: 69692
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_exch_quot_s_WD_A
-- observed_at: 2026-09-05T01:06:28.489Z

-- createSql
create table if not exists T02_EXCH_QUOT_S
(
    	busi_date	string  comment '数据日期'
    ,secu_id	string  comment '统一编码'
	,src_sys_prdno	string  comment '源系统产品编号'
	,trd_dt	string  comment '交易日期'
	,Crrc_cd	string  comment '货币代码'
	,Pric_pre_Clos	string  comment '昨收盘价(元)'
	,Pric_open	string  comment '开盘价(元)'
	,Pric_high	string  comment '最高价(元)'
	,Pric_low	string  comment '最低价(元)'
	,Pric_Clos	string  comment '收盘价(元)'
	,Pric_chg	string  comment '涨跌(元)'
	,pct_chg	string  comment '涨跌幅(%)'
	,deal_Vol	string  comment '成交量(手)'
	,deal_Amt	string  comment '成交金额(千元)'
	,Pric_adjpreclose	string  comment '复权昨收盘价(元)'
	,Pric_adjopen	string  comment '复权开盘价(元)'
	,Pric_adjhigh	string  comment '复权最高价(元)'
	,Pric_adjlow	string  comment '复权最低价(元)'
	,Pric_adjclose	string  comment '复权收盘价(元)'
	,Pric_adjfactor	string  comment '复权因子'
	,Pric_avgprice	string  comment '均价(VWAP)'
	,trd_Stat	string  comment '交易状态'
	,trd_Stat_cd	string  comment '交易状态代码'
	,Pric_limit	string  comment '涨停价(元)'
	,Pric_stopping	string  comment '跌停价(元)'
	,tnv_deal	string  comment '成交笔数'
	,tnv_vol_aft	string  comment '盘后成交量(股)'
	,tnv_val_aft	string  comment '盘后成交额(元)'
	,adj_spl_prc	string  comment '最新除权参考价'
	,tnv_rat	string  comment '日换手率（%）'
	,Pric_amp	string  comment '振幅（%）'
	,Pric_after_price	string  comment '盘后固定价格(元)'
	,Disc_rat	string  comment '贴水率（%）'
	,Disc_val	string  comment '升贴水（元）'
	,fair_val   string comment '公允价格(元）'
	,src_tbl	string  comment '来源表'
	,src_rec_id	string  comment '来源记录'
	,remark	string  comment '备注'
	,rec_upd_time	string  comment '记录修改时间'
	,rec_down_time	string  comment '记录创建时间'
)
partitioned by (src_id string comment '数据来源',grp_id string comment '并行分组标识')
stored as ORC;

drop table if  exists T02_EXCH_QUOT_S_XD_HIS;
create table T02_EXCH_QUOT_S_XD_HIS as 
select B.trade_dt,   --日期
       A.s_info_windcode,   --万得编号
       A.s_dq_preclose as prcie_after_dr  --除权价格
from 
   (select  trade_dt,  	s_info_windcode  ,  s_dq_preclose , row_number() over(partition by s_info_windcode order by trade_dt desc ) as rn  from odata_n_uip.w_ashareeodprices where  s_info_windcode  <> '689009.SH'
   )A
join 
   (select  TRADE_DT,  	s_info_windcode  ,  s_dq_preclose , row_number() over(partition by s_info_windcode order by trade_dt desc ) -1  as rn from odata_n_uip.w_ashareeodprices where  s_info_windcode  <> '689009.SH'
   )B ON  A.s_info_windcode = B.s_info_windcode and A.rn = B.rn;

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


WITH T02_EXCH_QUOT_S_XD_SZ AS   --当日为股权登记日的深市股票，除权参考价
(
    select   F.s_info_windcode                                      --股票代码
    ,s_dq_close --收盘价格(未除权)
    ,COALESCE(concat(substring(T_TL.record_date,1,4), substring(T_TL.record_date,6,2), substring(T_TL.record_date,9,2)), T_WD.s_rightsissue_regdateshareb,  A.eqy_record_dt) as  eqy_record_dt --股权登记日     
         ,A.s_div_bonusrate                              --每股送股比例
         ,D.totalqty * A.s_div_bonusrate as totaldivbonus--送股总数 =  股权登记日总股本 x 每股送股比例
         ,A.cash_dvd_per_sh_pre_tax                     -- 每股派息(税前)(元)
         ,D.totalqty * A.cash_dvd_per_sh_pre_tax               as totalcashdvd    --派现总额 = 股权登记日总股本 x 每股派息(税前)(元)
         ,D.totalqty  * C.s_dq_close as totalmktval     --除权前总市值 即 股权登记日总市值
         ,D.totalqty * E.placingratioplan                       as totalrightissue --配股总数 = 股权登记日总股本 x 配股比例
         ,E.placingprice                                                        --配股价格
		 ,nvl(A.s_div_conversedrate,0)                   as s_div_conversedrate --转赠比例
		 ,nvl(A.s_div_conversedrate,0)*nvl(D.totalqty,0) as converseqty         --转赠总数
         ,D.totalqty beforedr_totalqty                                          --股权登记日总股本
         ,F.rightsissue_ratio -- 配股比例
		 ,F.rightsissue_price   --配股价格
         ,nvl(D.totalqty,0) + nvl(D.totalqty ,0)* nvl(A.s_div_bonusrate,0) + nvl(D.totalqty,0) * nvl(E.placingratioplan,0) as afterdr_totalqty --除权后总股本 =  除权前总股本+送股总数 + 配股总数  +  转赠总数？
         ,(nvl(D.totalqty  * nvl(s_dq_close,0),0) +    --股权登记日总市值
             nvl(D.totalqty * E.placingratioplan * E.placingprice,0)  -   --配股总数*配股价格
                 nvl( D.totalqty * A.cash_dvd_per_sh_pre_tax,0)           --派现总额
           )*1.0/
          (nvl(D.totalqty,0) + nvl(D.totalqty,0) * nvl(A.s_div_bonusrate,0) + nvl(D.totalqty,0) * nvl(E.placingratioplan,0) + nvl(A.s_div_conversedrate,0)*nvl(D.totalqty,0)) --
           as prcie_after_dr 
 from 
  (select s_info_windcode,
         ex_date, --除权除息日
		 cash_dividend_ratio, --派息比例
		 bonus_share_ratio, --送股比例
		 rightsissue_ratio, -- 配股比例
		 rightsissue_price   --配股价格
from odata_n_uip.w_ashareexrightdividendrecord where  substring(s_info_windcode, 8, 2) ='SZ' ) F
left outer join   --用join ,只取股权登记日是busi_date当日的配股或者分红信息，利用T， A表过滤
---以下关联WD，TL两个数据源的配股信息表，互备使用
(select * from odata_n_uip.w_asharerightissue  where  s_rightsissue_regdateshareb  = '${data_day_int}')T_WD --股权登记日当日 
   on F.ex_date =  T_WD.s_rightsissue_exdividenddate and F.s_info_windcode = T_WD.s_info_windcode
left outer join 
(select * from odata_n_uip.q_equ_allot where busi_date = '${data_day_str}' and record_date  = '${data_day_str}')T_TL --股权登记日当日 
   on F.ex_date = concat(substring(T_TL.ex_rights_date,1,4), substring(T_TL.ex_rights_date,6,2), substring(T_TL.ex_rights_date,9,2)) 
    and substring(F.s_info_windcode, 1, 6) = T_TL.ticker_symbol
left outer join  --关联分红信息，如果有分红信息，计算公式将体现相关参数
(select * from (select ad.*, row_number() over(partition by s_info_windcode) rk  from odata_n_uip.w_asharedividend ad where  eqy_record_dt = '${data_day_int}' )ad_tmp where rk = '1' )A 
     on  F.s_info_windcode  = A.s_info_windcode and F.ex_date = A.ex_dt
left outer join
 --当日实际收盘价格
  (select * from odata_n_uip.w_ashareeodprices where trade_dt = '${data_day_int}')C ON F.s_info_windcode = C.s_info_windcode
join 
--股本信息
( select s_info_windcode, 
         tot_shr as totalqty
  from  
      (select ac.* , rank() over(partition by s_info_windcode order by change_dt desc) as rn from odata_n_uip.w_asharecapitalization ac where change_dt< '${data_day_int}' )ts where rn = 1 --取除权前最新总股本
 )D ON F.s_info_windcode = D.s_info_windcode 
---配股信息
 left outer join 
 ( 
    select s_info_windcode,
           s_rightsissue_price as placingprice,  	---配股价格
		   s_rightsissue_ratio  as placingratioplan--配股比例(如10配3) 
		   from  odata_n_uip.w_asharerightissue  --股票配股
        where s_rightsissue_regdateshareb =   '${data_day_int}'
 )E ON F.s_info_windcode = E.s_info_windcode
where T_WD.s_rightsissue_regdateshareb is not null OR T_TL.record_date is not null OR A.eqy_record_dt is not null    --只取股权登记日是busi_date当日
)
,
T02_EXCH_QUOT_S_XD_SH AS  --当日为股权登记日的沪市股票，除权参考价
(
select   F.s_info_windcode,--股票代码

         F.ex_date, --除权除息日
		 F.cash_dividend_ratio, --派息比例
		 F.bonus_share_ratio, --送股比例
		 F.rightsissue_ratio, -- 配股比例
		 F.rightsissue_price   --配股价格     
		 ,C.s_dq_close --收盘价(未除权)
         ,COALESCE(concat(substring(T_TL.record_date,1,4), substring(T_TL.record_date,6,2), substring(T_TL.record_date,9,2)), T_WD.s_rightsissue_regdateshareb,  A.eqy_record_dt) as  eqy_record_dt --股权登记日
		 ,(C.s_dq_close  + F.rightsissue_price *F.rightsissue_ratio - F.cash_dividend_ratio) / (1 + F.bonus_share_ratio + F.rightsissue_ratio )  as prcie_after_dr 
from 
 (select s_info_windcode,
         ex_date, --除权除息日
		 cash_dividend_ratio, --派息比例
		 bonus_share_ratio, --送股比例
		 rightsissue_ratio, -- 配股比例
		 rightsissue_price   --配股价格
from odata_n_uip.w_ashareexrightdividendrecord where  substring(s_info_windcode, 8, 2) ='SH' and s_info_windcode  <> '689009.SH') F
left outer join   --用join ,只取股权登记日是busi_date当日的配股或者分红信息，利用T， A表过滤
---以下关联WD，TL两个数据源的配股信息表，互备使用
(select * from odata_n_uip.w_asharerightissue  where  s_rightsissue_regdateshareb  = '${data_day_int}' and s_info_windcode  <> '689009.SH')T_WD --股权登记日当日 
   on F.ex_date =  T_WD.s_rightsissue_exdividenddate and F.s_info_windcode = T_WD.s_info_windcode
left outer join 
(select * from odata_n_uip.q_equ_allot where busi_date = '${data_day_str}' and record_date  = '${data_day_str}')T_TL --股权登记日当日 
   on F.ex_date = concat(substring(T_TL.ex_rights_date,1,4), substring(T_TL.ex_rights_date,6,2), substring(T_TL.ex_rights_date,9,2)) 
    and substring(F.s_info_windcode, 1, 6) = T_TL.ticker_symbol
left outer join  --关联分红信息，如果有分红信息，计算公式将体现相关参数
(select * from (select ad.*, row_number() over(partition by s_info_windcode) rk  from odata_n_uip.w_asharedividend ad where  eqy_record_dt = '${data_day_int}' and s_info_windcode  <> '689009.SH')ad_tmp where rk = '1')A 
     on   F.s_info_windcode = A.s_info_windcode and F.ex_date = A.ex_dt
left outer join
 --股权登记日当日实际收盘价格
(select * from odata_n_uip.w_ashareeodprices where  trade_dt = '${data_day_int}' and s_info_windcode  <> '689009.SH') C  --busi_date当天，即股权登记日
     on   F.s_info_windcode = C.s_info_windcode 
where T_WD.s_rightsissue_regdateshareb is not null OR T_TL.record_date is not null OR A.eqy_record_dt is not null    --只取股权登记日是busi_date当日

)


INSERT OVERWRITE TABLE T02_EXCH_QUOT_S partition (src_id = 'WD' ,grp_id='01') 
SELECT
      '${data_day_str}' as busi_date
    ,B.secu_id
    ,B.src_sys_prdno
    ,A.TRADE_DT         as  trd_dt
    ,CRY_CD.const_cd    as  Crrc_cd
    ,A.S_DQ_PRECLOSE      as  Pric_pre_Clos
    ,A.S_DQ_OPEN          as  Pric_open
    ,A.S_DQ_HIGH          as  Pric_high
    ,A.S_DQ_LOW           as  Pric_low
    ,A.S_DQ_CLOSE         as  Pric_Clos
    ,A.S_DQ_CHANGE        as  Pric_chg
    ,A.S_DQ_PCTCHANGE     as  pct_chg	
    ,A.S_DQ_VOLUME        as  deal_Vol
    ,A.S_DQ_AMOUNT * 1000  as deal_Amt --元  
    ,A.S_DQ_ADJPRECLOSE   as Pric_adjpreclose
    ,A.S_DQ_ADJOPEN       as Pric_adjopen
    ,A.S_DQ_ADJHIGH       as Pric_adjhigh
    ,A.S_DQ_ADJLOW        as Pric_adjlow
    ,A.S_DQ_ADJCLOSE      as Pric_adjclose
    ,A.S_DQ_ADJFACTOR     as Pric_adjfactor
    ,A.S_DQ_AVGPRICE      as Pric_avgprice
    ,case when S_DQ_TRADESTATUS = 'XR' then '除权'   --由于万得数据的代码和中文解解释有在这个字段，所以做此转换
          when S_DQ_TRADESTATUS = 'DR' then '除权除息'
          when S_DQ_TRADESTATUS = 'N'  then '上市首日'
          when S_DQ_TRADESTATUS = 'XD' then '除息'
          when S_DQ_TRADESTATUS = '0' then '停牌'
          when S_DQ_TRADESTATUS = '-2' then '待核查'
          when S_DQ_TRADESTATUS = '-1' then '交易'
      else S_DQ_TRADESTATUS end  as trd_Stat
    ,case when S_DQ_TRADESTATUS = '交易' then '-1'
          when S_DQ_TRADESTATUS = '停牌' then '0'
          when S_DQ_TRADESTATUS = '待核查'  then '-2'
      else S_DQ_TRADESTATUS end as trd_Stat_cd     --待转化统一编码 --20220411 S_DQ_TRADESTATUSCODE 该字段源表未采集 ，暂时做转换
    ,'' as Pric_limit
    ,'' as Pric_stopping
    ,'' as tnv_deal
    ,'' as tnv_vol_aft
    ,A.S_DQ_AMOUNT as tnv_val_aft
    ,nvl(  nvl(SZ.prcie_after_dr, SH.prcie_after_dr) , XH.prcie_after_dr)  as adj_spl_prc
    ,'' as tnv_rat
    ,'' as Pric_amp
    ,'' as Pric_after_price
    ,'' as Disc_rat
    ,'' as Disc_val
    ,'' as fair_val
    ,'odata_msg.wfd_w_ashareeodprices' as SRC_TBL 
    ,OBJECT_ID as SRC_REC_ID --来源记录       
    ,'A股' as remark
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss') as rec_upd_time --记录修改时间
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as rec_down_time --记录进表时间
    
FROM (select * from odata_n_uip.w_ashareeodprices where  s_info_windcode  <> '689009.SH') A 
left outer join (select * from  t02_scr_base_info where src_id = 'WD')B ON A.s_info_windcode = B.in_code
left outer join (select * from t02_pub_covt_const where src_id = 'WD' and const_type_cd = 'fin00001') CRY_CD ON A.CRNCY_CODE = CRY_CD.src_const_cd  --币种转码
left outer join T02_EXCH_QUOT_S_XD_SZ SZ ON A.s_info_windcode = SZ.s_info_windcode and A.trade_dt  = SZ.eqy_record_dt
left outer join T02_EXCH_QUOT_S_XD_SH SH ON A.s_info_windcode = SH.s_info_windcode and A.trade_dt  = SH.eqy_record_dt
left outer join T02_EXCH_QUOT_S_XD_HIS  XH ON A.s_info_windcode = XH.s_info_windcode and A.trade_dt = XH.trade_dt
