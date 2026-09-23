-- 234355：报告日快照中的近12个月标的日持仓；按公司＋业务类型＋标的代码/名称＋计提日汇总。
-- 动态本金除10000输出万元；current_pnl固定NULL，当前没有计算标的持仓盈亏。
-- grp_id只取01/02/03，但没有限制Busi_Type；原CASE把所有非OPTION（含NULL）都显示成“互换”。
SELECT company_name,
    company_id,
    underlying_type,
    underlying_code,
    underlying_name,
    hold_amount,
    current_pnl,
    busi_date FROM (
SELECT
    Cutp_Pty_Full_Name as company_name -- 创收日报交易对手全称，参与分组
    ,USCC as company_id -- 统一社会信用代码，参与分组
    ,case when Busi_Type = 'OPTION' then '期权' else '互换' end as underlying_type -- DDL叫“合约类型”，实际按业务类型映射
    ,Undrl_Wd_Cd as underlying_code -- 标的万得代码
    ,Undrl_Name as underlying_name -- 标的名称也参与分组，同代码不同名不自动合并
    ,sum(Dyna_Nom_Prin) / 10000 as hold_amount -- 当日动态本金，元转万元；保留源负值，非绝对市值
    ,NULL as current_pnl -- 占位字段，不是已算出零盈亏
    ,Accrued_Date as busi_date -- 输出历史计提日，而非选源快照的报告日
from DM_OTC_N.OTC_REV_DAILY_RPT -- 合约创收日报；此处只消费客户、标的、业务类型、日期与动态本金
where busi_date = '${yyyy-MM-dd}'
    and grp_id in ('01', '02', '03')
    and Accrued_Date between '${yyyy-MM-dd, -12M}' and '${yyyy-MM-dd}'
group by USCC, Cutp_Pty_Full_Name, Undrl_Wd_Cd, Undrl_Name, busi_type, Accrued_Date
-- 按原始busi_type分组后再映射中文，不同非OPTION类型可能形成多行相同显示标签。
-- 不补无持仓日期、不按合约去重；SUM全NULL仍为NULL，并非自动补0。
) castTable
