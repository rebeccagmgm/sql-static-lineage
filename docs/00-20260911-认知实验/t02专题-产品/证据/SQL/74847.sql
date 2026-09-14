-- task_id: 74847
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_pub_cst_info_f.py
-- observed_at: 2026-09-05T01:06:32.882Z

INSERT OVERWRITE TABLE t02_pub_cst_info
SELECT 
       rec_id         
      ,const_type_cd      
      ,const_type_desc      
      ,const_cd       
      ,const_cn_desc      
      ,src_id         
      ,src_tab          
      ,src_rec_id       
      ,remark         
      ,rec_upd_tm       
      ,rec_down_tm        
FROM odata_n_uip.t02_pub_cst_info_20220701 where busi_date='${data_day_str}';
