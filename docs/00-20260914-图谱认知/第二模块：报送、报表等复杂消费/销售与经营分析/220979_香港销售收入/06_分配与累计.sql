-- 读取05调整结果，收入用Curr_Prvs_Sales_Income_n；对外重新命名Curr_Prvs_Sales_Income。
-- 本金主/引入40%/60%与介绍组Allo_Prop_1/2/3独立；没有三组当日收入输出，只有三组累计。
-- 先逐日相乘再窗口求和，最后累计取下限0；比例未重新归一化，不先把每天负收入截为0。
-- 无显式ROWS和同日额外排序键，重复日期是窗口同值组，不能视为逐行稳定排序。
	 select
    Agt_Id,  --合约编号
    Busi_Type,  --业务类型
    Cutp_Pty_Id,  --交易对手客户编号
    Cutp_Pty_Shor_Name,  --交易对手当事人简称
    Cutp_Pty_Full_Name,  --交易对手当事人名称
    Sign_Prd_Name,  --代签产品名称
    Contr_Type_Cd,  --合约类型代码
    Contr_Type_Desc,  --合约类型描述
    Src_Contr_Type,  --源合约类型
    Src_Contr_Type_Desc,  --源合约类型描述
    Src_Sub_Contr_Type,  --源合约子类型
    Src_Sub_Contr_Type_Desc,  --源合约子类型描述
    Undrl_Wd_Cd,  --WD标的代码
    Undrl_Name,  --标的名称
    Undrl_Type,  --标的类型
    Src_Undrl_Type,  --源标的类型
    Annu_Sprd,  --年化价差
    Absl_Sprd,  --绝对价差
    Annu_Base,  --年化销售费系数
    Absl_Base,  --绝对销售费系数
    Cms_Fee_Rate,  --交易佣金费率
    Init_Nom_Prin,  --初始名义本金
    IF(coalesce(Intro_Oper_User_Id,'') = '', Init_Nom_Prin * 1, Init_Nom_Prin * 0.4) AS Init_Nom_Prin_Main,  --主经办人初始名义本金
    IF(coalesce(Intro_Oper_User_Id,'') = '', Init_Nom_Prin * 0, Init_Nom_Prin * 0.6) AS Init_Nom_Prin_Intro,  --引入经办人初始名义本金
    Dyna_Nom_Prin,  --动态名义本金
    IF(coalesce(Intro_Oper_User_Id,'') = '', Dyna_Nom_Prin * 1, Dyna_Nom_Prin * 0.4) AS Dyna_Nom_Prin_Main,  --主经办人动态名义本金
    IF(coalesce(Intro_Oper_User_Id,'') = '', Dyna_Nom_Prin * 0, Dyna_Nom_Prin * 0.6) AS Dyna_Nom_Prin_Intro,  --引入经办人动态名义本金
    Accum_Dyna_Nom_Prin,  --累计动态名义本金
    Absl_Nom_Prin,  --绝对名义本金
    IF(coalesce(Intro_Oper_User_Id,'') = '', Absl_Nom_Prin * 1, Absl_Nom_Prin * 0.4) AS Absl_Nom_Prin_Main,  --主经办人绝对名义本金
    IF(coalesce(Intro_Oper_User_Id,'') = '', Absl_Nom_Prin * 0, Absl_Nom_Prin * 0.6) AS Absl_Nom_Prin_Intro,  --引入经办人绝对名义本金
    Accum_Absl_Nom_Prin,  --累计绝对名义本金
    Strt_Pric_Date,  --期初定价日
    End_Pric_Date,  --期末定价日
    Earn_Pymt_Date,  --收益兑付日
    IF(Early_Term_Date IS NULL OR Early_Term_Date = '', '0', '1') AS Is_Preterm_Flag,  --是否提前终止标识
    Early_Term_Date,  --提前终止日
    Agt_Stat_Cd,  --协议状态代码
    Main_Oper_User_Id,  --主经办人ID
    Main_Oper_Name,  --主经办人姓名
    Main_Oper_Emp_Id,  --主经办人ERP编号
    Intro_Oper_User_Id,  --引入经办人ID
    Intro_Oper_Name,  --引入经办人姓名
    Intro_Oper_Emp_Id,  --引入经办人ERP编号
    Intro_Inr_Org_Id_1,  --引入部门ID_1
    Intro_Inr_Org_Name_1,  --引入部门名称_1
    Div_Org_Id_1,  --所属分公司ID_1
    Div_Org_Name_1,  --所属分公司名称_1
    Cust_Mngr_User_Id_1,  --客户经理ID_1
    Cust_Mngr_Name_1,  --客户经理姓名_1
    Cust_Mngr_Emp_Id_1,  --客户经理ERP编号_1
    Allo_Prop_1,  --分配比例_1
    Intro_Inr_Org_Id_2,  --引入部门ID_2
    Intro_Inr_Org_Name_2,  --引入部门名称_2
    Div_Org_Id_2,  --所属分公司ID_2
    Div_Org_Name_2,  --所属分公司名称_2
    Cust_Mngr_User_Id_2,  --客户经理ID_2
    Cust_Mngr_Name_2,  --客户经理姓名_2
    Cust_Mngr_Emp_Id_2,  --客户经理ERP编号_2
    Allo_Prop_2,  --分配比例_2
    Intro_Inr_Org_Id_3,  --引入部门ID_3
    Intro_Inr_Org_Name_3,  --引入部门名称_3
    Div_Org_Id_3,  --所属分公司ID_3
    Div_Org_Name_3,  --所属分公司名称_3
    Cust_Mngr_User_Id_3,  --客户经理ID_3
    Cust_Mngr_Name_3,  --客户经理姓名_3
    Cust_Mngr_Emp_Id_3,  --客户经理ERP编号_3
    Allo_Prop_3,  --分配比例_3
    Accrued_Date,  --计提日期
    Curr_Prvs_Sales_Income_n as Curr_Prvs_Sales_Income,  --当日计提销售收入
    default.gfgreatest(sum(coalesce(Curr_Prvs_Sales_Income_n, 0)) over(partition by agt_id,Contr_Type_Cd order by accrued_date),0) as Accum_prvs_sales_income,  --累计计提销售收入
    default.gfgreatest(sum(coalesce(Curr_Prvs_Sales_Income_n * Allo_Prop_1, 0)) over(partition by agt_id,Contr_Type_Cd order by accrued_date),0) as Accum_prvs_sales_income_1,  --累计计提销售收入_1
    default.gfgreatest(sum(coalesce(Curr_Prvs_Sales_Income_n * Allo_Prop_2, 0)) over(partition by agt_id,Contr_Type_Cd order by accrued_date),0) as Accum_prvs_sales_income_2,  --累计计提销售收入_2
    default.gfgreatest(sum(coalesce(Curr_Prvs_Sales_Income_n * Allo_Prop_3, 0)) over(partition by agt_id,Contr_Type_Cd order by accrued_date),0) as Accum_prvs_sales_income_3,  --累计计提销售收入_3
    Adtnl_Rwd,  --额外奖励
    if(Src_Contr_Type in ('RISKY','AIRBAGX'), fee_rate, null) as Fee_Rate,  --成交费率
    if(Src_Contr_Type in ('RISKY','AIRBAGX'), Fin_Rati, null) as Fin_Rati,  --融资比例
    Intr_Marg,  --利差
    Res_Flag,  --限售标志
    Opt_Fee_Rate,  --期权费率
    from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') AS Data_Time,  --数据时间
    '${yyyy-MM-dd}' as busi_date  --业务日期
FROM adjusted_day_income X
