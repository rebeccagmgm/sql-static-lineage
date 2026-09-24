/*
本文件字段的实际来源（左侧为本文件字段，右侧为源表字段）

enriched：主脚本中option_classified的别名，不是物理表。
以下字段在02_合约基础引入，经03_标的及篮子、09_经营分类原值传递：

  odata_n_tit.d_ref_otc_option_deal（期权交易合同要素表）
    enriched.collateral_notional_currency ← collateral_notional_currency  绝对名义本金币种
    enriched.settlement_currency          ← settlement_currency           结算币种
    enriched.initial_notional             ← initial_notional              初始名义本金
    enriched.notional                     ← notional                      名义本金
    enriched.collateral_notional          ← collateral_notional           绝对名义本金
    enriched.early_term_date              ← early_term_date               提前终止日

  odata_n_tit.d_ref_option_deal_structure
  
  （期权交易结构表）
    enriched.initial_exchange_rate ← init_notl_exchange_rate  期初汇率：名义本金币种对结算币种
    enriched.start_date            ← start_date              期初定价日
    enriched.end_date              ← end_date                期末定价日


mid：主脚本中odata_n_tit.d_ref_rmb_midrate的别名（本SQL用于取人民币中间价）。
    mid.MIDRATE    ← midrate     中间价
    mid.currency   ← currency    币种
    mid.quote_date ← quote_date  报价日期
    上述三个字段的元数据注释均 带【AI】标记。
    连接条件：mid.currency = enriched.collateral_notional_currency
              mid.quote_date = enriched.start_date（取期初定价日，不是加工日）


计算口径
1、汇率 Cny_Ex_Rate
    CNY名义本金 → 1
    结算币种CNY → initial_exchange_rate
    其他 → mid.MIDRATE
2、初始名本
    汇率 * initial_notional
3、动态名本
    Dyna_Nom_Prin = Cny_Ex_Rate × 计入区间内 notional（区间外直接取0）
    计入区间：start_date（期初定价日） ≤ 加工日 ≤ coalesce(early_term_date, end_date)
    结束日优先取提前终止日，为NULL时取期末定价日；区间外取0，区间内notional为空也取0。
4、绝对名本
    汇率 × collateral_notional


    
*/
case
        when enriched.collateral_notional_currency = 'CNY' then 1
        when enriched.settlement_currency = 'CNY' then enriched.initial_exchange_rate
        else mid.MIDRATE
        end as Cny_Ex_Rate, -- 人民币汇率
(case
        when enriched.collateral_notional_currency = 'CNY' then 1
        when enriched.settlement_currency = 'CNY' then enriched.initial_exchange_rate
        else mid.MIDRATE
        end
    ) * enriched.initial_notional as Init_Nom_Prin, -- 初始名义本金
(case
        when enriched.collateral_notional_currency = 'CNY' then 1
        when enriched.settlement_currency = 'CNY' then enriched.initial_exchange_rate
        else mid.MIDRATE
        end
    ) * if('${data_day_str}' between substring(enriched.start_date, 1, 10) and substring(coalesce(enriched.early_term_date,enriched.end_date), 1, 10), coalesce(enriched.notional,0), 0) as Dyna_Nom_Prin, -- 动态名义本金
(case
        when enriched.collateral_notional_currency = 'CNY' then 1
        when enriched.settlement_currency = 'CNY' then enriched.initial_exchange_rate
        else mid.MIDRATE
        end
    ) * enriched.collateral_notional as Absl_Nom_Prin, -- 绝对名义本金
