-- 本分支只复用公共客户，不使用“合格OTC交易及账簿”或“组合计划”视图。
-- 实际来源：odata_n_ois.o_otc_derivative_counterparty（衍生品交易对手维护表）。
-- 公共视图已限定delete_flag=0、department非HK；这里再取加工日和MAINLAND来源。
-- 确认书a.counterparty_id → 客户client_id；不经过TITANS客户映射，不按客户号去重。
sale_customer AS (
    SELECT client_id, -- 客户编号
           abbreviation, -- 简称
           corporate_name, -- 公司名称
           Signature_Name, -- 代签产品名称
           industry, -- 所属行业
           aptitude, -- 资质
           commission_rate, -- 佣金费率；源注释未标明单位
           client_qualify_review -- 客户资质复核
    FROM v_t98_sale_counterparty -- 公共交易对手视图，定义见sql/02_公共视图
    WHERE busi_date = '${data_day_str}'
      AND customer_source = 'MAINLAND'
)
