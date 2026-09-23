-- 交叉收入奖励汇总表：只取OIS交叉收入奖励来源，报告日快照，上年Q1到本年报告季度。
-- 资产托管部映为托管，发展研究中心映为研究服务；按公司名称+部门汇总Dev_Dept_Rwd。
-- 名称+栏目连接到底座。研究服务“有关系”仅检查是否命中记录，不要求金额>0，也不是独立合同核验。
-- 没有记录则金额NULL；有记录但金额NULL也可能显示“有研究服务关系”，原公式不补0。
left join (
    SELECT
        Pty_Cutp_Name as company_name
        ,if(Bel_Inr_Org_Name='资产托管部', '托管', '研究服务') as coop_dept
        ,sum(Dev_Dept_Rwd) as cross_sale_amount
    from pdata_n.T98_OTC_DERI_UNDRL_INCOME_RWD_SUM
    where busi_date = '${yyyy-MM-dd}'
      and src_tbl = 'ODATA_N_OIS.G_CROSS_INCOME_REWARD'
      and Sett_Time between '${yyyy,-1y}01' and concat('${yyyy}0', quarter('${yyyy-MM-dd}'))
      and Bel_Inr_Org_Name in ('资产托管部', '发展研究中心')
    group by Pty_Cutp_Name, Bel_Inr_Org_Name
) t_tg_yjfw
  on t_base.company_name = t_tg_yjfw.company_name
  and d.coop_dept = t_tg_yjfw.coop_dept
