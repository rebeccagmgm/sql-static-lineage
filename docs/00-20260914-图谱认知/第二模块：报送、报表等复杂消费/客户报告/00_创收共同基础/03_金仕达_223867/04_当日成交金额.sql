-- 来源：ODATA_N_LSS.S_GF_BK_CONTRACT，金仕达合约资金／成交资料。
-- long_trade_amount：本行累计成交金额－前一清算行累计成交金额，第一行前值默认0。
-- 输出 tc.long_trade_amount；主脚本按内部合约编号＋计提日精确连接，再乘0.0000641进入创收扣减。
-- 不使用上一交易日回退；非交易日匹配规则与主脚本中的占资 bc 不同。
select contract_code, clear_date,
        coalesce(long_trade_amount,0) - lead(coalesce(long_trade_amount,0), -1, 0) over(partition by contract_code order by clear_date) as long_trade_amount  --当日成交金额
    from odata_n_lss.s_gf_bk_contract

