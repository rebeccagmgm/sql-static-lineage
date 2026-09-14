-- task_id: 160750
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm02/pdata_news_n.t02_tit_prd_info_TIT_prd_product_grp01
-- observed_at: 2026-09-05T01:07:04.738Z

-- createSql
create table if not exists t02_tit_prd_info(
 
     busi_date        STRING COMMENT  '数据日期' 
    ,rec_id           STRING COMMENT  '记录编号' 
    ,prd_id           STRING COMMENT  '产品id' 
    ,iss_dept         STRING COMMENT  '发行部门' 
    ,book_id          STRING COMMENT  '账簿id' 
    ,book_name        STRING COMMENT  '账簿名称' 
    ,prd_type         STRING COMMENT  '产品类型' 
    ,prd_inr_cd       STRING COMMENT  '产品内部代码' 
    ,prd_ext_cd       STRING COMMENT  '产品外部代码' 
    ,sale_date        STRING COMMENT  '销售日期' 
    ,val_date         STRING COMMENT  '产品起息日' 
    ,maty_date        STRING COMMENT  '产品到期日' 
    ,pay_day_delay    STRING COMMENT  '兑付日延期' 
    ,sett_date        STRING COMMENT  '产品结算日' 
    ,prd_term         STRING COMMENT  '产品期限（天）' 
    ,prd_tot_nom_prin STRING COMMENT  '产品总名义本金' 
    ,iss_qty          STRING COMMENT  '发行数量' 
    ,prd_par_val      STRING COMMENT  '产品面值' 
    ,iss_pric         STRING COMMENT  '发行价格' 
    ,maty_pric        STRING COMMENT  '到期价格' 
    ,sett_crrc        STRING COMMENT  '结算币种' 
    ,min_scrp_amt     STRING COMMENT  '认购起点' 
    ,max_scrp_amt     STRING COMMENT  '认购上限' 
    ,scrp_qty         STRING COMMENT  '已认购数量' 
    ,accum_scrp_amt   STRING COMMENT  '累计已认购金额' 
    ,prd_stat         STRING COMMENT  '产品状态' 
    ,src_create_time  STRING COMMENT  '源创建时间' 
    ,remark           STRING COMMENT  '备注' 
    ,src_tbl          STRING COMMENT  '来源表' 
    ,src_rec_id       STRING COMMENT  '来源记录' 
    ,rec_upd_time     STRING COMMENT  '记录修改时间' 
    ,rec_down_time    STRING COMMENT  '记录创建时间'

) comment 'TIT产品信息表'
partitioned by (src_id STRING COMMENT '数据来源',grp_id STRING COMMENT '分组标识')
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


INSERT OVERWRITE TABLE t02_tit_prd_info PARTITION (src_id = 'TIT',grp_id = '01')
SELECT  '${data_day_str}'                                                  AS busi_date --数据日期 
       ,a.id                                                                    AS rec_id --记录编号 
       ,a.key_prod_id                                                           AS prd_id --产品id 
       ,a.department                                                            AS iss_dept --发行部门 
       ,a.key_book_id                                                           AS book_id --账簿id 
       ,a.book_name                                                             AS book_name --账簿名称 
       ,a.product_type                                                          AS prd_type --产品类型 
       ,a.inner_code                                                            AS prd_inr_cd --产品内部代码 
       ,a.external_code                                                         AS prd_ext_cd --产品外部代码 
       ,default.date2datekey(a.trade_date)                                      AS sale_date --销售日期 
       ,default.date2datekey(a.start_date)                                      AS val_date --产品起息日 
       ,default.date2datekey(a.end_date)                                        AS maty_date --产品到期日 
       ,a.payment_date_delay                                                    AS pay_day_delay --兑付日延期 
       ,default.date2datekey(a.settlement_date)                                 AS sett_date --产品结算日 
       ,a.invest_maturity                                                       AS prd_term --产品期限（天） 
       ,a.total_notional                                                        AS prd_tot_nom_prin --产品总名义本金 
       ,a.issue_size                                                            AS iss_qty --发行数量 
       ,a.denomination                                                          AS prd_par_val --产品面值 
       ,a.issue_price                                                           AS iss_pric --发行价格 
       ,a.mature_price                                                          AS maty_pric --到期价格 
       ,a.settlement_currency                                                   AS sett_crrc --结算币种 
       ,a.min_order_amount                                                      AS min_scrp_amt --认购起点 
       ,a.max_order_amount                                                      AS max_scrp_amt --认购上限 
       ,a.ordered_size                                                          AS scrp_qty --已认购数量 
       ,a.accumulated_order_amount                                              AS accum_scrp_amt --累计已认购金额 
       ,a.product_status                                                        AS prd_stat --产品状态 
       ,from_unixtime(unix_timestamp(a.created_datetime),'yyyy-MM-dd HH:mm:ss') AS src_create_time --源创建时间 
       ,''                                                                      AS remark --备注 
       ,'odata_n_tit.p_prd_product'                                             AS src_tbl --来源表 
       ,a.id                                                                    AS src_rec_id --来源记录 
       ,from_unixtime(unix_timestamp(a.updated_datetime),'yyyy-MM-dd HH:mm:ss') AS rec_upd_time --记录修改时间 
       ,from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss')                   AS rec_down_time --记录创建时间 

FROM
(
	SELECT  *
	FROM odata_n_tit.p_prd_product
	WHERE busi_date = '${data_day_str}' 
) a
;
