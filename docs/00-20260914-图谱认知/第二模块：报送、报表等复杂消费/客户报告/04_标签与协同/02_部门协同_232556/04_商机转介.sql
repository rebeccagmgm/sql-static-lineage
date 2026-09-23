-- 同一奖励来源和季度范围，排除股权衍生品业务部后，按公司名称汇总所有剩余部门。
-- 托管、研究、财富部门并未排除，所以与02/03奖励重叠；不是“其他部门”的互斥余项。
-- summary对部门名称COLLECT_SET去重再用中文分号拼接，未SORT_ARRAY，展示顺序无保证。
-- 部门为NULL时!=条件不成立；奖励金额NULL不会在此统一补0。外层按公司名称连接。
left join (
    SELECT
        t.Pty_Cutp_Name as company_name
        ,concat_ws('；', collect_set(t.Bel_Inr_Org_Name)) as summary
        ,sum(t.Dev_Dept_Rwd) as cross_sale_amount
    from pdata_n.T98_OTC_DERI_UNDRL_INCOME_RWD_SUM t
    where t.busi_date = '${yyyy-MM-dd}'
      and t.src_tbl = 'ODATA_N_OIS.G_CROSS_INCOME_REWARD'
      and t.Sett_Time between '${yyyy, -1y}01' and concat('${yyyy}0', quarter('${yyyy-MM-dd}'))
      and t.Bel_Inr_Org_Name != '股权衍生品业务部'
    group by t.Pty_Cutp_Name
) t_sjjz on t_base.company_name = t_sjjz.company_name
