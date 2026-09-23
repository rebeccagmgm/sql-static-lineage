/*
03 / 普通互换每个历史日的金额，怎样从腿的持仓汇总到合约？

  结构腿d_ref_trs_leg：内部交易键key_otc_trade_id、腿键key_leg_id
    └─按腿键接d_pos_trs_leg_his_pos：源业务日、期初价、初始数量、当日数量
         └─按“内部交易键＋源业务日期”汇总 → 主脚本别名his_dy

两张源表都取加工日快照，持仓另限源业务日期在加工日前150天至加工日。
每个计提日直接匹配该日持仓，不自动延续前一天；缺失金额在最终CASE中按0处理。

本模块产出两个金额：
  Init_Nom_Prin_Org = Σ(Init_Price × Init_Quantity)，原SQL保留但最终SELECT未使用。
  Dyna_Nom_Prin_Org = Σ(Init_Price × Quantity)，用于“历史日金额 × 汇率”。
主脚本的初始本金始终取合约主信息，期初定价日也优先取它，不改取本模块的初始金额。
*/

-- ① 结构腿：leg_type为结构腿类型；不是把所有固定/浮动利率腿都纳入。
trs_structure_legs AS (
    select * from odata_n_tit.d_ref_trs_leg -- 场外交易-TRS-leg基本信息
    where busi_Date = '${data_day_str}' and leg_type = 'STRUCTURE_LEG_TYPE'
    ),

-- ② 历史持仓：src_busi_date为【AI】源业务日期；这里只裁日期窗口，不选“最新一条”。
trs_position_history AS (
    SELECT *
    FROM odata_n_tit.d_pos_trs_leg_his_pos -- 【AI】持仓-TRS浮动及结构化腿历史持仓
    where busi_Date = '${data_day_str}'
        and substring(src_busi_date,1,10) between date_sub('${data_day_str}',150) and '${data_day_str}'
    ),

-- ③ 按交易、日期汇总：同一交易的多条结构腿在这里合并；腿或持仓重复匹配仍参与求和。
trs_daily_positions AS (
    SELECT
        rtl.key_otc_trade_id, -- TRADEFLOW内部交易流水号，接info.Inr_Seri_No
        sum(his.Init_Price * his.Init_Quantity) as Init_Nom_Prin_Org,
        sum(his.Init_Price * his.Quantity) as Dyna_Nom_Prin_Org, -- 【AI】期初交易价×数量，尚未乘汇率
        substring(his.src_busi_date,1,10) as Accrued_Date
    FROM trs_structure_legs rtl
    inner join trs_position_history his
    ON his.key_leg_id = rtl.key_leg_id
    group by rtl.key_otc_trade_id, substring(his.src_busi_date,1,10)
    )
