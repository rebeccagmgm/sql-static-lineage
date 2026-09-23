-- 输入：主脚本第二阶段adjusted_day_income，仍保留原别名X。
-- 输出：本金归属、三组当日收入、累计收入及日期，交给07做最终字段输出。
-- gfgreatest是default自定义函数，知识库记载“返回传入参数最大值”；不是在这里重定义UDF。

select
    Agt_Id,
    Busi_Type,
    Cutp_Pty_Id,
    Cutp_Pty_Shor_Name,
    Cutp_Pty_Full_Name,
    Sign_Prd_Name,
    Contr_Type_Cd,
    Contr_Type_Desc,
    Src_Contr_Type,
    Src_Contr_Type_Desc,
    Src_Sub_Contr_Type,
    Src_Sub_Contr_Type_Desc,
    Undrl_Ins_Id,
    Undrl_Wd_Cd,
    Undrl_Name,
    Undrl_Type,
    Src_Undrl_Type,
    Annu_Sprd,
    Absl_Sprd,
    Annu_Base,
    Absl_Base,
    -- 本金40/60：引入经办人存在才拆；不是三组介绍人的收入比例。
    Init_Nom_Prin,
    IF(Intro_Oper_User_Id IS NULL or Intro_Oper_User_Id = '', Init_Nom_Prin * 1, Init_Nom_Prin * 0.4) AS Init_Nom_Prin_Main,  -- 只看引入经办ID是否NULL/空串；不要求主经办ID非空
    IF(Intro_Oper_User_Id IS NULL or Intro_Oper_User_Id = '', Init_Nom_Prin * 0, Init_Nom_Prin * 0.6) AS Init_Nom_Prin_Intro,
    Dyna_Nom_Prin,
    IF(Intro_Oper_User_Id IS NULL or Intro_Oper_User_Id = '', Dyna_Nom_Prin * 1, Dyna_Nom_Prin * 0.4) AS Dyna_Nom_Prin_Main,
    IF(Intro_Oper_User_Id IS NULL or Intro_Oper_User_Id = '', Dyna_Nom_Prin * 0, Dyna_Nom_Prin * 0.6) AS Dyna_Nom_Prin_Intro,
    Accum_Dyna_Nom_Prin,
    Absl_Nom_Prin,
    IF(Intro_Oper_User_Id IS NULL or Intro_Oper_User_Id = '', Absl_Nom_Prin * 1, Absl_Nom_Prin * 0.4) AS Absl_Nom_Prin_Main,
    IF(Intro_Oper_User_Id IS NULL or Intro_Oper_User_Id = '', Absl_Nom_Prin * 0, Absl_Nom_Prin * 0.6) AS Absl_Nom_Prin_Intro,
    Accum_Absl_Nom_Prin,
    -- 收入使用04调整后金额，再分别乘105743传来的三组Allo_Prop。
    -- 无比例时单组当日收入为NULL；不自动补0或归一化。
    Curr_Prvs_Sales_Income_n as Curr_Prvs_Sales_Income,
    Curr_Prvs_Sales_Income_n * Allo_Prop_1 AS Curr_Prvs_Sales_Income_1,
    Curr_Prvs_Sales_Income_n * Allo_Prop_2 AS Curr_Prvs_Sales_Income_2,
    Curr_Prvs_Sales_Income_n * Allo_Prop_3 AS Curr_Prvs_Sales_Income_3,
    -- 日期沿用01改写后的结束日；提前终止标志只检查Early_Term_Date有无值。
    Strt_Pric_Date,
    End_Pric_Date,
    Strt_Pric_Date as Accrued_Strt_Date,
    Accrued_End_Date,
    Earn_Pymt_Date,
    datediff(if(Accrued_Date > End_Pric_Date, End_Pric_Date, Accrued_Date), Strt_Pric_Date) + 1 AS Actl_Days,  -- 截止日不晚于合约结束日，天数+1含首尾；未给负天数设下限
    IF(Early_Term_Date IS NULL OR Early_Term_Date = '', '0', '1') AS Is_Preterm_Flag,
    Early_Term_Date,
    Agt_Stat_Cd,
    Main_Oper_User_Id,
    Main_Oper_Name,
    Main_Oper_Emp_Id,
    Intro_Oper_User_Id,
    Intro_Oper_Name,
    Intro_Oper_Emp_Id,
    Intro_Inr_Org_Id_1,
    Intro_Inr_Org_Name_1,
    Div_Org_Id_1,
    Div_Org_Name_1,
    Cust_Mngr_User_Id_1,
    Cust_Mngr_Name_1,
    Cust_Mngr_Emp_Id_1,
    Allo_Prop_1,
    Intro_Inr_Org_Id_2,
    Intro_Inr_Org_Name_2,
    Div_Org_Id_2,
    Div_Org_Name_2,
    Cust_Mngr_User_Id_2,
    Cust_Mngr_Name_2,
    Cust_Mngr_Emp_Id_2,
    Allo_Prop_2,
    Intro_Inr_Org_Id_3,
    Intro_Inr_Org_Name_3,
    Div_Org_Id_3,
    Div_Org_Name_3,
    Cust_Mngr_User_Id_3,
    Cust_Mngr_Name_3,
    Cust_Mngr_Emp_Id_3,
    Allo_Prop_3,
    Accrued_Date,
    from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') AS Data_Time,
    -- 先把调整后当日收入SUM累计，再与0取大；不是先把每天负收入截为0。
    -- 窗口按合约+合约类型，按计提日排序；同日多行未在此去重，也未指定ROWS。
    default.gfgreatest(
        sum(coalesce(Curr_Prvs_Sales_Income_n, 0)) OVER (
            PARTITION BY agt_id, Contr_Type_Cd ORDER BY accrued_date
        ), 0
    ) AS Accum_prvs_sales_income,
    default.gfgreatest(
        sum(coalesce(Curr_Prvs_Sales_Income_n * Allo_Prop_1, 0)) OVER (
            PARTITION BY agt_id, Contr_Type_Cd ORDER BY accrued_date
        ), 0
    ) AS Accum_prvs_sales_income_1,
    default.gfgreatest(
        sum(coalesce(Curr_Prvs_Sales_Income_n * Allo_Prop_2, 0)) OVER (
            PARTITION BY agt_id, Contr_Type_Cd ORDER BY accrued_date
        ), 0
    ) AS Accum_prvs_sales_income_2,
    default.gfgreatest(
        sum(coalesce(Curr_Prvs_Sales_Income_n * Allo_Prop_3, 0)) OVER (
            PARTITION BY agt_id, Contr_Type_Cd ORDER BY accrued_date
        ), 0
    ) AS Accum_prvs_sales_income_3,
    Adtnl_Rwd,
    if(Src_Contr_Type in ('AIRBAGX','AIRBAGM','AIRBAGL'), fee_rate, null) as fee_rate,
    if(Src_Contr_Type in ('AIRBAGX','AIRBAGM','AIRBAGL'), Fin_Rati, null) as Fin_Rati,
    Intr_Marg,
    Res_Flag,
    Opt_Fee_Rate,
    Ex_Rate_Model,
    Cust_Mngr_Is_Actv_1,  -- 客户经理是否在职_1
    Cust_Mngr_Is_Actv_2,  -- 客户经理是否在职_2
    Cust_Mngr_Is_Actv_3,  -- 客户经理是否在职_3
    '${yyyy-MM-dd}' as busi_date
FROM adjusted_day_income X
