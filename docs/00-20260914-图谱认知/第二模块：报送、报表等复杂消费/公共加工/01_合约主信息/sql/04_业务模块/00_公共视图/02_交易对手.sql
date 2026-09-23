-- 公共客户；复用4次：01期权、02普通互换、03金仕达、04指定FAST_TRS；03仅取MAINLAND。
-- 境内维护表 ─┐
-- 香港客户表 ─┴─ UNION ALL → 展示字段对齐；同一客户号可能保留多行。
-- 使用方须限定busi_date；香港未提供的展示字段补NULL。
create view v_t98_sale_counterparty as
select
    busi_date, -- 快照日期（本SQL用途）
    'MAINLAND' as customer_source, -- 客户来源：境内
    client_id, -- 客户编号
    abbreviation, -- 简称
    corporate_name, --公司名称
    signature_name, -- 代签产品名称
    industry, -- 所属行业
    aptitude, -- 资质
    commission_rate, -- 佣金费率；元数据未注明单位
    client_qualify_review -- 客户资质复核
from odata_n_ois.o_otc_derivative_counterparty -- 衍生品交易对手维护表
where delete_flag = '0' -- 删除标志：只取0
  and department <> 'HK' -- 排除香港；部门为空也不会入选

union all

select
    busi_date, -- 数据日期
    'HK' as customer_source, -- 客户来源：香港
    client_id, -- 交易对手编号
    abbreviation, -- 简称
    full_name as corporate_name, -- 香港全称对齐境内公司名称
    -- 以下字段与境内列对齐；香港侧本SQL未提供，统一留空。
    null as signature_name, -- 代签产品名称
    null as industry, -- 所属行业
    null as aptitude, -- 资质
    null as commission_rate, -- 佣金费率
    null as client_qualify_review -- 客户资质复核
from odata_n_ois.g_hk_counterparty -- 香港交易对手
where delete_flag = '0'; -- 未删除（0未删除，1删除）
