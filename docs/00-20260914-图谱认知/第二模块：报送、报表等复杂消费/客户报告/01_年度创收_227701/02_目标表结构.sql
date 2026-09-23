-- 冻结prepare槽，仅重新排版；实际目标是年度分区，不是报告日分区。
-- 四项金额的目标字段均为string；以下是原DDL，不据此重建表或执行写入。
CREATE TABLE IF NOT EXISTS dm_otc_n.bi_otc_year_revenue(
    company_name string COMMENT '公司名称',
    company_id string COMMENT '公司ID',
    option_revenue string COMMENT '期权业务创收万元',
    swap_revenue string COMMENT '互换业务创收万元',
    cross_sale_amount string COMMENT '交叉销售金额万元',
    cross_border_revenue string COMMENT '跨境业务创收万元'
) COMMENT 'OTC年度创收表'
PARTITIONED BY (busi_year string COMMENT '年')
STORED AS ORC
