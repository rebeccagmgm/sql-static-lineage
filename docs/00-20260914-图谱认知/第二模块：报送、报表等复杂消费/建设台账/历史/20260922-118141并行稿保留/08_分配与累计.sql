/*
输入：07调整后的当日收入；输出：allocated_daily_report。
两种分配不是一回事：
  本金：有引入经办人 → 主办40%、引入60%；否则主办100%、引入0%。
  收入：调整后收入 × Allo_Prop_1/2/3（经营关系中的三个客户经理分配比例）。
不把40/60套到收入，也不在这里把三个比例重新归一化。

累计使用调整后的收入；窗口按合约+合约类型、计提日排序。
保留原default.gfgreatest调用；未在生产引擎验证其NULL/类型细节。
Accrued_Date是收入归属日；末尾busi_date是这次加工日，不要混用。
*/
allocated_daily_report AS (
    SELECT
    
        -- 合约及参数展示
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
    
        -- 本金：主办/引入分配，与客户经理收入分配不同。
        Init_Nom_Prin,
        IF(Intro_Oper_User_Id IS NULL or Intro_Oper_User_Id = '' , Init_Nom_Prin * 1, Init_Nom_Prin * 0.4) AS
            Init_Nom_Prin_Main,
        IF(Intro_Oper_User_Id IS NULL or Intro_Oper_User_Id = '' , Init_Nom_Prin * 0, Init_Nom_Prin * 0.6) AS
            Init_Nom_Prin_Intro,
        Dyna_Nom_Prin,
        IF(Intro_Oper_User_Id IS NULL or Intro_Oper_User_Id = '' , Dyna_Nom_Prin * 1, Dyna_Nom_Prin * 0.4) AS
            Dyna_Nom_Prin_Main,
        IF(Intro_Oper_User_Id IS NULL or Intro_Oper_User_Id = '' , Dyna_Nom_Prin * 0, Dyna_Nom_Prin * 0.6) AS
            Dyna_Nom_Prin_Intro,
        Accum_Dyna_Nom_Prin,
        Absl_Nom_Prin,
        IF(Intro_Oper_User_Id IS NULL or Intro_Oper_User_Id = '' , Absl_Nom_Prin * 1, Absl_Nom_Prin * 0.4) AS
            Absl_Nom_Prin_Main,
        IF(Intro_Oper_User_Id IS NULL or Intro_Oper_User_Id = '' , Absl_Nom_Prin * 0, Absl_Nom_Prin * 0.6) AS
            Absl_Nom_Prin_Intro,
        Accum_Absl_Nom_Prin,
    
        -- 调整后当日收入与三个客户经理份额
        Curr_Prvs_Sales_Income_n as Curr_Prvs_Sales_Income,
        Curr_Prvs_Sales_Income_n * Allo_Prop_1 AS Curr_Prvs_Sales_Income_1,
        Curr_Prvs_Sales_Income_n * Allo_Prop_2 AS Curr_Prvs_Sales_Income_2,
        Curr_Prvs_Sales_Income_n * Allo_Prop_3 AS Curr_Prvs_Sales_Income_3,
        Strt_Pric_Date,
        End_Pric_Date,
        Strt_Pric_Date as Accrued_Strt_Date,
        Accrued_End_Date,
        Earn_Pymt_Date,
    
        -- 计提天数包含开始日，结束后封顶到结束日。
        datediff(if(Accrued_Date > End_Pric_Date, End_Pric_Date, Accrued_Date), Strt_Pric_Date) + 1 AS Actl_Days,
        IF(Early_Term_Date IS NULL OR Early_Term_Date = '' , '0' , '1' ) AS Is_Preterm_Flag,
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
    
        -- 按计提日累计：采用调整后收入，不是06的原始收入。
        from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') AS Data_Time,
        default.gfgreatest(sum(coalesce(Curr_Prvs_Sales_Income_n, 0)) over(partition by agt_id,Contr_Type_Cd order
            by accrued_date),0) as Accum_prvs_sales_income,
        default.gfgreatest(sum(coalesce(Curr_Prvs_Sales_Income_n * Allo_Prop_1, 0)) over(partition by
            agt_id,Contr_Type_Cd order by accrued_date),0) as Accum_prvs_sales_income_1,
        default.gfgreatest(sum(coalesce(Curr_Prvs_Sales_Income_n * Allo_Prop_2, 0)) over(partition by
            agt_id,Contr_Type_Cd order by accrued_date),0) as Accum_prvs_sales_income_2,
    
        -- 附加奖励只带出展示，本段没有再加到收入中。
        default.gfgreatest(sum(coalesce(Curr_Prvs_Sales_Income_n * Allo_Prop_3, 0)) over(partition by
            agt_id,Contr_Type_Cd order by accrued_date),0) as Accum_prvs_sales_income_3,
        Adtnl_Rwd,
        if(Src_Contr_Type in ('AIRBAGX','AIRBAGM','AIRBAGL'), fee_rate, null) as fee_rate,
        if(Src_Contr_Type in ('AIRBAGX','AIRBAGM','AIRBAGL'), Fin_Rati, null) as Fin_Rati,
        Intr_Marg,
        Res_Flag,
        Opt_Fee_Rate,
        Ex_Rate_Model,
        Cust_Mngr_Is_Actv_1,
        Cust_Mngr_Is_Actv_2,
        Cust_Mngr_Is_Actv_3,
        '${yyyy-MM-dd}' as busi_date
    FROM adjusted_daily_income X
)
