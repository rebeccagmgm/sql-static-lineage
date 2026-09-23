/*
08 / 今天这条结构腿按期初价格计量的规模是多少？

本文件读取源业务日为加工日的持仓，按腿计算当日金额：
  当日持仓金额 = Σ（该条持仓记录的Init_Price期初交易价 × Quantity当日数量）。
与07_初始持仓.sql的区别：初始持仓选每个标的最早记录、用Init_Quantity初始数量。

价格取当日记录自身的Init_Price，不关联初始持仓的价格，也不使用当前市价。

两个条件同时成立：快照busi_date是加工日，src_busi_date的日期部分也是加工日。
如果没有当天记录，不会自动找前一个交易日的持仓延续。
*/

-- daily_position在主脚本中别名为his_dy；his_dy.Nom_Prin供10_本金与汇率.sql计算动态本金。
-- 实际连接链：结构腿 → 初始持仓his_ini → 当日持仓his_dy；没有初始结果就无法匹配当日结果。
-- 本模块不生成无记录的腿；缺失金额补0、乘汇率均在10_本金与汇率.sql完成。
daily_position AS (
    SELECT
        key_leg_id, -- 腿键；一行对应一条腿
        sum(Init_Price * Quantity) as Nom_Prin -- 【AI】期初交易价 × 【AI】数量；尚未折算人民币
    FROM odata_n_tit.d_pos_trs_leg_his_pos -- 【AI】持仓-TRS浮动及结构化腿历史持仓
    where busi_Date = '${data_day_str}' and substring(src_busi_date,1,10) = '${data_day_str}'
    group by key_leg_id
    )
