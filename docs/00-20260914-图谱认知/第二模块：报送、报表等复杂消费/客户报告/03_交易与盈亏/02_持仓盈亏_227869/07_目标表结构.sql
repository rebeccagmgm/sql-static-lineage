-- 当前平台DDL只重新排版；规模/当前盈亏目标注释写万元，业务字段string，报告日分区。
-- DDL标签不是源币种与正负方向的独立核验证明。本文件不执行建表。
CREATE TABLE IF NOT EXISTS  dm_otc_n.bi_otc_hold_pnl( 
	 company_name string COMMENT '公司名称',
    company_id string COMMENT '公司ID',
    underlying_code string COMMENT '标的代码',
    underlying_name string COMMENT '标的名称',
    hold_amount string COMMENT '规模(万元)',
    current_pnl string COMMENT '当前盈亏(万元)',
    pnl_ratio string COMMENT '盈亏比例' ) COMMENT 'OTC持仓盈亏表' PARTITIONED BY ( busi_date string COMMENT '业务日期' ) STORED AS ORC;
