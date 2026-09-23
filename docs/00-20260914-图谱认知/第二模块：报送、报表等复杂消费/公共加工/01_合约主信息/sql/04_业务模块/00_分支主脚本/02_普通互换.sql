-- 【加工主线】合格交易 → TRS合约 → 结构腿/非结构腿 → 初始及当日持仓 → 分类及本金 → 落表。
-- 【结果粒度】持仓按腿汇总，但主查询同时连接两类腿；多腿或多条客户/报备信息可能扩展行数。
-- 阅读入口：../04_业务模块/02_普通互换/README.md；本文件看连接与筛选，11_输出字段.sql看90列映射。
-- 维护：只改主脚本/模块，运行 node render.mjs --write 02_普通互换 更新完整SQL；原始快照不改。
-- 运行：@include不是Hive语法，需先展开；公共视图需预先建立。
-- 普通互换；任务86841；grp_id=02
-- @include ../../00_公共设置.sql

-- 一、准备模块：下列文件定义命名CTE；编号是主题导航，不表示数据库物理执行顺序。
WITH
-- @include ../02_普通互换/01_公共资料.sql
,
-- @include ../02_普通互换/02_合约及来源属性.sql
,
-- @include ../02_普通互换/06_结构腿与利率腿.sql
,
-- @include ../02_普通互换/07_初始持仓.sql
,
-- @include ../02_普通互换/08_当日持仓.sql

-- 二、写入当前分支：仅覆盖指定加工日+grp_id分区；四个分支分开写入，不在此UNION。
insert overwrite table T98_OTC_DERI_COMP_SALE_INFO partition(busi_date = '${data_day_str}', grp_id = '02')
-- 三、装配目标字段：列顺序与统一DDL一致；输出文件内再引用经营分类、本金与汇率的表达式。
SELECT
-- @include ../02_普通互换/11_输出字段.sql
-- 四、连接加工主线：INNER JOIN决定必须具备的记录；LEFT JOIN保留缺失侧，除非最终WHERE另行限制。
FROM sale_trade trade
inner join trs_contract rt
ON rt.key_otc_trade_id = trade.key_otc_trade_id
-- 腿：结构腿负责标的和IPO/限售属性；非结构腿负责固定/浮动利率及利差。
left join structure_legs rtl
ON rtl.key_otc_trade_id = rt.key_otc_trade_id
left join interest_legs rtl_f
ON rtl_f.key_otc_trade_id = rt.key_otc_trade_id
left join settlement_report TOCR
ON TOCR.KEY_OTC_TRADE_ID = rt.KEY_OTC_TRADE_ID
-- 客户链：合约内部客户键 → 客户映射 → 公共客户；LEFT JOIN不强制要求客户资料完整。
left join customer_mapping rcm
ON rt.key_ctpty_id = rcm.key_ctpty_id
-- 初始持仓：结构腿key_leg_id → 每腿初始本金和标的汇总。
left join initial_position his_ini
ON his_ini.key_leg_id = rtl.key_leg_id
-- 当日持仓：通过his_ini.key_leg_id关联；不要改成直接连rtl，这会改变初始持仓缺失时的结果。
left join daily_position his_dy
ON his_dy.key_leg_id = his_ini.key_leg_id
-- 合约附加属性：关联合约与保证金按交易键连接，组合计划按bundle_id连接。
left join related_contract rel
on rel.key_otc_trade_id = trade.key_otc_trade_id
left join margin_parameters mrg
on mrg.key_otc_trade_id = trade.key_otc_trade_id
left join margin_option_links mr
on mr.trs_key_otc_trade_id = trade.key_otc_trade_id
LEFT JOIN sale_bundle_plan mp
    ON mp.bundle_id = rt.bundle_id
-- 客户展示资料：由外部客户号取简称/全称/资质等；境内和香港同号时仍保留原匹配结果。
LEFT JOIN sale_customer cp
on rcm.outside_ctpty_code = cp.client_id
left join contract_type_dictionary sct
on sct.dw_cd_val = rt.trs_type
left join underlying_type_dictionary sutd
on sutd.dw_cd_val = his_ini.ins_family
-- 五、最终范围：保留EFFECTIVE、EFFECTIVE_PENDING、TERMINATED、TERMINATING、TERMINATING_PENDING。
-- 此条件包含已终止状态，不能简单理解为“仅存续合约”。
where rt.Contr_Status in ('EFFECTIVE', 'EFFECTIVE_PENDING', 'TERMINATED', 'TERMINATING', 'TERMINATING_PENDING')
;
