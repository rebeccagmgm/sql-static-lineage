/*
10 / 两个本金都来自dynamic_notional，区别在“选哪天的持仓”

实际来源：odata_n_tit.d_pos_fast_trs_leg_his_pos（北上极速腿历史持仓表）。
dynamic_notional的字段注释是“动态名义本金（标的币种）”。
本分支不使用合约表d_ref_fast_trs上的notional/dynamic_notional，
也不在这里重算价格×数量；合约上的同名字段注释是结算币种，不能混作同一来源。

  07_初始持仓.sql → initial_position，主脚本别名dy
    每个“合约工具键＋WIND代码”取最早日终记录，补标的资料后求和。
    dy.Init_Nom_Prin = SUM(最早记录的dynamic_notional)

  08_当日持仓.sql → daily_position，主脚本别名np
    取源持仓日期等于加工日的日终记录，直接按合约工具键求和。
    np.Dyna_Nom_Prin = SUM(当日记录的dynamic_notional)

示例（无重复匹配、同一币种）：
  标的A最早金额100、标的B最早金额200 → 初始本金300；
  当日A金额80、B金额150             → 动态本金230。
  初始记录可以来自不同日期；初始金额缺失不补0，当日金额为NULL则输出处补'0'。

与普通互换不同：这里不选择期初汇率、不乘汇率，也不增加合约起止日期判断。
Cny_Ex_Rate固定输出字符串'1'，只说明这段SQL未换汇；
结合“标的币种”的源字段注释，不能直接宣称金额已折成人民币。
原SQL按合约工具键直接求和，没有按币种分别汇总；上游币种约束或换算口径仍需另核实。
*/

'1' as Cny_Ex_Rate, -- 固定输出1，本分支不做汇率计算
dy.Init_Nom_Prin, -- 初始名义本金：最早持仓金额汇总，缺失保持NULL
coalesce(np.Dyna_Nom_Prin,'0') as Dyna_Nom_Prin, -- 动态名义本金：当日汇总，缺失补'0'不证明实际无持仓
'0.0' as Absl_Nom_Prin, -- 固定值，不是对某个本金取绝对值
