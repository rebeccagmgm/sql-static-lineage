-- 228008：公司名称＋USCC＋业务类型＋合约类型的一行报告日统计；新增、存量、收入各有自己的时间条件。
-- 来源金额保留源单位，本查询不除10000；real_pnl实际SUM(Curr_Rev)，不是另算客户投资盈亏。
-- 范围：报告日快照、grp_id 01/02/03、上一年年初至今，且期初定价日>=2025-04-01。
SELECT company_name,
    company_id,
    busi_type_1,
    busi_type_2,
    last_year_new_amount,
    this_year_new_amount,
    stock_size,
    cross_border_opt_amount,
    npv_revenue,
    real_pnl,
    profit_rate,
    busi_date FROM (
SELECT
    Cutp_Pty_Full_Name as company_name -- 合约创收日报：交易对手全称
    ,USCC as company_id -- 同表：统一社会信用代码
    ,case when Busi_Type = 'OPTION' then '期权'
        when Busi_Type = 'TRS' then '互换'
        else Busi_Type end as busi_type_1 -- 业务类型中文展示；没有限定只能出现这两类
    ,Contr_Type_Desc as busi_type_2 -- 合约类型描述，参与分组；不是标的名称

    -- 新增：只数计提日恰好等于期初定价日的记录，再取初始本金；不做合约去重。
    ,sum(case when Accrued_Date between '${yyyy,-1y}-01-01' and '${yyyy,-1y}-12-31' and Accrued_Date=Strt_Pric_Date
        then Init_Nom_Prin else 0 end) as last_year_new_amount
    ,sum(case when Accrued_Date between '${yyyy}-01-01' and '${yyyy-MM-dd}' and Accrued_Date=Strt_Pric_Date
        then Init_Nom_Prin else 0 end) as this_year_new_amount

    -- 存量：只取报告当天动态本金。跨境期权是其中OPTION且标的币种非CNY的部分，不能重复相加。
    ,sum(case when Accrued_Date = '${yyyy-MM-dd}'
        then Dyna_Nom_Prin else 0 end) as stock_size
    ,sum(case when Accrued_Date = '${yyyy-MM-dd}'
        and Busi_Type = 'OPTION' and Undrl_Curr != 'CNY'
        then Dyna_Nom_Prin else 0 end) as cross_border_opt_amount

    -- 两项年内金额分别读取NPV创收列与当日创收列；不能由展示名推断它们已经相加或相互包含。
    ,sum(case when Accrued_Date between '${yyyy}-01-01' and '${yyyy-MM-dd}'
        then Opt_Npv_Curr_Rev else 0 end) as npv_revenue -- 年内NPV创收
    ,sum(case when Accrued_Date between '${yyyy}-01-01' and '${yyyy-MM-dd}'
        then Curr_Rev else 0 end) as real_pnl -- 原DDL名“真实盈亏（按Delta拆借）”；实际口径为年内Curr_Rev合计

    -- 利润率：年内创收/报告日存量；不是年化收益率、期间平均本金回报或客户投资盈亏率。
    -- 分母>0才除；分母为0、负数或NULL都走ELSE 0。分母>0但分子NULL时不再补0。
    ,case when sum(case when Accrued_Date = '${yyyy-MM-dd}' then Dyna_Nom_Prin else 0 end) > 0
        then sum(case when Accrued_Date between '${yyyy}-01-01' and '${yyyy-MM-dd}' then Curr_Rev else 0 end)
            / sum(case when Accrued_Date = '${yyyy-MM-dd}' then Dyna_Nom_Prin else 0 end)
        else 0 end as profit_rate
    ,'${yyyy-MM-dd}' as busi_date -- 输出报告日；与01/03输出历史计提日不同
from DM_OTC_N.OTC_REV_DAILY_RPT -- 合约创收日报；客户、类型、日期、本金与两项创收均直接来自此表
where busi_date = '${yyyy-MM-dd}'
  and grp_id in ('01', '02', '03') -- 期权、普通互换、金仕达分支；不含04
  and Accrued_Date between '${yyyy,-1y}-01-01' and '${yyyy-MM-dd}'
  and Strt_Pric_Date >= '2025-04-01' -- 硬编码期初门槛，包含当天；原注释指新合约类型规则，制度依据另验
group by USCC, Cutp_Pty_Full_Name, Busi_Type, Contr_Type_Desc
) castTable
