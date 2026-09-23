-- 用途：把合约、合约日金额、客户范围和参数接起来，算尚未分配的当日收入。
-- 输入info来自01；mp/sp/b/cb来自02；npv来自03。dy由107491提供，cp仅限定客户范围。
-- 输出contract_day_income，05直接接为t；LEFT JOIN多条命中可能扩行，本层不去重。
-- 本段会覆盖日报Contr_Type_Cd，源类型Src_Contr_Type仍保留用于特殊公式判断。
select
    info.Agt_Id, -- 主信息合约编号；dy、cb、npv及外层经办关系均用它连接
    info.Busi_Type,
    info.Cutp_Pty_Id,
    info.Cutp_Pty_Shor_Name,
    info.Cutp_Pty_Full_Name,
    info.Sign_Prd_Name,
    -- 日报分类：本任务01的显式分类 → mp运管分类 → CD017/其他；代码、描述独立回退。
    coalesce(info.Inr_Contr_Type_Cd, mp.otc_contract_type, 'CD017') as Contr_Type_Cd,
    coalesce(info.Inr_Contr_Type_Desc, mp.otc_contract_type_name, '其他') as Contr_Type_Desc,
    info.Src_Contr_Type,
    info.Src_Contr_Type_Desc,
    info.Src_Sub_Contr_Type,
    info.Src_Sub_Contr_Type_Desc,
    info.Rel_Agt_Id,
    info.Undrl_Wd_Cd,
    info.Undrl_Name,
    -- 此特殊类型匹配参数时用空标的类别，输出才把EQUITY文字替成CIR_STOCK。
    if(info.Src_Contr_Type = 'B_LONG_SHORT_SWAP', replace(info.src_undrl_type,'EQUITY','CIR_STOCK'), info.Undrl_Type_n) as Undrl_Type,
    if(info.Src_Contr_Type = 'B_LONG_SHORT_SWAP', replace(info.src_undrl_type_desc,'股票','流通股'), info.Undrl_Type_Desc_n) as Undrl_Type_Desc,
    info.Src_Undrl_Type,
    info.Src_Undrl_Type_Desc,
    info.Indt_Cd,
    info.Hedg_Type_Cd,
    -- 展示字段：主信息实际费率 → 日报成交费率，仅四类特殊期权展示。
    if(info.Src_Contr_Type in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL'), info.fee_rate, null) as fee_rate,
    -- Fin_Rati（融资比例）是展示值：保证金dy当日→info初始→0，大于1封顶。
    if(info.Src_Contr_Type in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL','B_LONG_SHORT_SWAP'),
        1 - if(cast(coalesce(dy.Marg_Prop, info.Init_Marg_Prop,0) as double) > 1,
            1, coalesce(dy.Marg_Prop, info.Init_Marg_Prop,0)), null) as Fin_Rati,
    -- 报表展示不补0；公式会另补0。cb.Base_Coef源字段为“拟定基础系数”。
    coalesce(cb.Base_Coef,b.Base_Coef) as Base_Coef,
    coalesce(cb.Base_Rate,b.Base_Rate) as Base_Rate,
    -- 展示价差由sp自己的计算类型挑选；普通收入由b优先的计算类型挑选，可能不一致。
    coalesce(if(sp.Spread_Calculation = 'ABSOLUTE', sp.Absolute_Spread, sp.Annualized_Spread), b.Spread_Rate) as Sprd_Rate,
    info.Strt_Pric_Date,
    info.End_Pric_Date_n as End_Pric_Date,
    info.Term_Days as Actl_Days, -- 源“期限天数”直接显示为“实际天数”，不是本查询重算天数
    IF(info.Early_Term_Date IS NULL OR info.Early_Term_Date = '', '0', '1') AS Is_Preterm_Flag,
    info.Early_Term_Date,
    info.Agt_Stat_Cd,
    dy.Init_Nom_Prin, -- 初始本金取107491附加明细，非直接取本次主信息
    dy.Dyna_Nom_Prin,
    -- 收入优先级独立于分类CASE：先B2B，再两组特殊类型，最后普通绝对/年化。
    case
        -- A. B2B期权：只在期初日（或旧合约2023-01-01）记一次合并估值。
        when info.Busi_Type = 'OPTION' and info.hedg_type_cd = 'B2B' then
            if((info.Strt_Pric_Date < '2023-01-01' and dy.busi_date = '2023-01-01')
                or info.Strt_Pric_Date = dy.busi_date,
                npv.initial_npv, 0)

        -- B. 四类特殊期权：用info初始保证金比例，不取上面展示的Fin_Rati。
        -- 初始比例NULL或恰为1 → 此乘数为1；大于1没有封顶，可能得到负收入。
        -- info.fee_rate虽展示在日报，但这里没有参加收入乘法。
        when info.Src_Contr_Type in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then
            coalesce(dy.Dyna_Nom_Prin, 0)
            * (1 - if(coalesce(info.Init_Marg_Prop,1) = 1, 0, info.Init_Marg_Prop))
            * coalesce(cb.Base_Coef,b.Base_Coef,0)
            * (coalesce(cb.Base_Rate,b.Base_Rate,0)
                + coalesce(sp.Annualized_Spread, b.Spread_Rate,0)) / 365

        -- C. B_LONG_SHORT_SWAP：用dy当日保证金比例；缺失回0，大于1封顶为1。
        -- 本公式不回退info.Init_Marg_Prop，和上面展示Fin_Rati的取法不同。
        when info.Src_Contr_Type in ('B_LONG_SHORT_SWAP') then
            coalesce(dy.Dyna_Nom_Prin, 0)
            * (1 - if(cast(coalesce(dy.Marg_Prop,0) as double) > 1,
                1, coalesce(dy.Marg_Prop,0)))
            * coalesce(cb.Base_Coef,b.Base_Coef,0)
            * (coalesce(cb.Base_Rate,b.Base_Rate,0)
                + coalesce(sp.Annualized_Spread, b.Spread_Rate,0)) / 365

        -- D. 普通绝对：计算方式优先b类型参数；系数、收益率却优先cb合约参数。
        -- ABSOLUTE仍是“初始本金×系数×收益率”，不是直接取一个绝对金额。
        when coalesce(b.base_calculation, cb.base_calculation,
            sp.Spread_Calculation, 'ABSOLUTE') = 'ABSOLUTE' then
            if((info.Strt_Pric_Date < '2023-01-01' and dy.busi_date = '2023-01-01')
                or info.Strt_Pric_Date = dy.busi_date,
                coalesce(dy.Init_Nom_Prin, 0)
                * coalesce(cb.Base_Coef,b.Base_Coef,0)
                * (coalesce(cb.Base_Rate,b.Base_Rate,0)
                    + coalesce(sp.Absolute_Spread, b.Spread_Rate,0)), 0)

        -- E. 普通年化：用107491给出的逐日本金，不再加期初/期末日期IF。
        -- 类型计算方式为空串时不会触发COALESCE回退；非两种已知值时CASE结果NULL。
        when coalesce(b.base_calculation, cb.base_calculation,
            sp.Spread_Calculation, 'ABSOLUTE') = 'ANNUALIZED' then
            coalesce(dy.Dyna_Nom_Prin, 0)
            * coalesce(cb.Base_Coef,b.Base_Coef,0)
            * (coalesce(cb.Base_Rate,b.Base_Rate,0)
                + coalesce(sp.Annualized_Spread, b.Spread_Rate,0)) / 365
    end as Sales_Income,
    dy.busi_date as Accrued_Date, -- 附加明细业务日转为日报计提日期
    info.Intr_Marg,
    if(info.Ex_Rate_Model in ('SHENZHEN_HONGKONG_STOCK_CONNECT','SHANGHAI_HONGKONG_STOCK_CONNECT'),info.Ex_Rate_Model,null) as Ex_Rate_Model,
    '${yyyy-MM-dd}' as busi_date
from contract_info info
-- 107491销售收入附加明细：本金来自每个合约日；只按合约号接，不再限定grp_id。
inner join (
    select * from PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET
    where busi_date >= '2023-01-01'
    ) dy
on info.agt_id = dy.agt_id
-- OTC衍生品客户：删除标志0且监控标志1，或两个指定客户例外；限定加工日来源。
-- INNER JOIN无DISTINCT：无客户命中则丢行，多条客户记录也可扩行。
inner join (
    select Pty_Id
    from PDATA_N.T01_OTC_DERI_CUST
    where Src_Tbl in ('ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY') and busi_date = '${yyyy-MM-dd}'
        and ((Del_Flag = '0' and Montr_Flag = '1') or Pty_Id in ('DEV1100100652','DEV1100101701'))
    ) cp
on info.Cutp_Pty_Id = cp.Pty_Id
-- B2B辅助估值按主合约号匹配；其他收入分支不使用npv。
left join b2b_initial_value npv
on npv.Agt_Id = info.Agt_Id
-- 映射用标的类别＋源类型＋源子类型；映射子类型NULL表示可回退主体值，空串不同。
-- 即使info已有显式经营分类仍然连接mp，CASE优先取info不能消除mp多匹配扩行。
left join inr_type_mapping mp
on coalesce(mp.Undrl_Type,'') = coalesce(info.Undrl_Type_n,'')
    and mp.Src_Contr_Type = info.Src_Contr_Type
    and coalesce(mp.Src_Sub_Contr_Type,info.Src_Sub_Contr_Type,'') = coalesce(info.Src_Sub_Contr_Type,'')
-- sp：原合约号＋计提日，价差可在同一合约存续中切换。
left join inr_spread_days sp
on sp.CONTRACT_CODE = dy.Agt_Id and sp.busi_date = dy.busi_date
-- b：最终经营分类＋期初日；配置在后来更新不自动让老合约改用新生效段。
left join inr_type_base_days b
on b.OTC_CONTRACT_TYPE = coalesce(info.Inr_Contr_Type_Cd, mp.otc_contract_type, 'CD017') and b.busi_date = info.Strt_Pric_Date
-- cb：原合约号，无日期或最新一条选择；缺参保留行，多参数行会扩行。
left join inr_contract_base cb
on cb.CONTRACT_CODE = info.agt_id
