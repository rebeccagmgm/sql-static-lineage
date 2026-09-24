-- 01期权试点 / 第一站：哪些合约进入加工，以及它们的结构是什么？
-- 输入：加工日合格交易 + 期权合约 + 期权结构 + 源类型字典。
-- 输出 option_base：保留实际连接后的每条记录，不声明“一合约一行”。
--
-- 合格交易 --交易键，INNER--> 期权合约 --交易键，LEFT--> 期权结构
--                                      结构类型/子类型 --LEFT--> 源类型字典
-- 状态范围在这里限定；字典/结构缺失仍保留，多条匹配不去重。
-- 字段显式命名：后续不用再记trade/deal/ds分别存放哪些属性。

option_contract AS (
select * from odata_n_tit.d_ref_otc_option_deal where busi_Date = '${data_day_str}'  --场外交易-期权交易合同要素表
),

option_structure AS (
select * from odata_n_tit.d_ref_option_deal_structure where busi_Date = '${data_day_str}'  --场外交易-期权交易结构表
),

contract_type_dictionary AS (
select *
    from PDATA_N.REF_DW_CD_VAL -- 仓库代码取值；dw_cd_id=仓库代码编号，dw_cd_val=代码取值，dw_cd_val_desc=取值描述
    where dw_cd_id = 'CD382' and remark = 'TITANS场外衍生品合约类型'
),

subtype_dictionary AS (
select *
    from PDATA_N.REF_DW_CD_VAL -- 仓库代码取值；dw_cd_id=仓库代码编号，dw_cd_val=代码取值，dw_cd_val_desc=取值描述
    where dw_cd_id = 'CD381'
),
/**
* 期权业务加工的基础层（option_base）
**/
option_base AS (
    SELECT
        trade.key_otc_trade_id AS trade_id, -- 交易键：后续条款和保证金关联入口
        trade.internal_trade_id AS contract_id, -- 合约编号
        trade.key_instrument_id AS contract_instrument_id, -- 合约工具键：费率及估值关联入口
        trade.key_book_id AS trade_book_id, -- 交易侧账簿键：估值连接使用
        trade.book_key_book_id AS book_id, -- 账簿侧键：目标Book_Agt_Id的原来源
        trade.business_type AS trade_business_type, -- 源业务类型
        trade.department AS book_department, -- 账簿部门
        trade.book_name AS book_name, -- 账簿名
        trade.desk AS book_desk, -- 柜台：经营分类使用
        deal.key_otc_trade_id AS option_trade_id, -- 期权合约交易键
        deal.key_ctpty_id AS counterparty_key, -- 交易对手编号：经客户映射换取外部唯一码
        deal.bundle_id AS bundle_id, -- 组合编号
        deal.private_placement AS private_placement_flag, -- 限售标志
        deal.seller AS seller_id, -- 卖方，关联交易对手ID
        deal.collateral_notional_currency AS collateral_notional_currency, -- 绝对名义本金币种：汇率判断输入
        deal.settlement_currency AS settlement_currency, -- 结算币种
        deal.initial_notional AS initial_notional, -- 初始名义本金（元）
        deal.notional AS notional, -- 名义本金（元）（元数据原注释）
        deal.collateral_notional AS collateral_notional, -- 绝对名义本金（元）
        deal.early_term_date AS early_term_date, -- 提前终止日
        deal.payment_date AS payment_date, -- 兑付日期
        deal.time_to_maturity AS term_days, -- 期限天数
        deal.contr_status AS contract_status, -- 源合约状态
        deal.hedge_type AS hedge_type, -- 对冲类型
        deal.premium AS premium, -- 期权费（元）
        deal.premium_date AS premium_date, -- 期权费支付日
        deal.contract_code AS external_contract_code, -- 外部合约编号
        deal.premium_rate AS premium_rate, -- 期权费率（%）
        ds.key_otc_trade_id AS structure_trade_id, -- 结构交易键（LEFT JOIN缺失时为NULL）
        ds.start_date AS start_date, -- 期初定价日：分类日期及汇率连接使用
        ds.end_date AS end_date, -- 期末定价日
        ds.contract_type AS source_contract_type, -- 期权类型；源字典CONTRACT_TYPE
        ds.contract_sub_type AS source_contract_sub_type, -- 期权子类型；源字典CONTRACT_SUBTYPE
        ds.underlying_ins_id AS underlying_instrument_id, -- 标的内部代码：下一阶段关联入口
        ds.underlying_wind_code AS underlying_wind_code, -- 标的WIND代码，多标的以逗号分隔
        ds.underlying_currency AS underlying_currency, -- 结构标的币种
        ds.init_notl_exchange_rate AS initial_exchange_rate, -- 期初汇率2（名义本金币种对结算币种，计算使用）
        ds.knockout_extra_par AS knockout_extra_par, -- 上涨参与率（元数据原注释）；此字段被输出为敲出参与率
        ds.rebate_not_abs AS rebate_not_abs, -- 敲出收益率（%）
        ds.cross_currency_type AS cross_currency_type, -- 跨币种类型
        ds.fx_rate_model AS fx_rate_model, -- 【AI】汇率模式（元数据原标记）
        sct.dw_cd_val_desc AS source_contract_type_desc, -- 源合约类型字典描述
        ssct.dw_cd_val_desc AS source_contract_sub_type_desc -- 源子类型字典描述
    FROM sale_trade trade  --账簿范围内交易
    inner join option_contract deal  --场外期权交易合同要素表
on deal.key_otc_trade_id = trade.key_otc_trade_id
    left join option_structure ds  --期权交易结构表
on deal.key_otc_trade_id = ds.key_otc_trade_id
    left join contract_type_dictionary sct --TITANS场外衍生品合约类型
on sct.dw_cd_val = ds.contract_type
    left join subtype_dictionary ssct --合约子类型
on ssct.dw_cd_val = ds.contract_sub_type
    where deal.Contr_Status in ('EFFECTIVE', 'EFFECTIVE_PENDING', 'TERMINATED', 'TERMINATING', 'TERMINATING_PENDING')

)
