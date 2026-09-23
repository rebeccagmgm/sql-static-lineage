/*
输入：05带普通公式候选值的逐日行；输出：raw_daily_income。
本模块是原始收入的最终选择点：特殊业务优先；否则取ordinary_daily_income。
尚未做期权保底、金仕达系统费用分摊，也尚未按人员分配。

本金累计窗口在04完成全部连接、机构筛选后才计算，保持原SQL位置。
Accum_Absl_Nom_Prin在原SQL也累计动态本金，并非对Absl_Nom_Prin求和；不改口径。

特殊公式中的来源：
  info_Ddct_Ptrn = 抵扣模式；info_Init_Marg_Prop = 初始保证金比例
  info_Base_Marg_Rate = 基础保证金率；info_Marg_Agt_Id = 保证金合约编号
  det_Inta / det_Trd_Cms / det_Trd_Cms_Cost / det_Fnd_Cost = 107491的利息 / 交易收入 / 交易成本 / 用资成本源字段
  cc_capital_cost = 类型资金成本参数（03→04），不是另一个当天现金支出
*/
raw_daily_income AS (
    SELECT
    
        -- 合约、客户与标的
        info_Agt_Id AS Agt_Id,
        info_Busi_Type AS Busi_Type,
        info_Cutp_Pty_Id AS Cutp_Pty_Id,
        info_Cutp_Pty_Shor_Name AS Cutp_Pty_Shor_Name,
        info_Cutp_Pty_Full_Name AS Cutp_Pty_Full_Name,
        info_Sign_Prd_Name AS Sign_Prd_Name,
        info_Contr_Type_Cd AS Contr_Type_Cd,
        info_Contr_Type_Desc AS Contr_Type_Desc,
        info_Src_Contr_Type AS Src_Contr_Type,
        info_Src_Contr_Type_Desc AS Src_Contr_Type_Desc,
        info_Src_Sub_Contr_Type AS Src_Sub_Contr_Type,
        info_Src_Sub_Contr_Type_Desc AS Src_Sub_Contr_Type_Desc,
        '' as Undrl_Ins_Id,
        info_Undrl_Wd_Cd AS Undrl_Wd_Cd,
        info_Undrl_Name AS Undrl_Name,
        info_Undrl_Type AS Undrl_Type,
        info_Src_Undrl_Type AS Src_Undrl_Type,
    
        -- 展示的价差、基准：仍保留原来的空串规则，与计算补0分开。
        IF(coalesce(s_sp_Spread_Calculation, c_sp_Spread_Calculation) = 'ANNUALIZED' ,
            coalesce(s_sp_Annualized_Spread, c_sp_Annualized_Spread), '' ) AS Annu_Sprd,
        IF(coalesce(s_sp_Spread_Calculation, c_sp_Spread_Calculation) = 'ABSOLUTE' , coalesce(s_sp_Absolute_Spread,
            c_sp_Absolute_Spread), '' ) AS Absl_Sprd,
        IF(base_mode = 'ANNUALIZED' , coalesce(s_ba_BASE_AWARD_RATE, c_ba_BASE_AWARD_RATE), '' ) AS Annu_Base,
        IF(base_mode = 'ABSOLUTE' , coalesce(s_ba_BASE_AWARD_RATE, c_ba_BASE_AWARD_RATE), '' ) AS Absl_Base,
    
        -- 本金及按日累计
        info_Init_Nom_Prin AS Init_Nom_Prin,
        coalesce(det_Dyna_Nom_Prin, 0) as Dyna_Nom_Prin,
        sum(if(det_busi_date BETWEEN info_Strt_Pric_Date AND income_end_date, coalesce(det_Dyna_Nom_Prin, 0),0))
            over(partition by info_Agt_Id,info_Contr_Type_Cd order by det_busi_date) as Accum_Dyna_Nom_Prin,
        if(info_grp_id = '01' , det_Dyna_Nom_Prin, 0) as Absl_Nom_Prin,
        sum(if(det_busi_date BETWEEN info_Strt_Pric_Date AND income_end_date, coalesce(det_Dyna_Nom_Prin, 0),0))
            over(partition by info_Agt_Id,info_Contr_Type_Cd order by det_busi_date) as Accum_Absl_Nom_Prin,
    
        -- 原始当日收入：严格保留特殊业务优先级。
        CASE
                -- 气囊且抵扣：收入为0。
                WHEN info_Src_Contr_Type in ('AIRBAGX','AIRBAGM','AIRBAGL') and info_Ddct_Ptrn = 'DEDUCTION'
                    THEN 0
        
                -- 气囊、非抵扣且无保证金合约：按融资比例、费率和成本算。
                WHEN info_Src_Contr_Type in ('AIRBAGX','AIRBAGM','AIRBAGL') and coalesce(info_Ddct_Ptrn,'') !=
                    'DEDUCTION' and coalesce(info_Marg_Agt_Id,'') = ''
                    THEN det_Dyna_Nom_Prin * (1 - info_Init_Marg_Prop) * (det_fee_rate/1.06 - cc_capital_cost) / 365 *
                        0.3
        
                -- 气囊、非抵扣且有关联保证金合约：使用基础保证金率调整。
                WHEN info_Src_Contr_Type in ('AIRBAGX','AIRBAGM','AIRBAGL') and coalesce(info_Ddct_Ptrn,'') !=
                    'DEDUCTION' and coalesce(info_Marg_Agt_Id,'') != ''
                    THEN det_Dyna_Nom_Prin * (1 - info_Base_Marg_Rate) * (det_fee_rate*(1 - info_Init_Marg_Prop)/(1 -
                        info_Base_Marg_Rate)/1.06 - cc_capital_cost) /365 *0.3
        
                -- 长期持有互换有关联保证金合约：收入为0。
                WHEN info_Src_Contr_Type = 'LONG_HOLD_SWAP' and coalesce(info_Marg_Agt_Id,'') != ''
                    THEN 0
        
                -- 金仕达：利息折算 + 交易收入 - 交易成本 - 用资金额对应成本，再乘50%。
                WHEN info_Contr_Type_Cd = 'TRS_KINGSTAR_SWAP'
                    THEN (det_Inta * 0.94 + det_Trd_Cms - det_Trd_Cms_Cost - det_Fnd_Cost * cc_capital_cost/365) * 0.5
                -- 不属于以上特殊业务，才使用05算出的普通公式。
                ELSE ordinary_daily_income
            END AS Curr_Prvs_Sales_Income,
    
        -- 日期、状态及人员资料
        info_Strt_Pric_Date AS Strt_Pric_Date,
        income_end_date as End_Pric_Date,
        info_Strt_Pric_Date as Accrued_Strt_Date,
        income_end_date as Accrued_End_Date,
        info_Early_Term_Date AS Early_Term_Date,
        info_Earn_Pymt_Date AS Earn_Pymt_Date,
        info_Agt_Stat_Cd AS Agt_Stat_Cd,
        m_Main_Oper_User_Id AS Main_Oper_User_Id,
        m_Main_Oper_Name AS Main_Oper_Name,
        m_Main_Oper_Emp_Id AS Main_Oper_Emp_Id,
        m_Intro_Oper_User_Id AS Intro_Oper_User_Id,
        m_Intro_Oper_Name AS Intro_Oper_Name,
        m_Intro_Oper_Emp_Id AS Intro_Oper_Emp_Id,
        m_Inr_Org_Id_1 as Intro_Inr_Org_Id_1,
        m_Inr_Org_Name_1 as Intro_Inr_Org_Name_1,
        m_Div_Org_Id_1 AS Div_Org_Id_1,
        m_Div_Org_Name_1 AS Div_Org_Name_1,
        m_Cust_Mngr_User_Id_1 AS Cust_Mngr_User_Id_1,
        m_Cust_Mngr_Name_1 AS Cust_Mngr_Name_1,
        m_Cust_Mngr_Emp_Id_1 AS Cust_Mngr_Emp_Id_1,
        m_Allo_Prop_1 AS Allo_Prop_1,
        m_Inr_Org_Id_2 as Intro_Inr_Org_Id_2,
        m_Inr_Org_Name_2 as Intro_Inr_Org_Name_2,
        m_Div_Org_Id_2 AS Div_Org_Id_2,
        m_Div_Org_Name_2 AS Div_Org_Name_2,
        m_Cust_Mngr_User_Id_2 AS Cust_Mngr_User_Id_2,
        m_Cust_Mngr_Name_2 AS Cust_Mngr_Name_2,
        m_Cust_Mngr_Emp_Id_2 AS Cust_Mngr_Emp_Id_2,
        m_Allo_Prop_2 AS Allo_Prop_2,
        m_Inr_Org_Id_3 as Intro_Inr_Org_Id_3,
        m_Inr_Org_Name_3 as Intro_Inr_Org_Name_3,
        m_Div_Org_Id_3 AS Div_Org_Id_3,
        m_Div_Org_Name_3 AS Div_Org_Name_3,
        m_Cust_Mngr_User_Id_3 AS Cust_Mngr_User_Id_3,
        m_Cust_Mngr_Name_3 AS Cust_Mngr_Name_3,
        m_Cust_Mngr_Emp_Id_3 AS Cust_Mngr_Emp_Id_3,
    
        -- 计提日与附加资料
        m_Allo_Prop_3 AS Allo_Prop_3,
        det_busi_date as Accrued_Date,
        coalesce(s_ba_Additional_Reward,0) as Adtnl_Rwd,
        det_fee_rate AS fee_rate,
        1 - info_Init_Marg_Prop as Fin_Rati,
        info_Intr_Marg AS Intr_Marg,
        info_Res_Flag AS Res_Flag,
        info_Opt_Fee_Rate AS Opt_Fee_Rate,
        if(info_Ex_Rate_Model in
            ('SHENZHEN_HONGKONG_STOCK_CONNECT','SHANGHAI_HONGKONG_STOCK_CONNECT'),info_Ex_Rate_Model,null) as
            Ex_Rate_Model,
        if(nvl(m_Cust_Mngr_Emp_Stat_Desc_1, '' ) = '' , m_Cust_Mngr_Emp_Stat_Desc_1, if(m_Cust_Mngr_Emp_Stat_Desc_1
            = '在职' , '是' , '否' )) as Cust_Mngr_Is_Actv_1,
        if(nvl(m_Cust_Mngr_Emp_Stat_Desc_2, '' ) = '' , m_Cust_Mngr_Emp_Stat_Desc_2, if(m_Cust_Mngr_Emp_Stat_Desc_2
            = '在职' , '是' , '否' )) as Cust_Mngr_Is_Actv_2,
        if(nvl(m_Cust_Mngr_Emp_Stat_Desc_3, '' ) = '' , m_Cust_Mngr_Emp_Stat_Desc_3, if(m_Cust_Mngr_Emp_Stat_Desc_3
            = '在职' , '是' , '否' )) as Cust_Mngr_Is_Actv_3
    FROM ordinary_income_rows inputs
)
