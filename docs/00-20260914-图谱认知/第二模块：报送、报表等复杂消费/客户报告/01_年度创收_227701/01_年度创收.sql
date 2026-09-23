-- 227701：一家公司上一年、本年分别贡献多少创收，另补该年度交叉销售奖励。
-- 两路并列输入：创收日报 → 公司/USCC/年汇总 t1；奖励汇总 → 公司名称/年汇总 t2。
-- t1 决定谁出现；按名称＋年度 LEFT JOIN t2；最后四项金额除以10000输出万元。
-- 本文件保留原查询所有非注释token与输出顺序；不含调度写入语句，不能独立当生产作业执行。

SELECT company_name,
    company_id,
    option_revenue,
    swap_revenue,
    cross_sale_amount,
    cross_border_revenue,
    busi_year FROM (
SELECT
    t1.company_name -- 公司名称：创收日报.Cutp_Pty_Full_Name
    ,t1.company_id -- 公司ID：创收日报.USCC（统一社会信用代码）
    ,t1.option_revenue / 10000 as option_revenue -- 期权业务创收（万元）
    ,t1.swap_revenue / 10000 as swap_revenue -- 互换业务创收（万元）
    ,coalesce(t2.cross_sale_amount, 0) / 10000 as cross_sale_amount -- 交叉销售奖励（万元）；缺失或汇总为NULL才补0
    ,t1.cross_border_revenue / 10000 as cross_border_revenue -- 标的币种非CNY的创收（万元），与前两项重叠
    ,t1.busi_year as busi_year -- 创收计提年度，同时是目标分区字段
from (
    -- 一、创收底座：读取报告日快照内的历史计提记录，而非只取报告当天的收入。
    -- 对每个USCC＋公司名称＋年度求和；不按合约去重，源重复会参与求和。
    SELECT
        USCC as company_id
        ,Cutp_Pty_Full_Name as company_name
        ,year(Accrued_Date) as busi_year -- 计提日期所在年，不用源分区busi_date取年
        ,sum(case when Busi_Type = 'OPTION' then Curr_Rev else 0 end) as option_revenue
        ,sum(case when Busi_Type = 'TRS' then Curr_Rev else 0 end) as swap_revenue
        ,sum(case when Undrl_Curr != 'CNY' then Curr_Rev else 0 end) as cross_border_revenue
        -- Curr_Rev=合约当日创收；不是动态本金、客户持仓盈亏或118141的分配收入。
        -- Undrl_Curr=标的币种；这里只做分类，不做汇率换算。NULL币种不会命中非CNY分支。
    from DM_OTC_N.OTC_REV_DAILY_RPT -- 合约创收日报；生产分支见共同基础入口
    where busi_date = '${yyyy-MM-dd}' -- 选择本次报告日快照
      and Accrued_Date between '${yyyy,-1y}-01-01' and '${yyyy-MM-dd}' -- 上一年1月1日至报告日，含两端
      and Busi_Type in ('OPTION', 'TRS') -- 限期权/互换；此查询未另加grp_id条件
    group by USCC, Cutp_Pty_Full_Name, year(Accrued_Date)
) t1
left join (
    -- 二、奖励底座：独立读取奖励，不从上面的Curr_Rev再次计算。
    -- Sett_Time是YYYY0Q核算季度码，如202603表示2026年三季度，不是2026年3月。
    SELECT
        Pty_Cutp_Name -- 当事人交易对手名称：203358从OIS.CORPORATE_NAME映射
        ,substr(Sett_Time, 1, 4) as busi_year
        ,sum(Dev_Dept_Rwd) as cross_sale_amount -- 拓展方部门所得收入：OIS.EXPANSION_DEPT_INCOME
    from pdata_n.T98_OTC_DERI_UNDRL_INCOME_RWD_SUM -- 衍生品交叉收入奖励汇总，以下只取OIS来源
    where busi_date = '${yyyy-MM-dd}'
      and src_tbl = 'ODATA_N_OIS.G_CROSS_INCOME_REWARD'
      and Sett_Time between '${yyyy,-1y}01' and concat('${yyyy}0', quarter('${yyyy-MM-dd}'))
      -- 上一年一季度至本年报告日所在季度；会纳入快照中已有的整个本季度码记录。
      -- 不比较核算结束日，更不证明本季度已经结算完或奖励已支付。
    group by Pty_Cutp_Name, substr(Sett_Time, 1, 4)
) t2 on t1.company_name = t2.Pty_Cutp_Name and t1.busi_year = t2.busi_year
-- 三、公司名称＋年度匹配，不按USCC或合同号匹配；只有奖励、没有创收底座的公司/年不会出现。
-- 同名两个USCC会各自拿到同一份年度奖励；NULL名称也不能通过普通等号互相匹配。
) castTable
