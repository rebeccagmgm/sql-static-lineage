-- task_id: 74850
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_pub_covt_const_f
-- observed_at: 2026-09-05T01:06:32.888Z

INSERT OVERWRITE TABLE t02_pub_covt_const
SELECT 
    '${data_day_str}' as busi_date,
     rec_id	,	
     const_type_cd	,	
     const_type_desc	,	
     const_cd	,	
     const_cn_desc	,	
     match_type_cd	,	
     match_type_desc	,	
     src_type_cd	,	
     src_type_desc	,	
     src_const_cd	,	
     src_const_cn_desc	,	
     src_eng_desc	,	
     src_busi_date as bgn_dt	,	
     abd_dt	,	
     match_prsn	,	
     src_tab	,	
     rmk_desc	,	
     src_id	,	
     src_rec_id	,	
     data_time	
FROM odata_n_uip.t02_pub_covt_const_20220701 where busi_date='${data_day_str}'  and ((match_prsn<>'zhangcong' or match_prsn is null) or rmk_desc is not null)
UNION ALL 
SELECT 
    '${data_day_str}' as busi_date,
     rec_id	,	
     const_type_cd	,	
     const_type_desc	,	
     const_cd	,	
     const_cn_desc	,	
     match_type_cd	,	
     match_type_desc	,	
     src_type_cd	,	
     src_type_desc	,	
     src_const_cd	,	
     src_const_cn_desc	,	
     src_eng_desc	,	
     src_busi_date as bgn_dt	,	
     abd_dt	,	
     match_prsn	,	
     src_tab	,	
     ''	as rmk_desc,	
     src_id	,	
     src_rec_id	,	
     data_time	
FROM odata_n_uip.t02_pub_covt_const_20220701 where busi_date='${data_day_str}' and match_prsn='zhangcong' and rmk_desc is null
 

;
