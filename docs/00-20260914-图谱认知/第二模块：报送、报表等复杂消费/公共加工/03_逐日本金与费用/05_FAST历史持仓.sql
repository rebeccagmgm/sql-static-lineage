/*
05 / FAST在各历史日的金额是多少？

来源：odata_n_tit.d_pos_fast_trs_leg_his_pos（北上极速腿历史持仓表）。
取加工日快照中的EOD_POSITION（日终持仓），源持仓日期限加工日前150天至加工日。
按“合约工具键＋源持仓日期”汇总dynamic_notional，主脚本用Otc_Seri_No和计提日连接。

dynamic_notional注释为“动态名义本金（标的币种）”，本模块只求和；
主脚本仍乘合约主信息的Cny_Ex_Rate，缺金额或汇率导致乘积为NULL时补0。
不按标的选最早记录、不延续前日、不统一在合约终止后归零。

04号合约主信息分支的汇率固定为1，因此不能仅凭乘过该字段就确认金额是人民币。
本模块未单独筛N_CROSS_DMA_SWAP，业务范围由驱动它的合约主信息决定。
*/
fast_daily_positions AS (
    select
        key_instrument_id, -- 本表注释“合约ID”，对应合约主信息Otc_Seri_No
        sum(dynamic_notional) as dynamic_notional,
        substring(src_busi_date,1,10) as Accrued_Date -- 持仓日期：源头的busi_date
    from odata_n_tit.d_pos_fast_trs_leg_his_pos -- 北上极速腿历史持仓表
    where busi_date = '${data_day_str}' and position_type = 'EOD_POSITION'
        and substring(src_busi_date,1,10) between date_sub('${data_day_str}',150) and '${data_day_str}'
    group by key_instrument_id, substring(src_busi_date,1,10)
    )
