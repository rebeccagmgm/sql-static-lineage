-- 用途：接04的每条合约日收入t，补当前内部经办人，按100/0或40/60分配收入并累计。
-- 不按40/60拆本金；不使用交叉介绍关系Allo_Prop_1/2/3。
-- 输出allocated_day_income，06按冻结字段顺序写出。
-- 窗口按合约号分区、计提日排序，未明确ROWS框架；同日多条可能作为同日组一起累计。
-- INR_DEMO承接04：每日100/80/50/0；有内部引入 → 主40/32/20/0、引入60/48/30/0。
-- 本例末日累计收入230、主92、引入138；累计本金8395000是每日金额之和，不是日均。
select
    t.Agt_Id,
    t.Busi_Type,
    t.Cutp_Pty_Id,
    t.Cutp_Pty_Shor_Name,
    t.Cutp_Pty_Full_Name,
    t.Sign_Prd_Name,
    t.Contr_Type_Cd,
    t.Contr_Type_Desc,
    t.Src_Contr_Type,
    t.Src_Contr_Type_Desc,
    t.Src_Sub_Contr_Type,
    t.Src_Sub_Contr_Type_Desc,
    t.Rel_Agt_Id,
    t.Undrl_Wd_Cd,
    t.Undrl_Name,
    t.Undrl_Type,
    t.Undrl_Type_Desc,
    t.Src_Undrl_Type,
    t.Src_Undrl_Type_Desc,
    t.Indt_Cd,
    t.Hedg_Type_Cd,
    t.fee_rate,
    t.Fin_Rati,
    t.Base_Coef,
    t.Base_Rate,
    t.Sprd_Rate,
    t.Strt_Pric_Date,
    t.End_Pric_Date,
    t.Actl_Days,
    t.Is_Preterm_Flag,
    t.Early_Term_Date,
    t.Agt_Stat_Cd,

    -- 金额在这一层才补0；原始收入NULL可来自B2B关联缺失或未知计算类型。
    coalesce(t.Init_Nom_Prin,0) as Init_Nom_Prin,
    coalesce(t.Dyna_Nom_Prin,0) as Dyna_Nom_Prin,
    coalesce(t.Sales_Income,0) as Sales_Income,
    -- NULL或空串内部引入ID → 100/0；非空 → 40/60，不额外校验主经办ID。
    IF(coalesce(m.Inr_Intro_Oper_User_Id,'') = '',
        coalesce(t.Sales_Income,0) * 1, coalesce(t.Sales_Income,0) * 0.4) AS Sales_Income_Main,
    IF(coalesce(m.Inr_Intro_Oper_User_Id,'') = '',
        coalesce(t.Sales_Income,0) * 0, coalesce(t.Sales_Income,0) * 0.6) AS Sales_Income_Intro,

    -- 源字段明确是内部经办人，输出列去掉Inr前缀但没有切换到交叉经办关系。
    m.Inr_Main_Oper_User_Id as Main_Oper_User_Id,
    m.Inr_Main_Oper_Name as Main_Oper_Name,
    m.Inr_Main_Oper_Emp_Id as Main_Oper_Emp_Id,
    m.Inr_Intro_Oper_User_Id as Intro_Oper_User_Id,
    m.Inr_Intro_Oper_Name as Intro_Oper_Name,
    m.Inr_Intro_Oper_Emp_Id as Intro_Oper_Emp_Id,
    t.Accrued_Date,
    from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') as Data_Time,
    t.Intr_Marg,

    -- 累计本金仅计起止日内，End_Pric_Date已经是01提前终止日优先的边界。
    sum(if(t.Accrued_Date BETWEEN Strt_Pric_Date AND End_Pric_Date, coalesce(t.Dyna_Nom_Prin, 0),0))
        over(partition by t.agt_id order by accrued_date) as Accum_Dyna_Nom_Prin,
    -- 累计收入没有上述日期IF，也没有最大值0限制；负收入照常累加。
    sum(coalesce(Sales_Income, 0))
        over(partition by t.agt_id order by accrued_date) as Accum_Sales_Income,
    sum(IF(coalesce(m.Inr_Intro_Oper_User_Id,'') = '',
        coalesce(t.Sales_Income,0) * 1, coalesce(t.Sales_Income,0) * 0.4))
        over(partition by t.agt_id order by accrued_date) as Accum_Sales_Income_Main,
    sum(IF(coalesce(m.Inr_Intro_Oper_User_Id,'') = '',
        coalesce(t.Sales_Income,0) * 0, coalesce(t.Sales_Income,0) * 0.6))
        over(partition by t.agt_id order by accrued_date) as Accum_Sales_Income_Intro,
    t.Ex_Rate_Model,
    '${yyyy-MM-dd}' as busi_date
from contract_day_income t
-- OTC合约管理关系：本次快照的内部经办人连接所有计提日。
-- 缺失仍保留收入行，ID为空且按100/0；多条关系会扩行，并在本层窗口中累计。
left join (
    select * from PDATA_N.T98_OTC_COMP_MNG_RELA_INFO
    where busi_date = '${yyyy-MM-dd}'
    ) m
on m.Agt_Id = t.Agt_Id
