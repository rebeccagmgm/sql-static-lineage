CREATE TABLE IF NOT EXISTS  dm_otc_n.bi_otc_cust_tag( 
	 company_name string COMMENT '公司名称' , company_id string COMMENT '公司ID' , tag_name string COMMENT '标签' ) COMMENT 'OTC客户标签表' PARTITIONED BY ( busi_date string COMMENT '业务日期' ) STORED AS ORC;
