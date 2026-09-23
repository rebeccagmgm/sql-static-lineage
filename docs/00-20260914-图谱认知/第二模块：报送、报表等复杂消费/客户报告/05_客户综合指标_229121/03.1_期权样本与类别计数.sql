-- 输入：创收快照的起始计提行 + 当日报告期权销售主信息（Agt_Id连接）。
-- 输出：每USCC+原始期权类别一行category/win_ratio → 03模块拼展示串。
-- 先连接筛样本，再按类别计数；窗口将类别COUNT相加作同USCC共同分母。
SELECT
    r.USCC
    ,case
        when r.Src_Contr_Type_Desc = '欧式香草' then '欧式期权'
        else '安全气囊'
     end as category
    ,sum(case when cast(s.net_coll as double) < 0 then 1 else 0 end)
     / sum(count(*)) over(partition by r.USCC) as win_ratio -- 该类别净收负行数 / 两类别全部匹配行数
-- 身份与输入来源（保持原连接后记录，不预先合并）：
from DM_OTC_N.OTC_REV_DAILY_RPT r -- 客户创收明细：报告日快照包含历史计提日
inner join pdata_n.T98_OTC_DERI_COMP_SALE_INFO s -- 销售合约主信息
    on r.Agt_Id = s.Agt_Id
    and s.busi_date = '${yyyy-MM-dd}'
    and s.grp_id = '01'
where r.busi_date = '${yyyy-MM-dd}'
  and r.Accrued_Date between '${yyyy,-1y}-01-01' and '${yyyy-MM-dd}'
  and r.Accrued_Date = r.Strt_Pric_Date
  and r.Src_Contr_Type_Desc in ('欧式香草', '安全气囊')
group by r.USCC, r.Src_Contr_Type_Desc
