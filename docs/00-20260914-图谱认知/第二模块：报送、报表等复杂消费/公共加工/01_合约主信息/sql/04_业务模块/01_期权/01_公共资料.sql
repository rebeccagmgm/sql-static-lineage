-- 模块职责：把可跨分支复用的视图裁剪到本次加工日，不在此生成最终90列。
-- 输出三组独立CTE：交易账簿 sale_trade、组合计划 sale_bundle_plan、客户 sale_customer。
-- 粒度边界：本模块只过滤快照，不做去重；交易键、组合号、客户号是否唯一需另行验证。
-- 用途：选择本次加工快照的公共资料。
-- 01/02/04保留境内+香港 UNION ALL；03仅境内；不增加去重。
-- 交易范围：主脚本以此为起点；保留book侧账簿键与公司，分别用于落表和互换经营分类。
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
