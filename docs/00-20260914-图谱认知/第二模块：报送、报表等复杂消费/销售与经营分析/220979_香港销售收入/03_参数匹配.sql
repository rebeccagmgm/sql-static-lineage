-- 位于01的FROM：七路参数是并列LEFT JOIN输入，供同层02公式和01展示列使用。
-- 未匹配保留主体，重复匹配可能扩行；后续窗口不自动去重。各输入在此原样承接，不另复制生产SQL。
-- 共用来源/与对内及交叉差异见公共加工04/05/06/08；本文件是220979实际匹配的维护位置。
-- 一、合约价差 s_sp：合约号＋计提日。非INR配置先与香港主信息连接，再按生效日LEAD和逐日展开。
-- 同一合约多条主信息会先影响窗口输入；不能把它当成118141原JOIN的机械复用。
left join (
    select
        Contract_Code,
        Spread_Calculation,
        Annualized_Spread,
        Absolute_Spread,
        date_add(strt_date, pos) as busi_date
    from (
        select
            Inr_Comp_No as Contract_Code,
            if(Sprd_Calc_Type = '', null, Sprd_Calc_Type) as Spread_Calculation,
            Annu_Sprd_Coef as Annualized_Spread,
            Absl_Sprd_Coef as Absolute_Spread,
            Vld_Date as strt_date,
            date_sub(lead(Vld_Date, 1, date_add('${yyyy-MM-dd}', 1)) over(partition by Inr_Comp_No order by Vld_Date), 1) as end_Date
        from (
            select * from PDATA_N.T99_DERI_COMP_SPRD_COEF_REF
            where src_tbl = 'ODATA_N_OIS.O_CONTRACT_SPREAD_RATE' and Del_Flag = '0'
                and coalesce(Coef_Type, '') != 'INR' and Agt_Id != ''
            ) a
        inner join (
            select * from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
            where busi_date = '${yyyy-MM-dd}' and coalesce(Early_Term_Date, End_Pric_Date) >= '2025-12-01'
                and book_name in ('OTCHK-互换-ISDA','OTCHK-互换-ISDA（费用）','OTCHK-返息费用','OTCHK-Option-北上跨境','OTCHK-Option-B2B','OTCHK-Option-ISDA')
            ) b
        on a.Inr_Comp_No = b.Agt_Id
        ) x
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
    ) s_sp
on s_sp.CONTRACT_CODE = info.Agt_Id and s_sp.busi_date = det.busi_date

-- 二、客户价差 c_sp：客户＋业务类型＋香港标的类型＋期初日，不是按每个计提日换客户系数。
-- 客户配置起点2023-01-01改2024-01-01，永久结束日改加工日；再展开含首尾日期。
left join (
    select
        client_id,
        business_type,
        underlying_type,
        Spread_Calculation,
        Annualized_Spread,
        Absolute_Spread,
        date_add(strt_date, pos) as busi_date
    from (
        select
            client_id as client_id,
            business_type,
            underlying_type,
            if(spread_calc_type = '', null, spread_calc_type) as Spread_Calculation,
            annualized_spread as Annualized_Spread,
            absolute_spread as Absolute_Spread,
            if(start_date = '2023-01-01','2024-01-01',start_date) as strt_date,
            if(end_date = '2999-12-31','${yyyy-MM-dd}',end_date) as end_Date
        from ODATA_N_OIS.G_REV_HKCPTY_BID_ASK_SPREAD_COEF
        where busi_date = '${yyyy-MM-dd}' and is_deleted = 'N'
        ) x
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
    ) c_sp
on c_sp.client_id = info.Cutp_Pty_Id and c_sp.business_type = info.Busi_Type
     and c_sp.underlying_type = info.HK_Undrl_Type and c_sp.busi_date = info.Strt_Pric_Date

-- 三、合约佣金 s_cr：合约号＋计提日。生效日至下一生效日前一天，末版延至加工日。
-- commis_calc_type被读入，但02收入不按它选择分支；费率不是自动按年除365。
left join (
    select
        contract_code,
        commis_calc_type,
        commission_rate,
        date_add(strt_date, pos) as busi_date
    from (
        select
            contract_code,
            commis_calc_type,
            commission_rate,
            effective_date as strt_date,
            date_sub(lead(effective_date, 1, date_add('${yyyy-MM-dd}', 1)) over(partition by contract_code order by effective_date), 1) as end_Date
        from odata_n_ois.g_rev_hk_contract_commission_rate
        where busi_date = '${yyyy-MM-dd}' and is_deleted = 'N'
        ) x
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
    ) s_cr
on s_cr.contract_code = info.Agt_Id and s_cr.busi_date = det.busi_date

-- 四、客户佣金 c_cr：客户＋业务类型＋香港标的类型＋期初日。
-- commission_rate逐字段合约优先；两路都无值时保持NULL，而不是没有交易就视为0。
left join (
    select
        client_id,
        business_type,
        underlying_type,
        commission_rate,
        commis_calc_type,
        date_add(strt_date, pos) as busi_date
    from (
        select
            client_id as client_id,
            business_type,
            underlying_type,
            commission_rate,
            commis_calc_type,
            if(start_date = '2023-01-01','2024-01-01',start_date) as strt_date,
            if(end_date = '2999-12-31','${yyyy-MM-dd}',end_date) as end_Date
        from odata_n_ois.g_rev_hkcpty_bid_ask_commission_rate
        where busi_date = '${yyyy-MM-dd}' and is_deleted = 'N'
        ) x
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
    ) c_cr
on c_cr.client_id = info.Cutp_Pty_Id and c_cr.business_type = info.Busi_Type
     and c_cr.underlying_type = info.HK_Undrl_Type and c_cr.busi_date = info.Strt_Pric_Date

-- 五、合约基准 s_ba：用T99原合约号Inr_Comp_No接Agt_Id；源标识、未删除、身份识别非空。
-- 不按日期区间挑版本；额外奖励在01展示，不进入02收入。
left join (
    select
        Inr_Comp_No as contract_code,
        Calc_Type as base_calculation,
        Base_Yield as base_award_rate,
        if(Adtnl_Rwd = '', 0, Adtnl_Rwd) as additional_reward,
        Adtnl_Rwd_Flag as have_additional_reward
    from PDATA_N.T99_DERI_COMP_BASE_COEF_REF
    where src_tbl = 'ODATA_N_OIS.O_CONTRACT_BASE_RATE' and Del_Flag = '0' and Agt_Id != ''
    ) s_ba
on s_ba.CONTRACT_CODE = info.Agt_Id

-- 六、香港类型基准 c_ba：直接读取OIS香港配置，业务类型＋香港标的类型，无期初日条件。
-- 不按HK_Contr_Type_Cd匹配，也不把独立存在的T99生产任务画成必经上游。
left join (
    select
        business_type,
        underlying_type,
        base_calculation,
        base_award_rate
    from ODATA_N_OIS.G_REV_HK_SALES_BASE_COEF
    where busi_date = '${yyyy-MM-dd}' and is_deleted = 'N'
    ) c_ba
on c_ba.business_type = info.Busi_Type and c_ba.underlying_type = info.HK_Undrl_Type

-- 七、香港资金成本 cc：香港合约分类＋香港标的分类＋期初日。
-- 子查询虽然读取business_type，实际ON没有使用它；按原文保留，不偷偷补键。
left join (
    select
        business_type,
        contract_type,
        underlying_type,
        capital_cost,
        date_add(strt_date, pos) as busi_date
    from (
        select
            business_type,
            contract_type,
            underlying_type,
            capital_cost,
            if(start_date = '2023-01-01','2024-01-01',start_date) as strt_date,
            if(end_date = '2999-12-31','${yyyy-MM-dd}',end_date) as end_Date
        from ODATA_N_OIS.G_REV_HK_CAPITAL_COST
        where busi_date = '${yyyy-MM-dd}' and is_deleted = 'N'
        ) x
    lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
    ) cc
on cc.contract_type = info.HK_Contr_Type_Cd and cc.underlying_type = info.HK_Undrl_Type and cc.busi_date = info.Strt_Pric_Date
