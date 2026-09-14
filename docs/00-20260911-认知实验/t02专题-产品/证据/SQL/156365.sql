-- task_id: 156365
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm02/pdata_news_n.t02_edb_idx_RPA_znyjpt_edb
-- observed_at: 2026-09-05T01:07:03.222Z

-- createSql
create table if not exists t02_edb_idx(
     busi_date           STRING COMMENT  '数据日期' 
    ,rec_id              STRING COMMENT  'ID' 
    ,idx_edb_cd          STRING COMMENT  '指标EDB代码' 
    ,pre_idx_key         STRING COMMENT  '预设指标key'      --新增字段by wxliupengfei 20240516
    ,idx_name            STRING COMMENT  '指标名称' 
    ,idx_unit            STRING COMMENT  '指标单位' 
    ,upd_freq            STRING COMMENT  '更新频率' 
    ,indx_data_coll_date STRING COMMENT  '指标数据采集日期'  --新增字段by wxliupengfei 20240516
    ,remark              STRING COMMENT  '备注' 
    ,src_tbl             STRING COMMENT  '来源表' 
    ,src_rec_id          STRING COMMENT  '来源记录' 
    ,rec_upd_time        STRING COMMENT  '记录修改时间' 
    ,rec_down_time       STRING COMMENT  '记录创建时间' 
) comment '广发证券定制EDB指标'
partitioned by (src_id STRING COMMENT '数据来源')
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

WITH tb1 AS
(
			SELECT  id
			       ,dataid                                 AS edb_id
			       ,regexp_replace(frequency,'度','')      AS freq
			       ,real_time_flag                        
			       ,pre_indicator_key
			       ,'odata_n_irp.k_ind_pre_indicator_meta' AS src_tbl
			       ,create_time
			       ,update_time
			       ,data_source
			FROM odata_n_irp.k_ind_pre_indicator_meta
			LATERAL VIEW explode(split(data_id,',')) a as dataid
			WHERE deleted = '0'
			AND update_status IN ('0', '1')
			AND nvl(data_id, '') <> ''
			AND busi_date = '${data_day_str}'
			AND data_source in ('WIND','同花顺iFinD','钢联数据')  -- 0320新增钢联数据
			and collect_method ='系统对接'                       -- 0718增加
			UNION ALL 
			SELECT  default.gfmd5(concat(func_id,freq,coalesce(idx_key,'')))  AS id
                   ,func_id                           AS edb_id
			       ,freq                              
			       ,timlt --是否实时指标（小时任务跑批）  AS real_time_flag
			       ,idx_key                            AS pre_indicator_key
			       ,''                                AS src_tbl
			       ,rec_down_time                     AS create_time
			       ,rec_upd_time                      AS update_time
			       ,src_id                            AS data_source
			FROM pdata_news_n.t02_edb_idx_rpa_irp
			WHERE del = '0'
            
                   
	
)

INSERT OVERWRITE TABLE t02_edb_idx PARTITION (src_id = 'RPA')
SELECT  '${data_day_str}'                                 AS busi_date --数据日期 
       ,a.id                                                   AS rec_id --ID 
       ,a.edb_id                                               AS idx_edb_cd --指标EDB代码 
       ,a.pre_indicator_key                                    AS pre_idx_key --预设指标key               新增字段by wxliupengfei 20240516
       ,''                                                     AS idx_name --指标名称 
       ,''                                                     AS idx_unit --指标单位 
       ,a.freq                                                 AS upd_freq --更新频率 
       ,a.create_time                                          AS indx_data_coll_date --指标数据采集日期   新增字段by wxliupengfei 20240516
       ,concat('{\\"real_flag\\":\\"', coalesce(a.real_time_flag,''),'\\"}')      
                                                               AS remark --备注 
       ,a.src_tbl                                              AS src_tbl --来源表 
       ,a.data_source                                           AS src_rec_id --来源记录 
       ,from_unixtime(unix_timestamp(a.update_time),'yyyy-MM-dd HH:mm:ss') AS rec_upd_time --记录修改时间 
       ,from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss')  AS rec_down_time --记录创建时间 
FROM
(
	SELECT  *
	FROM tb1
    WHERE nvl(pre_indicator_key,'') <>'pre_ind_332894679_240964824'  --几内亚铝土矿发运量：周 0816开始钢联下线，业务前端停更
) a
;
