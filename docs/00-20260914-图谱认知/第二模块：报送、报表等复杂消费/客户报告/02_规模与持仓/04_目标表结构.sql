-- 227697：原DDL，只排版不执行；所有业务列string，日期作为分区字段。
CREATE TABLE IF NOT EXISTS  dm_otc_n.bi_otc_amount_change( 
	 company_name string COMMENT '公司名称',
    company_id string COMMENT '公司ID',
    option_amount_change string COMMENT '期权规模变动(元)',
    swap_amount_change string COMMENT '互换规模变动(元)' ) COMMENT 'OTC规模变动表' PARTITIONED BY ( busi_date string COMMENT '日期' ) STORED AS ORC;

-- 228008：原DDL，只排版不执行；所有业务列string，日期作为分区字段。
CREATE TABLE IF NOT EXISTS  dm_otc_n.bi_otc_busi_stat( 
	 company_name string COMMENT '公司名称',
    company_id string COMMENT '公司ID',
    busi_type_1 string COMMENT '业务类型1',
    busi_type_2 string COMMENT '业务类型2',
    last_year_new_amount string COMMENT '去年新增规模',
    this_year_new_amount string COMMENT '今年新增规模',
    stock_size string COMMENT '存量规模',
    cross_border_opt_amount string COMMENT '跨境期权规模',
    npv_revenue string COMMENT 'NPV收入',
    real_pnl string COMMENT '真实盈亏（按Delta拆借）',
    profit_rate string COMMENT '利润率（按真实盈亏计算）' ) COMMENT 'OTC业务统计表' PARTITIONED BY ( busi_date string COMMENT '业务日期' ) STORED AS ORC;

-- 234355：原DDL，只排版不执行；所有业务列string，日期作为分区字段。
CREATE TABLE IF NOT EXISTS  dm_otc_n.bi_otc_underlying_analysis( 
	 company_name string COMMENT '公司名称',
    company_id string COMMENT '公司ID',
    underlying_type string COMMENT '合约类型',
    underlying_code string COMMENT '标的代码',
    underlying_name string COMMENT '标的名称',
    hold_amount string COMMENT '规模(万元)',
    current_pnl string COMMENT '盈亏规模(万元)' ) COMMENT 'OTC持仓分析' PARTITIONED BY ( busi_date string COMMENT '业务日期' ) STORED AS ORC;
