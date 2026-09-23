-- 案例客户A：MySQL / gf_otc测试库，只读核验；不是Hive生产拆解SQL。
-- 取数日期2026-09-23；报告日2026-03-25；客户标识已匿名化为${company_id}。
-- 复跑时按实际客户绑定替换占位符，每次只执行一个SELECT；不要把整份文件提交给单语句CLI。
-- SQL端LIMIT均保留；固定日期/客户缩小范围，LIMIT不等于扫描量保护。

-- [freshness] 九张结果的可用范围（年度列为年度而非报告日）
SELECT 'amount_change' AS result_table,COUNT(*) AS rows_n,MIN(busi_date) AS first_day,MAX(busi_date) AS last_day FROM gf_otc.bi_otc_amount_change UNION ALL SELECT 'busi_stat' AS result_table,COUNT(*) AS rows_n,MIN(busi_date) AS first_day,MAX(busi_date) AS last_day FROM gf_otc.bi_otc_busi_stat UNION ALL SELECT 'cross_sale' AS result_table,COUNT(*) AS rows_n,MIN(busi_date) AS first_day,MAX(busi_date) AS last_day FROM gf_otc.bi_otc_cross_sale UNION ALL SELECT 'cust_index' AS result_table,COUNT(*) AS rows_n,MIN(busi_date) AS first_day,MAX(busi_date) AS last_day FROM gf_otc.bi_otc_cust_index UNION ALL SELECT 'cust_tag' AS result_table,COUNT(*) AS rows_n,MIN(busi_date) AS first_day,MAX(busi_date) AS last_day FROM gf_otc.bi_otc_cust_tag UNION ALL SELECT 'hold_pnl' AS result_table,COUNT(*) AS rows_n,MIN(busi_date) AS first_day,MAX(busi_date) AS last_day FROM gf_otc.bi_otc_hold_pnl UNION ALL SELECT 'swap_trd_stat' AS result_table,COUNT(*) AS rows_n,MIN(busi_date) AS first_day,MAX(busi_date) AS last_day FROM gf_otc.bi_otc_swap_trd_stat UNION ALL SELECT 'underlying_analysis' AS result_table,COUNT(*) AS rows_n,MIN(busi_date) AS first_day,MAX(busi_date) AS last_day FROM gf_otc.bi_otc_underlying_analysis UNION ALL SELECT 'year_revenue',COUNT(*),CAST(MIN(year) AS CHAR),CAST(MAX(year) AS CHAR) FROM gf_otc.bi_otc_year_revenue LIMIT 9;

-- [business] 当日业务分类与本金创收
SELECT busi_type_1,busi_type_2,last_year_new_amount,this_year_new_amount,stock_size,cross_border_opt_amount,npv_revenue,real_pnl,profit_rate,CAST(data_datetime AS CHAR) AS synced_at FROM gf_otc.bi_otc_busi_stat WHERE company_id='${company_id}' AND busi_date='2026-03-25' ORDER BY busi_type_1,busi_type_2 LIMIT 20;

-- [daily] 三天的规模序列
SELECT CAST(busi_date AS CHAR) AS busi_date,option_amount_change,swap_amount_change,CAST(data_datetime AS CHAR) AS synced_at FROM gf_otc.bi_otc_amount_change WHERE company_id='${company_id}' AND busi_date BETWEEN '2026-03-23' AND '2026-03-25' ORDER BY busi_date LIMIT 10;

-- [index] 当日综合指标
SELECT CAST(busi_date AS CHAR) AS busi_date,cust_hold_win_rate,cust_win_rate,margin_ratio,margin_call_line,outst_margin_amount,used_quota,approved_quota,margin_call_rate,swap_turnover_rate,swap_new_principal,swap_outst_month_end,swap_platform_fee,swap_bond_interest,swap_commission,CAST(data_datetime AS CHAR) AS synced_at FROM gf_otc.bi_otc_cust_index WHERE company_id='${company_id}' AND busi_date='2026-03-25' LIMIT 5;

-- [year] 年度结果（没有源快照日期）
SELECT year,option_revenue,swap_revenue,cross_sale_amount,cross_border_revenue,CAST(data_datetime AS CHAR) AS synced_at FROM gf_otc.bi_otc_year_revenue WHERE company_id='${company_id}' AND year IN (2025,2026) ORDER BY year LIMIT 4;

-- [hold] 持仓金额与盈亏NULL
SELECT COUNT(*) AS rows_n,SUM(hold_amount) AS hold_wan,SUM(current_pnl) AS pnl_wan,SUM(ABS(current_pnl)) AS abs_pnl_wan,SUM(pnl_ratio) AS ratio_sum,SUM(ABS(pnl_ratio)) AS abs_ratio_sum,SUM(current_pnl IS NULL) AS null_pnl_rows,MIN(CAST(data_datetime AS CHAR)) AS first_sync,MAX(CAST(data_datetime AS CHAR)) AS last_sync FROM gf_otc.bi_otc_hold_pnl WHERE company_id='${company_id}' AND busi_date='2026-03-25' LIMIT 1;

-- [trade] 交易特征及缺失报告日
SELECT COALESCE(CAST(busi_date AS CHAR),'__SQL_NULL__') AS busi_date,time_period,weekly_trd_freq,avg_trd_amount,trd_win_rate,yield_rate,swap_first_trd_type,swap_second_trd_type,swap_first_trd_count,swap_second_trd_count,CAST(data_datetime AS CHAR) AS synced_at FROM gf_otc.bi_otc_swap_trd_stat WHERE company_id='${company_id}' ORDER BY time_period LIMIT 5;

-- [tags] 标签及缺失报告日
SELECT tag_name,COALESCE(CAST(busi_date AS CHAR),'__SQL_NULL__') AS busi_date,CAST(data_datetime AS CHAR) AS synced_at FROM gf_otc.bi_otc_cust_tag WHERE company_id='${company_id}' ORDER BY tag_name LIMIT 20;

-- [nulls] 明确区分SQL NULL与CLI空字符串
SELECT margin_call_rate IS NULL AS call_rate_is_null,swap_platform_fee IS NULL AS platform_fee_is_null,swap_bond_interest IS NULL AS bond_interest_is_null,swap_commission IS NULL AS commission_is_null FROM gf_otc.bi_otc_cust_index WHERE company_id='${company_id}' AND busi_date='2026-03-25' LIMIT 2;

-- [comparison_days] 同口径业务统计逐日汇总
SELECT CAST(busi_date AS CHAR) AS busi_date,SUM(CASE WHEN busi_type_1='互换' THEN stock_size ELSE 0 END) AS swap_stock_yuan,SUM(CASE WHEN busi_type_1='期权' THEN real_pnl ELSE 0 END) AS option_ytd_income_yuan,SUM(CASE WHEN busi_type_1='互换' THEN real_pnl ELSE 0 END) AS swap_ytd_income_yuan,COUNT(DISTINCT company_name) AS names_n FROM gf_otc.bi_otc_busi_stat WHERE company_id='${company_id}' AND busi_date BETWEEN '2026-03-22' AND '2026-03-25' GROUP BY busi_date ORDER BY busi_date LIMIT 4;

-- [hold_columns] 持仓下游实际字段
SELECT column_name,column_type,column_comment FROM information_schema.columns WHERE table_schema='gf_otc' AND table_name='bi_otc_hold_pnl' ORDER BY ordinal_position LIMIT 15;

-- [dates_null] 全表日期缺失的精确计数
SELECT 'cust_tag' AS source_name,COUNT(*) AS rows_n,SUM(busi_date IS NULL) AS null_dates FROM gf_otc.bi_otc_cust_tag UNION ALL SELECT 'swap_trd_stat',COUNT(*),SUM(busi_date IS NULL) FROM gf_otc.bi_otc_swap_trd_stat LIMIT 2;

-- [identity] 客户名称分组数
SELECT 'busi_stat' AS source_name,COUNT(DISTINCT company_name) AS names_n FROM gf_otc.bi_otc_busi_stat WHERE company_id='${company_id}' AND busi_date='2026-03-25' UNION ALL SELECT 'cust_index',COUNT(DISTINCT company_name) FROM gf_otc.bi_otc_cust_index WHERE company_id='${company_id}' AND busi_date='2026-03-25' UNION ALL SELECT 'hold_pnl',COUNT(DISTINCT company_name) FROM gf_otc.bi_otc_hold_pnl WHERE company_id='${company_id}' AND busi_date='2026-03-25' UNION ALL SELECT 'year_revenue',COUNT(DISTINCT company_name) FROM gf_otc.bi_otc_year_revenue WHERE company_id='${company_id}' LIMIT 4;
