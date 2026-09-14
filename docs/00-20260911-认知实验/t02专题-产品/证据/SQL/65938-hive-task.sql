-- task_id: 65938
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_scr_type_XLA
-- observed_at: 2026-09-05T01:06:26.041Z

-- createSql
CREATE TABLE IF NOT EXISTS t02_scr_type(
busi_date              string comment '数据日期'
,rec_id                string  comment '记录编号'
,secu_id               string  comment '统一证券编码'
,scr_cd                string  comment '证券代码'
,scr_abbr_name         string  comment '证券简称'
,mkt_cd                string  comment '交易市场代码'
,scr_type_std_cd       string  comment '证券分类标准'
,type_cd               string  comment '分类代码'
,type_name_zh          string  comment '分类代码中文'
,src_tbl               string  comment '来源表'
,src_rec_id            string  comment '来源记录'
,remark                string  comment '备注'
,rec_upd_time          string  comment '记录修改时间'
,rec_down_time         string  comment '记录创建时间'
)
partitioned by (src_id string  comment '来源标识')
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


WITH prd_type_info AS
(
        SELECT  a.prod_code
               ,a.prod_name
               ,a.prd_busi_type
               ,CASE WHEN a.prd_busi_type IN ('1','3','4') THEN a.prd_inv_type
        --  WHEN a.prd_busi_type = '2' AND a.prod_code LIKE 'GI%' AND substr(a.prod_code, 3, 1) IN ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'S', 'X') THEN '8' 
                     WHEN a.prd_busi_type = '2' AND a.prod_code LIKE 'GI%' 
                   AND (substr(a.prod_code,3,1) IN ('M','N','Z') 
                   or a.prod_code LIKE 'GIA%P' 
                   or a.prod_code LIKE 'GIA%S' 
                   or a.prod_code LIKE 'GIU%E'
        -- 来自马伟成 非保本增加规则 或产品编码GIA、GIB、GIW开头, E结尾 若保本浮动/保本固定和非保本逻辑有交叉产品优先打非保本标 
                   or a.prod_code LIKE 'GIA%E' 
                   or a.prod_code LIKE 'GIB%E' 
                   or a.prod_code LIKE 'GIW%E' ) THEN '7'

        --   WHEN a.prd_busi_type = '2' AND a.prod_code LIKE 'GI%' AND (substr(a.prod_code, 3, 1) IN ('B', 'C', 'E', 'F', 'G', 'H', 'K', 'O', 'P', 'Q', 'R', 'T', 'V', 'W', 'Y')
        -- or (a.prod_code LIKE 'GIA%' AND substr(a.prod_code, 6, 1) NOT IN ('P', 'S'))
        -- or (a.prod_code LIKE 'GIU%' AND substr(a.prod_code, 6, 1) NOT IN ('E'))) THEN '9' 
                     WHEN a.prd_busi_type = '2' AND c.is_baoben = '0' THEN '7'
        -- 来自赵晓辉 保本固定/保本浮动取产品中心标签 
                     WHEN a.prd_busi_type = '2' AND a.wealthtype = '21' AND a.incometype = '0' THEN '8'
                     WHEN a.prd_busi_type = '2' AND a.wealthtype = '21' AND a.incometype = '1' THEN '9'
        
        --             WHEN a.prd_busi_type = '2' AND c.is_baoben = '1' AND c.cpjg IN ('固定收益', '固定收益定制') THEN '8'
       
          --            WHEN a.prd_busi_type = '2' AND c.is_baoben = '1' AND c.cpjg NOT IN ('固定收益', '固定收益定制') THEN '9' 
                ELSE null END AS prd_inv_type
               ,a.prd_collection_type
        FROM
        (
                SELECT  secucode prod_code
                       ,chiname prod_name
                       ,CASE WHEN secuType < 6000 THEN '1'
                             WHEN 6000 < secuType AND secuType < 7000 THEN '2'
                             WHEN 7000 < secuType AND secuType < 8000 THEN '3'
                             WHEN secuType = 9999 THEN '4'
                             WHEN secuType BETWEEN 10001 AND 10005 THEN '5' --wanfangbin提供的口径 
                             END prd_busi_type
                       ,CASE WHEN psecutype IN ('3303','2001') THEN '1'
                             WHEN psecutype = '3302' THEN '2'  ELSE null END AS prd_collection_type
                       ,assetstype                                           AS prd_inv_type
                       ,wealthtype
                       ,incometype
                FROM odata_n_prd.p_basicproduct
                WHERE busi_date = '${data_day_str}'
                AND length(secuType) >= 4
                AND (secutype = '9999' or secutype < 8000 or secuType BETWEEN 10001 AND 10005 )
                AND secucode <> 'GF3001'
                AND chiname not LIKE '%测试%'
        ) a
        LEFT JOIN
        (
                SELECT  *
                FROM odata_n_ois.o_otc_incomecertificate
                WHERE busi_date = '${data_day_str}'
        ) c
        ON a.prod_code = c.prd_no
)


insert overwrite table t02_scr_type partition (src_id = 'XLA')
---------产品中心 产品分类 PRD01---------------
select 
       '${data_day_str}' as busi_date, 
       ''               as rec_id,
       A.secu_id                      as secu_id,
       A.scr_cd                       as scr_cd,
       B.prod_name                    as scr_abbr_name,
       ''                             as mkt_cd, 
       'PRD01'                        as scr_type_std_cd,
       B.prd_busi_type                as type_cd,
       B.prd_inv_type                 as type_name_zh,
       'odata_n_prd.p_basicproduct'   as SRC_TBL,
       ''                             as SRC_REC_ID,
       B.prd_collection_type          as remark,
       from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss') as rec_upd_time, --记录修改时间
       from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss') as rec_down_time --记录进表时间
from 
(select distinct secu_id, scr_cd,ch_abbr from t02_scr_base_info where src_id ='XLA') A 
join prd_type_info B ON A.scr_cd = B.prod_code
;



insert into table t02_scr_type partition (src_id = 'XLA')
---------产品中心 产品分类 PRD02---------------
select 
       '${data_day_str}' as busi_date, 
       ''               as rec_id,
       A.secu_id                      as secu_id,
       A.scr_cd                       as scr_cd,
       A.ch_abbr                      as scr_abbr_name,
       ''                             as mkt_cd, 
       'PRD02'                        as scr_type_std_cd,
       B.label_id                     as type_cd,
       B.label_value                  as type_name_zh,
       'odata_n_prd.p_prod_manual_label_rel_view'   as SRC_TBL,
       ''                             as SRC_REC_ID,
       B.label_type                   as remark,
       from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss') as rec_upd_time, --记录修改时间
       from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss') as rec_down_time --记录进表时间
from 
(select distinct secu_id, scr_cd, ch_abbr from t02_scr_base_info where src_id ='XLA') A 
join 
(select
  prod_code,
  label_type,
  label_id,
  label_value
from
  (
    select *
    from odata_n_prd.p_prod_manual_label_rel_view
    where busi_date = '${data_day_str}'
      and del_flag = 'f'
  ) a LATERAL VIEW explode(split(label_value_id, '\\073')) tab as label_value) B ON A.scr_cd = B.prod_code
;
