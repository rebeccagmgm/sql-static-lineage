-- 本轮未改的后续来源：客户映射、关联合约属性、保证金参数及保证金互换关系。
-- 仍由主脚本按原连接条件使用；本文件不是新的汇总表，不合并或去重。
-- 从原02_合约及来源属性迁入；客户outside_ctpty_code接公共客户，保证金按交易键接合约。
customer_mapping AS (
-- key_ctpty_id：交易对手ID；outside_ctpty_code：交易对手外部唯一码。
select * from odata_n_tit.d_ref_ctpty_mapping where busi_Date = '${data_day_str}' -- 交易参数-交易对手映射表
),

--关联期权合约关系relatedOption：
    -- 两个 OTC 合约之间存在业务关系：一个合约关联另一个期权合约。
related_contract AS (
select * from odata_n_tit.d_trd_otc_contr_props -- 【AI】交易-场外合约结构-其他属性表
    where busi_Date = '${data_day_str}' and property_name = 'relatedOption'
),

--补充期权/OTC合约的履约保证金参数
margin_parameters AS (
-- margin_balance_init=初始履约保障金额(元)，initial_margin=保证金初始线(%)，basic_margin_rate=基础保证金率，deduction=抵扣模式（现金抵扣等）。
select * from odata_n_tit.d_ref_otc_contr_margin_param -- 【AI】合约-静态履约保证金参数
    where busi_Date = '${data_day_str}'
),

--这个期权合约的保证金管理关联哪些 TRS 合约？
    --用于保证金管理的期权-TRS合约关联关系表（只取长持有型互换（LONG_HOLD_SWAP））
    -- 可能原因：业务上只有 LONG_HOLD_SWAP 承接这类期权保证金
margin_trs_links AS (
-- option_key_otc_trade_id：期权合约ID；trs_key_otc_trade_id：互换合约ID。
select option_key_otc_trade_id, concat_ws(';',collect_set(trs_key_otc_trade_id)) as Marg_Agt_Id
    from (
        select * from odata_n_tit.f_ref_option_margin_trs_relation -- 期权合约与互换合约关联关系表；status：Y-有效，N-无效
        where busi_date = '${data_day_str}' and status = 'Y'
        ) a
    join (
        select * from odata_n_tit.d_ref_trs -- 场外交易-TRS；trs_type：互换类型
        where busi_date = '${data_day_str}' and trs_type = 'LONG_HOLD_SWAP' --只取长持有型互换（LONG_HOLD_SWAP）
        ) b
    on a.trs_key_otc_trade_id = b.key_otc_trade_id
    group by option_key_otc_trade_id
)
