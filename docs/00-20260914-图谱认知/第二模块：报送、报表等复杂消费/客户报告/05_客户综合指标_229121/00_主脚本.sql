-- 六组阅读路径（各分支并列补充客户，不是前后相乘）：
-- 01 客户/销售底座 ┬─ 02结束创收、03→03.1净收计数 ─ 胜率
--                 ├─ 05→05.1比例、06→06.1追保权重、07额度、08规模 ─ 履保
--                 ├─ 09方案名称资料 ─ 增信展示
--                 ├─ 10天数比、11标签+11.1统计 ─ 追保/垫资
--                 └─ 04月换手、12腿估值、13佣金 ─ 互换活跃与费用
-- 全部分支 → 14统一输出（单位换算/四项NULL占位）→ dm_otc_n.bi_otc_cust_index
-- 229121 客户综合指标：以客户为底座，十三个独立问题并列匹配，不改原SQL计算口径。
-- 阅读路径见README；-- @include由本目录render.mjs展开，不是生产引擎语法。
-- 主连接有两种键：02–06按company_id（USCC）；07–13按company_name（公司全名）。
-- 这些LEFT JOIN保留底座客户；子查询不保证键唯一，因此匹配仍可能扩行。
-- @include 14_统一输出.sql

-- 一、客户与销售底座：公司名+USCC一行。
from (
    -- @include 01_客户与销售.sql
) t0

-- 二、胜率（USCC）：结束合约区间创收正值占比，不是客户投资收益率。
left join (
    -- @include 02_结束合约创收胜率.sql
) t1 on t0.company_id = t1.company_id

-- 期权起始样本的净收负值占比：欧式/气囊共用同USCC总分母。
left join (
    -- @include 03_期权净收胜率.sql
) t2 on t0.company_id = t2.company_id

-- 三、互换月换手（USCC）：本月新增+平仓，除上月末动态本金。
left join (
    -- @include 04_互换月换手.sql
) t3 on t0.company_id = t3.company_id

-- 四、履保（USCC）：NULL履保比例的本金仍参与权重。
left join (
    -- @include 05_履保比例.sql
) m1 on t0.company_id = m1.company_id

-- 追保线（USCC）：先排NULL追保线，再计算权重；分母不同于上一项。
left join (
    -- @include 06_追保线.sql
) m2 on t0.company_id = m2.company_id

-- 五、额度/规模/资料（公司全名）：有效管理人额度取MAX。
left join (
    -- @include 07_获批额度.sql
) lim on t0.company_name = lim.company_name

-- 履保动态本金：同时供14的规模与已用额度，两列同式。
left join (
    -- @include 08_履保规模.sql
) perf on t0.company_name = perf.company_name

-- 增信展示资料：履保方案关联对手方简称，并非担保措施条款。
left join (
    -- @include 09_增信资料.sql
) cm on t0.company_name = cm.company_name

-- 六、追保/垫资（公司全名）：及时天数和 / 全部递延天数和。
left join (
    -- @include 10_追保及时率.sql
) mc on t0.company_name = mc.company_name

-- 有垫资标签作为门槛，11.1统计量装入固定文字；模板不是外部证据。
left join (
    -- @include 11_垫资文字.sql
) adv on t0.company_name = adv.company_name

-- 七、互换费用（公司全名）：当日累计腿收益，按合约类型分平台费/券息。
left join (
    -- @include 12_平台费与券息.sql
) fee on t0.company_name = fee.company_name

-- 区间佣金：grp03或符合指定南下条件的grp02；不是所有普通互换。
left join (
    -- @include 13_互换佣金.sql
) com on t0.company_name = com.company_name

) castTable
