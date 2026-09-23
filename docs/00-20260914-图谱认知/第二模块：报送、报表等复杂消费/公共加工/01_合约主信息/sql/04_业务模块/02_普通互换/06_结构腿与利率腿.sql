/*
06 / 一份互换为什么还要拆“腿”？

在这套模型中，合约保存客户、期限、类型等整体信息；
腿把挂钩标的的持仓与固定/浮动利率条款分开登记。

互换合约（key_otc_trade_id）
  ├─ 结构腿（key_leg_id）→ 初始持仓／当日持仓 → 标的与本金金额
  │                       IPO/限售属性从结构腿本身取得
  └─ 非结构腿           → 固定利率 / 浮动利率挂钩标的 / 利差 / 利率上限

注意两个“标的”：结构腿持仓中的标的是资产证券；
浮动腿 underlying_ins_id 的元数据释义是“浮动利率挂钩标的”。
后者输出 Float_Undrl_Cd，不要拿它替换持仓证券的 Undrl_Ins_Id。

关键字段原义：key_leg_id=LEG全局顺序号；key_otc_trade_id=内部交易流水号；
leg_type=LEG类型（字典项TRS_LEG_TYPE）；fixed_rate=固定利率；
spread=利差；floating_rate_cap=浮动利率上限。元数据未标明这些利率的单位。
*/

-- 结构腿（rtl）：只保留 leg_type=STRUCTURE_LEG_TYPE，通过交易键连接合约。
-- key_leg_id 是后续初始持仓入口；IPO、限售标志也来自结构腿，不来自利率腿。
-- private_placement原注释“是否限售”；ipo_type原注释“【AI】限售类型”，
-- 但本SQL把ipo_type用于IPO_Flag及南下IPO分类，字段原注释与消费用途分开理解。
structure_legs AS (
    select *
    from odata_n_tit.d_ref_trs_leg -- 场外交易-TRS-leg基本信息
    where busi_Date = '${data_day_str}' and leg_type = 'STRUCTURE_LEG_TYPE'
    ),

-- 非结构腿（rtl_f）：原条件是 leg_type != STRUCTURE_LEG_TYPE，不等于只筛固定/浮动腿。
-- 输出时再分别判断 FIXED_LEG_TYPE/FLOAT_LEG_TYPE；NULL leg_type 不满足这里的不等式。
-- 两类腿各自按交易键连接；如两侧均多条，主查询仍可能形成多对多组合，未新增消重。
-- 输出字段：固定腿的fixed_rate → fixed_rate；浮动腿的fixed_rate → Float_Base_Rate。
-- 浮动腿也读取同名fixed_rate是现有映射，不表示这里重新计算了市场浮动利率。
interest_legs AS (
    select *
    from odata_n_tit.d_ref_trs_leg -- 场外交易-TRS-leg基本信息
    where busi_Date = '${data_day_str}' and leg_type != 'STRUCTURE_LEG_TYPE'
    )
