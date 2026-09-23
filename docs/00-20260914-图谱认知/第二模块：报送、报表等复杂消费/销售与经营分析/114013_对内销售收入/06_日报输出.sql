-- 用途：接05，按原52列顺序输出到dm_otc_n.otc_inr_sale_daily_rpt（由任务配置承接）。
-- 该冻结片段为querySql，本文件不补造INSERT，也不执行写入。
-- Sales_Income是05补0后的当日收入；Accrued_Date是计提日，busi_date是加工日。
-- 只有原CAST列转String；Intr_Marg及四项累计、Ex_Rate_Model保持原写法。
-- INR_DEMO的9/21行：当日收入0，累计收入230、主92、引入138；9/18行当日收入100。
SELECT
    CAST( Agt_Id AS String ) Agt_Id , -- 合约编号
    CAST( Busi_Type AS String ) Busi_Type , -- 业务类型
    CAST( Cutp_Pty_Id AS String ) Cutp_Pty_Id , -- 交易对手客户编号
    CAST( Cutp_Pty_Shor_Name AS String ) Cutp_Pty_Shor_Name , -- 交易对手当事人简称
    CAST( Cutp_Pty_Full_Name AS String ) Cutp_Pty_Full_Name , -- 交易对手当事人名称
    CAST( Sign_Prd_Name AS String ) Sign_Prd_Name , -- 代签产品名称
    CAST( Contr_Type_Cd AS String ) Contr_Type_Cd , -- 合约类型代码；04选出的对内经营分类
    CAST( Contr_Type_Desc AS String ) Contr_Type_Desc , -- 合约类型描述
    CAST( Src_Contr_Type AS String ) Src_Contr_Type , -- 源合约类型
    CAST( Src_Contr_Type_Desc AS String ) Src_Contr_Type_Desc , -- 源合约类型描述
    CAST( Src_Sub_Contr_Type AS String ) Src_Sub_Contr_Type , -- 源合约子类型
    CAST( Src_Sub_Contr_Type_Desc AS String ) Src_Sub_Contr_Type_Desc , -- 源合约子类型描述
    CAST( Rel_Agt_Id AS String ) Rel_Agt_Id , -- 关联合约编号
    CAST( Undrl_Wd_Cd AS String ) Undrl_Wd_Cd , -- 标的WD代码
    CAST( Undrl_Name AS String ) Undrl_Name , -- 标的名称
    CAST( Undrl_Type AS String ) Undrl_Type , -- 标的类型
    CAST( Undrl_Type_Desc AS String ) Undrl_Type_Desc , -- 标的类型描述
    CAST( Src_Undrl_Type AS String ) Src_Undrl_Type , -- 源标的类型
    CAST( Src_Undrl_Type_Desc AS String ) Src_Undrl_Type_Desc , -- 源标的类型描述
    CAST( Indt_Cd AS String ) Indt_Cd , -- 行业代码
    CAST( Hedg_Type_Cd AS String ) Hedg_Type_Cd , -- 对冲类型代码
    CAST( fee_rate AS String ) fee_rate , -- 成交费率
    CAST( Fin_Rati AS String ) Fin_Rati , -- 融资比例；展示值，不直接作为两组特殊公式的统一乘数
    CAST( Base_Coef AS String ) Base_Coef , -- 基础系数
    CAST( Base_Rate AS String ) Base_Rate , -- 基础收益率
    CAST( Sprd_Rate AS String ) Sprd_Rate , -- 价差收益率；展示取法可能与收入实际分支不同
    CAST( Strt_Pric_Date AS String ) Strt_Pric_Date , -- 期初定价日
    CAST( End_Pric_Date AS String ) End_Pric_Date , -- 期末定价日；已优先提前终止日
    CAST( Actl_Days AS String ) Actl_Days , -- 实际天数；直接来自主信息期限天数
    CAST( Is_Preterm_Flag AS String ) Is_Preterm_Flag , -- 是否提前终止标识
    CAST( Early_Term_Date AS String ) Early_Term_Date , -- 提前终止日
    CAST( Agt_Stat_Cd AS String ) Agt_Stat_Cd , -- 协议状态代码
    CAST( Init_Nom_Prin AS String ) Init_Nom_Prin , -- 期初名义本金
    CAST( Dyna_Nom_Prin AS String ) Dyna_Nom_Prin , -- 动态名义本金
    CAST( Sales_Income AS String ) Sales_Income , -- 当日计提销售收入；05已将NULL补0
    CAST( Sales_Income_Main AS String ) Sales_Income_Main , -- 主经办人当日计提销售收入
    CAST( Sales_Income_Intro AS String ) Sales_Income_Intro , -- 引入经办人当日计提销售收入
    CAST( Main_Oper_User_Id AS String ) Main_Oper_User_Id , -- 主经办人USER_ID
    CAST( Main_Oper_Name AS String ) Main_Oper_Name , -- 主经办人姓名
    CAST( Main_Oper_Emp_Id AS String ) Main_Oper_Emp_Id , -- 主经办人ERP编号
    CAST( Intro_Oper_User_Id AS String ) Intro_Oper_User_Id , -- 引入经办人USER_ID
    CAST( Intro_Oper_Name AS String ) Intro_Oper_Name , -- 引入经办人姓名
    CAST( Intro_Oper_Emp_Id AS String ) Intro_Oper_Emp_Id , -- 引入经办人ERP编号
    CAST( Accrued_Date AS String ) Accrued_Date , -- 计提日期
    CAST( Data_Time AS String ) Data_Time , -- 数据时间
    Intr_Marg, -- 利差
    Accum_Dyna_Nom_Prin, -- 累计动态名义本金；起止日内每日本金之和
    Accum_Sales_Income, -- 累计销售收入
    Accum_Sales_Income_Main, -- 主经办人累计计提销售收入
    Accum_Sales_Income_Intro, -- 引入经办人累计销售收入
    Ex_Rate_Model, -- 汇率模式
    CAST( busi_date AS String ) busi_date -- 业务日期；此处固定为加工日
FROM allocated_day_income castTable
