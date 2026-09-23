/*
01 / 复用交易账簿、客户与组合计划的公共资料

公共视图定义在../../02_公共视图/，这里仅选加工日快照：
  v_t98_sale_trade_scope  → sale_trade：交易＋账簿；排除测试账簿10022/10019，限定OTC/OTC_HK部门。
  v_t98_sale_counterparty → sale_customer：境内客户＋香港客户，沿用UNION ALL。
  v_t98_sale_bundle_plan  → sale_bundle_plan：组合＋保证金计划，提供抵扣模式。
这三份结果在主脚本分别连接；客户和计划不是交易必备资料，也不在这里去重。
*/

-- 交易键key_otc_trade_id接FAST合约；工具键key_instrument_id接初始与当日持仓汇总。
sale_trade AS (
    SELECT key_otc_trade_id, internal_trade_id, key_instrument_id, key_book_id,
           book_key_book_id, business_type, department, book_name, desk, company
    FROM v_t98_sale_trade_scope
    WHERE busi_date = '${data_day_str}'
),

-- 组合计划：在主脚本按合约 bundle_id LEFT JOIN，计划缺失不会在本模块剔除交易。
sale_bundle_plan AS (
    SELECT bundle_id, key_plan_id, deduction_pattern
    FROM v_t98_sale_bundle_plan
    WHERE busi_date = '${data_day_str}'
),

-- 客户：由客户映射的 outside_ctpty_code 连接 client_id；境内/香港仍为 UNION ALL，不按客户号合并。
sale_customer AS (
    SELECT client_id, abbreviation, corporate_name, Signature_Name, industry, aptitude, commission_rate, client_qualify_review
    FROM v_t98_sale_counterparty
    WHERE busi_date = '${data_day_str}'
)
