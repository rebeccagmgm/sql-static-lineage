/*
02 / 先限定北上极速合约，再补客户和附属资料

范围：d_ref_fast_trs中trs_type='N_CROSS_DMA_SWAP'的加工日快照。
本地CD382字典中该代码对应“北上极速”；这不是全部FAST互换的通用加工。
合约提供类型、日期、状态和客户入口；本金另读北上极速腿历史持仓表。
下面各项在主脚本分别连接，不在这里合成一张宽表。
*/

-- rt：极速互换合约；key_otc_trade_id（合约ID）连接交易，start_date/end_date为期初/期末定价日。
-- seller为卖方，非销售人员；contract_code输出外部合约编号，bundle_id连接组合计划。
-- key_ctpty_id在本SQL中用作客户映射键；本地字段备注为STOCK_DIV_MODE，明显与用途不符，暂不采作释义。
fast_contract AS (
    select * from odata_n_tit.d_ref_fast_trs -- 极速互换合约要素表
    where busi_Date = '${data_day_str}' and trs_type = 'N_CROSS_DMA_SWAP'    
    ),

-- TOCR：Actual_Settlement_Date原义“实际结算日”，在本输出中命名为提前终止日；按交易键连接，不选最新。
settlement_report AS (
    select * from odata_n_tit.d_trd_otc_contr_report where busi_Date = '${data_day_str}' -- 交易-合约报备信息
    ),

-- 客户编号桥接（rcm）：内部 key_ctpty_id → outside_ctpty_code → 公共客户 client_id。
customer_mapping AS (
    select * from odata_n_tit.d_ref_ctpty_mapping where busi_Date = '${data_day_str}' -- 交易参数-交易对手映射表
    ),

-- 关联合约属性（rel）：只取 property_name=relatedOption，通过交易键连接。
-- property_value 直接输出 Rel_Agt_Id；保留源记录数量，不将多值合成一条。
related_contract AS (
    select * from odata_n_tit.d_trd_otc_contr_props -- 【AI】交易-场外合约结构-其他属性表
    where busi_Date = '${data_day_str}' and property_name = 'relatedOption'
    ),

-- mrg：通过交易键接保证金参数；initial_margin=【AI】保证金初始线(%)，
-- margin_balance_init=【AI】初始履约保障金额(元)，basic_margin_rate=【AI】基础保证金率。
-- margin_internal_trade_id直接输出保证金合约编号；与普通互换汇总关联期权交易键的来源不同。
margin_parameters AS (
    select * from odata_n_tit.d_ref_otc_contr_margin_param -- 【AI】合约-静态履约保证金参数
    where busi_Date = '${data_day_str}'
    ),

-- 源合约类型字典（sct）：代码域 CD382，并限定 TITANS场外衍生品合约类型。
-- 按 dw_cd_val 连接源类型取中文描述；字典无加工日过滤，也未新增唯一性约束。
contract_type_dictionary AS (
    select *
    from PDATA_N.REF_DW_CD_VAL -- 仓库代码取值
    where dw_cd_id = 'CD382' and remark = 'TITANS场外衍生品合约类型'
    )
