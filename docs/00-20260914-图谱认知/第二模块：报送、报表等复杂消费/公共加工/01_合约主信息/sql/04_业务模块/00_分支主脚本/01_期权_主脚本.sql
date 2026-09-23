-- 期权；任务86840；grp_id=01。
-- 本轮只重构前三站；客户、保证金、条款、金额、估值仍沿用原连接/公式。
--
-- 01_公共输入 → 02_核心加工（合约基础 → 标的识别 → 经营分类）
--                              ↓
--                      本脚本补充关联 ← 03_补充资料
--                              ↓
--                      04_金额与输出 → 写入01分区
--
-- 阅读入口：../04_业务模块/01_期权/README.md；核心加工的三个阶段逐条承接，不按合约号重新拼回。
-- 文件原编号表示业务主题，目录编号表示阅读层次；补充资料之间没有串行依赖。
-- @include由render.mjs展开，不是Hive原生语法；本文件不是直接部署版本。
-- @include ../../00_公共设置.sql

WITH
-- 公共视图裁剪加工日
-- @include ../01_期权/01_公共输入/01_公共资料.sql
,
-- 第一站：合约+结构+源类型字典；在此限定合约状态
-- @include ../01_期权/02_核心加工/02_合约基础.sql
,
-- 第二站：把c/ins/fu/bc及标的字典的关联与取值收进同一模块
-- @include ../01_期权/02_核心加工/03_标的及篮子.sql
,
-- 第三站：逐行生成经营类别代码、名称
-- @include ../01_期权/02_核心加工/09_经营分类.sql
,
-- 03_补充资料：并列来源，尚未改为阶段式；实际关联仍在下方
-- @include ../01_期权/03_补充资料/12_客户与保证金.sql
,
-- @include ../01_期权/03_补充资料/04_期权条款.sql
,
-- @include ../01_期权/03_补充资料/05_期初估值.sql

insert overwrite table T98_OTC_DERI_COMP_SALE_INFO partition(busi_date = '${data_day_str}', grp_id = '01')
SELECT
-- @include ../01_期权/04_金额与输出/11_输出字段.sql
FROM option_classified enriched
-- 汇率：币种+结构起始日，仍不另加加工日过滤。
left join odata_n_tit.d_ref_rmb_midrate mid -- 表注释缺失；按本SQL用途：人民币中间价来源 
on enriched.collateral_notional_currency = mid.currency -- 绝对名义本金币种 = 【AI】币种
and enriched.start_date = mid.quote_date -- 期初定价日 = 【AI】报价日期；midrate原注释为【AI】中间价
-- 客户映射：内部客户键 → 外部客户号；客户资料cp仍在下方连接。
left join customer_mapping rcm
ON enriched.counterparty_key = rcm.key_ctpty_id
-- 关联合约与保证金：沿用原交易键/组合号，不新增去重。
left join related_contract rel
on rel.key_otc_trade_id = enriched.trade_id
left join margin_parameters mrg
on mrg.key_otc_trade_id = enriched.trade_id
left join margin_trs_links mr
on mr.option_key_otc_trade_id = enriched.trade_id
LEFT JOIN sale_bundle_plan mp
    ON mp.bundle_id = enriched.bundle_id
-- 条款与结算：保留原粒度；结算可能多行，不能当成一合约一行。
left join option_settlement ODS
on enriched.trade_id = ODS.KEY_OTC_TRADE_ID
left join first_premium_fee fee
on fee.key_instrument_id = enriched.contract_instrument_id
left join coupon_terms RODC
on enriched.trade_id = RODC.KEY_OTC_TRADE_ID
LEFT JOIN knockout_terms KO
ON enriched.trade_id = KO.KEY_OTC_TRADE_ID
LEFT JOIN knockin_terms KI
ON enriched.trade_id = KI.KEY_OTC_TRADE_ID
left join strike_terms STk
on enriched.trade_id = STk.KEY_OTC_TRADE_ID
left join participation_terms pr
on enriched.trade_id = pr.KEY_OTC_TRADE_ID
-- 公共客户：境内及香港匹配结果均保留。
LEFT JOIN sale_customer cp
on rcm.outside_ctpty_code = cp.client_id
-- 估值：工具+交易侧账簿+rk=1在ON中判断，缺失估值不剔除合约。
left join latest_valuation calc
on enriched.contract_instrument_id = calc.key_instrument_id and enriched.trade_book_id = calc.key_book_id and calc.rk = 1
;
