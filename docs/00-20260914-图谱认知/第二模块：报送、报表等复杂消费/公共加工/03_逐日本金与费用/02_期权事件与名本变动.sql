/*
02 / 核心问题：期权没有像 TRS 那样的逐日持仓表，如何知道每天还剩多少名义本金？
解决思路：期权动态本金：通过存续期事件还原每日名义本金变化。

【核心问题】
    期权不像普通TRS一样有逐日持仓表，无法直接读取“某一天还剩多少名义本金”。
    因此这里不从每日持仓取本金，而是：
    初始本金
    + 存续期事件造成的累计本金变化
    = 对应日期的动态本金

【与普通互换的区别】
    普通互换：
    初始持仓 + 每日持仓变化 → 当日本金

    期权：
    初始本金 + 存续期事件累计变化 → 当日本金
    当前只考虑会改变本金规模的两类已生效事件：PARTIAL_TERMINATION 部分终止、EARLY_LOCK_PL 提前锁盈

    事件来源：交易-OTC OPTION存续期事件表

【本模块输出什么】
    本模块只计算：
    每个事件日开始后生效的“累计名义本金变化 notional_change”

    并把这个累计变化延续到下一事件日前一天。

    它本身不直接计算最终本金。
    主脚本后续使用：
    动态本金 = 初始本金 + 累计本金变化 × Cny_Ex_Rate

【处理流程】：
    (同合约同事件)日汇总→判断本金增减方向→累计名义本金变化→展开到下一事件日前一天
【主脚本】：
    动态本金 = 初始本金 + 累计变化 × 合约主信息中的Cny_Ex_Rate

【示例】
    初始本金1000：
    9月19日减少200 → 累计变化-200，本金800
    9月20日减少100 → 累计变化-300，本金700

【注意】
- notional_delta为名本变动金额，不是事件后余额。
- 没有事件日期时，本模块不生成记录，主逻辑回退初始本金。
- 期末/终止后的有效性由主脚本判断。
- 增减方向由notional_after与notional_before比较后决定，不是直接累加原始delta。
*/

/*
① 【同合约同事件日汇总事件】，得到调整前后本金及变动金额。
    主要处理终止/锁盈类事件导致的本金调整。【只考虑会影响本金规模的事件】
    按同合约、同事件日汇总：
    notional_before = 当日所有事件中最大的调整前本金 
    notional_after = 当日所有事件中最小的调整后本金
    notional_delta = 当日所有事件的变动金额之和
    同日多事件合并，不逐笔计算事件顺序。
*/
option_event_daily AS (
    select
        key_option_deal_id, -- 场外期权合约ID；接合约主信息的Inr_Seri_No
        max(cast(notional_before as double)) as notional_before, -- 调整前名义本金（事件最开始的名本）
        min(cast(notional_after as double)) as notional_after, -- 调整后名义本金（事件最后的名本）
        sum(notional_delta) as notional_delta, -- 名义本金变动金额之和
        event_date -- 事件日期
    from odata_n_tit.d_trd_option_event toe -- 交易-OTC OPTION存续期事件表
    where busi_Date = '${data_day_str}' and event_status = 'EFFECTIVE' 
    and event_type in ('PARTIAL_TERMINATION','EARLY_LOCK_PL')--（部分终止、提前锁盈等事件）
    group by key_option_deal_id, event_date
    ),

/*
② 判断方向并累计：
    notional_after < notional_before 
            → -notional_delta，本金减少 
    notional_after >= notional_before 
            → +notional_delta，本金增加或不减
再按：
key_option_deal_id + event_date顺序
做累计SUM，得到：notional_change = 截至当前事件日的累计名义本金变化

例如：
9/19 -200 → 累计 -200
9/20 -100 → 累计 -300

同时计算下一事件日 next_date：
    有下一事件 → 下一事件日期 
    没有下一事件 → '${data_day_str}' + 1天

*/
option_event_balances AS (
    select
        key_option_deal_id,
        sum(
            case
                when cast(notional_after as double) < cast(notional_before as double)
                    then -notional_delta
                else notional_delta
            end
        ) over (
            partition by key_option_deal_id
            order by event_date
        ) as notional_change, -- 截至当前事件日的累计名义本金变化

        lead(
            event_date,
            1,
            date_add('${data_day_str}', 1)
        ) over (
            partition by key_option_deal_id
            order by event_date
        ) as next_date, -- 下一事件日；最后一个事件默认取加工日次日

        event_date --时间日期
    from option_event_daily x
    ),

/*
③ ③ 将“事件之间的一段有效期”展开成逐日记录。

每个事件形成一个日期区间：
    [当前事件日, 下一事件日前一天]
    整个区间内使用相同的 notional_change。

注意：
本模块不会生成“首个事件之前”的日期。

因此：

首个事件之前
    → 主脚本JOIN不到 notional_change
    → 使用初始本金

首个事件之后
    → 使用 初始本金 + 累计事件变化

这正是该模块与主脚本配合还原每日动态本金的方式。

| key_option_deal_id | Accrued_Date | notional_change |
| ------------------ | ------------ | --------------: |
| A1                 | 2026-09-19   |            -200 |
| A1                 | 2026-09-20   |            -200 |
| A1                 | 2026-09-21   |            -200 |
*/
option_event_days AS (
select
    key_option_deal_id, -- 场外期权合约ID
    notional_change, -- 截至该日已经生效的累计名义本金变化
    date_format(date_add(event_date, pos),'yyyy-MM-dd') as Accrued_Date -- 累计变化对应的计提日期
from option_event_balances t

lateral view posexplode(
    split(
        space(datediff(next_date, event_date) - 1),
        ' '
    )
) t as pos, val

)