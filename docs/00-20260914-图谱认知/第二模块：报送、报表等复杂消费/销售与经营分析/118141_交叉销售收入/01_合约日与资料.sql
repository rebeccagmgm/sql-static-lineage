-- 输入：合约快照info、逐日金额det、五路参数、管理关系m。
-- 一行意图是合约的一个计提日；连接右侧多条记录时会扩行，不能承诺键唯一。
-- 输出：原始收入Curr_Prvs_Sales_Income及资料，供主脚本第二阶段T直接使用。
-- 参数并列补入同一层，不是先算价差再把收入拿去算基准。

select
    -- 合约身份、客户及标的展示：来自合约主信息info，不在此重建交易身份。
    info.Agt_Id, -- 合约编号：本层主体身份
    info.Busi_Type, -- 业务类型：期权OPTION／互换TRS
    info.Cutp_Pty_Id, -- 客户编号：客户类型级价差的匹配键之一
    info.Cutp_Pty_Shor_Name,
    info.Cutp_Pty_Full_Name,
    info.Sign_Prd_Name,
    info.Contr_Type_Cd, -- 经营分类后的合约类型：选类型参数、判断期权保底
    info.Contr_Type_Desc,
    info.Src_Contr_Type, -- 源合约类型：先判断AIRBAG等特殊收入分支
    info.Src_Contr_Type_Desc,
    info.Src_Sub_Contr_Type,
    info.Src_Sub_Contr_Type_Desc,
    '' as Undrl_Ins_Id,
    info.Undrl_Wd_Cd,
    info.Undrl_Name,
    info.Undrl_Type,
    info.Src_Undrl_Type,
    -- 选出的价差/基准展示值：计算类型与数值各自回退，空串不等于NULL。
    IF(
        coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation) = 'ANNUALIZED',
        coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread), ''
    ) AS Annu_Sprd, -- 年化价差：展示系数，不是收入金额
    IF(
        coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation) = 'ABSOLUTE',
        coalesce(s_sp.Absolute_Spread, c_sp.Absolute_Spread), ''
    ) AS Absl_Sprd, -- 绝对价差系数
    IF(
        coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ANNUALIZED',
        coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE), ''
    ) AS Annu_Base, -- 年化基准系数
    IF(
        coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) = 'ABSOLUTE',
        coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE), ''
    ) AS Absl_Base, -- 绝对基准系数
    -- 金额来自107491明细det；初始本金来自合约主信息info。
    info.Init_Nom_Prin, -- 初始名义本金：绝对方式收入、保底门槛使用
    coalesce(det.Dyna_Nom_Prin, 0) as Dyna_Nom_Prin, -- 展示本金补0；02公式仍直接使用det原值
    sum(if(
        det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date),
        coalesce(det.Dyna_Nom_Prin, 0), 0
    )) OVER (
        PARTITION BY info.agt_id, info.Contr_Type_Cd ORDER BY det.busi_date
    ) as Accum_Dyna_Nom_Prin, -- 逐日有效动态本金之和；这里未除天数，不是日均
    if(info.grp_id = '01', det.Dyna_Nom_Prin, 0) as Absl_Nom_Prin, -- 本任务仅期权取动态本金，其他分组为0
    sum(if(
        det.busi_date BETWEEN info.Strt_Pric_Date AND coalesce(info.Early_Term_Date, info.End_Pric_Date),
        coalesce(det.Dyna_Nom_Prin, 0), 0
    )) OVER (
        PARTITION BY info.agt_id, info.Contr_Type_Cd ORDER BY det.busi_date
    ) as Accum_Absl_Nom_Prin, -- 原式仍累加动态本金，不是上一列Absl_Nom_Prin的求和
-- @include 02_原始当日收入.sql
    -- 此处End_Pric_Date已改成“提前终止日优先”；04的结束日保底使用这个结果。
    -- COALESCE只回退NULL，提前终止日为空串时不会使用原期末日。
    info.Strt_Pric_Date,
    coalesce(info.Early_Term_Date, info.End_Pric_Date) as End_Pric_Date,
    info.Strt_Pric_Date as Accrued_Strt_Date,
    coalesce(info.Early_Term_Date, info.End_Pric_Date) as Accrued_End_Date,
    info.Early_Term_Date,
    info.Earn_Pymt_Date,
    info.Agt_Stat_Cd,
    -- 归属资料来自105743的管理关系m：经办角色与三组介绍人分开保留。
    m.Main_Oper_User_Id,
    m.Main_Oper_Name,
    m.Main_Oper_Emp_Id,
    m.Intro_Oper_User_Id,
    m.Intro_Oper_Name,
    m.Intro_Oper_Emp_Id,
    m.Inr_Org_Id_1 as Intro_Inr_Org_Id_1,
    m.Inr_Org_Name_1 as Intro_Inr_Org_Name_1,
    m.Div_Org_Id_1,
    m.Div_Org_Name_1,
    m.Cust_Mngr_User_Id_1,
    m.Cust_Mngr_Name_1,
    m.Cust_Mngr_Emp_Id_1,
    m.Allo_Prop_1, -- 第1组介绍关系收入分配比例；06直接相乘
    m.Inr_Org_Id_2 as Intro_Inr_Org_Id_2,
    m.Inr_Org_Name_2 as Intro_Inr_Org_Name_2,
    m.Div_Org_Id_2,
    m.Div_Org_Name_2,
    m.Cust_Mngr_User_Id_2,
    m.Cust_Mngr_Name_2,
    m.Cust_Mngr_Emp_Id_2,
    m.Allo_Prop_2, -- 第2组介绍关系收入分配比例
    m.Inr_Org_Id_3 as Intro_Inr_Org_Id_3,
    m.Inr_Org_Name_3 as Intro_Inr_Org_Name_3,
    m.Div_Org_Id_3,
    m.Div_Org_Name_3,
    m.Cust_Mngr_User_Id_3,
    m.Cust_Mngr_Name_3,
    m.Cust_Mngr_Emp_Id_3,
    m.Allo_Prop_3, -- 第3组介绍关系收入分配比例
    -- 计提日=明细所属日；不是本次加工日，后续窗口按它排序。
    det.busi_date as Accrued_Date,
    coalesce(Additional_Reward,0) as Adtnl_Rwd, -- 03合约基准s_ba带出的额外奖励；单独展示，不加进收入公式
    det.fee_rate,
    1 - info.Init_Marg_Prop as Fin_Rati,
    info.Intr_Marg,
    info.Res_Flag,
    info.Opt_Fee_Rate,
    if(info.Ex_Rate_Model in ('SHENZHEN_HONGKONG_STOCK_CONNECT','SHANGHAI_HONGKONG_STOCK_CONNECT'),info.Ex_Rate_Model,null) as Ex_Rate_Model,
    if(nvl(m.Cust_Mngr_Emp_Stat_Desc_1, '') = '', m.Cust_Mngr_Emp_Stat_Desc_1, if(m.Cust_Mngr_Emp_Stat_Desc_1 = '在职', '是', '否')) as Cust_Mngr_Is_Actv_1,  -- 客户经理是否在职_1
    if(nvl(m.Cust_Mngr_Emp_Stat_Desc_2, '') = '', m.Cust_Mngr_Emp_Stat_Desc_2, if(m.Cust_Mngr_Emp_Stat_Desc_2 = '在职', '是', '否')) as Cust_Mngr_Is_Actv_2,  -- 客户经理是否在职_2
    if(nvl(m.Cust_Mngr_Emp_Stat_Desc_3, '') = '', m.Cust_Mngr_Emp_Stat_Desc_3, if(m.Cust_Mngr_Emp_Stat_Desc_3 = '在职', '是', '否')) as Cust_Mngr_Is_Actv_3   -- 客户经理是否在职_3
-- 主体范围：本次加工日的合约快照，先排除费用互换、FAST分组和香港部门。
from (
    select * from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO -- 场外衍生品合约销售基础信息
    where busi_date = '${yyyy-MM-dd}' and Src_Contr_Type != 'FEE_SWAP'  --销售收入不计算“费用互换”
        and grp_id != '04' and Book_Bel_Dept != 'OTC_HK'  --极速合约暂不计算，香港合约单独计算
    ) info
-- 按合约接入逐日本金费用；INNER JOIN意味着没有明细的合约不进入结果。
-- 原SQL没有在这里限定det分区，也没按计提日去重，不擅加日期条件。
inner join PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET det -- 场外衍生品合约销售收入附加明细
on info.agt_id = det.agt_id
-- @include 03_参数匹配.sql
-- 归属按当前加工日取快照，按合约号连接；多条归属仍可扩行。
left join (
    select * from PDATA_N.T98_OTC_COMP_MNG_RELA_INFO -- 场外合约管理关系
    where busi_Date = '${yyyy-MM-dd}'
    ) m
on m.Agt_Id = info.Agt_Id
-- 最终机构范围：至少一组不为空且不是8846，或合约属于原白名单。
-- WHERE写在LEFT JOIN之后，因此缺归属且不在白名单的合约日会被排除。
where coalesce(if(m.Inr_Org_Id_1 = '', '8846', m.Inr_Org_Id_1), '8846') != '8846'
    or coalesce(if(m.Inr_Org_Id_2 = '', '8846', m.Inr_Org_Id_2), '8846') != '8846'
    or coalesce(if(m.Inr_Org_Id_3 = '', '8846', m.Inr_Org_Id_3), '8846') != '8846'
    or info.agt_id in ('OPT-OTC20220163','OPT-OTC20220128','OPT-OTC20220148','OPT-OTC20220162','OPT-OTC20220153','OPT-OTC20220089-1','OPT-OTC20220155','OPT-OTC20220126','OPT-OTC20220147','OPT-OTC20220129')
