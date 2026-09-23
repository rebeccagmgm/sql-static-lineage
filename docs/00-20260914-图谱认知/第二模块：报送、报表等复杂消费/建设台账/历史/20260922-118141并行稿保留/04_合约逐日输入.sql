/*
本模块实际把输入接成一张逐日计算底表 contract_day_inputs，后面不再回头JOIN这些源表。

合约info ─INNER→ det逐日明细：决定有哪些合约日
          LEFT→ s_sp/c_sp：两级价差
          LEFT→ s_ba/c_ba：两级基准
          LEFT→ cc：资金成本
          LEFT→ m：人员及分配
          WHERE：机构范围 / 指定合约例外
                    ↓
每行带齐“日期、本金、计算参数、人员资料”

目标理解单位是合约×计提日，但原SQL没有去重：多匹配会放大行数。
字段保留来源前缀，如det_Dyna_Nom_Prin就是det.Dyna_Nom_Prin，不是另算的新本金。
下方源字段注释来自Hive元数据快照；参数别名解释来自本任务SQL。
*/
contract_day_inputs AS (
    SELECT
        -- 合约资料（01）；日期、初始本金和业务身份
        info.Agt_Id AS info_Agt_Id, -- 合约编号
        info.Busi_Type AS info_Busi_Type, -- 业务类型
        info.Cutp_Pty_Id AS info_Cutp_Pty_Id, -- 交易对手客户编号
        info.Cutp_Pty_Shor_Name AS info_Cutp_Pty_Shor_Name, -- 交易对手当事人简称
        info.Cutp_Pty_Full_Name AS info_Cutp_Pty_Full_Name, -- 交易对手当事人名称
        info.Sign_Prd_Name AS info_Sign_Prd_Name, -- 代签产品名称
        info.Contr_Type_Cd AS info_Contr_Type_Cd, -- 合约类型代码
        info.Contr_Type_Desc AS info_Contr_Type_Desc, -- 合约类型描述
        info.Src_Contr_Type AS info_Src_Contr_Type, -- 源合约类型
        info.Src_Contr_Type_Desc AS info_Src_Contr_Type_Desc, -- 源合约类型描述
        info.Src_Sub_Contr_Type AS info_Src_Sub_Contr_Type, -- 源合约子类型
        info.Src_Sub_Contr_Type_Desc AS info_Src_Sub_Contr_Type_Desc, -- 源合约子类型描述
        info.Undrl_Wd_Cd AS info_Undrl_Wd_Cd, -- 标的万得代码
        info.Undrl_Name AS info_Undrl_Name, -- 标的名称
        info.Undrl_Type AS info_Undrl_Type, -- 标的类型
        info.Src_Undrl_Type AS info_Src_Undrl_Type, -- 源标的类型
        info.Init_Nom_Prin AS info_Init_Nom_Prin, -- 初始名义本金
        info.Strt_Pric_Date AS info_Strt_Pric_Date, -- 期初定价日
        info.Early_Term_Date AS info_Early_Term_Date, -- 提前终止日
        info.End_Pric_Date AS info_End_Pric_Date, -- 期末定价日
        info.grp_id AS info_grp_id, -- 并行分组标识
        info.Marg_Agt_Id AS info_Marg_Agt_Id, -- 保证金合约编号
        info.Earn_Pymt_Date AS info_Earn_Pymt_Date, -- 收益兑付日
        info.Agt_Stat_Cd AS info_Agt_Stat_Cd, -- 协议状态代码
        info.Init_Marg_Prop AS info_Init_Marg_Prop, -- 初始保证金比例
        info.Intr_Marg AS info_Intr_Marg, -- 利差
        info.Res_Flag AS info_Res_Flag, -- 限售标志
        info.Opt_Fee_Rate AS info_Opt_Fee_Rate, -- 期权费率
        info.Ex_Rate_Model AS info_Ex_Rate_Model, -- 汇率模式
        Ddct_Ptrn AS info_Ddct_Ptrn, -- 抵扣模式
        Base_Marg_Rate AS info_Base_Marg_Rate, -- 基础保证金率
        -- 逐日金额（107491）；本脚本不重算持仓或事件本金
        det.Dyna_Nom_Prin AS det_Dyna_Nom_Prin, -- 动态名义本金
        det.busi_date AS det_busi_date, -- 业务日期
        det.fee_rate AS det_fee_rate, -- 费率
        det.Inta AS det_Inta, -- 应计利息
        det.Trd_Cms AS det_Trd_Cms, -- 交易佣金收入
        det.Trd_Cms_Cost AS det_Trd_Cms_Cost, -- 交易佣金成本
        det.Fnd_Cost AS det_Fnd_Cost, -- 用资成本
        -- 合约级价差（02）
        s_sp.Spread_Calculation AS s_sp_Spread_Calculation,
        s_sp.Annualized_Spread AS s_sp_Annualized_Spread,
        s_sp.Absolute_Spread AS s_sp_Absolute_Spread,
        -- 客户级价差（02）
        c_sp.Spread_Calculation AS c_sp_Spread_Calculation,
        c_sp.Annualized_Spread AS c_sp_Annualized_Spread,
        c_sp.Absolute_Spread AS c_sp_Absolute_Spread,
        -- 合约级基准（03）
        s_ba.BASE_CALCULATION AS s_ba_BASE_CALCULATION,
        s_ba.BASE_AWARD_RATE AS s_ba_BASE_AWARD_RATE,
        Additional_Reward AS s_ba_Additional_Reward,
        -- 类型级基准（03）
        c_ba.BASE_CALCULATION AS c_ba_BASE_CALCULATION,
        c_ba.BASE_AWARD_RATE AS c_ba_BASE_AWARD_RATE,
        -- 类型资金成本（03）
        cc.capital_cost AS cc_capital_cost,
        -- 人员与机构资料（01）
        m.Main_Oper_User_Id AS m_Main_Oper_User_Id, -- 主经办人ID
        m.Main_Oper_Name AS m_Main_Oper_Name, -- 主经办人姓名
        m.Main_Oper_Emp_Id AS m_Main_Oper_Emp_Id, -- 主经办人员工编号
        m.Intro_Oper_User_Id AS m_Intro_Oper_User_Id, -- 引入经办人ID
        m.Intro_Oper_Name AS m_Intro_Oper_Name, -- 引入经办人姓名
        m.Intro_Oper_Emp_Id AS m_Intro_Oper_Emp_Id, -- 引入经办人员工编号
        m.Inr_Org_Id_1 AS m_Inr_Org_Id_1, -- 引入部门ID_1
        m.Inr_Org_Name_1 AS m_Inr_Org_Name_1, -- 引入部门名称_1
        m.Div_Org_Id_1 AS m_Div_Org_Id_1, -- 所属分公司ID_1
        m.Div_Org_Name_1 AS m_Div_Org_Name_1, -- 所属分公司名称_1
        m.Cust_Mngr_User_Id_1 AS m_Cust_Mngr_User_Id_1, -- 客户经理USER_ID_1
        m.Cust_Mngr_Name_1 AS m_Cust_Mngr_Name_1, -- 客户经理姓名_1
        m.Cust_Mngr_Emp_Id_1 AS m_Cust_Mngr_Emp_Id_1, -- 客户经理员工编号_1
        m.Allo_Prop_1 AS m_Allo_Prop_1, -- 分配比例_1
        m.Inr_Org_Id_2 AS m_Inr_Org_Id_2, -- 引入部门ID_2
        m.Inr_Org_Name_2 AS m_Inr_Org_Name_2, -- 引入部门名称_2
        m.Div_Org_Id_2 AS m_Div_Org_Id_2, -- 所属分公司ID_2
        m.Div_Org_Name_2 AS m_Div_Org_Name_2, -- 所属分公司名称_2
        m.Cust_Mngr_User_Id_2 AS m_Cust_Mngr_User_Id_2, -- 客户经理USER_ID_2
        m.Cust_Mngr_Name_2 AS m_Cust_Mngr_Name_2, -- 客户经理姓名_2
        m.Cust_Mngr_Emp_Id_2 AS m_Cust_Mngr_Emp_Id_2, -- 客户经理员工编号_2
        m.Allo_Prop_2 AS m_Allo_Prop_2, -- 分配比例_2
        m.Inr_Org_Id_3 AS m_Inr_Org_Id_3, -- 引入部门ID_3
        m.Inr_Org_Name_3 AS m_Inr_Org_Name_3, -- 引入部门名称_3
        m.Div_Org_Id_3 AS m_Div_Org_Id_3, -- 所属分公司ID_3
        m.Div_Org_Name_3 AS m_Div_Org_Name_3, -- 所属分公司名称_3
        m.Cust_Mngr_User_Id_3 AS m_Cust_Mngr_User_Id_3, -- 客户经理USER_ID_3
        m.Cust_Mngr_Name_3 AS m_Cust_Mngr_Name_3, -- 客户经理姓名_3
        m.Cust_Mngr_Emp_Id_3 AS m_Cust_Mngr_Emp_Id_3, -- 客户经理员工编号_3
        m.Allo_Prop_3 AS m_Allo_Prop_3, -- 分配比例_3
        m.Cust_Mngr_Emp_Stat_Desc_1 AS m_Cust_Mngr_Emp_Stat_Desc_1, -- 客户经理员工状态描述_1
        m.Cust_Mngr_Emp_Stat_Desc_2 AS m_Cust_Mngr_Emp_Stat_Desc_2, -- 客户经理员工状态描述_2
        m.Cust_Mngr_Emp_Stat_Desc_3 AS m_Cust_Mngr_Emp_Stat_Desc_3, -- 客户经理员工状态描述_3
    
        -- 供05、06使用的计算参数；与上方展示用源字段分开。
        coalesce(s_sp.Spread_Calculation, c_sp.Spread_Calculation, 'ABSOLUTE') AS spread_mode, -- 收入计算方式：合约优先，客户其次；两侧空才默认绝对方式
        coalesce(s_ba.BASE_CALCULATION, c_ba.BASE_CALCULATION) AS base_mode, -- 基准计算方式：合约优先、类型其次；两侧空不设默认
        coalesce(s_sp.Annualized_Spread, c_sp.Annualized_Spread, 0) AS annual_spread_rate, -- 年化价差：合约优先、客户其次；两侧空补0
        coalesce(s_sp.Absolute_Spread, c_sp.Absolute_Spread, 0) AS absolute_spread_rate, -- 绝对价差：合约优先、客户其次；两侧空补0
        coalesce(s_ba.BASE_AWARD_RATE, c_ba.BASE_AWARD_RATE, 0) AS base_rate, -- 基准比例：合约优先、类型其次；两侧空补0
        coalesce(info.Early_Term_Date, info.End_Pric_Date) AS income_end_date -- 收入结束日：提前终止日优先，否则期末定价日
    
    -- 主体：加工日合约快照。
    from sale_contracts info
    
    -- INNER JOIN：必须有逐日附加明细；仅按Agt_Id连接，不额外筛加工日或grp_id。
    inner join PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET det
    on info.agt_id = det.agt_id
    
    -- 合约价差随计提日匹配。
    left join contract_spread_days s_sp
    on s_sp.CONTRACT_CODE = info.Agt_Id and s_sp.busi_date = det.busi_date
    
    -- 客户价差按合约开始日匹配。
    left join customer_spread_days c_sp
    on c_sp.CLIENT_ID = info.Cutp_Pty_Id and c_sp.CONTRACT_TYPE = info.Contr_Type_Cd and c_sp.busi_date = info.Strt_Pric_Date
    
    -- 合约基准仅按合约号匹配。
    left join contract_baselines s_ba
    on s_ba.CONTRACT_CODE = info.Agt_Id
    
    -- 类型基准按合约开始日匹配。
    left join type_baseline_days c_ba
    on c_ba.CONTRACT_TYPE = info.Contr_Type_Cd and c_ba.busi_date = info.Strt_Pric_Date
    
    -- 成本按合约开始日匹配。
    left join type_cost_days cc
    on cc.CONTRACT_TYPE = info.Contr_Type_Cd and cc.busi_date = info.Strt_Pric_Date
    
    -- 经营关系按合约号匹配；最终WHERE会进一步限制机构范围。
    left join sale_management m
    on m.Agt_Id = info.Agt_Id
    
    -- 空机构按8846处理；三个机构均不满足时，仅下列指定合约例外保留。
    where coalesce(if(m.Inr_Org_Id_1 = '', '8846', m.Inr_Org_Id_1), '8846') != '8846' or coalesce(if(m.Inr_Org_Id_2 = '', '8846', m.Inr_Org_Id_2), '8846') != '8846' or coalesce(if(m.Inr_Org_Id_3 = '', '8846', m.Inr_Org_Id_3), '8846') != '8846'
    or info.agt_id in ('OPT-OTC20220163','OPT-OTC20220128','OPT-OTC20220148','OPT-OTC20220162','OPT-OTC20220153','OPT-OTC20220089-1','OPT-OTC20220155','OPT-OTC20220126','OPT-OTC20220147','OPT-OTC20220129')
)
