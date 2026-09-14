-- task_id: 61529
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_scr_base_info_XLA
-- observed_at: 2026-09-05T01:06:19.039Z

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

INSERT OVERWRITE TABLE t02_scr_base_info partition (src_id = 'XLA')
SELECT   
      '${data_day_str}'                                                as busi_date,             --数据日期
             rec_id,                --'记录编号'
             secu_id,               --统一证券编号
             src_sys_prdno,         --源系统产品编号
             Crrc_cd,               --币种代码
             Crrc_name,             --币种名称
             Cty_cd,                --国家代码
             Cty_name,              --国家名称
             corp_id,               --公司ID
             scr_stat,              --当前状态
             min_pric_chg_unit,     --最小变动价格单位
             Peru,                  --每手数量
             scr_type,              --'证券类别'
             ch_abbr,               --'证券简称'
             scr_cd,                --'证券代码'
             ch_abbr_pinyin,        --'中文拼音简称'
             ch_name,               --'证券中文名称'
             en_name,               --'证券英文名称'
             ch_abbr_l,             --'证券简称(长)'
             en_abbr,               --'英文简称'
             mkt_cd,                --'交易市场代码'
             mkt_ch_name,           --'交易市场中文名称'
             in_code,               --源内部编码
             remark,              
             src_tbl,               --'来源表'
             src_rec_id           --'来源记录'
              ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as rec_upd_time            --记录修改时间',
        	,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as rec_down_time           --记录创建时间'  
  
FROM 
    (SELECT *,
    row_number() over(partition by secu_id order by (
    case when src_id  = 'PRD' then 1 
         when src_id  = 'RCC' and scr_type = 'FD' and src_tbl in ('ODATA_N_RCC.P_PRODCODE','ODATA_N_RCC.U_STKCODE') then 2
         when src_id  = 'WD' and scr_type = 'FD' and mkt_cd in ('SSE','SZSE') then 3 end)) as seq
     FROM pdata_news_n.t02_scr_base_info 
     where (src_id  = 'PRD') 
     or (src_id  = 'RCC' and scr_type = 'FD' and src_tbl in ('ODATA_N_RCC.P_PRODCODE','ODATA_N_RCC.U_STKCODE'))--mkt_cd in ('SSE','SZSE')) 
     or (src_id  = 'WD' and scr_type = 'FD' and mkt_cd in ('SSE','SZSE'))
     ) m where seq=1;
