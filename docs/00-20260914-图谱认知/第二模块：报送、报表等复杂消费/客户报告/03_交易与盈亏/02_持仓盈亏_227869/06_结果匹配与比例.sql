-- 最终将pnl按公司名称+标的代码接到持仓底座，不按USCC、合同或标的名称匹配。
-- current_pnl缺匹配补0后/10000；0既可能是真零，也可能是缺资料/名称不符/拼串无法匹配。
-- 比例=本行原盈亏 / 本公司名下连接结果的盈亏绝对值之和，不除本金，非投资收益率。
-- 窗口仅PARTITION BY公司名称：不同USCC同名共用分母；同代码异标的名会重复接同一盈亏。
-- 只有底座仍有的标的进入窗口；已退出持仓的历史盈亏不展示，也不进分母。
SELECT company_name,
	company_id,
	underlying_code,
	underlying_name,
	hold_amount,
	current_pnl,
	pnl_ratio,
	busi_date FROM (
SELECT
    t.company_name
    ,t.company_id
    ,t.underlying_code
    ,t.underlying_name
    ,t.hold_amount / 10000   as hold_amount
    ,COALESCE(pnl.profit_loss, 0) / 10000 as current_pnl
    ,CASE
        WHEN SUM(ABS(pnl.profit_loss)) OVER (PARTITION BY t.company_name) = 0
             OR pnl.profit_loss IS NULL
        THEN 0
        ELSE pnl.profit_loss / NULLIF(SUM(ABS(pnl.profit_loss)) OVER (PARTITION BY t.company_name), 0)
     END                                    as pnl_ratio
    ,'${yyyy-MM-dd}'                        as busi_date
from (
-- @include 05_当日持仓底座.sql
) t
LEFT JOIN pnl ON t.company_name = pnl.ctpty_legal_entity
              AND t.underlying_code = pnl.wind_code
	) castTable
