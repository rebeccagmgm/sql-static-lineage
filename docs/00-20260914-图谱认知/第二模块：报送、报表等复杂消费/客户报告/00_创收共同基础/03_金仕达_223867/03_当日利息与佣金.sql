-- 来源：ODATA_N_LSS.S_V_CONFIRMATION_OVERVIEW，金仕达合约确认汇总。
-- contract_code=合约内部编号，clear_date=清算日期；按合约、清算日排序后差分。
-- ks_other_profit：前一行累计值－本行累计值；ks_long_fee：本行累计值－前一行累计值。
-- 第一行的前值默认0；不是统一用本行－前行。这里没有限定报告日，不能先截掉历史再差分。
-- 输出 co，由主脚本按 info.Inr_Seri_No＋det.busi_date 连接。
select contract_code, clear_date,
        lead(coalesce(ks_other_profit,0), -1, 0) over(partition by contract_code order by clear_date) - coalesce(ks_other_profit,0) as ks_other_profit,  --当日利息收入
        coalesce(ks_long_fee,0) - lead(coalesce(ks_long_fee,0), -1, 0) over(partition by contract_code order by clear_date) as ks_long_fee  --当日交易佣金
    from odata_n_lss.s_v_confirmation_overview

