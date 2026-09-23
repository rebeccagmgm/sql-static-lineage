/*
02 / 先认识“这一份互换合约”，再补客户与附属资料

合约整体回答：和谁交易、什么类型、何时开始结束、采用什么币种。
标的明细和本金规模通过“合约 → 结构腿 → 初始持仓／当日持仓”取得。
“普通互换”是当前加工分支的名称；这里不按trs_type限定成某一种产品。
主脚本用交易键INNER JOIN互换合约，并保留指定的生效、终止及待处理状态。

三组键分别连接不同对象：
  trade.internal_trade_id              → 输出的主合约编号Agt_Id
  rt.key_otc_trade_id（内部交易流水号） → 合约报备、属性、保证金参数、腿
  rt.key_ctpty_id（交易对手编号）       → 客户映射 → 外部客户号 → 客户资料

两种“关联合约”也要分开：
  relatedOption属性值 → Rel_Agt_Id：源属性直接给出的关联合约编号。
  有效的期权—互换关系 → Marg_Agt_Id：本互换关联哪些期权，按互换键汇总。
两者的来源、取值方式和用途不同；本SQL没有用其中一套反推另一套关系。

以下8个CTE是并列资料，在主脚本分别连接，不在本文件中拼成一张宽表。
*/

-- rt：互换合约；key_otc_trade_id为内部交易键，key_ctpty_id为交易对手编号。
-- trs_type=互换类型，start_date/end_date=期初/期末定价日，contr_status=合约状态。
-- 本金金额来自腿的历史持仓：初始金额汇总“期初价×初始数量”，当日金额汇总“期初价×当日数量”。
-- 对应文件为07_初始持仓.sql、08_当日持仓.sql；本合约提供币种和期初汇率，供10_本金与汇率.sql换算。
-- seller原义为“卖方，关联交易对手ID”，不是销售人员；bundle_id为组合编号。
-- contract_code为“合约编号（对外）”，输出Ext_Comp_No；与交易表输出的Agt_Id分开保留。
trs_contract AS (
    select * from odata_n_tit.d_ref_trs where busi_Date = '${data_day_str}' -- 场外交易-TRS
),

-- TOCR：合约报备信息；actual_settlement_date原义“实际结算日”，输出为Early_Term_Date（提前终止日）。
-- 按内部合约ID连接，不选最新、不聚合；多条报备记录会保留多个匹配。
settlement_report AS (
    select * from odata_n_tit.d_trd_otc_contr_report where busi_Date = '${data_day_str}' -- 交易-合约报备信息
),

-- 将 OTC 合约里的内部交易对手 ID，转换成公共客户体系的客户 ID，方便统一客户识别。
-- key_ctpty_id（内部交易对手ID）→ outside_ctpty_code（外部唯一码）→ 公共客户client_id。
customer_mapping AS (
    select * from odata_n_tit.d_ref_ctpty_mapping where busi_Date = '${data_day_str}' -- 交易参数-交易对手映射表
),

-- 当前 OTC 合约关联的另一个合约编号。
related_contract AS (
    select * from odata_n_tit.d_trd_otc_contr_props -- 【AI】交易-场外合约结构-其他属性表
    where busi_Date = '${data_day_str}' and property_name = 'relatedOption'
),

-- 提取 OTC 合约的静态履约保证金参数。
-- initial_margin=保证金初始线(%)，margin_balance_init=初始履约保障金额(元)，basic_margin_rate=基础保证金率。
margin_parameters AS (
    select * from odata_n_tit.d_ref_otc_contr_margin_param -- 【AI】合约-静态履约保证金参数
    where busi_Date = '${data_day_str}'
),

-- 有效关联（Y）按互换合约ID汇总期权合约ID，分号拼接为Marg_Agt_Id。
-- 注意方向：trs_key_otc_trade_id是互换键，option_key_otc_trade_id是期权键。
-- 和期权分支不同：这里不追加LONG_HOLD_SWAP类型限制；collect_set去重后再拼接。
margin_option_links AS (
    select trs_key_otc_trade_id, concat_ws(';',collect_set(option_key_otc_trade_id)) as Marg_Agt_Id
    from odata_n_tit.f_ref_option_margin_trs_relation -- 期权合约与互换合约关联关系表
    where busi_date = '${data_day_str}' and status = 'Y'
    group by trs_key_otc_trade_id
),

-- sct：CD382合约类型字典；dw_cd_val=代码，dw_cd_val_desc=中文描述。
-- 例如CALL_SWAP=多头互换、PUT_SWAP=空头互换、LEND_SWAP=借券互换。
-- 这些是源类型描述；09模块还会结合标的、账簿等属性生成经营分类。
-- 例示码值来自本地CD382快照，备注限定TITANS场外衍生品合约类型，记录业务日期2023-04-27。
contract_type_dictionary AS (
    select *
    from PDATA_N.REF_DW_CD_VAL -- 仓库代码取值
    where dw_cd_id = 'CD382' and remark = 'TITANS场外衍生品合约类型'
),

-- sutd：CD128标的类型字典；按his_ini.ins_family连接，保留主脚本的原关联。
underlying_type_dictionary AS (
    select *
    from PDATA_N.REF_DW_CD_VAL -- 仓库代码取值
    where dw_cd_id = 'CD128' and remark = 'TITANS场外衍生品标的类型'
)
