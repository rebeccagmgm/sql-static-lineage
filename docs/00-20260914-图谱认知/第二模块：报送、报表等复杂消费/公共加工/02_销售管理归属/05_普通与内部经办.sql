-- 05：普通／内部经办角色。不要与三槽位客户经理或TIT角色混成一套关系。
-- cp：客户层面经办回退来源。OIS客户资料与香港引入资料UNION ALL，不做优先择一。
-- OIS o_otc_derivative_counterparty（衍生品交易对手维护表）：
-- client_id=客户编号，operator=经办人，introduction_operator=【AI】引入经办人；
-- 只取参数日且delete_flag='0'。这是字符0，不是介绍关系表的Is_Deleted='N'。
-- 香港g_hk_counterparty_introduction（香港交易对手引入信息）：
-- 这里用源表seq='1'，把introductor同时作为两个经办角色。
-- 与01_介绍关系排序重新按比例计算seq完全不同；这里没有读取源表operator字段。
customer_operator as (
    --关联经办人
    select client_id, operator, introduction_operator
    from odata_n_ois.o_otc_derivative_counterparty
    where busi_Date = '${data_day_str}' and delete_flag = '0'
    union all
    select client_id, introductor as operator, introductor as introduction_operator
    from odata_n_oom.g_hk_counterparty_introduction
    where busi_Date = '${data_day_str}' and seq = '1'
),

-- s_ba：odata_n_ois.o_contract_base_rate（【AI】合约基础系数表）。
-- CONTRACT_CODE=【AI】合约编号；operator_name→Main_Oper（主经办）；
-- introduction_operator_name→Intro_Oper（引入经办）。
-- 后者元数据写【AI】“主经办人”，与目标字段角色不一致；此处按实际SQL流向解释。
-- 07连接还限定info.Book_Bel_Dept='OTC'；香港合约不能从这一侧取得普通经办参数。
-- 两角色分别COALESCE到cp，NULL才回退；保留所有符合条件的参数行，不选“最新一条”。
contract_operator as (
    select *
    from odata_n_ois.o_contract_base_rate
    where busi_date = '${data_day_str}' and Is_Deleted = 'N'
),

-- is_ba：odata_n_ois.g_inr_contract_base_rate（内部销售合约基础系数表）。
-- operator_name=主经办人；introduction_operator_name=引入经办人。
-- 内部角色单独写Inr_Main_Oper／Inr_Intro_Oper；同样逐字段回退cp。
-- 与s_ba不同：07连接没有再限定Book_Bel_Dept='OTC'。
internal_contract_operator as (
    select *
    from odata_n_ois.g_inr_contract_base_rate
    where busi_date = '${data_day_str}' and Is_Deleted = 'N'
),

-- Main／Intro／i_Main／i_Intro共同读取这份员工资料，各自按选定OA账号连接。
-- PDATA_N.T98_ORG_EMP_BASE_INFO：Emp_Id员工编号，OA_User_Id OA用户编号，Emp_Name员工姓名。
-- 这些角色的输出Emp_Id直接取员工资料；没有介绍关系横排中的“员工号NULL回退OA号”。
-- 选择账号后若找不到员工，不会再试另一个账号；姓名和员工号保持NULL。
operator_employee as (
    SELECT Emp_Id, OA_User_Id, Emp_Name
    FROM PDATA_N.T98_ORG_EMP_BASE_INFO
    WHERE busi_date = '${data_day_str}'
)
