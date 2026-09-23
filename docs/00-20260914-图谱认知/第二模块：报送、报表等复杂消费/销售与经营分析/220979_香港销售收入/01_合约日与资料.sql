-- 输入：公共合约主信息、107491逐日金额、香港客户准入、105743管理归属，及03/04并列输入。
-- 输出：每条匹配后的合约计提日及原始收入，作为 contract_day_income 交给05；未验证合约日唯一。
-- 02位于本SELECT，使用info/det/s_sp/c_sp/s_ba/c_ba/s_cr/c_cr/di/mid/evt/cc；引用都来自下方真实JOIN。
select
    info.Agt_Id,
    info.Busi_Type,
    info.Cutp_Pty_Id,
    info.Cutp_Pty_Shor_Name,
    info.Cutp_Pty_Full_Name,
    info.Sign_Prd_Name,
    info.HK_Contr_Type_Cd as Contr_Type_Cd,
    info.HK_Contr_Type_Desc as Contr_Type_Desc,
    info.Src_Contr_Type,
    info.Src_Contr_Type_Desc,
    info.Src_Sub_Contr_Type,
    info.Src_Sub_Contr_Type_Desc,
    info.Undrl_Wd_Cd,
    info.Undrl_Name,
    info.HK_Undrl_Type as Undrl_Type,
    info.Src_Undrl_Type,
    -- 展示列只判断两侧参数类型，不使用收入 CASE 的 ANNUALIZED 缺省值；展示空串不一定表示没有收入。
    IF(coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation) = 'ANNUALIZED', coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread), '') AS Annu_Sprd,
    IF(coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation) = 'ABSOLUTE', coalesce(s_sp.Absolute_Spread, c_sp.Absolute_Spread), '') AS Absl_Sprd,
    IF(coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ANNUALIZED', coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE), '') AS Annu_Base,
    IF(coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ABSOLUTE', coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE), '') AS Absl_Base,
    coalesce(s_cr.commission_rate,c_cr.commission_rate) as Cms_Fee_Rate,
    -- 初始本金来自主信息；动态本金来自 det（107491）。展示补 0，收入 CASE 仍用原 det.Dyna_Nom_Prin。
    info.Init_Nom_Prin,
    coalesce(det.Dyna_Nom_Prin, 0) as Dyna_Nom_Prin,
    sum(if(
        det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date),
        coalesce(det.Dyna_Nom_Prin, 0), 0
    )) over(partition by info.agt_id order by det.busi_date) as Accum_Dyna_Nom_Prin,
    if(info.grp_id = '01', det.Dyna_Nom_Prin, 0) as Absl_Nom_Prin,
    -- 原文“累计绝对本金”实际重复动态本金累计式，非对上一列Absl_Nom_Prin求和；按原文保留。
    sum(if(
        det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date),
        coalesce(det.Dyna_Nom_Prin, 0), 0
    )) over(partition by info.agt_id order by det.busi_date) as Accum_Absl_Nom_Prin,
-- @include 02_原始当日收入.sql
    info.Strt_Pric_Date,
    -- 这里已把结束日改成提前终止日优先；05 的保底读的是这个值。空串非 NULL，不自动回退。
    coalesce(info.Early_Term_Date, info.End_Pric_Date) as End_Pric_Date,
    info.Early_Term_Date,
    info.Earn_Pymt_Date,
    info.Agt_Stat_Cd,
    -- m 的角色和三组比例来自销售管理归属；本金 40/60 与收入三组比例在 06 分别使用。
    m.Main_Oper_User_Id,
    if(m.Main_Oper_User_Id = 'ruonanlyu', '吕若楠', m.Main_Oper_Name) as Main_Oper_Name,
    m.Main_Oper_Emp_Id,
    m.Intro_Oper_User_Id,
    if(m.Intro_Oper_User_Id= 'ruonanlyu', '吕若楠', m.Intro_Oper_Name) as Intro_Oper_Name,
    m.Intro_Oper_Emp_Id,
    m.Inr_Org_Id_1 as Intro_Inr_Org_Id_1,
    m.Inr_Org_Name_1 as Intro_Inr_Org_Name_1,
    m.Div_Org_Id_1,
    m.Div_Org_Name_1,
    m.Cust_Mngr_User_Id_1,
    m.Cust_Mngr_Name_1,
    m.Cust_Mngr_Emp_Id_1,
    m.Allo_Prop_1,
    m.Inr_Org_Id_2 as Intro_Inr_Org_Id_2,
    m.Inr_Org_Name_2 as Intro_Inr_Org_Name_2,
    m.Div_Org_Id_2,
    m.Div_Org_Name_2,
    m.Cust_Mngr_User_Id_2,
    m.Cust_Mngr_Name_2,
    m.Cust_Mngr_Emp_Id_2,
    m.Allo_Prop_2,
    m.Inr_Org_Id_3 as Intro_Inr_Org_Id_3,
    m.Inr_Org_Name_3 as Intro_Inr_Org_Name_3,
    m.Div_Org_Id_3,
    m.Div_Org_Name_3,
    m.Cust_Mngr_User_Id_3,
    m.Cust_Mngr_Name_3,
    m.Cust_Mngr_Emp_Id_3,
    m.Allo_Prop_3,
    det.busi_date as Accrued_Date,
    -- 合约基准中的额外奖励只输出展示；02、05 都没有把它加到收入上。
    coalesce(s_ba.additional_reward,0) as Adtnl_Rwd,
    det.fee_rate,
    1 - info.Init_Marg_Prop as Fin_Rati,
    info.Intr_Marg,
    info.Res_Flag,
    info.Opt_Fee_Rate
from (
    -- 公共主信息继续作为底表，但香港合约分类、标的分类在此重新计算，用于参数和保底。
    -- 期权 CASE 顺序不可交换；例如 QIS 特定客户、RISKY/AIRBAGX 不是一个统一“其他”条件。
    select *,
        if(busi_type = 'OPTION',
            case when Src_Undrl_Type = 'EQUITY'
                       and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL','CUSTOMISED')
                       and not(Src_Contr_Type = 'AUTOCALL' and Src_Sub_Contr_Type = 'SNOWBALL')
                       then 'OPTION_STOCK'
                 when Src_Undrl_Type in ('INDEX', 'FUND')
                       and(Src_Contr_Type in ('ACCUMULATOR','DECCUMULATOR','AIRBAG') or (Src_Contr_Type = 'AUTOCALL' and Src_Sub_Contr_Type != 'SNOWBALL'))
                       then 'OPTION_IDX_ETF'
                 when Cntr = 'OTCHK_QIS' and Src_Undrl_Type = 'QIS' and Sler_Cutp_Pty_Id = 'TIT060-11613' then 'OPTION_N_CROSS_QTF_STRG_IDX'
                 when Src_Contr_Type in ('RISKY','AIRBAGX') and Src_Undrl_Type = 'EQUITY' and Res_Flag = '1' then 'OPTION_RISKY_AIRBAGX_PRI_STOCK'
                 when Src_Contr_Type in ('RISKY','AIRBAGX') and Res_Flag = '0' then 'OPTION_RISKY_AIRBAGX_CIR_STOCK'
                 else 'OPTION_OTHER_NONSTOCK' end,
            case when Src_Contr_Type in ('N_CROSS_SWAP','LEND_SWAP','INDEX_ENHANCE_SWAP','FEE_SWAP','CROSS_LEND_SWAP',
                     'HK_LONG_HOLD_SWAP','N_CROSS_QFII_SWAP','LONG_SHORT_SWAP','N_CROSS_FUTURE_SWAP','N_CROSS_DMA_SWAP')
                     then Src_Contr_Type
                 else 'TRS_OTHER_SWAP' end) as HK_Contr_Type_Cd,
        if(busi_type = 'OPTION',
            case when Src_Undrl_Type = 'EQUITY'
                       and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL','CUSTOMISED')
                       and not(Src_Contr_Type = 'AUTOCALL' and Src_Sub_Contr_Type = 'SNOWBALL')
                       then '个股期权'
                 when Src_Undrl_Type in ('INDEX', 'FUND')
                       and(Src_Contr_Type in ('ACCUMULATOR','DECCUMULATOR','AIRBAG') or (Src_Contr_Type = 'AUTOCALL' and Src_Sub_Contr_Type != 'SNOWBALL'))
                       then '指数/ETF期权'
                 when Cntr = 'OTCHK_QIS' and Src_Undrl_Type = 'QIS' and Sler_Cutp_Pty_Id = 'TIT060-11613' then '北上量化策略指数期权'
                 when Src_Contr_Type in ('RISKY','AIRBAGX') and Src_Undrl_Type = 'EQUITY' and Res_Flag = '1' then 'Risky和安全气囊X（限售股）'
                 when Src_Contr_Type in ('RISKY','AIRBAGX') and Res_Flag = '0' then 'Risky和安全气囊X（流通股）'
                 else '其他期权' end,
            case when Src_Contr_Type in ('LEND_SWAP','FEE_SWAP','CROSS_LEND_SWAP',
                     'HK_LONG_HOLD_SWAP','N_CROSS_QFII_SWAP','LONG_SHORT_SWAP','N_CROSS_FUTURE_SWAP','N_CROSS_DMA_SWAP')
                     then Src_Contr_Type_Desc
                 when Src_Contr_Type = 'N_CROSS_SWAP' then '北上A股'
                 when Src_Contr_Type = 'INDEX_ENHANCE_SWAP' then '北上指数增强'
                 else '其他互换类型' end) as HK_Contr_Type_Desc,
        case when Futr_Type in ('COMMODITY_FUTURE','EQUITY_INDEX_FUTURE') then Futr_Type
             when Src_Undrl_Type in ('EQUITY','INDEX','FUND') then Src_Undrl_Type
             else 'OTHER' end as HK_Undrl_Type
    -- 当日销售合约主信息：先限定结束边界与六类香港账簿，不等同于只看部门代码。
    from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
    where busi_date = '${yyyy-MM-dd}' and coalesce(Early_Term_Date, End_Pric_Date) >= '2025-12-01'
        and book_name in ('OTCHK-互换-ISDA','OTCHK-互换-ISDA（费用）','OTCHK-返息费用','OTCHK-Option-北上跨境','OTCHK-Option-B2B','OTCHK-Option-ISDA')
    ) info
-- det 的 busi_date 是计提日；保留 2024-01-01 起的记录，只按合约号连接，不另限结束日。
inner join (
    select * from PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET
    where busi_date >= '2024-01-01'
    ) det
on info.agt_id = det.agt_id
-- 客户是 INNER JOIN 准入：香港客户源、未删除、允许纳入交叉收入；不是可缺省的展示资料。
inner join (
    select Pty_Id
    from PDATA_N.T01_OTC_DERI_CUST
    where Src_Tbl = 'ODATA_N_OIS.G_HK_COUNTERPARTY' and busi_date = '${yyyy-MM-dd}'
        and Del_Flag = '0' and Incl_Cs_Income_Flag = '1'
    ) cp
on info.Cutp_Pty_Id = cp.Pty_Id
-- @include 04_返息基数与交易事件.sql
-- @include 03_参数匹配.sql
-- 管理归属按加工日读取；LEFT JOIN 后的 WHERE 要求三组中至少一组机构非 8846。
-- 空串/NULL 机构在这里都按 8846 处理；没有交叉日报的额外合约号例外。
left join (
    select * from PDATA_N.T98_OTC_COMP_MNG_RELA_INFO
    where busi_Date = '${yyyy-MM-dd}'
    ) m
on m.Agt_Id = info.Agt_Id
where coalesce(if(m.Inr_Org_Id_1 = '', '8846', m.Inr_Org_Id_1), '8846') != '8846'
    or coalesce(if(m.Inr_Org_Id_2 = '', '8846', m.Inr_Org_Id_2), '8846') != '8846'
    or coalesce(if(m.Inr_Org_Id_3 = '', '8846', m.Inr_Org_Id_3), '8846') != '8846'
