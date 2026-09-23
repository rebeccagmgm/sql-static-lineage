/*
06 / 某次计提费率，在哪些日期继续使用？

来源：odata_n_tit.d_trd_daily_accrual_fee（【AI】按日应计提费用表）。
只读加工日快照、fee_type='ACCRUAL_PREMIUM_FEE'；输出的是fee_rate（费率），不是费用金额。
按KEY_INSTRUMENT_ID（场外合约主数据代码）找下一计提日期CALC_DATE，
把本条费率延续到下一计提日前一天；最后一条延续到加工日。

  18日费率a、20日费率b → 18/19日用a，20日起用b。
主脚本按info.Otc_Seri_No＋计提日连接，缺记录时fee_rate保持NULL。
原SQL没有限制只用于某个grp_id，也没有按同工具、同计提日去重。
*/

fee_intervals AS (
    SELECT *, lead(CALC_DATE, 1, date_add('${data_day_str}',1)) over(partition by KEY_INSTRUMENT_ID order by CALC_DATE) as next_date
    FROM odata_n_tit.d_trd_daily_accrual_fee -- 【AI】按日应计提费用表
    where busi_Date = '${data_day_str}' and fee_type = 'ACCRUAL_PREMIUM_FEE'
    ),

-- Accrued_Date为延续后的计提日；CALC_DATE仍是原记录的计提日期。
fee_days AS (
    select *, date_format(date_add(CALC_DATE, pos),'yyyy-MM-dd') as Accrued_Date
    from fee_intervals t
    lateral view posexplode(split(space(datediff(next_date, CALC_DATE)-1), ' ')) t as pos, val
    )
