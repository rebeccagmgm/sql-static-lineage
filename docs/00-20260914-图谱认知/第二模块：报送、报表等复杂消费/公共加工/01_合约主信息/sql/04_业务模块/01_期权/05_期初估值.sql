/*
* 从日终估值结果表中，按“工具 + 账簿”找到最新一条估值记录，作为该期权的期初 NPV。

- 【指标字段】期初NPV：
    - 期权没有固定现金流，估值模型（未来各种可能情景→概率加权→折现→当前价值）
    
*/
latest_valuation AS (
    select
        key_instrument_id, -- 证券内码
        initial_npv, -- 期初NPV
        key_book_id, -- 账簿ID
        row_number() over(partition by key_instrument_id,key_book_id order by quote_date desc) as rk --quote_date：计算日期
    from odata_n_tit.d_pos_eod_calc_metrics -- 日终持仓-指标计算结果表；
    where busi_date = '${data_day_str}' and ins_family = 'OTC_OPTION_CONTRACT' --ins_family：证券类型
    )
