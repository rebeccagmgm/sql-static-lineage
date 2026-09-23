-- 输入：当日追保设置快照 → 有效对手方关系 → 当日对公客户全名。
-- 输出：每公司全名一行最近季度/周频/平均递延/金额天数比 → 11模块拼固定文字。
-- 仅上一年元旦至报告日、递延>=2的记录；是统计材料，不是托管流水核验。
SELECT
    c.ORG_FULL_NAME_CH as company_name -- 公司中文全名，此处最终按名称关联
    ,case
        when substr(max(m.Perf_Marg_Date), 6, 2) in ('01','02','03')
             then concat(substr(max(m.Perf_Marg_Date), 1, 4), '年第一季度')
        when substr(max(m.Perf_Marg_Date), 6, 2) in ('04','05','06')
             then concat(substr(max(m.Perf_Marg_Date), 1, 4), '年第二季度')
        when substr(max(m.Perf_Marg_Date), 6, 2) in ('07','08','09')
             then concat(substr(max(m.Perf_Marg_Date), 1, 4), '年第三季度')
        when substr(max(m.Perf_Marg_Date), 6, 2) in ('10','11','12')
             then concat(substr(max(m.Perf_Marg_Date), 1, 4), '年第四季度')
     end as freq_quarter -- 最大履保日期所属季度，并非覆盖的全部季度
    ,count(distinct m.Perf_Marg_Date) * 7.0
        / (datediff('${yyyy-MM-dd}', '${yyyy,-1y}-01-01') + 1)
     as weekly_freq -- 不同履保日期数折算周频，不是追保记录条数
    ,avg(cast(m.Defr_Days as double)) as avg_duration -- 合格追保记录的平均递延天数
    ,sum(cast(m.Marg_Call_Amt as double))
     / nullif(sum(cast(m.Defr_Days as int)), 0) / 10000
     as daily_amt_wan -- 追保金额 / 递延天数 / 10000
-- 身份与输入来源（保持原连接后记录，不预先合并）：
from PDATA_N.T03_OTC_DERI_COMP_COMB_MARG_CALL_INFO m -- 组合追保信息：递延天数/追保金额
inner join pdata_n.T01_PTY_RELA_H h -- 当事人关系历史：内部对手方→OIS客户
    on m.Pty_Id = h.Pty_Id
    and h.SRC_TBL = 'ODATA_N_TIT.D_REF_CTPTY_MAPPING'
    and h.STRT_DATE <= '${yyyy-MM-dd}'
    and h.END_DATE > '${yyyy-MM-dd}'
inner join pdata_n.T01_CORP_CUST c -- 对公客户：取USCC/公司全名
    on h.Rela_Pty_Id = c.PTY_ID
    and c.BUSI_DATE = '${yyyy-MM-dd}'
    and c.SRC_TBL = 'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY'
where m.Busi_Date = '${yyyy-MM-dd}'
  and m.Perf_Marg_Date >= '${yyyy,-1y}-01-01'
  and m.Perf_Marg_Date <= '${yyyy-MM-dd}'
  and m.Src_Tbl = 'ODATA_N_TIT.G_MARGIN_CALL_SETTING'
  and cast(m.Defr_Days as int) >= 2
group by c.ORG_FULL_NAME_CH
