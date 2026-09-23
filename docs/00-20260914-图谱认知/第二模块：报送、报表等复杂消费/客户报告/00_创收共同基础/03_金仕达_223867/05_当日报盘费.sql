-- 来源：ODATA_N_LSS.M_T_CMP_AGENT_STAT，金仕达客户报盘费用资料。
-- 先取报告日快照，按 合约＋交易日期＋累计费用 三列 DISTINCT，再按合约、交易日差分。
-- cust_total_fee：本行累计报盘费用－前行累计费用。DISTINCT不是保证合约＋日期唯一。
-- 输出 cas.cust_total_fee；主脚本按内部合约编号＋计提日连接，不做非交易日回填。
-- 元数据称cust_total_fee为“交易对手方报盘费用总计”；原行注释称“未结”有冲突，不据此改成cust_unsettle_fee。
select contract_code,trade_date,
        coalesce(cust_total_fee,0) - lead(coalesce(cust_total_fee,0), -1, 0) over(partition by contract_code order by trade_date) as cust_total_fee  --当日未结报盘费
    from (select distinct contract_code,trade_date,cust_total_fee from odata_n_lss.m_t_cmp_agent_stat
    where busi_date = '${yyyy-MM-dd}') t
