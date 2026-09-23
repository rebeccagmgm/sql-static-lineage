/*
02 / 合约用哪条成本参数？按“合约类型 + 期初定价日”选，不按每个计提日切换。

T99参数（src_tbl指定OIS来源、未删除、源部门OTC）
  → 起息起止日形成逐日适用区间（正常区间包含两端）
  → 合约类型 = info.Contr_Type_Cd
  → 区间内日期 = info.Strt_Pric_Date（合约期初定价日）
  → cc.capital_cost（资金成本率参数）

别名：info=合约主信息T98；det=逐日本金费用T98；cc=本段成本参数。
这里的cc.busi_date是区间展开日期，不是源配置快照日期。
不按T99.Busi_Type、标的类型或Vld_Date匹配；不做LEAD版本选择，不取最新一条。
没有默认0：LEFT JOIN未匹配时cc.capital_cost为NULL。
本段是118141的JOIN片段，需要放回原主查询；不是独立可执行SQL。
*/

left join (
    select
        CONTRACT_TYPE, -- 源合约类型
        CAPITAL_COST, -- T99.Fnd_Cost原值
        date_add(strt_date, pos) as busi_date -- 区间内逐日日期
    from (
        select
            Src_Comp_Type_Cd as CONTRACT_TYPE,
            Fnd_Cost as CAPITAL_COST,
            if(Intr_Strt_Date = '1900-01-01','2019-01-01',Intr_Strt_Date) as strt_date,
            if(Intr_End_Date = '2999-12-31','${yyyy-MM-dd}',Intr_End_Date) as end_Date
        from PDATA_N.T99_DERI_COMP_TYPE_FND_COST_REF -- 衍生品合约类型资金成本参考信息
        where src_tbl = 'ODATA_N_OIS.G_BUS_TYPE_CAPITAL_COST'
            and Del_Flag = '0'
            and Src_Dept_No = 'OTC'
    ) x
    -- 将正常起止区间展开：pos从0开始，每一行对应一天；不是求平均。
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
) cc
on cc.CONTRACT_TYPE = info.Contr_Type_Cd
    and cc.busi_date = info.Strt_Pric_Date
