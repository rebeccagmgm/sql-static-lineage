-- 用途：给04提供四路并列资料；不是执行四次收入加工。
-- 映射mp决定类型基准b的匹配分类；价差sp和合约基准cb按合约身份进入。
-- 本文件只组织114013实际消费的查询，参数生产见公共加工/05_经营系数_基准/06_对内与香港基准.md。

-- INR_DEMO的例子：NORMAL＋CIR_STOCK匹配演示CD017；b在9/18取9/1生效段。
-- cb取系数2/收益率0.003，sp按每天取年化0.002；最终计算方式却由b年化优先。

-- 分类映射：一条配置中的标的代码串先展开，一行代表一个适用标的类别。
inr_type_mapping AS (
select
    otc_contract_type,
    otc_contract_type_name,
    t.Undrl_Type,
    Src_Contr_Type,
    Src_Sub_Contr_Type
from (
    select
        Op_Mng_Comp_Type_Id as otc_contract_type, -- 运管合约类型编号；供04选择最终经营分类
        Op_Mng_Comp_Type_Desc as otc_contract_type_name,
        -- 代码串为空表示八类均适用；ALL_STOCK/NON_STOCK先展开含义，再按逗号拆行。
        case when Src_Agt_Type_Cd = 'B_LONG_SHORT_SWAP' then ''
             when coalesce(Src_Undrl_Type_Cd_Str,'') = '' then 'PRI_STOCK,CIR_STOCK,INDEX,QIS,BOND,FUTURE,FUND,OTHER'
             else replace(replace(Src_Undrl_Type_Cd_Str,'ALL_STOCK','PRI_STOCK,CIR_STOCK'),'NON_STOCK','INDEX,QIS,BOND,FUTURE,FUND,OTHER')
             end as Undrl_Type,
        Src_Agt_Type_Cd as Src_Contr_Type,
        Src_Agt_Sub_Type_Cd as Src_Sub_Contr_Type
    -- 对内基础参数分类映射，生产来源G_INR_CONTRACT_MAPPING；当前日、未删除。
    from PDATA_N.T99_OTC_DERI_INR_BASE_MAPPING
    where src_tbl = 'ODATA_N_OIS.G_INR_CONTRACT_MAPPING' and busi_date = '${yyyy-MM-dd}' and Src_Deleted_Flag = '0'
    ) x
lateral view explode(split(Undrl_Type,',')) t as Undrl_Type
),

-- INR合约价差：Vld_Date至下一生效日前一日逐日展开，04按计提日匹配。
inr_spread_days AS (
select
    Contract_Code,
    Spread_Calculation,
    Annualized_Spread,
    Absolute_Spread,
    date_add(strt_date, pos) as busi_date
from (
    select
        Inr_Comp_No as Contract_Code, -- 元数据：内部合约编号；实际用于匹配日报主合约号
        if(Sprd_Calc_Type = '', null, Sprd_Calc_Type) as Spread_Calculation,
        Annu_Sprd_Coef as Annualized_Spread, -- 年化价差系数，不是已算好的收入
        Absl_Sprd_Coef as Absolute_Spread, -- 绝对价差系数，绝对分支仍乘本金和基础系数
        Vld_Date as strt_date, -- 生效日期；下一生效日前一天为本段右边界
        date_sub(lead(Vld_Date, 1, date_add('${yyyy-MM-dd}', 1)) over(partition by Inr_Comp_No order by Vld_Date), 1) as end_Date
    -- 合约价差系数参考信息：只取OIS合约价差来源、未删除且系数类型INR。
    -- Agt_Id非空只用于身份筛选，实际连接用Inr_Comp_No；本查询不按加工日再过滤T99。
    from PDATA_N.T99_DERI_COMP_SPRD_COEF_REF
    where SRC_TBL = 'ODATA_N_OIS.O_CONTRACT_SPREAD_RATE' and Del_Flag = '0' and coalesce(Coef_Type,'') = 'INR' and Agt_Id != ''
    ) x
lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
),

-- 类型基准：实际生效日至下一生效日前一日逐日展开，但04按期初定价日匹配。
inr_type_base_days AS (
select
    OTC_CONTRACT_TYPE,
    Dft_Base_Coef as Base_Coef, -- 拟定基础系数；公式里的乘数
    Base_Yield as Base_Rate, -- 基础收益率；与选中价差相加
    Adtnl_Yield as Spread_Rate, -- 附加收益率；合约价差缺值时回退到它
    base_calculation,
    date_add(strt_date, pos) as busi_date
from (
    select
        Op_Mng_Comp_Type_Id as OTC_CONTRACT_TYPE,
        Base_Yield,
        Dft_Base_Coef,
        Adtnl_Yield,
        Calc_Way as base_calculation, -- 计算方式；普通收入分支先取这一项
        Actl_Vld_Day as strt_date, -- 实际生效日；按运管类型编号分别延续
        date_sub(lead(Actl_Vld_Day, 1, date_add('${yyyy-MM-dd}', 1)) over(partition by Op_Mng_Comp_Type_Id order by Actl_Vld_Day), 1) as end_Date
    -- 对内基础参数表：来源G_INR_BASE_RATE，当前日且未删除；不是合约级参数。
    from PDATA_N.T99_OTC_DERI_INR_BASE_REF
    where src_tbl = 'ODATA_N_OIS.G_INR_BASE_RATE' and busi_date = '${yyyy-MM-dd}' and Src_Deleted_Flag = '0'
    ) x
lateral view posexplode(split(space(datediff(end_date, strt_date)), ' ')) y as pos, val
),

-- 合约基准：简单取原合约号、基础系数、基础收益率、计算类型；本查询没有日期选版。
inr_contract_base AS (
select
    Inr_Comp_No as CONTRACT_CODE,
    Dft_Base_Coef as Base_Coef,
    Base_Yield as Base_Rate,
    Calc_Type as base_calculation
-- 合约基础系数参考信息：这里来源G_INR_CONTRACT_BASE_RATE决定是对内配置。
-- 不另加Coef_Type或生效日条件，不能照抄价差筛选。
from PDATA_N.T99_DERI_COMP_BASE_COEF_REF
where SRC_TBL = 'ODATA_N_OIS.G_INR_CONTRACT_BASE_RATE' and Del_Flag = '0' and Agt_Id != ''
)

