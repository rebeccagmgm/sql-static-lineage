-- 组合的履保方案；复用3次：01期权、02普通互换、04指定FAST_TRS。
-- 合约.bundle_id → 组合 --履保方案ID + 同快照日--> 方案的抵扣模式。
-- 使用方须限定busi_date；未匹配方案仍保留组合，抵扣模式为NULL；不保证组合编号唯一。
create view v_t98_sale_bundle_plan as
select
    bundle.busi_date, -- 快照日期（本SQL用途）
    bundle.bundle_id, -- 组合编号
    bundle.key_plan_id, -- 履保方案ID
    plan.deduction_pattern -- 抵扣模式：抵扣/不抵扣；具体存储码值未注明
from odata_n_tit.d_trd_bundle_info bundle -- 【AI】合约组合参数配置父表
left join odata_n_tit.d_margin_plan plan -- 【AI】履保方案表
    on bundle.busi_date = plan.busi_date
   and bundle.key_plan_id = plan.id;
