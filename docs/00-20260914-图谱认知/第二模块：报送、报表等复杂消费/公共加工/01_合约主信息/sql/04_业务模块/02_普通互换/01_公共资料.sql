/*
01 / 先准备：今天要加工哪些交易，用哪一份客户和组合资料？

三组资料分别回答不同问题，在主脚本中各自关联：
  sale_trade       → 交易属于哪个账簿、部门、公司？提供合约编号与交易键。
  sale_bundle_plan → 合约所属组合采用什么抵扣模式？
  sale_customer    → 交易对手叫什么、属于什么行业、具备什么资质？

本模块只把公共视图裁剪到加工日；互换合约和状态范围在主脚本确定。
“交易键”“组合号”“客户号”是不同对象的连接入口，不可互换。
*/

-- 交易及账簿：key_otc_trade_id 接互换合约；internal_trade_id 输出合约编号。
-- book_key_book_id 输出账簿协议编号；department/company 参与经营分类。
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

-- 客户：互换的 key_ctpty_id 先经02模块换成 outside_ctpty_code，再接这里的 client_id。
-- 公共客户视图保留境内与香港 UNION ALL；本模块不按客户号合并或去重。
sale_customer AS (
    SELECT client_id, abbreviation, corporate_name, Signature_Name, industry, aptitude, commission_rate, client_qualify_review
    FROM v_t98_sale_counterparty
    WHERE busi_date = '${data_day_str}'
)
