/*
08 / 当天的动态本金是多少？

只保留同时满足三个条件的持仓：
  数据日期busi_date = 加工日；
  持仓类型position_type = EOD_POSITION（日终持仓）；
  源持仓日期src_busi_date的日期部分 = 加工日。

再按key_instrument_id（本表注释：合约ID）汇总dynamic_notional。
这是读取源系统提供的金额，不是普通互换的“期初价格×当日数量”计算。
与07_初始持仓.sql不同：不选最早记录、不补证券资料、不去重。

结果daily_position在主脚本中别名为np，直接接交易表的key_instrument_id；
不经过初始持仓结果。没有当天记录时也不延续前日，输出处再对缺失金额补'0'。
*/
daily_position AS (
    select key_instrument_id, sum(dynamic_notional) as Dyna_Nom_Prin -- 动态名义本金（标的币种）之和
    from odata_n_tit.d_pos_fast_trs_leg_his_pos -- 北上极速腿历史持仓表
    where busi_date = '${data_day_str}' and position_type = 'EOD_POSITION' and substring(src_busi_date,1,10) = '${data_day_str}'
    group by key_instrument_id
    )
