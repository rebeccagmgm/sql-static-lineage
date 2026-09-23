/*
04 指定FAST TRS / 任务220650 / grp_id=04
阅读入口：../04_业务模块/04_指定FAST_TRS/README.md

交易trade ──交易键──→ 北上极速合约rt（N_CROSS_DMA_SWAP）
         ├─工具键──→ 初始持仓dy：各标的最早日终记录 → 标的摘要、初始本金
         └─工具键──→ 当日持仓np：当日日终记录     → 动态本金

两份持仓分别直连交易，不经过结构腿，也不彼此依赖连接。
客户、报备、保证金和组合计划在下面补入；主查询未按合约去重。
维护模块后运行 node render.mjs --write 04_指定FAST_TRS 更新完整SQL；
@include不是Hive语法，执行前需展开并预先建立公共视图。
*/
-- @include ../../00_公共设置.sql

-- 一、准备模块：下列文件定义命名CTE；编号是主题导航，不表示数据库物理执行顺序。
WITH
-- @include ../04_指定FAST_TRS/01_公共资料.sql
,
-- @include ../04_指定FAST_TRS/02_合约及来源属性.sql
,
-- @include ../04_指定FAST_TRS/07_初始持仓.sql
,
-- @include ../04_指定FAST_TRS/08_当日持仓.sql

-- 二、写入当前分支：仅覆盖指定加工日+grp_id分区；四个分支分开写入，不在此UNION。
insert overwrite table T98_OTC_DERI_COMP_SALE_INFO partition(busi_date = '${data_day_str}', grp_id = '04')
-- 三、输出字段：分类直接用FAST源类型；本金来源与固定汇率在10_本金与汇率.sql解释。
SELECT
-- @include ../04_指定FAST_TRS/11_输出字段.sql
-- 四、实际连接：交易必须匹配指定FAST合约；后续LEFT JOIN不因资料缺失而剔除合约。
FROM sale_trade trade
inner join fast_contract rt
ON rt.key_otc_trade_id = trade.key_otc_trade_id
left join settlement_report TOCR
ON TOCR.KEY_OTC_TRADE_ID = rt.KEY_OTC_TRADE_ID
-- 客户链：合约内部客户键 → 客户映射 → 公共客户；LEFT JOIN不强制要求客户资料完整。
left join customer_mapping rcm
ON rt.key_ctpty_id = rcm.key_ctpty_id
-- 当日本金：直接按交易工具键连接np，不依赖初始持仓是否存在。
left join daily_position np
on np.key_instrument_id = trade.key_instrument_id
-- 初始本金与标的：同样直接按交易工具键连接dy；注意原别名dy在此表示初始而非当日。
left join initial_position dy
ON dy.key_instrument_id = trade.key_instrument_id
-- 合约附加属性：关联合约与保证金按交易键连接，组合计划按bundle_id连接。
left join related_contract rel
on rel.key_otc_trade_id = trade.key_otc_trade_id
left join margin_parameters mrg
on mrg.key_otc_trade_id = trade.key_otc_trade_id
LEFT JOIN sale_bundle_plan mp
    ON mp.bundle_id = rt.bundle_id
-- 客户展示资料：由外部客户号取简称/全称/资质等；境内和香港同号时仍保留原匹配结果。
LEFT JOIN sale_customer cp
on rcm.outside_ctpty_code = cp.client_id
left join contract_type_dictionary sct
on sct.dw_cd_val = rt.trs_type
-- 五、最终范围：保留EFFECTIVE、EFFECTIVE_PENDING、TERMINATED、TERMINATING、TERMINATING_PENDING。
-- 此条件包含已终止状态，不能简单理解为“仅存续合约”。
where rt.Contr_Status in ('EFFECTIVE', 'EFFECTIVE_PENDING', 'TERMINATED', 'TERMINATING', 'TERMINATING_PENDING')
;
