-- 06｜提取TIT系统登记的经办人和客户经理
tit_role as (
    select key_otc_trade_id, --trs合约id，后续连接info.Inr_Seri_No（内部流水号）
        max(case when property_name = 'operator' then property_value else '' end) as Tit_Oper_User_Id, --TIT经办人账号
        max(case when property_name = 'customerManager' then property_value else '' end) as Tit_Cust_Mngr_User_Id --TIT客户经理账号
    from odata_n_tit.d_trd_otc_contr_props --【AI】交易-场外合约结构-其他属性表
    where busi_Date = '${data_day_str}' and property_name in ('operator','customerManager')
    group by key_otc_trade_id
),

-- tit_role_employee：根据TIT经办人/客户经理账号，补充对应员工信息及员工当前所属机构。
-- 本步骤只按TIT账号查员工信息，
-- 不向OIS经办参数、介绍关系或其他人员来源做回退。

tit_role_employee as (
SELECT
Emp_Id, -- 员工编号
OA_User_Id, -- OA用户编号
Emp_Name, -- 员工姓名
Bel_Inr_Org_Id_Len4, -- 员工所属内部机构编号（4位）
Bel_Inr_Org_Name -- 员工所属内部机构名称
FROM PDATA_N.T98_ORG_EMP_BASE_INFO -- 员工基本信息
WHERE busi_date = '${data_day_str}'
)
