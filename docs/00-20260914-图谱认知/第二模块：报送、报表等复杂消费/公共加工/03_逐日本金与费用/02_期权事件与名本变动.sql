/*
02 / 核心问题：期权没有像 TRS 那样的逐日持仓表，如何知道每天还剩多少名义本金？
解决思路：期权动态本金：通过存续期事件还原每日名义本金变化。

【背景】
期权无逐日持仓，通过事件表记录本金调整。
    【与互换对比】
    普通互换：初始持仓+每日持仓变化 → 当天本金
    期权：初始本金 + 存续期事件变化 → 每天本金 （部分终止、提前锁盈等事件）

【逻辑】
事件表来源：odata_n_tit.d_trd_option_event（交易-OTC OPTION存续期事件表）。
只选本次快照中已生效EFFECTIVE的部分终止PARTIAL_TERMINATION、提前锁盈EARLY_LOCK_PL事件。
这里只算累计名本变化，不直接输出最终本金。

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
    最大调整前本金 = 当日事件开始前本金；
    最小调整后本金 = 当日事件完成后本金；
    delta求和 = 当日累计变动金额。
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

-- ② 判断方向并累计：调整后<调整前时取负delta，其余取正delta；不额外取ABS或限制为非负。
-- next_date是下一事件日；最后一个事件的默认终点是加工日次日，不是合约终止日。
option_event_balances AS (
    select
        key_option_deal_id,
        sum(case when cast(notional_after as double) < cast(notional_before as double) then - notional_delta else notional_delta end) over(partition by key_option_deal_id order by event_date) as notional_change,
        lead(event_date, 1, date_add('${data_day_str}',1)) over(partition by key_option_deal_id order by event_date) as next_date,
        event_date
    from option_event_daily x
    ),

-- ③ 延续到每天：[本事件日，下一事件日前一天]使用同一个累计变化。
-- 没有事件的日期不会在本模块补行；主脚本LEFT JOIN缺失时回退初始本金。
option_event_days AS (
    select
        key_option_deal_id,
        notional_change,
        date_format(date_add(event_date, pos),'yyyy-MM-dd') as Accrued_Date
    from option_event_balances t
    lateral view posexplode(split(space(datediff(next_date, event_date)-1), ' ')) t as pos, val
    )
