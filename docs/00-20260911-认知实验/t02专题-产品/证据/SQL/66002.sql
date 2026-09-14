-- task_id: 66002
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_stk_base_info_WD_Ashare
-- observed_at: 2026-09-05T01:06:26.170Z

-- createSql
CREATE TABLE IF NOT EXISTS t02_stk_base_info(
busi_date          string comment      '数据日期'
,rec_id            string comment      '记录编号'
,secu_id           string comment      '统一证券编码'
,src_sys_prdno     string comment      '源系统产品编号'
,scr_cd            string comment      '股票代码'
,corp_id           string comment      '公司ID'
,abbr_name         string comment      '证券简称'
,pinyin_zh         string comment      '中文拼音'
,mkt_cd            string comment      '交易所代码'
,scr_type          string comment      '证券类别(一级标准分类)'
,crrc_cd           string comment      '交易货币代码'
,list_stat_cd      string comment      '上市状态代码'
,list_date         string comment      '上市日期'
,list_brd_cd       string comment      '上市板块代码'
,list_brd_name     string comment      '上市板块名称'
,shsc_flag         string comment      '深股通或港股通标识'
,delist_date       string comment       '退市日期'
,src_rec_id        string comment       '来源记录'
,src_tbl           string comment      '来源表'
,remark            string comment      '备注'
,rec_upd_time      string comment      '记录更新时间'
,rec_down_time     string comment      '记录修改时间'
)COMMENT '股票基本信息'
PARTITIONED BY (src_id string comment '来源标识',  grp_id string comment '并行标识')
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

INSERT OVERWRITE TABLE t02_stk_base_info partition (src_id = 'WD', grp_id ='01')
SELECT 
       '${data_day_str}' as busi_date,      
       a.object_id            as rec_id,
       b.secu_id              as secu_id, 
       b.src_sys_prdno        as src_sys_prdno,    --源系统产品编号
       a.s_info_code          as scr_cd,
       b.comp_code            as corp_id,          --公司id
       a.s_info_name          as abbr_name,        --证券简称
       a.s_info_pinyin        as pinyin_zh,        --中文简称拼音
       case when a.s_info_exchmarket is null 
            then '99' 
            else a.s_info_exchmarket 
       end                   as mkt_cd,            --交易市场代码
       'ST'                  as scr_type,          --证券类别(一级)
       b.crncy_code          as crrc_cd,           --币种代码
        b.security_status                    as list_stat_cd,
       a.s_info_listdate     as list_date,         --上市日期
      case when A.s_info_listboardname = '主板'  then '1' 
            when A.s_info_listboardname = '创业板' then '3' 
            when A.s_info_listboardname = '科创板' then '12'  
            else lb_cd.const_cd end        as list_brd_cd,       --上市板块代码
       case when A.s_info_listboardname = '主板' then '主板' 
            when A.s_info_listboardname = '创业板' then '创业板' 
            when A.s_info_listboardname = '科创板' then '科创板'  
            when A.s_info_listboardname = '北证' then '北证'  
            else lb_cd.const_cn_desc end  as list_brd_name,     --上市板块名称
       a.is_shsc             as shsc_flag,         --深股通或港股通标识
       a.s_info_delistdate   as delist_date,       --退市日期
       a.object_id           as src_rec_id,        --来源记录
       'odata_msg.wind_w_asharedescription'   as src_tbl ,        
       'A股'                 as remark,
        from_unixtime(unix_timestamp(A.OPDATE), 'yyyy-MM-dd HH:mm:ss') as rec_upd_time, --记录修改时间
        from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss') as rec_down_time --记录进表时间
from (select * FROM  odata_n_uip.w_asharedescription  where s_info_windcode <> '689009.SH' ) A --可回退旧库：  odata_msg.wind_w_asharedescription  A,--因689009同时在A股及CDR表均有，这里过滤
left outer join (
    select
         busi_date         as     busi_date
         ,rec_id           as     rec_id
         ,secu_id          as     secu_id
         ,src_sys_prdno    as     src_sys_prdno
         ,Crrc_cd          as     crncy_code
         ,Crrc_name        as     crncy_name
         ,Cty_cd           as     country_code
         ,Cty_name         as     country_name
         ,corp_id          as     comp_code
         ,scr_stat         as     security_status
         ,min_pric_chg_unit    as     min_price_chg_unit
         ,Peru             as     lot_size
         ,scr_type         as     secu_type
         ,ch_abbr          as     sname
         ,scr_cd           as     secu_code
         ,ch_abbr_pinyin   as     name_py
         ,ch_name          as     name_cn
         ,en_name          as     name_en
         ,ch_abbr_l        as     sname_l
         ,en_abbr          as     ename
         ,mkt_cd           as     mkt_code
         ,mkt_ch_name      as     mkt_cn_name
         ,in_code          as     in_code
         ,src_tbl          as     src_tbl
         ,src_rec_id       as     src_rec_id  
    from t02_scr_base_info
 where src_id = 'WD')B ON A.s_info_windcode = B.in_code
left outer join (select * from t02_pub_covt_const where src_id = 'WD' and const_type_cd = 'var00005') LB_CD  ON A.S_INFO_LISTBOARD = LB_CD.src_const_cd --上市板块转码
