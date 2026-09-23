/*
10 / 本金 = 持仓算出的金额 × 合约提供的人民币换算汇率

先分清分工：持仓提供“价格和数量”，合约提供“币种和汇率”。
本文件不再选持仓、不再按腿求和，只使用已算好的两份金额。
下文的07、08是同目录文件名的编号，不是表名、月份或业务代码。

一、SQL里的三个别名从哪里来？
  his_ini.Nom_Prin：初始持仓金额
    07_初始持仓.sql → initial_position结果 → 主脚本别名his_ini
    源表：odata_n_tit.d_pos_trs_leg_his_pos（【AI】持仓-TRS浮动及结构化腿历史持仓）
    当前快照内，每个“腿＋标的”取最早源业务日记录，补标的属性后按腿汇总：
    SUM(Init_Price × Init_Quantity)，即期初交易价 × 初始数量之和。

  his_dy.Nom_Prin：当日持仓金额
    08_当日持仓.sql → daily_position结果 → 主脚本别名his_dy
    源表同上，但只选源业务日为加工日的记录，按腿汇总：
    SUM(Init_Price × Quantity)，即当日记录自身的期初交易价 × 当日数量之和。
    它不取初始持仓结果中的价格，也不使用当天市价。

  rt：互换合约
    02_合约及来源属性.sql → trs_contract结果 → 主脚本别名rt
    源表：odata_n_tit.d_ref_trs（场外交易-TRS）。
    提供下面的三个币种字段及两个期初汇率字段，不在这里提供本金金额。

二、先选一个汇率R，再计算初始、动态本金
  按顺序取第一个满足的条件：
  ① currency（合约币种）为CNY         → R = 1
  ② base_currency（本币币种）为CNY    → R = base_init_exchange_rate
  ③ settlement_currency（结算币种）为CNY → R = settle_init_exchange_rate
  都不满足 → R = NULL；没有另查市场汇率，也没有取倒数。
  base_init_exchange_rate原注释为“【AI】期初汇率(本币对标的币种)”；
  settle_init_exchange_rate为“结算期初汇率”。这里只按原SQL直接使用，不另推导方向。

  Cny_Ex_Rate   人民币汇率     = R
  Init_Nom_Prin 初始名义本金   = 初始持仓金额 × R
  Dyna_Nom_Prin 动态名义本金   = 当日持仓金额 × R（当日金额为NULL时先补0）
  Absl_Nom_Prin 绝对名义本金   = 固定字符串'0.0'，不是对某个金额取绝对值

三、贯穿示例（假设单一标的、无重复匹配，且满足上述②、所选汇率为0.9）
  初始记录：期初价10 × 初始数量100 = 1000 → 初始名义本金1000 × 0.9 = 900
  当日记录：期初价10 × 当日数量60  =  600 → 动态名义本金 600 × 0.9 = 540
  “动态”在此体现当日数量；不是用当天市价重估，也没有额外套合约起止日期判断。

缺失处理：初始金额不补0；当日金额补0不代表实际持仓一定为0。
汇率为NULL时，两种本金都仍为NULL，包括0 × NULL。
*/

-- ① 输出选中的汇率。下面两项金额重复同一个CASE，是同一换算规则，不是三种汇率。
CASE WHEN RT.CURRENCY = 'CNY' THEN 1 
         WHEN RT.BASE_CURRENCY = 'CNY' THEN RT.BASE_INIT_EXCHANGE_RATE 
         WHEN RT.SETTLEMENT_CURRENCY = 'CNY' THEN RT.SETTLE_INIT_EXCHANGE_RATE
         end as Cny_Ex_Rate, -- 人民币汇率

-- ② 初始持仓金额 × 上述汇率。
his_ini.Nom_Prin * CASE WHEN RT.CURRENCY = 'CNY' THEN 1 
         WHEN RT.BASE_CURRENCY = 'CNY' THEN RT.BASE_INIT_EXCHANGE_RATE 
         WHEN RT.SETTLEMENT_CURRENCY = 'CNY' THEN RT.SETTLE_INIT_EXCHANGE_RATE
         end as Init_Nom_Prin, -- 初始名义本金

-- ③ 当日持仓金额（缺失先补0）× 上述汇率。
coalesce(his_dy.Nom_Prin, 0) * CASE WHEN RT.CURRENCY = 'CNY' THEN 1 
         WHEN RT.BASE_CURRENCY = 'CNY' THEN RT.BASE_INIT_EXCHANGE_RATE 
         WHEN RT.SETTLEMENT_CURRENCY = 'CNY' THEN RT.SETTLE_INIT_EXCHANGE_RATE
         end as Dyna_Nom_Prin, -- 动态名义本金

-- ④ 原分支固定值，不新增计算。
'0.0' as Absl_Nom_Prin, -- 绝对名义本金
