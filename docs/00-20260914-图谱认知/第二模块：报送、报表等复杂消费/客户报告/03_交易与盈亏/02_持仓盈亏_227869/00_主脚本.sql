-- 227869持仓盈亏：结算资金与当日估值两路并列，按客户名+标的合并，再左接当日持仓主体。
-- 01结算资金内部引用02资金快照/客户及03标的识别；04估值不依赖01输出。
-- 06结果内部引用05当日持仓，只有底座持仓行能进入最终报表。
-- UNION保留原始去重语义，不擅改UNION ALL；整段未做汇率换算或统一盈亏正负方向。
with pnl as(
  SELECT
    busi_date,
    ctpty_legal_entity,
    wind_code,
    SUM(cap_amount) AS profit_loss
  FROM (
-- @include 01_结算资金汇总.sql
    UNION
-- @include 04_当日估值汇总.sql
  )
  GROUP BY busi_date, ctpty_legal_entity, wind_code
)
-- @include 06_结果匹配与比例.sql
