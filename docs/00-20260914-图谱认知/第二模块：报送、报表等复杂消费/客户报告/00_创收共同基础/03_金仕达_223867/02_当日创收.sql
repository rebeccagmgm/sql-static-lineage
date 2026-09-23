-- 用途：在01结果投影的SELECT层计算Curr_Rev（当日计提创收），最后的逗号接下一输出列。
-- co.ks_other_profit / ks_long_fee ← S_V_CONFIRMATION_OVERVIEW 累计资料按清算日差分（见03）。
-- bc.actual_occupy_amt / remain_contract ← S_GF_BK_CONTRACT 最近交易日记录；后者具体经济释义待确认，不猜为保证金。
-- fc.fund_cost_rate ← G_CLIENT_REVENUE_COEFFICIENT按生效日展开（见06），没有NULL回退。
-- tc.long_trade_amount ← S_GF_BK_CONTRACT当日成交差分（见04）；cas.cust_total_fee ← M_T_CMP_AGENT_STAT费用差分（见05）。
-- 正常多空互换：利息－非负净占资×年成本率/365＋毛佣金－成交扣费－报盘费；其他类型返回0。
-- 0.0000641和365是本次实际SQL固定值，制度依据未确认；本任务没有118141的跨合约系统费用二次分摊。
if(
    info.Src_Contr_Type = 'B_LONG_SHORT_SWAP',
    coalesce(co.ks_other_profit,0)
    - default.gfgreatest(
        coalesce(bc.actual_occupy_amt,0)-coalesce(bc.remain_contract,0),
        0
      ) * fc.fund_cost_rate / 365
    + coalesce(co.ks_long_fee,0)
    - coalesce(tc.long_trade_amount,0) * 0.0000641
    - coalesce(cas.cust_total_fee,0),
    0
) AS Curr_Rev,

