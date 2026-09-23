-- 03：把同一客户／合约的多行介绍关系，放进一行的第1、2、3组列。
-- 例：客户C1两行张三0.6、李四0.4 → C1一行：[张三0.6] [李四0.4] [空串0]。
-- 合约A1的关系另成一行；这里不把客户关系和合约关系合为一套，最终选择在07。
-- A来自01_介绍关系排序；D/org/dept来自02_人员与机构。
insert overwrite table otc_div_temp
select
    A.Contract_Code, -- 合约号；客户级关系填空串
    A.client_id, -- 客户号；合约级关系填空串
    -- 第1组：seq=1的关系提供值，其余行提供空串／0，再逐字段MAX合成一行。
    -- 下方分公司编号／名称分别回退到引入部门编号／OA名称；员工号NULL才回退OA号。
    max(case when A.seq = '1' then A.Introduction_Department else '' end) as Inr_Org_Id_1, -- 引入部门编号_1
    max(case when A.seq = '1' then org.ORGNAME else '' end) as Inr_Org_Name_1, -- 引入部门名称_1
    max(case when A.seq = '1' then coalesce(dept.Brch_Bel_Div_Org_Id,A.Introduction_Department) else '' end) as Div_Org_Id_1, -- 所属分公司编号_1
    max(case when A.seq = '1' then coalesce(dept.Brch_Bel_Div_Org_Name,org.ORGNAME) else '' end) as Div_Org_Name_1, -- 所属分公司名称_1
    max(case when A.seq = '1' then A.Customer_Manager else '' end) as Cust_Mngr_Id_1, -- 客户经理OA账号（源开发人员／引入人）_1
    max(case when A.seq = '1' then D.Emp_Name else '' end) as Cust_Mngr_Name_1, -- 客户经理姓名_1
    max(case when A.seq = '1' then COALESCE(D.Emp_Id, D.OA_User_Id, '') else '' end) as Cust_Mngr_Emp_Id_1, -- 客户经理员工编号_1
    max(case when A.seq = '1' then A.Allocation_Proportion else '0' end) as Allo_Prop_1, -- 分配比例_1

    -- 第2组：同一套公式，仅名次换为2；没有第2名时，已有关系行会贡献空串／0。
    max(case when A.seq = '2' then A.Introduction_Department else '' end) as Inr_Org_Id_2, -- 引入部门编号_2
    max(case when A.seq = '2' then org.ORGNAME else '' end) as Inr_Org_Name_2, -- 引入部门名称_2
    max(case when A.seq = '2' then coalesce(dept.Brch_Bel_Div_Org_Id,A.Introduction_Department) else '' end) as Div_Org_Id_2, -- 所属分公司编号_2
    max(case when A.seq = '2' then coalesce(dept.Brch_Bel_Div_Org_Name,org.ORGNAME) else '' end) as Div_Org_Name_2, -- 所属分公司名称_2
    max(case when A.seq = '2' then A.Customer_Manager else '' end) as Cust_Mngr_Id_2, -- 客户经理OA账号（源开发人员／引入人）_2
    max(case when A.seq = '2' then D.Emp_Name else '' end) as Cust_Mngr_Name_2, -- 客户经理姓名_2
    max(case when A.seq = '2' then COALESCE(D.Emp_Id, D.OA_User_Id, '') else '' end) as Cust_Mngr_Emp_Id_2, -- 客户经理员工编号_2
    max(case when A.seq = '2' then A.Allocation_Proportion else '0' end) as Allo_Prop_2, -- 分配比例_2

    -- 第3组：名次换为3。三组比例原样横排，不重新归一到1。
    max(case when A.seq = '3' then A.Introduction_Department else '' end) as Inr_Org_Id_3, -- 引入部门编号_3
    max(case when A.seq = '3' then org.ORGNAME else '' end) as Inr_Org_Name_3, -- 引入部门名称_3
    max(case when A.seq = '3' then coalesce(dept.Brch_Bel_Div_Org_Id,A.Introduction_Department) else '' end) as Div_Org_Id_3, -- 所属分公司编号_3
    max(case when A.seq = '3' then coalesce(dept.Brch_Bel_Div_Org_Name,org.ORGNAME) else '' end) as Div_Org_Name_3, -- 所属分公司名称_3
    max(case when A.seq = '3' then A.Customer_Manager else '' end) as Cust_Mngr_Id_3, -- 客户经理OA账号（源开发人员／引入人）_3
    max(case when A.seq = '3' then D.Emp_Name else '' end) as Cust_Mngr_Name_3, -- 客户经理姓名_3
    max(case when A.seq = '3' then COALESCE(D.Emp_Id, D.OA_User_Id, '') else '' end) as Cust_Mngr_Emp_Id_3, -- 客户经理员工编号_3
    max(case when A.seq = '3' then A.Allocation_Proportion else '0' end) as Allo_Prop_3, -- 分配比例_3

    -- 三组人员的员工状态：跟随对应名次，不用于筛除离职人员；列序沿用原表。
    max(case when A.seq = '1' then D.Emp_Stat_Cd else '' end) as Cust_Mngr_Emp_Stat_Cd_1, -- 客户经理员工状态代码_1
    max(case when A.seq = '1' then D.Emp_Stat_Desc else '' end) as Cust_Mngr_Emp_Stat_Desc_1, -- 客户经理员工状态描述_1
    max(case when A.seq = '2' then D.Emp_Stat_Cd else '' end) as Cust_Mngr_Emp_Stat_Cd_2, -- 客户经理员工状态代码_2
    max(case when A.seq = '2' then D.Emp_Stat_Desc else '' end) as Cust_Mngr_Emp_Stat_Desc_2, -- 客户经理员工状态描述_2
    max(case when A.seq = '3' then D.Emp_Stat_Cd else '' end) as Cust_Mngr_Emp_Stat_Cd_3, -- 客户经理员工状态代码_3
    max(case when A.seq = '3' then D.Emp_Stat_Desc else '' end) as Cust_Mngr_Emp_Stat_Desc_3 -- 客户经理员工状态描述_3
-- 补资料：账号 → 员工；引入部门号 → OA部门 → 分公司。缺资料仍保留源关系。
from introduction_ranked A
LEFT JOIN introduction_employee D
ON A.Customer_Manager = D.OA_User_Id
left join oa_department org
on A.Introduction_Department = org.dept_no
left join branch_division dept
on org.dept_no = dept.Inr_Org_Id
-- 客户级／合约级分别成行。没有来源系统分组：同客户跨来源的同名次可能竞争MAX。
-- MAX按每列独立取值，不是选择整条关系；超过第3名的行仍参与ELSE空串／0。
group by A.client_id, A.Contract_Code
;
