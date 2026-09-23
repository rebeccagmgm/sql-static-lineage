-- 227697：从报告日快照读取近12个月合约日，汇总成“公司名称＋USCC＋计提日”的规模序列。
-- 名称虽叫amount_change，实际是每天动态本金余额求和，没有计算今天减昨天；单位元。
-- 只限OPTION/TRS，不筛grp_id；与02业务统计、03标的持仓的范围不能直接视为相同。
SELECT company_name,
    company_id,
    option_amount_change,
    swap_amount_change,
    busi_date FROM (
SELECT
    Cutp_Pty_Full_Name as company_name -- 交易对手全称，作为公司名称及分组键
    ,USCC as company_id -- 统一社会信用代码；同代码不同名称仍分成不同组
    ,sum(case when Busi_Type = 'OPTION' then Dyna_Nom_Prin else 0 end) as option_amount_change -- 期权当日动态本金合计，非规模差额
    ,sum(case when Busi_Type = 'TRS' then Dyna_Nom_Prin else 0 end) as swap_amount_change -- 互换当日动态本金合计，非累计新增
    ,Accrued_Date as busi_date -- 输出日期改为历史计提日，不是下方选源快照的报告日
from DM_OTC_N.OTC_REV_DAILY_RPT -- 合约创收日报：同时携带本金、创收、客户身份与历史计提日
where busi_date = '${yyyy-MM-dd}' -- 只取本次报告日快照
  and Accrued_Date between '${yyyy-MM-dd, -12M}' and '${yyyy-MM-dd}' -- 近12个月，含两端；月底宏以调度实际展开为准
  and Busi_Type in ('OPTION', 'TRS')
group by
    USCC
    ,Cutp_Pty_Full_Name
    ,Accrued_Date
-- 不按合约去重、不补无记录日期；源重复参与求和，某一天没有记录就没有该日行。
) castTable
