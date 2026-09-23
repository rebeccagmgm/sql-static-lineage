-- 当前平台DDL只重新排版。目标注释为“交叉发放金额”，没有货币单位/支付状态证明。
CREATE TABLE IF NOT EXISTS  dm_otc_n.bi_otc_cross_sale( 
	 company_name string COMMENT '公司名称',
    company_id string COMMENT '公司ID',
    coop_dept string COMMENT '协同部门',
    summary string COMMENT '简述',
    cross_sale_amount string COMMENT '交叉发放金额' ) COMMENT 'OTC部门交叉销售表' PARTITIONED BY ( busi_date string COMMENT '业务日期' ) STORED AS ORC;
